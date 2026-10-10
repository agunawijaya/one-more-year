/**
 * The granary: a long mud-brick store with its front wall and half its vault
 * cut away, so the grain inside is always in view. The grain is a real
 * height field across three bays: its level is the store, and a heap rises
 * under the chute when grain pours in.
 *
 * The store maps to the fill linearly up to CAPACITY bushels (the brim of
 * the walls); beyond that the heap keeps rising above the walls.
 */
import type { BufferAttribute } from 'three';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { brickMaterial, grainMaterial, plainMaterial } from './materials.ts';
import type { CityLayout } from './layout.ts';
import type { ScenePalette } from './palette.ts';

/** Bushels that fill the granary to the brim of its walls. */
export const GRANARY_CAPACITY = 8000;
/** Grain floor and brim, in units above the granary floor. */
const FLOOR = 0.35;
const BRIM_BELOW_TOP = 0.75;

export type SackRoute = 'land' | 'food' | 'seed';

export interface Granary {
  group: Group;
  /** Shows a store of grain; `heap` (0–1) raises a mound under the chute. */
  setStore(bushels: number, heap?: number): void;
  /** The fill as a fraction of the brim (the tests read this). */
  readonly fill: number;
  /** World position of the chute where the grain river pours in. */
  readonly chute: { x: number; y: number; z: number };
  /** Sacks waiting on each route, as bushels (one sack per 100). */
  setSacks(route: SackRoute, bushels: number): void;
  update(seconds: number): void;
  setPalette(palette: ScenePalette): void;
}

export function fillFor(bushels: number): number {
  return Math.max(0, bushels) / GRANARY_CAPACITY;
}

const dummy = new Object3D();

