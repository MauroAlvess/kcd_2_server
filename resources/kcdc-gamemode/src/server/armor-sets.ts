/**
 * The game's armour sets by the town, village or lord whose men wear them (`data/armor-sets.json`, made with ARMADURAS.md by
 * `tools/make-armor-sets.py`), handed out whole by `/conjunto` (user, 2026-10-18: "os sets separados para facilitar minha vida").
 * A set is one of the game's clothing presets: `dar` puts each of its pieces in an inventory, `vestir` dresses a body in it
 * (`player.setOutfit`, the game's own outfit, men's only).
 */

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

export interface ArmorPiece {
    readonly part: string;
    readonly name: string;
    readonly code: string;
}

export interface ArmorSet {
    readonly id: string;
    readonly place: string;
    readonly name: string;
    readonly category: string;
    readonly weight: string;
    readonly description: string;
    readonly price: number;
    readonly preset: string;
    /** The preset's GUID when the server knows it (it can be worn), else "". */
    readonly presetGuid: string;
    readonly gender: string;
    readonly pieces: readonly ArmorPiece[];
}

let sets: ArmorSet[] | null = null;

function load(): ArmorSet[] {
    const fs = require("node:fs") as NodeFs;
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/armor-sets.json` : "", "resources/kcdc-gamemode/data/armor-sets.json", "data/armor-sets.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                return Object.entries(parsed as Record<string, Omit<ArmorSet, "id">>)
                    .filter(([, value]) => typeof value === "object" && value !== null && Array.isArray(value.pieces))
                    .map(([id, value]) => ({ ...value, id }));
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("armor-sets: data/armor-sets.json não foi encontrado; /conjunto não tem conjuntos");
    return [];
}

export function armorSets(): readonly ArmorSet[] {
    if (sets === null) {
        sets = load();
    }
    return sets;
}

/** Folds accents and case away, for what an administrator types. */
export function fold(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();
}

export function setById(id: string): ArmorSet | null {
    const wanted = fold(id);
    return armorSets().find((set) => set.id === wanted) ?? null;
}

/** The places, in the document's order, with how many sets each has. */
export function placesOf(): Array<{ readonly place: string; readonly count: number }> {
    const counts = new Map<string, number>();
    for (const set of armorSets()) {
        counts.set(set.place, (counts.get(set.place) ?? 0) + 1);
    }
    return [...counts].map(([place, count]) => ({ place, count }));
}

export function setsOf(place: string): ArmorSet[] {
    const wanted = fold(place);
    return armorSets().filter((set) => fold(set.place) === wanted || fold(set.place).startsWith(wanted));
}

/** Puts every piece of a set in a player's inventory. What went in, and the codes that did not. */
export function giveSet(target: Player, set: ArmorSet, quality = 1): { readonly given: number; readonly failed: string[] } {
    let given = 0;
    const failed: string[] = [];
    for (const piece of set.pieces) {
        let ok = false;
        try {
            ok = Inventory.add(target, { item: piece.code, amount: 1, metadata: { quality } }).ok || (quality > 1 && Inventory.add(target, { item: piece.code, amount: 1 }).ok);
        } catch {
            ok = false;
        }
        if (ok) {
            given += 1;
        } else {
            failed.push(piece.code);
        }
    }
    return { given, failed };
}

/**
 * Takes one unit of every piece of a set out of a player's inventory, the way `giveSet` put them in (user, 2026-10-22: a set of eight
 * given to the wrong player by mistake). A piece the player has in several rows is taken from the row of the quality `giveSet` hands
 * out first, then from the others; one unit of each, never more. The codes that were taken, those not found, and whether the game
 * refused the removal (then nothing was taken).
 */
export function takeSet(target: Player, set: ArmorSet, quality = 1): { readonly taken: string[]; readonly missing: string[]; readonly refused: boolean } {
    const taken: string[] = [];
    const missing: string[] = [];
    let rows: readonly InventoryRow[] = [];
    try {
        rows = Inventory.get(target)?.items ?? [];
    } catch {
        rows = [];
    }
    const used = new Set<string>();
    const units: Array<{ id: string; amount: number }> = [];
    for (const piece of set.pieces) {
        const code = piece.code.toLowerCase();
        const found = rows
            .filter((row) => String(row.name).toLowerCase() === code && !used.has(row.id))
            .sort((a, b) => Number(b.quality === quality) - Number(a.quality === quality) || a.equipped - b.equipped);
        const row = found[0];
        if (row === undefined) {
            missing.push(piece.code);
            continue;
        }
        used.add(row.id);
        units.push({ id: row.id, amount: 1 });
        taken.push(piece.code);
    }
    if (units.length > 0) {
        let ok = false;
        try {
            ok = Inventory.remove(target, { units }).ok;
        } catch {
            ok = false;
        }
        if (!ok) {
            return { taken: [], missing, refused: true };
        }
    }
    return { taken, missing, refused: false };
}

/** Dresses a body in the set's own outfit. Why not, or "". */
export function wearSet(target: Player, set: ArmorSet): string {
    if (set.presetGuid === "") {
        return "o servidor não tem esse conjunto para vestir: use dar";
    }
    const gender: string = target.appearance?.gender ?? "";
    if (gender !== "" && gender !== set.gender) {
        return "esse conjunto é do jogo para homens: num corpo feminino use dar";
    }
    try {
        return target.setOutfit(set.presetGuid) ? "" : "o jogo recusou (inventário cheio?)";
    } catch (error: unknown) {
        return error instanceof Error ? error.message : String(error);
    }
}
