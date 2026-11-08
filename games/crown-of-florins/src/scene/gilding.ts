/**
 * The coronation's gold: leaf by leaf, gilding spreads across the fresco
 * from the crown on the palace outward. It is metal laid over paint, not a
 * colour grade:
 *
 * - only the architecture is gilded (walls, towers, roofs, the cathedral,
 *   the crown, the banners' edges) and the painted frame; the people, the
 *   trees, the awnings and the banners' cloth keep their vermilion and
 *   lapis beside the gold, and the fields, the river and the sky stay
 *   painted, a little warmer in the gold's light;
 * - the front advances from the crown as a ragged circle, its edge showing
 *   the red bole that gilders lay under gold;
 * - the leaf is laid in square sheets, each a little askew, overlapping its
 *   neighbours at faint seams, each catching the light a little
 *   differently; a fine crackle sits within the sheets, the bole showing in
 *   its cracks;
 * - the metal answers the view: it reflects a painted sky above and the
 *   earth below (bright where a face turns to the sky, deep amber where it
 *   turns away), burnished leaf throws an anisotropic sheen, a slow glint
 *   travels across the gilding and single sheets flash; recesses and the
 *   painter's lines stay deep amber-brown;
 * - by night the gold is lit by the torches the painting already holds:
 *   warm where the lamps are, deep in the shadows.
 *
 * Drawn over the finished painting: it reads the fresco's composite, and
 * its info target for each pixel's class and surface normal. Under reduced
 * motion the gold appears in one fade (progress jumps, no glint).
 */
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  type IUniform,
  type WebGLRenderer,
} from 'three';
import { NOISE } from './glsl.ts';
import type { FrescoPass } from './fresco.ts';
import type { Overlay } from './view.ts';

