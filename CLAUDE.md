# Dark Cellar

Harlowe 3.3.9 example game. Room design: [docs/Layout.md](docs/Layout.md). Testing: [docs/Testing.md](docs/Testing.md). Harlowe gotchas found while building it: [docs/Harlowe-Notes.md](docs/Harlowe-Notes.md).

Run `npm test` before committing.

## Open issues

- **Use-item messages render below the redrawn hotspot.** For example, in the Weighing Room "You set the sandbag on the plate…" appears after the "Duck under the portcullis" link. Fix: move each `|…result>[]` hook above its hotspot hook (`?wheelspot`, `?cisternspot`, `?platespot`, and the Entrance and Storeroom hotspots).
- **Undo can resurrect consumed items.** `(forget-undos:)` is only called when the collapse starts. Undecided whether consuming an item (e.g. the valve wheel at the Cistern) should also forget undos.

## Constraints

- **The collapse budget of 10 (`$collapse_budget`) has been playtested and works.** The `CollapseStatus` message thresholds in [collapse.tw](src/story/collapse.tw) are hard-coded for 10. If the budget ever changes, update them as well. [collapse.spec.mjs](tests/collapse.spec.mjs) pins the difficulty.
