/**
 * The simulations that are planned but not built yet. Each one is a full
 * manifest with status 'coming-soon', so every theme can draw it properly
 * (a blank plate with a pencilled emblem, a dark tile, an empty dome).
 *
 * When a simulation's own prompt creates games/<id>/manifest.ts, that file
 * takes over and the placeholder here is ignored (the registry prefers a
 * discovered manifest with the same id). Titles live only in manifests, so
 * a rename is a one-file change. A built simulation's entry points at its
 * own manifest, which keeps the catalog order; the other titles are still
 * provisional, as are their taglines, teasers, accents and signals, until
 * each simulation's prompt finalises them.
 */
import type { SimManifest } from '@one-more-year/kit';
import { manifest as tenHarvests } from '../../../games/ten-harvests/manifest.ts';
import { manifest as crownOfFlorins } from '../../../games/crown-of-florins/manifest.ts';

/** Built: the placeholder is replaced by the simulation's own manifest. */
export const TEN_HARVESTS: SimManifest = tenHarvests;

/** Built: the placeholder is replaced by the simulation's own manifest. */
export const CROWN_OF_FLORINS: SimManifest = crownOfFlorins;

/** In catalog order. */
export const COMING_SOON: readonly SimManifest[] = [TEN_HARVESTS, CROWN_OF_FLORINS];
