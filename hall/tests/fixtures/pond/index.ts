/**
 * Pond: the test-only simulation that proves the whole loop through the
 * real Hall chrome (begin → plan → end the turn → report → pause → resume
 * after reload → finish → chronicle → back to the Hall).
 *
 * It is also the reference a simulation builder reads first. A real
 * simulation has the same shape in games/<id>/: manifest.ts for the
 * catalog, src/index.ts default-exporting its SimModule, a pure engine,
 * its words in one place, its own screens and its demo.
 */
import './pond.css';
import type { SimModule } from '@one-more-year/kit';
import { CODEX, HOW_TO_PLAY, MILESTONES } from './content.ts';
import { pondDemo } from './demo.ts';
import { manifest } from './manifest.ts';
import { WATER_BED, mountPond } from './ui.ts';

export const pond: SimModule = {
  manifest,
  howToPlay: HOW_TO_PLAY,
  milestones: MILESTONES,
  codex: CODEX,
  saves: { version: 1 },
  ambience: WATER_BED,
  mount: mountPond,
  demo: pondDemo,
};

export default pond;
