/**
 * Where everything in the city stands: the river's course, the field
 * parcels along their canals, the house lots, the roads, the palms.
 *
 * Pure data with no three.js, so the scene tests can check the mapping from
 * numbers to things (one parcel per ten acres, one lit window per ten
 * people) without a GPU. The layout is the same for every run: a player
 * learns the city like a place.
 *
 * World units: x runs east (right on screen), z runs south (toward the
 * camera), y is up. A parcel of ten acres is about 6 × 4.5 units; a house
 * is 2–4 units across.
 */
import { createRng, type Rng } from '@one-more-year/kit';

export const ACRES_PER_PARCEL = 10;
export const PEOPLE_PER_WINDOW = 10;
export const PEOPLE_PER_FIGURE = 10;

export const PARCEL_WIDTH = 6.2;
export const PARCEL_DEPTH = 4.4;
const PARCEL_GAP = 0.55;
/** A canal runs between every few parcel rows and every few columns. */
const ROWS_PER_CANAL = 4;
const COLUMNS_PER_CANAL = 6;
const CANAL_WIDTH = 1.6;

export interface Point2 {
  x: number;
  z: number;
}

export interface Parcel {
  index: number;
  /** Centre of the parcel. */
  x: number;
  z: number;
  width: number;
  depth: number;
  /** How far irrigation has to reach: parcels are owned nearest first. */
  reach: number;
}

export interface HouseLot {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Rotation about y, radians. */
  turn: number;
  storeys: 1 | 2;
  tone: number;
}

export interface WindowSlot {
  x: number;
  y: number;
  z: number;
  /** Which way the wall faces, radians about y. */
  facing: number;
  house: number;
}

/**
 * A stretch of canal. It carries water (and is drawn) only when the parcel
 * slot it belongs to is owned, so canals spread with the fields.
 */
export interface CanalPiece {
  from: Point2;
  to: Point2;
  width: number;
  slot: number;
}

export interface CityLayout {
  parcels: Parcel[];
  canals: CanalPiece[];
  houses: HouseLot[];
  windows: WindowSlot[];
  /** Window indices in the order they light up as the city grows. */
  windowOrder: number[];
  palms: { x: number; z: number; scale: number; lean: number; turn: number }[];
  /** Tamarisk and camel-thorn on the wild plain, clear of any land the city is likely to farm. */
  scrub: { x: number; z: number; scale: number; turn: number }[];
  roads: Point2[][];
  /** Lanes inside the city where figures walk. */
  lanes: Point2[][];
  /** The road the newcomers walk in on, ending at the east gate. */
  arrivalRoad: Point2[];
  granary: { x: number; z: number; width: number; depth: number; height: number };
  ziggurat: { x: number; z: number; base: number };
  cityCentre: Point2;
}

// ---- the river -------------------------------------------------------------

export const RIVER_WIDTH = 15;

/** The river's centre line: it runs behind the city, flowing east. */
export function riverZ(x: number): number {
  return -66 + 7 * Math.sin(x * 0.019 + 0.6) + 3.5 * Math.sin(x * 0.051 + 1.7);
}

/** Distance from a point to the river's centre line, measured across the flow. */
export function riverDistance(x: number, z: number): number {
  return Math.abs(z - riverZ(x));
}

export function riverPath(fromX = -420, toX = 420, step = 3): Point2[] {
  const points: Point2[] = [];
  for (let x = fromX; x <= toX; x += step) points.push({ x, z: riverZ(x) });
  return points;
}

// ---- the city --------------------------------------------------------------

export const CITY_CENTRE: Point2 = { x: 8, z: -34 };
export const CITY_RADII = { x: 34, z: 17 };
const ZIGGURAT = { x: 16, z: -40, base: 21 };
const GRANARY = { x: -31, z: -21, width: 14, depth: 9, height: 5.6 };

function insideCity(x: number, z: number, margin = 0): boolean {
  const dx = (x - CITY_CENTRE.x) / (CITY_RADII.x + margin);
  const dz = (z - CITY_CENTRE.z) / (CITY_RADII.z + margin);
  return dx * dx + dz * dz <= 1;
}

function nearZiggurat(x: number, z: number, margin: number): boolean {
  const half = ZIGGURAT.base / 2 + margin;
  return Math.abs(x - ZIGGURAT.x) < half && Math.abs(z - ZIGGURAT.z) < half;
}

