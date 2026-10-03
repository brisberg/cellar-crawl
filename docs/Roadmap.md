Maybe add some static background images for each room in each major state?

Cistern flooded or not
Heartchamber with heart stone or not
ect.

I can try using Stable Diffusion to generate those background.

## Analytics (likely broken)

[header/analytics.html](../header/analytics.html) loads GTM (`GTM-T6XR5LZ`) and `pushEvent(category, action, label, value)` pushes Universal Analytics-shaped events, all named `GAME_NAME`. UA was shut down in July 2023, so unless the GTM container was migrated to GA4, nothing has been collected since. Verify with GA4 Realtime against the live game.

Problems besides that:
- A single event name (`cellar-crawl`) defeats GA4 funnels and reports. Event names should describe the action, and the game should be a parameter.
- Only milestones are tracked, so the data can't show where players get stuck. Missing: `passage_view`, `collapse_start`, restart, and turns/time on endings.
- `GAME_NAME` is defined in `header.html`, which loads after `analytics.html`. It works only because `pushEvent` reads it when called.
- GA4 sets cookies, which technically needs GDPR consent.

Options:
- **A. Drop GTM and use gtag.js + GA4 directly.** Use one head file and `track(name, params)`. Events: `level_start`, `level_end {success, ending, turns}`, `puzzle_solved {puzzle}`, `item_taken {item}`, `game_save`/`game_load`, `collapse_start`, `passage_view {passage_name}` (from a `[header]` passage via `(print:)`ed script, still untested). The test helper in `tests/helpers/harlowe.mjs` then filters `dataLayer` on `e[0] === 'event'`. GA4 also needs the custom dimensions registered, `level_end` marked as a key event, and a Funnel exploration for drop-off.
- **B. Keep GTM and push GA4-shaped events** (`{event: 'puzzle_solved', puzzle}`), with one Google tag plus a GA4 Event tag using `{{Event}}`. Only worth it to learn GTM.
- **C. Leave Google for a cookieless tool: GoatCounter, Plausible, Umami, or Cloudflare Web Analytics.** This is a fully valid choice and the likely pick. Traffic plus custom events covers the goals (reach, completion rate, stuck points), with no consent banner and no GTM/GA4 setup. Reuse option A's event schema.
