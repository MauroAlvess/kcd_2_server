/**
 * The level's own objects taken out of the world for everybody (`LevelEdit`): static gates the game never opens, fences, rubble.
 *
 * It began with Malešov's front gate, two leaves of beams the level has shut for good (2026-10-18: "o portão de maleshov está
 * fechado, o portão da ponte, temos como abrir?"): the KCDC guide itself takes its left leaf out as its example, with the place
 * the level puts it, so that one goes on any server that has no list yet. Anything else, the right leaf included, an
 * administrator takes out with `/objeto esconder`, from the mesh and the place the World Builder shows for it (its "Copy selection
 * as API calls" line can be pasted whole). The server keeps no edit past a restart, so the list is saved
 * (`playerdata/level-edits.json`) and applied again on every boot.
 *
 * A brush taken out is not only hidden: it is put far under the ground and made tiny (`sunkBrush`). A hidden brush kept its collision in the game (2026-10-27: the players' rays
 * still hit the doors the user's World Builder had hidden, and a player walked into an invisible wall at them, though the KCDC guide says collision goes with an object taken
 * out); restated as moved 300 m down and shrunk to a hundredth, the same objects stopped being hit (user: "essa ideia de jogar embaixo da terra foi top"). That is what Malešov's
 * gate (its leaves and the two designer blockers, kept in the list) and every `/objeto esconder` get now.
 */

import { ensureDir, read, write } from "./store.js";

const FILE = "playerdata/level-edits.json";

export interface SavedEdit {
    /** A brush's mesh (`objects/...cgf`), or empty for a level entity. */
    readonly name: string;
    /** A level entity's EntityGuid (sixteen hex digits), or empty for a brush. */
    readonly guid: string;
    /** Where the level put the brush, matched by every client within 5 cm. Unused for an entity. */
    readonly at: readonly [number, number, number];
    /** What it is, for the list. */
    readonly label: string;
    readonly by: string;
    readonly when: number;
}

/** What is taken out on a server with no list yet: the left leaf of Malešov's front gate, where the KCDC guide puts it. */
export const DEFAULT_EDITS: readonly SavedEdit[] = [
    { name: "objects/manmade/structures/logistical/gate/gate_beams_a_door_left.cgf", guid: "", at: [490.09, 398.59, 109.8], label: "Portão de Malešov, folha esquerda", by: "servidor", when: 0 },
];

/**
 * What the server always takes out, wherever the list stands: the invisible walls of the castle gates. A gate's leaves are drawn
 * open or shut (`gate.ts`, `gate-guard.ts`), but the wall that keeps a player out of the shut gate is a clip volume of the level
 * (`brush/clipvolume_N.cgf`, no picture, only collision) that its layer switches on with the shut leaves, and the game switches it
 * on again over leaves drawn open (user, 2026-10-20: "o fechar e abrir portão de castelo deve remover a parede invisível também").
 * A shut gate is stopped by its own leaves; the wall is only ever in the way of an open one, so it goes for good. Raborsch's is the
 * layer `gateBarrier_42dacb18` of the fortress gate: one brush, the clip volume 381, put at the layer's own position (read from the
 * layer's data in `level.pak`). The engine may call the mesh by its short or its long path, so both are asked; one that finds nothing
 * does nothing. `/objeto sondar` shows what stands in a player's way, for the walls of the other gates.
 */
export interface Ensured {
    readonly label: string;
    readonly names: readonly string[];
    readonly at: readonly [number, number, number];
}

export const ENSURED_EDITS: readonly Ensured[] = [
    { label: "Parede invisível do portão de Raborsch", names: ["brush/clipvolume_381.cgf", "levels/kutnohorsko/brush/clipvolume_381.cgf"], at: [1421.851, 3856.331, 118.024] },
];

/** How an object taken out is kept out: this far under its place, and this small (a scale cannot go under 0.01). */
export const SINK = { depthM: 300, scale: 0.01 };

/** The edit that takes a brush out: hidden, and put under the ground, tiny (`SINK`). Restated over an edit that already hides it, it changes that one and makes no second. */
export function sunkBrush(name: string, at: readonly number[]): { readonly kind: "brush"; readonly name: string; readonly at: Vector3; readonly hidden: true; readonly position: Vector3; readonly scale: Vector3 } {
    const [x = 0, y = 0, z = 0] = at;
    return { kind: "brush", name, at: new Vector3(x, y, z), hidden: true, position: new Vector3(x, y, z - SINK.depthM), scale: new Vector3(SINK.scale, SINK.scale, SINK.scale) };
}

