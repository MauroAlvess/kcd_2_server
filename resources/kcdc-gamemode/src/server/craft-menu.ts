/**
 * The trades' page, put up and answered (`craft.ts` does the work).
 *
 * - The fire, the smokehouse and the rack: their menu (`cook-menu.ts`, "Cozinhar / Sair" and the like) opens the page.
 * - The forge: the same menu at the level's smitheries ("Forjar / Sair").
 * - Sewing: the panel (F2, Guildas) opens it, anywhere, for an artisan.
 * - The alchemy table: a member's use of it is refused until a potion is chosen on the page ("Criar / Sair", then the page);
 *   the potion goes into the player's recipe book and the table opens on the next use, for the game's own brewing.
 */

import { stationsNear } from "./cooking.js";
import type { CraftStation } from "./craft-data.js";
import { alchemyGranted, atOwnAlchemyTable, batchOf, brew, cancelWork, chooseAlchemy, forgeNear, forgetCraft, isWorking, madeOnPage, make, recipeById, STATIONS, unlockedAt, viewFor } from "./craft.js";
import type { NearCheck, Outcome } from "./craft.js";
import { workSpot } from "./craft-spot.js";
import { craftTitle } from "./craft-titles.js";
import { emitLarge } from "./big-emit.js";
import { canExtractAt, extract, extractView, EXTRACT_PREFIX, MODES } from "./extract.js";
import { cancelPlanting, farmPageClosed, PROCESS_PREFIX, plantFromPage, processFromPage, RECIPE_PREFIX } from "./farm.js";
import { mayCraft } from "./guild-crafts.js";
import { REPAIR_PREFIX, repairFromPage, repairPageClosed } from "./repair.js";

const RESOURCE = "kcdc-gamemode";

/** The page each player has open, by its trade. */
const open = new Map<number, CraftStation>();

/** The players whose forge or sewing page shows the extraction (2026-10-27, `extract.ts`) and not the recipes. */
const extracting = new Set<number>();

/** What the page shows a player now: the extraction's list on its tab, the trade's recipes (with the tabs, where there are two) otherwise. */
function viewOf(player: Player, station: CraftStation): object {
    if (canExtractAt(station) && extracting.has(player.id)) {
        return extractView(player, station);
    }
    const view = viewFor(player, station);
    return canExtractAt(station) ? { ...view, mode: "fabricar", modes: MODES } : view;
}

/** Whether the player stands where a trade is worked. */
export const nearStation: NearCheck = (player, station) => {
    if (station === "forja") {
        return forgeNear(player.position);
    }
    if (station === "fogo" || station === "defumador" || station === "secador") {
        return stationsNear(player.position).includes(station);
    }
    return true;
};

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 4096) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Puts a trade's page up for a player (or sends it again with what they have now). */
export function openCraftHud(player: Player, station: CraftStation): boolean {
    if (!player.ready || !mayCraft(player, STATIONS[station].craft)) {
        return false;
    }
    open.set(player.id, station);
    extracting.delete(player.id);
    // The title image goes with the page when it opens (the page keeps it), not with each refresh after a piece of work.
    const img = craftTitle(station);
    // In pieces when too big for one message: the forge's 184 recipes are 79 KB, and a message holds about 29.
    emitLarge(player, "craft.view", JSON.stringify(img === "" ? viewOf(player, station) : { ...viewOf(player, station), img }));
    return true;
}

function report(player: Player, outcome: Outcome): void {
    player.emit(`${RESOURCE}:craft.result`, JSON.stringify({ ok: outcome.ok, text: outcome.message }));
    Chat.sendToPlayer(player, outcome.message);
    const station = open.get(player.id);
    if (station !== undefined) {
        emitLarge(player, "craft.view", JSON.stringify(viewOf(player, station)));
    }
}

// ---------------------------------------------------------------------------------------------
// The alchemy table: "Criar / Sair" first.

const alchemyMenus = new Set<number>();

export function openAlchemyMenu(player: Player): void {
    if (Dialogue.sessionOf(player.id) !== 0) {
        return;
    }
    const session = Dialogue.open(player.id, {
        line: "A mesa de alquimia: escolha antes a poção que vai preparar.",
        onRight: false,
        options: [
            { id: "craft:create", text: "Criar", enabled: true },
            { id: "craft:leave", text: "Sair", enabled: true },
        ],
    });
    if (session !== 0) {
        alchemyMenus.add(session);
    }
}

const ALCHEMY_TOLD_MS = 4_000;
const toldAt = new Map<number, number>();

