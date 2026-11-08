/**
 * The painted sky behind the ridge: lapis blue laid in horizontal strokes
 * by day, with a few rounded clouds the way the old painters drew them (a
 * row of soft lobes on a flat underside, lit on top, cool beneath), and by
 * night the ultramarine vault of the old chapel ceilings, strewn with gold
 * eight-pointed stars, with a pale moon in its halo.
 *
 * It is painted in the picture's own space (top of the frame deepest), as a
 * painter lays a sky band, not as a physical dome: the clouds and the moon
 * are placed by where they fall in the frame, so they always sit whole
 * inside it, above the hills. It writes the sky's class into the contour
 * buffer, so the fresco pass draws a line where the hills meet it; the
 * clouds are painted in the sky's own strokes, with no line round them.
 */
import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
  type IUniform,
} from 'three';
import { NOISE } from './glsl.ts';
import type { ScenePalette } from './palette.ts';

export interface Sky {
  mesh: Mesh;
  setPalette(palette: ScenePalette): void;
  /** Where the sky band begins, 0 at the bottom of the frame and 1 at the top. */
  setHorizon(at: number): void;
  dispose(): void;
}

const FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform float uStars;
uniform vec3 uGold;
uniform vec4 uViewport;
uniform vec3 uCloudLight;
uniform vec3 uCloudShade;
uniform vec3 uMoon;
uniform float uBand;
layout(location = 1) out highp vec4 gInfo;
${NOISE}

// An eight-pointed star: four long rays and four short, the old painters' way.
float star(vec2 q, float size) {
  float r = length(q);
  float a = atan(q.y, q.x);
  float axes = pow(abs(cos(a * 2.0)), 14.0);
  float diagonals = pow(abs(cos(a * 2.0 - 1.5707963)), 14.0);
  float rays = axes * 0.85 + diagonals * 0.5;
  return smoothstep(size * (0.26 + rays), size * (0.18 + rays * 0.9), r);
}

// A painted cloud in its own space (x across -1..1, y up): a row of round lobes, the middle ones
// highest, on a flat underside. The signed distance to its edge.
float cloudShape(vec2 q, float seed) {
  float d = 1e3;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x = -0.72 + fi * 0.36 + (cfHash11(seed + fi * 1.7) - 0.5) * 0.14;
    float r = 0.3 + cfHash11(seed + fi * 3.1) * 0.16 - abs(x) * 0.12;
    d = min(d, length(q - vec2(x, r * 0.45)) - r);
  }
  return max(d, -q.y - 0.02);
}

