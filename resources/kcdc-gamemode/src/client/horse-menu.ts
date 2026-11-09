import { getPersonInView, isInteractionTargetVisible } from "./interaction.js";
import { EDGE_M, reachTo } from "./reach.js";

/**
 * E at a wild horse (the Domador's taming): the game's own climb is refused there, and our own E, heard at the same moment, asks the server for the taming menu (`src/server/horse-menu.ts`),
 * which knows which wild horse is near (`horse.near`). Only when the player aims at the horse, and nothing else has the key. A horse a player keeps has no menu of ours (2026-11-09): E at it
 * is the game's own "Montar".
 */

const NEAR = "kcdc-gamemode:horse.near";
const ASK = "kcdc-gamemode:horse.menu";

/** The game's screens over which E is theirs: the inventory's (E on an item there is not for a horse). */
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

/**
 * How the horse must be aimed at: the whole of its body, head and rump too (2026-10-19: "algum ângulo?"); and how near, the one reach of our
 * prompts (`reach.ts`) to the horse's middle. The aim was 2.1 m round that point until 2026-10-26, and a player standing beside the horse was
 * inside it ("quando estou perto do cavalo e uma pessoa ao apertar E só abre o menu do cavalo e não do jogador"): a horse is 1.5 m from its middle
 * to the head or the rump, and the person under the crosshair now comes first in any case (`getPersonInView`).
 */
const AIM = { maxDistance: reachTo(EDGE_M.horse), aimRadius: 1.5, height: 1 };

/**
 * The game's own climb, kept from starting while the player aims at a wild horse they may tame, so that E opens the taming menu and nothing else. Held back, the game's "[E] Montar" on the right
 * goes with it, so our own hint stands in its place while the aim is on the horse.
 */
const CLIMB_ACTIONS = ["mount_horse", "use_horse"];

/** What our hint says at a wild horse, which only a Domador is told of (2026-10-22, the Agricultores' until 2026-10-25). */
export const WILD_HINT_TEXT = "Domar";

export function installHorseMenu(): void {
    let target: { id: number; x: number; y: number; z: number } | null = null;
    let hint = 0;
    /** The hint is shown while the aim is on the horse; the key itself is ours (`Key.bind` below), so the hint's own press does nothing. */
    const showHint = (on: boolean): void => {
        try {
            if (hint !== 0 && !on) {
                ActionHint.remove(hint);
                hint = 0;
            }
            if (on && hint === 0) {
                hint = ActionHint.create({ key: "primary_action", text: WILD_HINT_TEXT }, () => undefined);
            }
        } catch {
            hint = 0;
        }
    };
    let last = 0;
    let held = false;
    let broken = false;
    const hold = (on: boolean): void => {
        if (on === held || broken) {
            return;
        }
        try {
            for (const action of CLIMB_ACTIONS) {
                if (on) {
                    Controls.disableAction(action);
                } else {
                    Controls.enableAction(action);
                }
            }
            held = on;
        } catch (thrown: unknown) {
            broken = true;
            console.error(`horse menu: the climb could not be held back: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    };
    const aiming = (): boolean => {
        const me = LocalPlayer;
        if (target === null || !me?.ready || !me.alive || me.mounted || Hud.isInDialogue() || screenUp() || getPersonInView() !== 0) {
            return false;
        }
        try {
            return isInteractionTargetVisible({ x: target.x, y: target.y, z: target.z }, AIM);
        } catch {
            return false;
        }
    };
    setInterval(() => {
        const on = aiming();
        hold(on);
        showHint(on);
    }, 120);
    Events.on(NEAR, (payload) => {
        try {
            const value = (typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown; x?: unknown; y?: unknown; z?: unknown; w?: unknown } | null;
            // Only a wild horse is ours to hold the climb at: the server tells of no other, and a word that says otherwise is not believed.
            target = value && value.w === 1 && typeof value.id === "number" && value.id > 0 && [value.x, value.y, value.z].every(Number.isFinite) ? { id: value.id, x: value.x as number, y: value.y as number, z: value.z as number } : null;
        } catch {
            target = null;
        }
    });
    Key.bind("e", "down", () => {
        const me = LocalPlayer;
        const now = Date.now();
        if (target === null || !me?.ready || !me.alive || me.mounted || now - last < 1_500 || Hud.isInDialogue() || !Controls.isEnabled() || screenUp() || getPersonInView() !== 0) return;
        if (!isInteractionTargetVisible({ x: target.x, y: target.y, z: target.z }, AIM)) return;
        last = now;
        Events.emitServer(ASK, { id: target.id });
    });
}
