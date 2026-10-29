/**
 * The other players' horses, heard only from near (players, 2026-10-26: "sempre que alguém sobe no cavalo, escutam de longe"). Server:
 * `mount-sound.ts`, which says who rides and who has just got on or off a horse.
 *
 * Getting on or off plays the game's animation on the rider and the horse on every machine, with its foley; and a horse with a rider gets
 * the sounds the game makes for the player's own horse (its hoofsteps, its breath, its answer to a call), which carry far or are not cut by
 * distance at all, the listener's own horse being the only one in single player. Here, every few frames, those sounds are stopped on each
 * rider and on the horse under them when they are further than this machine's player can be expected to hear: the player's-own-horse sounds
 * from `NEAR_M`, every sound of the horse from `HEAR_M`. What leaks past the stop is a click, as the dice's (`dice-quiet.ts`).
 *
 * The horse is found by the engine's own query round the rider (`World.entitiesInRadius`): an entity of a horse's class beside them. If
 * there is none, the nearest other entity there is given the horse's triggers one by one (they mean nothing to anything else), and the
 * classes that were there are told to the server once, for its log, so the class can be learned.
 */

const RESOURCE = "kcdc-gamemode";
const SOUNDS = `${RESOURCE}:mount.sounds`;
const SEEN = `${RESOURCE}:mount.seen`;

/** Beyond this, nothing of a rider's horse is heard here, in metres. */
export const HEAR_M = 30;
/** Beyond this, the sounds the game makes for the player's own horse (which it does not cut by distance) are stopped. */
export const NEAR_M = 15;
/** How often the sounds are stopped. */
export const QUIET_EVERY_MS = 80;
/** A list the server has not repeated for this long is forgotten (it says it again every 3 s while somebody rides). */
export const STALE_MS = 10_000;
/** The horse under a rider is looked for this often, and kept in between. */
export const LOOK_EVERY_MS = 1_000;
/** How far from the rider's body the horse is looked for. */
export const LOOK_RADIUS_M = 2.5;
/** An engine class that is a horse's. */
export const HORSE_CLASS = /horse/i;

/** The get-on and the get-off (`horse.animevents`, `male.animevents`: the rows the mount animations name). */
export const MOUNT_SOUNDS: readonly string[] = [
    "a_o_horse_gear_medium",
    "a_o_horse_gear_soft",
    "a_o_horse_saddle_foley",
    "a_o_horse_snort_lower_probability",
    "f_ge_horse_mount_handle_tap",
    "f_ge_handle_manipulation",
    "f_ge_handle_grab",
    "fs_n_horse_jump_ground",
];

/** What the game makes for the player's own horse, carrying 219 m or not cut by distance (`Libs/GameAudio/animals.xml`, `hoofsteps.xml`). */
export const OWN_HORSE_SOUNDS: readonly string[] = [
    "horse_stamina",
    "a_o_horse_excited_inventory",
    "a_o_horse_radar_feedback_loud",
    "a_o_horse_radar_feedback_soft",
    "special_haptic_horse_quickstart",
    "a_o_jump_start",
    ...["bushes", "forest", "grass", "grass_tall", "grassdry", "gravel", "mud", "mudwater", "rock", "soil", "thatch", "water", "wood"].flatMap((ground) =>
        ["", "_canter", "_gallop", "_trot"].map((pace) => `hs_hp_${ground}${pace}`),
    ),
];

let riders: readonly number[] = [];
let heardAt = 0;

/** What the server last said: the network ids of the riders (for tests). */
export function ridersHeard(): readonly number[] {
    return riders;
}

function parse(payload: unknown): number[] {
    let value: unknown = payload;
    if (typeof payload === "string") {
        try {
            value = JSON.parse(payload) as unknown;
        } catch {
            return [];
        }
    }
    const list = typeof value === "object" && value !== null ? (value as { r?: unknown }).r : undefined;
    if (!Array.isArray(list)) {
        return [];
    }
    return list.slice(0, 128).filter((id): id is number => Number.isSafeInteger(id) && (id as number) > 0);
}

