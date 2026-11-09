/**
 * What an NPC says, where the players near it can read it, and the way it stands (2026-11-02, user: "quando falar com um NPC ele deve se virar para o jogador e após sair deve voltar à
 * orientação dele; além disso as frases dele e dos NPCs não estão saindo nem aparecendo: o correto devia ser uma sequência de diálogo").
 *
 * The game's line over the body (`npc.say`) did not reach the players' screens: nothing an NPC said was read, neither the vendors' answers nor the townsfolk's greetings nor the bandits'
 * shouts. So a line still goes over the body, and goes besides to the chat card of each player within earshot, as speech with the NPC as its author (`Chat.sendToPlayer` with
 * `author`, the way the local T chat's lines go), in the order the lines are said; and the NPC's mouth moves for as long as the line takes to say (`setTalking`).
 *
 * An NPC talked to turns to the player (`lookAt`, by the module that talks), and `faceAhead` turns it back to its own way when the talk is over.
 */

export const speechSettings = {
    /** How far an NPC's plain line carries. */
    nearM: 12,
    /** And up or down: a line is not heard through a floor. */
    nearZ: 8,
    /** How long a line takes to say: this much a letter, within these bounds. */
    msPerLetter: 55,
    minMs: 1_500,
    maxMs: 6_000,
    /** The colour of an NPC's line in the chat card (0xRRGGBBAA): the parchment's brown, apart from the players' own. */
    color: 0x8a5a2bff,
};

/** How long a line takes to say, in milliseconds. */
export function speechMs(text: string): number {
    return Math.max(speechSettings.minMs, Math.min(speechSettings.maxMs, text.length * speechSettings.msPerLetter));
}

/** Until when each NPC's mouth moves, by NPC id. */
const talkingUntil = new Map<number, number>();

function mouth(npc: Npc, ms: number, now: number): void {
    const was = talkingUntil.get(npc.id) ?? 0;
    talkingUntil.set(npc.id, Math.max(was, now + ms));
    if (was > now) {
        // Already talking: the timer that is running reads the new end.
        return;
    }
    try {
        npc.setTalking(true);
    } catch {
        talkingUntil.delete(npc.id);
        return;
    }
    const id = npc.id;
    const stop = (): void => {
        const left = (talkingUntil.get(id) ?? 0) - Date.now();
        if (left > 50) {
            setTimeout(stop, left);
            return;
        }
        talkingUntil.delete(id);
        try {
            Npc.getById(id)?.setTalking(false);
        } catch {
            // Gone.
        }
    };
    setTimeout(stop, ms);
}

/** The players within `radiusM` of an NPC, read once. */
function playersNear(npc: Npc, radiusM: number): Player[] {
    let x: number;
    let y: number;
    let z: number;
    try {
        const at = npc.position;
        ({ x, y, z } = at);
    } catch {
        return [];
    }
    const near: Player[] = [];
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        const at = player.position;
        if (Math.hypot(at.x - x, at.y - y) <= radiusM && Math.abs(at.z - z) <= speechSettings.nearZ) {
            near.push(player);
        }
    }
    return near;
}

/**
 * An NPC says a line: over its body (the game's), in the chat card of `to` (a conversation's player) or of every player within `radiusM` of it, with its mouth moving. Returns how many
 * players were given it in the chat.
 */
export function speak(npc: Npc, author: string, text: string, options: { readonly radiusM?: number; readonly to?: readonly Player[] } = {}, now = Date.now()): number {
    const line = text.trim();
    if (line === "") {
        return 0;
    }
    try {
        npc.say(line.slice(0, 256));
    } catch {
        // A body that is gone says nothing.
        return 0;
    }
    mouth(npc, speechMs(line), now);
    const readers = options.to ?? playersNear(npc, options.radiusM ?? speechSettings.nearM);
    let told = 0;
    for (const reader of readers) {
        try {
            Chat.sendToPlayer(reader, line, { author, color: speechSettings.color });
            told += 1;
        } catch {
            // Gone.
        }
    }
    return told;
}

/** A page's line said by its NPC: "Mestre Ferreiro de Suchdol: O ferro não espera." is said by "Mestre Ferreiro de Suchdol" as "O ferro não espera."; a line without a speaker is said whole. */
export function splitSpeaker(line: string, fallback: string): { readonly author: string; readonly text: string } {
    const at = line.indexOf(": ");
    if (at > 0 && at <= 60 && !/[.!?]/.test(line.slice(0, at))) {
        return { author: line.slice(0, at), text: line.slice(at + 2) };
    }
    return { author: fallback, text: line };
}

/** Who talked to each NPC last, by NPC id: only their talk's end turns it back. */
const lastTalker = new Map<number, number>();

/** How often the end of a talk is looked for, and for how long at most. */
export const turnBackSettings = { firstMs: 1_500, everyMs: 1_000, longestMs: 120_000 };

/**
 * After a talk: the NPC turns back to its own way (`faceAhead`) once the player has neither a conversation nor a trade open (looked at every second, for two minutes at most). A player
 * who talks to it after this one takes the turning over: it waits for their talk instead.
 */
export function turnBackAfterTalk(npc: Npc, player: Player, yaw: number, now = Date.now()): void {
    const npcId = npc.id;
    const playerId = player.id;
    lastTalker.set(npcId, playerId);
    const look = (): void => {
        if (lastTalker.get(npcId) !== playerId) {
            return;
        }
        const body = Npc.getById(npcId);
        if (body === null || !body.alive) {
            lastTalker.delete(npcId);
            return;
        }
        let busy = false;
        try {
            busy = Dialogue.sessionOf(playerId) !== 0 || Vendor.sessionOf(playerId) !== 0;
        } catch {
            busy = false;
        }
        if (busy && Date.now() - now < turnBackSettings.longestMs) {
            setTimeout(look, turnBackSettings.everyMs);
            return;
        }
        lastTalker.delete(npcId);
        faceAhead(body, yaw);
    };
    setTimeout(look, turnBackSettings.firstMs);
}

/** Turns an NPC back to the way it stood (`yaw` in degrees, 0 being +Y as the level's, `place.ts`): it looks at a point ten metres ahead of it, at the height of a face. */
export function faceAhead(npc: Npc, yaw: number): boolean {
    try {
        const at = npc.position;
        const angle = (yaw * Math.PI) / 180;
        return npc.lookAt({ x: at.x - Math.sin(angle) * 10, y: at.y + Math.cos(angle) * 10, z: at.z + 1.6 });
    } catch {
        return false;
    }
}
