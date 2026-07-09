import { getSupabaseClient } from "./database.js?v=1.2.0";
import { dispatchDataChanged, normaliseText, nowIso } from "./utilities.js?v=1.2.0";
import {
  closeDialog,
  emptyState,
  escapeHtml,
  moduleHeader,
  notifyError,
  notifySuccess,
  openDialog,
  setButtonBusy
} from "./ui.js?v=1.2.0";

let state = { families: [], guardians: [], links: [], students: [] };

export async function renderFamilies(container) {
  await refresh();
  render(container);
}

async function refresh() {
  const supabase = getSupabaseClient();
  const [familiesResult, guardiansResult, linksResult, studentsResult] = await Promise.all([
    supabase.from("families").select("*").is("deleted_at", null).order("family_name"),
    supabase.from("guardians").select("*").is("deleted_at", null).order("full_name"),
    supabase.from("guardian_families").select("*"),
    supabase.from("students").select("id,family_id,first_name,last_name,preferred_name,status").is("deleted_at", null).order("last_name")
  ]);

  for (const result of [familiesResult, guardiansResult, linksResult, studentsResult]) {
    if (result.error) throw result.error;
  }

  state = {
    families: familiesResult.data || [],
    guardians: guardiansResult.data || [],
    links: linksResult.data || [],
    students: studentsResult.data || []
  };
}