const FRAGMENT = /* glsl */ `
uniform sampler2D tPainting;
uniform sampler2D tInfo;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform float uProgress;
uniform float uTime;
uniform float uGlint;
uniform float uNight;
uniform float uFrame;
varying vec2 vUv;
${NOISE}

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Gold's own colour as metal reflects it (linear): the deep amber of its recesses, its body, its
// lights and the pale burnish of a highlight.
const vec3 GOLD = vec3(1.0, 0.68, 0.22);
const vec3 AMBER = vec3(0.04, 0.014, 0.003);
const vec3 BODY = vec3(0.3, 0.135, 0.016);
const vec3 BRIGHT = vec3(0.8, 0.49, 0.06);
const vec3 PALE = vec3(1.0, 0.86, 0.48);
// Where the light comes from, in the camera's space: high on the left, in front of the wall.
const vec3 KEY = vec3(-0.62, 0.55, 0.56);
const vec3 BOLE = vec3(0.42, 0.09, 0.04);

// How much of the bright sky a face of metal mirrors: the tops of things see the sky, the walls
// see the horizon, what faces down sees the earth.
float skyward(vec3 r) {
  return smoothstep(-0.25, 0.9, r.y);
}

// One sheet of leaf: which sheet a pixel lies on and where within it, the grid jittered so sheets
// sit a little askew and overlap their neighbours.
vec4 sheetAt(vec2 px, float size) {
  vec2 warp = (vec2(cfNoise(px * 0.012), cfNoise(px * 0.012 + 7.0)) - 0.5) * size * 0.28;
  vec2 q = (px + warp) / size;
  vec2 cell = floor(q);
  vec2 local = fract(q);
  return vec4(cell, local);
}

vec3 gildedLeaf(vec2 px, vec3 painting, vec3 normal) {
  float value = luma(painting);
  float size = uResolution.y / 34.0;
  vec4 sheet = sheetAt(px, size);
  vec2 cell = sheet.xy;
  vec2 local = sheet.zw;
  float tone = cfHash12(cell);
  // Each sheet lies at its own slight tilt, and was burnished in its own direction.
  vec2 tilt = (cfHash22(cell + 3.0) - 0.5) * 0.035;
  vec3 n = normalize(normal + vec3(tilt, 0.0) + vec3((cfNoise(px * 0.2) - 0.5) * 0.04));
  // Burnished across the wall's breadth, each sheet a few degrees off: enough to tell the sheets
  // apart in a raking light, never a checkerboard.
  float heading = 0.35 + (cfHash12(cell + 9.0) - 0.5) * 0.5;
  vec3 burnish = normalize(vec3(cos(heading), sin(heading), 0.0));
  burnish = normalize(burnish - n * dot(n, burnish) + 1e-4);
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-view, n);
  float fresnel = pow(1.0 - max(dot(n, view), 0.0), 5.0);
  // Leaf is smooth where the paint under it was brushed: its light comes from the painting only as
  // light or shade (cast shadows, the painter's lines), and from each face's turn toward the light,
  // so every face of a building is one sheet of metal, not a field of strokes.
  float shadeOrLight = smoothstep(mix(0.06, 0.008, uNight), mix(0.32, 0.3, uNight), value);
  float facet = clamp(0.3 + 0.85 * dot(n, normalize(KEY)), 0.12, 1.12);
  // By night there is no sun to turn toward: the torches the painting holds do the lighting.
  // Pressed toward the deep end, so the metal has a body of amber and keeps its brightness for the lights.
  float t = pow(shadeOrLight * mix(facet, 0.85, uNight), 1.5);
  vec3 colour = t < 0.45 ? mix(AMBER, BODY, t / 0.45) : t < 0.9 ? mix(BODY, BRIGHT, (t - 0.45) / 0.45) : mix(BRIGHT, PALE, (t - 0.9) / 0.4);
  // Then the metal mirrors the sky: brighter where a face turns up to it, and at a glancing angle.
  colour *= 0.82 + 0.28 * skyward(r) * (1.0 - uNight * 0.6) + 0.15 * fresnel;
  // By torchlight the gold runs warmer, toward the flame's own colour.
  colour *= mix(vec3(1.0), vec3(1.16, 0.92, 0.6), uNight);
  float lit = t;
  // The glint: a light that wanders slowly across the sky, so facets catch it one after another,
  // a broad band of light drifting across the wall, and now and then one sheet flashing.
  float a = uTime * 0.23;
  vec3 light = normalize(vec3(sin(a) * 0.9, 0.55 + 0.25 * cos(a * 0.7), 0.7));
  vec3 h = normalize(light + view);
  float th = dot(burnish, h);
  float sheen = pow(sqrt(max(0.0, 1.0 - th * th)), 80.0);
  // A light that wanders the sky strikes a few faces at a time, small and bright, never the whole city.
  float spot = pow(max(dot(n, h), 0.0), 220.0) * smoothstep(0.55, 0.8, cfNoise(px * 0.004 + uTime * 0.05));
  float band = smoothstep(0.05, 0.0, abs(fract((px.x * 0.8 + px.y * 0.5) / (uResolution.x * 1.4) - uTime * 0.06) - 0.5) - 0.012);
  float flash = smoothstep(0.985, 1.0, cfHash12(cell + floor(uTime * 0.9))) * (0.5 + 0.5 * sin(uTime * 6.0 + tone * 20.0));
  vec3 lightColour = mix(vec3(1.0, 0.95, 0.82), vec3(1.0, 0.74, 0.4), uNight);
  float catchLight = sheen * 0.2 + spot * 0.9 + band * 0.85 + flash * 0.45;
  colour += lightColour * mix(GOLD, vec3(1.0), 0.35) * catchLight * uGlint * (0.25 + lit);
  // Sheets differ a shade; a seam darkens where one sheet's edge lies over the next, with a hair of
  // light along it; the crackle sits inside the sheets, the red bole showing in its cracks.
  colour *= 0.98 + (tone - 0.5) * 0.045;
  float seam = max(smoothstep(0.96, 1.0, local.x), smoothstep(0.96, 1.0, local.y));
  float lip = max(smoothstep(0.935, 0.958, local.x) * (1.0 - smoothstep(0.958, 0.972, local.x)),
                  smoothstep(0.935, 0.958, local.y) * (1.0 - smoothstep(0.958, 0.972, local.y)));
  colour *= 1.0 - seam * 0.22;
  colour += GOLD * lip * 0.08 * lit;
  vec2 crack = cfVoronoiEdge(px / 9.0 + vec2(cfNoise(px * 0.03), cfNoise(px * 0.03 + 3.0)) * 0.6);
  float aged = smoothstep(0.45, 0.7, cfFbm(px * 0.004 + 6.0));
  colour = mix(colour, BOLE * mix(0.9, 0.4, uNight), smoothstep(0.04, 0.012, crack.x) * aged * 0.5);
  // Here and there a speck of leaf has lifted, and the bole shows.
  float lifted = step(0.996, cfHash12(floor(px / 3.0) + cell * 7.0)) * aged;
  return mix(colour, BOLE, lifted * 0.8);
}

// A bevel of light where a gilded face meets another at an edge turned toward the light.
float edgeGlint(vec2 uv, vec3 n) {
  vec2 o = 1.5 / uResolution;
  float edge = 0.0;
  edge = max(edge, 1.0 - dot(n, normalize(texture2D(tInfo, uv + vec2(o.x, 0.0)).xyz * 2.0 - 1.0)));
  edge = max(edge, 1.0 - dot(n, normalize(texture2D(tInfo, uv - vec2(o.x, 0.0)).xyz * 2.0 - 1.0)));
  edge = max(edge, 1.0 - dot(n, normalize(texture2D(tInfo, uv + vec2(0.0, o.y)).xyz * 2.0 - 1.0)));
  edge = max(edge, 1.0 - dot(n, normalize(texture2D(tInfo, uv - vec2(0.0, o.y)).xyz * 2.0 - 1.0)));
  return smoothstep(0.15, 0.5, edge) * smoothstep(0.1, 0.6, dot(n, normalize(KEY)));
}

void main() {
  vec2 px = vUv * uResolution;
  vec3 painting = toLinear(texture2D(tPainting, vUv).rgb);
  vec4 info = texture2D(tInfo, vUv);
  float kind = floor(info.w + 0.001);
  vec2 fromEdge = min(px, uResolution - px);
  bool frame = uFrame > 0.0 && min(fromEdge.x, fromEdge.y) < uFrame + 2.0;
  bool architecture = kind < 0.5 || frame;

  float reach = length(uResolution) * 1.05;
  float distance_ = length(px - uOrigin) + (cfFbm(px * 0.006) - 0.5) * 140.0 + (cfNoise(px * 0.05) - 0.5) * 24.0;
  float front = uProgress * reach;
  float gilded = smoothstep(front, front - 26.0, distance_);
  float bole = smoothstep(front + 6.0, front - 4.0, distance_) * (1.0 - gilded);
  if (gilded <= 0.0 && bole <= 0.0) { gl_FragColor = vec4(toSrgb(painting), 1.0); return; }

  vec3 colour = painting;
  if (architecture) {
    // The frame band is flat paint; give it a face turned to the viewer, the picture's normal.
    vec3 normal = frame ? vec3(0.0, 0.25, 0.97) : normalize(info.xyz * 2.0 - 1.0);
    vec3 gold = gildedLeaf(px, painting, normal);
    if (!frame) gold = mix(gold, PALE * mix(1.0, 0.8, uNight), edgeGlint(vUv, normal) * 0.4 * smoothstep(0.03, 0.15, luma(painting)));
    colour = mix(colour, BOLE, bole * 0.85);
    colour = mix(colour, gold, gilded);
  } else {
    // What keeps its colour is warmed by the gold around it, the land and the sky a little more.
    float warmth = kind > 1.5 ? 0.16 : 0.07;
    vec3 warm = colour * vec3(1.08, 0.98, 0.82) + vec3(0.02, 0.012, 0.0) * (1.0 - uNight);
    colour = mix(colour, warm, warmth * gilded * 4.0);
  }

  // The glory about the crown: a burnished disc, fine incised rays, and rings of punched dots, the
  // way gilders tooled a halo.
  vec2 fromCrown = px - uOrigin;
  float radius = length(fromCrown);
  float halo = uResolution.y * 0.11;
  if (radius < halo * 1.02 && gilded > 0.0) {
    float angle = atan(fromCrown.y, fromCrown.x);
    float disc = smoothstep(halo, halo * 0.97, radius);
    // The glory is leaf laid flat on the wall, facing the viewer; over the tower and the crown it
    // thins, so they still stand inside it.
    vec3 leaf = gildedLeaf(px, vec3(mix(0.42, 0.16, uNight)), vec3(0.0, 0.2, 0.98));
    float overBuilding = architecture ? 0.35 : 0.85;
    colour = mix(colour, leaf, disc * smoothstep(halo * 0.2, halo * 0.45, radius) * gilded * overBuilding);
    float rayLine = smoothstep(0.035, 0.0, abs(fract(angle / 6.2831853 * 64.0) - 0.5) - 0.46);
    float rayZone = smoothstep(halo * 0.3, halo * 0.36, radius) * smoothstep(halo * 0.86, halo * 0.8, radius);
    colour = mix(colour, AMBER * 2.0, rayLine * rayZone * 0.35 * gilded);
    for (int k = 0; k < 2; k++) {
      float r = halo * (k == 0 ? 0.92 : 0.86);
      float count = floor(r * 6.2831853 / 9.0);
      float a = floor(angle / 6.2831853 * count + 0.5) / count * 6.2831853;
      float d = length(fromCrown - vec2(cos(a), sin(a)) * r);
      colour = mix(colour, AMBER * 1.6, smoothstep(2.6, 1.4, d) * 0.8 * gilded);
      colour += GOLD * smoothstep(2.0, 0.5, length(fromCrown - vec2(cos(a), sin(a)) * r + vec2(0.8, -0.8))) * 0.3 * gilded;
    }
    colour = mix(colour, AMBER, smoothstep(2.4, 0.0, abs(radius - halo)) * 0.85 * gilded);
  }
  gl_FragColor = vec4(toSrgb(colour), 1.0);
}
`;

