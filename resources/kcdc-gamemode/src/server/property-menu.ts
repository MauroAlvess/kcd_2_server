/**
 * The menu at a door or a chest of a property.
 *
 * Every door and chest of a property stands unlocked in the world and the lock is this server's (`properties.ts`, Locks),
 * so the game offers one thing there: "Abrir" (at an open door, "Fechar"). That press is heard here before the game acts
 * on it (`doorInteract`, `stashInteract`):
 *
 * - at an unlocked door or chest, a player without its key just opens it, as anywhere;
 * - otherwise the opening is refused and the game's dialogue list comes up with what the player may do there, by the
 *   user's rules (2026-10-15): "Abrir" only when it is not locked; "Destrancar" and "Trancar" only with its key;
 *   "Destrancar (Trancar) a propriedade inteira" at a house of several doors; "Arrombar" only with a lockpick, and then it
 *   is the game's own minigame; "Sair". An administrator may do what a key holder may. The owner needs the key too: keys
 *   are taken from the panel one at a time (nobody is handed them with a property any more).
 * - from inside -- the side of the door without the keyhole, as the game itself says (`keySide`), where the level's own areas
 *   (or what the game said at that door before) do not say otherwise -- the door just opens: a locked one has its bolt drawn
 *   by hand, for that door only (a player who slept in a castle was shut in, 2026-10-14). That press is accepted, not turned
 *   into a menu: a refusal makes the body play the opening and the door swing back, and from that side nothing can stop the
 *   game from offering its "Abrir" (2026-10-16: so a key holder locks a house from outside, or from the panel). Where the
 *   areas say outside, the menu still has "Abrir por dentro".
 *
 * "Arrombar" locks that door or chest in the world for two minutes (`holdShut`), so the game offers its lockpick
 * minigame to whoever holds a lockpick there (hold E). A pick that works unlocks it -- until the next start when the lock
 * is the level's -- and the owner is told; a failed one costs the game's own lockpick.
 *
 * A chest opened from the menu opens on a copy (`chest-view.ts`): the server cannot open a level chest's screen.
 *
 * The refusal is also what a press at those doors cost: the game starts the opening at once, the server puts the door back,
 * and the player saw the body open it and the door close by itself before choosing anything (2026-10-15). So the door the
 * menu is about to come up at is locked in the world, for the game only, while its player stands looking at it from outside
 * (`gaze`, told by `property-labels.ts`): a door the game thinks locked offers nothing at its keyhole side, the press does
 * nothing, and the client's own "Abrir" hint (its E, `props.use`) brings the menu up with nothing to take back. Only from
 * outside: from the side without a keyhole the game still offers its "Abrir" at a locked door, and a door this server locked
 * refuses a bolt drawn by hand, so the lock would only make that press a refusal. Which side is which, the level's own areas
 * say where they claim the door; where none does (most of a castle's doors), what the game said at that door before -- the
 * `keySide` of every press there -- is kept (`sideOf`, `playerdata/door-sides.json`). A door nobody has used yet is held
 * from either side, and the client lets it go where the game's own "Abrir" stays on the screen under the lock (the side
 * without the keyhole), after which nobody standing there is held for a while; an E pressed at a held door with the game's
 * prompt still up lets it go for that player too, so the next press is the game's own. At a door the menu has to answer to
 * everybody anyway (locked by this server) it is held whoever is near but somebody inside; at one that is open to all it is
 * held only with nobody else near, so that nobody is shut out by another's look. `/propriedade olhar desligar` turns all of
 * it off, and the menu then works as it did before, flicker and all.
 *
 * A client whose door is not in step with the server (KCDC logs "Door dispatcher unavailable" for some doors at some
 * joins) never reports the press; it also sends `props.use` when E is pressed at a property (`property-labels.ts`), and
 * when the game said nothing about it the menu comes up anyway.
 *
 * Nothing the client says is trusted: who may, how near, what is locked are read again at every step.
 */

import { isAdmin } from "./auth.js";
import { ChestViews } from "./chest-view.js";
import {
    displayName,
    doorName,
    holdGaze,
    holdShut,
    holdsKeyOf,
    insideOf,
    lockedInWorld,
    lockedNow,
    lockpickableOf,
    openInWorldNow,
    ownerOf,
    placeOfGuid,
    propertyOfGuid,
    setDoorLocked,
    setLocked,
    swingOpen,
    unlockPart,
} from "./properties.js";
import type { PropertyInfo } from "./properties.js";
import { ensureDir, read, write } from "./store.js";
import { minutesText, readyIn, unstick } from "./stuck.js";

const RESOURCE = "kcdc-gamemode";

/** How far from the door or chest a menu's choice is still taken. */
export const REACH_M = 4.5;

/** How far an E pressed at a property may be for the menu to come up without the game's word (the game's own reach is about 2 m). */
export const USE_REACH_M = 3;

/** How long a door or chest stays locked in the world for a lockpicking, and how far the picker may wander off. */
export const PICK_WINDOW_MS = 120_000;
export const PICK_LEAVE_M = 8;

/** The game's report of a press counts for an E pressed this close to it, before or after. */
export const HANDLED_MS = 1_500;
/** How long an E press waits for the game's own report before the menu comes up without it. */
export const FALLBACK_WAIT_MS = 450;
/** A chest whose copy could not be opened opens from its own prompt within this long. */
export const PASS_MS = 15_000;

