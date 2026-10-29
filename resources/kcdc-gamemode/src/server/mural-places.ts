/**
 * The notice boards of the villages and towns (user, 2026-10-24: "quadro de avisos em cada vila e cidade e reino"; and the same evening: "os quadros
 * de aviso de castelo vamos tirar, só vai ter quadro de aviso nas vilas e cidades que têm como dar viagem rápida pelo NPC e que estejam mapeadas; se
 * tiver em uma vila que possui castelo não faz sentido ter no castelo"), built with the World Builder and learnt from its export
 * (`worlds/quadros-de-aviso.world.json`, in `mod.world_resources`). The user moved every one of them to a better place the same evening, so where a
 * board stands is the export's word, never this file's. The rule for the export is the user's: a board only in a mapped village or town that has a
 * coach stop (`STOPS` of `travel.ts`), none in a castle; `PLACES` still names every mapped village and town, so a board added later is named right.
 *
 * A board is a frame of timber posts and rough planks with letters pinned to it, made of the game's own pieces; the one piece that says "a board
 * stands here" is a small scroll (`MURAL_MODEL`) buried a hand's breadth under the ground, half a metre in front of the planks, which is the point
 * the prompt measures from (`EDGE_M.mural`). What a board is called, and which letters it shows, is decided by the place it stands in (`placeOf`: the
 * village's or town's own ground), not by the exact spot, so that a board a builder moves keeps its letters while it stays in its place; two boards
 * in one place show the same letters. A board outside every place is a board of its own, named by where it stands.
 */

import { allowedTo, EDGE_M, reachTo } from "./reach.js";

/** The marker piece of a board: a scroll the game has little use for elsewhere, put under the ground (the World Builder's `scroll_c`). */
export const MURAL_MODEL = /(?:^|\/)scroll_c\.cgf$/i;
/** How far under the ground the builder buried it, in metres: the prompt stands at the ground above. */
export const MARKER_DEPTH_M = 0.45;

export interface Board {
    readonly id: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    /** The ground in front of the planks (the marker's own height and the depth it was buried at). */
    readonly z: number;
}

interface Box {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
}

/**
 * The villages and towns that can have boards: the ground of each (the boxes of `properties.ts`, where the level's doors are). The ground of Suchdol,
 * Raborsch and Malešov takes in the castle on its rise: a board is the village's wherever in it it stands.
 */
export const PLACES: ReadonlyArray<{ readonly id: string; readonly name: string; readonly box: Box }> = [
    { id: "suchdol", name: "Suchdol", box: { minX: 430, maxX: 900, minY: 3140, maxY: 3480 } },
    { id: "raborsch", name: "Raborsch", box: { minX: 1340, maxX: 1720, minY: 3720, maxY: 3980 } },
    { id: "malesov", name: "Malešov", box: { minX: 430, maxX: 660, minY: 225, maxY: 410 } },
    { id: "wysoka", name: "Wysoka", box: { minX: 250, maxX: 540, minY: 2320, maxY: 2600 } },
    { id: "kuttenberg", name: "Kuttenberg", box: { minX: 2850, maxX: 3385, minY: 370, maxY: 1010 } },
    { id: "grunta", name: "Minas", box: { minX: 3130, maxX: 3285, minY: 2130, maxY: 2290 } },
    { id: "bylany", name: "Bylany", box: { minX: 1560, maxX: 1850, minY: 880, maxY: 1175 } },
    { id: "bohunowitz", name: "Bohunowitz", box: { minX: 1850, maxX: 2140, minY: 3290, maxY: 3585 } },
    { id: "miskowitz", name: "Miskowitz", box: { minX: 1425, maxX: 1610, minY: 1845, maxY: 2050 } },
    { id: "pschitoky", name: "Pschitoky", box: { minX: 2235, maxX: 2375, minY: 1755, maxY: 1875 } },
    { id: "stara-kutna", name: "Stará Kutná", box: { minX: 3030, maxX: 3115, minY: 1300, maxY: 1425 } },
    { id: "horschan", name: "Horschan", box: { minX: 2540, maxX: 2620, minY: 2590, maxY: 2655 } },
    // Sigismund's camp (user, 2026-10-25: "mapeei Zikmundovo"): the palisade and the tents round the crossing at 1618, 2788; it has no doors, so the property census has nothing to say about it.
    { id: "zikmundovo", name: "Zikmundovo", box: { minX: 1520, maxX: 1745, minY: 2680, maxY: 2880 } },
    { id: "stara-lhota", name: "Stará Lhota", box: { minX: 585, maxX: 715, minY: 895, maxY: 960 } },
    { id: "danemark", name: "Danemark", box: { minX: 1525, maxX: 1590, minY: 180, maxY: 255 } },
    { id: "rabstein", name: "Rabstein", box: { minX: 945, maxX: 1015, minY: 1020, maxY: 1100 } },
    { id: "opatowitz", name: "Opatowitz", box: { minX: 1780, maxX: 1915, minY: 2960, maxY: 3050 } },
];

