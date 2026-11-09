/**
 * What the guild vendors sell and buy, and at what price (2026-10-31, user: "vamos colocar novamente os npcs vendedores ... na compra ou venda o npc vai ter um valor de 300 moedas individual
 * por players assim mesmo se outro jogador zerar ele o valor continua para você, o npc também só vai vender até o valor de 300 moedas, cada npc reflete a uma única guilda ... eles só vão vender
 * itens básicos ... e só comprar coisas de sua guilda ... pensando na Boêmia em 1403 os valores das coisas devem ser mais baixos, bem mais baixo ... e padronizar as precificações por raridade
 * do item").
 *
 * There is one vendor for each of the eight guilds in each town (`guild-posts-data.ts`), and each vendor is the same everywhere: the smith sells repair kits and the forge's metal, the hunter
 * skins and arrows, the Coletor an axe and a pick, the tavern keeper the kitchen's staples, the farmer the seeds of the plain crops, the apothecary flowers and drinking water, the tamer a plain
 * horse and what a horse is fed, the artisan thread, linen and hides. What each buys is the goods of its own trade and nothing else.
 *
 * The price is the item's RARITY and nothing else: a common thing costs 2 coins, an uncommon one 6, a rare one 18, a very rare one 50, an exceptional one (a horse) 150, and a vendor pays 40% of
 * that for what a player brings. The rarity of what a vendor sells is set below, item by item; the rarity of what it only buys comes from what the game says the item is worth, in bands
 * (`rarityFromWorth`). The game's own prices are three to ten times these.
 *
 * Each player has a purse of their own with each GUILD's vendors: a shelf worth no more than 300 coins to buy from (what is bought is gone for that player until the next day) and 300 coins the
 * vendors pay out for the player's goods. The limit is the guild's, not the vendor's (2026-10-31, user: "o limite de 300 deve ser refletido em todos os NPCs do mesmo tipo no mapa, isso evita o jogador
 * farmar infinito"): what a player took from the smith of one town is gone at the smith of every other. Another player emptying the shelf or the purse changes nothing for you. A day after a purse
 * was filled it is full again (`currentRecord`).
 */

import { CRAFT_RECIPES, FARM_CROPS, FARM_PROCESSES } from "./craft-data.js";
import type { CraftRecipe, FarmCrop, FarmProcess } from "./craft-data.js";
import { MONEY_UNIT } from "./money.js";

export type Rarity = "comum" | "incomum" | "raro" | "muito-raro" | "excepcional";

/** What each rarity costs, in coins. */
export const RARITY_COINS: Readonly<Record<Rarity, number>> = { comum: 2, incomum: 6, raro: 18, "muito-raro": 50, excepcional: 150 };

/** The share of a standard price that a vendor pays for what a player brings. */
export const BUY_SHARE = 0.4;

/** The coins of a shelf and of a purse, for each player and each vendor. */
export const BUDGET_COINS = 300;

/** A purse and a shelf come back full this long after they were filled. */
export const REFILL_MS = 24 * 60 * 60_000;

/** The game takes at most this many rows of a vendor's prices. */
export const MAX_ROWS = 128;

/** What a thing costs: its rarity's price in the game's money units. */
export const priceUnits = (rarity: Rarity): number => RARITY_COINS[rarity] * MONEY_UNIT;

/** What a vendor pays for one: the share of that price, never less than a unit. */
export const buyUnits = (rarity: Rarity): number => Math.max(1, Math.round(RARITY_COINS[rarity] * MONEY_UNIT * BUY_SHARE));

/** The rarity of a thing the game says is worth `coins` (a vendor only buys it, so there is no entry of its own): bands, in the game's coins. */
export function rarityFromWorth(coins: number): Rarity {
    if (coins <= 4) {
        return "comum";
    }
    if (coins <= 15) {
        return "incomum";
    }
    if (coins <= 60) {
        return "raro";
    }
    return coins <= 200 ? "muito-raro" : "excepcional";
}

export interface Ware {
    /** A game item name or GUID, or one of ours (`kcdc-craft:...`); for a horse, its id in `HORSES`. */
    readonly item: string;
    readonly rarity: Rarity;
    readonly amount: number;
}

