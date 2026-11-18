// FR-11: YouTube and Facebook embeds.
// Each embed starts as a light placeholder and only loads the third-party
// frame when the visitor asks for it. That keeps the page fast on 4G and
// means no tracking cookies are set before the visitor chooses.
import { config } from '../config.js';
import { el, icon } from '../core/dom.js';

function facade({ kind, title, text, button, frame, fallbackHref }) {
  const box = el(
    'div',
    { class: `embed embed--${kind}` },
    el('div', { class: 'embed__icon' }, icon(kind)),
    el('h3', {}, title),
    el('p', {}, text),
    frame
      ? el(
          'button',
          {
            class: 'btn btn--light',
            type: 'button',
            onclick: () => box.replaceChildren(el('iframe', { ...frame, title, loading: 'lazy', allowfullscreen: true })),
          },
          button,
        )
      : el('a', { class: 'btn btn--light', href: fallbackHref, target: '_blank', rel: 'noopener noreferrer' }, button),
  );
  return box;
}

export function youtubeEmbed() {
  const id = config.youtubeVideoId;
  return facade({
    kind: 'youtube',
    title: config.youtubeTitle,
    text: 'Short field videos on grading, packing and cutting post-harvest losses.',
    button: id ? 'Play video' : 'Watch on YouTube',
    fallbackHref: config.social.youtube,
    frame: id && {
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`,
      allow: 'autoplay; encrypted-media; picture-in-picture',
      referrerpolicy: 'strict-origin-when-cross-origin',
    },
  });
}

export function facebookEmbed() {
  const page = encodeURIComponent(config.facebookPage);
  return facade({
    kind: 'facebook',
    title: 'Latest from our Facebook page',
    text: 'Market day notices, harvest calendars and cooperative news.',
    button: 'Show Facebook feed',
    fallbackHref: config.facebookPage,
    frame: {
      src: `https://www.facebook.com/plugins/page.php?href=${page}&tabs=timeline&width=500&height=420&small_header=true&adapt_container_width=true&hide_cover=true`,
      scrolling: 'no',
    },
  });
}
