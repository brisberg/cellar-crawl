import { test, expect, PROD_BUILD_URL } from './helpers/harlowe.mjs';

// The critical path from Entrance to the win, with state checks at each milestone.
const TO_HEARTROOM = [
  'door', 'rusty key', // unlock (use dialog)
  'door', // -> Storeroom
  'There is a hammer resting on the table.',
  'bricks', 'hammer',
  'dark passage', 'lantern',
  'Follow it.', 'Continue.', 'Open the door.',
];

test('critical path: Entrance to win', async ({ game }) => {
  await game.start();
  expect((await game.state()).where).toEqual({
    lantern: 'player', 'rusty-key': 'player', hammer: 'Storeroom', heartstone: 'Heartroom',
  });

  await game.play(...TO_HEARTROOM);
  let state = await game.state();
  expect(state.where).toMatchObject({ 'rusty-key': 'gone', hammer: 'player' });
  expect(state).toMatchObject({ door_locked: false, wall_intact: false, lantern_lit: true });

  await game.play('Take the Heartstone', 'Flee', 'Escape', 'Escape', 'Escape', 'door');
  expect(await game.text()).toContain('Escape with the Heartstone!');
  expect((await game.state()).where.heartstone).toBe('player');

  await game.click('Escape');
  expect(await game.text()).toContain('You Win!');
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
