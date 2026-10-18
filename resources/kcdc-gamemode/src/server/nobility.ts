/**
 * The realm's hierarchy: every title a player can hold, who may name whom, and the rules that keep the two ladders
 * (blood and office) and the social status from contradicting one another. Pure data and decisions: nothing here reads
 * a player or the disk (`titles.ts` keeps who holds what, `nominations.ts` carries the panel's events).
 *
 * Three kinds of title, because "Cavaleiro" and "Burgomestre" are not the same sort of thing:
 *
 * - **blood** (`kind: "blood"`): a noble rank, from the Rei down to the escudeiro. Holding one makes a player a noble,
 *   so naming a commoner to one raises them, and with them their spouse and their legitimate line (`family.ts`, the
 *   same rule as an administrator's). A player holds one at a time: a new rank takes the place of the old.
 * - **lordly** (`kind: "lordly"`): the high clergy -- arcebispo, bispo, abade, prior. The Church is its own ladder and
 *   its prelates name the clergy below them; they are nobles by their office, as in the history, so these raise too.
 * - **office** (`kind: "office"`): a post, political, administrative, military, of a town or of the Church. A commoner
 *   may hold it; it raises nobody.
 *
 * Who may name whom is written out for each title that can name anyone (`appoints`), always downward: a rank names only
 * ranks below it, never its own and never one above. The Rei is named by an administrator alone (nobody's list has
 * "rei"), and only one player holds it at a time. The Church has its own ladder, as the history has it: a bishop names
 * priests and monks, a lord does not.
 *
 * The social status (plebeius, nobilis) is never a title and never shown over a head: only a title the player chose to
 * wear is (`titles.ts`).
 */

export type Branch = "crown" | "great" | "lesser" | "church" | "town";
export type Kind = "blood" | "lordly" | "office";

export interface TitleDef {
    readonly id: string;
    /** As a man is called, and as a woman is. */
    readonly male: string;
    readonly female: string;
    /** The word the Bohemia of the time had for it, when it helps ("pán", "rytíř"). */
    readonly native?: string;
    /** One line on what it is, for the dossier and the site. */
    readonly gloss: string;
    readonly branch: Branch;
    /** Within its branch, 1 is the highest. Only compared inside a branch. */
    readonly tier: number;
    readonly kind: Kind;
    /** Held by one player at a time: naming a second takes it from the first. */
    readonly unique?: boolean;
    /** The ids of the titles this one may name. Empty or missing: it names nobody. */
    readonly appoints?: readonly string[];
}

export interface BranchInfo {
    readonly id: Branch;
    readonly label: string;
    readonly note: string;
}

/** The structure the players read, top to bottom; the commoners ("população comum") are the rest of the server. */
export const BRANCHES: readonly BranchInfo[] = [
    { id: "crown", label: "Coroa da Boêmia", note: "Rei e autoridade régia" },
    { id: "great", label: "Grandes senhores e alta nobreza", note: "Príncipes, marqueses e lordes" },
    { id: "lesser", label: "Nobreza inferior e oficiais", note: "Cavaleiros, pequenos nobres, burgraves e capitães" },
    { id: "church", label: "Igreja", note: "Bispos, abades, padres e monges" },
    { id: "town", label: "Cidades e guildas", note: "Burgomestres, conselheiros e mestres de guilda" },
];

const NOBILITY_BELOW_LORD = ["cavaleiro", "escudeiro", "pequeno-nobre"] as const;
/** The posts of a lordship: named by the lords above. */
const LORDSHIP_OFFICES = ["burgrave", "hetman", "capitao-guarda", "chanceler", "juiz-senhorial", "mordomo", "tesoureiro", "bailio", "meirinho", "arauto"] as const;
/** The posts of the towns and the guilds. */
const TOWN_OFFICES = ["burgomestre", "conselheiro", "alcaide", "mestre-guilda", "chefe-mercado", "coletor-pedagios", "guarda-portoes", "capitao-milicia", "escrivao", "mestre-oficio", "administrador-hospedaria"] as const;
const LOWER_CLERGY = ["padre", "monge", "frade", "diacono", "acolito"] as const;

