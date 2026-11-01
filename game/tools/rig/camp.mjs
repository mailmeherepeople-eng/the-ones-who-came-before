// Start at the band camp (ice age) from a save, by touch: Continue, then a look round.
// Optional: RIG_TP="x,z" teleports there first (needs ?dev).
export default async (r) => {
  await r.saveFile('game/tools/rig/saves/camp.json');
  await r.go('/?dev' + (process.env.RIG_TP ? '&tp=' + process.env.RIG_TP : ''));
  await r.wait(1500);
  await r.tapText('Continue');
  await r.until(() => window.G && G.mode === 'ground', 30000);
  await r.clearCards();
  await r.wait(1500);
  await r.shot('camp');
  await r.look(-140, 0, 500);
  await r.wait(1500);
  await r.shot('camp-turned');
};
