import { readableError, showToast } from "./utilities.js?v=1.1.0";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderLoading(container, message = "Loading…") {
  container.innerHTML = `<div class="loading-state">${escapeHtml(message)}</div>`;
}

export function renderError(container, error) {
  container.innerHTML = `<div class="inline-message error">${escapeHtml(readableError(error))}</div>`;
}

export function statusBadge(value) {
  const text = String(value ?? "unknown").replaceAll("_", " ");
  let tone = "muted";
  if (["active", "open", "paid", "confirmed", "completed", "present", "issued"].includes(value)) tone = "success";
  if (["trial", "planned", "partially_paid", "pending_confirmation", "late"].includes(value)) tone = "warning";
  if (["overdue", "cancelled", "reversed", "left", "inactive", "absent"].includes(value)) tone = "danger";
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

export function setButtonBusy(button, busy, busyText = "Saving…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

export function openDialog({ title, eyebrow = "Dojo Manager", body = "", footer = "" }) {
  const dialog = document.getElementById("appDialog");
  const message = document.getElementById("dialogMessage");
  document.getElementById("dialogTitle").textContent = title;
  document.getElementById("dialogEyebrow").textContent = eyebrow;
  document.getElementById("dialogBody").innerHTML = body;
  document.getElementById("dialogFooter").innerHTML = footer;
  if (message) {
    message.hidden = true;
    message.textContent = "";
    message.className = "dialog-message";
  }
  if (!dialog.open) dialog.showModal();
  return dialog;
}

export function closeDialog() {
  const dialog = document.getElementById("appDialog");
  if (dialog?.open) dialog.close();
}

export function initialiseDialog() {
  const dialog = document.getElementById("appDialog");
  document.getElementById("dialogCloseButton")?.addEventListener("click", closeDialog);

  // Deliberately do not close when the backdrop is clicked. This protects
  // partially completed forms from accidental clicks outside the dialog.
  dialog?.addEventListener("click", event => {
    if (event.target === dialog) event.stopPropagation();
  });
}

export async function confirmAction(message) {
  return window.confirm(message);
}

export function notifySuccess(message) {
  showToast(message, "success");
}

export function notifyError(error) {
  const messageText = readableError(error);
  const dialog = document.getElementById("appDialog");
  const message = document.getElementById("dialogMessage");

  if (dialog?.open && message) {
    message.textContent = messageText;
    message.className = "dialog-message error";
    message.hidden = false;
    message.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  showToast(messageText, "error", 7000);
}

export function moduleHeader({ eyebrow, title, description, actions = "" }) {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">${escapeHtml(description)}</p>
      </div>
      <div class="module-actions">${actions}</div>
    </div>
  `;
}

export function emptyState(title, message) {
  return `
    <article class="empty-state">
      <div class="empty-icon">JKA</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}
