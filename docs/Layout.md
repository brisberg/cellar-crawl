# Dark Cellar — Room Layout

Layout for the expanded game: 10 rooms, 5 puzzles, and a timed escape once the Heartstone is taken. Built in phase 4; notes marked **Built:** record decisions made during implementation. See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for the build order and the systems these rooms depend on.

## Design goals

- **Every puzzle shows off a distinct Harlowe mechanic.** This is still a test game first.
- **Rooms without puzzles are fine.** About half the rooms carry atmosphere, clues, or items rather than gates.
- **The way in builds the way out.** Puzzles solved going in open the shortcut that makes the escape survivable.
- **No soft-locks.** Nothing the player can consume or misplace makes the game unwinnable. Each puzzle below notes how this is guaranteed.

## Map

```
 UPPER LEVEL
 ┌───────────┐  locked   ┌───────────┐
 │ Entrance  │───────────│ Storeroom │
 │ (ladder)  │           └─────┬─────┘
 └─────┬─────┘                 │ cracked wall
       │ bolted door           │
       │ (bolt on cellar side) │
 ┌─────┴──────┐                │
 │ Wine Cellar│          ┌─────┴─────┐
 └─────┬──────┘          │ Crawlway  │  3 passages, long
       │ drain shaft     │           │  caves in when the
       │ (one-way until  └─────┬─────┘  Heartstone is taken
       │  cistern drained)     │
 LOWER LEVEL                   │
       │                 ┌─────┴─────┐       ┌───────────┐
       │                 │ Junction  │───────│ Pump Room │
       │                 │ (hub)     │       └───────────┘
       │                 └─────┬─────┘
       │                       │
       │                 ┌─────┴─────┐
       └─────────────────│  Cistern  │  flooded until drained
                         └─────┬─────┘
                               │ floor stairs (exposed when drained)
                         ┌─────┴──────────┐
                         │ Weighing Room  │
                         └─────┬──────────┘
                               │ portcullis (held open by plate)
                         ┌─────┴─────┐
                         │ Echo Maze │  ~4 passages, navigate by sound
                         └─────┬─────┘
                               │ dial-locked door
                         ┌─────┴─────────┐
                         │ Heart Chamber │
                         └───────────────┘
```

## Rooms

### 1. Entrance — *exists*

Bottom of the ladder. This is where the game starts and where you escape.

- **Exits:** locked door to the Storeroom (rusty key); bolted door to the Wine Cellar (opens only from the cellar side); ladder up = **Escape** (only with the Heartstone).
- **Change from current:** add the bolted Wine Cellar door. From this side: "A heavy door, bolted from the other side."

### 2. Storeroom — *exists*

- **Items:** hammer (on table).
- **Puzzle (existing):** loose bricks. Smash with the hammer to open the Crawlway.
- **Change from current:** none beyond migrating to the new item model.

### 3. Crawlway — *exists as Tunnel1–3*

The long, narrow descent. Keep it as three passages so it is genuinely slow (3 moves).

- **Mechanic:** existing `$thud_lvl` sound messages build tension on the way down.
- **Collapse:** caves in the moment the Heartstone is taken. Arriving at the Junction end afterwards shows rubble. This removes the long route, so the shortcut is the only way out.
- **Change from current:** keep `Tunnel1-dark`, the lantern-lighting beat. The Tunnel3 door scene moves to the Heart Chamber door (room 10).
- **Built:** passages `Crawlway1-dark`, `Crawlway1`–`3`. The rubble shows at both ends: the Junction and behind the Storeroom's broken wall.

### 4. Junction — *new, hub*

A wider natural cavern where the crawlway opens out. The heartbeat is clearly audible from below.

- **Exits:** Crawlway, Pump Room, Cistern.
- **Listening wall (storylets):** "Press your ear to the wall" offers a whisper chosen by `(storylet:)` based on game state. It works as an in-world hint system, e.g. "something turns, in the room of pipes" when the valve wheel is still stuck.
- **Save point:** a chalk mark on the wall. Clicking it calls `(save-game:)`. The title or Entrance offers `(load-game:)`.

### 5. Pump Room — *new*

A rusted hand-pump mechanism and pipes leading toward the Cistern.

- **Items:** valve wheel (rusted onto a dead pipe stub); sandbag (heavy, under a dripping pipe).
- **Puzzle — stuck wheel:** use the hammer on the wheel to knock it free. This reuses the hammer, which otherwise goes unused after the Storeroom.
- **Clue:** dial symbol #1 scratched into the pump housing.

### 6. Cistern — *new*

A brick vaulted tank, flooded to chest height. An empty valve stem pokes out of the wall by the door.

- **Puzzle — flooded room (persistent world state):** use the valve wheel on the stem. The wheel is consumed (`"gone"`). The water drains, which:
  - exposes stairs in the floor down to the Weighing Room;
  - exposes the drain shaft up to the Wine Cellar;
  - reveals dial symbol #2 on the tank floor.
- **Room text** has two full variants: flooded and drained.
- **Soft-lock check:** the wheel can't be used anywhere else, so it can't be wasted.

### 7. Wine Cellar — *new*

Reached only by climbing the drain shaft from the drained Cistern. The racks are full of old casks. The door to the Entrance is bolted from this side.

- **Purpose:** this room is the escape shortcut. It also holds dial symbol #3 (a vintner's mark on the cask racks), so finding the combination requires visiting it, and the player learns the shortcut exists before they need it.
- **Bolt:** a single click throws it and opens the route to the Entrance. It can be done on the way in or during the escape.
- **Soft-lock check:** throwing the bolt is free and repeatable, and the route is always reachable once the Cistern is drained, which is required to get to the Heartstone at all.

