/**
 * A player's family tree, for the "Família" page of the status panel: who their grandparents,
 * spouse, children and cousins are, by name. It is the character's own account of who they are, not
 * a game system: nothing here changes what the game does, and nobody else can edit it.
 *
 * A person is a relation (one word from RELATIONS, which also says which generation of the tree they
 * sit in) and a name. Cousins also carry a degree. The tree is kept per Steam id on disk so it
 * survives a restart and a reconnect, the same pattern as `characters.ts` and `status.ts`.
 *
 * The tree also gives the character two lines of the Personagem page: the surname the player chose
 * for the family, and the marital status, which is whether the tree has a spouse in it (living: married; marked dead:
 * widowed), or whether somebody else's tree names this player as their spouse.
 *
 * A relative may be marked dead, and may be a player of the server: linked by Steam id, chosen from who is online.
 * The links are what a change of social standing follows (`status.ts`): a player raised to the nobility takes their
 * spouse and their legitimate line with them -- not an adopted child or a bastard, never a sibling or an ancestor.
 *
 * A link has two sides (user, 2026-10-16: "ao adicionar um jogador deve mudar as informações da família dele também"):
 * a player who adds another as a relative also appears in that player's tree, as the relation turned around -- the
 * "Esposa" of one is the "Esposo" of the other, the "Filho" of one has the other as "Pai" or "Mãe" (by the gender of the
 * one who adds), a "Tio" has a "Sobrinho". That entry is the other side's, marked as following the first until the
 * player whose tree it is touches it: changing the relation or the link of the first changes or moves it, removing the
 * first removes it, and once its own player has edited it, none of that reaches it any more. A tree that already has the
 * player in it, or has no room, is left as it is. Links made before the mirror existed are given theirs once, at start.
 *
 * A link is asked for, not imposed (user, 2026-10-16: "ao adicionar um jogador deve chegar na seção família desse jogador
 * para ele aprovar ou recusar"). The relative is in the tree at once, as a name; the link to the other player waits in
 * that player's Família section (`invite`), and only their yes makes it, with its other side, as above. A no leaves the
 * relative a name. Until then nothing follows the link: no heir, no marriage, no mirror.
 */

declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, data: string): void;
    mkdirSync(path: string, options: { recursive: true }): void;
}

const fs = require("node:fs") as NodeFs;

const DIR = "playerdata";
const FILE = `${DIR}/family.json`;

export const LIMITS = { maxPersons: 80, nameMin: 2, nameMax: 40, maxCousinDegree: 4, surnameMax: 30 } as const;

export type RowId = "bisavos" | "avos" | "pais" | "geracao" | "filhos" | "netos" | "bisnetos";

export interface RowInfo {
    readonly id: RowId;
    readonly title: string;
}

/** The tree's generations, top to bottom. The player stands in "geracao". */
export const ROWS: readonly RowInfo[] = [
    { id: "bisavos", title: "Bisavós" },
    { id: "avos", title: "Avós" },
    { id: "pais", title: "Pais e tios" },
    { id: "geracao", title: "Cônjuge, irmãos e primos" },
    { id: "filhos", title: "Filhos e sobrinhos" },
    { id: "netos", title: "Netos" },
    { id: "bisnetos", title: "Bisnetos" },
];

export interface RelationInfo {
    readonly id: string;
    readonly label: string;
    readonly row: RowId;
    /** Cousins only: how distant, 1 being the ordinary cousin. */
    readonly degree?: true;
    /** A woman's relation ("Mãe", "Filha"): the page says "falecida" rather than "falecido". */
    readonly female?: true;
}

