/**
 * The door of the server (user, 2026-10-29: "vamos modificar o sistema de whitelist: agora qualquer um pode entrar no servidor; ao entrar vai aparecer um trailer nosso ... o texto ESC no canto
 * superior direito para poder pular o trailer; depois uma hub de boas-vindas com 10 perguntas de múltipla escolha e, com base nas respostas, decide se ele foi ou não aprovado para jogar ...
 * todo jogador deve passar por isso agora a primeira vez, até quem já tem personagem").
 *
 * Anyone may connect (the Steam list is switched off: `kcdc-whitelist enforce off`); the list of approved players is this module's. A player whose Steam id has not passed is PENDING: the page
 * of the door (`client/entry.ts`, `ui/entry.html`) is put up for them as soon as their body is ready, the hub with the questions of `entry-quiz.ts` (the trailer that played first at every entry was taken out on 2026-11-09: "vamos remover o trailer"). The
 * answers come back as the PLACES picked and are graded here, where the right ones are kept; `PASS_SCORE` of ten opens the door. A failed attempt waits `cooldownMs` for the next. The door
 * is opened by the page (`entry.finish`) or, if it never says so, `releaseAfterMs` after the pass: the listeners (`whenAdmitted`) then run, which is what opens the character creator for a
 * newcomer (`first-join.ts`).
 *
 * While a player is pending the server drops every message their client sends but the ones of the door and the creator (`installEntryGate`, installed before perf-watch like the arrest's),
 * and every chat command but a few: nobody plays, speaks or trades before they are approved. An administrator is never held by it, and `/entrada` approves or resets a player.
 * Approvals are kept by Steam id in `playerdata/entry.json`; a file that cannot be read is never written over (the approvals then last the session).
 */

import { isAdmin } from "./auth.js";
import { addCommandGate } from "./command.js";
import { craftTitle } from "./craft-titles.js";
import { languageOf } from "./language.js";
import { ensureDir, read, write } from "./store.js";
import { draw, grade, PASS_SCORE, QUESTIONS_PER_ATTEMPT, view } from "./entry-quiz.js";
import type { Attempt } from "./entry-quiz.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/entry.json`;

/** Server to client. */
const OPEN = `${RESOURCE}:entry.open`;
const QUESTIONS = `${RESOURCE}:entry.questions`;
const RESULT = `${RESOURCE}:entry.result`;
const CLOSE = `${RESOURCE}:entry.close`;
/** Client to server. */
const SHOWN = "entry.shown";
const START = "entry.start";
const ANSWER = "entry.answer";
const FINISH = "entry.finish";
const FAILED = "entry.failed";

const STEAM_ID = /^\d{5,20}$/;

export const entrySettings = {
    /** How often the door is put up again for a pending player whose page has not said it is there, and how often they are looked at. */
    askEveryMs: 5_000,
    lookEveryMs: 2_000,
    /** How long a failed attempt waits for the next. */
    cooldownMs: 30_000,
    /** How long a pass waits for the page to say it is done before the door opens anyway. */
    releaseAfterMs: 30_000,
};

/** The messages of the client a pending player may still send: the door's own, the creator's (the next step), and what keeps the client in the game. */
export const ALLOWED_WHILE_PENDING: ReadonlySet<string> = new Set([
    SHOWN, START, ANSWER, FINISH, FAILED,
    "creator.preview", "creator.check", "creator.accept", "creator.cancel", "creator.dress", "creator.failed",
    "players.peek", "options.get", "options.set", "posture", "combat.sync", "dice.sync", "status.dict", "status.lang", "status.image", "panel.poll",
]);

/** The chat commands a pending player may still type. */
export const ALLOWED_COMMANDS_WHILE_PENDING: ReadonlySet<string> = new Set(["help", "idioma", "language", "admin"]);

interface Entry {
    /** When they passed; 0 for not yet. */
    passed: number;
    /** The best score so far. */
    score: number;
    attempts: number;
    /** When the last attempt was graded. */
    lastAt: number;
    /** What they were called when last seen, for the administrators' list. */
    name: string;
}

