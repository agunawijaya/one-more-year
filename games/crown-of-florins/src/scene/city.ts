/**
 * The city in three dimensions, built from its plan: walls and gates, the
 * cathedral at its stage, the palace in its pieces, markets, the granary,
 * houses, towers, chapels, cottages and mills. Static parts are merged into
 * a few meshes painted by the pigment material; things that move (mill
 * wheels, banners, flames) are kept apart so they can be animated cheaply.
 *
 * `buildCity` is called again whenever the plan changes (a new year, a
 * purchase, a preview while dragging): building a city takes a few
 * milliseconds, so there is no need to patch geometry in place.
 */
import type { BufferGeometry, Matrix4 } from 'three';
import { Color, Group, InstancedMesh, Mesh, Object3D, Vector4, type Material } from 'three';
import { PartsBuilder, SURFACE, type Surface } from './parts.ts';
import type { CityPlan, Lot, Mill, Point } from './layout.ts';
import type { ScenePalette } from './palette.ts';

export interface Preview {
  /** The next piece of work shown in scaffolding while a card is dragged. */
  kind: 'cathedral' | 'palace' | 'market' | 'mill' | null;
}

export interface CityOptions {
  preview?: Preview;
  /** A gold crown on the palace tower: the realm is a kingdom. */
  crowned?: boolean;
}

export interface CityModel {
  group: Group;
  /** Torches for the night: position and strength. */
  torches: Vector4[];
  /** Where the crown sits on the palace (or cathedral), for the gilding to spread from. */
  crownPoint: { x: number; y: number; z: number };
  /** The roof the city's banner stands on: the palace tower once built, something lower before. */
  bannerPoint: { x: number; y: number; z: number };
  wheels: InstancedMesh | null;
  update(time: number): void;
  dispose(): void;
}

const WALL_HEIGHT = 5.5;
const WALL_THICKNESS = 1.7;

