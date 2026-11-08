/**
 * The hills, as the old painters drew the Tuscan countryside: rounded
 * "cushion" hills with soft shoulders, set in rows that climb toward the
 * back of the picture, each hill its own width and height from a seed.
 *
 * One range of hills is laid out per picture (the city's from its town's
 * name, the valley's from its own seed) and read as a height field: the
 * ground meshes are shaped from it and the trees stand on it. Hills meet in
 * soft saddles (a smooth maximum), never in creases, so the painted light
 * models each one as a round form.
 */
import { createRng, hashString } from '@one-more-year/kit';

export interface Hill {
  x: number;
  z: number;
  /** Half-width across the picture and half-depth into it. */
  rx: number;
  rz: number;
  height: number;
}

export interface HillRow {
  /** Where the row's hills are centred, north being negative z. */
  z: number;
  /** How far the row's hills reach into the picture (their half-depth). */
  depth: [number, number];
  height: [number, number];
  /** Full widths of the row's hills. */
  width: [number, number];
  /** Spacing as a share of a hill's width: below 1 the hills overlap. */
  spacing: [number, number];
}

export interface HillRange {
  readonly hills: readonly Hill[];
  heightAt(x: number, z: number): number;
}

/** A cushion's profile from its crown (0) to its foot (1): a broad rounded top and soft shoulders. */
export function cushion(d: number): number {
  if (d >= 1) return 0;
  return (1 - d ** 2.6) ** 0.62;
}

function smoothMax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

const lerp = (range: [number, number], t: number): number => range[0] + (range[1] - range[0]) * t;

/** Lays rows of hills across `span` (x from west to east), each hill drawn from the seed. */
export function layHills(seed: string, rows: readonly HillRow[], span: [number, number]): Hill[] {
  const rng = createRng(hashString(`hills:${seed}`));
  const hills: Hill[] = [];
  for (const row of rows) {
    let x = span[0] - rng.next() * row.width[1] * 0.5;
    while (x < span[1] + row.width[1] * 0.5) {
      const width = lerp(row.width, rng.next());
      hills.push({
        x: x + width * 0.5,
        z: row.z + (rng.next() - 0.5) * lerp(row.depth, 0.5) * 0.4,
        rx: width * 0.5,
        rz: lerp(row.depth, rng.next()),
        height: lerp(row.height, rng.next()),
      });
      x += width * lerp(row.spacing, rng.next());
    }
  }
  return hills;
}

/**
 * A range of hills over a gentle rise: `rise(x, z)` lifts the land toward
 * the back so no gap opens between the hills, and the hills stand on it.
 */
export function hillRange(
  hills: readonly Hill[],
  rise: (x: number, z: number) => number,
): HillRange {
  return {
    hills,
    heightAt(x, z) {
      let height = rise(x, z);
      for (const hill of hills) {
        const dx = (x - hill.x) / hill.rx;
        const dz = (z - hill.z) / hill.rz;
        const d = dx * dx + dz * dz;
        if (d >= 1) continue;
        height = smoothMax(height, hill.height * cushion(Math.sqrt(d)), 4);
      }
      return height;
    },
  };
}

/**
 * The painted hill (GLSL; needs the NOISE helpers): green earth and olive
 * over a cushion, patched with small fields, olive groves in dotted rows
 * and now and then the dark flame of a cypress, the far rows fading toward
 * the blue-grey air. `world` is the point painted; `far` is 0 for the front
 * row and 1 at the land's end. Colours are linear.
 */
export const HILL_PAINT = /* glsl */ `
vec3 cfHillPaint(vec3 world, float far, vec3 hills, vec3 shade, vec3 airy, vec3 meadow, vec3 earth, vec3 olive, vec3 cypress) {
  // Painted as the eye meets the slope: height counts as distance up the picture, so fields and
  // groves keep their shape on a steep face instead of stretching down it.
  vec2 p = vec2(world.x, world.z - world.y * 1.4);
  float mottle = cfFbm(p * 0.04) - 0.5;
  vec3 colour = mix(hills, meadow, 0.35 + mottle * 0.5);
  // Small fields on the flanks, low in contrast so the hill's form still reads.
  vec2 cell = cfVoronoiEdge(p / 11.0 + vec2(cfNoise(p * 0.03), cfNoise(p * 0.03 + 4.0)) * 0.6);
  float kind = fract(cell.y * 9.17);
  // Wheat and fallow are mixed from the hill's own pigments, so they darken with it by night.
  vec3 wheat = hills * vec3(1.55, 1.2, 0.55);
  vec3 fallow = earth * vec3(0.85, 0.72, 0.6);
  vec3 field = kind < 0.3 ? wheat : kind < 0.45 ? fallow : kind < 0.75 ? mix(hills, meadow, 0.7) : colour;
  colour = mix(colour, field, 0.4 * (1.0 - far * 0.6));
  colour = mix(colour, shade, smoothstep(0.06, 0.015, cell.x) * 0.25);
  // Olive groves: dotted rows across some of the plots, each plot planted in its own direction.
  float grove = step(0.6, fract(cell.y * 3.71));
  float heading = cell.y * 6.2831853;
  vec2 dir = vec2(cos(heading), sin(heading));
  vec2 q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x))) / 2.6;
  float tree = smoothstep(0.34, 0.2, length(fract(q) - 0.5)) * grove;
  colour = mix(colour, olive * 0.75, tree * 0.85 * (1.0 - far * 0.5));
  // Cypresses: a few dark flames along the edges of the plots.
  vec2 cq = p / vec2(4.0, 12.0);
  vec2 cypressCell = floor(cq);
  float pick = step(0.8, cfHash12(cypressCell + 7.0)) * smoothstep(0.1, 0.04, cell.x);
  float flame = smoothstep(0.26, 0.14, length((fract(cq) - 0.5) * vec2(1.0, 0.35)));
  colour = mix(colour, cypress, flame * pick * (1.0 - far * 0.4));
  // The air between: the far rows give up their colour to a blue-grey veil.
  return mix(colour, airy, far * far * 0.55 + far * 0.12);
}
`;
