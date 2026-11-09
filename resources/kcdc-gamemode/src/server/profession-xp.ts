/**
 * How fast the trades level up: one standard for all of them (2026-11-03, user: "vamos padronizar tudo, xp ganho em profissões e etc, vamos refazer o balanceamento de up; a ideia é
 * deixar tudo em um nível médio padronizado que faça sentido").
 *
 * What the guilds' work gives is XP of the game's own skill tracks (the forge's and the sewing's `craftsmanship`, the garden's, the fire's and the smokehouse's `survival`, the
 * alchemy table's `alchemy`...), through `player.addXp`, which the game's rates do not touch ("Your rates, budgets and caps do not apply to them: those limit what players
 * earn, not what you give"). Each recipe, crop and swing has its XP in the tables of the modules; on the way out it is multiplied by its trade's rate here, so the pace of every
 * trade is set, and changed, in one place (`/xpoficios`), and what the pages and the chat say a piece of work gave is what it gave.
 *
 * **The standard.** An hour of steady work pays about the same in every trade: what an hour in the gardens pays (about 700 XP, read off the logs of 2026-10-28 to 11-02), the pace the
 * user had found right for the farmers (2026-10-27: "o up das profissões está muito hard ... principalmente agricultor", then four times the tables). The same logs had the forge,
 * the alchemy table and the felling at three to four times that (a smith went from level 7 to 24 of craftsmanship in seven hours, another made 64 thousand XP in a day, when the
 * whole climb from 5 to 30 is about 13 thousand), the fire and the smokehouse at twice it, and the needle under it. So the forge, the alchemy table, the felling, the quarrying and
 * the work on the harvest pay the tables' own XP; the fire, the smokehouse and the rack twice it; the gardens, the milking and the shearing four times, as before; the needle five
 * times. The first steps of a chain (charcoal, smelting, thread, boiled water) pay a quarter of their recipe besides (`craft.ts`).
 *
 * **The day's limit.** The first `dailyFull` XP a player earns in one track from the trades in a day (Brasília's, midnight to midnight) are paid whole, and every piece past them
 * pays `overShare` of itself: a whole day at the anvil is still worth more than an hour, but nobody climbs twenty levels between lunch and supper. The game's own XP (fights,
 * riding, the skill books) is not counted.
 *
 * A module with no dependencies, so that the ones that give XP (`craft.ts`, `farm.ts`, `gather.ts`, `cows.ts`, `sheep.ts`) can be tried without it; what is kept on disk is
 * `profession-xp-settings.ts`'s.
 */

/** Where a piece of work was done: a station of the trades' page, or the work of the gardens, the trees and rocks and the beasts. */
export type Trade = "forja" | "costura" | "fogo" | "defumador" | "secador" | "alquimia" | "horta" | "beneficiar" | "lenha" | "mina" | "ordenha" | "tosquia";

/** Times the tables' XP each trade pays at the standard. */
export const STANDARD_RATES: Readonly<Record<Trade, number>> = {
    forja: 1,
    alquimia: 1,
    lenha: 1,
    mina: 1,
    beneficiar: 1,
    fogo: 2,
    defumador: 2,
    secador: 2,
    horta: 4,
    ordenha: 4,
    tosquia: 4,
    costura: 5,
};

/** The rates in use: the standard's, unless a test asks for the tables' own. */
export const TRADE_RATES: Record<Trade, number> = { ...STANDARD_RATES };

/** The XP of one track paid whole in a day, and the share of a piece paid past it. */
export const DAILY_FULL_XP = 2_500;
export const OVER_SHARE = 0.25;

export const professionXp = {
    /** The administrators' knob (`/xpoficios <fator>`): times every trade's own rate. 1 is the standard. */
    rate: 1,
    /** The XP of one track a player earns at the full pace in a day; 0 is no limit. */
    dailyFull: DAILY_FULL_XP,
    /** What a piece past it pays, of itself. */
    overShare: OVER_SHARE,
};

/** What an administrator may choose. */
export const RATE_MIN = 0.25;
export const RATE_MAX = 5;
export const DAILY_MAX = 50_000;

/** The XP the tables' `xp` pays in `trade`, before the day's limit (what a page shows a newcomer): at least 1 for any work that gives some, none for none. */
export function paid(xp: number, trade: Trade): number {
    return xp > 0 ? Math.max(1, Math.round(xp * (TRADE_RATES[trade] ?? 1) * professionXp.rate)) : 0;
}

