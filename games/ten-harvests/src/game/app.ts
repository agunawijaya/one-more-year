/**
 * Ten Harvests inside the Hall: one city, one renderer, and the screens a
 * run passes through. Menu → plan → the year turns → the scribe's report →
 * plan … → the stele (or the council at dusk) → the Hall's chronicle page.
 *
 * The kit's play session does the saving, reporting and chronicling; this
 * file decides what the player sees next. The run's results are reported
 * with presentation 'game', and once the stele is carved the player is
 * handed over to the chronicle page (ADR-0008).
 */
import {
  createRunHistory,
  formatNumber,
  pickEpithet,
  startPlay,
  type ChronicleEntry,
  type Launch,
  type PlaySession,
  type SimContext,
  type SimInstance,
  type TurnRecord,
} from '@one-more-year/kit';
import { cityModel, grainAfterDecree, lengthOf, peopleFedBy } from '../engine/model.ts';
import { VERDICTS, type VerdictId } from '../engine/judge.ts';
import { rulesFor } from '../engine/rules.ts';
import type { CityState, Decree } from '../engine/state.ts';
import { EPITHETS, MILESTONES } from '../content/legacy.ts';
import { EVENT_TEXT, VERDICT_LINES, glyphFor, shareLineFor, titleFor } from '../content/text.ts';
import type { CameraPose } from '../scene/view.ts';
import { createCityView, PLAN_POSE } from '../scene/view.ts';
import { createCityWorld } from '../scene/world.ts';
import { stelePlan } from '../stele/from-history.ts';
import { button, el } from '../ui/dom.ts';
import '../ui/ten-harvests.css';
import '../ui/screens.css';
import { optionStore } from './options.ts';
import { onKeyPress } from './keys.ts';
import { createPlanController, termTiles, type PlanController } from './plan-controller.ts';
import { runCoach } from './screens/coach.ts';
import { runConsole, type ConsoleRun } from './screens/console.ts';
import { runStele } from './screens/ending.ts';
import { renderMenu } from './screens/menu.ts';
import { renderReport } from './screens/report.ts';
import { renderScenarios } from './screens/scenarios.ts';
import { openCodex, openOptions } from './screens/sheets.ts';
import { runYear } from './screens/turning.ts';
import { defineSounds, PLAIN_WIND, SOUND } from './sound.ts';
import { storyOf } from './story.ts';
import { createPlanScreen } from '../ui/plan-screen.ts';
import { ledgerFor } from '../engine/odds.ts';

type Session = PlaySession<CityState, Decree>;

export const PLAY_RULES = {
  model: cityModel,
  text: EVENT_TEXT,
  epithets: EPITHETS,
  title: titleFor,
  glyph: (record: TurnRecord<Decree>) => glyphFor(record),
  shareLine: shareLineFor,
  length: lengthOf,
  dailyScenario: () => 'classic',
  milestones: MILESTONES,
  presentation: 'game' as const,
};

/** The menu's slow circling view of the city. */
const MENU_POSE: CameraPose = {
  target: { x: 0, y: 2, z: -18 },
  azimuth: 0.7,
  elevation: 0.32,
  distance: 150,
  fov: 34,
};
/** The city after the year, under the report tablet. */
const REPORT_POSE: CameraPose = {
  target: { x: -4, y: 0, z: 6 },
  azimuth: 0.45,
  elevation: 0.5,
  distance: 135,
  fov: 34,
};
/** Dusk over the palace, for a dignified exit. */
const DUSK_POSE: CameraPose = {
  target: { x: 14, y: 6, z: -38 },
  azimuth: 0.55,
  elevation: 0.22,
  distance: 80,
  fov: 36,
};

