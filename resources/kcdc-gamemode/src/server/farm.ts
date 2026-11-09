/**
 * The Agricultores' gardens (user, 2026-10-22: "acha que tem como fazer uma mecânica de agricultor no jogo? Ele interage com a horta
 * apertando E e abre um menu na direita falando o que ele pode plantar, o que precisa para plantar e em quanto tempo ele pode vir colher;
 * seria legal ele poder plantar ingredientes que o cozinheiro precisa; ao plantar o jogador precisa de uma pá e o jogo faz a animação de
 * cavando").
 *
 * The beds are the level's own: the 118 rows its farmers hoe behind the houses of the villages (`data/farm.json`, `farm-data.ts`). An
 * Agricultor aimed at one sees "[E] Plantar" (`client/farm.ts`); the press opens the trades' page on the right (`ui/craft.html`, the
 * same as the forge's and the fire's) with what can be sown there (`FARM_CROPS`): what it gives and how much, the seeds it takes and the
 * shovel in the bag, how long it takes to come up, and the level of survival it asks for. "Plantar" digs the bed -- the game's own
 * gravedigger's `Digging` with a shovel in hand, or for a woman, who has no such animation, its farmers' `Hoeing` with the hoe -- and the
 * seed goes in. The bed then shows the plant growing (the game's own meshes as props, small, then grown, then with the produce at its
 * foot) and, ripe, says "[E] Colher" to its sower: the harvest is picked (`PickingHerbs`) and comes with a seed or two to sow again and
 * the XP of survival. Nobody else harvests a bed sown by another; a ripe bed left too long spoils.
 *
 * Plantings are kept by Steam id in `playerdata/farm.json` and grow by real time, through restarts.
 *
 * The page has a second kind of row, the work done on the harvest (2026-10-27, `FARM_PROCESSES`; user: "o artesão precisa de linho, o agricultor pode plantar linho e fazer
 * linha"): the flax spun into thread, the grain milled into flour and malted, and the seeds kept back from any crop (two of a harvest for a seed). They are done where the
 * page was opened, at the garden, at once, with their XP; their ids are `beneficiar:<id>`.
 */

import { emitLarge } from "./big-emit.js";
import { batchOf, isWorking } from "./craft.js";
import { CRAFT_ITEMS, FARM_CROPS, FARM_PROCESSES, FARM_TOOLS } from "./craft-data.js";
import { award, paid, quote } from "./profession-xp.js";
import type { Trade } from "./profession-xp.js";
import type { FarmCrop, FarmProcess } from "./craft-data.js";
import { classOf, craftItemGuid } from "./craft-items.js";
import { craftTitle } from "./craft-titles.js";
import { addGarden, farmData, removeGarden } from "./farm-data.js";
import type { Bed, Garden } from "./farm-data.js";
import { isGathering } from "./gather.js";
import { mayCraft, usesFreeCrafts } from "./guild-crafts.js";
import { languageOf, translate } from "./language.js";
import { yawOf } from "./position.js";
import { allowedTo, EDGE_M } from "./reach.js";
import { onGuildChange } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { workBegins, workEnds } from "./work-sound.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const BEDS = `${RESOURCE}:farm.beds`;
const ASK = `${RESOURCE}:farm.ask`;
const USE = `${RESOURCE}:farm.use`;
const STOP = `${RESOURCE}:farm.stop`;
const STATE = `${RESOURCE}:farm.state`;
const NOTIFY = `${RESOURCE}:notify`;
const DIR = "playerdata";
const FILE = `${DIR}/farm.json`;
const MARKED_FILE = `${DIR}/farm-extra.json`;

/** The page's station: its recipes are the crops, its ids `horta:<crop>`. */
export const FARM_STATION = "horta";
export const RECIPE_PREFIX = "horta:";
/** The ids of the work done on the harvest (`FARM_PROCESSES`) on the same page. */
export const PROCESS_PREFIX = "beneficiar:";

export const farmSettings = {
    /** How long the digging and sowing of a bed takes, and the picking of its harvest. */
    plantSeconds: 9,
    harvestSeconds: 6,
    /**
     * Between one piece of work on the harvest and the next of the same player (2026-11-01: eleven millings and maltings in three seconds, and the player could not move the
     * flour and the malt out of the bag until they came back in: the game's view of the bag did not keep up with so many changes at once).
     */
    processGapMs: 2_500,
    /**
     * How near the row of a bed the body must be (the nearest point of the row, flat): the one reach of the E prompts, a garden bed's
     * margin and the server's metre over (`reach.ts`); and up or down.
     */
    reachM: allowedTo(EDGE_M.garden),
    heightM: 3,
    /** How far the body may move from where the work began before it stops. */
    stayM: 1.5,
    /** A ripe bed waits this long for its harvest, then spoils (the beds are the villages' and few: a farmer gone for days gives them back). */
    spoilHours: 48,
    /**
     * The beds one farmer may have sown at once: so many, and one more every `bedsPerLevels` levels of survival (2026-10-27, user: "as terras de plantações estão muito pequenas,
     * precisamos estender os campos de arado": it was four, and one more every five levels).
     */
    baseBeds: 10,
    bedsPerLevels: 2,
    /** The row a crop's yield is set for, and the most a longer row multiplies it by. */
    rowStandardM: 4,
    rowMaxFactor: 2,
    /** XP of survival for the sowing (the harvest gives the crop's own). */
    plantXp: 2,
    /** The seeds a harvest gives back: one, and a second this often. */
    secondSeed: 0.5,
    /** One more of the crop at the harvest from this level of survival on. */
    bonusLevel: 15,
    /** How often the beds are looked at (ripening, spoiling). */
    tickMs: 30_000,
    track: "survival",
};

export interface Plot {
    bed: string;
    crop: string;
    owner: string;
    ownerName: string;
    plantedAt: number;
    readyAt: number;
}

const CROPS = new Map(FARM_CROPS.map((crop) => [crop.id, crop]));
const PROCESSES = new Map(FARM_PROCESSES.map((process) => [process.id, process]));
const TOOLS = new Set(FARM_TOOLS);

const plots = new Map<string, Plot>();
/** The props each sown bed shows, and the stage they show. */
const shown = new Map<string, { stage: number; props: number[] }>();
/** The bed each player has the page of, by player id. */
const pageBed = new Map<number, string>();
/** The ripe beds' marks on their sowers' maps, by bed. */
const ripeBlips = new Map<string, number>();
let lastWritten = "";

export function cropById(id: string): FarmCrop | undefined {
    return CROPS.get(id);
}

function beds(): readonly Bed[] {
    return farmData().beds;
}

export function bedById(id: string): Bed | undefined {
    return beds().find((bed) => bed.id === id);
}

function gardenOf(bed: Bed): Garden | undefined {
    return farmData().gardens.find((garden) => garden.id === bed.garden);
}

/** "Horta de Suchdol 2". */
export function gardenName(bed: Bed): string {
    return gardenOf(bed)?.name ?? "horta";
}