export function createGranary(layout: CityLayout, palette: ScenePalette): Granary {
  const { x, z, width, depth, height } = layout.granary;
  const group = new Group();
  group.name = 'granary';
  group.position.set(x, 0, z);
  const brick = brickMaterial(palette.brick);
  const wall = 0.75;

  const add = (geometry: BoxGeometry, px: number, py: number, pz: number): Mesh => {
    const mesh = new Mesh(geometry, brick);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // Back and side walls stand whole; the front is cut away to a low sill with corner piers.
  add(new BoxGeometry(width, height, wall), 0, height / 2, -depth / 2 + wall / 2);
  add(new BoxGeometry(wall, height, depth), -width / 2 + wall / 2, height / 2, 0);
  add(new BoxGeometry(wall, height, depth), width / 2 - wall / 2, height / 2, 0);
  add(new BoxGeometry(width, 0.9, wall), 0, 0.45, depth / 2 - wall / 2);
  add(
    new BoxGeometry(1.1, height, wall * 1.2),
    -width / 2 + 0.55,
    height / 2,
    depth / 2 - wall / 2,
  );
  add(new BoxGeometry(1.1, height, wall * 1.2), width / 2 - 0.55, height / 2, depth / 2 - wall / 2);
  // Two inner walls part the store into three bays.
  for (const bay of [-1, 1])
    add(
      new BoxGeometry(0.45, height * 0.72, depth - wall * 2),
      (bay * width) / 6,
      (height * 0.72) / 2,
      0,
    );
  // The vault: a half barrel over the back half only, so the grain shows.
  const vault = new Mesh(
    new CylinderGeometry(depth * 0.36, depth * 0.36, width - 0.2, 20, 1, true, 0, Math.PI),
    brick,
  );
  vault.rotation.set(0, 0, Math.PI / 2);
  vault.position.set(0, height, -depth * 0.14);
  vault.castShadow = true;
  group.add(vault);
  // The chute on the vault, where the harvest pours in.
  const chuteMesh = new Mesh(new CylinderGeometry(0.55, 0.8, 1.4, 10), brick);
  chuteMesh.position.set(-width * 0.18, height + depth * 0.3, -depth * 0.12);
  chuteMesh.castShadow = true;
  group.add(chuteMesh);

  // The grain surface: a height field across the open interior.
  const innerWidth = width - wall * 2;
  const innerDepth = depth - wall * 2;
  const grainGeometry = new PlaneGeometry(innerWidth, innerDepth, 56, 24);
  grainGeometry.rotateX(-Math.PI / 2);
  const grain = new Mesh(grainGeometry, grainMaterial(palette.grain));
  grain.receiveShadow = true;
  grain.castShadow = true;
  grain.name = 'granary-grain';
  group.add(grain);
  const base = Float32Array.from(grainGeometry.getAttribute('position').array);
  const brim = height - BRIM_BELOW_TOP;

  // Sacks waiting by the door, in three lines: to the market, the houses and the fields.
  const sackMaterial = plainMaterial(new Color('#e4d6b4'), 1);
  const sackGeometry = new SphereGeometry(0.5, 10, 8);
  sackGeometry.scale(0.95, 0.72, 0.7);
  sackGeometry.translate(0, 0.32, 0);
  const sacks = new InstancedMesh(sackGeometry, sackMaterial, 120);
  sacks.castShadow = true;
  sacks.count = 0;
  group.add(sacks);
  const routes: Record<SackRoute, { from: [number, number]; to: [number, number] }> = {
    land: { from: [width / 2 + 1.2, depth / 2 + 1.2], to: [width / 2 + 11, depth / 2 + 3] },
    food: { from: [width / 2 + 1.2, -depth / 2 + 1], to: [width / 2 + 10, -depth / 2 - 4] },
    seed: { from: [-1, depth / 2 + 1.6], to: [2, depth / 2 + 13] },
  };
  const sackTarget: Record<SackRoute, number> = { land: 0, food: 0, seed: 0 };
  const sackShown: Record<SackRoute, number> = { land: 0, food: 0, seed: 0 };

  let fill = 0;
  let mound = 0;

  function shapeGrain(): void {
    const positions = grainGeometry.getAttribute('position') as BufferAttribute;
    const array = positions.array as Float32Array;
    const level = FLOOR + Math.min(1, fill) * (brim - FLOOR);
    const over = Math.max(0, fill - 1);
    const chuteX = -width * 0.18;
    for (let i = 0; i < array.length; i += 3) {
      const px = base[i] ?? 0;
      const pz = base[i + 2] ?? 0;
      const fromChute = Math.hypot(px - chuteX, (pz + innerDepth * 0.1) * 1.4);
      const heap = Math.max(0, 1 - fromChute / 4.2) * (mound * 1.6 + over * 2.4);
      const ripple = Math.sin(px * 2.3) * Math.cos(pz * 3.1) * 0.05;
      // Grain slopes up a little toward the walls, where it settles.
      const edge = Math.max(Math.abs(px) / (innerWidth / 2), Math.abs(pz) / (innerDepth / 2));
      array[i + 1] = fill <= 0.001 ? -1 : level + heap + ripple + edge * edge * 0.18;
    }
    positions.needsUpdate = true;
    grainGeometry.computeVertexNormals();
  }

  function layoutSacks(): void {
    let n = 0;
    for (const route of ['land', 'food', 'seed'] as const) {
      const { from, to } = routes[route];
      const count = Math.round(sackShown[route]);
      for (let i = 0; i < count && n < 120; i++) {
        const row = Math.floor(i / 2);
        const t = Math.min(1, row / 18);
        dummy.position.set(
          from[0] + (to[0] - from[0]) * t + (i % 2) * 0.55,
          0,
          from[1] + (to[1] - from[1]) * t + (i % 2) * 0.2,
        );
        dummy.rotation.set(0, i * 0.7, 0);
        dummy.scale.setScalar(0.9 + ((i * 37) % 10) / 50);
        dummy.updateMatrix();
        sacks.setMatrixAt(n++, dummy.matrix);
      }
    }
    sacks.count = n;
    sacks.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    get fill() {
      return fill;
    },
    chute: { x: x - width * 0.18, y: height + depth * 0.3 + 0.7, z: z - depth * 0.12 },
    setStore(bushels, heap = 0) {
      const nextFill = fillFor(bushels);
      if (Math.abs(nextFill - fill) < 1e-5 && Math.abs(heap - mound) < 1e-3) return;
      fill = nextFill;
      mound = heap;
      shapeGrain();
    },
    setSacks(route, bushels) {
      // One sack per 150 bushels, up to a long line: enough to see a drag move grain.
      sackTarget[route] = Math.min(40, Math.max(0, bushels) / 150);
    },
    update(seconds) {
      let moved = false;
      for (const route of ['land', 'food', 'seed'] as const) {
        const target = sackTarget[route];
        const shown = sackShown[route];
        if (Math.abs(target - shown) < 0.01) continue;
        // Sacks slide out (or back) a few per frame, so a drag reads as movement.
        sackShown[route] =
          shown + Math.sign(target - shown) * Math.min(Math.abs(target - shown), seconds * 40);
        moved = true;
      }
      if (moved) layoutSacks();
    },
    setPalette(next) {
      brick.color.copy(next.brick);
      grain.material.color.copy(next.grain);
      grain.material.emissive
        .copy(next.grain)
        .multiplyScalar(next.appearance === 'dark' ? 0.35 : 0.22);
      sackMaterial.color.copy(
        next.appearance === 'dark' ? new Color('#8c8aa8') : new Color('#e4d6b4'),
      );
    },
  };
}
