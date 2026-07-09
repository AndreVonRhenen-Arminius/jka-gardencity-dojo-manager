import { getSupabaseClient } from "./database.js?v=1.2.0";
import {
  dispatchDataChanged,
  formatCurrency,
  formatDate,
  normaliseText,
  parseMoney,
  todayIso
} from "./utilities.js?v=1.2.0";
import {
  closeDialog,
  emptyState,
  escapeHtml,
  moduleHeader,
  notifyError,
  notifySuccess,
  openDialog,
  setButtonBusy,
  statusBadge
} from "./ui.js?v=1.2.0";
import {
  DEFAULT_FEE_SETTINGS,
  calculateStudentPricing,
  consumeReferralReward,
  normaliseBillingProfile,
  referralSummary,
  serializeBillingNotes
} from "./billing.js?v=1.2.0";

let state = {
  schedules: [],
  items: [],
  charges: [],
  students: [],
  families: [],
  terms: [],
  billingProfiles: [],
  feeSettings: DEFAULT_FEE_SETTINGS,
  outstanding: new Map()
};

export async function renderFees(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("fee_schedules").select("*").is("deleted_at", null).order("version_number", { ascending: false }),
    supabase.from("fee_schedule_items").select("*").is("deleted_at", null).order("fee_name"),
    supabase.from("charges").select("*").is("deleted_at", null).order("charge_date", { ascending: false }).limit(150),
    supabase.from("students").select("*").is("deleted_at", null).order("last_name").order("first_name"),
    supabase.from("families").select("id,family_name").is("deleted_at", null).order("family_name"),
    supabase.from("terms").select("*").is("deleted_at", null).order("start_date", { ascending: false }),
    supabase.from("student_billing_profiles").select("*").is("deleted_at", null),
    supabase.from("app_settings").select("setting_value").eq("setting_key", "fees.defaults").is("deleted_at", null).maybeSingle()
  ]);
  for (const result of results) if (result.error) throw result.error;
  [
    state.schedules,
    state.items,
    state.charges,
    state.students,
    state.families,
    state.terms,
    state.billingProfiles
  ] = results.slice(0, 7).map(result => result.data || []);
  state.feeSettings = { ...DEFAULT_FEE_SETTINGS, ...(results[7].data?.setting_value || {}) };
  state.outstanding = new Map();

  await Promise.all(state.charges.map(async charge => {
    const { data, error } = await supabase.rpc("charge_outstanding_amount", { p_charge_id: charge.id });
    if (!error) state.outstanding.set(charge.id, Number(data || 0));
  }));
}