export interface Gilding extends Overlay {
  /** 0 bare painting → 1 every leaf laid. */
  setProgress(progress: number): void;
  /** Where the gold begins, 0–1 across and down the canvas. */
  setOrigin(x: number, y: number): void;
  setGlint(on: boolean): void;
  setNight(night: number): void;
  /** Holds the glint at one moment (for a still picture), or lets it travel again with null. */
  holdGlint(seconds: number | null): void;
  dispose(): void;
}

export function createGilding(): Gilding {
  const uniforms: Record<string, IUniform> = {
    tPainting: { value: null },
    tInfo: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uOrigin: { value: new Vector2(0, 0) },
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uGlint: { value: 1 },
    uNight: { value: 0 },
    uFrame: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let origin = { x: 0.5, y: 0.3 };
  let held: number | null = null;
  const resolution = (): Vector2 => uniforms.uResolution?.value as Vector2;

  return {
    render(renderer: WebGLRenderer, painting: FrescoPass, time: number) {
      (uniforms.tPainting as IUniform).value = painting.composite;
      (uniforms.tInfo as IUniform).value = painting.info;
      (uniforms.uFrame as IUniform<number>).value = painting.frame;
      (uniforms.uTime as IUniform<number>).value = held ?? time;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
    setSize(width, height) {
      resolution().set(width, height);
      (uniforms.uOrigin?.value as Vector2).set(origin.x * width, (1 - origin.y) * height);
    },
    setProgress(progress) {
      (uniforms.uProgress as IUniform<number>).value = progress;
    },
    setOrigin(x, y) {
      origin = { x, y };
      const size = resolution();
      (uniforms.uOrigin?.value as Vector2).set(x * size.x, (1 - y) * size.y);
    },
    setGlint(on) {
      (uniforms.uGlint as IUniform<number>).value = on ? 1 : 0;
    },
    setNight(night) {
      (uniforms.uNight as IUniform<number>).value = night;
    },
    holdGlint(seconds) {
      held = seconds;
    },
    dispose() {
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
