/**
 * The Agricultores' gardens, the client's half (server: `farm.ts`): aimed at the soil of a bed of a village's garden, within reach of the
 * body, an Agricultor sees "Plantar" on E when the bed is free, "Colher" when it is theirs and ripe, and "Plantação" (E says how long is
 * left) when it is theirs and growing; the press tells the server which bed (`farm.use`), which opens the page on the right for a free
 * one (`craft-page.ts`, the same page as the trades') or starts the harvest. While the harvest goes on the hint says "Parar" and the
 * press stops it, and so does a walk: the animation holds the body still, so the keys that walk it are watched as `gather.ts` does
 * (user, 2026-10-22: "se o jogador andar deve cortar a animação, senão ele fica preso na animação").
 *
 * The beds are what the server sent (`farm.beds`: `[x, y, z, yaw, length, state]` each, only to an Agricultor): the aim is the ground
 * the crosshair's ray meets, close to a bed's row; the bed's index in that list is what goes back.
 */

import { furnitureBusy } from "./furniture.js";
import { getPersonInView } from "./interaction.js";
import { EDGE_M, reachTo } from "./reach.js";
import { mayFarm } from "./trade-rights.js";

const RESOURCE = "kcdc-gamemode";
const BEDS = `${RESOURCE}:farm.beds`;
const STATE = `${RESOURCE}:farm.state`;
const USE = `${RESOURCE}:farm.use`;
const STOP = `${RESOURCE}:farm.stop`;
const ASK = `${RESOURCE}:farm.ask`;

/** E, the game's primary action, as the trades' own hints (`cook-hint.ts`). */
export const FARM_KEY = "primary_action";

/** The keys that walk the body, and how long a key still held from walking up to the bed is let be (`gather.ts`). */
export const MOVE_KEYS = ["w", "a", "s", "d", "space", "up", "down", "left", "right"];
export const GRACE_MS = 700;
const MOVE_CHECK_MS = 100;
const LOOK_MS = 250;
const PRESS_MS = 700;

/** How far from the row of a bed the ground under the crosshair may be, and how far the ray is carried (the third person's camera is behind the body). */
export const AIM_M = 1.8;
const RAY_M = 8;
/** How far up or down from the body a bed may be. */
const HEIGHT_M = 3;
/** Only beds this near the body are looked at. */
const NEAR_M = 14;
/** How long before the server is asked again for the beds of a player who may farm and has none (an administrator's `/oficios livre` sends the right, not the beds). */
export const ASK_AGAIN_MS = 4000;

export const TEXT = { free: "Plantar", ripe: "Colher", growing: "Plantação", stop: "Parar de colher" } as const;

/** One bed: its middle, which way its row runs (degrees, 0 is +Y), its length, and what it is to this player: 0 free, 1 theirs growing, 2 theirs ripe, 3 another's. */
export type Bed = readonly [x: number, y: number, z: number, yaw: number, length: number, state: number];

/** How far a point is from the row of a bed, flat: from the nearest point of the row. */
export function distanceToRow(bed: Bed, x: number, y: number): number {
    const radians = (bed[3] * Math.PI) / 180;
    const dx = -Math.sin(radians);
    const dy = Math.cos(radians);
    const half = bed[4] / 2;
    const along = Math.max(-half, Math.min(half, (x - bed[0]) * dx + (y - bed[1]) * dy));
    return Math.hypot(x - (bed[0] + dx * along), y - (bed[1] + dy * along));
}

/** The bed whose soil is under the aim and within reach of the body, or -1. */
export function bedAimedAt(beds: readonly Bed[], aim: { readonly x: number; readonly y: number }, body: { readonly x: number; readonly y: number; readonly z: number }): number {
    let best = -1;
    let nearest = AIM_M;
    beds.forEach((bed, index) => {
        if (bed[5] === 3 || Math.abs(bed[2] - body.z) > HEIGHT_M || Math.hypot(bed[0] - body.x, bed[1] - body.y) > NEAR_M) {
            return;
        }
        if (distanceToRow(bed, body.x, body.y) > reachTo(EDGE_M.garden)) {
            return;
        }
        const gap = distanceToRow(bed, aim.x, aim.y);
        if (gap <= nearest) {
            nearest = gap;
            best = index;
        }
    });
    return best;
}

