import { getSupabaseClient } from "./database.js?v=1.1.0";
import { dispatchDataChanged, formatDate, normaliseText, nowIso, todayIso } from "./utilities.js?v=1.1.0";
import {
  closeDialog, confirmAction, emptyState, escapeHtml, moduleHeader,
  notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge
} from "./ui.js?v=1.1.0";

let state = { enquiries: [], tasks: [] };

export async function renderEnquiries(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [enquiriesResult, tasksResult] = await Promise.all([
    supabase.from("enquiries").select("*").is("deleted_at", null).order("enquiry_date", { ascending: false }),
    supabase.from("follow_up_tasks").select("*").is("deleted_at", null).not("enquiry_id", "is", null).order("due_date", { ascending: true })
  ]);
  if (enquiriesResult.error) throw enquiriesResult.error;
  if (tasksResult.error) throw tasksResult.error;
  state = { enquiries: enquiriesResult.data || [], tasks: tasksResult.data || [] };
}

function render(container) {
  const counts = {
    new_enquiry: state.enquiries.filter(item => item.status === "new_enquiry").length,
    trial_booked: state.enquiries.filter(item => item.status === "trial_booked").length,
    follow_up_required: state.enquiries.filter(item => item.status === "follow_up_required").length,
    joined: state.enquiries.filter(item => item.status === "joined").length
  };

  const rows = state.enquiries.map(enquiry => {
    const openTask = state.tasks.find(task => task.enquiry_id === enquiry.id && ["open", "in_progress"].includes(task.status));
    const search = `${enquiry.student_name} ${enquiry.guardian_name || ""} ${enquiry.email || ""} ${enquiry.phone || ""}`.toLowerCase();
    return `
      <tr data-search="${escapeHtml(search)}" data-status="${enquiry.status}">
        <td><strong>${escapeHtml(enquiry.student_name)}</strong><div class="record-meta">${enquiry.student_age ? `Age ${enquiry.student_age}` : "Age not recorded"}</div></td>
        <td>${escapeHtml(enquiry.guardian_name || "—")}<div class="record-meta">${escapeHtml(enquiry.email || enquiry.phone || "")}</div></td>
        <td>${formatDate(enquiry.enquiry_date)}</td>
        <td>${statusBadge(enquiry.status)}</td>
        <td>${openTask ? `${formatDate(openTask.due_date)}<div class="record-meta">${escapeHtml(openTask.title)}</div>` : (enquiry.follow_up_date ? formatDate(enquiry.follow_up_date) : "—")}</td>
        <td class="table-actions">
          <button class="button button-secondary button-small" data-action="edit" data-id="${enquiry.id}">Edit</button>
          <button class="button button-secondary button-small" data-action="followup" data-id="${enquiry.id}">Follow-up</button>
          <button class="button button-primary button-small" data-action="convert" data-id="${enquiry.id}" ${enquiry.status === "joined" ? "disabled" : ""}>Convert</button>
          <button class="button button-danger button-small" data-action="archive" data-id="${enquiry.id}">Archive</button>
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({
        eyebrow: "People",
        title: "Enquiries & Trials",
        description: "Track enquiries, book trials, schedule follow-ups and convert successful enquiries into students.",
        actions: '<button id="addEnquiryButton" class="button button-primary" type="button">Add enquiry</button>'
      })}
      <div class="summary-grid">
        <article class="summary-tile"><span>New enquiries</span><strong>${counts.new_enquiry}</strong></article>
        <article class="summary-tile"><span>Trials booked</span><strong>${counts.trial_booked}</strong></article>
        <article class="summary-tile"><span>Follow-ups required</span><strong>${counts.follow_up_required}</strong></article>
        <article class="summary-tile"><span>Joined</span><strong>${counts.joined}</strong></article>
      </div>
      <div class="module-toolbar">
        <input id="enquirySearch" class="input search-input" type="search" placeholder="Search student, guardian, email or phone">
        <select id="enquiryStatusFilter" class="select compact-select">
          <option value="">All statuses</option>
          ${["new_enquiry","contacted","trial_booked","trial_attended","follow_up_required","joined","did_not_proceed","no_response"].map(value => `<option value="${value}">${value.replaceAll("_", " ")}</option>`).join("")}
        </select>
      </div>
      ${state.enquiries.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Student</th><th>Guardian</th><th>Enquiry date</th><th>Status</th><th>Next follow-up</th><th>Actions</th></tr></thead>
            <tbody id="enquiryRows">${rows}</tbody>
          </table>
        </div>` : emptyState("No enquiries yet", "Add an enquiry when a parent or student makes contact.")}
    </div>`;

  container.querySelector("#addEnquiryButton").addEventListener("click", () => openEnquiryDialog());
  container.querySelector("#enquirySearch")?.addEventListener("input", filterRows);
  container.querySelector("#enquiryStatusFilter")?.addEventListener("change", filterRows);
  container.querySelector("#enquiryRows")?.addEventListener("click", handleAction);
}

function filterRows() {
  const query = document.getElementById("enquirySearch")?.value.trim().toLowerCase() || "";
  const status = document.getElementById("enquiryStatusFilter")?.value || "";
  document.querySelectorAll("#enquiryRows tr").forEach(row => {
    row.hidden = Boolean((query && !row.dataset.search.includes(query)) || (status && row.dataset.status !== status));
  });
}

function handleAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const enquiry = state.enquiries.find(item => item.id === button.dataset.id);
  if (!enquiry) return;
  if (button.dataset.action === "edit") openEnquiryDialog(enquiry);
  if (button.dataset.action === "followup") openFollowUpDialog(enquiry);
  if (button.dataset.action === "convert") openConvertDialog(enquiry);
  if (button.dataset.action === "archive") archiveEnquiry(enquiry);
}

function openEnquiryDialog(enquiry = null) {
  const preferredDays = new Set(enquiry?.preferred_training_days || []);
  openDialog({
    title: enquiry ? "Edit enquiry" : "Add enquiry",
    eyebrow: "People",
    body: `
      <form id="enquiryForm" class="form-grid">
        <input type="hidden" name="id" value="${enquiry?.id || ""}">
        <label class="form-field"><span class="form-label">Student name</span><input class="input" name="studentName" required value="${escapeHtml(enquiry?.student_name || "")}"></label>
        <label class="form-field"><span class="form-label">Student age</span><input class="input" type="number" min="1" max="100" name="studentAge" value="${enquiry?.student_age || ""}"></label>
        <label class="form-field"><span class="form-label">Guardian name</span><input class="input" name="guardianName" value="${escapeHtml(enquiry?.guardian_name || "")}"></label>
        <label class="form-field"><span class="form-label">Phone</span><input class="input" name="phone" value="${escapeHtml(enquiry?.phone || "")}"></label>
        <label class="form-field"><span class="form-label">Email</span><input class="input" type="email" name="email" value="${escapeHtml(enquiry?.email || "")}"></label>
        <label class="form-field"><span class="form-label">Enquiry date</span><input class="input" type="date" name="enquiryDate" required value="${enquiry?.enquiry_date || todayIso()}"></label>
        <label class="form-field"><span class="form-label">Status</span><select class="select" name="status">${["new_enquiry","contacted","trial_booked","trial_attended","follow_up_required","joined","did_not_proceed","no_response"].map(value => `<option value="${value}" ${enquiry?.status === value || (!enquiry && value === "new_enquiry") ? "selected" : ""}>${value.replaceAll("_", " ")}</option>`).join("")}</select></label>
        <label class="form-field"><span class="form-label">Follow-up date</span><input class="input" type="date" name="followUpDate" value="${enquiry?.follow_up_date || ""}"></label>
        <label class="form-field"><span class="form-label">Referral source</span><input class="input" name="referralSource" value="${escapeHtml(enquiry?.referral_source || "")}"></label>
        <div class="form-field"><span class="form-label">Preferred days</span><div class="inline-checks"><label class="checkbox-row"><input type="checkbox" name="tuesday" ${preferredDays.has("Tuesday") ? "checked" : ""}><span>Tuesday</span></label><label class="checkbox-row"><input type="checkbox" name="thursday" ${preferredDays.has("Thursday") ? "checked" : ""}><span>Thursday</span></label></div></div>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(enquiry?.notes || "")}</textarea></label>
      </form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveEnquiryButton" class="button button-primary" type="button">${enquiry ? "Save changes" : "Create enquiry"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveEnquiryButton").addEventListener("click", saveEnquiry);
}

