import { formatCurrency } from "./utilities.js?v=1.2.1";

export const DEFAULT_FEE_SETTINGS = Object.freeze({
  weekly_fee: 20,
  first_term_fee: 120,
  sibling_term_fee: 100,
  white_belt_grading_fee: 180,
  colour_belt_grading_fee: 150
});

export const DEFAULT_REFERRAL_RULES = Object.freeze({
  one_referral_percent: 50,
  two_referral_free_terms: 1,
  three_referral_free_terms: 2,
  four_referrals_permanent_free: true
});

export function parseBillingNotes(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { notes: String(value) };
  }
}

export function normaliseBillingProfile(row = {}) {
  const notes = parseBillingNotes(row.billing_notes);
  return {
    id: row.id || null,
    student_id: row.student_id || null,
    payment_plan: row.payment_plan || null,
    is_exempt: Boolean(row.is_exempt),
    exemption_reason: row.exemption_reason || null,
    family_position_override: notes.family_position_override || "auto",
    custom_amount: finiteOrNull(notes.custom_amount),
    custom_amount_period: notes.custom_amount_period || "term",
    referral_count: clampInteger(notes.referral_count, 0, 4),
    referral_discount_percent: clampNumber(notes.referral_discount_percent, 0, 100),
    reward_terms_remaining: clampInteger(notes.reward_terms_remaining, 0, 99),
    permanent_free: Boolean(notes.permanent_free),
    reward_last_used_term_id: notes.reward_last_used_term_id || null,
    notes: notes.notes || ""
  };
}

export function referralDefaults(referralCount, rules = DEFAULT_REFERRAL_RULES) {
  const count = clampInteger(referralCount, 0, 4);
  if (count >= 4) {
    return {
      referral_discount_percent: 100,
      reward_terms_remaining: 0,
      permanent_free: rules.four_referrals_permanent_free !== false,
      label: "Train free permanently (gasshukus and gradings excluded)"
    };
  }
  if (count === 3) {
    return {
      referral_discount_percent: 100,
      reward_terms_remaining: clampInteger(rules.three_referral_free_terms, 0, 99),
      permanent_free: false,
      label: `${clampInteger(rules.three_referral_free_terms, 0, 99)} free term${clampInteger(rules.three_referral_free_terms, 0, 99) === 1 ? "" : "s"}`
    };
  }
  if (count === 2) {
    return {
      referral_discount_percent: 100,
      reward_terms_remaining: clampInteger(rules.two_referral_free_terms, 0, 99),
      permanent_free: false,
      label: `${clampInteger(rules.two_referral_free_terms, 0, 99)} free term${clampInteger(rules.two_referral_free_terms, 0, 99) === 1 ? "" : "s"}`
    };
  }
  if (count === 1) {
    return {
      referral_discount_percent: clampNumber(rules.one_referral_percent, 0, 100),
      reward_terms_remaining: 1,
      permanent_free: false,
      label: `${clampNumber(rules.one_referral_percent, 0, 100)}% off the next term`
    };
  }
  return {
    referral_discount_percent: 0,
    reward_terms_remaining: 0,
    permanent_free: false,
    label: "No referral reward"
  };
}

export function resolveFamilyPosition(student, students, profile = {}) {
  if (profile.family_position_override === "first") return "first";
  if (profile.family_position_override === "additional") return "additional";
  if (!student?.family_id) return "first";

  const familyStudents = (students || [])
    .filter(candidate =>
      candidate.family_id === student.family_id &&
      !candidate.deleted_at &&
      ["active", "paused", "trial"].includes(candidate.status)
    )
    .sort((a, b) => {
      const dateComparison = String(a.start_date || "").localeCompare(String(b.start_date || ""));
      if (dateComparison) return dateComparison;
      return String(a.created_at || a.id).localeCompare(String(b.created_at || b.id));
    });

  return familyStudents[0]?.id === student.id ? "first" : "additional";
}