function nearGranary(x: number, z: number, margin: number): boolean {
  return (
    Math.abs(x - GRANARY.x) < GRANARY.width / 2 + margin &&
    Math.abs(z - GRANARY.z) < GRANARY.depth / 2 + margin
  );
}

/** The main street runs from the south gate to the temple; the river street along the back. */
function onMainStreet(x: number, z: number): boolean {
  return Math.abs(x - 6) < 2.2 || Math.abs(z - (CITY_CENTRE.z + 4)) < 1.6;
}

function buildHouses(rng: Rng): HouseLot[] {
  const houses: HouseLot[] = [];
  const cell = 4.3;
  for (let gx = -9; gx <= 9; gx++) {
    for (let gz = -5; gz <= 5; gz++) {
      const x = CITY_CENTRE.x + gx * cell + rng.float(-0.5, 0.5);
      const z = CITY_CENTRE.z + gz * cell * 0.86 + rng.float(-0.4, 0.4);
      if (!insideCity(x, z, -1.5)) continue;
      if (nearZiggurat(x, z, 3.2) || onMainStreet(x, z)) continue;
      // Leave a few open courtyards so the roofscape breathes.
      if (rng.chance(0.08)) continue;
      const storeys = rng.chance(0.3) ? 2 : 1;
      houses.push({
        x,
        z,
        width: rng.float(2.5, 3.7),
        depth: rng.float(2.4, 3.4),
        height: storeys === 2 ? rng.float(3.6, 4.4) : rng.float(2.0, 2.6),
        turn: rng.float(-0.06, 0.06),
        storeys,
        tone: rng.next(),
      });
    }
  }
  // Outskirts: a looser ring of farmsteads that only fills in as the city grows.
  for (let i = 0; i < 140; i++) {
    const angle = rng.float(0, Math.PI * 2);
    const radius = rng.float(1.05, 1.5);
    const x = CITY_CENTRE.x + Math.cos(angle) * CITY_RADII.x * radius;
    const z = CITY_CENTRE.z + Math.sin(angle) * CITY_RADII.z * radius * 1.1;
    if (riverDistance(x, z) < RIVER_WIDTH / 2 + 5 || nearGranary(x, z, 4) || x > 44) continue;
    if (houses.some((house) => Math.hypot(house.x - x, house.z - z) < 4.2)) continue;
    houses.push({
      x,
      z,
      width: rng.float(2.3, 3.2),
      depth: rng.float(2.2, 3.0),
      height: rng.float(1.9, 2.4),
      turn: rng.float(-0.3, 0.3),
      storeys: 1,
      tone: rng.next(),
    });
  }
  return houses;
}

/** Window slots on the walls a viewer from the south-east sees, two to four a house. */
function buildWindows(houses: readonly HouseLot[], rng: Rng): WindowSlot[] {
  const windows: WindowSlot[] = [];
  houses.forEach((house, index) => {
    const floors = house.storeys === 2 ? [0.62, 2.45] : [0.68];
    for (const level of floors) {
      const y = Math.min(house.height - 0.55, level + 0.5);
      // South face (toward the camera).
      const southCount = house.width > 3.1 ? 2 : 1;
      for (let i = 0; i < southCount; i++) {
        const offset =
          southCount === 1 ? rng.float(-0.4, 0.4) : (i === 0 ? -0.55 : 0.55) * (house.width / 3);
        windows.push(placeOnWall(house, index, offset, y, 'south'));
      }
      // East face.
      if (rng.chance(0.65))
        windows.push(placeOnWall(house, index, rng.float(-0.5, 0.5), y, 'east'));
    }
  });
  return windows;
}

function placeOnWall(
  house: HouseLot,
  index: number,
  along: number,
  y: number,
  wall: 'south' | 'east',
): WindowSlot {
  const cos = Math.cos(house.turn);
  const sin = Math.sin(house.turn);
  const local =
    wall === 'south'
      ? { x: along, z: house.depth / 2 + 0.03 }
      : { x: house.width / 2 + 0.03, z: along };
  return {
    x: house.x + local.x * cos + local.z * sin,
    y,
    z: house.z - local.x * sin + local.z * cos,
    facing: house.turn + (wall === 'south' ? 0 : Math.PI / 2),
    house: index,
  };
}

/**
 * The order in which windows light as the people grow: houses near the
 * centre fill first, so a small city is a lit heart, not a scattering.
 */
