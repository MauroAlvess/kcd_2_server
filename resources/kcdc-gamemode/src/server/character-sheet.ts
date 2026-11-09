/**
 * What the panel's Personagem section says of a character besides its titles, status and town (user, 2026-11-02: "na seção personagem vamos colocar lá
 * o nível do jogador; o nível é a soma de todos os níveis dele"): the age and the height it was given in the creator (`characters.ts`, `character-details.ts`)
 * and its level, the levels of every track of the game's progression added up. The progression is the one the player's game reports; before its first
 * report (the first seconds of a join) it is the one saved with the character, read once a minute at most.
 */

import { levelOf } from "./character-details.js";
import { savedProgression } from "./character-state.js";
import { getCharacter } from "./characters.js";
import { addPayload } from "./status.js";

/** How long a level read from the saved file is believed: the game's own report takes over within seconds. */
const SAVED_FOR_MS = 60_000;
const savedLevels = new Map<string, { readonly level: number | null; readonly at: number }>();

/** The character's level now: the game's report, else what was saved. Null when neither says. */
export function levelNow(player: Player, now: number = Date.now()): number | null {
    const live = levelOf(player.progression);
    if (live !== null) {
        savedLevels.delete(player.steamId);
        return live;
    }
    if (player.steamId === "") {
        return null;
    }
    const kept = savedLevels.get(player.steamId);
    if (kept !== undefined && now - kept.at < SAVED_FOR_MS) {
        return kept.level;
    }
    const level = levelOf(savedProgression(player.steamId));
    savedLevels.set(player.steamId, { level, at: now });
    return level;
}

/** The block of the panel's payload: the age, the height in centimetres and the level, each null when unknown. */
export function sheetOf(player: Player): { readonly age: number | null; readonly height: number | null; readonly level: number | null } {
    const saved = player.steamId === "" ? null : getCharacter(player.steamId);
    return {
        age: typeof saved?.age === "number" ? saved.age : null,
        height: typeof saved?.height === "number" ? saved.height : null,
        level: levelNow(player),
    };
}

export function installCharacterSheet(): void {
    addPayload((player) => ({ sheet: sheetOf(player) }));
    Events.on("playerDisconnect", (player) => {
        savedLevels.delete(player.steamId);
    });
}
