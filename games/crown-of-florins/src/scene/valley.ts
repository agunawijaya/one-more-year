/**
 * The valley between years: a painted map of every realm's city-state at
 * its true size, the river and the roads that join them, and the hills
 * around. Each city flies its arms on a banner whose pole rises with its
 * title points. Invasions march here (src/scene/armies.ts): a column as
 * long as its army on the road, the garrison formed before its walls, a
 * stylised clash of pennants, spear-lines and dust, and the loser's banner
 * dipping when it is done.
 *
 * The same scene is the Hall's demo: four rivals playing quietly, a year
 * every few seconds.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
  Vector2,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { Appearance } from '@one-more-year/kit';
import type { Realm } from '../engine/state.ts';
import { createRng, hashString } from '@one-more-year/kit';
import { createArmies, roadLength, type ArmyRoute, type March } from './armies.ts';
import { createBanner, type Banner } from './banners.ts';
import { LUMA, NOISE, PAINTED_LIGHT } from './glsl.ts';
import { HILL_PAINT, hillRange, layHills, type Hill } from './hills.ts';
import {
  applyPaletteUniforms,
  createFrescoUniforms,
  createPigmentMaterial,
  MAX_TORCHES,
  type FrescoUniforms,
} from './materials.ts';
import { paletteFor, type ScenePalette } from './palette.ts';
import { PartsBuilder, SURFACE } from './parts.ts';
import { createSky } from './sky.ts';
import { wallRadiusFor, type Point } from './layout.ts';
import { RIDGE_DEPTH } from './terrain.ts';
import { skylinePose, type CameraPose } from './view.ts';

/** Where the six seats' cities stand in the valley, west to east around the river. */
export const CITY_SITES: readonly Point[] = [
  { x: -150, z: 30 },
  { x: -70, z: -78 },
  { x: 60, z: -92 },
  { x: 160, z: -6 },
  { x: 92, z: 102 },
  { x: -52, z: 112 },
];

/** The scale of a city in the valley against the city view: small, but true to its land. */
const MAP_SCALE = 0.42;

/**
 * The river's course from the hills in the north to the foot of the picture, an S that passes
 * between the cities, never through one: it runs between the two northern towns and between the
 * two southern ones, where the roads that join them cross it on bridges.
 */
export const RIVER: readonly Point[] = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23;
  return {
    x: 8 + Math.sin(Math.PI * 2 * 1.1 * (t - 0.3)) * 18 + Math.sin(t * 15) * 4,
    z: -210 + t * 440,
  };
});

/** How far a city's footprint reaches in the valley, for a realm of this land. */
export function mapRadiusFor(land: number): number {
  return wallRadiusFor(land) * MAP_SCALE;
}

export type { March } from './armies.ts';

export interface ValleyScene {
  readonly scene: Scene;
  readonly uniforms: FrescoUniforms;
  show(realms: readonly Realm[], marches?: readonly March[]): void;
  /** Moves the columns of the marches last shown along their roads, without rebuilding them. */
  setProgress(progresses: readonly number[]): void;
  /** Bows every banner but one (the coronation's salute). */
  bow(except: number | null, amount: number): void;
  setAppearance(appearance: Appearance): void;
  setShadowMap(size: number): void;
  pose(options?: { elevation?: number; fov?: number; crestAt?: number }): CameraPose;
  /** Where a seat's city stands, for labels. */
  siteOf(seat: number): Point & { y: number };
  /** Where the march `index` (of those last shown) meets the walls, for the camera and the ribbon. */
  clashPoint(index: number): Point | null;
  /** Holds the armies' dust, pennants and step still (reduced motion), or lets them move again. */
  freeze(still: boolean): void;
  update(seconds: number, time: number): void;
  dispose(): void;
}

/** The camera eased in toward a clash: the same painted view, nearer, looking at the walls. */
export function clashPose(base: CameraPose, at: Point): CameraPose {
  return {
    ...base,
    target: { x: at.x, y: 0, z: at.z },
    distance: base.distance * 0.34,
    elevation: base.elevation + 0.05,
  };
}

export function roadBetween(a: Point, b: Point): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const bend = Math.sin(t * Math.PI) * 14 * Math.sign(a.x - b.x || 1);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1;
    points.push({
      x: a.x + dx * t + (-dz / length) * bend,
      z: a.z + dz * t + (dx / length) * bend,
    });
  }
  return points;
}

/** Roads: each city to its two neighbours around the valley. */
function valleyRoads(count: number): Point[][] {
  const roads: Point[][] = [];
  for (let i = 0; i < count; i++) {
    const a = CITY_SITES[i] as Point;
    const b = CITY_SITES[(i + 1) % count] as Point;
    if (count > 2 || i === 0) roads.push(roadBetween(a, b));
  }
  return roads;
}

