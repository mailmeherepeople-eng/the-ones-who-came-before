// The first activity is independently resumable. Progress counts food picked,
// not food currently held, so depositing early can never reset the objective.
import { Save } from '../save.js';
import { Inv } from '../inventory.js';
import { S } from '../strings.js';
import { YEARS } from '../constants.js';
import { SITES } from '../world/terrain.js';
import { teach } from '../codex.js';
import { objectiveCue, setBeacon, nearestSite, propAnchor } from '../ui/objective.js';
import { FX } from '../fx/fx.js';

export async function gatherWithBasket(G, { berryProps, chestAt, takeFromChest, putInStore, returnToChest, syncEquip, until }) {
  if (Save.getRecord('gathered')) return;
  let state = Save.activity('gather');
  if (!state.intro) {
    await G.hud.card([S.revision.gatherIntro, Inv.has('player','basket') ? S.onboarding.gatherReady : S.revision.gatherSteps]);
    Save.setActivity('gather', { intro: true, picked: state.picked ?? 0 });
  }
  if (!state.harvested) {
    if (!Inv.has('player', 'basket')) await takeFromChest(G, 'basket', S.revision.gatherTake);
    teach(G, 'band');
    const used = new Set(Save.activity('gather').sites ?? []);
    const sites = SITES.berries.slice(0, 5);
    const remaining = new Set(sites.filter(b => !used.has(`${b.x},${b.z}`)));
    const nextBush = () => nearestSite(G, [...remaining].map(b => propAnchor(berryProps.get(b))));
    for (const b of sites) if (!remaining.has(b)) berryProps.get(b)?.setBerries(false);
    objectiveCue(G, S.revision.gatherPick(Save.activity('gather').picked ?? 0), nextBush());
    for (const b of remaining) G.interactables.push({
      id: `berry-${b.x}`, ...propAnchor(berryProps.get(b)), r: 2.4, prompt: '🫐', label: S.act1.pickBerry, enabled: true,
      onInteract(self) {
        if (!Inv.has('player', 'basket')) {
          G.hud.toast(S.revision.needBasket);
          objectiveCue(G, S.revision.gatherTake, chestAt);
          return;
        }
        if (Inv.equippedTool() !== 'basket') {
          G.hud.toast(G.input.isTouch ? S.onboarding.equipNeededTouch : S.onboarding.equipNeeded);
          return;
        }
        self.enabled = false; remaining.delete(b); used.add(`${b.x},${b.z}`);
        berryProps.get(b)?.setBerries(false);
        Inv.add('player', 'berry', 3);
        Save.setActivity('gather', { picked: (Save.activity('gather').picked ?? 0) + 3, sites: [...used] });
        syncEquip(G);
        FX.floaties(propAnchor(berryProps.get(b),0.65), {color:0xd8503c,count:7,size:0.1,life:1.2});
        objectiveCue(G, S.revision.gatherPick(Save.activity('gather').picked), nextBush());
      },
    });
    await until(() => (Save.activity('gather').picked ?? 0) >= 12);
    G.interactables = G.interactables.filter(o => !String(o.id).startsWith('berry-'));
    setBeacon(G, null);
    Save.setActivity('gather', { harvested: true });
  }
  if (!Save.activity('gather').deposited) {
    await putInStore(G, 'berry', S.revision.gatherStore, S.act1.depositBerriesDone);
    Save.setActivity('gather', { deposited: true });
  }
  await returnToChest(G, 'basket', S.revision.gatherReturn, S.act1.returnBasketDone);
  await G.hud.narrator(S.act1.huntersGatherers);
  teach(G, 'huntGather');
  Save.addRecord({id:'gathered',type:'camp',pos:{...SITES.campA},made:YEARS.SCENE_A_YEAR,data:{label:'gather'}});
}
