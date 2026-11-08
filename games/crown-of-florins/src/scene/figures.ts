/**
 * People and trees: the crowd in the piazza and the lanes, soldiers
 * drilling in their yard, cypresses along the roads and olive groves on
 * the slopes. All instanced, so a crowd of nine hundred costs one draw.
 *
 * The crowd's size follows the population (layout.crowdFor) and the drill
 * yard's ranks follow the soldiers (layout.drillersFor). Figures are the
 * tall, simple shapes of painted crowds: a long robe in a pigment colour
 * and a small head.
 */
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  type BufferGeometry,
  type Material,
} from 'three';
import { createRng, hashString } from '@one-more-year/kit';
import { PartsBuilder, SURFACE } from './parts.ts';
import type { CityPlan } from './layout.ts';
import type { ScenePalette } from './palette.ts';

function figureGeometry(soldier: boolean): BufferGeometry {
  const parts = new PartsBuilder();
  const white = new Color('#ffffff');
  parts.object(1).cone(0, 0, soldier ? 0.36 : 0.44, 1.3, 7, white, SURFACE.plain);
  parts.prism(0, 0, 0.27, 0.22, 6, white, SURFACE.plain, 0.95);
  parts.prism(0, 0, 0.17, 0.32, 6, white, SURFACE.skin, 1.14);
  parts.cone(0, 0, 0.2, 0.18, 6, white, SURFACE.plain, 1.44);
  if (soldier) {
    // A pike, held upright.
    parts.box(0.36, 0.05, 0.07, 0.07, 2.9, new Color('#8a6a44'), {
      base: 0.1,
      sides: SURFACE.wood,
    });
    parts.box(0.36, 0.05, 0.16, 0.05, 0.36, new Color('#c9c3b4'), {
      base: 3,
      sides: SURFACE.plain,
    });
  }
  return parts.build();
}

export interface Crowd {
  people: InstancedMesh;
  soldiers: InstancedMesh;
  readonly shown: number;
  readonly drilling: number;
  dispose(): void;
}

/** Lanes the crowd walks: the piazza (to and fro in any direction) and the three streets. */
function crowdSpot(
  rng: ReturnType<typeof createRng>,
  plan: CityPlan,
): { x: number; z: number; dx: number; dz: number } {
  const roll = rng.next();
  const reach = plan.wallRadius * 0.8;
  if (roll < 0.55) {
    const x = (rng.next() - 0.5) * 18;
    const z = (rng.next() - 0.5) * 12;
    const a = rng.next() * Math.PI * 2;
    return { x, z, dx: Math.cos(a) * 2.2, dz: Math.sin(a) * 2.2 };
  }
  if (roll < 0.8)
    return { x: (rng.next() - 0.5) * 3.6, z: 10 + rng.next() * (reach - 10), dx: 0, dz: 3 };
  const west = rng.chance(0.5);
  return {
    x: (west ? -1 : 1) * (13 + rng.next() * (reach - 13)),
    z: (rng.next() - 0.5) * 2.2,
    dx: 3,
    dz: 0,
  };
}

export function createCrowd(
  plan: CityPlan,
  palette: ScenePalette,
  walkerMaterial: Material,
  standingMaterial: Material,
): Crowd {
  const rng = createRng(hashString('crowd'));
  const count = plan.crowd;
  const people = new InstancedMesh(figureGeometry(false), walkerMaterial, count);
  const walk = new Float32Array(count * 4);
  const dummy = new Object3D();
  const colour = new Color();
  for (let i = 0; i < count; i++) {
    const spot = crowdSpot(rng, plan);
    dummy.position.set(spot.x, 0.1, spot.z);
    dummy.rotation.set(0, rng.next() * Math.PI * 2, 0);
    const scale = 0.92 + rng.next() * 0.18;
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    people.setMatrixAt(i, dummy.matrix);
    colour.copy(palette.robes[rng.int(0, palette.robes.length - 1)] as Color);
    people.setColorAt(i, colour);
    walk.set(
      [
        spot.dx * (0.3 + rng.next() * 0.7),
        spot.dz * (0.3 + rng.next() * 0.7),
        0.12 + rng.next() * 0.22,
        rng.next() * 6.28,
      ],
      i * 4,
    );
  }
  people.geometry.setAttribute('aWalk', new InstancedBufferAttribute(walk, 4));
  people.castShadow = true;
  people.receiveShadow = true;

  // The garrison drills in ranks in its yard.
  const drilling = plan.yard.soldiers;
  const soldiers = new InstancedMesh(figureGeometry(true), standingMaterial, Math.max(1, drilling));
  const tunic = new Color(palette.robes[0] ?? '#bf3a22').lerp(new Color(palette.wallStone), 0.25);
  const columns = 10;
  for (let i = 0; i < Math.max(1, drilling); i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    dummy.position.set(plan.yard.x - 4.5 + col * 1.0, 0.1, plan.yard.z - 3.2 + row * 1.15);
    dummy.rotation.set(0, Math.PI, 0);
    dummy.scale.setScalar(i < drilling ? 1 : 0);
    dummy.updateMatrix();
    soldiers.setMatrixAt(i, dummy.matrix);
    soldiers.setColorAt(i, tunic);
  }
  soldiers.castShadow = true;

  return {
    people,
    soldiers,
    shown: count,
    drilling,
    dispose() {
      people.geometry.dispose();
      soldiers.geometry.dispose();
    },
  };
}

