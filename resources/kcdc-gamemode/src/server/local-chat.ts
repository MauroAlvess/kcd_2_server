/**
 * Who reads a line typed in T (user, 2026-10-25: "as mensagens no T devem só chegar para a região, essa vila ou cidade; quem estiver mais
 * longe não pode ver as mensagens").
 *
 * The framework relays a plain chat line to everybody. That relay is switched off here and the line is delivered by us, to the players of the
 * speaker's own world who are
 *   - in the same region: a village or a town of `REGIONS` (`properties.ts`), taken from the map's own outline of the place where the level
 *     has one, from the box of the list where it has not; the fortress and the mill of a village are inside its region; or
 *   - within `NEAR_M` metres of the speaker, in a region or not (the gate of a village, the road just outside it); or
 *   - in the open country, the speaker and the reader both, and within `OPEN_M` metres.
 * The speaker always reads their own line. It goes out under the account's nickname, as the framework's relay sent it; the lines of /me, /do and
 * /try (`roleplay.ts`) keep their own reach and their own way of naming. Whoever speaks for the first time after joining is told how far the
 * chat carries, once, so that an empty chat is not taken for a broken one.
 */

import { distanceBetween } from "./place.js";
import { mappedRegions } from "./properties.js";
import { tidyText } from "./roleplay.js";

const RESOURCE = "kcdc-gamemode";

/** Within this many metres a line is read whatever the regions, in metres. */
export const NEAR_M = 30;

/** In the open country, both of them outside every region, a line carries this far, in metres: a little past a shout (25 m). */
export const OPEN_M = 50;

/** The longest line delivered, in characters: our chat page stops a writer at 300, so more only comes from a client that was changed. */
export const CHAT_MAX = 400;

export const NOTICE = "O chat (T) chega só a quem está na mesma vila ou cidade que você, ou a até 30 metros de você; no campo aberto, a até 50 metros.";

export interface Zone {
    readonly id: string;
    readonly name: string;
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
}

let zones: readonly Zone[] | null = null;

/** The regions of the map as boxes, read once: the level does not change while the server runs. */
function zonesNow(): readonly Zone[] {
    if (zones === null) {
        try {
            zones = mappedRegions();
        } catch (error: unknown) {
            console.log(`chat: não consegui ler as regiões do mapa (${error instanceof Error ? error.message : String(error)}); só a distância vale`);
            zones = [];
        }
    }
    return zones;
}

/** The regions a point stands in: usually one, none in the open country. */
export function regionsAt(position: { readonly x: number; readonly y: number }): readonly Zone[] {
    return zonesNow().filter((zone) => position.x >= zone.minX && position.x <= zone.maxX && position.y >= zone.minY && position.y <= zone.maxY);
}

/** Whether a reader of the speaker's world takes in what the speaker says. */
function hears(speaker: Player, here: readonly Zone[], other: Player): boolean {
    if (!other.ready || other.virtualWorld !== speaker.virtualWorld) {
        return false;
    }
    const distance = distanceBetween(other.position, speaker.position);
    if (distance <= NEAR_M) {
        return true;
    }
    const there = regionsAt(other.position);
    if (here.length > 0 || there.length > 0) {
        return here.some((zone) => there.some((another) => another.id === zone.id));
    }
    return distance <= OPEN_M;
}

/** Who reads what the speaker says, the speaker first. A speaker whose body has not reported yet is read by nobody else. */
export function readersOf(speaker: Player, everybody: readonly Player[] = Player.all()): Player[] {
    const readers: Player[] = [speaker];
    if (!speaker.ready) {
        return readers;
    }
    const here = regionsAt(speaker.position);
    for (const other of everybody) {
        if (other.id !== speaker.id && hears(speaker, here, other)) {
            readers.push(other);
        }
    }
    return readers;
}

/** The ones who have been told how far the chat carries, by connection. */
const told = new Set<number>();

/** Delivers a line to the ones who read it. Returns how many did, the speaker included; a line with only spaces in it, or too long, is not sent. */
export function speak(speaker: Player, text: string, everybody: readonly Player[] = Player.all()): number {
    const line = tidyText([text]);
    if (line === "") {
        return 0;
    }
    if (line.length > CHAT_MAX) {
        Chat.sendToPlayer(speaker, `Muito longo: no máximo ${CHAT_MAX} letras (você escreveu ${line.length}).`);
        return 0;
    }
    const readers = readersOf(speaker, everybody);
    for (const reader of readers) {
        try {
            Chat.sendToPlayer(reader, line, { author: speaker.nickname });
        } catch {
            // Gone between the list and the send.
        }
    }
    if (!told.has(speaker.id)) {
        told.add(speaker.id);
        Chat.sendToPlayer(speaker, NOTICE);
    }
    const present = everybody.filter((other) => other.id !== speaker.id && other.ready && other.virtualWorld === speaker.virtualWorld).length;
    const where = speaker.ready ? regionsAt(speaker.position).map((zone) => zone.name).join(" e ") : "";
    console.log(`chat: ${speaker.nickname} em ${where === "" ? "campo aberto" : where}: lido por ${readers.length - 1} de ${present}`);
    return readers.length;
}

/** Takes the delivery of T from the framework. Should it not let go, the chat stays as it was: everybody reads everybody, twice never. */
export function installLocalChat(): void {
    try {
        Chat.setDefaultRelay(false);
        if (Chat.isDefaultRelay()) {
            console.log("chat: o relé do framework não se desligou; o chat continua para todos");
            return;
        }
    } catch (error: unknown) {
        console.log(`chat: não consegui desligar o relé do framework (${error instanceof Error ? error.message : String(error)}); o chat continua para todos`);
        return;
    }
    Events.on("playerChat", (player, text) => {
        try {
            speak(player, text);
        } catch (error: unknown) {
            console.log(`chat: falhou ao entregar uma linha de ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
    });
    // Should the resource stop alone, the chat goes back to the framework instead of falling silent.
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            try {
                Chat.setDefaultRelay(true);
            } catch {
                // The server is going away.
            }
        }
    });
}
