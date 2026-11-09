/**
 * Fast travel by coach (user, 2026-10-19: "vamos colocar os NPC de viagem rápida fixos nos locais, junto à carroça ou cavalo deles; ao
 * interagir com o NPC ele abre as opções de viagem rápida ao local em troca de dinheiro, quanto mais longe mais caro, e de noite o NPC
 * vai para uma casa dormir").
 *
 * - **A stop** in each village of the roleplay: a coachman (a townsfolk post, `townsfolk.ts`) beside his wagon, the game's own with its
 *   horses in the shafts (`Cart.spawn`). The wagon is the service's: nobody gets on it or registers it (`carts.ts`, `reservedCarts`).
 * - **Where**: by the road that leaves the village, OUTSIDE it, off the road and along it (user, 2026-10-20: the first versions put the
 *   wagons in the squares, across the streets, on a horse trough in a plowed field, among the tents of a camp, on a wall). The server has
 *   no world of its own, so the first time a player comes near a stop their client reads the ground round the road point of the stop
 *   (`World.resolveGround`: the surface of each point says road, grass, field, water, and what stands on it says tree, wall, trough), and the
 *   wagon goes on bare grass beside the road, clear of everything, facing along the road away from the village, with the coachman on the
 *   road's side of it (`roadsideSpots`). What was found is kept in `playerdata/travel.json`; an administrator moves it with `/viagem aqui`
 *   and the like, or has it read again with `/viagem procurar`.
 * - **E on the coachman**: the game's choice list with every other stop and its price, then a yes. The price is `base + perKm × km` in
 *   coins, by the straight line between the stops (`/viagem preco`).
 * - **The trip**: the money goes, the traveller's screen goes dark (`travel.fade`, `src/client/screen.ts`), they are put beside the wagon
 *   of the other stop (`player.spawn`, which holds the body until the ground there has streamed in) and the screen comes back. Nobody on a
 *   horse, in a cart, carrying somebody or something, in a fight, a trade or a dice game travels, nor with a restart on its way.
 * - **At night** the coachman walks to the nearest house and goes in to sleep (`installPostLife`), and comes back in the morning. With no
 *   house near he stays, but nobody travels by night either.
 */

import { cartOf, reservedCarts } from "./carts.js";
import { diceLobby } from "./dice.js";
import { coins, giveMoney, moneyOf, MONEY_UNIT, takeMoney } from "./money.js";
import { yawOf } from "./position.js";
import { restartPending } from "./restart-notice.js";
import { ensureDir, read, write } from "./store.js";
import { installPostLife, installPosts, postLife, SPAWN_AFTER_MS } from "./townsfolk.js";
import type { Post, PostHandle, Spot } from "./townsfolk.js";
import { trades } from "./trade.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/travel.json`;

export interface Pose {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** Degrees around the vertical, the game's way: ahead is (-sin, cos). */
    readonly yaw: number;
}

export interface Placement {
    /** Where the wagon's front axle stands and which way it faces; null when no room was found (the coachman stands alone). */
    readonly cart: Pose | null;
    readonly blueprint: string;
    readonly coach: Pose;
    /** Where a traveller is put down, beside the wagon, facing it. */
    readonly arrive: Pose;
    /**
     * Who chose it: the server's reading of the ground by the road (`estrada`), its search on the walkable mesh alone (`busca`, which
     * is provisional: a reading is still asked for), an administrator, the stop's own place picked by hand in World Builder (`fixo`, from
     * `STOPS`, never saved), or nobody (no room found: the road point itself).
     */
    readonly by: "estrada" | "busca" | "admin" | "fixo" | "vila";
}

/** A stop chosen by hand: where the wagon's front axle stands and which way it faces, where the coachman stands and where a traveller is put down. */
export interface FixedPlace {
    readonly cart: Pose;
    readonly blueprint?: string;
    readonly coach: Pose;
    readonly arrive: Pose;
}

export interface StopSpec {
    readonly id: string;
    readonly name: string;
    /** A point of the road that leaves the village, outside it, around which the ground is read and the wagon is put by the road; for a stop with a fixed place, its wagon's axle. */
    readonly anchor: Spot;
    /**
     * Where the stop was put by hand (2026-10-20: "nem todos ficaram em um local legal; deixei o builder rodando para você olhar em cada região
     * um ponto bom para colocar as carroças"): each spot was looked at from above in World Builder, on bare ground by the road, outside the
     * village, clear of trees and walls and of the slope the wagon would tilt on. The server reads no ground for such a stop. Only an
     * administrator's `/viagem aqui` moves it.
     */
    readonly fixed?: FixedPlace;
    /** The village's heart: the wagon faces away from it, as one that is leaving. */
    readonly center?: { readonly x: number; readonly y: number };
    /** A box nothing is put in (a castle's walls), with a margin around it. */
    readonly avoid?: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
}

/**
 * The stops the server starts with: the three towns of the citizenship, Wysoka, Kuttenberg, Zikmundovo, Grunta, and (2026-10-20) Bylany,
 * Bohunowitz, Miskowitz, Pschitoky, Stará Kutná and Horschan. Each is on the road that leaves the village, outside it (user, 2026-10-19:
 * "nas estradas próximo às vilas e pontos onde ficam no jogo padrão"; 2026-10-20: Suchdol's was in the middle of the square, Wysoka's in
 * a plowed field on a horse trough, Zikmundovo's among the camps, Grunta's on a wall facing it, Kuttenberg's in the road facing the wrong
 * way, Malešov's closing a street; and then "nem todos ficaram em um local legal; deixei o builder rodando para você ir olhando em cada
 * região um ponto bom para colocar as carroças").
 *
 * So every spot below was looked at from above in World Builder (its MCP, with a grid of world coordinates drawn over the picture and the
 * wagon's footprint, the coachman and the arrival point drawn on it): a meadow beside the road that leaves the village, outside it, clear
 * of trees, walls, water and rocks, on ground that does not slope under the wagon (the editor's ground probe reads the height under the
 * footprint's corners and middle: a spread of a couple of metres at most), facing along the road away from the village, with the
 * coachman on the road's side. `anchor` is the wagon's front axle; `center` is the village's heart. The poses are exact, so the server
 * reads no ground for these stops; `/viagem aqui` is how an administrator moves one, and `/viagem original` brings it back.
 */
