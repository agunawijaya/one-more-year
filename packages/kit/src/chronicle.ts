/**
 * Chronicles: every finished run becomes a page of history.
 *
 * A chronicle is built once, when the run ends, from the run's recorded
 * history. It keeps the words as they were written that day (each turn's
 * headline, the key moments, the epithet) so it stays readable even if the
 * simulation's texts change later, and it keeps the seed and scenario so the
 * same world can be replayed with the old run drawn as a ghost.
 *
 * Epithets are rules over the history ("never ended a year with less grain
 * than it began") that each simulation writes in its own words; the first
 * rule that holds, by priority, names the player's tenure. If none holds,
 * a fallback chosen from the run's overall tone does.
 */
import {
  describeEvent,
  headlineOf,
  type EventText,
  type SimEvent,
  type TurnTone,
} from './events.ts';
import { seriesOf, type Outcome, type Signals, type TurnRecord, type WorldSetup } from './turns.ts';
import type { DailyTag } from './runs.ts';

export const CHRONICLE_VERSION = 1;

export interface ChronicleTurn {
  turn: number;
  seat: number;
  tone: TurnTone;
  /** The turn's headline event in words, as written when the run ended. */
  headline: string;
  /** The simulation's glyph for this turn in share strings. */
  glyph: string;
}

export type KeyMomentKind = 'biggest-swing' | 'worst-survived' | 'best-turn' | 'hardest-turn';

export interface KeyMoment {
  kind: KeyMomentKind;
  turn: number;
  text: string;
  /** The primary signal's change that turn, if it is the point of the moment. */
  delta: number | null;
}

export interface ChronicleEntry {
  v: number;
  id: string;
  simId: string;
  runId: string;
  setup: WorldSetup;
  scenarioTitle: string;
  daily: DailyTag | null;
  /** The chronicle this run replayed, if it was a second chance at the same world. */
  replayOf: string | null;
  startedAt: number;
  finishedAt: number;
  turnUnit: string;
  turns: number;
  title: string;
  epithet: { id: string; text: string };
  outcome: Outcome;
  timeline: ChronicleTurn[];
  keyMoments: KeyMoment[];
  /** Each signal across the run, opening value first (seat 0 in hot-seat runs). */
  series: Record<string, number[]>;
  finalSignals: Signals;
  /** The primary signal: the one key moments and sparklines follow. */
  primarySignal: string;
  /** The share string, built by the simulation's daily glyph rules. */
  share: string;
  seatNames: string[];
}

/** A read-only view of a finished run for epithet rules and title lines. */
export interface RunHistory {
  readonly records: readonly TurnRecord<unknown>[];
  readonly outcome: Outcome;
  readonly setup: WorldSetup;
  /** One signal's values, opening value first. */
  series(signal: string): number[];
  first(signal: string): number;
  final(signal: string): number;
  /** How many events of this kind happened. */
  count(kind: string): number;
  /** True if every turn satisfies the predicate. */
  everyTurn(predicate: (record: TurnRecord<unknown>) => boolean): boolean;
  /** True if the signal never fell from one turn to the next. */
  neverFell(signal: string): boolean;
  tones(): TurnTone[];
}

export interface EpithetRule {
  id: string;
  text: string;
  /** Higher wins when several rules hold (default 0). */
  priority?: number;
  when: (history: RunHistory) => boolean;
}

/** Our fallbacks, by the overall feel of the run, used when no simulation rule holds. */
export const FALLBACK_EPITHETS: Readonly<Record<'calm' | 'mixed' | 'stormy', EpithetRule>> = {
  calm: { id: 'fallback-calm', text: 'Keeper of the Even Keel', when: () => true },
  mixed: { id: 'fallback-mixed', text: 'Who Weathered the Turning Years', when: () => true },
  stormy: { id: 'fallback-stormy', text: 'Who Held On Through the Storms', when: () => true },
};

