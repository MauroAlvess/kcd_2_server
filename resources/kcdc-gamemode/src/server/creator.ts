/**
 * The character creator, server half. The creator is a page of this resource (`ui/creator.html`) over the player's own
 * body, which a camera films while the player chooses; the game's own character stage (`commands/creator.ts`, `/creator
 * nativo`) stays as the way back when the page cannot open.
 *
 * What the player picks is sent as numbers (the nth face, the nth hairstyle in its nth colour: `creator-catalog.ts`) and
 * put on the real body at once, so the camera shows it as it will be. The server decides everything that matters: the
 * numbers are checked against the catalog, the name against the rules and the other characters (`character-name.ts`), and
 * only an accepted look and name are saved (`characters.ts`). A look left unaccepted is put back.
 *
 * The name is chosen once. After that the page shows it and the server keeps it; an administrator may change their own.
 *
 * The first time is not optional (the user, 2026-10-15: "ao entrar a primeira vez ele é obrigado a criar o personagem dele e
 * dar um nome"): a player with no saved character cannot leave the creator -- the page has no way out, the server ignores a
 * cancel, and the creator is never closed for being idle. Whoever already has a character, and opens it again to change the
 * look, may leave, and the look is put back.
 *
 * The age and the height are asked too (2026-11-02, `character-details.ts`), and a character made before they were has the creator at its next entry,
 * with its look and its name as they are, and cannot leave it until it says them (`complete`): the look may change on the way, the name stays.
 *
 * Two creators never stand in each other's picture (user, 2026-10-17): see `creator-space.ts`. A creator with somebody within
 * 30 m is taken to the nearest free ground once their body is in the world, and brought back to where they were when the
 * creator is left.
 */

import { isAdmin } from "./auth.js";
import { emitLarge } from "./big-emit.js";
import { AGE_LIMITS, cleanAge, cleanHeight, detailsForPage, HEIGHT_LIMITS, heightText, lacksDetails } from "./character-details.js";
import { cleanName, epithetById, EPITHETS, EPITHET_GROUPS, fullName, nameKey, NAME_MAX, NAME_MIN } from "./character-name.js";
import type { CharacterIdentity } from "./characters.js";
import { allCharacters, clothesGivenTo, getCharacter, getIdentity, noteClothesGiven, saveCharacter } from "./characters.js";
import { buildCatalog, pageCatalog, pickedFrom, resolveLook } from "./creator-catalog.js";
import type { Catalog, Gender } from "./creator-catalog.js";
import { CLOTHES_PARTS, hasClothes, pageClothes, piecesFor } from "./creator-clothes.js";
import type { ClothesPart } from "./creator-clothes.js";
import { backFree, MIN_DISTANCE_M, planBooth } from "./creator-space.js";
import type { Spot } from "./creator-space.js";
import { ensureStarter, markStarterOutfit } from "./kits.js";

const RESOURCE = "kcdc-gamemode";

/** Server to client. */
export const BEGIN_EVENT = `${RESOURCE}:creator.begin`;
export const NAME_EVENT = `${RESOURCE}:creator.name`;
export const REFUSED_EVENT = `${RESOURCE}:creator.refused`;
export const DONE_EVENT = `${RESOURCE}:creator.done`;
export const END_EVENT = `${RESOURCE}:creator.end`;
export const TUNE_EVENT = `${RESOURCE}:creator.tune`;

/** Client to server. */
export const PREVIEW_EVENT = `${RESOURCE}:creator.preview`;
export const CHECK_EVENT = `${RESOURCE}:creator.check`;
export const ACCEPT_EVENT = `${RESOURCE}:creator.accept`;
export const CANCEL_EVENT = `${RESOURCE}:creator.cancel`;
export const FAILED_EVENT = `${RESOURCE}:creator.failed`;
/** The clothes picked in the "Roupas" tab, which a newcomer is dressed in at once (`creator-clothes.ts`). */
export const DRESS_EVENT = `${RESOURCE}:creator.dress`;
/** The clothes to choose from, with their icons: sent in pieces (`big-emit.ts`) after `creator.begin`. */
export const CLOTHES_NAME = "creator.clothes";

/**
 * What the "Roupas" tab is for. A newcomer has nothing yet and is dressed in the pieces as they are picked (`dress`). A character
 * that exists keeps what it has; the pieces it picks go to its inventory when the look is saved, each piece once per character
 * (`give`: user, 2026-10-19, "apertei creator e no menu de criação não teve a aba nova de roupas"). Since 2026-10-25 (user: "na
 * seção roupa, ao ir alterando as roupas, deve refletir no boneco também") it tries them on all the same: what it wears comes off
 * while the creator is up, the pieces go on, and all of it is put back as it was when the creator ends (`tryOn`, `takeOff`).
 */
