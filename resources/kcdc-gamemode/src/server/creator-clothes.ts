/**
 * The plain clothes a new character chooses in the creator's "Roupas" tab (user, 2026-10-18: "a aba roupas, onde o jogador pode
 * trocar a parte de cima, as botas e as calças, escolhendo algumas iniciais das básicas, mostrando o ícone"). By gender and part,
 * from `data/creator-clothes.json` (made by `tools/make-creator-clothes.py`, with the game's own icons as data URLs): the page is
 * sent the names and icons, and answers with the place of each piece in its list, which the server turns back into the item.
 */

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

export type ClothesPart = "top" | "legs" | "feet";
export const CLOTHES_PARTS: readonly ClothesPart[] = ["top", "legs", "feet"];

export interface Piece {
    readonly item: string;
    readonly name: string;
    readonly icon: string;
}

export type ClothesCatalog = Record<"male" | "female", Record<ClothesPart, Piece[]>>;

let catalog: ClothesCatalog | null = null;

function empty(): ClothesCatalog {
    return { male: { top: [], legs: [], feet: [] }, female: { top: [], legs: [], feet: [] } };
}

function load(): ClothesCatalog {
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/creator-clothes.json` : "", "resources/kcdc-gamemode/data/creator-clothes.json", "data/creator-clothes.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as Record<string, Record<string, unknown>>;
            const found = empty();
            for (const gender of ["male", "female"] as const) {
                for (const part of CLOTHES_PARTS) {
                    const list = parsed[gender]?.[part];
                    if (Array.isArray(list)) {
                        found[gender][part] = list.filter(
                            (piece): piece is Piece => typeof piece === "object" && piece !== null && typeof piece.item === "string" && typeof piece.name === "string" && typeof piece.icon === "string",
                        );
                    }
                }
            }
            return found;
        } catch {
            // Not here; the next place.
        }
    }
    console.log("creator-clothes: data/creator-clothes.json não foi encontrado; o criador fica sem a aba Roupas");
    return empty();
}

export function clothesCatalog(): ClothesCatalog {
    if (catalog === null) {
        catalog = load();
    }
    return catalog;
}

/** Whether there is anything to choose. */
export function hasClothes(): boolean {
    const all = clothesCatalog();
    return CLOTHES_PARTS.some((part) => all.male[part].length > 0 || all.female[part].length > 0);
}

/** What the page is sent: names and icons, no item codes; `got` for a piece this character was already given (`given`). */
export function pageClothes(given: ReadonlySet<string> = new Set()): Record<string, Record<string, Array<{ name: string; icon: string; got?: true }>>> {
    const all = clothesCatalog();
    const out: Record<string, Record<string, Array<{ name: string; icon: string; got?: true }>>> = {};
    for (const gender of ["male", "female"] as const) {
        out[gender] = {};
        for (const part of CLOTHES_PARTS) {
            out[gender]![part] = all[gender][part].map((piece) => (given.has(piece.item) ? { name: piece.name, icon: piece.icon, got: true as const } : { name: piece.name, icon: piece.icon }));
        }
    }
    return out;
}

/** The items a page's picks stand for: one per part whose number is in its list; a part left out or out of range is none. */
export function piecesFor(gender: "male" | "female", picks: Partial<Record<ClothesPart, unknown>>): string[] {
    const all = clothesCatalog()[gender];
    const items: string[] = [];
    for (const part of CLOTHES_PARTS) {
        const index = picks[part];
        const piece = typeof index === "number" && Number.isInteger(index) ? all[part][index] : undefined;
        if (piece !== undefined) {
            items.push(piece.item);
        }
    }
    return items;
}
