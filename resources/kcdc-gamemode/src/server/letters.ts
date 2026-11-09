/**
 * The letters (user, 2026-11-02: "vamos criar o sistema de cartas agora: no menu F2 vai ter uma nova seção chamada Cartas, parecida com o quadro de aviso; lá você
 * vai poder enviar uma carta para um jogador; quanto mais longe, mais tempo demora para a carta chegar a ele; nessa seção vai poder ler cartas também; formatação
 * e fonte de texto, mesma coisa; o jogador pode escolher se vai ser anônima ou vai com o nome dele, e qual brasão usar: só pegar os brasões de cidadania ou
 * brasões de guilda; cada carta custa 10 moedas para enviar").
 *
 * A letter is written in the panel's Cartas section (`ui-src/status.html`) to any character of the server, here or not (the roster's `mail` list): a heading and a
 * text with one style for the whole of it (the notice boards' rules, `text-style.ts`), signed with the writer's name or with none, closed with a seal: plain red
 * wax, the crest of the town the writer is a citizen of, or the crest of the writer's guild (only those, so that nobody seals with what is not theirs). It costs
 * `lettersSettings.feeCoins` coins, taken only once the letter is kept. A courier carries it: it reaches its reader `baseMs` plus `perKmMs` for each kilometre
 * between the writer, where they stood, and the reader, where they are (or were last seen), never sooner than `minMs` nor later than `maxMs`. Until then the
 * reader does not know of it; then they are told in the chat when they are here, or when they next come in, and the Cartas button carries a dot while a letter
 * waits unread.
 *
 * The page is sent the lists (the letters received that have arrived, and the ones sent) without their texts; a text goes when its letter is opened, and opening a
 * letter received marks it read. The account behind an unsigned letter is kept for the administrators (`/cartas`) and never sent to the reader. Either side may
 * throw a letter away from their own list; a letter both threw away, or old enough (`keepDays` after it arrived, `unreadKeepDays` when it was never read), is
 * gone for good. A reader holds `inboxMax` letters: a new one pushes out their oldest read one, and when none is read the letter is refused before anything is
 * paid. Kept in `playerdata/letters.json` through `store.ts`: written at once when a letter is sent (the coins depend on it), a moment later for everything else.
 */

import { nameOf } from "./acquaintances.js";
import { bans } from "./bans.js";
import { emitLarge } from "./big-emit.js";
import { getCharacter } from "./characters.js";
import { TOWNS, townOf } from "./citizenship.js";
import { languageOf } from "./language.js";
import { giveMoney, MONEY_UNIT, moneyOf, takeMoney } from "./money.js";
import { getSavedPlace } from "./position.js";
import { accountIdOf, accountOfTarget, addPayload, getGuildId, GUILDS, notice } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { cleanLine, cleanStyle, cleanText } from "./text-style.js";
import type { TextStyle } from "./text-style.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/letters.json`;
const STEAM_ID = /^\d{5,20}$/;
const DAY_MS = 86_400_000;

export const lettersSettings = {
    /** What a letter costs, in the coins the screen shows. */
    feeCoins: 10,
    titleMax: 60,
    bodyMin: 4,
    bodyMax: 1500,
    maxLines: 40,
    /** The courier: a minute to set out, and so much for each kilometre between the two; never less than `minMs`, never more than `maxMs`. */
    baseMs: 60_000,
    perKmMs: 150_000,
    minMs: 60_000,
    maxMs: 12 * 60_000,
    /** How far away a reader is taken to be when nothing says where they are (never seen in the world). */
    fallbackKm: 1.5,
    /** Between two letters of the same writer, and how many one writer sends in a day. */
    sendGapMs: 10_000,
    perDay: 30,
    /** How many letters a reader holds, and how many of the sent ones a writer's list keeps. */
    inboxMax: 40,
    sentMax: 40,
    /** A letter read is kept so many days after it arrived; one never read, longer. */
    keepDays: 30,
    unreadKeepDays: 60,
    /** How often arrivals are looked for, how long a change waits to be written, how long after coming in a player is told of the letters waiting. */
    tickMs: 5_000,
    saveDelayMs: 3_000,
    tellAfterMs: 20_000,
    purgeEveryMs: 10 * 60_000,
};

