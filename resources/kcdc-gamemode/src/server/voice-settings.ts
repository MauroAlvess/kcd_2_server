/**
 * How each player's microphone opens, and how far the three voices carry, told to the voice indicator (`client/voice.ts`, 2026-10-23: "o
 * mod permite tirar do push para open o tempo inteiro"; "vamos criar um retângulo ... com a cor do alcance, sussurro, fala e grito").
 *
 * The microphone is held to talk by default, on the mod's own key, H (2026-11-09: "vamos deixar pré-ativo o de segurar para falar"), and the player may open it from the panel's Opções (it then sends
 * whenever the player speaks, with the noise of the room filtered). The choice is kept by Steam id with the other options (`options.ts`). The client asks
 * for it once it is in the world (`voice.get`), says what it chose (`voice.set`), and is answered with the whole of what is kept and the
 * radius of each voice -- whisper, speech and shout, as the server has them (`Voice.getTierRange`) -- which the indicator writes beside the
 * name of the range the player is on.
 */

import { chooseOptions, isMicMode, isSensitivity, optionsOf } from "./options.js";

const RESOURCE = "kcdc-gamemode";
export const VOICE_STATE = `${RESOURCE}:voice.state`;
const GET = `${RESOURCE}:voice.get`;
const SET = `${RESOURCE}:voice.set`;

/** What the game has when the server has not been asked: the framework's own, whisper 3, speech 15, shout 25. */
export const FALLBACK_RANGES: readonly number[] = [3, 15, 25];

/** The radius of whisper, speech and shout, in metres. */
export function rangesNow(): number[] {
    try {
        return [0, 1, 2].map((tier, index) => {
            const range = Voice.getTierRange(tier);
            return Number.isFinite(range) && range > 0 ? Math.round(range) : (FALLBACK_RANGES[index] as number);
        });
    } catch {
        return [...FALLBACK_RANGES];
    }
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 256) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function answer(player: Player, mic: string, sensitivity: string): void {
    try {
        player.emit(VOICE_STATE, JSON.stringify({ mic, sensitivity, ranges: rangesNow() }));
    } catch {
        // Gone already.
    }
}

export function installVoiceSettings(): void {
    Events.onClient(GET, (sender) => {
        const player = sender as Player;
        const kept = optionsOf(player.steamId);
        answer(player, kept.mic, kept.sensitivity);
    });
    Events.onClient(SET, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const change = { mic: fields["mic"], sensitivity: fields["sensitivity"] };
        const kept = chooseOptions(player.steamId, change);
        // Somebody with no Steam id keeps nothing: what they chose is what they are told, for as long as they are here.
        if (player.steamId === "") {
            answer(player, isMicMode(change.mic) ? change.mic : kept.mic, isSensitivity(change.sensitivity) ? change.sensitivity : kept.sensitivity);
            return;
        }
        answer(player, kept.mic, kept.sensitivity);
    });
}
