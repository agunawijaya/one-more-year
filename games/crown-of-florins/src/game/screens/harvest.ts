/**
 * The first step of a year: the season passes over the fresco.
 *
 * Light sweeps across the painting from dawn to dusk; the fields turn from
 * last year's colour to this year's (lush green in a good year, cracked
 * ochre in a drought); rain or sun is painted in with a few stylised
 * strokes; carts roll in to the granary as the fields are cut; a small band
 * of rats scurries in if they came; the masons' taps ring out if the ruler
 * built last year. Everything shown is the year's real opening.
 *
 * Space, Enter or a click skips it. Under reduced motion it is a short
 * cross-fade with the same captions; at the "instant" speed it is skipped.
 */
import { formatNumber, type Appearance } from '@one-more-year/kit';
import { MathUtils, Vector3 } from 'three';
import type { Realm, World } from '../../engine/state.ts';
import { WEATHER_NAMES } from '../../content/words.ts';
import { el } from '../../ui/dom.ts';
import type { Stage } from '../stage.ts';

export interface HarvestOptions {
  host: HTMLElement;
  stage: Stage;
  world: World;
  realm: Realm;
  appearance: Appearance;
  /** Seconds; 0 skips straight to the end. */
  length: number;
  reducedMotion: boolean;
  sound: { swell(): void; grain(): void; mason(): void; crowd(): void };
  onDone(): void;
}

export interface HarvestRun {
  skip(): void;
  dispose(): void;
}

export function runHarvest(options: HarvestOptions): HarvestRun {
  const { stage, realm } = options;
  const opening = realm.opening;
  const lastBuild = realm.last?.plan.build;
  const masonsWorked =
    lastBuild !== undefined &&
    lastBuild.markets + lastBuild.mills + lastBuild.palace + lastBuild.cathedral > 0;
  stage.attach(options.host);
  stage.paintCity(realm, { frame: 16 });
  const city = stage.city();
  const base = stage.cityPose({ elevation: 0.46, crestAt: 0.86 });
  stage.view.setPose({ ...base, azimuth: base.azimuth - 0.14 });
  if (!options.reducedMotion && options.length > 0) {
    stage.view.setPose({ ...base, azimuth: base.azimuth + 0.1 }, options.length);
  }

  const grade = opening?.weather ?? 3;
  const ground = city.ground.uniforms;
  const fromWeather = realm.last?.opening.weather ?? 3;
  const sun = city.sun;
  const restSun = sun.position.clone();
  const restColour = sun.color.clone();
  const restIntensity = sun.intensity;
  const sweep = city.uniforms.uSweep.value;

  // Painted weather: slanting rain strokes in a poor year, a ring of gold rays in a good one.
  const strokes = el('div', { class: 'cf-weather', 'data-grade': grade, 'aria-hidden': 'true' });
  strokes.innerHTML = weatherStrokes(grade);
  const carts = el('div', { class: 'cf-carts-run', 'aria-hidden': 'true' });
  carts.innerHTML = CARTS_SVG;
  const rats =
    opening && opening.ratPercent >= 10
      ? Object.assign(el('div', { class: 'cf-rats-run', 'aria-hidden': 'true' }), {
          innerHTML: RATS_SVG,
        })
      : null;
  const caption = el('div', { class: 'cf-caption', role: 'status' });
  const skip = el(
    'button',
    { type: 'button', class: 'cf-skip', 'data-action': 'skip' },
    'Skip',
    el('kbd', {}, 'Space'),
  );
  const layer = el('div', { class: 'cf-cinema' }, strokes, carts, rats, caption, skip);
  options.host.append(layer);

  const lines = captions(options.world, realm);
  let shown = -1;
  let done = false;
  // The season's clock runs on painted frames (a frame counts for a tenth of a second at most), so
  // a moment spent compiling the fresco never eats the year the player came to watch.
  let elapsed = 0;
  const length = Math.max(0.001, options.length);
  options.sound.swell();
  // The masons' taps for last year's works, finished over the winter.
  if (masonsWorked) window.setTimeout(() => options.sound.mason(), 1200);

  function frame({ seconds }: { seconds: number }): void {
    if (done) return;
    elapsed += seconds;
    const t = Math.min(1, elapsed / length);
    // Dawn in the east to dusk in the west, rising to noon between.
    const arc = MathUtils.lerp(-1.1, 1.1, t);
    const direction = new Vector3(
      -Math.sin(arc) * 0.9,
      0.35 + Math.cos(arc) * 0.6,
      0.35,
    ).normalize();
    sun.position.copy(direction.multiplyScalar(300));
    // Low sun is warmer: blue and green fall away toward dawn and dusk.
    const warm = 1 - Math.cos(arc);
    sun.color.setRGB(
      restColour.r,
      restColour.g * (1 - warm * 0.12),
      restColour.b * (1 - warm * 0.3),
    );
    sun.intensity = restIntensity * (0.75 + 0.35 * Math.cos(arc));
    sweep.set(MathUtils.lerp(-140, 140, t), 0, 0, Math.sin(t * Math.PI) * 0.9);
    ground.uWeather.value = MathUtils.lerp(fromWeather, grade, Math.min(1, t / 0.4));
    ground.uHarvest.value = MathUtils.clamp((t - 0.42) / 0.4, 0, 1);
    ground.uRain.value = grade <= 2 ? Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.8 : 0;
    layer.style.setProperty('--t', t.toFixed(3));
    const line = Math.min(lines.length - 1, Math.floor(t * lines.length));
    if (line !== shown) {
      shown = line;
      caption.replaceChildren(...(lines[line] ?? []));
      if (line === 1) options.sound.grain();
    }
    if (t >= 1) finish();
  }

  function finish(): void {
    if (done) return;
    done = true;
    cancelAnimationFrame(listen);
    options.host.removeEventListener('click', finish);
    stop();
    sun.position.copy(restSun);
    sun.color.copy(restColour);
    sun.intensity = restIntensity;
    sweep.set(0, 0, 0, 0);
    ground.uWeather.value = grade;
    ground.uHarvest.value = 0;
    ground.uRain.value = 0;
    layer.remove();
    options.onDone();
  }

  const stop = stage.view.onFrame(frame);
  if (options.length <= 0) queueMicrotask(finish);
  skip.addEventListener('click', finish);
  // Listen for a click only from the next frame: the click that opened the season is still
  // bubbling and must not end it at once.
  const listen = requestAnimationFrame(() =>
    options.host.addEventListener('click', finish, { once: true }),
  );

  return {
    skip: finish,
    dispose() {
      if (!done) {
        done = true;
        cancelAnimationFrame(listen);
        options.host.removeEventListener('click', finish);
        stop();
        sun.position.copy(restSun);
        sun.color.copy(restColour);
        sun.intensity = restIntensity;
        sweep.set(0, 0, 0, 0);
        ground.uHarvest.value = 0;
        ground.uRain.value = 0;
        layer.remove();
      }
    },
  };
}

