/**
 * The grindstone is the smiths' repair bench (user, 2026-10-27: "na pedra de amolar vamos travar igual fizemos com a forja, só ferreiro vai poder usar; apertar E abre o
 * menu Reparar e Sair; ao clicar em reparar abre na seção direita o menu de ofício e só aparece armas, menos arco e flecha, só espada e armas de combate; o jogador
 * escolhe e pode reparar ela; cada arma pode ser reparada até 3x apenas, depois de 3 vezes ela fica marcada como sem material no objeto suficiente").
 *
 * The level's grindstones (`stations-data.ts`, 26 of them) are stations of ours now, as the forge is: the client puts "Reparar" up on E when the aim is on one
 * (`cook-hint.ts`), the menu is the forge's ("Reparar / Sair", `cook-menu.ts`) and its first option opens the trades' page with the weapons in the player's bag
 * that can be mended -- the swords, daggers, maces and hammers, axes and halberds of `data/weapons.json`; bows, arrows, shields and firearms are not in it. A
 * repair brings the blade back to full condition and is written on the weapon itself, in the custom data of its row (`repairs`): it goes with the weapon when it is
 * traded, given or dropped. After `REPAIR_LIMIT` repairs the weapon is marked ("Sem material no objeto suficiente", in its description too) and the bench turns it
 * down. The game's own sharpening, which it counts as a change of reason `sharpen`, is undone (`sharpen-log.ts`): the bench is the only repair.
 */

import { emitLarge } from "./big-emit.js";
import { craftTitle } from "./craft-titles.js";
import { levelOf } from "./craft.js";
import { mayCraft, showRefusal } from "./guild-crafts.js";
import { iconOf } from "./item-icons.js";
import { itemName } from "./item-names.js";
import { allowedTo, EDGE_M } from "./reach.js";
import { GRINDSTONES } from "./stations-data.js";

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

const RESOURCE = "kcdc-gamemode";

/** How many times a weapon can be repaired. */
export const REPAIR_LIMIT = 3;
/** The station name of the trades' page, and the prefix of the ids of its rows. */
export const REPAIR_STATION = "reparo";
export const REPAIR_PREFIX = "reparo:";
/** What the marked weapon and its row on the page say. */
export const NO_MATERIAL = "Sem material no objeto suficiente";
/** Below this share of its condition a weapon is worth a repair; above it the bench says it is whole. */
export const WHOLE_FROM = 0.995;

export const repairSettings = {
    /** How near a grindstone the repairs are done: the one reach of our prompts to its point, and a metre more (`reach.ts`). */
    stoneM: allowedTo(EDGE_M.grindstone),
};

/** The name of each kind of weapon on the page (its category). */
export const KIND_LABEL: Readonly<Record<string, string>> = {
    sword: "Espadas",
    dagger: "Adagas",
    mace: "Maças e martelos",
    axe: "Machados",
    halberd: "Armas de haste",
};

let weapons: Record<string, string> | null = null;

