/**
 * The six curated scenarios: a card each, with a small picture of that
 * world's start drawn by the city's own renderer, its twist in one line and
 * the best verdict reached on it so far.
 */
import type { SimContext } from '@one-more-year/kit';
import { maxSownWith, workersLimit } from '../../engine/model.ts';
import { CURATED_SCENARIOS, rulesFor } from '../../engine/rules.ts';
import type { CityView } from '../../scene/view.ts';
import type { CityWorld } from '../../scene/world.ts';
import { button, el } from '../../ui/dom.ts';

export interface ScenarioScreenDeps {
  ctx: SimContext;
  world: CityWorld;
  view: CityView;
  best: (scenario: string) => string | null;
  begin: (scenario: string) => void;
  back: () => void;
}

const DIFFICULTY = ['', 'Gentle', 'Standard', 'Demanding'] as const;

/** Draws a scenario's opening world into a small canvas, using the one shared renderer. */
function snapshot(
  world: CityWorld,
  view: CityView,
  scenario: string,
  target: HTMLCanvasElement,
): void {
  const { start, yieldRange } = rulesFor(scenario);
  // A picture of the twist, not a forecast: sow what a third of the store would seed, and show a
  // low river's thin wheat or a rich one's heavy ears.
  world.show({
    people: start.people,
    grain: start.grain,
    acres: start.acres,
    planted: Math.min(
      start.acres,
      workersLimit(start.people),
      maxSownWith(Math.floor(start.grain * 0.3)),
    ),
    season: 1,
    yieldPerAcre: yieldRange[1] <= 3 ? yieldRange[0] : yieldRange[1],
  });
  view.renderOnce();
  const context = target.getContext('2d');
  if (!context) return;
  const source = view.canvas;
  // Crop the middle of the view to the card's shape.
  const aspect = target.width / target.height;
  const sourceWidth = Math.min(source.width, source.height * aspect);
  const sourceHeight = sourceWidth / aspect;
  context.drawImage(
    source,
    (source.width - sourceWidth) / 2,
    (source.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    target.width,
    target.height,
  );
}

export function renderScenarios(deps: ScenarioScreenDeps): HTMLElement {
  const { ctx } = deps;
  const cards = CURATED_SCENARIOS.map((id) => {
    const summary = ctx.manifest.scenarios.find((s) => s.id === id);
    const picture = el('canvas', {
      width: 840,
      height: 400,
      class: 'th-scenario__picture',
      'aria-hidden': 'true',
    });
    const best = deps.best(id);
    const card = button(
      [
        picture,
        el(
          'span',
          { class: 'th-scenario__text' },
          el('strong', {}, summary?.title ?? id),
          el('span', {}, summary?.twist ?? ''),
          el(
            'span',
            { class: 'th-scenario__meta' },
            DIFFICULTY[summary?.difficulty ?? 2],
            best ? ` · best: ${best}` : ' · not yet played',
          ),
        ),
      ],
      () => deps.begin(id),
      { class: 'th-scenario', 'data-scenario': id },
    );
    return { id, card, picture };
  });
  const element = el(
    'section',
    { class: 'th-scenarios', 'aria-labelledby': 'th-scenarios-title' },
    el(
      'header',
      { class: 'th-scenarios__head' },
      el('h1', { id: 'th-scenarios-title' }, 'Scenarios'),
      el('p', {}, 'Each world starts from the classic and changes one thing.'),
      button('Back to the game menu', deps.back, {
        class: 'th-quiet',
        'data-action': 'scenarios-back',
      }),
    ),
    el('div', { class: 'th-scenarios__grid' }, ...cards.map((c) => c.card)),
  );
  // Draw the pictures once the screen is laid out (the renderer is sized by then) and the
  // shaders are ready.
  void deps.view.ready.then(() => {
    requestAnimationFrame(() => {
      for (const { id, picture } of cards) snapshot(deps.world, deps.view, id, picture);
    });
  });
  return element;
}
