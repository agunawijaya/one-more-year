/**
 * Hot-seat: the velvet curtain between two rulers. It shows only the next
 * ruler's coat of arms and town, and nothing of anyone's numbers: the year
 * screen is built after "Ready", never before, so the page holds nothing
 * private while the device changes hands (the end-to-end suite checks it).
 */
import type { Realm } from '../../engine/state.ts';
import { titleName } from '../../content/names.ts';
import { armsSvg } from '../../ui/heraldry-svg.ts';
import { el, svgNode } from '../../ui/dom.ts';

export function showCurtain(
  host: HTMLElement,
  realm: Realm,
  year: number,
  onReady: () => void,
): () => void {
  const ready = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'ready' },
    'Ready',
  );
  const curtain = el(
    'div',
    {
      class: 'cf-curtain',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'cf-curtain-title',
      'data-seat': realm.seat,
    },
    el('div', { class: 'cf-curtain__drape cf-curtain__drape--left', 'aria-hidden': 'true' }),
    el('div', { class: 'cf-curtain__drape cf-curtain__drape--right', 'aria-hidden': 'true' }),
    el(
      'div',
      { class: 'cf-curtain__card' },
      svgNode(armsSvg(realm.arms, { width: 132, label: `Arms of ${realm.city}` })),
      el('p', { class: 'cf-curtain__eyebrow' }, `Anno ${year}`),
      el(
        'h2',
        { id: 'cf-curtain-title', class: 'cf-curtain__title' },
        `${titleName(realm.title, realm.ruler.form)} ${realm.ruler.name} of ${realm.city}`,
      ),
      el(
        'p',
        { class: 'cf-curtain__line' },
        'Pass the device over. Nothing of the realm is shown until you are ready.',
      ),
      ready,
    ),
  );
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    curtain.remove();
  };
  ready.addEventListener('click', () => {
    close();
    onReady();
  });
  host.append(curtain);
  ready.focus();
  return close;
}
