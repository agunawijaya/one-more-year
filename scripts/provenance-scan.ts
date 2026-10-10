/**
 * Provenance scan (hard rule 1), run as
 *
 *   pnpm provenance <folder with the original listings>
 *
 * The originals never enter the repo, and neither does a deny-list of their
 * phrases (that list would itself be a copy). Instead this script reads the
 * listings at run time, pulls out every quoted string of 20 or more
 * characters, and fails if any of them turns up in the Hall, the kit or a
 * simulation's source. Comparison ignores case, punctuation and spacing, so
 * a phrase cannot slip through by changing its capitals or its line breaks.
 *
 * One kind of phrase is allowed: an original's own title, registered by a
 * manifest as `inspiredBy.originalTitle`, and only in the files where hard
 * rule 2 lets it appear (the manifests and the About page).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, isText, repoFiles } from './check/files.ts';
import { catalogManifests } from './manifests.ts';

const MIN_LENGTH = 20;
const LISTING = /\.(bas|txt|lst)$/i;
const SCANNED = /^(hall\/(src|index\.html)|packages\/[^/]+\/src|games\/[^/]+\/(src|manifest\.ts))/;
const TITLES_ALLOWED_IN =
  /^(hall\/src\/data\/coming-soon\.ts|hall\/src\/routes\/about\.ts|games\/[^/]+\/manifest\.ts)$/;

/** Quoted strings from a BASIC listing, at least MIN_LENGTH characters long once normalised. */
export function extractPhrases(listing: string): string[] {
  const phrases = new Set<string>();
  for (const match of listing.matchAll(/"([^"\n]*)"/g)) {
    const phrase = normalise(match[1] ?? '');
    if (phrase.length >= MIN_LENGTH) phrases.add(phrase);
  }
  return [...phrases];
}

/** Lower case, letters and digits only, single spaces: the form both sides are compared in. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function listingsIn(folder: string): string[] {
  return readdirSync(folder)
    .map((name) => join(folder, name))
    .filter((path) => statSync(path).isFile() && LISTING.test(path));
}

async function main(): Promise<void> {
  const folder = process.argv[2];
  if (!folder || !existsSync(folder)) {
    console.error('Usage: pnpm provenance <folder with the original listings>');
    process.exitCode = 2;
    return;
  }
  const listings = listingsIn(folder);
  const titles = new Set(
    (await catalogManifests()).map((manifest) => normalise(manifest.inspiredBy.originalTitle)),
  );
  const phrases = listings.flatMap((path) => extractPhrases(readFileSync(path, 'utf8')));
  const sources = repoFiles().filter((file) => SCANNED.test(file) && isText(file));

  let hits = 0;
  for (const file of sources) {
    const text = normalise(readFileSync(join(REPO_ROOT, file), 'utf8'));
    for (const phrase of phrases) {
      if (!text.includes(phrase)) continue;
      if (titles.has(phrase) && TITLES_ALLOWED_IN.test(file)) continue;
      hits++;
      // Report the length only: printing the phrase would put it in CI logs.
      console.error(`✗ ${file}: contains a ${phrase.length}-character phrase from an original`);
    }
  }
  console.warn(
    `Scanned ${sources.length} source files against ${phrases.length} phrases from ${listings.length} listings.`,
  );
  if (hits > 0) process.exitCode = 1;
  else console.warn('✓ Provenance: no phrase from the originals found');
}

await main();
