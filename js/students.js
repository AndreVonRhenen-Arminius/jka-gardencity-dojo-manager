import { getSupabaseClient } from "./database.js?v=1.3.0";
import {
  calculateAge,
  dispatchDataChanged,
  formatCurrency,
  normaliseText,
  nowIso,
  todayIso
} from "./utilities.js?v=1.3.0";
import {
  closeDialog,
  confirmAction,
  emptyState,
  escapeHtml,
  moduleHeader,
  notifyError,
  notifySuccess,
  openDialog,
  setButtonBusy,
  statusBadge
} from "./ui.js?v=1.3.0";
import { openStudentRecords } from "./student-records.js?v=1.3.0";
import {
  DEFAULT_FEE_SETTINGS,
  DEFAULT_REFERRAL_RULES,
  billingListLabel,
  calculateStudentPricing,
  discountSummary,
  normaliseBillingProfile,
  referralDefaults,
  referralSummary,
  serializeBillingNotes
} from "./billing.js?v=1.3.0";

let state = {
  students: [],
  families: [],
  belts: [],
  guardians: [],
  guardianFamilies: [],
  billingProfiles: [],
  feeSettings: DEFAULT_FEE_SETTINGS,
  terms: [],
  referralRules: DEFAULT_REFERRAL_RULES
};

export async function renderStudents(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [studentsResult, familiesResult, beltsResult, guardiansResult, linksResult, billingResult, feesResult, termsResult] = await Promise.all([
    supabase.from("students").select("*").is("deleted_at", null).order("last_name").order("first_name"),
    supabase.from("families").select("*").is("deleted_at", null).order("family_name"),
    supabase.from("belt_ranks").select("id,rank_name,belt_colour,rank_order").eq("is_active", true).order("rank_order"),
    supabase.from("guardians").select("*").is("deleted_at", null).order("full_name"),
    supabase.from("guardian_families").select("*"),
    supabase.from("student_billing_profiles").select("*").is("deleted_at", null),
    supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", ["fees.defaults", "referral.rules"]).is("deleted_at", null),
    supabase.from("terms").select("*").is("deleted_at", null).order("start_date", { ascending: false })
  ]);

  for (const result of [studentsResult, familiesResult, beltsResult, guardiansResult, linksResult, billingResult, feesResult, termsResult]) {
    if (result.error) throw result.error;
  }

  state = {
    students: studentsResult.data || [],
    families: familiesResult.data || [],
    belts: beltsResult.data || [],
    guardians: guardiansResult.data || [],
    guardianFamilies: linksResult.data || [],
    billingProfiles: billingResult.data || [],
    feeSettings: { ...DEFAULT_FEE_SETTINGS, ...(((feesResult.data || []).find(row => row.setting_key === "fees.defaults") || {}).setting_value || {}) },
    terms: termsResult.data || [],
    referralRules: { ...DEFAULT_REFERRAL_RULES, ...(((feesResult.data || []).find(row => row.setting_key === "referral.rules") || {}).setting_value || {}) }
  };
}

