import { getSupabaseClient } from "./database.js?v=1.2.0";
import { getCurrentSession } from "./auth.js?v=1.2.0";
import {
  dispatchDataChanged,
  formatDateTime,
  normaliseText,
  parseMoney
} from "./utilities.js?v=1.2.0";
import {
  closeDialog,
  escapeHtml,
  moduleHeader,
  notifyError,
  notifySuccess,
  openDialog,
  setButtonBusy
} from "./ui.js?v=1.2.0";
import { syncTermSessions } from "./term-sync.js?v=1.2.0";
import {
  DEFAULT_FEE_SETTINGS,
  DEFAULT_REFERRAL_RULES
} from "./billing.js?v=1.2.0";

const keys = [
  "dojo.profile",
  "invoice.defaults",
  "training.defaults",
  "training.default_days",
  "fees.defaults",
  "referral.rules",
  "security.inactivity_timeout_minutes"
];

let accessState = {
  users: [],
  roles: [],
  assignments: [],
  currentAuthUserId: null
};
let termState = [];

export async function renderSettings(container) {
  const [settings] = await Promise.all([
    loadSettings(),
    loadAccess(),
    loadTerms()
  ]);

  const dojo = settings["dojo.profile"] || {};
  const invoice = settings["invoice.defaults"] || {};
  const training = settings["training.defaults"] || {};
  const days = settings["training.default_days"] || ["Tuesday", "Thursday"];
  const fees = { ...DEFAULT_FEE_SETTINGS, ...(settings["fees.defaults"] || {}) };
  const referrals = { ...DEFAULT_REFERRAL_RULES, ...(settings["referral.rules"] || {}) };
  const timeout = Number(settings["security.inactivity_timeout_minutes"] ?? 30);
  const calendarYear = selectCalendarYear();
  const roleMap = new Map(accessState.roles.map(role => [role.id, role.role_name]));

  const userRows = accessState.users.map(user => {
    const roleNames = accessState.assignments
      .filter(item => item.authorised_user_id === user.id && !item.removed_at)
      .map(item => roleMap.get(item.role_id))
      .filter(Boolean);

    return `<tr>
      <td><strong>${escapeHtml(user.email)}</strong><div class="record-meta">${user.auth_user_id ? "Signed in and linked" : "Pre-authorised; not linked yet"}</div></td>
      <td>${roleNames.map(name => `<span class="badge success">${escapeHtml(name)}</span>`).join(" ") || "—"}</td>
      <td>${user.is_active && !user.revoked_at ? '<span class="badge success">Active</span>' : '<span class="badge danger">Revoked</span>'}</td>
      <td>${formatDateTime(user.authorised_at)}</td>
      <td>${user.access_expires_at ? formatDateTime(user.access_expires_at) : "No expiry"}</td>
      <td class="table-actions">
        <button class="button button-secondary button-small" data-action="edit-access" data-id="${user.id}">Role / expiry</button>
        ${isCurrentSignedInUser(user)
          ? '<span class="badge muted">Current user</span>'
          : (user.is_active && !user.revoked_at
            ? `<button class="button button-danger button-small" data-action="revoke-access" data-id="${user.id}">Revoke</button>`
            : `<button class="button button-primary button-small" data-action="reactivate-access" data-id="${user.id}">Reactivate</button>`)}
      </td>
    </tr>`;
  }).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({
      eyebrow: "System",
      title: "Settings",
      description: "Update the dojo profile, training calendar, fees, referrals, invoices and authorised access.",
      actions: '<button id="addAuthorisedUserButton" class="button button-secondary" type="button">Authorise another user</button>'
    })}

    <form id="settingsForm" class="section-card">
      <div class="section-card-header">
        <div><h3>Complete dojo details</h3><p class="muted">These details are the source used by invoices, receipts, reports and generated sessions.</p></div>
      </div>
      <div class="form-grid">
        <label class="form-field"><span class="form-label">Dojo name</span><input class="input" name="dojoName" required value="${attr(dojo.dojo_name || "JKA Christchurch – GardenCity")}"></label>
        <label class="form-field"><span class="form-label">Short name</span><input class="input" name="shortName" value="${attr(dojo.short_name || "GardenCity")}"></label>
        <label class="form-field"><span class="form-label">JKA affiliation / organisation</span><input class="input" name="affiliation" value="${attr(dojo.affiliation || "JKA New Zealand")}"></label>
        <label class="form-field"><span class="form-label">Head instructor</span><input class="input" name="instructorName" required value="${attr(dojo.instructor_name || "André Von Rhenen")}"></label>
        <label class="form-field"><span class="form-label">Instructor title</span><input class="input" name="instructorTitle" value="${attr(dojo.instructor_title || "Sensei")}"></label>
        <label class="form-field"><span class="form-label">Dojo email</span><input class="input" type="email" name="dojoEmail" value="${attr(dojo.email || "")}"></label>
        <label class="form-field"><span class="form-label">Dojo phone</span><input class="input" name="dojoPhone" value="${attr(dojo.phone || "")}"></label>
        <label class="form-field"><span class="form-label">Website</span><input class="input" type="url" name="website" value="${attr(dojo.website || "")}"></label>
        <label class="form-field full"><span class="form-label">Facebook page</span><input class="input" type="url" name="facebookUrl" value="${attr(dojo.facebook_url || "")}"></label>
        <label class="form-field"><span class="form-label">Postal / contact address line 1</span><input class="input" name="address1" value="${attr(dojo.address_line_1 || "")}"></label>
        <label class="form-field"><span class="form-label">Address line 2</span><input class="input" name="address2" value="${attr(dojo.address_line_2 || "")}"></label>
        <label class="form-field"><span class="form-label">Suburb</span><input class="input" name="suburb" value="${attr(dojo.suburb || "Opawa")}"></label>
        <label class="form-field"><span class="form-label">City</span><input class="input" name="city" value="${attr(dojo.city || "Christchurch")}"></label>
        <label class="form-field"><span class="form-label">Postcode</span><input class="input" name="postcode" value="${attr(dojo.postcode || "")}"></label>
        <label class="form-field"><span class="form-label">Country</span><input class="input" name="country" value="${attr(dojo.country || "New Zealand")}"></label>
      </div>

      <div class="section-card-header section-spacer">
        <div><h3>Training venue and weekly schedule</h3><p class="muted">Saving term dates automatically creates or updates normal sessions. Those sessions appear in Attendance without separate entry.</p></div>
      </div>
      <div class="form-grid three">
        <label class="form-field"><span class="form-label">Default venue name</span><input class="input" name="venue" value="${attr(training.venue || dojo.venue_name || "Opawa School Hall")}"></label>
        <label class="form-field full"><span class="form-label">Venue address</span><input class="input" name="venueAddress" value="${attr(training.venue_address || dojo.venue_address || "30 Ford Road, Opawa, Christchurch")}"></label>
        <label class="form-field"><span class="form-label">Start time</span><input class="input" type="time" name="startTime" value="${attr(training.start_time || "18:00")}"></label>
        <label class="form-field"><span class="form-label">End time</span><input class="input" type="time" name="endTime" value="${attr(training.end_time || "19:30")}"></label>
        <label class="checkbox-row"><input type="checkbox" name="monday" ${days.includes("Monday") ? "checked" : ""}><span>Monday</span></label>
        <label class="checkbox-row"><input type="checkbox" name="tuesday" ${days.includes("Tuesday") ? "checked" : ""}><span>Tuesday</span></label>
        <label class="checkbox-row"><input type="checkbox" name="wednesday" ${days.includes("Wednesday") ? "checked" : ""}><span>Wednesday</span></label>
        <label class="checkbox-row"><input type="checkbox" name="thursday" ${days.includes("Thursday") ? "checked" : ""}><span>Thursday</span></label>
        <label class="checkbox-row"><input type="checkbox" name="friday" ${days.includes("Friday") ? "checked" : ""}><span>Friday</span></label>
        <label class="checkbox-row"><input type="checkbox" name="saturday" ${days.includes("Saturday") ? "checked" : ""}><span>Saturday</span></label>
        <label class="checkbox-row"><input type="checkbox" name="sunday" ${days.includes("Sunday") ? "checked" : ""}><span>Sunday</span></label>
      </div>

      <div class="section-card-header section-spacer">
        <div><h3>Term calendar and automatic payment weeks</h3><p class="muted">Enter the term dates once. Sessions are synced automatically, and billable weeks are recalculated from non-cancelled training weeks.</p></div>
      </div>
      <div class="form-grid">
        <label class="form-field"><span class="form-label">Calendar year</span><input id="calendarYear" class="input" type="number" min="2020" max="2200" name="calendarYear" value="${calendarYear}"></label>
        <div class="inline-message"><strong>Payment week rule:</strong> one billable week is counted when at least one normal class remains scheduled or completed in that Monday–Sunday week.</div>
      </div>
      <div class="table-wrap section-spacer">
        <table class="data-table term-settings-table">
          <thead><tr><th>Term</th><th>Start date</th><th>End date</th><th>Status</th><th>Calculated weeks</th></tr></thead>
          <tbody>${renderTermCalendarRows(calendarYear)}</tbody>
        </table>
      </div>

      <div class="section-card-header section-spacer">
        <div><h3>Fees and family discount</h3><p class="muted">Student Hub applies these defaults, then uses any student-specific amount or referral reward.</p></div>
      </div>
      <div class="form-grid three">
        <label class="form-field"><span class="form-label">Weekly fee per student</span><input class="input" type="number" min="0" step="0.01" name="weeklyFee" value="${Number(fees.weekly_fee)}"></label>
        <label class="form-field"><span class="form-label">First family member per term</span><input class="input" type="number" min="0" step="0.01" name="firstTermFee" value="${Number(fees.first_term_fee)}"></label>
        <label class="form-field"><span class="form-label">Additional family member per term</span><input class="input" type="number" min="0" step="0.01" name="siblingTermFee" value="${Number(fees.sibling_term_fee)}"></label>
        <label class="form-field"><span class="form-label">White-belt grading fee</span><input class="input" type="number" min="0" step="0.01" name="whiteGradingFee" value="${Number(fees.white_belt_grading_fee)}"></label>
        <label class="form-field"><span class="form-label">Yellow belt and above grading fee</span><input class="input" type="number" min="0" step="0.01" name="colourGradingFee" value="${Number(fees.colour_belt_grading_fee)}"></label>
      </div>

      <div class="section-card-header section-spacer">
        <div><h3>Referral rewards</h3><p class="muted">These rewards apply to normal term training fees only. Gasshukus and gradings remain excluded.</p></div>
      </div>
      <div class="form-grid">
        <label class="form-field"><span class="form-label">1 referral: percentage off next term</span><input class="input" type="number" min="0" max="100" name="oneReferralPercent" value="${Number(referrals.one_referral_percent)}"></label>
        <label class="form-field"><span class="form-label">2 referrals: free terms</span><input class="input" type="number" min="0" max="10" name="twoReferralTerms" value="${Number(referrals.two_referral_free_terms)}"></label>
        <label class="form-field"><span class="form-label">3 referrals: free terms</span><input class="input" type="number" min="0" max="10" name="threeReferralTerms" value="${Number(referrals.three_referral_free_terms)}"></label>
        <label class="checkbox-row"><input type="checkbox" name="fourReferralPermanent" ${referrals.four_referrals_permanent_free !== false ? "checked" : ""}><span>4 referrals: train free permanently</span></label>
      </div>

      <div class="section-card-header section-spacer">
        <div><h3>Invoice and security preferences</h3><p class="muted">Only public payment instructions belong here. Never store banking passwords, PINs or card details.</p></div>
      </div>
      <div class="form-grid">
        <label class="form-field"><span class="form-label">Default payment terms (days)</span><input class="input" type="number" min="0" max="120" name="paymentTermsDays" value="${Number(invoice.payment_terms_days ?? 14)}"></label>
        <label class="form-field"><span class="form-label">Account nickname</span><input class="input" name="accountNickname" value="${attr(invoice.account_nickname || "Kiwibank Dojo Account")}"></label>
        <label class="form-field"><span class="form-label">Invoice prefix</span><input class="input" name="invoicePrefix" value="${attr(invoice.prefix || "JKA")}"></label>
        <label class="form-field"><span class="form-label">Invoice contact email</span><input class="input" type="email" name="invoiceEmail" value="${attr(invoice.contact_email || dojo.email || "")}"></label>
        <label class="form-field"><span class="form-label">Inactivity sign-out (minutes)</span><input class="input" type="number" min="5" max="240" name="timeout" value="${timeout}"><span class="form-help">The new timeout is used immediately after the settings are saved.</span></label>
        <label class="form-field full"><span class="form-label">Invoice footer</span><textarea class="textarea" name="invoiceFooter">${text(invoice.footer || "Thank you for supporting JKA Christchurch – GardenCity.")}</textarea></label>
      </div>

      <div class="dialog-footer embedded-footer">
        <button id="saveSettingsButton" class="button button-primary" type="submit">Save settings and sync terms</button>
      </div>
    </form>

    <section class="section-card">
      <div class="section-card-header"><div><h3>Authorised users and roles</h3><p class="muted">Microsoft authentication alone does not provide access. Every user must also be active in this allowlist.</p></div></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Email</th><th>Roles</th><th>Status</th><th>Authorised</th><th>Expiry</th><th>Actions</th></tr></thead><tbody id="accessRows">${userRows}</tbody></table></div>
    </section>
  </div>`;

  container.querySelector("#settingsForm").addEventListener("submit", saveSettings);
  container.querySelector("#addAuthorisedUserButton").addEventListener("click", () => openAccessDialog());
  container.querySelector("#accessRows").addEventListener("click", handleAccessAction);
  container.querySelector("#calendarYear").addEventListener("change", () => {
    const year = Number(container.querySelector("#calendarYear").value);
    container.querySelector(".term-settings-table tbody").innerHTML = renderTermCalendarRows(year);
  });
}

async function loadSettings() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("setting_key,setting_value")
    .in("setting_key", keys)
    .is("deleted_at", null);
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value]));
}

async function loadTerms() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .is("deleted_at", null)
    .order("academic_year", { ascending: false })
    .order("term_number", { ascending: true });
  if (error) throw error;
  termState = data || [];
}

async function loadAccess() {
  const supabase = getSupabaseClient();
  const [usersResult, rolesResult, assignmentsResult] = await Promise.all([
    supabase.from("authorised_users").select("*").order("email"),
    supabase.from("roles").select("*").eq("is_active", true).order("role_name"),
    supabase.from("user_role_assignments").select("*")
  ]);
  if (usersResult.error) throw usersResult.error;
  if (rolesResult.error) throw rolesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  const session = await getCurrentSession();
  accessState = {
    users: usersResult.data || [],
    roles: rolesResult.data || [],
    assignments: assignmentsResult.data || [],
    currentAuthUserId: session?.user?.id || null
  };
}

function selectCalendarYear() {
  const openTerm = termState.find(term => term.status === "open");
  return openTerm?.academic_year || termState[0]?.academic_year || new Date().getFullYear();
}

function renderTermCalendarRows(year) {
  return [1, 2, 3, 4].map(termNumber => {
    const term = termState.find(item =>
      Number(item.academic_year) === Number(year) &&
      (Number(item.term_number) === termNumber || String(item.term_name).toLowerCase() === `term ${termNumber}`)
    );
    return `<tr>
      <td><strong>Term ${termNumber}</strong><input type="hidden" name="term${termNumber}Id" value="${term?.id || ""}"></td>
      <td><input class="input" type="date" name="term${termNumber}Start" value="${term?.start_date || ""}"></td>
      <td><input class="input" type="date" name="term${termNumber}End" value="${term?.end_date || ""}"></td>
      <td><select class="select" name="term${termNumber}Status">${["planned", "open", "closed", "archived"].map(status => `<option value="${status}" ${term?.status === status || (!term && status === "planned") ? "selected" : ""}>${status}</option>`).join("")}</select></td>
      <td>${term?.number_of_training_weeks ?? "Calculated after save"}</td>
    </tr>`;
  }).join("");
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("#saveSettingsButton");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true, "Saving and syncing…");

  try {
    const data = new FormData(form);
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      .filter(day => data.get(day.toLowerCase()));
    if (!days.length) throw new Error("Select at least one normal training day.");

    const feeSettings = {
      weekly_fee: parseMoney(data.get("weeklyFee")),
      first_term_fee: parseMoney(data.get("firstTermFee")),
      sibling_term_fee: parseMoney(data.get("siblingTermFee")),
      white_belt_grading_fee: parseMoney(data.get("whiteGradingFee")),
      colour_belt_grading_fee: parseMoney(data.get("colourGradingFee"))
    };
    const referralRules = {
      one_referral_percent: Number(data.get("oneReferralPercent") || 50),
      two_referral_free_terms: Number(data.get("twoReferralTerms") || 1),
      three_referral_free_terms: Number(data.get("threeReferralTerms") || 2),
      four_referrals_permanent_free: data.get("fourReferralPermanent") === "on"
    };
    const dojoProfile = {
      dojo_name: normaliseText(data.get("dojoName")),
      short_name: normaliseText(data.get("shortName")),
      affiliation: normaliseText(data.get("affiliation")),
      instructor_name: normaliseText(data.get("instructorName")),
      instructor_title: normaliseText(data.get("instructorTitle")),
      email: normaliseText(data.get("dojoEmail")),
      phone: normaliseText(data.get("dojoPhone")),
      website: normaliseText(data.get("website")),
      facebook_url: normaliseText(data.get("facebookUrl")),
      address_line_1: normaliseText(data.get("address1")),
      address_line_2: normaliseText(data.get("address2")),
      suburb: normaliseText(data.get("suburb")),
      city: normaliseText(data.get("city")),
      postcode: normaliseText(data.get("postcode")),
      country: normaliseText(data.get("country")),
      location: [normaliseText(data.get("city")), normaliseText(data.get("country"))].filter(Boolean).join(", "),
      venue_name: normaliseText(data.get("venue")),
      venue_address: normaliseText(data.get("venueAddress"))
    };

    const rows = [
      { setting_key: "dojo.profile", setting_value: dojoProfile, description: "Complete dojo identity and public contact details.", is_sensitive: false },
      { setting_key: "training.defaults", setting_value: { start_time: data.get("startTime"), end_time: data.get("endTime"), venue: normaliseText(data.get("venue")), venue_address: normaliseText(data.get("venueAddress")), auto_sync_terms: true }, description: "Default times and venue used to sync normal term sessions.", is_sensitive: false },
      { setting_key: "training.default_days", setting_value: days, description: "Normal dojo training days.", is_sensitive: false },
      { setting_key: "fees.defaults", setting_value: feeSettings, description: "Default weekly, term, sibling and grading fees.", is_sensitive: false },
      { setting_key: "referral.rules", setting_value: referralRules, description: "Dojo referral reward programme.", is_sensitive: false },
      { setting_key: "invoice.defaults", setting_value: { prefix: normaliseText(data.get("invoicePrefix")) || "JKA", payment_terms_days: Number(data.get("paymentTermsDays") || 14), account_nickname: normaliseText(data.get("accountNickname")), contact_email: normaliseText(data.get("invoiceEmail")), footer: normaliseText(data.get("invoiceFooter")), show_account_nickname_only: true }, description: "Invoice defaults and public payment instructions.", is_sensitive: false },
      { setting_key: "security.inactivity_timeout_minutes", setting_value: Number(data.get("timeout") || 30), description: "Automatic sign-out period after inactivity.", is_sensitive: false }
    ];

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "setting_key" });
    if (error) throw error;

    await saveReferralRules(supabase, referralRules);
    const syncResults = await saveTermCalendar(supabase, data, feeSettings);

    notifySuccess(`Settings saved. ${syncResults.sessions} sessions synced across ${syncResults.terms} term${syncResults.terms === 1 ? "" : "s"}.`);
    dispatchDataChanged({ module: "settings" });
    await renderSettings(document.getElementById("moduleContent"));
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function saveTermCalendar(supabase, data, fees) {
  const academicYear = Number(data.get("calendarYear"));
  let termCount = 0;
  let sessionCount = 0;

  for (const termNumber of [1, 2, 3, 4]) {
    const id = data.get(`term${termNumber}Id`) || null;
    const start = data.get(`term${termNumber}Start`) || null;
    const end = data.get(`term${termNumber}End`) || null;
    const status = data.get(`term${termNumber}Status`) || "planned";

    if (!start && !end) continue;
    if (!start || !end) throw new Error(`Term ${termNumber} requires both a start date and an end date.`);
    if (end < start) throw new Error(`Term ${termNumber} end date cannot be before its start date.`);

    const row = {
      term_name: `Term ${termNumber}`,
      academic_year: academicYear,
      term_number: termNumber,
      start_date: start,
      end_date: end,
      status,
      default_term_fee: fees.first_term_fee,
      sibling_fee: fees.sibling_term_fee
    };

    let savedTerm;
    if (id) {
      const { data: updated, error } = await supabase.from("terms").update(row).eq("id", id).select("*").single();
      if (error) throw error;
      savedTerm = updated;
    } else {
      const existing = termState.find(item => Number(item.academic_year) === academicYear && (Number(item.term_number) === termNumber || String(item.term_name).toLowerCase() === `term ${termNumber}`));
      if (existing) {
        const { data: updated, error } = await supabase.from("terms").update(row).eq("id", existing.id).select("*").single();
        if (error) throw error;
        savedTerm = updated;
      } else {
        const { data: inserted, error } = await supabase.from("terms").insert(row).select("*").single();
        if (error) throw error;
        savedTerm = inserted;
      }
    }

    const sync = await syncTermSessions(savedTerm);
    termCount += 1;
    sessionCount += sync.inserted + sync.restored;
  }

  return { terms: termCount, sessions: sessionCount };
}

async function saveReferralRules(supabase, rules) {
  const definitions = [
    { rule_name: "1 referral – 50% next term", qualifying_referrals: 1, reward_type: "percentage_next_term", reward_value: rules.one_referral_percent, description: `${rules.one_referral_percent}% off the next term` },
    { rule_name: "2 referrals – one free term", qualifying_referrals: 2, reward_type: "free_terms", reward_value: rules.two_referral_free_terms, description: `${rules.two_referral_free_terms} free term` },
    { rule_name: "3 referrals – two free terms", qualifying_referrals: 3, reward_type: "free_terms", reward_value: rules.three_referral_free_terms, description: `${rules.three_referral_free_terms} free terms` },
    { rule_name: "4 referrals – permanent free training", qualifying_referrals: 4, reward_type: "permanent_training_exemption", reward_value: rules.four_referrals_permanent_free ? 1 : 0, description: "Train free permanently; gasshukus and gradings excluded" }
  ];

  const { data: existing, error } = await supabase.from("referral_reward_rules").select("id,rule_name").is("deleted_at", null);
  if (error) throw error;

  for (const definition of definitions) {
    const match = (existing || []).find(item => item.rule_name === definition.rule_name);
    const payload = { ...definition, is_active: true, effective_from: new Date().toISOString().slice(0, 10), effective_to: null };
    const result = match
      ? await supabase.from("referral_reward_rules").update(payload).eq("id", match.id)
      : await supabase.from("referral_reward_rules").insert(payload);
    if (result.error) throw result.error;
  }
}

function activeAdministratorUserIds() {
  const administratorRole = accessState.roles.find(role => role.role_code === "administrator");
  if (!administratorRole) return new Set();

  const activeUserIds = new Set(
    accessState.users
      .filter(user => user.is_active && !user.revoked_at)
      .map(user => user.id)
  );

  return new Set(
    accessState.assignments
      .filter(assignment =>
        !assignment.removed_at &&
        assignment.role_id === administratorRole.id &&
        activeUserIds.has(assignment.authorised_user_id)
      )
      .map(assignment => assignment.authorised_user_id)
  );
}

function isCurrentSignedInUser(user) {
  return Boolean(user?.auth_user_id && user.auth_user_id === accessState.currentAuthUserId);
}

function handleAccessAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const user = accessState.users.find(item => item.id === button.dataset.id); if (!user) return;
  if (button.dataset.action === "edit-access") openAccessDialog(user);
  if (button.dataset.action === "revoke-access") revokeAccess(user);
  if (button.dataset.action === "reactivate-access") reactivateAccess(user);
}

function openAccessDialog(user = null) {
  const activeAssignment = user ? accessState.assignments.find(item => item.authorised_user_id === user.id && !item.removed_at) : null;
  openDialog({
    title: user ? "Change authorised access" : "Authorise Microsoft account", eyebrow: "System",
    body: `<form id="accessForm" class="form-grid"><input type="hidden" name="id" value="${user?.id || ""}"><label class="form-field full"><span class="form-label">Microsoft account email</span><input class="input" type="email" name="email" required value="${escapeHtml(user?.email || "")}" ${user ? "readonly" : ""}></label><label class="form-field"><span class="form-label">Role</span><select class="select" name="roleId" required><option value="">Select role</option>${accessState.roles.map(role => `<option value="${role.id}" ${activeAssignment?.role_id === role.id ? "selected" : ""}>${escapeHtml(role.role_name)}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Access expires</span><input class="input" type="datetime-local" name="expires" value="${user?.access_expires_at ? new Date(user.access_expires_at).toISOString().slice(0,16) : ""}"></label><label class="form-field full"><span class="form-label">Reason / notes</span><textarea class="textarea" name="reason">${escapeHtml(user?.authorisation_reason || "Authorised dojo user")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveAccessButton" class="button button-primary" type="button">${user ? "Save access" : "Authorise user"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveAccessButton").addEventListener("click", saveAccess);
}

async function saveAccess(event) {
  const button = event.currentTarget, form = document.getElementById("accessForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), email = normaliseText(data.get("email")).toLowerCase(), roleId = data.get("roleId"), supabase = getSupabaseClient();
    const administratorRole = accessState.roles.find(role => role.role_code === "administrator");
    const currentAssignment = id
      ? accessState.assignments.find(item => item.authorised_user_id === id && !item.removed_at)
      : null;
    const currentlyAdministrator = Boolean(
      currentAssignment && currentAssignment.role_id === administratorRole?.id
    );
    const remainingAdministrators = activeAdministratorUserIds();

    if (
      id &&
      currentlyAdministrator &&
      roleId !== administratorRole?.id &&
      remainingAdministrators.size <= 1
    ) {
      throw new Error("The dojo must retain at least one active Administrator.");
    }

    let userId = id;
    if (id) {
      const { error } = await supabase.from("authorised_users").update({ access_expires_at: data.get("expires") ? new Date(data.get("expires")).toISOString() : null, authorisation_reason: normaliseText(data.get("reason")) || null, is_active: true, revoked_at: null, revocation_reason: null }).eq("id", id); if (error) throw error;
    } else {
      const { data: user, error } = await supabase.from("authorised_users").insert({ email, is_active: true, access_expires_at: data.get("expires") ? new Date(data.get("expires")).toISOString() : null, authorisation_reason: normaliseText(data.get("reason")) || "Authorised dojo user" }).select("id").single(); if (error) throw error; userId = user.id;
    }
    const activeAssignments = accessState.assignments.filter(item => item.authorised_user_id === userId && !item.removed_at);
    for (const assignment of activeAssignments) if (assignment.role_id !== roleId) await supabase.from("user_role_assignments").update({ removed_at: new Date().toISOString() }).eq("id", assignment.id);
    const existing = accessState.assignments.find(item => item.authorised_user_id === userId && item.role_id === roleId);
    if (existing) { const { error } = await supabase.from("user_role_assignments").update({ removed_at: null, removed_by: null, notes: "Role assigned through Settings" }).eq("id", existing.id); if (error) throw error; }
    else { const { error } = await supabase.from("user_role_assignments").insert({ authorised_user_id: userId, role_id: roleId, notes: "Role assigned through Settings" }); if (error) throw error; }
    closeDialog(); await renderSettings(document.getElementById("moduleContent")); notifySuccess(id ? "Access updated." : "User authorised. They can sign in with that Microsoft account.");
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

async function revokeAccess(user) {
  if (isCurrentSignedInUser(user)) {
    notifyError(new Error("You cannot revoke the Microsoft account currently signed in."));
    return;
  }

  const administratorRole = accessState.roles.find(role => role.role_code === "administrator");
  const isAdministrator = accessState.assignments.some(item =>
    item.authorised_user_id === user.id &&
    item.role_id === administratorRole?.id &&
    !item.removed_at
  );

  if (isAdministrator && activeAdministratorUserIds().size <= 1) {
    notifyError(new Error("The dojo must retain at least one active Administrator."));
    return;
  }

  const reason = window.prompt(
    `Reason for revoking ${user.email}:`,
    "Access no longer required"
  );
  if (reason === null) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("authorised_users")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: normaliseText(reason) || "Access revoked"
      })
      .eq("id", user.id);

    if (error) throw error;
    await renderSettings(document.getElementById("moduleContent"));
    notifySuccess("Access revoked.");
  } catch (error) {
    notifyError(error);
  }
}

async function reactivateAccess(user) {
  try { const supabase = getSupabaseClient(); const { error } = await supabase.from("authorised_users").update({ is_active: true, revoked_at: null, revoked_by: null, revocation_reason: null }).eq("id", user.id); if (error) throw error; await renderSettings(document.getElementById("moduleContent")); notifySuccess("Access reactivated."); }
  catch (error) { notifyError(error); }
}

function attr(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"); }
function text(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
