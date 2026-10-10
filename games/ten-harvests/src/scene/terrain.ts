/**
 * The land itself: the floodplain (dark silt near the river fading to pale
 * desert sand), the roads, and a ring of low hills on the horizon. The
 * ground uses three's standard material, extended with a procedural colour,
 * so building and palm shadows fall on it.
 */
import type { Color } from 'three';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { NOISE_GLSL } from './glsl.ts';
import { CITY_CENTRE, CITY_RADII, RIVER_WIDTH, riverZ, type Point2 } from './layout.ts';
import type { ScenePalette } from './palette.ts';

export interface Terrain {
  group: Group;
  setPalette(palette: ScenePalette): void;
}

interface GroundUniforms {
  uSand: { value: Color };
  uSilt: { value: Color };
  uWetBank: { value: Color };
  uGrass: { value: Color };
}

/** The river's course as GLSL, mirroring layout.riverZ exactly. */
export const RIVER_Z_GLSL = /* glsl */ `
float riverZ(float x) {
  return -66.0 + 7.0 * sin(x * 0.019 + 0.6) + 3.5 * sin(x * 0.051 + 1.7);
}
`;

export function createTerrain(roads: readonly Point2[][], palette: ScenePalette): Terrain {
  const group = new Group();
  group.name = 'terrain';
  const groundUniforms: GroundUniforms = {
    uSand: { value: palette.sand.clone() },
    uSilt: { value: palette.silt.clone() },
    uWetBank: { value: palette.wetBank.clone() },
    uGrass: { value: palette.grass.clone() },
  };

  const groundGeometry = new PlaneGeometry(1800, 1800, 1, 1);
  groundGeometry.rotateX(-Math.PI / 2);
  const ground = new Mesh(groundGeometry, groundMaterial(groundUniforms));
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  const roadMaterial = new MeshStandardMaterial({
    color: palette.road,
    roughness: 1,
    transparent: true,
    opacity: 0.75,
  });
  for (const road of roads) {
    const mesh = new Mesh(ribbon(road, 3.2, 0.03), roadMaterial);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const hills = new Mesh(
    hillRing(),
    new MeshStandardMaterial({ color: palette.sand, roughness: 1 }),
  );
  hills.name = 'hills';
  group.add(hills);

  return {
    group,
    setPalette(next) {
      groundUniforms.uSand.value.copy(next.sand);
      groundUniforms.uSilt.value.copy(next.silt);
      groundUniforms.uWetBank.value.copy(next.wetBank);
      groundUniforms.uGrass.value.copy(next.grass);
      roadMaterial.color.copy(next.road);
      hills.material.color.copy(next.sand).lerp(next.fog, 0.55);
    },
  };
}

function groundMaterial(uniforms: GroundUniforms): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundPosition;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vGroundPosition;
        uniform vec3 uSand;
        uniform vec3 uSilt;
        uniform vec3 uWetBank;
        uniform vec3 uGrass;
        ${NOISE_GLSL}
        ${RIVER_Z_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vGroundPosition.xz;
          float across = abs(p.y - riverZ(p.x));
          float halfWidth = ${(RIVER_WIDTH / 2).toFixed(1)};
          // The floodplain: dark silt within reach of the water, pale sand beyond.
          float plain = smoothstep(175.0, 55.0, across + (fbm(p * 0.011) - 0.5) * 90.0);
          vec3 colour = mix(uSand, uSilt, plain);
          // Scrub and grass in patches where the flood reaches.
          float patches = smoothstep(0.5, 0.78, fbm(p * 0.07 + 3.1));
          colour = mix(colour, uGrass, patches * plain * 0.7);
          // Sun-baked silt and rippled dunes give the ground a grain up close.
          colour *= 0.93 + 0.09 * valueNoise(p * vec2(0.05, 0.12)) + 0.06 * fbm(p * 0.45);
          // Inside the walls the earth is trodden hard and darker.
          vec2 city = (p - vec2(${CITY_CENTRE.x.toFixed(1)}, ${CITY_CENTRE.z.toFixed(1)})) / vec2(${(CITY_RADII.x + 4).toFixed(1)}, ${(CITY_RADII.z + 3).toFixed(1)});
          float inside = smoothstep(1.05, 0.9, length(city));
          colour = mix(colour, uSilt * vec3(1.08, 0.94, 0.86) * (0.9 + 0.12 * valueNoise(p * 1.4)), inside * 0.75);
          float wet = smoothstep(halfWidth + 6.0, halfWidth + 0.5, across);
          colour = mix(colour, uWetBank, wet);
          diffuseColor.rgb = colour;
        }`,
      );
  };
  return material;
}

/** A flat strip following a path, lifted slightly above the ground. */
export function ribbon(path: readonly Point2[], width: number, lift: number): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let travelled = 0;
  path.forEach((point, i) => {
    const prev = path[Math.max(0, i - 1)] as Point2;
    const next = path[Math.min(path.length - 1, i + 1)] as Point2;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    if (i > 0) travelled += Math.hypot(point.x - prev.x, point.z - prev.z);
    positions.push(point.x + nx * width * 0.5, lift, point.z + nz * width * 0.5);
    positions.push(point.x - nx * width * 0.5, lift, point.z - nz * width * 0.5);
    uvs.push(travelled, 0, travelled, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Low, worn hills on the horizon, kept clear of the river's valley. */
function hillRing(): BufferGeometry {
  const segments = 160;
  const rings = 4;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const radius = 560 + ring * 70;
    for (let s = 0; s <= segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const valley = Math.min(1, Math.abs(z - riverZ(x)) / 120);
      const ridge =
        Math.sin(angle * 7) * 0.5 + Math.sin(angle * 17 + 1.3) * 0.3 + Math.sin(angle * 41) * 0.15;
      const height = ring === 0 || ring === rings ? 0 : (8 + 10 * ridge + ring * 5) * valley;
      positions.push(x, Math.max(0, height), z);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let s = 0; s < segments; s++) {
      const a = ring * (segments + 1) + s;
      const b = a + segments + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