function render(container) {
  const activeSchedule = state.schedules.find(schedule => schedule.status === "active");
  const activeItems = activeSchedule
    ? state.items.filter(item => item.fee_schedule_id === activeSchedule.id && item.is_active)
    : [];
  const studentMap = new Map(state.students.map(student => [student.id, `${student.preferred_name || student.first_name} ${student.last_name}`]));
  const familyMap = new Map(state.families.map(family => [family.id, family.family_name]));

  const feeCards = activeItems.map(item => `
    <article class="summary-tile">
      <span>${escapeHtml(item.fee_name)}</span>
      <strong>${formatCurrency(item.amount)}</strong>
      <small class="record-meta">${escapeHtml(item.billing_frequency || item.fee_type)}</small>
    </article>`).join("");

  const chargeRows = state.charges.map(charge => `
    <tr>
      <td><strong>${escapeHtml(charge.charge_number || "Pending")}</strong><div class="record-meta">${formatDate(charge.charge_date)}</div></td>
      <td>${escapeHtml(studentMap.get(charge.student_id) || familyMap.get(charge.family_id) || "—")}</td>
      <td>${escapeHtml(charge.description)}</td>
      <td>${formatCurrency(charge.original_amount)}</td>
      <td>${formatCurrency(charge.discount_amount)}</td>
      <td>${formatCurrency(charge.final_amount)}</td>
      <td>${formatCurrency(state.outstanding.get(charge.id) ?? charge.final_amount)}</td>
      <td>${statusBadge(charge.status)}</td>
    </tr>`).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({
      eyebrow: "Finance",
      title: "Fees & Ledgers",
      description: "Charges use the linked Student Hub payment amount, family position, term payment weeks and referral reward automatically.",
      actions: `<button id="createFeeScheduleButton" class="button button-secondary" type="button">${activeSchedule ? "Create new fee version" : "Create fee schedule"}</button><button id="addChargeButton" class="button button-primary" type="button" ${activeItems.length ? "" : "disabled"}>Add charge</button>`
    })}

    <div class="master-record-banner">
      <div><strong>Automatic student fee calculation</strong><p>Weekly students can be charged for all billable weeks in a selected term. Term students use $120 for the first family member or $100 for additional members, before Student Hub custom amounts and referral rewards.</p></div>
      <span class="badge success">Student Hub linked</span>
    </div>

    <section class="section-card">
      <div class="section-card-header">
        <div><h3>${activeSchedule ? escapeHtml(`${activeSchedule.schedule_name} v${activeSchedule.version_number}`) : "No active fee schedule"}</h3><p class="muted">${activeSchedule ? `Effective ${formatDate(activeSchedule.effective_from)}` : "Create the first versioned fee schedule before adding charges."}</p></div>
        ${activeSchedule ? statusBadge(activeSchedule.status) : ""}
      </div>
      ${activeItems.length ? `<div class="summary-grid">${feeCards}</div>` : emptyState("Fee schedule required", "Settings contains the defaults used when a new fee version is created.")}
    </section>

    <section class="section-card">
      <div class="section-card-header"><div><h3>Recent charges</h3><p class="muted">The original amount, discount and final student amount are kept separately for an accurate audit trail.</p></div></div>
      ${state.charges.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Charge</th><th>Student or family</th><th>Description</th><th>Original</th><th>Discount</th><th>Final</th><th>Outstanding</th><th>Status</th></tr></thead>
        <tbody>${chargeRows}</tbody>
      </table></div>` : emptyState("No charges yet", "Create a fee schedule, then add a test charge for a fictional student.")}
    </section>
  </div>`;

  container.querySelector("#createFeeScheduleButton").addEventListener("click", openFeeScheduleDialog);
  container.querySelector("#addChargeButton").addEventListener("click", openChargeDialog);
}