export function buildCity(
  plan: CityPlan,
  palette: ScenePalette,
  material: Material,
  options: CityOptions = {},
): CityModel {
  const parts = new PartsBuilder();
  const torches: Vector4[] = [];
  const group = new Group();
  group.name = 'city';

  buildWalls(parts, plan, palette, torches);
  buildPiazza(parts, plan, palette, torches);
  const crown = buildPalace(
    parts,
    plan.palacePieces,
    palette,
    torches,
    options.preview?.kind === 'palace',
  );
  if (options.crowned) buildCrown(parts, crown, palette);
  buildCathedral(
    parts,
    plan.cathedralStage,
    plan.cathedralAdornments,
    palette,
    torches,
    options.preview?.kind === 'cathedral',
  );
  buildGranary(parts, plan, palette);
  buildStalls(parts, plan, palette);
  for (const lot of plan.houses) buildHouse(parts, lot, palette);
  for (const lot of plan.towers) buildTower(parts, lot, palette);
  for (const lot of plan.chapels) buildChapel(parts, lot, palette);
  for (const lot of plan.serfHouses) buildCottage(parts, lot, palette);
  for (const mill of plan.mills) buildMillHouse(parts, mill, palette);
  buildGuardTower(parts, plan, palette, torches);

  const mesh = new Mesh(parts.build(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const wheels = plan.mills.length > 0 ? buildWheels(plan, palette, material) : null;
  if (wheels) group.add(wheels);

  const dummy = new Object3D();
  return {
    group,
    torches,
    crownPoint: crown,
    bannerPoint: bannerPointFor(plan, crown),
    wheels,
    update(time) {
      if (!wheels) return;
      plan.mills.forEach((mill, i) => {
        placeWheel(dummy, mill, time);
        wheels.setMatrixAt(i, dummy.matrix);
      });
      wheels.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.geometry.dispose();
      wheels?.geometry.dispose();
    },
  };
}

/**
 * Where the city flies its arms: from the palace tower once it stands, else from the corner of the
 * palace hall, else from the guard tower, else from the wall tower by the main gate. A banner is
 * never left hanging in the air where a building has yet to rise.
 */
function bannerPointFor(
  plan: CityPlan,
  crown: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  // The banner's group sits 2.4 below this point, so each height here is the roof it stands on plus 2.4.
  if (plan.palacePieces >= 5) return { x: crown.x, y: crown.y + 1.5, z: crown.z };
  if (plan.palacePieces >= 1) return { x: 15.4, y: 11.5 + 2.4, z: -6.4 };
  if (plan.guardTower !== 'none') {
    const tower = guardTowerSite(plan);
    return { x: tower.x - 0.4, y: tower.height + 1.4 + 2.4, z: tower.z - 0.4 };
  }
  const at = plan.guardTowerAt;
  return { x: at.x - 0.4, y: WALL_HEIGHT + 3.6 + 2.4, z: at.z - 0.4 };
}

/** The guard tower stands just inside the wall near the main gate, taller once the garrison is full. */
function guardTowerSite(plan: CityPlan): { x: number; z: number; height: number } {
  const at = plan.guardTowerAt;
  const inward = Math.hypot(at.x, at.z) || 1;
  return {
    x: at.x - (at.x / inward) * 5,
    z: at.z - (at.z / inward) * 5,
    height: plan.guardTower === 'full' ? 19 : 13,
  };
}

// ---- walls -----------------------------------------------------------------------

function buildWalls(
  parts: PartsBuilder,
  plan: CityPlan,
  palette: ScenePalette,
  torches: Vector4[],
): void {
  const stone = palette.wallStone;
  plan.wall.forEach((a, i) => {
    const b = plan.wall[(i + 1) % plan.wall.length] as Point;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    parts.object().box(mid.x, mid.z, length, WALL_THICKNESS, WALL_HEIGHT, stone, {
      angle: -angle,
      sides: SURFACE.stone,
    });
    parts.battlements(a.x, a.z, b.x, b.z, WALL_HEIGHT, stone, 0.85, true);
    if (plan.gates.includes(i)) buildGate(parts, mid, angle, stone, palette, torches);
  });
  // A tower at every corner of the circuit.
  plan.wall.forEach((corner, i) => {
    const prev = plan.wall[(i + plan.wall.length - 1) % plan.wall.length] as Point;
    const next = plan.wall[(i + 1) % plan.wall.length] as Point;
    const angle = Math.atan2(next.z - prev.z, next.x - prev.x);
    parts.object().box(corner.x, corner.z, 4.4, 4.4, WALL_HEIGHT + 3.6, stone, {
      angle: -angle,
      sides: SURFACE.stone,
    });
    const top = WALL_HEIGHT + 3.6;
    const h = 2.2;
    const c = Math.cos(-angle);
    const s = Math.sin(-angle);
    const corners = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ].map(([u = 0, v = 0]) => ({ x: corner.x + u * c + v * s, z: corner.z - u * s + v * c }));
    corners.forEach((p, k) => {
      const q = corners[(k + 1) % 4] as Point;
      parts.battlements(p.x, p.z, q.x, q.z, top, stone, 0.8, false);
    });
    if (i % 2 === 0) torches.push(new Vector4(corner.x, top + 1.2, corner.z, 1.4));
  });
}

function buildGate(
  parts: PartsBuilder,
  at: Point,
  angle: number,
  stone: Color,
  palette: ScenePalette,
  torches: Vector4[],
): void {
  parts
    .object()
    .box(at.x, at.z, 7, 4.6, WALL_HEIGHT + 4.5, stone, { angle: -angle, sides: SURFACE.stone });
  parts.hipRoof(at.x, at.z, 7.2, 4.8, 1.8, WALL_HEIGHT + 4.5, palette.roof, -angle);
  // The dark arch on both faces, wound so each faces outward from the gatehouse.
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  for (const side of [-1, 1]) {
    const v = side * 2.32;
    const p = (u: number, y: number): { x: number; y: number; z: number } => ({
      x: at.x + u * c + v * s,
      y,
      z: at.z - u * s + v * c,
    });
    const left = side * -1.4;
    const right = side * 1.4;
    parts.quad(
      p(left, 0),
      p(right, 0),
      p(right, 3.4),
      p(left, 3.4),
      palette.wallStone,
      SURFACE.window,
    );
    parts.triangle(p(left, 3.4), p(right, 3.4), p(0, 4.6), palette.wallStone, SURFACE.window);
    torches.push(new Vector4(at.x + v * s * 1.3, 3.8, at.z + v * c * 1.3, 2.2));
  }
}

function buildGuardTower(
  parts: PartsBuilder,
  plan: CityPlan,
  palette: ScenePalette,
  torches: Vector4[],
): void {
  if (plan.guardTower === 'none') return;
  const { x, z, height } = guardTowerSite(plan);
  const full = plan.guardTower === 'full';
  parts.object().box(x, z, 5, 5, height, palette.wallStone, { sides: SURFACE.stone });
  parts.box(x, z, 6, 6, 1.4, palette.wallStone, { base: height, sides: SURFACE.stone });
  for (const [ax, az, bx, bz] of [
    [-3, -3, 3, -3],
    [3, -3, 3, 3],
    [3, 3, -3, 3],
    [-3, 3, -3, -3],
  ] as const) {
    parts.battlements(x + ax, z + az, x + bx, z + bz, height + 1.4, palette.wallStone, 0.85, false);
  }
  if (full) {
    // The lookout's turret, added once the garrison is strong enough.
    parts.box(x + 1.2, z - 1.2, 2.4, 2.4, 3.6, palette.wallStone, {
      base: height + 1.4,
      sides: SURFACE.stone,
    });
    parts.cone(x + 1.2, z - 1.2, 1.9, 2.6, 4, palette.roof, SURFACE.roof, height + 5);
  }
  torches.push(new Vector4(x, height + 2.5, z, 2));
}

// ---- piazza, palace, cathedral -------------------------------------------------------

function buildPiazza(
  parts: PartsBuilder,
  plan: CityPlan,
  palette: ScenePalette,
  torches: Vector4[],
): void {
  const { width, depth } = plan.piazza;
  const brick = new Color(palette.roof).lerp(palette.road, 0.45);
  parts.object().box(0, 0, width, depth, 0.12, brick, { top: SURFACE.paving });
  // A fountain at the heart of the piazza.
  parts.object().prism(-2, 1, 1.9, 0.9, 10, palette.marbleLight, SURFACE.stone);
  parts.prism(-2, 1, 0.35, 2.6, 6, palette.marbleLight, SURFACE.plain);
  parts.prism(-2, 1, 0.9, 0.3, 8, palette.marbleLight, SURFACE.plain, 2.2);
  torches.push(new Vector4(-2, 2.5, 1, 1.8));
}

/** Builds the palace's pieces; returns the point where a crown would sit on its tower. */
function buildPalace(
  parts: PartsBuilder,
  pieces: number,
  palette: ScenePalette,
  torches: Vector4[],
  preview: boolean,
): { x: number; y: number; z: number } {
  const stone = new Color(palette.plaster[3] ?? palette.wallStone).lerp(palette.wallStone, 0.4);
  const crown = { x: 16.2, y: 36, z: -5.6 };
  const shown = preview ? pieces + 1 : pieces;
  const kindOf = (piece: number): Surface =>
    preview && piece === shown ? SURFACE.scaffold : SURFACE.facade;
  const battlements = pieces >= 6;
  if (shown >= 1) {
    parts.object().box(20.5, 1, 11, 16, 11.5, stone, { sides: kindOf(1) });
    if (battlements) {
      for (const [ax, az, bx, bz] of [
        [15, -7, 26, -7],
        [26, -7, 26, 9],
        [26, 9, 15, 9],
        [15, 9, 15, -7],
      ] as const) {
        parts.battlements(ax, az, bx, bz, 11.5, stone, 0.95, true);
      }
    } else {
      parts.hipRoof(20.5, 1, 16, 11, 2.4, 11.5, palette.roof, Math.PI / 2);
    }
    torches.push(new Vector4(14.4, 4, 1, 2));
  }
  if (shown >= 2) {
    parts.object().box(21.5, -9, 9, 4.4, 8.5, stone, { sides: kindOf(2) });
    parts.gableRoof(21.5, -9, 9, 4.4, 1.6, 8.5, palette.roof);
  }
  if (shown >= 3) {
    parts.object().box(21.5, 11, 9, 4.4, 8.5, stone, { sides: kindOf(3) });
    parts.gableRoof(21.5, 11, 9, 4.4, 1.6, 8.5, palette.roof);
  }
  if (shown >= 4) {
    // The loggia: three tall arches on slender piers, open to the piazza.
    const kind = kindOf(4);
    parts.object();
    for (const z of [-5, -0.8, 3.4, 7.6])
      parts.box(13.4, z, 0.8, 0.8, 6.4, palette.marbleLight, {
        sides: kind === SURFACE.scaffold ? SURFACE.scaffold : SURFACE.plain,
      });
    parts.box(13.4, 1.3, 1.6, 13.4, 1.4, palette.marbleLight, {
      base: 6.4,
      sides: kind === SURFACE.scaffold ? SURFACE.scaffold : SURFACE.marble,
    });
    parts.box(14.4, 1.3, 0.3, 12.6, 6.4, palette.wallStone, { sides: SURFACE.window, top: null });
    torches.push(new Vector4(13.6, 5, -2.9, 2.4), new Vector4(13.6, 5, 5.5, 2.4));
  }
  if (shown >= 5) {
    // The tower: tall and plain, then the machicolated gallery and the belfry above it.
    const kind = kindOf(5);
    parts.object().box(16.2, -5.6, 3.6, 3.6, 29, stone, {
      sides: kind === SURFACE.scaffold ? SURFACE.scaffold : SURFACE.stone,
    });
    parts.box(16.2, -5.6, 4.8, 4.8, 2.4, stone, { base: 29, sides: SURFACE.stone });
    for (const [ax, az, bx, bz] of [
      [-2.4, -2.4, 2.4, -2.4],
      [2.4, -2.4, 2.4, 2.4],
      [2.4, 2.4, -2.4, 2.4],
      [-2.4, 2.4, -2.4, -2.4],
    ] as const) {
      parts.battlements(16.2 + ax, -5.6 + az, 16.2 + bx, -5.6 + bz, 31.4, stone, 0.75, true);
    }
    parts.box(16.2, -5.6, 2.4, 2.4, 3.2, stone, { base: 31.4, sides: SURFACE.facade });
    parts.cone(16.2, -5.6, 1.9, 2.6, 4, palette.roof, SURFACE.roof, 34.6);
    crown.y = 38;
    torches.push(new Vector4(16.2, 31, -5.6, 1.6));
  }
  if (pieces >= 7) {
    // Adornments: a gilded orb on the tower, then gilt on the loggia's frieze.
    parts.object().prism(16.2, -5.6, 0.5, 1.1, 6, palette.wallStone, SURFACE.gilt, 37.2);
  }
  if (pieces >= 8)
    parts
      .object()
      .box(13.4, 1.3, 1.7, 13.6, 0.4, palette.wallStone, { base: 7.8, sides: SURFACE.gilt });
  return crown;
}

/** A great gold crown set on the palace tower: a band, eight points, and a jewel on each. */
function buildCrown(
  parts: PartsBuilder,
  at: { x: number; y: number; z: number },
  palette: ScenePalette,
): void {
  const base = at.y - 1.6;
  parts.object().prism(at.x, at.z, 3.2, 1.6, 12, palette.wallStone, SURFACE.gilt, base);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = at.x + Math.cos(a) * 2.9;
    const z = at.z + Math.sin(a) * 2.9;
    parts.cone(x, z, 0.65, 2.6, 4, palette.wallStone, SURFACE.gilt, base + 1.6);
    parts.prism(x, z, 0.3, 0.45, 6, palette.awnings[0] ?? palette.roof, SURFACE.plain, base + 0.55);
  }
  parts.prism(at.x, at.z, 0.5, 2.2, 6, palette.wallStone, SURFACE.gilt, base + 1.6);
}

