/**
 * The coronation. Bells ring, a procession fills the piazza, petals fall,
 * and gold leaf spreads across the whole fresco from the crown on the palace
 * outward (scene/gilding.ts: square leaves, a red bole at the leading edge,
 * craquelure, a moving glint) until the whole city is gilded. Then the
 * camera pulls back to the valley, where every rival's banner bows.
 *
 * Under reduced motion the gold appears in one short fade and the banners
 * are shown already bowed.
 */
import { ordinal, type Appearance } from '@one-more-year/kit';
import type { Realm, World } from '../../engine/state.ts';
import { titleName } from '../../content/names.ts';
import { el } from '../../ui/dom.ts';
import { createPetals } from '../../ui/petals.ts';
import type { Stage } from '../stage.ts';

export interface CoronationOptions {
  host: HTMLElement;
  stage: Stage;
  world: World;
  realm: Realm;
  appearance: Appearance;
  /** Seconds for the gold to spread; 0 shows it gilded at once. */
  length: number;
  reducedMotion: boolean;
  continueLabel: string;
  sound: { bells(): void; choir(): void };
  onContinue(): void;
}

export interface CoronationRun {
  skip(): void;
  dispose(): void;
}

export function runCoronation(options: CoronationOptions): CoronationRun {
  const { stage, realm, world } = options;
  stage.attach(options.host);
  stage.paintCity(realm, { crowned: true, procession: true, frame: 18 });
  const pose = stage.cityPose({ elevation: 0.48, crestAt: 0.86 });
  stage.view.setPose(options.reducedMotion ? pose : { ...pose, distance: pose.distance * 1.08 });
  if (!options.reducedMotion) stage.view.setPose(pose, Math.max(2, options.length));
  const gilding = stage.gild(true);
  const crown = stage.city().city?.crownPoint ?? { x: 16.2, y: 38, z: -5.6 };

  const title = titleName(8, realm.ruler.form);
  const cartouche = el(
    'div',
    { class: 'cf-cartouche', role: 'status' },
    el(
      'p',
      { class: 'cf-cartouche__eyebrow' },
      `Anno ${realm.record.crownedYear ?? world.year} · ${realm.city}`,
    ),
    el('h1', { class: 'cf-cartouche__title' }, `${title} ${realm.ruler.name}`),
    el(
      'p',
      { class: 'cf-cartouche__line' },
      `Crowned in the ${ordinal((realm.record.crownedYear ?? world.year) - realm.ruler.accession + 1)} year of the reign`,
    ),
  );
  const button = el(
    'button',
    {
      type: 'button',
      class: 'cf-button cf-button--primary cf-coronation__next',
      'data-action': 'continue',
      hidden: true,
    },
    options.continueLabel,
  );
  const skip = el(
    'button',
    { type: 'button', class: 'cf-skip', 'data-action': 'skip' },
    'Skip',
    el('kbd', {}, 'Space'),
  );
  const petals = createPetals(options.reducedMotion ? 30 : 70, world.year);
  const layer = el(
    'div',
    { class: 'cf-coronation', 'data-motion': options.reducedMotion ? 'reduced' : null },
    petals,
    cartouche,
    skip,
    button,
  );
  options.host.append(layer);
  options.sound.bells();
  window.setTimeout(() => options.sound.choir(), 1200);

  const length = options.reducedMotion ? 0.8 : Math.max(0.001, options.length);
  // The gold's clock runs on painted frames (each counts for a tenth of a second at most), so a
  // slow shader compile never eats the spreading leaf.
  let gilded = 0;
  let phase: 'gilding' | 'valley' | 'done' = 'gilding';
  let valleyStarted = 0;

  const stop = stage.view.onFrame(({ seconds }) => {
    if (phase === 'gilding' && gilding) {
      gilded += seconds;
      const origin = stage.view.project(crown);
      gilding.setOrigin(origin.x, origin.y);
      const t = options.length <= 0 ? 1.05 : Math.min(1.05, gilded / length);
      // Eased in: the leaf creeps out from the crown and gathers pace, instead of covering the
      // middle of the picture in the first moment and spending the rest on its corners.
      gilding.setProgress(t < 1 ? t ** 1.6 : t);
      if (t >= 1.05) {
        // Let the gilded city be looked at for a breath before the valley.
        window.setTimeout(
          () => toValley(),
          options.length <= 0 || options.reducedMotion ? 0 : 1800,
        );
        phase = 'done';
      }
    } else if (phase === 'valley') {
      const t = options.reducedMotion ? 1 : Math.min(1, (performance.now() - valleyStarted) / 2400);
      stage.valley().bow(realm.seat, t);
    }
  });

  function toValley(): void {
    if (phase === 'valley') return;
    stage.gild(false);
    stage.paintValley(world.realms, [], 0);
    const valleyPose = stage.valleyPose({ elevation: 0.62 });
    if (options.reducedMotion) stage.view.setPose(valleyPose);
    else {
      stage.view.setPose({ ...valleyPose, distance: valleyPose.distance * 0.7 });
      stage.view.setPose(valleyPose, 2.4);
    }
    phase = 'valley';
    valleyStarted = performance.now();
    cartouche.replaceChildren(
      el('p', { class: 'cf-cartouche__eyebrow' }, 'The valley'),
      el('h1', { class: 'cf-cartouche__title' }, `Every banner bows to ${realm.city}`),
    );
    skip.hidden = true;
    button.hidden = false;
    button.focus();
  }

  skip.addEventListener('click', () => toValley());
  button.addEventListener('click', () => options.onContinue());

  return {
    skip: () => {
      if (phase === 'valley') options.onContinue();
      else toValley();
    },
    dispose() {
      stop();
      stage.gild(false);
      layer.remove();
    },
  };
}
