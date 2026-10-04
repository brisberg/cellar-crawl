# Testing a Twine / Harlowe Game

This doc covers how Dark Cellar is tested, why it is set up this way, and what to add next. It is written for anyone adding rooms or mechanics, including AI agents.

## Quick start

```sh
npm install
npx playwright install chromium   # first time only
npm test                          # builds the game, then runs every test (~30 s)
npx playwright test tests/collapse.spec.mjs   # one file
npx playwright test --ui                      # interactive runner with step-by-step traces
```

**Requires:** `tweego` on your `PATH` (Spindle already requires it).

On failure, Playwright keeps a trace in `test-output/results/`. Open it with `npx playwright show-trace <path>` to see the DOM at every step.

## Why Twine games need a particular approach

A Twine game is one HTML file that changes state as the player clicks. It has no functions to unit-test and no API for reading its state. Several of its bugs only show up in a real browser:

- **Rendering bugs:** a hotspot that stays clickable after use; a header `(goto:)` that loops forever, which shows as a black screen.
- **Harlowe quirks:** a blocking `(dialog:)` breaks a following `(else:)`.
- **Layout bugs:** dialogs and meters overflowing at phone width.
- **Dead references:** a typo in a link target fails only when a player reaches that exact link.

Every one of these happened during phases 1–3. All of them are now covered by a test that was shown to fail when the bug was reintroduced.

## Recommended layers

Ordered from cheapest to most expensive. Use the cheapest layer that can catch the bug.

### 1. Static story-graph checks (no browser, milliseconds)

[story-graph.spec.mjs](../tests/story-graph.spec.mjs) parses the compiled HTML and checks:

- every literal passage reference resolves: `[[links]]`, `(display:)`, `(goto:)`, `(link-goto:)` and `$useOn` outcome maps;
- every item in `$where` has an `<id>-item` passage tagged `item`, and a starting location that is a real passage;
- every `$useOn` outcome passage is tagged `use`.

It can't follow references computed at runtime, such as `(display: _id + "-item")`. The item check covers that one case. When you add a new reference pattern, add a regex here.

### 2. Scripted playthroughs in a real browser

