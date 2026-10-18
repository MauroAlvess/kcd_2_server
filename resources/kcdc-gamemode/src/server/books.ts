/**
 * Recipe books: custom items that teach a trade when they are read.
 *
 * The game's own `recipe_*` documents (sketches for the smithy, recipes for the alchemy table) teach through the
 * client's own recipe book, which this server cannot see or keep. These books go through the server instead: reading
 * one (the item's "Ler" action) raises `playerCustomItemUse`, and the recipes are given with the two calls the
 * framework offers for it -- `Crafting.setKnowledge` for alchemy, `player.addPerk` for the perk that unlocks a smithing
 * recipe -- which `character-state.ts` then keeps across sessions.
 *
 * A book is spent only if it teaches something: one whose recipes are all known already stays in the bag, and a
 * book is given back if nothing could be taught after it was taken.
 */

const FULL_RECIPE = 536870911;

export type Trade = "smithing" | "alchemy";

export interface Recipe {
    /** A smithing recipe id (`r_axework01`) or an alchemy recipe number. */
    readonly id: string | number;
    /** What the player reads in the notice. */
    readonly label: string;
}

export interface BookDef {
    readonly id: string;
    readonly trade: Trade;
    readonly title: string;
    readonly price: number;
    readonly recipes: readonly Recipe[];
}

const SMITH_VISUAL = "recipe_axework01";
const ALCHEMY_VISUAL = "recipe_healthSmallPotion";

const smith = (id: string, label: string): Recipe => ({ id, label });
const brew = (id: number, label: string): Recipe => ({ id, label });

