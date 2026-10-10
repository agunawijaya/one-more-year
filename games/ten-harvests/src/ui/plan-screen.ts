/**
 * The plan screen: the decree tablet on the left, the living city in the
 * centre with the grain budget beneath it, the honest ledger on the right,
 * the year at the top and the ten-year strip along the foot.
 *
 * The screen owns no rules. It is handed the state, the draft decree, its
 * issues and its ledger, and reports every change of the decree back; the
 * caller (the play session) decides what is allowed.
 */
import { el, setText, svg } from './dom.ts';
import { createBudgetBar } from './budget-bar.ts';
import { createLedgerPanel, createTablet } from './panels.ts';
import { createYearStrip, type YearTile } from './strip.ts';
import { n, WORDS } from './words.ts';
import type { Ledger } from '../engine/odds.ts';
import type { CityState, Decree } from '../engine/state.ts';
import type { PlanIssue } from '@one-more-year/kit';

export interface PlanView {
  state: CityState;
  decree: Decree;
  issues: readonly PlanIssue[];
  ledger: Ledger;
  turnLabel: string;
  scenarioTitle: string;
  years: readonly YearTile[];
  forecastsHidden: boolean;
  /** Short lines about the year just lived. */
  lastYear: readonly string[];
  /** The scribe's advice, or null when hints are off or there is nothing to say. */
  scribe: string | null;
  /** On a replayed world, what the earlier run had at this point. */
  ghost: string | null;
  /** The decree would end the rule and the button has been pressed once. */
  armed: boolean;
}

export interface PlanHandlers {
  change(decree: Decree): void;
  commit(): void;
}

export interface PlanScreen {
  readonly element: HTMLElement;
  /** Where the city's canvas lives on this screen. */
  readonly dioramaHost: HTMLElement;
  /** The 1978 Ledger's teletype goes here (null on the normal plan screen). */
  readonly dock: HTMLElement | null;
  update(view: PlanView): void;
  focusField(field: 'land' | 'food' | 'plant'): void;
  refuse(field: 'land' | 'food' | 'plant', reason: string): void;
}

/**
 * 'decree' is the normal plan screen; 'teletype' is the 1978 Ledger's: the
 * typed console docked where the decree tablet stands, the city beside it,
 * no granary bar and no ledger, as in the original.
 */
export function createPlanScreen(
  emblem: string,
  handlers: PlanHandlers,
  variant: 'decree' | 'teletype' = 'decree',
): PlanScreen {
  let current: PlanView | null = null;

  function withField(field: 'land' | 'food' | 'plant', value: number): Decree | null {
    if (!current) return null;
    const decree = { ...current.decree };
    if (field === 'food') decree.food = Math.max(0, Math.round(value)) * 20;
    else decree[field] = Math.round(value);
    return decree;
  }

  const tablet = createTablet({
    step(field, delta) {
      if (!current) return;
      const base = field === 'food' ? Math.floor(current.decree.food / 20) : current.decree[field];
      const next = withField(field, base + delta);
      if (next) handlers.change(next);
    },
    type(field, value) {
      if (!Number.isFinite(value)) return;
      const next = withField(field, value);
      if (next) handlers.change(next);
    },
    commit: () => handlers.commit(),
  });
  const ledger = createLedgerPanel();
  const budget = createBudgetBar((decree) => handlers.change(decree));
  const strip = createYearStrip();

  const yearLabel = el('div', { class: 'th-year' });
  const signals = el('div', { class: 'th-signals' });
  const mark = svg(
    'svg',
    { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svg('path', { d: emblem }),
  );
  const scenario = el('span');
  const topbar = el(
    'header',
    { class: 'th-topbar' },
    el(
      'div',
      { class: 'th-title' },
      mark,
      el('div', {}, el('strong', {}, WORDS.title), el('br'), scenario),
    ),
    yearLabel,
    signals,
  );
  const dioramaHost = el('div', { class: 'th-diorama' });
  const dock =
    variant === 'teletype'
      ? el('section', { class: 'th-dock th-clay', 'aria-label': 'The teletype' })
      : null;
  const element = dock
    ? el('div', { class: 'th-plan th-plan--teletype' }, topbar, dock, dioramaHost, strip.element)
    : el(
        'div',
        { class: 'th-plan' },
        topbar,
        tablet.element,
        dioramaHost,
        budget.element,
        ledger.element,
        strip.element,
      );

  return {
    element,
    dioramaHost,
    dock,
    update(view) {
      current = view;
      const { state, decree } = view;
      setText(scenario, view.scenarioTitle);
      yearLabel.replaceChildren(
        view.turnLabel,
        el('small', {}, `Land at ${n(state.landPrice)} bushels an acre`),
      );
      signals.replaceChildren(
        ...[
          ['People', state.people],
          ['Grain', state.grain],
          ['Acres', state.acres],
        ].map(([label, value]) =>
          el(
            'div',
            { class: 'th-signal' },
            el('b', {}, n(value as number)),
            el('span', {}, label as string),
          ),
        ),
      );
      strip.update(view.years);
      if (dock) return;
      tablet.update(state, decree, view.issues, {
        lastYear: view.lastYear,
        scribe: view.scribe,
        ghost: view.ghost,
        armed: view.armed,
      });
      budget.update(state, decree);
      ledger.update(state, view.ledger, view.forecastsHidden);
    },
    focusField(field) {
      tablet.focus(field);
    },
    refuse(field, reason) {
      tablet.refuse(field, reason);
    },
  };
}
