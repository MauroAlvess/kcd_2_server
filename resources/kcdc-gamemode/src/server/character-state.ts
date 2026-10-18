/**
 * What a character carries and has learned, kept between sessions.
 *
 * The framework keeps none of it: a player who leaves takes their inventory, their levels and perks, the
 * recipes in their book, their health and hunger with them, and comes back to a fresh Henry. This module
 * writes one file per Steam id (`playerdata/characters/<steamId>.json`, see `store.ts` for how) and puts it
 * back in the order the framework asks for it:
 *
 *   playerConnect         the inventory, with `Inventory.set`, so it is what they load in with;
 *   playerReady           levels, perks and points (`restoreProgression`), then health, hunger and energy;
 *   playerInventoryReady  the alchemy recipe book (`Crafting.setKnowledge`).
 *
 * It also keeps the ledger of kits already handed out (`kits.ts`), so a starter pack or a guild's kit is
 * given once per character, however often they rejoin or change guild.
 *
 * The rule that matters most: **never write over what is saved with something the session never restored.**
 * A part is only written once its restore has run (or there was nothing to restore), a record that could not
 * be read or put back locks the session read-only, and an empty inventory never replaces a full one. The worst
 * a bug here can do is fail to save; it cannot wipe a character.
 *
 * Identity is the Steam id the client reports, which the server does not verify (see `auth.ts`). Anyone who
 * can join as another Steam id can load that character; closing that needs `enforce` tickets, not this file.
 */

import { cleanSnapshot } from "./perk-guard.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata/characters";
const RESOURCE = "kcdc-gamemode";

/** How often the online characters are checked for changes. */
const TICK_MS = 30_000;

/** A change of this much in health, hunger, energy or stamina is worth a write on its own. */
const VITALS_STEP = 4;

/** Vitals alone are written at least this often. */
const VITALS_EVERY_MS = 2 * 60_000;

/**
 * After the saved vitals are asked for, the body still reports the old ones for a moment. Reading them back
 * in that window would write a fresh Henry's full health over the saved value.
 */
const VITALS_SETTLE_MS = 8_000;

/** Steam ids are 17 digits; the pattern also keeps a hostile id from reaching the file name. */
const STEAM_ID = /^[0-9]{5,20}$/;

const FULL_RECIPE = 536870911;

/** Gaps shorter than this between a change and its write are merged into one. */
const SAVE_DELAY_MS = 2_500;

export interface SavedRow {
    id: string;
    item: string;
    /** The registration id of a custom type (it holds a colon), or the table name of a native one. */
    name: string;
    amount: number;
    metadata: Record<string, unknown>;
    equipped: number;
}

export interface SavedInventory {
    items: SavedRow[];
    quickslots: InventoryQuickslots | null;
}

export interface Vitals {
    health: number;
    hunger: number;
    exhaust: number;
    stamina: number;
}

export interface CharacterRecord {
    v: 1;
    steamId: string;
    nickname: string;
    savedAt: number;
    inventory: SavedInventory | null;
    /** Rows a restore could not put back (an item type that no longer exists), kept so nothing is lost for good. */
    held: SavedRow[];
    progression: ProgressionSnapshot | null;
    knowledge: Record<string, number>;
    vitals: Vitals | null;
    kits: string[];
}

interface Session {
    readonly id: number;
    readonly steamId: string;
    readonly connectedAt: number;
    nickname: string;
    record: CharacterRecord;
    /** The saved data could not be read or restored: this session never writes. */
    locked: boolean;
    /** Not a Steam id we can file a character under: nothing is saved and no kit is given. */
    tracked: boolean;
    inventoryRestored: boolean;
    /** The game said it has no inventory for them yet: the restore is tried again as they get further in. */
    restorePending: boolean;
    progressionRestored: boolean;
    knowledgeRestored: boolean;
    /** Vitals are not read back before this moment. */
    vitalsAfter: number;
    lastCore: string;
    lastVitals: Vitals | null;
    lastWriteAt: number;
    warnedEmpty: boolean;
    /** Said to the player once the loading screen is down; chat sent earlier is lost. */
    warning: string | null;
}

const sessions = new Map<number, Session>();
const pendingSaves = new Set<number>();

function pathFor(steamId: string): string {
    return `${DIR}/${steamId}.json`;
}

function freshRecord(steamId: string, nickname: string): CharacterRecord {
    return { v: 1, steamId, nickname, savedAt: 0, inventory: null, held: [], progression: null, knowledge: {}, vitals: null, kits: [] };
}