function parseBeds(payload: unknown): Bed[] {
    let list: unknown = payload;
    if (typeof payload === "string") {
        try {
            list = JSON.parse(payload) as unknown;
        } catch {
            return [];
        }
    }
    if (!Array.isArray(list)) {
        return [];
    }
    return list.filter((row): row is Bed => Array.isArray(row) && row.length === 6 && row.every(Number.isFinite));
}

export function installFarm(): void {
    let beds: Bed[] = [];
    let hint = 0;
    let hintText = "";
    let aimed = -1;
    let harvesting = false;
    let workedAt = 0;
    let stopAsked = false;
    let pressedAt = 0;
    let askedAt = 0;

    const remove = (): void => {
        if (hint) {
            ActionHint.remove(hint);
        }
        hint = 0;
        hintText = "";
    };
    const show = (text: string): void => {
        if (hint && hintText === text) {
            return;
        }
        remove();
        hint = ActionHint.create({ key: FARM_KEY, text }, press);
        hintText = text;
    };
    function press(): void {
        const now = Date.now();
        if (now - pressedAt < PRESS_MS) {
            return;
        }
        pressedAt = now;
        if (harvesting) {
            Events.emitServer(STOP);
            return;
        }
        if (aimed >= 0) {
            Events.emitServer(USE, JSON.stringify({ b: aimed }));
        }
    }

    Events.on(BEDS, (payload) => {
        beds = parseBeds(payload);
    });
    Events.on(STATE, (payload) => {
        let fields: unknown = payload;
        if (typeof payload === "string") {
            try {
                fields = JSON.parse(payload) as unknown;
            } catch {
                return;
            }
        }
        harvesting = typeof fields === "object" && fields !== null && (fields as { on?: unknown }).on === true;
        workedAt = harvesting ? Date.now() : 0;
        stopAsked = false;
    });

    const look = (): void => {
        const me = LocalPlayer;
        if (harvesting) {
            show(TEXT.stop);
            return;
        }
        if (mayFarm() && beds.length === 0 && Date.now() - askedAt >= ASK_AGAIN_MS) {
            askedAt = Date.now();
            Events.emitServer(ASK);
        }
        if (!mayFarm() || beds.length === 0 || !me?.ready || !me.alive || me.mounted || getPersonInView() || furnitureBusy() || Hud.isInDialogue() || !Controls.isEnabled()) {
            aimed = -1;
            remove();
            return;
        }
        const ray = Camera.screenRay({ range: RAY_M });
        const hit = ray === null ? null : World.raycast(ray.origin, ray.target, { mode: "anything", ignoreSelf: true });
        aimed = hit === null ? -1 : bedAimedAt(beds, hit.position, me.position);
        const bed = aimed < 0 ? undefined : beds[aimed];
        if (bed === undefined) {
            remove();
            return;
        }
        show(bed[5] === 0 ? TEXT.free : bed[5] === 2 ? TEXT.ripe : TEXT.growing);
    };

    const walking = (): void => {
        if (!harvesting || stopAsked || Date.now() - workedAt < GRACE_MS) {
            return;
        }
        try {
            if (MOVE_KEYS.some((key) => Key.isDown(key))) {
                stopAsked = true;
                Events.emitServer(STOP);
            }
        } catch {
            // A key the build does not know.
        }
    };

    const timer = setInterval(look, LOOK_MS);
    const mover = setInterval(walking, MOVE_CHECK_MS);
    // The server tells it at every spawn and whenever a bed changes hands; asked now as well, for a resource restarted with the player in.
    Events.emitServer(ASK);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            clearInterval(mover);
            remove();
        }
    });
}
