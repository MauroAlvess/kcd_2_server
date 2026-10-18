/**
 * Skill books, read at the world's pace.
 *
 * The game's own "Ler" on a skill book asks how long to read, fades to black and skips the clock to the end of the
 * reading, then hands out the book's XP. Here the clock is the server's and nobody can skip it: the skip never finishes,
 * the screen stays black and the game hangs (user, 2026-10-16: "se o jogador for ler o livro para aprender vai travar
 * e bugar"). So the client (`src/client/skill-books.ts`) takes the book's action instead and asks here, and the reading is
 * done in real time, with the book open in the player's hands: the client closes the inventory and opens it with the
 * game's own reading screen (`Book.open`: the book model, its camera and page turns), with the book's name, its skill, its
 * description and, where the game has them, its own lines. While it is open the book's hours (4 to 12 in the game's table,
 * `skillbook-data.ts`) pass on the world's own clock, at whatever pace it runs just then (about 11 real minutes for 4 hours
 * by day, 18 by night), and when they are over the book closes and its XP is given with `player.addXp`, the game's own
 * path, level-up popup included.
 *
 * Closing the book puts it down; so do walking away, a blow, a fall and dying. What was read stays written down
 * (`playerdata/skillbooks.json`, by Steam id) and the next reading goes on from there. A book teaches once.
 *
 * `/leitura fator` (administrators) scales the hours a book asks for: 1 is the clock in full, 0.25 a quarter of it.
 * The XP of the four stat books (strength, agility, vitality, speech) is a guess: the game's table does not list it.
 */

import { sendItemUses } from "./item-uses.js";
import { SKILLBOOKS, TRACK_NAMES } from "./skillbook-data.js";
import type { SkillBook } from "./skillbook-data.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/skillbooks.json`;

export const TICK_MS = 2_000;
/** A reader who strays farther than this from where they began has put the book down. */
export const STRAY_M = 3;
export const FACTOR_MIN = 0.02;
export const FACTOR_MAX = 2;
export const DEFAULT_FACTOR = 1;
/** The pace to read at when the world's clock is stopped: the game's own. */
const FALLBACK_SCALE = 15;
/** A stall of the server is not counted as reading: at most this much time is added at once. */
const MAX_STEP_MS = 10_000;
/** A line of the book this short is a heading on its page; a longer one is a paragraph. */
const HEADING_AT_MOST = 40;
/** The mark for a book already learnt, in place of the hours read. */
export const LEARNT = -1;

/** Hours read of each book (or `LEARNT`), by Steam id and book GUID. */
export type Progress = Record<string, Record<string, number>>;

interface Saved {
    factor?: number;
    readers?: Progress;
}

interface Spot {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** What reading needs of a player: what a player object offers. */
export interface Reader {
    readonly id: number;
    readonly steamId: string;
    readonly nickname: string;
    readonly ready: boolean;
    readonly alive: boolean;
    readonly canAct: boolean;
    readonly position: Spot;
    getTrack(track: string): { readonly level: number } | null;
    addXp(track: string, xp: number): boolean;
}

export interface Deps {
    now(): number;
    /** Game seconds per real second, now. */
    scale(): number;
    /** Whether the player holds that inventory row, and it is that book. */
    owns(player: Reader, rowId: string, guid: string): boolean;
    /** A line to the player's chat, and to their notification line too when it is `loud`. */
    tell(player: Reader, text: string, loud?: boolean): void;
    /** Opens the book in the player's hands, with these pages; `close` takes it away. */
    open(player: Reader, guid: string, pages: readonly string[]): void;
    close(player: Reader): void;
    find(id: number): Reader | null;
    persist(saved: Required<Saved>): void;
    log(line: string): void;
}

interface Session {
    readonly book: SkillBook;
    readonly from: Spot;
    hours: number;
    lastAt: number;
}

const flat = (a: Spot, b: Spot): number => Math.hypot(a.x - b.x, a.y - b.y);

/** A class GUID with the dashes, braces and capitals taken off, so the game's spelling of it does not matter. */
const key = (guid: string): string => guid.toLowerCase().replace(/[^0-9a-f]/g, "");

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 512) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

