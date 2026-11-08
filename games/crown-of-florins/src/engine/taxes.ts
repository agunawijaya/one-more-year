/**
 * Taxes and justice, exactly as the 1978 program reckoned them.
 *
 * Every tax shrinks a shared "willingness to pay" of 150 − (customs + sales
 * + wealth), at least 1, so raising one tax lowers what the others bring in.
 * Each tax has its own base, built from the classes who pay it and from
 * prosperity, then takes its rate. Justice brings in fines from harsh
 * courts and costs money in very fair ones, scaled by the ruler's title.
 */
import type { People, Taxes } from './state.ts';

export interface Revenue {
  customs: number;
  sales: number;
  wealth: number;
  justice: number;
  total: number;
}

/** original: 150 less the three taxes, at least 1, as a share. */
export function willingness(rates: Pick<Taxes, 'customs' | 'sales' | 'wealth'>): number {
  return Math.max(1, 150 - rates.customs - rates.sales - rates.wealth) / 100;
}

/** original: the justice line of the ledger: (300 × level − 500) × title. */
export function justiceIncome(justice: number, title: number): number {
  return (justice * 300 - 500) * title;
}

/** `harbour` multiplies customs in a port scenario (1 in the 1978 valley). */
export function revenueFor(
  people: People,
  prosperity: number,
  rates: Taxes,
  title: number,
  harbour = 1,
): Revenue {
  const share = willingness(rates);
  const { nobles, clergy, merchants } = people;
  const customsBase = (nobles * 180 + clergy * 75 + merchants * 20) * share + prosperity * 100;
  const salesBase =
    (nobles * 50 + merchants * 25 + prosperity * 10) * share * ((5 - rates.justice) / 2);
  const wealthBase = nobles * 250 + prosperity * 20 + 10 * rates.justice * nobles * share;
  const customs = Math.floor((customsBase * rates.customs * harbour) / 100);
  const sales = Math.floor((salesBase * rates.sales) / 100);
  const wealth = Math.floor((wealthBase * rates.wealth) / 100);
  const justice = justiceIncome(rates.justice, title);
  return { customs, sales, wealth, justice, total: customs + sales + wealth + justice };
}
