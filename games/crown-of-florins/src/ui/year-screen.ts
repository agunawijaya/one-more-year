/**
 * The year screen: the step bar along the top, the court on the left, the
 * fresco in the middle, the glass box on the right, the rivals along the
 * bottom (a 12-column grid: 3 · 6 · 3).
 *
 * Every panel fits above the rival bar at every size: the ruler and the
 * realm share a card of tabs, and so do the road, the border and the debt;
 * a step panel's body scrolls inside it, with a mark while there is more
 * below. "Seal the year" lives in the step bar alone.
 *
 * Every number here comes from the engine's own functions, through the
 * projection and the forecast (game/year-model.ts), so the panels and the
 * year that follows always agree. Panels that hold controls are built once
 * and updated in place, so a slider keeps its focus while everything around
 * it moves.
 */
import {
  formatNumber,
  ordinal,
  sparkline,
  type Appearance,
  type ChartTokens,
  type Forecast,
  type PlanIssue,
} from '@one-more-year/kit';
import { BUILDINGS, MARKET_RENT, SOLDIER_PAY, TAX_LIMITS, TOP_TITLE } from '../engine/rules.ts';
import { PILLARS, type PillarId } from '../engine/title.ts';
import { willingness } from '../engine/taxes.ts';
import type { Construction, Justice, Plan, Realm, World } from '../engine/state.ts';
import { RIVALS, titleName } from '../content/names.ts';
import {
  PILLAR_WORDS,
  STEPS,
  WEATHER_NAMES,
  cathedralPiece,
  florins,
  oddsInWords,
  palacePiece,
  type StepId,
} from '../content/words.ts';
import { raceWon, type Projection, type YearForecast } from '../game/year-model.ts';
import { amountControl, percentControl, sealsControl, JUSTICE_NAMES } from './controls.ts';
import { armsSvg } from './heraldry-svg.ts';
import { el, svgNode, type Child } from './dom.ts';
import { portraitSvg } from './portrait.ts';
import { scrollBody, type ScrollBody } from './scroll.ts';
import { createTabs } from './tabs.ts';

export interface YearView {
  appearance: Appearance;
  world: World;
  realm: Realm;
  plan: Plan;
  step: StepId;
  issues: readonly PlanIssue[];
  projection: Projection;
  /** Null while it is being worked out, or when the player has hidden forecasts. */
  forecast: YearForecast | null;
  forecastsShown: boolean;
  /** Human rivals whose numbers stay hidden until the year's end (hot-seat). */
  hiddenSeats: ReadonlySet<number>;
  /** "Last time, at this point: …" on a replay. */
  ghost: string | null;
}

export interface YearHandlers {
  step(step: StepId): void;
  change(update: (plan: Plan) => Plan): void;
  seal(): void;
  pillarRead(id: PillarId): void;
  /** Starts the keyboard way of placing a building (B). */
  pickBuilding(kind: BuildKind): void;
}

export type BuildKind = keyof Construction;

export interface YearScreen {
  readonly element: HTMLElement;
  /** Where the fresco's canvas goes. */
  readonly frescoHost: HTMLElement;
  /** Above the canvas: plots, sacks and handles the player can drag. */
  readonly overlay: HTMLElement;
  update(view: YearView): void;
  /** Puts focus on the first control of the current step. */
  focusStep(): void;
  dispose(): void;
}

const PLAY_STEPS = STEPS.filter((s) => s.id !== 'review');

export function createYearScreen(handlers: YearHandlers): YearScreen {
  const overlay = el('div', { class: 'cf-fresco__overlay' });
  const frescoHost = el(
    'div',
    { class: 'cf-fresco cf-year__fresco', 'data-region': 'fresco' },
    overlay,
  );
  const stepsBar = createStepBar(handlers);
  const ruler = el('div', { class: 'cf-year__ruler' });
  const realmLedgerHost = el('div', { class: 'cf-realm' });
  const courtTabs = createTabs('cf-court', 'Your court', [
    { id: 'ruler', label: 'The ruler', body: ruler },
    { id: 'realm', label: 'The realm', body: realmLedgerHost },
  ]);
  const stepHost = el('div', { class: 'cf-year__step' });
  const court = el(
    'section',
    { class: 'cf-year__court', 'aria-label': 'Your court' },
    courtTabs.element,
    stepHost,
  );
  const preview = el('div', { class: 'cf-year__preview' });
  const road = createRoadCard(handlers);
  const border = el('div', { class: 'cf-border' });
  const debt = el('div', { class: 'cf-debt' });
  const glassTabs = createTabs('cf-glass', 'The glass box', [
    { id: 'road', label: 'Road to the crown', body: road.element },
    { id: 'border', label: 'Border watch', body: border },
    { id: 'debt', label: 'Debt', body: debt },
  ]);
  const glass = el(
    'section',
    { class: 'cf-year__glass', 'aria-label': 'The glass box' },
    preview,
    glassTabs.element,
  );
  const rivals = el('ul', { class: 'cf-rivals', 'aria-label': 'The valley' });
  const element = el(
    'div',
    { class: 'cf-year' },
    stepsBar.element,
    el('div', { class: 'cf-year__main' }, court, frescoHost, glass),
    rivals,
  );

  const panels = createStepPanels(handlers);
  let shownStep: StepId | null = null;
  let shownWorld: World | null = null;

  function update(view: YearView): void {
    stepsBar.update(view);
    if (shownWorld !== view.world) {
      shownWorld = view.world;
      ruler.replaceChildren(rulerCard(view));
      rivals.replaceChildren(...rivalBar(view));
      // A year that opens with the border open opens on the border watch: never sprung, always shown.
      if (borderOpen(view)) glassTabs.select('border');
    }
    const panel = panels[view.step === 'review' ? 'builders' : view.step];
    if (shownStep !== view.step) {
      shownStep = view.step;
      stepHost.replaceChildren(panel.element);
      element.dataset.step = view.step;
    }
    panel.update(view);
    realmLedgerHost.replaceChildren(...realmLedger(view));
    preview.replaceChildren(...previewCards(view));
    road.update(view);
    border.replaceChildren(...borderCard(view));
    debt.replaceChildren(...debtCard(view));
    glassTabs.mark('border', borderOpen(view) ? 'an army will march' : null);
    glassTabs.mark(
      'debt',
      view.realm.treasury < 0 || view.projection.treasuryAfterSpending < 0 ? 'in debt' : null,
    );
    panel.scroll.refresh();
    courtTabs.refresh();
    glassTabs.refresh();
  }

  return {
    element,
    frescoHost,
    overlay,
    update,
    focusStep() {
      const step = shownStep === 'review' || shownStep === null ? 'builders' : shownStep;
      panels[step].focus();
    },
    dispose() {
      element.remove();
    },
  };
}

