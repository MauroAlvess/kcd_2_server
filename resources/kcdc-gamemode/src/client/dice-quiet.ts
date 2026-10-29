/**
 * Dice matches, seen from the other players (2026-10-20: "o som dos dados caindo na mesa tá indo para todos os jogadores enquanto
 * jogadores jogam dados, igual à fogueira"; "quando um jogador estiver jogando dados não deve ter como interagir com ele quem
 * estiver por fora do jogo").
 *
 * The two bodies at the table play the game's dice animations (the male and female `dice_in`, `dice_throw_*`, `dice_new_turn`, `dice_out`
 * and the rest), and each carries `audio_trigger`
 * events (`dice_shake`, `dice_table`, `dice_bowl_*`, `dice_foley1`, `dice_wood1`...) that are FMOD events of the `special` bank
 * (`event:/special/dice/...`): sounds made for the player's own head, so every machine that plays the body plays them at full volume,
 * wherever it is, as with the fire's `special_player_cooking` (`kcd2-player-only-animation-sounds`). The server says which players are
 * in a match (`dice.busy`); here every machine that is not at that table stops those triggers on the two bodies (and on the table's own
 * entity) many times a second, and leaves the table's players their own sounds. And a player in a match is nobody's to talk to,
 * follow or trade with: `playingDice` is what the hints of the talk key and of the follow key ask.
 */

const RESOURCE = "kcdc-gamemode";
const BUSY = `${RESOURCE}:dice.busy`;

/** The game's triggers a dice animation fires (`Libs/GameAudio/special.xml`, every `event:/special/dice/` row the animations name). */
export const DICE_SOUNDS: readonly string[] = [
    "dice_shake",
    "dice_shake_player",
    "dice_bowl_handling1",
    "dice_bowl_handling2",
    "dice_bowl_take",
    "dice_bowl_put",
    "dice_bowl_put_player",
    "dice_to_bowl",
    "dice_table",
    "dice_table_short",
    "dice_foley1",
    "dice_wood1",
    "dice_wood1_player",
    "dice_put",
    "dice_take",
    "dice_won",
    "dice_lost",
];

/** How often the sounds are stopped: a sound left to play for longer than this is a click, not the whole fall of the dice. */
export const QUIET_EVERY_MS = 60;

/** How far from the table's centre its own entity is looked for, and its class (`DiceTableInfo`: the table is a smart object holder). */
export const TABLE_ENTITY_M = 3;
const TABLE_CLASS = "SmartObjectHolder";

export interface Match {
    /** Network ids of the two players. */
    readonly ids: readonly number[];
    /** The table's centre. */
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
}

let matches: readonly Match[] = [];

/** Whether the server says this player is in a dice match now. */
export function playingDice(id: number): boolean {
    return matches.some((match) => match.ids.includes(id));
}

/** What the server last said, as the matches it knows (for tests). */
export function diceMatches(): readonly Match[] {
    return matches;
}

function parse(payload: unknown): readonly Match[] {
    let value: unknown = payload;
    if (typeof payload === "string") {
        try {
            value = JSON.parse(payload) as unknown;
        } catch {
            return [];
        }
    }
    const list = typeof value === "object" && value !== null ? (value as { matches?: unknown }).matches : undefined;
    if (!Array.isArray(list)) {
        return [];
    }
    const made: Match[] = [];
    for (const raw of list.slice(0, 32)) {
        const entry = typeof raw === "object" && raw !== null ? (raw as { ids?: unknown; at?: unknown }) : {};
        const at = typeof entry.at === "object" && entry.at !== null ? (entry.at as { x?: unknown; y?: unknown; z?: unknown }) : {};
        if (!Array.isArray(entry.ids) || entry.ids.length === 0 || !entry.ids.every((id) => Number.isSafeInteger(id)) || ![at.x, at.y, at.z].every((n) => typeof n === "number" && Number.isFinite(n))) {
            continue;
        }
        made.push({ ids: entry.ids as number[], at: { x: at.x as number, y: at.y as number, z: at.z as number } });
    }
    return made;
}

export function installDiceQuiet(): void {
    Events.on(BUSY, (payload) => {
        matches = parse(payload);
    });

    const quiet = (): void => {
        const me = LocalPlayer;
        if (matches.length === 0 || !me?.ready) {
            return;
        }
        for (const match of matches) {
            // The table's own players keep the sounds of their game.
            if (match.ids.includes(me.id)) {
                continue;
            }
            for (const id of match.ids) {
                let entity = 0;
                try {
                    entity = new Player(id).entityId;
                } catch {
                    // Not on this machine (yet): nothing to silence.
                }
                if (entity > 0) {
                    for (const trigger of DICE_SOUNDS) {
                        Audio.stopOnEntity(trigger, entity);
                    }
                }
            }
            try {
                for (const holder of World.entitiesInRadius(new Vector3(match.at.x, match.at.y, match.at.z), TABLE_ENTITY_M, { class: TABLE_CLASS, max: 4 })) {
                    Audio.stopAllOnEntity(holder.entityId);
                }
            } catch {
                // The table is not streamed in here: its sounds are not made here either.
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
            matches = [];
        }
    });
}
