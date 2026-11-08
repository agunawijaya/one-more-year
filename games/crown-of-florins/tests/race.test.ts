/**
 * The end of the race, held to the rule (prompt 02 §3.7, NOTES "The end of
 * the race"): the first realm crowned wins it; a player crowned first ends
 * the game; when a rival wins it the players play on, or close the
 * chronicle, and the whole table is told at once.
 */
import { describe, expect, it, vi } from 'vitest';
import { quickCourt } from '../src/engine/court.ts';
import { crownModel } from '../src/engine/model.ts';
import { feedingPlan } from '../src/engine/plan.ts';
import { playGame } from '../src/engine/simulate.ts';
import { actingRealm, createWorld, playStep } from '../src/engine/world.ts';
import type { World } from '../src/engine/state.ts';
import { rngForStep } from '@one-more-year/kit';
import { titleName } from '../src/content/names.ts';
import { TOP_TITLE } from '../src/engine/rules.ts';
import { projectPlan, raceWon } from '../src/game/year-model.ts';
import { raceAnnouncement } from '../src/game/screens/race.ts';
import { newsLine } from '../src/game/screens/valley.ts';
import { createYearScreen } from '../src/ui/year-screen.ts';

/** Seed 51, the default solo court: a rival is crowned in 1425 while the player feeds the city. */
const SEED = 51;

function rivalCrowned(): World {
  return playGame({
    seed: SEED,
    court: quickCourt(SEED, 1, 3),
    bot: (view) => feedingPlan(view.realm),
    maxSteps: 80,
    until: (w) => w.firstCrowned !== null,
  }).world;
}

describe('the race to the crown', () => {
  const world = rivalCrowned();
  const winner = world.firstCrowned ?? -1;

  it('is won by the first realm crowned, and the game goes on when that is a rival', () => {
    expect(winner).toBeGreaterThan(0);
    expect(world.realms[winner]?.status).toBe('crowned');
    expect(world.end).toBeNull();
    const won = raceWon(world);
    const realm = world.realms[winner];
    expect(won?.city).toBe(realm?.city);
    expect(won?.year).toBe(realm?.record.crownedYear);
    expect(won?.title).toBe(titleName(TOP_TITLE, realm?.ruler.form ?? 'm'));
  });

  it('lets the player close the chronicle once the race is won, and not before', () => {
    const plan = { ...feedingPlan(actingRealm(world)), retire: true };
    const ended = playStep(world, plan, rngForStep(SEED, 999)).world;
    expect(ended.end?.ending).toBe('retired');

    const fresh = createWorld(SEED, { scenario: 'standard', court: quickCourt(SEED, 1, 3) });
    const early = { ...feedingPlan(actingRealm(fresh)), retire: true };
    expect(playStep(fresh, early, rngForStep(SEED, 0)).world.end).toBeNull();
  });

  it('tells a later crown as a crown won after the first', () => {
    const other = world.realms.find((r) => r.seat !== winner && r.seat !== 0);
    const line = newsLine(
      { seat: other?.seat ?? 1, year: world.year, kind: 'crowned', numbers: {} },
      world,
    );
    expect(line).toContain('after');
    expect(line).toContain(world.realms[winner]?.city ?? '');
    expect(
      newsLine({ seat: winner, year: world.year, kind: 'crowned', numbers: {} }, world),
    ).toContain('The race is won');
  });

  it('keeps the news in the step bar and marks the winner in the rival bar', () => {
    const realm = actingRealm(world);
    const plan = feedingPlan(realm);
    const year = createYearScreen({
      step: () => undefined,
      change: () => undefined,
      seal: () => undefined,
      pillarRead: () => undefined,
      pickBuilding: () => undefined,
    });
    year.update({
      appearance: 'light',
      world,
      realm,
      plan,
      step: 'harvest',
      issues: crownModel.validate(world, plan),
      projection: projectPlan(world, realm, plan),
      forecast: null,
      forecastsShown: true,
      hiddenSeats: new Set(),
      ghost: null,
    });
    const race = year.element.querySelector<HTMLElement>('.cf-steps__race');
    expect(race?.hidden).toBe(false);
    expect(race?.textContent).toContain(world.realms[winner]?.city ?? '');
    expect(race?.textContent).toContain(String(world.realms[winner]?.record.crownedYear));
    const first = year.element.querySelectorAll('.cf-rival[data-crowned="first"]');
    expect(first).toHaveLength(1);
    expect(first[0]?.textContent).toContain(world.realms[winner]?.city ?? '');
  });

  it('offers the player both ways on, and says which was chosen', () => {
    const won = raceWon(world);
    if (!won) throw new Error('The race should be won');
    const chosen = vi.fn();
    const card = raceAnnouncement(won, chosen);
    expect(card.element.textContent).toContain(`${won.city} has crowned ${won.title} ${won.ruler}`);
    const playOn = card.element.querySelector<HTMLButtonElement>('[data-action="continue"]');
    const endHere = card.element.querySelector<HTMLButtonElement>('[data-action="end-here"]');
    expect(playOn?.textContent).toBe('Play on for your own chronicle');
    expect(endHere?.textContent).toBe('End here and see the chronicle');
    endHere?.click();
    expect(chosen).toHaveBeenLastCalledWith('end-here');
    playOn?.click();
    expect(chosen).toHaveBeenLastCalledWith('play-on');
  });
});
