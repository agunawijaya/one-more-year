/**
 * The cinematic's moving matter, all as GPU points driven by one time value
 * so the whole year can be scrubbed back and forth:
 *
 * - the grain river: every particle leaves a parcel as the harvest sweeps
 *   it and arcs into the granary's chute;
 * - seed: golden arcs thrown from the field banks onto the sown parcels;
 * - rats: a playful scurry (not a horde) over the granary roof;
 * - the fever haze: a slow violet drift through the lanes.
 *
 * Each system is a static buffer of per-particle parameters; the vertex
 * shader computes positions from uTime, so playing or seeking costs no
 * JavaScript per particle.
 */
import type { Color } from 'three';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  ShaderMaterial,
} from 'three';
import { createRng } from '@one-more-year/kit';
import type { Parcel } from './layout.ts';

export interface ParticleSystem {
  points: Points;
  /** Seconds into this system's own timeline. */
  setTime(time: number): void;
  setStrength(strength: number): void;
  dispose(): void;
}

interface Target {
  x: number;
  y: number;
  z: number;
}

/**
 * The harvest's grain. Each particle leaves its parcel as the sweep cuts it,
 * runs low along the ground toward a confluence by the granary ramp (the
 * streams from every field gather there like tributaries), then rises in
 * one tight arc into the chute.
 */
export function grainRiver(
  parcels: readonly Parcel[],
  cutTimeOf: (parcel: Parcel) => number,
  confluence: Target,
  chute: Target,
  colour: Color,
  perParcel: number,
  /** Brightness: lower by night, when bloom already makes the river blaze. */
  gain = 1,
): ParticleSystem {
  const rng = createRng('ten-harvests:grain-river');
  const starts: number[] = [];
  const params: number[] = [];
  const lanes: number[] = [];
  for (const parcel of parcels) {
    const cut = cutTimeOf(parcel);
    for (let i = 0; i < perParcel; i++) {
      starts.push(
        parcel.x + rng.float(-0.45, 0.45) * parcel.width,
        0.4,
        parcel.z + rng.float(-0.45, 0.45) * parcel.depth,
      );
      // Emission time, flight time, lane offset across the stream, sparkle seed.
      params.push(cut + rng.float(0, 0.4), rng.float(1.1, 1.6), rng.normal(0, 0.35), rng.next());
      lanes.push(rng.float(0.45, 0.6));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(starts, 3));
  geometry.setAttribute('aParams', new Float32BufferAttribute(params, 4));
  geometry.setAttribute('aSplit', new Float32BufferAttribute(lanes, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uConfluence: { value: [confluence.x, confluence.y, confluence.z] },
      uTarget: { value: [chute.x, chute.y, chute.z] },
      uColour: { value: colour.clone() },
      uStrength: { value: 1 },
      uGain: { value: gain },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uConfluence;
      uniform vec3 uTarget;
      attribute vec4 aParams;
      attribute float aSplit;
      varying float vAlpha;
      varying float vSpark;
      void main() {
        float t = (uTime - aParams.x) / aParams.y;
        vAlpha = step(0.0, t) * step(t, 1.0);
        t = clamp(t, 0.0, 1.0);
        vec3 p;
        if (t < aSplit) {
          // Along the ground: tributaries narrowing toward the confluence.
          float u = t / aSplit;
          float e = u * u * (3.0 - 2.0 * u);
          p = mix(position, uConfluence, e);
          p.y = 0.5 + sin(u * 3.14159) * 0.9 + abs(aParams.z) * 0.3;
          vec3 across = normalize(cross(uConfluence - position, vec3(0.0, 1.0, 0.0)) + 1e-4);
          p += across * aParams.z * (0.6 + (1.0 - e) * 1.4);
        } else {
          // Up into the granary in one tight arc.
          float u = (t - aSplit) / (1.0 - aSplit);
          p = mix(uConfluence, uTarget, u);
          p.y += sin(u * 3.14159) * 9.0;
          // The stream keeps some width as it climbs, narrowing into the chute.
          float width = 1.3 * (1.0 - u * 0.75);
          p.x += aParams.z * width;
          p.z += aParams.z * width * 0.6 + sin(aParams.w * 50.0) * 0.3 * (1.0 - u);
          p.y += cos(aParams.w * 37.0) * 0.4 * (1.0 - u);
        }
        vSpark = aParams.w;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        // Grains are small while they trickle off the fields and swell as they join the river.
        float gathered = smoothstep(0.25, aSplit, t);
        gl_PointSize = (0.8 + gathered * 1.6 + aParams.w * 1.2) * (150.0 / max(-view.z, 1.0));
        vAlpha *= mix(0.45, 1.0, gathered);
        vAlpha *= smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.94, 1.0, t));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      uniform float uGain;
      varying float vAlpha;
      varying float vSpark;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float grain = smoothstep(1.0, 0.0, d);
        grain *= grain;
        // Most grains are warm gold; one in ten catches the light.
        vec3 tone = mix(uColour * vec3(1.0, 0.82, 0.55), uColour * 1.6, step(0.9, vSpark));
        gl_FragColor = vec4(tone * grain * vAlpha * uStrength * 0.85 * uGain, 1.0);
      }
    `,
  });
  return finish(geometry, material, 'grain-river');
}

/** Seed thrown from the banks: short golden arcs falling onto the sown parcels. */
export function seedArcs(
  parcels: readonly Parcel[],
  colour: Color,
  perParcel: number,
  span: number,
): ParticleSystem {
  const rng = createRng('ten-harvests:seed');
  const ends: number[] = [];
  const params: number[] = [];
  for (const parcel of parcels) {
    for (let i = 0; i < perParcel; i++) {
      ends.push(
        parcel.x + rng.float(-0.5, 0.5) * parcel.width,
        0.1,
        parcel.z + rng.float(-0.5, 0.5) * parcel.depth,
      );
      params.push(rng.float(0, span), rng.float(0.5, 0.9), rng.float(-3, 3), rng.float(1.2, 2.4));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(ends, 3));
  geometry.setAttribute('aParams', new Float32BufferAttribute(params, 4));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColour: { value: colour.clone() }, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aParams;
      varying float vAlpha;
      void main() {
        float t = clamp((uTime - aParams.x) / aParams.y, 0.0, 1.0);
        vAlpha = step(aParams.x, uTime) * (1.0 - step(1.0, (uTime - aParams.x) / aParams.y));
        vec3 from = position + vec3(aParams.z, 0.0, 2.5);
        vec3 p = mix(from, position, t);
        p.y = 1.6 + sin(t * 3.14159) * aParams.w - t * 1.5;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 1.4 * (160.0 / max(-view.z, 1.0));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(uColour * smoothstep(1.0, 0.2, d) * vAlpha * uStrength * 1.4, 1.0);
      }
    `,
  });
  return finish(geometry, material, 'seed');
}

