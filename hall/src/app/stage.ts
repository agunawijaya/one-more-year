/**
 * The stage: where a simulation runs inside the Hall.
 *
 * The stage loads a simulation's module, builds its SimContext from the
 * Hall's services, mounts it, and then keeps the navigation standard
 * (ADR-0005) around it: the "Back to the Hall" link on the game menu, the
 * pause button and pause menu during play, the leave check, the address bar
 * that always points at the current run, play-time counting and the
 * one-time first-visit hint.
 */
import {
  createRunStore,
  createSeats,
  showHandover,
  type Launch,
  type PauseItem,
  type RunReport,
  type SimContext,
  type SimInstance,
  type SimModule,
  type SimView,
  type TurnSummary,
} from '@one-more-year/kit';
import { ask, menuList, openDialog, type OpenDialog } from '../chrome/dialogs.ts';
import { docsUrl } from '../chrome/detail.ts';
import type { GameNav } from '../chrome/game-nav.ts';
import { firstVisitHint, loadingVeil, openHowToPlay } from '../chrome/notices.ts';
import type { HallModel } from '../data/hall-model.ts';
import { h } from './dom.ts';
import type { Router } from './router.ts';
import type { HallServices } from './services.ts';

export interface StageDeps {
  services: HallServices;
  model: HallModel;
  router: Router;
  host: HTMLElement;
  gameNav: GameNav;
  openSettings(): void;
  share(chronicleId: string): void;
  /** A run finished and the Hall should show its chronicle. */
  showResults(chronicleId: string): void;
  goHall(): void;
}

export interface Stage {
  readonly simId: string | null;
  readonly view: SimView | null;
  readonly paused: boolean;
  open(simId: string, launch: Launch): Promise<boolean>;
  /** Asks the running simulation's leave check, then closes it; false if the player stayed. */
  leave(): Promise<boolean>;
  close(): void;
  openPauseMenu(): void;
  /** The pause menu, the hint or nothing: what Escape should do on the stage. */
  escape(): void;
}

const TIME_FLUSH_MS = 30_000;

