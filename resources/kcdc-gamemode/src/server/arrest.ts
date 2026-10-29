/**
 * Arrest and the pillory (user, 2026-10-29: "nos cargos que fizerem exemplo guarda, capitão, milícia, ter uma opção nova de, ao apertar E em um jogador que seja abaixo deles em
 * nível hierárquico, prender: o jogador fica com as mãos algemadas e não consegue fazer nada além de andar, nem correr, nem abrir nenhum menu além de Esc, e falar; ele pode ser
 * solto; além disso colocar no pelourinho: chegar no pelourinho, apertar E, escolher colocar, aparecem os nomes dos jogadores presos, escolhe e põe a quantidade de tempo, 15 min,
 * 30 min, 1 h, 2 h; quando o tempo acabar o jogador sai; e se deslogar e logar continua preso se não acabou o tempo").
 *
 * Who may arrest: a holder of one of the titles of `ARREST_TITLES` (nobility.ts: the soldier, the guards, the captains, the bailiff, the judge, the knights and the lords above them),
 * and an administrator; and only somebody BELOW them on the realm's ladder (`levelOfPlayer`: the level of their highest title, and for one with no title a noble stands at 5, a lesser
 * noble at 6 and a commoner at 7). The talk key (E) on that person offers "Prender" in the list of `encounters.ts`; on somebody already arrested it offers "Soltar" to whoever
 * outranks them and answers to no lower a level than the one who arrested them (the one who arrested may always).
 *
 * An arrested player (kind `cuffs`) is held to a walk (`setMovementMode`, the engine's own run and sprint permissions), the game's menus and its actions are taken away on their client
 * (`src/client/arrest.ts`: the sword, the use key, the bag, the map ... everything but the pause menu, the chat and the voice), and the server drops every message their client sends for
 * anything but a few it needs to stay in the game (`installRestraintGate`: a page that is somehow open does nothing). Handcuffs end by themselves after `CUFF_MAX_MS`, so nobody is left
 * bound for ever when no officer is about. Death ends them too.
 *
 * The pillory (kind `pillory`): the villages' own, which the level has (`PILLORIES`, read out of `level.pak`). An officer within a few metres of one has a hint, "Pelourinho",
 * on E (`arrest.pillory`): the page of the game's dialogue lists the arrested standing near, then the four sentences. The one put in is set at the pillory and kept there until the
 * time is over, which is counted by the clock and goes on while they are away: a player who logs out and in again is still held, to the minute. Kept in `playerdata/arrests.json`.
 */

import { isAdmin } from "./auth.js";
import { nameOf } from "./acquaintances.js";
import { addCommandGate } from "./command.js";
import { COMMONER_LEVEL, levelOfTitles, mayArrestWith } from "./nobility.js";
import { getSocialStatus } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { titlesOf } from "./titles.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/arrests.json`;

export type ArrestKind = "cuffs" | "pillory";

/** How long handcuffs hold when no officer has taken the prisoner to the pillory (and no officer has let them go): half an hour. */
export const CUFF_MAX_MS = 30 * 60_000;

/** The sentences of the pillory (user: 15 m, 30 m, 1 h, 2 h). */
export const SENTENCES: ReadonlyArray<{ readonly id: string; readonly minutes: number; readonly text: string }> = [
    { id: "15", minutes: 15, text: "15 minutos" },
    { id: "30", minutes: 30, text: "30 minutos" },
    { id: "60", minutes: 60, text: "1 hora" },
    { id: "120", minutes: 120, text: "2 horas" },
];

/** How near a pillory an officer must stand (planar, metres) and how far above or below. */
export const PILLORY_REACH_M = 3.5;
const PILLORY_REACH_Z_M = 4;
/** How far from the officer an arrested player may stand and still be listed for the pillory. */
export const PRISONER_NEAR_M = 40;
/** How far a prisoner of the pillory may drift from its spot before the server puts them back. */
export const PIN_M = 1.2;
/** The most arrested players one page of the game's list can offer (it takes eight rows, one is "Sair"). */
const LIST_MAX = 7;