export const RELATIONS: readonly RelationInfo[] = [
    { id: "bisavo", label: "Bisavô", row: "bisavos" },
    { id: "bisava", label: "Bisavó", row: "bisavos", female: true },
    { id: "avo", label: "Avô", row: "avos" },
    { id: "ava", label: "Avó", row: "avos", female: true },
    { id: "pai", label: "Pai", row: "pais" },
    { id: "mae", label: "Mãe", row: "pais", female: true },
    { id: "tio", label: "Tio", row: "pais" },
    { id: "tia", label: "Tia", row: "pais", female: true },
    { id: "esposo", label: "Esposo", row: "geracao" },
    { id: "esposa", label: "Esposa", row: "geracao", female: true },
    { id: "irmao", label: "Irmão", row: "geracao" },
    { id: "irma", label: "Irmã", row: "geracao", female: true },
    { id: "primo", label: "Primo", row: "geracao", degree: true },
    { id: "prima", label: "Prima", row: "geracao", degree: true, female: true },
    { id: "filho", label: "Filho", row: "filhos" },
    { id: "filha", label: "Filha", row: "filhos", female: true },
    { id: "filho_adotivo", label: "Filho adotivo", row: "filhos" },
    { id: "filha_adotiva", label: "Filha adotiva", row: "filhos", female: true },
    { id: "filho_bastardo", label: "Filho bastardo", row: "filhos" },
    { id: "filha_bastarda", label: "Filha bastarda", row: "filhos", female: true },
    { id: "sobrinho", label: "Sobrinho", row: "filhos" },
    { id: "sobrinha", label: "Sobrinha", row: "filhos", female: true },
    { id: "neto", label: "Neto", row: "netos" },
    { id: "neta", label: "Neta", row: "netos", female: true },
    { id: "bisneto", label: "Bisneto", row: "bisnetos" },
    { id: "bisneta", label: "Bisneta", row: "bisnetos", female: true },
];

const SPOUSES: ReadonlySet<string> = new Set(["esposo", "esposa"]);

/** The legitimate line of descent: who rises with a player raised to the nobility. Adopted children and bastards do not. */
const LEGITIMATE_LINE: ReadonlySet<string> = new Set(["filho", "filha", "neto", "neta", "bisneto", "bisneta"]);

interface StoredPerson {
    readonly id: string;
    readonly relation: string;
    readonly degree: number | null;
    readonly name: string;
    readonly createdAt: number;
    /** Marked dead by the player. */
    readonly deceased?: boolean;
    /** The player this relative is, when they are one. */
    readonly steamId?: string;
    /** This entry is the other side of a link that player made in their own tree (`owner`, the entry's `id` there), and follows it until this tree's owner changes it. */
    readonly mirrorOf?: { readonly owner: string; readonly id: string };
    /** The other player's tree has been given its side of this link once: it is not made again if they remove it. */
    readonly mirrored?: true;
    /** Asked of another player and not answered yet: whom, the request's own key, and who asks, as their tree will name them. */
    readonly invite?: Invite;
}

interface Invite extends Mirroring {
    readonly steamId: string;
    readonly key: string;
}

/** What the page is sent for each person: the stored fields plus the words and the row to draw it with. */
export interface PersonView {
    readonly id: string;
    readonly name: string;
    readonly relation: string;
    readonly label: string;
    readonly row: RowId;
    readonly deceased: boolean;
    readonly female: boolean;
    /** The relative is a player of the server. Who exactly is not sent: a Steam id stays on the server. */
    readonly player: boolean;
    /** A player was asked to be this relative and has not answered. */
    readonly asked: boolean;
}

/** A request waiting in a player's Família section: its key (no Steam id), who asks, and what the asker's tree calls them. */
export interface InviteView {
    readonly key: string;
    readonly name: string;
    readonly label: string;
}

/** Who a link is made by, as the other tree needs to know them: the name it gives them there, and their body's gender (a relation has a feminine word and a masculine one). */
export interface Mirroring {
    readonly name: string;
    readonly gender: "male" | "female" | null;
}

/**
 * What a link did to the other tree. `present`: it already had the player in it; `full`: it had no room; `unknown`: the
 * relation could not be turned around (no gender, no usable name).
 */
