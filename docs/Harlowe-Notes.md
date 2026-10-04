# Harlowe 3.3.9 Notes

Behaviour found while building Dark Cellar, most of it undocumented or easy to miss. Each item says where the game depends on it.

## Custom macros and data

- **Custom macros can mutate globals.** `(macro: str-type _id, str-type _loc, [(output:)[(set: $where's (_id) to _loc)]])` works, and the change persists across a `(goto:)` into a new turn. This is how `$move` works ([start.tw](../src/story/start.tw)).
- **Query helpers return data with `(output-data:)`:** `(output-data: (find: _x where $where's (_x) is "player", ...(dm-names: $where)))` returns the carried IDs.
- **`(dm-names:)` returns keys alphabetically,** so the inventory lists items in alphabetical order, not pickup order.
- **Passage tags work as static properties:** `(passage: "hammer-item")'s tags contains "heavy"` → `true`. This keeps static data out of save state.
- **Display names are derived from IDs:** `(str-replaced: "-", " ", "rusty-key")` → `rusty key`. `$useOn` maps dialog labels back to IDs by matching display names, so two items must never share one.
- **`$useOn` sets `$used_item`** before displaying the outcome passage, so one passage (`use-plate`) can serve every heavy item.

## Hooks, links and dialogs

- **`(click:)` matches any text on the page,** so similar names collide ("key" inside "rusty key"). It also fires only once. Use `(link:)` / `(link-repeat:)` instead.
- **A blocking `(dialog:)` breaks `(else:)` chains.** After the dialog closes, a following `(else:)` errors ("There's nothing before this to do (else:) with") and its branch runs as well. Use separate `(if:)` checks around any hook that contains a dialog.
- **`(dialog: bind _var, ...)` blocks the rest of the hook** until a button is pressed, so code can act on the choice inline. No callback passage is needed.
- **Room text is drawn once.** A hotspot that changes world state must sit in a named hook that branches on that state, and `(rerun:)` it afterwards. Otherwise a completed hotspot stays clickable and can overwrite its own success message. Keep the result hook *outside* the rerun hook.
- **Hooks in a footer can be rerun mid-passage.** The footer inventory is `?footerinv`, and `$move` reruns it.
- **`(cycling-link: bind)` resets its variable to the first option on every render.** To make a dial remember its setting, start each option list at the current value, from a lookup table ([maze.tw](../src/story/maze.tw)). `(rotated:)` can't do this: it rejects a rotation of 0.
- **Link labels should be unique per screen.** Players can't tell duplicates apart, and the test helper clicks by label. This is why the Entrance has "door" and "heavy door".

## Headers, undo and the meter

- **A header that `(goto:)`s must not fire on its own target.** A header that redirected to `Buried` on every passage, including `Buried`, looped forever and showed a black screen. Put the redirect inside a branch the target passage skips (here, `noTick`).
- **`(forget-undos:)` requires a number argument;** `-1` forgets every earlier turn. It does not hide the sidebar ↶ icon, which is drawn before the header runs, so also `(replace: ?sidebar)[]`. Harlowe doesn't hook the browser's back button.
- **The `(meter:)` sizing line must contain `=`.** A line starting at the left edge (`"XXXX="`) fills from the left; a centred line (`"=XX="`) fills from the middle outward. The meter has no visible track by default; [style.tw](../src/story/style.tw) adds a border.
- **A meter label is computed when the passage renders,** so it won't update if the value changes mid-passage.

## Storylets, saves and sessions

- **Metadata macros (`(storylet:)`, `(urgency:)`) must come before any other macro in a passage.** Avoid even an HTML comment before them.
- **Harlowe 3.3 restores the in-progress game from `sessionStorage` on reload.** Reloading does not restart the game. Save slots live in `localStorage`.
- **`(load-game:)` swaps the passage asynchronously,** after transitions have finished.

## Scripts

- **Inline `<script>` tags run 2–4 times per render.** Harlowe re-inserts rendered markup for `(display:)`, macro output and transitions, and each insertion re-runs the scripts. This is why `pushEvent` ([header/analytics.html](../header/analytics.html)) drops an identical event repeated within 250 ms. The duplicates arrive within about 10 ms. Don't remove the debounce.

## Layout

- **Dialogs default to 50vw,** which is too narrow on phones, and their buttons don't wrap. [style.tw](../src/story/style.tw) fixes both.

## Testing quirks

- **`(after:)` timers don't fire under headless Chrome's `--virtual-time-budget`.**
- **Headless Chrome won't make a window narrower than about 500 px.** Use a 375 px iframe for phone screenshots, or Playwright's viewport.
- **Transitions are timed in JavaScript (about 0.7 s per click),** and a CSS override has no effect. Full playthroughs need a longer timeout than Playwright's 30 s default.
