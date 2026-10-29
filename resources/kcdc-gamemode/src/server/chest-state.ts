/**
 * What the chests of the catalog hold, kept between restarts.
 *
 * A level chest has nothing in it but what players (or scripts) put there, and the framework forgets that at every
 * restart. A property chest -- the ones `properties.ts` files and hands keys to -- is where a player keeps their
 * things, so each one is written to `playerdata/chests/<chest guid>.json` shortly after its contents change and put
 * back when the server starts.
 *
 * The same care as for characters (`character-state.ts`): files are written in two steps (`store.ts`), a file that
 * cannot be read is never overwritten, and a restore the game refuses leaves the file alone.
 */

import { propertyOfStash, listProperties } from "./properties.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata/chests";
const RESOURCE = "kcdc-gamemode";

/** Several changes in a row (a player moving a stack at a time) are written once. */
const SAVE_DELAY_MS = 3_000;

/** A chest the level has not built yet is tried again for this long. */
const RETRY_EVERY_MS = 5_000;
const RETRY_ATTEMPTS = 24;

/** A stash's level GUID is sixteen hex digits; the pattern also keeps anything else out of a file name. */
const GUID = /^[0-9a-f]{16}$/;

interface SavedRow {
    id: string;
    item: string;
    amount: number;
    metadata: Record<string, unknown>;
}

interface SavedChest {
    v: 1;
    guid: string;
    savedAt: number;
    items: SavedRow[];
}

const pathFor = (guid: string): string => `${DIR}/${guid}.json`;

/** Chests whose file could not be read: nothing is written over them. */
const blocked = new Set<string>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function isRow(value: unknown): value is SavedRow {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const row = value as Partial<SavedRow>;
    return typeof row.id === "string" && typeof row.item === "string" && typeof row.amount === "number" && row.amount > 0 && typeof row.metadata === "object" && row.metadata !== null;
}

function save(guid: string): void {
    if (blocked.has(guid) || !GUID.test(guid)) {
        return;
    }
    const stash = Stash.find(guid);
    const state = stash?.getInventory() ?? null;
    if (state === null) {
        return;
    }
    const record: SavedChest = {
        v: 1,
        guid,
        savedAt: Date.now(),
        items: state.items.slice(0, 128).map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: row.metadata })),
    };
    try {
        write(pathFor(guid), record);
    } catch (error: unknown) {
        console.log(`chests: não consegui salvar ${guid}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Puts a saved chest back. Returns true when there is nothing more to do for it, false when the chest is not there yet. */
function restore(guid: string): boolean {
    if (!GUID.test(guid)) {
        return true;
    }
    const loaded = read<Partial<SavedChest>>(pathFor(guid));
    if (loaded.status === "missing") {
        return true;
    }
    if (loaded.status === "corrupt") {
        blocked.add(guid);
        console.error(`chests: o arquivo do baú ${guid} está ilegível e foi deixado como está: ${loaded.reason}`);
        return true;
    }
    const stash = Stash.find(guid);
    if (stash === null) {
        return false;
    }
    const items = Array.isArray(loaded.value.items) ? loaded.value.items.filter(isRow) : [];
    const result = stash.setInventory({ items: items.map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: row.metadata })) });
    if (!result.ok) {
        // Not written over: a custom item type that is gone, say, must not cost the rest.
        blocked.add(guid);
        console.error(`chests: o baú ${guid} recusou o conteúdo salvo (${result.code}); o arquivo foi deixado como está`);
    }
    return true;
}

/**
 * Empties a property chest, in the world and in its file: a deleted character's things go with it (2026-10-25). True when the world's chest
 * was emptied; the file is written empty either way, so a chest the level has not built yet is not filled again at the next start.
 */
export function emptyChest(guid: string): boolean {
    if (!GUID.test(guid) || blocked.has(guid)) {
        return false;
    }
    let emptied = false;
    try {
        emptied = Stash.find(guid)?.setInventory({ items: [] }).ok === true;
    } catch {
        emptied = false;
    }
    try {
        ensureDir(DIR);
        write(pathFor(guid), { v: 1, guid, savedAt: Date.now(), items: [] } satisfies SavedChest);
    } catch (error: unknown) {
        console.log(`chests: não consegui esvaziar o arquivo de ${guid}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return emptied;
}

export function installChestState(): void {
    ensureDir(DIR);

    const chests = listProperties().filter((property) => property.kind === "chest" && property.stashGuid !== "");
    const waiting = new Set<string>();
    let restored = 0;
    for (const chest of chests) {
        if (!restore(chest.stashGuid)) {
            waiting.add(chest.stashGuid);
        } else if (read(pathFor(chest.stashGuid)).status === "ok") {
            restored += 1;
        }
    }
    console.log(`chests: ${chests.length} baú(s) no catálogo; ${restored} com conteúdo devolvido${waiting.size > 0 ? `, ${waiting.size} esperando o nível` : ""}`);

    if (waiting.size > 0) {
        let attempts = 0;
        const retry = setInterval(() => {
            attempts += 1;
            for (const guid of [...waiting]) {
                if (restore(guid)) {
                    waiting.delete(guid);
                }
            }
            if (waiting.size === 0 || attempts >= RETRY_ATTEMPTS) {
                clearInterval(retry);
                if (waiting.size > 0) {
                    console.error(`chests: ${waiting.size} baú(s) não puderam ser devolvidos: ${[...waiting].join(", ")}`);
                }
            }
        }, RETRY_EVERY_MS);
    }

    Events.on("stashInventoryChanged", (stash) => {
        const guid = stash.levelGuid;
        if (guid === "" || pending.has(guid) || propertyOfStash(guid)?.kind !== "chest") {
            return;
        }
        pending.set(
            guid,
            setTimeout(() => {
                pending.delete(guid);
                save(guid);
            }, SAVE_DELAY_MS),
        );
    });

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        for (const [guid, timer] of [...pending]) {
            clearTimeout(timer);
            pending.delete(guid);
            save(guid);
        }
    });
}
