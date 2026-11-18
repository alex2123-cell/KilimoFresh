// One catalog listing (FR-03): crop, grade, price, minimum order, harvest date.
import { el, icon } from '../core/dom.js';
import { kes, shortDate } from '../core/format.js';
import { gradeBadge, statusBadge } from './ui.js';

const fact = (label, value) => el('div', {}, el('dt', {}, label), el('dd', {}, value));

export function produceCard(item) {
  const soldOut = item.status === 'sold-out';
  const category = item.category.toLowerCase();

  return el(
    'li',
    { class: `card produce${soldOut ? ' produce--soldout' : ''}`, dataset: { id: item.id } },
    el(
      'div',
      { class: `produce__art produce__art--${category}${item.image ? ' produce__art--photo' : ''}` },
      // A listing with "image": "tomatoes.webp" shows that photo from
      // frontend/assets/images; otherwise the category illustration is used.
      item.image
        ? el('img', { src: `assets/images/${encodeURIComponent(item.image)}`, alt: `${item.crop} (${item.variety})`, width: 400, height: 136, loading: 'lazy' })
        : el('img', { src: `assets/crops/${category}.svg`, alt: '', width: 96, height: 96, loading: 'lazy' }),
      el('span', { class: 'produce__code' }, item.id),
    ),
    el(
      'div',
      { class: 'produce__body' },
      el('div', { class: 'produce__badges' }, gradeBadge(item.grade), statusBadge(item.status)),
      el('h3', { class: 'produce__name' }, item.crop),
      el('p', { class: 'produce__variety' }, `${item.variety} · ${item.category}`),
      el(
        'p',
        { class: 'produce__price' },
        el('strong', {}, kes(item.price)),
        el('span', {}, ` per ${item.unit}`),
      ),
      el(
        'dl',
        { class: 'produce__facts' },
        fact('Min. order', `${item.moq} units`),
        fact('Harvest', shortDate(item.harvestDate)),
        fact('From', item.location),
        fact('In stock', soldOut ? '—' : `${item.stock} units`),
      ),
      el(
        'div',
        { class: 'produce__actions' },
        // The catalog page listens for clicks on [data-action] (event delegation).
        el(
          'button',
          { class: 'btn btn--ghost', type: 'button', dataset: { action: 'estimate' }, disabled: soldOut },
          icon('calculator'),
          'Estimate',
        ),
        soldOut
          ? el('span', { class: 'btn btn--disabled', 'aria-disabled': 'true' }, 'Sold out')
          : el('a', { class: 'btn btn--primary', href: `sourcing.html?item=${encodeURIComponent(item.id)}` }, 'Request'),
      ),
    ),
  );
}