function loadWeapons(): Record<string, string> {
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/weapons.json` : "", "resources/kcdc-gamemode/data/weapons.json", "data/weapons.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                return parsed as Record<string, string>;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("repair: data/weapons.json não foi encontrado; a pedra de amolar não achará armas para reparar");
    return {};
}

/** The kind of weapon an item class is ("sword", "axe", ...), or null for anything the bench does not mend. */
export function weaponKind(item: string): string | null {
    if (weapons === null) {
        weapons = loadWeapons();
    }
    return weapons[item.toLowerCase()] ?? null;
}

/** Loads the weapons table at start and says what the bench has to work with. */
export function installRepair(): void {
    if (weapons === null) {
        weapons = loadWeapons();
    }
    console.log(`repair: ${Object.keys(weapons).length} armas que a pedra de amolar repara (até ${REPAIR_LIMIT} vezes cada); ${GRINDSTONES.length} pedras de amolar no nível; a afiação do jogo é desfeita`);
}

/** For the tests: the weapons table, in place of the file. */
export function useWeapons(table: Record<string, string> | null): void {
    weapons = table;
}

/** Whether the point is within reach of one of the level's grindstones. */
export function grindstoneNear(position: { readonly x: number; readonly y: number; readonly z: number }): boolean {
    return GRINDSTONES.some((stone) => Math.hypot(stone[0] - position.x, stone[1] - position.y) <= repairSettings.stoneM && Math.abs(stone[2] - position.z) <= 3);
}

/** The grindstones about a point, for the client's hint: x, y, z. */
export function grindstonesWithin(position: { readonly x: number; readonly y: number }, radius: number): Array<[number, number, number]> {
    return GRINDSTONES.filter((stone) => Math.hypot(stone[0] - position.x, stone[1] - position.y) <= radius).map((stone): [number, number, number] => [stone[0], stone[1], stone[2]]);
}

interface Mark {
    readonly repairs: number;
}

/** How many times a weapon has been repaired, from the custom data of its row. */
export function repairsOf(row: { readonly metadata?: Readonly<Record<string, unknown>> }): number {
    const custom = row.metadata?.["custom"];
    if (typeof custom !== "object" || custom === null) {
        return 0;
    }
    const data = (custom as { data?: unknown }).data;
    const repairs = typeof data === "object" && data !== null ? (data as Partial<Mark>).repairs : undefined;
    return typeof repairs === "number" && Number.isFinite(repairs) && repairs > 0 ? Math.floor(repairs) : 0;
}

/** The share of its condition a weapon has left, 0 to 1. */
function conditionOf(row: { readonly condition?: number; readonly metadata?: Readonly<Record<string, unknown>> }): number {
    const value = typeof row.condition === "number" ? row.condition : row.metadata?.["condition"];
    return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

interface Row {
    readonly id: string;
    readonly item: string;
    readonly name: string;
    readonly amount: number;
    readonly condition?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/** The weapons in a player's bag that the bench can be asked about. */
export function weaponRows(player: Player): Row[] {
    const state = Inventory.get(player);
    if (state === null || !state.ready) {
        return [];
    }
    return state.items.filter((row) => weaponKind(row.item) !== null);
}

/** What the page says of a weapon: its condition and how many repairs it has had. */
export function weaponLine(row: Row): string {
    const repairs = repairsOf(row);
    if (repairs >= REPAIR_LIMIT) {
        return NO_MATERIAL.toLowerCase();
    }
    const share = Math.round(conditionOf(row) * 100);
    return `condição ${share}% · ${repairs} de ${REPAIR_LIMIT} reparos usados`;
}

/** The page of the bench: the player's weapons, each as a row, the whole page's own words. */
export function repairView(player: Player): Record<string, unknown> {
    const items: Record<string, readonly [string, string]> = {};
    const recipes = weaponRows(player).map((row) => {
        const kind = weaponKind(row.item) as string;
        const key = `${REPAIR_PREFIX}${row.id}`;
        items[key] = [itemName(row), iconOf(row.item)];
        const worn = conditionOf(row) < WHOLE_FROM;
        const spent = repairsOf(row) >= REPAIR_LIMIT;
        return {
            id: key,
            cat: KIND_LABEL[kind] ?? "Armas",
            out: key,
            n: 1,
            ing: [] as unknown[],
            lvl: 0,
            xp: 0,
            s: 0,
            t: weaponLine(row),
            lock: false,
            can: worn && !spent,
            badge: spent ? ["miss", "Sem material"] : worn ? ["ok", "Pronto"] : ["ok", "Inteira"],
        };
    });
    const img = craftTitle(REPAIR_STATION);
    return {
        station: REPAIR_STATION,
        title: "Reparo",
        verb: "Reparar",
        track: "craftsmanship",
        level: levelOf(player, "craftsmanship"),
        sub: `Cada arma pode ser reparada ${REPAIR_LIMIT} vezes`,
        recipes,
        items,
        ...(img === "" ? {} : { img }),
    };
}

/** The players who have the bench's page open. */
const pageOpen = new Set<number>();

export function openRepairPage(player: Player): boolean {
    if (!player.ready || !mayCraft(player, "smithing")) {
        return false;
    }
    pageOpen.add(player.id);
    emitLarge(player, "craft.view", JSON.stringify(repairView(player)));
    return true;
}

export function repairPageClosed(player: Player): void {
    pageOpen.delete(player.id);
}

export function repairPageOpen(player: Player): boolean {
    return pageOpen.has(player.id);
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** The text the marked weapon carries in its description. */
export function markText(repairs: number): string {
    return repairs >= REPAIR_LIMIT ? `${NO_MATERIAL}: não pode mais ser reparada.` : `Reparada ${repairs} de ${REPAIR_LIMIT} vezes.`;
}

/** A repair asked for on the page: `id` is the row's id behind its prefix. */
export function repair(player: Player, pageId: string): Outcome {
    if (!pageId.startsWith(REPAIR_PREFIX)) {
        return { ok: false, message: "Escolha uma arma." };
    }
    if (!player.ready || !player.alive) {
        return { ok: false, message: "Você não pode fazer isto agora." };
    }
    if (!mayCraft(player, "smithing")) {
        showRefusal(player, "smithing");
        return { ok: false, message: "Só os ferreiros usam a pedra de amolar." };
    }
    if (!grindstoneNear(player.position)) {
        return { ok: false, message: "Fique junto da pedra de amolar para isso." };
    }
    const state = Inventory.get(player);
    if (state === null || !state.ready) {
        return { ok: false, message: "A sua bolsa ainda não está pronta." };
    }
    const rowId = pageId.slice(REPAIR_PREFIX.length);
    const row = state.items.find((each) => each.id === rowId);
    if (row === undefined || weaponKind(row.item) === null) {
        return { ok: false, message: "Essa arma não está mais na sua bolsa." };
    }
    const label = itemName(row);
    const used = repairsOf(row);
    if (used >= REPAIR_LIMIT) {
        return { ok: false, message: `${label}: ${NO_MATERIAL.toLowerCase()}. Já foi reparada ${REPAIR_LIMIT} vezes.` };
    }
    if (conditionOf(row) >= WHOLE_FROM) {
        return { ok: false, message: `${label} já está inteira.` };
    }
    // The condition back to the full: `condition` and not `health`, and nothing else of the row lost (setProperties replaces).
    const metadata: Record<string, unknown> = { ...row.metadata };
    delete metadata["health"];
    metadata["condition"] = 1;
    const mended = Inventory.setProperties(player, { id: row.id, metadata, revision: state.revision });
    if (!mended.ok) {
        return { ok: false, message: `O jogo não aceitou o reparo de ${label} (${mended.code}). Tente de novo.` };
    }
    // The mark on the weapon itself, in the custom data of its row (server-side) and in the words of its description.
    const next = used + 1;
    const custom = row.metadata?.["custom"];
    const data = typeof custom === "object" && custom !== null && typeof (custom as { data?: unknown }).data === "object" && (custom as { data?: unknown }).data !== null ? { ...((custom as { data: Record<string, unknown> }).data) } : {};
    data["repairs"] = next;
    const marked = Inventory.updateCustom(player, { id: row.id, description: markText(next), data });
    if (!marked.ok) {
        console.log(`repair: ${player.nickname}: a marca de ${label} não pôde ser gravada (${marked.code}); a contagem de reparos ficou sem ela`);
    }
    console.log(`repair: ${player.nickname} reparou ${label} (${next} de ${REPAIR_LIMIT})`);
    return {
        ok: true,
        message: next >= REPAIR_LIMIT ? `${label} foi reparada pela última vez: ${NO_MATERIAL.toLowerCase()} para outro reparo.` : `${label} foi reparada (${next} de ${REPAIR_LIMIT} reparos usados).`,
    };
}

/** The page answered: the outcome, then the page again with what the bag holds now. */
export function repairFromPage(player: Player, pageId: string): void {
    const outcome = repair(player, pageId);
    player.emit(`${RESOURCE}:craft.result`, JSON.stringify({ ok: outcome.ok, text: outcome.message }));
    Chat.sendToPlayer(player, outcome.message);
    if (pageOpen.has(player.id)) {
        emitLarge(player, "craft.view", JSON.stringify(repairView(player)));
    }
}
