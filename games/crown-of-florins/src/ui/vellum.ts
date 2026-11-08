/**
 * Vellum for the obituary page, made by SVG filters, not by any image: the
 * skin's fibre running along the page, the faint speckle of its follicles,
 * edges a little darker where hands have held it, and in the light a soft
 * cockle, the gentle waves an old leaf takes from the air. By candlelight
 * (dark) the same skin is a dark vellum with paler fibres.
 *
 * One function gives the markup, used both behind the living page and in
 * the SVG share card, so the two are the same page.
 */

export interface VellumOptions {
  appearance: 'light' | 'dark';
  /** A seed for the skin's own pattern, so two pages are not one skin. */
  seed: number;
  /** Unique within the document, for the filters' and gradients' ids. */
  id: string;
}

export function vellumMarkup(options: VellumOptions): string {
  const dark = options.appearance === 'dark';
  const id = options.id;
  const seed = Math.abs(Math.round(options.seed)) % 997;
  const paper = dark ? ['#2e241b', '#241b14'] : ['#f2e3c3', '#e6d1a5'];
  const fibreInk = dark ? '0.93 0.86 0.7' : '0.36 0.24 0.12';
  const speckInk = dark ? '0.85 0.76 0.6' : '0.3 0.2 0.1';
  const edge = dark ? '#0e0a07' : '#7a5228';
  return (
    `<defs>` +
    `<linearGradient id="${id}-skin" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${paper[0]}"/><stop offset="1" stop-color="${paper[1]}"/></linearGradient>` +
    // The fibre: long thin streaks along the page.
    `<filter id="${id}-fibre" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.03 0.16" numOctaves="3" seed="${seed}" result="streaks"/>` +
    `<feColorMatrix in="streaks" type="matrix" values="0 0 0 0 ${fibreInk.split(' ')[0]}  0 0 0 0 ${fibreInk.split(' ')[1]}  0 0 0 0 ${fibreInk.split(' ')[2]}  2.4 0 0 0 -1.15"/>` +
    `</filter>` +
    // The follicles: sparse small dark specks, here and there in short rows.
    `<filter id="${id}-speckle" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="1" seed="${seed + 11}" result="dots"/>` +
    `<feColorMatrix in="dots" type="matrix" values="0 0 0 0 ${speckInk.split(' ')[0]}  0 0 0 0 ${speckInk.split(' ')[1]}  0 0 0 0 ${speckInk.split(' ')[2]}  20 0 0 0 -14.6" result="specks"/>` +
    `<feComponentTransfer in="specks"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0.55 0.8"/></feComponentTransfer>` +
    `</filter>` +
    // The cockle: slow waves in the skin, lit from the upper left.
    `<filter id="${id}-cockle" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.0028 0.0045" numOctaves="2" seed="${seed + 23}" result="waves"/>` +
    `<feDiffuseLighting in="waves" surfaceScale="${dark ? 14 : 20}" diffuseConstant="1.25" lighting-color="${dark ? '#8a7a64' : '#fffaf0'}" result="lit">` +
    `<feDistantLight azimuth="225" elevation="${dark ? 62 : 48}"/></feDiffuseLighting>` +
    `<feColorMatrix in="lit" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1"/>` +
    `</filter>` +
    // The skin's own mottle: soft cloudy differences of tone.
    `<filter id="${id}-mottle" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="${seed + 37}" result="clouds"/>` +
    `<feColorMatrix in="clouds" type="matrix" values="0 0 0 0 ${fibreInk.split(' ')[0]}  0 0 0 0 ${fibreInk.split(' ')[1]}  0 0 0 0 ${fibreInk.split(' ')[2]}  1.6 0 0 0 -0.62"/>` +
    `</filter>` +
    `<radialGradient id="${id}-edges" cx="0.5" cy="0.46" r="0.72"><stop offset="0.62" stop-color="${edge}" stop-opacity="0"/><stop offset="1" stop-color="${edge}" stop-opacity="${dark ? 0.55 : 0.32}"/></radialGradient>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#${id}-skin)"/>` +
    `<rect width="100%" height="100%" filter="url(#${id}-cockle)" style="mix-blend-mode:multiply" opacity="${dark ? 0.55 : 0.5}"/>` +
    `<rect width="100%" height="100%" filter="url(#${id}-mottle)" opacity="${dark ? 0.14 : 0.18}"/>` +
    `<rect width="100%" height="100%" filter="url(#${id}-fibre)" opacity="${dark ? 0.08 : 0.1}"/>` +
    `<rect width="100%" height="100%" filter="url(#${id}-speckle)" opacity="${dark ? 0.3 : 0.38}"/>` +
    `<rect width="100%" height="100%" fill="url(#${id}-edges)"/>`
  );
}

/** The vellum as an element filling the page behind its writing. */
export function vellumSvg(options: VellumOptions): string {
  return (
    `<svg class="cf-ms__vellum" aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none">` +
    vellumMarkup(options) +
    `</svg>`
  );
}
