/**
 * The welcome form's agreement (user, 2026-10-24: "todo jogador que criar um personagem, ou que já tenha criado ... vai receber um aviso, e quem
 * já criou, ao entrar, também, até aceitar ... ao concordar você afirma que leu as regras e está ciente da lore do servidor").
 *
 * Whoever has made a character is asked, by a page of ours (`client/welcome.ts`, `ui/welcome.html`), to agree that they have read the rules and
 * know the server's lore. The agreement is kept by Steam id in `playerdata/welcome.json`, together with the character it was made for (the
 * `createdAt` of the saved character): a player who starts over (`character-reset.ts`) makes a new character, and is asked again after making it;
 * one whose creator an administrator asked to open again (`askRedo`) is the same character, and is not. Everybody who already had a character
 * when this was written is asked at their next entry.
 *
 * The ask is sent as soon as the character exists and the player is in the world, and again every `askEveryMs` until they agree, because the
 * client holds the page back while the creator's camera, a conversation or another page has the screen; the picture of the title goes with
 * the first ask only. A client whose page cannot come up says so (`welcome.failed`), is told in the chat how to agree (`/aceitar`) and is not
 * asked by page again this session.
 */

import { getCharacter } from "./characters.js";
import { craftTitle } from "./craft-titles.js";
import { languageOf } from "./language.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
export const WELCOME_OPEN = `${RESOURCE}:welcome.open`;
export const WELCOME_DONE = `${RESOURCE}:welcome.done`;
const ACCEPT = `${RESOURCE}:welcome.accept`;
const FAILED = `${RESOURCE}:welcome.failed`;

const STEAM_ID = /^\d{5,20}$/;
const DIR = "playerdata";
const FILE = `${DIR}/welcome.json`;

export const welcomeSettings = {
    /** How often the players are looked at, and how often an ask is repeated to the same player. */
    lookEveryMs: 3_000,
    askEveryMs: 20_000,
};

/** The key of the title picture in `data/craft-titles.json`. */
export const TITLE_KEY = "boas-vindas";

