// Small reusable UI components: toast, modal, badges, alerts, loading states.
import { $, el, icon, render } from '../core/dom.js';
import { statusLabel } from '../core/format.js';

/** A short message that appears at the bottom of the screen and fades away. */
export function toast(message, kind = 'success') {
  let region = $('#toasts');
  if (!region) {
    // role="status" makes screen readers announce new messages politely.
    region = el('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const note = el('div', { class: `toast toast--${kind}` }, message);
  region.append(note);
  setTimeout(() => note.remove(), 5000);
}

/**
 * Modal built on the native <dialog> element, which traps keyboard focus,
 * closes with Escape and returns focus to the button that opened it.
 */
export function openModal({ title, body, actions = [] }) {
  const dialog = el(
    'dialog',
    { class: 'modal', 'aria-labelledby': 'modal-title' },
    el(
      'div',
      { class: 'modal__head' },
      el('h2', { id: 'modal-title' }, title),
      el('button', { class: 'modal__close', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close')),
    ),
    el('div', { class: 'modal__body' }, body),
    actions.length ? el('div', { class: 'modal__actions' }, actions) : null,
  );
  // Clicking the dark backdrop (the dialog itself, outside its content) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export const statusBadge = (status) =>
  el('span', { class: `badge badge--${status}` }, statusLabel[status] || status);

export const gradeBadge = (grade) => el('span', { class: `badge badge--grade${grade}` }, `Grade ${grade}`);

export function alertBox(kind, ...content) {
  return el('div', { class: `alert alert--${kind}`, role: kind === 'error' ? 'alert' : 'status' }, content);
}

export function loading(node, label = 'Loading…') {
  return render(node, el('p', { class: 'loading', role: 'status' }, label));
}

export function emptyState(title, detail, action) {
  return el('div', { class: 'empty' }, el('h3', {}, title), detail ? el('p', {}, detail) : null, action);
}

/** Put a submit button into a "busy" state; returns a function to undo it. */
export function busy(button, label = 'Sending…') {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  return () => {
    button.disabled = false;
    button.textContent = original;
  };
}
