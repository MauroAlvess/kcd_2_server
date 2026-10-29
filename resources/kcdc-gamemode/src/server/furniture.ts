/**
 * The furniture a World Builder export places (user, 2026-10-19: "os baús, camas e cadeiras que colocamos em Raborsch no
 * castelo não tem como interagir"). An export's props are bare meshes: nothing in the game answers to them. So:
 *
 *  - a chest becomes a real container, the same mesh spawned as a `Stash` in its place (the game's own transfer screen, the
 *    prompt and the sound), the bare prop taken away so the two do not stand in one another; what is left in it is kept in
 *    `playerdata/world-chests.json` and put back at every start;
 *  - a chair or a stool, and a bed, are seats and beds of ours: the client shows "Sentar" or "Deitar" on the interaction key when
 *    the aim is on one (`src/client/cook-hint.ts`, the same hint that serves the fire and the forge), the body is put on it
 *    (by the server, with the game's own spawn: the client's own move of its body did not hold), and the game's own sitting or
 *    lying animation is played, looped, with the legs held. Nothing here is native: an export's props are bare meshes, the
 *    game's seats and beds are smart objects of the level's own furniture, which no API spawns. Sitting and lying restore the tiredness bar as in the game's own seats
 *    (`fatigue.ts`). W, A, S, D, Space or the key again stand the player up (`src/client/furniture.ts`); `/levantar` too.
 *
 * Where on the mesh the body goes is a guess from the pieces' measured sizes, and the game's animations are made for its own
 * seats, so `/mobilia` (admin) moves the seat and the mattress, and its numbers are kept (`playerdata/furniture-tuning.json`).
 */

import { fatiguePace } from "./fatigue.js";
import { ensureDir, read, write } from "./store.js";
import { allowedTo, EDGE_M } from "./reach.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const CHESTS_FILE = "playerdata/world-chests.json";
const TUNING_FILE = "playerdata/furniture-tuning.json";

export type SpotKind = "cadeira" | "cama";

/** The game's chairs and stools (one seat each), its beds (one sleeper each, two in a double one) and its chests. */
export const CHAIR_MODEL = /(?:^|\/)common_furniture\/(?:chairs|stools)\/(?:.+\/)?[^/]+\.cgf$/i;
export const BED_MODEL = /(?:^|\/)common_furniture\/beds\/(?:.+\/)?bed_[^/]+\.cgf$/i;
export const DOUBLE_BED = /double/i;
export const CHEST_MODEL = /(?:^|\/)common_furniture\/chests\/chest_[^/]+\.cgf$/i;

/** The kind numbers the client uses in the places it is told of (the fire, rack, smokehouse, forge and table are 0 to 4). */
export const FURNITURE_KIND_INDEX: Readonly<Record<SpotKind, number>> = { cadeira: 5, cama: 6 };

/**
 * Where the body goes, in metres and degrees. A chair's pivot sits at its front edge (a measured `chair_fancy_a` runs 0.08 m
 * behind the pivot to 0.60 m in front of it ... along the chair's own +Y, its back), so the seat's middle is about 0.3 m along +Y,
 * which is `forward` -0.3 along the sitter's heading (the chair's front is its -Y). A bed's pivot is the middle of its footprint;
 * the mattress is `up` above the floor, `along` moves the body toward the head, `apart` is how far a double bed's two sleepers
 * lie from its middle, and `turn` is added to the piece's heading to get the body's (the head end is the bed's +Y).
 */
export const tuning = {
    chair: { forward: -0.3, up: 0, turn: 180 },
    bed: { up: 0.62, along: 0, turn: 0, apart: 0.4 },
};

/** How near a seat or a bed the player must be, on the ground and in height: the one reach of our prompts to its point, and a metre more (`reach.ts`). */
export const REACH_M = allowedTo(EDGE_M.chair);
export const BED_REACH_M = allowedTo(EDGE_M.bed);
export const REACH_HEIGHT_M = 2.5;
/** How far from the point its hint was on a spot may be and still be that piece. */
export const AIM_TOLERANCE_M = 0.6;
/** How long the body has to arrive on the seat (the client waits less, and says so) before the use is given up. */
export const PLACE_WAIT_MS = 4_500;
/** How many times a body the game moved off its seat after the animation began is put back. */
export const MAX_DRIFTS = 3;
/** A press this soon after lying down is not read as "get up" (the movement keys may still be held from walking up). */
export const STAND_GRACE_MS = 800;