function openFeeScheduleDialog() {
  const nextVersion = Math.max(0, ...state.schedules.map(item => Number(item.version_number || 0))) + 1;
  const fees = state.feeSettings;
  openDialog({
    title: "Create fee schedule version",
    eyebrow: "Finance",
    body: `<form id="feeScheduleForm" class="form-grid">
      <label class="form-field"><span class="form-label">Schedule name</span><input class="input" name="scheduleName" required value="JKA GardenCity Fees"></label>
      <label class="form-field"><span class="form-label">Version</span><input class="input" name="version" type="number" min="1" required value="${nextVersion}"></label>
      <label class="form-field"><span class="form-label">Effective from</span><input class="input" name="effectiveFrom" type="date" required value="${new Date().getFullYear()}-01-01"></label>
      <label class="form-field"><span class="form-label">Weekly fee</span><input class="input" name="weeklyFee" type="number" min="0" step="0.01" required value="${fees.weekly_fee}"></label>
      <label class="form-field"><span class="form-label">First family member term fee</span><input class="input" name="termFee" type="number" min="0" step="0.01" required value="${fees.first_term_fee}"></label>
      <label class="form-field"><span class="form-label">Additional family member term fee</span><input class="input" name="siblingFee" type="number" min="0" step="0.01" required value="${fees.sibling_term_fee}"></label>
      <label class="form-field"><span class="form-label">White-belt grading</span><input class="input" name="whiteGrading" type="number" min="0" step="0.01" required value="${fees.white_belt_grading_fee}"></label>
      <label class="form-field"><span class="form-label">Yellow belt and above grading</span><input class="input" name="colourGrading" type="number" min="0" step="0.01" required value="${fees.colour_belt_grading_fee}"></label>
      <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">Current approved dojo fees.</textarea></label>
    </form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveFeeScheduleButton" class="button button-primary" type="button">Create fee version</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveFeeScheduleButton").addEventListener("click", saveFeeSchedule);
}

async function saveFeeSchedule(event) {
  const button = event.currentTarget;
  const form = document.getElementById("feeScheduleForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const supabase = getSupabaseClient();
    const { data: schedule, error: scheduleError } = await supabase.from("fee_schedules").insert({
      schedule_name: normaliseText(data.get("scheduleName")),
      version_number: Number(data.get("version")),
      effective_from: data.get("effectiveFrom"),
      status: "draft",
      notes: normaliseText(data.get("notes")) || null
    }).select("id").single();
    if (scheduleError) throw scheduleError;

    const items = [
      ["weekly_fee", "Weekly student fee", "weekly_fee", parseMoney(data.get("weeklyFee")), "weekly", null],
      ["term_first", "First family member term fee", "term_fee", parseMoney(data.get("termFee")), "term", "first"],
      ["term_sibling", "Additional family member term fee", "term_fee", parseMoney(data.get("siblingFee")), "term", "additional"],
      ["grading_white", "White-belt grading", "grading_fee", parseMoney(data.get("whiteGrading")), "event", null],
      ["grading_colour", "Yellow belt and above grading", "grading_fee", parseMoney(data.get("colourGrading")), "event", null]
    ].map(([code, name, type, amount, frequency, familyPosition]) => ({
      fee_schedule_id: schedule.id,
      fee_code: code,
      fee_name: name,
      fee_type: type,
      amount,
      billing_frequency: frequency,
      family_position: familyPosition,
      is_active: true
    }));
    const { error: itemError } = await supabase.from("fee_schedule_items").insert(items);
    if (itemError) throw itemError;

    const activeIds = state.schedules.filter(item => item.status === "active").map(item => item.id);
    if (activeIds.length) {
      const { error: retireError } = await supabase.from("fee_schedules").update({ status: "retired" }).in("id", activeIds);
      if (retireError) throw retireError;
    }
    const { error: activateError } = await supabase.from("fee_schedules").update({ status: "active" }).eq("id", schedule.id);
    if (activateError) throw activateError;

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Fee schedule version created and activated.");
    dispatchDataChanged({ module: "fees" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

function openChargeDialog() {
  const activeSchedule = state.schedules.find(item => item.status === "active");
  const items = state.items.filter(item => item.fee_schedule_id === activeSchedule?.id && item.is_active);
  const studentOptions = state.students
    .filter(student => ["active", "trial", "paused"].includes(student.status))
    .map(student => `<option value="${student.id}">${escapeHtml(`${student.preferred_name || student.first_name} ${student.last_name}`)}</option>`)
    .join("");
  const itemOptions = items
    .map(item => `<option value="${item.id}">${escapeHtml(item.fee_name)} — ${formatCurrency(item.amount)}</option>`)
    .join("");
  const termOptions = ['<option value="">No term</option>', ...state.terms.map(term => `<option value="${term.id}">${escapeHtml(`${term.term_name} ${term.academic_year}`)} · ${term.number_of_training_weeks || 0} weeks</option>`)].join("");

  openDialog({
    title: "Add linked student charge",
    eyebrow: "Finance",
    body: `<form id="chargeForm" class="form-grid">
      <label class="form-field"><span class="form-label">Student</span><select id="chargeStudent" class="select" name="studentId" required><option value="">Select student</option>${studentOptions}</select></label>
      <label class="form-field"><span class="form-label">Fee type</span><select id="chargeFeeItem" class="select" name="feeItemId" required><option value="">Select fee</option>${itemOptions}</select></label>
      <label class="form-field"><span class="form-label">Term</span><select id="chargeTerm" class="select" name="termId">${termOptions}</select></label>
      <label class="checkbox-row"><input id="chargeAllWeeks" type="checkbox" name="chargeAllWeeks" checked><span>For a weekly plan, charge all billable weeks in the selected term</span></label>
      <label class="form-field"><span class="form-label">Charge date</span><input class="input" type="date" name="chargeDate" required value="${todayIso()}"></label>
      <label class="form-field"><span class="form-label">Due date</span><input class="input" type="date" name="dueDate" value="${todayIso()}"></label>
      <label class="form-field"><span class="form-label">Original standard amount</span><input id="chargeAmount" class="input" type="number" min="0" step="0.01" name="amount" required></label>
      <label class="form-field"><span class="form-label">Automatic discount / reward</span><input id="chargeDiscount" class="input" type="number" min="0" step="0.01" name="discount" value="0.00"></label>
      <label class="form-field"><span class="form-label">Final amount student pays</span><input id="chargeFinalAmount" class="input" type="number" min="0" step="0.01" readonly></label>
      <label class="form-field full"><span class="form-label">Reason</span><input class="input" name="reason" value="Approved dojo fee"></label>
      <input id="referralApplied" type="hidden" value="false">
    </form>
    <div id="chargeCalculation" class="fee-preview-card section-spacer"><div><span>Calculation</span><strong>Select a student, fee and term</strong></div></div>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveChargeButton" class="button button-primary" type="button">Create charge</button>`
  });

  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  ["chargeStudent", "chargeFeeItem", "chargeTerm", "chargeAllWeeks"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", recalculateCharge);
  });
  document.getElementById("chargeAmount").addEventListener("input", updateFinalFromManual);
  document.getElementById("chargeDiscount").addEventListener("input", updateFinalFromManual);
  document.getElementById("saveChargeButton").addEventListener("click", saveCharge);
}

