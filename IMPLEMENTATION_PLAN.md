# Implementation Plan — Dark Cellar Expansion

Expand the game from a 4-item, linear demo into a ~10-room puzzle game, while keeping its purpose as a test bed for Twine/Harlowe mechanics.

Room-by-room design: [docs/Layout.md](docs/Layout.md).

**Build order matters.** The systems (phases 1–3) must land before rooms (phase 4). Building rooms first means rewriting each of them when the item model changes.

---

## Phase 0 — Housekeeping

- [x] Update the README version line (Twine 2.3.7 → Tweego/Spindle build). The "string based" inventory line stays until phase 1 replaces it.
- [x] Confirm the Spindle build uses the vendored `storyformats/harlowe-3.3.9`. `tweego --list-formats` shows only `harlowe-3.3.9` (nothing is installed next to the binary), and the built HTML has `format-version="3.3.9"`.
- [x] Check every macro named in this plan against the Harlowe 3.3.9 source. All of them exist: `macro`, `output`, `output-data`, `dialog`, `meter`, `forget-undos`, `cycling-link`, `save-game`, `load-game`, `storylet`, `open-storylets`, `for`, `link`, `str-replaced`, `dm-names`, `find`, `after`.

### Phase 0 findings

Prototype tested in headless Chrome against Harlowe 3.3.9:

- **Custom macros can mutate globals.** `(macro: str-type _id, str-type _loc, [(output:)[(set: $where's (_id) to _loc)]])` works, and the change persists across a `(goto:)` into a new turn. This resolves the main phase 1 risk; no `(display:)` fallback is needed.
- **Query helpers work:** `(output-data: (find: _x where $where's (_x) is "player", ...(dm-names: $where)))` returns the carried IDs.
- **Tags as static properties work:** `(passage: "hammer-item")'s tags contains "heavy"` → `true`.
- **Display names work:** `(str-replaced: "-", " ", "rusty-key")` → `rusty key`.
- **Ordering:** `(dm-names:)` returns IDs alphabetically, so the inventory lists in alphabetical order, not pickup order. That is acceptable; track pickup order separately only if it matters.
- **Testing note:** `(after:)` timers don't fire under headless Chrome's `--virtual-time-budget`. Automated smoke tests should chain passages with `(goto:)` instead.

## Phase 1 — Item location model

### Problems with the current system

1. [inventory.tw](src/story/inventory.tw) hardcodes a `(click: "<name>")` per item. `(click:)` matches any text on the page, so similar names collide ("key" inside "rusty key").
2. Item state is split between `$inv` and per-room flags (`$storeroom_hammer`, `$heartstone`), which can drift out of sync.
3. An item can only be "carried" or "nowhere". Placing items in rooms (weight plate) is impossible.

### Design

- **`$where`**: a datamap of item ID → location, where the location is `"player"`, a passage name, or `"gone"`. It is the single source of truth for every item.
  ```
  (set: $where to (dm:
    "lantern", "player",
    "rusty-key", "player",
    "hammer", "Storeroom",
    "valve-wheel", "Pump Room",
    "sandbag", "Pump Room",
    "heartstone", "Heart Chamber"))
  ```
- **Item IDs** are lowercase and hyphenated. The description passage is `<id>-item`, tagged `item`.
- **Static properties as passage tags:** e.g. `heavy` on `hammer-item`. Check them with `(passage: _id + "-item")'s tags contains "heavy"`. This keeps static data out of save state.
- **Display name** is derived from the ID (hyphens → spaces). Add a `$names` override datamap only if a name can't be derived.
- **Mutable per-item state** stays as flat variables, and only where needed (`$lantern_lit`). Don't nest state into `$where`.

### Tasks

- [x] Replace `$inv` with `$where` in [start.tw](src/story/start.tw).
- [x] Add helpers (custom `(macro:)` stored in variables in Startup):
  - `$carried`: returns the array of IDs whose location is `"player"`.
  - `$has`: `(has: "hammer")` → boolean.
  - `$move`: sets an item's location (pick up, drop, place, consume = `"gone"`).
  - `$name`: display name from ID (hyphens → spaces).
  - Verified in phase 0: custom macros can perform `(set:)` via `(output:)`.