/** A seal: "" for plain wax, `town:<id>` for the crest of a town, `guild:<id>` for a guild's. */
export interface SealInfo {
    readonly id: string;
    readonly label: string;
    readonly sub: string;
    /** The crest's picture (`ui-images.ts`), or "" for plain wax. */
    readonly crest: string;
}

export interface Letter {
    readonly id: string;
    /** The writer's account and name as it was when the letter went: the account is never sent to a page, the name not when the letter is unsigned. */
    readonly from: string;
    readonly fromName: string;
    readonly anonymous: boolean;
    readonly seal: string;
    readonly to: string;
    readonly toName: string;
    readonly title: string;
    readonly body: string;
    readonly style: TextStyle;
    readonly sentAt: number;
    readonly arriveAt: number;
    /** Between the two when it went, in kilometres to a tenth. */
    readonly km: number;
    readAt?: number;
    droppedByTo?: boolean;
    droppedByFrom?: boolean;
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
    readonly id?: string;
}

let letters: Letter[] = [];
let sequence = 0;
let writable = true;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** The letters already told of, by id: told once, here or at the next coming in. */
const told = new Set<string>();
const lastSent = new Map<number, number>();
const reminders = new Map<number, ReturnType<typeof setTimeout>>();

const fail = (message: string): Outcome => ({ ok: false, message });
const flatKm = (a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }): number => Math.hypot(a.x - b.x, a.y - b.y) / 1000;

function makeId(now: number): string {
    sequence = (sequence + 1) % 1296;
    return `c${now.toString(36)}${sequence.toString(36).padStart(2, "0")}`;
}

