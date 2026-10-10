/**
 * Terrarium: small worlds under glass.
 *
 * Each world is a tiny living diorama under a glass dome on wooden shelves.
 * Hovering or focusing a dome lifts it a little and, if sound is on, lets
 * the world's ambience drift out faintly. A brass plate names the world and
 * a paper tag gives its domain and turn; today's worlds wear a ribbon, and
 * finished chronicles hang from the shelf edge as pressed-paper labels.
 * Planned worlds are empty domes over a pot with a seedling.
 *
 * Light is a greenhouse at noon (pale green glass, terracotta, oak, leaf
 * shadows); dark is a firefly night (deep teal, moonlight on the glass,
 * worlds glowing softly from inside, slow fireflies).
 */
import { formatStyled, type Appearance, type DemoPalette } from '@one-more-year/kit';
import { button, h, svgFrom } from '../../app/dom.ts';
import type { DemoSlot } from '../../app/demos.ts';
import { renderDetail } from '../../chrome/detail.ts';
import { openDialog } from '../../chrome/dialogs.ts';
import { icon } from '../../chrome/icons.ts';
import { DOMAIN_NAMES } from '../../data/filters.ts';
import type { HallEntry, HallSnapshot } from '../../data/hall-model.ts';
import { chartTokensFor } from '../colors.ts';
import type { Theme, ThemeContext, ThemeView } from '../theme.ts';
import { PALETTES } from '../tokens.ts';
import './terrarium.css';

function demoPalette(appearance: Appearance): DemoPalette {
  const p = PALETTES.terrarium[appearance];
  return appearance === 'dark'
    ? {
        paper: '#0f2a2c',
        ink: p.ink,
        muted: p.inkSoft,
        accent: '#1d5f73',
        line: '#7fd6c4',
        glow: '#3d9db0',
        good: '#2f6b46',
        warning: '#f2a35c',
        disaster: p.toneDisaster,
      }
    : {
        paper: '#ffffff',
        ink: p.ink,
        muted: p.inkSoft,
        accent: '#3f8fa8',
        line: '#2e7538',
        glow: '#a8dcea',
        good: '#86bf6e',
        warning: '#e8873a',
        disaster: p.toneDisaster,
      };
}

