/**
 * Milk (user, 2026-10-27: "sobre o leite, o jogador da guilda dos agricultores pode extrair de vaca interagindo com a vaca; e o caçador, ao matar, vê leite na vaca também"):
 * the kitchen's creams, curds and cheeses took milk, and the only source was the tavern keepers' vendor.
 *
 * - **The Agricultores milk the living cow.** The client is told which cow is nearest to a farmer and stands within reach (`cow.near`, as the dog's menu is told of its dog),
 *   and its own E, heard while the aim is on that cow, asks to milk it (`cow.milk`); the farm animals are spawned with no use of their own (`interactable: false`,
 *   `animals.ts`), so nothing of the game's answers the press. The farmer is held in the picking-herbs animation for `milkSettings.seconds` (and the client lets them off it
 *   by a step, `cow.stop`), then the milk comes, with a little XP of survival; the same cow gives again after half an hour. The cow stands still meanwhile and walks again
 *   when the work ends or is given up (`animalPopulation.hold` and `release`).
 * - **The hunters find it in the carcass.** When a hunter butchers a cow (`npcHarvested`), the carcass's stock, which is open for them to take, holds some milk beside its
 *   meat and hide. A bull holds none, and anybody who is not a hunter has their carcass emptied as before (`guild-crafts.ts`).
 */

import { animalPopulation } from "./animals.js";
import { isWorking } from "./craft.js";
import { isFarming } from "./farm.js";
import { isGathering } from "./gather.js";
import { mayCraft } from "./guild-crafts.js";
import { paid } from "./profession-xp.js";
import { allowedTo, EDGE_M, reachTo } from "./reach.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const NEAR = `${RESOURCE}:cow.near`;
const MILK = `${RESOURCE}:cow.milk`;
const STOP = `${RESOURCE}:cow.stop`;
const STATE = `${RESOURCE}:cow.state`;

/** The game's class of a milk cow, and the item it gives (the one the kitchen's recipes take). */
export const COW = "CattleCow";
export const MILK_ITEM = "milk";

export const milkSettings = {
    /** How near a cow the client is told of it (the E's reach to its middle), and how near the press must be to be believed (`reach.ts`). */
    nearM: reachTo(EDGE_M.cow),
    askM: allowedTo(EDGE_M.cow),
    heightM: 3,
    /** How long the milking takes. */
    seconds: 6,
    /** How far the body may move from where the work began before it stops. */
    stayM: 1.5,
    /** The same cow gives again after this long. */
    cooldownMs: 30 * 60_000,
    least: 1,
    most: 3,
    /** One more from this level of survival, as a harvest's. */
    bonusLevel: 15,
    xp: 4,
    track: "survival",
    /** The client is told of the nearest cow this often, and only when it has moved on or come into reach or gone out of it. */
    nearEveryMs: 400,
    /** What a hunter's cow carcass holds besides its meat and hide. */
    carcass: { least: 1, most: 3 },
};

interface Job {
    readonly cow: number;
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
    timer: ReturnType<typeof setTimeout> | null;
}

const jobs = new Map<number, Job>();
/** When each cow was last milked, by its body's id. */
const milkedAt = new Map<number, number>();
/** What each client was last told of its nearest cow. */
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
        return player.getTrack(milkSettings.track)?.level ?? 0;
    } catch {
        return 0;
    }
}

/** How much milk a milking gives: the range, from a roll in [0, 1), and one more from the bonus level. */
export function amountOf(level: number, roll: number): number {
    const { least, most, bonusLevel } = milkSettings;
    return least + Math.min(most - least, Math.floor(roll * (most - least + 1))) + (level >= bonusLevel ? 1 : 0);
}

/** How many minutes until the cow gives again, 0 when it does. */
export function waitMinutes(cowId: number, now: number = Date.now()): number {
    const left = (milkedAt.get(cowId) ?? Number.NEGATIVE_INFINITY) + milkSettings.cooldownMs - now;
    return left > 0 ? Math.ceil(left / 60_000) : 0;
}

