/**
 * What a character is handed, once: the starter pack, the kit of each guild they join, and the colours of each house
 * they swear to.
 *
 * Everything here goes through the ledger in `character-state.ts` (`hasKit` / `markKit`), one entry per item, so
 * rejoining, switching guild and back, or a server restart in the middle of a hand-out can never give a second
 * copy. A character that is not being kept (no Steam id, or a record that could not be read) gets nothing, since
 * there would be no ledger to remember it by.
 *
 * What the kits contain is chosen from the game's own item names (docs/guides/Resources/items.md) and the recipes
 * in the game's tables; `books.ts` has the recipe books.
 */

import { BOOKS_BY_ID, bookGuid } from "./books.js";
import { canKeep, hasKit, markKit } from "./character-state.js";
import { getCharacter } from "./characters.js";
import { craftItemGuid } from "./craft-items.js";

/**
 * Counted in the game's money item. The game shows a tenth of the item's amount (1,000 of it reads "100", and the 100
 * that were first paid read "10"), so this is the 100 coins a player sees.
 */
export const STARTER_MONEY = 1000;

/** What the first version paid, when 100 of the item was taken to be 100 coins. Paid characters are topped up to `STARTER_MONEY`. */
const FIRST_STARTER_MONEY = 100;

/** The dice of the tavern tables: a set of plain ones ("Ordinary die"), six, which is what a throw uses. */
export const STARTER_DICE = { item: "dieNormal", amount: 6 } as const;

/** The game shows money in tenths of the item's amount. */
const MONEY_UNIT = 10;

/**
 * So nobody starts the game bare-handed: a hunting sword to fight with, and a dagger, which the game does not make for
 * a fight. Both, for everybody (the first version drew one of three by lot, and a dagger alone left a newcomer
 * defenceless). Names are the game's own item names; `label` is what the game calls them in Portuguese.
 */
export const STARTER_WEAPONS: ReadonlyArray<{ readonly item: string; readonly label: string }> = [
    { item: "huntingSwordBasic", label: "uma espada de caça" },
    { item: "daggerCommon", label: "uma adaga" },
];

/**
 * A torch for the nights (40 minutes of dark, `world-cycle.ts`). It is the game's only torch item: named for the quest
 * scene it was made for, but it is the player's torch (weapon class "torch", its own equipment slot, the
 * `torch_player` model, and a light).
 */
export const STARTER_TORCH = { item: "rutinaAVypad_trackview_torch_weapon", amount: 1 } as const;

/**
 * Food that does not spoil (every item's decay time is 0), for a little more than five hours at the default hunger
 * level: a full stomach is 100 and lasts 3 hours at "média" (`hunger.ts`), and this is 188 of nourishment
 * (salame 24, carne-seca 20, queijo 24, nozes 14 each, from the game's tables).
 */
export const STARTER_FOOD: ReadonlyArray<{ readonly item: string; readonly amount: number; readonly label: string; readonly nourishment: number }> = [
    { item: "salamiDried", amount: 3, label: "salame seco", nourishment: 24 },
    { item: "beefDried", amount: 2, label: "carne-seca", nourishment: 20 },
    { item: "cheeseQuarterDried", amount: 2, label: "queijo seco", nourishment: 24 },
    { item: "walnuts", amount: 2, label: "nozes", nourishment: 14 },
];

/** Plain working clothes, tried in this order against what the game offers for the character's gender. */
const OUTFITS: Readonly<Record<"male" | "female", readonly string[]>> = {
    male: ["labourer_05", "labourer_02", "villager_10", "villager_16", "labourer_14"],
    female: ["f_villager_31", "f_villager_41", "f_villager_42", "f_villager_45", "f_villager_20"],
};

interface KitItem {
    /** A game item name, or a book's registration id. */
    readonly item: string;
    readonly amount: number;
    /** What the player is told, in the plural-free form; a book is named by its own title. */
    readonly label: string;
    /** For one body only: a piece cut for the other is not handed over (and not marked, should the body change). */
    readonly gender?: "male" | "female";
    /** The row's properties: a worn tool's condition. */
    readonly metadata?: Record<string, unknown>;
}

