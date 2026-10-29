/**
 * "Extrair", the trade's other half (user, 2026-10-27: "temos o de fabricar mas devemos ter o de extrair que quebra o equipamento e devolve os recursos, mas só pode
 * extrair equipamento que tenha ao menos 50% de durabilidade").
 *
 * On the forge's page and on the sewing page a second tab lists what the player carries that the trade makes -- an item whose class is the output of one of that
 * station's recipes -- and "Extrair" breaks one of them for half of what its recipe takes (rounded down in total: see `returnsOf`).
 *
 * Any piece of the kind, not only the ones a recipe makes (user, 2026-10-28: "jogador falou que não consegue desmontar roupas e armaduras diversas, só as que ele
 * mesmo produz"): a recipe makes one class of each piece (the dearest), and the game has many of the same name (a hood in a dozen colours, a helmet in several states), so
 * of the 2,100 clothes and armours only the 400 a player could forge or sew were listed. The others are taken apart as the piece the recipe makes, for the share of its
 * bill their own price is worth (`EXTRACT_ALIASES`: a felt hat of 16 groschen is not the 311 of the dearest), and the armour no recipe makes at all (gauntlets, padded
 * collars and coifs) has a bill of its own (`EXTRACT_EXTRAS`).
 * Only the bag's loose pieces count (what is worn is taken off first), only those with half of their condition or more, and only a member of the trade; at the forge
 * the player stands by it, as for forging. It gives no XP: it is not a way to level. A recipe that makes several at a time (arrows, soups) is not equipment and is
 * left out.
 *
 * The materials are added before the piece is taken away: if the bag has no room, or the game turns one of them down, what was added is taken back and the
 * piece stays where it was, with its condition and its name; the other order would hand back a new, whole item.
 */

import { CRAFT_ITEMS, CRAFT_PRICES, CRAFT_RECIPES, EXTRACT_ALIASES, EXTRACT_EXTRAS } from "./craft-data.js";
import type { CraftRecipe, CraftStation } from "./craft-data.js";
import { classOf } from "./craft-items.js";
import { levelOf, STATIONS } from "./craft.js";
import type { NearCheck } from "./craft.js";
import { mayCraft, showRefusal } from "./guild-crafts.js";
import { iconOf } from "./item-icons.js";
import { itemName } from "./item-names.js";

/** The trades whose page has the tab. */
export const EXTRACT_STATIONS: readonly CraftStation[] = ["forja", "costura"];
/** The prefix of the ids of the rows on the page. */
export const EXTRACT_PREFIX = "extrair:";
/** The least share of its condition a piece has to have. */
export const MIN_CONDITION = 0.5;
/** The share of each ingredient that comes back. */
export const RETURN_SHARE = 0.5;

/** The tabs of the page: [mode, label]. */
export const MODES: ReadonlyArray<readonly [string, string]> = [
    ["fabricar", "Fabricar"],
    ["extrair", "Extrair"],
];

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

export function canExtractAt(station: string): station is CraftStation {
    return (EXTRACT_STATIONS as readonly string[]).includes(station);
}

/** The recipe each class is taken apart by, per station: the first that makes it (the lowest level), the ones that make several at once left out. */
let table: Map<string, Map<string, CraftRecipe>> | null = null;

function recipesOf(station: CraftStation): Map<string, CraftRecipe> {
    if (table === null) {
        table = new Map();
    }
    let found = table.get(station);
    if (found === undefined) {
        found = new Map();
        for (const recipe of CRAFT_RECIPES) {
            if (recipe.station !== station || recipe.amount !== 1) {
                continue;
            }
            const key = classOf(recipe.output).toLowerCase();
            if (!found.has(key)) {
                found.set(key, recipe);
            }
        }
        table.set(station, found);
    }
    return found;
}

/** For the tests: the tables made again from a changed `CRAFT_RECIPES`. */
export function forgetTable(): void {
    table = null;
    extrasTable = null;
    scaledRecipes.clear();
}

/** The armour nobody makes, by station and class: a bill written for the extraction alone. */
let extrasTable: Map<string, Map<string, CraftRecipe>> | null = null;

function extrasOf(station: CraftStation): Map<string, CraftRecipe> {
    if (extrasTable === null) {
        extrasTable = new Map();
    }
    let found = extrasTable.get(station);
    if (found === undefined) {
        found = new Map();
        for (const [item, where, category, ingredients] of EXTRACT_EXTRAS) {
            if (where === station) {
                found.set(item.toLowerCase(), { id: `extrair:${item}`, station, category, output: item, amount: 1, ingredients, level: 0, xp: 0, seconds: 0 });
            }
        }
        extrasTable.set(station, found);
    }
    return found;
}

/** A recipe with its bill cut down to a share of itself (in hundredths): the amounts rounded, the ones that come to nothing left out. */
const scaledRecipes = new Map<string, CraftRecipe>();

