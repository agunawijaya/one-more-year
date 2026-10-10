/**
 * Catalog filters: by domain and by how long a sitting takes. With two
 * worlds they hardly matter; with twenty they are how a visitor finds an
 * evening's play, so every theme offers them the same way.
 */
import type { Domain, SimManifest } from '@one-more-year/kit';

export type SessionLength = 'short' | 'evening' | 'long';

export const DOMAIN_NAMES: Readonly<Record<Domain, string>> = {
  governance: 'Governance',
  economy: 'Economy',
  ecology: 'Ecology',
  society: 'Society',
  journey: 'Journey',
  physics: 'Physics',
};

export const LENGTH_NAMES: Readonly<Record<SessionLength, string>> = {
  short: 'Under 20 minutes',
  evening: 'An evening',
  long: 'A long campaign',
};

/** Which bucket a simulation's typical sitting falls in, judged by its longer end. */
export function sessionLength(manifest: SimManifest): SessionLength {
  const longest = manifest.sessionMinutes[1];
  if (longest <= 20) return 'short';
  if (longest <= 60) return 'evening';
  return 'long';
}

export interface CatalogFilter {
  domain: Domain | null;
  length: SessionLength | null;
}

export const NO_FILTER: CatalogFilter = { domain: null, length: null };

export function matchesFilter(manifest: SimManifest, filter: CatalogFilter): boolean {
  return (
    (filter.domain === null || manifest.domain === filter.domain) &&
    (filter.length === null || sessionLength(manifest) === filter.length)
  );
}

/** The domains and lengths that actually occur, so filters never offer an empty choice. */
export function filterOptions(manifests: readonly SimManifest[]): {
  domains: Domain[];
  lengths: SessionLength[];
} {
  const domains = [...new Set(manifests.map((manifest) => manifest.domain))];
  const lengths = [...new Set(manifests.map(sessionLength))];
  const order: SessionLength[] = ['short', 'evening', 'long'];
  return {
    domains: domains.sort(),
    lengths: order.filter((length) => lengths.includes(length)),
  };
}
