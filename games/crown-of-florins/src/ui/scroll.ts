/**
 * A body that scrolls inside its card, and says so. The year screen's
 * columns must fit above the rival bar at every size, so a long panel
 * scrolls within itself; while there is more below, the bottom edge fades
 * and a small mark says "more below", so nothing is ever cut off without
 * the player knowing. While it scrolls it can be focused, so the keyboard
 * scrolls it too, and a screen reader hears it named.
 */
import { el, type Child } from './dom.ts';

export interface ScrollBody {
  /** The frame to place in the card: the scrolling content and its mark. */
  readonly element: HTMLElement;
  /** Where the scrolling content goes. */
  readonly content: HTMLElement;
  /** Looks again for more above or below; call after the content changes. */
  refresh(): void;
}

export function scrollBody(className: string, label: string, ...children: Child[]): ScrollBody {
  const content = el('div', { class: `cf-scroll ${className}` }, ...children);
  const more = el('span', { class: 'cf-scroll__more', 'aria-hidden': 'true' }, 'more below');
  const element = el('div', { class: 'cf-scroll-frame' }, content, more);
  const refresh = (): void => {
    const below = content.scrollHeight - content.clientHeight - content.scrollTop > 4;
    element.toggleAttribute('data-more-below', below);
    element.toggleAttribute('data-more-above', content.scrollTop > 4);
    const scrolls = content.scrollHeight - content.clientHeight > 4;
    if (scrolls) {
      content.tabIndex = 0;
      content.setAttribute('role', 'region');
      content.setAttribute('aria-label', label);
    } else {
      content.removeAttribute('tabindex');
      content.removeAttribute('role');
      content.removeAttribute('aria-label');
    }
  };
  content.addEventListener('scroll', refresh, { passive: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(content);
  return { element, content, refresh };
}