// ---- the step bar ---------------------------------------------------------------------

function createStepBar(handlers: YearHandlers): {
  element: HTMLElement;
  update(view: YearView): void;
} {
  const anno = el('span', { class: 'cf-steps__anno' });
  const where = el('span', { class: 'cf-steps__where' });
  const buttons = PLAY_STEPS.map((step) => {
    const node = el(
      'button',
      { type: 'button', class: 'cf-step', 'data-step': step.id },
      el('span', { class: 'cf-step__number', 'aria-hidden': 'true' }, String(step.number)),
      el('span', {}, step.label),
      el('span', { class: 'cf-visually-hidden' }, ` (key ${step.number})`),
    );
    node.addEventListener('click', () => handlers.step(step.id));
    return node;
  });
  const seal = el(
    'button',
    { type: 'button', class: 'cf-seal', 'data-action': 'seal' },
    svgNode(WAX_SEAL),
    el('span', {}, 'Seal the year'),
    el('kbd', {}, 'Enter'),
  );
  seal.addEventListener('click', () => handlers.seal());
  // Once a rival wears the crown, the whole table is told, and keeps being told.
  const race = el('p', { class: 'cf-steps__race', role: 'status', hidden: true });
  const element = el(
    'header',
    { class: 'cf-steps' },
    el('div', { class: 'cf-steps__year' }, anno, where),
    el(
      'nav',
      { 'aria-label': 'The steps of the year' },
      el('ol', { class: 'cf-steps__list' }, ...buttons.map((b) => el('li', {}, b))),
    ),
    race,
    seal,
  );
  return {
    element,
    update(view) {
      anno.textContent = `Anno ${view.world.year}`;
      const reign = view.world.year - view.realm.ruler.accession + 1;
      where.textContent = `${view.realm.city} · ${ordinal(reign)} year of the reign`;
      const index = PLAY_STEPS.findIndex((s) => s.id === view.step);
      buttons.forEach((node, i) => {
        if (i === index) node.setAttribute('aria-current', 'step');
        else node.removeAttribute('aria-current');
        node.toggleAttribute('data-done', i < index);
      });
      const won = raceWon(view.world);
      race.hidden = !won || won.seat === view.realm.seat;
      race.replaceChildren(
        ...(won
          ? [
              `${won.city} crowned `,
              el('span', { class: 'cf-steps__race-who' }, `${won.title} ${won.ruler}, `),
              String(won.year),
            ]
          : []),
      );
      const blocked = view.issues.some((issue) => issue.level === 'error');
      seal.toggleAttribute('data-blocked', blocked);
      seal.setAttribute('aria-describedby', blocked ? 'cf-plan-issues' : '');
    },
  };
}

const CROWN_MARK =
  '<svg viewBox="0 0 20 14" width="18" height="13" aria-hidden="true"><path d="M2 12L3 3L7.5 7.5L10 1.5L12.5 7.5L17 3L18 12Z" fill="#d8aa3a" stroke="#6a4a14" stroke-width="1" stroke-linejoin="round"/></svg>';

const WAX_SEAL =
  '<svg class="cf-seal__wax" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 1.5C16 3 18 1.8 20 4C22.4 6.6 24.4 8 24.5 13C24.5 18 22 20.5 19 22.6C16.4 24.4 15 25 13 24.5C10 25 7 23.6 5 21.4C2.6 19 1.5 16 1.6 13C1.6 9.6 3 6.8 5.4 4.6C7.6 2.6 10 1 13 1.5Z" fill="#7a1e10" stroke="#f0d9a8" stroke-width="1"/><path d="M8 15L10 9L13 13L16 9L18 15Z" fill="#f0d9a8"/><path d="M8 17H18" stroke="#f0d9a8" stroke-width="1.4"/></svg>';

// ---- the court -------------------------------------------------------------------------

function rulerCard(view: YearView): HTMLElement {
  const { realm, projection } = view;
  const ruler = realm.ruler;
  const title = titleName(realm.title, ruler.form);
  const life = projection.life;
  const portrait = svgNode(
    portraitSvg({
      ruler,
      age: life.age,
      title: realm.title,
      candle: life.candle,
      appearance: view.appearance,
      label: `${title} ${ruler.name} of ${realm.city}, aged ${life.age}`,
    }),
  );
  return el(
    'article',
    { class: 'cf-ruler' },
    portrait,
    el(
      'div',
      {},
      el('p', { class: 'cf-ruler__title' }, title),
      el('h2', { class: 'cf-ruler__name' }, `${ruler.name} of ${realm.city}`),
      el(
        'p',
        { class: 'cf-ruler__line' },
        `Aged ${life.age} · ${ruler.generation > 1 ? `${ordinal(ruler.generation)} of the line` : 'founder of the line'}`,
      ),
      el(
        'p',
        { class: 'cf-ruler__odds' },
        'Years allowed: ',
        el('strong', { class: 'cf-num' }, `${life.band[0]}–${life.band[1]}`),
        el('br'),
        'Chance of dying this year: ',
        el('strong', { class: 'cf-num' }, oddsInWords(life.thisYear)),
        el('br'),
        'Five more years: ',
        el('strong', { class: 'cf-num' }, `${Math.round(life.fiveMore * 100)}%`),
      ),
      omen(life.thisYear),
    ),
  );
}

