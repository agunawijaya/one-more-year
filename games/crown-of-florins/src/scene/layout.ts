/**
 * The city as a plan, drawn from the realm's numbers every year. Pure and
 * testable: the scene tests read it back to check that the picture tells
 * the truth (walls grow with land, one stall row per market, the cathedral
 * at its stage, the palace in its pieces, figures in proportion to people).
 *
 * Units are about three metres. The piazza sits at the origin; the
 * cathedral faces it from the north, the palace from the east, the granary
 * from the west, and the main street runs south to the gate the camera
 * looks through. The wall's outline is the realm's own (seeded from its
 * town), and only its size follows the land, so a growing city keeps its
 * shape and simply pushes its walls outward.
 */
import { createRng, hashString, type Rng } from '@one-more-year/kit';
import { HECTARES_PER_SERF, INVASION, SERFS_PER_MILL } from '../engine/rules.ts';

export interface Point {
  x: number;
  z: number;
}

export interface CityNumbers {
  town: string;
  land: number;
  serfs: number;
  soldiers: number;
  merchants: number;
  nobles: number;
  clergy: number;
  markets: number;
  mills: number;
  palace: number;
  cathedral: number;
  grain: number;
  /** Hectares under the plough (the rest lies fallow). */
  worked: number;
  /** 1 (drought) to 5 (excellent), for the colour of the fields. */
  weather: number;
}

export interface Lot extends Point {
  width: number;
  depth: number;
  height: number;
  angle: number;
  /** Which plaster colour, which roof, a little variety from the town's seed. */
  tone: number;
}

export interface Stall extends Point {
  angle: number;
  tone: number;
  market: number;
}

export interface Mill extends Point {
  /** The stream's direction where the mill stands. */
  angle: number;
  /** The point of the stream the wheel dips into. */
  bank: Point;
}

export type GuardTower = 'none' | 'base' | 'full';

export interface CityPlan {
  wallRadius: number;
  /** The wall's corners, each with a tower. */
  wall: Point[];
  /** Indices of wall segments (from corner i to i + 1) that hold a gate. */
  gates: number[];
  /** The edge of the realm's fields. */
  fieldsRadius: number;
  piazza: { x: number; z: number; width: number; depth: number };
  cathedralStage: number;
  cathedralAdornments: number;
  palacePieces: number;
  granary: Point & { fill: number };
  stalls: Stall[];
  houses: Lot[];
  towers: Lot[];
  chapels: Lot[];
  serfHouses: Lot[];
  mills: Mill[];
  /** The stream's course, upstream first. */
  stream: Point[];
  /** Roads from the gates out across the fields. */
  roads: Point[][];
  yard: Point & { width: number; depth: number; soldiers: number };
  guardTower: GuardTower;
  guardTowerAt: Point;
  /** Share of the fields under the plough. */
  workedShare: number;
  weather: number;
  /** People in the piazza and lanes. */
  crowd: number;
  /** Trees in the countryside: cypresses along roads, olives in groves. */
  trees: (Point & { kind: 'cypress' | 'olive'; scale: number })[];
}

/** The cathedral's six stages, then four adornments. */
export const CATHEDRAL_STAGES = [
  'foundations',
  'nave',
  'aisles',
  'façade',
  'dome',
  'campanile',
] as const;
/** The palace's pieces in the order they are raised, then adornments. */
export const PALACE_PIECES = [
  'great hall',
  'east wing',
  'west wing',
  'loggia',
  'tower',
  'battlements',
] as const;

/** designed: the wall's radius from the land (hectares), growing with its square root. */
export function wallRadiusFor(land: number): number {
  return 30 + 5 * Math.sqrt(Math.max(0, land) / 1000);
}

export function wallPerimeter(plan: Pick<CityPlan, 'wall'>): number {
  let total = 0;
  plan.wall.forEach((a, i) => {
    const b = plan.wall[(i + 1) % plan.wall.length] as Point;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  });
  return total;
}

/** Figures standing in for people: one for every 25, between 30 and 900. */
export function crowdFor(population: number): number {
  return Math.round(Math.min(900, Math.max(30, population / 25)));
}

/** One figure drilling in the yard for every five soldiers, up to a hundred. */
export function drillersFor(soldiers: number): number {
  return Math.min(100, Math.ceil(soldiers / 5));
}

