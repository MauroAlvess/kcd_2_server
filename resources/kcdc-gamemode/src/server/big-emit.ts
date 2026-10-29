/**
 * Events too big for one message, sent in pieces the client puts back together (`src/client/big-events.ts`).
 *
 * The client takes an event's payload in one piece only up to about 29 KB: the forge's page (79 KB of recipes) arrived cut at
 * byte 29,280 and the client could not read it ("Failed to parse event payload JSON ... at position 29280", 2026-10-18), so
 * "Forjar" opened nothing. A payload over `PIECE_BYTES` goes as `big` messages instead, each a slice of the text with the
 * event's name, a number for the whole and its place in it.
 */

const RESOURCE = "kcdc-gamemode";

/** The most one message carries here, its envelope included: well under the ~29 KB that broke. */
export const PIECE_BYTES = 24_000;

let nextId = 1;

/** How many bytes a text takes as UTF-8. */
export function utf8Length(text: string): number {
    let bytes = 0;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code < 0x80) {
            bytes += 1;
        } else if (code < 0x800) {
            bytes += 2;
        } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
            bytes += 4;
            i += 1;
        } else {
            bytes += 3;
        }
    }
    return bytes;
}

/** The text in slices whose envelopes stay under `PIECE_BYTES`; never cut between the two halves of a surrogate pair. */
export function slices(text: string, event: string, limit = PIECE_BYTES): string[] {
    const out: string[] = [];
    let start = 0;
    let size = Math.max(1000, Math.floor(limit / 2));
    while (start < text.length) {
        let end = Math.min(text.length, start + size);
        // Shrink until the escaped slice, in its envelope, fits.
        for (;;) {
            if (end < text.length && end > start + 1) {
                const code = text.charCodeAt(end - 1);
                if (code >= 0xd800 && code <= 0xdbff) {
                    end -= 1;
                }
            }
            const envelope = JSON.stringify({ i: 0, p: out.length, n: 9999, e: event, d: text.slice(start, end) });
            if (utf8Length(envelope) <= limit || end - start <= 1) {
                break;
            }
            end = start + Math.max(1, Math.floor((end - start) * 0.8));
        }
        out.push(text.slice(start, end));
        start = end;
    }
    return out;
}

/** Sends `json` as the event `name` (without the resource's prefix), in pieces when it is too big for one message. */
export function emitLarge(player: Player, name: string, json: string): number {
    if (utf8Length(json) <= PIECE_BYTES) {
        player.emit(`${RESOURCE}:${name}`, json);
        return 1;
    }
    const id = nextId++;
    const pieces = slices(json, name);
    pieces.forEach((d, p) => player.emit(`${RESOURCE}:big`, JSON.stringify({ i: id, p, n: pieces.length, e: name, d })));
    return pieces.length;
}
