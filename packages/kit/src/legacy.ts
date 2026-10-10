/**
 * Legacy ranks: the collection-wide ladder that milestone points climb.
 *
 * Six ranks, named for the almanac the Hall pretends to be: you begin as a
 * Novice who has only read about these worlds, and grow into a Sage who
 * understands them. Each rank unlocks cosmetics only (a book cover, a
 * dashboard palette, a dome trim, chosen per theme in the Hall's data); no
 * rank changes how any simulation plays.
 *
 * Thresholds assume about 250–350 points per simulation, so the first ranks
 * come within a couple of evenings and Sage asks for real mastery of more
 * than one world.
 */

export interface Rank {
  id: string;
  title: string;
  /** Points needed to reach this rank. */
  threshold: number;
  /** One line about what the rank means, for the Legacy page. */
  motto: string;
}

export const RANKS: readonly Rank[] = [
  { id: 'novice', title: 'Novice', threshold: 0, motto: 'You have opened the almanac.' },
  { id: 'scribe', title: 'Scribe', threshold: 40, motto: 'You keep a careful record.' },
  { id: 'steward', title: 'Steward', threshold: 120, motto: 'Worlds prosper in your care.' },
  { id: 'chronicler', title: 'Chronicler', threshold: 250, motto: 'Your years are worth reading.' },
  {
    id: 'keeper',
    title: 'Keeper of Years',
    threshold: 420,
    motto: 'You know how these worlds turn.',
  },
  { id: 'sage', title: 'Sage', threshold: 650, motto: 'Little in these pages surprises you.' },
];

export interface RankStanding {
  rank: Rank;
  /** 0-based position on the ladder. */
  index: number;
  next: Rank | null;
  /** Points still needed for the next rank (0 at the top). */
  toNext: number;
  /** 0–1 progress from this rank's threshold to the next. */
  progress: number;
  points: number;
}

export function rankFor(points: number, ranks: readonly Rank[] = RANKS): RankStanding {
  let index = 0;
  ranks.forEach((rank, i) => {
    if (points >= rank.threshold) index = i;
  });
  const rank = ranks[index] as Rank;
  const next = ranks[index + 1] ?? null;
  const span = next ? next.threshold - rank.threshold : 1;
  return {
    rank,
    index,
    next,
    toNext: next ? Math.max(0, next.threshold - points) : 0,
    progress: next ? Math.min(1, Math.max(0, (points - rank.threshold) / span)) : 1,
    points,
  };
}

/** Every rank reached so far, lowest first (each one's cosmetics are unlocked). */
export function ranksReached(points: number, ranks: readonly Rank[] = RANKS): Rank[] {
  return ranks.filter((rank) => points >= rank.threshold);
}