// ---------------------------------------------------------------------------------------------
// The day's ledger: what each player has earned of each track today.

interface Day {
    day: string;
    tracks: Record<string, number>;
}

const ledger = new Map<string, Day>();

/** Told when the ledger changed (to keep it), and when a player has just gone past the day's limit in a track (to tell them). Set by `profession-xp-settings.ts`. */
export const ledgerHooks: { changed: () => void; crossed: (who: string, track: string) => void } = {
    changed: () => undefined,
    crossed: () => undefined,
};

/** Brasília's day of a moment, "2026-11-03": the limit comes back at its midnight (03:00 UTC). */
export function dayOf(now: number): string {
    return new Date(now - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** The XP a player has earned of a track today, at the full pace (what was paid past the limit counts whole). */
export function earnedToday(who: string, track: string, now: number = Date.now()): number {
    const entry = ledger.get(who);
    return entry !== undefined && entry.day === dayOf(now) ? (entry.tracks[track] ?? 0) : 0;
}

/** What a piece worth `xp` pays a player who has earned `earned` today: whole up to the limit, `overShare` past it, at least 1 for any work that gives some. */
export function afterLimit(earned: number, xp: number): number {
    if (xp <= 0) {
        return 0;
    }
    if (professionXp.dailyFull <= 0) {
        return xp;
    }
    const whole = Math.max(0, Math.min(xp, professionXp.dailyFull - earned));
    return Math.max(1, Math.round(whole + (xp - whole) * professionXp.overShare));
}

/** What a piece worth `xp` (as `paid` says) would give this player now, without counting it: what the pages show. */
export function quote(who: string, track: string, xp: number, now: number = Date.now()): number {
    return afterLimit(earnedToday(who, track, now), xp);
}

/** Counts a piece worth `xp` (as `paid` says) to the player's day and says what it gives. */
export function award(who: string, track: string, xp: number, now: number = Date.now()): number {
    if (xp <= 0) {
        return 0;
    }
    const day = dayOf(now);
    let entry = ledger.get(who);
    if (entry === undefined || entry.day !== day) {
        entry = { day, tracks: {} };
        ledger.set(who, entry);
    }
    const earned = entry.tracks[track] ?? 0;
    const given = afterLimit(earned, xp);
    entry.tracks[track] = earned + xp;
    ledgerHooks.changed();
    if (professionXp.dailyFull > 0 && earned < professionXp.dailyFull && earned + xp > professionXp.dailyFull) {
        ledgerHooks.crossed(who, track);
    }
    return given;
}

/** Today's ledger, to keep: the players who earned something today. */
export function ledgerSnapshot(now: number = Date.now()): Record<string, Day> {
    const day = dayOf(now);
    const out: Record<string, Day> = {};
    for (const [who, entry] of ledger) {
        if (entry.day === day) {
            out[who] = { day: entry.day, tracks: { ...entry.tracks } };
        }
    }
    return out;
}

/** Takes back a kept ledger: only today's entries, only numbers. */
export function restoreLedger(saved: unknown, now: number = Date.now()): number {
    ledger.clear();
    if (typeof saved !== "object" || saved === null) {
        return 0;
    }
    const day = dayOf(now);
    for (const [who, entry] of Object.entries(saved as Record<string, unknown>)) {
        if (typeof entry !== "object" || entry === null || (entry as Day).day !== day || typeof (entry as Day).tracks !== "object" || (entry as Day).tracks === null) {
            continue;
        }
        const tracks: Record<string, number> = {};
        for (const [track, xp] of Object.entries((entry as Day).tracks)) {
            if (typeof xp === "number" && Number.isFinite(xp) && xp > 0) {
                tracks[track] = Math.round(xp);
            }
        }
        ledger.set(who, { day, tracks });
    }
    return ledger.size;
}

/** The tables' XP as they are and no limit: for the tests of the work, not of the pace. */
export function useTables(): void {
    for (const trade of Object.keys(TRADE_RATES) as Trade[]) {
        TRADE_RATES[trade] = 1;
    }
    professionXp.rate = 1;
    professionXp.dailyFull = 0;
    ledger.clear();
}

/** Back to the standard: the trades' rates, the factor 1, the day's limit. */
export function useStandard(): void {
    Object.assign(TRADE_RATES, STANDARD_RATES);
    professionXp.rate = 1;
    professionXp.dailyFull = DAILY_FULL_XP;
    professionXp.overShare = OVER_SHARE;
    ledger.clear();
}