/** original: the guard tower stands when soldiers − 5 cover the land, and is whole when half of them do. */
export function guardTowerFor(soldiers: number, land: number): GuardTower {
  const needed = land / INVASION.hectaresPerSoldier;
  if (soldiers - 5 < needed) return 'none';
  return soldiers / 2 < needed ? 'base' : 'full';
}

/** The wall's own shape: a few corners at slightly uneven distances, fixed by the town's name. */
function wallShape(town: string): number[] {
  const rng = createRng(hashString(`wall:${town}`));
  const corners = 9 + rng.int(0, 3);
  return Array.from({ length: corners }, () => 0.9 + rng.next() * 0.18);
}

function insidePolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x)
      inside = !inside;
  }
  return inside;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

function distanceToWall(p: Point, wall: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  wall.forEach((a, i) => {
    best = Math.min(best, distanceToSegment(p, a, wall[(i + 1) % wall.length] as Point));
  });
  return best;
}

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The ground the great buildings keep for themselves. */
const RESERVED: readonly Rect[] = [
  { x0: -12, x1: 12, z0: -9, z1: 9 }, // piazza
  { x0: -11, x1: 17, z0: -36, z1: -9 }, // cathedral and campanile
  { x0: 12, x1: 30, z0: -10, z1: 12 }, // palace
  { x0: -24, x1: -12, z0: -8, z1: 5 }, // granary
  { x0: -3.2, x1: 3.2, z0: 9, z1: 200 }, // the main street to the south gate
  { x0: -200, x1: -12, z0: -1.6, z1: 1.6 }, // the west street
  { x0: 30, x1: 200, z0: -1.6, z1: 1.6 }, // the east street
];

function reserved(p: Point, margin: number): boolean {
  return RESERVED.some(
    (r) => p.x > r.x0 - margin && p.x < r.x1 + margin && p.z > r.z0 - margin && p.z < r.z1 + margin,
  );
}

export function planCity(numbers: CityNumbers): CityPlan {
  const rng = createRng(hashString(`city:${numbers.town}`));
  const wallRadius = wallRadiusFor(numbers.land);
  const shape = wallShape(numbers.town);
  const wall = shape.map((scale, i) => {
    const angle = (i / shape.length) * Math.PI * 2 + 0.2;
    return {
      x: Math.cos(angle) * wallRadius * scale,
      z: Math.sin(angle) * wallRadius * scale * 0.92,
    };
  });
  const gates = gatesFor(wall);
  const fieldsRadius = wallRadius * 1.55 + 12;
  const population =
    numbers.serfs + numbers.soldiers + numbers.merchants + numbers.nobles + numbers.clergy;

  const yard = {
    x: -20,
    z: Math.min(wallRadius * 0.62, 26),
    width: 12,
    depth: 9,
    soldiers: drillersFor(numbers.soldiers),
  };
  const lots = lotGrid(wall, yard, rng.fork('lots'));
  // A noble family's tower for every six nobles: a skyline, not a forest.
  const towersWanted = Math.min(9, Math.ceil(numbers.nobles / 6));
  const chapelsWanted = Math.min(6, Math.floor(numbers.clergy / 20));
  const housesWanted = Math.min(
    lots.length,
    Math.ceil(numbers.merchants / 4) + Math.ceil(population / 220),
  );

  // Towers rise near the heart of the city; chapels nearest the cathedral; houses fill the rest.
  const byCentre = [...lots].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const towers = takeSpread(byCentre, towersWanted, rng.fork('towers')).map((lot) => ({
    ...lot,
    width: 3.2,
    depth: 3.2,
    height: 12 + rng.next() * 7,
  }));
  const taken = new Set(towers.map((t) => `${t.x},${t.z}`));
  const byCathedral = byCentre
    .filter((lot) => !taken.has(`${lot.x},${lot.z}`))
    .sort((a, b) => Math.hypot(a.x, a.z + 22) - Math.hypot(b.x, b.z + 22));
  const chapels = byCathedral.slice(0, chapelsWanted).map((lot) => ({ ...lot, height: 6.5 }));
  for (const chapel of chapels) taken.add(`${chapel.x},${chapel.z}`);
  const houses = byCentre.filter((lot) => !taken.has(`${lot.x},${lot.z}`)).slice(0, housesWanted);

  const stream = streamCourse(wallRadius);
  const millsWanted = Math.min(12, numbers.mills);
  const mills = millSites(stream, millsWanted);
  const roads = roadsFrom(wall, gates, fieldsRadius + 40);
  const workedShare = numbers.land > 0 ? Math.min(1, numbers.worked / numbers.land) : 0;
  const serfHouses = serfHomes(
    wall,
    wallRadius,
    fieldsRadius,
    roads,
    stream,
    numbers.serfs,
    rng.fork('serfs'),
  );
  const trees = countryTrees(fieldsRadius, roads, stream, rng.fork('trees'));
  const guardTowerAt = wall[gates[0] ?? 0] ?? { x: 0, z: wallRadius };

  return {
    wallRadius,
    wall,
    gates,
    fieldsRadius,
    piazza: { x: 0, z: 0, width: 22, depth: 16 },
    cathedralStage: Math.min(CATHEDRAL_STAGES.length, numbers.cathedral),
    cathedralAdornments: Math.max(0, Math.min(4, numbers.cathedral - CATHEDRAL_STAGES.length)),
    palacePieces: Math.min(10, numbers.palace),
    granary: { x: -18, z: -1.5, fill: Math.min(1, numbers.grain / 30_000) },
    stalls: stallsFor(numbers.markets, wallRadius),
    houses,
    towers,
    chapels,
    serfHouses,
    mills,
    stream,
    roads,
    yard,
    guardTower: guardTowerFor(numbers.soldiers, numbers.land),
    guardTowerAt,
    workedShare,
    weather: numbers.weather,
    crowd: crowdFor(population),
    trees,
  };
}