// ---------------------------------------------------------------------------------------------
// Where a bed is.

/** Which way a bed's row runs, as a flat unit vector (the level's yaw: 0 is +Y). */
function rowDirection(bed: Bed): { x: number; y: number } {
    const radians = (bed.yaw * Math.PI) / 180;
    return { x: -Math.sin(radians), y: Math.cos(radians) };
}

/** How far a point is from the row of a bed, flat: from the nearest point of the row, which runs `length` metres through its middle. */
export function distanceToBed(bed: Bed, at: { readonly x: number; readonly y: number }): number {
    const dir = rowDirection(bed);
    const half = bed.length / 2;
    const along = Math.max(-half, Math.min(half, (at.x - bed.x) * dir.x + (at.y - bed.y) * dir.y));
    return Math.hypot(at.x - (bed.x + dir.x * along), at.y - (bed.y + dir.y * along));
}

export function nearBed(player: Player, bed: Bed): boolean {
    const at = player.position;
    return distanceToBed(bed, at) <= farmSettings.reachM && Math.abs(at.z - bed.z) <= farmSettings.heightM;
}

/** The places along a bed's row where its plants stand. */
export function plantSpots(bed: Bed): Array<{ x: number; y: number; z: number }> {
    const dir = rowDirection(bed);
    // Three plants along a short row; five along a long one (the fields were made longer, 2026-10-27), spread over most of it.
    const along = bed.length > 5 ? [-2, -1, 0, 1, 2].map((n) => n * Math.min(bed.length, 8) * 0.2) : [-1, 0, 1].map((n) => n * Math.min(bed.length, 4) * 0.3);
    return along.map((t) => ({ x: bed.x + dir.x * t, y: bed.y + dir.y * t, z: bed.z }));
}

// ---------------------------------------------------------------------------------------------
// The plantings.

function persist(): void {
    const list = [...plots.values()];
    const text = JSON.stringify(list);
    if (text === lastWritten) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, plots: list });
        lastWritten = text;
    } catch (error: unknown) {
        console.log(`farm: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function isPlot(value: unknown): value is Plot {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const plot = value as Partial<Plot>;
    return typeof plot.bed === "string" && typeof plot.crop === "string" && typeof plot.owner === "string" && typeof plot.plantedAt === "number" && typeof plot.readyAt === "number";
}

function load(): void {
    const loaded = read<{ plots?: unknown[] }>(FILE);
    if (loaded.status === "corrupt") {
        console.error(`farm: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
        return;
    }
    if (loaded.status !== "ok" || !Array.isArray(loaded.value.plots)) {
        return;
    }
    for (const raw of loaded.value.plots) {
        if (isPlot(raw) && CROPS.has(raw.crop) && bedById(raw.bed) !== undefined) {
            plots.set(raw.bed, { ...raw, ownerName: typeof raw.ownerName === "string" ? raw.ownerName : "" });
        }
    }
    lastWritten = JSON.stringify([...plots.values()]);
}

/** 1 a sprout, 2 growing, 3 ripe. */
export function stageOf(plot: Plot, now: number): number {
    if (now >= plot.readyAt) {
        return 3;
    }
    const share = (now - plot.plantedAt) / Math.max(1, plot.readyAt - plot.plantedAt);
    return share < 0.4 ? 1 : 2;
}

export function isRipe(plot: Plot, now: number): boolean {
    return now >= plot.readyAt;
}

/** How many beds a player may have sown at once. */
export function bedsAllowed(level: number): number {
    return farmSettings.baseBeds + Math.floor(Math.max(0, level) / farmSettings.bedsPerLevels);
}

export function plotsOf(steamId: string): Plot[] {
    return [...plots.values()].filter((plot) => plot.owner === steamId);
}

export function plotOf(bedId: string): Plot | null {
    return plots.get(bedId) ?? null;
}

