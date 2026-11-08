/**
 * Crown of Florins' living demo for the Hall: four AI rivals ruling the
 * valley by themselves, a year about every three seconds, banners rising
 * with their title points and the occasional army on the road. Silent. It
 * draws only when a year turns (and while its marches move), and the kit
 * pauses it off-screen. It reports the leading realm's four signals.
 *
 * The diorama style paints the valley as the fresco, at light quality.
 * The engraved and instrument styles, and any browser where WebGL would run
 * on the CPU, get the valley as a drawn map in the theme's colours.
 */
import {
  createModelDemo,
  type DemoHandle,
  type DemoLook,
  type DemoRenderer,
  type TurnModel,
} from '@one-more-year/kit';
import { crownModel } from './engine/model.ts';
import { openingPlan } from './engine/plan.ts';
import { titlePoints } from './engine/title.ts';
import { actingRealm } from './engine/world.ts';
import { titleInputs } from './engine/year.ts';
import type { Plan, World } from './engine/state.ts';
import { createStage, type Stage } from './game/stage.ts';
import { webglRunsOnCpu } from './lib/gpu.ts';
import { createValleyMap, type ValleyMap } from './scene/valley-map.ts';

/** The seat with the most title points: the one the Hall's sparklines follow. */
function leadingSeat(world: World): number {
  let best = 0;
  let bestPoints = -1;
  for (const realm of world.realms) {
    const points = titlePoints(titleInputs(realm));
    if (points > bestPoints) {
      best = realm.seat;
      bestPoints = points;
    }
  }
  return best;
}

const demoModel: TurnModel<World, Plan> = {
  ...crownModel,
  signals: (world) => crownModel.signals(world, leadingSeat(world)),
};

function frescoRenderer(): DemoRenderer<World> {
  let stage: Stage | null = null;
  return {
    mount(host, look) {
      stage = createStage(host, { appearance: look.appearance, quality: 'light', loop: false });
    },
    draw(world, _previous, progress) {
      if (!stage) return;
      const marches = world.between
        .filter((note) => note.kind === 'invaded' && (note.numbers.by ?? -1) >= 0)
        .map((note) => ({
          from: note.numbers.by ?? 0,
          to: note.seat,
          progress: Math.min(1.1, progress * 1.1),
        }));
      if (progress === 0 || stage.painting !== 'valley') {
        stage.paintValley(world.realms, marches, 0);
        stage.view.setPose(stage.valleyPose({ elevation: 0.66 }));
      } else {
        stage.valley().setProgress(marches.map((m) => m.progress));
      }
      stage.view.renderOnce();
    },
    setLook(look) {
      stage?.setAppearance(look.appearance);
      stage?.view.renderOnce();
    },
    dispose() {
      stage?.dispose();
      stage = null;
    },
  };
}

function mapRenderer(): DemoRenderer<World> {
  let map: ValleyMap | null = null;
  return {
    mount(host, look) {
      map = createValleyMap(host, look.palette);
    },
    draw(world, _previous, progress) {
      map?.draw(world.realms, world.between, progress);
    },
    setLook(look) {
      map?.setPalette(look.palette);
    },
    dispose() {
      map?.dispose();
      map = null;
    },
  };
}

/** Switches between the fresco and the map as the Hall's style changes. */
function styledRenderer(): DemoRenderer<World> {
  let host: HTMLElement | null = null;
  let current: DemoRenderer<World> | null = null;
  let kind: 'fresco' | 'map' | null = null;
  const choose = (look: DemoLook): 'fresco' | 'map' =>
    look.style === 'diorama' && !webglRunsOnCpu() ? 'fresco' : 'map';
  function use(look: DemoLook): void {
    const wanted = choose(look);
    if (wanted === kind || !host) return;
    current?.dispose();
    current = wanted === 'fresco' ? frescoRenderer() : mapRenderer();
    kind = wanted;
    current.mount(host, look);
  }
  return {
    mount(target, look) {
      host = target;
      use(look);
    },
    draw: (world, previous, progress, frame) => current?.draw(world, previous, progress, frame),
    setLook(look) {
      use(look);
      current?.setLook(look);
    },
    dispose() {
      current?.dispose();
      current = null;
    },
  };
}

export function crownDemo(host: HTMLElement, seed: number, look: DemoLook): DemoHandle {
  return createModelDemo({
    host,
    seed,
    model: demoModel,
    // A court of rivals alone plays its whole year itself; the plan is only a placeholder.
    bot: (world) => openingPlan(actingRealm(world)),
    renderer: styledRenderer(),
    look,
    scenario: 'demo',
    pace: 3000,
  });
}