export type MirrorOutcome =
    | { readonly kind: "added" | "updated"; readonly steamId: string; readonly person: PersonView }
    | { readonly kind: "removed" | "present" | "full" | "unknown"; readonly steamId: string };

/** `invited`: the player who was asked to be this relative. */
export type AddResult = { readonly ok: true; readonly person: PersonView; readonly invited?: string } | { readonly ok: false; readonly reason: string };

export type EditResult = { readonly ok: true; readonly person: PersonView; readonly mirrors?: readonly MirrorOutcome[]; readonly invited?: string } | { readonly ok: false; readonly reason: string };

/** An answer to a request: whose tree asked, whether it is a link now, what the asker's tree calls the one who answered, and the other side made. */
export type AnswerResult =
    | { readonly ok: true; readonly owner: string; readonly accepted: boolean; readonly label: string; readonly mirror: MirrorOutcome | null }
    | { readonly ok: false; readonly reason: string };

/** A player who shares another's standing: their Steam id, and the name the tree gives them ("" when it is not theirs). */
export interface Heir {
    readonly steamId: string;
    readonly name: string;
}

interface FamilyRecord {
    persons: StoredPerson[];
    /** The family's name, which the Personagem page shows once there is one. */
    surname?: string | null;
    updatedAt: number;
}

/** What the page shows for a marital status: the Latin word, and the Portuguese under it. */
export interface MaritalView {
    readonly label: string;
    readonly gloss: string;
}

let cache: Record<string, FamilyRecord> | null = null;

function load(): Record<string, FamilyRecord> {
    if (cache) {
        return cache;
    }
    try {
        cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, FamilyRecord>;
    } catch {
        cache = {};
    }
    return cache;
}

