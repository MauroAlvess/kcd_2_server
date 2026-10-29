/**
 * The guilds' trades (user, 2026-10-18: "vamos criar hub personalizadas reutilizáveis em cada guilda do jogo ... receitas
 * personalizadas e o que precisa para fazer"). One page of ours on the right of the screen (`ui/craft.html`) lists what a
 * trade makes (`craft-data.ts`, made from the game's tables by `tools/make-craft-recipes.py`), what each recipe takes, which
 * the player has, and the level of the trade's skill it asks for; a recipe is unlocked as that skill grows, and each one made
 * gives XP on it, through the game's own path (`player.addXp`).
 *
 *   fogo (Tabernarii), defumador (Venatores), secador (Alchemistae): at the level's fires, smokehouses and racks
 *   forja (Fabri Ferrarii): at the level's smitheries
 *   costura (Artifices): anywhere, from the panel (F2, Guildas)
 *   alquimia (Alchemistae): the page only chooses the potion; it is taught to the player's recipe book and brewed in the
 *   game's own minigame at the table
 *
 * The work is the server's (the game does none of it): the player plays one of the game's animations for the recipe's time,
 * held still (`craft-animation.ts`), and at the end what it takes is taken and what it makes is given -- or nothing is, if they
 * walked off, died, or no longer have it.
 */

import { CRAFT_ITEMS, CRAFT_RECIPES } from "./craft-data.js";
import type { CraftRecipe, CraftStation } from "./craft-data.js";
import { playWork, stopWork } from "./craft-animation.js";
import { classOf } from "./craft-items.js";
import { craftPlaceNear, PLACE_HEIGHT_M, PLACE_REACH_M } from "./craft-places.js";
import { FOOD_DECAY, SPOILED_BELOW } from "./food-decay-data.js";
import { mayCraft, usesFreeCrafts } from "./guild-crafts.js";
import { paid } from "./profession-xp.js";
import type { Craft } from "./guild-crafts.js";
import { allowedTo, EDGE_M } from "./reach.js";

const RESOURCE = "kcdc-gamemode";

export interface StationInfo {
    readonly title: string;
    readonly verb: string;
    readonly doing: string;
    /** The skill it trains and asks levels of. */
    readonly track: string;
    /** Whose it is (`guild-crafts.ts`). */
    readonly craft: Craft;
}

export const STATIONS: Readonly<Record<CraftStation, StationInfo>> = {
    fogo: { title: "Cozinha", verb: "Cozinhar", doing: "Cozinhando", track: "survival", craft: "fogo" },
    defumador: { title: "Defumador", verb: "Defumar", doing: "Defumando", track: "survival", craft: "defumador" },
    secador: { title: "Secador", verb: "Secar", doing: "Secando", track: "alchemy", craft: "secador" },
    forja: { title: "Forja", verb: "Forjar", doing: "Forjando", track: "craftsmanship", craft: "smithing" },
    costura: { title: "Costura", verb: "Costurar", doing: "Costurando", track: "craftsmanship", craft: "costura" },
    alquimia: { title: "Alquimia", verb: "Escolher", doing: "", track: "alchemy", craft: "alchemy" },
};

export const craftSettings = {
    /** How near a smithery the forge's work is done: the one reach of our prompts to its point, and a metre more (`reach.ts`, 2026-10-22). */
    forgeM: allowedTo(EDGE_M.forge),
    /** How long a potion chosen on the page may be started at the table. */
    alchemyGrantMs: 3 * 60_000,
    /** Every step of a recipe the game's recipe book can show. */
    fullKnowledge: 536870911,
};

/**
 * How many a piece of work may make in one go (user, 2026-10-27: "no defumador e nas receitas das guildas vamos permitir que o jogador faça de 1 a 10 de uma vez e receba o XP
 * pela fabricação, cozinha e qualquer um que tiver que fabricar algo"): each takes the recipe's time, one after the other, and each gives what the recipe makes and its XP.
 */
export const MAX_BATCH = 10;

/** What a page asks for as a number of pieces, as a whole number from 1 to `MAX_BATCH` (anything that is not a number is one). */
export function batchOf(value: unknown): number {
    const wanted = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 1;
    return Number.isFinite(wanted) ? Math.min(MAX_BATCH, Math.max(1, Math.floor(wanted))) : 1;
}