/** Gates where the main streets meet the wall: south (toward the viewer), west and east. */
function gatesFor(wall: readonly Point[]): number[] {
  const nearest = (angle: number): number => {
    let best = 0;
    let bestError = Number.POSITIVE_INFINITY;
    wall.forEach((a, i) => {
      const b = wall[(i + 1) % wall.length] as Point;
      const mid = Math.atan2((a.z + b.z) / 2, (a.x + b.x) / 2);
      const error = Math.abs(Math.atan2(Math.sin(mid - angle), Math.cos(mid - angle)));
      if (error < bestError) {
        bestError = error;
        best = i;
      }
    });
    return best;
  };
  return [...new Set([nearest(Math.PI / 2), nearest(Math.PI), nearest(0)])];
}

/** Lots for houses on a grid inside the walls, clear of the great buildings and the yard. */
function lotGrid(
  wall: readonly Point[],
  yard: { x: number; z: number; width: number; depth: number },
  rng: Rng,
): Lot[] {
  const lots: Lot[] = [];
  const step = 5.2;
  const reach = 90;
  for (let gx = -reach; gx <= reach; gx += step) {
    for (let gz = -reach; gz <= reach; gz += step) {
      const jitter = { x: (rng.next() - 0.5) * 1.2, z: (rng.next() - 0.5) * 1.2 };
      const p = { x: gx + jitter.x, z: gz + jitter.z };
      if (!insidePolygon(p, wall) || distanceToWall(p, wall) < 4.5) continue;
      if (reserved(p, 2.6)) continue;
      if (
        Math.abs(p.x - yard.x) < yard.width / 2 + 3 &&
        Math.abs(p.z - yard.z) < yard.depth / 2 + 3
      )
        continue;
      lots.push({
        x: p.x,
        z: p.z,
        width: 3.4 + rng.next() * 1.2,
        depth: 3.2 + rng.next() * 1.0,
        height: 4.5 + rng.next() * 3.5,
        angle: (rng.next() - 0.5) * 0.12,
        tone: rng.int(0, 5),
      });
    }
  }
  return lots;
}

/** Picks `count` lots from the front of a list, skipping neighbours of picks already made. */
function takeSpread(lots: readonly Lot[], count: number, rng: Rng): Lot[] {
  const picked: Lot[] = [];
  for (const lot of lots) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.hypot(p.x - lot.x, p.z - lot.z) < 9)) continue;
    if (rng.chance(0.55)) picked.push(lot);
  }
  return picked;
}

