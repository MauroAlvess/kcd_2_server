/**
 * The invisible walls that stay where a door was taken out (2026-10-27, user: "mesmo removendo essas portas estáticas fica uma parede invisível, preciso que retire").
 *
 * The user took static doors, gates, a wagon and a fence out of the map with the World Builder (`worlds/portas-removidas.world.json`), and where a door stood the level
 * often has a collision-only box of its own that nobody sees (a designer's brush made of `mat_level_barrier`), so the opening stayed shut. Such a box has no name the
 * server can read offline (the engine knows it by a GUID of the designer's tool), but a player's own game does: it traces what is in the way and names it
 * (`World.raycastAll`, the same trace `/objeto parede` uses at Malešov's gate). So each place a door was taken out of is a **site**: the first time a player who is
 * near it can answer, a fan of rays runs through it, and whatever is made of a surface that is never drawn, within a few metres of the door's place, is taken out of the map
 * for everybody (`hideWallObject`: kept in `level-edits.json`, applied again at every boot). A site is looked at once and remembered (`playerdata/wall-sites.json`);
 * `/objeto portas` looks again at the sites near an administrator, as many times as they ask.
 *
 * A look also says what it saw near the door and how far, and which of the objects the world export took out the game *still* hits there ("AINDA LÁ"): the user's World
 * Builder hid them, the guide says collision goes with them, and yet the first looks (23:05 UTC) hit `gate_a_doors` and both pieces of a hidden door at the very place of
 * the hidden ones. So every object the export took out is also moved far under the ground and made tiny (`pushAside`: the same edit restated, as the guide describes, "collision
 * included"), once at the first sweep of every boot and again for one a look finds still there. It worked (user, the same night: "deu certo agora a remoção ... essa ideia de
 * jogar embaixo da terra foi top ... faça o mesmo em Malešov e Raborsch"), so the pushing covers every brush any world export hides (Raborsch's 43 among them: the barrels, the
 * stove, the coffin lids, the bushes, Malešov's four hooks), the saved list gets it in `level-edits.ts`, and Raborsch's and Malešov's gates are two more places to look at
 * (`EXTRA_SPOTS`: the invisible walls of their gates, which no World Builder export names).
 */

import { BLOCKER_NAME, hideWallObject, judgeHit, sunkBrush } from "./level-edits.js";
import type { WallObject } from "./level-edits.js";
import { ensureDir, read, write } from "./store.js";

const FILE = "playerdata/wall-sites.json";

/** The world exports whose hidden objects mark a place to look at (by the file's name without `.world.json`). */
export const SITE_WORLDS: readonly string[] = ["portas-removidas"];

export const siteScan = {
    /** How far from the door's place a wall still counts as its own, in metres. */
    reachM: 4,
    /** A site is looked at when a player is this near (the game streams the geometry that far), and no higher or lower than this. */
    nearM: 40,
    nearUpM: 20,
    /** The sweep for a player to start a look, and how long a look that found no geometry waits before the next try. */
    everyMs: 10_000,
    retryMs: 60_000,
    /** More walls than this in one doorway means something else is being hit: nothing is taken out. */
    maxHides: 6,
    /** Rays through the site: this many headings over half a turn (each runs out the other side), at these heights over the door's place. */
    headings: 12,
    heights: [0.5, 1.4, 2.3] as readonly number[],
    /** Two doors this near are one site (a door and its doorway are taken out at the same place). */
    mergeM: 2.5,
    /** An object hit with its pivot this near a hidden one's is that one (the game matches within 5 cm). */
    samePivotM: 0.15,
};

export interface Site {
    readonly key: string;
    /** What the user took out there, the mesh's own name. */
    readonly label: string;
    readonly at: readonly [number, number, number];
}

export interface Look {
    /** Whether the player's game answered at all, and whether it had any geometry to trace (a player too far for the game to have it streamed finds none). */
    readonly answered: boolean;
    readonly hits: number;
    /** The walls taken out now (or already out), what was seen and left alone, and what the engine records no name for. */
    readonly hidden: readonly WallObject[];
    /** What the game said each of them was made of, for the log (`mat_level_barrier` is the designers' invisible wall). */
    readonly notes: readonly string[];
    /** What was seen near the door and left alone (a picture, a use), nearest first, with how far each is from the door's place; `still` marks an object the export took out. */
    readonly near: readonly Near[];
    readonly unnamed: readonly string[];
    readonly refused: string;
    /** How many objects the export took out were hit again at their own place, and how many of them were pushed aside again by this look. */
    readonly still: number;
    readonly pushed: number;
}