export interface HorseWare {
    readonly id: string;
    readonly label: string;
    readonly rarity: Rarity;
    /** The breed of `Horse.breeds()` it is, or "" for the generic riding horse. */
    readonly breed: string;
    /** What it costs, in coins. */
    readonly coins: number;
}

/**
 * The horses the tamers sell: only the three weakest of the game's, all at 200 coins (2026-10-31, user: "os vendedores de cavalo devem vender apenas os 3 tipos de cavalos mais fracos, por 200"; it
 * was 200, 300 and 400 a few hours before). Pebbles, the generic riding horse and Bitterklee, in the plain tack of a tamed horse. A player buys one at a time (the next only when that one is dead).
 * They are not on the trade screen's shelf.
 */
/**
 * 400 coins since 2026-11-02, and each sold under its breed's name and "Pangaré", which is also the name the horse is born with (user: "os cavalos vamos subir para 400 moedas; cavalos vamos dar
 * o nome da raça mais ' - Pangaré'").
 */
export const HORSE_COINS = 400;

export const HORSES: readonly HorseWare[] = [
    { id: "pebbles", label: "Pebbles - Pangaré", rarity: "comum", breed: "pebbles", coins: HORSE_COINS },
    { id: "cavalo-comum", label: "Montaria - Pangaré", rarity: "comum", breed: "", coins: HORSE_COINS },
    { id: "bitterklee", label: "Bitterklee - Pangaré", rarity: "comum", breed: "bitterklee", coins: HORSE_COINS },
];

/**
 * The carts the tamers sell (2026-11-02, user: "domadores NPC precisam vender carroças também por 800 moedas; vender umas 4 tá bom"): four of the game's own, each born the buyer's where they
 * stand (`carts.ts`, `giveCart`), within the two carts a player may keep. One the game does not have is not offered.
 */
export const CART_COINS = 800;

export interface CartWare {
    /** The game's prefab (`Cart.blueprints()`). */
    readonly id: string;
    readonly label: string;
}

export const CARTS: readonly CartWare[] = [
    { id: "cart_b", label: "Carro de duas rodas" },
    { id: "wagon_b", label: "Carroça aberta" },
    { id: "wagon_b_covered", label: "Carroça coberta" },
    { id: "wagon_a_cloth_carpets", label: "Carroça de tapetes" },
];

/**
 * What a vendor says when a player asks to buy (2026-11-02, user: "todo NPC ao interagir com ele e clicar em comprar ele deve falar algo tipo 'bom, eu posso negociar com vocês, mas acho
 * melhor procurar outra pessoa para negociar', incentivando negociações entre players"): the trade opens all the same.
 */
export const TRADE_NUDGES: readonly string[] = [
    "Bom, eu posso negociar com você, mas acho melhor procurar outra pessoa para negociar: quem faz o ofício vende melhor e mais barato.",
    "Posso vender, claro. Mas se eu fosse você, perguntava antes aos outros da vila: entre vocês o negócio sai mais justo.",
    "Negocio, sim... mas os artesãos daqui fazem coisa melhor que a minha prateleira. Procure um deles primeiro.",
];

export interface GuildShop {
    /** The guild this vendor belongs to (`GUILDS` of status.ts). */
    readonly guild: string;
    /** What the trade is called in the posts' ids (`<trade>-<town>`). */
    readonly trade: string;
    readonly npcName: string;
    readonly female: boolean;
    /** A clothing preset of the game's table, or "" for a villager's. */
    readonly outfit: string;
    /** What the vendor says when talked to. */
    readonly greeting: string;
    readonly sells: readonly Ware[];
    /** The trade of `data/vendor-buys.json` whose goods it buys, or "" for none. */
    readonly buysOf: string;
    /** Goods it buys besides those. */
    readonly buys: readonly string[];
}

const ware = (item: string, rarity: Rarity, amount: number): Ware => ({ item, rarity, amount });

/** The lumberjack's axe (axeWork01) and the knight's pick, the only ones the game has for the Coletores (`gather.ts`). */
export const AXE_ITEM = "1fc42528-2bef-4dde-bf8a-04febeef41c8";
export const PICK_ITEM = "0f0164d5-3746-4d07-a1ed-0f138225a6d9";

