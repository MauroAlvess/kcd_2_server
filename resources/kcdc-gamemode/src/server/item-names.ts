/**
 * What the game calls an item, in Portuguese, for lists the server writes itself (the trade view in the dialogue list).
 *
 * The server has the class GUID and the table name of an item but not the text the game shows, so the names are taken
 * from the game's own Portuguese tables once, by `tools/make-item-names.py`, into `data/item-names.json`. That file stays
 * on the server: it is not part of what clients download.
 */

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

const QUALITY = ["", "", " (qualidade II)", " (qualidade III)", " (qualidade IV)"];

let names: Record<string, string> | null = null;

function load(): Record<string, string> {
    if (names !== null) {
        return names;
    }
    names = {};
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/item-names.json` : "", "resources/kcdc-gamemode/data/item-names.json", "data/item-names.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                names = parsed as Record<string, string>;
                return names;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("item-names: data/item-names.json não foi encontrado; os itens aparecem pelo nome da tabela");
    return names;
}

/** The name a player reads for a row: a custom item's own name, the game's name, or the table name at worst. */
export function itemName(row: { readonly item: string; readonly name?: string; readonly metadata?: Readonly<Record<string, unknown>> }): string {
    const custom = row.metadata?.["custom"];
    if (typeof custom === "object" && custom !== null && typeof (custom as { name?: unknown }).name === "string") {
        return (custom as { name: string }).name;
    }
    const quality = row.metadata?.["quality"];
    const tier = typeof quality === "number" ? (QUALITY[quality] ?? "") : "";
    return (load()[row.item.toLowerCase()] ?? (row.name || "item")) + tier;
}

/** "2x Pão", or "Adaga" for one. */
export function itemLine(row: { readonly item: string; readonly amount: number; readonly name?: string; readonly metadata?: Readonly<Record<string, unknown>> }): string {
    return row.amount > 1 ? `${row.amount}x ${itemName(row)}` : itemName(row);
}
