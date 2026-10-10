/**
 * Night light: the warm spill around every lit window, and the city's
 * fires (torches on the wall towers and gates, braziers on the temple).
 *
 * Only windows stand for people (one lit window per ten); the fires are
 * the city's own and burn whatever its size, so a small city at night is a
 * few households' lamps inside a ring of watch fires, never darkness.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
} from 'three';
import type { WindowSlot } from './layout.ts';
import type { ScenePalette } from './palette.ts';
import type { SharedUniforms } from './uniforms.ts';

export interface Lamps {
  group: Group;
  /** Window slots whose lamps are burning. */
  setLitWindows(slots: readonly number[]): void;
  setPalette(palette: ScenePalette): void;
}

function glowMaterial(
  shared: SharedUniforms,
  colour: Color,
  size: number,
  flicker: number,
): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: shared.uTime,
      uColour: { value: colour },
      uSize: { value: size },
      uFlicker: { value: flicker },
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      uniform float uFlicker;
      attribute float aSeed;
      varying float vFlame;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        float wobble = sin(uTime * 9.0 + aSeed * 31.0) * 0.5 + sin(uTime * 15.3 + aSeed * 17.0) * 0.5;
        vFlame = 1.0 - uFlicker * (0.25 + 0.25 * wobble);
        gl_PointSize = uSize * vFlame * (90.0 / max(-view.z, 1.0));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vFlame;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float halo = pow(max(0.0, 1.0 - d), 2.2);
        float core = smoothstep(0.22, 0.0, d);
        gl_FragColor = vec4(uColour * (halo * 0.42 + core * 1.6) * vFlame * uStrength, 1.0);
      }
    `,
  });
}

function pointsAt(positions: readonly { x: number; y: number; z: number }[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      positions.flatMap((p) => [p.x, p.y, p.z]),
      3,
    ),
  );
  geometry.setAttribute(
    'aSeed',
    new Float32BufferAttribute(
      positions.map((_, i) => (i * 0.618) % 1),
      1,
    ),
  );
  return geometry;
}

export function createLamps(
  windows: readonly WindowSlot[],
  fires: readonly { x: number; y: number; z: number }[],
  centre: { x: number; z: number },
  shared: SharedUniforms,
  palette: ScenePalette,
): Lamps {
  const group = new Group();
  group.name = 'lamps';
  // Halos sit a little in front of each window, so they light the wall and the lane below.
  const spill = windows.map((slot) => ({
    x: slot.x + Math.sin(slot.facing) * 0.35,
    y: slot.y - 0.1,
    z: slot.z + Math.cos(slot.facing) * 0.35,
  }));
  const windowGeometry = pointsAt(spill);
  windowGeometry.setDrawRange(0, 0);
  const windowColour = palette.windowLit.clone();
  const windowGlow = new Points(windowGeometry, glowMaterial(shared, windowColour, 120, 0.08));
  windowGlow.frustumCulled = false;
  group.add(windowGlow);

  const fireColour = new Color('#ff9a3c');
  const fireGlow = new Points(pointsAt(fires), glowMaterial(shared, fireColour, 44, 0.6));
  fireGlow.frustumCulled = false;
  group.add(fireGlow);

  // The city's own glow in the night haze: a soft dome over the roofs, as bright as its lamps are many.
  const domeGeometry = pointsAt([{ x: centre.x, y: 9, z: centre.z }]);
  const domeMaterial = glowMaterial(shared, palette.windowLit.clone(), 1400, 0);
  const dome = new Points(domeGeometry, domeMaterial);
  dome.frustumCulled = false;
  group.add(dome);

  const order = new Float32Array(spill.length * 3);
  return {
    group,
    setLitWindows(slots) {
      // Pack the lit windows' positions at the front of the buffer and draw only those.
      slots.forEach((slot, i) => {
        const p = spill[slot];
        if (p) order.set([p.x, p.y, p.z], i * 3);
      });
      windowGeometry.setAttribute(
        'position',
        new Float32BufferAttribute(order.slice(0, Math.max(3, slots.length * 3)), 3),
      );
      windowGeometry.setDrawRange(0, slots.length);
      // Faint even for a hamlet, never brighter than a full city.
      (domeMaterial.uniforms.uStrength as { value: number }).value =
        0.04 + Math.min(1, slots.length / 60) * 0.12;
    },
    setPalette(next) {
      group.visible = next.appearance === 'dark';
      windowColour.copy(next.windowLit);
    },
  };
}
