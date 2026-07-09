import { getSupabaseClient } from "./database.js?v=1.1.0";
import { dispatchDataChanged, formatCurrency, formatDate, normaliseText, parseMoney, todayIso } from "./utilities.js?v=1.1.0";
import {
  closeDialog, emptyState, escapeHtml, moduleHeader, notifyError,
  notifySuccess, openDialog, setButtonBusy, statusBadge
} from "./ui.js?v=1.1.0";

let state = { events: [], records: [], students: [], belts: [], feeSchedules: [], feeItems: [] };

export async function renderGradings(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("grading_events").select("*").is("deleted_at", null).order("grading_date", { ascending: false }),
    supabase.from("grading_records").select("*").is("deleted_at", null).order("grading_date", { ascending: false }).limit(150),
    supabase.from("students").select("id,student_number,first_name,last_name,preferred_name,family_id,current_belt_rank_id,status").is("deleted_at", null).order("last_name"),
    supabase.from("belt_ranks").select("*").eq("is_active", true).order("rank_order"),
    supabase.from("fee_schedules").select("*").is("deleted_at", null).order("version_number", { ascending: false }),
    supabase.from("fee_schedule_items").select("*").is("deleted_at", null).order("fee_name")
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.events, state.records, state.students, state.belts, state.feeSchedules, state.feeItems] = results.map(result => result.data || []);
}

function render(container) {
  const studentMap = new Map(state.students.map(student => [student.id, student]));
  const beltMap = new Map(state.belts.map(belt => [belt.id, `${belt.belt_colour} · ${belt.rank_name}`]));
  const eventMap = new Map(state.events.map(event => [event.id, event]));

  const eventRows = state.events.map(event => {
    const count = state.records.filter(record => record.grading_event_id === event.id).length;
    return `<tr><td><strong>${formatDate(event.grading_date)}</strong></td><td>${escapeHtml(event.grading_location || "—")}</td><td>${escapeHtml(event.examiner || "—")}</td><td>${count}</td><td class="table-actions"><button class="button button-primary button-small" data-action="add-result" data-id="${event.id}">Add result</button><button class="button button-secondary button-small" data-action="edit-event" data-id="${event.id}">Edit</button></td></tr>`;
  }).join("");

  const recordRows = state.records.map(record => {
    const student = studentMap.get(record.student_id);
    const event = eventMap.get(record.grading_event_id);
    return `<tr>
      <td><strong>${escapeHtml(student ? `${student.preferred_name || student.first_name} ${student.last_name}` : "Unknown student")}</strong><div class="record-meta">${escapeHtml(student?.student_number || "")}</div></td>
      <td>${formatDate(record.grading_date)}<div class="record-meta">${escapeHtml(event?.grading_location || record.grading_location || "")}</div></td>
      <td>${escapeHtml(beltMap.get(record.previous_belt_rank_id) || "—")}</td>
      <td>${escapeHtml(beltMap.get(record.new_belt_rank_id) || "—")}</td>
      <td>${statusBadge(record.result)}</td>
      <td>${record.grading_fee == null ? "—" : formatCurrency(record.grading_fee)}</td>
      <td>${record.certificate_received ? "Certificate ✓" : ""}${record.belt_received ? "<br>Belt ✓" : ""}${record.jka_passport_updated ? "<br>Passport ✓" : ""}</td>
      <td class="table-actions"><button class="button button-secondary button-small" data-action="edit-result" data-id="${record.id}">Edit</button></td>
    </tr>`;
  }).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "Development", title: "Gradings", description: "Plan grading events, record results, update belt history and create grading charges.", actions: '<button id="addGradingEventButton" class="button button-secondary" type="button">Add grading event</button><button id="addGradingResultButton" class="button button-primary" type="button">Add result</button>' })}
    <section class="section-card"><div class="section-card-header"><div><h3>Grading events</h3><p class="muted">Events provide shared dates, locations and examiners.</p></div></div>${state.events.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Location</th><th>Examiner</th><th>Students</th><th>Actions</th></tr></thead><tbody id="gradingEventRows">${eventRows}</tbody></table></div>` : emptyState("No grading events", "Create an event or record an individual grading result.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Grading records</h3><p class="muted">Passed and approved results update the student's current belt.</p></div></div>${state.records.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Student</th><th>Date</th><th>Previous</th><th>New belt</th><th>Result</th><th>Fee</th><th>Documents</th><th>Actions</th></tr></thead><tbody id="gradingRecordRows">${recordRows}</tbody></table></div>` : emptyState("No grading results", "Add a result when a student grades.")}</section>
  </div>`;

  container.querySelector("#addGradingEventButton").addEventListener("click", () => openEventDialog());
  container.querySelector("#addGradingResultButton").addEventListener("click", () => openRecordDialog());
  container.querySelector("#gradingEventRows")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const gradingEvent = state.events.find(item => item.id === button.dataset.id);
    if (button.dataset.action === "add-result") openRecordDialog(null, gradingEvent);
    if (button.dataset.action === "edit-event") openEventDialog(gradingEvent);
  });
  container.querySelector("#gradingRecordRows")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-action='edit-result']"); if (!button) return;
    const record = state.records.find(item => item.id === button.dataset.id); if (record) openRecordDialog(record);
  });
}

function openEventDialog(event = null) {
  openDialog({
    title: event ? "Edit grading event" : "Add grading event", eyebrow: "Development",
    body: `<form id="gradingEventForm" class="form-grid"><input type="hidden" name="id" value="${event?.id || ""}"><label class="form-field"><span class="form-label">Date</span><input class="input" type="date" name="date" required value="${event?.grading_date || todayIso()}"></label><label class="form-field"><span class="form-label">Location</span><input class="input" name="location" value="${escapeHtml(event?.grading_location || "")}"></label><label class="form-field full"><span class="form-label">Examiner</span><input class="input" name="examiner" value="${escapeHtml(event?.examiner || "")}"></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(event?.notes || "")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveGradingEventButton" class="button button-primary" type="button">${event ? "Save changes" : "Create event"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveGradingEventButton").addEventListener("click", saveEvent);
}