/** The court's quiet signs as the end nears, read only from the public odds. */
function omen(thisYear: number): HTMLElement | null {
  if (thisYear >= 0.25)
    return el(
      'p',
      { class: 'cf-omen' },
      'The physician frowns over the pulse, and the court speaks softly.',
    );
  if (thisYear >= 0.1)
    return el('p', { class: 'cf-omen' }, 'The physician calls more often than before.');
  return null;
}

function realmLedger(view: YearView): Node[] {
  const { realm, plan, projection } = view;
  const p = realm.people;
  const change = (now: number, after: number, unit = ''): string =>
    after === now
      ? `${formatNumber(now)}${unit}`
      : `${formatNumber(now)} → ${formatNumber(after)}${unit}`;
  return [
    el(
      'dl',
      { class: 'cf-ledger' },
      row('Serfs', formatNumber(p.serfs)),
      row(
        'Soldiers',
        change(p.soldiers, p.soldiers + plan.build.platoons * BUILDINGS.platoon.soldiers),
      ),
      row('Merchants', formatNumber(p.merchants)),
      row('Nobles', formatNumber(p.nobles)),
      row('Clergy', formatNumber(p.clergy)),
      row('Prosperity', formatNumber(realm.prosperity, { decimals: 2 })),
      row('Treasury', change(realm.treasury, projection.treasuryAfterSpending, ' fl'), true),
      row('Grain', change(realm.grain, projection.storeAfterRelease, ' bu'), true),
      row('Land', change(realm.land, projection.landAfter, ' ha'), true),
    ),
    el(
      'p',
      { class: 'cf-ledger__note' },
      'Arrows show the realm after this plan, before the year’s income and the people’s changes.',
    ),
  ];
}

function row(label: string, value: string, wide = false): HTMLElement {
  return el(
    'div',
    { class: wide ? 'cf-ledger__wide' : null },
    el('dt', {}, label),
    el('dd', { class: 'cf-num' }, value),
  );
}

/**
 * A panel's heading: its words in small capitals, the first letter in colour and set inline with
 * the rest (illuminated initials are kept for the obituary and the chronicle).
 */
function heading(words: string, note: string | null): HTMLElement {
  return el(
    'h3',
    { class: 'cf-heading' },
    el('span', { class: 'cf-heading__words' }, words),
    note ? el('span', { class: 'cf-heading__note' }, note) : null,
  );
}

// ---- the step panels -----------------------------------------------------------------------

interface StepPanel {
  readonly element: HTMLElement;
  readonly scroll: ScrollBody;
  update(view: YearView): void;
  focus(): void;
}

/** A step's card: its heading, a body that scrolls within the card, and a foot that stays. */
function stepCard(
  step: PanelStep,
  title: string,
  number: number,
  body: Child[],
  foot: Child[],
): { element: HTMLElement; scroll: ScrollBody } {
  const scroll = scrollBody('cf-panel__body', title, ...body);
  const element = el(
    'article',
    { class: 'cf-card cf-panel', 'data-panel': step },
    heading(title, `step ${number} of 5`),
    scroll.element,
    el('div', { class: 'cf-panel__foot' }, ...foot),
  );
  return { element, scroll };
}

type PanelStep = Exclude<StepId, 'review'>;

function createStepPanels(handlers: YearHandlers): Record<PanelStep, StepPanel> {
  return {
    harvest: harvestPanel(handlers),
    market: marketPanel(handlers),
    bread: breadPanel(handlers),
    taxes: taxesPanel(handlers),
    builders: buildersPanel(handlers),
  };
}

function nextButton(handlers: YearHandlers, to: StepId, label: string): HTMLButtonElement {
  const node = el('button', { type: 'button', class: 'cf-next', 'data-action': `to-${to}` }, label);
  node.addEventListener('click', () => handlers.step(to));
  return node;
}

function issueLines(view: YearView, fields: readonly string[]): HTMLElement | null {
  const mine = view.issues.filter(
    (issue) => issue.field !== undefined && fields.includes(issue.field),
  );
  if (mine.length === 0) return null;
  return el(
    'ul',
    { class: 'cf-issues', id: 'cf-plan-issues', role: 'alert' },
    ...mine.map((issue) => el('li', { 'data-level': issue.level }, issue.message)),
  );
}

function harvestPanel(handlers: YearHandlers): StepPanel {
  const body = el('div', { class: 'cf-report' });
  const next = nextButton(handlers, 'market', 'To the market →');
  const { element, scroll } = stepCard('harvest', 'Harvest', 1, [body], [next]);
  return {
    element,
    scroll,
    update(view) {
      const opening = view.realm.opening;
      if (!opening) return;
      const weather = WEATHER_NAMES[opening.weather - 1] ?? 'A fair year';
      const lines: [string, string][] = [
        ['The year', weather],
        ['Fields worked', `${formatNumber(opening.worked)} ha`],
        ['Harvest', `${formatNumber(opening.harvest)} bu`],
        ['Rats ate', `${opening.ratPercent}% · ${formatNumber(opening.ratsAte)} bu`],
        ['In the granary', `${formatNumber(view.realm.grain)} bu`],
        ['The people need', `${formatNumber(opening.demand)} bu`],
        ['Grain', `${formatNumber(opening.grainPrice)} fl per 1,000 bu`],
        ['Land', `${formatNumber(opening.landPrice, { decimals: 1 })} fl per ha`],
      ];
      const news = opening.succession
        ? [
            el(
              'p',
              { class: 'cf-report__news' },
              `${opening.succession.ruler.name} died this winter; ${view.realm.ruler.name} takes the throne as ${titleName(view.realm.title, view.realm.ruler.form)}.`,
            ),
          ]
        : [];
      body.replaceChildren(
        ...news,
        el(
          'dl',
          { class: 'cf-ledger cf-ledger--single' },
          ...lines.map(([label, value]) => row(label, value, true)),
        ),
      );
    },
    focus: () => next.focus(),
  };
}

