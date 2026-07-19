import { buildCorsHeaders, HttpError, jsonResponse } from "../_shared/cors.ts";
import { assertAllowedOrigin, authenticateRequest, type AuthContext } from "../_shared/auth.ts";
import { getAccount, getAccounts, getAccountTransactions, maskAccount, safeAccountForClient } from "../_shared/akahu.ts";
import { buildMatchSuggestions, normaliseAkahuTransaction } from "../_shared/matching.ts";

type RequestBody = {
  action?: string;
  accountId?: string;
  financialAccountId?: string;
  connectionId?: string;
  connectionName?: string;
  lookbackDays?: number;
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Only POST requests are supported.");
    }

    assertAllowedOrigin(req);
    const auth = await authenticateRequest(req);
    const body = await req.json().catch(() => ({})) as RequestBody;
    const action = body.action || "status";

    switch (action) {
      case "status":
        return jsonResponse(await getSyncStatus(auth), 200, origin);
      case "listAccounts":
        requireUserMode(auth);
        return jsonResponse(await listAccounts(), 200, origin);
      case "connectAccount":
        requireUserMode(auth);
        return jsonResponse(await connectAccount(auth, body), 200, origin);
      case "syncTransactions":
        return jsonResponse(await syncTransactions(auth, body), 200, origin);
      case "disconnectAccount":
        requireUserMode(auth);
        return jsonResponse(await disconnectAccount(auth, body), 200, origin);
      default:
        throw new HttpError(400, `Unsupported bank-sync action: ${action}`);
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof HttpError ? error.details : undefined;

    console.error("kiwibank-sync error", { status, message, details });
    return jsonResponse({ ok: false, error: message, details }, status, origin);
  }
});


function safeErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    const details = error.details as Record<string, unknown> | undefined;
    const detailParts: string[] = [];

    if (details?.path) detailParts.push(`path=${String(details.path)}`);
    if (details?.status) detailParts.push(`provider_status=${String(details.status)}`);
    if (details?.message) detailParts.push(`provider_message=${String(details.message)}`);

    return detailParts.length
      ? `${error.message} (${detailParts.join("; ")})`
      : error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

function requireUserMode(auth: AuthContext): void {
  if (auth.mode !== "user") {
    throw new HttpError(403, "This action requires a signed-in dojo administrator.");
  }
}

async function getSyncStatus(auth: AuthContext) {
  const { data, error } = await auth.adminClient
    .from("bank_sync_connection_status")
    .select("*")
    .order("last_sync_attempt_at", { ascending: false, nullsFirst: false });

  if (error) throw new HttpError(500, "Could not load bank-sync status.", error.message);

  return {
    ok: true,
    mode: auth.mode,
    connections: data || []
  };
}

async function listAccounts() {
  const accounts = await getAccounts();
  return {
    ok: true,
    accounts: accounts
      .map(safeAccountForClient)
      .filter(account => Boolean(account.id))
  };
}

async function connectAccount(auth: AuthContext, body: RequestBody) {
  if (!body.accountId) throw new HttpError(400, "Missing Akahu account ID.");
  if (!body.financialAccountId) throw new HttpError(400, "Missing dojo financial account ID.");

  const account = await getAccount(body.accountId);
  const masked = maskAccount(account);

  if (!masked.external_account_id) {
    throw new HttpError(400, "Akahu account did not include a stable account ID.");
  }

  const payload = {
    provider: "akahu",
    connection_name: body.connectionName || "Kiwibank Dojo Account",
    financial_account_id: body.financialAccountId,
    external_account_id: String(masked.external_account_id),
    masked_account_name: String(masked.masked_account_name || "Kiwibank account"),
    masked_account_number: String(masked.masked_account_number || "Masked account"),
    currency_code: String(masked.currency_code || "NZD"),
    read_only: true,
    status: "active",
    last_bank_refresh_at: masked.last_bank_refresh_at,
    current_balance: masked.current_balance,
    available_balance: masked.available_balance,
    balance_updated_at: masked.balance_updated_at,
    disconnected_at: null,
    disconnect_reason: null,
    created_by: auth.userId,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: existingError } = await auth.adminClient
    .from("bank_connections")
    .select("id")
    .eq("provider", "akahu")
    .eq("external_account_id", payload.external_account_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) throw new HttpError(500, "Could not check existing bank connection.", existingError.message);

  const query = existing?.id
    ? auth.adminClient.from("bank_connections").update(payload).eq("id", existing.id).select("*").single()
    : auth.adminClient.from("bank_connections").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw new HttpError(500, "Could not save bank connection.", error.message);

  return {
    ok: true,
    connection: data
  };
}

