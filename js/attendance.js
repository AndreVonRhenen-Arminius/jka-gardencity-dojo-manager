import { getSupabaseClient } from "./database.js?v=1.3.0";
import { dispatchDataChanged, formatDate, todayIso } from "./utilities.js?v=1.3.0";
import { emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, setButtonBusy, statusBadge } from "./ui.js?v=1.3.0";

let state = { sessions: [], students: [], records: [], alerts: [], selectedSessionId: "" };

export async function renderAttendance(container) { await loadBase(); render(container); }

async function loadBase() {
  const supabase = getSupabaseClient();
  const [sessionsResult, studentsResult] = await Promise.all([
    supabase.from("training_sessions").select("*").is("deleted_at", null).neq("status", "cancelled").order("session_date", { ascending: false }).limit(80),
    supabase.from("students").select("id,student_number,first_name,last_name,preferred_name,status,current_belt_rank_id,start_date,date_left").is("deleted_at", null).in("status", ["active","trial"]).order("last_name").order("first_name")
  ]);
  if (sessionsResult.error) throw sessionsResult.error;
  if (studentsResult.error) throw studentsResult.error;
  state.sessions = sessionsResult.data || [];
  state.students = studentsResult.data || [];
  if (!state.selectedSessionId && state.sessions.length) {
    const today = todayIso();
    const upcoming = [...state.sessions]
      .filter(session => session.session_date >= today)
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
    state.selectedSessionId = (upcoming[0] || state.sessions[0]).id;
  }
  await loadRecords();
}

async function loadRecords() {
  if (!state.selectedSessionId) { state.records = []; state.alerts = []; return; }
  const session = state.sessions.find(item => item.id === state.selectedSessionId);
  const supabase = getSupabaseClient();
  const [recordsResult, alertsResult] = await Promise.all([
    supabase.from("attendance_records").select("*").eq("training_session_id", state.selectedSessionId).is("deleted_at", null),
    supabase.from("student_safety_alerts").select("*").eq("is_active", true).eq("show_on_attendance", true).is("deleted_at", null).lte("active_from", session?.session_date || new Date().toISOString().slice(0,10)).or(`active_until.is.null,active_until.gte.${session?.session_date || new Date().toISOString().slice(0,10)}`)
  ]);
  if (recordsResult.error) throw recordsResult.error;
  if (alertsResult.error) throw alertsResult.error;
  state.records = recordsResult.data || [];
  state.alerts = alertsResult.data || [];
}

function render(container) {
  const options = state.sessions.map(session => `<option value="${session.id}" ${session.id === state.selectedSessionId ? "selected" : ""}>${escapeHtml(`${formatDate(session.session_date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} · ${(session.start_time || "").slice(0,5)} · ${session.venue || ""}`)}</option>`).join("");
  const recordMap = new Map(state.records.map(record => [record.student_id, record]));
  const alertMap = new Map();
  state.alerts.forEach(alert => { const list = alertMap.get(alert.student_id) || []; list.push(alert); alertMap.set(alert.student_id, list); });
  const selectedSession = state.sessions.find(item => item.id === state.selectedSessionId);
  const sessionDate = selectedSession?.session_date || todayIso();
  const visibleStudents = state.students.filter(student =>
    (!student.start_date || student.start_date <= sessionDate) &&
    (!student.date_left || student.date_left >= sessionDate)
  );
  const rows = visibleStudents.map(student => {
    const record = recordMap.get(student.id), status = record?.attendance_status || "present", alerts = alertMap.get(student.id) || [];
    const warning = alerts.length ? `<div class="attendance-alerts">${alerts.map(alert => `<div class="attendance-alert ${alert.severity}">${statusBadge(alert.severity)} <strong>${escapeHtml(alert.short_warning)}</strong>${alert.safety_instruction ? `<span>${escapeHtml(alert.safety_instruction)}</span>` : ""}</div>`).join("")}</div>` : "";
    return `<div class="attendance-row ${alerts.some(alert => alert.severity === "urgent") ? "has-urgent-alert" : alerts.length ? "has-alert" : ""}" data-student-id="${student.id}"><div><div class="attendance-name">${escapeHtml(student.preferred_name || student.first_name)} ${escapeHtml(student.last_name)}</div><div class="attendance-sub">${escapeHtml(student.student_number)} · ${escapeHtml(student.status)}</div>${warning}</div><select class="select attendance-status">${["present","absent","excused","late","trial"].map(value => `<option value="${value}" ${status === value ? "selected" : ""}>${value}</option>`).join("")}</select><input class="input attendance-note" placeholder="Optional note" value="${escapeHtml(record?.attendance_notes || "")}"></div>`;
  }).join("");

  container.innerHTML = `<div class="module-shell">${moduleHeader({ eyebrow: "Training", title: "Attendance", description: "Sessions are synced from the term calendar. Select a class, mark everyone present, then change only the exceptions. Active safety alerts are shown without exposing full medical records.", actions: '<button id="markAllPresentButton" class="button button-secondary" type="button">Mark all present</button><button id="saveAttendanceButton" class="button button-primary" type="button">Save attendance</button>' })}${state.sessions.length ? `<div class="section-card"><label class="form-field"><span class="form-label">Training session</span><select id="attendanceSessionSelect" class="select">${options}</select></label></div><div class="attendance-list" id="attendanceList">${rows}</div>` : emptyState("No sessions available", "Create or generate a training session before recording attendance.")}</div>`;
  container.querySelector("#attendanceSessionSelect")?.addEventListener("change", changeSession);
  container.querySelector("#markAllPresentButton")?.addEventListener("click", markAllPresent);
  container.querySelector("#saveAttendanceButton")?.addEventListener("click", saveAttendance);
}

async function changeSession(event) { state.selectedSessionId = event.target.value; try { await loadRecords(); render(document.getElementById("moduleContent")); } catch (error) { notifyError(error); } }
function markAllPresent() { document.querySelectorAll(".attendance-status").forEach(select => { select.value = "present"; }); }
async function saveAttendance(event) {
  if (!state.selectedSessionId) return; const button = event.currentTarget; setButtonBusy(button, true);
  try {
    const rows = [...document.querySelectorAll(".attendance-row")].map(row => ({ training_session_id: state.selectedSessionId, student_id: row.dataset.studentId, attendance_status: row.querySelector(".attendance-status").value, attendance_notes: row.querySelector(".attendance-note").value.trim() || null }));
    const supabase = getSupabaseClient(); const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "training_session_id,student_id" }); if (error) throw error;
    await loadRecords(); notifySuccess(`Attendance saved for ${rows.length} students. The class list is linked to Student Hub and this session date.`); dispatchDataChanged({ module: "attendance" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}
