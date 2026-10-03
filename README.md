# Dark Cellar 1.0.0

A short puzzle adventure in the cellar under an abandoned house. Find the Heartstone, a living crystal at the heart of the cellar, and escape before the cellar collapses without it.

It is mainly an example game: each room demonstrates a Twine/Harlowe mechanic, and the source is commented as a reference. See [docs/Layout.md](docs/Layout.md) for the map and puzzle design, and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for how it was built and what was learned.

Harlowe 3.3.9 (vendored in `storyformats/`)\
Built with [Tweego](https://www.motoslave.net/tweego/) via [Spindle](https://github.com/brisberg/spindle): `npm run build` → `output/cellar-crawl.html`

### What it demonstrates

| Mechanic | Harlowe features | Where |
|---|---|---|
| Location-based inventory: one `$where` datamap tracks every item (`"player"`, a passage name, or `"gone"`) | `(dm:)`, `(find:)`, `(dm-names:)` | [start.tw](src/story/start.tw) |
| Item helpers as custom macros: `$has`, `$move`, `$carried`, `$name` | `(macro:)`, `(output:)`, `(output-data:)` | [start.tw](src/story/start.tw) |
| Static item properties as passage tags (e.g. `heavy`) | `(passage:)'s tags` | [inventory.tw](src/story/inventory.tw), Weighing Room |
| "Use item on…" dialog that lists what you carry | `(dialog: bind ...)`, a custom `$useOn` macro | [start.tw](src/story/start.tw), every hotspot |
| Hotspots that redraw from world state after use | named hooks, `(rerun:)`, `(link-repeat:)` | Entrance, Storeroom, Pump Room, Cistern |
| Item placement and derived state (an item on the plate holds the portcullis open) | `$where`, `(find:)` | [lower.tw](src/story/lower.tw), Weighing Room |
| Combination lock that remembers its settings | `(cycling-link: bind ...)` | [maze.tw](src/story/maze.tw), Echo Door |
| Click-to-reveal details, remembered once inspected | `(link-reveal:)`, a custom `$reveal` macro | clue marks |
| Navigation by sound: a heartbeat that grows louder near the goal | per-passage `$thud_lvl`, `(display:)` | [crawlway.tw](src/story/crawlway.tw), Echo Maze |
| Timed escape with a meter, no undo, and a failure ending | `header` passage, `(meter:)`, `(forget-undos:)`, `?sidebar` | [collapse.tw](src/story/collapse.tw) |
| In-world hint system keyed to progress | `(storylet:)`, `(urgency:)`, `(open-storylets:)` | [hints.tw](src/story/hints.tw), Junction |
| Save point and continue | `(save-game:)`, `(load-game:)`, `(saved-games:)` | Junction, Buried, Entrance |
| Startup, header and footer passages | `startup` / `header` / `footer` tags | [start.tw](src/story/start.tw), [footer.tw](src/story/footer.tw) |
| Mobile-friendly dialogs, meter and dial buttons | story stylesheet | [style.tw](src/story/style.tw) |
| Google Analytics custom events, de-duplicated | `<script>` + `pushEvent` | [header/analytics.html](header/analytics.html) |

### Testing

`npm test` builds the game and runs the Playwright suite. First run only: `npx playwright install chromium`. See [docs/Testing.md](docs/Testing.md).

### Tutorials
[Simple Inventory in Twine2](https://gersande.com/blog/designing-inventories-in-twine-2-with-the-built-in-harlowe-macros/#1)
[Locked doors](https://www.youtube.com/watch?v=C_Mmv6vQajM)
