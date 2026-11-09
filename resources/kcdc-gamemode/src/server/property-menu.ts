/**
 * The doors and chests of the properties, the game's own way (user, 2026-10-19: "ao invés de abrir o menu, o E é apenas abrir, o
 * F destrancar ou trancar (caso tenha a chave ou seja o dono da propriedade); se não for nenhum dos 2 continue E abrir e F vira
 * arrombar (se tiver gazua); assim fica bem mais simples e podemos retirar um código complexo de abrir e fechar; o mesmo vale
 * para baús"). No menu, no copy of a chest, no lock held under a look:
 *
 * - **The lock is the game's** (`properties.ts`, Locks): what was locked on purpose stands locked in the world, the rest as the
 *   level has it.
 * - **E** is the game's own: it opens and closes what is open, and at a locked door or chest the game offers nothing at its
 *   keyhole but its own lockpick (hold E, with a lockpick and the skill). The minigame cannot be started from a script, so
 *   "arrombar" stays on the game's key.
 * - **F**, for whoever holds its key, its owner, a room's holder or an administrator: "Trancar" at a part that is shut and unlocked,
 *   "Destrancar" at one that is locked, from either side (`look`, `toggle`; the client's hint, `property-labels.ts`). A door that
 *   stands OPEN offers no F at all (user, 2026-10-25: "o trancar no F só pode aparecer nas portas fechadas ... aparece nela aberta e
 *   fecha sozinha, está indo contra o básico"): locking it shut it by itself.
 * - **From inside**, a locked door is opened by E as the game offers it there: the framework refuses a hand on a lock a script set,
 *   so this server draws the bolt (`use`), and the owner is told when it was not a key holder. Which side is inside, the level's
 *   areas say where they claim the door; elsewhere what the game said at that door before (`keySide` of each press there,
 *   `playerdata/door-sides.json`), else the game's own "Abrir" up on the client's screen.
 * - A lock this server set that the game reports open was **picked**: it stays open, the picker and the owner are told.
 * - A lock of somebody else's picked is a **theft** (`thieves.ts`, the mark at once); since 2026-11-01 what is taken out of a chest that stood open marks nobody.
 *
 * Nothing the client says is trusted: who may, how near, what is locked are read again at every step.
 */

import { isAdmin } from "./auth.js";
import { sameFamily } from "./family.js";
import { itemLine } from "./item-names.js";
import { displayName, doorName, doorStandsOpen, holdsKeyOf, insideOf, isOwner, lockedNow, lockPicked, npcOf, ownerOf, placeOfGuid, propertyOfGuid, setDoorLocked, setLocked, swingOpen, unlockPart } from "./properties.js";
import type { PropertyInfo } from "./properties.js";
import { holdsRoomPart } from "./rooms.js";
import { ensureDir, read, write } from "./store.js";
import { noteBreakIn } from "./thieves.js";
import { allowedTo, EDGE_M } from "./reach.js";

const RESOURCE = "kcdc-gamemode";

/** How far from a door or chest an E is believed (the game's own reach is about 2 m), and an F, and a look told by the client: the one reach of our prompts to its point, and a metre more (`reach.ts`). */
export const USE_REACH_M = allowedTo(EDGE_M.door);
export const TOGGLE_REACH_M = allowedTo(EDGE_M.door);

/** A player pressing E at a locked part is told so at most this often. */
export const NOTICE_EVERY_MS = 3_000;

/** Who began picking a lock is remembered this long, to be named when it gives. */
export const PICKER_KEEP_MS = 180_000;

export const TICK_MS = 5_000;

/**
 * The sides of a door no level area claims, as the game said them at that door: a press made within `SIDE_SAMPLE_M` of the door
 * counts, the last `SIDE_SAMPLES_KEPT` or so weigh, and a player within `SIDE_MARGIN_M` of the line the door shuts on stands on
 * neither side.
 */
export const SIDE_SAMPLE_M = 3.5;
export const SIDE_SAMPLES_KEPT = 50;
export const SIDE_MARGIN_M = 0.3;
/** The sides learned are written down at most this often. */
const SIDES_SAVE_MS = 10_000;

const DIR = "playerdata";
const SIDES_FILE = `${DIR}/door-sides.json`;

/** What the game said of a door's sides: the directions along the floor from the door to the players who used it, turned toward the keyhole, summed. */
interface Sides {
    x: number;
    y: number;
    n: number;
}

