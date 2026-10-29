/**
 * What dying costs: the pockets fall at the body, in a chest, and the worn gear stays on it.
 *
 * `player.dropInventory` moves the items into a container the server spawns at the body, which anyone may open through the
 * game's own transfer screen. **The one who died may take it all back** (user, 2026-10-18 night: "os jogadores ao morrer não
 * conseguem pegar seus baús durante os 30 min; eles deviam conseguir abrir e pegar os itens de volta"). From 16:12 to that night
 * the owner was refused, after the user's earlier "o que não tiver equipado o jogador deve perder". Whoever reaches the body
 * first may take it too, as in the game.
 *
 * - The drop is marked on its owner's map and compass (a private `Grave` blip, put back at each entry while it lasts).
 * - It lasts 30 minutes, and the owner is told when 5 are left. Whatever is still in it then goes.
 * - It is written to `playerdata/death-drops.json` at every change. A restart used to wipe every drop. Now it puts each back
 *   where it stood, with what was left, and with at least 10 more minutes so the owner can come back in and get there.
 * - Every drop is remembered for 7 days after it ends, in `playerdata/death-drops-past.json`: what fell, who took how much,
 *   and what its owner lost. `/mortes` lists them, and `/mortes devolver` gives the owner back what they lost. Nothing of the
 *   kind was kept before this, so the drops before it cannot be listed.
 */

import { addUnits, addUnitsToStash } from "./inventory-add.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const LIVE_FILE = `${DIR}/death-drops.json`;
const PAST_FILE = `${DIR}/death-drops-past.json`;

/** How long a drop stays in the world before it and what is left in it go. */
export const DROP_LIFETIME_MS = 30 * 60 * 1000;
/** After a restart a drop keeps at least this long: time to come back in and get there. */
export const RESTORE_GRACE_MS = 10 * 60 * 1000;
/** The owner is told when this much is left. */
export const WARN_BEFORE_MS = 5 * 60 * 1000;
/** How long an ended drop is remembered for `/mortes`, and how many at most. */
export const PAST_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const PAST_MAX = 200;
/** How often drops are looked at: expired, about to expire, or gone from the world when they should not be. */
const SWEEP_INTERVAL_MS = 60 * 1000;
/** A return waiting for its owner is given this long after their body is in the world (the game dresses it first). */
export const RETURN_AFTER_SPAWN_MS = 8_000;
/** A container holds at most this many rows. */
const MAX_ROWS = 128;
/** An owner coming into the world this long after the fall is reminded where the drop is. */
const REMIND_AFTER_MS = 60_000;

/** The game's compass and map icon for a drop: a grave. */
const BLIP_TYPE = "Grave";
const BLIP_LABEL = "Seus pertences";

/** What the one who died is told, a moment after they fall. */
export function leftText(place: string): string {
    return `O que não estava vestido ou equipado ficou num baú junto ao seu corpo${place !== "" ? `, ${place}` : ""}. Você tem 30 minutos para voltar e pegar tudo de volta: o baú está marcado no seu mapa e na bússola. Quem passar por lá antes também pode levar.`;
}
export const RECOVERED_TEXT = "Você recuperou os seus pertences.";
export const GONE_TEXT = "O baú com os seus pertences se perdeu.";
export function warnText(place: string): string {
    return `Faltam 5 minutos para o baú com os seus pertences${place !== "" ? `, ${place},` : ""} se perder.`;
}
export function stillThereText(minutes: number, place: string): string {
    return `O baú com os seus pertences continua onde você caiu${place !== "" ? `, ${place}` : ""}, marcado no seu mapa: faltam ${minutes} min.`;
}
export function returnedText(units: number): string {
    return `A administração devolveu o que você perdeu ao cair: ${units} ${units === 1 ? "item" : "itens"}.`;
}

/** One row of a drop, kept as the game gives it back: the class, how many, and every property it carries. */
export interface SavedRow {
    readonly item: string;
    readonly name: string;
    amount: number;
    readonly metadata: Record<string, unknown>;
}

