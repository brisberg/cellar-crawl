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

Build in critical-path order, so the game is playable end-to-end after each step. Details for each room are in [docs/Layout.md](docs/Layout.md).

- [ ] **Crawlway**: rename Tunnel1–3 and move the dial-door text out of Tunnel3. Add the cave-in variant for when `$collapsing` is true.
- [ ] **Junction**: hub links only (storylets come in phase 5).
- [ ] **Pump Room**: stuck valve wheel (`$useOn` with hammer), sandbag, clue #1.
- [ ] **Cistern**: flooded and drained variants, `$useOn` with the valve wheel, clue #2, two new exits.
- [ ] **Wine Cellar**: drain-shaft entry, bolt (`$wine_door_bolted`), clue #3. Add the bolted-door text to Entrance.
- [ ] **Weighing Room**: plate via `$useOn`, where any `heavy` item is accepted. The placed item goes to `$where` = `"Weighing Room"` and can be picked back up, which closes the portcullis.
- [ ] **Echo Maze**: about 4 passages. Choose a sound level per passage. Add the Heartstone-glow variant for the way out.
- [ ] **Heart Chamber door**: three `(cycling-link: bind ...)` dials. Pick a symbol set and combination, then write clues 1–3 to match.
- [ ] **Heart Chamber**: hook the take-sequence into phase 3.

### Done when

- A full playthrough of the critical path in Layout.md wins.
- Every soft-lock check in Layout.md has been tried and holds.

## Phase 5 — Extras

- [ ] **Listening wall** in the Junction: `(storylet:)` / `(open-storylets:)` hints keyed to progress, with one hint per unsolved puzzle and a fallback whisper.
- [ ] **Chalk-mark save** in the Junction with `(save-game:)`, plus `(load-game:)` on Entrance or a title passage.
- [ ] Analytics events (`pushEvent`) for each puzzle solved, the collapse start, the `Buried` ending, and the win.

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
