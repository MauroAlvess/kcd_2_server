/**
 * The chat's roleplay lines: `/me` (what the character does), `/do` (what the scene shows) and `/try` (an attempt that
 * works or does not). Each is heard by the players near the speaker, in the same virtual world, and by the speaker; the
 * speaker is named the way each listener knows them ("Desconhecido" until introduced, see `acquaintances.ts`), never by
 * the account's nickname.
 */

import { labelFor } from "./acquaintances.js";
import { distanceBetween } from "./place.js";

export type RoleplayKind = "me" | "do" | "try";

/** How far a roleplay line carries, in metres: about as far as a raised voice. */
export const ROLEPLAY_RANGE = 30;

/** The longest line, in characters; a longer one is refused rather than cut, so nobody is made to say what they did not write. */
export const TEXT_MAX = 240;

/** The chance an attempt works. */
export const TRY_SUCCESS_CHANCE = 0.5;

/** Chat colours, `0xRRGGBBAA`. */
export const COLOURS: Readonly<Record<RoleplayKind | "success" | "failure", number>> = {
    me: 0xc8a2ffff,
    do: 0x7fd1b9ff,
    try: 0xe8d9a0ff,
    success: 0x9be37aff,
    failure: 0xe87a7aff,
};

/** The words a player typed as one line: spaces folded, control characters gone, and a line that was only spaces is empty. */
export function tidyText(words: readonly string[]): string {
    // eslint-disable-next-line no-control-regex
    return words.join(" ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Whether an attempt works, from a roll in [0, 1). */
export function attemptWorks(roll: number): boolean {
    return roll < TRY_SUCCESS_CHANCE;
}

/** The line a listener reads. `works` only matters to `/try`. */
export function lineFor(kind: RoleplayKind, name: string, text: string, works = true): string {
    switch (kind) {
        case "me":
            return `* ${name} ${text}`;
        case "do":
            return `* ${text} (( ${name} ))`;
        case "try":
            return `* ${name} tenta ${text} e ${works ? "consegue" : "falha"}.`;
    }
}

/** Who hears a speaker: the speaker, and every ready player of their world within range. */
export function listenersOf(speaker: Player, everybody: readonly Player[] = Player.all()): Player[] {
    return everybody.filter((other) => other.id === speaker.id || (other.ready && other.virtualWorld === speaker.virtualWorld && distanceBetween(other.position, speaker.position) <= ROLEPLAY_RANGE));
}

/** Says it to everybody in earshot, each hearing the name they know the speaker by. Returns how many heard it, the speaker included. */
export function say(speaker: Player, kind: RoleplayKind, text: string, roll: number = Math.random()): number {
    const works = kind === "try" ? attemptWorks(roll) : true;
    const colour = kind === "try" ? (works ? COLOURS.success : COLOURS.failure) : COLOURS[kind];
    const heard = listenersOf(speaker);
    for (const listener of heard) {
        Chat.sendToPlayer(listener, lineFor(kind, labelFor(listener, speaker), text, works), { color: colour });
    }
    return heard.length;
}
