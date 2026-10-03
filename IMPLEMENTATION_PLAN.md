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
(useOn: "the loose bricks", (dm: "hammer", "Smash-Bricks"))
```

- The outcome is a passage name to `(display:)`. This keeps result logic in normal passages instead of strings.
- Add an optional fallback-message argument per hotspot ("The plate doesn't budge.").

### Tasks

- [ ] Implement `$useOn` as a custom macro in Startup.
- [ ] Convert the Storeroom bricks and the Entrance door to use it, as proof that it works.
- [ ] Check that the dialog lists items correctly with 0, 1, and 5+ items, and that it renders at phone width.

### Done when

- The bricks and door both work via `$useOn`, with a sensible message for every wrong item.

## Phase 3 — Collapse timer

### Design

- When the Heartstone is taken: set `$collapse` to 0, set `$collapsing` to true, and run `(forget-undos:)`.
- A `header`-tagged passage increments `$collapse` on each passage visit while `$collapsing`. Exclude the Inventory passage and dialogs with a `noTick` tag, so checking your bag doesn't cost a move.
- Show `(meter:)` for the remaining budget.
- At the budget (start at 10), `(goto: "Buried")`, a failure ending with a restart or load link.
- Collapse prose at thresholds via a `CurrentCollapseMsg` passage, mirroring [sound.tw](src/story/sound.tw).

### Tasks

- [ ] Header passage with tick logic and the `noTick` exclusion.
- [ ] `Buried` ending passage.
- [ ] Meter display; check how it looks on mobile.
- [ ] Verify `(forget-undos:)` actually blocks the browser back/undo button in Harlowe 3.3.9.

### Done when

- On the current small map, taking the stone and dawdling ends in `Buried`. Walking straight out wins.

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

There are no automated tests. Before merging each phase, run this manual checklist:

1. Build with `npm run build` and play from a fresh start.
2. Play the critical path to a win.
3. Try each wrong item on each hotspot.
4. Try each soft-lock scenario listed in Layout.md.
5. Collapse: win with a perfect route; lose by dawdling.
6. Use undo and back at key points: after consuming an item, after the theft.

## Risks

- ~~**Custom macro side effects**~~: resolved in phase 0. `(output:)` hooks can `(set:)` globals.
- **Undo exploits:** Harlowe's undo can resurrect consumed items or reset the timer. `(forget-undos:)` covers the theft; decide whether consuming items should also forget undos.
- **Maze tedium:** sound-based navigation is easy to make annoying. Keep it to about 4 passages and make the louder/quieter difference obvious.
- **Collapse budget:** too tight feels unfair, too loose feels fake. Playtest; don't guess.
