/**
 * The Year Turns: the cinematic between "End the year" and the report.
 *
 * A year passes in one breath, in the engine's order: the flood spreads and
 * recedes, seed is thrown, the wheat grows from bare earth to gold, the
 * harvest sweeps the fields and flows as a river of grain into the rising
 * granary, rats come (if they did), newcomers walk in along the river road,
 * and a fever haze drifts through the lanes (if it came). Hungry households'
 * lamps go out quietly.
 *
 * Everything is a pure function of the time `t`, so the cinematic can be
 * played, skipped, scrubbed and screenshotted at any moment. The numbers it
 * shows are the year's own (the YearStory comes from the engine).
 */
import type { CameraPose } from './view.ts';
import type { CityWorld } from './world.ts';
import type { Parcel } from './layout.ts';
import { feverHaze, grainRiver, ratSwarm, seedArcs, type ParticleSystem } from './particles.ts';
import { acresOf, bushelsOf } from '../content/counts.ts';

export type CinematicSpeed = 'cinematic' | 'quick' | 'instant';

/** What the year did, in the numbers the cinematic shows. */
export interface YearStory {
  year: number;
  /** People at the start of the year. */
  people: number;
  /** Grain in store after land, food and seed were taken. */
  storeBefore: number;
  acres: number;
  planted: number;
  yieldPerAcre: number;
  harvest: number;
  ratsAte: number;
  newcomers: number;
  hungry: number;
  feverLost: number;
  /** People and grain when the year is over. */
  peopleAfter: number;
  storeAfter: number;
}

export type BeatName =
  'flood' | 'seed' | 'grow' | 'harvest' | 'rats' | 'newcomers' | 'fever' | 'settle';

export interface Beat {
  name: BeatName;
  start: number;
  length: number;
  pose: CameraPose;
}

export interface Caption {
  beat: BeatName;
  title: string;
  value: string;
}

export interface YearCinematic {
  readonly duration: number;
  readonly beats: readonly Beat[];
  /** Shows the year at time t (seconds); the caption says what is happening. */
  seek(t: number): Caption;
  beatAt(t: number): Beat;
  dispose(): void;
}

const POSES: Readonly<Record<BeatName, CameraPose>> = {
  flood: { target: { x: -22, y: 0, z: 10 }, azimuth: 0.18, elevation: 0.24, distance: 82, fov: 38 },
  seed: { target: { x: -16, y: 0, z: 12 }, azimuth: 0.32, elevation: 0.2, distance: 64, fov: 38 },
  grow: { target: { x: -12, y: 0, z: 10 }, azimuth: 0.52, elevation: 0.14, distance: 46, fov: 40 },
  harvest: {
    target: { x: -26, y: 3, z: -14 },
    azimuth: 0.7,
    elevation: 0.3,
    distance: 56,
    fov: 38,
  },
  rats: { target: { x: -31, y: 3, z: -21 }, azimuth: 0.62, elevation: 0.36, distance: 36, fov: 36 },
  newcomers: {
    target: { x: 66, y: 0, z: -40 },
    azimuth: 1.15,
    elevation: 0.24,
    distance: 84,
    fov: 36,
  },
  fever: { target: { x: 8, y: 0, z: -34 }, azimuth: 0.3, elevation: 0.42, distance: 74, fov: 36 },
  settle: { target: { x: -8, y: 0, z: -2 }, azimuth: 0.35, elevation: 0.5, distance: 118, fov: 34 },
};

/** Seconds per beat at cinematic speed. */
const LENGTHS: Readonly<Record<BeatName, number>> = {
  flood: 1.5,
  seed: 1.2,
  grow: 2.4,
  harvest: 2.8,
  rats: 2.0,
  newcomers: 1.7,
  fever: 1.5,
  settle: 0.8,
};

export function beatsFor(story: YearStory, speed: CinematicSpeed): Beat[] {
  const names: BeatName[] = ['flood', 'seed', 'grow', 'harvest'];
  if (story.ratsAte > 0) names.push('rats');
  if (story.newcomers > 0) names.push('newcomers');
  if (story.feverLost > 0) names.push('fever');
  names.push('settle');
  const total = names.reduce((sum, name) => sum + LENGTHS[name], 0);
  const scale = speed === 'quick' ? 3 / total : speed === 'instant' ? 0 : 1;
  let start = 0;
  return names.map((name) => {
    const beat = { name, start, length: LENGTHS[name] * scale, pose: POSES[name] };
    start += beat.length;
    return beat;
  });
}