/** What F does at a part for a player: lock it, unlock it, or nothing. */
export type ToggleState = "lock" | "unlock" | "";

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 256) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

const GUID = /^[0-9a-f]{8,32}$/;

function distanceTo(player: Player, place: { x: number; y: number; z: number }): number {
    const here = player.position;
    return Math.hypot(here.x - place.x, here.y - place.y, here.z - place.z);
}

/** What the player reads for this door or chest: "Casa 03", "Casa 03 · Porta 2", "Casa 03 · Baú 1". */
export function partName(property: PropertyInfo, guid: string): string {
    const index = property.doors.indexOf(guid);
    return index >= 0 && property.doors.length > 1 ? `${displayName(property)} · ${doorName(property, index)}` : displayName(property);
}

export class PropertyLocks {
    /** The sides of doors no level area claims, learned from the game's own `keySide`. */
    private readonly sides = new Map<string, Sides>();
    private sidesDirty = false;
    private sidesSavedAt = -Infinity;
    /** What each player's client was last told of the part it looks at (`guid|state`). */
    private readonly told = new Map<number, string>();
    /** When each player was last told a part is locked (`playerId:guid`). */
    private readonly notedAt = new Map<string, number>();
    /** Who began picking each part, and when. */
    private readonly pickers = new Map<string, { readonly playerId: number; readonly name: string; readonly at: number }>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    /**
     * Who may lock and unlock it (user, 2026-10-19: "caso tenha a chave ou seja o dono da propriedade"): whoever holds its key (with a
     * door named, that door's own key counts for it), its owner, whoever the owner gave access to (2026-10-28, `holdsKeyOf` counts it as the key,
     * so such a player is no thief for taking from the chests either), whoever holds a room it is part of, and an administrator.
     */
    hasKey(player: Player, property: PropertyInfo, guid?: string): boolean {
        return isAdmin(player) || isOwner(player, property) || holdsKeyOf(player, property, guid) || holdsRoomPart(player, guid ?? (property.kind === "chest" ? property.stashGuid : ""));
    }

    /**
     * A chest somebody owns -- a player, not a vendor -- and this player has no right to: taking from it is stealing (user,
     * 2026-10-18). A relative's chest is the family's (user, 2026-10-18).
     */
    othersChest(player: Player, property: PropertyInfo): boolean {
        const owner = ownerOf(property);
        return owner !== null && npcOf(property) === null && !this.hasKey(player, property) && !sameFamily(player.steamId, owner.steamId);
    }

    // -----------------------------------------------------------------------------------------
    // F: locking and unlocking.

    /** What F does at this part for this player, standing where they stand. */
    stateFor(player: Player, guid: string): ToggleState {
        const property = propertyOfGuid(guid);
        const place = placeOfGuid(guid);
        if (property === null || place === null || !player.ready || !player.alive || distanceTo(player, place) > TOGGLE_REACH_M) {
            return "";
        }
        if (!this.hasKey(player, property, property.doors.includes(guid) ? guid : undefined)) {
            return "";
        }
        if (lockedNow(guid) === true) {
            return "unlock";
        }
        // A lock is turned on a door that is shut: an open one has nothing to lock yet.
        return property.doors.includes(guid) && doorStandsOpen(guid) ? "" : "lock";
    }

    /** The part a player looks at ("" for none): their client is told what F does there, when that changes. */
    look(player: Player, guid: string): void {
        const state = guid === "" ? "" : this.stateFor(player, guid);
        const said = `${guid}|${state}`;
        if (this.told.get(player.id) === said) {
            return;
        }
        this.told.set(player.id, said);
        player.emit(`${RESOURCE}:props.can`, JSON.stringify({ guid, lock: state }));
    }

    /** F at a part: locked if it is open, unlocked if it is locked. Everything is read again here. */
    toggle(player: Player, guid: string): boolean {
        const property = propertyOfGuid(guid);
        const state = this.stateFor(player, guid);
        if (property === null || state === "") {
            this.told.delete(player.id);
            this.look(player, guid);
            return false;
        }
        const locking = state === "lock";
        this.setPart(property, guid, locking);
        const door = property.doors.includes(guid);
        const name = partName(property, guid);
        tell(player, `${name}: ${locking ? (door ? "trancada" : "trancado") : door ? "destrancada" : "destrancado"}.`);
        console.log(`property-menu: ${player.nickname} ${locking ? "trancou" : "destrancou"} ${name} com F`);
        this.told.delete(player.id);
        this.look(player, guid);
        return true;
    }

