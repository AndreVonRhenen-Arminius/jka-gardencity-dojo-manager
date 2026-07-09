import { getSupabaseClient } from "./database.js?v=1.2.0";
import { dispatchDataChanged, formatDate, normaliseText, todayIso } from "./utilities.js?v=1.2.0";
import { closeDialog, emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge } from "./ui.js?v=1.2.0";
import { recalculateTermWeeks } from "./term-sync.js?v=1.2.0";

let state = { sessions: [], terms: [], settings: {} };

export async function renderSessions(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [sessionsResult, termsResult, settingsResult] = await Promise.all([
    supabase.from("training_sessions").select("*").is("deleted_at", null).order("session_date", { ascending: false }).limit(100),
    supabase.from("terms").select("id,term_name,academic_year,start_date,end_date,status").is("deleted_at", null).order("start_date", { ascending: false }),
    supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", ["dojo.profile", "training.defaults"]).is("deleted_at", null)
  ]);
  if (sessionsResult.error) throw sessionsResult.error;
  if (termsResult.error) throw termsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  state = {
    sessions: sessionsResult.data || [],
    terms: termsResult.data || [],
    settings: Object.fromEntries((settingsResult.data || []).map(row => [row.setting_key, row.setting_value]))
  };
}

function render(container) {
  const termMap = new Map(state.terms.map(term => [term.id, `${term.term_name} ${term.academic_year}`]));
  const rows = state.sessions.map(session => `
    <tr>
      <td><strong>${formatDate(session.session_date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</strong></td>
      <td>${escapeHtml((session.start_time || "").slice(0,5))}–${escapeHtml((session.end_time || "").slice(0,5))}</td>
      <td>${escapeHtml(session.venue || "—")}</td>
      <td>${escapeHtml(session.session_type.replaceAll("_"," "))}</td>
      <td>${escapeHtml(termMap.get(session.term_id) || "—")}</td>
      <td>${statusBadge(session.status)}</td>
      <td class="table-actions"><button class="button button-secondary button-small" data-action="edit" data-id="${session.id}">Edit</button></td>
    </tr>`).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "Training", title: "Sessions", description: "Review normal classes, special events and cancellations.", actions: '<button id="addSessionButton" class="button button-primary" type="button">Add session</button>' })}
      ${state.sessions.length ? `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Date</th><th>Time</th><th>Venue</th><th>Type</th><th>Term</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="sessionRows">${rows}</tbody>
        </table></div>` : emptyState("No training sessions", "Generate sessions from a term or add a special session manually.")}
    </div>`;

  container.querySelector("#addSessionButton").addEventListener("click", () => openSessionDialog());
  container.querySelector("#sessionRows")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    const session = state.sessions.find(item => item.id === button.dataset.id);
    if (session) openSessionDialog(session);
  });
}

function openSessionDialog(session = null) {
  const training = state.settings["training.defaults"] || {};
  const dojo = state.settings["dojo.profile"] || {};
  const termOptions = ['<option value="">No term</option>', ...state.terms.map(term => `<option value="${term.id}" ${session?.term_id === term.id ? "selected" : ""}>${escapeHtml(`${term.term_name} ${term.academic_year}`)}</option>`)].join("");

  openDialog({
    title: session ? "Edit session" : "Add session",
    eyebrow: "Training",
    body: `
      <form id="sessionForm" class="form-grid">
        <input type="hidden" name="id" value="${session?.id || ""}">
        <label class="form-field"><span class="form-label">Date</span><input class="input" type="date" name="date" required value="${session?.session_date || todayIso()}"></label>
        <label class="form-field"><span class="form-label">Term</span><select class="select" name="termId">${termOptions}</select></label>
        <label class="form-field"><span class="form-label">Start time</span><input class="input" type="time" name="startTime" value="${(session?.start_time || training.start_time || "18:00").slice(0,5)}"></label>
        <label class="form-field"><span class="form-label">End time</span><input class="input" type="time" name="endTime" value="${(session?.end_time || training.end_time || "19:30").slice(0,5)}"></label>
        <label class="form-field"><span class="form-label">Venue</span><input class="input" name="venue" value="${escapeHtml(session?.venue || training.venue || dojo.venue_name || "Opawa School Hall")}"></label>
        <label class="form-field"><span class="form-label">Instructor</span><input class="input" name="instructor" value="${escapeHtml(session?.instructor_name || dojo.instructor_name || "André Von Rhenen")}"></label>
        <label class="form-field"><span class="form-label">Session type</span><select class="select" name="sessionType">
          ${["normal_class","grading_preparation","gasshuku","seminar","competition_training","private_lesson","special_event"].map(value => `<option value="${value}" ${session?.session_type === value ? "selected" : ""}>${value.replaceAll("_"," ")}</option>`).join("")}
        </select></label>
        <label class="form-field"><span class="form-label">Status</span><select class="select" name="status">
          ${["scheduled","completed","cancelled"].map(value => `<option value="${value}" ${session?.status === value || (!session && value === "scheduled") ? "selected" : ""}>${value}</option>`).join("")}
        </select></label>
        <label class="form-field full"><span class="form-label">Theme or lesson focus</span><input class="input" name="theme" value="${escapeHtml(session?.theme_or_lesson_focus || "")}"></label>
        <label class="form-field full"><span class="form-label">Notes or cancellation reason</span><textarea class="textarea" name="notes">${escapeHtml(session?.notes || session?.cancellation_reason || "")}</textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveSessionButton" class="button button-primary" type="button">${session ? "Save changes" : "Create session"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveSessionButton").addEventListener("click", saveSession);
}

async function saveSession(event) {
  const button = event.currentTarget;
  const form = document.getElementById("sessionForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const id = data.get("id");
    const existingSession = id ? state.sessions.find(item => item.id === id) : null;
    const status = data.get("status");
    const notes = normaliseText(data.get("notes")) || null;
    const row = {
      term_id: data.get("termId") || null,
      session_date: data.get("date"),
      start_time: data.get("startTime") || null,
      end_time: data.get("endTime") || null,
      venue: normaliseText(data.get("venue")) || null,
      instructor_name: normaliseText(data.get("instructor")) || null,
      session_type: data.get("sessionType"),
      status,
      theme_or_lesson_focus: normaliseText(data.get("theme")) || null,
      notes: status === "cancelled" ? null : notes,
      cancellation_reason: status === "cancelled" ? notes : null
    };
    const supabase = getSupabaseClient();
    const result = id ? await supabase.from("training_sessions").update(row).eq("id", id) : await supabase.from("training_sessions").insert(row);
    if (result.error) throw result.error;
    const affectedTermIds = new Set([existingSession?.term_id, row.term_id].filter(Boolean));
    for (const termId of affectedTermIds) await recalculateTermWeeks(termId);
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(id ? "Session updated." : "Session created.");
    dispatchDataChanged({ module: "sessions" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}