export function createRunHistory(
  setup: WorldSetup,
  opening: Signals,
  records: readonly TurnRecord<unknown>[],
  outcome: Outcome,
): RunHistory {
  const view: RunHistory = {
    records,
    outcome,
    setup,
    series: (signal) => seriesOf(signal, opening, records),
    first: (signal) => opening[signal] ?? 0,
    final: (signal) => view.series(signal).at(-1) ?? 0,
    count: (kind) =>
      records.reduce((sum, r) => sum + r.events.filter((e) => e.kind === kind).length, 0),
    everyTurn: (predicate) => records.every(predicate),
    neverFell(signal) {
      const values = view.series(signal);
      return values.every((value, i) => i === 0 || value >= (values[i - 1] ?? value));
    },
    tones: () => records.map((r) => r.tone),
  };
  return view;
}

export function pickEpithet(rules: readonly EpithetRule[], history: RunHistory): EpithetRule {
  const holding = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.when(history))
    .sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || a.index - b.index);
  if (holding[0]) return holding[0].rule;
  const tones = history.tones();
  const rough = tones.filter((tone) => tone === 'hard' || tone === 'disaster').length;
  if (rough === 0) return FALLBACK_EPITHETS.calm;
  return rough / Math.max(1, tones.length) > 0.4
    ? FALLBACK_EPITHETS.stormy
    : FALLBACK_EPITHETS.mixed;
}

/**
 * Picks up to three distinct turns that tell the run's story: the worst
 * disaster the world came through, the biggest swing of the primary signal
 * and the best turn. When two of them would name the same turn, the next
 * best turn of that kind is taken instead, and a run with no disaster gets
 * its hardest turn, so every chronicle of three or more turns has at least
 * two moments to tell.
 */
export function pickKeyMoments(
  records: readonly TurnRecord<unknown>[],
  primary: number[],
  text: EventText,
  outcome: Outcome,
): KeyMoment[] {
  const deltaAt = (index: number): number => (primary[index + 1] ?? 0) - (primary[index] ?? 0);
  const relative = (index: number): number =>
    deltaAt(index) / Math.max(1, Math.abs(primary[index] ?? 0));
  const weightOf = (record: TurnRecord<unknown>, severities: readonly string[]): number =>
    record.events
      .filter((e) => severities.includes(e.severity))
      .reduce((sum, e) => sum + e.weight, 0);

  const scores: Record<KeyMomentKind, (record: TurnRecord<unknown>, index: number) => number> = {
    'worst-survived': (record, index) => {
      const survived = index < records.length - 1 || outcome.verdict.tier > 1;
      const disaster = record.events
        .filter((e: SimEvent) => e.severity === 'disaster')
        .reduce((max, e) => Math.max(max, e.weight), 0);
      return survived ? disaster : 0;
    },
    'biggest-swing': (_, index) => Math.abs(relative(index)),
    'best-turn': (record, index) =>
      weightOf(record, ['good']) -
      weightOf(record, ['warning', 'disaster']) +
      Math.max(0, relative(index)),
    'hardest-turn': (record, index) =>
      weightOf(record, ['warning', 'disaster']) + Math.max(0, -relative(index)),
  };
  const deltas: Record<KeyMomentKind, boolean> = {
    'worst-survived': false,
    'biggest-swing': true,
    'best-turn': true,
    'hardest-turn': true,
  };

  const used = new Set<number>();
  const moments: KeyMoment[] = [];
  const order: KeyMomentKind[] = ['worst-survived', 'biggest-swing', 'best-turn', 'hardest-turn'];
  for (const kind of order) {
    if (moments.length >= 3) break;
    // The hardest turn only fills in when the story would otherwise be too short.
    if (kind === 'hardest-turn' && moments.length >= 2) break;
    const ranked = records
      .map((record, index) => ({ record, index, score: scores[kind](record, index) }))
      .filter((candidate) => candidate.score > 0 && !used.has(candidate.index))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const pick = ranked[0];
    if (!pick) continue;
    used.add(pick.index);
    const headline = headlineOf(pick.record.events);
    moments.push({
      kind,
      turn: pick.record.turn,
      text: headline ? describeEvent(text, headline) : '',
      delta: deltas[kind] ? deltaAt(pick.index) : null,
    });
  }
  return moments.sort((a, b) => a.turn - b.turn);
}

