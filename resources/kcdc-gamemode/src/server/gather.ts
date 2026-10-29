/**
 * The Coletores' work (user, 2026-10-21: "uma guilda nova Coletor ... sempre que o jogador bater com o machado ... em uma árvore, depois de
 * x batidas ele recebe lenha"; "com picareta nas pedras ... chance muito baixa de vir prata, chance moderada de vir ferro ou parafuso e na
 * maior parte algo inútil"; "não precisa cair, só de chegar o aviso nativo lá na esquerda está ótimo").
 *
 * It is worked with E, not with blows (the same night: "golpeei umas 11 vezes, o machado quebrou e só recebi uma lenha; acho melhor ... apertar
 * E e começar a animação de cortar lenha com machado nas mãos, ou nas pedras de mineração começar a picareta; assim conseguimos controlar
 * melhor"). Looking at a tree or a rock, a Coletor's client puts up "Cortar lenha" or "Minerar" on E (`client/gather.ts`), and the press asks
 * the server to start. The player is held still, playing the game's own work -- the woodcutter's at a tree (`LumberJackCuttingTree`) with the
 * lumberjack's axe in hand, the stonemason's pick at a rock (`StonemasonPick`), `craft-animation.ts` -- and every so many seconds a log comes,
 * or a strike of the pick is rolled, until the tree or the rock is spent, the player presses E again, is hurt or goes. Any axe of the game in
 * the bag cuts wood, the pick breaks stone, and each log or strike wears the tool a little: the smith makes new ones.
 *
 * The level's trees and rocks cannot be felled or broken (they are painted on, not entities the server could take away), so each one kept
 * here has what it still gives and rests a while once it is spent. A tree or a rock has no id: it is known by its mesh and where it was
 * aimed at, the same mesh within a step or two being the same tree, as the KCDC guide keeps "a felled tree or a mined rock". Nothing of it
 * outlives a restart.
 */

import { isWorking } from "./craft.js";
import { playWork, stopWork } from "./craft-animation.js";
import { craftItemGuid } from "./craft-items.js";
import { mayCraft } from "./guild-crafts.js";
import { languageOf, translate } from "./language.js";
import { paid } from "./profession-xp.js";
import { allowedTo } from "./reach.js";
import { workBegins, workEnds } from "./work-sound.js";

const RESOURCE = "kcdc-gamemode";
const START = `${RESOURCE}:gather.start`;
const STOP = `${RESOURCE}:gather.stop`;
const STATE = `${RESOURCE}:gather.state`;
const NOTIFY = `${RESOURCE}:notify`;

export type GatherKind = "tree" | "rock";

