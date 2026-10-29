import { furnitureBusy } from "./furniture.js";
import { getPersonInView, isInteractionTargetVisible } from "./interaction.js";
import { EDGE_M, reachTo } from "./reach.js";

/**
 * The Agricultores' milking, the client's half (server: `src/server/cows.ts`, user, 2026-10-27: "o jogador da guilda dos agricultores pode extrair leite de vaca interagindo com
 * a vaca"). The server tells a farmer's client which cow is nearest and stands within reach (`cow.near`, with `r` 1 when it can be milked now: the same cow gives again
 * after half an hour), and the farm animals have no use of their own, so there is no prompt of the game's to hold back: while the aim is on that cow our hint "Ordenhar"
 * stands on E (the game's primary action, as the Coletores' `gather.ts`) and its press asks to milk. While the work goes on (`cow.state`) the hint says "Parar", and a step
 * (W, A, S, D, the arrows or Space, after a short grace for the keys still held from walking up) asks the server to stop: the animation holds the body still, and a player must
 * never be left in it (user, 2026-10-22: "se o jogador andar deve cortar a animação, senão ele fica preso na animação").
 */

const RESOURCE = "kcdc-gamemode";
const NEAR = `${RESOURCE}:cow.near`;
const STATE = `${RESOURCE}:cow.state`;
const MILK = `${RESOURCE}:cow.milk`;
const STOP = `${RESOURCE}:cow.stop`;

/** E, the game's primary action, as the trades' own hints (`cook-hint.ts`, `gather.ts`). */
export const COW_KEY = "primary_action";
export const HINT_TEXT = "Ordenhar";
export const STOP_TEXT = "Parar de ordenhar";

/** The keys that walk the body, and how long a key still held from before the work is let be. */
export const MOVE_KEYS = ["w", "a", "s", "d", "space", "up", "down", "left", "right"];
export const GRACE_MS = 700;
const MOVE_CHECK_MS = 100;
const LOOK_MS = 150;
/** A press is not repeated within this. */
const PRESS_MS = 1_000;

/** The game's screens over which E is theirs. */
export const SCREENS = ["ItemTransfer", "ItemSelection"];

function screenUp(): boolean {
    return SCREENS.some((name) => {
        try {
            return NativeUI.element(name, 0).visible;
        } catch {
            return false;
        }
    });
}

/** How the cow must be aimed at: a big thing, so a wide aim, at its flank about a man's waist above its point, and as near as our prompts reach (`reach.ts`). */
export const AIM = { maxDistance: reachTo(EDGE_M.cow), aimRadius: 1.2, height: 0.8 };

interface Target {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** Whether it can be milked now. */
    readonly ready: boolean;
}

export function installCowMilk(): void {
    let target: Target | null = null;
    let hint = 0;
    let hintText = "";
    let working = false;
    let workedAt = 0;
    let stopAsked = false;
    let pressedAt = 0;

    const remove = (): void => {
        try {
            if (hint !== 0) {
                ActionHint.remove(hint);
            }
        } catch {
            // The hint was gone with the page.
        }
        hint = 0;
        hintText = "";
    };
    const show = (text: string): void => {
        if (hint !== 0 && hintText === text) {
            return;
        }
        remove();
        try {
            hint = ActionHint.create({ key: COW_KEY, text }, press);
            hintText = text;
        } catch {
            hint = 0;
            hintText = "";
        }
    };
    const aiming = (): boolean => {
        const me = LocalPlayer;
        if (target === null || !me?.ready || !me.alive || me.mounted || Hud.isInDialogue() || screenUp() || furnitureBusy() || getPersonInView() !== 0 || !Controls.isEnabled()) {
            return false;
        }
        try {
            return isInteractionTargetVisible({ x: target.x, y: target.y, z: target.z }, AIM);
        } catch {
            return false;
        }
    };
    function press(): void {
        const now = Date.now();
        if (now - pressedAt < PRESS_MS) {
            return;
        }
        pressedAt = now;
        if (working) {
            Events.emitServer(STOP);
            return;
        }
        if (target !== null && target.ready && aiming()) {
            Events.emitServer(MILK, { id: target.id });
        }
    }

    Events.on(NEAR, (payload) => {
        try {
            const value = (typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown; x?: unknown; y?: unknown; z?: unknown; r?: unknown } | null;
            target = value && typeof value.id === "number" && value.id > 0 && [value.x, value.y, value.z].every(Number.isFinite)
                ? { id: value.id, x: value.x as number, y: value.y as number, z: value.z as number, ready: value.r === 1 }
                : null;
        } catch {
            target = null;
        }
    });
    Events.on(STATE, (payload) => {
        let on = false;
        try {
            const value = (typeof payload === "string" ? JSON.parse(payload) : payload) as { on?: unknown } | null;
            on = value?.on === true;
        } catch {
            on = false;
        }
        working = on;
        workedAt = on ? Date.now() : 0;
        stopAsked = false;
    });

    const look = (): void => {
        if (working) {
            show(STOP_TEXT);
            return;
        }
        if (target !== null && target.ready && aiming()) {
            show(HINT_TEXT);
        } else {
            remove();
        }
    };
    const walking = (): void => {
        if (!working || stopAsked || Date.now() - workedAt < GRACE_MS) {
            return;
        }
        try {
            if (MOVE_KEYS.some((key) => Key.isDown(key))) {
                stopAsked = true;
                Events.emitServer(STOP);
            }
        } catch {
            // A key the build does not know.
        }
    };

    const timer = setInterval(look, LOOK_MS);
    const mover = setInterval(walking, MOVE_CHECK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            clearInterval(mover);
            remove();
        }
    });
}