interface Agreement {
    /** When they agreed (ms). */
    readonly at: number;
    /** The `createdAt` of the character they agreed for. */
    readonly character: number;
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

let agreed: Record<string, Agreement> = {};
/** Whoever has no Steam id cannot be kept; their agreement lasts as long as they are in. */
const sessionAgreed = new Set<number>();
const askedAt = new Map<number, number>();
const pictureSent = new Set<number>();
const pageFailed = new Set<number>();
let writable = true;

function persist(): boolean {
    try {
        ensureDir(DIR);
        write(FILE, agreed);
        return true;
    } catch (error: unknown) {
        console.log(`welcome: não consegui guardar as concordâncias: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export function loadWelcome(): void {
    const loaded = read<Record<string, Agreement>>(FILE);
    if (loaded.status === "ok" && typeof loaded.value === "object" && loaded.value !== null) {
        agreed = {};
        for (const [steamId, entry] of Object.entries(loaded.value)) {
            if (STEAM_ID.test(steamId) && typeof entry?.at === "number" && typeof entry.character === "number") {
                agreed[steamId] = { at: entry.at, character: entry.character };
            }
        }
        writable = true;
    } else if (loaded.status === "corrupt") {
        // Nothing is written over a file that could not be read: everybody would be asked again, and the old file kept for a person to look at.
        writable = false;
        console.log(`welcome: ${FILE} não pôde ser lido (${loaded.reason}); ninguém é gravado até isso ser visto`);
    }
}

/** Whether this player has agreed for the character they have now. */
export function hasAgreed(player: { readonly id: number; readonly steamId: string }): boolean {
    if (sessionAgreed.has(player.id)) {
        return true;
    }
    if (!STEAM_ID.test(player.steamId)) {
        return false;
    }
    const character = getCharacter(player.steamId);
    return character !== null && agreed[player.steamId]?.character === character.createdAt;
}

/** Whether the player is to be asked: in the world, with a character made, and not agreed yet. */
export function needsAsking(player: Player): boolean {
    return player.ready && STEAM_ID.test(player.steamId) && getCharacter(player.steamId) !== null && !hasAgreed(player);
}

/** The player agrees. Idempotent; refused for somebody with no character made or no Steam id to keep it under. */
export function agree(player: Player, now = Date.now()): Outcome {
    if (hasAgreed(player)) {
        return { ok: true, message: "" };
    }
    const character = STEAM_ID.test(player.steamId) ? getCharacter(player.steamId) : null;
    if (character === null) {
        return { ok: false, message: "Primeiro é preciso criar o personagem; depois você concorda com as regras." };
    }
    if (!writable) {
        sessionAgreed.add(player.id);
        return { ok: true, message: "" };
    }
    const before = agreed[player.steamId];
    agreed[player.steamId] = { at: now, character: character.createdAt };
    if (!persist()) {
        if (before === undefined) {
            delete agreed[player.steamId];
        } else {
            agreed[player.steamId] = before;
        }
        return { ok: false, message: "Não consegui guardar a sua concordância agora; tente de novo em instantes." };
    }
    console.log(`welcome: ${player.nickname} concordou com as regras e a lore (personagem de ${new Date(character.createdAt).toISOString().slice(0, 10)})`);
    return { ok: true, message: "" };
}

/** What the player is told once they have agreed. */
export function thanksText(): string {
    return "Que a sorte lhe acompanhe, viajante. As regras e a história do reino estão sempre à mão: no menu F2, em Informações, e no nosso site.";
}

/** The ask, for a player: the language, and the title picture the first time. */
export function askFor(player: Player): string {
    const first = !pictureSent.has(player.id);
    pictureSent.add(player.id);
    const img = first ? craftTitle(TITLE_KEY) : "";
    return JSON.stringify({ lang: languageOf(player), ...(img === "" ? {} : { img }) });
}

/** Puts the page up for a player now, whether or not they have agreed (the administrator's `/boasvindas`: to see how it looks). */
export function showTo(player: Player): void {
    pictureSent.delete(player.id);
    pageFailed.delete(player.id);
    player.emit(WELCOME_OPEN, askFor(player));
}

export function lookAtPlayers(now = Date.now()): void {
    for (const player of Player.all()) {
        if (!needsAsking(player) || pageFailed.has(player.id)) {
            continue;
        }
        if (now - (askedAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < welcomeSettings.askEveryMs) {
            continue;
        }
        askedAt.set(player.id, now);
        try {
            player.emit(WELCOME_OPEN, askFor(player));
        } catch {
            // Gone already.
        }
    }
}

/** The agreement as the chat's `/aceitar` and the page's button make it. */
export function agreeAndTell(player: Player): Outcome {
    const was = hasAgreed(player);
    const outcome = agree(player);
    if (!outcome.ok) {
        Chat.sendToPlayer(player, outcome.message);
        return outcome;
    }
    try {
        player.emit(WELCOME_DONE, "{}");
    } catch {
        // Gone already.
    }
    if (!was) {
        Chat.sendToPlayer(player, thanksText());
        player.emit(`${RESOURCE}:notify`, JSON.stringify({ text: "Concordância guardada. Boa jornada!" }));
    }
    return outcome;
}

export function installWelcome(): void {
    loadWelcome();
    Events.onClient(ACCEPT, (sender) => {
        agreeAndTell(sender as Player);
    });
    Events.onClient(FAILED, (sender, payload) => {
        const player = sender as Player;
        if (pageFailed.has(player.id)) {
            return;
        }
        pageFailed.add(player.id);
        console.log(`welcome: a página de ${player.nickname} não abriu: ${typeof payload === "string" ? payload.slice(0, 200) : "?"}`);
        if (needsAsking(player)) {
            Chat.sendToPlayer(player, "A janela de boas-vindas não abriu no seu jogo. Leia as regras no menu F2 (Informações) e no nosso site e digite /aceitar para concordar com elas e com a lore do servidor.");
        }
    });
    Events.on("playerDisconnect", (player) => {
        askedAt.delete(player.id);
        pictureSent.delete(player.id);
        pageFailed.delete(player.id);
        sessionAgreed.delete(player.id);
    });
    const timer = setInterval(() => lookAtPlayers(), welcomeSettings.lookEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`welcome: ${Object.keys(agreed).length} concordância(s) guardada(s); quem tem personagem e ainda não concordou é perguntado a cada ${welcomeSettings.askEveryMs / 1000} s`);
}