const minutes = (hours: number, scale: number): number => Math.max(1, Math.round((hours * 3600) / scale / 60));

const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What the reader sees: the book's name, its skill and description, then its own lines, headings first. */
export function pagesOf(book: SkillBook): string[] {
    const first = `<title>${escape(book.name)}</title><subtitle>${escape(TRACK_NAMES[book.track] ?? book.track)}</subtitle><br/><paragraph>${escape(book.info)}</paragraph>`;
    const headings = book.text.filter((line) => line.length <= HEADING_AT_MOST).map((line) => `<heading>${escape(line)}</heading>`);
    const paragraphs = book.text.filter((line) => line.length > HEADING_AT_MOST).map((line) => `<paragraph>${escape(line)}</paragraph>`);
    const rest = [...headings, ...paragraphs].join("");
    return rest === "" ? [first] : [first, rest];
}

export class SkillReading {
    factor = DEFAULT_FACTOR;
    private readonly byGuid = new Map<string, SkillBook>(SKILLBOOKS.map((book) => [book.guid, book]));
    private readonly byKey = new Map<string, SkillBook>(SKILLBOOKS.map((book) => [key(book.guid), book]));
    private readonly sessions = new Map<number, Session>();
    private progress: Progress = {};

    constructor(private readonly deps: Deps) {}

    guids(): string[] {
        return [...this.byGuid.keys()];
    }

    load(saved: Saved): void {
        if (typeof saved.factor === "number" && saved.factor >= FACTOR_MIN && saved.factor <= FACTOR_MAX) {
            this.factor = saved.factor;
        }
        this.progress = saved.readers ?? {};
    }

    private scale(): number {
        const scale = this.deps.scale();
        return scale > 0 ? scale : FALLBACK_SCALE;
    }

    private hoursOf(player: Reader, guid: string): number {
        return this.progress[player.steamId]?.[guid] ?? 0;
    }

    private keep(player: Reader, guid: string, hours: number): void {
        const own = this.progress[player.steamId] ?? {};
        own[guid] = hours;
        this.progress[player.steamId] = own;
        this.deps.persist({ factor: this.factor, readers: this.progress });
    }

    private levelOf(player: Reader, track: string): number {
        try {
            return player.getTrack(track)?.level ?? 0;
        } catch {
            return 0;
        }
    }

    /** The client says the player used a skill book: start reading it, or say why not. */
    begin(player: Reader, payload: unknown): void {
        const fields = fieldsOf(payload);
        const row = typeof fields["id"] === "string" ? fields["id"] : "";
        const book = this.byKey.get(key(typeof fields["item"] === "string" ? fields["item"] : ""));
        if (book === undefined) {
            return;
        }
        const guid = book.guid;
        const say = (text: string): void => this.deps.tell(player, text);
        if (!player.ready || !player.alive || !player.canAct) {
            say("Você não está em condições de ler agora.");
            return;
        }
        if (this.sessions.has(player.id)) {
            say("Você já está lendo. Fique parado até terminar, ou /leitura parar.");
            return;
        }
        if (!this.deps.owns(player, row, guid)) {
            say("Esse livro não está mais com você.");
            return;
        }
        const already = this.hoursOf(player, guid);
        if (already === LEARNT) {
            say(`Você já aprendeu o que "${book.name}" ensina.`);
            return;
        }
        const have = this.levelOf(player, book.track);
        const trackName = TRACK_NAMES[book.track] ?? book.track;
        if (have < book.level) {
            say(`"${book.name}" ainda é difícil demais para você: pede nível ${book.level} em ${trackName}, e você tem ${have}.`);
            return;
        }
        const now = this.deps.now();
        const need = book.hours * this.factor;
        this.sessions.set(player.id, { book, from: { x: player.position.x, y: player.position.y, z: player.position.z }, hours: already, lastAt: now });
        this.deps.open(player, guid, pagesOf(book));
        const left = minutes(Math.max(0, need - already), this.scale());
        say(`Você abre "${book.name}" (${trackName}): leva cerca de ${left} min de leitura, no ritmo do relógio do mundo. Fechar o livro o larga, e o que você leu fica guardado.`);
        this.deps.log(`skillbooks: ${player.nickname} começou "${book.name}" (${book.track}, ${book.hours} h do livro, fator ${this.factor}, já lidas ${already.toFixed(2)} h)`);
    }

