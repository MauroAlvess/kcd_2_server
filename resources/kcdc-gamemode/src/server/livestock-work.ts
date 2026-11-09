/**
 * Who is at work on a farm animal. The milking of a cow (`cows.ts`) and the shearing of a sheep (`sheep.ts`, 2026-10-31) both hold the body in an animation until they end, so a farmer
 * does one at a time: each looks here before it begins and writes here while it lasts.
 */

const at = new Map<number, string>();

export const livestockWork = {
    /** What the player is doing at an animal ("ordenha", "tosquia"), or "" for nothing. */
    of(playerId: number): string {
        return at.get(playerId) ?? "";
    },

    begin(playerId: number, what: string): void {
        at.set(playerId, what);
    },

    end(playerId: number): void {
        at.delete(playerId);
    },
};