export function installCraftMenu(): void {
    Events.onClient(`${RESOURCE}:craft.make`, (sender, payload) => {
        const player = sender as Player;
        const id = fieldsOf(payload)["id"];
        if (typeof id !== "string") {
            return;
        }
        // How many the page asks for at once, from 1 to 10 (2026-10-27): the work is the recipe's, that many times over, each paid in XP.
        const count = batchOf(fieldsOf(payload)["n"]);
        // The gardens' page shares this one: its "Plantar" is `farm.ts`'s (its recipes are `horta:<crop>`).
        if (id.startsWith(RECIPE_PREFIX)) {
            plantFromPage(player, id);
            return;
        }
        // And the work done on the harvest at the garden (the flax spun, the grain milled, the seeds kept back, 2026-10-27).
        if (id.startsWith(PROCESS_PREFIX)) {
            processFromPage(player, id, count);
            return;
        }
        // So does the grindstone's: its "Reparar" is `repair.ts`'s (the rows are the weapons of the bag, `reparo:<row>`).
        if (id.startsWith(REPAIR_PREFIX)) {
            repairFromPage(player, id);
            return;
        }
        // And the forge's and the needle's second tab: "Extrair" is `extract.ts`'s (the rows are the pieces of the bag, `extrair:<row>`).
        if (id.startsWith(EXTRACT_PREFIX)) {
            const station = open.get(player.id);
            if (station === undefined || !canExtractAt(station)) {
                return;
            }
            report(player, isWorking(player) ? { ok: false, message: "Você já está trabalhando em algo." } : extract(player, id, station, nearStation));
            return;
        }
        // A potion of the game's is chosen here and brewed at its table; a bandage is made here, like any other trade's work.
        const recipe = recipeById(id);
        if (open.get(player.id) === "alquimia" && (recipe === undefined || !madeOnPage(recipe))) {
            // At a table this server put in the world there is no game table to brew at: the potion is made on the page.
            if (recipe !== undefined && atOwnAlchemyTable(player)) {
                brew(player, id, atOwnAlchemyTable, report, workSpot, count);
                return;
            }
            report(player, chooseAlchemy(player, id));
            return;
        }
        make(player, id, nearStation, report, workSpot, count);
    });
    // The tabs of the forge's and the sewing page: the recipes ("fabricar") or the pieces to break ("extrair").
    Events.onClient(`${RESOURCE}:craft.mode`, (sender, payload) => {
        const player = sender as Player;
        const mode = fieldsOf(payload)["mode"];
        const station = open.get(player.id);
        if (station === undefined || !canExtractAt(station) || (mode !== "fabricar" && mode !== "extrair") || isWorking(player)) {
            return;
        }
        if (mode === "extrair") {
            extracting.add(player.id);
        } else {
            extracting.delete(player.id);
        }
        emitLarge(player, "craft.view", JSON.stringify(viewOf(player, station)));
    });
    Events.onClient(`${RESOURCE}:craft.closed`, (sender) => {
        const player = sender as Player;
        open.delete(player.id);
        extracting.delete(player.id);
        farmPageClosed(player);
        repairPageClosed(player);
        // A work of several pieces ends with the page that was showing it (nobody is left held in a long animation with nothing to stop it): what was made stays made.
        cancelWork(player, report, true);
    });
    Events.onClient(`${RESOURCE}:craft.cancel`, (sender) => {
        const player = sender as Player;
        if (!cancelWork(player, report)) {
            cancelPlanting(player);
        }
    });
    // Sewing, from the panel.
    Events.onClient(`${RESOURCE}:status.craftOpen`, (sender, payload) => {
        const player = sender as Player;
        if (fieldsOf(payload)["station"] === "costura" && !openCraftHud(player, "costura")) {
            Chat.sendToPlayer(player, "Só os artesãos (guilda Artifices) costuram.");
        }
    });

    // The alchemy table: a member who has not chosen a potion on the page is shown the menu first.
    Events.on("craftingStarting", (player, proposal) => {
        const fields = proposal as { kind?: unknown; continuationOf?: unknown };
        if (fields.kind !== "alchemy" || !mayCraft(player, "alchemy")) {
            return undefined;
        }
        if (alchemyGranted(player) || (typeof fields.continuationOf === "string" && fields.continuationOf !== "")) {
            return undefined;
        }
        const now = Date.now();
        if (now - (toldAt.get(player.id) ?? 0) >= ALCHEMY_TOLD_MS) {
            toldAt.set(player.id, now);
            openAlchemyMenu(player);
        }
        return false;
    });
    Events.on("dialogueChoice", (session, player, option) => {
        if (!alchemyMenus.delete(session)) {
            return;
        }
        Dialogue.close(session);
        if (option === "craft:create") {
            openCraftHud(player, "alquimia");
        }
    });
    Events.on("dialogueClosed", (session) => {
        alchemyMenus.delete(session);
    });

    // New recipes as the skill grows.
    Events.on("playerLevelUp", (player, track, level) => {
        const fresh = unlockedAt(player, track, level);
        if (fresh.length > 0) {
            const names = fresh.slice(0, 6).map((recipe) => STATIONS[recipe.station].title + ": " + recipe.id.split(":")[1]);
            const text = `Novas receitas liberadas (${fresh.length}) no nível ${level}. Veja no menu do seu ofício.`;
            Chat.sendToPlayer(player, text);
            player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
            console.log(`craft: ${player.nickname} chegou ao nível ${level} de ${track}: ${names.join(", ")}`);
        }
    });

    Events.on("playerDisconnect", (player) => {
        open.delete(player.id);
        extracting.delete(player.id);
        toldAt.delete(player.id);
        repairPageClosed(player);
        forgetCraft(player);
    });
}
