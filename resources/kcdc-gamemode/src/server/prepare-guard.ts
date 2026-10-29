/**
 * The game's own cooking, drying and smoking, refused (KCDC 1.7.0).
 *
 * Until 1.7.0 the server never heard of them: the game did them on the player's own machine and what it made was never handed
 * over, which is why `cooking.ts` does the swap by hand. From 1.7.0 the game's own work counts: when its animation ends the server
 * converts the rows and gives the survival XP, unless a handler of `playerPreparing` says no (the items stay as they were and the
 * player's game puts them back).
 *
 * At first the trade that owned the place was let through (the fire the innkeepers', the rack the alchemists', the smokehouse the
 * hunters'). That skipped the trades' page (user, 2026-10-21: "jogador caçador reportou que tava conseguindo defumar carne pelo inventário;
 * acredito que outras guildas estavam conseguindo fazer coisas do tipo; isso não pode, o correto é só nas mesas de ofícios de cada guilda"):
 * the game's smokehouse and rack open a goods screen that looks like the bag, and whatever was put in it came out smoked or dried at once,
 * with no recipe and no level asked. Now the game's own preparation is refused to everybody, and the work is done on the trades' page
 * only: E at the smokehouse and the rack, F at the fire (`cook-hint.ts`). The game's forge and alchemy table are not these: the smiths'
 * books teach the game's own smithing, and a potion is brewed in the game's own minigame (`guild-crafts.ts` keeps them to their trades).
 */

import { mayCraft, refusal } from "./guild-crafts.js";
import type { Craft } from "./guild-crafts.js";

/** What the game's three preparations are, in the trades' own words. */
export const PREPARATION_CRAFT: Readonly<Record<string, Craft>> = { cook: "fogo", dry: "secador", smoke: "defumador" };

/** Where each is done instead, for whoever is of the trade. */
export const PREPARATION_PLACE: Readonly<Record<string, string>> = {
    cook: "no fogo, com a tecla F (Cozinhar)",
    dry: "no secador, com a tecla E (Secar)",
    smoke: "no defumador, com a tecla E (Defumar)",
};

export const prepareGuard = {
    /** A player refused again within this long is not told again (the game's animation may run several rows). */
    tellEveryMs: 5_000,
};

/** Whether the game's own preparation of this kind may be converted: none of the three may; one the game adds one day is left alone. */
export function mayPrepare(_player: Player, kind: string): boolean {
    return PREPARATION_CRAFT[kind] === undefined;
}

/** What a player whose preparation was refused is told: where it is done, for one of the trade; whose trade it is, for anybody else. */
export function refusalOf(player: Player, kind: string): string {
    const craft = PREPARATION_CRAFT[kind] as Craft;
    return mayCraft(player, craft) ? `Isso se faz pela página de ofícios: ${PREPARATION_PLACE[kind] ?? "na mesa do ofício"}. A tela do próprio jogo não serve.` : refusal(craft);
}

export function installPrepareGuard(): void {
    const told = new Map<number, number>();
    Events.on("playerPreparing", (player, preparation) => {
        if (mayPrepare(player, preparation.kind)) {
            return undefined;
        }
        const craft = PREPARATION_CRAFT[preparation.kind] as Craft;
        const now = Date.now();
        if (now - (told.get(player.id) ?? -Infinity) >= prepareGuard.tellEveryMs) {
            told.set(player.id, now);
            Chat.sendToPlayer(player, refusalOf(player, preparation.kind));
        }
        console.log(`prepare-guard: ${player.nickname} usou a tela do jogo (${craft}): ${preparation.items.length} linha(s) em ${preparation.station} ficam como estavam`);
        return false;
    });
    Events.on("playerDisconnect", (player) => told.delete(player.id));
}
