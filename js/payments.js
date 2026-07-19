import { getSupabaseClient } from "./database.js?v=1.3.0";
import { datePlusDays, dispatchDataChanged, formatCurrency, formatDate, normaliseText, parseMoney, todayIso } from "./utilities.js?v=1.3.0";
import { closeDialog, emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, openDialog, setButtonBusy, statusBadge } from "./ui.js?v=1.3.0";

let state = {
  families: [], guardians: [], links: [], payments: [], allocations: [],
  invoices: [], charges: [], students: [], outstanding: new Map(), invoiceDefaults: {}
};

export async function renderPayments(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const results = await Promise.all([
    supabase.from("families").select("*").is("deleted_at", null).order("family_name"),
    supabase.from("guardians").select("*").is("deleted_at", null).order("full_name"),
    supabase.from("guardian_families").select("*"),
    supabase.from("payments").select("*").is("deleted_at", null).order("payment_date", { ascending: false }).limit(100),
    supabase.from("payment_allocations").select("*").is("deleted_at", null).eq("status", "active"),
    supabase.from("invoices").select("*").is("deleted_at", null).order("invoice_date", { ascending: false }).limit(100),
    supabase.from("charges").select("*").is("deleted_at", null).in("status", ["unpaid","partially_paid","overdue"]).order("due_date"),
    supabase.from("students").select("id,first_name,last_name,preferred_name,family_id").is("deleted_at", null),
    supabase.from("app_settings").select("setting_value").eq("setting_key", "invoice.defaults").maybeSingle()
  ]);

  for (const result of results) if (result.error) throw result.error;
  [
    state.families, state.guardians, state.links, state.payments, state.allocations,
    state.invoices, state.charges, state.students
  ] = results.slice(0, 8).map(result => result.data || []);
  state.invoiceDefaults = results[8].data?.setting_value || {};
  state.outstanding = new Map();

  await Promise.all(state.charges.map(async charge => {
    const { data, error } = await supabase.rpc("charge_outstanding_amount", { p_charge_id: charge.id });
    if (!error) state.outstanding.set(charge.id, Number(data || 0));
  }));
}

