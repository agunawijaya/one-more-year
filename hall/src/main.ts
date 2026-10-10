// The website's entry point: styles, the Hall, and the offline worker.
import './styles/fonts.css';
import './styles/base.css';
import { bootHall } from './app/hall-app.ts';
import { discoverSims } from './data/discovered.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing from index.html');

bootHall({ root, sims: discoverSims() });

// The worker precaches the whole build, so the Hall works offline after one visit.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
