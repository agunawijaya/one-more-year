/**
 * The fresco pass: how a rendered city becomes a painting on a wall.
 *
 *   scene ─► colour + (normal, class, id) + depth
 *     │
 *     ├─► structure tensor ─► blurred ─► anisotropic Kuwahara   (flat mixtures)
 *     │                          │               │
 *     │                          └──► strokes ◄──┘                (the brush)
 *     │                                  │
 *     │                                  ├─► soft (a quarter size, blurred)
 *     │                                  ▼
 *     └─ contours (normals, depth, ids) ─► composite: bleed and pooling ·
 *          pigment shelf · pressure lines and sinopia · intonaco (grain,
 *          trowel, giornate, cracks) · smoke · painted frame ─► gilding ─► screen
 *
 * The Kuwahara filter flattens the render into areas of one mixture with
 * clean edges. The strokes pass then paints those areas again with the
 * brush: rows of short daubs laid along the forms (the picture's own edges
 * where it has them, the surface's contour where it has not, level strokes
 * in the sky), long and broad in the sky and the fields, short in the
 * town, each stroke one mixture with its bristles' streaks, never carried
 * across an edge. The composite lets the wet pigment pool and run at
 * strong edges, pulls every colour toward the painter's shelf, draws the
 * lines with a hand's pressure, and multiplies the lime plaster in.
 *
 * The brushwork runs at a fraction of the screen's resolution (the quality
 * ladder's "post-process resolution"); the contours and the plaster are
 * drawn at full resolution so lines stay crisp and the wall's grain never
 * swims. The strokes and the plaster are fixed to the picture, not to the
 * world: they are the wall the city is painted on.
 */