/** "23 min", "1 h 05 min". */
export function minutesText(ms: number): string {
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    if (minutes < 60) {
        return `${minutes} min`;
    }
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

// ---------------------------------------------------------------------------------------------
// What the beds show.

const PLANT_SCALE = [0, 0.35, 0.7, 1] as const;

function clearProps(bedId: string): void {
    const entry = shown.get(bedId);
    if (entry === undefined) {
        return;
    }
    for (const id of entry.props) {
        try {
            Prop.getById(id)?.destroy();
        } catch {
            // Gone already.
        }
    }
    shown.delete(bedId);
}

/** Puts up what a sown bed shows at its stage: the plant along the row, and ripe, the produce at its foot. */
function showPlot(plot: Plot, now: number): void {
    const stage = stageOf(plot, now);
    if (shown.get(plot.bed)?.stage === stage) {
        return;
    }
    clearProps(plot.bed);
    const bed = bedById(plot.bed);
    const crop = CROPS.get(plot.crop);
    if (bed === undefined || crop === undefined) {
        return;
    }
    const ids: number[] = [];
    const spawn = (model: string, at: { x: number; y: number; z: number }, scale: number): void => {
        try {
            const prop = Prop.spawn(model, new Vector3(at.x, at.y, at.z), new Vector3(0, 0, Math.floor(Math.random() * 360)), scale, "none");
            ids.push(prop.id);
        } catch (error: unknown) {
            console.log(`farm: ${model} não pôde ser posto em ${bed.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    for (const spot of plantSpots(bed)) {
        spawn(crop.plant, spot, PLANT_SCALE[stage] ?? 1);
    }
    if (stage === 3 && crop.produce !== "") {
        spawn(crop.produce, { x: bed.x, y: bed.y, z: bed.z + 0.02 }, 1);
    }
    shown.set(plot.bed, { stage, props: ids });
}

// ---------------------------------------------------------------------------------------------
// Telling the players.

function say(player: Player, text: string): void {
    try {
        player.emit(NOTIFY, JSON.stringify({ text: translate(text, languageOf(player)) }));
    } catch {
        // Gone already.
    }
    Chat.sendToPlayer(player, text);
}

/**
 * The beds as one player's client draws them: where each is (its middle, its row's way and length) and what it is to them -- 0 free,
 * 1 theirs and growing, 2 theirs and ripe, 3 another's. Only an Agricultor is sent any.
 */
export function bedsFor(player: Player, now = Date.now()): Array<[number, number, number, number, number, number]> {
    if (!mayCraft(player, "horta")) {
        return [];
    }
    return beds().map((bed): [number, number, number, number, number, number] => {
        const plot = plots.get(bed.id);
        const state = plot === undefined ? 0 : plot.owner !== player.steamId ? 3 : isRipe(plot, now) ? 2 : 1;
        return [Math.round(bed.x * 100) / 100, Math.round(bed.y * 100) / 100, Math.round(bed.z * 100) / 100, Math.round(bed.yaw), Math.round(bed.length * 10) / 10, state];
    });
}

function sendBeds(player: Player): void {
    try {
        player.emit(BEDS, JSON.stringify(bedsFor(player)));
    } catch {
        // Gone already.
    }
}

function sendBedsToFarmers(): void {
    for (const player of Player.all()) {
        if (player.ready && mayCraft(player, "horta")) {
            sendBeds(player);
        }
    }
}

/** A ripe bed's mark on its sower's map and compass, while they are in. */
function markRipe(plot: Plot): void {
    if (ripeBlips.has(plot.bed)) {
        return;
    }
    const owner = Player.all().find((player) => player.steamId === plot.owner && player.ready);
    const bed = bedById(plot.bed);
    if (owner === undefined || bed === undefined) {
        return;
    }
    try {
        const blip = Blip.create({ position: new Vector3(bed.x, bed.y, bed.z), type: "Herbalist", label: `${CROPS.get(plot.crop)?.name ?? "Colheita"}: pronta`, player: owner });
        ripeBlips.set(plot.bed, blip.id);
    } catch {
        // No blips here: the word on the screen is enough.
    }
}

function unmarkRipe(bedId: string): void {
    const id = ripeBlips.get(bedId);
    if (id !== undefined) {
        ripeBlips.delete(bedId);
        try {
            Blip.getById(id)?.remove();
        } catch {
            // Gone already.
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The page.

function levelOf(player: Player): number {
    try {
        return player.getTrack(farmSettings.track)?.level ?? 0;
    } catch {
        return 0;
    }
}

/** What the player carries, by class. */
function countsOf(player: Player): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of Inventory.get(player)?.items ?? []) {
        const key = String(row.item).toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + row.amount);
    }
    return counts;
}

function shovelCount(counts: Map<string, number>): number {
    let total = 0;
    for (const tool of TOOLS) {
        total += counts.get(tool) ?? 0;
    }
    return total;
}

/** The page of a bed: every crop, with its seed and the shovel, whether it can be sown now, and how long it takes to come up. */
export function farmView(player: Player, bed: Bed): Record<string, unknown> {
    const counts = countsOf(player);
    const level = levelOf(player);
    const free = usesFreeCrafts(player);
    const shovel = Math.min(1, shovelCount(counts));
    const shovelId = FARM_TOOLS[0] ?? "";
    const items: Record<string, readonly [string, string]> = {};
    for (const id of [shovelId, ...FARM_CROPS.flatMap((crop) => [crop.seed, crop.harvest]), ...FARM_PROCESSES.flatMap((process) => [process.output, ...process.ingredients.map(([item]) => item)])]) {
        const known = CRAFT_ITEMS[id];
        if (known !== undefined) {
            items[id] = known;
        }
    }
    const mine = plotsOf(player.steamId).length;
    const allowed = bedsAllowed(level);
    const recipes = FARM_CROPS.map((crop) => {
        const seeds = counts.get(classOf(crop.seed)) ?? 0;
        const unlocked = free || level >= crop.level;
        return {
            id: `${RECIPE_PREFIX}${crop.id}`,
            cat: crop.category,
            out: crop.harvest,
            n: 1,
            ing: [
                [crop.seed, 1, seeds],
                [shovelId, 1, shovel, 1],
            ],
            lvl: crop.level,
            xp: quote(player.steamId, farmSettings.track, paid(crop.xp, "horta")),
            s: 0,
            t: `colheita em ${crop.minutes} min · rende ${crop.least} a ${crop.most}${level >= farmSettings.bonusLevel ? " (+1)" : ""}`,
            lock: !unlocked,
            can: unlocked && seeds >= 1 && shovel >= 1 && mine < allowed && !plots.has(bed.id),
        };
    });
    // The work on the harvest: the bed need not be free, only the garden at hand.
    const work = FARM_PROCESSES.map((process) => {
        const ing = process.ingredients.map(([item, need]): [string, number, number] => [item, need, counts.get(classOf(item)) ?? 0]);
        const unlocked = free || level >= process.level;
        return {
            id: `${PROCESS_PREFIX}${process.id}`,
            cat: process.category,
            out: process.output,
            n: process.amount,
            ing,
            lvl: process.level,
            xp: quote(player.steamId, farmSettings.track, paid(process.xp, "beneficiar")),
            s: 0,
            lock: !unlocked,
            can: unlocked && ing.every(([, need, have]) => have >= need),
            v: "Fazer",
            batch: true,
        };
    });
    const img = craftTitle(FARM_STATION);
    return {
        station: FARM_STATION,
        title: "Horta",
        verb: "Plantar",
        track: farmSettings.track,
        level,
        sub: `${gardenName(bed)} · ${mine} de ${allowed} canteiros seus semeados · nível ${level} de Sobrevivência`,
        recipes: [...recipes, ...work],
        items,
        ...(img === "" ? {} : { img }),
    };
}

export function openFarmPage(player: Player, bed: Bed): void {
    pageBed.set(player.id, bed.id);
    emitLarge(player, "craft.view", JSON.stringify(farmView(player, bed)));
}

function report(player: Player, ok: boolean, text: string): void {
    try {
        player.emit(`${RESOURCE}:craft.result`, JSON.stringify({ ok, text }));
    } catch {
        // Gone already.
    }
    Chat.sendToPlayer(player, text);
    const bedId = pageBed.get(player.id);
    const bed = bedId === undefined ? undefined : bedById(bedId);
    if (bed !== undefined) {
        emitLarge(player, "craft.view", JSON.stringify(farmView(player, bed)));
    }
}

// ---------------------------------------------------------------------------------------------
// The work: sowing a bed, and picking its harvest.

interface Job {
    readonly kind: "plant" | "harvest";
    readonly bed: Bed;
    readonly crop: FarmCrop;
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
    timer: ReturnType<typeof setTimeout> | null;
}

const jobs = new Map<number, Job>();

export function isFarming(player: Player): boolean {
    return jobs.has(player.id);
}

/**
 * The game's own work for each: the gravedigger's digging with a shovel, a woman's hoeing with the hoe (she has no digging), and the herb picking.
 * The hoe is in the RIGHT hand: the game's own hoeing puts its blow's dust at the right hand's slot (`RightHandSlot` in `male.animevents`) and lets
 * go of the hoe with a `Detach ... Right`; it was put in the left at first and a player said the hoe was the wrong way round (2026-10-24: "na animação
 * do agricultor no personagem feminino a enxada está ao contrário").
 */
export const FARM_ANIMATIONS = {
    dig: { fragment: "Digging", item: "shovel", hand: "right" as const },
    hoe: { fragment: "Hoeing", item: "iron_hoe", hand: "right" as const },
    pick: { fragment: "PickingHerbs", item: "", hand: "right" as const },
};

/** The animations already written to the log, once each: what the first use of each looked like. */
const played = new Set<string>();

function play(player: Player, kind: "plant" | "harvest"): void {
    // The others keep the sound of the shovel to those near (work-sound.ts).
    workBegins(player, "horta");
    const female = player.appearance?.gender === "female";
    const chosen = kind === "harvest" ? FARM_ANIMATIONS.pick : female ? FARM_ANIMATIONS.hoe : FARM_ANIMATIONS.dig;
    const how = { loop: true, lockMovement: true };
    lowerTorch(player);
    try {
        if (chosen.item !== "") {
            try {
                player.playAnimation(chosen.fragment, { ...how, props: { item: chosen.item, hand: chosen.hand } });
                if (!played.has(chosen.fragment)) {
                    played.add(chosen.fragment);
                    console.log(`farm: ${chosen.fragment} com ${chosen.item} na mão ${chosen.hand === "right" ? "direita" : "esquerda"}`);
                }
                return;
            } catch (error: unknown) {
                // The tool the catalog does not know: the work is played without it, rather than not at all.
                console.log(`farm: ${chosen.item} não foi aceito como objeto da mão (${error instanceof Error ? error.message : String(error)}); ${chosen.fragment} toca sem ele`);
            }
        }
        player.playAnimation(chosen.fragment, how);
    } catch (error: unknown) {
        console.log(`farm: a animação ${chosen.fragment} não tocou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function stopPlaying(player: Player): void {
    workEnds(player);
    try {
        player.stopAnimation();
    } catch {
        // Gone.
    }
}

function emitState(player: Player, on: boolean): void {
    try {
        player.emit(STATE, JSON.stringify({ on }));
    } catch {
        // Gone already.
    }
}

/** Ends a player's work in the garden; nothing is taken or given. */
export function stopFarming(player: Player, message = ""): boolean {
    const job = jobs.get(player.id);
    if (job === undefined) {
        return false;
    }
    if (job.timer !== null) {
        clearTimeout(job.timer);
    }
    jobs.delete(player.id);
    stopPlaying(player);
    if (job.kind === "harvest") {
        emitState(player, false);
    }
    if (message !== "") {
        if (job.kind === "plant") {
            report(player, false, message);
        } else {
            say(player, message);
        }
    }
    return true;
}

/** Why the player may not sow this crop in this bed now, or "" when they may. */
export function whyNotPlant(player: Player, bed: Bed, crop: FarmCrop): string {
    if (!player.ready || !player.alive || player.mounted) {
        return "Agora não dá.";
    }
    if (!mayCraft(player, "horta")) {
        return "Plantar é ofício dos agricultores (guilda Agricolae). Aprenda o ofício com o comerciante da guilda da sua cidade.";
    }
    if (player.steamId === "") {
        return "Sem identificação Steam não há como guardar a sua plantação.";
    }
    const level = levelOf(player);
    if (!usesFreeCrafts(player) && level < crop.level) {
        return `É preciso nível ${crop.level} de sobrevivência para plantar ${crop.name.toLowerCase()}.`;
    }
    if (!nearBed(player, bed)) {
        return "Fique junto do canteiro para plantar.";
    }
    if (plots.has(bed.id)) {
        return "Este canteiro já está semeado.";
    }
    const allowed = bedsAllowed(level);
    if (plotsOf(player.steamId).length >= allowed) {
        return `Você já cuida de ${allowed} canteiros: colha um deles antes de semear outro.`;
    }
    const counts = countsOf(player);
    if (shovelCount(counts) < 1) {
        return "Você precisa de uma pá na bolsa para cavar o canteiro.";
    }
    const seeds = counts.get(classOf(crop.seed)) ?? 0;
    if (seeds < 1) {
        return `Falta: 1x ${CRAFT_ITEMS[crop.seed]?.[0] ?? "semente"} (tem 0).`;
    }
    return "";
}

/** Takes one unit of `item` (ours or the game's) out of the bag. */
function takeOne(player: Player, item: string): boolean {
    const state = Inventory.get(player);
    const wanted = classOf(item);
    const row = state?.items.find((candidate) => String(candidate.item).toLowerCase() === wanted && candidate.amount > 0);
    if (state === null || state === undefined || row === undefined) {
        return false;
    }
    return Inventory.remove(player, { units: [{ id: row.id, amount: 1 }], revision: state.revision }).ok;
}

/** Pays a piece of the gardens' work at its trade's rate, counted to the day's limit (`profession-xp.ts`), and says what it gave. */
function addXp(player: Player, xp: number, trade: Trade): number {
    const given = award(player.steamId, farmSettings.track, paid(xp, trade));
    try {
        player.addXp(farmSettings.track, given);
    } catch (error: unknown) {
        console.log(`farm: o XP não foi dado a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return given;
}

/** "Plantar" on the page: the bed is dug for `plantSeconds`, then the seed goes in. */
export function plantFromPage(player: Player, recipeId: string): string {
    const crop = CROPS.get(recipeId.startsWith(RECIPE_PREFIX) ? recipeId.slice(RECIPE_PREFIX.length) : recipeId);
    const bedId = pageBed.get(player.id);
    const bed = bedId === undefined ? undefined : bedById(bedId);
    if (crop === undefined || bed === undefined) {
        report(player, false, "Escolha um canteiro de horta (E junto dele) antes de plantar.");
        return "sem canteiro";
    }
    if (jobs.has(player.id) || isWorking(player) || isGathering(player)) {
        report(player, false, "Você já está trabalhando em algo.");
        return "ocupado";
    }
    const why = whyNotPlant(player, bed, crop);
    if (why !== "") {
        report(player, false, why);
        return why;
    }
    const at = player.position;
    const job: Job = { kind: "plant", bed, crop, at: { x: at.x, y: at.y, z: at.z }, timer: null };
    jobs.set(player.id, job);
    play(player, "plant");
    const ms = farmSettings.plantSeconds * 1000;
    try {
        player.emit(`${RESOURCE}:craft.progress`, JSON.stringify({ id: `${RECIPE_PREFIX}${crop.id}`, ms, doing: "Cavando e semeando" }));
    } catch {
        // Gone already.
    }
    job.timer = setTimeout(() => {
        job.timer = null;
        try {
            finishPlant(player, job, Date.now());
        } catch (error: unknown) {
            console.log(`farm: a semeadura de ${player.nickname} não terminou: ${error instanceof Error ? error.message : String(error)}`);
            stopFarming(player);
        }
    }, ms);
    return "";
}

/** Why the player may not do this work on the harvest now, or "" when they may: `count` times over, for the ingredients. */
export function whyNotProcess(player: Player, process: FarmProcess, count = 1): string {
    if (!player.ready || !player.alive || player.mounted) {
        return "Agora não dá.";
    }
    if (!mayCraft(player, "horta")) {
        return "Este trabalho é dos agricultores (guilda Agricolae). Aprenda o ofício com o comerciante da guilda da sua cidade.";
    }
    if (!usesFreeCrafts(player) && levelOf(player) < process.level) {
        return `É preciso nível ${process.level} de sobrevivência para isto.`;
    }
    const bedId = pageBed.get(player.id);
    const bed = bedId === undefined ? undefined : bedById(bedId);
    if (bed === undefined || !nearBed(player, bed)) {
        return "Fique junto do canteiro para isso.";
    }
    const counts = countsOf(player);
    const missing = process.ingredients.filter(([item, need]) => (counts.get(classOf(item)) ?? 0) < need * count);
    if (missing.length > 0) {
        return `Falta: ${missing.map(([item, need]) => `${need * count}x ${CRAFT_ITEMS[item]?.[0] ?? item} (tem ${counts.get(classOf(item)) ?? 0})`).join(", ")}.`;
    }
    return "";
}

/** When each player's last piece of work on the harvest was done (`farmSettings.processGapMs`). */
const lastProcess = new Map<number, number>();

/** Takes what the work takes, `count` times over, in one change; false when it is not all there. */
function takeFor(player: Player, process: FarmProcess, count = 1): boolean {
    const state = Inventory.get(player);
    if (state === null) {
        return false;
    }
    const units: Array<{ id: string; amount: number }> = [];
    for (const [item, need] of process.ingredients) {
        let left = need * count;
        for (const row of state.items) {
            if (left <= 0) {
                break;
            }
            if (String(row.item).toLowerCase() !== classOf(item) || row.amount <= 0) {
                continue;
            }
            const amount = Math.min(left, row.amount);
            units.push({ id: row.id, amount });
            left -= amount;
        }
        if (left > 0) {
            return false;
        }
    }
    return Inventory.remove(player, { units, revision: state.revision }).ok;
}

/**
 * A piece of work on the harvest asked for on the page (`beneficiar:<id>`): the ingredients are taken, the product given and the XP, at once. The product is added after
 * the ingredients are taken, and if the bag has no room they are given back. `count` of it (1 to 10, 2026-10-27) are done in one go: the ingredients, the product and the XP
 * are each that many times the work's own.
 */
export function processFromPage(player: Player, pageId: string, count = 1): string {
    const times = batchOf(count);
    const process = PROCESSES.get(pageId.startsWith(PROCESS_PREFIX) ? pageId.slice(PROCESS_PREFIX.length) : pageId);
    if (process === undefined) {
        report(player, false, "Trabalho desconhecido.");
        return "desconhecido";
    }
    if (jobs.has(player.id) || isWorking(player) || isGathering(player)) {
        report(player, false, "Você já está trabalhando em algo.");
        return "ocupado";
    }
    const why = whyNotProcess(player, process, times);
    if (why !== "") {
        report(player, false, why);
        return why;
    }
    const now = Date.now();
    if (now - (lastProcess.get(player.id) ?? Number.NEGATIVE_INFINITY) < farmSettings.processGapMs) {
        report(player, false, "Espere um instante: o que você acabou de fazer ainda está sendo guardado na bolsa.");
        return "cedo";
    }
    if (!takeFor(player, process, times)) {
        report(player, false, "Nada foi feito: o que o trabalho pede não estava mais todo aí.");
        return "faltou";
    }
    const given = Inventory.add(player, { item: classOf(process.output), amount: process.amount * times });
    const name = CRAFT_ITEMS[process.output]?.[0] ?? process.output;
    if (!given.ok) {
        for (const [item, amount] of process.ingredients) {
            Inventory.add(player, { item: classOf(item), amount: amount * times, notify: false });
        }
        report(player, false, given.code === "inventoryCapacity" ? "Nada foi feito: não coube no seu inventário." : "Nada foi feito: o jogo não aceitou o produto, e nada foi gasto.");
        return "sem lugar";
    }
    lastProcess.set(player.id, now);
    const gained = addXp(player, process.xp * times, "beneficiar");
    console.log(`farm: ${player.nickname} fez ${process.amount * times}x ${name} (${process.id}${times > 1 ? `, ${times} vezes` : ""}, +${gained} XP)`);
    report(player, true, `Feito: ${process.amount * times}x ${name} (+${gained} XP).`);
    return "";
}

/** The page's "Parar" while a bed is being sown: nothing is taken. False when there was no sowing to stop. */
export function cancelPlanting(player: Player): boolean {
    if (jobs.get(player.id)?.kind !== "plant") {
        return false;
    }
    stopFarming(player, "Plantio interrompido: nada foi gasto.");
    return true;
}

/** The page was closed: the bed it was for is forgotten, and a sowing it was waiting for is given up (the animation holds the body: nobody is left in it). */
export function farmPageClosed(player: Player): void {
    pageBed.delete(player.id);
    if (jobs.get(player.id)?.kind === "plant") {
        stopFarming(player, "Plantio interrompido: nada foi gasto.");
    }
}

/** The end of the digging: checked again, the seed taken, the bed sown. */
export function finishPlant(player: Player, job: Job, now = Date.now()): boolean {
    if (jobs.get(player.id) !== job) {
        return false;
    }
    jobs.delete(player.id);
    stopPlaying(player);
    const here = player.position;
    if (Math.hypot(here.x - job.at.x, here.y - job.at.y) > farmSettings.stayM) {
        report(player, false, "Você saiu do canteiro: nada foi plantado.");
        return false;
    }
    const why = whyNotPlant(player, job.bed, job.crop);
    if (why !== "") {
        report(player, false, `Nada foi plantado. ${why}`);
        return false;
    }
    if (!takeOne(player, job.crop.seed)) {
        report(player, false, "Nada foi plantado: a semente não estava mais na bolsa.");
        return false;
    }
    const plot: Plot = { bed: job.bed.id, crop: job.crop.id, owner: player.steamId, ownerName: player.nickname, plantedAt: now, readyAt: now + job.crop.minutes * 60_000 };
    plots.set(plot.bed, plot);
    persist();
    showPlot(plot, now);
    addXp(player, farmSettings.plantXp, "horta");
    sendBedsToFarmers();
    console.log(`farm: ${player.nickname} plantou ${job.crop.name} em ${gardenName(job.bed)} (${job.bed.id}); colheita em ${job.crop.minutes} min`);
    report(player, true, `Plantado: ${job.crop.name.toLowerCase()} na ${gardenName(job.bed)}. Volte para colher em ${job.crop.minutes} min.`);
    return true;
}

/** "[E] Colher" at a ripe bed of the player's: picked for `harvestSeconds`, then the harvest. */
export function startHarvest(player: Player, bed: Bed): string {
    const plot = plots.get(bed.id);
    const crop = plot === undefined ? undefined : CROPS.get(plot.crop);
    if (plot === undefined || crop === undefined) {
        return "nada plantado";
    }
    if (jobs.has(player.id) || isWorking(player) || isGathering(player)) {
        say(player, "Você já está trabalhando em algo.");
        return "ocupado";
    }
    const at = player.position;
    const job: Job = { kind: "harvest", bed, crop, at: { x: at.x, y: at.y, z: at.z }, timer: null };
    jobs.set(player.id, job);
    play(player, "harvest");
    emitState(player, true);
    job.timer = setTimeout(() => {
        job.timer = null;
        try {
            finishHarvest(player, job, Date.now());
        } catch (error: unknown) {
            console.log(`farm: a colheita de ${player.nickname} não terminou: ${error instanceof Error ? error.message : String(error)}`);
            stopFarming(player);
        }
    }, farmSettings.harvestSeconds * 1000);
    return "";
}

/** What a harvest gives: how many of the crop, and how many seeds back. */
export function harvestOf(crop: FarmCrop, level: number, roll: number, seedRoll: number, rowLength: number = farmSettings.rowStandardM): { readonly amount: number; readonly seeds: number } {
    const base = crop.least + Math.min(crop.most - crop.least, Math.floor(roll * (crop.most - crop.least + 1))) + (level >= farmSettings.bonusLevel ? 1 : 0);
    return { amount: Math.round(base * rowFactor(rowLength)), seeds: 1 + (seedRoll < farmSettings.secondSeed ? 1 : 0) };
}

/** A row longer than the standard gives more, in proportion, up to twice (2026-10-27: the fields were made longer, and a longer row is more soil to pick from). */
export function rowFactor(length: number): number {
    return Math.min(farmSettings.rowMaxFactor, Math.max(1, length / farmSettings.rowStandardM));
}

export function finishHarvest(player: Player, job: Job, now = Date.now(), random: () => number = Math.random): boolean {
    if (jobs.get(player.id) !== job) {
        return false;
    }
    jobs.delete(player.id);
    stopPlaying(player);
    emitState(player, false);
    const plot = plots.get(job.bed.id);
    if (plot === undefined || plot.owner !== player.steamId || !isRipe(plot, now)) {
        say(player, "Não havia mais o que colher neste canteiro.");
        return false;
    }
    const here = player.position;
    if (Math.hypot(here.x - job.at.x, here.y - job.at.y) > farmSettings.stayM) {
        say(player, "Você saiu do canteiro: nada foi colhido.");
        return false;
    }
    const { amount, seeds } = harvestOf(job.crop, levelOf(player), random(), random(), job.bed.length);
    if (!Inventory.add(player, { item: classOf(job.crop.harvest), amount }).ok) {
        say(player, "A colheita não coube na sua bolsa: abra espaço e colha de novo.");
        return false;
    }
    Inventory.add(player, { item: craftItemGuid(job.crop.seed) ?? job.crop.seed, amount: seeds });
    plots.delete(plot.bed);
    persist();
    clearProps(plot.bed);
    unmarkRipe(plot.bed);
    const gained = addXp(player, job.crop.xp, "horta");
    sendBedsToFarmers();
    const name = CRAFT_ITEMS[job.crop.harvest]?.[0] ?? job.crop.name;
    console.log(`farm: ${player.nickname} colheu ${amount}x ${name} em ${gardenName(job.bed)} (${job.bed.id})`);
    say(player, `Colheita: ${amount}x ${name} e ${seeds} ${seeds === 1 ? "semente" : "sementes"} para semear de novo (+${gained} XP).`);
    return true;
}

/** E at a bed: the page for a free one, the harvest of a ripe one of the player's, a word for the rest. Returns what happened, for the log and the tests. */
export function useBed(player: Player, index: unknown, now = Date.now()): string {
    const bed = typeof index === "number" && Number.isInteger(index) ? beds()[index] : undefined;
    if (bed === undefined || !player.ready || !player.alive) {
        return "nenhum canteiro";
    }
    if (jobs.has(player.id)) {
        stopFarming(player);
        return "parou";
    }
    if (!mayCraft(player, "horta")) {
        say(player, "Lavrar as hortas é ofício dos agricultores (guilda Agricolae). Aprenda o ofício com o comerciante da guilda da sua cidade.");
        return "não é da guilda";
    }
    if (!nearBed(player, bed)) {
        return "longe";
    }
    const plot = plots.get(bed.id);
    if (plot === undefined) {
        openFarmPage(player, bed);
        return "página";
    }
    const crop = CROPS.get(plot.crop);
    if (plot.owner !== player.steamId) {
        say(player, "Este canteiro já foi semeado por outra pessoa.");
        return "de outro";
    }
    if (!isRipe(plot, now)) {
        say(player, `${crop?.name ?? "A plantação"}: falta${plot.readyAt - now >= 120_000 ? "m" : ""} ${minutesText(plot.readyAt - now)} para colher.`);
        return "crescendo";
    }
    return startHarvest(player, bed) || "colhendo";
}

/** The beds grow and spoil: what they show is brought up to date, the sower told of a ripe one, and a forgotten harvest spoils. */
export function tickFarm(now = Date.now()): number {
    let spoiled = 0;
    let changed = false;
    for (const plot of [...plots.values()]) {
        const ripe = isRipe(plot, now);
        if (ripe && now - plot.readyAt > farmSettings.spoilHours * 60 * 60_000) {
            plots.delete(plot.bed);
            clearProps(plot.bed);
            unmarkRipe(plot.bed);
            spoiled += 1;
            changed = true;
            const bed = bedById(plot.bed);
            const owner = Player.all().find((player) => player.steamId === plot.owner && player.ready);
            if (owner !== undefined && bed !== undefined) {
                say(owner, `A sua plantação de ${CROPS.get(plot.crop)?.name.toLowerCase() ?? "horta"} na ${gardenName(bed)} passou do ponto e se perdeu.`);
            }
            console.log(`farm: a plantação de ${plot.ownerName} em ${plot.bed} passou do ponto e se perdeu`);
            continue;
        }
        const before = shown.get(plot.bed)?.stage;
        showPlot(plot, now);
        if (ripe && before !== undefined && before !== 3) {
            changed = true;
            const bed = bedById(plot.bed);
            const owner = Player.all().find((player) => player.steamId === plot.owner && player.ready);
            if (owner !== undefined && bed !== undefined) {
                say(owner, `A sua plantação de ${CROPS.get(plot.crop)?.name.toLowerCase() ?? "horta"} na ${gardenName(bed)} está pronta para colher.`);
            }
        }
        if (ripe) {
            markRipe(plot);
        }
    }
    if (spoiled > 0) {
        persist();
    }
    if (changed) {
        sendBedsToFarmers();
    }
    return spoiled;
}

// ---------------------------------------------------------------------------------------------
// The administrators' and the farmers' word (`/horta`).

export function farmSummary(player: Player, now = Date.now()): string[] {
    const mine = plotsOf(player.steamId);
    const lines = [
        `Hortas: ${farmData().gardens.length} com ${beds().length} canteiros nas aldeias; ${plots.size} semeado(s) agora. Cada agricultor cuida de ${farmSettings.baseBeds} canteiros, mais 1 a cada ${farmSettings.bedsPerLevels} níveis de sobrevivência; uma colheita esquecida se perde ${farmSettings.spoilHours} h depois de pronta.`,
    ];
    if (mine.length === 0) {
        lines.push("Você não tem nada plantado.");
    }
    for (const plot of mine) {
        const bed = bedById(plot.bed);
        const crop = CROPS.get(plot.crop);
        lines.push(`${crop?.name ?? plot.crop} na ${bed === undefined ? plot.bed : gardenName(bed)}: ${isRipe(plot, now) ? "pronta para colher" : `colheita em ${minutesText(plot.readyAt - now)}`}.`);
    }
    return lines;
}

const DIRECTIONS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"] as const;

function compass(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const degrees = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
    return DIRECTIONS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] ?? "norte";
}

/** The gardens nearest the player, with how many of their beds are free. */
export function nearestGardens(player: Player, count = 5): string[] {
    const at = player.position;
    return [...farmData().gardens]
        .map((garden) => ({ garden, distance: Math.hypot(garden.x - at.x, garden.y - at.y) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count)
        .map(({ garden, distance }) => {
            const free = garden.beds.filter((bed) => !plots.has(bed.id)).length;
            return `${garden.name}: ${Math.round(distance)} m a ${compass(at, garden)}, ${free} de ${garden.beds.length} canteiro(s) livre(s).`;
        });
}

// ---------------------------------------------------------------------------------------------
// The beds an administrator marks (`/horta aqui`).

/**
 * A bed marked by hand where the level's own rows miss a plot of a village (user, 2026-10-23: in Suchdol the "[E] Plantar" did not show at
 * a garden bed the player saw; the level's 118 rows are the ones its farmers hoe, and not every visible plot is one). The administrator
 * stands in the middle of the plot, looking the way its rows run, and the bed is there: a garden of its own, numbered after the nearest one.
 * Kept in `playerdata/farm-extra.json`, and loaded before the plantings, so a sown marked bed is there after a restart.
 */
interface Marked {
    readonly id: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    readonly length: number;
}

/** How long a marked row may be, in metres, and how long it is when no length is said. */
export const MARK_LENGTH = { min: 1.5, max: 8, normal: 3 } as const;
/** The nearest garden within this many metres gives the new one its name and number. */
const NAME_RADIUS_M = 400;
/** A marked bed is taken away from this near. */
const UNMARK_REACH_M = 4;

const marked: Marked[] = [];

const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places;

function gardenOfMarked(mark: Marked): Garden {
    return { id: mark.id, name: mark.name, x: mark.x, y: mark.y, z: mark.z, beds: [{ id: `${mark.id}:1`, garden: mark.id, x: mark.x, y: mark.y, z: mark.z, yaw: mark.yaw, length: mark.length }] };
}

function persistMarked(): void {
    try {
        ensureDir(DIR);
        write(MARKED_FILE, { v: 1, gardens: marked });
    } catch (error: unknown) {
        console.log(`farm: não consegui salvar os canteiros marcados: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function loadMarked(): void {
    const loaded = read<{ gardens?: unknown[] }>(MARKED_FILE);
    if (loaded.status === "corrupt") {
        console.error(`farm: ${MARKED_FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
        return;
    }
    if (loaded.status !== "ok" || !Array.isArray(loaded.value.gardens)) {
        return;
    }
    for (const raw of loaded.value.gardens) {
        const row = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
        const numbers = [row["x"], row["y"], row["z"], row["yaw"], row["length"]];
        if (typeof row["id"] !== "string" || typeof row["name"] !== "string" || !numbers.every((value) => typeof value === "number" && Number.isFinite(value)) || farmData().gardens.some((garden) => garden.id === row["id"])) {
            continue;
        }
        const mark: Marked = { id: row["id"], name: row["name"], x: row["x"] as number, y: row["y"] as number, z: row["z"] as number, yaw: row["yaw"] as number, length: row["length"] as number };
        marked.push(mark);
        addGarden(gardenOfMarked(mark));
    }
}

/** "Horta de Suchdol 9": the next number after the nearest garden's own place, or "Horta marcada 1" when no garden is near. */
function nameForNew(at: { readonly x: number; readonly y: number }): { id: string; name: string } {
    let near: Garden | undefined;
    let best = NAME_RADIUS_M;
    for (const garden of farmData().gardens) {
        const gap = Math.hypot(garden.x - at.x, garden.y - at.y);
        if (gap <= best) {
            best = gap;
            near = garden;
        }
    }
    const base = near === undefined ? "Horta marcada" : near.name.replace(/ \d+$/, "");
    const prefix = near === undefined ? "marcada" : near.id.replace(/-\d+$/, "");
    let last = 0;
    for (const garden of farmData().gardens) {
        if (garden.id.startsWith(`${prefix}-`)) {
            last = Math.max(last, Number(garden.id.slice(prefix.length + 1)) || 0);
        }
    }
    return { id: `${prefix}-${last + 1}`, name: `${base} ${last + 1}` };
}

export type Marking = { readonly ok: true; readonly name: string; readonly bed: string } | { readonly ok: false; readonly why: string };

/** A bed where the administrator stands, its row running the way they face. */
export function markBed(player: Player, length: number = MARK_LENGTH.normal): Marking {
    if (!player.ready || !player.alive) {
        return { ok: false, why: "Agora não dá." };
    }
    if (!(length >= MARK_LENGTH.min && length <= MARK_LENGTH.max)) {
        return { ok: false, why: `A fileira tem de ter de ${String(MARK_LENGTH.min).replace(".", ",")} a ${MARK_LENGTH.max} m.` };
    }
    return markAt(player.nickname, player.position, yawOf(player.rotation), length);
}

/** One marked bed at a place, its row running along `heading` (degrees). */
function markAt(by: string, at: { readonly x: number; readonly y: number; readonly z: number }, heading: number, length: number, quiet = false): Marking {
    const covered = beds().find((bed) => distanceToBed(bed, at) < 1 && Math.abs(bed.z - at.z) <= farmSettings.heightM);
    if (covered !== undefined) {
        return { ok: false, why: `Aqui já há um canteiro (${gardenName(covered)}).` };
    }
    const { id, name } = nameForNew(at);
    const mark: Marked = { id, name, x: round(at.x, 2), y: round(at.y, 2), z: round(at.z, 2), yaw: round(((heading % 360) + 360) % 360, 1), length: round(length, 1) };
    marked.push(mark);
    addGarden(gardenOfMarked(mark));
    persistMarked();
    if (!quiet) {
        sendBedsToFarmers();
    }
    console.log(`farm: ${by} marcou o canteiro ${id}:1 (${name}) em ${mark.x} ${mark.y}, fileira de ${mark.length} m a ${mark.yaw} graus`);
    return { ok: true, name, bed: `${id}:1` };
}

/** What a field is: parallel rows side by side, a row and a half metres apart, as many as fit a day's work. */
export const FIELD_ROWS = { min: 2, max: 12, normal: 6, spacingM: 1.6 } as const;

export type FieldMarking = { readonly ok: true; readonly made: number; readonly skipped: number; readonly first: string; readonly last: string } | { readonly ok: false; readonly why: string };

/**
 * A field where the administrator stands (2026-10-27, user: "precisamos estender os campos de arado"): `rows` beds side by side, the first where they stand and the rest to
 * their right, each `length` long and running the way they face. A row that would lie on a bed already there is left out. Marked beds are taken away one at a time, `/horta tirar`.
 */
export function markField(player: Player, rows: number = FIELD_ROWS.normal, length: number = MARK_LENGTH.max): FieldMarking {
    if (!player.ready || !player.alive) {
        return { ok: false, why: "Agora não dá." };
    }
    if (!Number.isInteger(rows) || rows < FIELD_ROWS.min || rows > FIELD_ROWS.max) {
        return { ok: false, why: `Um campo tem de ter de ${FIELD_ROWS.min} a ${FIELD_ROWS.max} fileiras.` };
    }
    if (!(length >= MARK_LENGTH.min && length <= MARK_LENGTH.max)) {
        return { ok: false, why: `A fileira tem de ter de ${String(MARK_LENGTH.min).replace(".", ",")} a ${MARK_LENGTH.max} m.` };
    }
    const at = player.position;
    const heading = yawOf(player.rotation);
    const radians = (heading * Math.PI) / 180;
    // To the right of the way they face: the way the row runs is (-sin, cos), and its right hand (cos, sin).
    const right = { x: Math.cos(radians), y: Math.sin(radians) };
    let made = 0;
    let first = "";
    let last = "";
    for (let row = 0; row < rows; row += 1) {
        const place = { x: at.x + right.x * row * FIELD_ROWS.spacingM, y: at.y + right.y * row * FIELD_ROWS.spacingM, z: at.z };
        const marking = markAt(player.nickname, place, heading, length, true);
        if (marking.ok) {
            made += 1;
            first = first === "" ? marking.name : first;
            last = marking.name;
        }
    }
    if (made === 0) {
        return { ok: false, why: "Aqui já há canteiros: ande para um chão livre." };
    }
    sendBedsToFarmers();
    return { ok: true, made, skipped: rows - made, first, last };
}

export type Unmarking = { readonly ok: true; readonly name: string; readonly lost: string } | { readonly ok: false; readonly why: string };

/** The marked bed nearest the administrator (within a few metres) is taken away, with what was sown in it. */
export function unmarkBed(player: Player): Unmarking {
    const at = player.position;
    let target: Marked | undefined;
    let best = UNMARK_REACH_M;
    for (const mark of marked) {
        const bed = bedById(`${mark.id}:1`);
        const gap = bed === undefined ? Infinity : distanceToBed(bed, at);
        if (gap <= best) {
            best = gap;
            target = mark;
        }
    }
    if (target === undefined) {
        return { ok: false, why: "Nenhum canteiro marcado a até 4 m. Os da fileira do próprio jogo não se tiram." };
    }
    const bedId = `${target.id}:1`;
    const plot = plots.get(bedId);
    clearProps(bedId);
    unmarkRipe(bedId);
    if (plot !== undefined) {
        plots.delete(bedId);
        persist();
    }
    marked.splice(marked.indexOf(target), 1);
    removeGarden(target.id);
    persistMarked();
    sendBedsToFarmers();
    console.log(`farm: ${player.nickname} tirou o canteiro marcado ${bedId} (${target.name})${plot === undefined ? "" : `; a plantação de ${plot.ownerName} nele se desfez`}`);
    return { ok: true, name: target.name, lost: plot === undefined ? "" : plot.ownerName };
}

/** Every sown bed ripe now (`/horta crescer`, to try it). */
export function ripenAll(now = Date.now()): number {
    for (const plot of plots.values()) {
        plot.readyAt = Math.min(plot.readyAt, now);
        plot.plantedAt = Math.min(plot.plantedAt, now - 1);
    }
    persist();
    tickFarm(now);
    sendBedsToFarmers();
    return plots.size;
}

/** Empties every bed (`/horta limpar`). */
/** The beds a deleted character had sown go back to the village, their plants taken up (2026-10-25, user: "ao apagar o personagem deve perder os cavalos, carroças e tudo, até apoiador"). How many. */
export function clearPlotsOf(steamId: string): number {
    if (steamId === "") {
        return 0;
    }
    let count = 0;
    for (const plot of [...plots.values()]) {
        if (plot.owner !== steamId) {
            continue;
        }
        clearProps(plot.bed);
        unmarkRipe(plot.bed);
        plots.delete(plot.bed);
        count += 1;
    }
    if (count > 0) {
        persist();
        sendBedsToFarmers();
    }
    return count;
}

export function clearAll(): number {
    const count = plots.size;
    for (const bedId of [...plots.keys()]) {
        clearProps(bedId);
        unmarkRipe(bedId);
    }
    plots.clear();
    persist();
    sendBedsToFarmers();
    return count;
}

// ---------------------------------------------------------------------------------------------

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 512) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function installFarm(): void {
    loadMarked();
    load();
    const now = Date.now();
    for (const plot of plots.values()) {
        showPlot(plot, now);
    }
    Events.onClient(ASK, (sender) => sendBeds(sender as Player));
    Events.onClient(USE, (sender, payload) => {
        const player = sender as Player;
        try {
            useBed(player, fieldsOf(payload)["b"]);
        } catch (error: unknown) {
            console.log(`farm: o E de ${player.nickname} num canteiro falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    Events.onClient(STOP, (sender) => {
        stopFarming(sender as Player);
    });
    // (The page's "Plantar", its "Parar" and its closing come through `craft-menu.ts`, which owns those three events: `plantFromPage`,
    // `cancelPlanting`, `farmPageClosed`.)
    Events.on("playerDamage", (player) => {
        if (jobs.has(player.id)) {
            stopFarming(player, "Você foi interrompido.");
        }
    });
    Events.on("playerAnimationEnd", (player, _fragment, reason) => {
        if (reason === "interrupted" && jobs.has(player.id)) {
            stopFarming(player, "Você foi interrompido.");
        }
    });
    Events.on("playerSpawned", (player) => {
        sendBeds(player);
        for (const plot of plotsOf(player.steamId)) {
            if (isRipe(plot, Date.now())) {
                markRipe(plot);
            }
        }
    });
    onGuildChange((steamId) => {
        for (const player of Player.all()) {
            if (player.steamId === steamId) {
                sendBeds(player);
            }
        }
    });
    Events.on("playerDisconnect", (player) => {
        const job = jobs.get(player.id);
        if (job !== undefined && job.timer !== null) {
            clearTimeout(job.timer);
        }
        jobs.delete(player.id);
        pageBed.delete(player.id);
        lastProcess.delete(player.id);
        for (const plot of plotsOf(player.steamId)) {
            unmarkRipe(plot.bed);
        }
    });
    const timer = setInterval(() => {
        try {
            tickFarm();
        } catch (error: unknown) {
            console.log(`farm: a volta pelas hortas falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, farmSettings.tickMs);
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        persist();
        for (const bedId of [...shown.keys()]) {
            clearProps(bedId);
        }
        for (const bedId of [...ripeBlips.keys()]) {
            unmarkRipe(bedId);
        }
    });
    console.log(`farm: ${farmData().gardens.length} horta(s) com ${beds().length} canteiro(s); ${plots.size} semeado(s); ${FARM_CROPS.length} plantas, ${farmSettings.plantSeconds} s para semear`);
}
