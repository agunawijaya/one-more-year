/**
 * Armies in the valley: an invasion told as the old painters told battles,
 * stylised and bloodless.
 *
 *   on the road   the attacker's column, three abreast and as long as its
 *                 army (three figures for every two soldiers), marches the whole
 *                 road from its own gate to the walls it wants, pennants
 *                 every few ranks, its banner at the head, dust rising
 *                 from its feet;
 *   at the walls  the defenders file out and form a curved line before
 *                 their gate, pikes up;
 *   the clash     the front ranks lower their pikes into painted spear-
 *                 lines, pennants of both sides whirl about the meeting
 *                 point in a swirl of dust.
 *
 * Progress runs 0 (setting out) → 1 (at the walls) → 1.15 (the clash done).
 * Everything here is instanced and placed from the progress and the clock,
 * so the scene never rebuilds while an army moves.
 */
import {
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  type Material,
} from 'three';
import type { Realm } from '../engine/state.ts';
import { createBanner, type Banner } from './banners.ts';
import type { FrescoUniforms } from './materials.ts';
import type { ScenePalette } from './palette.ts';
import { PartsBuilder, SURFACE } from './parts.ts';
import type { Point } from './layout.ts';

export interface March {
  from: number;
  to: number;
  /** 0 setting out, 1 at the walls, up to 1.15 the clash. */
  progress: number;
  /** The army that marches; the column has three figures for every two soldiers. */
  soldiers?: number;
  /** The garrison that forms up at the walls. */
  defenders?: number;
}

export interface ArmyRoute {
  march: March;
  road: readonly Point[];
  /** Where on the road the column leaves its gate and where it meets the walls (0–1). */
  start: number;
  end: number;
  /** The defenders' city and how far its walls reach. */
  target: Point;
  targetRadius: number;
}

export interface Armies {
  readonly group: Group;
  show(routes: readonly ArmyRoute[], realms: readonly Realm[], palette: ScenePalette): void;
  /** Places every figure for these progresses at this time (seconds). */
  place(progresses: readonly number[], time: number): void;
  /** Where the march `index` meets the walls: the heart of its clash. */
  clashPoint(index: number): Point | null;
  dispose(): void;
}

const FILES = 3;
const FILE_GAP = 1.7;
const RANK_GAP = 1.8;
const PENNANT_EVERY = 3;
/** Pennants the garrison raises at the clash, after the column's own. */
const GARRISON_PENNANTS = 10;
const DUST_PER_COLUMN = 30;
const SWIRL = 30;
const FIGURE_SCALE = 1.8;

export function columnSize(soldiers: number | undefined): number {
  return Math.max(48, Math.min(240, Math.round((soldiers ?? 60) * 1.5)));
}

export function garrisonSize(defenders: number | undefined): number {
  return Math.max(12, Math.min(90, Math.round((defenders ?? 30) / 2)));
}

