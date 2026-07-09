import { getSupabaseClient } from "./database.js?v=1.2.0";
import { dispatchDataChanged, formatDate, normaliseText, todayIso } from "./utilities.js?v=1.2.0";
import {
  closeDialog, emptyState, escapeHtml, moduleHeader, notifyError,
  notifySuccess, openDialog, setButtonBusy, statusBadge
} from "./ui.js?v=1.2.0";

let state = { students: [], reviews: [], goals: [], selectedStudentId: "" };
const ratingFields = ["kihon", "kata", "kumite", "fitness", "flexibility", "discipline", "focus", "confidence", "attitude", "effort"];

export async function renderProgress(container) {
  await refreshBase();
  render(container);
}

async function refreshBase() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("students").select("id,student_number,first_name,last_name,preferred_name,status").is("deleted_at", null).order("last_name");
  if (error) throw error;
  state.students = data || [];
  if (!state.selectedStudentId && state.students.length) state.selectedStudentId = state.students[0].id;
  await refreshStudentData();
}

async function refreshStudentData() {
  if (!state.selectedStudentId) { state.reviews = []; state.goals = []; return; }
  const supabase = getSupabaseClient();
  const [reviewsResult, goalsResult] = await Promise.all([
    supabase.from("student_progress").select("*").eq("student_id", state.selectedStudentId).is("deleted_at", null).order("review_date", { ascending: false }),
    supabase.from("student_goals").select("*").eq("student_id", state.selectedStudentId).is("deleted_at", null).order("created_at", { ascending: false })
  ]);
  if (reviewsResult.error) throw reviewsResult.error;
  if (goalsResult.error) throw goalsResult.error;
  state.reviews = reviewsResult.data || [];
  state.goals = goalsResult.data || [];
}

function render(container) {
  const student = state.students.find(item => item.id === state.selectedStudentId);
  const latest = state.reviews[0];
  const options = state.students.map(item => `<option value="${item.id}" ${item.id === state.selectedStudentId ? "selected" : ""}>${escapeHtml(`${item.preferred_name || item.first_name} ${item.last_name} · ${item.student_number}`)}</option>`).join("");
  const ratingTiles = latest ? ratingFields.map(field => `<article class="summary-tile"><span>${field}</span><strong>${latest[`${field}_rating`] ?? "—"}<small>/5</small></strong></article>`).join("") : "";
  const reviewRows = state.reviews.map(review => `<tr><td>${formatDate(review.review_date)}</td><td>${averageRating(review)}</td><td>${escapeHtml(review.technical_notes || "—")}</td><td>${formatDate(review.next_review_date)}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="edit-review" data-id="${review.id}">Edit</button></td></tr>`).join("");
  const goalRows = state.goals.map(goal => `<tr><td><strong>${escapeHtml(goal.goal_text)}</strong><div class="record-meta">${escapeHtml(goal.goal_category || "General")}</div></td><td>${formatDate(goal.target_date)}</td><td>${statusBadge(goal.status)}</td><td>${escapeHtml(goal.notes || "—")}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="edit-goal" data-id="${goal.id}">Edit</button><button class="button button-primary button-small" data-action="complete-goal" data-id="${goal.id}" ${goal.status === "completed" ? "disabled" : ""}>Complete</button></td></tr>`).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "Development", title: "Progress & Goals", description: "Record structured reviews, parent-shareable summaries and individual development goals.", actions: '<button id="addProgressReviewButton" class="button button-primary" type="button">Add review</button><button id="addGoalButton" class="button button-secondary" type="button">Add goal</button>' })}
    ${state.students.length ? `
      <div class="section-card"><label class="form-field"><span class="form-label">Student</span><select id="progressStudentSelect" class="select">${options}</select></label></div>
      ${student ? `<section class="section-card"><div class="section-card-header"><div><h3>${escapeHtml(`${student.preferred_name || student.first_name} ${student.last_name}`)}</h3><p class="muted">${latest ? `Latest review ${formatDate(latest.review_date)}` : "No review recorded yet."}</p></div></div>${latest ? `<div class="summary-grid progress-summary">${ratingTiles}</div>${latest.parent_shareable_summary ? `<div class="inline-message section-spacer"><strong>Parent-shareable summary</strong><br>${escapeHtml(latest.parent_shareable_summary)}</div>` : ""}` : emptyState("No progress review", "Add the first review for this student.")}</section>` : ""}
      <section class="section-card"><div class="section-card-header"><div><h3>Review history</h3></div></div>${state.reviews.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Average</th><th>Technical notes</th><th>Next review</th><th>Actions</th></tr></thead><tbody id="progressReviewRows">${reviewRows}</tbody></table></div>` : emptyState("No review history", "Structured reviews will appear here.")}</section>
      <section class="section-card"><div class="section-card-header"><div><h3>Goals</h3></div></div>${state.goals.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Goal</th><th>Target</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody id="goalRows">${goalRows}</tbody></table></div>` : emptyState("No goals", "Create practical karate, fitness or behaviour goals.")}</section>
    ` : emptyState("No students available", "Create a student before recording progress.")}
  </div>`;

  container.querySelector("#progressStudentSelect")?.addEventListener("change", changeStudent);
  container.querySelector("#addProgressReviewButton")?.addEventListener("click", () => openReviewDialog());
  container.querySelector("#addGoalButton")?.addEventListener("click", () => openGoalDialog());
  container.querySelector("#progressReviewRows")?.addEventListener("click", event => { const button = event.target.closest("button[data-id]"); if (button) openReviewDialog(state.reviews.find(item => item.id === button.dataset.id)); });
  container.querySelector("#goalRows")?.addEventListener("click", handleGoalAction);
}

function averageRating(review) {
  const values = ratingFields.map(field => Number(review[`${field}_rating`])).filter(Number.isFinite);
  if (!values.length) return "—";
  return `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}/5`;
}

async function changeStudent(event) {
  state.selectedStudentId = event.target.value;
  try { await refreshStudentData(); render(document.getElementById("moduleContent")); }
  catch (error) { notifyError(error); }
}

function ratingInput(field, review) {
  return `<label class="form-field"><span class="form-label">${field[0].toUpperCase() + field.slice(1)}</span><select class="select" name="${field}"><option value="">Not rated</option>${[1,2,3,4,5].map(value => `<option value="${value}" ${Number(review?.[`${field}_rating`]) === value ? "selected" : ""}>${value} / 5</option>`).join("")}</select></label>`;
}

function openReviewDialog(review = null) {
  if (!state.selectedStudentId) return;
  openDialog({
    title: review ? "Edit progress review" : "Add progress review", eyebrow: "Development",
    body: `<form id="progressReviewForm" class="form-grid"><input type="hidden" name="id" value="${review?.id || ""}"><label class="form-field"><span class="form-label">Review date</span><input class="input" type="date" name="reviewDate" required value="${review?.review_date || todayIso()}"></label><label class="form-field"><span class="form-label">Next review date</span><input class="input" type="date" name="nextReviewDate" value="${review?.next_review_date || ""}"></label>${ratingFields.map(field => ratingInput(field, review)).join("")}<label class="form-field full"><span class="form-label">Technical notes</span><textarea class="textarea" name="technicalNotes">${escapeHtml(review?.technical_notes || "")}</textarea></label><label class="form-field full"><span class="form-label">Parent-shareable summary</span><textarea class="textarea" name="parentSummary">${escapeHtml(review?.parent_shareable_summary || "")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveProgressReviewButton" class="button button-primary" type="button">${review ? "Save changes" : "Save review"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveProgressReviewButton").addEventListener("click", saveReview);
}

