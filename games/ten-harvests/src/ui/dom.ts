/**
 * A small element helper for the interface: attributes first, then
 * children (strings become text). Enough to build panels without a
 * framework, as the Hall does.
 */

type Attributes = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  setAttributes(element, attributes);
  for (const child of children)
    if (child !== null && child !== undefined && child !== false) element.append(child);
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (SVGElement | null)[]
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  setAttributes(element, attributes);
  for (const child of children) if (child) element.append(child);
  return element;
}

function setAttributes(element: Element, attributes: Attributes): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
}

export function button(
  label: Child | Child[],
  onClick: (event: MouseEvent) => void,
  attributes: Attributes = {},
): HTMLButtonElement {
  const children = Array.isArray(label) ? label : [label];
  const control = el('button', { type: 'button', ...attributes }, ...children);
  control.addEventListener('click', onClick);
  return control;
}

/** Replaces an element's text only when it changed, so screen readers are not spammed. */
export function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