let records: { [steamId: string]: Entry } = {};
let writable = true;
/** Players with no way to be kept (a corrupt file): their approval lasts as long as they are in. */
const sessionPassed = new Set<number>();
const attempts = new Map<number, Attempt>();
const shown = new Set<number>();
const failures = new Map<number, number>();
const askedAt = new Map<number, number>();
const pictureSent = new Set<number>();
const releaseTimers = new Map<number, ReturnType<typeof setTimeout>>();
const waiting = new Map<number, () => void>();
function persist(): boolean {
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, players: records });
        return true;
    } catch (error: unknown) {
        console.log(`entry: não consegui guardar as aprovações: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

function blank(name: string): Entry {
    return { passed: 0, score: 0, attempts: 0, lastAt: 0, name };
}

export function loadEntry(): void {
    const loaded = read<{ players?: { [steamId: string]: Partial<Entry> } }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value?.players === "object" && loaded.value.players !== null) {
        records = {};
        for (const [steamId, entry] of Object.entries(loaded.value.players)) {
            if (STEAM_ID.test(steamId) && entry !== null && typeof entry === "object") {
                const number = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);
                records[steamId] = { passed: number(entry.passed), score: number(entry.score), attempts: number(entry.attempts), lastAt: number(entry.lastAt), name: typeof entry.name === "string" ? entry.name.slice(0, 40) : "" };
            }
        }
        writable = true;
    } else if (loaded.status === "corrupt") {
        // Nothing is written over a file that could not be read: everybody would have to answer again, and the old file is kept for a person to look at.
        writable = false;
        console.log(`entry: ${FILE} não pôde ser lido (${loaded.reason}); ninguém é gravado até isso ser visto`);
    }
}

/** Whether the player has passed (for the character they have: this is the player's, not the character's). */
export function hasPassed(player: { readonly id: number; readonly steamId: string }): boolean {
    return sessionPassed.has(player.id) || (STEAM_ID.test(player.steamId) && (records[player.steamId]?.passed ?? 0) > 0);
}

/** Whether the door holds this player: they have a Steam id to be approved under and have not passed. */
export function isPending(player: { readonly id: number; readonly steamId: string }): boolean {
    return STEAM_ID.test(player.steamId) && !hasPassed(player);
}

/**
 * Runs `then` when the player is let through, or at once when they already are. One callback a player: a later call replaces the earlier (the creator is asked for at every spawn of
 * somebody who is still behind the door).
 */
export function whenAdmitted(player: { readonly id: number; readonly steamId: string }, then: () => void): void {
    if (!isPending(player)) {
        then();
        return;
    }
    waiting.set(player.id, then);
}

function send(player: Player, event: string, payload: unknown): void {
    try {
        player.emit(event, JSON.stringify(payload));
    } catch {
        // Gone already.
    }
}

function recordOf(player: Player): Entry {
    const kept = records[player.steamId] ?? (records[player.steamId] = blank(player.nickname));
    kept.name = player.nickname.slice(0, 40);
    return kept;
}

/** The door put up for a player: in which language, with how many questions and how many right ones. */
function openFor(player: Player): void {
    const first = !pictureSent.has(player.id);
    pictureSent.add(player.id);
    const img = first ? craftTitle("boas-vindas") : "";
    send(player, OPEN, { lang: languageOf(player), need: PASS_SCORE, total: QUESTIONS_PER_ATTEMPT, ...(img === "" ? {} : { img }) });
}

/** The door opens: the page goes, and whoever waited for it (the creator) goes on. */
export function release(player: Player): void {
    if (!hasPassed(player)) {
        return;
    }
    const timer = releaseTimers.get(player.id);
    if (timer !== undefined) {
        clearTimeout(timer);
        releaseTimers.delete(player.id);
    }
    shown.delete(player.id);
    attempts.delete(player.id);
    send(player, CLOSE, {});
    const then = waiting.get(player.id);
    waiting.delete(player.id);
    if (then !== undefined) {
        try {
            then();
        } catch (error: unknown) {
            console.log(`entry: o que esperava a porta falhou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/** Approves a player (the administrators' `/entrada aprovar`, and a pass). False when the approval could not be kept. */
export function approve(steamId: string, name: string, score: number = PASS_SCORE, now: number = Date.now()): boolean {
    if (!STEAM_ID.test(steamId)) {
        return false;
    }
    const before = records[steamId];
    const kept = before ?? blank(name);
    kept.name = name.slice(0, 40);
    kept.passed = now;
    kept.score = Math.max(kept.score, score);
    records[steamId] = kept;
    if (writable && !persist()) {
        if (before === undefined) {
            delete records[steamId];
        } else {
            records[steamId] = before;
        }
        return false;
    }
    return true;
}

/** Takes a player's approval back: they see the questions again. */
export function reset(steamId: string): boolean {
    const kept = records[steamId];
    if (kept === undefined) {
        return false;
    }
    kept.passed = 0;
    kept.score = 0;
    kept.attempts = 0;
    kept.lastAt = 0;
    if (writable) {
        persist();
    }
    return true;
}

export function entryStats(): { readonly passed: number; readonly known: number } {
    const all = Object.values(records);
    return { passed: all.filter((one) => one.passed > 0).length, known: all.length };
}

/** A pending player's attempt: ten questions, asked. */
function onStart(player: Player, now: number): void {
    if (!isPending(player)) {
        return;
    }
    const kept = recordOf(player);
    const waitLeft = kept.lastAt > 0 && kept.passed === 0 ? kept.lastAt + entrySettings.cooldownMs - now : 0;
    if (waitLeft > 0) {
        send(player, QUESTIONS, { wait: waitLeft });
        return;
    }
    const attempt = draw(now);
    attempts.set(player.id, attempt);
    send(player, QUESTIONS, { total: QUESTIONS_PER_ATTEMPT, need: PASS_SCORE, questions: view(attempt) });
}

/** The answers of an attempt: graded here; the page is told how many, never which. */
function onAnswer(player: Player, payload: unknown, now: number): void {
    const attempt = attempts.get(player.id);
    if (attempt === undefined || !isPending(player)) {
        return;
    }
    attempts.delete(player.id);
    const picks = Array.isArray(fieldsOf(payload)["picks"]) ? (fieldsOf(payload)["picks"] as unknown[]) : [];
    const score = grade(attempt, picks);
    const kept = recordOf(player);
    kept.attempts += 1;
    kept.lastAt = now;
    kept.score = Math.max(kept.score, score);
    const passed = score >= PASS_SCORE;
    if (passed) {
        kept.passed = now;
    }
    let stored = true;
    if (writable) {
        stored = persist();
    }
    if (passed && !stored) {
        // Not kept: the approval lasts this session at least, and the next entry asks again.
        sessionPassed.add(player.id);
    }
    console.log(`entry: ${player.nickname} acertou ${score} de ${QUESTIONS_PER_ATTEMPT}${passed ? ": aprovado" : `: não aprovado (a tentativa ${kept.attempts})`}`);
    send(player, RESULT, { score, total: QUESTIONS_PER_ATTEMPT, need: PASS_SCORE, passed, wait: passed ? 0 : entrySettings.cooldownMs });
    if (passed) {
        releaseTimers.set(player.id, setTimeout(() => {
            const live = Player.getById(player.id);
            if (live !== null) {
                release(live);
            }
        }, entrySettings.releaseAfterMs));
    }
}

function fieldsOf(payload: unknown): Dict {
    let value = payload;
    if (typeof value === "string" && value.length <= 2048) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Dict) : {};
}

type Dict = { [key: string]: unknown };

/** The door's messages are put up again for a pending player whose page has not said it is there. */
export function lookAtPlayers(now: number = Date.now()): void {
    for (const player of Player.all()) {
        if (!player.ready || !isPending(player) || shown.has(player.id) || (failures.get(player.id) ?? 0) >= 3) {
            continue;
        }
        if (now - (askedAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < entrySettings.askEveryMs) {
            continue;
        }
        askedAt.set(player.id, now);
        openFor(player);
    }
}

/**
 * Before any module registers a handler for its client's messages: what a pending player's client sends is dropped unless it is one of `ALLOWED_WHILE_PENDING` (installed beside the arrest's
 * gate, ahead of perf-watch). An administrator is never held.
 */
export function installEntryGate(): void {
    const bus = Events as unknown as { [name: string]: (name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]) => unknown };
    const real = bus["onClient"];
    if (typeof real !== "function") {
        return;
    }
    bus["onClient"] = function (this: unknown, name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]): unknown {
        if (typeof handler !== "function") {
            return real.call(this, name, handler, ...rest);
        }
        const short = name.startsWith(`${RESOURCE}:`) ? name.slice(RESOURCE.length + 1) : name;
        const gated = (sender: unknown, ...args: unknown[]): unknown => {
            if (typeof sender === "object" && sender !== null && !ALLOWED_WHILE_PENDING.has(short)) {
                const who = sender as { readonly id: number; readonly steamId: string };
                if (typeof who.steamId === "string" && isPending(who) && !isAdmin(sender as Player)) {
                    return undefined;
                }
            }
            return handler(sender, ...args);
        };
        return real.call(this, name, gated, ...rest);
    };
}

