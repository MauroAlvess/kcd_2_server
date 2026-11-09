/**
 * The guild vendors (2026-10-31, user: "vamos colocar novamente os npcs vendedores mas dessa vez vamos posicionar eles de forma bem objetiva onde devia ficar no jogo; eles vão ficar parados
 * no mundo, a postura, e ter diálogo: ao apertar E neles abre o menu com opção Comprar/Vender, Aprender Guilda Ofício e Sair"). One vendor for each of the eight guilds in each of the sixteen
 * towns of the Cidadania, standing where the game puts that trade (`guild-posts-data.ts`, made by `tools/make-guild-posts.py` from the level's own entities); an administrator moves one with
 * `/mercador aqui <id>`, and the choice is kept in `playerdata/guild-posts.json`. What each sells and buys, at what price and with what purse, is in `guild-shops.ts`.
 *
 * They stand still: no walk about the village, no bed (the old vendors of `vendors.ts`, which are off, had a day of their own). They exist by day only (2026-10-31, user: "de noite eles devem
 * sumir: 40 minutos de dia eles existem e 40 minutos de noite somem"): the world's day is forty real minutes and its night forty (`world-cycle.ts`), and at nightfall each body is taken away
 * (one somebody is talking to goes when the talk is over) and is made again at dawn. A body exists only while a player is near it (`spawnM`), so the hundred and twenty-eight posts of the
 * realm cost the game a handful of bodies at a time. They cannot be hurt; one that fell, strayed or is shut in is made again at its place (`npc-keeper.ts`).
 *
 * E opens the game's choice list: "Comprar/Vender", "Aprender Guilda: <ofício>" and "Sair".
 * - Comprar/Vender opens the game's own trade screen on a vendor made for that player alone (`Vendor.create`): its shelf is what is left of the player's 300 coins of wares, its purse what is
 *   left of the 300 coins it pays out to this player (`guild-shops.ts`), so nobody else's trading touches either. The tamers show their horse first, as a line of the list, since a horse is
 *   not a thing the trade screen moves.
 * - Aprender Guilda: the vendor teaches its trade, with a few lines of talk, to a citizen of the town it stands in and to nobody else. The first trade a player ever learns from a vendor is
 *   free (2026-10-31, user: "só a primeira vez de graça, qualquer ofício; depois é 100 moedas"); every one after it, a change of guild or a trade learnt again, costs 100 coins
 *   (`chargeChangePrice`), the player's free change of the panel notwithstanding.
 * - Sair closes the list.
 */

import { isAdmin } from "./auth.js";
import { emitLarge } from "./big-emit.js";
import { chargeChangePrice } from "./change-fee.js";
import type { Fee } from "./change-fee.js";
import { townById, townOf, npcCounters, TOWNS } from "./citizenship.js";
import type { Town } from "./citizenship.js";
import { craftItemGuid, classOf } from "./craft-items.js";
import { GUILD_POSTS } from "./guild-posts-data.js";
import { barberListing } from "./barbers.js";
import { cartsOf, giveCart, MAX_CARTS } from "./carts.js";
import { REGIONS } from "./properties.js";
import { coaches } from "./travel.js";
import { afterDeal, CART_COINS, CARTS, currentRecord, HORSES, horseOf, isHorseKey, isUntouched, makePriceBook, MAX_ROWS, mergeRecords, nominalShelf, priceUnits, REFILL_MS, SHOPS, shopOfGuild, TRADE_NUDGES } from "./guild-shops.js";
import type { GuildShop, PriceBook, ShopRecord } from "./guild-shops.js";
import { isGuid, resolveItemGuids } from "./item-guids.js";
import { keyOfHorse, recordOf as horseRecordOf } from "./horses.js";
import { grantGuildKit, guildKitHint } from "./kits.js";
import { languageOf, translate } from "./language.js";
import { coins, giveMoney, MONEY_UNIT, moneyOf, takeMoney } from "./money.js";
import { groundSettings, groundUnder, judgeGround } from "./npc-ground.js";
import { npcKeeper, keeperNote } from "./npc-keeper.js";
import { speak, splitSpeaker, turnBackAfterTalk } from "./npc-speech.js";
import { inFrontOf } from "./place.js";
import { getGuildId, GUILDS, notice, sendSocial, setGuildId } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { placeOf, townsperson } from "./townsfolk.js";
import { buyNamesFor } from "./vendors.js";
import { topicsOf } from "./vendor-talk.js";
import { dress } from "./wild-horses.js";
import { CHANGE_PRICE_COINS } from "./free-changes.js";
import { isDay } from "./world-cycle.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const POSTS_FILE = `${DIR}/guild-posts.json`;
const SHOPS_FILE = `${DIR}/guild-shops.json`;
const LEARNED_FILE = `${DIR}/guild-learned.json`;
const DISABLED_FILE = `${DIR}/guild-disabled.json`;
const HORSES_FILE = `${DIR}/guild-horses.json`;

export const guildVendorSettings = {
    /** Whether the vendors stand in the world. */
    enabled: true,
    /** Whether they are gone for the night (2026-10-31: yes; then "deixe de dia também" took the night away; then "deixar os NPC só no dia mesmo" brought it back). */
    byDayOnly: true,
    /** They appear this long after the server starts, so the level and the navigation mesh are up. */
    spawnAfterMs: 15_000,
    /** How often the posts are looked at against the players. */
    tickMs: 4_000,
    /** A body is made when a player is this near its place (metres on the ground), and taken away when none is within `despawnM`. */
    spawnM: 110,
    despawnM: 150,
    /** A talk or a trade is closed when the player is this far from the vendor. */
    talkM: 8,
    /** A trade screen that has been closed is forgotten after this long. */
    tradeGraceMs: 20_000,
    /** A horse is put this far in front of the buyer. */
    horseM: 3,
};

export interface Post {
    readonly id: string;
    readonly guild: string;
    readonly town: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    /** What the place was taken from; `ring` is for an administrator to move. */
    readonly source: string;
}

export const POSTS: readonly Post[] = GUILD_POSTS.map(([id, guild, town, x, y, z, yaw, source]) => ({ id, guild, town, x, y, z, yaw, source }));

const postById = new Map<string, Post>(POSTS.map((post) => [post.id, post]));

export function isGuildPostId(id: string): boolean {
    return postById.has(id);
}

interface Spot {
    x: number;
    y: number;
    z: number;
    yaw: number;
}

/** The places an administrator chose, over the generated ones. */
let chosen: Record<string, Spot> = {};

const spotOf = (post: Post): Spot => chosen[post.id] ?? { x: post.x, y: post.y, z: post.z, yaw: post.yaw };

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

const shopOf = (post: Post): GuildShop => shopOfGuild(post.guild) as GuildShop;

function townOfPost(post: Post): Town {
    return townById(post.town) as Town;
}

function loadChosen(): void {
    const loaded = read<Record<string, Spot>>(POSTS_FILE);
    if (loaded.status !== "ok") {
        return;
    }
    for (const post of POSTS) {
        const spot = loaded.value[post.id];
        if (spot && [spot.x, spot.y, spot.z, spot.yaw].every((value) => typeof value === "number" && Number.isFinite(value))) {
            chosen[post.id] = { x: spot.x, y: spot.y, z: spot.z, yaw: spot.yaw };
        }
    }
}

/** The vendors an administrator switched off (2026-10-31, the NPCs section's "Desativar NPC"): no body is made for them, and the one that stands is taken away. (From 2026-11-04 to 2026-11-09 the lord of the lands could too, with a lock to keep him out; both are gone.) */
const disabled = new Set<string>();

function loadDisabled(): void {
    // A file written while the lock existed may still have a `locked` list: it is not read, and the next save leaves it out.
    const loaded = read<{ off?: unknown }>(DISABLED_FILE);
    if (loaded.status !== "ok") {
        return;
    }
    if (Array.isArray(loaded.value.off)) {
        for (const id of loaded.value.off) {
            if (typeof id === "string" && postById.has(id)) {
                disabled.add(id);
            }
        }
    }
}