interface Found {
    readonly at: number;
    /** The horse's entity, or 0 when none of a horse's class was there. */
    readonly horse: number;
    /** The nearest other entity, when no horse was found: given the horse's triggers one by one. */
    readonly other: number;
}

export function installMountQuiet(): void {
    const found = new Map<number, Found>();
    let toldSeen = false;

    Events.on(SOUNDS, (payload) => {
        riders = parse(payload);
        heardAt = Date.now();
        for (const id of [...found.keys()]) {
            if (!riders.includes(id)) {
                found.delete(id);
            }
        }
    });

    const look = (rider: number, entity: number, position: { x: number; y: number; z: number }, now: number): Found => {
        const kept = found.get(rider);
        if (kept !== undefined && now - kept.at < LOOK_EVERY_MS) {
            return kept;
        }
        let horse = 0;
        let other = 0;
        const classes: string[] = [];
        try {
            const near = World.entitiesInRadius(new Vector3(position.x, position.y, position.z), LOOK_RADIUS_M, { max: 8 });
            for (const one of near) {
                if (one.entityId === entity || one.entityId <= 0) {
                    continue;
                }
                classes.push(one.class);
                if (horse === 0 && HORSE_CLASS.test(one.class)) {
                    horse = one.entityId;
                }
                if (other === 0) {
                    other = one.entityId;
                }
            }
        } catch {
            // The query is not there (a level loading): the rider alone this time.
        }
        if (horse === 0 && classes.length > 0 && !toldSeen) {
            toldSeen = true;
            try {
                Events.emitServer(SEEN, JSON.stringify({ c: [...new Set(classes)] }));
            } catch {
                // Not connected: nothing to tell.
            }
        }
        const made = { at: now, horse, other: horse === 0 ? other : 0 };
        found.set(rider, made);
        return made;
    };

    const quiet = (): void => {
        const me = LocalPlayer;
        if (riders.length === 0 || !me?.ready) {
            return;
        }
        const now = Date.now();
        if (now - heardAt > STALE_MS) {
            riders = [];
            found.clear();
            return;
        }
        // Where the player is, read once for the round (it was read three times for every rider, every 80 ms; 2026-10-27).
        const mine = me.position;
        for (const id of riders) {
            if (id === me.id) {
                continue;
            }
            let entity = 0;
            let position = { x: 0, y: 0, z: 0 };
            let distance = 0;
            try {
                const other = new Player(id);
                entity = other.entityId;
                const at = other.position;
                position = { x: at.x, y: at.y, z: at.z };
                distance = Math.hypot(position.x - mine.x, position.y - mine.y, position.z - mine.z);
            } catch {
                // Not on this machine (yet): nothing to silence.
            }
            if (entity <= 0 || distance <= NEAR_M) {
                continue;
            }
            const all = distance > HEAR_M;
            const triggers = all ? [...MOUNT_SOUNDS, ...OWN_HORSE_SOUNDS] : OWN_HORSE_SOUNDS;
            for (const trigger of triggers) {
                Audio.stopOnEntity(trigger, entity);
            }
            const under = look(id, entity, position, now);
            if (under.horse > 0) {
                if (all) {
                    Audio.stopAllOnEntity(under.horse);
                } else {
                    for (const trigger of OWN_HORSE_SOUNDS) {
                        Audio.stopOnEntity(trigger, under.horse);
                    }
                }
            } else if (under.other > 0) {
                for (const trigger of triggers) {
                    Audio.stopOnEntity(trigger, under.other);
                }
            }
        }
    };

    const timer = setInterval(() => {
        try {
            quiet();
        } catch {
            // A frame the audio system was not up: the next one.
        }
    }, QUIET_EVERY_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            riders = [];
            found.clear();
        }
    });
}
