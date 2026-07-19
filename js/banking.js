import { getSupabaseClient } from "./database.js?v=1.3.0";
import { callKiwibankSync } from "./kiwibank-sync.js?v=1.3.0";
import { dispatchDataChanged, formatCurrency, formatDate, formatDateTime, normaliseText, parseMoney, todayIso } from "./utilities.js?v=1.3.0";
import {
  closeDialog, emptyState, escapeHtml, moduleHeader, notifyError,
  notifySuccess, openDialog, setButtonBusy, statusBadge
} from "./ui.js?v=1.3.0";

let state = { accounts: [], batches: [], transactions: [], payments: [], expensePayments: [], expenses: [], rules: [], reconciliations: [], connections: [], suggestions: [], syncRuns: [] };
let importPreview = null;

export async function renderBanking(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("financial_accounts").select("*").is("deleted_at", null).eq("is_active", true).order("account_nickname"),
    supabase.from("bank_import_batches").select("*").is("deleted_at", null).order("imported_at", { ascending: false }).limit(30),
    supabase.from("bank_transactions").select("*").is("deleted_at", null).order("transaction_date", { ascending: false }).limit(250),
    supabase.from("payments").select("id,payment_number,payment_date,amount,family_id,payment_status").is("deleted_at", null).eq("payment_status", "confirmed").order("payment_date", { ascending: false }).limit(200),
    supabase.from("expense_payments").select("*").is("deleted_at", null).eq("status", "confirmed").order("payment_date", { ascending: false }).limit(200),
    supabase.from("expenses").select("id,expense_number,description,supplier_or_payee,amount").is("deleted_at", null),
    supabase.from("matching_rules").select("*").is("deleted_at", null).eq("is_active", true).order("priority"),
    supabase.from("bank_reconciliations").select("*").is("deleted_at", null).order("period_end", { ascending: false }).limit(50),
    supabase.from("bank_sync_connection_status").select("*").order("last_sync_attempt_at", { ascending: false, nullsFirst: false }),
    supabase.from("bank_match_suggestions").select("*, bank_transactions(transaction_date,description,signed_amount,reference,particulars,code)").is("deleted_at", null).eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    supabase.from("bank_sync_runs").select("*").order("started_at", { ascending: false }).limit(20)
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.accounts, state.batches, state.transactions, state.payments, state.expensePayments, state.expenses, state.rules, state.reconciliations, state.connections, state.suggestions, state.syncRuns] = results.map(result => result.data || []);
}

