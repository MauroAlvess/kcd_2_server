/**
 * The letters of the notice boards (user, 2026-10-24: "quadro de avisos em cada vila e cidade e reino ... o jogador paga 10 moedas para publicar 3
 * tipos de cartaz: cartas de procurado, cartaz de solicitações de recursos e cartaz de avisos ... fica lá 7 dias ... pode publicar como anônimo ou
 * deixando o nome ... edições no texto por espaçamento, formatação, bold, fonte normal ou uma fonte mais boêmica ... filtrar por tipo, data e
 * recentes, além de reordenar ... o dono do cartaz pode remover os cartazes dele mesmo").
 *
 * A player at a board (`mural-places.ts`, the frames the World Builder put in the villages and towns that have a coach) presses F: the prompt is the client's
 * (`cook-hint.ts`, kind 7), and the press comes here (`cook.menu`) to open the board's page (`client/mural.ts`, `ui/mural.html`) with the board's
 * letters, newest first. A letter is a heading and a text with a style (the page's font, bold, spacing and alignment: the same for the whole text),
 * one of three kinds, put up for `muralSettings.feeCoins` coins and taken down by itself after seven days. Whoever put it up may take it down;
 * so may an administrator. It carries the name of the character that wrote it or none ("Anônimo"); the account behind it is kept so that the
 * letter can be taken down, and is never sent to the page: a player sees only whether a letter is their own.
 *
 * The letters are kept in `playerdata/mural.json` (through `store.ts`: a copy of the last good file is kept), and a board that is open on a screen is
 * sent the new list as soon as somebody puts up or takes down a letter on it.
 */

import { nameOf } from "./acquaintances.js";
import { isAdmin } from "./auth.js";
import { emitLarge } from "./big-emit.js";
import { getCharacter } from "./characters.js";
import { craftTitle } from "./craft-titles.js";
import { languageOf, translate } from "./language.js";
import { giveMoney, MONEY_UNIT, moneyOf, takeMoney } from "./money.js";
import { boardById, boardNear, muralBoards } from "./mural-places.js";
import type { Board } from "./mural-places.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
/** Server to client (pieces, if too big: `emitLarge`). */
const VIEW = "mural.view";
const ART = "mural.art";
export const MURAL_CLOSE = `${RESOURCE}:mural.close`;
export const MURAL_RESULT = `${RESOURCE}:mural.result`;
/** Client to server. */
const PUBLISH = `${RESOURCE}:mural.publish`;
const REMOVE = `${RESOURCE}:mural.remove`;
const CLOSED = `${RESOURCE}:mural.closed`;

/** The kind number of the client's prompt (`cook-hint.ts`, after the fire, the rack, the smokehouse, the forge, the table, the chair and the bed). */
export const MURAL_KIND = 7;

const STEAM_ID = /^\d{5,20}$/;
const DIR = "playerdata";
const FILE = `${DIR}/mural.json`;

export const muralSettings = {
    /** What a letter costs, in the coins the screen shows. */
    feeCoins: 10,
    /** How long a letter stays on the board. */
    lifetimeMs: 7 * 24 * 60 * 60_000,
    titleMax: 48,
    bodyMax: 900,
    bodyMin: 8,
    maxLines: 22,
    /** How many letters one player may have on one board, and how many a board holds. */
    perPlayerPerBoard: 4,
    perBoard: 60,
    /** Between two letters of the same player. */
    publishGapMs: 4_000,
    /** How often the old letters are taken down, and how often those who walked away from a board are looked for. */
    purgeEveryMs: 10 * 60_000,
    watchEveryMs: 2_000,
};

export type Category = "procurado" | "recursos" | "avisos";

/** The three kinds of letter: the name the page and the chat use, the title a letter without one is given, and the picture of the title's key in `data/craft-titles.json`. */
export const CATEGORIES: ReadonlyArray<{ readonly id: Category; readonly label: string; readonly fallback: string; readonly art: string }> = [
    { id: "procurado", label: "Procurado", fallback: "Procura-se", art: "cartaz-procurado" },
    { id: "recursos", label: "Recursos", fallback: "Preciso de recursos", art: "cartaz-recursos" },
    { id: "avisos", label: "Aviso", fallback: "Aviso", art: "cartaz-avisos" },
];

