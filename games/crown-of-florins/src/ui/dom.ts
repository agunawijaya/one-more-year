/**
 * A small helper for building the panels: `el('p', {class: 'x'}, 'text')`.
 * Attributes are set as attributes (aria-*, data-*, role…), children may be
 * nodes or strings, and null children are skipped.
 */

export type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string | number | boolean | null | undefined>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

/** Markup we built ourselves (SVG from heraldry and portraits), parsed once into a node. */
export function svgNode(markup: string): SVGSVGElement {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const svg = holder.firstElementChild;
  if (!(svg instanceof SVGSVGElement)) throw new Error('Expected an <svg> element');
  return svg;
}

export function button(
  label: Child | Child[],
  onClick: () => void,
  attributes: Readonly<Record<string, string | number | boolean | null | undefined>> = {},
): HTMLButtonElement {
  const node = el(
    'button',
    { type: 'button', ...attributes },
    ...(Array.isArray(label) ? label : [label]),
  );
  node.addEventListener('click', onClick);
  return node;
}
