// Bulk Sourcing (FR-06 to FR-09): requisition form with live validation,
// live cost summary, signed receipt, WhatsApp follow-up and order history.
import { mountLayout } from '../components/layout.js';
import { receiptCard } from '../components/receipt.js';
import { alertBox, busy, toast } from '../components/ui.js';
import { api } from '../core/api.js';
import { $, el, render } from '../core/dom.js';
import { estimate, kes, shortDate, today, whatsappOrderLink } from '../core/format.js';
import { clearHistory, readHistory, saveToHistory } from '../core/history.js';
import { formValues, liveValidation, rules } from '../core/validate.js';

mountLayout();

const form = $('#requisition-form');
const summary = $('#order-summary');
const result = $('#result');
const formAlert = $('#form-alert');
const historyList = $('#history');

const state = { items: [], zones: [] };
const findItem = (id) => state.items.find((item) => item.id === id);
const findZone = (id) => state.zones.find((zone) => zone.id === id);

// Quantity rule depends on the chosen listing, so it reads the other values.
const quantityRule = (value, values) => {
  const item = findItem(values.produceId);
  if (!Number.isInteger(value) || value <= 0) return 'Enter a whole number of units.';
  if (item && value < item.moq) return `Minimum order for ${item.crop} is ${item.moq} units.`;
  if (item && value > item.stock) return `Only ${item.stock} units are available.`;
  return '';
};

const validation = liveValidation(form, {
  organisation: [rules.length(3, 100, 'Enter the institution or business name.')],
  contactName: [rules.length(3, 80, 'Enter your full name.')],
  phone: [rules.phone],
  email: [rules.optionalEmail],
  produceId: [rules.required('Choose a listing.')],
  quantity: [quantityRule],
  zone: [rules.required('Choose a delivery zone.')],
  deliveryDate: [rules.notPast],
  notes: [rules.length(0, 500, 'Keep notes under 500 characters.')],
  consent: [rules.checked('Tick the box so we may store these contact details.')],
});

// ---- Live cost summary -------------------------------------------------------
function showSummary() {
  const values = formValues(form);
  const item = findItem(values.produceId);
  const zone = findZone(values.zone);

  if (!item) {
    render(summary, el('p', { class: 'muted' }, 'Choose a listing to see the estimated cost.'));
    return;
  }
  const cost = estimate(item, zone, Number(values.quantity));
  const line = (label, value, total) =>
    el('div', { class: `receipt__row${total ? ' receipt__row--total' : ''}` }, el('dt', {}, label), el('dd', {}, value));

  render(
    summary,
    el('p', { class: 'summary__item' }, el('strong', {}, item.crop), ` · Grade ${item.grade}`),
    el('p', { class: 'muted' }, `${item.id} · ${item.location} · harvest ${shortDate(item.harvestDate)}`),
    el(
      'dl',
      { class: 'receipt__rows' },
      line(`${cost.quantity} × ${kes(item.price)}`, kes(cost.subtotal)),
      line(zone ? `Delivery · ${zone.name}` : 'Delivery', zone ? kes(zone.fee) : 'choose a zone'),
      line('Estimated total', kes(cost.total), true),
    ),
    cost.quantity > 0 ? cost.warnings.map((warning) => alertBox('warning', warning)) : null,
    el(
      'a',
      {
        class: 'btn btn--whatsapp btn--block',
        target: '_blank',
        rel: 'noopener noreferrer',
        href: whatsappOrderLink({
          item,
          quantity: cost.quantity,
          zone,
          deliveryDate: values.deliveryDate,
          organisation: values.organisation,
          total: cost.total,
        }),
      },
      'Send this order on WhatsApp instead',
    ),
  );
}

// ---- Submit (4.0) --------------------------------------------------------------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  render(formAlert);
  if (!validation.validate()) return;

  const values = formValues(form);
  const done = busy($('button[type="submit"]', form), 'Sending requisition…');
  try {
    const response = await api.post('/requisitions', values);
    const item = findItem(values.produceId);
    const zone = findZone(values.zone);

    saveToHistory({
      ref: response.ref,
      produceId: item.id,
      crop: item.crop,
      quantity: values.quantity,
      zone: zone.id,
      total: response.receipt.total,
      date: response.receipt.issuedAt,
    });
    showReceipt(response, item, zone);
    showHistory();
    form.reset();
    validation.reset();
    showSummary();
    toast(`Requisition ${response.ref} received.`);
  } catch (error) {
    if (error.status === 422) {
      validation.setServerErrors(error.fields);
      render(formAlert, alertBox('error', error.message));
    } else {
      // Reliability: if the server cannot be reached, offer WhatsApp instead.
      render(
        formAlert,
        alertBox(
          'error',
          el('p', {}, error.message),
          el(
            'a',
            {
              class: 'btn btn--whatsapp',
              target: '_blank',
              rel: 'noopener noreferrer',
              href: whatsappOrderLink({
                item: findItem(values.produceId),
                quantity: values.quantity,
                zone: findZone(values.zone),
                deliveryDate: values.deliveryDate,
                organisation: values.organisation,
              }),
            },
            'Send the order on WhatsApp',
          ),
        ),
      );
    }
  } finally {
    done();
  }
});