/** How near two places are the same one. */
const SAME_PLACE_M = 0.5;

let saved: SavedEdit[] | null = null;
/** The live edits, by the key of what they take out. */
const live = new Map<string, LevelEdit>();

const keyOf = (edit: SavedEdit): string => (edit.guid !== "" ? `entity:${edit.guid}` : `${edit.name.toLowerCase()}@${edit.at.map((n) => n.toFixed(2)).join(",")}`);

function isSaved(value: unknown): value is SavedEdit {
    const edit = value as Partial<SavedEdit> | null;
    return (
        typeof edit === "object" &&
        edit !== null &&
        typeof edit.name === "string" &&
        typeof edit.guid === "string" &&
        Array.isArray(edit.at) &&
        edit.at.length === 3 &&
        edit.at.every((n) => typeof n === "number" && Number.isFinite(n)) &&
        (edit.name !== "" || /^[0-9a-f]{16}$/.test(edit.guid))
    );
}

function load(): SavedEdit[] {
    if (saved !== null) {
        return saved;
    }
    const result = read<unknown>(FILE);
    if (result.status === "ok" && Array.isArray(result.value)) {
        saved = result.value.filter(isSaved).map((edit) => ({ ...edit, label: typeof edit.label === "string" ? edit.label : "", by: typeof edit.by === "string" ? edit.by : "", when: typeof edit.when === "number" ? edit.when : 0 }));
    } else if (result.status === "corrupt") {
        // Something is there and none of it reads: nothing is applied, and nothing is written over it.
        console.error(`level-edits: ${result.reason}; nada foi tirado do mapa`);
        saved = [];
        return saved;
    } else {
        saved = [...DEFAULT_EDITS];
        persist();
    }
    return saved;
}

function persist(): void {
    ensureDir("playerdata");
    write(FILE, saved ?? []);
}

