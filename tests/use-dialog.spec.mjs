import { test, expect } from './helpers/harlowe.mjs';

// Uses the Fixture-UseOn passage from tests/fixtures/test-harness.tw.
const openFixture = async (game) => {
  await game.open();
  await game.click('Fixture-UseOn');
};

test('zero items: explains, single OK button', async ({ game }) => {
  await openFixture(game);
  await game.click('zero');
  expect(await game.dialogText()).toContain('You have nothing to use on the zero test.');
  expect(await game.dialogButtons()).toEqual(['OK']);
  await game.click('OK');
  // Regression: a blocking (dialog:) followed by (else:) used to open a second dialog.
  await expect(game.dialog()).toHaveCount(0);
});

test('one item: matching outcome passage is displayed', async ({ game }) => {
  await openFixture(game);
  await game.click('one');
  expect(await game.dialogButtons()).toEqual(['lantern', 'Cancel']);
  await game.click('lantern');
  expect(await game.text()).toContain('OK-OUTCOME');
});

test('many items: all listed by display name; unmatched prints the default', async ({ game }) => {
  await openFixture(game);
  await game.click('many');
  expect(await game.dialogButtons()).toEqual([
    'a very long item name', 'hammer', 'heartstone', 'lantern', 'rusty key', 'sandbag', 'valve wheel', 'Cancel',
  ]);
  await game.click('sandbag');
  expect(await game.text()).toContain('Nothing happens.');
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('many-item dialog fits on screen', async ({ game }) => {
    await openFixture(game);
    await game.click('many');
    const box = await game.dialog().boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    for (const button of await game.dialog().locator('tw-dialog-links tw-link').all()) {
      const label = await button.innerText();
      const b = await button.boundingBox();
      expect(b.x + b.width, `button "${label}" inside dialog`).toBeLessThanOrEqual(box.x + box.width);
      // Without flex-wrap, buttons shrink to fit and their labels wrap into tall, squashed pills.
      const lines = await button.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      });
      expect(lines, `button "${label}" label on one line`).toBe(1);
    }
  });
});
