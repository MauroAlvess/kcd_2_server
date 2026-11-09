import { getPersonInView } from "./interaction.js";
import { isRestrained, setRestrained } from "./restraint.js";

/**
 * The client half of arrest and the pillory (`src/server/arrest.ts`; user, 2026-10-29: "o jogador fica com as mãos algemadas e não consegue fazer nada além de só andar, nem correr, nem abrir
 * nenhum menu além de Esc, e falar").
 *
 * - **Held.** When the server says `arrest.state` on, every game action of the lists below is held back (`Controls.disableAction`, counted: given back one for one), the game's own menus
 *   are shut (`NativeUI.setMenuEnabled`), and `restraint.ts` says so to the pages that open on a key of their own. What stays: the walk (the server holds the pace to it), the camera, the pause menu,
 *   the chat and the voice. The server drops the rest of what this client might send (`installRestraintGate`), so this is the player's own side of it, not the only one.
 * - **Officers.** `arrest.officer` tells an officer where the pillories are; near one, and not aiming at a person (who has the key for the talk list), E opens the pillory's page of the game's list
 *   (`arrest.pillory`), with a hint, "Pelourinho", the way the horse's menu has one.
 */

const RESOURCE = "kcdc-gamemode";
const STATE = `${RESOURCE}:arrest.state`;
const OFFICER = `${RESOURCE}:arrest.officer`;
const ASK = `${RESOURCE}:arrest.pillory`;

/** The game's actions held back from somebody in handcuffs, by the names of its own action maps (`defaultProfile.xml`): the pace, the use key and its kin, the blade and the bow, the quick slots. */
export const HELD_ACTIONS: readonly string[] = [
    "sprint", "toggle_run", "jump", "toggle_crouch", "grab_body",
    "use", "mount_horse", "companion_bond", "use_bed_sit", "use_bed_sleep", "use_other", "use_horse", "pickpocketing", "butcher", "talk", "trigger_use", "trigger_use_hold", "call", "custom_quest_call_horse_action", "kcdc_npc_interact",
    "prepare_to_attack", "attack_primary", "attack_primary_mouse", "block", "stealth_kill", "knock_out", "horse_pulldown", "mercy_kill", "opponent_lock", "attack_special", "bow_primary", "bow_secondary", "crossbow_prepare", "gun_prepare",
    "stealth_kill_attack", "stealth_kill_silent_attack", "combat_stealth_pick_up_body", "toggle_holster_qam_weapon", "toggle_holster_qam_weapon_2", "toggle_torch", "toggle_helmet",
    "open_qam_both", "open_qam_weapon", "open_qam_food", "activate_qam_weapon", "activate_qam_food", "consume_qam_food",
    "action_qam_1", "action_qam_2", "action_qam_3", "action_qam_4", "action_qam_5", "action_qam_6", "action_qam_7", "action_qam_8", "action_qam_5_hold", "action_qam_6_hold", "action_qam_7_hold", "action_qam_8_hold",
    "open_apse_inventory_keyboard", "open_apse_player", "open_apse_questlog", "open_apse_map_keyboard", "open_apse_codex", "open_apse_inventory_controller", "open_apse_map_controller", "open_skiptime",
    "kcdc_emote_wheel",
];

/**
 * The walk keys, taken away while the server says the body is held still (`still`, 2026-11-01): in the pillory, and in handcuffs while no officer leads (user: "pelourinho faz a
 * animação mas o jogador consegue sair andando"). The keyboard's and the pad's, by the game's own names (`Libs/Config/defaultProfile.xml`); the camera stays free.
 */
export const MOVE_ACTIONS: readonly string[] = ["moveforward", "moveback", "moveleft", "moveright", "xi_movex", "xi_movey"];

/** The game's own menus shut for the time (the pause menu is not among them). */
export const HELD_MENUS = ["inventory", "player", "map", "codex", "journal", "crafting"] as const;

/** How near a pillory (planar, metres) the hint shows, and how far above or below. */
export const POINT_REACH_M = 3;
const POINT_REACH_Z_M = 4;
const HINT_TEXT = "Pelourinho";