    /** Locks or unlocks what was worked: one door of a house with several, else the whole property (a chest, a house of one door). */
    private setPart(property: PropertyInfo, guid: string, locked: boolean): void {
        const index = property.doors.indexOf(guid);
        if (index >= 0 && property.doors.length > 1) {
            setDoorLocked(property.id, index, locked);
        } else {
            setLocked(property.id, locked);
        }
    }

    // -----------------------------------------------------------------------------------------
    // E: the game's own; this only hears it at a locked part.

    /**
     * E was pressed at a property part, by the client's reading (`props.use`); `usePrompt` says whether the game had its own
     * "Abrir"/"Fechar" up. At an open part the game does it all. At a locked door seen from inside -- the areas, what the game said
     * there before, or, where neither says, the game's own "Abrir" on the screen (the game offers it only on that side of a lock) --
     * the bolt is drawn by hand, since the framework refuses a hand on a lock a script set. Elsewhere the player is told it is
     * locked, and that F unlocks it when they may.
     */
    use(player: Player, guid: string, usePrompt: boolean): void {
        const property = propertyOfGuid(guid);
        const place = placeOfGuid(guid);
        if (property === null || place === null || !player.ready || !player.alive || distanceTo(player, place) > USE_REACH_M) {
            return;
        }
        if (lockedNow(guid) !== true) {
            return;
        }
        const door = property.doors.includes(guid);
        const name = partName(property, guid);
        if (door) {
            const side = this.sideOf(player, guid);
            if (property.lockSet !== true && usePrompt && side !== false) {
                // The level's own lock: the game draws the bolt itself from inside.
                return;
            }
            if (property.lockSet === true && (side === true || (side === null && usePrompt))) {
                unlockPart(guid);
                swingOpen(guid);
                tell(player, `Você abriu ${name} por dentro.`);
                console.log(`property-menu: ${player.nickname} abriu ${name} por dentro`);
                if (!this.hasKey(player, property, guid)) {
                    this.warnOwner(property, `Alguém abriu ${name} por dentro.`);
                }
                this.told.delete(player.id);
                return;
            }
        }
        const mark = `${player.id}:${guid}`;
        const now = this.now();
        if (now - (this.notedAt.get(mark) ?? -Infinity) < NOTICE_EVERY_MS) {
            return;
        }
        this.notedAt.set(mark, now);
        const word = door ? "trancada" : "trancado";
        tell(player, this.stateFor(player, guid) === "unlock" ? `${name} está ${word}: aperte F para destrancar.` : `${name} está ${word}.`);
    }

    /** A player works a door of the level: every press says which side the player stood on, and a lockpick is noted. Never refused. */
    door(player: Player, door: Door, action: string, keySide: boolean): undefined {
        const property = propertyOfGuid(door.guid);
        if (property === null) {
            return undefined;
        }
        this.learnSide(player, property, door.guid, keySide);
        if (action === "lockpick") {
            this.picking(player, property, door.guid);
        }
        this.told.delete(player.id);
        return undefined;
    }

    /** A player opens, unlocks or picks a chest of the level: a lockpick is noted. Never refused. */
    chest(player: Player, stash: Stash, action: string): undefined {
        if (action !== "lockpick") {
            return undefined;
        }
        const property = propertyOfGuid(stash.levelGuid);
        if (property !== null) {
            this.picking(player, property, stash.levelGuid);
        }
        return undefined;
    }

    private picking(player: Player, property: PropertyInfo, guid: string): void {
        this.pickers.set(guid, { playerId: player.id, name: player.nickname, at: this.now() });
        this.warnOwner(property, `Alguém está tentando arrombar ${partName(property, guid)}.`);
        console.log(`property-menu: ${player.nickname} começou a arrombar ${partName(property, guid)}`);
    }

    /** The sweep found a part this server locked open in the game: picked. It stays open; the picker is told, and the owner. */
    picked(guid: string): void {
        const property = propertyOfGuid(guid);
        if (property === null) {
            return;
        }
        const name = partName(property, guid);
        const who = this.pickers.get(guid);
        this.pickers.delete(guid);
        const recent = who !== undefined && this.now() - who.at <= PICKER_KEEP_MS ? who : undefined;
        const picker = recent === undefined ? null : Player.getById(recent.playerId);
        if (picker !== null) {
            tell(picker, `Você arrombou ${name}.`);
            // A lock of somebody else's picked: counted, and the thief's mark comes with the third (2026-11-02: "esse título só deve ser dado depois do
            // jogador arrombar 3 coisas"; at once since 2026-11-01, and taking from a chest that stood open marks nobody).
            if (this.othersChest(picker, property)) {
                const owner = ownerOf(property);
                noteBreakIn(picker.steamId, picker.nickname, guid, `${name}${owner ? ` (de ${owner.name})` : ""}`, this.now());
            }
        }
        this.warnOwner(property, `Alguém arrombou ${name}!`);
        console.log(`property-menu: ${recent?.name ?? "alguém"} arrombou ${name}`);
    }

