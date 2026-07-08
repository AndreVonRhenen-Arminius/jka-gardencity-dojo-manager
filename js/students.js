import { getSupabaseClient } from "./database.js?v=0.4.0";
import { calculateAge, dispatchDataChanged, normaliseText, nowIso, todayIso } from "./utilities.js?v=0.4.0";
import { closeDialog, confirmAction, emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge } from "./ui.js?v=0.4.0";

let state = { students: [], families: [], belts: [] };

export async function renderStudents(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [studentsResult, familiesResult, beltsResult] = await Promise.all([
    supabase.from("students").select("*").is("deleted_at", null).order("last_name").order("first_name"),
    supabase.from("families").select("id,family_name").is("deleted_at", null).order("family_name"),
    supabase.from("belt_ranks").select("id,rank_name,belt_colour,rank_order").eq("is_active", true).order("rank_order")
  ]);
  if (studentsResult.error) throw studentsResult.error;
  if (familiesResult.error) throw familiesResult.error;
  if (beltsResult.error) throw beltsResult.error;
  state = { students: studentsResult.data || [], families: familiesResult.data || [], belts: beltsResult.data || [] };
}

function render(container) {
  const familyMap = new Map(state.families.map(item => [item.id, item.family_name]));
  const beltMap = new Map(state.belts.map(item => [item.id, `${item.belt_colour || ""} ${item.rank_name || ""}`.trim()]));
  const rows = state.students.map(student => {
    const displayName = student.preferred_name || student.first_name;
    const age = calculateAge(student.date_of_birth);
    return `
      <tr data-search="${escapeHtml(`${student.student_number} ${student.first_name} ${student.last_name} ${displayName} ${familyMap.get(student.family_id) || ""}`.toLowerCase())}">
        <td><strong>${escapeHtml(displayName)} ${escapeHtml(student.last_name)}</strong><div class="record-meta">${escapeHtml(student.student_number)}</div></td>
        <td>${age ?? "—"}</td>
        <td>${escapeHtml(familyMap.get(student.family_id) || "—")}</td>
        <td>${escapeHtml(beltMap.get(student.current_belt_rank_id) || "Not recorded")}</td>
        <td>${statusBadge(student.status)}</td>
        <td>${escapeHtml(student.payment_plan || "—")}</td>
        <td class="table-actions">
          <button class="button button-secondary button-small" data-action="edit" data-id="${student.id}">Edit</button>
          <button class="button button-danger button-small" data-action="archive" data-id="${student.id}">Archive</button>
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "People", title: "Students", description: "Manage the student register, family links, belt ranks and fee status.", actions: '<button id="addStudentButton" class="button button-primary" type="button">Add student</button>' })}
      <div class="module-toolbar">
        <input id="studentSearch" class="input search-input" type="search" placeholder="Search students, numbers or families">
        <div class="record-meta">${state.students.length} student records</div>
      </div>
      ${state.students.length ? `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Student</th><th>Age</th><th>Family</th><th>Current belt</th><th>Status</th><th>Payment plan</th><th>Actions</th></tr></thead>
          <tbody id="studentRows">${rows}</tbody>
        </table></div>` : emptyState("No students yet", "Add fictional test students first, then verify the workflow before entering real student information.")}
    </div>`;

  container.querySelector("#addStudentButton").addEventListener("click", () => openStudentDialog());
  container.querySelector("#studentSearch")?.addEventListener("input", filterRows);
  container.querySelector("#studentRows")?.addEventListener("click", handleAction);
}

function filterRows(event) {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#studentRows tr").forEach(row => { row.hidden = query && !row.dataset.search.includes(query); });
}

function handleAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const student = state.students.find(item => item.id === button.dataset.id);
  if (!student) return;
  if (button.dataset.action === "edit") openStudentDialog(student);
  if (button.dataset.action === "archive") archiveStudent(student);
}

function openStudentDialog(student = null) {
  const familyOptions = ['<option value="">No family selected</option>', ...state.families.map(item => `<option value="${item.id}" ${student?.family_id === item.id ? "selected" : ""}>${escapeHtml(item.family_name)}</option>`)].join("");
  const beltOptions = ['<option value="">Not recorded</option>', ...state.belts.map(item => `<option value="${item.id}" ${student?.current_belt_rank_id === item.id ? "selected" : ""}>${escapeHtml(`${item.belt_colour || ""} ${item.rank_name || ""}`.trim())}</option>`)].join("");

  openDialog({
    title: student ? "Edit student" : "Add student",
    eyebrow: "People",
    body: `
      <form id="studentForm" class="form-grid">
        <input type="hidden" name="id" value="${student?.id || ""}">
        <label class="form-field"><span class="form-label">First name</span><input class="input" name="firstName" required value="${escapeHtml(student?.first_name || "")}"></label>
        <label class="form-field"><span class="form-label">Last name</span><input class="input" name="lastName" required value="${escapeHtml(student?.last_name || "")}"></label>
        <label class="form-field"><span class="form-label">Preferred name</span><input class="input" name="preferredName" value="${escapeHtml(student?.preferred_name || "")}"></label>
        <label class="form-field"><span class="form-label">Date of birth</span><input class="input" type="date" name="dateOfBirth" value="${student?.date_of_birth || ""}"></label>
        <label class="form-field"><span class="form-label">Start date</span><input class="input" type="date" name="startDate" required value="${student?.start_date || todayIso()}"></label>
        <label class="form-field"><span class="form-label">Status</span><select class="select" name="status">
          ${["active","trial","waiting","paused","inactive","left"].map(value => `<option value="${value}" ${student?.status === value || (!student && value === "active") ? "selected" : ""}>${value.replaceAll("_"," ")}</option>`).join("")}
        </select></label>
        <label class="form-field"><span class="form-label">Family</span><select class="select" name="familyId">${familyOptions}</select></label>
        <label class="form-field"><span class="form-label">Current belt</span><select class="select" name="beltId">${beltOptions}</select></label>
        <label class="form-field"><span class="form-label">Payment plan</span><select class="select" name="paymentPlan">
          <option value="">Not set</option>
          <option value="weekly" ${student?.payment_plan === "weekly" ? "selected" : ""}>Weekly</option>
          <option value="term" ${student?.payment_plan === "term" ? "selected" : ""}>Term</option>
          <option value="payment_plan" ${student?.payment_plan === "payment_plan" ? "selected" : ""}>Payment plan</option>
          <option value="exempt" ${student?.payment_plan === "exempt" ? "selected" : ""}>Exempt</option>
        </select></label>
        <label class="form-field"><span class="form-label">School</span><input class="input" name="school" value="${escapeHtml(student?.school || "")}"></label>
        <label class="checkbox-row"><input type="checkbox" name="consentForms" ${student?.consent_forms_received ? "checked" : ""}><span>Consent forms received</span></label>
        <label class="checkbox-row"><input type="checkbox" name="termsAccepted" ${student?.terms_accepted ? "checked" : ""}><span>Terms accepted</span></label>
        <label class="checkbox-row"><input type="checkbox" name="photoConsent" ${student?.photography_consent ? "checked" : ""}><span>Photography consent</span></label>
        <label class="checkbox-row"><input type="checkbox" name="feeExempt" ${student?.is_exempt_from_fees ? "checked" : ""}><span>Exempt from fees</span></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(student?.notes || "")}</textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveStudentButton" class="button button-primary" type="button">${student ? "Save changes" : "Create student"}</button>`
  });

  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveStudentButton").addEventListener("click", saveStudent);
}

async function saveStudent(event) {
  const button = event.currentTarget;
  const form = document.getElementById("studentForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const id = data.get("id");
    const row = {
      family_id: data.get("familyId") || null,
      first_name: normaliseText(data.get("firstName")),
      last_name: normaliseText(data.get("lastName")),
      preferred_name: normaliseText(data.get("preferredName")) || null,
      date_of_birth: data.get("dateOfBirth") || null,
      start_date: data.get("startDate"),
      status: data.get("status"),
      current_belt_rank_id: data.get("beltId") || null,
      payment_plan: data.get("paymentPlan") || null,
      school: normaliseText(data.get("school")) || null,
      consent_forms_received: data.get("consentForms") === "on",
      consent_forms_received_date: data.get("consentForms") === "on" ? todayIso() : null,
      terms_accepted: data.get("termsAccepted") === "on",
      terms_accepted_date: data.get("termsAccepted") === "on" ? todayIso() : null,
      photography_consent: data.get("photoConsent") === "on",
      photography_consent_date: data.get("photoConsent") === "on" ? todayIso() : null,
      is_exempt_from_fees: data.get("feeExempt") === "on",
      notes: normaliseText(data.get("notes")) || null
    };

    const supabase = getSupabaseClient();
    let result;
    if (id) {
      result = await supabase.from("students").update(row).eq("id", id);
    } else {
      const { data: studentNumber, error: numberError } = await supabase.rpc("next_student_number");
      if (numberError) throw numberError;
      result = await supabase.from("students").insert({ ...row, student_number: studentNumber });
    }
    if (result.error) throw result.error;

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(id ? "Student updated." : "Student created.");
    dispatchDataChanged({ module: "students" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function archiveStudent(student) {
  if (!await confirmAction(`Archive ${student.preferred_name || student.first_name} ${student.last_name}?`)) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("students").update({ deleted_at: nowIso(), status: "inactive" }).eq("id", student.id);
    if (error) throw error;
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Student archived.");
    dispatchDataChanged({ module: "students" });
  } catch (error) {
    notifyError(error);
  }
}