import type { Camera } from 'three';
import {
  Color,
  DepthTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type IUniform,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { LUMA, NOISE } from './glsl.ts';
import { PIGMENTS } from './palette.ts';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const TENSOR = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 at(vec2 o) { return textureLod(tColor, vUv + o * uTexel, 0.0).rgb; }
void main() {
  vec3 u = (-1.0 * at(vec2(-1.0, -1.0)) - 2.0 * at(vec2(-1.0, 0.0)) - 1.0 * at(vec2(-1.0, 1.0))
           + 1.0 * at(vec2(1.0, -1.0)) + 2.0 * at(vec2(1.0, 0.0)) + 1.0 * at(vec2(1.0, 1.0))) / 4.0;
  vec3 v = (-1.0 * at(vec2(-1.0, -1.0)) - 2.0 * at(vec2(0.0, -1.0)) - 1.0 * at(vec2(1.0, -1.0))
           + 1.0 * at(vec2(-1.0, 1.0)) + 2.0 * at(vec2(0.0, 1.0)) + 1.0 * at(vec2(1.0, 1.0))) / 4.0;
  gl_FragColor = vec4(dot(u, u), dot(v, v), dot(u, v), 1.0);
}
`;

const BLUR = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDirection;
varying vec2 vUv;
void main() {
  // A Gaussian of sigma 2 in nine taps.
  vec4 sum = textureLod(tInput, vUv, 0.0) * 0.2042;
  sum += (textureLod(tInput, vUv + uDirection * 1.0, 0.0) + textureLod(tInput, vUv - uDirection * 1.0, 0.0)) * 0.1802;
  sum += (textureLod(tInput, vUv + uDirection * 2.0, 0.0) + textureLod(tInput, vUv - uDirection * 2.0, 0.0)) * 0.1238;
  sum += (textureLod(tInput, vUv + uDirection * 3.0, 0.0) + textureLod(tInput, vUv - uDirection * 3.0, 0.0)) * 0.0663;
  sum += (textureLod(tInput, vUv + uDirection * 4.0, 0.0) + textureLod(tInput, vUv - uDirection * 4.0, 0.0)) * 0.0276;
  gl_FragColor = sum;
}
`;

/** Four bilinear taps: a box of four by four source pixels, to shrink the strokes a quarter. */
const SHRINK = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec4 sum = textureLod(tInput, vUv + vec2(-1.0, -1.0) * uTexel, 0.0);
  sum += textureLod(tInput, vUv + vec2(1.0, -1.0) * uTexel, 0.0);
  sum += textureLod(tInput, vUv + vec2(-1.0, 1.0) * uTexel, 0.0);
  sum += textureLod(tInput, vUv + vec2(1.0, 1.0) * uTexel, 0.0);
  gl_FragColor = sum * 0.25;
}
`;

/**
 * Anisotropic Kuwahara with polynomial sector weights (after Kyprianidis,
 * Kang and Döllner): eight overlapping sectors of an ellipse aligned with
 * the local structure; each pixel takes the mean of the sectors weighted by
 * how uniform they are. Edges stay sharp, flat areas become one mixture.
 */
const KUWAHARA = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tTensor;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
const int MAX_REACH = 14;
void main() {
  vec3 g = textureLod(tTensor, vUv, 0.0).xyz;
  float root = sqrt(max(0.0, g.y * g.y - 2.0 * g.x * g.y + g.x * g.x + 4.0 * g.z * g.z));
  float l1 = 0.5 * (g.y + g.x + root);
  float l2 = 0.5 * (g.y + g.x - root);
  vec2 direction = vec2(l1 - g.x, -g.z);
  vec2 t = length(direction) > 0.0 ? normalize(direction) : vec2(0.0, 1.0);
  float phi = -atan(t.y, t.x);
  float anisotropy = (l1 + l2 > 0.0) ? (l1 - l2) / (l1 + l2) : 0.0;
  float alpha = 1.0;
  float a = uRadius * clamp((alpha + anisotropy) / alpha, 0.1, 2.0);
  float b = uRadius * clamp(alpha / (alpha + anisotropy), 0.1, 2.0);
  float c = cos(phi);
  float s = sin(phi);
  mat2 R = mat2(c, -s, s, c);
  mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
  mat2 SR = S * R;
  int reachX = min(MAX_REACH, int(sqrt(a * a * c * c + b * b * s * s)));
  int reachY = min(MAX_REACH, int(sqrt(a * a * s * s + b * b * c * c)));
  float zeta = 1.0 / uRadius;
  float zeroCross = 0.58;
  float sinZero = sin(zeroCross);
  float eta = (zeta + cos(zeroCross)) / (sinZero * sinZero);
  vec4 m[8];
  vec3 sq[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); sq[k] = vec3(0.0); }
  for (int j = -MAX_REACH; j <= MAX_REACH; j++) {
    if (j < -reachY || j > reachY) continue;
    for (int i = -MAX_REACH; i <= MAX_REACH; i++) {
      if (i < -reachX || i > reachX) continue;
      vec2 v = SR * vec2(float(i), float(j));
      if (dot(v, v) > 0.25) continue;
      vec3 col = clamp(textureLod(tColor, vUv + vec2(float(i), float(j)) * uTexel, 0.0).rgb, 0.0, 1.0);
      float w[8];
      float sum = 0.0;
      float vxx = zeta - eta * v.x * v.x;
      float vyy = zeta - eta * v.y * v.y;
      float z;
      z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
      vec2 r = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta * r.x * r.x;
      vyy = zeta - eta * r.y * r.y;
      z = max(0.0, r.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -r.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -r.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, r.x + vyy); w[7] = z * z; sum += w[7];
      float gauss = exp(-3.125 * dot(v, v)) / max(sum, 1e-5);
      for (int k = 0; k < 8; k++) {
        float wk = w[k] * gauss;
        m[k] += vec4(col * wk, wk);
        sq[k] += col * col * wk;
      }
    }
  }
  vec4 result = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 0.0) continue;
    vec3 mean = m[k].rgb / m[k].w;
    vec3 variance = abs(sq[k] / m[k].w - mean * mean);
    float sigma2 = variance.r + variance.g + variance.b;
    float wk = 1.0 / (1.0 + pow(8000.0 * sigma2, 4.0));
    result += vec4(mean * wk, wk);
  }
  gl_FragColor = vec4(result.w > 0.0 ? result.rgb / result.w : textureLod(tColor, vUv, 0.0).rgb, 1.0);
}
`;

/**
 * The brush. The picture is tiled with rows of daubs in ten directions;
 * each pixel finds the stroke it lies in for the one or two directions
 * nearest the flow there, and takes the one laid last (a random order per
 * stroke). A stroke's colour is the mixture where it was laid down, a touch
 * lighter or darker than its neighbours, streaked by its bristles; it tapers
 * and breaks up at its tail, and it never carries its colour across an
 * edge, where the paint beneath shows through instead.
 */
