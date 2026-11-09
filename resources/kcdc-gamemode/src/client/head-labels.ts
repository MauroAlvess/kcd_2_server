/**
 * What is over the heads of the players this player knows (2026-11-04, `src/server/head-labels.ts`): the title a player chose to wear and a thief's mark. The server tells this client, alone, the
 * list of `{ id, text, colour }` it may read (`head.labels`), the whole list each time, and this hangs each on its player's nametag as a label (`Nametags.setLabel`, local: nobody else's
 * client is told). A label that is not in the new list is taken off. The server keeps the nametag itself blank, so a stranger reads nothing.
 *
 * Asked for once the player is in the world (`head.ask`), and put on again now and then: a player who comes into view after the list was told is a body the client has made since.
 */

const RESOURCE = "kcdc-gamemode";

export const LABELS_EVENT = `${RESOURCE}:head.labels`;
export const ASK_EVENT = `${RESOURCE}:head.ask`;

/** How often every label is put on again, for the bodies made since it was first hung. */
export const REAPPLY_MS = 20_000;

/** A label is a short line: the longest title with its place is well under this. */
const MAX_TEXT = 64;

export interface Label {
    readonly text: string;
    readonly colour: number;
}

/** The labels a payload carries, by player id; anything that is not a whole id with a short line and a colour is left out. */
export function parseLabels(payload: unknown): Map<number, Label> {
    let fields: unknown = payload;
    if (typeof payload === "string") {
        try {
            fields = JSON.parse(payload) as unknown;
        } catch {
            return new Map();
        }
    }
    const labels = new Map<number, Label>();
    const list = typeof fields === "object" && fields !== null ? (fields as { labels?: unknown }).labels : undefined;
    if (!Array.isArray(list)) {
        return labels;
    }
    for (const entry of list) {
        if (typeof entry !== "object" || entry === null) {
            continue;
        }
        const { id, text, colour } = entry as { id?: unknown; text?: unknown; colour?: unknown };
        if (typeof id !== "number" || !Number.isInteger(id) || typeof text !== "string" || text === "" || text.length > MAX_TEXT || typeof colour !== "number" || !Number.isFinite(colour)) {
            continue;
        }
        labels.set(id, { text, colour });
    }
    return labels;
}

let shown = new Map<number, Label>();

function hang(id: number, label: Label): void {
    try {
        // Until it is taken off: a duration of nothing holds it.
        Nametags.setLabel(id, label.text, 0, label.colour);
    } catch (thrown: unknown) {
        console.error(`head labels: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
}

function takeOff(id: number): void {
    try {
        Nametags.clearLabel(id);
    } catch {
        // The body is not here.
    }
}

/** Puts the labels of the list on, and takes off the ones that are no longer in it or that changed. Returns how many are on. */
export function applyLabels(next: Map<number, Label>): number {
    for (const id of shown.keys()) {
        if (!next.has(id)) {
            takeOff(id);
        }
    }
    for (const [id, label] of next) {
        const was = shown.get(id);
        if (was === undefined || was.text !== label.text || was.colour !== label.colour) {
            hang(id, label);
        }
    }
    shown = next;
    return shown.size;
}

export function installHeadLabels(): void {
    Events.on(LABELS_EVENT, (payload) => {
        applyLabels(parseLabels(payload));
    });
    const asking = setInterval(() => {
        if (LocalPlayer?.ready) {
            clearInterval(asking);
            Events.emitServer(ASK_EVENT);
        }
    }, 1000);
    const again = setInterval(() => {
        for (const [id, label] of shown) {
            hang(id, label);
        }
    }, REAPPLY_MS);
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(asking);
        clearInterval(again);
        shown = new Map();
        try {
            Nametags.clearLabels();
        } catch {
            // Nothing hung.
        }
    });
}