function render(container) {
  const rows = state.families.map(family => {
    const familyLinks = state.links.filter(link => link.family_id === family.id);
    const guardians = familyLinks
      .map(link => ({ ...state.guardians.find(item => item.id === link.guardian_id), link }))
      .filter(item => item.id);
    const primary = guardians.find(item => item.id === family.primary_guardian_id)
      || guardians.find(item => item.link.is_primary_billing_contact)
      || guardians[0];
    const students = state.students.filter(student => student.family_id === family.id);
    const address = [family.address_line_1, family.suburb, family.city, family.postcode].filter(Boolean).join(", ");

    return `
      <tr data-search="${escapeHtml(`${family.family_name} ${family.billing_name || ""} ${family.payment_reference || ""} ${primary?.full_name || ""} ${students.map(s => `${s.first_name} ${s.last_name}`).join(" ")}`.toLowerCase())}">
        <td>
          <strong>${escapeHtml(family.family_name)}</strong>
          <div class="record-meta">${escapeHtml(family.billing_name || "No billing name")}</div>
        </td>
        <td>
          ${primary ? `<strong>${escapeHtml(primary.full_name)}</strong><div class="record-meta">${escapeHtml(primary.email || "No email")} · ${escapeHtml(primary.mobile_number || "No mobile")}</div>` : "—"}
        </td>
        <td>${students.length ? students.map(student => `${escapeHtml(student.preferred_name || student.first_name)} ${escapeHtml(student.last_name)}`).join("<br>") : "—"}</td>
        <td>${escapeHtml(family.payment_reference || "—")}<div class="record-meta">${escapeHtml(address || "Address incomplete")}</div></td>
        <td class="table-actions">
          <button class="button button-primary button-small" data-action="open-students">Open Student Hub</button>
          <button class="button button-secondary button-small" data-action="edit-family" data-id="${family.id}">Advanced family edit</button>
          <button class="button button-secondary button-small" data-action="add-guardian" data-id="${family.id}">Add another guardian</button>
          <button class="button button-danger button-small" data-action="delete-family" data-id="${family.id}">Delete family</button>
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="module-shell">
      ${moduleHeader({
        eyebrow: "People",
        title: "Families & Guardians",
        description: "This is a linked directory. Normal additions and edits should be completed in Student Hub so the student, family and primary guardian are saved together.",
        actions: '<button id="openStudentHubButton" class="button button-primary" type="button">Open Student Hub</button>'
      })}

      <div class="master-record-banner">
        <div>
          <strong>Student Hub is the default editor</strong>
          <p>Use this page mainly to review linked families or add an additional guardian. Shared changes made here still update every linked student, invoice and payment record.</p>
        </div>
        <span class="badge warning">Advanced directory</span>
      </div>

      <div class="module-toolbar">
        <input id="familySearch" class="input search-input" type="search" placeholder="Search families, guardians or students">
        <div class="record-meta">${state.families.length} families · ${state.guardians.length} guardians</div>
      </div>

      ${state.families.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Family</th><th>Primary guardian</th><th>Students</th><th>Billing details</th><th>Actions</th></tr></thead>
            <tbody id="familyRows">${rows}</tbody>
          </table>
        </div>` : emptyState(
          "No family records yet",
          "Start in Student Hub and create the student, family and primary guardian together."
        )}
    </div>`;

  container.querySelector("#openStudentHubButton").addEventListener("click", openStudentHub);
  container.querySelector("#familySearch")?.addEventListener("input", filterRows);
  container.querySelector("#familyRows")?.addEventListener("click", handleTableAction);
}

function openStudentHub() {
  document.querySelector('#mainNavigation [data-page="students"]')?.click();
}

function filterRows(event) {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#familyRows tr").forEach(row => {
    row.hidden = query && !row.dataset.search.includes(query);
  });
}

function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "open-students") {
    openStudentHub();
    return;
  }

  const family = state.families.find(item => item.id === button.dataset.id);
  if (!family) return;
  if (button.dataset.action === "edit-family") openFamilyDialog(family);
  if (button.dataset.action === "add-guardian") openGuardianDialog(family);
  if (button.dataset.action === "delete-family") prepareFamilyDeletion(family);
}

function openFamilyDialog(family) {
  openDialog({
    title: `Advanced edit: ${family.family_name}`,
    eyebrow: "Families & Guardians",
    body: `
      <div class="inline-message warning">Student Hub is the preferred place for normal changes. Use this advanced form only when correcting shared family billing or address details.</div>
      <form id="familyForm" class="form-grid section-spacer">
        <input type="hidden" name="id" value="${family.id}">
        <label class="form-field"><span class="form-label">Family name</span><input class="input" name="familyName" required value="${escapeHtml(family.family_name || "")}"></label>
        <label class="form-field"><span class="form-label">Billing name</span><input class="input" name="billingName" value="${escapeHtml(family.billing_name || "")}"></label>
        <label class="form-field"><span class="form-label">Payment reference</span><input class="input" name="paymentReference" value="${escapeHtml(family.payment_reference || "")}"></label>
        <label class="form-field"><span class="form-label">Address line 1</span><input class="input" name="address1" value="${escapeHtml(family.address_line_1 || "")}"></label>
        <label class="form-field"><span class="form-label">Address line 2</span><input class="input" name="address2" value="${escapeHtml(family.address_line_2 || "")}"></label>
        <label class="form-field"><span class="form-label">Suburb</span><input class="input" name="suburb" value="${escapeHtml(family.suburb || "")}"></label>
        <label class="form-field"><span class="form-label">City</span><input class="input" name="city" value="${escapeHtml(family.city || "Christchurch")}"></label>
        <label class="form-field"><span class="form-label">Postcode</span><input class="input" name="postcode" value="${escapeHtml(family.postcode || "")}"></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(family.notes || "")}</textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveFamilyButton" class="button button-primary" type="submit" form="familyForm">Save shared details</button>`
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
      address_line_1: normaliseText(data.get("address1")) || null,
      address_line_2: normaliseText(data.get("address2")) || null,
      suburb: normaliseText(data.get("suburb")) || null,
      city: normaliseText(data.get("city")) || "Christchurch",
      postcode: normaliseText(data.get("postcode")) || null,
      notes: normaliseText(data.get("notes")) || null,
      is_active: true
    };

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("families").update(row).eq("id", data.get("id"));
    if (error) throw error;

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess("Shared family details updated everywhere.");
    dispatchDataChanged({ module: "families" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

function openGuardianDialog(family) {
  openDialog({
    title: `Add another guardian to ${family.family_name}`,
    eyebrow: "Families & Guardians",
    body: `
      <form id="guardianForm" class="form-grid">
        <input type="hidden" name="familyId" value="${family.id}">
        <label class="form-field full"><span class="form-label">Full name</span><input class="input" name="fullName" required></label>
        <label class="form-field"><span class="form-label">Email</span><input class="input" type="email" name="email"></label>
        <label class="form-field"><span class="form-label">Mobile number</span><input class="input" name="mobile"></label>
        <label class="checkbox-row full"><input type="checkbox" name="primaryBilling"><span>Make primary billing contact</span></label>
        <label class="form-field full"><span class="form-label">Notes</span><textarea class="textarea" name="notes"></textarea></label>
      </form>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="saveGuardianButton" class="button button-primary" type="submit" form="guardianForm">Add linked guardian</button>`
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
    const email = normaliseText(data.get("email"));
    const mobile = normaliseText(data.get("mobile"));
    const duplicate = state.guardians.find(guardian =>
      (email && guardian.email?.toLowerCase() === email.toLowerCase()) ||
      (mobile && guardian.mobile_number === mobile)
    );

    const supabase = getSupabaseClient();
    let guardianId = duplicate?.id || null;

    if (!guardianId) {
      const { data: guardian, error: guardianError } = await supabase
        .from("guardians")
        .insert({
          full_name: normaliseText(data.get("fullName")),
          email: email || null,
          mobile_number: mobile || null,
          notes: normaliseText(data.get("notes")) || null
        })
        .select("id")
        .single();
      if (guardianError) throw guardianError;
      guardianId = guardian.id;
    }

    const primary = data.get("primaryBilling") === "on";
    if (primary) {
      const { error: clearError } = await supabase
        .from("guardian_families")
        .update({ is_primary_billing_contact: false })
        .eq("family_id", familyId);
      if (clearError) throw clearError;
    }

    const { error: linkError } = await supabase.from("guardian_families").upsert({
      guardian_id: guardianId,
      family_id: familyId,
      is_primary_billing_contact: primary
    }, { onConflict: "guardian_id,family_id" });
    if (linkError) throw linkError;

    if (primary) {
      const { error: familyError } = await supabase
        .from("families")
        .update({ primary_guardian_id: guardianId })
        .eq("id", familyId);
      if (familyError) throw familyError;
    }

    const familyStudents = state.students.filter(student => student.family_id === familyId);
    if (familyStudents.length) {
      const rows = familyStudents.map(student => ({
        student_id: student.id,
        guardian_id: guardianId,
        relationship_to_student: "Guardian",
        is_primary_contact: primary,
        is_emergency_contact: primary,
        authorised_to_collect: true
      }));
      const { error: studentLinkError } = await supabase
        .from("student_guardians")
        .upsert(rows, { onConflict: "student_id,guardian_id" });
      if (studentLinkError) throw studentLinkError;
    }

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));
    notifySuccess(duplicate ? "Existing guardian linked to the family." : "Guardian added and linked to all family students.");
    dispatchDataChanged({ module: "families" });
  } catch (error) {
    notifyError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

const FAMILY_DEPENDENCIES = [
  ["students", "Students"],
  ["charges", "Charges"],
  ["payments", "Payments"],
  ["invoices", "Invoices"],
  ["refunds", "Refunds"],
  ["financial_adjustments", "Financial adjustments"],
  ["charge_batch_items", "Charge batches"],
  ["communication_history", "Communication history"],
  ["follow_up_tasks", "Follow-up tasks"],
  ["student_discounts", "Family discounts"]
];

async function countActiveRows(table, familyId) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);

  // All dependency tables in this database use deleted_at.
  query = query.is("deleted_at", null);

  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function prepareFamilyDeletion(family) {
  const linkedStudents = state.students.filter(student => student.family_id === family.id);

  openDialog({
    title: `Checking ${family.family_name}`,
    eyebrow: "Families & Guardians",
    body: '<div class="loading-state">Checking linked students and financial history…</div>',
    footer: '<button class="button button-secondary" type="button" data-close-dialog>Cancel</button>'
  });
  document.querySelector("[data-close-dialog]")?.addEventListener("click", closeDialog);

  try {
    const dependencyCounts = await Promise.all(
      FAMILY_DEPENDENCIES.map(async ([table, label]) => ({
        table,
        label,
        count: table === "students"
          ? linkedStudents.length
          : await countActiveRows(table, family.id)
      }))
    );

    const blockers = dependencyCounts.filter(item => item.count > 0);
    if (blockers.length) {
      showDeletionBlocked(family, blockers);
      return;
    }

    showDeleteConfirmation(family);
  } catch (error) {
    const body = document.getElementById("dialogBody");
    if (body) {
      body.innerHTML = `
        <div class="inline-message error">
          The family could not be checked safely. No information was deleted.<br><br>
          ${escapeHtml(error.message || String(error))}
        </div>`;
    }
    notifyError(error);
  }
}

function showDeletionBlocked(family, blockers) {
  const details = blockers
    .map(item => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.count}</li>`)
    .join("");

  openDialog({
    title: `Cannot delete ${family.family_name}`,
    eyebrow: "Families & Guardians",
    body: `
      <div class="inline-message error">
        This family still has linked records. It has not been deleted.
      </div>
      <div class="section-card section-spacer">
        <h3>Linked records</h3>
        <ul>${details}</ul>
        <p class="muted">
          Reassign or archive linked students first. Financial and communication
          history must remain linked for accurate records.
        </p>
      </div>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Close</button>
      <button class="button button-primary" type="button" data-open-student-hub>Open Student Hub</button>`
  });

  document.querySelector("[data-close-dialog]")?.addEventListener("click", closeDialog);
  document.querySelector("[data-open-student-hub]")?.addEventListener("click", () => {
    closeDialog();
    openStudentHub();
  });
}

function showDeleteConfirmation(family) {
  const linkedGuardianIds = state.links
    .filter(link => link.family_id === family.id)
    .map(link => link.guardian_id);

  const linkedGuardians = state.guardians.filter(guardian =>
    linkedGuardianIds.includes(guardian.id)
  );

  openDialog({
    title: `Delete ${family.family_name}`,
    eyebrow: "Families & Guardians",
    body: `
      <div class="inline-message warning">
        This will remove the family from the active directory and move it to the
        recycle bin. It can be restored later from Audit History.
      </div>
      <div class="section-card section-spacer">
        <p><strong>Family:</strong> ${escapeHtml(family.family_name)}</p>
        <p><strong>Billing name:</strong> ${escapeHtml(family.billing_name || "—")}</p>
        <p><strong>Linked guardians:</strong> ${linkedGuardians.length}</p>
      </div>
      <label class="checkbox-row section-spacer">
        <input id="cleanupOrphanGuardians" type="checkbox" checked>
        <span>
          Also archive guardians who are not linked to another family or student
        </span>
      </label>
      <p class="muted">
        Shared guardians are preserved automatically. This action is available
        only when there are no linked students, charges, payments, invoices or
        other history.
      </p>`,
    footer: `
      <button class="button button-secondary" type="button" data-close-dialog>Cancel</button>
      <button id="confirmDeleteFamilyButton" class="button button-danger" type="button">
        Delete family
      </button>`
  });

  document.querySelector("[data-close-dialog]")?.addEventListener("click", closeDialog);
  document.getElementById("confirmDeleteFamilyButton")
    ?.addEventListener("click", event => deleteFamily(family, event.currentTarget));
}

async function deleteFamily(family, button) {
  setButtonBusy(button, true, "Deleting…");

  try {
    // Recheck immediately before deletion to avoid deleting a family that gained
    // a linked record while the confirmation window was open.
    const dependencyCounts = await Promise.all(
      FAMILY_DEPENDENCIES.map(async ([table, label]) => ({
        label,
        count: table === "students"
          ? state.students.filter(student => student.family_id === family.id).length
          : await countActiveRows(table, family.id)
      }))
    );

    const blockers = dependencyCounts.filter(item => item.count > 0);
    if (blockers.length) {
      showDeletionBlocked(family, blockers);
      return;
    }

    const supabase = getSupabaseClient();
    const linkedGuardianIds = state.links
      .filter(link => link.family_id === family.id)
      .map(link => link.guardian_id);

    const { error: familyError } = await supabase
      .from("families")
      .update({
        deleted_at: nowIso(),
        is_active: false,
        primary_guardian_id: null
      })
      .eq("id", family.id)
      .is("deleted_at", null);

    if (familyError) throw familyError;

    const { error: unlinkError } = await supabase
      .from("guardian_families")
      .delete()
      .eq("family_id", family.id);

    if (unlinkError) throw unlinkError;

    const cleanGuardians = document.getElementById("cleanupOrphanGuardians")?.checked;
    let archivedGuardians = 0;

    if (cleanGuardians) {
      for (const guardianId of linkedGuardianIds) {
        const [
          { count: otherFamilyLinks, error: familyLinkError },
          { count: studentLinks, error: studentLinkError }
        ] = await Promise.all([
          supabase
            .from("guardian_families")
            .select("id", { count: "exact", head: true })
            .eq("guardian_id", guardianId),
          supabase
            .from("student_guardians")
            .select("id", { count: "exact", head: true })
            .eq("guardian_id", guardianId)
        ]);

        if (familyLinkError) throw familyLinkError;
        if (studentLinkError) throw studentLinkError;

        if (Number(otherFamilyLinks || 0) === 0 && Number(studentLinks || 0) === 0) {
          const { error: guardianError } = await supabase
            .from("guardians")
            .update({
              deleted_at: nowIso(),
              is_active: false
            })
            .eq("id", guardianId)
            .is("deleted_at", null);

          if (guardianError) throw guardianError;
          archivedGuardians += 1;
        }
      }
    }

    closeDialog();
    await refresh();
    render(document.getElementById("moduleContent"));

    notifySuccess(
      archivedGuardians
        ? `Family deleted. ${archivedGuardians} unlinked guardian record${archivedGuardians === 1 ? "" : "s"} also archived.`
        : "Family deleted and moved to the recycle bin."
    );
    dispatchDataChanged({ module: "families" });
  } catch (error) {
    notifyError(error);
    const body = document.getElementById("dialogBody");
    if (body) {
      body.insertAdjacentHTML(
        "afterbegin",
        `<div class="inline-message error">
          The family was not fully deleted. ${escapeHtml(error.message || String(error))}
        </div>`
      );
    }
  } finally {
    setButtonBusy(button, false);
  }
}