const STROKES = /* glsl */ `
uniform sampler2D tPaint;
uniform sampler2D tTensor;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform vec2 uSize;
uniform float uScale;
uniform float uLayers;
uniform float uSeed;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
varying vec2 vUv;
${NOISE}
${LUMA}

const float PI = 3.14159265;
const float BINS = 10.0;

vec2 doubled(float angle) { return vec2(cos(2.0 * angle), sin(2.0 * angle)); }

float linearDepth(vec2 uv) {
  float d = textureLod(tDepth, uv, 0.0).r;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}

// Where the strokes run here, as a doubled angle (a stroke has a direction, not a sense).
vec2 flowAt(vec4 info, vec2 px) {
  float kind = floor(info.w + 0.001);
  vec3 n = info.xyz * 2.0 - 1.0;
  // The form's own direction: along the surface's contour on the screen, across its tilt; where
  // the surface faces us square, and in the sky, level, as a painter lays a ground.
  float drift = (cfNoise(px * 0.006 + uSeed * 13.0) - 0.5) * 0.6;
  float formAngle = kind < 2.5 && length(n.xy) > 0.3 ? atan(n.x, -n.y) : 0.0;
  vec2 form = doubled(formAngle + drift * (kind > 2.5 ? 0.3 : 1.0));
  // The picture's own edges (the structure tensor's minor direction): strokes follow them.
  vec3 g = textureLod(tTensor, vUv, 0.0).xyz;
  float root = sqrt(max(0.0, (g.x - g.y) * (g.x - g.y) + 4.0 * g.z * g.z));
  float l1 = 0.5 * (g.x + g.y + root);
  float l2 = 0.5 * (g.x + g.y - root);
  vec2 t = vec2(l1 - g.x, -g.z);
  if (length(t) < 1e-7 || l1 + l2 < 1e-7) return form;
  float sure = (l1 - l2) / (l1 + l2) * smoothstep(0.0002, 0.003, l1);
  float trust = kind > 2.5 ? 0.25 : kind > 1.5 ? 0.55 : 0.9;
  return mix(form, doubled(atan(t.y, t.x)), sure * trust);
}

// Length and breadth of a stroke here, in pixels of a 1080-line picture: long in the sky, broad
// in the near fields and finer toward the hills, short in the town and on its people.
vec2 strokeSize(vec4 info, vec2 px) {
  float kind = floor(info.w + 0.001);
  if (kind > 2.5) return vec2(34.0, 8.0);
  if (kind < 1.5) return vec2(12.0, 4.2);
  // On the land the stroke shortens with distance, in three steps whose borders are ragged.
  float far = smoothstep(uFocus * 0.92, uFocus * 1.18, linearDepth(vUv));
  far += (cfNoise(px * 0.05) - 0.5) * 0.3;
  if (fract(info.w) > 0.45) far = max(far, 0.5);
  return far < 0.33 ? vec2(26.0, 7.0) : far < 0.66 ? vec2(19.0, 5.5) : vec2(14.0, 4.5);
}

vec4 strokeFrom(vec2 px, float angle, vec2 size, float layer, vec3 here, float vary, out float score) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 q = vec2(c * px.x + s * px.y, -s * px.x + c * px.y);
  float row = floor(q.y / size.y);
  float shift = cfHash11(row * 1.37 + layer * 7.1 + uSeed) * size.x;
  float column = floor((q.x + shift) / size.x);
  vec2 local = vec2(fract((q.x + shift) / size.x), fract(q.y / size.y));
  vec2 id = vec2(column, row) + vec2(layer * 31.0, layer * 17.0);
  float h = cfHash12(id);
  float h2 = cfHash12(id + 5.3);
  // A daub: full across most of its row, tapering toward the tail, ragged where the brush lifts.
  float across = abs(local.y - 0.5) * 2.0;
  float taper = 0.88 + 0.12 * h - 0.32 * smoothstep(0.45, 1.0, local.x);
  float body = smoothstep(taper, taper - 0.24, across);
  float ragged = (cfNoise(vec2(local.y * 7.0, h * 50.0)) - 0.5) * 0.2;
  float ends = smoothstep(0.0, 0.08, local.x) * smoothstep(1.0, 0.84 + ragged, local.x);
  float alpha = body * ends;
  // One mixture per stroke: the paint where the brush came down.
  vec2 middle = vec2((column + 0.5) * size.x - shift, (row + 0.5) * size.y);
  vec2 at = vec2(c * middle.x - s * middle.y, s * middle.x + c * middle.y);
  vec3 colour = textureLod(tPaint, at / uSize, 0.0).rgb;
  float differ = length(colour - here) / (0.04 + cfLuma(here) * 0.9);
  alpha *= 1.0 - smoothstep(0.16, 0.42, differ);
  // Each stroke its own touch: a little lighter or darker, a little warmer or cooler than the next,
  // streaked by its bristles, and with a trace more pigment where it dried at its edges.
  float bristle = cfNoise(vec2(local.x * 2.2 + h * 9.0, local.y * size.y * 0.8 + h2 * 40.0)) - 0.5;
  colour *= 1.0 + ((h2 - 0.5) * 0.24 + bristle * 0.24) * vary;
  colour = mix(colour, colour * vec3(1.05, 1.0, 0.92), (h - 0.5) * vary);
  colour *= 1.0 - smoothstep(taper - 0.3, taper - 0.04, across) * 0.08 * vary;
  score = (0.3 + 0.7 * h) * step(0.3, alpha);
  return vec4(colour, alpha);
}

void main() {
  vec2 px = vUv * uSize;
  vec3 here = textureLod(tPaint, vUv, 0.0).rgb;
  vec4 info = textureLod(tInfo, vUv, 0.0);
  // The moon is a clean painted disc: no strokes across it.
  if (abs(info.w - 3.6) < 0.01) {
    gl_FragColor = vec4(here, 1.0);
    return;
  }
  vec2 flow = flowAt(info, px);
  float angle = 0.5 * atan(flow.y, flow.x);
  float bin = (angle / PI + 0.5) * BINS;
  vec2 size = strokeSize(info, px);
  // The town's strokes show their touch as the land's do; edge-stopping keeps its windows and corners.
  float vary = size.x > 13.0 ? 1.0 : 0.85;
  size *= uScale;
  float first;
  vec4 best;
  float bestScore;
  if (uLayers > 1.5) {
    float b0 = floor(bin);
    float f = bin - b0;
    best = strokeFrom(px, (b0 / BINS - 0.5) * PI, size, b0, here, vary, first);
    bestScore = first * (1.0 - f);
    float second;
    vec4 other = strokeFrom(px, ((b0 + 1.0) / BINS - 0.5) * PI, size, mod(b0 + 1.0, BINS), here, vary, second);
    if (second * f > bestScore) {
      best = other;
      bestScore = second * f;
    }
  } else {
    float b = floor(bin + 0.5);
    best = strokeFrom(px, (b / BINS - 0.5) * PI, size, mod(b, BINS), here, vary, first);
    bestScore = first;
  }
  // Between the strokes the paint lies thinner and a little of the lime comes through.
  vec3 under = here * 1.06;
  gl_FragColor = vec4(mix(under, best.rgb, best.a), 1.0);
}
`;

