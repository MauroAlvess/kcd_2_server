import { scaleView } from "./ui-scale.js";

/**
 * The door of the server, client side (`src/server/entry.ts`; user, 2026-10-29: "entrou, trailer, abre o formulário com as perguntas da whitelist; ao responder e for aprovado ele vai para a tela de
 * criação de personagem"). The server puts the page up for a player who has not passed the questions (`entry.open`, again every few seconds until the page says it is there); the page
 * (`ui/entry.html`) asks the ten questions (the trailer it played first was taken out on 2026-11-09); what the player answers is sent to the server as places, and the
 * server grades it and says how many were right (`entry.result`), never which. The page opens full screen and focused, so the character stands still behind it and the keyboard is the
 * page's; its only way out is the server's `entry.close`, sent when the door opens.
 *
 * A page that cannot come up (the browser is not there yet, the file is missing) is told to the server (`entry.failed`), which asks again a few seconds later, up to three times.
 */

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/entry.html`;

/** Server to client. */
const OPEN = `${RESOURCE}:entry.open`;
const QUESTIONS = `${RESOURCE}:entry.questions`;
const RESULT = `${RESOURCE}:entry.result`;
const CLOSE = `${RESOURCE}:entry.close`;
/** Client to server. */
const SHOWN = `${RESOURCE}:entry.shown`;
const START = `${RESOURCE}:entry.start`;
const ANSWER = `${RESOURCE}:entry.answer`;
const FINISH = `${RESOURCE}:entry.finish`;
const FAILED = `${RESOURCE}:entry.failed`;
const LANG = `${RESOURCE}:status.lang`;

/** How long the page has to say it drew. */
export const PAGE_WAIT_MS = 15_000;
/** How long the page keeps its goodbye (the fade) before it is taken down. */
export const LEAVE_MS = 700;
/** The most places a set of answers may carry. */
export const MAX_PICKS = 20;

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

export function installEntry(): void {
    let view = -1;
    let ready = false;
    let failed = false;
    let createdAt = 0;
    let ask: Record<string, unknown> | null = null;
    let leaving = false;

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
        ask = null;
        leaving = false;
    };

    const fail = (why: string): void => {
        console.log(`entry: ${why}`);
        failed = true;
        destroy();
        Events.emitServer(FAILED, JSON.stringify({ why: why.slice(0, 120) }));
    };

    const create = (): void => {
        const size = Web.getScreenSize();
        try {
            view = Web.createView(PAGE, { width: size.width, height: size.height, x: 0, y: 0, zIndex: 300, visible: false, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            fail(`a página não abriu (${thrown instanceof Error ? thrown.message : String(thrown)})`);
            return;
        }
        createdAt = Date.now();
        const id = view;
        Web.on(view, "entry:ready", () => {
            if (id !== view || ask === null) {
                return;
            }
            ready = true;
            scaleView(view);
            const size = Web.getScreenSize();
            Web.resizeView(view, size.width, size.height);
            Web.emit(view, "entry:open", ask);
            Web.showView(view);
            Web.focusView(view, true);
            Events.emitServer(SHOWN, "{}");
        });
        Web.on(view, "entry:start", () => {
            if (id === view) {
                Events.emitServer(START, "{}");
            }
        });
        Web.on(view, "entry:answer", (payload) => {
            if (id !== view) {
                return;
            }
            const picks = fieldsOf(payload)["picks"];
            if (Array.isArray(picks) && picks.length <= MAX_PICKS) {
                Events.emitServer(ANSWER, JSON.stringify({ picks: picks.map((pick) => (typeof pick === "number" && Number.isFinite(pick) ? pick : -1)) }));
            }
        });
        Web.on(view, "entry:finish", () => {
            if (id === view) {
                Events.emitServer(FINISH, "{}");
            }
        });
        Web.on(view, "entry:lang", (payload) => {
            const lang = fieldsOf(payload)["lang"];
            if (id === view && (lang === "pt" || lang === "en")) {
                Events.emitServer(LANG, JSON.stringify({ lang }));
            }
        });
    };

    Events.on(OPEN, (payload) => {
        if (view >= 0 || failed || leaving) {
            return;
        }
        ask = fieldsOf(payload);
        const me = LocalPlayer;
        if (me?.ready) {
            create();
        }
    });

    Events.on(QUESTIONS, (payload) => {
        if (view >= 0 && ready) {
            Web.emit(view, "entry:questions", fieldsOf(payload));
        }
    });

    Events.on(RESULT, (payload) => {
        if (view >= 0 && ready) {
            Web.emit(view, "entry:result", fieldsOf(payload));
        }
    });

    Events.on(CLOSE, () => {
        if (view < 0 || leaving) {
            destroy();
            failed = false;
            return;
        }
        leaving = true;
        Web.emit(view, "entry:close", {});
        setTimeout(() => {
            destroy();
            failed = false;
        }, LEAVE_MS);
    });

    const timer = setInterval(() => {
        try {
            if (view >= 0 && !ready && !failed && Date.now() - createdAt > PAGE_WAIT_MS) {
                fail("a página não respondeu");
            }
            // The server asks again after a failure; the next ask is answered anew.
            if (failed && view < 0) {
                failed = false;
            }
        } catch (thrown: unknown) {
            console.error(`entry: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }, 1_000);

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
