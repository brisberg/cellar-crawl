import { test, expect, PROD_BUILD_URL } from './helpers/harlowe.mjs';
import { toHeartChamber, ESCAPE_ROUTE } from './helpers/routes.mjs';

// The critical path from docs/Layout.md, with state checks at the end of each leg.
test('critical path: Entrance to win', async ({ game }) => {
  await game.start();
  expect((await game.state()).where).toEqual({
    lantern: 'player', 'rusty-key': 'player', hammer: 'Storeroom',
    'valve-wheel': 'Pump Room', sandbag: 'Pump Room', heartstone: 'Heart Chamber',
  });

  await toHeartChamber(game);
  const state = await game.state();
  expect(state.where).toMatchObject({
    'rusty-key': 'gone', hammer: 'player', 'valve-wheel': 'gone', sandbag: 'Weighing Room',
  });
  expect(state).toMatchObject({
    door_locked: false, wall_intact: false, lantern_lit: true, wheel_stuck: false,
    cistern_drained: true, wine_door_bolted: false, heart_door_open: true,
  });

  await game.click('Take the Heartstone');
  await game.play(...ESCAPE_ROUTE);
  expect(await game.text()).toContain('Escape with the Heartstone!');
  expect((await game.state()).where.heartstone).toBe('player');

  await game.click('Escape');
  expect(await game.text()).toContain('You Win!');

  expect(await game.analytics(), 'analytics events, in order').toEqual([
    ['Start', ''],
    ['Puzzle', 'door'], ['Hammer', 'Take'], ['Puzzle', 'bricks'], ['Puzzle', 'wheel'], ['Puzzle', 'cistern'],
    ['Puzzle', 'bolt'], ['Puzzle', 'plate'], ['Puzzle', 'dials'], ['Heartstone', 'Take'], ['Finish', 'Escape'],
  ]);
});

test('inventory lists carried items and shows descriptions', async ({ game }) => {
  await game.start();
  await game.click('inventory');
  expect(await game.text()).toMatch(/You are carrying: lantern rusty key/);

  await game.click('rusty key');
  expect(await game.text()).toContain('An old, rusted iron key.');
  await game.click('lantern');
  const text = await game.text();
  expect(text).toContain('A copper, hooded lantern');
  expect(text, 'descriptions replace, not stack').not.toContain('An old, rusted iron key.');

  await game.click('Return');
  expect(await game.text()).toContain('You stand at the bottom of a ladder');
});

test('production build loads and starts at Entrance', async ({ game }) => {
  await game.open(PROD_BUILD_URL);
  expect(await game.text()).toContain('You stand at the bottom of a ladder');
  await expect(game.page.locator('#test-state'), 'no test passages in production').toHaveCount(0);
});
