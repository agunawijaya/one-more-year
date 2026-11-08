/**
 * Shared GLSL: hashes and value noise for pigment, plaster and brushwork,
 * written once and pasted into every shader that needs them. No textures
 * are loaded: every grain of plaster and every streak of pigment comes from
 * these functions.
 */

export const NOISE = /* glsl */ `
float cfHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 cfHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float cfHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float cfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = cfHash12(i);
  float b = cfHash12(i + vec2(1.0, 0.0));
  float c = cfHash12(i + vec2(0.0, 1.0));
  float d = cfHash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float cfFbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * cfNoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amp *= 0.5;
  }
  return sum;
}

// Distance to the nearest edge between Voronoi cells, and the cell's own id.
vec2 cfVoronoiEdge(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  vec2 nearest = vec2(0.0);
  vec2 nearestCell = vec2(0.0);
  float best = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = cfHash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < best) { best = d; nearest = r; nearestCell = n + g; }
    }
  }
  float edge = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = cfHash22(n + g);
      vec2 r = g + o - f;
      if (dot(nearest - r, nearest - r) > 0.00001) {
        edge = min(edge, dot(0.5 * (nearest + r), normalize(r - nearest)));
      }
    }
  }
  return vec2(edge, cfHash12(nearestCell));
}
`;

/** Lightness in the eye's weighting, for the bands of modelling. */
export const LUMA = /* glsl */ `
float cfLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/**
 * What every painted surface's world is drawn into: the normal and a class with an id.
 *
 * The info target's alpha holds a class (the whole number) and an object id (the fraction): 0
 * architecture (what the coronation gilds), 1 painted things that keep their colour (people,
 * trees, awnings, banners' cloth), 2 the land and the water, 3 the sky. The contours look for a
 * change of id; the brushwork and the gold look at the class.
 */
export const INFO_CLASS = {
  architecture: 0,
  painted: 1,
  land: 2,
  sky: 3,
} as const;

/**
 * Painted light (needs LUMA): a fresco painter models a form with three or four mixtures of one
 * pigment, not a smooth ramp; the lights lean warm toward lime white and the shade cool toward
 * a blue-grey earth. By night the whole world sinks toward `nightTint`, and the lamps bring it back.
 */
export const PAINTED_LIGHT = /* glsl */ `
vec3 cfPaintedLight(vec3 albedo, vec3 lit, vec3 coolShade, vec3 warmLight, float night, vec3 nightTint) {
  float light = cfLuma(lit) / max(cfLuma(albedo), 0.03) / mix(1.0, 0.45, night);
  float t = clamp((light - 0.3) / 0.95, 0.0, 1.0);
  float banded = (floor(t * 4.0) + smoothstep(0.3, 0.7, fract(t * 4.0))) / 4.0;
  t = mix(t, banded, 0.75);
  vec3 shade = mix(albedo * 0.5, coolShade, 0.32);
  vec3 lights = mix(albedo * 1.04, warmLight, 0.1);
  vec3 colour = mix(shade, lights, t);
  colour = mix(colour, warmLight, smoothstep(1.15, 1.8, light) * 0.16);
  return colour * mix(vec3(1.0), nightTint, night);
}
`;