const BY_ID = new Map(CRAFT_RECIPES.map((recipe) => [recipe.id, recipe]));

export function recipeById(id: string): CraftRecipe | undefined {
    return BY_ID.get(id);
}

/** The level of a trade's skill the player has, 0 before their game first said it. */
export function levelOf(player: Player, track: string): number {
    try {
        return player.getTrack(track)?.level ?? 0;
    } catch {
        return 0;
    }
}

/**
 * A food gone bad (below the fifth of its condition the game calls spoiled, `spoilage.ts`) is no ingredient: cooking, drying or smoking
 * it gave a fresh row back, so spoiled meat came out of the fire as good as new (a player, 2026-10-25: "estou conseguindo cozinhar carne
 * perdida").
 */
export function spoiledRow(row: { readonly item: string; readonly condition?: number; readonly metadata?: Record<string, unknown> }): boolean {
    if (FOOD_DECAY[String(row.item).toLowerCase()] === undefined) {
        return false;
    }
    const condition = Number.isFinite(row.condition) ? Number(row.condition) : Number(row.metadata?.["condition"] ?? 1);
    return condition < SPOILED_BELOW;
}

/** How many spoiled units of each class the player carries (they do not count as ingredients). */
function spoiledCountsOf(player: Player): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of Inventory.get(player)?.items ?? []) {
        if (spoiledRow(row)) {
            const key = String(row.item).toLowerCase();
            counts.set(key, (counts.get(key) ?? 0) + row.amount);
        }
    }
    return counts;
}

/** What the player carries, by class: the total of every row of it, spoiled food left out. */
export function countsOf(player: Player): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of Inventory.get(player)?.items ?? []) {
        if (spoiledRow(row)) {
            continue;
        }
        const key = String(row.item).toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + row.amount);
    }
    return counts;
}

const trackOf = (recipe: CraftRecipe): string => recipe.track ?? STATIONS[recipe.station].track;

/** One recipe as the page shows it: what it makes, what it takes and how much of it the player has, and whether it can be made now. */
export interface RecipeView {
    readonly id: string;
    readonly cat: string;
    readonly out: string;
    readonly n: number;
    readonly ing: ReadonlyArray<readonly [string, number, number]>;
    readonly lvl: number;
    readonly xp: number;
    readonly s: number;
    /** Not unlocked yet: the skill is below `lvl`. */
    readonly lock: boolean;
    /** The skill it asks for, when it is not the trade's own (the fire's drinks). */
    readonly trk?: string;
    readonly can: boolean;
    /** The button's word, when it is not the trade's own: the alchemists' bandages are made on the page ("Fazer"), not chosen. */
    readonly v?: string;
    /** Made on the page, so that a number of them may be asked for at once (`MAX_BATCH`): not the potions the game's own table brews, which are only chosen. */
    readonly batch?: boolean;
}

export interface CraftView {
    readonly station: CraftStation;
    readonly title: string;
    readonly verb: string;
    readonly track: string;
    readonly level: number;
    readonly recipes: readonly RecipeView[];
    readonly items: Readonly<Record<string, readonly [string, string]>>;
}

/** The page of a trade for a player: every recipe of it, unlocked or not, with what they have. */
export function viewFor(player: Player, station: CraftStation): CraftView {
    const info = STATIONS[station];
    const counts = countsOf(player);
    const free = usesFreeCrafts(player);
    const levels = new Map<string, number>();
    const items: Record<string, readonly [string, string]> = {};
    // At an alchemy table a potion is brewed on the page (`brew`), whichever table it is: "Fazer", and the seconds it takes.
    const atTable = station === "alquimia" && alchemyTableNear(player.position);
    const recipes = CRAFT_RECIPES.filter((recipe) => recipe.station === station).map((recipe): RecipeView => {
        const track = trackOf(recipe);
        const level = levels.get(track) ?? levelOf(player, track);
        levels.set(track, level);
        const ing = recipe.ingredients.map(([item, need]): readonly [string, number, number] => [item, need, counts.get(classOf(item)) ?? 0]);
        for (const id of [recipe.output, ...recipe.ingredients.map(([item]) => item)]) {
            const known = CRAFT_ITEMS[id];
            if (known !== undefined) {
                items[id] = known;
            }
        }
        const unlocked = free || level >= recipe.level;
        return {
            id: recipe.id,
            cat: recipe.category,
            out: recipe.output,
            n: recipe.amount,
            ing,
            lvl: recipe.level,
            xp: paid(recipe.xp),
            s: atTable && recipe.alchemy !== undefined ? BREW_SECONDS : recipe.seconds,
            lock: !unlocked,
            ...(recipe.track === undefined ? {} : { trk: recipe.track }),
            ...(recipe.station === "alquimia" && (madeOnPage(recipe) || atTable) ? { v: "Fazer" } : {}),
            ...(madeOnPage(recipe) || atTable ? { batch: true } : {}),
            can: unlocked && ing.every(([, need, have]) => have >= need),
        };
    });
    return { station, title: info.title, verb: info.verb, track: info.track, level: levelOf(player, info.track), recipes, items };
}

