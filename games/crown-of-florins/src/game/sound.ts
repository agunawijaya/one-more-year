/**
 * Crown of Florins' sounds, synthesised with the kit's audio engine: no
 * audio files. A plucked, lute-like motif for each step of the year; bells
 * for promotions and for deaths; the murmur of a crowd, louder in a bigger
 * city; masons' taps; a war drum for an army on the road; quills
 * scratching; and a soft choir for the coronation. Everything is quiet and
 * sits under the interface.
 *
 * The ambience is a warm, low room: brown noise like a distant square, and
 * a faint open fifth.
 */
import type { AmbienceBed, CueRecipe, SimAudio } from '@one-more-year/kit';

export const PIAZZA: AmbienceBed = {
  noise: 'brown',
  cutoff: 420,
  gain: 0.12,
  swell: 14,
  drone: [98, 147],
  droneGain: 0.018,
};

/** A fixed pseudo-random sequence: the same texture every time, no Math.random. */
function noiseBuffer(context: AudioContext, seconds: number, seed = 1234567): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.max(1, Math.floor(context.sampleRate * seconds)),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let state = seed;
  for (let i = 0; i < data.length; i++) {
    state = (state * 1103515245 + 12345) >>> 0;
    data[i] = (state / 4294967296) * 2 - 1;
  }
  return buffer;
}

/**
 * A plucked string, after the Karplus–Strong idea: a short burst of noise
 * through a resonant comb, which rings at the note and dies away like gut.
 */
function pluck(
  context: AudioContext,
  out: AudioNode,
  at: number,
  frequency: number,
  peak = 0.1,
): void {
  const burst = context.createBufferSource();
  burst.buffer = noiseBuffer(context, 0.02, Math.round(frequency * 97));
  const delay = context.createDelay(0.05);
  delay.delayTime.value = 1 / frequency;
  const feedback = context.createGain();
  feedback.gain.value = 0.94;
  const damp = context.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = Math.min(6000, frequency * 6);
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  burst.connect(delay);
  delay.connect(damp).connect(feedback).connect(delay);
  delay.connect(gain).connect(out);
  burst.start(at);
  burst.stop(at + 0.03);
  // Let the comb ring out, then cut it so nothing feeds back forever.
  window.setTimeout(
    () => {
      feedback.gain.value = 0;
      burst.disconnect();
    },
    (at - context.currentTime + 1.6) * 1000,
  );
}

/** Five short motifs in D dorian, one per step of the year. */
const STEP_MOTIFS: readonly (readonly number[])[] = [
  [293.66, 349.23, 440],
  [293.66, 392, 440, 523.25],
  [349.23, 440, 523.25],
  [392, 349.23, 293.66],
  [440, 523.25, 587.33, 523.25],
];

function motif(notes: readonly number[]): CueRecipe {
  return (context, out, at) => {
    notes.forEach((note, i) => pluck(context, out, at + i * 0.13, note, 0.08));
  };
}

/** A bell: a few inharmonic partials, struck and left to ring. */
function bell(fundamental: number, peak: number, length: number): CueRecipe {
  return (context, out, at) => {
    for (const [ratio, level] of [
      [0.5, 0.5],
      [1, 1],
      [1.19, 0.45],
      [1.56, 0.35],
      [2, 0.3],
      [2.74, 0.18],
    ] as const) {
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(fundamental * ratio, at);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak * level, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length * (1.2 - ratio * 0.15));
      tone.connect(gain).connect(out);
      tone.start(at);
      tone.stop(at + length + 0.1);
    }
  };
}

const promotionBells: CueRecipe = (context, out, at) => {
  bell(523.25, 0.06, 2.6)(context, out, at);
  bell(659.25, 0.05, 2.4)(context, out, at + 0.32);
  bell(783.99, 0.05, 2.8)(context, out, at + 0.64);
};

/** One low bell, struck three times, for a death. */
const passingBell: CueRecipe = (context, out, at) => {
  for (let i = 0; i < 3; i++) bell(196, 0.07, 4)(context, out, at + i * 1.8);
};

const coronationBells: CueRecipe = (context, out, at) => {
  const peal = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
  for (let round = 0; round < 3; round++) {
    peal.forEach((note, i) => bell(note, 0.035, 2)(context, out, at + round * 1.6 + i * 0.2));
  }
};

const masonTap: CueRecipe = (context, out, at) => {
  for (let i = 0; i < 3; i++) {
    const t = at + i * 0.22;
    const ring = context.createOscillator();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(2100 - i * 140, t);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    ring.connect(gain).connect(out);
    ring.start(t);
    ring.stop(t + 0.1);
  }
};