export interface Near {
    readonly text: string;
    readonly away: number;
    readonly still: boolean;
}

/**
 * Places that are looked at like a door's, though no export hides anything there: the invisible walls of the castle gates. Raborsch's is the layer `gateBarrier_42dacb18` (a designer's
 * brush of `mat_level_barrier` at 1421.851 3856.331 118.024 in the level's physics data, the leaves of the gate at 1423.6 and 1425.1), Malešov's the two designer blockers and the
 * two leaves the saved list takes out already (489.6 399.9, 493.7 397.1, 490.1 398.6, 492.5 396.5). The engine's name of such a box is known only to a player's game.
 */
export const EXTRA_SPOTS: readonly Site[] = [
    { key: "portao-de-raborsch", label: "Portão de Raborsch", at: [1422.8, 3856.4, 118.0] },
    { key: "portao-de-malesov", label: "Portão de Malešov", at: [491.5, 398.0, 109.8] },
];

/** One brush a world export took out, as its level edit says it. */
export interface Removed {
    readonly name: string;
    readonly at: readonly [number, number, number];
}

interface Done {
    readonly at: number;
    readonly hidden: number;
}

let done: Record<string, Done> | null = null;
let cached: Site[] | null = null;
let removed: Removed[] = [];
let pushedAtBoot = false;
const retryAt = new Map<string, number>();
let looking = false;

const baseName = (name: string): string => name.replace(/\\/g, "/").split("/").pop()?.replace(/\.cgf$/i, "") ?? "";
const keyOf = (name: string, at: readonly number[]): string => `${baseName(name).toLowerCase()}@${at.map((n) => n.toFixed(1)).join(",")}`;

function remembered(): Record<string, Done> {
    if (done !== null) {
        return done;
    }
    done = {};
    const loaded = read<{ v?: unknown; done?: unknown }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value === "object" && loaded.value !== null && typeof loaded.value.done === "object" && loaded.value.done !== null) {
        for (const [key, value] of Object.entries(loaded.value.done as Record<string, unknown>)) {
            const row = value as Partial<Done> | null;
            if (typeof row === "object" && row !== null && typeof row.at === "number" && typeof row.hidden === "number") {
                done[key] = { at: row.at, hidden: row.hidden };
            }
        }
    }
    return done;
}

