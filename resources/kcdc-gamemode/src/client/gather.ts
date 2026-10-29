/**
 * The Coletores' work, the client's half (server: `gather.ts`): aimed at a tree or a rock within reach, a Coletor sees "Cortar lenha" or
 * "Minerar" on E, beside the game's own prompt (there is none at a tree), and the press asks the server to start; while the work goes on the
 * hint says "Parar" and the press stops it (user, 2026-10-21 night: "apertar E e começar a animação de cortar lenha com machado nas mãos, ou
 * nas pedras de mineração começar a picareta"). Nothing is looked for when the player's guild has no such work: a ray from the crosshair
 * four times a second, as thirst's, only for them.
 *
 * The body is held still by the animation (the server plays it with `lockMovement`), so a walk cannot be seen in where it stands: W, A, S, D,
 * the arrows or Space, after a short grace for the keys still held from walking up to the tree, ask the server to stop (as a bed or a chair
 * asks to stand, `furniture.ts`; user, 2026-10-22: "se o jogador andar deve cortar a animação, senão ele fica preso na animação").
 */

import { furnitureBusy } from "./furniture.js";
import { getPersonInView } from "./interaction.js";
import { REACH_M } from "./reach.js";
import { mayGather } from "./trade-rights.js";

const RESOURCE = "kcdc-gamemode";
const START = `${RESOURCE}:gather.start`;
const STOP = `${RESOURCE}:gather.stop`;
const STATE = `${RESOURCE}:gather.state`;

/** E, the game's primary action, as the trades' own hints (`cook-hint.ts`). */
export const GATHER_KEY = "primary_action";

/** The keys that walk the body (a bed's or a chair's, `furniture.ts`), and how long a key still held from before the work is let be. */
export const MOVE_KEYS = ["w", "a", "s", "d", "space", "up", "down", "left", "right"];
export const GRACE_MS = 700;
const MOVE_CHECK_MS = 100;
const LOOK_MS = 250;
/** A press is not repeated within this. */
const PRESS_MS = 700;

const START_TEXT: Readonly<Record<"tree" | "rock", string>> = { tree: "Cortar lenha", rock: "Minerar" };
const STOP_TEXT: Readonly<Record<"tree" | "rock", string>> = { tree: "Parar de cortar", rock: "Parar de minerar" };

interface Aim {
    readonly k: "tree" | "rock";
    readonly m: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** The tree or rock under the crosshair, within reach of the body, that this player's guild may work; or null. */
export function aimedAt(me: Player): Aim | null {
    const ray = Camera.screenRay({ range: REACH_M + 4 });
    if (!ray) {
        return null;
    }
    const hit = World.raycast(ray.origin, ray.target, { mode: "anything", ignoreSelf: true });
    if (hit === null || (hit.category !== "tree" && hit.category !== "rock") || typeof hit.model !== "string" || hit.model === "" || !mayGather(hit.category)) {
        return null;
    }
    const p = me.position;
    if (Math.hypot(hit.position.x - p.x, hit.position.y - p.y) > REACH_M || Math.abs(hit.position.z - p.z) > 3.5) {
        return null;
    }
    return { k: hit.category, m: hit.model, x: round(hit.position.x), y: round(hit.position.y), z: round(hit.position.z) };
}

export function installGather(): void {
    let hint = 0;
    let hintText = "";
    let aim: Aim | null = null;
    let working: "tree" | "rock" | null = null;
    let workedAt = 0;
    let stopAsked = false;
    let pressedAt = 0;

    const remove = (): void => {
        if (hint) {
            ActionHint.remove(hint);
        }
        hint = 0;
        hintText = "";
    };
    const show = (text: string): void => {
        if (hint && hintText === text) {
            return;
        }
        remove();
        hint = ActionHint.create({ key: GATHER_KEY, text }, press);
        hintText = text;
    };
    function press(): void {
        const now = Date.now();
        if (now - pressedAt < PRESS_MS) {
            return;
        }
        pressedAt = now;
        if (working !== null) {
            Events.emitServer(STOP);
            return;
        }
        if (aim !== null) {
            Events.emitServer(START, JSON.stringify(aim));
        }
    }

    Events.on(STATE, (payload) => {
        let fields: unknown = payload;
        if (typeof payload === "string") {
            try {
                fields = JSON.parse(payload) as unknown;
            } catch {
                return;
            }
        }
        const state = typeof fields === "object" && fields !== null ? (fields as { on?: unknown; k?: unknown }) : {};
        working = state.on === true && (state.k === "tree" || state.k === "rock") ? state.k : null;
        workedAt = working === null ? 0 : Date.now();
        stopAsked = false;
    });

    const look = (): void => {
        const me = LocalPlayer;
        if (working !== null) {
            show(STOP_TEXT[working]);
            return;
        }
        if ((!mayGather("tree") && !mayGather("rock")) || !me?.ready || !me.alive || me.mounted || getPersonInView() || furnitureBusy() || Hud.isInDialogue() || !Controls.isEnabled()) {
            aim = null;
            remove();
            return;
        }
        aim = aimedAt(me);
        if (aim === null) {
            remove();
            return;
        }
        show(START_TEXT[aim.k]);
    };

    const walking = (): void => {
        if (working === null || stopAsked || Date.now() - workedAt < GRACE_MS) {
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
