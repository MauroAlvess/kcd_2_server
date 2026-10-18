/**
 * The panel's player lists, a page at a time. A server of 500 players cannot send every player to every open panel every
 * few seconds (the list of an administrator carries some twenty fields for each), nor draw them in one dropdown: each
 * list asks for the page it shows, with what was typed in its search box and the filter chosen, and is answered with
 * that page and how many there are. This file is the part that needs no game: reading a request and cutting a page.
 *
 * Three lists ask: the administrator's "Jogadores" page (`list`), the "who receives" and "is this relative a player"
 * pickers (`pick`), and the picker of whom a noble may name (`nom`).
 */

export type RosterTag = "list" | "pick" | "nom";
export type RosterFilter = "all" | "admin" | "patron" | "noble" | "noguild";

export interface RosterQuery {
    readonly tag: RosterTag;
    readonly q: string;
    readonly page: number;
    readonly filter: RosterFilter;
}

/** How many lines of each list one answer carries. */
export const PAGE_SIZE: Readonly<Record<RosterTag, number>> = { list: 12, pick: 8, nom: 8 };

/** The longest search text taken. */
export const SEARCH_MAX = 40;

export const FILTERS: readonly RosterFilter[] = ["all", "admin", "patron", "noble", "noguild"];

export const DEFAULT_QUERY: RosterQuery = { tag: "list", q: "", page: 0, filter: "all" };

/** What a page event asked for; anything missing or not what it should be is the default, never an error. */
export function parseQuery(fields: Record<string, unknown>): RosterQuery {
    const tag = fields["tag"] === "pick" || fields["tag"] === "nom" ? fields["tag"] : "list";
    const q = typeof fields["q"] === "string" ? fields["q"].replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX) : "";
    const page = typeof fields["page"] === "number" && Number.isInteger(fields["page"]) && fields["page"] >= 0 ? fields["page"] : 0;
    const filter = FILTERS.find((name) => name === fields["filter"]) ?? "all";
    return { tag, q, page, filter };
}

/** Lower case with the accents taken off, so "jose" finds "José". */
export function fold(text: string): string {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Whether a line answers a search: every word typed is in the name, or the text is the number of the player ("12" or "#12"). */
export function matches(q: string, id: number, label: string): boolean {
    const words = fold(q).split(" ").filter((word) => word !== "");
    if (words.length === 0) {
        return true;
    }
    const name = fold(label);
    if (words.length === 1 && /^#?\d+$/.test(words[0] as string)) {
        return String(id) === (words[0] as string).replace("#", "") || name.includes(words[0] as string);
    }
    return words.every((word) => name.includes(word));
}

export interface Paged<T> {
    readonly rows: T[];
    readonly page: number;
    readonly pages: number;
    readonly total: number;
}

/** One page of `rows`; a page past the end is the last one. */
export function paginate<T>(rows: readonly T[], page: number, size: number): Paged<T> {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const at = Math.min(Math.max(0, page), pages - 1);
    return { rows: rows.slice(at * size, (at + 1) * size), page: at, pages, total: rows.length };
}

/** Names in the order a reader looks for them: letters, then numbers as numbers. */
export function byName(a: string, b: string): number {
    return a.localeCompare(b, "pt", { numeric: true, sensitivity: "base" });
}