function showReceipt(response, item, zone) {
  render(
    result,
    el('h2', {}, 'Requisition received'),
    el('p', {}, 'The cooperative desk will call you to confirm supply and delivery. Keep your reference number.'),
    receiptCard(response),
    el(
      'div',
      { class: 'btn-row' },
      el(
        'a',
        {
          class: 'btn btn--whatsapp',
          target: '_blank',
          rel: 'noopener noreferrer',
          href: whatsappOrderLink({
            item,
            zone,
            ref: response.ref,
            quantity: response.receipt.quantity,
            organisation: response.receipt.organisation,
            deliveryDate: response.receipt.deliveryDate,
            total: response.receipt.total,
          }),
        },
        'Follow up on WhatsApp',
      ),
      el('a', { class: 'btn btn--ghost', href: `trust.html?ref=${encodeURIComponent(response.ref)}` }, 'Verify this receipt'),
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => window.print() }, 'Print'),
    ),
  );
  result.hidden = false;
  result.focus();
}

// ---- History & re-order (FR-09) ---------------------------------------------
function prefill({ produceId, quantity, zone }) {
  if (produceId && findItem(produceId)) form.elements.produceId.value = produceId;
  if (quantity) form.elements.quantity.value = quantity;
  if (zone && findZone(zone)) form.elements.zone.value = zone;
  showSummary();
}

function showHistory() {
  const rows = readHistory();
  $('#history-section').hidden = rows.length === 0;
  render(
    historyList,
    rows.map((row) =>
      el(
        'li',
        { class: 'history__row' },
        el('div', {}, el('strong', {}, `${row.quantity} × ${row.crop}`), el('small', {}, `${row.ref} · ${shortDate(row.date)} · ${kes(row.total)}`)),
        el(
          'div',
          { class: 'btn-row' },
          el('a', { class: 'btn btn--ghost btn--small', href: `trust.html?ref=${encodeURIComponent(row.ref)}` }, 'Receipt'),
          el(
            'button',
            {
              class: 'btn btn--primary btn--small',
              type: 'button',
              onclick() {
                prefill(row);
                form.scrollIntoView({ behavior: 'smooth' });
                form.elements.organisation.focus({ preventScroll: true });
              },
            },
            'Re-order',
          ),
        ),
      ),
    ),
  );
}

$('#clear-history').addEventListener('click', () => {
  clearHistory();
  showHistory();
});

// ---- Start ---------------------------------------------------------------------
async function start() {
  try {
    [state.items, state.zones] = await Promise.all([api.produce(), api.zones()]);
  } catch (error) {
    render(formAlert, alertBox('error', error.message));
    return;
  }

  // Group the listings by category inside the <select>.
  const categories = [...new Set(state.items.map((item) => item.category))].sort();
  form.elements.produceId.append(
    ...categories.map((category) =>
      el(
        'optgroup',
        { label: category },
        state.items
          .filter((item) => item.category === category)
          .map((item) =>
            el(
              'option',
              { value: item.id, disabled: item.status === 'sold-out' },
              `${item.crop} G${item.grade}, ${item.location} — ${kes(item.price)} / ${item.unit}${item.status === 'sold-out' ? ' (sold out)' : ''}`,
            ),
          ),
      ),
    ),
  );
  form.elements.zone.append(...state.zones.map((z) => el('option', { value: z.id }, `${z.name} — ${kes(z.fee)}`)));
  form.elements.deliveryDate.min = today();

  // Arriving from the catalog: sourcing.html?item=TOM-G1-ATH&qty=10&zone=nairobi
  const params = new URLSearchParams(location.search);
  prefill({ produceId: params.get('item'), quantity: params.get('qty'), zone: params.get('zone') });

  form.addEventListener('input', showSummary);
  form.addEventListener('change', showSummary);
  showHistory();
}

start();
