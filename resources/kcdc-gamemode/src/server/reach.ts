/**
 * The reach of every E and F prompt of ours, the server's half (`src/client/reach.ts` is the other; user, 2026-10-22: "a distância das
 * interações do E e F que fizemos personalizada em tudo devem ter o mesmo padrão de distância, exemplo 1 m a 2 m"). The standard is two
 * metres from the body to the nearest edge of the thing, plus `EDGE_M` where the game gives one point for something big; what the
 * server ALLOWS is a metre more (`SLACK_M`): the client has decided with its own eyes, and the press, the network and a body that took a
 * step in the meantime must not make a prompt that was on the screen answer "longe demais".
 */
export const REACH_M = 2;

/** What a press may be further than the prompt allowed: the time it takes to arrive, and a step on from where it was seen. */
export const SLACK_M = 1;

/** How far each thing's reference point is from its edge, in metres (the same table as the client's). */
export const EDGE_M = {
    surface: 0,
    person: 0,
    door: 0.5,
    chest: 0.5,
    chair: 0.4,
    bed: 1,
    garden: 0.5,
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

/** What a prompt shows within: the standard to a point that is `edgeM` from the edge of its thing. */
export function reachTo(edgeM: number = EDGE_M.surface): number {
    return REACH_M + edgeM;
}

/** What the server accepts of a press at such a point. */
export function allowedTo(edgeM: number = EDGE_M.surface): number {
    return reachTo(edgeM) + SLACK_M;
}