/** Every book the server knows. The first of each trade are what the guild kits hand out; the rest are sold. */
export const BOOKS: readonly BookDef[] = [
    // ---- Ferreiro: o que o kit entrega -----------------------------------------------------------
    {
        id: "kcdc:book:ferreiro-ferramentas",
        trade: "smithing",
        title: "Manual do Ferreiro I: Ferramentas",
        price: 600,
        recipes: [smith("r_axework01", "Machado de trabalho"), smith("r_axework02", "Machado de carpinteiro"), smith("r_horseshoe", "Ferraduras de fazenda")],
    },
    {
        id: "kcdc:book:ferreiro-aprendiz",
        trade: "smithing",
        title: "Manual do Ferreiro II: Lâminas de Aprendiz",
        price: 800,
        recipes: [smith("r_kovarTrainingSword", "Espada de caça de treino"), smith("r_huntingSwordBasic", "Espada de caça")],
    },
    // ---- Ferreiro: o que o ferreiro do mercado vende ---------------------------------------------
    {
        id: "kcdc:book:ferreiro-machados",
        trade: "smithing",
        title: "Manual do Ferreiro III: Machados de Guerra",
        price: 1800,
        recipes: [smith("r_axebattle01", "Machado de batalha"), smith("r_axebattle02", "Machado barbudo"), smith("r_axebattle03", "Machado de montaria"), smith("r_axecuman", "Fokosh cumano")],
    },
    {
        id: "kcdc:book:ferreiro-ferraduras",
        trade: "smithing",
        title: "Manual do Ferreiro IV: Ferraduras",
        price: 1500,
        recipes: [smith("r_horseshoeMilitary", "Ferraduras de cavaleiro"), smith("r_horseshoeNoble", "Ferraduras de nobre"), smith("r_horseshoeNomad", "Ferraduras ivarianas"), smith("r_horseshoeRacing", "Ferraduras de corrida")],
    },
    {
        id: "kcdc:book:ferreiro-cacadores",
        trade: "smithing",
        title: "Manual do Ferreiro V: Espadas de Caça",
        price: 2400,
        recipes: [smith("r_huntingswordfalchion", "Falchion"), smith("r_huntingswordsashka", "Shashka cumana"), smith("r_huntingswordsword", "Espada de caça do nobre"), smith("r_huntingswordmussle", "Espada de caça com concha")],
    },
    {
        id: "kcdc:book:ferreiro-curtas",
        trade: "smithing",
        title: "Manual do Ferreiro VI: Espadas Curtas",
        price: 3200,
        recipes: [
            smith("r_shortswordcleaver", "Lâmina caseira"),
            smith("r_shortswordbasilard", "Basilard"),
            smith("r_shortswordcommon", "Espada militar"),
            smith("r_shortswordbroad", "Espada larga"),
            smith("r_shortswordheavy", "Espada de cavaleiro"),
            smith("r_shortswordceremony", "Espada nobre"),
        ],
    },
    {
        id: "kcdc:book:ferreiro-sabres",
        trade: "smithing",
        title: "Manual do Ferreiro VII: Sabres",
        price: 3000,
        recipes: [smith("r_sabrecommon", "Sabre comum"), smith("r_sabrenoble", "Sabre nobre")],
    },
    {
        id: "kcdc:book:ferreiro-longas",
        trade: "smithing",
        title: "Manual do Ferreiro VIII: Espadas Longas",
        price: 4500,
        recipes: [
            smith("r_longswordcommon", "Espada longa comum"),
            smith("r_longswordold", "Espada longa de cavaleiro"),
            smith("r_longswordsturdy", "Espada longa de batalha"),
            smith("r_longswordbroad", "Espada longa larga"),
            smith("r_longswordduel", "Espada longa de duelo"),
        ],
    },
    // ---- Ferreiro: o resto do que o jogo tem (2026-10-17), de machados de cavaleiro às lâminas raras --------
    {
        id: "kcdc:book:ferreiro-nobres",
        trade: "smithing",
        title: "Manual do Ferreiro IX: Machados de Cavaleiro",
        price: 3600,
        recipes: [smith("r_axebattle04", "Machado de cavaleiro"), smith("r_axefancy", "Machado de carrasco")],
    },
    {
        id: "kcdc:book:ferreiro-raras",
        trade: "smithing",
        title: "Manual do Ferreiro X: Lâminas Raras",
        price: 7500,
        recipes: [smith("r_sabreLionHead", "Kilij Rugido do Leão"), smith("r_shortSwordStGeorge", "Espada de São Jorge"), smith("r_longSwordLilium", "Espada longa Lingua Belli"), smith("r_polearmBruncvik", "Alabarda de Brunswick")],
    },
    // ---- Alquimista: o que o kit entrega ----------------------------------------------------------
    {
        id: "kcdc:book:alquimia-aprendiz",
        trade: "alchemy",
        title: "Herbário do Aprendiz",
        price: 900,
        recipes: [brew(14, "Decocção de calêndula"), brew(3, "Poção digestiva"), brew(30, "Aqua Vitalis")],
    },
    // ---- Alquimista: o que o boticário vende -------------------------------------------------------
    {
        id: "kcdc:book:alquimia-tonicos",
        trade: "alchemy",
        title: "Receituário de Tônicos",
        price: 1400,
        recipes: [brew(49, "Decocção de camomila"), brew(50, "Infusão analgésica"), brew(1, "Pelo do Cão"), brew(16, "Aguardente")],
    },
    {
        id: "kcdc:book:alquimia-vigor",
        trade: "alchemy",
        title: "Receituário de Vigor",
        price: 1800,
        recipes: [brew(27, "Sangue de Cervo"), brew(12, "Galo"), brew(21, "Gavião Noturno"), brew(26, "Dedos Ágeis")],
    },
    {
        id: "kcdc:book:alquimia-cacador",
        trade: "alchemy",
        title: "Receituário do Caçador",
        price: 1600,
        recipes: [brew(4, "Poção do arqueiro"), brew(2, "Artemísia"), brew(18, "Embrocação")],
    },
    {
        id: "kcdc:book:alquimia-medicina",
        trade: "alchemy",
        title: "Receituário de Medicina",
        price: 2600,
        recipes: [brew(13, "Aguardente Salvadora"), brew(51, "Tônico para febre"), brew(59, "Decocção de São Roque"), brew(60, "Poção anti-inflamatória")],
    },
    {
        id: "kcdc:book:alquimia-perfumaria",
        trade: "alchemy",
        title: "Receituário de Perfumaria",
        price: 2000,
        recipes: [brew(52, "Perfume Leão"), brew(53, "Perfume Mintha"), brew(56, "Sabão"), brew(58, "Óleo essencial")],
    },
    // ---- Alquimista: o que mais o jogo tem (2026-10-17), sem repetir nenhuma receita de outro livro --------
    {
        id: "kcdc:book:alquimia-astucia",
        trade: "alchemy",
        title: "Receituário de Astúcia",
        price: 2800,
        recipes: [brew(6, "Raposa"), brew(17, "Esopo"), brew(57, "Decocção de mandrágora")],
    },
    {
        id: "kcdc:book:alquimia-polvora",
        trade: "alchemy",
        title: "Receituário de Pólvora",
        price: 3400,
        recipes: [brew(54, "Pólvora de bala de chumbo"), brew(55, "Pólvora de chumbo grosso")],
    },
    {
        id: "kcdc:book:alquimia-venenos",
        trade: "alchemy",
        title: "Receituário Proibido",
        price: 3600,
        recipes: [brew(5, "Veneno Praga"), brew(22, "Veneno do Bonequeiro"), brew(25, "Veneno Canção de Ninar")],
    },
];

