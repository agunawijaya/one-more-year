/**
 * The Year Turns, as a screen: plays the cinematic on the city, with its
 * caption and a skip hint, then hands back. Space or a click skips to the
 * end. Under reduced motion the year is shown as three still moments that
 * cross-fade (the harvest in, the year's events, the year done).
 */
import type { SimAudio } from '@one-more-year/kit';
import {
  createYearCinematic,
  poseAt,
  type CinematicSpeed,
  type YearStory,
} from '../../scene/cinematic.ts';
import type { CityView } from '../../scene/view.ts';
import type { CityWorld } from '../../scene/world.ts';
import { el } from '../../ui/dom.ts';
import { SOUND } from '../sound.ts';

export interface TurningOptions {
  world: CityWorld;
  view: CityView;
  story: YearStory;
  speed: CinematicSpeed;
  reducedMotion: boolean;
  overlay: HTMLElement;
  audio: SimAudio;
  onDone(): void;
}

export interface Turning {
  skip(): void;
  dispose(): void;
}

export function runYear(options: TurningOptions): Turning {
  const { world, view, story, overlay } = options;
  const speed: CinematicSpeed = options.reducedMotion ? 'cinematic' : options.speed;
  const cinematic = createYearCinematic(world, story, speed);
  const caption = el('div', { class: 'th-caption', role: 'status', 'aria-live': 'polite' });
  const hint = el('p', { class: 'th-skip' }, 'Space · skip');
  const fade = el('div', { class: 'th-fade' });
  overlay.append(caption, hint, fade);
  world.show({
    people: story.people,
    grain: story.storeBefore,
    acres: story.acres,
    planted: story.planted,
    season: 0,
    yieldPerAcre: story.yieldPerAcre,
  });

  // Reduced motion: three still moments instead of a moving year.
  const stills = options.reducedMotion
    ? [
        (cinematic.beats.find((b) => b.name === 'harvest')?.start ?? 0) +
          (cinematic.beats.find((b) => b.name === 'harvest')?.length ?? 0),
        Math.max(0, cinematic.duration - (cinematic.beats.at(-1)?.length ?? 0) - 0.01),
        cinematic.duration,
      ]
    : null;
  const stillLength = 1.6;
  const length = stills ? stills.length * stillLength : cinematic.duration;
  const started = performance.now();
  let done = false;
  const played = new Set<string>();

  function timeAt(elapsed: number): number {
    if (!stills) return elapsed;
    return (
      stills[Math.min(stills.length - 1, Math.floor(elapsed / stillLength))] ?? cinematic.duration
    );
  }

  function cue(beat: string): void {
    if (played.has(beat)) return;
    played.add(beat);
    if (beat === 'grow') options.audio.play(SOUND.swell);
    if (beat === 'harvest') options.audio.play(SOUND.grain);
    if (beat === 'rats') options.audio.play(SOUND.feet);
    if (beat === 'newcomers') options.audio.play('harvest-chime');
    if (beat === 'fever') options.audio.play('warning-bell');
  }

  const stop = view.onFrame(() => {
    if (done) return;
    const elapsed = (performance.now() - started) / 1000;
    const t = timeAt(elapsed);
    const shown = cinematic.seek(t);
    view.setPose(poseAt(cinematic.beats, t));
    caption.replaceChildren(el('span', {}, `Year ${story.year}`), el('strong', {}, shown.title));
    if (shown.value) caption.append(el('b', {}, shown.value));
    if (!options.reducedMotion) cue(cinematic.beatAt(t).name);
    if (stills)
      fade.style.opacity = String(
        Math.max(0, 1 - Math.abs((elapsed % stillLength) - stillLength / 2) * 3),
      );
    if (elapsed >= length) finish();
  });

  function finish(): void {
    if (done) return;
    done = true;
    cinematic.seek(cinematic.duration);
    options.onDone();
  }

  if (speed === 'instant') queueMicrotask(finish);

  return {
    skip: finish,
    dispose() {
      done = true;
      stop();
      cinematic.dispose();
      caption.remove();
      hint.remove();
      fade.remove();
    },
  };
}