export function mountTenHarvests(host: HTMLElement, ctx: SimContext): SimInstance {
  const options = optionStore(ctx.settings.sim);
  const root = el('div', { class: 'th', 'data-appearance': ctx.appearance.current });
  const stage = el('div', { class: 'th-stage' });
  const layer = el('div', { class: 'th-layer' });
  root.append(stage, layer);
  host.append(root);

  let appearance = ctx.appearance.current;
  const world = createCityWorld(appearance);
  const view = createCityView(stage, world, {
    quality: options.get('graphics'),
    label: 'The city on the river',
  });
  view.setOrbitEnabled(options.get('orbit'));
  defineSounds(ctx.audio);
  ctx.audio.setAmbience(PLAIN_WIND);

  let session: Session | null = null;
  let leave: (() => void) | null = null;
  let onAppearance: ((next: typeof appearance) => void) | null = null;
  let tourActive = false;
  /** Seconds for the camera to glide to a new view; under reduced motion it cuts. */
  const glide = (seconds: number): number => (ctx.appearance.reducedMotion ? 0 : seconds);

  function calmWind(reduced: boolean): void {
    world.uniforms.uGust.value = reduced ? 0.15 : 1;
  }
  calmWind(ctx.appearance.reducedMotion);

  const stopAppearance = ctx.appearance.subscribe((next, reduced) => {
    appearance = next;
    root.dataset.appearance = next;
    world.setAppearance(next);
    calmWind(reduced);
    onAppearance?.(next);
  });
  const stopOptions = options.subscribe((key) => {
    if (key === 'graphics') view.setQualityCeiling(options.get('graphics'));
    if (key === 'orbit') view.setOrbitEnabled(options.get('orbit'));
  });

  /** Swaps the screen: the previous one tidies up after itself. */
  function screen(name: string, build: () => (() => void) | undefined): void {
    leave?.();
    leave = null;
    onAppearance = null;
    layer.replaceChildren();
    root.dataset.screen = name;
    leave = build() ?? null;
  }

  function scenarioTitle(id: string): string {
    return ctx.manifest.scenarios.find((s) => s.id === id)?.title ?? id;
  }

  // ---- the game menu ---------------------------------------------------------

  function showMenu(): void {
    session?.dispose();
    session = null;
    ctx.setView('menu');
    ctx.setPauseItems([]);
    screen('menu', () => {
      view.attach(stage);
      view.setPose(MENU_POSE, glide(1.5));
      view.setDrift(ctx.appearance.reducedMotion ? 0 : 0.035);
      world.show({
        people: 160,
        grain: 5600,
        acres: 1400,
        planted: 1300,
        season: 1,
        yieldPerAcre: 4,
      });
      layer.append(
        renderMenu(ctx, ctx.runs.list(), {
          classic: () => play({ kind: 'new', scenario: 'classic', seats: 1, seatNames: [] }),
          daily: () => play({ kind: 'daily' }),
          scenarios: showScenarios,
          dynasty: () => play({ kind: 'new', scenario: 'dynasty', seats: 1, seatNames: [] }),
          ledger: () => play({ kind: 'new', scenario: 'ledger-1978', seats: 1, seatNames: [] }),
          resume: (runId) => play({ kind: 'resume', runId }),
          howToPlay: () => ctx.openHowToPlay(),
          codex: () => openCodex(root, ctx),
          options: () => openOptions(root, ctx, options),
        }),
      );
      layer.querySelector<HTMLElement>('[data-action="begin-classic"]')?.focus();
      return () => view.setDrift(0);
    });
  }

  function showScenarios(): void {
    screen('scenarios', () => {
      view.attach(stage);
      view.setDrift(0);
      view.setPose(PLAN_POSE);
      layer.append(
        renderScenarios({
          ctx,
          world,
          view,
          best: (id) => bestVerdicts()[id] ?? null,
          begin: (id) => play({ kind: 'new', scenario: id, seats: 1, seatNames: [] }),
          back: showMenu,
        }),
      );
      layer.querySelector<HTMLElement>('.th-scenario')?.focus();
    });
  }

  function bestVerdicts(): Record<string, string> {
    return ctx.settings.sim.get<Record<string, string>>('best', {});
  }

  function recordBest(chronicle: ChronicleEntry): void {
    const best = { ...bestVerdicts() };
    const scenario = chronicle.setup.scenario;
    const previousTier = Object.values(VERDICTS).find((v) => v.label === best[scenario])?.tier ?? 0;
    if (chronicle.outcome.verdict.tier >= previousTier)
      best[scenario] = chronicle.outcome.verdict.label;
    ctx.settings.sim.set('best', best);
  }

  // ---- playing ---------------------------------------------------------------

  function play(launch: Exclude<Launch, { kind: 'menu' }>): void {
    session?.dispose();
    session = startPlay(ctx, PLAY_RULES, launch);
    if (session.chronicle) {
      ctx.navigate({ results: session.chronicle.id });
      return;
    }
    tourActive =
      launch.kind === 'new' && launch.scenario === 'classic' && !options.get('tutorialDone');
    showPlan();
  }

  function pauseItems(current: Session): void {
    ctx.setPauseItems([
      ...(current.engine.state.ruleSet === '1978'
        ? []
        : [{ id: 'console', label: 'Scribe’s console', onSelect: () => openConsole(current) }]),
      { id: 'codex', label: 'Codex', onSelect: () => openCodex(root, ctx) },
      {
        id: 'options',
        label: 'Ten Harvests options',
        onSelect: () => openOptions(root, ctx, options),
      },
    ]);
  }

  function showPlan(): void {
    const current = session;
    if (!current) return;
    ctx.setView('plan', current.runId);
    pauseItems(current);
    if (current.engine.state.ruleSet === '1978') {
      showLedgerPlan(current);
      return;
    }
    screen('plan', () => {
      const plan: PlanController = createPlanController({
        ctx,
        session: current,
        world,
        view,
        options,
        scenarioTitle: scenarioTitle(current.engine.setup.scenario),
        endYear: () => endYear(current),
        openConsole: () => openConsole(current),
      });
      layer.append(plan.element);
      let endTour: (() => void) | null = null;
      if (tourActive) {
        endTour = runCoach(layer, () => {
          options.set('tutorialDone', true);
          tourActive = false;
        });
      }
      return () => {
        endTour?.();
        plan.dispose();
      };
    });
  }

  /** The 1978 Ledger's plan: the teletype docked beside the living city. */
  function showLedgerPlan(current: Session): void {
    screen('plan', () => {
      const plan = createPlanScreen(
        ctx.manifest.emblem,
        { change: () => undefined, commit: () => undefined },
        'teletype',
      );
      layer.append(plan.element);
      view.attach(plan.dioramaHost);
      view.setPose(PLAN_POSE, glide(1.2));
      const refresh = (decree: Decree): void => {
        const state = current.engine.state;
        const ledger = ledgerFor(state, decree);
        plan.update({
          state,
          decree,
          issues: [],
          ledger,
          turnLabel: current.turnLabel,
          scenarioTitle: scenarioTitle(state.scenario),
          years: termTiles(current),
          forecastsHidden: true,
          lastYear: [],
          scribe: null,
          ghost: null,
          armed: false,
        });
        world.show({
          people: state.people,
          grain: Math.max(0, ledger.leftInStore),
          acres: state.acres + decree.land,
          planted: decree.plant,
          season: 1,
          yieldPerAcre: null,
          landChange: decree.land,
        });
      };
      refresh({ land: 0, food: 0, plant: 0 });
      const teletype: ConsoleRun = runConsole({
        session: current,
        reducedMotion: () => ctx.appearance.reducedMotion,
        onClatter: () => ctx.audio.play(SOUND.clatter),
        onDraft: refresh,
        onDecree: (decree) => {
          current.engine.setDraft(decree);
          endYear(current);
        },
      });
      plan.dock?.append(
        el(
          'p',
          { class: 'th-console__hint' },
          'Answer each question and press Enter. Any key hurries the printer.',
        ),
        teletype.teletype.element,
      );
      teletype.teletype.focus();
      return () => teletype.dispose();
    });
  }

  function openConsole(current: Session): void {
    if (current.engine.phase !== 'plan' || root.querySelector('.th-console')) return;
    const overlay = el('div', {
      class: 'th-console',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'The scribe’s console',
    });
    const close = (): void => {
      window.removeEventListener('keydown', onKey, true);
      run.dispose();
      overlay.remove();
    };
    const run = runConsole({
      session: current,
      reducedMotion: () => ctx.appearance.reducedMotion,
      onClatter: () => ctx.audio.play(SOUND.clatter),
      onDraft: (decree) => current.engine.setDraft(decree),
      onDecree: (decree) => {
        close();
        current.engine.setDraft(decree);
        ctx.milestones.unlock('scribes-console');
        endYear(current);
      },
    });
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    overlay.append(
      el(
        'div',
        { class: 'th-console__frame th-clay' },
        el(
          'p',
          { class: 'th-console__hint' },
          'The old way: answer each question and press Enter. Any key hurries the printer; Escape puts it away.',
        ),
        run.teletype.element,
      ),
    );
    layer.append(overlay);
    run.teletype.focus();
  }

  // ---- the year turns ------------------------------------------------------------

  function endYear(current: Session): void {
    if (!current.engine.canCommit()) return;
    const before = current.engine.state;
    const decree = current.engine.draft;
    const record = current.commit();
    const after = current.engine.state;
    noteMilestones(before, decree, after);
    ctx.audio.play('seal-stamp');
    showTurning(current, before, decree, after, record);
  }

  function noteMilestones(before: CityState, decree: Decree, after: CityState): void {
    if (grainAfterDecree(before, decree) === 0 && peopleFedBy(decree.food) >= before.people)
      ctx.milestones.unlock('no-idle-bushel');
    if (decree.plant > 0) {
      const seen = new Set(options.get('yieldsSeen'));
      seen.add(after.last.yieldPerAcre);
      const ones = [...seen].filter((y) => y >= 1 && y <= 5);
      options.set('yieldsSeen', [...seen]);
      ctx.milestones.progress('five-harvests', ones.length);
    }
  }

  function showTurning(
    current: Session,
    before: CityState,
    decree: Decree,
    after: CityState,
    record: TurnRecord<Decree>,
  ): void {
    ctx.setView('report', current.runId);
    ctx.setPauseItems([]);
    screen('turning', () => {
      view.attach(stage);
      const overlay = el('div', { class: 'th-turning' });
      layer.append(overlay);
      // The tour's year passes quickly; afterwards the player's own choice holds.
      const chosen = options.get('speed');
      const turning = runYear({
        world,
        view,
        story: storyOf(before, decree, after),
        speed: tourActive && chosen === 'cinematic' ? 'quick' : chosen,
        reducedMotion: ctx.appearance.reducedMotion,
        overlay,
        audio: ctx.audio,
        onDone: () => showReport(current, record),
      });
      const stopKeys = onKeyPress([' ', 'Enter'], () => turning.skip());
      const onClick = (): void => turning.skip();
      stage.addEventListener('click', onClick);
      return () => {
        stopKeys();
        stage.removeEventListener('click', onClick);
        turning.dispose();
      };
    });
  }

  function showReport(current: Session, record: TurnRecord<Decree>): void {
    const state = current.engine.state;
    const ending = current.engine.outcome;
    const termEnded = !ending && state.judged.length > 0 && state.term.firstYear === state.year;
    const continueLabel = ending
      ? ending.ending === 'deposed'
        ? 'The council meets'
        : ending.ending === 'walked-out'
          ? 'The steward’s note'
          : 'See the term carved'
      : termEnded
        ? 'The term is carved'
        : `Continue to year ${state.year - state.term.firstYear + 1}`;
    screen('report', () => {
      view.attach(stage);
      view.setPose(REPORT_POSE, glide(1.4));
      world.show({
        people: state.people,
        grain: state.grain,
        acres: state.acres,
        planted: record.plan.plant,
        season: 2,
        yieldPerAcre: state.last.yieldPerAcre,
      });
      const before = current.engine.history.at(-2)?.signals ?? current.engine.opening[0] ?? {};
      const ghost = current.lastTime('people');
      const report = renderReport(
        {
          record,
          before,
          discoveries: current.discoveries,
          ghost:
            ghost !== null && current.ghost
              ? `Last time, after this year: ${formatNumber(ghost)} people.`
              : null,
          continueLabel,
        },
        () => proceed(current, termEnded),
      );
      for (const found of current.discoveries) if (found.isNew) ctx.audio.play('discovery');
      layer.append(report.element);
      report.focus();
    });
  }

  function proceed(current: Session, termEnded: boolean): void {
    const chronicle = current.proceed();
    if (chronicle) {
      recordBest(chronicle);
      finishRun(current, chronicle);
      return;
    }
    if (termEnded) {
      showInterlude(current);
      return;
    }
    showPlan();
  }

  // ---- endings ---------------------------------------------------------------------

  /** The records of one term, and the year it began. */
  function termRecords(
    current: Session,
    index: number,
  ): { records: TurnRecord<Decree>[]; firstYear: number } {
    const rules = rulesFor(current.engine.setup.scenario);
    const firstYear = index * rules.yearsPerTerm + 1;
    return {
      firstYear,
      records: current.engine.history.filter(
        (r) => r.turn >= firstYear && r.turn < firstYear + rules.yearsPerTerm,
      ),
    };
  }

  function showInterlude(current: Session): void {
    const state = current.engine.state;
    const judged = state.judged.at(-1);
    if (!judged) {
      showPlan();
      return;
    }
    const verdict = VERDICTS[judged.verdictId as VerdictId];
    const { records, firstYear } = termRecords(current, judged.index);
    const opening =
      records.length > 0
        ? (current.engine.history.find((r) => r.turn === firstYear - 1)?.signals ??
          current.engine.opening[0] ??
          {})
        : {};
    const history = createRunHistory(current.engine.setup, opening, records, {
      ending: 'term-complete',
      verdict: { id: verdict.id, label: verdict.label, tier: verdict.tier },
    });
    const epithet = pickEpithet(EPITHETS, history).text;
    const plan = stelePlan(records, firstYear, epithet, verdict.label, state);
    showStele(current, {
      plans: [plan],
      eyebrow: `Term ${judged.index + 1} of ${rulesFor(state.scenario).terms} · the ruler’s stele`,
      verdict: verdict.label,
      lines: VERDICT_LINES[verdict.id],
      epithet,
      primaryLabel: 'The heir takes the city',
      onPrimary: showPlan,
    });
  }

  function finishRun(current: Session, chronicle: ChronicleEntry): void {
    const verdictId = chronicle.outcome.verdict.id as VerdictId;
    const lines = VERDICT_LINES[verdictId];
    const toResults = (): void => ctx.navigate({ results: chronicle.id });
    if (chronicle.outcome.ending === 'deposed' || chronicle.outcome.ending === 'walked-out') {
      showDusk(current, chronicle, lines, toResults);
      return;
    }
    const state = current.engine.state;
    const terms = rulesFor(state.scenario).terms;
    const plans = state.judged.map((judged) => {
      const { records, firstYear } = termRecords(current, judged.index);
      const label = VERDICTS[judged.verdictId as VerdictId].label;
      return stelePlan(records, firstYear, chronicle.epithet.text, label, state);
    });
    showStele(current, {
      plans,
      eyebrow:
        terms > 1
          ? 'Three rulers, three stones'
          : `${scenarioTitle(chronicle.setup.scenario)} · the stele of your term`,
      verdict: chronicle.outcome.verdict.label,
      lines,
      epithet: chronicle.epithet.text,
      primaryLabel: 'Read the chronicle',
      onPrimary: toResults,
    });
  }

  function showStele(
    current: Session,
    details: {
      plans: ReturnType<typeof stelePlan>[];
      eyebrow: string;
      verdict: string;
      lines: readonly string[];
      epithet: string | null;
      primaryLabel: string;
      onPrimary: () => void;
    },
  ): void {
    ctx.setView(current.chronicle ? 'results' : 'report', current.runId);
    ctx.setPauseItems([]);
    screen('stele', () => {
      const stele = runStele({
        host: layer,
        appearance,
        reducedMotion: ctx.appearance.reducedMotion,
        onChisel: () => ctx.audio.play(SOUND.chisel),
        ...details,
      });
      onAppearance = (next) => stele.setAppearance(next);
      return () => stele.dispose();
    });
  }

  /** Deposed or abandoned: the city at dusk, the palace lamps going out one by one. */
  function showDusk(
    current: Session,
    chronicle: ChronicleEntry,
    lines: readonly string[],
    onDone: () => void,
  ): void {
    ctx.setView('results', current.runId);
    ctx.setPauseItems([]);
    screen('dusk', () => {
      view.attach(stage);
      view.setPose(DUSK_POSE, glide(4));
      world.setAppearance('dark');
      const state = current.engine.state;
      world.show({
        people: state.people,
        grain: state.grain,
        acres: state.acres,
        planted: 0,
        season: 2,
        yieldPerAcre: null,
      });
      const started = performance.now();
      const stop = view.onFrame(() => {
        const t = ctx.appearance.reducedMotion
          ? 1
          : Math.min(1, (performance.now() - started) / 6000);
        world.city.setDimmed(t * 0.9);
      });
      const primary = button('Read the chronicle', onDone, {
        class: 'th-primary',
        'data-action': 'read-chronicle',
      });
      layer.append(
        el(
          'section',
          { class: 'th-dusk th-clay', 'aria-labelledby': 'th-dusk-title' },
          el('p', { class: 'th-stele-panel__eyebrow' }, chronicle.title),
          el('h1', { id: 'th-dusk-title' }, chronicle.outcome.verdict.label),
          ...lines.map((line) => el('p', {}, line)),
          el(
            'p',
            { class: 'th-stele-panel__epithet' },
            `Remembered as “${chronicle.epithet.text}”`,
          ),
          el('div', { class: 'th-stele-panel__actions' }, primary),
        ),
      );
      primary.focus();
      return () => {
        stop();
        world.city.setDimmed(0);
        world.setAppearance(appearance);
      };
    });
  }

  // ---- start ------------------------------------------------------------------------

  if (ctx.launch.kind === 'menu') showMenu();
  else play(ctx.launch);

  return {
    pause() {
      view.setPaused(true);
      ctx.audio.setAmbience(null);
    },
    resume() {
      view.setPaused(false);
      ctx.audio.setAmbience(PLAIN_WIND);
    },
    gameMenu: showMenu,
    leaveCheck: () => session?.leaveCheck() ?? 'safe',
    keepDraft: () => session?.keepDraft(),
    dispose() {
      leave?.();
      session?.dispose();
      stopAppearance();
      stopOptions();
      view.dispose();
      ctx.audio.setAmbience(null);
      root.remove();
    },
  };
}
