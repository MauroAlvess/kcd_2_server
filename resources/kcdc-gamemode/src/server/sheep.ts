/**
 * Wool (user, 2026-10-31: "existe um sistema de retirar leite de vacas do agricultor, vamos fazer nas ovelhas para cortar linho, no caso retirar linho igual, mas o jogador pega linho"): the
 * Agricultores shear the living sheep as they milk the cow (`cows.ts`), and what they take is flax, the item the fields of flax give and the artisans' thread is made of.
 *
 * The same way, number for number: the client is told which sheep, ewe or ram, is nearest to a farmer and stands within reach (`sheep.near`), and its own E, heard while the aim is on that
 * sheep, asks to shear it (`sheep.shear`); the farm animals have no use of their own, so nothing of the game's answers the press. The farmer is held in the picking animation for
 * `shearSettings.seconds` (and the client lets them off it by a step, `sheep.stop`), then the flax comes, with a little XP of survival; the same sheep gives again after half an hour. The sheep
 * stands still meanwhile and walks again when the work ends or is given up (`animalPopulation.hold` and `release`). A farmer who is milking, farming, crafting or gathering shears nothing
 * (`livestock-work.ts` for the two at an animal).
 */

import { animalPopulation } from "./animals.js";
import { FARM_CROPS } from "./craft-data.js";
import { isWorking } from "./craft.js";
import { isFarming } from "./farm.js";
import { isGathering } from "./gather.js";
import { mayCraft } from "./guild-crafts.js";
import { livestockWork } from "./livestock-work.js";
import { award, paid } from "./profession-xp.js";
import { allowedTo, EDGE_M, reachTo } from "./reach.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const NEAR = `${RESOURCE}:sheep.near`;
const SHEAR = `${RESOURCE}:sheep.shear`;
const STOP = `${RESOURCE}:sheep.stop`;
const STATE = `${RESOURCE}:sheep.state`;
const WORK = "tosquia";

/** The game's classes of the sheep: the ewe and the ram. */
export const SHEEP: readonly string[] = ["SheepEwe", "SheepRam"];

/** The flax of the fields (the harvest of the crop "linho"), the item a shearing gives. */
export const FLAX_ITEM: string = FARM_CROPS.find((crop) => crop.id === "linho")?.harvest ?? "5c9aa2cf-0117-46cc-a7c7-1eb8bcc59dc6";

export const shearSettings = {
    /** How near a sheep the client is told of it (the E's reach to its middle), and how near the press must be to be believed (`reach.ts`). */
    nearM: reachTo(EDGE_M.sheep),
    askM: allowedTo(EDGE_M.sheep),
    heightM: 3,
    /** How long the shearing takes. */
    seconds: 6,
    /** How far the body may move from where the work began before it stops. */
    stayM: 1.5,
    /** The same sheep gives again after this long. */
    cooldownMs: 30 * 60_000,
    least: 1,
    most: 3,
    /** One more from this level of survival, as a harvest's. */
    bonusLevel: 15,
    xp: 4,
    track: "survival",
    /** The client is told of the nearest sheep this often, and only when it has moved on or come into reach or gone out of it. */
    nearEveryMs: 400,
};

interface Job {
    readonly sheep: number;
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
    timer: ReturnType<typeof setTimeout> | null;
}

const jobs = new Map<number, Job>();
/** When each sheep was last shorn, by its body's id. */
const shornAt = new Map<number, number>();
/** What each client was last told of its nearest sheep. */
const told = new Map<number, string>();

const round = (value: number): number => Math.round(value * 4) / 4;

function say(player: Player, text: string): void {
    try {
        Chat.sendToPlayer(player, text);
    } catch {
        // Gone already.
    }
}

function levelOf(player: Player): number {
    try {
        return player.getTrack(shearSettings.track)?.level ?? 0;
    } catch {
        return 0;
    }
}