export interface Pillory {
    readonly id: string;
    readonly name: string;
    /** Where the one put in is set: the level's own prisoner spot in front of the stocks where it has one, the stocks themselves elsewhere (2026-10-29, `level.pak`). */
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export const PILLORIES: readonly Pillory[] = [
    { id: "suchdol", name: "Suchdol", x: 573.72, y: 3254.48, z: 148.74 },
    { id: "malesov", name: "Malešov", x: 579.14, y: 263.04, z: 110.68 },
    { id: "miskowitz", name: "Miskowitz", x: 1518.94, y: 1989.63, z: 146.47 },
    { id: "kuttenberg", name: "Kuttenberg, na prefeitura", x: 3172.79, y: 710.43, z: 53.5 },
    { id: "kuttenberg-forca", name: "Kuttenberg, no campo das execuções", x: 3331.8, y: 305.15, z: 29.17 },
    { id: "zikmundovo", name: "Zikmundovo", x: 1615.46, y: 2812.62, z: 191.52 },
];

export interface ArrestRecord {
    readonly steamId: string;
    /** What the prisoner is called (for the list, and when they are away). */
    readonly name: string;
    kind: ArrestKind;
    /** Who arrested them, or last sentenced them: a Steam id, "" for an administrator who has none. */
    by: string;
    byName: string;
    /** The level of that officer: no officer below it lets the prisoner go. */
    byLevel: number;
    readonly at: number;
    until: number;
    /** The pillory they are in, for `pillory`. */
    pillory: string;
}

const records = new Map<string, ArrestRecord>();
let writable = true;
let officerSent = new Map<number, string>();

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, arrests: Object.fromEntries(records) });
    } catch (error: unknown) {
        console.log(`arrest: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function playerBySteam(steamId: string): Player | null {
    return steamId === "" ? null : (Player.all().find((player) => player.steamId === steamId && player.ready) ?? null);
}

function apart(a: Player, b: Player): number {
    return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
}

// ---------------------------------------------------------------------------------------------
// Who stands where on the ladder, and who may do what.

/** The level of a player on the realm's ladder: 1 the King ... 7 a commoner with no title; a noble with none is at 5 and a lesser noble at 6. */
export function levelOfPlayer(steamId: string): number {
    const byTitles = levelOfTitles(titlesOf(steamId));
    if (byTitles < COMMONER_LEVEL) {
        return byTitles;
    }
    const status = getSocialStatus(steamId);
    return status === "nobilis" ? 5 : status === "minor" ? 6 : COMMONER_LEVEL;
}

export function arrestOf(steamId: string): ArrestRecord | null {
    return steamId === "" ? null : (records.get(steamId) ?? null);
}

/** Whether the player is arrested now (handcuffed or in the pillory). */
export function isArrested(player: { readonly steamId: string }): boolean {
    return player.steamId !== "" && records.has(player.steamId);
}

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const yes: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

/** Whether `actor` may arrest `target`: an officer's power, and somebody below them on the ladder. */
export function mayArrest(actor: Player, target: Player): Verdict {
    if (actor.id === target.id) {
        return no("Ninguém se prende a si mesmo.");
    }
    if (target.steamId === "") {
        return no("Essa pessoa não pode ser presa.");
    }
    if (isArrested(actor)) {
        return no("Você está preso.");
    }
    if (isArrested(target)) {
        return no("Essa pessoa já está presa.");
    }
    const staff = isAdmin(actor);
    if (!staff && !mayArrestWith(titlesOf(actor.steamId))) {
        return no("O seu cargo não dá o poder de prender.");
    }
    if (!staff && isAdmin(target)) {
        return no("Você não pode prender essa pessoa.");
    }
    if (!staff && levelOfPlayer(target.steamId) <= levelOfPlayer(actor.steamId)) {
        return no("Só se prende quem está abaixo de você na hierarquia.");
    }
    return yes;
}

/** Whether `actor` may let `record`'s prisoner go, or put them in the pillory: an administrator, the one who arrested them, or an officer who outranks them and no lower than the one who arrested. */
export function mayRelease(actor: Player, record: ArrestRecord): Verdict {
    if (isArrested(actor)) {
        return no("Você está preso.");
    }
    if (isAdmin(actor) || (record.by !== "" && record.by === actor.steamId)) {
        return yes;
    }
    if (!mayArrestWith(titlesOf(actor.steamId))) {
        return no("O seu cargo não dá esse poder.");
    }
    const mine = levelOfPlayer(actor.steamId);
    if (mine >= levelOfPlayer(record.steamId)) {
        return no("Só quem está acima do preso na hierarquia o solta.");
    }
    if (mine > record.byLevel) {
        return no("Quem o prendeu está acima de você: só ele, ou alguém acima dele, o solta.");
    }
    return yes;
}

// ---------------------------------------------------------------------------------------------
// Binding and freeing.

function bind(player: Player, record: ArrestRecord): void {
    try {
        player.setMovementMode({ walkEnforced: true, walkByDefault: true });
    } catch (error: unknown) {
        console.log(`arrest: o passo de ${record.name} não pôde ser limitado: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        player.dismount();
    } catch {
        // Not on a horse.
    }
    player.emit(`${RESOURCE}:arrest.state`, JSON.stringify({ on: true, kind: record.kind, until: record.until }));
}