/** Why the player may not milk this cow now, or "" when they may. */
export function whyNotMilk(player: Player, cowId: unknown, now: number = Date.now()): string {
    if (!player.ready || !player.alive || player.mounted) {
        return "Agora não dá.";
    }
    if (!mayCraft(player, "horta")) {
        return "Ordenhar é ofício dos agricultores (guilda Agricolae). Escolha a guilda no painel (F2), em Guildas.";
    }
    if (typeof cowId !== "number") {
        return "Escolha uma vaca.";
    }
    const cow = Npc.getById(cowId);
    if (cow === null || cow === undefined || !cow.alive || cow.actorClass !== COW) {
        return "Essa vaca não está mais aí.";
    }
    const here = player.position;
    const at = cow.position;
    if (Math.hypot(at.x - here.x, at.y - here.y) > milkSettings.askM || Math.abs(at.z - here.z) > milkSettings.heightM) {
        return "Chegue mais perto da vaca.";
    }
    const wait = waitMinutes(cowId, now);
    if (wait > 0) {
        return `Esta vaca foi ordenhada há pouco: volte em ${wait} min.`;
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
        console.log(`cows: a animação não tocou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function stopPlaying(player: Player): void {
    try {
        player.stopAnimation();
    } catch {
        // Gone.
    }
}

/** The cow stands for the milking, and a little longer than it takes, so that a lost release cannot keep it for good. */
const holdMs = (): number => (milkSettings.seconds + 15) * 1000;

export function isMilking(player: Player): boolean {
    return jobs.has(player.id);
}

/** Ends a milking in the middle; nothing is given. False when there was none. */
export function stopMilking(player: Player, message = ""): boolean {
    const job = jobs.get(player.id);
    if (job === undefined) {
        return false;
    }
    if (job.timer !== null) {
        clearTimeout(job.timer);
    }
    jobs.delete(player.id);
    animalPopulation.release(job.cow);
    stopPlaying(player);
    emitState(player, false);
    if (message !== "") {
        say(player, message);
    }
    return true;
}

/** The farmer's E at a cow: the animation, and the milk after `seconds`. Returns "" when it began, else why not. */
export function startMilking(player: Player, cowId: unknown, now: number = Date.now()): string {
    if (jobs.has(player.id) || isFarming(player) || isWorking(player) || isGathering(player)) {
        say(player, "Você já está trabalhando em algo.");
        return "ocupado";
    }
    const why = whyNotMilk(player, cowId, now);
    if (why !== "") {
        say(player, why);
        return why;
    }
    const here = player.position;
    const job: Job = { cow: cowId as number, at: { x: here.x, y: here.y, z: here.z }, timer: null };
    jobs.set(player.id, job);
    // The cow stands still until the milking is over or given up (user, 2026-10-27: "quando ordenhar uma vaca ela deve ficar parada e só voltar a andar quando terminar, ou andar e cancelar a ordenha").
    animalPopulation.hold(job.cow, holdMs());
    play(player);
    emitState(player, true);
    job.timer = setTimeout(() => {
        job.timer = null;
        try {
            finishMilking(player, job);
        } catch (error: unknown) {
            console.log(`cows: a ordenha de ${player.nickname} não terminou: ${error instanceof Error ? error.message : String(error)}`);
            stopMilking(player);
        }
    }, milkSettings.seconds * 1000);
    return "";
}

/** The end of the work: the place and the cow looked at again, and the milk given. */
export function finishMilking(player: Player, job: Job, now: number = Date.now(), random: () => number = Math.random): boolean {
    if (jobs.get(player.id) !== job) {
        return false;
    }
    jobs.delete(player.id);
    animalPopulation.release(job.cow);
    stopPlaying(player);
    emitState(player, false);
    const here = player.position;
    if (Math.hypot(here.x - job.at.x, here.y - job.at.y) > milkSettings.stayM) {
        say(player, "Você saiu do lugar: nada foi ordenhado.");
        return false;
    }
    const why = whyNotMilk(player, job.cow, now);
    if (why !== "") {
        say(player, `Nada foi ordenhado. ${why}`);
        return false;
    }
    const amount = amountOf(levelOf(player), random());
    if (!Inventory.add(player, { item: MILK_ITEM, amount }).ok) {
        say(player, "O leite não coube na sua bolsa: abra espaço e ordenhe de novo.");
        return false;
    }
    milkedAt.set(job.cow, now);
    const xp = paid(milkSettings.xp);
    try {
        player.addXp(milkSettings.track, xp);
    } catch (error: unknown) {
        console.log(`cows: o XP não foi dado a ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`cows: ${player.nickname} ordenhou uma vaca: ${amount}x leite`);
    say(player, `Ordenha: ${amount}x Leite (+${xp} XP).`);
    return true;
}

/**
 * The milk in a cow a hunter has butchered (`npcHarvested`: the carcass's stock is open for them to take). Nothing for a bull or any other body, nothing for one who is not a
 * hunter (their carcass is emptied by `guild-crafts.ts`, whichever of the two handlers runs first). How much was put in; 0 when none.
 */
export function carcassMilk(carcass: Npc, player: Player, random: () => number = Math.random): number {
    if (carcass.actorClass !== COW || !mayCraft(player, "abate")) {
        return 0;
    }
    const { least, most } = milkSettings.carcass;
    const amount = least + Math.floor(random() * (most - least + 1));
    try {
        const added = Inventory.add(carcass, { item: MILK_ITEM, amount, notify: false });
        if (!added.ok) {
            console.log(`cows: o leite não entrou na carcaça (${added.code})`);
            return 0;
        }
    } catch (error: unknown) {
        console.log(`cows: o leite não entrou na carcaça: ${error instanceof Error ? error.message : String(error)}`);
        return 0;
    }
    console.log(`abate: ${player.nickname} abateu uma vaca: ${amount}x leite na carcaça`);
    return amount;
}

/** Tells each farmer's client of the nearest cow within reach of them, so that its E can ask to milk it. */
export function tellNear(now: number = Date.now()): void {
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        let text = "";
        // The farmer first, then a cow near, and only then whether the body can milk (alive, on foot): most players are no farmers, and those reads are
        // calls into the engine, for thirty players, two and a half times a second (2026-10-27). The answer is the same.
        if (!jobs.has(player.id) && mayCraft(player, "horta")) {
            const [cow] = animalPopulation.near(COW, player.position, player.virtualWorld, milkSettings.nearM);
            if (cow !== undefined && player.alive && !player.mounted) {
                text = JSON.stringify({ id: cow.id, x: round(cow.x), y: round(cow.y), z: round(cow.z), r: waitMinutes(cow.id, now) === 0 ? 1 : 0 });
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

export function installCows(): void {
    Events.onClient(MILK, (sender, payload) => {
        startMilking(sender as Player, idOf(payload));
    });
    Events.onClient(STOP, (sender) => {
        stopMilking(sender as Player, "Ordenha interrompida: nada foi tirado.");
    });
    Events.on("npcHarvested", (npc, player) => {
        carcassMilk(npc, player);
    });
    Events.on("npcDestroy", (npc) => {
        milkedAt.delete(npc.id);
    });
    Events.on("playerDisconnect", (player) => {
        stopMilking(player);
        told.delete(player.id);
    });
    const timer = setInterval(() => tellNear(), milkSettings.nearEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`cows: as vacas dão leite ao agricultor (E, ${milkSettings.seconds} s; cada vaca a cada ${milkSettings.cooldownMs / 60_000} min) e ao caçador, na carcaça`);
}