function render(container) {
  const familyMap = new Map(state.families.map(item => [item.id, item]));
  const currentTerm = currentBillingTerm();
  const billingMap = new Map(state.billingProfiles.map(item => [item.student_id, item]));
  const beltMap = new Map(
    state.belts.map(item => [item.id, `${item.belt_colour || ""} ${item.rank_name || ""}`.trim()])
  );

  const rows = state.students.map(student => {
    const family = familyMap.get(student.family_id);
    const guardian = primaryGuardianForFamily(family);
    const displayName = student.preferred_name || student.first_name;
    const age = calculateAge(student.date_of_birth);
    const completeness = getCoreCompleteness(student, family, guardian);
    const billingProfile = normaliseBillingProfile(billingMap.get(student.id) || {});
    const pricing = calculateStudentPricing({
      student,
      students: state.students,
      profile: billingProfile,
      feeSettings: state.feeSettings,
      term: currentTerm
    });

    return `
      <tr data-search="${escapeHtml(`${student.student_number} ${student.first_name} ${student.last_name} ${displayName} ${family?.family_name || ""} ${guardian?.full_name || ""}`.toLowerCase())}">
        <td>
          <strong>${escapeHtml(displayName)} ${escapeHtml(student.last_name)}</strong>
          <div class="record-meta">${escapeHtml(student.student_number)}</div>
        </td>
        <td>${age ?? "—"}</td>
        <td>
          ${escapeHtml(family?.family_name || "No family linked")}
          <div class="record-meta">${escapeHtml(guardian?.full_name || "No primary guardian")}</div>
        </td>
        <td>${escapeHtml(beltMap.get(student.current_belt_rank_id) || "Not recorded")}</td>
        <td>${statusBadge(student.status)}</td>
        <td>
          <strong>${escapeHtml(billingListLabel(pricing))}</strong>
          <div class="record-meta">${escapeHtml(pricing.adjustmentLabel)}${currentTerm ? ` · ${escapeHtml(currentTerm.term_name)} ${currentTerm.academic_year}` : ""}</div>
        </td>
        <td>
          <div class="completion-cell">
            <span class="completion-value">${completeness.percent}%</span>
            <span class="completion-track"><span style="width:${completeness.percent}%"></span></span>
            <small>${completeness.missing} core item${completeness.missing === 1 ? "" : "s"} missing</small>
          </div>
        </td>
        <td class="table-actions">
          <button class="button button-primary button-small" data-action="edit" data-id="${student.id}">Edit master record</button>
          <button class="button button-secondary button-small" data-action="details" data-id="${student.id}">Profile & missing info</button>
          <button class="button button-danger button-small" data-action="archive" data-id="${student.id}">Archive</button>
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({
        eyebrow: "People",
        title: "Student Hub",
        description: "This is the main source of truth. Add or edit the student, family and primary guardian here once; Attendance, Gradings, Fees, Payments, Reports and Communication use the same linked records automatically.",
        actions: '<button id="addStudentButton" class="button button-primary" type="button">Add student & family</button>'
      })}

      <div class="master-record-banner">
        <div>
          <strong>Main add and edit section</strong>
          <p>Use Student Hub for names, family details, guardian contact information, belt, status and payment plan. Use <em>Profile & missing info</em> only for emergency, medical and student-specific notes.</p>
        </div>
        <span class="badge success">Linked records</span>
      </div>

      <div class="module-toolbar">
        <input id="studentSearch" class="input search-input" type="search" placeholder="Search students, numbers, families or guardians">
        <div class="record-meta">${state.students.length} student records</div>
      </div>

      ${state.students.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Age</th>
                <th>Linked family</th>
                <th>Current belt</th>
                <th>Status</th>
                <th>Student fee</th>
                <th>Profile</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="studentRows">${rows}</tbody>
          </table>
        </div>` : emptyState(
          "No students yet",
          "Add a student here. The same linked record will then appear throughout the dojo app."
        )}
    </div>`;

  container.querySelector("#addStudentButton").addEventListener("click", () => openStudentDialog());
  container.querySelector("#studentSearch")?.addEventListener("input", filterRows);
  container.querySelector("#studentRows")?.addEventListener("click", handleAction);
}

function filterRows(event) {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#studentRows tr").forEach(row => {
    row.hidden = query && !row.dataset.search.includes(query);
  });
}

function handleAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const student = state.students.find(item => item.id === button.dataset.id);
  if (!student) return;

  if (button.dataset.action === "details") openStudentRecords(student);
  if (button.dataset.action === "edit") openStudentDialog(student);
  if (button.dataset.action === "archive") archiveStudent(student);
}

function primaryGuardianForFamily(family) {
  if (!family) return null;

  if (family.primary_guardian_id) {
    const direct = state.guardians.find(item => item.id === family.primary_guardian_id);
    if (direct) return direct;
  }

  const primaryLink = state.guardianFamilies.find(link =>
    link.family_id === family.id && link.is_primary_billing_contact
  );
  const firstLink = primaryLink || state.guardianFamilies.find(link => link.family_id === family.id);
  return firstLink ? state.guardians.find(item => item.id === firstLink.guardian_id) || null : null;
}

function guardiansForFamily(familyId) {
  if (!familyId) return [];
  const ids = new Set(
    state.guardianFamilies
      .filter(link => link.family_id === familyId)
      .map(link => link.guardian_id)
  );
  return state.guardians.filter(guardian => ids.has(guardian.id));
}

function currentBillingTerm() {
  const today = todayIso();
  return state.terms.find(term => term.status === "open" && term.start_date <= today && term.end_date >= today)
    || state.terms.find(term => term.status === "open")
    || state.terms.find(term => term.status === "planned" && term.end_date >= today)
    || state.terms[0]
    || null;
}

function billingProfileForStudent(studentId) {
  return normaliseBillingProfile(
    state.billingProfiles.find(item => item.student_id === studentId) || {}
  );
}

function getCoreCompleteness(student, family, guardian) {
  const checks = [
    student.first_name,
    student.last_name,
    student.date_of_birth,
    student.start_date,
    student.current_belt_rank_id,
    student.payment_plan,
    family?.family_name,
    family?.payment_reference,
    guardian?.full_name,
    guardian?.email,
    guardian?.mobile_number
  ];
  const complete = checks.filter(Boolean).length;
  return {
    percent: Math.round((complete / checks.length) * 100),
    missing: checks.length - complete
  };
}

function openStudentDialog(student = null) {
  const family = state.families.find(item => item.id === student?.family_id) || null;
  const primaryGuardian = primaryGuardianForFamily(family);
  const existingBillingRow = state.billingProfiles.find(item => item.student_id === student?.id) || null;
  const billingProfile = normaliseBillingProfile(existingBillingRow || {});
  const referral = referralDefaults(billingProfile.referral_count, state.referralRules);
  const currentTerm = currentBillingTerm();

  const familyOptions = [
    '<option value="">No family yet</option>',
    `<option value="__new__" ${!family ? "selected" : ""}>Create a new family</option>`,
    ...state.families.map(item =>
      `<option value="${item.id}" ${family?.id === item.id ? "selected" : ""}>${escapeHtml(item.family_name)}</option>`
    )
  ].join("");

  const beltOptions = [
    '<option value="">Not recorded</option>',
    ...state.belts.map(item =>
      `<option value="${item.id}" ${student?.current_belt_rank_id === item.id ? "selected" : ""}>${escapeHtml(`${item.belt_colour || ""} ${item.rank_name || ""}`.trim())}</option>`
    )
  ].join("");

  openDialog({
    title: student ? "Edit student master record" : "Add student, family and guardian",
    eyebrow: "Student Hub",
    body: `
      <form id="studentMasterForm" class="student-master-form">
        <input type="hidden" name="id" value="${student?.id || ""}">

        <section class="wizard-section">
          <div class="wizard-section-heading">
            <span class="wizard-step">1</span>
            <div><h3>Student details</h3><p>These details feed Attendance, Gradings, Progress, Fees, Reports and Communication.</p></div>
          </div>
          <div class="form-grid">
            <label class="form-field"><span class="form-label">First name</span><input class="input" name="firstName" required value="${escapeHtml(student?.first_name || "")}"></label>
            <label class="form-field"><span class="form-label">Last name</span><input class="input" name="lastName" required value="${escapeHtml(student?.last_name || "")}"></label>
            <label class="form-field"><span class="form-label">Preferred name</span><input class="input" name="preferredName" value="${escapeHtml(student?.preferred_name || "")}"></label>
            <label class="form-field"><span class="form-label">Date of birth</span><input class="input" type="date" name="dateOfBirth" value="${student?.date_of_birth || ""}"></label>
            <label class="form-field"><span class="form-label">Start date</span><input class="input" type="date" name="startDate" required value="${student?.start_date || todayIso()}"></label>
            <label class="form-field"><span class="form-label">Status</span><select class="select" name="status">
              ${["active","trial","waiting","paused","inactive","left"].map(value => `<option value="${value}" ${student?.status === value || (!student && value === "active") ? "selected" : ""}>${value.replaceAll("_", " ")}</option>`).join("")}
            </select></label>
            <label class="form-field"><span class="form-label">Current belt</span><select class="select" name="beltId">${beltOptions}</select></label>
            <label class="form-field"><span class="form-label">Payment plan</span><select class="select" name="paymentPlan">
              <option value="">Not set</option>
              <option value="weekly" ${student?.payment_plan === "weekly" ? "selected" : ""}>Weekly</option>
              <option value="term" ${student?.payment_plan === "term" ? "selected" : ""}>Term</option>
              <option value="payment_plan" ${student?.payment_plan === "payment_plan" ? "selected" : ""}>Payment plan</option>
              <option value="exempt" ${student?.payment_plan === "exempt" ? "selected" : ""}>Exempt</option>
            </select></label>
            <label class="form-field"><span class="form-label">School</span><input class="input" name="school" value="${escapeHtml(student?.school || "")}"></label>
            <label class="form-field"><span class="form-label">JKA membership number</span><input class="input" name="jkaMembership" value="${escapeHtml(student?.jka_membership_number || "")}"></label>
            <label class="form-field"><span class="form-label">JKA passport number</span><input class="input" name="jkaPassport" value="${escapeHtml(student?.jka_passport_number || "")}"></label>
            <label class="form-field"><span class="form-label">Referral source</span><input class="input" name="referralSource" value="${escapeHtml(student?.referral_source || "")}"></label>
            <label class="form-field full"><span class="form-label">Previous karate experience</span><textarea class="textarea" name="previousExperience">${escapeHtml(student?.previous_karate_experience || "")}</textarea></label>
          </div>
        </section>

        <section class="wizard-section billing-wizard-section">
          <div class="wizard-section-heading">
            <span class="wizard-step">2</span>
            <div><h3>Student fee, family discount and referral reward</h3><p>The app calculates the standard fee from the payment plan, family position and current term weeks. Enter a custom amount only when this student has a different agreement.</p></div>
          </div>
          <div class="form-grid">
            <label class="form-field"><span class="form-label">Family fee position</span><select class="select" name="familyPositionOverride">
              <option value="auto" ${billingProfile.family_position_override === "auto" ? "selected" : ""}>Automatic from linked family</option>
              <option value="first" ${billingProfile.family_position_override === "first" ? "selected" : ""}>First family member</option>
              <option value="additional" ${billingProfile.family_position_override === "additional" ? "selected" : ""}>Additional family member</option>
            </select></label>
            <label class="form-field"><span class="form-label">Custom amount this student pays</span><input class="input" type="number" min="0" step="0.01" name="customAmount" value="${billingProfile.custom_amount ?? ""}" placeholder="Leave blank for automatic amount"><span class="form-help">A custom amount overrides the normal family or referral calculation.</span></label>
            <label class="form-field"><span class="form-label">Custom amount period</span><select class="select" name="customAmountPeriod">
              <option value="term" ${billingProfile.custom_amount_period === "term" ? "selected" : ""}>Per term</option>
              <option value="week" ${billingProfile.custom_amount_period === "week" ? "selected" : ""}>Per week</option>
            </select></label>
            <label class="form-field"><span class="form-label">Qualifying referrals</span><select id="referralCount" class="select" name="referralCount">
              ${[0,1,2,3,4].map(count => `<option value="${count}" ${billingProfile.referral_count === count ? "selected" : ""}>${count} referral${count === 1 ? "" : "s"}</option>`).join("")}
            </select></label>
            <label class="form-field"><span class="form-label">Referral discount</span><input id="referralDiscountPercent" class="input" type="number" min="0" max="100" name="referralDiscountPercent" value="${existingBillingRow ? billingProfile.referral_discount_percent : referral.referral_discount_percent}" readonly></label>
            <label class="form-field"><span class="form-label">Reward terms remaining</span><input id="rewardTermsRemaining" class="input" type="number" min="0" max="99" name="rewardTermsRemaining" value="${existingBillingRow ? billingProfile.reward_terms_remaining : referral.reward_terms_remaining}"><span class="form-help">Reduce this automatically when the reward is used on a term charge.</span></label>
            <label class="checkbox-row"><input id="permanentFree" type="checkbox" name="permanentFree" ${(existingBillingRow ? billingProfile.permanent_free : referral.permanent_free) ? "checked" : ""}><span>Permanent free training after 4 referrals</span></label>
            <label class="form-field full"><span class="form-label">Billing notes</span><textarea class="textarea" name="billingNotes">${escapeHtml(billingProfile.notes || "")}</textarea></label>
          </div>
          <div id="studentFeePreview" class="fee-preview-card"></div>
          <p class="form-help">Referral rewards exclude gasshukus and gradings. Current calculation uses ${currentTerm ? `${escapeHtml(currentTerm.term_name)} ${currentTerm.academic_year} (${currentTerm.number_of_training_weeks || 0} payment weeks)` : "the standard fees because no current term is configured"}.</p>
        </section>

        <section class="wizard-section">
          <div class="wizard-section-heading">
            <span class="wizard-step">3</span>
            <div><h3>Family and billing details</h3><p>Select an existing family or create it here. Updates automatically flow to Payments, Invoices, Banking and Reports.</p></div>
          </div>
          <div class="form-grid">
            <label class="form-field full"><span class="form-label">Linked family</span><select id="masterFamilySelect" class="select" name="familyId">${familyOptions}</select></label>
            <label class="form-field"><span class="form-label">Family name</span><input class="input" name="familyName" value="${escapeHtml(family?.family_name || "")}"></label>
            <label class="form-field"><span class="form-label">Billing name</span><input class="input" name="billingName" value="${escapeHtml(family?.billing_name || "")}"></label>
            <label class="form-field"><span class="form-label">Payment reference</span><input class="input" name="paymentReference" value="${escapeHtml(family?.payment_reference || "")}"></label>
            <label class="form-field"><span class="form-label">Address line 1</span><input class="input" name="address1" value="${escapeHtml(family?.address_line_1 || "")}"></label>
            <label class="form-field"><span class="form-label">Address line 2</span><input class="input" name="address2" value="${escapeHtml(family?.address_line_2 || "")}"></label>
            <label class="form-field"><span class="form-label">Suburb</span><input class="input" name="suburb" value="${escapeHtml(family?.suburb || "")}"></label>
            <label class="form-field"><span class="form-label">City</span><input class="input" name="city" value="${escapeHtml(family?.city || "Christchurch")}"></label>
            <label class="form-field"><span class="form-label">Postcode</span><input class="input" name="postcode" value="${escapeHtml(family?.postcode || "")}"></label>
          </div>
        </section>

        <section class="wizard-section">
          <div class="wizard-section-heading">
            <span class="wizard-step">4</span>
            <div><h3>Primary guardian</h3><p>The guardian is stored once and linked to the student and family. Editing it here updates all linked sections.</p></div>
          </div>
          <div class="form-grid">
            <label class="form-field full"><span class="form-label">Linked guardian</span><select id="masterGuardianSelect" class="select" name="guardianId"></select></label>
            <label class="form-field"><span class="form-label">Full name</span><input class="input" name="guardianName" value="${escapeHtml(primaryGuardian?.full_name || "")}"></label>
            <label class="form-field"><span class="form-label">Relationship to student</span><input class="input" name="guardianRelationship" value="Guardian"></label>
            <label class="form-field"><span class="form-label">Email</span><input class="input" type="email" name="guardianEmail" value="${escapeHtml(primaryGuardian?.email || "")}"></label>
            <label class="form-field"><span class="form-label">Mobile number</span><input class="input" name="guardianMobile" value="${escapeHtml(primaryGuardian?.mobile_number || "")}"></label>
          </div>
        </section>

        <section class="wizard-section">
          <div class="wizard-section-heading">
            <span class="wizard-step">5</span>
            <div><h3>Consents and notes</h3><p>Tick only information that has been confirmed.</p></div>
          </div>
          <div class="form-grid">
            <label class="checkbox-row"><input type="checkbox" name="consentForms" ${student?.consent_forms_received ? "checked" : ""}><span>Consent forms received</span></label>
            <label class="checkbox-row"><input type="checkbox" name="termsAccepted" ${student?.terms_accepted ? "checked" : ""}><span>Terms accepted</span></label>
            <label class="form-field"><span class="form-label">Photography consent decision</span><select class="select" name="photoConsentDecision">
              <option value="" ${!student?.photography_consent_date ? "selected" : ""}>Not confirmed</option>
              <option value="granted" ${student?.photography_consent_date && student?.photography_consent === true ? "selected" : ""}>Granted</option>
              <option value="declined" ${student?.photography_consent_date && student?.photography_consent === false ? "selected" : ""}>Declined</option>
            </select></label>
            <label class="checkbox-row"><input type="checkbox" name="feeExempt" ${student?.is_exempt_from_fees ? "checked" : ""}><span>Exempt from fees</span></label>
            <label class="form-field full"><span class="form-label">Student notes</span><textarea class="textarea" name="notes">${escapeHtml(student?.notes || "")}</textarea></label>
          </div>
        </section>

        <div id="duplicateWarning" class="inline-message warning" hidden></div>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveStudentButton" class="button button-primary" type="submit" form="studentMasterForm">${student ? "Save master record" : "Create linked student"}</button>`
  });

  const dialog = document.getElementById("appDialog");
  dialog.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  dialog.querySelector("#studentMasterForm").addEventListener("submit", saveStudent);
  dialog.querySelector("#masterFamilySelect").addEventListener("change", handleFamilySelection);
  dialog.querySelector("#masterGuardianSelect").addEventListener("change", handleGuardianSelection);
  dialog.querySelector("[name='familyName']").addEventListener("input", suggestFamilyDefaults);
  dialog.querySelector("[name='firstName']").addEventListener("blur", showDuplicateWarning);
  dialog.querySelector("[name='lastName']").addEventListener("blur", showDuplicateWarning);
  dialog.querySelector("[name='dateOfBirth']").addEventListener("change", showDuplicateWarning);
  ["paymentPlan", "familyPositionOverride", "customAmount", "customAmountPeriod", "rewardTermsRemaining"]
    .forEach(name => dialog.querySelector(`[name='${name}']`)?.addEventListener("input", updateBillingPreview));
  dialog.querySelector("#referralCount")?.addEventListener("change", updateReferralFields);
  dialog.querySelector("#permanentFree")?.addEventListener("change", updateBillingPreview);
  dialog.querySelector("[name='feeExempt']")?.addEventListener("change", updateBillingPreview);

  populateGuardianSelect(family?.id || "__new__", primaryGuardian?.id || "__new__");
  updateBillingPreview();
}

