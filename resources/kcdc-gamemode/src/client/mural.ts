import { onLarge } from "./big-events.js";
import { scaleView } from "./ui-scale.js";

/**
 * The notice boards' page (`ui/mural.html`; the server's side is `src/server/mural.ts`; user, 2026-10-24: "uma hud no centro da tela sem ocupar a
 * tela inteira, na nossa identidade visual"). The prompt is `cook-hint.ts`'s (kind 7, on F, at the point in front of each board); its press asks
 * the server, which answers `mural.view`: the board's name and its letters. The pictures of the page (its title and the three kinds of letter) come
 * once a session (`mural.art`) and the page keeps them; the prompt tells the server whether this client has them (`muralHasArt`).
 *
 * The page is made the first time it is needed and kept, hidden, afterwards: it covers the screen but draws a card in the middle, and takes the
 * keyboard and the mouse while it is up. It asks to put up a letter (`mural:publish`), to take one down (`mural:remove`) and to close (`mural:close`,
 * its button or Esc); the server answers the first two with `mural.result`, and sends the board again whenever it changes. A server that sends
 * `mural.close` (the player walked away from the board) puts it away too, as does a death.
 */

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/mural.html`;

/** Client to server. */
const PUBLISH = `${RESOURCE}:mural.publish`;
const REMOVE = `${RESOURCE}:mural.remove`;
const CLOSED = `${RESOURCE}:mural.closed`;

/** How long the page has to say it drew, and how often it is looked at while it is up. */
export const PAGE_WAIT_MS = 15_000;
export const LOOK_MS = 500;

let haveArt = false;
let up = false;
/** A board sent just after the page was put away (the server's update was on its way) does not bring it back. */
let ignoreUntil = 0;
const IGNORE_MS = 800;

/** The player pressed the prompt: the board that comes now is asked for. */
export function muralPressed(): void {
    ignoreUntil = 0;
}

/** Whether this session has been sent the pictures of the page already. */
export function muralHasArt(): boolean {
    return haveArt;
}

/** Whether the page is on the screen: the prompt of the board gives way to it. */
export function muralOpen(): boolean {
    return up;
}

function fieldsOf(payload: unknown): Record<string, unknown> | null {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return null;
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function installMural(): void {
    let view = -1;
    let ready = false;
    let createdAt = 0;
    let wanted = false;
    const queue: Array<[string, unknown]> = [];
    let art: Record<string, unknown> | null = null;

    const toPage = (channel: string, payload: unknown): void => {
        if (view >= 0 && ready) {
            Web.emit(view, channel, payload);
        } else {
            queue.push([channel, payload]);
        }
    };

    const reveal = (): void => {
        if (view < 0 || !ready || up || !wanted) {
            return;
        }
        const size = Web.getScreenSize();
        Web.resizeView(view, size.width, size.height);
        Web.emit(view, "mural:open", {});
        Web.showView(view);
        Web.focusView(view, true);
        up = true;
    };

    /** Puts the page away; `tell` says so to the server (which stops sending the board). */
    const close = (tell: boolean): void => {
        wanted = false;
        if (view >= 0 && up) {
            try {
                Web.focusView(view, false);
                Web.hideView(view);
            } catch {
                // It is gone already.
            }
        }
        const was = up;
        up = false;
        ignoreUntil = Date.now() + IGNORE_MS;
        if (tell && was) {
            Events.emitServer(CLOSED);
        }
    };

    const destroy = (): void => {
        if (view >= 0) {
            try {
                Web.focusView(view, false);
                Web.destroyView(view);
            } catch {
                // It is gone already.
            }
        }
        view = -1;
        ready = false;
        up = false;
        haveArt = false;
    };

    const create = (): boolean => {
        const size = Web.getScreenSize();
        try {
            view = Web.createView(PAGE, { width: size.width, height: size.height, x: 0, y: 0, zIndex: 100, visible: false, focus: false });
        } catch (thrown: unknown) {
            console.error(`mural: a página não abriu: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
            view = -1;
            return false;
        }
        createdAt = Date.now();
        ready = false;
        const id = view;
        Web.on(view, "mural:ready", () => {
            if (id !== view) {
                return;
            }
            ready = true;
            scaleView(view);
            if (art !== null) {
                Web.emit(view, "mural:art", art);
            }
            for (const [channel, payload] of queue.splice(0)) {
                Web.emit(view, channel, payload);
            }
            reveal();
        });
        Web.on(view, "mural:publish", (payload) => {
            const fields = fieldsOf(payload);
            if (id === view && fields !== null) {
                Events.emitServer(PUBLISH, JSON.stringify(fields));
            }
        });
        Web.on(view, "mural:remove", (payload) => {
            const fields = fieldsOf(payload);
            if (id === view && fields !== null) {
                Events.emitServer(REMOVE, JSON.stringify({ id: fields["id"] }));
            }
        });
        Web.on(view, "mural:close", () => {
            if (id === view) {
                close(true);
            }
        });
        return true;
    };

    onLarge("mural.art", (payload) => {
        const fields = fieldsOf(payload);
        if (fields === null) {
            return;
        }
        art = fields;
        haveArt = true;
        if (view >= 0 && ready) {
            Web.emit(view, "mural:art", fields);
        }
    });

    onLarge("mural.view", (payload) => {
        const fields = fieldsOf(payload);
        if (fields === null) {
            return;
        }
        if (!up && Date.now() < ignoreUntil) {
            return;
        }
        wanted = true;
        if (view < 0 && !create()) {
            wanted = false;
            return;
        }
        toPage("mural:view", fields);
        reveal();
    });

    Events.on(`${RESOURCE}:mural.result`, (payload) => {
        const fields = fieldsOf(payload);
        if (fields !== null) {
            toPage("mural:result", fields);
        }
    });
    Events.on(`${RESOURCE}:mural.close`, () => close(false));

    const timer = setInterval(() => {
        try {
            if (view >= 0 && !ready && wanted && Date.now() - createdAt > PAGE_WAIT_MS) {
                console.error("mural: a página não respondeu");
                wanted = false;
                destroy();
                return;
            }
            // Whatever took the screen from it (a death) puts it away.
            if (up && !LocalPlayer?.alive) {
                close(true);
            }
        } catch (thrown: unknown) {
            console.error(`mural: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }, LOOK_MS);

    Events.on("browserLoadingFailed", (event) => {
        if (view >= 0 && event.isMainFrame && event.viewId === view) {
            console.error(`mural: a página não carregou (${event.description})`);
            wanted = false;
            destroy();
        }
    });

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        destroy();
    });
}