export type ClothesMode = "dress" | "give";

/** What a character that exists had before it tried pieces on: put back as it was when the creator ends. */
interface Kept {
    readonly items: { id: string; item: string; amount: number; metadata: Record<string, unknown>; equipped: number }[];
    readonly quickslots: InventoryQuickslots | null;
}

/** The classes of what is worn on the body (`Inventory.classes`): what may come off while pieces are tried on. */
const WORN_CATEGORIES = new Set(["Armor", "Helmet", "Hood"]);

/**
 * The part of the body a worn piece covers, by its table name, the way `tools/make-items-doc.py` sorts them (ITENS.md): the torso's
 * layers, the legs, the feet, the head. A piece tried on in a part takes off what the character wore there (the armour over a tunic
 * hides it); the head comes off whatever is tried, so the face shows. Anything else it wears (gloves, a collar, rings) stays on.
 */
const PARTS_WORN: readonly [ClothesPart | "head", RegExp][] = [
    ["head", /^(Bascinet|KettleHat|SkullCap|Helmet|Coif|Hood|Cap(?!arison)|Wreath|Bonnet|Veil|HairDecor)/i],
    ["top", /^(Tunic|Shirt|Coat|Caftan|Habit|Waffenrock|Cotehardie|Surcote|SimpleDress|Dress|Cuirass|Brigandine|Gambeson|Mail|Jacket|Doublet|Aketon)/i],
    ["legs", /^(Hose|Legs|Pants|Trousers|Chausses)/i],
    ["feet", /^(Boots|Shoes|Sabatons)/i],
];

export function partWorn(name: string): ClothesPart | "head" | null {
    const stem = name.replace(/^F_/i, "");
    return PARTS_WORN.find(([, pattern]) => pattern.test(stem))?.[0] ?? null;
}

let classIndex: Map<string, { readonly id: string; readonly category: string }> | null = null;

