/**
 * A bandit's shout in a fight (2026-11-01, user: "vamos deixar os bandidos dando grito e sendo inteligentes nos combates"): the server says which of the game's own voice
 * triggers to play and where (`server/bandits.ts` `shout`), to the players within 45 m of the man, and this plays it there, positioned against this player's ears. The line
 * itself is the server's `npc.say`, over the man's head.
 */

const RESOURCE = "kcdc-gamemode";

export const SHOUT_EVENT = `${RESOURCE}:bandit.shout`;

/** The game's voice triggers (`Libs/GameAudio/voices.xml`) a shout may be, and nothing else: whatever else a payload names is not played. */
export const SHOUT_TRIGGERS: ReadonlySet<string> = new Set([
    "v_soldier_1_attack",
    "v_soldier_2_attack",
    "v_attack",
    "v_soldier_1_hit",
    "v_soldier_2_hit",
    "v_male_injured_reaction1",
    "v_sipping_potion",
    "v_male_scream_in_pain1",
]);

/** Plays the shout a payload names (`{ t, x, y, z }`): true when the audio system took it. */
export function playShout(payload: unknown): boolean {
    let fields: unknown = payload;
    if (typeof payload === "string") {
        try {
            fields = JSON.parse(payload) as unknown;
        } catch {
            return false;
        }
    }
    if (typeof fields !== "object" || fields === null) {
        return false;
    }
    const { t, x, y, z } = fields as { t?: unknown; x?: unknown; y?: unknown; z?: unknown };
    if (typeof t !== "string" || !SHOUT_TRIGGERS.has(t) || typeof x !== "number" || typeof y !== "number" || typeof z !== "number" || ![x, y, z].every(Number.isFinite)) {
        return false;
    }
    try {
        return Audio.hasTrigger(t) && Audio.playAt(t, new Vector3(x, y, z));
    } catch {
        return false;
    }
}

export function installBanditShouts(): void {
    Events.on(SHOUT_EVENT, (payload) => {
        playShout(payload);
    });
}
