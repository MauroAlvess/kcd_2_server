import { onLarge } from "./big-events.js";
import { scaleView } from "./ui-scale.js";
import { hideIcons, iconsUp, onIcons, showIcons } from "./craft-icons.js";
import type { IconSlot } from "./craft-icons.js";

/**
 * The trades' page (`ui/craft.html`; the server's side is `src/server/craft-menu.ts`): put up when the server sends a trade's
 * recipes (`craft.view`), and given the results of the work (`craft.progress`, `craft.result`). The page asks for the work
 * (`craft:make`), stops it (`craft:cancel`), changes its tab (`craft:mode`) and closes (`craft:close`, its button or Esc); where its item slots are goes to the
 * icons (`craft-icons.ts`). The page covers the screen, draws itself on the right, and has the keyboard and mouse while it is up.
 *
 * The same page shows a trade between two players (`src/server/trade.ts`, since 2026-10-18): `trade.view` puts it up with both
 * offers, `trade.hide` puts it away while the player fills their offer on the game's transfer screen, `trade.end` closes it; its
 * buttons go back as `trade.items`, `trade.accept` and `trade.cancel`.
 */

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/craft.html`;

function parse(payload: unknown): Record<string, unknown> | null {
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

function slotsOf(value: unknown): IconSlot[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((slot): slot is IconSlot => typeof slot === "object" && slot !== null && typeof slot.icon === "string" && [slot.x, slot.y, slot.w, slot.h].every(Number.isFinite))
        .slice(0, 64)
        .map((slot) => (typeof slot.bg === "number" && Number.isInteger(slot.bg) && slot.bg >= 0 && slot.bg <= 0xffffff ? slot : { icon: slot.icon, x: slot.x, y: slot.y, w: slot.w, h: slot.h }));
}

export function installCraftPage(): void {
    let view = -1;
    let ready = false;
    let shown = false;
    const queue: Array<[string, unknown]> = [];

    const toPage = (channel: string, payload: unknown): void => {
        if (view >= 0 && ready) {
            Web.emit(view, channel, payload);
        } else {
            queue.push([channel, payload]);
        }
    };

    const reveal = (): void => {
        if (view < 0 || shown) {
            return;
        }
        shown = true;
        Web.showView(view);
        Web.focusView(view, true);
        Web.emit(view, "craft:icons", { on: iconsUp() });
    };

    /** Puts the page away; `tell` says so to the server (a trade's page is put away by the server's own word). */
    const close = (tell = true): void => {
        if (view >= 0 && shown) {
            Web.focusView(view, false);
            Web.hideView(view);
        }
        shown = false;
        hideIcons();
        if (tell) {
            Events.emitServer(`${RESOURCE}:craft.closed`);
        }
    };

    const create = (): boolean => {
        const { width, height } = Web.getScreenSize();
        try {
            view = Web.createView(PAGE, { width, height, x: 0, y: 0, zIndex: 95, visible: false, focus: false });
        } catch (thrown: unknown) {
            console.error(`craft page: could not be made: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
            view = -1;
            return false;
        }
        ready = false;
        const id = view;
        Web.on(view, "craft:ready", () => {
            if (id !== view) {
                return;
            }
            ready = true;
            scaleView(view);
            for (const [channel, payload] of queue.splice(0)) {
                Web.emit(view, channel, payload);
            }
            reveal();
        });
        Web.on(view, "craft:make", (payload) => {
            const fields = parse(payload);
            const id2 = fields?.["id"];
            const many = fields?.["n"];
            if (id === view && typeof id2 === "string") {
                // How many at once, from one to ten (2026-10-27): the server holds it to that again.
                Events.emitServer(`${RESOURCE}:craft.make`, JSON.stringify(typeof many === "number" && Number.isFinite(many) ? { id: id2, n: many } : { id: id2 }));
            }
        });
        Web.on(view, "craft:cancel", () => {
            if (id === view) {
                Events.emitServer(`${RESOURCE}:craft.cancel`);
            }
        });
        // The tabs of the forge's and the sewing page: "fabricar" (the recipes) or "extrair" (the pieces to break apart, 2026-10-27).
        Web.on(view, "craft:mode", (payload) => {
            const mode = parse(payload)?.["mode"];
            if (id === view && (mode === "fabricar" || mode === "extrair")) {
                Events.emitServer(`${RESOURCE}:craft.mode`, JSON.stringify({ mode }));
            }
        });
        Web.on(view, "craft:close", () => {
            if (id === view) {
                close();
            }
        });
        for (const action of ["items", "accept", "cancel"]) {
            Web.on(view, `trade:${action}`, () => {
                if (id === view) {
                    Events.emitServer(`${RESOURCE}:trade.${action}`, "{}");
                }
            });
        }
        Web.on(view, "craft:slots", (payload) => {
            if (id === view && shown) {
                showIcons(slotsOf(parse(payload)?.["slots"]));
            }
        });
        return true;
    };

    onIcons((on) => {
        if (view >= 0 && ready && shown) {
            Web.emit(view, "craft:icons", { on });
        }
    });

    onLarge("craft.view", (payload) => {
        const data = parse(payload);
        if (data === null) {
            return;
        }
        if (view < 0 && !create()) {
            return;
        }
        toPage("craft:view", data);
        if (ready) {
            reveal();
        }
    });
    onLarge("trade.view", (payload) => {
        const data = parse(payload);
        if (data === null) {
            return;
        }
        if (view < 0 && !create()) {
            return;
        }
        toPage("trade:view", data);
        if (ready) {
            reveal();
        }
    });
    Events.on(`${RESOURCE}:trade.hide`, () => close(false));
    Events.on(`${RESOURCE}:trade.end`, () => {
        toPage("trade:end", {});
        close(false);
    });
    Events.on(`${RESOURCE}:craft.result`, (payload) => toPage("craft:result", parse(payload) ?? {}));
    Events.on(`${RESOURCE}:craft.progress`, (payload) => toPage("craft:progress", parse(payload) ?? {}));

    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            hideIcons();
        }
    });
}
