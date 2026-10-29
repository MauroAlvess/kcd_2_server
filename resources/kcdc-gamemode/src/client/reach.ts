/**
 * One reach for every E and F prompt of ours (user, 2026-10-22: "a distância das interações do E e F que fizemos personalizada em tudo
 * devem ter o mesmo padrão de distância, exemplo 1 m a 2 m"): two metres, from the body to the nearest edge of what is interacted with --
 * a trunk, a door, a chest, a person, a chair, the water. Where the game gives one point for a big thing (a horse, a cart, a forge, a
 * hut) that point is `EDGE_M` of its edge, and the reach to the point is the standard plus that. The server (`src/server/reach.ts`)
 * allows a metre more than this, for the time a press takes and for a body that moved on.
 *
 * Measured from the BODY, not from the camera: in third person the camera is a few metres behind the player, and a reach read along its
 * ray was shorter there than in first person.
 */
export const REACH_M = 2;

/** How far each thing's reference point is from its edge, in metres. */
export const EDGE_M = {
    /** A point on the surface itself (where the crosshair's ray hit a trunk, a rock, a door, the water). */
    surface: 0,
    person: 0,
    door: 0.5,
    chest: 0.5,
    chair: 0.4,
    bed: 1,
    /** A garden's bed is measured to the nearest point of its row (`farm.ts`), the soil itself, a hand's breadth from the edge. */
    garden: 0.5,
    /** The hearth of a fire, a drying rack's frame, a smithery's anvil and hearth, an alchemy table, the hut of a smokehouse. */
    fire: 0.6,
    rack: 1.2,
    forge: 1.5,
    alchemy: 1.5,
    /** A grindstone (`repair.ts`): the point of the entity is its foot, the wheel is about a metre across. */
    grindstone: 0.8,
    hut: 2.5,
    /** A notice board (`mural-places.ts`): the point is the one in front of its face, a metre or so from the planks and the posts at the sides. */
    mural: 1.2,
    table: 1,
    /** A horse's point is its middle. It was 1.1 until 2026-10-26 ("a distância do cavalo vamos diminuir": the horse's menu took the E of a player standing beside it); a horse is nearer than that now. */
    horse: 0.6,
    /** A dog's point is its middle, about half a metre from its nose or its tail. */
    dog: 0.5,
    /** A cow's point is its middle, three quarters of a metre or so from its flank (`cows.ts`, the milking). */
    cow: 0.8,
    /** A cart is measured to the stretch down its middle (`carts.ts`), about a metre from either side. */
    cart: 1,
} as const;

/** The reach to a point that is `edgeM` from the edge of what it stands for. */
export function reachTo(edgeM: number = EDGE_M.surface): number {
    return REACH_M + edgeM;
}

/** How far the player's body is from a point, in metres, on the ground and up or down. */
export function bodyDistance(point: { readonly x: number; readonly y: number; readonly z: number }): { readonly flat: number; readonly up: number } | null {
    const me = LocalPlayer;
    if (!me?.ready) {
        return null;
    }
    const at = me.position;
    return { flat: Math.hypot(point.x - at.x, point.y - at.y), up: Math.abs(point.z - at.z) };
}