function persist(): boolean {
    if (!writable) {
        return false;
    }
    try {
        ensureDir(DIR);
        write(FILE, { letters });
        return true;
    } catch (error: unknown) {
        console.log(`letters: não consegui guardar as cartas: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** A change that need not be written this instant (a letter read or thrown away): written a moment later, with whatever else changed meanwhile. */
function persistSoon(): void {
    if (saveTimer !== null) {
        return;
    }
    saveTimer = setTimeout(() => {
        saveTimer = null;
        persist();
    }, lettersSettings.saveDelayMs);
}

function validLetter(value: unknown): Letter | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const f = value as Record<string, unknown>;
    if (typeof f["id"] !== "string" || typeof f["from"] !== "string" || typeof f["to"] !== "string" || typeof f["sentAt"] !== "number" || typeof f["arriveAt"] !== "number") {
        return null;
    }
    const body = cleanText(f["body"], lettersSettings.bodyMax, lettersSettings.maxLines);
    if (body === "") {
        return null;
    }
    const letter: Letter = {
        id: f["id"].slice(0, 40),
        from: f["from"].slice(0, 30),
        fromName: cleanLine(f["fromName"], 80),
        anonymous: f["anonymous"] === true,
        seal: typeof f["seal"] === "string" ? f["seal"].slice(0, 60) : "",
        to: f["to"].slice(0, 30),
        toName: cleanLine(f["toName"], 80),
        title: cleanLine(f["title"], lettersSettings.titleMax) || "Carta",
        body,
        style: cleanStyle(f["style"]),
        sentAt: f["sentAt"],
        arriveAt: f["arriveAt"],
        km: typeof f["km"] === "number" && Number.isFinite(f["km"]) ? f["km"] : 0,
    };
    if (typeof f["readAt"] === "number") {
        letter.readAt = f["readAt"];
    }
    if (f["droppedByTo"] === true) {
        letter.droppedByTo = true;
    }
    if (f["droppedByFrom"] === true) {
        letter.droppedByFrom = true;
    }
    return letter;
}

export function loadLetters(now = Date.now()): void {
    const loaded = read<{ letters?: unknown }>(FILE);
    if (loaded.status === "ok" && Array.isArray(loaded.value.letters)) {
        letters = (loaded.value.letters as unknown[]).map(validLetter).filter((letter): letter is Letter => letter !== null);
        writable = true;
    } else if (loaded.status === "corrupt") {
        // Nothing is written over a file that could not be read: the letters would be lost, and a person can look at the file.
        writable = false;
        console.log(`letters: ${FILE} não pôde ser lido (${loaded.reason}); nenhuma carta nova é aceita até isso ser visto`);
    }
    // What arrived before this start was told of then, or is told at the next coming in (`remind`), never as a new arrival.
    told.clear();
    for (const letter of letters) {
        if (letter.arriveAt <= now) {
            told.add(letter.id);
        }
    }
}

/** Every letter kept: for the administrators' command and the tests. */
export function allLetters(): readonly Letter[] {
    return letters;
}

/** The letters a reader holds (arrived or on the way), and the ones of theirs that have arrived. */
const inboxOf = (steamId: string): Letter[] => letters.filter((letter) => letter.to === steamId && letter.droppedByTo !== true);
const arrivedFor = (steamId: string, now: number): Letter[] => inboxOf(steamId).filter((letter) => letter.arriveAt <= now);
const sentBy = (steamId: string): Letter[] => letters.filter((letter) => letter.from === steamId && letter.droppedByFrom !== true);

/** How many letters wait unread for the player: the dot on the Cartas button. */
export function unreadOf(steamId: string, now = Date.now()): number {
    if (steamId === "") {
        return 0;
    }
    let count = 0;
    for (const letter of letters) {
        if (letter.to === steamId && letter.droppedByTo !== true && letter.readAt === undefined && letter.arriveAt <= now) {
            count += 1;
        }
    }
    return count;
}

/** What a seal is, from its id: the town's or the guild's crest, or plain wax for anything the catalogs no longer know. */
export function sealInfo(id: string): SealInfo {
    if (id.startsWith("town:")) {
        const town = TOWNS.find((one) => one.id === id.slice("town:".length));
        if (town !== undefined) {
            return { id, label: town.name, sub: "brasão da cidadania", crest: town.crest };
        }
    }
    if (id.startsWith("guild:")) {
        const guild = GUILDS.find((one) => one.id === id.slice("guild:".length));
        if (guild !== undefined) {
            return { id, label: guild.nameLatin, sub: `guilda: ${guild.profession}`, crest: guild.crest };
        }
    }
    return { id: "", label: "Lacre simples", sub: "cera vermelha, sem brasão", crest: "" };
}

/** The seals a writer may close a letter with: plain wax, and the crests that are theirs (their town's, their guild's). */
export function sealsOf(steamId: string): SealInfo[] {
    const seals: SealInfo[] = [sealInfo("")];
    const town = steamId === "" ? null : townOf(steamId);
    if (town !== null) {
        seals.push(sealInfo(`town:${town.id}`));
    }
    const guildId = steamId === "" ? null : getGuildId(steamId);
    if (guildId !== null) {
        seals.push(sealInfo(`guild:${guildId}`));
    }
    return seals;
}

/** Where a reader is for the courier: in the world now, where they were last seen, or nowhere known. */
function placeOf(steamId: string, here: Player | null): { readonly x: number; readonly y: number } | null {
    if (here !== null) {
        return here.position;
    }
    const saved = getSavedPlace(steamId);
    return saved === null ? null : { x: saved.x, y: saved.y };
}

/** How long the courier takes for so many kilometres. */
export function travelMs(km: number): number {
    const { baseMs, perKmMs, minMs, maxMs } = lettersSettings;
    return Math.round(Math.min(maxMs, Math.max(minMs, baseMs + Math.max(0, km) * perKmMs)));
}

/** The distance between a writer and a reader, to a tenth of a kilometre. */
function kmBetween(writer: Player, steamId: string, here: Player | null): number {
    const at = placeOf(steamId, here);
    const km = at === null ? lettersSettings.fallbackKm : flatKm(writer.position, at);
    return Math.round(km * 10) / 10;
}

/** The reader a page names (an account's number, `accountOfTarget`), as a letter may go to them; or why not. */
function readerOf(writer: Player, target: unknown): { readonly steamId: string; readonly name: string; readonly player: Player | null } | string {
    const account = accountOfTarget(target);
    if (account === null) {
        return "Escolha para quem vai a carta.";
    }
    if (account.steamId === writer.steamId) {
        return "Uma carta para você mesmo? O mensageiro não aceita.";
    }
    if (getCharacter(account.steamId) === null || bans.isBanned(account.steamId)) {
        return "Essa pessoa não está mais no reino.";
    }
    return { steamId: account.steamId, name: account.name, player: account.player };
}

/** How long a letter to the reader would take now, for the page's note before it is sent. */
export function quoteFor(writer: Player, target: unknown): { readonly minutes: number; readonly km: number } | null {
    const reader = readerOf(writer, target);
    if (typeof reader === "string") {
        return null;
    }
    const km = kmBetween(writer, reader.steamId, reader.player);
    return { minutes: Math.max(1, Math.round(travelMs(km) / 60_000)), km };
}

function textMinutes(ms: number): string {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

/** A letter written in the panel: checked, paid for, kept, and given to the courier. The fee is taken only when the letter is kept. */
export function sendLetter(writer: Player, request: unknown, now = Date.now()): Outcome {
    const fields = typeof request === "object" && request !== null ? (request as Record<string, unknown>) : {};
    if (!STEAM_ID.test(writer.steamId)) {
        return fail("Sua conta não tem identificação Steam, então a carta não poderia ser guardada.");
    }
    if (getCharacter(writer.steamId) === null) {
        return fail("Crie o seu personagem antes de escrever uma carta.");
    }
    if (!writable) {
        return fail("O correio está fechado por enquanto.");
    }
    const reader = readerOf(writer, fields["to"]);
    if (typeof reader === "string") {
        return fail(reader);
    }
    const body = cleanText(fields["body"], lettersSettings.bodyMax, lettersSettings.maxLines);
    if (body.length < lettersSettings.bodyMin) {
        return fail("Escreva o texto da carta.");
    }
    const seal = typeof fields["seal"] === "string" ? fields["seal"] : "";
    if (!sealsOf(writer.steamId).some((one) => one.id === seal)) {
        return fail("Esse selo não é seu: escolha o lacre simples, o brasão da sua cidadania ou o da sua guilda.");
    }
    if (now - (lastSent.get(writer.id) ?? Number.NEGATIVE_INFINITY) < lettersSettings.sendGapMs) {
        return fail("Com calma: o mensageiro leva uma carta de cada vez.");
    }
    if (letters.filter((letter) => letter.from === writer.steamId && now - letter.sentAt < DAY_MS).length >= lettersSettings.perDay) {
        return fail(`Você já mandou ${lettersSettings.perDay} cartas hoje. O mensageiro volta amanhã.`);
    }
    // The reader's box: a new letter pushes out their oldest read one; with none read, it does not go (before anything is paid).
    const box = inboxOf(reader.steamId);
    let pushedOut: Letter | null = null;
    if (box.length >= lettersSettings.inboxMax) {
        pushedOut = box.filter((letter) => letter.readAt !== undefined).sort((a, b) => a.arriveAt - b.arriveAt)[0] ?? null;
        if (pushedOut === null) {
            return fail(`${reader.name} tem cartas demais por ler. Tente de novo mais tarde.`);
        }
    }
    const fee = lettersSettings.feeCoins * MONEY_UNIT;
    if (moneyOf(writer) < fee) {
        return fail(`Você precisa de ${lettersSettings.feeCoins} moedas para mandar uma carta.`);
    }
    if (!takeMoney(writer, fee)) {
        return fail("Não consegui receber o pagamento agora. Tente de novo.");
    }
    const km = kmBetween(writer, reader.steamId, reader.player);
    const letter: Letter = {
        id: makeId(now),
        from: writer.steamId,
        fromName: nameOf(writer),
        anonymous: fields["anonymous"] === true,
        seal,
        to: reader.steamId,
        toName: reader.name,
        title: cleanLine(fields["title"], lettersSettings.titleMax) || "Carta",
        body,
        style: cleanStyle(fields["style"]),
        sentAt: now,
        arriveAt: now + travelMs(km),
        km,
    };
    letters.push(letter);
    if (pushedOut !== null) {
        pushedOut.droppedByTo = true;
    }
    if (!persist()) {
        letters.pop();
        if (pushedOut !== null) {
            delete pushedOut.droppedByTo;
        }
        giveMoney(writer, fee);
        return fail("Não consegui guardar a carta agora; o seu dinheiro foi devolvido. Tente de novo em instantes.");
    }
    lastSent.set(writer.id, now);
    // The writer's list keeps the newest `sentMax`.
    const sent = sentBy(writer.steamId).sort((a, b) => b.sentAt - a.sentAt);
    for (const old of sent.slice(lettersSettings.sentMax)) {
        old.droppedByFrom = true;
    }
    sweep(now);
    console.log(`letters: ${writer.nickname} mandou uma carta a ${reader.name}${letter.anonymous ? " (sem assinatura)" : ""}, ${km.toFixed(1)} km, chega em ${Math.round((letter.arriveAt - now) / 1000)} s`);
    return { ok: true, message: `Carta entregue ao mensageiro: chega a ${reader.name} em cerca de ${textMinutes(letter.arriveAt - now)}.`, id: letter.id };
}

/** A letter the player may see: one that reached them, or one of their own. */
function letterFor(steamId: string, id: unknown, now: number): { readonly letter: Letter; readonly mine: boolean } | null {
    if (typeof id !== "string" || steamId === "") {
        return null;
    }
    const letter = letters.find((one) => one.id === id);
    if (letter === undefined) {
        return null;
    }
    if (letter.to === steamId && letter.droppedByTo !== true && letter.arriveAt <= now) {
        return { letter, mine: false };
    }
    if (letter.from === steamId && letter.droppedByFrom !== true) {
        return { letter, mine: true };
    }
    return null;
}

/** A letter opened in the panel: its text, and, for one received, a mark that it was read. */
export function openLetter(player: Player, id: unknown, now = Date.now()): Record<string, unknown> | null {
    const found = letterFor(player.steamId, id, now);
    if (found === null) {
        return null;
    }
    const { letter, mine } = found;
    if (!mine && letter.readAt === undefined) {
        letter.readAt = now;
        persistSoon();
    }
    return {
        id: letter.id,
        box: mine ? "out" : "in",
        title: letter.title,
        body: letter.body,
        style: letter.style,
        from: letter.anonymous && !mine ? "" : letter.fromName,
        anon: letter.anonymous,
        to: letter.toName,
        seal: sealInfo(letter.seal),
        sentAt: letter.sentAt,
        at: letter.arriveAt,
        km: letter.km,
        // The writer of a signed letter, for "Responder": the number the roster names them by.
        replyId: !mine && !letter.anonymous ? accountIdOf(letter.from) : null,
    };
}

/** A letter thrown away from the player's own list; gone for good once both sides have. */
export function dropLetter(player: Player, id: unknown, now = Date.now()): Outcome {
    const found = letterFor(player.steamId, id, now);
    if (found === null) {
        return fail("Essa carta já não está com você.");
    }
    if (found.mine) {
        found.letter.droppedByFrom = true;
    } else {
        found.letter.droppedByTo = true;
    }
    sweep(now);
    persistSoon();
    return { ok: true, message: found.mine ? "Carta tirada da sua lista de enviadas." : "Carta jogada fora." };
}

/** Takes away the letters nobody holds any more and the old ones. True when one went. */
export function sweep(now = Date.now()): boolean {
    const before = letters.length;
    letters = letters.filter((letter) => {
        if (letter.droppedByTo === true && letter.droppedByFrom === true) {
            return false;
        }
        const days = letter.readAt !== undefined ? lettersSettings.keepDays : lettersSettings.unreadKeepDays;
        return now - letter.arriveAt < days * DAY_MS;
    });
    for (const id of [...told]) {
        if (!letters.some((letter) => letter.id === id)) {
            told.delete(id);
        }
    }
    return letters.length !== before;
}

/** The two lists of the Cartas section, without the texts: what reached the player, newest first, and what they sent. */
export function viewFor(player: Player, now = Date.now()): Record<string, unknown> {
    const steamId = player.steamId;
    const inbox = arrivedFor(steamId, now)
        .sort((a, b) => b.arriveAt - a.arriveAt)
        .map((letter) => ({
            id: letter.id,
            title: letter.title,
            from: letter.anonymous ? "" : letter.fromName,
            anon: letter.anonymous,
            seal: sealInfo(letter.seal),
            at: letter.arriveAt,
            read: letter.readAt !== undefined,
        }));
    const sent = sentBy(steamId)
        .sort((a, b) => b.sentAt - a.sentAt)
        .map((letter) => ({
            id: letter.id,
            title: letter.title,
            to: letter.toName,
            anon: letter.anonymous,
            seal: sealInfo(letter.seal),
            sentAt: letter.sentAt,
            at: letter.arriveAt,
            km: letter.km,
        }));
    return {
        now,
        fee: lettersSettings.feeCoins,
        coins: Math.floor(moneyOf(player) / MONEY_UNIT),
        me: steamId === "" ? player.nickname : nameOf(player),
        limits: { title: lettersSettings.titleMax, body: lettersSettings.bodyMax, lines: lettersSettings.maxLines },
        seals: sealsOf(steamId),
        unread: inbox.filter((letter) => !letter.read).length,
        inbox,
        sent,
    };
}

function sendView(player: Player, now = Date.now()): void {
    try {
        emitLarge(player, "status.letters", JSON.stringify(viewFor(player, now)));
    } catch {
        // Gone.
    }
}

function tell(player: Player, pt: string, en: string): void {
    try {
        Chat.sendToPlayer(player, languageOf(player) === "en" ? en : pt);
    } catch {
        // Gone.
    }
}

/** The letters that reached their readers since the last look: each reader here is told, and their panel is sent the new list. */
export function deliver(now = Date.now()): number {
    const due = letters.filter((letter) => letter.arriveAt <= now && !told.has(letter.id) && letter.droppedByTo !== true);
    if (due.length === 0) {
        return 0;
    }
    const here = new Map<string, Player>();
    for (const player of Player.all()) {
        if (player.steamId !== "") {
            here.set(player.steamId, player);
        }
    }
    const readers = new Map<string, Letter[]>();
    for (const letter of due) {
        const reader = here.get(letter.to);
        if (reader === undefined || !reader.ready) {
            continue;
        }
        told.add(letter.id);
        readers.set(letter.to, [...(readers.get(letter.to) ?? []), letter]);
    }
    for (const [steamId, arrived] of readers) {
        const reader = here.get(steamId) as Player;
        const first = arrived[0] as Letter;
        const who = first.anonymous ? "sem assinatura" : `de ${first.fromName}`;
        if (arrived.length === 1) {
            tell(reader, `Chegou uma carta para você (${who}): "${first.title}". Leia no painel (F2), em Cartas.`, `A letter has come for you (${first.anonymous ? "unsigned" : `from ${first.fromName}`}): "${first.title}". Read it in the panel (F2), under Letters.`);
        } else {
            tell(reader, `Chegaram ${arrived.length} cartas para você. Leia no painel (F2), em Cartas.`, `${arrived.length} letters have come for you. Read them in the panel (F2), under Letters.`);
        }
        sendView(reader, now);
    }
    return readers.size;
}

/** A player who came in is told, a moment later, of the letters that wait for them unread. */
function remind(player: Player): void {
    const waiting = reminders.get(player.id);
    if (waiting !== undefined) {
        clearTimeout(waiting);
    }
    reminders.set(
        player.id,
        setTimeout(() => {
            reminders.delete(player.id);
            const now = Date.now();
            const unread = arrivedFor(player.steamId, now).filter((letter) => letter.readAt === undefined);
            for (const letter of unread) {
                told.add(letter.id);
            }
            if (unread.length === 1) {
                tell(player, "Há uma carta esperando por você: leia no painel (F2), em Cartas.", "A letter is waiting for you: read it in the panel (F2), under Letters.");
            } else if (unread.length > 1) {
                tell(player, `Há ${unread.length} cartas esperando por você: leia no painel (F2), em Cartas.`, `${unread.length} letters are waiting for you: read them in the panel (F2), under Letters.`);
            }
        }, lettersSettings.tellAfterMs),
    );
}

/** The fields of a page event: an object, or the JSON text of one (a letter's text is longer than the panel's other events). */
function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 16_384) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** A letter's request as the page sends it (flat: the client carries strings and numbers only) made into what `sendLetter` reads. */
export function requestOf(fields: Record<string, unknown>): Record<string, unknown> {
    return {
        to: fields["to"],
        title: fields["title"],
        body: fields["body"],
        seal: fields["seal"],
        anonymous: fields["anon"] === 1,
        style: { font: fields["font"], bold: fields["bold"] === 1, spacing: fields["spacing"], align: fields["align"] },
    };
}

/** An administrator takes a letter away for good. */
export function removeLetter(id: string): Letter | null {
    const letter = letters.find((one) => one.id === id) ?? null;
    if (letter === null) {
        return null;
    }
    letters = letters.filter((one) => one !== letter);
    told.delete(letter.id);
    persistSoon();
    return letter;
}

export function installLetters(): void {
    loadLetters();
    sweep();
    addPayload((player) => ({ letters: { unread: unreadOf(player.steamId) } }));

    Events.onClient(`${RESOURCE}:status.lettersAsk`, (sender) => {
        sendView(sender as Player);
    });
    Events.onClient(`${RESOURCE}:status.letterOpen`, (sender, payload) => {
        const player = sender as Player;
        const letter = openLetter(player, fieldsOf(payload)["id"]);
        if (letter === null) {
            notice(player, "Essa carta já não está com você.");
            sendView(player);
            return;
        }
        try {
            emitLarge(player, "status.letter", JSON.stringify(letter));
        } catch {
            return;
        }
        sendView(player);
    });
    Events.onClient(`${RESOURCE}:status.letterSend`, (sender, payload) => {
        const player = sender as Player;
        const outcome = sendLetter(player, requestOf(fieldsOf(payload)));
        notice(player, outcome.message);
        player.emit(`${RESOURCE}:status.letterResult`, JSON.stringify({ ok: outcome.ok, id: outcome.id ?? "" }));
        if (outcome.ok) {
            sendView(player);
        }
    });
    Events.onClient(`${RESOURCE}:status.letterDrop`, (sender, payload) => {
        const player = sender as Player;
        const outcome = dropLetter(player, fieldsOf(payload)["id"]);
        if (!outcome.ok) {
            notice(player, outcome.message);
        }
        sendView(player);
    });
    Events.onClient(`${RESOURCE}:status.letterQuote`, (sender, payload) => {
        const player = sender as Player;
        const to = fieldsOf(payload)["to"];
        const quote = quoteFor(player, to);
        player.emit(`${RESOURCE}:status.letterQuote`, JSON.stringify({ to, minutes: quote?.minutes ?? null, km: quote?.km ?? null }));
    });

    Events.on("playerSpawned", (player) => remind(player));
    Events.on("playerDisconnect", (player) => {
        lastSent.delete(player.id);
        const waiting = reminders.get(player.id);
        if (waiting !== undefined) {
            clearTimeout(waiting);
            reminders.delete(player.id);
        }
    });
    const tick = setInterval(() => {
        try {
            deliver();
        } catch (error: unknown) {
            console.log(`letters: a entrega falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, lettersSettings.tickMs);
    const purge = setInterval(() => {
        if (sweep()) {
            persistSoon();
        }
    }, lettersSettings.purgeEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(tick);
            clearInterval(purge);
            if (saveTimer !== null) {
                clearTimeout(saveTimer);
                saveTimer = null;
                persist();
            }
        }
    });
    const waiting = letters.filter((letter) => letter.arriveAt > Date.now()).length;
    console.log(`letters: ${letters.length} carta(s) guardada(s), ${waiting} a caminho; ${lettersSettings.feeCoins} moedas por carta`);
}
