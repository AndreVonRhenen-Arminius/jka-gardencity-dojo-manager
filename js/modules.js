import { renderSettings } from "./settings.js?v=1.0.2";
import { renderFamilies } from "./families.js?v=1.0.2";
import { renderStudents } from "./students.js?v=1.0.2";
import { renderEnquiries } from "./enquiries.js?v=1.0.2";
import { renderTerms } from "./terms.js?v=1.0.2";
import { renderSessions } from "./sessions.js?v=1.0.2";
import { renderAttendance } from "./attendance.js?v=1.0.2";
import { renderGradings } from "./gradings.js?v=1.0.2";
import { renderProgress } from "./progress.js?v=1.0.2";
import { renderFees } from "./fees.js?v=1.0.2";
import { renderPayments } from "./payments.js?v=1.0.2";
import { renderExpenses } from "./expenses.js?v=1.0.2";
import { renderBanking } from "./banking.js?v=1.0.2";
import { renderReports } from "./reports.js?v=1.0.2";
import { renderCommunication } from "./communication.js?v=1.0.2";
import { renderBackup } from "./backup.js?v=1.0.2";
import { renderAudit } from "./audit.js?v=1.0.2";
import { renderError, renderLoading } from "./ui.js?v=1.0.2";

const moduleRenderers = {
  settings: renderSettings,
  families: renderFamilies,
  students: renderStudents,
  enquiries: renderEnquiries,
  terms: renderTerms,
  sessions: renderSessions,
  attendance: renderAttendance,
  gradings: renderGradings,
  progress: renderProgress,
  fees: renderFees,
  payments: renderPayments,
  expenses: renderExpenses,
  banking: renderBanking,
  reports: renderReports,
  communication: renderCommunication,
  backup: renderBackup,
  audit: renderAudit
};

export async function loadModule(page) {
  const container = document.getElementById("moduleContent");
  renderLoading(container, "Loading module…");
  try {
    const renderer = moduleRenderers[page];
    if (!renderer) throw new Error(`The ${page} module is not available.`);
    await renderer(container);
  } catch (error) {
    renderError(container, error);
  }
}