async function disconnectAccount(auth: AuthContext, body: RequestBody) {
  if (!body.connectionId) throw new HttpError(400, "Missing bank connection ID.");

  const { data, error } = await auth.adminClient
    .from("bank_connections")
    .update({
      status: "disconnected",
      disconnected_at: new Date().toISOString(),
      disconnect_reason: "Disconnected from Dojo Manager",
      updated_at: new Date().toISOString()
    })
    .eq("id", body.connectionId)
    .select("*")
    .single();

  if (error) throw new HttpError(500, "Could not disconnect bank connection.", error.message);

  return {
    ok: true,
    connection: data,
    note: "Historical transactions remain in the dojo records. Revoke access in MyAkahu if required."
  };
}

async function syncTransactions(auth: AuthContext, body: RequestBody) {
  const lookbackDays = Math.min(Math.max(Number(body.lookbackDays || 7), 1), 730);
  const connectionId = body.connectionId || await findActiveConnectionId(auth);
  if (!connectionId) throw new HttpError(400, "No active bank connection found.");

  const { data: connection, error: connectionError } = await auth.adminClient
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .is("deleted_at", null)
    .single();

  if (connectionError || !connection) {
    throw new HttpError(404, "Bank connection was not found.", connectionError?.message);
  }

  if (connection.status !== "active") {
    throw new HttpError(400, "Bank connection is not active.");
  }

  if (!connection.financial_account_id) {
    throw new HttpError(400, "Bank connection is not mapped to a dojo financial account.");
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - lookbackDays);
  const start = startDate.toISOString();
  const end = now.toISOString();

  const { data: run, error: runError } = await auth.adminClient
    .from("bank_sync_runs")
    .insert({
      connection_id: connection.id,
      run_type: auth.mode === "cron" ? "scheduled" : (lookbackDays <= 7 ? "test" : "manual"),
      lookback_days: lookbackDays,
      status: "started",
      started_at: now.toISOString(),
      requested_from: start.slice(0, 10),
      requested_to: end.slice(0, 10),
      created_by: auth.userId,
      correlation_id: crypto.randomUUID()
    })
    .select("*")
    .single();

  if (runError) throw new HttpError(500, "Could not create bank sync run.", runError.message);

  let transactionsSeen = 0;
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;
  let possibleMatches = 0;
  let uncategorised = 0;
  let transfers = 0;

  try {
    const account = await getAccount(connection.external_account_id);
    const masked = maskAccount(account);

    await auth.adminClient
      .from("bank_connections")
      .update({
        last_bank_refresh_at: masked.last_bank_refresh_at,
        current_balance: masked.current_balance,
        available_balance: masked.available_balance,
        balance_updated_at: masked.balance_updated_at,
        updated_at: new Date().toISOString()
      })
      .eq("id", connection.id);

    const { data: batch, error: batchError } = await auth.adminClient
      .from("bank_import_batches")
      .insert({
        account_id: connection.financial_account_id,
        file_name: `akahu-sync-${run.id}.json`,
        file_hash: run.correlation_id,
        imported_by: auth.userId,
        statement_start_date: start.slice(0, 10),
        statement_end_date: end.slice(0, 10),
        status: "confirmed",
        safety_snapshot_reference: `Akahu sync ${run.id}`,
        notes: "Server-side Akahu import. Tokens stored only as Edge Function secrets."
      })
      .select("*")
      .single();

    if (batchError) throw new HttpError(500, "Could not create bank import batch for Akahu sync.", batchError.message);

    const rawTransactions = await getAccountTransactions(connection.external_account_id, start, end);
    transactionsSeen = rawTransactions.length;

    const candidates = await loadMatchingCandidates(auth);

    for (const rawTransaction of rawTransactions) {
      const normalised = await normaliseAkahuTransaction(rawTransaction, connection.external_account_id);
      const existing = await findExistingTransaction(auth, normalised.external_transaction_id, normalised.fingerprint);

      if (existing?.duplicate) {
        duplicates += 1;
        continue;
      }

      let bankTransactionId: string;
      const transactionPayload = {
        bank_import_batch_id: batch.id,
        account_id: connection.financial_account_id,
        bank_connection_id: connection.id,
        source_type: "akahu",
        provider: "akahu",
        external_transaction_id: normalised.external_transaction_id,
        external_account_id: normalised.external_account_id,
        bank_sync_run_id: run.id,
        provider_created_at: normalised.provider_created_at,
        provider_updated_at: normalised.provider_updated_at,
        last_seen_at: new Date().toISOString(),
        transaction_kind: normalised.transaction_kind,
        transaction_date: normalised.transaction_date,
        description: normalised.description,
        reference: normalised.reference,
        particulars: normalised.particulars,
        code: normalised.code,
        money_in: normalised.money_in,
        money_out: normalised.money_out,
        signed_amount: normalised.signed_amount,
        balance: normalised.balance,
        original_values: {},
        provider_metadata: normalised.provider_metadata,
        fingerprint: normalised.fingerprint,
        categorisation_status: normalised.transaction_kind === "transfer" ? "transfer" : "suggested",
        confirmation_status: "pending_review",
        created_by: auth.userId,
        updated_by: auth.userId,
        updated_at: new Date().toISOString()
      };

      if (existing?.id) {
        const { data, error } = await auth.adminClient
          .from("bank_transactions")
          .update({
            ...transactionPayload,
            bank_import_batch_id: existing.bank_import_batch_id || batch.id,
            account_id: existing.account_id || connection.financial_account_id
          })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (error) throw new HttpError(500, "Could not update Akahu transaction.", error.message);
        bankTransactionId = data.id;
        updated += 1;
      } else {
        const { data, error } = await auth.adminClient
          .from("bank_transactions")
          .insert(transactionPayload)
          .select("id")
          .single();
        if (error) throw new HttpError(500, "Could not insert Akahu transaction.", error.message);
        bankTransactionId = data.id;
        inserted += 1;
      }

      if (normalised.transaction_kind === "transfer") transfers += 1;

      await auth.adminClient
        .from("bank_match_suggestions")
        .update({ status: "superseded", resolved_at: new Date().toISOString(), resolved_by: auth.userId })
        .eq("bank_transaction_id", bankTransactionId)
        .eq("status", "pending");

      const suggestions = await buildMatchSuggestions(bankTransactionId, normalised, candidates);
      if (suggestions.length) {
        const { error } = await auth.adminClient
          .from("bank_match_suggestions")
          .insert(suggestions);
        if (error) throw new HttpError(500, "Could not save bank match suggestions.", error.message);
        possibleMatches += suggestions.filter(item => item.confidence_level !== "no_match").length;
        uncategorised += suggestions.filter(item => item.confidence_level === "no_match").length;
      }
    }

    await auth.adminClient
      .from("bank_import_batches")
      .update({
        row_count: transactionsSeen,
        confirmed_row_count: inserted + updated,
        duplicate_row_count: duplicates,
        updated_at: new Date().toISOString(),
        updated_by: auth.userId
      })
      .eq("id", batch.id);

    await auth.adminClient
      .from("bank_sync_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        transactions_seen: transactionsSeen,
        transactions_inserted: inserted,
        transactions_updated: updated,
        duplicates_ignored: duplicates,
        auto_matches: 0,
        possible_matches: possibleMatches,
        uncategorised_count: uncategorised,
        transfers_detected: transfers
      })
      .eq("id", run.id);

    await auth.adminClient
      .from("bank_connections")
      .update({ last_successful_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connection.id);

    return {
      ok: true,
      connection_id: connection.id,
      sync_run_id: run.id,
      lookback_days: lookbackDays,
      transactions_seen: transactionsSeen,
      transactions_inserted: inserted,
      transactions_updated: updated,
      duplicates_ignored: duplicates,
      possible_matches: possibleMatches,
      uncategorised_count: uncategorised,
      transfers_detected: transfers,
      auto_matches: 0,
      review_required: possibleMatches + uncategorised
    };
  } catch (error) {
    await auth.adminClient
      .from("bank_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        transactions_seen: transactionsSeen,
        transactions_inserted: inserted,
        transactions_updated: updated,
        duplicates_ignored: duplicates,
        possible_matches: possibleMatches,
        uncategorised_count: uncategorised,
        transfers_detected: transfers,
        error_message: safeErrorMessage(error)
      })
      .eq("id", run.id);
    throw error;
  }
}

