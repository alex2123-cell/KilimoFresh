// Cooperative admin: sign in, read the orders inbox, manage the catalog (1.0).
import { mountLayout } from '../components/layout.js';
import { alertBox, busy, emptyState, gradeBadge, openModal, statusBadge, toast } from '../components/ui.js';
import { api } from '../core/api.js';
import { $, $$, delegate, el, render } from '../core/dom.js';
import { dateTime, kes, shortDate } from '../core/format.js';
import { formValues, showError } from '../core/validate.js';

mountLayout();

const loginView = $('#login-view');
const dashboard = $('#dashboard');
const panel = $('#panel');
let activeTab = 'orders';

// ---- Sign in / out ---------------------------------------------------------------
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const done = busy($('button', form), 'Signing in…');
  try {
    const { user } = await api.post('/auth/login', formValues(form));
    form.reset();
    showDashboard(user);
  } catch (error) {
    render($('#login-alert'), alertBox('error', error.message));
  } finally {
    done();
  }
});

$('#logout').addEventListener('click', async () => {
  await api.post('/auth/logout');
  dashboard.hidden = true;
  loginView.hidden = false;
});

function showDashboard(user) {
  loginView.hidden = true;
  dashboard.hidden = false;
  $('#who').textContent = user.email;
  showSummary();
  showTab(activeTab);
}

async function showSummary() {
  const s = await api.get('/admin/summary');
  const tile = (label, value) => el('div', { class: 'stat' }, el('strong', {}, value), el('span', {}, label));
  render(
    $('#summary'),
    tile('New orders', s.newOrders),
    tile('All orders', s.orders),
    tile('Order value', kes(s.orderValue)),
    tile('Grower applications', s.growers),
    tile('Messages', s.messages),
    tile('Listings', s.listings),
  );
}

// ---- Tabs --------------------------------------------------------------------------
const TABS = { orders: showOrders, growers: showGrowers, messages: showMessages, catalog: showCatalog };

delegate($('#tabs'), 'click', '[role="tab"]', (event, tab) => showTab(tab.dataset.tab));

