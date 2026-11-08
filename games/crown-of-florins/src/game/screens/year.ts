/**
 * A ruler's year on screen: the five steps, the plan they edit, the fresco
 * answering every change, and the seal.
 *
 * The plan lives in the kit's engine as the draft, so leaving and coming
 * back (or a reload) keeps it. Every change goes through `change`, which
 * clamps nothing silently: the engine's own validation marks what is not
 * allowed, and "Seal the year" asks once when the plan would do something
 * big (leave many hungry, cross the creditors' line, open the gates).
 */
import type { Appearance, PlaySession } from '@one-more-year/kit';
import { crownModel } from '../../engine/model.ts';
import { actingRealm } from '../../engine/world.ts';
import {
  BUILD_ITEMS,
  createYearScreen,
  type BuildKind,
  type YearView,
} from '../../ui/year-screen.ts';
import type { Plan, World } from '../../engine/state.ts';
import type { PillarId } from '../../engine/title.ts';
import type { StepId } from '../../content/words.ts';
import { el } from '../../ui/dom.ts';
import { createFrescoOverlay } from '../fresco-overlay.ts';
import type { Stage } from '../stage.ts';
import { forecastYear, projectPlan, type YearForecast } from '../year-model.ts';
import type { Preview } from '../../scene/city.ts';
import type { CameraPose } from '../../scene/view.ts';

export interface YearOptions {
  host: HTMLElement;
  session: PlaySession<World, Plan>;
  stage: Stage;
  appearance: () => Appearance;
  forecastsShown: () => boolean;
  reducedMotion: () => boolean;
  hiddenSeats: ReadonlySet<number>;
  ghost: string | null;
  startStep?: StepId;
  sound: {
    step(index: number): void;
    refuse(): void;
    grain(): void;
    mason(): void;
  };
  onPillarRead(id: PillarId): void;
  onStep?(step: StepId): void;
  onSeal(): void;
}

export interface YearRun {
  readonly view: YearView;
  setStep(step: StepId): void;
  /** Re-reads the appearance and the forecast setting. */
  refresh(): void;
  dispose(): void;
}

const STEP_ORDER: readonly StepId[] = ['harvest', 'market', 'bread', 'taxes', 'builders'];