export const TICK_MS = 1_000;

/**
 * The look a door is held locked for. The client says it every 700 ms; a look not said again within `GAZE_TTL_MS` lets the
 * door go, and the server takes a player's reports once in `GAZE_GAP_MS` at most. The player must be within `GAZE_REACH_M` of
 * the door (the reach of the press itself, `USE_REACH_M`), and a door open to all is held only with nobody else within
 * `GAZE_ALONE_M`. The locks are looked over every `GAZE_TICK_MS`.
 */
export const GAZE_TTL_MS = 2_000;
export const GAZE_REACH_M = USE_REACH_M;
export const GAZE_ALONE_M = 8;
export const GAZE_GAP_MS = 250;
export const GAZE_TICK_MS = 300;
/** A press at a door held locked for the player waits this long for the game: it is known to have nothing to say there. */
export const GAZED_WAIT_MS = 120;

/**
 * The sides of a door no level area claims, as the game said them at that door: a press made within `SIDE_SAMPLE_M` of the door
 * counts, the last `SIDE_SAMPLES_KEPT` or so weigh, and a player within `SIDE_MARGIN_M` of the line the door shuts on stands on
 * neither side.
 */
export const SIDE_SAMPLE_M = 3.5;
export const SIDE_SAMPLES_KEPT = 50;
export const SIDE_MARGIN_M = 0.3;
/** Where a client let a hold go because the game still offered its own "Abrir" under it: nobody that near is held there for a while. */
export const RELEASE_NEAR_M = 1.2;
export const RELEASE_KEEP_MS = 15 * 60_000;
/** An E pressed at a held door with the game's own prompt still up keeps that player's look from holding the door this long. */
export const SKIP_HOLD_MS = 15_000;
/** The sides learned are written down at most this often. */
const SIDES_SAVE_MS = 10_000;

/** The first holds, and every this many after, go to the log: it is how to tell, afterwards, that the lock was at work. */
const LOG_FIRST_HOLDS = 10;
const LOG_EVERY_HOLDS = 50;

const DIR = "playerdata";
const SETTINGS_FILE = `${DIR}/property-menu.json`;
const SIDES_FILE = `${DIR}/door-sides.json`;

/** What the game said of a door's sides: the directions along the floor from the door to the players who used it, turned toward the keyhole, summed. */
interface Sides {
    x: number;
    y: number;
    n: number;
}

/** The game's lockpick ("Gazua"). */
export const LOCKPICK_ITEM = "8d76f58e-a521-4205-a7e8-9ac077eee5f0";

interface Menu {
    readonly playerId: number;
    readonly guid: string;
    /** The game's own word on which side of the door the player stood (false: without the keyhole), or null. */
    readonly keySide: boolean | null;
}

interface Picking {
    readonly guid: string;
    readonly playerId: number;
    readonly until: number;
}

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

function distanceTo(player: Player, place: { x: number; y: number; z: number }): number {
    const here = player.position;
    return Math.hypot(here.x - place.x, here.y - place.y, here.z - place.z);
}

/** The lockpick row of a player's inventory, if they carry one. */
function lockpickOf(player: Player): { id: string; amount: number } | null {
    const row = (Inventory.get(player)?.items ?? []).find((candidate) => candidate.item === LOCKPICK_ITEM && candidate.amount > 0);
    return row === undefined ? null : { id: row.id, amount: row.amount };
}

/** What the player reads for this door or chest: "Casa 03", "Casa 03 · Porta 2", "Casa 03 · Baú 1". */
export function partName(property: PropertyInfo, guid: string): string {
    const index = property.doors.indexOf(guid);
    return index >= 0 && property.doors.length > 1 ? `${displayName(property)} · ${doorName(property, index)}` : displayName(property);
}

export class PropertyMenus {
    private readonly menus = new Map<number, Menu>();
    private readonly sessionOf = new Map<number, number>();
    private readonly handledAt = new Map<string, number>();
    private readonly passes = new Map<string, number>();
    private readonly pickings = new Map<string, Picking>();
    /** The doors held locked for a look: who looks at each, and when each last said so. */
    private readonly gazes = new Map<string, Map<number, number>>();
    /** The door each player's look is on. */
    private readonly gazeOf = new Map<number, string>();
    private readonly saidAt = new Map<number, number>();
    private readonly noArea = new Set<string>();
    private holds = 0;
    private leaks = 0;
    private gazeLock = true;
    /** The sides of doors no level area claims, learned from the game's own `keySide`. */
    private readonly sides = new Map<string, Sides>();
    private sidesDirty = false;
    private sidesSavedAt = -Infinity;
    /** Where clients let a hold go, by door, and when: the side without the keyhole, as far as each could tell. */
    private readonly releasedAt = new Map<string, Array<{ x: number; y: number; z: number; at: number }>>();
    private releases = 0;
    /** A door a player's look does not hold until then (`${playerId}:${guid}`). */
    private readonly skipHold = new Map<string, number>();

    constructor(
        readonly views: ChestViews = new ChestViews(),
        private readonly now: () => number = () => Date.now(),
        private readonly later: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
    ) {}

