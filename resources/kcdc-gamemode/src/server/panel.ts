/**
 * The server half of the debug panel (F4): what its client cannot see for itself.
 * Answered on demand, so a panel nobody has open costs nothing.
 *
 * The panel is for administrators only. A press of F4 reaches here as `panel.request`, and only an
 * admin is answered with `panel.open`; `panel.poll`, which carries the roster and the command list,
 * is checked again, because a modified client could send it without ever being asked to open.
 */

import { isAdmin } from "./auth.js";
import { emitLarge } from "./big-emit.js";
import type { CommandRegistry } from "./command.js";

const RESOURCE = "kcdc-gamemode";

/** A player who presses F4 over and over is told once, not once per press. */
const REFUSAL_GAP_MS = 8000;

function world(): Record<string, unknown> {
    return {
        day: World.day,
        hour: World.hour,
        timeScale: World.timeScale,
        weather: World.weather,
        previousWeather: World.previousWeather,
        blending: World.weatherBlending,
        blendRemaining: World.weatherRemaining,
        rainIntensity: World.rainIntensity,
        rainAmount: World.rainAmount,
        wetness: World.wetness,
        puddles: World.puddles,
    };
}

/**
 * The players the panel lists: the administrator and the `ROSTER_MAX` nearest to them (2026-11-02: every player of the server went in one message, which
 * with the commands' list was over the ~29 KB a client reads in one piece already, and with 512 players would be some 130 KB a poll).
 */
const ROSTER_MAX = 40;

function roster(viewer: Player): ReadonlyArray<Record<string, unknown>> {
    const at = viewer.position;
    const away = (player: Player): number => (player.id === viewer.id ? -1 : player.ready ? Math.hypot(player.position.x - at.x, player.position.y - at.y) : Number.POSITIVE_INFINITY);
    const nearest = Player.all()
        .map((player) => ({ player, distance: away(player) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, ROSTER_MAX + 1)
        .map((entry) => entry.player);
    return nearest.map((player) => ({
        id: player.id,
        slot: player.playerIndex,
        nickname: player.nickname,
        ready: player.ready,
        alive: player.alive,
        healthPercent: player.healthPercent,
        mounted: player.mounted,
        position: player.ready ? { x: player.position.x, y: player.position.y, z: player.position.z } : null,
    }));
}

function spawned(): Record<string, number> {
    return {
        horses: Horse.all().length,
        props: Prop.all().length,
        groundItems: GroundItem.all().length,
        doors: Door.all().length,
        gates: Gate.all().length,
    };
}

/** `/ui` and an admin's F4 are the only callers. */
export function openPanelFor(player: Player): void {
    // The payload is declared optional, but the native binding still counts
    // two arguments; an empty one is what build.ts sends for the same reason.
    player.emit(`${RESOURCE}:panel.open`, "");
}

export function installDebugPanel(registry: CommandRegistry): void {
    const refusedAt = new Map<number, number>();

    Events.onClient(`${RESOURCE}:panel.request`, (sender) => {
        const player = sender as Player;
        if (isAdmin(player)) {
            openPanelFor(player);
            return;
        }

        const now = Date.now();
        if (now - (refusedAt.get(player.id) ?? 0) < REFUSAL_GAP_MS) {
            return;
        }
        refusedAt.set(player.id, now);
        Chat.sendToPlayer(player, "O painel F4 é só para administradores.");
    });

    Events.onClient(`${RESOURCE}:panel.poll`, (sender) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        // In pieces when it is too big for one message (`big-emit.ts`): the commands' list alone is some 40 KB.
        emitLarge(
            player,
            "panel.realm",
            JSON.stringify({
                world: world(),
                players: roster(player),
                total: Player.all().length,
                spawned: spawned(),
                commands: registry.all().map((command) => ({ name: command.name, summary: command.summary, usage: command.usage })),
            }),
        );
    });

    Events.on("playerDisconnect", (player) => {
        refusedAt.delete(player.id);
    });

    console.log("debug panel answering administrators; F4 or /ui opens it");
}
