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
 * The information of the region (2026-11-04) is gone (2026-11-09, user: "deletar o anúncio de cada cidade no quadro de aviso ... tem um sistema que permite criar anúncios fixos, isso vamos deletar"):
 * the boards keep their posters, and have a second tab, Cidadania (user, the same night: "lá o jogador vê o brasão, quem controla a cidade, população, se está em guerra e etc, e o jogador pode pegar a
 * cidadania"): the town the board stands in, as the F2 panel's section showed it before it left, and the button that makes the player its citizen (`citizenBlock`, `becomeCitizen`).
 *
 * The letters are kept in `playerdata/mural.json` (through `store.ts`: a copy of the last good file is kept), and a board that is open on a screen is
 * sent the new list as soon as somebody puts up or takes down a letter on it.
 */

import { nameOf } from "./acquaintances.js";
import { isAdmin } from "./auth.js";
import { emitLarge } from "./big-emit.js";
import { getCharacter } from "./characters.js";
import { craftTitle } from "./craft-titles.js";
import { choose, isClosed, mayDepose, townById, townOf, townView } from "./citizenship.js";
import type { Town } from "./citizenship.js";
import { CHANGE_PRICE_COINS, freeChangeLeft } from "./free-changes.js";
import { languageOf, translate } from "./language.js";
import { giveMoney, MONEY_UNIT, moneyOf, takeMoney } from "./money.js";
import { boardById, boardNear, muralBoards } from "./mural-places.js";
import type { Board } from "./mural-places.js";
import { sendSocial } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { cleanLine, cleanStyle, cleanText, DEFAULT_STYLE, stripUnwanted } from "./text-style.js";
import type { TextStyle } from "./text-style.js";
import { opponentsOf } from "./wars.js";

// The text rules are shared with the letters (`text-style.ts`, 2026-11-02); what other modules and the tests took from here still is.
export { cleanStyle, DEFAULT_STYLE, stripUnwanted };

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
const CITIZEN = `${RESOURCE}:mural.citizen`;

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

export type PosterStyle = TextStyle;

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

/** A heading: one line, no strange characters, spaces in runs made one, no longer than `titleMax`. */
export function cleanTitle(value: unknown): string {
    return cleanLine(value, muralSettings.titleMax);
}

/** A text: lines kept, no strange characters, at most one empty line in a row, at most `maxLines` lines and `bodyMax` characters. */
export function cleanBody(value: unknown): string {
    return cleanText(value, muralSettings.bodyMax, muralSettings.maxLines);
}

function validPoster(value: unknown): Poster | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const f = value as Record<string, unknown>;
    // The information of the region (kind "decreto", until 2026-11-09) is not one of the three kinds any more: a file that still has some drops them.
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

/** The boards whose id is not their town's. */
const TOWN_OF_BOARD: Readonly<Record<string, string>> = { grunta: "minas" };

/** The town a board stands in (the id of a board is its place's, which is its town's id), or null for a board in a place that is no town of the server (a camp, a farm, a hamlet). */
export function townOfBoard(boardId: string): Town | null {
    return townById(TOWN_OF_BOARD[boardId] ?? boardId);
}

/** How the player's own citizenship stands against this town: what the button of the tab says and costs. */
export type CitizenKind = "here" | "closed" | "first" | "free" | "paid" | "admin";

/**
 * What the Cidadania tab shows of the board's town (the page is told nothing of any other): the card of the town as the F2 panel's section drew it (its crest, its lord, the lord's family, the Lady, how many
 * citizens, whether the lord has closed the citizenship, who it is at war with, how many NPCs live there), and what the player may do about it. Null for a board in no town.
 */
export function citizenBlock(player: Player, board: Board): Record<string, unknown> | null {
    const town = townOfBoard(board.id);
    if (town === null) {
        return null;
    }
    const view = townView(town);
    const current = townOf(player.steamId);
    const admin = isAdmin(player);
    let kind: CitizenKind;
    if (current !== null && current.id === town.id) {
        kind = "here";
    } else if (isClosed(town) && !mayDepose(player, town)) {
        kind = "closed";
    } else if (current === null) {
        kind = "first";
    } else if (admin) {
        kind = "admin";
    } else {
        kind = freeChangeLeft(player.steamId, "citizenship") ? "free" : "paid";
    }
    return {
        id: view.id,
        name: view.name,
        crest: view.crest,
        crestUrl: view.crestUrl,
        lord: view.lord,
        family: view.family,
        consort: view.consort,
        seatName: view.seatName,
        lands: view.lands,
        citizens: view.citizens,
        closed: view.closed,
        npcs: view.npcs,
        wars: opponentsOf(town.id).map((id) => townById(id)?.name ?? id),
        mine: current === null ? null : current.name,
        kind,
        price: CHANGE_PRICE_COINS,
    };
}

/** What the page is sent when it opens a board, or when the board changes under it. */
export function viewOf(player: Player, board: Board, now = Date.now()): string {
    const mine = player.steamId;
    const language = languageOf(player);
    const here = allPosters(board.id);
    const list = here
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
        lang: language,
        now,
        posters: list,
        town: citizenBlock(player, board),
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

/**
 * A player at a board makes themselves a citizen of the board's town (or changes to it: the first change is free, the rest cost, an administrator pays nothing; `citizenship.ts`'s `choose` says all
 * that). Only from the board, and only of its town: the page has no other to ask for.
 */
export function becomeCitizen(player: Player, request: unknown): Outcome {
    const fields = typeof request === "object" && request !== null ? (request as Record<string, unknown>) : {};
    const board = boardNear(player.position);
    if (board === null || board.id !== fields["board"]) {
        return fail("Você se afastou do quadro de avisos.");
    }
    const town = townOfBoard(board.id);
    if (town === null) {
        return fail("Este lugar não é uma cidade: não há cidadania aqui.");
    }
    const outcome = choose(player, town.id);
    if (outcome.ok) {
        sendSocial(player);
    }
    return outcome;
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
    Events.onClient(CITIZEN, (sender, payload) => {
        const player = sender as Player;
        const outcome = becomeCitizen(player, parse(payload));
        answer(player, "citizen", outcome);
        // The card is drawn again, with the new standing: the button of a citizen is not the one of a newcomer.
        const board = boardNear(player.position);
        if (board !== null && viewers.get(player.id) === board.id) {
            try {
                emitLarge(player, VIEW, viewOf(player, board));
            } catch {
                viewers.delete(player.id);
            }
        }
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
