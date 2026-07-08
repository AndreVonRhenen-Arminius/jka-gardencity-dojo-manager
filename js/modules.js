import { renderSettings } from "./settings.js?v=0.4.0";
import { renderFamilies } from "./families.js?v=0.4.0";
import { renderStudents } from "./students.js?v=0.4.0";
import { renderTerms } from "./terms.js?v=0.4.0";
import { renderSessions } from "./sessions.js?v=0.4.0";
import { renderAttendance } from "./attendance.js?v=0.4.0";
import { renderFees } from "./fees.js?v=0.4.0";
import { renderPayments } from "./payments.js?v=0.4.0";
import { moduleHeader, emptyState, renderError, renderLoading } from "./ui.js?v=0.4.0";
import { pageInformation } from "./navigation.js?v=0.4.0";

const moduleRenderers = {
  settings: renderSettings,
  families: renderFamilies,
  students: renderStudents,
  terms: renderTerms,
  sessions: renderSessions,
  attendance: renderAttendance,
  fees: renderFees,
  payments: renderPayments
};

export async function loadModule(page) {
  const container = document.getElementById("moduleContent");
  renderLoading(container, "Loading module…");
  try {
    if (moduleRenderers[page]) {
      await moduleRenderers[page](container);
      return;
    }
    const [eyebrow, title, description] = pageInformation[page] ?? ["Module", "Module", ""];
    container.innerHTML = `
      <div class="module-shell">
        ${moduleHeader({ eyebrow, title, description })}
        ${emptyState(`${title} is planned for the next release`, "The database and permissions are ready, but this module is not active in version 0.4.0.")}
      </div>`;
  } catch (error) {
    renderError(container, error);
  }
}
