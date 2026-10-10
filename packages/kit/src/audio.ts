/**
 * Sound, synthesised with WebAudio. There are no audio files anywhere in the
 * collection: every cue is a few oscillators, filtered noise and envelopes.
 *
 * Simulations are slow and thoughtful, so the palette is calm: a page turn,
 * a seal pressed into wax, a coin, a harvest chime, a distant warning bell.
 * Ambience beds are soft filtered noise with an optional low drone, defined
 * per simulation (wind over fields, water lapping, a quiet room).
 *
 * Browsers start audio suspended until the player interacts with the page;
 * `unlockOnFirstGesture` resumes it on the first click or key. Where WebAudio
 * is missing (tests, some embedded browsers) every call quietly does nothing.
 */
import type { Volumes } from './settings.ts';

export type CueName =
  | 'page-turn'
  | 'seal-stamp'
  | 'coin'
  | 'harvest-chime'
  | 'warning-bell'
  | 'select'
  | 'discovery'
  | 'milestone';

/** Draws one cue into `out`, starting at `at` (AudioContext time). */
export type CueRecipe = (context: AudioContext, out: AudioNode, at: number) => void;

export interface AmbienceBed {
  noise?: 'pink' | 'brown';
  /** Low-pass cutoff in Hz; lower is softer and further away. */
  cutoff?: number;
  /** 0–1, before the music volume. */
  gain?: number;
  /** Frequencies of a soft sustained drone, if any. */
  drone?: readonly number[];
  droneGain?: number;
  /** Seconds per slow swell of the bed's loudness (0 = steady). */
  swell?: number;
}

export type AudioState = 'locked' | 'running' | 'unavailable';

export interface AudioEngine {
  readonly state: AudioState;
  play(cue: CueName | (string & {})): void;
  define(name: string, recipe: CueRecipe): void;
  setAmbience(bed: AmbienceBed | null): void;
  setVolumes(volumes: Volumes, muted: boolean): void;
  unlock(): Promise<void>;
  dispose(): void;
}

type AudioContextConstructor = new () => AudioContext;

export function createAudio(
  // Read loosely: the DOM types promise AudioContext, but tests and some browsers lack it.
  Context = (globalThis as { AudioContext?: AudioContextConstructor }).AudioContext,
): AudioEngine {
  if (!Context) return silentAudio();
  const AudioContextClass: AudioContextConstructor = Context;

  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let bedNodes: AudioNode[] = [];
  let bedSources: AudioScheduledSourceNode[] = [];
  let pendingBed: AmbienceBed | null = null;
  let levels = { volumes: { master: 0.8, music: 0.5, sfx: 0.8 }, muted: false };
  const recipes = new Map<string, CueRecipe>(Object.entries(CUES));

  function ensure(): AudioContext {
    if (context) return context;
    context = new AudioContextClass();
    master = context.createGain();
    sfx = context.createGain();
    music = context.createGain();
    sfx.connect(master);
    music.connect(master);
    master.connect(context.destination);
    applyLevels();
    return context;
  }

  function applyLevels(): void {
    if (!context || !master || !sfx || !music) return;
    const now = context.currentTime;
    master.gain.setTargetAtTime(levels.muted ? 0 : levels.volumes.master, now, 0.05);
    sfx.gain.setTargetAtTime(levels.volumes.sfx, now, 0.05);
    music.gain.setTargetAtTime(levels.volumes.music, now, 0.05);
  }

  function stopBed(): void {
    const now = context?.currentTime ?? 0;
    for (const source of bedSources) {
      try {
        source.stop(now + 0.6);
      } catch {
        // Already stopped.
      }
    }
    const fading = bedNodes;
    setTimeout(() => {
      for (const node of fading) node.disconnect();
    }, 800);
    bedNodes = [];
    bedSources = [];
  }

  function startBed(bed: AmbienceBed): void {
    if (!context || !music) return;
    const now = context.currentTime;
    const out = context.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(bed.gain ?? 0.25, now + 2.5);
    out.connect(music);
    bedNodes.push(out);

    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer(context, bed.noise ?? 'brown');
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = bed.cutoff ?? 600;
    noise.connect(filter).connect(out);
    noise.start(now);
    bedSources.push(noise);
    bedNodes.push(filter);

    if (bed.swell && bed.swell > 0) {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = 1 / bed.swell;
      depth.gain.value = (bed.gain ?? 0.25) * 0.35;
      lfo.connect(depth).connect(out.gain);
      lfo.start(now);
      bedSources.push(lfo);
      bedNodes.push(depth);
    }

    for (const frequency of bed.drone ?? []) {
      const tone = context.createOscillator();
      const level = context.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      level.gain.value = bed.droneGain ?? 0.04;
      tone.connect(level).connect(out);
      tone.start(now);
      bedSources.push(tone);
      bedNodes.push(level);
    }
  }

  return {
    get state(): AudioState {
      if (!context) return 'locked';
      return context.state === 'running' ? 'running' : 'locked';
    },

    play(cue) {
      if (context?.state !== 'running' || !sfx || levels.muted) return;
      recipes.get(cue)?.(context, sfx, context.currentTime + 0.01);
    },

    define(name, recipe) {
      recipes.set(name, recipe);
    },

    setAmbience(bed) {
      pendingBed = bed;
      if (context?.state !== 'running') return;
      stopBed();
      if (bed) startBed(bed);
    },

    setVolumes(volumes, muted) {
      levels = { volumes: { ...volumes }, muted };
      applyLevels();
    },

    async unlock() {
      const ready = ensure();
      if (ready.state !== 'running') await ready.resume();
      if (pendingBed && bedSources.length === 0) startBed(pendingBed);
    },

    dispose() {
      stopBed();
      void context?.close();
      context = null;
    },
  };
}