/** The plain crops: the vegetables, the grains and the flax, the seeds the farmer sells. */
const PLAIN_CATEGORIES = new Set(["Legumes", "Grãos", "Fibras"]);

/**
 * The fruit seeds and saplings the farmer sells besides the plain ones (2026-11-02, user: "mais sementes e frutos para plantação"): the berries and three trees of the new fruit, which come
 * from nowhere else (the older fruit are found in the field), so that a farmer can begin an orchard. Two of each, dearer than a bean. The vine's saplings too since 2026-11-04 (user: "NPC vender
 * sementes de uva e poder achar no mundo, para o agricultor poder plantar uvas e o taverneiro fazer vinho"): the grapes are the wine's, and a vine was found nowhere (the chests of the world
 * hold its saplings now, `treasure.ts`).
 */
const SOLD_FRUITS: ReadonlySet<string> = new Set(["morango", "amora", "framboesa", "mirtilo", "groselha", "cereja", "marmelo", "avela", "uva"]);

/**
 * The farmer's shelf, a day's worth for each player that fits the purse of `BUDGET_COINS` whole (a shelf worth more is cut down evenly, and what comes to less than one goes): the horses'
 * carrots and apples (2026-11-02, user: "vamos colocar o NPC agricultor para vender cenoura e maçã também, para os cavalos não morrerem de fome"), 15 of each (60 coins),
 * three of each plain seed (22 kinds: 132; one sows a bed, and its harvest gives one or two back) and two of each fruit's (8 kinds at 6: 96). 288 coins.
 */
const HORSE_FEED_SOLD = 15;
/**
 * The carrot and the apple by the class the gardens' harvest is filed under (`FARM_CROPS`), not by the game's name: the farmer also buys them back as harvest, and a name and a GUID of
 * one class are two rows to the list's own check but one class to the game, which refuses the whole buying list for it ("lists the same item as an earlier row", 2026-11-02 04:31 UTC:
 * no trade screen opened at any Agricultor).
 */
const harvestOf = (crop: string, name: string): string => FARM_CROPS.find((one) => one.id === crop)?.harvest ?? name;
const PLAIN_SEEDS_SOLD = 3;
const FRUIT_SEEDS_SOLD = 2;

