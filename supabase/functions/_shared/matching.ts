export type NormalisedTransaction = {
  external_transaction_id: string;
  external_account_id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  particulars: string | null;
  code: string | null;
  money_in: number | null;
  money_out: number | null;
  signed_amount: number;
  balance: number | null;
  fingerprint: string;
  transaction_kind: "income" | "expense" | "transfer" | "unknown";
  provider_created_at: string | null;
  provider_updated_at: string | null;
  provider_metadata: Record<string, unknown>;
};

export async function normaliseAkahuTransaction(transaction: any, accountId: string): Promise<NormalisedTransaction> {
  const amount = Number(transaction?.amount ?? transaction?.value ?? 0);
  const signedAmount = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
  const description = compactText(
    transaction?.description ||
    transaction?.merchant?.name ||
    transaction?.meta?.description ||
    transaction?.type ||
    "Akahu transaction"
  );
  const reference = compactText(transaction?.reference || transaction?.meta?.reference || "") || null;
  const particulars = compactText(transaction?.particulars || transaction?.meta?.particulars || "") || null;
  const code = compactText(transaction?.code || transaction?.meta?.code || "") || null;
  const dateValue = transaction?.date || transaction?.posted_at || transaction?.created_at || transaction?.updated_at;
  const transactionDate = toDateOnly(dateValue);
  const kind = classifyKind(transaction, signedAmount, `${description} ${reference || ""} ${particulars || ""} ${code || ""}`);

  const fingerprintSource = [
    accountId,
    transactionDate,
    signedAmount.toFixed(2),
    description,
    reference || "",
    particulars || "",
    code || ""
  ].join("|").toLowerCase();

  return {
    external_transaction_id: String(transaction?._id || transaction?.id || await sha256(fingerprintSource)),
    external_account_id: String(transaction?._account || transaction?.account || accountId),
    transaction_date: transactionDate,
    description,
    reference,
    particulars,
    code,
    money_in: signedAmount > 0 ? signedAmount : null,
    money_out: signedAmount < 0 ? Math.abs(signedAmount) : null,
    signed_amount: signedAmount,
    balance: numberOrNull(transaction?.balance),
    fingerprint: await sha256(fingerprintSource),
    transaction_kind: kind,
    provider_created_at: isoOrNull(transaction?.created_at),
    provider_updated_at: isoOrNull(transaction?.updated_at),
    provider_metadata: {
      akahu_type: transaction?.type || null,
      merchant_name: transaction?.merchant?.name || null,
      meta: safeMeta(transaction?.meta)
    }
  };
}

