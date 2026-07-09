import { getSupabaseClient } from "./database.js?v=1.0.1";
import { dispatchDataChanged, normaliseText, nowIso } from "./utilities.js?v=1.0.1";
import { closeDialog, confirmAction, emptyState, escapeHtml, moduleHeader, notifyError, notifySuccess, openDialog, setButtonBusy } from "./ui.js?v=1.0.1";

let state = { families: [], guardians: [], links: [] };

export async function renderFamilies(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [familiesResult, guardiansResult, linksResult] = await Promise.all([
    supabase.from("families").select("*").is("deleted_at", null).order("family_name"),
    supabase.from("guardians").select("*").is("deleted_at", null).order("full_name"),
    supabase.from("guardian_families").select("*")
  ]);
  if (familiesResult.error) throw familiesResult.error;
  if (guardiansResult.error) throw guardiansResult.error;
  if (linksResult.error) throw linksResult.error;
  state = { families: familiesResult.data || [], guardians: guardiansResult.data || [], links: linksResult.data || [] };
}

function render(container) {
  const rows = state.families.map(family => {
    const links = state.links.filter(link => link.family_id === family.id);
    const guardians = links.map(link => state.guardians.find(g => g.id === link.guardian_id)).filter(Boolean);
    return `
      <tr data-search="${escapeHtml(`${family.family_name} ${family.billing_name || ""} ${family.payment_reference || ""}`.toLowerCase())}">
        <td><strong>${escapeHtml(family.family_name)}</strong><div class="record-meta">${escapeHtml(family.billing_name || "")}</div></td>
        <td>${guardians.length ? guardians.map(g => escapeHtml(g.full_name)).join("<br>") : "—"}</td>
        <td>${escapeHtml(family.payment_reference || "—")}</td>
        <td>${family.is_active ? '<span class="badge success">Active</span>' : '<span class="badge muted">Inactive</span>'}</td>
        <td class="table-actions">
          <button class="button button-secondary button-small" data-action="edit-family" data-id="${family.id}">Edit</button>
          <button class="button button-secondary button-small" data-action="add-guardian" data-id="${family.id}">Add guardian</button>
          <button class="button button-danger button-small" data-action="archive-family" data-id="${family.id}">Archive</button>
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({ eyebrow: "People", title: "Families & Guardians", description: "Create shared family records and link guardians without duplicating information.", actions: '<button id="addFamilyButton" class="button button-primary" type="button">Add family</button>' })}
      <div class="module-toolbar">
        <input id="familySearch" class="input search-input" type="search" placeholder="Search families or payment references">
        <div class="record-meta">${state.families.length} families · ${state.guardians.length} guardians</div>
      </div>
      ${state.families.length ? `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Family</th><th>Guardians</th><th>Payment reference</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="familyRows">${rows}</tbody>
        </table></div>` : emptyState("No family records yet", "Create a family before adding students or recording family payments.")}
    </div>`;

  container.querySelector("#addFamilyButton").addEventListener("click", () => openFamilyDialog());
  container.querySelector("#familySearch")?.addEventListener("input", filterRows);
  container.querySelector("#familyRows")?.addEventListener("click", handleTableAction);
}

function filterRows(event) {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#familyRows tr").forEach(row => { row.hidden = query && !row.dataset.search.includes(query); });
}

function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const family = state.families.find(item => item.id === button.dataset.id);
  if (!family) return;
  if (button.dataset.action === "edit-family") openFamilyDialog(family);
  if (button.dataset.action === "add-guardian") openGuardianDialog(family);
  if (button.dataset.action === "archive-family") archiveFamily(family);
}

function openFamilyDialog(family = null) {
  openDialog({
    title: family ? "Edit family" : "Add family",
    eyebrow: "People",
    body: `
      <form id="familyForm" class="form-grid">
        <input type="hidden" name="id" value="${family?.id || ""}">
        <label class="form-field"><span class="form-label">Family name</span><input class="input" name="familyName" required value="${escapeHtml(family?.family_name || "")}"></label>
        <label class="form-field"><span class="form-label">Billing name</span><input class="input" name="billingName" value="${escapeHtml(family?.billing_name || "")}"></label>
        <label class="form-field"><span class="form-label">Payment reference</span><input class="input" name="paymentReference" value="${escapeHtml(family?.payment_reference || "")}"></label>
        <label class="form-field"><span class="form-label">City</span><input class="input" name="city" value="${escapeHtml(family?.city || "Christchurch")}"></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(family?.notes || "")}</textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveFamilyButton" class="button button-primary" type="submit" form="familyForm">${family ? "Save changes" : "Create family"}</button>`
  });
  const dialog = document.getElementById("appDialog");
  dialog.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  dialog.querySelector("#familyForm").addEventListener("submit", saveFamily);
}

async function saveFamily(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("saveFamilyButton");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const row = {
      family_name: normaliseText(data.get("familyName")),
      billing_name: normaliseText(data.get("billingName")) || null,
      payment_reference: normaliseText(data.get("paymentReference")) || null,
      city: normaliseText(data.get("city")) || "Christchurch",
      notes: normaliseText(data.get("notes")) || null,
      is_active: true
    };
    const id = data.get("id");
    const supabase = getSupabaseClient();
    const result = id ? await supabase.from("families").update(row).eq("id", id) : await supabase.from("families").insert(row);
    if (result.error) throw result.error;
    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(id ? "Family updated." : "Family created.");
    dispatchDataChanged({ module: "families" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

function openGuardianDialog(family) {
  openDialog({
    title: `Add guardian to ${family.family_name}`,
    eyebrow: "People",
    body: `
      <form id="guardianForm" class="form-grid">
        <input type="hidden" name="familyId" value="${family.id}">
        <label class="form-field full"><span class="form-label">Full name</span><input class="input" name="fullName" required></label>
        <label class="form-field"><span class="form-label">Email</span><input class="input" type="email" name="email"></label>
        <label class="form-field"><span class="form-label">Mobile number</span><input class="input" name="mobile"></label>
        <label class="checkbox-row full"><input type="checkbox" name="primaryBilling"><span>Primary billing contact</span></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes"></textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveGuardianButton" class="button button-primary" type="submit" form="guardianForm">Add guardian</button>`
  });
  const dialog = document.getElementById("appDialog");
  dialog.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  dialog.querySelector("#guardianForm").addEventListener("submit", saveGuardian);
}

async function saveGuardian(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("saveGuardianButton");
  if (!form.reportValidity()) return;
  setButtonBusy(button, true);
  try {
    const data = new FormData(form);
    const familyId = data.get("familyId");
    const supabase = getSupabaseClient();
    const { data: guardian, error: guardianError } = await supabase.from("guardians").insert({
      full_name: normaliseText(data.get("fullName")),
      email: normaliseText(data.get("email")) || null,
      mobile_number: normaliseText(data.get("mobile")) || null,
      notes: normaliseText(data.get("notes")) || null
    }).select("id").single();
    if (guardianError) throw guardianError;

    const primary = data.get("primaryBilling") === "on";
    const { error: linkError } = await supabase.from("guardian_families").insert({
      guardian_id: guardian.id, family_id: familyId, is_primary_billing_contact: primary
    });
    if (linkError) throw linkError;

    if (primary) {
      const { error: familyError } = await supabase.from("families").update({ primary_guardian_id: guardian.id }).eq("id", familyId);
      if (familyError) throw familyError;
    }

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Guardian added.");
    dispatchDataChanged({ module: "families" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

async function archiveFamily(family) {
  if (!await confirmAction(`Archive the ${family.family_name} family record? Students will not be deleted.`)) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("families").update({ deleted_at: nowIso(), is_active: false }).eq("id", family.id);
    if (error) throw error;
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Family archived.");
    dispatchDataChanged({ module: "families" });
  } catch (error) {
    notifyError(error);
  }
}
