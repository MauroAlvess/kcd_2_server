/**
 * Horses that belong to players, kept where they were left, across disconnects and restarts.
 *
 * A horse is a player's once it is given to them (the admin's `/horse` spawns one for the caller, `/horse give` hands
 * one over). From then on it does not go when its owner leaves (`destroyWithOwner` off): it waits where it stands,
 * nobody else may ride it, and it is the owner's again when they come back. Its breed (soul), name, gear and the place
 * it was left are written to `playerdata/horses.json` and the horse is put back there when the server starts. What the
 * game's own saddlebags hold is not the server's to read or write (the framework gives a script no way to reach a horse's
 * inventory, so the game's bag screen shows items nobody can take and takes none): the horse's real storage is its
 * "alforjes" (`horse-bags.ts`), a stash the server keeps and opens on the transfer screen, whose rows are kept here, with
 * the horse (`bags`).
 *
 * A horse that dies is forgotten, as in the game. `/cavalo` tells an owner where their horse is and calls it to them;
 * so do the panel's Chamar and X, the game's own whistle (`src/client/whistle.ts`), which on its own would whistle for a
 * horse a multiplayer player does not have.
 *
 * A called horse runs a route the server plans on the navigation mesh (`moveTo`). Each call is written to the log with
 * that route (how many corners, how long) and how it ended; one stuck on the way (`blocked`, `failed`) is sent on again
 * from where it stands, a couple of times, before the owner is told to go and fetch it.
 */

import { isAdmin } from "./auth.js";
import { yawOf } from "./position.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/horses.json`;
const RESOURCE = "kcdc-gamemode";

const SAVE_EVERY_MS = 60_000;
const STEAM_ID = /^[0-9]{5,20}$/;

/** How far a horse hears its owner's call. */
export const CALL_RANGE_M = 300;

/** A horse stuck on the way to a call is sent on again this many times, this long after it stopped. */
export const CALL_REPLANS = 2;
const REPLAN_AFTER_MS = 1_500;

/** One whistle per player this often; the client already makes a held key one whistle. */
const WHISTLE_EVERY_MS = 2_000;

interface Call {
    readonly playerId: number;
    readonly label: string;
    readonly at: number;
    replans: number;
}

/** The calls under way, by horse id. */
const calls = new Map<number, Call>();
const lastWhistle = new Map<number, number>();

export const HORSE_NAME_MIN = 2;
export const HORSE_NAME_MAX = 24;

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

const DIRECTIONS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"] as const;

/** Which way to go from `from` to `to`, on the compass: the level's +Y is north and +X east. */
export function compassDirection(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }): string {
    const degrees = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
    const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
    return DIRECTIONS[index] ?? "norte";
}

export interface Gear {
    saddle: string | null;
    head: string | null;
    torso: string | null;
    shoe: string | null;
}

/** A row of a horse's alforjes, as a container's `setInventory` takes it back: the class, how many, and what is special about the unit. */
export interface BagRow {
    id?: string;
    item: string;
    amount: number;
    metadata?: Record<string, unknown>;
}

/** The most rows a horse's alforjes keep (the game's container takes 128). */
export const MAX_BAG_ROWS = 96;

export interface SavedHorse {
    key: string;
    owner: string;
    ownerName: string;
    soul: string;
    name: string;
    gear: Gear;
    x: number;
    y: number;
    z: number;
    yaw: number;
    savedAt: number;
    /** What its alforjes hold, when it has any. */
    bags?: BagRow[];
    /** Left free by its owner (user, 2026-10-17): anybody may mount it. Otherwise only the owner (and an administrator) does. */
    shared?: boolean;
}

const records = new Map<string, SavedHorse>();
const liveByKey = new Map<string, number>();
const keyByLive = new Map<number, string>();
let stopping = false;
let counter = 0;
let lastWritten = "";

function link(key: string, horseId: number): void {
    liveByKey.set(key, horseId);
    keyByLive.set(horseId, key);
}

function unlink(key: string): void {
    const id = liveByKey.get(key);
    if (id !== undefined) {
        keyByLive.delete(id);
    }
    liveByKey.delete(key);
}

function newKey(): string {
    counter += 1;
    return `h${Date.now().toString(36)}${counter.toString(36)}`;
}