/** What each guild hands a member the first time they join it, keyed by the guild id in `status.ts`. */
export const GUILD_KITS: Readonly<Record<string, readonly KitItem[]>> = {
    "fabri-ferrarii": [
        { item: "kcdc:book:ferreiro-ferramentas", amount: 1, label: "" },
        { item: "kcdc:book:ferreiro-aprendiz", amount: 1, label: "" },
        { item: "bsmt_ironBad", amount: 10, label: "sucata de metal" },
        { item: "bsmt_ironGood", amount: 2, label: "ferro" },
        { item: "bsmt_steelBad", amount: 4, label: "aço" },
        { item: "bsmt_hardware", amount: 2, label: "material de fixação" },
    ],
    venatores: [
        { item: "bow_b", amount: 1, label: "arco de aveleira" },
        { item: "arrow_hunting", amount: 20, label: "flechas de caça" },
        { item: "arrow_normal", amount: 20, label: "flechas comuns" },
    ],
    tabernarii: [{ item: "pigMeat", amount: 3, label: "carne de porco crua" }],
    alchemistae: [
        { item: "kcdc:book:alquimia-aprendiz", amount: 1, label: "" },
        { item: "herb_urticaria", amount: 5, label: "urtiga" },
        { item: "herb_marigold", amount: 8, label: "calêndula" },
        { item: "herb_dandelion", amount: 4, label: "dente-de-leão" },
        { item: "herb_thistle", amount: 4, label: "cardo" },
        { item: "special_charcoal", amount: 2, label: "carvão" },
    ],
    // Plain clothes to sell, worth about what the other kits are (the game prices them at about 1,150 in all, against
    // 580 for the smith's, 140 for the innkeeper's and 60 for the alchemist's, and 3,600 with the hunter's bow).
    artifices: [
        { item: "TunicShort01_m01_D", amount: 2, label: "túnica curta" },
        { item: "TunicLong03_m01_D", amount: 1, label: "túnica longa" },
        { item: "TunicLong05_m01_E", amount: 1, label: "túnica gasta" },
        { item: "F_SimpleDress01_m01_D", amount: 1, label: "vestido simples" },
        { item: "Cap03_m01_E", amount: 2, label: "touca" },
        { item: "Hood04_m01_E", amount: 2, label: "capuz" },
        { item: "F_Veil05_m01_D", amount: 1, label: "véu" },
    ],
    // The Coletores (2026-10-21: "ao escolher essa guilda ganha uma roupa de lenhador parecida com minerador, uma picareta e um machado"): the
    // game's lumberjack axe; its only pick, the knight's, used and worn (the smith forges new ones); and the miners' working clothes, or a
    // woman's working dress, headscarf and shoes.
    collectores: [
        { item: "axeWork01", amount: 1, label: "machado de lenhador" },
        { item: "axeBattle03", amount: 1, label: "picareta (usada)", metadata: { quality: 1, condition: 0.5 } },
        { item: "TunicShort03_m01_D", amount: 1, label: "túnica de minerador", gender: "male" },
        { item: "HoseSeparate05_m01_D", amount: 1, label: "calças de mineiro", gender: "male" },
        { item: "Hood08_m01_D", amount: 1, label: "capuz de minerador", gender: "male" },
        { item: "BootsAnkle01_m03_C", amount: 1, label: "botas de trabalho", gender: "male" },
        { item: "F_SimpleDress06_m05_D", amount: 1, label: "vestido de trabalho", gender: "female" },
        { item: "F_Veil06_m01_D", amount: 1, label: "lenço de cabeça de trabalho", gender: "female" },
        { item: "F_Shoes02_m06_B", amount: 1, label: "sapatos de trabalho", gender: "female" },
        { item: "HandWrap01_m01_E", amount: 1, label: "bandagem de mão" },
    ],
    // The Agricultores (user, 2026-10-22: "o agricultor recebe roupas do ofício e pá, mais uns recursos para plantar"): the gardener's clothes of
    // the game (`kkut_gardener_1`: straw hat, leather apron, stitched hose, walking boots, hand wrap) or a woman's working dress with the straw
    // hat the game's villagers wear; the game's shovel; and seeds of what a village's garden grows first, a few more than the beds they can
    // keep at the start, so the first harvests need nothing more (harvests give seeds back, and the kitchen's and the apothecary's sellers
    // have the rest).
    // The Domadores (user, 2026-10-25): what a tamer starts with is what a horse is won over by, a few of the game's own treats (the carrot and
    // the apple are the best of `TREATS` in `wild-horses.ts`), and plain riding clothes of the game's own tables, in a different cut and colour
    // from the Agricultores' and the Coletores' so that three guilds do not look alike.
    domitores: [
        { item: "carrot", amount: 6, label: "cenouras" },
        { item: "apple", amount: 4, label: "maçãs" },
        { item: "TunicShort01_m01_D", amount: 1, label: "túnica de cavalariço", gender: "male" },
        { item: "HoseLoose01_m01_C", amount: 1, label: "calças de montaria", gender: "male" },
        { item: "BootsKnee05_m01_C", amount: 1, label: "botas altas", gender: "male" },
        { item: "Cap03_m01_E", amount: 1, label: "gorro de lã", gender: "male" },
        { item: "F_SimpleDress03_m01_C", amount: 1, label: "vestido de trabalho", gender: "female" },
        { item: "F_Hood01_m01_C", amount: 1, label: "capuz de trabalho", gender: "female" },
        { item: "F_Shoes02_m01_B", amount: 1, label: "sapatos de trabalho", gender: "female" },
        { item: "HandWrap01_m03_E", amount: 1, label: "bandagem de mão" },
    ],
    agricolae: [
        { item: "player_shovel", amount: 1, label: "pá" },
        { item: "kcdc-craft:semente-cebola", amount: 6, label: "sementes de cebola" },
        { item: "kcdc-craft:semente-repolho", amount: 4, label: "sementes de repolho" },
        { item: "kcdc-craft:semente-nabo", amount: 4, label: "sementes de nabo" },
        { item: "kcdc-craft:semente-cenoura", amount: 4, label: "sementes de cenoura" },
        { item: "kcdc-craft:semente-urtiga", amount: 4, label: "sementes de urtiga" },
        { item: "Cap15_m01_D", amount: 1, label: "chapéu de palha", gender: "male" },
        { item: "TunicLong03_m07_D", amount: 1, label: "avental de couro", gender: "male" },
        { item: "HoseJoined01_m11_C", amount: 1, label: "calça costurada", gender: "male" },
        { item: "BootsAnkle03_m04_D", amount: 1, label: "botas de andarilho", gender: "male" },
        { item: "F_SimpleDress01_m03_D", amount: 1, label: "vestido de trabalho", gender: "female" },
        { item: "F_Cap02_m01_B", amount: 1, label: "chapéu de palha", gender: "female" },
        { item: "F_Shoes02_m01_B", amount: 1, label: "sapatos de trabalho", gender: "female" },
        { item: "HandWrap01_m02_E", amount: 1, label: "bandagem de mão" },
        // Flax for the Artifices' linen and thread, and wheat for the Tabernarii's flour (2026-10-27, SINERGIA.md): the two crops the other trades wait on. At the END of
        // the list, because the ledger below is kept by position (`guild:<id>:<index>`): the farmers who joined before are handed these two at their next entry, and
        // nothing else a second time.
        { item: "kcdc-craft:semente-linho", amount: 6, label: "sementes de linho" },
        { item: "kcdc-craft:semente-trigo", amount: 4, label: "sementes de trigo" },
    ],
};

