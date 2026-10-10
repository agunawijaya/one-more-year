/**
 * Pond's screens: the game menu, the plan for a year, and the report of how
 * the year went. They show the kit's play session; the session does the
 * saving, reporting and chronicling, so this file is only about what the
 * player sees and touches.
 *
 * The flow follows the collection's navigation standard: the Hall draws the
 * "Back to the Hall" link on the game menu and the pause button during play;
 * Pond tells it which view is showing with ctx.setView.
 */
import {
  byWeight,
  describeEvent,
  describeForecast,
  forecast,
  formatDelta,
  formatNumber,
  formatPercent,
  type AmbienceBed,
  type DemoLook,
  type Discovery,
  type Launch,
  type PlaySession,
  type SimContext,
  type SimInstance,
  type TurnModel,
  startPlay,
} from '@one-more-year/kit';
import { EPITHETS, EVENT_TEXT, MILESTONES, glyphFor, shareLineFor, titleFor } from './content.ts';
import { weatherOf } from './demo.ts';
import { YEARS, dailyScenario, pondModel, type PondPlan, type PondState } from './model.ts';
import { createPondScene, type PondScene } from './scene.ts';

/** Water lapping at a reedy bank: soft brown noise with a slow swell. */
export const WATER_BED: AmbienceBed = { noise: 'brown', cutoff: 420, gain: 0.22, swell: 9 };

const RULES = {
  model: pondModel,
  text: EVENT_TEXT,
  epithets: EPITHETS,
  title: titleFor,
  glyph: glyphFor,
  shareLine: shareLineFor,
  length: () => YEARS,
  dailyScenario,
  milestones: MILESTONES,
};

/**
 * The catch alone, as a model of its own: it involves no chance, so the kit
 * forecasts it exactly ("exactly 150 fish left"), while the whole year is a
 * range.
 */
const catchOnly: TurnModel<PondState, PondPlan> = {
  ...pondModel,
  resolve: (state, plan) => ({
    state: {
      ...state,
      ponds: state.ponds.map((pond, seat) =>
        seat === state.seat ? { ...pond, fish: pond.fish - plan.catch } : pond,
      ),
    },
    events: [],
  }),
};

type Attributes = Record<string, string | number | boolean | undefined>;

/** A small element helper: attributes, then children (strings become text). */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null) element.append(child);
  return element;
}

