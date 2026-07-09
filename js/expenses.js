import { getSupabaseClient } from "./database.js?v=1.1.0";
import { dispatchDataChanged, formatCurrency, formatDate, normaliseText, parseMoney, todayIso } from "./utilities.js?v=1.1.0";
import {
  closeDialog, emptyState, escapeHtml, moduleHeader, notifyError,
  notifySuccess, openDialog, setButtonBusy, statusBadge
} from "./ui.js?v=1.1.0";

let state = { expenses: [], payments: [], categories: [], suppliers: [], accounts: [], recurring: [], occurrences: [], terms: [] };

export async function renderExpenses(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: false }).limit(150),
    supabase.from("expense_payments").select("*").is("deleted_at", null).neq("status", "reversed"),
    supabase.from("expense_categories").select("*").eq("is_active", true).order("category_name"),
    supabase.from("suppliers").select("*").is("deleted_at", null).eq("is_active", true).order("supplier_name"),
    supabase.from("financial_accounts").select("*").is("deleted_at", null).eq("is_active", true).order("account_nickname"),
    supabase.from("recurring_expenses").select("*").is("deleted_at", null).order("next_due_date"),
    supabase.from("expense_occurrences").select("*").is("deleted_at", null).order("proposed_due_date", { ascending: false }).limit(100),
    supabase.from("terms").select("id,term_name,academic_year").is("deleted_at", null).order("start_date", { ascending: false })
  ]);
  for (const result of results) if (result.error) throw result.error;
  [state.expenses, state.payments, state.categories, state.suppliers, state.accounts, state.recurring, state.occurrences, state.terms] = results.map(result => result.data || []);
}

function paidAmount(expenseId) {
  return state.payments.filter(item => item.expense_id === expenseId && item.status === "confirmed").reduce((sum, item) => sum + Number(item.amount), 0);
}

function render(container) {
  const categoryMap = new Map(state.categories.map(item => [item.id, item.category_name]));
  const accountMap = new Map(state.accounts.map(item => [item.id, item.account_nickname]));
  const supplierMap = new Map(state.suppliers.map(item => [item.id, item.supplier_name]));
  const total = state.expenses.filter(item => item.payment_status !== "cancelled").reduce((sum, item) => sum + Number(item.amount), 0);
  const paid = state.payments.filter(item => item.status === "confirmed").reduce((sum, item) => sum + Number(item.amount), 0);
  const unpaid = Math.max(total - paid, 0);
  const dueRecurring = state.recurring.filter(item => item.is_active && item.next_due_date && item.next_due_date <= todayIso()).length;

  const expenseRows = state.expenses.map(expense => {
    const paidValue = paidAmount(expense.id);
    return `<tr>
      <td><strong>${escapeHtml(expense.expense_number || "Pending")}</strong><div class="record-meta">${formatDate(expense.expense_date)}</div></td>
      <td>${escapeHtml(supplierMap.get(expense.supplier_id) || expense.supplier_or_payee || "—")}</td>
      <td>${escapeHtml(expense.description)}</td>
      <td>${escapeHtml(categoryMap.get(expense.expense_category_id) || "—")}</td>
      <td>${formatCurrency(expense.amount)}</td><td>${formatCurrency(paidValue)}</td><td>${statusBadge(expense.payment_status)}</td>
      <td class="table-actions"><button class="button button-secondary button-small" data-action="edit-expense" data-id="${expense.id}">Edit</button><button class="button button-primary button-small" data-action="pay-expense" data-id="${expense.id}" ${expense.payment_status === "paid" || expense.payment_status === "cancelled" ? "disabled" : ""}>Record payment</button></td>
    </tr>`;
  }).join("");

  const recurringRows = state.recurring.map(item => `<tr><td><strong>${escapeHtml(item.expense_name)}</strong></td><td>${formatCurrency(item.normal_amount)}</td><td>${escapeHtml(item.frequency)}</td><td>${formatDate(item.next_due_date)}</td><td>${escapeHtml(accountMap.get(item.account_id) || "—")}</td><td>${item.is_active ? '<span class="badge success">Active</span>' : '<span class="badge muted">Inactive</span>'}</td><td class="table-actions"><button class="button button-secondary button-small" data-action="edit-recurring" data-id="${item.id}">Edit</button><button class="button button-primary button-small" data-action="create-occurrence" data-id="${item.id}">Create expense</button></td></tr>`).join("");

  container.innerHTML = `<div class="module-shell">
    ${moduleHeader({ eyebrow: "Finance", title: "Expenses", description: "Track suppliers, recurring costs, payments and outstanding dojo expenses.", actions: '<button id="addExpenseButton" class="button button-primary" type="button">Add expense</button><button id="addRecurringButton" class="button button-secondary" type="button">Add recurring expense</button><button id="manageExpenseSetupButton" class="button button-secondary" type="button">Accounts & suppliers</button>' })}
    <div class="summary-grid"><article class="summary-tile"><span>Total expenses</span><strong>${formatCurrency(total)}</strong></article><article class="summary-tile"><span>Paid</span><strong>${formatCurrency(paid)}</strong></article><article class="summary-tile"><span>Outstanding</span><strong>${formatCurrency(unpaid)}</strong></article><article class="summary-tile"><span>Recurring due</span><strong>${dueRecurring}</strong></article></div>
    <section class="section-card"><div class="section-card-header"><div><h3>Expenses</h3><p class="muted">Payments can be split across dates or accounts.</p></div></div>${state.expenses.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Expense</th><th>Supplier</th><th>Description</th><th>Category</th><th>Amount</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead><tbody id="expenseRows">${expenseRows}</tbody></table></div>` : emptyState("No expenses", "Add a hall hire, JKA NZ payment or other dojo cost.")}</section>
    <section class="section-card"><div class="section-card-header"><div><h3>Recurring expenses</h3><p class="muted">Create controlled expense occurrences when they become due.</p></div></div>${state.recurring.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Normal amount</th><th>Frequency</th><th>Next due</th><th>Account</th><th>Status</th><th>Actions</th></tr></thead><tbody id="recurringRows">${recurringRows}</tbody></table></div>` : emptyState("No recurring expenses", "Add regular hall hire, subscriptions or other repeating costs.")}</section>
  </div>`;

  container.querySelector("#addExpenseButton").addEventListener("click", () => openExpenseDialog());
  container.querySelector("#addRecurringButton").addEventListener("click", () => openRecurringDialog());
  container.querySelector("#manageExpenseSetupButton").addEventListener("click", openSetupDialog);
  container.querySelector("#expenseRows")?.addEventListener("click", handleExpenseAction);
  container.querySelector("#recurringRows")?.addEventListener("click", handleRecurringAction);
}