- [x] Rebuild the [Inventory](src/story/inventory.tw) passage with `(for: each _id, ...$carried)` and `(link:)` per item, showing the item's description passage. Remove the hardcoded `(click:)` lines.
- [x] Rebuild the [Footer](src/story/footer.tw) list from `$carried` using display names.
- [x] Migrate the existing passages: replace `$storeroom_hammer`, `$heartstone`, and every `$inv contains` check.
- [x] Item passages already match the ID convention. `hammer-item` is now tagged `heavy`.

### Done when

Verified with a scripted headless playthrough, from start to the win, diffed against the pre-change build. The only differences are the new Inventory layout and alphabetical item order. The old Inventory's description-stacking bug is gone.

- The current 5-passage game plays identically on the new model.
- A grep for `$inv`, `$storeroom_hammer`, or `$heartstone` returns nothing.

## Phase 2 — "Use item on target"

**Don't** use a global `$selected` item cursor. Every passage would have to check it, and stale selections cause bugs.

### Design

A hotspot opens a `(dialog:)` that lists carried items. The hotspot supplies a datamap of item ID → outcome. Any other item gives a generic "Nothing happens."

```
|wallspot>[(if: $wall_intact is true)[Some of the (link-repeat: "bricks")[(replace: ?wallresult)[($useOn: "the loose bricks", (dm: "hammer", "use-hammer-bricks"), "The brick wall sounds hollow...")(rerun: ?wallspot)]] look loose.]\
(else:)[The broken wall reveals a [[dark passage->Tunnel1-dark]].]]
|wallresult>[]
```

- The outcome is a passage name to `(display:)`. Outcome passages are tagged `use` and named `use-<item>-<target>`.
- Optional third argument: a fallback message for wrong items. Without it, wrong items print "Nothing happens." Cancel prints nothing.
- **Hotspot pattern:**
  - Use `(link-repeat:)` plus `(replace:)` into a result hook, so a wrong guess can be retried. `(click:)` fires only once.
  - Wrap the hotspot in a named hook that branches on world state, and `(rerun:)` it after `$useOn`. Room text is drawn once, so without the rerun a completed hotspot stays clickable and can overwrite the success message.
  - The result hook sits *outside* the rerun hook. Outcome passages print only the action message; the rerun hotspot supplies any onward link.

### Tasks

- [x] Implement `$useOn` as a custom macro in Startup.
- [x] Convert the Storeroom bricks and the Entrance door to use it, as proof that it works.
- [x] Check that the dialog lists items correctly with 0, 1, and 5+ items, and that it renders at phone width.
- [x] Footer inventory refreshes mid-passage: it is a named hook `?footerinv`, and `$move` runs `(rerun: ?footerinv)`.
- [x] Add a story stylesheet ([style.tw](src/story/style.tw)) so dialog buttons wrap, and so dialogs are wider than Harlowe's 50vw default on phones.

### Findings

- **A blocking `(dialog:)` breaks `(else:)` chains.** After the dialog closes, a following `(else:)` errors ("There's nothing before this to do (else:) with") and its branch runs as well. Use separate `(if:)` checks around any hook that contains a dialog.
- `(dialog: bind _var, ...)` blocks the rest of the hook until a button is pressed, so the macro can act on the choice inline. No callback passage is needed.
- Labels map back to IDs by matching `($name:)` against carried items. If two items ever share a display name, this breaks.
- Headless screenshots at phone width must use a 375 px iframe. Headless Chrome won't make a window narrower than about 500 px.

### Done when

- [x] The bricks and door both work via `$useOn`, with a sensible message for every wrong item. Verified by a headless playthrough covering Cancel, a wrong item and the right item on both hotspots, through to the win.

## Phase 3 — Collapse timer

### Design

