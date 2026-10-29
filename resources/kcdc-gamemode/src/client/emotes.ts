/**
 * The gestures on G, chosen with a click (user, 2026-10-19: "a roda de emote do G, ao invés de segurar ela e mover o mouse e soltar
 * para ativar, vamos colocar para ter que clicar, e vamos melhorar a interface para ficar no nosso padrão"). The framework's own
 * wheel (the action `kcdc_emote_wheel`) is held off; G opens a page of ours (`ui/emotes.html`), a real wheel of twelve gestures (the
 * game's six and six of ours; 2026-10-20: "uma roda de emotes e não quadrado ... mais emotes"), a click plays one (the server plays it
 * on the body, for everybody: `src/server/emotes.ts`), and G, Esc or a click outside the wheel closes it. The page is shown only
 * while it is open, so it paints nothing the rest of the time. Not while sitting or lying (`furniture.ts`).
 *
 * 2026-10-26 ("mais emotes, exemplo usar lampião ou levantar estandarte"): the wheel has groups now (Saudações, Emoções, Rosto, Humor, Festa, Fé,
 * Objetos), each opening its own ring, and a "Parar". Which gestures it offers is the server's to say, body by body (a gesture the game has for a
 * man only is not offered to a woman): every time the wheel opens it asks (`emote.list`), keeps the answer, and hands it to the page, which draws
 * everything until it comes.
 */

import { isRestrained } from "./restraint.js";
import { furnitureBusy } from "./furniture.js";

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/emotes.html`;
const WHEEL_ACTION = "kcdc_emote_wheel";
const LIST = `${RESOURCE}:emote.list`;

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

export function installEmotes(): void {
    let view = -1;
    let open = false;
    let held = false;
    let openedAt = 0;
    /** The page has run its script (it says `emotes:ready`), so what is sent to it is heard. */
    let pageReady = false;
    /** The numbers of the gestures the server last said this player may pick; null until it has said. */
    let ids: number[] | null = null;

    const handList = (): void => {
        if (view >= 0 && pageReady && ids !== null) {
            Web.emit(view, "emotes:list", { ids });
        }
    };

    try {
        Controls.disableAction(WHEEL_ACTION);
        held = true;
    } catch (thrown: unknown) {
        // A build without that action: the framework's wheel stays, ours is not offered on the same key.
        console.error(`emotes: the framework's wheel could not be held off: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }

    const close = (): void => {
        if (!open || view < 0) {
            return;
        }
        open = false;
        Web.focusView(view, false);
        Web.hideView(view);
    };

    const create = (): boolean => {
        pageReady = false;
        const size = Web.getScreenSize();
        try {
            view = Web.createView(PAGE, { width: size.width, height: size.height, x: 0, y: 0, zIndex: 85, visible: false, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            console.error(`emotes: the page could not be made: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
            return false;
        }
        const id = view;
        Web.on(view, "emotes:ready", () => {
            if (id === view) {
                pageReady = true;
                handList();
            }
        });
        Web.on(view, "emotes:play", (payload) => {
            if (id !== view) {
                return;
            }
            const gesture = fieldsOf(payload)["id"];
            if (typeof gesture === "number" && Number.isInteger(gesture)) {
                Events.emitServer(`${RESOURCE}:emote.play`, JSON.stringify({ id: gesture }));
            }
            close();
        });
        Web.on(view, "emotes:close", () => {
            // The same G that opened it, heard by the page as it came up, does not close it.
            if (id === view && Date.now() - openedAt > 250) {
                close();
            }
        });
        return true;
    };

    const show = (): void => {
        const me = LocalPlayer;
        if (!held || open || !me?.ready || !me.alive || Hud.isInDialogue() || !Controls.isEnabled() || furnitureBusy()) {
            return;
        }
        if (view < 0 && !create()) {
            return;
        }
        const size = Web.getScreenSize();
        Web.resizeView(view, size.width, size.height);
        open = true;
        openedAt = Date.now();
        Web.showView(view);
        Web.focusView(view, true);
        // It opens on its groups, with what the server said last, and asks again (a woman's body and a man's are offered different gestures).
        if (pageReady) {
            Web.emit(view, "emotes:open", {});
            handList();
        }
        Events.emitServer(LIST, "{}");
    };

    Key.bind("g", "down", () => {
        // Held in handcuffs or in the pillory: no wheel (arrest.ts); one that was up when the cuffs went on can still be put away.
        if (isRestrained() && !open) {
            return;
        }
        if (open) {
            close();
        } else {
            show();
        }
    });

    Events.on(LIST, (payload) => {
        const list = fieldsOf(payload)["ids"];
        if (Array.isArray(list)) {
            ids = list.filter((value): value is number => typeof value === "number" && Number.isInteger(value));
            handList();
        }
    });

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        if (view >= 0) {
            try {
                Web.destroyView(view);
            } catch {
                // Gone already.
            }
            view = -1;
        }
        if (held) {
            try {
                Controls.enableAction(WHEEL_ACTION);
            } catch {
                // The framework takes its holds back with the resource anyway.
            }
        }
    });
}
