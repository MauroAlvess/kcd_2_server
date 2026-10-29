/**
 * Where the server's main thread spends its time (2026-10-25: ticks of 250 ms against a 17 ms budget with twenty players; the animations of the
 * game and the voice lagged). The engine runs one thread for everything, ours included, and says only "Server tick took N ms". This wraps the
 * ways our code gets run -- the timers (`setInterval`, `setTimeout`) and the event handlers (`Events.on`, `Events.onClient`) -- and adds up
 * how long each callback took, by the place that registered it (file and line of the module's compiled code, and the event's name). Every
 * `REPORT_MS` it writes the heaviest few to the log, and starts again:
 *
 *   perf-watch: 60 s, nossos 1.9 s (3,1%); mais pesados: animals.js:310 setInterval 1000 ms: 1.2 s em 60 x (máx 140 ms) | ...
 *
 * It changes nothing but the timing; a throwing callback still throws as it did. `lastReport()` keeps the last report for whoever wants to show it.
 *
 * A module that wants to know where its own callback spends its time hands the parts in through `addSection`, which is on the global object as
 * `__kcdcSection` while this is watching; the report shows them apart, after `por dentro:`, and does not add them to the total a second time.
 */

declare const performance: { now(): number } | undefined;
declare const process: { memoryUsage?: () => { heapUsed: number; heapTotal: number; rss: number } } | undefined;

const REPORT_MS = 60_000;
const TOP = 8;

interface Entry {
    label: string;
    calls: number;
    total: number;
    max: number;
}

let entries = new Map<string, Entry>();
/** Parts of a callback that took long enough to want to know (`addSection`): reported apart, since the callback already counts their time. */
let sections = new Map<string, Entry>();
let sinceAt = Date.now();
let last = "perf-watch: ainda sem medida";

const clock = (): number => (typeof performance !== "undefined" && performance !== undefined ? performance.now() : Date.now());

/** The module and line that asked for a callback, from the stack of the registering call. */
function origin(skip: number): string {
    const lines = (new Error().stack ?? "").split("\n").slice(skip);
    for (const line of lines) {
        const match = /([A-Za-z0-9_-]+)\.js:(\d+):\d+/.exec(line);
        if (match !== null && match[1] !== "perf-watch") {
            return `${match[1]}.js:${match[2]}`;
        }
    }
    return "?";
}

function note(label: string, took: number, into: Map<string, Entry> = entries): void {
    let entry = into.get(label);
    if (entry === undefined) {
        entry = { label, calls: 0, total: 0, max: 0 };
        into.set(label, entry);
    }
    entry.calls += 1;
    entry.total += took;
    entry.max = Math.max(entry.max, took);
}

function timed<A extends unknown[], R>(label: string, fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
        const began = clock();
        try {
            return fn(...args);
        } finally {
            note(label, clock() - began);
        }
    };
}

const fixed = (n: number, digits = 1): string => n.toFixed(digits).replace(".", ",");

/**
 * How long a named part of a callback took, in milliseconds: the modules that want to know where their own time goes (the animals' round, whose engine
 * calls are most of its time) hand it in through `globalThis.__kcdcSection`, which exists only while this watch is installed.
 */
export function addSection(label: string, took: number): void {
    note(label, took, sections);
}

const SECTIONS_TOP = 10;

/** The memory of the process, for the report: a heap that has grown is a garbage collection that stops everything while it runs. Nothing when the runtime does not say. */
function memory(): string {
    try {
        const used = typeof process !== "undefined" && process !== undefined ? process.memoryUsage?.() : undefined;
        const mb = (bytes: number): string => String(Math.round(bytes / 1_048_576));
        return used === undefined ? "" : `; memória: heap ${mb(used.heapUsed)} de ${mb(used.heapTotal)} MB, rss ${mb(used.rss)} MB`;
    } catch {
        return "";
    }
}

/** What the kept listings of the engine did this minute (`listings.ts` hands its report in through `globalThis.__kcdcListings`); nothing when they are not kept. */
function listings(): string {
    try {
        const hand = (globalThis as unknown as Record<string, unknown>)["__kcdcListings"];
        return typeof hand === "function" ? String((hand as () => string)()) : "";
    } catch {
        return "";
    }
}

