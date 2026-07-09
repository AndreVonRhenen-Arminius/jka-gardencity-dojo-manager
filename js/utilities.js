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

  const text = typeof value === "string" ? value.trim() : "";
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  let raw;
  let defaultTimeZone;

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    raw = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day)
    ));

    // PostgreSQL DATE values are calendar dates, not moments in time.
    // Formatting them in Pacific/Auckland previously moved Tuesdays to
    // Wednesdays and Thursdays to Fridays.
    defaultTimeZone = "UTC";
  } else {
    raw = value instanceof Date ? value : new Date(value);
    defaultTimeZone = CONFIG.timezone || "Pacific/Auckland";
  }

  if (Number.isNaN(raw.getTime())) return String(value);

  return new Intl.DateTimeFormat(CONFIG.locale || "en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: defaultTimeZone,
    ...options
  }).format(raw);
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(CONFIG.locale || "en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CONFIG.timezone || "Pacific/Auckland"
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timezone || "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function nowIso() {
  return new Date().toISOString();
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
  const message = error?.message || error?.details || String(error || fallback);
  if (/not on the dojo authorised-user allowlist/i.test(message)) {
    return "This Microsoft account is not authorised to access the dojo app.";
  }
  if (/invalid api key|apikey/i.test(message)) {
    return "The Supabase publishable key in config.js is missing or incorrect.";
  }
  if (/duplicate key|already exists/i.test(message)) {
    return "A record with the same identifying information already exists.";
  }
  return message || fallback;
}

export function normaliseText(value) {
  return String(value ?? "").trim();
}

export function parseMoney(value) {
  const amount = Number.parseFloat(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T12:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function datePlusDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function dispatchDataChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent("dojo:data-changed", { detail }));
}