export interface Spot {
    readonly id: string;
    readonly kind: SpotKind;
    readonly model: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** The piece's heading in radians (rotation about the vertical, 0 along +Y). */
    readonly yaw: number;
    /** A double bed's two sleepers: -1 and 1 (to the left and to the right of the middle); 0 for the rest. */
    readonly side: number;
}

export interface PropLike {
    readonly model: string;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    readonly rotation?: unknown;
}

/** The heading of a prop's rotation in radians: from a quaternion (x, y, z, w) or from Euler degrees with Z up. */
export function yawOf(rotation: unknown): number {
    const r = rotation as { x?: number; y?: number; z?: number; w?: number } | null | undefined;
    if (r === null || r === undefined || typeof r !== "object") {
        return 0;
    }
    if (typeof r.w === "number" && typeof r.z === "number") {
        const x = typeof r.x === "number" ? r.x : 0;
        const y = typeof r.y === "number" ? r.y : 0;
        return Math.atan2(2 * (r.w * r.z + x * y), 1 - 2 * (y * y + r.z * r.z));
    }
    if (typeof r.z === "number") {
        return (r.z * Math.PI) / 180;
    }
    return 0;
}

const round1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** The seats and beds the props make: one for each chair or stool, one for each bed, two for a double bed. */
export function spotsOf(props: readonly PropLike[]): Spot[] {
    const found: Spot[] = [];
    for (const prop of props) {
        const kind: SpotKind | null = CHAIR_MODEL.test(prop.model) ? "cadeira" : BED_MODEL.test(prop.model) ? "cama" : null;
        if (kind === null) {
            continue;
        }
        const name = prop.model.split("/").pop() ?? prop.model;
        const sides = kind === "cama" && DOUBLE_BED.test(name) ? [-1, 1] : [0];
        for (const side of sides) {
            found.push({
                id: `${kind}:${name.replace(/\.cgf$/i, "")}@${round1(prop.position.x)},${round1(prop.position.y)}${side === 0 ? "" : `:${side}`}`,
                kind,
                model: prop.model,
                x: prop.position.x,
                y: prop.position.y,
                z: prop.position.z,
                yaw: yawOf(prop.rotation),
                side,
            });
        }
    }
    return found;
}

export interface Pose {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** Degrees, 0 along +Y, counter-clockwise seen from above. */
    readonly heading: number;
}

const toDegrees = (radians: number): number => {
    const degrees = (radians * 180) / Math.PI;
    return ((degrees % 360) + 540) % 360 - 180;
};

/** Where the body is put to sit or lie on a spot, and which way it faces. */
export function poseFor(spot: Spot): Pose {
    const turn = spot.kind === "cadeira" ? tuning.chair.turn : tuning.bed.turn;
    const heading = spot.yaw + (turn * Math.PI) / 180;
    // The way the body faces: forward is +Y at heading 0.
    const fx = -Math.sin(heading);
    const fy = Math.cos(heading);
    if (spot.kind === "cadeira") {
        return { x: spot.x + fx * tuning.chair.forward, y: spot.y + fy * tuning.chair.forward, z: spot.z + tuning.chair.up, heading: toDegrees(heading) };
    }
    // A bed's width is along its own X.
    const sx = Math.cos(spot.yaw);
    const sy = Math.sin(spot.yaw);
    const apart = spot.side * tuning.bed.apart;
    return {
        x: spot.x + sx * apart + fx * tuning.bed.along,
        y: spot.y + sy * apart + fy * tuning.bed.along,
        z: spot.z + tuning.bed.up,
        heading: toDegrees(heading),
    };
}

/** Where a player who gets up from a bed is put: on the floor beside it, on their own side. */
export function getOffPoint(spot: Spot): { x: number; y: number; z: number } {
    const sx = Math.cos(spot.yaw);
    const sy = Math.sin(spot.yaw);
    // Past the edge of the widest bed we have (a double one is 1.46 m across).
    const out = (spot.side === 0 ? 1 : spot.side) * 1.3;
    return { x: spot.x + sx * out, y: spot.y + sy * out, z: spot.z + 0.05 };
}