const warDrum: CueRecipe = (context, out, at) => {
  for (const [offset, peak] of [
    [0, 0.22],
    [0.42, 0.14],
    [0.62, 0.18],
    [1.2, 0.22],
  ] as const) {
    const t = at + offset;
    const skin = context.createOscillator();
    skin.type = 'sine';
    skin.frequency.setValueAtTime(110, t);
    skin.frequency.exponentialRampToValueAtTime(48, t + 0.3);
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    skin.connect(gain).connect(out);
    skin.start(t);
    skin.stop(t + 0.5);
  }
};

const quill: CueRecipe = (context, out, at) => {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, 0.5, 777);
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(3800, at);
  band.frequency.linearRampToValueAtTime(5200, at + 0.4);
  band.Q.value = 2.5;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.035, at + 0.06);
  gain.gain.linearRampToValueAtTime(0.02, at + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
  source.connect(band).connect(gain).connect(out);
  source.start(at);
};

/** A soft choir: open voicings on slow sawtooth voices through a warm filter. */
const choir: CueRecipe = (context, out, at) => {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.4;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.07, at + 2.5);
  gain.gain.setValueAtTime(0.07, at + 7);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 10);
  filter.connect(gain).connect(out);
  const chords = [
    [146.83, 220, 293.66, 369.99],
    [130.81, 196, 261.63, 329.63],
    [146.83, 220, 293.66, 440],
  ];
  chords.forEach((chord, c) => {
    for (const note of chord) {
      for (const detune of [-7, 6]) {
        const voice = context.createOscillator();
        voice.type = 'sawtooth';
        voice.frequency.setValueAtTime(note, at + c * 3.3);
        voice.detune.setValueAtTime(detune, at);
        const level = context.createGain();
        level.gain.setValueAtTime(0.0001, at + c * 3.3);
        level.gain.exponentialRampToValueAtTime(0.25, at + c * 3.3 + 1);
        level.gain.exponentialRampToValueAtTime(0.0001, at + c * 3.3 + 3.6);
        voice.connect(level).connect(filter);
        voice.start(at + c * 3.3);
        voice.stop(at + c * 3.3 + 3.7);
      }
    }
  });
};

/** The crowd's murmur, a breath of band-passed noise; louder for a bigger city. */
function murmur(peak: number): CueRecipe {
  return (context, out, at) => {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, 3, 4242);
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 0.9;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.9);
    source.connect(band).connect(gain).connect(out);
    source.start(at);
  };
}

const grainPour: CueRecipe = (context, out, at) => {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, 0.9, 99);
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(2200, at);
  band.frequency.linearRampToValueAtTime(1200, at + 0.8);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.08, at + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.85);
  source.connect(band).connect(gain).connect(out);
  source.start(at);
};

/** A dull knock for a drop that is not allowed. */
const refuse: CueRecipe = (context, out, at) => {
  const knock = context.createOscillator();
  knock.type = 'sine';
  knock.frequency.setValueAtTime(180, at);
  knock.frequency.exponentialRampToValueAtTime(120, at + 0.12);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.09, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  knock.connect(gain).connect(out);
  knock.start(at);
  knock.stop(at + 0.18);
};

export const SOUND = {
  step: (index: number): string => `cf-step-${index}`,
  promotion: 'cf-promotion',
  passing: 'cf-passing',
  coronation: 'cf-coronation',
  choir: 'cf-choir',
  mason: 'cf-mason',
  drum: 'cf-drum',
  quill: 'cf-quill',
  crowdSmall: 'cf-crowd-small',
  crowdLarge: 'cf-crowd-large',
  grain: 'cf-grain',
  refuse: 'cf-refuse',
} as const;

export function defineSounds(audio: SimAudio): void {
  STEP_MOTIFS.forEach((notes, i) => audio.define(SOUND.step(i + 1), motif(notes)));
  audio.define(SOUND.promotion, promotionBells);
  audio.define(SOUND.passing, passingBell);
  audio.define(SOUND.coronation, coronationBells);
  audio.define(SOUND.choir, choir);
  audio.define(SOUND.mason, masonTap);
  audio.define(SOUND.drum, warDrum);
  audio.define(SOUND.quill, quill);
  audio.define(SOUND.crowdSmall, murmur(0.05));
  audio.define(SOUND.crowdLarge, murmur(0.11));
  audio.define(SOUND.grain, grainPour);
  audio.define(SOUND.refuse, refuse);
}

/** The crowd cue that fits a population. */
export function crowdCue(population: number): string {
  return population > 6000 ? SOUND.crowdLarge : SOUND.crowdSmall;
}
