// A new game into the cave: the cards, the wake, the first lessons by touch.
export default async (r) => {
  await r.go('/?dev');
  await r.wait(1500);
  await r.tapText('Begin');
  // tap through the opening cards until the rise hint shows
  for (let i = 0; i < 12; i++) {
    if (await r.page.getByText('Tap to rise').first().isVisible().catch(() => false)) break;
    const btn = r.page.locator('.card-overlay button:visible').first();
    if (await btn.count()) await r.tap('.card-overlay button:visible');
    await r.wait(1200);
  }
  await r.waitText('Tap to rise');
  await r.shot('wake');
  await r.tap({ x: r.vp.width / 2, y: r.vp.height / 2 });
  await r.until(() => document.querySelector('.training-card h2')?.textContent);
  await r.wait(1500);
  await r.shot('lesson-look');
  await r.look(160, 0, 600);
  await r.wait(2500);
  await r.shot('lesson-walk');
  await r.joy(0, -1, 2500);
  await r.wait(1000);
  await r.shot('after-walk');
  console.log(r.device, await r.eval(() => ({ touch: G.input.isTouch, coarse: matchMedia('(pointer: coarse)').matches, joy: getComputedStyle(document.getElementById('joystick')).display })));
};
