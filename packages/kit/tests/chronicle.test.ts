import { describe, expect, it } from 'vitest';
import {
  FALLBACK_EPITHETS,
  buildChronicle,
  createRunHistory,
  parseChronicle,
  pickEpithet,
  serializeChronicle,
  type ChronicleInput,
  type EpithetRule,
} from '../src/chronicle.ts';
import { shareString } from '../src/daily.ts';
import { event, numberOf } from '../src/events.ts';
import { replayPlans, type TurnRecord } from '../src/turns.ts';
import { orchard, steadyPlans } from './orchard-model.ts';

const setup = { seed: 77, scenario: 'standard', seats: 1 };
const TEXT = {
  harvest: (e: ReturnType<typeof event>) => `${numberOf(e, 'total')} apples picked`,
  pests: (e: ReturnType<typeof event>) => `Pests ate ${numberOf(e, 'eaten')} apples`,
};
const EPITHETS: EpithetRule[] = [
  { id: 'grower', text: 'Who Never Stopped Planting', when: (h) => h.neverFell('trees') },
  {
    id: 'pest-proof',
    text: 'Untroubled by Pests',
    priority: 5,
    when: (h) => h.count('pests') === 0,
  },
];

function input(): ChronicleInput {
  const { history } = replayPlans(orchard, setup, steadyPlans(6));
  const opening = [orchard.signals(orchard.init(setup), 0)];
  return {
    id: 'chr-1',
    simId: 'orchard',
    runId: 'run-1',
    setup,
    scenarioTitle: 'Standard',
    daily: { day: '2026-10-09', number: 1 },
    replayOf: null,
    startedAt: 1000,
    finishedAt: 2000,
    turnUnit: 'year',
    opening,
    history,
    outcome: { ending: 'seasons-done', verdict: { id: 'modest', label: 'Modest', tier: 3 } },
    signalIds: ['trees', 'apples'],
    primarySignal: 'apples',
    text: TEXT,
    epithets: EPITHETS,
    title: (h) => `${h.records.length} years in the orchard`,
    glyph: (record) => (record.tone === 'good' ? '🍎' : record.tone === 'quiet' ? '🌳' : '🐛'),
    shareLine: (h) => `Trees ${h.final('trees')}`,
    shareString: (glyphs, line, epithet) =>
      shareString({ simTitle: 'Orchard', dailyNumber: 1, glyphs, line, epithet }),
  };
}

describe('chronicle', () => {
  it('builds a page of history from a finished run', () => {
    const entry = buildChronicle(input());
    expect(entry.title).toBe('6 years in the orchard');
    expect(entry.turns).toBe(6);
    expect(entry.timeline).toHaveLength(6);
    expect(entry.timeline[0]?.headline).toMatch(/apples picked|Pests ate/);
    expect(entry.series.trees).toEqual([10, 12, 14, 16, 18, 20, 22]);
    expect(entry.finalSignals.trees).toBe(22);
    expect(entry.keyMoments.length).toBeGreaterThanOrEqual(2);
    expect(entry.keyMoments.length).toBeLessThanOrEqual(3);
    expect(new Set(entry.keyMoments.map((m) => m.turn)).size).toBe(entry.keyMoments.length);
    expect(entry.share.split('\n')[0]).toBe('One More Year · Orchard #1');
    expect(entry.share).toContain('Trees 22');
  });

  it('names the tenure by the highest-priority rule that holds', () => {
    const entry = buildChronicle(input());
    const pests = entry.timeline.some((turn) => turn.headline.startsWith('Pests'));
    expect(entry.epithet.text).toBe(pests ? 'Who Never Stopped Planting' : 'Untroubled by Pests');
  });

  it('falls back by the overall feel of the run when no rule holds', () => {
    const history = (tones: TurnRecord<unknown>['tone'][]) =>
      createRunHistory(
        setup,
        {},
        tones.map((tone, step) => ({
          step,
          turn: step + 1,
          seat: 0,
          plan: {},
          events: [],
          signals: {},
          tone,
        })),
        { ending: 'x', verdict: { id: 'v', label: 'V', tier: 3 } },
      );
    expect(pickEpithet([], history(['good', 'quiet']))).toBe(FALLBACK_EPITHETS.calm);
    expect(pickEpithet([], history(['good', 'hard', 'quiet', 'good']))).toBe(
      FALLBACK_EPITHETS.mixed,
    );
    expect(pickEpithet([], history(['hard', 'disaster', 'good']))).toBe(FALLBACK_EPITHETS.stormy);
  });

  it('picks the worst disaster the world came through as a key moment', () => {
    const base = input();
    const records: TurnRecord<unknown>[] = [1, 2, 3, 4].map((turn) => ({
      step: turn - 1,
      turn,
      seat: 0,
      plan: {},
      events: [event('harvest', 'neutral', { total: 10 })],
      signals: { apples: 100, trees: 10 },
      tone: 'quiet',
    }));
    records[1] = {
      ...(records[1] as TurnRecord<unknown>),
      events: [event('pests', 'disaster', { eaten: 90 }, { weight: 6 })],
      signals: { apples: 10, trees: 10 },
      tone: 'disaster',
    };
    const entry = buildChronicle({
      ...base,
      history: records,
      opening: [{ apples: 100, trees: 10 }],
    });
    const worst = entry.keyMoments.find((moment) => moment.kind === 'worst-survived');
    expect(worst?.turn).toBe(2);
    const swing = entry.keyMoments.find((moment) => moment.kind === 'biggest-swing');
    expect(swing).toMatchObject({ turn: 3, delta: 90 });
  });

  it('serialises stably and round-trips', () => {
    const entry = buildChronicle(input());
    const text = serializeChronicle(entry);
    expect(serializeChronicle(JSON.parse(text) as typeof entry)).toBe(text);
    const reordered = Object.fromEntries(Object.entries(entry).reverse()) as typeof entry;
    expect(serializeChronicle(reordered)).toBe(text);
    expect(parseChronicle(text)).toEqual(entry);
  });

  it('rejects text that is not a chronicle', () => {
    expect(parseChronicle('{')).toBeNull();
    expect(parseChronicle('{"v":1}')).toBeNull();
    expect(parseChronicle(JSON.stringify({ ...buildChronicle(input()), v: 99 }))).toBeNull();
  });
});

describe('key moments', () => {
  it('tells at least two moments even in a calm run', () => {
    const base = input();
    const calm: TurnRecord<unknown>[] = [100, 120, 115, 140, 150].map((apples, index) => ({
      step: index,
      turn: index + 1,
      seat: 0,
      plan: {},
      events: [event('harvest', index === 2 ? 'warning' : 'good', { total: apples })],
      signals: { apples, trees: 10 },
      tone: index === 2 ? 'hard' : 'good',
    }));
    const entry = buildChronicle({ ...base, history: calm, opening: [{ apples: 100, trees: 10 }] });
    expect(entry.keyMoments.length).toBeGreaterThanOrEqual(2);
    expect(new Set(entry.keyMoments.map((moment) => moment.turn)).size).toBe(
      entry.keyMoments.length,
    );
    expect(entry.keyMoments.map((moment) => moment.kind)).not.toContain('worst-survived');
  });
});
