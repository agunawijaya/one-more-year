/**
 * The words and the Legacy: every event the engine can produce has a line of
 * its own, every codex entry it can sight exists, the glyphs follow their
 * priority, and there are as many epithets, milestones and entries as the
 * design promises.
 */
import { createRunHistory, describeEvent, type TurnRecord } from '@one-more-year/kit';
import { describe, expect, it } from 'vitest';
import { CODEX, EPITHETS, MILESTONES } from '../src/content/legacy.ts';
import { EVENT_TEXT, glyphFor, shareLineFor, spelled, titleFor } from '../src/content/text.ts';
import { VERDICT_LINES } from '../src/content/verdicts.ts';
import { BOTS } from '../src/engine/bots.ts';
import { quickCourt } from '../src/engine/court.ts';
import { crownModel } from '../src/engine/model.ts';
import { policyView, actingRealm } from '../src/engine/world.ts';
import { VERDICTS } from '../src/engine/verdict.ts';
import { courtOptions } from '../src/engine/court.ts';
import type { Plan, World } from '../src/engine/state.ts';
import { createRng, rngForStep } from '@one-more-year/kit';

/** A few long games' worth of every human event, to see which kinds and codex ids occur. */
function playedRecords(): TurnRecord<Plan>[] {
  const records: TurnRecord<Plan>[] = [];
  for (const [seed, bot] of [
    [3, BOTS.competent],
    [8, BOTS.naive],
    [13, BOTS.random],
    [21, BOTS.general],
  ] as const) {
    const court = quickCourt(seed, 1, 3, { fate: 'dynasty' });
    const setup = { seed, scenario: 'standard', seats: 1, options: courtOptions(court) };
    let world: World = crownModel.init(setup);
    for (let step = 0; step < 70 && !crownModel.outcome(world); step++) {
      const plan = bot(policyView(world, actingRealm(world)), createRng(seed).fork(`s${step}`));
      const { state, events } = crownModel.resolve(world, plan, rngForStep(seed, step));
      records.push({
        step,
        turn: step + 1,
        seat: 0,
        plan,
        events,
        signals: crownModel.signals(state, 0),
        tone: 'quiet',
      });
      world = state;
    }
  }
  return records;
}

const records = playedRecords();
const events = records.flatMap((r) => r.events);

describe('the words for what happens', () => {
  it('give every kind of event the engine produced a line of its own', () => {
    for (const e of events) {
      expect(EVENT_TEXT[e.kind], `no text for ${e.kind}`).toBeDefined();
      expect(describeEvent(EVENT_TEXT, e)).not.toBe(e.kind);
    }
  });

  it('name a codex entry for every sighting the engine makes', () => {
    const ids = new Set(CODEX.map((entry) => entry.id));
    for (const e of events) if (e.codex) expect(ids.has(e.codex), e.codex).toBe(true);
  });

  it('write small numbers in words', () => {
    expect(spelled(27)).toBe('twenty-seven');
    expect(spelled(40)).toBe('forty');
    expect(spelled(120)).toBe('120');
  });
});

describe('the Legacy', () => {
  it('offers at least twelve epithets, each its own', () => {
    expect(EPITHETS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(EPITHETS.map((e) => e.id)).size).toBe(EPITHETS.length);
  });

  it('offers about eighteen milestones across stewardship, insight and curiosity', () => {
    expect(MILESTONES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(MILESTONES.map((m) => m.kind))).toEqual(
      new Set(['stewardship', 'insight', 'curiosity']),
    );
  });

  it('keeps a codex of at least twelve entries, including the difficulty that never was', () => {
    expect(CODEX.length).toBeGreaterThanOrEqual(12);
    expect(CODEX.map((entry) => entry.id)).toContain('lost-difficulty');
  });

  it('has the heralds’ lines for every verdict', () => {
    for (const id of Object.keys(VERDICTS)) {
      expect(VERDICT_LINES[id as keyof typeof VERDICT_LINES].length).toBeGreaterThan(0);
    }
  });
});

describe('the daily glyphs', () => {
  const record = (kinds: string[], grade = 3): TurnRecord<Plan> => ({
    step: 0,
    turn: 1,
    seat: 0,
    plan: {} as Plan,
    signals: {},
    tone: 'quiet',
    events: [
      { kind: 'weather', severity: 'neutral', numbers: { grade }, weight: 1 },
      ...kinds.map((kind) => ({
        kind,
        severity: 'good' as const,
        numbers: { markets: 1 },
        weight: 1,
      })),
    ],
  });

  it('put a title before an invasion, an invasion before a building, a building before the weather', () => {
    expect(glyphFor(record(['promoted', 'invaded', 'built']))).toBe('👑');
    expect(glyphFor(record(['invaded', 'built']))).toBe('⚔️');
    expect(glyphFor(record(['built']))).toBe('🏛️');
    expect(glyphFor(record([], 5))).toBe('☀️');
    expect(glyphFor(record([], 1))).toBe('🌩️');
  });
});

describe('the chronicle’s lines', () => {
  it('title a crowned run by its town and its years, and share it with the title and the rivals', () => {
    const crowned = records.findIndex((r) => r.events.some((e) => e.kind === 'crowned'));
    expect(crowned).toBeGreaterThan(-1);
    const court = quickCourt(3, 1, 3, { fate: 'dynasty' });
    const setup = { seed: 3, scenario: 'standard', seats: 1, options: courtOptions(court) };
    const mine = records.slice(0, crowned + 1).filter((r) => r.events.length > 0);
    const history = createRunHistory(setup, {}, mine, {
      ending: 'crowned',
      verdict: VERDICTS['crowned-first'],
    });
    expect(titleFor(history)).toMatch(
      new RegExp(`^${court.seats[0]?.town ?? ''}: [a-z-]+ years to the crown$`),
    );
    expect(shareLineFor(history)).toMatch(/^(Re|Regina) in \d+ years · 3 rivals$/);
  });
});