function windowLightingOrder(
  windows: readonly WindowSlot[],
  houses: readonly HouseLot[],
  rng: Rng,
): number[] {
  const keyed = windows.map((slot, index) => {
    const house = houses[slot.house] as HouseLot;
    const dx = (house.x - CITY_CENTRE.x) / CITY_RADII.x;
    const dz = (house.z - CITY_CENTRE.z) / CITY_RADII.z;
    return { index, key: Math.hypot(dx, dz) + rng.float(0, 0.55) };
  });
  return keyed.sort((a, b) => a.key - b.key).map((item) => item.index);
}

// ---- fields ------------------------------------------------------------------

/**
 * Parcel slots on a canal grid across the plain in front of the city.
 * The order of ownership follows "reach": distance from the granary along
 * the canals, roughened per canal block so the edge of the fields reads as
 * hand-dug, not as a circle.
 */
function buildParcels(rng: Rng): { parcels: Parcel[]; canals: CanalPiece[] } {
  const parcels: Parcel[] = [];
  const cells = new Map<Parcel, string>();
  const pitchX = PARCEL_WIDTH + PARCEL_GAP;
  const pitchZ = PARCEL_DEPTH + PARCEL_GAP;
  const origin = { x: -150, z: -50 };
  const columns = 46;
  const rows = 40;
  const blockRoughness = new Map<string, number>();
  const xOf = (column: number): number =>
    origin.x + column * pitchX + Math.floor(column / COLUMNS_PER_CANAL) * CANAL_WIDTH;
  const zOf = (row: number): number =>
    origin.z + row * pitchZ + Math.floor(row / ROWS_PER_CANAL) * CANAL_WIDTH;

  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const x = xOf(column) + PARCEL_WIDTH / 2;
      const z = zOf(row) + PARCEL_DEPTH / 2;
      if (riverDistance(x, z) < RIVER_WIDTH / 2 + 7) continue;
      if (z < riverZ(x)) continue;
      if (insideCity(x, z, 6) || nearGranary(x, z, 5) || nearZiggurat(x, z, 6)) continue;
      // The main road south and the river road east keep their verges.
      if (Math.abs(x - 6) < 4.2 && z > CITY_CENTRE.z) continue;
      const blockKey = `${Math.floor(column / COLUMNS_PER_CANAL)}:${Math.floor(row / ROWS_PER_CANAL)}`;
      let rough = blockRoughness.get(blockKey);
      if (rough === undefined) {
        rough = rng.float(0, 14);
        blockRoughness.set(blockKey, rough);
      }
      // Fields spread from the granary's door, south toward the road more readily than along the river.
      const dx = x - (GRANARY.x + 14);
      const dz = z - (GRANARY.z + 10);
      const parcel: Parcel = {
        index: 0,
        x: x + rng.float(-0.18, 0.18),
        z: z + rng.float(-0.14, 0.14),
        width: PARCEL_WIDTH * rng.float(0.94, 1.0),
        depth: PARCEL_DEPTH * rng.float(0.92, 1.0),
        reach: Math.abs(dx) * 0.95 + Math.abs(dz) * 0.75 + rough + rng.float(0, 2.5),
      };
      parcels.push(parcel);
      cells.set(parcel, `${column}:${row}`);
    }
  }
  parcels.sort((a, b) => a.reach - b.reach);
  parcels.forEach((parcel, index) => (parcel.index = index));

  const open = (x: number, z: number): boolean =>
    z > riverZ(x) + RIVER_WIDTH * 0.3 &&
    !insideCity(x, z, 4) &&
    !nearGranary(x, z, 2.5) &&
    !nearZiggurat(x, z, 4);
  const at = new Map<string, number>();
  for (const [parcel, cell] of cells) at.set(cell, parcel.index);
  const slotAt = (column: number, row: number): number =>
    at.get(`${column}:${row}`) ?? Number.POSITIVE_INFINITY;
  const canals: CanalPiece[] = [];

  // Canals that run south from the river: a stretch carries water if any field below it is the city's.
  for (let column = COLUMNS_PER_CANAL; column < columns; column += COLUMNS_PER_CANAL) {
    const x = xOf(column) - CANAL_WIDTH / 2 - PARCEL_GAP / 2;
    let below = Number.POSITIVE_INFINITY;
    const pieces: CanalPiece[] = [];
    for (let row = rows - 1; row >= 0; row--) {
      below = Math.min(below, slotAt(column - 1, row), slotAt(column, row));
      const z0 = zOf(row) - PARCEL_GAP / 2 - (row % ROWS_PER_CANAL === 0 ? CANAL_WIDTH : 0);
      const z1 =
        zOf(row + 1) - PARCEL_GAP / 2 - ((row + 1) % ROWS_PER_CANAL === 0 ? CANAL_WIDTH : 0);
      if (!open(x, (z0 + z1) / 2) || !Number.isFinite(below)) continue;
      pieces.push({ from: { x, z: z0 }, to: { x, z: z1 }, width: CANAL_WIDTH * 0.75, slot: below });
    }
    const top = pieces.at(-1);
    if (top && open(x, top.from.z - 1)) {
      // The head of the canal, cut through the bank to the river.
      pieces.push({
        from: { x, z: riverZ(x) + RIVER_WIDTH * 0.35 },
        to: { x, z: top.from.z },
        width: CANAL_WIDTH * 0.75,
        slot: top.slot,
      });
    }
    canals.push(...pieces);
  }
  // Feeders along the rows: each stretch carries water when a field beside it is the city's.
  for (let row = ROWS_PER_CANAL; row < rows; row += ROWS_PER_CANAL) {
    const z = zOf(row) - CANAL_WIDTH / 2 - PARCEL_GAP / 2;
    for (let column = 0; column < columns; column++) {
      const x0 =
        xOf(column) - PARCEL_GAP / 2 - (column % COLUMNS_PER_CANAL === 0 ? CANAL_WIDTH : 0);
      const x1 =
        xOf(column + 1) -
        PARCEL_GAP / 2 -
        ((column + 1) % COLUMNS_PER_CANAL === 0 ? CANAL_WIDTH : 0);
      const slot = Math.min(slotAt(column, row), slotAt(column, row - 1));
      if (!Number.isFinite(slot) || !open((x0 + x1) / 2, z)) continue;
      canals.push({ from: { x: x0, z }, to: { x: x1, z }, width: CANAL_WIDTH * 0.6, slot });
    }
  }
  return { parcels, canals };
}

