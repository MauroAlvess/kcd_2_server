/**
 * The title images of the trades' page ("COZINHAR", "FERREIRO", ...), sent with the page when it opens (`craft-menu.ts`).
 *
 * They do not travel in the client package, which every player downloads on joining and which has a few KB to spare (a package
 * past about half a megabyte never finishes downloading): they stay on the server, in `data/craft-titles.json`, made by
 * `tools/make-ui-images.py` from the user's art, as data URLs the page puts in its title. A trade with none shows its name in text.
 */

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

let titles: Record<string, string> | null = null;

function load(): Record<string, string> {
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/craft-titles.json` : "", "resources/kcdc-gamemode/data/craft-titles.json", "data/craft-titles.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                const found: Record<string, string> = {};
                for (const [station, url] of Object.entries(parsed as Record<string, unknown>)) {
                    if (typeof url === "string" && url.startsWith("data:image/")) {
                        found[station] = url;
                    }
                }
                console.log(`craft: títulos das páginas de ofício: ${Object.keys(found).join(", ") || "nenhum"}`);
                return found;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("craft: data/craft-titles.json não foi encontrado; as páginas de ofício mostram o nome em texto");
    return {};
}

/** The title image of a trade's page, as a data URL, or "" for none. */
export function craftTitle(station: string): string {
    if (titles === null) {
        titles = load();
    }
    return titles[station] ?? "";
}
