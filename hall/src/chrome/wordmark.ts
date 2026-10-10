/**
 * The collection's logo: "One More Year" set beside a small mark, a
 * calendar leaf whose corner turns over onto a sprout. It is an inline SVG
 * that inherits the theme's colours and type, so each theme inks the same
 * logo in its own hand.
 */
import { svgFrom } from '../app/dom.ts';

/** The mark alone: a leaf of the year turning, with a sprout under it. */
export const MARK_PATHS =
  '<rect x="3" y="4" width="18" height="17" rx="2.5"/>' +
  '<path d="M3 9h18"/>' +
  '<path d="M8 2.5v3M16 2.5v3"/>' +
  '<path d="M12 18.5v-5"/>' +
  '<path d="M12 14.5c-2.4 0-3.6-1.4-3.6-3.4 2.4 0 3.6 1.4 3.6 3.4zM12 13.3c0-2.1 1.2-3.5 3.6-3.5 0 2.1-1.2 3.5-3.6 3.5z"/>';

export function mark(size = 28): SVGSVGElement {
  return svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="wordmark__mark">${MARK_PATHS}</svg>`,
  );
}

/** The full wordmark as an element: the mark and the name, readable as "One More Year". */
export function wordmark(): HTMLElement {
  const holder = document.createElement('span');
  holder.className = 'wordmark';
  const name = document.createElement('span');
  name.className = 'wordmark__name';
  name.textContent = 'One More Year';
  holder.append(mark(), name);
  return holder;
}
