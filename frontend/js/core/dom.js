// Document Object Model helpers.
// Every page builds its content by creating real DOM nodes (never by pasting
// HTML strings), so text typed by a user can never run as code.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Create an element.
 *   el('a', { class: 'btn', href: '/catalog.html', onclick: fn }, 'Open catalog')
 * - "class", "dataset" and "on..." keys are handled specially
 * - true/false values add or leave out boolean attributes (hidden, required...)
 * - children may be nodes, strings, numbers, arrays, or null (skipped)
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** Remove everything inside a node, then (optionally) add new children. */
export function render(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter(Boolean));
  return node;
}

/** Event delegation: one listener on a parent handles all matching children. */
export function delegate(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** Wait until the user stops typing before running fn. */
export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** A small inline SVG icon from assets/icons.svg. */
export function icon(name, label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  use.setAttribute('href', `assets/icons.svg#${name}`);
  svg.append(use);
  return svg;
}