function applyOne(edit: SavedEdit): boolean {
    try {
        const made = LevelEdit.apply(edit.guid !== "" ? { kind: "entity", guid: edit.guid, at: new Vector3(edit.at[0], edit.at[1], edit.at[2]), hidden: true } : sunkBrush(edit.name, edit.at));
        live.set(keyOf(edit), made);
        return true;
    } catch (error: unknown) {
        console.error(`level-edits: não consegui tirar ${edit.label || edit.name || edit.guid}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** What a line names: a mesh and three numbers (as typed, or the World Builder's copied call pasted whole), or an entity's GUID. */
export function parseObject(text: string): { readonly name: string; readonly guid: string; readonly at: [number, number, number] } | null {
    const mesh = /[A-Za-z0-9_/.\\-]+\.cgf/i.exec(text);
    if (mesh !== null) {
        // Numbers standing on their own: not the 3 of the pasted "new Vector3(".
        const numbers = text.slice(mesh.index + mesh[0].length).match(/(?<![A-Za-z0-9_.])-?\d+(?:\.\d+)?/g) ?? [];
        const at = numbers.slice(0, 3).map(Number);
        if (at.length < 3 || !at.every(Number.isFinite)) {
            return null;
        }
        return { name: mesh[0].replace(/\\/g, "/").toLowerCase(), guid: "", at: [at[0]!, at[1]!, at[2]!] };
    }
    const guid = /\b(?:0x)?([0-9a-fA-F]{16})\b/.exec(text.replace(/-/g, ""));
    return guid === null ? null : { name: "", guid: guid[1]!.toLowerCase(), at: [0, 0, 0] };
}

/** Takes an edit out of the world for everybody and keeps it in the list. */
function addEdit(edit: SavedEdit, by: string): { readonly ok: boolean; readonly message: string } {
    const list = load();
    if (list.some((one) => keyOf(one) === keyOf(edit))) {
        return { ok: true, message: `${edit.label} já estava fora do mapa.` };
    }
    if (!applyOne(edit)) {
        return { ok: false, message: "O servidor recusou esse objeto." };
    }
    list.push(edit);
    persist();
    console.log(`level-edits: ${by} tirou do mapa ${edit.label} (${edit.name || edit.guid} em ${edit.at.join(", ")})`);
    return { ok: true, message: `${edit.label} saiu do mapa para todos (nº ${list.length}). Quem estiver longe vê sumir ao chegar perto.` };
}

/** Takes an object of the level out of the world for everybody, now and after every restart. */
export function hideObject(text: string, label: string, by: string): { readonly ok: boolean; readonly message: string } {
    const object = parseObject(text);
    if (object === null) {
        return { ok: false, message: "Não entendi o objeto: escreva a malha .cgf e a posição (x y z), ou cole a linha que o World Builder copia." };
    }
    return addEdit({ ...object, label: label || object.name.split("/").pop() || object.guid, by, when: Date.now() }, by);
}

/** Puts back the object number `n` of the list (1-based). */
export function restoreObject(n: number, by: string): { readonly ok: boolean; readonly message: string } {
    const list = load();
    const edit = list[n - 1];
    if (edit === undefined) {
        return { ok: false, message: `Não há objeto nº ${n}. /objeto mostra a lista.` };
    }
    live.get(keyOf(edit))?.restore();
    live.delete(keyOf(edit));
    list.splice(n - 1, 1);
    persist();
    console.log(`level-edits: ${by} devolveu ao mapa ${edit.label}`);
    return { ok: true, message: `${edit.label} voltou ao mapa.` };
}

/** The list, numbered, for `/objeto`. */
export function listObjects(): string[] {
    return load().map((edit, index) => `${index + 1}. ${edit.label} -- ${edit.name || edit.guid}${edit.guid === "" ? ` em ${edit.at.join(", ")}` : ""} (${edit.by})`);
}

/** What a line of the world resources already takes out, as `LevelEdit.toJSON` says it (a brush's mesh and place). */
function heldByWorlds(): Array<{ readonly name: string; readonly at: readonly number[] }> {
    const out: Array<{ readonly name: string; readonly at: readonly number[] }> = [];
    if (typeof WorldResource === "undefined") {
        return out;
    }
    try {
        for (const world of WorldResource.all()) {
            for (const edit of world.levelEdits) {
                const definition = edit.toJSON();
                if (definition !== null && Array.isArray(definition.at) && typeof definition.name === "string") {
                    out.push({ name: definition.name, at: definition.at as number[] });
                }
            }
        }
    } catch {
        // A resource that cannot be read holds nothing for this purpose.
    }
    return out;
}

const baseName = (name: string): string => name.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";

/**
 * Takes out what `ENSURED_EDITS` lists, once the world exports have loaded (an export that takes the same object out is left to do
 * it: two resources editing one object make the server refuse to start). Returns how many it applied.
 */
export function applyEnsured(): number {
    const list = load();
    const held = heldByWorlds();
    let applied = 0;
    for (const item of ENSURED_EDITS) {
        const taken = held.some((edit) => item.names.some((name) => baseName(name) === baseName(edit.name)) && Math.hypot(edit.at[0]! - item.at[0], edit.at[1]! - item.at[1], (edit.at[2] ?? 0) - item.at[2]) <= SAME_PLACE_M);
        if (taken) {
            console.log(`level-edits: ${item.label} já sai do mapa por um mundo exportado`);
            continue;
        }
        for (const name of item.names) {
            const edit: SavedEdit = { name, guid: "", at: item.at, label: item.label, by: "servidor", when: 0 };
            if (list.some((one) => keyOf(one) === keyOf(edit)) || live.has(keyOf(edit))) {
                continue;
            }
            if (applyOne(edit)) {
                applied += 1;
            }
        }
    }
    if (applied > 0) {
        console.log(`level-edits: ${applied} parede(s) invisível(is) de portão tirada(s) do mundo: ${ENSURED_EDITS.map((item) => item.label).join("; ")}`);
    }
    return applied;
}

/** One hit of a probe, as a line for the administrator: what it is (a tree or a rock, when the game says so), by which name the level knows it, how far, where. */
export function describeHit(hit: { readonly kind: string; readonly category?: string | null; readonly model: string | null; readonly entityGuid: string | null; readonly entityName: string | null; readonly entityClass: string | null; readonly surface: string; readonly distance: number; readonly position: { readonly x: number; readonly y: number; readonly z: number } }): string {
    const what = [hit.entityClass, hit.entityName, hit.model].filter((part): part is string => typeof part === "string" && part !== "").join(" · ") || "sem nome";
    const guid = hit.entityGuid !== null && hit.entityGuid !== "" ? ` · guid ${hit.entityGuid}` : "";
    const at = `${hit.position.x.toFixed(2)} ${hit.position.y.toFixed(2)} ${hit.position.z.toFixed(2)}`;
    const kind = typeof hit.category === "string" && hit.category !== "" ? `${hit.kind}/${hit.category}` : hit.kind;
    return `${kind} (${hit.surface || "?"}): ${what}${guid} · a ${hit.distance.toFixed(1)} m, em ${at}`;
}

/**
 * What stands in front of a player, a few metres off, as the game's own client sees it: along where they look (the head's direction, up or
 * down as it is turned), and straight ahead at the height of the chest and of the knees, so a low rock is found as well as a wall (2026-10-21:
 * the chest-high ray alone found the user's trees and none of their rocks). The walls it cannot see (clip volumes have no mesh to draw) are
 * told by their kind and name. For finding the invisible wall of a gate (`/objeto esconder` with a guid or with the mesh and place), and what
 * the game calls a tree or a rock (`/coleta sondar`).
 */
export async function probeAhead(player: Player, yawDegrees: number, metres = 8): Promise<string[]> {
    const yaw = (yawDegrees * Math.PI) / 180;
    const base = player.position;
    const rays: Array<readonly [Vector3, Vector3]> = [];
    const look = player.lookDirection;
    const length = look ? Math.hypot(look.x, look.y, look.z) : 0;
    if (length > 0.1) {
        const eye = new Vector3(base.x, base.y, base.z + 1.6);
        rays.push([eye, new Vector3(eye.x + (look.x / length) * metres, eye.y + (look.y / length) * metres, eye.z + (look.z / length) * metres)]);
    }
    for (const height of [1.2, 0.5]) {
        const from = new Vector3(base.x, base.y, base.z + height);
        rays.push([from, new Vector3(from.x - Math.sin(yaw) * metres, from.y + Math.cos(yaw) * metres, from.z)]);
    }
    const traces = await Promise.all(rays.map(([from, to]) => World.raycastAll(player, from, to, { mode: "anything", maxHits: 8 })));
    if (traces.every((trace) => !trace.answered)) {
        return [`O seu jogo não respondeu (${traces[0]?.reason || "sem motivo"}).`];
    }
    const lines: string[] = [];
    const seen = new Set<string>();
    for (const trace of traces) {
        for (const hit of trace.hits) {
            const key = `${hit.kind}|${hit.model ?? ""}|${hit.entityGuid ?? ""}|${Math.round(hit.position.x)}|${Math.round(hit.position.y)}`;
            if (!seen.has(key)) {
                seen.add(key);
                lines.push(describeHit(hit));
            }
        }
    }
    return lines.length === 0 ? [`Nada na frente, até ${metres} m.`] : lines;
}

/**
 * A mesh that is only collision, nothing drawn: a designer box (`levels/kutnohorsko/Brush/designer_<guid>.cgf`, how the level names the
 * invisible blockers at Malešov's gate, which the World Builder gave) or a baked clip volume (`brush/clipvolume_<n>.cgf`).
 */
const COLLISION_MESH = /(?:^|\/)(?:designer_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|clipvolume_\d+)\.cgf$/i;
/** A level entity that is only a blocker, by the name the level gives it (or a surface that is never drawn). */
export const BLOCKER_NAME = /designer|clip|block|barrier|invisible|collision|nodraw/i;
/**
 * The surfaces the game gives its collision-only meshes, read out of the materials the designers' boxes carry: `materials/special/collision_proxy_level_barrier` is `mat_level_barrier`
 * (the invisible walls, Malešov's gate among them) and `collision_proxy_material` is `mat_nodraw_designer` (2026-10-27). Whatever is made of one of them has no picture.
 */
export const INVISIBLE_SURFACE = /nodraw|level_barrier|collision_proxy/i;

/** An object of the level a wall hunt means to take out, in the form `LevelEdit.apply` finds it by. */
export interface WallObject {
    readonly kind: "brush" | "entity";
    readonly name: string;
    readonly guid: string;
    readonly at: readonly [number, number, number];
}

export type WallVerdict = { readonly act: "hide"; readonly object: WallObject } | { readonly act: "unnamed" } | { readonly act: "leave" };

/**
 * What a hit of a trace is for a wall hunt: a collision-only brush or a blocker entity of the level (taken out), static geometry the engine
 * records no source for (nothing can be done by name), or anything with a picture, a body or a use (left alone).
 */
export function judgeHit(hit: {
    readonly kind: string;
    readonly surface: string;
    readonly entityClass: string | null;
    readonly levelObject: { readonly kind: "brush" | "entity"; readonly name: string; readonly guid?: string | undefined; readonly at: { readonly x: number; readonly y: number; readonly z: number } } | null;
}): WallVerdict {
    const object = hit.levelObject;
    if (object === null) {
        return hit.kind === "static" ? { act: "unnamed" } : { act: "leave" };
    }
    const at: [number, number, number] = [object.at.x, object.at.y, object.at.z];
    const nodraw = INVISIBLE_SURFACE.test(hit.surface);
    if (object.kind === "brush") {
        return COLLISION_MESH.test(object.name) || nodraw ? { act: "hide", object: { kind: "brush", name: object.name, guid: "", at } } : { act: "leave" };
    }
    const guid = object.guid ?? "";
    if (/^[0-9a-f]{16}$/.test(guid) && hit.entityClass === "GeomEntity" && (BLOCKER_NAME.test(object.name) || nodraw)) {
        return { act: "hide", object: { kind: "entity", name: object.name, guid, at } };
    }
    return { act: "leave" };
}

/** Takes one object of the level out of the world for everybody and keeps it in the list (unless a world export already takes it out). */
export function hideWallObject(object: WallObject, by: string): { readonly ok: boolean; readonly message: string } {
    const short = object.name.split("/").pop() || object.guid;
    const label = `Parede invisível ${short}`;
    if (object.kind === "brush") {
        const held = heldByWorlds().some((edit) => baseName(edit.name) === baseName(object.name) && Math.hypot(edit.at[0]! - object.at[0], edit.at[1]! - object.at[1], (edit.at[2] ?? 0) - object.at[2]) <= SAME_PLACE_M);
        if (held) {
            return { ok: true, message: `${label} já sai do mapa por um mundo exportado.` };
        }
    }
    return addEdit({ name: object.kind === "brush" ? object.name : "", guid: object.kind === "entity" ? object.guid : "", at: object.at, label, by, when: Date.now() }, by);
}

/**
 * The invisible wall a player is standing at (2026-10-27, "na entrada do castelo de Malešov há uma parede invisível"): the player's own game
 * traces a ring of rays at the height of the knees and of the chest around them, and asks which level entities it has within reach; what is
 * only collision (a designer box, a clip volume, a blocker entity) is taken out for everybody and kept in the list (`/objeto devolver`
 * puts it back). Things with a picture are left alone, so a house or a tree beside the wall is never hidden by this.
 */
export async function hideWallsAround(player: Player, by: string, metres = 3): Promise<string[]> {
    const reach = Math.min(8, Math.max(1, metres));
    const base = player.position;
    const rays: Array<readonly [Vector3, Vector3]> = [];
    for (const height of [0.5, 1.3]) {
        for (let step = 0; step < 12; step += 1) {
            const angle = (step * Math.PI * 2) / 12;
            const from = new Vector3(base.x, base.y, base.z + height);
            rays.push([from, new Vector3(from.x + Math.cos(angle) * reach, from.y + Math.sin(angle) * reach, from.z)]);
        }
    }
    const look = player.lookDirection;
    const length = look ? Math.hypot(look.x, look.y, look.z) : 0;
    if (length > 0.1) {
        const eye = new Vector3(base.x, base.y, base.z + 1.6);
        rays.push([eye, new Vector3(eye.x + (look.x / length) * (reach + 3), eye.y + (look.y / length) * (reach + 3), eye.z + (look.z / length) * (reach + 3))]);
    }
    const [traces, around] = await Promise.all([
        Promise.all(rays.map(([from, to]) => World.raycastAll(player, from, to, { mode: "anything", maxHits: 8 }))),
        World.entitiesInRadius(player, new Vector3(base.x, base.y, base.z + 1), reach + 1, { class: "GeomEntity", max: 32, physicalOnly: true }),
    ]);
    if (traces.every((trace) => !trace.answered) && !around.answered) {
        return [`O seu jogo não respondeu (${traces[0]?.reason || around.reason || "sem motivo"}).`];
    }
    const found = new Map<string, WallObject>();
    const unnamed = new Map<string, string>();
    let left = 0;
    // What the game saw and was left alone, by what it is and what it is made of, nearest first: when no wall is found these name the suspects (2026-10-27: the user ran the command at
    // Malešov's gate and it found nothing; "99 coisas" told nothing about which).
    const seen = new Map<string, { readonly text: string; readonly distance: number }>();
    for (const trace of traces) {
        for (const hit of trace.hits) {
            const verdict = judgeHit(hit);
            if (verdict.act === "hide") {
                found.set(verdict.object.kind === "entity" ? `entity:${verdict.object.guid}` : `${verdict.object.name.toLowerCase()}@${verdict.object.at.map((n) => n.toFixed(2)).join(",")}`, verdict.object);
            } else if (verdict.act === "unnamed") {
                unnamed.set(`${Math.round(hit.position.x)}|${Math.round(hit.position.y)}|${Math.round(hit.position.z)}`, `${hit.position.x.toFixed(2)} ${hit.position.y.toFixed(2)} ${hit.position.z.toFixed(2)} (${hit.surface || "?"}, a ${hit.distance.toFixed(1)} m)`);
            } else {
                left += 1;
                const what = hit.levelObject?.name || hit.model || hit.entityName || hit.entityClass || hit.kind;
                const key = `${what}|${hit.surface}`;
                const known = seen.get(key);
                if (known === undefined || hit.distance < known.distance) {
                    seen.set(key, { text: `${what.split("/").slice(-2).join("/")} (${hit.kind}${hit.entityClass ? `, ${hit.entityClass}` : ""}, ${hit.surface || "?"}) a ${hit.distance.toFixed(1)} m`, distance: hit.distance });
                }
            }
        }
    }
    const blockers: string[] = [];
    for (const entity of around.entities) {
        if (entity.guid === null) {
            continue;
        }
        if (BLOCKER_NAME.test(entity.name)) {
            found.set(`entity:${entity.guid}`, { kind: "entity", name: entity.name, guid: entity.guid, at: [entity.position.x, entity.position.y, entity.position.z] });
        } else {
            blockers.push(`${entity.name || "sem nome"} · guid ${entity.guid} · a ${entity.distance.toFixed(1)} m`);
        }
    }
    const lines: string[] = [];
    let hidden = 0;
    for (const object of found.values()) {
        const result = hideWallObject(object, by);
        hidden += result.ok ? 1 : 0;
        lines.push(`${object.kind === "entity" ? "entidade" : "malha"} ${object.name || object.guid} em ${object.at.map((n) => n.toFixed(2)).join(" ")}: ${result.message}`);
    }
    if (hidden === 0) {
        lines.unshift(`Não achei parede invisível a até ${reach} m de você. Encoste na parede e repita (ou /objeto parede 6 para procurar mais longe).`);
    } else {
        lines.unshift(`Tirei ${hidden} parede(s) invisível(is) do mapa, para todos e de vez. /objeto mostra a lista e /objeto devolver <n> desfaz.`);
    }
    if (unnamed.size > 0) {
        lines.push(`Geometria sem nome no mapa (o servidor não consegue tirar por nome): ${[...unnamed.values()].slice(0, 3).join("; ")}`);
    }
    if (left > 0) {
        lines.push(`Deixei ${left} coisa(s) com desenho ou uso por perto (paredes, árvores, portas).`);
        if (hidden === 0) {
            const suspects = [...seen.values()].sort((a, b) => a.distance - b.distance).slice(0, 8);
            lines.push(`As mais perto: ${suspects.map((one) => one.text).join(" | ")}`);
        }
    }
    if (blockers.length > 0 && hidden === 0) {
        lines.push(`Entidades de geometria por perto que não pareço parede (para tirar uma: /objeto esconder <guid>): ${blockers.slice(0, 4).join("; ")}`);
    }
    return lines;
}

export function installLevelEdits(): void {
    const list = load();
    const applied = list.filter(applyOne).length;
    if (list.length > 0) {
        console.log(`level-edits: ${applied} de ${list.length} objeto(s) do mapa tirado(s) do mundo: ${list.map((edit) => edit.label).join("; ")}`);
    }
    // The walls of the gates go after the exports: an export that already takes one out is not asked twice.
    if (typeof WorldResource === "undefined" || WorldResource.ready || typeof Events === "undefined") {
        applyEnsured();
    } else {
        Events.once("worldResourcesReady", () => {
            applyEnsured();
        });
    }
}