async function findActiveConnectionId(auth: AuthContext): Promise<string | null> {
  const { data, error } = await auth.adminClient
    .from("bank_connections")
    .select("id")
    .eq("provider", "akahu")
    .eq("status", "active")
    .is("deleted_at", null)
    .is("disconnected_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, "Could not find active bank connection.", error.message);
  return data?.id || null;
}

async function findExistingTransaction(auth: AuthContext, externalId: string, fingerprint: string): Promise<any | null> {
  const { data: byExternal, error: externalError } = await auth.adminClient
    .from("bank_transactions")
    .select("id, bank_import_batch_id, account_id")
    .eq("provider", "akahu")
    .eq("external_transaction_id", externalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (externalError) throw new HttpError(500, "Could not check Akahu duplicate transaction ID.", externalError.message);
  if (byExternal) return byExternal;

  const { data: byFingerprint, error: fingerprintError } = await auth.adminClient
    .from("bank_transactions")
    .select("id")
    .eq("fingerprint", fingerprint)
    .is("deleted_at", null)
    .maybeSingle();

  if (fingerprintError) throw new HttpError(500, "Could not check duplicate transaction fingerprint.", fingerprintError.message);
  if (byFingerprint) return { ...byFingerprint, duplicate: true };

  return null;
}

async function loadMatchingCandidates(auth: AuthContext) {
  const [students, families, charges, payments, expenses, expensePayments] = await Promise.all([
    auth.adminClient.from("students").select("id, first_name, last_name, preferred_name, family_id").is("deleted_at", null),
    auth.adminClient.from("families").select("id, family_name, billing_name, payment_reference").is("deleted_at", null),
    auth.adminClient.from("charges").select("id, student_id, family_id, final_amount, status, description, due_date, fee_type").is("deleted_at", null),
    auth.adminClient.from("payments").select("id, family_id, amount, payment_date, bank_reference, bank_description, payment_status").is("deleted_at", null),
    auth.adminClient.from("expenses").select("id, amount, description, payment_status, supplier_or_payee, expense_date").is("deleted_at", null),
    auth.adminClient.from("expense_payments").select("id, expense_id, amount, payment_date, bank_reference, status").is("deleted_at", null)
  ]);

  for (const result of [students, families, charges, payments, expenses, expensePayments]) {
    if (result.error) throw new HttpError(500, "Could not load matching candidates.", result.error.message);
  }

  return {
    students: students.data || [],
    families: families.data || [],
    charges: charges.data || [],
    payments: payments.data || [],
    expenses: expenses.data || [],
    expensePayments: expensePayments.data || []
  };
}