function render(container) {
  const accountMap = new Map(state.accounts.map(item => [item.id, item.account_nickname]));
  const pending = state.transactions.filter(item => item.confirmation_status === "pending_review").length;
  const confirmed = state.transactions.filter(item => item.confirmation_status === "confirmed").length;
  const duplicates = state.transactions.filter(item => item.confirmation_status === "duplicate").length;
  const net = state.transactions.filter(item => item.confirmation_status === "confirmed").reduce((sum, item) => sum + Number(item.signed_amount), 0);

  const rows = state.transactions.map(transaction => `<tr data-status="${transaction.confirmation_status}">
    <td>${formatDate(transaction.transaction_date)}</td>
    <td><strong>${escapeHtml(transaction.description || "—")}</strong><div class="record-meta">${escapeHtml([transaction.reference, transaction.particulars, transaction.code].filter(Boolean).join(" · "))}</div></td>
    <td>${escapeHtml(accountMap.get(transaction.account_id) || "—")}</td>
    <td class="number-cell ${Number(transaction.signed_amount) >= 0 ? "positive-amount" : "negative-amount"}">${formatCurrency(transaction.signed_amount)}</td>
    <td>${transaction.balance == null ? "—" : formatCurrency(transaction.balance)}</td>
    <td>${statusBadge(transaction.confirmation_status)}</td>
    <td>${statusBadge(transaction.categorisation_status)}</td>
    <td class="table-actions"><button class="button button-secondary button-small" data-action="match" data-id="${transaction.id}" ${transaction.confirmation_status === "duplicate" ? "disabled" : ""}>Match</button><button class="button button-primary button-small" data-action="confirm" data-id="${transaction.id}" ${transaction.confirmation_status === "confirmed" ? "disabled" : ""}>Confirm</button><button class="button button-danger button-small" data-action="reject" data-id="${transaction.id}" ${transaction.confirmation_status === "rejected" ? "disabled" : ""}>Reject</button></td>
  </tr>`).join("");

  const batchRows = state.batches.map(batch => `<tr><td>${escapeHtml(batch.file_name)}</td><td>${formatDate(batch.statement_start_date)} – ${formatDate(batch.statement_end_date)}</td><td>${batch.row_count}</td><td>${batch.duplicate_row_count}</td><td>${statusBadge(batch.status)}</td><td>${escapeHtml(accountMap.get(batch.account_id) || "—")}</td></tr>`).join("");
  const recRows = state.reconciliations.map(rec => `<tr><td>${escapeHtml(accountMap.get(rec.account_id) || "—")}</td><td>${formatDate(rec.period_start)} – ${formatDate(rec.period_end)}</td><td>${formatCurrency(rec.imported_closing_balance)}</td><td>${formatCurrency(rec.calculated_closing_balance)}</td><td>${formatCurrency(rec.difference_amount)}</td><td>${statusBadge(rec.status)}</td></tr>`).join("");
  const syncPanel = renderKiwibankSyncPanel(accountMap);
  const suggestionPanel = renderBankMatchSuggestions();

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "Finance", title: "Banking", description: "Connect the selected Kiwibank dojo account through Akahu, keep CSV import as a fallback, and review every uncertain match.", actions: '<button id="openKiwibankSyncButton" class="button button-primary" type="button">Kiwibank Sync</button><button id="importBankCsvButton" class="button button-secondary" type="button">Import CSV</button><button id="reconcileButton" class="button button-secondary" type="button">Reconcile account</button><button id="matchingRulesButton" class="button button-secondary" type="button">Matching rules</button>' })}
    ${syncPanel}
    <div class="summary-grid"><article class="summary-tile"><span>Pending review</span><strong>${pending}</strong></article><article class="summary-tile"><span>Confirmed</span><strong>${confirmed}</strong></article><article class="summary-tile"><span>Duplicates</span><strong>${duplicates}</strong></article><article class="summary-tile"><span>Confirmed net movement</span><strong>${formatCurrency(net)}</strong></article></div>
    <section class="section-card"><div class="section-card-header"><div><h3>Imported transactions</h3><p class="muted">Every row requires review before it is treated as confirmed.</p></div><select id="bankStatusFilter" class="select compact-select"><option value="">All rows</option><option value="pending_review">Pending review</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option><option value="duplicate">Duplicate</option></select></div>${state.transactions.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Amount</th><th>Balance</th><th>Review</th><th>Category</th><th>Actions</th></tr></thead><tbody id="bankTransactionRows">${rows}</tbody></table></div>` : emptyState("No bank transactions", "Use Kiwibank Sync for the selected dojo account, or import a Kiwibank CSV fallback file.")}</section>
    ${suggestionPanel}
    <section class="section-card"><div class="section-card-header"><div><h3>Import and sync history</h3></div></div>${state.batches.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>File</th><th>Statement period</th><th>Rows</th><th>Duplicates</th><th>Status</th><th>Account</th></tr></thead><tbody>${batchRows}</tbody></table></div>` : emptyState("No import history", "Kiwibank sync and confirmed CSV imports will appear here.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Reconciliations</h3></div></div>${state.reconciliations.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Account</th><th>Period</th><th>Imported close</th><th>Calculated close</th><th>Difference</th><th>Status</th></tr></thead><tbody>${recRows}</tbody></table></div>` : emptyState("No reconciliations", "Create a reconciliation after confirming a statement period.")}</section>
  </div>`;

  container.querySelector("#openKiwibankSyncButton")?.addEventListener("click", openKiwibankSyncDialog);
  container.querySelector("#connectKiwibankPanelButton")?.addEventListener("click", openKiwibankSyncDialog);
  container.querySelector("#syncKiwibank7Button")?.addEventListener("click", event => runKiwibankSync(7, event.currentTarget));
  container.querySelector("#syncKiwibank30Button")?.addEventListener("click", event => runKiwibankSync(30, event.currentTarget));
  container.querySelector("#disconnectKiwibankButton")?.addEventListener("click", event => disconnectKiwibankConnection(event.currentTarget));
  container.querySelector("#importBankCsvButton").addEventListener("click", openImportDialog);
  container.querySelector("#reconcileButton").addEventListener("click", openReconciliationDialog);
  container.querySelector("#matchingRulesButton").addEventListener("click", openRulesDialog);
  container.querySelector("#bankStatusFilter")?.addEventListener("change", event => document.querySelectorAll("#bankTransactionRows tr").forEach(row => row.hidden = event.target.value && row.dataset.status !== event.target.value));
  container.querySelector("#bankTransactionRows")?.addEventListener("click", handleTransactionAction);
}


function activeKiwibankConnection() {
  return state.connections.find(item => item.status === "active" && !item.disconnected_at)
    || state.connections.find(item => !item.disconnected_at)
    || null;
}

function renderKiwibankSyncPanel(accountMap) {
  const connection = activeKiwibankConnection();
  const pendingSuggestions = state.suggestions.filter(item => item.status === "pending").length;
  const lastRun = state.syncRuns[0];

  if (!connection) {
    return `
      <section class="section-card">
        <div class="section-card-header">
          <div>
            <h3>Kiwibank Sync</h3>
            <p class="muted">No Akahu account is mapped yet. Load accounts through the server-side Edge Function and select only the dojo Kiwibank account.</p>
          </div>
          <span class="badge warning">Not connected</span>
        </div>
        <div class="inline-message warning">
          Akahu tokens are stored only as Supabase Edge Function secrets. Do not enter bank credentials, card details or Akahu tokens in this app.
        </div>
        <div class="action-row section-spacer">
          <button id="connectKiwibankPanelButton" class="button button-primary" type="button">Connect mapped account</button>
        </div>
      </section>`;
  }

  return `
    <section class="section-card">
      <div class="section-card-header">
        <div>
          <h3>Kiwibank Sync</h3>
          <p class="muted">Mapped to ${escapeHtml(accountMap.get(connection.financial_account_id) || "dojo financial account")}.</p>
        </div>
        ${statusBadge(connection.status)}
      </div>
      <div class="summary-grid">
        <article class="summary-tile"><span>Selected account</span><strong>${escapeHtml(connection.masked_account_name || "Kiwibank account")}</strong><small>${escapeHtml(connection.masked_account_number || "Masked account")}</small></article>
        <article class="summary-tile"><span>Current balance</span><strong>${connection.current_balance == null ? "Not supplied" : formatCurrency(connection.current_balance)}</strong><small>${connection.balance_updated_at ? `As at ${formatDateTime(connection.balance_updated_at)}` : "Only shown when supplied by Akahu"}</small></article>
        <article class="summary-tile"><span>Last app sync</span><strong>${connection.last_successful_sync_at ? formatDateTime(connection.last_successful_sync_at) : "Not yet synced"}</strong><small>${lastRun ? `Last attempt: ${formatDateTime(lastRun.started_at)}` : "Manual test required first"}</small></article>
        <article class="summary-tile"><span>Review queue</span><strong>${pendingSuggestions}</strong><small>Uncertain items are not auto-posted</small></article>
      </div>
      <div class="action-row section-spacer">
        <button id="syncKiwibank7Button" class="button button-primary" type="button">Run 7-day test sync</button>
        <button id="syncKiwibank30Button" class="button button-secondary" type="button">Run 30-day sync</button>
        <button id="openKiwibankSyncButton" class="button button-secondary" type="button">Change mapping</button>
        <button id="disconnectKiwibankButton" class="button button-danger" type="button">Disconnect</button>
      </div>
      <p class="muted">Transfers remain visible but are excluded from income and expenses. CSV import remains available as a fallback.</p>
    </section>`;
}

function renderBankMatchSuggestions() {
  if (!state.suggestions.length) {
    return `<section class="section-card">${emptyState("No Kiwibank review items", "After a test sync, possible matches and uncategorised items will appear here for review.")}</section>`;
  }

  const rows = state.suggestions.map(item => {
    const tx = item.bank_transactions || {};
    return `<tr>
      <td>${formatDate(tx.transaction_date)}</td>
      <td><strong>${escapeHtml(tx.description || "Bank transaction")}</strong><div class="record-meta">${escapeHtml([tx.reference, tx.particulars, tx.code].filter(Boolean).join(" · "))}</div></td>
      <td>${statusBadge(item.suggestion_type)}</td>
      <td>${statusBadge(item.confidence_level)}</td>
      <td class="number-cell">${formatCurrency(item.suggested_amount || Math.abs(Number(tx.signed_amount || 0)))}</td>
      <td>${escapeHtml(item.reason_summary || "Review required")}</td>
    </tr>`;
  }).join("");

  return `
    <section class="section-card">
      <div class="section-card-header">
        <div>
          <h3>Kiwibank review queue</h3>
          <p class="muted">Exact and possible matches are staged here before they are confirmed against payments, expenses or transfers.</p>
        </div>
        <span class="badge warning">${state.suggestions.length} pending</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Bank text</th><th>Suggestion</th><th>Confidence</th><th>Amount</th><th>Reason</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

async function openKiwibankSyncDialog() {
  if (!state.accounts.length) {
    notifyError(new Error("Create a financial account first. Use Expenses to add a Kiwibank Dojo Account nickname, then return to Banking."));
    return;
  }

  const connection = activeKiwibankConnection();

  openDialog({
    title: "Kiwibank Sync account mapping",
    eyebrow: "Akahu",
    body: `
      <div class="inline-message">
        Load accounts from Akahu through the deployed Supabase Edge Function. Select only the Kiwibank dojo account. Do not select household or personal accounts.
      </div>
      ${connection ? `<div class="section-card section-spacer"><strong>Current mapping:</strong><br>${escapeHtml(connection.masked_account_name || "Kiwibank account")} · ${escapeHtml(connection.masked_account_number || "Masked account")}</div>` : ""}
      <form id="kiwibankConnectionForm" class="form-grid section-spacer">
        <label class="form-field full">
          <span class="form-label">Akahu account</span>
          <select class="select" name="accountId" id="akahuAccountSelect" required>
            <option value="">Load accounts first</option>
          </select>
        </label>
        <label class="form-field full">
          <span class="form-label">Map to dojo financial account</span>
          <select class="select" name="financialAccountId" required>${accountOptions(connection?.financial_account_id || null)}</select>
        </label>
        <label class="form-field full">
          <span class="form-label">Connection name</span>
          <input class="input" name="connectionName" value="${escapeHtml(connection?.connection_name || "Kiwibank Dojo Account")}">
        </label>
      </form>
      <div id="akahuAccountLoadResult" class="section-spacer"></div>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="loadAkahuAccountsButton" class="button button-secondary" type="button">Load Akahu accounts</button>
      <button id="saveKiwibankConnectionButton" class="button button-primary" type="button">Save mapping</button>`
  });

  document.querySelector("[data-close-dialog]")?.addEventListener("click", closeDialog);
  document.getElementById("loadAkahuAccountsButton")?.addEventListener("click", event => loadAkahuAccountsIntoDialog(event.currentTarget, connection?.external_account_id || null));
  document.getElementById("saveKiwibankConnectionButton")?.addEventListener("click", saveKiwibankConnection);
}

async function loadAkahuAccountsIntoDialog(button, selectedId = null) {
  setButtonBusy(button, true, "Loading…");

  try {
    const result = await callKiwibankSync("listAccounts");
    const accounts = result.accounts || [];
    const select = document.getElementById("akahuAccountSelect");
    const output = document.getElementById("akahuAccountLoadResult");

    if (!accounts.length) {
      select.innerHTML = '<option value="">No accounts returned</option>';
      output.innerHTML = '<div class="inline-message warning">Akahu did not return any accounts. Confirm Kiwibank is connected in MyAkahu.</div>';
      return;
    }

    select.innerHTML = `<option value="">Select the dojo account only</option>${accounts.map(account => `<option value="${escapeHtml(account.id)}" ${selectedId === account.id ? "selected" : ""}>${escapeHtml(account.name || "Kiwibank account")} · ${escapeHtml(account.masked_account_number || "Masked account")}${account.current_balance == null ? "" : ` · ${formatCurrency(account.current_balance)}`}</option>`).join("")}`;
    output.innerHTML = `<div class="inline-message success">${accounts.length} masked Akahu account${accounts.length === 1 ? "" : "s"} loaded. Select the dojo account only.</div>`;
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function saveKiwibankConnection(event) {
  const button = event.currentTarget;
  const form = document.getElementById("kiwibankConnectionForm");
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const accountText = document.getElementById("akahuAccountSelect")?.selectedOptions?.[0]?.textContent || "";

  if (!window.confirm(`Confirm this is the dojo Kiwibank account only:\n\n${accountText}`)) return;

  setButtonBusy(button, true, "Saving…");

  try {
    await callKiwibankSync("connectAccount", {
      accountId: data.get("accountId"),
      financialAccountId: data.get("financialAccountId"),
      connectionName: normaliseText(data.get("connectionName")) || "Kiwibank Dojo Account"
    });

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Kiwibank account mapping saved. No transactions have been imported yet.");
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function runKiwibankSync(lookbackDays, button) {
  const connection = activeKiwibankConnection();
  if (!connection) {
    notifyError(new Error("Connect the dojo Kiwibank account before syncing."));
    return;
  }

  const message = lookbackDays <= 7
    ? "Run the first controlled 7-day test sync? Review every imported transaction before relying on the results."
    : "Run a wider Kiwibank sync? Use this only after the 7-day test has been checked.";
  if (!window.confirm(message)) return;

  setButtonBusy(button, true, "Syncing…");

  try {
    const result = await callKiwibankSync("syncTransactions", {
      connectionId: connection.id,
      lookbackDays
    });

    await refresh();
    render(document.getElementById("moduleContent"));

    notifySuccess(`Kiwibank sync complete: ${result.transactions_inserted || 0} added, ${result.transactions_updated || 0} updated, ${result.duplicates_ignored || 0} duplicates ignored, ${result.review_required || 0} review items.`);
    dispatchDataChanged({ module: "banking" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function disconnectKiwibankConnection(button) {
  const connection = activeKiwibankConnection();
  if (!connection) return;

  if (!window.confirm("Disconnect the mapped Kiwibank account from the dojo app? Historical imported records will remain. Revoke access in MyAkahu as well if you want to fully remove consent.")) return;

  setButtonBusy(button, true, "Disconnecting…");

  try {
    await callKiwibankSync("disconnectAccount", { connectionId: connection.id });
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Kiwibank account disconnected in the dojo app. Revoke consent in MyAkahu if required.");
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}


function accountOptions(selectedId = null) {
  return `<option value="">Select account</option>${state.accounts.map(item => `<option value="${item.id}" ${selectedId === item.id ? "selected" : ""}>${escapeHtml(item.account_nickname)}</option>`).join("")}`;
}

function openImportDialog() {
  if (!state.accounts.length) {
    notifyError(new Error("Create a financial account under Expenses → Accounts & suppliers before importing a statement."));
    return;
  }
  importPreview = null;
  openDialog({
    title: "Import Kiwibank CSV", eyebrow: "Finance",
    body: `<form id="bankImportForm" class="form-grid"><label class="form-field"><span class="form-label">Financial account</span><select class="select" name="accountId" required>${accountOptions()}</select></label><label class="form-field"><span class="form-label">CSV statement</span><input id="bankCsvFile" class="input" type="file" accept=".csv,text/csv" required></label><label class="form-field full"><span class="form-label">Notes</span><input class="input" name="notes" placeholder="Optional statement note"></label></form><div id="bankImportPreview" class="section-card section-spacer"><div class="inline-message">Select a CSV file to preview it. Expected fields include Date, Description, Deposits or Money in, Withdrawals or Money out, and Balance.</div></div>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="confirmBankImportButton" class="button button-primary" type="button" disabled>Confirm import</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("bankCsvFile").addEventListener("change", previewCsv);
  document.getElementById("confirmBankImportButton").addEventListener("click", confirmImport);
}

async function previewCsv(event) {
  try {
    const file = event.target.files[0]; if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) throw new Error("The CSV file contains no transaction rows.");
    const headers = parsed[0].map(value => normaliseHeader(value));
    const rows = parsed.slice(1).filter(row => row.some(value => normaliseText(value)));
    const mappings = detectColumns(headers);
    if (mappings.date < 0 || mappings.description < 0 || (mappings.moneyIn < 0 && mappings.moneyOut < 0 && mappings.amount < 0)) {
      throw new Error("The CSV columns could not be recognised. Include Date, Description, and deposit/withdrawal or amount columns.");
    }
    const transactions = rows.map((row, index) => convertCsvRow(row, headers, mappings, index + 2)).filter(Boolean);
    if (!transactions.length) throw new Error("No valid transaction rows were found.");
    importPreview = { fileName: file.name, headers, transactions };
    const previewRows = transactions.slice(0, 10).map(item => `<tr><td>${escapeHtml(item.original_date_text)}</td><td>${escapeHtml(item.description)}</td><td>${formatCurrency(item.signed_amount)}</td><td>${item.balance == null ? "—" : formatCurrency(item.balance)}</td></tr>`).join("");
    document.getElementById("bankImportPreview").innerHTML = `<div class="section-card-header"><div><h3>Preview</h3><p class="muted">${transactions.length} valid rows. Review the first ten below.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead><tbody>${previewRows}</tbody></table></div>`;
    document.getElementById("confirmBankImportButton").disabled = false;
  } catch (error) {
    importPreview = null;
    document.getElementById("confirmBankImportButton").disabled = true;
    document.getElementById("bankImportPreview").innerHTML = `<div class="inline-message error">${escapeHtml(error.message)}</div>`;
  }
}

function parseCsv(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += char;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function normaliseHeader(value) { return normaliseText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function findHeader(headers, names) { return headers.findIndex(header => names.some(name => header === name || header.includes(name))); }
function detectColumns(headers) {
  return {
    date: findHeader(headers, ["date", "transaction date"]), description: findHeader(headers, ["description", "details", "narrative"]),
    reference: findHeader(headers, ["reference", "ref"]), particulars: findHeader(headers, ["particulars"]), code: findHeader(headers, ["code"]),
    moneyIn: findHeader(headers, ["money in", "deposits", "deposit", "credit"]), moneyOut: findHeader(headers, ["money out", "withdrawals", "withdrawal", "debit"]),
    amount: findHeader(headers, ["amount", "signed amount"]), balance: findHeader(headers, ["balance"])
  };
}
function parseDate(value) {
  const text = normaliseText(value); if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/); if (iso) return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;
  const nz = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); if (nz) { const y = nz[3].length === 2 ? `20${nz[3]}` : nz[3]; return `${y}-${nz[2].padStart(2,"0")}-${nz[1].padStart(2,"0")}`; }
  const date = new Date(text); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0,10);
}
function cell(row, index) { return index >= 0 ? normaliseText(row[index]) : ""; }
function convertCsvRow(row, headers, mapping, lineNumber) {
  const originalDate = cell(row, mapping.date), transactionDate = parseDate(originalDate), description = cell(row, mapping.description);
  const moneyIn = parseMoney(cell(row, mapping.moneyIn)), moneyOut = parseMoney(cell(row, mapping.moneyOut));
  let signed = mapping.amount >= 0 ? Number.parseFloat(cell(row, mapping.amount).replace(/[$,\s]/g, "")) : moneyIn - moneyOut;
  if (!Number.isFinite(signed)) signed = 0;
  if (!transactionDate && !description && signed === 0) return null;
  return { transaction_date: transactionDate, original_date_text: originalDate, description: description || `CSV row ${lineNumber}`, reference: cell(row, mapping.reference) || null, particulars: cell(row, mapping.particulars) || null, code: cell(row, mapping.code) || null, money_in: moneyIn || null, money_out: moneyOut || null, signed_amount: Math.round(signed * 100) / 100, balance: mapping.balance >= 0 && cell(row, mapping.balance) ? parseMoney(cell(row, mapping.balance)) : null, original_values: Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] ?? ""])), validation_errors: transactionDate ? [] : ["Invalid or missing transaction date"] };
}

async function confirmImport(event) {
  const form = document.getElementById("bankImportForm"); if (!form.reportValidity() || !importPreview) return;
  const button = event.currentTarget; setButtonBusy(button, true, "Importing…");
  try {
    const data = new FormData(form), accountId = data.get("accountId"), supabase = getSupabaseClient();
    const validDates = importPreview.transactions.map(item => item.transaction_date).filter(Boolean).sort();
    const balances = importPreview.transactions.map(item => item.balance).filter(value => value != null);
    const { data: batch, error: batchError } = await supabase.from("bank_import_batches").insert({ account_id: accountId, file_name: importPreview.fileName, statement_start_date: validDates[0] || null, statement_end_date: validDates.at(-1) || null, imported_opening_balance: balances[0] ?? null, imported_closing_balance: balances.at(-1) ?? null, row_count: importPreview.transactions.length, status: "preview", notes: normaliseText(data.get("notes")) || null }).select("id").single();
    if (batchError) throw batchError;

    const prepared = [];
    for (const item of importPreview.transactions) {
      const { data: fingerprint, error } = await supabase.rpc("make_bank_transaction_fingerprint", { p_account_id: accountId, p_transaction_date: item.transaction_date, p_signed_amount: item.signed_amount, p_description: item.description, p_reference: item.reference, p_particulars: item.particulars, p_code: item.code });
      if (error) throw error;
      prepared.push({ ...item, fingerprint, account_id: accountId, bank_import_batch_id: batch.id });
    }
    const fingerprints = prepared.map(item => item.fingerprint);
    const existing = new Set();
    for (let i = 0; i < fingerprints.length; i += 100) {
      const { data: rows, error } = await supabase.from("bank_transactions").select("fingerprint").in("fingerprint", fingerprints.slice(i, i + 100)); if (error) throw error;
      (rows || []).forEach(row => existing.add(row.fingerprint));
    }
    let duplicates = 0, errors = 0;
    const rows = prepared.map(item => {
      const duplicate = existing.has(item.fingerprint); if (duplicate) duplicates += 1; if (item.validation_errors.length) errors += 1;
      return { ...item, confirmation_status: duplicate ? "duplicate" : "pending_review", categorisation_status: duplicate ? "ignored" : "uncategorised" };
    });
    const { error: insertError } = await supabase.from("bank_transactions").insert(rows); if (insertError) throw insertError;
    const { error: updateError } = await supabase.from("bank_import_batches").update({ duplicate_row_count: duplicates, error_row_count: errors, status: "reviewed" }).eq("id", batch.id); if (updateError) throw updateError;
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(`${rows.length} transactions imported for review. ${duplicates} duplicates detected.`); dispatchDataChanged({ module: "banking" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function handleTransactionAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const transaction = state.transactions.find(item => item.id === button.dataset.id); if (!transaction) return;
  if (button.dataset.action === "confirm") updateTransaction(transaction, { confirmation_status: "confirmed" }, "Transaction confirmed.");
  if (button.dataset.action === "reject") updateTransaction(transaction, { confirmation_status: "rejected", categorisation_status: "ignored" }, "Transaction rejected.");
  if (button.dataset.action === "match") openMatchDialog(transaction);
}
async function updateTransaction(transaction, values, message) {
  try { const supabase = getSupabaseClient(); const { error } = await supabase.from("bank_transactions").update(values).eq("id", transaction.id); if (error) throw error; await refresh(); render(document.getElementById("moduleContent")); notifySuccess(message); }
  catch (error) { notifyError(error); }
}

function openMatchDialog(transaction) {
  const incoming = Number(transaction.signed_amount) > 0;
  const amount = Math.abs(Number(transaction.signed_amount));
  const candidates = incoming
    ? state.payments.filter(item => Math.abs(Number(item.amount) - amount) < 0.01)
    : state.expensePayments.filter(item => Math.abs(Number(item.amount) - amount) < 0.01);
  const expenseMap = new Map(state.expenses.map(item => [item.id, item]));
  openDialog({
    title: incoming ? "Match incoming payment" : "Match expense payment", eyebrow: "Finance",
    body: `<div class="inline-message"><strong>${escapeHtml(transaction.description || "Transaction")}</strong><br>${formatDate(transaction.transaction_date)} · ${formatCurrency(transaction.signed_amount)}</div><form id="bankMatchForm" class="form-grid section-spacer"><input type="hidden" name="transactionId" value="${transaction.id}"><label class="form-field full"><span class="form-label">Matching record</span><select class="select" name="matchId" required><option value="">Select a record</option>${candidates.map(item => incoming ? `<option value="${item.id}">${escapeHtml(item.payment_number)} · ${formatDate(item.payment_date)} · ${formatCurrency(item.amount)}</option>` : `<option value="${item.id}">${escapeHtml(expenseMap.get(item.expense_id)?.expense_number || "Expense")} · ${formatDate(item.payment_date)} · ${formatCurrency(item.amount)}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Confidence</span><select class="select" name="confidence"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label class="form-field"><span class="form-label">Matched amount</span><input class="input" type="number" step="0.01" min="0.01" name="amount" value="${amount.toFixed(2)}"></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes"></textarea></label></form>${candidates.length ? "" : '<div class="inline-message warning">No records have the same amount. Create the payment or expense payment first, or confirm the transaction without a match.</div>'}`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveBankMatchButton" class="button button-primary" type="button" ${candidates.length ? "" : "disabled"}>Confirm match</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("saveBankMatchButton").addEventListener("click", event => saveMatch(event, incoming));
}

async function saveMatch(event, incoming) {
  const button = event.currentTarget, form = document.getElementById("bankMatchForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), supabase = getSupabaseClient(), common = { bank_transaction_id: data.get("transactionId"), matched_amount: parseMoney(data.get("amount")), confidence: data.get("confidence"), status: "confirmed", notes: normaliseText(data.get("notes")) || null };
    const result = incoming ? await supabase.from("bank_payment_matches").insert({ ...common, payment_id: data.get("matchId") }) : await supabase.from("bank_expense_matches").insert({ ...common, expense_payment_id: data.get("matchId") }); if (result.error) throw result.error;
    const { error } = await supabase.from("bank_transactions").update({ confirmation_status: "confirmed", categorisation_status: "confirmed" }).eq("id", data.get("transactionId")); if (error) throw error;
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Bank transaction matched and confirmed."); dispatchDataChanged({ module: "banking" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function openReconciliationDialog() {
  if (!state.accounts.length) { notifyError(new Error("Create a financial account first.")); return; }
  openDialog({
    title: "Reconcile account", eyebrow: "Finance",
    body: `<form id="reconciliationForm" class="form-grid"><label class="form-field full"><span class="form-label">Account</span><select class="select" name="accountId" required>${accountOptions()}</select></label><label class="form-field"><span class="form-label">Period start</span><input class="input" type="date" name="start" required value="${new Date().getFullYear()}-01-01"></label><label class="form-field"><span class="form-label">Period end</span><input class="input" type="date" name="end" required value="${todayIso()}"></label><label class="form-field"><span class="form-label">Opening balance</span><input class="input" type="number" step="0.01" name="opening" required value="0.00"></label><label class="form-field"><span class="form-label">Statement closing balance</span><input class="input" type="number" step="0.01" name="closing" required></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes"></textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveReconciliationButton" class="button button-primary" type="button">Calculate and save</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveReconciliationButton").addEventListener("click", saveReconciliation);
}

async function saveReconciliation(event) {
  const button = event.currentTarget, form = document.getElementById("reconciliationForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), opening = parseMoney(data.get("opening")), closing = parseMoney(data.get("closing")), supabase = getSupabaseClient();
    const { data: rows, error: txError } = await supabase.from("bank_transactions").select("id,signed_amount").eq("account_id", data.get("accountId")).eq("confirmation_status", "confirmed").gte("transaction_date", data.get("start")).lte("transaction_date", data.get("end")).is("deleted_at", null); if (txError) throw txError;
    const movement = (rows || []).reduce((sum, item) => sum + Number(item.signed_amount), 0), calculated = Math.round((opening + movement) * 100) / 100, difference = Math.round((closing - calculated) * 100) / 100, status = Math.abs(difference) < 0.01 ? "balanced" : "difference_found";
    const { data: reconciliation, error } = await supabase.from("bank_reconciliations").insert({ account_id: data.get("accountId"), period_start: data.get("start"), period_end: data.get("end"), imported_opening_balance: opening, imported_closing_balance: closing, calculated_closing_balance: calculated, difference_amount: difference, status, notes: normaliseText(data.get("notes")) || null, completed_at: new Date().toISOString() }).select("id").single(); if (error) throw error;
    if (rows?.length) { const { error: itemError } = await supabase.from("reconciliation_items").insert(rows.map(item => ({ bank_reconciliation_id: reconciliation.id, bank_transaction_id: item.id, status: "reconciled", reconciled_at: new Date().toISOString() }))); if (itemError) throw itemError; }
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(status === "balanced" ? "Account reconciled and balanced." : `Reconciliation saved with a difference of ${formatCurrency(difference)}.`);
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function openRulesDialog() {
  const ruleRows = state.rules.map(rule => `<tr><td>${escapeHtml(rule.rule_name)}</td><td>${escapeHtml(rule.match_field)}</td><td>${escapeHtml(rule.match_type)}</td><td>${escapeHtml(rule.match_text)}</td><td>${escapeHtml(rule.suggested_category || "—")}</td><td>${escapeHtml(rule.confidence)}</td></tr>`).join("");
  openDialog({
    title: "Matching rules", eyebrow: "Finance",
    body: `<form id="matchingRuleForm" class="form-grid"><label class="form-field"><span class="form-label">Rule name</span><input class="input" name="name" required></label><label class="form-field"><span class="form-label">Match field</span><select class="select" name="field"><option value="description">Description</option><option value="reference">Reference</option><option value="particulars">Particulars</option><option value="code">Code</option></select></label><label class="form-field"><span class="form-label">Match type</span><select class="select" name="type"><option value="contains">Contains</option><option value="equals">Equals</option><option value="starts_with">Starts with</option><option value="ends_with">Ends with</option></select></label><label class="form-field"><span class="form-label">Match text</span><input class="input" name="text" required></label><label class="form-field"><span class="form-label">Suggested category</span><input class="input" name="category" placeholder="payment, expense, transfer..."></label><label class="form-field"><span class="form-label">Confidence</span><select class="select" name="confidence"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><button id="saveMatchingRuleButton" class="button button-primary full" type="button">Add rule</button></form><div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Rule</th><th>Field</th><th>Type</th><th>Text</th><th>Category</th><th>Confidence</th></tr></thead><tbody>${ruleRows}</tbody></table></div>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Close</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveMatchingRuleButton").addEventListener("click", saveRule);
}

async function saveRule(event) {
  const button = event.currentTarget, form = document.getElementById("matchingRuleForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try { const data = new FormData(form), supabase = getSupabaseClient(); const { error } = await supabase.from("matching_rules").insert({ rule_name: normaliseText(data.get("name")), match_field: data.get("field"), match_type: data.get("type"), match_text: normaliseText(data.get("text")), suggested_category: normaliseText(data.get("category")) || null, confidence: data.get("confidence"), is_active: true }); if (error) throw error; closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Matching rule added."); }
  catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}
