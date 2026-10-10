/**
 * Provenance (hard rule 1): the original listings live outside the repo and
 * are read-only. No file in the repo may import from, read or point a build at
 * that folder, and no listing-like file (BASIC source) may be copied in.
 *
 * Text that resembles the originals is caught separately by
 * scripts/provenance-scan.ts, which reads the originals at run time so that
 * none of their phrases ever has to be stored here.
 */
import { isText, matchingLines, repoFiles, type Problem } from './files.ts';

// Only code can import; docs and prompts may name the folder to explain the rule.
const CODE_FILE = /\.(ts|js|mjs|cjs|html|json|css)$/;
const REFERENCE_PATH = /simulation[\\/]+src|[A-Za-z]:[\\/]+Projects[\\/]+simulation[\\/]+src/i;
const BASIC_LISTING = /\.(bas|bas\.txt)$/i;
// This rule's own source necessarily spells out the pattern it hunts for.
const SELF = new Set(['scripts/check/reference.ts', 'scripts/provenance-scan.ts']);

export function checkReferenceFolder(files = repoFiles()): Problem[] {
  const problems: Problem[] = [];
  for (const file of files) {
    if (BASIC_LISTING.test(file)) {
      problems.push({ file, message: 'BASIC listing inside the repo' });
      continue;
    }
    if (SELF.has(file) || !CODE_FILE.test(file) || !isText(file)) continue;
    for (const hit of matchingLines(file, REFERENCE_PATH)) {
      problems.push({ file, line: hit.line, message: 'refers to the reference folder' });
    }
  }
  return problems;
}
