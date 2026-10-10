/**
 * Pointing at the city: which field parcel is under the pointer, and the
 * glowing handle that marks the edge of the city's land.
 *
 * Parcels are found through a coarse grid, so a lookup is a handful of
 * comparisons however large the holding.
 */
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  RingGeometry,
  Vector2,
  Vector3,
  type Camera,
} from 'three';
import type { Parcel } from './layout.ts';

const CELL = 8;

export interface ParcelPicker {
  /** The parcel whose ground contains (x, z), or null. */
  parcelAt(x: number, z: number): Parcel | null;
}

export function createParcelPicker(parcels: readonly Parcel[]): ParcelPicker {
  const grid = new Map<string, Parcel[]>();
  const key = (gx: number, gz: number): string => `${gx}:${gz}`;
  for (const parcel of parcels) {
    const x0 = Math.floor((parcel.x - parcel.width / 2) / CELL);
    const x1 = Math.floor((parcel.x + parcel.width / 2) / CELL);
    const z0 = Math.floor((parcel.z - parcel.depth / 2) / CELL);
    const z1 = Math.floor((parcel.z + parcel.depth / 2) / CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const list = grid.get(key(gx, gz)) ?? [];
        list.push(parcel);
        grid.set(key(gx, gz), list);
      }
    }
  }
  return {
    parcelAt(x, z) {
      const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
      // Include the earthen bank around each parcel, so a pointer on a dike still counts.
      return (
        list.find(
          (p) => Math.abs(x - p.x) <= p.width / 2 + 0.3 && Math.abs(z - p.z) <= p.depth / 2 + 0.3,
        ) ?? null
      );
    },
  };
}

const ground = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const pointer = new Vector2();
const hit = new Vector3();

/** Where a pointer at (clientX, clientY) on the canvas meets the ground, or null. */
export function groundPoint(
  camera: Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; z: number } | null {
  const box = canvas.getBoundingClientRect();
  pointer.set(
    ((clientX - box.left) / box.width) * 2 - 1,
    -((clientY - box.top) / box.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(ground, hit) ? { x: hit.x, z: hit.z } : null;
}

export interface FrontierMarker {
  readonly group: Group;
  /** Puts the handle on a parcel's outer corner (away from the city). */
  placeAt(parcel: Parcel | null, away: { x: number; z: number }): void;
  setActive(active: boolean): void;
  update(time: number): void;
  setColour(colour: Color): void;
}

/** A banner-post and a pulsing ring: the edge of the fields, grabbable. */
export function createFrontierMarker(): FrontierMarker {
  const group = new Group();
  group.name = 'field-edge-handle';
  const glow = new MeshBasicMaterial({
    color: new Color('#ffd27a').multiplyScalar(2.2),
    toneMapped: false,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const ring = new Mesh(new RingGeometry(1.6, 2.1, 40), glow);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  const post = new Mesh(
    new CylinderGeometry(0.12, 0.12, 3.4, 8),
    new MeshBasicMaterial({ color: '#f6e7c4' }),
  );
  post.position.y = 1.7;
  const tip = new Mesh(new CylinderGeometry(0.0, 0.42, 0.8, 4), glow);
  tip.position.y = 3.6;
  tip.rotation.x = Math.PI;
  group.add(ring, post, tip);
  group.visible = false;
  let active = false;
  return {
    group,
    placeAt(parcel, away) {
      group.visible = parcel !== null;
      if (!parcel) return;
      const dx = Math.sign(parcel.x - away.x) || 1;
      const dz = Math.sign(parcel.z - away.z) || 1;
      group.position.set(parcel.x + (dx * parcel.width) / 2, 0, parcel.z + (dz * parcel.depth) / 2);
    },
    setActive(next) {
      active = next;
    },
    update(time) {
      const pulse = active ? 1.35 : 1 + Math.sin(time * 3) * 0.08;
      ring.scale.setScalar(pulse);
      glow.opacity = active ? 1 : 0.75 + Math.sin(time * 3) * 0.15;
    },
    setColour(colour) {
      glow.color.copy(colour).multiplyScalar(2.2);
    },
  };
}
