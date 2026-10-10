/**
 * Sharing a finished run: a short text for the clipboard and an SVG card to
 * download. Both are built from the chronicle alone, so neither can carry a
 * name, a date of birth or anything else personal; hot-seat names are left
 * out on purpose. Nothing is uploaded anywhere: the player decides where the
 * text or the file goes.
 */

/** Copies text to the clipboard; resolves false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permissions or an insecure context: try the old way below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only fallback some browsers offer
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

/** Offers an SVG document as a file download. */
export function downloadSvg(svg: string, fileName: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name from a title: "Pond #3" → "one-more-year-pond-3.svg". */
export function shareFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `one-more-year-${slug || 'chronicle'}.svg`;
}
