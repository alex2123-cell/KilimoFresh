// Home page (FR-01): platform figures, this week's harvest board, social embeds.
import { mountLayout } from '../components/layout.js';
import { facebookEmbed, youtubeEmbed } from '../components/socialEmbed.js';
import { gradeBadge } from '../components/ui.js';
import { api } from '../core/api.js';
import { $, $$, el, render } from '../core/dom.js';
import { kes, shortDate } from '../core/format.js';

mountLayout();

async function showFigures() {
  try {
    const stats = await api.get('/stats');
    for (const node of $$('[data-stat]')) node.textContent = stats[node.dataset.stat] ?? '—';
  } catch {
    /* the figures are decoration; the page still works without them */
  }
}

async function showHarvestBoard() {
  const board = $('#harvest-board');
  try {
    const items = (await api.produce())
      .filter((item) => item.status !== 'sold-out')
      .sort((a, b) => b.harvestDate.localeCompare(a.harvestDate))
      .slice(0, 5);

    render(
      board,
      items.map((item) =>
        el(
          'li',
          {},
          el(
            'a',
            { class: 'board__row', href: `catalog.html?q=${encodeURIComponent(item.id)}` },
            el('span', { class: 'board__crop' }, el('strong', {}, item.crop), el('small', {}, `${item.location} · ${shortDate(item.harvestDate)}`)),
            gradeBadge(item.grade),
            el('span', { class: 'board__price' }, kes(item.price), el('small', {}, item.unit)),
          ),
        ),
      ),
    );
  } catch (error) {
    render(board, el('li', { class: 'board__error' }, error.message));
  }
}

render($('#embeds'), youtubeEmbed(), facebookEmbed());
showFigures();
showHarvestBoard();