/** Where the hills at the back of the valley begin to rise; the land ends behind them. */
const VALLEY_RIDGE = -150;

/**
 * The valley's hills: two rows of cushions climbing to a high back row whose crests make the
 * skyline (wholly in front of the land's end), and on either side a chain of hills that closes
 * the valley, higher the further out. No hill stands alone on the plain: a low one there reads
 * as an outlined ring, not a hill.
 */
function valleyHills(): Hill[] {
  const end = VALLEY_RIDGE - RIDGE_DEPTH;
  const back = layHills(
    'valley',
    [
      { z: end + 16, depth: [13, 17], height: [30, 44], width: [84, 140], spacing: [0.5, 0.72] },
      { z: end + 33, depth: [10, 14], height: [17, 27], width: [62, 110], spacing: [0.6, 1.0] },
    ],
    [-440, 440],
  );
  const rng = createRng(hashString('valley:sides'));
  const sides: Hill[] = [];
  for (const side of [-1, 1]) {
    for (let z = VALLEY_RIDGE + 10; z < 260; z += 34 + rng.next() * 26) {
      const out = rng.next();
      sides.push({
        x: side * (300 + out * 90),
        z,
        rx: 44 + rng.next() * 30,
        rz: 30 + rng.next() * 18,
        height: 12 + out * 16 + rng.next() * 6,
      });
    }
  }
  return [...back, ...sides];
}

const VALLEY_HILLS = hillRange(valleyHills(), (x, z) => {
  // The foot of the hills wanders, so the plain does not meet them along a ruled line.
  const foot = VALLEY_RIDGE + Math.sin(x * 0.011 + 1) * 9 + Math.sin(x * 0.029) * 5;
  const rise = Math.min(1, Math.max(0, (foot - z) / RIDGE_DEPTH));
  return rise * rise * (3 - 2 * rise) * 9;
});

export function valleyHeight(x: number, z: number): number {
  return VALLEY_HILLS.heightAt(x, z);
}

