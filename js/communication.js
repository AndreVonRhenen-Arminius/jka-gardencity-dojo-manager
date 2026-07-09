import { getSupabaseClient } from "./database.js?v=1.0.1";
import { dispatchDataChanged, formatDate, formatDateTime, normaliseText, todayIso } from "./utilities.js?v=1.0.1";
import {
  closeDialog, emptyState, escapeHtml, moduleHeader, notifyError,
  notifySuccess, openDialog, setButtonBusy, statusBadge
} from "./ui.js?v=1.0.1";

let state = { communications: [], tasks: [], students: [], families: [], guardians: [], enquiries: [] };

export async function renderCommunication(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("communication_history").select("*").is("deleted_at", null).order("communication_date", { ascending: false }).limit(200),
    supabase.from("follow_up_tasks").select("*").is("deleted_at", null).order("due_date", { ascending: true }).limit(200),
    supabase.from("students").select("id,first_name,last_name,preferred_name").is("deleted_at", null).order("last_name"),
    supabase.from("families").select("id,family_name").is("deleted_at", null).order("family_name"),
    supabase.from("guardians").select("id,full_name").is("deleted_at", null).order("full_name"),
    supabase.from("enquiries").select("id,student_name,guardian_name").is("deleted_at", null).order("enquiry_date", { ascending: false })
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.communications, state.tasks, state.students, state.families, state.guardians, state.enquiries] = results.map(result => result.data || []);
}

function entityLabel(record) {
  const student = state.students.find(item => item.id === record.student_id);
  const family = state.families.find(item => item.id === record.family_id);
  const guardian = state.guardians.find(item => item.id === record.guardian_id);
  const enquiry = state.enquiries.find(item => item.id === record.enquiry_id);
  return student ? `${student.preferred_name || student.first_name} ${student.last_name}` : family?.family_name || guardian?.full_name || enquiry?.student_name || "General dojo record";
}

