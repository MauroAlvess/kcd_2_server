/**
 * The "Nomeação" section of the status panel, the server's half: who may name whom to which title, the hierarchy the
 * players read, and the title a player chooses to wear over their head. The rules themselves are in `nobility.ts` (pure),
 * the holders in `titles.ts`, the social status in `status.ts`; this is the part that joins them to the panel's events.
 *
 * What the user asked for, and how it is kept:
 *
 * - The section exists only for a noble (social status nobilis). A commoner's panel does not have it and the server does
 *   not answer its events. An administrator has it too and names anybody to anything, "by the Crown".
 * - Naming needs a title that can name (`appoints` in the catalog), always to a title below one's own. A noble may name
 *   a commoner: a title of the blood or of the high Church raises them to noble, with their spouse and their legitimate
 *   line, the same rule as an administrator's change of standing.
 * - A noble names only people whose name they know (`acquaintances.ts`): the list of whom to name has the people who
 *   have introduced themselves, not everyone online by their real name. The hierarchy lists the holders of titles by
 *   name -- a title is public, which is what makes it worth holding -- and shows of each what a character is known by
 *   (titles, who named them, standing, guild, house, lands, married or not), and nothing about the person behind it: no
 *   place, no vitals, no online status, no Steam id, no supporter mark, no role.
 * - The standing, plebeius or nobilis, is never over a head. A title is, when its holder chose to wear it
 *   (`status.shownTitle`, in Opções).
 * - A noble who becomes a commoner loses the titles of the blood and of the Church, which are noble by nature, and keeps
 *   their offices.
 */

import { adminLabel, knows, nameOf } from "./acquaintances.js";
import { isAdmin } from "./auth.js";
import { getCharacter } from "./characters.js";
import { consortsOf } from "./consort.js";
import type { Consort } from "./consort.js";
import { familyBaseHeirs, familyHeirs, getSurname, maritalStatus } from "./family.js";
import { appointable, BRANCHES, hasNominationPower, judgeNomination, judgeRevocation, labelOf, levelOf, order, raises, summarize, titleById, TITLES } from "./nobility.js";
import type { TitleDef } from "./nobility.js";
import { landSummary } from "./properties.js";
import { addLazyPayload, addPayload, familyLinked, getGuildId, getSocialStatus, GUILDS, listGuildMembers, notice, onStatusChange, sendRoster, sendSocial, setNominees, setSocialStatus, SOCIAL_STATUS } from "./status.js";
import type { SocialStatus } from "./status.js";
import { addTitle, applyNametag, grantsOf, holders, isFemale, labelWithRegion, noteName, regionOfTitle, removeTitle, removeWhere, setShown, shownOf, titlesOf } from "./titles.js";
import type { Grant } from "./titles.js";
import { emitLarge } from "./big-emit.js";
import { landsOf, TOWNS, townById, townOf } from "./citizenship.js";
import { nameOfMember } from "./guild-members.js";

const RESOURCE = "kcdc-gamemode";

/** What the Crown is called on a title an administrator gave. */
export const CROWN = "a Coroa";

export type Outcome = { readonly ok: boolean; readonly message: string };

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 512) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

const fail = (message: string): Outcome => ({ ok: false, message });

// ---------------------------------------------------------------------------------------------
// Who sees what.

/** A noble or a lesser noble (a knight names squires: user, 2026-10-19, the lesser titles make lesser nobles). */
export function isNoble(steamId: string): boolean {
    return steamId !== "" && getSocialStatus(steamId) !== "plebeius";
}

const RANK: Readonly<Record<SocialStatus, number>> = { plebeius: 0, minor: 1, nobilis: 2 };

/**
 * The standing a title gives its holder (user, 2026-10-19: "ao dar um título um jogador já recebe nobre ou nobreza menor"): the
 * crown, the great nobility and the high Church make a noble, the lesser nobility (knight, squire, small noble) a lesser noble;
 * a post changes nothing.
 */
export function standingOf(title: TitleDef): SocialStatus | null {
    if (title.kind === "lordly") {
        return "nobilis";
    }
    if (title.kind !== "blood") {
        return null;
    }
    return title.branch === "lesser" ? "minor" : "nobilis";
}

/** The word for a standing in a sentence. */
export const standingWord = (standing: SocialStatus): string => (standing === "nobilis" ? "nobre" : standing === "minor" ? "da nobreza menor" : "plebeu");