export interface ChronicleInput {
  id: string;
  simId: string;
  runId: string;
  setup: WorldSetup;
  scenarioTitle: string;
  daily: DailyTag | null;
  replayOf: string | null;
  startedAt: number;
  finishedAt: number;
  turnUnit: string;
  opening: readonly Signals[];
  history: readonly TurnRecord<unknown>[];
  outcome: Outcome;
  signalIds: readonly string[];
  primarySignal: string;
  text: EventText;
  epithets: readonly EpithetRule[];
  /** The chronicle's title line, e.g. "Ten years on the river plain". */
  title: (history: RunHistory) => string;
  /** One share glyph per turn. */
  glyph: (record: TurnRecord<unknown>) => string;
  /** The headline numbers for the share string, e.g. "Fed 100% · Land +40%". */
  shareLine: (history: RunHistory) => string;
  shareString: (glyphs: string[], line: string, epithet: string) => string;
  seatNames?: readonly string[];
}

export function buildChronicle(input: ChronicleInput): ChronicleEntry {
  const opening = input.opening[0] ?? {};
  const history = createRunHistory(input.setup, opening, input.history, input.outcome);
  const epithet = pickEpithet(input.epithets, history);
  const series = Object.fromEntries(
    input.signalIds.map((signal) => [signal, seriesOf(signal, opening, input.history)]),
  );
  const timeline = input.history.map((record) => {
    const headline = headlineOf(record.events);
    return {
      turn: record.turn,
      seat: record.seat,
      tone: record.tone,
      headline: headline ? describeEvent(input.text, headline) : '',
      glyph: input.glyph(record),
    };
  });
  const finalSignals = Object.fromEntries(
    input.signalIds.map((signal) => [signal, series[signal]?.at(-1) ?? 0]),
  );
  return {
    v: CHRONICLE_VERSION,
    id: input.id,
    simId: input.simId,
    runId: input.runId,
    setup: input.setup,
    scenarioTitle: input.scenarioTitle,
    daily: input.daily,
    replayOf: input.replayOf,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    turnUnit: input.turnUnit,
    turns: input.history.at(-1)?.turn ?? 0,
    title: input.title(history),
    epithet: { id: epithet.id, text: epithet.text },
    outcome: input.outcome,
    timeline,
    keyMoments: pickKeyMoments(
      input.history,
      series[input.primarySignal] ?? [],
      input.text,
      input.outcome,
    ),
    series,
    finalSignals,
    primarySignal: input.primarySignal,
    share: input.shareString(
      timeline.map((turn) => turn.glyph),
      input.shareLine(history),
      epithet.text,
    ),
    seatNames: [...(input.seatNames ?? [])],
  };
}

/** JSON with keys in sorted order at every level, so the same chronicle always serialises the same. */
export function serializeChronicle(entry: ChronicleEntry): string {
  return JSON.stringify(sortKeys(entry));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function parseChronicle(text: string): ChronicleEntry | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const entry = data as Partial<ChronicleEntry>;
  const valid =
    entry.v === CHRONICLE_VERSION &&
    typeof entry.id === 'string' &&
    typeof entry.simId === 'string' &&
    typeof entry.setup?.seed === 'number' &&
    Array.isArray(entry.timeline) &&
    typeof entry.series === 'object' &&
    typeof entry.epithet?.text === 'string' &&
    typeof entry.outcome?.verdict.tier === 'number';
  return valid ? (entry as ChronicleEntry) : null;
}
