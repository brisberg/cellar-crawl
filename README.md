# Dark Cellar 1.0.0

A simple adventure game exploring the dark cellar under an abandoned house. Navigate various rooms and puzzles to find the heart of the cellar.

Harlowe 3.3.9 (vendored in `storyformats/`)\
Built with [Tweego](https://www.motoslave.net/tweego/) via [Spindle](https://github.com/brisberg/spindle): `npm run build` → `output/cellar-crawl.html`

### Features

- Mainly a test game to explore some mechanics of Twine/Harlowe
- Location-based inventory: one `$where` datamap tracks every item (`"player"`, a passage name, or `"gone"`)
- Custom macros (`$has`, `$move`, `$carried`, `$name`) as item helpers
- Static item properties as passage tags (e.g. `heavy`)
- Item pick ups (keys)
- Locked passages needing keys
- Startup, Footer passages
- Simple Google Analytics with Custom Events

### Tutorials
[Simple Inventory in Twine2](https://gersande.com/blog/designing-inventories-in-twine-2-with-the-built-in-harlowe-macros/#1)
[Locked doors](https://www.youtube.com/watch?v=C_Mmv6vQajM)
