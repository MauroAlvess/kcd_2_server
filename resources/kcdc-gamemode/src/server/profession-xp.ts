/**
 * How fast the trades level up (user, 2026-10-27: "o up das profissões está muito hard, tanto que não chega a upar nem um nível em um dia de jogo, principalmente agricultor").
 *
 * What the guilds' work gives is XP of the game's own skill tracks (the forge's and the sewing's `craftsmanship`, the garden's, the fire's and the smokehouse's `survival`, the
 * alchemy table's `alchemy`...), through `player.addXp`, which the game's rates do not touch ("Your rates, budgets and caps do not apply to them: those limit what players
 * earn, not what you give"). Each recipe, crop and swing has its XP in the tables of the modules; this is the one number all of them are multiplied by on the way out, so the
 * pace of every trade is set, and changed, in one place (`/xpoficios`), and what the pages and the chat say a piece of work gave is what it gave.
 *
 * A module with no dependencies, so that the ones that give XP (`craft.ts`, `farm.ts`, `gather.ts`, `cows.ts`) can be tried without it.
 */
export const professionXp = {
    /** Times the tables' XP. 1 is as the tables have it. */
    rate: 4,
};

/** What an administrator may choose. */
export const RATE_MIN = 1;
export const RATE_MAX = 20;

/** The XP paid for `xp` of the tables: at least 1 for any work that gives some, none for none. */
export function paid(xp: number): number {
    return xp > 0 ? Math.max(1, Math.round(xp * professionXp.rate)) : 0;
}
