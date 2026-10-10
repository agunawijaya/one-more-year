/**
 * Zero raster (hard rule 3): every picture in the collection is drawn by
 * code. No image file may sit anywhere in the repo except docs/media/, where
 * screenshots document the work, and no source may inline one as a data URL.
 */
import { isShippedSource, isText, matchingLines, repoFiles, type Problem } from './files.ts';

const RASTER_FILE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|tiff?|heic)$/i;
const INLINE_RASTER = /data:image\/(png|jpe?g|gif|webp|avif|bmp)[;,]/i;

export function checkRaster(files = repoFiles()): Problem[] {
  const problems: Problem[] = [];
  for (const file of files) {
    if (RASTER_FILE.test(file) && !file.startsWith('docs/media/')) {
      problems.push({ file, message: 'raster image outside docs/media/' });
    } else if (isShippedSource(file) && isText(file)) {
      for (const hit of matchingLines(file, INLINE_RASTER)) {
        problems.push({ file, line: hit.line, message: 'inline raster data URL' });
      }
    }
  }
  return problems;
}