export function createStage(deps: StageDeps): Stage {
  const { services, model, router, host, gameNav } = deps;
  let simId: string | null = null;
  let module: SimModule | null = null;
  let instance: SimInstance | null = null;
  let view: SimView | null = null;
  let pauseItems: readonly PauseItem[] = [];
  let pauseDialog: OpenDialog | null = null;
  let stopSettings: (() => void) | null = null;
  let playStartedAt: number | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let openToken = 0;

  function countTime(): void {
    if (playStartedAt === null || !simId) return;
    const now = services.now();
    services.stats.forSim(simId).addTime(now - playStartedAt);
    playStartedAt = now;
  }

  function setPlaying(playing: boolean): void {
    if (playing && playStartedAt === null) playStartedAt = services.now();
    if (!playing) {
      countTime();
      playStartedAt = null;
    }
  }

  const onVisibility = (): void => {
    if (!instance) return;
    if (document.visibilityState === 'hidden') {
      instance.pause('hidden');
      setPlaying(false);
    } else if (!pauseDialog) {
      instance.resume();
      setPlaying(view === 'plan' || view === 'report');
    }
  };

  function buildContext(id: string, simModule: SimModule, launch: Launch): SimContext {
    const { manifest } = simModule;
    const today = services.today();
    const appearanceListeners = new Set<
      (appearance: 'light' | 'dark', reducedMotion: boolean) => void
    >();
    const settingsListeners = new Set<
      (settings: ReturnType<typeof services.settings.get>) => void
    >();
    stopSettings = services.settings.subscribe((settings, changed) => {
      for (const listener of settingsListeners) listener(settings);
      if (changed.has('resolvedAppearance') || changed.has('reducedMotion')) {
        for (const listener of appearanceListeners)
          listener(settings.resolvedAppearance, settings.reducedMotion);
      }
    });
    const daily = model.snapshot().entries.find((entry) => entry.manifest.id === id)?.daily;

    return {
      manifest,
      launch,
      audio: {
        play: (cue) => services.audio.play(cue),
        define: (name, recipe) => services.audio.define(name, recipe),
        setAmbience: (bed) => services.audio.setAmbience(bed),
      },
      settings: {
        get: () => services.settings.get(),
        subscribe(listener) {
          settingsListeners.add(listener);
          return () => settingsListeners.delete(listener);
        },
        sim: services.settings.forSim(id),
      },
      appearance: {
        get current() {
          return services.settings.get().resolvedAppearance;
        },
        get reducedMotion() {
          return services.settings.get().reducedMotion;
        },
        subscribe(listener) {
          appearanceListeners.add(listener);
          return () => appearanceListeners.delete(listener);
        },
      },
      runs: createRunStore(services.store, id, {
        saveVersion: simModule.saves.version,
        ...(simModule.saves.migrations ? { migrations: simModule.saves.migrations } : {}),
      }),
      milestones: services.milestones.forSim(id, simModule.milestones),
      codex: services.codex.forSim(id, simModule.codex),
      daily: {
        day: today,
        number: daily?.number ?? 0,
        seed: daily?.seed ?? 0,
        played: services.daily.played(id, today),
      },
      seats: { create: createSeats, handover: showHandover },
      now: () => services.now(),
      reportTurn: (summary) => reportTurn(id, summary),
      reportRun: (report) => reportRun(id, report),
      markDailyPlayed: () => {
        services.daily.markPlayed(id, today);
        model.refresh();
      },
      share: (chronicle) => deps.share(chronicle.id),
      setView: (next, runId) => setView(id, next, runId ?? null),
      setPauseItems: (items) => {
        pauseItems = items;
      },
      openSettings: () => deps.openSettings(),
      openHowToPlay: () =>
        openHowToPlay(manifest, simModule.howToPlay, docsUrl(id, 'HOW-TO-PLAY.md')),
      forgetData: () => void forgetSim(id),
      navigate: (to) => {
        if (to === 'hall') void leave().then((left) => left && deps.goHall());
        else if (to === 'game-menu') instance?.gameMenu();
        else void open(id, to.launch);
      },
    };
  }

  function reportTurn(id: string, summary: TurnSummary): void {
    const stats = services.stats.forSim(id);
    if (summary.record.step === 0) stats.runBegun();
    stats.turnPlayed();
    model.refresh();
  }

  function reportRun(id: string, report: RunReport): void {
    const { chronicle } = report;
    services.library.add(chronicle);
    services.stats.forSim(id).runFinished(chronicle.outcome.verdict);
    if (chronicle.daily && chronicle.replayOf === null) {
      services.daily.record(id, chronicle.daily.day, {
        chronicleId: chronicle.id,
        share: chronicle.share,
        verdictTier: chronicle.outcome.verdict.tier,
      });
    }
    model.refresh();
    if (report.presentation === 'hall') deps.showResults(chronicle.id);
  }

  function setView(id: string, next: SimView, runId: string | null): void {
    view = next;
    gameNav.show(next);
    host.dataset.view = next;
    setPlaying(next === 'plan' || next === 'report');
    if (next === 'menu') router.replace({ name: 'sim', simId: id });
    if ((next === 'plan' || next === 'report') && runId) {
      router.replace({ name: 'play', simId: id, request: { kind: 'resume', runId } });
      const hint = `sim:${id}`;
      const seen = services.settings.get().hintsSeen;
      if (!seen.includes(hint)) {
        services.settings.update({ hintsSeen: [...seen, hint] });
        firstVisitHint(host);
      }
    }
  }

  async function forgetSim(id: string): Promise<void> {
    const answer = await ask(
      'Forget this world?',
      'This erases your runs in progress and your chronicles of this world on this device.',
      [
        { id: 'forget', label: 'Forget them', primary: true },
        { id: 'keep', label: 'Keep them' },
      ],
    );
    if (answer !== 'forget') return;
    for (const key of services.store.keys(`omy:run:${id}:`)) services.store.remove(key);
    for (const chronicle of services.library.all()) {
      if (chronicle.simId === id) services.library.remove(chronicle.id);
    }
    model.refresh();
    instance?.gameMenu();
  }

  function teardown(): void {
    const wasOpen = simId !== null;
    setPlaying(false);
    pauseDialog?.close();
    pauseDialog = null;
    instance?.dispose();
    instance = null;
    module = null;
    stopSettings?.();
    stopSettings = null;
    if (flushTimer !== null) clearInterval(flushTimer);
    flushTimer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    simId = null;
    view = null;
    pauseItems = [];
    gameNav.show(null);
    host.replaceChildren();
    delete host.dataset.view;
    // Runs begun or drafts kept while playing must show in the Hall at once.
    if (wasOpen) model.refresh();
  }

  async function open(id: string, launch: Launch): Promise<boolean> {
    const token = ++openToken;
    teardown();
    const entry = model.registry.get(id);
    if (!entry?.load) return false;
    host.replaceChildren(loadingVeil(entry.manifest.title));
    const loaded = await model.loadModule(id);
    if (!loaded || token !== openToken) return false;
    host.replaceChildren();
    const simHost = h('div', { class: 'stage__sim', 'data-sim': id });
    host.append(simHost);
    simId = id;
    module = loaded;
    const context = buildContext(id, loaded, launch);
    try {
      instance = loaded.mount(simHost, context);
    } catch (error) {
      console.error(`${id} could not start`, error);
      teardown();
      return false;
    }
    document.addEventListener('visibilitychange', onVisibility);
    flushTimer = setInterval(countTime, TIME_FLUSH_MS);
    return true;
  }

  async function leave(): Promise<boolean> {
    if (!instance) return true;
    if (instance.leaveCheck() === 'would-lose-progress') {
      const answer = await ask(
        'Keep this year’s plan?',
        'You have changed the plan but not ended the turn. Your world itself is saved either way.',
        [
          { id: 'keep', label: 'Keep it as a draft', primary: true },
          { id: 'discard', label: 'Leave without it' },
          { id: 'stay', label: 'Stay' },
        ],
      );
      if (answer === 'stay') return false;
      if (answer === 'keep') instance.keepDraft?.();
    }
    teardown();
    return true;
  }

  function openPauseMenu(): void {
    if (!instance || pauseDialog) return;
    const current = instance;
    const id = simId;
    current.pause('menu');
    setPlaying(false);
    const resume = (): void => {
      pauseDialog?.close();
    };
    const items = [
      { label: 'Resume', hint: 'Esc', icon: 'play' as const, action: 'resume', onSelect: resume },
      ...pauseItems.map((item) => ({
        label: item.label,
        action: `sim-${item.id}`,
        onSelect: () => {
          resume();
          item.onSelect();
        },
      })),
      {
        label: 'How to play',
        icon: 'info' as const,
        action: 'how-to-play',
        onSelect: () => {
          resume();
          if (module)
            openHowToPlay(
              module.manifest,
              module.howToPlay,
              docsUrl(module.manifest.id, 'HOW-TO-PLAY.md'),
            );
        },
      },
      {
        label: 'Settings',
        icon: 'settings' as const,
        action: 'settings',
        onSelect: () => {
          resume();
          deps.openSettings();
        },
      },
      {
        label: 'Game menu',
        icon: 'library' as const,
        action: 'game-menu',
        onSelect: () => {
          resume();
          current.gameMenu();
        },
      },
      {
        label: 'Back to the Hall',
        icon: 'back' as const,
        action: 'hall',
        onSelect: () => {
          resume();
          void leave().then((left) => left && deps.goHall());
        },
      },
    ];
    pauseDialog = openDialog({
      title: 'Paused',
      kind: 'dialog--pause',
      body: [
        h(
          'p',
          { class: 'pause__note' },
          `${model.registry.get(id ?? '')?.manifest.title ?? ''} · saved after every turn`,
        ),
        menuList(items),
      ],
      onClose: () => {
        pauseDialog = null;
        if (instance === current) {
          current.resume();
          setPlaying(view === 'plan' || view === 'report');
        }
      },
    });
  }

  return {
    get simId() {
      return simId;
    },
    get view() {
      return view;
    },
    get paused() {
      return pauseDialog !== null;
    },
    open,
    leave,
    close: teardown,
    openPauseMenu,
    escape() {
      if (view === 'menu') void leave().then((left) => left && deps.goHall());
      else if (view === 'plan' || view === 'report') openPauseMenu();
    },
  };
}
