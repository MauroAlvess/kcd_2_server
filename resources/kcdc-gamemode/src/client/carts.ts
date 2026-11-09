/**
 * "[E] Subir na carroça": the game's own interaction hint, up while the player stands beside a cart. The server says which, every second, in `cart.near`; and since 2026-11-02 it also
 * names the carts round the player (`around`, with how far each one's body runs behind its front axle), and this client measures itself against them where its own game sees them
 * (`Entity.position` and `rotation`): the server's sight of a cart that was driven could lag behind it, and the hint never came beside a cart that was there (user: "o Jaromir ... toda hora
 * que ele para precisa chamar a carroça pelo botão"). The press asks the server for the seats of the cart it was for (`src/server/carts.ts`), saying where this game sees it.
 */

import { EDGE_M, reachTo } from "./reach.js";

const RESOURCE = "kcdc-gamemode";
const TEXT = "Subir na carroça";

/** How near a cart's body the hint comes up: the one reach of our prompts (`reach.ts`). */
const NEAR_M = reachTo(EDGE_M.cart);
/** The body ahead of the front axle (the driver's bench), as the server measures it. */
const BODY_FRONT_M = 1.5;

/** The cart the player stands beside, as the server last said or as this game sees it, or 0. */
let near = 0;
/** The cart the server says, and the carts round the player it names: [id, how far the body runs behind the axle]. */
let serverNear = 0;
let around: ReadonlyArray<readonly [number, number]> = [];

/** How far a point is from a cart's body as this game sees the cart, on the ground plane; Infinity when it cannot be seen. */
function bodyDistance(id: number, back: number, at: { x: number; y: number; z: number }): number {
    try {
        const entity = new Entity(id);
        const place = entity.position;
        if (!Number.isFinite(place.x) || (place.x === 0 && place.y === 0) || Math.abs(place.z - at.z) > 5) {
            return Infinity;
        }
        const turn = entity.rotation as { x: number; y: number; z: number; w?: number };
        const radians = typeof turn.w === "number" ? Math.atan2(2 * (turn.w * turn.z + turn.x * turn.y), 1 - 2 * (turn.y * turn.y + turn.z * turn.z)) : (turn.z * Math.PI) / 180;
        const ax = -Math.sin(radians);
        const ay = Math.cos(radians);
        const dx = at.x - place.x;
        const dy = at.y - place.y;
        const along = Math.max(-back, Math.min(BODY_FRONT_M, dx * ax + dy * ay));
        return Math.hypot(dx - ax * along, dy - ay * along);
    } catch {
        return Infinity;
    }
}

/** The cart beside the player: the nearest of those round them as this game sees them, or the server's. */
function nearestCart(): number {
    const me = LocalPlayer;
    if (around.length === 0 || !me?.ready) {
        return serverNear;
    }
    let at: { x: number; y: number; z: number };
    try {
        const place = me.position;
        at = { x: place.x, y: place.y, z: place.z };
    } catch {
        return serverNear;
    }
    let best = serverNear;
    let bestAway = NEAR_M;
    for (const [id, back] of around) {
        const away = bodyDistance(id, back, at);
        if (away <= bestAway) {
            bestAway = away;
            best = id;
        }
    }
    return best;
}

/** Where this game sees a cart, for the server's log. */
function seenAt(id: number): { x?: number; y?: number } {
    try {
        const place = new Entity(id).position;
        return { x: Math.round(place.x * 10) / 10, y: Math.round(place.y * 10) / 10 };
    } catch {
        return {};
    }
}

/** Whether the player stands beside a cart: the E is then the cart's, and the talk hint stays down (`property-labels.ts`). */
export function cartIsNear(): boolean {
    return near > 0;
}

export function installCarts(): void {
    let hint = 0;
    /** Puts the hint up for the cart beside the player, or takes it down; `again` puts back a hint the game took down. */
    const show = (again: boolean): void => {
        const id = nearestCart();
        near = id;
        if (id > 0 && hint !== 0 && again && !ActionHint.setText(hint, TEXT)) {
            hint = 0;
        }
        if (id > 0 && hint === 0) {
            try {
                hint = ActionHint.create({ key: "primary_action", text: TEXT }, () => {
                    const cart = near;
                    Events.emitServer(`${RESOURCE}:cart.use`, cart > 0 ? { id: cart, ...seenAt(cart) } : {});
                });
            } catch {
                hint = 0;
            }
        } else if (id === 0 && hint !== 0) {
            ActionHint.remove(hint);
            hint = 0;
        }
    };
    Events.on(`${RESOURCE}:cart.near`, (payload) => {
        try {
            const value = (typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown; around?: unknown } | null;
            serverNear = value !== null && typeof value.id === "number" ? value.id : 0;
            around = value !== null && Array.isArray(value.around)
                ? value.around.filter((pair): pair is [number, number] => Array.isArray(pair) && typeof pair[0] === "number" && typeof pair[1] === "number").slice(0, 3)
                : [];
        } catch {
            return;
        }
        // The server says it again every few seconds: a hint the game took down meanwhile is put back.
        show(true);
    });
    // Between the server's words, this game's own sight of the carts round the player: a quarter of a second, and nothing at all with none round them.
    setInterval(() => {
        if (around.length > 0) {
            show(false);
        }
    }, 250);
}
