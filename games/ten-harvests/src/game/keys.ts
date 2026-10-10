/**
 * Acting on a key's release, and only for a press that began while we were
 * listening. Screens that skip ahead with Space or Enter use it so that a key
 * never carries over into the next screen: the Enter that ends a year must
 * not also skip it, and a Space released after the report appears must not
 * press the report's focused button.
 */
export function onKeyPress(keys: readonly string[], handler: (key: string) => void): () => void {
  let held: string | null = null;
  // A screen is often built inside the keydown that opened it; that same event then reaches this
  // listener on its way back up, so anything older than the listener is ignored.
  const since = performance.now();
  const down = (event: KeyboardEvent): void => {
    if (!keys.includes(event.key) || event.repeat || event.defaultPrevented) return;
    if (event.timeStamp < since || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    held = event.key;
  };
  const up = (event: KeyboardEvent): void => {
    if (event.key !== held) return;
    event.preventDefault();
    held = null;
    handler(event.key);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