export function scaledRecipe(recipe: CraftRecipe, share: number): CraftRecipe {
    if (share >= 100) {
        return recipe;
    }
    const key = `${recipe.id}~${share}`;
    let found = scaledRecipes.get(key);
    if (found === undefined) {
        const ingredients = recipe.ingredients.map(([item, amount]): readonly [string, number] => [item, Math.round((amount * share) / 100)]).filter(([, amount]) => amount > 0);
        found = { ...recipe, id: key, ingredients };
        scaledRecipes.set(key, found);
    }
    return found;
}

/** What a piece of this class is taken apart by at the station, or undefined when the trade does not make it. */
export function recipeFor(station: CraftStation, item: string): CraftRecipe | undefined {
    const key = String(item).toLowerCase();
    const own = recipesOf(station).get(key);
    if (own !== undefined) {
        return own;
    }
    const alias = EXTRACT_ALIASES[key];
    if (alias !== undefined) {
        const owner = recipesOf(station).get(alias[0]);
        if (owner !== undefined) {
            return scaledRecipe(owner, alias[1]);
        }
    }
    return extrasOf(station).get(key);
}

/**
 * What comes back of a recipe: half of each ingredient, rounded down. The halves the rounding drops (an ingredient taken once, three times...) add up: every two of them are
 * one more unit, given back of the dearest of the ingredients that were rounded, so a sword of six different pieces gives back its three best and not nothing, and the total
 * is always half of what the recipe took, rounded down.
 */
export function returnsOf(recipe: CraftRecipe): Array<[item: string, amount: number]> {
    const back = new Map<string, number>();
    const dropped: string[] = [];
    let spare = 0;
    for (const [item, need] of recipe.ingredients) {
        const exact = need * RETURN_SHARE;
        const amount = Math.floor(exact);
        if (amount > 0) {
            back.set(item, (back.get(item) ?? 0) + amount);
        }
        if (exact > amount) {
            spare += exact - amount;
            dropped.push(item);
        }
    }
    // The dearest first; the recipe's own order among equals.
    dropped.sort((a, b) => (CRAFT_PRICES[b] ?? 0) - (CRAFT_PRICES[a] ?? 0));
    let extra = Math.floor(spare + 1e-9);
    for (const item of dropped) {
        if (extra <= 0) {
            break;
        }
        back.set(item, (back.get(item) ?? 0) + 1);
        extra -= 1;
    }
    // Shown and given in the recipe's order.
    const ordered: Array<[string, number]> = [];
    for (const [item] of recipe.ingredients) {
        const amount = back.get(item);
        if (amount !== undefined && !ordered.some(([known]) => known === item)) {
            ordered.push([item, amount]);
        }
    }
    return ordered;
}