export const STOPS: readonly StopSpec[] = [
    {
        id: "suchdol",
        name: "Suchdol",
        anchor: { x: 668.0, y: 3389.0, z: 142.0 },
        center: { x: 584.0, y: 3272.5 },
        fixed: {
            cart: { x: 668.0, y: 3389.0, z: 142.0, yaw: 17 },
            coach: { x: 665.65, y: 3388.81, z: 141.93, yaw: 107 },
            arrive: { x: 665.48, y: 3385.62, z: 141.9, yaw: -73 },
        },
    },
    {
        id: "raborsch",
        name: "Raborsch",
        anchor: { x: 1716.0, y: 3801.0, z: 105.95 },
        center: { x: 1588.0, y: 3822.0 },
        avoid: { minX: 1394, maxX: 1466, minY: 3799, maxY: 3876 },
        fixed: {
            cart: { x: 1716.0, y: 3801.0, z: 105.95, yaw: -165 },
            coach: { x: 1713.91, y: 3799.92, z: 105.95, yaw: 105 },
            arrive: { x: 1712.07, y: 3802.53, z: 106.17, yaw: -75 },
        },
    },
    {
        id: "malesov",
        name: "Malešov",
        anchor: { x: 702.0, y: 294.0, z: 113.25 },
        center: { x: 570.0, y: 255.0 },
        avoid: { minX: 435, maxX: 505, minY: 339, maxY: 407 },
        fixed: {
            cart: { x: 702.0, y: 294.0, z: 113.25, yaw: -90 },
            coach: { x: 702.5, y: 291.7, z: 112.85, yaw: -180 },
            arrive: { x: 699.5, y: 290.6, z: 112.71, yaw: 0 },
        },
    },
    {
        id: "wysoka",
        name: "Wysoka",
        anchor: { x: 534.0, y: 2536.0, z: 218.75 },
        center: { x: 390.0, y: 2455.0 },
        fixed: {
            cart: { x: 534.0, y: 2536.0, z: 218.75, yaw: -69 },
            coach: { x: 535.29, y: 2534.03, z: 219.06, yaw: -159 },
            arrive: { x: 532.88, y: 2531.93, z: 219.26, yaw: 21 },
        },
    },
    {
        id: "kuttenberg",
        name: "Kuttenberg",
        anchor: { x: 3160.0, y: 1074.0, z: 62.75 },
        center: { x: 3109.0, y: 752.0 },
        fixed: {
            cart: { x: 3160.0, y: 1074.0, z: 62.75, yaw: -90 },
            coach: { x: 3160.5, y: 1076.3, z: 62.76, yaw: 0 },
            arrive: { x: 3157.5, y: 1077.4, z: 63.05, yaw: -180 },
        },
    },
    {
        id: "zikmundovo",
        name: "Zikmundovo",
        anchor: { x: 1498.0, y: 2843.0, z: 185.1 },
        center: { x: 1620.0, y: 2780.0 },
        fixed: {
            cart: { x: 1498.0, y: 2843.0, z: 185.1, yaw: 55 },
            coach: { x: 1498.91, y: 2845.17, z: 185.08, yaw: -35 },
            arrive: { x: 1502.0, y: 2844.35, z: 185.33, yaw: 145 },
        },
    },
    {
        id: "grunta",
        name: "Minas",
        anchor: { x: 3377.0, y: 2192.0, z: 89.4 },
        center: { x: 3200.0, y: 2250.0 },
        fixed: {
            cart: { x: 3377.0, y: 2192.0, z: 89.4, yaw: -130 },
            coach: { x: 3375.9, y: 2189.92, z: 89.56, yaw: 140 },
            arrive: { x: 3372.9, y: 2191.0, z: 89.6, yaw: -40 },
        },
    },
    {
        id: "bylany",
        name: "Bylany",
        anchor: { x: 1720.0, y: 972.0, z: 105.35 },
        center: { x: 1719.0, y: 1067.0 },
        fixed: {
            cart: { x: 1720.0, y: 972.0, z: 105.35, yaw: 180 },
            coach: { x: 1717.7, y: 971.5, z: 105.49, yaw: 90 },
            arrive: { x: 1716.6, y: 974.5, z: 105.26, yaw: -90 },
        },
    },
    {
        id: "bohunowitz",
        name: "Bohunowitz",
        anchor: { x: 1912.0, y: 3455.0, z: 108.85 },
        center: { x: 1992.0, y: 3438.0 },
        fixed: {
            cart: { x: 1912.0, y: 3455.0, z: 108.85, yaw: 75 },
            coach: { x: 1910.92, y: 3452.91, z: 108.84, yaw: 165 },
            arrive: { x: 1913.53, y: 3451.07, z: 108.53, yaw: -15 },
        },
    },
    {
        id: "miskowitz",
        name: "Miskowitz",
        anchor: { x: 1694.0, y: 1902.0, z: 146.1 },
        center: { x: 1540.0, y: 1980.0 },
        fixed: {
            cart: { x: 1694.0, y: 1902.0, z: 146.1, yaw: -131 },
            coach: { x: 1692.87, y: 1899.94, z: 145.65, yaw: 139 },
            arrive: { x: 1689.88, y: 1901.07, z: 145.97, yaw: -41 },
        },
    },
    {
        id: "pschitoky",
        name: "Pschitoky",
        anchor: { x: 2267.0, y: 1960.0, z: 128.45 },
        center: { x: 2307.0, y: 1814.0 },
        fixed: {
            cart: { x: 2267.0, y: 1960.0, z: 128.45, yaw: -14 },
            coach: { x: 2269.35, y: 1959.93, z: 128.8, yaw: -104 },
            arrive: { x: 2269.69, y: 1956.75, z: 128.68, yaw: 76 },
        },
    },
    {
        id: "old-kutna",
        name: "Stará Kutná",
        anchor: { x: 3106.0, y: 1297.0, z: 94.7 },
        center: { x: 3070.0, y: 1370.0 },
        fixed: {
            cart: { x: 3106.0, y: 1297.0, z: 94.7, yaw: -123 },
            coach: { x: 3107.67, y: 1298.66, z: 94.33, yaw: -33 },
            arrive: { x: 3105.76, y: 1301.21, z: 94.48, yaw: 147 },
        },
    },
    {
        id: "horschan",
        name: "Horschan",
        anchor: { x: 2672.0, y: 2676.0, z: 129.85 },
        center: { x: 2577.0, y: 2626.0 },
        fixed: {
            cart: { x: 2672.0, y: 2676.0, z: 129.85, yaw: -90 },
            coach: { x: 2672.5, y: 2673.7, z: 130.19, yaw: -180 },
            arrive: { x: 2669.5, y: 2672.6, z: 130.83, yaw: 0 },
        },
    },
];

export const travelSettings = {
    /** The price: this much in coins, plus `perKm` for each kilometre of the straight line between the stops. */
    base: 5,
    perKm: 15,
    /** A conversation is kept this near the coachman, and a yes is heard from this near. */
    stayM: 8,
    /** How long the screen takes to go dark, and how long it stays dark after the move before it comes back. */
    fadeOutMs: 1_500,
    darkHoldMs: 2_500,
    fadeInMs: 2_000,
    /** Somebody hit by a player or an NPC this recently does not travel. */
    fightMs: 30_000,
    /** Destinations on one page of the choice list (with "more", "before" and "not now", eight rows). */
    page: 5,
    /** Room for the wagon is looked for this far around the village's spot, at this step. */
    searchM: 25,
    stepM: 2,
    /** The stops are placed before the townsfolk's bodies are made, and the wagons after. */
    placeAfterMs: SPAWN_AFTER_MS - 3_000,
    cartAfterMs: SPAWN_AFTER_MS + 1_000,
    /** A wagon taken out of the world is put back this long after. */
    cartBackMs: 10_000,
    tickMs: 2_000,
};

/** The wagon and its team, measured from the front axle along the way it faces; the two-wheeler where the wagon does not fit. */
export interface Footprint {
    readonly blueprint: string;
    readonly back: number;
    readonly front: number;
    readonly half: number;
}

export const FOOTPRINTS: readonly Footprint[] = [
    { blueprint: "wagon_b_covered", back: 4.5, front: 6.0, half: 1.25 },
    { blueprint: "cart_b", back: 2.6, front: 4.2, half: 1.0 },
];

/**
 * The wagon by the road (2026-10-20). The server has no world of its own: a client near a stop reads the ground around it
 * (`World.resolveGround`), and the wagon goes beside the road, off it, facing along it away from the village, with the coachman on the
 * road's side. What a point is is told by what the trace meets: the surface of terrain (`mat_road`, `mat_grass`, `mat_field` of a plowed
 * field, `mat_water`, `mat_mud`...), and whether it is terrain at all (a wall is a brush, a tree a vegetation, a trough or a cart an entity).
 */
export const roadside = {
    /** The game's surfaces of a road (`Libs/MaterialEffects/SurfaceTypes.xml`). */
    surfaces: ["mat_road", "mat_gravel"] as readonly string[],
    /** The ground a wagon may stand on: grass and bare earth of a verge. Not a field (`mat_field`), mud, water, rock or a forest floor. */
    verge: ["mat_grass", "mat_grassdry", "mat_grass_tall", "mat_soil"] as readonly string[],
    /** A player this near the stop's spot lends their client for the reading. */
    nearM: 150,
    /** The ground is read this far around the spot, on a grid of this step, this many points at a time. */
    searchM: 40,
    stepM: 2,
    batch: 48,
    /** The wagon's axle stands this far from the nearest point of road, and every point of its outline at least `clearM`. */
    minM: 3,
    maxM: 7,
    clearM: 1.6,
    /** Every point of the outline is at least this far from anything that is not bare ground or road (a wall, a tree, a trough, a field, water). */
    obstacleM: 1.7,
    /** Steeper than this (the up of the ground's normal) is no place for a wagon. */
    minNormalZ: 0.94,
    /** A reading that found no place is tried again this much later, this many times in a run; then the walkable mesh alone chooses. */
    retryMs: 3 * 60_000,
    tries: 4,
};

/** One point of ground read around a stop. `road`: a road's surface. `usable`: bare ground, not steep. Neither: in the way. */
export interface GroundSample {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly road: boolean;
    readonly usable: boolean;
}

