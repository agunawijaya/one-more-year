/**
 * The play session: everything around a simulation's model that should work
 * the same in every simulation, so no simulation has to get it right alone.
 *
 * Given the model and a few presentation rules, a session
 * - begins, resumes, replays or opens the daily world as the launch asks;
 * - autosaves after every resolved turn and when the page hides (keeping a
 *   half-edited plan as a draft), so leaving is always safe; a run left
 *   before its first turn with nothing kept is discarded, so a quick look
 *   never clutters the Continue list;
 * - reports each turn to the Hall and records codex sightings;
 * - offers stable, honest forecasts of the current plan;
 * - draws on the ghost of the replayed run ("last time: …");
 * - and when the run ends, writes its chronicle, checks the automatic
 *   milestones and hands the chronicle to the Hall.
 *
 * The simulation keeps full control of its screens: it calls `commit` when
 * the player ends the turn and `proceed` when they leave the report.
 */
import type { ChronicleEntry, EpithetRule, RunHistory } from './chronicle.ts';
import { buildChronicle, createRunHistory } from './chronicle.ts';
import type { Discovery } from './codex.ts';
import type { AutoMilestoneDef, Launch, SimContext } from './contract.ts';
import { shareString } from './daily.ts';
import type { EventText } from './events.ts';
import {
  forecastMany,
  forecastSeed,
  type Forecast,
  type ForecastOptions,
  type Measure,
} from './forecast.ts';
import { formatTurn } from './format.ts';
import { randomSeed } from './rng.ts';
import { autosaveOnHide, newRunId, type DailyTag, type GhostOf, type RunRecord } from './runs.ts';
import {
  createTurnEngine,
  seriesOf,
  type TurnEngine,
  type TurnModel,
  type TurnRecord,
  type WorldSetup,
} from './turns.ts';

export interface PlayRules<State, Plan> {
  model: TurnModel<State, Plan>;
  text: EventText;
  epithets: readonly EpithetRule[];
  /** The chronicle's title line, e.g. "Eight seasons at Willow Pond". */
  title(history: RunHistory): string;
  /** One share glyph per turn. */
  glyph(record: TurnRecord<Plan>): string;
  /** The headline numbers of the share string, e.g. "Fish 120 · Weed 30%". */
  shareLine(history: RunHistory): string;
  /** Turns in a full run when that is fixed ("Year 6 of 10"); null when open-ended. */
  length(state: State): number | null;
  /** The scenario a daily world uses; may pick a twist from the seed. */
  dailyScenario?(seed: number): string;
  /** Milestones the session checks by itself (the rest the simulation unlocks). */
  milestones?: readonly AutoMilestoneDef[];
  /** 'game' when the simulation shows its own end screen before the chronicle. */
  presentation?: 'hall' | 'game';
}

export interface PlaySession<State, Plan> {
  readonly engine: TurnEngine<State, Plan>;
  readonly runId: string;
  readonly ghost: GhostOf | null;
  readonly daily: DailyTag | null;
  /** Codex sightings from the latest commit, for the report's "New in your Codex" card. */
  readonly discoveries: readonly Discovery[];
  /** "Year 6 of 10". */
  readonly turnLabel: string;
  /** The ghost run's value of a signal at the same point (the turn just reported). */
  lastTime(signal: string): number | null;
  /** The ghost's whole series for a signal, for charts. */
  ghostSeries(signal: string): readonly number[] | null;
  /** Honest previews of the current draft (see forecast.ts). */
  forecast<Key extends string>(
    measures: Readonly<Record<Key, Measure<State>>>,
    options?: Omit<ForecastOptions, 'seed'>,
  ): Record<Key, Forecast>;
  commit(): TurnRecord<Plan>;
  /** Leaves the report; returns the chronicle when that was the last turn. */
  proceed(): ChronicleEntry | null;
  /** The chronicle, once the run is over. */
  readonly chronicle: ChronicleEntry | null;
  keepDraft(): void;
  leaveCheck(): 'safe' | 'would-lose-progress';
  save(): void;
  dispose(): void;
}

