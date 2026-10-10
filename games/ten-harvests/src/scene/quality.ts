/**
 * The quality ladder: three graphics levels and the rule that moves
 * between them.
 *
 * The player chooses a ceiling (high, balanced or light). Within it, the
 * ladder watches frame times: when frames run slower than the budget for a
 * couple of seconds it steps down one level, and when they have been
 * comfortably fast for a while it steps back up. Pure logic, fed frame
 * durations, so it can be tested with a simulated slow machine.
 */

export type QualityLevel = 'high' | 'balanced' | 'light';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['light', 'balanced', 'high'];

export interface QualityProfile {
  /** Wheat blades on each planted parcel. */
  bladesPerParcel: number;
  /** Shadow map size, or 0 for no shadows. */
  shadowMap: number;
  bloom: boolean;
  tiltShift: boolean;
  /** Multisampling of the scene target. */
  samples: number;
  /** Render resolution as a share of the device's pixels. */
  resolution: number;
}

export const PROFILES: Readonly<Record<QualityLevel, QualityProfile>> = {
  high: {
    bladesPerParcel: 700,
    shadowMap: 2048,
    bloom: true,
    tiltShift: true,
    samples: 4,
    resolution: 1,
  },
  balanced: {
    bladesPerParcel: 320,
    shadowMap: 1024,
    bloom: true,
    tiltShift: false,
    samples: 2,
    resolution: 1,
  },
  light: {
    bladesPerParcel: 130,
    shadowMap: 0,
    bloom: false,
    tiltShift: false,
    samples: 0,
    resolution: 0.8,
  },
};

/** 60 fps: a frame should take no longer than this. */
export const FRAME_BUDGET_MS = 1000 / 60;

export interface LadderOptions {
  ceiling: QualityLevel;
  /** Where to begin, if lower than the ceiling (a machine known to be slow). */
  start?: QualityLevel;
  /** Frames slower than budget × this count as slow (vsync jitter is not a slow machine). */
  slowFactor?: number;
  /** Seconds of slow frames before stepping down. */
  stepDownAfter?: number;
  /** Seconds of fast frames before trying one level up. */
  stepUpAfter?: number;
}

export interface QualityLadder {
  readonly level: QualityLevel;
  readonly ceiling: QualityLevel;
  setCeiling(ceiling: QualityLevel): void;
  /** Feed one frame's duration; returns the level, which may have changed. */
  frame(milliseconds: number): QualityLevel;
  /** Forget the history, e.g. after a pause, a resize or a change of scene. */
  settle(): void;
}

const rank = (level: QualityLevel): number => QUALITY_LEVELS.indexOf(level);

export function createQualityLadder(options: LadderOptions): QualityLadder {
  let ceiling = options.ceiling;
  let level =
    options.start && rank(options.start) < rank(ceiling) ? options.start : options.ceiling;
  const slowFactor = options.slowFactor ?? 1.25;
  const stepDownAfter = (options.stepDownAfter ?? 2) * 1000;
  const stepUpAfter = (options.stepUpAfter ?? 8) * 1000;
  let average = FRAME_BUDGET_MS;
  let slowFor = 0;
  let fastFor = 0;
  let warmUp = 30;

  return {
    get level() {
      return level;
    },
    get ceiling() {
      return ceiling;
    },
    setCeiling(next) {
      ceiling = next;
      level = next;
      this.settle();
    },
    frame(milliseconds) {
      // Ignore the frames right after a change: shaders compile and buffers upload then.
      if (warmUp > 0) {
        warmUp--;
        return level;
      }
      const clamped = Math.min(milliseconds, 250);
      average += (clamped - average) * 0.08;
      if (average > FRAME_BUDGET_MS * slowFactor) {
        slowFor += clamped;
        fastFor = 0;
      } else if (average < FRAME_BUDGET_MS * 0.8) {
        fastFor += clamped;
        slowFor = 0;
      } else {
        slowFor = 0;
        fastFor = 0;
      }
      if (slowFor >= stepDownAfter && rank(level) > 0) {
        level = QUALITY_LEVELS[rank(level) - 1] as QualityLevel;
        this.settle();
      } else if (fastFor >= stepUpAfter && rank(level) < rank(ceiling)) {
        level = QUALITY_LEVELS[rank(level) + 1] as QualityLevel;
        this.settle();
      }
      return level;
    },
    settle() {
      average = FRAME_BUDGET_MS;
      slowFor = 0;
      fastFor = 0;
      warmUp = 30;
    },
  };
}
