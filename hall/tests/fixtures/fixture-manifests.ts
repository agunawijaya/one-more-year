/**
 * Generated manifests for layout tests: the Hall must look intentional with
 * the two planned worlds and with twenty. These never ship; the harness
 * loads them with ?fixtures=20 (or any count).
 */
import type { Domain, SimManifest, TurnUnit } from '@one-more-year/kit';
import { COMING_SOON } from '../../src/data/coming-soon.ts';

const DOMAINS: readonly Domain[] = [
  'governance',
  'economy',
  'ecology',
  'society',
  'journey',
  'physics',
];
const UNITS: readonly TurnUnit[] = ['year', 'season', 'month', 'week', 'day'];
const NAMES = [
  'Salt Road',
  'Lantern Harbour',
  'The Long Winter',
  'River Mill',
  'Orchard Wars',
  'Copper Valley',
  'Wind and Wool',
  'Night Market',
  'Glass Kiln',
  'High Pasture',
  'The Ferry',
  'Beekeeper',
  'Tidewater',
  'Stone Bridge',
  'Lighthouse',
  'Tin Mine',
  'Caravan',
  'Weather Station',
];
const ACCENTS: readonly [string, string][] = [
  ['#1d5e8c', '#7fc0ee'],
  ['#8a3b12', '#f0a46a'],
  ['#2f6b2f', '#93d48b'],
  ['#7a2f5c', '#e79ac8'],
  ['#5a4a12', '#e0c45e'],
  ['#2a5a6b', '#7fd0e6'],
];
// Simple shapes so each fixture has a distinct emblem.
const EMBLEMS = [
  'M4 18L12 4L20 18Z',
  'M5 5H19V19H5Z M9 9H15V15H9Z',
  'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z M12 7V12L15 15',
  'M3 12H21 M12 3V21 M6 6L18 18',
  'M4 20C8 10 16 10 20 20 M8 6H16',
  'M6 4V20 M18 4V20 M6 12H18',
];

export function fixtureManifests(count: number): SimManifest[] {
  const planned = [...COMING_SOON];
  const extra = Math.max(0, count - planned.length);
  for (let i = 0; i < extra; i++) {
    const [light, dark] = ACCENTS[i % ACCENTS.length] ?? ['#333333', '#cccccc'];
    const turns = 6 + ((i * 7) % 40);
    planned.push({
      id: `fixture-${i + 1}`,
      title: NAMES[i % NAMES.length] ?? `Fixture ${i + 1}`,
      tagline: 'A planned world used to test the Hall with a full catalog.',
      teaser:
        'This fixture exists only in tests. It checks that every theme stays calm and readable with twenty worlds.',
      domain: DOMAINS[i % DOMAINS.length] ?? 'economy',
      turnUnit: UNITS[i % UNITS.length] ?? 'year',
      typicalTurns: [turns, turns + 10],
      players: i % 3 === 0 ? '1–6P' : '1P',
      sessionMinutes: [5 + (i % 4) * 10, 15 + (i % 4) * 10 + (i % 5) * 15],
      status: 'coming-soon',
      accent: { light, dark },
      emblem: EMBLEMS[i % EMBLEMS.length] ?? 'M4 4H20V20H4Z',
      inspiredBy: {
        originalTitle: `Fixture ${i + 1}`,
        uiTitle: 'a test fixture',
        year: 1970 + i,
        credit: 'test fixture',
      },
      hasDailyScenario: false,
      scenarios: [],
      signals: [
        { id: 'a', label: 'Stock', unit: null, format: 'integer', higherIsBetter: true },
        { id: 'b', label: 'Reach', unit: null, format: 'percent', higherIsBetter: true },
      ],
    });
  }
  return planned.slice(0, Math.max(count, 0));
}
