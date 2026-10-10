/**
 * Honest previews of a plan's consequences.
 *
 * A forecast runs the simulation's own pure step on the current state with
 * the current plan, so the preview and the real year use the very same
 * rules. If the step never consults its random stream, the answer is exact.
 * Otherwise the step is run many times on independent sample streams and the
 * forecast gives the range that held in a stated share of them ("8 in 10
 * years"), together with the median.
 *
 * A forecast never peeks at the world's real dice: its sample streams are
 * forked under the label 'forecast', which shares nothing with the stream
 * the committed step will use. The samples are still seeded, so the same
 * plan always shows the same forecast and the screen does not flicker while
 * the player types.
 */
import { createRng } from './rng.ts';
import type { SimEvent } from './events.ts';
import type { TurnModel } from './turns.ts';

export type Forecast =
  | { kind: 'exact'; value: number }
  | {
      kind: 'range';
      low: number;
      high: number;
      median: number;
      /** The share of samples the range covers, e.g. 0.8. */
      coverage: number;
      samples: number;
    };

/** Reads one number from the world after the step (and, if useful, before it). */
export type Measure<State> = (after: State, events: readonly SimEvent[], before: State) => number;

export interface ForecastOptions {
  /** Default 200: enough for stable 10th/90th percentiles at negligible cost. */
  samples?: number;
  /** Default 0.8. */
  coverage?: number;
  /** Seeds the sample streams; use the world seed and step so forecasts stay stable. */
  seed?: number | string;
}

export function forecast<State, Plan>(
  model: TurnModel<State, Plan>,
  state: State,
  plan: Plan,
  measure: Measure<State>,
  options: ForecastOptions = {},
): Forecast {
  return forecastMany(model, state, plan, { value: measure }, options).value;
}

/** Several measures from one set of samples: cheaper, and the ranges are consistent. */
export function forecastMany<State, Plan, Key extends string>(
  model: TurnModel<State, Plan>,
  state: State,
  plan: Plan,
  measures: Readonly<Record<Key, Measure<State>>>,
  options: ForecastOptions = {},
): Record<Key, Forecast> {
  const keys = Object.keys(measures) as Key[];
  const samples = options.samples ?? 200;
  const coverage = options.coverage ?? 0.8;
  const streams = createRng(options.seed ?? 0).fork('forecast');

  const probe = streams.fork('probe');
  const first = model.resolve(state, plan, probe);
  if (probe.draws === 0) {
    // Nothing random happened, so the one result is the result.
    return Object.fromEntries(
      keys.map((key) => [
        key,
        { kind: 'exact', value: measures[key](first.state, first.events, state) },
      ]),
    ) as Record<Key, Forecast>;
  }

  const values = new Map<Key, number[]>(keys.map((key) => [key, []]));
  for (let i = 0; i < samples; i++) {
    const sample = model.resolve(state, plan, streams.fork(`sample:${i}`));
    for (const key of keys)
      values.get(key)?.push(measures[key](sample.state, sample.events, state));
  }
  return Object.fromEntries(
    keys.map((key) => [key, summarise(values.get(key) ?? [], coverage)]),
  ) as Record<Key, Forecast>;
}

/** The central range holding `coverage` of the values, plus the median. */
export function summarise(values: readonly number[], coverage: number): Forecast {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction: number): number =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))))] ??
    0;
  const tail = (1 - coverage) / 2;
  return {
    kind: 'range',
    low: at(tail),
    high: at(1 - tail),
    median: at(0.5),
    coverage,
    samples: sorted.length,
  };
}

/**
 * A forecast in plain words, with the simulation's number formatting:
 * "exactly 2,400", "2,400 in every trial year", or
 * "1,900–2,800 in 8 of 10 years (most likely 2,350)".
 */
export function describeForecast(value: Forecast, format: (n: number) => string): string {
  if (value.kind === 'exact') return `exactly ${format(value.value)}`;
  if (format(value.low) === format(value.high)) return `${format(value.low)} in every trial year`;
  const inTen = Math.round(value.coverage * 10);
  return `${format(value.low)}–${format(value.high)} in ${inTen} of 10 years (most likely ${format(value.median)})`;
}

/** True when a realised value falls inside the forecast (used by tests and the "last time" notes). */
export function forecastHolds(value: Forecast, actual: number): boolean {
  return value.kind === 'exact'
    ? value.value === actual
    : actual >= value.low && actual <= value.high;
}

/** The forecast seed for a step: stable while the player edits, unrelated to the real stream. */
export function forecastSeed(worldSeed: number, step: number): string {
  return `${worldSeed}:${step}`;
}