/**
 * What a look at everybody costs, measured once a minute on the bodies that are here: `ready`, `alive` and `position` of each, timed together. Everything of ours that
 * runs through the players (the menus' "who is near", the lock-on, the animals, the saves) is made of such reads, so this is the number to multiply by the players
 * (2026-10-27: asked to be ready for two hundred; on a copy of the live server a read of an NPC took 0.3-1.4 us). Nothing when nobody is here.
 */
function reading(): string {
    try {
        if (typeof Player === "undefined") {
            return "";
        }
        const players = Player.all();
        if (players.length === 0) {
            return "";
        }
        const began = clock();
        for (const player of players) {
            void player.ready;
            void player.alive;
            void player.position;
        }
        const took = clock() - began;
        return `; leitura: ${players.length} jogador(es), ${fixed((took * 1000) / (players.length * 3), 2)} us por leitura, ${fixed(took, 2)} ms para olhar todos`;
    } catch {
        return "";
    }
}

export function report(now = Date.now()): string {
    const seconds = Math.max(1, (now - sinceAt) / 1000);
    const all = [...entries.values()];
    const total = all.reduce((sum, entry) => sum + entry.total, 0);
    const top = all.sort((a, b) => b.total - a.total).slice(0, TOP);
    const body = top.map((entry) => `${entry.label}: ${fixed(entry.total / 1000, 2)} s em ${entry.calls} x (máx ${Math.round(entry.max)} ms)`).join(" | ");
    const parts = [...sections.values()].sort((a, b) => b.total - a.total).slice(0, SECTIONS_TOP);
    const inside = parts.length === 0 ? "" : `; por dentro: ${parts.map((entry) => `${entry.label} ${fixed(entry.total / 1000, 2)} s em ${entry.calls} x (máx ${fixed(entry.max)} ms)`).join(" | ")}`;
    last = `perf-watch: ${Math.round(seconds)} s, nossos ${fixed(total / 1000, 2)} s (${fixed((total / 10) / seconds)}% de um núcleo); mais pesados: ${body || "nenhum"}${inside}${listings()}${reading()}${memory()}`;
    entries = new Map();
    sections = new Map();
    sinceAt = now;
    return last;
}

export function lastReport(): string {
    return last;
}

let installed = false;

/** Wraps the timers and the event bus. Called once, before the modules register theirs. */
export function installPerfWatch(): void {
    if (installed) {
        return;
    }
    installed = true;
    try {
        (globalThis as unknown as Record<string, unknown>)["__kcdcSection"] = addSection;
        wrap();
    } catch (error: unknown) {
        console.log(`perf-watch: não consegui medir (${error instanceof Error ? error.message : String(error)}); o servidor segue sem a medida`);
    }
}

function wrap(): void {
    const root = globalThis as unknown as Record<string, unknown>;
    const realInterval = root["setInterval"] as (handler: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => unknown;
    const realTimeout = root["setTimeout"] as (handler: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => unknown;
    root["setInterval"] = (handler: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]): unknown => realInterval(timed(`${origin(2)} setInterval ${ms ?? 0} ms`, handler), ms, ...rest);
    root["setTimeout"] = (handler: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]): unknown => realTimeout(timed(`${origin(2)} setTimeout`, handler), ms, ...rest);

    const bus = Events as unknown as Record<string, (name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]) => unknown>;
    for (const method of ["on", "onClient"]) {
        const real = bus[method];
        if (typeof real !== "function") {
            continue;
        }
        bus[method] = function (this: unknown, name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]): unknown {
            return real.call(this, name, typeof handler === "function" ? timed(`${origin(2)} ${method} ${name}`, handler) : handler, ...rest);
        };
    }

    realInterval(() => {
        const text = report();
        if (!/nossos 0,0\d? s/.test(text)) {
            console.log(text);
        }
    }, REPORT_MS);
    console.log("perf-watch: medindo o tempo de cada timer e evento nosso; um resumo a cada minuto");
}
