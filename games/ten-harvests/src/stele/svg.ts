/**
 * The stele as a flat picture: the same relief design drawn in SVG, for
 * downloading and sharing. Sunk grounds are dark, raised motifs pale, and
 * a thin offset shadow stands in for the raking light.
 */
import { escapeXml } from '@one-more-year/kit';
import { FACE, type Relief } from './relief.ts';

export interface SteleSvgColours {
  paper: string;
  stone: string;
  ground: string;
  motif: string;
  shadow: string;
}

export const STELE_SVG_COLOURS: SteleSvgColours = {
  paper: '#efe2c6',
  stone: '#5b5f6b',
  ground: '#3a3d47',
  motif: '#9aa0ad',
  shadow: '#23252c',
};

export function steleSvg(relief: Relief, colours: SteleSvgColours = STELE_SVG_COLOURS): string {
  const pad = 60;
  const width = FACE.width + pad * 2;
  const height = FACE.height + pad * 2;
  const grounds = relief.shapes.filter((shape) => shape.height < 0.5);
  const raised = relief.shapes.filter((shape) => shape.height >= 0.5);
  const path = (d: string, fill: string, dx = 0, dy = 0): string =>
    `<path d="${d}" fill="${fill}"${dx || dy ? ` transform="translate(${dx} ${dy})"` : ''}/>`;
  const text = relief.texts
    .map(
      (t) =>
        `<text x="${t.x}" y="${t.y}" font-size="${t.size.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" letter-spacing="${(t.letterSpacing * t.size).toFixed(1)}" fill="${t.height < 0.5 ? colours.ground : colours.motif}">${escapeXml(t.text)}</text>`,
    )
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width / 2}" height="${height / 2}">`,
    `<rect width="${width}" height="${height}" fill="${colours.paper}"/>`,
    `<g transform="translate(${pad} ${pad})" font-family="Fraunces, Georgia, serif" font-weight="600">`,
    path(relief.outline, colours.shadow, 10, 12),
    path(relief.outline, colours.stone),
    ...grounds.map((shape) => path(shape.d, colours.ground)),
    ...raised.map((shape) => path(shape.d, colours.shadow, 4, 5)),
    ...raised.map((shape) => path(shape.d, colours.motif)),
    text,
    '</g></svg>',
  ].join('');
}