async function saveReview(event) {
  const button = event.currentTarget, form = document.getElementById("progressReviewForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id");
    const row = { student_id: state.selectedStudentId, review_date: data.get("reviewDate"), next_review_date: data.get("nextReviewDate") || null, technical_notes: normaliseText(data.get("technicalNotes")) || null, parent_shareable_summary: normaliseText(data.get("parentSummary")) || null };
    ratingFields.forEach(field => { row[`${field}_rating`] = data.get(field) ? Number(data.get(field)) : null; });
    const supabase = getSupabaseClient(); const result = id ? await supabase.from("student_progress").update(row).eq("id", id) : await supabase.from("student_progress").insert(row); if (result.error) throw result.error;
    closeDialog(); await refreshStudentData(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Review updated." : "Review saved."); dispatchDataChanged({ module: "progress" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function openGoalDialog(goal = null) {
  if (!state.selectedStudentId) return;
  openDialog({
    title: goal ? "Edit goal" : "Add goal", eyebrow: "Development",
    body: `<form id="goalForm" class="form-grid"><input type="hidden" name="id" value="${goal?.id || ""}"><label class="form-field full"><span class="form-label">Goal</span><input class="input" name="goalText" required value="${escapeHtml(goal?.goal_text || "")}"></label><label class="form-field"><span class="form-label">Category</span><select class="select" name="category">${["Kihon","Kata","Kumite","Fitness","Flexibility","Discipline","Focus","Confidence","Attendance","Other"].map(value => `<option value="${value}" ${goal?.goal_category === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Target date</span><input class="input" type="date" name="targetDate" value="${goal?.target_date || ""}"></label><label class="form-field"><span class="form-label">Status</span><select class="select" name="status">${["active","completed","paused","cancelled"].map(value => `<option value="${value}" ${goal?.status === value || (!goal && value === "active") ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(goal?.notes || "")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveGoalButton" class="button button-primary" type="button">${goal ? "Save changes" : "Create goal"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveGoalButton").addEventListener("click", saveGoal);
}

async function saveGoal(event) {
  const button = event.currentTarget, form = document.getElementById("goalForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), status = data.get("status");
    const row = { student_id: state.selectedStudentId, goal_text: normaliseText(data.get("goalText")), goal_category: data.get("category"), target_date: data.get("targetDate") || null, status, completed_at: status === "completed" ? new Date().toISOString() : null, notes: normaliseText(data.get("notes")) || null };
    const supabase = getSupabaseClient(); const result = id ? await supabase.from("student_goals").update(row).eq("id", id) : await supabase.from("student_goals").insert(row); if (result.error) throw result.error;
    closeDialog(); await refreshStudentData(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Goal updated." : "Goal created."); dispatchDataChanged({ module: "progress" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function handleGoalAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const goal = state.goals.find(item => item.id === button.dataset.id); if (!goal) return;
  if (button.dataset.action === "edit-goal") openGoalDialog(goal);
  if (button.dataset.action === "complete-goal") completeGoal(goal);
}

async function completeGoal(goal) {
  try {
    const supabase = getSupabaseClient(); const { error } = await supabase.from("student_goals").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", goal.id); if (error) throw error;
    await refreshStudentData(); render(document.getElementById("moduleContent")); notifySuccess("Goal completed."); dispatchDataChanged({ module: "progress" });
  } catch (error) { notifyError(error); }
}