function marketPanel(handlers: YearHandlers): StepPanel {
  const grain = amountControl({
    id: 'cf-grain',
    label: 'Grain',
    verbs: { up: 'buy', down: 'sell' },
    unit: 'bushels',
    step: 100,
    big: 1000,
    onChange: (value) => handlers.change((plan) => ({ ...plan, grain: value })),
  });
  const land = amountControl({
    id: 'cf-land',
    label: 'Land',
    verbs: { up: 'buy', down: 'sell' },
    unit: 'hectares',
    step: 50,
    big: 500,
    onChange: (value) => handlers.change((plan) => ({ ...plan, land: value })),
  });
  const issues = el('div');
  const { element, scroll } = stepCard(
    'market',
    'Market',
    2,
    [grain.element, land.element, issues],
    [nextButton(handlers, 'bread', 'To the bread →')],
  );
  return {
    element,
    scroll,
    update(view) {
      const { realm, plan, projection } = view;
      const opening = realm.opening;
      const price = opening?.grainPrice ?? 0;
      const landPrice = opening?.landPrice ?? 0;
      const buyGrain = Math.max(20_000, Math.ceil(((opening?.demand ?? 0) * 2) / 1000) * 1000);
      grain.update(
        plan.grain,
        { min: -realm.grain, max: buyGrain },
        `${formatNumber(price)} fl per 1,000 bushels · ${moneyLine(-projection.grainCost)}`,
      );
      const canBuy = view.world.terms.landForSale;
      land.update(
        plan.land,
        { min: -projection.sellable, max: canBuy ? 20_000 : 0 },
        canBuy
          ? `${formatNumber(landPrice, { decimals: 1 })} fl per hectare · ${moneyLine(-projection.landCost)}`
          : `No one sells land here; you may sell at ${formatNumber(landPrice, { decimals: 1 })} fl a hectare.`,
      );
      issues.replaceChildren(issueLines(view, ['grain', 'land']) ?? '');
    },
    focus: () => grain.focus(),
  };
}

function moneyLine(delta: number): string {
  if (delta === 0) return 'no florins change hands';
  return delta > 0 ? `you receive ${florins(delta)}` : `you pay ${florins(-delta)}`;
}

function breadPanel(handlers: YearHandlers): StepPanel {
  const release = amountControl({
    id: 'cf-release',
    label: 'Release',
    unit: 'bushels',
    step: 100,
    big: 1000,
    onChange: (value) => handlers.change((plan) => ({ ...plan, release: value })),
  });
  const gauge = el('div', { class: 'cf-gauge', 'aria-hidden': 'true' });
  const shortcuts = el('div', { class: 'cf-shortcuts' });
  const share = el('p', { class: 'cf-bread__share' });
  const issues = el('div');
  const { element, scroll } = stepCard(
    'bread',
    'Bread',
    3,
    [release.element, gauge, share, shortcuts, issues],
    [nextButton(handlers, 'taxes', 'To taxes and justice →')],
  );
  return {
    element,
    scroll,
    update(view) {
      const { plan, projection, realm } = view;
      const demand = realm.opening?.demand ?? 0;
      const { least, most } = projection.release;
      release.update(
        plan.release,
        { min: least, max: most },
        `At least ${formatNumber(least)} (a fifth of the store), at most ${formatNumber(most)} (four fifths).`,
      );
      const span = Math.max(1, most - least);
      const at = (value: number): string =>
        `${Math.min(100, Math.max(0, ((value - least) / span) * 100)).toFixed(1)}%`;
      const mark = (value: number, label: string, kind = ''): HTMLElement =>
        el(
          'span',
          {
            class: `cf-gauge__mark ${kind}`,
            style: `left:${at(value)}`,
            'data-end': (value - least) / span > 0.8 ? true : null,
          },
          el('span', {}, label),
        );
      const marks: HTMLElement[] = [];
      if (demand >= least && demand <= most) marks.push(mark(demand, 'need'));
      if (demand * 1.3 >= least && demand * 1.3 <= most) {
        marks.push(mark(Math.ceil(demand * 1.3), '130%', 'cf-gauge__mark--plenty'));
      }
      gauge.replaceChildren(
        el('span', { class: 'cf-gauge__fill', style: `width:${at(plan.release)}` }),
        ...marks,
      );
      const percent = demand > 0 ? Math.round((plan.release / demand) * 100) : 100;
      share.textContent = projection.newcomers
        ? `${percent}% of what the people need: enough to draw newcomers.`
        : projection.fed
          ? `${percent}% of what the people need: everyone is fed.`
          : `${percent}% of what the people need: some will go hungry.`;
      // Each shortcut sets the release, buying just enough grain first when the store is too small
      // to give that much (four fifths of the store is the most that can go out).
      const choices: [string, number][] = [
        ['Feed everyone', demand],
        ['Enough for newcomers', Math.ceil(demand * 1.3)],
      ];
      shortcuts.replaceChildren(
        ...choices.map(([label, value]) => {
          const buy = Math.max(0, Math.ceil(value / 0.8) - (realm.grain + plan.grain));
          const text = buy > 0 ? `${label} (buy ${formatNumber(buy)} bu)` : label;
          const node = el(
            'button',
            { type: 'button', class: 'cf-chip', 'data-release': label },
            text,
          );
          node.addEventListener('click', () =>
            handlers.change((p) => ({ ...p, grain: p.grain + buy, release: value })),
          );
          return node;
        }),
      );
      issues.replaceChildren(issueLines(view, ['release']) ?? '');
    },
    focus: () => release.focus(),
  };
}