export function createValleyScene(appearance: Appearance): ValleyScene {
  let palette = paletteFor(appearance);
  const scene = new Scene();
  const uniforms = createFrescoUniforms();
  applyValleyPalette(uniforms, palette);
  const still = createPigmentMaterial({ uniforms });
  const walkers = createPigmentMaterial({ uniforms, walkers: true });
  scene.fog = new Fog(palette.haze, 1400, 3000);
  const sky = createSky(palette);
  scene.add(sky.mesh);

  const hemi = new HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity);
  const sun = new DirectionalLight(palette.keyColor, palette.keyIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -260,
    right: 260,
    top: 240,
    bottom: -240,
    near: 10,
    far: 900,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  scene.add(hemi, new AmbientLight('#ffffff', 0.05), sun, sun.target);

  const ground = createValleyGround(uniforms, palette);
  scene.add(ground.mesh);

  let cities: Mesh | null = null;
  let banners: { seat: number; banner: Banner }[] = [];
  const armies = createArmies({ uniforms, walkers, still });
  scene.add(armies.group);
  let lastRealms: readonly Realm[] = [];
  let lastMarches: readonly March[] = [];
  let progresses: number[] = [];
  let clock = 0;
  let frozen = false;

  function placeLights(): void {
    const d = palette.keyDirection;
    sun.position.set(d.x * 400, d.y * 400, d.z * 400);
    sun.color.copy(palette.keyColor);
    // The valley's night is lit by a full moon: brighter than the narrow streets of a town.
    sun.intensity = palette.keyIntensity * (palette.appearance === 'dark' ? 2.2 : 1);
    hemi.color.copy(palette.hemiSky);
    hemi.groundColor.copy(palette.hemiGround);
    hemi.intensity = palette.hemiIntensity;
    (scene.fog as Fog).color.copy(palette.haze);
  }
  placeLights();

  function show(realms: readonly Realm[], marches: readonly March[] = []): void {
    lastRealms = realms;
    lastMarches = marches;
    if (cities) {
      scene.remove(cities);
      cities.geometry.dispose();
    }
    const parts = new PartsBuilder();
    const torches: { x: number; y: number; z: number }[] = [];
    realms.forEach((realm) =>
      buildMiniCity(parts, realm, CITY_SITES[realm.seat] ?? { x: 0, z: 0 }, palette, torches),
    );
    const footprints = realms.map((r) => ({
      site: CITY_SITES[r.seat] ?? { x: 0, z: 0 },
      radius: mapRadiusFor(r.land),
    }));
    buildValleyLand(parts, palette, footprints);
    cities = new Mesh(parts.build(), still);
    cities.castShadow = true;
    cities.receiveShadow = true;
    scene.add(cities);
    torches
      .slice(0, MAX_TORCHES)
      .forEach((t, i) => uniforms.uTorches.value[i]?.set(t.x, t.y, t.z, 1.5));
    uniforms.uTorchCount.value = Math.min(MAX_TORCHES, torches.length);
    ground.setRoads(
      valleyRoads(realms.length),
      realms.map((r) => ({
        site: CITY_SITES[r.seat] ?? { x: 0, z: 0 },
        radius: wallRadiusFor(r.land) * MAP_SCALE,
      })),
    );

    for (const old of banners) {
      scene.remove(old.banner.group);
      old.banner.dispose();
    }
    banners = realms.map((realm) => {
      const site = CITY_SITES[realm.seat] ?? { x: 0, z: 0 };
      const points = realm.pointsHistory.at(-1) ?? 2;
      // The pole rises with the title points: a tall banner is a realm near the crown. Like the
      // armies, banners are painted larger than life so the arms read across the valley.
      const banner = createBanner(realm.arms, uniforms, still, {
        pole: 13 + points * 0.55,
        size: 11.5,
      });
      banner.group.position.set(site.x + 2, 0, site.z - 3);
      scene.add(banner.group);
      return { seat: realm.seat, banner };
    });

    showArmies(marches, realms);
  }

  /** The routes of this year's marches: each from its own gate to the walls it wants. */
  function showArmies(marches: readonly March[], realms: readonly Realm[]): void {
    const routes: ArmyRoute[] = marches.map((march) => {
      const from = CITY_SITES[march.from] ?? { x: 0, z: 0 };
      const to = CITY_SITES[march.to] ?? { x: 0, z: 0 };
      const road = roadBetween(from, to);
      const length = roadLength(road);
      const fromRadius = mapRadiusFor(realms.find((r) => r.seat === march.from)?.land ?? 10_000);
      const toRadius = mapRadiusFor(realms.find((r) => r.seat === march.to)?.land ?? 10_000);
      return {
        march,
        road,
        start: Math.min(0.45, (fromRadius + 1) / length),
        end: Math.max(0.55, 1 - (toRadius + 5) / length),
        target: to,
        targetRadius: toRadius,
      };
    });
    armies.show(routes, realms, palette);
    progresses = marches.map((march) => march.progress);
    placeArmies();
  }

  /** The armies where their progress puts them, and the loser's banner dipping after the clash. */
  function placeArmies(): void {
    armies.place(progresses, clock);
    lastMarches.forEach((march, i) => {
      // The engine's invader always takes its land: the defenders' banner is the one that dips.
      const dip = Math.min(1, Math.max(0, ((progresses[i] ?? 0) - 1.07) / 0.07));
      const loser = banners.find((b) => b.seat === march.to);
      loser?.banner.setBow(dip * 0.85);
    });
  }

  return {
    scene,
    uniforms,
    show,
    setProgress(next) {
      lastMarches = lastMarches.map((march, i) => ({
        ...march,
        progress: next[i] ?? march.progress,
      }));
      progresses = [...next];
      placeArmies();
    },
    bow(except, amount) {
      const crowned = except === null ? null : CITY_SITES[except];
      for (const { seat, banner } of banners) {
        if (seat === except) {
          banner.setBow(0);
          continue;
        }
        // Every other banner dips toward the crowned city.
        const site = CITY_SITES[seat] ?? { x: 0, z: 0 };
        banner.setBow(
          amount,
          crowned ? { x: crowned.x - site.x, z: crowned.z - site.z } : undefined,
        );
      }
    },
    setAppearance(next) {
      palette = paletteFor(next);
      applyValleyPalette(uniforms, palette);
      sky.setPalette(palette);
      ground.setPalette(palette);
      placeLights();
      show(lastRealms, lastMarches);
    },
    setShadowMap(size) {
      sun.castShadow = size > 0;
      if (size > 0 && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
    pose(options = {}) {
      const crestAt = options.crestAt ?? 0.84;
      sky.setHorizon(crestAt);
      return skylinePose({
        x: 4,
        bottomZ: 150,
        ridgeZ: VALLEY_RIDGE - RIDGE_DEPTH,
        crest: 28,
        elevation: 0.62,
        azimuth: 0.05,
        ...options,
        crestAt,
      });
    },
    siteOf(seat) {
      const site = CITY_SITES[seat] ?? { x: 0, z: 0 };
      return { ...site, y: 0 };
    },
    clashPoint: (index) => armies.clashPoint(index),
    freeze(next) {
      frozen = next;
    },
    update(_seconds, time) {
      uniforms.uTime.value = time;
      if (!frozen) clock = time;
      if (lastMarches.length > 0) placeArmies();
    },
    dispose() {
      cities?.geometry.dispose();
      armies.dispose();
      for (const { banner } of banners) banner.dispose();
      ground.dispose();
      sky.dispose();
      still.dispose();
      walkers.dispose();
    },
  };
}

/**
 * The valley by night is a moonlit painting, not a dark one: the land keeps
 * more of its value than the city's streets do, so every field, road and
 * town still reads, and the towns glow as warm islands in it.
 */
function applyValleyPalette(uniforms: FrescoUniforms, palette: ScenePalette): void {
  applyPaletteUniforms(uniforms, palette);
  if (palette.appearance === 'dark') uniforms.uNightTint.value.set('#c4cce4');
}

/**
 * A city-state in miniature, its silhouette telling its state at a glance:
 * walls at its true size, higher and towered at every corner when its
 * garrison covers its land, the nobles' tower-houses rising over the roofs
 * (one for every three nobles, up to eight), striped awnings for its
 * markets, the cathedral as far as raised (nave, aisles, façade, dome,
 * campanile) and the palace tower climbing with its pieces.
 */
function buildMiniCity(
  parts: PartsBuilder,
  realm: Realm,
  site: Point,
  palette: ScenePalette,
  torches: { x: number; y: number; z: number }[],
): void {
  const radius = mapRadiusFor(realm.land);
  const corners = 10;
  const stone = palette.wallStone;
  const guarded = realm.people.soldiers >= realm.land / 1000;
  const wallHeight = guarded ? 4.2 : 3.2;
  const ring: Point[] = Array.from({ length: corners }, (_, i) => {
    const a = (i / corners) * Math.PI * 2 + realm.seat;
    const wobble = 0.9 + 0.12 * Math.sin(i * 2.3 + realm.seat);
    return { x: site.x + Math.cos(a) * radius * wobble, z: site.z + Math.sin(a) * radius * wobble };
  });
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % corners] as Point;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    parts.object().box((a.x + b.x) / 2, (a.z + b.z) / 2, length, 1.3, wallHeight, stone, {
      angle: -angle,
      sides: SURFACE.stone,
    });
    // A tower at every corner of a well-kept wall, every other corner of a thin one.
    if (guarded || i % 2 === 0) {
      parts.box(a.x, a.z, 2.8, 2.8, wallHeight + 2.4, stone, { sides: SURFACE.stone });
      parts.battlements(a.x - 1.4, a.z, a.x + 1.4, a.z, wallHeight + 2.4, stone, 0.5, false);
    }
    if (i % 2 === 0) torches.push({ x: a.x, y: 6, z: a.z });
  });
  // Lamps in the piazza at the heart of the town.
  torches.push({ x: site.x, y: 4, z: site.z });
  // Houses fill the walls, more of them as the city grows.
  const houses = Math.min(
    90,
    14 + Math.floor((realm.people.serfs + realm.people.merchants * 8) / 260),
  );
  const towers = Math.min(8, Math.floor(realm.people.nobles / 3));
  for (let i = 0; i < houses; i++) {
    const a = i * 2.39996;
    const r = Math.sqrt((i + 0.5) / houses) * radius * 0.78;
    const x = site.x + Math.cos(a) * r;
    const z = site.z + Math.sin(a) * r;
    if (Math.hypot(x - site.x, z - site.z) < radius * 0.22) continue;
    const tone = palette.plaster[i % palette.plaster.length] as Color;
    if (i % 9 === 4 && i / 9 < towers) {
      // A noble family's tower-house: slender, tall, its roof flat behind a parapet.
      const tall = 8 + ((i * 13) % 5);
      parts.object().box(x, z, 1.5, 1.5, tall, tone, { sides: SURFACE.facade });
      parts.battlements(x - 0.75, z, x + 0.75, z, tall, tone, 0.4, false);
      continue;
    }
    const h = 2.2 + ((i * 7) % 5) * 0.4;
    parts.object().box(x, z, 2.1, 1.9, h, tone, { sides: SURFACE.facade });
    parts.hipRoof(x, z, 2.1, 1.9, 0.7, h, palette.roof);
  }
  // Market awnings around the piazza, one for each market up to six.
  const awnings = Math.min(6, realm.holdings.markets);
  for (let i = 0; i < awnings; i++) {
    const a = (i / Math.max(1, awnings)) * Math.PI * 2 + 0.4;
    const x = site.x + Math.cos(a) * radius * 0.3;
    const z = site.z + Math.sin(a) * radius * 0.3;
    const colour = palette.awnings[i % palette.awnings.length] ?? palette.roof;
    parts.object().gableRoof(x, z, 2.4, 1.6, 0.6, 1.4, colour, { angle: a });
  }
  // The cathedral (as far as built) and the palace tower stand at the heart.
  const c = realm.holdings.cathedral;
  if (c >= 1) {
    parts.object().box(site.x - 1.5, site.z - 2, 7, 3, c >= 2 ? 5 : 1.2, palette.marbleLight, {
      angle: Math.PI / 2,
      sides: SURFACE.marble,
    });
  }
  if (c >= 2) {
    parts.gableRoof(site.x - 1.5, site.z - 2, 7, 3, 1.2, 5, palette.roof, { angle: Math.PI / 2 });
  }
  if (c >= 3) {
    parts.box(site.x - 3.6, site.z - 2, 7, 1.4, 3.4, palette.marbleLight, {
      angle: Math.PI / 2,
      sides: SURFACE.marble,
    });
  }
  if (c >= 5) {
    parts.prism(site.x - 1.5, site.z - 4.2, 2, 1.6, 8, palette.marbleLight, SURFACE.marble, 5);
    parts.dome(site.x - 1.5, site.z - 4.2, 2.1, 3, 6.6, 8, palette.dome, 4);
  }
  if (c >= 6) {
    parts.box(site.x + 1.6, site.z + 0.4, 1.5, 1.5, 11, palette.marbleLight, {
      sides: SURFACE.marble,
    });
    parts.cone(site.x + 1.6, site.z + 0.4, 1.1, 2, 4, palette.roof, SURFACE.roof, 11);
  }
  if (realm.holdings.palace >= 1) {
    const towerHeight = 5 + Math.min(10, realm.holdings.palace) * 0.9;
    parts.object().box(site.x + 3.5, site.z - 1, 3.4, 3.4, 4.5, palette.plaster[3] ?? stone, {
      sides: SURFACE.facade,
    });
    parts.box(site.x + 2.8, site.z - 2, 1.3, 1.3, towerHeight, stone, { sides: SURFACE.stone });
    parts.battlements(
      site.x + 2.15,
      site.z - 2,
      site.x + 3.45,
      site.z - 2,
      towerHeight,
      stone,
      0.5,
      false,
    );
  }
}

