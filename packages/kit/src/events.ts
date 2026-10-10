/**
 * The typed event log that every turn report and chronicle is built from.
 *
 * An engine never writes prose. It emits events: a kind ("harvest",
 * "plague"), a severity, the numbers involved, and optionally the codex
 * phenomenon it reveals. The simulation's presentation layer owns one text
 * function per kind, so the words can change (or be translated) without
 * touching the model, and a report can never claim something the numbers do
 * not say.
 */

export type Severity = 'good' | 'neutral' | 'warning' | 'disaster';

/** How a whole turn felt, for the chronicle's timeline strip. */
export type TurnTone = 'good' | 'quiet' | 'hard' | 'disaster';

export interface SimEvent {
  /** Simulation-defined kind, such as 'harvest' or 'plague'. */
  kind: string;
  severity: Severity;
  /** The numbers involved, by name; text functions read them. */
  numbers: Readonly<Record<string, number>>;
  /** A codex entry this event reveals, if any. */
  codex?: string;
  /**
   * How much the event matters, from 0 (routine) upwards. Reports lead with
   * the heaviest event; chronicles pick key moments by it.
   */
  weight: number;
  /** For hot-seat simulations: whose realm the event happened in (0-based). */
  seat?: number;
}

export interface EventExtras {
  codex?: string;
  weight?: number;
  seat?: number;
}

const DEFAULT_WEIGHT: Record<Severity, number> = {
  good: 1,
  neutral: 0.5,
  warning: 2,
  disaster: 4,
};

export function event(
  kind: string,
  severity: Severity,
  numbers: Record<string, number> = {},
  extras: EventExtras = {},
): SimEvent {
  const created: SimEvent = {
    kind,
    severity,
    numbers,
    weight: extras.weight ?? DEFAULT_WEIGHT[severity],
  };
  if (extras.codex !== undefined) created.codex = extras.codex;
  if (extras.seat !== undefined) created.seat = extras.seat;
  return created;
}

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  good: 1,
  neutral: 0,
  warning: 2,
  disaster: 3,
};

/** One disaster makes a disaster year; warnings make it hard; good news makes it good. */
export function toneOf(events: readonly SimEvent[]): TurnTone {
  if (events.some((e) => e.severity === 'disaster')) return 'disaster';
  if (events.some((e) => e.severity === 'warning')) return 'hard';
  if (events.some((e) => e.severity === 'good')) return 'good';
  return 'quiet';
}

/** The event a report should lead with: the heaviest, worse news first on ties. */
export function headlineOf(events: readonly SimEvent[]): SimEvent | undefined {
  let best: SimEvent | undefined;
  for (const candidate of events) {
    if (
      !best ||
      candidate.weight > best.weight ||
      (candidate.weight === best.weight &&
        SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[best.severity])
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Events sorted for a report: heaviest first, the engine's order kept on ties. */
export function byWeight(events: readonly SimEvent[]): SimEvent[] {
  return events
    .map((e, index) => ({ e, index }))
    .sort((a, b) => b.e.weight - a.e.weight || a.index - b.index)
    .map(({ e }) => e);
}

/** One sentence per event kind, written by the simulation in its own words. */
export type EventText = Readonly<Record<string, (event: SimEvent) => string>>;

export function describeEvent(text: EventText, e: SimEvent): string {
  const write = text[e.kind];
  return write ? write(e) : e.kind;
}

/** A number from an event, or 0 when the engine did not record it. */
export function numberOf(e: SimEvent, name: string): number {
  return e.numbers[name] ?? 0;
}