function taxesPanel(handlers: YearHandlers): StepPanel {
  const customs = percentControl({
    id: 'cf-customs',
    label: 'Customs',
    max: TAX_LIMITS.customs.max,
    onChange: (value) => handlers.change((plan) => ({ ...plan, customs: value })),
  });
  const sales = percentControl({
    id: 'cf-sales',
    label: 'Sales tax',
    max: TAX_LIMITS.sales.max,
    onChange: (value) => handlers.change((plan) => ({ ...plan, sales: value })),
  });
  const wealth = percentControl({
    id: 'cf-wealth',
    label: 'Wealth tax',
    max: TAX_LIMITS.wealth.max,
    onChange: (value) => handlers.change((plan) => ({ ...plan, wealth: value })),
  });
  const seals = sealsControl((value: Justice) =>
    handlers.change((plan) => ({ ...plan, justice: value })),
  );
  const willing = el('p', { class: 'cf-taxes__willing' });
  const justiceNote = el('p', { class: 'cf-taxes__justice' });
  const { element, scroll } = stepCard(
    'taxes',
    'Taxes and justice',
    4,
    [
      customs.element,
      sales.element,
      wealth.element,
      willing,
      el('p', { class: 'cf-panel__label' }, 'The seal of justice'),
      seals.element,
      justiceNote,
    ],
    [nextButton(handlers, 'builders', 'To the builders →')],
  );
  return {
    element,
    scroll,
    update(view) {
      const { plan, realm } = view;
      const last = realm.taxes;
      customs.update(plan.customs, last.customs, 'Paid by nobles, clergy and merchants.');
      sales.update(
        plan.sales,
        last.sales,
        'Paid by nobles and merchants; harsher courts shrink it.',
      );
      wealth.update(plan.wealth, last.wealth, 'Paid mostly by the nobles.');
      seals.update(plan.justice);
      willing.textContent = `Willingness to pay: ${Math.round(willingness(plan) * 100)}% (150 less the three taxes).`;
      const courts = (plan.justice * 300 - 500) * realm.title;
      const flee =
        plan.justice >= 3 ? ` Up to ${plan.justice === 3 ? 1 : 4}% of serfs may flee.` : '';
      justiceNote.textContent = `${JUSTICE_NAMES[plan.justice - 1] ?? ''}: the courts ${courts >= 0 ? `bring in ${florins(courts)}` : `cost ${florins(-courts)}`}, and ${plan.justice} is taken from the title.${flee}`;
    },
    focus: () => customs.focus(),
  };
}

interface BuildItem {
  key: BuildKind;
  name: string;
  cost: number;
  effect: (realm: Realm) => string;
}

export const BUILD_ITEMS: readonly BuildItem[] = [
  {
    key: 'markets',
    name: 'Marketplace',
    cost: BUILDINGS.market.cost,
    effect: () => '+1 point · 5 merchants · 75 fl rent a year',
  },
  {
    key: 'mills',
    name: 'Woollen mill',
    cost: BUILDINGS.mill.cost,
    effect: () => '+1 point · 56–305 fl a year · 100 serfs at the looms',
  },
  {
    key: 'palace',
    name: 'Palace',
    cost: BUILDINGS.palace.cost,
    effect: (realm) => `+1 point · ${palacePiece(realm.holdings.palace + 1)} · 1–2 nobles`,
  },
  {
    key: 'cathedral',
    name: 'Cathedral',
    cost: BUILDINGS.cathedral.cost,
    effect: (realm) => `+1 point · ${cathedralPiece(realm.holdings.cathedral + 1)} · 1–6 clergy`,
  },
  {
    key: 'platoons',
    name: 'Platoon',
    cost: BUILDINGS.platoon.cost,
    effect: () => '20 serfs armed · they stand guard from next year',
  },
];

function buildersPanel(handlers: YearHandlers): StepPanel {
  const rows = BUILD_ITEMS.map((item) => {
    const count = el('output', { class: 'cf-num' });
    const less = el(
      'button',
      { type: 'button', 'aria-label': `One ${item.name.toLowerCase()} fewer` },
      '−',
    );
    const more = el(
      'button',
      { type: 'button', 'aria-label': `One ${item.name.toLowerCase()} more` },
      '+',
    );
    const effect = el('span', { class: 'cf-build__effect' });
    const card = el(
      'li',
      { class: 'cf-build__item', 'data-build': item.key, draggable: 'true' },
      svgNode(buildIcon(item.key)),
      el('span', { class: 'cf-build__name' }, item.name),
      el(
        'span',
        { class: 'cf-build__cost cf-num' },
        florins(item.cost),
        el(
          'span',
          { class: 'cf-stepper', role: 'group', 'aria-label': `${item.name}: how many` },
          less,
          count,
          more,
        ),
      ),
      effect,
    );
    const change = (delta: number): void =>
      handlers.change((plan) => ({
        ...plan,
        build: { ...plan.build, [item.key]: Math.max(0, plan.build[item.key] + delta) },
      }));
    less.addEventListener('click', () => change(-1));
    more.addEventListener('click', () => change(1));
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/x-cf-build', item.key);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    });
    return { item, card, count, less, more, effect };
  });
  const place = el(
    'button',
    { type: 'button', class: 'cf-chip', 'data-action': 'pick-building' },
    'Place on a plot (B)',
  );
  place.addEventListener('click', () => handlers.pickBuilding('markets'));
  // The builders end with what this year's works cost; the year is sealed from the step bar.
  const total = el('p', { class: 'cf-build__total' });
  const issues = el('div');
  const { element, scroll } = stepCard(
    'builders',
    'Builders',
    5,
    [
      el('ul', { class: 'cf-build' }, ...rows.map((r) => r.card)),
      el(
        'p',
        { class: 'cf-panel__hint' },
        'Drag a card onto a lit plot in the fresco, or use the steppers.',
      ),
      place,
      issues,
    ],
    [total],
  );
  return {
    element,
    scroll,
    update(view) {
      for (const r of rows) {
        const n = view.plan.build[r.item.key];
        r.count.textContent = String(n);
        r.less.disabled = n === 0;
        r.card.toggleAttribute('data-active', n > 0);
        r.effect.textContent = r.item.effect(view.realm);
      }
      const cost = view.projection.buildCost;
      total.replaceChildren(
        el('span', {}, 'This year’s works'),
        el(
          'strong',
          { class: 'cf-num' },
          `${florins(cost)} · after this plan ${florins(view.projection.treasuryAfterSpending)}`,
        ),
      );
      issues.replaceChildren(
        issueLines(
          view,
          BUILD_ITEMS.map((i) => `build.${i.key}`),
        ) ?? '',
      );
    },
    focus: () => rows[0]?.more.focus(),
  };
}

