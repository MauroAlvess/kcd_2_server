/**
 * Whether this client is held in handcuffs or in a pillory (`arrest.ts` on the server tells it, `src/client/arrest.ts` acts on it). The pages of this resource that open on a key of their own (the panel,
 * the emote wheel) look here first, so that a player who is held opens nothing.
 */

let held = false;

export function isRestrained(): boolean {
    return held;
}

export function setRestrained(on: boolean): void {
    held = on;
}