/** How much flax a shearing gives: the range, from a roll in [0, 1), and one more from the bonus level. */
export function amountOf(level: number, roll: number): number {
    const { least, most, bonusLevel } = shearSettings;
    return least + Math.min(most - least, Math.floor(roll * (most - least + 1))) + (level >= bonusLevel ? 1 : 0);
}

/** How many minutes until the sheep gives again, 0 when it does. */
export function waitMinutes(sheepId: number, now: number = Date.now()): number {
    const left = (shornAt.get(sheepId) ?? Number.NEGATIVE_INFINITY) + shearSettings.cooldownMs - now;
    return left > 0 ? Math.ceil(left / 60_000) : 0;
}

/** Why the player may not shear this sheep now, or "" when they may. */
export function whyNotShear(player: Player, sheepId: unknown, now: number = Date.now()): string {
    if (!player.ready || !player.alive || player.mounted) {
        return "Agora não dá.";
    }
    if (!mayCraft(player, "horta")) {
        return "Tosquiar é ofício dos agricultores (guilda Agricolae): aprenda o ofício com o agricultor da sua cidade.";
    }
    if (typeof sheepId !== "number") {
        return "Escolha uma ovelha.";
    }
    const sheep = Npc.getById(sheepId);
    if (sheep === null || sheep === undefined || !sheep.alive || !SHEEP.includes(sheep.actorClass)) {
        return "Essa ovelha não está mais aí.";
    }
    const here = player.position;
    const at = sheep.position;
    if (Math.hypot(at.x - here.x, at.y - here.y) > shearSettings.askM || Math.abs(at.z - here.z) > shearSettings.heightM) {
        return "Chegue mais perto da ovelha.";
    }
    const wait = waitMinutes(sheepId, now);
    if (wait > 0) {
        return `Esta ovelha foi tosquiada há pouco: volte em ${wait} min.`;
    }
    return "";
}

function emitState(player: Player, on: boolean): void {
    try {
        player.emit(STATE, JSON.stringify({ on }));
    } catch {
        // Gone already.
    }
}

