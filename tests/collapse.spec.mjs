import { test, expect } from './helpers/harlowe.mjs';

const TO_HEARTROOM = [
  'door', 'rusty key', 'door',
  'There is a hammer resting on the table.', 'bricks', 'hammer',
  'dark passage', 'lantern', 'Follow it.', 'Continue.', 'Open the door.',
];

const movesLeft = async (game) => (await game.state()).moves_left;

test('escape: moves tick down, inventory is free, undo is gone', async ({ game }) => {
  await game.start();
  await game.play(...TO_HEARTROOM);
  expect(await game.canUndo(), 'undo available before the theft').toBe(true);

  await game.click('Take the Heartstone');
  expect(await game.canUndo(), 'undo hidden immediately after the theft').toBe(false);

  await game.click('Flee');
  expect(await movesLeft(game)).toBe(9);
  expect(await game.text()).toContain('Moves left: 9');
  await expect(game.page.locator('tw-meter')).toBeVisible();
  expect(await game.canUndo()).toBe(false);

  await game.play('inventory', 'Return');
  expect(await movesLeft(game), 'inventory + Return cost nothing').toBe(9);

  await game.play('Escape', 'Escape', 'Escape', 'door');
  expect(await movesLeft(game)).toBe(5);
  expect(await game.canUndo()).toBe(false);

  await game.click('Escape');
  expect(await game.text()).toContain('You Win!');
});

test('dawdling ends in Buried, which stays put', async ({ game }) => {
  await game.start();
  await game.play(...TO_HEARTROOM, 'Take the Heartstone');

  for (let move = 1; move <= 10; move++) {
    await game.click(move % 2 ? 'Flee' : 'Open the door.');
    expect(await movesLeft(game)).toBe(10 - move);
  }
  expect(await game.text()).toContain("Get out now, or you're buried.");

  await game.click('Flee'); // 11th move
  expect(await game.text()).toContain('The Dark Cellar has claimed you.');
  // Regression: Buried used to (goto:) itself forever. The fixture's idle-render check
  // enforces this after every test; asserting here too makes the intent explicit.
  expect(await game.rendersWhileIdle()).toBe(0);
});
