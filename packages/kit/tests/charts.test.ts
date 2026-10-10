import { describe, expect, it } from 'vitest';
import {
  chartTable,
  domainOf,
  escapeXml,
  lineChart,
  renderChart,
  sparkline,
  stackedBars,
  summariseSeries,
  turnTicks,
  type ChartTokens,
} from '../src/charts.ts';

const tokens: ChartTokens = {
  ink: '#222222',
  muted: '#666666',
  grid: '#dddddd',
  accent: '#c0392b',
  ghost: '#999999',
  band: '#eeeeee',
  paper: '#ffffff',
};

describe('charts', () => {
  it('summarises a series in words', () => {
    expect(summariseSeries('People', [100, 95, 88, 120, 140, 132], { turnName: 'year' })).toBe(
      'People began at 100 and ended at 132 after 5 years; lowest 88 in year 2, highest 140 in year 4.',
    );
    expect(summariseSeries('Grain', [])).toBe('Grain: no data yet.');
    expect(summariseSeries('Grain', [5])).toBe('Grain: 5 at the start.');
  });

  it('draws a sparkline with its summary as the accessible name', () => {
    const chart = sparkline([3, 5, 4, 8], { label: 'Fish', tokens, turnName: 'year' });
    expect(chart.markup).toMatch(/^<svg [^>]*role="img"/);
    expect(chart.markup).toContain(`aria-label="${escapeXml(chart.summary)}"`);
    expect(chart.markup).toContain('<circle');
    expect(chart.summary).toContain('Fish began at 3 and ended at 8');
  });

  it('draws the ghost of the previous run when given one', () => {
    const plain = sparkline([1, 2, 3], { label: 'x', tokens });
    const haunted = sparkline([1, 2, 3], { label: 'x', tokens, ghost: [1, 3, 2, 4] });
    expect(plain.markup).not.toContain('stroke-dasharray');
    expect(haunted.markup).toContain(`stroke="${tokens.ghost}"`);
    const line = lineChart({
      label: 'Fish',
      series: [{ label: 'Fish', values: [5, 6, 7] }],
      ghost: { label: 'Last time', values: [5, 4, 3, 2] },
      tokens,
    });
    expect(line.summary).toContain('Last time ended at 2.');
  });

  it('draws a line chart with axis, band and points', () => {
    const chart = lineChart({
      label: 'Grain',
      series: [{ label: 'Grain', values: [2800, 3000, 2600, 3400] }],
      band: { low: [2800, 2700, 2400, 3000], high: [2800, 3200, 2900, 3700] },
      tokens,
      turnName: 'year',
    });
    expect(chart.markup.match(/<circle/g)).toHaveLength(4);
    expect(chart.markup).toContain(`fill="${tokens.band}"`);
    // Axis labels go through the formatter, so thousands are grouped.
    expect(chart.markup).toMatch(/>\d,\d{3}</);
    expect(chart.summary).toContain('Grain began at 2,800');
  });

  it('stacks bars and names the peak', () => {
    const chart = stackedBars({
      label: 'Catch',
      categories: ['1', '2', '3'],
      stacks: [
        { label: 'Kept', values: [3, 5, 2], color: '#111111' },
        { label: 'Released', values: [1, 2, 0], color: '#888888' },
      ],
      tokens,
    });
    expect(chart.markup.match(/<rect/g)).toHaveLength(5);
    expect(chart.summary).toContain('largest total is 7 (2)');
  });

  it('spaces turn ticks evenly and keeps both ends', () => {
    expect(turnTicks(1)).toEqual([0]);
    expect(turnTicks(11)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(turnTicks(46).at(-1)).toBe(45);
    expect(turnTicks(46)[0]).toBe(0);
  });

  it('gives flat data a visible domain', () => {
    expect(domainOf([5, 5, 5]).max).toBeGreaterThan(domainOf([5, 5, 5]).min);
    expect(domainOf([3, 9], { includeZero: true }).min).toBe(0);
    expect(domainOf([])).toEqual({ min: 0, max: 1 });
  });

  it('renders into the page and offers the numbers as a table', () => {
    const host = document.createElement('div');
    renderChart(host, sparkline([1, 2], { label: 'x', tokens }));
    expect(host.querySelector('svg')?.getAttribute('role')).toBe('img');
    const table = chartTable('Fish by year', [{ label: 'Fish', values: [5, 6] }], {
      turnName: 'year',
    });
    expect(table).toContain('<caption>Fish by year</caption>');
    expect(table).toContain('<th scope="row">Start</th><td>5</td>');
    expect(table).toContain('<th scope="row">Year 1</th><td>6</td>');
  });

  it('escapes text so labels cannot break the markup', () => {
    expect(escapeXml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
  });
});