export function installEntry(): void {
    loadEntry();
    addCommandGate((player, name) => (isPending(player) && !ALLOWED_COMMANDS_WHILE_PENDING.has(name) && !isAdmin(player) ? "Antes de jogar, responda às perguntas de entrada." : null));

    Events.onClient(`${RESOURCE}:${SHOWN}`, (sender) => {
        const player = sender as Player;
        shown.add(player.id);
        failures.delete(player.id);
    });
    Events.onClient(`${RESOURCE}:${START}`, (sender) => onStart(sender as Player, Date.now()));
    Events.onClient(`${RESOURCE}:${ANSWER}`, (sender, payload) => onAnswer(sender as Player, payload, Date.now()));
    Events.onClient(`${RESOURCE}:${FINISH}`, (sender) => release(sender as Player));
    Events.onClient(`${RESOURCE}:${FAILED}`, (sender, payload) => {
        const player = sender as Player;
        const count = (failures.get(player.id) ?? 0) + 1;
        failures.set(player.id, count);
        shown.delete(player.id);
        const why = typeof fieldsOf(payload)["why"] === "string" ? String(fieldsOf(payload)["why"]).slice(0, 120) : "?";
        console.log(`entry: a página de entrada de ${player.nickname} não abriu (${count} de 3): ${why}`);
        if (count >= 3 && isPending(player)) {
            Chat.sendToPlayer(player, "A janela de entrada não abriu no seu jogo. Feche o jogo e abra de novo; se continuar assim, fale com a administração.");
        }
    });
    Events.on("playerDisconnect", (player) => {
        const timer = releaseTimers.get(player.id);
        if (timer !== undefined) {
            clearTimeout(timer);
        }
        releaseTimers.delete(player.id);
        attempts.delete(player.id);
        shown.delete(player.id);
        failures.delete(player.id);
        askedAt.delete(player.id);
        pictureSent.delete(player.id);
        waiting.delete(player.id);
        sessionPassed.delete(player.id);
    });
    const timer = setInterval(() => lookAtPlayers(), entrySettings.lookEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            releaseTimers.forEach((one) => clearTimeout(one));
            releaseTimers.clear();
        }
    });
    const stats = entryStats();
    console.log(`entry: ${stats.passed} jogador(es) já aprovado(s) nas perguntas; quem não passou vê as ${QUESTIONS_PER_ATTEMPT} perguntas (${PASS_SCORE} certas para entrar)`);
}
