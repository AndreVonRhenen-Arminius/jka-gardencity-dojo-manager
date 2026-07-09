import { getSupabaseClient } from "./database.js?v=1.2.0";
import {
  dispatchDataChanged,
  formatCurrency,
  formatDate,
  normaliseText,
  todayIso
} from "./utilities.js?v=1.2.0";
import {
  closeDialog,
  emptyState,
  escapeHtml,
  moduleHeader,
  notifyError,
  notifySuccess,
  openDialog,
  setButtonBusy,
  statusBadge
} from "./ui.js?v=1.2.0";
import { syncTermSessions } from "./term-sync.js?v=1.2.0";
import { DEFAULT_FEE_SETTINGS } from "./billing.js?v=1.2.0";

let state = { terms: [], sessions: [], feeSettings: DEFAULT_FEE_SETTINGS };

export async function renderTerms(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [termsResult, sessionsResult, feesResult] = await Promise.all([
    supabase.from("terms").select("*").is("deleted_at", null).order("start_date", { ascending: false }),
    supabase.from("training_sessions").select("id,term_id,status,session_type").is("deleted_at", null),
    supabase.from("app_settings").select("setting_value").eq("setting_key", "fees.defaults").is("deleted_at", null).maybeSingle()
  ]);
  if (termsResult.error) throw termsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (feesResult.error) throw feesResult.error;
  state = {
    terms: termsResult.data || [],
    sessions: sessionsResult.data || [],
    feeSettings: { ...DEFAULT_FEE_SETTINGS, ...(feesResult.data?.setting_value || {}) }
  };
}

function render(container) {
  const rows = state.terms.map(term => {
    const activeSessions = state.sessions.filter(session =>
      session.term_id === term.id &&
      session.session_type === "normal_class" &&
      session.status !== "cancelled"
    ).length;
    return `<tr>
      <td><strong>${escapeHtml(term.term_name)}</strong><div class="record-meta">${term.academic_year}</div></td>
      <td>${formatDate(term.start_date)} – ${formatDate(term.end_date)}</td>
      <td><strong>${term.number_of_training_weeks ?? 0}</strong><div class="record-meta">Calculated from sessions</div></td>
      <td>${activeSessions}</td>
      <td>${formatCurrency(term.default_term_fee || state.feeSettings.first_term_fee)}</td>
      <td>${formatCurrency(term.sibling_fee || state.feeSettings.sibling_term_fee)}</td>
      <td>${statusBadge(term.status)}</td>
      <td class="table-actions">
        <button class="button button-secondary button-small" data-action="edit" data-id="${term.id}">Edit</button>
        <button class="button button-primary button-small" data-action="sync" data-id="${term.id}">Sync sessions</button>
      </td>
    </tr>`;
  }).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({
      eyebrow: "Training",
      title: "Terms",
      description: "Term dates are the source of truth. Saving or syncing a term creates the normal sessions, updates Attendance and recalculates billable payment weeks.",
      actions: '<button id="addTermButton" class="button button-primary" type="button">Add term</button>'
    })}
    <div class="master-record-banner">
      <div><strong>Automatic term workflow</strong><p>Normal sessions are created from the selected training days in Settings. A billable week is counted when at least one normal session remains scheduled or completed in that Monday–Sunday week.</p></div>
      <span class="badge success">Sessions → Attendance</span>
    </div>
    ${state.terms.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Term</th><th>Dates</th><th>Payment weeks</th><th>Sessions</th><th>First member</th><th>Sibling</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="termRows">${rows}</tbody>
    </table></div>` : emptyState("No terms configured", "Create the first term. Its sessions and payment weeks will be calculated automatically.")}
  </div>`;

  container.querySelector("#addTermButton").addEventListener("click", () => openTermDialog());
  container.querySelector("#termRows")?.addEventListener("click", handleAction);
}

function handleAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const term = state.terms.find(item => item.id === button.dataset.id);
  if (!term) return;
  if (button.dataset.action === "edit") openTermDialog(term);
  if (button.dataset.action === "sync") syncTerm(term, button);
}

