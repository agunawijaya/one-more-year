/**
 * Shared surface materials: sun-dried mud brick (with faint courses and
 * weathering worked in from world position), glazed lapis, gold leaf, linen.
 * They extend three's standard material so they take the sun's shadows.
 */
import type { Color } from 'three';
import { MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { NOISE_GLSL } from './glsl.ts';

const WORLD_VARYINGS_VERTEX = /* glsl */ `
  {
    vec4 surfaceWorld = vec4(transformed, 1.0);
    vec3 surfaceNormal = objectNormal;
    #ifdef USE_INSTANCING
      surfaceWorld = instanceMatrix * surfaceWorld;
      surfaceNormal = mat3(instanceMatrix) * surfaceNormal;
    #endif
    vSurfaceWorld = (modelMatrix * surfaceWorld).xyz;
    vSurfaceNormal = normalize(mat3(modelMatrix) * surfaceNormal);
  }
`;

/** Adds world position and world normal varyings to a standard material's shaders. */
function withWorldVaryings(shader: WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vSurfaceWorld;\nvarying vec3 vSurfaceNormal;',
    )
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${WORLD_VARYINGS_VERTEX}`);
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>\nvarying vec3 vSurfaceWorld;\nvarying vec3 vSurfaceNormal;\n${NOISE_GLSL}`,
  );
}

/**
 * Mud brick: per-instance tone (instance colour) times a weathered surface.
 * Roofs, which bake in the sun, come out a little paler than walls.
 */
export function brickMaterial(
  base: Color,
  options: { courses?: boolean } = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: base, roughness: 0.96, metalness: 0 });
  const courses = options.courses ?? true;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    withWorldVaryings(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float roof = smoothstep(0.7, 0.95, vSurfaceNormal.y);
        // Coordinates across the wall: along whichever horizontal axis the wall faces away from.
        float along = abs(vSurfaceNormal.x) > abs(vSurfaceNormal.z) ? vSurfaceWorld.z : vSurfaceWorld.x;
        vec2 brickUv = vec2(along * 2.2, vSurfaceWorld.y * 4.6);
        float row = floor(brickUv.y);
        brickUv.x += mod(row, 2.0) * 0.5;
        vec2 cell = floor(brickUv);
        vec2 inBrick = fract(brickUv);
        float tone = hash12(cell);
        float grain = valueNoise(vSurfaceWorld.xz * 2.7 + vSurfaceWorld.y * 1.3);
        float stains = fbm(vSurfaceWorld.xz * 0.35 + vec2(vSurfaceWorld.y * 0.6));
        vec3 surface = diffuseColor.rgb * (0.9 + 0.12 * grain) * (0.92 + 0.12 * stains);
        ${
          courses
            ? `float joint = max(smoothstep(0.9, 0.98, inBrick.y), smoothstep(0.94, 0.995, inBrick.x));
               surface *= (0.95 + 0.1 * tone) * (1.0 - joint * 0.16 * (1.0 - roof));`
            : ''
        }
        // Rain and dust darken the foot of every wall.
        surface *= mix(0.84, 1.0, smoothstep(0.0, 0.9, vSurfaceWorld.y));
        surface = mix(surface, surface * 1.12 + 0.015, roof);
        diffuseColor.rgb = surface;
      }`,
    );
  };
  return material;
}

/** Grain: warm, granular, with tiny highlights that sparkle in the sun. */
export function grainMaterial(base: Color): MeshStandardMaterial {
  // A little light of its own, so the heap reads as gold even in the vault's shade.
  const material = new MeshStandardMaterial({
    color: base,
    roughness: 0.82,
    metalness: 0,
    emissive: base.clone().multiplyScalar(0.22),
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    withWorldVaryings(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float speck = valueNoise(vSurfaceWorld.xz * 14.0);
        float ripple = fbm(vSurfaceWorld.xz * 1.3);
        diffuseColor.rgb *= 0.82 + 0.22 * speck + 0.14 * ripple;
      }`,
    );
  };
  return material;
}

export function plainMaterial(colour: Color, roughness = 0.9): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: colour, roughness, metalness: 0 });
}

/** Glazed brick: smoother, with a faint sheen, used for the temple's lapis band. */
export function glazeMaterial(colour: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: colour, roughness: 0.38, metalness: 0.05 });
}

export function goldMaterial(colour: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: colour, roughness: 0.3, metalness: 0.85 });
}