function isRow(value: unknown): value is SavedRow {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const row = value as Partial<SavedRow>;
    return typeof row.id === "string" && typeof row.item === "string" && typeof row.amount === "number" && row.amount > 0 && typeof row.metadata === "object" && row.metadata !== null && typeof row.equipped === "number";
}

/** A row from disk with every field present; `name` is missing from rows written before it was kept. */
function normalRow(row: SavedRow): SavedRow {
    return { id: row.id, item: row.item, name: typeof row.name === "string" ? row.name : "", amount: row.amount, metadata: row.metadata, equipped: row.equipped };
}

/** What a file said, trusted for its shape only: anything else is dropped rather than passed to the engine. */
function sanitize(raw: unknown, steamId: string, nickname: string): CharacterRecord {
    const record = freshRecord(steamId, nickname);
    if (typeof raw !== "object" || raw === null) {
        return record;
    }
    const source = raw as Partial<CharacterRecord>;
    const inventory = source.inventory;
    if (typeof inventory === "object" && inventory !== null && Array.isArray(inventory.items)) {
        record.inventory = {
            items: inventory.items.filter(isRow).map(normalRow),
            quickslots: typeof inventory.quickslots === "object" ? inventory.quickslots : null,
        };
    }
    if (Array.isArray(source.held)) {
        record.held = source.held.filter(isRow).map(normalRow);
    }
    if (typeof source.progression === "object" && source.progression !== null) {
        record.progression = source.progression;
    }
    if (typeof source.knowledge === "object" && source.knowledge !== null) {
        for (const [recipe, mask] of Object.entries(source.knowledge)) {
            if (typeof mask === "number" && Number.isInteger(mask) && mask > 0 && mask <= FULL_RECIPE) {
                record.knowledge[recipe] = mask;
            }
        }
    }
    const vitals = source.vitals;
    if (typeof vitals === "object" && vitals !== null && [vitals.health, vitals.hunger, vitals.exhaust, vitals.stamina].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
        record.vitals = { health: vitals.health, hunger: vitals.hunger, exhaust: vitals.exhaust, stamina: vitals.stamina };
    }
    if (Array.isArray(source.kits)) {
        record.kits = source.kits.filter((kit): kit is string => typeof kit === "string");
    }
    record.savedAt = typeof source.savedAt === "number" ? source.savedAt : 0;
    return record;
}

// ---------------------------------------------------------------------------------------------
// What other modules ask.

/** Whether this player's character is being kept, and so may be given a kit. A locked or unfiled one may not. */
export function canKeep(player: Player): boolean {
    const session = sessions.get(player.id);
    return session !== undefined && session.tracked && !session.locked && session.inventoryRestored;
}

export function hasKit(player: Player, kit: string): boolean {
    return sessions.get(player.id)?.record.kits.includes(kit) ?? false;
}

/** Writes a kit into the ledger and schedules a save. Does nothing for a character that is not kept. */
export function markKit(player: Player, kit: string): void {
    const session = sessions.get(player.id);
    if (session === undefined || !session.tracked || session.locked || session.record.kits.includes(kit)) {
        return;
    }
    session.record.kits.push(kit);
    saveSoon(player.id);
}

/** Every kit marked for this player. */
export function kitsOf(player: Player): readonly string[] {
    return sessions.get(player.id)?.record.kits ?? [];
}

// ---------------------------------------------------------------------------------------------
// Restoring.

function toRequest(rows: readonly SavedRow[]): { id: string; item: string; amount: number; metadata: Record<string, unknown>; equipped: number }[] {
    return rows.map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: row.metadata, equipped: row.equipped }));
}

/** A custom type is registered under an id with a colon; the game's own table names have none. */
function isCustom(row: SavedRow): boolean {
    return row.name.includes(":");
}

/**
 * Puts the saved inventory back. The framework's `Inventory.set` is all-or-nothing, so one row it refuses (a custom
 * item type this server no longer registers) would otherwise keep the whole inventory from coming back. Each failed
 * attempt gives up something less important than the rest: first the quick slots, then the custom rows, which are
 * set aside in `held` and offered again at the next join.
 */
type Restore = "done" | "failed" | "unavailable";

