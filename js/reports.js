import { getSupabaseClient } from "./database.js?v=1.2.1";
import { formatCurrency, formatDate, todayIso } from "./utilities.js?v=1.2.1";
import { emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, setButtonBusy } from "./ui.js?v=1.2.1";

let state = { students: [], families: [], sessions: [], attendance: [], payments: [], expenses: [], charges: [], allocations: [] };

export async function renderReports(container) {
  const year = new Date().getFullYear();
  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "Records", title: "Reports", description: "Create printable summaries and CSV exports from live dojo records." })}
    <section class="section-card"><form id="reportFilterForm" class="form-grid three"><label class="form-field"><span class="form-label">From</span><input class="input" type="date" name="from" value="${year}-01-01"></label><label class="form-field"><span class="form-label">To</span><input class="input" type="date" name="to" value="${todayIso()}"></label><label class="form-field"><span class="form-label">Report</span><select class="select" name="report"><option value="overview">Dojo overview</option><option value="students">Student register</option><option value="attendance">Attendance percentages</option><option value="balances">Family balances</option><option value="finance">Finance summary</option></select></label><div class="module-actions full"><button id="runReportButton" class="button button-primary" type="submit">Run report</button><button id="exportReportButton" class="button button-secondary" type="button" disabled>Export CSV</button><button id="printReportButton" class="button button-secondary" type="button" disabled>Print</button></div></form></section>
    <div id="reportOutput">${emptyState("Choose a report", "Select the date range and report type, then run it.")}</div>
  </div>`;
  container.querySelector("#reportFilterForm").addEventListener("submit", runReport);
  container.querySelector("#exportReportButton").addEventListener("click", exportCurrentReport);
  container.querySelector("#printReportButton").addEventListener("click", printCurrentReport);
}

let currentReport = null;

async function runReport(event) {
  event.preventDefault();
  const button = document.getElementById("runReportButton"); setButtonBusy(button, true, "Running…");
  try {
    const data = new FormData(event.currentTarget), from = data.get("from"), to = data.get("to"), type = data.get("report");
    await loadData(from, to);
    currentReport = await buildReport(type, from, to);
    document.getElementById("reportOutput").innerHTML = currentReport.html;
    document.getElementById("exportReportButton").disabled = !currentReport.rows?.length;
    document.getElementById("printReportButton").disabled = false;
  } catch (error) { notifyError(error); }
  finally { setButtonBusy(button, false); }
}

async function loadData(from, to) {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("students").select("*").is("deleted_at", null).order("last_name"),
    supabase.from("families").select("*").is("deleted_at", null).order("family_name"),
    supabase.from("training_sessions").select("*").is("deleted_at", null).gte("session_date", from).lte("session_date", to).order("session_date"),
    supabase.from("attendance_records").select("*").is("deleted_at", null),
    supabase.from("payments").select("*").is("deleted_at", null).gte("payment_date", from).lte("payment_date", to).neq("payment_status", "reversed"),
    supabase.from("expenses").select("*").is("deleted_at", null).gte("expense_date", from).lte("expense_date", to).neq("payment_status", "cancelled"),
    supabase.from("charges").select("*").is("deleted_at", null).gte("charge_date", from).lte("charge_date", to).not("status", "in", '(cancelled,reversed,draft)'),
    supabase.from("payment_allocations").select("*").is("deleted_at", null).eq("status", "active")
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.students, state.families, state.sessions, state.attendance, state.payments, state.expenses, state.charges, state.allocations] = results.map(result => result.data || []);
}

async function buildReport(type, from, to) {
  if (type === "students") return studentRegister(from, to);
  if (type === "attendance") return attendanceReport(from, to);
  if (type === "balances") return balancesReport(from, to);
  if (type === "finance") return financeReport(from, to);
  return overviewReport(from, to);
}

function heading(title, from, to) {
  return `<div class="report-sheet"><div class="section-card-header"><div><p class="eyebrow">JKA Christchurch – GardenCity</p><h2>${escapeHtml(title)}</h2><p class="muted">${formatDate(from)} to ${formatDate(to)}</p></div></div>`;
}

function overviewReport(from, to) {
  const active = state.students.filter(item => item.status === "active").length;
  const trials = state.students.filter(item => item.status === "trial").length;
  const sessions = state.sessions.filter(item => item.status !== "cancelled").length;
  const present = state.attendance.filter(item => item.attendance_status === "present" && state.sessions.some(session => session.id === item.training_session_id)).length;
  const income = state.payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const charges = state.charges.reduce((sum, item) => sum + Number(item.final_amount), 0);
  const rows = [
    ["Active students", active], ["Trial students", trials], ["Training sessions", sessions], ["Present attendance marks", present],
    ["Payments received", formatCurrency(income)], ["Expenses recorded", formatCurrency(expenses)], ["Charges raised", formatCurrency(charges)], ["Net cash movement", formatCurrency(income - expenses)]
  ];
  return { name: "dojo-overview", rows, headers: ["Measure", "Value"], html: `${heading("Dojo overview", from, to)}<div class="summary-grid">${rows.map(([label,value]) => `<article class="summary-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div></div>` };
}