interface Point {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
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

/** The actions that were held, so that exactly those are given back. */
const heldActions: string[] = [];
const heldMenus: string[] = [];
const heldMoves: string[] = [];

/** Takes the walk keys away, once however often the server says it. */
function holdMoves(): void {
    if (heldMoves.length > 0) {
        return;
    }
    for (const action of MOVE_ACTIONS) {
        try {
            Controls.disableAction(action);
            heldMoves.push(action);
        } catch {
            // An action this build does not have.
        }
    }
}

function releaseMoves(): void {
    for (const action of heldMoves.splice(0)) {
        try {
            Controls.enableAction(action);
        } catch {
            // Given back with the resource.
        }
    }
}

function hold(): void {
    for (const action of HELD_ACTIONS) {
        try {
            Controls.disableAction(action);
            heldActions.push(action);
        } catch (thrown: unknown) {
            console.log(`arrest: a ação ${action} não pôde ser segurada: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }
    for (const menu of HELD_MENUS) {
        try {
            NativeUI.setMenuEnabled(menu, false);
            heldMenus.push(menu);
        } catch (thrown: unknown) {
            console.log(`arrest: o menu ${menu} não pôde ser fechado: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }
}

function release(): void {
    for (const action of heldActions.splice(0)) {
        try {
            Controls.enableAction(action);
        } catch {
            // Given back with the resource.
        }
    }
    for (const menu of heldMenus.splice(0)) {
        try {
            NativeUI.setMenuEnabled(menu as (typeof HELD_MENUS)[number], true);
        } catch {
            // Given back with the resource.
        }
    }
}

export function installArrest(): void {
    let points: Point[] = [];
    let hint = 0;
    let last = 0;

    Events.on(STATE, (payload) => {
        const fields = fieldsOf(payload);
        const on = fields !== null && fields["on"] === true;
        // Held still, or let walk (led by an officer, or free).
        if (on && fields !== null && fields["still"] === true) {
            holdMoves();
        } else {
            releaseMoves();
        }
        if (on === isRestrained()) {
            return;
        }
        setRestrained(on);
        if (on) {
            hold();
        } else {
            release();
        }
    });

    Events.on(OFFICER, (payload) => {
        const fields = fieldsOf(payload);
        const list = fields !== null && fields["on"] === true && Array.isArray(fields["points"]) ? (fields["points"] as unknown[]) : [];
        points = list.flatMap((entry): Point[] => {
            const one = fieldsOf(entry);
            return one !== null && typeof one["id"] === "string" && [one["x"], one["y"], one["z"]].every((n) => typeof n === "number" && Number.isFinite(n)) ? [{ id: one["id"], x: one["x"] as number, y: one["y"] as number, z: one["z"] as number }] : [];
        });
    });

    /** The pillory the player stands at, when they may use one and nothing else has the key. */
    const near = (): Point | null => {
        const me = LocalPlayer;
        if (points.length === 0 || isRestrained() || !me?.ready || !me.alive || me.mounted || Hud.isInDialogue() || !Controls.isEnabled() || getPersonInView() !== 0) {
            return null;
        }
        const here = me.position;
        return points.find((point) => Math.hypot(point.x - here.x, point.y - here.y) <= POINT_REACH_M && Math.abs(point.z - here.z) <= POINT_REACH_Z_M) ?? null;
    };

    setInterval(() => {
        try {
            const at = points.length === 0 ? null : near();
            if (at === null && hint !== 0) {
                ActionHint.remove(hint);
                hint = 0;
            } else if (at !== null && hint === 0) {
                hint = ActionHint.create({ key: "primary_action", text: HINT_TEXT }, () => undefined);
            }
        } catch {
            hint = 0;
        }
    }, 150);

    Key.bind("e", "down", () => {
        const now = Date.now();
        if (points.length === 0 || now - last < 1_500) {
            return;
        }
        const at = near();
        if (at !== null) {
            last = now;
            Events.emitServer(ASK, { id: at.id });
        }
    });
}