/** Stalls: the first four markets line the piazza; later ones run down the main street. */
function stallsFor(markets: number, wallRadius: number): Stall[] {
  const stalls: Stall[] = [];
  const sides: { x: number; z: number; dx: number; dz: number; angle: number }[] = [
    { x: -9, z: -6, dx: 0, dz: 3.4, angle: Math.PI / 2 }, // west side
    { x: -7, z: 6.5, dx: 3.4, dz: 0, angle: 0 }, // south side, west half
    { x: 4.5, z: 6.5, dx: 3.4, dz: 0, angle: 0 }, // south side, east half
    { x: 9, z: -6, dx: 0, dz: 3.4, angle: -Math.PI / 2 }, // east side
  ];
  for (let m = 0; m < Math.min(markets, 14); m++) {
    if (m < sides.length) {
      const side = sides[m] as (typeof sides)[number];
      for (let i = 0; i < 3; i++) {
        stalls.push({
          x: side.x + side.dx * i,
          z: side.z + side.dz * i,
          angle: side.angle,
          tone: (m + i) % 4,
          market: m,
        });
      }
      continue;
    }
    // Along the main street, alternating sides, walking south.
    const k = m - sides.length;
    const z = 13 + Math.floor(k / 2) * 7;
    if (z > wallRadius * 0.85) break;
    const x = k % 2 === 0 ? -5.4 : 5.4;
    for (let i = 0; i < 2; i++) {
      stalls.push({
        x,
        z: z + i * 3.2,
        angle: k % 2 === 0 ? Math.PI / 2 : -Math.PI / 2,
        tone: (m + i) % 4,
        market: m,
      });
    }
  }
  return stalls;
}

/**
 * The stream rises at the foot of the hills, in the gap between two of them
 * north-east of the city, and passes east of the walls on its way south.
 */
function streamCourse(wallRadius: number): Point[] {
  const points: Point[] = [];
  const spring = -(wallRadius + 18);
  const offset = wallRadius + 9;
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const z = spring + t * (260 - spring);
    const bend = Math.sin(t * Math.PI * 3.1) * 6 + Math.sin(t * 11.3) * 2.2;
    // Hug the wall where it passes the city, wander further out above and below.
    const near = Math.exp(-((z / (wallRadius * 1.3)) ** 2));
    points.push({ x: offset + bend + (1 - near) * 12 - (1 - t) * 4, z });
  }
  return points;
}

function millSites(stream: readonly Point[], count: number): Mill[] {
  const mills: Mill[] = [];
  // Mills sit along the stretch beside the city's eastern wall and below it.
  const start = Math.floor(stream.length * 0.14);
  for (let i = 0; i < count; i++) {
    const index = Math.min(stream.length - 2, start + i * 1);
    const a = stream[index] as Point;
    const b = stream[index + 1] as Point;
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    // Alternate banks: step across the stream, perpendicular to its flow.
    const side = i % 2 === 0 ? -1 : 1;
    const bank = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    mills.push({
      x: bank.x - side * 5 * Math.sin(angle),
      z: bank.z + side * 5 * Math.cos(angle),
      angle,
      bank,
    });
  }
  return mills;
}

function roadsFrom(wall: readonly Point[], gates: readonly number[], reach: number): Point[][] {
  return gates.map((g) => {
    const a = wall[g] as Point;
    const b = wall[(g + 1) % wall.length] as Point;
    const gate = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const direction = Math.atan2(gate.z, gate.x);
    const road: Point[] = [gate];
    for (let i = 1; i <= 8; i++) {
      const r = Math.hypot(gate.x, gate.z) + (reach / 8) * i;
      const wobble = Math.sin(i * 1.7 + direction * 3) * 0.12;
      road.push({ x: Math.cos(direction + wobble) * r, z: Math.sin(direction + wobble) * r });
    }
    return road;
  });
}

function nearPolyline(p: Point, line: readonly Point[], distance: number): boolean {
  for (let i = 0; i < line.length - 1; i++) {
    if (distanceToSegment(p, line[i] as Point, line[i + 1] as Point) < distance) return true;
  }
  return false;
}