function render(container) {
  const familyMap = new Map(state.families.map(item => [item.id, item.family_name]));
  const allocatedMap = new Map();
  state.allocations.forEach(allocation => {
    allocatedMap.set(allocation.payment_id, (allocatedMap.get(allocation.payment_id) || 0) + Number(allocation.allocation_amount));
  });

  const paymentRows = state.payments.map(payment => {
    const allocated = allocatedMap.get(payment.id) || 0;
    return `
      <tr>
        <td><strong>${escapeHtml(payment.payment_number || "Pending")}</strong><div class="record-meta">${formatDate(payment.payment_date)}</div></td>
        <td>${escapeHtml(familyMap.get(payment.family_id) || "—")}</td>
        <td>${formatCurrency(payment.amount)}</td>
        <td>${formatCurrency(allocated)}</td>
        <td>${formatCurrency(Math.max(Number(payment.amount) - allocated, 0))}</td>
        <td>${escapeHtml(payment.payment_method.replaceAll("_"," "))}</td>
        <td>${statusBadge(payment.payment_status)}</td>
        <td class="table-actions"><button class="button button-secondary button-small" data-action="view-receipt" data-id="${payment.id}">Receipt</button><button class="button button-danger button-small" data-action="reverse-payment" data-id="${payment.id}" ${payment.payment_status === "reversed" ? "disabled" : ""}>Reverse</button></td>
      </tr>`;
  }).join("");

  const invoiceRows = state.invoices.map(invoice => `
    <tr>
      <td><strong>${escapeHtml(invoice.invoice_number)}</strong><div class="record-meta">${formatDate(invoice.invoice_date)}</div></td>
      <td>${escapeHtml(familyMap.get(invoice.family_id) || "—")}</td>
      <td>${formatCurrency(invoice.subtotal)}</td>
      <td>${formatCurrency(invoice.outstanding_amount)}</td>
      <td>${statusBadge(invoice.status)}</td>
      <td class="table-actions"><button class="button button-secondary button-small" data-action="view-invoice" data-id="${invoice.id}">View / print</button></td>
    </tr>`).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "Finance", title: "Payments & Invoices", description: "Record family payments, allocate them across sibling charges, and issue printable invoices.", actions: `
        <button id="recordPaymentButton" class="button button-primary" type="button">Record payment</button>
        <button id="createInvoiceButton" class="button button-secondary" type="button">Create invoice</button>` })}
      <section class="section-card">
        <div class="section-card-header"><div><h3>Payments</h3><p class="muted">Unallocated money remains as family credit.</p></div></div>
        ${state.payments.length ? `
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Payment</th><th>Family</th><th>Received</th><th>Allocated</th><th>Credit</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="paymentRows">${paymentRows}</tbody>
          </table></div>` : emptyState("No payments recorded", "Record a fictional family payment after creating a charge.")}
      </section>
      <section class="section-card">
        <div class="section-card-header"><div><h3>Invoices</h3><p class="muted">Invoices are created from existing confirmed charges.</p></div></div>
        ${state.invoices.length ? `
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Invoice</th><th>Family</th><th>Total</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="invoiceRows">${invoiceRows}</tbody>
          </table></div>` : emptyState("No invoices issued", "Select a family with outstanding charges and create an invoice.")}
      </section>
    </div>`;

  container.querySelector("#recordPaymentButton").addEventListener("click", openPaymentDialog);
  container.querySelector("#createInvoiceButton").addEventListener("click", openInvoiceDialog);
  container.querySelector("#paymentRows")?.addEventListener("click", handlePaymentAction);
  container.querySelector("#invoiceRows")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-action='view-invoice']");
    if (button) viewInvoice(button.dataset.id);
  });
}

function familyOptions() {
  return state.families.map(family => `<option value="${family.id}">${escapeHtml(family.family_name)}</option>`).join("");
}

function openPaymentDialog() {
  openDialog({
    title: "Record family payment",
    eyebrow: "Finance",
    body: `
      <form id="paymentForm" class="form-grid">
        <label class="form-field"><span class="form-label">Family</span><select id="paymentFamily" class="select" name="familyId" required><option value="">Select family</option>${familyOptions()}</select></label>
        <label class="form-field"><span class="form-label">Payment date</span><input class="input" type="date" name="paymentDate" required value="${todayIso()}"></label>
        <label class="form-field"><span class="form-label">Amount received</span><input id="paymentAmount" class="input" type="number" min="0.01" step="0.01" name="amount" required></label>
        <label class="form-field"><span class="form-label">Payment method</span><select class="select" name="method">
          <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="eftpos">EFTPOS</option><option value="other">Other</option>
        </select></label>
        <label class="form-field"><span class="form-label">Bank reference</span><input class="input" name="bankReference"></label>
        <label class="form-field"><span class="form-label">Bank description</span><input class="input" name="bankDescription"></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes"></textarea></label>
      </form>
      <div class="section-card section-spacer">
        <div class="section-card-header">
          <div><h3>Allocate payment</h3><p class="muted">Allocate across one or more sibling charges, or leave some as family credit.</p></div>
          <button id="autoAllocateButton" class="button button-secondary button-small" type="button">Auto allocate oldest</button>
        </div>
        <div id="paymentAllocationList" class="allocation-list"><div class="inline-message">Select a family first.</div></div>
      </div>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="savePaymentButton" class="button button-primary" type="button">Save payment</button>`
  });

  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("paymentFamily").addEventListener("change", renderPaymentAllocations);
  document.getElementById("autoAllocateButton").addEventListener("click", autoAllocate);
  document.getElementById("savePaymentButton").addEventListener("click", savePayment);
}

function chargesForFamily(familyId) {
  const studentIds = new Set(state.students.filter(student => student.family_id === familyId).map(student => student.id));
  return state.charges.filter(charge => charge.family_id === familyId || studentIds.has(charge.student_id))
    .filter(charge => (state.outstanding.get(charge.id) || 0) > 0);
}

function renderPaymentAllocations() {
  const familyId = document.getElementById("paymentFamily").value;
  const container = document.getElementById("paymentAllocationList");
  const charges = chargesForFamily(familyId);
  const studentMap = new Map(state.students.map(student => [student.id, `${student.preferred_name || student.first_name} ${student.last_name}`]));
  container.innerHTML = charges.length ? charges.map(charge => `
    <label class="allocation-row">
      <span class="allocation-details"><strong>${escapeHtml(charge.description)}</strong><small>${escapeHtml(studentMap.get(charge.student_id) || "Family charge")} · Outstanding ${formatCurrency(state.outstanding.get(charge.id))}</small></span>
      <input class="input payment-allocation" type="number" min="0" step="0.01" value="0.00" data-charge-id="${charge.id}" data-max="${state.outstanding.get(charge.id)}">
    </label>`).join("") : '<div class="inline-message">This family has no outstanding charges. The payment can be saved as credit.</div>';
}

function autoAllocate() {
  let remaining = parseMoney(document.getElementById("paymentAmount").value);
  document.querySelectorAll(".payment-allocation").forEach(input => {
    const amount = Math.min(remaining, Number(input.dataset.max || 0));
    input.value = amount.toFixed(2);
    remaining = Math.max(remaining - amount, 0);
  });
}

async function savePayment(event) {
  const button = event.currentTarget;
  const form = document.getElementById("paymentForm");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const amount = parseMoney(data.get("amount"));
    const allocations = [...document.querySelectorAll(".payment-allocation")]
      .map(input => ({ charge_id: input.dataset.chargeId, allocation_amount: parseMoney(input.value) }))
      .filter(item => item.allocation_amount > 0);
    const allocatedTotal = allocations.reduce((sum, item) => sum + item.allocation_amount, 0);
    if (allocatedTotal > amount + 0.001) throw new Error("Allocations cannot exceed the payment amount.");

    const supabase = getSupabaseClient();
    const { data: number, error: numberError } = await supabase.rpc("next_payment_number", { p_payment_date: data.get("paymentDate") });
    if (numberError) throw numberError;

    const { data: payment, error: paymentError } = await supabase.from("payments").insert({
      payment_number: number,
      family_id: data.get("familyId"),
      payment_date: data.get("paymentDate"),
      amount,
      payment_method: data.get("method"),
      payment_status: "confirmed",
      bank_reference: normaliseText(data.get("bankReference")) || null,
      bank_description: normaliseText(data.get("bankDescription")) || null,
      notes: normaliseText(data.get("notes")) || null,
      confirmed_at: new Date().toISOString()
    }).select("id").single();
    if (paymentError) throw paymentError;

    if (allocations.length) {
      const rows = allocations.map(item => ({
        payment_id: payment.id,
        charge_id: item.charge_id,
        allocation_amount: item.allocation_amount,
        allocation_date: data.get("paymentDate"),
        status: "active"
      }));
      const { error: allocationError } = await supabase.from("payment_allocations").insert(rows);
      if (allocationError) throw allocationError;
    }

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Payment recorded.");
    dispatchDataChanged({ module: "payments" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

function openInvoiceDialog() {
  const terms = Number(state.invoiceDefaults.payment_terms_days ?? 14);
  openDialog({
    title: "Create invoice",
    eyebrow: "Finance",
    body: `
      <form id="invoiceForm" class="form-grid">
        <label class="form-field"><span class="form-label">Family</span><select id="invoiceFamily" class="select" name="familyId" required><option value="">Select family</option>${familyOptions()}</select></label>
        <label class="form-field"><span class="form-label">Invoice date</span><input class="input" type="date" name="invoiceDate" required value="${todayIso()}"></label>
        <label class="form-field"><span class="form-label">Due date</span><input class="input" type="date" name="dueDate" value="${datePlusDays(todayIso(), terms)}"></label>
        <label class="form-field"><span class="form-label">Payment reference</span><input class="input" name="paymentReference"></label>
        <label class="form-field full"><span class="form-label">Invoice note</span><textarea class="textarea" name="notes"></textarea></label>
      </form>
      <div class="section-card section-spacer">
        <div class="section-card-header"><div><h3>Charges to include</h3><p class="muted">Only existing confirmed charges are invoiced.</p></div></div>
        <div id="invoiceChargeList" class="allocation-list"><div class="inline-message">Select a family first.</div></div>
      </div>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveInvoiceButton" class="button button-primary" type="button">Create and issue invoice</button>`
  });
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.getElementById("invoiceFamily").addEventListener("change", renderInvoiceCharges);
  document.getElementById("saveInvoiceButton").addEventListener("click", saveInvoice);
}

