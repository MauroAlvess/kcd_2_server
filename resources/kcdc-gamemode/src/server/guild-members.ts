/**
 * Who is in a guild, for the "Ver membros" button of the Guildas page, which only administrators have (2026-10-26): the members in the order of
 * the realm's hierarchy, a page at a time (a guild may grow to hundreds, and the page is never sent more than one page of them).
 *
 * The order is the one the hierarchy reads in (`nobility.ts`): whoever holds the highest title first (branch, then tier),
 * then the nobles with no title, then the commoners, each group by name. Every line says what a character is known by --
 * a name, the titles held, the standing -- and nothing about the person behind it: no place, no vitals, no online
 * status, no Steam id. A name is shown to the members of the same guild (brothers of a guild know one another), to whoever
 * was introduced to its owner (`acquaintances.ts`) and to an administrator; to anybody else a member is "Desconhecido".
 */

import { knowsSteam } from "./acquaintances.js";
import { isAdmin } from "./auth.js";
import { fullName } from "./character-name.js";
import { getCharacter } from "./characters.js";
import { getSurname } from "./family.js";
import { known, labelOf, order } from "./nobility.js";
import { getGuildId, getSocialStatus, GUILDS, listGuildMembers } from "./status.js";
import type { SocialStatus } from "./status.js";

/** Nobles first, then the lesser nobles, then the commoners. */
const STANDING_RANK: Readonly<Record<SocialStatus, number>> = { nobilis: 0, minor: 1, plebeius: 2 };
import { titlesOf } from "./titles.js";

const RESOURCE = "kcdc-gamemode";

/** Members per page. */
export const PAGE_SIZE = 10;

export interface MemberLine {
    readonly name: string;
    /** The titles held, highest first, "Lorde · Burgrave"; empty for none. */
    readonly titles: string;
    readonly standing: SocialStatus;
    readonly you: boolean;
}

export interface GuildRoster {
    readonly guildId: string;
    readonly total: number;
    readonly page: number;
    readonly pages: number;
    /** How many members come before this page: the first line of the page is the one after. */
    readonly first: number;
    readonly members: readonly MemberLine[];
}

export interface Ranked {
    readonly steamId: string;
    /** Where the highest title stands in the hierarchy's reading order; Infinity for none. */
    readonly top: number;
    readonly standing: SocialStatus;
    readonly name: string;
}

/** What a member is called: the character's name and the family's surname, or the account's nickname for a character made before names. */
export function nameOfMember(steamId: string): string {
    const saved = getCharacter(steamId);
    const first = saved?.name ? fullName(saved.name, saved.epithet) : (saved?.nickname ?? "um jogador");
    const surname = getSurname(steamId);
    return surname ? `${first} ${surname}` : first;
}

function femaleMember(steamId: string): boolean {
    return getCharacter(steamId)?.appearance.gender === "female";
}

function rank(steamId: string): Ranked {
    const titles = known(titlesOf(steamId));
    return {
        steamId,
        top: titles.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...titles.map((title) => order(title))),
        standing: getSocialStatus(steamId),
        name: nameOfMember(steamId),
    };
}

/** The hierarchy's order between two members. */
export function byHierarchy(a: Ranked, b: Ranked): number {
    if (a.top !== b.top) {
        return a.top < b.top ? -1 : 1;
    }
    if (a.standing !== b.standing) {
        return STANDING_RANK[a.standing] - STANDING_RANK[b.standing];
    }
    return a.name.localeCompare(b.name, "pt", { numeric: true });
}

/** One page of a guild's members, as `viewer` may read them. Null for a guild the catalog does not have. */
export function rosterOf(viewer: Player, guildId: string, wanted: number): GuildRoster | null {
    if (!GUILDS.some((guild) => guild.id === guildId)) {
        return null;
    }
    const everybody = listGuildMembers(guildId).map(rank).sort(byHierarchy);
    const pages = Math.max(1, Math.ceil(everybody.length / PAGE_SIZE));
    const page = Number.isInteger(wanted) ? Math.min(Math.max(wanted, 0), pages - 1) : 0;
    const sameGuild = viewer.steamId !== "" && getGuildId(viewer.steamId) === guildId;
    const admin = isAdmin(viewer);
    const members = everybody.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((member): MemberLine => {
        const female = femaleMember(member.steamId);
        const titles = known(titlesOf(member.steamId))
            .sort((a, b) => order(a) - order(b))
            .map((title) => labelOf(title, female))
            .join(" · ");
        const seen = admin || sameGuild || knowsSteam(viewer.steamId, member.steamId);
        return { name: seen ? member.name : female ? "Desconhecida" : "Desconhecido", titles, standing: member.standing, you: viewer.steamId !== "" && member.steamId === viewer.steamId };
    });
    return { guildId, total: everybody.length, page, pages, first: page * PAGE_SIZE, members };
}

export function installGuildMembers(): void {
    Events.onClient(`${RESOURCE}:status.guildMembers`, (sender, payload) => {
        const viewer = sender as Player;
        // The list is the administrators' alone (user, 2026-10-26: "o botão ver membros só pode ficar disponível para os admins"): the page hides the button
        // for everybody else, and the server answers nobody else who asks all the same.
        if (!isAdmin(viewer)) {
            return;
        }
        let fields: Record<string, unknown> = {};
        try {
            const value = typeof payload === "string" && payload.length <= 256 ? (JSON.parse(payload) as unknown) : payload;
            fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
        } catch {
            return;
        }
        const guildId = fields["guildId"];
        const roster = typeof guildId === "string" ? rosterOf(viewer, guildId, typeof fields["page"] === "number" ? fields["page"] : 0) : null;
        if (roster !== null) {
            viewer.emit(`${RESOURCE}:status.guildMembers`, JSON.stringify(roster));
        }
    });
}
