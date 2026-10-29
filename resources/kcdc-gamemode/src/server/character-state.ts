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
 * Levels only climb (a start again wipes the record, `discardCharacter`): a track that reads lower than the file says
 * is a restore that did not hold, never a loss to be written (2026-10-23: a player's whole progression read as a fresh
 * character's). `keepClimbs` keeps the saved track in what is written, and the restore is asked again a few seconds
 * after the first and at the periodic looks (`verifyProgression`), logged when it was needed.
 *
 * Identity is the Steam id the client reports, which the server does not verify (see `auth.ts`). Anyone who
 * can join as another Steam id can load that character; closing that needs `enforce` tickets, not this file.
 */

import { leaveOutCombos, takeOutCombos } from "./esgrima.js";
import { cleanSnapshot } from "./perk-guard.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata/characters";
const RESOURCE = "kcdc-gamemode";

/** How often the online characters are checked for changes. */
const TICK_MS = 30_000;

/**
 * Everybody is looked at once in `TICK_MS`, but not in one breath: a look costs about a millisecond and a half (the inventory and the progression read out of the
 * game, a write when something changed; 17 ms at the worst, measured live with seven players), so two hundred in one go would stop the server for a third of a
 * second every half minute. With more than `SPREAD_FROM` characters the looks are spread, a `SPREAD_GAP_MS` apart at most, over the first `SPREAD_SHARE` of the
 * interval.
 */
const SPREAD_FROM = 4;
const SPREAD_GAP_MS = 250;
const SPREAD_SHARE = 0.8;

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

/** When, after the progression was put back, it is looked at again, and how many times a session may have it put back again. */
const VERIFY_AFTER_MS: readonly number[] = [5_000, 20_000];
const MAX_REPAIRS = 3;

/** The tracks the game computes itself (the fencing from the weapon skills): they may read otherwise than they were saved and are not compared. */
const DERIVED_TRACKS: ReadonlySet<string> = new Set(["fencing"]);

/** Gaps shorter than this between a change and its write are merged into one. */
const SAVE_DELAY_MS = 2_500;
/**
 * The least time between two early saves of one player (the 30-second round and their leaving still save what changed): an inventory that keeps changing (a
 * trade, a loot, a craft) was written every 2.5 seconds, each time read whole through the engine, and one such save took 599 ms (perf-watch, 2026-10-26).
 */
const SAVE_GAP_MS = 8_000;
const lastEarlySave = new Map<number, number>();

declare const performance: { now(): number } | undefined;
/** Times a part of a save for perf-watch (`__kcdcSection`, which exists only while it watches). */
function part<T>(label: string, work: () => T): T {
    const report = (globalThis as unknown as { __kcdcSection?: (name: string, took: number) => void }).__kcdcSection;
    if (report === undefined) {
        return work();
    }
    const clock = (): number => (typeof performance !== "undefined" && performance !== undefined ? performance.now() : Date.now());
    const began = clock();
    try {
        return work();
    } finally {
        report(label, clock() - began);
    }
}

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
    /** How many times the progression had to be put back again (`verifyProgression`). */
    repairs: number;
    /** What the game was asked to take at the start (the file's, with the perks the alchemy tables cannot work with left out). */
    restored: ProgressionSnapshot | null;
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
// Levels only climb.

/** A track's place on its climb: the level, then the XP into the next. */
const climb = (track: { readonly level: number; readonly xp: number }): number => track.level * 1_000_000 + track.xp;

/**
 * The live progression, with every track that has fallen behind what was saved put back as it was saved (the tracks the game computes itself
 * are left out of the comparison). `kept` names them. Nothing else of the live progression is touched.
 */
export function keepClimbs(live: ProgressionSnapshot, saved: ProgressionSnapshot | null): { readonly snapshot: ProgressionSnapshot; readonly kept: string[] } {
    if (saved === null) {
        return { snapshot: live, kept: [] };
    }
    const tracks = { ...live.tracks };
    const kept: string[] = [];
    for (const [name, was] of Object.entries(saved.tracks)) {
        if (DERIVED_TRACKS.has(name) || typeof was?.level !== "number" || typeof was.xp !== "number") {
            continue;
        }
        const now = tracks[name];
        if (now === undefined || climb(now) < climb(was) - 1) {
            tracks[name] = { level: was.level, xp: was.xp };
            kept.push(name);
        }
    }
    return { snapshot: kept.length === 0 ? live : { ...live, tracks }, kept };
}

/**
 * Looks at the player's progression against what is saved and, when a track reads lower, asks the game to take it again: in the first looks
 * after the restore everything that was asked for (`whole`: the perks and points too, which a restore that did not hold lost with the levels),
 * later only the tracks that lag. Each track is the better of the two. A few times per session, then it is left to the writer's `keepClimbs`.
 */
function verifyProgression(player: Player, session: Session, when: string, whole: boolean): void {
    const saved = whole ? session.restored : session.record.progression;
    const live = player.progression;
    if (saved === null || live === null || !session.tracked || session.locked || !session.progressionRestored || session.repairs >= MAX_REPAIRS) {
        return;
    }
    const { snapshot, kept } = keepClimbs(live, saved);
    if (kept.length === 0) {
        return;
    }
    session.repairs += 1;
    const lines = kept.map((name) => `${name} ${live.tracks[name]?.level ?? 0} < ${saved.tracks[name]?.level ?? 0}`).join(", ");
    // Later only the tracks: a restore replaces the perk set it is given, and since KCDC 1.7.2 leaves a blocked perk (a weapon combo, `esgrima.ts`) out of it, so the live perks are not sent back.
    const accepted = player.restoreProgression((whole ? { ...saved, tracks: snapshot.tracks } : { tracks: snapshot.tracks }) as ProgressionSnapshot);
    console.log(`characters: ${player.nickname}: ${kept.length} trilha(s) abaixo do salvo (${lines}); ${accepted ? "restaurei de novo" : "o jogo não aceitou restaurar de novo"} (${when}, vez ${session.repairs})`);
}

// ---------------------------------------------------------------------------------------------
// What other modules ask.

/**
 * A player starts again (`character-reset.ts`): what was saved of the character is wiped, and the sessions of this Steam id
 * stop writing, so the save at their leaving does not bring it back. The next entry has nothing to restore.
 */
export function discardCharacter(steamId: string): void {
    if (!STEAM_ID.test(steamId)) {
        return;
    }
    for (const session of sessions.values()) {
        if (session.steamId === steamId) {
            session.tracked = false;
        }
    }
    write(pathFor(steamId), freshRecord(steamId, ""));
}

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
// An administrator's hand on the file of a character who is not here (`commands/nivel.ts`).

/** What the file says of a character's progression, or null when there is no file or no progression in it. */
export function savedProgression(steamId: string): ProgressionSnapshot | null {
    if (!STEAM_ID.test(steamId)) {
        return null;
    }
    const loaded = read<unknown>(pathFor(steamId));
    return loaded.status === "ok" ? sanitize(loaded.value, steamId, "").progression : null;
}

export type Raise = "feito" | "sem personagem" | "sem trilha" | "já está";

/** Raises a track in the file of a character who is not here to `level`, with no XP into the next; the file is otherwise as it was. */
export function raiseSavedTrack(steamId: string, track: string, level: number): Raise {
    if (!STEAM_ID.test(steamId)) {
        return "sem personagem";
    }
    const loaded = read<unknown>(pathFor(steamId));
    if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
        return "sem personagem";
    }
    const record = loaded.value as { progression?: { tracks?: Record<string, { level?: unknown; xp?: unknown } | undefined> } };
    const entry = record.progression?.tracks?.[track];
    if (entry === undefined || entry === null || typeof entry.level !== "number") {
        return "sem trilha";
    }
    if (entry.level >= level) {
        return "já está";
    }
    entry.level = level;
    entry.xp = 0;
    write(pathFor(steamId), record);
    return "feito";
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
            // The weapon combos are the Esgrima's, in its own file: never saved here (what the game holds of them may be an administrator's loan).
            next.progression = leaveOutCombos(keepClimbs(progression, session.record.progression).snapshot);
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
    if (reason === "periódico") {
        verifyProgression(player, session, "olhada periódica", false);
    }
    const next = part("chars.coletar", () => collect(player, session, now));
    const core = part("chars.comparar", () => coreOf(next));
    const coreChanged = core !== session.lastCore;
    const vitalsChanged = vitalsDiffer(next.vitals, session.lastVitals) && now - session.lastWriteAt >= 10_000;
    const vitalsDue = next.vitals !== null && now - session.lastWriteAt >= VITALS_EVERY_MS;
    if (!force && !coreChanged && !vitalsChanged && !vitalsDue) {
        return;
    }

    next.savedAt = now;
    try {
        part("chars.gravar", () => write(pathFor(session.steamId), next));
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

/**
 * Saves everybody here now: before an announced restart, and once more at the very end of a stop, after every other module
 * has handed back what it held (`index.ts`). `force` writes even a record that has not changed. How many were saved.
 */
export function saveAllCharacters(reason: string, force: boolean): number {
    let saved = 0;
    for (const [id, session] of sessions) {
        const player = Player.getById(id);
        if (player) {
            save(player, session, reason, force);
            saved += 1;
        }
    }
    return saved;
}

function saveSoon(playerId: number): void {
    if (pendingSaves.has(playerId)) {
        return;
    }
    pendingSaves.add(playerId);
    const wait = Math.max(SAVE_DELAY_MS, (lastEarlySave.get(playerId) ?? Number.NEGATIVE_INFINITY) + SAVE_GAP_MS - Date.now());
    setTimeout(() => {
        pendingSaves.delete(playerId);
        lastEarlySave.set(playerId, Date.now());
        const player = Player.getById(playerId);
        const session = sessions.get(playerId);
        if (player && session) {
            save(player, session, "agendado", true);
        }
    }, wait);
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
            repairs: 0,
            restored: null,
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
            // The weapon combos are the Esgrima's to keep (`esgrima.ts`): left out of what the game is asked to restore, written down there and put back by it a little after.
            session.record.progression = takeOutCombos(player.steamId, session.record.progression);
            if (!player.restoreProgression(session.record.progression)) {
                console.log(`characters: ${player.nickname}: a progressão salva não foi aceita`);
            }
        }
        session.restored = session.record.progression;
        session.progressionRestored = true;
        for (const delay of VERIFY_AFTER_MS) {
            setTimeout(() => {
                const again = Player.getById(player.id);
                if (again !== null && sessions.get(player.id) === session) {
                    verifyProgression(again, session, `${delay / 1000} s depois`, true);
                }
            }, delay);
        }
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
        lastEarlySave.delete(player.id);
    });

    const timer = setInterval(() => {
        const ids = [...sessions.keys()];
        const gap = ids.length > SPREAD_FROM ? Math.min(SPREAD_GAP_MS, Math.floor((TICK_MS * SPREAD_SHARE) / ids.length)) : 0;
        ids.forEach((id, index) => {
            const look = (): void => {
                const session = sessions.get(id);
                const player = Player.getById(id);
                if (session !== undefined && player) {
                    save(player, session, "periódico", false);
                }
            };
            if (gap === 0) {
                look();
            } else {
                setTimeout(look, index * gap);
            }
        });
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