/** How many parcels a holding of land fills: one per ten acres, rounded. */
export function parcelsForAcres(acres: number, available: number): number {
  return Math.max(0, Math.min(available, Math.round(acres / ACRES_PER_PARCEL)));
}

/** How many windows burn for a number of people: one per ten, rounded. */
export function windowsForPeople(people: number, available: number): number {
  return Math.max(0, Math.min(available, Math.round(people / PEOPLE_PER_WINDOW)));
}

export function figuresForPeople(people: number): number {
  return Math.max(0, Math.round(people / PEOPLE_PER_FIGURE));
}

// ---- palms, roads, lanes -------------------------------------------------------

function buildPalms(rng: Rng, parcels: readonly Parcel[]): CityLayout['palms'] {
  const palms: CityLayout['palms'] = [];
  const add = (x: number, z: number, scale = rng.float(0.85, 1.25)): void => {
    palms.push({ x, z, scale, lean: rng.float(-0.18, 0.18), turn: rng.float(0, Math.PI * 2) });
  };
  // Date groves along both banks: dense in places, thin in others, as people planted them.
  for (let x = -330; x < 330; x += rng.float(2.6, 6.5)) {
    const grove = 0.5 + 0.5 * Math.sin(x * 0.045 + 1.3);
    for (const side of [1, -1]) {
      if (!rng.chance(0.35 + grove * 0.55)) continue;
      const depth = 1 + Math.floor(grove * 3 * rng.next());
      for (let row = 0; row < depth; row++) {
        const offset = RIVER_WIDTH / 2 + 2.4 + row * rng.float(2.6, 3.6) + rng.float(0, 1.5);
        const px = x + rng.float(-1.2, 1.2);
        const pz = riverZ(px) + side * offset;
        if (side > 0 && (insideCity(px, pz, 2) || nearGranary(px, pz, 3))) continue;
        add(px, pz);
      }
    }
  }
  // Around the city and its gate.
  for (let i = 0; i < 46; i++) {
    const angle = rng.float(0, Math.PI * 2);
    const radius = rng.float(1.06, 1.3);
    const x = CITY_CENTRE.x + Math.cos(angle) * CITY_RADII.x * radius;
    const z = CITY_CENTRE.z + Math.sin(angle) * CITY_RADII.z * radius;
    if (nearGranary(x, z, 3) || riverDistance(x, z) < RIVER_WIDTH / 2 + 2) continue;
    add(x, z, rng.float(0.9, 1.3));
  }
  // Single palms at some canal corners out in the fields, as farmers plant them.
  for (const parcel of parcels.slice(0, 600)) {
    if (rng.chance(0.012))
      add(
        parcel.x + parcel.width / 2 + 0.3,
        parcel.z + parcel.depth / 2 + 0.3,
        rng.float(0.8, 1.1),
      );
  }
  return palms;
}

