/**
 * The Hall application: builds the page, applies settings, routes between
 * the Hall, its pages and the stage, and owns the keys that work
 * everywhere (Escape, and R / H on a run's results).
 *
 *   #app
 *   ├── .shell          skip link, top bar, main, stage, dialog layer
 *   ├── .intro-layer    the first-visit intro and the theme picker
 *   └── .toasts
 */
import {
  unlockOnFirstGesture,
  type Appearance,
  type DemoLook,
  type Launch,
  type SimManifest,
} from '@one-more-year/kit';
import { renderChronicle } from '../chrome/chronicle-page.ts';
import { dialogIsOpen, escapeDialog, setDialogLayer, closeDialog } from '../chrome/dialogs.ts';
import { createGameNav } from '../chrome/game-nav.ts';
import { icon } from '../chrome/icons.ts';
import { playIntro } from '../chrome/intro.ts';
import { openHowToPlay, storageBanner } from '../chrome/notices.ts';
import { showPicker, type Picker } from '../chrome/picker.ts';
import { openSettingsPanel } from '../chrome/settings-panel.ts';
import { openShareSheet } from '../chrome/share-sheet.ts';
import { createToasts } from '../chrome/toasts.ts';
import { createTopBar, type TopBarState } from '../chrome/top-bar.ts';
import { docsUrl } from '../chrome/detail.ts';
import { COMING_SOON } from '../data/coming-soon.ts';
import { createHallModel, type HallModel } from '../data/hall-model.ts';
import { createRegistry, type DiscoveredSim } from '../data/registry.ts';
import { renderAbout } from '../routes/about.ts';
import { renderCodex } from '../routes/codex.ts';
import { renderLegacy } from '../routes/legacy.ts';
import { renderLibrary } from '../routes/library.ts';
import type { PageContext } from '../routes/page.ts';
import { THEMES, cardSkin } from '../themes/index.ts';
import type { HallActions, ThemeView } from '../themes/theme.ts';
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../themes/theme-ids.ts';
import { paletteCss } from '../themes/tokens.ts';
import { createDemoHost, type DemoHost } from './demos.ts';
import { h } from './dom.ts';
import { createRouter, type PlayRequest, type Route, type Router } from './router.ts';
import { createServices, type HallServices, type ServiceOptions } from './services.ts';
import { createStage, type Stage } from './stage.ts';

export interface BootOptions {
  root: HTMLElement;
  sims: readonly DiscoveredSim[];
  /** Planned simulations (the coming-soon placeholders by default). */
  placeholders?: readonly SimManifest[];
  /** Development builds can play simulations whose manifest is not marked playable yet. */
  allowUnreleased?: boolean;
  services?: ServiceOptions;
}

export interface HallApp {
  readonly services: HallServices;
  readonly model: HallModel;
  readonly stage: Stage;
  readonly router: Router;
  dispose(): void;
}

