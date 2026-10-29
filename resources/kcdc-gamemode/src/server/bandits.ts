/**
 * The bandit camps of the level, peopled again: hard to beat and poor to rob.
 *
 * The camps are the level's own. `Npc.placements()` lists every human the level places, with the layer it sits in,
 * and the ones whose layer or name says bandit ("bandit", Czech "lapka", "zbojník") are grouped by distance into
 * camps: Grunta, Vrchlicko, Kopec Vysoká, Rabštejnsko, Mezholezsko and the hideouts the quests use. Each camp gets a
 * few bandits, one of them an archer where there are three or more.
 *
 * Hard: more health than an ordinary man, a heavier hand (their blows on players are multiplied in `playerHit`), they
 * see you from further off and the whole camp joins in when one of them is hit. Poor: what a bandit wears and carries
 * is plain -- rags, a club or a work axe, a few coins, a crust -- because an NPC's clothes and weapon are its loot,
 * and good gear here would make robbing bandits a better trade than the trades the guilds play. Dead bandits come back
 * after a while, when nobody is near.
 *
 * The chests at each camp are filled with what the guilds work with (iron and steel, herbs, arrows, hides, raw meat)
 * and now and then a piece of clothing, and filled again every three hours while nobody is around (every hour before 2026-10-25).
 *
 * Harder still since 2026-10-21 (user: "colocar nos NPC de bandidos armaduras melhores em alguns e deixar eles mais hard ainda; se o jogador
 * se afastar eles começam a disparar com besta e tomam poção também, assim evitar jogador ficar abusando"): one in three of a camp is a
 * veteran, in a soldier's battered kit with more health and a heavier hand; every one who fights hand to hand carries a bow too and takes it
 * up when his man runs off (the game lets a server's NPC shoot a bow, not a crossbow), and drinks a draught when badly hurt. The veteran's
 * armour and the second bow are not loot: they are taken off the body when he falls, so robbing bandits stays a poor trade.
 *
 * More camps and the roads since 2026-10-24 (user: "existe acampamento de inimigos sem bandidos"; "coloque alguns bandidos pelas estradas já que o
 * sistema de emboscada não funciona"): the level's other camps of enemies, which had tents and fires and nobody at them because the quests that
 * people them do not run here (the poachers' camps of Suchdol and Vrchlicko, the treasure hunters' camp of Lorec, the deserters' barn at Přítoky),
 * are bandit camps now; and gangs of three or four stand at some places of the roads (`addRoads`: the level's own road events and caravan starts,
 * `data/road-posts.json`), away from every village and camp.
 */

import { propertyOfStash } from "./properties.js";
import { ensureDir, read, write } from "./store.js";

declare const __dirname: string | undefined;

const RESOURCE = "kcdc-gamemode";

export const banditSettings = {
    // The user's call (2026-10-16: "encher com bem mais bandidos"): the level's camps hold up to eight, and the script adds
    // hideouts of its own in the wild, away from every place where the level puts ordinary people.
    maxPerCamp: 8,
    minPerCamp: 5,
    // 2026-10-17: more hideouts along the roads (was 14), the user wanting travellers to meet bandits more often; and the same day
    // "o spawn tá muito forte" with bandits that stood still (dormant, for want of room in the game that was to run them):
    // sixteen hideouts of three to five.
    wildCamps: 16,
    wildMinPerCamp: 3,
    wildMaxPerCamp: 5,
    /** Between two hideouts of the script's. */
    wildSeparationM: 550,
    /** From the level's own camps. */
    wildFromCampsM: 450,
    /** From any place the level puts ordinary people (villages, farms, mills, guard posts). */
    wildFromPeopleM: 300,
    /** How far from its centre a hideout's bandits stand. */
    wildSpotRadius: 7,
    // The roads (2026-10-24): small gangs at the level's road events, far from villages and camps, and from one another.
    roadPosts: 10,
    roadMinPerPost: 3,
    roadMaxPerPost: 4,
    // On the level's own data these give ten posts (the limit); at 170, 380 and 650 only five were left (measured 2026-10-24).
    roadSeparationM: 550,
    roadFromCampsM: 330,
    roadFromPeopleM: 140,
    roadSpotRadius: 5,
    clusterRadius: 45,
    health: 180,
    damageMultiplier: 1.6,
    aggroRadius: 28,
    leashRadius: 60,
    homeRadius: 6,
    activationRadius: 200,
    corpseMs: 10 * 60_000,
    respawnMs: 30 * 60_000,
    /**
     * The gangs of the roads (`Estrada N`) come back much later than a camp's men (user, 2026-10-25: "os bandidos de estrada, o respawn tá muito
     * rápido, devia ser umas 2h a 4h"): each dead man waits a time of his own between these two, counted from his death.
     */
    roadRespawnMs: [2 * 60 * 60_000, 4 * 60 * 60_000] as readonly [number, number],
    respawnClearRadius: 90,
    corpseClearRadius: 50,
    alarmMs: 60_000,
    retryMs: 4_000,
    // A bandit nobody's game runs is dormant: no step, no blow (user, 2026-10-18: "bandidos ... precisam poder se movimentar e o
    // combate deve ativar assim que se aproxima"). Within this of a player he is pinned to that player's game, which runs him
    // although the games near them already run others; out of everybody's reach he is let go.
    pinM: 140,
    unpinM: 190,
    // The game that runs a bandit judges the blows on him, and the server keeps whoever runs him until he is 160 m away (2026-10-25, user: "os bandidos de
    // estrada desviam de todos os golpes e não morrem"; from the log, half the blows against the roads' gangs were struck at a man run by somebody else's game,
    // up to sixty metres off, and none of the camps' and hideouts'). A man whose runner is farther than `runnerFarM` from him is given to whoever strikes him,
    // when that one is within `runnerNearM`; and a man whose runner is past `runnerLostM` is given to a player `runnerGapM` nearer than that runner.
    runnerFarM: 20,
    runnerNearM: 15,
    runnerLostM: 60,
    runnerGapM: 25,
    // Ordered to fight and still for this long, farther from the target than `chaseFromM` (a bow's reach for an archer): sent
    // running at the target by the route the server plans, which is what a vendor is walked by and does work (user, 2026-10-18:
    // "os bandidos estão estáticos ainda ... deviam ir direto para o ataque").
    stillMs: 3_000,
    // A blow on a bandit orders him to fight again at once, but no oftener than this for the same man.
    hitOrderMs: 800,
    chaseEveryMs: 5_000,
    chaseFromM: 3,
    archerFromM: 20,
    // Idle, he strolls about his spot: a few steps, a pause, again.
    roamM: 5,
    roamPauseMs: [12_000, 35_000] as readonly [number, number],
    chestRadius: 35,
    chestRefillMs: 3 * 60 * 60_000,
    chestClearRadius: 60,
    spawnAfterMs: 25_000,
    tickMs: 1_000,
    /** A veteran's health, and his blows on a player on top of the camp's `damageMultiplier`. */
    veteranHealth: 260,
    veteranDamage: 1.25,
    /** A bandit who fights hand to hand takes up his bow when his target is farther than this, and his blade again nearer than `meleeFromM`. */
    bowFromM: 12,
    meleeFromM: 6,
    /**
     * A man left with this share of his health or less (and never fewer than `finishPoints`) is finished: held where he stands and killed `finishAfterMs` later
     * (2026-10-27: "matei um bandido com combo e ele bugou, ficou caído no chão mas não morreu"). The journal of that evening has two men of a hideout left at 5 and 11 of
     * 180 who lay on the ground for 13 and 15 seconds, until the player struck them again, and the archer of a road gang at 3: the game lays a body down at the edge of
     * death, where no blow lands any more, and the server's ledger never reaches zero. The men seen standing and fighting were at 25 and above (14%).
     */
    finishBelow: 0.12,
    finishPoints: 12,
    finishAfterMs: 1_500,
    /** Below this share of his health a bandit drinks, while he has a draught left, and gets `potionHeal` of his health back. */
    potionBelow: 0.4,
    potionHeal: 0.45,
    potionEveryMs: 15_000,
    potions: 1,
    veteranPotions: 2,
};

/**
 * How hard the bandits are, three presets an administrator picks (`/bandidos agressividade`, kept in `playerdata/bandits.json`):
 * how far off they see a player, how heavy their blows are on a player, how long a whole camp stays turned on one. The middle
 * one is how they were before there was a choice.
 */
export type Aggression = "baixa" | "media" | "alta";

export const AGGRESSION: Readonly<Record<Aggression, { readonly label: string; readonly aggroRadius: number; readonly damageMultiplier: number; readonly alarmMs: number; readonly about: string }>> = {
    baixa: { label: "baixa", aggroRadius: 16, damageMultiplier: 1.2, alarmMs: 30_000, about: "só reagem a quem chega perto, batem fraco e o acampamento esquece logo" },
    media: { label: "média", aggroRadius: 28, damageMultiplier: 1.6, alarmMs: 60_000, about: "veem de longe, batem forte e o acampamento todo vai atrás de quem ataca um deles" },
    alta: { label: "alta", aggroRadius: 42, damageMultiplier: 2.0, alarmMs: 120_000, about: "veem de muito longe, batem muito forte e o acampamento persegue por dois minutos" },
};

export const DEFAULT_AGGRESSION: Aggression = "media";

let aggression: Aggression = DEFAULT_AGGRESSION;
const AGGRESSION_FILE = "playerdata/bandits.json";

/** The level the bandits are at. */
export function aggressionLevel(): Aggression {
    return aggression;
}

