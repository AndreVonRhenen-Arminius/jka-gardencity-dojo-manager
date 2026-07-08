import { getSupabaseClient } from "./database.js?v=0.4.0";
import { dispatchDataChanged, formatDate } from "./utilities.js?v=0.4.0";
import { emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, setButtonBusy } from "./ui.js?v=0.4.0";

let state = { sessions: [], students: [], records: [], selectedSessionId: "" };

export async function renderAttendance(container) {
  await loadBase();
  render(container);
}

async function loadBase() {
  const supabase = getSupabaseClient();
  const [sessionsResult, studentsResult] = await Promise.all([
    supabase.from("training_sessions").select("*").is("deleted_at", null).neq("status", "cancelled").order("session_date", { ascending: false }).limit(60),
    supabase.from("students").select("id,student_number,first_name,last_name,preferred_name,status,current_belt_rank_id").is("deleted_at", null).in("status", ["active","trial"]).order("last_name").order("first_name")
  ]);
  if (sessionsResult.error) throw sessionsResult.error;
  if (studentsResult.error) throw studentsResult.error;
  state.sessions = sessionsResult.data || [];
  state.students = studentsResult.data || [];
  if (!state.selectedSessionId && state.sessions.length) state.selectedSessionId = state.sessions[0].id;
  await loadRecords();
}

async function loadRecords() {
  if (!state.selectedSessionId) {
    state.records = [];
    return;
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("attendance_records").select("*").eq("training_session_id", state.selectedSessionId).is("deleted_at", null);
  if (error) throw error;
  state.records = data || [];
}

function render(container) {
  const options = state.sessions.map(session => `
    <option value="${session.id}" ${session.id === state.selectedSessionId ? "selected" : ""}>
      ${escapeHtml(`${formatDate(session.session_date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} · ${(session.start_time || "").slice(0,5)} · ${session.venue || ""}`)}
    </option>`).join("");

  const recordMap = new Map(state.records.map(record => [record.student_id, record]));
  const rows = state.students.map(student => {
    const record = recordMap.get(student.id);
    const status = record?.attendance_status || "present";
    return `
      <div class="attendance-row" data-student-id="${student.id}">
        <div><div class="attendance-name">${escapeHtml(student.preferred_name || student.first_name)} ${escapeHtml(student.last_name)}</div><div class="attendance-sub">${escapeHtml(student.student_number)} · ${escapeHtml(student.status)}</div></div>
        <select class="select attendance-status">
          ${["present","absent","excused","late","trial"].map(value => `<option value="${value}" ${status === value ? "selected" : ""}>${value}</option>`).join("")}
        </select>
        <input class="input attendance-note" placeholder="Optional note" value="${escapeHtml(record?.attendance_notes || "")}">
      </div>`;
  }).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "Training", title: "Attendance", description: "Select a session, mark everyone present, then change only the exceptions.", actions: `
        <button id="markAllPresentButton" class="button button-secondary" type="button">Mark all present</button>
        <button id="saveAttendanceButton" class="button button-primary" type="button">Save attendance</button>` })}
      ${state.sessions.length ? `
        <div class="section-card"><label class="form-field"><span class="form-label">Training session</span><select id="attendanceSessionSelect" class="select">${options}</select></label></div>
        <div class="attendance-list" id="attendanceList">${rows}</div>` : emptyState("No sessions available", "Create or generate a training session before recording attendance.")}
    </div>`;

  container.querySelector("#attendanceSessionSelect")?.addEventListener("change", changeSession);
  container.querySelector("#markAllPresentButton")?.addEventListener("click", markAllPresent);
  container.querySelector("#saveAttendanceButton")?.addEventListener("click", saveAttendance);
}

async function changeSession(event) {
  state.selectedSessionId = event.target.value;
  try {
    await loadRecords();
    render(document.getElementById("moduleContent"));
  } catch (error) {
    notifyError(error);
  }
}

function markAllPresent() {
  document.querySelectorAll(".attendance-status").forEach(select => { select.value = "present"; });
}

async function saveAttendance(event) {
  if (!state.selectedSessionId) return;
  const button = event.currentTarget;
  setButtonBusy(button, true);
  try {
    const rows = [...document.querySelectorAll(".attendance-row")].map(row => ({
      training_session_id: state.selectedSessionId,
      student_id: row.dataset.studentId,
      attendance_status: row.querySelector(".attendance-status").value,
      attendance_notes: row.querySelector(".attendance-note").value.trim() || null
    }));
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "training_session_id,student_id" });
    if (error) throw error;
    await loadRecords();
    notifySuccess(`Attendance saved for ${rows.length} students.`);
    dispatchDataChanged({ module: "attendance" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}
