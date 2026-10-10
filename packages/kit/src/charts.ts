/**
 * Small SVG charts in the collection's visual language: sparklines, a line
 * chart with an optional range band and ghost line, stacked bars, and a
 * turn axis. Every chart returns its markup together with a one-paragraph
 * text summary, which becomes the chart's accessible name; `chartTable`
 * adds the full numbers as a table for anyone who prefers to read them.
 *
 * Charts take colours as tokens (ink, grid, accent…) so each theme and each
 * appearance draws them in its own palette, and they draw straight segments
 * between turns: a turn-based world has no values between years, and a
 * curve would invent some.
 */
import { formatNumber } from './format.ts';

export interface ChartTokens {
  /** The main line and its labels. */
  ink: string;
  /** Axis labels and secondary text. */
  muted: string;
  grid: string;
  /** The latest point, highlights. */
  accent: string;
  /** The previous run of the same world. */
  ghost: string;
  /** Fill under lines and inside forecast bands. */
  band: string;
  /** The background, for halos around points. */
  paper: string;
}

export interface Chart {
  markup: string;
  summary: string;
  width: number;
  height: number;
}

type Format = (value: number) => string;

const defaultFormat: Format = (value) => formatNumber(value);

export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

interface Domain {
  min: number;
  max: number;
}

/** A value domain with a little air, always at least one unit tall. */
export function domainOf(
  values: readonly number[],
  options: { includeZero?: boolean } = {},
): Domain {
  const finite = values.filter(Number.isFinite);
  let min = Math.min(...finite, options.includeZero ? 0 : Infinity);
  let max = Math.max(...finite, options.includeZero ? 0 : -Infinity);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const air = (max - min) * 0.08;
  // Values that never go below zero (counts, stocks) keep zero as their floor.
  const floor = min >= 0 ? Math.max(0, min - air) : min - air;
  return { min: options.includeZero && min >= 0 ? 0 : floor, max: max + air };
}

/** Evenly spaced tick positions (indices) for a turn axis, always including both ends. */
export function turnTicks(count: number, maxTicks = 6): number[] {
  if (count <= 1) return [0];
  const step = Math.max(1, Math.ceil((count - 1) / (maxTicks - 1)));
  const ticks: number[] = [];
  for (let i = 0; i < count - 1; i += step) ticks.push(i);
  if (ticks.at(-1) !== count - 1) {
    // Avoid a cramped penultimate tick right next to the last one.
    if (ticks.length > 1 && count - 1 - (ticks.at(-1) ?? 0) < step / 2) ticks.pop();
    ticks.push(count - 1);
  }
  return ticks;
}

function points(
  values: readonly number[],
  domain: Domain,
  box: { x: number; y: number; width: number; height: number },
  slots = values.length,
): [number, number][] {
  const span = Math.max(1, slots - 1);
  return values.map((value, index) => [
    round(box.x + (index / span) * box.width),
    round(box.y + box.height - ((value - domain.min) / (domain.max - domain.min)) * box.height),
  ]);
}

