// Harvest Catalog (FR-03, FR-04, FR-05): cards, instant search and filters,
// and the cost-estimate modal.
import { mountLayout } from '../components/layout.js';
import { produceCard } from '../components/produceCard.js';
import { alertBox, emptyState, loading, openModal } from '../components/ui.js';
import { api } from '../core/api.js';
import { $, debounce, delegate, el, render } from '../core/dom.js';
import { estimate, kes, whatsappOrderLink } from '../core/format.js';

mountLayout();

const form = $('#filters');
const grid = $('#catalog-grid');
const count = $('#result-count');
const priceOutput = $('#price-output');

const state = { items: [], zones: [] };

// ---- 2.0 Search & filter ----------------------------------------------------
function readFilters() {
  const data = new FormData(form);
  return {
    q: String(data.get('q') || '').trim().toLowerCase(),
    category: data.get('category'),
    location: data.get('location'),
    maxPrice: Number(data.get('maxPrice')),
    inStock: data.get('inStock') === 'on',
  };
}

function matches(item, f) {
  return (
    (!f.q || `${item.crop} ${item.variety} ${item.id} ${item.location}`.toLowerCase().includes(f.q)) &&
    (!f.category || item.category === f.category) &&
    (!f.location || item.location === f.location) &&
    item.price <= f.maxPrice &&
    (!f.inStock || item.status !== 'sold-out')
  );
}

function showResults() {
  const filters = readFilters();
  const found = state.items.filter((item) => matches(item, filters));

  priceOutput.textContent = kes(filters.maxPrice);
  count.textContent = `${found.length} of ${state.items.length} listings`;

  if (!found.length) {
    render(
      grid,
      el('li', { class: 'catalog__empty' },
        emptyState(
          'No listings match those filters',
          'Try a higher maximum price, another location, or clear the filters.',
          el('button', { class: 'btn btn--primary', type: 'button', onclick: resetFilters }, 'Clear filters'),
        ),
      ),
    );
    return;
  }
  // A DocumentFragment lets us add all cards to the page in one step.
  const fragment = document.createDocumentFragment();
  fragment.append(...found.map(produceCard));
  grid.replaceChildren(fragment);
}

function resetFilters() {
  form.reset();
  form.elements.maxPrice.value = form.elements.maxPrice.max;
  showResults();
}

function fillSelect(select, values) {
  select.append(...values.map((value) => el('option', { value }, value)));
}

// ---- 3.0 Cost estimate modal -------------------------------------------------
function openEstimate(item) {
  const qty = el('input', { id: 'est-qty', type: 'number', min: 1, step: 1, value: item.moq, inputmode: 'numeric' });
  const zone = el('select', { id: 'est-zone' }, state.zones.map((z) => el('option', { value: z.id }, `${z.name} — ${kes(z.fee)}`)));
  const breakdown = el('div', { 'aria-live': 'polite' });
  const request = el('a', { class: 'btn btn--primary' }, 'Request this order');
  const whatsapp = el('a', { class: 'btn btn--whatsapp', target: '_blank', rel: 'noopener noreferrer' }, 'Order on WhatsApp');

  const update = () => {
    const chosenZone = state.zones.find((z) => z.id === zone.value);
    const cost = estimate(item, chosenZone, Number(qty.value));
    const line = (label, value, total) =>
      el('div', { class: `receipt__row${total ? ' receipt__row--total' : ''}` }, el('dt', {}, label), el('dd', {}, value));

    render(
      breakdown,
      el(
        'dl',
        { class: 'receipt__rows' },
        line(`${cost.quantity} × ${kes(item.price)}`, kes(cost.subtotal)),
        line(`Delivery (${chosenZone.days} day${chosenZone.days > 1 ? 's' : ''})`, kes(cost.deliveryFee)),
        line('Estimated total', kes(cost.total), true),
      ),
      cost.warnings.map((warning) => alertBox('warning', warning)),
    );
    request.href = `sourcing.html?item=${encodeURIComponent(item.id)}&qty=${cost.quantity}&zone=${chosenZone.id}`;
    whatsapp.href = whatsappOrderLink({ item, quantity: cost.quantity, zone: chosenZone, total: cost.total });
  };

  qty.addEventListener('input', update);
  zone.addEventListener('change', update);
  update();

  openModal({
    title: `Estimate: ${item.crop}`,
    body: [
      el('p', { class: 'modal__lead' }, `${kes(item.price)} per ${item.unit} · minimum ${item.moq} units · ${item.location}`),
      el(
        'div',
        { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'est-qty' }, 'Quantity (units)'), qty),
        el('div', { class: 'field' }, el('label', { for: 'est-zone' }, 'Deliver to'), zone),
      ),
      breakdown,
    ],
    actions: [whatsapp, request],
  });
  qty.select();
}

// ---- Start -------------------------------------------------------------------
async function start() {
  loading(grid, 'Loading this week’s harvest…');
  try {
    [state.items, state.zones] = await Promise.all([api.produce(), api.zones()]);
  } catch (error) {
    render(grid, el('li', { class: 'catalog__empty' }, alertBox('error', error.message)));
    return;
  }

  fillSelect(form.elements.category, [...new Set(state.items.map((i) => i.category))].sort());
  fillSelect(form.elements.location, [...new Set(state.items.map((i) => i.location))].sort());

  // Price slider goes up to the dearest listing, rounded up to the next 500.
  const top = Math.ceil(Math.max(...state.items.map((i) => i.price)) / 500) * 500;
  form.elements.maxPrice.max = top;
  form.elements.maxPrice.value = top;

  // Filters can arrive in the address, e.g. catalog.html?category=Vegetables&maxPrice=3000
  const params = new URLSearchParams(location.search);
  for (const name of ['q', 'category', 'location', 'maxPrice']) {
    if (params.has(name)) form.elements[name].value = params.get(name);
  }

  form.addEventListener('input', debounce(showResults, 120));
  form.addEventListener('submit', (event) => event.preventDefault());
  $('#clear-filters').addEventListener('click', resetFilters);

  // One click listener on the grid serves every card's Estimate button.
  delegate(grid, 'click', '[data-action="estimate"]', (event, button) => {
    const id = button.closest('[data-id]').dataset.id;
    openEstimate(state.items.find((item) => item.id === id));
  });

  showResults();
}

start();