type PlayLaunch = Exclude<Launch, { kind: 'menu' }>;

export function startPlay<State, Plan>(
  ctx: SimContext,
  rules: PlayRules<State, Plan>,
  launch: PlayLaunch,
): PlaySession<State, Plan> {
  const { manifest } = ctx;
  const defaultScenario = manifest.scenarios[0]?.id ?? 'standard';
  const primary = manifest.primarySignal ?? manifest.signals[0]?.id ?? '';
  const signalIds = manifest.signals.map((signal) => signal.id);

  const run = openRun();
  const engine = createTurnEngine(rules.model, { snapshot: run.snapshot });
  let discoveries: Discovery[] = [];
  let chronicle: ChronicleEntry | null = null;
  let savedDraft = JSON.stringify(engine.draft);
  let clock = ctx.now();

  function openRun(): RunRecord<State, Plan> {
    if (launch.kind === 'resume') {
      const stored = ctx.runs.get(launch.runId) as RunRecord<State, Plan> | null;
      if (stored) return stored;
      throw new Error(`No saved run ${launch.runId} for ${manifest.id}`);
    }
    let setup: WorldSetup;
    let daily: DailyTag | null = null;
    let replayOf: GhostOf | null = null;
    if (launch.kind === 'daily') {
      setup = {
        seed: ctx.daily.seed,
        scenario: rules.dailyScenario?.(ctx.daily.seed) ?? defaultScenario,
        seats: 1,
      };
      daily = { day: ctx.daily.day, number: ctx.daily.number };
      ctx.markDailyPlayed();
    } else if (launch.kind === 'replay') {
      setup = { ...launch.chronicle.setup };
      daily = launch.chronicle.daily;
      replayOf = {
        chronicleId: launch.chronicle.id,
        series: launch.chronicle.series,
        verdictLabel: launch.chronicle.outcome.verdict.label,
      };
    } else {
      setup = {
        seed: randomSeed(),
        scenario: launch.scenario ?? defaultScenario,
        seats: launch.seats,
      };
    }
    // Runs only looked at (a reload in the first instant, a Begin and straight back) go now.
    ctx.runs.clearUntouched();
    const fresh = createTurnEngine(rules.model, { setup });
    const now = ctx.now();
    const record: RunRecord<State, Plan> = {
      id: newRunId(now),
      simId: manifest.id,
      setup,
      daily,
      replayOf,
      status: 'in-progress',
      createdAt: now,
      updatedAt: now,
      turnLabel: labelFor(fresh),
      signals: fresh.opening[0] ?? {},
      spark: [fresh.opening[0]?.[primary] ?? 0],
      playedMs: 0,
      touched: false,
      snapshot: fresh.snapshot(),
    };
    ctx.runs.save(record);
    return record;
  }

  function labelFor(target: TurnEngine<State, Plan>): string {
    if (target.outcome) return 'Finished';
    return formatTurn(manifest.turnUnit, target.position.turn, rules.length(target.state));
  }

  function save(keepDraft = false): void {
    if (chronicle) return;
    const now = ctx.now();
    run.playedMs += Math.max(0, now - clock);
    clock = now;
    run.updatedAt = now;
    // Only a plan the player actually changed is worth keeping as a draft.
    const keep = keepDraft && engine.draftEdited;
    run.touched = run.touched !== false || engine.history.length > 0 || keep;
    run.snapshot = engine.snapshot({ keepDraft: keep });
    run.turnLabel = labelFor(engine);
    run.signals =
      engine.history.filter((r) => r.seat === 0).at(-1)?.signals ?? engine.opening[0] ?? {};
    run.spark = seriesOf(primary, engine.opening[0] ?? {}, engine.history);
    ctx.runs.save(run);
    if (keepDraft) savedDraft = JSON.stringify(engine.draft);
  }

  function checkCodexMilestones(): void {
    const { discovered, total } = ctx.codex.progress();
    for (const def of rules.milestones ?? []) {
      if (def.codexDiscovered === undefined) continue;
      const target = def.codexDiscovered === 'all' ? total : def.codexDiscovered;
      if (discovered >= target) ctx.milestones.unlock(def.id);
      else ctx.milestones.progress(def.id, discovered);
    }
  }

  function finish(): ChronicleEntry {
    const outcome = engine.outcome;
    if (!outcome) throw new Error('The run has not ended');
    const finishedAt = ctx.now();
    const scenario = manifest.scenarios.find((s) => s.id === run.setup.scenario);
    const entry = buildChronicle({
      id: `c-${run.id}`,
      simId: manifest.id,
      runId: run.id,
      setup: run.setup,
      scenarioTitle: scenario?.title ?? run.setup.scenario,
      daily: run.daily,
      replayOf: run.replayOf?.chronicleId ?? null,
      startedAt: run.createdAt,
      finishedAt,
      turnUnit: manifest.turnUnit,
      opening: engine.opening,
      history: engine.history,
      outcome,
      signalIds,
      primarySignal: primary,
      text: rules.text,
      epithets: rules.epithets,
      title: (history) => rules.title(history),
      glyph: (record) => rules.glyph(record as TurnRecord<Plan>),
      shareLine: (history) => rules.shareLine(history),
      shareString: (glyphs, line, epithet) =>
        shareString({
          simTitle: manifest.title,
          dailyNumber: run.daily?.number ?? null,
          glyphs,
          line,
          epithet,
        }),
    });
    const history = createRunHistory(run.setup, engine.opening[0] ?? {}, engine.history, outcome);
    for (const def of rules.milestones ?? []) {
      if (def.atRunEnd?.(history)) ctx.milestones.unlock(def.id);
    }
    ctx.codex.linkChronicle(run.id, entry.id);
    ctx.runs.finish(run.id);
    stopAutosave();
    ctx.reportRun({ chronicle: entry, presentation: rules.presentation ?? 'hall' });
    return entry;
  }

  const stopAutosave = autosaveOnHide(() => save(true));

  const session: PlaySession<State, Plan> = {
    engine,
    runId: run.id,
    ghost: run.replayOf,
    daily: run.daily,
    get discoveries() {
      return discoveries;
    },
    get turnLabel() {
      return labelFor(engine);
    },
    get chronicle() {
      return chronicle;
    },

    lastTime(signal) {
      const series = run.replayOf?.series[signal];
      const index = engine.history.filter((r) => r.seat === 0).length;
      return series?.[index] ?? null;
    },

    ghostSeries: (signal) => run.replayOf?.series[signal] ?? null,

    forecast(measures, options = {}) {
      return forecastMany(rules.model, engine.state, engine.draft, measures, {
        ...options,
        seed: forecastSeed(run.setup.seed, engine.history.length),
      });
    },

    commit() {
      const record = engine.commit();
      discoveries = record.events
        .map((e) => (e.codex ? ctx.codex.sight(e.codex, run.id) : null))
        .filter((found): found is Discovery => found !== null);
      if (discoveries.length > 0) checkCodexMilestones();
      save();
      ctx.reportTurn({
        runId: run.id,
        record: record,
        turnLabel: labelFor(engine),
        signals: record.signals,
        discoveries,
      });
      return record;
    },

    proceed() {
      engine.proceed();
      savedDraft = JSON.stringify(engine.draft);
      if (engine.phase === 'over' && !chronicle) chronicle = finish();
      return chronicle;
    },

    keepDraft: () => save(true),

    leaveCheck() {
      if (engine.phase !== 'plan') return 'safe';
      return JSON.stringify(engine.draft) === savedDraft ? 'safe' : 'would-lose-progress';
    },

    save: () => save(),

    dispose() {
      stopAutosave();
      // A run left before its first turn, with no plan kept, was only a look: let it go.
      if (!chronicle && run.touched === false) ctx.runs.abandon(run.id);
    },
  };

  // A run saved just after its last turn but before its ending was shown finishes now.
  if (engine.phase === 'over') chronicle = finish();
  return session;
}
