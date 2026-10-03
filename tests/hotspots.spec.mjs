import { test, expect } from './helpers/harlowe.mjs';

test.describe('Entrance door ($useOn)', () => {
  test('Cancel does nothing', async ({ game }) => {
    await game.start();
    await game.click('door');
    expect(await game.dialogText()).toContain('Use what on the iron lock?');
    expect(await game.dialogButtons()).toEqual(['lantern', 'rusty key', 'Cancel']);

    await game.click('Cancel');
    await expect(game.dialog()).toHaveCount(0);
    expect(await game.text()).toContain('There is a door with a small, iron lock.');
  });

  test('wrong item shows the fallback and keeps the item', async ({ game }) => {
    await game.start();
    await game.play('door', 'lantern');
    expect(await game.text()).toContain('The door is locked and requires a key.');
    expect(await game.text()).toContain('You are carrying lantern, rusty key');
  });

  test('key unlocks once; the spent hotspot is replaced', async ({ game }) => {
    await game.start();
    await game.play('door', 'rusty key');
    const text = await game.text();
    expect(text).toContain('You unlock the door with the Rusty Key.');
    expect(text).toContain('There is an unlocked door.');
    expect(text, 'footer refreshes mid-passage').toContain('You are carrying lantern Check');

    // Regression: the locked-door hotspot used to stay clickable after unlocking.
    await game.click('door');
    await expect(game.dialog(), 'unlocked door navigates, no use dialog').toHaveCount(0);
    expect(await game.text()).toContain('You stand in a musky Storeroom.');
    expect(await game.state()).toMatchObject({ door_locked: false });
  });
});

test.describe('Storeroom bricks ($useOn)', () => {
  test('wrong item, then hammer; spent hotspot is replaced', async ({ game }) => {
    await game.start();
    await game.play('door', 'rusty key', 'door', 'bricks', 'lantern');
    expect(await game.text()).toContain('you cannot budge it with your bare hands');

    await game.play('There is a hammer resting on the table.', 'bricks', 'hammer');
    const text = await game.text();
    expect(text).toContain('Bricks fly and crumble under your hammer.');
    expect(text).toContain('The broken wall reveals a dark passage.');

    // Regression: the bricks hotspot used to stay clickable after smashing.
    const bricks = game.passage().locator('tw-link, tw-enchantment').filter({ hasText: /^bricks$/ });
    await expect(bricks).toHaveCount(0);
  });

  test('broken wall leads to the dark tunnel when the lantern is unlit', async ({ game }) => {
    // Regression: the broken-wall link used to skip Tunnel1-dark.
    await game.start();
    await game.play('door', 'rusty key', 'door', 'There is a hammer resting on the table.', 'bricks', 'hammer');
    await game.play('door', 'door', 'dark passage');
    expect(await game.text()).toContain('You crouch in a dark tunnel');
    expect((await game.state()).lantern_lit).toBe(false);
  });
});