function restoreInventory(player: Player, session: Session): Restore {
    const saved = session.record.inventory;
    if (saved === null) {
        return "done";
    }

    const plain = saved.items.filter((row) => !isCustom(row));
    const attempts: { label: string; items: SavedRow[]; quickslots: InventoryQuickslots | null; dropped: SavedRow[] }[] = [
        { label: "completo", items: saved.items, quickslots: saved.quickslots, dropped: [] },
        { label: "sem os atalhos rápidos", items: saved.items, quickslots: null, dropped: [] },
        { label: "sem os itens personalizados", items: plain, quickslots: null, dropped: saved.items.filter(isCustom) },
    ];

    let unavailable = 0;
    for (const attempt of attempts) {
        const result = Inventory.set(player, { items: toRequest(attempt.items), quickslots: attempt.quickslots });
        if (result.code === "inventoryUnavailable") {
            unavailable += 1;
        }
        if (result.ok) {
            if (attempt.label !== "completo") {
                console.log(`characters: ${session.nickname}: inventário restaurado ${attempt.label}`);
            }
            for (const row of attempt.dropped) {
                if (!session.record.held.some((held) => held.id === row.id)) {
                    session.record.held.push(row);
                }
            }
            // What was set aside is no longer part of the live inventory; keep the saved copy in step with it.
            session.record.inventory = { items: attempt.items, quickslots: attempt.quickslots };
            return "done";
        }
        console.log(`characters: ${session.nickname}: o inventário ${attempt.label} foi recusado (${result.code})`);
    }
    return unavailable === attempts.length ? "unavailable" : "failed";
}

/** The saved inventory is back: from here the session may be saved. */
function finishRestore(player: Player, session: Session): void {
    session.inventoryRestored = true;
    session.restorePending = false;
    retryHeld(player, session);
    session.lastCore = coreOf(session.record);
    console.log(`characters: ${player.nickname}: ${session.record.inventory === null ? "personagem novo" : `inventário devolvido (${session.record.inventory.items.length} item(ns))`}`);
}

function lock(player: Player, session: Session, why: string): void {
    session.locked = true;
    session.restorePending = false;
    const text = "Seu inventário salvo não pôde ser devolvido, então nada do que você fizer agora será gravado. Avise a administração; o que estava salvo continua guardado.";
    console.error(`characters: ${player.nickname}: ${why}; nada será gravado nesta sessão`);
    if (player.ready) {
        Chat.sendToPlayer(player, text);
    } else {
        session.warning = text;
    }
}

/**
 * The framework says the inventory exists from `playerConnect`, but if it ever answers that it does not yet, the restore
 * waits (and nothing is written) and is tried again at each later step of the join.
 */
function restoreLater(player: Player): void {
    const session = sessions.get(player.id);
    if (session === undefined || !session.restorePending || session.locked) {
        return;
    }
    const outcome = restoreInventory(player, session);
    if (outcome === "done") {
        finishRestore(player, session);
    } else if (outcome === "failed") {
        lock(player, session, "não consegui devolver o inventário salvo");
    }
}

/** Tries to give back rows that an earlier restore had to set aside. */
function retryHeld(player: Player, session: Session): void {
    if (session.record.held.length === 0) {
        return;
    }
    const remaining: SavedRow[] = [];
    for (const row of session.record.held) {
        const result = Inventory.add(player, { item: row.item, amount: row.amount, metadata: row.metadata, notify: false });
        if (!result.ok) {
            remaining.push(row);
        }
    }
    session.record.held = remaining;
}

