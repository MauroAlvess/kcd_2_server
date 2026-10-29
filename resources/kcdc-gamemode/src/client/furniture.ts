/**
 * The client's half of sitting and lying on a World Builder piece (`src/server/furniture.ts`). The server puts the body on the
 * seat (the game's own spawn: setting this machine's `LocalPlayer.position` did not hold, the game took the body back to where
 * the player had stood, 2026-10-20), so this side waits for the body to be there and says so (`furniture.posed`; or
 * `furniture.failed` after a few seconds), and the server plays the game's sitting or lying animation. If the game moves the body
 * off the seat as the animation begins, the server is asked to put it back (`furniture.drift`). While it lasts a "Levantar" hint
 * is up on the interaction key, and W, A, S, D, the arrows or Space (after a short grace, for the keys still held from walking
 * up) ask to stand (`furniture.stand`).
 */

const RESOURCE = "kcdc-gamemode";
const MOVE_KEYS = ["w", "a", "s", "d", "space", "up", "down", "left", "right"];
const GRACE_MS = 800;
const PLACING_MAX_MS = 4_000;
/**
 * How near the seat the body must be, on the ground; how long it is waited for and how often it is looked at; and when, after the
 * animation began, it is looked at again to see whether the game moved it.
 */
export const KEEP = { nearM: 0.4, waitMs: 2_800, stepMs: 50, settleMs: 150, afterMs: [250, 700, 1_500] };

let on = false;
let placingUntil = 0;
/** Where the body was told to be, for as long as it sits or lies. */
let pose: { x: number; y: number; z: number; heading: number } | null = null;

/** Whether this body is on a seat or a bed, or being put on one: the other hints on the interaction key give way. */
export function furnitureBusy(): boolean {
    return on || Date.now() < placingUntil;
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    try {
        const value = typeof payload === "string" && payload.length <= 400 ? (JSON.parse(payload) as unknown) : payload;
        return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** How far the body is from where it was told to be, on the ground. */
function away(target: { x: number; y: number }): number {
    const at = LocalPlayer?.position;
    return at ? Math.hypot(at.x - target.x, at.y - target.y) : Infinity;
}

export function installFurniture(): void {
    let hint = 0;
    let onAt = 0;
    let asked = false;
    const removeHint = (): void => {
        if (hint) ActionHint.remove(hint);
        hint = 0;
    };
    const stand = (): void => {
        if (asked) return;
        asked = true;
        Events.emitServer(`${RESOURCE}:furniture.stand`, {});
    };
    Events.on(`${RESOURCE}:furniture.pose`, (payload) => {
        const f = fieldsOf(payload);
        const { x, y, z, heading } = f;
        if (!LocalPlayer?.ready || typeof x !== "number" || typeof y !== "number" || typeof z !== "number" || typeof heading !== "number") return;
        const target = { x, y, z, heading };
        pose = target;
        placingUntil = Date.now() + PLACING_MAX_MS;
        console.log(`furniture: o servidor põe o corpo em ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} virado a ${heading.toFixed(0)} graus (${String(f["kind"])}); agora a ${away(target).toFixed(2)} m`);
        const started = Date.now();
        let near = 0;
        const check = (): void => {
            if (pose !== target) return;
            const waited = Date.now() - started;
            if (away(target) <= KEEP.nearM) {
                // There, and still there a moment later: the server may play the animation.
                near = near === 0 ? Date.now() : near;
                if (Date.now() - near >= KEEP.settleMs) {
                    console.log(`furniture: o corpo chegou ao assento em ${(waited / 1000).toFixed(2)} s`);
                    Events.emitServer(`${RESOURCE}:furniture.posed`, {});
                    return;
                }
            } else {
                near = 0;
            }
            if (waited >= KEEP.waitMs) {
                console.log(`furniture: o corpo ficou a ${away(target).toFixed(2)} m do assento; desisto`);
                placingUntil = 0;
                pose = null;
                Events.emitServer(`${RESOURCE}:furniture.failed`, {});
                return;
            }
            setTimeout(check, KEEP.stepMs);
        };
        setTimeout(check, KEEP.stepMs);
    });
    Events.on(`${RESOURCE}:furniture.state`, (payload) => {
        const f = fieldsOf(payload);
        placingUntil = 0;
        if (f["on"] === true) {
            on = true;
            asked = false;
            onAt = Date.now();
            removeHint();
            hint = ActionHint.create({ key: "primary_action", text: "Levantar" }, stand);
            const me = LocalPlayer;
            if (me) console.log(`furniture: no ${String(f["kind"])}, postura ${me.stanceTag}, em ${me.position.x.toFixed(2)}, ${me.position.y.toFixed(2)}, ${me.position.z.toFixed(2)}`);
            // The animation's start may take the body off the seat: the server is asked to put it back.
            const target = pose;
            for (const ms of KEEP.afterMs) {
                setTimeout(() => {
                    if (!on || target === null || pose !== target) return;
                    const off = away(target);
                    if (off > KEEP.nearM) {
                        console.log(`furniture: o corpo saiu ${off.toFixed(2)} m do assento; peço de novo ao servidor`);
                        Events.emitServer(`${RESOURCE}:furniture.drift`, {});
                    }
                }, ms);
            }
        } else {
            on = false;
            asked = false;
            pose = null;
            removeHint();
        }
    });
    const timer = setInterval(() => {
        if (!on || asked || Date.now() - onAt < GRACE_MS) return;
        try {
            if (MOVE_KEYS.some((key) => Key.isDown(key))) stand();
        } catch {
            // A key the build does not know.
        }
    }, 100);
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) return;
        clearInterval(timer);
        removeHint();
        on = false;
        pose = null;
    });
}