/** Somebody who took from a drop, and how many units. */
export interface Taker {
    readonly steamId: string;
    name: string;
    units: number;
}

/** How a drop ended. */
export type DropEnd = "" | "recuperado" | "saqueado" | "dividido" | "expirou" | "devolvido";

export interface DropRecord {
    /** Its number for `/mortes`, from 1. */
    readonly seq: number;
    /** Steam id of the one who died, and what they were called. */
    readonly owner: string;
    readonly ownerName: string;
    readonly at: number;
    expiresAt: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly world: number;
    /** "em Malešov", "perto de Suchdol", or empty. */
    readonly place: string;
    /** What fell. */
    fell: SavedRow[];
    /** What is in it now. */
    rows: SavedRow[];
    /** What its owner lost: what others took, and what was left in it when it went. */
    lost: SavedRow[];
    /** Units the owner took back. */
    recovered: number;
    takers: Taker[];
    warned: boolean;
    end: DropEnd;
    endedAt: number;
    /** An administrator gave the owner back what they lost (`/mortes devolver`). */
    returnedAt: number;
}

interface LiveFile {
    v: 1;
    seq: number;
    live: DropRecord[];
}

interface PastFile {
    v: 1;
    past: DropRecord[];
    /** Returns waiting for their owner's next entry, by Steam id. */
    returns: Record<string, SavedRow[]>;
}

interface Live {
    record: DropRecord;
    stash: Stash | null;
    blip: Blip | null;
}

const live = new Map<number, Live>();
const byStash = new Map<number, number>();
/** Containers this module is taking away itself: their destruction changes nothing in the records. */
const leaving = new Set<number>();
let seq = 0;
let past: DropRecord[] = [];
let returns: Record<string, SavedRow[]> = {};
let stopping = false;

// ---------------------------------------------------------------------------------------------
// Rows.

function sameKind(a: SavedRow, b: SavedRow): boolean {
    return a.item === b.item && JSON.stringify(a.metadata) === JSON.stringify(b.metadata);
}

/** Adds rows into a list, merging units of the same item with the same properties. */
export function addRows(into: SavedRow[], rows: readonly SavedRow[]): SavedRow[] {
    for (const row of rows) {
        const same = into.find((kept) => sameKind(kept, row));
        if (same !== undefined) {
            same.amount += row.amount;
        } else {
            into.push({ item: row.item, name: row.name, amount: row.amount, metadata: { ...row.metadata } });
        }
    }
    return into;
}

export function units(rows: readonly SavedRow[]): number {
    return rows.reduce((sum, row) => sum + row.amount, 0);
}

function rowsOf(stash: Stash): SavedRow[] | null {
    let inventory: ReturnType<Stash["getInventory"]>;
    try {
        inventory = stash.getInventory();
    } catch {
        return null;
    }
    if (inventory === null) {
        return null;
    }
    return inventory.items
        .filter((row) => row.amount > 0)
        .map((row) => ({ item: row.item, name: row.name, amount: row.amount, metadata: { ...(row.metadata ?? {}) } }));
}

/** The units a change took out of the container's rows. */
function takenOut(change: InventoryChange | undefined): SavedRow[] {
    const out: SavedRow[] = [];
    for (const entry of change?.items ?? []) {
        const before = entry.before;
        if (before === null) {
            continue;
        }
        const taken = before.amount - (entry.after?.amount ?? 0);
        if (taken > 0) {
            addRows(out, [{ item: before.item, name: before.name, amount: taken, metadata: { ...(before.metadata ?? {}) } }]);
        }
    }
    return out;
}

/** "3 Pão, 1 Espada longa, ..." for the log. */
export function describeRows(rows: readonly SavedRow[], max = 25): string {
    const parts = rows.slice(0, max).map((row) => `${row.amount} ${row.name || row.item}`);
    return rows.length > max ? `${parts.join(", ")} e mais ${rows.length - max}` : parts.join(", ");
}