/**
 * Rats: a small, quick swarm that pours over the granary roof and down
 * inside. Each rat follows a looping path with its own phase, so they move
 * like a flock without any simulation.
 */
export function ratSwarm(
  granary: { x: number; z: number; width: number; depth: number; height: number },
  count: number,
  colour: Color,
): ParticleSystem {
  const rng = createRng('ten-harvests:rats');
  const positions: number[] = [];
  const params: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(granary.x, 0, granary.z);
    params.push(rng.float(0, 0.7), rng.float(1.1, 1.7), rng.float(-1, 1), rng.next());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aParams', new Float32BufferAttribute(params, 4));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uColour: { value: colour.clone() },
      uStrength: { value: 1 },
      uSize: { value: [granary.width, granary.height, granary.depth] },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSize;
      attribute vec4 aParams;
      varying float vAlpha;
      void main() {
        float t = clamp((uTime - aParams.x) / aParams.y, 0.0, 1.0);
        // Across the open ground in front, up over the low front wall, down onto the heaps.
        vec3 start = position + vec3(aParams.z * uSize.x * 0.7, 0.15, uSize.z * 0.5 + 5.0 + aParams.w * 5.0);
        vec3 wall = position + vec3(aParams.z * uSize.x * 0.42, uSize.y * 0.42, uSize.z * 0.5);
        vec3 inside = position + vec3(aParams.z * uSize.x * 0.38, uSize.y * 0.3, uSize.z * (0.1 + 0.25 * aParams.w));
        vec3 p = t < 0.7 ? mix(start, wall, t / 0.7) : mix(wall, inside, (t - 0.7) / 0.3);
        // A scurry: quick side-to-side as they run.
        p.x += sin(uTime * 16.0 + aParams.w * 30.0) * 0.22;
        vAlpha = step(aParams.x, uTime) * (1.0 - smoothstep(0.9, 1.0, t));
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 3.0 * (220.0 / max(-view.z, 1.0));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        // A little oval body with a tail: readable as a rat, never gruesome.
        float body = smoothstep(0.32, 0.26, length(c * vec2(1.0, 1.6)));
        float tail = smoothstep(0.05, 0.0, abs(c.y + 0.02)) * step(0.22, c.x) * step(c.x, 0.48);
        float shape = max(body, tail);
        if (shape * vAlpha * uStrength < 0.1) discard;
        gl_FragColor = vec4(uColour, shape * vAlpha * uStrength);
      }
    `,
  });
  return finish(geometry, material, 'rats');
}

/** The fever: a slow violet haze drifting through the lanes. */
export function feverHaze(
  centre: { x: number; z: number },
  radii: { x: number; z: number },
  colour: Color,
): ParticleSystem {
  const rng = createRng('ten-harvests:fever');
  const positions: number[] = [];
  const params: number[] = [];
  for (let i = 0; i < 220; i++) {
    const angle = rng.float(0, Math.PI * 2);
    const radius = Math.sqrt(rng.next());
    positions.push(
      centre.x + Math.cos(angle) * radii.x * radius,
      rng.float(0.5, 4),
      centre.z + Math.sin(angle) * radii.z * radius,
    );
    params.push(rng.next(), rng.float(10, 26), rng.float(0.2, 0.6), rng.next());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aParams', new Float32BufferAttribute(params, 4));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { uTime: { value: 0 }, uColour: { value: colour.clone() }, uStrength: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aParams;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * aParams.z + aParams.w * 6.28) * 3.0 + uTime * 1.5;
        p.z += cos(uTime * aParams.z * 0.7 + aParams.w * 6.28) * 2.0;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aParams.y * (90.0 / max(-view.z, 1.0));
        vAlpha = 0.35 + 0.25 * sin(uTime * 0.8 + aParams.x * 6.28);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float puff = pow(max(0.0, 1.0 - d), 2.0);
        gl_FragColor = vec4(uColour, puff * vAlpha * uStrength * 0.55);
      }
    `,
  });
  return finish(geometry, material, 'fever-haze');
}

function finish(geometry: BufferGeometry, material: ShaderMaterial, name: string): ParticleSystem {
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.name = name;
  points.renderOrder = 3;
  return {
    points,
    setTime(time) {
      (material.uniforms.uTime as { value: number }).value = time;
    },
    setStrength(strength) {
      (material.uniforms.uStrength as { value: number }).value = strength;
      points.visible = strength > 0.001;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
