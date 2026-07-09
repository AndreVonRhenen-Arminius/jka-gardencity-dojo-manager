import { getSupabaseClient } from "./database.js?v=1.0.1";
import { getCurrentSession } from "./auth.js?v=1.0.1";
import { dispatchDataChanged, formatDateTime, normaliseText } from "./utilities.js?v=1.0.1";
import { closeDialog, escapeHtml, moduleHeader, notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge } from "./ui.js?v=1.0.1";

const keys = ["dojo.profile", "invoice.defaults", "training.defaults", "training.default_days", "security.inactivity_timeout_minutes"];
let accessState = { users: [], roles: [], assignments: [], currentAuthUserId: null };

export async function renderSettings(container) {
  const [settings] = await Promise.all([loadSettings(), loadAccess()]);
  const dojo = settings["dojo.profile"] || {};
  const invoice = settings["invoice.defaults"] || {};
  const training = settings["training.defaults"] || {};
  const days = settings["training.default_days"] || ["Tuesday", "Thursday"];
  const timeout = Number(settings["security.inactivity_timeout_minutes"] ?? 30);
  const roleMap = new Map(accessState.roles.map(role => [role.id, role.role_name]));
  const userRows = accessState.users.map(user => {
    const roleNames = accessState.assignments.filter(item => item.authorised_user_id === user.id && !item.removed_at).map(item => roleMap.get(item.role_id)).filter(Boolean);
    return `<tr><td><strong>${escapeHtml(user.email)}</strong><div class="record-meta">${user.auth_user_id ? "Signed in and linked" : "Pre-authorised; not linked yet"}</div></td><td>${roleNames.map(name => `<span class="badge success">${escapeHtml(name)}</span>`).join(" ") || "—"}</td><td>${user.is_active && !user.revoked_at ? '<span class="badge success">Active</span>' : '<span class="badge danger">Revoked</span>'}</td><td>${formatDateTime(user.authorised_at)}</td><td>${user.access_expires_at ? formatDateTime(user.access_expires_at) : "No expiry"}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="edit-access" data-id="${user.id}">Role / expiry</button>${isCurrentSignedInUser(user) ? `<span class="badge muted">Current user</span>` : (user.is_active && !user.revoked_at ? `<button class="button button-danger button-small" data-action="revoke-access" data-id="${user.id}">Revoke</button>` : `<button class="button button-primary button-small" data-action="reactivate-access" data-id="${user.id}">Reactivate</button>`)}</td></tr>`;
  }).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "System", title: "Settings", description: "Configure dojo defaults, invoice preferences and authorised access.", actions: '<button id="addAuthorisedUserButton" class="button button-secondary" type="button">Authorise another user</button>' })}
    <form id="settingsForm" class="section-card">
      <div class="section-card-header"><div><h3>Dojo details</h3><p class="muted">These values appear throughout the app and on invoices.</p></div></div>
      <div class="form-grid"><label class="form-field"><span class="form-label">Dojo name</span><input class="input" name="dojoName" required value="${attr(dojo.dojo_name || "JKA Christchurch – GardenCity")}"></label><label class="form-field"><span class="form-label">Instructor name</span><input class="input" name="instructorName" required value="${attr(dojo.instructor_name || "André Von Rhenen")}"></label><label class="form-field full"><span class="form-label">Location</span><input class="input" name="location" value="${attr(dojo.location || "Christchurch, New Zealand")}"></label></div>
      <div class="section-card-header section-spacer"><div><h3>Training defaults</h3><p class="muted">Used when generating Tuesday and Thursday sessions.</p></div></div>
      <div class="form-grid three"><label class="form-field"><span class="form-label">Start time</span><input class="input" type="time" name="startTime" value="${attr(training.start_time || "18:00")}"></label><label class="form-field"><span class="form-label">End time</span><input class="input" type="time" name="endTime" value="${attr(training.end_time || "19:30")}"></label><label class="form-field"><span class="form-label">Default venue</span><input class="input" name="venue" value="${attr(training.venue || "Opawa School Hall")}"></label><label class="checkbox-row"><input type="checkbox" name="tuesday" ${days.includes("Tuesday") ? "checked" : ""}><span>Tuesday classes</span></label><label class="checkbox-row"><input type="checkbox" name="thursday" ${days.includes("Thursday") ? "checked" : ""}><span>Thursday classes</span></label></div>
      <div class="section-card-header section-spacer"><div><h3>Invoice and security preferences</h3><p class="muted">Only account nicknames should be shown on invoices.</p></div></div>
      <div class="form-grid"><label class="form-field"><span class="form-label">Default payment terms</span><input class="input" type="number" min="0" max="120" name="paymentTermsDays" value="${Number(invoice.payment_terms_days ?? 14)}"></label><label class="form-field"><span class="form-label">Account nickname</span><input class="input" name="accountNickname" value="${attr(invoice.account_nickname || "Kiwibank Dojo Account")}"></label><label class="form-field"><span class="form-label">Inactivity sign-out (minutes)</span><input class="input" type="number" min="5" max="240" name="timeout" value="${timeout}"><span class="form-help">The new timeout is used immediately after the settings are saved.</span></label><label class="form-field full"><span class="form-label">Invoice footer</span><textarea class="textarea" name="invoiceFooter">${text(invoice.footer || "Thank you for supporting JKA Christchurch – GardenCity.")}</textarea></label></div>
      <div class="dialog-footer embedded-footer"><button id="saveSettingsButton" class="button button-primary" type="submit">Save settings</button></div>
    </form>
    <section class="section-card"><div class="section-card-header"><div><h3>Authorised users and roles</h3><p class="muted">Microsoft authentication alone does not provide access. Every user must also be active in this allowlist.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Email</th><th>Roles</th><th>Status</th><th>Authorised</th><th>Expiry</th><th>Actions</th></tr></thead><tbody id="accessRows">${userRows}</tbody></table></div></section>
  </div>`;

  container.querySelector("#settingsForm").addEventListener("submit", saveSettings);
  container.querySelector("#addAuthorisedUserButton").addEventListener("click", () => openAccessDialog());
  container.querySelector("#accessRows").addEventListener("click", handleAccessAction);
}

async function loadSettings() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", keys).is("deleted_at", null);
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value]));
}
async function loadAccess() {
  const supabase = getSupabaseClient();
  const [usersResult, rolesResult, assignmentsResult] = await Promise.all([
    supabase.from("authorised_users").select("*").order("email"),
    supabase.from("roles").select("*").eq("is_active", true).order("role_name"),
    supabase.from("user_role_assignments").select("*")
  ]);
  if (usersResult.error) throw usersResult.error; if (rolesResult.error) throw rolesResult.error; if (assignmentsResult.error) throw assignmentsResult.error;
  const session = await getCurrentSession();
  accessState = {
    users: usersResult.data || [],
    roles: rolesResult.data || [],
    assignments: assignmentsResult.data || [],
    currentAuthUserId: session?.user?.id || null
  };
}

async function saveSettings(event) {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector("#saveSettingsButton"); setButtonBusy(button, true);
  try {
    const data = new FormData(form), days = []; if (data.get("tuesday")) days.push("Tuesday"); if (data.get("thursday")) days.push("Thursday");
    const rows = [
      { setting_key: "dojo.profile", setting_value: { dojo_name: normaliseText(data.get("dojoName")), instructor_name: normaliseText(data.get("instructorName")), location: normaliseText(data.get("location")) }, description: "Dojo name, instructor and general location.", is_sensitive: false },
      { setting_key: "training.defaults", setting_value: { start_time: data.get("startTime"), end_time: data.get("endTime"), venue: normaliseText(data.get("venue")) }, description: "Default times and venue used to generate normal training sessions.", is_sensitive: false },
      { setting_key: "training.default_days", setting_value: days, description: "Normal dojo training days.", is_sensitive: false },
      { setting_key: "invoice.defaults", setting_value: { prefix: "JKA", payment_terms_days: Number(data.get("paymentTermsDays") || 14), account_nickname: normaliseText(data.get("accountNickname")), footer: normaliseText(data.get("invoiceFooter")), show_account_nickname_only: true }, description: "Invoice defaults and public payment instructions.", is_sensitive: false },
      { setting_key: "security.inactivity_timeout_minutes", setting_value: Number(data.get("timeout") || 30), description: "Default automatic sign-out period after inactivity.", is_sensitive: false }
    ];
    const supabase = getSupabaseClient(); const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "setting_key" }); if (error) throw error;
    notifySuccess("Settings saved."); dispatchDataChanged({ module: "settings" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}


function activeAdministratorUserIds() {
  const administratorRole = accessState.roles.find(role => role.role_code === "administrator");
  if (!administratorRole) return new Set();

  const activeUserIds = new Set(
    accessState.users
      .filter(user => user.is_active && !user.revoked_at)
      .map(user => user.id)
  );

  return new Set(
    accessState.assignments
      .filter(assignment =>
        !assignment.removed_at &&
        assignment.role_id === administratorRole.id &&
        activeUserIds.has(assignment.authorised_user_id)
      )
      .map(assignment => assignment.authorised_user_id)
  );
}

function isCurrentSignedInUser(user) {
  return Boolean(user?.auth_user_id && user.auth_user_id === accessState.currentAuthUserId);
}

function handleAccessAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const user = accessState.users.find(item => item.id === button.dataset.id); if (!user) return;
  if (button.dataset.action === "edit-access") openAccessDialog(user);
  if (button.dataset.action === "revoke-access") revokeAccess(user);
  if (button.dataset.action === "reactivate-access") reactivateAccess(user);
}

function openAccessDialog(user = null) {
  const activeAssignment = user ? accessState.assignments.find(item => item.authorised_user_id === user.id && !item.removed_at) : null;
  openDialog({
    title: user ? "Change authorised access" : "Authorise Microsoft account", eyebrow: "System",
    body: `<form id="accessForm" class="form-grid"><input type="hidden" name="id" value="${user?.id || ""}"><label class="form-field full"><span class="form-label">Microsoft account email</span><input class="input" type="email" name="email" required value="${escapeHtml(user?.email || "")}" ${user ? "readonly" : ""}></label><label class="form-field"><span class="form-label">Role</span><select class="select" name="roleId" required><option value="">Select role</option>${accessState.roles.map(role => `<option value="${role.id}" ${activeAssignment?.role_id === role.id ? "selected" : ""}>${escapeHtml(role.role_name)}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Access expires</span><input class="input" type="datetime-local" name="expires" value="${user?.access_expires_at ? new Date(user.access_expires_at).toISOString().slice(0,16) : ""}"></label><label class="form-field full"><span class="form-label">Reason / notes</span><textarea class="textarea" name="reason">${escapeHtml(user?.authorisation_reason || "Authorised dojo user")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveAccessButton" class="button button-primary" type="button">${user ? "Save access" : "Authorise user"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveAccessButton").addEventListener("click", saveAccess);
}

async function saveAccess(event) {
  const button = event.currentTarget, form = document.getElementById("accessForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), email = normaliseText(data.get("email")).toLowerCase(), roleId = data.get("roleId"), supabase = getSupabaseClient();
    const administratorRole = accessState.roles.find(role => role.role_code === "administrator");
    const currentAssignment = id
      ? accessState.assignments.find(item => item.authorised_user_id === id && !item.removed_at)
      : null;
    const currentlyAdministrator = Boolean(
      currentAssignment && currentAssignment.role_id === administratorRole?.id
    );
    const remainingAdministrators = activeAdministratorUserIds();

    if (
      id &&
      currentlyAdministrator &&
      roleId !== administratorRole?.id &&
      remainingAdministrators.size <= 1
    ) {
      throw new Error("The dojo must retain at least one active Administrator.");
    }

    let userId = id;
    if (id) {
      const { error } = await supabase.from("authorised_users").update({ access_expires_at: data.get("expires") ? new Date(data.get("expires")).toISOString() : null, authorisation_reason: normaliseText(data.get("reason")) || null, is_active: true, revoked_at: null, revocation_reason: null }).eq("id", id); if (error) throw error;
    } else {
      const { data: user, error } = await supabase.from("authorised_users").insert({ email, is_active: true, access_expires_at: data.get("expires") ? new Date(data.get("expires")).toISOString() : null, authorisation_reason: normaliseText(data.get("reason")) || "Authorised dojo user" }).select("id").single(); if (error) throw error; userId = user.id;
    }
    const activeAssignments = accessState.assignments.filter(item => item.authorised_user_id === userId && !item.removed_at);
    for (const assignment of activeAssignments) if (assignment.role_id !== roleId) await supabase.from("user_role_assignments").update({ removed_at: new Date().toISOString() }).eq("id", assignment.id);
    const existing = accessState.assignments.find(item => item.authorised_user_id === userId && item.role_id === roleId);
    if (existing) { const { error } = await supabase.from("user_role_assignments").update({ removed_at: null, removed_by: null, notes: "Role assigned through Settings" }).eq("id", existing.id); if (error) throw error; }
    else { const { error } = await supabase.from("user_role_assignments").insert({ authorised_user_id: userId, role_id: roleId, notes: "Role assigned through Settings" }); if (error) throw error; }
    closeDialog(); await renderSettings(document.getElementById("moduleContent")); notifySuccess(id ? "Access updated." : "User authorised. They can sign in with that Microsoft account.");
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

async function revokeAccess(user) {
  if (isCurrentSignedInUser(user)) {
    notifyError(new Error("You cannot revoke the Microsoft account currently signed in."));
    return;
  }

  const administratorRole = accessState.roles.find(role => role.role_code === "administrator");
  const isAdministrator = accessState.assignments.some(item =>
    item.authorised_user_id === user.id &&
    item.role_id === administratorRole?.id &&
    !item.removed_at
  );

  if (isAdministrator && activeAdministratorUserIds().size <= 1) {
    notifyError(new Error("The dojo must retain at least one active Administrator."));
    return;
  }

  const reason = window.prompt(
    `Reason for revoking ${user.email}:`,
    "Access no longer required"
  );
  if (reason === null) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("authorised_users")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: normaliseText(reason) || "Access revoked"
      })
      .eq("id", user.id);

    if (error) throw error;
    await renderSettings(document.getElementById("moduleContent"));
    notifySuccess("Access revoked.");
  } catch (error) {
    notifyError(error);
  }
}

async function reactivateAccess(user) {
  try { const supabase = getSupabaseClient(); const { error } = await supabase.from("authorised_users").update({ is_active: true, revoked_at: null, revoked_by: null, revocation_reason: null }).eq("id", user.id); if (error) throw error; await renderSettings(document.getElementById("moduleContent")); notifySuccess("Access reactivated."); }
  catch (error) { notifyError(error); }
}

function attr(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"); }
function text(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