// ---------------------------------------------------------------------------------------------
// Where a trade is worked.

/** The smitheries within reach of a point: the level's, and the forges this server put in the world (`craft-places.ts`). */
export function forgeNear(position: { x: number; y: number; z: number }): boolean {
    if (craftPlaceNear("forja", position, craftSettings.forgeM) !== null) {
        return true;
    }
    try {
        return Crafting.stations("smithing").some((station) => Math.hypot(station.position.x - position.x, station.position.y - position.y) <= craftSettings.forgeM && Math.abs(station.position.z - position.z) <= 3);
    } catch {
        return false;
    }
}

/** The alchemy tables within reach of a point: the level's own (`Crafting.stations`) and the ones this server put in the world (`craft-places.ts`). */
export function alchemyTableNear(position: { x: number; y: number; z: number }): boolean {
    if (craftPlaceNear("alquimia", position) !== null) {
        return true;
    }
    try {
        return Crafting.stations("alchemy").some((station) => Math.hypot(station.position.x - position.x, station.position.y - position.y) <= PLACE_REACH_M && Math.abs(station.position.z - position.z) <= PLACE_HEIGHT_M);
    } catch {
        return false;
    }
}

/**
 * Whether the player stands at an alchemy table, where potions are brewed on the page. The game's own tables are ours as the forge, the
 * smokehouse and the rack are (user, 2026-10-24: "o bug que ocorreu na forja e no defumar ocorreu na mesa de alquimia: jogador abre e fica
 * preso sem conseguir sair nem iniciar o processo de criação"): the game's E there began its own alchemy, which the server refuses until a
 * potion is chosen, and left the player in it; now the game's E is held back at every table (`cook-hint.ts`) and the potion is chosen and
 * brewed on the page, at the tables of the level and at the ones of the exports alike.
 */
export function atOwnAlchemyTable(player: Player): boolean {
    return player.ready && alchemyTableNear(player.position);
}

/** Whether the player stands where the trade is worked: `near` says it for the fire, the smokehouse and the rack. */
export type NearCheck = (player: Player, station: CraftStation) => boolean;

// ---------------------------------------------------------------------------------------------
// The work.

interface Job {
    readonly recipe: CraftRecipe;
    timer: ReturnType<typeof setTimeout> | null;
    /** How many were asked for, how many are made, and the XP they gave. */
    readonly count: number;
    made: number;
    xp: number;
}

const working = new Map<number, Job>();

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

function itemName(id: string): string {
    return CRAFT_ITEMS[id]?.[0] ?? id;
}

/** Why the player may not make the recipe now, or "" when they may: `count` of them, for the ingredients. */
export function whyNot(player: Player, recipe: CraftRecipe, near: NearCheck, count = 1): string {
    const info = STATIONS[recipe.station];
    if (!player.ready || !player.alive) {
        return "Agora não dá.";
    }
    if (!mayCraft(player, info.craft)) {
        return "Esta receita não é do seu ofício.";
    }
    if (!usesFreeCrafts(player) && levelOf(player, trackOf(recipe)) < recipe.level) {
        return `É preciso nível ${recipe.level} para esta receita.`;
    }
    if (recipe.station !== "costura" && recipe.station !== "alquimia" && !near(player, recipe.station)) {
        return `Fique junto ${recipe.station === "forja" ? "da forja" : recipe.station === "fogo" ? "do fogo" : recipe.station === "defumador" ? "do defumador" : "do secador"} para isso.`;
    }
    const counts = countsOf(player);
    const missing = recipe.ingredients.filter(([item, need]) => (counts.get(classOf(item)) ?? 0) < need * count);
    if (missing.length > 0) {
        const spoiled = spoiledCountsOf(player);
        const bad = missing.some(([item]) => (spoiled.get(classOf(item)) ?? 0) > 0);
        return `Falta: ${missing.map(([item, need]) => `${need * count}x ${itemName(item)} (tem ${counts.get(classOf(item)) ?? 0})`).join(", ")}.${bad ? " Comida estragada não serve." : ""}`;
    }
    return "";
}

