/**
 * Where a spot is against the game's own map (user, 2026-10-26: "não sei me localizar pelas regiões que você mapeou e não aparecem com nome no mapa"): the
 * places the map names, as it writes them in Portuguese (`map-places-data.ts`, made by `tools/make-map-places.py` from the level and the game's texts), and
 * the few words that say where a thing stands by them: "a noroeste das Minas", "dentro de Pschitoky". The panel's lists of regions and properties use them
 * (`place-hints.ts`), so a name the map does not carry ("Estalagem de Pschitoky", "Haras de Malešov") still tells where to look.
 *
 * The level's +Y is north and +X east, and the map is drawn with north up.
 */

import { onKuttenberg } from "./level.js";
import { MAP_PLACE_DATA, type MapPlaceData } from "./map-places-data.js";
import { MAP_PLACE_DATA_TROSECKO } from "./map-places-data-trosecko.js";

export type MapPlace = MapPlaceData;

/** The places of the level the server runs (`level.ts`): Kuttenberg's, or Trosky's since 2026-11-09. */
export const MAP_PLACES: readonly MapPlace[] = onKuttenberg() ? MAP_PLACE_DATA : MAP_PLACE_DATA_TROSECKO;

export interface Spot {
    readonly x: number;
    readonly y: number;
}

/** A name with no accents and no capitals, to compare names by. */
export function fold(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

export function centreOf(place: MapPlace): Spot {
    return { x: (place.minX + place.maxX) / 2, y: (place.minY + place.maxY) / 2 };
}

const areaOf = (place: MapPlace): number => (place.maxX - place.minX) * (place.maxY - place.minY);

/** A place of the map by the name the map writes it with, or the one the level gives it (English), with or without accents. Null when there is none. */
export function mapPlaceNamed(name: string): MapPlace | null {
    const wanted = fold(name);
    return MAP_PLACES.find((place) => fold(place.name) === wanted || fold(place.en) === wanted) ?? null;
}

/** The smallest place of the map whose outline holds the spot (the Ossuary, not the Monastery that surrounds it), or null for open country. */
export function mapPlaceAt(spot: Spot): MapPlace | null {
    let best: MapPlace | null = null;
    for (const place of MAP_PLACES) {
        if (spot.x >= place.minX && spot.x <= place.maxX && spot.y >= place.minY && spot.y <= place.maxY && (best === null || areaOf(place) < areaOf(best))) {
            best = place;
        }
    }
    return best;
}

const POINTS = ["ao norte", "a nordeste", "a leste", "a sudeste", "ao sul", "a sudoeste", "a oeste", "a noroeste"] as const;

/** Which side of `from` the spot lies on, as the way a person says it: "ao norte", "a noroeste". */
export function pointOf(from: Spot, spot: Spot): string {
    const degrees = (Math.atan2(spot.x - from.x, spot.y - from.y) * 180) / Math.PI;
    return POINTS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] ?? "ao norte";
}

export interface Nearest {
    readonly place: MapPlace;
    readonly metres: number;
}

/** The village, town, camp or stronghold nearest the spot (by its middle), leaving out the places named in `except`: what a thing is told against. */
export function nearestLandmark(spot: Spot, except: readonly MapPlace[] = []): Nearest | null {
    let best: Nearest | null = null;
    for (const place of MAP_PLACES) {
        if (!place.landmark || except.includes(place)) {
            continue;
        }
        const middle = centreOf(place);
        const metres = Math.hypot(spot.x - middle.x, spot.y - middle.y);
        if (best === null || metres < best.metres) {
            best = { place, metres };
        }
    }
    return best;
}

/** How far, to the ten metres: "480". */
export const roundedMetres = (metres: number): number => Math.max(10, Math.round(metres / 10) * 10);

/**
 * Where the spot is against a place: "dentro de Pschitoky" when its outline holds it, otherwise "a noroeste das Minas", with how far its middle is
 * when `withMetres` ("ao norte de Maleshov (500 m)").
 */
export function against(place: MapPlace, spot: Spot, withMetres = false): string {
    if (spot.x >= place.minX && spot.x <= place.maxX && spot.y >= place.minY && spot.y <= place.maxY) {
        return `dentro ${place.of}`;
    }
    const middle = centreOf(place);
    const metres = Math.hypot(spot.x - middle.x, spot.y - middle.y);
    return `${pointOf(middle, spot)} ${place.of}${withMetres ? ` (${roundedMetres(metres)} m)` : ""}`;
}