function recalculateCharge() {
  const studentId = document.getElementById("chargeStudent").value;
  const feeItemId = document.getElementById("chargeFeeItem").value;
  const termId = document.getElementById("chargeTerm").value;
  const chargeAllWeeks = document.getElementById("chargeAllWeeks").checked;
  const student = state.students.find(item => item.id === studentId);
  const feeItem = state.items.find(item => item.id === feeItemId);
  const term = state.terms.find(item => item.id === termId) || null;
  const calculation = document.getElementById("chargeCalculation");
  if (!student || !feeItem) {
    calculation.innerHTML = '<div><span>Calculation</span><strong>Select a student and fee</strong></div>';
    return;
  }

  const profileRow = state.billingProfiles.find(item => item.student_id === student.id) || {};
  const profile = normaliseBillingProfile(profileRow);
  const pricing = calculateStudentPricing({
    student,
    students: state.students,
    profile,
    feeSettings: state.feeSettings,
    term
  });

  let original = Number(feeItem.amount || 0);
  let finalAmount = original;
  let rule = "Fee schedule amount";
  let referralApplied = false;

  if (feeItem.fee_type === "weekly_fee") {
    const weeks = term && chargeAllWeeks ? Number(term.number_of_training_weeks || 0) : 1;
    original = Number(state.feeSettings.weekly_fee || feeItem.amount || 0) * Math.max(weeks, 1);
    if (profile.custom_amount !== null) {
      finalAmount = profile.custom_amount_period === "term" && term && chargeAllWeeks
        ? profile.custom_amount
        : profile.custom_amount * Math.max(weeks, 1);
      rule = profile.custom_amount_period === "term" ? "Custom term amount" : "Custom weekly amount";
    } else if (term && chargeAllWeeks && pricing.rewardAvailable && pricing.rewardPercent > 0) {
      finalAmount = pricing.effectiveTermAmount;
      rule = pricing.adjustmentLabel;
      referralApplied = true;
    } else {
      finalAmount = Number(state.feeSettings.weekly_fee || feeItem.amount || 0) * Math.max(weeks, 1);
      rule = `${Math.max(weeks, 1)} billable week${weeks === 1 ? "" : "s"}`;
    }
  } else if (feeItem.fee_type === "term_fee") {
    original = pricing.standardTermRate;
    finalAmount = pricing.effectiveTermAmount;
    rule = pricing.adjustmentLabel;
    referralApplied = pricing.rewardAvailable && pricing.rewardPercent > 0 && profile.custom_amount === null;
  }

  const discount = Math.max(original - finalAmount, 0);
  document.getElementById("chargeAmount").value = original.toFixed(2);
  document.getElementById("chargeDiscount").value = discount.toFixed(2);
  document.getElementById("chargeFinalAmount").value = Math.max(original - discount, 0).toFixed(2);
  document.getElementById("referralApplied").value = referralApplied ? "true" : "false";
  calculation.innerHTML = `<div><span>Student Hub rule</span><strong>${escapeHtml(rule)}</strong></div><div><span>Original</span><strong>${formatCurrency(original)}</strong></div><div><span>Student pays</span><strong>${formatCurrency(finalAmount)}</strong></div>`;
}