function buildCathedral(
  parts: PartsBuilder,
  stage: number,
  adornments: number,
  palette: ScenePalette,
  torches: Vector4[],
  preview: boolean,
): void {
  const marble = palette.marbleLight;
  const shown = preview ? Math.min(6, stage + 1) : stage;
  if (shown === 0) return;
  const scaffoldFor = (s: number): boolean => preview && s === shown && s > stage;
  const sides = (s: number, normal: Surface): Surface =>
    scaffoldFor(s) ? SURFACE.scaffold : normal;

  // 1 · foundations: the plan of the church laid out in low walls, with stone waiting to be raised.
  if (shown === 1) {
    parts.object();
    const low = 1.3;
    const stone = palette.wallStone;
    parts.box(0, -10, 16, 1.2, low, stone, { sides: SURFACE.stone });
    parts.box(0, -32, 16, 1.2, low, stone, { sides: SURFACE.stone });
    parts.box(-7.5, -21, 1.2, 22, low, stone, { sides: SURFACE.stone });
    parts.box(7.5, -21, 1.2, 22, low, stone, { sides: SURFACE.stone });
    parts.box(-9.5, -24.5, 4, 7, low * 0.7, stone, { sides: SURFACE.stone });
    parts.box(9.5, -24.5, 4, 7, low * 0.7, stone, { sides: SURFACE.stone });
    for (let i = 0; i < 6; i++)
      parts.box(-3 + (i % 3) * 1.6, -15 - Math.floor(i / 3) * 1.4, 1.3, 1, 0.8, stone, {
        sides: SURFACE.stone,
      });
  }
  // 2 · the nave.
  if (shown >= 2) {
    parts
      .object()
      .box(0, -21, 22, 8, 12, marble, { angle: Math.PI / 2, sides: sides(2, SURFACE.marble) });
    parts.gableRoof(0, -21, 22, 8, 3, 12, palette.roof, { angle: Math.PI / 2 });
  }
  // 3 · the aisles, lower on either side.
  if (shown >= 3) {
    for (const x of [-5.9, 5.9]) {
      parts
        .object()
        .box(x, -21, 22, 3.8, 7.5, marble, { angle: Math.PI / 2, sides: sides(3, SURFACE.marble) });
      parts.gableRoof(x, -21, 22, 3.8, 1.1, 7.5, palette.roof, { angle: Math.PI / 2 });
    }
  }
  // 4 · the façade: striped marble, three portals, a rose window and a pointed gable with pinnacles.
  if (shown >= 4) {
    const face = sides(4, SURFACE.marble);
    parts.object().box(0, -9.4, 17, 1.4, 16, marble, { sides: face });
    const front = -9.4 + 0.71;
    const gable = (x: number, y: number): { x: number; y: number; z: number } => ({
      x,
      y,
      z: front - 0.02,
    });
    parts.triangle(
      gable(-8.5, 16),
      gable(8.5, 16),
      gable(0, 22.5),
      marble,
      face,
      [0, 16, 17, 16, 8.5, 22.5],
    );
    // Roof planes behind the gable so it reads as solid from above.
    parts.quad(
      { x: -8.5, y: 16, z: -10.1 },
      { x: -8.5, y: 16, z: front - 0.03 },
      { x: 0, y: 22.5, z: front - 0.03 },
      { x: 0, y: 22.5, z: -10.1 },
      marble,
      SURFACE.marble,
    );
    parts.quad(
      { x: 8.5, y: 16, z: front - 0.03 },
      { x: 8.5, y: 16, z: -10.1 },
      { x: 0, y: 22.5, z: -10.1 },
      { x: 0, y: 22.5, z: front - 0.03 },
      marble,
      SURFACE.marble,
    );
    if (!scaffoldFor(4)) {
      const z = front + 0.03;
      // Pilasters divide the front into three bays, as on the great Tuscan façades.
      for (const x of [-8.1, -2.9, 2.9, 8.1]) {
        parts.box(x, front + 0.2, 0.9, 0.5, 16, palette.marbleDark, { sides: SURFACE.marble });
      }
      // A ledge and a gallery of small blind arches across the middle.
      parts.box(0, front + 0.25, 17.2, 0.6, 0.45, marble, { base: 7.6, sides: SURFACE.plain });
      for (let i = 0; i < 12; i++) {
        const x = -7.2 + i * 1.31;
        if (Math.abs(x) < 2.8) continue;
        parts.quad(
          { x: x - 0.32, y: 8.3, z },
          { x: x + 0.32, y: 8.3, z },
          { x: x + 0.32, y: 9.6, z },
          { x: x - 0.32, y: 9.6, z },
          marble,
          SURFACE.window,
        );
      }
      // Gold mosaic in the gable.
      parts.triangle(
        { x: -6, y: 16.6, z: z + 0.02 },
        { x: 6, y: 16.6, z: z + 0.02 },
        { x: 0, y: 21.1, z: z + 0.02 },
        marble,
        SURFACE.gilt,
      );
      // The rose window, its glass painted by the shader in rings and spokes.
      parts.quad(
        { x: -2.6, y: 9.9, z },
        { x: 2.6, y: 9.9, z },
        { x: 2.6, y: 15.1, z },
        { x: -2.6, y: 15.1, z },
        marble,
        SURFACE.rose,
        [0, 0, 1, 0, 1, 1, 0, 1],
      );
      for (const [x, w, h] of [
        [0, 3, 6],
        [-5.4, 1.9, 4.4],
        [5.4, 1.9, 4.4],
      ] as const) {
        parts.quad(
          { x: x - w / 2, y: 0, z },
          { x: x + w / 2, y: 0, z },
          { x: x + w / 2, y: h, z },
          { x: x - w / 2, y: h, z },
          marble,
          SURFACE.window,
        );
        parts.triangle(
          { x: x - w / 2, y: h, z },
          { x: x + w / 2, y: h, z },
          { x, y: h + w * 0.75, z },
          marble,
          SURFACE.window,
        );
      }
      torches.push(new Vector4(0, 3.5, -7.4, 2.6));
    }
    for (const x of [-8.5, 8.5]) parts.prism(x, -9.4, 0.7, 4.2, 6, marble, SURFACE.marble, 16);
    for (const x of [-8.5, 8.5]) parts.cone(x, -9.4, 0.75, 2.4, 6, marble, SURFACE.plain, 20.2);
  }
  // 5 · the transept and the dome on its octagonal drum, with a lantern.
  if (shown >= 5) {
    const kind = sides(5, SURFACE.marble);
    parts.object().box(0, -24.5, 22, 7, 12, marble, { sides: kind });
    parts.gableRoof(0, -24.5, 22, 7, 3, 12, palette.roof);
    parts.object().prism(0, -24.5, 5.4, 4.6, 8, marble, kind, 12.5);
    if (!scaffoldFor(5)) {
      parts.object().dome(0, -24.5, 5.6, 8.2, 17.1, 8, palette.dome);
      parts.prism(0, -24.5, 1.1, 2.4, 8, marble, SURFACE.marble, 25);
      parts.cone(0, -24.5, 1.2, 1.8, 8, marble, SURFACE.plain, 27.4);
    } else {
      // The dome in scaffolding: the timber centring that would carry it.
      parts.object().dome(0, -24.5, 5.8, 8, 17.1, 8, new Color('#d9c7a2'), 4);
    }
  }
  // 6 · the campanile, striped like the church.
  if (shown >= 6) {
    const kind = sides(6, SURFACE.marble);
    parts.object().box(13.2, -14.5, 4.4, 4.4, 30, marble, { sides: kind });
    parts.box(13.2, -14.5, 5, 5, 0.8, marble, { base: 30, sides: SURFACE.marble });
    parts.cone(13.2, -14.5, 3.3, 5.5, 4, palette.roof, SURFACE.roof, 30.8);
  }
  // Adornments: a gilded orb on the lantern, statues on the pinnacles, bronze doors, a gilded cross.
  if (adornments >= 1 && stage >= 5)
    parts.object().prism(0, -24.5, 0.55, 1.1, 6, marble, SURFACE.gilt, 29.2);
  if (adornments >= 2 && stage >= 4) {
    for (const x of [-8.5, 8.5])
      parts.object().prism(x, -9.4, 0.35, 1.4, 6, marble, SURFACE.gilt, 22.6);
    parts.object().prism(0, -9.4, 0.4, 1.8, 6, marble, SURFACE.gilt, 22.5);
  }
  if (adornments >= 3 && stage >= 4) {
    const z = -9.4 + 0.75;
    parts
      .object()
      .quad(
        { x: -1.2, y: 0, z },
        { x: 1.2, y: 0, z },
        { x: 1.2, y: 4.8, z },
        { x: -1.2, y: 4.8, z },
        marble,
        SURFACE.gilt,
      );
  }
  if (adornments >= 4 && stage >= 6)
    parts.object().box(13.2, -14.5, 0.25, 0.25, 2.6, marble, { base: 36.3, sides: SURFACE.gilt });
}

