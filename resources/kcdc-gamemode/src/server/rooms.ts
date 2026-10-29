/**
 * Rooms: a part of a house or a castle -- some of its doors and some of its chests -- given to somebody without giving the house
 * (user, 2026-10-18: "castelos e casas têm quartos, então uma propriedade deve ter uma sub-propriedade, assim eu posso dar
 * quartos às pessoas ou famílias minhas").
 *
 * The house's owner (or an administrator) makes a room from the panel, picking its doors and chests, and gives it to one player or
 * to several (a family). Whoever holds a room is, for its doors and chests, as good as a key holder: the menu at the door or the
 * chest offers them Abrir, Trancar and Destrancar (`property-menu.ts`), the panel lists the room under their properties with the
 * same buttons (`status.ts`), and taking from one of its chests is no theft. The house stays its owner's, and so does every part of
 * it that is in no room. A door or a chest is in one room at most.
 *
 * Kept in `playerdata/rooms.json`, by the room's id.
 */

import { getProperty } from "./properties.js";
import type { PropertyInfo } from "./properties.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/rooms.json`;

export const ROOM_NAME_MIN = 2;
export const ROOM_NAME_MAX = 40;
/** A family, not a village. */
export const ROOM_HOLDERS_MAX = 8;

export interface RoomHolder {
    readonly steamId: string;
    name: string;
}

export interface Room {
    readonly id: string;
    /** The house or castle it is part of. */
    readonly houseId: string;
    name: string;
    /** Level GUIDs of its doors, every one a door of the house. */
    doors: string[];
    /** Property ids of its chests, every one a chest of the house. */
    chests: string[];
    holders: RoomHolder[];
    readonly createdAt: number;
}

export type RoomResult = { readonly ok: true; readonly message: string; readonly room: Room } | { readonly ok: false; readonly message: string };

let rooms: Record<string, Room> | null = null;

function load(): Record<string, Room> {
    if (rooms !== null) {
        return rooms;
    }
    const result = read<Record<string, Room>>(FILE);
    rooms = {};
    if (result.status === "ok" && typeof result.value === "object" && result.value !== null) {
        for (const [id, room] of Object.entries(result.value)) {
            if (typeof room === "object" && room !== null && typeof room.houseId === "string" && Array.isArray(room.doors) && Array.isArray(room.chests) && Array.isArray(room.holders)) {
                rooms[id] = room;
            }
        }
    }
    return rooms;
}

function persist(): void {
    ensureDir(DIR);
    write(FILE, rooms ?? {});
}

export function roomById(id: string): Room | null {
    return load()[id] ?? null;
}