// ---------------------------------------------------------------------------------------------
// Where.

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The map's English names of the server's towns, as the players know them. */
const PLACE_NAMES: Record<string, string> = { maleshov: "Malešov", malesov: "Malešov", vysoka: "Wysoka", wysoka: "Wysoka", ratbor: "Raborsch", raborsch: "Raborsch" };

interface Spot {
    readonly name: string;
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
}

let spots: Spot[] | null = null;

/** The places the level's map names, each with the box around its areas (read once: the level does not change). */
function mapSpots(): Spot[] {
    if (spots !== null) {
        return spots;
    }
    const found = new Map<string, { name: string; minX: number; maxX: number; minY: number; maxY: number }>();
    try {
        for (const area of Area.all("level")) {
            if (typeof area.location !== "string" || area.location === "") {
                continue;
            }
            const key = fold(area.location);
            const { min, max } = area.bounds;
            const entry = found.get(key);
            if (entry === undefined) {
                found.set(key, { name: PLACE_NAMES[key] ?? area.location, minX: min.x, maxX: max.x, minY: min.y, maxY: max.y });
            } else {
                entry.minX = Math.min(entry.minX, min.x);
                entry.maxX = Math.max(entry.maxX, max.x);
                entry.minY = Math.min(entry.minY, min.y);
                entry.maxY = Math.max(entry.maxY, max.y);
            }
        }
    } catch {
        // No map names: the drop is told without a place.
    }
    spots = [...found.values()];
    return spots;
}

/** How far around a place's own areas a point still counts as in it, and how far a place is still "near". */
const IN_PLACE_M = 40;
const NEAR_PLACE_M = 1500;

/** "em Malešov", "perto de Suchdol", or empty when the map names nothing near. */
export function placeNear(position: { readonly x: number; readonly y: number }): string {
    let best: { name: string; distance: number } | null = null;
    for (const spot of mapSpots()) {
        const dx = Math.max(spot.minX - position.x, 0, position.x - spot.maxX);
        const dy = Math.max(spot.minY - position.y, 0, position.y - spot.maxY);
        const distance = Math.hypot(dx, dy);
        if (best === null || distance < best.distance) {
            best = { name: spot.name, distance };
        }
    }
    if (best === null || best.distance > NEAR_PLACE_M) {
        return "";
    }
    return best.distance <= IN_PLACE_M ? `em ${best.name}` : `perto de ${best.name}`;
}

// ---------------------------------------------------------------------------------------------
// Saving.

function load(): void {
    const saved = read<LiveFile>(LIVE_FILE);
    if (saved.status === "ok" && saved.value !== null && typeof saved.value === "object") {
        seq = Number.isFinite(saved.value.seq) ? saved.value.seq : 0;
        for (const record of Array.isArray(saved.value.live) ? saved.value.live : []) {
            live.set(record.seq, { record, stash: null, blip: null });
            seq = Math.max(seq, record.seq);
        }
    } else if (saved.status === "corrupt") {
        console.log(`death-drops: ${LIVE_FILE} não pôde ser lido (${saved.reason}); começando sem baús de morte guardados`);
    }
    const old = read<PastFile>(PAST_FILE);
    if (old.status === "ok" && old.value !== null && typeof old.value === "object") {
        past = Array.isArray(old.value.past) ? old.value.past : [];
        returns = old.value.returns !== null && typeof old.value.returns === "object" ? old.value.returns : {};
        for (const record of past) {
            seq = Math.max(seq, record.seq);
        }
    }
}