function saveDisabled(): void {
    try {
        ensureDir(DIR);
        write(DISABLED_FILE, { v: 1, off: [...disabled] });
    } catch (error: unknown) {
        console.log(`guild-vendors: não consegui gravar ${DISABLED_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function isPostDisabled(id: string): boolean {
    return disabled.has(id);
}

/** The fields of what a page sent (a small JSON text, or an object); nothing for anything else. */
function payloadFields(payload: unknown): Record<string, unknown> {
    let fields: unknown = payload;
    if (typeof payload === "string") {
        if (payload.length > 200) {
            return {};
        }
        try {
            fields = JSON.parse(payload) as unknown;
        } catch {
            return {};
        }
    }
    return typeof fields === "object" && fields !== null && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {};
}

/** Switches a vendor off or on; its body goes at once, and comes back at the next look when it is switched on. False for an id that is none's. */
export function setPostDisabled(id: string, off: boolean): boolean {
    if (!postById.has(id)) {
        return false;
    }
    if (off) {
        disabled.add(id);
        dropBody(id);
    } else {
        disabled.delete(id);
    }
    saveDisabled();
    return true;
}

function saveChosen(): void {
    ensureDir(DIR);
    write(POSTS_FILE, chosen);
}

// ---------------------------------------------------------------------------------------------
// The bodies.

const bodies = new Map<string, number>();
const byNpc = new Map<number, Post>();
/** When a body was last made, for the keeper. */
const rescues = new Map<string, number>();

/**
 * Where a post's body was found to stand on what the players' games have under it (`npc-ground.ts`, 2026-11-01: "ficam no ar voando"), for the spot it was asked at: the place it was set
 * at, or null when the mesh's point was right. A body made again goes straight there, and the keeper looks at it from there.
 */
const grounded = new Map<string, { readonly key: string; readonly at: { readonly x: number; readonly y: number; readonly z: number } | null }>();
/** The posts whose ground is being asked, and when a post whose game did not answer may be asked again. */
const asking = new Set<string>();
const askAgain = new Map<string, number>();
/** What the reads came to since the start, said in the log now and then (`GROUND_SUMMARY_MS`) when it changed: a body found standing right says nothing on its own. */
const groundCounts = { right: 0, moved: 0, untrusted: 0, unanswered: 0, failed: 0 };
const GROUND_SUMMARY_MS = 5 * 60_000;
let groundSaid = "";
let groundSaidAt = Number.NEGATIVE_INFINITY;

function sayGround(now: number): void {
    if (now - groundSaidAt < GROUND_SUMMARY_MS) {
        return;
    }
    groundSaidAt = now;
    const { right, moved, untrusted, unanswered, failed } = groundCounts;
    if (right + moved + untrusted + unanswered + failed === 0) {
        return;
    }
    const line = `${right} já no chão, ${moved} posto(s) no chão, ${untrusted} sem chão confiável, ${unanswered} sem resposta, ${failed} com erro`;
    if (line !== groundSaid) {
        groundSaid = line;
        console.log(`guild-vendors: chão lido pelo jogo dos jogadores desde o início: ${line}`);
    }
}

/** Whether the player is in the world everybody shares (`0xffffffff`; 0 on a server that never set one), where the vendors stand. */
const inSharedWorld = (player: Player): boolean => {
    const world = (player as { virtualWorld?: number }).virtualWorld;
    return world === undefined || world === 0xffffffff || world === 0;
};

const spotKey = (spot: Spot): string => `${spot.x.toFixed(2)},${spot.y.toFixed(2)},${spot.z.toFixed(2)}`;

/** The place the post's body was set at by its ground, or null when it was not moved (or nobody has looked yet). */
function settledPlace(post: Post): { readonly x: number; readonly y: number; readonly z: number } | null {
    const known = grounded.get(post.id);
    return known !== undefined && known.key === spotKey(spotOf(post)) ? known.at : null;
}

/** Whether the post's ground is still to be asked for the spot it has. */
function groundUnknown(post: Post, now: number): boolean {
    const known = grounded.get(post.id);
    return (known === undefined || known.key !== spotKey(spotOf(post))) && !asking.has(post.id) && now >= (askAgain.get(post.id) ?? 0);
}

/** Asks `reader`'s game what is under the post's body, and sets the body on it when it stands on air or in the ground. */
async function settle(post: Post, npcId: number, reader: Player, now: number): Promise<void> {
    const key = spotKey(spotOf(post));
    asking.add(post.id);
    try {
        const npc = Npc.getById(npcId);
        if (npc === null) {
            return;
        }
        const feet = { x: npc.position.x, y: npc.position.y, z: npc.position.z };
        const hits = await groundUnder(reader, feet);
        if (bodies.get(post.id) !== npcId || spotKey(spotOf(post)) !== key) {
            // Made again or moved while the game was asked: the next look asks again.
            return;
        }
        if (hits === null) {
            groundCounts.unanswered += 1;
            askAgain.set(post.id, now + groundSettings.retryMs);
            return;
        }
        const verdict = judgeGround(feet.z, hits);
        const who = `${shopOf(post).npcName} (${post.id})`;
        if (verdict.kind === "move") {
            const at = { x: feet.x, y: feet.y, z: verdict.z };
            groundCounts.moved += 1;
            grounded.set(post.id, { key, at });
            Npc.getById(npcId)?.teleport(new Vector3(at.x, at.y, at.z));
            console.log(`guild-vendors: ${who} estava ${Math.abs(verdict.gap).toFixed(2)} m ${verdict.gap > 0 ? "acima do chão" : "dentro do chão"} em (${Math.round(at.x)}, ${Math.round(at.y)}): posto no chão, a ${at.z.toFixed(2)}`);
            return;
        }
        grounded.set(post.id, { key, at: null });
        groundCounts[verdict.kind === "right" ? "right" : "untrusted"] += 1;
        if (verdict.kind === "far") {
            console.log(`guild-vendors: ${who}: o chão que o jogo de ${reader.nickname} vê fica ${verdict.gap.toFixed(1)} m abaixo dele, longe demais para confiar; ficou onde está`);
        } else if (verdict.kind === "nothing") {
            console.log(`guild-vendors: ${who}: o jogo de ${reader.nickname} não achou chão até ${groundSettings.downM} m abaixo dele; ficou onde está`);
        }
    } catch (error: unknown) {
        groundCounts.failed += 1;
        askAgain.set(post.id, now + groundSettings.retryMs);
        console.log(`guild-vendors: o chão de ${post.id} não pôde ser lido: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        asking.delete(post.id);
    }
}

/** What the vendor is called over its head (2026-10-31, user: "em cima da cabeça deles o nome de cada ofício, exemplo ferreiro"): the trade, as the guild's page names it. */
export function tradeLabel(post: Post): string {
    return GUILDS.find((guild) => guild.id === post.guild)?.profession ?? shopOf(post).npcName;
}

function spawnBody(post: Post): boolean {
    const shop = shopOf(post);
    const spot = spotOf(post);
    // Where its ground set it the last time, or the mesh's point.
    const settled = settledPlace(post);
    const npc = townsperson(shop.female ? "townswoman" : "townsman", shop.npcName, settled === null ? placeOf(spot) : new Vector3(settled.x, settled.y, settled.z), spot.yaw, shop.outfit, tradeLabel(post));
    bodies.set(post.id, npc.id);
    byNpc.set(npc.id, post);
    return true;
}

function dropBody(id: string): void {
    const npcId = bodies.get(id);
    if (npcId === undefined) {
        return;
    }
    bodies.delete(id);
    byNpc.delete(npcId);
    npcKeeper.forget(id);
    try {
        Npc.getById(npcId)?.remove();
    } catch {
        // Already gone.
    }
}

/** Whether it is night in the world: the vendors are gone. */
export function isNight(): boolean {
    if (!guildVendorSettings.byDayOnly) {
        return false;
    }
    try {
        return !isDay(World.hour);
    } catch {
        return false;
    }
}

/** Keeps the bodies near the players and none far from them, and none by night; a body that fell or strayed is made again at its place. */
export function lookAtPosts(now: number = Date.now()): void {
    sayGround(now);
    const night = isNight();
    const near: Array<{ x: number; y: number; player: Player | null }> = [];
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        const at = player.position;
        // Only a player in the shared world is asked what is under a body: one in a world of their own (the creator's) does not see the town.
        near.push({ x: at.x, y: at.y, player: inSharedWorld(player) ? player : null });
    }
    const { spawnM, despawnM } = guildVendorSettings;
    for (const post of POSTS) {
        const spot = spotOf(post);
        let nearest = Number.POSITIVE_INFINITY;
        let reader: Player | null = null;
        let readerAway = Number.POSITIVE_INFINITY;
        for (const at of near) {
            const away = flat(at, spot);
            nearest = Math.min(nearest, away);
            if (at.player !== null && away < readerAway) {
                readerAway = away;
                reader = at.player;
            }
        }
        const body = bodies.get(post.id);
        if (disabled.has(post.id)) {
            if (body !== undefined) {
                dropBody(post.id);
            }
            continue;
        }
        if (night && !inUse(post.id)) {
            // By night they are not there at all (the one somebody is talking to goes when the talk is over).
            if (body !== undefined) {
                dropBody(post.id);
            }
            continue;
        }
        if (body === undefined) {
            if (nearest <= spawnM) {
                try {
                    spawnBody(post);
                } catch (error: unknown) {
                    console.error(`guild-vendors: não consegui criar ${post.id}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            continue;
        }
        if (nearest > despawnM && !inUse(post.id)) {
            dropBody(post.id);
            continue;
        }
        const npc = Npc.getById(body);
        if (npc === null) {
            // Brought down or taken away by something else: a new one at the next look.
            bodies.delete(post.id);
            byNpc.delete(body);
            continue;
        }
        // What is really under it, asked of the game of a player near enough to have the place loaded (2026-11-01).
        if (reader !== null && readerAway <= groundSettings.askM && groundUnknown(post, now)) {
            void settle(post, body, reader, now);
        }
        const where = npc.position;
        // A body its ground set off the mesh is looked at from where it was set, and not against the mesh.
        const settled = settledPlace(post);
        const reason = npcKeeper.look(post.id, { x: where.x, y: where.y, z: where.z }, settled ?? spot, 0, now, false, settled !== null);
        if (reason !== null) {
            const times = (rescues.get(post.id) ?? 0) + 1;
            rescues.set(post.id, times);
            console.log(keeperNote("guild-vendors", shopOf(post).npcName, { x: where.x, y: where.y, z: where.z }, spot, reason, times));
            dropBody(post.id);
            try {
                spawnBody(post);
            } catch (error: unknown) {
                console.error(`guild-vendors: ${post.id} não voltou: ${error instanceof Error ? error.message : String(error)}`);
            }
            npcKeeper.rescued(post.id, now);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// What each player has with each vendor.

const records = new Map<string, ShopRecord>();
let recordSave: ReturnType<typeof setTimeout> | null = null;

/**
 * One purse and one shelf for each player and each GUILD, not each vendor (2026-10-31, user: "o limite de 300 de compra e venda deve ser refletido em todos os NPCs do mesmo tipo no mapa, isso
 * evita o jogador farmar infinito"): the 300 coins a player spent at the smith of Suchdol are gone at the smith of Kuttenberg too.
 */
const recordKey = (steamId: string, guild: string): string => `${steamId}|${guild}`;

function loadRecords(now: number): void {
    const loaded = read<{ records?: Record<string, ShopRecord> }>(SHOPS_FILE);
    if (loaded.status !== "ok" || typeof loaded.value.records !== "object" || loaded.value.records === null) {
        return;
    }
    for (const [key, record] of Object.entries(loaded.value.records)) {
        const [steamId = "", tail = ""] = key.split("|");
        // A file written before the limit was shared holds one record for each vendor (`<steam id>|<post id>`): they fold into the guild's, the most spent of each.
        const post = postById.get(tail);
        const guild = post !== undefined ? post.guild : SHOPS.some((shop) => shop.guild === tail) ? tail : "";
        const shop = shopOfGuild(guild);
        if (shop !== undefined && /^\d{5,20}$/.test(steamId) && record !== null && typeof record === "object") {
            const kept = currentRecord(shop, record, now);
            // A record a day old is a fresh one: not kept.
            if (kept.since === record.since) {
                const own = recordKey(steamId, guild);
                const before = records.get(own);
                records.set(own, before === undefined ? kept : mergeRecords(before, kept));
            }
        }
    }
}

function saveRecordsSoon(): void {
    if (recordSave !== null) {
        return;
    }
    recordSave = setTimeout(() => {
        recordSave = null;
        const now = Date.now();
        for (const [key, record] of records) {
            if (now - record.since >= 24 * 60 * 60_000) {
                records.delete(key);
            }
        }
        try {
            ensureDir(DIR);
            write(SHOPS_FILE, { v: 1, records: Object.fromEntries(records) });
        } catch (error: unknown) {
            console.log(`guild-vendors: não consegui gravar ${SHOPS_FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, 3_000);
}

const recordFor = (steamId: string, post: Post, now: number): ShopRecord => currentRecord(shopOf(post), records.get(recordKey(steamId, post.guild)), now);

// ---------------------------------------------------------------------------------------------
// The trade screen: a vendor made for one player.

interface Session {
    readonly vendor: number;
    readonly playerId: number;
    readonly steamId: string;
    readonly postId: string;
    readonly opened: number;
}

const sessions = new Map<number, Session>();
const vendorOfPlayer = new Map<number, number>();

/** The item as a vendor's row names it: the GUID of one of ours, or the game's own name or GUID. */
const rowItem = (item: string): string => craftItemGuid(item) ?? item;

const missing = new Set<string>();

function known(item: string): boolean {
    if (Inventory.getItemPrice(rowItem(item)) !== null) {
        return true;
    }
    if (!missing.has(item)) {
        missing.add(item);
        console.log(`guild-vendors: o item '${item}' não existe neste servidor; ficou fora das lojas`);
    }
    return false;
}

/** The shelf of a player's vendor: what is left of the day's wares, priced by rarity. */
export function stockRows(shop: GuildShop, record: ShopRecord): VendorStockRow[] {
    const rows: VendorStockRow[] = [];
    for (const one of nominalShelf(shop)) {
        const left = record.left[one.item] ?? 0;
        if (isHorseKey(one.item) || left <= 0 || !known(one.item)) {
            continue;
        }
        rows.push({ item: rowItem(one.item), amount: left, price: priceUnits(one.rarity) });
    }
    return rows;
}

const buyCache = new Map<string, VendorBuyRow[]>();
let book: PriceBook | null = null;

/**
 * The realm's one price of every thing and the one guild that buys it (`makePriceBook`, 2026-11-03), read off the game once: the class each name is (so that a name and a GUID of one
 * class are one thing), what the game says each is worth, and which are gear.
 */
export function priceBook(): PriceBook {
    if (book !== null) {
        return book;
    }
    const names = SHOPS.flatMap((shop) => [...shop.sells.map((one) => one.item), ...shop.buys, ...(shop.buysOf === "" ? [] : buyNamesFor(shop.buysOf))]).filter((item) => !isHorseKey(item));
    const guids = resolveItemGuids(names);
    const gear = new Set<string>();
    try {
        for (const entry of Inventory.classes()) {
            gear.add(entry.id.toLowerCase());
            gear.add(entry.name.toLowerCase());
        }
    } catch {
        // No gear known: nothing is capped as loot.
    }
    const key = (item: string): string => {
        if (item.startsWith("kcdc-craft:")) {
            return classOf(item);
        }
        const lower = item.toLowerCase();
        return isGuid(item) ? lower : (guids.get(lower) ?? lower);
    };
    book = makePriceBook({
        key,
        worth: (item) => {
            const price = Inventory.getItemPrice(rowItem(item));
            return price === null ? null : price.pristine / MONEY_UNIT;
        },
        gear: (item) => gear.has(item.toLowerCase()) || gear.has(key(item)),
        tradeList: buyNamesFor,
    });
    console.log(`guild-vendors: um preço por coisa em todo o reino, e uma guilda que compra cada uma (${SHOPS.map((shop) => `${shop.trade} ${book?.buyList(shop.guild).length ?? 0}`).join(", ")} tipos); ${guids.size} nomes do jogo lidos`);
    return book;
}

/** What a guild's vendor pays for: what is that guild's to buy (`PriceBook.home`), each at the realm's one price (`BUY_SHARE` of it), the game's first 128 kinds. */
export function buyRows(shop: GuildShop): VendorBuyRow[] {
    const cached = buyCache.get(shop.guild);
    if (cached !== undefined) {
        return cached;
    }
    const prices = priceBook();
    const rows: VendorBuyRow[] = [];
    const seen = new Set<string>();
    for (const item of prices.buyList(shop.guild)) {
        const key = classOf(item);
        if (rows.length >= MAX_ROWS) {
            break;
        }
        if (seen.has(key) || !known(item)) {
            continue;
        }
        seen.add(key);
        rows.push({ item: rowItem(item), price: prices.buyUnits(item) });
    }
    buyCache.set(shop.guild, rows);
    return rows;
}

function dropSession(playerId: number): void {
    const vendor = vendorOfPlayer.get(playerId);
    if (vendor === undefined) {
        return;
    }
    vendorOfPlayer.delete(playerId);
    sessions.delete(vendor);
    try {
        Vendor.destroy(vendor);
    } catch {
        // Gone already.
    }
}

/** Whether somebody is talking or trading with this post now: its body stays. */
function inUse(postId: string): boolean {
    return [...menus.values()].some((menu) => menu.postId === postId) || [...sessions.values()].some((session) => session.postId === postId);
}

function openTrade(player: Player, post: Post, npc: Npc): boolean {
    const shop = shopOf(post);
    const now = Date.now();
    const record = recordFor(player.steamId, post, now);
    dropSession(player.id);
    const vendor = Vendor.create({ name: `${shop.npcName} (${townOfPost(post).name})`, purse: record.purse, buys: true });
    Vendor.setStock(vendor, stockRows(shop, record));
    // A buying list the game refuses (it throws for a class listed twice) leaves the vendor buying nothing, and the trade still opens: it sells (2026-11-02).
    try {
        if (!Vendor.setBuyPrices(vendor, buyRows(shop))) {
            console.log(`guild-vendors: ${post.id}: o jogo recusou a lista de ${buyRows(shop).length} itens que ele compra`);
        }
    } catch (error: unknown) {
        console.log(`guild-vendors: ${post.id}: o jogo recusou a lista de ${buyRows(shop).length} itens que ele compra: ${error instanceof Error ? error.message : String(error)}`);
    }
    const session = Vendor.open(vendor, player.id, npc.id);
    if (session === 0) {
        Vendor.destroy(vendor);
        return false;
    }
    sessions.set(vendor, { vendor, playerId: player.id, steamId: player.steamId, postId: post.id, opened: now });
    vendorOfPlayer.set(player.id, vendor);
    Chat.sendToPlayer(player, say(player, purseNote(shop, record, now)));
    return true;
}

/**
 * What a player is told as the trade opens (2026-11-01: a player said that, with nothing sold, the vendors were all "zerados" and not his own): the purse is his alone, but it is
 * the same at every vendor of the guild, and it fills again a day after the first deal of the round.
 */
export function purseNote(shop: GuildShop, record: ShopRecord, now: number): string {
    if (isUntouched(shop, record)) {
        return `${shop.npcName}: compra até ${coins(record.purse)} de você. A conta é só sua e vale para todos os vendedores desse ofício no reino; enche de novo 24 h depois do primeiro negócio.`;
    }
    const hours = Math.max(1, Math.ceil((record.since + REFILL_MS - now) / 3_600_000));
    return `${shop.npcName}: ainda compra até ${coins(record.purse)} de você. A conta é só sua e vale para todos os vendedores desse ofício no reino; enche de novo em ${hours} h.`;
}

/** Which of a shop's wares a settled line of a deal is: by the game's name for it, or by the class it was registered under. */
function wareOf(shop: GuildShop, line: VendorTradeLine): string | null {
    for (const one of shop.sells) {
        if (!isHorseKey(one.item) && (line.name === one.item || classOf(one.item) === line.item.toLowerCase())) {
            return one.item;
        }
    }
    return null;
}

function traded(vendor: number, player: Player, bought: readonly VendorTradeLine[], sold: readonly VendorTradeLine[]): void {
    const session = sessions.get(vendor);
    const post = session === undefined ? undefined : postById.get(session.postId);
    if (session === undefined || post === undefined) {
        return;
    }
    const shop = shopOf(post);
    const record = recordFor(session.steamId, post, Date.now());
    const taken = bought.flatMap((line) => {
        const item = wareOf(shop, line);
        return item === null ? [] : [{ item, amount: line.amount }];
    });
    const purse = Vendor.getPurse(vendor);
    const next = afterDeal(record, taken, purse);
    records.set(recordKey(session.steamId, post.guild), next);
    if (purse !== null && purse !== next.purse) {
        Vendor.setPurse(vendor, next.purse);
    }
    saveRecordsSoon();
    const paid = bought.reduce((sum, line) => sum + line.amount * line.price, 0);
    const earned = sold.reduce((sum, line) => sum + line.amount * line.price, 0);
    console.log(`guild-vendors: ${player.nickname} em ${post.id}: comprou ${bought.reduce((sum, line) => sum + line.amount, 0)} (${coins(paid)}), vendeu ${sold.reduce((sum, line) => sum + line.amount, 0)} (${coins(earned)}); sobra ${coins(next.purse)} na bolsa dele`);
}

// ---------------------------------------------------------------------------------------------
// The talk.

interface Menu {
    readonly playerId: number;
    readonly steamId: string;
    readonly postId: string;
    readonly npcId: number;
    page: "main" | "horses" | "carts" | "learn" | "offer" | "ask" | "answer";
    /** The question being answered, and which part of the answer is shown (`vendor-talk.ts`). */
    topic?: string;
    part?: number;
}

const menus = new Map<number, Menu>();

const say = (player: Player, text: string): string => translate(text, languageOf(player));

function mainPage(player: Player, post: Post): DialoguePage {
    const shop = shopOf(post);
    const guild = GUILDS.find((candidate) => candidate.id === post.guild);
    return {
        line: say(player, `${shop.npcName} de ${townOfPost(post).name}: ${shop.greeting}`),
        onRight: false,
        options: [
            { id: "trade", text: say(player, "Comprar/Vender"), enabled: true },
            { id: "learn", text: say(player, `Aprender Guilda: ${guild?.profession ?? shop.npcName}`), enabled: true },
            { id: "ask", text: say(player, "Tirar dúvidas"), enabled: true },
            { id: "leave", text: say(player, "Sair"), enabled: true },
        ],
    };
}

/** The trade's questions a vendor answers (2026-11-01: "conversas possíveis com eles para tirar dúvidas"). */
function topicsOfPost(post: Post): ReturnType<typeof topicsOf> {
    const guild = GUILDS.find((candidate) => candidate.id === post.guild);
    return topicsOf(post.guild, guild?.profession ?? shopOf(post).npcName);
}

function questionsPage(player: Player, post: Post): DialoguePage {
    const shop = shopOf(post);
    const options: DialogueOption[] = topicsOfPost(post).map((topic) => ({ id: `q:${topic.id}`, text: say(player, topic.question), enabled: true }));
    options.push({ id: "back", text: say(player, "Voltar"), enabled: true }, { id: "leave", text: say(player, "Sair"), enabled: true });
    return { line: say(player, `${shop.npcName}: pergunte o que quiser sobre o ofício.`), onRight: false, options };
}

/** A part of an answer: "Continuar" while there is more, then another question, back to the list, or leave. */
function answerPage(player: Player, post: Post, topicId: string, part: number): DialoguePage | null {
    const topic = topicsOfPost(post).find((candidate) => candidate.id === topicId);
    const line = topic?.answer[part];
    if (topic === undefined || line === undefined) {
        return null;
    }
    const more = part + 1 < topic.answer.length;
    const options: DialogueOption[] = more ? [{ id: "next", text: say(player, "Continuar"), enabled: true }] : [];
    options.push({ id: "questions", text: say(player, "Outra pergunta"), enabled: true }, { id: "back", text: say(player, "Voltar"), enabled: true }, { id: "leave", text: say(player, "Sair"), enabled: true });
    return { line: say(player, `${shopOf(post).npcName}: ${line}`), onRight: false, options };
}

function horsesPage(player: Player, post: Post): DialoguePage {
    const shop = shopOf(post);
    const has = ownsVendorHorse(player.steamId);
    const options: DialogueOption[] = HORSES.map((horse) =>
        has
            ? { id: `horse:${horse.id}`, text: say(player, `${horse.label}: você já tem um cavalo do domador`), enabled: false }
            : { id: `horse:${horse.id}`, text: say(player, `${horse.label}: ${coins(horse.coins * MONEY_UNIT)}`), enabled: true },
    );
    options.push({ id: "carts", text: say(player, `Carroças (${coins(CART_COINS * MONEY_UNIT)})`), enabled: true });
    options.push({ id: "wares", text: say(player, "Ver o que mais tenho (comprar e vender)"), enabled: true });
    options.push({ id: "back", text: say(player, "Voltar"), enabled: true });
    return { line: say(player, `${shop.npcName}: cavalo manso, de sela e rédea simples. Cada um compra um só: outro, só quando o seu morrer.`), onRight: false, options };
}

/** The carts the game has of those the tamer sells (`CARTS`). */
function cartsForSale(): typeof CARTS {
    try {
        const made = new Set(Cart.blueprints());
        return CARTS.filter((cart) => made.has(cart.id));
    } catch {
        return CARTS;
    }
}

function cartsPage(player: Player, post: Post): DialoguePage {
    const shop = shopOf(post);
    const full = cartsOf(player.steamId).length >= MAX_CARTS;
    const options: DialogueOption[] = cartsForSale().map((cart) =>
        full
            ? { id: `cart:${cart.id}`, text: say(player, `${cart.label}: você já tem ${MAX_CARTS} carroças`), enabled: false }
            : { id: `cart:${cart.id}`, text: say(player, `${cart.label}: ${coins(CART_COINS * MONEY_UNIT)}`), enabled: true },
    );
    options.push({ id: "horses", text: say(player, "Voltar aos cavalos"), enabled: true });
    return { line: say(player, `${shop.npcName}: carroça com os cavalos já nos varais. Fica onde você a deixar, e cada um guarda até ${MAX_CARTS}.`), onRight: false, options };
}

/** A player buys one of the tamer's carts (2026-11-02): paid first, and the money given back if the game would not make it. */
export function buyCart(player: Player, post: Post, cartId: string): { ok: boolean; message: string } {
    const cart = cartsForSale().find((one) => one.id === cartId);
    if (cart === undefined || post.guild !== "domitores") {
        return { ok: false, message: "Essa carroça não está à venda." };
    }
    if (cartsOf(player.steamId).length >= MAX_CARTS) {
        return { ok: false, message: `Você já tem ${MAX_CARTS} carroças, o máximo.` };
    }
    const price = CART_COINS * MONEY_UNIT;
    if (moneyOf(player) < price) {
        return { ok: false, message: `A ${cart.label.toLowerCase()} custa ${coins(price)} e você não tem o bastante.` };
    }
    if (!takeMoney(player, price)) {
        return { ok: false, message: "Não consegui receber o pagamento agora. Tente de novo." };
    }
    const given = giveCart(player, cart.id);
    if (!given.ok) {
        giveMoney(player, price);
        console.log(`guild-vendors: a carroça de ${player.nickname} não pôde vir: ${given.message}`);
        return { ok: false, message: "A carroça não pôde vir agora; o seu dinheiro foi devolvido. Tente de novo daqui a pouco." };
    }
    console.log(`guild-vendors: ${player.nickname} comprou ${cart.label} em ${post.id} por ${coins(price)}`);
    return { ok: true, message: `Você comprou uma ${cart.label.toLowerCase()} por ${coins(price)}: está à sua frente. Veja em Animais (F2) para dar um nome, trancá-la ou chamá-la.` };
}

/** The vendor's word when a player asks to buy: the trade opens, but the players come first (`TRADE_NUDGES`). */
function nudge(player: Player, post: Post, npc: Npc): void {
    const line = TRADE_NUDGES[Math.floor(Math.random() * TRADE_NUDGES.length)] ?? "";
    speak(npc, shopOf(post).npcName, say(player, line), { to: [player] });
}

/** The players who have learned a trade from a vendor: the first is free, and every one after it costs. */
const learned = new Set<string>();
let learnedWritable = true;

function loadLearned(): void {
    const loaded = read<{ learned?: unknown }>(LEARNED_FILE);
    if (loaded.status === "ok" && Array.isArray(loaded.value.learned)) {
        for (const steamId of loaded.value.learned) {
            if (typeof steamId === "string" && steamId !== "") {
                learned.add(steamId);
            }
        }
    } else if (loaded.status === "corrupt") {
        learnedWritable = false;
        console.log(`guild-vendors: ${LEARNED_FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
}

function saveLearned(): void {
    if (!learnedWritable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(LEARNED_FILE, { v: 1, learned: [...learned] });
    } catch (error: unknown) {
        console.log(`guild-vendors: não consegui gravar ${LEARNED_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Whether the trade is free for this player: the first one they ever learn from a vendor (no guild now, and none learnt before), and always for an administrator. */
export function isFirstTrade(player: Player, had: string | null): boolean {
    return isAdmin(player) || (had === null && !learned.has(player.steamId));
}

/** What the vendor says to somebody who asks to learn: why not, or what it takes. */
function learnPage(player: Player, post: Post): { page: DialoguePage; offer: boolean } {
    const shop = shopOf(post);
    const town = townOfPost(post);
    const guild = GUILDS.find((candidate) => candidate.id === post.guild);
    const profession = guild?.profession ?? shop.npcName;
    const back: DialogueOption = { id: "back", text: say(player, "Voltar"), enabled: true };
    const refuse = (line: string): { page: DialoguePage; offer: boolean } => ({ page: { line: say(player, line), onRight: false, options: [back] }, offer: false });
    if (player.steamId === "") {
        return refuse("Sem a sua identificação Steam eu não teria como registrar o seu ofício.");
    }
    const home = townOf(player.steamId);
    if (home === null) {
        return refuse(`Só ensino o ofício a quem é cidadão de ${town.name}. Escolha a sua cidade na seção Cidadania do menu F2 e volte.`);
    }
    if (home.id !== town.id) {
        return refuse(`Você é cidadão de ${home.name}. Aqui em ${town.name} só ensino a quem é daqui: procure o ${shop.npcName} da sua terra.`);
    }
    const had = getGuildId(player.steamId);
    if (had === post.guild) {
        return refuse(`Você já é ${profession}. Pratique o ofício: é só o que posso lhe dizer.`);
    }
    const hadGuild = had === null ? undefined : GUILDS.find((candidate) => candidate.id === had);
    const cost = isAdmin(player)
        ? ""
        : isFirstTrade(player, had)
            ? ` É a sua primeira vez: o ofício é de graça. Depois, cada ofício novo custa ${CHANGE_PRICE_COINS} moedas.`
            : had !== null
                ? ` Você deixaria ${hadGuild?.nameLatin ?? "a sua guilda"}: trocar de ofício custa ${CHANGE_PRICE_COINS} moedas.`
                : ` Aprender outro ofício custa ${CHANGE_PRICE_COINS} moedas.`;
    return {
        offer: true,
        page: {
            line: say(player, `Quer aprender o ofício de ${profession}? Em ${town.name}, quem é cidadão aprende comigo.${cost}`),
            onRight: false,
            options: [{ id: "accept", text: say(player, "Aceitar o ofício"), enabled: true }, back],
        },
    };
}

/** The player learns the trade: a first guild, or a change of guild, as the old choice in the panel was. */
export function learn(player: Player, post: Post): { ok: boolean; message: string } {
    const shop = shopOf(post);
    const town = townOfPost(post);
    const guild = GUILDS.find((candidate) => candidate.id === post.guild);
    if (guild === undefined || player.steamId === "") {
        return { ok: false, message: "Sua conta não tem identificação Steam, então a guilda não poderia ser salva." };
    }
    if (townOf(player.steamId)?.id !== town.id) {
        return { ok: false, message: `Só ensino quem é cidadão de ${town.name}.` };
    }
    const had = getGuildId(player.steamId);
    if (had === guild.id) {
        return { ok: false, message: `Você já faz parte de ${guild.nameLatin}.` };
    }
    // The first trade a player learns is free; every one after it costs, whatever is left of the free change of the panel.
    const first = isFirstTrade(player, had);
    let fee: Fee | null = null;
    if (!first) {
        fee = chargeChangePrice(player);
        if (!fee.ok) {
            return { ok: false, message: fee.message };
        }
    }
    if (!setGuildId(player.steamId, guild.id)) {
        fee?.refund();
        return { ok: false, message: "Essa guilda não pôde ser aprendida agora." };
    }
    if (!isAdmin(player)) {
        learned.add(player.steamId);
        saveLearned();
    }
    console.log(`guild-vendors: ${player.nickname} aprendeu ${guild.nameLatin} com ${shop.npcName} de ${town.name}${had !== null ? ` no lugar de ${had}` : ""} (${fee !== null ? `${CHANGE_PRICE_COINS} moedas` : isAdmin(player) ? "administrador" : "a primeira vez, de graça"})`);
    const handed = grantGuildKit(player, guild.id);
    if (handed.length > 0) {
        notice(player, `Kit da guilda entregue: ${handed.join(", ")}.`);
        if (guildKitHint(guild.id) !== "") {
            notice(player, guildKitHint(guild.id));
        }
    }
    sendSocial(player);
    return {
        ok: true,
        message: fee !== null
            ? `${shop.npcName} de ${town.name} lhe ensinou o ofício: você agora é ${guild.profession} (${guild.nameLatin}). Custou ${CHANGE_PRICE_COINS} moedas.`
            : isAdmin(player)
                ? `${shop.npcName} de ${town.name} lhe ensinou o ofício: você agora é ${guild.profession} (${guild.nameLatin}).`
                : `${shop.npcName} de ${town.name} lhe ensinou o ofício: você agora é ${guild.profession} (${guild.nameLatin}). Foi de graça, por ser a sua primeira vez: o próximo ofício custa ${CHANGE_PRICE_COINS} moedas.`,
    };
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, say(player, text));
}

/**
 * The horse each player bought from a tamer, by Steam id (2026-10-31): one at a time, and the next only when that one is dead. The horse's key is the one `horses.ts` keeps it under, found a moment
 * after it was handed over; the horse is alive for as long as `horses.ts` has a record under that key.
 */
const bought = new Map<string, { key: string | null; at: number }>();
const KEY_WAIT_MS = 30_000;

function loadBoughtHorses(): void {
    const loaded = read<{ bought?: Record<string, { key?: unknown; at?: unknown }> }>(HORSES_FILE);
    if (loaded.status === "ok" && typeof loaded.value.bought === "object" && loaded.value.bought !== null) {
        for (const [steamId, entry] of Object.entries(loaded.value.bought)) {
            if (/^\d{5,20}$/.test(steamId) && entry !== null && typeof entry === "object") {
                bought.set(steamId, { key: typeof entry.key === "string" ? entry.key : null, at: typeof entry.at === "number" ? entry.at : 0 });
            }
        }
    }
}

function saveBoughtHorses(): void {
    try {
        ensureDir(DIR);
        write(HORSES_FILE, { v: 1, bought: Object.fromEntries(bought) });
    } catch (error: unknown) {
        console.log(`guild-vendors: não consegui gravar ${HORSES_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function noteBoughtHorse(steamId: string, horse: Horse): void {
    bought.set(steamId, { key: keyOfHorse(horse), at: Date.now() });
    saveBoughtHorses();
    if (bought.get(steamId)?.key === null) {
        // `horses.ts` keeps the horse as it is handed over; the key is read again a moment later when it was not there yet.
        setTimeout(() => {
            const entry = bought.get(steamId);
            if (entry !== undefined && entry.key === null) {
                entry.key = keyOfHorse(horse);
                saveBoughtHorses();
            }
        }, 2_000);
    }
}

/** Whether the player's horse from a tamer is still alive (a horse that died, or that nobody keeps, no longer holds them back). */
export function ownsVendorHorse(steamId: string): boolean {
    const entry = bought.get(steamId);
    if (entry === undefined) {
        return false;
    }
    if (entry.key === null) {
        if (Date.now() - entry.at < KEY_WAIT_MS) {
            return true;
        }
        bought.delete(steamId);
        saveBoughtHorses();
        return false;
    }
    if (horseRecordOf(entry.key) !== null) {
        return true;
    }
    bought.delete(steamId);
    saveBoughtHorses();
    return false;
}

/** A player buys one of the tamer's weak horses. */
export function buyHorse(player: Player, post: Post, horseId: string): { ok: boolean; message: string } {
    const horse = horseOf(`horse:${horseId}`);
    if (horse === undefined || post.guild !== "domitores") {
        return { ok: false, message: "Esse cavalo não está à venda." };
    }
    if (ownsVendorHorse(player.steamId)) {
        return { ok: false, message: "Você já comprou um cavalo do domador: só pode comprar outro quando esse morrer." };
    }
    const price = horse.coins * MONEY_UNIT;
    if (moneyOf(player) < price) {
        return { ok: false, message: `O ${horse.label.toLowerCase()} custa ${coins(price)} e você não tem o bastante.` };
    }
    if (!takeMoney(player, price)) {
        return { ok: false, message: "Não consegui receber o pagamento agora. Tente de novo." };
    }
    let given: Horse | null = null;
    try {
        const { position, rotation } = inFrontOf(player, guildVendorSettings.horseM);
        let breed: string | undefined = horse.breed === "" ? undefined : horse.breed;
        if (breed !== undefined) {
            try {
                breed = Horse.breeds().includes(breed) ? breed : undefined;
            } catch {
                breed = undefined;
            }
        }
        // Born with the name it is sold under, its breed's and "Pangaré" (2026-11-02).
        given = Horse.spawn(position, rotation, breed, horse.label);
        dress(given, post.id);
        given.giveTo(player);
        noteBoughtHorse(player.steamId, given);
    } catch (error: unknown) {
        console.log(`guild-vendors: o cavalo de ${player.nickname} não pôde vir: ${error instanceof Error ? error.message : String(error)}`);
        try {
            given?.destroy();
        } catch {
            // Never made.
        }
        giveMoney(player, price);
        return { ok: false, message: "O cavalo não pôde vir agora; o seu dinheiro foi devolvido. Tente de novo daqui a pouco." };
    }
    console.log(`guild-vendors: ${player.nickname} comprou ${horse.label} em ${post.id} por ${coins(price)}`);
    return { ok: true, message: `Você comprou ${horse.label} por ${coins(price)}: veja em Animais (F2) para mudar o nome. Ele vem com sela, rédeas e ferraduras simples.` };
}

/**
 * The vendor says the line of the page it shows (2026-11-02, user: "as frases dele e dos NPCs não estão saindo nem aparecendo; o correto devia ser uma sequência de diálogo"): above the
 * choices, as the page has it, and as its speech in the player's chat card, one line after another as the talk goes on (`npc-speech.ts`).
 */
function sayPage(player: Player, npc: Npc | null, post: Post, page: DialoguePage): void {
    if (npc === null || page.line === undefined || page.line === "") {
        return;
    }
    const { author, text } = splitSpeaker(page.line, shopOf(post).npcName);
    speak(npc, author, text, { to: [player] });
}

function openMenu(player: Player, post: Post, npc: Npc): boolean {
    if (!player.ready || !player.alive || Dialogue.sessionOf(player.id) !== 0) {
        return false;
    }
    const page = mainPage(player, post);
    const session = Dialogue.open(player.id, page);
    if (session === 0) {
        return false;
    }
    menus.set(session, { playerId: player.id, steamId: player.steamId, postId: post.id, npcId: npc.id, page: "main" });
    sayPage(player, npc, post, page);
    return true;
}

function show(session: number, menu: Menu, page: DialoguePage, name: Menu["page"]): void {
    menu.page = name;
    if (!Dialogue.update(session, page)) {
        menus.delete(session);
        return;
    }
    const player = Player.getById(menu.playerId);
    const post = postById.get(menu.postId);
    if (player !== null && post !== undefined) {
        sayPage(player, Npc.getById(menu.npcId), post, page);
    }
}

function choose(session: number, player: Player, option: string): void {
    const menu = menus.get(session);
    const post = menu === undefined ? undefined : postById.get(menu.postId);
    if (menu === undefined || post === undefined || menu.playerId !== player.id || menu.steamId !== player.steamId) {
        return;
    }
    const npc = Npc.getById(menu.npcId);
    if (option === "leave" || npc === null) {
        menus.delete(session);
        Dialogue.close(session);
        return;
    }
    if (option === "back") {
        show(session, menu, mainPage(player, post), "main");
        return;
    }
    if (option === "trade" || option === "wares") {
        if (option === "trade") {
            nudge(player, post, npc);
        }
        if (option === "trade" && post.guild === "domitores") {
            show(session, menu, horsesPage(player, post), "horses");
            return;
        }
        menus.delete(session);
        Dialogue.close(session);
        if (!openTrade(player, post, npc)) {
            tell(player, "O comerciante não pôde atender agora. Tente de novo em instantes.");
        }
        return;
    }
    if (option === "learn") {
        const { page, offer } = learnPage(player, post);
        show(session, menu, page, offer ? "offer" : "learn");
        return;
    }
    // The questions about the trade (2026-11-01).
    if (option === "ask" || option === "questions") {
        menu.topic = undefined;
        menu.part = undefined;
        show(session, menu, questionsPage(player, post), "ask");
        return;
    }
    if (option.startsWith("q:") && menu.page === "ask") {
        const page = answerPage(player, post, option.slice(2), 0);
        if (page !== null) {
            menu.topic = option.slice(2);
            menu.part = 0;
            show(session, menu, page, "answer");
        }
        return;
    }
    if (option === "next" && menu.page === "answer" && menu.topic !== undefined) {
        const part = (menu.part ?? 0) + 1;
        const page = answerPage(player, post, menu.topic, part);
        if (page !== null) {
            menu.part = part;
            show(session, menu, page, "answer");
        }
        return;
    }
    if (option === "accept" && menu.page === "offer") {
        const result = learn(player, post);
        menus.delete(session);
        Dialogue.close(session);
        if (result.ok) {
            notice(player, result.message);
        } else {
            tell(player, result.message);
        }
        return;
    }
    if (option === "carts") {
        show(session, menu, cartsPage(player, post), "carts");
        return;
    }
    if (option === "horses") {
        show(session, menu, horsesPage(player, post), "horses");
        return;
    }
    if (option.startsWith("cart:") && menu.page === "carts") {
        const result = buyCart(player, post, option.slice(5));
        tell(player, result.message);
        show(session, menu, cartsPage(player, post), "carts");
        return;
    }
    if (option.startsWith("horse:") && menu.page === "horses") {
        const result = buyHorse(player, post, option.slice(6));
        tell(player, result.message);
        show(session, menu, horsesPage(player, post), "horses");
    }
}

/** A talk or a trade whose player walked off, died or left is closed. */
export function tidy(now: number = Date.now()): void {
    for (const [session, menu] of [...menus]) {
        const player = Player.getById(menu.playerId);
        const npc = Npc.getById(menu.npcId);
        if (player === null || npc === null || player.steamId !== menu.steamId || !player.alive || flat(player.position, npc.position) > guildVendorSettings.talkM) {
            menus.delete(session);
            Dialogue.close(session);
        }
    }
    for (const session of [...sessions.values()]) {
        const player = Player.getById(session.playerId);
        if (player === null || player.steamId !== session.steamId || (Vendor.sessionOf(session.playerId) === 0 && now - session.opened > guildVendorSettings.tradeGraceMs)) {
            dropSession(session.playerId);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// What an administrator can do.

export function describeGuildPosts(town?: string): string[] {
    const night = isNight();
    const lines: string[] = [];
    for (const post of POSTS) {
        if (town !== undefined && post.town !== town) {
            continue;
        }
        const spot = spotOf(post);
        const state = bodies.has(post.id) ? "em pé" : night ? "ausente (é noite: só existem de dia)" : "ausente (ninguém por perto)";
        lines.push(`  ${post.id}: ${shopOf(post).npcName}, ${state}, em ${Math.round(spot.x)}, ${Math.round(spot.y)}, ${Math.round(spot.z)}${chosen[post.id] !== undefined ? " (lugar escolhido)" : post.source === "ring" ? " (em volta do meio da vila: sem lugar certo no jogo)" : ""}`);
    }
    return lines.length > 0 ? lines : [`  Nenhum vendedor em '${town}'.`];
}

/** One vendor on the administrator's list: `state` is `up` (in the world), `night` (gone for the night) or `away` (no player near); `place` says where its spot came from. */
export interface NpcRow {
    readonly id: string;
    readonly guild: string;
    readonly trade: string;
    readonly name: string;
    readonly state: "up" | "night" | "away" | "off";
    readonly place: "game" | "ring" | "chosen";
    readonly at: readonly [number, number, number];
    /** A barber or a coachman of the fast travel (2026-11-02), not a guild's vendor: listed with the command that moves it (`cmd`), and not switched off from the panel. */
    readonly kind?: "barbeiro" | "cocheiro";
    readonly cmd?: string;
}

export interface NpcTown {
    readonly id: string;
    readonly name: string;
    readonly posts: NpcRow[];
}

export interface NpcGroup {
    readonly id: string;
    readonly name: string;
    readonly towns: NpcTown[];
}

/**
 * The vendors by region (a seat and its lands) and by village, each with the id `/mercador aqui <id>` takes (2026-10-31, user: "na seção admin do F3 uma seção onde possa ver NPCs, nome, separados
 * por região e vila, junto do id, assim eu posso usar o mercador aqui e colocar o id; o NPC fica nesse local").
 */
/** The town whose region a point is in (`REGIONS`), or the town of the nearest region's box. */
function townAt(x: number, y: number): Town | null {
    let best: { readonly name: string } | null = null;
    let away = Number.POSITIVE_INFINITY;
    for (const region of REGIONS) {
        const dx = Math.max(region.minX - x, 0, x - region.maxX);
        const dy = Math.max(region.minY - y, 0, y - region.maxY);
        const distance = Math.hypot(dx, dy);
        if (distance < away) {
            away = distance;
            best = region;
        }
    }
    return best === null ? null : (TOWNS.find((town) => town.region === best?.name) ?? null);
}

/**
 * The barbers and the coachmen of the fast travel, for the NPCs section beside the guild vendors (2026-11-02): each with the command that puts it where the administrator stands
 * (`cmd`); they are not switched off from the panel.
 */
function otherNpcs(night: boolean): Array<{ readonly town: Town | null; readonly entry: NpcRow }> {
    const out: Array<{ readonly town: Town | null; readonly entry: NpcRow }> = [];
    const add = (kind: "barbeiro" | "cocheiro", one: { readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly z: number; readonly chosen: boolean; readonly up: boolean }, trade: string, cmd: string): void => {
        out.push({
            town: townAt(one.x, one.y),
            entry: { id: kind === "cocheiro" ? `cocheiro-${one.id}` : one.id, kind, guild: "", trade, name: one.name, state: one.up ? "up" : night ? "night" : "away", place: one.chosen ? "chosen" : "game", at: [Math.round(one.x), Math.round(one.y), Math.round(one.z)] as const, cmd },
        });
    };
    try {
        for (const barber of barberListing()) {
            add("barbeiro", barber, "Barbeiro", `/barbeiro aqui ${barber.id}`);
        }
    } catch {
        // The barbers are not installed.
    }
    try {
        for (const stop of coaches.coachListing()) {
            add("cocheiro", { ...stop, name: "Cocheiro" }, `Cocheiro (${stop.name})`, `/viagem cocheiro ${stop.id}`);
        }
    } catch {
        // The travel is not installed.
    }
    return out;
}

/**
 * The vendors as the administrator sees them: all of them, the barbers and the coachmen too, with where each stands and the command that moves it. (From 2026-11-04 to 2026-11-09 the lord
 * of lands saw his own vendors here too, to switch them; that screen is gone, and the list is the administrator's alone.)
 */
export function npcListing(): { groups: NpcGroup[]; total: number } {
    const night = isNight();
    const order = (post: Post): number => SHOPS.findIndex((shop) => shop.guild === post.guild);
    const groups: NpcGroup[] = [];
    for (const town of TOWNS) {
        const posts = POSTS.filter((post) => post.town === town.id).sort((a, b) => order(a) - order(b));
        if (posts.length === 0) {
            continue;
        }
        const seatId = town.seat ?? town.id;
        let group = groups.find((one) => one.id === seatId);
        if (group === undefined) {
            group = { id: seatId, name: `${townById(seatId)?.name ?? town.name} e as suas terras`, towns: [] };
            groups.push(group);
        }
        group.towns.push({
            id: town.id,
            name: town.name,
            posts: posts.map((post): NpcRow => {
                const spot = spotOf(post);
                return {
                    id: post.id,
                    guild: post.guild,
                    trade: tradeLabel(post),
                    name: shopOf(post).npcName,
                    state: disabled.has(post.id) ? "off" : bodies.has(post.id) ? "up" : night ? "night" : "away",
                    place: chosen[post.id] !== undefined ? "chosen" : post.source === "ring" ? "ring" : "game",
                    at: [Math.round(spot.x), Math.round(spot.y), Math.round(spot.z)] as const,
                };
            }),
        });
    }
    // The barbers and the coachmen, each under the town of the region it stands in (a town with none of the vendors gets a place of its own).
    const others = otherNpcs(night);
    for (const { town, entry } of others) {
        const where = town ?? TOWNS[0];
        if (where === undefined) {
            continue;
        }
        const seatId = where.seat ?? where.id;
        let group = groups.find((one) => one.id === seatId);
        if (group === undefined) {
            group = { id: seatId, name: `${townById(seatId)?.name ?? where.name} e as suas terras`, towns: [] };
            groups.push(group);
        }
        let place = group.towns.find((one) => one.id === where.id);
        if (place === undefined) {
            place = { id: where.id, name: where.name, posts: [] };
            group.towns.push(place);
        }
        place.posts.push(entry);
    }
    return { groups, total: POSTS.length + others.length };
}

export function moveGuildPost(id: string, position: { x: number; y: number; z: number }, yaw: number): boolean {
    const post = postById.get(id);
    if (post === undefined) {
        return false;
    }
    chosen[id] = { x: position.x, y: position.y, z: position.z, yaw };
    saveChosen();
    grounded.delete(id);
    askAgain.delete(id);
    if (bodies.has(id)) {
        dropBody(id);
        try {
            spawnBody(post);
        } catch (error: unknown) {
            console.log(`guild-vendors: ${id} não foi para o lugar novo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return true;
}

export function resetGuildPosts(id?: string): number {
    const ids = id === undefined ? Object.keys(chosen) : chosen[id] === undefined ? [] : [id];
    for (const one of ids) {
        delete chosen[one];
        grounded.delete(one);
        askAgain.delete(one);
        const post = postById.get(one);
        if (post !== undefined && bodies.has(one)) {
            dropBody(one);
            try {
                spawnBody(post);
            } catch {
                // The next look makes it.
            }
        }
    }
    if (ids.length > 0) {
        saveChosen();
    }
    return ids.length;
}

export const guildPostCount = (): number => POSTS.length;

export function installGuildVendors(): void {
    if (!guildVendorSettings.enabled) {
        console.log(`guild-vendors: desligados: nenhum dos ${POSTS.length} comerciantes de guilda fica no mundo`);
        return;
    }
    loadChosen();
    loadDisabled();
    loadBoughtHorses();
    loadRecords(Date.now());
    loadLearned();
    // The towns' pages count the people who live in them: a vendor an administrator switched off lives nowhere (2026-11-01).
    npcCounters.push((town) => POSTS.filter((post) => post.town === town.id && !disabled.has(post.id)).length);
    console.log(`guild-vendors: ${POSTS.length} comerciantes de guilda em ${new Set(POSTS.map((post) => post.town)).size} cidades (${POSTS.filter((post) => post.source !== "ring").length} nos lugares do jogo, ${POSTS.filter((post) => post.source === "ring").length} em volta do meio da vila); ${SHOPS.length} ofícios`);

    const start = setTimeout(() => lookAtPosts(), guildVendorSettings.spawnAfterMs);
    const look = setInterval(() => lookAtPosts(), guildVendorSettings.tickMs);
    const tidying = setInterval(() => tidy(), 2_000);

    Events.on("npcInteract", (npc, player) => {
        const post = byNpc.get(npc.id);
        if (post !== undefined) {
            // It turns to the player, and back to its own way when the talk (and the trade) is over (2026-11-02).
            npc.lookAt(player);
            openMenu(player, post, npc);
            turnBackAfterTalk(npc, player, spotOf(post).yaw);
        }
    });
    Events.on("npcDeath", (npc) => {
        const post = byNpc.get(npc.id);
        if (post !== undefined) {
            byNpc.delete(npc.id);
            bodies.delete(post.id);
            setTimeout(() => {
                try {
                    Npc.getById(npc.id)?.remove();
                } catch {
                    // Gone.
                }
            }, 10_000);
        }
    });
    Events.on("dialogueChoice", (session, player, option) => choose(session, player, option));
    Events.on("dialogueClosed", (session) => {
        menus.delete(session);
    });
    // The page's "Desativar NPC" / "Ativar NPC": an administrator's only (the lord's screen was taken out on 2026-11-09, and the lock with it). The list comes back as it is now.
    Events.onClient(`${RESOURCE}:status.npcDisable`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const fields = payloadFields(payload);
        const id = fields["id"];
        const off = fields["off"];
        if (typeof id === "string" && (off === 0 || off === 1 || typeof off === "boolean") && setPostDisabled(id, off === 1 || off === true)) {
            console.log(`guild-vendors: ${player.nickname} ${off === 1 || off === true ? "desativou" : "ativou"} ${id}`);
        }
        emitLarge(player, "status.npcs", JSON.stringify(npcListing()));
    });
    // The page "NPCs" asks for the list when it opens: the administrator's, nothing for anybody else.
    Events.onClient(`${RESOURCE}:status.npcs`, (sender) => {
        const player = sender as Player;
        if (isAdmin(player)) {
            emitLarge(player, "status.npcs", JSON.stringify(npcListing()));
        }
    });
    Events.on("vendorTrade", (vendor, player, bought, sold) => traded(vendor, player, bought, sold));
    Events.on("playerDisconnect", (player) => {
        dropSession(player.id);
        for (const [session, menu] of [...menus]) {
            if (menu.playerId === player.id) {
                menus.delete(session);
            }
        }
    });
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearTimeout(start);
        clearInterval(look);
        clearInterval(tidying);
        for (const id of [...bodies.keys()]) {
            dropBody(id);
        }
        for (const player of [...vendorOfPlayer.keys()]) {
            dropSession(player);
        }
        if (recordSave !== null) {
            clearTimeout(recordSave);
            recordSave = null;
            try {
                write(SHOPS_FILE, { v: 1, records: Object.fromEntries(records) });
            } catch {
                // Nothing more to do.
            }
        }
    });
}