- Taking the Heartstone sets `$collapsing` to true, runs `(forget-undos: -1)`, and hides the sidebar.
- The `CollapseTick` header ([collapse.tw](src/story/collapse.tw)) subtracts 1 from `$moves_left` on each passage visit while `$collapsing` is true. When `$moves_left` drops below 0, it does `(goto: "Buried")`. The budget is `$collapse_budget` (10) in Startup.
- **Free passages:** anything tagged `noTick` (Inventory, Escape, Buried), plus the visit right after the Inventory (its Return link). The Inventory sets `$free_return` for this. Without it, checking your bag would cost a move.
- **No undo during the collapse:** the header runs `(forget-undos: -1)` and `(replace: ?sidebar)[]` on *every* passage while collapsing, including `noTick` ones. The sidebar is drawn before the header runs, so without hiding it the ↶ icon stays visible but does nothing.
- `CollapseStatus` shows a `(meter:)` bound to `$moves_left`, plus escalating prose by moves left (≥8, ≥5, ≥2, 1, 0).

### Tasks

- [x] Header passage with tick logic and the `noTick` exclusion.
- [x] `Buried` ending passage with a restart link.
- [x] Meter display, checked at desktop width and in a 375 px phone viewport.
- [x] Verify that `(forget-undos:)` blocks undo. It does: clicking ↶ after the theft does nothing, and the icon is now hidden. Harlowe doesn't hook the browser's back button, so there is nothing to block there.

### Findings

- `(forget-undos:)` requires a number argument; `-1` forgets every earlier turn.
- The `(meter:)` sizing line must contain `=`. A line starting at the left edge (`"XXXX="`) fills from the left; a centred line (`"=XX="`) fills from the middle outward. The meter has no visible track by default, so [style.tw](src/story/style.tw) adds a border.
- **A header that `(goto:)`s must not fire on its own target.** The first version checked `$moves_left < 0` on every passage, including `Buried`, so `Buried` redirected to itself forever. A real browser showed a black screen. The headless harness missed it until a settle check was added (it counts passage renders over 3 s of idle time and flags any non-zero count). The redirect now lives inside the tick branch, which `noTick` passages skip.
- The meter label is computed when the passage renders. That is fine here, because the value only changes between passages.

### Done when

- [x] On the current map, dawdling (back and forth between Tunnel3 and Heartroom) ends in `Buried` on the 11th move. Walking straight out wins with 5 moves to spare. Checking the inventory during the escape costs nothing.

## Phase 4 — Rooms

Built in critical-path order. Room details are in [docs/Layout.md](docs/Layout.md). Source by area: [story.tw](src/story/story.tw) (Entrance, Storeroom, Wine Cellar, Escape), [crawlway.tw](src/story/crawlway.tw), [lower.tw](src/story/lower.tw) (Junction, Pump Room, Cistern, Weighing Room), [maze.tw](src/story/maze.tw) (Echo Maze, Heart Chamber).

- [x] **Crawlway**: Tunnel1–3 renamed to Crawlway1–3 (plus `Crawlway1-dark`). The door scene moved to Echo Door. The cave-in shows at both ends while `$collapsing`.
- [x] **Junction**: hub links only (storylets come in phase 5).
- [x] **Pump Room**: stuck valve wheel (`$useOn` with hammer), sandbag, clue #1.
- [x] **Cistern**: flooded and drained variants, `$useOn` with the valve wheel, clue #2, two new exits.
- [x] **Wine Cellar**: drain-shaft entry, bolt (`$wine_door_bolted`), clue #3. Bolted and unbolted door text at the Entrance.
- [x] **Weighing Room**: any carried `heavy` item works on the plate. The portcullis state is derived from "is any item in this room", not stored. The item can be taken back.
- [x] **Echo Maze**: Echo Fork, Echo Bend, Echo Hollow (the wrong-way loop) and Echo Door. Heartstone-glow text on the way out.
- [x] **Heart Chamber door**: three `(cycling-link: bind ...)` dials in Echo Door. Symbols moon / wave / root / flame; combination wave, root, flame.
- [x] **Heart Chamber** (was Heartroom): the take-sequence is unchanged and still starts the collapse.

### Findings

- **`(cycling-link: bind)` resets its variable to the first string on every render.** The dials reset whenever the player left and came back. Each dial's option list now starts at its current value, from a lookup table. `(rotated:)` can't do this: it rejects a rotation of 0.
- **`$useOn` now sets `$used_item`** before displaying an outcome passage, so one passage (`use-plate`) can serve every heavy item.
- **Link labels must be unique per screen** (a test helper rule, and a player one). This is why the Entrance has "door" (Storeroom) and "heavy door" (Wine Cellar).
- **Playwright's 30 s default timeout is too short** for full playthroughs (about 40 clicks at about 0.7 s each). Raised to 90 s.

