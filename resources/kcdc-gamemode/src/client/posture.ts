/**
 * How the local player's body is held -- up, sitting or lying -- for the tiredness bar (`src/server/fatigue.ts`): the
 * stance tag this machine's animation system picked, and whether the game has the body asleep. Sent when it changes,
 * and every few seconds so the server knows it is still true.
 */

const RESOURCE = "kcdc-gamemode";
const LOOK_EVERY_MS = 1_000;
const SAY_AGAIN_MS = 5_000;

export function installPosture(): void {
    let lastTag = -1;
    let lastAsleep = false;
    let saidAt = 0;
    const timer = setInterval(() => {
        const me = LocalPlayer;
        if (me === null || !me.ready) {
            return;
        }
        const tag = me.stanceTag;
        const asleep = me.sleeping > 0;
        const now = Date.now();
        if (tag !== lastTag || asleep !== lastAsleep || now - saidAt >= SAY_AGAIN_MS) {
            lastTag = tag;
            lastAsleep = asleep;
            saidAt = now;
            Events.emitServer(`${RESOURCE}:posture`, JSON.stringify({ tag, asleep: asleep ? 1 : 0 }));
        }
    }, LOOK_EVERY_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