/** One piece of a house's colours: `piece` names it in the ledger, the same for both bodies. */
interface ColourPiece extends KitItem {
    readonly piece: "manto" | "gola";
}

/**
 * The colours of each house, handed the first time a character swears to it (user, 2026-10-14: a mantle in the house's
 * colours, red for the Golden Lion and blue for the Raven, and the collar). The game has no cloak a character can wear,
 * so the mantle is its embroidered coat (Casaco bordado), the same cut in both colours with gold bands, and the collar
 * its padded collar (Gola acolchoada). Those are cut for men; a woman gets the women's surcoat (Sobretudo) and hooded
 * collar (Capuz feminino), red and blue with gold embroidery. The colours were read from the game's own item icons.
 * Keyed by the faction id in `status.ts`.
 */
export const FACTION_COLOURS: Readonly<Record<string, Readonly<Record<"male" | "female", readonly ColourPiece[]>>>> = {
    "leao-dourado": {
        male: [
            { piece: "manto", item: "Coat11_m03_C", amount: 1, label: "o manto vermelho (casaco bordado)" },
            { piece: "gola", item: "CollarPadded01_m06_C1", amount: 1, label: "a gola acolchoada vermelha" },
        ],
        female: [
            { piece: "manto", item: "F_Surcote01_m09_C", amount: 1, label: "o manto vermelho (sobretudo)" },
            { piece: "gola", item: "F_Hood01_m01_C", amount: 1, label: "a gola vermelha (capuz bordado)" },
        ],
    },
    corvo: {
        male: [
            { piece: "manto", item: "Coat11_m04_C", amount: 1, label: "o manto azul (casaco bordado)" },
            { piece: "gola", item: "CollarPadded01_m04_C1", amount: 1, label: "a gola acolchoada azul" },
        ],
        female: [
            { piece: "manto", item: "F_Surcote01_m15_C", amount: 1, label: "o manto azul (sobretudo)" },
            { piece: "gola", item: "F_Hood01_m05_C", amount: 1, label: "a gola azul (capuz bordado)" },
        ],
    },
};

