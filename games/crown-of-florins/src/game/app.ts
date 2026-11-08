/**
 * Crown of Florins inside the Hall: one painted stage, and the screens a
 * game passes through.
 *
 *   menu → court setup → (curtain) → (obituary) → harvest → the year's five
 *   steps → seal → the heralds' scroll → (coronation) → the valley → the
 *   next ruler's year … → the dynasty → the Hall's chronicle page
 *
 * The kit's play session does the saving, reporting and chronicling; this
 * file decides what the player sees next. Each step of the flow waits for
 * the player (or a skipped cinematic) before the next; leaving for the menu
 * cancels the rest of a flow cleanly.
 */
import {
  createRng,
  numberOf,
  startPlay,
  type ChronicleEntry,
  type Launch,
  type PlaySession,
  type ScenarioSummary,
  type SimContext,
  type SimInstance,
  type TurnRecord,
} from '@one-more-year/kit';
import { courtFromOptions, courtOptions, quickCourt } from '../engine/court.ts';
import { actingRealm, createWorld, isHuman, playStep, policyView } from '../engine/world.ts';
import { policyFor } from '../engine/policies.ts';
import { openingPlan } from '../engine/plan.ts';
import type { PastRuler, Plan, Realm, World } from '../engine/state.ts';
import type { StepId } from '../content/words.ts';
import { el } from '../ui/dom.ts';
import '../ui/crown.css';
import '../ui/screens.css';
import { rngForStep } from '@one-more-year/kit';
import { momentLength, optionStore, type YearSpeed } from './options.ts';
import { PLAY_RULES } from './play-rules.ts';
import { createStage, type Stage } from './stage.ts';
import { crowdCue, defineSounds, PIAZZA, SOUND } from './sound.ts';
import { showCourtSetup, type SetupMode } from './screens/court-setup.ts';
import { runCoronation } from './screens/coronation.ts';
import { showEnding } from './screens/ending.ts';
import { showCurtain } from './screens/handover.ts';
import { runHarvest } from './screens/harvest.ts';
import { renderMenu } from './screens/menu.ts';
import { runObituary } from './screens/obituary.ts';
import { showReview } from './screens/review.ts';
import { showScenarios } from './screens/scenarios.ts';
import { openCodex, openLedger, openOptions } from './screens/sheets.ts';
import { runTutorial } from './screens/tutorial.ts';
import { runValley } from './screens/valley.ts';
import { raceAnnouncement, type RaceChoice } from './screens/race.ts';
import { raceWon } from './year-model.ts';
import { runYear, type YearRun } from './screens/year.ts';
import { population } from '../engine/model.ts';
import { PERSONALITIES } from '../content/names.ts';

type Session = PlaySession<World, Plan>;
type PlayLaunch = Exclude<Launch, { kind: 'menu' }>;

/** Thrown away when the player leaves a flow half way: nothing after it should run. */
class Cancelled extends Error {}