export function distanceTo(spot: { x: number; y: number }, position: { x: number; y: number }): number {
    return Math.hypot(spot.x - position.x, spot.y - position.y);
}

// ---------------------------------------------------------------------------------------------------------------------
// The spots, and who is on them.

let spots: Spot[] = [];

interface Session {
    readonly spot: Spot;
    phase: "placing" | "on";
    startedAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    /** Times the body was put back on the seat after the game moved it. */
    drifts: number;
}

const sessions = new Map<number, Session>();
/** Spot id -> the player on it. */
const occupant = new Map<string, number>();

export function setSpots(list: readonly Spot[]): void {
    spots = [...list];
    sessions.clear();
    occupant.clear();
}

export function allSpots(): readonly Spot[] {
    return spots;
}

export function occupantOf(spotId: string): number | null {
    return occupant.get(spotId) ?? null;
}

/** The spots of a kind about a point, each once per piece (a double bed shows as one), for the client's hint: kind, x, y, z. */
export function spotPointsWithin(position: { x: number; y: number }, radius: number): Array<[number, number, number, number]> {
    const seen = new Set<string>();
    const points: Array<[number, number, number, number]> = [];
    for (const spot of spots) {
        if (distanceTo(spot, position) > radius) {
            continue;
        }
        const piece = `${spot.kind}@${round1(spot.x)},${round1(spot.y)}`;
        if (seen.has(piece)) {
            continue;
        }
        seen.add(piece);
        points.push([FURNITURE_KIND_INDEX[spot.kind], spot.x, spot.y, spot.z]);
    }
    return points;
}

/** The free spot of this kind a player asked for: the piece at the point they were aimed at, else the nearest within reach. */
export function pickSpot(kind: SpotKind, position: { x: number; y: number; z: number }, aimed: { x: number; y: number } | null, isOnline: (playerId: number) => boolean): Spot | null {
    let best: Spot | null = null;
    let bestDistance = Infinity;
    for (const spot of spots) {
        if (spot.kind !== kind || Math.abs(spot.z - position.z) > REACH_HEIGHT_M + (kind === "cama" ? 1 : 0)) {
            continue;
        }
        const near = distanceTo(spot, position);
        if (near > (kind === "cama" ? BED_REACH_M : REACH_M)) {
            continue;
        }
        const holder = occupant.get(spot.id);
        if (holder !== undefined && isOnline(holder)) {
            continue;
        }
        // The piece the hint was on, when the client said; else the nearest.
        const score = aimed === null ? near : Math.hypot(spot.x - aimed.x, spot.y - aimed.y);
        if (aimed !== null && score > AIM_TOLERANCE_M) {
            continue;
        }
        if (score < bestDistance) {
            bestDistance = score;
            best = spot;
        }
    }
    return best;
}

export function sessionOf(playerId: number): { readonly spot: Spot; readonly phase: "placing" | "on" } | null {
    const session = sessions.get(playerId);
    return session === undefined ? null : { spot: session.spot, phase: session.phase };
}

// ---------------------------------------------------------------------------------------------------------------------
// Sitting and lying: the game's own animations.

const FRAGMENTS: Readonly<Record<SpotKind, readonly string[]>> = {
    // The game's sitting loops, the plain one first; and its lying, the plain one first.
    cadeira: ["Sitting", "SittingIdle"],
    cama: ["Lying", "LyingVar"],
};

const chosen = new Map<SpotKind, string>();

/** The fragment to play for a kind: the first of the list the catalog knows, else the first by name. Written to the log once. */
export function fragmentFor(kind: SpotKind): string {
    const known = chosen.get(kind);
    if (known !== undefined) {
        return known;
    }
    let pick = FRAGMENTS[kind][0] as string;
    try {
        for (const name of FRAGMENTS[kind]) {
            if (Animations.list(name).some((row) => row.fragment.toLowerCase() === name.toLowerCase())) {
                pick = name;
                break;
            }
        }
        console.log(`furniture: ${kind === "cadeira" ? "sentado" : "deitado"} toca '${pick}' (o catálogo tem ${Animations.list(pick).length} linha(s) com esse nome)`);
    } catch (error: unknown) {
        console.log(`furniture: não consegui consultar o catálogo de animações (${error instanceof Error ? error.message : String(error)}); toco '${pick}' pelo nome`);
    }
    chosen.set(kind, pick);
    return pick;
}