function openTermDialog(term = null) {
  const year = new Date().getFullYear();
  openDialog({
    title: term ? "Edit term and sync sessions" : "Add term and generate sessions",
    eyebrow: "Training",
    body: `<form id="termForm" class="form-grid">
      <input type="hidden" name="id" value="${term?.id || ""}">
      <label class="form-field"><span class="form-label">Term name</span><input class="input" name="termName" required value="${escapeHtml(term?.term_name || "Term 1")}"></label>
      <label class="form-field"><span class="form-label">Academic year</span><input class="input" type="number" min="2020" max="2200" name="academicYear" required value="${term?.academic_year || year}"></label>
      <label class="form-field"><span class="form-label">Term number</span><input class="input" type="number" min="1" max="9" name="termNumber" value="${term?.term_number || 1}"></label>
      <label class="form-field"><span class="form-label">Status</span><select class="select" name="status">${["planned", "open", "closed", "archived"].map(value => `<option value="${value}" ${term?.status === value || (!term && value === "planned") ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="form-field"><span class="form-label">Start date</span><input class="input" type="date" name="startDate" required value="${term?.start_date || todayIso()}"></label>
      <label class="form-field"><span class="form-label">End date</span><input class="input" type="date" name="endDate" required value="${term?.end_date || todayIso()}"></label>
      <label class="form-field"><span class="form-label">First family member term fee</span><input class="input" type="number" min="0" step="0.01" name="termFee" value="${term?.default_term_fee ?? state.feeSettings.first_term_fee}"></label>
      <label class="form-field"><span class="form-label">Additional family member term fee</span><input class="input" type="number" min="0" step="0.01" name="siblingFee" value="${term?.sibling_fee ?? state.feeSettings.sibling_term_fee}"></label>
      <div class="inline-message full"><strong>Training weeks:</strong> calculated automatically after sessions are synced. Closures and cancelled weeks reduce the payment-week count.</div>
      <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(term?.notes || "")}</textarea></label>
    </form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveTermButton" class="button button-primary" type="button">${term ? "Save and sync" : "Create and sync"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveTermButton").addEventListener("click", saveTerm);
}

async function saveTerm(event) {
  const button = event.currentTarget;
  const form = document.getElementById("termForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true, "Saving and syncing…");
  try {
    const data = new FormData(form);
    if (data.get("endDate") < data.get("startDate")) {
      throw new Error("The term end date cannot be before the start date.");
    }
    const id = data.get("id");
    const row = {
      term_name: normaliseText(data.get("termName")),
      academic_year: Number(data.get("academicYear")),
      term_number: Number(data.get("termNumber")) || null,
      start_date: data.get("startDate"),
      end_date: data.get("endDate"),
      status: data.get("status"),
      default_term_fee: Number(data.get("termFee")) || 0,
      sibling_fee: Number(data.get("siblingFee")) || 0,
      notes: normaliseText(data.get("notes")) || null
    };
    const supabase = getSupabaseClient();
    const result = id
      ? await supabase.from("terms").update(row).eq("id", id).select("*").single()
      : await supabase.from("terms").insert(row).select("*").single();
    if (result.error) throw result.error;

    const summary = await syncTermSessions(result.data);
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(`Term saved: ${summary.weeks} payment weeks and ${summary.desiredSessions} normal sessions synced.`);
    dispatchDataChanged({ module: "terms", termId: result.data.id });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function syncTerm(term, button) {
  setButtonBusy(button, true, "Syncing…");
  try {
    const summary = await syncTermSessions(term);
    await refresh();
    render(document.getElementById("moduleContent"));
    const preserved = summary.preservedWithAttendance
      ? ` ${summary.preservedWithAttendance} older session(s) with attendance were preserved.`
      : "";
    notifySuccess(`${summary.weeks} payment weeks synced. ${summary.inserted} added, ${summary.updated || 0} updated, ${summary.restored} restored and ${summary.cancelled} cancelled.${preserved}`);
    dispatchDataChanged({ module: "sessions", termId: term.id });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}
