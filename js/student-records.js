import { getSupabaseClient } from "./database.js?v=1.0.1";
import { formatDate, normaliseText, todayIso } from "./utilities.js?v=1.0.1";
import { closeDialog, escapeHtml, notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge } from "./ui.js?v=1.0.1";

export async function openStudentRecords(student) {
  try {
    const data = await loadStudentRecords(student.id);
    renderStudentRecords(student, data);
  } catch (error) {
    notifyError(error);
  }
}

async function loadStudentRecords(studentId) {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("student_guardians").select("*").eq("student_id", studentId),
    supabase.from("guardians").select("*").is("deleted_at", null),
    supabase.from("student_notes").select("*").eq("student_id", studentId).is("deleted_at", null).order("note_date", { ascending: false }),
    supabase.from("student_emergency_contacts").select("*").eq("student_id", studentId).is("deleted_at", null).order("priority_order"),
    supabase.from("student_medical_information").select("*").eq("student_id", studentId).is("deleted_at", null).maybeSingle(),
    supabase.from("student_safety_alerts").select("*").eq("student_id", studentId).is("deleted_at", null).order("active_from", { ascending: false })
  ]);
  for (const result of results) if (result.error) throw result.error;
  return {
    links: results[0].data || [],
    guardians: results[1].data || [],
    notes: results[2].data || [],
    emergency: results[3].data || [],
    medical: results[4].data || null,
    alerts: results[5].data || []
  };
}

