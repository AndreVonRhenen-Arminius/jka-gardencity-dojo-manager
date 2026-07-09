import { getSupabaseClient } from "./database.js?v=1.0.2";
import { dispatchDataChanged, formatCurrency, formatDate, normaliseText, todayIso } from "./utilities.js?v=1.0.2";
import { closeDialog, emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge } from "./ui.js?v=1.0.2";

let state = { terms: [] };

export async function renderTerms(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("terms").select("*").is("deleted_at", null).order("start_date", { ascending: false });
  if (error) throw error;
  state.terms = data || [];
}

function render(container) {
  const rows = state.terms.map(term => `
    <tr>
      <td><strong>${escapeHtml(term.term_name)}</strong><div class="record-meta">${term.academic_year}</div></td>
      <td>${formatDate(term.start_date)} – ${formatDate(term.end_date)}</td>
      <td>${term.number_of_training_weeks ?? "—"}</td>
      <td>${formatCurrency(term.default_term_fee || 0)}</td>
      <td>${formatCurrency(term.sibling_fee || 0)}</td>
      <td>${statusBadge(term.status)}</td>
      <td class="table-actions">
        <button class="button button-secondary button-small" data-action="edit" data-id="${term.id}">Edit</button>
        <button class="button button-primary button-small" data-action="generate" data-id="${term.id}">Generate sessions</button>
      </td>
    </tr>`).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "Training", title: "Terms", description: "Create dojo terms and generate normal Tuesday and Thursday sessions.", actions: '<button id="addTermButton" class="button button-primary" type="button">Add term</button>' })}
      ${state.terms.length ? `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Term</th><th>Dates</th><th>Weeks</th><th>Term fee</th><th>Sibling fee</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="termRows">${rows}</tbody>
        </table></div>` : emptyState("No terms configured", "Create the first dojo term, then generate the Tuesday and Thursday training sessions.")}
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
  if (button.dataset.action === "generate") generateSessions(term, button);
}

function openTermDialog(term = null) {
  const year = new Date().getFullYear();
  openDialog({
    title: term ? "Edit term" : "Add term",
    eyebrow: "Training",
    body: `
      <form id="termForm" class="form-grid">
        <input type="hidden" name="id" value="${term?.id || ""}">
        <label class="form-field"><span class="form-label">Term name</span><input class="input" name="termName" required value="${escapeHtml(term?.term_name || "Term 1")}"></label>
        <label class="form-field"><span class="form-label">Academic year</span><input class="input" type="number" min="2020" max="2200" name="academicYear" required value="${term?.academic_year || year}"></label>
        <label class="form-field"><span class="form-label">Term number</span><input class="input" type="number" min="1" max="9" name="termNumber" value="${term?.term_number || 1}"></label>
        <label class="form-field"><span class="form-label">Status</span><select class="select" name="status">
          ${["planned","open","closed","archived"].map(value => `<option value="${value}" ${term?.status === value || (!term && value === "planned") ? "selected" : ""}>${value}</option>`).join("")}
        </select></label>
        <label class="form-field"><span class="form-label">Start date</span><input class="input" type="date" name="startDate" required value="${term?.start_date || todayIso()}"></label>
        <label class="form-field"><span class="form-label">End date</span><input class="input" type="date" name="endDate" required value="${term?.end_date || todayIso()}"></label>
        <label class="form-field"><span class="form-label">Training weeks</span><input class="input" type="number" min="0" step="0.5" name="weeks" value="${term?.number_of_training_weeks ?? 10}"></label>
        <label class="form-field"><span class="form-label">Default term fee</span><input class="input" type="number" min="0" step="0.01" name="termFee" value="${term?.default_term_fee ?? 120}"></label>
        <label class="form-field"><span class="form-label">Sibling fee</span><input class="input" type="number" min="0" step="0.01" name="siblingFee" value="${term?.sibling_fee ?? 100}"></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(term?.notes || "")}</textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveTermButton" class="button button-primary" type="button">${term ? "Save changes" : "Create term"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveTermButton").addEventListener("click", saveTerm);
}

async function saveTerm(event) {
  const button = event.currentTarget;
  const form = document.getElementById("termForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const id = data.get("id");
    const row = {
      term_name: normaliseText(data.get("termName")),
      academic_year: Number(data.get("academicYear")),
      term_number: Number(data.get("termNumber")) || null,
      start_date: data.get("startDate"),
      end_date: data.get("endDate"),
      number_of_training_weeks: Number(data.get("weeks")) || null,
      status: data.get("status"),
      default_term_fee: Number(data.get("termFee")) || 0,
      sibling_fee: Number(data.get("siblingFee")) || 0,
      notes: normaliseText(data.get("notes")) || null
    };
    const supabase = getSupabaseClient();
    const result = id ? await supabase.from("terms").update(row).eq("id", id) : await supabase.from("terms").insert(row);
    if (result.error) throw result.error;
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(id ? "Term updated." : "Term created.");
    dispatchDataChanged({ module: "terms" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function generateSessions(term, button) {
  setButtonBusy(button, true, "Generating…");
  try {
    const supabase = getSupabaseClient();
    const [{ data: settings, error: settingsError }, { data: existing, error: existingError }, { data: closures, error: closureError }] = await Promise.all([
      supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", ["dojo.profile","training.defaults","training.default_days"]).is("deleted_at", null),
      supabase.from("training_sessions").select("session_date").eq("term_id", term.id).is("deleted_at", null),
      supabase.from("term_calendar_exceptions").select("exception_date").eq("term_id", term.id).eq("exception_type", "closure").is("deleted_at", null)
    ]);
    if (settingsError) throw settingsError;
    if (existingError) throw existingError;
    if (closureError) throw closureError;

    const map = Object.fromEntries((settings || []).map(row => [row.setting_key, row.setting_value]));
    const training = map["training.defaults"] || { start_time: "18:00", end_time: "19:30", venue: "Opawa School Hall" };
    const dojo = map["dojo.profile"] || { instructor_name: "André Von Rhenen" };
    const dayNames = map["training.default_days"] || ["Tuesday", "Thursday"];
    const dayNumbers = new Set(dayNames.map(day => day === "Tuesday" ? 2 : day === "Thursday" ? 4 : null).filter(Boolean));
    const existingDates = new Set((existing || []).map(row => row.session_date));
    const closedDates = new Set((closures || []).map(row => row.exception_date));

    const rows = [];
    const date = new Date(`${term.start_date}T12:00:00Z`);
    const end = new Date(`${term.end_date}T12:00:00Z`);
    while (date <= end) {
      const iso = date.toISOString().slice(0, 10);
      if (dayNumbers.has(date.getUTCDay()) && !existingDates.has(iso) && !closedDates.has(iso)) {
        rows.push({
          term_id: term.id,
          session_date: iso,
          start_time: training.start_time || "18:00",
          end_time: training.end_time || "19:30",
          venue: training.venue || "Opawa School Hall",
          instructor_name: dojo.instructor_name || "André Von Rhenen",
          session_type: "normal_class",
          status: "scheduled"
        });
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }

    if (!rows.length) {
      notifySuccess("No new sessions were required.");
      return;
    }
    const { error } = await supabase.from("training_sessions").insert(rows);
    if (error) throw error;
    notifySuccess(`${rows.length} sessions created.`);
    dispatchDataChanged({ module: "sessions" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}