function render(container) {
  const openTasks = state.tasks.filter(item => ["open","in_progress"].includes(item.status));
  const overdue = openTasks.filter(item => item.due_date && item.due_date < todayIso()).length;
  const dueToday = openTasks.filter(item => item.due_date === todayIso()).length;
  const recent = state.communications.filter(item => new Date(item.communication_date) >= new Date(Date.now() - 30 * 86400000)).length;

  const communicationRows = state.communications.map(item => `<tr data-search="${escapeHtml(`${item.subject || ""} ${item.summary} ${entityLabel(item)}`.toLowerCase())}"><td>${formatDateTime(item.communication_date)}</td><td>${escapeHtml(item.communication_type.replaceAll("_"," "))}</td><td><strong>${escapeHtml(entityLabel(item))}</strong><div class="record-meta">${escapeHtml(item.subject || "")}</div></td><td>${escapeHtml(item.summary)}</td><td>${item.follow_up_required ? formatDate(item.follow_up_date) : "—"}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="edit-communication" data-id="${item.id}">Edit</button></td></tr>`).join("");
  const taskRows = state.tasks.map(item => `<tr><td><strong>${escapeHtml(item.title)}</strong><div class="record-meta">${escapeHtml(item.task_type.replaceAll("_"," "))}</div></td><td>${formatDate(item.due_date)}</td><td>${statusBadge(item.priority)}</td><td>${statusBadge(item.status)}</td><td>${escapeHtml(item.description || "—")}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="edit-task" data-id="${item.id}">Edit</button><button class="button button-primary button-small" data-action="complete-task" data-id="${item.id}" ${item.status === "completed" ? "disabled" : ""}>Complete</button></td></tr>`).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "Records", title: "Communication", description: "Record parent contact, payment reminders, concerns and follow-up work without sending messages automatically.", actions: '<button id="addCommunicationButton" class="button button-primary" type="button">Log communication</button><button id="addTaskButton" class="button button-secondary" type="button">Add follow-up task</button>' })}
    <div class="summary-grid"><article class="summary-tile"><span>Open follow-ups</span><strong>${openTasks.length}</strong></article><article class="summary-tile"><span>Overdue</span><strong>${overdue}</strong></article><article class="summary-tile"><span>Due today</span><strong>${dueToday}</strong></article><article class="summary-tile"><span>Communications, 30 days</span><strong>${recent}</strong></article></div>
    <section class="section-card"><div class="section-card-header"><div><h3>Communication history</h3></div><input id="communicationSearch" class="input compact-search" type="search" placeholder="Search history"></div>${state.communications.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Related to</th><th>Summary</th><th>Follow-up</th><th>Actions</th></tr></thead><tbody id="communicationRows">${communicationRows}</tbody></table></div>` : emptyState("No communication history", "Log phone calls, emails, discussions and reminders.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Follow-up tasks</h3></div></div>${state.tasks.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Task</th><th>Due</th><th>Priority</th><th>Status</th><th>Description</th><th>Actions</th></tr></thead><tbody id="taskRows">${taskRows}</tbody></table></div>` : emptyState("No follow-up tasks", "Create tasks for trials, payments or parent discussions.")}</section>
  </div>`;

  container.querySelector("#addCommunicationButton").addEventListener("click", () => openCommunicationDialog());
  container.querySelector("#addTaskButton").addEventListener("click", () => openTaskDialog());
  container.querySelector("#communicationSearch")?.addEventListener("input", event => document.querySelectorAll("#communicationRows tr").forEach(row => row.hidden = event.target.value.trim() && !row.dataset.search.includes(event.target.value.trim().toLowerCase())));
  container.querySelector("#communicationRows")?.addEventListener("click", event => { const button = event.target.closest("button[data-id]"); if (button) openCommunicationDialog(state.communications.find(item => item.id === button.dataset.id)); });
  container.querySelector("#taskRows")?.addEventListener("click", handleTaskAction);
}

function relatedOptions(items, value, label) {
  return `<option value="">Not linked</option>${items.map(item => `<option value="${item.id}" ${item.id === value ? "selected" : ""}>${escapeHtml(label(item))}</option>`).join("")}`;
}

function openCommunicationDialog(item = null) {
  const dateValue = item?.communication_date ? new Date(item.communication_date).toISOString().slice(0,16) : new Date().toISOString().slice(0,16);
  openDialog({
    title: item ? "Edit communication record" : "Log communication", eyebrow: "Records",
    body: `<form id="communicationForm" class="form-grid"><input type="hidden" name="id" value="${item?.id || ""}"><label class="form-field"><span class="form-label">Date and time</span><input class="input" type="datetime-local" name="date" required value="${dateValue}"></label><label class="form-field"><span class="form-label">Type</span><select class="select" name="type">${["email_sent","phone_call","text_message","in_person_discussion","follow_up_required","parent_concern","payment_reminder","trial_follow_up","grading_discussion","other"].map(value => `<option value="${value}" ${item?.communication_type === value ? "selected" : ""}>${value.replaceAll("_"," ")}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Student</span><select class="select" name="studentId">${relatedOptions(state.students, item?.student_id, student => `${student.preferred_name || student.first_name} ${student.last_name}`)}</select></label><label class="form-field"><span class="form-label">Family</span><select class="select" name="familyId">${relatedOptions(state.families, item?.family_id, family => family.family_name)}</select></label><label class="form-field"><span class="form-label">Guardian</span><select class="select" name="guardianId">${relatedOptions(state.guardians, item?.guardian_id, guardian => guardian.full_name)}</select></label><label class="form-field"><span class="form-label">Enquiry</span><select class="select" name="enquiryId">${relatedOptions(state.enquiries, item?.enquiry_id, enquiry => enquiry.student_name)}</select></label><label class="form-field full"><span class="form-label">Subject</span><input class="input" name="subject" value="${escapeHtml(item?.subject || "")}"></label><label class="form-field full"><span class="form-label">Summary</span><textarea class="textarea" name="summary" required>${escapeHtml(item?.summary || "")}</textarea></label><label class="checkbox-row"><input type="checkbox" name="followUp" ${item?.follow_up_required ? "checked" : ""}><span>Follow-up required</span></label><label class="form-field"><span class="form-label">Follow-up date</span><input class="input" type="date" name="followUpDate" value="${item?.follow_up_date || ""}"></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveCommunicationButton" class="button button-primary" type="button">${item ? "Save changes" : "Save record"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveCommunicationButton").addEventListener("click", saveCommunication);
}

async function saveCommunication(event) {
  const button = event.currentTarget, form = document.getElementById("communicationForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), follow = data.get("followUp") === "on";
    const row = { communication_date: new Date(data.get("date")).toISOString(), communication_type: data.get("type"), student_id: data.get("studentId") || null, family_id: data.get("familyId") || null, guardian_id: data.get("guardianId") || null, enquiry_id: data.get("enquiryId") || null, subject: normaliseText(data.get("subject")) || null, summary: normaliseText(data.get("summary")), follow_up_required: follow, follow_up_date: follow ? data.get("followUpDate") || null : null };
    const supabase = getSupabaseClient(); const result = id ? await supabase.from("communication_history").update(row).eq("id", id) : await supabase.from("communication_history").insert(row); if (result.error) throw result.error;
    if (!id && follow && row.follow_up_date) {
      const { error } = await supabase.from("follow_up_tasks").insert({ task_type: "communication_follow_up", title: row.subject || `Follow up: ${entityFromRow(row)}`, description: row.summary, due_date: row.follow_up_date, status: "open", priority: "normal", student_id: row.student_id, family_id: row.family_id, enquiry_id: row.enquiry_id }); if (error) throw error;
    }
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Communication record updated." : "Communication recorded."); dispatchDataChanged({ module: "communication" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function entityFromRow(row) { return state.students.find(item => item.id === row.student_id)?.first_name || state.families.find(item => item.id === row.family_id)?.family_name || "dojo contact"; }

function openTaskDialog(task = null) {
  openDialog({
    title: task ? "Edit follow-up task" : "Add follow-up task", eyebrow: "Records",
    body: `<form id="taskForm" class="form-grid"><input type="hidden" name="id" value="${task?.id || ""}"><label class="form-field full"><span class="form-label">Title</span><input class="input" name="title" required value="${escapeHtml(task?.title || "")}"></label><label class="form-field"><span class="form-label">Task type</span><input class="input" name="type" value="${escapeHtml(task?.task_type || "general_follow_up")}"></label><label class="form-field"><span class="form-label">Due date</span><input class="input" type="date" name="dueDate" value="${task?.due_date || todayIso()}"></label><label class="form-field"><span class="form-label">Priority</span><select class="select" name="priority">${["low","normal","high","urgent"].map(value => `<option value="${value}" ${task?.priority === value || (!task && value === "normal") ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Status</span><select class="select" name="status">${["open","in_progress","completed","cancelled"].map(value => `<option value="${value}" ${task?.status === value || (!task && value === "open") ? "selected" : ""}>${value.replaceAll("_"," ")}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Student</span><select class="select" name="studentId">${relatedOptions(state.students, task?.student_id, student => `${student.preferred_name || student.first_name} ${student.last_name}`)}</select></label><label class="form-field"><span class="form-label">Family</span><select class="select" name="familyId">${relatedOptions(state.families, task?.family_id, family => family.family_name)}</select></label><label class="form-field full"><span class="form-label">Description</span><textarea class="textarea" name="description">${escapeHtml(task?.description || "")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveTaskButton" class="button button-primary" type="button">${task ? "Save changes" : "Create task"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveTaskButton").addEventListener("click", saveTask);
}

async function saveTask(event) {
  const button = event.currentTarget, form = document.getElementById("taskForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), status = data.get("status"), row = { task_type: normaliseText(data.get("type")) || "general_follow_up", title: normaliseText(data.get("title")), description: normaliseText(data.get("description")) || null, due_date: data.get("dueDate") || null, priority: data.get("priority"), status, student_id: data.get("studentId") || null, family_id: data.get("familyId") || null, completed_at: status === "completed" ? new Date().toISOString() : null };
    const supabase = getSupabaseClient(), result = id ? await supabase.from("follow_up_tasks").update(row).eq("id", id) : await supabase.from("follow_up_tasks").insert(row); if (result.error) throw result.error;
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Task updated." : "Task created."); dispatchDataChanged({ module: "communication" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function handleTaskAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const task = state.tasks.find(item => item.id === button.dataset.id); if (!task) return;
  if (button.dataset.action === "edit-task") openTaskDialog(task);
  if (button.dataset.action === "complete-task") completeTask(task);
}
async function completeTask(task) {
  try { const supabase = getSupabaseClient(); const { error } = await supabase.from("follow_up_tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", task.id); if (error) throw error; await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Task completed."); dispatchDataChanged({ module: "communication" }); }
  catch (error) { notifyError(error); }
}
