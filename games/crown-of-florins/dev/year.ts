// The year screen from a real game, for the hero frames and wireframes.
//
//   ?appearance=dark&seed=12&cathedral=4&step=builders
//
// A bot plays a court of one human and three rivals until the human's
// cathedral reaches the asked stage; the screen then opens on that year's
// Builders step with another piece of the cathedral planned, shown in the
// fresco as scaffolding on its lit plot.
import '../../../hall/src/styles/fonts.css';
import '../src/ui/crown.css';
import '../src/ui/screens.css';
import { quickCourt } from '../src/engine/court.ts';
import { openingPlan } from '../src/engine/plan.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { actingRealm } from '../src/engine/world.ts';
import type { StepId } from '../src/content/words.ts';
import { crownModel } from '../src/engine/model.ts';
import { createStage } from '../src/game/stage.ts';
import { forecastYear, projectPlan } from '../src/game/year-model.ts';
import type { QualityLevel } from '../src/scene/quality.ts';
import { el } from '../src/ui/dom.ts';
import { createYearScreen, type YearView } from '../src/ui/year-screen.ts';
import { createFrescoOverlay } from '../src/game/fresco-overlay.ts';

const params = new URLSearchParams(window.location.search);
const number = (name: string, fallback: number): number => {
  const value = params.get(name);
  return value === null ? fallback : Number(value);
};
const appearance: 'light' | 'dark' = params.get('appearance') === 'dark' ? 'dark' : 'light';
const seed = number('seed', 12);
const stage = number('cathedral', 4);

const { world } = playGame({
  seed,
  court: quickCourt(seed, 1, 3, { personalities: ['merchant', 'general', 'saint'], difficulty: 4 }),
  bot: policyFor('builder'),
  maxSteps: 80,
  until: (w) => (w.realms[0]?.holdings.cathedral ?? 0) >= stage && actingRealm(w).seat === 0,
});
const realm = actingRealm(world);
const plan = openingPlan(realm);
plan.build.cathedral = 1;

const root = el('div', { class: 'cf', 'data-appearance': appearance });
document.getElementById('app')?.append(root);
const screen = createYearScreen({
  step: () => undefined,
  change: () => undefined,
  seal: () => undefined,
  pillarRead: () => undefined,
  pickBuilding: () => undefined,
});
root.append(screen.element);

const painted = createStage(screen.frescoHost, {
  appearance,
  quality: (params.get('quality') ?? 'high') as QualityLevel,
});
painted.paintCity(realm, { preview: { kind: 'cathedral' } });
painted.view.setPose(
  painted.cityPose({ elevation: number('elevation', 0.5), crestAt: number('crest', 0.84) }),
);

const view: YearView = {
  appearance,
  world,
  realm,
  plan,
  step: (params.get('step') ?? 'builders') as StepId,
  issues: crownModel.validate(world, plan),
  projection: projectPlan(world, realm, plan),
  forecast: forecastYear(world, plan, seed, 0),
  forecastsShown: true,
  hiddenSeats: new Set<number>(),
  ghost: null,
};
screen.update(view);
const overlay = createFrescoOverlay(screen.overlay, painted.view, painted.city(), {
  change: () => undefined,
  refuse: () => undefined,
  placed: () => undefined,
  grain: () => undefined,
});
overlay.update(view);

Object.assign(window, { __year: { world, realm, plan, stage: painted, screen } });
