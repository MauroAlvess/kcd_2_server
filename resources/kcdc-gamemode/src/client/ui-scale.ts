/**
 * The size of this server's pages on the screen (2026-10-25, user: "vamos adicionar nas opções uma também de resolução, para o jogador poder
 * mudar a resolução da interface se quiser"): a factor over each page's own fit to the screen, picked in the panel (Opções, Resolução da
 * interface) and kept by the server with the player's other options (`src/server/options.ts`, field `ui`). Each page of ours is told it
 * when it says it is ready, and again whenever it changes; the chat card's view is sized by it too (`chat-card.ts`).
 */

const RESOURCE = "kcdc-gamemode";

/** The steps a player can pick, in percent of what fits the screen. */
export const UI_FACTORS: Readonly<Record<string, number>> = { "80": 0.8, "90": 0.9, "100": 1, "110": 1.1, "125": 1.25 };

let step = "100";
let factor = 1;
const views = new Set<number>();
const listeners = new Set<() => void>();

/** The factor the pages are drawn at now. */
export function uiFactor(): number {
    return factor;
}

function tell(view: number): void {
    try {
        if (!Web.emit(view, "ui:scale", { scale: factor, step })) {
            views.delete(view);
        }
    } catch {
        views.delete(view);
    }
}

/** A page of ours, now ready: it is told the size now and at every change. */
export function scaleView(view: number): void {
    if (view < 0) {
        return;
    }
    views.add(view);
    tell(view);
}

/** Something sized by the factor that is not a page (the chat card's view): called at every change. */
export function onUiScale(listener: () => void): void {
    listeners.add(listener);
}

function parse(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function apply(next: string): void {
    if (next === step || UI_FACTORS[next] === undefined) {
        return;
    }
    step = next;
    factor = UI_FACTORS[next] as number;
    for (const view of [...views]) {
        tell(view);
    }
    for (const listener of listeners) {
        try {
            listener();
        } catch (thrown: unknown) {
            console.error(`ui scale: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }
}

export function installUiScale(): void {
    // What the server keeps: sent once the player is in the world (`camera.ts` asks), and after every choice.
    Events.on(`${RESOURCE}:options.state`, (payload) => {
        const ui = parse(payload)["ui"];
        if (typeof ui === "string") {
            apply(ui);
        }
    });
    // A choice from the panel: put on now, then kept by the server.
    Events.onLocal("ui.choose", (payload) => {
        const ui = parse(payload)["ui"];
        if (typeof ui !== "string" || UI_FACTORS[ui] === undefined) {
            return;
        }
        apply(ui);
        Events.emitServer(`${RESOURCE}:options.set`, JSON.stringify({ ui }));
    });
}