/** Raises one player to at least `standing`; never lowers anybody. Whether they rose. */
function lift(steamId: string, standing: SocialStatus): boolean {
    if (steamId === "" || RANK[getSocialStatus(steamId)] >= RANK[standing]) {
        return false;
    }
    setSocialStatus(steamId, standing);
    return true;
}

/**
 * What a noble's family takes from them (user, 2026-10-19: "caso entre na família de um nobre já recebe nobre ou nobreza menor, e se
 * for bastardo ou adotado deve receber nobreza menor"): the living spouse and legitimate line their standing, the adopted children
 * and the bastards the lesser nobility. Only raises. The Steam ids of whoever rose.
 */
export function spreadStanding(steamId: string): string[] {
    const standing = steamId === "" ? "plebeius" : getSocialStatus(steamId);
    if (standing === "plebeius") {
        return [];
    }
    const risen: string[] = [];
    for (const heir of familyHeirs(steamId)) {
        if (lift(heir.steamId, standing)) {
            risen.push(heir.steamId);
        }
    }
    for (const heir of familyBaseHeirs(steamId)) {
        if (lift(heir.steamId, "minor")) {
            risen.push(heir.steamId);
        }
    }
    return risen;
}

/** The section is for a noble, and for an administrator, who names as the Crown. */
export function canUse(player: Player): boolean {
    return isAdmin(player) || isNoble(player.steamId);
}

/**
 * Who may READ the hierarchy: whoever may use the section, and whoever holds any title at all (2026-10-29: a soldier, a guard or a clerk is a commoner with a post, and the
 * tree is where the posts and the trades of the realm are read); naming and revoking stay with the nobles.
 */
export function canView(player: Player): boolean {
    return canUse(player) || (player.steamId !== "" && titlesOf(player.steamId).length > 0);
}

/**
 * An opaque name for a holder in the page's lists, so the page can ask to take a title off somebody who is not here
 * without ever being told a Steam id. It changes at every start; a stale one names nobody.
 */
const SALT = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

export function keyOf(steamId: string): string {
    let hash = 0x811c9dc5;
    const text = `${SALT}:${steamId}`;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `h${hash.toString(16)}`;
}

function holderByKey(key: unknown): string | null {
    return typeof key === "string" ? (holders().find((holder) => keyOf(holder.steamId) === key)?.steamId ?? null) : null;
}

/**
 * The players in the game by Steam id, as they were a second ago: every holder of the hierarchy (and of a viewer's list of the ones they named) asked for their own name and
 * body, and each ask looked at every player, whose Steam id is a read of the engine (some 5 us each: with 200 players and 300 holders, over half a second for one view).
 * Only for what is shown; whoever is told something (`online`) is looked for afresh.
 */
const SHOWN_INDEX_MS = 1_000;
let shown: { readonly at: number; readonly byId: Map<string, Player> } | null = null;
function shownOnline(steamId: string): Player | undefined {
    const now = Date.now();
    if (shown === null || now - shown.at > SHOWN_INDEX_MS) {
        const byId = new Map<string, Player>();
        for (const other of Player.all()) {
            byId.set(other.steamId, other);
        }
        shown = { at: now, byId };
    }
    return shown.byId.get(steamId);
}

/**
 * What the hierarchy calls a character (user, 2026-10-30: "o nome dos cards deve pegar só o nome que o personagem usou na criação e o nome da família"): the name they
 * were made with and the family's surname, with no alcunha and never the account's nickname (the cards read "Player" and "Veckks22" when they took what a holder was
 * called when last seen, and "Gunther von Silberhände von Silberhände" when that already had the surname). Null for a character made before names.
 */
function plainName(steamId: string): string | null {
    const first = getCharacter(steamId)?.name;
    if (typeof first !== "string" || first.trim() === "") {
        return null;
    }
    const surname = getSurname(steamId);
    return surname && !first.toLowerCase().endsWith(surname.toLowerCase()) ? `${first.trim()} ${surname}` : first.trim();
}

/** A holder as the hierarchy calls them: the character's own name and the family's surname; one made before names, the name they had when last seen. */
function nameFor(steamId: string, stored: string): string {
    const plain = plainName(steamId);
    if (plain !== null) {
        return plain;
    }
    const online = shownOnline(steamId);
    if (online !== undefined) {
        return nameOf(online);
    }
    const surname = getSurname(steamId);
    const nickname = stored !== "" ? stored : (getCharacter(steamId)?.nickname ?? "");
    return surname ? `${nickname} ${surname}`.trim() : nickname || "um jogador";
}