async function saveEvent(event) {
  const button = event.currentTarget, form = document.getElementById("gradingEventForm");
  if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id");
    const row = { grading_date: data.get("date"), grading_location: normaliseText(data.get("location")) || null, examiner: normaliseText(data.get("examiner")) || null, notes: normaliseText(data.get("notes")) || null };
    const supabase = getSupabaseClient();
    const result = id ? await supabase.from("grading_events").update(row).eq("id", id) : await supabase.from("grading_events").insert(row);
    if (result.error) throw result.error;
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Grading event updated." : "Grading event created.");
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function openRecordDialog(record = null, gradingEvent = null) {
  const student = record ? state.students.find(item => item.id === record.student_id) : null;
  const event = gradingEvent || (record ? state.events.find(item => item.id === record.grading_event_id) : null);
  const activeSchedule = state.feeSchedules.find(item => item.status === "active");
  const gradingFees = state.feeItems.filter(item => item.fee_schedule_id === activeSchedule?.id && item.fee_type === "grading_fee" && item.is_active);
  const currentBeltId = record?.previous_belt_rank_id || student?.current_belt_rank_id || "";

  openDialog({
    title: record ? "Edit grading result" : "Add grading result", eyebrow: "Development",
    body: `<form id="gradingRecordForm" class="form-grid"><input type="hidden" name="id" value="${record?.id || ""}">
      <label class="form-field"><span class="form-label">Student</span><select id="gradingStudent" class="select" name="studentId" required><option value="">Select student</option>${state.students.filter(item => ["active","trial","paused"].includes(item.status)).map(item => `<option value="${item.id}" ${record?.student_id === item.id ? "selected" : ""}>${escapeHtml(`${item.preferred_name || item.first_name} ${item.last_name}`)}</option>`).join("")}</select></label>
      <label class="form-field"><span class="form-label">Grading event</span><select id="gradingEvent" class="select" name="eventId"><option value="">Individual grading</option>${state.events.map(item => `<option value="${item.id}" ${event?.id === item.id ? "selected" : ""}>${formatDate(item.grading_date)} · ${escapeHtml(item.grading_location || "")}</option>`).join("")}</select></label>
      <label class="form-field"><span class="form-label">Grading date</span><input id="gradingDate" class="input" type="date" name="date" required value="${record?.grading_date || event?.grading_date || todayIso()}"></label>
      <label class="form-field"><span class="form-label">Location</span><input id="gradingLocation" class="input" name="location" value="${escapeHtml(record?.grading_location || event?.grading_location || "")}"></label>
      <label class="form-field"><span class="form-label">Examiner</span><input id="gradingExaminer" class="input" name="examiner" value="${escapeHtml(record?.examiner || event?.examiner || "")}"></label>
      <label class="form-field"><span class="form-label">Result</span><select class="select" name="result">${["pending","passed","failed","deferred","withdrawn"].map(value => `<option value="${value}" ${record?.result === value || (!record && value === "pending") ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="form-field"><span class="form-label">Previous belt</span><select id="previousBelt" class="select" name="previousBeltId"><option value="">Not recorded</option>${state.belts.map(belt => `<option value="${belt.id}" ${currentBeltId === belt.id ? "selected" : ""}>${escapeHtml(`${belt.belt_colour} · ${belt.rank_name}`)}</option>`).join("")}</select></label>
      <label class="form-field"><span class="form-label">New belt</span><select class="select" name="newBeltId"><option value="">Not recorded</option>${state.belts.map(belt => `<option value="${belt.id}" ${record?.new_belt_rank_id === belt.id ? "selected" : ""}>${escapeHtml(`${belt.belt_colour} · ${belt.rank_name}`)}</option>`).join("")}</select></label>
      <label class="form-field"><span class="form-label">Grading fee</span><input id="gradingFee" class="input" type="number" min="0" step="0.01" name="fee" value="${record?.grading_fee ?? ""}"></label>
      <label class="form-field"><span class="form-label">Fee preset</span><select id="gradingFeePreset" class="select"><option value="">Manual fee</option>${gradingFees.map(item => `<option value="${item.amount}" data-item-id="${item.id}">${escapeHtml(item.fee_name)} · ${formatCurrency(item.amount)}</option>`).join("")}</select></label>
      <label class="checkbox-row"><input type="checkbox" name="approved" ${record?.instructor_approved ? "checked" : ""}><span>Instructor approved</span></label>
      <label class="checkbox-row"><input type="checkbox" name="createCharge" ${record?.financial_charge_id ? "disabled" : ""}><span>Create grading charge</span></label>
      <label class="checkbox-row"><input type="checkbox" name="certificate" ${record?.certificate_received ? "checked" : ""}><span>Certificate received</span></label>
      <label class="checkbox-row"><input type="checkbox" name="beltReceived" ${record?.belt_received ? "checked" : ""}><span>Belt received</span></label>
      <label class="checkbox-row"><input type="checkbox" name="passport" ${record?.jka_passport_updated ? "checked" : ""}><span>JKA passport updated</span></label>
      <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(record?.notes || "")}</textarea></label>
    </form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveGradingRecordButton" class="button button-primary" type="button">${record ? "Save changes" : "Save result"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("gradingStudent").addEventListener("change", event => {
    const selected = state.students.find(item => item.id === event.target.value);
    document.getElementById("previousBelt").value = selected?.current_belt_rank_id || "";
  });
  document.getElementById("gradingEvent").addEventListener("change", event => {
    const selected = state.events.find(item => item.id === event.target.value);
    if (!selected) return;
    document.getElementById("gradingDate").value = selected.grading_date;
    document.getElementById("gradingLocation").value = selected.grading_location || "";
    document.getElementById("gradingExaminer").value = selected.examiner || "";
  });
  document.getElementById("gradingFeePreset").addEventListener("change", event => {
    if (event.target.value) document.getElementById("gradingFee").value = Number(event.target.value).toFixed(2);
  });
  document.getElementById("saveGradingRecordButton").addEventListener("click", saveRecord);
}

async function saveRecord(event) {
  const button = event.currentTarget, form = document.getElementById("gradingRecordForm");
  if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), resultValue = data.get("result"), approved = data.get("approved") === "on";
    const row = {
      grading_event_id: data.get("eventId") || null,
      student_id: data.get("studentId"),
      previous_belt_rank_id: data.get("previousBeltId") || null,
      new_belt_rank_id: data.get("newBeltId") || null,
      grading_date: data.get("date"),
      grading_location: normaliseText(data.get("location")) || null,
      examiner: normaliseText(data.get("examiner")) || null,
      result: resultValue,
      grading_fee: data.get("fee") === "" ? null : parseMoney(data.get("fee")),
      certificate_received: data.get("certificate") === "on",
      belt_received: data.get("beltReceived") === "on",
      jka_passport_updated: data.get("passport") === "on",
      notes: normaliseText(data.get("notes")) || null,
      instructor_approved: approved,
      approved_at: approved ? new Date().toISOString() : null
    };
    const supabase = getSupabaseClient();
    let recordId = id;
    if (id) {
      const { error } = await supabase.from("grading_records").update(row).eq("id", id); if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase.from("grading_records").insert(row).select("id").single(); if (error) throw error; recordId = inserted.id;
    }

    if (data.get("createCharge") === "on" && row.grading_fee > 0) {
      const student = state.students.find(item => item.id === row.student_id);
      const activeSchedule = state.feeSchedules.find(item => item.status === "active");
      const preset = document.getElementById("gradingFeePreset")?.selectedOptions[0];
      const feeItem = state.feeItems.find(item => item.id === preset?.dataset.itemId);
      const { data: chargeNumber, error: numberError } = await supabase.rpc("next_charge_number", { p_charge_date: row.grading_date }); if (numberError) throw numberError;
      const { data: charge, error: chargeError } = await supabase.from("charges").insert({
        charge_number: chargeNumber, student_id: row.student_id, family_id: student?.family_id || null,
        grading_record_id: recordId, fee_schedule_id: activeSchedule?.id || null, fee_schedule_item_id: feeItem?.id || null,
        fee_type: "grading_fee", description: feeItem?.fee_name || "Karate grading fee", charge_date: row.grading_date,
        original_amount: row.grading_fee, discount_amount: 0, final_amount: row.grading_fee, status: "unpaid",
        reason_for_charge: "Confirmed grading fee", confirmed_at: new Date().toISOString()
      }).select("id").single();
      if (chargeError) throw chargeError;
      await supabase.from("grading_records").update({ financial_charge_id: charge.id, fee_payment_status: "unpaid" }).eq("id", recordId);
    }

    if (resultValue === "passed" && approved && row.new_belt_rank_id) {
      const { error } = await supabase.from("students").update({ current_belt_rank_id: row.new_belt_rank_id }).eq("id", row.student_id); if (error) throw error;
    }

    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Grading result updated." : "Grading result saved."); dispatchDataChanged({ module: "gradings" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}