async function saveEnquiry(event) {
  const button = event.currentTarget;
  const form = document.getElementById("enquiryForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const days = [];
    if (data.get("tuesday")) days.push("Tuesday");
    if (data.get("thursday")) days.push("Thursday");
    const row = {
      student_name: normaliseText(data.get("studentName")),
      student_age: data.get("studentAge") ? Number(data.get("studentAge")) : null,
      guardian_name: normaliseText(data.get("guardianName")) || null,
      phone: normaliseText(data.get("phone")) || null,
      email: normaliseText(data.get("email")) || null,
      enquiry_date: data.get("enquiryDate"),
      status: data.get("status"),
      follow_up_date: data.get("followUpDate") || null,
      referral_source: normaliseText(data.get("referralSource")) || null,
      preferred_training_days: days,
      notes: normaliseText(data.get("notes")) || null
    };
    const id = data.get("id");
    const supabase = getSupabaseClient();
    const result = id ? await supabase.from("enquiries").update(row).eq("id", id) : await supabase.from("enquiries").insert(row);
    if (result.error) throw result.error;
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(id ? "Enquiry updated." : "Enquiry created.");
    dispatchDataChanged({ module: "enquiries" });
  } catch (error) { notifyError(error); }
  finally { setButtonBusy(button, false); }
}

