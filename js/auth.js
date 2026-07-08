import { getSupabaseClient } from "./database.js";
import { CONFIG, readableError } from "./utilities.js";

const roleCodes = [
  ["administrator", "Administrator"],
  ["instructor", "Instructor"],
  ["attendance_only", "Attendance-only"],
  ["finance_only", "Finance-only"],
  ["read_only", "Read-only"]
];

export async function signInWithMicrosoft() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "email",
      redirectTo: CONFIG.siteUrl,
      queryParams: {
        prompt: "select_account"
      }
    }
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  clearDojoLocalState();
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function establishAuthorisedSession(session) {
  if (!session?.user) throw new Error("No authenticated Microsoft session was found.");

  const supabase = getSupabaseClient();
  const { error: syncError } = await supabase.rpc("sync_current_user_profile");
  if (syncError) {
    await supabase.auth.signOut({ scope: "local" });
    throw new Error(readableError(syncError));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,email,display_name,timezone,last_sign_in_at")
    .eq("user_id", session.user.id)
    .single();

  if (profileError) throw profileError;

  let role = "Authorised user";
  for (const [code, label] of roleCodes) {
    const { data, error } = await supabase.rpc("current_user_has_role", {
      p_role_code: code
    });
    if (!error && data === true) {
      role = label;
      break;
    }
  }

  return {
    user: session.user,
    profile,
    role
  };
}

function clearDojoLocalState() {
  const prefix = CONFIG.storagePrefix || "jka_dojo_";
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  }
}