export const BOOKS_BY_ID: ReadonlyMap<string, BookDef> = new Map(BOOKS.map((book) => [book.id, book]));

/** The class GUID each registered book answers to, as `Inventory.add` and `Vendor.setStock` take it. */
const guids = new Map<string, string>();

export function bookGuid(id: string): string | null {
    return guids.get(id) ?? null;
}

function describe(book: BookDef): string {
    return `Ensina ${book.trade === "smithing" ? "a forjar" : "a preparar"}: ${book.recipes.map((recipe) => recipe.label).join(", ")}.`;
}

/** Registers every book type. Must run before a saved inventory is restored: it may hold books. */
export function registerBooks(): void {
    for (const book of BOOKS) {
        const guid = Items.register(book.id, {
            name: book.title,
            description: describe(book),
            visual: book.trade === "smithing" ? SMITH_VISUAL : ALCHEMY_VISUAL,
            weight: 0.3,
            price: book.price,
            stackable: true,
            usable: true,
            useLabel: "Ler",
        });
        guids.set(book.id, guid);
    }
}

// ---------------------------------------------------------------------------------------------

interface Lesson {
    readonly recipe: Recipe;
    readonly known: boolean;
    /** Teaches it. Throws if the framework refuses. */
    teach(): void;
}

function smithingLessons(player: Player, book: BookDef): Lesson[] {
    const catalog = Crafting.recipes(player, "smithing");
    return book.recipes.map((recipe): Lesson => {
        const entry = catalog.find((candidate) => candidate.key.kind === "smithing" && candidate.key.id === recipe.id);
        const perk = entry?.perk ?? "";
        return {
            recipe,
            known: perk === "" ? false : player.hasPerk(perk),
            teach: () => {
                if (perk === "") {
                    throw new Error(`a receita ${String(recipe.id)} não existe neste servidor`);
                }
                if (!player.addPerk(perk)) {
                    throw new Error(`o jogo recusou a receita ${String(recipe.id)}`);
                }
            },
        };
    });
}

function alchemyLessons(player: Player, book: BookDef): Lesson[] {
    const knowledge = Crafting.knowledge(player);
    return book.recipes.map((recipe): Lesson => ({
        recipe,
        known: knowledge[String(recipe.id)] === FULL_RECIPE,
        teach: () => {
            if (!Crafting.setKnowledge(player, recipe.id, FULL_RECIPE)) {
                throw new Error(`o jogo recusou a receita ${String(recipe.id)}`);
            }
        },
    }));
}

/** Reads a book: takes it from the bag, teaches what is new, and says what happened. */
function read(player: Player, row: InventoryRow, revision: number, book: BookDef): void {
    const lessons = book.trade === "smithing" ? smithingLessons(player, book) : alchemyLessons(player, book);
    const fresh = lessons.filter((lesson) => !lesson.known);
    if (fresh.length === 0) {
        Chat.sendToPlayer(player, `Você já conhece tudo o que “${book.title}” ensina. O livro continua com você.`);
        return;
    }

    const taken = Inventory.remove(player, { units: [{ id: row.id, amount: 1 }], revision, notify: false });
    if (!taken.ok) {
        Chat.sendToPlayer(player, "Não consegui abrir o livro agora. Tente de novo.");
        return;
    }

    const learned: string[] = [];
    for (const lesson of fresh) {
        try {
            lesson.teach();
            learned.push(lesson.recipe.label);
        } catch (error: unknown) {
            console.log(`books: ${player.nickname} leu ${book.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (learned.length === 0) {
        // Nothing could be taught after the book was taken: give it back rather than keep the loss.
        Inventory.add(player, { item: row.item, amount: 1, metadata: row.metadata, notify: false });
        Chat.sendToPlayer(player, "O livro não pôde ser lido agora e foi devolvido. Avise a administração.");
        return;
    }
    Chat.sendToPlayer(player, `Você estudou “${book.title}” e aprendeu: ${learned.join(", ")}.`);
}

export function installBooks(): void {
    Events.on("playerCustomItemUse", (player, row, revision) => {
        const book = BOOKS_BY_ID.get(row.name);
        if (book !== undefined) {
            read(player, row, revision, book);
        }
    });
    console.log(`books: ${BOOKS.length} livros de receita registrados`);
}
