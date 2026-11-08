/**
 * What the picture needs from a realm: its numbers, as the city plan reads
 * them. One place, so the fresco and the ledger can never disagree.
 */
import type { Realm } from '../engine/state.ts';
import type { CityNumbers } from './layout.ts';

export function cityNumbersOf(realm: Realm): CityNumbers {
  const opening = realm.opening ?? realm.last?.opening ?? null;
  return {
    town: realm.city,
    land: realm.land,
    serfs: realm.people.serfs,
    soldiers: realm.people.soldiers,
    merchants: realm.people.merchants,
    nobles: realm.people.nobles,
    clergy: realm.people.clergy,
    markets: realm.holdings.markets,
    mills: realm.holdings.mills,
    palace: realm.holdings.palace,
    cathedral: realm.holdings.cathedral,
    grain: realm.grain,
    worked: opening?.worked ?? realm.land,
    weather: opening?.weather ?? 3,
  };
}