function renderInvoiceCharges() {
  const familyId = document.getElementById("invoiceFamily").value;
  const family = state.families.find(item => item.id === familyId);
  if (family) document.querySelector("#invoiceForm [name='paymentReference']").value = family.payment_reference || family.family_name;

  const container = document.getElementById("invoiceChargeList");
  const studentMap = new Map(state.students.map(student => [student.id, `${student.preferred_name || student.first_name} ${student.last_name}`]));
  const charges = chargesForFamily(familyId);
  container.innerHTML = charges.length ? charges.map(charge => `
    <label class="allocation-row">
      <span class="allocation-details"><strong>${escapeHtml(charge.description)}</strong><small>${escapeHtml(studentMap.get(charge.student_id) || "Family charge")} · ${formatCurrency(state.outstanding.get(charge.id))}</small></span>
      <input class="invoice-charge" type="checkbox" checked data-charge-id="${charge.id}">
    </label>`).join("") : '<div class="inline-message">This family has no outstanding charges to invoice.</div>';
}

async function saveInvoice(event) {
  const button = event.currentTarget;
  const form = document.getElementById("invoiceForm");
  if (!form.reportValidity()) return;
  const chargeIds = [...document.querySelectorAll(".invoice-charge:checked")].map(input => input.dataset.chargeId);
  if (!chargeIds.length) {
    notifyError(new Error("Select at least one charge."));
    return;
  }
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const familyId = data.get("familyId");
    const family = state.families.find(item => item.id === familyId);
    const guardianLink = state.links.find(link => link.family_id === familyId && link.is_primary_billing_contact) || state.links.find(link => link.family_id === familyId);
    const supabase = getSupabaseClient();

    const { data: number, error: numberError } = await supabase.rpc("next_invoice_number", { p_invoice_date: data.get("invoiceDate") });
    if (numberError) throw numberError;

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      invoice_number: number,
      family_id: familyId,
      guardian_id: guardianLink?.guardian_id || null,
      invoice_date: data.get("invoiceDate"),
      due_date: data.get("dueDate") || null,
      status: "draft",
      payment_reference: normaliseText(data.get("paymentReference")) || family?.payment_reference || family?.family_name,
      notes: normaliseText(data.get("notes")) || null
    }).select("id").single();
    if (invoiceError) throw invoiceError;

    const selectedCharges = state.charges.filter(charge => chargeIds.includes(charge.id));
    const items = selectedCharges.map((charge, index) => ({
      invoice_id: invoice.id,
      charge_id: charge.id,
      student_id: charge.student_id,
      description_snapshot: charge.description,
      quantity: 1,
      unit_amount: Number(charge.final_amount),
      line_amount: Number(charge.final_amount),
      display_order: index + 1
    }));
    const { error: itemError } = await supabase.from("invoice_items").insert(items);
    if (itemError) throw itemError;

    const { error: issueError } = await supabase.from("invoices").update({ status: "issued", issued_at: new Date().toISOString() }).eq("id", invoice.id);
    if (issueError) throw issueError;


    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(`Invoice ${number} created.`);
    dispatchDataChanged({ module: "invoices" });
    await viewInvoice(invoice.id);
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}


function handlePaymentAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const payment = state.payments.find(item => item.id === button.dataset.id);
  if (!payment) return;
  if (button.dataset.action === "view-receipt") viewReceipt(payment);
  if (button.dataset.action === "reverse-payment") reversePayment(payment);
}

async function viewReceipt(payment) {
  try {
    const supabase = getSupabaseClient();
    const { data: allocations, error: allocationError } = await supabase.from("payment_allocations").select("*").eq("payment_id", payment.id).eq("status", "active").is("deleted_at", null);
    if (allocationError) throw allocationError;
    const chargeIds = (allocations || []).map(item => item.charge_id);
    const { data: charges, error: chargeError } = chargeIds.length ? await supabase.from("charges").select("id,student_id,description").in("id", chargeIds) : { data: [], error: null };
    if (chargeError) throw chargeError;
    const chargeMap = new Map((charges || []).map(item => [item.id, item]));
    const studentMap = new Map(state.students.map(item => [item.id, `${item.preferred_name || item.first_name} ${item.last_name}`]));
    const family = state.families.find(item => item.id === payment.family_id);
    const settingsResult = await supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", ["dojo.profile","invoice.defaults"]).is("deleted_at", null);
    if (settingsResult.error) throw settingsResult.error;
    const settings = Object.fromEntries((settingsResult.data || []).map(row => [row.setting_key, row.setting_value]));
    const dojo = settings["dojo.profile"] || {}, defaults = settings["invoice.defaults"] || {};
    const allocated = (allocations || []).reduce((sum, item) => sum + Number(item.allocation_amount), 0);
    const body = `<div class="invoice-preview"><p>${dojoContactBlock(dojo)}</p><h2>Payment receipt ${escapeHtml(payment.payment_number)}</h2><p><strong>Date received:</strong> ${formatDate(payment.payment_date)}<br><strong>Family:</strong> ${escapeHtml(family?.billing_name || family?.family_name || "—")}<br><strong>Method:</strong> ${escapeHtml(payment.payment_method.replaceAll("_", " "))}<br><strong>Reference:</strong> ${escapeHtml(payment.bank_reference || "—")}</p><table><thead><tr><th>Allocated to</th><th>Student</th><th>Amount</th></tr></thead><tbody>${(allocations || []).map(item => { const charge = chargeMap.get(item.charge_id); return `<tr><td>${escapeHtml(charge?.description || "Unidentified charge")}</td><td>${escapeHtml(studentMap.get(charge?.student_id) || "Family")}</td><td>${formatCurrency(item.allocation_amount)}</td></tr>`; }).join("") || '<tr><td colspan="3">Unallocated family credit</td></tr>'}</tbody></table><p class="invoice-total">Amount received: ${formatCurrency(payment.amount)}</p><p class="invoice-total">Allocated: ${formatCurrency(allocated)}</p><p class="invoice-total">Remaining family credit: ${formatCurrency(Math.max(Number(payment.amount) - allocated, 0))}</p><p>${escapeHtml(defaults.footer || "Thank you for supporting JKA Christchurch – GardenCity.")}</p></div>`;
    openDialog({ title: `Receipt ${payment.payment_number}`, eyebrow: "Finance", body, footer: '<button class="button button-secondary" type="button" data-close-dialog>Close</button><button id="printReceiptButton" class="button button-primary" type="button">Print / save PDF</button>' });
    document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
    document.getElementById("printReceiptButton").addEventListener("click", () => printInvoice(body));
  } catch (error) { notifyError(error); }
}

