/**
 * The Hall's icons, drawn as 24×24 line art with currentColor so each
 * theme inks them in its own colour. Decorative: every icon sits beside a
 * text label or inside a control with an accessible name.
 */
import { svgFrom } from '../app/dom.ts';

const PATHS = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z"/>',
  soundOn:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.7 2.4 2.9-.5.6 2.9 2.6 1.4-1.2 2.7 1.2 2.7-2.6 1.4-.6 2.9-2.9-.5L12 21.2l-1.7-2.4-2.9.5-.6-2.9-2.6-1.4L5.4 12 4.2 9.3l2.6-1.4.6-2.9 2.9.5z"/>',
  library: '<path d="M4 5.5h4v13H4zM9.5 5.5h4v13h-4zM15 6.4l3.8-1 3 12.6-3.8 1z"/>',
  codex:
    '<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/><circle cx="11.5" cy="8.5" r="1.6"/>',
  legacy:
    '<path d="M12 21v-7"/><path d="M12 14c-4.5 0-7-3-7-8 4 0 7 2.5 7 8zM12 14c4.5 0 7-3 7-8-4 0-7 2.5-7 8z"/><path d="M8.5 21h7"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V20h14v-7.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  calendar:
    '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  theme:
    '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.4-2.2-.8-1.6.2-3.3 2-3.3h2.1a3 3 0 0 0 3-3A8.5 8.5 0 0 0 12 3.5z"/><circle cx="8" cy="11" r="1.1"/><circle cx="11.5" cy="7.5" r="1.1"/><circle cx="15.5" cy="8.6" r="1.1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  flower:
    '<circle cx="12" cy="12" r="2"/><path d="M12 10c-1.5-3-1-5.5 0-6.5 1 1 1.5 3.5 0 6.5zM12 14c1.5 3 1 5.5 0 6.5-1-1-1.5-3.5 0-6.5zM10 12c-3 1.5-5.5 1-6.5 0 1-1 3.5-1.5 6.5 0zM14 12c3-1.5 5.5-1 6.5 0-1 1-3.5 1.5-6.5 0z"/>',
  external: '<path d="M13.5 5H19v5.5M19 5l-8 8"/><path d="M17 13.5V19H5V7h5.5"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 20): SVGSVGElement {
  const svg = svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`,
  );
  svg.classList.add('icon');
  return svg;
}