/** Takes what the recipe takes out of the player's inventory, in one change. False when it is not all there. */
function take(player: Player, recipe: CraftRecipe): boolean {
    const state = Inventory.get(player);
    if (state === null) {
        return false;
    }
    const units: Array<{ id: string; amount: number }> = [];
    for (const [item, need] of recipe.ingredients) {
        let left = need;
        for (const row of state.items) {
            if (left <= 0) {
                break;
            }
            if (String(row.item).toLowerCase() !== classOf(item) || row.amount <= 0 || spoiledRow(row)) {
                continue;
            }
            const amount = Math.min(left, row.amount);
            units.push({ id: row.id, amount });
            left -= amount;
        }
        if (left > 0) {
            return false;
        }
    }
    return Inventory.remove(player, { units, revision: state.revision }).ok;
}

function giveBack(player: Player, recipe: CraftRecipe): void {
    for (const [item, amount] of recipe.ingredients) {
        Inventory.add(player, { item: classOf(item), amount, notify: false });
    }
}

/** What the page is told when a piece of work ends, and its view again. */
export type Reporter = (player: Player, outcome: Outcome) => void;

/** Where a piece of work is done, for its animation: the station to face, an open fire or a cauldron, a woman's body (`craft-spot.ts`). */
export interface WorkSpot {
    readonly point: { readonly x: number; readonly y: number; readonly z: number } | null;
    readonly campfire: boolean;
    readonly female: boolean;
}

export type SpotOf = (player: Player, station: CraftStation) => WorkSpot;

/** Whether the recipe is made here, on the page, over its seconds: every one but the game's own alchemy, brewed at its table. */
export function madeOnPage(recipe: CraftRecipe): boolean {
    return recipe.alchemy === undefined;
}

/**
 * Makes a recipe: the work is played for its time, and at the end what it takes is taken and what it makes is given, with its
 * XP. `report` is told how it ended (at once, when it cannot start).
 */
export function make(player: Player, recipeId: string, near: NearCheck, report: Reporter, spotOf?: SpotOf, count = 1): void {
    const recipe = recipeById(recipeId);
    if (recipe === undefined || !madeOnPage(recipe)) {
        report(player, { ok: false, message: "Receita desconhecida." });
        return;
    }
    work(player, recipe, near, report, () => true, spotOf, count);
}

/** A potion brewed at an alchemy table of ours takes this long, there being no minigame of the game's to play there. */
export const BREW_SECONDS = 20;

const AWAY_FROM_TABLE = "Fique junto da mesa de alquimia para isso.";

/**
 * Brews a potion at an alchemy table this server put in the world (`craft-places.ts`; user, 2026-10-19: "uma mesa de alquimia
 * na cidade"). The game has no table there to brew at, so it is made on the page like any other trade's work: what the recipe
 * takes goes, and the potion comes after `BREW_SECONDS`, as the game makes it by default, with the recipe's XP. `atTable` says
 * whether the player still stands at such a table, at the start and at the end.
 */
export function brew(player: Player, recipeId: string, atTable: (player: Player) => boolean, report: Reporter, spotOf?: SpotOf, count = 1): void {
    const recipe = recipeById(recipeId);
    if (recipe === undefined || recipe.station !== "alquimia" || recipe.alchemy === undefined) {
        report(player, { ok: false, message: "Receita desconhecida." });
        return;
    }
    if (!atTable(player)) {
        report(player, { ok: false, message: AWAY_FROM_TABLE });
        return;
    }
    work(player, { ...recipe, seconds: BREW_SECONDS }, () => true, report, atTable, spotOf, count);
}