function handleFamilySelection(event) {
  const selected = event.target.value;
  const form = document.getElementById("studentMasterForm");
  const family = state.families.find(item => item.id === selected) || null;

  setFormValue(form, "familyName", family?.family_name || "");
  setFormValue(form, "billingName", family?.billing_name || "");
  setFormValue(form, "paymentReference", family?.payment_reference || "");
  setFormValue(form, "address1", family?.address_line_1 || "");
  setFormValue(form, "address2", family?.address_line_2 || "");
  setFormValue(form, "suburb", family?.suburb || "");
  setFormValue(form, "city", family?.city || "Christchurch");
  setFormValue(form, "postcode", family?.postcode || "");

  const guardian = primaryGuardianForFamily(family);
  populateGuardianSelect(selected, guardian?.id || "__new__");
  populateGuardianFields(guardian);
  updateBillingPreview();
}

function populateGuardianSelect(familyId, selectedGuardianId = "") {
  const select = document.getElementById("masterGuardianSelect");
  if (!select) return;

  const linked = guardiansForFamily(familyId);
  select.innerHTML = [
    '<option value="">No guardian yet</option>',
    `<option value="__new__" ${selectedGuardianId === "__new__" || !selectedGuardianId ? "selected" : ""}>Create a new guardian</option>`,
    ...linked.map(guardian =>
      `<option value="${guardian.id}" ${guardian.id === selectedGuardianId ? "selected" : ""}>${escapeHtml(guardian.full_name)}${guardian.email ? ` — ${escapeHtml(guardian.email)}` : ""}</option>`
    )
  ].join("");
}