/** An item class by its table name or its GUID, with its category; undefined for one the game does not have. */
function classOf(nameOrId: string): { readonly id: string; readonly category: string } | undefined {
    if (classIndex === null) {
        classIndex = new Map();
        try {
            for (const entry of Inventory.classes()) {
                const value = { id: entry.id, category: entry.category };
                classIndex.set(entry.name.toLowerCase(), value);
                classIndex.set(entry.id.toLowerCase(), value);
            }
        } catch (error: unknown) {
            console.log(`creator: a lista de itens do jogo não pôde ser lida: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return classIndex.get(nameOrId.toLowerCase());
}

/** A look is put on the body no more often than this, whatever the page sends. */
export const APPLY_GAP_MS = 120;

/** A look the body does not wear (the game dresses its default over a look asked for during loading) is put on again this often. */
export const ENFORCE_MS = 1_500;

/** A creator nobody has touched for this long is closed and the look put back. */
export const IDLE_MS = 15 * 60_000;

/** How long after the creator is left a creator who was moved is taken back: the page and the camera are gone by then. */
export const RETURN_AFTER_MS = 1_500;

/** After a look is accepted it is kept on this long: the game may dress its default over it at the end of loading. */
export const SETTLE_AFTER_MS = 20_000;

const TICK_MS = 1_000;

/** A page that could not open is tried again this many times, this long after, before the game's own stage is used. */
export const RETRIES = 2;
export const RETRY_MS = 4_000;

interface Session {
    readonly genders: Gender | "both";
    /** What is put back when the creator is left without accepting: the saved look, else what the body wore. */
    readonly base: Appearance | null;
    /** The name and alcunha the player cannot change any more, or null. */
    readonly fixed: CharacterIdentity | null;
    /** A newcomer, who has no character yet: the creator cannot be left until it is accepted. */
    readonly mandatory: boolean;
    /** What the client was sent, to send again when its page could not open. */
    readonly opening: Record<string, unknown>;
    /** Times the page failed to open. */
    failures: number;
    /** Whether the body has been given a look to try on, which has to be put back if the creator is left. */
    tried: boolean;
    /** The look the body is kept in while the player chooses. */
    wanted: Appearance | null;
    appliedAt: number;
    touchedAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    /** Whether the player's place has been looked at (once their body is in the world): see `makeRoom`. */
    placed: boolean;
    /** Where they stood before they were taken to a booth, or null when they were not moved. */
    origin: Spot | null;
    /** The gender of the clothes the newcomer was last dressed in from the "Roupas" tab, or null when none were put on. */
    dressed: Gender | null;
    /** What the "Roupas" tab does for this player, or null when there is none. */
    readonly clothes: ClothesMode | null;
    /** What a character that exists had before it tried pieces on, or null when it has tried none. */
    kept: Kept | null;
    /** A remake of the look and the name ("Refazer aparência"): what is done once it is saved, or null. */
    readonly remake: ((player: Player) => void) | null;
    /** A character that exists, opened to say its age and height (made before they were asked): it cannot be left until it does. */
    readonly complete: boolean;
    /** Whether the head of a character that exists has come out from under what it wore on it (`bareHead`), and how many times it was tried. */
    headBare: boolean;
    headTries: number;
}

const sessions = new Map<number, Session>();

/** What opens the game's own stage when this creator cannot (set by `installCreator`). */
let fallbackStage: ((player: Player, reason: string, mandatory: boolean) => void) | null = null;

/** A look that was just accepted, kept on the body for a while. */
const settling = new Map<number, { readonly look: Appearance; readonly until: number; appliedAt: number }>();
let catalog: Catalog | null = null;
let ticking = false;

function theCatalog(): Catalog {
    if (catalog === null) {
        catalog = buildCatalog(Appearances);
        console.log(`creator: catálogo dos homens ${catalog.male.heads.length} rostos, ${catalog.male.hairs.length} cabelos, ${catalog.male.skins.length} peles; das mulheres ${catalog.female.heads.length}, ${catalog.female.hairs.length}, ${catalog.female.skins.length}`);
    }
    return catalog;
}

function send(player: Player, event: string, payload: unknown = {}): void {
    player.emit(event, JSON.stringify(payload));
}

/** An empty part of the wanted look means "leave it to the game", so only the named parts are compared. */
function holds(published: Appearance, wanted: Appearance): boolean {
    return published.gender === wanted.gender && (["head", "hair", "beard", "body"] as const).every((part) => wanted[part] === "" || wanted[part] === undefined || published[part] === wanted[part]);
}

// -------------------------------------------------------------------------------------------------
// The name: what it is checked against.

/** What the other characters go by, for the names already taken: saved characters (the name given, or the nickname of one made without), and players on now who have no saved character yet. */
function namesTaken(player: Player): Set<string> {
    const taken = new Set<string>();
    for (const saved of allCharacters()) {
        if (saved.steamId !== player.steamId) {
            taken.add(nameKey(saved.named ? fullName(saved.name, saved.epithet) : saved.nickname));
        }
    }
    for (const other of Player.all()) {
        if (other.id !== player.id && other.steamId !== player.steamId && getCharacter(other.steamId) === null) {
            taken.add(nameKey(other.nickname));
        }
    }
    return taken;
}

export type NameState = { readonly ok: true; readonly name: string; readonly epithet: string; readonly full: string } | { readonly ok: false; readonly message: string };

/** Whether this first name and alcunha can be this player's character's. */
export function checkName(player: Player, rawName: unknown, rawEpithet: unknown): NameState {
    const session = sessions.get(player.id);
    if (session?.fixed) {
        return { ok: true, name: session.fixed.name, epithet: session.fixed.epithet, full: fullName(session.fixed.name, session.fixed.epithet) };
    }
    const clean = cleanName(rawName);
    if (!clean.ok) {
        return { ok: false, message: clean.reason };
    }
    const epithet = rawEpithet === undefined || rawEpithet === null || rawEpithet === "" ? "" : epithetById(rawEpithet)?.id;
    if (epithet === undefined) {
        return { ok: false, message: "Essa alcunha não existe: escolha uma da lista." };
    }
    const full = fullName(clean.name, epithet);
    if (namesTaken(player).has(nameKey(full))) {
        return { ok: false, message: epithet === "" ? `Já existe um ${clean.name}. Escolha uma alcunha (como II ou o Ruivo) ou outro nome.` : `Já existe um ${full}. Escolha outra alcunha ou outro nome.` };
    }
    return { ok: true, name: clean.name, epithet, full };
}

// -------------------------------------------------------------------------------------------------
// Open, preview, accept, cancel.

function apply(player: Player, look: Appearance, session: Session): void {
    session.appliedAt = Date.now();
    session.tried = true;
    if (!player.setAppearance(look)) {
        console.log(`creator: ${player.nickname}: o jogo recusou o visual ${JSON.stringify(look)}`);
    }
}

/** Where everybody else stands (ready bodies of the same world): what a creator must keep away from. */
function othersOf(player: Player): Spot[] {
    return Player.all()
        .filter((other) => other.id !== player.id && other.ready && other.virtualWorld === player.virtualWorld)
        .map((other) => ({ x: other.position.x, y: other.position.y, z: other.position.z }));
}

/** Walkable ground near a spot, or null (and always null while the navigation mesh is not up: better in the picture than in the sea). */
function groundNear(spot: Spot): Spot | null {
    if (!Navigation.ready) {
        return null;
    }
    const floor = Navigation.closestPoint({ x: spot.x, y: spot.y, z: spot.z }, { searchRadius: 6, searchHeight: 30, doors: "any" });
    return floor === null ? null : { x: floor.x, y: floor.y, z: floor.z };
}

/** A creator with somebody within reach of their picture is taken to free ground. Once per session, when their body is in the world. */
function makeRoom(player: Player, session: Session): void {
    session.placed = true;
    const origin: Spot = { x: player.position.x, y: player.position.y, z: player.position.z };
    const booth = planBooth(origin, othersOf(player), groundNear);
    if (booth === null) {
        return;
    }
    if (!player.teleport(new Vector3(booth.x, booth.y, booth.z))) {
        console.log(`creator: ${player.nickname}: não consegui abrir espaço para o criador (o jogo não aceitou a mudança de lugar)`);
        return;
    }
    session.origin = origin;
    console.log(`creator: ${player.nickname} tinha alguém a menos de ${MIN_DISTANCE_M} m; o criador foi aberto em ${booth.x.toFixed(0)} ${booth.y.toFixed(0)} ${booth.z.toFixed(0)}`);
}

/** Takes a creator who was moved back to where they stood, when it is free; they stay where they are when it is not. */
function leaveBooth(player: Player, origin: Spot | null): void {
    if (origin === null) {
        return;
    }
    const id = player.id;
    const steamId = player.steamId;
    setTimeout(() => {
        const live = Player.getById(id);
        if (live === null || live.steamId !== steamId || sessions.has(id) || !live.ready || !live.alive) {
            return;
        }
        if (backFree(origin, othersOf(live))) {
            live.teleport(new Vector3(origin.x, origin.y, origin.z));
        }
    }, RETURN_AFTER_MS);
}

function tick(): void {
    const now = Date.now();
    for (const [id, kept] of [...settling]) {
        const player = Player.getById(id);
        if (player === null || now >= kept.until) {
            settling.delete(id);
        } else if (!holds(player.appearance, kept.look) && now - kept.appliedAt >= ENFORCE_MS) {
            kept.appliedAt = now;
            player.setAppearance(kept.look);
        }
    }
    for (const [id, session] of [...sessions]) {
        const player = Player.getById(id);
        if (player === null) {
            sessions.delete(id);
            continue;
        }
        if (!session.mandatory && now - session.touchedAt > IDLE_MS) {
            console.log(`creator: ${player.nickname}: sem resposta há ${IDLE_MS / 60_000} minutos, fechado`);
            finish(player, session);
            send(player, END_EVENT);
            continue;
        }
        if (!session.placed && player.ready) {
            makeRoom(player, session);
        }
        if (!session.headBare && session.clothes === "give" && player.ready && session.headTries < HEAD_TRIES) {
            session.headTries += 1;
            session.headBare = bareHead(player, session);
        }
        if (session.wanted !== null && !holds(player.appearance, session.wanted) && now - session.appliedAt >= ENFORCE_MS) {
            apply(player, session.wanted, session);
        }
    }
}

function startTicking(): void {
    if (!ticking) {
        ticking = true;
        setInterval(tick, TICK_MS);
    }
}

/** The session over; a look that was tried on and not accepted is put back, and so are the clothes it had on. */
function finish(player: Player, session: Session): void {
    sessions.delete(player.id);
    if (session.timer !== null) {
        clearTimeout(session.timer);
    }
    takeOff(player, session);
    if (session.tried && session.base !== null) {
        player.setAppearance(session.base);
    }
    leaveBooth(player, session.origin);
}

/**
 * A character that exists tries pieces on: what it wears in the parts tried comes off, and the hood or the helmet so the face shows
 * (`partWorn`), the pieces go on, and everything it has stays in its inventory, rows and quick slots as they were. The first try keeps
 * what it had, which `takeOff` puts back.
 */
function tryOn(player: Player, session: Session, pieces: readonly string[], parts: ReadonlySet<ClothesPart>): boolean {
    if (session.kept === null) {
        const state = Inventory.get(player);
        if (state === null || !state.ready) {
            return false;
        }
        session.kept = {
            items: state.items.map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: { ...row.metadata }, equipped: row.equipped })),
            quickslots: state.quickslots,
        };
        names.clear();
        for (const row of state.items) {
            names.set(row.id, row.name);
        }
    }
    const kept = session.kept;
    const off = (row: { readonly id: string; readonly item: string }): boolean => {
        if (!WORN_CATEGORIES.has(classOf(row.item)?.category ?? "")) {
            return false;
        }
        const part = partWorn(names.get(row.id) ?? "");
        return part === "head" || (part !== null && parts.has(part));
    };
    const items = [...kept.items.map((row) => ({ ...row, equipped: row.equipped > 0 && off(row) ? 0 : row.equipped })), ...pieces.map((item) => ({ item, amount: 1, equipped: 1 }))];
    return Inventory.set(player, { items, quickslots: kept.quickslots }).ok;
}

/** The table names of the rows a character had when it began to try pieces on, by row id (`tryOn`). */
const names = new Map<string, string>();

/** How many looks (one a second) the creator gives the bag of a character that exists before it stops trying to bare its head. */
export const HEAD_TRIES = 20;

/**
 * The head of a character that exists comes out from under the helmet, the hood or the coif when its creator opens (user, 2026-11-02: "ao abrir, o
 * jogador pode estar com elmo equipado ou coisa na cabeça, e precisamos retirar"), so that the face is seen while it is chosen: `tryOn` with no
 * pieces takes off what is worn on the head and nothing else, and `takeOff` puts it all back as it was when the creator ends. True once that is
 * done, or when nothing was on the head; false while the bag is not ready.
 */
function bareHead(player: Player, session: Session): boolean {
    const state = Inventory.get(player);
    if (state === null || !state.ready) {
        return false;
    }
    const covered = state.items.some((row) => row.equipped > 0 && WORN_CATEGORIES.has(classOf(row.item)?.category ?? "") && partWorn(String(row.name)) === "head");
    if (!covered) {
        return true;
    }
    const done = tryOn(player, session, [], new Set());
    if (done) {
        console.log(`creator: ${player.nickname}: o que cobria a cabeça saiu enquanto o criador está aberto`);
    }
    return done;
}

/** What a character that exists had on before it tried pieces on, put back as it was. */
function takeOff(player: Player, session: Session): void {
    const kept = session.kept;
    if (kept === null) {
        return;
    }
    session.kept = null;
    let ok = false;
    try {
        ok = Inventory.set(player, { items: kept.items, quickslots: kept.quickslots }).ok;
    } catch {
        ok = false;
    }
    if (!ok) {
        console.log(`creator: ${player.nickname}: não consegui devolver o que vestia antes de provar as roupas`);
    }
}

/** For a character made before the name was asked for: the first word of the nickname, when it can be a name. */
function suggestionFor(player: Player): string {
    const clean = cleanName(player.nickname.trim().split(/\s+/)[0] ?? "");
    return clean.ok && !namesTaken(player).has(nameKey(clean.name)) ? clean.name : "";
}

/**
 * Opens the creator for this player: their client puts the camera on the body and the page over the screen. `genders` is
 * what they may choose between. Asking again while one is open starts it over.
 */
export function openCreatorFor(player: Player, genders: Gender | "both" = "both", options: { readonly remake?: (player: Player) => void } = {}): void {
    let wide: Catalog;
    try {
        wide = theCatalog();
    } catch (thrown: unknown) {
        // A catalog the game will not give: the game's own stage, which a newcomer cannot back out of either.
        const reason = thrown instanceof Error ? thrown.message : String(thrown);
        const before = getCharacter(player.steamId);
        // The game's stage asks no age nor height: a character that exists and lacks only those plays on, and is asked again at its next entry.
        if (before !== null && before.redo !== true && lacksDetails(before)) {
            console.log(`creator: ${player.nickname}: sem o catálogo de aparências (${reason}); a idade e a altura ficam para a próxima entrada`);
            return;
        }
        console.log(`creator: ${player.nickname}: sem o catálogo de aparências (${reason}); vai o criador do jogo`);
        fallbackStage?.(player, "sem catálogo de aparências", before === null || before.redo === true);
        return;
    }
    settling.delete(player.id);
    // Starting over keeps what the first start would put back: the body as it was before anything was tried on.
    const previous = sessions.get(player.id);
    if (previous?.timer) {
        clearTimeout(previous.timer);
    }
    const saved = getCharacter(player.steamId);
    const base = previous?.base ?? saved?.appearance ?? player.appearance;
    const identity = getIdentity(player.steamId);
    // A character made again (`/creator refazer`) may take a new name too, and cannot be left until it is done.
    const redo = saved?.redo === true;
    // A remake of the look ("Refazer aparência", `look-remake.ts`) may take a new name too.
    const remake = options.remake ?? null;
    const fixed = identity !== null && !isAdmin(player) && !redo && remake === null ? identity : null;
    const picked = pickedFrom(wide, saved?.appearance ?? null, genders, Math.random);
    // A character made before the age and the height were asked: it says them before it plays on (2026-11-02).
    const complete = saved !== null && !redo && lacksDetails(saved);
    const mandatory = saved === null || redo || complete;
    const opening = {
        genders,
        catalog: pageCatalog(wide),
        look: picked,
        identity: identity === null ? { name: "", epithet: "", locked: false, suggestion: redo ? "" : suggestionFor(player) } : { name: identity.name, epithet: identity.epithet, locked: fixed !== null, suggestion: "" },
        epithets: { groups: EPITHET_GROUPS, list: EPITHETS.map((epithet) => ({ id: epithet.id, label: epithet.label, gloss: epithet.gloss, group: epithet.group })) },
        rules: { min: NAME_MIN, max: NAME_MAX },
        mandatory,
        // The age and the height: what the character said (null for what it has not), the limits, and where a new one starts.
        details: { age: typeof saved?.age === "number" ? saved.age : null, height: typeof saved?.height === "number" ? saved.height : null },
        detailLimits: detailsForPage(),
        complete,
        // A character that exists saves ("Salvar"); a newcomer creates ("Salvar e criar").
        existing: saved !== null,
    };
    const clothes: ClothesMode | null = !hasClothes() ? null : saved === null ? "dress" : "give";
    const session: Session = { genders, base, fixed, mandatory, opening, failures: 0, tried: previous?.tried ?? false, wanted: null, appliedAt: 0, touchedAt: Date.now(), timer: null, placed: previous?.placed ?? false, origin: previous?.origin ?? null, dressed: previous?.dressed ?? null, clothes, kept: previous?.kept ?? null, remake: remake ?? previous?.remake ?? null, complete, headBare: previous?.headBare ?? false, headTries: 0 };
    sessions.set(player.id, session);
    startTicking();
    send(player, BEGIN_EVENT, opening);
    if (clothes !== null) {
        emitLarge(player, CLOTHES_NAME, JSON.stringify({ ...pageClothes(new Set(clothesGivenTo(player.steamId))), mode: clothes }));
    }
}

/**
 * A character that exists saved its look with pieces picked in the "Roupas" tab: those it was never given go to its inventory,
 * to wear when it likes. What it already wears is not touched. The item classes given.
 */
export function giveClothes(player: Player, gender: Gender, raw: unknown): string[] {
    const picks = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    if (picks["gender"] !== gender) {
        return [];
    }
    const had = new Set(clothesGivenTo(player.steamId));
    const given: string[] = [];
    for (const item of piecesFor(gender, { top: picks["top"], legs: picks["legs"], feet: picks["feet"] })) {
        if (had.has(item)) {
            continue;
        }
        try {
            if (Inventory.add(player, { item, amount: 1 }).ok) {
                given.push(item);
            }
        } catch {
            // The game would not take it: nothing given, nothing noted.
        }
    }
    noteClothesGiven(player.steamId, given);
    return given;
}

/**
 * Dresses the body in the clothes picked in the "Roupas" tab, so the camera shows them. A newcomer has nothing yet (the starter
 * kit comes when the character is accepted), so what they wear is all they have: the inventory is set to the pieces picked. A
 * character that exists tries them on over what it has (`tryOn`), and gets it all back when the creator ends.
 *
 * `Inventory.set` takes an item by its GUID only: the catalog's table names were refused, and no newcomer was ever dressed by the tab
 * until 2026-10-25 (the log: "o jogo não vestiu TunicLong04_m02_D, ..." at every pick).
 */
function onDress(player: Player, payload: unknown): void {
    const session = sessions.get(player.id);
    if (session === undefined || session.clothes === null) {
        return;
    }
    session.touchedAt = Date.now();
    const fields = fieldsOf(payload);
    const gender = fields["gender"];
    if ((gender !== "male" && gender !== "female") || (session.genders !== "both" && session.genders !== gender)) {
        return;
    }
    const names = piecesFor(gender, { top: fields["top"], legs: fields["legs"], feet: fields["feet"] });
    const items = names.map((name) => classOf(name)?.id).filter((id): id is string => id !== undefined);
    if (items.length < names.length) {
        console.log(`creator: ${player.nickname}: o jogo não tem ${names.filter((name) => classOf(name) === undefined).join(", ")}`);
    }
    const parts = new Set(CLOTHES_PARTS.filter((part) => typeof fields[part] === "number" && (fields[part] as number) >= 0));
    let ok = false;
    try {
        ok = session.clothes === "dress" && getCharacter(player.steamId) === null ? Inventory.set(player, { items: items.map((item) => ({ item, amount: 1, equipped: 1 })) }).ok : tryOn(player, session, items, parts);
    } catch {
        ok = false;
    }
    if (session.clothes === "dress") {
        session.dressed = ok && items.length > 0 ? gender : null;
    }
    if (!ok) {
        console.log(`creator: ${player.nickname}: o jogo não vestiu ${names.join(", ")}`);
    }
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 2_048) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function onPreview(player: Player, payload: unknown): void {
    const session = sessions.get(player.id);
    if (session === undefined) {
        return;
    }
    session.touchedAt = Date.now();
    const look = resolveLook(theCatalog(), fieldsOf(payload)["look"], session.genders);
    if (look === null) {
        return;
    }
    session.wanted = look;
    const wait = session.appliedAt + APPLY_GAP_MS - Date.now();
    if (wait <= 0) {
        apply(player, look, session);
        return;
    }
    if (session.timer === null) {
        session.timer = setTimeout(() => {
            session.timer = null;
            const live = sessions.get(player.id);
            if (live === session && session.wanted !== null) {
                apply(player, session.wanted, session);
            }
        }, wait);
    }
}

function onCheck(player: Player, payload: unknown): void {
    const session = sessions.get(player.id);
    if (session === undefined) {
        return;
    }
    session.touchedAt = Date.now();
    const fields = fieldsOf(payload);
    const state = checkName(player, fields["name"], fields["epithet"]);
    // What was asked goes back with the answer: the page types faster than the server answers, and judges only the name the answer is for.
    const asked = { name: typeof fields["name"] === "string" ? fields["name"] : "", epithet: typeof fields["epithet"] === "string" ? fields["epithet"] : "" };
    send(player, NAME_EVENT, state.ok ? { ok: true, full: state.full, ...asked } : { ok: false, message: state.message, ...asked });
}

function onAccept(player: Player, payload: unknown): void {
    const session = sessions.get(player.id);
    if (session === undefined) {
        return;
    }
    session.touchedAt = Date.now();
    const fields = fieldsOf(payload);
    const look = resolveLook(theCatalog(), fields["look"], session.genders);
    if (look === null) {
        send(player, REFUSED_EVENT, { message: "Esse visual não é válido. Escolha de novo." });
        return;
    }
    const state = checkName(player, fields["name"], fields["epithet"]);
    if (!state.ok) {
        send(player, REFUSED_EVENT, { message: state.message, field: "name" });
        return;
    }
    // The age and the height (2026-11-02): asked of every creator, in the limits of the gender chosen.
    const age = cleanAge(fields["age"]);
    const height = cleanHeight(fields["height"], look.gender);
    if (age === null || height === null) {
        const limits = HEIGHT_LIMITS[look.gender];
        send(player, REFUSED_EVENT, {
            message: age === null ? `A idade vai de ${AGE_LIMITS.min} a ${AGE_LIMITS.max} anos.` : `A altura ${look.gender === "female" ? "de uma mulher" : "de um homem"} vai de ${heightText(limits.min)} a ${heightText(limits.max)}.`,
            field: "details",
        });
        return;
    }
    if (session.timer !== null) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    sessions.delete(player.id);
    // What was tried on comes off and what it had goes back on; the pieces picked are given below, each once.
    takeOff(player, session);
    player.setAppearance(look);
    leaveBooth(player, session.origin);
    settling.set(player.id, { look, until: Date.now() + SETTLE_AFTER_MS, appliedAt: Date.now() });
    startTicking();
    saveCharacter(player.steamId, look, player.nickname, { name: state.name, epithet: state.epithet }, { age, height });
    // Dressed from the "Roupas" tab for this very body: those are the clothes, and the starter outfit is not put over them.
    if (session.dressed !== null && session.dressed === look.gender) {
        markStarterOutfit(player);
    }
    ensureStarter(player);
    if (session.remake !== null) {
        session.remake(player);
        console.log(`creator: ${player.nickname} refez a aparência de ${state.full} (${look.gender === "female" ? "mulher" : "homem"}, ${age} anos, ${heightText(height)})`);
        Chat.sendToPlayer(player, `Aparência refeita: agora você é ${state.full}. Tudo o que o personagem tinha continua seu.`);
    } else if (session.complete) {
        console.log(`creator: ${player.nickname} completou ${state.full}: ${age} anos, ${heightText(height)}`);
        Chat.sendToPlayer(player, `Personagem completo: ${state.full}, ${age} anos, ${heightText(height)}. Bom jogo!`);
    } else {
        console.log(`creator: ${player.nickname} criou ${state.full} (${look.gender === "female" ? "mulher" : "homem"}, ${age} anos, ${heightText(height)})`);
        Chat.sendToPlayer(player, `Bem-vindo a Kuttenberg, ${state.full}. Digite /creator para mudar o visual quando quiser.`);
    }
    if (session.clothes === "give") {
        const given = giveClothes(player, look.gender, fields["clothes"]);
        if (given.length > 0) {
            console.log(`creator: ${player.nickname} recebeu ${given.length} peça(s) de roupa do criador`);
            Chat.sendToPlayer(player, `${given.length === 1 ? "A peça de roupa escolhida foi" : `As ${given.length} peças de roupa escolhidas foram`} para o seu inventário: vista quando quiser.`);
        }
    }
    send(player, DONE_EVENT, { full: state.full });
}

/** The framing the next creator is filmed in (`/creator camera`), sent to this player's client: numbers, or `{}` to go back to the defaults. */
export function tuneCreatorFor(player: Player, tuning: Record<string, number>): void {
    send(player, TUNE_EVENT, tuning);
}

/**
 * Ends the creator for this player (`/creator stop`): the look tried on is put back, and the page is told to close. A newcomer
 * cannot (an administrator can): false, and nothing happens.
 */
export function closeCreatorFor(player: Player): boolean {
    const session = sessions.get(player.id);
    if (session?.mandatory && !isAdmin(player)) {
        Chat.sendToPlayer(player, "Para entrar em Kuttenberg, crie o seu personagem e dê um nome a ele.");
        return false;
    }
    if (session !== undefined) {
        finish(player, session);
    }
    send(player, END_EVENT);
    return true;
}

/**
 * The player left the creator. A newcomer's own "leave" is not accepted; what the client did because it had to (the body died)
 * says so (`forced`), and ends the session so that the next spawn opens a new one.
 */
function onCancel(player: Player, payload: unknown): void {
    const session = sessions.get(player.id);
    if (session === undefined) {
        return;
    }
    if (session.mandatory && fieldsOf(payload)["forced"] !== true) {
        console.log(`creator: ${player.nickname}: tentou sair do criador sem ter criado o personagem; ignorado`);
        return;
    }
    finish(player, session);
}

export function installCreator(onFailed: (player: Player, reason: string, mandatory: boolean) => void): void {
    fallbackStage = onFailed;
    // Read now, so that a catalog the game does not give shows in the log at the start and not at a newcomer's join.
    try {
        theCatalog();
    } catch (thrown: unknown) {
        console.log(`creator: o catálogo de aparências não pôde ser lido agora: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
    Events.onClient(PREVIEW_EVENT, (sender, payload) => onPreview(sender as Player, payload));
    Events.onClient(CHECK_EVENT, (sender, payload) => onCheck(sender as Player, payload));
    Events.onClient(ACCEPT_EVENT, (sender, payload) => onAccept(sender as Player, payload));
    Events.onClient(CANCEL_EVENT, (sender, payload) => onCancel(sender as Player, payload));
    Events.onClient(DRESS_EVENT, (sender, payload) => onDress(sender as Player, payload));
    Events.onClient(FAILED_EVENT, (sender, payload) => {
        const player = sender as Player;
        const session = sessions.get(player.id);
        if (session === undefined) {
            return;
        }
        const reason = String(fieldsOf(payload)["reason"] ?? "").slice(0, 120);
        // The browser may not be up yet: the page is asked for again before the game's own stage takes its place.
        if (session.failures < RETRIES) {
            session.failures += 1;
            console.log(`creator: ${player.nickname}: a página não abriu (${reason}); outra tentativa em ${RETRY_MS / 1000} s (${session.failures} de ${RETRIES})`);
            setTimeout(() => {
                const live = Player.getById(player.id);
                if (live !== null && sessions.get(player.id) === session) {
                    send(live, BEGIN_EVENT, session.opening);
                }
            }, RETRY_MS);
            return;
        }
        sessions.delete(player.id);
        takeOff(player, session);
        leaveBooth(player, session.origin);
        // The game's stage asks no age nor height: a character that lacks only those plays on, and is asked again at its next entry.
        if (session.complete) {
            if (session.tried && session.base !== null) {
                player.setAppearance(session.base);
            }
            console.log(`creator: ${player.nickname}: a página não abriu (${reason}); a idade e a altura ficam para a próxima entrada`);
            return;
        }
        console.log(`creator: ${player.nickname}: a página não abriu (${reason}); vai o criador do jogo${session.mandatory ? ", que não se pode deixar sem criar o personagem" : ""}`);
        onFailed(player, reason, session.mandatory);
    });
    Events.on("playerDisconnect", (player) => {
        const session = sessions.get(player.id);
        if (session?.timer) {
            clearTimeout(session.timer);
        }
        sessions.delete(player.id);
        settling.delete(player.id);
    });
}
