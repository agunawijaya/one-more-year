/**
 * Finds the simulations in games/<id>/. Each manifest is read at start-up
 * (it is small data); each module stays a separate chunk that loads only
 * when its world is opened or its demo comes into view.
 *
 * Vite resolves these globs at build time, so adding a simulation is a
 * matter of adding its folder.
 */
import type { SimManifest, SimModule } from '@one-more-year/kit';
import type { DiscoveredSim } from './registry.ts';

const manifests = import.meta.glob<SimManifest>('../../../games/*/manifest.ts', {
  eager: true,
  import: 'manifest',
});
const modules = import.meta.glob<SimModule>('../../../games/*/src/index.ts', { import: 'default' });

export function discoverSims(): DiscoveredSim[] {
  const found: DiscoveredSim[] = [];
  for (const [path, manifest] of Object.entries(manifests)) {
    const load = modules[path.replace(/manifest\.ts$/, 'src/index.ts')];
    if (load) found.push({ manifest, load });
    else console.warn(`${path} has no src/index.ts module; it is listed but cannot be opened`);
  }
  return found;
}
