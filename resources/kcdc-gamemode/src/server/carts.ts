/**
 * Carts and wagons that belong to players (user, 2026-10-17: "tornar as carroças funcionais e integradas ao sistema de
 * propriedades ... interagir com a carroça utilizando a tecla E, escolher o assento ... permanecer salva no mundo ... dar um nome ...
 * o brasão da carroça").
 *
 * A cart is a player's once an administrator gives one to them (`/carroca dar`) or registers the one that stands beside them
 * (`/carroca registrar`), as a horse is (`horses.ts`). From then on it stays where it was left across disconnects and
 * restarts, in `playerdata/carts.json`, and the owner names it, brings it to where they stand and reads where it is in the
 * "Animais" section of the panel. A player has at most two.
 *
 * Getting on: a player near a cart (within 5 m) is shown the game's own "[E] Subir na carroça" hint (`src/client/carts.ts`,
 * told by `cart.near`), and E asks for the seats on the game's dialogue list: the reins, the bench beside them, the rails,
 * each shown taken or free; and "Descer" when they are already on. The game's own prompt at a bench or a rail still works
 * and reaches the same rule (`cartEntering`): the reins of a cart that has an owner are the owner's (and an administrator's);
 * everybody else rides as a passenger. A cart nobody owns, one an administrator put there with `/cart`, takes anybody anywhere.
 */

import { isAdmin } from "./auth.js";
import { yawOf } from "./position.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/carts.json`;
const RESOURCE = "kcdc-gamemode";

export const CART_NAME_MIN = 2;
export const CART_NAME_MAX = 24;

/** How many carts a player may own. */
export const MAX_CARTS = 2;

/** How near a cart a player is asked about its seats, and how near they must still be when they choose. */
export const NEAR_M = 5;
export const CHOOSE_M = 9;

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
    return record === null || record.owner === player.steamId || record.shared === true || isAdmin(player);
}

/** Leaves a cart of `steamId`'s free for anybody to ride and drive, or locks it again. */
export function setCartShared(steamId: string, key: string, shared: boolean): Outcome {
    const record = records.get(key);
    if (record === undefined || record.owner !== steamId) {
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
        if (distance <= best && !keyByLive.has(cart.id)) {
            best = distance;
            found = cart;
        }
    }
    return found;
}

/** Registers the cart nobody owns that stands beside `target` as theirs. */
export function registerCart(target: Player): Outcome {
    if (!STEAM_ID.test(target.steamId)) {
        return { ok: false, message: `${target.nickname} entrou sem identificação Steam: não há como guardar a carroça.` };
    }
    if (cartsOf(target.steamId).length >= MAX_CARTS) {
        return { ok: false, message: `${target.nickname} já tem ${MAX_CARTS} carroças, o máximo.` };
    }
    const cart = loneCartNear(target, 15);
    if (cart === null) {
        return { ok: false, message: "Nenhuma carroça sem dono a até 15 m de quem vai recebê-la." };
    }
    const record: SavedCart = { key: newKey(), owner: target.steamId, ownerName: target.nickname, blueprint: cart.blueprint, name: "", x: 0, y: 0, z: 0, yaw: 0, savedAt: 0 };
    snapshot(cart, record);
    records.set(record.key, record);
    link(record.key, cart);
    persist();
    return { ok: true, message: `${cartName(cart.blueprint)} agora é de ${target.nickname}.` };
}

/** Lets a cart go: it is nobody's any more and is not kept. */
export function releaseCart(key: string): boolean {
    if (!records.has(key)) {
        return false;
    }
    records.delete(key);
    unlink(key);
    persist();
    return true;
}

/** Names a cart of `steamId`'s. An empty name gives it back the plain one. */
export function renameCart(steamId: string, key: string, raw: unknown): Outcome {
    const record = records.get(key);
    if (record === undefined || record.owner !== steamId) {
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

/** Brings the owner's cart (this one, or the nearest) to a spot in front of them, if nobody is on it. */
export function bringCart(player: Player, key: string | null, now = Date.now()): Outcome {
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
    if (wait > 0) {
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

/** The cart nearest the player within reach, or null. */
export function cartNear(player: Player, within = NEAR_M): Cart | null {
    let found: Cart | null = null;
    let best = within;
    for (const cart of Cart.all(player.virtualWorld)) {
        const distance = Math.hypot(cart.position.x - player.position.x, cart.position.y - player.position.y);
        if (distance <= best && Math.abs(cart.position.z - player.position.z) <= 5) {
            best = distance;
            found = cart;
        }
    }
    return found;
}

/** The cart a player is in, or null. */
export function cartOf(player: Player): Cart | null {
    return Cart.all(player.virtualWorld).find((cart) => cart.seatOf(player) !== null) ?? null;
}

interface Menu {
    readonly playerId: number;
    readonly cartId: number;
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
    return record === null ? base : `${base}, de ${record.ownerName || "um dono"}`;
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

/** E at a cart: the seats. */
export function useCart(player: Player): void {
    if (!player.ready || !player.alive) {
        return;
    }
    const cart = cartOf(player) ?? cartNear(player);
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
    menus.set(session, { playerId: player.id, cartId: cart.id });
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
    if (flat(cart.position, player.position) > CHOOSE_M || !player.alive) {
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

/** The cart each player stands beside, told to their client so it can show "[E] Subir na carroça". */
const toldNear = new Map<number, number>();

function tellNear(): void {
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        const near = player.alive && cartOf(player) === null ? cartNear(player) : null;
        const id = near === null ? 0 : near.id;
        if ((toldNear.get(player.id) ?? 0) !== id) {
            toldNear.set(player.id, id);
            player.emit(`${RESOURCE}:cart.near`, JSON.stringify({ id }));
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
        const key = keyByLive.get(cart.id);
        if (key !== undefined && !stopping) {
            console.log(`carts: a carroça ${records.get(key)?.name || key} de ${records.get(key)?.ownerName ?? "?"} foi removida do mundo e deixa de ser guardada`);
            records.delete(key);
            unlink(key);
            persist();
        }
    });

    Events.onClient(`${RESOURCE}:cart.use`, (sender) => useCart(sender as Player));
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

    console.log(`carts: ${records.size} carroça(s) com dono guardada(s); ${restored} de volta ao mundo`);
}