function say(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
}

/** The game may refuse an outfit for a moment (the body is still being dressed, or the new look has not landed). */
const RETRY_MS = 4_000;
const RETRIES = 3;
const retries = new Map<number, number>();

function retryLater(player: Player): void {
    const used = retries.get(player.id) ?? 0;
    if (used >= RETRIES) {
        retries.delete(player.id);
        return;
    }
    retries.set(player.id, used + 1);
    const id = player.id;
    setTimeout(() => {
        const again = Player.getById(id);
        if (again !== null) {
            ensureStarter(again);
        } else {
            retries.delete(id);
        }
    }, RETRY_MS);
}

/**
 * Right after the creator, the look the client publishes can lag behind the one just chosen, so the saved look
 * (written a moment earlier by the creator's own handler) is asked first.
 */
function genderOf(player: Player): "male" | "female" {
    const chosen = getCharacter(player.steamId)?.appearance.gender ?? player.appearance.gender;
    return chosen === "female" ? "female" : "male";
}

function outfitFor(player: Player): string | null {
    const gender = genderOf(player);
    const catalog = Player.outfitPresets(gender);
    const wanted = OUTFITS[gender].find((name) => catalog.includes(name));
    return wanted ?? catalog.find((name) => /villager|labourer/.test(name)) ?? null;
}

/** Whether the player holds an item of this name now, anywhere in their inventory. */
function holds(player: Player, item: string): boolean {
    try {
        return (Inventory.get(player)?.items ?? []).some((row) => row.name === item);
    } catch {
        return false;
    }
}

/**
 * Gives the starter pack: working clothes, worn, some coin, a hunting sword and a dagger, food for a few hours, a torch
 * and a set of dice for the tavern tables. Safe to call as often as is convenient; each part is given once. It waits for a
 * saved look, so a newcomer is dressed after the creator, for their own gender.
 */