void main() {
  vec2 screen = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;
  float height = uViewport.w;
  float aspect = uViewport.z / uViewport.w;
  vec2 px = gl_FragCoord.xy;
  float up = smoothstep(0.45, 1.0, screen.y);
  // Horizontal strokes of pigment, as a sky is laid with a broad brush.
  float strokes = cfFbm(vec2(px.x * 0.004, px.y * 0.05)) - 0.5;
  vec3 colour = mix(uHorizon, uTop, up);
  colour *= 1.0 + strokes * 0.09;
  float id = 3.97;
  float band = max(1.0 - uBand, 0.06);

  // The moon by night: a pale disc in a wide soft halo, high in the sky band.
  vec2 toMoon = (screen - vec2(uMoon.x, uBand + band * 0.6)) * vec2(aspect, 1.0);
  float moonR = uMoon.z;
  float halo = exp(-dot(toMoon, toMoon) / (2.0 * pow(moonR * 5.0, 2.0))) * uStars;
  colour += vec3(0.11, 0.12, 0.16) * halo;

  if (uStars > 0.0) {
    float cellSize = height * 0.06;
    vec2 grid = px / cellSize;
    vec2 cell = floor(grid);
    // Every other row shifted, as stars are pounced onto a vault in a lattice.
    grid.x += mod(cell.y, 2.0) * 0.5;
    cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    vec2 jitter = (cfHash22(cell) - 0.5) * 0.25;
    float size = 0.13 + cfHash12(cell + 3.0) * 0.07;
    float s = star(local - jitter, size) * step(0.4, cfHash12(cell + 9.0)) * (1.0 - halo);
    colour = mix(colour, uGold * (0.9 + 0.25 * cfHash12(cell)), s * uStars);
    // A painted moon: a clean disc of lime white, a shade cooler toward its rim.
    float fromCentre = length(toMoon) / moonR;
    float disc = smoothstep(1.0, 0.96, fromCentre);
    // One colour with only its rim a shade cooler, so the brushwork has nothing to break into patches.
    vec3 moon = mix(vec3(0.84, 0.82, 0.72), vec3(0.7, 0.72, 0.72), smoothstep(0.82, 1.0, fromCentre));
    colour = mix(colour, moon, disc * uStars);
    if (disc > 0.5) id = 3.6;
  }

  // Clouds: up to four, each wholly inside the frame, above the hills, clear of the moon.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float seed = fi * 13.7 + 2.0;
    float cx = 0.15 + fi * 0.235 + (cfHash11(seed) - 0.5) * 0.07;
    if (uStars > 0.0 && abs(cx - uMoon.x) < 0.16) continue;
    // A cloud stands about 0.85 of its half-width tall; it is sized to sit in the band with room.
    float w = (0.05 + cfHash11(seed + 4.0) * 0.03) * min(1.0, 1.4 / aspect);
    w = min(w, band * 0.62 / (0.85 * aspect));
    float tall = 0.85 * w * aspect;
    vec2 centre = vec2(cx, uBand + band * 0.18 + (band * 0.86 - tall - band * 0.18) * cfHash11(seed + 8.0));
    vec2 q = (screen - centre) * vec2(aspect, 1.0) / (w * aspect);
    if (abs(q.x) > 1.3 || q.y > 1.0 || q.y < -0.3) continue;
    // Laid with the same level strokes as the sky around it: its edge thins into the blue rather
    // than being cut out, and no line is drawn round it.
    float streak = cfNoise(vec2(px.x * 0.012, px.y * 0.22) + seed) - 0.5;
    float d = cloudShape(q, seed) + streak * 0.12;
    float inside = smoothstep(0.1, -0.14, d);
    if (inside <= 0.0) continue;
    // Lit on top, cool beneath.
    float lift = smoothstep(-0.1, 0.6, q.y);
    vec3 cloud = mix(uCloudShade, uCloudLight, lift);
    cloud *= 1.0 + streak * 0.1;
    colour = mix(colour, cloud, inside * mix(0.92, 0.55, uStars));
  }
  gl_FragColor = vec4(colour, 1.0);
  gInfo = vec4(0.5, 0.5, 1.0, id);
}
`;

export function createSky(palette: ScenePalette): Sky {
  const uniforms: Record<string, IUniform> = {
    uTop: { value: new Color() },
    uHorizon: { value: new Color() },
    uStars: { value: 0 },
    uGold: { value: new Color('#e2b44c') },
    uViewport: { value: new Vector4(0, 0, 1, 1) },
    uCloudLight: { value: new Color() },
    uCloudShade: { value: new Color() },
    uMoon: { value: new Vector3(0.8, 0, 0.022) },
    uBand: { value: 0.86 },
  };
  const material = new ShaderMaterial({
    uniforms,
    side: BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: FRAGMENT,
  });
  const mesh = new Mesh(new SphereGeometry(2400, 32, 16), material);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (renderer) => {
    renderer.getCurrentViewport(uniforms.uViewport?.value as Vector4);
  };
  const sky: Sky = {
    mesh,
    setPalette(next) {
      (uniforms.uTop as IUniform<Color>).value.copy(next.skyTop);
      (uniforms.uHorizon as IUniform<Color>).value.copy(next.skyHorizon);
      (uniforms.uStars as IUniform<number>).value = next.stars;
      (uniforms.uCloudLight as IUniform<Color>).value.copy(next.cloudLight);
      (uniforms.uCloudShade as IUniform<Color>).value.copy(next.cloudShade);
    },
    setHorizon(at) {
      (uniforms.uBand as IUniform<number>).value = at;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
  sky.setPalette(palette);
  return sky;
}
