/**
 * The five scenarios of our own, each with its twist and the best verdict
 * the player has earned on it. Choosing one goes on to the court setup.
 */
import type { ScenarioSummary, SimContext } from '@one-more-year/kit';
import { CURATED_SCENARIOS } from '../../engine/scenarios.ts';
import { el } from '../../ui/dom.ts';

const DEMAND = ['', 'Gentle', 'Standard', 'Demanding'] as const;

export function showScenarios(
  host: HTMLElement,
  ctx: SimContext,
  best: (id: string) => string | null,
  actions: { choose: (scenario: ScenarioSummary) => void; back: () => void },
): () => void {
  const back = el(
    'button',
    { type: 'button', class: 'cf-back', 'data-action': 'back' },
    '← Game menu',
  );
  back.addEventListener('click', actions.back);
  const cards = CURATED_SCENARIOS.map((id) => ctx.manifest.scenarios.find((s) => s.id === id))
    .filter((s): s is ScenarioSummary => s !== undefined)
    .map((scenario) => {
      const verdict = best(scenario.id);
      const node = el(
        'button',
        { type: 'button', class: 'cf-scenario cf-card', 'data-scenario': scenario.id },
        el('span', { class: 'cf-scenario__demand' }, DEMAND[scenario.difficulty]),
        el('strong', { class: 'cf-scenario__title' }, scenario.title),
        el('span', { class: 'cf-scenario__twist' }, scenario.twist),
        el('span', { class: 'cf-scenario__best' }, verdict ? `Best: ${verdict}` : 'Not yet played'),
      );
      node.addEventListener('click', () => actions.choose(scenario));
      return node;
    });
  const page = el(
    'section',
    { class: 'cf-scenarios', 'aria-labelledby': 'cf-scenarios-title' },
    back,
    el('h1', { id: 'cf-scenarios-title', class: 'cf-setup__title' }, 'Scenarios'),
    el(
      'p',
      { class: 'cf-setup__twist' },
      'Five valleys, each changing one thing about the year and nothing else.',
    ),
    el('div', { class: 'cf-scenarios__grid' }, ...cards),
  );
  host.append(page);
  cards[0]?.focus();
  return () => page.remove();
}
