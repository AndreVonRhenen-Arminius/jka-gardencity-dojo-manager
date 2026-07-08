const pageInformation = {
  students: ["People", "Students", "Manage student records, belts, status and enrolment information."],
  families: ["People", "Families & Guardians", "Link siblings, guardians, contacts and family billing records."],
  enquiries: ["People", "Enquiries & Trials", "Track enquiries, trial bookings, follow-ups and conversions."],
  attendance: ["Training", "Attendance", "Fast mobile attendance entry for Tuesday and Thursday classes."],
  sessions: ["Training", "Sessions", "Create classes, special events, cancellations and lesson themes."],
  terms: ["Training", "Terms", "Configure dojo terms, closure dates, enrolments and proposed charges."],
  gradings: ["Development", "Gradings", "Maintain grading events, results, fees and rank history."],
  progress: ["Development", "Progress & Goals", "Record professional progress notes, goals and review dates."],
  fees: ["Finance", "Fees & Ledgers", "Review charges, balances, discounts, credits and student ledgers."],
  payments: ["Finance", "Payments & Invoices", "Record payments, split family allocations and issue invoices or receipts."],
  expenses: ["Finance", "Expenses", "Manage dojo expenses and recurring expense proposals."],
  banking: ["Finance", "Banking", "Import and reconcile reviewed Kiwibank CSV transactions."],
  reports: ["Records", "Reports", "Create filtered, printable and CSV-exportable dojo reports."],
  communication: ["Records", "Communication", "Record contact history and follow-up tasks without automatic sending."],
  backup: ["System", "Backup & Sync", "Review cloud status, recovery snapshots and encrypted manual backups."],
  audit: ["System", "Audit History", "Review important changes, reversals, imports and access events."],
  settings: ["System", "Settings", "Configure dojo information, fees, invoice numbering and authorised users."]
};

export function initialiseNavigation(onPageChanged) {
  const nav = document.getElementById("mainNavigation");
  const sidebar = document.getElementById("sidebar");
  const menuButton = document.getElementById("menuButton");

  nav.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;

    nav.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    const page = button.dataset.page;
    showPage(page);
    sidebar.classList.remove("open");
    onPageChanged?.(page);
  });

  menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") sidebar.classList.remove("open");
  });
}

function showPage(page) {
  const dashboard = document.getElementById("dashboardPage");
  const placeholder = document.getElementById("placeholderPage");
  const pageTitle = document.getElementById("pageTitle");

  if (page === "dashboard") {
    dashboard.classList.add("active");
    placeholder.classList.remove("active");
    pageTitle.textContent = "Dashboard";
    dashboard.focus?.();
    return;
  }

  dashboard.classList.remove("active");
  placeholder.classList.add("active");

  const [eyebrow, title, description] = pageInformation[page] ?? ["Module", "Module", ""];
  document.getElementById("placeholderEyebrow").textContent = eyebrow;
  document.getElementById("placeholderTitle").textContent = title;
  document.getElementById("placeholderHeading").textContent = `${title} module shell ready`;
  document.getElementById("placeholderDescription").textContent = description;
  document.getElementById("placeholderBody").textContent =
    "The secured navigation and database permissions are ready. The full module will be added in the next controlled development stage.";
  pageTitle.textContent = title;
  document.getElementById("mainContent").focus();
}
