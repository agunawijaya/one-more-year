/**
 * Every name in the valley: the title ladder, the towns, the rulers' given
 * names and the five AI rivals. All invented for this game; none comes from
 * the 1978 program, and no ruler is a real person (a ruler is a given name
 * and a town that never existed).
 */
import type { Personality, TitleForm } from '../engine/state.ts';

/** The ladder from knight to crown, in both forms. Index 0 is title 1. */
export const TITLE_LADDER: readonly { m: string; f: string }[] = [
  { m: 'Cavaliere', f: 'Dama' },
  { m: 'Barone', f: 'Baronessa' },
  { m: 'Conte', f: 'Contessa' },
  { m: 'Marchese', f: 'Marchesa' },
  { m: 'Duca', f: 'Duchessa' },
  { m: 'Granduca', f: 'Granduchessa' },
  { m: 'Principe', f: 'Principessa' },
  { m: 'Re', f: 'Regina' },
];

export function titleName(title: number, form: TitleForm): string {
  const rung = TITLE_LADDER[Math.min(TITLE_LADDER.length, Math.max(1, title)) - 1];
  return rung ? rung[form] : '';
}

/** Twenty-four towns of the valley, none of them real and none from the 1978 program. */
export const TOWNS: readonly string[] = [
  'Valdorsa',
  'Borgoflavio',
  'Castelmirto',
  'Roccaventosa',
  'Pietrargenta',
  'Ponteluce',
  'Torresalvia',
  'Fiorasca',
  'Lucemara',
  'Campofelce',
  'Orvanto',
  'Sassoreale',
  'Querciagrande',
  'Ventimura',
  'Spinarossa',
  'Lagomoro',
  'Poggiofiore',
  'Olmara',
  'Vignalta',
  'Cervalto',
  'Selvanera',
  'Petralba',
  'Corvallo',
  'Tarsiana',
];

/** Given names; a ruler is always "a given name of a town", never a family that existed. */
export const GIVEN_NAMES: Readonly<Record<TitleForm, readonly string[]>> = {
  m: [
    'Ottavio',
    'Lapo',
    'Ugolino',
    'Bindo',
    'Matteo',
    'Gherardo',
    'Niccolò',
    'Rinaldo',
    'Tancredi',
    'Alessio',
    'Fazio',
    'Orlando',
    'Ruggero',
    'Tebaldo',
    'Arrigo',
    'Iacopo',
    'Vanni',
    'Corrado',
    'Folco',
    'Taddeo',
    'Benedetto',
    'Guido',
    'Neri',
    'Simone',
  ],
  f: [
    'Bianca',
    'Lucia',
    'Costanza',
    'Ginevra',
    'Isotta',
    'Selvaggia',
    'Cecilia',
    'Fiammetta',
    'Lisabetta',
    'Nicolosa',
    'Orsola',
    'Piccarda',
    'Agnesina',
    'Simona',
    'Tessa',
    'Vanna',
    'Margherita',
    'Gemma',
    'Diamante',
    'Brigida',
    'Mattea',
    'Contessina',
    'Lena',
    'Nannina',
  ],
};

/** Roman numerals for rulers who share a name with an ancestor. */
export function regnal(count: number): string {
  const numerals = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  return numerals[count] ?? ` ${count}`;
}

/** The five AI rivals: a way of ruling, and a ruler and town of their own. */
export interface RivalCharacter {
  personality: Personality;
  /** What the court setup calls this way of ruling. */
  label: string;
  /** One line on how they play. */
  manner: string;
  name: string;
  form: TitleForm;
  town: string;
}

export const RIVALS: Readonly<Record<Personality, RivalCharacter>> = {
  merchant: {
    personality: 'merchant',
    label: 'the Merchant',
    manner: 'Markets and mills, low customs, a full purse.',
    name: 'Fazio',
    form: 'm',
    town: 'Ponteluce',
  },
  general: {
    personality: 'general',
    label: 'the General',
    manner: 'A soldier for every field, and a long look at weak neighbours.',
    name: 'Selvaggia',
    form: 'f',
    town: 'Roccaventosa',
  },
  builder: {
    personality: 'builder',
    label: 'the Builder',
    manner: 'Palace and cathedral before anything else.',
    name: 'Taddeo',
    form: 'm',
    town: 'Pietrargenta',
  },
  miser: {
    personality: 'miser',
    label: 'the Miser',
    manner: 'High taxes, a heavy chest, and very little spent.',
    name: 'Orsola',
    form: 'f',
    town: 'Sassoreale',
  },
  saint: {
    personality: 'saint',
    label: 'the Saint',
    manner: 'Mild justice, generous bread, and a growing clergy.',
    name: 'Benedetto',
    form: 'm',
    town: 'Lucemara',
  },
};

export const PERSONALITIES: readonly Personality[] = [
  'merchant',
  'general',
  'builder',
  'miser',
  'saint',
];
