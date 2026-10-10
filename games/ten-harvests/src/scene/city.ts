/**
 * The city: mud-brick houses with flat roofs and parapets, their windows
 * (one lit for every ten people after dark), the city wall and its gates,
 * and the ziggurat with its lapis shrine on the skyline.
 *
 * Houses beyond what the people need stay empty foundations: as the city
 * grows, the outskirts fill in.
 */
import type { BufferGeometry, Matrix4 } from 'three';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '@one-more-year/kit';
import { windowsForPeople, type CityLayout, type HouseLot } from './layout.ts';
import { brickMaterial, glazeMaterial, goldMaterial, plainMaterial } from './materials.ts';
import type { ScenePalette } from './palette.ts';

export interface City {
  group: Group;
  /** Lights one window per ten people; returns how many are lit. */
  setPeople(people: number): number;
  /** 0–1 per house: how many of the lit windows a fever haze has dimmed. */
  setDimmed(fraction: number): void;
  setPalette(palette: ScenePalette): void;
  readonly litWindows: number;
  /** The window slots burning now (after dark), for the lamp halos. */
  litSlots(): number[];
  /** Where the city's own fires burn: wall towers, gates, the temple. */
  readonly fires: { x: number; y: number; z: number }[];
}

const dummy = new Object3D();

/** Dyed awnings: madder red, indigo, saffron, undyed linen. */
const CLOTH = ['#b5502f', '#2f4f97', '#e0a23a', '#e9dcc0', '#8a3b2a'] as const;
/** Doors: old cedar, painted indigo, painted teal. */
const DOORS = ['#3b2a1c', '#4a3020', '#2c3f7a', '#2f6e6a'] as const;

function boxOnGround(): BoxGeometry {
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  return box;
}

/** A parapet: a thin raised rim around a 1 × 1 roof. */
function parapetGeometry(): BufferGeometry {
  const rim = 0.07;
  const parts = [
    new BoxGeometry(1, 0.22, rim).translate(0, 0.11, 0.5 - rim / 2),
    new BoxGeometry(1, 0.22, rim).translate(0, 0.11, -0.5 + rim / 2),
    new BoxGeometry(rim, 0.22, 1).translate(0.5 - rim / 2, 0.11, 0),
    new BoxGeometry(rim, 0.22, 1).translate(-0.5 + rim / 2, 0.11, 0),
  ];
  return mergeGeometries(parts);
}