function restoreVitals(player: Player, vitals: Vitals): void {
    if (!player.ready || !player.alive) {
        return;
    }
    try {
        // Health and energy first: they move the ceiling stamina is clamped to.
        if (vitals.health >= 1) {
            player.setHealth(vitals.health);
        }
        player.setStat("exhaust", vitals.exhaust);
        player.setStat("stamina", vitals.stamina);
        player.setHunger(vitals.hunger);
    } catch (error: unknown) {
        console.log(`characters: ${player.nickname}: os vitais salvos foram recusados: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// ---------------------------------------------------------------------------------------------
// Saving.

function currentVitals(player: Player): Vitals | null {
    if (!player.ready || !player.alive) {
        return null;
    }
    const vitals: Vitals = {
        health: player.getStat("health"),
        hunger: player.getStat("hunger"),
        exhaust: player.getStat("exhaust"),
        stamina: player.getStat("stamina"),
    };
    return Object.values(vitals).every((value) => Number.isFinite(value) && value >= 0) ? vitals : null;
}

function vitalsDiffer(a: Vitals | null, b: Vitals | null): boolean {
    if (a === null || b === null) {
        return a !== b;
    }
    return (["health", "hunger", "exhaust", "stamina"] as const).some((key) => Math.abs(a[key] - b[key]) >= VITALS_STEP);
}

/** Rebuilds the record from the live player, part by part, keeping a part as it was where it cannot be read yet. */
function collect(player: Player, session: Session, now: number): CharacterRecord {
    const next: CharacterRecord = { ...session.record, nickname: player.nickname, knowledge: { ...session.record.knowledge }, kits: [...session.record.kits], held: [...session.record.held] };

    if (session.inventoryRestored) {
        const state = Inventory.get(player);
        if (state !== null && state.ready) {
            const items = state.items.map((row): SavedRow => ({ id: row.id, item: row.item, name: row.name, amount: row.amount, metadata: row.metadata, equipped: row.equipped }));
            const hadSome = (session.record.inventory?.items.length ?? 0) > 0;
            if (items.length === 0 && hadSome) {
                if (!session.warnedEmpty) {
                    session.warnedEmpty = true;
                    console.log(`characters: ${player.nickname}: o inventário está vazio; mantive o último salvo`);
                }
            } else {
                next.inventory = { items, quickslots: state.quickslots };
            }
        }
    }

    if (session.progressionRestored) {
        const progression = player.progression;
        if (progression !== null) {
            next.progression = progression;
        }
    }

    if (session.knowledgeRestored) {
        next.knowledge = { ...Crafting.knowledge(player) };
    }

    if (session.progressionRestored && now >= session.vitalsAfter) {
        const vitals = currentVitals(player);
        if (vitals !== null) {
            next.vitals = vitals;
        }
    }
    return next;
}

function coreOf(record: CharacterRecord): string {
    return JSON.stringify([record.inventory, record.held, record.progression, record.knowledge, record.kits]);
}

/** Whether this session is the newest one for its Steam id: an older one still being torn down must not write. */
function isNewest(session: Session): boolean {
    for (const other of sessions.values()) {
        if (other !== session && other.steamId === session.steamId && other.connectedAt > session.connectedAt) {
            return false;
        }
    }
    return true;
}

function save(player: Player, session: Session, reason: string, force: boolean): void {
    if (!session.tracked || session.locked || !isNewest(session)) {
        return;
    }
    // Saved belongings that never came back into this session are not to be written over, not even unchanged.
    if (!session.inventoryRestored && session.record.inventory !== null) {
        return;
    }
    const now = Date.now();
    const next = collect(player, session, now);
    const core = coreOf(next);
    const coreChanged = core !== session.lastCore;
    const vitalsChanged = vitalsDiffer(next.vitals, session.lastVitals) && now - session.lastWriteAt >= 10_000;
    const vitalsDue = next.vitals !== null && now - session.lastWriteAt >= VITALS_EVERY_MS;
    if (!force && !coreChanged && !vitalsChanged && !vitalsDue) {
        return;
    }

    next.savedAt = now;
    try {
        write(pathFor(session.steamId), next);
    } catch (error: unknown) {
        console.log(`characters: ${player.nickname}: não consegui salvar (${reason}): ${error instanceof Error ? error.message : String(error)}`);
        return;
    }
    session.record = next;
    session.lastCore = core;
    session.lastVitals = next.vitals;
    session.lastWriteAt = now;
    if (reason === "saída" || reason === "parada") {
        console.log(`characters: ${player.nickname} gravado (${reason}): ${next.inventory?.items.length ?? 0} item(ns), ${Object.keys(next.knowledge).length} receita(s), ${next.kits.length} kit(s)`);
    }
}

function saveSoon(playerId: number): void {
    if (pendingSaves.has(playerId)) {
        return;
    }
    pendingSaves.add(playerId);
    setTimeout(() => {
        pendingSaves.delete(playerId);
        const player = Player.getById(playerId);
        const session = sessions.get(playerId);
        if (player && session) {
            save(player, session, "agendado", true);
        }
    }, SAVE_DELAY_MS);
}

// ---------------------------------------------------------------------------------------------

export function installCharacterState(): void {
    ensureDir(DIR);

    Events.on("playerConnect", (player) => {
        const steamId = player.steamId;
        const base = {
            id: player.id,
            steamId,
            connectedAt: Date.now(),
            nickname: player.nickname,
            inventoryRestored: false,
            restorePending: false,
            progressionRestored: false,
            knowledgeRestored: false,
            vitalsAfter: 0,
            lastCore: "",
            lastVitals: null,
            lastWriteAt: 0,
            warnedEmpty: false,
            warning: null,
        };

        if (!STEAM_ID.test(steamId)) {
            console.log(`characters: ${player.nickname} entrou sem uma identificação Steam; o personagem dele não será salvo`);
            sessions.set(player.id, { ...base, record: freshRecord(steamId, player.nickname), locked: false, tracked: false, warning: "Sua conta não tem identificação Steam, então o seu personagem não será salvo." });
            return;
        }

        const loaded = read<unknown>(pathFor(steamId));
        if (loaded.status === "corrupt") {
            console.error(`characters: o arquivo de ${player.nickname} (${steamId}) está ilegível e foi deixado como está: ${loaded.reason}`);
            sessions.set(player.id, { ...base, record: freshRecord(steamId, player.nickname), locked: true, tracked: true, warning: "Seu personagem salvo não pôde ser lido, então nada do que você fizer agora será gravado. Avise a administração." });
            return;
        }
        if (loaded.status === "ok" && loaded.fromBackup) {
            console.log(`characters: ${player.nickname}: o arquivo principal estava danificado; usei a cópia anterior`);
        }

        const record = sanitize(loaded.status === "ok" ? loaded.value : null, steamId, player.nickname);
        const session: Session = { ...base, record, locked: false, tracked: true };
        sessions.set(player.id, session);

        const outcome = restoreInventory(player, session);
        if (outcome === "unavailable") {
            session.restorePending = true;
            console.log(`characters: ${player.nickname}: o jogo ainda não tem o inventário dele; tento de novo mais adiante`);
            return;
        }
        if (outcome === "failed") {
            lock(player, session, "não consegui devolver o inventário salvo");
            return;
        }
        finishRestore(player, session);
    });

    Events.on("playerSpawned", (player) => restoreLater(player));

    Events.on("playerReady", (player) => {
        restoreLater(player);
        const session = sessions.get(player.id);
        if (session === undefined) {
            return;
        }
        if (session.warning !== null) {
            Chat.sendToPlayer(player, session.warning);
            session.warning = null;
        }
        if (!session.tracked || session.locked) {
            return;
        }
        if (session.record.progression !== null) {
            // A perk the alchemy tables cannot work with (`perk-guard.ts`) is left out, and its point given back.
            const cleaned = cleanSnapshot(session.record.progression);
            if (cleaned.removed.length > 0) {
                session.record.progression = cleaned.snapshot;
                Chat.sendToPlayer(player, `Você tinha ${cleaned.removed.join(" e ")}, que impede as mesas de alquimia de funcionarem no servidor por enquanto: o talento foi tirado e o ponto voltou para você, para gastar em outro.`);
                console.log(`characters: ${player.nickname}: ${cleaned.removed.join(", ")} tirado(s), o ponto devolvido`);
            }
            if (!player.restoreProgression(session.record.progression)) {
                console.log(`characters: ${player.nickname}: a progressão salva não foi aceita`);
            }
        }
        session.progressionRestored = true;
        if (session.record.vitals !== null) {
            restoreVitals(player, session.record.vitals);
            session.vitalsAfter = Date.now() + VITALS_SETTLE_MS;
        }
    });

    Events.on("playerInventoryReady", (player) => {
        restoreLater(player);
        const session = sessions.get(player.id);
        if (session === undefined || !session.tracked || session.locked) {
            return;
        }
        for (const [recipe, mask] of Object.entries(session.record.knowledge)) {
            if (!Crafting.setKnowledge(player, recipe, mask)) {
                console.log(`characters: ${player.nickname}: a receita ${recipe} salva não foi aceita`);
            }
        }
        session.knowledgeRestored = true;
    });

    Events.on("playerInventoryChanged", (player) => {
        const session = sessions.get(player.id);
        if (session !== undefined && session.tracked && !session.locked && session.inventoryRestored) {
            saveSoon(player.id);
        }
    });

    Events.on("playerPerkAdded", (player) => {
        const session = sessions.get(player.id);
        if (session !== undefined && session.progressionRestored) {
            saveSoon(player.id);
        }
    });

    Events.on("playerDisconnect", (player) => {
        const session = sessions.get(player.id);
        if (session === undefined) {
            return;
        }
        save(player, session, "saída", true);
        sessions.delete(player.id);
        pendingSaves.delete(player.id);
    });

    const timer = setInterval(() => {
        for (const [id, session] of sessions) {
            const player = Player.getById(id);
            if (player) {
                save(player, session, "periódico", false);
            }
        }
    }, TICK_MS);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        let saved = 0;
        for (const [id, session] of sessions) {
            const player = Player.getById(id);
            if (player) {
                save(player, session, "parada", true);
                saved += 1;
            }
        }
        console.log(`characters: parando; ${saved} personagem(ns) gravado(s)`);
    });

    console.log(`characters: guardando inventário, progressão, receitas e vitais em ${DIR}/`);
}