// ---- the granary and the markets -------------------------------------------------------

function buildGranary(parts: PartsBuilder, plan: CityPlan, palette: ScenePalette): void {
  const { x, z, fill } = plan.granary;
  const wood = new Color(palette.wallStone).lerp(palette.roof, 0.25);
  parts.object().box(x, z, 8, 10, 6.5, palette.plaster[1] ?? wood, { sides: SURFACE.facade });
  parts.gableRoof(x, z, 8, 10, 2.6, 6.5, palette.roof, {
    angle: Math.PI / 2,
    gableColor: palette.plaster[1] ?? wood,
  });
  // Sacks at the door, as many as the store can spare.
  const sacks = Math.round(fill * 14);
  const sack = new Color(palette.ground).lerp(palette.road, 0.6);
  for (let i = 0; i < sacks; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    parts.object().box(x + 4.8 + row * 0.9, z - 2.4 + col * 1.1, 0.9, 1, 0.7, sack, {
      base: row * 0.6,
      sides: SURFACE.plain,
    });
  }
}

function buildStalls(parts: PartsBuilder, plan: CityPlan, palette: ScenePalette): void {
  const wood = new Color('#7a5532').lerp(
    palette.wallStone,
    palette.appearance === 'dark' ? 0.4 : 0.1,
  );
  for (const stall of plan.stalls) {
    const c = Math.cos(stall.angle);
    const s = Math.sin(stall.angle);
    parts
      .object()
      .box(stall.x, stall.z, 2.6, 1, 1.1, wood, { angle: stall.angle, sides: SURFACE.wood });
    // The awning slopes down toward the shoppers.
    const at = (u: number, y: number, v: number): { x: number; y: number; z: number } => ({
      x: stall.x + u * c + v * s,
      y,
      z: stall.z - u * s + v * c,
    });
    const awning = palette.awnings[stall.tone % palette.awnings.length] as Color;
    parts.quad(
      at(-1.5, 2.4, -0.7),
      at(1.5, 2.4, -0.7),
      at(1.5, 1.9, 1.3),
      at(-1.5, 1.9, 1.3),
      awning,
      SURFACE.awning,
      [0, 0, 3, 0, 3, 2, 0, 2],
    );
    parts.quad(
      at(1.5, 2.4, -0.7),
      at(-1.5, 2.4, -0.7),
      at(-1.5, 1.9, 1.3),
      at(1.5, 1.9, 1.3),
      awning,
      SURFACE.awning,
      [3, 0, 0, 0, 0, 2, 3, 2],
    );
    for (const u of [-1.3, 1.3])
      parts.box(stall.x + u * c + 1.2 * s, stall.z - u * s + 1.2 * c, 0.14, 0.14, 1.9, wood, {
        sides: SURFACE.plain,
      });
    // Goods on the counter: bolts of cloth, baskets, jars.
    for (let i = 0; i < 3; i++) {
      const goods = palette.robes[(stall.tone + i * 2) % palette.robes.length] as Color;
      parts.box(
        stall.x + (i - 1) * 0.75 * c,
        stall.z - (i - 1) * 0.75 * s,
        0.55,
        0.5,
        0.42,
        goods,
        { base: 1.1, angle: stall.angle },
      );
    }
  }
}

