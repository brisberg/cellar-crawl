// Playwright helpers for driving a Harlowe 3.3 story.
//
// Use the `test` exported here (not @playwright/test's) to get a `game` fixture that:
//   - blocks all http(s) requests, so tests never hit Google Tag Manager / analytics;
//   - after every test, asserts no JS errors, no Harlowe <tw-error>s, and no passage
//     re-renders while idle (which catches (goto:) redirect loops).
import { test as base, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export { expect };

export const TEST_BUILD_URL = pathToFileURL(resolve('test-output/cellar-crawl.test.html')).href;
export const PROD_BUILD_URL = pathToFileURL(resolve('output/cellar-crawl.html')).href;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactText = (label) => new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);

export class Game {
  constructor(page) {
    this.page = page;
    this.jsErrors = [];
    /** Optional async (label) => void, run after every click settles. For per-step checks. */
    this.afterClick = null;
  }

  /** Loads a build and waits for the first passage. Defaults to the test build (starts at TestRouter). */
  async open(url = TEST_BUILD_URL) {
    await this.page.goto(url);
    await this.page.locator('tw-passage').first().waitFor();
    await this.settle();
  }

  /** Opens the test build and enters the real game at Entrance. */
  async start() {
    await this.open();
    await this.click('Entrance');
  }

  /**
   * Simulates closing the tab and reopening the game: clears sessionStorage (where Harlowe 3.3
   * keeps the in-progress game to survive a reload) but keeps localStorage (save slots).
   */
  async newSession() {
    await this.page.evaluate(() => sessionStorage.clear());
    await this.start();
  }

  passage() {
    return this.page.locator('tw-passage').last();
  }

  dialog() {
    return this.page.locator('tw-dialog');
  }

  /**
   * Clicks the link, (click:) enchantment, or dialog button whose full text is `label`.
   * If a dialog is open, only its buttons are considered. Fails unless exactly one match.
   * `within` narrows the search to a named hook, e.g. { within: 'dial1' } for |dial1>[...].
   */
  async click(label, { within } = {}) {
    let scope = (await this.dialog().count()) ? this.dialog() : this.passage();
    if (within) scope = scope.locator(`tw-hook[name="${within}"]`);
    const target = scope.locator('tw-link, tw-enchantment').filter({ hasText: exactText(label) });
    await expect(target, `exactly one clickable "${label}"`).toHaveCount(1);
    await target.click();
    await this.settle();
    if (this.afterClick) await this.afterClick(label);
  }

  async play(...labels) {
    for (const label of labels) await this.click(label);
  }

  /**
   * Waits for Harlowe to finish: no transitions running, and the story text unchanged across
   * two reads 100 ms apart. The stability check catches changes that start a beat after the
   * click, such as (load-game:), which swaps the passage asynchronously.
   */
  async settle() {
    let previous = null;
    for (;;) {
      await this.page.waitForFunction(() => !document.querySelector('tw-transition-container'));
      const current = await this.page.locator('tw-story').innerText();
      if (current === previous) return;
      previous = current;
      await this.page.waitForTimeout(100);
    }
  }

  /** Visible passage text (including header/footer output), whitespace-collapsed. */
  async text() {
    return (await this.passage().innerText()).replace(/\s+/g, ' ').trim();
  }

  async dialogText() {
    return (await this.dialog().innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Dialog button labels, in order. */
  async dialogButtons() {
    return (await this.dialog().locator('tw-dialog-links tw-link').allInnerTexts()).map((t) => t.trim());
  }

  /** Analytics events pushed by the game's pushEvent(), as [action, label] pairs, in order. */
  async analytics() {
    return this.page.evaluate(() =>
      (window.dataLayer ?? []).filter((e) => e.event === window.GAME_NAME).map((e) => [e.action, e.label]),
    );
  }

  async canUndo() {
    return this.page.locator('tw-icon[alt="Undo"]').isVisible();
  }

  async undo() {
    await this.page.locator('tw-icon[alt="Undo"]').click();
    await this.settle();
  }

  /**
   * Game state from the test-only TestStateProbe footer (tests/fixtures/test-harness.tw).
   * Reflects state as of the last passage render, not changes made since within the passage.
   */
  async state() {
    const source = await this.page.locator('#test-state').last().textContent();
    return parseHarloweSource(source.trim());
  }

  /** Counts <tw-passage> renders over `ms` of idleness. A settled page renders 0 times. */
  async rendersWhileIdle(ms = 1500) {
    return this.page.evaluate(
      (ms) =>
        new Promise((done) => {
          let renders = 0;
          const obs = new MutationObserver((muts) => {
            for (const m of muts) for (const n of m.addedNodes) if (n.nodeName === 'TW-PASSAGE') renders++;
          });
          obs.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => {
            obs.disconnect();
            done(renders);
          }, ms);
        }),
      ms,
    );
  }
}

/**
 * Parses the subset of Harlowe (source:) output the state probe emits:
 * (dm: ...) -> object, (a: ...) -> array, strings, numbers, booleans.
 */
export function parseHarloweSource(src) {
  const tokens = src.match(/\(dm:|\(a:|\)|,|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false/g) ?? [];
  let i = 0;
  const list = () => {
    const items = [];
    while (tokens[i] !== ')') {
      if (tokens[i] === ',') { i++; continue; }
      items.push(value());
    }
    i++; // ')'
    return items;
  };
  const value = () => {
    const t = tokens[i++];
    if (t === '(dm:') {
      const items = list();
      const obj = {};
      for (let k = 0; k < items.length; k += 2) obj[items[k]] = items[k + 1];
      return obj;
    }
    if (t === '(a:') return list();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t?.startsWith('"')) return JSON.parse(t);
    if (t !== undefined && !Number.isNaN(Number(t))) return Number(t);
    throw new Error(`Unparseable Harlowe source near token ${i}: ${src}`);
  };
  return value();
}

export const test = base.extend({
  game: async ({ page }, use) => {
    await page.route(/^https?:\/\//, (route) => route.abort());
    const game = new Game(page);
    page.on('pageerror', (e) => game.jsErrors.push(e.message));

    await use(game);

    // Invariants checked after every test.
    expect(game.jsErrors, 'JavaScript errors').toEqual([]);
    await expect(page.locator('tw-error'), 'Harlowe errors on the page').toHaveCount(0);
    expect(await game.rendersWhileIdle(), 'passage re-renders while idle (redirect loop?)').toBe(0);
  },
});
