// JKA GardenCity Dojo Manager
// Public browser configuration only.
// Never place a service-role key, Microsoft client secret, password or bank credential here.

window.DOJO_CONFIG = Object.freeze({
  appName: "JKA GardenCity Dojo Manager",
  appId: "nz.jka.gardencity.dojo-manager",
  version: "0.3.0",
  supabaseUrl: "https://YOUR-DOJO-PROJECT.supabase.co",
  supabasePublishableKey: "PASTE_DOJO_SUPABASE_PUBLISHABLE_KEY_HERE",
  siteUrl: "https://YOUR-GITHUB-USERNAME.github.io/jka-gardencity-dojo-manager/",
  timezone: "Pacific/Auckland",
  locale: "en-NZ",
  inactivityMinutes: 30,
  storagePrefix: "jka_dojo_",
  indexedDbName: "jka-gardencity-dojo-manager-v1",
  backupType: "JKA_GARDENCITY_DOJO_BACKUP"
});
