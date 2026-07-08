import { getSupabaseClient } from "./database.js?v=0.4.0";
import { dispatchDataChanged, normaliseText } from "./utilities.js?v=0.4.0";
import { moduleHeader, notifyError, notifySuccess, setButtonBusy } from "./ui.js?v=0.4.0";

const keys = ["dojo.profile", "invoice.defaults", "training.defaults", "training.default_days"];

export async function renderSettings(container) {
  const settings = await loadSettings();
  const dojo = settings["dojo.profile"] || {};
  const invoice = settings["invoice.defaults"] || {};
  const training = settings["training.defaults"] || {};
  const days = settings["training.default_days"] || ["Tuesday", "Thursday"];

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "System", title: "Settings", description: "Configure dojo details, training defaults and invoice preferences." })}
      <form id="settingsForm" class="section-card">
        <div class="section-card-header"><div><h3>Dojo details</h3><p class="muted">These values appear throughout the app and on invoices.</p></div></div>
        <div class="form-grid">
          <label class="form-field"><span class="form-label">Dojo name</span><input class="input" name="dojoName" required value="${attr(dojo.dojo_name || "JKA Christchurch – GardenCity")}"></label>
          <label class="form-field"><span class="form-label">Instructor name</span><input class="input" name="instructorName" required value="${attr(dojo.instructor_name || "André Von Rhenen")}"></label>
          <label class="form-field full"><span class="form-label">Location</span><input class="input" name="location" value="${attr(dojo.location || "Christchurch, New Zealand")}"></label>
        </div>

        <div class="section-card-header section-spacer"><div><h3>Training defaults</h3><p class="muted">Used when generating Tuesday and Thursday sessions.</p></div></div>
        <div class="form-grid three">
          <label class="form-field"><span class="form-label">Start time</span><input class="input" type="time" name="startTime" value="${attr(training.start_time || "18:00")}"></label>
          <label class="form-field"><span class="form-label">End time</span><input class="input" type="time" name="endTime" value="${attr(training.end_time || "19:30")}"></label>
          <label class="form-field"><span class="form-label">Default venue</span><input class="input" name="venue" value="${attr(training.venue || "Opawa School Hall")}"></label>
          <label class="checkbox-row"><input type="checkbox" name="tuesday" ${days.includes("Tuesday") ? "checked" : ""}><span>Tuesday classes</span></label>
          <label class="checkbox-row"><input type="checkbox" name="thursday" ${days.includes("Thursday") ? "checked" : ""}><span>Thursday classes</span></label>
        </div>

        <div class="section-card-header section-spacer"><div><h3>Invoice preferences</h3><p class="muted">Only account nicknames should be stored.</p></div></div>
        <div class="form-grid">
          <label class="form-field"><span class="form-label">Default payment terms</span><input class="input" type="number" min="0" max="120" name="paymentTermsDays" value="${Number(invoice.payment_terms_days ?? 14)}"></label>
          <label class="form-field"><span class="form-label">Account nickname</span><input class="input" name="accountNickname" value="${attr(invoice.account_nickname || "Kiwibank Dojo Account")}"></label>
          <label class="form-field full"><span class="form-label">Invoice footer</span><textarea class="textarea" name="invoiceFooter">${text(invoice.footer || "Thank you for supporting JKA Christchurch – GardenCity.")}</textarea></label>
        </div>
        <div class="dialog-footer embedded-footer"><button id="saveSettingsButton" class="button button-primary" type="submit">Save settings</button></div>
      </form>
    </div>`;

  container.querySelector("#settingsForm").addEventListener("submit", saveSettings);
}

async function loadSettings() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", keys).is("deleted_at", null);
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value]));
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("#saveSettingsButton");
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const days = [];
    if (data.get("tuesday")) days.push("Tuesday");
    if (data.get("thursday")) days.push("Thursday");

    const rows = [
      { setting_key: "dojo.profile", setting_value: { dojo_name: normaliseText(data.get("dojoName")), instructor_name: normaliseText(data.get("instructorName")), location: normaliseText(data.get("location")) }, description: "Dojo name, instructor and general location.", is_sensitive: false },
      { setting_key: "training.defaults", setting_value: { start_time: data.get("startTime"), end_time: data.get("endTime"), venue: normaliseText(data.get("venue")) }, description: "Default times and venue used to generate normal training sessions.", is_sensitive: false },
      { setting_key: "training.default_days", setting_value: days, description: "Normal dojo training days.", is_sensitive: false },
      { setting_key: "invoice.defaults", setting_value: { prefix: "JKA", payment_terms_days: Number(data.get("paymentTermsDays") || 14), account_nickname: normaliseText(data.get("accountNickname")), footer: normaliseText(data.get("invoiceFooter")), show_account_nickname_only: true }, description: "Invoice defaults and public payment instructions.", is_sensitive: false }
    ];

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "setting_key" });
    if (error) throw error;
    notifySuccess("Settings saved.");
    dispatchDataChanged({ module: "settings" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

function attr(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
function text(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