/**
 * Everything between the towns: woods, farmsteads, lone trees and the bridges, all clear of every
 * town's walls and of the river. (By night the countryside keeps its daytime pigments; the
 * moonlight does the darkening.)
 */
export function buildValleyLand(
  parts: PartsBuilder,
  palette: ScenePalette,
  footprints: readonly Footprint[],
): void {
  buildCountryside(
    parts,
    palette.appearance === 'dark' ? paletteFor('light') : palette,
    footprints,
  );
  buildBridges(parts, valleyRoads(footprints.length), palette, footprints);
}

/** A town's place in the valley and how far its walls reach. */
export interface Footprint {
  site: Point;
  radius: number;
}

/** Woods, groves and farmsteads across the valley floor, clear of the towns and the river. */
function buildCountryside(
  parts: PartsBuilder,
  palette: ScenePalette,
  footprints: readonly Footprint[],
): void {
  let seed = 7;
  const next = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const clear = (x: number, z: number, room: number): boolean =>
    !footprints.some((f) => Math.hypot(f.site.x - x, f.site.z - z) < f.radius + room) &&
    !RIVER.some((p) => Math.hypot(p.x - x, p.z - z) < 12) &&
    z > VALLEY_RIDGE + 6 &&
    Math.abs(x) < 300;
  // Small woods: a dozen trees standing close together.
  for (let w = 0; w < 26; w++) {
    const cx = (next() - 0.5) * 560;
    const cz = VALLEY_RIDGE + 20 + next() * 330;
    const count = 5 + Math.floor(next() * 9);
    for (let i = 0; i < count; i++) {
      const x = cx + (next() - 0.5) * 22;
      const z = cz + (next() - 0.5) * 16;
      if (!clear(x, z, 10)) continue;
      const y = valleyHeight(x, z);
      if (next() < 0.4) parts.object().cone(x, z, 1.2, 6, 7, palette.cypress, SURFACE.plain, y);
      else parts.object().dome(x, z, 2.3, 2.5, y + 1, 7, palette.olive, 3, SURFACE.plain);
    }
  }
  // Farmsteads: a house, a barn and a haystack, here and there on the open plain.
  for (let f = 0; f < 18; f++) {
    const x = (next() - 0.5) * 520;
    const z = VALLEY_RIDGE + 30 + next() * 300;
    if (!clear(x, z, 18)) continue;
    const angle = next() * Math.PI;
    const wall = palette.plaster[f % palette.plaster.length] ?? palette.wallStone;
    parts.object().box(x, z, 4, 3, 3, wall, { angle, sides: SURFACE.facade });
    parts.gableRoof(x, z, 4, 3, 1.4, 3, palette.roof, { angle });
    parts
      .object()
      .box(x + 5, z + 2, 3.4, 2.6, 2.4, palette.wallStone, { angle, sides: SURFACE.wood });
    parts.gableRoof(x + 5, z + 2, 3.4, 2.6, 1.1, 2.4, palette.roof, { angle });
    parts.object().cone(x - 4, z + 3, 1.3, 2.4, 8, palette.straw, SURFACE.plain);
  }
  // A few lone trees, as painters scatter them along field edges.
  for (let i = 0; i < 120; i++) {
    const x = (next() - 0.5) * 540;
    const z = VALLEY_RIDGE + 10 + next() * 360;
    if (!clear(x, z, 10)) continue;
    const y = valleyHeight(x, z);
    if (next() < 0.35) parts.object().cone(x, z, 1.1, 5.2, 7, palette.cypress, SURFACE.plain, y);
    else parts.object().dome(x, z, 2, 2.2, y + 1, 7, palette.olive, 3, SURFACE.plain);
  }
}

