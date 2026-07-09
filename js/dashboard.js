import { getSupabaseClient } from "./database.js?v=1.2.1";
import { formatDate, setText, todayIso, readableError } from "./utilities.js?v=1.2.1";

async function countRows(table, configure) {
  const supabase = getSupabaseClient();
  let query = supabase.from(table).select("id", { count: "exact", head: true }).is("deleted_at", null);
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
    loadNextSession(today),
    countRows("terms"),
    countRows("fee_schedules", query => query.eq("status", "active")),
    loadInactivityTimeout()
  ]);

  ["activeStudentsMetric","trialStudentsMetric","newEnquiriesMetric","outstandingChargesMetric","followUpsMetric"]
    .forEach((id, index) => setText(id, results[index].status === "fulfilled" ? results[index].value : "!"));

  updateChecklist("termChecklistIcon", results[6]);
  updateChecklist("feeChecklistIcon", results[7]);
  updateChecklist("studentChecklistIcon", results[0], results[1]);
  if (results[8]?.status === "fulfilled") setText("dashboardInactivity", `${results[8].value} minutes`);

  const sessionResult = results[5];
  if (sessionResult.status === "fulfilled" && sessionResult.value) {
    const session = sessionResult.value;
    setText("nextSessionMetric", formatDate(session.session_date, { weekday: "short", day: "2-digit", month: "short" }));
    setText("nextSessionNote", [
      session.start_time ? session.start_time.slice(0, 5) : null,
      session.venue || null,
      session.session_type?.replaceAll("_", " ")
    ].filter(Boolean).join(" · ") || "Scheduled session");
  } else {
    setText("nextSessionMetric", "Not scheduled");
    setText("nextSessionNote", sessionResult.status === "rejected" ? readableError(sessionResult.reason) : "Create a session to begin");
  }
}

function updateChecklist(id, ...results) {
  const element = document.getElementById(id);
  if (!element) return;
  const complete = results.some(result => result?.status === "fulfilled" && Number(result.value) > 0);
  element.classList.toggle("complete", complete);
  element.textContent = complete ? "✓" : (element.dataset.step || element.textContent);
}

async function loadInactivityTimeout() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "security.inactivity_timeout_minutes")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.setting_value || 30);
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
