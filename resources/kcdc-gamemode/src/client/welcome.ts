/**
 * The welcome form (user, 2026-10-24: "todo jogador que criar um personagem, ou que já tenha criado, recebe um aviso ... vamos abrir tipo um
 * formulário no centro de tela de forma vertical"): a page of ours (`ui/welcome.html`), a tall card of paper in the middle of the screen with the
 * title "Bene advenisti", the first steps of the realm, and one button that says the player has read the rules and knows the server's lore.
 *
 * The server asks for it (`welcome.open`, `src/server/welcome.ts`) for whoever has made a character and has not agreed yet, at the first look
 * after the character is made and at every entry until they agree, and repeats the ask now and then, so this module only shows the page
 * when the screen is theirs: the creator's camera is gone, no conversation is going on, no other page holds the keyboard, the body is alive. The
 * page takes the keyboard and has no way out but its button; the button goes to the server, which keeps the agreement and answers `welcome.done`.
 *
 * A page that cannot come up is given up on (the server is told, and says how to agree in the chat: `/aceitar`).
 */

import { scaleView } from "./ui-scale.js";

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/welcome.html`;

/** Server to client. */
const OPEN = `${RESOURCE}:welcome.open`;
const DONE = `${RESOURCE}:welcome.done`;
/** Client to server. */
const ACCEPT = `${RESOURCE}:welcome.accept`;
const FAILED = `${RESOURCE}:welcome.failed`;

export const LOOK_MS = 500;
/** How long the page has to say it drew. */
export const PAGE_WAIT_MS = 15_000;
/** How long the thanks stay on the screen before the page goes. */
export const LEAVE_MS = 1_600;

interface Ask {
    lang: string;
    img: string;
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

export function installWelcome(): void {
    let view = -1;
    let ready = false;
    let failed = false;
    let createdAt = 0;
    let up = false;
    let leaving = false;
    let ask: Ask | null = null;
    /** The title picture the server sent with the first ask: the later ones leave it out. */
    let picture = "";
    let language = "pt";

    const destroy = (): void => {
        if (view >= 0) {
            try {
                Web.focusView(view, false);
                Web.destroyView(view);
            } catch {
                // It is gone already.
            }
            view = -1;
        }
        ready = false;
        up = false;
    };

    const fail = (why: string): void => {
        console.log(`welcome: ${why}`);
        failed = true;
        destroy();
        Events.emitServer(FAILED, JSON.stringify({ why: why.slice(0, 120) }));
    };

    const create = (): void => {
        const size = Web.getScreenSize();
        try {
            view = Web.createView(PAGE, { width: size.width, height: size.height, x: 0, y: 0, zIndex: 110, visible: false, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            fail(`a página não abriu (${thrown instanceof Error ? thrown.message : String(thrown)})`);
            return;
        }
        createdAt = Date.now();
        const id = view;
        Web.on(view, "welcome:ready", () => {
            if (id === view) {
                ready = true;
                scaleView(view);
            }
        });
        Web.on(view, "welcome:accept", () => {
            if (id === view && !leaving) {
                Events.emitServer(ACCEPT);
            }
        });
    };

    /** Whether the screen is the player's: the form does not come up over the creator, a conversation or another page. */
    const free = (): boolean => {
        const me = LocalPlayer;
        if (!me?.ready || !me.alive) {
            return false;
        }
        try {
            if (typeof Camera !== "undefined" && typeof Camera.isShotActive === "function" && Camera.isShotActive()) {
                return false;
            }
            return !Hud.isInDialogue() && Controls.isEnabled();
        } catch {
            return false;
        }
    };

    const show = (): void => {
        if (ask === null) {
            return;
        }
        const size = Web.getScreenSize();
        Web.resizeView(view, size.width, size.height);
        Web.emit(view, "welcome:open", { lang: language, img: picture });
        Web.showView(view);
        Web.focusView(view, true);
        up = true;
    };

    Events.on(OPEN, (payload) => {
        const fields = fieldsOf(payload);
        if (typeof fields["img"] === "string" && fields["img"] !== "") {
            picture = fields["img"];
        }
        language = fields["lang"] === "en" ? "en" : "pt";
        ask = { lang: language, img: picture };
        leaving = false;
        failed = false;
    });

    Events.on(DONE, () => {
        ask = null;
        if (view < 0 || !up || leaving) {
            destroy();
            return;
        }
        leaving = true;
        Web.emit(view, "welcome:done", {});
        setTimeout(() => {
            destroy();
            leaving = false;
        }, LEAVE_MS);
    });

    const timer = setInterval(() => {
        try {
            if (ask === null || failed || leaving) {
                return;
            }
            if (view < 0) {
                if (free()) {
                    create();
                }
                return;
            }
            if (!ready) {
                if (Date.now() - createdAt > PAGE_WAIT_MS) {
                    fail("a página não respondeu");
                }
                return;
            }
            if (!up) {
                if (free()) {
                    show();
                }
                return;
            }
            // Up: whatever took the screen from it (a death, a conversation) puts it away until the screen is free again.
            const me = LocalPlayer;
            if (!me?.alive) {
                Web.hideView(view);
                Web.focusView(view, false);
                up = false;
            }
        } catch (thrown: unknown) {
            console.error(`welcome: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }, LOOK_MS);

    Events.on("browserLoadingFailed", (event) => {
        if (view >= 0 && event.isMainFrame && event.viewId === view && !failed) {
            fail(`a página não carregou (${event.description})`);
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