export function mountCrown(host: HTMLElement, ctx: SimContext): SimInstance {
  const options = optionStore(ctx.settings.sim);
  let appearance = ctx.appearance.current;
  const stageHost = el('div', { class: 'cf-stage' });
  const layer = el('div', { class: 'cf-layer' });
  const root = el(
    'div',
    {
      class: 'cf',
      'data-appearance': appearance,
      'data-motion': ctx.appearance.reducedMotion ? 'reduced' : null,
    },
    stageHost,
    layer,
  );
  host.append(root);
  const stage: Stage = createStage(stageHost, { appearance, quality: options.get('graphics') });
  defineSounds(ctx.audio);
  ctx.audio.setAmbience(PIAZZA);

  let session: Session | null = null;
  let leave: (() => void) | null = null;
  let year: YearRun | null = null;
  let flow = 0;
  /** The skip action of whatever cinematic is playing (Space). */
  let skipMoment: (() => void) | null = null;
  let onScreenKey: ((event: KeyboardEvent) => void) | null = null;

  const reduced = (): boolean => ctx.appearance.reducedMotion;
  const speed = (): YearSpeed => options.get('speed');
  const moment = (seconds: number): number => momentLength(seconds, speed(), reduced());

  const stopAppearance = ctx.appearance.subscribe((next, motion) => {
    appearance = next;
    root.dataset.appearance = next;
    if (motion) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
    stage.setAppearance(next);
    year?.refresh();
  });
  const stopOptions = options.subscribe((key) => {
    if (key === 'graphics') stage.setQuality(options.get('graphics'));
  });
  const stopSettings = ctx.settings.subscribe(() => year?.refresh());

  /** Swaps the screen: the previous one tidies up after itself. */
  function screen(name: string, build: () => (() => void) | undefined): void {
    leave?.();
    leave = null;
    year = null;
    skipMoment = null;
    onScreenKey = null;
    layer.replaceChildren();
    root.dataset.screen = name;
    leave = build() ?? null;
  }

  /** Waits for a screen to call `done`; throws Cancelled if another flow has begun meanwhile. */
  function wait(token: number, show: (done: () => void) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      show(() => {
        if (token === flow) resolve();
        else reject(new Cancelled());
      });
    });
  }

  function newFlow(): number {
    flow += 1;
    return flow;
  }

  // ---- the game menu ------------------------------------------------------------------------

  let menuWorld: World | null = null;
  function backgroundValley(): World {
    if (menuWorld) return menuWorld;
    const seed = 1400;
    let world = createWorld(seed, { scenario: 'demo', court: quickCourt(seed, 0, 6) });
    for (let step = 0; step < 16; step++) {
      world = playStep(world, openingPlan(actingRealm(world)), rngForStep(seed, step)).world;
    }
    menuWorld = world;
    return world;
  }

  function showMenu(): void {
    newFlow();
    session?.dispose();
    session = null;
    ctx.setView('menu');
    ctx.setPauseItems([]);
    screen('menu', () => {
      stage.attach(stageHost);
      const world = backgroundValley();
      stage.paintValley(world.realms, [], 0);
      const pose = stage.valleyPose({ elevation: 0.66 });
      stage.view.setPose(pose);
      const started = performance.now();
      const stopDrift = reduced()
        ? () => undefined
        : stage.view.onFrame(() => {
            const t = (performance.now() - started) / 1000;
            stage.view.setPose({ ...pose, azimuth: pose.azimuth + Math.sin(t * 0.05) * 0.08 });
          });
      layer.append(
        renderMenu(ctx, ctx.runs.list(), {
          solo: () => showSetup('solo', scenarioSummary('standard')),
          hotseat: () => showSetup('hotseat', scenarioSummary('standard')),
          daily: () => void play({ kind: 'daily' }),
          scenarios: showScenarioList,
          endless: () => showSetup('endless', scenarioSummary('endless')),
          resume: (runId) => void play({ kind: 'resume', runId }),
          howToPlay: () => ctx.openHowToPlay(),
          codex: () => openCodex(root, ctx),
          settings: () => openOptions(root, ctx, options),
        }),
      );
      layer.querySelector<HTMLElement>('[data-action="begin-solo"]')?.focus();
      return stopDrift;
    });
  }

  function scenarioSummary(id: string): ScenarioSummary {
    return (
      ctx.manifest.scenarios.find((s) => s.id === id) ?? {
        id,
        title: id,
        twist: '',
        difficulty: 2,
      }
    );
  }

  function showScenarioList(): void {
    screen('scenarios', () =>
      showScenarios(layer, ctx, (id) => bestVerdicts()[id] ?? null, {
        choose: (scenario) => showSetup('scenario', scenario),
        back: showMenu,
      }),
    );
  }

  function showSetup(mode: SetupMode, scenario: ScenarioSummary): void {
    ctx.setView('menu');
    screen('setup', () =>
      showCourtSetup({
        host: layer,
        mode,
        scenario,
        seed: Math.floor(ctx.now() / 1000) % 100_000,
        previous: courtFromOptions({ court: options.get('lastCourt') }),
        onBegin: (court) => {
          options.set('lastCourt', courtOptions(court).court ?? null);
          const humans = court.seats.filter((s) => s.controller.kind === 'human');
          void play({
            kind: 'new',
            scenario: scenario.id,
            seats: humans.length,
            seatNames: humans.map((s) => s.name),
            options: courtOptions(court),
          });
        },
        onBack: showMenu,
      }),
    );
  }

  function bestVerdicts(): Record<string, string> {
    return ctx.settings.sim.get<Record<string, string>>('best', {});
  }

  function recordBest(chronicle: ChronicleEntry): void {
    const best = { ...bestVerdicts() };
    const scenario = chronicle.setup.scenario;
    const tiers: Record<string, number> = ctx.settings.sim.get('bestTier', {});
    if (chronicle.outcome.verdict.tier >= (tiers[scenario] ?? 0)) {
      best[scenario] = chronicle.outcome.verdict.label;
      ctx.settings.sim.set('bestTier', { ...tiers, [scenario]: chronicle.outcome.verdict.tier });
    }
    ctx.settings.sim.set('best', best);
  }

  // ---- playing ---------------------------------------------------------------------------------

  /** A launch from the Hall carries no court: seat the last one the player set up, if it fits. */
  function withCourt(launch: PlayLaunch): PlayLaunch {
    if (launch.kind !== 'new' || launch.options) return launch;
    const last = courtFromOptions({ court: options.get('lastCourt') });
    const humans = last?.seats.filter((s) => s.controller.kind === 'human').length ?? 0;
    return last && humans === launch.seats ? { ...launch, options: courtOptions(last) } : launch;
  }

  async function play(launch: PlayLaunch): Promise<void> {
    const token = newFlow();
    session?.dispose();
    session = startPlay(ctx, PLAY_RULES, withCourt(launch));
    const current = session;
    if (current.chronicle) {
      ctx.navigate({ results: current.chronicle.id });
      return;
    }
    if (launch.kind === 'new' || launch.kind === 'daily') noteStart(current);
    try {
      if (current.engine.phase === 'report' && current.engine.lastRecord) {
        await afterSeal(token, current, current.engine.lastRecord, null);
      } else {
        await startTurn(token, current, { resumed: launch.kind === 'resume', previousSeat: null });
      }
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  }

  function humanSeats(world: World): number[] {
    return world.realms.filter(isHuman).map((r) => r.seat);
  }

  /** The opening of a human's year: the curtain, an obituary, the season, then the plan. */
  async function startTurn(
    token: number,
    current: Session,
    from: { resumed: boolean; previousSeat: number | null },
  ): Promise<void> {
    const world = current.engine.state;
    const realm = actingRealm(world);
    const hotseat = humanSeats(world).length > 1;
    if (hotseat && (from.resumed || from.previousSeat !== realm.seat)) {
      ctx.setView('report', current.runId);
      ctx.setPauseItems([]);
      await wait(token, (done) =>
        screen('handover', () => {
          stage.attach(stageHost);
          return showCurtain(layer, realm, world.year, () => done());
        }),
      );
    }
    const succession = realm.opening?.succession ?? null;
    if (succession && !from.resumed) {
      await obituary(token, current, realm, succession, realm.ruler);
    }
    if (!from.resumed && moment(9) > 0) {
      ctx.setView('report', current.runId);
      await wait(token, (done) =>
        screen('harvest', () => {
          const run = runHarvest({
            host: stageHost,
            stage,
            world,
            realm,
            appearance,
            length: moment(9),
            reducedMotion: reduced(),
            sound: {
              swell: () => ctx.audio.play(SOUND.step(1)),
              grain: () => ctx.audio.play(SOUND.grain),
              mason: () => ctx.audio.play(SOUND.mason),
              crowd: () => ctx.audio.play(crowdCue(population(realm))),
            },
            onDone: () => done(),
          });
          skipMoment = () => run.skip();
          return () => run.dispose();
        }),
      );
    }
    showYear(token, current);
  }

  function showYear(token: number, current: Session): void {
    const world = current.engine.state;
    const realm = actingRealm(world);
    ctx.setView('plan', current.runId);
    pauseItems(current);
    const others = new Set(humanSeats(world).filter((seat) => seat !== realm.seat));
    const ghostPoints = current.lastTime('points');
    screen('year', () => {
      const run = runYear({
        host: layer,
        session: current,
        stage,
        appearance: () => appearance,
        forecastsShown: () => ctx.settings.get().forecasts === 'shown',
        reducedMotion: reduced,
        hiddenSeats: others,
        ghost:
          ghostPoints !== null && current.ghost
            ? `Last time, at this point: ${ghostPoints} title points.`
            : null,
        sound: {
          step: (index) => ctx.audio.play(SOUND.step(index)),
          refuse: () => ctx.audio.play(SOUND.refuse),
          grain: () => ctx.audio.play(SOUND.grain),
          mason: () => ctx.audio.play(SOUND.mason),
        },
        onPillarRead: (id) => notePillar(id),
        onSeal: () => void seal(token, current),
      });
      year = run;
      let endTour: (() => void) | null = null;
      if (
        !options.get('tutorialDone') &&
        current.engine.history.length === 0 &&
        humanSeats(world).length === 1
      ) {
        endTour = runTutorial(
          layer,
          realm.city,
          (step: StepId) => run.setStep(step),
          () => {
            options.set('tutorialDone', true);
          },
        );
      }
      onScreenKey = (event) => {
        if (
          (event.key === 'l' || event.key === 'L') &&
          !root.querySelector('.cf-sheet, .cf-ask, .cf-coach')
        ) {
          event.preventDefault();
          openLedger(root, current.engine.state, actingRealm(current.engine.state));
        }
      };
      return () => {
        endTour?.();
        run.dispose();
      };
    });
  }

  function pauseItems(current: Session): void {
    const world = current.engine.state;
    ctx.setPauseItems([
      {
        id: 'ledger',
        label: 'Ledger',
        onSelect: () => openLedger(root, current.engine.state, actingRealm(current.engine.state)),
      },
      { id: 'codex', label: 'Codex', onSelect: () => openCodex(root, ctx) },
      {
        id: 'options',
        label: 'Crown of Florins options',
        onSelect: () => openOptions(root, ctx, options),
      },
      // In Endless Dynasty, and once another realm has won the race, the chronicle may be closed.
      ...(world.endYear === null || world.firstCrowned !== null
        ? [{ id: 'retire', label: 'Close the chronicle', onSelect: () => void retire(current) }]
        : []),
    ]);
  }

  async function retire(current: Session): Promise<void> {
    if (current.engine.phase !== 'plan') return;
    current.engine.setDraft({ ...current.engine.draft, retire: true });
    await seal(flow, current);
  }

  async function seal(token: number, current: Session): Promise<void> {
    if (!current.engine.canCommit()) return;
    const before = current.engine.state;
    const actor = actingRealm(before);
    const record = current.commit();
    ctx.audio.play(SOUND.step(5));
    noteYear(current, record, actor);
    try {
      await afterSeal(token, current, record, actor, before.firstCrowned);
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  }

  /** Everything between the seal and the next ruler's year. */
  async function afterSeal(
    token: number,
    current: Session,
    record: TurnRecord<Plan>,
    actorBefore: Realm | null,
    firstCrownedBefore: number | null = current.engine.state.firstCrowned,
  ): Promise<void> {
    const world = current.engine.state;
    // The race was won this year by someone else: the whole table is told, and may end here.
    const announce =
      firstCrownedBefore === null && !world.end && world.firstCrowned !== null
        ? raceWon(world)
        : null;
    let choice = 'play-on' as RaceChoice;
    const seat = record.seat;
    const played = world.realms[seat];
    if (!played) return;
    const retired = record.plan.retire === true && world.end?.ending === 'retired';
    // The ruler who sealed the year, even if an heir has taken the throne since.
    const sealedBy =
      actorBefore?.ruler ??
      played.pastRulers.find((p) => p.died === world.year)?.ruler ??
      played.ruler;
    const shown: Realm = {
      ...played,
      ruler: sealedBy,
      title: played.last?.titleAfter ?? played.title,
    };
    ctx.setView('report', current.runId);
    ctx.setPauseItems([]);

    if (!retired) {
      const promoted = record.events.some(
        (e) => e.kind === 'promoted' && (e.seat ?? seat) === seat,
      );
      if (promoted) ctx.audio.play(SOUND.promotion);
      await wait(token, (done) =>
        screen('review', () => {
          stage.attach(stageHost);
          stage.paintCity(played, { frame: 13 });
          stage.view.setPose(stage.cityPose({ elevation: 0.5, crestAt: 0.84 }));
          const ghost = current.lastTime('points');
          return showReview({
            host: layer,
            world,
            realm: shown,
            events: record.events,
            discoveries: current.discoveries,
            ghost:
              ghost !== null && current.ghost
                ? `Last time, after this year: ${ghost} title points.`
                : null,
            continueLabel: 'Continue',
            reducedMotion: reduced(),
            onContinue: () => done(),
          });
        }),
      );
    }

    const crownedNow = record.events.some((e) => e.kind === 'crowned' && (e.seat ?? seat) === seat);
    if (crownedNow) {
      await wait(token, (done) =>
        screen('coronation', () => {
          const run = runCoronation({
            host: stageHost,
            stage,
            world,
            realm: { ...played, ruler: sealedBy },
            appearance,
            length: moment(8),
            reducedMotion: reduced(),
            continueLabel: current.engine.outcome ? 'The dynasty' : 'Continue',
            sound: {
              bells: () => ctx.audio.play(SOUND.coronation),
              choir: () => ctx.audio.play(SOUND.choir),
            },
            onContinue: () => done(),
          });
          skipMoment = () => run.skip();
          return () => run.dispose();
        }),
      );
    }

    // The deaths of human rulers whose seat ended (Classic fate, or no heir): told to everyone now.
    const ended = record.events
      .filter((e) => e.kind === 'ruler-died')
      .map((e) => world.realms[e.seat ?? -1])
      .filter((r): r is Realm => r?.status === 'ended' && isHuman(r));
    for (const realm of ended) {
      const past = realm.pastRulers.at(-1);
      if (past) await obituary(token, current, realm, past, null);
    }

    if (current.engine.outcome) {
      const chronicle = current.proceed();
      if (chronicle) {
        recordBest(chronicle);
        showEnd(current, chronicle);
      }
      return;
    }

    const next = actingRealm(world);
    const yearTurned = next.opening
      ? next.opening.year !== (played.last?.year ?? world.year)
      : true;
    const hotseat = humanSeats(world).length > 1;
    // The valley is its own choice; at the instant speed it shows the year's outcome without marching.
    if (options.get('valley') && (!hotseat || yearTurned || announce)) {
      await wait(token, (done) =>
        screen('valley', () => {
          const run = runValley({
            host: stageHost,
            stage,
            world,
            year: played.last?.year ?? world.year,
            appearance,
            marchLength: moment(3.5),
            aiSpeed: options.get('aiSpeed'),
            reducedMotion: reduced(),
            continueLabel: hotseat
              ? 'Pass the device on'
              : `On to ${next.opening?.year ?? world.year}`,
            sound: { drum: () => ctx.audio.play(SOUND.drum) },
            announce,
            onContinue: (chosen) => {
              choice = chosen;
              done();
            },
          });
          skipMoment = () => run.skip();
          return () => run.dispose();
        }),
      );
    }
    if (announce && !options.get('valley')) {
      // Without the valley the heralds come to the city itself.
      await wait(token, (done) =>
        screen('herald', () => {
          stage.attach(stageHost);
          const card = raceAnnouncement(announce, (chosen) => {
            choice = chosen;
            done();
          });
          layer.append(el('div', { class: 'cf-race-won-layer' }, card.element));
          card.playOn.focus();
          return undefined;
        }),
      );
    }
    current.proceed();
    if (choice === 'end-here') {
      await retire(current);
      return;
    }
    await startTurn(token, current, { resumed: false, previousSeat: seat });
  }

  async function obituary(
    token: number,
    current: Session,
    realm: Realm,
    past: PastRuler,
    heir: Realm['ruler'] | null,
  ): Promise<void> {
    ctx.setView('report', current.runId);
    await wait(token, (done) =>
      screen('obituary', () => {
        const run = runObituary({
          host: layer,
          realm,
          past,
          heir,
          appearance,
          length: moment(20),
          continueLabel: heir ? `${heir.name} takes the throne` : 'Continue',
          sound: {
            bell: () => ctx.audio.play(SOUND.passing),
            quill: () => ctx.audio.play(SOUND.quill),
          },
          onSaved: () => ctx.milestones.unlock('obituary-kept'),
          onContinue: () => done(),
        });
        skipMoment = () => run.skip();
        return () => run.dispose();
      }),
    );
  }

  function showEnd(current: Session, chronicle: ChronicleEntry): void {
    newFlow();
    ctx.setView('results', current.runId);
    ctx.setPauseItems([]);
    const world = current.engine.state;
    const toResults = (): void => ctx.navigate({ results: chronicle.id });
    const again = (): void =>
      void play({
        kind: 'new',
        scenario: chronicle.daily ? 'standard' : chronicle.setup.scenario,
        seats: chronicle.setup.seats,
        seatNames: [],
        ...(chronicle.setup.options && !chronicle.daily
          ? { options: chronicle.setup.options }
          : {}),
      });
    screen('ending', () => {
      const close = showEnding({
        host: layer,
        stage,
        world,
        chronicle,
        ghost: current.ghostSeries('points'),
        appearance,
        onChronicle: toResults,
        onPlayAgain: again,
        onGameMenu: showMenu,
        onHall: () => ctx.navigate('hall'),
      });
      onScreenKey = (event) => {
        if (root.querySelector('.cf-sheet')) return;
        if (event.key === 'r' || event.key === 'R') {
          event.preventDefault();
          again();
        } else if (event.key === 'h' || event.key === 'H') {
          event.preventDefault();
          ctx.navigate('hall');
        }
      };
      return close;
    });
  }

  // ---- milestones the session cannot see by itself ----------------------------------------------------

  function noteStart(current: Session): void {
    const world = current.engine.state;
    ctx.codex.sight('lost-difficulty', current.runId);
    if (humanSeats(world).length > 1 && world.realms.length === 6)
      ctx.milestones.unlock('six-at-table');
  }

  function noteYear(current: Session, record: TurnRecord<Plan>, actor: Realm): void {
    const world = current.engine.state;
    const mine = record.events.filter((e) => (e.seat ?? actor.seat) === actor.seat);
    const seen = new Set(options.get('weathersSeen'));
    for (const e of mine) if (e.kind === 'weather') seen.add(numberOf(e, 'grade'));
    options.set('weathersSeen', [...seen]);
    ctx.milestones.progress('five-weathers', [...seen].filter((g) => g >= 1 && g <= 5).length);
    if (mine.some((e) => e.kind === 'promoted' && e.codex === 'deathbed'))
      ctx.milestones.unlock('deathbed');
    const realm = world.realms[actor.seat];
    if (realm && realm.holdings.cathedral >= 6) ctx.milestones.unlock('full-cathedral');
    if (mine.some((e) => e.kind === 'crowned')) {
      const beaten = new Set(options.get('rivalsBeaten'));
      for (const r of world.realms)
        if (r.controller.kind === 'ai') beaten.add(r.controller.personality);
      options.set('rivalsBeaten', [...beaten]);
      ctx.milestones.progress(
        'beat-every-rival',
        [...beaten].filter((p) => PERSONALITIES.includes(p as never)).length,
      );
    }
    if (world.endYear === null && world.year >= 1460) ctx.milestones.unlock('endless-sixty');
  }

  function notePillar(id: string): void {
    const read = new Set(options.get('pillarsRead'));
    if (read.has(id)) return;
    read.add(id);
    options.set('pillarsRead', [...read]);
    ctx.milestones.progress('every-pillar', read.size);
  }

  // ---- keys and start ---------------------------------------------------------------------------------

  function onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (
      (event.key === ' ' || event.key === 'Enter') &&
      skipMoment &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      skipMoment();
      return;
    }
    onScreenKey?.(event);
  }
  window.addEventListener('keydown', onKey);

  if (ctx.launch.kind === 'menu') showMenu();
  else void play(ctx.launch);

  // Development and end-to-end tests only: let a bot fill in this year's plan, so a test can walk
  // a whole reign through the real screens. Production builds leave this out.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __crown: {
        state: () => session?.engine.state ?? null,
        screen: () => root.dataset.screen ?? null,
        fps: () => stage.view.fps,
        quality: () => stage.view.ladder.level,
        draft: () => session?.engine.draft ?? null,
        patchPlan(patch: Partial<Plan>) {
          if (session?.engine.phase !== 'plan') return false;
          session.engine.setDraft({ ...session.engine.draft, ...patch });
          year?.refresh();
          return true;
        },
        planWith(personality: 'steward' | 'merchant' | 'general' | 'builder' | 'miser' | 'saint') {
          if (session?.engine.phase !== 'plan') return false;
          const world = session.engine.state;
          const plan = policyFor(personality)(
            policyView(world, actingRealm(world)),
            createRng(world.year).fork('test'),
          );
          session.engine.setDraft(plan);
          year?.refresh();
          return true;
        },
      },
    });
  }

  return {
    pause() {
      stage.setPaused(true);
      ctx.audio.setAmbience(null);
    },
    resume() {
      stage.setPaused(false);
      ctx.audio.setAmbience(PIAZZA);
    },
    gameMenu: showMenu,
    leaveCheck: () => session?.leaveCheck() ?? 'safe',
    keepDraft: () => session?.keepDraft(),
    dispose() {
      newFlow();
      window.removeEventListener('keydown', onKey);
      leave?.();
      session?.dispose();
      stopAppearance();
      stopOptions();
      stopSettings();
      stage.dispose();
      ctx.audio.setAmbience(null);
      root.remove();
    },
  };
}
