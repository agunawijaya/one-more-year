/**
 * Date palms: a ringed, slightly curved trunk and a crown of drooping
 * fronds, built once as a mesh and instanced along the banks, the canals
 * and around the city. The crowns sway with the same wind as the wheat.
 *
 * The geometry carries three small attributes instead of colours, so the
 * palette can recolour every palm at once: `aFrond` (1 on leaves), `aShade`
 * (rings on the trunk, a paler midrib on the fronds) and `aSway` (how far
 * a vertex moves in the wind).
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityLayout } from './layout.ts';
import type { ScenePalette } from './palette.ts';
import type { SharedUniforms } from './uniforms.ts';

export interface Palms {
  mesh: InstancedMesh;
  setPalette(palette: ScenePalette): void;
}

const TRUNK_HEIGHT = 7.5;
const CROWN = { x: 0.9, y: TRUNK_HEIGHT };

function withAttributes(
  positions: number[],
  indices: number[],
  frond: number,
  shades: number[],
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'aFrond',
    new Float32BufferAttribute(new Array<number>(positions.length / 3).fill(frond), 1),
  );
  geometry.setAttribute('aShade', new Float32BufferAttribute(shades, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A tapering trunk with a gentle curve; every other ring is darker. */
function trunk(): BufferGeometry {
  const rings = 14;
  const sides = 7;
  const positions: number[] = [];
  const shades: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const radius = 0.34 * (1 - t * 0.38);
    const bend = Math.sin(t * Math.PI * 0.5) * CROWN.x;
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * radius + bend, t * TRUNK_HEIGHT, Math.sin(a) * radius);
      shades.push(r % 2 === 0 ? 0.78 : 1);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * (sides + 1) + s;
      const b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return withAttributes(positions, indices, 0, shades);
}

/** One frond: it rises from the crown, then droops, its edge notched like leaflets. */
function frond(angle: number, lift: number, length: number): BufferGeometry {
  const steps = 12;
  const positions: number[] = [];
  const shades: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const reach = t * length;
    const height = Math.sin(t * Math.PI * 0.9) * lift - t * t * length * 0.55;
    const width = Math.sin(t * Math.PI) * 0.55 * (i % 2 === 0 ? 1 : 0.55);
    const cx = CROWN.x + Math.cos(angle) * reach;
    const cz = Math.sin(angle) * reach;
    const px = -Math.sin(angle) * width;
    const pz = Math.cos(angle) * width;
    positions.push(cx - px, CROWN.y + height - width * 0.25, cz - pz);
    positions.push(cx, CROWN.y + height + 0.05, cz);
    positions.push(cx + px, CROWN.y + height - width * 0.25, cz + pz);
    const shade = 0.72 + t * 0.32;
    shades.push(shade, shade * 1.12, shade);
    if (i > 0) {
      const a = (i - 1) * 3;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  return withAttributes(positions, indices, 1, shades);
}

function palmGeometry(): BufferGeometry {
  const parts = [trunk()];
  // Two whorls: younger fronds reaching up, older ones drooping below them.
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.19;
    const young = i % 2 === 0;
    parts.push(
      frond(angle, young ? 1.6 + (i % 3) * 0.25 : 0.7, young ? 3.3 + (i % 4) * 0.25 : 3.9),
    );
  }
  const merged = mergeGeometries(parts);
  const position = merged.getAttribute('position');
  const sway = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++)
    sway[i] = Math.pow(position.getY(i) / (TRUNK_HEIGHT + 1.5), 2);
  merged.setAttribute('aSway', new BufferAttribute(sway, 1));
  return merged;
}

export function createPalms(
  layout: CityLayout,
  shared: SharedUniforms,
  palette: ScenePalette,
): Palms {
  const material = new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide });
  const leaf = { value: palette.palmLeaf.clone() };
  const bark = { value: palette.palmTrunk.clone() };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, {
      uTime: shared.uTime,
      uWind: shared.uWind,
      uGust: shared.uGust,
      uLeaf: leaf,
      uBark: bark,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec2 uWind;
        uniform float uGust;
        attribute float aSway;
        attribute float aFrond;
        attribute float aShade;
        varying float vFrond;
        varying float vShade;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFrond = aFrond;
        vShade = aShade;
        {
          float phase = 0.0;
          #ifdef USE_INSTANCING
            phase = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
          #endif
          float swing = sin(uTime * 1.1 + phase) * 0.5 + sin(uTime * 2.3 + phase * 1.7) * 0.25;
          transformed.xz += uWind * (0.35 + swing * 0.5) * aSway * 0.9 * uGust;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uLeaf;
        uniform vec3 uBark;
        varying float vFrond;
        varying float vShade;`,
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(uBark, uLeaf, vFrond) * vShade;',
      );
  };

  const mesh = new InstancedMesh(palmGeometry(), material, layout.palms.length);
  const dummy = new Object3D();
  layout.palms.forEach((palm, i) => {
    dummy.position.set(palm.x, 0, palm.z);
    dummy.rotation.set(palm.lean * 0.3, palm.turn, palm.lean);
    dummy.scale.setScalar(palm.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'palms';
  return {
    mesh,
    setPalette(next) {
      leaf.value.copy(next.palmLeaf);
      bark.value.copy(next.palmTrunk);
    },
  };
}