function path(coordinates: readonly [number, number][]): string {
  return coordinates.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---- summaries ---------------------------------------------------------------

export interface SummaryOptions {
  format?: Format;
  /** "year", "season"… for "lowest 88 in year 4". */
  turnName?: string;
}

/**
 * "People began at 100 and ended at 132 after 10 years; lowest 88 in year 4,
 * highest 140 in year 9." The opening value counts as turn 0.
 */
export function summariseSeries(
  label: string,
  values: readonly number[],
  options: SummaryOptions = {},
): string {
  const format = options.format ?? defaultFormat;
  const turnName = options.turnName ?? 'turn';
  const first = values[0];
  const last = values.at(-1);
  if (first === undefined || last === undefined) return `${label}: no data yet.`;
  if (values.length === 1) return `${label}: ${format(first)} at the start.`;
  let low = 0;
  let high = 0;
  values.forEach((value, index) => {
    if (value < (values[low] ?? value)) low = index;
    if (value > (values[high] ?? value)) high = index;
  });
  const turns = values.length - 1;
  const plural = turns === 1 ? turnName : `${turnName}s`;
  const at = (index: number): string => (index === 0 ? 'at the start' : `in ${turnName} ${index}`);
  return (
    `${label} began at ${format(first)} and ended at ${format(last)} after ${turns} ${plural}; ` +
    `lowest ${format(values[low] ?? first)} ${at(low)}, highest ${format(values[high] ?? first)} ${at(high)}.`
  );
}

// ---- sparkline ---------------------------------------------------------------

export interface SparklineOptions {
  label: string;
  tokens: ChartTokens;
  width?: number;
  height?: number;
  ghost?: readonly number[];
  /** Soft fill under the line. */
  area?: boolean;
  /** How many turns the axis spans; longer than the data while a run is in progress. */
  slots?: number;
  /** A faint baseline across the whole span, so a short line reads as a run still under way. */
  track?: boolean;
  format?: Format;
  turnName?: string;
  strokeWidth?: number;
}

export function sparkline(values: readonly number[], options: SparklineOptions): Chart {
  const width = options.width ?? 120;
  const height = options.height ?? 32;
  const stroke = options.strokeWidth ?? 1.5;
  const { tokens } = options;
  const pad = stroke + 2;
  const box = { x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 };
  const domain = domainOf([...values, ...(options.ghost ?? [])]);
  const slots = Math.max(options.slots ?? 0, values.length, options.ghost?.length ?? 0);
  const line = points(values, domain, box, slots);
  const parts: string[] = [];

  if (options.track) {
    const y = box.y + box.height;
    parts.push(
      `<path d="M${box.x} ${y} H${box.x + box.width}" stroke="${tokens.grid}" stroke-width="1" stroke-dasharray="2 3"/>`,
    );
  }
  if (options.ghost && options.ghost.length > 1) {
    parts.push(
      `<path d="${path(points(options.ghost, domain, box, slots))}" fill="none" stroke="${tokens.ghost}" stroke-width="${stroke}" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  if (options.area && line.length > 1) {
    const first = line[0] as [number, number];
    const last = line.at(-1) as [number, number];
    parts.push(
      `<path d="${path(line)} L${last[0]} ${box.y + box.height} L${first[0]} ${box.y + box.height} Z" fill="${tokens.band}" stroke="none"/>`,
    );
  }
  if (line.length > 1) {
    parts.push(
      `<path d="${path(line)}" fill="none" stroke="${tokens.ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  const end = line.at(-1);
  if (end) {
    parts.push(
      `<circle cx="${end[0]}" cy="${end[1]}" r="${stroke + 1.5}" fill="${tokens.accent}" stroke="${tokens.paper}" stroke-width="1.5"/>`,
    );
  }

  const summary = summariseSeries(options.label, values, withSummaryOptions(options));
  return {
    markup: svg(width, height, summary, parts.join('')),
    summary,
    width,
    height,
  };
}

// ---- line chart ---------------------------------------------------------------

export interface LineSeries {
  label: string;
  values: readonly number[];
  color?: string;
}

export interface LineChartOptions {
  label: string;
  series: readonly LineSeries[];
  tokens: ChartTokens;
  width?: number;
  height?: number;
  ghost?: LineSeries;
  /** A forecast or spread band: low and high per turn. */
  band?: { low: readonly number[]; high: readonly number[] };
  /** How many turns the axis spans (defaults to the longest series). */
  slots?: number;
  format?: Format;
  turnName?: string;
  includeZero?: boolean;
  /** Typeface for axis labels; inherits the page's when omitted. */
  fontFamily?: string;
}

export function lineChart(options: LineChartOptions): Chart {
  const width = options.width ?? 560;
  const height = options.height ?? 220;
  const { tokens } = options;
  const format = options.format ?? defaultFormat;
  const font = options.fontFamily ? ` font-family="${escapeXml(options.fontFamily)}"` : '';
  const all = [
    ...options.series.flatMap((s) => s.values),
    ...(options.ghost?.values ?? []),
    ...(options.band?.low ?? []),
    ...(options.band?.high ?? []),
  ];
  const domain = domainOf(all, { includeZero: options.includeZero ?? false });
  const slots = Math.max(
    options.slots ?? 0,
    ...options.series.map((s) => s.values.length),
    options.ghost?.values.length ?? 0,
  );
  const labelWidth =
    Math.max(...[domain.min, domain.max].map((value) => format(value).length)) * 8.5 + 16;
  const box = { x: labelWidth, y: 12, width: width - labelWidth - 14, height: height - 40 };
  const parts: string[] = [];

  // Three quiet gridlines with their values.
  for (const fraction of [0, 0.5, 1]) {
    const value = domain.min + (domain.max - domain.min) * fraction;
    const y = round(box.y + box.height - fraction * box.height);
    parts.push(
      `<line x1="${box.x}" x2="${box.x + box.width}" y1="${y}" y2="${y}" stroke="${tokens.grid}" stroke-width="1"/>`,
      `<text x="${box.x - 8}" y="${y + 4}" text-anchor="end" font-size="13" fill="${tokens.muted}"${font} style="font-variant-numeric: tabular-nums">${escapeXml(format(value))}</text>`,
    );
  }
  // The turn axis: 0 is the start of the run.
  const span = Math.max(1, slots - 1);
  for (const tick of turnTicks(slots)) {
    const x = round(box.x + (tick / span) * box.width);
    parts.push(
      `<text x="${x}" y="${height - 8}" text-anchor="middle" font-size="13" fill="${tokens.muted}"${font} style="font-variant-numeric: tabular-nums">${tick}</text>`,
    );
  }

  if (options.band && options.band.low.length > 1) {
    const upper = points(options.band.high, domain, box, slots);
    const lower = points(options.band.low, domain, box, slots).reverse();
    parts.push(`<path d="${path([...upper, ...lower])} Z" fill="${tokens.band}" stroke="none"/>`);
  }
  if (options.ghost && options.ghost.values.length > 1) {
    parts.push(
      `<path d="${path(points(options.ghost.values, domain, box, slots))}" fill="none" stroke="${tokens.ghost}" stroke-width="1.75" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  options.series.forEach((series, index) => {
    const color = series.color ?? (index === 0 ? tokens.ink : tokens.accent);
    const line = points(series.values, domain, box, slots);
    if (line.length > 1) {
      parts.push(
        `<path d="${path(line)}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
    for (const [x, y] of line) {
      parts.push(
        `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}" stroke="${tokens.paper}" stroke-width="1"/>`,
      );
    }
  });

  const summaries = options.series.map((series) =>
    summariseSeries(series.label, series.values, withSummaryOptions(options)),
  );
  if (options.ghost) {
    const last = options.ghost.values.at(-1);
    if (last !== undefined) summaries.push(`${options.ghost.label} ended at ${format(last)}.`);
  }
  const summary = summaries.join(' ');
  return { markup: svg(width, height, summary, parts.join('')), summary, width, height };
}

// ---- stacked bars --------------------------------------------------------------

export interface StackedBarsOptions {
  label: string;
  /** One bar per category (often one per turn). */
  categories: readonly string[];
  stacks: readonly { label: string; values: readonly number[]; color: string }[];
  tokens: ChartTokens;
  width?: number;
  height?: number;
  format?: Format;
  fontFamily?: string;
}

export function stackedBars(options: StackedBarsOptions): Chart {
  const width = options.width ?? 560;
  const height = options.height ?? 200;
  const format = options.format ?? defaultFormat;
  const { tokens } = options;
  const font = options.fontFamily ? ` font-family="${escapeXml(options.fontFamily)}"` : '';
  const totals = options.categories.map((_, index) =>
    options.stacks.reduce((sum, stack) => sum + Math.max(0, stack.values[index] ?? 0), 0),
  );
  const max = Math.max(1, ...totals);
  const box = { x: 8, y: 8, width: width - 16, height: height - 34 };
  const slot = box.width / Math.max(1, options.categories.length);
  const barWidth = round(Math.max(2, slot * 0.62));
  const parts: string[] = [
    `<line x1="${box.x}" x2="${box.x + box.width}" y1="${box.y + box.height}" y2="${box.y + box.height}" stroke="${tokens.grid}" stroke-width="1"/>`,
  ];
  const ticks = new Set(turnTicks(options.categories.length, 8));
  options.categories.forEach((category, index) => {
    const x = round(box.x + slot * index + (slot - barWidth) / 2);
    let top = box.y + box.height;
    for (const stack of options.stacks) {
      const value = Math.max(0, stack.values[index] ?? 0);
      const barHeight = round((value / max) * box.height);
      if (barHeight <= 0) continue;
      top = round(top - barHeight);
      parts.push(
        `<rect x="${x}" y="${top}" width="${barWidth}" height="${barHeight}" fill="${stack.color}" rx="1.5"/>`,
      );
    }
    if (ticks.has(index)) {
      parts.push(
        `<text x="${round(x + barWidth / 2)}" y="${height - 8}" text-anchor="middle" font-size="13" fill="${tokens.muted}"${font}>${escapeXml(category)}</text>`,
      );
    }
  });
  const peak = totals.indexOf(Math.max(...totals));
  const summary =
    `${options.label}: ${options.stacks.map((stack) => stack.label).join(', ')} across ` +
    `${options.categories.length} bars; the largest total is ${format(totals[peak] ?? 0)} ` +
    `(${options.categories[peak] ?? ''}).`;
  return { markup: svg(width, height, summary, parts.join('')), summary, width, height };
}

// ---- output ------------------------------------------------------------------

function svg(width: number, height: number, summary: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(summary)}">` +
    `<title>${escapeXml(summary)}</title>${body}</svg>`
  );
}

function withSummaryOptions(options: { format?: Format; turnName?: string }): SummaryOptions {
  const summary: SummaryOptions = {};
  if (options.format) summary.format = options.format;
  if (options.turnName) summary.turnName = options.turnName;
  return summary;
}

/** Puts a chart into the page; the summary stays its accessible name. */
export function renderChart(host: Element, chart: Chart): void {
  host.innerHTML = chart.markup;
  const element = host.firstElementChild;
  if (element instanceof SVGElement) {
    element.removeAttribute('width');
    element.removeAttribute('height');
    element.style.width = '100%';
    element.style.height = 'auto';
  }
}

/** The numbers behind a chart as an HTML table, one row per turn. */
export function chartTable(
  caption: string,
  series: readonly LineSeries[],
  options: { format?: Format; turnName?: string } = {},
): string {
  const format = options.format ?? defaultFormat;
  const turnName = options.turnName ?? 'Turn';
  const rows = Math.max(0, ...series.map((s) => s.values.length));
  const head = series.map((s) => `<th scope="col">${escapeXml(s.label)}</th>`).join('');
  const body = Array.from({ length: rows }, (_, row) => {
    const cells = series
      .map((s) => `<td>${s.values[row] === undefined ? '' : escapeXml(format(s.values[row]))}</td>`)
      .join('');
    const name = row === 0 ? 'Start' : `${capitalise(turnName)} ${row}`;
    return `<tr><th scope="row">${name}</th>${cells}</tr>`;
  }).join('');
  return `<table class="omy-chart-table"><caption>${escapeXml(caption)}</caption><thead><tr><th scope="col">${escapeXml(capitalise(turnName))}</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