async function showTab(name) {
  activeTab = name;
  for (const tab of $$('[role="tab"]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  render(panel, el('p', { class: 'loading' }, 'Loading…'));
  try {
    await TABS[name]();
  } catch (error) {
    if (error.status === 401) {
      dashboard.hidden = true;
      loginView.hidden = false;
      return;
    }
    render(panel, alertBox('error', error.message));
  }
}

/** Build an accessible data table from column definitions. */
function table(caption, columns, rows) {
  return el(
    'div',
    { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': caption },
    el(
      'table',
      { class: 'table' },
      el('caption', { class: 'sr-only' }, caption),
      el('thead', {}, el('tr', {}, columns.map((c) => el('th', { scope: 'col' }, c.title)))),
      el('tbody', {}, rows.map((row) => el('tr', {}, columns.map((c) => el('td', { dataset: { label: c.title } }, c.cell(row)))))),
    ),
  );
}

const contact = (row) => [
  el('strong', {}, row.contactName || row.name),
  el('br'),
  row.phone ? el('a', { href: `tel:${row.phone}` }, row.phone) : null,
  row.email ? el('small', {}, ` ${row.email}`) : null,
];

async function showOrders() {
  const { items } = await api.get('/admin/requisitions');
  if (!items.length) return render(panel, emptyState('No requisitions yet', 'New orders from the Bulk Sourcing page appear here.'));

  const statusSelect = (order) =>
    el(
      'select',
      {
        'aria-label': `Status of ${order.ref}`,
        async onchange(event) {
          await api.patch(`/admin/requisitions/${order.ref}`, { status: event.target.value });
          toast(`${order.ref} marked ${event.target.value}.`);
          showSummary();
        },
      },
      ['new', 'confirmed', 'delivered', 'cancelled'].map((s) => el('option', { value: s, selected: s === order.status }, s)),
    );

  render(
    panel,
    table('Requisitions', [
      { title: 'Reference', cell: (o) => [el('a', { href: `trust.html?ref=${o.ref}` }, o.ref), el('br'), el('small', {}, dateTime(o.createdAt))] },
      { title: 'Institution', cell: (o) => [o.organisation, el('br'), el('small', {}, o.notes)] },
      { title: 'Contact', cell: contact },
      { title: 'Order', cell: (o) => `${o.quantity} × ${o.receipt.crop} G${o.receipt.grade} (${o.produceId})` },
      { title: 'Deliver', cell: (o) => [o.receipt.zone, el('br'), el('small', {}, shortDate(o.deliveryDate))] },
      { title: 'Total', cell: (o) => kes(o.receipt.total) },
      { title: 'Status', cell: statusSelect },
    ], items),
  );
}

async function showGrowers() {
  const { items } = await api.get('/admin/growers');
  if (!items.length) return render(panel, emptyState('No grower applications yet'));
  render(
    panel,
    table('Grower applications', [
      { title: 'Reference', cell: (g) => [g.ref, el('br'), el('small', {}, dateTime(g.createdAt))] },
      { title: 'Grower', cell: contact },
      { title: 'Location', cell: (g) => g.location },
      { title: 'Farm size', cell: (g) => `${g.farmSize} acres` },
      { title: 'Crops', cell: (g) => g.crops.join(', ') },
      { title: 'Cooperative', cell: (g) => g.cooperative || '—' },
    ], items),
  );
}

async function showMessages() {
  const { items } = await api.get('/admin/messages');
  if (!items.length) return render(panel, emptyState('No messages yet'));
  render(
    panel,
    table('Contact messages', [
      { title: 'Received', cell: (m) => [m.ref, el('br'), el('small', {}, dateTime(m.createdAt))] },
      { title: 'From', cell: contact },
      { title: 'Subject', cell: (m) => el('strong', {}, m.subject) },
      { title: 'Message', cell: (m) => m.message },
    ], items),
  );
}

// ---- Catalog management --------------------------------------------------------------
const FIELDS = [
  ['id', 'Listing code', { placeholder: 'TOM-G1-ATH' }],
  ['crop', 'Crop'],
  ['variety', 'Variety'],
  ['category', 'Category', { options: ['Vegetables', 'Fruits', 'Cereals', 'Legumes', 'Tubers', 'Herbs'] }],
  ['grade', 'Grade', { options: ['1', '2', '3'] }],
  ['unit', 'Selling unit', { placeholder: '64 kg crate' }],
  ['price', 'Price per unit (KES)', { type: 'number', min: 1 }],
  ['moq', 'Minimum order (units)', { type: 'number', min: 1 }],
  ['stock', 'Stock (units)', { type: 'number', min: 0 }],
  ['location', 'Location'],
  ['cooperative', 'Cooperative'],
  ['harvestDate', 'Harvest date', { type: 'date' }],
  ['status', 'Status', { options: ['available', 'limited', 'sold-out'] }],
  ['image', 'Photo file (optional)', { placeholder: 'tomatoes.webp' }],
];

function listingForm(item) {
  const editing = Boolean(item);
  const fields = FIELDS.map(([name, label, opts = {}]) => {
    const id = `listing-${name}`;
    const value = item ? String(item[name] ?? '') : '';
    const control = opts.options
      ? el('select', { id, name }, opts.options.map((o) => el('option', { value: o, selected: o === value }, o)))
      : el('input', { id, name, type: opts.type || 'text', min: opts.min, placeholder: opts.placeholder, value, readonly: editing && name === 'id' });
    return el('div', { class: 'field' }, el('label', { for: id }, label), control, el('p', { class: 'field__error', dataset: { errorFor: name } }));
  });

  const alert = el('div');
  const form = el('form', { novalidate: true }, el('div', { class: 'form-grid' }, fields), alert,
    el('div', { class: 'modal__actions' }, el('button', { class: 'btn btn--primary', type: 'submit' }, editing ? 'Save changes' : 'Publish listing')));

  const dialog = openModal({ title: editing ? `Edit ${item.id}` : 'New listing', body: form });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    FIELDS.forEach(([name]) => showError(form, name, ''));
    const values = formValues(form);
    try {
      if (editing) await api.put(`/admin/produce/${item.id}`, values);
      else await api.post('/admin/produce', values);
      dialog.close();
      toast(editing ? 'Listing updated.' : 'Listing published.');
      showSummary();
      showCatalog();
    } catch (error) {
      for (const [name, message] of Object.entries(error.fields || {})) showError(form, name, message);
      render(alert, alertBox('error', error.message));
    }
  });
}

async function showCatalog() {
  const items = await api.produce();
  render(
    panel,
    el('div', { class: 'panel__bar' }, el('button', { class: 'btn btn--primary', type: 'button', onclick: () => listingForm(null) }, 'Add listing')),
    table('Catalog listings', [
      { title: 'Code', cell: (i) => el('span', { class: 'mono' }, i.id) },
      { title: 'Crop', cell: (i) => [el('strong', {}, i.crop), el('br'), el('small', {}, i.variety)] },
      { title: 'Grade', cell: (i) => gradeBadge(i.grade) },
      { title: 'Price', cell: (i) => [kes(i.price), el('br'), el('small', {}, i.unit)] },
      { title: 'MOQ / stock', cell: (i) => `${i.moq} / ${i.stock}` },
      { title: 'Location', cell: (i) => i.location },
      { title: 'Harvest', cell: (i) => shortDate(i.harvestDate) },
      { title: 'Status', cell: (i) => statusBadge(i.status) },
      {
        title: 'Actions',
        cell: (i) =>
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => listingForm(i) }, 'Edit'),
            el('button', { class: 'btn btn--danger btn--small', type: 'button', onclick: () => confirmDelete(i) }, 'Delete')),
      },
    ], items),
  );
}

function confirmDelete(item) {
  const dialog = openModal({
    title: `Delete ${item.id}?`,
    body: el('p', {}, `${item.crop} (${item.location}) will be removed from the public catalog. Past requisitions keep their receipts.`),
    actions: [
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => dialog.close() }, 'Keep listing'),
      el('button', {
        class: 'btn btn--danger',
        type: 'button',
        async onclick() {
          await api.delete(`/admin/produce/${item.id}`);
          dialog.close();
          toast(`${item.id} deleted.`);
          showSummary();
          showCatalog();
        },
      }, 'Delete listing'),
    ],
  });
}

// ---- Start: already signed in? --------------------------------------------------------
api.get('/auth/me').then(({ user }) => {
  if (user) showDashboard(user);
  else loginView.hidden = false;
});
