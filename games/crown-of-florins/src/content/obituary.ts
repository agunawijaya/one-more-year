/**
 * The obituary's words: a reign told as a page of a chronicle, from what the
 * realm's record holds. Written for this game, gently: causes are named
 * softly and no illness is described.
 *
 * The text is a list of paragraphs, each a list of sentences, so the page
 * can letter it line by line; the margin scenes say which moments earned a
 * small painting beside the text.
 */
import { formatNumber, ordinal } from '@one-more-year/kit';
import type { CauseOfDeath, PastRuler, Realm } from '../engine/state.ts';
import type { Tincture } from '../lib/heraldry.ts';
import { titleName } from './names.ts';

export type MarginScene =
  'cathedral' | 'harvest' | 'invasion' | 'promotion' | 'markets' | 'crown' | 'famine';

/**
 * A margin painting and what it is painted from: how many markets, the
 * cathedral's stage, how many times the walls were tried, the title won;
 * and the realm's own colours for its banners and robes.
 */
export interface MarginPicture {
  scene: MarginScene;
  count: number;
  field: Tincture;
  charge: Tincture;
}

export interface Obituary {
  /** The rubric at the head of the page. */
  heading: string;
  /** The words the text opens with, the ruler's name and town: its first letter becomes the decorated initial. */
  lead: string;
  paragraphs: string[][];
  scenes: MarginPicture[];
  /** The closing line under the text: who comes next. */
  succession: string;
}

const CAUSES: Readonly<Record<CauseOfDeath, string>> = {
  'old-age': 'full of years, in the quiet of the palace',
  'winter-chill': 'in the cold months, of a chill that would not lift',
  fever: 'after a short fever, with the physicians at the bedside',
  fall: 'after a fall from a horse on the road home',
  heart: 'suddenly, at table among friends',
  sleep: 'peacefully, in sleep',
};

function pronouns(form: 'm' | 'f'): { they: string; their: string; Their: string } {
  return form === 'f'
    ? { they: 'she', their: 'her', Their: 'Her' }
    : { they: 'he', their: 'his', Their: 'His' };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const SMALL_NUMBERS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** Small numbers in words, as a chronicler writes them; larger ones in figures. */
function inWords(value: number): string {
  return SMALL_NUMBERS[value] ?? formatNumber(value);
}

export function obituaryFor(realm: Realm, past: PastRuler, heir: Realm['ruler'] | null): Obituary {
  const ruler = past.ruler;
  const p = pronouns(ruler.form);
  const years = past.died - ruler.accession;
  const ageAtDeath = ruler.ageAtAccession + years;
  const firstTitle = titleName(
    ruler.generation === 1 ? 1 : Math.max(1, past.title - 1),
    ruler.form,
  );
  const lastTitle = titleName(past.title, ruler.form);
  const h = realm.holdings;
  const scenes: MarginPicture[] = [];
  const picture = (scene: MarginScene, count: number): MarginPicture => ({
    scene,
    count,
    field: realm.arms.field,
    charge: realm.arms.chargeTincture,
  });

  const lead = `${ruler.name} of ${realm.city}`;
  const opening = [
    `${lead} took the throne in the year ${ruler.accession} at the age of ${ageAtDeath - years}, and kept it for ${years} ${years === 1 ? 'year' : 'years'}.`,
    ruler.generation > 1
      ? `${capitalise(p.they)} was the ${ordinal(ruler.generation)} of ${p.their} line to rule the city.`
      : `${capitalise(p.they)} was the first of ${p.their} line, and found the city small and the treasury thin.`,
  ];

  const works: string[] = [];
  if (h.markets > 0) {
    works.push(
      `In ${p.their} time ${h.markets === 1 ? 'a marketplace was' : `${inWords(h.markets)} marketplaces were`} opened, and the merchants came to fill ${h.markets === 1 ? 'it' : 'them'}.`,
    );
    scenes.push(picture('markets', h.markets));
  }
  if (h.cathedral >= 6) {
    works.push(
      'The great church was finished to the top of its bell tower, and its bells were rung for the first time.',
    );
    scenes.push(picture('cathedral', h.cathedral));
  } else if (h.cathedral >= 5) {
    works.push(
      'The great church rose under its dome, and the masons climbed down from the scaffolds.',
    );
    scenes.push(picture('cathedral', h.cathedral));
  } else if (h.cathedral > 0) {
    works.push(
      `The great church was begun, and stood at its ${['foundations', 'nave', 'aisles', 'façade', 'dome'][h.cathedral - 1] ?? 'walls'} when ${p.they} died.`,
    );
  }
  if (h.mills > 0)
    works.push(
      `${h.mills === 1 ? 'A woollen mill' : `${capitalise(inWords(h.mills))} woollen mills`} turned on the stream.`,
    );
  if (h.palace > 0)
    works.push(
      `The palace grew by ${h.palace === 1 ? 'one piece' : `${inWords(h.palace)} pieces`}, and the nobles came to its halls.`,
    );

  const fortunes: string[] = [];
  const record = realm.record;
  if (record.weathersSeen.includes(5)) {
    fortunes.push('There was a year of such a harvest that the granaries could not hold it.');
    scenes.push(picture('harvest', 5));
  }
  if (record.famineYears > 0) {
    fortunes.push(
      record.famineYears === 1
        ? 'There was one hungry year, and it was not forgotten.'
        : `There were ${inWords(record.famineYears)} hungry years, and they were not forgotten.`,
    );
    if (!scenes.some((s) => s.scene === 'harvest')) {
      scenes.push(picture('famine', record.famineYears));
    }
  }
  if (record.invadedCount > 0) {
    fortunes.push(
      record.invadedCount === 1
        ? 'Once an army came to the walls and carried off fields beyond them; the city itself stood.'
        : `${capitalise(inWords(record.invadedCount))} times armies came to the walls and carried off fields beyond them; the city itself stood.`,
    );
    scenes.push(picture('invasion', record.invadedCount));
  }
  if (past.title > 1) {
    fortunes.push(
      `${capitalise(p.they)} rose from ${firstTitle} to ${lastTitle}, and the heralds read the new title in the piazza.`,
    );
    scenes.push(picture(past.title >= 8 ? 'crown' : 'promotion', past.title));
  }

  const people =
    realm.people.serfs +
    realm.people.merchants +
    realm.people.nobles +
    realm.people.clergy +
    realm.people.soldiers;
  const closing = [
    `${capitalise(p.they)} died in the year ${past.died}, ${CAUSES[past.cause]}, at the age of ${ageAtDeath}.`,
    `${formatNumber(people)} souls kept the day of mourning, and the bells of ${realm.city} were rung until dusk.`,
  ];

  const nextTitle = heir ? titleName(Math.max(1, past.title - 1), heir.form) : null;
  return {
    heading: `Of the life and reign of ${ruler.name}`,
    lead,
    paragraphs: [opening, works, fortunes, closing].filter((paragraph) => paragraph.length > 0),
    scenes: scenes.slice(0, 3),
    succession:
      heir && nextTitle
        ? `${p.Their} heir, ${heir.name}, takes the throne as ${nextTitle}.`
        : `With ${p.their} death the house of ${realm.city} comes to its end.`,
  };
}
