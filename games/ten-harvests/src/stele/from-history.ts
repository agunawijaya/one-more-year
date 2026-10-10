/**
 * What goes on a term's stele, read from the run's recorded years: the
 * harvest, the store, the rats, the fever, the newcomers and the hungry of
 * each year, in the order they were lived.
 */
import { formatNumber, numberOf, type TurnRecord } from '@one-more-year/kit';
import type { Decree } from '../engine/state.ts';
import type { StelePlan, YearMark } from './relief.ts';

const sum = (record: TurnRecord<Decree>, kind: string, field: string): number =>
  record.events.filter((e) => e.kind === kind).reduce((total, e) => total + numberOf(e, field), 0);

export function yearMarks(records: readonly TurnRecord<Decree>[], firstYear: number): YearMark[] {
  const fullest = Math.max(1, ...records.map((r) => r.signals.grain ?? 0));
  return records.map((record) => {
    const harvest = record.events.find((e) => e.kind === 'harvest');
    return {
      year: record.turn - firstYear + 1,
      yieldPerAcre: harvest && numberOf(harvest, 'acres') > 0 ? numberOf(harvest, 'yield') : 0,
      storeShare: (record.signals.grain ?? 0) / fullest,
      ratsAte: sum(record, 'rats', 'eaten'),
      feverLost: sum(record, 'fever', 'lost'),
      newcomers: sum(record, 'newcomers', 'people'),
      hungry: sum(record, 'hunger', 'hungry') + sum(record, 'deposed', 'hungry'),
    };
  });
}

export function stelePlan(
  records: readonly TurnRecord<Decree>[],
  firstYear: number,
  epithet: string,
  verdict: string,
  final: { people: number; acres: number },
  registers = 10,
): StelePlan {
  const years = records.length;
  return {
    epithet,
    verdict,
    footnote: `${years} ${years === 1 ? 'year' : 'years'} on the river · ${formatNumber(final.people)} people · ${formatNumber(final.acres)} acres`,
    years: yearMarks(records, firstYear),
    registers,
  };
}