/**
 * The coronation's procession: two by two from the palace loggia across the
 * piazza to the cathedral's door, in vermilion, white and gold, with
 * standard-bearers among them.
 */
export function createProcession(
  palette: ScenePalette,
  material: Material,
  count = 90,
): InstancedMesh {
  const route = [
    { x: 13.2, z: 4 },
    { x: 8, z: 6.5 },
    { x: 0, z: 6 },
    { x: -5, z: 2 },
    { x: -3, z: -4 },
    { x: 0, z: -7.6 },
  ];
  const length = route
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - (route[i]?.x ?? 0), p.z - (route[i]?.z ?? 0)), 0);
  const mesh = new InstancedMesh(figureGeometry(true), material, count);
  const dummy = new Object3D();
  const colours = [
    new Color('#b3301e'),
    new Color('#efe6d2'),
    new Color('#c9973f'),
    palette.robes[1] ?? new Color('#2c5a8e'),
  ];
  for (let i = 0; i < count; i++) {
    const along = (Math.floor(i / 2) / Math.ceil(count / 2)) * length;
    let walked = 0;
    let at = { x: route[0]?.x ?? 0, z: route[0]?.z ?? 0, angle: 0 };
    for (let k = 1; k < route.length; k++) {
      const a = route[k - 1] as { x: number; z: number };
      const b = route[k] as { x: number; z: number };
      const piece = Math.hypot(b.x - a.x, b.z - a.z);
      if (walked + piece >= along) {
        const t = (along - walked) / piece;
        at = {
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t,
          angle: Math.atan2(b.z - a.z, b.x - a.x),
        };
        break;
      }
      walked += piece;
    }
    const side = i % 2 === 0 ? -0.55 : 0.55;
    dummy.position.set(at.x - Math.sin(at.angle) * side, 0.12, at.z + Math.cos(at.angle) * side);
    dummy.rotation.set(0, -at.angle + Math.PI / 2, 0);
    dummy.scale.setScalar(i % 9 === 0 ? 1.05 : 0.95);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, colours[i % colours.length] as Color);
  }
  mesh.castShadow = true;
  return mesh;
}

// ---- trees ------------------------------------------------------------------------

function cypressGeometry(palette: ScenePalette): BufferGeometry {
  const parts = new PartsBuilder();
  parts.object(1).prism(0, 0, 0.18, 0.7, 5, new Color('#5a4030'), SURFACE.wood);
  parts.cone(0, 0, 1.05, 4.2, 8, palette.cypress, SURFACE.plain, 0.6);
  parts.cone(0, 0, 0.75, 3.4, 8, palette.cypress, SURFACE.plain, 3.4);
  return parts.build();
}

function oliveGeometry(palette: ScenePalette): BufferGeometry {
  const parts = new PartsBuilder();
  parts.object(1).prism(0, 0, 0.22, 1.1, 5, new Color('#5a4636'), SURFACE.wood);
  parts.prism(0, 0, 1.55, 0.5, 9, palette.olive, SURFACE.plain, 0.9, false);
  parts.dome(0, 0, 1.6, 1.7, 1.4, 9, palette.olive, 3, SURFACE.plain);
  return parts.build();
}

export interface Trees {
  cypresses: InstancedMesh;
  olives: InstancedMesh;
  dispose(): void;
}

export function createTrees(
  plan: CityPlan,
  palette: ScenePalette,
  material: Material,
  heightOf: (x: number, z: number) => number,
  northEdge: number,
): Trees {
  const onLand = plan.trees.filter((t) => t.z > northEdge);
  const cypressSpots = onLand.filter((t) => t.kind === 'cypress');
  const oliveSpots = onLand.filter((t) => t.kind === 'olive');
  const cypresses = new InstancedMesh(
    cypressGeometry(palette),
    material,
    Math.max(1, cypressSpots.length),
  );
  const olives = new InstancedMesh(
    oliveGeometry(palette),
    material,
    Math.max(1, oliveSpots.length),
  );
  const dummy = new Object3D();
  const tint = new Color();
  const rng = createRng(hashString('trees'));
  const place = (mesh: InstancedMesh, spots: typeof plan.trees): void => {
    spots.forEach((spot, i) => {
      dummy.position.set(spot.x, heightOf(spot.x, spot.z), spot.z);
      dummy.rotation.set(0, rng.next() * Math.PI, 0);
      dummy.scale.set(spot.scale, spot.scale * (0.9 + rng.next() * 0.25), spot.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const shade = 0.88 + rng.next() * 0.2;
      mesh.setColorAt(i, tint.setRGB(shade, shade, shade * 0.97));
    });
    if (spots.length === 0) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(0, dummy.matrix);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  };
  place(cypresses, cypressSpots);
  place(olives, oliveSpots);
  return {
    cypresses,
    olives,
    dispose() {
      cypresses.geometry.dispose();
      olives.geometry.dispose();
    },
  };
}
