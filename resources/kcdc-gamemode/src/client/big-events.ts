/**
 * Events the server sends in pieces when they are too big for one message (`src/server/big-emit.ts`: the client takes about
 * 29 KB in one piece, and the forge's page is 79 KB). `onLarge` hears an event whichever way it comes: whole, or as `big`
 * pieces put back together here.
 *
 * Either way the handler gets the payload PARSED, as the framework hands over a whole event ("payloads cross the wire as JSON
 * and arrive parsed"). Until 2026-10-18 evening the pieces were handed over as the text put back together, and the panel, which
 * passes the payload to its page as it comes, gave the page a string: Radovan's panel (his 51 properties and Suchdol's, the
 * only payload big enough to go in pieces besides an administrator's) showed no guild or property at all.
 */

const RESOURCE = "kcdc-gamemode";

/** Pieces of a whole that never completes are dropped after this long. */
const STALE_MS = 15_000;

/** Gets the payload as a direct event gives it, or the text put back together from the pieces. */
type Handler = (payload: unknown) => void;

const handlers = new Map<string, Handler>();
const pending = new Map<number, { readonly e: string; readonly n: number; readonly got: string[]; count: number; readonly at: number }>();

/** Hears `name` (without the resource's prefix) whole or in pieces. */
export function onLarge(name: string, handler: Handler): void {
    handlers.set(name, handler);
    Events.on(`${RESOURCE}:${name}`, (payload) => handler(payload));
}

export function installBigEvents(): void {
    Events.on(`${RESOURCE}:big`, (payload) => {
        let piece: { i?: unknown; p?: unknown; n?: unknown; e?: unknown; d?: unknown };
        try {
            piece = (typeof payload === "string" ? JSON.parse(payload) : payload) as typeof piece;
        } catch {
            return;
        }
        const { i, p, n, e, d } = piece;
        if (typeof i !== "number" || typeof p !== "number" || typeof n !== "number" || typeof e !== "string" || typeof d !== "string" || p < 0 || p >= n || n > 400) {
            return;
        }
        const now = Date.now();
        for (const [id, whole] of pending) {
            if (now - whole.at > STALE_MS) {
                pending.delete(id);
            }
        }
        let whole = pending.get(i);
        if (whole === undefined) {
            whole = { e, n, got: new Array<string>(n), count: 0, at: now };
            pending.set(i, whole);
        }
        if (whole.got[p] === undefined) {
            whole.got[p] = d;
            whole.count += 1;
        }
        if (whole.count === whole.n) {
            pending.delete(i);
            let value: unknown;
            try {
                value = JSON.parse(whole.got.join("")) as unknown;
            } catch (thrown: unknown) {
                console.log(`big events: ${whole.e} came in ${whole.n} pieces that do not make JSON: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
                return;
            }
            handlers.get(whole.e)?.(value);
        }
    });
}