    // -----------------------------------------------------------------------------------------
    // The sides of a door.

    /**
     * Which side of a door the player stands on: inside (true), outside (false), or null when it cannot be said. The level's own
     * areas say it where they claim the door; elsewhere it is what the game itself said at that door before -- the `keySide` of
     * each press there, kept as the direction from the door toward its keyhole.
     */
    sideOf(player: Player, guid: string): boolean | null {
        const within = insideOf(player, guid);
        if (within !== null) {
            return within;
        }
        const learned = this.sides.get(guid);
        const place = placeOfGuid(guid);
        if (learned === undefined || place === null) {
            return null;
        }
        const length = Math.hypot(learned.x, learned.y);
        if (length < 0.5) {
            // What the game said there points both ways: no side.
            return null;
        }
        const along = ((player.position.x - place.x) * learned.x + (player.position.y - place.y) * learned.y) / length;
        return along > SIDE_MARGIN_M ? false : along < -SIDE_MARGIN_M ? true : null;
    }

    /** How many doors no area claims have learned sides. */
    learnedSides(): number {
        return this.sides.size;
    }

    /** A press the game reported at a door no area claims: where the player stood, and the side the game said that was. */
    private learnSide(player: Player, property: PropertyInfo, guid: string, keySide: boolean): void {
        if (typeof keySide !== "boolean" || insideOf(player, guid) !== null) {
            return;
        }
        const place = placeOfGuid(guid);
        if (place === null) {
            return;
        }
        const dx = player.position.x - place.x;
        const dy = player.position.y - place.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.2 || distance > SIDE_SAMPLE_M) {
            return;
        }
        let learned = this.sides.get(guid);
        if (learned === undefined) {
            learned = { x: 0, y: 0, n: 0 };
            this.sides.set(guid, learned);
            console.log(`property-menu: ${partName(property, guid)} não tem área do jogo; o lado dela foi aprendido agora, com ${player.nickname} ${keySide ? "do lado da fechadura" : "do lado do ferrolho"}`);
        }
        if (learned.n >= SIDE_SAMPLES_KEPT) {
            // The older presses weigh half: the door follows what the game says now.
            learned.x /= 2;
            learned.y /= 2;
            learned.n = Math.ceil(learned.n / 2);
        }
        const sign = keySide ? 1 : -1;
        learned.x += (sign * dx) / distance;
        learned.y += (sign * dy) / distance;
        learned.n += 1;
        this.sidesDirty = true;
    }

    loadSides(): void {
        const loaded = read<Record<string, unknown>>(SIDES_FILE);
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        for (const [guid, value] of Object.entries(loaded.value)) {
            const entry = value as Partial<Sides> | null;
            if (GUID.test(guid) && entry !== null && typeof entry === "object" && Number.isFinite(entry.x) && Number.isFinite(entry.y) && Number.isFinite(entry.n)) {
                this.sides.set(guid, { x: Number(entry.x), y: Number(entry.y), n: Math.max(1, Math.floor(Number(entry.n))) });
            }
        }
    }

    /** Writes the sides learned down, when there is something new and not more often than every ten seconds (or now, `force`). */
    saveSides(force = false): void {
        const now = this.now();
        if (!this.sidesDirty || (!force && now - this.sidesSavedAt < SIDES_SAVE_MS)) {
            return;
        }
        this.sidesDirty = false;
        this.sidesSavedAt = now;
        const out: Record<string, Sides> = {};
        for (const [guid, sides] of this.sides) {
            out[guid] = { x: Math.round(sides.x * 1000) / 1000, y: Math.round(sides.y * 1000) / 1000, n: sides.n };
        }
        try {
            ensureDir(DIR);
            write(SIDES_FILE, out);
        } catch (error: unknown) {
            console.log(`property-menu: não consegui guardar os lados das portas: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // -----------------------------------------------------------------------------------------

    /**
     * What a player took out of a chest, written to the log (2026-10-18). Until 2026-11-01 taking from somebody else's chest counted as a theft (more than three
     * chests within the hour marked); now only a picked lock does (`picked`).
     */
    taken(stash: Stash, player: Player | null, change: InventoryChange): void {
        if (player === null) {
            return;
        }
        let guid = "";
        try {
            guid = stash.levelGuid;
        } catch {
            return;
        }
        const property = propertyOfGuid(guid);
        if (property === null) {
            return;
        }
        const lines: string[] = [];
        for (const row of change.items) {
            const before = row.before?.amount ?? 0;
            const after = row.after?.amount ?? 0;
            const item = row.before ?? row.after;
            if (item !== null && before !== after) {
                lines.push(`${before > after ? "tirou" : "pôs"} ${itemLine({ item: item.item, amount: Math.abs(before - after), name: item.name, metadata: item.metadata })}`);
            }
        }
        if (lines.length === 0) {
            return;
        }
        const name = partName(property, guid);
        const owner = ownerOf(property);
        console.log(`baús: ${player.nickname} em ${name}${owner ? ` (de ${owner.name})` : ""}: ${lines.join("; ")}`);
        // What is taken out marks nobody since 2026-11-01 (user: "vamos remover as tags de ladrão e ela só se aplica se o jogador arrombar um baú ou portão"): the lock that was picked does (`picked`).
    }

    private warnOwner(property: PropertyInfo, text: string): void {
        const owner = ownerOf(property);
        const present = owner === null ? undefined : Player.all().find((candidate) => candidate.steamId === owner.steamId);
        if (present !== undefined) {
            tell(present, text);
        }
    }

    tick(): void {
        const now = this.now();
        this.saveSides();
        for (const [mark, at] of this.notedAt) {
            if (now - at > 10 * NOTICE_EVERY_MS) {
                this.notedAt.delete(mark);
            }
        }
        for (const [guid, picker] of this.pickers) {
            if (now - picker.at > PICKER_KEEP_MS) {
                this.pickers.delete(guid);
            }
        }
    }

    /** A player who left or died: what was kept of them goes. */
    left(player: Player): void {
        this.told.delete(player.id);
        for (const mark of [...this.notedAt.keys()]) {
            if (mark.startsWith(`${player.id}:`)) {
                this.notedAt.delete(mark);
            }
        }
    }
}

export const propertyMenus = new PropertyLocks();

export function installPropertyMenu(): void {
    propertyMenus.loadSides();
    Events.on("doorInteract", (player, door, action, keySide) => propertyMenus.door(player, door, action, keySide));
    Events.on("stashInteract", (player, stash, action) => propertyMenus.chest(player, stash, action));
    Events.on("stashInventoryChanged", (stash, player, change) => propertyMenus.taken(stash, player, change));
    lockPicked.push((guid) => propertyMenus.picked(guid));
    // E at a property part, by the client's reading; `use`: the game's own "Abrir"/"Fechar" was on the screen.
    Events.onClient(`${RESOURCE}:props.use`, (sender, payload) => {
        const fields = fieldsOf(payload);
        const guid = fields["guid"];
        if (typeof guid === "string" && GUID.test(guid)) {
            propertyMenus.use(sender as Player, guid, fields["use"] === true);
        }
    });
    // The part the client looks at ("" for none): it is told what F does there.
    Events.onClient(`${RESOURCE}:props.look`, (sender, payload) => {
        const guid = fieldsOf(payload)["guid"];
        if (guid === "" || (typeof guid === "string" && GUID.test(guid))) {
            propertyMenus.look(sender as Player, guid);
        }
    });
    Events.onClient(`${RESOURCE}:props.toggle`, (sender, payload) => {
        const guid = fieldsOf(payload)["guid"];
        if (typeof guid === "string" && GUID.test(guid)) {
            propertyMenus.toggle(sender as Player, guid);
        }
    });
    Events.on("playerDisconnect", (player) => propertyMenus.left(player));
    Events.on("playerDied", (player) => propertyMenus.left(player));
    const timer = setInterval(() => propertyMenus.tick(), TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            propertyMenus.saveSides(true);
        }
    });
    console.log(`property-menu: portas e baús das propriedades pelo jogo: E abre (o que está trancado fica trancado de verdade, e arrombar é o segurar E do jogo, com gazua), F tranca e destranca para quem tem a chave ou é o dono, e por dentro o E abre uma porta trancada; ${propertyMenus.learnedSides()} porta(s) sem área com o lado já aprendido`);
}