/** The points read around `center`: a grid of `stepM` inside a circle of `searchM`. */
export function probePoints(center: { x: number; y: number }, settings: { readonly searchM: number; readonly stepM: number } = roadside): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    const n = Math.floor(settings.searchM / settings.stepM);
    for (let i = -n; i <= n; i += 1) {
        for (let j = -n; j <= n; j += 1) {
            if (Math.hypot(i, j) * settings.stepM <= settings.searchM) {
                out.push({ x: Math.round((center.x + i * settings.stepM) * 100) / 100, y: Math.round((center.y + j * settings.stepM) * 100) / 100 });
            }
        }
    }
    return out;
}

/**
 * Where a wagon of `foot` may stand by the road, best first: on bare ground off the road, its axle `minM` to `maxM` from the nearest
 * point of road, its whole outline at least `clearM` from the road and `obstacleM` from anything in the way, along the road (its
 * direction is the main axis of the road's points near), facing away from `village` where it is known, with `side` the coachman's side
 * toward the road. Nearer the stop's spot is better.
 */
export function roadsideSpots(
    center: { x: number; y: number },
    samples: readonly GroundSample[],
    foot: Footprint,
    settings: typeof roadside = roadside,
    avoid?: StopSpec["avoid"],
    village?: { readonly x: number; readonly y: number },
): Array<{ axle: { x: number; y: number; z: number }; yaw: number; side: 1 | -1; fromRoad: number }> {
    const barred = (p: { x: number; y: number }): boolean => avoid !== undefined && p.x >= avoid.minX && p.x <= avoid.maxX && p.y >= avoid.minY && p.y <= avoid.maxY;
    const roads = samples.filter((one) => one.road);
    if (roads.length < 3) {
        return [];
    }
    const obstacles = samples.filter((one) => !one.road && !one.usable);
    const cell = (x: number, y: number): string => `${Math.round(x / settings.stepM)},${Math.round(y / settings.stepM)}`;
    const grid = new Map<string, GroundSample>();
    for (const one of samples) {
        grid.set(cell(one.x, one.y), one);
    }
    const nearest = (p: { x: number; y: number }, among: readonly GroundSample[]): { sample: GroundSample | null; d: number } => {
        let best: GroundSample | null = null;
        let d = Infinity;
        for (const one of among) {
            const e = Math.hypot(one.x - p.x, one.y - p.y);
            if (e < d) {
                d = e;
                best = one;
            }
        }
        return { sample: best, d };
    };
    const out: Array<{ axle: { x: number; y: number; z: number }; yaw: number; side: 1 | -1; fromRoad: number; score: number }> = [];
    for (const s of samples) {
        if (s.road || !s.usable || barred(s)) {
            continue;
        }
        const near = nearest(s, roads);
        if (near.sample === null || near.d < settings.minM || near.d > settings.maxM) {
            continue;
        }
        // The road's way there: the main axis of its points within 8 m.
        const local = roads.filter((r) => Math.hypot(r.x - near.sample!.x, r.y - near.sample!.y) <= 8);
        if (local.length < 3) {
            continue;
        }
        const mx = local.reduce((a, r) => a + r.x, 0) / local.length;
        const my = local.reduce((a, r) => a + r.y, 0) / local.length;
        let sxx = 0;
        let syy = 0;
        let sxy = 0;
        for (const r of local) {
            sxx += (r.x - mx) ** 2;
            syy += (r.y - my) ** 2;
            sxy += (r.x - mx) * (r.y - my);
        }
        const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
        let yaw = norm((Math.atan2(-Math.cos(theta), Math.sin(theta)) * 180) / Math.PI);
        // Facing away from the village, as a cart that is leaving.
        if (village !== undefined) {
            const f0 = ahead(yaw);
            if (f0.x * (s.x - village.x) + f0.y * (s.y - village.y) < 0) {
                yaw = norm(yaw + 180);
            }
        }
        const f = ahead(yaw);
        const r = rightOf(yaw);
        let clear = true;
        for (let along = -foot.back; along <= foot.front + 0.01 && clear; along += 1.5) {
            for (const off of [-foot.half, 0, foot.half]) {
                const p = { x: s.x + f.x * along + r.x * off, y: s.y + f.y * along + r.y * off };
                const g = grid.get(cell(p.x, p.y));
                if (g === undefined || g.road || !g.usable || Math.abs(g.z - s.z) > 1.5 || barred(p) || nearest(p, roads).d < settings.clearM || nearest(p, obstacles).d < settings.obstacleM) {
                    clear = false;
                    break;
                }
            }
        }
        if (!clear) {
            continue;
        }
        const toRoad = { x: near.sample.x - s.x, y: near.sample.y - s.y };
        const side: 1 | -1 = toRoad.x * r.x + toRoad.y * r.y >= 0 ? 1 : -1;
        const score = Math.hypot(s.x - center.x, s.y - center.y) + Math.abs(near.d - (settings.minM + settings.maxM) / 2) * 2;
        out.push({ axle: { x: s.x, y: s.y, z: s.z }, yaw, side, fromRoad: Math.round(near.d * 10) / 10, score });
    }
    out.sort((a, b) => a.score - b.score);
    return out.map(({ score: _score, ...spot }) => spot);
}

/** What the coachman says to whoever comes near. */
export const COACH_LINES: readonly string[] = [
    "Precisa de transporte? Levo a qualquer vila da região.",
    "Carroça pronta e cavalos descansados. Para onde vamos?",
    "É só pagar a viagem, e a estrada faz o resto.",
];

const ID = /^[a-z0-9-]{2,24}$/;

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function norm(degrees: number): number {
    const d = ((((degrees + 180) % 360) + 360) % 360) - 180;
    return d === -180 ? 180 : Math.round(d * 10) / 10;
}

/** Ahead, for a yaw in degrees, the game's way. */
export function ahead(yaw: number): { x: number; y: number } {
    const r = (yaw * Math.PI) / 180;
    return { x: -Math.sin(r), y: Math.cos(r) };
}

/** To the right of `ahead`. */
export function rightOf(yaw: number): { x: number; y: number } {
    const r = (yaw * Math.PI) / 180;
    return { x: Math.cos(r), y: Math.sin(r) };
}

function pose(point: { x: number; y: number; z: number }, yaw: number): Pose {
    const round = (value: number): number => Math.round(value * 100) / 100;
    return { x: round(point.x), y: round(point.y), z: round(point.z), yaw: norm(yaw) };
}

function snap(point: { x: number; y: number; z: number }, radius: number, height: number): Vector3 | null {
    if (!Navigation.ready) {
        return null;
    }
    return Navigation.closestPoint(new Vector3(point.x, point.y, point.z), { searchRadius: radius, searchHeight: height, doors: "none" });
}

/**
 * Whether a wagon of `foot` fits at `axle` facing `yaw`: three lines along it (its middle and both sides) cross the walkable ground
 * from its back to the noses of its horses without meeting the mesh's edge (a wall, a fence, a drop), nor climbing more than a
 * metre and a half.
 */
export function fits(axle: { x: number; y: number; z: number }, yaw: number, foot: Footprint): boolean {
    const f = ahead(yaw);
    const r = rightOf(yaw);
    for (const off of [-foot.half, 0, foot.half]) {
        const from = { x: axle.x - f.x * foot.back + r.x * off, y: axle.y - f.y * foot.back + r.y * off, z: axle.z };
        const start = snap(from, 0.4, 2);
        if (start === null || flat(start, from) > 0.3 || Math.abs(start.z - axle.z) > 1.5) {
            return false;
        }
        const to = new Vector3(axle.x + f.x * foot.front + r.x * off, axle.y + f.y * foot.front + r.y * off, axle.z);
        const ray = Navigation.raycast(start, to, { searchRadius: 0.4, searchHeight: 2, doors: "none" });
        if (ray === null || ray.hit || Math.abs(ray.point.z - axle.z) > 1.5) {
            return false;
        }
    }
    return true;
}

/**
 * The coachman's place on one side of the wagon (`side` 1 on its right, -1 on its left), facing out, and where a traveller is put down,
 * further back on the same side, facing the wagon. `strict`: both must be on the walkable ground with nothing between them and the
 * wagon, else null; otherwise they are where the numbers say, on the ground where it can be found.
 */
