import { describe, expect, it } from 'vitest';
import { byWeight, describeEvent, event, headlineOf, numberOf, toneOf } from '../src/events.ts';

describe('events', () => {
  it('builds events with default weights by severity', () => {
    const rain = event('rain', 'good', { mm: 40 });
    expect(rain).toEqual({ kind: 'rain', severity: 'good', numbers: { mm: 40 }, weight: 1 });
    const flood = event('flood', 'disaster', {}, { codex: 'flood', seat: 1 });
    expect(flood.weight).toBe(4);
    expect(flood.codex).toBe('flood');
    expect(flood.seat).toBe(1);
  });

  it('gives each turn a tone from its worst news', () => {
    expect(toneOf([])).toBe('quiet');
    expect(toneOf([event('a', 'neutral')])).toBe('quiet');
    expect(toneOf([event('a', 'good'), event('b', 'neutral')])).toBe('good');
    expect(toneOf([event('a', 'good'), event('b', 'warning')])).toBe('hard');
    expect(toneOf([event('a', 'warning'), event('b', 'disaster')])).toBe('disaster');
  });

  it('leads with the heaviest event, worse news first on ties', () => {
    const events = [
      event('births', 'good', {}, { weight: 2 }),
      event('rats', 'warning', {}, { weight: 2 }),
      event('quiet', 'neutral'),
    ];
    expect(headlineOf(events)?.kind).toBe('rats');
    expect(byWeight(events).map((e) => e.kind)).toEqual(['births', 'rats', 'quiet']);
    expect(headlineOf([])).toBeUndefined();
  });

  it('describes events with the simulation text, falling back to the kind', () => {
    const text = { rain: (e: ReturnType<typeof event>) => `${numberOf(e, 'mm')} mm of rain` };
    expect(describeEvent(text, event('rain', 'good', { mm: 40 }))).toBe('40 mm of rain');
    expect(describeEvent(text, event('drought', 'warning'))).toBe('drought');
    expect(numberOf(event('x', 'neutral'), 'missing')).toBe(0);
  });
});
