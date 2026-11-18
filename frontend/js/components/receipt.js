// A requisition receipt with its digital-signature check.
import { el, icon, render } from '../core/dom.js';
import { dateTime, kes, shortDate } from '../core/format.js';
import { verifyReceipt } from '../core/pki.js';

const row = (label, value) => el('div', { class: 'receipt__row' }, el('dt', {}, label), el('dd', {}, value));

/** The coloured "signature verified / not verified" line. */
export function signatureBadge(canonical, signature) {
  const badge = el('p', { class: 'sig sig--checking', role: 'status' }, 'Checking digital signature…');

  verifyReceipt(canonical, signature)
    .then(({ valid, fingerprint }) => {
      badge.className = `sig sig--${valid ? 'ok' : 'bad'}`;
      render(
        badge,
        icon(valid ? 'shield' : 'warning'),
        el(
          'span',
          {},
          valid
            ? 'Signature verified - issued by KilimoFresh and not altered.'
            : 'Signature does NOT match - this receipt was altered or was not issued by KilimoFresh.',
          valid ? el('small', {}, `Signing certificate SHA-256: ${fingerprint.slice(0, 29)}…`) : null,
        ),
      );
    })
    .catch((error) => {
      badge.className = 'sig sig--bad';
      badge.textContent = error.message;
    });

  return badge;
}

export function receiptCard({ receipt, canonical, signature }) {
  return el(
    'article',
    { class: 'receipt', 'aria-label': `Receipt ${receipt.ref}` },
    el(
      'header',
      { class: 'receipt__head' },
      el('p', { class: 'eyebrow' }, 'Requisition reference'),
      el('p', { class: 'receipt__ref' }, receipt.ref),
      el('p', { class: 'receipt__issued' }, `Issued ${dateTime(receipt.issuedAt)} by ${receipt.issuer}`),
    ),
    el(
      'dl',
      { class: 'receipt__rows' },
      row('Institution', receipt.organisation),
      row('Produce', `${receipt.crop} · Grade ${receipt.grade} (${receipt.produceId})`),
      row('Quantity', `${receipt.quantity} × ${receipt.unit}`),
      row('Unit price', kes(receipt.unitPrice)),
      row('Subtotal', kes(receipt.subtotal)),
      row(`Delivery · ${receipt.zone}`, kes(receipt.deliveryFee)),
      row('Delivery date', shortDate(receipt.deliveryDate)),
      el('div', { class: 'receipt__row receipt__row--total' }, el('dt', {}, 'Estimated total'), el('dd', {}, kes(receipt.total))),
    ),
    signatureBadge(canonical, signature),
  );
}
