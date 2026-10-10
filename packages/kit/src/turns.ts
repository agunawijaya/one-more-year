/**
 * The turn cycle every simulation shares:
 *
 *   plan → commit → resolve → report → plan → … → over
 *
 * - plan: the player edits a draft of decisions; it can change freely and is
 *   validated live (errors block the commit, warnings only advise);
 * - commit: the simulation's own verb, such as "End the year";
 * - resolve: a pure engine step from state + plan + that step's random stream;
 * - report: what happened, as structured events (see events.ts).
 *
 * There is no undo after a commit, by design: the simulation says so clearly
 * before the player commits. Every step is recorded as {turn, plan, events,
 * signals}, and because the random stream of step n is derived from the seed
 * and n alone, `replayPlans` rebuilds any run exactly from its seed and plans.
 * Ghosts, chronicles and the daily scenario all rest on that guarantee.
 */
import { toneOf, type SimEvent, type TurnTone } from './events.ts';
import { createRng, type Rng } from './rng.ts';

/** A world's headline numbers by signal id (see the manifest's `signals`). */
export type Signals = Readonly<Record<string, number>>;

export interface WorldSetup {
  seed: number;
  /** A scenario id from the manifest; the simulation decides what it changes. */
  scenario: string;
  /** Hot-seat players; 1 for solo simulations. */
  seats: number;
}

export interface PlanIssue {
  /** The plan field the issue is about, so the interface can mark that control. */
  field?: string;
  message: string;
  /** Errors block the commit; warnings are advice the player may overrule. */
  level: 'error' | 'warning';
}

export interface Verdict {
  id: string;
  label: string;
  /** 1 (worst) to 5 (best); the Library sorts by it and stats keep the best. */
  tier: number;
}

export interface Outcome {
  /** Simulation-defined ending, such as 'term-complete' or 'deposed'. */
  ending: string;
  verdict: Verdict;
}

export interface Position {
  /** 1-based turn number (the year, season… the manifest's turnUnit). */
  turn: number;
  /** 0-based seat whose decisions are being planned. */
  seat: number;
}

export interface Resolution<State> {
  state: State;
  events: SimEvent[];
}

/**
 * What a simulation's engine provides. Every function must be pure: no
 * clock, no DOM, no Math.random, no mutation of its arguments. State and
 * Plan must survive JSON (they are saved after every turn).
 */
export interface TurnModel<State, Plan> {
  init(setup: WorldSetup): State;
  /** The decisions the plan screen opens with for whoever acts next. */
  draft(state: State): Plan;
  validate(state: State, plan: Plan): PlanIssue[];
  resolve(state: State, plan: Plan, rng: Rng): Resolution<State>;
  signals(state: State, seat: number): Signals;
  position(state: State): Position;
  /** Null while the run goes on. */
  outcome(state: State): Outcome | null;
}

export interface TurnRecord<Plan> {
  /** 0-based count of commits in this run. */
  step: number;
  turn: number;
  seat: number;
  plan: Plan;
  events: SimEvent[];
  /** The acting seat's signals after the step resolved. */
  signals: Signals;
  tone: TurnTone;
}

export type Phase = 'plan' | 'report' | 'over';

/** The random stream of one step. Derived, never carried over, so replays cannot drift. */
export function rngForStep(seed: number, step: number): Rng {
  return createRng(seed).fork(`step:${step}`);
}

/** One pure step: what the engine does on "End the year", without any bookkeeping. */
export function resolveStep<State, Plan>(
  model: TurnModel<State, Plan>,
  state: State,
  plan: Plan,
  seed: number,
  step: number,
): { state: State; record: TurnRecord<Plan> } {
  const { turn, seat } = model.position(state);
  const { state: next, events } = model.resolve(state, plan, rngForStep(seed, step));
  return {
    state: next,
    record: {
      step,
      turn,
      seat,
      plan,
      events,
      signals: model.signals(next, seat),
      tone: toneOf(events),
    },
  };
}

/** Rebuilds a run from its setup and the plans that were committed, step by step. */
export function replayPlans<State, Plan>(
  model: TurnModel<State, Plan>,
  setup: WorldSetup,
  plans: readonly Plan[],
): { state: State; history: TurnRecord<Plan>[] } {
  let state = model.init(setup);
  const history: TurnRecord<Plan>[] = [];
  plans.forEach((plan, step) => {
    const resolved = resolveStep(model, state, plan, setup.seed, step);
    state = resolved.state;
    history.push(resolved.record);
  });
  return { state, history };
}

/** Everything needed to carry a run across a page reload. */
export interface EngineSnapshot<State, Plan> {
  setup: WorldSetup;
  state: State;
  history: TurnRecord<Plan>[];
  /** Each seat's signals before the first turn, so charts start at the beginning. */
  opening: Signals[];
  /** A plan the player chose to keep while leaving, or null. */
  draft: Plan | null;
}

