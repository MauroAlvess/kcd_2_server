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
 * A horse that dies is forgotten, as in the game -- and so is one that is knocked out (see `watchKnockouts`). `/cavalo` tells an owner where their horse is and calls it to them;
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

/**
 * How far a whistle is told to the other players (user, 2026-10-22: "tem como colocar para os jogadores escutarem o assobio quando um jogador
 * aperta X"): the game's own sound (`v_horse_whistle`) is heard to 20 m, so those a little further than that are told, and each client plays
 * it on the whistler's body (`client/whistle.ts`).
 */
export const WHISTLE_HEARD_M = 30;

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

/**
 * The most rows a horse's alforjes keep: everything the game's container takes (`setInventory`: at most 128 rows). It was 96 until 2026-10-29, and a bag of 97 to 128 rows
 * lost its last rows each time the screen closed.
 */
export const MAX_BAG_ROWS = 128;

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
    /**
     * The one X calls, of an owner who keeps several (user, 2026-10-19: "um jogador pode ter mais de um cavalo e escolher qual vai
     * ficar ativo ao ser chamado no X"). One per owner at most; with none, or when it cannot come, X calls the nearest.
     */
    active?: true;
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
    // One horse X calls per owner: a file that says more keeps the first.
    const activeOwners = new Set<string>();
    for (const record of records.values()) {
        if (record.active !== true) {
            continue;
        }
        if (activeOwners.has(record.owner)) {
            delete record.active;
        } else {
            activeOwners.add(record.owner);
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
    if (Array.isArray(rows) && clean.length < rows.length) {
        console.log(`horses: nas alforjes de ${record.name || record.key} ${rows.length - clean.length} linha(s) de ${rows.length} não puderam ser guardadas (sem classe, quantidade inteira positiva ou além do limite de ${MAX_BAG_ROWS})`);
    }
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

/** A kept horse is lost for good: its alforjes are given back (`horseLost`), its record goes -- and with it the line in the owner's Animais -- and the file is written. */
function lose(key: string, record: SavedHorse, horse: Horse, how: string): void {
    console.log(`horses: o cavalo ${record.name || record.key} de ${record.ownerName} ${how}`);
    for (const lost of horseLost) {
        try {
            lost(record, horse);
        } catch (error: unknown) {
            console.log(`horses: não consegui tratar as alforjes de ${record.name || record.key}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    forget(key);
    persist();
}

/**
 * A horse that is knocked out is a dead one (user, 2026-10-25: "matei o cavalo duas vezes, ele voltou à vida; devia ir embora definitivo e sumir dos meus
 * animais"). The game holds a player's own horse immortal: a blow that would kill it knocks it out instead (`Horse.unconscious`, KCDC 1.7.0), it lies where
 * it fell and gets up by itself some minutes later -- it never died, `horseDeath` never came, nothing here forgot it, and it went on in the owner's Animais.
 * Here the knockout is the death. A kept horse seen knocked out on `KNOCKOUT_LOOKS` looks in a row, `KNOCKOUT_LOOK_MS` apart, is lost the way a dead one is
 * (`lose`), made nobody's -- it is the game's "own horse" that cannot die -- and killed; if the game still keeps it alive `KNOCKOUT_FINISH_MS` later it is
 * taken out of the world, so that it cannot get up. A horse nobody keeps is the game's to deal with.
 */
export const KNOCKOUT_LOOK_MS = 1_000;
export const KNOCKOUT_LOOKS = 2;
export const KNOCKOUT_FINISH_MS = 5_000;

/** The kept horses seen knocked out at the last look, by horse id, and on how many looks in a row. */
let knockedOut = new Map<number, number>();
/** The horses given up for dead whose end is not certain yet: not filed again, whoever owns them for the moment. */
const condemned = new Set<number>();

/**
 * A kept horse dies for real only while its owner is in the game (user, 2026-10-26: "cavalos só podem morrer de verdade se o dono estiver online"; three horses of
 * players who were not there were shot dead in Raborsch, 2026-10-26 10:11-10:16 UTC). Whose horse is whose is the record's `owner` (a Steam id).
 */
export function ownerOnline(owner: string): boolean {
    return owner !== "" && Player.all().some((player) => player.steamId === owner && player.ready);
}

/** How long after a horse's death with its owner away it is brought back (the engine is still finishing the death). */
export const REVIVE_AFTER_MS = 300;

/** A kept horse that died or was knocked out while its owner is away: it is brought back where it lies, at full health, and nothing is forgotten. */
function spareHorse(horse: Horse, record: SavedHorse, how: string): void {
    console.log(`horses: o cavalo ${record.name || record.key} de ${record.ownerName} ${how} com o dono fora do jogo: volta à vida`);
    setTimeout(() => {
        try {
            horse.revive();
        } catch (error: unknown) {
            console.log(`horses: não consegui trazer ${record.name || record.key} de volta: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, REVIVE_AFTER_MS);
}

export function watchKnockouts(): void {
    if (stopping) {
        return;
    }
    const seen = new Map<number, number>();
    for (const [key, id] of [...liveByKey]) {
        const horse = Horse.getById(id);
        if (horse === null || horse.unconscious !== true) {
            continue;
        }
        // Knocked out with the owner away, it gets up by itself, as the game has it: only an owner who is there loses a horse.
        const kept = records.get(key);
        if (kept !== undefined && !ownerOnline(kept.owner)) {
            continue;
        }
        const looks = (knockedOut.get(id) ?? 0) + 1;
        if (looks >= KNOCKOUT_LOOKS) {
            endKnockedOut(key, horse);
        } else {
            seen.set(id, looks);
        }
    }
    knockedOut = seen;
}

function endKnockedOut(key: string, horse: Horse): void {
    const record = records.get(key);
    if (record === undefined) {
        return;
    }
    const id = horse.id;
    const label = horse.name || record.name;
    const owner = Player.all().find((player) => player.steamId === record.owner && player.ready) ?? null;
    condemned.add(id);
    lose(key, record, horse, `ficou desacordado e morre de vez (${record.soul})`);
    try {
        horse.giveTo(null);
    } catch {
        // Nobody's already, or the owner's connection is gone.
    }
    try {
        horse.kill();
    } catch (error: unknown) {
        console.log(`horses: não consegui matar ${label || record.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
    setTimeout(() => {
        condemned.delete(id);
        const left = Horse.getById(id);
        if (left !== null && left.alive) {
            console.log(`horses: o jogo manteve ${label || record.key} vivo; ele foi tirado do mundo`);
            try {
                left.destroy();
            } catch {
                // Gone already.
            }
        }
    }, KNOCKOUT_FINISH_MS);
    if (owner !== null) {
        tell(owner, `${label ? `Seu cavalo ${label}` : "Seu cavalo"} morreu: ele já não está entre os seus animais.`);
    }
}

/**
 * The horses of a deleted character (2026-10-25, user: "ao apagar o personagem deve perder os cavalos, carroças e tudo, até apoiador"): taken out of the world and forgotten, with
 * whatever their alforjes held. Forgotten first, so that their going is not taken for a loss. How many went.
 */
export function forgetHorsesOf(steamId: string): number {
    if (steamId === "") {
        return 0;
    }
    let count = 0;
    for (const record of [...records.values()]) {
        if (record.owner !== steamId) {
            continue;
        }
        const id = liveByKey.get(record.key);
        forget(record.key);
        count += 1;
        if (id !== undefined) {
            try {
                Horse.getById(id)?.destroy();
            } catch {
                // Gone already.
            }
        }
    }
    if (count > 0) {
        persist();
    }
    return count;
}

/** The key a live horse is kept under, or null when it is nobody's. */
export function keyOfHorse(horse: Horse): string | null {
    return keyByLive.get(horse.id) ?? null;
}

/**
 * One kept horse taken away from its owner for good, out of the world and forgotten, with what its alforjes held given back (`horseLost`):
 * a supporter's gift handed over by mistake (2026-10-25, the administrator's "retirar benefícios"). False when it is not that player's.
 */
export function removeHorse(key: string, steamId: string): boolean {
    const record = records.get(key);
    if (steamId === "" || record === undefined || record.owner !== steamId) {
        return false;
    }
    const id = liveByKey.get(key);
    const horse = id === undefined ? null : Horse.getById(id);
    if (horse !== null) {
        lose(key, record, horse, "foi retirado por um administrador");
        try {
            horse.destroy();
        } catch {
            // Gone already.
        }
        return true;
    }
    forget(key);
    persist();
    return true;
}

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

/**
 * Gives a horse of `steamId`'s to another player, who keeps it from then on (user, 2026-10-19: the horse "aparece nos meus
 * animais e lá posso dar a algum jogador"). It goes as it is, with its alforjes; locked to its new owner, and not the one X calls.
 */
export function giveHorseTo(steamId: string, key: string, target: Player): Outcome {
    const record = records.get(key);
    if (steamId === "" || record === undefined || record.owner !== steamId) {
        return { ok: false, message: "Esse cavalo não é seu." };
    }
    if (target.steamId === steamId) {
        return { ok: false, message: "Esse cavalo já é seu." };
    }
    if (!STEAM_ID.test(target.steamId)) {
        return { ok: false, message: `${target.nickname} entrou sem identificação Steam: não há como guardar o cavalo para ele.` };
    }
    const label = record.name !== "" ? record.name : "O cavalo";
    const from = record.ownerName;
    record.owner = target.steamId;
    record.ownerName = target.nickname;
    delete record.active;
    delete record.shared;
    persist();
    const id = liveByKey.get(key);
    const horse = id === undefined ? null : Horse.getById(id);
    if (horse !== null) {
        try {
            horse.giveTo(target);
        } catch {
            // Taken back when the new owner next comes into the world.
        }
    }
    console.log(`horses: ${from} deu o cavalo ${record.name || record.key} a ${target.nickname}`);
    return { ok: true, message: `${label} agora é de ${target.nickname}.` };
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

/** The key of the horse X calls for this owner, or null when they chose none. */
export function activeHorseOf(steamId: string): string | null {
    for (const record of records.values()) {
        if (record.owner === steamId && record.active === true) {
            return record.key;
        }
    }
    return null;
}

/** Makes one of the owner's horses the one X calls; the others are not, any more. */
export function setActiveHorse(steamId: string, key: string): Outcome {
    const record = records.get(key);
    if (record === undefined || record.owner !== steamId || steamId === "") {
        return { ok: false, message: "Esse cavalo não é seu." };
    }
    for (const other of records.values()) {
        if (other.owner === steamId && other.key !== key && other.active === true) {
            delete other.active;
        }
    }
    record.active = true;
    persist();
    return { ok: true, message: `${record.name || "Seu cavalo"} é o cavalo que vem quando você aperta X.` };
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
    // KCDC 1.7.0: a horse the game could not kill is knocked out where it fell; it cannot come until it gets up by itself.
    if (nearest.horse.unconscious === true) {
        return { ok: false, message: `${label} está desacordado e se levanta sozinho em alguns minutos. Vá até ele.` };
    }
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

/** Whether a player may ride a horse: null for one that is not kept here (the game's own rules apply), else yes or no. */
export function mayRide(horse: Horse, rider: Player): boolean | null {
    const key = keyByLive.get(horse.id);
    const record = key === undefined ? undefined : records.get(key);
    if (record === undefined) {
        return null;
    }
    return record.owner === rider.steamId || record.shared === true || isAdmin(rider);
}

/** Tells every other player within `WHISTLE_HEARD_M` of a whistler that they whistled; their clients play the sound on the whistler. */
export function tellWhistle(whistler: Player): void {
    const at = whistler.position;
    for (const other of Player.all()) {
        if (other.id === whistler.id || !other.ready || other.virtualWorld !== whistler.virtualWorld) {
            continue;
        }
        if (Math.hypot(other.position.x - at.x, other.position.y - at.y, other.position.z - at.z) <= WHISTLE_HEARD_M) {
            try {
                other.emit(`${RESOURCE}:whistle.heard`, JSON.stringify({ id: whistler.id }));
            } catch {
                // Gone already.
            }
        }
    }
}

/**
 * X, the game's whistle: the owner's nearest horse comes, as from the panel, and whoever is near hears it. A player riding any horse, in a
 * cart's seat, or with none of their own, hears nothing back -- the whistle is only the game's then.
 */
export function whistle(player: Player, now = Date.now()): void {
    if (now - (lastWhistle.get(player.id) ?? -Infinity) < WHISTLE_EVERY_MS) {
        return;
    }
    lastWhistle.set(player.id, now);
    // On a horse (any), or in a cart's seat, the key is only the game's own (user, 2026-10-18: it "só pode funcionar para descer do cavalo").
    if (player.horse || (typeof Cart !== "undefined" && Cart.all(player.virtualWorld).some((cart) => cart.seatOf(player) !== null))) {
        return;
    }
    // Whoever is near hears it, whether the whistler has a horse to call or not.
    tellWhistle(player);
    const owned = horsesOf(player.steamId);
    if (owned.length === 0 || owned.some(({ horse }) => horse !== null && horse.riderId === player.id)) {
        return;
    }
    // The horse the owner chose for X, while it can come: alive, in the world, nobody on it. Otherwise the nearest, as before.
    const chosen = activeHorseOf(player.steamId);
    const ready = chosen === null ? undefined : owned.find(({ record, horse }) => record.key === chosen && horse !== null && horse.alive && !horse.mounted);
    const outcome = callHorse(player, ready === undefined ? null : chosen);
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
        if (!keyByLive.has(horse.id) && owner !== null && STEAM_ID.test(owner.steamId) && horse.alive && !condemned.has(horse.id)) {
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
        if (player === null || stopping || !STEAM_ID.test(player.steamId) || condemned.has(horse.id)) {
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
        if (mayRide(horse, rider) !== false) {
            return undefined;
        }
        const key = keyByLive.get(horse.id);
        const record = key === undefined ? undefined : records.get(key);
        Chat.sendToPlayer(rider, `Esse cavalo pertence a ${record?.ownerName || "outra pessoa"}.`);
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
        if (key === undefined || record === undefined) {
            return;
        }
        if (!ownerOnline(record.owner)) {
            spareHorse(horse, record, "morreu");
            return;
        }
        lose(key, record, horse, "morreu");
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
    const watcher = setInterval(watchKnockouts, KNOCKOUT_LOOK_MS);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        clearInterval(watcher);
        tick();
        stopping = true;
        // Taken away so a restarted resource does not put a second copy of each beside the first.
        for (const id of liveByKey.values()) {
            Horse.getById(id)?.destroy();
        }
    });

    console.log(`horses: ${records.size} cavalo(s) com dono guardado(s); ${restored} de volta ao mundo`);
}