export const SHOPS: readonly GuildShop[] = [
    {
        guild: "fabri-ferrarii",
        trade: "ferreiro",
        npcName: "Mestre Ferreiro",
        female: false,
        outfit: "12468c7d-7ab1-4afc-b102-b0e74c144e8c",
        greeting: "O ferro não espera. Kits de reparo e metal de forja, é o que tenho.",
        sells: [
            ware("special_charcoal", "comum", 20),
            ware("bsmt_ironBad", "comum", 20),
            ware("bsmt_hardware", "comum", 13),
            ware("bsmt_ironGood", "incomum", 10),
            ware("bsmt_steelBad", "incomum", 5),
            ware("bsmt_copper", "incomum", 2),
            ware("repairKit_armourSmall", "raro", 2),
            ware("repairKit_weaponSmall", "raro", 2),
            ware("repairKit_bowyerSmall", "raro", 1),
        ],
        buysOf: "ferreiro",
        buys: ["kcdc-craft:lenha", "kcdc-craft:minerio-prata", "kcdc-craft:barra-prata"],
    },
    {
        guild: "venatores",
        trade: "cacador",
        npcName: "Mestre Caçador",
        female: false,
        outfit: "54cec4c4-ad5a-4d48-8bad-5c98b528b0b0",
        greeting: "Peles e flechas, nada mais. O resto a mata dá a quem sabe pedir.",
        sells: [
            ware("special_cowSkin", "incomum", 6),
            ware("special_pigSkin", "incomum", 6),
            ware("skin_sheep", "comum", 8),
            ware("special_deerSkin", "raro", 3),
            ware("arrow_crude", "comum", 30),
            ware("arrow_normal", "incomum", 10),
            ware("arrow_hunting", "incomum", 6),
        ],
        buysOf: "cacador",
        buys: ["special_deerSkin", "special_cowSkin", "special_pigSkin", "skin_sheep", "arrow_enh_hunting"],
    },
    {
        guild: "tabernarii",
        trade: "taberneiro",
        npcName: "Taberneiro",
        female: false,
        outfit: "9084ce28-b604-411a-9a7e-f3750a27a5b0",
        greeting: "Farinha, malte, lúpulo e o que mais a cozinha pedir. Sirva-se do básico.",
        sells: [
            ware("kcdc-craft:farinha", "comum", 20),
            ware("kcdc-craft:malte", "comum", 15),
            ware("kcdc-craft:lupulo", "comum", 15),
            ware("egg", "comum", 20),
            ware("water", "comum", 20),
            ware("milk", "comum", 10),
            ware("loot_salt", "comum", 10),
            ware("honey", "incomum", 5),
            ware("special_lard", "incomum", 5),
        ],
        buysOf: "taberneiro",
        buys: [],
    },
    {
        guild: "alchemistae",
        trade: "alquimista",
        npcName: "Boticário",
        female: false,
        outfit: "6d7407c7-7504-4432-9695-01567ffed4a6",
        greeting: "Flores do campo e água limpa: o princípio de qualquer remédio.",
        sells: [
            ...["chamomile", "dandelion", "marigold", "hypericum", "mint", "salvia", "valerian", "thistle", "comfrey", "urticaria"].map((herb) => ware(`herb_${herb}`, "comum", 12)),
            ware("water", "comum", 30),
        ],
        buysOf: "alquimista",
        buys: [],
    },
    {
        guild: "artifices",
        trade: "artesao",
        npcName: "Costureira",
        female: true,
        outfit: "",
        greeting: "Linha, linho e couro para quem costura. Do pano, cada um faz o que sabe.",
        sells: [
            ware("kcdc-craft:linha", "comum", 40),
            ware("loot_cloth", "comum", 35),
            ware("skin_sheep", "comum", 10),
            ware("special_cowSkin", "incomum", 6),
            ware("special_pigSkin", "incomum", 6),
            ware("special_deerSkin", "raro", 2),
        ],
        buysOf: "alfaiate",
        buys: ["kcdc-craft:linha", "loot_cloth", "skin_sheep", "special_cowSkin", "special_pigSkin", "special_deerSkin"],
    },
    {
        guild: "collectores",
        trade: "coletor",
        npcName: "Mestre Coletor",
        female: false,
        outfit: "",
        greeting: "Machado para a lenha, picareta para a pedra. É o que o ofício pede.",
        sells: [ware(AXE_ITEM, "raro", 8), ware(PICK_ITEM, "raro", 8)],
        buysOf: "",
        buys: [
            // Not the chip of stone (2026-11-03): it is the rocks' nothing, a quarter of every strike, and at a common thing's price it was money.
            "kcdc-craft:lenha", "kcdc-craft:madeira", "kcdc-craft:minerio-prata", "walnuts", "loot_salt", "bsmt_ironBad", "bsmt_ironGood", "bsmt_hardware", "bsmt_copper",
            "bsmt_jaspis", "bsmt_emailPowder", "special_sulfur", "special_saltpeter", "special_cobweb", "bsmt_woodExotic",
        ],
    },
    {
        guild: "agricolae",
        trade: "agricultor",
        npcName: "Agricultor",
        female: false,
        outfit: "",
        greeting: "Sementes das lavouras de sempre. Quem planta cedo colhe cedo.",
        sells: [
            ware(harvestOf("cenoura", "carrot"), "comum", HORSE_FEED_SOLD),
            ware(harvestOf("maca", "apple"), "comum", HORSE_FEED_SOLD),
            ...FARM_CROPS.filter((crop) => PLAIN_CATEGORIES.has(crop.category)).map((crop) => ware(crop.seed, "comum", PLAIN_SEEDS_SOLD)),
            ...FARM_CROPS.filter((crop) => SOLD_FRUITS.has(crop.id)).map((crop) => ware(crop.seed, "incomum", FRUIT_SEEDS_SOLD)),
        ],
        buysOf: "",
        buys: FARM_CROPS.flatMap((crop) => [crop.harvest, crop.seed]),
    },
    {
        guild: "domitores",
        trade: "domador",
        npcName: "Mestre Domador",
        female: false,
        outfit: "",
        greeting: "Cavalo manso, de sela e rédea simples. E o que um cavalo come, para ganhar-lhe a confiança.",
        sells: [ware("carrot", "comum", 15), ware("apple", "comum", 15), ware("pear", "comum", 10), ware("beet", "comum", 10), ware("turnip", "comum", 10)],
        buysOf: "",
        buys: ["carrot", "apple", "pear", "beet", "turnip", "parsnip", "bread", "horseshoeMilitary"],
    },
];

