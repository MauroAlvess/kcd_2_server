/**
 * What this player's guild lets their own game do (server: `guild-crafts.ts`, `crafts.rights`). Butchering a carcass is the hunters' (user,
 * 2026-10-21: "mesmo eu não sendo caçador o F de abater apareceu e permitiu eu abater, não era para isso poder ocorrer"): the server only hears
 * of a butchering once it is done, and spoils that carcass, so here the game's own `butcher` action (F, in its `interaction` map) is switched
 * off for anybody else and the knife never comes out. And whether this player's blows at trees and rocks are the Coletores' work
 * (`gather.ts`), so nothing is traced or sent for anybody else; and (2026-10-22) whether the gardens' beds (`farm.ts`) are theirs to work, an
 * Agricultor's.
 */

const RESOURCE = "kcdc-gamemode";
const RIGHTS = `${RESOURCE}:crafts.rights`;
const ASK = `${RESOURCE}:crafts.ask`;

/** The game's own action for butchering (`Libs/Config/defaultProfile.xml`, map `interaction`, on the key of `ui_keybinds_physical_attack`). */
export const BUTCHER_ACTION = "butcher";

let gather = { lenha: false, mina: false };
let butcherBlocked = false;
/** Whether this player works the gardens' beds: an Agricultor. Until the server says, they do not. */
let farm = false;

/** Whether this player's blows at a tree (`tree`) or a rock (`rock`) count for anything. */
export function mayGather(kind: "tree" | "rock"): boolean {
    return kind === "tree" ? gather.lenha : gather.mina;
}

export function mayFarm(): boolean {
    return farm;
}

function blockButcher(block: boolean): void {
    if (block === butcherBlocked) {
        return;
    }
    try {
        if (block) {
            Controls.disableAction(BUTCHER_ACTION);
        } else {
            Controls.enableAction(BUTCHER_ACTION);
        }
        butcherBlocked = block;
    } catch (error: unknown) {
        console.log(`trade-rights: a ação ${BUTCHER_ACTION} não pôde ser ${block ? "desligada" : "religada"}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function installTradeRights(): void {
    Events.on(RIGHTS, (payload) => {
        let fields: unknown = payload;
        if (typeof payload === "string") {
            try {
                fields = JSON.parse(payload) as unknown;
            } catch {
                return;
            }
        }
        if (typeof fields !== "object" || fields === null) {
            return;
        }
        const { abate, lenha, mina, horta } = fields as Record<string, unknown>;
        gather = { lenha: lenha === true, mina: mina === true };
        farm = horta === true;
        blockButcher(abate === false);
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            blockButcher(false);
        }
    });
    // The server tells it at every spawn; asked now as well, for a resource restarted with the player already in the world.
    Events.emitServer(ASK);
}