export interface TurnEngine<State, Plan> {
  readonly setup: WorldSetup;
  readonly state: State;
  readonly phase: Phase;
  readonly draft: Plan;
  /** True when the draft differs from the plan the screen opened with. */
  readonly draftEdited: boolean;
  readonly history: readonly TurnRecord<Plan>[];
  readonly opening: readonly Signals[];
  readonly position: Position;
  readonly outcome: Outcome | null;
  /** The step just resolved, while its report is showing. */
  readonly lastRecord: TurnRecord<Plan> | null;
  setDraft(plan: Plan): void;
  resetDraft(): void;
  issues(): PlanIssue[];
  canCommit(): boolean;
  /** Resolves the draft. Throws if the plan has errors or the phase is not 'plan'. */
  commit(): TurnRecord<Plan>;
  /** Leaves the report: on to the next plan, or to 'over' when the run has ended. */
  proceed(): void;
  snapshot(options?: { keepDraft?: boolean }): EngineSnapshot<State, Plan>;
  subscribe(listener: () => void): () => void;
}

export type EngineStart<State, Plan> =
  { setup: WorldSetup } | { snapshot: EngineSnapshot<State, Plan> };

export function createTurnEngine<State, Plan>(
  model: TurnModel<State, Plan>,
  start: EngineStart<State, Plan>,
): TurnEngine<State, Plan> {
  const restored = 'snapshot' in start ? start.snapshot : null;
  const setup = restored?.setup ?? (start as { setup: WorldSetup }).setup;
  let state = restored?.state ?? model.init(setup);
  const history: TurnRecord<Plan>[] = restored ? [...restored.history] : [];
  const opening: Signals[] =
    restored?.opening ??
    Array.from({ length: Math.max(1, setup.seats) }, (_, seat) => model.signals(state, seat));
  let outcome = model.outcome(state);
  // A reload always lands on a plan screen (or the ending), never mid-report.
  let phase: Phase = outcome ? 'over' : 'plan';
  let openingDraft = model.draft(state);
  let draft = restored?.draft ?? openingDraft;
  let lastRecord: TurnRecord<Plan> | null = null;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const engine: TurnEngine<State, Plan> = {
    setup,
    get state() {
      return state;
    },
    get phase() {
      return phase;
    },
    get draft() {
      return draft;
    },
    get draftEdited() {
      return JSON.stringify(draft) !== JSON.stringify(openingDraft);
    },
    history,
    opening,
    get position() {
      return model.position(state);
    },
    get outcome() {
      return outcome;
    },
    get lastRecord() {
      return lastRecord;
    },

    setDraft(plan) {
      if (phase !== 'plan') throw new Error(`Cannot edit the plan during '${phase}'`);
      draft = plan;
      notify();
    },

    resetDraft() {
      draft = openingDraft;
      notify();
    },

    issues: () => model.validate(state, draft),

    canCommit: () => phase === 'plan' && !engine.issues().some((issue) => issue.level === 'error'),

    commit() {
      if (phase !== 'plan') throw new Error(`Cannot commit during '${phase}'`);
      const blocking = engine.issues().filter((issue) => issue.level === 'error');
      if (blocking.length > 0) {
        throw new Error(`The plan has problems: ${blocking.map((i) => i.message).join('; ')}`);
      }
      const resolved = resolveStep(model, state, draft, setup.seed, history.length);
      state = resolved.state;
      history.push(resolved.record);
      lastRecord = resolved.record;
      outcome = model.outcome(state);
      phase = 'report';
      notify();
      return resolved.record;
    },

    proceed() {
      if (phase !== 'report') return;
      lastRecord = null;
      if (outcome) {
        phase = 'over';
      } else {
        phase = 'plan';
        openingDraft = model.draft(state);
        draft = openingDraft;
      }
      notify();
    },

    snapshot(options = {}) {
      return {
        setup,
        state,
        history: [...history],
        opening,
        draft: options.keepDraft && phase === 'plan' ? draft : null,
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return engine;
}

/** The committed plans of a history, in order: with the setup, all a replay needs. */
export function plansOf<Plan>(history: readonly TurnRecord<Plan>[]): Plan[] {
  return history.map((record) => record.plan);
}

/** One signal's values across a run, starting with the opening value. */
export function seriesOf(
  signal: string,
  opening: Signals,
  history: readonly { signals: Signals; seat?: number }[],
  seat = 0,
): number[] {
  return [
    opening[signal] ?? 0,
    ...history
      .filter((record) => (record.seat ?? 0) === seat)
      .map((record) => record.signals[signal] ?? 0),
  ];
}
