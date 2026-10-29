/**
 * What it costs a player to change their guild or their citizenship (user, 2026-10-26: "tanto as guildas como a cidadania, o jogador pode
 * alterar uma vez grátis; depois custa 100 moedas para alterar a guilda ou a cidadania").
 *
 * The first change of each kind is the player's free one (`free-changes.ts`); every change after it is paid, `CHANGE_PRICE_COINS` out of the
 * bag, and refused with the reason when there is not that much. The caller checks that the change can be made (the guild or the town
 * exists and is another than the one the player has) before it asks for the charge, and hands the coins back with `refund` if the change
 * then fails after all.
 */

import { CHANGE_PRICE_COINS, freeChangeLeft, useFreeChange } from "./free-changes.js";
import type { FreeChange } from "./free-changes.js";
import { coins, giveMoney, MONEY_UNIT, moneyOf, takeMoney } from "./money.js";

/** The price in units of the money item (the game shows a tenth of them). */
export const CHANGE_PRICE_UNITS = CHANGE_PRICE_COINS * MONEY_UNIT;

export interface Fee {
    readonly ok: boolean;
    /** The player's free change was the payment. */
    readonly free: boolean;
    /** Why not, when not. */
    readonly message: string;
    /** Gives the coins back; nothing for a free change. */
    readonly refund: () => void;
}

const nothing = (): void => undefined;

/** Takes the free change or the price of a change of this kind. */
export function chargeForChange(player: Player, kind: FreeChange): Fee {
    if (player.steamId === "") {
        return { ok: false, free: false, message: "Sua conta não tem identificação Steam, então a troca não poderia ser salva.", refund: nothing };
    }
    if (freeChangeLeft(player.steamId, kind) && useFreeChange(player.steamId, kind)) {
        return { ok: true, free: true, message: "", refund: nothing };
    }
    const have = moneyOf(player);
    if (have < CHANGE_PRICE_UNITS) {
        return { ok: false, free: false, message: `Trocar custa ${coins(CHANGE_PRICE_UNITS)} (a sua troca gratuita já foi usada) e você tem ${coins(have)}.`, refund: nothing };
    }
    if (!takeMoney(player, CHANGE_PRICE_UNITS)) {
        return { ok: false, free: false, message: "As moedas não puderam ser cobradas agora: espere o inventário terminar de atualizar e tente de novo.", refund: nothing };
    }
    return {
        ok: true,
        free: false,
        message: "",
        refund: () => {
            giveMoney(player, CHANGE_PRICE_UNITS);
        },
    };
}