export function pointOnRoad(road: readonly Point[], t: number): Point {
  const scaled = Math.max(0, Math.min(1, t)) * (road.length - 1);
  const i = Math.min(road.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = road[i] as Point;
  const b = road[i + 1] as Point;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
}

export function roadLength(road: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1] as Point;
    const b = road[i] as Point;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

export function tinctureColour(tincture: string): string {
  const colours: Record<string, string> = {
    or: '#c9973f',
    argent: '#e8e0cc',
    gules: '#b3301e',
    azure: '#2a5a96',
    vert: '#2f7048',
    sable: '#3a302a',
    purpure: '#6a3778',
  };
  return colours[tincture] ?? '#9b2a1a';
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A soldier's tunic and head; tinted per figure with the livery. */
function tunicGeometry(): PartsBuilder {
  const white = new Color('#ffffff');
  const parts = new PartsBuilder();
  parts.object(1).cone(0, 0, 0.9, 2.8, 7, white, SURFACE.plain);
  parts.prism(0, 0, 0.42, 0.7, 6, white, SURFACE.skin, 2.5);
  return parts;
}

/** A pike: the shaft and its head, which keep their own colours. */
function pikeGeometry(): PartsBuilder {
  const parts = new PartsBuilder();
  parts.object(1);
  parts.box(0.8, 0, 0.13, 0.13, 4.6, new Color('#5a4128'), { sides: SURFACE.wood });
  parts.cone(0.8, 0, 0.24, 0.9, 4, new Color('#d4d2c8'), SURFACE.plain, 4.6);
  return parts;
}

/** A pennant on a tall pole: a swallow-tailed streamer, painted on both faces, tinted per instance. */
function pennantGeometry(): PartsBuilder {
  const white = new Color('#ffffff');
  const parts = new PartsBuilder();
  parts.object(1).box(0, 0, 0.12, 0.12, 7.2, new Color('#5a4128'), { sides: SURFACE.wood });
  const top = { x: 0, y: 7.1, z: 0 };
  const upperTail = { x: 3.3, y: 6.5, z: 0 };
  const notch = { x: 2.2, y: 6.15, z: 0 };
  const lowerTail = { x: 3.0, y: 5.55, z: 0 };
  const foot = { x: 0, y: 5.7, z: 0 };
  const faces: [typeof top, typeof top, typeof top][] = [
    [top, notch, upperTail],
    [top, foot, notch],
    [foot, lowerTail, notch],
  ];
  for (const [a, b, c] of faces) {
    parts.triangle(a, b, c, white, SURFACE.plain);
    parts.triangle(a, c, b, white, SURFACE.plain);
  }
  return parts;
}

/**
 * Dust as a painter brushes it: three curling strokes, each a ribbon that
 * sweeps round and rises, broad in its middle and thin at either end,
 * painted on both faces. Spun about its axis, it whirls.
 */
function dustGeometry(colour: Color): PartsBuilder {
  const parts = new PartsBuilder();
  parts.object(1);
  const pale = colour.clone().lerp(new Color('#f3ead6'), 0.35);
  const strokes = [
    { radius: 1.1, start: 0, sweep: 3.8, rise: 0.4, width: 0.7, tone: colour },
    { radius: 1.9, start: 2.1, sweep: 3.4, rise: 0.9, width: 0.6, tone: pale },
    { radius: 2.7, start: 4.4, sweep: 2.8, rise: 1.5, width: 0.45, tone: colour },
  ];
  const steps = 12;
  for (const stroke of strokes) {
    const edge = (i: number, outer: boolean): { x: number; y: number; z: number } => {
      const t = i / steps;
      const a = stroke.start + t * stroke.sweep;
      const width = stroke.width * Math.sin(Math.PI * t) + 0.04;
      const r = stroke.radius + (outer ? width : 0);
      return {
        x: Math.cos(a) * r,
        y: stroke.rise * (0.4 + t) + (outer ? width * 0.7 : 0),
        z: Math.sin(a) * r,
      };
    };
    for (let i = 0; i < steps; i++) {
      const a = edge(i, false);
      const b = edge(i + 1, false);
      const c = edge(i + 1, true);
      const d = edge(i, true);
      parts.quad(a, b, c, d, stroke.tone, SURFACE.plain);
      parts.quad(a, d, c, b, stroke.tone, SURFACE.plain);
    }
  }
  return parts;
}

function walkAttribute(count: number): InstancedBufferAttribute {
  // Marching soldiers bob in step but do not wander: a tiny lane, a quick step.
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) data.set([0.05, 0.05, 2.2, i * 0.7], i * 4);
  return new InstancedBufferAttribute(data, 4);
}

interface Column {
  route: ArmyRoute;
  attackers: number;
  defenders: number;
  /** First instance of this column in each mesh. */
  figureBase: number;
  pennantBase: number;
  pennants: number;
  dustBase: number;
  defenderBase: number;
  head: Banner | null;
  livery: [Color, Color];
  garrison: [Color, Color];
}

export function createArmies(options: {
  uniforms: FrescoUniforms;
  walkers: Material;
  still: Material;
}): Armies {
  const group = new Group();
  const dummy = new Object3D();
  let columns: Column[] = [];
  let meshes: InstancedMesh[] = [];
  let tunics: InstancedMesh | null = null;
  let pikes: InstancedMesh | null = null;
  let flags: InstancedMesh | null = null;
  let dust: InstancedMesh | null = null;

  function clear(): void {
    for (const mesh of meshes) {
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const column of columns) {
      if (column.head) {
        group.remove(column.head.group);
        column.head.dispose();
      }
    }
    meshes = [];
    columns = [];
    tunics = null;
    pikes = null;
    flags = null;
    dust = null;
  }

  function hide(mesh: InstancedMesh, index: number): void {
    dummy.position.set(0, -50, 0);
    dummy.scale.setScalar(0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  function setFigure(index: number, at: Point, heading: number, lean: number, scale: number): void {
    if (!tunics || !pikes) return;
    dummy.position.set(at.x, 0.1, at.z);
    dummy.rotation.set(0, -heading + Math.PI / 2, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    tunics.setMatrixAt(index, dummy.matrix);
    // The pike leans forward as the ranks close: a painted spear-line.
    dummy.rotation.set(0, -heading + Math.PI / 2, 0);
    dummy.rotateX(lean);
    dummy.updateMatrix();
    pikes.setMatrixAt(index, dummy.matrix);
  }

  return {
    group,
    show(routes, realms, palette) {
      clear();
      if (routes.length === 0) return;
      let figures = 0;
      let pennantCount = 0;
      columns = routes.map((route) => {
        const attackers = columnSize(route.march.soldiers);
        const defenders = garrisonSize(route.march.defenders);
        const ranks = Math.ceil(attackers / FILES);
        const pennants = Math.ceil(ranks / PENNANT_EVERY) + GARRISON_PENNANTS;
        const invader = realms.find((r) => r.seat === route.march.from);
        const target = realms.find((r) => r.seat === route.march.to);
        const field = new Color(invader ? tinctureColour(invader.arms.field) : '#9b2a1a');
        const charge = invader ? new Color(tinctureColour(invader.arms.chargeTincture)) : field;
        const home = new Color(target ? tinctureColour(target.arms.field) : '#2a5a96');
        const homeCharge = target ? new Color(tinctureColour(target.arms.chargeTincture)) : home;
        const head = invader
          ? createBanner(invader.arms, options.uniforms, options.still, { pole: 15, size: 7.5 })
          : null;
        if (head) group.add(head.group);
        const column: Column = {
          route,
          attackers,
          defenders,
          figureBase: figures,
          pennantBase: pennantCount,
          pennants,
          dustBase: 0,
          defenderBase: figures + attackers,
          head,
          livery: [field, charge],
          garrison: [home, homeCharge],
        };
        figures += attackers + defenders;
        pennantCount += pennants;
        return column;
      });
      const dustColour = palette.road.clone().lerp(palette.ground, 0.35);
      tunics = new InstancedMesh(tunicGeometry().build(), options.walkers, figures);
      pikes = new InstancedMesh(pikeGeometry().build(), options.walkers, figures);
      flags = new InstancedMesh(pennantGeometry().build(), options.still, pennantCount);
      dust = new InstancedMesh(
        dustGeometry(dustColour).build(),
        options.still,
        columns.length * (DUST_PER_COLUMN + SWIRL),
      );
      columns.forEach((column, m) => {
        column.dustBase = m * (DUST_PER_COLUMN + SWIRL);
        for (let i = 0; i < column.attackers; i++) {
          const rank = Math.floor(i / FILES);
          tunics?.setColorAt(column.figureBase + i, column.livery[rank % 2] as Color);
        }
        for (let i = 0; i < column.defenders; i++) {
          tunics?.setColorAt(column.defenderBase + i, column.garrison[i % 3 === 0 ? 1 : 0]);
        }
        for (let i = 0; i < column.pennants; i++) {
          // The last few are the defenders' pennants, raised at the clash.
          const own = i < column.pennants - GARRISON_PENNANTS;
          const colour = own ? column.livery[i % 2] : column.garrison[i % 2];
          flags?.setColorAt(column.pennantBase + i, colour as Color);
        }
      });
      tunics.geometry.setAttribute('aWalk', walkAttribute(figures));
      pikes.geometry.setAttribute('aWalk', walkAttribute(figures));
      meshes = [tunics, pikes, flags, dust];
      for (const mesh of meshes) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        group.add(mesh);
      }
    },
    place(progresses, time) {
      const tunicMesh = tunics;
      const pikeMesh = pikes;
      const flagMesh = flags;
      const dustMesh = dust;
      if (!tunicMesh || !pikeMesh || !flagMesh || !dustMesh) return;
      columns.forEach((column, m) => {
        const progress = progresses[m] ?? 0;
        const { road, start, end, target, targetRadius } = column.route;
        const length = roadLength(road);
        const rankGap = RANK_GAP / length;
        const marching = Math.min(1, Math.max(0, progress));
        const head = start + (end - start) * marching;
        const clash = smooth(0.98, 1.06, progress);
        const ranks = Math.ceil(column.attackers / FILES);
        const headAt = pointOnRoad(road, head);
        const toward = Math.atan2(target.z - headAt.z, target.x - headAt.x);

        // The column: ranks four abreast behind its head, out of sight until they leave the gate.
        for (let i = 0; i < column.attackers; i++) {
          const index = column.figureBase + i;
          const rank = Math.floor(i / FILES);
          const file = i % FILES;
          const along = head - rank * rankGap;
          if (progress <= 0 || along < start) {
            hide(tunicMesh, index);
            hide(pikeMesh, index);
            continue;
          }
          const p = pointOnRoad(road, along);
          const ahead = pointOnRoad(road, Math.min(1, along + 0.01));
          let heading = Math.atan2(ahead.z - p.z, ahead.x - p.x);
          const side = (file - (FILES - 1) / 2) * FILE_GAP;
          // At the clash the front ranks fan out into a wedge before the walls.
          const front = Math.max(0, 1 - rank / 6) * clash;
          const spread = side * (1 + front * 1.8);
          const at = { x: p.x - Math.sin(heading) * spread, z: p.z + Math.cos(heading) * spread };
          if (front > 0) heading = heading + (toward - heading) * front;
          setFigure(index, at, heading, -1.1 * front, FIGURE_SCALE);
        }

        // The garrison: out of its gate and into a curved line facing the column.
        const formed = smooth(0.55, 0.92, progress);
        for (let i = 0; i < column.defenders; i++) {
          const index = column.defenderBase + i;
          if (formed <= 0) {
            hide(tunicMesh, index);
            hide(pikeMesh, index);
            continue;
          }
          const row = i % 2;
          const k = Math.floor(i / 2) / Math.max(1, Math.ceil(column.defenders / 2) - 1);
          const facing = toward + Math.PI;
          const angle = facing + (k - 0.5) * 1.6;
          const radius = targetRadius + 3 + row * 1.6;
          const home = { x: target.x, z: target.z };
          const line = {
            x: target.x + Math.cos(angle) * radius,
            z: target.z + Math.sin(angle) * radius,
          };
          const at = {
            x: home.x + (line.x - home.x) * formed,
            z: home.z + (line.z - home.z) * formed,
          };
          setFigure(index, at, angle, -1.1 * clash * (row === 0 ? 1 : 0.4), FIGURE_SCALE);
        }

        // Pennants: on tall poles every few ranks; at the clash, both sides' whirl about the
        // meeting point.
        const meet = {
          x: target.x + Math.cos(toward + Math.PI) * (targetRadius + 6),
          z: target.z + Math.sin(toward + Math.PI) * (targetRadius + 6),
        };
        for (let i = 0; i < column.pennants; i++) {
          const index = column.pennantBase + i;
          const own = i < column.pennants - GARRISON_PENNANTS;
          const rank = i * PENNANT_EVERY;
          const along = head - rank * rankGap;
          if (progress <= 0 || (own && (rank >= ranks || along < start)) || (!own && formed <= 0)) {
            hide(flagMesh, index);
            continue;
          }
          let at: Point;
          let turn: number;
          if (own) {
            const p = pointOnRoad(road, along);
            const ahead = pointOnRoad(road, Math.min(1, along + 0.01));
            const heading = Math.atan2(ahead.z - p.z, ahead.x - p.x);
            at = { x: p.x + Math.sin(heading) * 3.4, z: p.z - Math.cos(heading) * 3.4 };
            turn = -heading + Math.PI + Math.sin(time * 2.2 + i) * 0.25;
          } else {
            const k = (i - (column.pennants - GARRISON_PENNANTS)) / (GARRISON_PENNANTS - 1);
            const angle = toward + Math.PI + (k - 0.5) * 1.4;
            at = {
              x: target.x + Math.cos(angle) * (targetRadius + 2),
              z: target.z + Math.sin(angle) * (targetRadius + 2),
            };
            turn = -angle + Math.sin(time * 2 + i) * 0.3;
          }
          if (clash > 0 && (i < 8 || !own)) {
            // The swirl: pennants circle the meeting point, streaming as they go.
            const a = time * 0.9 + i * 0.85;
            const r = 5 + (i % 4) * 2.6;
            const swirl = { x: meet.x + Math.cos(a) * r, z: meet.z + Math.sin(a) * r * 0.7 };
            at = { x: at.x + (swirl.x - at.x) * clash, z: at.z + (swirl.z - at.z) * clash };
            turn = turn + (-a - turn) * clash;
          }
          dummy.position.set(at.x, 0, at.z);
          dummy.rotation.set(0, turn, 0);
          dummy.scale.setScalar(1.3);
          dummy.updateMatrix();
          flagMesh.setMatrixAt(index, dummy.matrix);
        }

        // Dust: billows rising from the feet along the column, and at the clash a ring of them.
        for (let i = 0; i < DUST_PER_COLUMN + SWIRL; i++) {
          const index = column.dustBase + i;
          const phase = i * 1.37;
          const breathe = 0.65 + 0.35 * Math.sin(time * 1.4 + phase);
          if (i < DUST_PER_COLUMN) {
            const along = head - ((i + 0.5) / DUST_PER_COLUMN) * ranks * rankGap * 1.05;
            if (progress <= 0 || along < start || progress > 1.12) {
              hide(dustMesh, index);
              continue;
            }
            const p = pointOnRoad(road, along);
            const side = (i % 2 === 0 ? -1 : 1) * (3.4 + (i % 3));
            const ahead = pointOnRoad(road, Math.min(1, along + 0.01));
            const heading = Math.atan2(ahead.z - p.z, ahead.x - p.x);
            dummy.position.set(p.x - Math.sin(heading) * side, 0, p.z + Math.cos(heading) * side);
            dummy.scale.setScalar(breathe * (1.5 + (i % 4) * 0.3));
          } else {
            if (clash <= 0) {
              hide(dustMesh, index);
              continue;
            }
            const k = i - DUST_PER_COLUMN;
            const a = time * 0.6 + (k / SWIRL) * Math.PI * 2;
            const r = 6 + (k % 4) * 2.8 + Math.sin(time + k) * 1.4;
            dummy.position.set(meet.x + Math.cos(a) * r, 0, meet.z + Math.sin(a) * r * 0.65);
            dummy.scale.setScalar(clash * breathe * (1.8 + (k % 3) * 0.5));
          }
          // The swirls turn, one way and the other.
          dummy.rotation.set(0, phase + time * (i % 2 === 0 ? 0.9 : -0.7), 0);
          dummy.updateMatrix();
          dustMesh.setMatrixAt(index, dummy.matrix);
        }

        if (column.head) {
          const at = progress > 1 ? meet : headAt;
          column.head.group.position.set(at.x, 0, at.z);
          column.head.group.visible = progress > 0;
        }
      });
      for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    },
    clashPoint(index) {
      const column = columns[index];
      if (!column) return null;
      const { road, end, target, targetRadius } = column.route;
      const near = pointOnRoad(road, end);
      const toward = Math.atan2(target.z - near.z, target.x - near.x);
      return {
        x: target.x + Math.cos(toward + Math.PI) * (targetRadius + 6),
        z: target.z + Math.sin(toward + Math.PI) * (targetRadius + 6),
      };
    },
    dispose: clear,
  };
}