/**
 * Where a stone bridge carries each road over the river: the road's point
 * nearest the river, if the road comes within reach of it and the bridge
 * would stand clear of every town's walls.
 */
export function bridgeSites(
  roads: readonly Point[][],
  footprints: readonly Footprint[],
): { at: Point; angle: number }[] {
  const sites: { at: Point; angle: number }[] = [];
  for (const road of roads) {
    let best = { distance: Number.POSITIVE_INFINITY, at: 0 };
    road.forEach((p, i) => {
      for (const r of RIVER) {
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < best.distance) best = { distance: d, at: i };
      }
    });
    if (best.distance > 16) continue;
    const a = road[Math.max(0, best.at - 1)] as Point;
    const b = road[Math.min(road.length - 1, best.at + 1)] as Point;
    const mid = road[best.at] as Point;
    const inTown = footprints.some(
      (f) => Math.hypot(f.site.x - mid.x, f.site.z - mid.z) < f.radius + BRIDGE_HALF_LENGTH + 2,
    );
    if (!inTown) sites.push({ at: mid, angle: Math.atan2(b.z - a.z, b.x - a.x) });
  }
  return sites;
}

const BRIDGE_HALF_LENGTH = 10;

/** A stone bridge wherever a road crosses the river: a deck and two arches beneath it. */
function buildBridges(
  parts: PartsBuilder,
  roads: readonly Point[][],
  palette: ScenePalette,
  footprints: readonly Footprint[],
): void {
  for (const { at: mid, angle } of bridgeSites(roads, footprints)) {
    parts.object().box(mid.x, mid.z, BRIDGE_HALF_LENGTH * 2, 4.4, 1.2, palette.wallStone, {
      base: 2.2,
      angle: -angle,
      sides: SURFACE.stone,
    });
    for (const offset of [-4.5, 4.5]) {
      const x = mid.x + Math.cos(angle) * offset;
      const z = mid.z + Math.sin(angle) * offset;
      parts.box(x, z, 2, 4.4, 2.2, palette.wallStone, { angle: -angle, sides: SURFACE.stone });
    }
    for (const side of [-2.4, 2.4]) {
      parts.battlements(
        mid.x - Math.cos(angle) * 9 - Math.sin(angle) * side,
        mid.z - Math.sin(angle) * 9 + Math.cos(angle) * side,
        mid.x + Math.cos(angle) * 9 - Math.sin(angle) * side,
        mid.z + Math.sin(angle) * 9 + Math.cos(angle) * side,
        3.4,
        palette.wallStone,
        0.6,
        false,
      );
    }
  }
}

