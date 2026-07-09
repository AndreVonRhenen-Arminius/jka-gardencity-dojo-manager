import { getSupabaseClient } from "./database.js?v=1.0.2";
import { CONFIG, formatDateTime, normaliseText, todayIso } from "./utilities.js?v=1.0.2";
import { emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, setButtonBusy, statusBadge } from "./ui.js?v=1.0.2";

const BACKUP_MAGIC = "JKA_GARDENCITY_DOJO_ENCRYPTED_BACKUP";
const BACKUP_VERSION = 2;
const ITERATIONS = 250000;
const tableOrder = [
  "app_settings", "families", "guardians", "guardian_families", "students", "student_guardians",
  "student_notes", "student_emergency_contacts", "student_medical_information", "student_safety_alerts",
  "enquiries", "follow_up_tasks", "terms", "term_calendar_exceptions", "term_enrolments", "dojo_events",
  "training_sessions", "attendance_records", "grading_events", "grading_records", "student_progress", "student_goals",
  "fee_schedules", "fee_schedule_items", "student_billing_profiles", "student_discounts", "referral_reward_rules",
  "referral_reward_awards", "charge_batches", "charge_batch_items", "charges", "payments", "payment_allocations",
  "financial_adjustments", "refunds", "invoices", "invoice_items", "suppliers", "financial_accounts", "expenses",
  "expense_payments", "recurring_expenses", "expense_occurrences", "bank_column_mappings", "bank_import_batches",
  "bank_transactions", "matching_rules", "bank_payment_matches", "bank_expense_matches", "account_transfers",
  "bank_transfer_matches", "bank_reconciliations", "reconciliation_items", "communication_history", "sync_conflicts"
];

let state = { history: [], conflicts: [], checkpoints: [] };
let loadedBackup = null;

export async function renderBackup(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("backup_history").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("sync_conflicts").select("*").order("detected_at", { ascending: false }).limit(50),
    supabase.from("device_sync_checkpoints").select("*").order("updated_at", { ascending: false }).limit(50)
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.history, state.conflicts, state.checkpoints] = results.map(result => result.data || []);
}