// ---- houses, towers, chapels, cottages, mills ----------------------------------------

function buildHouse(parts: PartsBuilder, lot: Lot, palette: ScenePalette): void {
  const colour = palette.plaster[lot.tone % palette.plaster.length] as Color;
  parts.object().box(lot.x, lot.z, lot.width, lot.depth, lot.height, colour, {
    angle: lot.angle,
    sides: SURFACE.facade,
  });
  const long = lot.width >= lot.depth;
  parts.hipRoof(
    lot.x,
    lot.z,
    long ? lot.width : lot.depth,
    long ? lot.depth : lot.width,
    1.3,
    lot.height,
    roofTone(palette, lot.tone),
    lot.angle + (long ? 0 : Math.PI / 2),
    SURFACE.houseRoof,
  );
}

function buildTower(parts: PartsBuilder, lot: Lot, palette: ScenePalette): void {
  const colour = new Color(palette.wallStone).lerp(
    palette.plaster[lot.tone % palette.plaster.length] as Color,
    0.35,
  );
  parts
    .object()
    .box(lot.x, lot.z, lot.width, lot.depth, lot.height, colour, { sides: SURFACE.facade });
  const h = lot.width / 2;
  for (const [ax, az, bx, bz] of [
    [-h, -h, h, -h],
    [h, -h, h, h],
    [h, h, -h, h],
    [-h, h, -h, -h],
  ] as const) {
    parts.battlements(
      lot.x + ax,
      lot.z + az,
      lot.x + bx,
      lot.z + bz,
      lot.height,
      colour,
      0.65,
      false,
    );
  }
}

