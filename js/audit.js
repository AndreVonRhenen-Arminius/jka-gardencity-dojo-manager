import { getSupabaseClient } from "./database.js?v=1.3.0";
import { formatDateTime } from "./utilities.js?v=1.3.0";
import {
  confirmAction, emptyState, escapeHtml, moduleHeader, notifyError,
  notifySuccess, openDialog, closeDialog, statusBadge
} from "./ui.js?v=1.3.0";

const restorableTables = new Set([
  "app_settings","families","guardians","students","student_notes","student_emergency_contacts",
  "student_medical_information","student_safety_alerts","enquiries","follow_up_tasks","terms",
  "term_calendar_exceptions","term_enrolments","dojo_events","training_sessions","attendance_records",
  "grading_events","grading_records","student_progress","student_goals","fee_schedules","fee_schedule_items",
  "student_billing_profiles","student_discounts","referral_reward_rules","referral_reward_awards","charge_batches",
  "charge_batch_items","suppliers","financial_accounts","expenses","expense_payments","recurring_expenses",
  "expense_occurrences","bank_column_mappings","bank_import_batches","bank_transactions","matching_rules",
  "account_transfers","bank_reconciliations","communication_history"
]);

let state = { events: [], deleted: [], devices: [], conflicts: [] };

export async function renderAudit(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("audit_events").select("*").order("occurred_at", { ascending: false }).limit(500),
    supabase.from("deleted_record_index").select("*").eq("restore_status", "deleted").order("deleted_at", { ascending: false }).limit(200),
    supabase.from("registered_devices").select("*").order("last_seen_at", { ascending: false }).limit(100),
    supabase.from("sync_conflicts").select("*").order("detected_at", { ascending: false }).limit(100)
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.events, state.deleted, state.devices, state.conflicts] = results.map(result => result.data || []);
}