export function runYear(options: YearOptions): YearRun {
  const { session, stage } = options;
  const engine = session.engine;
  let step: StepId = options.startStep ?? 'harvest';
  let forecast: YearForecast | null = null;
  let forecastTimer: number | null = null;
  let previewKind: Preview['kind'] = null;
  let lastPainted = '';
  let asked = false;

  const screen = createYearScreen({
    step: (next) => setStep(next),
    change: (update) => change(update),
    seal: () => seal(),
    pillarRead: (id) => options.onPillarRead(id),
    pickBuilding: (kind) => overlay.pickPlot(kind),
  });
  options.host.append(screen.element);
  stage.attach(screen.frescoHost);

  const world = (): World => engine.state;
  const realm = () => actingRealm(world());
  const overlay = createFrescoOverlay(screen.overlay, stage.view, stage.city(), {
    change: (update) => change(update),
    refuse: () => options.sound.refuse(),
    placed: (kind) => {
      previewKind = previewFor(kind);
      options.sound.mason();
    },
    grain: () => options.sound.grain(),
  });

  // ---- the camera: the city's painted framing, turned and drawn closer at the player's wish ------

  let turn = 0;
  let zoom = 1;
  function basePose(): CameraPose {
    return stage.cityPose({ elevation: 0.5, crestAt: 0.84 });
  }
  function applyPose(ease = 0): void {
    const base = basePose();
    stage.view.setPose(
      {
        ...base,
        azimuth: base.azimuth + turn,
        distance: base.distance * zoom,
      },
      ease,
    );
  }

  function paint(plan: Plan): void {
    const r = realm();
    const key = `${r.seat}:${world().year}:${plan.land}:${previewKind ?? ''}:${options.appearance()}`;
    if (key === lastPainted) return;
    lastPainted = key;
    stage.paintCity(r, {
      numbers: { land: r.land + plan.land },
      ...(previewKind ? { preview: { kind: previewKind } } : {}),
    });
    applyPose();
  }

  // ---- the plan --------------------------------------------------------------------------------------

  function change(update: (plan: Plan) => Plan): void {
    if (engine.phase !== 'plan') return;
    const next = update(engine.draft);
    engine.setDraft(sanitise(next));
    if (step === 'builders' && previewKind === null) {
      const added = BUILD_ITEMS.find((item) => engine.draft.build[item.key] > 0);
      if (added) previewKind = previewFor(added.key);
    }
    if (BUILD_ITEMS.every((item) => engine.draft.build[item.key] === 0)) previewKind = null;
    asked = false;
    render();
    scheduleForecast();
  }

  function scheduleForecast(): void {
    if (!options.forecastsShown()) {
      forecast = null;
      return;
    }
    if (forecastTimer !== null) window.clearTimeout(forecastTimer);
    forecastTimer = window.setTimeout(() => {
      forecastTimer = null;
      if (engine.phase !== 'plan') return;
      forecast = forecastYear(world(), engine.draft, engine.setup.seed, engine.history.length);
      render();
    }, 160);
  }

  function viewNow(): YearView {
    const r = realm();
    const plan = engine.draft;
    return {
      appearance: options.appearance(),
      world: world(),
      realm: r,
      plan,
      step,
      issues: crownModel.validate(world(), plan),
      projection: projectPlan(world(), r, plan),
      forecast,
      forecastsShown: options.forecastsShown(),
      hiddenSeats: options.hiddenSeats,
      ghost: options.ghost,
    };
  }

  let view = viewNow();
  function render(): void {
    view = viewNow();
    screen.update(view);
    overlay.update(view);
    paint(view.plan);
  }

  function setStep(next: StepId): void {
    if (next === 'review') return;
    step = next;
    const index = STEP_ORDER.indexOf(next);
    if (index >= 0) options.sound.step(index + 1);
    options.onStep?.(next);
    render();
    screen.focusStep();
  }

  // ---- sealing ------------------------------------------------------------------------------------------

  /** The big things a plan can do, which deserve one question before the seal. */
  function bigWarnings(): string[] {
    const v = view;
    const demand = v.realm.opening?.demand ?? 0;
    const warnings: string[] = [];
    if (demand > 0 && v.plan.release < demand * 0.8) {
      warnings.push(
        `Only ${Math.round((v.plan.release / demand) * 100)}% of the bread the people need: many will go hungry.`,
      );
    }
    if (v.projection.treasuryAfterSpending < v.projection.debt.line) {
      warnings.push(
        'This plan spends past the creditors’ line; unless the year’s income covers it, they will come.',
      );
    }
    const b = v.projection.border;
    if (b.threat !== null)
      warnings.push('The border watch is red: an army will march on the city this year.');
    return warnings;
  }

  function seal(): void {
    if (engine.phase !== 'plan') return;
    if (!engine.canCommit()) {
      const first = view.issues.find((issue) => issue.level === 'error');
      const stepFor: Record<string, StepId> = {
        grain: 'market',
        land: 'market',
        release: 'bread',
        customs: 'taxes',
        sales: 'taxes',
        wealth: 'taxes',
        justice: 'taxes',
      };
      const target = first?.field ? (stepFor[first.field] ?? 'builders') : step;
      options.sound.refuse();
      setStep(target);
      return;
    }
    const warnings = bigWarnings();
    if (warnings.length > 0 && !asked) {
      asked = true;
      confirmSeal(warnings);
      return;
    }
    options.onSeal();
  }

  function confirmSeal(warnings: readonly string[]): void {
    const back = el(
      'button',
      { type: 'button', class: 'cf-button', 'data-action': 'back-to-plan' },
      'Back to the plan',
    );
    const go = el(
      'button',
      { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'seal-anyway' },
      'Seal it anyway',
    );
    const dialog = el(
      'div',
      {
        class: 'cf-ask',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': 'cf-ask-title',
      },
      el(
        'div',
        { class: 'cf-ask__card cf-card' },
        el('h2', { id: 'cf-ask-title', class: 'cf-ask__title' }, 'Seal this year?'),
        el('ul', { class: 'cf-ask__list' }, ...warnings.map((w) => el('li', {}, w))),
        el('div', { class: 'cf-ask__actions' }, back, go),
      ),
    );
    const close = (): void => {
      window.removeEventListener('keydown', onKey, true);
      dialog.remove();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        screen.focusStep();
      }
    };
    back.addEventListener('click', () => {
      close();
      screen.focusStep();
    });
    go.addEventListener('click', () => {
      close();
      options.onSeal();
    });
    window.addEventListener('keydown', onKey, true);
    screen.element.append(dialog);
    go.focus();
  }

  // ---- keys ---------------------------------------------------------------------------------------------------

  function onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey) return;
    if (screen.element.querySelector('.cf-ask')) return;
    const target = event.target as HTMLElement | null;
    const typing = target instanceof HTMLInputElement && target.type === 'text';
    if (typing) return;
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0 && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setStep(STEP_ORDER[index] ?? 'harvest');
      return;
    }
    if (event.key === 'Enter') {
      // A focused button answers Enter itself; anywhere else Enter seals the year.
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
      event.preventDefault();
      seal();
      return;
    }
    if (event.key === 'b' || event.key === 'B') {
      event.preventDefault();
      if (step !== 'builders') setStep('builders');
      overlay.pickPlot('markets');
      return;
    }
    if (event.key === 'q' || event.key === 'Q' || event.key === 'e' || event.key === 'E') {
      turn = Math.max(-0.5, Math.min(0.5, turn + (event.key.toLowerCase() === 'q' ? -0.06 : 0.06)));
      applyPose(options.reducedMotion() ? 0 : 0.3);
      return;
    }
    if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_') {
      zoom = Math.max(
        0.6,
        Math.min(1.25, zoom * (event.key === '-' || event.key === '_' ? 1.08 : 0.92)),
      );
      applyPose(options.reducedMotion() ? 0 : 0.3);
    }
  }
  window.addEventListener('keydown', onKey);

  // Right-drag turns the fresco, the wheel draws it closer; both stay within a painter's range.
  const fresco = screen.frescoHost;
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    zoom = Math.max(0.6, Math.min(1.25, zoom * (event.deltaY > 0 ? 1.06 : 0.94)));
    applyPose(options.reducedMotion() ? 0 : 0.15);
  };
  const onContext = (event: MouseEvent): void => event.preventDefault();
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 2) return;
    const startX = event.clientX;
    const startTurn = turn;
    const move = (e: PointerEvent): void => {
      turn = Math.max(-0.5, Math.min(0.5, startTurn + (e.clientX - startX) * 0.003));
      applyPose();
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  fresco.addEventListener('wheel', onWheel, { passive: false });
  fresco.addEventListener('contextmenu', onContext);
  fresco.addEventListener('pointerdown', onPointerDown);

  render();
  applyPose();
  scheduleForecast();
  screen.focusStep();

  return {
    get view() {
      return view;
    },
    setStep,
    refresh() {
      lastPainted = '';
      scheduleForecast();
      render();
    },
    dispose() {
      if (forecastTimer !== null) window.clearTimeout(forecastTimer);
      window.removeEventListener('keydown', onKey);
      fresco.removeEventListener('wheel', onWheel);
      fresco.removeEventListener('contextmenu', onContext);
      fresco.removeEventListener('pointerdown', onPointerDown);
      overlay.dispose();
      screen.dispose();
    },
  };
}

function previewFor(kind: BuildKind): Preview['kind'] {
  switch (kind) {
    case 'cathedral':
      return 'cathedral';
    case 'palace':
      return 'palace';
    case 'markets':
      return 'market';
    case 'mills':
      return 'mill';
    default:
      return null;
  }
}

/** Whole numbers inside the hard limits of each field; the engine's validation still says why. */
function sanitise(plan: Plan): Plan {
  const whole = (n: number): number => (Number.isFinite(n) ? Math.round(n) : 0);
  return {
    ...plan,
    grain: whole(plan.grain),
    land: whole(plan.land),
    release: Math.max(0, whole(plan.release)),
    customs: Math.min(100, Math.max(0, whole(plan.customs))),
    sales: Math.min(50, Math.max(0, whole(plan.sales))),
    wealth: Math.min(25, Math.max(0, whole(plan.wealth))),
    build: {
      markets: Math.max(0, whole(plan.build.markets)),
      mills: Math.max(0, whole(plan.build.mills)),
      palace: Math.max(0, whole(plan.build.palace)),
      cathedral: Math.max(0, whole(plan.build.cathedral)),
      platoons: Math.max(0, whole(plan.build.platoons)),
    },
  };
}
