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
 * Two creators never stand in each other's picture (user, 2026-10-17): see `creator-space.ts`. A creator with somebody within
 * 30 m is taken to the nearest free ground once their body is in the world, and brought back to where they were when the
 * creator is left.
 */

import { isAdmin } from "./auth.js";
import { cleanName, epithetById, EPITHETS, EPITHET_GROUPS, fullName, nameKey, NAME_MAX, NAME_MIN } from "./character-name.js";
import type { CharacterIdentity } from "./characters.js";
import { allCharacters, getCharacter, getIdentity, saveCharacter } from "./characters.js";
import { buildCatalog, pageCatalog, pickedFrom, resolveLook } from "./creator-catalog.js";
import type { Catalog, Gender } from "./creator-catalog.js";
import { backFree, MIN_DISTANCE_M, planBooth } from "./creator-space.js";
import type { Spot } from "./creator-space.js";
import { ensureStarter } from "./kits.js";

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

/** The session over; a look that was tried on and not accepted is put back. */
function finish(player: Player, session: Session): void {
    sessions.delete(player.id);
    if (session.timer !== null) {
        clearTimeout(session.timer);
    }
    if (session.tried && session.base !== null) {
        player.setAppearance(session.base);
    }
    leaveBooth(player, session.origin);
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
export function openCreatorFor(player: Player, genders: Gender | "both" = "both"): void {
    let wide: Catalog;
    try {
        wide = theCatalog();
    } catch (thrown: unknown) {
        // A catalog the game will not give: the game's own stage, which a newcomer cannot back out of either.
        const reason = thrown instanceof Error ? thrown.message : String(thrown);
        console.log(`creator: ${player.nickname}: sem o catálogo de aparências (${reason}); vai o criador do jogo`);
        fallbackStage?.(player, "sem catálogo de aparências", getCharacter(player.steamId) === null);
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
    const fixed = identity !== null && !isAdmin(player) ? identity : null;
    const picked = pickedFrom(wide, saved?.appearance ?? null, genders, Math.random);
    const mandatory = saved === null;
    const opening = {
        genders,
        catalog: pageCatalog(wide),
        look: picked,
        identity: identity === null ? { name: "", epithet: "", locked: false, suggestion: suggestionFor(player) } : { name: identity.name, epithet: identity.epithet, locked: fixed !== null, suggestion: "" },
        epithets: { groups: EPITHET_GROUPS, list: EPITHETS.map((epithet) => ({ id: epithet.id, label: epithet.label, gloss: epithet.gloss, group: epithet.group })) },
        rules: { min: NAME_MIN, max: NAME_MAX },
        mandatory,
    };
    const session: Session = { genders, base, fixed, mandatory, opening, failures: 0, tried: previous?.tried ?? false, wanted: null, appliedAt: 0, touchedAt: Date.now(), timer: null, placed: previous?.placed ?? false, origin: previous?.origin ?? null };
    sessions.set(player.id, session);
    startTicking();
    send(player, BEGIN_EVENT, opening);
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
    if (session.timer !== null) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    sessions.delete(player.id);
    player.setAppearance(look);
    leaveBooth(player, session.origin);
    settling.set(player.id, { look, until: Date.now() + SETTLE_AFTER_MS, appliedAt: Date.now() });
    startTicking();
    saveCharacter(player.steamId, look, player.nickname, { name: state.name, epithet: state.epithet });
    ensureStarter(player);
    console.log(`creator: ${player.nickname} criou ${state.full} (${look.gender === "female" ? "mulher" : "homem"})`);
    Chat.sendToPlayer(player, `Bem-vindo a Kuttenberg, ${state.full}. Digite /creator para mudar o visual quando quiser.`);
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
        leaveBooth(player, session.origin);
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