function placeHouse(house: HouseLot, height: number): Matrix4 {
  dummy.position.set(house.x, 0, house.z);
  dummy.rotation.set(0, house.turn, 0);
  dummy.scale.set(house.width, height, house.depth);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

export function createCity(layout: CityLayout, palette: ScenePalette): City {
  const group = new Group();
  group.name = 'city';
  const rng = createRng('ten-harvests:city-detail');
  const brick = brickMaterial(new Color('#ffffff'));
  const houses = layout.houses;

  // ---- houses, parapets, roof rooms and shade canopies ----
  const houseMesh = new InstancedMesh(boxOnGround(), brick, houses.length);
  const parapets = new InstancedMesh(parapetGeometry(), brick, houses.length);
  const roofRooms: Matrix4[] = [];
  const canopies: Matrix4[] = [];
  const tones: number[] = [];
  houses.forEach((house, i) => {
    houseMesh.setMatrixAt(i, placeHouse(house, house.height));
    dummy.position.set(house.x, house.height, house.z);
    dummy.rotation.set(0, house.turn, 0);
    dummy.scale.set(house.width, 1, house.depth);
    dummy.updateMatrix();
    parapets.setMatrixAt(i, dummy.matrix);
    tones.push(house.tone);
    if (rng.chance(0.38)) {
      dummy.position.set(
        house.x + rng.float(-0.25, 0.25) * house.width,
        house.height,
        house.z + rng.float(-0.25, 0.25) * house.depth,
      );
      dummy.scale.set(rng.float(0.8, 1.2), rng.float(0.9, 1.3), rng.float(0.8, 1.1));
      dummy.updateMatrix();
      roofRooms.push(dummy.matrix.clone());
    } else if (rng.chance(0.55)) {
      dummy.position.set(
        house.x + rng.float(-0.2, 0.2) * house.width,
        house.height + 1.05,
        house.z,
      );
      dummy.scale.set(house.width * 0.55, 0.08, house.depth * 0.5);
      dummy.updateMatrix();
      canopies.push(dummy.matrix.clone());
    }
  });
  houseMesh.castShadow = true;
  houseMesh.receiveShadow = true;
  parapets.castShadow = true;
  group.add(houseMesh, parapets);

  const roomMesh = new InstancedMesh(boxOnGround(), brick, Math.max(1, roofRooms.length));
  roofRooms.forEach((matrix, i) => roomMesh.setMatrixAt(i, matrix));
  roomMesh.count = roofRooms.length;
  roomMesh.castShadow = true;
  group.add(roomMesh);

  // Roof awnings of dyed cloth: the city's few strong colours.
  const canopyMaterial = plainMaterial(new Color('#ffffff'), 1);
  const canopyMesh = new InstancedMesh(boxOnGround(), canopyMaterial, Math.max(1, canopies.length));
  const clothChoice = canopies.map(() => rng.int(0, CLOTH.length - 1));
  canopies.forEach((matrix, i) => canopyMesh.setMatrixAt(i, matrix));
  canopyMesh.count = canopies.length;
  canopyMesh.castShadow = true;
  group.add(canopyMesh);

  // ---- doors and windows ----
  const doorMaterial = new MeshBasicMaterial({ color: '#ffffff' });
  const doors = new InstancedMesh(
    new PlaneGeometry(0.62, 1.15).translate(0, 0.575, 0),
    doorMaterial,
    houses.length,
  );
  const doorChoice = houses.map(() => rng.int(0, DOORS.length - 1));
  houses.forEach((house, i) => {
    const offset = rng.float(-0.3, 0.3) * house.width;
    dummy.position.set(
      house.x + Math.cos(house.turn) * offset + Math.sin(house.turn) * (house.depth / 2 + 0.02),
      0,
      house.z - Math.sin(house.turn) * offset + Math.cos(house.turn) * (house.depth / 2 + 0.02),
    );
    dummy.rotation.set(0, house.turn, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    doors.setMatrixAt(i, dummy.matrix);
  });
  group.add(doors);

  const windowMaterial = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const windows = new InstancedMesh(
    new PlaneGeometry(0.42, 0.52),
    windowMaterial,
    layout.windows.length,
  );
  layout.windows.forEach((slot, i) => {
    dummy.position.set(slot.x, slot.y, slot.z);
    dummy.rotation.set(0, slot.facing, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    windows.setMatrixAt(i, dummy.matrix);
    windows.setColorAt(i, palette.windowDark);
  });
  windows.name = 'windows';
  group.add(windows);

  // ---- the city wall, with its south and east gates ----
  const { mesh: wall, towers } = cityWall(layout, brick);
  group.add(wall);

  // ---- the ziggurat ----
  const temple = ziggurat(layout, palette);
  group.add(temple.group);

  let lit = 0;
  let dimmed = 0;
  let current = palette;
  let people = 0;

  function paintWindows(): void {
    const glow = current.windowLit
      .clone()
      .multiplyScalar(current.appearance === 'dark' ? 3.2 : 1.1);
    const dark = current.windowDark;
    const dimmedFrom = Math.round(lit * (1 - dimmed));
    layout.windowOrder.forEach((slot, rank) => {
      const on = rank < dimmedFrom && current.appearance === 'dark';
      windows.setColorAt(slot, on ? glow : dark);
    });
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  }

  function paintBrick(): void {
    const base = new Color();
    const night = current.appearance === 'dark';
    tones.forEach((tone, i) => {
      base.copy(current.brickShade).lerp(current.brickLight, tone);
      // About one house in six is limewashed.
      if (tone > 0.84) base.lerp(night ? new Color('#7480b8') : new Color('#f1e6d0'), 0.75);
      houseMesh.setColorAt(i, base);
      parapets.setColorAt(i, base.clone().multiplyScalar(1.04));
    });
    clothChoice.forEach((choice, i) => {
      const cloth = new Color(CLOTH[choice] ?? '#c05a36');
      canopyMesh.setColorAt(i, night ? cloth.lerp(current.brickShade, 0.6) : cloth);
    });
    doorChoice.forEach((choice, i) => {
      const door = new Color(DOORS[choice] ?? '#3b2a1c');
      doors.setColorAt(i, night ? door.lerp(current.windowDark, 0.7) : door);
    });
    for (let i = 0; i < roomMesh.count; i++) roomMesh.setColorAt(i, current.brick);
    const wallTone = current.brick.clone().lerp(current.brickShade, 0.25);
    for (let i = 0; i < wall.count; i++) wall.setColorAt(i, wallTone);
    for (const mesh of [houseMesh, parapets, roomMesh, wall, canopyMesh, doors]) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    temple.setPalette(current);
  }

  paintBrick();

  const { x: zx, z: zz } = layout.ziggurat;
  const fires = [
    ...towers.map((t) => ({ x: t.x, y: t.y, z: t.z })),
    // The south gate and the east gate.
    { x: 3.4, y: 3.2, z: layout.cityCentre.z + 20.2 },
    { x: 8.6, y: 3.2, z: layout.cityCentre.z + 20.2 },
    { x: layout.cityCentre.x + 38.4, y: 3.2, z: layout.cityCentre.z - 1.2 },
    { x: layout.cityCentre.x + 38.4, y: 3.2, z: layout.cityCentre.z + 5.2 },
    // Braziers either side of the shrine door and at the head of the great stair.
    { x: zx - 2.2, y: 13.6, z: zz - 0.4 },
    { x: zx + 2.2, y: 13.6, z: zz - 0.4 },
    { x: zx - 1.6, y: 5.9, z: zz + layout.ziggurat.base / 2 - 0.4 },
    { x: zx + 1.6, y: 5.9, z: zz + layout.ziggurat.base / 2 - 0.4 },
  ];

  return {
    group,
    fires,
    litSlots() {
      if (current.appearance !== 'dark') return [];
      return layout.windowOrder.slice(0, Math.round(lit * (1 - dimmed)));
    },
    get litWindows() {
      return current.appearance === 'dark' ? Math.round(lit * (1 - dimmed)) : 0;
    },
    setPeople(count) {
      people = count;
      lit = windowsForPeople(people, layout.windows.length);
      paintWindows();
      return lit;
    },
    setDimmed(fraction) {
      dimmed = Math.max(0, Math.min(1, fraction));
      paintWindows();
    },
    setPalette(next) {
      current = next;
      paintBrick();
      paintWindows();
    },
  };
}

function cityWall(
  layout: CityLayout,
  material: Material,
): { mesh: InstancedMesh; towers: Vector3[] } {
  const { cityCentre } = layout;
  const radii = { x: 38.5, z: 20.5 };
  const segments: Matrix4[] = [];
  const towers: Vector3[] = [];
  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    const p0 = new Vector3(
      cityCentre.x + Math.cos(a0) * radii.x,
      0,
      cityCentre.z + Math.sin(a0) * radii.z,
    );
    const p1 = new Vector3(
      cityCentre.x + Math.cos(a1) * radii.x,
      0,
      cityCentre.z + Math.sin(a1) * radii.z,
    );
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    // Gates: south toward the fields road, east for the river road. The river guards the north.
    if (Math.abs(mid.x - 6) < 4 && mid.z > cityCentre.z) continue;
    if (Math.abs(mid.z - (cityCentre.z + 2)) < 3.5 && mid.x > cityCentre.x) continue;
    if (mid.z < cityCentre.z - radii.z * 0.6) continue;
    const length = p0.distanceTo(p1) + 0.15;
    const angle = Math.atan2(p1.z - p0.z, p1.x - p0.x);
    const tower = i % 10 === 0;
    if (tower) towers.push(new Vector3(mid.x, 4.7, mid.z));
    dummy.position.copy(mid);
    dummy.rotation.set(0, -angle, 0);
    dummy.scale.set(tower ? 2.4 : length, tower ? 4.2 : 2.7, tower ? 2.4 : 1.1);
    dummy.updateMatrix();
    segments.push(dummy.matrix.clone());
  }
  const mesh = new InstancedMesh(boxOnGround(), material, segments.length);
  segments.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  const tone = new Color('#ffffff');
  for (let i = 0; i < segments.length; i++) mesh.setColorAt(i, tone);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'city-wall';
  return { mesh, towers };
}

/** A square frustum: base and top side lengths, standing on y = 0. */
function frustum(base: number, top: number, height: number): CylinderGeometry {
  const geometry = new CylinderGeometry(
    (top / 2) * Math.SQRT2,
    (base / 2) * Math.SQRT2,
    height,
    4,
    1,
  );
  geometry.rotateY(Math.PI / 4);
  geometry.translate(0, height / 2, 0);
  return geometry.toNonIndexed() as CylinderGeometry;
}

function ziggurat(
  layout: CityLayout,
  palette: ScenePalette,
): { group: Group; setPalette(palette: ScenePalette): void } {
  const group = new Group();
  group.name = 'ziggurat';
  const { x, z, base } = layout.ziggurat;
  group.position.set(x, 0, z);
  const tiers = [
    { base, top: base - 2.6, height: 5.2, back: 0 },
    { base: base * 0.66, top: base * 0.66 - 1.6, height: 4.2, back: -1.6 },
    { base: base * 0.4, top: base * 0.4 - 0.9, height: 3.4, back: -2.6 },
  ];
  const tierMaterial = brickMaterial(palette.brick);
  let y = 0;
  for (const tier of tiers) {
    const mesh = new Mesh(frustum(tier.base, tier.top, tier.height), tierMaterial);
    mesh.position.set(0, y, tier.back);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Buttresses: shallow piers that stripe the walls with shadow.
    const piers = Math.round(tier.base / 1.7);
    const pier = new InstancedMesh(boxOnGround(), tierMaterial, piers * 4);
    let n = 0;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < piers; i++) {
        const along = ((i + 0.5) / piers - 0.5) * (tier.base - 1.2);
        const out = tier.base / 2 - 0.35;
        const angle = (side * Math.PI) / 2;
        dummy.position.set(
          Math.cos(angle) * out - Math.sin(angle) * along,
          0,
          Math.sin(angle) * out + Math.cos(angle) * along,
        );
        dummy.rotation.set(0, -angle, 0);
        dummy.scale.set(0.5, tier.height * 0.94, 0.55);
        dummy.updateMatrix();
        pier.setMatrixAt(n++, dummy.matrix);
      }
    }
    pier.position.set(0, y, tier.back);
    pier.castShadow = true;
    group.add(pier);
    y += tier.height;
  }

  // The great stair up the south face and its two flanking stairs.
  const steps = new InstancedMesh(boxOnGround(), tierMaterial, 120);
  let s = 0;
  const stair = (
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    rise: number,
    width: number,
    count: number,
  ): void => {
    for (let i = 0; i < count; i++) {
      const t = i / count;
      dummy.position.set(fromX + (toX - fromX) * t, 0, fromZ + (toZ - fromZ) * t);
      dummy.rotation.set(0, Math.atan2(toX - fromX, toZ - fromZ), 0);
      dummy.scale.set(width, rise * (t + 1 / count), 0.75);
      dummy.updateMatrix();
      steps.setMatrixAt(s++, dummy.matrix);
    }
  };
  stair(0, base / 2 + 9, 0, base / 2 - 0.6, tiers[0]?.height ?? 5, 2.6, 24);
  stair(-base / 2 - 2, base / 2 + 1.5, -2.5, base / 2 - 0.6, tiers[0]?.height ?? 5, 1.6, 16);
  stair(base / 2 + 2, base / 2 + 1.5, 2.5, base / 2 - 0.6, tiers[0]?.height ?? 5, 1.6, 16);
  steps.count = s;
  steps.castShadow = true;
  steps.receiveShadow = true;
  group.add(steps);

  // The shrine: glazed lapis walls, a band of gilded rosettes, a gilded cornice and crest.
  const lapis = glazeMaterial(palette.lapis);
  const gold = goldMaterial(palette.gold);
  const shrineZ = (tiers[2]?.back ?? 0) - 0.2;
  const shrine = new Mesh(boxOnGround().scale(5.4, 3.3, 4.0), lapis);
  shrine.position.set(0, y, shrineZ);
  shrine.castShadow = true;
  group.add(shrine);
  const plinth = new Mesh(boxOnGround().scale(6.2, 0.45, 4.8), tierMaterial);
  plinth.position.set(0, y - 0.05, shrineZ);
  group.add(plinth);
  const cornice = new Mesh(boxOnGround().scale(6.0, 0.32, 4.6), gold);
  cornice.position.set(0, y + 3.3, shrineZ);
  group.add(cornice);
  const crest = new Mesh(boxOnGround().scale(4.2, 0.55, 0.35), gold);
  crest.position.set(0, y + 3.62, shrineZ);
  group.add(crest);
  const rosettes = new InstancedMesh(
    new CylinderGeometry(0.2, 0.2, 0.06, 10).rotateX(Math.PI / 2),
    gold,
    26,
  );
  let r = 0;
  for (let i = 0; i < 9; i++) {
    dummy.position.set(-2.4 + i * 0.6, y + 2.75, shrineZ + 2.03);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    rosettes.setMatrixAt(r++, dummy.matrix);
  }
  for (let i = 0; i < 7; i++) {
    dummy.position.set(2.73, y + 2.75, shrineZ - 1.8 + i * 0.6);
    dummy.rotation.set(0, Math.PI / 2, 0);
    dummy.updateMatrix();
    rosettes.setMatrixAt(r++, dummy.matrix);
  }
  rosettes.count = r;
  group.add(rosettes);
  const door = new Mesh(
    new PlaneGeometry(1.2, 2.1).translate(0, 1.05, 0),
    new MeshBasicMaterial({ color: '#16110c' }),
  );
  door.position.set(0, y, shrineZ + 2.02);
  group.add(door);
  // A dark course of bitumen-sealed brick at the foot of the great platform.
  const footing = new Mesh(
    frustum(base + 0.5, base + 0.3, 0.7),
    plainMaterial(new Color('#4a3a2a'), 1),
  );
  group.add(footing);

  return {
    group,
    setPalette(next) {
      tierMaterial.color.copy(next.brickLight).lerp(next.brick, 0.25);
      lapis.color.copy(next.lapis);
      gold.color.copy(next.gold);
    },
  };
}
