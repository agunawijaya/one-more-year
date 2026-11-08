/**
 * Crown of Florins: rule an Italian city-state from 1400 against up to five
 * rivals. Inspired by the 1978 city-state simulation (see CREDITS.md).
 *
 * The module the Hall loads when the world is opened or its demo comes into
 * view. The pieces: the engine (src/engine), the fresco in three.js
 * (src/scene), the panels, heraldry and manuscript (src/ui), the screens
 * and their flow (src/game) and the words (src/content).
 */
import type { SimModule } from '@one-more-year/kit';
import { manifest } from '../manifest.ts';
import { HOW_TO_PLAY } from './content/how-to-play.ts';
import { CODEX, MILESTONES } from './content/legacy.ts';
import { crownDemo } from './demo.ts';
import { mountCrown } from './game/app.ts';
import { PIAZZA } from './game/sound.ts';

const crownOfFlorins: SimModule = {
  manifest,
  howToPlay: HOW_TO_PLAY,
  milestones: MILESTONES,
  codex: CODEX,
  saves: { version: 1 },
  ambience: PIAZZA,
  mount: mountCrown,
  demo: crownDemo,
};

export default crownOfFlorins;
