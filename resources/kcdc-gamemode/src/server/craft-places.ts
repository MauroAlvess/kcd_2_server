/**
 * Places of the trades built with the World Builder (user, 2026-10-19: "uma forja e uma mesa de alquimia na cidade"; then "deixe
 * que eu mesmo monto o mundo"). Whatever forge or alchemy table an export of `mod.world_resources` places is a place of work,
 * wherever it stands: the game has no station of its own there (`Crafting.stations` lists only the level's), so a forge counts
 * as a smithery for our forge's page (`forgeNear`), and at an alchemy table a potion chosen on the page is brewed on the page
 * (`brew` in `craft.ts`). They are learnt from the exports once they have loaded, by their model (`FORGE_MODEL`,
 * `ALCHEMY_MODEL`); the client's "Forjar" or "Preparar" goes up when the aim is on one (`cook-hint.ts`).
 */

import { allowedTo, EDGE_M } from "./reach.js";

export type CraftPlaceKind = "forja" | "alquimia";

export interface CraftPlace {
    readonly kind: CraftPlaceKind;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** The game's forges a builder places: the stone forge with its hood, and the two small ones. */
export const FORGE_MODEL = /(?:^|\/)(?:forge_big_a|forge_small_a|forge_small_b)\.cgf$/i;
/** The game's alchemy tables: the frames (`a`, `c`), the furnace with its hood (`b`) and the master's small table. */
export const ALCHEMY_MODEL = /(?:^|\/)alchemy_table_(?:a|b|c|master)\.cgf$/i;

/** How near one of them the work is done, in metres on the ground (the one reach of our prompts to a point three metres wide, and a metre more: `reach.ts`); and how far above or below it the player may stand. */
export const PLACE_REACH_M = allowedTo(EDGE_M.alchemy);
export const PLACE_HEIGHT_M = 3;

let places: CraftPlace[] = [];

/** The places the props of the exports make: one for each forge or alchemy table among them. */
export function placesOf(props: ReadonlyArray<{ readonly model: string; readonly position: { readonly x: number; readonly y: number; readonly z: number } }>): CraftPlace[] {
    const found: CraftPlace[] = [];
    for (const prop of props) {
        const kind: CraftPlaceKind | null = FORGE_MODEL.test(prop.model) ? "forja" : ALCHEMY_MODEL.test(prop.model) ? "alquimia" : null;
        if (kind !== null) {
            found.push({ kind, name: kind === "forja" ? "Forja" : "Mesa de alquimia", x: prop.position.x, y: prop.position.y, z: prop.position.z });
        }
    }
    return found;
}

/** Puts the places in (what the exports gave, or what a test gives). */
export function setCraftPlaces(list: readonly CraftPlace[]): void {
    places = [...list];
}

export function craftPlaces(): readonly CraftPlace[] {
    return places;
}

/** The place of this kind within reach of a point, or null. */
export function craftPlaceNear(kind: CraftPlaceKind, position: { x: number; y: number; z: number }, reach = PLACE_REACH_M): CraftPlace | null {
    return places.find((place) => place.kind === kind && Math.hypot(place.x - position.x, place.y - position.y) <= reach && Math.abs(place.z - position.z) <= PLACE_HEIGHT_M) ?? null;
}

/** Every place within a radius of a point, on the ground: what the client is told of, for its hint. */
export function craftPlacesWithin(position: { x: number; y: number }, radius: number): CraftPlace[] {
    return places.filter((place) => Math.hypot(place.x - position.x, place.y - position.y) <= radius);
}

/** Learns the places from the World Builder exports, once they have loaded (they load after the scripts start). */
export function installCraftPlaces(): void {
    const learn = (): void => {
        try {
            setCraftPlaces(placesOf(WorldResource.all().flatMap((world) => world.props)));
        } catch (error: unknown) {
            console.log(`craft-places: as exportações do World Builder não puderam ser lidas: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        const forges = places.filter((place) => place.kind === "forja").length;
        console.log(`craft-places: ${forges} forja(s) e ${places.length - forges} mesa(s) de alquimia postas com o World Builder funcionam como as do jogo`);
    };
    if (WorldResource.ready) {
        learn();
    } else {
        Events.once("worldResourcesReady", learn);
    }
}
