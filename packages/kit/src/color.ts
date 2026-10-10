/**
 * Colour arithmetic for the themes and charts: parse CSS colours, mix them,
 * and measure contrast the way WCAG 2.1 does. The Hall's tests use
 * `contrastRatio` to assert AA on every theme × appearance token pair, so a
 * palette tweak that hurts legibility fails CI instead of reaching players.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Normal text needs 4.5:1, large text (≥ 24 px, or ≥ 18.66 px bold) and UI parts 3:1. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba(). */
export function parseColor(css: string): Rgba {
  const text = css.trim().toLowerCase();
  if (text.startsWith('#')) return parseHex(text.slice(1));
  const functional = /^rgba?\(([^)]+)\)$/.exec(text);
  if (functional?.[1]) {
    const parts = functional[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b, a] = parts.map((part, index) =>
      part.endsWith('%')
        ? (Number.parseFloat(part) / 100) * (index < 3 ? 255 : 1)
        : Number.parseFloat(part),
    );
    if ([r, g, b].every((channel) => channel !== undefined && Number.isFinite(channel))) {
      return { r: r ?? 0, g: g ?? 0, b: b ?? 0, a: a ?? 1 };
    }
  }
  throw new Error(`Unsupported colour: ${css}`);
}

function parseHex(hex: string): Rgba {
  const expanded = hex.length <= 4 ? hex.replace(/./g, (digit) => digit + digit) : hex;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(expanded)) throw new Error(`Unsupported colour: #${hex}`);
  const channel = (offset: number): number =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16);
  return {
    r: channel(0),
    g: channel(2),
    b: channel(4),
    a: expanded.length === 8 ? channel(6) / 255 : 1,
  };
}

export function toHex(color: Rgba): string {
  const channel = (value: number): string =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  const alpha = color.a < 1 ? channel(color.a * 255) : '';
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}${alpha}`;
}

/** Linear blend: t = 0 gives `from`, t = 1 gives `to`. */
export function mix(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  const lerp = (x: number, y: number): number => x + (y - x) * t;
  return toHex({ r: lerp(a.r, b.r), g: lerp(a.g, b.g), b: lerp(a.b, b.b), a: lerp(a.a, b.a) });
}

export function withAlpha(color: string, alpha: number): string {
  return toHex({ ...parseColor(color), a: alpha });
}

/** A translucent colour as it actually appears over an opaque background. */
export function composite(foreground: string, background: string): Rgba {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

export function relativeLuminance(color: Rgba): number {
  const linear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** WCAG contrast ratio, from 1 (none) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const bg = composite(background, '#ffffff');
  const fg = composite(foreground, toHex(bg));
  const [light, dark] = [relativeLuminance(fg), relativeLuminance(bg)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? AA_LARGE : AA_TEXT);
}