function persistLive(): void {
    try {
        ensureDir(DIR);
        write(LIVE_FILE, { v: 1, seq, live: [...live.values()].map((link) => link.record) } satisfies LiveFile);
    } catch (error: unknown) {
        console.log(`death-drops: não consegui gravar ${LIVE_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function persistPast(): void {
    try {
        ensureDir(DIR);
        write(PAST_FILE, { v: 1, past, returns } satisfies PastFile);
    } catch (error: unknown) {
        console.log(`death-drops: não consegui gravar ${PAST_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function prunePast(now: number): void {
    past = past.filter((record) => now - (record.endedAt || record.at) <= PAST_KEEP_MS).slice(0, PAST_MAX);
}

// ---------------------------------------------------------------------------------------------
// The world.

function ownerHere(record: DropRecord): Player | null {
    if (record.owner === "") {
        return null;
    }
    return Player.all().find((player) => player.steamId === record.owner) ?? null;
}

function tell(player: Player, text: string): void {
    try {
        Chat.sendToPlayer(player, text);
        player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
    } catch {
        // Gone meanwhile.
    }
}

function unmark(link: Live): void {
    try {
        link.blip?.remove();
    } catch {
        // Already gone with its player.
    }
    link.blip = null;
}

/** Puts the drop on its owner's map and compass, for them alone. */
function mark(link: Live, owner: Player): void {
    unmark(link);
    const { x, y, z } = link.record;
    try {
        link.blip = Blip.create({ position: new Vector3(x, y, z), type: BLIP_TYPE, label: BLIP_LABEL, compass: true, map: true, player: owner });
    } catch (error: unknown) {
        console.log(`death-drops: não consegui marcar no mapa o baú de ${link.record.ownerName}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function link(entry: Live, stash: Stash): void {
    entry.stash = stash;
    byStash.set(stash.id, entry.record.seq);
}

/** Takes a container away without its going counting as anything. */
function takeAway(stash: Stash): void {
    leaving.add(stash.id);
    byStash.delete(stash.id);
    setTimeout(() => {
        try {
            stash.destroy();
        } catch {
            // Already gone.
        }
        leaving.delete(stash.id);
    }, 0);
}

/** Puts a saved drop back into the world, with what was left in it. False when the container could not be made. */
function respawn(entry: Live): boolean {
    const record = entry.record;
    let stash: Stash;
    try {
        stash = Stash.spawn(new Vector3(record.x, record.y, record.z), undefined, record.world);
    } catch (error: unknown) {
        console.log(`death-drops: não consegui pôr de volta o baú #${record.seq} de ${record.ownerName}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
    link(entry, stash);
    const rows = record.rows.slice(0, MAX_ROWS);
    const whole = stash.setInventory({ items: rows.map((row) => ({ item: row.item, amount: row.amount, metadata: row.metadata })) });
    if (!whole.ok) {
        // One at a time, so one refused row does not keep the rest out; what the game refuses is counted as lost.
        const refused: SavedRow[] = [];
        for (const row of rows) {
            if (!addUnitsToStash(stash, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
                refused.push(row);
            }
        }
        if (refused.length > 0) {
            addRows(record.lost, refused);
            console.log(`death-drops: o baú #${record.seq} de ${record.ownerName} voltou sem ${describeRows(refused)} (o jogo recusou; /mortes devolver ${record.seq} entrega)`);
        }
        record.rows = rowsOf(stash) ?? [];
    }
    return true;
}

// ---------------------------------------------------------------------------------------------
// A drop's life.

function begin(player: Player, stash: Stash, now: number): Live {
    const position = stash.position ?? player.position;
    const rows = rowsOf(stash) ?? [];
    seq += 1;
    const record: DropRecord = {
        seq,
        owner: player.steamId,
        ownerName: player.nickname,
        at: now,
        expiresAt: now + DROP_LIFETIME_MS,
        x: position.x,
        y: position.y,
        z: position.z,
        world: stash.virtualWorld ?? player.virtualWorld,
        place: placeNear(position),
        fell: rows.map((row) => ({ ...row, metadata: { ...row.metadata } })),
        rows,
        lost: [],
        recovered: 0,
        takers: [],
        warned: false,
        end: "",
        endedAt: 0,
        returnedAt: 0,
    };
    const entry: Live = { record, stash: null, blip: null };
    live.set(record.seq, entry);
    link(entry, stash);
    return entry;
}

/** A drop is over: it leaves the world and the list of live ones, and is remembered. */
function finish(entry: Live, how: DropEnd, now: number): void {
    const record = entry.record;
    if (how === "expirou") {
        addRows(record.lost, record.rows);
    }
    record.rows = [];
    record.end = how;
    record.endedAt = now;
    unmark(entry);
    if (entry.stash !== null) {
        takeAway(entry.stash);
        entry.stash = null;
    }
    live.delete(record.seq);
    past.unshift(record);
    prunePast(now);
    persistLive();
    persistPast();
}

/** How an emptied drop ended, by who took from it. */
function endOfEmptied(record: DropRecord): DropEnd {
    const others = record.takers.some((taker) => taker.steamId !== record.owner);
    if (record.recovered > 0 && others) {
        return "dividido";
    }
    return others ? "saqueado" : "recuperado";
}

function changed(stash: Stash, player: Player | null, change: InventoryChange | undefined): void {
    const key = byStash.get(stash.id);
    const entry = key === undefined ? undefined : live.get(key);
    if (entry === undefined || stopping || leaving.has(stash.id) || change?.reason === "destroy") {
        return;
    }
    const record = entry.record;
    const rows = rowsOf(stash);
    if (rows === null) {
        return;
    }
    record.rows = rows;
    if (record.fell.length === 0 && player === null) {
        // The pockets landing in it.
        record.fell = rows.map((row) => ({ ...row, metadata: { ...row.metadata } }));
    }
    const taken = player !== null ? takenOut(change) : [];
    const count = units(taken);
    if (player !== null && count > 0) {
        const theirs = player.steamId !== "" && player.steamId === record.owner;
        if (theirs) {
            record.recovered += count;
        } else {
            addRows(record.lost, taken);
        }
        const taker = record.takers.find((known) => known.steamId === player.steamId);
        if (taker !== undefined) {
            taker.units += count;
            taker.name = player.nickname;
        } else {
            record.takers.push({ steamId: player.steamId, name: player.nickname, units: count });
        }
        console.log(theirs ? `death-drops: ${player.nickname} pegou de volta ${count} item(ns) do próprio baú #${record.seq}` : `death-drops: ${player.nickname} levou do baú #${record.seq} de ${record.ownerName}: ${describeRows(taken)}`);
    }
    if (player !== null && rows.length === 0) {
        const how = endOfEmptied(record);
        console.log(`death-drops: o baú #${record.seq} de ${record.ownerName} ficou vazio (${how})`);
        if (how === "recuperado" && player.steamId === record.owner) {
            tell(player, RECOVERED_TEXT);
        }
        finish(entry, how, Date.now());
        return;
    }
    persistLive();
}

function sweep(now: number): void {
    for (const entry of [...live.values()]) {
        const record = entry.record;
        if (now >= record.expiresAt) {
            console.log(`death-drops: o baú #${record.seq} de ${record.ownerName} acabou o tempo com ${units(record.rows)} item(ns) dentro${record.rows.length > 0 ? `: ${describeRows(record.rows)}` : ""}`);
            const owner = ownerHere(record);
            if (owner !== null && record.rows.length > 0) {
                tell(owner, GONE_TEXT);
            }
            finish(entry, "expirou", now);
            continue;
        }
        if (!record.warned && record.expiresAt - now <= WARN_BEFORE_MS && record.rows.length > 0) {
            const owner = ownerHere(record);
            if (owner !== null) {
                record.warned = true;
                tell(owner, warnText(record.place));
                persistLive();
            }
        }
        if (entry.stash === null && respawn(entry)) {
            console.log(`death-drops: o baú #${record.seq} de ${record.ownerName} tinha saído do mundo e voltou`);
            const owner = ownerHere(record);
            if (owner !== null) {
                mark(entry, owner);
            }
        }
    }
}

/** Gives rows to a player, each with its properties. Returns what could not be given. */
function give(player: Player, rows: readonly SavedRow[]): SavedRow[] {
    const refused: SavedRow[] = [];
    for (const row of rows) {
        let ok = false;
        try {
            ok = addUnits(player, { item: row.item, amount: row.amount, metadata: row.metadata, notify: false }).ok;
        } catch {
            ok = false;
        }
        if (!ok) {
            refused.push(row);
        }
    }
    return refused;
}

// ---------------------------------------------------------------------------------------------
// For `/mortes`.

export interface DropView {
    readonly record: DropRecord;
    readonly live: boolean;
}

/** Every drop known, the newest first: those in the world, then the ended ones. */
/**
 * A deleted character's death drops are nobody's any more (2026-10-25): what fell stays for whoever finds it until it goes, the owner's mark
 * on the map goes, and nothing waiting to be given back is given to the next character. How many drops and returns were let go.
 */
export function forgetDropOwner(steamId: string): number {
    if (steamId === "") {
        return 0;
    }
    let count = 0;
    for (const link of live.values()) {
        if (link.record.owner !== steamId) {
            continue;
        }
        (link.record as { owner: string }).owner = "";
        if (link.blip !== null) {
            try {
                link.blip.remove();
            } catch {
                // Gone already.
            }
            link.blip = null;
        }
        count += 1;
    }
    if (count > 0) {
        persistLive();
    }
    if (returns[steamId] !== undefined) {
        delete returns[steamId];
        persistPast();
        count += 1;
    }
    return count;
}

export function drops(): DropView[] {
    const now = [...live.values()].map((entry) => ({ record: entry.record, live: true }));
    const old = past.map((record) => ({ record, live: false }));
    return [...now, ...old].sort((a, b) => b.record.at - a.record.at);
}

export function dropBySeq(number: number): DropView | null {
    return drops().find((view) => view.record.seq === number) ?? null;
}

export interface GiveBackResult {
    readonly ok: boolean;
    readonly message: string;
}

/**
 * Gives the owner of drop `number` back what they lost: what others took and what was left when it went, or, for a drop still
 * in the world, everything in it (the drop goes). Now if they are here, at their next entry otherwise.
 */
export function giveBack(number: number, now = Date.now()): GiveBackResult {
    const view = dropBySeq(number);
    if (view === null) {
        return { ok: false, message: `Não há baú de morte #${number}.` };
    }
    const record = view.record;
    if (record.returnedAt > 0) {
        return { ok: false, message: `O baú #${number} já foi devolvido.` };
    }
    let rows: SavedRow[];
    if (view.live) {
        const entry = live.get(record.seq);
        rows = addRows(addRows([], record.lost), entry?.stash !== null && entry?.stash !== undefined ? (rowsOf(entry.stash) ?? record.rows) : record.rows);
        if (entry !== undefined) {
            // What is in it goes to its owner, not to whoever finds it.
            record.rows = [];
            finish(entry, "devolvido", now);
        }
    } else {
        rows = addRows([], record.lost);
    }
    if (rows.length === 0) {
        return { ok: false, message: `Nada a devolver do baú #${number}: o dono recuperou tudo.` };
    }
    record.returnedAt = now;
    const count = units(rows);
    const owner = ownerHere(record);
    let message: string;
    if (owner !== null) {
        const refused = give(owner, rows);
        const given = count - units(refused);
        if (refused.length > 0) {
            returns[record.owner] = addRows(returns[record.owner] ?? [], refused);
        }
        if (given > 0) {
            tell(owner, returnedText(given));
        }
        message = refused.length === 0 ? `${count} item(ns) devolvido(s) a ${record.ownerName}.` : `${given} item(ns) entregue(s) a ${record.ownerName}; ${units(refused)} não couberam agora e vão na próxima entrada.`;
    } else {
        returns[record.owner] = addRows(returns[record.owner] ?? [], rows);
        message = `${record.ownerName} não está no servidor: ${count} item(ns) serão entregues na próxima entrada.`;
    }
    console.log(`death-drops: devolução do baú #${number} a ${record.ownerName}: ${describeRows(rows)}`);
    persistPast();
    return { ok: true, message };
}

// ---------------------------------------------------------------------------------------------

export function installDeathDrops(): void {
    stopping = false;
    load();
    const now = Date.now();
    let restored = 0;
    for (const entry of [...live.values()]) {
        if (now >= entry.record.expiresAt) {
            finish(entry, "expirou", now);
            continue;
        }
        entry.record.expiresAt = Math.max(entry.record.expiresAt, now + RESTORE_GRACE_MS);
        if (entry.record.warned && entry.record.expiresAt - now > WARN_BEFORE_MS) {
            entry.record.warned = false;
        }
        if (respawn(entry)) {
            restored += 1;
        }
    }
    if (live.size > 0 || restored > 0) {
        persistLive();
    }
    console.log(`death-drops: baús de morte duram ${DROP_LIFETIME_MS / 60_000} min e o dono pode pegar tudo de volta; ${restored} de volta ao mundo depois do reinício, ${past.length} lembrado(s) em ${PAST_FILE}`);

    Events.on("playerDied", (player) => {
        const stash = player.dropInventory({ keepEquipped: true });
        if (!stash) {
            return;
        }
        const entry = begin(player, stash, Date.now());
        const record = entry.record;
        persistLive();
        mark(entry, player);
        tell(player, leftText(record.place));
        console.log(`death-drops: ${player.nickname} caiu${record.place !== "" ? ` ${record.place}` : ""} (${record.x.toFixed(0)}, ${record.y.toFixed(0)}); baú #${record.seq} com ${units(record.rows)} item(ns): ${describeRows(record.rows)}`);
    });

    Events.on("stashInventoryChanged", (stash, player, change) => changed(stash, player, change));

    Events.on("stashDestroy", (stash) => {
        const key = byStash.get(stash.id);
        if (key === undefined || stopping || leaving.has(stash.id)) {
            return;
        }
        // Taken out of the world by something else: the record stays, and the next sweep puts it back.
        byStash.delete(stash.id);
        const entry = live.get(key);
        if (entry !== undefined) {
            entry.stash = null;
        }
    });

    Events.on("playerSpawned", (player) => {
        const steamId = player.steamId;
        if (steamId === "") {
            return;
        }
        for (const entry of live.values()) {
            if (entry.record.owner === steamId) {
                mark(entry, player);
                // Waking from the fall itself needs no reminder: they were just told.
                if (Date.now() - entry.record.at > REMIND_AFTER_MS) {
                    tell(player, stillThereText(Math.max(1, Math.ceil((entry.record.expiresAt - Date.now()) / 60_000)), entry.record.place));
                }
            }
        }
        if (returns[steamId] === undefined) {
            return;
        }
        const id = player.id;
        setTimeout(() => {
            const here = Player.getById(id);
            const waiting = returns[steamId];
            if (here === null || here.steamId !== steamId || waiting === undefined) {
                return;
            }
            const refused = give(here, waiting);
            const given = units(waiting) - units(refused);
            if (refused.length > 0) {
                returns[steamId] = refused;
            } else {
                delete returns[steamId];
            }
            persistPast();
            if (given > 0) {
                tell(here, returnedText(given));
                console.log(`death-drops: ${here.nickname} recebeu a devolução que esperava: ${given} item(ns)`);
            }
        }, RETURN_AFTER_SPAWN_MS);
    });

    Events.on("playerDisconnect", (player) => {
        for (const entry of live.values()) {
            if (entry.record.owner === player.steamId) {
                unmark(entry);
            }
        }
    });

    const sweeper = setInterval(() => sweep(Date.now()), SWEEP_INTERVAL_MS);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(sweeper);
        persistLive();
        stopping = true;
        // Taken away so a restarted resource does not put a second copy beside the first; the file has what was in them.
        for (const entry of live.values()) {
            unmark(entry);
            if (entry.stash !== null) {
                try {
                    entry.stash.destroy();
                } catch {
                    // Already gone with the server.
                }
                entry.stash = null;
            }
        }
        byStash.clear();
    });
}
