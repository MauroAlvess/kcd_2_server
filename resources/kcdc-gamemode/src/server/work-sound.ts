/**
 * Who is at a loud work of the trades, told to every client so that each keeps the sound of it to the players near (user, 2026-10-23: "o
 * barulho de cortar madeira e minerar só pode dar para escutar em quem estiver perto").
 *
 * The woodcutter's and the stonemason's animations (`gather.ts`) and the farmer's digging (`farm.ts`) are played on the worker's body on
 * every client, and each fires the game's own foley (`event:/foleys/professions/...`): the axe in the log, the pick in the stone, the
 * shovel in the soil. Those are the NPC craftsmen's sounds, which the game lets carry 30 m (the axe and the pick) and 20 m (the shovel):
 * a village square's worth, a lot for a player cutting wood in a corner of it. The server cannot say who hears an animation, so it says who
 * is working at what, and each machine stops those triggers on the bodies of the workers further than `HEAR_M` (`client/work-quiet.ts`,
 * as `client/dice-quiet.ts` does for the dice).
 */

const RESOURCE = "kcdc-gamemode";
export const WORK_SOUNDS_EVENT = `${RESOURCE}:work.sounds`;

/** What is being done: felling, mining, digging and picking in a garden. */
export type WorkKind = "lenha" | "mina" | "horta";

/** The list is said again this often while somebody works, so a machine that came in later, or missed one, has it. */
export const REPEAT_MS = 4_000;

const working = new Map<number, WorkKind>();

/**
 * Every begin and every end is said to every player in the world, so that each machine keeps the sound to the players near: with a crowd of woodcutters and
 * diggers that was hundreds of packets for each swing (2026-10-27, when the server was asked to be ready for two hundred). The list is said at most this often;
 * what comes inside the window is said once, when it ends, and the first one of a quiet spell is still at once.
 */
export const COALESCE_MS = 250;
let lastTold = Number.NEGATIVE_INFINITY;
let waiting = false;

/** Who is at work now, as `[network id, kind]`: those gone from the world, or dead, are dropped. */
export function workersNow(): Array<[number, WorkKind]> {
    const list: Array<[number, WorkKind]> = [];
    for (const [id, kind] of [...working]) {
        const player = Player.getById(id);
        if (player === null || !player.ready || !player.alive) {
            working.delete(id);
            continue;
        }
        list.push([id, kind]);
    }
    return list;
}

function tell(only?: Player): void {
    const text = JSON.stringify({ w: workersNow() });
    if (only === undefined) {
        lastTold = Date.now();
    }
    const to = only === undefined ? Player.all() : [only];
    for (const player of to) {
        if (!player.ready) {
            continue;
        }
        try {
            player.emit(WORK_SOUNDS_EVENT, text);
        } catch {
            // Gone already.
        }
    }
}

/** The list said to everybody now, or at the end of the window if one was said a moment ago. */
function tellSoon(): void {
    const since = Date.now() - lastTold;
    if (since >= COALESCE_MS) {
        tell();
        return;
    }
    if (!waiting) {
        waiting = true;
        setTimeout(() => {
            waiting = false;
            tell();
        }, COALESCE_MS - since);
    }
}

export function workBegins(player: Player, kind: WorkKind): void {
    working.set(player.id, kind);
    tellSoon();
}

export function workEnds(player: Player): void {
    if (working.delete(player.id)) {
        tellSoon();
    }
}

export function installWorkSound(): void {
    const timer = setInterval(() => {
        if (working.size > 0) {
            tell();
        }
    }, REPEAT_MS);
    // A player who comes in while others work learns at once who they are.
    Events.on("playerReady", (player) => {
        if (working.size > 0) {
            tell(player);
        }
    });
    Events.on("playerDisconnect", (player) => {
        workEnds(player);
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            working.clear();
        }
    });
}