function femaleOf(steamId: string): boolean {
    const saved = getCharacter(steamId)?.appearance.gender;
    return (saved ?? shownOnline(steamId)?.appearance.gender) === "female";
}

function sinceText(at: number): string {
    if (!Number.isFinite(at) || at <= 0) {
        return "";
    }
    const date = new Date(at);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function titleOption(title: TitleDef): Record<string, unknown> {
    return { id: title.id, male: title.male, female: title.female, native: title.native ?? "", gloss: title.gloss, kind: title.kind, branch: title.branch, raises: raises(title), standing: standingOf(title), names: (title.appoints ?? []).length, level: levelOf(title) };
}

// ---------------------------------------------------------------------------------------------
// The block of the status payload.

/** Whom the viewer may name now: an administrator anybody here, a noble the people who have introduced themselves to them. */
export function candidatesFor(viewer: Player): Array<{ id: number; name: string }> {
    const admin = isAdmin(viewer);
    return Player.all()
        .filter((other) => other.id !== viewer.id && other.ready && other.steamId !== "" && (admin || knows(viewer, other)))
        .map((other) => ({ id: other.id, name: admin ? adminLabel(other) : nameOf(other) }));
}

/**
 * The towns a player may name for (2026-10-31, user: "nas nomeações ao nomear um jogador deve se escolher qual região você pode nomear; exemplo se o jogador é um nobre de Suchdol ele só pode
 * fazer nomeações e escolhe Suchdol"): a title is of a town ("Cavaleiro de Suchdol"), and whoever names names in the towns of the titles of theirs that name: the town the title is of, and, for
 * a seat, its lands. One who holds no title with a town (a title given before towns, and a holder with no citizenship) names in the town they are a citizen of; one with neither
 * names in none. An administrator names in every town.
 */
export function regionsFor(player: Player): string[] {
    if (isAdmin(player)) {
        return TOWNS.map((town) => town.id);
    }
    // The town of the highest of their titles that names comes first: it is the one chosen when none is.
    const mine = new Set<string>();
    const add = (id: string): void => {
        const town = townById(id);
        if (town === null) {
            return;
        }
        mine.add(town.id);
        for (const land of landsOf(town)) {
            mine.add(land.id);
        }
    };
    const naming = grantsOf(player.steamId)
        .filter((grant) => (titleById(grant.id)?.appoints ?? []).length > 0 && grant.region !== undefined && grant.region !== "")
        .sort((a, b) => order(titleById(a.id) as TitleDef) - order(titleById(b.id) as TitleDef));
    for (const grant of naming) {
        add(grant.region as string);
    }
    if (mine.size === 0 && hasNominationPower(titlesOf(player.steamId))) {
        const home = townOf(player.steamId);
        if (home !== null) {
            add(home.id);
        }
    }
    return [...mine];
}

/** What the section needs of one viewer; `visible` false is all a commoner is told. */
export function nobilityFor(viewer: Player): Record<string, unknown> {
    if (!canView(viewer)) {
        return { visible: false };
    }
    const admin = isAdmin(viewer);
    const held = titlesOf(viewer.steamId);
    // In this section everybody names as their character, an administrator too; the Crown's whole catalog is for the
    // Jogadores page (user, 2026-10-18 night: "quando um admin nomear pela seção Nomeação deve ir normal, e só quando nomear
    // pela seção Jogadores que vá pela Coroa").
    const options = appointable(held);
    // Each line says what the title is called for the one who holds it, so the page needs no catalog of its own.
    const named = holders().flatMap((holder) =>
        holder.steamId === viewer.steamId
            ? []
            : holder.grants
                  .filter((grant) => (admin ? grant.by === "admin" || grant.by === viewer.steamId : grant.by === viewer.steamId))
                  .map((grant) => {
                      const title = titleById(grant.id) as TitleDef;
                      return { key: keyOf(holder.steamId), name: nameFor(holder.steamId, holder.name), title: grant.id, label: labelWithRegion(title, femaleOf(holder.steamId), grant.region), kind: title.kind, branch: title.branch, at: sinceText(grant.at) };
                  }),
    );
    const female = isFemale(viewer);
    return {
        visible: true,
        admin,
        power: hasNominationPower(held),
        options: options.map(titleOption),
        // The towns this viewer may name for, to choose from when a title is given (2026-10-31).
        regions: regionsFor(viewer).map((id) => ({ id, name: townById(id)?.name ?? id })),
        ...(admin ? { crownOptions: TITLES.map(titleOption) } : {}),
        mine: grantsOf(viewer.steamId).map((grant) => mineLine(grant, female)).sort((a, b) => a.order - b.order),
        named,
        shown: shownOf(viewer.steamId),
    };
}

function mineLine(grant: Grant, female: boolean): { id: string; label: string; region: string; native: string; gloss: string; kind: string; branch: string; by: string; at: string; order: number } {
    const title = titleById(grant.id) as TitleDef;
    return { id: title.id, label: labelWithRegion(title, female, grant.region), region: grant.region ?? "", native: title.native ?? "", gloss: title.gloss, kind: title.kind, branch: title.branch, by: grant.by === "admin" ? "" : grant.byName, at: sinceText(grant.at), order: order(title) };
}

// ---------------------------------------------------------------------------------------------
// The hierarchy.

export interface HierarchyHolder {
    readonly key: string;
    readonly name: string;
    readonly self: boolean;
    /** Highest first; `byKey` is the holder who named it ("" for the Crown, or somebody who holds no title), for the tree. */
    readonly titles: ReadonlyArray<{ readonly id: string; readonly label: string; readonly by: string; readonly byKey: string; readonly crown: boolean; readonly at: string; readonly level: number; readonly reportsTo: readonly string[] }>;
    readonly statusId: string;
    readonly status: { readonly label: string; readonly gloss: string };
    readonly marital: { readonly label: string; readonly gloss: string };
    readonly surname: string | null;
    readonly guildId: string | null;
    /** The town they are a citizen of, or null. */
    readonly town: string | null;
    /** The same town's id, for the tree to set them under their own land (2026-10-29: the tree is read region by region). */
    readonly townId: string | null;
    readonly lands: ReadonlyArray<{ readonly region: string; readonly houses: number; readonly chests: number; readonly whole: boolean }>;
    /** Their living spouses, as the realm calls them beside them (a lord's wife is a Lady); the tree draws one who holds no title beside the holder's own card. */
    readonly consorts: readonly ConsortLine[];
    /** Whether the character's body is a woman's (the tree sets a couple by rank, then the husband first). */
    readonly female: boolean;
}

/** A spouse as a page is told of them: no Steam id, and the key of their own card when they hold a title themselves, so that the tree draws them once. */
export interface ConsortLine {
    readonly label: string;
    readonly name: string;
    readonly courtesy: boolean;
    readonly text: string;
    readonly key: string | null;
}

function consortLine(consort: Consort, holding: ReadonlySet<string>): ConsortLine {
    const id = typeof consort.steamId === "string" && consort.steamId !== "" ? consort.steamId : null;
    const name = (id === null ? null : plainName(id)) ?? consort.name;
    return { label: consort.label, name, courtesy: consort.courtesy, text: consort.courtesy ? `${consort.label} ${name}` : `${name} (${consort.label.toLowerCase()})`, key: id !== null && holding.has(id) ? keyOf(id) : null };
}

/**
 * The titles of the realm and who holds them, for a viewer who may see them. Only what a character is known by: see the
 * header of this file for what is left out on purpose.
 */
export function hierarchyFor(): Record<string, unknown> {
    const holding = new Set(holders().map((holder) => holder.steamId));
    const rows: HierarchyHolder[] = holders().map((holder) => {
        const female = femaleOf(holder.steamId);
        const grants = [...holder.grants].sort((a, b) => order(titleById(a.id) as TitleDef) - order(titleById(b.id) as TitleDef));
        const gender = female ? "female" : "male";
        const status = getSocialStatus(holder.steamId);
        return {
            key: keyOf(holder.steamId),
            name: nameFor(holder.steamId, holder.name),
            self: false,
            titles: grants.map((grant) => ({ id: grant.id, label: labelWithRegion(titleById(grant.id) as TitleDef, female, grant.region), region: grant.region ?? "", by: grant.by === "admin" ? "" : grant.byName, byKey: grant.by === "admin" ? "" : keyOf(grant.by), crown: grant.by === "admin", at: sinceText(grant.at), level: levelOf(titleById(grant.id) as TitleDef), reportsTo: (titleById(grant.id) as TitleDef).reportsTo ?? [] })),
            statusId: status,
            status: SOCIAL_STATUS[status],
            marital: maritalStatus(holder.steamId, gender),
            surname: getSurname(holder.steamId),
            guildId: getGuildId(holder.steamId),
            town: townOf(holder.steamId)?.name ?? null,
            townId: townOf(holder.steamId)?.id ?? null,
            lands: landSummary(holder.steamId),
            consorts: consortsOf(holder.steamId).slice(0, 2).map((consort) => consortLine(consort, holding)),
            female,
        };
    });
    const heldBy = new Map<string, string[]>();
    for (const holder of holders()) {
        for (const grant of holder.grants) {
            heldBy.set(grant.id, [...(heldBy.get(grant.id) ?? []), keyOf(holder.steamId)]);
        }
    }
    // The trades (2026-10-29: "recebe o título, exemplo caçador, e aparece na árvore hierárquica como caçador"): whoever has a guild and holds no title is a node of the tree of their own, a
    // tradesman, set under the land they are a citizen of.
    const trades = tradesmen()
        .filter((trade) => !holding.has(trade.steamId))
        .map((trade) => ({
            key: keyOf(trade.steamId),
            name: plainName(trade.steamId) ?? nameOfMember(trade.steamId),
            guildId: trade.guild,
            townId: trade.town,
            town: trade.town === null ? null : (townOf(trade.steamId)?.name ?? null),
            self: false,
        }));
    return {
        branches: BRANCHES.map((branch) => ({
            id: branch.id,
            label: branch.label,
            note: branch.note,
            titles: TITLES.filter((title) => title.branch === branch.id)
                .sort((a, b) => order(a) - order(b))
                .map((title) => ({ ...titleOption(title), tier: title.tier, unique: title.unique === true, holders: heldBy.get(title.id) ?? [] })),
        })),
        holders: rows,
        trades,
    };
}

/** The tradesmen of the realm as the hierarchy's tree hangs them: whoever has a guild, with the town they are a citizen of. */
function tradesmen(): Array<{ readonly steamId: string; readonly guild: string; readonly town: string | null }> {
    const found: Array<{ steamId: string; guild: string; town: string | null }> = [];
    for (const guild of GUILDS) {
        for (const steamId of listGuildMembers(guild.id)) {
            found.push({ steamId, guild: guild.id, town: townOf(steamId)?.id ?? null });
        }
    }
    return found;
}

/**
 * The hierarchy is asked for again every six seconds by each panel that shows it, and building it walks the lands of every title holder (34 ms a
 * time, 2026-10-25, perf-watch; 42-47 ms still on 2026-10-26, because five seconds was shorter than the six between two asks, so every ask rebuilt it): what is
 * half a minute old is as good for a tree that is read. A nomination or a revocation made here starts it over at once.
 */
export const HIERARCHY_KEPT_MS = 30_000;
let hierarchyKept: { at: number; tree: Record<string, unknown> } | null = null;

function hierarchyNow(now = Date.now()): Record<string, unknown> {
    if (hierarchyKept === null || now - hierarchyKept.at >= HIERARCHY_KEPT_MS) {
        hierarchyKept = { at: now, tree: hierarchyFor() };
    }
    return hierarchyKept.tree;
}

// ---------------------------------------------------------------------------------------------
// Making a noble, and unmaking one.

/** Raises the holder of a title to the standing it gives, and their family with them. The Steam ids of everybody who rose. */
function raise(steamId: string, standing: SocialStatus): string[] {
    const risen = lift(steamId, standing) ? [steamId] : [];
    for (const id of spreadStanding(steamId)) {
        if (!risen.includes(id)) {
            risen.push(id);
        }
    }
    return risen;
}

function online(steamId: string): Player | undefined {
    return Player.all().find((other) => other.steamId === steamId);
}

function nameOfSteamId(steamId: string): string {
    return nameFor(steamId, holders().find((holder) => holder.steamId === steamId)?.name ?? "");
}

// ---------------------------------------------------------------------------------------------
// Naming and taking away.

/**
 * `actor` names `target` to a title. Everything is checked here again: what the page offered decides nothing.
 * `asCrown`: an administrator naming from the Jogadores page, in the Crown's name and by its rules (anybody to anything). From
 * the Nomeação section an administrator names as their character, by its titles, as any noble does.
 */
export function nominate(actor: Player, target: Player | null, titleId: unknown, asCrown = false, regionId: unknown = ""): Outcome {
    if (!canUse(actor)) {
        return fail("Só um nobre pode nomear.");
    }
    if (target === null || target.steamId === "") {
        return fail("Esse jogador não está mais no servidor.");
    }
    if (typeof titleId !== "string") {
        return fail("Escolha um título.");
    }
    const staff = isAdmin(actor);
    const admin = staff && asCrown;
    if (!staff && !knows(actor, target)) {
        return fail("Você só pode nomear quem já se apresentou a você.");
    }
    const verdict = judgeNomination({ actorIsAdmin: admin, actorIsNoble: isNoble(actor.steamId), actorHeld: titlesOf(actor.steamId), sameActor: actor.id === target.id, titleId, nomineeHeld: titlesOf(target.steamId) });
    if (!verdict.ok) {
        return fail(staff && !admin ? `${verdict.reason} Em nome da Coroa, qualquer título se dá pela seção Jogadores (F3).` : verdict.reason);
    }
    const title = titleById(titleId) as TitleDef;
    // The town the title is of (2026-10-31): chosen among the towns this player may name for; the King's is of none.
    let region = "";
    if (levelOf(title) > 1) {
        const allowed = regionsFor(actor);
        region = typeof regionId === "string" ? regionId : "";
        if (region === "" && staff) {
            // An administrator who named none names for the town the nominee lives in.
            region = townOf(target.steamId)?.id ?? "";
        }
        if (region === "" && !staff) {
            // A noble who named none names for the town of their own title (the first of their towns).
            region = allowed[0] ?? "";
        }
        if (region === "" && !staff) {
            return fail(allowed.length === 0 ? "Você não tem terras para nomear: escolha a sua cidade na seção Cidadania." : "Escolha a região do título.");
        }
        // An administrator may give a title of no town (to somebody who is a citizen of none, and names none).
        if (region !== "" && !allowed.includes(region)) {
            return fail(`Você só nomeia nas terras do seu título: ${allowed.map((id) => townById(id)?.name ?? id).join(", ")}.`);
        }
    }
    const by = admin ? { steamId: "admin", name: CROWN } : { steamId: actor.steamId, name: nameOf(actor) };
    const granted = addTitle(target.steamId, target.nickname, title.id, by, region);
    const standing = standingOf(title);
    const risen = standing !== null ? raise(target.steamId, standing) : [];
    const now = getSocialStatus(target.steamId);
    applyNametag(target);

    const label = labelWithRegion(title, isFemale(target), region);
    const lines: string[] = [`${nameOf(target)} agora é ${label}.`];
    if (granted.replaced !== null) {
        const old = titleById(granted.replaced);
        lines.push(`O posto de ${old === null ? granted.replaced : labelOf(old, isFemale(target))} foi trocado por este.`);
    }
    if (risen.length > 0) {
        const others = risen.filter((id) => id !== target.steamId).map(nameOfSteamId);
        lines.push(risen.includes(target.steamId) ? `Agora é ${standingWord(now)}${others.length > 0 ? `, e a família com ele: ${others.join(", ")}` : ""}.` : `A família subiu com ele: ${others.join(", ")}.`);
    }
    if (granted.displaced !== null) {
        const gone = online(granted.displaced);
        if (gone !== undefined) {
            applyNametag(gone);
            notice(gone, `Você deixou de ser ${label}: o título passou a ${nameOf(target)}.`);
            sendSocial(gone);
        }
        lines.push(`${nameOfSteamId(granted.displaced)} deixou de ser ${label}.`);
    }
    console.log(`nominations: ${actor.nickname}${admin ? " (administrador, pela Coroa)" : staff ? " (administrador, como o personagem)" : ""} nomeou ${target.nickname} ${title.male}${risen.length > 0 ? `; subiram: ${risen.map((id) => `${nameOfSteamId(id)} (${getSocialStatus(id)})`).join(", ")}` : ""}`);

    if (target.id !== actor.id) {
        notice(target, `${admin ? "A Coroa" : nameOf(actor)} nomeou você ${label}. ${risen.includes(target.steamId) ? `Você agora é ${standingWord(now)}: veja a seção Nomeação do painel (F2). ` : ""}Em Opções você escolhe se o título aparece sobre a sua cabeça.`);
    }
    for (const id of risen) {
        const other = online(id);
        if (other !== undefined && other.id !== target.id && other.id !== actor.id) {
            notice(other, `${nameOf(target)} foi nomeado ${label}, e você agora é ${standingWord(getSocialStatus(id))}.`);
        }
    }
    for (const id of new Set([target.steamId, ...risen])) {
        const other = online(id);
        if (other !== undefined) {
            sendSocial(other);
        }
    }
    return { ok: true, message: lines.join(" ") };
}

/** `actor` takes a title off a holder -- their own, one they named, one under theirs -- by the page's key or an online player. */
export function revoke(actor: Player, holderSteamId: string | null, titleId: unknown): Outcome {
    if (holderSteamId === null || holderSteamId === "") {
        return fail("Esse jogador não tem esse título.");
    }
    if (typeof titleId !== "string") {
        return fail("Escolha um título.");
    }
    const own = holderSteamId === actor.steamId;
    if (!own && !canUse(actor)) {
        return fail("Só um nobre pode retirar um título.");
    }
    const held = grantsOf(holderSteamId);
    const grant = held.find((candidate) => candidate.id === titleId);
    const verdict = judgeRevocation({ actorIsAdmin: isAdmin(actor), actorHeld: titlesOf(actor.steamId), ownTitle: own, titleId, holderHeld: held.map((candidate) => candidate.id), namedByActor: grant !== undefined && grant.by === actor.steamId });
    if (!verdict.ok) {
        return fail(verdict.reason);
    }
    removeTitle(holderSteamId, titleId);
    const title = titleById(titleId) as TitleDef;
    const holder = online(holderSteamId);
    const female = femaleOf(holderSteamId);
    const label = labelWithRegion(title, female, grant?.region);
    if (holder !== undefined) {
        applyNametag(holder);
        if (!own) {
            notice(holder, `O título de ${label} foi retirado de você.`);
        }
        sendSocial(holder);
    }
    console.log(`nominations: ${actor.nickname} retirou ${label} de ${nameOfSteamId(holderSteamId)}`);
    return { ok: true, message: own ? `Você deixou o título de ${label}.` : `${nameOfSteamId(holderSteamId)} não é mais ${label}.` };
}

/** The title a player wears over their head, or none. Their own, and only one they hold. */
export function chooseShown(player: Player, titleId: unknown): Outcome {
    if (titleId === "" || titleId === null) {
        setShown(player.steamId, null);
        applyNametag(player);
        return { ok: true, message: "Nenhum título sobre a sua cabeça." };
    }
    if (typeof titleId !== "string" || !setShown(player.steamId, titleId)) {
        return fail("Você não tem esse título.");
    }
    applyNametag(player);
    const title = titleById(titleId) as TitleDef;
    return { ok: true, message: `${labelWithRegion(title, isFemale(player), regionOfTitle(player.steamId, title.id))} aparece sobre a sua cabeça.` };
}

/** A noble who is a commoner now is no longer a lord, a knight or a prelate: the titles of the blood and of the Church go. */
export function demoted(steamId: string): string[] {
    const gone = removeWhere(steamId, (title) => raises(title));
    const holder = online(steamId);
    if (gone.length > 0 && holder !== undefined) {
        applyNametag(holder);
        notice(holder, `Você deixou de ser nobre: ${summarize(gone, isFemale(holder))} ${gone.length === 1 ? "foi retirado" : "foram retirados"}. Os cargos continuam.`);
    }
    return gone;
}

// ---------------------------------------------------------------------------------------------

/**
 * A title of the blood or of the high Church on a commoner contradicts the rules (it makes its holder noble). The
 * free-text titles of before were turned into the catalog's without that, so one could be left so: put right at start.
 * The holder alone rises; a nomination is what takes the family along.
 */
export function settleStanding(): string[] {
    const risen: string[] = [];
    for (const holder of holders()) {
        let best: SocialStatus | null = null;
        for (const grant of holder.grants) {
            const title = titleById(grant.id);
            const standing = title === null ? null : standingOf(title);
            if (standing !== null && (best === null || RANK[standing] > RANK[best])) {
                best = standing;
            }
        }
        if (best !== null && lift(holder.steamId, best)) {
            risen.push(holder.name || holder.steamId);
        }
    }
    return risen;
}

export function installNominations(): void {
    // The nav needs to know whether the section is the player's; the section itself carries the rest only while it is open (`status.ts`, `SECTION_NEEDS`).
    addPayload((player) => ({ nobility: { visible: canView(player) } }));
    addLazyPayload("nobility", (player) => ({ nobility: nobilityFor(player) }));
    const settled = settleStanding();
    if (settled.length > 0) {
        console.log(`nominations: ${settled.length} titular(es) de título de nobreza era(m) plebeu(s) e agora é(são) nobre(s): ${settled.join(", ")}`);
    }
    // Whom a noble may name is asked for a page at a time, by what they type (`status.roster`, list "nom"): the people who meet meanwhile are in it.
    setNominees((player) => (canUse(player) ? candidatesFor(player) : []));
    onStatusChange((steamId, status) => {
        if (status === "plebeius") {
            demoted(steamId);
        }
    });
    // A player who joins a noble's family takes its standing (the noble may be either side of the link).
    familyLinked.push((owner, member) => {
        const risen = [...spreadStanding(owner), ...spreadStanding(member)];
        for (const id of new Set(risen)) {
            const other = online(id);
            console.log(`nominations: ${nameOfSteamId(id)} entrou numa família nobre e agora é ${standingWord(getSocialStatus(id))}`);
            if (other !== undefined) {
                notice(other, `Você entrou numa família nobre e agora é ${standingWord(getSocialStatus(id))}.`);
                sendSocial(other);
            }
        }
    });

    // A title holder's name, for the hierarchy to list them while they are away; and their nametag, which the title shows.
    Events.on("playerSpawned", (player) => {
        noteName(player.steamId, player.nickname);
    });

    Events.onClient(`${RESOURCE}:status.nominate`, (sender, payload) => {
        const actor = sender as Player;
        const id = fieldsOf(payload)["targetId"];
        const target = typeof id === "number" && Number.isInteger(id) ? Player.getById(id) : null;
        // The Jogadores page says it names for the Crown; the Nomeação section says nothing.
        const result = nominate(actor, target, fieldsOf(payload)["title"], fieldsOf(payload)["via"] === "coroa", fieldsOf(payload)["region"]);
        hierarchyKept = null;
        notice(actor, result.message);
        sendSocial(actor);
        if (result.ok && isAdmin(actor)) {
            sendRoster(actor);
        }
    });

    Events.onClient(`${RESOURCE}:status.revokeTitle`, (sender, payload) => {
        const actor = sender as Player;
        const fields = fieldsOf(payload);
        let holder: string | null = null;
        if (fields["self"] === 1) {
            holder = actor.steamId;
        } else if (typeof fields["targetId"] === "number" && Number.isInteger(fields["targetId"])) {
            holder = Player.getById(fields["targetId"] as number)?.steamId ?? null;
        } else {
            holder = holderByKey(fields["key"]);
        }
        const result = revoke(actor, holder, fields["title"]);
        hierarchyKept = null;
        notice(actor, result.message);
        sendSocial(actor);
        if (result.ok && isAdmin(actor)) {
            sendRoster(actor);
        }
    });

    Events.onClient(`${RESOURCE}:status.shownTitle`, (sender, payload) => {
        const player = sender as Player;
        const result = chooseShown(player, fieldsOf(payload)["title"]);
        notice(player, result.message);
        sendSocial(player);
    });

    Events.onClient(`${RESOURCE}:status.hierarchy`, (sender) => {
        const viewer = sender as Player;
        if (!canView(viewer)) {
            return;
        }
        const tree = hierarchyNow();
        const mine = keyOf(viewer.steamId);
        const marked = (tree["holders"] as HierarchyHolder[]).map((holder) => (holder.key === mine ? { ...holder, self: true } : holder));
        const trades = ((tree["trades"] ?? []) as Array<{ key: string }>).map((trade) => (trade.key === mine ? { ...trade, self: true } : trade));
        emitLarge(viewer, "status.hierarchy", JSON.stringify({ ...tree, holders: marked, trades }));
    });

    console.log(`nominations: ${TITLES.length} título(s) no catálogo, em ${BRANCHES.length} ramos; a seção Nomeação é de nobres e do administrador`);
}