export function ensureStarter(player: Player): void {
    if (!canKeep(player) || !getCharacter(player.steamId)) {
        return;
    }

    // "starter:money" is what the first version wrote, for 100 of the item; "starter:money:v2" is the right amount.
    // A character already paid the first is only owed the difference.
    if (!hasKit(player, "starter:money:v2")) {
        const paid = hasKit(player, "starter:money");
        const owed = paid ? STARTER_MONEY - FIRST_STARTER_MONEY : STARTER_MONEY;
        if (player.giveItem("money", owed)) {
            markKit(player, "starter:money:v2");
            if (paid) {
                say(player, `O dinheiro inicial foi acertado: você recebeu mais ${owed / MONEY_UNIT} moedas, para somar as ${STARTER_MONEY / MONEY_UNIT} do começo.`);
            }
        }
    }

    if (!hasKit(player, "starter:dice")) {
        const result = Inventory.add(player, { item: STARTER_DICE.item, amount: STARTER_DICE.amount });
        if (result.ok) {
            markKit(player, "starter:dice");
            say(player, `Você recebeu ${STARTER_DICE.amount} dados comuns para jogar nas mesas das tavernas (/dice <jogador>).`);
        } else {
            console.log(`kits: ${player.nickname}: os dados não foram entregues (${result.code}); tento de novo na próxima entrada`);
        }
    }

    // One ledger entry per weapon. A character from the time of the draw ("starter:weapon") who still carries the one
    // it got is not given a second; the other comes now.
    const armed: string[] = [];
    for (const weapon of STARTER_WEAPONS) {
        const ledger = `starter:weapon:${weapon.item}`;
        if (hasKit(player, ledger)) {
            continue;
        }
        if (hasKit(player, "starter:weapon") && holds(player, weapon.item)) {
            markKit(player, ledger);
            continue;
        }
        const result = Inventory.add(player, { item: weapon.item, amount: 1 });
        if (result.ok) {
            markKit(player, ledger);
            armed.push(weapon.label);
        } else {
            console.log(`kits: ${player.nickname}: ${weapon.item} não foi entregue (${result.code}); tento de novo na próxima entrada`);
        }
    }
    if (armed.length > 0) {
        say(player, `Você recebeu ${armed.join(" e ")} para não lutar de mãos nuas. Equipe pelo inventário.`);
    }

    if (!hasKit(player, "starter:food")) {
        const missed = STARTER_FOOD.filter((food) => !Inventory.add(player, { item: food.item, amount: food.amount }).ok);
        if (missed.length < STARTER_FOOD.length) {
            // Marked even if one kind was refused: a second run would hand the rest out twice.
            markKit(player, "starter:food");
            say(player, `Você recebeu comida que não estraga, para umas cinco horas: ${STARTER_FOOD.filter((food) => !missed.includes(food)).map((food) => `${food.amount} ${food.label}`).join(", ")}.`);
        }
        for (const food of missed) {
            console.log(`kits: ${player.nickname}: ${food.item} não foi entregue`);
        }
    }

    if (!hasKit(player, "starter:torch")) {
        const result = Inventory.add(player, { item: STARTER_TORCH.item, amount: STARTER_TORCH.amount });
        if (result.ok) {
            markKit(player, "starter:torch");
            say(player, "Você recebeu uma tocha para as noites. Equipe pelo inventário.");
        } else {
            console.log(`kits: ${player.nickname}: a tocha não foi entregue (${result.code}); tento de novo na próxima entrada`);
        }
    }

    if (!hasKit(player, "starter:outfit")) {
        const preset = outfitFor(player);
        if (preset === null) {
            console.log(`kits: ${player.nickname}: o jogo não ofereceu nenhuma roupa simples para vestir`);
        } else if (player.setOutfit(preset)) {
            markKit(player, "starter:outfit");
            retries.delete(player.id);
            say(player, "Você recebeu roupas simples de trabalho e algumas moedas para começar.");
        } else {
            console.log(`kits: ${player.nickname}: o jogo recusou a roupa ${preset}; tento de novo em instantes`);
            retryLater(player);
        }
    }
}

/** The creator dressed the newcomer in the clothes they chose (`creator.ts`, the "Roupas" tab): the starter outfit is not put over them. */
export function markStarterOutfit(player: Player): void {
    markKit(player, "starter:outfit");
}

