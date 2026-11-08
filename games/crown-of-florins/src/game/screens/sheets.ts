/**
 * Crown of Florins' sheets: a modal panel over the game for the Ledger
 * (every number of the year), the Codex and the game's own options. Focus
 * stays inside while it is open, and Escape closes it before the Hall ever
 * hears the key.
 */
import { formatNumber, type CodexEntryView, type SimContext } from '@one-more-year/kit';
import { pillarBreakdown } from '../../engine/title.ts';
import { titleInputs } from '../../engine/year.ts';
import type { Realm, World } from '../../engine/state.ts';
import { titleName } from '../../content/names.ts';
import { PILLAR_WORDS, WEATHER_NAMES, florins } from '../../content/words.ts';
import { JUSTICE_NAMES } from '../../ui/controls.ts';
import { el } from '../../ui/dom.ts';
import { DIFFICULTY_NAMES } from './court-setup.ts';
import type { OptionStore } from '../options.ts';

export interface Sheet {
  close(): void;
}

export function openSheet(
  root: HTMLElement,
  title: string,
  body: (Node | null)[],
  onClose?: () => void,
): Sheet {
  const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const close = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'close-sheet' },
    'Close',
  );
  const panel = el(
    'div',
    {
      class: 'cf-sheet cf-card',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'cf-sheet-title',
      tabindex: -1,
    },
    el(
      'div',
      { class: 'cf-sheet__head' },
      el('h2', { id: 'cf-sheet-title', class: 'cf-sheet__title' }, title),
      close,
    ),
    el('div', { class: 'cf-sheet__body' }, ...body),
  );
  const backdrop = el('div', { class: 'cf-sheet-backdrop' }, panel);
  root.append(backdrop);
  panel.focus();

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    } else if (event.key === 'Tab') {
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>('button, input, select, summary, [tabindex="0"]'),
      ].filter((node) => !node.hidden);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    } else {
      // Keys typed in a sheet belong to the sheet, not to the year behind it.
      event.stopImmediatePropagation();
    }
  }
  window.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) finish();
  });
  close.addEventListener('click', () => finish());

  let open = true;
  function finish(): void {
    if (!open) return;
    open = false;
    window.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    returnTo?.focus();
    onClose?.();
  }
  return { close: finish };
}

// ---- the Ledger ------------------------------------------------------------------------

function table(caption: string, rows: readonly (readonly [string, string])[]): HTMLElement {
  return el(
    'table',
    { class: 'cf-table' },
    el('caption', {}, caption),
    el(
      'tbody',
      {},
      ...rows.map(([label, value]) =>
        el('tr', {}, el('th', { scope: 'row' }, label), el('td', { class: 'cf-num' }, value)),
      ),
    ),
  );
}

export function openLedger(root: HTMLElement, world: World, realm: Realm): Sheet {
  const p = realm.people;
  const opening = realm.opening;
  const log = realm.last;
  const pillars = pillarBreakdown(titleInputs(realm));
  const terms = world.terms;
  const changed: [string, string][] = [];
  if (terms.yieldFactor !== 1) changed.push(['Soil', `yields × ${terms.yieldFactor}`]);
  if (!terms.landForSale) changed.push(['Land market', 'no land for sale']);
  if (terms.customsFactor !== 1) changed.push(['Customs', `× ${terms.customsFactor}`]);
  if (terms.marketRentFactor !== 1) changed.push(['Market rent', `× ${terms.marketRentFactor}`]);
  if (terms.deathFactor !== 1) changed.push(['Deaths in a fed year', `× ${terms.deathFactor}`]);
  if (terms.newcomerFactor !== 1) changed.push(['Newcomers', `× ${terms.newcomerFactor}`]);

  return openSheet(root, `The Ledger · ${realm.city}, anno ${world.year}`, [
    el(
      'div',
      { class: 'cf-ledger-sheet' },
      table('The realm', [
        ['Ruler', `${titleName(realm.title, realm.ruler.form)} ${realm.ruler.name}`],
        ['Treasury', florins(realm.treasury)],
        ['Grain in store', `${formatNumber(realm.grain)} bu`],
        ['Land', `${formatNumber(realm.land)} ha`],
        ['Prosperity', formatNumber(realm.prosperity, { decimals: 2 })],
        ['Marketplaces', formatNumber(realm.holdings.markets)],
        ['Woollen mills', formatNumber(realm.holdings.mills)],
        ['Palace pieces', formatNumber(realm.holdings.palace)],
        ['Cathedral pieces', formatNumber(realm.holdings.cathedral)],
      ]),
      table('The people', [
        ['Serfs', formatNumber(p.serfs)],
        ['Soldiers', formatNumber(p.soldiers)],
        ['Merchants', formatNumber(p.merchants)],
        ['Nobles', formatNumber(p.nobles)],
        ['Clergy', formatNumber(p.clergy)],
      ]),
      opening
        ? table('This year’s opening', [
            ['Weather', WEATHER_NAMES[opening.weather - 1] ?? ''],
            ['Worked', `${formatNumber(opening.worked)} ha`],
            ['Harvest', `${formatNumber(opening.harvest)} bu`],
            ['Rats ate', `${opening.ratPercent}% · ${formatNumber(opening.ratsAte)} bu`],
            ['The people need', `${formatNumber(opening.demand)} bu`],
            ['Grain price', `${formatNumber(opening.grainPrice)} fl / 1,000 bu`],
            ['Land price', `${formatNumber(opening.landPrice, { decimals: 1 })} fl / ha`],
          ])
        : null,
      log
        ? table(`Last year (${log.year})`, [
            ['Customs', florins(log.revenue.customs)],
            ['Sales tax', florins(log.revenue.sales)],
            ['Wealth tax', florins(log.revenue.wealth)],
            ['Courts', florins(log.revenue.justice)],
            ['Market rent', florins(log.marketRent)],
            ['Mills', florins(log.millIncome)],
            ['Soldiers’ pay', florins(-log.soldiersPay)],
            ['Interest', florins(-log.interest)],
            ['Born / died', `${formatNumber(log.births)} / ${formatNumber(log.deaths)}`],
            ['Newcomers / fled', `${formatNumber(log.newcomers)} / ${formatNumber(log.fled)}`],
          ])
        : null,
      table(
        'The twelve pillars',
        pillars.map((pillar) => [PILLAR_WORDS[pillar.id].label, `${pillar.points} of 10`] as const),
      ),
      table('This valley', [
        ['Difficulty', DIFFICULTY_NAMES[world.difficulty].name],
        ['Fate', world.fate === 'dynasty' ? 'Dynasty' : 'Classic fate'],
        ['Taxes', `${realm.taxes.customs}% · ${realm.taxes.sales}% · ${realm.taxes.wealth}%`],
        ['Justice', JUSTICE_NAMES[realm.taxes.justice - 1] ?? ''],
        [
          'Ends',
          world.endYear === null
            ? 'never: until the chronicle is closed'
            : `after ${world.endYear}`,
        ],
        ...changed,
      ]),
    ),
  ]);
}