const PIGMENT_LIST = [
  PIGMENTS.limeWhite,
  PIGMENTS.bone,
  PIGMENTS.ochre,
  PIGMENTS.paleOchre,
  PIGMENTS.rawSienna,
  PIGMENTS.burntSienna,
  PIGMENTS.terracotta,
  PIGMENTS.rose,
  PIGMENTS.terraVerde,
  PIGMENTS.olive,
  PIGMENTS.verdigris,
  PIGMENTS.lapis,
  PIGMENTS.azurite,
  PIGMENTS.vermilion,
  PIGMENTS.umber,
  PIGMENTS.stone,
  PIGMENTS.ivoryBlack,
  PIGMENTS.ultramarine,
];

const COMPOSITE = /* glsl */ `
uniform sampler2D tStrokes;
uniform sampler2D tSoft;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform vec3 uPigments[${PIGMENT_LIST.length}];
uniform float uPull;
uniform vec3 uIntonaco;
uniform vec3 uPatina;
uniform vec3 uSinopia;
uniform vec3 uContour;
uniform float uNight;
uniform float uFrame;
uniform float uLineWeight;
uniform float uPlaster;
uniform float uSeed;
varying vec2 vUv;
${NOISE}
${LUMA}

vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

vec3 oklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

vec3 fromOklab(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

float linearDepth(vec2 uv) {
  float d = textureLod(tDepth, uv, 0.0).r;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}

// How strongly a contour passes through this pixel: silhouettes (inked on their nearer side only,
// so a silhouette gets one line, not two), creases, and the meeting of two objects. Lines between
// the sky and its own clouds are faint, as a painter outlines a cloud with a thinner colour.
float contourAt(vec2 uv, float reach) {
  vec2 o = reach / uResolution;
  vec4 c = textureLod(tInfo, uv, 0.0);
  float zc = linearDepth(uv);
  float line = 0.0;
  vec2 taps[8];
  taps[0] = vec2(o.x, 0.0); taps[1] = vec2(-o.x, 0.0); taps[2] = vec2(0.0, o.y); taps[3] = vec2(0.0, -o.y);
  taps[4] = o; taps[5] = -o; taps[6] = vec2(o.x, -o.y); taps[7] = vec2(-o.x, o.y);
  for (int i = 0; i < 8; i++) {
    vec4 n = textureLod(tInfo, uv + taps[i], 0.0);
    float crease = 1.0 - dot(normalize(c.xyz * 2.0 - 1.0), normalize(n.xyz * 2.0 - 1.0));
    float z = linearDepth(uv + taps[i]);
    float rise = abs(z - zc) / max(zc, 1.0);
    float nearer = step(zc, z + 0.001);
    float skyOnly = step(2.5, c.w) * step(2.5, n.w);
    // Where land meets land (a hill's crest over the next), the line is lighter than a building's.
    float landOnly = step(1.5, c.w) * step(c.w, 2.99) * step(1.5, n.w) * step(n.w, 2.99);
    line = max(line, smoothstep(0.22, 0.6, crease) * 0.8 * (1.0 - skyOnly) * mix(1.0, 0.5, landOnly));
    line = max(line, smoothstep(0.0035, 0.009, rise) * nearer * mix(1.0, 0.55, landOnly));
    line = max(line, step(0.002, abs(n.w - c.w)) * mix(0.75, 0.3, skyOnly));
  }
  return line;
}

// Each colour leans toward the two nearest pigments on the painter's shelf, so every colour looks
// mixed from earths, not chosen from RGB; the value is mostly left to the painted light.
vec3 pigmentPull(vec3 linear, float strength) {
  vec3 lab = oklab(linear);
  float best = 1e9;
  float second = 1e9;
  vec3 bestLab = lab;
  vec3 secondLab = lab;
  for (int i = 0; i < ${PIGMENT_LIST.length}; i++) {
    vec3 p = oklab(uPigments[i]);
    vec3 d = p - lab;
    float dist = d.x * d.x * 0.5 + (d.y * d.y + d.z * d.z) * 2.0;
    if (dist < best) { second = best; secondLab = bestLab; best = dist; bestLab = p; }
    else if (dist < second) { second = dist; secondLab = p; }
  }
  float t = best / max(best + second, 1e-6);
  vec3 target = mix(bestLab, secondLab, t);
  vec2 ab = mix(lab.yz, target.yz, strength) * 0.94;
  float L = mix(lab.x, target.x, strength * 0.25);
  // Lime cannot hold a true black: by day the darkest mixtures stay a little open.
  L = mix(L, 0.15 + L * 0.87, 0.35 * (1.0 - uNight));
  return max(fromOklab(vec3(L, ab)), 0.0);
}

// The wall: lime plaster with sand in it, pits that drank the pigment, the trowel's sweep, the
// seams of each day's work and a few hairline cracks. It shows most where the paint is thin (the
// shade) and toward the frame.
vec3 plaster(vec2 px, vec3 painted) {
  vec2 p = px + uSeed * 97.0;
  // How light the paint is, 0 to 1: against the lime by day; by night against a fixed light, since the
  // smoke-dark lime would make every lamp-lit wall read as brighter than the wall itself.
  float value = clamp(cfLuma(painted) / mix(max(cfLuma(uIntonaco), 0.05), 0.35, uNight), 0.0, 1.0);
  float grain = (cfHash12(floor(p)) - 0.5) * 0.07 + (cfNoise(p * 0.55) - 0.5) * 0.07;
  float pits = smoothstep(0.7, 0.93, cfNoise(p * 0.33 + 4.0));
  float uneven = (cfFbm(p * 0.0028) - 0.5) * 0.12;
  vec2 fromEdge = min(px, uResolution - px) / uResolution.y;
  float rim = 1.0 - smoothstep(0.0, 0.16, min(fromEdge.x, fromEdge.y));
  float amount = mix(1.5, 0.75, smoothstep(0.03, 0.55, value)) + rim * 0.7;
  float tone = 1.0 + (grain - pits * 0.1 * (1.0 - value)) * amount + uneven * (0.6 + rim * 0.6);
  float crack = 0.0;
  if (uPlaster > 0.5) {
    // Giornate: the patches plastered and painted in one day, each its own shade, a faint seam.
    vec2 day = cfVoronoiEdge(p / 420.0 + vec2(cfNoise(p * 0.004), cfNoise(p * 0.004 + 9.0)) * 0.35);
    tone += (day.y - 0.5) * 0.04 - smoothstep(0.012, 0.0, day.x) * 0.06;
    // The trowel: within each sweep a run of faint wavy bands, and a raised lip where sweeps overlap.
    vec2 sweep = cfVoronoiEdge(p / 230.0 + 5.0);
    float heading = sweep.y * 6.2831853;
    vec2 dir = vec2(cos(heading), sin(heading));
    float bands = sin((dot(p, dir) + 26.0 * sin(dot(p, vec2(-dir.y, dir.x)) * 0.009)) * 0.11);
    tone += bands * 0.012 + smoothstep(0.025, 0.0, sweep.x) * 0.025;
    // Hairline cracks: sparse, fine, where the wall has settled.
    vec2 warp = vec2(cfFbm(p * 0.006), cfFbm(p * 0.006 + 4.3)) * 2.2;
    vec2 crackCell = cfVoronoiEdge(p / 190.0 + warp);
    float settled = smoothstep(0.58, 0.7, cfFbm(p * 0.0021 + 3.1));
    crack = smoothstep(0.006, 0.0015, crackCell.x) * settled;
  }
  vec3 colour = painted * tone;
  return mix(colour, uContour, crack * 0.32);
}

// The painted frame: a dark rule, a band of lozenges in vermilion and ochre, a lime fillet.
vec3 frameBand(vec2 px, vec3 colour) {
  if (uFrame <= 0.0) return colour;
  vec2 fromEdge = min(px, uResolution - px);
  float d = min(fromEdge.x, fromEdge.y);
  if (d > uFrame + 3.0) return colour;
  // The frame is drawn over the finished picture, so its pigments (linear) are converted for display.
  vec3 umber = toSrgb(uContour);
  vec3 band = toSrgb(mix(uPigments[14], uPigments[5], 0.55));
  float along = fromEdge.x < fromEdge.y ? px.y : px.x;
  float lozenge = abs(fract(along / (uFrame * 1.8)) - 0.5) * 2.0 * uFrame * 0.8;
  float inLozenge = step(abs(d - uFrame * 0.5), uFrame * 0.32 - lozenge * 0.36);
  vec3 jewel = toSrgb(mix(uPigments[2], uPigments[10], step(0.75, fract(along / (uFrame * 7.2)))));
  vec3 cell = mix(band, jewel, inLozenge);
  vec3 result = d < 2.0 ? umber : d < uFrame ? cell : d < uFrame + 1.6 ? toSrgb(uPigments[3]) : umber;
  return mix(colour, result, 0.94);
}

void main() {
  vec2 px = vUv * uResolution;
  // The painter's hand: lines wander a pixel or two from the colour beneath, swell and thin with
  // the pressure of the brush along their length, and break off now and then where it ran dry.
  vec2 wobble = (vec2(cfNoise(px * 0.018), cfNoise(px * 0.018 + 31.0)) - 0.5) * 3.0 / uResolution;
  // The pressure changes within a few pixels too, so even a short roof edge swells and thins.
  float pressure = 0.35 + cfNoise(px * 0.035 + 11.0) * 0.8 + (cfNoise(px * 0.11) - 0.5) * 0.7;
  float line = contourAt(vUv + wobble, uLineWeight * pressure);
  line *= smoothstep(0.14, 0.3, cfNoise(px * 0.018 + 5.0));
  line *= 0.68 + 0.32 * cfNoise(px * 0.35);
  float far = smoothstep(uFocus * 0.95, uFocus * 1.35, linearDepth(vUv));
  line *= mix(1.0, 0.55, far);
  // The sinopia: the red-earth underdrawing, a little off the final line, showing through.
  float sinopia = 0.0;
  if (uPlaster > 0.5) {
    vec2 drift = (vec2(cfNoise(px * 0.006 + 5.0), cfNoise(px * 0.006 + 8.0)) - 0.5) * 7.0 / uResolution;
    sinopia = contourAt(vUv + drift, 1.0) * (1.0 - line) * smoothstep(0.35, 0.75, cfNoise(px * 0.03 + 2.0));
  }

  // Wet pigment runs a pixel or two past an edge, and pools along it on the darker side.
  vec2 bleed = (vec2(cfNoise(px * 0.21), cfNoise(px * 0.21 + 3.7)) - 0.5) * 3.0 / uResolution;
  vec3 paint = textureLod(tStrokes, vUv + bleed * (0.4 + line), 0.0).rgb;
  vec3 soft = textureLod(tSoft, vUv, 0.0).rgb;
  float contrast = (cfLuma(soft) - cfLuma(paint)) / (cfLuma(soft) + 0.04);
  paint *= 1.0 - clamp(contrast * 0.5, 0.0, 0.16);
  paint = mix(paint, soft, smoothstep(0.08, 0.5, abs(contrast)) * 0.14 * cfNoise(px * 0.07));
  paint = pigmentPull(paint, uPull);

  vec3 colour = mix(paint, uContour, clamp(line, 0.0, 1.0) * 0.8);
  colour = mix(colour, uSinopia, sinopia * mix(0.3, 0.1, uNight));
  colour = plaster(px, colour);

  // Candle smoke darkens the upper edge and the corners of the wall by night.
  vec2 centred = vUv - 0.5;
  float smoke = uNight * (smoothstep(0.35, 0.85, vUv.y) * 0.22 + smoothstep(0.3, 0.8, length(centred)) * 0.38);
  smoke *= 0.7 + 0.6 * cfFbm(px * 0.004 + 2.0);
  colour = mix(colour, uPatina, clamp(smoke, 0.0, 0.6));
  // An old wall is never quite white: a faint warm veil over everything by day.
  colour = mix(colour, uIntonaco, 0.02 * (1.0 - uNight));

  vec3 srgb = toSrgb(colour);
  srgb = frameBand(px, srgb);
  gl_FragColor = vec4(srgb, 1.0);
}
`;

