/**
 * Uniforms shared by every custom material in the city: time, wind, the
 * sky and the fog. One object, updated once a frame and once per change of
 * appearance, so the sky, the water and the wheat always agree.
 */
import { Color, Vector2, Vector3 } from 'three';
import type { ScenePalette } from './palette.ts';

export interface SharedUniforms {
  uTime: { value: number };
  uWind: { value: Vector2 };
  /** 0 calm (reduced motion) to 1 a lively breeze. */
  uGust: { value: number };
  uSkyZenith: { value: Color };
  uSkyHorizon: { value: Color };
  uKeyDirection: { value: Vector3 };
  uKeyColor: { value: Color };
  uDiscColor: { value: Color };
  uDiscSize: { value: number };
  uStars: { value: number };
  uHemiSky: { value: Color };
  uHemiGround: { value: Color };
  uFogColor: { value: Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
  /** 1 at night: lamps, silver wheat, the moon path. */
  uNight: { value: number };
}

export function createSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uWind: { value: new Vector2(0.86, 0.5).normalize() },
    uGust: { value: 1 },
    uSkyZenith: { value: new Color() },
    uSkyHorizon: { value: new Color() },
    uKeyDirection: { value: new Vector3(0, 1, 0) },
    uKeyColor: { value: new Color() },
    uDiscColor: { value: new Color() },
    uDiscSize: { value: 0.03 },
    uStars: { value: 0 },
    uHemiSky: { value: new Color() },
    uHemiGround: { value: new Color() },
    uFogColor: { value: new Color() },
    uFogNear: { value: 100 },
    uFogFar: { value: 600 },
    uNight: { value: 0 },
  };
}

export function applyPalette(uniforms: SharedUniforms, palette: ScenePalette): void {
  uniforms.uSkyZenith.value.copy(palette.skyZenith);
  uniforms.uSkyHorizon.value.copy(palette.skyHorizon);
  uniforms.uKeyDirection.value.copy(palette.keyDirection);
  uniforms.uKeyColor.value.copy(palette.keyColor).multiplyScalar(palette.keyIntensity / 3);
  uniforms.uDiscColor.value.copy(palette.discColor);
  uniforms.uDiscSize.value = palette.discSize;
  uniforms.uStars.value = palette.stars;
  uniforms.uHemiSky.value.copy(palette.hemiSky).multiplyScalar(palette.hemiIntensity * 0.5);
  uniforms.uHemiGround.value.copy(palette.hemiGround).multiplyScalar(palette.hemiIntensity * 0.5);
  uniforms.uFogColor.value.copy(palette.fog);
  uniforms.uFogNear.value = palette.fogNear;
  uniforms.uFogFar.value = palette.fogFar;
  uniforms.uNight.value = palette.appearance === 'dark' ? 1 : 0;
}

/** Linear fog matching three's own, for the custom shaders. */
export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
vec3 applyFog(vec3 colour, float depth) {
  float amount = smoothstep(uFogNear, uFogFar, depth);
  return mix(colour, uFogColor, amount);
}
`;