### Done when

- [x] A full playthrough of the critical path in Layout.md wins ([playthrough.spec.mjs](tests/playthrough.spec.mjs)).
- [x] Every soft-lock check in Layout.md has been tried and holds. Wheel: consumed only at the Cistern. Bolt: drawable during the escape. Plate: hammer and sandbag both work, and the item can be retrieved. See [rooms.spec.mjs](tests/rooms.spec.mjs) and [collapse.spec.mjs](tests/collapse.spec.mjs).
- [x] 29 tests pass. Five new mechanics were broken on purpose and each was caught.

## Phase 5 — Extras

- [x] **Listening wall** in the Junction ([hints.tw](src/story/hints.tw)). There is one storylet passage per next step (tag `hint`), ordered by `(urgency:)`: escape (during the collapse) > wheel > drain > plate > unread marks > dials > open door, plus an always-open fallback. The Junction displays `(open-storylets:)'s 1st`.
- [x] **Chalk-mark save** in the Junction with `(save-game: "chalk")`. It is disabled during the collapse, so a save can't capture a doomed position. Load (`(load-game:)`) is offered in `Buried`, and at the Entrance until the player first reaches the Storeroom.
- [x] **Analytics:** `pushEvent('Story', 'Puzzle', <door|bricks|wheel|cistern|bolt|plate|dials>)`, plus `Save` and `Load`. The existing `Start`, `Hammer`, `Heartstone` (= collapse start) and `Finish` (`Escape` / `Buried`) events are unchanged.

### Findings

- **Inline `<script>` tags run 2–4 times per render.** Harlowe re-inserts rendered markup for `(display:)`, macro output and transitions, and each insertion re-runs scripts. Every analytics event, including the pre-existing `Start`, was being counted multiple times in production. `pushEvent` ([header/analytics.html](header/analytics.html)) now drops an identical event repeated within 250 ms. The duplicates arrive within about 10 ms.
- **Harlowe 3.3 restores the in-progress game from `sessionStorage` on reload.** Reloading the page does not restart the game. Tests simulate a new session with `game.newSession()`, which clears sessionStorage and keeps localStorage save slots.
- **`(load-game:)` swaps the passage asynchronously,** after transitions have finished. The test helper's `settle()` now also waits for the story text to stop changing.
- **Metadata macros (`(storylet:)`, `(urgency:)`) must come before any other macro in a passage;** an HTML comment before them was avoided to be safe.

### Done when

- [x] 36 tests pass, including hint order, save/load (from Buried and from a new session), no saving during the collapse, and the exact analytics sequence for the critical path. The marks-hint condition, the collapse save block and the analytics debounce were each broken on purpose and caught.

## Phase 6 — Wrap-up

- [ ] Update the README Features list to match what the game now demonstrates.
- [ ] Tune the collapse budget from playtesting.
- [ ] Mobile pass: Inventory, dialog, meter, and dials at narrow width.

---

## Testing

Run `npm test` before merging each phase. It builds the game and runs the Playwright suite in `tests/`. See [docs/Testing.md](docs/Testing.md) for the approach and how to write tests.

For each phase:

1. Add a scripted playthrough for each new room or mechanic, and a regression test for every bug found.
2. Check that each new test fails when its feature is broken (see "Prove the test can fail" in Testing.md).
3. Keep a short manual pass in a real browser. Prose, pacing and feel aren't covered by tests.

## Risks

- ~~**Custom macro side effects**~~: resolved in phase 0. `(output:)` hooks can `(set:)` globals.
- **Undo exploits:** Harlowe's undo can resurrect consumed items or reset the timer. `(forget-undos:)` covers the theft; decide whether consuming items should also forget undos.
- **Maze tedium:** sound-based navigation is easy to make annoying. Keep it to about 4 passages and make the louder/quieter difference obvious.
- **Collapse budget:** too tight feels unfair, too loose feels fake. Playtest; don't guess.