function handleGuardianSelection(event) {
  const guardian = state.guardians.find(item => item.id === event.target.value) || null;
  populateGuardianFields(guardian);
}

function populateGuardianFields(guardian) {
  const form = document.getElementById("studentMasterForm");
  if (!form) return;
  setFormValue(form, "guardianName", guardian?.full_name || "");
  setFormValue(form, "guardianEmail", guardian?.email || "");
  setFormValue(form, "guardianMobile", guardian?.mobile_number || "");
}

function suggestFamilyDefaults(event) {
  const form = event.currentTarget.form;
  if (!form || form.elements.familyId.value !== "__new__") return;
  const name = normaliseText(event.currentTarget.value);
  if (!form.elements.billingName.value) form.elements.billingName.value = name ? `${name} Family` : "";
  if (!form.elements.paymentReference.value) form.elements.paymentReference.value = name.toUpperCase();
}

function setFormValue(form, name, value) {
  if (form?.elements?.[name]) form.elements[name].value = value ?? "";
}

function updateReferralFields(event) {
  const form = event.currentTarget.form;
  const defaults = referralDefaults(Number(event.currentTarget.value || 0), state.referralRules);
  form.elements.referralDiscountPercent.value = defaults.referral_discount_percent;
  form.elements.rewardTermsRemaining.value = defaults.reward_terms_remaining;
  form.elements.permanentFree.checked = defaults.permanent_free;
  updateBillingPreview();
}

