/**
 * Numbers as the player reads them. One formatter for the whole collection
 * keeps every report, chart label and share string consistent: commas for
 * thousands, a true minus sign, signed deltas such as "+12 / −340", and
 * units that each simulation supplies.
 *
 * Formatting is deliberately locale-independent: a share string or a
 * chronicle must read the same on every machine. Pair the output with
 * `font-variant-numeric: tabular-nums` (the `.tabular` class in every theme)
 * so columns of figures line up.
 */

/** U+2212, wider than a hyphen and the same width as a plus sign in good fonts. */
export const MINUS = '−';

export interface Unit {
  singular: string;
  plural: string;
}

export type NumberStyle = 'integer' | 'decimal' | 'percent' | 'compact';

export interface FormatOptions {
  /** Digits after the decimal point (default 0, or 1 for 'decimal'). */
  decimals?: number;
}

/** "12,345", "−3", "1.5" — rounding half away from zero, never "-0". */
export function formatNumber(value: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(value)) return '—';
  const decimals = options.decimals ?? 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  const negative = value < 0 && rounded !== 0;
  const [whole = '0', fraction] = rounded.toFixed(decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return negative ? `${MINUS}${body}` : body;
}

/** "+12", "−340", "±0": the delta style used in reports, tiles and chronicles. */
export function formatDelta(value: number, options: FormatOptions = {}): string {
  const body = formatNumber(Math.abs(value), options);
  if (body === formatNumber(0, options)) return `±${body}`;
  return value > 0 ? `+${body}` : `${MINUS}${body}`;
}

/** A fraction as a percentage: 0.255 → "26%" (or "25.5%" with one decimal). */
export function formatPercent(fraction: number, options: FormatOptions = {}): string {
  return `${formatNumber(fraction * 100, options)}%`;
}

/** Short form for tight spaces: 950, 12.3k, 4.1M. */
export function formatCompact(value: number): string {
  const size = Math.abs(value);
  if (size < 10_000) return formatNumber(value);
  if (size < 1_000_000)
    return `${formatNumber(value / 1000, { decimals: size < 100_000 ? 1 : 0 })}k`;
  return `${formatNumber(value / 1_000_000, { decimals: 1 })}M`;
}

export function formatStyled(value: number, style: NumberStyle): string {
  switch (style) {
    case 'integer':
      return formatNumber(value);
    case 'decimal':
      return formatNumber(value, { decimals: 1 });
    case 'percent':
      return formatPercent(value);
    case 'compact':
      return formatCompact(value);
  }
}

/** "1 acre", "12 acres", "1,200 acres". */
export function formatQuantity(value: number, unit: Unit, options: FormatOptions = {}): string {
  return `${formatNumber(value, options)} ${pluralize(value, unit)}`;
}

/** The unit word that agrees with the value: only exactly one is singular. */
export function pluralize(value: number, unit: Unit): string {
  return Math.abs(value) === 1 ? unit.singular : unit.plural;
}

/** "between 1,900 and 2,800" with the range always low to high. */
export function formatRange(low: number, high: number, options: FormatOptions = {}): string {
  const [from, to] = low <= high ? [low, high] : [high, low];
  if (formatNumber(from, options) === formatNumber(to, options)) return formatNumber(from, options);
  return `${formatNumber(from, options)}–${formatNumber(to, options)}`;
}

const UNIT_NAMES: Record<string, string> = {
  year: 'Year',
  season: 'Season',
  month: 'Month',
  week: 'Week',
  day: 'Day',
};

/** "Year 6 of 10", or "Year 6" when the run has no fixed length. */
export function formatTurn(turnUnit: string, turn: number, total?: number | null): string {
  const name = UNIT_NAMES[turnUnit] ?? turnUnit;
  return total ? `${name} ${turn} of ${total}` : `${name} ${turn}`;
}

/** "1st", "2nd", "23rd", "11th". */
export function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/** "12 minutes", "1 hour 5 minutes": time played, rounded to the minute. */
export function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return formatQuantity(minutes, { singular: 'minute', plural: 'minutes' });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = formatQuantity(hours, { singular: 'hour', plural: 'hours' });
  return rest === 0
    ? hourText
    : `${hourText} ${formatQuantity(rest, { singular: 'minute', plural: 'minutes' })}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "9 October 2026" from a UTC day key or a timestamp, the same everywhere. */
export function formatDate(day: string | number): string {
  const date = typeof day === 'number' ? new Date(day) : new Date(`${day}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCFullYear()}`;
}