/**
 * The work of a recipe made on the page: played for its time, then checked again, taken and given (`finishWork`). The animation is the game's own work at that station, laid
 * over the recipe's time and turned to the station (`craft-animation.ts`, `spotOf`). A number of them (`count`, `MAX_BATCH`) are made one after the other: the animation is
 * laid over all of the time, and each piece is checked, taken, given and paid in XP when its own time is up. The page is told once, at the end, of everything made: if
 * something is missing at a piece, or the player walked off or stopped, what was made stays made and the rest is not started.
 */
function work(player: Player, recipe: CraftRecipe, near: NearCheck, report: Reporter, stillThere: (player: Player) => boolean, spotOf?: SpotOf, count = 1): void {
    if (working.has(player.id)) {
        report(player, { ok: false, message: "Você já está trabalhando em algo." });
        return;
    }
    const times = batchOf(count);
    const reason = whyNot(player, recipe, near, times);
    if (reason !== "") {
        report(player, { ok: false, message: reason });
        return;
    }
    let spot: WorkSpot | null = null;
    try {
        spot = spotOf?.(player, recipe.station) ?? null;
    } catch {
        spot = null;
    }
    const unitMs = Math.max(1, recipe.seconds) * 1000;
    const played = playWork(player, recipe.station, { ms: unitMs * times, ...(spot === null ? {} : spot) });
    const job: Job = { recipe, timer: null, count: times, made: 0, xp: 0 };
    const end = (outcome: Outcome): void => {
        working.delete(player.id);
        if (played) {
            stopWork(player);
        }
        try {
            report(player, outcome);
        } catch (error: unknown) {
            console.log(`craft: o trabalho de ${player.nickname} em ${recipe.id} não terminou: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const step = (): void => {
        job.timer = null;
        let unit: Outcome;
        try {
            unit = stillThere(player) ? finishWork(player, recipe, near) : { ok: false, message: `Nada foi feito. ${AWAY_FROM_TABLE}` };
        } catch (error: unknown) {
            console.log(`craft: o trabalho de ${player.nickname} em ${recipe.id} não terminou: ${error instanceof Error ? error.message : String(error)}`);
            working.delete(player.id);
            if (played) {
                stopWork(player);
            }
            return;
        }
        if (unit.ok) {
            job.made += 1;
            job.xp += paid(recipe.xp);
            if (job.made < job.count) {
                begin();
                return;
            }
        }
        end(summary(job, unit));
    };
    const begin = (): void => {
        job.timer = setTimeout(step, unitMs);
        player.emit(`${RESOURCE}:craft.progress`, JSON.stringify({ id: recipe.id, ms: unitMs, doing: STATIONS[recipe.station].doing || "Preparando", ...(job.count > 1 ? { i: job.made + 1, n: job.count } : {}) }));
    };
    working.set(player.id, job);
    begin();
}

/** What the page is told when a piece of work ends: the one piece's own word, or the sum of the pieces made when there were several. */
function summary(job: Job, last: Outcome): Outcome {
    if (job.count === 1 || job.made === 0) {
        return last;
    }
    const total = `${job.recipe.amount * job.made}x ${itemName(job.recipe.output)} (+${job.xp} XP)`;
    const word = STATIONS[job.recipe.station].doing === "" ? "Pronto" : "Feito";
    return job.made === job.count ? { ok: true, message: `${word}: ${total}.` } : { ok: false, message: `${word} ${job.made} de ${job.count}: ${total}. ${last.message}` };
}

/** The end of a piece of work: checked again, taken, given, and the XP. */
export function finishWork(player: Player, recipe: CraftRecipe, near: NearCheck): Outcome {
    const reason = whyNot(player, recipe, near);
    if (reason !== "") {
        return { ok: false, message: `Nada foi feito. ${reason}` };
    }
    if (!take(player, recipe)) {
        return { ok: false, message: "Nada foi feito: o que a receita pede não estava mais todo aí." };
    }
    const given = Inventory.add(player, { item: classOf(recipe.output), amount: recipe.amount });
    if (!given.ok) {
        giveBack(player, recipe);
        // A full bag is the player's to empty. The game turning the item itself down (a class it will not hand out, 2026-10-26: the belts and pouches
        // were the first of their kind to be sewn) is the work's, and it goes to the log with the game's own word for it.
        if (given.code !== undefined && given.code !== "" && given.code !== "inventoryCapacity") {
            console.log(`craft: o jogo não aceitou ${itemName(recipe.output)} (${recipe.id}) para ${player.nickname}: ${given.code}`);
            return { ok: false, message: "Nada foi feito: o jogo não aceitou este item, e nada foi gasto." };
        }
        return { ok: false, message: "Nada foi feito: não coube no seu inventário." };
    }
    const xp = paid(recipe.xp);
    try {
        player.addXp(trackOf(recipe), xp);
    } catch (error: unknown) {
        console.log(`craft: o XP de ${recipe.id} não foi dado a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`craft: ${player.nickname} fez ${recipe.amount}x ${itemName(recipe.output)} (${recipe.id}, +${xp} XP de ${trackOf(recipe)})`);
    return { ok: true, message: `${STATIONS[recipe.station].doing === "" ? "Pronto" : "Feito"}: ${recipe.amount}x ${itemName(recipe.output)} (+${xp} XP).` };
}

/**
 * Stops a piece of work that is going on (the player left, or the page asked): nothing is taken for the piece in the making, and what the pieces before it made stays made.
 * `say` is told how it ended; `onlyBatch` stops only a work of several pieces (closing the page does, so that nobody is held in a long animation with nothing to stop it).
 */
export function cancelWork(player: Player, say?: Reporter, onlyBatch = false): boolean {
    const job = working.get(player.id);
    if (job === undefined || (onlyBatch && job.count === 1)) {
        return false;
    }
    if (job.timer !== null) {
        clearTimeout(job.timer);
    }
    working.delete(player.id);
    stopWork(player);
    say?.(player, {
        ok: false,
        message: job.made === 0 ? "Trabalho interrompido: nada foi gasto." : `Trabalho interrompido: ${job.made} de ${job.count} feitos (${job.recipe.amount * job.made}x ${itemName(job.recipe.output)}, +${job.xp} XP).`,
    });
    return true;
}

export function isWorking(player: Player): boolean {
    return working.has(player.id);
}

// ---------------------------------------------------------------------------------------------
// Alchemy: the potion chosen on the page is taught to the player's recipe book, and the table may be used for a while.

const alchemyGrant = new Map<number, number>();

export function chooseAlchemy(player: Player, recipeId: string, now = Date.now()): Outcome {
    const recipe = recipeById(recipeId);
    if (recipe === undefined || recipe.station !== "alquimia" || recipe.alchemy === undefined) {
        return { ok: false, message: "Receita desconhecida." };
    }
    if (!mayCraft(player, "alchemy")) {
        return { ok: false, message: "Esta receita não é do seu ofício." };
    }
    if (!usesFreeCrafts(player) && levelOf(player, "alchemy") < recipe.level) {
        return { ok: false, message: `É preciso nível ${recipe.level} de alquimia para esta receita.` };
    }
    try {
        Crafting.setKnowledge(player, recipe.alchemy, craftSettings.fullKnowledge);
    } catch (error: unknown) {
        console.log(`craft: a receita de alquimia ${recipe.alchemy} não pôde ser ensinada a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false, message: "Não consegui pôr a receita no seu livro agora." };
    }
    alchemyGrant.set(player.id, now + craftSettings.alchemyGrantMs);
    return { ok: true, message: `${itemName(recipe.output)}: a receita está no seu livro. Use a mesa de alquimia (E) para preparar.` };
}

/** Whether the player chose a potion on the page a short while ago (the table may open for them). */
export function alchemyGranted(player: Player, now = Date.now()): boolean {
    return (alchemyGrant.get(player.id) ?? 0) > now;
}

// ---------------------------------------------------------------------------------------------

/** The recipes a level just reached unlocks, in the trades the player may work, by their skill. */
export function unlockedAt(player: Player, track: string, level: number): CraftRecipe[] {
    return CRAFT_RECIPES.filter((recipe) => recipe.level === level && trackOf(recipe) === track && mayCraft(player, STATIONS[recipe.station].craft));
}

export function forgetCraft(player: Player): void {
    cancelWork(player);
    alchemyGrant.delete(player.id);
}
