/**
 * The catalog as the scripts see it: the planned placeholders from the Hall
 * plus every built simulation's games/<id>/manifest.ts, a built manifest
 * replacing the placeholder with the same id (as the Hall's registry does).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMING_SOON } from '../hall/src/data/coming-soon.ts';
// The root package does not depend on the kit, so its source is imported directly.
import type { SimManifest } from '../packages/kit/src/contract.ts';
import { REPO_ROOT } from './check/files.ts';

async function builtManifests(): Promise<SimManifest[]> {
  const gamesDir = join(REPO_ROOT, 'games');
  if (!existsSync(gamesDir)) return [];
  const found: SimManifest[] = [];
  for (const id of readdirSync(gamesDir).sort()) {
    const file = join(gamesDir, id, 'manifest.ts');
    if (!existsSync(file)) continue;
    const module = (await import(pathToFileURL(file).href)) as { manifest?: SimManifest };
    if (module.manifest) found.push(module.manifest);
    else console.warn(`games/${id}/manifest.ts does not export a manifest; skipped`);
  }
  return found;
}

/** Same order as the Hall: playable worlds first, then planned ones. */
export async function catalogManifests(): Promise<SimManifest[]> {
  const byId = new Map<string, SimManifest>();
  for (const manifest of [...COMING_SOON, ...(await builtManifests())]) {
    byId.set(manifest.id, manifest);
  }
  return [...byId.values()].sort(
    (a, b) => Number(b.status === 'playable') - Number(a.status === 'playable'),
  );
}