function buildChapel(parts: PartsBuilder, lot: Lot, palette: ScenePalette): void {
  parts.object().box(lot.x, lot.z, 4.2, 6, lot.height, palette.marbleLight, {
    angle: lot.angle,
    sides: SURFACE.marble,
  });
  parts.gableRoof(lot.x, lot.z, 4.2, 6, 1.8, lot.height, palette.roof, {
    angle: lot.angle + Math.PI / 2,
  });
  parts.box(lot.x, lot.z + 2.4, 1.4, 0.5, 2.2, palette.marbleLight, {
    base: lot.height,
    angle: lot.angle,
    sides: SURFACE.marble,
  });
}

function buildCottage(parts: PartsBuilder, lot: Lot, palette: ScenePalette): void {
  const colour = new Color(palette.plaster[lot.tone % palette.plaster.length]).lerp(
    palette.ground,
    0.35,
  );
  parts.object().box(lot.x, lot.z, lot.width, lot.depth, lot.height, colour, {
    angle: lot.angle,
    sides: SURFACE.plain,
  });
  parts.gableRoof(
    lot.x,
    lot.z,
    lot.width,
    lot.depth,
    1.2,
    lot.height,
    new Color(palette.roof).lerp(palette.ground, 0.3),
    { angle: lot.angle, kind: SURFACE.cottageRoof },
  );
}

