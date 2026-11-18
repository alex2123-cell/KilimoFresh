// Shared header and footer, built once here and mounted on every page.
import { config } from '../config.js';
import { $, el, icon } from '../core/dom.js';

const NAV = [
  ['index.html', 'Home'],
  ['about.html', 'About Us'],
  ['catalog.html', 'Harvest Catalog'],
  ['sourcing.html', 'Bulk Sourcing'],
  ['grower.html', 'Partner as Grower'],
  ['contact.html', 'Contact'],
];

function currentPage() {
  const file = location.pathname.split('/').pop() || 'index.html';
  return file.includes('.') ? file : `${file}.html`;
}

function logo() {
  return el(
    'a',
    { class: 'logo', href: 'index.html', 'aria-label': `${config.name} home` },
    el('img', { src: 'assets/logo.svg', alt: '', width: 36, height: 36 }),
    el('span', {}, 'Kilimo', el('strong', {}, 'Fresh')),
  );
}

function header() {
  const page = currentPage();
  const links = NAV.map(([href, label]) =>
    el('li', {}, el('a', { href, 'aria-current': href === page ? 'page' : null }, label)),
  );
  const list = el('ul', { id: 'site-menu', class: 'nav__list' }, links);

  const toggle = el(
    'button',
    {
      class: 'nav__toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'site-menu',
      onclick() {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        list.classList.toggle('is-open', open);
      },
    },
    icon('menu'),
    el('span', {}, 'Menu'),
  );

  // Close the mobile menu with the Escape key.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && list.classList.contains('is-open')) toggle.click();
  });

  return el('div', { class: 'container header__inner' }, logo(), el('nav', { class: 'nav', 'aria-label': 'Main' }, toggle, list));
}

function footer() {
  const social = [
    ['facebook', 'Facebook', config.social.facebook],
    ['youtube', 'YouTube', config.social.youtube],
    ['instagram', 'Instagram', config.social.instagram],
    ['whatsapp', 'WhatsApp', `https://wa.me/${config.whatsappNumber}`],
  ].map(([name, label, href]) =>
    el('li', {}, el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'social' }, icon(name), el('span', {}, label))),
  );

  const column = (title, ...items) =>
    el('div', {}, el('h2', { class: 'footer__title' }, title), el('ul', { class: 'footer__list' }, items));
  const link = (href, label) => el('li', {}, el('a', { href }, label));

  return el(
    'div',
    { class: 'container' },
    el(
      'div',
      { class: 'footer__grid' },
      el(
        'div',
        {},
        logo(),
        el('p', { class: 'footer__about' }, 'Machakos produce sourcing hub connecting peri-urban farmers with institutional buyers.'),
        el('p', { class: 'footer__tag' }, config.tagline),
      ),
      column('Buyers', link('catalog.html', 'Harvest Catalog'), link('sourcing.html', 'Bulk Sourcing'), link('trust.html', 'Verify a receipt')),
      column('Growers', link('grower.html', 'Partner as Grower'), link('about.html', 'How grading works'), link('contact.html', 'Contact the desk')),
      column('Follow us', social),
    ),
    el(
      'div',
      { class: 'footer__base' },
      el('p', {}, `© ${new Date().getFullYear()} ${config.name} Cooperative Network · ACS 355 project, Daystar University`),
      el('p', {}, el('a', { href: 'trust.html' }, 'Trust & Security'), ' · ', el('a', { href: 'admin.html' }, 'Admin')),
    ),
  );
}

export function mountLayout() {
  $('#site-header')?.replaceChildren(header());
  $('#site-footer')?.replaceChildren(footer());
}
