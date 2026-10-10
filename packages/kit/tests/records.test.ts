// Milestones, codex, stats and legacy ranks: the record books the Hall keeps.
import { describe, expect, it, vi } from 'vitest';
import { createCodexBook, type CodexEntryDef } from '../src/codex.ts';
import { RANKS, rankFor, ranksReached } from '../src/legacy.ts';
import { createMilestoneBook, type MilestoneDef } from '../src/milestones.ts';
import { createStorage } from '../src/save.ts';
import { createStatsBook } from '../src/stats.ts';
import { MemoryStorage } from './storage-doubles.ts';

const MILESTONES: MilestoneDef[] = [
  { id: 'fed', kind: 'stewardship', title: 'Fed', description: 'Nobody hungry', points: 30 },
  { id: 'seen', kind: 'insight', title: 'Seen', description: 'See 3 kinds', points: 20, target: 3 },
  { id: 'odd', kind: 'curiosity', title: 'Odd', description: 'Never sell', points: 10 },
];

const ENTRY = (id: string, revealAfter?: number): CodexEntryDef => ({
  id,
  title: id,
  summary: '',
  tendency: '',
  mechanism: '',
  hint: '',
  art: '',
  ...(revealAfter === undefined ? {} : { revealAfter }),
});

describe('milestones', () => {
  it('unlocks once and announces it', () => {
    const book = createMilestoneBook(createStorage(new MemoryStorage()), () => 100);
    const heard = vi.fn();
    book.subscribe(heard);
    const pond = book.forSim('pond', MILESTONES);
    expect(pond.unlock('fed')).toBe(true);
    expect(pond.unlock('fed')).toBe(false);
    expect(pond.unlock('unknown')).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0]?.[0]).toMatchObject({ simId: 'pond', def: { id: 'fed' } });
    expect(pond.list().find((view) => view.def.id === 'fed')?.unlockedAt).toBe(100);
  });

  it('counts progress upwards and unlocks at the target', () => {
    const pond = createMilestoneBook(createStorage(new MemoryStorage())).forSim('pond', MILESTONES);
    expect(pond.progress('seen', 1)).toBe(false);
    expect(pond.progress('seen', 0)).toBe(false);
    expect(pond.list()[1]?.progress).toBe(1);
    expect(pond.progress('seen', 3)).toBe(true);
    expect(pond.isUnlocked('seen')).toBe(true);
    expect(pond.progress('seen', 5)).toBe(false);
  });

  it('adds up points across simulations, ignoring retired milestones', () => {
    const store = createStorage(new MemoryStorage());
    const book = createMilestoneBook(store);
    book.forSim('pond', MILESTONES).unlock('fed');
    book.forSim('pond', MILESTONES).unlock('odd');
    book.forSim('lake', MILESTONES).unlock('fed');
    expect(book.forSim('pond', MILESTONES).points()).toBe(40);
    expect(book.totalPoints({ pond: MILESTONES, lake: MILESTONES })).toBe(70);
    // A later version drops "odd": it stops counting, nothing crashes.
    expect(book.totalPoints({ pond: MILESTONES.slice(0, 2), lake: MILESTONES })).toBe(60);
    book.forget();
    expect(book.totalPoints({ pond: MILESTONES })).toBe(0);
  });
});

describe('codex', () => {
  it('discovers on first sighting and reveals the mechanism after a few', () => {
    const book = createCodexBook(createStorage(new MemoryStorage()), () => 50);
    const codex = book.forSim('pond', [ENTRY('drought'), ENTRY('heron', 2)]);
    expect(codex.progress()).toEqual({ discovered: 0, total: 2 });

    const first = codex.sight('heron', 'run-1');
    expect(first).toMatchObject({ isNew: true, seen: 1, revealedNow: false });
    const second = codex.sight('heron', 'run-1');
    expect(second).toMatchObject({ isNew: false, seen: 2, revealedNow: true });
    expect(codex.sight('nothing', 'run-1')).toBeNull();

    const heron = codex.entries().find((entry) => entry.def.id === 'heron');
    expect(heron).toMatchObject({
      discovered: true,
      seen: 2,
      mechanismRevealed: true,
      firstSeenAt: 50,
    });
    expect(codex.entries()[0]).toMatchObject({ discovered: false, mechanismRevealed: false });
    expect(codex.progress()).toEqual({ discovered: 1, total: 2 });
  });

  it('links first sightings to the chronicle their run became', () => {
    const codex = createCodexBook(createStorage(new MemoryStorage())).forSim('pond', [
      ENTRY('drought'),
      ENTRY('heron'),
    ]);
    codex.sight('drought', 'run-1');
    codex.sight('heron', 'run-2');
    codex.linkChronicle('run-1', 'chronicle-1');
    const [drought, heron] = codex.entries();
    expect(drought?.firstChronicleId).toBe('chronicle-1');
    expect(heron?.firstChronicleId).toBeNull();
  });

  it('announces sightings', () => {
    const book = createCodexBook(createStorage(new MemoryStorage()));
    const heard = vi.fn();
    book.subscribe(heard);
    book.forSim('pond', [ENTRY('drought')]).sight('drought', 'r');
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ isNew: true, simId: 'pond' }));
  });
});

describe('stats', () => {
  it('counts runs, turns and time, and keeps the best verdict', () => {
    let clock = 1000;
    const book = createStatsBook(createStorage(new MemoryStorage()), () => clock);
    const pond = book.forSim('pond');
    pond.runBegun();
    pond.turnPlayed();
    pond.turnPlayed();
    pond.addTime(90_000);
    pond.runFinished({ id: 'fine', label: 'Fine', tier: 3 });
    pond.runFinished({ id: 'poor', label: 'Poor', tier: 1 });
    clock = 2000;
    pond.runBegun();
    expect(pond.get()).toEqual({
      runsBegun: 2,
      runsFinished: 2,
      turnsPlayed: 2,
      msPlayed: 90_000,
      lastPlayed: 2000,
      bestVerdict: { id: 'fine', label: 'Fine', tier: 3 },
    });
    expect(Object.keys(book.all())).toEqual(['pond']);
  });
});

describe('legacy ranks', () => {
  it('climbs six ranks by points', () => {
    expect(RANKS).toHaveLength(6);
    expect(rankFor(0).rank.title).toBe('Novice');
    expect(rankFor(39).rank.title).toBe('Novice');
    expect(rankFor(40).rank.title).toBe('Scribe');
    expect(rankFor(649).rank.title).toBe('Keeper of Years');
    expect(rankFor(650).rank.title).toBe('Sage');
    expect(rankFor(5000).rank.title).toBe('Sage');
  });

  it('reports the way to the next rank', () => {
    expect(rankFor(80)).toMatchObject({ index: 1, toNext: 40, progress: 0.5 });
    expect(rankFor(700)).toMatchObject({ next: null, toNext: 0, progress: 1 });
  });

  it('keeps thresholds strictly rising', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]?.threshold).toBeGreaterThan(RANKS[i - 1]?.threshold ?? 0);
    }
    expect(ranksReached(130).map((rank) => rank.id)).toEqual(['novice', 'scribe', 'steward']);
  });
});

describe('stored milestone points', () => {
  it('adds up without the definitions, for the Hall before modules load', () => {
    const book = createMilestoneBook(createStorage(new MemoryStorage()));
    book.forSim('pond', MILESTONES).unlock('fed');
    book.forSim('lake', MILESTONES).unlock('odd');
    book.forSim('lake', MILESTONES).progress('seen', 1);
    expect(book.storedPoints()).toBe(40);
    expect(book.unlockedCounts()).toEqual({ pond: 1, lake: 1 });
  });
});