function studentRegister(from, to) {
  const familyMap = new Map(state.families.map(item => [item.id, item.family_name]));
  const rows = state.students.map(student => [student.student_number, student.preferred_name || student.first_name, student.last_name, familyMap.get(student.family_id) || "", student.status, student.payment_plan || "", student.start_date || ""]);
  const htmlRows = rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
  return { name: "student-register", rows, headers: ["Student number","First/preferred name","Last name","Family","Status","Payment plan","Start date"], html: `${heading("Student register", from, to)}<div class="table-wrap"><table class="data-table"><thead><tr><th>Number</th><th>Name</th><th>Last name</th><th>Family</th><th>Status</th><th>Payment plan</th><th>Start date</th></tr></thead><tbody>${htmlRows}</tbody></table></div></div>` };
}

async function attendanceReport(from, to) {
  const supabase = getSupabaseClient();
  const rows = [];
  for (const student of state.students.filter(item => ["active","trial","paused"].includes(item.status))) {
    const { data, error } = await supabase.rpc("student_attendance_percentage", { p_student_id: student.id, p_start_date: from, p_end_date: to });
    if (error) throw error;
    const records = state.attendance.filter(item => item.student_id === student.id && state.sessions.some(session => session.id === item.training_session_id));
    rows.push([student.student_number, `${student.preferred_name || student.first_name} ${student.last_name}`, Number(data || 0).toFixed(2), records.filter(item => item.attendance_status === "present").length, records.filter(item => item.attendance_status === "absent").length, records.filter(item => item.attendance_status === "late").length]);
  }
  rows.sort((a,b) => Number(b[2]) - Number(a[2]));
  return { name: "attendance-report", rows, headers: ["Student number","Student","Attendance %","Present","Absent","Late"], html: `${heading("Attendance percentages", from, to)}<div class="table-wrap"><table class="data-table"><thead><tr><th>Number</th><th>Student</th><th>Attendance</th><th>Present</th><th>Absent</th><th>Late</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}%</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td></tr>`).join("")}</tbody></table></div></div>` };
}

async function balancesReport(from, to) {
  const supabase = getSupabaseClient();
  const rows = [];
  for (const family of state.families.filter(item => item.is_active)) {
    const [{ data: balance, error: balanceError }, { data: credit, error: creditError }] = await Promise.all([
      supabase.rpc("family_outstanding_balance", { p_family_id: family.id }),
      supabase.rpc("family_unallocated_credit", { p_family_id: family.id })
    ]);
    if (balanceError) throw balanceError; if (creditError) throw creditError;
    rows.push([family.family_name, family.billing_name || "", formatCurrency(balance || 0), formatCurrency(credit || 0), family.payment_reference || ""]);
  }
  return { name: "family-balances", rows, headers: ["Family","Billing name","Outstanding","Unallocated credit","Payment reference"], html: `${heading("Family balances", from, to)}<div class="table-wrap"><table class="data-table"><thead><tr><th>Family</th><th>Billing name</th><th>Outstanding</th><th>Credit</th><th>Reference</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>` };
}

function financeReport(from, to) {
  const income = state.payments.reduce((sum,item) => sum + Number(item.amount), 0);
  const expenses = state.expenses.reduce((sum,item) => sum + Number(item.amount), 0);
  const charges = state.charges.reduce((sum,item) => sum + Number(item.final_amount), 0);
  const allocated = state.allocations.reduce((sum,item) => sum + Number(item.allocation_amount), 0);
  const rows = [["Charges raised", charges],["Payments received", income],["Payment allocations", allocated],["Expenses recorded", expenses],["Cash surplus/(deficit)", income-expenses]];
  return { name: "finance-summary", rows: rows.map(([label,value]) => [label, Number(value).toFixed(2)]), headers: ["Measure","NZD"], html: `${heading("Finance summary", from, to)}<div class="summary-grid">${rows.map(([label,value]) => `<article class="summary-tile"><span>${escapeHtml(label)}</span><strong>${formatCurrency(value)}</strong></article>`).join("")}</div><div class="section-card section-spacer"><p class="muted">This report summarises recorded transactions for the selected period. It is not a tax return or audited financial statement.</p></div></div>` };
}

function exportCurrentReport() {
  if (!currentReport?.rows?.length) return;
  const csv = [currentReport.headers, ...currentReport.rows].map(row => row.map(csvValue).join(",")).join("\r\n");
  downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `${currentReport.name}-${todayIso()}.csv`);
  notifySuccess("CSV report downloaded.");
}
function csvValue(value) { const text = String(value ?? ""); return `"${text.replaceAll('"','""')}"`; }
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function printCurrentReport() {
  if (!currentReport) return;
  const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) { notifyError(new Error("Allow pop-ups to print the report.")); return; }
  popup.document.write(`<!doctype html><html><head><title>JKA Report</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#111}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ccc;text-align:left}.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.summary-tile{border:1px solid #ccc;padding:14px}.muted{color:#555}</style></head><body>${currentReport.html}</body></html>`);
  popup.document.close(); popup.focus(); setTimeout(() => popup.print(), 250);
}
