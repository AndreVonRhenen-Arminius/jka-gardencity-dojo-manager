import { getSupabaseClient } from "./database.js?v=1.3.0";

const SYNC_CANCELLATION_PREFIX = "Term calendar sync:";

export async function syncTermSessions(term) {
  if (!term?.id || !term.start_date || !term.end_date) {
    throw new Error("The term must have a start date and end date before sessions can be synced.");
  }

  const supabase = getSupabaseClient();
  const [settingsResult, exceptionsResult, sessionsResult] = await Promise.all([
    supabase
      .from("app_settings")
      .select("setting_key,setting_value")
      .in("setting_key", ["dojo.profile", "training.defaults", "training.default_days"])
      .is("deleted_at", null),
    supabase
      .from("term_calendar_exceptions")
      .select("*")
      .eq("term_id", term.id)
      .is("deleted_at", null),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("term_id", term.id)
      .eq("session_type", "normal_class")
      .is("deleted_at", null)
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const settings = Object.fromEntries(
    (settingsResult.data || []).map(row => [row.setting_key, row.setting_value])
  );
  const training = settings["training.defaults"] || {};
  const dojo = settings["dojo.profile"] || {};
  const days = settings["training.default_days"] || ["Tuesday", "Thursday"];
  const exceptions = exceptionsResult.data || [];
  const existingSessions = sessionsResult.data || [];
  const desiredSessions = buildDesiredSessions(term, days, exceptions, training, dojo);
  const desiredByDate = new Map(desiredSessions.map(row => [row.session_date, row]));
  const existingByDate = new Map();

  for (const session of existingSessions) {
    const current = existingByDate.get(session.session_date);
    if (!current || (current.status === "cancelled" && session.status !== "cancelled")) {
      existingByDate.set(session.session_date, session);
    }
  }

  const attendanceCounts = await loadAttendanceCounts(
    supabase,
    existingSessions.map(session => session.id)
  );

  const toInsert = [];
  const toRestore = [];
  const toUpdate = [];
  const toCancel = [];
  let preservedWithAttendance = 0;

  for (const desired of desiredSessions) {
    const existing = existingByDate.get(desired.session_date);
    if (!existing) {
      toInsert.push(desired);
      continue;
    }

    if (
      existing.status === "cancelled" &&
      String(existing.cancellation_reason || "").startsWith(SYNC_CANCELLATION_PREFIX)
    ) {
      toRestore.push({
        id: existing.id,
        start_time: desired.start_time,
        end_time: desired.end_time,
        venue: desired.venue,
        instructor_name: desired.instructor_name,
        status: "scheduled",
        cancellation_reason: null
      });
    } else if (
      existing.status === "scheduled" &&
      Number(attendanceCounts.get(existing.id) || 0) === 0
    ) {
      toUpdate.push({
        id: existing.id,
        start_time: desired.start_time,
        end_time: desired.end_time,
        venue: desired.venue,
        instructor_name: desired.instructor_name
      });
    }
  }

  for (const session of existingSessions) {
    const desired = desiredByDate.has(session.session_date);
    const primaryForDate = existingByDate.get(session.session_date);
    const duplicate = desired && primaryForDate?.id !== session.id;
    if (desired && !duplicate) continue;
    if (session.status !== "scheduled") continue;

    if (Number(attendanceCounts.get(session.id) || 0) > 0) {
      preservedWithAttendance += 1;
      continue;
    }

    toCancel.push(session.id);
  }

  if (toInsert.length) {
    const { error } = await supabase.from("training_sessions").insert(toInsert);
    if (error) throw error;
  }

  for (const session of toRestore) {
    const { error } = await supabase
      .from("training_sessions")
      .update({
        start_time: session.start_time,
        end_time: session.end_time,
        venue: session.venue,
        instructor_name: session.instructor_name,
        status: session.status,
        cancellation_reason: session.cancellation_reason
      })
      .eq("id", session.id);
    if (error) throw error;
  }

  for (const session of toUpdate) {
    const { error } = await supabase
      .from("training_sessions")
      .update({
        start_time: session.start_time,
        end_time: session.end_time,
        venue: session.venue,
        instructor_name: session.instructor_name
      })
      .eq("id", session.id);
    if (error) throw error;
  }

  if (toCancel.length) {
    const { error } = await supabase
      .from("training_sessions")
      .update({
        status: "cancelled",
        cancellation_reason: `${SYNC_CANCELLATION_PREFIX} outside the current term dates or marked as a closure.`
      })
      .in("id", toCancel);
    if (error) throw error;
  }

  const weeks = await recalculateTermWeeks(term.id);

  return {
    inserted: toInsert.length,
    restored: toRestore.length,
    updated: toUpdate.length,
    cancelled: toCancel.length,
    preservedWithAttendance,
    weeks,
    desiredSessions: desiredSessions.length
  };
}

export async function recalculateTermWeeks(termId) {
  if (!termId) return 0;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select("session_date,status")
    .eq("term_id", termId)
    .eq("session_type", "normal_class")
    .is("deleted_at", null)
    .in("status", ["scheduled", "completed"]);

  if (error) throw error;

  const weeks = new Set((data || []).map(row => weekKey(row.session_date))).size;
  const { error: updateError } = await supabase
    .from("terms")
    .update({ number_of_training_weeks: weeks })
    .eq("id", termId);

  if (updateError) throw updateError;
  return weeks;
}

export function calculateCalendarWeeks(startDate, endDate, dayNames = ["Tuesday", "Thursday"]) {
  if (!startDate || !endDate) return 0;
  const desired = buildDesiredSessions(
    { id: "preview", start_date: startDate, end_date: endDate },
    dayNames,
    [],
    {},
    {}
  );
  return new Set(desired.map(row => weekKey(row.session_date))).size;
}

function buildDesiredSessions(term, dayNames, exceptions, training, dojo) {
  const dayNumberMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  };
  const dayNumbers = new Set(
    (dayNames || [])
      .map(day => dayNumberMap[day])
      .filter(value => Number.isInteger(value))
  );
  const closures = new Set(
    exceptions
      .filter(item => item.exception_type === "closure")
      .map(item => item.exception_date)
  );
  const changesByDate = new Map(
    exceptions
      .filter(item => ["venue_change", "time_change"].includes(item.exception_type))
      .map(item => [item.exception_date, item])
  );

  const rows = [];
  const cursor = new Date(`${term.start_date}T12:00:00Z`);
  const end = new Date(`${term.end_date}T12:00:00Z`);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dayNumbers.has(cursor.getUTCDay()) && !closures.has(iso)) {
      const change = changesByDate.get(iso) || {};
      rows.push({
        term_id: term.id,
        session_date: iso,
        start_time: change.start_time || training.start_time || "18:00",
        end_time: change.end_time || training.end_time || "19:30",
        venue: change.venue || training.venue || dojo.venue_name || "Opawa School Hall",
        instructor_name: dojo.instructor_name || "André Von Rhenen",
        session_type: "normal_class",
        status: "scheduled"
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rows;
}

async function loadAttendanceCounts(supabase, sessionIds) {
  const result = new Map();
  if (!sessionIds.length) return result;

  const { data, error } = await supabase
    .from("attendance_records")
    .select("training_session_id")
    .in("training_session_id", sessionIds)
    .is("deleted_at", null);
  if (error) throw error;

  for (const row of data || []) {
    result.set(
      row.training_session_id,
      Number(result.get(row.training_session_id) || 0) + 1
    );
  }
  return result;
}

function weekKey(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}
