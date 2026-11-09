/**
 * Carts and wagons that belong to players, and those left standing in the world for everybody (see "World carts" below).
 * (user, 2026-10-17: "tornar as carroças funcionais e integradas ao sistema de
 * propriedades ... interagir com a carroça utilizando a tecla E, escolher o assento ... permanecer salva no mundo ... dar um nome ...
 * o brasão da carroça").
 *
 * A cart is a player's once an administrator gives one to them (`/carroca dar`) or registers the one that stands beside them
 * (`/carroca registrar`), as a horse is (`horses.ts`). From then on it stays where it was left across disconnects and
 * restarts, in `playerdata/carts.json`, and the owner names it, brings it to where they stand and reads where it is in the
 * "Animais" section of the panel. A player has at most two.
 *
 * Getting on: a player near a cart (within 6 m of its body) is shown the game's own "[E] Subir na carroça" hint (`src/client/carts.ts`,
 * told by `cart.near`), and E asks for the seats on the game's dialogue list: the reins, the bench beside them, the rails,
 * each shown taken or free; and "Descer" when they are already on. The game's own prompt at a bench or a rail still works
 * and reaches the same rule (`cartEntering`): the reins of a cart that has an owner are the owner's (and an administrator's);
 * everybody else rides as a passenger. A cart nobody owns, one an administrator put there with `/cart`, takes anybody anywhere.
 */

import { isAdmin } from "./auth.js";
import { yawOf } from "./position.js";
import { ensureDir, read, write } from "./store.js";
import { allowedTo, EDGE_M, reachTo } from "./reach.js";

const DIR = "playerdata";
const FILE = `${DIR}/carts.json`;
const RESOURCE = "kcdc-gamemode";

export const CART_NAME_MIN = 2;
export const CART_NAME_MAX = 24;

/** How many carts a player may own. */
export const MAX_CARTS = 2;

/**
 * World carts (user, 2026-10-18: "as carroças sumiram do mundo"): the carts an administrator puts down with `/cart` are the
 * game's own and are gone at every restart, and nobody had ever been given one (`carts.json` was empty). `/carroca colocar`
 * leaves a cart that is nobody's and everybody's, kept in the same file with an owner of "" and put back where it stood after
 * each restart. This many at most.
 */
export const MAX_WORLD_CARTS = 40;

/**
 * How near a cart a player is asked about its seats, and how near they must still be when they choose, from the cart's BODY: a cart
 * is not a point (`cart.position` is its front axle, and a wagon runs some six metres behind it, the nomad wagon longer). Measured from
 * the axle alone, a player who climbed down at the back stood out of reach of their own wagon and the "[E] Subir na carroça" never
 * came back (user, 2026-10-18 night: "só dá para usar uma vez; ao descer não tem como subir de novo", mended by a longer reach
 * from the axle; and 2026-10-20: "andei na carroça de um amigo como admin, depois que larguei ela, ao chegar perto o E não apareceu
 * para entrar"). Now the distance is to the body itself, the stretch of its heading from the tail to just past the driver's bench
 * (`BODY_BACK_M`, `BODY_FRONT_M`). The first try measured to five points along it, 6 m from the nearest, which reached 12 m from the
 * axle and offered the seats to players who were nowhere near (2026-10-21: "carroças está dando para interagir de muito distante"):
 * the reach is now 3.5 m from the body, and 5 m still to choose a seat.
 */
export const NEAR_M = reachTo(EDGE_M.cart);
/** What an E at a cart is believed from: the prompt's reach and a metre more (`reach.ts`, 2026-10-22). */
export const PRESS_M = allowedTo(EDGE_M.cart);
export const CHOOSE_M = 5;

/** The body of a cart along its heading, from the front axle (ahead is positive, where the horses are): the tail and the driver's bench. */
export const BODY_BACK_M = 5.5;
export const BODY_FRONT_M = 1.5;

/** The tail of the longer wagons (the nomads' carpet wagon, `wagon_a_*`, which runs well past a covered one's 5.5 m), by the start of the prefab's name. */
export const BODY_BACK_BY: ReadonlyArray<readonly [prefix: string, back: number]> = [["wagon_a", 8]];

export function bodyBackOf(blueprint: string): number {
    return BODY_BACK_BY.find(([prefix]) => blueprint.startsWith(prefix))?.[1] ?? BODY_BACK_M;
}

/**
 * The player's own game sees a cart where it really is (2026-11-02, user: "o Jaromir tem uma carroça mas toda hora que ele para ele precisa chamar a carroça pelo botão, porque bugou e não
 * consegue subir nela de novo"). The server's sight of a cart that was driven can lag behind it (where it stopped, and which way it turned), and "[E] Subir na carroça" was offered by that
 * sight alone: a player beside the real wagon was too far from the server's, and only "Trazer", which puts the cart where the server knows it, let them on again. So each player is also
 * told of the carts round them (`AROUND_M`, the nearest `AROUND_MAX`, with the length of each one's body), their client measures itself against the cart it sees, and an E it sends for one is
 * believed within `TRUST_M` of the server's sight (the gap written to the log, to see how far behind the server was).
 */