function silentAudio(): AudioEngine {
  return {
    state: 'unavailable',
    play: () => undefined,
    define: () => undefined,
    setAmbience: () => undefined,
    setVolumes: () => undefined,
    unlock: () => Promise.resolve(),
    dispose: () => undefined,
  };
}

/** Resumes audio on the first click, tap or key press; returns a remover. */
export function unlockOnFirstGesture(audio: AudioEngine, target: EventTarget = window): () => void {
  const unlock = (): void => {
    void audio.unlock();
    remove();
  };
  const remove = (): void => {
    target.removeEventListener('pointerdown', unlock);
    target.removeEventListener('keydown', unlock);
  };
  target.addEventListener('pointerdown', unlock);
  target.addEventListener('keydown', unlock);
  return remove;
}

// ---- building blocks -------------------------------------------------------------

const noiseCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();

function noiseBuffer(context: AudioContext, colour: 'pink' | 'brown' | 'white'): AudioBuffer {
  const cache = noiseCache.get(context) ?? new Map<string, AudioBuffer>();
  noiseCache.set(context, cache);
  const cached = cache.get(colour);
  if (cached) return cached;
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Sound needs no seed: it never affects a world, so Math.random is fine here.
  let last = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (colour === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else if (colour === 'pink') {
      // Paul Kellet's economy pink filter.
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else {
      data[i] = white;
    }
  }
  cache.set(colour, buffer);
  return buffer;
}

function envelope(
  context: AudioContext,
  out: AudioNode,
  at: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  gain.connect(out);
  return gain;
}

function tone(
  context: AudioContext,
  out: AudioNode,
  at: number,
  frequency: number,
  options: {
    type?: OscillatorType;
    peak?: number;
    attack?: number;
    decay?: number;
    glideTo?: number;
  } = {},
): void {
  const osc = context.createOscillator();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(frequency, at);
  if (options.glideTo)
    osc.frequency.exponentialRampToValueAtTime(options.glideTo, at + (options.decay ?? 0.3));
  const attack = options.attack ?? 0.01;
  const decay = options.decay ?? 0.3;
  osc.connect(envelope(context, out, at, options.peak ?? 0.2, attack, decay));
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
}

/** A struck bell: a fundamental plus the slightly inharmonic partials that make it ring. */
function bell(
  context: AudioContext,
  out: AudioNode,
  at: number,
  frequency: number,
  peak: number,
  decay: number,
): void {
  for (const [ratio, level] of [
    [1, 1],
    [2.76, 0.32],
    [5.4, 0.12],
  ] as const) {
    tone(context, out, at, frequency * ratio, {
      peak: peak * level,
      attack: 0.005,
      decay: decay / ratio ** 0.5,
    });
  }
}

function noiseBurst(
  context: AudioContext,
  out: AudioNode,
  at: number,
  options: { duration: number; from: number; to: number; peak: number; type?: BiquadFilterType },
): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, 'white');
  const filter = context.createBiquadFilter();
  filter.type = options.type ?? 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(options.from, at);
  filter.frequency.exponentialRampToValueAtTime(options.to, at + options.duration);
  source.connect(filter).connect(envelope(context, out, at, options.peak, 0.02, options.duration));
  source.start(at);
  source.stop(at + options.duration + 0.1);
}

const CUES: Record<CueName, CueRecipe> = {
  'page-turn': (context, out, at) => {
    noiseBurst(context, out, at, { duration: 0.22, from: 2400, to: 900, peak: 0.12 });
    noiseBurst(context, out, at + 0.09, { duration: 0.16, from: 1400, to: 4200, peak: 0.06 });
  },
  'seal-stamp': (context, out, at) => {
    tone(context, out, at, 110, { glideTo: 48, peak: 0.45, attack: 0.004, decay: 0.28 });
    noiseBurst(context, out, at, {
      duration: 0.06,
      from: 900,
      to: 300,
      peak: 0.12,
      type: 'lowpass',
    });
  },
  coin: (context, out, at) => {
    bell(context, out, at, 1568, 0.08, 0.35);
    bell(context, out, at + 0.07, 2093, 0.06, 0.45);
  },
  'harvest-chime': (context, out, at) => {
    [523.25, 659.25, 783.99].forEach((frequency, index) =>
      bell(context, out, at + index * 0.11, frequency, 0.07, 1.2),
    );
  },
  'warning-bell': (context, out, at) => {
    bell(context, out, at, 220, 0.12, 1.8);
    bell(context, out, at + 0.55, 220, 0.08, 1.6);
  },
  select: (context, out, at) => {
    tone(context, out, at, 880, { type: 'triangle', peak: 0.05, attack: 0.003, decay: 0.06 });
  },
  discovery: (context, out, at) => {
    bell(context, out, at, 659.25, 0.06, 0.8);
    bell(context, out, at + 0.14, 987.77, 0.06, 1.1);
  },
  milestone: (context, out, at) => {
    for (const frequency of [392, 493.88, 587.33]) {
      tone(context, out, at, frequency, { type: 'triangle', peak: 0.05, attack: 0.04, decay: 1.4 });
    }
  },
};

export const CUE_NAMES = Object.keys(CUES) as CueName[];