/**
 * What a guild's kit is for, said right after "Kit da guilda entregue" (user, 2026-10-22: the message said the Coletores' work was done with
 * the left click; it is the E at a tree or a rock). Empty for a guild whose kit needs no word.
 */
export const GUILD_KIT_HINTS: Readonly<Record<string, string>> = {
    collectores: "Para cortar lenha ou minerar: com o machado ou a picareta na bolsa, olhe para uma árvore ou uma pedra e aperte E. Aperte E de novo, ou ande, para parar.",
    domitores: "Para domar: ande devagar até um cavalo selvagem dos campos abertos, olhe para ele e aperte E; ofereça comida (cenoura, maçã, pera, beterraba, nabo ou pão) até ele confiar em você. O cavalo foge de quem corre.",
    agricolae: "Para plantar: com a pá e as sementes na bolsa, olhe para o chão de um canteiro de horta, atrás das casas das aldeias, e aperte E; a página à direita diz o que cada planta pede e em quanto tempo dá. Quando ficar pronta, E de novo no canteiro colhe. /horta mostra o que você plantou.",
};

export function guildKitHint(guildId: string): string {
    return GUILD_KIT_HINTS[guildId] ?? "";
}

/** The kit of a guild the player has just joined. Returns what was handed over now, for the message. */
export function grantGuildKit(player: Player, guildId: string): string[] {
    const kit = GUILD_KITS[guildId];
    if (kit === undefined) {
        return [];
    }
    if (!canKeep(player)) {
        say(player, "Seu personagem não está sendo salvo, então o kit da guilda não pôde ser entregue.");
        return [];
    }

    const handed: string[] = [];
    const body = genderOf(player);
    kit.forEach((entry, index) => {
        const ledger = `guild:${guildId}:${index}`;
        if (hasKit(player, ledger) || (entry.gender !== undefined && entry.gender !== body)) {
            return;
        }
        const book = BOOKS_BY_ID.get(entry.item);
        // A recipe book, or one of our own items (the seeds), has a GUID of its own once registered; a game item goes by its name.
        const item = book !== undefined ? bookGuid(entry.item) : (craftItemGuid(entry.item) ?? entry.item);
        if (item === null) {
            console.log(`kits: ${player.nickname}: o livro ${entry.item} não está registrado`);
            return;
        }
        const result = Inventory.add(player, entry.metadata === undefined ? { item, amount: entry.amount } : { item, amount: entry.amount, metadata: entry.metadata });
        if (!result.ok) {
            console.log(`kits: ${player.nickname}: ${entry.item} não foi entregue (${result.code})`);
            return;
        }
        markKit(player, ledger);
        const name = book?.title ?? entry.label;
        handed.push(entry.amount > 1 ? `${entry.amount} ${name}` : name);
    });
    return handed;
}

/**
 * The colours of a house the player has just sworn to, cut for their body, into the inventory (putting them on is the
 * player's choice). Once per house and piece: swearing again, or back and forth between the houses, brings nothing new,
 * and the ledger is kept by piece rather than item, so a body changed later does not earn the other cut as well.
 * Returns what was handed over now, for the message.
 */
export function grantFactionColours(player: Player, factionId: string): string[] {
    const colours = FACTION_COLOURS[factionId];
    if (colours === undefined) {
        return [];
    }
    if (!canKeep(player)) {
        say(player, "Seu personagem não está sendo salvo, então as cores da facção não puderam ser entregues.");
        return [];
    }

    const handed: string[] = [];
    for (const entry of colours[genderOf(player)]) {
        const ledger = `faction:${factionId}:${entry.piece}`;
        if (hasKit(player, ledger)) {
            continue;
        }
        const result = Inventory.add(player, { item: entry.item, amount: entry.amount });
        if (!result.ok) {
            console.log(`kits: ${player.nickname}: ${entry.item} não foi entregue (${result.code})`);
            continue;
        }
        markKit(player, ledger);
        handed.push(entry.label);
    }
    return handed;
}
