import {
  CONFIG, isConfigurationReady, readableError, setText, showToast
} from "./utilities.js";
import {
  signInWithMicrosoft, signOut, getCurrentSession,
  onAuthStateChange, establishAuthorisedSession
} from "./auth.js";
import { loadDashboard } from "./dashboard.js";
import { initialiseNavigation } from "./navigation.js";
import { registerServiceWorker } from "./pwa-updates.js";

const loginView = document.getElementById("loginView");
const appShell = document.getElementById("appShell");
const loginStatus = document.getElementById("loginStatus");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");
const configurationError = document.getElementById("configurationError");

let inactivityTimer;
let currentSessionId;

async function initialise() {
  setText("versionLabel", CONFIG.version || "0.3.0");
  initialiseConnectivity();
  initialiseNavigation(page => {
    if (page === "dashboard") loadDashboardSafely();
  });
  initialiseInactivitySignOut();
  await registerServiceWorker();

  if (!isConfigurationReady()) {
    configurationError.hidden = false;
    signInButton.disabled = true;
    loginStatus.textContent = "Add the dojo Supabase publishable key to config.js before signing in.";
    loginStatus.className = "status-message error";
    return;
  }

  signInButton.addEventListener("click", handleSignIn);
  signOutButton.addEventListener("click", handleSignOut);
  refreshDashboardButton.addEventListener("click", loadDashboardSafely);

  try {
    const session = await getCurrentSession();
    if (session) await handleAuthenticatedSession(session);
    else showLogin();
  } catch (error) {
    showLogin(readableError(error));
  }

  onAuthStateChange(async session => {
    if (session?.access_token && session.access_token !== currentSessionId) {
      await handleAuthenticatedSession(session);
    } else if (!session) {
      currentSessionId = undefined;
      showLogin();
    }
  });
}

async function handleSignIn() {
  signInButton.disabled = true;
  loginStatus.textContent = "Opening Microsoft sign-in…";
  loginStatus.className = "status-message";
  try {
    await signInWithMicrosoft();
  } catch (error) {
    signInButton.disabled = false;
    loginStatus.textContent = readableError(error);
    loginStatus.className = "status-message error";
  }
}

async function handleAuthenticatedSession(session) {
  currentSessionId = session.access_token;
  loginStatus.textContent = "Checking authorised access…";
  try {
    const identity = await establishAuthorisedSession(session);
    setText("userDisplayName", identity.profile.display_name || identity.profile.email);
    setText("userRole", identity.role);
    showApp();
    resetInactivityTimer();
    await loadDashboardSafely();
  } catch (error) {
    currentSessionId = undefined;
    showLogin(readableError(error));
  }
}

async function handleSignOut() {
  try {
    await signOut();
  } finally {
    currentSessionId = undefined;
    showLogin("Signed out.");
  }
}

function showLogin(message = "") {
  clearTimeout(inactivityTimer);
  appShell.hidden = true;
  loginView.hidden = false;
  signInButton.disabled = !isConfigurationReady();
  loginStatus.textContent = message;
  loginStatus.className = message ? "status-message" : "status-message";
}

function showApp() {
  loginView.hidden = true;
  appShell.hidden = false;
  configurationError.hidden = true;
  document.getElementById("mainContent").focus();
}

async function loadDashboardSafely() {
  try {
    await loadDashboard();
  } catch (error) {
    showToast(readableError(error, "Dashboard information could not be loaded."), "error");
  }
}

function initialiseConnectivity() {
  const update = () => {
    const online = navigator.onLine;
    const badge = document.getElementById("syncBadge");
    badge.dataset.state = online ? "synced" : "offline";
    setText("syncText", online ? "Cloud connected" : "Offline");
    setText("connectionLabel", online ? "Online" : "Offline");
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function initialiseInactivitySignOut() {
  const events = ["pointerdown", "keydown", "touchstart", "scroll"];
  for (const eventName of events) {
    window.addEventListener(eventName, resetInactivityTimer, { passive: true });
  }
}

function resetInactivityTimer() {
  if (appShell.hidden) return;
  clearTimeout(inactivityTimer);
  const minutes = Number(CONFIG.inactivityMinutes || 30);
  inactivityTimer = window.setTimeout(async () => {
    showToast("You were signed out after a period of inactivity.", "info");
    await handleSignOut();
  }, minutes * 60 * 1000);
}

initialise().catch(error => {
  console.error(error);
  showLogin(readableError(error));
});