    /**
     * Who may lock and unlock it: whoever holds its key, and an administrator. With a door named, the key of that one door
     * counts too, for that door; without one it is the house's own key that is asked for (the whole property).
     */
    hasKey(player: Player, property: PropertyInfo, guid?: string): boolean {
        return isAdmin(player) || holdsKeyOf(player, property, guid);
    }

    private mark(player: Player, guid: string): void {
        this.handledAt.set(`${player.id}:${guid}`, this.now());
    }

    // -----------------------------------------------------------------------------------------
    // What the game says.

    /** A player works a door of the level. False refuses it: the game puts the door back. */
    door(player: Player, door: Door, action: string, keySide: boolean): false | undefined {
        const property = propertyOfGuid(door.guid);
        if (property === null) {
            return undefined;
        }
        this.mark(player, door.guid);
        // Every press says which side the player stood on: kept for a door no area claims.
        this.learnSide(player, property, door.guid, keySide);
        if (this.gazeOf.get(player.id) === door.guid && action === "open") {
            // The lock was meant to leave the game nothing to report here: it did (the lock came too late, or the door ignores it).
            this.leaks += 1;
            if (this.leaks <= LOG_FIRST_HOLDS) {
                console.log(`property-menu: o jogo ainda ofereceu ${partName(property, door.guid)} a ${player.nickname} com a trava ao olhar posta (${this.leaks}º caso)`);
            }
        }
        if (action === "close") {
            return undefined;
        }
        if (action === "lockpick") {
            return this.lockpicked(player, property, door.guid);
        }
        if (action === "unlock") {
            // Only a door held shut for a lockpicking is locked in the world: the bolt from inside, or a key the level knows.
            if (keySide && !this.hasKey(player, property, door.guid)) {
                return false;
            }
            this.later(() => this.cameOpen(player, door.guid, keySide ? "key" : "inside"), 0);
            return undefined;
        }
        const locked = lockedNow(door.guid) === true;
        if (!locked && !this.hasKey(player, property, door.guid)) {
            return undefined;
        }
        // From inside -- the game says the side without the keyhole, and the areas (or what the game said there before) do not
        // say outside -- the door just opens, its bolt drawn by hand if it was locked: no menu, nothing to take back.
        if (keySide === false && this.sideOf(player, door.guid) !== false) {
            if (locked) {
                this.drawnFromInside(player, property, door.guid);
            }
            return undefined;
        }
        this.later(() => this.show(player, door.guid, keySide), 0);
        return false;
    }

    /** A locked door was opened by hand from inside, and the game is opening it: it stays unlocked, and the owner is told. */
    private drawnFromInside(player: Player, property: PropertyInfo, guid: string): void {
        this.endPicking(guid);
        unlockPart(guid);
        const name = partName(property, guid);
        console.log(`property-menu: ${player.nickname} abriu ${name} por dentro`);
        if (!this.hasKey(player, property, guid)) {
            this.warnOwner(property, `Alguém abriu ${name} por dentro.`);
        }
    }

    /**
     * The game reports a lockpick. A door held shut for a lockpicking goes on with it. A door held locked for a look shows the
     * game's own lockpick prompt to somebody with the skill: where the menu would have offered Arrombar it is taken at once,
     * anywhere else it is refused (an unlocked door, a key holder, a lock that cannot be picked, no lockpick).
     */
    private lockpicked(player: Player, property: PropertyInfo, guid: string): false | undefined {
        if (this.pickings.has(guid) || !this.gazes.has(guid)) {
            return undefined;
        }
        if (lockedNow(guid) === true && !this.hasKey(player, property, guid) && lockpickableOf(guid) && lockpickOf(player) !== null) {
            this.pickings.set(guid, { guid, playerId: player.id, until: this.now() + PICK_WINDOW_MS });
            holdShut(guid, true);
            this.warnOwner(property, `Alguém está tentando arrombar ${partName(property, guid)}.`);
            console.log(`property-menu: ${player.nickname} começou a arrombar ${partName(property, guid)} pelo próprio jogo`);
            return undefined;
        }
        return false;
    }

    /** A player opens, unlocks or picks a chest of the level. False refuses it: nothing appears. */
    chest(player: Player, stash: Stash, action: string): false | undefined {
        if (this.views.isCopy(stash)) {
            return undefined;
        }
        const property = propertyOfGuid(stash.levelGuid);
        if (property === null) {
            return undefined;
        }
        if (this.views.busy(stash.levelGuid, player.id)) {
            tell(player, "Alguém está mexendo neste baú agora.");
            return false;
        }
        this.mark(player, stash.levelGuid);
        if (action === "lockpick") {
            // The game's minigame starting at a chest held shut for it; `stashOpened` or `tick` sees it come open.
            return undefined;
        }
        if (action === "unlock") {
            if (!this.hasKey(player, property)) {
                return false;
            }
            this.later(() => this.cameOpen(player, stash.levelGuid, "key"), 0);
            return undefined;
        }
        const mark = `${player.id}:${stash.levelGuid}`;
        const pass = this.passes.get(mark);
        if (pass !== undefined && pass >= this.now()) {
            this.passes.delete(mark);
            return undefined;
        }
        if (lockedNow(stash.levelGuid) !== true && !this.hasKey(player, property)) {
            return undefined;
        }
        this.later(() => this.show(player, stash.levelGuid, null), 0);
        return false;
    }