export const TITLES: readonly TitleDef[] = [
    // The Crown.
    {
        id: "rei", male: "Rei", female: "Rainha", native: "král", branch: "crown", tier: 1, kind: "blood", unique: true,
        gloss: "Soberano do reino: concede privilégios, confirma direitos e arbitra conflitos entre os grandes senhores.",
        appoints: ["principe", "marques", "lorde", ...NOBILITY_BELOW_LORD, ...LORDSHIP_OFFICES, ...TOWN_OFFICES],
    },
    // The great lords.
    {
        id: "principe", male: "Príncipe", female: "Princesa", branch: "great", tier: 1, kind: "blood",
        gloss: "Grande senhor territorial: governa um território de alto status.",
        appoints: ["lorde", ...NOBILITY_BELOW_LORD, ...LORDSHIP_OFFICES, ...TOWN_OFFICES],
    },
    {
        id: "marques", male: "Marquês", female: "Marquesa", native: "markrabě, margrave", branch: "great", tier: 1, kind: "blood",
        gloss: "Senhor de uma marca, um território de fronteira; o título é ligado sobretudo à Morávia, nas terras da Coroa da Boêmia.",
        appoints: ["lorde", ...NOBILITY_BELOW_LORD, ...LORDSHIP_OFFICES, ...TOWN_OFFICES],
    },
    {
        id: "lorde", male: "Lorde", female: "Lady", native: "pán", branch: "great", tier: 2, kind: "blood",
        gloss: "Alta nobreza: controla domínios, castelos, rendas e homens armados. Na Boêmia do século XV, pán era a designação da alta nobreza.",
        appoints: [...NOBILITY_BELOW_LORD, ...LORDSHIP_OFFICES, ...TOWN_OFFICES],
    },
    // The lesser nobility.
    {
        id: "cavaleiro", male: "Cavaleiro", female: "Cavaleira", native: "rytíř", branch: "lesser", tier: 1, kind: "blood",
        gloss: "Nobreza inferior ou posição militar honorífica: guerreiro reconhecido pelo serviço, que pode ter terras, comandar homens ou servir a um senhor. Nem todo cavaleiro é rico.",
        appoints: ["escudeiro", "pequeno-nobre"],
    },
    {
        id: "escudeiro", male: "Escudeiro", female: "Escudeira", branch: "lesser", tier: 2, kind: "blood",
        gloss: "Pequena nobreza: pode possuir uma propriedade modesta, servir militarmente e buscar o reconhecimento de uma casa maior.",
    },
    {
        id: "pequeno-nobre", male: "Pequeno nobre", female: "Pequena nobre", native: "zeman, vladyka", branch: "lesser", tier: 2, kind: "blood",
        gloss: "Pequena nobreza rural: terra modesta e serviço militar a um senhor.",
    },
    // The posts of a lordship.
    { id: "burgrave", male: "Burgrave", female: "Burgrave", native: "purkrabí", branch: "lesser", tier: 3, kind: "office", gloss: "Administra um castelo, uma fortaleza ou um domínio em nome de uma autoridade superior." },
    { id: "hetman", male: "Hetman", female: "Hetman", native: "hejtman", branch: "lesser", tier: 3, kind: "office", gloss: "Comanda forças militares ou exerce funções de administração territorial, conforme o contexto." },
    { id: "capitao-guarda", male: "Capitão da guarda", female: "Capitã da guarda", branch: "lesser", tier: 4, kind: "office", gloss: "Comanda os guardas de um castelo ou de uma residência nobre." },
    { id: "chanceler", male: "Chanceler", female: "Chanceler", branch: "lesser", tier: 4, kind: "office", gloss: "Cuida de documentos oficiais, cartas, selos e registros." },
    { id: "juiz-senhorial", male: "Juiz senhorial", female: "Juíza senhorial", branch: "lesser", tier: 4, kind: "office", gloss: "Julga disputas e infrações dentro da jurisdição do senhor." },
    { id: "mordomo", male: "Mordomo", female: "Mordoma", branch: "lesser", tier: 4, kind: "office", gloss: "Organiza a casa nobre, os criados, os suprimentos e as despesas." },
    { id: "tesoureiro", male: "Tesoureiro", female: "Tesoureira", branch: "lesser", tier: 4, kind: "office", gloss: "Controla tributos, aluguéis, dívidas e pagamentos; é o coletor de rendas." },
    { id: "bailio", male: "Bailio", female: "Bailia", branch: "lesser", tier: 5, kind: "office", gloss: "Oficial de justiça: executa ordens, fiscaliza obrigações e auxilia na administração da justiça." },
    { id: "meirinho", male: "Meirinho", female: "Meirinha", branch: "lesser", tier: 5, kind: "office", gloss: "Administrador senhorial: supervisiona terras, trabalhadores, rendas e deveres dos habitantes." },
    { id: "arauto", male: "Arauto", female: "Arauta", branch: "lesser", tier: 5, kind: "office", gloss: "Anuncia decretos, transmite mensagens e participa de cerimônias." },
    // The Church, with a ladder of its own.
    {
        id: "arcebispo", male: "Arcebispo", female: "Arcebispa", branch: "church", tier: 1, kind: "lordly",
        gloss: "Autoridade eclesiástica de alto nível, responsável por uma província religiosa. Praga era uma arquidiocese.",
        appoints: ["bispo", "abade", "prior", ...LOWER_CLERGY],
    },
    {
        id: "bispo", male: "Bispo", female: "Bispa", branch: "church", tier: 2, kind: "lordly",
        gloss: "Governa uma diocese e supervisiona o clero sob a sua jurisdição.",
        appoints: ["abade", "prior", ...LOWER_CLERGY],
    },
    {
        id: "abade", male: "Abade", female: "Abadessa", branch: "church", tier: 3, kind: "lordly",
        gloss: "Lidera um mosteiro ou uma comunidade religiosa e pode administrar propriedades e rendas significativas.",
        appoints: ["monge", "frade", "acolito"],
    },
    {
        id: "prior", male: "Prior", female: "Priora", branch: "church", tier: 3, kind: "lordly",
        gloss: "Lidera um priorado ou ajuda o abade; pode administrar propriedades e rendas.",
        appoints: ["monge", "frade", "acolito"],
    },
    { id: "padre", male: "Padre", female: "Padre", branch: "church", tier: 4, kind: "office", gloss: "Pároco: celebra missas, administra sacramentos, aconselha os habitantes e participa da vida comunitária." },
    { id: "monge", male: "Monge", female: "Monja", branch: "church", tier: 5, kind: "office", gloss: "Vive e serve em um mosteiro. Um monge não é necessariamente sacerdote." },
    { id: "frade", male: "Frade", female: "Freira", branch: "church", tier: 5, kind: "office", gloss: "Religioso de uma ordem que serve entre o povo. Não tem a autoridade de um padre." },
    { id: "diacono", male: "Diácono", female: "Diaconisa", branch: "church", tier: 5, kind: "office", gloss: "Auxilia o padre nas funções religiosas, sem a autoridade dele." },
    { id: "acolito", male: "Acólito", female: "Acólita", branch: "church", tier: 6, kind: "office", gloss: "Serve ao altar e auxilia o clero nas cerimônias." },
    // The towns and the guilds.
    { id: "burgomestre", male: "Burgomestre", female: "Burgomestre", branch: "town", tier: 1, kind: "office", gloss: "Prefeito: administra a cidade, coordena decisões municipais e representa seus interesses perante a nobreza." },
    { id: "conselheiro", male: "Conselheiro municipal", female: "Conselheira municipal", branch: "town", tier: 2, kind: "office", gloss: "Participa das decisões sobre impostos, mercados, manutenção urbana e leis locais." },
    { id: "alcaide", male: "Alcaide da aldeia", female: "Alcaide da aldeia", branch: "town", tier: 2, kind: "office", gloss: "Representante da aldeia: recolhe informações, comunica ordens, organiza as obrigações da comunidade e serve de intermediário com o senhor local." },
    { id: "mestre-guilda", male: "Mestre de guilda", female: "Mestra de guilda", branch: "town", tier: 2, kind: "office", gloss: "Lidera uma corporação profissional, fiscaliza a qualidade dos produtos e negocia privilégios para seus membros." },
    { id: "chefe-mercado", male: "Chefe de mercado", female: "Chefe de mercado", branch: "town", tier: 3, kind: "office", gloss: "Cuida da ordem, dos lugares e das medidas na praça do mercado." },
    { id: "coletor-pedagios", male: "Coletor de pedágios", female: "Coletora de pedágios", branch: "town", tier: 3, kind: "office", gloss: "Cobra a passagem em pontes, portões e estradas." },
    { id: "guarda-portoes", male: "Guarda dos portões", female: "Guarda dos portões", branch: "town", tier: 3, kind: "office", gloss: "Vigia as entradas da cidade e controla quem passa." },
    { id: "capitao-milicia", male: "Capitão da milícia urbana", female: "Capitã da milícia urbana", branch: "town", tier: 3, kind: "office", gloss: "Comanda os cidadãos armados que defendem a cidade." },
    { id: "escrivao", male: "Escrivão", female: "Escrivã", branch: "town", tier: 3, kind: "office", gloss: "Escreve e guarda os registros, as cartas e as contas." },
    { id: "mestre-oficio", male: "Mestre de ofício", female: "Mestra de ofício", branch: "town", tier: 3, kind: "office", gloss: "Mestre reconhecido de um ofício, que ensina aprendizes e responde pela qualidade do trabalho." },
    { id: "administrador-hospedaria", male: "Administrador de hospedaria", female: "Administradora de hospedaria", branch: "town", tier: 3, kind: "office", gloss: "Tem a seu cargo uma hospedaria: os quartos, a cozinha e os criados." },
];

