export const pageInformation = {
  students: ["People", "Student Hub", "Main source of truth for student, family and primary guardian information."],
  families: ["People", "Families & Guardians", "Link siblings, guardians, contacts and family billing records."],
  enquiries: ["People", "Enquiries & Trials", "Track enquiries, trial bookings, follow-ups and conversions."],
  attendance: ["Training", "Attendance", "Fast mobile attendance entry for Tuesday and Thursday classes."],
  sessions: ["Training", "Sessions", "Create classes, special events, cancellations and lesson themes."],
  terms: ["Training", "Terms", "Configure dojo terms, closure dates, enrolments and training sessions."],
  gradings: ["Development", "Gradings", "Maintain grading events, results, fees and rank history."],
  progress: ["Development", "Progress & Goals", "Record professional progress notes, goals and review dates."],
  fees: ["Finance", "Fees & Ledgers", "Configure versioned fees, create charges and review balances."],
  payments: ["Finance", "Payments & Invoices", "Record payments, split family allocations and issue invoices."],
  expenses: ["Finance", "Expenses", "Manage dojo expenses and recurring expense proposals."],
  banking: ["Finance", "Banking", "Import and reconcile reviewed Kiwibank CSV transactions."],
  reports: ["Records", "Reports", "Create filtered, printable and CSV-exportable dojo reports."],
  communication: ["Records", "Communication", "Record contact history and follow-up tasks without automatic sending."],
  backup: ["System", "Backup & Sync", "Review cloud status, recovery snapshots and encrypted manual backups."],
  audit: ["System", "Audit History", "Review important changes, reversals, imports and access events."],
  settings: ["System", "Settings", "Configure dojo information, training defaults and invoice preferences."]
};

export function initialiseNavigation(onPageChanged) {
  const nav = document.getElementById("mainNavigation");
  const sidebar = document.getElementById("sidebar");
  const menuButton = document.getElementById("menuButton");

  nav.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    activateNavigation(button.dataset.page);
    sidebar.classList.remove("open");
    onPageChanged?.(button.dataset.page);
  });

  menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") sidebar.classList.remove("open");
  });
}

export function activateNavigation(page) {
  const nav = document.getElementById("mainNavigation");
  nav.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === page);
  });

  document.getElementById("dashboardPage").classList.toggle("active", page === "dashboard");
  document.getElementById("modulePage").classList.toggle("active", page !== "dashboard");
  document.getElementById("pageTitle").textContent =
    page === "dashboard" ? "Dashboard" : (pageInformation[page]?.[1] || "Module");
  document.getElementById("mainContent").focus();
}