/** The share of its condition a piece has left, 0 to 1 (a piece with no condition of its own is whole). */
export function conditionOf(row: { readonly condition?: number; readonly metadata?: Readonly<Record<string, unknown>> }): number {
    const value = typeof row.condition === "number" ? row.condition : row.metadata?.["condition"];
    return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

interface Row {
    readonly id: string;
    readonly item: string;
    readonly name: string;
    readonly amount: number;
    readonly equipped?: number;
    readonly condition?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

const worn = (row: Row): boolean => Number(row.equipped ?? 0) > 0;

/** The pieces in a player's bag that the station's trade makes. */
export function pieceRows(player: Player, station: CraftStation): Row[] {
    const state = Inventory.get(player);
    if (state === null || !state.ready) {
        return [];
    }
    return state.items.filter((row) => row.amount > 0 && recipeFor(station, row.item) !== undefined);
}

const plural = (n: number): string => (n === 1 ? "1 material" : `${n} materiais`);

/** What the page says of a piece, and how its row is marked. */
function describe(row: Row, recipe: CraftRecipe): { text: string; can: boolean; badge: [string, string] } {
    const share = Math.round(conditionOf(row) * 100);
    const back = returnsOf(recipe);
    if (worn(row)) {
        return { text: `condição ${share}% · em uso: tire-o antes`, can: false, badge: ["miss", "Em uso"] };
    }
    if (conditionOf(row) < MIN_CONDITION) {
        return { text: `condição ${share}% · só se extrai de 50% para cima`, can: false, badge: ["miss", "Gasto"] };
    }
    if (back.length === 0) {
        return { text: `condição ${share}% · não rende material`, can: false, badge: ["miss", "Nada"] };
    }
    return { text: `condição ${share}% · devolve ${plural(back.length)}`, can: true, badge: ["ok", "Pronto"] };
}

/** The page of the extraction: the player's pieces, each as a row; `ing` is what comes back, with its amounts. */
export function extractView(player: Player, station: CraftStation): Record<string, unknown> {
    const info = STATIONS[station];
    const items: Record<string, readonly [string, string]> = {};
    const recipes = pieceRows(player, station).map((row) => {
        const recipe = recipeFor(station, row.item) as CraftRecipe;
        const key = `${EXTRACT_PREFIX}${row.id}`;
        items[key] = [itemName(row), iconOf(row.item)];
        const back = returnsOf(recipe);
        for (const [item] of back) {
            const known = CRAFT_ITEMS[item];
            if (known !== undefined) {
                items[item] = known;
            }
        }
        const said = describe(row, recipe);
        return {
            id: key,
            cat: recipe.category,
            out: key,
            n: 1,
            ing: back.map(([item, amount]) => [item, amount, 0]),
            lvl: 0,
            xp: 0,
            s: 0,
            t: said.text,
            lock: false,
            can: said.can,
            badge: said.badge,
        };
    });
    return {
        station,
        title: info.title,
        verb: "Extrair",
        track: info.track,
        level: levelOf(player, info.track),
        sub: "Devolve metade do material · só com 50% de condição ou mais",
        none: "Nenhum equipamento na sua bolsa que este ofício possa extrair.",
        mode: "extrair",
        modes: MODES,
        recipes,
        items,
    };
}

/** Takes back what was added: `added` are the rows each addition reached, and how many were asked. */
function undo(player: Player, added: ReadonlyArray<{ readonly units: ReadonlyArray<{ readonly id: string; readonly amount: number }>; readonly asked: number }>): void {
    for (const part of added) {
        let left = part.asked;
        const units: Array<{ id: string; amount: number }> = [];
        for (const unit of part.units) {
            const amount = Math.min(left, unit.amount);
            if (amount > 0) {
                units.push({ id: unit.id, amount });
                left -= amount;
            }
        }
        if (units.length > 0) {
            Inventory.remove(player, { units });
        }
    }
}

/** A piece broken apart: `pageId` is the row's id behind its prefix. */
export function extract(player: Player, pageId: string, station: CraftStation, near: NearCheck): Outcome {
    if (!pageId.startsWith(EXTRACT_PREFIX) || !canExtractAt(station)) {
        return { ok: false, message: "Escolha um equipamento." };
    }
    if (!player.ready || !player.alive) {
        return { ok: false, message: "Você não pode fazer isto agora." };
    }
    const info = STATIONS[station];
    if (!mayCraft(player, info.craft)) {
        showRefusal(player, info.craft);
        return { ok: false, message: "Esta tarefa não é do seu ofício." };
    }
    if (station === "forja" && !near(player, station)) {
        return { ok: false, message: "Fique junto da forja para isso." };
    }
    const state = Inventory.get(player);
    if (state === null || !state.ready) {
        return { ok: false, message: "A sua bolsa ainda não está pronta." };
    }
    const rowId = pageId.slice(EXTRACT_PREFIX.length);
    const row = state.items.find((each) => each.id === rowId);
    const recipe = row === undefined ? undefined : recipeFor(station, row.item);
    if (row === undefined || recipe === undefined) {
        return { ok: false, message: "Esse equipamento não está mais na sua bolsa." };
    }
    const label = itemName(row);
    if (worn(row)) {
        return { ok: false, message: `${label} está em uso: tire-o antes de extrair.` };
    }
    const share = Math.round(conditionOf(row) * 100);
    if (conditionOf(row) < MIN_CONDITION) {
        return { ok: false, message: `${label} está gasto demais (${share}%): só se extrai equipamento com ${Math.round(MIN_CONDITION * 100)}% de condição ou mais.` };
    }
    const back = returnsOf(recipe);
    if (back.length === 0) {
        return { ok: false, message: `${label} não rende material para extrair.` };
    }

    // The materials first; the piece goes last, and only if every one of them came.
    const added: Array<{ units: Array<{ id: string; amount: number }>; asked: number }> = [];
    for (const [item, amount] of back) {
        const given = Inventory.add(player, { item: classOf(item), amount, notify: false });
        if (!given.ok) {
            undo(player, added);
            if (given.code === "inventoryCapacity") {
                return { ok: false, message: "Nada foi feito: não coube no seu inventário." };
            }
            console.log(`extract: o jogo não aceitou ${CRAFT_ITEMS[item]?.[0] ?? item} para ${player.nickname} (${recipe.id}): ${given.code}`);
            return { ok: false, message: "Nada foi feito: o jogo não aceitou o material, e o equipamento ficou com você." };
        }
        added.push({ units: given.items.map((unit) => ({ id: unit.id, amount: unit.amount })), asked: amount });
    }
    const fresh = Inventory.get(player);
    const still = fresh?.items.find((each) => each.id === row.id);
    if (fresh === null || still === undefined || String(still.item).toLowerCase() !== String(row.item).toLowerCase() || worn(still) || conditionOf(still) < MIN_CONDITION) {
        undo(player, added);
        return { ok: false, message: "Nada foi feito: o equipamento mudou no meio do caminho." };
    }
    const taken = Inventory.remove(player, { units: [{ id: row.id, amount: 1 }], revision: fresh.revision });
    if (!taken.ok) {
        undo(player, added);
        console.log(`extract: o jogo não tirou ${label} de ${player.nickname} (${recipe.id}): ${taken.code}`);
        return { ok: false, message: "Nada foi feito: o jogo não aceitou a extração, e o equipamento ficou com você." };
    }
    const list = back.map(([item, amount]) => `${amount}x ${CRAFT_ITEMS[item]?.[0] ?? item}`).join(", ");
    console.log(`extract: ${player.nickname} extraiu ${label} (${share}%): ${list}`);
    return { ok: true, message: `Você extraiu ${label}: voltaram ${list}.` };
}
