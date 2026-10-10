/**
 * Ten Harvests: rule a city on the river for ten harvests. Inspired by the
 * 1968 grain-and-land simulation (see CREDITS.md).
 *
 * The module the Hall loads when the world is opened or its demo comes into
 * view. The pieces: the engine (src/engine), the city in three.js
 * (src/scene), the stele (src/stele), the interface panels (src/ui), the
 * screens and their flow (src/game) and the words (src/content).
 */
import type { SimModule } from '@one-more-year/kit';
import { manifest } from '../manifest.ts';
import { HOW_TO_PLAY } from './content/how-to-play.ts';
import { CODEX, MILESTONES } from './content/legacy.ts';
import { tenHarvestsDemo } from './demo.ts';
import { mountTenHarvests } from './game/app.ts';
import { PLAIN_WIND } from './game/sound.ts';

const tenHarvests: SimModule = {
  manifest,
  howToPlay: HOW_TO_PLAY,
  milestones: MILESTONES,
  codex: CODEX,
  saves: { version: 1 },
  ambience: PLAIN_WIND,
  mount: mountTenHarvests,
  demo: tenHarvestsDemo,
};

export default tenHarvests;
