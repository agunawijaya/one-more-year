/**
 * The fresco's surfaces. One material paints every building: a Lambert
 * material (so it keeps three.js's lights and soft shadows) whose shader is
 * extended to paint as a fresco painter would.
 *
 * - Painted light: modelling in four soft values of each pigment, warm in
 *   the lights and cool in the shade (a blue-grey earth by day, a cold
 *   violet-brown by night), never toward black.
 * - Surface detail painted, not modelled: arched windows on façades, tile
 *   rows on roofs, the striped marble of a Tuscan cathedral, awning stripes,
 *   ashlar courses, the ribs of a dome, gold leaf.
 * - At night: windows lit at random by candle, and a warm glow from torches
 *   along the walls and in the loggias.
 * - A second output with each surface's normal, class and object id, which
 *   the fresco pass reads to draw the painter's contour lines and lay its
 *   strokes, and the gilding reads to know what is architecture.
 */
import {
  Color,
  DoubleSide,
  MeshLambertMaterial,
  Vector4,
  type IUniform,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { LUMA, NOISE, PAINTED_LIGHT } from './glsl.ts';
import type { ScenePalette } from './palette.ts';

export const MAX_TORCHES = 48;

export interface FrescoUniforms {
  uTime: IUniform<number>;
  uCandle: IUniform<number>;
  uCandleColor: IUniform<Color>;
  uShadowTint: IUniform<Color>;
  uNightTint: IUniform<Color>;
  uHighlight: IUniform<Color>;
  uMarbleDark: IUniform<Color>;
  uTorches: IUniform<Vector4[]>;
  uTorchCount: IUniform<number>;
  /** The harvest beat's light sweeping across the picture: x position of the light's edge, and its strength. */
  uSweep: IUniform<Vector4>;
  /** 0 when every window is dark (noon), 1 when the lamps are lit. */
  uWindows: IUniform<number>;
}

export function createFrescoUniforms(): FrescoUniforms {
  return {
    uTime: { value: 0 },
    uCandle: { value: 0 },
    uCandleColor: { value: new Color('#ffb44f') },
    uShadowTint: { value: new Color('#5d6878') },
    uNightTint: { value: new Color('#ffffff') },
    uHighlight: { value: new Color('#efe5cf') },
    uMarbleDark: { value: new Color('#4e6a58') },
    uTorches: { value: Array.from({ length: MAX_TORCHES }, () => new Vector4(0, -100, 0, 0)) },
    uTorchCount: { value: 0 },
    uSweep: { value: new Vector4(0, 0, 0, 0) },
    uWindows: { value: 0 },
  };
}

export function applyPaletteUniforms(uniforms: FrescoUniforms, palette: ScenePalette): void {
  uniforms.uCandle.value = palette.candle;
  uniforms.uCandleColor.value.copy(palette.candleColor);
  uniforms.uShadowTint.value.copy(palette.shadowTint);
  uniforms.uNightTint.value.copy(palette.nightTint);
  uniforms.uHighlight.value.copy(new Color(palette.appearance === 'dark' ? '#c9b48c' : '#f3ead6'));
  uniforms.uMarbleDark.value.copy(palette.marbleDark);
  uniforms.uWindows.value = palette.candle;
}

const VERTEX_HEAD = /* glsl */ `
attribute vec3 aFacade;
attribute float aKind;
attribute float aId;
varying vec3 vFacade;
varying float vKind;
varying float vId;
varying vec3 vWorld;
uniform float uTime;
#ifdef CF_WALKERS
attribute vec4 aWalk;
#endif
`;

const VERTEX_BODY = /* glsl */ `
vFacade = aFacade;
vKind = aKind;
#ifdef USE_INSTANCING
vId = aId + float(gl_InstanceID) * 7.31;
vec4 cfWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
vId = aId;
vec4 cfWorld = modelMatrix * vec4(transformed, 1.0);
#endif
vWorld = cfWorld.xyz;
`;

/** Walkers drift to and fro along their lane; the whole figure moves, with a small bob in its step. */
const WALK_BODY = /* glsl */ `
#ifdef CF_WALKERS
{
  float phase = uTime * aWalk.z + aWalk.w;
  vec2 lane = aWalk.xy * sin(phase);
  float bob = abs(sin(phase * 6.0)) * 0.06;
  transformed += vec3(lane.x, bob, lane.y);
}
#endif
#ifdef CF_BANNER
{
  // A hanging banner sways from its crossbar: still at the top, freer toward the hem.
  float hang = clamp(-position.y / 1.2, 0.0, 1.0);
  float wave = sin(position.y * 3.2 + uTime * 2.1 + modelMatrix[3].x * 0.3) + 0.5 * sin(position.x * 4.0 + uTime * 3.3);
  transformed.z += wave * 0.07 * hang;
  transformed.x += sin(uTime * 1.3 + modelMatrix[3].z) * 0.05 * hang;
}
#endif
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vFacade;
varying float vKind;
varying float vId;
varying vec3 vWorld;
uniform float uTime;
uniform float uCandle;
uniform vec3 uCandleColor;
uniform vec3 uShadowTint;
uniform vec3 uNightTint;
uniform vec3 uHighlight;
uniform vec3 uMarbleDark;
uniform vec4 uTorches[${MAX_TORCHES}];
uniform int uTorchCount;
uniform vec4 uSweep;
uniform float uWindows;
layout(location = 1) out highp vec4 gInfo;
${NOISE}
${LUMA}
${PAINTED_LIGHT}

// An arched window in a cell of the given size: 1 inside the opening.
float cfArch(vec2 local, vec2 size) {
  vec2 p = local - vec2(0.5 * size.x, 0.0);
  float halfWidth = size.x * 0.5;
  float body = step(abs(p.x), halfWidth) * step(0.0, p.y) * step(p.y, size.y - halfWidth);
  vec2 top = p - vec2(0.0, size.y - halfWidth);
  float arch = step(length(top), halfWidth) * step(size.y - halfWidth, p.y);
  return max(body, arch);
}

vec3 cfLitWindow;

vec3 cfPaint(vec3 base) {
  float kind = floor(vKind + 0.5);
  // A town house's roof and a cottage's are painted as any roof.
  if (kind == 16.0 || kind == 17.0) kind = 2.0;
  vec2 f = vFacade.xy;
  float top = vFacade.z;
  float mottle = cfFbm(vWorld.xz * 0.35 + vWorld.y * 0.2) - 0.5;
  vec3 colour = base * (1.0 + mottle * 0.16);
  // A wall is never one flat colour: painters graded it, a shade darker toward its foot, and laid
  // it with a broad brush whose strokes run across it.
  if (kind == 1.0 || kind == 3.0 || kind == 6.0 || kind == 0.0) {
    colour *= mix(0.84, 1.05, smoothstep(0.0, max(top, 1.0), f.y));
    float stroke = cfNoise(vec2(f.x * 0.45 + vId * 3.0, f.y * 2.6)) - 0.5;
    colour *= 1.0 + stroke * 0.16;
  }
  cfLitWindow = vec3(0.0);
  if (kind == 1.0 || kind == 3.0) {
    // Windows: a grid of arched openings, floors every 3.2 units, none in the last metre.
    vec2 cell = vec2(kind == 3.0 ? 3.4 : 2.5, 3.2);
    vec2 index = floor((f - vec2(0.0, 1.0)) / cell);
    vec2 local = f - vec2(0.0, 1.0) - index * cell;
    vec2 opening = kind == 3.0 ? vec2(0.7, 2.4) : vec2(0.75, 1.35);
    float inside = cfArch(local - vec2((cell.x - opening.x) * 0.5, 0.5), opening);
    float fits = step(1.0, f.y) * step(index.y * cell.y + 1.0 + 0.5 + opening.y, top - 0.6);
    float seed = cfHash12(index + vec2(vId * 3.1, vId));
    float window = inside * fits * step(0.12, seed);
    if (kind == 3.0) {
      // Striped marble: white with narrow bands of dark green, and now and then a rose one.
      float phase = fract(f.y / 1.15);
      float band = step(0.74, phase);
      float rose = step(0.5, fract(floor(f.y / 1.15) / 3.0)) * band;
      colour = mix(colour, uMarbleDark * (1.0 + mottle * 0.2), band * (1.0 - rose));
      colour = mix(colour, vec3(0.6, 0.27, 0.2) * (1.0 + mottle * 0.15), rose);
    } else {
      // A string course at each floor.
      float course = smoothstep(0.06, 0.0, abs(fract((f.y - 1.0) / cell.y) - 0.02)) * step(1.0, f.y) * step(f.y, top - 0.4);
      colour *= 1.0 - course * 0.12;
    }
    vec3 dark = mix(vec3(0.03, 0.02, 0.015), uShadowTint * 0.3, 0.3);
    colour = mix(colour, dark, window);
    float lit = window * step(0.55, cfHash12(index * 1.7 + vId)) * uWindows;
    cfLitWindow = uCandleColor * lit * (0.75 + 0.25 * sin(uTime * 3.0 + seed * 20.0));
  } else if (kind == 2.0) {
    // Roof tiles: rows down the slope, columns across, the joints a little darker.
    float row = fract(f.y / 0.42);
    float column = fract(f.x / 0.38 + step(0.5, fract(f.y / 0.84)) * 0.5);
    float joint = max(smoothstep(0.86, 1.0, row), smoothstep(0.9, 1.0, column) * 0.6);
    colour *= 1.0 - joint * 0.18 + (cfHash12(floor(vec2(f.x / 0.38, f.y / 0.42)) + vId) - 0.5) * 0.12;
    // Brushed down the slope, lighter at the ridge where the sun catches the tiles.
    colour *= 1.0 + (cfNoise(vec2(f.x * 2.2 + vId * 5.0, f.y * 0.4)) - 0.5) * 0.2;
    colour *= mix(0.92, 1.06, smoothstep(0.0, 3.0, f.y));
  } else if (kind == 4.0) {
    // Awning stripes, alternating with lime white.
    float stripe = step(0.5, fract(f.x / 0.55));
    colour = mix(colour, uHighlight * 0.96, stripe);
  } else if (kind == 5.0) {
    // A dome's segments: white stone ribs at the edges, tiles between.
    float rib = smoothstep(0.08, 0.02, min(f.x, 1.0 - f.x));
    float tiles = smoothstep(0.85, 1.0, fract(f.y * 18.0)) * 0.12;
    colour = mix(colour * (1.0 - tiles), uHighlight * 0.92, rib);
  } else if (kind == 6.0) {
    // Ashlar: courses of dressed stone, joints staggered course by course.
    float course = floor(f.y / 0.62);
    float block = floor(f.x / 1.25 + mod(course, 2.0) * 0.5);
    float joint = max(smoothstep(0.9, 1.0, fract(f.y / 0.62)), smoothstep(0.94, 1.0, fract(f.x / 1.25 + mod(course, 2.0) * 0.5)));
    colour *= 1.0 + (cfHash12(vec2(block, course) + vId) - 0.5) * 0.14 - joint * 0.16;
  } else if (kind == 7.0) {
    colour = mix(vec3(0.025, 0.018, 0.013), uShadowTint * 0.25, 0.3);
    cfLitWindow = uCandleColor * uWindows * 0.6;
  } else if (kind == 8.0) {
    colour *= 1.0 - smoothstep(0.85, 1.0, fract(f.y / 0.3)) * 0.2;
  } else if (kind == 9.0) {
    // Gold leaf: a warm metal, a little brighter where the leaves overlap. (Linear values.)
    float leaf = cfHash12(floor(vWorld.xz * 3.0) + floor(vWorld.y * 3.0));
    colour = mix(vec3(0.6, 0.38, 0.08), vec3(0.82, 0.6, 0.2), leaf * 0.6);
  } else if (kind == 11.0) {
    // Scaffolding: a lattice of poles over a pale preview of the work to come.
    float pole = max(step(0.86, fract(f.x / 1.4)), step(0.88, fract(f.y / 1.6)));
    colour = mix(colour, vec3(0.15, 0.09, 0.04), pole);
  } else if (kind == 12.0) {
    // Faces and hands keep their own tone whatever the robe.
    colour = vec3(0.62, 0.38, 0.25) * (1.0 + mottle * 0.1);
  } else if (kind == 13.0) {
    colour = uCandleColor;
    cfLitWindow = uCandleColor * (1.6 + 0.4 * sin(uTime * 9.0 + vId * 13.0)) * max(uCandle, 0.25);
  } else if (kind == 14.0) {
    // A rose window: spokes and rings of coloured glass, glowing from within at night.
    vec2 p = f - vec2(0.5);
    float r = length(p) * 2.0;
    float spokes = smoothstep(0.75, 0.95, abs(cos(atan(p.y, p.x) * 6.0)));
    float rings = smoothstep(0.08, 0.0, abs(r - 0.55)) + smoothstep(0.1, 0.0, abs(r - 0.92));
    vec3 glass = mix(vec3(0.03, 0.06, 0.22), vec3(0.36, 0.03, 0.02), step(0.5, fract(atan(p.y, p.x) * 1.909)));
    colour = mix(glass, uHighlight * 0.9, clamp(spokes * step(r, 0.95) + rings, 0.0, 1.0));
    // Lit from within, the glass keeps its colours: amber, ruby and blue, the leading dark between.
    vec3 lit = mix(vec3(0.9, 0.5, 0.16), glass * 1.6, 0.55);
    cfLitWindow = lit * uWindows * step(r, 0.95) * (1.0 - clamp(spokes + rings, 0.0, 1.0) * 0.85) * 0.75;
  } else if (kind == 15.0) {
    // Brick laid in herringbone, the way the great piazzas are paved.
    vec2 q = vWorld.xz * 1.6;
    float zig = fract((q.x + q.y) * 0.5);
    float zag = fract((q.x - q.y) * 0.5);
    float joint = step(0.9, fract(floor(q.x + q.y) * 0.5 + (zig > zag ? q.x : q.y)));
    colour *= 1.0 - joint * 0.14 + (cfHash12(floor(q)) - 0.5) * 0.1;
  }
  return colour;
}

vec3 cfShade(vec3 albedo, vec3 lit) {
  // Modelling is judged against the scene's own light, so night and noon both use the full range of values.
  return cfPaintedLight(albedo, lit, uShadowTint, uHighlight, uCandle, uNightTint);
}

// The class the gold and the brushwork read: architecture is gilded at a coronation; people, trees,
// awnings, rose windows and the paving keep their colours beside the gold.
float cfInfoClass() {
  float kind = floor(vKind + 0.5);
  bool built = kind == 1.0 || kind == 2.0 || kind == 3.0 || (kind >= 5.0 && kind <= 9.0) || kind == 11.0;
  // Some town roofs keep their vermilion, so the gold sits against colour; cottages are never gilded.
  if (kind == 16.0) built = cfHash11(vId * 7.13) > 0.42;
  return built ? 0.0 : 1.0;
}

vec3 cfNightLights(vec3 albedo) {
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${MAX_TORCHES}; i++) {
    if (i >= uTorchCount) break;
    vec4 torch = uTorches[i];
    vec3 d = vWorld - torch.xyz;
    float fall = torch.w / (1.0 + dot(d, d) * 0.035);
    glow += uCandleColor * fall;
  }
  return albedo * glow * uCandle;
}
`;

// A banner's cloth keeps its arms' colours, but its gold edge is gilded with the architecture.
const INFO_OUT = /* glsl */ `
float cfClass = cfInfoClass();
#ifdef CF_BANNER
vec2 cfCloth = min(vMapUv, 1.0 - vMapUv);
cfClass = min(cfCloth.x, cfCloth.y) < 0.07 ? 0.0 : 1.0;
#endif
gInfo = vec4(normalize(normal) * 0.5 + 0.5, cfClass + fract(vId * 0.6180339) * 0.98);
`;

export interface PigmentOptions {
  uniforms: FrescoUniforms;
  /** Walkers in the crowd shader (instanced figures that drift along lanes). */
  walkers?: boolean;
  /** A hanging banner: a painted cloth (the map) that sways. */
  banner?: Texture;
  doubleSided?: boolean;
}

/** The material for every painted surface. */
export function createPigmentMaterial(options: PigmentOptions): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: !options.banner });
  if (options.doubleSided || options.banner) material.side = DoubleSide;
  if (options.walkers) material.defines = { CF_WALKERS: '' };
  if (options.banner) {
    material.map = options.banner;
    material.defines = { CF_BANNER: '' };
  }
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, options.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WALK_BODY}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  vec3 cfAlbedo = cfPaint(diffuseColor.rgb);\n  diffuseColor.rgb = cfAlbedo;',
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        [
          'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
          'outgoingLight = cfShade(cfAlbedo, outgoingLight);',
          'outgoingLight += cfNightLights(cfAlbedo) + cfLitWindow;',
          '// The harvest beat: a band of warm light moving across the picture.',
          'outgoingLight *= 1.0 + uSweep.w * smoothstep(uSweep.x - 40.0, uSweep.x, vWorld.x) * smoothstep(uSweep.x + 60.0, uSweep.x, vWorld.x) * 0.35;',
        ].join('\n'),
      )
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${INFO_OUT}`);
  };
  // Every pigment material shares one compiled program per variant.
  const variant = options.banner ? 'banner' : options.walkers ? 'walkers' : 'still';
  material.customProgramCacheKey = () => `cf-pigment-${variant}`;
  return material;
}