/** Sets the bandits' hardness for good: the settings change at once, and the choice is kept for the next start. */
export function setAggression(level: Aggression): void {
    aggression = level;
    const preset = AGGRESSION[level];
    banditSettings.aggroRadius = preset.aggroRadius;
    banditSettings.damageMultiplier = preset.damageMultiplier;
    banditSettings.alarmMs = preset.alarmMs;
    try {
        ensureDir("playerdata");
        write(AGGRESSION_FILE, { aggression: level });
    } catch (error: unknown) {
        console.log(`bandits: não consegui salvar a agressividade: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function loadAggression(): void {
    const loaded = read<{ aggression?: unknown }>(AGGRESSION_FILE);
    if (loaded.status === "ok" && typeof loaded.value.aggression === "string" && loaded.value.aggression in AGGRESSION) {
        aggression = loaded.value.aggression as Aggression;
        const preset = AGGRESSION[aggression];
        banditSettings.aggroRadius = preset.aggroRadius;
        banditSettings.damageMultiplier = preset.damageMultiplier;
        banditSettings.alarmMs = preset.alarmMs;
    }
}

/** What a bandit shouts when he sees somebody to fight, when the camp is roused, and when he is struck (user, 2026-10-17: the NPCs should speak when the moment is theirs). */
export const BARKS = {
    sight: ["Ei, você! Largue o que tem!", "Aqui não é lugar de gente de bem!", "Um viajante! Peguem-no!", "Quem mandou entrar no nosso acampamento?"],
    alarm: ["Às armas! Estão nos atacando!", "Todos aqui! Rápido!", "Peguem esse desgraçado!"],
    hurt: ["Maldito!", "Você vai pagar por isso!", "Ah, seu porco!"],
    potion: ["Ainda não acabou!", "Isto me põe de pé...", "Hah! Venha de novo!"],
};

/** How long a bandit is quiet after shouting. */
export const BARK_EVERY_MS = 20_000;

/**
 * What a placement's layer or name says of a bandit: the bandit camps of the level, and (2026-10-24) the other enemies' camps whose people
 * the quests do not bring here -- the poachers (`poach`, Czech `pytlak`), the treasure hunters and the deserters' barn (`zbeh`).
 */
const PATTERN = /bandit|lapk|zbojn|poach|pytlak|pytlack|treasureHunter|zbeh/i;
const CONTAINER = /chest|stash|sack|crate|box|barrel/i;
/** Containers that are not a camp's stores: beehives, bodies, and anything a quest or a cutscene owns. */
const NOT_STORES = /bee|hive|corpse|deadbody|cin_|quest|dlc/i;

/** Region codes of the level's layers, as people say them. */
const REGIONS: Readonly<Record<string, string>> = {
    grunta: "Minas",
    vrchlicko: "Vrchlicko",
    kopecVysoka: "Kopec Vysoká",
    rabstejnsko: "Rabštejnsko",
    mezholezsko: "Mezholezsko",
    zikmundovo: "Zikmundovo",
    malesov: "Malešov",
    kutnaHora: "Kutná Hora",
    bohounovice: "Bohounovice",
    kuklicko: "Kuklicko",
    naBylance: "Na Bylance",
    suchdol: "Suchdol",
    lorec: "Lorec",
    pritoky: "Přítoky",
};

/**
 * Where the camps were in the level data when this was written, for a server whose catalog lists no bandits (a
 * different level build). Only used when `Npc.placements()` finds none.
 */
const FALLBACK_CAMPS: ReadonlyArray<{ name: string; x: number; y: number; z: number }> = [
    { name: "Minas", x: 3311.4, y: 2533.7, z: 89.9 },
    { name: "Vrchlicko (moinho)", x: 1575.5, y: 224.7, z: 56.1 },
    { name: "Kopec Vysoká", x: 1065.9, y: 2443.0, z: 192.6 },
    { name: "Rabštejnsko", x: 598.1, y: 1380.1, z: 118.4 },
    { name: "Mezholezsko", x: 211.3, y: 1472.6, z: 133.2 },
];

// ---------------------------------------------------------------------------------------------
// What they wear and carry, and what the camp chests hold. Item names from the game's own tables.

const TUNICS = ["TunicLong04_m01_D", "TunicLong05_m01_E", "TunicLong04_m02_D"];
const HOSE = ["HoseSeparate01_m01_E", "HoseSeparate04_m01_E"];
const HEADS = ["Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E"];
const COATS = ["Coat03_m01_E", "Coat03_m02_E"];
const MELEE = ["axeWork01", "maceClub", "shortswordCleaver"];
const BOW = "bow_b";
const ARROWS = "arrow_crude";

/**
 * A veteran's kit, what a war left behind: a kettle hat or a steel cap, a padded or a mail coif, the long padded coat and now and then a mail
 * shirt under it, rondels on the arms, boots. Worn and battered (a third to a half of its condition), and taken off his body when he falls.
 */
const VETERAN_HEADS = ["KettleHat02_m01_D2", "SkullCap02_m01_C2", "KettleHat04_m01_B4"];
const VETERAN_NECKS = ["CoifCap01_m01_C", "CoifMail02_m01_B3"];
const VETERAN_BODY = "GambesonLong01_m01_C3";
const VETERAN_MAIL = "MailLong02_m01_C2";
const VETERAN_ARMS = "ArmPlate01_m01_C2";
const VETERAN_BOOTS = "BootsAnkle03_m01_D";

/**
 * The Cumans of the roads (user, 2026-10-19: "seria legal alguns cumanos pela estrada"): the caftan, the tall or the leather hat
 * (now and then the open bascinet), the knee boots, a shashka or a fokos, sometimes a Cuman shield; their archer has a Cuman bow.
 * Item names from the game's tables (ITENS.md).
 */
const CUMAN_TUNICS = ["Caftan01_m01_D1", "Caftan01_m02_D1", "Caftan01_m03_D1", "Caftan01_m05_D1", "Caftan01_m07_D1"];
const CUMAN_HEADS = ["Cap13_m01_D", "Cap13_m03_D", "Cap06_m02_D", "Cap06_m05_D"];
const CUMAN_HELMET = "BascinetOpen09_m01_B1";
const CUMAN_BOOTS = ["BootsKnee05_m01_C", "BootsKnee05_m03_C", "BootsKnee05_m04_C"];
const CUMAN_MELEE = ["huntingSwordSashka", "huntingSwordSashka", "axeCuman"];
const CUMAN_SHIELDS = ["shieldCuman_01", "shieldCuman_02", "shieldCuman_03", "shieldCuman_05"];
const CUMAN_BOW = "cuman_bow_b";
const FOOD = ["bread", "apple", "carrot"];

const HERBS = ["herb_belladona", "herb_chamomile", "herb_comfrey", "herb_dandelion", "herb_eyewort", "herb_hypericum", "herb_marigold", "herb_mint", "herb_poppy", "herb_salvia", "herb_thistle", "herb_urticaria", "herb_valerian", "herb_wormwood"];
const CLOTHES = ["TunicLong01_m01_C", "TunicShort01_m01_D", "TunicLong02_m01_C", "TunicShort03_m01_D", "HoseSeparate05_m01_D", "HoseLoose01_m01_C", "Shoes01_m01_D", "Coat02_m01_D", "Cap27_m01_D", "Hood01_m01_D", "F_SimpleDress01_m01_D", "F_Hood01_m01_C"];

interface LootEntry {
    readonly items: readonly string[];
    readonly min: number;
    readonly max: number;
    readonly weight: number;
}

/** Guild work: the smith's metal, the alchemist's herbs, the hunter's arrows and hides, the cook's meat. */
export const CHEST_LOOT: readonly LootEntry[] = [
    { items: ["bsmt_ironBad"], min: 2, max: 6, weight: 12 },
    { items: ["bsmt_ironGood"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_steelBad"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_hardware"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_guardSimple", "bsmt_pommelCoin"], min: 1, max: 1, weight: 3 },
    { items: HERBS, min: 2, max: 6, weight: 14 },
    { items: ["special_charcoal"], min: 1, max: 3, weight: 5 },
    { items: ["special_cobweb"], min: 1, max: 2, weight: 3 },
    { items: ["arrow_crude", "arrow_normal"], min: 5, max: 15, weight: 10 },
    { items: ["special_deerSkin", "special_pigSkin", "special_cowSkin"], min: 1, max: 2, weight: 6 },
    { items: ["beef", "pigMeat", "lambMeat", "chicken"], min: 1, max: 2, weight: 6 },
    // The rest of what the guilds' recipes take (user, 2026-10-18: "todos os recursos das guildas nas receitas precisam estar ...
    // em baús pelo mundo afora de bandidos, ou até em bandidos, assim mantemos um equilíbrio").
    { items: ["special_sulfur", "special_saltpeter"], min: 1, max: 3, weight: 4 },
    { items: ["loot_cloth", "skin_sheep"], min: 1, max: 3, weight: 5 },
    { items: ["loot_salt", "driedPepperSpice", "garlic", "honey"], min: 1, max: 3, weight: 5 },
    { items: ["wine"], min: 1, max: 2, weight: 4 },
    { items: ["herb_dried_poppy", "special_mushroomAmanita", "special_charcoalImproved"], min: 1, max: 2, weight: 3 },
    { items: ["bsmt_woodExotic", "bsmt_guardSpecial", "bsmt_copper", "special_attire"], min: 1, max: 1, weight: 2 },
    { items: ["maliruvLek_mandrakeRoot", "maliruvLek_freshwaterPearl"], min: 1, max: 1, weight: 1 },
];

/**
 * How often a bandit carries something of the guilds' on him, besides his coins: one row of the chests' table, a small lot. Lowered with
 * his purse and his bread on 2026-10-25 (the user: "diminuir o rate de drop de mobs").
 */
export const CARRIED_GOODS_CHANCE = 0.15;
/** How often a bandit carries a bite to eat. */
export const CARRIED_FOOD_CHANCE = 0.4;

// ---------------------------------------------------------------------------------------------

type Point = { x: number; y: number; z: number };

interface Spot {
    readonly position: Point;
    readonly soul: string;
}

interface Slot {
    readonly spot: Spot;
    readonly archer: boolean;
    /** One in three of a camp: battered armour, more health, a heavier hand, two draughts. */
    readonly veteran?: boolean;
    /** What he fights with now, for one who has a bow and a blade; whether he has both; not before this is the bow tried again. */
    mode?: "melee" | "bow";
    hasBow?: boolean;
    noBowUntil?: number;
    /** Draughts left, and not before this does he drink again. */
    potions?: number;
    potionAt?: number;
    /** The classes taken off his body when he falls (the veteran's armour, the second bow and its arrows). */
    strip?: string[];
    npcId: number | null;
    state: "vacant" | "alive" | "dead";
    deathAt: number;
    /** How long after `deathAt` his place is filled again, when it is not the camp's: chosen the first time it is asked, and dropped when a man stands there. */
    respawnWait?: number;
    target: number | null;
    retryAt: number;
    /** Not before this may he shout again. */
    barkAt?: number;
    /** Not before this does he stroll about his place again. */
    roamAt?: number;
    /** A player's game is made to run him whatever the distances say (`pin`). */
    pinned?: boolean;
    /** Where he was last time he was seen to move, and since when he has stood there: a bandit ordered to fight who does not stir. */
    watchX?: number;
    watchY?: number;
    watchAt?: number;
    /** Not before this is he ordered to fight again because a blow reached him. */
    hitOrderAt?: number;
    /** He is being finished (`finishOff`): when he is killed, and who is credited with it. */
    finishAt?: number;
    finishBy?: number;
    /** Not before this is he sent running at his target by the server's own route again. */
    chaseAt?: number;
}

type Row = { item: string; amount: number; equipped?: number; metadata?: Record<string, unknown>; strip?: boolean };
/** A row whose `item` is the class GUID, with the name it was asked for kept for the log. */
type Classed = Row & { name: string };

/** Every item name this module hands out, to be turned into class GUIDs once. */
const ITEM_NAMES: readonly string[] = [...TUNICS, ...HOSE, ...HEADS, ...COATS, ...MELEE, BOW, ARROWS, ...FOOD, "money", ...CLOTHES, ...CHEST_LOOT.flatMap((entry) => entry.items), ...VETERAN_HEADS, ...VETERAN_NECKS, VETERAN_BODY, VETERAN_MAIL, VETERAN_ARMS, VETERAN_BOOTS];

/**
 * Item names to class GUIDs. `Inventory.set` and `setInventory` take only GUIDs (a name is refused as `invalidItem`,
 * or as `invalidEquipment` on a worn row), while `addItem` takes either. The worn things come from
 * `Inventory.classes()`; any other name is put in a scratch stash, and the row it makes says its GUID. A name the game
 * does not know is left out of the map.
 */
export function resolveItems(names: readonly string[]): Map<string, string> {
    const guids = new Map<string, string>();
    for (const entry of Inventory.classes()) {
        guids.set(entry.name.toLowerCase(), entry.id);
    }
    const missing = [...new Set(names)].filter((name) => !guids.has(name.toLowerCase()));
    if (missing.length === 0) {
        return guids;
    }
    const scratch = Stash.createVirtual();
    try {
        for (const name of missing) {
            if (scratch.setInventory({ items: [] }).ok && scratch.addItem({ item: name, amount: 1 }).ok) {
                const row = scratch.getInventory()?.items[0];
                if (row !== undefined) {
                    guids.set(name.toLowerCase(), row.item);
                }
            }
        }
    } finally {
        scratch.destroy();
    }
    return guids;
}

export interface Camp {
    readonly id: number;
    readonly name: string;
    readonly center: Point;
    readonly slots: Slot[];
    chests: string[];
    /** Whether the containers around the camp have been looked for. */
    scanned: boolean;
    chestsFilledAt: number;
    alarm: { targetId: number; until: number } | null;
    /** The least and the most a dead man of this camp waits to be replaced, when it is not `respawnMs`: the roads' gangs. */
    readonly respawn?: readonly [number, number];
}

export type Placement = ReturnType<typeof Npc.placements>[number];

const flat = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** How long is left of a wait, for an administrator: "em 1 h 52 min", "em 14 min", or "assim que ninguém estiver por perto" when it is over. */
function waitText(leftMs: number): string {
    const minutes = Math.ceil(leftMs / 60_000);
    if (minutes <= 0) {
        return "assim que ninguém estiver por perto";
    }
    return minutes < 60 ? `em ${minutes} min` : `em ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** A stable number out of a name (FNV-1a), so the same level always gets the same hideouts. */
export function stableHash(text: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/** Points in square cells, to ask whether any lies within a radius without looking at all of them. */
class Crowd {
    private readonly cells = new Map<string, Point[]>();

    constructor(private readonly cell: number) {}

    private key(x: number, y: number): string {
        return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
    }

    add(point: Point): void {
        const key = this.key(point.x, point.y);
        const list = this.cells.get(key);
        if (list === undefined) {
            this.cells.set(key, [point]);
        } else {
            list.push(point);
        }
    }

    /** Whether any point lies closer than `radius` (at most one cell) to `at`. */
    near(at: Point, radius: number): boolean {
        const column = Math.floor(at.x / this.cell);
        const row = Math.floor(at.y / this.cell);
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                if (this.cells.get(`${column + dx},${row + dy}`)?.some((point) => flat(point, at) < radius) === true) {
                    return true;
                }
            }
        }
        return false;
    }
}

/** A place the script may hide bandits at: a marker of the level and a name to sort it by. */
export interface WildCandidate {
    readonly guid: string;
    readonly position: Point;
}

/** What the navigation mesh says about a place; the game's own is `NAVIGATION`. */
export interface Reach {
    /** The walkable point nearest a marker, or null when there is none. */
    project(point: Point): Point | null;
    /** A walkable point at random within `radius` of a centre, or null. */
    around(centre: Point, radius: number): Point | null;
}

const NAVIGATION: Reach = {
    project(point) {
        if (!Navigation.ready) {
            return null;
        }
        const found = Navigation.closestPoint(new Vector3(point.x, point.y, point.z), { searchRadius: 12, searchHeight: 20, doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    },
    around(centre, radius) {
        if (!Navigation.ready) {
            return null;
        }
        const found = Navigation.randomPoint(new Vector3(centre.x, centre.y, centre.z), radius, { doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    },
};

/** How many sites to keep and how far from people, from camps and from one another. */
export interface SiteRules {
    readonly count: number;
    readonly fromPeopleM: number;
    readonly fromCampsM: number;
    readonly separationM: number;
}

/**
 * Picks sites out of candidates, the same ones on every start. The candidates are taken in an order fixed by their names, and one is kept
 * when it can be walked to, is not near any place the level puts ordinary people (`people`), is clear of the camps given and of the sites
 * kept before it.
 */
export function chooseSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    rules: SiteRules,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    const crowd = new Crowd(rules.fromPeopleM);
    people.forEach((point) => crowd.add(point));
    const ordered = [...candidates].sort((a, b) => stableHash(a.guid) - stableHash(b.guid) || (a.guid < b.guid ? -1 : 1));
    const chosen: Array<{ candidate: WildCandidate; centre: Point }> = [];
    for (const candidate of ordered) {
        if (chosen.length >= rules.count) {
            break;
        }
        const at = candidate.position;
        if (crowd.near(at, rules.fromPeopleM) || camps.some((camp) => flat(camp, at) < rules.fromCampsM) || chosen.some((other) => flat(other.centre, at) < rules.separationM)) {
            continue;
        }
        const centre = reach.project(at);
        if (centre !== null && !crowd.near(centre, rules.fromPeopleM)) {
            chosen.push({ candidate, centre });
        }
    }
    return chosen;
}

/** Where the script adds hideouts: spread across the wild (`chooseSites` with the wild's rules). */
export function chooseWildSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    settings = banditSettings,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    return chooseSites(candidates, people, camps, reach, { count: settings.wildCamps, fromPeopleM: settings.wildFromPeopleM, fromCampsM: settings.wildFromCampsM, separationM: settings.wildSeparationM });
}

/**
 * Where the script puts gangs on the roads: the road places of the level (`data/road-posts.json`), fewer, nearer to people than a hideout
 * may be (a road runs between villages) and as far from the camps as the hideouts are, from the ones kept so far.
 */
export function chooseRoadSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    settings = banditSettings,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    return chooseSites(candidates, people, camps, reach, { count: settings.roadPosts, fromPeopleM: settings.roadFromPeopleM, fromCampsM: settings.roadFromCampsM, separationM: settings.roadSeparationM });
}

/** One archer for every four bandits in a camp of three or more. */
export function archersFor(count: number): number {
    return count >= 3 ? Math.max(1, Math.floor(count / 4)) : 0;
}

/** One veteran for every three bandits in a camp of three or more (2026-10-21). */
export function veteransFor(count: number): number {
    return count >= 3 ? Math.max(1, Math.floor(count / 3)) : 0;
}

function regionName(layer: string): string | null {
    const match = /Main\/k[a-z]{3}_([A-Za-z]+)\//.exec(layer);
    const code = match?.[1];
    return code === undefined ? null : (REGIONS[code] ?? null);
}

export class BanditCamps {
    readonly camps: Camp[] = [];
    /** Worn items the game would not put on a bandit, with how many times. */
    readonly refusedGear = new Map<string, number>();
    /** Goods a camp chest would not take. */
    readonly refusedLoot = new Set<string>();
    /** Why bandits or chests got nothing at all, by the game's code, with how many times. */
    readonly failures = new Map<string, number>();
    /** Names the game's tables do not have. */
    readonly unknownNames = new Set<string>();
    private readonly bySlot = new Map<number, { camp: Camp; slot: Slot }>();
    private guids: Map<string, string> | null = null;
    private running = true;

    constructor(
        private readonly settings = banditSettings,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
        private readonly resolve: (names: readonly string[]) => Map<string, string> = resolveItems,
    ) {}

    /** The bodies of the camps' bandits standing alive now: what a lock-on prefers over a player (`lockon-priority.ts`). */
    liveIds(): number[] {
        const ids: number[] = [];
        for (const [id, entry] of this.bySlot) {
            if (entry.slot.state === "alive") ids.push(id);
        }
        return ids;
    }

    /** Rows by name to rows by class GUID, which is all `Inventory.set` and `setInventory` take. */
    private byClass(rows: readonly Row[]): Classed[] {
        if (this.guids === null) {
            this.guids = this.resolve(ITEM_NAMES);
        }
        const out: Classed[] = [];
        for (const row of rows) {
            const guid = this.guids.get(row.item.toLowerCase());
            if (guid === undefined) {
                this.unknownNames.add(row.item);
            } else {
                out.push({ ...row, item: guid, name: row.item });
            }
        }
        return out;
    }

    private pick<T>(list: readonly T[]): T {
        return list[Math.floor(this.random() * list.length)] ?? list[0]!;
    }

    private between(min: number, max: number): number {
        return min + Math.floor(this.random() * (max - min + 1));
    }

    /** Groups the level's bandit placements into camps. Returns how many it made. */
    discover(placements: readonly Placement[]): number {
        const picks = placements.filter((p) => (PATTERN.test(p.layer) || PATTERN.test(p.name)) && !/cinematic/i.test(p.layer));
        const clusters: Array<{ center: Point; members: Placement[] }> = [];
        for (const p of picks) {
            const position = { x: p.position.x, y: p.position.y, z: p.position.z };
            const cluster = clusters.find((c) => flat(c.center, position) < this.settings.clusterRadius);
            if (cluster === undefined) {
                clusters.push({ center: position, members: [p] });
                continue;
            }
            cluster.members.push(p);
            const n = cluster.members.length;
            cluster.center = {
                x: cluster.members.reduce((s, m) => s + m.position.x, 0) / n,
                y: cluster.members.reduce((s, m) => s + m.position.y, 0) / n,
                z: cluster.members.reduce((s, m) => s + m.position.z, 0) / n,
            };
        }

        if (clusters.length === 0) {
            for (const fallback of FALLBACK_CAMPS) {
                this.addCamp(fallback.name, fallback, [{ position: fallback, soul: "bandit" }]);
            }
            return this.camps.length;
        }

        clusters.sort((a, b) => b.members.length - a.members.length || a.center.x - b.center.x);
        const regions = clusters.map((cluster) => {
            const layer = cluster.members[0]?.layer ?? "";
            return /_quest\//.test(layer) ? null : regionName(layer);
        });
        // A region with more than one camp numbers them from west to east: "Vrchlicko 1", "Vrchlicko 2".
        const numbers = new Map<number, number>();
        for (const region of new Set(regions)) {
            const indexes = regions.flatMap((other, index) => (region !== null && other === region ? [index] : []));
            if (indexes.length > 1) {
                indexes.sort((a, b) => clusters[a]!.center.x - clusters[b]!.center.x).forEach((clusterIndex, order) => numbers.set(clusterIndex, order + 1));
            }
        }
        let hideouts = 0;
        clusters.forEach((cluster, index) => {
            const region = regions[index] ?? null;
            const number = numbers.get(index);
            let name: string;
            if (region === null) {
                hideouts += 1;
                name = `Esconderijo ${hideouts}`;
            } else {
                name = number === undefined ? region : `${region} ${number}`;
            }
            this.addCamp(name, cluster.center, cluster.members.map((m) => ({ position: { x: m.position.x, y: m.position.y, z: m.position.z }, soul: m.soul })));
        });
        return this.camps.length;
    }

    private addCamp(name: string, center: Point, spots: readonly Spot[], min = this.settings.minPerCamp, max = this.settings.maxPerCamp, respawn?: readonly [number, number]): void {
        const count = Math.max(min, Math.min(max, spots.length));
        const archers = archersFor(count);
        const veterans = Math.min(veteransFor(count), count - archers);
        const slots: Slot[] = [];
        for (let index = 0; index < count; index += 1) {
            const base = spots[index % spots.length]!;
            // A spot used a second time is moved a little, so two bandits do not stand in one another.
            const lap = Math.floor(index / spots.length);
            const position = lap === 0 ? base.position : { x: base.position.x + 1.5 * lap, y: base.position.y + 1.5 * lap, z: base.position.z };
            slots.push({ spot: { position, soul: base.soul }, archer: index >= count - archers, veteran: index < veterans, npcId: null, state: "vacant", deathAt: 0, target: null, retryAt: 0 });
        }
        this.camps.push({ id: this.camps.length + 1, name, center, slots, chests: [], scanned: false, chestsFilledAt: 0, alarm: null, ...(respawn === undefined ? {} : { respawn }) });
    }

    /**
     * Adds hideouts in the wild, on top of the level's camps (`chooseWildSites` says where). Each is a few bandits standing
     * about a point of the walkable ground, in the souls the level's own bandits come in. `people` are the places where the
     * level puts ordinary people, which a hideout keeps away from. Returns how many hideouts were added.
     */
    addWild(candidates: readonly WildCandidate[], people: readonly Point[], reach: Reach = NAVIGATION): number {
        const chosen = chooseWildSites(candidates, people, this.camps.map((camp) => camp.center), reach, this.settings);
        const souls = this.souls();
        let hideouts = this.camps.filter((camp) => camp.name.startsWith("Esconderijo")).length;
        for (const { centre } of chosen) {
            const count = this.between(this.settings.wildMinPerCamp, this.settings.wildMaxPerCamp);
            const spots: Spot[] = [];
            for (let index = 0; index < count; index += 1) {
                // Walkable ground about the centre; failing that, a ring round it.
                const angle = (index / count) * 2 * Math.PI;
                const ring = { x: centre.x + 3 * Math.cos(angle), y: centre.y + 3 * Math.sin(angle), z: centre.z };
                spots.push({ position: reach.around(centre, this.settings.wildSpotRadius) ?? ring, soul: this.pick(souls) });
            }
            hideouts += 1;
            this.addCamp(`Esconderijo ${hideouts}`, centre, spots, this.settings.wildMinPerCamp, this.settings.wildMaxPerCamp);
        }
        return chosen.length;
    }

    /**
     * Adds gangs on the roads, at the places `chooseRoadSites` keeps (2026-10-24): three or four bandits about each, in the souls the level's
     * own bandits come in, an archer among them from three. `people` are the places where the level puts ordinary people. Returns how many gangs
     * were added.
     */
    addRoads(candidates: readonly WildCandidate[], people: readonly Point[], reach: Reach = NAVIGATION): number {
        const chosen = chooseRoadSites(candidates, people, this.camps.map((camp) => camp.center), reach, this.settings);
        const souls = this.souls();
        let posts = this.camps.filter((camp) => camp.name.startsWith("Estrada")).length;
        for (const { centre } of chosen) {
            const count = this.between(this.settings.roadMinPerPost, this.settings.roadMaxPerPost);
            const spots: Spot[] = [];
            for (let index = 0; index < count; index += 1) {
                const angle = (index / count) * 2 * Math.PI;
                const ring = { x: centre.x + 3 * Math.cos(angle), y: centre.y + 3 * Math.sin(angle), z: centre.z };
                spots.push({ position: reach.around(centre, this.settings.roadSpotRadius) ?? ring, soul: this.pick(souls) });
            }
            posts += 1;
            this.addCamp(`Estrada ${posts}`, centre, spots, this.settings.roadMinPerPost, this.settings.roadMaxPerPost, this.settings.roadRespawnMs);
        }
        return chosen.length;
    }

    /**
     * What one bandit wears and carries: plain clothes, a cheap weapon, a few coins and a bite to eat. A camp's (`bow`) has a bow and arrows
     * besides his blade, and a veteran the battered kit; rows marked `strip` are taken off his body when he falls.
     */
    inventoryFor(archer: boolean, options: { readonly veteran?: boolean; readonly bow?: boolean } = {}): Row[] {
        const veteran = options.veteran === true && !archer;
        const battered = (): Record<string, unknown> => ({ condition: Math.round((0.3 + this.random() * 0.2) * 100) / 100 });
        const items: Row[] = [
            { item: this.pick(TUNICS), amount: 1, equipped: 1 },
            { item: this.pick(HOSE), amount: 1, equipped: 1 },
            veteran ? { item: this.pick(VETERAN_HEADS), amount: 1, equipped: 1, metadata: battered(), strip: true } : { item: this.pick(HEADS), amount: 1, equipped: 1 },
        ];
        if (veteran) {
            items.push(
                { item: this.pick(VETERAN_NECKS), amount: 1, equipped: 1, metadata: battered(), strip: true },
                { item: VETERAN_BODY, amount: 1, equipped: 1, metadata: battered(), strip: true },
                { item: VETERAN_ARMS, amount: 1, equipped: 1, metadata: battered(), strip: true },
                { item: VETERAN_BOOTS, amount: 1, equipped: 1, metadata: battered(), strip: true },
            );
            if (this.random() < 0.5) {
                items.push({ item: VETERAN_MAIL, amount: 1, equipped: 1, metadata: battered(), strip: true });
            }
        } else if (this.random() < 0.4) {
            items.push({ item: this.pick(COATS), amount: 1, equipped: 1 });
        }
        if (archer) {
            const arrows = this.between(10, 20);
            items.push({ item: BOW, amount: 1, equipped: 1 }, { item: ARROWS, amount: arrows, equipped: arrows });
        } else {
            items.push({ item: this.pick(MELEE), amount: 1, equipped: 1 });
            if (options.bow === true) {
                const arrows = this.between(8, 14);
                items.push({ item: BOW, amount: 1, equipped: 1, strip: true }, { item: ARROWS, amount: arrows, equipped: arrows, strip: true });
            }
        }
        // The game shows a tenth of the item's amount: 20 to 80 reads as 2 to 8 coins (5 to 20 before 2026-10-25).
        items.push({ item: "money", amount: this.between(20, 80) });
        if (this.random() < CARRIED_FOOD_CHANCE) {
            items.push({ item: this.pick(FOOD), amount: 1 });
        }
        if (this.random() < CARRIED_GOODS_CHANCE) {
            const entry = this.pick(CHEST_LOOT);
            items.push({ item: this.pick(entry.items), amount: this.between(entry.min, Math.max(entry.min, Math.ceil(entry.max / 2))) });
        }
        return items;
    }

    /** Two to four different kinds of guild goods (three to six before 2026-10-25), and now and then a piece of clothing. */
    chestLoot(): { item: string; amount: number }[] {
        const rows: { item: string; amount: number }[] = [];
        const wanted = this.between(2, 4);
        const total = CHEST_LOOT.reduce((sum, entry) => sum + entry.weight, 0);
        for (let guard = 0; rows.length < wanted && guard < 40; guard += 1) {
            let left = this.random() * total;
            let entry = CHEST_LOOT[0]!;
            for (const candidate of CHEST_LOOT) {
                left -= candidate.weight;
                if (left <= 0) {
                    entry = candidate;
                    break;
                }
            }
            const item = this.pick(entry.items);
            if (!rows.some((row) => row.item === item)) {
                rows.push({ item, amount: this.between(entry.min, entry.max) });
            }
        }
        if (this.random() < 0.2) {
            rows.push({ item: this.pick(CLOTHES), amount: 1 });
        }
        return rows;
    }

    private failed(code: string): void {
        this.failures.set(code, (this.failures.get(code) ?? 0) + 1);
    }

    /**
     * Offers rows one at a time, keeping those the game takes. Each try replaces the whole stock and a refused one
     * changes nothing, so what stays is the last lot that was taken. Returns the rows kept and the ones refused.
     */
    private oneByOne<T>(rows: readonly T[], take: (rows: T[]) => boolean): { kept: T[]; refused: T[] } {
        const kept: T[] = [];
        const refused: T[] = [];
        for (const row of rows) {
            if (take([...kept, row])) {
                kept.push(row);
            } else {
                refused.push(row);
            }
        }
        return { kept, refused };
    }

    /**
     * Dresses and stocks a new bandit. When the game refuses the lot (a garment that body cannot wear, two in one
     * place), the worn things are offered one by one and the bandit goes without the ones refused. When it takes none
     * of them the bandit is left in the clothes its soul came with rather than stripped.
     */
    private stock(npc: Npc, archer: boolean): void {
        this.stockWith(npc, this.inventoryFor(archer));
    }

    private stockWith(npc: Npc, wanted: Row[]): void {
        const rows = this.byClass(wanted);
        const send = (list: readonly Classed[]): InventoryResult =>
            Inventory.set(npc, {
                items: list.map(({ item, amount, equipped, metadata }) => ({ item, amount, ...(equipped === undefined ? {} : { equipped }), ...(metadata === undefined ? {} : { metadata }) })),
                harvested: false,
            });
        const whole = send(rows);
        if (whole.ok) {
            return;
        }
        const worn = rows.filter((row) => (row.equipped ?? 0) > 0);
        const loose = rows.filter((row) => (row.equipped ?? 0) === 0);
        const { kept, refused } = this.oneByOne(worn, (list) => send(list).ok);
        if (kept.length === 0) {
            this.failed(`roupa e arma: ${whole.code}`);
            return;
        }
        for (const row of refused) {
            this.refusedGear.set(row.name, (this.refusedGear.get(row.name) ?? 0) + 1);
        }
        const result = send([...kept, ...loose]);
        if (!result.ok) {
            this.failed(`dinheiro e comida: ${result.code}`);
        }
    }

    /** Dresses and arms a bandit made elsewhere (the road's, `ambush.ts`) as the camps' own are. */
    dress(npc: Npc, archer: boolean): void {
        this.stock(npc, archer);
    }

    /** What a Cuman of the roads wears and carries. */
    cumanInventory(archer: boolean): Row[] {
        const items: Row[] = [
            { item: this.pick(CUMAN_TUNICS), amount: 1, equipped: 1 },
            { item: this.pick(HOSE), amount: 1, equipped: 1 },
            { item: this.random() < 0.2 ? CUMAN_HELMET : this.pick(CUMAN_HEADS), amount: 1, equipped: 1 },
            { item: this.pick(CUMAN_BOOTS), amount: 1, equipped: 1 },
        ];
        if (archer) {
            const arrows = this.between(12, 24);
            items.push({ item: CUMAN_BOW, amount: 1, equipped: 1 }, { item: ARROWS, amount: arrows, equipped: arrows });
        } else {
            items.push({ item: this.pick(CUMAN_MELEE), amount: 1, equipped: 1 });
            if (this.random() < 0.4) {
                items.push({ item: this.pick(CUMAN_SHIELDS), amount: 1, equipped: 1 });
            }
        }
        items.push({ item: "money", amount: this.between(30, 100) });
        if (this.random() < CARRIED_GOODS_CHANCE) {
            const entry = this.pick(CHEST_LOOT);
            items.push({ item: this.pick(entry.items), amount: this.between(entry.min, Math.max(entry.min, Math.ceil(entry.max / 2))) });
        }
        return items;
    }

    /** Dresses and arms a Cuman of the roads (`ambush.ts`). */
    dressCuman(npc: Npc, archer: boolean): void {
        this.stockWith(npc, this.cumanInventory(archer));
    }

    /** The souls the level gives its bandits, to make more of them; the generic one when it gives none. */
    souls(): string[] {
        const found = [...new Set(this.camps.flatMap((camp) => camp.slots.map((slot) => slot.spot.soul)).filter((soul) => soul !== ""))];
        return found.length > 0 ? found : ["bandit"];
    }

    /** Fills one camp chest. Goods the game will not take are left out, and left out of later fills too. */
    private fill(stash: Stash): boolean {
        const rows = this.byClass(this.chestLoot().filter((row) => !this.refusedLoot.has(row.item)));
        if (rows.length === 0) {
            this.failed("baú: nada que o jogo conheça");
            return false;
        }
        const send = (list: readonly Classed[]): InventoryResult => stash.setInventory({ items: list.map(({ item, amount }) => ({ item, amount })) });
        const whole = send(rows);
        if (whole.ok) {
            return true;
        }
        const { kept, refused } = this.oneByOne(rows, (list) => send(list).ok);
        if (kept.length === 0) {
            this.failed(`baú: ${whole.code}`);
            return false;
        }
        refused.forEach((row) => this.refusedLoot.add(row.name));
        return true;
    }

    /** What the game refused since the start, for the log. */
    report(): string[] {
        const lines: string[] = [];
        if (this.unknownNames.size > 0) {
            lines.push(`nomes que o jogo não conhece: ${[...this.unknownNames].join(", ")}`);
        }
        if (this.refusedGear.size > 0) {
            lines.push(`o jogo não vestiu: ${[...this.refusedGear].map(([item, times]) => `${item} (${times}x)`).join(", ")}`);
        }
        if (this.refusedLoot.size > 0) {
            lines.push(`os baús não aceitaram: ${[...this.refusedLoot].join(", ")}`);
        }
        if (this.failures.size > 0) {
            lines.push(`recusado por inteiro: ${[...this.failures].map(([code, times]) => `${code} (${times}x)`).join(", ")}`);
        }
        return lines;
    }

    private snap(point: Point): Vector3 {
        const raw = new Vector3(point.x, point.y, point.z);
        if (Navigation.ready) {
            const snapped = Navigation.closestPoint(raw, { searchRadius: 6, searchHeight: 10, doors: "none" });
            if (snapped !== null) {
                return snapped;
            }
        }
        return raw;
    }

    /** Puts a bandit in a slot. True when it stands there now. */
    spawn(camp: Camp, slot: Slot): boolean {
        try {
            const health = slot.veteran === true ? this.settings.veteranHealth : this.settings.health;
            const npc = Npc.create({
                soul: slot.spot.soul || "bandit",
                position: this.snap(slot.spot.position),
                rotation: new Vector3(0, 0, this.random() * 360),
                name: slot.archer ? "Bandido arqueiro" : slot.veteran === true ? "Bandido veterano" : "Bandido",
                nametag: false,
                interactable: false,
                lootable: true,
                health,
                maxHealth: health,
            });
            const rows = this.inventoryFor(slot.archer, { veteran: slot.veteran === true, bow: !slot.archer });
            this.stockWith(npc, rows);
            slot.strip = this.byClass(rows.filter((row) => row.strip === true)).map((row) => row.item);
            slot.potions = slot.veteran === true ? this.settings.veteranPotions : this.settings.potions;
            slot.potionAt = 0;
            slot.finishAt = undefined;
            slot.finishBy = undefined;
            slot.mode = slot.archer ? "bow" : "melee";
            slot.hasBow = !slot.archer && rows.some((row) => row.item === BOW);
            slot.noBowUntil = 0;
            slot.npcId = npc.id;
            slot.state = "alive";
            slot.target = null;
            slot.retryAt = 0;
            delete slot.respawnWait;
            this.bySlot.set(npc.id, { camp, slot });
            return true;
        } catch (error: unknown) {
            console.log(`bandits: ${camp.name}: não consegui criar um bandido: ${error instanceof Error ? error.message : String(error)}`);
            slot.state = "dead";
            slot.deathAt = this.now();
            // A place that failed to be filled is tried again as a camp's is, not after the hours a gang's dead wait.
            slot.respawnWait = this.settings.respawnMs;
            return false;
        }
    }

    spawnAll(): number {
        let spawned = 0;
        for (const camp of this.camps) {
            for (const slot of camp.slots) {
                if (slot.state === "vacant" && this.spawn(camp, slot)) {
                    spawned += 1;
                }
            }
        }
        return spawned;
    }

    /** Finds each camp's containers once, then fills them. Returns how many containers were filled. */
    stockChests(force = false): number {
        let filled = 0;
        const stashes = this.camps.some((camp) => !camp.scanned) ? Stash.all() : [];
        for (const camp of this.camps) {
            if (!camp.scanned) {
                camp.scanned = true;
                camp.chests = stashes
                    .filter((stash) => stash.levelGuid !== "" && CONTAINER.test(stash.name) && !NOT_STORES.test(stash.name) && flat(stash.position, camp.center) <= this.settings.chestRadius && propertyOfStash(stash.levelGuid) === null)
                    .map((stash) => stash.levelGuid);
            }
            if (!force && this.now() - camp.chestsFilledAt < this.settings.chestRefillMs) {
                continue;
            }
            if (!force && this.playersNear(camp.center, this.settings.chestClearRadius)) {
                continue;
            }
            for (const guid of camp.chests) {
                const stash = Stash.find(guid);
                if (stash === null) {
                    this.failed("baú: não encontrado");
                } else if (!stash.isOpen && this.fill(stash)) {
                    filled += 1;
                }
            }
            camp.chestsFilledAt = this.now();
        }
        return filled;
    }

    private players(): Array<{ player: Player; position: Point }> {
        return Player.all()
            // The world everybody plays in is the global one (4294967295); a test against 0 alone left every real player out, and with
            // them every bandit never saw anybody (user, 2026-10-18: "os bandidos estão estáticos").
            .filter((player) => player.ready && player.alive && (player.virtualWorld === 0 || player.virtualWorld === 0xffffffff))
            .map((player) => ({ player, position: player.position }));
    }

    private playersNear(point: Point, radius: number): boolean {
        return this.players().some((entry) => flat(entry.position, point) <= radius);
    }

    // -----------------------------------------------------------------------------------------
    // Events.

    isBandit(npcId: number): boolean {
        return this.bySlot.has(npcId);
    }

    isVeteran(npcId: number): boolean {
        return this.bySlot.get(npcId)?.slot.veteran === true;
    }

    died(npcId: number): void {
        const entry = this.bySlot.get(npcId);
        if (entry !== undefined && entry.slot.state === "alive") {
            entry.slot.state = "dead";
            entry.slot.deathAt = this.now();
            entry.slot.target = null;
            entry.slot.finishAt = undefined;
            entry.slot.finishBy = undefined;
            const corpse = Npc.getById(npcId);
            if (corpse !== null && (entry.slot.strip?.length ?? 0) > 0) {
                this.strip(corpse, entry.slot.strip ?? []);
            }
        }
    }

    /** Takes off a fallen bandit what is not loot (the veteran's armour, the second bow): what is left on him is his clothes, blade and purse. */
    private strip(corpse: Npc, classes: readonly string[]): number {
        try {
            const wanted = new Set(classes.map((item) => item.toLowerCase()));
            const units = (Inventory.get(corpse)?.items ?? []).filter((row) => wanted.has(String(row.item).toLowerCase())).map((row) => ({ id: row.id, amount: row.amount }));
            if (units.length === 0) {
                return 0;
            }
            return Inventory.remove(corpse, { units, notify: false }).ok ? units.length : 0;
        } catch {
            return 0;
        }
    }

    /**
     * A bandit left with next to nothing is finished (2026-10-27: "matei um bandido com combo e ele bugou, ficou caído no chão mas não morreu"). The archer of a road gang
     * went from 25 to 3 of 180 and lay there alive: the game lays a body down at the edge of death, where no blow lands, and the server's ledger never reaches zero (the
     * same as the animals', `animals.ts`). A man at or below `finishBelow` of his health is held where he is and killed a moment later, for the last who struck him. True
     * while he is being finished (nothing else is done for him), and when he has just been.
     */
    finishOff(slot: Slot, npc: Npc, now: number, attacker?: Player): boolean {
        if (slot.finishAt !== undefined) {
            if (now < slot.finishAt) {
                return true;
            }
            const by = slot.finishBy;
            slot.finishAt = undefined;
            slot.finishBy = undefined;
            if (npc.alive) {
                npc.kill(by);
            }
            return true;
        }
        if (!npc.alive || !(npc.maxHealth > 0) || npc.health > Math.max(this.settings.finishPoints, npc.maxHealth * this.settings.finishBelow)) {
            return false;
        }
        // A man who still has a draught drinks it before anything: it is what he does when he is this hurt, and what stands him up again.
        if (this.drink(slot, npc)) {
            return false;
        }
        slot.finishAt = now + this.settings.finishAfterMs;
        slot.finishBy = attacker?.id ?? slot.target ?? undefined;
        npc.hold();
        return true;
    }

    /**
     * A bandit badly hurt drinks a draught, while he has one: a good part of his health back, and a shout. True when he drank.
     */
    drink(slot: Slot, npc: Npc): boolean {
        const now = this.now();
        if ((slot.potions ?? 0) <= 0 || now < (slot.potionAt ?? 0) || !npc.alive || !(npc.maxHealth > 0) || !(npc.health <= npc.maxHealth * this.settings.potionBelow)) {
            return false;
        }
        slot.potions = (slot.potions ?? 0) - 1;
        slot.potionAt = now + this.settings.potionEveryMs;
        npc.health = Math.min(npc.maxHealth, npc.health + npc.maxHealth * this.settings.potionHeal);
        npc.say(BARKS.potion[Math.floor(this.random() * BARKS.potion.length)] ?? "");
        return true;
    }

    /**
     * What a bandit should fight with at this range: the bow for an archer; for one with a bow and a blade, the bow once his man is farther than
     * `bowFromM`, and the blade again once he is nearer than `meleeFromM` (the gap keeps him from changing at every step); the blade alone for
     * one whose bow the game refused a moment ago.
     */
    weaponFor(slot: Slot, range: number): "melee" | "bow" {
        if (slot.archer) {
            return "bow";
        }
        if (slot.hasBow !== true || this.now() < (slot.noBowUntil ?? 0)) {
            return "melee";
        }
        if (slot.mode === "bow") {
            return range < this.settings.meleeFromM ? "melee" : "bow";
        }
        return range > this.settings.bowFromM ? "bow" : "melee";
    }

    /** Orders a bandit who fights hand to hand to fight with the weapon the range asks for, falling back on the blade. True when the order went out. */
    private order(slot: Slot, npc: Npc, player: Player, range: number): boolean {
        if (this.weaponFor(slot, range) === "bow") {
            if (npc.attack(player, { weapon: "bow" })) {
                slot.mode = "bow";
                return true;
            }
            slot.noBowUntil = this.now() + 30_000;
        }
        const ordered = npc.attack(player);
        if (ordered) {
            slot.mode = "melee";
        }
        return ordered;
    }

    removed(npcId: number): void {
        const entry = this.bySlot.get(npcId);
        if (entry === undefined) {
            return;
        }
        this.bySlot.delete(npcId);
        if (entry.slot.npcId === npcId) {
            if (entry.slot.state === "alive") {
                entry.slot.deathAt = this.now();
            }
            entry.slot.state = "dead";
            entry.slot.npcId = null;
        }
    }

    /**
     * A bandit was hit by a player: the whole camp turns on them for a while, and he curses. And he is ordered to fight there and then,
     * not at the next look a second later: struck, the game's own reaction is fright, and the bandits of 2026-10-21 "corriam quando eu
     * batia neles, pareciam NPC"; an order to fight given right after the blow takes the place of it.
     */
    hit(npcId: number, attacker: Player): void {
        const entry = this.bySlot.get(npcId);
        if (entry === undefined) {
            return;
        }
        const now = this.now();
        entry.camp.alarm = { targetId: attacker.id, until: now + this.settings.alarmMs };
        this.bark(entry.slot, BARKS.hurt);
        const npc = Npc.getById(npcId);
        if (npc === null || !npc.alive) {
            return;
        }
        // Next to nothing left: he is finished, not ordered to fight.
        if (this.finishOff(entry.slot, npc, now, attacker)) {
            return;
        }
        if (now < (entry.slot.hitOrderAt ?? 0)) {
            return;
        }
        entry.slot.hitOrderAt = now + this.settings.hitOrderMs;
        const before = npc.simulator;
        const moved = this.runBy(entry.slot, npc, attacker);
        if (moved) {
            const there = before === null || before === undefined ? "ninguém o rodava" : `o jogo de ${before.nickname}, a ${Math.round(flat(before.position, npc.position))} m dele, o rodava`;
            this.note(entry.camp, npc, attacker, `preso ao jogo de quem bate (${there})`);
        }
        this.drink(entry.slot, npc);
        const range = flat(npc.position, attacker.position);
        const ordered = entry.slot.archer ? (range > this.settings.chaseFromM && npc.attack(attacker, { weapon: "bow" })) || npc.attack(attacker) : this.order(entry.slot, npc, attacker, range);
        if (ordered) {
            entry.slot.target = attacker.id;
            entry.slot.retryAt = now + this.settings.retryMs;
        }
        this.note(entry.camp, npc, attacker, `atingido (vida ${Math.round(npc.health)}/${Math.round(npc.maxHealth)}): ataque ${ordered ? "reordenado" : "RECUSADO"}`);
    }

    /**
     * Whoever strikes a bandit runs him, when his own runner is far from him (see `runnerFarM`): the blow is judged by the game that runs the one struck, so a
     * blow at a man run from sixty metres away came to nothing. Never taken from a runner who is near him, so two players at one man do not pull him between
     * their games. True when he was given to the attacker.
     */
    private runBy(slot: Slot, npc: Npc, attacker: Player): boolean {
        const runner = npc.simulator;
        if (runner !== null && runner !== undefined && (runner.id === attacker.id || flat(runner.position, npc.position) <= this.settings.runnerFarM)) {
            return false;
        }
        if (flat(attacker.position, npc.position) > this.settings.runnerNearM) {
            return false;
        }
        npc.pin(attacker);
        slot.pinned = true;
        return true;
    }

    /** A bandit shouts one of `lines`, no oftener than every `BARK_EVERY_MS`. */
    private bark(slot: Slot, lines: readonly string[]): void {
        const now = this.now();
        if (slot.npcId === null || now < (slot.barkAt ?? 0)) {
            return;
        }
        const npc = Npc.getById(slot.npcId);
        if (npc !== null && npc.alive) {
            slot.barkAt = now + BARK_EVERY_MS;
            npc.say(lines[Math.floor(this.random() * lines.length)] ?? "");
        }
    }

    // -----------------------------------------------------------------------------------------

    tick(): void {
        if (!this.running) {
            return;
        }
        const now = this.now();
        const players = this.players().filter((entry) => entry.player.canAct);
        for (const camp of this.camps) {
            const near = players.filter((entry) => flat(entry.position, camp.center) <= this.settings.activationRadius);
            const alarm = camp.alarm !== null && camp.alarm.until > now ? camp.alarm : null;
            if (camp.alarm !== null && alarm === null) {
                camp.alarm = null;
            }

            for (const slot of camp.slots) {
                if (slot.state !== "alive") {
                    this.tendDead(camp, slot, now);
                    continue;
                }
                const npc = slot.npcId === null ? null : Npc.getById(slot.npcId);
                if (npc === null) {
                    continue;
                }
                if (!npc.alive) {
                    this.died(npc.id);
                    continue;
                }
                if (this.finishOff(slot, npc, now)) {
                    continue;
                }
                if (near.length === 0) {
                    if (slot.pinned === true) {
                        slot.pinned = false;
                        npc.pin(null);
                    }
                    continue;
                }
                this.keepRunning(slot, npc, near);
                const inLeash = (entry: { position: Point }): boolean => flat(entry.position, camp.center) <= this.settings.leashRadius;
                const position = npc.position;

                let target = slot.target === null ? undefined : near.find((entry) => entry.player.id === slot.target && inLeash(entry));
                if (target === undefined && alarm !== null) {
                    target = near.find((entry) => entry.player.id === alarm.targetId && inLeash(entry));
                }
                if (target === undefined) {
                    let best = this.settings.aggroRadius;
                    for (const entry of near) {
                        const range = flat(entry.position, position);
                        if (range <= best && inLeash(entry)) {
                            best = range;
                            target = entry;
                        }
                    }
                }

                if (target !== undefined) {
                    // An order that ended (the body stands, or reached its goal) is given again; one that failed, too; and one the game's own
                    // fright put out (he is no longer told to fight, nor to run at the target) is given back. One with a bow and a blade who
                    // should change (his man ran off, or came close) is given the other.
                    const ended = npc.status === "failed" || npc.status === "blocked" || npc.status === "idle" || npc.status === "reached" || (npc.intent !== "attack" && npc.intent !== "moveTo");
                    const range = flat(position, target.position);
                    const change = !slot.archer && this.weaponFor(slot, range) !== (slot.mode ?? "melee");
                    this.drink(slot, npc);
                    if (slot.target !== target.player.id || change || (ended && now >= slot.retryAt)) {
                        const first = slot.target !== target.player.id;
                        // An archer whose bow the game would not put on fights hand to hand instead.
                        const ordered = slot.archer ? npc.attack(target.player, { weapon: "bow" }) || npc.attack(target.player) : this.order(slot, npc, target.player, range);
                        if (change && ordered) {
                            this.note(camp, npc, target.player, slot.mode === "bow" ? "tomou o arco: o alvo se afastou" : "voltou à lâmina: o alvo chegou perto");
                        }
                        if (first || !ordered) {
                            this.note(camp, npc, target.player, `ataque ${ordered ? "ordenado" : "RECUSADO"}`);
                        }
                        if (ordered) {
                            slot.target = target.player.id;
                            if (first) {
                                this.bark(slot, alarm !== null && alarm.targetId === target.player.id ? BARKS.alarm : BARKS.sight);
                            }
                        }
                        slot.retryAt = now + this.settings.retryMs;
                    }
                    this.pursue(camp, slot, npc, target, now);
                    // Anyone in the camp who sees a fight joins it.
                    if (camp.alarm === null || camp.alarm.until <= now) {
                        camp.alarm = { targetId: target.player.id, until: now + this.settings.alarmMs };
                    }
                    continue;
                }

                if (slot.target !== null) {
                    slot.target = null;
                    npc.hold();
                    slot.retryAt = 0;
                }
                if (flat(position, slot.spot.position) > this.settings.homeRadius && npc.status !== "running" && now >= slot.retryAt) {
                    npc.moveTo(slot.spot.position, { speed: "walk", radius: 2, pathfinding: "server" });
                    slot.retryAt = now + 10_000;
                } else if (npc.status !== "running" && now >= (slot.roamAt ?? 0)) {
                    this.stroll(slot, npc, now);
                }
            }
        }
    }

    /** The game that runs him: his own (`npc.simulator`), or, when nobody's does, the nearest player's, made to. */
    private keepRunning(slot: Slot, npc: Npc, near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>): void {
        const runner = npc.simulator;
        const position = npc.position;
        // A runner far past reach, with somebody much nearer, is replaced; one that is near enough is left to the game's own election.
        const there = runner === null || runner === undefined ? Infinity : flat(runner.position, position);
        if (runner !== null && runner !== undefined && there <= this.settings.runnerLostM) {
            return;
        }
        let best: Player | null = null;
        let nearest = this.settings.pinM;
        for (const entry of near) {
            const range = flat(entry.position, position);
            if (range <= nearest) {
                nearest = range;
                best = entry.player;
            }
        }
        if (best === null || (runner !== null && runner !== undefined && (best.id === runner.id || nearest + this.settings.runnerGapM >= there))) {
            return;
        }
        npc.pin(best);
        if (slot.pinned !== true) {
            slot.pinned = true;
            console.log(`bandits: ${npc.id} ${runner === null || runner === undefined ? "estava parado (nenhum jogo o rodava)" : `era rodado por ${runner.nickname}, a ${Math.round(there)} m`}: preso ao jogo de ${best.nickname}, a ${Math.round(nearest)} m`);
        }
    }

    private noted = 0;
    private notedAt = 0;

    /** One line in the log about a bandit and the player he is after (at most forty a minute): who runs him, what he was told, how far. */
    private note(camp: Camp, npc: Npc, player: Player, what: string): void {
        const now = this.now();
        if (now - this.notedAt > 60_000) {
            this.notedAt = now;
            this.noted = 0;
        }
        if (this.noted >= 40) {
            return;
        }
        this.noted += 1;
        const runner = npc.simulator;
        console.log(`bandits: ${camp.name}: ${npc.name} ${npc.id} e ${player.nickname}, a ${Math.round(flat(npc.position, player.position))} m: ${what}; ${npc.status}/${npc.intent}, ${runner === null || runner === undefined ? "PARADO (nenhum jogo o roda)" : `rodado por ${runner.nickname}${runner.id === player.id ? "" : `, a ${Math.round(flat(runner.position, npc.position))} m dele`}`}`);
    }

    /**
     * A bandit ordered to fight who stands where he was for a few seconds, still far from his target, is sent running at it along
     * the route the server plans: the game's own pursuit is not in his hands to see, a walk is, and when he arrives the order to
     * fight is given again (the next look, `ended`).
     */
    private pursue(camp: Camp, slot: Slot, npc: Npc, target: { readonly player: Player; readonly position: Point }, now: number): void {
        const here = npc.position;
        if (slot.watchX === undefined || slot.watchY === undefined || flat(here, { x: slot.watchX, y: slot.watchY, z: here.z }) > 0.7) {
            slot.watchX = here.x;
            slot.watchY = here.y;
            slot.watchAt = now;
            return;
        }
        const range = flat(here, target.position);
        const shooting = slot.archer || slot.mode === "bow";
        const from = shooting ? this.settings.archerFromM : this.settings.chaseFromM;
        if (now - (slot.watchAt ?? now) < this.settings.stillMs || range <= from || now < (slot.chaseAt ?? 0)) {
            return;
        }
        slot.chaseAt = now + this.settings.chaseEveryMs;
        slot.retryAt = Math.min(slot.retryAt, now + 2_000);
        const goal = new Vector3(target.position.x, target.position.y, target.position.z);
        const sent = npc.moveTo(goal, { speed: "run", radius: shooting ? this.settings.archerFromM - 4 : 1.8, pathfinding: Navigation.ready ? "server" : "game" });
        this.note(camp, npc, target.player, `parado há ${Math.round((now - (slot.watchAt ?? now)) / 1000)} s: mandado correr até o alvo (${sent ? "aceito" : "RECUSADO"})`);
    }

    /** What stands about the player, camp by camp, for an administrator watching (`/bandidos estado`). */
    inspect(position: Point, radius = 250): string[] {
        const lines: string[] = [];
        const now = this.now();
        for (const camp of this.camps) {
            if (flat(camp.center, position) > radius) {
                continue;
            }
            lines.push(`${camp.id}. ${camp.name}, a ${Math.round(flat(camp.center, position))} m:`);
            for (const slot of camp.slots) {
                const npc = slot.npcId === null ? null : Npc.getById(slot.npcId);
                if (slot.state !== "alive" || npc === null) {
                    lines.push(`    ${slot.state === "dead" ? `morto, volta ${waitText(this.respawnWaitOf(camp, slot) - (now - slot.deathAt))}` : "vago"}`);
                    continue;
                }
                const runner = npc.simulator;
                lines.push(`    ${npc.name} ${npc.id}: a ${Math.round(flat(npc.position, position))} m, ${npc.status}/${npc.intent}, ${runner === null || runner === undefined ? "PARADO (ninguém o roda)" : `rodado por ${runner.nickname}`}, alvo ${slot.target ?? "nenhum"}, ${slot.mode === "bow" ? "arco" : "lâmina"}, vida ${Math.round(npc.health)}/${Math.round(npc.maxHealth)}, ${slot.potions ?? 0} poção(ões)${slot.pinned === true ? ", preso" : ""}${npc.frozen ? ", CONGELADO" : ""}`);
            }
        }
        return lines;
    }

    /** A few steps about his own spot, and a pause: a camp that never moves looks dead. */
    private stroll(slot: Slot, npc: Npc, now: number): void {
        const [low, high] = this.settings.roamPauseMs;
        slot.roamAt = now + low + Math.random() * (high - low);
        const point = NAVIGATION.around({ x: slot.spot.position.x, y: slot.spot.position.y, z: slot.spot.position.z }, this.settings.roamM);
        if (point !== null) {
            npc.moveTo(new Vector3(point.x, point.y, point.z), { speed: "walk", radius: 1.5, pathfinding: "server" });
        }
    }

    private tendDead(camp: Camp, slot: Slot, now: number): void {
        if (slot.npcId !== null) {
            const corpse = Npc.getById(slot.npcId);
            if (corpse === null) {
                this.bySlot.delete(slot.npcId);
                slot.npcId = null;
            } else if (now - slot.deathAt >= this.settings.corpseMs && !this.playersNear(corpse.position, this.settings.corpseClearRadius)) {
                const id = slot.npcId;
                slot.npcId = null;
                this.bySlot.delete(id);
                corpse.remove();
            }
        }
        const wait = slot.state === "dead" ? this.respawnWaitOf(camp, slot) : this.settings.respawnMs;
        if (slot.npcId === null && now - slot.deathAt >= wait && !this.playersNear(camp.center, this.settings.respawnClearRadius)) {
            slot.state = "vacant";
            this.spawn(camp, slot);
        }
    }

    /** How long after his death a dead man's place is filled again: the camp's `respawnMs`, or, for a gang of the roads, a time of his own between the two of its window. */
    private respawnWaitOf(camp: Camp, slot: Slot): number {
        if (slot.respawnWait === undefined) {
            const window = camp.respawn;
            slot.respawnWait = window === undefined ? this.settings.respawnMs : window[0] + this.random() * (window[1] - window[0]);
        }
        return slot.respawnWait;
    }

    /** Every dead bandit back, now, and every chest filled; for an administrator. */
    restockNow(): { spawned: number; chests: number } {
        let spawned = 0;
        for (const camp of this.camps) {
            for (const slot of camp.slots) {
                if (slot.state !== "alive") {
                    if (slot.npcId !== null) {
                        const id = slot.npcId;
                        slot.npcId = null;
                        this.bySlot.delete(id);
                        Npc.getById(id)?.remove();
                    }
                    slot.state = "vacant";
                    // The new man is nobody's game's yet: what the old one in this place had (a pin) is not his.
                    slot.pinned = false;
                    if (this.spawn(camp, slot)) {
                        spawned += 1;
                    }
                }
            }
        }
        return { spawned, chests: this.stockChests(true) };
    }

    describe(): string[] {
        return this.camps.map((camp) => {
            const alive = camp.slots.filter((slot) => slot.state === "alive").length;
            return `  ${camp.id}. ${camp.name} em ${camp.center.x.toFixed(0)} ${camp.center.y.toFixed(0)} ${camp.center.z.toFixed(0)}: ${alive}/${camp.slots.length} vivos, ${camp.chests.length} baú(s)`;
        });
    }

    stop(): void {
        this.running = false;
        for (const id of [...this.bySlot.keys()]) {
            Npc.getById(id)?.remove();
        }
        this.bySlot.clear();
    }
}

export const banditCamps = new BanditCamps();

/** The places of the roads, from `data/road-posts.json` (made by `tools/make-road-posts.py`); none when the file is not there. */
export function loadRoadPosts(): WildCandidate[] {
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/road-posts.json` : "", "resources/kcdc-gamemode/data/road-posts.json", "data/road-posts.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        const loaded = read<{ posts?: unknown }>(place);
        if (loaded.status !== "ok" || !Array.isArray(loaded.value.posts)) {
            continue;
        }
        const found: WildCandidate[] = [];
        for (const post of loaded.value.posts as Array<Record<string, unknown>>) {
            if (typeof post["id"] === "string" && typeof post["x"] === "number" && typeof post["y"] === "number" && typeof post["z"] === "number") {
                found.push({ guid: post["id"], position: { x: post["x"], y: post["y"], z: post["z"] } });
            }
        }
        return found;
    }
    return [];
}

/** The animals whose markers say the wild (a forest, a meadow), not a pasture or a yard. */
const WILD_ANIMALS = /^(Boar|Hare|RoeDeer|RedDeer|Wolf|WildDog)/;
/** How many times, ten seconds apart, the hideouts wait for the navigation mesh before giving up. */
const WILD_TRIES = 12;

export function installBandits(): void {
    loadAggression();
    const placements = Npc.placements();
    const camps = banditCamps.discover(placements);

    Events.on("npcDeath", (npc) => banditCamps.died(npc.id));
    Events.on("npcDestroy", (npc) => banditCamps.removed(npc.id));

    // The heavier hand: a bandit's blow on a player is worth more than an ordinary man's.
    Events.on("playerHit", (_victim, attacker, hit) => {
        if (attacker !== null && typeof attacker === "object" && banditCamps.isBandit(attacker.id) && !("steamId" in attacker)) {
            hit.damage *= banditSettings.damageMultiplier * (banditCamps.isVeteran(attacker.id) ? banditSettings.veteranDamage : 1);
        }
    });

    Events.on("npcDamage", (npc, attacker) => {
        if (attacker !== null && "steamId" in attacker && banditCamps.isBandit(npc.id)) {
            banditCamps.hit(npc.id, attacker);
        }
    });

    // The hideouts in the wild need the navigation mesh to put them on walkable ground, which may not be ready yet.
    let wildTimer: ReturnType<typeof setTimeout> | null = null;
    const placeWild = (attempt: number): void => {
        wildTimer = null;
        if (!Navigation.ready) {
            if (attempt >= WILD_TRIES) {
                console.log("bandits: a malha de navegação não ficou pronta: sem esconderijos na mata");
            } else {
                wildTimer = setTimeout(() => placeWild(attempt + 1), 10_000);
            }
            return;
        }
        const wild = Npc.animalSpawnpoints()
            .filter((point) => point.count > 0 && WILD_ANIMALS.test(point.actorClass))
            .map((point) => ({ guid: point.guid, position: { x: point.position.x, y: point.position.y, z: point.position.z } }));
        const people = placements
            .filter((place) => !((PATTERN.test(place.layer) || PATTERN.test(place.name)) && !/cinematic/i.test(place.layer)))
            .map((place) => place.position);
        const before = banditCamps.camps.length;
        const added = banditCamps.addWild(wild, people);
        // The roads, after the hideouts so that these keep their places (the numbers and the places of the hideouts do not change with the roads).
        const roadPosts = loadRoadPosts();
        if (roadPosts.length === 0) {
            console.log("bandits: data/road-posts.json não foi encontrado ou está vazio: sem bandidos nas estradas");
        }
        const roads = banditCamps.addRoads(roadPosts, people);
        const spawned = banditCamps.spawnAll();
        console.log(`bandits: ${added} esconderijo(s) na mata, a pelo menos ${banditSettings.wildFromPeopleM} m de qualquer lugar com gente, e ${roads} posto(s) nas estradas; ${spawned} bandido(s) a mais`);
        banditCamps.describe().slice(before).forEach((line) => console.log(`bandits: ${line.trim()}`));
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
        const spawned = banditCamps.spawnAll();
        const chests = banditCamps.stockChests(true);
        console.log(`bandits: ${spawned} bandido(s) em ${camps} acampamento(s); ${chests} baú(s) de acampamento abastecido(s)`);
        banditCamps.describe().forEach((line) => console.log(`bandits: ${line.trim()}`));
        banditCamps.report().forEach((line) => console.log(`bandits: ${line}`));
        timer = setInterval(() => {
            banditCamps.tick();
            banditCamps.stockChests();
        }, banditSettings.tickMs);
        placeWild(0);
    }, banditSettings.spawnAfterMs);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearTimeout(start);
        if (wildTimer !== null) {
            clearTimeout(wildTimer);
        }
        if (timer !== null) {
            clearInterval(timer);
        }
        banditCamps.stop();
    });

    console.log(`bandits: ${camps} acampamento(s) de bandidos encontrados no nível; aparecem ${banditSettings.spawnAfterMs / 1000} s depois de o servidor subir`);
}
