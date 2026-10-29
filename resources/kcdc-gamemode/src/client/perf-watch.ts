/**
 * Where our scripts spend their time on the player's machine (2026-10-26, "otimização ... tanto da interface quanto do mundo"). The server has measured itself since
 * 2026-10-25 (`src/server/perf-watch.ts`); this is the same for the client, whose scripts are made of about thirty timers and of handlers for the game's events and
 * for our pages. It wraps `setInterval`, `setTimeout`, `Events.on`, `Events.onLocal` and `Web.on`, adds up how long each callback took, by the place that registered
 * it, and every `REPORT_MS` writes the heaviest few to the client log (`logs/KCDC.log`) and starts again:
 *
 *   perf-watch: 60 s, ours 0.12 s (0.2% of one core); heaviest: hud.js:1:5003 setInterval 250 ms: 0.03 s in 240 x (max 2 ms) | ...
 *
 * The compiled scripts are minified onto one line, so the place is file:line:column (the column says which timer of the file it is) and a timer carries its period.
 * Nothing changes but the timing: what a callback returns and what it throws reach the caller as before. Where the game has no clock finer than a millisecond the
 * totals are whole milliseconds, which add up right over many calls.
 */

declare const performance: { now(): number } | undefined;

const REPORT_MS = 60_000;
const TOP = 6;
/** A minute in which our callbacks took less than this is not worth a line in the log. */
const QUIET_MS = 15;

interface Entry {
    label: string;
    calls: number;
    total: number;
    max: number;
}

let entries = new Map<string, Entry>();
let sinceAt = Date.now();
let last = "perf-watch: nothing measured yet";

const clock = (): number => (typeof performance !== "undefined" && performance !== undefined ? performance.now() : Date.now());

/** The script and place that asked for a callback, from the stack of the registering call. */
function origin(): string {
    const lines = (new Error().stack ?? "").split("\n").slice(1);
    for (const line of lines) {
        const match = /([A-Za-z0-9_-]+)\.js:(\d+):(\d+)/.exec(line);
        if (match !== null && match[1] !== "perf-watch") {
            return `${match[1]}.js:${match[2]}:${match[3]}`;
        }
    }
    return "?";
}

function note(label: string, took: number): void {
    let entry = entries.get(label);
    if (entry === undefined) {
        entry = { label, calls: 0, total: 0, max: 0 };
        entries.set(label, entry);
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

const fixed = (n: number, digits = 1): string => n.toFixed(digits);

/** The account so far as one line, and the account started again. */
export function report(now = Date.now()): string {
    const seconds = Math.max(1, (now - sinceAt) / 1000);
    const all = [...entries.values()];
    const total = all.reduce((sum, entry) => sum + entry.total, 0);
    const top = all.sort((a, b) => b.total - a.total).slice(0, TOP);
    const body = top.map((entry) => `${entry.label}: ${fixed(entry.total / 1000, 2)} s in ${entry.calls} x (max ${Math.round(entry.max)} ms)`).join(" | ");
    last = `perf-watch: ${Math.round(seconds)} s, ours ${fixed(total / 1000, 2)} s (${fixed(total / 10 / seconds)}% of one core); heaviest: ${body || "none"}`;
    const quiet = total < QUIET_MS;
    entries = new Map();
    sinceAt = now;
    return quiet ? "" : last;
}

export function lastReport(): string {
    return last;
}

let installed = false;

type Callback = (...args: unknown[]) => unknown;

/** Wraps the timers and the event buses. Called once, before the modules register theirs. */
export function installPerfWatch(): void {
    if (installed) {
        return;
    }
    installed = true;
    try {
        wrap();
    } catch (error: unknown) {
        console.log(`perf-watch: could not measure (${error instanceof Error ? error.message : String(error)}); the scripts go on without it`);
    }
}

/** One step of the wrapping: when the runtime does not let it be done, the others still are. */
function attempt(what: string, work: () => void): void {
    try {
        work();
    } catch (error: unknown) {
        console.log(`perf-watch: could not wrap ${what} (${error instanceof Error ? error.message : String(error)}); the rest goes on`);
    }
}

function wrap(): void {
    const root = globalThis as unknown as Record<string, unknown>;
    const realInterval = root["setInterval"] as (handler: Callback, ms?: number, ...rest: unknown[]) => unknown;
    const realTimeout = root["setTimeout"] as (handler: Callback, ms?: number, ...rest: unknown[]) => unknown;
    attempt("the timers", () => {
        root["setInterval"] = (handler: Callback, ms?: number, ...rest: unknown[]): unknown => realInterval(typeof handler === "function" ? timed(`${origin()} setInterval ${ms ?? 0} ms`, handler) : handler, ms, ...rest);
        root["setTimeout"] = (handler: Callback, ms?: number, ...rest: unknown[]): unknown => realTimeout(typeof handler === "function" ? timed(`${origin()} setTimeout`, handler) : handler, ms, ...rest);
    });

    // The game's events and the messages of our pages: the handler is the last argument, the name of the event the one before it.
    const buses: Array<[string, Record<string, unknown>, string]> = [
        ["Events", Events as unknown as Record<string, unknown>, "on"],
        ["Events", Events as unknown as Record<string, unknown>, "onLocal"],
        ["Web", Web as unknown as Record<string, unknown>, "on"],
    ];
    for (const [bus, object, method] of buses) {
        attempt(`${bus}.${method}`, () => {
            const real = object[method];
            if (typeof real !== "function") {
                return;
            }
            object[method] = function (this: unknown, ...args: unknown[]): unknown {
                const at = args.length - 1;
                const handler = args[at];
                if (typeof handler === "function") {
                    args[at] = timed(`${origin()} ${bus}.${method} ${String(args[at - 1])}`, handler as Callback);
                }
                return (real as Callback).apply(this, args);
            };
        });
    }

    realInterval(() => {
        const text = report();
        if (text !== "") {
            console.log(text);
        }
    }, REPORT_MS);
    console.log("perf-watch: timing every timer and handler of ours; a line a minute when they take any time");
}