function gearOf(horse: Horse): Gear {
    const gear = horse.gear;
    return { saddle: gear.saddle, head: gear.head, torso: gear.torso, shoe: gear.shoe };
}

function snapshot(horse: Horse, record: SavedHorse): void {
    const position = horse.position;
    record.x = position.x;
    record.y = position.y;
    record.z = position.z;
    record.yaw = yawOf(horse.rotation);
    record.name = horse.name;
    record.gear = gearOf(horse);
    record.savedAt = Date.now();
}

function persist(): void {
    const body = { v: 1, horses: [...records.values()] };
    const text = JSON.stringify(body.horses.map(({ savedAt: _savedAt, ...rest }) => rest));
    if (text === lastWritten) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, body);
        lastWritten = text;
    } catch (error: unknown) {
        console.log(`horses: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function isRecord(value: unknown): value is SavedHorse {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const r = value as Partial<SavedHorse>;
    return (
        typeof r.key === "string" &&
        typeof r.owner === "string" &&
        typeof r.soul === "string" &&
        typeof r.name === "string" &&
        [r.x, r.y, r.z, r.yaw].every((n) => typeof n === "number" && Number.isFinite(n)) &&
        typeof r.gear === "object" &&
        r.gear !== null
    );
}

function load(): void {
    const loaded = read<{ horses?: unknown[] }>(FILE);
    if (loaded.status === "corrupt") {
        console.error(`horses: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
        return;
    }
    if (loaded.status !== "ok" || !Array.isArray(loaded.value.horses)) {
        return;
    }
    for (const raw of loaded.value.horses) {
        if (isRecord(raw)) {
            const gear = raw.gear as Partial<Gear>;
            records.set(raw.key, {
                ...raw,
                ownerName: typeof raw.ownerName === "string" ? raw.ownerName : "",
                gear: { saddle: gear.saddle ?? null, head: gear.head ?? null, torso: gear.torso ?? null, shoe: gear.shoe ?? null },
                savedAt: typeof raw.savedAt === "number" ? raw.savedAt : 0,
                ...(cleanBags(raw.bags).length > 0 ? { bags: cleanBags(raw.bags) } : {}),
            });
        }
    }
    lastWritten = JSON.stringify([...records.values()].map(({ savedAt: _savedAt, ...rest }) => rest));
}

/** The rows of a stored or reported bag that can be kept: a class, a whole positive amount, and metadata that is an object. */
export function cleanBags(raw: unknown): BagRow[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const rows: BagRow[] = [];
    for (const entry of raw) {
        if (rows.length >= MAX_BAG_ROWS) {
            break;
        }
        if (typeof entry !== "object" || entry === null) {
            continue;
        }
        const row = entry as Partial<BagRow>;
        if (typeof row.item !== "string" || row.item === "" || typeof row.amount !== "number" || !Number.isInteger(row.amount) || row.amount <= 0) {
            continue;
        }
        rows.push({
            ...(typeof row.id === "string" && /^[A-Za-z0-9_:.-]{1,64}$/.test(row.id) ? { id: row.id } : {}),
            item: row.item,
            amount: row.amount,
            ...(typeof row.metadata === "object" && row.metadata !== null && !Array.isArray(row.metadata) ? { metadata: row.metadata } : {}),
        });
    }
    return rows;
}

