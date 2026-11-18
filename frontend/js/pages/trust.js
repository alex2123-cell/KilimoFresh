// Trust & Security page: shows the certificate chain and lets anyone verify
// a receipt's digital signature in their own browser.
import { mountLayout } from '../components/layout.js';
import { receiptCard, signatureBadge } from '../components/receipt.js';
import { alertBox, busy } from '../components/ui.js';
import { api } from '../core/api.js';
import { $, el, icon, render } from '../core/dom.js';
import { shortDate } from '../core/format.js';
import { loadPki } from '../core/pki.js';

mountLayout();

// ---- Connection + certificate chain -----------------------------------------
function showConnection() {
  const secure = location.protocol === 'https:';
  render(
    $('#connection'),
    alertBox(
      secure ? 'success' : 'warning',
      icon(secure ? 'lock' : 'warning'),
      secure
        ? ` This page was delivered over HTTPS (TLS) from ${location.host}. Data you send is encrypted in transit.`
        : ' This page was loaded over plain HTTP. Open the https:// address so data is encrypted in transit.',
    ),
  );
}

function certificateCard(cert, index) {
  const ok = cert.signedByIssuer && cert.inValidityPeriod;
  const row = (label, value, mono) => el('div', {}, el('dt', {}, label), el('dd', { class: mono ? 'mono' : null }, value));
  return el(
    'li',
    { class: 'cert' },
    el(
      'div',
      { class: 'cert__head' },
      el('span', { class: 'cert__step' }, String(index + 1)),
      el('h3', {}, cert.role),
      el('span', { class: `badge badge--${ok ? 'available' : 'sold-out'}` }, ok ? 'Valid' : 'Problem'),
    ),
    el(
      'dl',
      { class: 'cert__rows' },
      row('Issued to', cert.subject),
      row('Issued by', cert.isCA ? `${cert.issuer} (self-signed)` : cert.issuer),
      row('Valid', `${shortDate(cert.validFrom)} – ${shortDate(cert.validTo)}`),
      row('Key / signature', `${cert.keyAlgorithm} · ${cert.signatureAlgorithm}`),
      cert.subjectAltName ? row('Valid for hosts', cert.subjectAltName) : null,
      row('Serial number', cert.serialNumber, true),
      row('SHA-256 fingerprint', cert.fingerprint256, true),
    ),
  );
}

async function showChain() {
  const holder = $('#chain');
  try {
    const pki = await loadPki();
    render(holder, pki.chain.map(certificateCard));
    render(
      $('#chain-status'),
      alertBox(
        pki.chainValid ? 'success' : 'error',
        pki.chainValid
          ? 'Chain check passed: the server and signing certificates were both signed by the KilimoFresh Root CA and are inside their validity period.'
          : 'Chain check failed: a certificate is expired or was not signed by the Root CA.',
      ),
    );
    $('#public-key').textContent = pki.signing.publicKeyPem.trim();
  } catch (error) {
    render(holder, el('li', {}, alertBox('error', error.message)));
  }
}

// ---- Verify a receipt -----------------------------------------------------------
const lookup = $('#verify-form');
const output = $('#verify-output');
const tamper = $('#tamper');

async function verify(ref) {
  render(output);
  tamper.hidden = true;
  const done = busy($('button', lookup), 'Checking…');
  try {
    const data = await api.get(`/requisitions/${encodeURIComponent(ref.trim().toUpperCase())}/receipt`);
    render(output, receiptCard(data));

    // Tamper test: edit the signed text and watch the signature fail.
    const text = $('#tamper-text');
    const check = $('#tamper-result');
    text.value = data.canonical;
    const recheck = () => render(check, signatureBadge(text.value, data.signature));
    text.oninput = recheck;
    $('#tamper-reset').onclick = () => {
      text.value = data.canonical;
      recheck();
    };
    recheck();
    tamper.hidden = false;
  } catch (error) {
    render(output, alertBox('error', error.message));
  } finally {
    done();
  }
}

lookup.addEventListener('submit', (event) => {
  event.preventDefault();
  const ref = lookup.elements.ref.value;
  if (ref.trim()) verify(ref);
});

showConnection();
showChain();

// Arriving from a receipt: trust.html?ref=KF-20261116-ABCDE
const ref = new URLSearchParams(location.search).get('ref');
if (ref) {
  lookup.elements.ref.value = ref;
  verify(ref);
}