function persist(store: Record<string, FamilyRecord>): void {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function relationOf(id: string): RelationInfo | undefined {
    return RELATIONS.find((relation) => relation.id === id);
}

/** "Primo", or "Primo de 2º grau": the ordinary cousin is the first degree and is not spelt out. */
function labelFor(relation: RelationInfo, degree: number | null): string {
    return relation.degree && degree !== null && degree > 1 ? `${relation.label} de ${degree}º grau` : relation.label;
}

function view(person: StoredPerson): PersonView | null {
    const relation = relationOf(person.relation);
    // A relation the catalog no longer has is skipped rather than shown wrongly.
    return relation
        ? {
              id: person.id,
              name: person.name,
              relation: relation.id,
              label: labelFor(relation, person.degree),
              row: relation.row,
              deceased: person.deceased === true,
              female: relation.female === true,
              player: typeof person.steamId === "string" && person.steamId !== "",
              asked: person.invite !== undefined,
          }
        : null;
}

/** Whether `link` may be tied to a relative of `steamId`'s tree: another player, not already in it under someone else. */
function linkProblem(record: FamilyRecord, steamId: string, link: string, exceptId: string | null): string | null {
    if (link === steamId) {
        return "Você não pode ser o seu próprio parente.";
    }
    if (record.persons.some((person) => (person.steamId === link || person.invite?.steamId === link) && person.id !== exceptId)) {
        return "Esse jogador já está na sua árvore.";
    }
    return null;
}

/** Names are shown through the page's text nodes, so this is about tidiness and size, not escaping. */
function cleanName(raw: string): string {
    return raw
        .normalize("NFC")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * What `A` is to the one `A` calls this: the relation as the other tree writes it, by the gender of `A`. "Esposa" in A's tree
 * makes A the "Esposo" (or the "Esposa") in hers; the child of a tree has the owner for "Pai" or "Mãe"; adopted children and
 * bastards have the same parents the others have, there being no word for the other kind.
 */
const INVERSE: Readonly<Record<string, readonly [male: string, female: string]>> = {
    bisavo: ["bisneto", "bisneta"],
    bisava: ["bisneto", "bisneta"],
    avo: ["neto", "neta"],
    ava: ["neto", "neta"],
    pai: ["filho", "filha"],
    mae: ["filho", "filha"],
    tio: ["sobrinho", "sobrinha"],
    tia: ["sobrinho", "sobrinha"],
    esposo: ["esposo", "esposa"],
    esposa: ["esposo", "esposa"],
    irmao: ["irmao", "irma"],
    irma: ["irmao", "irma"],
    primo: ["primo", "prima"],
    prima: ["primo", "prima"],
    filho: ["pai", "mae"],
    filha: ["pai", "mae"],
    filho_adotivo: ["pai", "mae"],
    filha_adotiva: ["pai", "mae"],
    filho_bastardo: ["pai", "mae"],
    filha_bastarda: ["pai", "mae"],
    sobrinho: ["tio", "tia"],
    sobrinha: ["tio", "tia"],
    neto: ["avo", "ava"],
    neta: ["avo", "ava"],
    bisneto: ["bisavo", "bisava"],
    bisneta: ["bisavo", "bisava"],
};

export function inverseRelation(relationId: string, gender: "male" | "female" | null): string | null {
    const pair = INVERSE[relationId];
    if (pair === undefined || gender === null) {
        return null;
    }
    return gender === "female" ? pair[1] : pair[0];
}

/** A person id nobody in this tree has: the ids only need to be unique inside one player's tree. */
function freeId(record: FamilyRecord): string {
    let sequence = record.persons.length + 1;
    while (record.persons.some((person) => person.id === `p${sequence}`)) {
        sequence += 1;
    }
    return `p${sequence}`;
}

type Store = Record<string, FamilyRecord>;
type LinkSource = { readonly id: string; readonly relation: string; readonly degree: number | null };

/**
 * Whether this entry of somebody's tree is only the other side of a link `steamId` made, still following it: it says
 * nothing `steamId` has not said, so it is not a second voice (a spouse marked dead in one's own tree leaves one a widow,
 * whatever the mirror in the other's tree still says).
 */
function echoOf(person: StoredPerson, steamId: string): boolean {
    return person.mirrorOf?.owner === steamId;
}

/** The entry of `target`'s tree that is `owner`'s side of the link `owner` made as `sourceId`, and still follows it. -1 when there is none. */
function findMirror(store: Store, target: string, owner: string, sourceId: string): number {
    return (store[target]?.persons ?? []).findIndex((person) => person.steamId === owner && person.mirrorOf?.owner === owner && person.mirrorOf.id === sourceId);
}

/** Gives `target`'s tree its side of a link `owner` made: `owner`, as the relative the relation turns around to. */
function mirrorInto(store: Store, owner: string, source: LinkSource, target: string, who: Mirroring): MirrorOutcome {
    const relation = inverseRelation(source.relation, who.gender);
    const name = cleanName(who.name).slice(0, LIMITS.nameMax).trim();
    if (relation === null || name.length < LIMITS.nameMin) {
        return { kind: "unknown", steamId: target };
    }
    const record = store[target] ?? { persons: [], updatedAt: 0 };
    if (record.persons.some((person) => person.steamId === owner || person.invite?.steamId === owner)) {
        return { kind: "present", steamId: target };
    }
    if (record.persons.length >= LIMITS.maxPersons) {
        return { kind: "full", steamId: target };
    }
    const now = Date.now();
    const stored: StoredPerson = { id: freeId(record), relation, degree: relationOf(relation)?.degree === true ? (source.degree ?? 1) : null, name, createdAt: now, steamId: owner, mirrorOf: { owner, id: source.id } };
    record.persons.push(stored);
    record.updatedAt = now;
    store[target] = record;
    const shown = view(stored);
    return shown === null ? { kind: "unknown", steamId: target } : { kind: "added", steamId: target, person: shown };
}

/** A request to `link`, made by `who`. */
function inviteOf(link: string, who: Mirroring | undefined): Invite {
    return { steamId: link, key: Math.random().toString(36).slice(2, 10), name: who?.name ?? "", gender: who?.gender ?? null };
}

/** The relation of `owner`'s entry changed: the other side's follows, unless its own player has made it theirs. Null when there is nothing to follow. */
function updateMirror(store: Store, owner: string, source: LinkSource, target: string, who: Mirroring): MirrorOutcome | null {
    const record = store[target];
    const index = findMirror(store, target, owner, source.id);
    if (record === undefined || index < 0) {
        return null;
    }
    const relation = inverseRelation(source.relation, who.gender);
    if (relation === null) {
        return { kind: "unknown", steamId: target };
    }
    const after: StoredPerson = { ...record.persons[index]!, relation, degree: relationOf(relation)?.degree === true ? (source.degree ?? 1) : null };
    record.persons[index] = after;
    record.updatedAt = Date.now();
    const shown = view(after);
    return shown === null ? { kind: "unknown", steamId: target } : { kind: "updated", steamId: target, person: shown };
}

/** `owner`'s entry is gone or linked elsewhere: the other side goes with it, unless its own player has made it theirs. Null when there is nothing to remove. */
function dropMirror(store: Store, owner: string, sourceId: string, target: string): MirrorOutcome | null {
    const record = store[target];
    const index = findMirror(store, target, owner, sourceId);
    if (record === undefined || index < 0) {
        return null;
    }
    record.persons.splice(index, 1);
    record.updatedAt = Date.now();
    return { kind: "removed", steamId: target };
}

export function listFamily(steamId: string): readonly PersonView[] {
    const record = load()[steamId];
    if (!record) {
        return [];
    }
    return record.persons.map(view).filter((person): person is PersonView => person !== null);
}

export function addPerson(steamId: string, relationId: unknown, degree: unknown, rawName: unknown, link: string | null = null, who?: Mirroring): AddResult {
    if (!steamId) {
        return { ok: false, reason: "Sua conta não tem identificação Steam, então a família não poderia ser salva." };
    }
    if (typeof relationId !== "string" || typeof rawName !== "string") {
        return { ok: false, reason: "Isso não é um parente." };
    }
    const relation = relationOf(relationId);
    if (!relation) {
        return { ok: false, reason: "Esse parentesco não existe." };
    }

    const name = cleanName(rawName);
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
        return { ok: false, reason: `O nome precisa ter entre ${LIMITS.nameMin} e ${LIMITS.nameMax} letras.` };
    }

    let chosenDegree: number | null = null;
    if (relation.degree) {
        const wanted = degree === undefined ? 1 : degree;
        if (typeof wanted !== "number" || !Number.isInteger(wanted) || wanted < 1 || wanted > LIMITS.maxCousinDegree) {
            return { ok: false, reason: `O grau do primo vai de 1 a ${LIMITS.maxCousinDegree}.` };
        }
        chosenDegree = wanted;
    }

    const store = load();
    const record = store[steamId] ?? { persons: [], updatedAt: 0 };
    if (record.persons.length >= LIMITS.maxPersons) {
        return { ok: false, reason: `Sua árvore já tem o máximo de ${LIMITS.maxPersons} parentes.` };
    }
    const problem = link === null ? null : linkProblem(record, steamId, link, null);
    if (problem !== null) {
        return { ok: false, reason: problem };
    }

    const now = Date.now();
    // A player added is asked first: the link, and their side of it, wait for their answer (`answerInvite`).
    const stored: StoredPerson = { id: freeId(record), relation: relation.id, degree: chosenDegree, name, createdAt: now, ...(link === null ? {} : { invite: inviteOf(link, who) }) };
    record.persons.push(stored);
    record.updatedAt = now;
    store[steamId] = record;
    persist(store);

    const shown = view(stored);
    return shown ? { ok: true, person: shown, ...(link === null ? {} : { invited: link }) } : { ok: false, reason: "Não consegui guardar esse parente." };
}

/** Takes a relative out of the tree, and with it the other side of its link if that has not become its own player's. */
export function removePersonDetailed(steamId: string, id: unknown): { readonly removed: boolean; readonly mirror: MirrorOutcome | null } {
    const store = load();
    const record = store[steamId];
    if (!record || typeof id !== "string") {
        return { removed: false, mirror: null };
    }
    const gone = record.persons.find((person) => person.id === id);
    if (gone === undefined) {
        return { removed: false, mirror: null };
    }
    record.persons = record.persons.filter((person) => person.id !== id);
    const mirror = gone.steamId !== undefined && gone.steamId !== "" ? dropMirror(store, steamId, gone.id, gone.steamId) : null;
    record.updatedAt = Date.now();
    persist(store);
    return { removed: true, mirror };
}

export function removePerson(steamId: string, id: unknown): boolean {
    return removePersonDetailed(steamId, id).removed;
}

/**
 * The player changes one relative of their own tree: what they are, within the same generation (a son made adopted or
 * a bastard, a son made a daughter); whether they died; which player they are (`null` unlinks). What is left out stays.
 * Another player is asked, as when adding. With `who`, the other side of the link follows: a changed relation changes it,
 * a changed or dropped link removes it -- unless its own player has made it theirs. An entry that is itself the other side
 * of somebody's link stops following it as soon as its owner changes anything in it.
 */
export function editPerson(steamId: string, id: unknown, change: { readonly relation?: unknown; readonly deceased?: unknown; readonly link?: string | null }, who?: Mirroring): EditResult {
    const store = load();
    const record = store[steamId];
    const index = record === undefined || typeof id !== "string" ? -1 : record.persons.findIndex((person) => person.id === id);
    if (record === undefined || index < 0) {
        return { ok: false, reason: "Esse parente não está na sua árvore." };
    }
    const before = record.persons[index]!;
    let relation = before.relation;
    if (change.relation !== undefined) {
        const now = typeof change.relation === "string" ? relationOf(change.relation) : undefined;
        if (now === undefined || now.row !== relationOf(before.relation)?.row) {
            return { ok: false, reason: "Esse parentesco não cabe nessa geração." };
        }
        relation = now.id;
    }
    if (change.deceased !== undefined && typeof change.deceased !== "boolean") {
        return { ok: false, reason: "Isso não diz se o parente está vivo." };
    }
    let link = before.steamId ?? null;
    let invite = before.invite;
    if (change.link === null) {
        link = null;
        invite = undefined;
    } else if (change.link !== undefined && change.link !== link && change.link !== invite?.steamId) {
        const problem = linkProblem(record, steamId, change.link, before.id);
        if (problem !== null) {
            return { ok: false, reason: problem };
        }
        link = null;
        invite = inviteOf(change.link, who);
    }
    const keepsDegree = relationOf(relation)?.degree === true;
    const degree = keepsDegree ? (before.degree ?? 1) : null;

    // The other side of the link follows what was changed.
    const oldLink = before.steamId ?? null;
    const outcomes: MirrorOutcome[] = [];
    let mirrored = link !== null && link === oldLink && before.mirrored === true;
    if (who !== undefined) {
        const source: LinkSource = { id: before.id, relation, degree };
        if (oldLink !== null && link !== oldLink) {
            const gone = dropMirror(store, steamId, before.id, oldLink);
            if (gone !== null) {
                outcomes.push(gone);
            }
        }
        if (link !== null && relation !== before.relation) {
            const changed = updateMirror(store, steamId, source, link, who);
            if (changed !== null) {
                outcomes.push(changed);
            }
        }
    }

    // An entry that is the other side of somebody's link is its owner's from the first change they make to it. The other
    // player has their side of the link, by definition, so it is marked: it is never made again for it.
    const touched = change.relation !== undefined || change.deceased !== undefined || change.link !== undefined;
    if (before.mirrorOf !== undefined && touched && link !== null) {
        mirrored = true;
    }
    const after: StoredPerson = {
        id: before.id,
        relation,
        degree,
        name: before.name,
        createdAt: before.createdAt,
        ...((change.deceased ?? before.deceased) === true ? { deceased: true } : {}),
        ...(link === null ? {} : { steamId: link }),
        ...(before.mirrorOf !== undefined && !touched ? { mirrorOf: before.mirrorOf } : {}),
        ...(mirrored ? { mirrored: true as const } : {}),
        ...(invite === undefined ? {} : { invite }),
    };
    record.persons[index] = after;
    record.updatedAt = Date.now();
    persist(store);
    const shown = view(after);
    const invited = invite !== undefined && invite !== before.invite ? invite.steamId : undefined;
    return shown ? { ok: true, person: shown, ...(outcomes.length === 0 ? {} : { mirrors: outcomes }), ...(invited === undefined ? {} : { invited }) } : { ok: false, reason: "Não consegui guardar esse parente." };
}

/** The requests waiting in `steamId`'s Família section, oldest first. */
export function invitesFor(steamId: string): readonly InviteView[] {
    const found: Array<InviteView & { readonly at: number }> = [];
    for (const [owner, record] of Object.entries(load())) {
        for (const person of record.persons) {
            const relation = relationOf(person.relation);
            if (owner !== steamId && steamId !== "" && person.invite?.steamId === steamId && relation !== undefined) {
                found.push({ key: person.invite.key, name: person.invite.name || "Um jogador", label: labelFor(relation, person.degree), at: person.createdAt });
            }
        }
    }
    return found.sort((a, b) => a.at - b.at).map(({ key, name, label }) => ({ key, name, label }));
}

/**
 * `steamId` answers a request waiting in their section. A yes links the asker's entry to them and gives their own tree
 * the asker, as the relation turned around; a no leaves the asker's entry a name.
 */
export function answerInvite(steamId: string, key: unknown, accept: boolean): AnswerResult {
    const store = load();
    for (const [owner, record] of Object.entries(store)) {
        const index = record.persons.findIndex((person) => steamId !== "" && person.invite?.steamId === steamId && person.invite.key === key);
        const asked = record.persons[index];
        if (asked === undefined || asked.invite === undefined) {
            continue;
        }
        const { invite, ...rest } = asked;
        const relation = relationOf(rest.relation);
        const label = relation === undefined ? "parente" : labelFor(relation, rest.degree);
        let person: StoredPerson = rest;
        let mirror: MirrorOutcome | null = null;
        if (accept && linkProblem(record, owner, steamId, rest.id) === null) {
            person = { ...rest, steamId };
            mirror = mirrorInto(store, owner, person, steamId, invite);
            if (mirror.kind === "added" || mirror.kind === "present") {
                person = { ...person, mirrored: true };
            }
        }
        record.persons[index] = person;
        record.updatedAt = Date.now();
        persist(store);
        return { ok: true, owner, accepted: person.steamId === steamId, label, mirror };
    }
    return { ok: false, reason: "Esse pedido não existe mais: quem pediu mudou ou tirou o parente." };
}

/**
 * The players who share `steamId`'s social standing when it changes: the living spouse and the living legitimate line
 * (children, grandchildren, great-grandchildren) linked in their tree, and whoever names them as their living spouse in
 * their own. Adopted children, bastards, siblings, cousins and ancestors never do.
 */
export function familyHeirs(steamId: string): readonly Heir[] {
    if (steamId === "") {
        return [];
    }
    const store = load();
    const found = new Map<string, string>();
    for (const person of store[steamId]?.persons ?? []) {
        if (person.steamId !== undefined && person.steamId !== "" && person.steamId !== steamId && person.deceased !== true && (SPOUSES.has(person.relation) || LEGITIMATE_LINE.has(person.relation))) {
            found.set(person.steamId, person.name);
        }
    }
    for (const [owner, record] of Object.entries(store)) {
        if (owner !== steamId && !found.has(owner) && record.persons.some((person) => person.steamId === steamId && SPOUSES.has(person.relation) && person.deceased !== true && !echoOf(person, steamId))) {
            found.set(owner, "");
        }
    }
    return [...found].map(([id, name]) => ({ steamId: id, name }));
}

/**
 * Gives the links made before the mirror existed their other side, once: every linked relative whose tree has not been given
 * its side yet (and is not itself somebody's other side) gets it, and the link is marked, so that an entry its own player
 * removed is not made again at the next start. `infoFor` says who a Steam id is (null: unknown, left for later). How many
 * trees changed.
 */
export function backfillMirrors(infoFor: (steamId: string) => Mirroring | null): number {
    const store = load();
    let made = 0;
    let changed = false;
    for (const [owner, record] of Object.entries(store)) {
        record.persons.forEach((person, index) => {
            if (person.steamId === undefined || person.steamId === "" || person.mirrored === true || person.mirrorOf !== undefined) {
                return;
            }
            const who = infoFor(owner);
            if (who === null) {
                return;
            }
            const outcome = mirrorInto(store, owner, person, person.steamId, who);
            if (outcome.kind === "added" || outcome.kind === "present") {
                record.persons[index] = { ...person, mirrored: true };
                changed = true;
                if (outcome.kind === "added") {
                    made += 1;
                }
            }
        });
    }
    if (changed) {
        persist(store);
    }
    return made;
}

/** Whether somebody else's tree names `steamId` as their living spouse, of its own accord: not just as the other side of a link `steamId` made. */
function namedAsSpouse(steamId: string): boolean {
    return (
        steamId !== "" &&
        Object.entries(load()).some(([owner, record]) => owner !== steamId && record.persons.some((person) => person.steamId === steamId && SPOUSES.has(person.relation) && person.deceased !== true && !echoOf(person, steamId)))
    );
}

export function getSurname(steamId: string): string | null {
    return load()[steamId]?.surname ?? null;
}

export type SurnameResult = { readonly ok: true; readonly surname: string | null } | { readonly ok: false; readonly reason: string };

/** An empty surname clears it; anything else is cleaned like a name and must fit. */
export function setSurname(steamId: string, raw: unknown): SurnameResult {
    if (!steamId) {
        return { ok: false, reason: "Sua conta não tem identificação Steam, então o sobrenome não poderia ser salvo." };
    }
    if (typeof raw !== "string") {
        return { ok: false, reason: "Isso não é um sobrenome." };
    }
    const surname = cleanName(raw);
    if (surname !== "" && (surname.length < LIMITS.nameMin || surname.length > LIMITS.surnameMax)) {
        return { ok: false, reason: `O sobrenome precisa ter entre ${LIMITS.nameMin} e ${LIMITS.surnameMax} letras.` };
    }

    const store = load();
    const record = store[steamId] ?? { persons: [], updatedAt: 0 };
    record.surname = surname === "" ? null : surname;
    record.updatedAt = Date.now();
    store[steamId] = record;
    persist(store);
    return { ok: true, surname: record.surname };
}

/**
 * Married with a living spouse in the tree, or when somebody else's tree names this player as their spouse; widowed when
 * every spouse in the tree is marked dead; single otherwise. Said in Latin like the social status beside it, with the
 * Portuguese worded for the character's gender.
 */
export function maritalStatus(steamId: string, gender: "male" | "female" | null): MaritalView {
    const spouses = (load()[steamId]?.persons ?? []).filter((person) => SPOUSES.has(person.relation));
    const feminine = gender === "female";
    if (spouses.some((person) => person.deceased !== true) || namedAsSpouse(steamId)) {
        return { label: feminine ? "Coniugata" : "Coniugatus", gloss: feminine ? "casada" : "casado" };
    }
    if (spouses.length > 0) {
        return { label: feminine ? "Vidua" : "Viduus", gloss: feminine ? "viúva" : "viúvo" };
    }
    return { label: "Caelebs", gloss: feminine ? "solteira" : "solteiro" };
}