const isOnline = (playerId: number): boolean => Player.all().some((player) => player.id === playerId);

function forget(playerId: number): Session | null {
    const session = sessions.get(playerId);
    if (session === undefined) {
        return null;
    }
    if (session.timer !== null) {
        clearTimeout(session.timer);
    }
    sessions.delete(playerId);
    if (occupant.get(session.spot.id) === playerId) {
        occupant.delete(session.spot.id);
    }
    fatiguePace.hold(playerId, null);
    return session;
}

export interface UseResult {
    readonly ok: boolean;
    readonly message: string;
}

/** A player pressed the key at a seat or a bed. `aimed` is the point the client's hint was on, when it said. */
export function useSpot(player: Player, kind: SpotKind, aimed: { x: number; y: number } | null, now = Date.now()): UseResult {
    if (!player.ready || !player.alive || player.steamId === "") {
        return { ok: false, message: "" };
    }
    const here = sessions.get(player.id);
    if (here !== undefined) {
        // The key again, while on one: up.
        if (here.phase === "on" && now - here.startedAt >= STAND_GRACE_MS) {
            standUp(player, "tecla");
        }
        return { ok: true, message: "" };
    }
    const spot = pickSpot(kind, player.position, aimed, isOnline);
    if (spot === null) {
        return { ok: false, message: kind === "cadeira" ? "Essa cadeira já está ocupada." : "Essa cama já está ocupada." };
    }
    const pose = poseFor(spot);
    const session: Session = { spot, phase: "placing", startedAt: now, timer: null, drifts: 0 };
    session.timer = setTimeout(() => {
        const live = sessions.get(player.id);
        if (live === session && session.phase === "placing") {
            forget(player.id);
            console.log(`furniture: ${player.nickname}: o corpo não chegou em ${spot.id} a tempo; desisti`);
        }
    }, PLACE_WAIT_MS);
    sessions.set(player.id, session);
    occupant.set(spot.id, player.id);
    // The body is put there by the server (2026-10-20): the client's own move of its body was undone by the game, which took it
    // back to where the player had stood when the key was pressed (the client log: 0.5 to 2.1 m off the seat, put back three
    // times and back each time, before any animation).
    if (!putBody(player, pose)) {
        forget(player.id);
        return { ok: false, message: "Não consegui pôr você ali agora. Tente de novo." };
    }
    player.emit(`${RESOURCE}:furniture.pose`, JSON.stringify({ x: pose.x, y: pose.y, z: pose.z, heading: pose.heading, kind }));
    return { ok: true, message: "" };
}