export function mountPond(host: HTMLElement, ctx: SimContext): SimInstance {
  const root = el('div', { class: 'pond', 'data-appearance': ctx.appearance.current });
  host.append(root);

  let session: PlaySession<PondState, PondPlan> | null = null;
  let scene: PondScene | null = null;
  let lastSeatShown = -1;

  const lookFor = (
    appearance = ctx.appearance.current,
    reducedMotion = ctx.appearance.reducedMotion,
  ): DemoLook => ({
    appearance,
    reducedMotion,
    style: 'diorama',
    palette:
      appearance === 'dark'
        ? {
            paper: '#142828',
            ink: '#e4f2ef',
            muted: '#9dbbb6',
            accent: '#1f6f86',
            line: '#5fd3c6',
            glow: '#2b8fa6',
            good: '#2f6b3a',
            warning: '#f0a35c',
            disaster: '#ff8f86',
          }
        : {
            paper: '#ffffff',
            ink: '#13312f',
            muted: '#4a6662',
            accent: '#2a7f9a',
            line: '#14706e',
            glow: '#9fd8e6',
            good: '#7cb87a',
            warning: '#e8873a',
            disaster: '#a32020',
          },
  });

  const stopAppearance = ctx.appearance.subscribe((appearance, reducedMotion) => {
    root.dataset.appearance = appearance;
    scene?.setLook(lookFor(appearance, reducedMotion));
  });

  ctx.audio.setAmbience(WATER_BED);

  function drawScene(host: HTMLElement, state: PondState, weather: PondState['weather']): void {
    scene?.dispose();
    scene = createPondScene(host, lookFor(), 'The pond this year');
    const pond = state.ponds[state.seat] ?? state.ponds[0];
    if (pond) scene.update({ fish: pond.fish, weed: pond.weed, weather });
  }

  // ---- game menu -------------------------------------------------------------

  function showMenu(): void {
    session?.dispose();
    session = null;
    ctx.setView('menu');
    ctx.setPauseItems([]);
    const preview = pondModel.init({ seed: 1, scenario: 'still-water', seats: 1 });
    const sceneHost = el('div', { class: 'pond__scene pond__menu-scene' });
    const runs = ctx.runs.list();
    const daily = ctx.daily;

    root.replaceChildren(
      el(
        'div',
        { class: 'pond__menu' },
        el('p', { class: 'pond__eyebrow' }, 'A test world'),
        el('h1', { class: 'pond__title' }, ctx.manifest.title),
        el('p', {}, ctx.manifest.teaser),
        sceneHost,
        el('h2', {}, 'Begin a new pond'),
        el(
          'div',
          { class: 'pond__choices' },
          ...ctx.manifest.scenarios.map((scenario) =>
            choice(scenario.title, scenario.twist, `begin-${scenario.id}`, () =>
              play({ kind: 'new', scenario: scenario.id, seats: 1, seatNames: [] }),
            ),
          ),
          choice(
            `Today’s pond #${daily.number}`,
            daily.played
              ? 'Played today; replays are always welcome.'
              : 'The same pond for everyone today.',
            'begin-daily',
            () => play({ kind: 'daily' }),
          ),
          choice(
            'Two players, one pond each',
            'Take turns at one table; same weather for both.',
            'begin-hot-seat',
            () => play({ kind: 'new', scenario: 'still-water', seats: 2, seatNames: [] }),
          ),
        ),
        runs.length > 0 ? el('h2', {}, 'Continue') : null,
        runs.length > 0
          ? el(
              'ul',
              { class: 'pond__runs' },
              ...runs.map((run) =>
                el(
                  'li',
                  {},
                  choice(
                    run.turnLabel,
                    `${formatNumber(run.signals.fish ?? 0)} fish · ${scenarioTitle(run.setup.scenario)}`,
                    `continue-${run.id}`,
                    () => play({ kind: 'resume', runId: run.id }),
                  ),
                ),
              ),
            )
          : null,
        el(
          'div',
          { class: 'pond__presets' },
          button('How to play', () => ctx.openHowToPlay()),
        ),
      ),
    );
    drawScene(sceneHost, preview, 'fair');
  }

  function choice(
    title: string,
    detail: string,
    id: string,
    onSelect: () => void,
  ): HTMLButtonElement {
    const control = el(
      'button',
      { type: 'button', class: 'pond__choice', 'data-action': id },
      el('strong', {}, title),
      el('span', { class: 'pond__note' }, detail),
    );
    control.addEventListener('click', onSelect);
    return control;
  }

  function button(
    label: string,
    onSelect: () => void,
    attributes: Attributes = {},
  ): HTMLButtonElement {
    const control = el('button', { type: 'button', ...attributes }, label);
    control.addEventListener('click', onSelect);
    return control;
  }

  function scenarioTitle(id: string): string {
    return ctx.manifest.scenarios.find((scenario) => scenario.id === id)?.title ?? id;
  }

  // ---- play ------------------------------------------------------------------

  function play(launch: Exclude<Launch, { kind: 'menu' }>): void {
    session?.dispose();
    session = startPlay(ctx, RULES, launch);
    lastSeatShown = -1;
    if (session.chronicle) {
      ctx.setView('results', session.runId);
      return;
    }
    showPlan();
  }

  function showPlan(): void {
    if (!session) return;
    // Typed, not just narrowed: the nested functions below keep the type.
    const current: PlaySession<PondState, PondPlan> = session;
    const { engine } = current;
    const seat = engine.position.seat;
    if (engine.setup.seats > 1 && seat !== lastSeatShown) {
      lastSeatShown = seat;
      root.replaceChildren(el('div', { class: 'pond__menu' }));
      ctx.seats.handover(root, {
        seat,
        seats: ctx.seats.create(engine.setup.seats),
        detail: `Year ${engine.position.turn} of ${YEARS} · your pond is waiting`,
        onReady: showPlan,
      });
      ctx.setView('plan', current.runId);
      return;
    }
    lastSeatShown = seat;
    ctx.setView('plan', current.runId);
    ctx.setPauseItems([
      {
        id: 'reset-plan',
        label: 'Reset this year’s plan',
        onSelect: () => {
          engine.resetDraft();
          showPlan();
        },
      },
    ]);

    const state = engine.state;
    const pond = state.ponds[seat] ?? state.ponds[0];
    if (!pond) return;
    const sceneHost = el('div', { class: 'pond__scene' });
    const input = el('input', {
      type: 'number',
      id: 'pond-catch',
      min: 0,
      max: pond.fish,
      step: 1,
      value: engine.draft.catch,
      inputmode: 'numeric',
      'aria-describedby': 'pond-issues pond-forecast',
    });
    const slider = el('input', {
      type: 'range',
      min: 0,
      max: pond.fish,
      step: 1,
      value: engine.draft.catch,
      'aria-label': 'Catch this year',
      tabindex: -1,
    });
    const issues = el('ul', { class: 'pond__issues', id: 'pond-issues', 'aria-live': 'polite' });
    const forecastBox = el('div', {
      class: 'pond__forecast',
      id: 'pond-forecast',
      'aria-live': 'polite',
    });
    const commit = el(
      'button',
      { type: 'button', class: 'pond__primary', 'data-action': 'end-year' },
      'End the year',
    );
    const hint = el('p', { class: 'pond__note' });

    const setCatch = (value: number): void => {
      engine.setDraft({ catch: Number.isFinite(value) ? Math.round(value) : 0 });
      input.value = String(engine.draft.catch);
      slider.value = String(engine.draft.catch);
      refresh();
    };
    input.addEventListener('input', () => setCatch(input.valueAsNumber));
    slider.addEventListener('input', () => setCatch(slider.valueAsNumber));
    commit.addEventListener('click', () => endYear());

    function refresh(): void {
      const found = engine.issues();
      issues.replaceChildren(
        ...found.map((issue) => el('li', { class: `pond__issue--${issue.level}` }, issue.message)),
      );
      commit.disabled = !engine.canCommit();
      input.setAttribute('aria-invalid', String(found.some((issue) => issue.level === 'error')));
      if (ctx.settings.get().forecasts === 'hidden' || commit.disabled) {
        forecastBox.hidden = true;
        return;
      }
      forecastBox.hidden = false;
      const left = forecast(
        catchOnly,
        state,
        engine.draft,
        (after) => after.ponds[seat]?.fish ?? 0,
      );
      const next = current.forecast(
        {
          fish: (after) => after.ponds[seat]?.fish ?? 0,
          weed: (after) => (after.ponds[seat]?.weed ?? 0) / 100,
        },
        { samples: 240 },
      );
      forecastBox.replaceChildren(
        el(
          'p',
          {},
          `Left in the water after the catch: ${describeForecast(left, formatNumber)} fish.`,
        ),
        el('p', {}, `Fish next spring: ${describeForecast(next.fish, formatNumber)}.`),
        el('p', {}, `Weed next spring: ${describeForecast(next.weed, (v) => formatPercent(v))}.`),
      );
    }

    const advice = adviceFor(pond.fish, pond.weed, ctx.settings.get().advisorHints);
    hint.textContent = advice ?? '';
    hint.hidden = advice === null;
    const ghost = current.lastTime('fish');

    root.replaceChildren(
      el(
        'div',
        { class: 'pond__layout' },
        el(
          'section',
          { 'aria-label': 'The pond' },
          sceneHost,
          signalList(
            engine.history.filter((r) => r.seat === seat).at(-1)?.signals ??
              engine.opening[seat] ??
              {},
            null,
          ),
        ),
        el(
          'section',
          { class: 'pond__panel', 'aria-labelledby': 'pond-plan-title' },
          el(
            'p',
            { class: 'pond__eyebrow' },
            engine.setup.seats > 1 ? `${current.turnLabel} · Seat ${seat + 1}` : current.turnLabel,
          ),
          el('h2', { id: 'pond-plan-title' }, 'How many fish will you take?'),
          el(
            'div',
            { class: 'pond__field' },
            el('label', { for: 'pond-catch' }, 'Catch this year'),
            el('div', { class: 'pond__catch' }, input, slider),
            el(
              'div',
              { class: 'pond__presets' },
              button('None', () => setCatch(0)),
              button('Gentle', () => setCatch(Math.round(pond.fish * 0.1))),
              button('Heavy', () => setCatch(Math.round(pond.fish * 0.3))),
            ),
          ),
          issues,
          forecastBox,
          ghost !== null && current.ghost
            ? el(
                'p',
                { class: 'pond__note' },
                `Last time, at this point the pond held ${formatNumber(ghost)} fish.`,
              )
            : null,
          hint,
          el('p', {}, commit),
          el(
            'p',
            { class: 'pond__note' },
            'Once the year ends there is no going back: the pond keeps what happens.',
          ),
        ),
      ),
    );
    drawScene(sceneHost, state, null);
    refresh();
    input.focus();
  }

  function endYear(): void {
    const current = session;
    if (!current?.engine.canCommit()) return;
    const record = current.commit();
    ctx.audio.play(
      record.tone === 'disaster' || record.tone === 'hard' ? 'warning-bell' : 'harvest-chime',
    );
    showReport();
  }

  function showReport(): void {
    const current = session;
    const record = current?.engine.lastRecord;
    if (!current || !record) return;
    ctx.setView('report', current.runId);
    ctx.setPauseItems([]);
    const events = byWeight(record.events);
    const sceneHost = el('div', { class: 'pond__scene' });
    const before = previousSignals(current, record.seat, record.step);
    const ended = current.engine.outcome !== null;
    const proceed = el(
      'button',
      { type: 'button', class: 'pond__primary', 'data-action': 'continue' },
      ended
        ? 'See how it ended'
        : `Continue to year ${record.turn + (current.engine.position.seat === 0 ? 1 : 0)}`,
    );
    proceed.addEventListener('click', () => {
      const chronicle = current.proceed();
      if (chronicle) {
        ctx.setView('results', current.runId);
        return;
      }
      showPlan();
    });
    const ghost = current.lastTime('fish');

    root.replaceChildren(
      el(
        'div',
        { class: 'pond__layout' },
        el('section', { 'aria-label': 'The pond' }, sceneHost, signalList(record.signals, before)),
        el(
          'section',
          { class: 'pond__panel', 'aria-labelledby': 'pond-report-title' },
          el('p', { class: 'pond__eyebrow' }, `Year ${record.turn} · report`),
          el(
            'h2',
            { id: 'pond-report-title' },
            events[0] ? describeEvent(EVENT_TEXT, events[0]) : 'A quiet year.',
          ),
          el(
            'ul',
            { class: 'pond__events' },
            ...events
              .slice(1)
              .map((e) =>
                el('li', { class: `pond__event--${e.severity}` }, describeEvent(EVENT_TEXT, e)),
              ),
          ),
          ...current.discoveries.filter((found) => found.isNew).map(codexCard),
          ghost !== null && current.ghost
            ? el(
                'p',
                { class: 'pond__note' },
                `Last time, after this year: ${formatNumber(ghost)} fish.`,
              )
            : null,
          el('p', {}, proceed),
        ),
      ),
    );
    drawScene(sceneHost, { ...current.engine.state, seat: record.seat }, weatherOf(record.events));
    proceed.focus();
  }

  function previousSignals(current: PlaySession<PondState, PondPlan>, seat: number, step: number) {
    const earlier = current.engine.history.filter((r) => r.seat === seat && r.step < step).at(-1);
    return earlier?.signals ?? current.engine.opening[seat] ?? null;
  }

  function signalList(
    signals: Record<string, number>,
    before: Record<string, number> | null,
  ): HTMLElement {
    const row = (label: string, value: string, delta: string | null): HTMLElement =>
      el(
        'div',
        { class: 'pond__signal' },
        el('dt', {}, label),
        el('dd', {}, value, delta ? el('span', { class: 'pond__delta' }, delta) : null),
      );
    const change = (id: string, format: (n: number) => string): string | null =>
      before ? format((signals[id] ?? 0) - (before[id] ?? 0)) : null;
    return el(
      'dl',
      { class: 'pond__signals' },
      row(
        'Fish',
        formatNumber(signals.fish ?? 0),
        change('fish', (n) => formatDelta(n)),
      ),
      row(
        'Weed',
        formatPercent(signals.weed ?? 0),
        change('weed', (n) => `${formatDelta(n * 100)} pts`),
      ),
      row(
        'Caught',
        formatNumber(signals.caught ?? 0),
        change('caught', (n) => formatDelta(n)),
      ),
    );
  }

  function codexCard(found: Discovery): HTMLElement {
    const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    art.setAttribute('viewBox', '0 0 48 48');
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = found.def.art;
    ctx.audio.play('discovery');
    return el(
      'div',
      { class: 'pond__codex-card', role: 'note' },
      art,
      el(
        'div',
        {},
        el('strong', {}, `New in your Codex: ${found.def.title}`),
        el('p', { class: 'pond__note' }, found.def.summary),
      ),
    );
  }

  if (ctx.launch.kind === 'menu') showMenu();
  else play(ctx.launch);

  return {
    pause() {
      ctx.audio.setAmbience(null);
    },
    resume() {
      ctx.audio.setAmbience(WATER_BED);
    },
    gameMenu: showMenu,
    leaveCheck: () => session?.leaveCheck() ?? 'safe',
    keepDraft: () => session?.keepDraft(),
    dispose() {
      session?.dispose();
      scene?.dispose();
      stopAppearance();
      ctx.audio.setAmbience(null);
      root.remove();
    },
  };
}

/** A word from the advisor, or null. 'quiet' keeps only the warnings that matter most. */
function adviceFor(fish: number, weed: number, mode: 'on' | 'quiet' | 'off'): string | null {
  if (mode === 'off') return null;
  if (weed > 60)
    return 'Weed covers most of the pond: blooms are likely. More fish would graze it down.';
  if (fish < 40) return 'The shoal is small. Every fish left now is next spring’s young.';
  if (mode === 'quiet') return null;
  if (weed > 50)
    return 'Weed is creeping past half the pond. A lighter catch lets the fish keep it in check.';
  return null;
}