function buildLanes(rng: Rng): Point2[][] {
  const lanes: Point2[][] = [];
  for (let i = 0; i < 14; i++) {
    const z = CITY_CENTRE.z + rng.float(-12, 12);
    const fromX = CITY_CENTRE.x - rng.float(10, 28);
    const toX = CITY_CENTRE.x + rng.float(10, 28);
    lanes.push([
      { x: fromX, z },
      { x: (fromX + toX) / 2, z: z + rng.float(-2, 2) },
      { x: toX, z },
    ]);
  }
  lanes.push([
    { x: 6, z: CITY_CENTRE.z + 16 },
    { x: 6, z: CITY_CENTRE.z - 4 },
  ]);
  return lanes;
}

function buildScrub(rng: Rng, parcels: readonly Parcel[]): CityLayout['scrub'] {
  // Parcels the city might farm in a long, prosperous reign stay clear of bushes.
  const farmed = new Set(
    parcels.slice(0, 700).map((p) => `${Math.round(p.x / 8)}:${Math.round(p.z / 8)}`),
  );
  const scrub: CityLayout['scrub'] = [];
  for (let i = 0; i < 2600; i++) {
    const x = rng.float(-260, 260);
    const z = rng.float(-160, 220);
    const across = riverDistance(x, z);
    if (
      across < RIVER_WIDTH / 2 + 2 ||
      insideCity(x, z, 6) ||
      nearGranary(x, z, 4) ||
      nearZiggurat(x, z, 6)
    )
      continue;
    if (farmed.has(`${Math.round(x / 8)}:${Math.round(z / 8)}`)) continue;
    // In loose clumps, thicker near the water, thinning out into the desert.
    const clump =
      0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.08 + x * 0.02);
    if (!rng.chance(Math.max(0.06, 1 - across / 200) * clump * clump * 1.6)) continue;
    if (Math.abs(x - 6) < 3 && z > CITY_CENTRE.z) continue;
    scrub.push({ x, z, scale: rng.float(0.35, 1.1), turn: rng.float(0, Math.PI * 2) });
  }
  return scrub;
}

let cached: CityLayout | null = null;

/** The one city layout, built once (it is deterministic, so it can be shared). */
export function cityLayout(): CityLayout {
  if (cached) return cached;
  const rng = createRng('ten-harvests:layout');
  const houses = buildHouses(rng.fork('houses'));
  const windows = buildWindows(houses, rng.fork('windows'));
  const { parcels, canals } = buildParcels(rng.fork('parcels'));
  const gateEast = { x: CITY_CENTRE.x + CITY_RADII.x + 1, z: CITY_CENTRE.z + 2 };
  const arrivalRoad: Point2[] = [];
  for (let x = 260; x >= gateEast.x; x -= 4) {
    const towardRiver = Math.max(0, Math.min(1, (x - gateEast.x) / 120));
    arrivalRoad.push({
      x,
      z: gateEast.z + (riverZ(x) + RIVER_WIDTH / 2 + 9 - gateEast.z) * towardRiver,
    });
  }
  arrivalRoad.push(gateEast);
  cached = {
    parcels,
    canals,
    houses,
    windows,
    windowOrder: windowLightingOrder(windows, houses, rng.fork('window-order')),
    palms: buildPalms(rng.fork('palms'), parcels),
    scrub: buildScrub(rng.fork('scrub'), parcels),
    roads: [
      [
        { x: 6, z: CITY_CENTRE.z + CITY_RADII.z - 1 },
        { x: 6, z: 260 },
      ],
      arrivalRoad,
      [
        { x: GRANARY.x + 3, z: GRANARY.z + GRANARY.depth / 2 },
        { x: GRANARY.x + 6, z: GRANARY.z + 14 },
        { x: 6, z: GRANARY.z + 18 },
      ],
    ],
    lanes: buildLanes(rng.fork('lanes')),
    arrivalRoad,
    granary: GRANARY,
    ziggurat: ZIGGURAT,
    cityCentre: CITY_CENTRE,
  };
  return cached;
}