Tests drive the game with [Playwright](https://playwright.dev) through the helpers in [tests/helpers/harlowe.mjs](../tests/helpers/harlowe.mjs):

```js
import { test, expect } from './helpers/harlowe.mjs';

test('key unlocks the door', async ({ game }) => {
  await game.start();                          // test build → Entrance
  await game.play('door', 'rusty key');        // clicks link, then dialog button
  expect(await game.text()).toContain('There is an unlocked door.');
  expect(await game.state()).toMatchObject({ door_locked: false });
});
```

- `click(label)` matches the **full text** of a link, a `(click:)` enchantment or a dialog button, and fails unless exactly one element matches. A link that is missing or ambiguous is a test failure, not a silent no-op. If a dialog is open, only its buttons are considered.
- `analytics()` returns the `[action, label]` pairs the game sent to `pushEvent`, in order. GTM itself is blocked, but the in-page `dataLayer` still records them.
- `newSession()` simulates closing and reopening the tab. Harlowe 3.3 restores the in-progress game from `sessionStorage` on reload, so a plain reload does *not* restart; save slots in `localStorage` survive.
- `click(label, { within: 'dial1' })` limits the search to a named hook. Use it when identical labels are intentional, like the three dials.
- Every click waits until Harlowe has settled: no `<tw-transition-container>` remains and the story text is unchanged across two reads 100 ms apart. The second check catches asynchronous changes like `(load-game:)`.

**Why Playwright and not the earlier hand-rolled headless Chrome script:** the script needed workarounds that made it untrustworthy.

- Virtual time stopped `requestAnimationFrame`, so `(after:)` and clicks followed by `(goto:)` froze.
- Headless windows can't go below about 500 px, so phone screenshots were silently cropped.
- Fixed delays raced Harlowe's 800 ms transitions. That is how the redirect-loop bug slipped through: the script read the text mid-loop.
- It was tied to a macOS Chrome path and had no real assertions.

Playwright runs in real time, emulates any viewport, waits on conditions, and gives traces and parallel runs.

### 3. State assertions through a test-only probe

Harlowe 3.3 exposes no JavaScript API for reading variables. To work around this, the **test build** includes a footer, `TestStateProbe` ([tests/fixtures/test-harness.tw](../tests/fixtures/test-harness.tw)). It prints chosen variables as Harlowe source into a hidden `#test-state` element, and `game.state()` parses that into a JS object.

- **Prefer state assertions over prose assertions.** `state().where.hammer === 'player'` survives copy edits, while `toContain('You take the hammer.')` doesn't. Assert on prose only when the prose itself is the behaviour, such as the outcome message or the warning text.
- **Limitation:** the probe updates once per passage render. Changes made inside a passage (a `$useOn` outcome, a click hook) show up in `state()` only after the next passage loads. Within a passage, assert on text.
- **To expose a new variable,** add it to the `(dm: ...)` in `TestStateProbe`.

### 4. Fixture passages for isolated mechanics

Some mechanics are tedious or impossible to reach through normal play, such as `$useOn` with 0 or 7 items. For these, write a `Fixture-*` passage in `tests/fixtures/` that sets up the state directly and exercises the mechanic. The test build starts at `TestRouter`, which links to `Entrance` and to each fixture.

The test build is `src/` plus `tests/fixtures/`, compiled by [global-setup.mjs](../tests/global-setup.mjs) into `test-output/`. Fixtures never reach production; a test asserts that `#test-state` is absent from the Spindle build.

### 5. Invariants checked after every test

The `game` fixture checks these automatically, so individual tests don't have to:

| Invariant | Catches |
|---|---|
| No `<tw-error>` elements | Harlowe runtime errors, such as a bad `(else:)` chain or a missing passage in `(display:)` |
| No uncaught JavaScript errors | Broken `<script>` blocks or header code |
| **No passage re-renders during 1.5 s of idle time** | `(goto:)` redirect loops (the Buried bug) |
| All http(s) requests blocked | Tests firing your **production Google Tag Manager** container |

The analytics point matters. The build includes `GTM-T6XR5LZ`. The ad-hoc headless runs during phases 0–3 were not blocked, so some of those sessions may have reported events to your analytics.

### 6. Layout assertions at phone width

[use-dialog.spec.mjs](../tests/use-dialog.spec.mjs) runs at a 375 × 812 mobile viewport. It checks geometry: the dialog lies within the screen, each button lies within the dialog, and each button label is on one line.

**Geometry, not pixel snapshots.** Screenshot diffs break on font rendering, OS and Chromium version, and mostly produce noise for a one-person project. Assert the property you care about.

## Prove the test can fail

A test that has never failed proves nothing. After writing a test for a bug or feature, break the code on purpose and confirm the test goes red.

When this suite was written, seven historical bugs were reintroduced one at a time:

| Reintroduced bug | Result |
|---|---|
| Buried redirects to itself | Caught (idle-render invariant) |
| `(else:)` after a blocking dialog | Caught |
| Hotspot not rerun after use | Caught (3 tests) |
| Broken wall links past the dark tunnel | Caught |
| Inventory Return costs a move | Caught |
| Typo in a `[[link]]` target | Caught (story graph) |
| Dialog buttons don't wrap on phones | **Missed at first.** The buttons shrank instead of overflowing. Fixed by adding the one-line-label assertion; now caught. |

The last row is why this step matters.

## Conventions

- **One regression test per bug,** named or commented "Regression: …", stating what used to happen.
- **Test files are grouped by mechanic,** not by phase: `playthrough`, `hotspots`, `collapse`, `use-dialog`, `story-graph`. New rooms get their own file (e.g. `cistern.spec.mjs`) or join the mechanic they demonstrate.
- **Share routes** through [tests/helpers/routes.mjs](../tests/helpers/routes.mjs) (`TO_STOREROOM`, `toHeartChamber()`, `ESCAPE_ROUTE`, …) instead of repeating long click lists. When the map or a link label changes, update it in one place.
- **Click labels must be exact and unique on screen.** If two links share text, change the prose. A player can't tell them apart either.

## Known limitations

- **Speed:** about 0.7 s per click, because Harlowe times its transitions in JavaScript; a CSS override was tried and had no effect. A full playthrough is about 40 clicks, so the per-test timeout is 90 s. Tests run in parallel; the whole suite takes about 80 s.
- **Prose coupling:** tests that assert on text break when the text is edited. That is intended for messages; for mechanics, use `state()`.
- **The static checks use regexes.** They catch literal references, not computed ones.
- **Manual play is still needed** for pacing, tone and whether a puzzle is fair. Tests prove the game *works*, not that it's *good*.

## What to add next

In priority order:

1. ~~**Run tests in CI.**~~ Drafted. [ci.yml](../.github/workflows/ci.yml) calls `brisberg/ci`'s `twine-test.yml` on every push, and deploys via `twine-pages.yml` only from `main` after the tests pass. Failed runs upload `test-output/results` (traces) as an artifact.
2. **Soft-lock explorer (high value for Phase 4).** [Layout.md](Layout.md) promises "no soft-locks". A crawler could do a breadth-first search over the game: try every clickable link and dialog button, key each state on `passage + state()`, and assert that `You Win!` is still reachable from every reachable state. It needs a depth cap and a way to restore state, by re-running a recorded path or using Harlowe's `(save-game:)`. This is the only practical way to *prove* the soft-lock checks once there are about 10 rooms.
3. **Prose linting:** run `cspell` over `src/**/*.tw` with a project word list. The last few commits were typo fixes.
4. **Random-walk smoke test:** a cheap alternative to item 2. Make N random clicks with a fixed seed and check only the invariants. It finds crashes and loops, not soft-locks.