export function roomsOfHouse(houseId: string): Room[] {
    return Object.values(load())
        .filter((room) => room.houseId === houseId)
        .sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

export function roomsHeldBy(steamId: string): Room[] {
    return steamId === "" ? [] : Object.values(load()).filter((room) => room.holders.some((holder) => holder.steamId === steamId));
}

/** The level GUID of a room's chest, or "" for a chest no longer in the catalog. */
function stashOf(chestId: string): string {
    return getProperty(chestId)?.stashGuid ?? "";
}

/** The room a door or a chest (by its level GUID) is part of, or null. */
export function roomOfPart(guid: string): Room | null {
    if (guid === "") {
        return null;
    }
    return Object.values(load()).find((room) => room.doors.includes(guid) || room.chests.some((chest) => stashOf(chest) === guid)) ?? null;
}

/** Whether this player holds the room the door or chest is part of. */
export function holdsRoomPart(player: Player, guid: string): boolean {
    const room = roomOfPart(guid);
    return room !== null && player.steamId !== "" && room.holders.some((holder) => holder.steamId === player.steamId);
}

function cleanName(raw: unknown): string | null {
    if (typeof raw !== "string") {
        return null;
    }
    const name = raw.replace(/\s+/g, " ").trim();
    return name.length >= ROOM_NAME_MIN && name.length <= ROOM_NAME_MAX ? name : null;
}

function houseOf(houseId: string): PropertyInfo | null {
    const house = getProperty(houseId);
    return house !== null && house.kind !== "chest" && house.parentId === "" ? house : null;
}

/**
 * Makes a room of a house (`roomId` "" for a new one), or changes one: its name, its doors (by their place in the house's list)
 * and its chests (by their property ids). Whoever may is checked by the caller.
 */
export function saveRoom(houseId: string, roomId: string, rawName: unknown, doorIndexes: readonly number[], chestIds: readonly string[], now: number = Date.now()): RoomResult {
    const house = houseOf(houseId);
    if (house === null) {
        return { ok: false, message: "Casa não encontrada." };
    }
    const existing = roomId === "" ? null : roomById(roomId);
    if (roomId !== "" && (existing === null || existing.houseId !== houseId)) {
        return { ok: false, message: "Quarto não encontrado." };
    }
    const name = cleanName(rawName);
    if (name === null) {
        return { ok: false, message: `O nome do quarto precisa ter de ${ROOM_NAME_MIN} a ${ROOM_NAME_MAX} letras.` };
    }
    const others = roomsOfHouse(houseId).filter((room) => room.id !== roomId);
    if (others.some((room) => room.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, message: `${house.name} já tem um quarto chamado ${name}.` };
    }
    const doors: string[] = [];
    for (const index of doorIndexes) {
        const guid = house.doors[index];
        if (!Number.isInteger(index) || guid === undefined) {
            return { ok: false, message: "Essa porta não é da casa." };
        }
        if (others.some((room) => room.doors.includes(guid))) {
            return { ok: false, message: "Uma das portas já é de outro quarto." };
        }
        if (!doors.includes(guid)) {
            doors.push(guid);
        }
    }
    const chests: string[] = [];
    for (const id of chestIds) {
        const chest = getProperty(id);
        if (chest === null || chest.kind !== "chest" || chest.parentId !== houseId) {
            return { ok: false, message: "Esse baú não é da casa." };
        }
        if (others.some((room) => room.chests.includes(id))) {
            return { ok: false, message: "Um dos baús já é de outro quarto." };
        }
        if (!chests.includes(id)) {
            chests.push(id);
        }
    }
    if (doors.length === 0 && chests.length === 0) {
        return { ok: false, message: "Escolha ao menos uma porta ou um baú para o quarto." };
    }
    const store = load();
    let room: Room;
    if (existing !== null) {
        existing.name = name;
        existing.doors = doors;
        existing.chests = chests;
        room = existing;
    } else {
        let id = `${houseId}-quarto-${now.toString(36)}`;
        for (let n = 2; store[id] !== undefined; n += 1) {
            id = `${houseId}-quarto-${now.toString(36)}-${n}`;
        }
        room = { id, houseId, name, doors, chests, holders: [], createdAt: now };
        store[id] = room;
    }
    persist();
    return { ok: true, message: `${existing === null ? "Quarto criado" : "Quarto salvo"}: ${name} (${doors.length} porta(s), ${chests.length} baú(s)).`, room };
}

/** Gives the room to one more player. */
export function giveRoom(roomId: string, steamId: string, name: string): RoomResult {
    const room = roomById(roomId);
    if (room === null) {
        return { ok: false, message: "Quarto não encontrado." };
    }
    if (steamId === "") {
        return { ok: false, message: `${name} não tem identificação Steam, então não pode receber um quarto.` };
    }
    const held = room.holders.find((holder) => holder.steamId === steamId);
    if (held !== undefined) {
        held.name = name;
        persist();
        return { ok: false, message: `${name} já mora em ${room.name}.` };
    }
    if (room.holders.length >= ROOM_HOLDERS_MAX) {
        return { ok: false, message: `${room.name} já tem ${ROOM_HOLDERS_MAX} moradores, o limite.` };
    }
    room.holders.push({ steamId, name });
    persist();
    return { ok: true, message: `${room.name} agora é também de ${name}.`, room };
}

/** Takes the room back from one player, or from all of them (`steamId` ""). */
export function vacateRoom(roomId: string, steamId = ""): RoomResult {
    const room = roomById(roomId);
    if (room === null) {
        return { ok: false, message: "Quarto não encontrado." };
    }
    const before = room.holders.length;
    room.holders = steamId === "" ? [] : room.holders.filter((holder) => holder.steamId !== steamId);
    if (room.holders.length === before) {
        return { ok: false, message: `${room.name} já estava sem esse morador.` };
    }
    persist();
    return { ok: true, message: steamId === "" ? `${room.name} ficou sem moradores.` : `Saiu de ${room.name}.`, room };
}

export function removeRoom(roomId: string): RoomResult {
    const store = load();
    const room = store[roomId];
    if (room === undefined) {
        return { ok: false, message: "Quarto não encontrado." };
    }
    delete store[roomId];
    persist();
    return { ok: true, message: `Quarto ${room.name} apagado: as portas e os baús voltam a ser só da casa.`, room };
}

/** A holder's name as they are called now, kept for the lists. */
export function noteHolderName(steamId: string, name: string): void {
    let changed = false;
    for (const room of roomsHeldBy(steamId)) {
        for (const holder of room.holders) {
            if (holder.steamId === steamId && holder.name !== name) {
                holder.name = name;
                changed = true;
            }
        }
    }
    if (changed) {
        persist();
    }
}