function render(container) {
  const historyRows = state.history.map(item => `<tr><td>${formatDateTime(item.created_at)}</td><td>${escapeHtml(item.backup_type.replaceAll("_", " "))}</td><td>${escapeHtml(item.file_name || "—")}</td><td>${escapeHtml(item.backup_version)}</td><td>${statusBadge(item.validation_status)}</td><td>${escapeHtml(item.reason || "—")}</td></tr>`).join("");
  const conflictRows = state.conflicts.map(item => `<tr><td>${formatDateTime(item.detected_at)}</td><td>${escapeHtml(item.record_type)}</td><td>${escapeHtml(item.record_id)}</td><td>${statusBadge(item.status)}</td><td>${escapeHtml(item.resolution_notes || "—")}</td></tr>`).join("");
  const lastCheckpoint = state.checkpoints[0];

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "System", title: "Backup & Sync", description: "Create password-encrypted manual backups, validate files and perform controlled merge restores.", actions: '<button id="createBackupButton" class="button button-primary" type="button">Create encrypted backup</button><button id="loadBackupButton" class="button button-secondary" type="button">Validate or restore backup</button>' })}
    <div class="summary-grid"><article class="summary-tile"><span>Backups recorded</span><strong>${state.history.length}</strong></article><article class="summary-tile"><span>Open sync conflicts</span><strong>${state.conflicts.filter(item => item.status === "open").length}</strong></article><article class="summary-tile"><span>Last successful sync</span><strong class="metric-text">${lastCheckpoint?.last_successful_sync_at ? formatDateTime(lastCheckpoint.last_successful_sync_at) : "Cloud live"}</strong></article><article class="summary-tile"><span>Encryption</span><strong class="metric-text">AES-256-GCM</strong></article></div>
    <section class="section-card security-warning"><div class="section-card-header"><div><h3>Backup security</h3><p class="muted">Backups can contain student contact, medical and financial information. Use a strong password, store the file securely and never upload it to public GitHub.</p></div></div><ul class="plain-list"><li>The password is not stored by the app.</li><li>A forgotten password cannot be recovered.</li><li>Restore uses merge-only mode and does not overwrite records already present.</li><li>A backup is not a substitute for Supabase platform backups.</li></ul></section>
    <section class="section-card"><div class="section-card-header"><div><h3>Backup history</h3></div></div>${state.history.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Created</th><th>Type</th><th>File</th><th>Version</th><th>Validation</th><th>Reason</th></tr></thead><tbody>${historyRows}</tbody></table></div>` : emptyState("No backups recorded", "Create the first encrypted manual backup before entering large amounts of live data.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Sync conflicts</h3><p class="muted">Normal online use writes directly to Supabase. Conflicts are retained for explicit review.</p></div></div>${state.conflicts.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Detected</th><th>Type</th><th>Record</th><th>Status</th><th>Resolution</th></tr></thead><tbody>${conflictRows}</tbody></table></div>` : emptyState("No sync conflicts", "No unresolved local/cloud conflicts have been recorded.")}</section>
    <input id="backupFileInput" type="file" accept=".jkabackup,.json,application/json" hidden>
  </div>`;

  container.querySelector("#createBackupButton").addEventListener("click", createBackupFlow);
  container.querySelector("#loadBackupButton").addEventListener("click", () => document.getElementById("backupFileInput").click());
  container.querySelector("#backupFileInput").addEventListener("change", loadBackupFile);
}

async function createBackupFlow(event) {
  const password = window.prompt("Enter a strong backup password (at least 10 characters):");
  if (!password) return;
  if (password.length < 10) { notifyError(new Error("Use a password of at least 10 characters.")); return; }
  const confirmPassword = window.prompt("Re-enter the backup password:");
  if (password !== confirmPassword) { notifyError(new Error("The passwords do not match.")); return; }
  const reason = window.prompt("Backup reason:", "Manual encrypted backup") || "Manual encrypted backup";
  const button = event.currentTarget; setButtonBusy(button, true, "Creating backup…");
  try {
    const backup = await collectBackup(reason);
    const encrypted = await encryptBackup(backup, password);
    const fileName = `JKA-GardenCity-Backup-${todayIso()}.jkabackup`;
    downloadBlob(new Blob([JSON.stringify(encrypted)], { type: "application/json" }), fileName);
    const counts = Object.fromEntries(Object.entries(backup.tables).map(([table, rows]) => [table, rows.length]));
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("backup_history").insert({ backup_type: "manual_export", backup_version: String(BACKUP_VERSION), schema_version: backup.schema_version, file_name: fileName, reason, record_counts: counts, validation_status: "valid", validation_message: "Encrypted backup created in the browser.", encryption_method: `PBKDF2-SHA256-${ITERATIONS}+AES-256-GCM`, storage_location_note: "Downloaded to the user's device." });
    if (error) throw error;
    await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Encrypted backup downloaded. Store it securely.");
  } catch (error) { notifyError(error); }
  finally { setButtonBusy(button, false); }
}

async function collectBackup(reason) {
  const supabase = getSupabaseClient();
  const { data: schemaRow, error: schemaError } = await supabase.from("schema_versions").select("version").order("applied_at", { ascending: false }).limit(1).maybeSingle();
  if (schemaError) throw schemaError;
  const tables = {};
  for (const table of tableOrder) tables[table] = await fetchAllRows(table);
  return { application_id: CONFIG.appId, application_name: CONFIG.appName, backup_format_version: BACKUP_VERSION, app_version: "1.0.0", schema_version: schemaRow?.version || "unknown", created_at: new Date().toISOString(), reason, tables };
}

async function fetchAllRows(table) {
  const supabase = getSupabaseClient(), rows = []; let start = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(start, start + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    start += 1000;
  }
  return rows;
}

async function encryptBackup(backup, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify(backup));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { magic: BACKUP_MAGIC, format_version: BACKUP_VERSION, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: toBase64(salt) }, encryption: { name: "AES-GCM", iv: toBase64(iv) }, ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

async function deriveKey(password, salt, usages) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, usages);
}
function toBase64(bytes) { let binary = ""; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function fromBase64(value) { const binary = atob(value), bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }

async function loadBackupFile(event) {
  const file = event.target.files[0]; event.target.value = ""; if (!file) return;
  try {
    const wrapper = JSON.parse(await file.text());
    if (wrapper.magic !== BACKUP_MAGIC) throw new Error("This is not a JKA GardenCity encrypted backup.");
    const password = window.prompt("Enter the backup password:"); if (!password) return;
    const backup = await decryptBackup(wrapper, password);
    validateBackup(backup);
    loadedBackup = { backup, fileName: file.name };
    showRestorePanel(backup, file.name);
  } catch (error) { loadedBackup = null; notifyError(new Error(`Backup validation failed: ${error.message}`)); }
}

async function decryptBackup(wrapper, password) {
  const salt = fromBase64(wrapper.kdf.salt), iv = fromBase64(wrapper.encryption.iv), ciphertext = fromBase64(wrapper.ciphertext);
  const key = await deriveKey(password, salt, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
function validateBackup(backup) {
  if (backup.application_id !== CONFIG.appId) throw new Error("The backup belongs to a different application.");
  if (!backup.tables || typeof backup.tables !== "object") throw new Error("The backup has no table data.");
  if (!backup.created_at || !backup.schema_version) throw new Error("Backup metadata is incomplete.");
}

function showRestorePanel(backup, fileName) {
  const counts = Object.entries(backup.tables).map(([table, rows]) => `<tr><td>${escapeHtml(table)}</td><td>${Array.isArray(rows) ? rows.length : 0}</td></tr>`).join("");
  const output = document.getElementById("moduleContent");
  output.insertAdjacentHTML("afterbegin", `<section id="restorePanel" class="section-card restore-panel"><div class="section-card-header"><div><p class="eyebrow">Validated backup</p><h3>${escapeHtml(fileName)}</h3><p class="muted">Created ${formatDateTime(backup.created_at)} · Schema ${escapeHtml(backup.schema_version)} · App ${escapeHtml(backup.app_version || "unknown")}</p></div><span class="status-badge success">Valid</span></div><div class="split-layout"><div><p>${escapeHtml(backup.reason || "No reason recorded")}</p><p class="muted">Merge restore inserts records that are missing. It does not overwrite existing records or remove current data.</p><button id="restoreBackupButton" class="button button-danger" type="button">Merge restore this backup</button></div><div class="table-wrap compact-table"><table class="data-table"><thead><tr><th>Table</th><th>Rows</th></tr></thead><tbody>${counts}</tbody></table></div></div></section>`);
  document.getElementById("restoreBackupButton").addEventListener("click", restoreBackup);
  document.getElementById("restorePanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function restoreBackup(event) {
  if (!loadedBackup) return;
  const confirmation = window.prompt('Type RESTORE to confirm a merge restore. Existing records will not be overwritten.');
  if (confirmation !== "RESTORE") return;
  const button = event.currentTarget; setButtonBusy(button, true, "Restoring…");
  try {
    const backup = loadedBackup.backup, supabase = getSupabaseClient();
    const families = (backup.tables.families || []).map(row => ({ ...row, primary_guardian_id: null }));
    const familyPrimary = (backup.tables.families || []).map(row => ({ id: row.id, primary_guardian_id: row.primary_guardian_id })).filter(row => row.primary_guardian_id);
    const feeStatuses = (backup.tables.fee_schedules || []).map(row => ({ id: row.id, status: row.status }));
    const invoiceStatuses = (backup.tables.invoices || []).map(row => ({ id: row.id, status: row.status, issued_at: row.issued_at, cancelled_at: row.cancelled_at, cancellation_reason: row.cancellation_reason }));

    for (const table of tableOrder) {
      let rows = backup.tables[table] || [];
      if (!rows.length) continue;
      if (table === "families") rows = families;
      if (table === "fee_schedules") rows = rows.map(row => ({ ...row, status: "draft" }));
      if (table === "invoices") rows = rows.map(row => ({ ...row, status: "draft", issued_at: null, cancelled_at: null, cancellation_reason: null }));
      for (let i = 0; i < rows.length; i += 250) {
        const chunk = rows.slice(i, i + 250);
        const options = table === "app_settings" ? { onConflict: "setting_key", ignoreDuplicates: true } : { onConflict: "id", ignoreDuplicates: true };
        const { error } = await supabase.from(table).upsert(chunk, options);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }
    for (const row of familyPrimary) await supabase.from("families").update({ primary_guardian_id: row.primary_guardian_id }).eq("id", row.id).is("primary_guardian_id", null);
    for (const row of feeStatuses) await supabase.from("fee_schedules").update({ status: row.status }).eq("id", row.id).eq("status", "draft");
    for (const row of invoiceStatuses) await supabase.from("invoices").update({ status: row.status, issued_at: row.issued_at, cancelled_at: row.cancelled_at, cancellation_reason: row.cancellation_reason }).eq("id", row.id).eq("status", "draft");

    const counts = Object.fromEntries(Object.entries(backup.tables).map(([table, rows]) => [table, rows.length]));
    const { error: historyError } = await supabase.from("backup_history").insert({ backup_type: "restore_safety_backup", backup_version: String(BACKUP_VERSION), schema_version: backup.schema_version, file_name: loadedBackup.fileName, reason: `Merge restore from backup created ${backup.created_at}`, record_counts: counts, validation_status: "restored_successfully", validation_message: "Merge restore completed without overwriting existing record IDs.", encryption_method: `PBKDF2-SHA256-${ITERATIONS}+AES-256-GCM`, storage_location_note: "User-selected local backup file." });
    if (historyError) throw historyError;
    loadedBackup = null; await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Backup merge restore completed.");
  } catch (error) { notifyError(new Error(`Restore failed: ${error.message}`)); }
  finally { setButtonBusy(button, false); }
}

function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
