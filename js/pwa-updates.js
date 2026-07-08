import { showToast } from "./utilities.js?v=0.4.0";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showToast("A new version is available. Reload the app to update.", "info", 8000);
        }
      });
    });
  } catch (error) {
    console.error("Service worker registration failed:", error);
  }
}