/** What a client says the player is aimed at: the game's word for it, its mesh and where. */
export interface GatherReport {
    readonly k: GatherKind;
    /** The mesh, as the game loads it. */
    readonly m: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export const gatherSettings = {
    /** How far from where the body stands the tree or rock may be, flat, and up or down: the standard reach of the E prompts and a metre over (`reach.ts`). */
    reachM: allowedTo(),
    heightM: 4,
    /** How far the body may be from where the work began before it stops. */
    stayM: 1.5,
    /** The same mesh this near is the same tree or rock. */
    sameTreeM: 1.8,
    sameRockM: 2.5,
    tree: {
        /** The time for a log at level 0 of the track, `stepMs` less every `per` levels, never less than `bestMs`. */
        ms: 10_000,
        bestMs: 5_000,
        stepMs: 1_000,
        per: 6,
        restMs: 60 * 60_000,
        xp: 4,
        track: "survival",
    },
    rock: {
        ms: 8_000,
        bestMs: 4_000,
        stepMs: 1_000,
        per: 6,
        restMs: 30 * 60_000,
        xp: 2,
        track: "strength",
    },
    /** The chance that a strike brings silver ore: the rocks of the Kuttenberg country and of its quarries more than any other. */
    silver: 0.01,
    silverKutnohorsko: 0.03,
    /** The condition (of 1) a log or a strike takes off the tool; a tool at `worn` or below does not work. */
    wear: 0.015,
    worn: 0.02,
    /** How seldom the same player is told the same thing (not of the guild). */
    hintMs: 60_000,
};

/** Every axe of the game's tables (their sound is the axe's), from the lumberjack's to the knight's, but the wooden one for training and the pick. */
export const AXE_GUIDS: readonly string[] = [
    "1fc42528-2bef-4dde-bf8a-04febeef41c8", // axeWork01, Machado de lenhador
    "81494400-b654-4aa7-8f31-c95c689db5f6", // axeWork02, Machado de carpintaria
    "0802c111-75aa-4b9c-9a3f-f30bac55fbc7", // axeWork02_kunesh, Machado de Skalitz
    "30dd9547-0ec9-4144-871c-cb66582244a4", // naTroskach_axeKolda, Machado do Kolda
    "8d09fdad-9e86-4bbd-906e-ec01b668a206", // kovarskeZakazky_magdalenaAxe, Machado da Magdalena
    "fdfd6989-a28d-40bc-ac0d-882b4d1cf4f9", // kovaniAsiDoVezi_protectiveAxe, Machado protetor
    "53612e76-76fd-4dca-84b6-7905b986dc3b", // axeBattle01, Machado farpado
    "bd74ce18-2623-48ba-a1a1-c9b09bbb2827", // axeBattle02, Machado largo
    "214ffcdd-a7a7-4b7a-b484-f60c8d00b39b", // axeBattle04, Machado do cavaleiro
    "1c3524bb-e4fa-48a1-b956-2dcbdbf69594", // axeCalvaria, Machado Calvaria
    "eeeb5a48-9a97-41a6-aee0-3e1b64fc2405", // axeCuman, Fokos cumano
    "50a9ac1e-dbb5-480b-8b5e-2ba3a1ff8d82", // axeFancy, Machado do carrasco
    "c25fc705-c957-4c9a-a831-0f112e3b148d", // kovaniPoklad_adornedAxe, Machado decorado
    "e2cf3e8b-b411-43a0-a7ed-2674ae8ac4d2", // poi_ratborschButcherAxe, Machado do açougueiro Raborsch
];

/** The game's only pick, the knight's, which the smith makes as the Coletores' tool (`forja:r_axebattle03`). */
export const PICK_GUIDS: readonly string[] = ["0f0164d5-3746-4d07-a1ed-0f138225a6d9"];

const AXES = new Set(AXE_GUIDS);
const PICKS = new Set(PICK_GUIDS);

// ---------------------------------------------------------------------------------------------
// What may be cut and broken.

/**
 * Living trees of the level's woods, by the folder of their species: not the dead, burnt, sick or dry ones, the young firs of the undergrowth,
 * a branch, a piece of bark or a stump, nor the apple trees of the orchards (`malus`) or the mistletoe.
 */
const TREE = /^objects\/natural\/vegetation\/trees\/normal_trees\/(abies_alba|betula_pendula|fagus_sylvatica|pinus_sylvestris|quercus_robur|salix_alba|sorbus|tilia_cordata|marsh_trees)\//;
const NOT_A_TREE = /_dry|dead|burn|sick|branch|bark|stash|undergrowth|_small|bakemesh|sticks|fallen|tavern|trunk/;
/** The rocks and stones of the level (the game's own folders of them), but not the moss and needles drawn on the cliffs of one place. */
const ROCK = /^objects\/natural\/(rocks|stones)\//;
const NOT_A_ROCK = /visual_target|moss|needles/;
/** The rocks of the Kuttenberg country and of the quarries: more silver in them. */
const SILVER_COUNTRY = /\/rocks\/(kutnohorsko_rocks|rocks_quarry)\//;

export function normalModel(model: string): string {
    return model.replace(/\\/g, "/").toLowerCase().trim();
}

export function isTree(model: string): boolean {
    const path = normalModel(model);
    return TREE.test(path) && !NOT_A_TREE.test(path.slice(path.lastIndexOf("/")));
}

export function isRock(model: string): boolean {
    const path = normalModel(model);
    return ROCK.test(path) && !NOT_A_ROCK.test(path);
}

/** How many logs a tree gives before it rests: the big oaks and beeches more, the birches, willows and rowans less. */
export function logsOf(model: string): number {
    const path = normalModel(model);
    return /quercus|fagus/.test(path) ? 4 : /betula|salix|sorbus/.test(path) ? 2 : 3;
}

/** How many strikes a rock gives before it rests: a cliff or a boulder many, a stone at the roadside few. */
export function strikesOf(model: string): number {
    const path = normalModel(model);
    if (/rock_cliff|rocks_big|quarry|\/unique\/|sandstone_rocks|trosky_rocks/.test(path)) {
        return 12;
    }
    return /\/stones\/|rocks_ground|rock_road|_small/.test(path) ? 3 : 6;
}

// ---------------------------------------------------------------------------------------------
// What a strike on a rock brings.

/**
 * Silver comes first, by its own chance; then one of these, by weight: mostly a useless chip of stone, now and then salt (user, 2026-10-22: "nos
 * itens que podem vir ao minerar deve ter chance de vir sal também": the game's `loot_salt`, taken from the chips' share so the iron and nails keep theirs), iron or nails.
 */
export const ROCK_FINDS: ReadonlyArray<{ readonly item: string; readonly label: string; readonly weight: number }> = [
    { item: "", label: "nada", weight: 6 },
    { item: "kcdc-craft:lasca", label: "lasca de pedra", weight: 27 },
    { item: "loot_salt", label: "sal", weight: 8 },
    { item: "bsmt_ironBad", label: "sucata", weight: 15 },
    { item: "bsmt_hardware", label: "material de fixação", weight: 8 },
    { item: "bsmt_ironGood", label: "ferro", weight: 16 },
    // What the smiths', the apothecaries' and the artisans' vendors sold and nobody dug (2026-10-27, SINERGIA.md): copper, jasper, enamel powder, sulphur and saltpetre.
    { item: "bsmt_copper", label: "cobre", weight: 6 },
    { item: "bsmt_jaspis", label: "jaspe", weight: 2 },
    { item: "bsmt_emailPowder", label: "pó de esmalte", weight: 3 },
    { item: "special_sulfur", label: "enxofre", weight: 4 },
    { item: "special_saltpeter", label: "salitre", weight: 4 },
    { item: "special_cobweb", label: "teia de aranha", weight: 1 },
];

export const SILVER_ORE = "kcdc-craft:minerio-prata";
export const LOG = "kcdc-craft:lenha";

/**
 * What a cut of the axe brings (2026-10-27, SINERGIA.md): the log, and now and then the straight seasoned wood the bowyers' bows and shafts are made of, a few
 * walnuts, or, very rarely, the exotic wood of a dear fitting. The bows' wood and the walnuts were only ever sold by the vendors.
 */
export const TREE_FINDS: ReadonlyArray<{ readonly item: string; readonly label: string; readonly weight: number }> = [
    { item: LOG, label: "lenha", weight: 87 },
    { item: "kcdc-craft:madeira", label: "madeira de arco", weight: 10 },
    { item: "walnuts", label: "nozes", weight: 2 },
    { item: "bsmt_woodExotic", label: "madeira exótica", weight: 1 },
];

/** What a cut brings, from a number in [0, 1). */
export function rollTree(roll: number): { readonly item: string; readonly label: string } {
    const total = TREE_FINDS.reduce((sum, find) => sum + find.weight, 0);
    let left = roll * total;
    for (const find of TREE_FINDS) {
        left -= find.weight;
        if (left < 0) {
            return find;
        }
    }
    return TREE_FINDS[0]!;
}

/** What a strike brings, from a number in [0, 1) and another for the silver. */
export function rollRock(model: string, silverRoll: number, roll: number): { readonly item: string; readonly label: string } {
    const chance = SILVER_COUNTRY.test(normalModel(model)) ? gatherSettings.silverKutnohorsko : gatherSettings.silver;
    if (silverRoll < chance) {
        return { item: SILVER_ORE, label: "minério de prata" };
    }
    const total = ROCK_FINDS.reduce((sum, find) => sum + find.weight, 0);
    let left = roll * total;
    for (const find of ROCK_FINDS) {
        left -= find.weight;
        if (left < 0) {
            return find;
        }
    }
    return ROCK_FINDS[0]!;
}

// ---------------------------------------------------------------------------------------------
// The trees and rocks being worked, and the players working them.

interface Target {
    readonly kind: GatherKind;
    readonly model: string;
    readonly x: number;
    readonly y: number;
    /** Logs or strikes still in it. */
    left: number;
    /** Resting until then (0: not resting). */
    restUntil: number;
    lastAt: number;
}

export interface Job {
    readonly kind: GatherKind;
    readonly target: Target;
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
    timer: ReturnType<typeof setTimeout> | null;
    /** How many logs or strikes this work has brought. */
    done: number;
}

const targets = new Map<string, Target[]>();
const jobs = new Map<number, Job>();
const hinted = new Map<string, number>();

function targetFor(kind: GatherKind, model: string, x: number, y: number, now: number): Target {
    const near = kind === "tree" ? gatherSettings.sameTreeM : gatherSettings.sameRockM;
    const list = targets.get(model) ?? [];
    const known = list.find((target) => Math.hypot(target.x - x, target.y - y) <= near);
    if (known !== undefined) {
        if (known.restUntil !== 0 && known.restUntil <= now) {
            known.restUntil = 0;
            known.left = kind === "tree" ? logsOf(model) : strikesOf(model);
        }
        return known;
    }
    const made: Target = { kind, model, x, y, left: kind === "tree" ? logsOf(model) : strikesOf(model), restUntil: 0, lastAt: now };
    list.push(made);
    targets.set(model, list);
    return made;
}

/** Forgets the trees and rocks nobody has touched in a while and that are not resting, so the list does not grow for ever. */
export function pruneTargets(now: number): number {
    let dropped = 0;
    for (const [model, list] of targets) {
        const kept = list.filter((target) => target.restUntil > now || now - target.lastAt < 2 * 60 * 60_000);
        dropped += list.length - kept.length;
        if (kept.length === 0) {
            targets.delete(model);
        } else {
            targets.set(model, kept);
        }
    }
    return dropped;
}

/** A line on the game's notification line, in the player's language; with a `key`, once a minute at most. */
function tell(player: Player, text: string, key = "", now = Date.now()): void {
    if (key !== "") {
        const id = `${player.id}:${key}`;
        if (now - (hinted.get(id) ?? -Infinity) < gatherSettings.hintMs) {
            return;
        }
        hinted.set(id, now);
    }
    try {
        player.emit(NOTIFY, JSON.stringify({ text: translate(text, languageOf(player)) }));
    } catch {
        // Gone already.
    }
}

function emitState(player: Player, on: boolean, kind?: GatherKind): void {
    try {
        player.emit(STATE, JSON.stringify(on ? { on, k: kind } : { on }));
    } catch {
        // Gone already.
    }
    // The others keep the sound of the blows to those near (work-sound.ts).
    if (on && kind !== undefined) {
        workBegins(player, kind === "tree" ? "lenha" : "mina");
    } else if (!on) {
        workEnds(player);
    }
}

/** The level of a track, 0 before the player's game first said it. */
function levelOf(player: Player, track: string): number {
    try {
        return player.getTrack(track)?.level ?? 0;
    } catch {
        return 0;
    }
}

/** How long a log or a strike takes at a level of the track. */
export function workMsFor(kind: GatherKind, level: number): number {
    const rule = kind === "tree" ? gatherSettings.tree : gatherSettings.rock;
    return Math.max(rule.bestMs, rule.ms - Math.floor(Math.max(0, level) / rule.per) * rule.stepMs);
}

const conditionOf = (row: InventoryRow): number => (typeof row.condition === "number" && row.condition >= 0 ? row.condition : 1);

/** The tool in the bag for the work: the one in hand first, then the best kept. Null when there is none. */
export function toolFor(player: Player, kind: GatherKind): InventoryRow | null {
    const set = kind === "tree" ? AXES : PICKS;
    const rows = (Inventory.get(player)?.items ?? []).filter((row) => set.has(String(row.item).toLowerCase()));
    rows.sort((a, b) => (b.equipped > 0 ? 1 : 0) - (a.equipped > 0 ? 1 : 0) || conditionOf(b) - conditionOf(a));
    return rows[0] ?? null;
}

/**
 * Takes `wear` off the condition of ONE tool. False when the game would not have it.
 *
 * Tools of one class and the same condition are ONE row of the bag, and a row has one set of properties: wearing the row wore every tool in
 * it (user, 2026-10-25: "se ele coletar recursos, minério ou lenha, e ter 2 machados, os dois se quebram juntos"). So a row of several is
 * split first: the worn tool is added as a row of its own, and then one is taken out of the stack. The add comes first, so a bag with no room
 * leaves the tools as they were (the work is free once) instead of losing one; should the removal fail, the added tool is taken out again.
 */
function wearTool(player: Player, row: InventoryRow): boolean {
    const metadata: Record<string, unknown> = { ...row.metadata };
    delete metadata["health"];
    metadata["condition"] = Math.max(0, conditionOf(row) - gatherSettings.wear);
    try {
        if (row.amount > 1) {
            const added = Inventory.add(player, { item: row.item, amount: 1, metadata });
            if (!added.ok) {
                console.log(`coleta: ${player.nickname}: a ferramenta gasta não coube na bolsa (${added.code}); ficou como estava`);
                return false;
            }
            const removed = Inventory.remove(player, { units: [{ id: row.id, amount: 1 }] });
            if (!removed.ok) {
                const id = added.items?.[0]?.id;
                if (id !== undefined) {
                    Inventory.remove(player, { units: [{ id, amount: 1 }] });
                }
                return false;
            }
            return true;
        }
        return Inventory.setProperties(player, { id: row.id, metadata }).ok;
    } catch {
        return false;
    }
}

function give(player: Player, item: string): boolean {
    try {
        return Inventory.add(player, { item: craftItemGuid(item) ?? item, amount: 1 }).ok;
    } catch {
        return false;
    }
}

function addXp(player: Player, track: string, xp: number): void {
    try {
        player.addXp(track, paid(xp));
    } catch (error: unknown) {
        console.log(`coleta: o XP de ${track} não foi dado a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

const NO_TOOL: Readonly<Record<GatherKind, string>> = {
    tree: "Você precisa de um machado na bolsa para cortar lenha.",
    rock: "Você precisa de uma picareta na bolsa para minerar.",
};
const WORN_TOOL: Readonly<Record<GatherKind, string>> = {
    tree: "O seu machado está gasto demais: conserte com um kit de reparo ou faça outro no ferreiro.",
    rock: "A sua picareta está gasta demais: conserte com um kit de reparo ou faça outra no ferreiro.",
};
const SPENT: Readonly<Record<GatherKind, string>> = { tree: "Esta árvore já deu a lenha que tinha. Procure outra.", rock: "Esta pedra está esgotada por ora. Procure outra." };

/** Reads what a client sent: null for anything that is not a tree or a rock with a mesh and a place. */
export function readReport(payload: unknown): GatherReport | null {
    let fields: unknown = payload;
    if (typeof payload === "string") {
        try {
            fields = JSON.parse(payload) as unknown;
        } catch {
            return null;
        }
    }
    if (typeof fields !== "object" || fields === null) {
        return null;
    }
    const { k, m, x, y, z } = fields as Record<string, unknown>;
    if ((k !== "tree" && k !== "rock") || typeof m !== "string" || m.length === 0 || m.length > 300) {
        return null;
    }
    if (![x, y, z].every((value) => typeof value === "number" && Number.isFinite(value))) {
        return null;
    }
    return { k, m: normalModel(m), x: x as number, y: y as number, z: z as number };
}

export function isGathering(player: Player): boolean {
    return jobs.has(player.id);
}

/** Ends a player's work: the animation stops, the client is told, and `message` (when there is one) is said. */
export function stopGather(player: Player, message = ""): boolean {
    const job = jobs.get(player.id);
    if (job === undefined) {
        return false;
    }
    if (job.timer !== null) {
        clearTimeout(job.timer);
    }
    jobs.delete(player.id);
    stopWork(player);
    emitState(player, false);
    if (message !== "") {
        tell(player, message);
    }
    return true;
}

/** What became of a press, for the tests and the log. */
export type StartOutcome = { readonly started: true; readonly ms: number } | { readonly started: false; readonly why: string };

/** E on a tree or a rock: the work starts, or the player is told why not. A second E while working stops it. */
export function startGather(player: Player, report: GatherReport, now = Date.now(), random: () => number = Math.random): StartOutcome {
    if (jobs.has(player.id)) {
        stopGather(player);
        return { started: false, why: "parou" };
    }
    if (!player.ready || !player.alive || player.mounted) {
        return { started: false, why: "agora não" };
    }
    const kind = report.k;
    if (kind === "tree" ? !isTree(report.m) : !isRock(report.m)) {
        return { started: false, why: "não é árvore nem pedra que se trabalhe" };
    }
    const at = player.position;
    if (Math.hypot(at.x - report.x, at.y - report.y) > gatherSettings.reachM || Math.abs(at.z - report.z) > gatherSettings.heightM) {
        return { started: false, why: "longe demais" };
    }
    if (!mayCraft(player, kind === "tree" ? "lenha" : "mineracao")) {
        tell(player, "Cortar lenha e quebrar pedra é ofício dos Coletores (guilda Collectores). Escolha a guilda no painel (F2), em Guildas.", "guild", now);
        return { started: false, why: "não é da guilda" };
    }
    if (isWorking(player)) {
        tell(player, "Você já está trabalhando em algo.");
        return { started: false, why: "ocupado" };
    }
    const tool = toolFor(player, kind);
    if (tool === null) {
        tell(player, NO_TOOL[kind]);
        return { started: false, why: "sem ferramenta" };
    }
    if (conditionOf(tool) <= gatherSettings.worn) {
        tell(player, WORN_TOOL[kind]);
        return { started: false, why: "ferramenta gasta" };
    }
    const target = targetFor(kind, report.m, report.x, report.y, now);
    target.lastAt = now;
    if (target.restUntil > now) {
        tell(player, SPENT[kind]);
        return { started: false, why: "descansando" };
    }
    const job: Job = { kind, target, at: { x: at.x, y: at.y, z: at.z }, timer: null, done: 0 };
    jobs.set(player.id, job);
    playWork(player, kind === "tree" ? "lenha" : "mina");
    emitState(player, true, kind);
    return { started: true, ms: schedule(player, job, random) };
}

/** The next log or strike of a work, after the time the player's level asks. */
function schedule(player: Player, job: Job, random: () => number): number {
    const rule = job.kind === "tree" ? gatherSettings.tree : gatherSettings.rock;
    const ms = workMsFor(job.kind, levelOf(player, rule.track));
    job.timer = setTimeout(() => {
        job.timer = null;
        try {
            finishOne(player, job, Date.now(), random);
        } catch (error: unknown) {
            console.log(`coleta: o trabalho de ${player.nickname} parou: ${error instanceof Error ? error.message : String(error)}`);
            stopGather(player);
        }
    }, ms);
    return ms;
}

/** One log or one strike: checked again, given, the tool worn; then the next, or the end. Returns what was given ("" for nothing). */
export function finishOne(player: Player, job: Job, now = Date.now(), random: () => number = Math.random): string {
    if (jobs.get(player.id) !== job) {
        return "";
    }
    if (!player.ready || !player.alive) {
        stopGather(player);
        return "";
    }
    const here = player.position;
    if (Math.hypot(here.x - job.at.x, here.y - job.at.y) > gatherSettings.stayM) {
        stopGather(player, "Você saiu do lugar e parou de trabalhar.");
        return "";
    }
    const { kind, target } = job;
    if (target.restUntil > now) {
        stopGather(player, SPENT[kind]);
        return "";
    }
    const tool = toolFor(player, kind);
    if (tool === null || conditionOf(tool) <= gatherSettings.worn) {
        stopGather(player, tool === null ? NO_TOOL[kind] : WORN_TOOL[kind]);
        return "";
    }
    const rule = kind === "tree" ? gatherSettings.tree : gatherSettings.rock;
    target.left -= 1;
    target.lastAt = now;
    if (target.left <= 0) {
        target.restUntil = now + rule.restMs;
    }
    addXp(player, rule.track, rule.xp);
    wearTool(player, tool);
    job.done += 1;
    let gave = "";
    if (kind === "tree") {
        const cut = rollTree(random());
        gave = give(player, cut.item) ? cut.item : "";
        console.log(`coleta: ${player.nickname} cortou ${cut.label} (${target.model.slice(target.model.lastIndexOf("/") + 1)}, resta ${Math.max(0, target.left)})${gave === "" ? " -- não coube no inventário" : ""}`);
    } else {
        const find = rollRock(target.model, random(), random());
        gave = find.item !== "" && give(player, find.item) ? find.item : "";
        if (find.item === SILVER_ORE) {
            console.log(`coleta: ${player.nickname} achou minério de prata (${target.model.slice(target.model.lastIndexOf("/") + 1)} em ${Math.round(target.x)} ${Math.round(target.y)})`);
        }
    }
    if (target.left <= 0) {
        stopGather(player, SPENT[kind]);
    } else {
        schedule(player, job, random);
    }
    return gave;
}

export function installGather(): void {
    Events.onClient(START, (sender, payload) => {
        const player = sender as Player;
        const report = readReport(payload);
        if (report === null) {
            return;
        }
        try {
            const outcome = startGather(player, report);
            if (!outcome.started && outcome.why !== "parou") {
                console.log(`coleta: ${player.nickname} não começou a ${report.k === "tree" ? "cortar lenha" : "minerar"}: ${outcome.why} (${report.m.slice(report.m.lastIndexOf("/") + 1)})`);
            }
        } catch (error: unknown) {
            console.log(`coleta: o trabalho de ${player.nickname} não começou: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    Events.onClient(STOP, (sender) => {
        stopGather(sender as Player);
    });
    // Hurt, he stops; and a work the game itself cut short (a weapon drawn, a fall) ends here too.
    Events.on("playerDamage", (player) => {
        if (jobs.has(player.id)) {
            stopGather(player, "Você foi interrompido.");
        }
    });
    Events.on("playerAnimationEnd", (player, _fragment, reason) => {
        if (reason === "interrupted" && jobs.has(player.id)) {
            stopGather(player, "Você foi interrompido.");
        }
    });
    Events.on("playerDisconnect", (player) => {
        const job = jobs.get(player.id);
        if (job !== undefined && job.timer !== null) {
            clearTimeout(job.timer);
        }
        jobs.delete(player.id);
        for (const key of [...hinted.keys()]) {
            if (key.startsWith(`${player.id}:`)) {
                hinted.delete(key);
            }
        }
    });
    setInterval(() => {
        pruneTargets(Date.now());
    }, 10 * 60_000);
    console.log(`coleta: E numa árvore ou numa pedra; ${gatherSettings.tree.ms / 1000} s por lenha e ${gatherSettings.rock.ms / 1000} s por tentativa no nível 0, prata ${Math.round(gatherSettings.silver * 1000) / 10}% (${Math.round(gatherSettings.silverKutnohorsko * 1000) / 10}% nas pedras de Kuttenberg)`);
}

/** What `/coleta` shows: the rules and how many trees and rocks are being worked or resting. */
export function gatherSummary(now = Date.now()): string[] {
    let trees = 0;
    let rocks = 0;
    let resting = 0;
    for (const list of targets.values()) {
        for (const target of list) {
            if (target.kind === "tree") {
                trees += 1;
            } else {
                rocks += 1;
            }
            if (target.restUntil > now) {
                resting += 1;
            }
        }
    }
    const silver = `${Math.round(gatherSettings.silver * 1000) / 10}%, ${Math.round(gatherSettings.silverKutnohorsko * 1000) / 10}% nas pedras de Kuttenberg e das pedreiras`;
    return [
        `Árvores: E com um machado na bolsa; ${gatherSettings.tree.ms / 1000} s por lenha no nível 0 de sobrevivência, ${gatherSettings.tree.stepMs / 1000} s a menos a cada ${gatherSettings.tree.per} níveis (mínimo ${gatherSettings.tree.bestMs / 1000} s); a árvore dá de 2 a 4 e descansa ${gatherSettings.tree.restMs / 60_000} min.`,
        `Pedras: E com a picareta na bolsa; ${gatherSettings.rock.ms / 1000} s por tentativa no nível 0 de força, ${gatherSettings.rock.stepMs / 1000} s a menos a cada ${gatherSettings.rock.per} níveis (mínimo ${gatherSettings.rock.bestMs / 1000} s); a pedra dá de 3 a 12 e descansa ${gatherSettings.rock.restMs / 60_000} min.`,
        `Cada tentativa: prata ${silver}; senão ${ROCK_FINDS.map((find) => `${find.label} ${find.weight}`).join(", ")} (pesos). Cada lenha ou tentativa gasta ${Math.round(gatherSettings.wear * 1000) / 10}% da ferramenta.`,
        `Agora: ${trees} árvore(s) e ${rocks} pedra(s) em trabalho, ${resting} descansando; ${jobs.size} jogador(es) trabalhando.`,
    ];
}

/** Lets every tree and rock give again at once (`/coleta descansar`). */
export function restAll(): number {
    let count = 0;
    for (const list of targets.values()) {
        count += list.length;
    }
    targets.clear();
    return count;
}
