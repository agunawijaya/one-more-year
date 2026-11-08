/**
 * Balance runs: many seeded games of one bot against AI rivals, tallied the
 * way docs/NOTES.md reports them and tests/balance.test.ts locks them.
 *
 * The founder's reign is what counts: games are played under Classic fate,
 * so a run ends when the bot's first ruler is crowned or dies. Seeds run
 * 1…N, so every tally is exact and repeatable.
 */
import { createRng } from '@one-more-year/kit';
import { quickCourt, type Court, type SeatChoice } from './court.ts';
import { PERSONALITIES } from '../content/names.ts';
import { naiveBot } from './bots.ts';
import { playGame, type Bot } from './simulate.ts';
import { titlePoints } from './title.ts';
import { titleInputs } from './year.ts';
import type { Difficulty, Personality, Realm } from './state.ts';

export interface BalanceConfig {
  bot: Bot;
  /** The rivals' ways of ruling; 'mixed' draws three of the five for each game. */
  rivals: readonly Personality[] | 'mixed';
  difficulty?: Difficulty;
  /** The bot's seat (0–3), or 'rotate' to sit it in every seat in turn. */
  seat?: number | 'rotate';
  scenario?: string;
  games: number;
  firstSeed?: number;
}

export interface BalanceTally {
  games: number;
  /** Crowned before the founder died. */
  crowned: number;
  /** Median years from 1400 to the crown, among crowned games. */
  medianYears: number;
  bankrupt: number;
  invaded: number;
  bankruptOrInvaded: number;
  /** A rival was crowned while the bot's founder still reigned. */
  rivalFirst: number;
  /** The share of games whose final title was each rung, 1–8. */
  titles: number[];
  /** Crowned share by the bot's seat, for the first-player check. */
  bySeat: number[];
}

/** A court of four: the bot in `seat`, AI rivals in the rest. */
export function balanceCourt(seed: number, config: BalanceConfig, seat: number): Court {
  const rivals =
    config.rivals === 'mixed'
      ? createRng(seed).fork('balance-rivals').shuffle(PERSONALITIES).slice(0, 3)
      : config.rivals;
  const court = quickCourt(seed, 1, 3, {
    difficulty: config.difficulty ?? 2,
    fate: 'classic',
    personalities: rivals,
  });
  const seats: SeatChoice[] = [...court.seats];
  const [human] = seats.splice(0, 1);
  if (human) seats.splice(seat, 0, human);
  return { ...court, seats };
}

/** What a personality's realms look like on average after some years of ruling. */
export interface RivalProfile {
  realms: number;
  soldiers: number;
  soldiersPerThousand: number;
  customs: number;
  /** Customs + sales + wealth, in percent. */
  taxBurden: number;
  justice: number;
  markets: number;
  mills: number;
  /** Palace and cathedral pieces together. */
  monuments: number;
  treasury: number;
  merchants: number;
  clergy: number;
  points: number;
  title: number;
}

export interface RivalRealm {
  personality: Personality;
  realm: Realm;
}

/**
 * Courts of the five personalities alone, each played for `years` years:
 * the realms the profile tests compare. Seeds run 1…games.
 */
export function rivalRealms(
  games: number,
  years: number,
  difficulty: Difficulty = 2,
): RivalRealm[] {
  const realms: RivalRealm[] = [];
  for (let i = 0; i < games; i++) {
    const seed = 1 + i;
    const court = quickCourt(seed, 0, PERSONALITIES.length, { difficulty, fate: 'dynasty' });
    // A court of rivals alone plays a whole year per step and ignores the bot's plan.
    const { world } = playGame({ seed, court, bot: naiveBot, maxSteps: years });
    for (const realm of world.realms) {
      if (realm.controller.kind === 'ai') {
        realms.push({ personality: realm.controller.personality, realm });
      }
    }
  }
  return realms;
}