export async function buildMatchSuggestions(
  transactionId: string,
  transaction: NormalisedTransaction,
  candidates: {
    students: any[];
    families: any[];
    charges: any[];
    payments: any[];
    expenses: any[];
    expensePayments: any[];
  }
): Promise<any[]> {
  const text = [transaction.description, transaction.reference, transaction.particulars, transaction.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (transaction.transaction_kind === "transfer") {
    return [{
      bank_transaction_id: transactionId,
      suggestion_type: "transfer",
      confidence_level: "possible",
      confidence_score: 70,
      suggested_amount: Math.abs(transaction.signed_amount),
      reason_summary: "Bank description appears to be a transfer. Review before excluding from income and expenses.",
      reason_details: { matched_text: text },
      status: "pending"
    }];
  }

  if (transaction.signed_amount > 0) {
    const suggestions = paymentSuggestions(transactionId, transaction, candidates, text);
    return suggestions.length ? suggestions : [{
      bank_transaction_id: transactionId,
      suggestion_type: "uncategorised_income",
      confidence_level: "no_match",
      confidence_score: 0,
      suggested_amount: transaction.signed_amount,
      reason_summary: "No student, family, charge or existing payment match was clear enough.",
      reason_details: {},
      status: "pending"
    }];
  }

  if (transaction.signed_amount < 0) {
    const suggestions = expenseSuggestions(transactionId, transaction, candidates, text);
    return suggestions.length ? suggestions : [{
      bank_transaction_id: transactionId,
      suggestion_type: "uncategorised_expense",
      confidence_level: "no_match",
      confidence_score: 0,
      suggested_amount: Math.abs(transaction.signed_amount),
      reason_summary: "No expense or transfer rule matched clearly.",
      reason_details: {},
      status: "pending"
    }];
  }

  return [{
    bank_transaction_id: transactionId,
    suggestion_type: "unknown",
    confidence_level: "no_match",
    confidence_score: 0,
    suggested_amount: 0,
    reason_summary: "Transaction amount was zero or could not be interpreted.",
    reason_details: {},
    status: "pending"
  }];
}

function paymentSuggestions(transactionId: string, transaction: NormalisedTransaction, candidates: any, text: string): any[] {
  const amount = Number(transaction.signed_amount.toFixed(2));
  const unpaidCharges = candidates.charges.filter((charge: any) =>
    !charge.deleted_at &&
    ["unpaid", "partially_paid", "overdue"].includes(charge.status) &&
    Number(charge.final_amount) >= amount - 0.01
  );

  const suggestions: any[] = [];
  for (const charge of unpaidCharges) {
    const student = candidates.students.find((item: any) => item.id === charge.student_id);
    const family = candidates.families.find((item: any) => item.id === (charge.family_id || student?.family_id));
    const nameHit = containsEntityText(text, [
      student?.first_name,
      student?.last_name,
      student?.preferred_name,
      family?.family_name,
      family?.billing_name,
      family?.payment_reference
    ]);
    const exactAmount = Math.abs(Number(charge.final_amount) - amount) < 0.01;
    const score = (exactAmount ? 35 : 15) + (nameHit ? 45 : 0);

    if (score >= 50) {
      suggestions.push({
        bank_transaction_id: transactionId,
        suggestion_type: "payment",
        confidence_level: score >= 80 ? "exact" : "possible",
        confidence_score: Math.min(score, 100),
        student_id: student?.id || null,
        family_id: family?.id || charge.family_id || null,
        charge_id: charge.id,
        suggested_amount: amount,
        suggested_allocations: [{ charge_id: charge.id, amount }],
        reason_summary: score >= 80
          ? "Amount and student/family reference match an outstanding charge."
          : "Amount or student/family reference may match an outstanding charge.",
        reason_details: {
          exact_amount: exactAmount,
          matched_name_or_reference: nameHit,
          charge_description: charge.description
        },
        status: "pending"
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence_score - a.confidence_score).slice(0, 5);
}

function expenseSuggestions(transactionId: string, transaction: NormalisedTransaction, candidates: any, text: string): any[] {
  const amount = Math.abs(transaction.signed_amount);
  const expenseTerms = [
    "hall", "hire", "jkanz", "insurance", "equipment", "website", "software",
    "advertising", "uniform", "grading", "refund", "bank fee", "fee"
  ];
  const term = expenseTerms.find(item => text.includes(item));
  if (!term) return [];

  return [{
    bank_transaction_id: transactionId,
    suggestion_type: "expense",
    confidence_level: "possible",
    confidence_score: 65,
    suggested_amount: amount,
    reason_summary: `Description contains likely dojo expense term: ${term}.`,
    reason_details: { matched_term: term },
    status: "pending"
  }];
}

function classifyKind(transaction: any, amount: number, text: string): "income" | "expense" | "transfer" | "unknown" {
  const type = String(transaction?.type || "").toLowerCase();
  const lowerText = text.toLowerCase();
  if (type.includes("transfer") || lowerText.includes("transfer")) return "transfer";
  if (amount > 0) return "income";
  if (amount < 0) return "expense";
  return "unknown";
}

function containsEntityText(text: string, values: Array<string | null | undefined>): boolean {
  return values
    .map(value => compactText(value || "").toLowerCase())
    .filter(value => value.length >= 3)
    .some(value => text.includes(value));
}

function toDateOnly(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeMeta(meta: any): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return null;
  const allowed: Record<string, unknown> = {};
  for (const key of ["particulars", "code", "reference", "other_account", "description"]) {
    if (meta[key]) allowed[key] = meta[key];
  }
  return allowed;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}