async function reversePayment(payment) {
  const reason = window.prompt(`Reason for reversing ${payment.payment_number}:`);
  if (!reason) return;
  try {
    const supabase = getSupabaseClient();
    const { data: allocations, error: allocationError } = await supabase.from("payment_allocations").select("id").eq("payment_id", payment.id).eq("status", "active").is("deleted_at", null);
    if (allocationError) throw allocationError;
    for (const allocation of allocations || []) {
      const { error } = await supabase.from("payment_allocations").update({ status: "reversed", reversed_at: new Date().toISOString(), reversal_reason: reason }).eq("id", allocation.id);
      if (error) throw error;
    }
    const { error } = await supabase.from("payments").update({ payment_status: "reversed", reversed_at: new Date().toISOString(), reversal_reason: reason }).eq("id", payment.id);
    if (error) throw error;
    await refresh(); render(document.getElementById("moduleContent")); notifySuccess("Payment reversed. Create a corrected payment if required."); dispatchDataChanged({ module: "payments" });
  } catch (error) { notifyError(error); }
}

async function viewInvoice(invoiceId) {
  try {
    const supabase = getSupabaseClient();
    const [{ data: invoice, error: invoiceError }, { data: items, error: itemError }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("display_order")
    ]);
    if (invoiceError) throw invoiceError;
    if (itemError) throw itemError;

    const family = state.families.find(item => item.id === invoice.family_id);
    const guardian = state.guardians.find(item => item.id === invoice.guardian_id);
    const settingsResult = await supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", ["dojo.profile","invoice.defaults"]).is("deleted_at", null);
    if (settingsResult.error) throw settingsResult.error;
    const settings = Object.fromEntries((settingsResult.data || []).map(row => [row.setting_key, row.setting_value]));
    const dojo = settings["dojo.profile"] || {};
    const defaults = settings["invoice.defaults"] || {};

    const body = `
      <div id="printableInvoice" class="invoice-preview">
        <p>${dojoContactBlock(dojo)}</p>
        <h2>Invoice ${escapeHtml(invoice.invoice_number)}</h2>
        <p><strong>Invoice date:</strong> ${formatDate(invoice.invoice_date)}<br>
        <strong>Due date:</strong> ${formatDate(invoice.due_date)}<br>
        <strong>Family:</strong> ${escapeHtml(family?.billing_name || family?.family_name || "—")}<br>
        ${guardian ? `<strong>Guardian:</strong> ${escapeHtml(guardian.full_name)}<br>` : ""}
        <strong>Payment reference:</strong> ${escapeHtml(invoice.payment_reference || "—")}</p>
        <table><thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>${items.map(item => `<tr><td>${escapeHtml(item.description_snapshot)}</td><td>${formatCurrency(item.line_amount)}</td></tr>`).join("")}</tbody></table>
        <p class="invoice-total">Total: ${formatCurrency(invoice.subtotal)}</p>
        <p class="invoice-total">Paid: ${formatCurrency(invoice.payments_applied)}</p>
        <p class="invoice-total">Outstanding: ${formatCurrency(invoice.outstanding_amount)}</p>
        ${invoice.notes ? `<p>${escapeHtml(invoice.notes)}</p>` : ""}
        <p>${escapeHtml(defaults.footer || "Thank you for supporting JKA Christchurch – GardenCity.")}</p>
        <p><strong>Account:</strong> ${escapeHtml(defaults.account_nickname || "Kiwibank Dojo Account")}</p>
      </div>`;

    openDialog({
      title: `Invoice ${invoice.invoice_number}`,
      eyebrow: "Finance",
      body,
      footer: `<button class="button button-secondary" type="button" data-close-dialog>Close</button><button id="printInvoiceButton" class="button button-primary" type="button">Print / save PDF</button>`
    });
    document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
    document.getElementById("printInvoiceButton").addEventListener("click", () => printInvoice(body));
  } catch (error) {
    notifyError(error);
  }
}

