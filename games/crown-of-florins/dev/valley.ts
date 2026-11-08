// The valley between years, from a real game: six seats, one human and five rivals.
//
//   ?appearance=dark&seed=5&years=18&march=0.55&clash
//
// The strongest army in the valley marches on the realm it would invade
// under the engine's own rules, its column caught `march` of the way along
// the road (1 at the walls, 1.06 the clash, 1.15 done). `clash` puts the
// camera where the game eases it, near the walls; past 1.08 the result is
// lettered on a ribbon.
import '../../../hall/src/styles/fonts.css';
import '../src/ui/crown.css';
import { quickCourt } from '../src/engine/court.ts';
import { invaderFor } from '../src/engine/invasion.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { titleName } from '../src/content/names.ts';
import { paletteFor } from '../src/scene/palette.ts';
import type { QualityLevel } from '../src/scene/quality.ts';
import { clashPose, createValleyScene } from '../src/scene/valley.ts';
import { createFrescoView } from '../src/scene/view.ts';
import { el } from '../src/ui/dom.ts';

const params = new URLSearchParams(window.location.search);
const number = (name: string, fallback: number): number => {
  const value = params.get(name);
  return value === null ? fallback : Number(value);
};
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const seed = number('seed', 5);

const { world } = playGame({
  seed,
  court: quickCourt(seed, 1, 5, { difficulty: 4 }),
  bot: policyFor('steward'),
  maxSteps: number('years', 18),
});

const root = el('div', { class: 'cf cf-valley-page', 'data-appearance': appearance });
const stage = el('div', { class: 'cf-valley-page__stage' });
root.append(stage);
document.getElementById('app')?.append(root);
stage.style.cssText = 'position:fixed;inset:0;';

const valley = createValleyScene(appearance);
// The army that would march: the strongest rival able to spare its troops, against the weakest realm.
const weakest = [...world.standings].sort((a, b) => a.soldiers - b.soldiers)[0];
const invader = weakest ? invaderFor(weakest.seat, world.standings) : null;
const marches =
  invader && weakest
    ? [
        {
          from: invader.seat,
          to: weakest.seat,
          progress: number('march', 0.55),
          soldiers: invader.soldiers,
          defenders: weakest.soldiers,
        },
      ]
    : [];
valley.show(world.realms, marches);

const view = createFrescoView(stage, {
  quality: (params.get('quality') ?? 'high') as QualityLevel,
  label: 'The valley and its city-states',
});
const palette = paletteFor(appearance);
view.setLook({
  intonaco: palette.intonaco,
  patina: palette.patina,
  sinopia: palette.sinopia,
  contour: palette.contour,
  night: appearance === 'dark' ? 1 : 0,
  pull: 0.35,
});
view.setFrame(number('frame', 0));
view.setScene({
  scene: valley.scene,
  update: (s, t) => valley.update(s, t),
  setShadowMap: (size) => valley.setShadowMap(size),
});
const pose = valley.pose({
  elevation: number('elevation', 0.72),
  fov: number('fov', 15),
  crestAt: number('crest', 0.84),
});
const meeting = params.has('clash') ? valley.clashPoint(0) : null;
view.setPose(meeting ? clashPose(pose, meeting) : pose);

void view.ready.then(() => {
  for (const realm of params.has('clash') ? [] : world.realms) {
    const site = valley.siteOf(realm.seat);
    const at = view.project({ x: site.x, y: 0, z: site.z + 22 });
    const ribbon = el(
      'div',
      {
        class: 'cf-ribbon',
        style: `left:${(at.x * 100).toFixed(2)}%;top:${(at.y * 100).toFixed(2)}%`,
      },
      el('strong', {}, realm.city),
      el('span', {}, `${titleName(realm.title, realm.ruler.form)} ${realm.ruler.name}`),
    );
    stage.append(ribbon);
  }
  const march = marches[0];
  if (march && meeting && march.progress >= 1.08) {
    const from = world.realms[march.from];
    const to = world.realms[march.to];
    const at = view.project({ x: meeting.x, y: 0, z: meeting.z + 34 });
    stage.append(
      el(
        'div',
        {
          class: 'cf-ribbon cf-ribbon--result',
          style: `left:${(at.x * 100).toFixed(2)}%;top:${(at.y * 100).toFixed(2)}%`,
        },
        el('strong', {}, `${from?.city ?? ''} takes its land`),
        el('span', {}, `${to?.city ?? ''} yields before its walls`),
      ),
    );
  } else if (marches[0] && invader && weakest) {
    const from = world.realms[marches[0].from];
    const to = world.realms[marches[0].to];
    const banner = el(
      'div',
      { class: 'cf-ribbon cf-ribbon--news', style: 'left:50%;top:5%' },
      el('strong', {}, `${from?.city ?? ''} marches on ${to?.city ?? ''}`),
      el(
        'span',
        {},
        `Anno ${world.year} · ${invader.soldiers} soldiers against ${weakest.soldiers}`,
      ),
    );
    stage.append(banner);
  }
});

Object.assign(window, { __valley: { world, view, valley } });