### 8. Weighing Room — *new*

A square chamber with a stone pressure plate set into the floor. A portcullis blocks the passage onward and rises only while the plate is weighted.

- **Puzzle — weight plate (item placement):** place any item tagged `heavy` on the plate: the hammer or the sandbag. The item stays in this room (`$where` = `"Weighing Room"`) and can be picked back up, which drops the portcullis again.
- **Wrong item:** placing a light item (lantern, key) gives "The plate doesn't budge" and you keep the item. There is no trap; a trap here would add a failure state without teaching anything new.
- **Soft-lock check:** two valid items exist. The hammer's only other jobs (bricks, wheel) are both done before you can reach this room. Picking the item up from the inside is impossible, because the plate is on the outer side.

### 9. Echo Maze — *new*

A knot of identical, rough-cut passages, about 4 passages with 2–3 exits each.

**Built:** `Echo Fork` (left / right / back) → right → `Echo Door` (the dial door, the end of the maze). The left goes to `Echo Bend` → `Echo Hollow`, whose crack loops back to the Fork, so a wrong turn costs 2–3 moves. Each passage sets `$thud_lvl` (Fork 3, Door 4, Bend 2, Hollow 1), and the Fork describes which tunnel sounds louder.

- **Puzzle — heartbeat navigation:** room text is driven by `$thud_lvl`. Choices that get louder lead toward the Heart Chamber; choices that get quieter loop back. This reuses the existing sound system rather than adding a new one.
- **On the way out:** the Heartstone glows brighter toward the exit, so the escape through the maze is readable but still costs moves if the player rushes.

### 10. Heart Chamber — *exists as Heartroom*

- **Door puzzle — dials:** the decayed wooden door with spindle inlay (existing Tunnel3 text) now holds three symbol dials, built with `(cycling-link: bind ...)`. The correct symbols come from the clues in rooms 5, 6, and 7.
- **Built:** the door and dials are in the `Echo Door` passage, so entering the chamber isn't an extra move. The symbols are moon, wave, root and flame. The clues give the dial number as notches: Pump Room "a single notch beside a wavy line" → wave; Cistern "two notches beside a branching root" → root; Wine Cellar "three notches beside a small flame" → flame. A wrong combination gives "The door holds fast." Dial settings persist between visits. Each clue mark is click-to-reveal via `($reveal:)`: the room first shows "…is a mark." Once clicked, the id is stored in `$inspected` and the mark renders expanded on every later visit.
- **Taking the Heartstone:** starts the collapse (see below).
- **Change from current:** existing chamber text and take-sequence carry over.

## Item list

| Item | Found in | Heavy | Used for | Consumed |
|---|---|---|---|---|
| lantern | start | no | lighting the Crawlway | no |
| rusty-key | start | no | Entrance → Storeroom door | yes |
| hammer | Storeroom | yes | bricks, stuck wheel, weight plate | no |
| valve-wheel | Pump Room | yes* | draining the Cistern | yes |
| sandbag | Pump Room | yes | weight plate | no |
| heartstone | Heart Chamber | no | win condition; lights the maze exit | no |

\* The wheel is heavy, but it is consumed at the Cistern before the plate is reachable, so it never matters there.

## Critical path

1. Entrance: unlock door (rusty key) → Storeroom.
2. Storeroom: take hammer, smash bricks → Crawlway (light lantern) → Junction.
3. Pump Room: hammer frees the valve wheel (clue #1). Take the sandbag (optional).
4. Cistern: use wheel → drained (clue #2).
5. Drain shaft → Wine Cellar (clue #3). Optionally throw the bolt now.
6. Cistern stairs → Weighing Room: place a heavy item → portcullis opens.
7. Echo Maze → dial door (clues 1–3) → Heart Chamber: take the Heartstone.
8. Escape: Maze → Weighing Room → Cistern → shaft → Wine Cellar (bolt) → Entrance → ladder.

The exact click sequences live in [tests/helpers/routes.mjs](../tests/helpers/routes.mjs).

## The collapse

Taking the Heartstone starts the collapse. Each passage visited afterwards costs one of `$moves_left`, shown with `(meter:)`. Undo is disabled for the rest of the game. The Inventory and the final ladder climb (Escape) are free. Implemented in phase 3; see [collapse.tw](../src/story/collapse.tw).

| Route out (moves from Heart Chamber to the ladder) | Moves |
|---|---|
| Shortcut, perfect maze | 6 — Echo Door, Echo Fork, Weighing, Cistern, Wine Cellar, Entrance (Escape is free) |
| Long route via Crawlway | 10, and blocked anyway by the cave-in |

- **Budget: 10 moves** (`$collapse_budget`). That allows about 4 wrong turns in the maze or detours. Tune this during playtesting. Note that the long route fits exactly within 10, so the cave-in is what actually blocks it.
- **Escalating text:** at fixed thresholds, add prose such as dust falling, cracking beams, and rubble. Reuse `$panic_msgs` where it fits.
- **Failure:** reaching the budget goes to a **Buried** ending passage with a restart link (or load from the chalk-mark save).

## Cut from the earlier brainstorm

- **Dead lantern:** contradicts the starting inventory and the lantern's own description.
- **Mirror inscription:** duplicates the dial-clue puzzle.
- **Rat swarm:** another fetch quest; it adds no new mechanic.
- **Retrace spent items:** soft-lock risk. Its intent, an exit that changes after the theft, is covered by the collapse and the cave-in.
