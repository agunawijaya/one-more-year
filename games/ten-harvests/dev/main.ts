// The real Hall with Ten Harvests playable while it is still marked coming-soon.
// Served by the game's dev server on 4480 (and on 5480 for its end-to-end tests).
//
// Query options (as in the Hall's own test harness):
//   ?now=2026-10-10T09:00:00Z   a fixed clock, for stable screenshots and daily numbers
//   ?theme=terrarium&appearance=dark   a starting look
//   ?memory   storage in memory only
//   ?fresh    a first visit (intro and theme picker)
import '../../../hall/src/styles/fonts.css';
import '../../../hall/src/styles/base.css';
import { bootHall, type HallApp } from '../../../hall/src/app/hall-app.ts';
import { discoverSims } from '../../../hall/src/data/discovered.ts';

const params = new URLSearchParams(window.location.search);
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

const clock = fixedNow ? Date.parse(fixedNow) : null;
const app: HallApp = bootHall({
  root,
  sims: discoverSims(),
  allowUnreleased: true,
  services: {
    ...(memory ? { storage: null } : {}),
    ...(clock !== null ? { now: () => clock } : {}),
  },
});

Object.assign(window, {
  __hall: {
    app,
    view: () => app.stage.view,
    chronicles: () => app.services.library.all(),
    runs: () => app.model.snapshot().continueRuns,
  },
});