const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

export function createYearCinematic(
  world: CityWorld,
  story: YearStory,
  speed: CinematicSpeed,
): YearCinematic {
  const beats = beatsFor(story, speed);
  const duration = beats.reduce((end, beat) => Math.max(end, beat.start + beat.length), 0);
  const find = (name: BeatName): Beat | undefined => beats.find((beat) => beat.name === name);
  const local = (name: BeatName, t: number): number => {
    const beat = find(name);
    if (!beat || beat.length === 0) return t >= (beat?.start ?? 0) ? 1 : 0;
    return Math.max(0, Math.min(1, (t - beat.start) / beat.length));
  };

  const planted: Parcel[] = world.planted();
  const quality = story.yieldPerAcre / 6;
  const harvestBeat = find('harvest');
  // The reapers start in the far fields and work toward the viewer, so standing gold
  // stays in front of the camera while the grain already streams to the granary.
  const granary = world.layout.granary;
  const sweepKey = (p: Parcel): number => p.x * 0.62 + p.z * 0.78;
  const keys = planted.map(sweepKey);
  const first = Math.min(...keys, 0);
  const span = Math.max(1, Math.max(...keys, 1) - first);
  const sweepShare = 0.95;
  const cutAt = (p: Parcel): number =>
    (harvestBeat?.start ?? 0) +
    ((sweepKey(p) - first) / span) * (harvestBeat?.length ?? 0) * sweepShare;

  const systems: ParticleSystem[] = [];
  const perParcel = Math.max(6, Math.min(120, Math.round(24000 / Math.max(1, planted.length))));
  // The streams meet out on the field road and rise from there in one long arc to the chute.
  // Between the reaped fields (west) and the granary's door: the arc then crosses the view.
  const confluence = { x: granary.x - 4, y: 0.6, z: granary.z + granary.depth * 0.5 + 15 };
  const grain = grainRiver(
    planted,
    cutAt,
    confluence,
    world.granary.chute,
    world.palette.grain,
    Math.max(2, Math.round(perParcel * (0.35 + quality))),
    world.palette.appearance === 'dark' ? 0.45 : 1,
  );
  const seed = seedArcs(
    planted,
    world.palette.grain,
    6,
    Math.max(0.01, (find('seed')?.length ?? 1) * 0.7),
  );
  const ratCount = Math.min(70, 12 + Math.round(story.ratsAte / 60));
  const rats = ratSwarm(
    granary,
    ratCount,
    world.palette.appearance === 'dark'
      ? world.palette.foam.clone().multiplyScalar(0.6)
      : world.palette.palmTrunk.clone().multiplyScalar(0.55),
  );
  const haze = feverHaze(
    world.layout.cityCentre,
    { x: 30, z: 15 },
    world.palette.appearance === 'dark'
      ? world.palette.lapis.clone().lerp(world.palette.foam, 0.3)
      : world.palette.lapis.clone().lerp(world.palette.foam, 0.6),
  );
  for (const system of [grain, seed, rats, haze]) {
    systems.push(system);
    world.scene.add(system.points);
  }

  function seek(t: number): Caption {
    const time = Math.max(0, Math.min(duration, t));
    const flood = local('flood', time);
    world.water.setFlood(Math.sin(flood * Math.PI) * 0.95);

    // Fields: bare until the seed falls, then green, then gold; cut as the sweep passes.
    const grow = smooth(local('grow', time));
    const sown = local('seed', time) > 0 ? 0.02 : 0;
    for (const parcel of planted) {
      const cut = time >= cutAt(parcel) ? Math.min(1, (time - cutAt(parcel)) / 0.45) : 0;
      const season = cut > 0 ? 1 + cut : Math.max(sown, grow);
      world.fields.set(parcel.index, 1, 1, season, quality);
    }

    seed.setTime(time - (find('seed')?.start ?? 0));
    seed.setStrength(local('seed', time) > 0 && local('seed', time) < 1 ? 1 : 0);
    grain.setTime(time);
    const harvested = local('harvest', time);
    grain.setStrength(
      harvested > 0 && time < (harvestBeat ? harvestBeat.start + harvestBeat.length * 1.25 : 0)
        ? 1
        : 0,
    );

    // The store: in comes the harvest as the river arrives, out goes what the rats take.
    const arrived = smooth((harvested - 0.12) / 0.88);
    const ratShare = smooth(local('rats', time));
    const store = story.storeBefore + story.harvest * arrived - story.ratsAte * ratShare;
    world.granary.setStore(store, harvested > 0 && harvested < 1 ? 0.6 : 0);
    rats.setTime(time - (find('rats')?.start ?? 0));
    rats.setStrength(ratShare > 0 && ratShare < 1 ? 1 : 0);

    const walking = local('newcomers', time);
    world.figures.setProcession(story.newcomers, walking > 0 ? 0.15 + walking * 0.95 : 0);

    // Hungry households' lamps go out at the end of the harvest; fever thins the lanes.
    const fever = local('fever', time);
    haze.setTime(time);
    haze.setStrength(Math.sin(fever * Math.PI));
    const hungryShare = story.people > 0 ? story.hungry / story.people : 0;
    const feverShare =
      story.people > 0
        ? story.feverLost / Math.max(1, story.people - story.hungry + story.newcomers)
        : 0;
    world.city.setDimmed(
      Math.min(1, hungryShare * smooth((harvested - 0.8) / 0.2) + feverShare * smooth(fever)),
    );
    world.figures.setThinned(feverShare * smooth(fever));
    world.fields.commit();

    return captionAt(time, store);
  }

  function captionAt(time: number, store: number): Caption {
    const beat = beatOf(time);
    const value = Math.round(store).toLocaleString('en');
    switch (beat.name) {
      case 'flood':
        return { beat: beat.name, title: 'The river rises over the fields', value: '' };
      case 'seed':
        return {
          beat: beat.name,
          title: `${acresOf(story.planted)} sown`,
          value: '',
        };
      case 'grow':
        return { beat: beat.name, title: 'The wheat grows', value: '' };
      case 'harvest':
        return {
          beat: beat.name,
          title: `A harvest of ${bushelsOf(story.yieldPerAcre)} an acre`,
          value: `${value} in store`,
        };
      case 'rats':
        return {
          beat: beat.name,
          title: `Rats in the granary: ${story.ratsAte.toLocaleString('en')} bushels gone`,
          value: `${value} in store`,
        };
      case 'newcomers':
        return { beat: beat.name, title: `${story.newcomers} newcomers walk in`, value: '' };
      case 'fever':
        return { beat: beat.name, title: `A fever passes: ${story.feverLost} lost`, value: '' };
      case 'settle':
        return { beat: beat.name, title: `Year ${story.year} is done`, value: `${value} in store` };
    }
  }

  function beatOf(time: number): Beat {
    return beats.findLast((beat) => time >= beat.start) ?? (beats[0] as Beat);
  }

  return {
    duration,
    beats,
    seek,
    beatAt: beatOf,
    dispose() {
      for (const system of systems) {
        world.scene.remove(system.points);
        system.dispose();
      }
      world.water.setFlood(0);
      world.figures.setProcession(0, 0);
      world.figures.setThinned(0);
    },
  };
}

/** The camera at time t: each beat glides from the previous beat's view during its first half. */
export function poseAt(beats: readonly Beat[], t: number): CameraPose {
  const index = Math.max(
    0,
    beats.findLastIndex((beat) => t >= beat.start),
  );
  const beat = beats[index] as Beat;
  const previous = beats[index - 1]?.pose ?? beat.pose;
  const k = smooth(beat.length > 0 ? (t - beat.start) / (beat.length * 0.55) : 1);
  const lerp = (a: number, b: number): number => a + (b - a) * k;
  return {
    target: {
      x: lerp(previous.target.x, beat.pose.target.x),
      y: lerp(previous.target.y, beat.pose.target.y),
      z: lerp(previous.target.z, beat.pose.target.z),
    },
    azimuth: lerp(previous.azimuth, beat.pose.azimuth),
    elevation: lerp(previous.elevation, beat.pose.elevation),
    distance: lerp(previous.distance, beat.pose.distance),
    fov: lerp(previous.fov, beat.pose.fov),
  };
}