// ---- the valley floor ---------------------------------------------------------------------

interface ValleyGround {
  mesh: Mesh;
  setRoads(roads: Point[][], cities: { site: Point; radius: number }[]): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
}

const ROAD_SLOTS = 64;

function createValleyGround(frescoUniforms: FrescoUniforms, palette: ScenePalette): ValleyGround {
  // From the ridge at the back, where the land ends, to well behind the viewer.
  const north = VALLEY_RIDGE - RIDGE_DEPTH;
  const geometry = new PlaneGeometry(860, 640, 320, 240);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, north + 320);
  const position = geometry.attributes.position;
  if (position) {
    for (let i = 0; i < position.count; i++)
      position.setY(i, valleyHeight(position.getX(i), position.getZ(i)));
  }
  geometry.computeVertexNormals();
  const uniforms: Record<string, IUniform> = {
    uRoadsV: { value: Array.from({ length: ROAD_SLOTS }, () => new Vector2(9999, 9999)) },
    uRiver: { value: RIVER.map((p) => new Vector2(p.x, p.z)) },
    uCities: { value: Array.from({ length: 6 }, () => new Vector2(9999, 9999)) },
    uCityRadius: { value: new Array<number>(6).fill(0) },
    uMeadowV: { value: new Color() },
    uGroundV: { value: new Color() },
    uRoadV: { value: new Color() },
    uWaterV: { value: new Color() },
    uHillsV: { value: new Color() },
    uHillsShadeV: { value: new Color() },
    uHillsFarV: { value: new Color() },
    uOliveV: { value: new Color() },
    uCypressV: { value: new Color() },
  };
  const material = new MeshLambertMaterial({ color: '#ffffff' });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, frescoUniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${VALLEY_HEAD}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  vec3 cfAlbedo = cfValley();\n  diffuseColor.rgb = cfAlbedo;',
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\noutgoingLight = cfShadeV(cfAlbedo, outgoingLight) + cfGlowV(cfAlbedo);',
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  gInfo = vec4(normalize(normal) * 0.5 + 0.5, 2.0 + cfValleyId);',
      );
  };
  material.customProgramCacheKey = () => 'cf-valley';
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  const ground: ValleyGround = {
    mesh,
    setRoads(roads, cities) {
      const flat = roads.flatMap((road, r) => (r === 0 ? road : [{ x: 9999, z: 9999 }, ...road]));
      (uniforms.uRoadsV?.value as Vector2[]).forEach((slot, i) => {
        const p = flat[i];
        if (p) slot.set(p.x, p.z);
        else slot.set(9999, 9999);
      });
      (uniforms.uCities?.value as Vector2[]).forEach((slot, i) => {
        const city = cities[i];
        if (city) slot.set(city.site.x, city.site.z);
        else slot.set(9999, 9999);
        (uniforms.uCityRadius?.value as number[])[i] = city?.radius ?? 0;
      });
    },
    setPalette(next) {
      // By night the land keeps its daytime pigments and the moonlight does the darkening, so
      // the fields keep their hues and the roads still read.
      const land = next.appearance === 'dark' ? paletteFor('light') : next;
      (uniforms.uMeadowV?.value as Color).copy(land.meadow);
      (uniforms.uGroundV?.value as Color).copy(land.ground);
      (uniforms.uRoadV?.value as Color).copy(land.road);
      (uniforms.uWaterV?.value as Color).copy(next.water);
      (uniforms.uHillsV?.value as Color).copy(land.hills);
      (uniforms.uHillsShadeV?.value as Color).copy(land.hillsShade);
      (uniforms.uHillsFarV?.value as Color).copy(next.hillsFar);
      (uniforms.uOliveV?.value as Color).copy(land.olive);
      (uniforms.uCypressV?.value as Color).copy(land.cypress);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
  ground.setPalette(palette);
  return ground;
}

const VALLEY_HEAD = /* glsl */ `
varying vec3 vWorld;
uniform float uTime;
uniform float uCandle;
uniform vec3 uCandleColor;
uniform vec3 uShadowTint;
uniform vec3 uNightTint;
uniform vec3 uHighlight;
uniform vec4 uTorches[${MAX_TORCHES}];
uniform int uTorchCount;
uniform vec2 uRoadsV[${ROAD_SLOTS}];
uniform vec2 uRiver[24];
uniform vec2 uCities[6];
uniform float uCityRadius[6];
uniform vec3 uMeadowV;
uniform vec3 uGroundV;
uniform vec3 uRoadV;
uniform vec3 uWaterV;
uniform vec3 uHillsV;
uniform vec3 uHillsShadeV;
uniform vec3 uHillsFarV;
uniform vec3 uOliveV;
uniform vec3 uCypressV;
layout(location = 1) out highp vec4 gInfo;
${NOISE}
${LUMA}
${PAINTED_LIGHT}
${HILL_PAINT}
float cfValleyId;

float segmentV(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 cfValley() {
  vec2 p = vWorld.xz;
  float mottle = cfFbm(p * 0.03) - 0.5;
  // The meadows are never one green: olive, a dry ochre and a cooler green drift across them.
  float drift = cfFbm(p * 0.012 + 3.0);
  vec3 colour = mix(uMeadowV, uGroundV, smoothstep(0.5, 0.78, drift) * 0.7);
  colour = mix(colour, uMeadowV * vec3(0.82, 0.95, 1.0), smoothstep(0.55, 0.3, drift) * 0.4) * (1.0 + mottle * 0.22);
  cfValleyId = 0.11;
  // Farmland: an irregular patchwork across the whole floor, dense by each town's walls and
  // thinning out field by field into the meadows, as the old painters filled a countryside.
  vec2 cell = cfVoronoiEdge(p / 7.0 + vec2(cfFbm(p * 0.02), cfFbm(p * 0.02 + 4.0)) * 1.4);
  // Each plot brushed in its own direction, its border softened into the meadow.
  float heading = cell.y * 6.2831853;
  vec2 dir = vec2(cos(heading), sin(heading));
  float brushed = 1.0 + (cfNoise(vec2(dot(p, dir) * 0.3, dot(p, vec2(-dir.y, dir.x)) * 2.4) + cell.y * 40.0) - 0.5) * 0.2;
  float border = smoothstep(0.22, 0.0, cell.x);
  float everywhere = 0.32 * smoothstep(0.35, 0.6, cfFbm(p * 0.008 + 11.0));
  if (cell.y < everywhere) {
    float kind = fract(cell.y * 13.7);
    vec3 crop = kind < 0.45 ? vec3(0.5, 0.32, 0.08) : kind < 0.8 ? vec3(0.17, 0.25, 0.05) : vec3(0.3, 0.18, 0.08);
    crop = mix(crop, uMeadowV, 0.35) * (0.94 + fract(cell.y * 7.1) * 0.12) * brushed;
    colour = mix(crop, mix(crop, colour, 0.6), border);
  }
  for (int i = 0; i < 6; i++) {
    if (uCityRadius[i] <= 0.0) continue;
    float d = length(p - uCities[i]);
    if (d < uCityRadius[i] * 0.95) {
      colour = mix(uRoadV, uGroundV, 0.4);
      cfValleyId = 0.23;
      continue;
    }
    float density = 1.0 - smoothstep(uCityRadius[i] * 1.1, uCityRadius[i] * 2.8 + 12.0, d);
    if (cell.y < density * 0.95) {
      // Linear values: ripe wheat, young green, fallow earth, each softened toward the meadow.
      float kind = fract(cell.y * 13.7);
      vec3 crop = kind < 0.45 ? vec3(0.56, 0.34, 0.08) : kind < 0.85 ? vec3(0.17, 0.25, 0.05) : vec3(0.3, 0.18, 0.08);
      crop = mix(crop, uMeadowV, 0.25) * (0.94 + fract(cell.y * 7.1) * 0.12) * brushed;
      colour = mix(crop, mix(crop, uMeadowV * 0.85, 0.6), border);
    }
  }
  float onHill = smoothstep(0.3, 3.0, vWorld.y);
  if (onHill > 0.0) {
    float far = clamp((${VALLEY_RIDGE.toFixed(1)} - p.y) / ${RIDGE_DEPTH.toFixed(1)}, 0.0, 1.0);
    vec3 hill = cfHillPaint(vWorld, far, uHillsV, uHillsShadeV, uHillsFarV, uMeadowV, uGroundV, uOliveV, uCypressV);
    colour = mix(colour, hill, onHill);
    if (onHill > 0.5) cfValleyId = 0.47;
  }
  float road = 1e4;
  for (int i = 0; i < ${ROAD_SLOTS - 1}; i++) {
    vec2 a = uRoadsV[i];
    vec2 b = uRoadsV[i + 1];
    if (a.x > 9000.0 || b.x > 9000.0) continue;
    road = min(road, segmentV(p, a, b));
  }
  colour = mix(colour, uRoadV, smoothstep(2.2, 1.4, road));
  float river = 1e4;
  for (int i = 0; i < 23; i++) river = min(river, segmentV(p, uRiver[i], uRiver[i + 1]));
  float width = 5.5;
  colour = mix(colour, uMeadowV * 0.65, smoothstep(width + 3.0, width + 1.0, river) * 0.6);
  float ripple = smoothstep(0.85, 1.0, sin(p.y * 0.6 - uTime * 1.2 + cfNoise(p * 0.2) * 4.0)) * 0.5;
  vec3 wet = mix(uWaterV, uHighlight, ripple * 0.3);
  colour = mix(colour, wet, smoothstep(width, width - 1.2, river));
  if (river < width - 0.6) cfValleyId = 0.07;
  return colour;
}

vec3 cfShadeV(vec3 albedo, vec3 lit) {
  return cfPaintedLight(albedo, lit, uShadowTint, uHighlight, uCandle, uNightTint);
}

// By night every town is a warm island: lamplight spills over its walls onto the fields around.
vec3 cfGlowV(vec3 albedo) {
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${MAX_TORCHES}; i++) {
    if (i >= uTorchCount) break;
    vec3 d = vWorld - uTorches[i].xyz;
    glow += uCandleColor * uTorches[i].w / (1.0 + dot(d, d) * 0.06);
  }
  for (int i = 0; i < 6; i++) {
    if (uCityRadius[i] <= 0.0) continue;
    float reach = length(vWorld.xz - uCities[i]) / (uCityRadius[i] * 1.9);
    glow += uCandleColor * exp(-reach * reach) * 0.32;
  }
  return albedo * glow * uCandle;
}
`;
