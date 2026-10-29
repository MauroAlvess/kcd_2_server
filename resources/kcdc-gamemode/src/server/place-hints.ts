/**
 * The words the panel puts beside a region and a property so they can be found on the game's own map (user, 2026-10-26: "algumas delas fazem parte de regiões
 * maiores ... não sei me localizar pelas regiões que você mapeou e não aparecem com nome no mapa ... colocar alguma identificação, exemplo próximo a X local,
 * até mesmo no dropdown da seção Chaves"). A region says how the map writes its name when that is not ours ("Lhota" for Stará Lhota) and which place it is
 * by; a property that is not on the map by its own name (the inn of Pschitoky, the stud farm of Malešov, a castle, the Devil's Den) says what the map calls
 * the spot and how far it lies from its village. The places and the way to speak of them are `map-places.ts`.
 */

import { REGIONS, type PropertyInfo, type Region } from "./properties.js";
import { against, fold, mapPlaceAt, mapPlaceNamed, nearestLandmark, type MapPlace, type Spot } from "./map-places.js";

export interface RegionHint {
    /** What is drawn before the name: a stronghold (or the great town) or a village. */
    readonly kind: "castle" | "village";
    /** How the map writes the place when that is not the region's own name: "Lhota" for "Stará Lhota". Empty when it is. */
    readonly map: string;
    /** Where the place is against another one of the map: "ao norte de Stará Kutná". Empty when nothing of the map is near. */
    readonly where: string;
}

const middleOf = (region: Region): Spot => ({ x: (region.minX + region.maxX) / 2, y: (region.minY + region.maxY) / 2 });

const listedRegion = (name: string): Region | null => REGIONS.find((region) => region.name === name) ?? REGIONS.find((region) => fold(region.name) === fold(name)) ?? null;

/** The place of the map a listed region is: the one that holds its middle. */
const homeOf = (region: Region): MapPlace | null => mapPlaceAt(middleOf(region));

/** The middle of the properties that stand on their own in a region the list does not know (one an administrator made up). */
function spotOfCatalog(name: string, catalog: readonly PropertyInfo[]): Spot | null {
    const own = catalog.filter((property) => property.region === name && property.parentId === "");
    if (own.length === 0) {
        return null;
    }
    return { x: own.reduce((sum, property) => sum + property.x, 0) / own.length, y: own.reduce((sum, property) => sum + property.y, 0) / own.length };
}

/**
 * What to say of a region: its name on the map when it differs, and the place of the map it lies by. A region of the list is told by the place `near` names
 * when it has one (Minas: Stará Kutná, the way the user places it) and otherwise by the nearest village, town or camp of the map that is not itself.
 */
export function regionHint(name: string, catalog: readonly PropertyInfo[] = []): RegionHint | null {
    const region = listedRegion(name);
    const spot = region !== null ? middleOf(region) : spotOfCatalog(name, catalog);
    if (spot === null) {
        return null;
    }
    const home = region !== null ? homeOf(region) : mapPlaceAt(spot);
    const anchor = region?.near !== undefined ? mapPlaceNamed(region.near) : null;
    const near = anchor ?? nearestLandmark(spot, home === null ? [] : [home])?.place ?? null;
    return {
        kind: region !== null && (region.fortress !== undefined || region.id === "kuttenberg") ? "castle" : "village",
        map: home !== null && fold(home.name) !== fold(name) ? home.name : "",
        where: near === null ? "" : against(near, spot),
    };
}

/** The hints of a list of regions, by name; a region nothing is known of is left out. */
export function regionHints(names: readonly string[], catalog: readonly PropertyInfo[] = []): Record<string, RegionHint> {
    const found: Record<string, RegionHint> = {};
    for (const name of names) {
        const hint = regionHint(name, catalog);
        if (hint !== null) {
            found[name] = hint;
        }
    }
    return found;
}

/**
 * What to say of a property that a region's list gives a place of its own (a castle, the inn, the stud farm, the Devil's Den): what the map calls the
 * spot when that is not the property's own name, and where it stands against its village. Empty for any other property.
 */
export function propertyHint(property: PropertyInfo): string {
    const region = listedRegion(property.region);
    if (region === null) {
        return "";
    }
    const compound = (region.compounds ?? []).some((one) => one.name === property.name);
    const castle = region.fortress !== undefined && property.name === `Castelo de ${region.name}`;
    if (!compound && !castle) {
        return "";
    }
    const spot = { x: property.x, y: property.y };
    const own = mapPlaceAt(spot);
    const home = homeOf(region);
    const parts: string[] = [];
    if (own !== null && own !== home && fold(own.name) !== fold(property.name)) {
        parts.push(`no mapa: ${own.name}`);
    }
    if (home !== null) {
        parts.push(against(home, spot, true));
    }
    return parts.join(" · ");
}
