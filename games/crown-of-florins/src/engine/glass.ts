/**
 * The glass box: everything the engine uses, put into the words and
 * numbers the screen shows. Every figure here is computed by the same
 * functions the year uses (title.ts, invasion.ts, lifespan.ts, rules.ts),
 * so the screen can never claim what the engine would not do.
 */
import { BANKRUPTCY_PER_TITLE, DEBT_INTEREST, INVASION, PILLAR_CAP, TOP_TITLE } from './rules.ts';
import {
  divisorFor,
  earnedTitle,
  PILLARS,
  pillarPoints,
  pointsForTitle,
  quantityOf,
  type PillarId,
  type TitleInputs,
} from './title.ts';
import {
  invaderFor,
  seizureRange,
  soldiersNeeded,
  strongestRival,
  threatFor,
  type Threat,
} from './invasion.ts';
import { ageIn, deathOdds, lifeBand, survivalOdds } from './lifespan.ts';
import type { Difficulty, Realm, Ruler, Standing } from './state.ts';

export interface PillarView {
  id: PillarId;
  points: number;
  quantity: number;
  /** How much of the quantity earns one point. */
  per: number;
  /** How much more is needed for the next point (0 when capped). */
  toNext: number;
  capped: boolean;
}

export interface RoadView {
  title: number;
  /** The title the points would earn, before "titles never fall". */
  earned: number;
  next: number | null;
  points: number;
  /** Points needed for the next title at this justice and difficulty. */
  needed: number | null;
  divisor: number;
  justicePenalty: number;
  pillars: PillarView[];
}

export function roadToTitle(
  inputs: TitleInputs,
  title: number,
  justice: number,
  difficulty: Difficulty,
): RoadView {
  const pillars = PILLARS.map((rule) => {
    const quantity = quantityOf(rule.id, inputs);
    const points = pillarPoints(rule, quantity);
    const capped = points >= PILLAR_CAP;
    const toNext = capped ? 0 : Math.max(0, (points + 1) * rule.per - quantity);
    return { id: rule.id, points, quantity, per: rule.per, toNext, capped };
  });
  const points = pillars.reduce((sum, pillar) => sum + pillar.points, 0);
  const next = title >= TOP_TITLE ? null : title + 1;
  return {
    title,
    earned: earnedTitle(points, justice, difficulty),
    next,
    points,
    needed: next === null ? null : pointsForTitle(next, justice, difficulty),
    divisor: divisorFor(difficulty),
    justicePenalty: justice,
    pillars,
  };
}

export interface BorderView {
  land: number;
  soldiers: number;
  /** Soldiers needed so the land alone invites no army. */
  needed: number;
  strongest: Standing | null;
  /** The army a rival may have before it counts as a threat to you. */
  rivalLimit: number;
  threat: Threat;
  /** Who would march, if the gates opened: a seat, or null for mercenaries. */
  invader: Standing | null;
  /** Hectares at risk: [least, most]; the first 5,000 are always kept. */
  atRisk: [number, number];
  /** Soldiers that could fall: [least, most]. */
  losses: [number, number];
}

export function borderWatch(
  seat: number,
  land: number,
  soldiers: number,
  standings: readonly Standing[],
): BorderView {
  const strongest = strongestRival(seat, standings);
  const invader = invaderFor(seat, standings);
  const most = Math.max(0, Math.min(INVASION.lossRoll, soldiers - INVASION.garrison));
  return {
    land,
    soldiers,
    needed: soldiersNeeded(land),
    strongest,
    rivalLimit: Math.floor(soldiers * INVASION.rivalRatio),
    threat: threatFor(seat, land, soldiers, standings),
    invader,
    atRisk: seizureRange(land, invader),
    losses: [Math.min(1, most), most],
  };
}

export interface DebtView {
  treasury: number;
  /** Creditors arrive below this. */
  line: number;
  /** What a year of interest would add to the debt now. */
  interest: number;
  /** Years until the creditors come if nothing changes but interest; null when not in debt. */
  yearsToCreditors: number | null;
}

export function debtView(treasury: number, title: number): DebtView {
  const line = -BANKRUPTCY_PER_TITLE * title;
  if (treasury >= 0) return { treasury, line, interest: 0, yearsToCreditors: null };
  let debt = treasury;
  let years = 0;
  while (debt >= line && years < 50) {
    debt *= DEBT_INTEREST;
    years++;
  }
  return {
    treasury,
    line,
    interest: Math.round(treasury * (DEBT_INTEREST - 1)),
    yearsToCreditors: years,
  };
}

export interface LifeView {
  age: number;
  /** The ages between which the rule allows this ruler to die. */
  band: [number, number];
  /** The chance of dying this year, from the rule alone. */
  thisYear: number;
  /** The chance of living five more years. */
  fiveMore: number;
  /** How far the candle has burnt, 0 new to 1 out, from the odds (never the hidden year). */
  candle: number;
}

export function lifeView(ruler: Ruler, year: number): LifeView {
  const { first, last } = lifeBand(ruler);
  const thisYear = deathOdds(ruler, year);
  const span = last - ruler.accession;
  return {
    age: ageIn(ruler, year),
    band: [ageIn(ruler, first), ageIn(ruler, last)],
    thisYear,
    fiveMore: survivalOdds(ruler, year, 5),
    candle: Math.min(1, Math.max(0, (year - ruler.accession) / span)),
  };
}

/** Everything the glass-box panel shows for the acting realm. */
export interface GlassBox {
  road: RoadView;
  border: BorderView;
  debt: DebtView;
  life: LifeView;
}

export function glassBox(
  realm: Realm,
  year: number,
  difficulty: Difficulty,
  standings: readonly Standing[],
): GlassBox {
  const inputs: TitleInputs = {
    people: realm.people,
    holdings: realm.holdings,
    treasury: realm.treasury,
    land: realm.land,
    prosperity: realm.prosperity,
  };
  return {
    road: roadToTitle(inputs, realm.title, realm.taxes.justice, difficulty),
    border: borderWatch(realm.seat, realm.land, realm.people.soldiers, standings),
    debt: debtView(realm.treasury, realm.title),
    life: lifeView(realm.ruler, year),
  };
}