/** Serfs' cottages scattered among the fields, one for every 120 serfs (up to 150). */
function serfHomes(
  wall: readonly Point[],
  wallRadius: number,
  fieldsRadius: number,
  roads: readonly Point[][],
  stream: readonly Point[],
  serfs: number,
  rng: Rng,
): Lot[] {
  const wanted = Math.min(150, Math.ceil(serfs / 120));
  const homes: Lot[] = [];
  let tries = 0;
  while (homes.length < wanted && tries++ < wanted * 30) {
    const angle = rng.next() * Math.PI * 2;
    // Cottages cluster along the roads, a short walk outside the gates.
    const road = rng.pick(roads);
    const along = road[rng.int(1, Math.min(road.length - 1, 4))] as Point;
    const p = rng.chance(0.7)
      ? { x: along.x + (rng.next() - 0.5) * 18, z: along.z + (rng.next() - 0.5) * 18 }
      : {
          x: Math.cos(angle) * (wallRadius + 6 + rng.next() * (fieldsRadius - wallRadius)),
          z: Math.sin(angle) * (wallRadius + 6 + rng.next() * (fieldsRadius - wallRadius)),
        };
    if (insidePolygon(p, wall) || distanceToWall(p, wall) < 5) continue;
    if (roads.some((line) => nearPolyline(p, line, 3)) || nearPolyline(p, stream, 5)) continue;
    if (homes.some((h) => Math.hypot(h.x - p.x, h.z - p.z) < 3.6)) continue;
    homes.push({
      ...p,
      width: 2.6,
      depth: 2.2,
      height: 2.4,
      angle: rng.next() * Math.PI,
      tone: rng.int(0, 5),
    });
  }
  return homes;
}

/** Cypresses in pairs along the roads; olive groves on the slopes beyond the fields. */
function countryTrees(
  fieldsRadius: number,
  roads: readonly Point[][],
  stream: readonly Point[],
  rng: Rng,
): (Point & { kind: 'cypress' | 'olive'; scale: number })[] {
  const trees: (Point & { kind: 'cypress' | 'olive'; scale: number })[] = [];
  for (const road of roads) {
    for (let i = 1; i < road.length - 1; i++) {
      const a = road[i] as Point;
      const b = road[i + 1] as Point;
      const angle = Math.atan2(b.z - a.z, b.x - a.x);
      for (let k = 0; k < 3; k++) {
        const t = k / 3;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        for (const side of [-1, 1]) {
          if (rng.chance(0.35)) continue;
          trees.push({
            x: x + Math.sin(angle) * 3 * side,
            z: z - Math.cos(angle) * 3 * side,
            kind: 'cypress',
            scale: 0.85 + rng.next() * 0.4,
          });
        }
      }
    }
  }
  const clear = (p: Point): boolean =>
    !nearPolyline(p, stream, 6) && !roads.some((line) => nearPolyline(p, line, 3.5));
  // Olive groves: planted in rows, a dozen or two trees each, on the land beyond the fields.
  for (let g = 0; g < 14; g++) {
    const angle = rng.next() * Math.PI * 2;
    const r = fieldsRadius + 10 + rng.next() * 60;
    const centre = { x: Math.cos(angle) * r, z: Math.sin(angle) * r * 0.9 };
    const heading = rng.next() * Math.PI;
    const rows = 2 + rng.int(0, 3);
    const columns = 3 + rng.int(0, 4);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const u = (column - (columns - 1) / 2) * 4.4;
        const v = (row - (rows - 1) / 2) * 4.4;
        const p = {
          x: centre.x + u * Math.cos(heading) - v * Math.sin(heading) + (rng.next() - 0.5) * 0.8,
          z: centre.z + u * Math.sin(heading) + v * Math.cos(heading) + (rng.next() - 0.5) * 0.8,
        };
        if (clear(p)) trees.push({ ...p, kind: 'olive', scale: 0.75 + rng.next() * 0.35 });
      }
    }
  }
  // Cypresses stand in small knots on the rises, the way they mark a farm or a chapel.
  for (let k = 0; k < 12; k++) {
    const angle = rng.next() * Math.PI * 2;
    const r = fieldsRadius + 4 + rng.next() * 80;
    const centre = { x: Math.cos(angle) * r, z: Math.sin(angle) * r * 0.9 };
    const count = 2 + rng.int(0, 4);
    for (let i = 0; i < count; i++) {
      const p = { x: centre.x + (rng.next() - 0.5) * 7, z: centre.z + (rng.next() - 0.5) * 7 };
      if (clear(p)) trees.push({ ...p, kind: 'cypress', scale: 0.9 + rng.next() * 0.45 });
    }
  }
  return trees;
}

/** The share of farmers to land, for the ploughman's place in the picture (1 when every field is worked). */
export function ploughShare(serfs: number, mills: number, land: number): number {
  const farmers = Math.max(0, serfs - mills * SERFS_PER_MILL);
  return land > 0 ? Math.min(1, (farmers * HECTARES_PER_SERF) / land) : 0;
}
