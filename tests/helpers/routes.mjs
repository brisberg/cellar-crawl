// Click sequences for the critical path (docs/Layout.md), shared by specs.
// Each segment starts where the previous one ends. Update here when the map changes.

/** Entrance -> Storeroom (unlocks the door). */
export const TO_STOREROOM = ['door', 'rusty key', 'door'];

/** Storeroom -> Junction (takes the hammer, smashes the wall, lights the lantern). */
export const STOREROOM_TO_JUNCTION = [
  'There is a hammer resting on the table.', 'bricks', 'hammer',
  'dark passage', 'lantern', 'Follow it.', 'Continue.', 'Climb down into the cavern',
];

/** Junction -> Junction via the Pump Room (frees the valve wheel, takes the sandbag, reads clue #1). */
export const PUMP_ROOM = [
  'low doorway', 'valve wheel', 'hammer',
  'A sandbag slumps beneath the dripping joint.', 'mark', 'Back to the cavern',
];

/** Junction -> Cistern, drained (reads clue #2). */
export const DRAIN_CISTERN = ['brick archway', 'valve stem', 'valve wheel', 'mark'];

/** Cistern -> Cistern via the Wine Cellar (reads clue #3, draws the bolt). */
export const WINE_CELLAR = ['drain shaft', "vintner's mark", 'Draw the bolt', 'Climb down the shaft'];

/** Cistern -> Echo Door (sandbag on the plate, right tunnel). */
export const TO_HEART_DOOR = ['down into the dark', 'pressure plate', 'sandbag', 'Duck under the portcullis', 'Take the right tunnel'];

/** Sets the dials (each starts at "moon") to wave / root / flame. */
export async function setDials(game) {
  await game.click('moon', { within: 'dial1' }); // -> wave
  for (let i = 0; i < 2; i++) await game.click(i ? 'wave' : 'moon', { within: 'dial2' }); // -> root
  for (const s of ['moon', 'wave', 'root']) await game.click(s, { within: 'dial3' }); // -> flame
}

/** Entrance -> Heart Chamber, everything solved. */
export async function toHeartChamber(game) {
  await game.play(...TO_STOREROOM, ...STOREROOM_TO_JUNCTION, ...PUMP_ROOM, ...DRAIN_CISTERN, ...WINE_CELLAR, ...TO_HEART_DOOR);
  await setDials(game);
  await game.play('Push the door', 'Open the door.');
}

/** Heart Chamber -> Entrance by the shortcut (6 moves). */
export const ESCAPE_ROUTE = [
  'Flee', 'Back down the tunnel', 'Back under the portcullis', 'Climb the stairs', 'drain shaft', 'door',
];