function openFollowUpDialog(enquiry) {
  openDialog({
    title: `Follow-up: ${enquiry.student_name}`,
    eyebrow: "People",
    body: `<form id="followUpForm" class="form-grid"><input type="hidden" name="enquiryId" value="${enquiry.id}"><label class="form-field full"><span class="form-label">Task title</span><input class="input" name="title" required value="Follow up with ${escapeHtml(enquiry.guardian_name || enquiry.student_name)}"></label><label class="form-field"><span class="form-label">Due date</span><input class="input" type="date" name="dueDate" required value="${enquiry.follow_up_date || todayIso()}"></label><label class="form-field"><span class="form-label">Priority</span><select class="select" name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label><label class="form-field full"><span class="form-label">Description</span><textarea class="textarea" name="description"></textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveFollowUpButton" class="button button-primary" type="button">Create follow-up</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveFollowUpButton").addEventListener("click", saveFollowUp);
}

async function saveFollowUp(event) {
  const button = event.currentTarget;
  const form = document.getElementById("followUpForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("follow_up_tasks").insert({
      task_type: "enquiry_follow_up",
      title: normaliseText(data.get("title")),
      description: normaliseText(data.get("description")) || null,
      due_date: data.get("dueDate"),
      priority: data.get("priority"),
      enquiry_id: data.get("enquiryId"),
      status: "open"
    });
    if (error) throw error;
    await supabase.from("enquiries").update({ status: "follow_up_required", follow_up_date: data.get("dueDate") }).eq("id", data.get("enquiryId"));
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Follow-up task created.");
    dispatchDataChanged({ module: "communication" });
  } catch (error) { notifyError(error); }
  finally { setButtonBusy(button, false); }
}

function splitName(fullName) {
  const parts = normaliseText(fullName).split(/\s+/).filter(Boolean);
  return { first: parts.shift() || "", last: parts.join(" ") || "Student" };
}

function openConvertDialog(enquiry) {
  const parsed = splitName(enquiry.student_name);
  const guardianLast = splitName(enquiry.guardian_name || "").last;
  openDialog({
    title: "Convert enquiry to student",
    eyebrow: "People",
    body: `<form id="convertForm" class="form-grid"><input type="hidden" name="enquiryId" value="${enquiry.id}"><label class="form-field"><span class="form-label">First name</span><input class="input" name="firstName" required value="${escapeHtml(parsed.first)}"></label><label class="form-field"><span class="form-label">Last name</span><input class="input" name="lastName" required value="${escapeHtml(parsed.last)}"></label><label class="form-field"><span class="form-label">Start date</span><input class="input" type="date" name="startDate" required value="${todayIso()}"></label><label class="form-field"><span class="form-label">Student status</span><select class="select" name="studentStatus"><option value="trial">Trial</option><option value="active">Active</option></select></label><label class="form-field"><span class="form-label">Family name</span><input class="input" name="familyName" value="${escapeHtml(guardianLast || parsed.last)} Family"></label><label class="form-field"><span class="form-label">Guardian name</span><input class="input" name="guardianName" value="${escapeHtml(enquiry.guardian_name || "")}"></label><label class="form-field"><span class="form-label">Guardian email</span><input class="input" type="email" name="email" value="${escapeHtml(enquiry.email || "")}"></label><label class="form-field"><span class="form-label">Guardian phone</span><input class="input" name="phone" value="${escapeHtml(enquiry.phone || "")}"></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="convertEnquiryButton" class="button button-primary" type="button">Create student</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("convertEnquiryButton").addEventListener("click", convertEnquiry);
}

async function convertEnquiry(event) {
  const button = event.currentTarget;
  const form = document.getElementById("convertForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true, "Converting…");
  try {
    const data = new FormData(form);
    const supabase = getSupabaseClient();
    let familyId = null;
    let guardianId = null;
    const familyName = normaliseText(data.get("familyName"));
    if (familyName) {
      const { data: family, error } = await supabase.from("families").insert({ family_name: familyName, billing_name: normaliseText(data.get("guardianName")) || null, payment_reference: familyName }).select("id").single();
      if (error) throw error;
      familyId = family.id;
    }
    const guardianName = normaliseText(data.get("guardianName"));
    if (guardianName) {
      const { data: guardian, error } = await supabase.from("guardians").insert({ full_name: guardianName, email: normaliseText(data.get("email")) || null, mobile_number: normaliseText(data.get("phone")) || null }).select("id").single();
      if (error) throw error;
      guardianId = guardian.id;
      if (familyId) {
        const { error: linkError } = await supabase.from("guardian_families").insert({ guardian_id: guardianId, family_id: familyId, is_primary_billing_contact: true });
        if (linkError) throw linkError;
        await supabase.from("families").update({ primary_guardian_id: guardianId }).eq("id", familyId);
      }
    }
    const { data: studentNumber, error: numberError } = await supabase.rpc("next_student_number");
    if (numberError) throw numberError;
    const { data: student, error: studentError } = await supabase.from("students").insert({ student_number: studentNumber, family_id: familyId, first_name: normaliseText(data.get("firstName")), last_name: normaliseText(data.get("lastName")), start_date: data.get("startDate"), status: data.get("studentStatus"), referral_source: "Enquiry conversion" }).select("id").single();
    if (studentError) throw studentError;
    if (guardianId) {
      const { error } = await supabase.from("student_guardians").insert({ student_id: student.id, guardian_id: guardianId, relationship_to_student: "Guardian", is_primary_contact: true, is_emergency_contact: true, authorised_to_collect: true });
      if (error) throw error;
    }
    const { error: enquiryError } = await supabase.from("enquiries").update({ status: "joined", converted_student_id: student.id, converted_at: nowIso() }).eq("id", data.get("enquiryId"));
    if (enquiryError) throw enquiryError;
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(`Student ${studentNumber} created.`);
    dispatchDataChanged({ module: "students" });
  } catch (error) { notifyError(error); }
  finally { setButtonBusy(button, false); }
}

async function archiveEnquiry(enquiry) {
  if (!await confirmAction(`Archive the enquiry for ${enquiry.student_name}?`)) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("enquiries").update({ deleted_at: nowIso() }).eq("id", enquiry.id);
    if (error) throw error;
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Enquiry archived.");
  } catch (error) { notifyError(error); }
}
