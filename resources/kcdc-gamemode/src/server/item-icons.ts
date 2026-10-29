/**
 * Which of the game's icons each item class has (`data/item-icons.json`, by `tools/make-item-icons.py`), for the pages that show a
 * player's own items: the trade between players. The game draws the icon itself (`src/client/craft-icons.ts`). Server-side data.
 */

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

let icons: Record<string, string> | null = null;

function load(): Record<string, string> {
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/item-icons.json` : "", "resources/kcdc-gamemode/data/item-icons.json", "data/item-icons.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                return parsed as Record<string, string>;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("item-icons: data/item-icons.json não foi encontrado; os itens aparecem sem ícone");
    return {};
}

/** The icon id of an item class (its GUID), or "". */
export function iconOf(itemGuid: string): string {
    if (icons === null) {
        icons = load();
    }
    const key = itemGuid.toLowerCase();
    // The tables write a GUID with its dashes; a class read off the world may come as the 32 digits alone.
    const dashed = /^[0-9a-f]{32}$/.test(key) ? `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20)}` : key;
    return icons[dashed] ?? "";
}
