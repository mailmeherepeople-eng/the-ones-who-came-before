// The hunt task with the bow in hand, at the training post: what a phone shows
// while aiming, drawing and walking.
export default async (r) => {
  await r.saveFile('game/tools/rig/saves/hunt.json');
  await r.go('/?dev&tp=81,36');
  await r.tapText('Continue');
  await r.until(() => window.G && G.mode === 'ground', 30000);
  await r.clearCards();
  await r.wait(2000);
  await r.shot('arrive');
  await r.until(() => document.body.classList.contains('bow-up') || document.body.classList.contains('move-locked'), 20000).catch(() => {});
  await r.clearCards();
  await r.wait(1500);
  await r.shot('aiming');
  const draw = '.bow-draw';
  if (await r.exists(draw)) {
    await r.press(draw, 1500, { x: -80, y: -20 });
    await r.wait(800);
    await r.shot('after-shot');
  } else console.log('no draw button found');
  console.log(r.device, await r.eval(() => ({ cls: document.body.className, yaw: G.player.yaw.toFixed(2) })));
};