export interface PosterStyle {
    /** "normal" is the page's own text face; "bohemia" a gothic one. */
    readonly font: "normal" | "bohemia";
    readonly bold: boolean;
    readonly spacing: "tight" | "normal" | "wide";
    readonly align: "left" | "center";
}

export const DEFAULT_STYLE: PosterStyle = { font: "normal", bold: false, spacing: "normal", align: "left" };

export interface Poster {
    readonly id: string;
    readonly board: string;
    readonly category: Category;
    readonly title: string;
    readonly body: string;
    readonly style: PosterStyle;
    readonly anonymous: boolean;
    /** The name of the character, as it was when the letter went up; shown unless the letter is anonymous. */
    readonly author: string;
    /** The account (Steam id): never sent to a page. */
    readonly owner: string;
    readonly at: number;
    readonly until: number;
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
    readonly id?: string;
}

let posters: Poster[] = [];
let sequence = 0;
let writable = true;
/** Who has a board open, by board. */
const viewers = new Map<number, string>();
const lastPublish = new Map<number, number>();

function persist(): boolean {
    if (!writable) {
        return false;
    }
    try {
        ensureDir(DIR);
        write(FILE, { posters });
        return true;
    } catch (error: unknown) {
        console.log(`mural: não consegui guardar os cartazes: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

const categoryOf = (value: unknown): Category | null => (CATEGORIES.find((category) => category.id === value)?.id ?? null);

/** The style a request asks for: each field is one of its own values or the default's, so nothing else ever reaches a page's classes. */
export function cleanStyle(value: unknown): PosterStyle {
    const fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    return {
        font: fields["font"] === "bohemia" ? "bohemia" : "normal",
        bold: fields["bold"] === true,
        spacing: fields["spacing"] === "tight" || fields["spacing"] === "wide" ? fields["spacing"] : "normal",
        align: fields["align"] === "center" ? "center" : "left",
    };
}

// What no letter may carry: control characters (but the line break), the invisible ones that turn a line around or hide a word, and a lone
// surrogate. Listed as ranges of code points and walked, not as a pattern, so that none of them has to be written into this file.
const UNWANTED: ReadonlyArray<readonly [number, number]> = [
    [0x00, 0x09],
    [0x0b, 0x1f],
    [0x7f, 0x9f],
    [0xad, 0xad],
    [0x200b, 0x200f],
    [0x2028, 0x202e],
    [0x2060, 0x2064],
    [0xd800, 0xdfff],
    [0xfeff, 0xfeff],
    [0xfff9, 0xfffb],
];

/** The text without them. */
export function stripUnwanted(text: string): string {
    let out = "";
    for (const character of text) {
        const code = character.codePointAt(0) ?? 0;
        if (!UNWANTED.some(([from, to]) => code >= from && code <= to)) {
            out += character;
        }
    }
    return out;
}

/** A heading: one line, no strange characters, spaces in runs made one, no longer than `titleMax`. */
export function cleanTitle(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    return stripUnwanted(value.replace(/[\r\n\t]+/g, " ")).replace(/\s{2,}/g, " ").trim().slice(0, muralSettings.titleMax).trim();
}

/** A text: lines kept, no strange characters, at most one empty line in a row, at most `maxLines` lines and `bodyMax` characters. */
export function cleanBody(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    const lines = stripUnwanted(value.replace(/\r\n?/g, "\n"))
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim());
    const kept: string[] = [];
    for (const line of lines) {
        if (line === "" && (kept.length === 0 || kept[kept.length - 1] === "")) {
            continue;
        }
        kept.push(line);
    }
    while (kept.length > 0 && kept[kept.length - 1] === "") {
        kept.pop();
    }
    return kept.slice(0, muralSettings.maxLines).join("\n").slice(0, muralSettings.bodyMax).trim();
}

function validPoster(value: unknown): Poster | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const f = value as Record<string, unknown>;
    const category = categoryOf(f["category"]);
    if (category === null || typeof f["id"] !== "string" || typeof f["board"] !== "string" || typeof f["owner"] !== "string" || typeof f["at"] !== "number" || typeof f["until"] !== "number") {
        return null;
    }
    const body = cleanBody(f["body"]);
    if (body === "") {
        return null;
    }
    return {
        id: f["id"].slice(0, 40),
        board: f["board"].slice(0, 60),
        category,
        title: cleanTitle(f["title"]),
        body,
        style: cleanStyle(f["style"]),
        anonymous: f["anonymous"] === true,
        author: typeof f["author"] === "string" ? cleanTitle(f["author"]) : "",
        owner: f["owner"].slice(0, 30),
        at: f["at"],
        until: f["until"],
    };
}

export function loadMural(): void {
    const loaded = read<{ posters?: unknown }>(FILE);
    if (loaded.status === "ok" && Array.isArray(loaded.value.posters)) {
        posters = (loaded.value.posters as unknown[]).map(validPoster).filter((poster): poster is Poster => poster !== null);
        writable = true;
    } else if (loaded.status === "corrupt") {
        // Nothing is written over a file that could not be read: the letters would be lost, and a person can look at the file.
        writable = false;
        console.log(`mural: ${FILE} não pôde ser lido (${loaded.reason}); nenhum cartaz novo é gravado até isso ser visto`);
    }
}

/** The letters now on the walls: all of them, or those of one board. */
export function allPosters(boardId?: string): readonly Poster[] {
    return boardId === undefined ? posters : posters.filter((poster) => poster.board === boardId);
}

/** Takes down the letters that have had their seven days. Returns how many. */
export function purge(now = Date.now()): number {
    const before = posters.length;
    const kept = posters.filter((poster) => poster.until > now);
    if (kept.length === before) {
        return 0;
    }
    posters = kept;
    persist();
    return before - kept.length;
}

function makeId(now: number): string {
    sequence += 1;
    return `${now.toString(36)}${sequence.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** The text of a poster as the page shows it, in the player's own words. */
function posterView(poster: Poster, steamId: string): Record<string, unknown> {
    return {
        id: poster.id,
        c: poster.category,
        t: poster.title === "" ? (CATEGORIES.find((category) => category.id === poster.category)?.fallback ?? "") : poster.title,
        b: poster.body,
        s: poster.style,
        n: poster.anonymous ? "" : poster.author,
        an: poster.anonymous,
        at: poster.at,
        until: poster.until,
        mine: steamId !== "" && poster.owner === steamId,
    };
}

/** What the page is sent when it opens a board, or when the board changes under it. */
export function viewOf(player: Player, board: Board, now = Date.now()): string {
    const mine = player.steamId;
    const list = allPosters(board.id)
        .filter((poster) => poster.until > now)
        .sort((a, b) => b.at - a.at)
        .map((poster) => posterView(poster, mine));
    return JSON.stringify({
        board: { id: board.id, name: board.name },
        fee: muralSettings.feeCoins,
        days: Math.round(muralSettings.lifetimeMs / 86_400_000),
        coins: moneyOf(player) / MONEY_UNIT,
        admin: isAdmin(player),
        limits: { title: muralSettings.titleMax, body: muralSettings.bodyMax, lines: muralSettings.maxLines },
        lang: languageOf(player),
        now,
        posters: list,
    });
}

/** The pictures of the page (its title and the three kinds of letter), as data URLs; empty ones are left out and the page draws names. */
export function artJson(): string {
    const art: Record<string, string> = {};
    const mural = craftTitle("mural");
    if (mural !== "") {
        art["mural"] = mural;
    }
    for (const category of CATEGORIES) {
        const picture = craftTitle(category.art);
        if (picture !== "") {
            art[category.id] = picture;
        }
    }
    return JSON.stringify(art);
}

/** Opens the board within reach for a player. `haveArt`: the client has the pictures already (this session). */
export function openMural(player: Player, haveArt = false, now = Date.now()): Outcome {
    if (!player.ready || !player.alive) {
        return { ok: false, message: "" };
    }
    const board = boardNear(player.position);
    if (board === null) {
        return { ok: false, message: "Não há quadro de avisos por perto." };
    }
    purge(now);
    viewers.set(player.id, board.id);
    if (!haveArt) {
        emitLarge(player, ART, artJson());
    }
    emitLarge(player, VIEW, viewOf(player, board, now));
    return { ok: true, message: "" };
}

/** Sends the open boards' viewers the board as it is now. */
export function refreshViewers(boardId: string, now = Date.now()): void {
    const board = boardById(boardId);
    if (board === null) {
        return;
    }
    for (const [playerId, id] of viewers) {
        if (id !== boardId) {
            continue;
        }
        const player = Player.all().find((candidate) => candidate.id === playerId);
        if (player === undefined) {
            viewers.delete(playerId);
            continue;
        }
        try {
            emitLarge(player, VIEW, viewOf(player, board, now));
        } catch {
            viewers.delete(playerId);
        }
    }
}

const fail = (message: string): Outcome => ({ ok: false, message });

/** A letter, put up by a player standing at its board. The fee is taken only when the letter is kept. */
export function publish(player: Player, request: unknown, now = Date.now()): Outcome {
    const fields = typeof request === "object" && request !== null ? (request as Record<string, unknown>) : {};
    const board = boardNear(player.position);
    if (board === null || board.id !== fields["board"]) {
        return fail("Você se afastou do quadro de avisos.");
    }
    const category = categoryOf(fields["category"]);
    if (category === null) {
        return fail("Escolha o tipo do cartaz.");
    }
    const body = cleanBody(fields["body"]);
    if (body.length < muralSettings.bodyMin) {
        return fail("Escreva o texto do cartaz.");
    }
    if (!STEAM_ID.test(player.steamId)) {
        return fail("Sua conta não tem identificação Steam, então o cartaz não poderia ser guardado.");
    }
    if (getCharacter(player.steamId) === null) {
        return fail("Crie o seu personagem antes de afixar um cartaz.");
    }
    if (!writable) {
        return fail("Os cartazes estão fora do ar por enquanto.");
    }
    if (now - (lastPublish.get(player.id) ?? Number.NEGATIVE_INFINITY) < muralSettings.publishGapMs) {
        return fail("Com calma: um cartaz de cada vez.");
    }
    purge(now);
    const here = allPosters(board.id);
    if (here.filter((poster) => poster.owner === player.steamId).length >= muralSettings.perPlayerPerBoard) {
        return fail(`Você já tem ${muralSettings.perPlayerPerBoard} cartazes neste quadro. Retire um, ou espere que saiam.`);
    }
    if (here.length >= muralSettings.perBoard) {
        return fail("O quadro está cheio. Volte quando algum cartaz sair.");
    }
    const fee = muralSettings.feeCoins * MONEY_UNIT;
    if (moneyOf(player) < fee) {
        return fail(`Você precisa de ${muralSettings.feeCoins} moedas para afixar um cartaz.`);
    }
    if (!takeMoney(player, fee)) {
        return fail("Não consegui receber o pagamento agora. Tente de novo.");
    }
    const poster: Poster = {
        id: makeId(now),
        board: board.id,
        category,
        title: cleanTitle(fields["title"]),
        body,
        style: cleanStyle(fields["style"]),
        anonymous: fields["anonymous"] === true,
        author: nameOf(player),
        owner: player.steamId,
        at: now,
        until: now + muralSettings.lifetimeMs,
    };
    posters.push(poster);
    if (!persist()) {
        posters.pop();
        giveMoney(player, fee);
        return fail("Não consegui guardar o cartaz agora; o seu dinheiro foi devolvido. Tente de novo em instantes.");
    }
    lastPublish.set(player.id, now);
    console.log(`mural: ${player.nickname} afixou um cartaz de ${category} em ${board.name}${poster.anonymous ? " (anônimo)" : ""}`);
    refreshViewers(board.id, now);
    return { ok: true, message: `Cartaz afixado: fica ${Math.round(muralSettings.lifetimeMs / 86_400_000)} dias no quadro.`, id: poster.id };
}

/** Takes a letter down: its owner's request, or an administrator's, from the board it hangs on. */
export function removePoster(player: Player, id: unknown): Outcome {
    const poster = typeof id === "string" ? posters.find((candidate) => candidate.id === id) : undefined;
    if (poster === undefined) {
        return fail("Esse cartaz já não está no quadro.");
    }
    const board = boardNear(player.position);
    if (board === null || board.id !== poster.board) {
        return fail("Você se afastou do quadro de avisos.");
    }
    if (poster.owner !== player.steamId && !isAdmin(player)) {
        return fail("Só quem afixou o cartaz pode retirá-lo.");
    }
    return takeDown(poster, `${player.nickname} retirou`);
}

function takeDown(poster: Poster, who: string): Outcome {
    if (!writable) {
        return fail("Os cartazes estão fora do ar por enquanto.");
    }
    const before = posters;
    posters = posters.filter((candidate) => candidate.id !== poster.id);
    if (!persist()) {
        posters = before;
        return fail("Não consegui retirar o cartaz agora. Tente de novo em instantes.");
    }
    console.log(`mural: ${who} um cartaz de ${poster.category} de ${boardById(poster.board)?.name ?? poster.board}`);
    refreshViewers(poster.board);
    return { ok: true, message: "Cartaz retirado." };
}

/** An administrator's way to take letters down: one by id (from anywhere), or all of a board's. Returns how many. */
export function adminRemove(target: string, who: string): number {
    const found = posters.filter((poster) => poster.id === target || poster.board === target);
    let count = 0;
    for (const poster of found) {
        if (takeDown(poster, who).ok) {
            count += 1;
        }
    }
    return count;
}

/** A press of the client's prompt: the payload of `cook.menu` when its kind is the board's; null for any other. */
export function muralAsked(payload: unknown): { readonly haveArt: boolean } | null {
    let fields: Record<string, unknown> = {};
    try {
        const value = typeof payload === "string" && payload.length <= 300 ? (JSON.parse(payload) as unknown) : payload;
        fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return null;
    }
    return fields["kind"] === MURAL_KIND ? { haveArt: fields["art"] === true } : null;
}

/** The board prompts, for the client's station list (`cook-menu.ts`): kind, x, y, z of the ground in front of each board near a point. */
export function muralPointsWithin(position: { readonly x: number; readonly y: number }, radius: number): Array<[number, number, number, number]> {
    return muralBoards()
        .filter((board) => Math.hypot(board.x - position.x, board.y - position.y) <= radius)
        .map((board): [number, number, number, number] => [MURAL_KIND, board.x, board.y, board.z]);
}

const parse = (payload: unknown): Record<string, unknown> => {
    let value = payload;
    if (typeof value === "string") {
        if (value.length > 8_000) {
            return {};
        }
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
};

/** What the page is told about its request, in the player's own language. */
function answer(player: Player, what: string, outcome: Outcome): void {
    if (outcome.message === "") {
        return;
    }
    try {
        player.emit(MURAL_RESULT, JSON.stringify({ what, ok: outcome.ok, message: translate(outcome.message, languageOf(player)), ...(outcome.id === undefined ? {} : { id: outcome.id }) }));
    } catch {
        // Gone already.
    }
}

export function installMural(): void {
    loadMural();
    purge();
    Events.onClient(PUBLISH, (sender, payload) => {
        const player = sender as Player;
        answer(player, "publish", publish(player, parse(payload)));
    });
    Events.onClient(REMOVE, (sender, payload) => {
        const player = sender as Player;
        answer(player, "remove", removePoster(player, parse(payload)["id"]));
    });
    Events.onClient(CLOSED, (sender) => {
        viewers.delete((sender as Player).id);
    });
    Events.on("playerDisconnect", (player) => {
        viewers.delete(player.id);
        lastPublish.delete(player.id);
    });
    const purger = setInterval(() => {
        const gone = purge();
        if (gone > 0) {
            console.log(`mural: ${gone} cartaz(es) saíram do quadro depois de ${Math.round(muralSettings.lifetimeMs / 86_400_000)} dias`);
            for (const board of new Set(viewers.values())) {
                refreshViewers(board);
            }
        }
    }, muralSettings.purgeEveryMs);
    // Whoever walks away from a board with its page open has it closed.
    const watcher = setInterval(() => {
        for (const [playerId, boardId] of viewers) {
            const player = Player.all().find((candidate) => candidate.id === playerId);
            if (player === undefined) {
                viewers.delete(playerId);
            } else if (boardNear(player.position)?.id !== boardId || !player.alive) {
                viewers.delete(playerId);
                try {
                    player.emit(MURAL_CLOSE, "{}");
                } catch {
                    // Gone already.
                }
            }
        }
    }, muralSettings.watchEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(purger);
            clearInterval(watcher);
        }
    });
    console.log(`mural: ${posters.length} cartaz(es) nos quadros; ${muralSettings.feeCoins} moedas por cartaz, ${Math.round(muralSettings.lifetimeMs / 86_400_000)} dias no quadro`);
}
