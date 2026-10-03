// Phase 5: listening-wall hints (storylets), chalk-mark save/load.
import { test, expect } from './helpers/harlowe.mjs';
import {
  TO_STOREROOM, STOREROOM_TO_JUNCTION, PUMP_ROOM, DRAIN_CISTERN, WINE_CELLAR, setDials, toHeartChamber,
} from './helpers/routes.mjs';

const toJunction = async (game) => {
  await game.start();
  await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION);
};

/** Listens at the Junction wall and returns the whisper. */
const listen = async (game) => {
  await game.click('Press your ear to the wall');
  return game.passage().locator('tw-hook[name="whisper"]').innerText();
};

test.describe('Listening wall', () => {
  test('whispers about the next unsolved step: wheel, drain, plate, marks', async ({ game }) => {
    await toJunction(game);
    expect(await listen(game)).toContain('iron has bitten iron');

    // Free the wheel but skip the clue mark.
    await game.play('low doorway', 'valve wheel', 'hammer', 'A sandbag slumps beneath the dripping joint.', 'Back to the cavern');
    expect(await listen(game)).toContain('waits for a wheel to turn it');

    await game.play('brick archway', 'valve stem', 'valve wheel', 'Back to the cavern');
    expect(await listen(game)).toContain('the plate hungers for weight');

    await game.play('brick archway', 'down into the dark', 'pressure plate', 'sandbag', 'Duck under the portcullis',
      'Back under the portcullis', 'Climb the stairs', 'Back to the cavern');
    expect(await listen(game), 'no marks read yet').toContain('Have you looked closely at them all?');
  });

  test('with every mark read and the plate solved, it points to the dials', async ({ game }) => {
    await toJunction(game);
    await game.play(...PUMP_ROOM, ...DRAIN_CISTERN, ...WINE_CELLAR, 'down into the dark', 'pressure plate', 'sandbag',
      'Duck under the portcullis', 'Back under the portcullis', 'Climb the stairs', 'Back to the cavern');
    expect(await listen(game), 'all marks read').toContain('Count the notches.');
  });

  test('during the collapse, it points to the way out', async ({ game }) => {
    await game.start();
    await toHeartChamber(game);
    await game.play('Take the Heartstone', 'Flee', 'Back down the tunnel', 'Back under the portcullis', 'Climb the stairs', 'Back to the cavern');
    expect(await listen(game)).toContain('Up, through the drained shaft');
  });
});

test.describe('Chalk-mark save', () => {
  test('save at the Junction, die, and load back from Buried', async ({ game }) => {
    test.setTimeout(150_000);
    await toJunction(game);
    await game.click('chalk mark');
    expect(await game.text()).toContain('you can find your way back here');

    await game.play(...PUMP_ROOM, ...DRAIN_CISTERN, ...WINE_CELLAR, 'down into the dark', 'pressure plate', 'sandbag',
      'Duck under the portcullis', 'Take the right tunnel');
    await setDials(game);
    await game.play('Push the door', 'Open the door.', 'Take the Heartstone');
    for (let move = 1; move <= 11; move++) await game.click(move % 2 ? 'Flee' : 'Open the door.');
    expect(await game.text()).toContain('The Dark Cellar has claimed you.');

    await game.click('Return to your chalk mark');
    expect(await game.text()).toContain('The crawlway opens into a wide natural cavern.');
    const state = await game.state();
    expect(state).toMatchObject({ collapsing: false, cistern_drained: false, wheel_stuck: true });
    expect(state.where.heartstone).toBe('Heart Chamber');
  });

  test('no saving during the collapse', async ({ game }) => {
    await game.start();
    await toHeartChamber(game);
    await game.play('Take the Heartstone', 'Flee', 'Back down the tunnel', 'Back under the portcullis', 'Climb the stairs', 'Back to the cavern');
    expect(await game.text()).toContain('vanished under a layer of fallen dust');
    await expect(game.passage().locator('tw-link').filter({ hasText: /^chalk mark$/ })).toHaveCount(0);
  });

  test('a new session can continue from the Entrance', async ({ game }) => {
    await game.start();
    expect(await game.text(), 'no save yet').not.toContain('Return to your chalk mark');
    await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION, 'chalk mark');

    await game.newSession();
    await game.click('Return to your chalk mark');
    expect(await game.text()).toContain('The crawlway opens into a wide natural cavern.');
    expect(await game.state()).toMatchObject({ lantern_lit: true, door_locked: false, wall_intact: false });
  });
});