// ---- the Codex ---------------------------------------------------------------------------

function codexArt(markup: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = markup;
  return svg;
}

function codexEntry(view: CodexEntryView): HTMLElement {
  const { def } = view;
  if (!view.discovered) {
    return el(
      'article',
      { class: 'cf-codex__entry', 'data-discovered': 'false' },
      el('div', { class: 'cf-codex__art cf-codex__art--hidden' }, codexArt(def.art)),
      el('div', {}, el('h3', {}, 'Not yet seen'), el('p', {}, def.hint)),
    );
  }
  const reveal = def.revealAfter ?? 3;
  return el(
    'article',
    { class: 'cf-codex__entry', 'data-discovered': 'true' },
    el('div', { class: 'cf-codex__art' }, codexArt(def.art)),
    el(
      'div',
      {},
      el('h3', {}, def.title),
      el('p', {}, def.summary),
      el('p', { class: 'cf-codex__tendency' }, def.tendency),
      view.mechanismRevealed
        ? el('p', { class: 'cf-codex__rule' }, el('strong', {}, 'The rule: '), def.mechanism)
        : el(
            'p',
            { class: 'cf-codex__locked' },
            `Seen ${view.seen} of ${reveal} times. The exact rule shows after ${reveal}.`,
          ),
    ),
  );
}

export function openCodex(root: HTMLElement, ctx: SimContext): Sheet {
  const { discovered, total } = ctx.codex.progress();
  return openSheet(root, 'The Codex', [
    el(
      'p',
      { class: 'cf-sheet__lead' },
      `${discovered} of ${total} discovered. Each entry reveals its exact rule once you have seen it a few times.`,
    ),
    el('div', { class: 'cf-codex' }, ...ctx.codex.entries().map(codexEntry)),
  ]);
}

// ---- options ---------------------------------------------------------------------------------

function radios<T extends string>(
  name: string,
  legend: string,
  choices: readonly { value: T; label: string }[],
  current: T,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  return el(
    'fieldset',
    { class: 'cf-options__group' },
    el('legend', {}, legend),
    el(
      'div',
      { class: 'cf-options__choices' },
      ...choices.map((choice) => {
        const input = el('input', {
          type: 'radio',
          name,
          value: choice.value,
          checked: choice.value === current,
        });
        input.addEventListener('change', () => input.checked && onChange(choice.value));
        return el('label', { class: 'cf-options__choice' }, input, el('span', {}, choice.label));
      }),
    ),
  );
}

export function openOptions(root: HTMLElement, ctx: SimContext, options: OptionStore): Sheet {
  const valley = el('input', { type: 'checkbox', checked: options.get('valley') });
  valley.addEventListener('change', () => options.set('valley', valley.checked));
  let sheet: Sheet | null = null;
  const settings = el('button', { type: 'button', class: 'cf-button' }, 'All settings…');
  settings.addEventListener('click', () => {
    sheet?.close();
    ctx.openSettings();
  });
  sheet = openSheet(root, 'Crown of Florins options', [
    radios(
      'cf-graphics',
      'Graphics',
      [
        { value: 'high', label: 'High' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'light', label: 'Light' },
      ],
      options.get('graphics'),
      (value) => options.set('graphics', value),
    ),
    el(
      'p',
      { class: 'cf-options__note' },
      'The fresco steps down by itself if your computer struggles, and back up when it can.',
    ),
    radios(
      'cf-speed',
      'Year speed',
      [
        { value: 'cinematic', label: 'Cinematic (the season, the valley and the crown in full)' },
        { value: 'quick', label: 'Quick (a few seconds each)' },
        { value: 'instant', label: 'Instant (straight to the numbers)' },
      ],
      options.get('speed'),
      (value) => options.set('speed', value),
    ),
    el(
      'label',
      { class: 'cf-options__toggle' },
      valley,
      el('span', {}, 'Show the valley between years'),
    ),
    radios(
      'cf-ai-speed',
      'Rivals’ turns in hot-seat',
      [
        { value: 'show', label: 'Show each march in the valley' },
        { value: 'summarise', label: 'Summarise them together' },
      ],
      options.get('aiSpeed'),
      (value) => options.set('aiSpeed', value),
    ),
    el(
      'p',
      { class: 'cf-options__note' },
      'Forecasts, hints, sound, motion and appearance are in the collection’s settings.',
    ),
    settings,
  ]);
  return sheet;
}
