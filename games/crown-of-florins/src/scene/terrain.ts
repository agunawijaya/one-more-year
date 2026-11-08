/**
 * The land around the city: a plain of fields inside the realm's bounds,
 * meadows beyond, the stream, the roads, and rows of rounded hills to the
 * north, as the old painters drew the Tuscan countryside: green cushions
 * patched with small fields, dotted with olive groves and cypresses, the
 * far ones fading into blue-grey air.
 *
 * The ground is one mesh painted by one shader. Fields are strips in rings
 * around the walls; each strip is worked or fallow in proportion to the
 * hectares under the plough, and every field takes the colour of the year's
 * weather, from lush green to cracked ochre. Roads and the stream are
 * distances to polylines, passed in as uniforms, so nothing is drawn twice.
 */
import {
  Color,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Vector2,
  Vector3,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { LUMA, NOISE, PAINTED_LIGHT } from './glsl.ts';
import { HILL_PAINT, hillRange, layHills, type HillRange } from './hills.ts';
import type { CityPlan, Point } from './layout.ts';
import type { ScenePalette } from './palette.ts';
import { MAX_TORCHES, type FrescoUniforms } from './materials.ts';

const ROAD_POINTS = 32;
const STREAM_POINTS = 29;
const WALL_POINTS = 12;

/** Where the hills behind the city begin to rise, for a city of this wall radius. */
export function ridgeStartFor(wallRadius: number): number {
  return -(wallRadius + 16);
}

/** How far the hills climb before the land ends; beyond them there is only painted sky. */
export const RIDGE_DEPTH = 46;

/**
 * The town's own hills: a few low ones just past the fields, a row behind
 * them, and a high row at the back whose crests make the skyline. Each town
 * draws its hills from its name, so no two cities share a horizon. The back
 * row stands wholly in front of the land's end, so its crests, not the edge
 * of the land, meet the sky.
 */
export function cityHills(town: string, ridgeStart: number): HillRange {
  const end = ridgeStart - RIDGE_DEPTH;
  const hills = layHills(
    town,
    [
      { z: end + 15, depth: [12, 15], height: [21, 32], width: [64, 112], spacing: [0.5, 0.72] },
      { z: end + 31, depth: [9, 13], height: [11, 19], width: [50, 92], spacing: [0.62, 1.0] },
      { z: ridgeStart - 3, depth: [7, 11], height: [5, 10], width: [34, 60], spacing: [1.2, 2.0] },
    ],
    [-520, 520],
  );
  return hillRange(hills, (_x, z) => smootherstep(0, 1, (ridgeStart - z) / RIDGE_DEPTH) * 8);
}

function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export interface GroundUniforms {
  uWall: IUniform<Vector2[]>;
  uWallCount: IUniform<number>;
  uWallRadius: IUniform<number>;
  uFieldsRadius: IUniform<number>;
  uRoads: IUniform<Vector2[]>;
  uStream: IUniform<Vector2[]>;
  uWorked: IUniform<number>;
  uWeather: IUniform<number>;
  /** Harvest progress across the fields, 0 standing crop to 1 cut stubble. */
  uHarvest: IUniform<number>;
  uYard: IUniform<Vector3>;
  uGround: IUniform<Color>;
  uMeadow: IUniform<Color>;
  uRoad: IUniform<Color>;
  uWater: IUniform<Color>;
  uHills: IUniform<Color>;
  uHillsShade: IUniform<Color>;
  uHillsFar: IUniform<Color>;
  uOlive: IUniform<Color>;
  uCypress: IUniform<Color>;
  /** Where the hills begin to rise and where the land ends (z, north negative). */
  uRidge: IUniform<Vector2>;
  uRain: IUniform<number>;
}

export interface Ground {
  mesh: Mesh;
  uniforms: GroundUniforms;
  /** The land's height under a point, hills included, for whatever stands on it. */
  heightAt(x: number, z: number): number;
  setPlan(plan: CityPlan, town: string): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
}

export function createGround(frescoUniforms: FrescoUniforms, palette: ScenePalette): Ground {
  const width = 1000;
  const depth = 900;
  const geometry = new PlaneGeometry(width, depth, 300, 270);
  geometry.rotateX(-Math.PI / 2);
  let shapedFor = '';
  let hills = cityHills('', ridgeStartFor(45));

  /** Lays the land out for a city of this size and name: the plain, its hills, the land's end. */
  function shape(ridgeStart: number, town: string): void {
    const key = `${town}:${ridgeStart.toFixed(2)}`;
    if (key === shapedFor) return;
    hills = cityHills(town, ridgeStart);
    const north = ridgeStart - RIDGE_DEPTH;
    const position = geometry.attributes.position;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      const u = i % 301;
      const v = Math.floor(i / 301);
      const x = -width / 2 + (u / 300) * width;
      const z = north + (v / 270) * depth;
      position.setXYZ(i, x, hills.heightAt(x, z), z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    shapedFor = key;
    uniforms.uRidge.value.set(ridgeStart, north);
  }

  const uniforms: GroundUniforms = {
    uWall: { value: Array.from({ length: WALL_POINTS }, () => new Vector2()) },
    uWallCount: { value: 0 },
    uWallRadius: { value: 40 },
    uFieldsRadius: { value: 80 },
    uRoads: { value: Array.from({ length: ROAD_POINTS }, () => new Vector2(9999, 9999)) },
    uStream: { value: Array.from({ length: STREAM_POINTS }, () => new Vector2(9999, 9999)) },
    uWorked: { value: 1 },
    uWeather: { value: 3 },
    uHarvest: { value: 0 },
    uYard: { value: new Vector3(0, 0, 0) },
    uGround: { value: new Color() },
    uMeadow: { value: new Color() },
    uRoad: { value: new Color() },
    uWater: { value: new Color() },
    uHills: { value: new Color() },
    uHillsShade: { value: new Color() },
    uHillsFar: { value: new Color() },
    uOlive: { value: new Color() },
    uCypress: { value: new Color() },
    uRidge: { value: new Vector2(-61, -107) },
    uRain: { value: 0 },
  };
  shape(ridgeStartFor(45), '');

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
      .replace('#include <common>', `#include <common>\n${GROUND_HEAD}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  vec3 cfAlbedo = cfGround();\n  diffuseColor.rgb = cfAlbedo;',
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        [
          'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
          'outgoingLight = cfShade(cfAlbedo, outgoingLight) + cfNightLights(cfAlbedo) + cfWaterGlint;',
          'outgoingLight *= 1.0 + uSweep.w * smoothstep(uSweep.x - 40.0, uSweep.x, vWorld.x) * smoothstep(uSweep.x + 60.0, uSweep.x, vWorld.x) * 0.35;',
        ].join('\n'),
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  gInfo = vec4(normalize(normal) * 0.5 + 0.5, 2.0 + cfGroundId);',
      );
  };
  material.customProgramCacheKey = () => 'cf-ground';

  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'ground';

  const ground: Ground = {
    mesh,
    uniforms,
    heightAt: (x, z) => hills.heightAt(x, z),
    setPlan(plan, town) {
      shape(ridgeStartFor(plan.wallRadius), town);
      plan.wall.slice(0, WALL_POINTS).forEach((p, i) => uniforms.uWall.value[i]?.set(p.x, p.z));
      uniforms.uWallCount.value = Math.min(WALL_POINTS, plan.wall.length);
      uniforms.uWallRadius.value = plan.wallRadius;
      uniforms.uFieldsRadius.value = plan.fieldsRadius;
      fill(
        uniforms.uRoads.value,
        plan.roads.flatMap((road, r) => (r === 0 ? road : [{ x: 9999, z: 9999 }, ...road])),
      );
      fill(uniforms.uStream.value, plan.stream);
      uniforms.uWorked.value = plan.workedShare;
      uniforms.uWeather.value = plan.weather;
      uniforms.uYard.value.set(plan.yard.x, plan.yard.z, plan.yard.soldiers > 0 ? 1 : 0);
    },
    setPalette(next) {
      uniforms.uGround.value.copy(next.ground);
      uniforms.uMeadow.value.copy(next.meadow);
      uniforms.uRoad.value.copy(next.road);
      uniforms.uWater.value.copy(next.water);
      uniforms.uHills.value.copy(next.hills);
      uniforms.uHillsShade.value.copy(next.hillsShade);
      uniforms.uHillsFar.value.copy(next.hillsFar);
      uniforms.uOlive.value.copy(next.olive);
      uniforms.uCypress.value.copy(next.cypress);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
  ground.setPalette(palette);
  return ground;
}

/** Copies points into a fixed uniform array; a far-away point breaks a polyline into separate roads. */
function fill(target: Vector2[], points: readonly Point[]): void {
  target.forEach((slot, i) => {
    const p = points[i];
    if (p) slot.set(p.x, p.z);
    else slot.set(9999, 9999);
  });
}

const GROUND_HEAD = /* glsl */ `
varying vec3 vWorld;
uniform float uTime;
uniform float uCandle;
uniform vec3 uCandleColor;
uniform vec3 uShadowTint;
uniform vec3 uNightTint;
uniform vec3 uHighlight;
uniform vec4 uTorches[${MAX_TORCHES}];
uniform int uTorchCount;
uniform vec4 uSweep;
uniform vec2 uWall[${WALL_POINTS}];
uniform int uWallCount;
uniform float uWallRadius;
uniform float uFieldsRadius;
uniform vec2 uRoads[${ROAD_POINTS}];
uniform vec2 uStream[${STREAM_POINTS}];
uniform float uWorked;
uniform float uWeather;
uniform float uHarvest;
uniform vec3 uYard;
uniform vec3 uGround;
uniform vec3 uMeadow;
uniform vec3 uRoad;
uniform vec3 uWater;
uniform vec3 uHills;
uniform vec3 uHillsShade;
uniform vec3 uHillsFar;
uniform vec3 uOlive;
uniform vec3 uCypress;
uniform vec2 uRidge;
uniform float uRain;
layout(location = 1) out highp vec4 gInfo;
${NOISE}
${LUMA}
${PAINTED_LIGHT}
${HILL_PAINT}

float cfGroundId;
vec3 cfWaterGlint;

float cfSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float cfRoadDistance(vec2 p) {
  float best = 1e4;
  for (int i = 0; i < ${ROAD_POINTS - 1}; i++) {
    vec2 a = uRoads[i];
    vec2 b = uRoads[i + 1];
    if (a.x > 9000.0 || b.x > 9000.0) continue;
    best = min(best, cfSegment(p, a, b));
  }
  return best;
}

float cfStreamDistance(vec2 p) {
  float best = 1e4;
  for (int i = 0; i < ${STREAM_POINTS - 1}; i++) {
    best = min(best, cfSegment(p, uStream[i], uStream[i + 1]));
  }
  return best;
}

bool cfInsideWall(vec2 p) {
  bool inside = false;
  for (int i = 0; i < ${WALL_POINTS}; i++) {
    if (i >= uWallCount) break;
    int j = i == 0 ? uWallCount - 1 : i - 1;
    vec2 a = uWall[i];
    vec2 b = uWall[j];
    if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// The colour of a crop in the year's weather: 1 drought … 5 excellent. (Linear values.)
vec3 cfCrop(float weather, float kind) {
  vec3 lush = vec3(0.159, 0.254, 0.045);
  vec3 ripe = vec3(0.637, 0.356, 0.069);
  vec3 parched = vec3(0.527, 0.254, 0.084);
  vec3 young = vec3(0.275, 0.323, 0.065);
  float w = (weather - 1.0) / 4.0;
  vec3 crop = kind < 0.5 ? mix(parched, ripe, smoothstep(0.0, 0.6, w)) : mix(parched * 0.95, mix(young, lush, w), smoothstep(0.0, 0.5, w));
  return mix(crop, uMeadow * 1.1, 0.25);
}

vec3 cfGround() {
  vec2 p = vWorld.xz;
  float r = length(p * vec2(1.0, 1.08));
  float mottle = cfFbm(p * 0.05) - 0.5;
  vec3 colour = mix(uMeadow, uGround, smoothstep(0.55, 0.78, cfFbm(p * 0.018 + 4.0)) * 0.8) * (1.0 + mottle * 0.18);
  cfGroundId = 0.11;
  cfWaterGlint = vec3(0.0);

  bool inside = cfInsideWall(p);
  if (inside) {
    // Inside the walls: packed earth and stone, lighter toward the piazza.
    colour = mix(uRoad, uGround, 0.35) * (1.0 + (cfNoise(p * 1.4) - 0.5) * 0.12 + mottle * 0.1);
    cfGroundId = 0.23;
    vec2 yard = p - uYard.xy;
    if (uYard.z > 0.5 && abs(yard.x) < 6.0 && abs(yard.y) < 4.5) colour = mix(uRoad, vec3(0.672, 0.552, 0.323), 0.5);
  } else if (r < uFieldsRadius + (cfNoise(p * 0.025) - 0.5) * 34.0 + (cfNoise(p * 0.09) - 0.5) * 8.0 && r > uWallRadius * 0.82) {
    // Fields: an irregular patchwork of plots, each with its own crop and its own furrows; their
    // borders wander, as a painter lays plots by eye, not by rule.
    vec2 warp = vec2(cfFbm(p * 0.011), cfFbm(p * 0.011 + 5.0)) * 1.5;
    vec2 cell = cfVoronoiEdge(p / 17.0 + warp);
    float id = cell.y;
    float worked = step(id, uWorked);
    // Each plot is ploughed in its own direction.
    float heading = id * 6.2831853;
    vec2 dir = vec2(cos(heading), sin(heading));
    float along = dot(p, dir) * 1.9 + cfNoise(p * 0.25) * 0.5;
    float furrow = smoothstep(0.3, 0.5, abs(fract(along) - 0.5));
    float kind = step(0.5, fract(id * 7.13));
    vec3 crop = cfCrop(uWeather, kind);
    // Vines: dotted rows on a few plots.
    float vines = step(0.86, fract(id * 3.71)) * worked;
    crop = mix(crop, mix(uMeadow * 0.55, crop, smoothstep(0.25, 0.45, abs(fract(along * 0.5) - 0.5))), vines);
    float cut = step(fract(id * 5.37), uHarvest);
    crop = mix(crop, vec3(0.686, 0.527, 0.254), cut * 0.8);
    vec3 fallow = mix(uGround, vec3(0.323, 0.181, 0.081), 0.45) * (1.0 + (fract(id * 11.1) - 0.5) * 0.12);
    colour = mix(fallow, crop, worked) * (1.0 - furrow * 0.12 * (worked + 0.25));
    // Brushed along the furrows, and soft at the border where the next plot's colour meets it.
    vec2 across = vec2(-dir.y, dir.x);
    colour *= 1.0 + (cfNoise(vec2(dot(p, dir) * 0.12, dot(p, across) * 1.4) + id * 40.0) - 0.5) * 0.18;
    colour = mix(colour, mix(colour, uMeadow, 0.5), smoothstep(0.2, 0.0, cell.x) * 0.55);
    // A drought cracks the soil.
    if (uWeather < 1.5) {
      vec2 cracks = cfVoronoiEdge(p * 0.9);
      colour *= 1.0 - smoothstep(0.06, 0.0, cracks.x) * 0.3 * worked;
    }
    // Here and there a hedge between plots, broken where a gate or a path goes through.
    float hedge = smoothstep(0.035, 0.01, cell.x) * smoothstep(0.35, 0.55, cfNoise(p * 0.12));
    colour = mix(colour, mix(uMeadow * 0.7, uGround, 0.3), hedge * 0.6);
    // One id for all the fields: their boundaries are painted as hedges, not inked as contours.
    cfGroundId = 0.31;
  }

  // Hills: green cushions patched with fields and groves, fading into the air toward the back.
  float onHill = smoothstep(0.3, 3.0, vWorld.y);
  if (onHill > 0.0) {
    float far = clamp((uRidge.x - p.y) / max(uRidge.x - uRidge.y, 1.0), 0.0, 1.0);
    vec3 hill = cfHillPaint(vWorld, far, uHills, uHillsShade, uHillsFar, uMeadow, uGround, uOlive, uCypress);
    colour = mix(colour, hill, onHill);
    if (onHill > 0.5) cfGroundId = 0.47;
  }

  // Roads: pale, with two cart ruts.
  float road = cfRoadDistance(p);
  float roadWidth = 1.8;
  if (road < roadWidth) {
    colour = mix(colour, uRoad * (1.0 + mottle * 0.1), smoothstep(roadWidth, roadWidth - 0.6, road));
    colour *= 1.0 - smoothstep(0.25, 0.0, abs(road - 0.75)) * 0.12;
  }

  // The stream, with painted ripples and darker banks.
  float stream = cfStreamDistance(p);
  if (stream < 4.0) {
    float bank = smoothstep(4.0, 3.0, stream);
    colour = mix(colour, uMeadow * 0.7, bank * 0.6);
    float water = smoothstep(2.8, 2.2, stream);
    float ripple = smoothstep(0.82, 1.0, sin(p.y * 1.1 - uTime * 1.6 + cfNoise(p * 0.4) * 4.0)) * 0.6;
    vec3 wet = mix(uWater, uHighlight, ripple * 0.35);
    colour = mix(colour, wet, water);
    cfWaterGlint = uCandleColor * ripple * water * uCandle * 0.15;
    if (water > 0.5) cfGroundId = 0.07;
  }
  return colour;
}

vec3 cfShade(vec3 albedo, vec3 lit) {
  return cfPaintedLight(albedo, lit, uShadowTint, uHighlight, uCandle, uNightTint);
}

vec3 cfNightLights(vec3 albedo) {
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${MAX_TORCHES}; i++) {
    if (i >= uTorchCount) break;
    vec4 torch = uTorches[i];
    vec3 d = vWorld - torch.xyz;
    glow += uCandleColor * torch.w / (1.0 + dot(d, d) * 0.07);
  }
  return albedo * glow * uCandle;
}
`;