export interface FrescoSettings {
  /** Brush radius in post-process pixels (the Kuwahara kernel). */
  brush: number;
  /** The brushwork's resolution as a share of the screen's. */
  resolution: number;
  /** Stroke directions blended at each pixel: 2 crosses strokes where the flow turns, 1 is cheaper. */
  strokeLayers: number;
  /** 1 for the whole wall (giornate, trowel, cracks, sinopia), 0 for its grain alone. */
  plaster: number;
}

export interface FrescoLook {
  intonaco: Color;
  patina: Color;
  sinopia: Color;
  contour: Color;
  night: number;
  /** How strongly colours are pulled toward the pigments (0–1). */
  pull: number;
}

export interface FrescoPass {
  /** The target the scene renders into (colour and contour info, with depth). */
  readonly sceneTarget: WebGLRenderTarget;
  /** The scene's normals, classes and ids (for the gilding, which gilds architecture only). */
  readonly info: Texture;
  setSize(width: number, height: number, pixelRatio: number): void;
  setSettings(settings: FrescoSettings): void;
  setLook(look: FrescoLook): void;
  /** Width of the painted frame in CSS pixels (0 for none). */
  setFrame(width: number): void;
  /** Width of the painted frame in the canvas's own pixels. */
  readonly frame: number;
  /** How far the camera stands from what it looks at: strokes and lines are finer beyond it. */
  setFocus(distance: number): void;
  setTime(seconds: number): void;
  /** Renders the scene through the fresco to the screen, or into the composite target for gilding. */
  render(scene: Scene, camera: Camera, toComposite: boolean): void;
  /** The finished painting, when rendered into the composite target. */
  readonly composite: Texture;
  dispose(): void;
}

