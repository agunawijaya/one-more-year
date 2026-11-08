/**
 * The title review: a herald unrolls a scroll with the year written on it,
 * what the treasury took in and paid out, what the people did, and the
 * heralds' verdict. A promotion is lettered in gold.
 */
import { describeEvent, formatNumber, type Discovery, type SimEvent } from '@one-more-year/kit';
import { pointsForTitle } from '../../engine/title.ts';
import { TOP_TITLE } from '../../engine/rules.ts';
import type { Realm, World } from '../../engine/state.ts';
import { titleName } from '../../content/names.ts';
import { EVENT_TEXT } from '../../content/text.ts';
import { florins } from '../../content/words.ts';
import { el, svgNode } from '../../ui/dom.ts';

export interface ReviewOptions {
  host: HTMLElement;
  world: World;
  /** The realm after its sealed year. */
  realm: Realm;
  events: readonly SimEvent[];
  discoveries: readonly Discovery[];
  ghost: string | null;
  continueLabel: string;
  reducedMotion: boolean;
  onContinue(): void;
}

/** Event kinds the harvest beat already showed; the scroll tells the rest. */
const SHOWN_AT_HARVEST = new Set(['weather', 'rats', 'ruler-died', 'heir-crowned']);

export function showReview(options: ReviewOptions): () => void {
  const { realm } = options;
  const log = realm.last;
  const form = realm.ruler.form;
  const promoted = log ? log.titleAfter > log.titleBefore : false;
  const events = options.events.filter(
    (e) => (e.seat === undefined || e.seat === realm.seat) && !SHOWN_AT_HARVEST.has(e.kind),
  );

  const verdict = el('div', {
    class: 'cf-scroll__verdict',
    'data-promoted': promoted ? true : null,
  });
  if (log && promoted) {
    verdict.append(
      el(
        'p',
        { class: 'cf-scroll__eyebrow' },
        log.deathbed && log.titleAfter === log.titleBefore + 1
          ? 'For long service, the heralds proclaim'
          : 'The heralds proclaim',
      ),
      el(
        'p',
        { class: 'cf-scroll__gold' },
        `${titleName(log.titleAfter, form)} ${realm.ruler.name}`,
      ),
    );
  } else if (log) {
    const next = Math.min(TOP_TITLE, realm.title + 1);
    const needed = pointsForTitle(next, log.plan.justice, options.world.difficulty);
    verdict.append(
      el('p', { class: 'cf-scroll__eyebrow' }, 'The heralds confirm'),
      el('p', { class: 'cf-scroll__title' }, `${titleName(realm.title, form)} ${realm.ruler.name}`),
    );
    if (realm.title < TOP_TITLE) {
      verdict.append(
        el(
          'p',
          { class: 'cf-scroll__note' },
          `${formatNumber(log.points)} ${log.points === 1 ? 'point' : 'points'}; ${titleName(next, form)} needs ${formatNumber(needed)} at this justice.`,
        ),
      );
    }
  }

  const money: [string, number][] = log
    ? [
        ['Customs', log.revenue.customs],
        ['Sales tax', log.revenue.sales],
        ['Wealth tax', log.revenue.wealth],
        ['Courts', log.revenue.justice],
        ['Market rents', log.marketRent],
        ['Woollen mills', log.millIncome],
        ['Soldiers’ pay', -log.soldiersPay],
        ['Interest', -log.interest],
      ]
    : [];
  const people: [string, number][] = log
    ? [
        ['Born', log.births],
        ['Died', -log.deaths],
        ['Newcomers', log.newcomers],
        ['Fled', -log.fled],
        ['Merchants', log.merchantsArrived - log.merchantsLeft],
        ['Nobles', log.noblesArrived],
        ['Clergy', log.clergyArrived],
      ]
    : [];
  const signed = (n: number): string =>
    n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : '0';

  const button = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'continue' },
    options.continueLabel,
  );
  button.addEventListener('click', () => options.onContinue());

  const scroll = el(
    'section',
    {
      class: 'cf-scroll',
      'aria-labelledby': 'cf-scroll-title',
      'data-animate': options.reducedMotion ? null : true,
    },
    el('span', { class: 'cf-scroll__roll cf-scroll__roll--top', 'aria-hidden': 'true' }),
    el(
      'div',
      { class: 'cf-scroll__sheet' },
      el(
        'p',
        { class: 'cf-scroll__eyebrow' },
        `Anno ${log?.year ?? options.world.year} · ${realm.city}`,
      ),
      el('h2', { id: 'cf-scroll-title', class: 'cf-scroll__heading' }, 'The heralds’ scroll'),
      events.length > 0
        ? el(
            'ul',
            { class: 'cf-scroll__events' },
            ...events.map((e) =>
              el('li', { 'data-severity': e.severity }, describeEvent(EVENT_TEXT, e)),
            ),
          )
        : el(
            'p',
            { class: 'cf-scroll__quiet' },
            'A quiet year, of the kind chroniclers skip and citizens remember fondly.',
          ),
      el(
        'div',
        { class: 'cf-scroll__columns' },
        el(
          'dl',
          { class: 'cf-scroll__ledger', 'aria-label': 'The treasury this year' },
          ...money
            .filter(([, n]) => n !== 0)
            .map(([label, n]) =>
              el('div', {}, el('dt', {}, label), el('dd', { class: 'cf-num' }, signed(n))),
            ),
          el(
            'div',
            { class: 'cf-scroll__sum' },
            el('dt', {}, 'Treasury now'),
            el('dd', { class: 'cf-num' }, florins(realm.treasury)),
          ),
        ),
        el(
          'dl',
          { class: 'cf-scroll__ledger', 'aria-label': 'The people this year' },
          ...people
            .filter(([, n]) => n !== 0)
            .map(([label, n]) =>
              el('div', {}, el('dt', {}, label), el('dd', { class: 'cf-num' }, signed(n))),
            ),
          el(
            'div',
            { class: 'cf-scroll__sum' },
            el('dt', {}, 'Serfs now'),
            el('dd', { class: 'cf-num' }, formatNumber(realm.people.serfs)),
          ),
        ),
      ),
      verdict,
      options.discoveries.length > 0
        ? el(
            'p',
            { class: 'cf-scroll__codex' },
            'New in your Codex: ',
            options.discoveries.map((d) => d.def.title).join(', '),
          )
        : null,
      options.ghost ? el('p', { class: 'cf-scroll__ghost' }, options.ghost) : null,
      el('div', { class: 'cf-scroll__actions' }, button),
    ),
    el('span', { class: 'cf-scroll__roll cf-scroll__roll--bottom', 'aria-hidden': 'true' }),
  );
  const herald = svgNode(HERALD_SVG);
  const layer = el('div', { class: 'cf-review' }, herald, scroll);
  options.host.append(layer);
  button.focus();
  return () => layer.remove();
}