export function buildIcon(kind: BuildKind): string {
  const paths: Record<BuildKind, string> = {
    markets: 'M3 12L15 6L27 12V14H3ZM5 14V24M25 14V24M9 18H21V24H9Z',
    mills:
      'M15 15m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M15 6V24M6 15H24M8.6 8.6L21.4 21.4M21.4 8.6L8.6 21.4',
    palace: 'M5 26V12H11V8H13V12H17V4H21V12H25V26ZM13 26V20H17V26',
    cathedral: 'M4 26V15L15 6L26 15V26ZM15 2V6M13 3.5H17M15 13A3 3 0 1 0 15.1 13Z',
    platoons:
      'M8 26V8M8 8L4 12M8 8L12 12M22 26V8M22 8L18 12M22 8L26 12M15 26V5M15 5L11 9M15 5L19 9',
  };
  return `<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true"><path d="${paths[kind]}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ---- the glass box ---------------------------------------------------------------------------

function short(value: Forecast | undefined, unit = ''): string {
  if (!value) return '…';
  if (value.kind === 'exact') return `${formatNumber(value.value)}${unit}`;
  if (value.low === value.high) return `${formatNumber(value.low)}${unit}`;
  return `${formatNumber(value.low)}–${formatNumber(value.high)}${unit}`;
}

/**
 * The title the review would give, by name, and whether it changes: "Granduchessa → stays",
 * "→ Principessa", or both when the trial years disagree.
 */
export function titleWords(value: Forecast | undefined, realm: Realm): string {
  if (!value) return '…';
  const form = realm.ruler.form;
  const low = value.kind === 'exact' ? value.value : value.low;
  const high = value.kind === 'exact' ? value.value : value.high;
  const change = (title: number): string =>
    title <= realm.title
      ? `${titleName(realm.title, form)} → stays`
      : `→ ${titleName(title, form)}`;
  return low === high ? change(low) : `${change(low)}, or → ${titleName(high, form)}`;
}

/**
 * The treasury, told one way everywhere: after this plan (now, exact), and expected at the year's
 * end (after income, pay, taxes and interest), with the year's money line by line on hover or
 * focus. A forecast that held the same in every trial year is shown as its one number.
 */
function treasuryBlock(view: YearView): HTMLElement {
  const { realm, projection, forecast: f } = view;
  const after = projection.treasuryAfterSpending;
  const rent = Math.round(realm.holdings.markets * MARKET_RENT * view.world.terms.marketRentFactor);
  const pay = realm.people.soldiers * SOLDIER_PAY;
  const line = (label: string, value: string): HTMLElement =>
    el('div', {}, el('dt', {}, label), el('dd', { class: 'cf-num' }, value));
  const lines: HTMLElement[] = [
    line('After this plan', florins(after)),
    line('+ Market rents', florins(rent)),
    line('+ The mills', short(f?.mills, ' fl')),
    line('− Soldiers’ pay', florins(pay)),
    line('+ Customs', short(f?.customs, ' fl')),
    line('+ Sales tax', short(f?.sales, ' fl')),
    line('+ Wealth tax', short(f?.wealth, ' fl')),
    line('± The courts', short(f?.justice, ' fl')),
  ];
  const interest = f?.interest;
  if (interest && (interest.kind === 'exact' ? interest.value : interest.high) > 0) {
    lines.push(line('− Interest on debt', short(interest, ' fl')));
  }
  lines.push(line('= At the year’s end', short(f?.treasury, ' fl')));
  const breakdown = el(
    'div',
    { class: 'cf-money__how', role: 'tooltip', id: 'cf-money-how' },
    el('dl', { class: 'cf-ledger cf-ledger--single' }, ...lines),
    el(
      'p',
      { class: 'cf-money__note' },
      'Ranges held in 8 trial years in 10 each, so they need not add up exactly.',
    ),
  );
  return el(
    'div',
    { class: 'cf-money' },
    el(
      'p',
      { class: 'cf-money__row' },
      el('span', {}, 'After this plan'),
      el('strong', { class: 'cf-num' }, florins(after)),
    ),
    f
      ? el(
          'p',
          {
            class: 'cf-money__row cf-money__row--expected',
            tabindex: '0',
            'aria-describedby': 'cf-money-how',
          },
          el('span', {}, 'Expected at the year’s end'),
          el('strong', { class: 'cf-num' }, short(f.treasury, ' fl')),
          breakdown,
        )
      : null,
  );
}

/** The step's own forecast, at the top of the glass box. */
function previewCards(view: YearView): Node[] {
  if (!view.forecastsShown) {
    return [
      el(
        'article',
        { class: 'cf-card cf-preview' },
        heading('Forecasts hidden', null),
        el(
          'p',
          {},
          'As in 1978, the year keeps its secrets until it is sealed. Forecasts can be shown again in the settings.',
        ),
        el(
          'p',
          { class: 'cf-money__row' },
          el('span', {}, 'After this plan'),
          el('strong', { class: 'cf-num' }, florins(view.projection.treasuryAfterSpending)),
        ),
      ),
    ];
  }
  const f = view.forecast;
  const lines: [string, string][] = [];
  if (view.step === 'bread' || view.step === 'harvest' || view.step === 'market') {
    lines.push(
      ['Born', short(f?.births)],
      ['Died', short(f?.deaths)],
      ['Newcomers', short(f?.newcomers)],
    );
  }
  if (view.step === 'taxes') {
    lines.push(
      ['Customs', short(f?.customs, ' fl')],
      ['Sales tax', short(f?.sales, ' fl')],
      ['Wealth tax', short(f?.wealth, ' fl')],
      ['Courts', short(f?.justice, ' fl')],
      ['Serfs fleeing', short(f?.fled)],
    );
  }
  if (view.step === 'builders' || view.step === 'review') {
    lines.push(
      ['Mills bring', short(f?.mills, ' fl')],
      ['Title after the review', titleWords(f?.title, view.realm)],
    );
  }
  return [
    el(
      'article',
      { class: 'cf-card cf-preview', 'aria-live': 'polite' },
      heading('Preview of the year', '8 years in 10'),
      el(
        'dl',
        { class: 'cf-ledger cf-ledger--single' },
        ...lines.map(([label, value]) => row(label, value, true)),
      ),
      treasuryBlock(view),
      view.ghost ? el('p', { class: 'cf-preview__ghost' }, view.ghost) : null,
    ),
  ];
}

function createRoadCard(handlers: YearHandlers): {
  element: HTMLElement;
  update(view: YearView): void;
} {
  const ladder = el('span', { class: 'cf-road__next' });
  const points = el('span', { class: 'cf-num' });
  const meter = el('div', { class: 'cf-road__meter', role: 'img' });
  const fill = el('span');
  meter.append(fill);
  const formula = el('p', { class: 'cf-road__formula' });
  const items = PILLARS.map((rule) => {
    const words = PILLAR_WORDS[rule.id];
    const cells = Array.from({ length: 10 }, () => el('i'));
    const value = el('span', { class: 'cf-pillar__points cf-num' });
    const spoken = el('span', { class: 'cf-visually-hidden' });
    const item = el(
      'li',
      { class: 'cf-pillar', tabindex: '0', 'data-pillar': rule.id, title: words.raise },
      el('span', {}, words.label),
      el('span', { class: 'cf-pillar__cells', 'aria-hidden': 'true' }, ...cells),
      value,
      spoken,
      el('span', { class: 'cf-pillar__rule', role: 'tooltip' }, words.raise),
    );
    const read = (): void => handlers.pillarRead(rule.id);
    item.addEventListener('pointerenter', read);
    item.addEventListener('focus', read);
    return { rule, cells, value, spoken, item };
  });
  const element = el(
    'div',
    { class: 'cf-road' },
    el('div', { class: 'cf-road__ladder' }, ladder, points),
    meter,
    formula,
    el(
      'ul',
      { class: 'cf-pillars', 'aria-label': 'The twelve pillars' },
      ...items.map((i) => i.item),
    ),
  );
  return {
    element,
    update(view) {
      const road = view.projection.road;
      const form = view.realm.ruler.form;
      const next = road.next ?? TOP_TITLE;
      const needed = road.needed ?? 0;
      ladder.textContent =
        road.next === null
          ? `${titleName(TOP_TITLE, form)}: the crown is worn`
          : `${titleName(view.realm.title, form)} → ${titleName(next, form)}`;
      points.textContent =
        road.next === null ? `${road.points} points` : `${road.points} of ${needed} points`;
      const share = needed > 0 ? Math.min(1, road.points / needed) : 1;
      fill.style.width = `${(share * 100).toFixed(1)}%`;
      meter.setAttribute(
        'aria-label',
        `${road.points} of ${needed} points toward ${titleName(next, form)}`,
      );
      formula.textContent = `Points ÷ ${road.divisor} − justice ${road.justicePenalty} + 1, rounded down. Each pillar counts up to 10; gold shows this year’s works.`;
      const before = view.realm;
      items.forEach((entry, i) => {
        const now = road.pillars[i];
        if (!now) return;
        const was = pillarNow(before, entry.rule.id, entry.rule.per);
        entry.cells.forEach((cell, c) => {
          cell.toggleAttribute('data-on', c < Math.min(was, now.points));
          cell.toggleAttribute('data-gain', c >= was && c < now.points);
        });
        entry.value.textContent = String(now.points);
        entry.spoken.textContent = `: ${now.points} of 10`;
      });
    },
  };
}

function pillarNow(realm: Realm, id: PillarId, per: number): number {
  const quantity =
    id === 'markets' || id === 'palace' || id === 'cathedral' || id === 'mills'
      ? realm.holdings[id]
      : id === 'treasury'
        ? realm.treasury
        : id === 'land'
          ? realm.land
          : id === 'prosperity'
            ? realm.prosperity
            : realm.people[id];
  return Math.floor(Math.min(10, quantity / per));
}

/** True when an army will march on this realm this year, by the engine's own test. */
function borderOpen(view: YearView): boolean {
  const b = view.projection.border;
  return (
    b.soldiers < b.land / 1000 || (b.strongest !== null && b.strongest.soldiers > b.rivalLimit)
  );
}

function borderCard(view: YearView): Node[] {
  const b = view.projection.border;
  const landOk = b.soldiers >= b.land / 1000;
  const rivalOk = !b.strongest || b.strongest.soldiers <= b.rivalLimit;
  const open = !landOk || !rivalOk;
  const part = (state: boolean, label: string, value: string, detail: string): HTMLElement =>
    el(
      'li',
      { class: 'cf-watch__part', 'data-state': state ? 'safe' : 'open' },
      el('span', { class: 'cf-watch__mark', 'aria-hidden': 'true' }),
      el('span', { class: 'cf-watch__label' }, label),
      el('span', { class: 'cf-watch__value cf-num' }, value),
      el('span', { class: 'cf-watch__detail' }, detail),
      el('span', { class: 'cf-visually-hidden' }, state ? '(safe)' : '(open)'),
    );
  const strongest = b.strongest ? view.world.realms[b.strongest.seat] : null;
  return [
    el(
      'ul',
      { class: 'cf-watch' },
      part(
        landOk,
        'Soldiers for your land',
        `${formatNumber(b.soldiers)} of ${formatNumber(b.needed)}`,
        'One soldier for every 1,000 hectares, after this year’s land trade.',
      ),
      part(
        rivalOk,
        'Rival strength',
        b.strongest ? `${formatNumber(b.strongest.soldiers)} / ${formatNumber(b.rivalLimit)}` : '—',
        strongest
          ? `${strongest.city} has the strongest army; more than 2.4 times yours will march.`
          : 'A rival with more than 2.4 times your soldiers will march.',
      ),
      part(
        true,
        'Walls',
        b.atRisk[0] === b.atRisk[1]
          ? `${formatNumber(b.atRisk[1])} ha`
          : `${formatNumber(b.atRisk[0])}–${formatNumber(b.atRisk[1])} ha`,
        'The first 5,000 hectares are never taken; an army would take at most this much.',
      ),
    ),
    el(
      'p',
      {
        class: 'cf-verdict',
        'data-state': open ? 'open' : 'safe',
        'data-border': open ? 'open' : 'safe',
      },
      open
        ? 'An army will march on you this year: it is certain, not a gamble.'
        : 'No army will march this year.',
    ),
  ];
}

function debtCard(view: YearView): Node[] {
  const d = view.projection.debt;
  const after = view.projection.treasuryAfterSpending;
  const lines: Node[] = [];
  if (d.yearsToCreditors === null) {
    lines.push(el('p', {}, `No debt. The creditors would come below ${florins(d.line)}.`));
  } else {
    lines.push(
      el(
        'p',
        {},
        `In debt by ${florins(-d.treasury)}; interest adds ${florins(-d.interest)} a year. At this rate the creditors come in ${d.yearsToCreditors} ${d.yearsToCreditors === 1 ? 'year' : 'years'}.`,
      ),
    );
  }
  if (after < 0) {
    lines.push(
      el(
        'p',
        { class: after < d.line ? 'cf-debt__warn' : 'cf-debt__note' },
        `This plan spends down to ${florins(after)} before the year’s income${after < d.line ? ': past the creditors’ line' : ''}.`,
      ),
    );
  }
  return lines;
}

// ---- the rivals ----------------------------------------------------------------------------

function chartTokens(appearance: Appearance): ChartTokens {
  return appearance === 'dark'
    ? {
        ink: '#e3b65c',
        muted: '#c8b694',
        grid: '#5c4832',
        accent: '#f39478',
        ghost: '#8a7a64',
        band: 'rgba(227,182,92,0.15)',
        paper: '#251d16',
      }
    : {
        ink: '#5b4532',
        muted: '#5b4532',
        grid: '#b8996b',
        accent: '#a12e1a',
        ghost: '#a8957a',
        band: 'rgba(161,46,26,0.08)',
        paper: '#f4e8cf',
      };
}

function rivalBar(view: YearView): Node[] {
  const tokens = chartTokens(view.appearance);
  const seats = [view.realm, ...view.world.realms.filter((r) => r.seat !== view.realm.seat)];
  return seats.map((realm) => {
    const you = realm.seat === view.realm.seat;
    const hidden = !you && view.hiddenSeats.has(realm.seat);
    const standing = view.world.standings.find((s) => s.seat === realm.seat);
    const ended = realm.status === 'ended';
    const crownedIn = realm.record.crownedYear;
    const first = view.world.firstCrowned === realm.seat;
    const personality =
      realm.controller.kind === 'ai' ? RIVALS[realm.controller.personality].label : 'a human ruler';
    const arms = svgNode(
      armsSvg(realm.arms, { width: 40, label: `Arms of ${realm.city}` }).replace(
        '<svg ',
        '<svg class="cf-arms" ',
      ),
    );
    if (hidden) {
      return el(
        'li',
        { class: 'cf-card cf-rival', 'data-hidden': true },
        arms,
        el('span', { class: 'cf-rival__name' }, realm.city),
        el(
          'span',
          { class: 'cf-rival__title' },
          `${personality} · numbers shown at the year’s end`,
        ),
      );
    }
    const history =
      realm.pointsHistory.length > 1
        ? realm.pointsHistory
        : [standing?.points ?? 0, standing?.points ?? 0];
    const chart = sparkline(history.slice(-30), {
      label: `${realm.city}: title points`,
      tokens,
      width: 112,
      height: 34,
      area: true,
    });
    return el(
      'li',
      {
        class: 'cf-card cf-rival',
        'data-you': you ? true : null,
        'data-ended': ended ? true : null,
        'data-crowned': crownedIn !== null ? (first ? 'first' : 'after') : null,
      },
      arms,
      crownedIn !== null
        ? el(
            'span',
            { class: 'cf-rival__crown' },
            svgNode(CROWN_MARK),
            first ? `first crowned, ${crownedIn}` : `crowned ${crownedIn}`,
          )
        : null,
      el(
        'span',
        { class: 'cf-rival__name' },
        you ? realm.city : `${realm.ruler.name} of ${realm.city}`,
      ),
      el(
        'span',
        { class: 'cf-rival__title' },
        ended
          ? 'the line has ended'
          : `${titleName(standing?.title ?? realm.title, realm.ruler.form)} · ${personality}${standing?.aggressive ? ' · arming' : ''}`,
      ),
      el(
        'span',
        { class: 'cf-rival__points cf-num' },
        `${standing?.points ?? 0} pts · ${formatNumber(standing?.soldiers ?? 0)} soldiers`,
      ),
      Object.assign(el('span', { class: 'cf-rival__spark' }), { innerHTML: chart.markup }),
    );
  });
}