export function beside(axle: { x: number; y: number; z: number }, yaw: number, side: 1 | -1, strict = true): { coach: Pose; arrive: Pose } | null {
    const f = ahead(yaw);
    const r = rightOf(yaw);
    const out = { x: r.x * side, y: r.y * side };
    const coachRaw = { x: axle.x + out.x * 2.3 + f.x * 0.5, y: axle.y + out.y * 2.3 + f.y * 0.5, z: axle.z };
    const arriveRaw = { x: axle.x + out.x * 3.4 - f.x * 2.5, y: axle.y + out.y * 3.4 - f.y * 2.5, z: axle.z };
    const coachYaw = yaw - 90 * side;
    if (!strict) {
        return { coach: pose(snap(coachRaw, 2, 4) ?? coachRaw, coachYaw), arrive: pose(snap(arriveRaw, 2, 4) ?? arriveRaw, coachYaw + 180) };
    }
    const coach = snap(coachRaw, 0.6, 2);
    const arrive = snap(arriveRaw, 0.8, 2);
    if (coach === null || arrive === null || flat(coach, coachRaw) > 0.5 || flat(arrive, arriveRaw) > 0.7) {
        return null;
    }
    const edge = snap({ x: axle.x + out.x * 1.3, y: axle.y + out.y * 1.3, z: axle.z }, 0.5, 2);
    if (edge === null) {
        return null;
    }
    for (const target of [coach, arrive]) {
        const ray = Navigation.raycast(edge, target, { searchRadius: 0.5, searchHeight: 2, doors: "none" });
        if (ray === null || ray.hit) {
            return null;
        }
    }
    return { coach: pose(coach, coachYaw), arrive: pose(arrive, coachYaw + 180) };
}

/**
 * Room for a stop around `anchor`: the nearest place where the wagon fits, at any of twelve headings, with the coachman beside it;
 * the two-wheeler where no wagon fits within `searchM`. Null when nothing fits or there is no mesh.
 */
export function findRoom(anchor: Spot, settings = travelSettings, avoid?: StopSpec["avoid"]): Placement | null {
    const barred = (point: { x: number; y: number }): boolean => avoid !== undefined && point.x >= avoid.minX && point.x <= avoid.maxX && point.y >= avoid.minY && point.y <= avoid.maxY;
    const start = snap(anchor, 8, 6);
    if (start === null) {
        return null;
    }
    for (const foot of FOOTPRINTS) {
        for (let radius = 0; radius <= settings.searchM; radius += settings.stepM) {
            const count = radius === 0 ? 1 : Math.ceil((2 * Math.PI * radius) / settings.stepM);
            for (let index = 0; index < count; index += 1) {
                const angle = (index / count) * 2 * Math.PI;
                const raw = { x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius, z: start.z };
                const axle = snap(raw, 0.8, 3);
                if (axle === null || flat(axle, raw) > 0.6 || barred(axle)) {
                    continue;
                }
                for (let heading = 0; heading < 12; heading += 1) {
                    const yaw = heading * 30;
                    if (!fits(axle, yaw, foot)) {
                        continue;
                    }
                    for (const side of [1, -1] as const) {
                        const spots = beside(axle, yaw, side);
                        if (spots !== null && !barred(spots.coach) && !barred(spots.arrive)) {
                            return { cart: pose(axle, yaw), blueprint: foot.blueprint, coach: spots.coach, arrive: spots.arrive, by: "busca" };
                        }
                    }
                }
            }
        }
    }
    return null;
}

export function kmBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return flat(a, b) / 1000;
}

/** The price of a trip, in coins as the game shows them. */
export function fareOf(km: number, prices: { readonly base: number; readonly perKm: number } = travelSettings): number {
    return Math.max(1, Math.round(prices.base + prices.perKm * km));
}

/** "1,2 km", "800 m". */
export function distanceText(km: number): string {
    return km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
}

function fade(player: Player, phase: "out" | "in", ms: number): void {
    player.emit(`${RESOURCE}:travel.fade`, JSON.stringify({ phase, ms }));
}

interface Stop {
    readonly id: string;
    name: string;
    anchor: Spot;
    center?: StopSpec["center"];
    avoid?: StopSpec["avoid"];
    fixed?: FixedPlace;
    place: Placement | null;
    cartId: number;
}

interface Talk {
    readonly player: Player;
    readonly stop: Stop;
    readonly npc: Npc;
    view: "list" | "confirm" | "night";
    offset: number;
    target: string;
    session: number;
}

interface Trip {
    readonly playerId: number;
    readonly steamId: string;
    readonly name: string;
    readonly from: string;
    readonly to: string;
    readonly units: number;
}

interface Saved {
    prices?: { base?: unknown; perKm?: unknown };
    places?: Record<string, unknown>;
    added?: unknown[];
    removed?: unknown[];
}

const postIdOf = (stop: { readonly id: string }): string => `cocheiro-${stop.id}`;

/** Where a traveller is put down, a little apart for each one in turn, so two who arrive together do not stand in each other. */
const ARRIVE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0.7, 0.4],
    [-0.6, 0.5],
    [0.2, -0.7],
];

