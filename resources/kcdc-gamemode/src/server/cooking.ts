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
 * Since KCDC 1.7.0 the server hears the game's own cooking, drying and smoking too (`playerPreparing`, kept to the trades by
 * `prepare-guard.ts`), and what they make stays made; the swap here stays the way to do many rows at once, and what our pages use.
 * Each place belongs to a trade (user, 2026-10-17): the fire to the innkeepers, the rack and the smoker to the hunters
 * (`guild-crafts.ts`).
 */

import { cookingAnimation, playCooking, stopCooking } from "./cook-animation.js";
import { COOKED, DRIED, MEATS, SMOKED } from "./cooking-data.js";
import { mayCraft, refusal } from "./guild-crafts.js";
import { sendItemUses } from "./item-uses.js";
import { itemLine } from "./item-names.js";
import { STATIONS } from "./stations-data.js";
import type { StationKind } from "./stations-data.js";
import { allowedTo, EDGE_M } from "./reach.js";
import { CAMPS } from "./vendors.js";

const RESOURCE = "kcdc-gamemode";

export const cookingSettings = {
    /** The fire's hearth: the one reach of our prompts (`reach.ts`, 2026-10-22) to its point, and a metre more for the press. */
    nearM: allowedTo(EDGE_M.fire),
    upM: 3,
    /** The rack is a frame and the smokehouse a hut with its point inside it: they are worked from a little farther off (the client's `cook-hint.ts` aims at them so). */
    nearBy: { secador: allowedTo(EDGE_M.rack), defumador: allowedTo(EDGE_M.hut) } as Readonly<Partial<Record<StationKind, number>>>,
};

const WAYS: Readonly<Record<StationKind, { readonly foods: Readonly<Record<string, string>>; readonly done: string }>> = {
    fogo: { foods: COOKED, done: "cozinhou" },
    secador: { foods: DRIED, done: "secou" },
    defumador: { foods: SMOKED, done: "defumou" },
};

type Station = readonly [StationKind, number, number, number];

/**
 * The pots of the level are in the level for good (nothing here makes one), and a list of them is a call into the engine for each pot and for each of its
 * three coordinates: asked for again by every player at every look of the cook menu (twenty players, three hundred pots, 2026-10-25: 70 ms of every look), it
 * was the heaviest thing of ours but one. So the list is kept and asked for again once a minute, which is how long a pot that does appear waits to count.
 */
export const POTS_KEPT_MS = 60_000;
let pots: { at: number; list: Station[]; meals: Set<readonly unknown[]> } | null = null;

function potStations(): Station[] {
    const now = Date.now();
    if (pots === null || now - pots.at >= POTS_KEPT_MS) {
        const meals = new Set<readonly unknown[]>();
        pots = {
            at: now,
            list: CookPot.all().map((pot): Station => {
                const at = pot.position;
                const station: Station = ["fogo", at.x, at.y, at.z];
                if (pot.enabled && pot.portions > 0) meals.add(station);
                return station;
            }),
            meals,
        };
    }
    return pots.list;
}

/**
 * Whether a fire `stationPoints` gave is a pot with a meal in it, as of the kept list (a minute old at most): there the game's own E is the pot's
 * "Comer", which the client leaves alone; at any other fire the game's E is its own cooking, which the client holds back (`cook-hint.ts`, 2026-10-28).
 */
export function hasMeal(station: readonly [string, number, number, number]): boolean {
    return pots?.meals.has(station) ?? false;
}

function stations(): Station[] {
    return [...STATIONS, ...potStations(), ...CAMPS.map((camp): Station => ["fogo", camp.fire.x, camp.fire.y, camp.fire.z])];
}

/** The kinds of place within reach of a point, the nearest first. */
export function stationsNear(position: { readonly x: number; readonly y: number; readonly z: number }): StationKind[] {
    const near = stations()
        .map((station) => ({ kind: station[0], distance: Math.hypot(station[1] - position.x, station[2] - position.y), up: Math.abs(station[3] - position.z) }))
        .filter((station) => station.distance <= (cookingSettings.nearBy[station.kind] ?? cookingSettings.nearM) && station.up <= cookingSettings.upM)
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

interface Job {
    timer: ReturnType<typeof setTimeout> | null;
}

const cooking = new Map<number, Job>();

/**
 * `cook`, with the animation of the game: the player cooks for a few seconds, held still, and then the swap is made and
 * `done` is told what happened (user, 2026-10-18: "cozinhar não tá fazendo mais animação"). Nothing to do here, or not of
 * their trade: `done` is told at once and nothing plays.
 */
export function cookAnimated(player: Player, only: string | undefined, done: (text: string) => void): void {
    if (cooking.has(player.id)) {
        done("Você já está cozinhando.");
        return;
    }
    const work = cookables(player).filter((food) => only === undefined || food.id === only);
    if (work.length === 0) {
        done(cook(player, only));
        return;
    }
    const started = playCooking(player);
    const job: Job = { timer: null };
    cooking.set(player.id, job);
    const finish = (): void => {
        cooking.delete(player.id);
        try {
            if (started) {
                stopCooking(player);
            }
            done(!player.alive || stationsNear(player.position).length === 0 ? "Você se afastou do lugar: nada foi feito." : cook(player, only));
        } catch (error: unknown) {
            console.log(`cooking: o preparo de ${player.nickname} não terminou: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    job.timer = setTimeout(finish, started ? cookingAnimation.ms : 0);
}

export function installCooking(): void {
    Events.on("playerDisconnect", (player) => {
        const job = cooking.get(player.id);
        if (job !== undefined) {
            cooking.delete(player.id);
            if (job.timer !== null) {
                clearTimeout(job.timer);
            }
        }
    });
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
        cookAnimated(player, id, (text) => {
            Chat.sendToPlayer(player, text);
            player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
        });
    });
}
