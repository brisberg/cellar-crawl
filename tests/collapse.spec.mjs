import { test, expect } from './helpers/harlowe.mjs';
import {
  TO_STOREROOM, STOREROOM_TO_JUNCTION, PUMP_ROOM, DRAIN_CISTERN, TO_HEART_DOOR,
  setDials, toHeartChamber, ESCAPE_ROUTE,
} from './helpers/routes.mjs';

const movesLeft = async (game) => (await game.state()).moves_left;

test('escape: moves tick down, inventory is free, undo is gone', async ({ game }) => {
  await game.start();
  await toHeartChamber(game);
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

  await game.play(...ESCAPE_ROUTE.slice(1));
  expect(await movesLeft(game), 'perfect shortcut costs 6 moves').toBe(4);
  expect(await game.canUndo()).toBe(false);

  await game.click('Escape');
  expect(await game.text()).toContain('You Win!');
});

test('the wine-cellar bolt can still be drawn during the escape', async ({ game }) => {
  // Soft-lock check (Layout.md, Wine Cellar): skipping the bolt on the way in is not fatal.
  await game.start();
  await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION, ...PUMP_ROOM, ...DRAIN_CISTERN);
  // Learn clue #3 by reading it in the test, not by visiting: go straight to the door.
  await game.play(...TO_HEART_DOOR);
  await setDials(game);
  await game.play('Push the door', 'Open the door.', 'Take the Heartstone');
  expect((await game.state()).wine_door_bolted).toBe(true);

  await game.play('Flee', 'Back down the tunnel', 'Back under the portcullis', 'Climb the stairs', 'drain shaft');
  await game.click('Draw the bolt');
  await game.click('door');
  expect(await movesLeft(game)).toBe(4);
  await game.click('Escape');
  expect(await game.text()).toContain('You Win!');
});

test('the crawlway caves in when the Heartstone is taken', async ({ game }) => {
  await game.start();
  await toHeartChamber(game);
  await game.play('Take the Heartstone', 'Flee', 'Back down the tunnel', 'Back under the portcullis', 'Climb the stairs', 'Back to the cavern');
  const text = await game.text();
  expect(text).toContain('The crawlway behind you has collapsed into a wall of rubble.');
  expect(text).not.toContain('Climb back up the crawlway');

  // The other end, via the shortcut, is blocked too.
  await game.play('brick archway', 'drain shaft', 'door', 'door');
  expect(await game.text()).toContain('Rubble chokes the passage behind the broken wall.');
});

test('dawdling ends in Buried, which stays put', async ({ game }) => {
  await game.start();
  await toHeartChamber(game);
  await game.click('Take the Heartstone');

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

// Budget tuning (docs/Layout.md, The collapse): with $collapse_budget = 10 and a 6-move perfect
// escape, the worst single mistake is forgiven and two mistakes are not. If you change the budget
// or the map, these tests tell you what difficulty you've changed to.
const MAZE_DETOUR = ['Take the left tunnel', 'Press on', 'Squeeze through the crack']; // +3, worst wrong turn
const JUNCTION_DETOUR = ['Back to the cavern', 'brick archway']; // +2

test('budget: the worst single mistake is survivable', async ({ game }) => {
  await game.start();
  await toHeartChamber(game);
  await game.play('Take the Heartstone', 'Flee', 'Back down the tunnel', ...MAZE_DETOUR, ...ESCAPE_ROUTE.slice(2));
  expect(await movesLeft(game)).toBe(1);
  await game.click('Escape');
  expect(await game.text()).toContain('You Win!');
});

test('budget: two mistakes bury you', async ({ game }) => {
  await game.start();
  await toHeartChamber(game);
  await game.play('Take the Heartstone', 'Flee', 'Back down the tunnel', ...MAZE_DETOUR,
    'Back under the portcullis', 'Climb the stairs', ...JUNCTION_DETOUR, 'drain shaft', 'door');
  expect(await game.text()).toContain('The Dark Cellar has claimed you.');
});