function play(player: Player): void {
    lowerTorch(player);
    try {
        player.playAnimation("PickingHerbs", { loop: true, lockMovement: true });
    } catch (error: unknown) {
        console.log(`sheep: a animação não tocou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function stopPlaying(player: Player): void {
    try {
        player.stopAnimation();
    } catch {
        // Gone.
    }
}

/** The sheep stands for the shearing, and a little longer than it takes, so that a lost release cannot keep it for good. */
const holdMs = (): number => (shearSettings.seconds + 15) * 1000;

export function isShearing(player: Player): boolean {
    return jobs.has(player.id);
}

/** Ends a shearing in the middle; nothing is given. False when there was none. */
export function stopShearing(player: Player, message = ""): boolean {
    const job = jobs.get(player.id);
    if (job === undefined) {
        return false;
    }
    if (job.timer !== null) {
        clearTimeout(job.timer);
    }
    jobs.delete(player.id);
    livestockWork.end(player.id);
    animalPopulation.release(job.sheep);
    stopPlaying(player);
    emitState(player, false);
    if (message !== "") {
        say(player, message);
    }
    return true;
}

/** The farmer's E at a sheep: the animation, and the flax after `seconds`. Returns "" when it began, else why not. */
export function startShearing(player: Player, sheepId: unknown, now: number = Date.now()): string {
    if (jobs.has(player.id) || livestockWork.of(player.id) !== "" || isFarming(player) || isWorking(player) || isGathering(player)) {
        say(player, "Você já está trabalhando em algo.");
        return "ocupado";
    }
    const why = whyNotShear(player, sheepId, now);
    if (why !== "") {
        say(player, why);
        return why;
    }
    const here = player.position;
    const job: Job = { sheep: sheepId as number, at: { x: here.x, y: here.y, z: here.z }, timer: null };
    jobs.set(player.id, job);
    livestockWork.begin(player.id, WORK);
    // The sheep stands still until the shearing is over or given up, as the cow does for the milking.
    animalPopulation.hold(job.sheep, holdMs());
    play(player);
    emitState(player, true);
    job.timer = setTimeout(() => {
        job.timer = null;
        try {
            finishShearing(player, job);
        } catch (error: unknown) {
            console.log(`sheep: a tosquia de ${player.nickname} não terminou: ${error instanceof Error ? error.message : String(error)}`);
            stopShearing(player);
        }
    }, shearSettings.seconds * 1000);
    return "";
}

/** The end of the work: the place and the sheep looked at again, and the flax given. */
export function finishShearing(player: Player, job: Job, now: number = Date.now(), random: () => number = Math.random): boolean {
    if (jobs.get(player.id) !== job) {
        return false;
    }
    jobs.delete(player.id);
    livestockWork.end(player.id);
    animalPopulation.release(job.sheep);
    stopPlaying(player);
    emitState(player, false);
    const here = player.position;
    if (Math.hypot(here.x - job.at.x, here.y - job.at.y) > shearSettings.stayM) {
        say(player, "Você saiu do lugar: nada foi tosquiado.");
        return false;
    }
    const why = whyNotShear(player, job.sheep, now);
    if (why !== "") {
        say(player, `Nada foi tosquiado. ${why}`);
        return false;
    }
    const amount = amountOf(levelOf(player), random());
    if (!Inventory.add(player, { item: FLAX_ITEM, amount }).ok) {
        say(player, "O linho não coube na sua bolsa: abra espaço e tosquie de novo.");
        return false;
    }
    shornAt.set(job.sheep, now);
    const xp = award(player.steamId, shearSettings.track, paid(shearSettings.xp, "tosquia"));
    try {
        player.addXp(shearSettings.track, xp);
    } catch (error: unknown) {
        console.log(`sheep: o XP não foi dado a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`sheep: ${player.nickname} tosquiou uma ovelha: ${amount}x linho`);
    say(player, `Tosquia: ${amount}x Linho (+${xp} XP).`);
    return true;
}

/** Tells each farmer's client of the nearest sheep within reach of them, so that its E can ask to shear it. */
export function tellNear(now: number = Date.now()): void {
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        let text = "";
        // The farmer first, then a sheep near, and only then whether the body can shear (alive, on foot): most players are no farmers, and those reads are calls into the engine.
        if (!jobs.has(player.id) && mayCraft(player, "horta")) {
            const [sheep] = animalPopulation.near(SHEEP, player.position, player.virtualWorld, shearSettings.nearM);
            if (sheep !== undefined && player.alive && !player.mounted) {
                text = JSON.stringify({ id: sheep.id, x: round(sheep.x), y: round(sheep.y), z: round(sheep.z), r: waitMinutes(sheep.id, now) === 0 ? 1 : 0 });
            }
        }
        if ((told.get(player.id) ?? "") !== text) {
            told.set(player.id, text);
            try {
                player.emit(NEAR, text === "" ? JSON.stringify({ id: 0 }) : text);
            } catch {
                // Gone already.
            }
        }
    }
}

function idOf(payload: unknown): unknown {
    try {
        return ((typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown } | null)?.id;
    } catch {
        return undefined;
    }
}

export function installSheep(): void {
    Events.onClient(SHEAR, (sender, payload) => {
        startShearing(sender as Player, idOf(payload));
    });
    Events.onClient(STOP, (sender) => {
        stopShearing(sender as Player, "Tosquia interrompida: nada foi tirado.");
    });
    Events.on("npcDestroy", (npc) => {
        shornAt.delete(npc.id);
    });
    Events.on("playerDisconnect", (player) => {
        stopShearing(player);
        told.delete(player.id);
    });
    const timer = setInterval(() => tellNear(), shearSettings.nearEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`sheep: as ovelhas dão linho ao agricultor (E, ${shearSettings.seconds} s; cada ovelha a cada ${shearSettings.cooldownMs / 60_000} min)`);
}
