import { useChatDriver } from "./chat-state.js";
import { onUiScale, uiFactor } from "./ui-scale.js";

/**
 * The chat of the game, drawn by us (user, 2026-10-18: "vamos colocar o card de chat do T na parte inferior esquerda um pouco
 * acima da parte real inferior porque tem a logo Kingdoms Connected e colocar em um design nosso mesmo").
 *
 * A page of ours (`ui/chat.html`) in a view at the bottom left of the screen, above the logo of the framework. The game's own
 * overlay is hidden once the page says it has drawn (`Chat.setUIVisible(false)`: hidden, it no longer opens on T either), the
 * lines that arrive (`chatMessage`) go to the page, T focuses its writing line, and what it submits is sent as a typed line
 * (`Chat.send`, so a `/` line is a command as ever). Should the page not come up, or fail to load, the game's overlay stays.
 */

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/chat.html`;

/** Lines kept for a page that is not up yet (and for one that is born again). */
const KEPT = 100;
/** How long the page has to say it drew. */
const READY_WAIT_MS = 8_000;
const WATCH_MS = 500;

/**
 * The card sleeps -- the view hidden, so it paints nothing -- once nobody writes in it and no line has come for this long, and
 * wakes at the next line or at T (user, 2026-10-19: "a alguma coisa roubando FPS no nosso servidor ... 60 fps, mas em outro
 * servidor ficou em 100"; a view that is shown paints every frame).
 */
export const IDLE_HIDE_MS = 15_000;

interface Line {
    author: string;
    text: string;
    color: number;
}

function lineOf(message: unknown): Line | null {
    if (typeof message !== "object" || message === null) {
        return null;
    }
    const { author, text, color } = message as { author?: unknown; text?: unknown; color?: unknown };
    if (typeof text !== "string" || text === "") {
        return null;
    }
    return { author: typeof author === "string" ? author : "", text, color: typeof color === "number" && Number.isFinite(color) ? color : 0 };
}

function fieldsOf(payload: unknown): Record<string, unknown> {
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

/** Where the card goes for a screen of this size: the left edge, a hand above the bottom (the logo stands there). */
export function cardGeometry(screen: { width: number; height: number }, factor = 1): { x: number; y: number; width: number; height: number } {
    // `factor` is the player's own size for the server's pages (Opções, Resolução da interface): the page's letters follow its width.
    const width = Math.round(Math.min(screen.width * 0.6, Math.max(380, Math.min(720, screen.width * 0.27)) * factor));
    const height = Math.round(Math.min(screen.height * 0.7, Math.max(240, Math.min(460, screen.height * 0.34)) * factor));
    return { x: Math.round(screen.width * 0.012), y: Math.round(screen.height - height - screen.height * 0.15), width, height };
}

export function installChatCard(): void {
    const lines: Line[] = [];
    let view = -1;
    let ready = false;
    let failed = false;
    let asked = 0;
    let focused = false;
    let hidden = false;
    let screen = "";
    /** Asleep: hidden for having nothing to show, as against `hidden`, which is asked by the free camera or the creator. */
    let asleep = false;
    let lastActivity = Date.now();

    const wake = (): void => {
        lastActivity = Date.now();
        if (asleep && view >= 0 && ready && !hidden) {
            asleep = false;
            Web.showView(view);
        }
    };

    const place = (): void => {
        const size = Web.getScreenSize();
        const spot = cardGeometry(size, uiFactor());
        const key = `${size.width}x${size.height}@${uiFactor()}`;
        if (key !== screen) {
            screen = key;
            Web.resizeView(view, spot.width, spot.height);
            Web.setViewPosition(view, spot.x, spot.y);
        }
    };

    // The player's own size for the server's pages changes the card's too.
    onUiScale(() => {
        if (view >= 0) {
            place();
        }
    });

    const close = (): void => {
        if (!focused) {
            return;
        }
        focused = false;
        lastActivity = Date.now();
        if (view >= 0) {
            Web.focusView(view, false);
            Web.emit(view, "chat:shut", {});
        }
    };

    const open = (): void => {
        if (view < 0 || !ready || hidden || focused || Hud.isInDialogue() || !Controls.isEnabled()) {
            return;
        }
        wake();
        focused = true;
        Web.focusView(view, true);
        Web.emit(view, "chat:open", {});
    };

    const apply = (): void => {
        if (view < 0 || !ready) {
            return;
        }
        if (hidden) {
            close();
            Web.hideView(view);
        } else if (!asleep) {
            Web.showView(view);
        }
    };

    const fail = (why: string): void => {
        console.log(`chat: ${why}; fica o chat do jogo`);
        failed = true;
        ready = false;
        focused = false;
        if (view >= 0) {
            try {
                Web.destroyView(view);
            } catch {
                // It is gone already.
            }
            view = -1;
        }
        useChatDriver(null);
        Chat.setUIVisible(true);
    };

    const create = (): void => {
        const size = Web.getScreenSize();
        const spot = cardGeometry(size, uiFactor());
        try {
            view = Web.createView(PAGE, { width: spot.width, height: spot.height, x: spot.x, y: spot.y, zIndex: 60, visible: true, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            fail(`a página não abriu (${thrown instanceof Error ? thrown.message : String(thrown)})`);
            return;
        }
        screen = `${size.width}x${size.height}@${uiFactor()}`;
        asked = Date.now();
        const id = view;
        Web.on(view, "chat:ready", () => {
            if (id !== view || ready) {
                return;
            }
            ready = true;
            useChatDriver({ read: () => !hidden, write: (visible) => { hidden = !visible; apply(); } });
            Chat.setUIVisible(false);
            for (const line of lines) {
                Web.emit(view, "chat:line", line);
            }
            apply();
        });
        Web.on(view, "chat:submit", (payload) => {
            if (id !== view) {
                return;
            }
            const text = fieldsOf(payload)["text"];
            close();
            if (typeof text === "string" && text.trim() !== "") {
                Chat.send(text.trim());
            }
        });
        Web.on(view, "chat:close", () => {
            if (id === view) {
                close();
            }
        });
    };

    Events.on("chatMessage", (message) => {
        const line = lineOf(message);
        if (line === null) {
            return;
        }
        lines.push(line);
        if (lines.length > KEPT) {
            lines.shift();
        }
        if (ready && view >= 0) {
            wake();
            Web.emit(view, "chat:line", line);
        }
    });

    Events.on("browserLoadingFailed", (event) => {
        if (event.isMainFrame && event.viewId === view && !failed) {
            fail(`a página não carregou (${event.description})`);
        }
    });

    Key.bind("t", "down", open);

    const timer = setInterval(() => {
        if (failed) {
            return;
        }
        if (view < 0) {
            if (LocalPlayer?.ready) {
                create();
            }
            return;
        }
        if (!ready) {
            if (Date.now() - asked > READY_WAIT_MS) {
                fail("a página não respondeu");
            }
            return;
        }
        place();
        // A conversation of the game comes first: the writing line is put away for it.
        if (focused && Hud.isInDialogue()) {
            close();
        }
        if (!focused && !hidden && !asleep && Date.now() - lastActivity > IDLE_HIDE_MS) {
            asleep = true;
            Web.hideView(view);
        }
    }, WATCH_MS);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        if (view >= 0) {
            try {
                Web.destroyView(view);
            } catch {
                // It is gone already.
            }
            view = -1;
        }
        useChatDriver(null);
        Chat.setUIVisible(true);
    });
}
