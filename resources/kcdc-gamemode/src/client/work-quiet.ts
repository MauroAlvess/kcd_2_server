/**
 * The loud works of the other players, kept to those near (2026-10-23: "o barulho de cortar madeira e minerar só pode dar para escutar em
 * quem estiver perto"). Server: `work-sound.ts`.
 *
 * A woodcutter's, a miner's or a farmer's animation fires the game's foley on its body on every machine that plays it (`event:/foleys/
 * professions/...`, which the game lets carry 30 m for the axe and the pick and 20 m for the shovel: its NPC craftsmen's, for a village
 * square). The server says who is working at what (`work.sounds`); here, every few frames, the triggers of each worker's kind are stopped
 * on the body of every worker further than `HEAR_M` from this machine's player. The workers' own machines, and anyone within `HEAR_M`,
 * keep the sound. What leaks past the stop is a click, as the dice's (`dice-quiet.ts`).
 */

const RESOURCE = "kcdc-gamemode";
const SOUNDS = `${RESOURCE}:work.sounds`;

/** How far from a worker his work is heard, in metres. */
export const HEAR_M = 12;

/** How often the sounds are stopped: a sound left to play for longer than this is a click, not a blow. */
export const QUIET_EVERY_MS = 60;

/** A list the server has not repeated for this long is forgotten (it says it again every 4 s while somebody works). */
export const STALE_MS = 12_000;

/** The game's triggers each work fires (`Libs/GameAudio/foleys.xml`, `animals.xml`: the rows the animations' `.animevents` name). */
export const WORK_SOUNDS: Readonly<Record<string, readonly string[]>> = {
    lenha: ["f_lu_axe_log2", "f_lu_axe_log2_louder"],
    mina: ["f_sto_pickaxe_stone", "f_sto_stone_falling", "f_sto_hammer_chisel_stone", "f_vi_pickaxe_soil", "f_pe_hoe_unstuck"],
    horta: [
        "f_pe_shovel1_use",
        "f_pe_shovel2_use",
        "f_pe_shovel1_use_plr",
        "f_pe_shovel1_use_var_plr",
        "f_pe_shovel2_use_plr",
        "f_pe_hoe_use",
        "f_pe_hoe_squeak",
        "f_pe_hoe_unstuck",
        "f_pe_stone_from_ground",
        "b_sheep_eat",
        "a_o_horse_eating_grass",
        "f_ge_handle_grab",
        "f_ge_handle_manipulation",
    ],
};

export type Worker = readonly [id: number, kind: string];

let workers: readonly Worker[] = [];
let heardAt = 0;

/** What the server last said, as `[id, kind]` pairs (for tests). */
export function workersHeard(): readonly Worker[] {
    return workers;
}

function parse(payload: unknown): Worker[] {
    let value: unknown = payload;
    if (typeof payload === "string") {
        try {
            value = JSON.parse(payload) as unknown;
        } catch {
            return [];
        }
    }
    const list = typeof value === "object" && value !== null ? (value as { w?: unknown }).w : undefined;
    if (!Array.isArray(list)) {
        return [];
    }
    const made: Worker[] = [];
    for (const row of list.slice(0, 64)) {
        if (Array.isArray(row) && row.length === 2 && Number.isSafeInteger(row[0]) && typeof row[1] === "string") {
            made.push([row[0] as number, row[1]]);
        }
    }
    return made;
}

export function installWorkQuiet(): void {
    Events.on(SOUNDS, (payload) => {
        workers = parse(payload);
        heardAt = Date.now();
    });

    const quiet = (): void => {
        const me = LocalPlayer;
        if (workers.length === 0 || !me?.ready) {
            return;
        }
        if (Date.now() - heardAt > STALE_MS) {
            workers = [];
            return;
        }
        for (const [id, kind] of workers) {
            const triggers = WORK_SOUNDS[kind];
            if (id === me.id || triggers === undefined) {
                continue;
            }
            let entity = 0;
            let far = false;
            try {
                const other = new Player(id);
                entity = other.entityId;
                far = Math.hypot(other.position.x - me.position.x, other.position.y - me.position.y, other.position.z - me.position.z) > HEAR_M;
            } catch {
                // Not on this machine (yet): nothing to silence.
            }
            if (entity > 0 && far) {
                for (const trigger of triggers) {
                    Audio.stopOnEntity(trigger, entity);
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
            workers = [];
        }
    });
}
