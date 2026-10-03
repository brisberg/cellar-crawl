// Per-room mechanics for the Phase 4 map (docs/Layout.md).
import { test, expect } from './helpers/harlowe.mjs';
import {
  TO_STOREROOM, STOREROOM_TO_JUNCTION, PUMP_ROOM, DRAIN_CISTERN, TO_HEART_DOOR, setDials,
} from './helpers/routes.mjs';

const toJunction = async (game) => {
  await game.start();
  await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION);
};

const toWeighingRoom = async (game) => {
  await toJunction(game);
  await game.play(...PUMP_ROOM, ...DRAIN_CISTERN, 'down into the dark');
};

test.describe('Pump Room', () => {
  test('the wheel resists anything but the hammer, which frees it', async ({ game }) => {
    await toJunction(game);
    await game.play('low doorway', 'valve wheel', 'lantern');
    expect(await game.text()).toContain('it is rusted solid to the pipe');

    await game.play('valve wheel', 'hammer');
    const text = await game.text();
    expect(text).toContain('the valve wheel drops into your hands');
    expect(text, 'spent hotspot is gone').not.toContain('is rusted onto the end of a dead pipe');

    await game.click('A sandbag slumps beneath the dripping joint.');
    await game.click('Back to the cavern');
    expect((await game.state()).where).toMatchObject({ 'valve-wheel': 'player', sandbag: 'player' });
  });
});

test.describe('Clue marks ($reveal)', () => {
  test('a mark is hidden until clicked, then stays revealed on return', async ({ game }) => {
    await toJunction(game);
    await game.click('low doorway');
    let text = await game.text();
    expect(text).toContain('Scratched into the pump housing is a mark.');
    expect(text).not.toContain('a single notch beside a wavy line');

    await game.click('mark');
    expect(await game.text()).toContain('is a mark: a single notch beside a wavy line.');

    await game.play('Back to the cavern', 'low doorway');
    text = await game.text();
    expect(text, 'already inspected: rendered expanded').toContain('is a mark: a single notch beside a wavy line.');
    const link = game.passage().locator('tw-link').filter({ hasText: /^mark$/ });
    await expect(link, 'no link once inspected').toHaveCount(0);
    expect((await game.state()).inspected).toEqual(['pump-mark']);
  });
});

test.describe('Cistern', () => {
  test('flooded: no way on, and only the valve wheel fits the stem', async ({ game }) => {
    await toJunction(game);
    await game.click('brick archway');
    let text = await game.text();
    expect(text).toContain('Black water fills this vaulted brick tank');
    expect(text).not.toContain('down into the dark');
    expect(text).not.toContain('drain shaft');

    await game.play('valve stem', 'hammer');
    expect(await game.text()).toContain("That doesn't fit the square stem.");
  });

  test('the valve wheel drains it, revealing both exits and clue #2', async ({ game }) => {
    await toJunction(game);
    await game.play(...PUMP_ROOM, ...DRAIN_CISTERN);
    const text = await game.text();
    expect(text).toContain('the water drains away');
    expect(text).toContain('two notches beside a branching root');
    expect(text).toContain('down into the dark');
    expect(text).toContain('drain shaft');

    await game.click('Back to the cavern');
    expect((await game.state()).where['valve-wheel'], 'wheel is consumed').toBe('gone');
  });
});

test.describe('Wine Cellar', () => {
  test('the bolt opens a shortcut to the Entrance in both directions', async ({ game }) => {
    await game.start();
    expect(await game.text()).toContain('A heavy door on the far wall is bolted from the other side.');

    await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION, ...PUMP_ROOM, ...DRAIN_CISTERN);
    await game.click('drain shaft');
    await game.click("vintner's mark");
    expect(await game.text()).toContain('three notches beside a small flame');
    await game.click('Draw the bolt');
    expect(await game.text()).toContain('The heavy door at the far end stands unbolted.');

    await game.click('door');
    expect(await game.text()).toContain('You stand at the bottom of a ladder');
    await game.click('heavy door');
    expect(await game.text()).toContain('vaulted wine cellar');
  });
});

test.describe('Weighing Room', () => {
  test('a light item is rejected and kept', async ({ game }) => {
    await toWeighingRoom(game);
    await game.play('pressure plate', 'lantern');
    expect(await game.text()).toContain('It needs something heavier.');
    expect((await game.state()).where.lantern).toBe('player');
    expect(await game.text()).not.toContain('Duck under the portcullis');
  });

  test('a heavy item raises the portcullis; taking it back drops it', async ({ game }) => {
    await toWeighingRoom(game);
    await game.play('pressure plate', 'sandbag');
    let text = await game.text();
    expect(text).toContain('the portcullis grinds upward');
    expect(text).toContain('Duck under the portcullis');

    await game.click('Take back the sandbag');
    text = await game.text();
    expect(text).toContain('the portcullis crashes down');
    expect(text).not.toContain('Duck under the portcullis');
  });

  test('the hammer works too (soft-lock check: two valid weights)', async ({ game }) => {
    await toWeighingRoom(game);
    await game.play('pressure plate', 'hammer', 'Duck under the portcullis');
    expect(await game.text()).toContain('the passage splits into rough-cut tunnels');
    expect((await game.state()).where.hammer).toBe('Weighing Room');
  });
});

test.describe('Echo Maze', () => {
  test('the quiet left tunnel loops back to the fork', async ({ game }) => {
    await toWeighingRoom(game);
    await game.play('pressure plate', 'sandbag', 'Duck under the portcullis');
    expect(await game.text()).toContain('From the right tunnel, it rings sharp and close.');

    await game.play('Take the left tunnel', 'Press on', 'Squeeze through the crack');
    expect(await game.text()).toContain('the passage splits into rough-cut tunnels');
  });
});

test.describe('Heart Chamber door', () => {
  test('a wrong combination holds; the right one opens the door', async ({ game }) => {
    await toWeighingRoom(game);
    await game.play(...TO_HEART_DOOR.slice(1));

    await game.click('Push the door');
    expect(await game.text()).toContain('The door holds fast.');
    expect((await game.state()).heart_door_open).toBe(false);

    await setDials(game);
    await game.click('Push the door');
    expect(await game.text()).toContain('the door swings inward');
    await game.click('Open the door.');
    expect(await game.text()).toContain('In the center is a stone pedestal');
  });

  test('dial settings persist after leaving', async ({ game }) => {
    await toWeighingRoom(game);
    await game.play(...TO_HEART_DOOR.slice(1)); // already at the Weighing Room
    await game.click('moon', { within: 'dial1' });
    await game.play('Back down the tunnel', 'Take the right tunnel');
    expect((await game.state()).dials).toEqual(['wave', 'moon', 'moon']);
    await expect(game.passage().locator('tw-hook[name="dial1"]')).toHaveText('wave');
  });
});