function unbind(player: Player): void {
    try {
        player.setMovementMode({ walkEnforced: false, walkByDefault: false });
    } catch {
        // The player is gone.
    }
    player.emit(`${RESOURCE}:arrest.state`, JSON.stringify({ on: false }));
}

function pilloryOf(record: ArrestRecord): Pillory | null {
    return record.kind === "pillory" ? (PILLORIES.find((candidate) => candidate.id === record.pillory) ?? null) : null;
}

/** Sets a prisoner of the pillory at its spot (and keeps them there). */
function pin(player: Player, place: Pillory, force: boolean): void {
    const away = Math.hypot(player.position.x - place.x, player.position.y - place.y, player.position.z - place.z);
    if (force || away > PIN_M) {
        try {
            player.teleport({ x: place.x, y: place.y, z: place.z });
        } catch (error: unknown) {
            console.log(`arrest: ${player.nickname} não pôde ser posto no pelourinho de ${place.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

function end(record: ArrestRecord, why: string, quiet = false): void {
    records.delete(record.steamId);
    save();
    console.log(`arrest: ${record.name} está livre (${why})`);
    const player = playerBySteam(record.steamId);
    if (player !== null) {
        unbind(player);
        if (!quiet) {
            tell(player, why === "tempo" ? (record.kind === "pillory" ? "A sua pena acabou: você está livre." : "As algemas foram tiradas: o tempo acabou.") : "Você está livre.");
        }
    }
}

/** An officer arrests `target`: handcuffed, set to a walk, held for at most `CUFF_MAX_MS`. */
export function arrest(actor: Player, target: Player, now: number = Date.now()): { readonly ok: boolean; readonly message: string } {
    const verdict = mayArrest(actor, target);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    if (apart(actor, target) > 8) {
        return { ok: false, message: "Essa pessoa não está mais por perto." };
    }
    const record: ArrestRecord = {
        steamId: target.steamId,
        name: nameOf(target),
        kind: "cuffs",
        by: actor.steamId,
        byName: nameOf(actor),
        byLevel: isAdmin(actor) ? 0 : levelOfPlayer(actor.steamId),
        at: now,
        until: now + CUFF_MAX_MS,
        pillory: "",
    };
    records.set(record.steamId, record);
    save();
    bind(target, record);
    console.log(`arrest: ${actor.nickname} prendeu ${target.nickname}`);
    tell(target, `${record.byName} prendeu você. As suas mãos estão algemadas: você só pode andar e falar, até que um oficial solte você ou o leve ao pelourinho.`);
    return { ok: true, message: `Você prendeu ${record.name}. Leve-o ao pelourinho, ou solte-o pela tecla E.` };
}

/** An officer lets a prisoner go. */
export function release(actor: Player, target: Player): { readonly ok: boolean; readonly message: string } {
    const record = arrestOf(target.steamId);
    if (record === null) {
        return { ok: false, message: "Essa pessoa não está presa." };
    }
    const verdict = mayRelease(actor, record);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    const was = record.kind;
    end(record, "solto", true);
    tell(target, `${nameOf(actor)} soltou você.`);
    return { ok: true, message: `${record.name} foi solto${was === "pillory" ? " do pelourinho" : ""}.` };
}

/** An officer puts an arrested player in a pillory for `minutes`. */
export function sentence(actor: Player, target: Player, placeId: string, minutes: number, now: number = Date.now()): { readonly ok: boolean; readonly message: string } {
    const place = PILLORIES.find((candidate) => candidate.id === placeId);
    const choice = SENTENCES.find((candidate) => candidate.minutes === minutes);
    const record = arrestOf(target.steamId);
    if (place === undefined || choice === undefined) {
        return { ok: false, message: "Esse pelourinho ou essa pena não existe." };
    }
    if (record === null) {
        return { ok: false, message: "Essa pessoa não está presa." };
    }
    const verdict = mayRelease(actor, record);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    record.kind = "pillory";
    record.pillory = place.id;
    record.until = now + choice.minutes * 60_000;
    record.by = actor.steamId;
    record.byName = nameOf(actor);
    record.byLevel = isAdmin(actor) ? 0 : levelOfPlayer(actor.steamId);
    save();
    bind(target, record);
    pin(target, place, true);
    console.log(`arrest: ${actor.nickname} pôs ${target.nickname} no pelourinho de ${place.name} por ${choice.text}`);
    tell(target, `${record.byName} pôs você no pelourinho de ${place.name} por ${choice.text}. Você sai quando o tempo acabar, mesmo se sair do jogo e voltar.`);
    return { ok: true, message: `${record.name} foi posto no pelourinho de ${place.name} por ${choice.text}.` };
}

// ---------------------------------------------------------------------------------------------
// The talk key on a player: the options of the list.

/** The rows `encounters.ts` adds to the list `speaker` sees for `target`: Prender, or Soltar. */
export function menuOptions(speaker: Player, target: Player): DialogueOption[] {
    const record = arrestOf(target.steamId);
    if (record !== null) {
        return mayRelease(speaker, record).ok ? [{ id: "release", text: record.kind === "pillory" ? "Soltar do pelourinho" : "Soltar", enabled: true }] : [];
    }
    return mayArrest(speaker, target).ok ? [{ id: "arrest", text: "Prender", enabled: true }] : [];
}

/** What the options above do; the text to tell `speaker`, or null for an option that is not these. */
export function choose(speaker: Player, target: Player, option: string): string | null {
    if (option === "arrest") {
        return arrest(speaker, target).message;
    }
    if (option === "release") {
        return release(speaker, target).message;
    }
    return null;
}

// ---------------------------------------------------------------------------------------------
// The pillory's page: who, then for how long.

interface Page {
    readonly officer: Player;
    readonly place: Pillory;
    step: "who" | "time";
    prisoner: number;
}

const pages = new Map<number, Page>();

function nearPillory(player: Player, place: Pillory): boolean {
    return Math.hypot(player.position.x - place.x, player.position.y - place.y) <= PILLORY_REACH_M + 1.5 && Math.abs(player.position.z - place.z) <= PILLORY_REACH_Z_M;
}

/** The arrested standing near an officer whom they may put in the pillory. */
function listed(officer: Player): Player[] {
    const found: Player[] = [];
    for (const record of records.values()) {
        if (record.kind !== "cuffs" || !mayRelease(officer, record).ok) {
            continue;
        }
        const player = playerBySteam(record.steamId);
        if (player !== null && player.virtualWorld === officer.virtualWorld && apart(officer, player) <= PRISONER_NEAR_M) {
            found.push(player);
        }
    }
    return found.slice(0, LIST_MAX);
}

function whoPage(officer: Player, place: Pillory): DialoguePage {
    const prisoners = listed(officer);
    const options: DialogueOption[] = prisoners.map((player) => ({ id: `p:${player.id}`, text: nameOf(player), enabled: true }));
    options.push({ id: "leave", text: "Sair", enabled: true });
    return { line: prisoners.length > 0 ? `Pelourinho de ${place.name}: quem será posto?` : `Pelourinho de ${place.name}: não há nenhum preso por perto.`, onRight: false, options };
}

function timePage(prisoner: Player, place: Pillory): DialoguePage {
    return {
        line: `${nameOf(prisoner)} no pelourinho de ${place.name}: por quanto tempo?`,
        onRight: false,
        options: [...SENTENCES.map((one) => ({ id: `t:${one.minutes}`, text: one.text, enabled: true })), { id: "back", text: "Voltar", enabled: true }, { id: "leave", text: "Sair", enabled: true }],
    };
}

/** The officer's press of E at a pillory: opens the page if they may and are near. Whether it opened. */
export function openPillory(officer: Player, placeId: unknown): boolean {
    const place = PILLORIES.find((candidate) => candidate.id === placeId);
    if (place === undefined || !officer.ready || !officer.alive || isArrested(officer)) {
        return false;
    }
    if (!isAdmin(officer) && !mayArrestWith(titlesOf(officer.steamId))) {
        return false;
    }
    if (!nearPillory(officer, place) || Dialogue.sessionOf(officer.id) !== 0) {
        return false;
    }
    const session = Dialogue.open(officer.id, whoPage(officer, place));
    if (session === 0) {
        return false;
    }
    pages.set(session, { officer, place, step: "who", prisoner: 0 });
    return true;
}

function closePage(session: number): void {
    pages.delete(session);
    Dialogue.close(session);
}

/** A choice on a dialogue page: true when it was one of this module's pages. */
export function pageChoice(session: number, player: Player, option: string): boolean {
    const page = pages.get(session);
    if (page === undefined || page.officer.id !== player.id) {
        return false;
    }
    if (option === "leave") {
        closePage(session);
        return true;
    }
    if (!nearPillory(player, page.place)) {
        closePage(session);
        tell(player, "Você se afastou do pelourinho.");
        return true;
    }
    if (option === "back") {
        page.step = "who";
        page.prisoner = 0;
        if (!Dialogue.update(session, whoPage(player, page.place))) {
            pages.delete(session);
        }
        return true;
    }
    if (option.startsWith("p:") && page.step === "who") {
        const prisoner = Player.getById(Number(option.slice(2)));
        if (prisoner === null || !listed(player).some((one) => one.id === prisoner.id)) {
            Dialogue.update(session, whoPage(player, page.place));
            tell(player, "Essa pessoa não está mais por perto.");
            return true;
        }
        page.step = "time";
        page.prisoner = prisoner.id;
        if (!Dialogue.update(session, timePage(prisoner, page.place))) {
            pages.delete(session);
        }
        return true;
    }
    if (option.startsWith("t:") && page.step === "time") {
        const prisoner = Player.getById(page.prisoner);
        closePage(session);
        if (prisoner === null) {
            tell(player, "Essa pessoa não está mais por perto.");
            return true;
        }
        tell(player, sentence(player, prisoner, page.place.id, Number(option.slice(2))).message);
        return true;
    }
    return true;
}

export function pageClosed(session: number): void {
    pages.delete(session);
}

// ---------------------------------------------------------------------------------------------
// Time, entries, the officers' hint, and the gate.

/** The pillories an officer is told of, for their client's hint: nothing for a player who has no power to use one. */
function officerPayload(player: Player): string {
    const power = player.steamId !== "" && !isArrested(player) && (isAdmin(player) || mayArrestWith(titlesOf(player.steamId)));
    return JSON.stringify({ on: power, points: power ? PILLORIES.map((place) => ({ id: place.id, x: place.x, y: place.y, z: place.z })) : [] });
}

function tellOfficers(): void {
    const seen = new Set<number>();
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        seen.add(player.id);
        const payload = officerPayload(player);
        if (officerSent.get(player.id) !== payload) {
            officerSent.set(player.id, payload);
            player.emit(`${RESOURCE}:arrest.officer`, payload);
        }
    }
    for (const id of [...officerSent.keys()]) {
        if (!seen.has(id)) {
            officerSent.delete(id);
        }
    }
    // The hold is said again to whoever is under it: the client may not have been ready at the entry, and it takes the same word twice for once.
    for (const record of records.values()) {
        const player = playerBySteam(record.steamId);
        if (player !== null) {
            player.emit(`${RESOURCE}:arrest.state`, JSON.stringify({ on: true, kind: record.kind, until: record.until }));
        }
    }
}

/** A second of the clock: the time of every prisoner, the pillory's hold on those in it. */
export function tick(now: number = Date.now()): void {
    for (const record of [...records.values()]) {
        if (now >= record.until) {
            end(record, "tempo");
            continue;
        }
        const player = playerBySteam(record.steamId);
        if (player === null) {
            continue;
        }
        if (!player.alive) {
            end(record, "morte", true);
            continue;
        }
        const place = pilloryOf(record);
        if (place !== null) {
            pin(player, place, false);
        }
    }
}

/** An arrested player who comes back into the game is held again, or freed if their time ran out meanwhile. */
function entered(player: Player, now: number = Date.now()): void {
    const record = arrestOf(player.steamId);
    if (record === null) {
        return;
    }
    if (now >= record.until) {
        end(record, "tempo");
        return;
    }
    bind(player, record);
    const place = pilloryOf(record);
    if (place !== null) {
        pin(player, place, true);
    }
    const minutes = Math.max(1, Math.ceil((record.until - now) / 60_000));
    tell(player, record.kind === "pillory" ? `Você continua no pelourinho de ${place?.name ?? ""}: faltam ${minutes} min.` : `Você continua preso, de mãos algemadas: faltam até ${minutes} min.`);
}

/** The commands an arrested player may still type: the ones that are only speaking, or reading (an administrator is never held). */
export const ALLOWED_COMMANDS_WHILE_ARRESTED: ReadonlySet<string> = new Set(["help", "me", "do", "try", "mute", "unmute", "mutes", "idioma", "language", "camera", "admin"]);

/** The messages an arrested player's client may still send: what keeps it in the game, never what acts. */
export const ALLOWED_WHILE_ARRESTED: ReadonlySet<string> = new Set(["players.peek", "options.get", "options.set", "posture", "combat.sync", "dice.sync", "status.dict", "status.lang", "status.image", "panel.poll"]);

/**
 * Before any module registers a handler for its client's messages (it is installed ahead of `perf-watch`): what an arrested player's client sends is dropped unless it is one
 * of `ALLOWED_WHILE_ARRESTED`. The client takes the actions away already; this is for a page that is open anyway, and for a client that was changed.
 */
export function installRestraintGate(): void {
    const bus = Events as unknown as Record<string, (name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]) => unknown>;
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
            const steamId = typeof sender === "object" && sender !== null ? (sender as { steamId?: unknown }).steamId : undefined;
            if (typeof steamId === "string" && records.size > 0 && records.has(steamId) && !ALLOWED_WHILE_ARRESTED.has(short)) {
                return undefined;
            }
            return handler(sender, ...args);
        };
        return real.call(this, name, gated, ...rest);
    };
}

export function installArrest(): void {
    const loaded = read<{ arrests?: Record<string, unknown> }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value.arrests === "object" && loaded.value.arrests !== null) {
        for (const [steamId, raw] of Object.entries(loaded.value.arrests)) {
            const entry = raw as Partial<ArrestRecord> | null;
            if (entry === null || typeof entry !== "object" || steamId === "" || typeof entry.until !== "number" || !Number.isFinite(entry.until)) {
                continue;
            }
            records.set(steamId, {
                steamId,
                name: typeof entry.name === "string" ? entry.name : "",
                kind: entry.kind === "pillory" ? "pillory" : "cuffs",
                by: typeof entry.by === "string" ? entry.by : "",
                byName: typeof entry.byName === "string" ? entry.byName : "",
                byLevel: typeof entry.byLevel === "number" && Number.isFinite(entry.byLevel) ? entry.byLevel : 0,
                at: typeof entry.at === "number" && Number.isFinite(entry.at) ? entry.at : 0,
                until: entry.until,
                pillory: typeof entry.pillory === "string" ? entry.pillory : "",
            });
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`arrest: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    console.log(`arrest: ${records.size} preso(s) guardado(s); ${PILLORIES.length} pelourinho(s) do nível`);

    // Nothing but speaking: no `/preso`, no horse or cart called, no gesture (the chat commands do not pass through the gate of the client's messages).
    addCommandGate((player, name) => (records.has(player.steamId) && !ALLOWED_COMMANDS_WHILE_ARRESTED.has(name) && !isAdmin(player) ? "Você está preso: só pode falar." : null));

    Events.on("playerSpawned", (player) => entered(player));
    Player.all().forEach((player) => {
        if (player.ready) {
            entered(player);
        }
    });
    Events.onClient(`${RESOURCE}:arrest.pillory`, (sender, payload) => {
        const player = sender as Player;
        let value = payload;
        if (typeof value === "string" && value.length <= 128) {
            try {
                value = JSON.parse(value) as unknown;
            } catch {
                return;
            }
        }
        const id = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : undefined;
        openPillory(player, id);
    });
    Events.on("dialogueChoice", (session, player, option) => {
        pageChoice(session, player, option);
    });
    Events.on("dialogueClosed", (session) => pageClosed(session));
    Events.on("playerDisconnect", (player) => {
        officerSent.delete(player.id);
        for (const [session, page] of [...pages]) {
            if (page.officer.id === player.id) {
                pages.delete(session);
            }
        }
    });
    const timer = setInterval(() => tick(), 1_000);
    const officers = setInterval(tellOfficers, 4_000);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            clearInterval(officers);
            for (const record of records.values()) {
                const player = playerBySteam(record.steamId);
                if (player !== null) {
                    unbind(player);
                }
            }
        }
    });
}

/** What `/preso` shows and does (administrators): the prisoners and who put them there, and a way to free one. */
export function prisoners(now: number = Date.now()): Array<{ readonly name: string; readonly kind: ArrestKind; readonly by: string; readonly minutes: number; readonly online: boolean; readonly place: string }> {
    return [...records.values()].map((record) => ({
        name: record.name,
        kind: record.kind,
        by: record.byName,
        minutes: Math.max(0, Math.ceil((record.until - now) / 60_000)),
        online: playerBySteam(record.steamId) !== null,
        place: pilloryOf(record)?.name ?? "",
    }));
}

/** An administrator frees whoever matches `query` (a name or a part of one). How many were freed. */
export function releaseByName(query: string): number {
    const wanted = query.trim().toLowerCase();
    if (wanted === "") {
        return 0;
    }
    let freed = 0;
    for (const record of [...records.values()]) {
        if (record.name.toLowerCase().includes(wanted)) {
            end(record, "administrador");
            freed += 1;
        }
    }
    return freed;
}
