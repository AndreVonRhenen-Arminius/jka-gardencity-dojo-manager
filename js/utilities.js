export const CONFIG = window.DOJO_CONFIG ?? {};

export function isConfigurationReady() {
  return Boolean(
    CONFIG.supabaseUrl &&
    CONFIG.supabasePublishableKey &&
    !CONFIG.supabasePublishableKey.includes("PASTE_")
  );
}

export function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(CONFIG.locale || "en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: CONFIG.timezone || "Pacific/Auckland",
    ...options
  }).format(date);
}

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(CONFIG.locale || "en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2
  }).format(amount);
}

export function todayIso() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timezone || "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

export function showToast(message, type = "info", duration = 4200) {
  const region = document.getElementById("toastRegion");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}

export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

export function readableError(error, fallback = "An unexpected error occurred.") {
  const message = error?.message || String(error || fallback);
  if (/not on the dojo authorised-user allowlist/i.test(message)) {
    return "This Microsoft account is not authorised to access the dojo app.";
  }
  if (/invalid api key|apikey/i.test(message)) {
    return "The Supabase publishable key in config.js is missing or incorrect.";
  }
  return message || fallback;
}
