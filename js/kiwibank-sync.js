import { getSupabaseClient } from "./database.js?v=1.3.0";

export async function callKiwibankSync(action, payload = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("kiwibank-sync", {
    body: { action, ...payload }
  });

  if (error) {
    throw new Error(error.message || "The Kiwibank sync function could not be reached.");
  }

  if (data?.ok === false) {
    const details = typeof data.details === "string"
      ? data.details
      : data.details?.message || "";
    throw new Error(details ? `${data.error}: ${details}` : data.error || "The Kiwibank sync function returned an error.");
  }

  return data || {};
}
