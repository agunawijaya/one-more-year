/**
 * GLSL shared by the scene's shaders: hashing and value noise, and the sky
 * colour function, which the sky dome and the river's reflections both use
 * so that the water always mirrors the sky it sits under.
 */

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    total += amplitude * valueNoise(p);
    p = p * 2.03 + vec2(17.1, 9.4);
    amplitude *= 0.5;
  }
  return total;
}
`;

/** Uniforms the sky function needs; the scene shares one set between materials. */
export const SKY_UNIFORMS_GLSL = /* glsl */ `
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uKeyDirection;
uniform vec3 uDiscColor;
uniform float uDiscSize;
uniform float uStars;
`;

export const SKY_GLSL = /* glsl */ `
vec3 skyColour(vec3 direction, bool withDisc) {
  vec3 d = normalize(direction);
  float elevation = clamp(d.y, -0.2, 1.0);
  float toward = pow(clamp(1.0 - elevation, 0.0, 1.0), 3.2);
  vec3 colour = mix(uSkyZenith, uSkyHorizon, toward);
  float facing = max(dot(d, uKeyDirection), 0.0);
  // A wide warm haze around the sun (or a cool halo around the moon).
  colour += uDiscColor * pow(facing, mix(18.0, 90.0, uStars)) * mix(0.32, 0.1, uStars);
  colour += uDiscColor * pow(facing, 600.0) * mix(0.6, 0.3, uStars);
  if (withDisc) {
    float disc = smoothstep(1.0 - uDiscSize * uDiscSize * 0.5, 1.0 - uDiscSize * uDiscSize * 0.42, facing);
    colour = mix(colour, uDiscColor * mix(2.4, 1.5, uStars), disc);
  }
  if (uStars > 0.0 && d.y > 0.0) {
    // Stars: a fine grid of cells, one candidate star per cell, drawn as a tiny soft point.
    vec2 grid = vec2(atan(d.z, d.x) * 520.0, asin(clamp(d.y, -1.0, 1.0)) * 520.0);
    vec2 cell = floor(grid);
    vec2 inCell = fract(grid) - 0.5;
    float pick = hash12(cell);
    vec2 offset = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5;
    float point = smoothstep(0.2, 0.0, length(inCell - offset * 0.6));
    float bright = step(0.99, pick) * (0.6 + 0.9 * hash12(cell + 11.0)) + step(0.9992, pick) * 2.4;
    colour += vec3(0.88, 0.92, 1.0) * point * bright * smoothstep(0.03, 0.3, d.y) * uStars;
  }
  return colour;
}
`;
