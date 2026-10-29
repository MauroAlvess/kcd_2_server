/**
 * Thirst, the client's half (`src/server/thirst.ts`): the server keeps the measure and sends it (`thirst.value`) for the panel's "Sede"
 * bar; and where a player stands at water -- a river, a pond, a stream -- and aims at it, a hint "Beber água" comes up on F, and the
 * press tells the server where the water is (`thirst.drink`), which has the body kneel and drink.
 *
 * The game's own river is not a thing a ray stops on: the water is drawn and the body wades through it, so a trace goes down to the
 * bed. What says "water" is the bed's surface type: the river's terrain layers are `mat_mudwater` and `mat_rockwater`, the water volumes
 * `mat_water`, the slow ones `mat_slowwater` (`Libs/MaterialEffects/SurfaceTypes.xml`, and the materials under `Materials/terrain/river`
 * and `.../water`). The ground at the player's feet and a step or two ahead of where they look is read for it, and so is the ray from the
 * crosshair.
 */

import { furnitureBusy } from "./furniture.js";
import { getPersonInView } from "./interaction.js";
import { REACH_M } from "./reach.js";

const RESOURCE = "kcdc-gamemode";
const VALUE = `${RESOURCE}:thirst.value`;
const DRINK = `${RESOURCE}:thirst.drink`;

/** The surface types of water: `mat_water`, `mat_mudwater`, `mat_rockwater`, `mat_slowwater`, `mat_deep_water_barrier`. */
export const WATER = /water/i;

/**
 * Drinking is on F, the game's "attack_special" (the key the door locks use too), not on E (2026-10-20: "o E para beber água precisa virar
 * F porque senão fica o mesmo botão, aí complica": E is the horse's menu, the doors, the fires, the carts).
 */
export const DRINK_KEY = "attack_special";

/**
 * How far from the BODY the water may be, the one reach of our prompts (`reach.ts`, 2026-10-22: it was 3.2 m along the camera's ray and the ground
 * read up to 2.5 m ahead of the feet), and how far ahead of the feet, along where the player looks, the ground is read: up to that reach.
 */
export const AHEAD_M: readonly number[] = [0, 0.7, 1.4, REACH_M];
/** How far out the crosshair's ray is carried: the reach, and the camera's distance behind the body in the mod's third person. */
const LOOK_RANGE_M = 10;

/** A player this quenched has no hint put up (the server refuses one this quenched, too). */
export const QUENCHED_AT = 96;

const LOOK_MS = 250;
/**
 * The ground does not move: a player who has not moved nor turned since the last look (5 cm, a hundredth of the way they face) has the same ground under and
 * ahead of them, which is kept this long at most instead of being traced again (2026-10-27: the look was five traces every quarter of a second for every
 * player, standing or not). The crosshair's ray is traced every time: somebody may step in front of it.
 */
const SAME_POSE_KEEP_MS = 1_000;
/** The hint stays down this long after a press, while the body kneels. */
const AFTER_PRESS_MS = 2_500;

/** The measure the server last sent, or -1 before it has. */
let value = -1;

/** The measure as the panel draws it: a bar of a hundred, "—" until the server has said. */
export function thirstGauge(): readonly [number, number] {
    return value < 0 ? [0, 0] : [value, 100];
}

export function installThirst(): void {
    let hint = 0;
    let pressedAt = 0;
    let water: { x: number; y: number; z: number } | null = null;

    Events.on(VALUE, (payload) => {
        try {
            const fields = typeof payload === "string" ? (JSON.parse(payload) as Record<string, unknown>) : (payload as Record<string, unknown>);
            const v = Number(fields["v"]);
            if (Number.isFinite(v)) {
                value = Math.max(0, Math.min(100, v));
            }
        } catch {
            // A message that cannot be read says nothing.
        }
    });

    const remove = (): void => {
        if (hint) {
            ActionHint.remove(hint);
        }
        hint = 0;
        water = null;
    };

    const press = (): void => {
        if (water === null || Date.now() - pressedAt < AFTER_PRESS_MS) {
            return;
        }
        pressedAt = Date.now();
        Events.emitServer(DRINK, JSON.stringify({ x: Math.round(water.x * 100) / 100, y: Math.round(water.y * 100) / 100, z: Math.round(water.z * 100) / 100 }));
    };

    let lastPose = "";
    let lastPoseAt = 0;
    let lastGround: { x: number; y: number; z: number } | null = null;

    /** The water the player is looking at or standing in, or null. The player's place is read once (it was read three times for each spot ahead). */
    const find = (): { x: number; y: number; z: number } | null => {
        const me = LocalPlayer;
        if (!me) {
            return null;
        }
        const feet = me.position;
        const ray = Camera.screenRay({ range: LOOK_RANGE_M });
        if (ray) {
            const hit = World.raycast(ray.origin, ray.target, { mode: "anything", ignoreSelf: true });
            if (hit !== null && WATER.test(hit.surface) && Math.hypot(hit.position.x - feet.x, hit.position.y - feet.y) <= REACH_M) {
                return { x: hit.position.x, y: hit.position.y, z: hit.position.z };
            }
        }
        const dir = ray ? Math.hypot(ray.direction.x, ray.direction.y) : 0;
        const dx = ray && dir > 0.01 ? ray.direction.x / dir : 0;
        const dy = ray && dir > 0.01 ? ray.direction.y / dir : 0;
        const near = (n: number, step: number): number => Math.round(n / step);
        const pose = `${near(feet.x, 0.05)},${near(feet.y, 0.05)},${near(feet.z, 0.05)},${near(dx, 0.01)},${near(dy, 0.01)}`;
        const now = Date.now();
        if (pose === lastPose && now - lastPoseAt < SAME_POSE_KEEP_MS) {
            return lastGround;
        }
        let found: { x: number; y: number; z: number } | null = null;
        for (const ahead of AHEAD_M) {
            const x = feet.x + dx * ahead;
            const y = feet.y + dy * ahead;
            const hit = World.resolveGround(new Vector3(x, y, feet.z + 1), { up: 1.5, down: 4 });
            if (hit !== null && WATER.test(hit.surface)) {
                found = { x: hit.position.x, y: hit.position.y, z: hit.position.z };
                break;
            }
        }
        lastPose = pose;
        lastPoseAt = now;
        lastGround = found;
        return found;
    };

    const look = (): void => {
        const me = LocalPlayer;
        if (value < 0 || value >= QUENCHED_AT || !me?.ready || !me.alive || me.mounted || Date.now() - pressedAt < AFTER_PRESS_MS || getPersonInView() || furnitureBusy() || Hud.isInDialogue() || !Controls.isEnabled()) {
            remove();
            return;
        }
        water = find();
        if (water === null) {
            remove();
            return;
        }
        if (!hint) {
            hint = ActionHint.create({ key: DRINK_KEY, text: "Beber água" }, press);
        }
    };

    const timer = setInterval(look, LOOK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            remove();
        }
    });
}