function dojoContactBlock(dojo) {
  const address = [
    dojo.address_line_1,
    dojo.address_line_2,
    dojo.suburb,
    dojo.city,
    dojo.postcode,
    dojo.country
  ].filter(Boolean).map(escapeHtml).join(", ");
  const contact = [dojo.email, dojo.phone].filter(Boolean).map(escapeHtml).join(" · ");
  const instructorName = normaliseText(dojo.instructor_name || "André Von Rhenen");
  const instructorTitle = normaliseText(dojo.instructor_title || "Sensei");
  const titleLower = instructorTitle.toLocaleLowerCase("en-NZ");
  const nameLower = instructorName.toLocaleLowerCase("en-NZ");
  const instructorDisplay = titleLower.includes(nameLower)
    ? instructorTitle
    : nameLower.startsWith(`${titleLower} `)
      ? instructorName
      : [instructorTitle, instructorName].filter(Boolean).join(" ");

  return `<strong>${escapeHtml(dojo.dojo_name || "JKA Christchurch – GardenCity")}</strong><br>${escapeHtml(instructorDisplay)}${dojo.affiliation ? `<br>${escapeHtml(dojo.affiliation)}` : ""}${address ? `<br>${address}` : dojo.location ? `<br>${escapeHtml(dojo.location)}` : ""}${contact ? `<br>${contact}` : ""}`;
}

function printInvoice(body) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    notifyError(new Error("Allow pop-ups to print the invoice."));
    return;
  }
  printWindow.document.write(`<!doctype html><html><head><title>Invoice</title><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#111827}.invoice-preview{max-width:760px;margin:auto}
    table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #d1d5db;text-align:left}
    .invoice-total{text-align:right;font-weight:bold}@media print{body{margin:0}}
  </style></head><body>${body}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}
