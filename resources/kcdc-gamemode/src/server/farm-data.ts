/**
 * The level's gardens and open meadows, for the Agricultores (`farm.ts`, `wild-horses.ts`): `data/farm.json`, made by
 * `tools/make-farm-data.py` from the level's own farmers' beds (the smart objects their NPCs hoe) and from a probe of the navigation mesh
 * for open fields. Read once, the first time it is asked for.
 */

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

/** A bed of a garden: its middle, which way its row runs (degrees, 0 is +Y) and how long it is. */
export interface Bed {
    /** `<garden id>:<n>`, n from 1. */
    readonly id: string;
    readonly garden: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    readonly length: number;
}

export interface Garden {
    readonly id: string;
    /** "Horta de Suchdol 2". */
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly beds: readonly Bed[];
}

export interface FarmData {
    readonly gardens: readonly Garden[];
    readonly beds: readonly Bed[];
    readonly meadows: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** What a parsed file holds, kept to the rows that make sense. */
export function readFarmData(parsed: unknown): FarmData {
    const raw = (typeof parsed === "object" && parsed !== null ? parsed : {}) as { gardens?: unknown; meadows?: unknown };
    const gardens: Garden[] = [];
    for (const entry of Array.isArray(raw.gardens) ? raw.gardens : []) {
        const garden = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
        if (typeof garden["id"] !== "string" || typeof garden["name"] !== "string" || !finite(garden["x"]) || !finite(garden["y"]) || !finite(garden["z"]) || !Array.isArray(garden["beds"])) {
            continue;
        }
        const id = garden["id"];
        const beds: Bed[] = [];
        for (const row of garden["beds"] as unknown[]) {
            if (!Array.isArray(row) || row.length < 3 || !row.slice(0, 3).every(finite)) {
                continue;
            }
            const [x, y, z, yaw, length] = row as number[];
            beds.push({ id: `${id}:${beds.length + 1}`, garden: id, x: x!, y: y!, z: z!, yaw: finite(yaw) ? yaw : 0, length: finite(length) && length > 0 ? length : 1.6 });
        }
        if (beds.length > 0) {
            gardens.push({ id, name: garden["name"], x: garden["x"], y: garden["y"], z: garden["z"], beds });
        }
    }
    const meadows: Array<{ x: number; y: number; z: number }> = [];
    for (const row of Array.isArray(raw.meadows) ? raw.meadows : []) {
        if (Array.isArray(row) && row.length >= 3 && row.slice(0, 3).every(finite)) {
            meadows.push({ x: row[0] as number, y: row[1] as number, z: row[2] as number });
        }
    }
    return { gardens, beds: gardens.flatMap((garden) => garden.beds), meadows };
}

let loaded: FarmData | null = null;

/**
 * The level's own rows are short (four metres, behind the houses of the villages): made longer when read (2026-10-27, user: "as terras de plantações estão muito pequenas,
 * precisamos estender os campos de arado"). A longer row shows more plants and gives more at the harvest (`farm.ts`, `rowFactor`).
 */
export const FIELD = { stretch: 2, maxM: 8 };

/** The same data with every row made `FIELD.stretch` times longer, up to `FIELD.maxM`. */
export function stretched(data: FarmData, stretch: number = FIELD.stretch, maxM: number = FIELD.maxM): FarmData {
    const grow = (bed: Bed): Bed => ({ ...bed, length: Math.max(bed.length, Math.min(maxM, bed.length * stretch)) });
    const gardens = data.gardens.map((garden) => ({ ...garden, beds: garden.beds.map(grow) }));
    return { gardens, beds: gardens.flatMap((garden) => garden.beds), meadows: data.meadows };
}

export function farmData(): FarmData {
    if (loaded !== null) {
        return loaded;
    }
    const fs = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/farm.json` : "", "resources/kcdc-gamemode/data/farm.json", "data/farm.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            loaded = stretched(readFarmData(JSON.parse(fs.readFileSync(place, "utf8")) as unknown));
            return loaded;
        } catch {
            // Not here; the next place.
        }
    }
    console.log("farm: data/farm.json não foi encontrado; nenhuma horta e nenhum campo de cavalos selvagens");
    loaded = { gardens: [], beds: [], meadows: [] };
    return loaded;
}

/** For the tests: what the file would have held. */
export function setFarmData(data: FarmData): void {
    loaded = data;
}

/** Adds a garden to what is read: the bed an administrator marked where the level's own rows miss a plot (`farm.ts`, `/horta aqui`). */
export function addGarden(garden: Garden): void {
    const data = farmData();
    loaded = { gardens: [...data.gardens, garden], beds: [...data.beds, ...garden.beds], meadows: data.meadows };
}

/** Takes a garden away again. False when there was none by that id. */
export function removeGarden(id: string): boolean {
    const data = farmData();
    if (!data.gardens.some((garden) => garden.id === id)) {
        return false;
    }
    loaded = { gardens: data.gardens.filter((garden) => garden.id !== id), beds: data.beds.filter((bed) => bed.garden !== id), meadows: data.meadows };
    return true;
}
