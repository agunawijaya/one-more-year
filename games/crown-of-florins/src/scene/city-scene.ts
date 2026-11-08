/**
 * The city-state as a scene: sky, land, the city built from its numbers,
 * its people and trees, its banner, and the light of the appearance.
 *
 * `show()` takes the realm's numbers (CityNumbers) and rebuilds what
 * changed, so the picture always agrees with the ledger: walls sized by the
 * land, a stall row per market, the cathedral at its stage, the palace in
 * its pieces, a figure for every 25 people.
 */
import type { InstancedMesh } from 'three';
import { AmbientLight, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from 'three';
import type { Appearance } from '@one-more-year/kit';
import type { ArmsSpec } from '../lib/heraldry.ts';
import { createBanner, type Banner } from './banners.ts';
import { buildCity, type CityModel, type Preview } from './city.ts';
import { createCrowd, createProcession, createTrees, type Crowd, type Trees } from './figures.ts';
import { planCity, type CityNumbers, type CityPlan } from './layout.ts';
import {
  applyPaletteUniforms,
  createFrescoUniforms,
  createPigmentMaterial,
  MAX_TORCHES,
  type FrescoUniforms,
} from './materials.ts';
import { paletteFor, type ScenePalette } from './palette.ts';
import { createSky, type Sky } from './sky.ts';
import { createGround, RIDGE_DEPTH, ridgeStartFor, type Ground } from './terrain.ts';
import { skylinePose, type CameraPose } from './view.ts';

export interface CityShowOptions {
  preview?: Preview;
  crowned?: boolean;
  /** The coronation's procession across the piazza. */
  procession?: boolean;
}

export interface CityScene {
  readonly scene: Scene;
  readonly uniforms: FrescoUniforms;
  readonly palette: ScenePalette;
  readonly plan: CityPlan | null;
  readonly city: CityModel | null;
  readonly ground: Ground;
  readonly sun: DirectionalLight;
  readonly banner: Banner | null;
  show(numbers: CityNumbers, arms: ArmsSpec, options?: CityShowOptions): void;
  setAppearance(appearance: Appearance): void;
  setShadowMap(size: number): void;
  /** Where the camera should look and how much it should take in. */
  framing(): { target: Vector3; radius: number };
  /** The painted view: the city from the southern fields to the sky over the ridge. */
  pose(options?: {
    elevation?: number;
    fov?: number;
    crestAt?: number;
    azimuth?: number;
  }): CameraPose;
  update(seconds: number, time: number): void;
  dispose(): void;
}

export function createCityScene(appearance: Appearance): CityScene {
  let palette = paletteFor(appearance);
  const scene = new Scene();
  const uniforms = createFrescoUniforms();
  applyPaletteUniforms(uniforms, palette);
  const still = createPigmentMaterial({ uniforms });
  const walkers = createPigmentMaterial({ uniforms, walkers: true });
  scene.fog = new Fog(palette.haze, palette.hazeNear, palette.hazeFar);

  const sky: Sky = createSky(palette);
  scene.add(sky.mesh);
  const ground = createGround(uniforms, palette);
  scene.add(ground.mesh);

  const hemi = new HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity);
  const ambient = new AmbientLight('#ffffff', 0.05);
  const sun = new DirectionalLight(palette.keyColor, palette.keyIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const shadow = sun.shadow.camera;
  shadow.left = -130;
  shadow.right = 130;
  shadow.top = 130;
  shadow.bottom = -130;
  shadow.near = 10;
  shadow.far = 700;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(hemi, ambient, sun, sun.target);

  let plan: CityPlan | null = null;
  let city: CityModel | null = null;
  let crowd: Crowd | null = null;
  let procession: InstancedMesh | null = null;
  let trees: Trees | null = null;
  let banner: Banner | null = null;
  let bannerArms: ArmsSpec | null = null;
  let treesFor = '';

  function placeSun(): void {
    const d = palette.keyDirection;
    sun.position.set(d.x * 300, d.y * 300, d.z * 300);
    sun.target.position.set(0, 0, -6);
    sun.color.copy(palette.keyColor);
    sun.intensity = palette.keyIntensity;
    hemi.color.copy(palette.hemiSky);
    hemi.groundColor.copy(palette.hemiGround);
    hemi.intensity = palette.hemiIntensity;
    const fog = scene.fog as Fog;
    fog.color.copy(palette.haze);
    fog.near = palette.hazeNear;
    fog.far = palette.hazeFar;
  }
  placeSun();

  function setTorches(model: CityModel): void {
    model.torches
      .slice(0, MAX_TORCHES)
      .forEach((torch, i) => uniforms.uTorches.value[i]?.copy(torch));
    uniforms.uTorchCount.value = Math.min(MAX_TORCHES, model.torches.length);
  }

  function rebuild(numbers: CityNumbers, arms: ArmsSpec, options: CityShowOptions): void {
    plan = planCity(numbers);
    if (city) {
      scene.remove(city.group);
      city.dispose();
    }
    city = buildCity(plan, palette, still, {
      ...(options.preview ? { preview: options.preview } : {}),
      ...(options.crowned ? { crowned: true } : {}),
    });
    scene.add(city.group);
    setTorches(city);
    ground.setPlan(plan, numbers.town);

    if (crowd) {
      scene.remove(crowd.people, crowd.soldiers);
      crowd.dispose();
    }
    crowd = createCrowd(plan, palette, walkers, still);
    scene.add(crowd.people, crowd.soldiers);
    if (procession) {
      scene.remove(procession);
      procession.geometry.dispose();
      procession = null;
    }
    if (options.procession) {
      procession = createProcession(palette, walkers);
      scene.add(procession);
    }

    // Trees depend only on the wall's size and the town: keep them while those hold.
    const key = `${numbers.town}:${plan.wallRadius.toFixed(1)}:${palette.appearance}`;
    if (key !== treesFor) {
      if (trees) {
        scene.remove(trees.cypresses, trees.olives);
        trees.dispose();
      }
      const ridgeStart = ridgeStartFor(plan.wallRadius);
      trees = createTrees(
        plan,
        palette,
        still,
        (x, z) => ground.heightAt(x, z),
        ridgeStart - RIDGE_DEPTH + 4,
      );
      scene.add(trees.cypresses, trees.olives);
      treesFor = key;
    }

    if (!banner || bannerArms !== arms) {
      if (banner) {
        scene.remove(banner.group);
        banner.dispose();
      }
      banner = createBanner(arms, uniforms, still, { pole: 4.5, size: 2.6 });
      bannerArms = arms;
      scene.add(banner.group);
    }
    const top = city.bannerPoint;
    banner.group.position.set(top.x + 0.4, top.y - 2.4, top.z + 0.4);
  }

  let last: { numbers: CityNumbers; arms: ArmsSpec; options: CityShowOptions } | null = null;

  return {
    scene,
    uniforms,
    get palette() {
      return palette;
    },
    get plan() {
      return plan;
    },
    get city() {
      return city;
    },
    ground,
    sun,
    get banner() {
      return banner;
    },
    show(numbers, arms, options = {}) {
      last = { numbers, arms, options };
      rebuild(numbers, arms, options);
    },
    setAppearance(next) {
      palette = paletteFor(next);
      applyPaletteUniforms(uniforms, palette);
      sky.setPalette(palette);
      ground.setPalette(palette);
      placeSun();
      // Building colours are baked into the geometry, so the city is rebuilt in the new palette.
      treesFor = '';
      if (last) rebuild(last.numbers, last.arms, last.options);
    },
    setShadowMap(size) {
      sun.castShadow = size > 0;
      if (size > 0 && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
    framing() {
      const radius = 62 + (plan?.wallRadius ?? 46) * 0.62;
      // Aim a little north of the piazza so the hills and the sky take the top of the picture.
      return { target: new Vector3(4, 0, -26), radius };
    },
    pose(options = {}) {
      const wallRadius = plan?.wallRadius ?? 45;
      const ridgeStart = ridgeStartFor(wallRadius);
      const crestAt = options.crestAt ?? 0.84;
      // The clouds are painted in the band above the hills' crests.
      sky.setHorizon(crestAt);
      return skylinePose({
        x: 3,
        bottomZ: wallRadius + 5,
        ridgeZ: ridgeStart - RIDGE_DEPTH,
        // The back row of hills stands a little in front of the land's end, its crests this high
        // as seen from the camera there.
        crest: 20,
        ...options,
        crestAt,
      });
    },
    update(_seconds, time) {
      uniforms.uTime.value = time;
      city?.update(time);
    },
    dispose() {
      city?.dispose();
      crowd?.dispose();
      trees?.dispose();
      banner?.dispose();
      sky.dispose();
      ground.dispose();
      still.dispose();
      walkers.dispose();
    },
  };
}
