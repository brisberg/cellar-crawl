// Phone-width checks along the whole critical path (the dialog layout has its own test in use-dialog.spec.mjs).
import { test, expect } from './helpers/harlowe.mjs';
import { TO_STOREROOM, STOREROOM_TO_JUNCTION, PUMP_ROOM, DRAIN_CISTERN, TO_HEART_DOOR, toHeartChamber, ESCAPE_ROUTE } from './helpers/routes.mjs';

test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });

test('no horizontal scrolling anywhere on the critical path', async ({ game }) => {
  const overflows = [];
  game.afterClick = async (label) => {
    const width = await game.page.evaluate(() => document.documentElement.scrollWidth);
    if (width > 375) overflows.push(`${label}: ${width}px`);
  };
  await game.start();
  await game.click('inventory'); // inventory screen
  await game.click('Return');
  await toHeartChamber(game);
  await game.click('Take the Heartstone');
  await game.play(...ESCAPE_ROUTE, 'Escape'); // includes the collapse meter
  expect(overflows).toEqual([]);
});

test('dials are button-sized tap targets that do not overlap', async ({ game }) => {
  await game.start();
  await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION, ...PUMP_ROOM, ...DRAIN_CISTERN, ...TO_HEART_DOOR);
  const boxes = [];
  for (const name of ['dial1', 'dial2', 'dial3']) {
    const box = await game.passage().locator(`tw-hook[name="${name}"] tw-link`).boundingBox();
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(40);
    boxes.push(box);
  }
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].y, `dial${i + 1} below dial${i}`).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height);
  }
});
