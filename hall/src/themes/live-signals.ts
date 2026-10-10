/**
 * Live signals: a demo's frames turned into per-signal series, for the
 * marginal charts of the Almanac, the Situation Room's sparklines and the
 * Terrarium's tags. Each demo world restarts its series when a new world
 * begins, so a line never jumps from one world's end into another's start.
 */
import type { DemoFrame, SignalDef } from '@one-more-year/kit';

export interface LiveSeries {
  /** Values per signal id, oldest first, the newest last. */
  values: Readonly<Record<string, readonly number[]>>;
  turn: number;
  cycle: number;
  /** The last frame, for tone and events. */
  frame: DemoFrame | null;
}

export function createLiveSeries(signals: readonly SignalDef[], keep = 16) {
  let series: LiveSeries = { values: {}, turn: 0, cycle: -1, frame: null };
  return {
    push(frame: DemoFrame): LiveSeries {
      const fresh = frame.cycle !== series.cycle;
      const values: Record<string, number[]> = {};
      for (const signal of signals) {
        const previous = fresh ? [] : [...(series.values[signal.id] ?? [])];
        previous.push(frame.signals[signal.id] ?? 0);
        values[signal.id] = previous.slice(-keep);
      }
      series = { values, turn: frame.turn, cycle: frame.cycle, frame };
      return series;
    },
    current: () => series,
  };
}

/** The change since the previous turn, or null on the first turn of a world. */
export function lastChange(values: readonly number[] | undefined): number | null {
  if (!values || values.length < 2) return null;
  return (values.at(-1) ?? 0) - (values.at(-2) ?? 0);
}