    /** A chest's screen came up: one that was being picked by this player was picked. */
    stashOpened(stash: Stash, player: Player): void {
        const picking = this.pickings.get(stash.levelGuid);
        if (picking !== undefined && picking.playerId === player.id) {
            this.picked(picking);
        }
    }

    /**
     * E was pressed at a property, by the client's own reading (`props.use`). When the game itself said nothing about it,
     * that client's door or chest is out of step with the server, and the menu comes up anyway.
     */
    use(player: Player, guid: string, gamePrompt = false): void {
        const property = propertyOfGuid(guid);
        const place = placeOfGuid(guid);
        if (property === null || place === null || !player.ready || !player.alive || this.sessionOf.has(player.id) || this.views.openBy(player.id)) {
            return;
        }
        if (distanceTo(player, place) > USE_REACH_M) {
            return;
        }
        const asked = this.now();
        const mark = `${player.id}:${guid}`;
        if (this.gazeOf.get(player.id) === guid && gamePrompt && this.sideOf(player, guid) !== false) {
            // E at a door held for this look while the game's own prompt was still on the screen: the side without the keyhole,
            // where the lock only made the game's Abrir a refusal. The lock comes off this door for this player for a while, and
            // nothing comes up: the next press is the game's own, and opens it (it says the side, too).
            this.skipHold.set(mark, asked + SKIP_HOLD_MS);
            this.unhold(player.id, guid);
            console.log(`property-menu: ${player.nickname} apertou E em ${partName(property, guid)} travada para o olhar com o "Abrir" do jogo na tela (lado do ferrolho): a trava saiu dessa porta para ele`);
            return;
        }
        // At a door held locked for this player the game has nothing to say, and nothing to wait for.
        const gazed = this.gazeOf.get(player.id) === guid;
        this.later(() => {
            if ((this.handledAt.get(mark) ?? -Infinity) >= asked - HANDLED_MS || this.sessionOf.has(player.id) || !player.ready) {
                return;
            }
            if (lockedNow(guid) !== true && !this.hasKey(player, property, guid)) {
                return;
            }
            if (!gazed) {
                console.log(`property-menu: ${player.nickname} apertou E em ${partName(property, guid)} e o jogo não avisou: nesse cliente ela pode estar sem sincronia com o servidor`);
            }
            this.show(player, guid, null);
        }, gazed ? GAZED_WAIT_MS : FALLBACK_WAIT_MS);
    }

    // -----------------------------------------------------------------------------------------
    // The look: a door is held locked in the world while its player looks at it, from outside.

    /** Whether the lock is on at all. `/propriedade olhar` turns it off, and the menu then works as it did, flicker and all. */
    gazeLockOn(): boolean {
        return this.gazeLock;
    }

