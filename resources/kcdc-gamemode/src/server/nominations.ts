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
import { familyHeirs, getSurname, maritalStatus } from "./family.js";
import { appointable, BRANCHES, hasNominationPower, judgeNomination, judgeRevocation, labelOf, levelOf, order, raises, summarize, titleById, TITLES } from "./nobility.js";
import type { TitleDef } from "./nobility.js";
import { landSummary } from "./properties.js";
import { addPayload, getFactionId, getGuildId, getSocialStatus, notice, onStatusChange, sendRoster, sendSocial, setNominees, setSocialStatus, SOCIAL_STATUS } from "./status.js";
import { addTitle, applyNametag, grantsOf, holders, isFemale, noteName, removeTitle, removeWhere, setShown, shownOf, titlesOf } from "./titles.js";
import type { Grant } from "./titles.js";

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

export function isNoble(steamId: string): boolean {
    return steamId !== "" && getSocialStatus(steamId) === "nobilis";
}

/** The section is for a noble, and for an administrator, who names as the Crown. */
export function canUse(player: Player): boolean {
    return isAdmin(player) || isNoble(player.steamId);
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

/** A holder as the hierarchy calls them: the name they had when last seen, and the family's surname when they have one. */
function nameFor(steamId: string, stored: string): string {
    const online = Player.all().find((other) => other.steamId === steamId);
    if (online !== undefined) {
        return nameOf(online);
    }
    const surname = getSurname(steamId);
    const nickname = stored !== "" ? stored : (getCharacter(steamId)?.nickname ?? "");
    return surname ? `${nickname} ${surname}`.trim() : nickname || "um jogador";
}

function femaleOf(steamId: string): boolean {
    const online = Player.all().find((other) => other.steamId === steamId);
    return (getCharacter(steamId)?.appearance.gender ?? online?.appearance.gender) === "female";
}

function sinceText(at: number): string {
    if (!Number.isFinite(at) || at <= 0) {
        return "";
    }
    const date = new Date(at);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function titleOption(title: TitleDef): Record<string, unknown> {
    return { id: title.id, male: title.male, female: title.female, native: title.native ?? "", gloss: title.gloss, kind: title.kind, branch: title.branch, raises: raises(title), names: (title.appoints ?? []).length };
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

/** What the section needs of one viewer; `visible` false is all a commoner is told. */
export function nobilityFor(viewer: Player): Record<string, unknown> {
    if (!canUse(viewer)) {
        return { visible: false };
    }
    const admin = isAdmin(viewer);
    const held = titlesOf(viewer.steamId);
    const options = admin ? TITLES : appointable(held);
    // Each line says what the title is called for the one who holds it, so the page needs no catalog of its own.
    const named = holders().flatMap((holder) =>
        holder.steamId === viewer.steamId
            ? []
            : holder.grants
                  .filter((grant) => (admin ? grant.by === "admin" || grant.by === viewer.steamId : grant.by === viewer.steamId))
                  .map((grant) => {
                      const title = titleById(grant.id) as TitleDef;
                      return { key: keyOf(holder.steamId), name: nameFor(holder.steamId, holder.name), title: grant.id, label: labelOf(title, femaleOf(holder.steamId)), kind: title.kind, branch: title.branch, at: sinceText(grant.at) };
                  }),
    );
    const female = isFemale(viewer);
    return {
        visible: true,
        admin,
        power: admin || hasNominationPower(held),
        options: options.map(titleOption),
        mine: grantsOf(viewer.steamId).map((grant) => mineLine(grant, female)).sort((a, b) => a.order - b.order),
        named,
        shown: shownOf(viewer.steamId),
    };
}

function mineLine(grant: Grant, female: boolean): { id: string; label: string; native: string; gloss: string; kind: string; branch: string; by: string; at: string; order: number } {
    const title = titleById(grant.id) as TitleDef;
    return { id: title.id, label: labelOf(title, female), native: title.native ?? "", gloss: title.gloss, kind: title.kind, branch: title.branch, by: grant.by === "admin" ? "" : grant.byName, at: sinceText(grant.at), order: order(title) };
}

// ---------------------------------------------------------------------------------------------
// The hierarchy.

export interface HierarchyHolder {
    readonly key: string;
    readonly name: string;
    readonly self: boolean;
    /** Highest first; `byKey` is the holder who named it ("" for the Crown, or somebody who holds no title), for the tree. */
    readonly titles: ReadonlyArray<{ readonly id: string; readonly label: string; readonly by: string; readonly byKey: string; readonly crown: boolean; readonly at: string; readonly level: number }>;
    readonly statusId: string;
    readonly status: { readonly label: string; readonly gloss: string };
    readonly marital: { readonly label: string; readonly gloss: string };
    readonly surname: string | null;
    readonly guildId: string | null;
    readonly factionId: string | null;
    readonly lands: ReadonlyArray<{ readonly region: string; readonly houses: number; readonly chests: number; readonly whole: boolean }>;
}

/**
 * The titles of the realm and who holds them, for a viewer who may see them. Only what a character is known by: see the
 * header of this file for what is left out on purpose.
 */
export function hierarchyFor(): Record<string, unknown> {
    const rows: HierarchyHolder[] = holders().map((holder) => {
        const female = femaleOf(holder.steamId);
        const grants = [...holder.grants].sort((a, b) => order(titleById(a.id) as TitleDef) - order(titleById(b.id) as TitleDef));
        const gender = female ? "female" : "male";
        const status = getSocialStatus(holder.steamId);
        return {
            key: keyOf(holder.steamId),
            name: nameFor(holder.steamId, holder.name),
            self: false,
            titles: grants.map((grant) => ({ id: grant.id, label: labelOf(titleById(grant.id) as TitleDef, female), by: grant.by === "admin" ? "" : grant.byName, byKey: grant.by === "admin" ? "" : keyOf(grant.by), crown: grant.by === "admin", at: sinceText(grant.at), level: levelOf(titleById(grant.id) as TitleDef) })),
            statusId: status,
            status: SOCIAL_STATUS[status],
            marital: maritalStatus(holder.steamId, gender),
            surname: getSurname(holder.steamId),
            guildId: getGuildId(holder.steamId),
            factionId: getFactionId(holder.steamId),
            lands: landSummary(holder.steamId),
        };
    });
    const heldBy = new Map<string, string[]>();
    for (const holder of holders()) {
        for (const grant of holder.grants) {
            heldBy.set(grant.id, [...(heldBy.get(grant.id) ?? []), keyOf(holder.steamId)]);
        }
    }
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
    };
}

// ---------------------------------------------------------------------------------------------
// Making a noble, and unmaking one.

/** Raises a commoner to noble, with their spouse and their legitimate line. The names of everybody who rose. */
function raise(steamId: string): string[] {
    const risen: string[] = [];
    for (const id of [steamId, ...familyHeirs(steamId).map((heir) => heir.steamId)]) {
        if (id !== "" && getSocialStatus(id) !== "nobilis") {
            setSocialStatus(id, "nobilis");
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

/** `actor` names `target` to a title. Everything is checked here again: what the page offered decides nothing. */
export function nominate(actor: Player, target: Player | null, titleId: unknown): Outcome {
    if (!canUse(actor)) {
        return fail("Só um nobre pode nomear.");
    }
    if (target === null || target.steamId === "") {
        return fail("Esse jogador não está mais no servidor.");
    }
    if (typeof titleId !== "string") {
        return fail("Escolha um título.");
    }
    const admin = isAdmin(actor);
    if (!admin && !knows(actor, target)) {
        return fail("Você só pode nomear quem já se apresentou a você.");
    }
    const verdict = judgeNomination({ actorIsAdmin: admin, actorIsNoble: isNoble(actor.steamId), actorHeld: titlesOf(actor.steamId), sameActor: actor.id === target.id, titleId, nomineeHeld: titlesOf(target.steamId) });
    if (!verdict.ok) {
        return fail(verdict.reason);
    }
    const title = titleById(titleId) as TitleDef;
    const by = admin ? { steamId: "admin", name: CROWN } : { steamId: actor.steamId, name: nameOf(actor) };
    const granted = addTitle(target.steamId, target.nickname, title.id, by);
    const risen = raises(title) ? raise(target.steamId) : [];
    applyNametag(target);

    const label = labelOf(title, isFemale(target));
    const lines: string[] = [`${nameOf(target)} agora é ${label}.`];
    if (granted.replaced !== null) {
        const old = titleById(granted.replaced);
        lines.push(`O posto de ${old === null ? granted.replaced : labelOf(old, isFemale(target))} foi trocado por este.`);
    }
    if (risen.length > 0) {
        const others = risen.filter((id) => id !== target.steamId).map(nameOfSteamId);
        lines.push(risen.includes(target.steamId) ? `Foi elevado a nobre${others.length > 0 ? `, com ${others.join(", ")}` : ""}.` : `${others.join(", ")} subiu a nobre com ele.`);
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
    console.log(`nominations: ${actor.nickname}${admin ? " (administrador)" : ""} nomeou ${target.nickname} ${title.male}${risen.length > 0 ? `; subiram a nobre: ${risen.map(nameOfSteamId).join(", ")}` : ""}`);

    if (target.id !== actor.id) {
        notice(target, `${admin ? "A Coroa" : nameOf(actor)} nomeou você ${label}. ${raises(title) && risen.includes(target.steamId) ? "Você agora é nobre: veja a seção Nomeação do painel (F2). " : ""}Em Opções você escolhe se o título aparece sobre a sua cabeça.`);
    }
    for (const id of risen) {
        const other = online(id);
        if (other !== undefined && other.id !== target.id && other.id !== actor.id) {
            notice(other, `${nameOf(target)} foi nomeado ${label}, e você subiu a nobre com ele.`);
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
    const label = labelOf(title, female);
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
    return { ok: true, message: `${labelOf(title, isFemale(player))} aparece sobre a sua cabeça.` };
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
        if (holder.grants.some((grant) => { const title = titleById(grant.id); return title !== null && raises(title); }) && getSocialStatus(holder.steamId) !== "nobilis") {
            setSocialStatus(holder.steamId, "nobilis");
            risen.push(holder.name || holder.steamId);
        }
    }
    return risen;
}

export function installNominations(): void {
    addPayload((player) => ({ nobility: nobilityFor(player) }));
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

    // A title holder's name, for the hierarchy to list them while they are away; and their nametag, which the title shows.
    Events.on("playerSpawned", (player) => {
        noteName(player.steamId, player.nickname);
    });

    Events.onClient(`${RESOURCE}:status.nominate`, (sender, payload) => {
        const actor = sender as Player;
        const id = fieldsOf(payload)["targetId"];
        const target = typeof id === "number" && Number.isInteger(id) ? Player.getById(id) : null;
        const result = nominate(actor, target, fieldsOf(payload)["title"]);
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
        if (!canUse(viewer)) {
            return;
        }
        const tree = hierarchyFor();
        const mine = keyOf(viewer.steamId);
        const marked = (tree["holders"] as HierarchyHolder[]).map((holder) => (holder.key === mine ? { ...holder, self: true } : holder));
        viewer.emit(`${RESOURCE}:status.hierarchy`, JSON.stringify({ ...tree, holders: marked }));
    });

    console.log(`nominations: ${TITLES.length} título(s) no catálogo, em ${BRANCHES.length} ramos; a seção Nomeação é de nobres e do administrador`);
}