/** Puts a player's body somewhere and turns it: the game's own spawn, which moves the body the way a respawn does, else a teleport. */
export function putBody(player: Player, pose: { readonly x: number; readonly y: number; readonly z: number; readonly heading: number }): boolean {
    try {
        const at = new Vector3(pose.x, pose.y, pose.z);
        return player.spawn(at, new Vector3(0, 0, pose.heading)) || player.teleport(at);
    } catch (error: unknown) {
        console.log(`furniture: ${player.nickname}: o jogo não aceitou mover o corpo para ${round1(pose.x)}, ${round1(pose.y)}, ${round1(pose.z)}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** The client says the body is on the seat or the bed, and the server's own view of where it is goes to the log. */
function seen(player: Player, spot: Spot): string {
    try {
        return `${round1(distanceTo(spot, player.position))} m do assento, no servidor`;
    } catch {
        return "posição não lida";
    }
}

/** The body is no longer where it was put, the animation having begun: it is put back, a few times at most. */
export function driftBack(player: Player): void {
    const session = sessions.get(player.id);
    if (session === undefined || session.phase !== "on" || session.drifts >= MAX_DRIFTS) {
        return;
    }
    session.drifts += 1;
    const ok = putBody(player, poseFor(session.spot));
    console.log(`furniture: ${player.nickname} saiu do assento depois de ${session.spot.kind === "cama" ? "deitar" : "sentar"} (${seen(player, session.spot)}); posto de novo (${session.drifts}/${MAX_DRIFTS})${ok ? "" : ": o jogo recusou"}`);
}

/** The body did not arrive on the seat in the time the client waits: nothing is played, the place is freed. */
export function placingFailed(player: Player): void {
    const session = sessions.get(player.id);
    if (session === undefined || session.phase !== "placing") {
        return;
    }
    forget(player.id);
    Chat.sendToPlayer(player, "Não consegui acomodar você ali. Tente de novo em instantes.");
    console.log(`furniture: ${player.nickname}: o corpo não chegou em ${session.spot.id} (${seen(player, session.spot)}); desisti`);
}

/** The client has put the body on the spot: the animation goes on. */
export function placed(player: Player, now = Date.now()): void {
    const session = sessions.get(player.id);
    if (session === undefined || session.phase !== "placing") {
        return;
    }
    if (session.timer !== null) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    const kind = session.spot.kind;
    const fragment = fragmentFor(kind);
    let started = false;
    lowerTorch(player);
    try {
        started = player.playAnimation(fragment, { loop: true, lockMovement: true });
    } catch (error: unknown) {
        console.log(`furniture: ${player.nickname}: o jogo não aceitou '${fragment}': ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!started) {
        forget(player.id);
        Chat.sendToPlayer(player, "O jogo não deixou você ficar assim agora. Tente de novo em instantes.");
        return;
    }
    // Phase and clock restart here: the grace for the movement keys counts from the animation.
    session.startedAt = now;
    session.phase = "on";
    fatiguePace.hold(player.id, kind === "cama" ? "lying" : "sitting");
    player.emit(`${RESOURCE}:furniture.state`, JSON.stringify({ on: true, kind }));
    console.log(`furniture: ${player.nickname} ${kind === "cama" ? "deitou" : "sentou"} em ${session.spot.id} (${seen(player, session.spot)})`);
}

/** The player gets up: the animation ends, the tiredness goes back to what they do, and from a bed they are put beside it. */
export function standUp(player: Player, why: string): boolean {
    const session = forget(player.id);
    if (session === null) {
        return false;
    }
    try {
        player.stopAnimation({ standUp: true });
    } catch {
        // The body is gone or the game already ended it.
    }
    player.emit(`${RESOURCE}:furniture.state`, JSON.stringify({ on: false, kind: session.spot.kind }));
    if (session.spot.kind === "cama" && session.phase === "on") {
        // Beside the bed, on the floor: the server moves the body (the client's own move of it does not hold).
        const off = getOffPoint(session.spot);
        try {
            player.teleport(new Vector3(off.x, off.y, off.z));
        } catch (error: unknown) {
            console.log(`furniture: ${player.nickname}: o jogo não aceitou pôr o corpo ao lado da cama: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    console.log(`furniture: ${player.nickname} levantou de ${session.spot.id} (${why})`);
    return true;
}

/** What the game did to the body's animation: cut by a hit or another animation, or refused. */
export function animationEnded(player: Player, reason: string): void {
    const session = sessions.get(player.id);
    if (session === undefined || session.phase !== "on") {
        return;
    }
    if (reason === "stopped") {
        return;
    }
    const gone = forget(player.id);
    if (gone !== null) {
        player.emit(`${RESOURCE}:furniture.state`, JSON.stringify({ on: false, kind: gone.spot.kind }));
        console.log(`furniture: ${player.nickname} saiu de ${gone.spot.id} (a animação terminou: ${reason})`);
    }
}

export function release(playerId: number): void {
    forget(playerId);
}

// ---------------------------------------------------------------------------------------------------------------------
// The tuning, kept between restarts.

const TUNING_FIELDS: Readonly<Record<string, readonly [group: "chair" | "bed", key: string]>> = {
    "cadeira-frente": ["chair", "forward"],
    "cadeira-altura": ["chair", "up"],
    "cadeira-giro": ["chair", "turn"],
    "cama-altura": ["bed", "up"],
    "cama-cabeceira": ["bed", "along"],
    "cama-giro": ["bed", "turn"],
    "cama-lado": ["bed", "apart"],
};

export const tuningFields = (): string[] => Object.keys(TUNING_FIELDS);

export function tuningLines(): string[] {
    return Object.entries(TUNING_FIELDS).map(([name, [group, key]]) => `${name} = ${(tuning[group] as Record<string, number>)[key]}`);
}

export function setTuning(name: string, value: number): string {
    const field = TUNING_FIELDS[name];
    if (field === undefined) {
        return `Não conheço '${name}'. Os ajustes: ${tuningFields().join(", ")}.`;
    }
    if (!Number.isFinite(value) || Math.abs(value) > 360) {
        return "O valor tem de ser um número (metros, ou graus no giro).";
    }
    (tuning[field[0]] as Record<string, number>)[field[1]] = value;
    write(TUNING_FILE, tuning);
    return `${name} = ${value}. Quem já está sentado ou deitado levanta e tenta de novo para ver.`;
}

function loadTuning(): void {
    const result = read<unknown>(TUNING_FILE);
    if (result.status !== "ok" || typeof result.value !== "object" || result.value === null) {
        return;
    }
    const saved = result.value as { chair?: Record<string, unknown>; bed?: Record<string, unknown> };
    for (const group of ["chair", "bed"] as const) {
        for (const [key, value] of Object.entries(saved[group] ?? {})) {
            if (typeof value === "number" && Number.isFinite(value) && key in tuning[group]) {
                (tuning[group] as Record<string, number>)[key] = value;
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// The chests.

interface SavedRow {
    item: string;
    amount: number;
    metadata: Record<string, unknown>;
}

const SAVE_DELAY_MS = 3_000;

/** A chest's key in the file: its mesh and place, which an export keeps. */
export function chestKey(prop: PropLike): string {
    const name = (prop.model.split("/").pop() ?? prop.model).replace(/\.cgf$/i, "");
    return `${name}@${round1(prop.position.x)},${round1(prop.position.y)},${round1(prop.position.z)}`;
}

/** Whether the file of chests could be read: when it could not, nothing is written over it. */
let chestFileBlocked = false;
const chestsByStash = new Map<number, string>();
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
let savedChests: Record<string, SavedRow[]> = {};

function loadChests(): void {
    const result = read<unknown>(CHESTS_FILE);
    if (result.status === "ok" && typeof result.value === "object" && result.value !== null) {
        savedChests = (result.value as { chests?: Record<string, SavedRow[]> }).chests ?? {};
    } else if (result.status === "corrupt") {
        chestFileBlocked = true;
        console.error(`furniture: ${CHESTS_FILE} não pôde ser lido (${result.reason}); os baús começam vazios e o arquivo não será sobrescrito`);
    }
}

const rowsOf = (stash: Stash): SavedRow[] | null => {
    const inventory = stash.getInventory();
    return inventory === null ? null : inventory.items.map((row) => ({ item: row.item, amount: row.amount, metadata: (row.metadata ?? {}) as Record<string, unknown> }));
};

function saveChest(key: string, stash: Stash): void {
    if (chestFileBlocked) {
        return;
    }
    const rows = rowsOf(stash);
    if (rows === null) {
        return;
    }
    if (rows.length === 0) {
        delete savedChests[key];
    } else {
        savedChests[key] = rows;
    }
    write(CHESTS_FILE, { v: 1, savedAt: Date.now(), chests: savedChests });
}

/** How far in front of a chest the body that opens it stands, and how near the walkable ground must be there. */
export const CHEST_FRONT_M = 0.9;
const CHEST_FRONT_SLACK_M = 0.35;

/**
 * Whether a body can stand in front of a chest to open it. The game offers a chest only to a body behind its `useDirection`,
 * looking along it (the guide: stand at `position - useDirection * distance`); a chest put at the foot of a bed with its front to
 * the bed could never be opened (user, 2026-10-19: "os baús que colocamos ... não tem como interagir"). Null when it cannot be said.
 */
export function frontIsFree(
    stash: { readonly position: { x: number; y: number; z: number }; readonly useDirection?: { x: number; y: number } },
    obstacles: ReadonlyArray<Obstacle> = [],
): boolean | null {
    const along = stash.useDirection;
    if (along === undefined || !Number.isFinite(along.x) || !Number.isFinite(along.y) || Math.hypot(along.x, along.y) < 0.5) {
        return null;
    }
    const stand = { x: stash.position.x - along.x * CHEST_FRONT_M, y: stash.position.y - along.y * CHEST_FRONT_M, z: stash.position.z };
    // The World Builder's own pieces are not in the level's walkable mesh: a bed is looked for by its place and size.
    if (obstacles.some((one) => Math.abs(one.z - stand.z) < 2 && Math.hypot(one.x - stand.x, one.y - stand.y) < one.r)) {
        return false;
    }
    if (!Navigation.ready) {
        return null;
    }
    const ground = Navigation.closestPoint(new Vector3(stand.x, stand.y, stand.z), { searchRadius: 0.6, searchHeight: 1.5, doors: "none" });
    return ground !== null && Math.hypot(ground.x - stand.x, ground.y - stand.y) <= CHEST_FRONT_SLACK_M;
}

/**
 * Whether a piece of the exports (a bed, a table) stands where the opener of a chest would: in front of it (`side` 1) or behind
 * it (`side` -1, where its front would be turned round). Only the exports' own pieces count: the level's walkable mesh said "no
 * ground" in front of the Raborsch bed's chest whichever way it faced, and turned it back to the bed at the next start
 * (2026-10-20). Null when the chest has no direction.
 */
export function frontBlocked(
    stash: { readonly position: { x: number; y: number; z: number }; readonly useDirection?: { x: number; y: number } },
    obstacles: ReadonlyArray<Obstacle>,
    side: 1 | -1 = 1,
): boolean | null {
    const along = stash.useDirection;
    if (along === undefined || !Number.isFinite(along.x) || !Number.isFinite(along.y) || Math.hypot(along.x, along.y) < 0.5) {
        return null;
    }
    const stand = { x: stash.position.x - side * along.x * CHEST_FRONT_M, y: stash.position.y - side * along.y * CHEST_FRONT_M, z: stash.position.z };
    return obstacles.some((one) => Math.abs(one.z - stand.z) < 2 && Math.hypot(one.x - stand.x, one.y - stand.y) < one.r);
}

/** A piece of furniture of the exports, as something a body cannot stand in: its middle and a radius. */
export interface Obstacle {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly r: number;
}

/** What a body cannot stand in among the exports' pieces: beds, tables, chairs and chests, by their sizes. */
export function obstaclesOf(props: readonly PropLike[]): Obstacle[] {
    const out: Obstacle[] = [];
    for (const prop of props) {
        const model = prop.model.toLowerCase();
        const r = BED_MODEL.test(model) ? (DOUBLE_BED.test(model) ? 1.3 : 1.05) : /\/tables?\/|table_/.test(model) ? 0.9 : CHAIR_MODEL.test(model) ? 0.35 : CHEST_MODEL.test(model) ? 0.4 : 0;
        if (r > 0) {
            out.push({ x: prop.position.x, y: prop.position.y, z: prop.position.z, r });
        }
    }
    return out;
}

/** Makes a container of a chest prop and puts its saved things back; the bare prop goes. False when the game refused. */
function spawnChest(prop: Prop, obstacles: readonly Obstacle[] = []): boolean {
    const others = obstacles.filter((one) => Math.hypot(one.x - prop.position.x, one.y - prop.position.y) > 0.05);
    const at = new Vector3(prop.position.x, prop.position.y, prop.position.z);
    let stash: Stash;
    try {
        stash = Stash.spawn(at, prop.rotation, undefined, { model: prop.model });
    } catch (error: unknown) {
        console.log(`furniture: não consegui fazer um baú de ${prop.model} em ${round1(prop.position.x)}, ${round1(prop.position.y)}: ${error instanceof Error ? error.message : String(error)}; o modelo fica como estava`);
        return false;
    }
    // Its front against a bed or a table of the exports, and its back free: turned round, so that somebody can stand before it.
    // Both sides are judged on the chest as it was made (a chest just made turned may not say its direction yet).
    if (frontBlocked(stash, others, 1) === true) {
        if (frontBlocked(stash, others, -1) === false) {
            const turned = (yawOf(prop.rotation) * 180) / Math.PI + 180;
            try {
                const again = Stash.spawn(at, new Vector3(0, 0, turned), undefined, { model: prop.model });
                stash.destroy();
                stash = again;
                console.log(`furniture: o baú em ${round1(prop.position.x)}, ${round1(prop.position.y)} estava de frente para um móvel e foi virado para o lado livre`);
            } catch (error: unknown) {
                console.log(`furniture: não consegui virar o baú em ${round1(prop.position.x)}, ${round1(prop.position.y)}: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else {
            console.log(`furniture: o baú em ${round1(prop.position.x)}, ${round1(prop.position.y)} tem móveis na frente e atrás; fica como estava`);
        }
    }
    const key = chestKey(prop);
    chestsByStash.set(stash.id, key);
    const rows = savedChests[key];
    if (rows !== undefined && rows.length > 0) {
        const whole = stash.setInventory({ items: rows.map((row) => ({ item: row.item, amount: row.amount, metadata: row.metadata })) });
        if (!whole.ok) {
            chestFileBlocked = true;
            console.error(`furniture: o baú ${key} recusou o conteúdo salvo (${whole.code}); o arquivo foi deixado como está`);
        }
    }
    try {
        prop.destroy();
    } catch {
        // Already gone.
    }
    return true;
}

// ---------------------------------------------------------------------------------------------------------------------

/** Learns the furniture from the World Builder exports, once they have loaded (they load after the scripts start). */
export function installFurniture(): void {
    ensureDir("playerdata");
    loadTuning();
    loadChests();

    const learn = (): void => {
        let props: Prop[] = [];
        try {
            props = WorldResource.all().flatMap((world) => world.props);
        } catch (error: unknown) {
            console.log(`furniture: as exportações do World Builder não puderam ser lidas: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        setSpots(spotsOf(props));
        const obstacles = obstaclesOf(props);
        let chests = 0;
        for (const prop of props) {
            if (CHEST_MODEL.test(prop.model) && spawnChest(prop, obstacles)) {
                chests += 1;
            }
        }
        const chairs = spots.filter((spot) => spot.kind === "cadeira").length;
        const beds = spots.filter((spot) => spot.kind === "cama").length;
        console.log(`furniture: ${chairs} cadeira(s), ${beds} lugar(es) de cama e ${chests} baú(s) das exportações do World Builder funcionam (baús abrem, cadeiras e camas aceitam o jogador)`);
    };
    if (WorldResource.ready) {
        learn();
    } else {
        Events.once("worldResourcesReady", learn);
    }

    Events.onClient(`${RESOURCE}:furniture.posed`, (sender) => placed(sender as Player));
    Events.onClient(`${RESOURCE}:furniture.failed`, (sender) => placingFailed(sender as Player));
    Events.onClient(`${RESOURCE}:furniture.drift`, (sender) => driftBack(sender as Player));
    Events.onClient(`${RESOURCE}:furniture.stand`, (sender) => {
        standUp(sender as Player, "pedido");
    });
    Events.on("playerAnimationEnd", (player, _fragment, reason) => animationEnded(player, reason));
    Events.on("playerDisconnect", (player) => release(player.id));
    Events.on("playerDied", (player) => {
        if (sessions.has(player.id)) {
            release(player.id);
        }
    });

    Events.on("stashInventoryChanged", (stash) => {
        const key = chestsByStash.get(stash.id);
        if (key === undefined || pendingSaves.has(key)) {
            return;
        }
        pendingSaves.set(
            key,
            setTimeout(() => {
                pendingSaves.delete(key);
                const live = Stash.getById(stash.id);
                if (live !== null) {
                    saveChest(key, live);
                }
            }, SAVE_DELAY_MS),
        );
    });
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        for (const [id, key] of chestsByStash) {
            const timer = pendingSaves.get(key);
            if (timer === undefined) {
                continue;
            }
            clearTimeout(timer);
            pendingSaves.delete(key);
            const live = Stash.getById(id);
            if (live !== null) {
                saveChest(key, live);
            }
        }
    });
}