export class Coaches {
    readonly stops = new Map<string, Stop>();
    /** The coachmen's posts, as `installPosts` reads them: filled when the stops are placed. */
    readonly posts: Post[] = [];
    prices = { base: travelSettings.base, perKm: travelSettings.perKm };
    private handle: PostHandle | null = null;
    private readonly talks = new Map<number, Talk>();
    private readonly trips = new Map<number, Trip>();
    private readonly hitAt = new Map<number, number>();
    private readonly added: StopSpec[] = [];
    private readonly removed = new Set<string>();
    private arrivals = 0;
    private stopping = false;
    /** The coachmen's bodies and the wagons have been made (before that a move only changes the place they will be made at). */
    private made = false;
    /** A reading of the ground by a road is running; and how often each stop was read, and when. */
    private probing = false;
    private readonly roadTries = new Map<string, { count: number; at: number }>();

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly later: (fn: () => void, ms: number) => void = (fn, ms) => {
            setTimeout(fn, ms);
        },
    ) {
        for (const spec of STOPS) {
            this.stops.set(spec.id, { id: spec.id, name: spec.name, anchor: spec.anchor, center: spec.center, avoid: spec.avoid, fixed: spec.fixed, place: spec.fixed === undefined ? null : fixedPlacement(spec.fixed), cartId: 0 });
        }
    }

    attach(handle: PostHandle): void {
        this.handle = handle;
    }

    /** The coachmen for the administrator's NPCs section (2026-11-02): each stop's, where he stands, whether the place was an administrator's, and whether his body is up. */
    coachListing(): Array<{ readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly z: number; readonly chosen: boolean; readonly up: boolean }> {
        const standing = this.handle?.standing();
        return [...this.stops.values()].map((stop) => {
            const coach = stop.place?.coach ?? { x: stop.anchor.x, y: stop.anchor.y, z: stop.anchor.z };
            return { id: stop.id, name: stop.name, x: coach.x, y: coach.y, z: coach.z, chosen: stop.place?.by === "admin", up: standing?.has(postIdOf(stop)) === true };
        });
    }

    // -----------------------------------------------------------------------------------------
    // What is kept.

    load(): void {
        const loaded = read<Saved>(FILE);
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        const saved = loaded.value;
        const base = Number(saved.prices?.base);
        const perKm = Number(saved.prices?.perKm);
        if (Number.isFinite(base) && Number.isFinite(perKm) && base >= 0 && perKm >= 0) {
            this.prices = { base, perKm };
        }
        for (const raw of Array.isArray(saved.added) ? saved.added : []) {
            const spec = raw as Partial<StopSpec> | null;
            const anchor = spec?.anchor;
            if (spec !== null && typeof spec.id === "string" && ID.test(spec.id) && typeof spec.name === "string" && spec.name !== "" && anchor !== undefined && [anchor.x, anchor.y, anchor.z].every(Number.isFinite) && !this.stops.has(spec.id)) {
                const added: StopSpec = { id: spec.id, name: spec.name, anchor: { x: anchor.x, y: anchor.y, z: anchor.z } };
                this.added.push(added);
                this.stops.set(added.id, { id: added.id, name: added.name, anchor: added.anchor, place: null, cartId: 0 });
            }
        }
        for (const id of Array.isArray(saved.removed) ? saved.removed : []) {
            if (typeof id === "string" && this.stops.has(id)) {
                this.removed.add(id);
                this.stops.delete(id);
            }
        }
        for (const [id, raw] of Object.entries(saved.places ?? {})) {
            const stop = this.stops.get(id);
            const place = placementOf(raw);
            // A stop put by hand in World Builder keeps its place, whatever an older reading of the ground saved; only an administrator's own move holds.
            if (stop !== undefined && place !== null && (stop.fixed === undefined || place.by === "admin")) {
                stop.place = place;
            }
        }
    }

    persist(): void {
        const places: Record<string, Placement> = {};
        for (const stop of this.stops.values()) {
            // What nobody chose (no room found) is looked for again at the next start.
            if (stop.place !== null && stop.place.by !== "vila" && stop.place.by !== "fixo") {
                places[stop.id] = stop.place;
            }
        }
        try {
            ensureDir(DIR);
            write(FILE, { prices: this.prices, places, added: this.added, removed: [...this.removed] });
        } catch (error: unknown) {
            console.log(`travel: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // -----------------------------------------------------------------------------------------
    // The stops in the world.

    /**
     * Every stop gets its place (the kept one, or the road point itself until a client has read the ground there) and its coachman's post.
     * A place that was only the walkable mesh's choice (`busca`) is read again when a player comes near.
     */
    place(): void {
        if (!Navigation.ready) {
            console.log("travel: a malha de navegação não está pronta: as paradas sem lugar guardado ficam no ponto da estrada, sem carroça, até um jogador chegar perto e o chão ser lido");
        }
        const waiting: string[] = [];
        for (const stop of this.stops.values()) {
            if (stop.place === null) {
                stop.place = fallbackOf(stop.anchor);
                waiting.push(stop.name);
            }
        }
        this.posts.length = 0;
        for (const stop of this.stops.values()) {
            this.posts.push(this.postOf(stop));
        }
        if (waiting.length > 0) {
            console.log(`travel: ${waiting.join(", ")} esperam um jogador por perto: o chão da estrada é lido pelo cliente dele, e a carroça vai para a beira (a menos de ${roadside.nearM} m do ponto)`);
        }
    }

    private postOf(stop: Stop): Post {
        const coach = stop.place?.coach ?? pose(stop.anchor, 0);
        return { id: postIdOf(stop), name: "Cocheiro", soul: "townsman", x: coach.x, y: coach.y, z: coach.z, yaw: coach.yaw };
    }

    spawnCarts(): number {
        this.made = true;
        let made = 0;
        for (const stop of this.stops.values()) {
            if (this.spawnCart(stop)) {
                made += 1;
            }
        }
        return made;
    }

    private spawnCart(stop: Stop): boolean {
        this.removeCart(stop);
        const cart = stop.place?.cart;
        if (cart === null || cart === undefined || this.stopping) {
            return false;
        }
        try {
            const made = Cart.spawn(stop.place?.blueprint || FOOTPRINTS[0]?.blueprint, new Vector3(cart.x, cart.y, cart.z), new Vector3(0, 0, cart.yaw));
            stop.cartId = made.id;
            reservedCarts.set(made.id, () => this.cartWord(stop));
            return true;
        } catch (error: unknown) {
            console.log(`travel: não consegui pôr a carroça de ${stop.name}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    private removeCart(stop: Stop): void {
        if (stop.cartId === 0) {
            return;
        }
        const id = stop.cartId;
        stop.cartId = 0;
        reservedCarts.delete(id);
        try {
            Cart.getById(id)?.destroy();
        } catch {
            // Already gone.
        }
    }

    /** What a player who tries to get on a stop's wagon is told. */
    cartWord(stop: Stop): string {
        return this.handle?.asleep(postIdOf(stop)) === true ? `O cocheiro de ${stop.name} foi dormir: as viagens voltam de manhã.` : "Essa carroça é do cocheiro: fale com ele para viajar.";
    }

    /** A wagon left the world: a stop's is put back a moment later. */
    cartGone(cart: Cart): void {
        for (const stop of this.stops.values()) {
            if (stop.cartId === cart.id) {
                stop.cartId = 0;
                reservedCarts.delete(cart.id);
                if (!this.stopping) {
                    this.later(() => {
                        if (stop.cartId === 0 && this.stops.get(stop.id) === stop) {
                            this.spawnCart(stop);
                        }
                    }, travelSettings.cartBackMs);
                }
            }
        }
    }

    /** The stop's wagon and coachman where its place now says. */
    private refresh(stop: Stop): void {
        const post = this.postOf(stop);
        const index = this.posts.findIndex((candidate) => candidate.id === post.id);
        if (index >= 0) {
            this.posts[index] = post;
        } else {
            this.posts.push(post);
        }
        if (!this.made) {
            return;
        }
        this.spawnCart(stop);
        if (this.handle !== null) {
            this.handle.sleep(post.id);
            this.handle.wake(post.id, new Vector3(post.x, post.y, post.z), post.yaw ?? 0);
        }
    }

    stop(): void {
        this.stopping = true;
        for (const stop of this.stops.values()) {
            this.removeCart(stop);
        }
        for (const talk of this.talks.values()) {
            Dialogue.close(talk.session);
        }
        this.talks.clear();
    }

    // -----------------------------------------------------------------------------------------
    // Talking to the coachman.

    night(): boolean {
        const hour = World.hour;
        return !(hour >= postLife.open && hour < postLife.bed);
    }

    private destinations(from: Stop): Array<{ stop: Stop; km: number; fare: number }> {
        const here = spotOf(from);
        return [...this.stops.values()]
            .filter((other) => other.id !== from.id && other.place !== null)
            .map((other) => {
                const km = kmBetween(here, spotOf(other));
                return { stop: other, km, fare: fareOf(km, this.prices) };
            })
            .sort((a, b) => a.km - b.km);
    }

    private page(talk: Talk): DialoguePage {
        if (talk.view === "night") {
            return { line: "Cocheiro: já é noite, e os cavalos descansam. Partimos de manhã cedo, a partir das 6 horas.", onRight: false, options: [{ id: "leave", text: "Até amanhã", enabled: true }] };
        }
        const all = this.destinations(talk.stop);
        const target = talk.view === "confirm" ? all.find((entry) => entry.stop.id === talk.target) : undefined;
        if (target !== undefined) {
            return {
                line: `Cocheiro: até ${target.stop.name} são ${target.fare} moedas. Partimos agora?`,
                onRight: false,
                options: [
                    { id: "pay", text: `Pagar ${target.fare} moedas e partir`, enabled: true },
                    { id: "back", text: "Escolher outro destino", enabled: true },
                    { id: "leave", text: "Agora não", enabled: true },
                ],
            };
        }
        talk.view = "list";
        const page = travelSettings.page;
        const options: DialogueOption[] = all.slice(talk.offset, talk.offset + page).map((entry) => ({ id: `go:${entry.stop.id}`, text: `${entry.stop.name}: ${entry.fare} moedas (${distanceText(entry.km)})`, enabled: true }));
        if (talk.offset > 0) {
            options.push({ id: "less", text: "‹ Destinos de antes", enabled: true });
        }
        if (talk.offset + page < all.length) {
            options.push({ id: "more", text: "Mais destinos ›", enabled: true });
        }
        options.push({ id: "leave", text: "Agora não", enabled: true });
        const line = all.length === 0 ? "Cocheiro: ainda não há outra parada para onde levar o senhor." : `Cocheiro: para onde vamos? Levo às outras vilas; quanto mais longe, mais caro.`;
        return { line, onRight: false, options };
    }

    private show(talk: Talk): void {
        if (!Dialogue.update(talk.session, this.page(talk))) {
            this.talks.delete(talk.session);
        }
    }

    private close(talk: Talk, why: string): void {
        this.talks.delete(talk.session);
        Dialogue.close(talk.session);
        if (why !== "") {
            tell(talk.player, why);
        }
    }

    /** E on a coachman. False when nothing was opened. */
    open(player: Player, post: Post, npc: Npc): boolean {
        const stop = this.stops.get(post.id.replace(/^cocheiro-/, ""));
        if (stop === undefined || !player.ready || !player.alive || this.trips.has(player.id) || Dialogue.sessionOf(player.id) !== 0) {
            return false;
        }
        const talk: Talk = { player, stop, npc, view: this.night() ? "night" : "list", offset: 0, target: "", session: 0 };
        talk.session = Dialogue.open(player.id, this.page(talk));
        if (talk.session === 0) {
            return false;
        }
        this.talks.set(talk.session, talk);
        return true;
    }

    choose(session: number, player: Player, option: string): void {
        const talk = this.talks.get(session);
        if (talk === undefined || talk.player.id !== player.id) {
            return;
        }
        if (option === "leave") {
            this.close(talk, "");
            return;
        }
        if (talk.view !== "night" && this.night()) {
            talk.view = "night";
            this.show(talk);
            return;
        }
        if (talk.view === "list") {
            if (option === "more" || option === "less") {
                talk.offset = Math.max(0, talk.offset + (option === "more" ? travelSettings.page : -travelSettings.page));
                this.show(talk);
            } else if (option.startsWith("go:")) {
                talk.target = option.slice(3);
                talk.view = "confirm";
                this.show(talk);
            }
            return;
        }
        if (talk.view === "confirm") {
            if (option === "back") {
                talk.view = "list";
                this.show(talk);
            } else if (option === "pay") {
                this.pay(talk);
            }
        }
    }

    closed(session: number): void {
        this.talks.delete(session);
    }

    /** Why this player cannot set off now, or "". */
    refusal(player: Player, npc: Npc | null): string {
        if (!player.ready || !player.alive) {
            return "Agora não dá para viajar.";
        }
        if (npc !== null && flat(player.position, npc.position) > travelSettings.stayM) {
            return "Você se afastou do cocheiro.";
        }
        if (this.night()) {
            return "Já é noite: as viagens voltam de manhã.";
        }
        if (restartPending(this.now())) {
            return "O servidor vai reiniciar em instantes: a viagem fica para depois.";
        }
        if (player.mounted === true || (player.horse ?? null) !== null) {
            return "Desça do cavalo antes de subir na carroça.";
        }
        if (cartOf(player) !== null) {
            return "Desça da carroça em que você está antes.";
        }
        if ((player.carrying ?? null) !== null || (player.carriedBy ?? null) !== null || (player.carriedItem ?? null) !== null) {
            return "Não dá para viajar carregando alguém ou alguma coisa nos braços.";
        }
        if (trades.isTrading(player)) {
            return "Termine a troca antes de viajar.";
        }
        if (diceLobby.seated(player)) {
            return "Saia da mesa de dados antes de viajar.";
        }
        if (this.now() - (this.hitAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < travelSettings.fightMs) {
            return "Não dá para viajar no meio de uma briga.";
        }
        return "";
    }

    private pay(talk: Talk): void {
        const { player, stop } = talk;
        const target = this.destinations(stop).find((entry) => entry.stop.id === talk.target);
        if (target === undefined) {
            talk.view = "list";
            this.show(talk);
            return;
        }
        let npc: Npc | null = talk.npc;
        try {
            void npc.position;
        } catch {
            npc = null;
        }
        if (npc === null) {
            this.close(talk, "O cocheiro já não está aqui.");
            return;
        }
        const refusal = this.refusal(player, npc);
        if (refusal !== "") {
            tell(player, refusal);
            return;
        }
        const units = target.fare * MONEY_UNIT;
        if (moneyOf(player) < units) {
            tell(player, `A viagem até ${target.stop.name} custa ${coins(units)} e você não tem o bastante.`);
            return;
        }
        if (!takeMoney(player, units)) {
            tell(player, "Não consegui receber o pagamento agora. Tente de novo.");
            return;
        }
        this.close(talk, "");
        const trip: Trip = { playerId: player.id, steamId: player.steamId, name: player.nickname, from: stop.id, to: target.stop.id, units };
        this.trips.set(player.id, trip);
        tell(player, `Você paga ${coins(units)} ao cocheiro e sobe na carroça para ${target.stop.name}.`);
        fade(player, "out", travelSettings.fadeOutMs);
        this.later(() => this.arrive(trip), travelSettings.fadeOutMs + 200);
    }

    /** The screen is dark: the traveller is put down at the other stop, or paid back. */
    arrive(trip: Trip): void {
        const player = Player.getById(trip.playerId);
        const to = this.stops.get(trip.to);
        const from = this.stops.get(trip.from)?.name ?? trip.from;
        if (player === null || player.steamId !== trip.steamId) {
            this.trips.delete(trip.playerId);
            console.log(`travel: ${trip.name} saiu no meio da viagem de ${from} a ${to?.name ?? trip.to} (pagou ${coins(trip.units)})`);
            return;
        }
        const point = to?.place?.arrive;
        if (to === undefined || point === undefined || !player.alive || !this.put(player, point)) {
            this.trips.delete(trip.playerId);
            giveMoney(player, trip.units);
            fade(player, "in", 800);
            tell(player, "Não deu para viajar agora; o dinheiro foi devolvido.");
            console.log(`travel: a viagem de ${trip.name} de ${from} a ${to?.name ?? trip.to} não saiu; ${coins(trip.units)} devolvidas`);
            return;
        }
        console.log(`travel: ${trip.name} viajou de ${from} a ${to.name} por ${coins(trip.units)}`);
        this.later(() => {
            this.trips.delete(trip.playerId);
            const still = Player.getById(trip.playerId);
            if (still !== null && still.steamId === trip.steamId) {
                fade(still, "in", travelSettings.fadeInMs);
                tell(still, `Você chegou a ${to.name}.`);
            }
        }, travelSettings.darkHoldMs);
    }

    private put(player: Player, point: Pose): boolean {
        const [dx, dy] = ARRIVE_OFFSETS[this.arrivals % ARRIVE_OFFSETS.length] ?? [0, 0];
        this.arrivals += 1;
        const raw = { x: point.x + dx, y: point.y + dy, z: point.z };
        const at = snap(raw, 1, 3) ?? new Vector3(raw.x, raw.y, raw.z);
        try {
            return player.spawn(at, new Vector3(0, 0, point.yaw)) || player.teleport(at);
        } catch (error: unknown) {
            console.log(`travel: não consegui levar ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    hit(player: Player): void {
        this.hitAt.set(player.id, this.now());
    }

    /** Conversations whose player walked off, died or left, or whose coachman went in, are let go. */
    tick(): void {
        const now = this.now();
        for (const talk of [...this.talks.values()]) {
            const player = Player.getById(talk.player.id);
            if (player === null || player.steamId !== talk.player.steamId || !player.alive) {
                this.talks.delete(talk.session);
                Dialogue.close(talk.session);
                continue;
            }
            let distance: number;
            try {
                distance = flat(player.position, talk.npc.position);
            } catch {
                this.close(talk, "O cocheiro foi embora.");
                continue;
            }
            if (distance > travelSettings.stayM) {
                this.close(talk, "Você se afastou do cocheiro.");
            }
        }
        for (const [id, at] of this.hitAt) {
            if (now - at > travelSettings.fightMs) {
                this.hitAt.delete(id);
            }
        }
        this.roadsideTick(now);
    }

    /**
     * A stop whose wagon is not yet by the road, with a player near: that player's client reads the ground, and the wagon goes by the
     * road. After `roadside.tries` readings that found nothing the stop is left to the walkable mesh alone.
     */
    roadsideTick(now = this.now()): void {
        if (this.probing || this.stopping || !this.made || this.talks.size > 0 || this.trips.size > 0) {
            return;
        }
        let players: Player[];
        try {
            players = Player.all();
        } catch {
            return;
        }
        for (const stop of this.stops.values()) {
            if (stop.place !== null && stop.place.by !== "busca" && stop.place.by !== "vila") {
                continue;
            }
            const tried = this.roadTries.get(stop.id);
            if (tried !== undefined && (tried.count >= roadside.tries || now - tried.at < roadside.retryMs)) {
                continue;
            }
            const reader = players.find((player) => player.ready && player.alive && flat(player.position, stop.anchor) <= roadside.nearM);
            if (reader === undefined) {
                continue;
            }
            const count = (tried?.count ?? 0) + 1;
            this.roadTries.set(stop.id, { count, at: now });
            this.probing = true;
            this.probeRoad(stop, reader)
                .then((result) => {
                    if (!result.placed && count >= roadside.tries && stop.place?.by === "vila") {
                        this.byMesh(stop);
                    }
                })
                .catch((error: unknown) => console.log(`travel: a leitura da estrada de ${stop.name} falhou: ${error instanceof Error ? error.message : String(error)}`))
                .finally(() => {
                    this.probing = false;
                });
            return;
        }
    }

    /** The last resort: the walkable mesh alone chooses (it knows nothing of roads, so a wagon may stand on one). */
    private byMesh(stop: Stop): void {
        const found = findRoom(stop.anchor, travelSettings, stop.avoid);
        if (found === null) {
            console.log(`travel: ${stop.name}: nem a malha achou lugar para a carroça; o cocheiro fica sozinho no ponto da estrada. Use /viagem aqui ${stop.id}.`);
            return;
        }
        stop.place = found;
        this.persist();
        this.refresh(stop);
        console.log(`travel: ${stop.name}: o chão da estrada não foi lido a contento; a carroça ficou onde a malha achou lugar (${found.cart?.x}, ${found.cart?.y})`);
    }

    /**
     * Reads the ground round a stop through `reader`'s client and puts the wagon by the road. Says what happened, and whether it was put.
     */
    private async probeRoad(stop: Stop, reader: Player): Promise<{ placed: boolean; text: string }> {
        const points = probePoints(stop.anchor);
        const samples: GroundSample[] = [];
        for (let index = 0; index < points.length; index += roadside.batch) {
            const part = points.slice(index, index + roadside.batch);
            const traces = await Promise.all(part.map((p) => World.resolveGround(reader, new Vector3(p.x, p.y, stop.anchor.z), { up: 40, down: 80 })));
            if (traces.some((trace) => !trace.answered) || this.stopping) {
                const text = `O jogo de ${reader.nickname} parou de responder na leitura do chão de ${stop.name}.`;
                console.log(`travel: ${text} Tento de novo mais tarde`);
                return { placed: false, text };
            }
            traces.forEach((trace, k) => {
                const hit = trace.hit;
                const p = part[k]!;
                // A point that read nothing is in the way as much as a wall: the place must not lean on what is not known.
                samples.push(
                    hit === null
                        ? { x: p.x, y: p.y, z: stop.anchor.z, road: false, usable: false }
                        : {
                              x: p.x,
                              y: p.y,
                              z: hit.position.z,
                              road: hit.kind === "terrain" && roadside.surfaces.includes(hit.surface),
                              usable: hit.kind === "terrain" && hit.normal.z >= roadside.minNormalZ && roadside.verge.includes(hit.surface),
                          },
                );
            });
        }
        const roads = samples.filter((one) => one.road).length;
        const verges = samples.filter((one) => one.usable).length;
        if (roads === 0) {
            const text = `Nenhum chão de estrada a ${roadside.searchM} m do ponto de ${stop.name} (${samples.length} pontos lidos, ${verges} de grama).`;
            console.log(`travel: ${text} A carroça fica onde está`);
            return { placed: false, text };
        }
        if (this.talks.size > 0 || this.trips.size > 0) {
            this.roadTries.delete(stop.id);
            return { placed: false, text: "Uma viagem estava em curso; leio de novo daqui a pouco." };
        }
        for (const foot of FOOTPRINTS) {
            for (const spot of roadsideSpots(stop.anchor, samples, foot, roadside, stop.avoid, stop.center).slice(0, 60)) {
                const axle = snap(spot.axle, 0.8, 3);
                if (axle === null || flat(axle, spot.axle) > 0.6 || !fits(axle, spot.yaw, foot)) {
                    continue;
                }
                const spots = beside(axle, spot.yaw, spot.side);
                if (spots === null) {
                    continue;
                }
                const old = stop.place?.cart;
                stop.place = { cart: pose(axle, spot.yaw), blueprint: foot.blueprint, coach: spots.coach, arrive: spots.arrive, by: "estrada" };
                this.persist();
                this.refresh(stop);
                const text = `${stop.name}: ${foot.blueprint === "cart_b" ? "carro de duas rodas" : "carroça"} posta na beira da estrada em ${stop.place.cart?.x}, ${stop.place.cart?.y}, giro ${stop.place.cart?.yaw}° (a ${spot.fromRoad} m do chão de estrada${old ? `; estava em ${old.x}, ${old.y}` : ""}; ${samples.length} pontos lidos, ${roads} de estrada)`;
                console.log(`travel: ${text} pelo jogo de ${reader.nickname}`);
                return { placed: true, text };
            }
        }
        const text = `${stop.name}: ${roads} pontos de estrada e ${verges} de grama, mas nenhum lugar livre na beira para a carroça (muro, árvore, campo ou água por perto).`;
        console.log(`travel: ${text} A carroça fica onde está`);
        return { placed: false, text };
    }

    left(player: Player): void {
        for (const talk of [...this.talks.values()]) {
            if (talk.player.id === player.id) {
                this.talks.delete(talk.session);
            }
        }
        this.hitAt.delete(player.id);
    }

    talking(): number {
        return this.talks.size;
    }

    travelling(): number {
        return this.trips.size;
    }

    // -----------------------------------------------------------------------------------------
    // What an administrator does (`/viagem`).

    private named(id: string): Stop | string {
        const stop = this.stops.get(id.toLowerCase());
        return stop ?? `Não há parada "${id}". As paradas: ${[...this.stops.keys()].join(", ")}.`;
    }

    /** The stop's wagon in front of the administrator, broadside, and the coachman on their side of it. */
    placeHere(admin: Player, id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        const yaw = yawOf(admin.rotation);
        const f = ahead(yaw);
        const raw = { x: admin.position.x + f.x * 6, y: admin.position.y + f.y * 6, z: admin.position.z };
        const axle = snap(raw, 2, 4) ?? raw;
        const cartYaw = yaw + 90;
        const spots = beside(axle, cartYaw, -1) ?? beside(axle, cartYaw, -1, false);
        if (spots === null) {
            return "Não achei chão para a carroça aí.";
        }
        stop.place = { cart: pose(axle, cartYaw), blueprint: stop.place?.blueprint || FOOTPRINTS[0]?.blueprint || "wagon_b_covered", coach: spots.coach, arrive: spots.arrive, by: "admin" };
        this.persist();
        this.refresh(stop);
        console.log(`travel: ${admin.nickname} pôs a parada de ${stop.name} em ${stop.place.cart?.x}, ${stop.place.cart?.y}`);
        return `${stop.name}: a carroça está na sua frente, de lado, e o cocheiro do seu lado dela. Fica assim nos próximos reinícios.`;
    }

    /** The coachman alone, where the administrator stands. */
    coachHere(admin: Player, id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        const coach = pose(admin.position, yawOf(admin.rotation));
        const old = stop.place ?? fallbackOf(stop.anchor);
        stop.place = { ...old, coach, by: "admin" };
        this.persist();
        this.refresh(stop);
        return `${stop.name}: o cocheiro fica onde você está, olhando para onde você olha.`;
    }

    /**
     * The ground of a stop is read again, through the administrator's own game: they must be near the stop's road point. The answer comes
     * a few seconds later, in the chat. `/viagem malha` leaves the choice to the walkable mesh alone.
     */
    research(admin: Player, id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        if (stop.place?.by === "fixo") {
            return `A parada de ${stop.name} foi posta à mão (vista do alto no World Builder): não há o que ler. /viagem aqui ${stop.id} a muda de lugar.`;
        }
        const away = flat(admin.position, stop.anchor);
        if (away > roadside.nearM) {
            return `Vá até perto da parada de ${stop.name} (a menos de ${roadside.nearM} m de x ${Math.round(stop.anchor.x)}, y ${Math.round(stop.anchor.y)}; você está a ${Math.round(away)} m) e peça de novo: o chão é lido pelo seu jogo. /viagem ir ${stop.id} leva você.`;
        }
        if (this.probing) {
            return "Uma leitura do chão já está em curso; espere uns segundos.";
        }
        this.roadTries.set(stop.id, { count: roadside.tries + 1, at: this.now() });
        this.probing = true;
        this.probeRoad(stop, admin)
            .then((result) => tell(admin, result.text))
            .catch((error: unknown) => tell(admin, `A leitura falhou: ${error instanceof Error ? error.message : String(error)}`))
            .finally(() => {
                this.probing = false;
            });
        return `Lendo o chão ao redor da parada de ${stop.name} pelo seu jogo (uns ${Math.ceil(probePoints(stop.anchor).length / roadside.batch)} lotes); a resposta vem em instantes.`;
    }

    /** The walkable mesh alone chooses a place around the stop's road point (it knows nothing of roads: the wagon may stand on one). */
    researchMesh(id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        if (stop.place?.by === "fixo") {
            return `A parada de ${stop.name} foi posta à mão (vista do alto no World Builder): a malha não a muda. /viagem aqui ${stop.id} a muda de lugar.`;
        }
        const found = findRoom(stop.anchor, travelSettings, stop.avoid);
        stop.place = found ?? fallbackOf(stop.anchor);
        this.persist();
        this.refresh(stop);
        return found === null ? `${stop.name}: não achei lugar livre para a carroça perto do ponto da estrada; o cocheiro fica sozinho. Use /viagem aqui ${stop.id}.` : `${stop.name}: ${found.blueprint === "cart_b" ? "carro de duas rodas" : "carroça"} posta em x ${found.cart?.x}, y ${found.cart?.y} (só pela malha: pode estar sobre a estrada).`;
    }

    /** A stop that was given a place by hand (`STOPS`) goes back to it, whatever an administrator did with it since. */
    restore(id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        if (stop.fixed === undefined) {
            return `A parada de ${stop.name} não tem um lugar escolhido à mão para voltar: /viagem aqui ${stop.id} ou /viagem procurar ${stop.id}.`;
        }
        stop.place = fixedPlacement(stop.fixed);
        this.persist();
        this.refresh(stop);
        return `${stop.name}: a carroça e o cocheiro voltaram ao lugar escolhido à mão (x ${stop.fixed.cart.x}, y ${stop.fixed.cart.y}).`;
    }

    /** A new stop, where the administrator stands. */
    addStop(admin: Player, id: string, name: string): string {
        const key = id.toLowerCase();
        if (!ID.test(key)) {
            return "O nome curto da parada usa só letras minúsculas, números e hífen (2 a 24), como sedletz ou stara-kutna.";
        }
        if (this.stops.has(key)) {
            return `Já existe a parada ${key}.`;
        }
        if (name.trim() === "") {
            return "Diga também o nome que os jogadores leem: /viagem nova <id> <nome>.";
        }
        const spec: StopSpec = { id: key, name: name.trim().slice(0, 40), anchor: { x: admin.position.x, y: admin.position.y, z: admin.position.z } };
        this.added.push(spec);
        this.removed.delete(key);
        this.stops.set(key, { id: spec.id, name: spec.name, anchor: spec.anchor, place: null, cartId: 0 });
        return `Parada ${spec.name} criada. ${this.placeHere(admin, key)}`;
    }

    removeStop(id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        this.removeCart(stop);
        this.handle?.sleep(postIdOf(stop));
        const index = this.posts.findIndex((post) => post.id === postIdOf(stop));
        if (index >= 0) {
            this.posts.splice(index, 1);
        }
        this.stops.delete(stop.id);
        const added = this.added.findIndex((spec) => spec.id === stop.id);
        if (added >= 0) {
            this.added.splice(added, 1);
        } else {
            this.removed.add(stop.id);
        }
        this.persist();
        return `A parada de ${stop.name} foi tirada: sem carroça e sem cocheiro.`;
    }

    setPrices(base: number, perKm: number): string {
        if (!Number.isFinite(base) || !Number.isFinite(perKm) || base < 0 || perKm < 0 || base > 1000 || perKm > 1000) {
            return "Os preços são números de 0 a 1000: /viagem preco <base> <por km>.";
        }
        this.prices = { base, perKm };
        this.persist();
        const [a, b] = [...this.stops.values()];
        const sample = a !== undefined && b !== undefined ? ` De ${a.name} a ${b.name}: ${fareOf(kmBetween(spotOf(a), spotOf(b)), this.prices)} moedas.` : "";
        return `Preço das viagens: ${base} moedas mais ${perKm} por km.${sample}`;
    }

    goTo(admin: Player, id: string): string {
        const stop = this.named(id);
        if (typeof stop === "string") {
            return stop;
        }
        const point = stop.place?.arrive ?? pose(stop.anchor, 0);
        return admin.teleport(new Vector3(point.x, point.y, point.z)) ? `Você foi até a parada de ${stop.name}.` : "Não consegui levar você.";
    }

    lines(): string[] {
        const out = [`${this.stops.size} parada(s); preço: ${this.prices.base} moedas mais ${this.prices.perKm} por km; agora é ${this.night() ? "noite (sem viagens)" : "dia"}.`];
        for (const stop of this.stops.values()) {
            const place = stop.place;
            const cart = place?.cart;
            const where = cart ? `${place?.blueprint === "cart_b" ? "carro de duas rodas" : "carroça"} em x ${cart.x}, y ${cart.y}, giro ${cart.yaw}°${stop.cartId === 0 ? " (fora do mundo agora)" : ""}` : "sem carroça";
            const asleep = this.handle?.asleep(postIdOf(stop)) === true;
            const by = place === null ? "ainda não posta" : place.by === "admin" ? "posta por um administrador" : place.by === "estrada" ? "posta na beira da estrada, lida pelo jogo" : place.by === "fixo" ? "posta à mão, vista no World Builder" : place.by === "busca" ? "lugar achado só pela malha" : "esperando um jogador chegar perto para ler o chão";
            out.push(`  ${stop.id} (${stop.name}): ${where}; cocheiro ${asleep ? "dormindo" : "acordado"}; ${by}`);
        }
        return out;
    }
}

function spotOf(stop: Stop): { x: number; y: number } {
    return stop.place?.cart ?? stop.place?.coach ?? stop.anchor;
}

/** The place a stop was given by hand (`STOPS`), as a placement. */
export function fixedPlacement(fixed: FixedPlace): Placement {
    return { cart: fixed.cart, blueprint: fixed.blueprint ?? FOOTPRINTS[0]?.blueprint ?? "wagon_b_covered", coach: fixed.coach, arrive: fixed.arrive, by: "fixo" };
}

/** No room found yet: the coachman stands at the road point of the stop, and a traveller is put beside him. */
function fallbackOf(anchor: Spot): Placement {
    const ground = snap(anchor, 8, 6) ?? anchor;
    const coach = pose(ground, 0);
    const arrive = pose(snap({ x: ground.x + 1.5, y: ground.y + 1, z: ground.z }, 1.5, 3) ?? { x: ground.x + 1.5, y: ground.y + 1, z: ground.z }, 0);
    return { cart: null, blueprint: "", coach, arrive, by: "vila" };
}

function poseOf(raw: unknown): Pose | null {
    const value = raw as Partial<Pose> | null;
    if (value === null || typeof value !== "object") {
        return null;
    }
    const { x, y, z, yaw } = value;
    return [x, y, z, yaw].every((n) => typeof n === "number" && Number.isFinite(n)) ? { x: x as number, y: y as number, z: z as number, yaw: yaw as number } : null;
}

function placementOf(raw: unknown): Placement | null {
    const value = raw as Partial<Record<keyof Placement, unknown>> | null;
    if (value === null || typeof value !== "object") {
        return null;
    }
    const coach = poseOf(value.coach);
    const arrive = poseOf(value.arrive);
    const cart = value.cart === null ? null : poseOf(value.cart);
    const blueprint = typeof value.blueprint === "string" ? value.blueprint : "";
    const by = value.by === "admin" || value.by === "busca" || value.by === "estrada" ? value.by : null;
    if (coach === null || arrive === null || by === null || (cart === null && value.cart !== null)) {
        return null;
    }
    return { cart, blueprint, coach, arrive, by };
}

export const coaches = new Coaches();

export function installTravel(): void {
    coaches.load();
    const handle = installPosts("travel", coaches.posts, (player, post, npc) => {
        coaches.open(player, post, npc);
    });
    coaches.attach(handle);
    // A coachman keeps by his wagon: a step or two about his place, no stroll.
    installPostLife(handle, COACH_LINES, { ...postLife, roamM: 1.5 });
    setTimeout(() => coaches.place(), travelSettings.placeAfterMs);
    setTimeout(() => {
        const made = coaches.spawnCarts();
        console.log(`travel: ${made} carroça(s) de viagem no lugar`);
    }, travelSettings.cartAfterMs);
    Events.on("dialogueChoice", (session, player, option) => coaches.choose(session, player, option));
    Events.on("dialogueClosed", (session) => coaches.closed(session));
    Events.on("playerDamage", (player, attacker) => {
        if (attacker !== null) {
            coaches.hit(player);
        }
    });
    Events.on("cartDestroy", (cart) => coaches.cartGone(cart));
    Events.on("playerDisconnect", (player) => coaches.left(player));
    const timer = setInterval(() => coaches.tick(), travelSettings.tickMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            coaches.stop();
        }
    });
    console.log(`travel: ${coaches.stops.size} parada(s) de viagem de carroça (${[...coaches.stops.values()].map((stop) => stop.name).join(", ")}); preço ${coaches.prices.base} moedas mais ${coaches.prices.perKm} por km; de noite o cocheiro vai dormir e não há viagem`);
}