function buildMillHouse(parts: PartsBuilder, mill: Mill, palette: ScenePalette): void {
  const colour = palette.plaster[2] ?? palette.wallStone;
  // A mill stands in the fields like a farm building: plain walls, and a roof the gold passes by.
  parts
    .object()
    .box(mill.x, mill.z, 4.4, 3.6, 4.2, colour, { angle: -mill.angle, sides: SURFACE.plain });
  parts.gableRoof(mill.x, mill.z, 4.4, 3.6, 1.6, 4.2, palette.roof, {
    angle: -mill.angle,
    kind: SURFACE.cottageRoof,
  });
}

function buildWheels(plan: CityPlan, palette: ScenePalette, material: Material): InstancedMesh {
  const parts = new PartsBuilder();
  const wood = new Color('#6b4a2c').lerp(
    palette.wallStone,
    palette.appearance === 'dark' ? 0.35 : 0,
  );
  // Built lying flat, axle upright: paddles around a rim and a hub.
  parts.object(1);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.box(Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0.9, 0.24, 0.6, wood, {
      base: -0.3,
      angle: -a,
      sides: SURFACE.wood,
    });
  }
  parts.prism(0, 0, 1.5, 0.5, 12, wood, SURFACE.wood, -0.25, false);
  parts.prism(0, 0, 0.35, 0.8, 6, wood, SURFACE.wood, -0.4);
  const geometry: BufferGeometry = parts.build();
  // Stand it up: the upright axle now runs along x, so the wheel turns about x.
  geometry.rotateZ(Math.PI / 2);
  const wheels = new InstancedMesh(geometry, material, plan.mills.length);
  wheels.castShadow = true;
  const dummy = new Object3D();
  plan.mills.forEach((mill, i) => {
    placeWheel(dummy, mill, 0);
    wheels.setMatrixAt(i, dummy.matrix);
  });
  return wheels;
}

function placeWheel(dummy: Object3D, mill: Mill, time: number): void {
  // Between the mill house and the water, its axle pointing at the stream so it turns with the current.
  const dx = mill.bank.x - mill.x;
  const dz = mill.bank.z - mill.z;
  const length = Math.hypot(dx, dz) || 1;
  dummy.position.set(mill.x + (dx / length) * 2.9, 1.5, mill.z + (dz / length) * 2.9);
  dummy.rotation.set(0, -Math.atan2(dz, dx), 0);
  dummy.rotateX(time * 0.9);
  dummy.updateMatrix();
}

function roofTone(palette: ScenePalette, tone: number): Color {
  return new Color(palette.roof).offsetHSL(((tone % 3) - 1) * 0.012, 0, ((tone % 4) - 1.5) * 0.025);
}

/** Exposed for tests: the transform of every wheel at a moment. */
export function wheelMatrix(mill: Mill, time: number): Matrix4 {
  const dummy = new Object3D();
  placeWheel(dummy, mill, time);
  return dummy.matrix.clone();
}