function pass(fragmentShader: string, uniforms: Record<string, IUniform>): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

function colourTarget(type: typeof HalfFloatType | typeof UnsignedByteType): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, { type, minFilter: LinearFilter, magFilter: LinearFilter });
}

export function createFrescoPass(renderer: WebGLRenderer): FrescoPass {
  const depthTexture = new DepthTexture(1, 1, FloatType);
  const sceneTarget = new WebGLRenderTarget(1, 1, { count: 2, type: HalfFloatType, depthTexture });
  const info = sceneTarget.textures[1];
  if (!info) throw new Error('The scene target has no info texture');
  info.minFilter = NearestFilter;
  info.magFilter = NearestFilter;
  const tensorA = colourTarget(HalfFloatType);
  const tensorB = colourTarget(HalfFloatType);
  const paint = colourTarget(HalfFloatType);
  const strokes = colourTarget(HalfFloatType);
  const softA = colourTarget(HalfFloatType);
  const softB = colourTarget(HalfFloatType);
  const composite = colourTarget(UnsignedByteType);

  const tensor = pass(TENSOR, {
    tColor: { value: sceneTarget.textures[0] },
    uTexel: { value: new Vector2() },
  });
  const blur = pass(BLUR, { tInput: { value: null }, uDirection: { value: new Vector2() } });
  const shrink = pass(SHRINK, {
    tInput: { value: strokes.texture },
    uTexel: { value: new Vector2() },
  });
  const kuwahara = pass(KUWAHARA, {
    tColor: { value: sceneTarget.textures[0] },
    tTensor: { value: tensorA.texture },
    uTexel: { value: new Vector2() },
    uRadius: { value: 5 },
  });
  const shared = {
    uNear: { value: 1 },
    uFar: { value: 4000 },
    uFocus: { value: 700 },
    uSeed: { value: 0.37 },
  };
  const strokeUniforms: Record<string, IUniform> = {
    tPaint: { value: paint.texture },
    tTensor: { value: tensorA.texture },
    tInfo: { value: info },
    tDepth: { value: depthTexture },
    uSize: { value: new Vector2() },
    uScale: { value: 1 },
    uLayers: { value: 2 },
    ...shared,
  };
  const brush = pass(STROKES, strokeUniforms);
  const compositeUniforms: Record<string, IUniform> = {
    tStrokes: { value: strokes.texture },
    tSoft: { value: softA.texture },
    tInfo: { value: info },
    tDepth: { value: depthTexture },
    uResolution: { value: new Vector2() },
    uPigments: { value: PIGMENT_LIST.map((hex) => new Color(hex)) },
    uPull: { value: 0.6 },
    uIntonaco: { value: new Color() },
    uPatina: { value: new Color() },
    uSinopia: { value: new Color() },
    uContour: { value: new Color() },
    uNight: { value: 0 },
    uFrame: { value: 0 },
    uLineWeight: { value: 1.2 },
    uPlaster: { value: 1 },
    ...shared,
  };
  const compositeMaterial = pass(COMPOSITE, compositeUniforms);

  const quadScene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), tensor);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let settings: FrescoSettings = { brush: 5, resolution: 1, strokeLayers: 2, plaster: 1 };
  let size = { width: 1, height: 1, ratio: 1 };
  let frame = 0;

  function draw(material: ShaderMaterial, target: WebGLRenderTarget | null): void {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  function blurInto(source: WebGLRenderTarget, spare: WebGLRenderTarget): void {
    const texel = new Vector2(1 / source.width, 1 / source.height);
    blur.uniforms.tInput = { value: source.texture };
    (blur.uniforms.uDirection as IUniform<Vector2>).value.set(texel.x, 0);
    draw(blur, spare);
    blur.uniforms.tInput = { value: spare.texture };
    (blur.uniforms.uDirection as IUniform<Vector2>).value.set(0, texel.y);
    draw(blur, source);
  }

  function applySize(): void {
    const w = Math.max(1, Math.round(size.width * size.ratio));
    const h = Math.max(1, Math.round(size.height * size.ratio));
    sceneTarget.setSize(w, h);
    const pw = Math.max(1, Math.round(w * settings.resolution));
    const ph = Math.max(1, Math.round(h * settings.resolution));
    for (const target of [tensorA, tensorB, paint, strokes]) target.setSize(pw, ph);
    const sw = Math.max(1, Math.round(pw / 4));
    const sh = Math.max(1, Math.round(ph / 4));
    softA.setSize(sw, sh);
    softB.setSize(sw, sh);
    composite.setSize(w, h);
    (tensor.uniforms.uTexel as IUniform<Vector2>).value.set(1 / w, 1 / h);
    (kuwahara.uniforms.uTexel as IUniform<Vector2>).value.set(1 / w, 1 / h);
    (shrink.uniforms.uTexel as IUniform<Vector2>).value.set(1 / pw, 1 / ph);
    (strokeUniforms.uSize as IUniform<Vector2>).value.set(pw, ph);
    // Strokes are sized for a picture 1,080 lines high and keep their size on the screen.
    (strokeUniforms.uScale as IUniform<number>).value = ph / 1080;
    (strokeUniforms.uLayers as IUniform<number>).value = settings.strokeLayers;
    (compositeUniforms.uResolution as IUniform<Vector2>).value.set(w, h);
    (compositeUniforms.uFrame as IUniform<number>).value = frame * size.ratio;
    (compositeUniforms.uLineWeight as IUniform<number>).value = Math.max(1, size.ratio * 1.15);
    (compositeUniforms.uPlaster as IUniform<number>).value = settings.plaster;
  }

  return {
    sceneTarget,
    info,
    composite: composite.texture,
    get frame() {
      return frame * size.ratio;
    },
    setSize(width, height, pixelRatio) {
      size = { width, height, ratio: pixelRatio };
      applySize();
    },
    setSettings(next) {
      settings = next;
      // Brush radius is measured on the full-resolution colour; a coarser pass samples it more widely.
      (kuwahara.uniforms.uRadius as IUniform<number>).value = next.brush;
      applySize();
    },
    setLook(look) {
      (compositeUniforms.uIntonaco as IUniform<Color>).value.copy(look.intonaco);
      (compositeUniforms.uPatina as IUniform<Color>).value.copy(look.patina);
      (compositeUniforms.uSinopia as IUniform<Color>).value.copy(look.sinopia);
      (compositeUniforms.uContour as IUniform<Color>).value.copy(look.contour);
      (compositeUniforms.uNight as IUniform<number>).value = look.night;
      (compositeUniforms.uPull as IUniform<number>).value = look.pull;
    },
    setFrame(width) {
      frame = width;
      applySize();
    },
    setFocus(distance) {
      shared.uFocus.value = distance;
    },
    setTime() {
      // The wall and its strokes stand still; only the world painted on it moves.
    },
    render(scene, camera, toComposite) {
      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      shared.uNear.value = (camera as Camera & { near?: number }).near ?? 1;
      shared.uFar.value = (camera as Camera & { far?: number }).far ?? 4000;
      // Flat mixtures.
      draw(tensor, tensorA);
      blurInto(tensorA, tensorB);
      draw(kuwahara, paint);
      // The brush, and a soft copy of it for the wet edges.
      draw(brush, strokes);
      draw(shrink, softA);
      blurInto(softA, softB);
      draw(compositeMaterial, toComposite ? composite : null);
    },
    dispose() {
      for (const target of [sceneTarget, tensorA, tensorB, paint, strokes, softA, softB, composite])
        target.dispose();
      for (const material of [tensor, blur, shrink, kuwahara, brush, compositeMaterial])
        material.dispose();
      quad.geometry.dispose();
    },
  };
}
