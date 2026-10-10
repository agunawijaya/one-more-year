/**
 * The daily scenario and the Almanac streak.
 *
 * Every simulation has one world per UTC day, the same for everyone, seeded
 * from the simulation id and the date and numbered from launch day (#1). The
 * first attempt of the day is the one that counts for sharing; replays are
 * always allowed.
 *
 * Playing any daily scenario on a UTC day extends the Almanac streak, which
 * is gentle on purpose: one missed day in any seven is forgiven on its own
 * and drawn as a pressed flower, and when a streak does end nothing is
 * announced; the counter quietly starts a new volume.
 *
 * Days are UTC date keys ("2026-10-09") everywhere, so the player's time
 * zone and daylight-saving changes can never move a day.
 */
import { hashString, mixSeeds } from './rng.ts';
import { createSlot, isRecord, type KeyValueStore } from './save.ts';

/** Daily #1. The one place to change if launch moves. */
export const LAUNCH_DAY = '2026-10-09';

const DAY_MS = 86_400_000;

export function dayKey(date: Date | number): string {
  return new Date(date).toISOString().slice(0, 10);
}

function dayIndex(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

export function addDays(day: string, count: number): string {
  return dayKey((dayIndex(day) + count) * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

/** #1 on launch day, #2 the day after; days before launch are numbered 0 and below. */
export function dailyNumber(day: string): number {
  return daysBetween(LAUNCH_DAY, day) + 1;
}

/** The same seed for everyone who plays this simulation's daily scenario on this day. */
export function dailySeed(simId: string, day: string): number {
  return mixSeeds(hashString(simId), hashString(`daily:${day}`));
}

// ---- the daily record -------------------------------------------------------

/** What the first attempt of a day produced, kept for the share string. */
export interface DailyResult {
  chronicleId: string;
  share: string;
  verdictTier: number;
}

export interface DailyBook {
  /** Records a finished daily run. Only the first attempt of a day is kept; false for later ones. */
  record(simId: string, day: string, result: DailyResult): boolean;
  /** Notes that a daily scenario was begun today: that alone keeps the streak. */
  markPlayed(simId: string, day: string): void;
  result(simId: string, day: string): DailyResult | null;
  /** True once any daily scenario of this simulation was begun that day. */
  played(simId: string, day: string): boolean;
  /** Every day on which some daily scenario was played, sorted. */
  playedDays(): string[];
  streak(today: string): Streak;
  forget(): void;
}

interface DailyData {
  /** day → simId → result (null while begun but not finished). */
  days: Record<string, Record<string, DailyResult | null>>;
}

export const DAILY_KEY = 'omy:daily';

export function createDailyBook(store: KeyValueStore): DailyBook {
  const slot = createSlot<DailyData>(store, DAILY_KEY, {
    version: 1,
    defaults: () => ({ days: {} }),
    parse: (data) =>
      isRecord(data) && isRecord(data.days) ? (data as unknown as DailyData) : null,
  });

  const book: DailyBook = {
    record(simId, day, result) {
      const data = slot.load();
      const forDay = data.days[day] ?? {};
      if (forDay[simId]) return false;
      forDay[simId] = result;
      data.days[day] = forDay;
      slot.save(data);
      return true;
    },

    markPlayed(simId, day) {
      const data = slot.load();
      const forDay = data.days[day] ?? {};
      if (simId in forDay) return;
      forDay[simId] = null;
      data.days[day] = forDay;
      slot.save(data);
    },

    result: (simId, day) => slot.load().days[day]?.[simId] ?? null,

    played: (simId, day) => simId in (slot.load().days[day] ?? {}),

    playedDays: () => Object.keys(slot.load().days).sort(),

    streak: (today) => computeStreak(book.playedDays(), today),

    forget() {
      slot.clear();
    },
  };
  return book;
}

// ---- the streak --------------------------------------------------------------

export type DayMark = 'played' | 'grace' | 'today';

export interface StreakDay {
  day: string;
  mark: DayMark;
}

export interface Streak {
  /** Days played in the current volume ("12 years running"); 0 when no volume is open. */
  current: number;
  /** 1-based number of the current (or next) volume. */
  volume: number;
  /** The longest volume so far, in days played. */
  best: number;
  /** The current volume day by day, oldest first; empty when no volume is open. */
  days: StreakDay[];
  playedToday: boolean;
}

/** A missed day is forgiven only if no other day was forgiven in the six days before it. */
export const GRACE_WINDOW = 7;

export function computeStreak(playedDays: readonly string[], today: string): Streak {
  const played = new Set(playedDays.filter((day) => day <= today));
  const sorted = [...played].sort();
  const first = sorted[0];
  if (first === undefined) {
    return { current: 0, volume: 1, best: 0, days: [], playedToday: false };
  }

  let volume = 0;
  let current = 0;
  let best = 0;
  let open = false;
  let lastGrace: string | null = null;
  let days: StreakDay[] = [];

  for (let day = first; day <= today; day = addDays(day, 1)) {
    if (played.has(day)) {
      if (!open) {
        open = true;
        volume++;
        current = 0;
        days = [];
        lastGrace = null;
      }
      current++;
      best = Math.max(best, current);
      days.push({ day, mark: 'played' });
    } else if (day === today) {
      // Today is not over: an open volume simply waits.
      if (open) days.push({ day, mark: 'today' });
    } else if (open) {
      const graceAllowed = lastGrace === null || daysBetween(lastGrace, day) >= GRACE_WINDOW;
      if (graceAllowed) {
        lastGrace = day;
        days.push({ day, mark: 'grace' });
      } else {
        open = false;
        current = 0;
        days = [];
      }
    }
  }

  return {
    current: open ? current : 0,
    volume: open ? volume : volume + 1,
    best,
    days: open ? days : [],
    playedToday: played.has(today),
  };
}

// ---- the share string -------------------------------------------------------

export const SHARE_LIMITS = {
  /** Longer runs are shown as their first glyphs and a count of the rest. */
  maxGlyphs: 30,
  glyphsPerRow: 10,
  maxLineLength: 80,
} as const;

export interface ShareStringInput {
  simTitle: string;
  dailyNumber?: number | null;
  /** One emoji or short symbol per turn, from the simulation. */
  glyphs: readonly string[];
  /** The headline numbers, e.g. "Fed 100% · Land +40%". */
  line: string;
  epithet: string;
}

/**
 * A short text that says how a run went without a single personal detail:
 *
 *   One More Year · Ten Harvests #12
 *   🌾🌾🌧️🐀🌾🌾☀️🌾🌾🌾
 *   Fed 100% · Land +40% · "Keeper of Full Granaries"
 */
export function shareString(input: ShareStringInput): string {
  const title = input.dailyNumber ? `${input.simTitle} #${input.dailyNumber}` : input.simTitle;
  const shown = input.glyphs.slice(0, SHARE_LIMITS.maxGlyphs);
  const rows: string[] = [];
  for (let i = 0; i < shown.length; i += SHARE_LIMITS.glyphsPerRow) {
    rows.push(shown.slice(i, i + SHARE_LIMITS.glyphsPerRow).join(''));
  }
  const hidden = input.glyphs.length - shown.length;
  if (hidden > 0) rows.push(`+${hidden} more`);
  const summary = clip(`${input.line} · "${input.epithet}"`, SHARE_LIMITS.maxLineLength);
  return [`One More Year · ${title}`, ...rows, summary].join('\n');
}

function clip(text: string, limit: number): string {
  // Count what a reader sees as characters, so an emoji is never cut in half.
  const characters = Array.from(new Intl.Segmenter().segment(text), (part) => part.segment);
  return characters.length <= limit ? text : `${characters.slice(0, limit - 1).join('')}…`;
}
