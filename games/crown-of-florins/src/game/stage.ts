/**
 * The painted stage every screen shares: one WebGL view, the city and the
 * valley it can paint, and the gold of a coronation laid over either.
 *
 * Only one renderer ever exists. A screen asks the stage to paint a realm's
 * city or the valley, in the current appearance, on whatever host it gives
 * (the fresco panel of the year screen, or the whole screen for the
 * cinematic moments). Scenes are built the first time they are needed and
 * kept: three.js geometry is expensive to make and cheap to keep.
 */
import type { Appearance } from '@one-more-year/kit';
import type { Realm } from '../engine/state.ts';
import { createCityScene, type CityScene, type CityShowOptions } from '../scene/city-scene.ts';
import { createGilding, type Gilding } from '../scene/gilding.ts';
import { cityNumbersOf } from '../scene/numbers.ts';
import { paletteFor } from '../scene/palette.ts';
import type { QualityLevel } from '../scene/quality.ts';
import { createValleyScene, type March, type ValleyScene } from '../scene/valley.ts';
import { createFrescoView, type CameraPose, type FrescoView } from '../scene/view.ts';
import type { CityNumbers } from '../scene/layout.ts';

export type Painting = 'city' | 'valley' | null;

export interface Stage {
  readonly view: FrescoView;
  readonly painting: Painting;
  /** The city scene, built on first use. */
  city(): CityScene;
  /** The valley scene, built on first use. */
  valley(): ValleyScene;
  paintCity(
    realm: Realm,
    options?: CityShowOptions & { numbers?: Partial<CityNumbers>; frame?: number },
  ): void;
  paintValley(realms: readonly Realm[], marches?: readonly March[], frame?: number): void;
  /** The city's own painted framing, or a variation of it. */
  cityPose(options?: {
    elevation?: number;
    crestAt?: number;
    fov?: number;
    azimuth?: number;
  }): CameraPose;
  valleyPose(options?: { elevation?: number; crestAt?: number; fov?: number }): CameraPose;
  /** Starts (or ends, with null) the coronation's gold. */
  gild(on: boolean): Gilding | null;
  setAppearance(appearance: Appearance): void;
  attach(host: HTMLElement): void;
  setQuality(level: QualityLevel): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export function createStage(
  host: HTMLElement,
  options: { appearance: Appearance; quality: QualityLevel; loop?: boolean },
): Stage {
  let appearance = options.appearance;
  const view = createFrescoView(host, {
    quality: options.quality,
    label: 'The city-state, painted as a fresco',
    ...(options.loop === false ? { loop: false } : {}),
  });
  let city: CityScene | null = null;
  let valley: ValleyScene | null = null;
  let painting: Painting = null;
  let gilding: Gilding | null = null;

  function applyLook(): void {
    const palette = paletteFor(appearance);
    view.setLook({
      intonaco: palette.intonaco,
      patina: palette.patina,
      sinopia: palette.sinopia,
      contour: palette.contour,
      night: appearance === 'dark' ? 1 : 0,
      pull: 0.35,
    });
    gilding?.setNight(appearance === 'dark' ? 1 : 0);
  }
  applyLook();

  function cityScene(): CityScene {
    city ??= createCityScene(appearance);
    return city;
  }

  function valleyScene(): ValleyScene {
    valley ??= createValleyScene(appearance);
    return valley;
  }

  function show(next: Exclude<Painting, null>): void {
    if (painting === next) return;
    painting = next;
    if (next === 'city') {
      const scene = cityScene();
      view.setScene({
        scene: scene.scene,
        update: (s, t) => scene.update(s, t),
        setShadowMap: (size) => scene.setShadowMap(size),
      });
    } else {
      const scene = valleyScene();
      view.setScene({
        scene: scene.scene,
        update: (s, t) => scene.update(s, t),
        setShadowMap: (size) => scene.setShadowMap(size),
      });
    }
  }

  return {
    view,
    get painting() {
      return painting;
    },
    city: cityScene,
    valley: valleyScene,
    paintCity(realm, paint = {}) {
      const { numbers, frame, ...showOptions } = paint;
      cityScene().show({ ...cityNumbersOf(realm), ...numbers }, realm.arms, showOptions);
      view.setFrame(frame ?? 13);
      show('city');
    },
    paintValley(realms, marches = [], frame = 0) {
      valleyScene().show(realms, marches);
      view.setFrame(frame);
      show('valley');
    },
    cityPose: (poseOptions) => cityScene().pose(poseOptions),
    valleyPose: (poseOptions) => valleyScene().pose(poseOptions),
    gild(on) {
      if (!on) {
        view.setOverlay(null);
        gilding?.dispose();
        gilding = null;
        return null;
      }
      gilding ??= createGilding();
      gilding.setNight(appearance === 'dark' ? 1 : 0);
      view.setOverlay(gilding);
      return gilding;
    },
    setAppearance(next) {
      if (next === appearance) return;
      appearance = next;
      city?.setAppearance(next);
      valley?.setAppearance(next);
      applyLook();
    },
    attach: (next) => view.attach(next),
    setQuality: (level) => view.setQualityCeiling(level),
    setPaused: (paused) => view.setPaused(paused),
    dispose() {
      gilding?.dispose();
      city?.dispose();
      valley?.dispose();
      view.dispose();
    },
  };
}