/**
 * The herald, in profile toward the scroll, painted in the fresco's own
 * language: a chaperon with its long tail, a tabard quartered red and gold,
 * parti-coloured hose and pointed shoes, and a long trumpet with the
 * valley's pennon. Each form is laid in a light colour with its shaded side
 * hatched in a deeper one, the face modelled with a green-earth shade under
 * the cheek and jaw, outlines in umber that wander as a brush leaves them,
 * and a streaked grain in the pigment.
 */
const HERALD_SVG =
  '<svg class="cf-herald" viewBox="0 0 160 300" aria-hidden="true">' +
  '<defs>' +
  '<clipPath id="cf-herald-tabard"><path d="M62 100Q84 92 104 100L114 208H52Z"/></clipPath>' +
  '<pattern id="cf-herald-hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><path d="M0 0.4H3.2" stroke="#2b1f15" stroke-width="0.6" opacity="0.3"/></pattern>' +
  '<filter id="cf-herald-paint" x="-5%" y="-5%" width="110%" height="110%">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="wobble"/>' +
  '<feDisplacementMap in="SourceGraphic" in2="wobble" scale="1.6" result="painted"/>' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.035 0.3" numOctaves="2" seed="3" result="streaks"/>' +
  '<feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.17  0 0 0 0 0.1  0.7 0 0 0 -0.32" result="tint"/>' +
  '<feComposite in="tint" in2="painted" operator="in" result="grain"/>' +
  '<feMerge><feMergeNode in="painted"/><feMergeNode in="grain"/></feMerge></filter>' +
  '</defs>' +
  '<ellipse cx="82" cy="291" rx="42" ry="5" fill="#2b1f15" fill-opacity="0.22"/>' +
  '<g filter="url(#cf-herald-paint)" stroke="#4a3526" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
  // The chaperon's tail, behind the head and down the back.
  '<path d="M74 56C60 70 58 92 66 112" fill="none" stroke-width="7"/>' +
  '<path d="M74 56C60 70 58 92 66 112" fill="none" stroke="#9a3420" stroke-width="4.6"/>' +
  // The far arm, hanging, in shade.
  '<path d="M66 108L58 150L62 166" fill="none" stroke-width="12"/>' +
  '<path d="M66 108L58 150L62 166" fill="none" stroke="#24456e" stroke-width="9.4"/>' +
  '<path d="M66 108L58 150L62 166" fill="none" stroke="url(#cf-herald-hatch)" stroke-width="9.4"/>' +
  '<circle cx="62" cy="169" r="4.2" fill="#c99272"/>' +
  // Hose, one leg vermilion and one ochre, each with its shaded side; pointed shoes in umber.
  '<path d="M64 200H76L74 282H63Z" fill="#9a3420"/>' +
  '<path d="M64 200H69L68 282H63Z" fill="url(#cf-herald-hatch)" stroke="none"/>' +
  '<path d="M82 200H94L99 282H88Z" fill="#c9973f"/>' +
  '<path d="M92 200H94L99 282H95Z" fill="url(#cf-herald-hatch)" stroke="none"/>' +
  '<path d="M62 282H75V289H52Q52 285 62 282Z" fill="#4a3526"/>' +
  '<path d="M87 282H100Q112 285 118 289H87Z" fill="#4a3526"/>' +
  // The tabard, quartered, its far side and its folds in shade.
  '<g clip-path="url(#cf-herald-tabard)" stroke="none">' +
  '<rect x="40" y="90" width="44" height="62" fill="#a8341f"/>' +
  '<rect x="84" y="90" width="40" height="62" fill="#d4a443"/>' +
  '<rect x="40" y="152" width="44" height="60" fill="#d4a443"/>' +
  '<rect x="84" y="152" width="40" height="60" fill="#a8341f"/>' +
  '<path d="M52 92L66 92L64 210H52Z" fill="url(#cf-herald-hatch)"/>' +
  '<path d="M82 160Q84 186 80 210M96 158Q100 184 100 210" fill="none" stroke="#4a3526" stroke-width="0.9" opacity="0.5"/>' +
  '</g>' +
  '<path d="M62 100Q84 92 104 100L114 208H52Z" fill="none"/>' +
  '<path d="M57 152H109" stroke="#6a4a30" stroke-width="3.6"/>' +
  // The neck, then the face in profile: a calm brow, a long nose, closed lips, and the shade of
  // green earth under the cheek and along the jaw.
  '<path d="M84 82V97H94V80Z" fill="#c99272"/>' +
  '<path d="M84 82V97H88V82Z" fill="#7d8a5c" opacity="0.35" stroke="none"/>' +
  '<path d="M80 58C82 52 88 48 94 49C99 50 101 53 101 56L102 59C103 61 104.6 63.4 105.2 65C105.4 65.8 104.4 66.4 103.2 66.6L103.1 68C103.6 68.7 103.2 69.4 102.4 70C102.9 70.8 102.6 71.9 101.6 72.5C101.4 74.2 100.4 75.6 98.4 76.3C95.6 77.2 92.6 77.2 90.4 78.2L84 80C81 73 79 65 80 58Z" fill="#d8a283"/>' +
  '<path d="M85 64C87 70 90 74 95 76C92.6 77.2 90.4 78.2 88 79L84 80C82 74 82 68 83 63Z" fill="#7d8a5c" opacity="0.32" stroke="none"/>' +
  '<path d="M85 64C87 70 90 74 95 76C92.6 77.2 90.4 78.2 88 79L84 80C82 74 82 68 83 63Z" fill="url(#cf-herald-hatch)" stroke="none" opacity="0.6"/>' +
  '<ellipse cx="97" cy="67" rx="2.6" ry="1.8" fill="#b05a37" opacity="0.3" stroke="none"/>' +
  '<path d="M95.4 59.6C96.4 58.8 97.8 58.8 98.8 59.6C97.8 60.2 96.4 60.2 95.4 59.6Z" fill="#efe5cf" stroke-width="0.5"/>' +
  '<circle cx="97.4" cy="59.6" r="0.7" fill="#4a3526" stroke="none"/>' +
  '<path d="M94.4 57.4C96.2 56.4 98.4 56.5 100.2 57.4" fill="none" stroke-width="0.8"/>' +
  '<path d="M100.4 70.4L102.6 70.2" stroke="#9a4b2c" stroke-width="0.8"/>' +
  // The chaperon's rolled brim and crown.
  '<path d="M74 57Q75 42 90 40Q104 40 104 52Q92 50 78 60Z" fill="#a8341f"/>' +
  '<path d="M90 40Q104 40 104 52Q98 49 92 49Z" fill="url(#cf-herald-hatch)" stroke="none"/>' +
  '<path d="M76 53Q90 45 104 51" fill="none" stroke="#6a1e10" stroke-width="2.6"/>' +
  // The near arm, raised to hold the trumpet at the lips.
  '<path d="M100 108L120 104L114 64" fill="none" stroke-width="12"/>' +
  '<path d="M100 108L120 104L114 64" fill="none" stroke="#2f5d8c" stroke-width="9.4"/>' +
  '<path d="M101 66L148 38" stroke="#8a5f1a" stroke-width="4.6"/>' +
  '<path d="M101 66L148 38" stroke="#d6a640" stroke-width="2.4"/>' +
  '<path d="M146 39L154 26Q160 36 158 48Z" fill="#d6a640" stroke="#8a5f1a"/>' +
  '<circle cx="113" cy="61" r="4.2" fill="#d8a283"/>' +
  // The pennon hanging from the trumpet: azure, a gold cross.
  '<path d="M120 55L140 43L141 78L131 72L121 84Z" fill="#2f5d8c"/>' +
  '<path d="M131 55L140 43L141 78L131 72Z" fill="url(#cf-herald-hatch)" stroke="none"/>' +
  '<path d="M130 54V72M124 61H136" stroke="#d6a640" stroke-width="2"/>' +
  '</g></svg>';
