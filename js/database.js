import { CONFIG, isConfigurationReady } from "./utilities.js?v=1.2.0";

let client;

export function getSupabaseClient() {
  if (client) return client;
  if (!isConfigurationReady()) {
    throw new Error("The Supabase publishable key has not been configured.");
  }
  if (!window.supabase?.createClient) {
    throw new Error("The local Supabase browser library did not load.");
  }

  client = window.supabase.createClient(
    CONFIG.supabaseUrl,
    CONFIG.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: `${CONFIG.storagePrefix}auth`
      },
      global: {
        headers: {
          "X-Client-Info": `${CONFIG.appId}/1.1.0`
        }
      }
    }
  );

  return client;
}
