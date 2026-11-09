/**
 * The picture above each notice board (user, 2026-11-09: "coloquei dentro de img uma imagem chamada quadro de aviso: ela deve ficar acima de cada quadro de aviso, não pode aparecer por trás de parede, não pode ter lag,
 * deve ficar perfeitamente acima dos quadros de avisos sem perder fps e carregar em uma distância boa"; it replaces the icons a page drew over the game, `trade-marks.ts`, which lagged behind the camera, showed through
 * walls and cost frames).
 *
 * It is an object of the game's own: a flat square mesh with the user's picture as its texture, shipped in this resource's `stream/` folder (`tools/make-board-sign.py` makes the files; the server sends them to every
 * player with the client scripts, `docs/guides/Core concepts/custom-assets.md`) and stood over each board as a prop (`Prop.spawn`, no physics). The engine draws it, so it is where it is put at every frame, a wall hides it as
 * it hides any object, it is one quad, and the game streams it in with the other props about it. It is double-sided (seen from behind it is the picture turned round), and it faces the way the board does, so that
 * whoever comes to read the board sees it from the front.
 *
 * Where each stands is worked out from the boards (`mural-places.ts`): over the middle of the board, which is a little behind the marker the boards are known by (`MARKER_FRONT_M`), with its bottom edge `gapM` above
 * the board's top. The boards are the user's, put where they chose in the World Builder; nothing here moves them.
 *
 * Unverified in game (nothing of this has been seen by a player): that the engine loads the mesh, the material and the split texture as the game's own, how the picture looks (its glow, `Emittance` of the material, at night
 * and in daylight), and from how far the game streams the prop in.
 */

import { MARKER_FRONT_M, muralBoards } from "./mural-places.js";
import type { Board } from "./mural-places.js";

const RESOURCE = "kcdc-gamemode";
/** The mesh `tools/make-board-sign.py` shipped: a square of one metre, standing up, its front toward +X. */
export const SIGN_MODEL = `objects/kcdc/${RESOURCE}/quadro_aviso.cgf`;

export const signSettings = {
    /** The side of the picture in metres: the prop's scale, the mesh being a metre square. */
    sizeM: 2.2,
    /** Between the top of the board and the bottom edge of the picture. */
    gapM: 0.3,
    /** From the ground in front of a board that has no known top to the bottom edge of the picture. */
    bareTopM: 2.4,
    /** The assets of a resource started with players in are built just after its scripts first run: the pictures are put up after this wait, and again after `retryMs` while the game refuses the model. */
    delayMs: 15_000,
    retryMs: 30_000,
    retries: 6,
};

export interface SignPose {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** The turn about the vertical, in degrees (Euler Z), as the prop is given it. */
    readonly yawDeg: number;
}

/** Where the picture of a board goes: over the middle of the board, turned as it is. */
export function signPose(board: Board): SignPose {
    const yaw = board.yaw ?? 0;
    const bottom = (board.top ?? board.z + signSettings.bareTopM) + signSettings.gapM;
    return {
        x: board.x - MARKER_FRONT_M * Math.cos(yaw),
        y: board.y - MARKER_FRONT_M * Math.sin(yaw),
        z: bottom + signSettings.sizeM / 2,
        yawDeg: (yaw * 180) / Math.PI,
    };
}

let signs: Prop[] = [];

/** Takes the pictures down. */
export function clearSigns(): number {
    const count = signs.length;
    for (const sign of signs) {
        try {
            sign.destroy();
        } catch {
            // Gone already.
        }
    }
    signs = [];
    return count;
}

/** Stands a picture over each board; returns how many went up and how many the game refused. */
export function placeSigns(boards: readonly Board[] = muralBoards()): { readonly placed: number; readonly refused: number } {
    clearSigns();
    let refused = 0;
    for (const board of boards) {
        const pose = signPose(board);
        try {
            signs.push(Prop.spawn(SIGN_MODEL, new Vector3(pose.x, pose.y, pose.z), new Vector3(0, 0, pose.yawDeg), signSettings.sizeM, "none"));
        } catch (error: unknown) {
            refused += 1;
            if (refused === 1) {
                console.log(`board-signs: o jogo não aceitou ${SIGN_MODEL} (${error instanceof Error ? error.message : String(error)})`);
            }
        }
    }
    return { placed: signs.length, refused };
}

export function installBoardSigns(): void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    const attempt = (): void => {
        timer = null;
        const boards = muralBoards();
        if (boards.length === 0) {
            console.log("board-signs: nenhum quadro de avisos conhecido: nenhuma figura posta");
            return;
        }
        const { placed, refused } = placeSigns(boards);
        console.log(`board-signs: ${placed} figura(s) de quadro de aviso posta(s) sobre ${boards.length} quadro(s)${refused > 0 ? `; ${refused} recusada(s)` : ""}`);
        tries += 1;
        if (refused > 0 && tries <= signSettings.retries) {
            timer = setTimeout(attempt, signSettings.retryMs);
        }
    };
    const start = (): void => {
        timer = setTimeout(attempt, signSettings.delayMs);
    };
    if (WorldResource.ready) {
        start();
    } else {
        Events.once("worldResourcesReady", start);
    }
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        if (timer !== null) {
            clearTimeout(timer);
        }
        clearSigns();
    });
}