/** How far past a village's ground a board may stand and still be its. */
export const PLACE_MARGIN_M = 30;

const within = (box: Box, x: number, y: number, margin = 0): boolean => x >= box.minX - margin && x <= box.maxX + margin && y >= box.minY - margin && y <= box.maxY + margin;

/** The place a point is in: a village's or town's ground, then a little beyond it (the nearest); null in none. */
export function placeOf(x: number, y: number): { readonly id: string; readonly name: string } | null {
    const inside = PLACES.find((place) => within(place.box, x, y));
    if (inside !== undefined) {
        return { id: inside.id, name: inside.name };
    }
    let best: { id: string; name: string } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const place of PLACES) {
        if (within(place.box, x, y, PLACE_MARGIN_M)) {
            const distance = Math.hypot((place.box.minX + place.box.maxX) / 2 - x, (place.box.minY + place.box.maxY) / 2 - y);
            if (distance < bestDistance) {
                best = { id: place.id, name: place.name };
                bestDistance = distance;
            }
        }
    }
    return best;
}

/** What a press may be from the marker: the standard reach to a point `EDGE_M.mural` from the board's edge, and what the server allows over it. */
export const PROMPT_M = reachTo(EDGE_M.mural);
export const MURAL_REACH_M = allowedTo(EDGE_M.mural);
/** How far above or below the marker the player may stand (a hillside, a step). */
export const MURAL_HEIGHT_M = 3;

let boards: Board[] = [];

interface Point {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** The boards the props of the exports make: one for each marker, named after the place it stands in. */
export function boardsOf(props: ReadonlyArray<{ readonly model: string; readonly position: Point }>): Board[] {
    const found: Board[] = [];
    for (const prop of props) {
        if (!MURAL_MODEL.test(prop.model)) {
            continue;
        }
        const { x, y, z } = prop.position;
        const place = placeOf(x, y);
        found.push({ id: place?.id ?? `quadro-${Math.round(x)}-${Math.round(y)}`, name: place?.name ?? "Quadro de avisos", x, y, z: z + MARKER_DEPTH_M });
    }
    return found;
}

/** Puts the boards in (what the exports gave, or what a test gives). */
export function setBoards(list: readonly Board[]): void {
    boards = [...list];
}

export function muralBoards(): readonly Board[] {
    return boards;
}

export function boardById(id: string): Board | null {
    return boards.find((board) => board.id === id) ?? null;
}

/** The board within reach of a point (the nearest), or null. */
export function boardNear(position: Point, reach = MURAL_REACH_M): Board | null {
    let best: Board | null = null;
    let bestDistance = reach;
    for (const board of boards) {
        const distance = Math.hypot(board.x - position.x, board.y - position.y);
        if (distance <= bestDistance && Math.abs(board.z - position.z) <= MURAL_HEIGHT_M) {
            best = board;
            bestDistance = distance;
        }
    }
    return best;
}

/** Every board within a radius of a point, on the ground: what the client is told of, for its prompt. */
export function boardsWithin(position: { readonly x: number; readonly y: number }, radius: number): Board[] {
    return boards.filter((board) => Math.hypot(board.x - position.x, board.y - position.y) <= radius);
}

/** Learns the boards from the World Builder exports, once they have loaded (they load after the scripts start). */
export function installMuralPlaces(): void {
    const learn = (): void => {
        try {
            setBoards(boardsOf(WorldResource.all().flatMap((world) => world.props)));
        } catch (error: unknown) {
            console.log(`mural: as exportações do World Builder não puderam ser lidas: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        console.log(`mural: ${boards.length} quadro(s) de avisos postos com o World Builder${boards.length === 0 ? " (a exportação quadros-de-aviso não está em mod.world_resources?)" : `: ${boards.map((board) => board.id).join(", ")}`}`);
    };
    if (WorldResource.ready) {
        learn();
    } else {
        Events.once("worldResourcesReady", learn);
    }
}
