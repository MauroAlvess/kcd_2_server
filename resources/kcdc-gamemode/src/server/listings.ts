/**
 * The engine's listings of what is in the world -- `Player.all()`, `Horse.all()`, `Cart.all()` -- are not free: every call walks the engine's table of
 * entities, about 0.2 ms in a small test world and about 1.4 ms in this one (2026-10-27: every timer of ours that only asked who is online cost 1.3-1.5 ms a
 * call, with seven players and with sixteen alike, so the price is the world's and not the players'; dice, the dog's and the horse's menus, the cows, the
 * wild horses, the lock-on, the animals, the carts... ask for it some thirty times a second between them, which was most of the 5% of a core our code takes
 * with seven players, and a cost that more players would only add to). Reading a property of what the list holds is cheap (0.3-1.4 us, measured on a copy of
 * the live server), so the list is the thing to keep.
 *
 * Each of the three is kept: an answer is reused for `MAX_AGE_MS` (a list per world for the carts), and the events that change who is in it end it at once --
 * somebody connects, a horse or a cart appears. A body that is leaving is the one thing the events say before the engine does (`playerDisconnect` comes
 * "before their body is destroyed"): from then on nothing is kept, and every call is the engine's own as before, until the engine's list no longer holds it
 * (or `LEAVING_MAX_MS` has passed). Every caller is given an array of its own, to sort or cut as it pleases.
 *
 * The report of `perf-watch.ts` says how many calls were asked and how many reached the engine (`globalThis.__kcdcListings`, set here).
 */

declare const performance: { now(): number } | undefined;

/** How long an answer is kept when no event ends it. Who is in the world changes by events; this is only the net under them. */
export const MAX_AGE_MS = 2_000;
export const HORSES_AGE_MS = 1_000;
/** A leaving body that the engine still lists is given up on after this long (it never got destroyed, or the event was not its own). */
export const LEAVING_MAX_MS = 5_000;

interface Listed {
    readonly id: number;
}

interface Kept {
    readonly name: string;
    readonly maxAgeMs: number;
    /** Calls asked for, calls that reached the engine, and how long those took, since the last report. */
    asked: number;
    real: number;
    spentMs: number;
    readonly lists: Map<string, { readonly at: number; readonly items: Listed[] }>;
    /** Bodies announced as leaving and not yet gone from the engine's own list, by id and when. */
    readonly leaving: Map<number, number>;
    restore(): void;
}

const kept: Kept[] = [];

const clock = (): number => (typeof performance !== "undefined" && performance !== undefined ? performance.now() : Date.now());

/** Puts a keeper in front of `owner.all`. Done once: a second call finds the first one's marker and leaves it. */
function keep<T extends Listed>(owner: { all: (virtualWorld?: number) => T[] }, name: string, maxAgeMs: number): Kept | null {
    const original = owner.all;
    if (typeof original !== "function" || (original as unknown as { kcdcKept?: boolean }).kcdcKept === true) {
        return null;
    }
    const state: Kept = {
        name,
        maxAgeMs,
        asked: 0,
        real: 0,
        spentMs: 0,
        lists: new Map(),
        leaving: new Map(),
        restore: () => {
            owner.all = original;
        },
    };
    const wrapped = (virtualWorld?: number): T[] => {
        state.asked += 1;
        const key = virtualWorld === undefined ? "*" : String(virtualWorld);
        const now = Date.now();
        const hit = state.lists.get(key);
        if (hit !== undefined && state.leaving.size === 0 && now - hit.at < state.maxAgeMs) {
            return hit.items.slice() as T[];
        }
        const began = clock();
        const items = virtualWorld === undefined ? original.call(owner) : original.call(owner, virtualWorld);
        state.spentMs += clock() - began;
        state.real += 1;
        for (const [id, since] of [...state.leaving]) {
            if (now - since > LEAVING_MAX_MS || !items.some((item) => item.id === id)) {
                state.leaving.delete(id);
            }
        }
        if (state.leaving.size === 0) {
            state.lists.set(key, { at: now, items: items.slice() });
        }
        return items;
    };
    (wrapped as unknown as { kcdcKept: boolean }).kcdcKept = true;
    owner.all = wrapped;
    kept.push(state);
    return state;
}

const fixed = (n: number): string => n.toFixed(2).replace(".", ",");

/** What the listings did since the last call, for the performance report; counters start again. Empty when nothing was asked. */
export function listingsReport(): string {
    const parts: string[] = [];
    for (const one of kept) {
        if (one.asked > 0) {
            parts.push(`${one.name}.all() ${one.real} no motor de ${one.asked} pedidos${one.real > 0 ? ` (${fixed(one.spentMs / one.real)} ms cada)` : ""}`);
        }
        one.asked = 0;
        one.real = 0;
        one.spentMs = 0;
    }
    return parts.length === 0 ? "" : `; listas: ${parts.join(" | ")}`;
}

/** Who is leaving, or has come, ends the answers that were kept. */
function watch(state: Kept | null, comes: readonly string[], goes: readonly string[]): void {
    if (state === null) {
        return;
    }
    for (const name of comes) {
        Events.on(name as "playerConnect", () => {
            state.lists.clear();
        });
    }
    for (const name of goes) {
        Events.on(name as "playerDisconnect", (body: Listed) => {
            state.lists.clear();
            if (body !== null && body !== undefined && typeof body.id === "number") {
                state.leaving.set(body.id, Date.now());
            }
        });
    }
}

export function installListings(): void {
    try {
        const players = keep(Player, "Player", MAX_AGE_MS);
        const horses = typeof Horse === "undefined" ? null : keep(Horse, "Horse", HORSES_AGE_MS);
        const carts = typeof Cart === "undefined" ? null : keep(Cart, "Cart", HORSES_AGE_MS);
        watch(players, ["playerConnect"], ["playerDisconnect"]);
        watch(horses, ["horseSpawn"], ["horseDestroy"]);
        watch(carts, ["cartSpawn"], ["cartDestroy"]);
        (globalThis as unknown as Record<string, unknown>)["__kcdcListings"] = listingsReport;
        Events.on("resourceStop", (name) => {
            if (name === "kcdc-gamemode") {
                for (const one of kept) {
                    one.restore();
                }
                kept.length = 0;
                delete (globalThis as unknown as Record<string, unknown>)["__kcdcListings"];
            }
        });
    } catch (error: unknown) {
        console.log(`listings: não consegui guardar as listas do motor (${error instanceof Error ? error.message : String(error)}); o servidor segue como antes`);
    }
}
