/**
 * A tiny element builder, so chrome code reads as structure rather than as
 * a pile of createElement calls. No virtual DOM, no diffing: each view
 * builds its elements and updates the few that change.
 */

export type Child = Node | string | number | null | undefined | false;
export type Attributes = Record<string, string | number | boolean | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Child | readonly Child[])[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  setAttributes(element, attributes);
  append(element, children);
  return element;
}

export function setAttributes(element: Element, attributes: Attributes): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) element.removeAttribute(name);
    else element.setAttribute(name, value === true ? '' : String(value));
  }
}

export function append(parent: Element, children: readonly (Child | readonly Child[])[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(typeof child === 'number' ? String(child) : child);
  }
}

/** A button that runs `onClick`; most chrome actions are exactly this. */
export function button(
  label: Child | readonly Child[],
  onClick: (event: MouseEvent) => void,
  attributes: Attributes = {},
): HTMLButtonElement {
  const element = h('button', { type: 'button', ...attributes }, label);
  element.addEventListener('click', onClick);
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Parses trusted SVG markup (our own icons, emblems and charts) into an element. */
export function svgFrom(markup: string): SVGSVGElement {
  const holder = document.createElement('div');
  holder.innerHTML = markup.trim();
  const svg = holder.firstElementChild;
  if (!(svg instanceof SVGSVGElement)) throw new Error('Expected SVG markup');
  return svg;
}

/** An emblem from a manifest: 24×24 path data drawn as an engraved line. */
export function emblem(pathData: string, attributes: Attributes = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  setAttributes(svg, {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    class: 'emblem',
    ...attributes,
  });
  const path = document.createElementNS(SVG_NS, 'path');
  setAttributes(path, {
    d: pathData,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'vector-effect': 'non-scaling-stroke',
  });
  svg.append(path);
  return svg;
}

export function clear(element: Element): void {
  element.replaceChildren();
}