function render(container) {
  const eventRows = state.events.map(item => `<tr data-search="${escapeHtml(`${item.action} ${item.record_type} ${item.summary} ${item.source}`.toLowerCase())}"><td>${formatDateTime(item.occurred_at)}</td><td>${escapeHtml(item.action.replaceAll("_"," "))}</td><td>${escapeHtml(item.record_type)}</td><td>${escapeHtml(item.summary)}</td><td>${escapeHtml(item.source)}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="details" data-id="${item.id}">Details</button></td></tr>`).join("");
  const deletedRows = state.deleted.map(item => `<tr><td>${formatDateTime(item.deleted_at)}</td><td>${escapeHtml(item.record_type)}</td><td>${escapeHtml(item.display_label || item.record_id)}</td><td>${statusBadge(item.restore_status)}</td><td class="table-actions"><button class="button button-primary button-small" data-action="restore" data-id="${item.id}" ${restorableTables.has(item.record_type) ? "" : "disabled"}>Restore</button></td></tr>`).join("");
  const deviceRows = state.devices.map(item => `<tr><td>${escapeHtml(item.device_name || "Unnamed device")}</td><td>${escapeHtml(item.browser_info || "—")}</td><td>${formatDateTime(item.first_seen_at)}</td><td>${formatDateTime(item.last_seen_at)}</td><td>${item.is_trusted ? '<span class="badge success">Trusted</span>' : '<span class="badge warning">Not trusted</span>'}</td><td>${item.revoked_at ? '<span class="badge danger">Revoked</span>' : '<span class="badge success">Active</span>'}</td></tr>`).join("");
  const conflictRows = state.conflicts.map(item => `<tr><td>${formatDateTime(item.detected_at)}</td><td>${escapeHtml(item.record_type)}</td><td>${escapeHtml(item.record_id)}</td><td>${statusBadge(item.status)}</td><td>${escapeHtml(item.resolution_notes || "—")}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="conflict-details" data-id="${item.id}">Details</button><button class="button button-primary button-small" data-action="dismiss-conflict" data-id="${item.id}" ${item.status !== "open" ? "disabled" : ""}>Dismiss</button></td></tr>`).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "System", title: "Audit History", description: "Review protected change history, restore eligible archived records and inspect device or sync activity." })}
    <div class="summary-grid"><article class="summary-tile"><span>Audit events loaded</span><strong>${state.events.length}</strong></article><article class="summary-tile"><span>Recycle bin</span><strong>${state.deleted.length}</strong></article><article class="summary-tile"><span>Registered devices</span><strong>${state.devices.length}</strong></article><article class="summary-tile"><span>Open conflicts</span><strong>${state.conflicts.filter(item => item.status === "open").length}</strong></article></div>
    <section class="section-card"><div class="section-card-header"><div><h3>Audit events</h3><p class="muted">Audit entries cannot be edited through the app.</p></div><input id="auditSearch" class="input compact-search" type="search" placeholder="Search action, type or summary"></div>${state.events.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Action</th><th>Record type</th><th>Summary</th><th>Source</th><th>Details</th></tr></thead><tbody id="auditRows">${eventRows}</tbody></table></div>` : emptyState("No audit events", "Important changes will appear here.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Recycle bin</h3><p class="muted">Restore soft-deleted operational records. Confirmed financial history is intentionally not restored through this screen.</p></div></div>${state.deleted.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Deleted</th><th>Type</th><th>Record</th><th>Status</th><th>Action</th></tr></thead><tbody id="deletedRows">${deletedRows}</tbody></table></div>` : emptyState("Recycle bin is empty", "Archived records eligible for restoration will appear here.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Registered devices</h3></div></div>${state.devices.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Device</th><th>Browser</th><th>First seen</th><th>Last seen</th><th>Trust</th><th>Status</th></tr></thead><tbody>${deviceRows}</tbody></table></div>` : emptyState("No registered devices", "Device records will appear when device registration is enabled.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Sync conflicts</h3></div></div>${state.conflicts.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Detected</th><th>Type</th><th>Record</th><th>Status</th><th>Resolution</th><th>Actions</th></tr></thead><tbody id="conflictRows">${conflictRows}</tbody></table></div>` : emptyState("No conflicts", "No local/cloud conflicts have been recorded.")}</section>
  </div>`;

  container.querySelector("#auditSearch")?.addEventListener("input", event => document.querySelectorAll("#auditRows tr").forEach(row => row.hidden = event.target.value.trim() && !row.dataset.search.includes(event.target.value.trim().toLowerCase())));
  container.querySelector("#auditRows")?.addEventListener("click", event => { const button = event.target.closest("button[data-action='details']"); if (button) showEventDetails(state.events.find(item => item.id === button.dataset.id)); });
  container.querySelector("#deletedRows")?.addEventListener("click", event => { const button = event.target.closest("button[data-action='restore']"); if (button) restoreDeleted(state.deleted.find(item => item.id === button.dataset.id)); });
  container.querySelector("#conflictRows")?.addEventListener("click", handleConflictAction);
}

function showEventDetails(item) {
  if (!item) return;
  openDialog({ title: "Audit event details", eyebrow: "System", body: `<dl class="status-list"><div><dt>Date</dt><dd>${formatDateTime(item.occurred_at)}</dd></div><div><dt>Action</dt><dd>${escapeHtml(item.action)}</dd></div><div><dt>Record</dt><dd>${escapeHtml(item.record_type)} · ${escapeHtml(item.record_id || "—")}</dd></div><div><dt>Summary</dt><dd>${escapeHtml(item.summary)}</dd></div><div><dt>Source</dt><dd>${escapeHtml(item.source)}</dd></div><div><dt>User ID</dt><dd>${escapeHtml(item.user_id || "System")}</dd></div></dl><div class="split-layout section-spacer"><div><h3>Previous value</h3><pre class="json-viewer">${escapeHtml(JSON.stringify(item.previous_value, null, 2) || "null")}</pre></div><div><h3>New value</h3><pre class="json-viewer">${escapeHtml(JSON.stringify(item.new_value, null, 2) || "null")}</pre></div></div>`, footer: `<button class="button button-secondary" type="button" data-close-dialog>Close</button>` });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
}

async function restoreDeleted(item) {
  if (!item || !restorableTables.has(item.record_type)) return;
  if (!await confirmAction(`Restore ${item.display_label || item.record_id} from ${item.record_type}?`)) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(item.record_type).update({ deleted_at: null, deleted_by: null }).eq("id", item.record_id);
    if (error) throw error;
    await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Record restored.");
  } catch (error) { notifyError(error); }
}

function handleConflictAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const item = state.conflicts.find(row => row.id === button.dataset.id); if (!item) return;
  if (button.dataset.action === "conflict-details") showConflict(item);
  if (button.dataset.action === "dismiss-conflict") dismissConflict(item);
}
function showConflict(item) {
  openDialog({ title: "Sync conflict", eyebrow: "System", body: `<dl class="status-list"><div><dt>Detected</dt><dd>${formatDateTime(item.detected_at)}</dd></div><div><dt>Record</dt><dd>${escapeHtml(item.record_type)} · ${escapeHtml(item.record_id)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(item.status)}</dd></div></dl><div class="split-layout section-spacer"><div><h3>Local version</h3><pre class="json-viewer">${escapeHtml(JSON.stringify(item.local_version, null, 2))}</pre></div><div><h3>Cloud version</h3><pre class="json-viewer">${escapeHtml(JSON.stringify(item.cloud_version, null, 2))}</pre></div></div>`, footer: `<button class="button button-secondary" type="button" data-close-dialog>Close</button>` });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
}
async function dismissConflict(item) {
  const notes = window.prompt("Resolution notes:", "Reviewed and dismissed") || "Reviewed and dismissed";
  try { const supabase = getSupabaseClient(); const { error } = await supabase.from("sync_conflicts").update({ status: "dismissed", resolution_notes: notes, resolved_at: new Date().toISOString() }).eq("id", item.id); if (error) throw error; await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Conflict dismissed."); }
  catch (error) { notifyError(error); }
}