function captions(world: World, realm: Realm): Node[][] {
  const opening = realm.opening;
  if (!opening) return [[el('strong', {}, `Anno ${world.year}`)]];
  const weather = WEATHER_NAMES[opening.weather - 1] ?? 'A fair year';
  const lines: Node[][] = [
    [
      el('span', { class: 'cf-caption__eyebrow' }, `Anno ${world.year} · ${realm.city}`),
      el('strong', {}, weather),
    ],
    [
      el(
        'span',
        { class: 'cf-caption__eyebrow' },
        `${formatNumber(opening.worked)} hectares worked`,
      ),
      el('strong', {}, `${formatNumber(opening.harvest)} bushels to the granary`),
    ],
  ];
  if (opening.ratsAte > 0) {
    lines.push([
      el('span', { class: 'cf-caption__eyebrow' }, 'In the granary'),
      el('strong', {}, `Rats ate ${opening.ratPercent}%: ${formatNumber(opening.ratsAte)} bushels`),
    ]);
  }
  lines.push([
    el('span', { class: 'cf-caption__eyebrow' }, 'The year ahead'),
    el('strong', {}, `The people need ${formatNumber(opening.demand)} bushels`),
  ]);
  return lines;
}

function weatherStrokes(grade: number): string {
  if (grade <= 2) {
    const strokes = Array.from({ length: 46 }, (_, i) => {
      const x = (i * 97) % 1000;
      const y = (i * 53) % 420;
      return `<path d="M${x} ${y}l-26 64" />`;
    }).join('');
    return `<svg viewBox="0 0 1000 600" preserveAspectRatio="none"><g class="cf-weather__rain">${strokes}</g></svg>`;
  }
  if (grade >= 4) {
    const rays = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const x1 = 820 + Math.cos(a) * 46;
      const y1 = 90 + Math.sin(a) * 46;
      const x2 = 820 + Math.cos(a) * (grade === 5 ? 110 : 84);
      const y2 = 90 + Math.sin(a) * (grade === 5 ? 110 : 84);
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"><g class="cf-weather__sun"><circle cx="820" cy="90" r="34"/>${rays}</g></svg>`;
  }
  return '';
}

const CARTS_SVG =
  '<svg viewBox="0 0 120 40" width="120" height="40"><g fill="#c99a4e" stroke="#3a2614" stroke-width="1.5" stroke-linejoin="round"><path d="M6 20h38l-4 10H10z"/><path d="M10 20c4-8 26-8 30 0" fill="#e2c37a"/><circle cx="16" cy="32" r="5" fill="#6b4a2a"/><circle cx="36" cy="32" r="5" fill="#6b4a2a"/><path d="M44 24h10"/><path d="M66 20h38l-4 10H70z"/><path d="M70 20c4-8 26-8 30 0" fill="#e2c37a"/><circle cx="76" cy="32" r="5" fill="#6b4a2a"/><circle cx="96" cy="32" r="5" fill="#6b4a2a"/><path d="M104 24h10"/></g></svg>';

const RATS_SVG =
  '<svg viewBox="0 0 120 24" width="120" height="24"><g fill="#4a3a30" stroke="#1e1612" stroke-width="1"><ellipse cx="14" cy="14" rx="9" ry="5"/><circle cx="5" cy="12" r="3.5"/><path d="M23 15c6 0 8-4 10-6" fill="none"/><ellipse cx="54" cy="15" rx="8" ry="4.5"/><circle cx="46" cy="13" r="3"/><path d="M62 16c5 0 7-3 9-5" fill="none"/><ellipse cx="92" cy="14" rx="9" ry="5"/><circle cx="83" cy="12" r="3.5"/><path d="M101 15c6 0 8-4 10-6" fill="none"/></g></svg>';