function updateBillingPreview() {
  const form = document.getElementById("studentMasterForm");
  const preview = document.getElementById("studentFeePreview");
  if (!form || !preview) return;

  const selectedFamilyId = form.elements.familyId.value;
  const existingId = form.elements.id.value;
  const temporaryStudent = {
    id: existingId || "preview-student",
    family_id: selectedFamilyId && selectedFamilyId !== "__new__" ? selectedFamilyId : null,
    payment_plan: form.elements.paymentPlan.value || "term",
    status: form.elements.status.value || "active",
    start_date: form.elements.startDate.value || todayIso(),
    is_exempt_from_fees: form.elements.feeExempt.checked
  };
  const students = existingId
    ? state.students.map(student => student.id === existingId ? { ...student, ...temporaryStudent } : student)
    : [...state.students, temporaryStudent];
  const profile = {
    family_position_override: form.elements.familyPositionOverride.value,
    custom_amount: form.elements.customAmount.value,
    custom_amount_period: form.elements.customAmountPeriod.value,
    referral_count: Number(form.elements.referralCount.value || 0),
    referral_discount_percent: Number(form.elements.referralDiscountPercent.value || 0),
    reward_terms_remaining: Number(form.elements.rewardTermsRemaining.value || 0),
    permanent_free: form.elements.permanentFree.checked,
    is_exempt: form.elements.feeExempt.checked
  };
  const pricing = calculateStudentPricing({
    student: temporaryStudent,
    students,
    profile,
    feeSettings: state.feeSettings,
    term: currentBillingTerm()
  });

  preview.innerHTML = `<div><span>Calculated student fee</span><strong>${escapeHtml(billingListLabel(pricing))}</strong></div><div><span>Applied rule</span><strong>${escapeHtml(pricing.adjustmentLabel)}</strong></div><div><span>Family position</span><strong>${pricing.familyPosition === "additional" ? "Additional member" : "First member"}</strong></div>`;
}