    /** One look at every reader. */
    tick(): void {
        const now = this.deps.now();
        for (const [id, session] of [...this.sessions]) {
            const player = this.deps.find(id);
            if (player === null) {
                this.sessions.delete(id);
                continue;
            }
            if (!player.ready || !player.alive || !player.canAct) {
                this.stop(player, "Você largou o livro.");
                continue;
            }
            if (flat(player.position, session.from) > STRAY_M) {
                this.stop(player, "Você se afastou e largou o livro.");
                continue;
            }
            const step = Math.min(now - session.lastAt, MAX_STEP_MS);
            session.lastAt = now;
            session.hours += (step / 1000) * (this.scale() / 3600);
            const need = session.book.hours * this.factor;
            if (session.hours >= need) {
                this.finish(player, session);
            }
        }
    }

    private finish(player: Reader, session: Session): void {
        const { book } = session;
        this.sessions.delete(player.id);
        this.deps.close(player);
        let given = false;
        try {
            given = player.addXp(book.track, book.xp);
        } catch (error: unknown) {
            this.deps.log(`skillbooks: não consegui dar ${book.xp} de XP em ${book.track} a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!given) {
            // The reading is done and stays done: the next try ends at once.
            this.keep(player, book.guid, session.hours);
            this.deps.tell(player, `Você terminou "${book.name}", mas o jogo não aceitou a experiência agora. Use o livro de novo daqui a pouco.`, true);
            return;
        }
        this.keep(player, book.guid, LEARNT);
        this.deps.tell(player, `Você terminou "${book.name}" e aprendeu: +${book.xp} de experiência em ${TRACK_NAMES[book.track] ?? book.track}.`, true);
        this.deps.log(`skillbooks: ${player.nickname} terminou "${book.name}": +${book.xp} em ${book.track}`);
    }

    /** Puts the book down, keeping what was read. */
    private stop(player: Reader, why: string): void {
        const session = this.sessions.get(player.id);
        if (session === undefined) {
            return;
        }
        this.sessions.delete(player.id);
        this.deps.close(player);
        this.keep(player, session.book.guid, session.hours);
        const share = Math.floor((session.hours / (session.book.hours * this.factor)) * 100);
        this.deps.tell(player, `${why} O que você leu fica guardado (${Math.min(99, share)}%).`);
    }

    /** The client closed the book (or could not open it, and says why). */
    shut(player: Reader, payload: unknown): void {
        const failed = fieldsOf(payload)["failed"];
        if (typeof failed === "string") {
            this.stop(player, `O livro não abriu agora (${failed.slice(0, 120) || "o jogo recusou"}).`);
            return;
        }
        this.stop(player, "Você fechou o livro.");
    }

    /** `/leitura parar`. */
    drop(player: Reader): boolean {
        if (!this.sessions.has(player.id)) {
            return false;
        }
        this.stop(player, "Você largou o livro.");
        return true;
    }

    /** A blow or a death. */
    hurt(player: Reader): void {
        if (this.sessions.has(player.id)) {
            this.stop(player, "Você foi interrompido.");
        }
    }

    /** A player who leaves keeps what they read. */
    left(player: Reader): void {
        const session = this.sessions.get(player.id);
        if (session !== undefined) {
            this.sessions.delete(player.id);
            this.keep(player, session.book.guid, session.hours);
        }
    }

    stopAll(): void {
        for (const id of [...this.sessions.keys()]) {
            const player = this.deps.find(id);
            if (player !== null) {
                this.left(player);
            }
        }
    }

    /** What `/leitura` says. */
    describe(player: Reader): string[] {
        const lines: string[] = [];
        const session = this.sessions.get(player.id);
        if (session !== undefined) {
            const need = session.book.hours * this.factor;
            lines.push(`Lendo "${session.book.name}": ${Math.floor((session.hours / need) * 100)}%, faltam cerca de ${minutes(need - session.hours, this.scale())} min. /leitura parar larga o livro.`);
        } else {
            lines.push("Você não está lendo. Para aprender com um livro de habilidade, use-o no inventário e fique parado até acabar.");
        }
        const own = this.progress[player.steamId] ?? {};
        const started = Object.entries(own).filter(([guid, hours]) => hours > 0 && hours !== LEARNT && this.byGuid.has(guid) && this.sessions.get(player.id)?.book.guid !== guid);
        for (const [guid, hours] of started) {
            const book = this.byGuid.get(guid)!;
            lines.push(`Começado: "${book.name}", ${Math.min(99, Math.floor((hours / (book.hours * this.factor)) * 100))}%.`);
        }
        const learnt = Object.values(own).filter((hours) => hours === LEARNT).length;
        if (learnt > 0) {
            lines.push(`Livros de habilidade já aprendidos: ${learnt}.`);
        }
        lines.push(this.pace());
        return lines;
    }

    /** The reading pace, as `/leitura` and the log say it. */
    pace(): string {
        return `Ritmo da leitura: ${this.factor === 1 ? "o relógio do mundo por inteiro" : `${Math.round(this.factor * 100)}% das horas do livro`}; um livro de 4 horas leva cerca de ${minutes(4 * this.factor, this.scale())} min agora.`;
    }

    /** Administrators: scale the hours a book asks for. */
    setFactor(factor: number): boolean {
        if (!Number.isFinite(factor) || factor < FACTOR_MIN || factor > FACTOR_MAX) {
            return false;
        }
        this.factor = factor;
        this.deps.persist({ factor: this.factor, readers: this.progress });
        return true;
    }

    isReading(playerId: number): boolean {
        return this.sessions.has(playerId);
    }
}

let installed: SkillReading | null = null;

/** The reading in use on the server (for the command), once installed. */
export function skillReading(): SkillReading | null {
    return installed;
}

export function installSkillBooks(): void {
    const reading = new SkillReading({
        now: () => Date.now(),
        scale: () => World.timeScale,
        owns: (reader, rowId, guid) => {
            const player = Player.getById(reader.id);
            const items = player === null ? [] : (Inventory.get(player)?.items ?? []);
            return items.some((row) => key(row.item) === key(guid) && (rowId === "" || row.id === rowId) && row.amount > 0);
        },
        tell: (reader, text, loud) => {
            const player = Player.getById(reader.id);
            if (player !== null) {
                Chat.sendToPlayer(player, text);
                if (loud === true) {
                    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
                }
            }
        },
        open: (reader, guid, pages) => Player.getById(reader.id)?.emit(`${RESOURCE}:skillbook.open`, JSON.stringify({ guid, pages })),
        close: (reader) => Player.getById(reader.id)?.emit(`${RESOURCE}:skillbook.close`, "{}"),
        find: (id) => Player.getById(id),
        persist: (saved) => {
            try {
                ensureDir(DIR);
                write(FILE, saved);
            } catch (error: unknown) {
                console.log(`skillbooks: não consegui salvar a leitura: ${error instanceof Error ? error.message : String(error)}`);
            }
        },
        log: (line) => console.log(line),
    });
    installed = reading;

    const stored = read<Saved>(FILE);
    if (stored.status === "ok") {
        reading.load(stored.value);
    } else if (stored.status === "corrupt") {
        console.log(`skillbooks: ${FILE} está ilegível (${stored.reason}); o que cada um leu começa do zero e o arquivo velho fica de lado no primeiro salvamento`);
    }

    Events.on("playerReady", (player) => {
        sendItemUses(player, "skillbook.read", reading.guids());
    });
    Events.onClient(`${RESOURCE}:skillbook.read`, (sender, payload) => reading.begin(sender as Player, payload));
    Events.onClient(`${RESOURCE}:skillbook.shut`, (sender, payload) => reading.shut(sender as Player, payload));
    Events.on("playerDamage", (player) => reading.hurt(player));
    Events.on("playerDied", (player) => reading.hurt(player));
    Events.on("playerDisconnect", (player) => reading.left(player));
    const timer = setInterval(() => reading.tick(), TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            reading.stopAll();
        }
    });
    console.log(`skillbooks: ${SKILLBOOKS.length} livros de habilidade lidos em tempo real (fator ${reading.factor}); ${reading.pace()}`);
}
