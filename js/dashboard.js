import { getSupabaseClient } from "./database.js";
import { formatDate, setText, todayIso, readableError } from "./utilities.js";

async function countRows(table, configure) {
  const supabase = getSupabaseClient();
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  query = query.is("deleted_at", null);
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function loadDashboard() {
  const today = todayIso();
  setText("dashboardDate", new Intl.DateTimeFormat("en-NZ", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Pacific/Auckland"
  }).format(new Date()));

  const results = await Promise.allSettled([
    countRows("students", query => query.eq("status", "active")),
    countRows("students", query => query.eq("status", "trial")),
    countRows("enquiries", query => query.eq("status", "new_enquiry")),
    countRows("charges", query => query.in("status", ["unpaid", "partially_paid", "overdue"])),
    countRows("follow_up_tasks", query => query.in("status", ["open", "in_progress"]).lte("due_date", today)),
    loadNextSession(today)
  ]);

  const ids = [
    "activeStudentsMetric",
    "trialStudentsMetric",
    "newEnquiriesMetric",
    "outstandingChargesMetric",
    "followUpsMetric"
  ];

  ids.forEach((id, index) => {
    const result = results[index];
    setText(id, result.status === "fulfilled" ? result.value : "!");
  });

  const sessionResult = results[5];
  if (sessionResult.status === "fulfilled" && sessionResult.value) {
    const session = sessionResult.value;
    setText("nextSessionMetric", formatDate(session.session_date, {
      weekday: "short", day: "2-digit", month: "short"
    }));
    const details = [
      session.start_time ? session.start_time.slice(0, 5) : null,
      session.venue || null,
      session.session_type?.replaceAll("_", " ")
    ].filter(Boolean).join(" · ");
    setText("nextSessionNote", details || "Scheduled session");
  } else {
    setText("nextSessionMetric", "Not scheduled");
    setText("nextSessionNote", sessionResult.status === "rejected"
      ? readableError(sessionResult.reason)
      : "Create a session to begin");
  }
}

async function loadNextSession(today) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select("session_date,start_time,venue,session_type")
    .is("deleted_at", null)
    .eq("status", "scheduled")
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