    setGazeLock(on: boolean): void {
        this.gazeLock = on;
        if (!on) {
            for (const [guid, holders] of [...this.gazes]) {
                for (const id of [...holders.keys()]) {
                    this.unhold(id, guid);
                }
            }
        }
        try {
            ensureDir(DIR);
            write(SETTINGS_FILE, { gazeLock: on });
        } catch (error: unknown) {
            console.log(`property-menu: não consegui guardar a trava ao olhar: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    loadSettings(): void {
        const loaded = read<{ gazeLock?: unknown }>(SETTINGS_FILE);
        this.gazeLock = loaded.status !== "ok" || loaded.value.gazeLock !== false;
    }

    /**
     * How many doors are held locked for a look right now, how many presses the game reported at one anyway, how many doors no
     * area claims have learned sides, and how many holds clients let go because the game still offered its own "Abrir".
     */
    gazing(): { doors: number; holds: number; leaks: number; sides: number; releases: number } {
        return { doors: this.gazes.size, holds: this.holds, leaks: this.leaks, sides: this.sides.size, releases: this.releases };
    }

    // -----------------------------------------------------------------------------------------
    // The sides of a door.

    /**
     * Which side of a door the player stands on: inside (true), outside (false), or null when it cannot be said. The level's
     * own areas say it where they claim the door; elsewhere it is what the game itself said at that door before -- the
     * `keySide` of each press there, kept as the direction from the door toward its keyhole -- so a door no area claims has
     * sides once somebody has used it.
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

    /** Whether a client let this door's hold go near where the player stands, a little while ago. */
    private nearRelease(player: Player, guid: string): boolean {
        const spots = this.releasedAt.get(guid);
        if (spots === undefined) {
            return false;
        }
        const now = this.now();
        const here = player.position;
        return spots.some((spot) => now - spot.at < RELEASE_KEEP_MS && Math.hypot(here.x - spot.x, here.y - spot.y, here.z - spot.z) <= RELEASE_NEAR_M);
    }

    /** A client says the game still offers its own "Abrir" at the door held for its look: the hold goes, and the spot is kept. */
    private released(player: Player, guid: string): void {
        const property = propertyOfGuid(guid);
        if (property === null || this.gazeOf.get(player.id) !== guid) {
            return;
        }
        this.releases += 1;
        const here = player.position;
        const now = this.now();
        if (this.sideOf(player, guid) === false) {
            // Outside, by the areas or what the game said: the lock did not silence the game here. Nothing is kept of the spot.
            console.log(`property-menu: o jogo ainda oferecia ${partName(property, guid)} a ${player.nickname} do lado de fora com a trava ao olhar posta: a trava saiu`);
            return;
        }
        const spots = (this.releasedAt.get(guid) ?? []).filter((spot) => now - spot.at < RELEASE_KEEP_MS).slice(-7);
        spots.push({ x: here.x, y: here.y, z: here.z, at: now });
        this.releasedAt.set(guid, spots);
        if (this.releases <= LOG_FIRST_HOLDS) {
            console.log(`property-menu: o cliente de ${player.nickname} soltou a trava de ${partName(property, guid)}: o "Abrir" do jogo continuava na tela (lado do ferrolho, ou porta que não tranca)`);
        }
    }

    loadSides(): void {
        const loaded = read<Record<string, unknown>>(SIDES_FILE);
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        for (const [guid, value] of Object.entries(loaded.value)) {
            const entry = value as Partial<Sides> | null;
            if (/^[0-9a-f]{8,32}$/.test(guid) && entry !== null && typeof entry === "object" && Number.isFinite(entry.x) && Number.isFinite(entry.y) && Number.isFinite(entry.n)) {
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

    /** Tells a player's client which door is held for its look ("" for none): its own "Abrir" hint goes up only at a held door. */
    private told(playerId: number, guid: string): void {
        Player.getById(playerId)?.emit(`${RESOURCE}:props.gazed`, JSON.stringify({ guid }));
    }

    /** Whether anybody else is near enough to a door to be hurt by its lock: at a door meant locked, only somebody inside. */
    private crowded(gazer: Player, guid: string, place: { x: number; y: number; z: number }, meantLocked: boolean): boolean {
        return Player.all().some((other) => {
            if (other.id === gazer.id || !other.ready || !other.alive || distanceTo(other, place) > GAZE_ALONE_M) {
                return false;
            }
            // At a door meant locked everybody is sent to the menu anyway; only somebody inside would lose the smooth way out.
            return !meantLocked || this.sideOf(other, guid) !== false;
        });
    }

    /** Whether a look at this door is to hold it: a door of a property, shut, where a press would bring the menu up. */
    private canGaze(player: Player, guid: string): boolean {
        if (!this.gazeLock || !player.ready || !player.alive || this.pickings.has(guid)) {
            return false;
        }
        const property = propertyOfGuid(guid);
        const place = placeOfGuid(guid);
        if (property === null || place === null || !property.doors.includes(guid)) {
            return false;
        }
        if (openInWorldNow(guid) || distanceTo(player, place) > GAZE_REACH_M) {
            return false;
        }
        const meantLocked = lockedNow(guid) === true;
        if (!meantLocked && !this.hasKey(player, property, guid)) {
            return false;
        }
        // From the side without the keyhole the game still offers its "Abrir" at a locked door, and the lock would only make it a
        // refusal: not from inside, nor where a client found the game's Abrir still up under the lock, nor for a while after an E
        // pressed there with it up. A door whose side cannot be said yet is held: the client lets it go where it is the wrong one.
        const side = this.sideOf(player, guid);
        if (side === true || this.nearRelease(player, guid) || (this.skipHold.get(`${player.id}:${guid}`) ?? -Infinity) > this.now()) {
            return false;
        }
        if (side === null && !this.sides.has(guid) && !this.noArea.has(guid)) {
            this.noArea.add(guid);
            console.log(`property-menu: ${partName(property, guid)} não tem área do jogo que diga o que é dentro, e ninguém a usou ainda: a trava ao olhar vale dos dois lados até o primeiro uso dizer o lado; do lado do ferrolho o cliente a solta`);
        }
        return !this.crowded(player, guid, place, meantLocked);
    }

    private hold(player: Player, guid: string, now: number): void {
        let holders = this.gazes.get(guid);
        if (holders === undefined) {
            if (!holdGaze(guid, true)) {
                return;
            }
            holders = new Map();
            this.gazes.set(guid, holders);
            this.holds += 1;
            if (this.holds <= LOG_FIRST_HOLDS || this.holds % LOG_EVERY_HOLDS === 0) {
                const property = propertyOfGuid(guid);
                console.log(`property-menu: trava ao olhar nº ${this.holds}: ${property === null ? guid : partName(property, guid)}, olhada por ${player.nickname}`);
            }
        }
        holders.set(player.id, now);
        this.gazeOf.set(player.id, guid);
        this.told(player.id, guid);
    }

    private unhold(playerId: number, guid: string): void {
        const holders = this.gazes.get(guid);
        if (holders === undefined || !holders.delete(playerId)) {
            return;
        }
        if (this.gazeOf.get(playerId) === guid) {
            this.gazeOf.delete(playerId);
        }
        this.told(playerId, "");
        if (holders.size === 0) {
            this.gazes.delete(guid);
            holdGaze(guid, false);
        }
    }

    private letGo(playerId: number): void {
        const guid = this.gazeOf.get(playerId);
        if (guid !== undefined) {
            this.unhold(playerId, guid);
        }
    }

    /**
     * The client says which door of a property its player is looking at, in reach, or "" for none; with `released`, the door it
     * lets go because the game still offered its own "Abrir" under the lock.
     */
    gaze(player: Player, guid: string, released = ""): void {
        if (guid === "") {
            if (released !== "") {
                this.released(player, released);
            }
            this.letGo(player.id);
            return;
        }
        const now = this.now();
        if (now - (this.saidAt.get(player.id) ?? -Infinity) < GAZE_GAP_MS) {
            return;
        }
        this.saidAt.set(player.id, now);
        const was = this.gazeOf.get(player.id);
        if (was !== undefined && was !== guid) {
            this.unhold(player.id, was);
        }
        if (!this.canGaze(player, guid)) {
            this.unhold(player.id, guid);
            return;
        }
        this.hold(player, guid, now);
    }

    /** A look not said again, or whose door, player or company changed, lets the door go. */
    gazeTick(): void {
        const now = this.now();
        for (const [guid, holders] of [...this.gazes]) {
            for (const [id, at] of [...holders]) {
                const player = Player.getById(id);
                if (player === null || now - at > GAZE_TTL_MS || !this.canGaze(player, guid)) {
                    this.unhold(id, guid);
                }
            }
        }
        for (const [id, at] of this.saidAt) {
            if (now - at > 10 * GAZE_TTL_MS) {
                this.saidAt.delete(id);
            }
        }
        for (const [mark, until] of this.skipHold) {
            if (until <= now) {
                this.skipHold.delete(mark);
            }
        }
    }

    // -----------------------------------------------------------------------------------------
    // The menu.

    page(player: Player, property: PropertyInfo, guid: string, keySide: boolean | null): DialoguePage {
        const door = property.doors.includes(guid);
        const locked = lockedNow(guid) === true;
        // This door's own key (or the house's) for this door; only the house's own for the doors all together.
        const key = this.hasKey(player, property, guid);
        const master = this.hasKey(player, property);
        const options: DialogueOption[] = [];
        if (locked) {
            options.push({ id: "info", text: `${partName(property, guid)}: ${door ? "trancada" : "trancado"}`, enabled: false });
        } else {
            options.push({ id: "open", text: "Abrir", enabled: true });
        }
        const inside = door && locked && (keySide === false || (keySide === null && this.sideOf(player, guid) === true));
        if (inside) {
            options.push({ id: "inside", text: "Abrir por dentro", enabled: true });
        }
        if (locked) {
            options.push({ id: "unlock", text: key ? "Destrancar" : "Destrancar (precisa da chave)", enabled: key });
        } else if (key) {
            options.push({ id: "lock", text: "Trancar", enabled: true });
        }
        if (door && master && property.doors.length > 1) {
            const shut = property.doors.map((candidate) => lockedNow(candidate) === true);
            if (shut.some((value) => value)) {
                options.push({ id: "unlockAll", text: "Destrancar a propriedade inteira", enabled: true });
            }
            if (shut.some((value) => !value)) {
                options.push({ id: "lockAll", text: "Trancar a propriedade inteira", enabled: true });
            }
        }
        if (locked && !key && !inside) {
            const can = lockpickableOf(guid);
            const pick = lockpickOf(player) !== null;
            const other = this.pickings.get(guid);
            const busy = other !== undefined && other.playerId !== player.id;
            const text = !can ? "Arrombar (esta fechadura não se arromba)" : busy ? "Arrombar (alguém já está tentando)" : pick ? "Arrombar" : "Arrombar (precisa de uma gazua)";
            options.push({ id: "pick", text, enabled: can && pick && !busy });
        }
        // A way out for whoever is shut in (or cannot tell): the church nearest, once an hour, as "Fiquei preso" in the panel.
        if (door && locked && !key && !inside) {
            const wait = readyIn(player);
            options.push({ id: "stuck", text: wait > 0 ? `Estou preso (de novo em ${minutesText(wait * 1000)})` : "Estou preso aqui (ir para a igreja mais próxima)", enabled: wait === 0 });
        }
        options.push({ id: "leave", text: "Sair", enabled: true });
        return { line: undefined, onRight: false, options };
    }

    private show(player: Player, guid: string, keySide: boolean | null): void {
        const property = propertyOfGuid(guid);
        if (property === null || !player.ready || !player.alive) {
            return;
        }
        const old = this.sessionOf.get(player.id);
        if (old !== undefined) {
            this.forget(old);
            Dialogue.close(old);
        }
        const session = Dialogue.open(player.id, this.page(player, property, guid, keySide));
        if (session === 0) {
            return;
        }
        this.menus.set(session, { playerId: player.id, guid, keySide });
        this.sessionOf.set(player.id, session);
        const side = keySide === false ? "por dentro" : keySide === true ? "por fora" : "sem o lado dito pelo jogo";
        console.log(`property-menu: ${player.nickname} em ${partName(property, guid)} (${lockedNow(guid) === true ? "trancada" : "destrancada"}, ${side})`);
    }

    private forget(session: number): void {
        const menu = this.menus.get(session);
        this.menus.delete(session);
        if (menu !== undefined && this.sessionOf.get(menu.playerId) === session) {
            this.sessionOf.delete(menu.playerId);
        }
    }

    private close(session: number): void {
        this.forget(session);
        Dialogue.close(session);
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

    /** Opens what was worked: a door swings open; a chest opens on its copy, or from its own prompt when that cannot be. */
    private openPart(player: Player, property: PropertyInfo, guid: string): void {
        if (property.doors.includes(guid)) {
            swingOpen(guid);
            return;
        }
        const stash = Stash.find(guid);
        if (stash !== null && this.views.open(player, stash)) {
            return;
        }
        this.passes.set(`${player.id}:${guid}`, this.now() + PASS_MS);
        tell(player, "Aperte E no baú para abrir.");
    }

    choose(session: number, player: Player, option: string): void {
        const menu = this.menus.get(session);
        if (menu === undefined || menu.playerId !== player.id) {
            return;
        }
        const property = propertyOfGuid(menu.guid);
        const place = placeOfGuid(menu.guid);
        if (property === null || place === null || distanceTo(player, place) > REACH_M + 1) {
            this.close(session);
            return;
        }
        const name = partName(property, menu.guid);
        const door = property.doors.includes(menu.guid);
        const key = this.hasKey(player, property, menu.guid);
        const master = this.hasKey(player, property);

        switch (option) {
            case "leave":
                this.close(session);
                return;
            case "open":
                this.close(session);
                if (lockedNow(menu.guid) === true) {
                    tell(player, `${name} está ${door ? "trancada" : "trancado"}.`);
                    return;
                }
                this.openPart(player, property, menu.guid);
                return;
            case "unlock":
                if (!key) {
                    tell(player, `Você não tem a chave de ${name}.`);
                    return;
                }
                this.close(session);
                this.endPicking(menu.guid);
                this.setPart(property, menu.guid, false);
                tell(player, `${name}: ${door ? "destrancada" : "destrancado"}.`);
                this.openPart(player, property, menu.guid);
                return;
            case "inside": {
                const inside = door && (menu.keySide === false || (menu.keySide === null && this.sideOf(player, menu.guid) === true));
                if (!inside) {
                    tell(player, `Daqui de fora não dá: ${name} só abre sem chave por dentro.`);
                    return;
                }
                this.close(session);
                this.endPicking(menu.guid);
                unlockPart(menu.guid);
                swingOpen(menu.guid);
                tell(player, `Você abriu ${name} por dentro.`);
                console.log(`property-menu: ${player.nickname} abriu ${name} por dentro`);
                if (!key) {
                    this.warnOwner(property, `Alguém abriu ${name} por dentro.`);
                }
                return;
            }
            case "lock":
                if (!key) {
                    return;
                }
                this.close(session);
                this.setPart(property, menu.guid, true);
                tell(player, `${name}: ${door ? "trancada" : "trancado"}.`);
                return;
            case "unlockAll":
                if (!master) {
                    return;
                }
                this.close(session);
                property.doors.forEach((guid) => this.endPicking(guid));
                setLocked(property.id, false);
                swingOpen(menu.guid);
                tell(player, `${displayName(property)}: todas as portas destrancadas.`);
                return;
            case "lockAll":
                if (!master) {
                    return;
                }
                this.close(session);
                setLocked(property.id, true);
                tell(player, `${displayName(property)}: todas as portas trancadas.`);
                return;
            case "stuck":
                if (!door || key || lockedNow(menu.guid) !== true) {
                    return;
                }
                this.close(session);
                tell(player, unstick(player).message);
                return;
            case "pick": {
                if (key || lockedNow(menu.guid) !== true) {
                    this.close(session);
                    return;
                }
                if (lockpickOf(player) === null) {
                    tell(player, "Para arrombar é preciso uma gazua.");
                    return;
                }
                const other = this.pickings.get(menu.guid);
                if (!lockpickableOf(menu.guid) || (other !== undefined && other.playerId !== player.id)) {
                    return;
                }
                this.close(session);
                this.beginPicking(player, property, menu.guid);
                return;
            }
            default:
                return;
        }
    }

    closed(session: number): void {
        this.forget(session);
    }

    // -----------------------------------------------------------------------------------------
    // Lockpicking: the game's own minigame, on a lock put on for it.

    private beginPicking(player: Player, property: PropertyInfo, guid: string): void {
        const name = partName(property, guid);
        if (!holdShut(guid, true)) {
            tell(player, `A fechadura de ${name} não respondeu. Tente de novo daqui a pouco.`);
            return;
        }
        this.pickings.set(guid, { guid, playerId: player.id, until: this.now() + PICK_WINDOW_MS });
        tell(player, `Segure E na fechadura de ${name} para usar a gazua.`);
        this.warnOwner(property, `Alguém está tentando arrombar ${name}.`);
        console.log(`property-menu: ${player.nickname} vai tentar arrombar ${name}`);
    }

    /** Lets the lock of a lockpicking go, without saying anything. */
    private endPicking(guid: string): void {
        if (this.pickings.delete(guid)) {
            holdShut(guid, false);
        }
    }

    private picked(picking: Picking): void {
        this.pickings.delete(picking.guid);
        holdShut(picking.guid, false);
        const property = propertyOfGuid(picking.guid);
        if (property === null) {
            return;
        }
        unlockPart(picking.guid);
        const name = partName(property, picking.guid);
        const player = Player.getById(picking.playerId);
        if (player !== null) {
            tell(player, `Você arrombou ${name}.`);
        }
        this.warnOwner(property, `Alguém arrombou ${name}!`);
        console.log(`property-menu: ${player?.nickname ?? "alguém"} arrombou ${name}`);
    }

    /** A door or chest came open while it was held shut: from inside, or with a key, not picked. */
    private cameOpen(player: Player, guid: string, how: "key" | "inside"): void {
        this.endPicking(guid);
        const property = propertyOfGuid(guid);
        if (property === null) {
            return;
        }
        if (how === "key") {
            this.setPart(property, guid, false);
        } else {
            unlockPart(guid);
        }
        console.log(`property-menu: ${player.nickname} ${how === "key" ? "destrancou com a chave" : "abriu por dentro"} ${partName(property, guid)}`);
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
        for (const picking of [...this.pickings.values()]) {
            if (propertyOfGuid(picking.guid) === null) {
                this.endPicking(picking.guid);
                continue;
            }
            if (lockedInWorld(picking.guid) === false) {
                this.picked(picking);
                continue;
            }
            const player = Player.getById(picking.playerId);
            const place = placeOfGuid(picking.guid);
            const away = player === null || !player.alive || (place !== null && distanceTo(player, place) > PICK_LEAVE_M);
            if (now >= picking.until || away) {
                this.endPicking(picking.guid);
                if (player !== null && player.alive) {
                    tell(player, "A fechadura voltou a ficar como estava.");
                }
            }
        }
        for (const [mark, at] of this.handledAt) {
            if (now - at > 10 * HANDLED_MS) {
                this.handledAt.delete(mark);
            }
        }
        for (const [mark, until] of this.passes) {
            if (until < now) {
                this.passes.delete(mark);
            }
        }
    }

    /** A player who left or died: their menu and their lockpicking go. */
    left(player: Player): void {
        this.letGo(player.id);
        this.saidAt.delete(player.id);
        const session = this.sessionOf.get(player.id);
        if (session !== undefined) {
            this.forget(session);
        }
        for (const picking of [...this.pickings.values()]) {
            if (picking.playerId === player.id) {
                this.endPicking(picking.guid);
            }
        }
    }

    cancelAll(): void {
        for (const [guid, holders] of [...this.gazes]) {
            for (const id of [...holders.keys()]) {
                this.unhold(id, guid);
            }
        }
        for (const guid of [...this.pickings.keys()]) {
            this.endPicking(guid);
        }
        this.views.endAll();
        this.saveSides(true);
    }
}

export const propertyMenus = new PropertyMenus();

export function installPropertyMenu(): void {
    propertyMenus.loadSettings();
    propertyMenus.loadSides();
    Events.on("doorInteract", (player, door, action, keySide) => propertyMenus.door(player, door, action, keySide));
    Events.on("stashInteract", (player, stash, action) => propertyMenus.chest(player, stash, action));
    Events.on("stashOpen", (stash, player) => propertyMenus.stashOpened(stash, player));
    Events.on("stashInventoryChanged", (stash) => propertyMenus.views.changed(stash));
    Events.on("stashClose", (stash) => propertyMenus.views.closed(stash));
    Events.onClient(`${RESOURCE}:props.use`, (sender, payload) => {
        const fields = fieldsOf(payload);
        const guid = fields["guid"];
        if (typeof guid === "string" && /^[0-9a-f]{8,32}$/.test(guid)) {
            // `prompt`: the game's own prompt was on the screen when E was pressed (not the client's own "Abrir").
            propertyMenus.use(sender as Player, guid, fields["prompt"] === true);
        }
    });
    // The door its player looks at, in reach, or "" for none: it is held locked in the world while the look lasts (see `gaze`).
    Events.onClient(`${RESOURCE}:props.gaze`, (sender, payload) => {
        const fields = fieldsOf(payload);
        const guid = fields["guid"];
        const released = fields["released"];
        if (guid === "" || (typeof guid === "string" && /^[0-9a-f]{8,32}$/.test(guid))) {
            propertyMenus.gaze(sender as Player, guid, typeof released === "string" && /^[0-9a-f]{8,32}$/.test(released) ? released : "");
        }
    });
    Events.on("dialogueChoice", (session, player, option) => propertyMenus.choose(session, player, option));
    Events.on("dialogueClosed", (session) => propertyMenus.closed(session));
    Events.on("playerDisconnect", (player) => propertyMenus.left(player));
    Events.on("playerDied", (player) => propertyMenus.left(player));
    const timer = setInterval(() => propertyMenus.tick(), TICK_MS);
    const gazeTimer = setInterval(() => propertyMenus.gazeTick(), GAZE_TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            clearInterval(gazeTimer);
            propertyMenus.cancelAll();
        }
    });
    console.log(`property-menu: portas e baús das propriedades destrancados no mundo; o [E] Abrir do jogo abre o menu (abrir, destrancar, trancar, arrombar com o minijogo, sair), e por dentro a porta abre direto; a porta que o menu vai abrir fica trancada no mundo enquanto o jogador olha para ela, por fora (trava ao olhar): ${propertyMenus.gazeLockOn() ? "ligada" : "desligada"}; ${propertyMenus.gazing().sides} porta(s) sem área com o lado já aprendido`);
}