function spawnSaved(record: SavedHorse): void {
    const gear: Partial<Gear> = {};
    for (const slot of ["saddle", "head", "torso", "shoe"] as const) {
        if (record.gear[slot] !== null) {
            gear[slot] = record.gear[slot];
        }
    }
    try {
        const horse = Horse.spawn({ x: record.x, y: record.y, z: record.z }, new Vector3(0, 0, record.yaw), record.soul, record.name, gear);
        horse.destroyWithOwner = false;
        link(record.key, horse.id);
    } catch (error: unknown) {
        console.error(`horses: não consegui trazer de volta o cavalo ${record.key} de ${record.ownerName}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Files a horse that has just become a player's. */
function track(horse: Horse, owner: Player): SavedHorse {
    const record: SavedHorse = {
        key: newKey(),
        owner: owner.steamId,
        ownerName: owner.nickname,
        soul: horse.soul,
        name: horse.name,
        gear: gearOf(horse),
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        savedAt: 0,
    };
    snapshot(horse, record);
    records.set(record.key, record);
    link(record.key, horse.id);
    return record;
}

function forget(key: string): void {
    records.delete(key);
    unlink(key);
}

// ---------------------------------------------------------------------------------------------
// What `/cavalo` asks.

export interface OwnedHorse {
    readonly record: SavedHorse;
    readonly horse: Horse | null;
}

export function horsesOf(steamId: string): OwnedHorse[] {
    return [...records.values()]
        .filter((record) => record.owner === steamId)
        .map((record) => {
            const id = liveByKey.get(record.key);
            return { record, horse: id === undefined ? null : Horse.getById(id) };
        });
}

export function allHorses(): OwnedHorse[] {
    return [...records.values()].map((record) => {
        const id = liveByKey.get(record.key);
        return { record, horse: id === undefined ? null : Horse.getById(id) };
    });
}

/** What a horse's alforjes hold. */
export function bagsOf(key: string): BagRow[] {
    return [...(records.get(key)?.bags ?? [])];
}

/** Keeps what a horse's alforjes hold. False for a horse that is not kept. */
export function saveBags(key: string, rows: unknown): boolean {
    const record = records.get(key);
    if (record === undefined) {
        return false;
    }
    const clean = cleanBags(rows);
    if (clean.length > 0) {
        record.bags = clean;
    } else {
        delete record.bags;
    }
    persist();
    return true;
}

/** The record of a kept horse, or null. */
export function recordOf(key: string): SavedHorse | null {
    return records.get(key) ?? null;
}

/** Called with a horse's record just before a dead horse is forgotten: its alforjes are the place to give back what was in them. */
export const horseLost: Array<(record: SavedHorse, horse: Horse) => void> = [];

/** Lets a horse go: it stays in the world, but it is nobody's any more and is not kept. */
export function release(key: string): boolean {
    if (!records.has(key)) {
        return false;
    }
    const id = liveByKey.get(key);
    forget(key);
    const horse = id === undefined ? null : Horse.getById(id);
    if (horse !== null) {
        try {
            horse.giveTo(null);
        } catch {
            // Already nobody's.
        }
    }
    persist();
    return true;
}

/** Leaves a horse of `steamId`'s free for anybody to mount, or takes it back so that only they do. */
export function setHorseShared(steamId: string, key: string, shared: boolean): Outcome {
    const record = records.get(key);
    if (record === undefined || record.owner !== steamId) {
        return { ok: false, message: "Esse cavalo não é seu." };
    }
    if (shared) {
        record.shared = true;
    } else {
        delete record.shared;
    }
    persist();
    const label = record.name !== "" ? record.name : "O cavalo";
    return { ok: true, message: shared ? `${label} está livre: qualquer jogador pode montar nele.` : `${label} está trancado: só você monta nele.` };
}

/** Names a horse of `steamId`'s, on the horse and in its record. An empty name gives it back the one its breed has. */
export function renameHorse(steamId: string, key: string, raw: unknown): Outcome {
    const record = records.get(key);
    if (record === undefined || record.owner !== steamId) {
        return { ok: false, message: "Esse cavalo não é seu." };
    }
    if (typeof raw !== "string") {
        return { ok: false, message: "Isso não é um nome." };
    }
    const name = raw
        .normalize("NFC")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (name !== "" && (name.length < HORSE_NAME_MIN || name.length > HORSE_NAME_MAX)) {
        return { ok: false, message: `O nome do cavalo precisa ter entre ${HORSE_NAME_MIN} e ${HORSE_NAME_MAX} letras.` };
    }
    const id = liveByKey.get(key);
    const horse = id === undefined ? null : Horse.getById(id);
    if (horse !== null) {
        horse.name = name;
    }
    record.name = name;
    persist();
    return { ok: true, message: name === "" ? "Seu cavalo voltou a usar o nome de antes." : `Seu cavalo agora se chama ${name}.` };
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

/** What the navigation mesh offers between two points, for the log: a route of two corners is a straight line. */
export function describeRoute(from: Vector3, to: Vector3): string {
    if (!Navigation.ready) {
        return "sem malha de navegação";
    }
    const path = Navigation.findPath(from, to);
    if (path === null) {
        return "uma das pontas fora da malha";
    }
    return `rota de ${path.points.length} cantos, ${Math.round(path.length)} m${path.complete ? "" : ", incompleta"}`;
}

/** The horse `key` of the player's -- or, with null, the nearest of them -- comes running, when it is near enough to hear. */
export function callHorse(player: Player, key: string | null): Outcome {
    const candidates = horsesOf(player.steamId)
        .filter((owned) => (key === null || owned.record.key === key) && owned.horse !== null && owned.horse.alive && !owned.horse.mounted)
        .map((owned) => ({ owned, horse: owned.horse!, distance: Math.hypot(owned.horse!.position.x - player.position.x, owned.horse!.position.y - player.position.y) }))
        .sort((a, b) => a.distance - b.distance);
    const nearest = candidates[0];
    if (nearest === undefined) {
        return { ok: false, message: key === null ? "Nenhum cavalo seu pode vir agora (nenhum, morto, ou alguém está montado)." : "Esse cavalo não pode vir agora: morto, fora do mundo, ou alguém está montado." };
    }
    const label = nearest.owned.record.name || "Seu cavalo";
    if (nearest.distance > CALL_RANGE_M) {
        return { ok: false, message: `${label} está longe demais para ouvir (${nearest.distance.toFixed(0)} m, a ${compassDirection(player.position, nearest.horse.position)}). Vá até ele.` };
    }
    const route = describeRoute(nearest.horse.position, player.position);
    if (!nearest.horse.moveTo(player.position, { speed: "run", radius: 3 })) {
        console.log(`horses: ${label} de ${player.nickname} não saiu (${nearest.distance.toFixed(0)} m; ${route})`);
        return { ok: false, message: `${label} não achou caminho até você daqui.` };
    }
    calls.set(nearest.horse.id, { playerId: player.id, label, at: Date.now(), replans: 0 });
    console.log(`horses: ${player.nickname} chamou ${label} a ${nearest.distance.toFixed(0)} m; ${route}`);
    return { ok: true, message: `${label} vem correndo (${nearest.distance.toFixed(0)} m).` };
}

/** How a call's route ended; a horse stuck on the way is sent on again from where it stands, a moment later. */
export function callEnded(horse: Horse, status: string, later: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms)): void {
    const call = calls.get(horse.id);
    if (call === undefined) {
        return;
    }
    const seconds = Math.round((Date.now() - call.at) / 1000);
    if (status !== "blocked" && status !== "failed") {
        calls.delete(horse.id);
        console.log(`horses: ${call.label} terminou o chamado (${status}) em ${seconds} s`);
        return;
    }
    const player = Player.getById(call.playerId);
    if (player === null || !horse.alive || horse.mounted || call.replans >= CALL_REPLANS) {
        calls.delete(horse.id);
        console.log(`horses: ${call.label} ficou preso a caminho (${status}) depois de ${seconds} s e ${call.replans} rota(s) nova(s)`);
        if (player !== null && horse.alive && !horse.mounted) {
            tell(player, `${call.label} ficou preso no caminho, a ${compassDirection(player.position, horse.position)}. Vá até ele.`);
        }
        return;
    }
    call.replans += 1;
    console.log(`horses: ${call.label} parou a caminho (${status}) em ${seconds} s; rota nova ${call.replans} de ${CALL_REPLANS}: ${describeRoute(horse.position, player.position)}`);
    later(() => {
        const owner = Player.getById(call.playerId);
        if (calls.get(horse.id) !== call || owner === null || !horse.alive || horse.mounted) {
            return;
        }
        if (!horse.moveTo(owner.position, { speed: "run", radius: 3 })) {
            calls.delete(horse.id);
            console.log(`horses: ${call.label} não achou rota nova`);
        }
    }, REPLAN_AFTER_MS);
}

/**
 * X, the game's whistle: the owner's nearest horse comes, as from the panel. A player riding one of their horses, or
 * with none, hears nothing back -- the whistle is only the game's then.
 */
export function whistle(player: Player, now = Date.now()): void {
    if (now - (lastWhistle.get(player.id) ?? -Infinity) < WHISTLE_EVERY_MS) {
        return;
    }
    lastWhistle.set(player.id, now);
    const owned = horsesOf(player.steamId);
    if (owned.length === 0 || owned.some(({ horse }) => horse !== null && horse.riderId === player.id)) {
        return;
    }
    const outcome = callHorse(player, null);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text: outcome.message }));
}

// ---------------------------------------------------------------------------------------------

/** Puts every saved horse back, ownerless until its owner comes in. */
export function restoreHorses(): number {
    let restored = 0;
    for (const record of records.values()) {
        spawnSaved(record);
        if (liveByKey.has(record.key)) {
            restored += 1;
        }
    }
    return restored;
}

function tick(): void {
    // A horse that became somebody's without the event reaching here (revived after it died, say) is filed now.
    for (const horse of Horse.all()) {
        const owner = horse.owner;
        if (!keyByLive.has(horse.id) && owner !== null && STEAM_ID.test(owner.steamId) && horse.alive) {
            horse.destroyWithOwner = false;
            track(horse, owner);
        }
    }
    for (const [key, id] of liveByKey) {
        const horse = Horse.getById(id);
        const record = records.get(key);
        if (horse !== null && record !== undefined && horse.alive) {
            snapshot(horse, record);
        }
    }
    persist();
}

export function installHorses(): void {
    load();
    const restored = restoreHorses();

    Events.on("horseOwnerChanged", (horse, player) => {
        // The owner leaving fires this with null: the horse waits for them, and its record stays.
        if (player === null || stopping || !STEAM_ID.test(player.steamId)) {
            return;
        }
        horse.destroyWithOwner = false;
        const key = keyByLive.get(horse.id);
        const record = key === undefined ? undefined : records.get(key);
        if (record === undefined) {
            track(horse, player);
            console.log(`horses: ${player.nickname} tem um cavalo novo (${horse.name || horse.soul})`);
        } else if (record.owner !== player.steamId) {
            console.log(`horses: o cavalo ${record.name || record.key} passou de ${record.ownerName} para ${player.nickname}`);
            record.owner = player.steamId;
            record.ownerName = player.nickname;
            snapshot(horse, record);
        }
        persist();
    });

    // An owner who comes back takes their horses back, wherever they waited.
    Events.on("playerSpawned", (player) => {
        for (const { record, horse } of horsesOf(player.steamId)) {
            if (horse === null || horse.ownerId === player.id) {
                continue;
            }
            try {
                horse.giveTo(player);
                record.ownerName = player.nickname;
            } catch (error: unknown) {
                console.log(`horses: não consegui devolver o cavalo a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });

    Events.on("horseMounting", (horse, rider) => {
        const key = keyByLive.get(horse.id);
        const record = key === undefined ? undefined : records.get(key);
        if (record === undefined || record.owner === rider.steamId || record.shared === true || isAdmin(rider)) {
            return undefined;
        }
        Chat.sendToPlayer(rider, `Esse cavalo pertence a ${record.ownerName || "outra pessoa"}.`);
        return false;
    });

    const remember = (horse: Horse): void => {
        const key = keyByLive.get(horse.id);
        const record = key === undefined ? undefined : records.get(key);
        if (record !== undefined && !stopping) {
            snapshot(horse, record);
            persist();
        }
    };
    Events.on("horseDismount", (horse) => remember(horse));
    Events.on("horseGearChanged", (horse) => remember(horse));

    Events.on("horseDeath", (horse) => {
        const key = keyByLive.get(horse.id);
        const record = key === undefined ? undefined : records.get(key);
        if (record === undefined) {
            return;
        }
        console.log(`horses: o cavalo ${record.name || record.key} de ${record.ownerName} morreu`);
        for (const lost of horseLost) {
            try {
                lost(record, horse);
            } catch (error: unknown) {
                console.log(`horses: não consegui tratar as alforjes de ${record.name || record.key}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        forget(key!);
        persist();
    });

    Events.on("horseDestroy", (horse) => {
        if (stopping) {
            return;
        }
        const key = keyByLive.get(horse.id);
        if (key !== undefined) {
            forget(key);
            persist();
        }
    });

    Events.on("horseIntentDone", (horse, status) => callEnded(horse, status));
    Events.onClient(`${RESOURCE}:horse.whistle`, (sender) => whistle(sender as Player));
    Events.on("playerDisconnect", (player) => lastWhistle.delete(player.id));

    const timer = setInterval(tick, SAVE_EVERY_MS);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        tick();
        stopping = true;
        // Taken away so a restarted resource does not put a second copy of each beside the first.
        for (const id of liveByKey.values()) {
            Horse.getById(id)?.destroy();
        }
    });

    console.log(`horses: ${records.size} cavalo(s) com dono guardado(s); ${restored} de volta ao mundo`);
}