export function shopOfGuild(guild: string): GuildShop | undefined {
    return SHOPS.find((shop) => shop.guild === guild);
}

export const isHorseKey = (item: string): boolean => item.startsWith("horse:");

export const horseOf = (item: string): HorseWare | undefined => HORSES.find((horse) => item === `horse:${horse.id}`);

/** What a shelf is worth in coins at the standard prices. */
export function shelfCoins(wares: readonly Ware[]): number {
    return wares.reduce((sum, one) => sum + RARITY_COINS[one.rarity] * one.amount, 0);
}

/** The shelf a vendor starts a day with: the wares as written, scaled down together if they came to more than a purse (never up). */
export function nominalShelf(shop: GuildShop): Ware[] {
    const worth = shelfCoins(shop.sells);
    const scale = worth > BUDGET_COINS ? BUDGET_COINS / worth : 1;
    if (scale === 1) {
        return shop.sells.map((one) => ({ ...one }));
    }
    return shop.sells.map((one) => ({ ...one, amount: Math.floor(one.amount * scale) })).filter((one) => one.amount > 0);
}

/** What one player has with one vendor: when it was filled, what is left to buy of each ware, and what the vendor still pays out (in money units). */
export interface ShopRecord {
    since: number;
    left: Record<string, number>;
    purse: number;
}

export function freshRecord(shop: GuildShop, now: number): ShopRecord {
    const left: Record<string, number> = {};
    for (const one of nominalShelf(shop)) {
        left[one.item] = one.amount;
    }
    return { since: now, left, purse: BUDGET_COINS * MONEY_UNIT };
}

/** The record to deal by now: what was kept, cleaned and read against today's wares, or a fresh one when none was kept or a day has passed since it was filled. */
export function currentRecord(shop: GuildShop, saved: ShopRecord | undefined, now: number): ShopRecord {
    if (saved === undefined || typeof saved.since !== "number" || !Number.isFinite(saved.since) || now - saved.since >= REFILL_MS || now < saved.since) {
        return freshRecord(shop, now);
    }
    const nominal = freshRecord(shop, saved.since);
    const left: Record<string, number> = {};
    for (const [item, full] of Object.entries(nominal.left)) {
        const kept = saved.left?.[item];
        left[item] = typeof kept === "number" && Number.isFinite(kept) ? Math.max(0, Math.min(full, Math.floor(kept))) : full;
    }
    const purse = typeof saved.purse === "number" && Number.isFinite(saved.purse) ? Math.max(0, Math.min(nominal.purse, Math.floor(saved.purse))) : nominal.purse;
    return { since: saved.since, left, purse };
}

/** The record after a deal: what was bought is gone from the shelf, and the purse is what the vendor has left (it never grows: what a player pays does not become the vendor's to pay out). */
export function afterDeal(record: ShopRecord, bought: ReadonlyArray<{ readonly item: string; readonly amount: number }>, purseNow: number | null): ShopRecord {
    const left = { ...record.left };
    for (const line of bought) {
        if (left[line.item] !== undefined) {
            left[line.item] = Math.max(0, (left[line.item] as number) - Math.max(0, Math.floor(line.amount)));
        }
    }
    return { since: record.since, left, purse: purseNow === null ? record.purse : Math.max(0, Math.min(record.purse, Math.floor(purseNow))) };
}

/** Two records one player has with one guild (a file from before the limit was shared) folded into one: the shelf and the purse as spent as the more spent of the two, filled when the later was. */
export function mergeRecords(a: ShopRecord, b: ShopRecord): ShopRecord {
    const left: Record<string, number> = {};
    for (const item of new Set([...Object.keys(a.left), ...Object.keys(b.left)])) {
        left[item] = Math.min(a.left[item] ?? Number.POSITIVE_INFINITY, b.left[item] ?? Number.POSITIVE_INFINITY);
    }
    return { since: Math.max(a.since, b.since), left, purse: Math.min(a.purse, b.purse) };
}

