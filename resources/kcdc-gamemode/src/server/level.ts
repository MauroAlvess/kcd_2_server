/**
 * Which level the server runs (user, 2026-11-09: "coloque nosso servidor do zero com o mapa 1 de kcd2 ao invés do mapa de Kuttenberg").
 *
 * The level is the server's own setting, `mod.level` of `server.json` (`kutnohorsko`, `trosecko` or `klaster`), and the framework does not hand it to a script. Everything this gamemode
 * places by coordinates -- the arrival road, the churches where the dead wake, the coach stops, the barbers, the guild vendors, the gardens, the wild horses' meadows, the regions of the
 * property catalog -- is Kuttenberg's (`kutnohorsko`). On another level those coordinates are some other place, or none: a newcomer would stand in the air, and the dead would wake there.
 * So that content is only put into the world on Kuttenberg (`onKuttenberg`), and on another level the gamemode keeps to what the level itself offers: the game's own start point, a body that wakes where it fell,
 * and the panel and the administrator's panel, which carry no place. A file that cannot be read means Kuttenberg, which is how the server has always run.
 */

import { read } from "./store.js";

/** The level `server.json` names, or `kutnohorsko` (the default of the server) when it names none or cannot be read. */
export const DEFAULT_LEVEL = "kutnohorsko";

let cached: string | null = null;

/** The level this server runs, read once. */
export function levelName(): string {
    if (cached !== null) {
        return cached;
    }
    let name = DEFAULT_LEVEL;
    try {
        const loaded = read<{ mod?: { level?: unknown } }>("server.json");
        if (loaded.status === "ok") {
            const level = loaded.value?.mod?.level;
            if (typeof level === "string" && /^[a-z0-9_-]{1,40}$/i.test(level.trim())) {
                name = level.trim().toLowerCase();
            }
        }
    } catch {
        // Kuttenberg, as always.
    }
    cached = name;
    return name;
}

/** Whether the level is Kuttenberg's, the one this gamemode's places are written for. */
export function onKuttenberg(): boolean {
    return levelName() === DEFAULT_LEVEL;
}

/** Forgets what was read (the tests change the file). */
export function forgetLevel(): void {
    cached = null;
}
