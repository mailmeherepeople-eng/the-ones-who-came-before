import { Inv, ITEMS } from '../inventory.js';
import { Save } from '../save.js';
import { S } from '../strings.js';
import { SFX } from '../audio.js';
import { iconFor } from './icons.js';

export function syncEquipment(G) {
  const tool = Inv.equippedTool();
  const show = tool ?? (Inv.selectedTool() ? null : Inv.contents('player')[0]?.id);
  G.player.equip(show ? ITEMS[show]?.equip : null);
  G.hud.setSatchel(Inv.totalOfKind('player', 'harvest'), Inv.total('player') > 0);
}

// One persistent control, visible only while the player can use equipment.
export function installEquipment(G) {
  const el = document.createElement('div');
  el.id = 'equipment-control';
  el.hidden = true;
  el.innerHTML = '<button class="equipment-toggle" type="button"><span class="equipment-icon" aria-hidden="true"></span><span><strong></strong><small></small></span><kbd>Q</kbd></button><select></select>';
  const button = el.querySelector('button'), select = el.querySelector('select');
  select.setAttribute('aria-label', S.onboarding.selectTool);
  G.hud.root.append(el);
  let signature = '', displaySignature = '';
  const allowed = () => Save.data.act === 1 && G.mode === 'ground' && G.input.enabled && !G.hud.root.dataset.modal && !G.player._fpsOn;
  const toggle = () => {
    if (!allowed() || !Inv.toggleTool()) return;
    syncEquipment(G);
    SFX.blip();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) button.animate([
      {transform:'scale(.94)'}, {transform:'scale(1.035)'}, {transform:'scale(1)'}
    ], {duration:220});
  };
  button.addEventListener('click', toggle);
  select.addEventListener('change', () => {
    if (allowed()) { Inv.selectTool(select.value); syncEquipment(G); }
  });
  return {
    update(inp) {
      const id = Inv.selectedTool();
      el.hidden = !allowed() || !id;
      if (el.hidden) return;
      if (inp.equip) toggle();
      const tools = Inv.contents('player').filter(e => ITEMS[e.id].kind === 'tool');
      const next = tools.map(e=>e.id).join(',');
      if (next !== signature) {
        signature = next;
        select.replaceChildren(...tools.map(e => new Option(S.items[e.id],e.id)));
      }
      select.hidden = tools.length < 2;
      select.value = id;
      const equipped = !!Inv.equippedTool();
      const display = `${id}:${equipped}:${G.input.isTouch}`;
      if (display === displaySignature) return;
      displaySignature = display;
      el.querySelector('.equipment-icon').innerHTML = iconFor(ITEMS[id].emoji) ?? ITEMS[id].emoji;
      el.querySelector('strong').textContent = S.items[id];
      el.querySelector('small').textContent = equipped ? S.onboarding.putAway : S.onboarding.equipAction;
      button.setAttribute('aria-pressed', String(equipped));
      button.title = equipped ? S.onboarding.putAway : S.onboarding.equipAction;
      el.querySelector('kbd').hidden = G.input.isTouch;
    },
  };
}
