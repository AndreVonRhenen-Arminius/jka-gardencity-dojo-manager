import { showToast } from "./utilities.js?v=1.3.0";

let deferredInstallPrompt = null;
let installed = false;

const installButtons = () => [
  document.getElementById("loginInstallButton"),
  document.getElementById("topbarInstallButton")
].filter(Boolean);

export function initialiseInstallExperience() {
  installed = isRunningAsInstalledApp();

  if (installed) {
    hideInstallButtons();
    updateInstallStatus("Installed app");
  } else {
    showInstallButtons();
    updateInstallStatus("Browser version — install available");
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (!isRunningAsInstalledApp()) {
      showInstallButtons();
      updateInstallStatus("Ready to install");
    }
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredInstallPrompt = null;
    hideInstallButtons();
    updateInstallStatus("Installed app");
    showToast("JKA GardenCity Dojo Manager was installed.", "success");
  });

  for (const button of installButtons()) {
    button.addEventListener("click", promptForInstallation);
  }

  // Edge may expose the event shortly after page load.
  window.setTimeout(() => {
    if (!installed && !deferredInstallPrompt) {
      updateInstallStatus("Install from Edge Apps menu if the button is not shown");
    }
  }, 2500);
}

async function promptForInstallation() {
  if (isRunningAsInstalledApp()) {
    hideInstallButtons();
    showToast("The app is already installed.", "info");
    return;
  }

  if (!deferredInstallPrompt) {
    showToast(
      "In Microsoft Edge, open the three-dot menu, select Apps, then Install JKA GardenCity Dojo Manager.",
      "info",
      8500
    );
    return;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  hideInstallButtons();

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;

  if (choice?.outcome === "accepted") {
    updateInstallStatus("Installing…");
  } else {
    showInstallButtons();
    updateInstallStatus("Installation cancelled");
  }
}

function isRunningAsInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.navigator.standalone === true;
}

function showInstallButtons() {
  for (const button of installButtons()) {
    button.hidden = false;
  }
}

function hideInstallButtons() {
  for (const button of installButtons()) {
    button.hidden = true;
  }
}

function updateInstallStatus(message) {
  const status = document.getElementById("installStatus");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
}
