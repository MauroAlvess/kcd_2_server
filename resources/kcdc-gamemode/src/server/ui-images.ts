/**
 * Pictures a page needs only when one of its sections is open, sent by the server when it is (2026-10-18): the client package
 * every player downloads on joining had a few KB to spare, and the Apoiador painting alone was 40 KB of it. They are data URLs in
 * `data/ui-images.json` (made by `tools/make-ui-images.py`), asked for by name (`status.image`) and sent in pieces (`big-emit.ts`).
 */

import { emitLarge } from "./big-emit.js";

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

const RESOURCE = "kcdc-gamemode";

/** The same picture to the same player at most this often: the page keeps what it got. */
const AGAIN_MS = 10_000;

let images: Record<string, string> | null = null;

function load(): Record<string, string> {
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/ui-images.json` : "", "resources/kcdc-gamemode/data/ui-images.json", "data/ui-images.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                const found: Record<string, string> = {};
                for (const [name, url] of Object.entries(parsed as Record<string, unknown>)) {
                    if (typeof url === "string" && url.startsWith("data:image/")) {
                        found[name] = url;
                    }
                }
                return found;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("ui-images: data/ui-images.json não foi encontrado; as páginas ficam sem essas imagens");
    return {};
}

/** A picture by name, as a data URL, or "". */
export function uiImage(name: string): string {
    if (images === null) {
        images = load();
    }
    return images[name] ?? "";
}

export function installUiImages(): void {
    const sent = new Map<string, number>();
    Events.onClient(`${RESOURCE}:status.image`, (sender, payload) => {
        const player = sender as Player;
        let name: unknown;
        try {
            name = (typeof payload === "string" && payload.length <= 200 ? (JSON.parse(payload) as { name?: unknown }) : (payload as { name?: unknown } | null))?.name;
        } catch {
            return;
        }
        if (typeof name !== "string" || name.length > 40) {
            return;
        }
        const img = uiImage(name);
        const key = `${player.id}:${name}`;
        const now = Date.now();
        if (img === "" || now - (sent.get(key) ?? -Infinity) < AGAIN_MS) {
            return;
        }
        sent.set(key, now);
        emitLarge(player, "status.image", JSON.stringify({ name, img }));
    });
    Events.on("playerDisconnect", (player) => {
        for (const key of [...sent.keys()]) {
            if (key.startsWith(`${player.id}:`)) {
                sent.delete(key);
            }
        }
    });
}