const BY_ID = new Map<string, TitleDef>(TITLES.map((title) => [title.id, title]));

/** A player holds no more than this many titles at once, a rank included. */
export const MAX_TITLES = 6;

/** Whether holding the title makes a player a noble: the ranks of the blood and the high Church. */
export function raises(title: TitleDef): boolean {
    return title.kind === "blood" || title.kind === "lordly";
}

export function titleById(id: unknown): TitleDef | null {
    return typeof id === "string" ? (BY_ID.get(id) ?? null) : null;
}

/** The title as it is written for this body: a woman's form where the language has one. */
export function labelOf(title: TitleDef, female: boolean): string {
    return female ? title.female : title.male;
}

/** The ids of a list that are titles of the catalog, with the ones it does not know dropped. */
export function known(ids: readonly string[]): TitleDef[] {
    const found: TitleDef[] = [];
    for (const id of ids) {
        const title = BY_ID.get(id);
        if (title !== undefined && !found.includes(title)) {
            found.push(title);
        }
    }
    return found;
}

/** The blood rank of a set of titles: a position in the ladder from the Rei down, or Infinity for a player with none. */
export function bloodRank(held: readonly string[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (const title of known(held)) {
        if (title.kind === "blood") {
            best = Math.min(best, rankOfBlood(title));
        }
    }
    return best;
}

/** One number for the whole blood ladder: crown first, then the great lords, then the lesser nobility. */
function rankOfBlood(title: TitleDef): number {
    return BRANCHES.findIndex((branch) => branch.id === title.branch) * 10 + title.tier;
}

/** The blood title a player holds, if any (they hold one at a time). */
export function bloodTitleOf(held: readonly string[]): TitleDef | null {
    return known(held).find((title) => title.kind === "blood") ?? null;
}

/** Whether a title may be named by whoever holds `held` (an administrator is not asked). */
export function mayNameTitle(held: readonly string[], titleId: string): boolean {
    return appointable(held).some((candidate) => candidate.id === titleId);
}

/** Every title the held ones may name, in the order the hierarchy reads, each once. */
export function appointable(held: readonly string[]): TitleDef[] {
    const ids = new Set<string>();
    for (const title of known(held)) {
        for (const id of title.appoints ?? []) {
            ids.add(id);
        }
    }
    return TITLES.filter((title) => ids.has(title.id));
}

/** Whether any of the held titles lets its holder name anybody. */
export function hasNominationPower(held: readonly string[]): boolean {
    return known(held).some((title) => (title.appoints ?? []).length > 0);
}

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const yes: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

export interface NominationCase {
    /** Who names: an administrator may name anybody to anything. */
    readonly actorIsAdmin: boolean;
    readonly actorIsNoble: boolean;
    readonly actorHeld: readonly string[];
    /** The same player as the one named. */
    readonly sameActor: boolean;
    readonly titleId: string;
    readonly nomineeHeld: readonly string[];
}

/** Whether this nomination may be made. The reasons are written for the player to read. */
export function judgeNomination(input: NominationCase): Verdict {
    const title = titleById(input.titleId);
    if (title === null) {
        return no("Esse título não existe.");
    }
    if (input.sameActor && !input.actorIsAdmin) {
        return no("Ninguém se nomeia a si mesmo.");
    }
    if (!input.actorIsAdmin) {
        if (!input.actorIsNoble) {
            return no("Só um nobre pode nomear.");
        }
        if (!hasNominationPower(input.actorHeld)) {
            return no("Você ainda não recebeu um título de nomeação.");
        }
        if (!appointable(input.actorHeld).some((candidate) => candidate.id === title.id)) {
            return no(`Os seus títulos não dão o direito de nomear ${title.male}: só se nomeia para um título abaixo do seu.`);
        }
    }
    const nomineeHeld = known(input.nomineeHeld);
    if (nomineeHeld.some((held) => held.id === title.id)) {
        return no(`Já é ${labelOf(title, false)}.`);
    }
    if (title.kind === "blood") {
        const current = bloodTitleOf(input.nomineeHeld);
        // Nobody changes the rank of somebody at their own level or above: the one named must stand below the one who names.
        if (current !== null && !input.actorIsAdmin && rankOfBlood(current) <= bloodRank(input.actorHeld)) {
            return no(`${labelOf(current, false)} está no seu nível ou acima: o título dele não é seu para mudar.`);
        }
    }
    if (nomineeHeld.length >= MAX_TITLES && !(title.kind === "blood" && bloodTitleOf(input.nomineeHeld) !== null)) {
        return no(`Já tem ${MAX_TITLES} títulos, o máximo.`);
    }
    return yes;
}

export interface RevocationCase {
    readonly actorIsAdmin: boolean;
    readonly actorHeld: readonly string[];
    /** The title is the actor's own: giving one up is always allowed. */
    readonly ownTitle: boolean;
    readonly titleId: string;
    readonly holderHeld: readonly string[];
    /** The actor is the one who named them. */
    readonly namedByActor: boolean;
}

/** Whether a title may be taken away from a holder. */
export function judgeRevocation(input: RevocationCase): Verdict {
    const title = titleById(input.titleId);
    if (title === null || !known(input.holderHeld).some((held) => held.id === title.id)) {
        return no("Esse jogador não tem esse título.");
    }
    if (input.ownTitle || input.actorIsAdmin) {
        return yes;
    }
    if (input.namedByActor) {
        return yes;
    }
    if (!appointable(input.actorHeld).some((candidate) => candidate.id === title.id)) {
        return no("Só quem pode nomear para esse título pode retirá-lo.");
    }
    if (title.kind === "blood" && rankOfBlood(title) <= bloodRank(input.actorHeld)) {
        return no("Esse título está no seu nível ou acima.");
    }
    return yes;
}

/** What a player's titles say of them in one line: the highest first, "Lorde · Burgrave". */
export function summarize(held: readonly string[], female: boolean): string {
    const titles = known(held).sort((a, b) => order(a) - order(b));
    return titles.map((title) => labelOf(title, female)).join(" · ");
}

/**
 * How far down the realm's ladder a title stands, the same in every branch (user, 2026-10-17: "Luance está no mesmo nível de um
 * lorde na árvore e isso não é correto"): 1 the King, 2 prince, marquess and archbishop, 3 lord, bishop and burgomaster, 4 knights
 * and squires, the offices of a castle's lord (burgrave, hetman), abbots, priors, parish priests, and the town's councillors and
 * officers, 5 the household and the clergy's lower ranks (captain of the guard, chancellor, judge, steward, treasurer, bailiff,
 * reeve, herald, monk, friar, deacon, acolyte). The tree is drawn by it: a holder stands in the row of their level, under whoever
 * named them.
 */
const LEVELS: Readonly<Record<string, number>> = {
    rei: 1,
    principe: 2,
    marques: 2,
    arcebispo: 2,
    lorde: 3,
    bispo: 3,
    burgomestre: 3,
    "capitao-guarda": 5,
    chanceler: 5,
    "juiz-senhorial": 5,
    mordomo: 5,
    tesoureiro: 5,
    bailio: 5,
    meirinho: 5,
    arauto: 5,
    monge: 5,
    frade: 5,
    diacono: 5,
    acolito: 5,
};

/** The level of a title on the realm's ladder, 1 (the King) to 5; every title not listed above is 4. */
export function levelOf(title: TitleDef): number {
    return LEVELS[title.id] ?? 4;
}

/** The place of a title in the hierarchy's reading order: branch, then tier, then the order of the catalog. */
export function order(title: TitleDef): number {
    const branch = BRANCHES.findIndex((candidate) => candidate.id === title.branch);
    return branch * 1000 + title.tier * 100 + TITLES.indexOf(title);
}
