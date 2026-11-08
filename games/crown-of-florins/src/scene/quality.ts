/**
 * The quality ladder: three graphics levels and the rule that moves
 * between them (the same rule as Ten Harvests: step down after two seconds
 * of slow frames, try one level up after eight comfortable seconds, never
 * above the player's chosen ceiling). Pure logic fed frame times, so a slow
 * machine can be simulated in tests.
 *
 * What a level changes here is the fresco's: the brushwork's resolution and
 * brush size, how many stroke directions cross at each pixel, how much of
 * the plaster is painted (grain alone, or the trowel, the day seams, the
 * cracks and the sinopia too), the shadow map, and how dense the crowds are.
 */

export type QualityLevel = 'high' | 'balanced' | 'light';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['light', 'balanced', 'high'];

export interface QualityProfile {
  /** The Kuwahara brushwork's resolution as a share of the screen's. */
  postResolution: number;
  /** Brush radius in source pixels. */
  brush: number;
  /** Stroke directions crossed at each pixel (2 where the flow turns, or 1). */
  strokeLayers: number;
  /** 1 paints the whole wall, 0 its grain alone. */
  plaster: number;
  /** Shadow map size, or 0 for none. */
  shadowMap: number;
  /** Share of the crowd that is drawn. */
  crowd: number;
  /** Render resolution as a share of the device's pixels. */
  resolution: number;
}

export const PROFILES: Readonly<Record<QualityLevel, QualityProfile>> = {
  high: {
    postResolution: 1,
    brush: 5,
    strokeLayers: 2,
    plaster: 1,
    shadowMap: 4096,
    crowd: 1,
    resolution: 1,
  },
  balanced: {
    postResolution: 0.75,
    brush: 4,
    strokeLayers: 2,
    plaster: 1,
    shadowMap: 2048,
    crowd: 0.7,
    resolution: 1,
  },
  light: {
    postResolution: 0.5,
    brush: 3,
    strokeLayers: 1,
    plaster: 0,
    shadowMap: 1024,
    crowd: 0.4,
    resolution: 0.85,
  },
};

/** 60 fps: a frame should take no longer than this. */
export const FRAME_BUDGET_MS = 1000 / 60;

export interface LadderOptions {
  ceiling: QualityLevel;
  start?: QualityLevel;
  slowFactor?: number;
  stepDownAfter?: number;
  stepUpAfter?: number;
}

export interface QualityLadder {
  readonly level: QualityLevel;
  readonly ceiling: QualityLevel;
  setCeiling(ceiling: QualityLevel): void;
  frame(milliseconds: number): QualityLevel;
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

  const ladder: QualityLadder = {
    get level() {
      return level;
    },
    get ceiling() {
      return ceiling;
    },
    setCeiling(next) {
      ceiling = next;
      level = next;
      ladder.settle();
    },
    frame(milliseconds) {
      // The frames right after a change compile shaders and upload buffers; they say nothing.
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
        ladder.settle();
      } else if (fastFor >= stepUpAfter && rank(level) < rank(ceiling)) {
        level = QUALITY_LEVELS[rank(level) + 1] as QualityLevel;
        ladder.settle();
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
  return ladder;
}