function renderStudentRecords(student, data) {
  const guardianMap = new Map(data.guardians.map(item => [item.id, item]));
  const guardianRows = data.links.map(link => {
    const guardian = guardianMap.get(link.guardian_id);
    return `<tr><td>${escapeHtml(guardian?.full_name || "Unknown guardian")}</td><td>${escapeHtml(link.relationship_to_student || "Guardian")}</td><td>${escapeHtml(guardian?.mobile_number || "—")}</td><td>${escapeHtml(guardian?.email || "—")}</td><td>${link.is_primary_contact ? "Primary" : ""}${link.is_emergency_contact ? "<br>Emergency" : ""}${link.authorised_to_collect ? "<br>Collect" : ""}</td></tr>`;
  }).join("");
  const noteRows = data.notes.map(note => `<tr><td>${formatDate(note.note_date)}</td><td>${escapeHtml(note.note_type)}</td><td>${escapeHtml(note.note_text)}</td><td>${escapeHtml(note.visibility.replaceAll("_", " "))}</td></tr>`).join("");
  const alertRows = data.alerts.map(alert => `<tr><td>${statusBadge(alert.severity)}</td><td><strong>${escapeHtml(alert.short_warning)}</strong><div class="record-meta">${escapeHtml(alert.safety_instruction || "")}</div></td><td>${formatDate(alert.active_from)} – ${formatDate(alert.active_until)}</td><td>${alert.show_on_attendance ? "Shown on attendance" : "Hidden from attendance"}</td></tr>`).join("");
  const emergencyRows = data.emergency.map(contact => `<tr><td>${contact.priority_order}</td><td>${escapeHtml(contact.contact_name)}</td><td>${escapeHtml(contact.relationship_to_student || "—")}</td><td>${escapeHtml(contact.phone_number)}</td><td>${escapeHtml(contact.alternate_phone_number || "—")}</td></tr>`).join("");
  const medical = data.medical || {};

  openDialog({
    title: `${student.preferred_name || student.first_name} ${student.last_name}`,
    eyebrow: "Student record",
    body: `<div class="student-record-stack">
      <section class="section-card"><div class="section-card-header"><div><h3>Guardians and contacts</h3><p class="muted">Guardian relationships are linked from the family record.</p></div></div>${guardianRows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Guardian</th><th>Relationship</th><th>Mobile</th><th>Email</th><th>Permissions</th></tr></thead><tbody>${guardianRows}</tbody></table></div>` : '<div class="inline-message">No guardians are linked to this student.</div>'}</section>
      <section class="section-card"><div class="section-card-header"><div><h3>Student notes</h3></div></div><form id="studentNoteForm" class="form-grid"><label class="form-field"><span class="form-label">Note type</span><select class="select" name="type"><option value="general">General</option><option value="training">Training</option><option value="behaviour">Behaviour</option><option value="attendance">Attendance</option><option value="grading">Grading</option></select></label><label class="form-field"><span class="form-label">Visibility</span><select class="select" name="visibility"><option value="staff">Staff</option><option value="administrator">Administrator</option><option value="parent_shareable">Parent-shareable</option><option value="finance">Finance</option></select></label><label class="form-field full"><span class="form-label">Note</span><textarea class="textarea" name="text" required></textarea></label><button id="addStudentNoteButton" class="button button-primary full" type="button">Add note</button></form>${noteRows ? `<div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Visibility</th></tr></thead><tbody>${noteRows}</tbody></table></div>` : ""}</section>
      <section class="section-card medical-panel"><div class="section-card-header"><div><h3>Protected medical information</h3><p class="muted">Only authorised roles with medical access can view or change this section.</p></div></div><form id="medicalForm" class="form-grid"><label class="form-field"><span class="form-label">Allergies</span><textarea class="textarea" name="allergies">${escapeHtml(medical.allergies || "")}</textarea></label><label class="form-field"><span class="form-label">Medical conditions</span><textarea class="textarea" name="conditions">${escapeHtml(medical.relevant_medical_conditions || "")}</textarea></label><label class="form-field"><span class="form-label">Medication</span><textarea class="textarea" name="medication">${escapeHtml(medical.medication_information || "")}</textarea></label><label class="form-field"><span class="form-label">Injuries</span><textarea class="textarea" name="injuries">${escapeHtml(medical.injuries || "")}</textarea></label><label class="form-field"><span class="form-label">Physical limitations</span><textarea class="textarea" name="limitations">${escapeHtml(medical.physical_limitations || "")}</textarea></label><label class="form-field"><span class="form-label">Guardian safety instructions</span><textarea class="textarea" name="guardianInstructions">${escapeHtml(medical.guardian_safety_instructions || "")}</textarea></label><label class="form-field full"><span class="form-label">Important safety notes</span><textarea class="textarea" name="safetyNotes">${escapeHtml(medical.important_safety_notes || "")}</textarea></label><label class="form-field"><span class="form-label">Reviewed on</span><input class="input" type="date" name="reviewedOn" value="${medical.reviewed_on || ""}"></label><button id="saveMedicalButton" class="button button-primary full" type="button">Save medical information</button></form></section>
      <section class="section-card"><div class="section-card-header"><div><h3>Class safety alerts</h3><p class="muted">Short active warnings can be displayed on attendance screens without showing full medical details.</p></div></div><form id="safetyAlertForm" class="form-grid"><label class="form-field"><span class="form-label">Alert type</span><input class="input" name="type" required placeholder="Allergy, injury, limitation..."></label><label class="form-field"><span class="form-label">Severity</span><select class="select" name="severity"><option value="information">Information</option><option value="important" selected>Important</option><option value="urgent">Urgent</option></select></label><label class="form-field full"><span class="form-label">Short warning</span><input class="input" name="warning" required></label><label class="form-field full"><span class="form-label">Safety instruction</span><textarea class="textarea" name="instruction"></textarea></label><label class="form-field"><span class="form-label">Active from</span><input class="input" type="date" name="from" value="${todayIso()}"></label><label class="form-field"><span class="form-label">Active until</span><input class="input" type="date" name="until"></label><label class="checkbox-row full"><input type="checkbox" name="showAttendance" checked><span>Show this warning on attendance</span></label><button id="addSafetyAlertButton" class="button button-primary full" type="button">Add safety alert</button></form>${alertRows ? `<div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Severity</th><th>Warning</th><th>Active</th><th>Attendance</th></tr></thead><tbody>${alertRows}</tbody></table></div>` : ""}</section>
      <section class="section-card"><div class="section-card-header"><div><h3>Emergency contacts</h3></div></div><form id="emergencyForm" class="form-grid"><label class="form-field"><span class="form-label">Contact name</span><input class="input" name="name" required></label><label class="form-field"><span class="form-label">Relationship</span><input class="input" name="relationship"></label><label class="form-field"><span class="form-label">Phone</span><input class="input" name="phone" required></label><label class="form-field"><span class="form-label">Alternate phone</span><input class="input" name="alternate"></label><label class="form-field"><span class="form-label">Priority</span><input class="input" type="number" min="1" name="priority" value="${data.emergency.length + 1}"></label><button id="addEmergencyButton" class="button button-primary full" type="button">Add emergency contact</button></form>${emergencyRows ? `<div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Priority</th><th>Name</th><th>Relationship</th><th>Phone</th><th>Alternate</th></tr></thead><tbody>${emergencyRows}</tbody></table></div>` : ""}</section>
    </div>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Close</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("addStudentNoteButton").addEventListener("click", event => addNote(event, student));
  document.getElementById("saveMedicalButton").addEventListener("click", event => saveMedical(event, student, medical));
  document.getElementById("addSafetyAlertButton").addEventListener("click", event => addSafetyAlert(event, student));
  document.getElementById("addEmergencyButton").addEventListener("click", event => addEmergency(event, student));
}

async function addNote(event, student) {
  const form = document.getElementById("studentNoteForm"); if (!form.reportValidity()) return; setButtonBusy(event.currentTarget, true);
  try { const data = new FormData(form), supabase = getSupabaseClient(); const { error } = await supabase.from("student_notes").insert({ student_id: student.id, note_type: data.get("type"), note_text: normaliseText(data.get("text")), visibility: data.get("visibility"), note_date: todayIso() }); if (error) throw error; notifySuccess("Student note added."); await openStudentRecords(student); }
  catch (error) { notifyError(error); } finally { setButtonBusy(event.currentTarget, false); }
}
async function saveMedical(event, student, medical) {
  const form = document.getElementById("medicalForm"); if (!form.reportValidity()) return; setButtonBusy(event.currentTarget, true);
  try { const data = new FormData(form), row = { student_id: student.id, allergies: normaliseText(data.get("allergies")) || null, relevant_medical_conditions: normaliseText(data.get("conditions")) || null, medication_information: normaliseText(data.get("medication")) || null, injuries: normaliseText(data.get("injuries")) || null, physical_limitations: normaliseText(data.get("limitations")) || null, guardian_safety_instructions: normaliseText(data.get("guardianInstructions")) || null, important_safety_notes: normaliseText(data.get("safetyNotes")) || null, reviewed_on: data.get("reviewedOn") || null }; const supabase = getSupabaseClient(); const result = medical.id ? await supabase.from("student_medical_information").update(row).eq("id", medical.id) : await supabase.from("student_medical_information").insert(row); if (result.error) throw result.error; notifySuccess("Medical information saved."); await openStudentRecords(student); }
  catch (error) { notifyError(error); } finally { setButtonBusy(event.currentTarget, false); }
}
async function addSafetyAlert(event, student) {
  const form = document.getElementById("safetyAlertForm"); if (!form.reportValidity()) return; setButtonBusy(event.currentTarget, true);
  try { const data = new FormData(form), supabase = getSupabaseClient(); const { error } = await supabase.from("student_safety_alerts").insert({ student_id: student.id, alert_type: normaliseText(data.get("type")), short_warning: normaliseText(data.get("warning")), safety_instruction: normaliseText(data.get("instruction")) || null, severity: data.get("severity"), show_on_attendance: data.get("showAttendance") === "on", active_from: data.get("from") || todayIso(), active_until: data.get("until") || null, is_active: true }); if (error) throw error; notifySuccess("Safety alert added."); await openStudentRecords(student); }
  catch (error) { notifyError(error); } finally { setButtonBusy(event.currentTarget, false); }
}
async function addEmergency(event, student) {
  const form = document.getElementById("emergencyForm"); if (!form.reportValidity()) return; setButtonBusy(event.currentTarget, true);
  try { const data = new FormData(form), supabase = getSupabaseClient(); const { error } = await supabase.from("student_emergency_contacts").insert({ student_id: student.id, contact_name: normaliseText(data.get("name")), relationship_to_student: normaliseText(data.get("relationship")) || null, phone_number: normaliseText(data.get("phone")), alternate_phone_number: normaliseText(data.get("alternate")) || null, priority_order: Number(data.get("priority")) || 1 }); if (error) throw error; notifySuccess("Emergency contact added."); await openStudentRecords(student); }
  catch (error) { notifyError(error); } finally { setButtonBusy(event.currentTarget, false); }
}