/** A terracotta pot with a plant in it: the cosmetic's plant, or a seedling for planned worlds. */
function pottedPlant(kind: string, className = 'terra-seedling'): SVGSVGElement {
  const leaf = 'class="terra-leaf"';
  const plants: Record<string, string> = {
    seedling: `<path d="M60 68V44"/><path ${leaf} d="M60 52C46 54 36 46 36 32c14-2 24 6 24 20z"/><path ${leaf} d="M60 46c0-14 10-22 26-20 0 14-10 22-26 20z"/>`,
    fern: [-34, -16, 0, 16, 34]
      .map(
        (tilt) =>
          `<g transform="rotate(${tilt} 60 68)"><path d="M60 68C60 52 58 40 60 22"/>${[30, 38, 46, 54].map((y, i) => `<ellipse ${leaf} cx="${i % 2 ? 55 : 65}" cy="${y}" rx="5.5" ry="2.6" transform="rotate(${i % 2 ? 30 : -30} ${i % 2 ? 55 : 65} ${y})"/>`).join('')}</g>`,
      )
      .join(''),
    moss: `<circle ${leaf} cx="46" cy="64" r="9"/><circle ${leaf} cx="60" cy="58" r="12"/><circle ${leaf} cx="74" cy="63" r="9"/><circle class="terra-bloom" cx="56" cy="52" r="2"/><circle class="terra-bloom" cx="70" cy="58" r="1.6"/>`,
    cactus: `<path ${leaf} d="M53 68V34a7 7 0 0 1 14 0v34z"/><path ${leaf} d="M53 54h-8a5 5 0 0 1-5-5v-8a4 4 0 0 1 8 0v5h5z"/><path ${leaf} d="M67 48h7a4 4 0 0 0 4-4v-6a4 4 0 0 0-8 0v3h-3z"/><circle class="terra-bloom" cx="60" cy="27" r="5"/>`,
    bonsai: `<path d="M60 68c0-8-8-12-4-22s10-10 8-18"/><ellipse ${leaf} cx="44" cy="40" rx="14" ry="8"/><ellipse ${leaf} cx="72" cy="30" rx="15" ry="8"/><ellipse ${leaf} cx="62" cy="46" rx="10" ry="6"/>`,
    orchard: `<path d="M60 68V44"/><circle ${leaf} cx="60" cy="34" r="20"/><circle class="terra-bloom" cx="52" cy="30" r="3"/><circle class="terra-bloom" cx="67" cy="38" r="3"/><circle class="terra-bloom" cx="62" cy="24" r="3"/>`,
  };
  return svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="${className}" aria-hidden="true">` +
      `<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${plants[kind] ?? plants.seedling ?? ''}</g>` +
      `<path class="terra-pot" d="M36 76h48l-6 33a5 5 0 0 1-5 4H47a5 5 0 0 1-5-4z"/>` +
      `<rect class="terra-pot-rim" x="31" y="66" width="58" height="12" rx="3"/>` +
      `<ellipse class="terra-soil" cx="60" cy="68" rx="25" ry="3.2"/>` +
      `<path class="terra-pot-shine" d="M42 82l4 25"/></svg>`,
  );
}

/** A small pot whose plant grows with a run's progress (0 to 1). */
function growingPot(progress: number): SVGSVGElement {
  const height = 10 + 46 * progress;
  const top = 74 - height;
  const pairs = Math.max(1, Math.round(1 + progress * 3));
  const leaves = Array.from({ length: pairs }, (_, i) => {
    const y = 72 - ((i + 1) / (pairs + 1)) * height;
    const size = 6 + progress * 5 - i;
    return (
      `<path class="terra-leaf" d="M60 ${y.toFixed(1)}c-${size * 1.6} 1-${size * 2.2}-${size}-${size * 2.2}-${size * 1.4} ${size * 1.4}-0.6 ${size * 2.2} ${size * 0.4} ${size * 2.2} ${size * 1.4}z"/>` +
      `<path class="terra-leaf" d="M60 ${(y - 3).toFixed(1)}c${size * 1.6} 1 ${size * 2.2}-${size} ${size * 2.2}-${size * 1.4}-${size * 1.4}-0.6-${size * 2.2} ${size * 0.4}-${size * 2.2} ${size * 1.4}z"/>`
    );
  }).join('');
  const bloom =
    progress >= 0.75 ? `<circle class="terra-bloom" cx="60" cy="${top.toFixed(1)}" r="5"/>` : '';
  return svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="terra-growing__pot" aria-hidden="true">` +
      `<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M60 74V${top.toFixed(1)}"/>${leaves}${bloom}</g>` +
      `<path class="terra-pot" d="M38 80h44l-5 28a5 5 0 0 1-5 4H48a5 5 0 0 1-5-4z"/>` +
      `<rect class="terra-pot-rim" x="34" y="72" width="52" height="10" rx="3"/>` +
      `<ellipse class="terra-soil" cx="60" cy="73.5" rx="22" ry="2.6"/></svg>`,
  );
}

/** Today's worlds wear a rosette on the dome. */
function rosette(): SVGSVGElement {
  const petals = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return `<circle cx="${(20 + Math.cos(angle) * 12).toFixed(1)}" cy="${(19 + Math.sin(angle) * 12).toFixed(1)}" r="5"/>`;
  }).join('');
  return svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56" class="terra-rosette" aria-hidden="true">` +
      `<path class="terra-rosette__tail" d="M13 26l-6 28 8-5 4 7 2-28zM27 26l6 28-8-5-4 7-2-28z"/>` +
      `<g class="terra-rosette__petals">${petals}</g><circle class="terra-rosette__heart" cx="20" cy="19" r="8"/></svg>`,
  );
}

/** Fireflies for the night greenhouse: a few slow, softly lit points. */
function fireflies(): HTMLElement {
  return h(
    'div',
    { class: 'terra-fireflies', 'aria-hidden': 'true' },
    Array.from({ length: 14 }, (_, i) =>
      h('span', {
        class: 'terra-firefly',
        style: `--x:${(i * 37) % 100}%;--y:${18 + ((i * 53) % 70)}%;--drift:${14 + (i % 5) * 4}s;--delay:${-i * 1.7}s`,
      }),
    ),
  );
}

