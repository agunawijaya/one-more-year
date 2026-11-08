/**
 * What the kit's play session needs to know about Crown of Florins: the
 * model, the words for every event, the epithets and milestones, the
 * chronicle's title, the daily glyphs and the share line. The game shows its
 * own end screen (the coronation or the last obituary, then the dynasty)
 * before handing over to the Hall's chronicle page.
 */
import type { PlayRules, TurnRecord } from '@one-more-year/kit';
import { crownModel } from '../engine/model.ts';
import { CENTURY_END, dailyScenarioFor } from '../engine/scenarios.ts';
import { FIRST_YEAR } from '../engine/rules.ts';
import type { Plan, World } from '../engine/state.ts';
import { EPITHETS, MILESTONES } from '../content/legacy.ts';
import { EVENT_TEXT, glyphFor, shareLineFor, titleFor } from '../content/text.ts';

export const PLAY_RULES: PlayRules<World, Plan> = {
  model: crownModel,
  text: EVENT_TEXT,
  epithets: EPITHETS,
  title: titleFor,
  glyph: (record: TurnRecord<Plan>) => glyphFor(record),
  shareLine: shareLineFor,
  // Only a scenario with its own last year counts the years down ("Year 6 of 61"); the century's
  // end is a safety net, not a length.
  length: (world) =>
    world.endYear === null || world.endYear >= CENTURY_END ? null : world.endYear - FIRST_YEAR + 1,
  dailyScenario: dailyScenarioFor,
  milestones: MILESTONES,
  presentation: 'game',
};