function remember(key: string, hidden: number): void {
    remembered()[key] = { at: Date.now(), hidden };
    try {
        ensureDir("playerdata");
        write(FILE, { v: 1, done: remembered() });
    } catch (error: unknown) {
        console.log(`wall-sites: não consegui guardar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * The places to look at: where the listed worlds took a brush out, one per door (two taken out within `mergeM` of each other are one), and `EXTRA_SPOTS`. Every brush any world hides
 * is also noted for the push. Empty until the worlds have loaded.
 */
export function sites(): Site[] {
    if (cached !== null) {
        return cached;
    }
    if (typeof WorldResource === "undefined" || !WorldResource.ready) {
        return [];
    }
    const out: Site[] = [];
    const every: Removed[] = [];
    try {
        for (const world of WorldResource.all()) {
            const marks = SITE_WORLDS.includes(world.name);
            for (const edit of world.levelEdits) {
                const definition = edit.toJSON();
                if (definition === null || definition.kind === "entity" || definition.hidden !== true || !Array.isArray(definition.at) || definition.at.length !== 3 || typeof definition.name !== "string") {
                    continue;
                }
                const at: [number, number, number] = [Number(definition.at[0]), Number(definition.at[1]), Number(definition.at[2])];
                if (at.every(Number.isFinite)) {
                    every.push({ name: definition.name, at });
                }
                if (!marks || !at.every(Number.isFinite) || out.some((site) => Math.hypot(site.at[0] - at[0], site.at[1] - at[1], site.at[2] - at[2]) <= siteScan.mergeM)) {
                    continue;
                }
                out.push({ key: keyOf(definition.name, at), label: baseName(definition.name), at });
            }
        }
    } catch {
        // A resource that cannot be read marks no site.
    }
    out.push(...EXTRA_SPOTS);
    cached = out;
    removed = every;
    return out;
}

/** Puts an object the export took out far under the ground and makes it tiny, over the edit that hides it: the same edit restated (no second one), with its collision if the game moves that. */
export function pushAside(object: Removed): boolean {
    try {
        LevelEdit.apply(sunkBrush(object.name, object.at));
        return true;
    } catch (error: unknown) {
        console.log(`wall-sites: não consegui pôr ${baseName(object.name)} de lado: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** Once per boot, when the worlds have loaded: every brush any world export took out is pushed aside. How many. */
export function pushAllAside(): number {
    if (pushedAtBoot || sites().length === 0) {
        return 0;
    }
    pushedAtBoot = true;
    const done = removed.filter(pushAside).length;
    console.log(`wall-sites: ${done} de ${removed.length} objeto(s) que os mundos exportados tiraram foram postos 300 m abaixo da terra, pequenos, por cima do que os esconde`);
    return done;
}

/** Whether a hit object is one of those the export took out: the same mesh with its pivot where the hidden one's is. */
function isRemoved(name: string, pivot: { readonly x: number; readonly y: number; readonly z: number }): Removed | undefined {
    const base = baseName(name).toLowerCase();
    return removed.find((one) => baseName(one.name).toLowerCase() === base && Math.hypot(one.at[0] - pivot.x, one.at[1] - pivot.y, one.at[2] - pivot.z) <= siteScan.samePivotM);
}

/** The rays of a look: through the door's place, out both sides, at the heights of a knee, a chest and a raised hand. */
function raysOf(site: Site): Array<readonly [Vector3, Vector3]> {
    const rays: Array<readonly [Vector3, Vector3]> = [];
    for (const height of siteScan.heights) {
        for (let step = 0; step < siteScan.headings; step += 1) {
            const angle = (step * Math.PI) / siteScan.headings;
            const dx = Math.cos(angle) * siteScan.reachM;
            const dy = Math.sin(angle) * siteScan.reachM;
            const z = site.at[2] + height;
            rays.push([new Vector3(site.at[0] - dx, site.at[1] - dy, z), new Vector3(site.at[0] + dx, site.at[1] + dy, z)]);
        }
    }
    return rays;
}

const near = (site: Site, x: number, y: number, z: number): boolean => Math.hypot(x - site.at[0], y - site.at[1]) <= siteScan.reachM + 0.75 && Math.abs(z - site.at[2]) <= 5;

/**
 * Looks at one site with a player's game: what is only collision within reach of the door's place is taken out (`by` is written in the list). The look is not final when the game
 * did not answer or found nothing at all to trace.
 */
export async function lookAt(player: Player, site: Site, by: string): Promise<Look> {
    const centre = new Vector3(site.at[0], site.at[1], site.at[2] + 1);
    const [traces, around] = await Promise.all([
        Promise.all(raysOf(site).map(([from, to]) => World.raycastAll(player, from, to, { mode: "anything", maxHits: 8 }))),
        World.entitiesInRadius(player, centre, siteScan.reachM + 1, { class: "GeomEntity", max: 32, physicalOnly: true }),
    ]);
    const found = new Map<string, WallObject>();
    const notes = new Map<string, string>();
    const seen = new Map<string, Near>();
    const stillThere = new Map<string, Removed>();
    const unnamed = new Map<string, string>();
    let hits = 0;
    for (const trace of traces) {
        for (const hit of trace.hits) {
            hits += 1;
            if (!near(site, hit.position.x, hit.position.y, hit.position.z)) {
                continue;
            }
            const verdict = judgeHit(hit);
            if (verdict.act === "hide") {
                const key = verdict.object.kind === "entity" ? `entity:${verdict.object.guid}` : `${verdict.object.name.toLowerCase()}@${verdict.object.at.map((n) => n.toFixed(2)).join(",")}`;
                found.set(key, verdict.object);
                notes.set(key, hit.surface || "?");
            } else if (verdict.act === "unnamed") {
                unnamed.set(`${Math.round(hit.position.x)}|${Math.round(hit.position.y)}|${Math.round(hit.position.z)}`, `${hit.position.x.toFixed(1)} ${hit.position.y.toFixed(1)} ${hit.position.z.toFixed(1)} (${hit.surface || "?"})`);
            } else if (hit.kind !== "terrain") {
                const object = hit.levelObject;
                const what = object?.name || hit.model || hit.entityName || hit.entityClass || hit.kind;
                const short = what.split("/").slice(-1)[0] ?? what;
                const gone = object !== null && object.kind === "brush" ? isRemoved(object.name, object.at) : undefined;
                if (gone !== undefined) {
                    stillThere.set(`${baseName(gone.name)}@${gone.at.map((n) => n.toFixed(1)).join(",")}`, gone);
                }
                const away = Math.hypot(hit.position.x - site.at[0], hit.position.y - site.at[1], hit.position.z - site.at[2]);
                const pivot = object === null ? "" : ` [${object.at.x.toFixed(1)} ${object.at.y.toFixed(1)} ${object.at.z.toFixed(1)}]`;
                const key = `${short}${pivot}`;
                const known = seen.get(key);
                if (known === undefined || away < known.away) {
                    seen.set(key, { text: `${short}${pivot} (${hit.surface || "?"}) a ${away.toFixed(1)} m${gone !== undefined ? " AINDA LÁ" : ""}`, away, still: gone !== undefined });
                }
            }
        }
    }
    for (const entity of around.entities) {
        if (entity.guid !== null && BLOCKER_NAME.test(entity.name) && near(site, entity.position.x, entity.position.y, entity.position.z)) {
            found.set(`entity:${entity.guid}`, { kind: "entity", name: entity.name, guid: entity.guid, at: [entity.position.x, entity.position.y, entity.position.z] });
        }
    }
    const answered = traces.some((trace) => trace.answered) || around.answered;
    const nearest = [...seen.values()].sort((a, b) => a.away - b.away).slice(0, 8);
    const unseen = [...unnamed.values()].slice(0, 4);
    const pushed = [...stillThere.values()].filter(pushAside).length;
    if (found.size > siteScan.maxHides) {
        return { answered, hits, hidden: [], notes: [], near: nearest, unnamed: unseen, refused: `${found.size} coisas só de colisão: parece demais para uma porta, nada foi tirado`, still: stillThere.size, pushed };
    }
    const hidden: WallObject[] = [];
    const surfaces: string[] = [];
    for (const [key, object] of found) {
        if (hideWallObject(object, by).ok) {
            hidden.push(object);
            surfaces.push(notes.get(key) ?? "?");
        }
    }
    return { answered, hits, hidden, notes: surfaces, near: nearest, unnamed: unseen, refused: "", still: stillThere.size, pushed };
}

/** What a look says, for the log and for an administrator. */
export function describe(site: Site, look: Look): string {
    const where = `${site.label} em ${site.at.map((n) => n.toFixed(1)).join(" ")}`;
    if (!look.answered) {
        return `${where}: o jogo não respondeu`;
    }
    if (look.hits === 0) {
        return `${where}: o jogo não tinha nada para traçar aqui (longe demais?)`;
    }
    const parts: string[] = [];
    if (look.still > 0) {
        parts.push(`ATENÇÃO: ${look.still} objeto(s) que o mundo tirou ainda é(são) acertado(s) aqui, no mesmo lugar (empurrei de novo para baixo da terra: ${look.pushed})`);
    }
    if (look.hidden.length > 0) {
        parts.push(`tirei ${look.hidden.length} parede(s) invisível(is): ${look.hidden.map((one, index) => `${one.name === "" ? one.guid : one.name.split("/").slice(-1)[0]} [${look.notes[index] ?? "?"}]`).join(", ")}`);
    } else {
        parts.push(look.refused !== "" ? look.refused : "nenhuma parede invisível por aqui");
    }
    if (look.near.length > 0) {
        parts.push(`perto da porta, com desenho (deixei): ${look.near.map((one) => one.text).join("; ")}`);
    }
    if (look.unnamed.length > 0) {
        parts.push(`sem nome no mapa (não dá para tirar por nome): ${look.unnamed.join("; ")}`);
    }
    return `${where}: ${parts.join(" | ")}`;
}

/** A look that counts: the game answered and traced something. Remembered, so the site is not looked at again by itself. */
function settle(site: Site, look: Look): boolean {
    if (!look.answered || look.hits === 0) {
        retryAt.set(site.key, Date.now() + siteScan.retryMs);
        return false;
    }
    remember(site.key, look.hidden.length);
    return true;
}

/** Looks at every site within `metres` of an administrator (nearest first, at most six), whatever was remembered, and says what each had. */
export async function lookAround(player: Player, metres: number): Promise<string[]> {
    const position = player.position;
    const all = sites();
    if (all.length === 0) {
        return ["Nenhuma porta tirada do mapa por um mundo exportado (ainda carregando?)."];
    }
    const mine = all
        .map((site) => ({ site, distance: Math.hypot(site.at[0] - position.x, site.at[1] - position.y) }))
        .filter((one) => one.distance <= metres && Math.abs(one.site.at[2] - position.z) <= 40)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6);
    if (mine.length === 0) {
        const nearest = all.map((site) => Math.hypot(site.at[0] - position.x, site.at[1] - position.y)).sort((a, b) => a - b)[0] ?? 0;
        return [`Nenhuma porta tirada do mapa a até ${metres} m de você (a mais perto está a ${Math.round(nearest)} m).`];
    }
    const lines: string[] = [];
    for (const { site } of mine) {
        const look = await lookAt(player, site, player.nickname);
        settle(site, look);
        const line = describe(site, look);
        console.log(`wall-sites: ${player.nickname} pediu: ${line}`);
        lines.push(line);
    }
    return lines;
}

/** The sites and whether each has been looked at, for an administrator. */
export function listSites(): string[] {
    const all = sites();
    if (all.length === 0) {
        return ["Nenhuma porta tirada do mapa por um mundo exportado (ainda carregando?)."];
    }
    const state = remembered();
    return all.map((site, index) => {
        const row = state[site.key];
        return `${index + 1}. ${site.label} em ${site.at.map((n) => n.toFixed(1)).join(" ")}: ${row === undefined ? "ainda não olhada" : `olhada${row.hidden > 0 ? `, ${row.hidden} parede(s) tirada(s)` : ", nada a tirar"}`}`;
    });
}

/** One sweep: the nearest site not yet looked at that a player who can answer is near is looked at with that player's game. At most one look at a time. */
export async function sweep(): Promise<void> {
    if (looking) {
        return;
    }
    const all = sites();
    pushAllAside();
    const state = remembered();
    const now = Date.now();
    const pending = all.filter((site) => state[site.key] === undefined && (retryAt.get(site.key) ?? 0) <= now);
    if (pending.length === 0) {
        return;
    }
    for (const player of Player.all()) {
        if (!player.ready || !player.alive) {
            continue;
        }
        const position = player.position;
        const site = pending
            .filter((one) => Math.hypot(one.at[0] - position.x, one.at[1] - position.y) <= siteScan.nearM && Math.abs(one.at[2] - position.z) <= siteScan.nearUpM)
            .sort((a, b) => Math.hypot(a.at[0] - position.x, a.at[1] - position.y) - Math.hypot(b.at[0] - position.x, b.at[1] - position.y))[0];
        if (site === undefined) {
            continue;
        }
        looking = true;
        try {
            const look = await lookAt(player, site, "servidor");
            const final = settle(site, look);
            console.log(`wall-sites: ${player.nickname} estava perto${final ? "" : " (não conta, vai tentar de novo)"}: ${describe(site, look)}`);
        } catch (error: unknown) {
            retryAt.set(site.key, Date.now() + siteScan.retryMs);
            console.log(`wall-sites: não consegui olhar ${site.label}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            looking = false;
        }
        return;
    }
}

export function installWallSites(): void {
    setInterval(() => {
        void sweep();
    }, siteScan.everyMs);
}
