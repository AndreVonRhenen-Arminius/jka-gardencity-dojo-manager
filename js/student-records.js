import { getSupabaseClient } from "./database.js?v=1.3.0";
import {
  datePlusDays,
  formatDate,
  normaliseText,
  todayIso
} from "./utilities.js?v=1.3.0";
import {
  closeDialog,
  escapeHtml,
  notifyError,
  notifySuccess,
  openDialog,
  setButtonBusy,
  statusBadge
} from "./ui.js?v=1.3.0";

export async function openStudentRecords(studentReference) {
  try {
    const studentId = typeof studentReference === "string" ? studentReference : studentReference.id;
    const data = await loadStudentRecords(studentId);
    renderStudentRecords(data.student, data);
  } catch (error) {
    notifyError(error);
  }
}

async function loadStudentRecords(studentId) {
  const supabase = getSupabaseClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();
  if (studentError) throw studentError;

  const results = await Promise.all([
    supabase.from("student_guardians").select("*").eq("student_id", studentId),
    supabase.from("guardians").select("*").is("deleted_at", null),
    supabase.from("student_notes").select("*").eq("student_id", studentId).is("deleted_at", null).order("note_date", { ascending: false }),
    supabase.from("student_emergency_contacts").select("*").eq("student_id", studentId).is("deleted_at", null).order("priority_order"),
    supabase.from("student_medical_information").select("*").eq("student_id", studentId).is("deleted_at", null).maybeSingle(),
    supabase.from("student_safety_alerts").select("*").eq("student_id", studentId).is("deleted_at", null).order("active_from", { ascending: false }),
    student.family_id
      ? supabase.from("families").select("*").eq("id", student.family_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  for (const result of results) if (result.error) throw result.error;

  return {
    student,
    links: results[0].data || [],
    guardians: results[1].data || [],
    notes: results[2].data || [],
    emergency: results[3].data || [],
    medical: results[4].data || null,
    alerts: results[5].data || [],
    family: results[6].data || null
  };
}

function renderStudentRecords(student, data) {
  const guardianMap = new Map(data.guardians.map(item => [item.id, item]));
  const primaryLink = data.links.find(link => link.is_primary_contact) || data.links[0] || null;
  const primaryGuardian = primaryLink ? guardianMap.get(primaryLink.guardian_id) || null : null;
  const completeness = buildCompleteness(student, data.family, primaryGuardian, data);
  const draft = buildMissingInfoDraft(student, primaryGuardian, completeness.missingParentItems);

  const guardianRows = data.links.map(link => {
    const guardian = guardianMap.get(link.guardian_id);
    return `
      <tr>
        <td>${escapeHtml(guardian?.full_name || "Unknown guardian")}</td>
        <td>${escapeHtml(link.relationship_to_student || "Guardian")}</td>
        <td>${escapeHtml(guardian?.mobile_number || "—")}</td>
        <td>${escapeHtml(guardian?.email || "—")}</td>
        <td>${link.is_primary_contact ? "Primary" : ""}${link.is_emergency_contact ? "<br>Emergency" : ""}${link.authorised_to_collect ? "<br>Collect" : ""}</td>
      </tr>`;
  }).join("");

  const noteRows = data.notes.map(note => `
    <tr>
      <td>${formatDate(note.note_date)}</td>
      <td>${escapeHtml(note.note_type)}</td>
      <td>${escapeHtml(note.note_text)}</td>
      <td>${escapeHtml(note.visibility.replaceAll("_", " "))}</td>
    </tr>`).join("");

  const alertRows = data.alerts.map(alert => `
    <tr>
      <td>${statusBadge(alert.severity)}</td>
      <td><strong>${escapeHtml(alert.short_warning)}</strong><div class="record-meta">${escapeHtml(alert.safety_instruction || "")}</div></td>
      <td>${formatDate(alert.active_from)} – ${formatDate(alert.active_until)}</td>
      <td>${alert.show_on_attendance ? "Shown on attendance" : "Hidden from attendance"}</td>
    </tr>`).join("");

  const emergencyRows = data.emergency.map(contact => `
    <tr>
      <td>${contact.priority_order}</td>
      <td>${escapeHtml(contact.contact_name)}</td>
      <td>${escapeHtml(contact.relationship_to_student || "—")}</td>
      <td>${escapeHtml(contact.phone_number)}</td>
      <td>${escapeHtml(contact.alternate_phone_number || "—")}</td>
    </tr>`).join("");

  const medical = data.medical || {};
  const missingList = completeness.missing.length
    ? completeness.missing.map(item => `<li><span class="missing-dot"></span>${escapeHtml(item.label)}</li>`).join("")
    : '<li class="complete-line">✓ Core student profile is complete.</li>';

  const draftSection = completeness.missingParentItems.length ? `
    <div class="email-draft-panel">
      <div class="email-draft-meta">
        <div><span>To</span><strong>${escapeHtml(draft.recipient || "No guardian email recorded")}</strong></div>
        <div><span>Subject</span><strong>${escapeHtml(draft.subject)}</strong></div>
      </div>
      <textarea id="missingInfoEmailBody" class="textarea email-draft-text" readonly>${escapeHtml(draft.body)}</textarea>
      <div class="module-actions">
        <button id="copyMissingInfoEmailButton" class="button button-secondary" type="button">Copy email draft</button>
        <button id="openMissingInfoEmailButton" class="button button-primary" type="button">Open in email app</button>
        <button id="logMissingInfoRequestButton" class="button button-secondary" type="button">Log request & follow-up</button>
      </div>
      ${draft.recipient ? "" : '<p class="form-help">A guardian email address is missing. Copy the draft and send it through another confirmed contact method, or update the master record first.</p>'}
    </div>` : '<div class="inline-message success">No missing parent-supplied information was detected, so no email draft is required.</div>';

  openDialog({
    title: `${student.preferred_name || student.first_name} ${student.last_name}`,
    eyebrow: "Student Hub profile",
    body: `
      <div class="student-record-stack">
        <section class="section-card profile-completeness-card">
          <div class="section-card-header">
            <div>
              <h3>Profile completeness and missing-information email</h3>
              <p class="muted">The master record is edited in Student Hub. This section checks linked information and drafts a parent or guardian email automatically.</p>
            </div>
            <div class="profile-score ${completeness.percent === 100 ? "complete" : ""}">${completeness.percent}%</div>
          </div>
          <div class="profile-completeness-layout">
            <div>
              <h4>Missing or unconfirmed</h4>
              <ul class="missing-info-list">${missingList}</ul>
              <button id="editMasterRecordButton" class="button button-secondary" type="button">Edit master record</button>
            </div>
            <div>
              <h4>Automatic email draft</h4>
              ${draftSection}
            </div>
          </div>
        </section>

        <section class="section-card">
          <div class="section-card-header">
            <div><h3>Guardians and contacts</h3><p class="muted">Guardian identity and contact details are linked from the family record and edited through Student Hub.</p></div>
          </div>
          ${guardianRows ? `
            <div class="table-wrap"><table class="data-table">
              <thead><tr><th>Guardian</th><th>Relationship</th><th>Mobile</th><th>Email</th><th>Permissions</th></tr></thead>
              <tbody>${guardianRows}</tbody>
            </table></div>` : '<div class="inline-message">No guardians are linked to this student.</div>'}
        </section>

        <section class="section-card">
          <div class="section-card-header"><div><h3>Student notes</h3></div></div>
          <form id="studentNoteForm" class="form-grid">
            <label class="form-field"><span class="form-label">Note type</span><select class="select" name="type"><option value="general">General</option><option value="training">Training</option><option value="behaviour">Behaviour</option><option value="attendance">Attendance</option><option value="grading">Grading</option></select></label>
            <label class="form-field"><span class="form-label">Visibility</span><select class="select" name="visibility"><option value="staff">Staff</option><option value="administrator">Administrator</option><option value="parent_shareable">Parent-shareable</option><option value="finance">Finance</option></select></label>
            <label class="form-field full"><span class="form-label">Note</span><textarea class="textarea" name="text" required></textarea></label>
            <button id="addStudentNoteButton" class="button button-primary full" type="button">Add note</button>
          </form>
          ${noteRows ? `<div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Visibility</th></tr></thead><tbody>${noteRows}</tbody></table></div>` : ""}
        </section>

        <section class="section-card medical-panel">
          <div class="section-card-header"><div><h3>Protected medical information</h3><p class="muted">Only authorised roles with medical access can view or change this section. Use Reviewed on to record confirmation that no conditions apply.</p></div></div>
          <form id="medicalForm" class="form-grid">
            <label class="form-field"><span class="form-label">Allergies</span><textarea class="textarea" name="allergies">${escapeHtml(medical.allergies || "")}</textarea></label>
            <label class="form-field"><span class="form-label">Medical conditions</span><textarea class="textarea" name="conditions">${escapeHtml(medical.relevant_medical_conditions || "")}</textarea></label>
            <label class="form-field"><span class="form-label">Medication</span><textarea class="textarea" name="medication">${escapeHtml(medical.medication_information || "")}</textarea></label>
            <label class="form-field"><span class="form-label">Injuries</span><textarea class="textarea" name="injuries">${escapeHtml(medical.injuries || "")}</textarea></label>
            <label class="form-field"><span class="form-label">Physical limitations</span><textarea class="textarea" name="limitations">${escapeHtml(medical.physical_limitations || "")}</textarea></label>
            <label class="form-field"><span class="form-label">Guardian safety instructions</span><textarea class="textarea" name="guardianInstructions">${escapeHtml(medical.guardian_safety_instructions || "")}</textarea></label>
            <label class="form-field full"><span class="form-label">Important safety notes</span><textarea class="textarea" name="safetyNotes">${escapeHtml(medical.important_safety_notes || "")}</textarea></label>
            <label class="form-field"><span class="form-label">Reviewed on</span><input class="input" type="date" name="reviewedOn" value="${medical.reviewed_on || ""}"></label>
            <button id="saveMedicalButton" class="button button-primary full" type="button">Save medical information</button>
          </form>
        </section>

        <section class="section-card">
          <div class="section-card-header"><div><h3>Class safety alerts</h3><p class="muted">Short active warnings can be displayed on attendance screens without showing full medical details.</p></div></div>
          <form id="safetyAlertForm" class="form-grid">
            <label class="form-field"><span class="form-label">Alert type</span><input class="input" name="type" required placeholder="Allergy, injury, limitation..."></label>
            <label class="form-field"><span class="form-label">Severity</span><select class="select" name="severity"><option value="information">Information</option><option value="important" selected>Important</option><option value="urgent">Urgent</option></select></label>
            <label class="form-field full"><span class="form-label">Short warning</span><input class="input" name="warning" required></label>
            <label class="form-field full"><span class="form-label">Safety instruction</span><textarea class="textarea" name="instruction"></textarea></label>
            <label class="form-field"><span class="form-label">Active from</span><input class="input" type="date" name="from" value="${todayIso()}"></label>
            <label class="form-field"><span class="form-label">Active until</span><input class="input" type="date" name="until"></label>
            <label class="checkbox-row full"><input type="checkbox" name="showAttendance" checked><span>Show this warning on attendance</span></label>
            <button id="addSafetyAlertButton" class="button button-primary full" type="button">Add safety alert</button>
          </form>
          ${alertRows ? `<div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Severity</th><th>Warning</th><th>Active</th><th>Attendance</th></tr></thead><tbody>${alertRows}</tbody></table></div>` : ""}
        </section>

        <section class="section-card">
          <div class="section-card-header"><div><h3>Emergency contacts</h3></div></div>
          <form id="emergencyForm" class="form-grid">
            <label class="form-field"><span class="form-label">Contact name</span><input class="input" name="name" required></label>
            <label class="form-field"><span class="form-label">Relationship</span><input class="input" name="relationship"></label>
            <label class="form-field"><span class="form-label">Phone</span><input class="input" name="phone" required></label>
            <label class="form-field"><span class="form-label">Alternate phone</span><input class="input" name="alternate"></label>
            <label class="form-field"><span class="form-label">Priority</span><input class="input" type="number" min="1" name="priority" value="${data.emergency.length + 1}"></label>
            <button id="addEmergencyButton" class="button button-primary full" type="button">Add emergency contact</button>
          </form>
          ${emergencyRows ? `<div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Priority</th><th>Name</th><th>Relationship</th><th>Phone</th><th>Alternate</th></tr></thead><tbody>${emergencyRows}</tbody></table></div>` : ""}
        </section>
      </div>`,
    footer: '<button class="button button-secondary" type="button" data-close-dialog>Close</button>'
  });

  const dialog = document.getElementById("appDialog");
  dialog.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  dialog.querySelector("#editMasterRecordButton").addEventListener("click", () => openMasterEditor(student.id));
  dialog.querySelector("#copyMissingInfoEmailButton")?.addEventListener("click", () => copyDraft(draft));
  dialog.querySelector("#openMissingInfoEmailButton")?.addEventListener("click", () => openDraftInEmail(draft));
  dialog.querySelector("#logMissingInfoRequestButton")?.addEventListener("click", event => logMissingInfoRequest(event, student, data.family, primaryGuardian, draft, completeness));
  dialog.querySelector("#addStudentNoteButton").addEventListener("click", event => addNote(event, student));
  dialog.querySelector("#saveMedicalButton").addEventListener("click", event => saveMedical(event, student, medical));
  dialog.querySelector("#addSafetyAlertButton").addEventListener("click", event => addSafetyAlert(event, student));
  dialog.querySelector("#addEmergencyButton").addEventListener("click", event => addEmergency(event, student));
}

function buildCompleteness(student, family, guardian, data) {
  const checks = [
    { key: "dob", label: "Student date of birth", complete: Boolean(student.date_of_birth), parent: true },
    { key: "school", label: "School", complete: Boolean(student.school), parent: true },
    { key: "family", label: "Linked family record", complete: Boolean(family?.id), parent: false },
    { key: "address", label: "Home address and postcode", complete: Boolean(family?.address_line_1 && family?.postcode), parent: true },
    { key: "guardian", label: "Primary guardian name", complete: Boolean(guardian?.full_name), parent: true },
    { key: "email", label: "Primary guardian email", complete: Boolean(guardian?.email), parent: true },
    { key: "mobile", label: "Primary guardian mobile number", complete: Boolean(guardian?.mobile_number), parent: true },
    { key: "emergency", label: "Emergency contact", complete: data.emergency.length > 0, parent: true },
    { key: "medical", label: "Medical and safety information, or confirmation that none applies", complete: Boolean(data.medical?.reviewed_on), parent: true },
    { key: "consent", label: "Completed consent forms", complete: Boolean(student.consent_forms_received), parent: true },
    { key: "terms", label: "Accepted dojo terms", complete: Boolean(student.terms_accepted), parent: true },
    { key: "photo", label: "Photography consent decision", complete: Boolean(student.photography_consent_date), parent: true },
    { key: "membership", label: "JKA membership number, if already issued", complete: Boolean(student.jka_membership_number), parent: true },
    { key: "passport", label: "JKA passport number, if already issued", complete: Boolean(student.jka_passport_number), parent: true }
  ];

  const missing = checks.filter(item => !item.complete);
  return {
    checks,
    missing,
    missingParentItems: missing.filter(item => item.parent),
    percent: Math.round(((checks.length - missing.length) / checks.length) * 100)
  };
}

function buildMissingInfoDraft(student, guardian, missingItems) {
  const studentName = `${student.preferred_name || student.first_name} ${student.last_name}`;
  const guardianFirstName = guardian?.full_name?.split(/\s+/)[0] || "there";
  const bulletList = missingItems.map(item => `• ${item.label}`).join("\n");
  const subject = `Missing information for ${studentName} – JKA GardenCity`;
  const body = `Kia ora ${guardianFirstName},\n\nI am updating ${studentName}'s student record for JKA Christchurch – GardenCity. Could you please send or confirm the following information?\n\n${bulletList}\n\nPlease only include information that is current and relevant. Medical details will be stored in the protected student record and only used for student safety.\n\nNgā mihi,\nAndré Von Rhenen\nJKA Christchurch – GardenCity`;

  return {
    recipient: guardian?.email || "",
    subject,
    body
  };
}

function openMasterEditor(studentId) {
  closeDialog();
  const button = document.querySelector(`#studentRows button[data-action="edit"][data-id="${studentId}"]`);
  if (button) button.click();
  else notifyError(new Error("Return to Student Hub and select Edit master record."));
}

async function copyDraft(draft) {
  const text = `To: ${draft.recipient || "[guardian email]"}\nSubject: ${draft.subject}\n\n${draft.body}`;
  try {
    await navigator.clipboard.writeText(text);
    notifySuccess("Missing-information email draft copied.");
  } catch {
    const textarea = document.getElementById("missingInfoEmailBody");
    textarea?.select();
    document.execCommand("copy");
    notifySuccess("Email body copied.");
  }
}

function openDraftInEmail(draft) {
  if (!draft.recipient) {
    notifyError(new Error("Add the guardian email in the Student Hub master record before opening the draft in an email app."));
    return;
  }

  const mailto = `mailto:${encodeURIComponent(draft.recipient)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  window.location.href = mailto;
}

async function logMissingInfoRequest(event, student, family, guardian, draft, completeness) {
  const button = event.currentTarget;
  setButtonBusy(button, true, "Logging…");

  try {
    const supabase = getSupabaseClient();
    const summary = `Requested missing information: ${completeness.missingParentItems.map(item => item.label).join(", ")}.`;
    const followUpDate = datePlusDays(todayIso(), 7);

    const { error: communicationError } = await supabase.from("communication_history").insert({
      communication_type: draft.recipient ? "email_sent" : "follow_up_required",
      student_id: student.id,
      family_id: family?.id || null,
      guardian_id: guardian?.id || null,
      subject: draft.subject,
      summary,
      follow_up_required: true,
      follow_up_date: followUpDate
    });
    if (communicationError) throw communicationError;

    const { error: taskError } = await supabase.from("follow_up_tasks").insert({
      task_type: "missing_student_information",
      title: `Follow up missing information: ${student.preferred_name || student.first_name} ${student.last_name}`,
      description: summary,
      due_date: followUpDate,
      status: "open",
      priority: "normal",
      student_id: student.id,
      family_id: family?.id || null
    });
    if (taskError) throw taskError;

    notifySuccess(`Request logged with a follow-up due ${formatDate(followUpDate)}.`);
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function addNote(event, student) {
  const form = document.getElementById("studentNoteForm");
  if (!form.reportValidity()) return;
  setButtonBusy(event.currentTarget, true);
  try {
    const data = new FormData(form);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("student_notes").insert({
      student_id: student.id,
      note_type: data.get("type"),
      note_text: normaliseText(data.get("text")),
      visibility: data.get("visibility"),
      note_date: todayIso()
    });
    if (error) throw error;
    notifySuccess("Student note added.");
    await openStudentRecords(student.id);
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(event.currentTarget, false);
  }
}

async function saveMedical(event, student, medical) {
  const form = document.getElementById("medicalForm");
  if (!form.reportValidity()) return;
  setButtonBusy(event.currentTarget, true);
  try {
    const data = new FormData(form);
    const row = {
      student_id: student.id,
      allergies: normaliseText(data.get("allergies")) || null,
      relevant_medical_conditions: normaliseText(data.get("conditions")) || null,
      medication_information: normaliseText(data.get("medication")) || null,
      injuries: normaliseText(data.get("injuries")) || null,
      physical_limitations: normaliseText(data.get("limitations")) || null,
      guardian_safety_instructions: normaliseText(data.get("guardianInstructions")) || null,
      important_safety_notes: normaliseText(data.get("safetyNotes")) || null,
      reviewed_on: data.get("reviewedOn") || null
    };
    const supabase = getSupabaseClient();
    const result = medical.id
      ? await supabase.from("student_medical_information").update(row).eq("id", medical.id)
      : await supabase.from("student_medical_information").insert(row);
    if (result.error) throw result.error;
    notifySuccess("Medical information saved.");
    await openStudentRecords(student.id);
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(event.currentTarget, false);
  }
}

async function addSafetyAlert(event, student) {
  const form = document.getElementById("safetyAlertForm");
  if (!form.reportValidity()) return;
  setButtonBusy(event.currentTarget, true);
  try {
    const data = new FormData(form);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("student_safety_alerts").insert({
      student_id: student.id,
      alert_type: normaliseText(data.get("type")),
      short_warning: normaliseText(data.get("warning")),
      safety_instruction: normaliseText(data.get("instruction")) || null,
      severity: data.get("severity"),
      show_on_attendance: data.get("showAttendance") === "on",
      active_from: data.get("from") || todayIso(),
      active_until: data.get("until") || null,
      is_active: true
    });
    if (error) throw error;
    notifySuccess("Safety alert added.");
    await openStudentRecords(student.id);
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(event.currentTarget, false);
  }
}

async function addEmergency(event, student) {
  const form = document.getElementById("emergencyForm");
  if (!form.reportValidity()) return;
  setButtonBusy(event.currentTarget, true);
  try {
    const data = new FormData(form);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("student_emergency_contacts").insert({
      student_id: student.id,
      contact_name: normaliseText(data.get("name")),
      relationship_to_student: normaliseText(data.get("relationship")) || null,
      phone_number: normaliseText(data.get("phone")),
      alternate_phone_number: normaliseText(data.get("alternate")) || null,
      priority_order: Number(data.get("priority")) || 1
    });
    if (error) throw error;
    notifySuccess("Emergency contact added.");
    await openStudentRecords(student.id);
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(event.currentTarget, false);
  }
}
