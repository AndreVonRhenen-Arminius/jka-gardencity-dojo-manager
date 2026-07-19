import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { HttpError } from "./cors.ts";

export type AuthContext = {
  mode: "user" | "cron";
  userId: string;
  userEmail?: string;
  adminClient: ReturnType<typeof createClient>;
  userClient?: ReturnType<typeof createClient>;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `Missing required server secret: ${name}`);
  return value;
}

export function assertAllowedOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const allowedOrigin = Deno.env.get("DOJO_APP_ORIGIN") || "https://andrevonrhenen-arminius.github.io";

  // CLI tests and scheduled jobs may not send Origin. Browser requests must match exactly.
  if (origin && origin !== allowedOrigin) {
    throw new HttpError(403, "Request origin is not allowed for this dojo app.", { origin });
  }
}

export async function authenticateRequest(req: Request): Promise<AuthContext> {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ownerUserId = requireEnv("DOJO_OWNER_USER_ID");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const cronSecret = Deno.env.get("DOJO_CRON_SECRET");
  const suppliedCronSecret = req.headers.get("x-dojo-cron-secret");
  if (cronSecret && suppliedCronSecret && suppliedCronSecret === cronSecret) {
    return {
      mode: "cron",
      userId: ownerUserId,
      adminClient
    };
  }

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!jwt) {
    throw new HttpError(401, "Missing signed-in Supabase user token.");
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    throw new HttpError(401, "Invalid or expired Supabase user token.");
  }

  if (userData.user.id !== ownerUserId) {
    throw new HttpError(403, "This bank-sync function is restricted to the dojo owner account.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  const { data: accessAllowed, error: accessError } = await userClient.rpc(
    "current_dojo_user_has_bank_sync_access"
  );

  if (accessError) {
    throw new HttpError(403, "Could not confirm banking access for the signed-in user.", accessError.message);
  }

  if (accessAllowed !== true) {
    throw new HttpError(403, "The signed-in user does not have dojo banking access.");
  }

  return {
    mode: "user",
    userId: userData.user.id,
    userEmail: userData.user.email || undefined,
    adminClient,
    userClient
  };
}
