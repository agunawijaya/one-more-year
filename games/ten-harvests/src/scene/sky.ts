/**
 * The sky dome: a warm noon haze or an indigo night with stars and a low
 * moon. Drawn as the inside of a large sphere that follows the camera.
 */
import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { NOISE_GLSL, SKY_GLSL, SKY_UNIFORMS_GLSL } from './glsl.ts';
import type { SharedUniforms } from './uniforms.ts';

export function createSky(uniforms: SharedUniforms): Mesh {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uSkyZenith: uniforms.uSkyZenith,
      uSkyHorizon: uniforms.uSkyHorizon,
      uKeyDirection: uniforms.uKeyDirection,
      uDiscColor: uniforms.uDiscColor,
      uDiscSize: uniforms.uDiscSize,
      uStars: uniforms.uStars,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${SKY_GLSL}
      varying vec3 vDirection;
      void main() {
        gl_FragColor = vec4(skyColour(vDirection, true), 1.0);
      }
    `,
  });
  const sky = new Mesh(new SphereGeometry(900, 48, 24), material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}
