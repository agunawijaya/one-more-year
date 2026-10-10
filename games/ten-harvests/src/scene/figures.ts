/**
 * People, by day: one small figure for every ten people, walking the city's
 * lanes and working along the field banks. And the newcomers: a procession
 * along the river road, each newcomer carrying a lantern after dark.
 *
 * Figures move on fixed routes as a pure function of time, so the scene
 * looks the same in every screenshot taken at the same moment.
 */
import type { Color } from 'three';
import {
  AdditiveBlending,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '@one-more-year/kit';
import { figuresForPeople, type CityLayout, type Parcel, type Point2 } from './layout.ts';
import type { ScenePalette } from './palette.ts';

export const MAX_FIGURES = 400;
export const MAX_NEWCOMERS = 60;

export interface Figures {
  group: Group;
  /** Shows one figure per ten people, at most MAX_FIGURES. */
  setPeople(people: number, plantedParcels: readonly Parcel[]): number;
  /** Newcomers walking in: `progress` 0 at the far end of the road, 1 at the gate. */
  setProcession(newcomers: number, progress: number): void;
  /** 0–1: figures fading as the fever passes. */
  setThinned(fraction: number): void;
  update(time: number): void;
  setPalette(palette: ScenePalette): void;
  readonly shown: number;
}

interface Route {
  points: Point2[];
  length: number;
}

/** A person: a long robe from narrow shoulders, arms at the sides, a head with a wrapped cloth. */
function personGeometry(): BufferGeometry {
  const robe = new CylinderGeometry(0.15, 0.3, 1.0, 8);
  robe.translate(0, 0.5, 0);
  const shoulders = new SphereGeometry(0.17, 8, 6);
  shoulders.scale(1.15, 0.7, 0.85);
  shoulders.translate(0, 1.0, 0);
  const head = new SphereGeometry(0.12, 8, 6);
  head.translate(0, 1.2, 0);
  const wrap = new SphereGeometry(0.135, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
  wrap.translate(0, 1.23, 0);
  const arms = [-1, 1].map((side) => {
    const arm = new CylinderGeometry(0.045, 0.055, 0.55, 5);
    arm.rotateZ(side * 0.12);
    arm.translate(side * 0.19, 0.74, 0.02);
    return arm;
  });
  return mergeGeometries([robe, shoulders, head, wrap, ...arms]);
}

function routeOf(points: Point2[]): Route {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point2;
    const b = points[i] as Point2;
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return { points, length: Math.max(length, 0.001) };
}

/** A point at a distance along a route, walking back and forth. */
function along(route: Route, distance: number): { x: number; z: number; heading: number } {
  const span = route.length;
  const cycle = ((distance % (span * 2)) + span * 2) % (span * 2);
  let d = cycle <= span ? cycle : span * 2 - cycle;
  const backwards = cycle > span;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1] as Point2;
    const b = route.points[i] as Point2;
    const piece = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= piece || i === route.points.length - 1) {
      const t = piece > 0 ? Math.min(1, d / piece) : 0;
      const heading = Math.atan2(b.x - a.x, b.z - a.z) + (backwards ? Math.PI : 0);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading };
    }
    d -= piece;
  }
  const last = route.points.at(-1) as Point2;
  return { x: last.x, z: last.z, heading: 0 };
}

