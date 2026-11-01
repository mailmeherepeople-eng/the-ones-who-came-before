// The title screen, then a new game: the wake in the cave and the first lesson.
export default async (r) => {
  await r.go('/');
  await r.wait(2500);
  await r.shot('title');
  await r.tapText('Begin');
  await r.wait(2500);
  await r.shot('after-begin');
};