export function calculateStudentPricing({
  student,
  students = [],
  profile = {},
  feeSettings = DEFAULT_FEE_SETTINGS,
  term = null
}) {
  const billing = { ...normaliseBillingProfile(profile), ...profile };
  const paymentPlan = student?.payment_plan || billing.payment_plan || "term";
  const familyPosition = resolveFamilyPosition(student, students, billing);
  const weeks = Math.max(Number(term?.number_of_training_weeks || 0), 0);
  const weeklyRate = Number(feeSettings.weekly_fee ?? DEFAULT_FEE_SETTINGS.weekly_fee);
  const standardTermRate = familyPosition === "additional"
    ? Number(feeSettings.sibling_term_fee ?? DEFAULT_FEE_SETTINGS.sibling_term_fee)
    : Number(feeSettings.first_term_fee ?? DEFAULT_FEE_SETTINGS.first_term_fee);

  let baseUnitAmount = paymentPlan === "weekly" ? weeklyRate : standardTermRate;
  let termEstimate = paymentPlan === "weekly" ? weeklyRate * weeks : standardTermRate;
  let effectiveUnitAmount = baseUnitAmount;
  let effectiveTermAmount = termEstimate;
  let adjustmentLabel = familyPosition === "additional" && paymentPlan === "term"
    ? "Sibling term rate"
    : "Standard rate";

  const customAmount = finiteOrNull(billing.custom_amount);
  if (customAmount !== null) {
    if (billing.custom_amount_period === "week") {
      effectiveUnitAmount = customAmount;
      effectiveTermAmount = customAmount * weeks;
      adjustmentLabel = "Custom weekly amount";
    } else {
      effectiveTermAmount = customAmount;
      effectiveUnitAmount = paymentPlan === "weekly" && weeks > 0
        ? customAmount / weeks
        : customAmount;
      adjustmentLabel = "Custom term amount";
    }
  }

  const rewardAvailable = billing.permanent_free || Number(billing.reward_terms_remaining || 0) > 0;
  const rewardPercent = billing.permanent_free
    ? 100
    : Math.min(Math.max(Number(billing.referral_discount_percent || 0), 0), 100);

  // Referral rewards apply to normal training for a term, regardless of
  // whether the usual payment plan is weekly or term. They do not apply to
  // gradings, gasshukus or other event charges.
  if (rewardAvailable && rewardPercent > 0 && customAmount === null) {
    const referralBase = paymentPlan === "weekly" ? termEstimate : standardTermRate;
    effectiveTermAmount = referralBase * (1 - rewardPercent / 100);
    effectiveUnitAmount = paymentPlan === "weekly" && weeks > 0
      ? effectiveTermAmount / weeks
      : effectiveTermAmount;
    adjustmentLabel = billing.permanent_free
      ? "Permanent referral reward"
      : `${rewardPercent}% referral reward`;
  }

  if (student?.is_exempt_from_fees || billing.is_exempt || paymentPlan === "exempt") {
    effectiveUnitAmount = 0;
    effectiveTermAmount = 0;
    adjustmentLabel = "Fee exempt";
  }

  return {
    paymentPlan,
    familyPosition,
    weeks,
    weeklyRate: roundMoney(weeklyRate),
    baseUnitAmount: roundMoney(baseUnitAmount),
    standardTermRate: roundMoney(standardTermRate),
    standardTermEstimate: roundMoney(termEstimate),
    effectiveUnitAmount: roundMoney(effectiveUnitAmount),
    effectiveTermAmount: roundMoney(effectiveTermAmount),
    customAmount,
    adjustmentLabel,
    rewardAvailable,
    rewardPercent
  };
}

export function billingListLabel(pricing) {
  if (!pricing) return "Not configured";
  if (pricing.paymentPlan === "weekly") {
    const estimate = pricing.weeks > 0
      ? ` · ${formatCurrency(pricing.effectiveTermAmount)} across ${pricing.weeks} week${pricing.weeks === 1 ? "" : "s"}`
      : "";
    return `${formatCurrency(pricing.effectiveUnitAmount)} per week${estimate}`;
  }
  return `${formatCurrency(pricing.effectiveTermAmount)} per term`;
}

export function referralSummary(profile) {
  const billing = normaliseBillingProfile(profile);
  if (billing.permanent_free) {
    return "4 referrals: trains free permanently (gasshukus and gradings excluded)";
  }
  if (billing.referral_count === 3) {
    return `${billing.reward_terms_remaining} of 2 free terms remaining`;
  }
  if (billing.referral_count === 2) {
    return `${billing.reward_terms_remaining} of 1 free term remaining`;
  }
  if (billing.referral_count === 1) {
    return billing.reward_terms_remaining > 0
      ? "50% off next term available"
      : "50% referral reward used";
  }
  return "No active referral reward";
}

export function discountSummary(pricing) {
  if (!pricing) return null;
  if (pricing.adjustmentLabel === "Standard rate") return null;
  return `${pricing.adjustmentLabel}: ${pricing.paymentPlan === "weekly"
    ? `${formatCurrency(pricing.effectiveUnitAmount)} per week`
    : `${formatCurrency(pricing.effectiveTermAmount)} per term`}`;
}

export function serializeBillingNotes(profile) {
  return JSON.stringify({
    version: 1,
    family_position_override: profile.family_position_override || "auto",
    custom_amount: finiteOrNull(profile.custom_amount),
    custom_amount_period: profile.custom_amount_period || "term",
    referral_count: clampInteger(profile.referral_count, 0, 4),
    referral_discount_percent: clampNumber(profile.referral_discount_percent, 0, 100),
    reward_terms_remaining: clampInteger(profile.reward_terms_remaining, 0, 99),
    permanent_free: Boolean(profile.permanent_free),
    reward_last_used_term_id: profile.reward_last_used_term_id || null,
    notes: String(profile.notes || "").trim()
  });
}

export function consumeReferralReward(profile, termId) {
  const billing = normaliseBillingProfile(profile);
  if (billing.permanent_free || billing.reward_terms_remaining <= 0) return billing;
  return {
    ...billing,
    reward_terms_remaining: Math.max(billing.reward_terms_remaining - 1, 0),
    reward_last_used_term_id: termId || billing.reward_last_used_term_id
  };
}

function finiteOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? roundMoney(number) : null;
}

function clampInteger(value, minimum, maximum) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(Math.max(number, minimum), maximum);
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(Math.max(number, minimum), maximum);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