export function createFigures(layout: CityLayout, palette: ScenePalette): Figures {
  const group = new Group();
  group.name = 'people';
  const rng = createRng('ten-harvests:figures');
  const geometry = personGeometry();
  const material = new MeshStandardMaterial({ roughness: 0.9 });
  const people = new InstancedMesh(geometry, material, MAX_FIGURES);
  people.castShadow = true;
  people.count = 0;
  group.add(people);

  const lanes = layout.lanes.map(routeOf);
  const walkers = Array.from({ length: MAX_FIGURES }, () => ({
    offset: rng.float(0, 400),
    speed: rng.float(0.7, 1.4),
    garment: rng.int(0, 4),
    field: rng.chance(0.55),
    lane: rng.int(0, Math.max(0, lanes.length - 1)),
    parcelPick: rng.next(),
  }));
  let fieldRoutes: Route[] = [];
  let shown = 0;
  let thinned = 0;
  let current = palette;

  // The procession: walkers and their lanterns on the river road.
  const road = routeOf([...layout.arrivalRoad]);
  const travellers = new InstancedMesh(geometry, material, MAX_NEWCOMERS);
  travellers.count = 0;
  travellers.castShadow = true;
  group.add(travellers);
  const lanternPositions = new Float32Array(MAX_NEWCOMERS * 3);
  const lanternGeometry = new BufferGeometry();
  lanternGeometry.setAttribute('position', new Float32BufferAttribute(lanternPositions, 3));
  lanternGeometry.setDrawRange(0, 0);
  const lanternUniforms = {
    uColour: { value: palette.lantern.clone() },
    uSize: { value: 26 },
    uStrength: { value: 0 },
  };
  const lanternMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: lanternUniforms,
    vertexShader: /* glsl */ `
      uniform float uSize;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (60.0 / max(-view.z, 1.0));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.32, 0.0, d);
        float halo = smoothstep(1.0, 0.0, d) * 0.35;
        gl_FragColor = vec4(uColour * (core * 4.0 + halo) * uStrength, 1.0);
      }
    `,
  });
  const lanterns = new Points(lanternGeometry, lanternMaterial);
  lanterns.frustumCulled = false;
  lanterns.name = 'lanterns';
  group.add(lanterns);
  const lanternCores = new InstancedMesh(
    new SphereGeometry(0.16, 8, 6),
    new MeshBasicMaterial({ color: palette.lantern.clone().multiplyScalar(4), toneMapped: false }),
    MAX_NEWCOMERS,
  );
  lanternCores.count = 0;
  group.add(lanternCores);
  // Each lantern throws a warm pool of light on the road.
  const poolGeometry = new PlaneGeometry(4.2, 4.2);
  poolGeometry.rotateX(-Math.PI / 2);
  const poolMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColour: { value: palette.lantern.clone() } },
    vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uColour;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        gl_FragColor = vec4(uColour * pow(max(0.0, 1.0 - d), 2.0) * 0.55, 1.0);
      }
    `,
  });
  const pools = new InstancedMesh(poolGeometry, poolMaterial, MAX_NEWCOMERS);
  pools.count = 0;
  pools.frustumCulled = false;
  group.add(pools);
  let procession = { newcomers: 0, progress: 0 };

  const dummy = new Object3D();
  const colours = (): Color[] => current.garments;

  function paintGarments(): void {
    for (let i = 0; i < MAX_FIGURES; i++)
      people.setColorAt(i, colours()[walkers[i]?.garment ?? 0] ?? current.brick);
    for (let i = 0; i < MAX_NEWCOMERS; i++)
      travellers.setColorAt(i, colours()[(i * 3) % 5] ?? current.brick);
    if (people.instanceColor) people.instanceColor.needsUpdate = true;
    if (travellers.instanceColor) travellers.instanceColor.needsUpdate = true;
  }
  paintGarments();

  function placeWalkers(time: number): void {
    const visible = Math.round(shown * (1 - thinned));
    for (let i = 0; i < visible; i++) {
      const walker = walkers[i];
      if (!walker) break;
      const useField = walker.field && fieldRoutes.length > 0;
      const route = useField
        ? (fieldRoutes[Math.floor(walker.parcelPick * fieldRoutes.length)] as Route)
        : (lanes[walker.lane % lanes.length] as Route);
      const step = along(route, walker.offset + time * walker.speed);
      const bob = Math.abs(Math.sin((walker.offset + time * walker.speed) * 3.2)) * 0.08;
      dummy.position.set(step.x, bob, step.z);
      dummy.rotation.set(0, step.heading, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      people.setMatrixAt(i, dummy.matrix);
    }
    people.count = visible;
    people.instanceMatrix.needsUpdate = true;
  }

  function placeProcession(time: number): void {
    const count = Math.min(MAX_NEWCOMERS, procession.newcomers);
    const visible = procession.progress > 0 && procession.progress < 1.2 ? count : 0;
    // The line walks in from the far end of the road; the leader reaches the gate at progress 1.
    for (let i = 0; i < visible; i++) {
      // Families walk together: small groups with gaps between them, never a fence of lamps.
      const behind = i * 1.25 + Math.floor(i / 3) * 3.4 + ((i * 7) % 5) * 0.35;
      const distance = Math.max(
        0,
        Math.min(road.length, road.length * procession.progress - behind),
      );
      const step = along(road, distance);
      const bob = Math.abs(Math.sin(time * 3.4 + i)) * 0.08;
      dummy.position.set(step.x, bob, step.z + (((i * 5) % 3) - 1) * 0.55);
      dummy.rotation.set(0, step.heading, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      travellers.setMatrixAt(i, dummy.matrix);
      const lx = dummy.position.x + 0.35;
      const lz = dummy.position.z + 0.2;
      lanternPositions.set([lx, 1.25 + bob, lz], i * 3);
      dummy.position.set(lx, 1.25 + bob, lz);
      dummy.updateMatrix();
      lanternCores.setMatrixAt(i, dummy.matrix);
      dummy.position.set(lx, 0.08, lz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      pools.setMatrixAt(i, dummy.matrix);
    }
    travellers.count = visible;
    travellers.instanceMatrix.needsUpdate = true;
    const lit = current.appearance === 'dark' ? visible : 0;
    lanternCores.count = lit;
    lanternCores.instanceMatrix.needsUpdate = true;
    pools.count = lit;
    pools.instanceMatrix.needsUpdate = true;
    lanternGeometry.setDrawRange(0, lit);
    lanternGeometry.getAttribute('position').needsUpdate = true;
    lanternUniforms.uStrength.value = lit > 0 ? 1 : 0;
  }

  return {
    group,
    get shown() {
      return Math.round(shown * (1 - thinned));
    },
    setPeople(count, planted) {
      shown = Math.min(MAX_FIGURES, figuresForPeople(count));
      fieldRoutes = planted.slice(0, 120).map((parcel) =>
        routeOf([
          { x: parcel.x - parcel.width / 2 - 0.2, z: parcel.z + parcel.depth / 2 + 0.25 },
          { x: parcel.x + parcel.width / 2 + 0.2, z: parcel.z + parcel.depth / 2 + 0.25 },
        ]),
      );
      return shown;
    },
    setProcession(newcomers, progress) {
      procession = { newcomers, progress };
    },
    setThinned(fraction) {
      thinned = Math.max(0, Math.min(1, fraction));
    },
    update(time) {
      placeWalkers(time);
      placeProcession(time);
    },
    setPalette(next) {
      current = next;
      lanternUniforms.uColour.value.copy(next.lantern);
      paintGarments();
    },
  };
}
