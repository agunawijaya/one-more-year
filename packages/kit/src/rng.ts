/**
 * Seeded pseudo-random numbers. Every simulation draws its randomness from
 * here so that a seed fully determines a world: replays, the daily scenario,
 * ghosts, forecasts and tests all depend on that.
 *
 * The generator is sfc32 (Chris Doty-Humphrey's Small Fast Counter), seeded
 * through splitmix32 so that neighbouring seeds such as 1, 2 and 3 still give
 * unrelated streams. Only integer arithmetic and IEEE multiplication are used,
 * never Math.log or Math.cos, because those may round differently between
 * JavaScript engines and a replay must match in every browser.
 *
 * Streams: `fork(label)` derives a child from the stream's identity and the
 * label alone, never from how many numbers have been drawn. So the weather
 * stream of year 3 is the same whether or not the events stream drew one
 * extra number, and adding a random draw to one subsystem never reshuffles
 * another.
 */

export interface Rng {
  /** This stream's identity; children derive theirs from it. */
  readonly key: number;
  /** How many numbers this stream and all its forks have drawn so far. */
  readonly draws: number;
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both ends included. */
  int(min: number, max: number): number;
  /** A float in [min, max). */
  float(min: number, max: number): number;
  /** True with the given probability (0 = never, 1 = always). */
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Picks one value, each with probability proportional to its weight. */
  weighted<T>(options: readonly { value: T; weight: number }[]): T;
  /** A shuffled copy; the input is left untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * Roughly normal: the sum of twelve uniforms (Irwin–Hall), clipped at six
   * standard deviations by construction and free of transcendental functions.
   */
  normal(mean: number, deviation: number): number;
  /** An independent child stream for one subsystem (weather, events, people…). */
  fork(label: string): Rng;
}

const UINT32_RANGE = 4294967296;

/** Shared by a stream and its forks so `draws` counts the whole family. */
interface Tally {
  draws: number;
}

export function createRng(seed: number | string): Rng {
  return streamFor(toSeed(seed), { draws: 0 });
}

/** A fresh seed for worlds that should differ every time (normal play). */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }
  return Math.floor(Math.random() * UINT32_RANGE);
}

/**
 * Hashes a string to an unsigned 32-bit integer: FNV-1a followed by the
 * murmur3 finaliser, so similar strings land far apart.
 */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return finalizeHash(hash);
}

/** Combines two 32-bit values into one well-mixed seed (order matters). */
export function mixSeeds(a: number, b: number): number {
  return finalizeHash((Math.imul(a >>> 0, 0x9e3779b1) ^ (b >>> 0)) >>> 0);
}

function toSeed(seed: number | string): number {
  if (typeof seed === 'string') return hashString(seed);
  if (!Number.isFinite(seed)) throw new RangeError(`Seed must be a finite number, got ${seed}`);
  return Math.trunc(seed) >>> 0;
}

function finalizeHash(value: number): number {
  let hash = value;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function splitmix32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x9e3779b9) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function streamFor(key: number, tally: Tally): Rng {
  const mix = splitmix32(key);
  let a = mix();
  let b = mix();
  let c = mix();
  let d = mix();

  function nextUint32(): number {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  }

  // sfc32's first outputs still echo the seed; a short warm-up is the author's advice.
  for (let i = 0; i < 12; i++) nextUint32();

  const rng: Rng = {
    key,
    get draws() {
      return tally.draws;
    },

    next() {
      tally.draws++;
      return nextUint32() / UINT32_RANGE;
    },

    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`int() needs integers with min <= max, got ${min}..${max}`);
      }
      return min + Math.floor(rng.next() * (max - min + 1));
    },

    float(min, max) {
      return min + rng.next() * (max - min);
    },

    chance(probability) {
      return rng.next() < probability;
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
      return items[rng.int(0, items.length - 1)] as T;
    },

    weighted<T>(options: readonly { value: T; weight: number }[]): T {
      const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
      if (total <= 0) throw new RangeError('weighted() needs at least one positive weight');
      let roll = rng.next() * total;
      for (const option of options) {
        roll -= Math.max(0, option.weight);
        if (roll < 0) return option.value;
      }
      // Floating-point leftovers can only land here when roll was within rounding of total.
      return (options.findLast((option) => option.weight > 0) as { value: T }).value;
    },

    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      // Fisher–Yates: walk backwards, swapping each slot with a random earlier one.
      for (let i = result.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const held = result[i] as T;
        result[i] = result[j] as T;
        result[j] = held;
      }
      return result;
    },

    normal(mean, deviation) {
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += rng.next();
      return mean + (sum - 6) * deviation;
    },

    fork(label) {
      return streamFor(mixSeeds(key, hashString(label)), tally);
    },
  };

  return rng;
}