function showDuplicateWarning() {
  const form = document.getElementById("studentMasterForm");
  const warning = document.getElementById("duplicateWarning");
  if (!form || !warning) return;

  const id = form.elements.id.value;
  const first = normaliseText(form.elements.firstName.value).toLowerCase();
  const last = normaliseText(form.elements.lastName.value).toLowerCase();
  const dob = form.elements.dateOfBirth.value;
  const duplicate = state.students.find(student =>
    student.id !== id &&
    student.first_name.toLowerCase() === first &&
    student.last_name.toLowerCase() === last &&
    (!dob || !student.date_of_birth || student.date_of_birth === dob)
  );

  warning.hidden = !duplicate;
  warning.textContent = duplicate
    ? `Possible duplicate: ${duplicate.preferred_name || duplicate.first_name} ${duplicate.last_name} (${duplicate.student_number}). Check the existing record before saving.`
    : "";
}

async function saveStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("saveStudentButton");
  if (!form.reportValidity()) return;

  setButtonBusy(button, true, "Saving linked records…");

  try {
    const data = new FormData(form);
    const existingStudentId = data.get("id") || null;
    await confirmStudentDuplicate(data, existingStudentId);

    const supabase = getSupabaseClient();
    const familyId = await saveLinkedFamily(supabase, data);
    const guardianId = await saveLinkedGuardian(supabase, data, familyId);

    const studentRow = {
      family_id: familyId,
      first_name: normaliseText(data.get("firstName")),
      last_name: normaliseText(data.get("lastName")),
      preferred_name: normaliseText(data.get("preferredName")) || null,
      date_of_birth: data.get("dateOfBirth") || null,
      start_date: data.get("startDate"),
      status: data.get("status"),
      current_belt_rank_id: data.get("beltId") || null,
      payment_plan: data.get("paymentPlan") || null,
      school: normaliseText(data.get("school")) || null,
      jka_membership_number: normaliseText(data.get("jkaMembership")) || null,
      jka_passport_number: normaliseText(data.get("jkaPassport")) || null,
      previous_karate_experience: normaliseText(data.get("previousExperience")) || null,
      referral_source: normaliseText(data.get("referralSource")) || null,
      consent_forms_received: data.get("consentForms") === "on",
      consent_forms_received_date: data.get("consentForms") === "on" ? todayIso() : null,
      terms_accepted: data.get("termsAccepted") === "on",
      terms_accepted_date: data.get("termsAccepted") === "on" ? todayIso() : null,
      photography_consent: data.get("photoConsentDecision")
        ? data.get("photoConsentDecision") === "granted"
        : null,
      photography_consent_date: data.get("photoConsentDecision") ? todayIso() : null,
      is_exempt_from_fees: data.get("feeExempt") === "on",
      notes: normaliseText(data.get("notes")) || null
    };

    let studentResult;
    if (existingStudentId) {
      studentResult = await supabase
        .from("students")
        .update(studentRow)
        .eq("id", existingStudentId)
        .select("id")
        .single();
    } else {
      const { data: studentNumber, error: numberError } = await supabase.rpc("next_student_number");
      if (numberError) throw numberError;
      studentResult = await supabase
        .from("students")
        .insert({ ...studentRow, student_number: studentNumber })
        .select("id")
        .single();
    }

    if (studentResult.error) throw studentResult.error;
    const studentId = studentResult.data.id;

    await syncStudentGuardians(
      supabase,
      studentId,
      familyId,
      guardianId,
      normaliseText(data.get("guardianRelationship")) || "Guardian"
    );

    await saveStudentBillingProfile(supabase, studentId, familyId, studentRow, data);
    await syncStudentTermEnrolment(supabase, studentId, studentRow);

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(existingStudentId
      ? "Student, family and guardian details updated everywhere."
      : "Student created and linked across the dojo app."
    );
    dispatchDataChanged({ module: "students", studentId });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function syncStudentTermEnrolment(supabase, studentId, studentRow) {
  const term = currentBillingTerm();
  if (!term || studentRow.start_date > term.end_date) return;

  const statusMap = {
    active: "enrolled",
    trial: "trial",
    paused: "paused",
    waiting: "paused",
    inactive: "withdrawn",
    left: "withdrawn"
  };
  const enrolmentStatus = statusMap[studentRow.status] || "enrolled";
  const joinedOn = studentRow.start_date < term.start_date ? term.start_date : studentRow.start_date;
  const leftOn = ["inactive", "left"].includes(studentRow.status) ? todayIso() : null;

  const { error } = await supabase
    .from("term_enrolments")
    .upsert({
      term_id: term.id,
      student_id: studentId,
      enrolment_status: enrolmentStatus,
      joined_term_on: joinedOn,
      left_term_on: leftOn,
      eligible_for_term_charge: !studentRow.is_exempt_from_fees,
      charge_exclusion_reason: studentRow.is_exempt_from_fees ? "Student marked fee exempt in Student Hub" : null,
      deleted_at: null
    }, { onConflict: "term_id,student_id" });
  if (error) throw error;
}

async function saveStudentBillingProfile(supabase, studentId, familyId, studentRow, data) {
  const referralCount = Number(data.get("referralCount") || 0);
  const defaults = referralDefaults(referralCount, state.referralRules);
  const profile = {
    student_id: studentId,
    payment_plan: data.get("paymentPlan") || null,
    is_exempt: data.get("feeExempt") === "on",
    exemption_reason: data.get("feeExempt") === "on"
      ? normaliseText(data.get("billingNotes")) || "Fee exemption recorded in Student Hub"
      : null,
    family_position_override: data.get("familyPositionOverride") || "auto",
    custom_amount: data.get("customAmount") === "" ? null : Number(data.get("customAmount")),
    custom_amount_period: data.get("customAmountPeriod") || "term",
    referral_count: referralCount,
    referral_discount_percent: Number(data.get("referralDiscountPercent") || defaults.referral_discount_percent),
    reward_terms_remaining: Number(data.get("rewardTermsRemaining") || 0),
    permanent_free: data.get("permanentFree") === "on" || referralCount >= 4,
    notes: normaliseText(data.get("billingNotes")) || ""
  };

  const { error: billingError } = await supabase
    .from("student_billing_profiles")
    .upsert({
      student_id: studentId,
      payment_plan: profile.payment_plan,
      is_exempt: profile.is_exempt,
      exemption_reason: profile.exemption_reason,
      billing_notes: serializeBillingNotes(profile),
      deleted_at: null
    }, { onConflict: "student_id" });
  if (billingError) throw billingError;

  const pricingStudent = {
    ...studentRow,
    id: studentId,
    family_id: familyId,
    created_at: state.students.find(item => item.id === studentId)?.created_at || new Date().toISOString()
  };
  const pricingStudents = state.students.some(item => item.id === studentId)
    ? state.students.map(item => item.id === studentId ? pricingStudent : item)
    : [...state.students, pricingStudent];
  const pricing = calculateStudentPricing({
    student: pricingStudent,
    students: pricingStudents,
    profile,
    feeSettings: state.feeSettings,
    term: currentBillingTerm()
  });

  const { error: summaryError } = await supabase
    .from("students")
    .update({
      discount_summary: discountSummary(pricing),
      referral_reward_summary: referralSummary(profile)
    })
    .eq("id", studentId);
  if (summaryError) throw summaryError;
}

async function confirmStudentDuplicate(data, currentId) {
  const first = normaliseText(data.get("firstName")).toLowerCase();
  const last = normaliseText(data.get("lastName")).toLowerCase();
  const dob = data.get("dateOfBirth") || null;

  const duplicate = state.students.find(student =>
    student.id !== currentId &&
    student.first_name.toLowerCase() === first &&
    student.last_name.toLowerCase() === last &&
    (!dob || !student.date_of_birth || student.date_of_birth === dob)
  );

  if (duplicate) {
    const proceed = await confirmAction(
      `A possible matching student already exists: ${duplicate.preferred_name || duplicate.first_name} ${duplicate.last_name} (${duplicate.student_number}). Create another record anyway?`
    );
    if (!proceed) throw new Error("Save cancelled so the possible duplicate can be checked.");
  }
}

async function saveLinkedFamily(supabase, data) {
  const selected = data.get("familyId");
  const familyName = normaliseText(data.get("familyName"));

  if (!familyName && (!selected || selected === "__new__")) return null;

  let familyId = selected && selected !== "__new__" ? selected : null;
  if (!familyId) {
    const duplicate = state.families.find(item =>
      item.family_name.toLowerCase() === familyName.toLowerCase()
    );
    if (duplicate) {
      const useExisting = await confirmAction(
        `A ${duplicate.family_name} family already exists. Link this student to that family instead of creating a duplicate?`
      );
      if (useExisting) familyId = duplicate.id;
    }
  }

  const existing = state.families.find(item => item.id === familyId) || {};
  const familyRow = {
    family_name: familyName || existing.family_name,
    billing_name: normaliseText(data.get("billingName")) || existing.billing_name || null,
    payment_reference: normaliseText(data.get("paymentReference")) || existing.payment_reference || null,
    address_line_1: normaliseText(data.get("address1")) || existing.address_line_1 || null,
    address_line_2: normaliseText(data.get("address2")) || existing.address_line_2 || null,
    suburb: normaliseText(data.get("suburb")) || existing.suburb || null,
    city: normaliseText(data.get("city")) || existing.city || "Christchurch",
    postcode: normaliseText(data.get("postcode")) || existing.postcode || null,
    is_active: true
  };

  if (familyId) {
    const { error } = await supabase.from("families").update(familyRow).eq("id", familyId);
    if (error) throw error;
    return familyId;
  }

  const { data: family, error } = await supabase
    .from("families")
    .insert(familyRow)
    .select("id")
    .single();
  if (error) throw error;
  return family.id;
}

async function saveLinkedGuardian(supabase, data, familyId) {
  if (!familyId) return null;

  const selected = data.get("guardianId");
  const name = normaliseText(data.get("guardianName"));
  const email = normaliseText(data.get("guardianEmail"));
  const mobile = normaliseText(data.get("guardianMobile"));

  if (!name && !email && !mobile && (!selected || selected === "__new__")) return null;

  let guardianId = selected && selected !== "__new__" ? selected : null;
  if (!guardianId) {
    const duplicate = state.guardians.find(guardian =>
      (email && guardian.email?.toLowerCase() === email.toLowerCase()) ||
      (mobile && guardian.mobile_number === mobile)
    );
    if (duplicate) {
      const useExisting = await confirmAction(
        `${duplicate.full_name} already has the same email or mobile number. Link the existing guardian instead of creating a duplicate?`
      );
      if (useExisting) guardianId = duplicate.id;
    }
  }

  const family = state.families.find(item => item.id === familyId) || {};
  const existing = state.guardians.find(item => item.id === guardianId) || {};
  const guardianRow = {
    full_name: name || existing.full_name || "Parent or guardian",
    email: email || existing.email || null,
    mobile_number: mobile || existing.mobile_number || null,
    address_line_1: existing.address_line_1 || family.address_line_1 || normaliseText(data.get("address1")) || null,
    address_line_2: existing.address_line_2 || family.address_line_2 || normaliseText(data.get("address2")) || null,
    suburb: existing.suburb || family.suburb || normaliseText(data.get("suburb")) || null,
    city: existing.city || family.city || normaliseText(data.get("city")) || "Christchurch",
    postcode: existing.postcode || family.postcode || normaliseText(data.get("postcode")) || null,
    is_active: true
  };

  if (guardianId) {
    const { error } = await supabase.from("guardians").update(guardianRow).eq("id", guardianId);
    if (error) throw error;
  } else {
    const { data: guardian, error } = await supabase
      .from("guardians")
      .insert(guardianRow)
      .select("id")
      .single();
    if (error) throw error;
    guardianId = guardian.id;
  }

  const { error: clearPrimaryError } = await supabase
    .from("guardian_families")
    .update({ is_primary_billing_contact: false })
    .eq("family_id", familyId);
  if (clearPrimaryError) throw clearPrimaryError;

  const { error: linkError } = await supabase
    .from("guardian_families")
    .upsert({
      guardian_id: guardianId,
      family_id: familyId,
      is_primary_billing_contact: true
    }, { onConflict: "guardian_id,family_id" });
  if (linkError) throw linkError;

  const { error: familyError } = await supabase
    .from("families")
    .update({ primary_guardian_id: guardianId })
    .eq("id", familyId);
  if (familyError) throw familyError;

  return guardianId;
}

async function syncStudentGuardians(supabase, studentId, familyId, primaryGuardianId, relationship) {
  const { error: deleteError } = await supabase
    .from("student_guardians")
    .delete()
    .eq("student_id", studentId);
  if (deleteError) throw deleteError;

  if (!familyId) return;

  const { data: links, error: linksError } = await supabase
    .from("guardian_families")
    .select("guardian_id,is_primary_billing_contact")
    .eq("family_id", familyId);
  if (linksError) throw linksError;
  if (!links?.length) return;

  const rows = links.map(link => ({
    student_id: studentId,
    guardian_id: link.guardian_id,
    relationship_to_student: link.guardian_id === primaryGuardianId ? relationship : "Guardian",
    is_primary_contact: link.guardian_id === primaryGuardianId || Boolean(link.is_primary_billing_contact),
    is_emergency_contact: link.guardian_id === primaryGuardianId,
    authorised_to_collect: true
  }));

  const { error: insertError } = await supabase.from("student_guardians").insert(rows);
  if (insertError) throw insertError;
}

async function archiveStudent(student) {
  if (!await confirmAction(`Archive ${student.preferred_name || student.first_name} ${student.last_name}?`)) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("students")
      .update({ deleted_at: nowIso(), status: "inactive" })
      .eq("id", student.id);
    if (error) throw error;

    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Student archived.");
    dispatchDataChanged({ module: "students" });
  } catch (error) {
    notifyError(error);
  }
}