/** Whether a record is the one a fresh vendor would have: nothing bought, nothing paid. */
export function isUntouched(shop: GuildShop, record: ShopRecord): boolean {
    const fresh = freshRecord(shop, record.since);
    return record.purse === fresh.purse && Object.entries(fresh.left).every(([item, full]) => record.left[item] === full);
}

// ---------------------------------------------------------------------------------------------
// One price for every thing, at every vendor.

/**
 * One price for each thing in the whole realm, the same at every vendor that sells or buys it (2026-11-03, user: "vamos padronizar ... valor de venda de couro do NPC e o valor de compra
 * de outro NPC, para evitar jogadores quebrarem a economia"). Until then each vendor priced a thing its own way: the hunter and the seamstress sold a cow's hide as an uncommon thing (6
 * coins) while the apothecary bought it by what the game says it is worth (20 coins, a rare thing: it paid 7.2), and so with the copper, the salt, the linen and the hops, bought dearer at
 * one vendor than another sold them; and what the trades make was bought by the game's own worth, three to ten times the realm's: the apothecary paid 20 coins for a potion of the best
 * quality brewed of a coin's worth of herbs, the smith and the hunter 60 for any sword, bow or crossbow, a bandit's too.
 *
 * - **What a vendor sells** costs its rarity's price (`RARITY_COINS`), the same at every vendor that sells it.
 * - **What the trades make** costs what goes into it: the realm's price of every raw thing of its cheapest recipe, the steps of a chain undone (charcoal is its logs, steel its iron and its
 *   charcoal), and `LEVEL_PREMIUM` more for each level of the recipe (the skill is worth something: half as much again at the 10th, two and a half times at the 30th), never more than its
 *   rarity by what the game says it is worth. A vendor pays `BUY_SHARE` of a price, so for a piece it pays at most what its raw things cost on a vendor's shelf: buying the things to make
 *   it and selling it back never pays, while making it of what one gathered, cut, grew or hunted does.
 * - **Anything else** costs its rarity by what the game says it is worth (`rarityFromWorth`); gear no trade of the realm makes (a bandit's helmet, a quest's sword) at most a rare thing's
 *   price (`LOOT_GEAR_CAP`).
 * - **One buyer** (`home`). Each thing is bought by the vendors of one guild only: the vendor that sells it buys it back; otherwise the herbs are the apothecary's, what the gardens grow and
 *   make the farmer's, what the trees and the rocks give the Coletor's (its vendor's list), what a station makes that station's guild's, and the rest the first vendor whose list names it.
 *   A thing several guilds bought filled several purses (300 coins a day each) with the same goods: 84 things were bought by two or three guilds.
 */
export const LEVEL_PREMIUM = 1 / 20;
export const LOOT_GEAR_CAP: Rarity = "raro";

const RARITY_ORDER: readonly Rarity[] = ["comum", "incomum", "raro", "muito-raro", "excepcional"];
const cheaper = (a: Rarity, b: Rarity): Rarity => (RARITY_ORDER.indexOf(a) <= RARITY_ORDER.indexOf(b) ? a : b);

/** The guild whose vendors buy what a station makes; a thing several stations make goes to the first of them here. */
export const STATION_GUILDS: ReadonlyArray<readonly [station: string, guild: string]> = [
    ["horta", "agricolae"],
    ["forja", "fabri-ferrarii"],
    ["costura", "artifices"],
    ["alquimia", "alchemistae"],
    ["secador", "alchemistae"],
    ["defumador", "venatores"],
    ["fogo", "tabernarii"],
];

/** How the price book reads the game. */
export interface PriceLookups {
    /** One key for each class of item: the class's GUID in lower case, however the item was named. */
    key(item: string): string;
    /** What the game says one is worth, in coins; null for a thing the server does not know. */
    worth(item: string): number | null;
    /** Whether the game lists the thing among its gear (`Inventory.classes()`). */
    gear(item: string): boolean;
    /** The goods a trade of `data/vendor-buys.json` buys. */
    tradeList(trade: string): readonly string[];
}