function updateFinalFromManual() {
  const amount = parseMoney(document.getElementById("chargeAmount").value);
  const discount = parseMoney(document.getElementById("chargeDiscount").value);
  document.getElementById("chargeFinalAmount").value = Math.max(amount - discount, 0).toFixed(2);
}

async function saveCharge(event) {
  const button = event.currentTarget;
  const form = document.getElementById("chargeForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const student = state.students.find(item => item.id === data.get("studentId"));
    const feeItem = state.items.find(item => item.id === data.get("feeItemId"));
    const amount = parseMoney(data.get("amount"));
    const discount = parseMoney(data.get("discount"));
    if (discount > amount) throw new Error("The discount cannot exceed the original charge amount.");

    const finalAmount = Math.max(amount - discount, 0);
    const termId = data.get("termId") || null;
    const term = state.terms.find(item => item.id === termId);
    const weeks = feeItem.fee_type === "weekly_fee" && term && data.get("chargeAllWeeks") === "on"
      ? Number(term.number_of_training_weeks || 0)
      : null;
    const description = feeItem.fee_type === "weekly_fee" && weeks
      ? `${feeItem.fee_name} — ${weeks} billable week${weeks === 1 ? "" : "s"}`
      : feeItem.fee_name;

    const supabase = getSupabaseClient();
    const { data: number, error: numberError } = await supabase.rpc("next_charge_number", { p_charge_date: data.get("chargeDate") });
    if (numberError) throw numberError;

    const { error } = await supabase.from("charges").insert({
      charge_number: number,
      student_id: student.id,
      family_id: student.family_id || null,
      term_id: termId,
      fee_schedule_id: feeItem.fee_schedule_id,
      fee_schedule_item_id: feeItem.id,
      fee_type: feeItem.fee_type,
      description,
      charge_date: data.get("chargeDate"),
      due_date: data.get("dueDate") || null,
      original_amount: amount,
      discount_amount: discount,
      final_amount: finalAmount,
      status: finalAmount <= 0 ? "paid" : "unpaid",
      reason_for_charge: normaliseText(data.get("reason")) || "Approved dojo fee",
      notes: document.getElementById("chargeCalculation")?.innerText || null,
      confirmed_at: new Date().toISOString()
    });
    if (error) throw error;

    if (document.getElementById("referralApplied").value === "true") {
      await markReferralRewardUsed(supabase, student.id, termId);
    }

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Charge created using the linked Student Hub fee.");
    dispatchDataChanged({ module: "charges" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function markReferralRewardUsed(supabase, studentId, termId) {
  const row = state.billingProfiles.find(item => item.student_id === studentId);
  if (!row) return;
  const updated = consumeReferralReward(row, termId);
  if (updated.permanent_free) return;

  const { error: billingError } = await supabase
    .from("student_billing_profiles")
    .update({ billing_notes: serializeBillingNotes(updated) })
    .eq("student_id", studentId);
  if (billingError) throw billingError;

  const { error: studentError } = await supabase
    .from("students")
    .update({ referral_reward_summary: referralSummary(updated) })
    .eq("id", studentId);
  if (studentError) throw studentError;
}
