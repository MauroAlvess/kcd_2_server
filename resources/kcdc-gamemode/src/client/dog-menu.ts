import { getPersonInView, isInteractionTargetVisible } from "./interaction.js";
import { EDGE_M, reachTo } from "./reach.js";

/**
 * E at the player's dog (user, 2026-10-26): the server tells this client which dog is the player's and stands within reach
 * (`src/server/dog-menu.ts`, `dog.near`), and our own E, while the aim is on that dog, asks the server for the menu (Fazer carinho, Mandar
 * ficar or Mandar seguir, Sair). The horse's menu (`horse-menu.ts`) is the pattern: the key is ours (`Key.bind`), our hint stands in the place of
 * the game's and the game's own prompts at a dog are held back for as long as the aim is on it, so that one press never does two things.
 */

const NEAR = "kcdc-gamemode:dog.near";
const ASK = "kcdc-gamemode:dog.menu";

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

/** How the dog must be aimed at: a small thing, so a narrow aim (a chair's is 0.55), at its back a hand's breadth above the ground, and as near as our prompts reach (`reach.ts`). */
const AIM = { maxDistance: reachTo(EDGE_M.dog), aimRadius: 0.9, height: 0.4 };

/**
 * What the game does at a companion dog on its own: "Falar" (its `use`) and the bond (`companion_bond`). Held back while the aim is on the dog,
 * the game's prompt on the right goes with them and our own hint stands in its place.
 */
export const NATIVE_ACTIONS = ["use", "companion_bond"];

/** What our hint says: the menu that E opens. */
export const HINT_TEXT = "Cão";

export function installDogMenu(): void {
    let target: { id: number; x: number; y: number; z: number } | null = null;
    let hint = 0;
    /** The hint is shown while the aim is on the dog; the key itself is ours (`Key.bind` below), so the hint's own press does nothing. */
    const showHint = (on: boolean): void => {
        try {
            if (hint !== 0 && !on) {
                ActionHint.remove(hint);
                hint = 0;
            }
            if (on && hint === 0) {
                hint = ActionHint.create({ key: "primary_action", text: HINT_TEXT }, () => undefined);
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
        const taken: string[] = [];
        try {
            for (const action of NATIVE_ACTIONS) {
                if (on) {
                    Controls.disableAction(action);
                    taken.push(action);
                } else {
                    Controls.enableAction(action);
                }
            }
            held = on;
        } catch (thrown: unknown) {
            broken = true;
            // One of them refused: what was held before it is given back, or the game's E would stay dead for good.
            for (const action of taken) {
                try {
                    Controls.enableAction(action);
                } catch {
                    // Gone with the page.
                }
            }
            console.error(`dog menu: the game's prompts at a dog could not be held back: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
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
            const value = (typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown; x?: unknown; y?: unknown; z?: unknown } | null;
            target = value && typeof value.id === "number" && value.id > 0 && [value.x, value.y, value.z].every(Number.isFinite) ? { id: value.id, x: value.x as number, y: value.y as number, z: value.z as number } : null;
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
