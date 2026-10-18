/**
 * Cooking, drying and smoking (user, 2026-10-16: "a carne que cozinhei no fogo não entrou na bolsa nem consumiu a carne
 * crua"; then "vamos usar um macete: o jogador tenta cozinhar x item, a gente tira do inventário e entrega com o give, e
 * podemos fazer isso com todos os ofícios"). The game does these on the player's own machine, and the multiplayer mod
 * keeps every inventory on the server, which hears nothing of them (it carries only alchemy, smithing, repair and
 * sharpening over): the raw meat stayed, the cooked one never came. So the server does what the game would have done, for
 * a player who stands at the place the level makes it at:
 *
 * - a fire (the level's fireplaces, its stew pots, the roadside camps) cooks;
 * - a butcher's rack (`butcher_dryer`) dries;
 * - a smokehouse (`butcher_smokeHouse`) smokes.
 *
 * The player asks in one of two ways. `/cozinhar` does everything they carry that the place can make something of. And the
 * inventory's "Usar" on a raw meat or fish (taken over, `src/client/item-uses.ts`) does the stack it was pressed on. What
 * a food becomes is in the game's tables (`cooking-data.ts`, `tools/make-cooking.py`), where the places are in the level
 * (`stations-data.ts`, `tools/make-stations.py`); the swap is one for one, the raw taken and the made handed over.
 * Each place belongs to a trade (user, 2026-10-17): the fire to the innkeepers, the rack and the smoker to the hunters
 * (`guild-crafts.ts`).
 */

import { COOKED, DRIED, MEATS, SMOKED } from "./cooking-data.js";
import { mayCraft, refusal } from "./guild-crafts.js";
import { sendItemUses } from "./item-uses.js";
import { itemLine } from "./item-names.js";
import { STATIONS } from "./stations-data.js";
import type { StationKind } from "./stations-data.js";
import { CAMPS } from "./vendors.js";

const RESOURCE = "kcdc-gamemode";

export const cookingSettings = { nearM: 4, upM: 3 };

const WAYS: Readonly<Record<StationKind, { readonly foods: Readonly<Record<string, string>>; readonly done: string }>> = {
    fogo: { foods: COOKED, done: "cozinhou" },
    secador: { foods: DRIED, done: "secou" },
    defumador: { foods: SMOKED, done: "defumou" },
};

type Station = readonly [StationKind, number, number, number];

function stations(): Station[] {
    return [
        ...STATIONS,
        ...CookPot.all().map((pot): Station => ["fogo", pot.position.x, pot.position.y, pot.position.z]),
        ...CAMPS.map((camp): Station => ["fogo", camp.fire.x, camp.fire.y, camp.fire.z]),
    ];
}

/** The kinds of place within reach of a point, the nearest first. */
export function stationsNear(position: { readonly x: number; readonly y: number; readonly z: number }): StationKind[] {
    const near = stations()
        .map((station) => ({ kind: station[0], distance: Math.hypot(station[1] - position.x, station[2] - position.y), up: Math.abs(station[3] - position.z) }))
        .filter((station) => station.distance <= cookingSettings.nearM && station.up <= cookingSettings.upM)
        .sort((a, b) => a.distance - b.distance);
    return [...new Set(near.map((station) => station.kind))];
}

/** The places within `radius` of a point, for the client's "Cozinhar" hint: kind, x, y, z. */
export function stationPoints(position: { readonly x: number; readonly y: number }, radius: number): Station[] {
    return stations().filter((station) => Math.hypot(station[1] - position.x, station[2] - position.y) <= radius);
}

/** One thing the player carries that the place they stand at can make something of. */
export interface Cookable {
    /** The inventory row. */
    readonly id: string;
    readonly kind: StationKind;
    readonly amount: number;
    /** What the player is shown: "3x Carne de coelho". */
    readonly text: string;
}

/** What the player carries that the places within reach, those of their trade, can make something of. */
export function cookables(player: Player): Cookable[] {
    const allowed = stationsNear(player.position).filter((candidate) => mayCraft(player, candidate));
    return (Inventory.get(player)?.items ?? []).flatMap((row) => {
        const kind = row.amount > 0 ? allowed.find((candidate) => WAYS[candidate].foods[row.item] !== undefined) : undefined;
        return kind === undefined ? [] : [{ id: row.id, kind, amount: row.amount, text: itemLine(row) }];
    });
}

/**
 * Cooks, dries or smokes what the player carries, at the place they stand at: every row, or only `only` (a row id). Returns
 * what to tell them.
 */
export function cook(player: Player, only?: string): string {
    const here = stationsNear(player.position);
    if (here.length === 0) {
        return "Não há fogo, secador nem defumador aqui perto. Chegue junto de uma lareira ou fogueira (cozinha), de um secador de açougueiro (seca) ou de um defumador (defuma).";
    }
    // Each place belongs to a trade (`guild-crafts.ts`): the fire to the innkeepers, the rack and the smoker to the hunters.
    const allowed = here.filter((candidate) => mayCraft(player, candidate));
    if (allowed.length === 0) {
        return refusal(here[0] as StationKind);
    }
    const state = Inventory.get(player);
    const work = (state?.items ?? [])
        .filter((row) => row.amount > 0 && (only === undefined || row.id === only))
        .flatMap((row) => {
            const kind = allowed.find((candidate) => WAYS[candidate].foods[row.item] !== undefined);
            return kind === undefined ? [] : [{ row, kind }];
        });
    if (state === null || work.length === 0) {
        return only === undefined ? "Você não leva nada que se possa fazer aqui: carne, peixe e comida crua no fogo; carne, peixe, queijo e frutas no secador; carne, peixe e queijo no defumador." : "Isto não se faz aqui: o fogo cozinha, o secador seca e o defumador defuma, e cada um só o que é dele.";
    }
    if (!Inventory.remove(player, { units: work.map(({ row }) => ({ id: row.id, amount: row.amount })), revision: state.revision }).ok) {
        return "Não consegui fazer isso agora. Tente de novo.";
    }
    const made: string[] = [];
    const verbs = new Set<string>();
    let kept = 0;
    for (const { row, kind } of work) {
        const item = WAYS[kind].foods[row.item] as string;
        if (Inventory.add(player, { item, amount: row.amount }).ok) {
            made.push(itemLine({ item, amount: row.amount }));
            verbs.add(WAYS[kind].done);
        } else {
            // What could not be made goes back as it was, rather than be lost.
            Inventory.add(player, { item: row.item, amount: row.amount, metadata: row.metadata, notify: false });
            kept += row.amount;
        }
    }
    const done = [...verbs].join(" e ");
    console.log(`cooking: ${player.nickname} ${done || "tentou"} ${made.length > 0 ? made.join(", ") : "nada"}${kept > 0 ? `; ${kept} ficou(aram) como estava(m)` : ""}`);
    if (made.length === 0) {
        return "Não consegui fazer isso agora. Tente de novo.";
    }
    return `Você ${done} no local: ${made.join(", ")}.${kept > 0 ? " Parte não coube e ficou como estava." : ""}`;
}

export function installCooking(): void {
    Events.on("playerReady", (player) => sendItemUses(player, "cook.use", MEATS));
    Events.onClient(`${RESOURCE}:cook.use`, (sender, payload) => {
        const player = sender as Player;
        let id: unknown;
        try {
            id = ((typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown } | null)?.id;
        } catch {
            return;
        }
        if (typeof id !== "string" || !player.alive) {
            return;
        }
        const text = cook(player, id);
        Chat.sendToPlayer(player, text);
        player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
    });
}
