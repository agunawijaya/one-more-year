// The test harness: the real Hall, with the test-only Pond simulation
// playable like any other world. Served by the dev server (hall/harness.html)
// for Playwright and for screenshots; never part of a build.
//
// Query options:
//   ?fresh            a first visit (intro and theme picker); otherwise a returning visitor
//   ?fixtures=20      the catalog filled with generated planned worlds
//   ?now=2026-10-09T09:00:00Z   a fixed clock, for stable screenshots
//   ?theme=terrarium&appearance=dark   a starting look (returning visitors only)
//   ?memory           storage in memory only (as in a private window)
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import { bootHall, type HallApp } from '../../src/app/hall-app.ts';
import { discoverSims } from '../../src/data/discovered.ts';
import { fixtureManifests } from '../fixtures/fixture-manifests.ts';
import { manifest as pondManifest } from '../fixtures/pond/manifest.ts';

const params = new URLSearchParams(window.location.search);
const fixtures = params.get('fixtures');
const fixedNow = params.get('now');
const memory = params.has('memory');

if (!params.has('fresh') && !memory && localStorage.getItem('omy:settings') === null) {
  localStorage.setItem(
    'omy:settings',
    JSON.stringify({
      v: 1,
      d: {
        introSeen: true,
        themeChosen: true,
        theme: params.get('theme') ?? 'almanac',
        appearance: params.get('appearance') ?? 'light',
      },
    }),
  );
}

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing');

let clock = fixedNow ? Date.parse(fixedNow) : null;
const app: HallApp = bootHall({
  root,
  sims: [
    ...discoverSims(),
    {
      manifest: pondManifest,
      load: () => import('../fixtures/pond/index.ts').then((module) => module.default),
    },
  ],
  ...(fixtures ? { placeholders: fixtureManifests(Number(fixtures)) } : {}),
  allowUnreleased: true,
  services: {
    ...(memory ? { storage: null } : {}),
    ...(clock !== null ? { now: () => clock ?? 0 } : {}),
  },
});

Object.assign(window, {
  __harness: {
    app,
    view: () => app.stage.view,
    simId: () => app.stage.simId,
    chronicles: () => app.services.library.all(),
    runs: () => app.model.snapshot().continueRuns,
    /** Moves the fixed clock forward, for streak and daily tests. */
    advanceClock: (ms: number) => {
      if (clock !== null) clock += ms;
      app.model.refresh();
    },
  },
});