export const AROUND_M = 40;
export const AROUND_MAX = 3;
export const TRUST_M = 25;

/**
 * A player the server still has on a cart that is this far from them is not on it (teleported by an administrator, or let out by the
 * game unheard): they are let out, so the seat is free and the hint comes back.
 */
export const STALE_SEAT_M = 30;

/**
 * Carts of the server's own services (the coaches of `travel.ts`), by id, with what a player who tries to get on one is told:
 * nobody gets on one, nobody registers one, and no "[E] Subir na carroça" is offered beside one.
 */
export const reservedCarts = new Map<number, () => string>();

/** A player beside a cart is told so again this often, so a hint the game took down comes back. */
export const NEAR_AGAIN_MS = 5_000;

/** `/carroca trazer` puts the cart this far in front of the owner, and no more often than this. */
export const BRING_DISTANCE_M = 9;
export const BRING_COOLDOWN_MS = 2 * 60_000;

const SAVE_EVERY_MS = 60_000;
const NEAR_EVERY_MS = 1_000;
const STEAM_ID = /^[0-9]{5,20}$/;

/** What each seat is called to a player. */
export const SEAT_NAMES: Readonly<Record<string, string>> = {
    driver: "Condutor, nas rédeas",
    bench: "Banco, ao lado do condutor",
    rightFront: "Beira direita, na frente",
    leftFront: "Beira esquerda, na frente",
    rightBack: "Beira direita, atrás",
    leftBack: "Beira esquerda, atrás",
};

/** What each prefab is called to a player. A prefab not listed goes by its own name. */
export const BLUEPRINT_NAMES: Readonly<Record<string, string>> = {
    wagon_b_covered: "Carroça coberta",
    wagon_b_covered_empty: "Carroça coberta, vazia",
    cart_b: "Carro de duas rodas",
    wagon_b: "Carroça aberta",
    wagon_a_cloth_carpets: "Carroça de tapetes",
};

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

export interface SavedCart {
    key: string;
    owner: string;
    ownerName: string;
    blueprint: string;
    name: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    savedAt: number;
    /** Left free by its owner (user, 2026-10-17): anybody may get on, and take the reins. Otherwise only the owner (and an administrator) does. */
    shared?: boolean;
}

export interface OwnedCart {
    readonly record: SavedCart;
    readonly cart: Cart | null;
}

const records = new Map<string, SavedCart>();
const liveByKey = new Map<string, number>();
const keyByLive = new Map<number, string>();
const broughtAt = new Map<string, number>();
let stopping = false;
let counter = 0;
let lastWritten = "";

export const cartName = (blueprint: string): string => BLUEPRINT_NAMES[blueprint] ?? blueprint;

function newKey(): string {
    counter += 1;
    return `c${Date.now().toString(36)}${counter.toString(36)}`;
}

function persist(): void {
    const list = [...records.values()].map(({ savedAt: _savedAt, ...rest }) => rest);
    const text = JSON.stringify(list);
    if (text === lastWritten) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, carts: [...records.values()] });
        lastWritten = text;
    } catch (error: unknown) {
        console.log(`carts: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function isRecord(value: unknown): value is SavedCart {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const r = value as Partial<SavedCart>;
    return typeof r.key === "string" && typeof r.owner === "string" && typeof r.blueprint === "string" && typeof r.name === "string" && [r.x, r.y, r.z, r.yaw].every((n) => typeof n === "number" && Number.isFinite(n));
}

function load(): void {
    const loaded = read<{ carts?: unknown[] }>(FILE);
    if (loaded.status === "corrupt") {
        console.error(`carts: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
        return;
    }
    if (loaded.status !== "ok" || !Array.isArray(loaded.value.carts)) {
        return;
    }
    for (const raw of loaded.value.carts) {
        if (isRecord(raw)) {
            records.set(raw.key, { ...raw, ownerName: typeof raw.ownerName === "string" ? raw.ownerName : "", savedAt: typeof raw.savedAt === "number" ? raw.savedAt : 0 });
        }
    }
    lastWritten = JSON.stringify([...records.values()].map(({ savedAt: _savedAt, ...rest }) => rest));
}

function link(key: string, cart: Cart): void {
    liveByKey.set(key, cart.id);
    keyByLive.set(cart.id, key);
}

function unlink(key: string): void {
    const id = liveByKey.get(key);
    if (id !== undefined) {
        keyByLive.delete(id);
    }
    liveByKey.delete(key);
}

function snapshot(cart: Cart, record: SavedCart): void {
    record.x = cart.position.x;
    record.y = cart.position.y;
    record.z = cart.position.z;
    record.yaw = yawOf(cart.rotation);
    record.savedAt = Date.now();
}