function mount(container: HTMLElement, first: HallSnapshot, ctx: ThemeContext): ThemeView {
  let snapshot = first;
  let highlighted = ctx.initialFocus;
  const demos = new Map<string, DemoSlot>();
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  const header = h('header', { class: 'terra-head' });
  const shelves = h('div', { class: 'terra-shelves' });
  const growing = h('section', {
    class: 'terra-growing',
    'aria-labelledby': 'terra-growing-title',
  });
  const root = h(
    'div',
    { class: 'terra' },
    h(
      'div',
      { class: 'terra-glasshouse', 'aria-hidden': 'true' },
      h('span', { class: 'terra-moon' }),
      h('span', { class: 'terra-leaves terra-leaves--left' }),
      h('span', { class: 'terra-leaves terra-leaves--right' }),
    ),
    fireflies(),
    h('div', { class: 'terra-inner' }, header, shelves, growing),
  );
  container.append(root);

  function applyCosmetic(): void {
    const cosmetic = snapshot.legacy.active('terrarium');
    for (const [name, value] of Object.entries(cosmetic.tokens[ctx.appearance()]))
      root.style.setProperty(name, value);
    root.dataset.plant = cosmetic.tokens[ctx.appearance()]['--plant'] ?? 'seedling';
  }

  function drawHeader(): void {
    const { streak, legacy } = snapshot;
    header.replaceChildren(
      h(
        'div',
        { class: 'terra-head__titles' },
        h('h1', { class: 'terra-head__title' }, 'The Glasshouse'),
        h(
          'p',
          { class: 'terra-head__line' },
          'Small worlds under glass. Lift a dome to look closer.',
        ),
      ),
      h(
        'div',
        { class: 'terra-head__badges' },
        h(
          'p',
          { class: 'terra-badge' },
          icon('flower', 18),
          h(
            'span',
            {},
            streak.current > 0
              ? `${streak.current} ${streak.current === 1 ? 'day' : 'days'} in bloom`
              : 'A new season',
          ),
        ),
        button(
          [
            icon('legacy', 18),
            h('span', {}, legacy.standing.rank.title),
            h('span', { class: 'terra-badge__points tabular' }, `${legacy.standing.points} pts`),
          ],
          () => ctx.actions.openLegacy(),
          {
            class: 'terra-badge terra-badge--brass',
            'aria-label': `Legacy rank ${legacy.standing.rank.title}, ${legacy.standing.points} points`,
          },
        ),
      ),
    );
  }

  function disposeDemos(): void {
    for (const slot of demos.values()) slot.dispose();
    demos.clear();
  }

  function drawShelves(): void {
    disposeDemos();
    const perShelf = snapshot.entries.length <= 3 ? 3 : 4;
    const rows: HallEntry[][] = [];
    snapshot.entries.forEach((entry, index) => {
      const row = Math.floor(index / perShelf);
      (rows[row] ??= []).push(entry);
    });
    shelves.style.setProperty('--per-shelf', String(perShelf));
    shelves.classList.toggle('terra-shelves--crowded', perShelf > 3);
    shelves.replaceChildren(
      ...rows.map((row, rowIndex) =>
        h(
          'section',
          { class: 'terra-shelf', 'aria-label': `Shelf ${rowIndex + 1}` },
          h(
            'div',
            { class: 'terra-shelf__row' },
            row.map((entry, i) => dome(entry, rowIndex * perShelf + i)),
          ),
          // The plank, with a pot standing at each end of it.
          h(
            'div',
            { class: 'terra-shelf__plank', 'aria-hidden': 'true' },
            h(
              'span',
              { class: 'terra-shelf__decor terra-shelf__decor--left', 'aria-hidden': 'true' },
              pottedPlant(rowIndex % 2 ? 'moss' : 'fern', 'terra-decor'),
            ),
            h(
              'span',
              { class: 'terra-shelf__decor terra-shelf__decor--right', 'aria-hidden': 'true' },
              pottedPlant(rowIndex % 2 ? 'cactus' : 'seedling', 'terra-decor'),
            ),
          ),
          h(
            'div',
            { class: 'terra-shelf__labels' },
            row.map((entry) => underShelf(entry)),
          ),
        ),
      ),
    );
  }

  function dome(entry: HallEntry, index: number): HTMLElement {
    const { manifest } = entry;
    const world = h('div', { class: 'terra-dome__world' });
    if (entry.playable) {
      demos.set(manifest.id, ctx.demos.mount(world, manifest.id, 4049 + index));
    } else {
      world.append(pottedPlant(root.dataset.plant ?? 'seedling'));
    }
    const glass = button(
      [
        world,
        h('span', { class: 'terra-dome__shine', 'aria-hidden': 'true' }),
        entry.daily ? rosette() : null,
      ],
      () => openCard(manifest.id),
      {
        class: 'terra-dome__glass',
        'aria-label': `${manifest.title}: ${entry.playable ? 'look closer' : 'in preparation'}`,
        'data-sim': manifest.id,
      },
    );
    const element = h(
      'article',
      {
        class: [
          'terra-dome',
          entry.playable ? '' : 'terra-dome--empty',
          manifest.id === highlighted ? 'terra-dome--lifted' : '',
        ]
          .filter(Boolean)
          .join(' '),
        style: `--sim-accent:${manifest.accent[ctx.appearance()]}`,
        'data-sim': manifest.id,
      },
      glass,
      h(
        'div',
        { class: 'terra-dome__base' },
        h('span', { class: 'terra-dome__plate' }, manifest.title),
      ),
    );

    const hover = (on: boolean): void => {
      element.classList.toggle('terra-dome--lifted', on || manifest.id === highlighted);
      listen(entry, on);
    };
    glass.addEventListener('pointerenter', () => hover(true));
    glass.addEventListener('pointerleave', () => hover(false));
    glass.addEventListener('focus', () => hover(true));
    glass.addEventListener('blur', () => hover(false));
    return element;
  }

  /**
   * What hangs below the shelf under each dome: its paper tag, the ways in,
   * and pressed-paper labels for the best and latest chronicles.
   */
  function underShelf(entry: HallEntry): HTMLElement {
    const { manifest } = entry;
    const run = entry.runs[0];
    const daily = entry.daily;
    const labels = [entry.best, entry.latest].filter(
      (chronicle, i, list): chronicle is NonNullable<typeof chronicle> =>
        chronicle !== null && list.indexOf(chronicle) === i,
    );
    return h(
      'div',
      {
        class: 'terra-under',
        style: `--sim-accent:${manifest.accent[ctx.appearance()]}`,
        'data-sim': manifest.id,
      },
      h(
        'p',
        { class: 'terra-tag' },
        h('span', { class: 'terra-tag__hole', 'aria-hidden': 'true' }),
        `${DOMAIN_NAMES[manifest.domain]} · ${manifest.turnUnit}s`,
        entry.playable ? null : h('span', { class: 'terra-tag__soon' }, ' · growing soon'),
      ),
      entry.playable
        ? h(
            'div',
            { class: 'terra-under__actions' },
            button(
              [icon('play', 16), h('span', {}, 'Begin')],
              () => ctx.actions.begin(manifest.id),
              {
                class: 'button button--primary',
                'data-action': 'begin',
              },
            ),
            run
              ? button(
                  [
                    h('span', {}, 'Continue'),
                    h('span', { class: 'button__detail' }, run.turnLabel),
                  ],
                  () => ctx.actions.continueRun(manifest.id, run.id),
                  { class: 'button', 'data-action': 'continue' },
                )
              : null,
            daily
              ? button(
                  [
                    icon('calendar', 16),
                    h('span', {}, `#${daily.number}`),
                    daily.result ? icon('check', 16) : null,
                  ],
                  () =>
                    daily.result
                      ? ctx.actions.openChronicle(daily.result.chronicleId)
                      : ctx.actions.playDaily(manifest.id),
                  {
                    class: 'button button--quiet',
                    'data-action': 'daily',
                    'aria-label': daily.result
                      ? `Today’s world #${daily.number}, done: read its chronicle`
                      : `Today’s world #${daily.number}`,
                  },
                )
              : null,
          )
        : h('p', { class: 'terra-under__note' }, `After ${manifest.inspiredBy.uiTitle}`),
      labels.length > 0
        ? h(
            'div',
            { class: 'terra-labels' },
            labels.map((chronicle, i) =>
              button(
                h('span', { class: 'terra-label__text' }, `“${chronicle.epithet.text}”`),
                () => ctx.actions.openChronicle(chronicle.id),
                {
                  class: 'terra-label',
                  style: `--swing:${i % 2 === 0 ? -3 : 2.5}deg`,
                  'data-chronicle': chronicle.id,
                },
              ),
            ),
          )
        : null,
    );
  }

  /** The world's own ambience, faint, while a dome is lifted (only if sound is on). */
  function listen(entry: HallEntry, on: boolean): void {
    if (hoverTimer !== null) clearTimeout(hoverTimer);
    const bed = entry.module?.ambience;
    const settings = ctx.services.settings.get();
    if (settings.muted || !bed) return;
    hoverTimer = setTimeout(
      () => {
        ctx.services.audio.setAmbience(on ? { ...bed, gain: (bed.gain ?? 0.2) * 0.4 } : null);
      },
      on ? 250 : 0,
    );
  }

  /**
   * Runs in progress as a low shelf of pots, each plant as tall as its run
   * is far along: a sprout in year one, a full plant near the end.
   */
  function drawGrowing(): void {
    const runs = snapshot.continueRuns.slice(0, 6);
    growing.hidden = runs.length === 0;
    growing.replaceChildren(
      h('h2', { id: 'terra-growing-title', class: 'terra-section-title' }, 'Still growing'),
      h(
        'ul',
        { class: 'terra-growing__shelf' },
        runs.map((run) => {
          const primary = run.manifest.primarySignal ?? run.manifest.signals[0]?.id ?? '';
          const signal = run.manifest.signals.find((item) => item.id === primary);
          const progress = Math.min(
            1,
            Math.max(0, (run.spark.length - 1) / run.manifest.typicalTurns[1]),
          );
          return h(
            'li',
            { style: `--sim-accent:${run.manifest.accent[ctx.appearance()]}` },
            button(
              [
                growingPot(progress),
                h('span', { class: 'terra-growing__sim' }, run.manifest.title),
                h('span', { class: 'terra-growing__turn' }, run.turnLabel),
                signal
                  ? h(
                      'span',
                      { class: 'terra-growing__value tabular' },
                      `${signal.label} ${formatStyled(run.signals[primary] ?? 0, signal.format)}`,
                    )
                  : null,
              ],
              () => ctx.actions.continueRun(run.simId, run.id),
              {
                class: 'terra-growing__item',
                'data-run': run.id,
                'aria-label': `Continue ${run.manifest.title}, ${run.turnLabel}`,
              },
            ),
          );
        }),
      ),
    );
  }

  function openCard(simId: string): void {
    const entry = snapshot.entries.find((item) => item.manifest.id === simId);
    if (!entry) return;
    ctx.actions.focus(simId);
    const detail = renderDetail(entry, {
      actions: ctx.actions,
      demos: ctx.demos,
      withDemo: true,
      seed: 5051,
    });
    detail.element.style.setProperty('--sim-accent', entry.manifest.accent[ctx.appearance()]);
    openDialog({
      title: entry.manifest.title,
      kind: 'dialog--card',
      body: detail.element,
      onClose: () => detail.dispose(),
    });
  }

  function drawAll(): void {
    applyCosmetic();
    drawHeader();
    drawShelves();
    drawGrowing();
  }

  drawAll();

  return {
    update(next) {
      // Domes hold running demos, so they are rebuilt only when what they show changes.
      const reshelve = shelfKey(next) !== shelfKey(snapshot);
      snapshot = next;
      applyCosmetic();
      drawHeader();
      drawGrowing();
      if (reshelve) drawShelves();
    },
    focus(simId) {
      highlighted = simId;
      for (const element of shelves.querySelectorAll<HTMLElement>('.terra-dome')) {
        element.classList.toggle('terra-dome--lifted', element.dataset.sim === simId);
      }
    },
    setAppearance() {
      drawAll();
    },
    dispose() {
      if (hoverTimer !== null) clearTimeout(hoverTimer);
      disposeDemos();
      root.remove();
    },
  };
}

function shelfKey(snapshot: HallSnapshot): string {
  return snapshot.entries
    .map((entry) =>
      [
        entry.manifest.id,
        entry.playable,
        entry.runs.length,
        entry.chronicleCount,
        entry.daily?.played ?? false,
        entry.daily?.result?.chronicleId ?? '',
      ].join(':'),
    )
    .join('|');
}

export const terrarium: Theme = {
  id: 'terrarium',
  demoStyle: 'diorama',
  demoPalette,
  chartTokens: (appearance) => chartTokensFor('terrarium', appearance),
  mount,
};
