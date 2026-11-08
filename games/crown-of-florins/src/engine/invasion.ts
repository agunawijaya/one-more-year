/**
 * The border watch: when a realm is invaded, by whom, and what it loses.
 *
 * Invasion is not a gamble. A realm is invaded in a year when, after its
 * land trade, it has fewer soldiers than one per 1,000 hectares, or when a
 * rival's army is more than 2.4 times its own. (The 1978 conversion wrote
 * the rival test the wrong way round, so every rival with fewer than 2.4
 * times your soldiers opened your gates; docs/NOTES.md.) Rivals are judged
 * by the standings published at the end of the last year, which every ruler
 * can see.
 *
 * The invader is the strongest rival that can spare its troops (at least
 * 1.2 soldiers per 1,000 of its own hectares); if none can, a band of
 * mercenaries comes instead. A rival takes its soldiers × 1,000 less a third
 * of its own land; mercenaries take 1,001–10,000 hectares. Either way the
 * walls keep the first 5,000 hectares, and a seizure that would reach them
 * takes half of what lies beyond instead. The defender loses 1–40 soldiers,
 * never below a garrison of 15.
 */
import type { Rng } from '@one-more-year/kit';
import { CORE_LAND, INVASION } from './rules.ts';
import { rollUpTo, whole } from './numbers.ts';
import type { Invasion, Standing } from './state.ts';

export type Threat = 'too-few-soldiers' | 'strong-rival' | null;

/** Soldiers a realm needs so its land alone does not invite an invasion. */
export function soldiersNeeded(land: number): number {
  return Math.ceil(land / INVASION.hectaresPerSoldier);
}

/** original: a realm with fewer soldiers than its thousands of hectares is open to attack. */
export function tooFewSoldiers(land: number, soldiers: number): boolean {
  return land / INVASION.hectaresPerSoldier > soldiers;
}

/** Rivals still in the game, as the standings show them. */
export function rivalsOf(seat: number, standings: readonly Standing[]): Standing[] {
  return standings.filter((s) => s.seat !== seat && s.status !== 'ended');
}

/** The rival with the strongest army, if any rival is left. */
export function strongestRival(seat: number, standings: readonly Standing[]): Standing | null {
  let best: Standing | null = null;
  for (const rival of rivalsOf(seat, standings)) {
    if (!best || rival.soldiers > best.soldiers) best = rival;
  }
  return best;
}

/** fixed: a rival with more than 2.4 times your soldiers is a threat. */
export function rivalTooStrong(
  seat: number,
  soldiers: number,
  standings: readonly Standing[],
): boolean {
  const strongest = strongestRival(seat, standings);
  return strongest !== null && strongest.soldiers > soldiers * INVASION.rivalRatio;
}

export function threatFor(
  seat: number,
  land: number,
  soldiers: number,
  standings: readonly Standing[],
): Threat {
  if (tooFewSoldiers(land, soldiers)) return 'too-few-soldiers';
  if (rivalTooStrong(seat, soldiers, standings)) return 'strong-rival';
  return null;
}

/** original: the rival who marches, if any: the strongest of those able to spare troops. */
export function invaderFor(seat: number, standings: readonly Standing[]): Standing | null {
  let invader: Standing | null = null;
  for (const rival of rivalsOf(seat, standings)) {
    const spare = rival.soldiers >= INVASION.spareRatio * (rival.land / 1000);
    if (spare && (!invader || rival.soldiers > invader.soldiers)) invader = rival;
  }
  return invader;
}

/** original: the walls keep the core; a seizure that would reach it takes half of what lies beyond. */
export function capSeizure(wanted: number, land: number): number {
  const beyond = Math.max(0, land - CORE_LAND);
  return Math.max(0, wanted > beyond ? whole(beyond / 2) : whole(wanted));
}

/** original: what a rival army takes: its soldiers × 1,000 less a third of its own land. */
export function rivalClaim(invader: Standing): number {
  return Math.max(0, invader.soldiers * 1000 - invader.land / 3);
}

/** The hectares at risk this year, for the border watch: [least, most]. */
export function seizureRange(land: number, invader: Standing | null): [number, number] {
  if (invader) {
    const taken = capSeizure(rivalClaim(invader), land);
    return [taken, taken];
  }
  return [
    capSeizure(INVASION.mercenaryBase + 1, land),
    capSeizure(INVASION.mercenaryBase + INVASION.mercenaryRoll, land),
  ];
}

/** original: soldiers lost, 1–40, never below the garrison (and never a gain). */
export function soldiersLostFrom(soldiers: number, rng: Rng): number {
  const roll = rollUpTo(rng, INVASION.lossRoll);
  return Math.max(0, Math.min(roll, soldiers - INVASION.garrison));
}

export function resolveInvasion(
  seat: number,
  land: number,
  soldiers: number,
  reason: Exclude<Threat, null>,
  standings: readonly Standing[],
  rng: Rng,
): Invasion {
  const invader = invaderFor(seat, standings);
  const wanted = invader
    ? rivalClaim(invader)
    : rollUpTo(rng, INVASION.mercenaryRoll) + INVASION.mercenaryBase;
  return {
    by: invader ? invader.seat : null,
    hectares: capSeizure(wanted, land),
    soldiersLost: soldiersLostFrom(soldiers, rng),
    reason,
  };
}