function spawnSaved(record: SavedCart): boolean {
    try {
        const cart = Cart.spawn(record.blueprint, { x: record.x, y: record.y, z: record.z }, new Vector3(0, 0, record.yaw));
        link(record.key, cart);
        return true;
    } catch (error: unknown) {
        console.error(`carts: não consegui trazer de volta a carroça ${record.key} de ${record.ownerName}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export function cartsOf(steamId: string): OwnedCart[] {
    // Nobody owns the world's carts: a player without a Steam id is not their owner (they showed up in an administrator's Animais).
    if (steamId === "") {
        return [];
    }
    return [...records.values()]
        .filter((record) => record.owner === steamId)
        .map((record) => {
            const id = liveByKey.get(record.key);
            return { record, cart: id === undefined ? null : Cart.getById(id) };
        });
}

export function allCarts(): OwnedCart[] {
    return [...records.values()].map((record) => {
        const id = liveByKey.get(record.key);
        return { record, cart: id === undefined ? null : Cart.getById(id) };
    });
}

/** The record of the cart with this network id, if somebody owns it. */
export function recordOfCart(cart: Cart): SavedCart | null {
    const key = keyByLive.get(cart.id);
    return key === undefined ? null : (records.get(key) ?? null);
}

/**
 * Whether `player` may get on `cart`, in any seat, and take the reins: a cart nobody owns, the owner's, an administrator's,
 * or one its owner left free ("livre", in the panel's Animais section). A locked cart is the owner's alone.
 */
export function mayDrive(player: Player, cart: Cart): boolean {
    const record = recordOfCart(cart);
    return record === null || record.owner === "" || record.owner === player.steamId || record.shared === true || isAdmin(player);
}

/** Gives a cart of `steamId`'s to another player (the panel's Animais, "Dar"): theirs from then on, where it stands, locked to them. */
export function giveCartTo(steamId: string, key: string, target: Player): Outcome {
    const record = records.get(key);
    if (steamId === "" || record === undefined || record.owner !== steamId) {
        return { ok: false, message: "Essa carroça não é sua." };
    }
    if (target.steamId === steamId) {
        return { ok: false, message: "Essa carroça já é sua." };
    }
    if (!STEAM_ID.test(target.steamId)) {
        return { ok: false, message: `${target.nickname} entrou sem identificação Steam: não há como guardar a carroça para ele.` };
    }
    if (cartsOf(target.steamId).length >= MAX_CARTS) {
        return { ok: false, message: `${target.nickname} já tem ${MAX_CARTS} carroças, o máximo.` };
    }
    const label = record.name !== "" ? record.name : cartName(record.blueprint);
    const from = record.ownerName;
    record.owner = target.steamId;
    record.ownerName = target.nickname;
    delete record.shared;
    persist();
    console.log(`carts: ${from} deu a carroça ${record.name || record.key} a ${target.nickname}`);
    return { ok: true, message: `${label} agora é de ${target.nickname}.` };
}

/** Leaves a cart of `steamId`'s free for anybody to ride and drive, or locks it again. */
export function setCartShared(steamId: string, key: string, shared: boolean): Outcome {
    const record = records.get(key);
    if (steamId === "" || record === undefined || record.owner !== steamId) {
        return { ok: false, message: "Essa carroça não é sua." };
    }
    if (shared) {
        record.shared = true;
    } else {
        delete record.shared;
    }
    persist();
    const label = record.name !== "" ? record.name : cartName(record.blueprint);
    return { ok: true, message: shared ? `${label} está livre: qualquer jogador pode subir e conduzir.` : `${label} está trancada: só você sobe nela.` };
}

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** In front of the player, as `/cart` puts one: broadside to them, a little beyond a horse's reach. */
function frontOf(player: Player, distance: number): { position: Vector3; rotation: Vector3 } {
    const yaw = yawOf(player.rotation);
    const radians = (yaw * Math.PI) / 180;
    const ahead = { x: -Math.sin(radians), y: Math.cos(radians) };
    const from = player.position;
    return { position: new Vector3(from.x + ahead.x * distance, from.y + ahead.y * distance, from.z), rotation: new Vector3(0, 0, yaw + 90) };
}

/** Gives `target` a new cart, spawned in front of them. */
export function giveCart(target: Player, blueprint = "wagon_b_covered"): Outcome {
    if (target.steamId === "" || !STEAM_ID.test(target.steamId)) {
        return { ok: false, message: `${target.nickname} entrou sem identificação Steam: não há como guardar a carroça.` };
    }
    if (!target.ready) {
        return { ok: false, message: `${target.nickname} ainda está entrando no mundo.` };
    }
    if (!Cart.blueprints().includes(blueprint)) {
        return { ok: false, message: `Não existe o modelo '${blueprint}'. /cart list mostra os modelos.` };
    }
    if (cartsOf(target.steamId).length >= MAX_CARTS) {
        return { ok: false, message: `${target.nickname} já tem ${MAX_CARTS} carroças, o máximo.` };
    }
    const place = frontOf(target, BRING_DISTANCE_M - 2);
    const cart = Cart.spawn(blueprint, place.position, place.rotation, target.virtualWorld);
    const record: SavedCart = { key: newKey(), owner: target.steamId, ownerName: target.nickname, blueprint, name: "", x: 0, y: 0, z: 0, yaw: 0, savedAt: 0 };
    snapshot(cart, record);
    records.set(record.key, record);
    link(record.key, cart);
    persist();
    return { ok: true, message: `${cartName(blueprint)} agora é de ${target.nickname}: ela fica onde for deixada, com o nome que ele der, e aparece na seção Animais do painel (F2).` };
}

/** The cart nearest `player` that nobody owns, within `within` metres. */
function loneCartNear(player: Player, within: number): Cart | null {
    let found: Cart | null = null;
    let best = within;
    for (const cart of Cart.all(player.virtualWorld)) {
        const distance = flat(cart.position, player.position);
        if (distance <= best && !keyByLive.has(cart.id) && !reservedCarts.has(cart.id)) {
            best = distance;
            found = cart;
        }
    }
    return found;
}

/** The world's cart (kept in the world for everybody, nobody's) nearest `player`, within `within` metres. */
function worldCartNear(player: Player, within: number): SavedCart | null {
    let found: SavedCart | null = null;
    let best = within;
    for (const record of records.values()) {
        const id = record.owner === "" ? liveByKey.get(record.key) : undefined;
        const cart = id === undefined ? null : Cart.getById(id);
        if (cart !== null && cart.virtualWorld === player.virtualWorld) {
            const distance = flat(cart.position, player.position);
            if (distance <= best) {
                best = distance;
                found = record;
            }
        }
    }
    return found;
}

/**
 * Registers the cart nobody owns that stands beside `target` as theirs: one the level or the world left standing, or, failing that, one
 * an administrator left in the world for everybody (`/carroca colocar`), which stops being the world's and is locked to its new owner
 * (2026-10-20: a cart put in the world and then "given" to Jaromir the Just).
 */
export function registerCart(target: Player): Outcome {
    if (!STEAM_ID.test(target.steamId)) {
        return { ok: false, message: `${target.nickname} entrou sem identificação Steam: não há como guardar a carroça.` };
    }
    if (cartsOf(target.steamId).length >= MAX_CARTS) {
        return { ok: false, message: `${target.nickname} já tem ${MAX_CARTS} carroças, o máximo.` };
    }
    const cart = loneCartNear(target, 15);
    if (cart === null) {
        const world = worldCartNear(target, 15);
        if (world === null) {
            return { ok: false, message: "Nenhuma carroça sem dono a até 15 m de quem vai recebê-la." };
        }
        world.owner = target.steamId;
        world.ownerName = target.nickname;
        delete world.shared;
        persist();
        return { ok: true, message: `${cartName(world.blueprint)}, que era do mundo, agora é de ${target.nickname}.` };
    }
    const record: SavedCart = { key: newKey(), owner: target.steamId, ownerName: target.nickname, blueprint: cart.blueprint, name: "", x: 0, y: 0, z: 0, yaw: 0, savedAt: 0 };
    snapshot(cart, record);
    records.set(record.key, record);
    link(record.key, cart);
    persist();
    return { ok: true, message: `${cartName(cart.blueprint)} agora é de ${target.nickname}.` };
}

/** Lets a cart go: it is nobody's any more -- a world cart, kept where it stands for everybody (`placeCart`). False when it was nobody's already. */
export function releaseCart(key: string): boolean {
    const record = records.get(key);
    if (record === undefined || record.owner === "") {
        return false;
    }
    record.owner = "";
    record.ownerName = "";
    delete record.shared;
    persist();
    return true;
}

/** Whether a record is a world cart (nobody's, everybody's). */
export const isWorldCart = (record: SavedCart): boolean => record.owner === "";

/** Takes a cart out of the world and forgets it, whoever it belonged to. False when no such cart is kept. */
export function removeCart(key: string): boolean {
    if (!records.has(key)) {
        return false;
    }
    const id = liveByKey.get(key);
    // Forgotten first, so that its `cartDestroy` is not taken for a loss.
    records.delete(key);
    unlink(key);
    persist();
    if (id !== undefined) {
        Cart.getById(id)?.destroy();
    }
    return true;
}

/** Leaves a cart standing in front of an administrator, for everybody and for good (it is put back after every restart). */
export function placeCart(admin: Player, blueprint = "wagon_b_covered"): Outcome {
    if (!admin.ready) {
        return { ok: false, message: "Você ainda está entrando no mundo." };
    }
    if (!Cart.blueprints().includes(blueprint)) {
        return { ok: false, message: `Não existe o modelo '${blueprint}'. /cart list mostra os modelos.` };
    }
    if ([...records.values()].filter(isWorldCart).length >= MAX_WORLD_CARTS) {
        return { ok: false, message: `Já são ${MAX_WORLD_CARTS} carroças do mundo, o máximo. /carroca remover tira uma.` };
    }
    const place = frontOf(admin, BRING_DISTANCE_M - 2);
    const cart = Cart.spawn(blueprint, place.position, place.rotation, admin.virtualWorld);
    const record: SavedCart = { key: newKey(), owner: "", ownerName: "", blueprint, name: "", x: 0, y: 0, z: 0, yaw: 0, savedAt: 0 };
    snapshot(cart, record);
    records.set(record.key, record);
    link(record.key, cart);
    persist();
    return { ok: true, message: `${cartName(blueprint)} ficou aqui, para todos: qualquer um sobe nela, e ela volta a este lugar depois de cada reinício. /carroca listar mostra as do mundo; /carroca remover n tira uma.` };
}

/** What the player who was given a cart is told. */
export const cartGiftNote = (giver: string): string => `${giver} deu a você uma carroça. /carroca mostra onde ela está; a seção Animais do painel (F2) a mostra também, e E perto dela escolhe o assento.`;

/** Names a cart of `steamId`'s. An empty name gives it back the plain one. */
export function renameCart(steamId: string, key: string, raw: unknown): Outcome {
    const record = records.get(key);
    if (steamId === "" || record === undefined || record.owner !== steamId) {
        return { ok: false, message: "Essa carroça não é sua." };
    }
    if (typeof raw !== "string") {
        return { ok: false, message: "Isso não é um nome." };
    }
    const name = raw
        .normalize("NFC")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (name !== "" && (name.length < CART_NAME_MIN || name.length > CART_NAME_MAX)) {
        return { ok: false, message: `O nome da carroça precisa ter entre ${CART_NAME_MIN} e ${CART_NAME_MAX} letras.` };
    }
    record.name = name;
    persist();
    return { ok: true, message: name === "" ? "A carroça voltou a ser só uma carroça, sem nome." : `A sua carroça agora se chama ${name}.` };
}

/** Where a cart is, to the one who asks: "aqui, ao seu lado", "a 120 m, a norte". */
export function whereIs(player: Player, cart: Cart | null, direction: (from: { x: number; y: number }, to: { x: number; y: number }) => string): string {
    if (cart === null) {
        return "não está no mundo agora";
    }
    const distance = flat(cart.position, player.position);
    return distance < 8 ? "aqui, ao seu lado" : `a ${distance.toFixed(0)} m, a ${direction(player.position, cart.position)}`;
}

/** Brings the owner's cart (this one, or the nearest) to a spot in front of them, if nobody is on it. `force` skips the wait between two brings (the "Animal preso" button, `animal-stuck.ts`, has its own). */
export function bringCart(player: Player, key: string | null, now = Date.now(), force = false): Outcome {
    const mine = cartsOf(player.steamId).filter((owned) => owned.cart !== null && (key === null || owned.record.key === key));
    mine.sort((a, b) => flat((a.cart as Cart).position, player.position) - flat((b.cart as Cart).position, player.position));
    const owned = mine[0];
    if (owned === undefined || owned.cart === null) {
        return { ok: false, message: key === null ? "Você não tem uma carroça no mundo agora." : "Essa carroça não está no mundo agora." };
    }
    const label = owned.record.name || cartName(owned.record.blueprint);
    if (!player.ready || !player.alive) {
        return { ok: false, message: "Você não pode chamar a carroça agora." };
    }
    if (owned.cart.seats.some((seat) => owned.cart?.getOccupant(seat) !== null)) {
        return { ok: false, message: `${label} está com gente: espere que desçam.` };
    }
    const wait = (broughtAt.get(owned.record.key) ?? -Infinity) + BRING_COOLDOWN_MS - now;
    if (wait > 0 && !force) {
        return { ok: false, message: `${label} acabou de ser trazida: de novo em ${Math.ceil(wait / 60_000)} min.` };
    }
    const place = frontOf(player, BRING_DISTANCE_M);
    if (!owned.cart.teleport(place.position, place.rotation)) {
        return { ok: false, message: `${label} não pôde ser trazida agora.` };
    }
    broughtAt.set(owned.record.key, now);
    snapshot(owned.cart, owned.record);
    persist();
    return { ok: true, message: `${label} está ao seu lado.` };
}

// ---------------------------------------------------------------------------------------------
// Getting on.

/**
 * A cart as one round of looks saw it: where its front axle is and which way it heads. A read of either is a call into the engine, and the round that tells
 * every player of the cart beside them (`tellNear`, every second) measured every player against every cart with six of them each time (2026-10-25, the
 * round of the perf-watch survey): now a cart is looked at once for the round and the players are measured against what was seen.
 */
interface Stand {
    readonly cart: Cart;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** The unit vector of its heading on the ground plane. */
    readonly ax: number;
    readonly ay: number;
    /** How far its body runs behind the front axle (`bodyBackOf`). */
    readonly back: number;
}

/** Each cart's prefab, by cart id: read once, it never changes. */
const blueprintOf = new Map<number, string>();

function backOfCart(cart: Cart): number {
    let blueprint = blueprintOf.get(cart.id);
    if (blueprint === undefined) {
        blueprint = cart.blueprint;
        blueprintOf.set(cart.id, blueprint);
    }
    return bodyBackOf(blueprint);
}

function standOf(cart: Cart): Stand {
    const radians = (yawOf(cart.rotation) * Math.PI) / 180;
    const at = cart.position;
    return { cart, x: at.x, y: at.y, z: at.z, ax: -Math.sin(radians), ay: Math.cos(radians), back: backOfCart(cart) };
}

function distanceFromBody(stand: Stand, at: { x: number; y: number }): number {
    const dx = at.x - stand.x;
    const dy = at.y - stand.y;
    const along = Math.max(-stand.back, Math.min(BODY_FRONT_M, dx * stand.ax + dy * stand.ay));
    return Math.hypot(dx - stand.ax * along, dy - stand.ay * along);
}

/** How far a point is from a cart's body, the stretch of its heading from the tail to the bench (`BODY_BACK_M`, `BODY_FRONT_M`), on the ground plane. */
export function bodyDistance(cart: Cart, at: { x: number; y: number }): number {
    return distanceFromBody(standOf(cart), at);
}

/** Of the carts looked at, the one nearest `at` within reach, or null. */
function nearestStand(stands: readonly Stand[], at: { x: number; y: number; z: number }, within: number): Cart | null {
    let found: Cart | null = null;
    let best = within;
    for (const stand of stands) {
        if (reservedCarts.has(stand.cart.id)) {
            continue;
        }
        const distance = distanceFromBody(stand, at);
        if (distance <= best && Math.abs(stand.z - at.z) <= 5) {
            best = distance;
            found = stand.cart;
        }
    }
    return found;
}

/** The cart nearest the player within reach, or null. */
export function cartNear(player: Player, within = NEAR_M): Cart | null {
    return nearestStand(Cart.all(player.virtualWorld).filter((cart) => !reservedCarts.has(cart.id)).map(standOf), player.position, within);
}

/** The cart a player is in, or null. */
export function cartOf(player: Player): Cart | null {
    return Cart.all(player.virtualWorld).find((cart) => cart.seatOf(player) !== null) ?? null;
}

interface Menu {
    readonly playerId: number;
    readonly cartId: number;
    /** Opened for the cart the player's own game saw beside them: a seat is chosen within `TRUST_M` of the server's sight of it. */
    readonly trusted?: boolean;
}

const menus = new Map<number, Menu>();
const sessionOf = new Map<number, number>();

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function titleOf(cart: Cart): string {
    const record = recordOfCart(cart);
    const base = record !== null && record.name !== "" ? record.name : cartName(cart.blueprint);
    return record === null || record.owner === "" ? base : `${base}, de ${record.ownerName || "um dono"}`;
}

/** The page of seats: each shown taken or free, the reins only to who may take them, "Descer" when already on. */
export function seatPage(player: Player, cart: Cart): DialoguePage {
    const options: DialogueOption[] = [];
    const mine = cart.seatOf(player);
    for (const seat of cart.seats) {
        const taken = cart.getOccupant(seat);
        const name = SEAT_NAMES[seat] ?? seat;
        if (mine === seat) {
            options.push({ id: `seat:${seat}`, text: `${name} (você está aqui)`, enabled: false });
        } else if (taken !== null) {
            options.push({ id: `seat:${seat}`, text: `${name} (ocupado)`, enabled: false });
        } else if (!mayDrive(player, cart)) {
            options.push({ id: `seat:${seat}`, text: `${name} (só o dono)`, enabled: false });
        } else {
            options.push({ id: `seat:${seat}`, text: name, enabled: true });
        }
    }
    if (mine !== null) {
        options.push({ id: "leave", text: "Descer da carroça", enabled: true });
    }
    options.push({ id: "close", text: "Sair", enabled: true });
    return { line: `${titleOf(cart)}: onde você quer ficar?`, onRight: false, options: options.slice(0, 8) };
}

/** What the client says of the cart its E was for: its id, and where its own game sees it. */
export interface CartClaim {
    readonly id: number;
    readonly x?: number;
    readonly y?: number;
}

export function parseClaim(payload: unknown): CartClaim | null {
    let value = payload;
    if (typeof value === "string" && value.length <= 200) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return null;
        }
    }
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const { id, x, y } = value as { id?: unknown; x?: unknown; y?: unknown };
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
        return null;
    }
    return { id, ...(typeof x === "number" && Number.isFinite(x) ? { x } : {}), ...(typeof y === "number" && Number.isFinite(y) ? { y } : {}) };
}

/** The cart a claim names, when it may be used and the server's sight of it is within `TRUST_M` of the player; the gap is logged when the server's sight was out of reach. */
function claimedCart(player: Player, claim: CartClaim): Cart | null {
    const cart = Cart.getById(claim.id);
    if (cart === null || reservedCarts.has(cart.id) || cart.virtualWorld !== player.virtualWorld) {
        return null;
    }
    const away = bodyDistance(cart, player.position);
    if (away > TRUST_M) {
        return null;
    }
    if (away > PRESS_M) {
        const at = cart.position;
        const gap = claim.x !== undefined && claim.y !== undefined ? `; o jogo dele a vê a ${Math.hypot(claim.x - at.x, claim.y - at.y).toFixed(1)} m de onde o servidor acha` : "";
        console.log(`carts: ${player.nickname} subiu pela vista do próprio jogo na carroça ${cart.id} (${cartName(blueprintOf.get(cart.id) ?? cart.blueprint)}), a ${away.toFixed(1)} m do corpo pelo servidor${gap}`);
    }
    return cart;
}

/** E at a cart: the seats. `payload` names the cart the player's own game saw beside them, if it does. */
export function useCart(player: Player, payload?: unknown): void {
    if (!player.ready || !player.alive) {
        return;
    }
    const seated = cartOf(player);
    const claim = seated === null && payload !== undefined ? parseClaim(payload) : null;
    const claimed = claim === null ? null : claimedCart(player, claim);
    const cart = seated ?? claimed ?? cartNear(player, PRESS_M);
    if (cart === null) {
        return;
    }
    const old = sessionOf.get(player.id);
    if (old !== undefined) {
        menus.delete(old);
        Dialogue.close(old);
    }
    const session = Dialogue.open(player.id, seatPage(player, cart));
    if (session === 0) {
        return;
    }
    menus.set(session, { playerId: player.id, cartId: cart.id, ...(claimed !== null && cart === claimed ? { trusted: true } : {}) });
    sessionOf.set(player.id, session);
}

function chose(session: number, player: Player, option: string): void {
    const menu = menus.get(session);
    if (menu === undefined || menu.playerId !== player.id) {
        return;
    }
    menus.delete(session);
    sessionOf.delete(player.id);
    Dialogue.close(session);
    const cart = Cart.getById(menu.cartId);
    if (cart === null || option === "close") {
        return;
    }
    if (option === "leave") {
        if (!cart.removePlayer(player)) {
            tell(player, "Você não está nessa carroça.");
        }
        return;
    }
    const seat = option.startsWith("seat:") ? option.slice(5) : "";
    if (!cart.seats.includes(seat)) {
        return;
    }
    if (bodyDistance(cart, player.position) > (menu.trusted === true ? TRUST_M : CHOOSE_M) || !player.alive) {
        tell(player, "Você se afastou demais da carroça.");
        return;
    }
    if (cart.getOccupant(seat) !== null) {
        tell(player, `${SEAT_NAMES[seat] ?? seat}: já tem alguém.`);
        return;
    }
    if (!mayDrive(player, cart)) {
        tell(player, "Essa carroça está trancada: só o dono sobe nela.");
        return;
    }
    if (!cart.putPlayer(player, seat)) {
        tell(player, "Não consegui pôr você aí agora. Tente de novo.");
    }
}

// ---------------------------------------------------------------------------------------------

function tick(): void {
    for (const cart of Cart.all()) {
        const key = keyByLive.get(cart.id);
        const record = key === undefined ? undefined : records.get(key);
        // Moved by a driver or put somewhere: kept at the next write.
        if (record !== undefined) {
            snapshot(cart, record);
        }
    }
    persist();
}

/** Lets a player out of a cart the server still has them in when they are nowhere near it (`STALE_SEAT_M`). True when they were let out. */
function releaseStale(player: Player, stand: Stand, at: { x: number; y: number }): boolean {
    const away = distanceFromBody(stand, at);
    if (away <= STALE_SEAT_M) {
        return false;
    }
    const cart = stand.cart;
    const seat = cart.seatOf(player);
    if (cart.removePlayer(player)) {
        console.log(`carts: ${player.nickname} constava no assento ${seat ?? "?"} da carroça ${cart.id} mas estava a ${away.toFixed(0)} m dela: foi tirado, e o assento ficou livre`);
        return true;
    }
    return false;
}

/**
 * The cart each player stands beside, told to their client so it can show "[E] Subir na carroça": when it changes, and again
 * every few seconds while they stand there, so a hint the game took down is put back.
 */
const toldNear = new Map<number, { id: number; around: string; at: number }>();

/** The usable carts within `AROUND_M` of a point by the server's sight, the nearest first, as the JSON of [id, how far its body runs behind the axle] pairs; "" for none. */
function aroundOf(stands: readonly Stand[], at: { x: number; y: number; z: number }): string {
    const found: Array<readonly [number, number, number]> = [];
    for (const stand of stands) {
        if (reservedCarts.has(stand.cart.id)) {
            continue;
        }
        const away = Math.hypot(stand.x - at.x, stand.y - at.y);
        if (away <= AROUND_M && Math.abs(stand.z - at.z) <= 10) {
            found.push([stand.cart.id, stand.back, away]);
        }
    }
    if (found.length === 0) {
        return "";
    }
    found.sort((a, b) => a[2] - b[2]);
    return JSON.stringify(found.slice(0, AROUND_MAX).map(([id, back]) => [id, back]));
}

function tellNear(now = Date.now()): void {
    const players = Player.all().filter((player) => player.ready);
    if (players.length === 0) {
        return;
    }
    // Each world's carts are looked at once for the round, not once for each player: where they stand, which way they head, and who sits in them.
    const worlds = new Map<number, { readonly stands: Stand[]; readonly aboard: Map<number, Stand> }>();
    const look = (world: number): { readonly stands: Stand[]; readonly aboard: Map<number, Stand> } => {
        let seen = worlds.get(world);
        if (seen === undefined) {
            seen = { stands: [], aboard: new Map() };
            for (const cart of Cart.all(world)) {
                const stand = standOf(cart);
                seen.stands.push(stand);
                for (const seat of cart.seats) {
                    const rider = cart.getOccupant(seat);
                    if (rider !== null) {
                        seen.aboard.set(rider.id, stand);
                    }
                }
            }
            worlds.set(world, seen);
        }
        return seen;
    };
    for (const player of players) {
        const seen = look(player.virtualWorld);
        // In plain numbers: each `.x` of an engine's vector is a call into the engine, and it was read for every cart (2026-10-28).
        const place = player.position;
        const at = { x: place.x, y: place.y, z: place.z };
        let aboard = seen.aboard.get(player.id);
        if (aboard !== undefined && releaseStale(player, aboard, at)) {
            aboard = undefined;
        }
        const near = player.alive && aboard === undefined ? nearestStand(seen.stands, at, NEAR_M) : null;
        const id = near === null ? 0 : near.id;
        // The carts round them, for their own game to measure itself against (`AROUND_M`): none while they sit in one.
        const around = player.alive && aboard === undefined ? aroundOf(seen.stands, at) : "";
        const told = toldNear.get(player.id);
        if ((told?.id ?? 0) !== id || (told?.around ?? "") !== around || (id !== 0 && now - (told?.at ?? 0) >= NEAR_AGAIN_MS)) {
            toldNear.set(player.id, { id, around, at: now });
            player.emit(`${RESOURCE}:cart.near`, around === "" ? JSON.stringify({ id }) : `{"id":${id},"around":${around}}`);
        }
    }
}

export function installCarts(): void {
    load();
    let restored = 0;
    for (const record of records.values()) {
        if (spawnSaved(record)) {
            restored += 1;
        }
    }

    // The reins of a cart that has an owner are the owner's, however the player came to be at them.
    Events.on("cartEntering", (cart, player) => {
        const reserved = reservedCarts.get(cart.id);
        if (reserved !== undefined) {
            tell(player, reserved());
            return false;
        }
        if (!mayDrive(player, cart)) {
            tell(player, "Essa carroça está trancada: só o dono sobe nela.");
            return false;
        }
        return undefined;
    });
    Events.on("cartExit", (cart) => {
        const key = keyByLive.get(cart.id);
        const record = key === undefined ? undefined : records.get(key);
        if (record !== undefined && !stopping) {
            snapshot(cart, record);
            persist();
        }
    });
    Events.on("cartDestroy", (cart) => {
        blueprintOf.delete(cart.id);
        const key = keyByLive.get(cart.id);
        if (key !== undefined && !stopping) {
            console.log(`carts: a carroça ${records.get(key)?.name || key} de ${records.get(key)?.ownerName ?? "?"} foi removida do mundo e deixa de ser guardada`);
            records.delete(key);
            unlink(key);
            persist();
        }
    });

    Events.onClient(`${RESOURCE}:cart.use`, (sender, payload) => useCart(sender as Player, payload));
    Events.on("dialogueChoice", (session, player, option) => chose(session, player, option));
    Events.on("dialogueClosed", (session) => {
        const menu = menus.get(session);
        if (menu !== undefined) {
            menus.delete(session);
            sessionOf.delete(menu.playerId);
        }
    });
    Events.on("playerDisconnect", (player) => {
        const session = sessionOf.get(player.id);
        if (session !== undefined) {
            menus.delete(session);
            sessionOf.delete(player.id);
        }
        toldNear.delete(player.id);
    });

    const saver = setInterval(tick, SAVE_EVERY_MS);
    const near = setInterval(tellNear, NEAR_EVERY_MS);
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(saver);
        clearInterval(near);
        tick();
        stopping = true;
        // Taken away so a restarted resource does not put a second copy of each beside the first.
        for (const id of liveByKey.values()) {
            Cart.getById(id)?.destroy();
        }
    });

    const world = [...records.values()].filter(isWorldCart).length;
    console.log(`carts: ${records.size} carroça(s) guardada(s) (${world} do mundo, ${records.size - world} com dono); ${restored} de volta ao mundo`);
}