function optionList(items, valueKey, labelFn, selectedId = null, empty = "Not selected") {
  return `<option value="">${empty}</option>${items.map(item => `<option value="${item[valueKey]}" ${selectedId === item[valueKey] ? "selected" : ""}>${escapeHtml(labelFn(item))}</option>`).join("")}`;
}

function openExpenseDialog(expense = null) {
  openDialog({
    title: expense ? "Edit expense" : "Add expense", eyebrow: "Finance",
    body: `<form id="expenseForm" class="form-grid"><input type="hidden" name="id" value="${expense?.id || ""}"><label class="form-field"><span class="form-label">Expense date</span><input class="input" type="date" name="date" required value="${expense?.expense_date || todayIso()}"></label><label class="form-field"><span class="form-label">Amount</span><input class="input" type="number" min="0" step="0.01" name="amount" required value="${expense?.amount ?? ""}"></label><label class="form-field"><span class="form-label">Supplier</span><select class="select" name="supplierId">${optionList(state.suppliers, "id", item => item.supplier_name, expense?.supplier_id, "No saved supplier")}</select></label><label class="form-field"><span class="form-label">Supplier or payee text</span><input class="input" name="payee" value="${escapeHtml(expense?.supplier_or_payee || "")}"></label><label class="form-field"><span class="form-label">Category</span><select class="select" name="categoryId" required>${optionList(state.categories, "id", item => item.category_name, expense?.expense_category_id, "Select category")}</select></label><label class="form-field"><span class="form-label">Account</span><select class="select" name="accountId">${optionList(state.accounts, "id", item => item.account_nickname, expense?.account_id, "Not assigned")}</select></label><label class="form-field full"><span class="form-label">Description</span><input class="input" name="description" required value="${escapeHtml(expense?.description || "")}"></label><label class="form-field"><span class="form-label">Associated term</span><select class="select" name="termId">${optionList(state.terms, "id", item => `${item.term_name} ${item.academic_year}`, expense?.associated_term_id, "No term")}</select></label><label class="form-field"><span class="form-label">Receipt reference</span><input class="input" name="receiptReference" value="${escapeHtml(expense?.receipt_reference || "")}"></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(expense?.notes || "")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveExpenseButton" class="button button-primary" type="button">${expense ? "Save changes" : "Create expense"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveExpenseButton").addEventListener("click", saveExpense);
}

async function saveExpense(event) {
  const button = event.currentTarget, form = document.getElementById("expenseForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id");
    const row = { expense_date: data.get("date"), supplier_id: data.get("supplierId") || null, supplier_or_payee: normaliseText(data.get("payee")) || null, expense_category_id: data.get("categoryId"), description: normaliseText(data.get("description")), amount: parseMoney(data.get("amount")), account_id: data.get("accountId") || null, associated_term_id: data.get("termId") || null, receipt_reference: normaliseText(data.get("receiptReference")) || null, notes: normaliseText(data.get("notes")) || null, payment_status: expenseStatusFor(id) };
    const supabase = getSupabaseClient();
    if (id) {
      const { error } = await supabase.from("expenses").update(row).eq("id", id); if (error) throw error;
    } else {
      const { data: number, error: numberError } = await supabase.rpc("next_expense_number", { p_expense_date: row.expense_date }); if (numberError) throw numberError;
      const { error } = await supabase.from("expenses").insert({ ...row, expense_number: number, payment_status: "unpaid" }); if (error) throw error;
    }
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Expense updated." : "Expense created."); dispatchDataChanged({ module: "expenses" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function expenseStatusFor(id) { return state.expenses.find(item => item.id === id)?.payment_status || "unpaid"; }

function handleExpenseAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const expense = state.expenses.find(item => item.id === button.dataset.id); if (!expense) return;
  if (button.dataset.action === "edit-expense") openExpenseDialog(expense);
  if (button.dataset.action === "pay-expense") openPaymentDialog(expense);
}

function openPaymentDialog(expense) {
  const remaining = Math.max(Number(expense.amount) - paidAmount(expense.id), 0);
  openDialog({
    title: `Pay ${expense.expense_number}`, eyebrow: "Finance",
    body: `<form id="expensePaymentForm" class="form-grid"><input type="hidden" name="expenseId" value="${expense.id}"><label class="form-field"><span class="form-label">Payment date</span><input class="input" type="date" name="date" required value="${todayIso()}"></label><label class="form-field"><span class="form-label">Amount</span><input class="input" type="number" min="0.01" max="${remaining}" step="0.01" name="amount" required value="${remaining.toFixed(2)}"></label><label class="form-field"><span class="form-label">Account</span><select class="select" name="accountId">${optionList(state.accounts, "id", item => item.account_nickname, expense.account_id, "Not assigned")}</select></label><label class="form-field"><span class="form-label">Payment method</span><select class="select" name="method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label><label class="form-field"><span class="form-label">Bank reference</span><input class="input" name="reference"></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes"></textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveExpensePaymentButton" class="button button-primary" type="button">Record payment</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveExpensePaymentButton").addEventListener("click", saveExpensePayment);
}

async function saveExpensePayment(event) {
  const button = event.currentTarget, form = document.getElementById("expensePaymentForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), supabase = getSupabaseClient();
    const { error } = await supabase.from("expense_payments").insert({ expense_id: data.get("expenseId"), payment_date: data.get("date"), amount: parseMoney(data.get("amount")), account_id: data.get("accountId") || null, payment_method: data.get("method"), bank_reference: normaliseText(data.get("reference")) || null, status: "confirmed", notes: normaliseText(data.get("notes")) || null }); if (error) throw error;
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Expense payment recorded."); dispatchDataChanged({ module: "expenses" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function openRecurringDialog(item = null) {
  openDialog({
    title: item ? "Edit recurring expense" : "Add recurring expense", eyebrow: "Finance",
    body: `<form id="recurringExpenseForm" class="form-grid"><input type="hidden" name="id" value="${item?.id || ""}"><label class="form-field full"><span class="form-label">Expense name</span><input class="input" name="name" required value="${escapeHtml(item?.expense_name || "")}"></label><label class="form-field"><span class="form-label">Category</span><select class="select" name="categoryId">${optionList(state.categories, "id", category => category.category_name, item?.expense_category_id, "Select category")}</select></label><label class="form-field"><span class="form-label">Supplier</span><select class="select" name="supplierId">${optionList(state.suppliers, "id", supplier => supplier.supplier_name, item?.supplier_id, "No supplier")}</select></label><label class="form-field"><span class="form-label">Normal amount</span><input class="input" type="number" min="0" step="0.01" name="amount" required value="${item?.normal_amount ?? ""}"></label><label class="form-field"><span class="form-label">Frequency</span><select class="select" name="frequency">${["weekly","fortnightly","monthly","quarterly","yearly","one_time"].map(value => `<option value="${value}" ${item?.frequency === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="form-field"><span class="form-label">Next due date</span><input class="input" type="date" name="nextDueDate" value="${item?.next_due_date || todayIso()}"></label><label class="form-field"><span class="form-label">Amount type</span><select class="select" name="amountType"><option value="fixed" ${item?.amount_type !== "variable" ? "selected" : ""}>Fixed</option><option value="variable" ${item?.amount_type === "variable" ? "selected" : ""}>Variable</option></select></label><label class="form-field"><span class="form-label">Payment mode</span><select class="select" name="paymentMode"><option value="manual" ${item?.payment_mode !== "automatic" ? "selected" : ""}>Manual</option><option value="automatic" ${item?.payment_mode === "automatic" ? "selected" : ""}>Automatic</option></select></label><label class="form-field"><span class="form-label">Account</span><select class="select" name="accountId">${optionList(state.accounts, "id", account => account.account_nickname, item?.account_id, "Not assigned")}</select></label><label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(item?.notes || "")}</textarea></label></form>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Cancel</button><button id="saveRecurringButton" class="button button-primary" type="button">${item ? "Save changes" : "Create recurring expense"}</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("saveRecurringButton").addEventListener("click", saveRecurring);
}

async function saveRecurring(event) {
  const button = event.currentTarget, form = document.getElementById("recurringExpenseForm"); if (!form.reportValidity()) return; setButtonBusy(button, true);
  try {
    const data = new FormData(form), id = data.get("id"), row = { expense_name: normaliseText(data.get("name")), expense_category_id: data.get("categoryId") || null, supplier_id: data.get("supplierId") || null, normal_amount: parseMoney(data.get("amount")), frequency: data.get("frequency"), next_due_date: data.get("nextDueDate") || null, amount_type: data.get("amountType"), payment_mode: data.get("paymentMode"), account_id: data.get("accountId") || null, notes: normaliseText(data.get("notes")) || null, is_active: true };
    const supabase = getSupabaseClient(), result = id ? await supabase.from("recurring_expenses").update(row).eq("id", id) : await supabase.from("recurring_expenses").insert(row); if (result.error) throw result.error;
    closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess(id ? "Recurring expense updated." : "Recurring expense created.");
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function handleRecurringAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return; const item = state.recurring.find(row => row.id === button.dataset.id); if (!item) return;
  if (button.dataset.action === "edit-recurring") openRecurringDialog(item);
  if (button.dataset.action === "create-occurrence") createExpenseFromRecurring(item, button);
}

async function createExpenseFromRecurring(item, button) {
  setButtonBusy(button, true, "Creating…");
  try {
    const supabase = getSupabaseClient(), dueDate = item.next_due_date || todayIso();
    const { data: number, error: numberError } = await supabase.rpc("next_expense_number", { p_expense_date: dueDate }); if (numberError) throw numberError;
    const supplier = state.suppliers.find(row => row.id === item.supplier_id);
    const { data: expense, error: expenseError } = await supabase.from("expenses").insert({ expense_number: number, expense_date: dueDate, supplier_id: item.supplier_id, supplier_or_payee: supplier?.supplier_name || null, expense_category_id: item.expense_category_id, description: item.expense_name, amount: item.normal_amount, account_id: item.account_id, payment_status: "unpaid", notes: `Created from recurring expense ${item.expense_name}` }).select("id").single(); if (expenseError) throw expenseError;
    await supabase.from("expense_occurrences").upsert({ recurring_expense_id: item.id, proposed_due_date: dueDate, proposed_amount: item.normal_amount, status: "confirmed", resulting_expense_id: expense.id }, { onConflict: "recurring_expense_id,proposed_due_date" });
    const { data: nextDate, error: nextError } = await supabase.rpc("next_recurring_due_date", { p_current_date: dueDate, p_frequency: item.frequency }); if (nextError) throw nextError;
    await supabase.from("recurring_expenses").update({ next_due_date: nextDate, is_active: item.frequency !== "one_time" }).eq("id", item.id);
    await refresh(); render(document.getElementById("moduleContent")); notifySuccess(`Expense ${number} created.`); dispatchDataChanged({ module: "expenses" });
  } catch (error) { notifyError(error); } finally { setButtonBusy(button, false); }
}

function openSetupDialog() {
  const accountRows = state.accounts.map(item => `<tr><td>${escapeHtml(item.account_nickname)}</td><td>${escapeHtml(item.account_type.replaceAll("_", " "))}</td><td>${formatCurrency(item.opening_balance)}</td></tr>`).join("");
  const supplierRows = state.suppliers.map(item => `<tr><td>${escapeHtml(item.supplier_name)}</td><td>${escapeHtml(item.email || "—")}</td><td>${escapeHtml(item.phone || "—")}</td></tr>`).join("");
  openDialog({
    title: "Accounts & suppliers", eyebrow: "Finance",
    body: `<div class="split-layout"><section class="section-card"><div class="section-card-header"><div><h3>Financial accounts</h3></div></div><form id="accountForm" class="form-grid"><label class="form-field full"><span class="form-label">Account nickname</span><input class="input" name="name" required placeholder="Kiwibank Dojo Account"></label><label class="form-field"><span class="form-label">Type</span><select class="select" name="type"><option value="bank">Bank</option><option value="cash">Cash</option><option value="pending_deposits">Pending deposits</option><option value="petty_cash">Petty cash</option><option value="other">Other</option></select></label><label class="form-field"><span class="form-label">Opening balance</span><input class="input" type="number" step="0.01" name="balance" value="0.00"></label><button id="addAccountButton" class="button button-primary full" type="button">Add account</button></form><div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Account</th><th>Type</th><th>Opening</th></tr></thead><tbody>${accountRows}</tbody></table></div></section><section class="section-card"><div class="section-card-header"><div><h3>Suppliers</h3></div></div><form id="supplierForm" class="form-grid"><label class="form-field full"><span class="form-label">Supplier name</span><input class="input" name="name" required></label><label class="form-field"><span class="form-label">Email</span><input class="input" type="email" name="email"></label><label class="form-field"><span class="form-label">Phone</span><input class="input" name="phone"></label><button id="addSupplierButton" class="button button-primary full" type="button">Add supplier</button></form><div class="table-wrap section-spacer"><table class="data-table"><thead><tr><th>Supplier</th><th>Email</th><th>Phone</th></tr></thead><tbody>${supplierRows}</tbody></table></div></section></div>`,
    footer: `<button class="button button-secondary" type="button" data-close-dialog>Close</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog); document.getElementById("addAccountButton").addEventListener("click", addAccount); document.getElementById("addSupplierButton").addEventListener("click", addSupplier);
}

async function addAccount(event) {
  const form = document.getElementById("accountForm"); if (!form.reportValidity()) return; setButtonBusy(event.currentTarget, true);
  try { const data = new FormData(form), supabase = getSupabaseClient(); const { error } = await supabase.from("financial_accounts").insert({ account_nickname: normaliseText(data.get("name")), account_type: data.get("type"), opening_balance: parseMoney(data.get("balance")), opening_balance_date: todayIso(), is_active: true }); if (error) throw error; closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Financial account added."); }
  catch (error) { notifyError(error); } finally { setButtonBusy(event.currentTarget, false); }
}

async function addSupplier(event) {
  const form = document.getElementById("supplierForm"); if (!form.reportValidity()) return; setButtonBusy(event.currentTarget, true);
  try { const data = new FormData(form), supabase = getSupabaseClient(); const { error } = await supabase.from("suppliers").insert({ supplier_name: normaliseText(data.get("name")), email: normaliseText(data.get("email")) || null, phone: normaliseText(data.get("phone")) || null, is_active: true }); if (error) throw error; closeDialog(); await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Supplier added."); }
  catch (error) { notifyError(error); } finally { setButtonBusy(event.currentTarget, false); }
}