export interface PriceBook {
    /** The realm's price of one, in coins (a fraction of a coin for a cheap thing made of others). */
    coins(item: string): number;
    /** What any vendor pays for one, in money units: `BUY_SHARE` of the price (or of its recipe's worth, when less), never less than a unit. */
    buyUnits(item: string): number;
    /** The guild whose vendors buy it, or null for a thing no vendor buys. */
    home(item: string): string | null;
    /** What the vendors of a guild buy, in the order a vendor lists it: its own wares, the goods it names, its trade's list, then the rest of what is its own. */
    buyList(guild: string): readonly string[];
}

interface Bill {
    readonly ingredients: ReadonlyArray<readonly [string, number]>;
    readonly amount: number;
    readonly level: number;
    readonly station: string;
}

export interface PriceSources {
    readonly shops?: readonly GuildShop[];
    readonly recipes?: readonly CraftRecipe[];
    readonly processes?: readonly FarmProcess[];
    readonly crops?: readonly FarmCrop[];
}

export function makePriceBook(lookups: PriceLookups, sources: PriceSources = {}): PriceBook {
    const shops = sources.shops ?? SHOPS;
    const recipes = sources.recipes ?? CRAFT_RECIPES ?? [];
    const processes = sources.processes ?? FARM_PROCESSES ?? [];
    const crops = sources.crops ?? FARM_CROPS ?? [];
    /** The first way each class was written (the vendors' lists go first, by name), to ask the game about it. */
    const named = new Map<string, string>();
    const keyOf = (item: string): string => {
        const key = lookups.key(item);
        if (!named.has(key)) {
            named.set(key, item);
        }
        return key;
    };
    const ownList = (shop: GuildShop): string[] => [...shop.sells.filter((one) => !isHorseKey(one.item)).map((one) => one.item), ...shop.buys, ...(shop.buysOf === "" ? [] : lookups.tradeList(shop.buysOf))];
    const candidates = shops.flatMap(ownList);
    candidates.forEach(keyOf);

    const sold = new Map<string, { readonly rarity: Rarity; readonly guild: string }>();
    for (const shop of shops) {
        for (const one of shop.sells) {
            const key = isHorseKey(one.item) ? "" : keyOf(one.item);
            if (key !== "" && !sold.has(key)) {
                sold.set(key, { rarity: one.rarity, guild: shop.guild });
            }
        }
    }
    const bills = new Map<string, Bill[]>();
    const addBill = (output: string, bill: Bill): void => {
        const key = keyOf(output);
        if (bill.ingredients.some(([item]) => keyOf(item) === key)) {
            return;
        }
        bills.set(key, [...(bills.get(key) ?? []), bill]);
    };
    for (const recipe of recipes) {
        for (const output of new Set([recipe.output, ...(recipe.variants ?? []).map(([variant]) => variant)])) {
            addBill(output, { ingredients: recipe.ingredients, amount: recipe.amount, level: recipe.level, station: recipe.station });
        }
    }
    for (const process of processes) {
        addBill(process.output, { ingredients: process.ingredients, amount: process.amount, level: process.level, station: "horta" });
    }
    const farm = new Set<string>([...crops.flatMap((crop) => [keyOf(crop.harvest), keyOf(crop.seed)]), ...processes.map((process) => keyOf(process.output))]);
    const finds = new Set<string>((shops.find((shop) => shop.guild === "collectores")?.buys ?? []).map(keyOf));

    const band = (key: string, cap: boolean): number => {
        const item = named.get(key) ?? key;
        let rarity = rarityFromWorth(lookups.worth(item) ?? 0);
        if (cap && lookups.gear(item)) {
            rarity = cheaper(rarity, LOOT_GEAR_CAP);
        }
        return RARITY_COINS[rarity];
    };

    const rawMemo = new Map<string, number>();
    const visiting = new Set<string>();
    /** What one costs in the raw things it is made of (or itself, for a raw thing): never more than its own rarity. */
    const raw = (key: string): number => {
        const own = sold.get(key);
        if (own !== undefined) {
            return RARITY_COINS[own.rarity];
        }
        const memo = rawMemo.get(key);
        if (memo !== undefined) {
            return memo;
        }
        const list = bills.get(key);
        if (list === undefined) {
            const value = band(key, true);
            rawMemo.set(key, value);
            return value;
        }
        if (visiting.has(key)) {
            return Number.POSITIVE_INFINITY;
        }
        visiting.add(key);
        const best = Math.min(...list.map(billRaw));
        visiting.delete(key);
        const value = Number.isFinite(best) ? Math.min(best, band(key, false)) : band(key, true);
        rawMemo.set(key, value);
        return value;
    };
    function billRaw(bill: Bill): number {
        let sum = 0;
        for (const [item, amount] of bill.ingredients) {
            const one = raw(keyOf(item));
            if (!Number.isFinite(one)) {
                return Number.POSITIVE_INFINITY;
            }
            sum += one * amount;
        }
        return sum / Math.max(1, bill.amount);
    }

    const madeMemo = new Map<string, number>();
    /** What a thing the trades make is worth by its cheapest recipe, the level's premium in, never more than its rarity by the game's worth; infinite for a thing no recipe makes. */
    const madeCoins = (key: string): number => {
        const memo = madeMemo.get(key);
        if (memo !== undefined) {
            return memo;
        }
        const list = bills.get(key);
        const best = list === undefined ? Number.POSITIVE_INFINITY : Math.min(...list.map((bill) => billRaw(bill) * (1 + bill.level * LEVEL_PREMIUM)));
        const value = Number.isFinite(best) ? Math.min(best, band(key, false)) : Number.POSITIVE_INFINITY;
        madeMemo.set(key, value);
        return value;
    };
    const coinsOfKey = (key: string): number => {
        const own = sold.get(key);
        if (own !== undefined) {
            return RARITY_COINS[own.rarity];
        }
        const made = madeCoins(key);
        return Number.isFinite(made) ? made : band(key, true);
    };
    /**
     * What a vendor pays its share of: the price, or what the thing is worth by its recipe when that is less. A vendor sells a spool of thread for a common thing's 2 coins, but three
     * spools are spun of one flax: paying for each its share of 2 coins would buy the flax back dearer than it was sold.
     */
    const buyBasis = (key: string): number => Math.min(coinsOfKey(key), madeCoins(key));

    const homeMemo = new Map<string, string | null>();
    const homeOfKey = (key: string): string | null => {
        if (homeMemo.has(key)) {
            return homeMemo.get(key) ?? null;
        }
        const item = named.get(key) ?? key;
        let home: string | null = sold.get(key)?.guild ?? null;
        if (home === null && /^herb_/i.test(item)) {
            home = "alchemistae";
        }
        if (home === null && farm.has(key)) {
            home = "agricolae";
        }
        if (home === null && finds.has(key)) {
            home = "collectores";
        }
        const made = bills.get(key);
        if (home === null && made !== undefined) {
            home = STATION_GUILDS.find(([station]) => made.some((bill) => bill.station === station))?.[1] ?? null;
        }
        if (home === null) {
            home = shops.find((shop) => shop.buys.some((one) => keyOf(one) === key))?.guild ?? null;
        }
        if (home === null) {
            home = shops.find((shop) => shop.buysOf !== "" && lookups.tradeList(shop.buysOf).some((one) => keyOf(one) === key))?.guild ?? null;
        }
        homeMemo.set(key, home);
        return home;
    };

    const lists = new Map<string, string[]>();
    const buyList = (guild: string): readonly string[] => {
        const kept = lists.get(guild);
        if (kept !== undefined) {
            return kept;
        }
        const shop = shops.find((one) => one.guild === guild);
        const seen = new Set<string>();
        const list: string[] = [];
        for (const item of [...(shop === undefined ? [] : ownList(shop)), ...candidates]) {
            const key = keyOf(item);
            if (!seen.has(key) && homeOfKey(key) === guild) {
                seen.add(key);
                list.push(item);
            }
        }
        lists.set(guild, list);
        return list;
    };

    return {
        coins: (item) => coinsOfKey(keyOf(item)),
        buyUnits: (item) => Math.max(1, Math.round(buyBasis(keyOf(item)) * MONEY_UNIT * BUY_SHARE)),
        home: (item) => homeOfKey(keyOf(item)),
        buyList,
    };
}
