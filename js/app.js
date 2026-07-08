import {
  CONFIG, isConfigurationReady, readableError, setText, showToast
} from "./utilities.js?v=0.3.1";
import {
  signInWithMicrosoft, signOut, getCurrentSession,
  onAuthStateChange, establishAuthorisedSession
} from "./auth.js?v=0.3.1";
import { loadDashboard } from "./dashboard.js?v=0.3.1";
import { initialiseNavigation } from "./navigation.js?v=0.3.1";
import { registerServiceWorker } from "./pwa-updates.js?v=0.3.1";

const BUILD_VERSION = "0.3.1";

const loginView = document.getElementById("loginView");
const appShell = document.getElementById("appShell");
const loginStatus = document.getElementById("loginStatus");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");
const configurationError = document.getElementById("configurationError");

let inactivityTimer;
let currentSessionId;
let pendingLoginMessage = "";

async function initialise() {
  setText("versionLabel", BUILD_VERSION);
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

  // Register the listener before the first session check.
  onAuthStateChange((event, session) => handleAuthEvent(event, session));

  try {
    const session = await getCurrentSession();
    if (session) {
      await handleAuthenticatedSession(session);
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin(readableError(error));
  }
}

async function handleAuthEvent(event, session) {
  if (event === "SIGNED_OUT" || !session) {
    currentSessionId = undefined;
    const message = pendingLoginMessage;
    pendingLoginMessage = "";
    showLogin(message);
    return;
  }

  if (
    ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event) &&
    session.access_token !== currentSessionId
  ) {
    await handleAuthenticatedSession(session);
  }
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
  if (!session?.access_token) {
    showLogin("Microsoft sign-in did not return a valid session.");
    return;
  }

  currentSessionId = session.access_token;
  loginStatus.textContent = "Checking authorised access…";
  loginStatus.className = "status-message";

  try {
    const identity = await establishAuthorisedSession(session);
    setText("userDisplayName", identity.profile.display_name || identity.profile.email);
    setText("userRole", identity.role);
    pendingLoginMessage = "";
    showApp();
    resetInactivityTimer();
    await loadDashboardSafely();
  } catch (error) {
    const message = readableError(error);
    pendingLoginMessage = message;
    currentSessionId = undefined;

    try {
      await signOut();
    } catch (signOutError) {
      console.error("Sign-out after an authentication error failed:", signOutError);
    }

    showLogin(message);
  }
}

async function handleSignOut() {
  pendingLoginMessage = "Signed out.";

  try {
    await signOut();
  } finally {
    currentSessionId = undefined;
    showLogin(pendingLoginMessage);
  }
}

function showLogin(message = "") {
  clearTimeout(inactivityTimer);
  appShell.hidden = true;
  loginView.hidden = false;
  signInButton.disabled = !isConfigurationReady();
  loginStatus.textContent = message;
  loginStatus.className = message ? "status-message error" : "status-message";
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
    showToast(
      readableError(error, "Dashboard information could not be loaded."),
      "error"
    );
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