export function bootHall(options: BootOptions): HallApp {
  const services = createServices(options.services);
  const registry = createRegistry({
    placeholders: options.placeholders ?? COMING_SOON,
    discovered: options.sims,
    allowUnreleased: options.allowUnreleased ?? false,
  });
  if (registry.problems.length > 0)
    console.warn(`Hall registry problems:\n${registry.problems.join('\n')}`);
  const model = createHallModel(registry, services);
  const router = createRouter();
  const html = document.documentElement;
  injectPalettes();

  // ---- page skeleton ---------------------------------------------------------

  const main = h('main', { class: 'hall-main', id: 'main', tabindex: -1 });
  const stageHost = h('div', { class: 'stage__host' });
  const gameNav = createGameNav({
    hall: () => void leaveStage(),
    pause: () => stage.openPauseMenu(),
  });
  const stageElement = h('div', { class: 'stage', hidden: true }, gameNav.element, stageHost);
  const dialogLayer = h('div', { class: 'dialog-layer' });
  const banner = h('div', { class: 'banner-slot' });
  const toasts = createToasts();
  const topBar = createTopBar({
    home: () => router.go({ name: 'hall', focus: null }),
    library: () => router.go({ name: 'library' }),
    codex: () => router.go({ name: 'codex', simId: null }),
    legacy: () => router.go({ name: 'legacy' }),
    setTheme: (theme) => services.settings.update({ theme, themeChosen: true }),
    toggleAppearance,
    toggleSound: () => services.settings.update({ muted: !services.settings.get().muted }),
    settings: openSettings,
  });
  const skipLink = h('a', { href: '#main', class: 'skip-link' }, 'Skip to content');
  skipLink.addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
  });
  const shell = h(
    'div',
    { class: 'shell' },
    skipLink,
    topBar.element,
    banner,
    main,
    stageElement,
    dialogLayer,
  );
  const introLayer = h('div', { class: 'intro-layer', hidden: true });
  options.root.replaceChildren(shell, introLayer, toasts.element);
  setDialogLayer(dialogLayer);

  // ---- settings → page -------------------------------------------------------

  const theme = (): ThemeId => {
    const chosen = services.settings.get().theme;
    return isThemeId(chosen) ? chosen : DEFAULT_THEME;
  };
  const appearance = (): Appearance => services.settings.get().resolvedAppearance;
  const reducedMotion = (): boolean => services.settings.get().reducedMotion;

  function demoLook(
    forTheme: ThemeId = theme(),
    forAppearance: Appearance = appearance(),
  ): DemoLook {
    const renderer = THEMES[forTheme];
    return {
      appearance: forAppearance,
      reducedMotion: reducedMotion(),
      style: renderer.demoStyle,
      palette: renderer.demoPalette(forAppearance),
    };
  }

  const demos: DemoHost = createDemoHost(model, () => demoLook());

  function applySettings(): void {
    const settings = services.settings.get();
    html.dataset.theme = theme();
    html.dataset.appearance = settings.resolvedAppearance;
    html.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    html.style.fontSize = settings.textSize === 100 ? '' : `${settings.textSize}%`;
    html.style.colorScheme = settings.resolvedAppearance;
    services.audio.setVolumes(settings.volumes, settings.muted);
    demos.setLook(demoLook());
    paintTopBar();
  }

  function paintTopBar(): void {
    topBar.update({
      theme: theme(),
      appearance: appearance(),
      muted: services.settings.get().muted,
      page: pageName(router.current()),
    });
  }

  function toggleAppearance(): void {
    services.settings.update({ appearance: appearance() === 'dark' ? 'light' : 'dark' });
  }

  // ---- actions ---------------------------------------------------------------

  const play = (simId: string, request: PlayRequest): void =>
    router.go({ name: 'play', simId, request });

  const actions: HallActions = {
    // The theme has already shown the focus its own way; the address bar only remembers it.
    focus: (simId) => router.replace({ name: 'hall', focus: simId }),
    begin: (simId, scenario = null) => play(simId, { kind: 'new', scenario, seats: 1 }),
    continueRun: (simId, runId) => play(simId, { kind: 'resume', runId }),
    playDaily: (simId) => play(simId, { kind: 'daily' }),
    gameMenu: (simId) => router.go({ name: 'sim', simId }),
    howToPlay: (simId) => {
      void model.loadModule(simId).then((module) => {
        if (module)
          openHowToPlay(module.manifest, module.howToPlay, docsUrl(simId, 'HOW-TO-PLAY.md'));
      });
    },
    openChronicle: (id) => router.go({ name: 'chronicle', id, results: false }),
    openLibrary: () => router.go({ name: 'library' }),
    openCodex: (simId) => router.go({ name: 'codex', simId: simId ?? null }),
    openLegacy: () => router.go({ name: 'legacy' }),
    openAbout: () => router.go({ name: 'about' }),
  };

  function openSettings(): void {
    openSettingsPanel(services.settings, {
      replayIntro: () => {
        closeDialog();
        void runIntro();
      },
      chooseThemeAgain: () => {
        closeDialog();
        openPicker();
      },
      forgetEverything: () => {
        closeDialog();
        stage.close();
        services.forgetEverything();
        model.refresh();
        router.go({ name: 'hall', focus: null });
        toasts.show({
          title: 'Forgotten',
          detail: 'Everything this site kept on your device is gone.',
        });
      },
    });
  }

  function share(chronicleId: string): void {
    const entry = services.library.get(chronicleId);
    const manifest = entry ? registry.get(entry.simId)?.manifest : undefined;
    if (!entry || !manifest) return;
    openShareSheet(entry, manifest, cardSkin(theme(), appearance(), manifest));
  }

  // ---- stage -----------------------------------------------------------------

  const stage: Stage = createStage({
    services,
    model,
    router,
    host: stageHost,
    gameNav,
    openSettings,
    share,
    showResults: (chronicleId) => {
      stage.close();
      router.go({ name: 'chronicle', id: chronicleId, results: true });
    },
    goHall: () => router.go({ name: 'hall', focus: null }),
  });

  async function leaveStage(): Promise<void> {
    if (await stage.leave()) router.go({ name: 'hall', focus: stage.simId });
  }

  function launchFor(request: PlayRequest): Launch | null {
    switch (request.kind) {
      case 'resume':
        return { kind: 'resume', runId: request.runId };
      case 'daily':
        return { kind: 'daily' };
      case 'new':
        return { kind: 'new', scenario: request.scenario, seats: request.seats, seatNames: [] };
      case 'replay': {
        const chronicle = services.library.get(request.chronicleId);
        return chronicle ? { kind: 'replay', chronicle } : null;
      }
    }
  }

  // ---- routes ----------------------------------------------------------------

  let themeView: ThemeView | null = null;
  let mountedTheme: ThemeId | null = null;
  let renderedRoute: Route | null = null;
  let renderToken = 0;

  function unmountTheme(): void {
    themeView?.dispose();
    themeView = null;
    mountedTheme = null;
  }

  function pageContext(): PageContext {
    return {
      model,
      services,
      actions,
      snapshot: model.snapshot(),
      theme: theme(),
      appearance: appearance(),
      chartTokens: THEMES[theme()].chartTokens(appearance()),
      rerender: () => renderPage(router.current()),
      replayIntro: () => void runIntro(),
    };
  }

  function showMain(content: HTMLElement | null, focusHeading: boolean): void {
    stageElement.hidden = true;
    main.hidden = false;
    topBar.element.hidden = false;
    html.dataset.view = 'hall';
    if (content) {
      main.replaceChildren(content);
      if (focusHeading)
        main.querySelector<HTMLElement>('#page-title')?.focus({ preventScroll: true });
    }
  }

  function renderPage(route: Route, focusHeading = false): void {
    const ctx = pageContext();
    switch (route.name) {
      case 'library':
        showMain(renderLibrary(ctx), focusHeading);
        break;
      case 'codex':
        showMain(renderCodex(ctx, route.simId), focusHeading);
        break;
      case 'legacy':
        showMain(renderLegacy(ctx), focusHeading);
        break;
      case 'about':
        showMain(renderAbout(ctx), focusHeading);
        break;
      case 'chronicle':
        showMain(chroniclePage(route.id, route.results), focusHeading);
        break;
      default:
        break;
    }
  }

  function chroniclePage(id: string, results: boolean): HTMLElement {
    const entry = services.library.get(id);
    const manifest = entry ? registry.get(entry.simId)?.manifest : undefined;
    if (!entry || !manifest) {
      return h(
        'div',
        { class: 'page' },
        h(
          'h1',
          { class: 'page__title', id: 'page-title', tabindex: -1 },
          'This chronicle is not on the shelves',
        ),
        h('p', {}, 'It may have been forgotten along with other data.'),
      );
    }
    const playable = Boolean(registry.get(entry.simId)?.load);
    const ghost = entry.replayOf ? services.library.get(entry.replayOf) : null;
    const tokens = THEMES[theme()].chartTokens(appearance());
    return h(
      'div',
      { class: 'page page--chronicle' },
      renderChronicle(
        {
          entry,
          manifest,
          ghost,
          results,
          playable,
          chartTokens: tokens,
          chartFont: getComputedStyle(html).getPropertyValue('--font-numbers').trim() || 'inherit',
          lineColor: manifest.accent[appearance()],
        },
        {
          playAgain: () =>
            play(entry.simId, {
              kind: 'new',
              scenario: entry.setup.scenario,
              seats: entry.setup.seats,
            }),
          replay: () => play(entry.simId, { kind: 'replay', chronicleId: entry.id }),
          gameMenu: () => router.go({ name: 'sim', simId: entry.simId }),
          hall: () => router.go({ name: 'hall', focus: entry.simId }),
          library: () => router.go({ name: 'library' }),
          share: () => share(entry.id),
        },
      ),
    );
  }

  function renderHall(focus: string | null): void {
    showMain(null, false);
    document.title = 'One More Year';
    const current = theme();
    if (mountedTheme !== current || !themeView) {
      unmountTheme();
      main.replaceChildren();
      const container = h('div', { class: 'hall-view' });
      main.append(container);
      themeView = THEMES[current].mount(container, model.snapshot(), {
        services,
        actions,
        demos,
        appearance,
        reducedMotion,
        initialFocus: focus,
      });
      mountedTheme = current;
    } else if (focus) {
      themeView.focus(focus);
    }
  }

  /**
   * A world that cannot open (not in this Hall, still in preparation, or
   * failing to start) sends the player back to the Hall with a word of why,
   * instead of leaving an empty stage. replaceState fires no hashchange, so
   * the Hall is rendered here.
   */
  function returnToHall(simId: string): void {
    const entry = registry.get(simId);
    toasts.show(
      entry
        ? { title: entry.manifest.title, detail: 'This world cannot be opened yet.' }
        : { title: 'Not in this Hall', detail: 'There is no world at that address.' },
    );
    const route: Route = { name: 'hall', focus: entry ? simId : null };
    router.replace(route);
    void renderRoute(route);
  }

  async function renderRoute(route: Route): Promise<void> {
    const token = ++renderToken;
    const previous = renderedRoute;
    renderedRoute = route;
    paintTopBar();

    if (route.name === 'sim' || route.name === 'play') {
      if (stage.simId === route.simId && stage.view !== null) {
        // The stage already shows this simulation; the address bar caught up with it.
        if (route.name === 'sim' && stage.view !== 'menu') {
          // Back from play to the game menu: let the simulation draw it.
          return;
        }
        if (route.name === 'play' && route.request.kind === 'resume') return;
      }
      if (stage.simId !== null && !(await stage.leave())) {
        if (previous) router.replace(previous);
        return;
      }
      if (token !== renderToken) return;
      const launch: Launch | null =
        route.name === 'sim' ? { kind: 'menu' } : launchFor(route.request);
      const entry = registry.get(route.simId);
      if (!launch || !entry?.load) {
        returnToHall(route.simId);
        return;
      }
      unmountTheme();
      main.hidden = true;
      topBar.element.hidden = true;
      stageElement.hidden = false;
      html.dataset.view = 'stage';
      document.title = `${entry.manifest.title} · One More Year`;
      const opened = await stage.open(route.simId, launch);
      if (!opened && token === renderToken) returnToHall(route.simId);
      return;
    }

    if (stage.simId !== null) {
      if (!(await stage.leave())) {
        if (previous) router.replace(previous);
        return;
      }
    }
    if (token !== renderToken) return;
    if (route.name === 'hall') {
      renderHall(route.focus);
    } else {
      unmountTheme();
      renderPage(route, true);
      window.scrollTo({ top: 0 });
    }
  }

  // ---- first visit -----------------------------------------------------------

  let picker: Picker | null = null;

  async function runIntro(): Promise<void> {
    await playIntro(introLayer, {
      reducedMotion: reducedMotion(),
      year: new Date(services.now()).getUTCFullYear(),
    });
    services.settings.update({ introSeen: true });
  }

  function openPicker(): void {
    picker?.close();
    picker = showPicker(introLayer, {
      appearance,
      toggleAppearance,
      preview: (themeId, frame) => {
        // Each preview draws its demos in its own theme's style, in the frame's appearance.
        const frameAppearance = (): Appearance =>
          frame.dataset.appearance === 'dark' ? 'dark' : 'light';
        const previewDemos = createDemoHost(model, () => demoLook(themeId, frameAppearance()));
        const stopLook = services.settings.subscribe(() =>
          previewDemos.setLook(demoLook(themeId, frameAppearance())),
        );
        const view = THEMES[themeId].mount(frame, model.snapshot(), {
          services,
          actions: { ...actions, focus: () => undefined },
          demos: previewDemos,
          appearance: frameAppearance,
          reducedMotion,
          initialFocus: null,
        });
        return () => {
          stopLook();
          view.dispose();
          previewDemos.disposeAll();
        };
      },
      choose: (chosen) => {
        services.settings.update({ theme: chosen, themeChosen: true });
        picker?.close();
        picker = null;
        main.focus();
      },
    });
  }

  // ---- keys ------------------------------------------------------------------

  function onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (dialogIsOpen()) {
        escapeDialog();
        event.preventDefault();
        return;
      }
      if (picker) return;
      if (stage.simId !== null) {
        stage.escape();
        event.preventDefault();
      }
      return;
    }
    const route = router.current();
    const typing =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement;
    if (route.name === 'chronicle' && route.results && !dialogIsOpen() && !typing) {
      const entry = services.library.get(route.id);
      if (!entry) return;
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        play(entry.simId, {
          kind: 'new',
          scenario: entry.setup.scenario,
          seats: entry.setup.seats,
        });
      } else if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        router.go({ name: 'hall', focus: entry.simId });
      }
    }
  }
  window.addEventListener('keydown', onKey);

  // ---- subscriptions ---------------------------------------------------------

  const stopSettings = services.settings.subscribe((settings, changed) => {
    applySettings();
    if (changed.has('theme') && renderedRoute) void renderRoute(router.current());
    else if ((changed.has('resolvedAppearance') || changed.has('reducedMotion')) && themeView) {
      themeView.setAppearance(settings.resolvedAppearance, settings.reducedMotion);
    }
    if (changed.has('resolvedAppearance') || changed.has('theme')) {
      const route = router.current();
      if (route.name !== 'hall' && route.name !== 'sim' && route.name !== 'play') renderPage(route);
    }
    picker?.setAppearance(settings.resolvedAppearance);
  });
  const stopModel = model.subscribe((snapshot) => {
    themeView?.update(snapshot);
    const route = router.current();
    if (route.name === 'library' || route.name === 'codex' || route.name === 'legacy')
      renderPage(route);
  });
  const stopMilestones = services.milestones.subscribe(({ def }) => {
    services.audio.play('milestone');
    toasts.show({
      title: `Milestone: ${def.title}`,
      detail: `${def.description} +${def.points} Legacy points`,
      art: icon('legacy', 22),
      kind: 'milestone',
    });
  });
  const stopCodex = services.codex.subscribe((discovery) => {
    if (discovery.isNew) {
      toasts.show({
        title: `New in your Codex: ${discovery.def.title}`,
        detail: discovery.def.summary,
        art: icon('codex', 22),
        kind: 'codex',
      });
    } else if (discovery.revealedNow) {
      toasts.show({
        title: `${discovery.def.title}: the workings revealed`,
        detail: 'Read how the model computes it in the Codex.',
        art: icon('codex', 22),
        kind: 'codex',
      });
    }
  });
  services.store.onDegraded((reason) => banner.replaceChildren(storageBanner(reason)));
  const stopRouter = router.subscribe((route) => void renderRoute(route));
  const stopUnlock = unlockOnFirstGesture(services.audio);

  applySettings();
  void (async () => {
    const settings = services.settings.get();
    if (!settings.introSeen) await runIntro();
    if (!services.settings.get().themeChosen) openPicker();
    await renderRoute(router.current());
  })();

  return {
    services,
    model,
    stage,
    router,
    dispose() {
      window.removeEventListener('keydown', onKey);
      stopSettings();
      stopModel();
      stopMilestones();
      stopCodex();
      stopRouter();
      stopUnlock();
      stage.close();
      unmountTheme();
      demos.disposeAll();
      router.dispose();
      services.audio.dispose();
    },
  };
}

/** The six palettes as CSS custom properties, written once from tokens.ts. */
function injectPalettes(): void {
  if (document.getElementById('omy-palettes')) return;
  const style = document.createElement('style');
  style.id = 'omy-palettes';
  style.textContent = paletteCss();
  document.head.append(style);
}

function pageName(route: Route): TopBarState['page'] {
  switch (route.name) {
    case 'library':
    case 'chronicle':
      return 'library';
    case 'codex':
      return 'codex';
    case 'legacy':
      return 'legacy';
    case 'about':
      return 'about';
    case 'sim':
    case 'play':
      return 'play';
    case 'hall':
      return 'hall';
  }
}
