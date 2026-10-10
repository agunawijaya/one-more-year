import { describe, expect, it } from 'vitest';
import { describeEvent, type SimEvent } from '@one-more-year/kit';
import { EVENT_TEXT, headlineFor } from '../src/content/text.ts';

const event = (kind: string, numbers: Record<string, number> = {}): SimEvent => ({
  kind,
  severity: 'neutral',
  numbers,
  weight: 1,
});

describe('the words of the year', () => {
  it('heads the report with the harvest and the one other thing worth remembering', () => {
    const harvest = event('harvest', { acres: 999, yield: 5, bushels: 4995 });
    expect(headlineFor([harvest, event('all-fed')])).toBe('A fine harvest');
    expect(headlineFor([harvest, event('rats', { eaten: 200 }), event('fever', { lost: 9 })])).toBe(
      'A fine harvest, and fever in the lanes',
    );
    expect(headlineFor([event('harvest', { acres: 0 }), event('hunger', { hungry: 3 })])).toBe(
      'A year with nothing sown, and empty bowls',
    );
    expect(headlineFor([harvest, event('deposed')])).toBe('The council meets at dawn');
  });

  it('never writes one acre, one bushel or one person as many', () => {
    const say = (kind: string, numbers: Record<string, number>): string =>
      describeEvent(EVENT_TEXT, event(kind, numbers));
    expect(say('sown', { acres: 1, seed: 0 })).toBe(
      '1 acre was sown, and the seed it needed rounded down to nothing.',
    );
    expect(say('sown', { acres: 3, seed: 1 })).toBe('3 acres were sown with 1 bushel of seed.');
    expect(say('harvest', { acres: 3, yield: 1, bushels: 3 })).toBe(
      'A thin harvest: 1 bushel an acre, 3 in all.',
    );
    expect(say('rats', { eaten: 1 })).toBe('Rats got into the granary and ate 1 bushel.');
    expect(say('hunger', { hungry: 1 })).toBe('1 person went hungry this year.');
    expect(say('newcomers', { people: 1 })).toBe('One newcomer came to the city.');
    expect(say('land-bought', { acres: 1, price: 20 })).toBe(
      'The city bought 1 acre at 20 bushels each.',
    );
  });
});