/** Each personality's realms averaged: does the General keep the biggest army, the Miser the fullest purse? */
export function rivalProfiles(
  games: number,
  years: number,
  difficulty: Difficulty = 2,
): Record<Personality, RivalProfile> {
  return profilesOf(rivalRealms(games, years, difficulty));
}

export function profilesOf(realms: readonly RivalRealm[]): Record<Personality, RivalProfile> {
  const profiles = {} as Record<Personality, RivalProfile>;
  for (const personality of PERSONALITIES) {
    const own = realms.filter((r) => r.personality === personality).map((r) => r.realm);
    const mean = (of: (realm: Realm) => number): number =>
      own.reduce((sum, realm) => sum + of(realm), 0) / Math.max(1, own.length);
    profiles[personality] = {
      realms: own.length,
      soldiers: mean((r) => r.people.soldiers),
      soldiersPerThousand: mean((r) => (r.people.soldiers / r.land) * 1000),
      customs: mean((r) => r.taxes.customs),
      taxBurden: mean((r) => r.taxes.customs + r.taxes.sales + r.taxes.wealth),
      justice: mean((r) => r.taxes.justice),
      markets: mean((r) => r.holdings.markets),
      mills: mean((r) => r.holdings.mills),
      monuments: mean((r) => r.holdings.palace + r.holdings.cathedral),
      treasury: mean((r) => r.treasury),
      merchants: mean((r) => r.people.merchants),
      clergy: mean((r) => r.people.clergy),
      points: mean((r) => titlePoints(titleInputs(r))),
      title: mean((r) => r.title),
    };
  }
  return profiles;
}

export function runBalance(config: BalanceConfig): BalanceTally {
  const first = config.firstSeed ?? 1;
  const years: number[] = [];
  const titles = new Array<number>(8).fill(0);
  const seatGames = [0, 0, 0, 0];
  const seatCrowns = [0, 0, 0, 0];
  let crowned = 0;
  let bankrupt = 0;
  let invaded = 0;
  let either = 0;
  let rivalFirst = 0;
  for (let i = 0; i < config.games; i++) {
    const seed = first + i;
    const seat = config.seat === 'rotate' ? i % 4 : (config.seat ?? 0);
    const court = balanceCourt(seed, config, seat);
    const { world } = playGame({
      seed,
      court,
      scenario: config.scenario ?? 'standard',
      bot: config.bot,
      maxSteps: 80,
    });
    const realm = world.realms[seat] as Realm;
    const founder = realm.pastRulers[0]?.ruler ?? realm.ruler;
    const crownedYear = realm.record.crownedYear;
    const won = crownedYear !== null && crownedYear < founder.deathYear;
    seatGames[seat] = (seatGames[seat] ?? 0) + 1;
    if (won) {
      crowned++;
      seatCrowns[seat] = (seatCrowns[seat] ?? 0) + 1;
      years.push(crownedYear - 1400);
    }
    const finalTitle = realm.pastRulers[0]?.title ?? realm.title;
    titles[finalTitle - 1] = (titles[finalTitle - 1] ?? 0) + 1;
    const broke = realm.record.bankruptcies > 0;
    const attacked = realm.record.invadedCount > 0;
    if (broke) bankrupt++;
    if (attacked) invaded++;
    if (broke || attacked) either++;
    const rivalCrown = world.realms.some(
      (r) =>
        r.seat !== seat &&
        r.record.crownedYear !== null &&
        r.record.crownedYear < (crownedYear ?? founder.deathYear),
    );
    if (rivalCrown) rivalFirst++;
  }
  years.sort((a, b) => a - b);
  const n = config.games;
  return {
    games: n,
    crowned: crowned / n,
    medianYears: years.length > 0 ? (years[Math.floor(years.length / 2)] ?? 0) : Number.NaN,
    bankrupt: bankrupt / n,
    invaded: invaded / n,
    bankruptOrInvaded: either / n,
    rivalFirst: rivalFirst / n,
    titles: titles.map((count) => count / n),
    bySeat: seatGames.map((games, s) => (games > 0 ? (seatCrowns[s] ?? 0) / games : Number.NaN)),
  };
}
