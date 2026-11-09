/**
 * Arrest and the pillory (user, 2026-10-29: "nos cargos que fizerem exemplo guarda, capitão, milícia, ter uma opção nova de, ao apertar E em um jogador que seja abaixo deles em
 * nível hierárquico, prender: o jogador fica com as mãos algemadas e não consegue fazer nada além de andar, nem correr, nem abrir nenhum menu além de Esc, e falar; ele pode ser
 * solto; além disso colocar no pelourinho: chegar no pelourinho, apertar E, escolher colocar, aparecem os nomes dos jogadores presos, escolhe e põe a quantidade de tempo, 15 min,
 * 30 min, 1 h, 2 h; quando o tempo acabar o jogador sai; e se deslogar e logar continua preso se não acabou o tempo").
 *
 * Who may arrest: a holder of one of the titles of `ARREST_TITLES` (nobility.ts: the soldier, the guards, the captains, the bailiff, the judge, the knights and the lords above them),
 * and an administrator; and only somebody BELOW them on the realm's ladder (`levelOfPlayer`: the level of their highest title, and for one with no title a noble stands at 5, a lesser
 * noble at 6 and a commoner at 7). The talk key (E) on that person offers "Prender" in the list of `encounters.ts`; on somebody already arrested it offers "Soltar" to whoever
 * outranks them and answers to no lower a level than the one who arrested them (the one who arrested may always).
 *
 * An arrested player (kind `cuffs`) is held to a walk (`setMovementMode`, the engine's own run and sprint permissions), the game's menus and its actions are taken away on their client
 * (`src/client/arrest.ts`: the sword, the use key, the bag, the map ... everything but the pause menu, the chat and the voice), and the server drops every message their client sends for
 * anything but a few it needs to stay in the game (`installRestraintGate`: a page that is somehow open does nothing). Handcuffs end by themselves after `CUFF_MAX_MS`, so nobody is left
 * bound for ever when no officer is about. Death ends them too.
 *
 * The pillory (kind `pillory`): the villages' own, which the level has (`PILLORIES`, read out of `level.pak`). An officer within a few metres of one has a hint, "Pelourinho",
 * on E (`arrest.pillory`): the page of the game's dialogue lists the arrested standing near, then the four sentences. The one put in is set at the pillory and kept there until the
 * time is over, which is counted by the clock and goes on while they are away: a player who logs out and in again is still held, to the minute. Kept in `playerdata/arrests.json`.
 *
 * In the stocks (2026-11-01, user: "tentei colocar um jogador no pelourinho, ele não ficou na posição e preso ao pelourinho"): until then the body was only teleported to the spot
 * where the level's own pillory event spawns its prisoner, two metres behind the stocks, and pulled back when it walked off. A man is now set at the stocks' very origin, turned as they
 * are (the game's smart object puts whoever it locks in there: `Libs/SmartObjects.xml`, helper "pillory" at 0,0,0), and given the game's own pose, the `Pillory` fragment
 * (`quest_pillory`, a loop), with his movement held. The game has that pose for men only: a woman kneels beside the stocks, weeping (`CryingKneeling`). A pose the game refuses
 * falls back to the beggar's kneel, and that to the old leash. Pushed or knocked off the place, the body is set again, a few times a minute at most; let go, it steps out beside them.
 *
 * Held still (2026-11-01, user: "pelourinho faz a animação mas o jogador consegue sair andando, e ao prender normal um jogador temos que travar em uma animação parecida de mão
 * cruzada"): the walk keys of whoever is in the pillory are taken away on their client (`still`), and a body that walked off the stocks (`WALKED_OFF_M`) is put back whatever the
 * count of the minute, which had let a walker go after four. A prisoner in handcuffs is held in the game's pose of a man with his hands tied behind him (`Tied`; a woman sits tied,
 * `TiedUpIdle_Slave`), his walk keys taken away too, until an officer leads him ("Conduzir", E on him): led, he walks, and is brought to the officer's side when he falls behind.
 */

import { isAdmin } from "./auth.js";
import { nameOf } from "./acquaintances.js";
import { addCommandGate } from "./command.js";
import { COMMONER_LEVEL, levelOfTitles, mayArrestWith } from "./nobility.js";
import { getSocialStatus } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { titlesOf } from "./titles.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/arrests.json`;

export type ArrestKind = "cuffs" | "pillory";

/** How long handcuffs hold when no officer has taken the prisoner to the pillory (and no officer has let them go): half an hour. */
export const CUFF_MAX_MS = 30 * 60_000;

/** The sentences of the pillory (user: 15 m, 30 m, 1 h, 2 h). */
export const SENTENCES: ReadonlyArray<{ readonly id: string; readonly minutes: number; readonly text: string }> = [
    { id: "15", minutes: 15, text: "15 minutos" },
    { id: "30", minutes: 30, text: "30 minutos" },
    { id: "60", minutes: 60, text: "1 hora" },
    { id: "120", minutes: 120, text: "2 horas" },
];

/** How near a pillory an officer must stand (planar, metres) and how far above or below. */
export const PILLORY_REACH_M = 3.5;
const PILLORY_REACH_Z_M = 4;
/** How far from the officer an arrested player may stand and still be listed for the pillory. */
export const PRISONER_NEAR_M = 40;
/** How far a prisoner of the pillory held by no pose (the game refused them all) may drift from their spot before the server puts them back. */
export const PIN_M = 1.2;
/** The most arrested players one page of the game's list can offer (it takes eight rows, one is "Sair"). */
const LIST_MAX = 7;

/** The game's own pose of a man locked in the stocks: the `Pillory` fragment of the male database (`quest_pillory`, in a loop). */
export const STOCKS_FRAGMENT = "Pillory";
/** The stocks' pose is the male database's only: a woman kneels beside them, weeping (`CryingKneeling` of the female one, `behavior_crying_kneeling_loop`). */
export const KNEEL_FRAGMENT = "CryingKneeling";
/** What a body kneels with when its own pose is refused: the beggar's kneel, which both databases have. */
export const BEG_FRAGMENT = { fragment: "Beggar", tags: "beggarKneel" } as const;
/** How near its place (planar, metres) a body must come before its pose is played: the stocks' own origin, or the spot beside them. */
export const STOCKS_NEAR_M = 0.3;
export const SIDE_NEAR_M = 0.6;
/** How far off its place a body held by its pose may be pushed (a blow, the stocks' own collision) before it is set again. */
export const STOCKS_OFF_M = 0.5;
export const SIDE_OFF_M = 0.9;
/** How long a body is given to come to its place before it is set again, or its pose played where it stands. */
export const ARRIVE_MS = 2_500;
/** At most this many settings of a body in a minute: one the game keeps pushing out is left where it is, still held by its pose. */
export const SETTINGS_PER_MINUTE = 4;
/** A body this far off its place (or a level above or below it) walked there: it is put back every time, whatever the count of the minute (2026-11-01). */
export const WALKED_OFF_M = 1.2;

/** The game's own pose of a man with his hands tied behind him (`Tied`, `hands_tied_back_idle`, a loop), for one in handcuffs (2026-11-01). */
export const CUFFS_FRAGMENT = "Tied";
/** The female database has no pose of a woman standing tied: she sits tied, the only one it has (`TiedUpIdle_Slave`, `quest_deliverance_idle_female`). */
export const CUFFS_FEMALE = { fragment: "TiedUpIdle_Slave", tags: "sit" } as const;
/** A prisoner an officer leads walks; one farther than `ESCORT_KEEP_M` from him is brought to his side, and an officer farther than `ESCORT_LOST_M` lets go. */
export const ESCORT_KEEP_M = 8;
export const ESCORT_LOST_M = 60;

/** A place for a body, and the way it faces: degrees, 0 along +Y, counter-clockwise seen from above (as `player.spawn` and `furniture.ts` turn a body). */
export interface Spot {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly heading: number;
}

export interface Pillory extends Spot {
    readonly id: string;
    readonly name: string;
    /**
     * The stocks themselves are `x`, `y`, `z` and `heading`: the level's own `so_pillory`, whose smart object sets whoever it locks in at its very origin, turned as it is (2026-11-01,
     * `level.pak`; until then these were the spot beside them). `side` is the level's own spot for the prisoner of its pillory event (`spawnPoint_prisoner1`, two metres behind the
     * stocks), where a woman kneels and whoever is let out steps; where the level has none, the ground two metres behind (the field of executions) or the spot it gives Henry to talk to
     * the prisoner (Zikmundovo).
     */
    readonly side: Spot;
}

export const PILLORIES: readonly Pillory[] = [
    { id: "suchdol", name: "Suchdol", x: 573.1456, y: 3253.013, z: 148.7397, heading: -160, side: { x: 573.7242, y: 3254.482, z: 148.7397, heading: -38 } },
    { id: "malesov", name: "Malešov", x: 577.9866, y: 261.8115, z: 110.6818, heading: -178, side: { x: 579.1381, y: 263.0438, z: 110.6818, heading: 161 } },
    { id: "miskowitz", name: "Miskowitz", x: 1519.919, y: 1991.635, z: 146.2762, heading: -25, side: { x: 1518.938, y: 1989.631, z: 146.4727, heading: -23 } },
    { id: "kuttenberg", name: "Kuttenberg, na prefeitura", x: 3174.68, y: 709.3923, z: 53.49768, heading: -110, side: { x: 3172.793, y: 710.4325, z: 53.49768, heading: -109 } },
    { id: "kuttenberg-forca", name: "Kuttenberg, no campo das execuções", x: 3331.798, y: 305.1529, z: 29.16784, heading: -104, side: { x: 3329.76, y: 305.661, z: 29.16784, heading: -104 } },
    { id: "zikmundovo", name: "Zikmundovo", x: 1615.461, y: 2812.618, z: 191.5191, heading: 143, side: { x: 1614.578, y: 2811.501, z: 191.621, heading: -37 } },
];

export interface ArrestRecord {
    readonly steamId: string;
    /** What the prisoner is called (for the list, and when they are away). */
    readonly name: string;
    kind: ArrestKind;
    /** Who arrested them, or last sentenced them: a Steam id, "" for an administrator who has none. */
    by: string;
    byName: string;
    /** The level of that officer: no officer below it lets the prisoner go. */
    byLevel: number;
    readonly at: number;
    until: number;
    /** The pillory they are in, for `pillory`. */
    pillory: string;
}

const records = new Map<string, ArrestRecord>();
let writable = true;
let officerSent = new Map<number, string>();

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, arrests: Object.fromEntries(records) });
    } catch (error: unknown) {
        console.log(`arrest: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function playerBySteam(steamId: string): Player | null {
    return steamId === "" ? null : (Player.all().find((player) => player.steamId === steamId && player.ready) ?? null);
}

function apart(a: Player, b: Player): number {
    return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
}

// ---------------------------------------------------------------------------------------------
// Who stands where on the ladder, and who may do what.

/** The level of a player on the realm's ladder: 1 the King ... 7 a commoner with no title; a noble with none is at 5 and a lesser noble at 6. */
export function levelOfPlayer(steamId: string): number {
    const byTitles = levelOfTitles(titlesOf(steamId));
    if (byTitles < COMMONER_LEVEL) {
        return byTitles;
    }
    const status = getSocialStatus(steamId);
    return status === "nobilis" ? 5 : status === "minor" ? 6 : COMMONER_LEVEL;
}

export function arrestOf(steamId: string): ArrestRecord | null {
    return steamId === "" ? null : (records.get(steamId) ?? null);
}

/** Whether the player is arrested now (handcuffed or in the pillory). */
export function isArrested(player: { readonly steamId: string }): boolean {
    return player.steamId !== "" && records.has(player.steamId);
}

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const yes: Verdict = { ok: true };
const no = (reason: string): Verdict => ({ ok: false, reason });

/** Whether `actor` may arrest `target`: an officer's power, and somebody below them on the ladder. */
export function mayArrest(actor: Player, target: Player): Verdict {
    if (actor.id === target.id) {
        return no("Ninguém se prende a si mesmo.");
    }
    if (target.steamId === "") {
        return no("Essa pessoa não pode ser presa.");
    }
    if (isArrested(actor)) {
        return no("Você está preso.");
    }
    if (isArrested(target)) {
        return no("Essa pessoa já está presa.");
    }
    const staff = isAdmin(actor);
    if (!staff && !mayArrestWith(titlesOf(actor.steamId))) {
        return no("O seu cargo não dá o poder de prender.");
    }
    if (!staff && isAdmin(target)) {
        return no("Você não pode prender essa pessoa.");
    }
    if (!staff && levelOfPlayer(target.steamId) <= levelOfPlayer(actor.steamId)) {
        return no("Só se prende quem está abaixo de você na hierarquia.");
    }
    return yes;
}

/** Whether `actor` may let `record`'s prisoner go, or put them in the pillory: an administrator, the one who arrested them, or an officer who outranks them and no lower than the one who arrested. */
export function mayRelease(actor: Player, record: ArrestRecord): Verdict {
    if (isArrested(actor)) {
        return no("Você está preso.");
    }
    if (isAdmin(actor) || (record.by !== "" && record.by === actor.steamId)) {
        return yes;
    }
    if (!mayArrestWith(titlesOf(actor.steamId))) {
        return no("O seu cargo não dá esse poder.");
    }
    const mine = levelOfPlayer(actor.steamId);
    if (mine >= levelOfPlayer(record.steamId)) {
        return no("Só quem está acima do preso na hierarquia o solta.");
    }
    if (mine > record.byLevel) {
        return no("Quem o prendeu está acima de você: só ele, ou alguém acima dele, o solta.");
    }
    return yes;
}

// ---------------------------------------------------------------------------------------------
// Binding and freeing.

/** Prisoners in handcuffs an officer leads (2026-11-01), by Steam id: the officer's network id. */
const escorts = new Map<string, number>();

/** What the prisoner's client is told: held, how, until when, and whether their walk keys are taken away (`still`: in the pillory, and in handcuffs while nobody leads them). */
function statePayload(record: ArrestRecord): string {
    return JSON.stringify({ on: true, kind: record.kind, until: record.until, still: record.kind === "pillory" || !escorts.has(record.steamId) });
}

function bind(player: Player, record: ArrestRecord): void {
    try {
        player.setMovementMode({ walkEnforced: true, walkByDefault: true });
    } catch (error: unknown) {
        console.log(`arrest: o passo de ${record.name} não pôde ser limitado: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        player.dismount();
    } catch {
        // Not on a horse.
    }
    player.emit(`${RESOURCE}:arrest.state`, statePayload(record));
}

function unbind(player: Player): void {
    try {
        player.setMovementMode({ walkEnforced: false, walkByDefault: false });
    } catch {
        // The player is gone.
    }
    player.emit(`${RESOURCE}:arrest.state`, JSON.stringify({ on: false }));
}

function pilloryOf(record: ArrestRecord): Pillory | null {
    return record.kind === "pillory" ? (PILLORIES.find((candidate) => candidate.id === record.pillory) ?? null) : null;
}

// ---------------------------------------------------------------------------------------------
// In the stocks: the body at its place, in its pose (2026-11-01).

/** How a prisoner of the pillory is held: locked in the stocks, kneeling beside them, kneeling as a beggar does, or by the leash alone. */
export type PilloryPose = "stocks" | "kneel" | "beg" | "leash";

const POSES: Readonly<Record<Exclude<PilloryPose, "leash">, { readonly fragment: string; readonly tags: string }>> = {
    stocks: { fragment: STOCKS_FRAGMENT, tags: "" },
    kneel: { fragment: KNEEL_FRAGMENT, tags: "" },
    beg: { fragment: BEG_FRAGMENT.fragment, tags: BEG_FRAGMENT.tags },
};

/** What a pose gives way to when the game refuses it. */
const FALLBACK: Readonly<Record<PilloryPose, PilloryPose>> = { stocks: "beg", kneel: "beg", beg: "leash", leash: "leash" };

interface Hold {
    readonly place: string;
    pose: PilloryPose;
    /** `placing` while the body goes to its place, `on` once its pose was asked for. */
    phase: "placing" | "on";
    since: number;
    /** The minute the settings and replays are counted in, and how many there were in it. */
    windowAt: number;
    settings: number;
    /** Where the body stood when its pose was last played: one that went far from there walked, wherever the game had left it. */
    posedAt?: { readonly x: number; readonly y: number; readonly z: number };
}

/** The prisoners of the pillory who are in the game, by Steam id. */
const holds = new Map<string, Hold>();

/** The pose a body is first held in: the stocks, for a man; kneeling beside them, for a woman. */
function firstPose(player: Player): PilloryPose {
    return player.appearance?.gender === "female" ? "kneel" : "stocks";
}

function spotOf(place: Pillory, pose: PilloryPose): Spot {
    return pose === "stocks" ? place : place.side;
}

const planar = (player: Player, spot: Spot): number => Math.hypot(player.position.x - spot.x, player.position.y - spot.y);

/** Moves a body to a place and turns it: the game's own spawn, which moves a body the way a respawn does (`furniture.ts`), else a plain teleport. */
function putBody(player: Player, spot: Spot): boolean {
    try {
        if (player.spawn(new Vector3(spot.x, spot.y, spot.z), new Vector3(0, 0, spot.heading))) {
            return true;
        }
    } catch {
        // A plain teleport, then.
    }
    try {
        return player.teleport({ x: spot.x, y: spot.y, z: spot.z });
    } catch (error: unknown) {
        console.log(`arrest: ${player.nickname} não pôde ser posto em ${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** Whether the body may be set again, or its pose played again, now: a few times a minute (the leash, which holds nothing else, always). */
function mayRedo(hold: Hold, now: number): boolean {
    if (hold.pose === "leash") {
        return true;
    }
    if (now - hold.windowAt >= 60_000) {
        hold.windowAt = now;
        hold.settings = 0;
    }
    if (hold.settings >= SETTINGS_PER_MINUTE) {
        return false;
    }
    hold.settings += 1;
    return true;
}

/** Sends a prisoner of the pillory to their place in their first pose, as they are sentenced or come back into the game: the pose is played once the body is there (`keep`). */
function holdAt(player: Player, place: Pillory, now: number): void {
    const pose = firstPose(player);
    holds.set(player.steamId, { place: place.id, pose, phase: "placing", since: now, windowAt: now, settings: 1 });
    putBody(player, spotOf(place, pose));
}

function fallBack(player: Player, place: Pillory, hold: Hold, why: string, now: number): void {
    const before = hold.pose;
    hold.pose = FALLBACK[before];
    hold.phase = "placing";
    hold.since = now;
    console.log(`arrest: ${player.nickname} no pelourinho de ${place.name}: ${why} (${before === "leash" ? "sem pose" : POSES[before].fragment}); fica ${hold.pose === "beg" ? "de joelhos, como um mendigo" : "só preso ao lugar"}`);
    putBody(player, spotOf(place, hold.pose));
}

/** Asks the game for the pose, with the body's movement held; a request that does not go out falls back at once (the game's own refusal comes later, `animationEnded`). */
function playPose(player: Player, place: Pillory, hold: Hold, now: number): void {
    hold.phase = "on";
    hold.since = now;
    hold.posedAt = { x: player.position.x, y: player.position.y, z: player.position.z };
    if (hold.pose === "leash") {
        return;
    }
    const { fragment, tags } = POSES[hold.pose];
    let asked = false;
    try {
        asked = player.playAnimation(fragment, tags === "" ? { loop: true, lockMovement: true } : { tags, loop: true, lockMovement: true });
    } catch (error: unknown) {
        console.log(`arrest: o jogo não aceitou '${fragment}' para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!asked) {
        fallBack(player, place, hold, "o pedido da pose não saiu", now);
        return;
    }
    console.log(`arrest: ${player.nickname} no pelourinho de ${place.name}: ${hold.pose === "stocks" ? "preso no tronco" : "de joelhos ao lado"} (${fragment}${tags === "" ? "" : `, ${tags}`}; a ${planar(player, spotOf(place, hold.pose)).toFixed(2)} m do lugar)`);
}

/** A beat of the pillory's hold: the body brought to its place and its pose played, or set again when it was pushed or moved off. */
function keep(player: Player, place: Pillory, now: number): void {
    const hold = holds.get(player.steamId);
    if (hold === undefined || hold.place !== place.id) {
        holdAt(player, place, now);
        return;
    }
    const spot = spotOf(place, hold.pose);
    const off = planar(player, spot);
    const high = Math.abs(player.position.z - spot.z) > 1.5;
    if (hold.phase === "placing") {
        const near = hold.pose === "stocks" ? STOCKS_NEAR_M : hold.pose === "leash" ? PIN_M : SIDE_NEAR_M;
        if (off <= near && !high) {
            playPose(player, place, hold, now);
        } else if (now - hold.since >= ARRIVE_MS) {
            // The game keeping the body off its place a few times a minute is let be: the pose holds it where it is.
            if (mayRedo(hold, now)) {
                hold.since = now;
                putBody(player, spot);
            } else {
                // The game keeps the body off its place: the pose holds it where it is.
                playPose(player, place, hold, now);
            }
        }
        return;
    }
    // Held in its pose and walked off it, not pushed: put back whatever the count of the minute (2026-11-01). Counted from where the pose began, so a body the game itself
    // keeps off its place is not taken for a walker.
    const posed = hold.posedAt;
    const walked = posed === undefined ? off > WALKED_OFF_M || high : Math.hypot(player.position.x - posed.x, player.position.y - posed.y) > WALKED_OFF_M || Math.abs(player.position.z - posed.z) > 1.5;
    const limit = hold.pose === "stocks" ? STOCKS_OFF_M : hold.pose === "leash" ? PIN_M : SIDE_OFF_M;
    if ((off > limit || high) && (walked || mayRedo(hold, now))) {
        hold.phase = "placing";
        hold.since = now;
        putBody(player, spot);
        if (hold.pose !== "leash") {
            console.log(`arrest: ${player.nickname} saiu do lugar no pelourinho de ${place.name} (${off.toFixed(2)} m): posto de novo`);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// In handcuffs: the body held in the tied pose, or led by an officer (2026-11-01).

interface CuffHold {
    /** Whether the pose was asked for and has not ended; not before this is it asked again; whether the game refused it (then the walk keys alone hold the body). */
    playing: boolean;
    nextAt: number;
    refused: boolean;
}

const cuffHolds = new Map<string, CuffHold>();

/** The tied pose for this body: hands tied behind, standing, for a man; sitting tied, for a woman. */
export function cuffsPose(player: { readonly appearance?: { readonly gender?: string } | null }): { readonly fragment: string; readonly tags: string } {
    return player.appearance?.gender === "female" ? CUFFS_FEMALE : { fragment: CUFFS_FRAGMENT, tags: "" };
}

/** Where a prisoner who fell behind is brought: a step and a half from the officer, on the prisoner's side, turned to him. */
function besideOf(officer: Player, prisoner: Player): Spot {
    const dx = prisoner.position.x - officer.position.x;
    const dy = prisoner.position.y - officer.position.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: officer.position.x + (dx / d) * 1.5, y: officer.position.y + (dy / d) * 1.5, z: officer.position.z, heading: (Math.atan2(dx / d, -dy / d) * 180) / Math.PI };
}

/**
 * Ends the tied pose, when it is playing (the prisoner is led, sentenced or freed). `force` stops it whatever `playing` says (2026-11-06, the user: "Sytzigan o Velho ficou bugado algemado infinito"): the
 * pose is a loop with the body locked, and when the game cuts it short (a blow, a teleport) it starts it again by itself while `animationEnded` has already made `playing` false until the next beat, so a
 * prisoner freed in that second was never told to stop and stood in the tied pose, unable to walk, for good.
 */
function stopCuffsPose(player: Player, force = false): void {
    const hold = cuffHolds.get(player.steamId);
    if (hold !== undefined && (hold.playing || force)) {
        hold.playing = false;
        try {
            player.stopAnimation({ standUp: true });
        } catch {
            // Nothing was playing.
        }
    }
}

/** How long after a prisoner is freed from handcuffs the tied pose is asked to stop once more, and who is waiting for it (by Steam id, the moment). */
export const STOP_AGAIN_MS = 1_500;
const stopAgainAt = new Map<string, number>();

/** The second request to stop the tied pose of those freed a moment ago, when they are still free: the first may have come before the game had started it. */
function stopAgain(now: number): void {
    for (const [steamId, at] of [...stopAgainAt]) {
        if (now < at) {
            continue;
        }
        stopAgainAt.delete(steamId);
        const player = playerBySteam(steamId);
        if (player === null || arrestOf(steamId) !== null) {
            continue;
        }
        try {
            player.stopAnimation({ standUp: true });
        } catch {
            // Gone, or nothing was playing.
        }
    }
}

/** A beat of the handcuffs: the tied pose held on a prisoner nobody leads; a prisoner who is led walks at the officer's side. */
function keepCuffs(player: Player, record: ArrestRecord, now: number): void {
    const officerId = escorts.get(record.steamId);
    if (officerId !== undefined) {
        const officer = Player.getById(officerId);
        if (officer === null || !officer.ready || !officer.alive || apart(officer, player) > ESCORT_LOST_M) {
            stopEscort(record, player, officer === null || !officer.ready ? "o oficial saiu" : "o oficial ficou longe demais");
            return;
        }
        if (apart(officer, player) > ESCORT_KEEP_M) {
            putBody(player, besideOf(officer, player));
        }
        return;
    }
    let hold = cuffHolds.get(record.steamId);
    if (hold === undefined) {
        hold = { playing: false, nextAt: now, refused: false };
        cuffHolds.set(record.steamId, hold);
    }
    if (hold.refused || hold.playing || now < hold.nextAt) {
        return;
    }
    hold.nextAt = now + 3_000;
    const { fragment, tags } = cuffsPose(player);
    try {
        hold.playing = player.playAnimation(fragment, tags === "" ? { loop: true, lockMovement: true } : { tags, loop: true, lockMovement: true });
    } catch (error: unknown) {
        hold.refused = true;
        console.log(`arrest: o jogo não aceitou '${fragment}' para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** An officer leads a prisoner in handcuffs: the tied pose ends and the prisoner walks, kept at the officer's side. */
export function escort(actor: Player, target: Player): { readonly ok: boolean; readonly message: string } {
    const record = arrestOf(target.steamId);
    if (record === null || record.kind !== "cuffs") {
        return { ok: false, message: "Essa pessoa não está algemada." };
    }
    const verdict = mayRelease(actor, record);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    if (apart(actor, target) > 8) {
        return { ok: false, message: "Essa pessoa não está mais por perto." };
    }
    escorts.set(record.steamId, actor.id);
    stopCuffsPose(target);
    target.emit(`${RESOURCE}:arrest.state`, statePayload(record));
    console.log(`arrest: ${actor.nickname} está conduzindo ${target.nickname}`);
    tell(target, `${nameOf(actor)} está conduzindo você: acompanhe.`);
    return { ok: true, message: `Você está conduzindo ${record.name}: ele anda com você. Para parar, aperte E nele de novo.` };
}

/** The lead ends: the prisoner stands where they are, held in the tied pose again. */
function stopEscort(record: ArrestRecord, player: Player | null, why: string): void {
    if (!escorts.delete(record.steamId)) {
        return;
    }
    const hold = cuffHolds.get(record.steamId);
    if (hold !== undefined) {
        hold.nextAt = 0;
    }
    if (player !== null) {
        player.emit(`${RESOURCE}:arrest.state`, statePayload(record));
        tell(player, "Ninguém conduz você agora: você fica onde está, de mãos amarradas.");
    }
    console.log(`arrest: ${record.name} não é mais conduzido (${why})`);
}

export function unescort(actor: Player, target: Player): { readonly ok: boolean; readonly message: string } {
    const record = arrestOf(target.steamId);
    if (record === null || !escorts.has(record.steamId)) {
        return { ok: false, message: "Ninguém está conduzindo essa pessoa." };
    }
    if (escorts.get(record.steamId) !== actor.id && !mayRelease(actor, record).ok) {
        return { ok: false, message: "Quem conduz essa pessoa é outro oficial." };
    }
    stopEscort(record, target, `parou: ${actor.nickname}`);
    return { ok: true, message: `Você parou de conduzir ${record.name}.` };
}

/** Whether somebody leads this prisoner, for the tests and the list. */
export function isEscorted(player: { readonly steamId: string }): boolean {
    return escorts.has(player.steamId);
}

/** The game ended a prisoner's pose: refused, it gives way to the next; cut short (a blow, a teleport), it is played again at the next beat, where the body is or after setting it. */
export function animationEnded(player: Player, fragment: string, reason: string, now: number = Date.now()): void {
    const hold = holds.get(player.steamId);
    const record = arrestOf(player.steamId);
    // The tied pose of handcuffs: played again a moment later, unless the game refused it.
    const cuffs = cuffHolds.get(player.steamId);
    if (record !== null && record.kind === "cuffs" && cuffs !== undefined && fragment === cuffsPose(player).fragment) {
        cuffs.playing = false;
        if (reason === "refused") {
            cuffs.refused = true;
            console.log(`arrest: o jogo recusou a pose de mãos amarradas para ${player.nickname}: só o passo e as teclas o seguram`);
        } else {
            cuffs.nextAt = now + 1_000;
        }
        return;
    }
    const place = record === null ? null : pilloryOf(record);
    if (hold === undefined || place === null || hold.phase !== "on" || hold.pose === "leash" || fragment !== POSES[hold.pose].fragment) {
        return;
    }
    if (reason === "refused") {
        fallBack(player, place, hold, "o jogo recusou a pose", now);
    } else if ((reason === "interrupted" || reason === "finished") && mayRedo(hold, now)) {
        hold.phase = "placing";
        hold.since = now;
    }
}

/** How a prisoner of the pillory is held now, for the tests and the log. */
export function poseOf(player: { readonly steamId: string }): { readonly pose: PilloryPose; readonly phase: "placing" | "on" } | null {
    const hold = holds.get(player.steamId);
    return hold === undefined ? null : { pose: hold.pose, phase: hold.phase };
}

/** Whoever is let out of the pillory: the pose ends, and a body still at the stocks steps out beside them. */
function letOut(player: Player, place: Pillory | null): void {
    holds.delete(player.steamId);
    try {
        player.stopAnimation({ standUp: true });
    } catch {
        // Nothing was playing.
    }
    if (place !== null && planar(player, place) <= 1) {
        putBody(player, place.side);
    }
}

function end(record: ArrestRecord, why: string, quiet = false): void {
    records.delete(record.steamId);
    save();
    escorts.delete(record.steamId);
    console.log(`arrest: ${record.name} está livre (${why})`);
    const player = playerBySteam(record.steamId);
    if (player !== null) {
        if (record.kind === "pillory") {
            letOut(player, pilloryOf(record));
        } else {
            stopCuffsPose(player, true);
            stopAgainAt.set(record.steamId, Date.now() + STOP_AGAIN_MS);
        }
        cuffHolds.delete(record.steamId);
        unbind(player);
        if (!quiet) {
            tell(player, why === "tempo" ? (record.kind === "pillory" ? "A sua pena acabou: você está livre." : "As algemas foram tiradas: o tempo acabou.") : "Você está livre.");
        }
    }
}

/** An officer arrests `target`: handcuffed, set to a walk, held for at most `CUFF_MAX_MS`. */
export function arrest(actor: Player, target: Player, now: number = Date.now()): { readonly ok: boolean; readonly message: string } {
    const verdict = mayArrest(actor, target);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    if (apart(actor, target) > 8) {
        return { ok: false, message: "Essa pessoa não está mais por perto." };
    }
    const record: ArrestRecord = {
        steamId: target.steamId,
        name: nameOf(target),
        kind: "cuffs",
        by: actor.steamId,
        byName: nameOf(actor),
        byLevel: isAdmin(actor) ? 0 : levelOfPlayer(actor.steamId),
        at: now,
        until: now + CUFF_MAX_MS,
        pillory: "",
    };
    records.set(record.steamId, record);
    save();
    bind(target, record);
    console.log(`arrest: ${actor.nickname} prendeu ${target.nickname}`);
    tell(target, `${record.byName} prendeu você. As suas mãos estão amarradas e você fica parado; só fala, até que um oficial o conduza, o solte ou o leve ao pelourinho.`);
    return { ok: true, message: `Você prendeu ${record.name}. Pela tecla E nele: conduza-o, solte-o, ou leve-o ao pelourinho.` };
}

/** An officer lets a prisoner go. */
export function release(actor: Player, target: Player): { readonly ok: boolean; readonly message: string } {
    const record = arrestOf(target.steamId);
    if (record === null) {
        return { ok: false, message: "Essa pessoa não está presa." };
    }
    const verdict = mayRelease(actor, record);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    const was = record.kind;
    end(record, "solto", true);
    tell(target, `${nameOf(actor)} soltou você.`);
    return { ok: true, message: `${record.name} foi solto${was === "pillory" ? " do pelourinho" : ""}.` };
}

/** An officer puts an arrested player in a pillory for `minutes`. */
export function sentence(actor: Player, target: Player, placeId: string, minutes: number, now: number = Date.now()): { readonly ok: boolean; readonly message: string } {
    const place = PILLORIES.find((candidate) => candidate.id === placeId);
    const choice = SENTENCES.find((candidate) => candidate.minutes === minutes);
    const record = arrestOf(target.steamId);
    if (place === undefined || choice === undefined) {
        return { ok: false, message: "Esse pelourinho ou essa pena não existe." };
    }
    if (record === null) {
        return { ok: false, message: "Essa pessoa não está presa." };
    }
    const verdict = mayRelease(actor, record);
    if (!verdict.ok) {
        return { ok: false, message: verdict.reason };
    }
    escorts.delete(target.steamId);
    stopCuffsPose(target);
    cuffHolds.delete(target.steamId);
    record.kind = "pillory";
    record.pillory = place.id;
    record.until = now + choice.minutes * 60_000;
    record.by = actor.steamId;
    record.byName = nameOf(actor);
    record.byLevel = isAdmin(actor) ? 0 : levelOfPlayer(actor.steamId);
    save();
    bind(target, record);
    holdAt(target, place, now);
    console.log(`arrest: ${actor.nickname} pôs ${target.nickname} no pelourinho de ${place.name} por ${choice.text}`);
    tell(target, `${record.byName} pôs você no pelourinho de ${place.name} por ${choice.text}. Você sai quando o tempo acabar, mesmo se sair do jogo e voltar.`);
    return { ok: true, message: `${record.name} foi posto no pelourinho de ${place.name} por ${choice.text}.` };
}

// ---------------------------------------------------------------------------------------------
// The talk key on a player: the options of the list.

/** The rows `encounters.ts` adds to the list `speaker` sees for `target`: Prender, or Soltar. */
export function menuOptions(speaker: Player, target: Player): DialogueOption[] {
    const record = arrestOf(target.steamId);
    if (record !== null) {
        if (!mayRelease(speaker, record).ok) {
            return [];
        }
        const options: DialogueOption[] = [{ id: "release", text: record.kind === "pillory" ? "Soltar do pelourinho" : "Soltar", enabled: true }];
        if (record.kind === "cuffs") {
            options.push(escorts.has(record.steamId) ? { id: "unescort", text: "Parar de conduzir", enabled: true } : { id: "escort", text: "Conduzir", enabled: true });
        }
        return options;
    }
    return mayArrest(speaker, target).ok ? [{ id: "arrest", text: "Prender", enabled: true }] : [];
}

/** What the options above do; the text to tell `speaker`, or null for an option that is not these. */
export function choose(speaker: Player, target: Player, option: string): string | null {
    if (option === "arrest") {
        return arrest(speaker, target).message;
    }
    if (option === "release") {
        return release(speaker, target).message;
    }
    if (option === "escort") {
        return escort(speaker, target).message;
    }
    if (option === "unescort") {
        return unescort(speaker, target).message;
    }
    return null;
}

// ---------------------------------------------------------------------------------------------
// The pillory's page: who, then for how long.

interface Page {
    readonly officer: Player;
    readonly place: Pillory;
    step: "who" | "time";
    prisoner: number;
}

const pages = new Map<number, Page>();

function nearPillory(player: Player, place: Pillory): boolean {
    return Math.hypot(player.position.x - place.x, player.position.y - place.y) <= PILLORY_REACH_M + 1.5 && Math.abs(player.position.z - place.z) <= PILLORY_REACH_Z_M;
}

/** The arrested standing near an officer whom they may put in the pillory. */
function listed(officer: Player): Player[] {
    const found: Player[] = [];
    for (const record of records.values()) {
        if (record.kind !== "cuffs" || !mayRelease(officer, record).ok) {
            continue;
        }
        const player = playerBySteam(record.steamId);
        if (player !== null && player.virtualWorld === officer.virtualWorld && apart(officer, player) <= PRISONER_NEAR_M) {
            found.push(player);
        }
    }
    return found.slice(0, LIST_MAX);
}

function whoPage(officer: Player, place: Pillory): DialoguePage {
    const prisoners = listed(officer);
    const options: DialogueOption[] = prisoners.map((player) => ({ id: `p:${player.id}`, text: nameOf(player), enabled: true }));
    options.push({ id: "leave", text: "Sair", enabled: true });
    return { line: prisoners.length > 0 ? `Pelourinho de ${place.name}: quem será posto?` : `Pelourinho de ${place.name}: não há nenhum preso por perto.`, onRight: false, options };
}

function timePage(prisoner: Player, place: Pillory): DialoguePage {
    return {
        line: `${nameOf(prisoner)} no pelourinho de ${place.name}: por quanto tempo?`,
        onRight: false,
        options: [...SENTENCES.map((one) => ({ id: `t:${one.minutes}`, text: one.text, enabled: true })), { id: "back", text: "Voltar", enabled: true }, { id: "leave", text: "Sair", enabled: true }],
    };
}

/** The officer's press of E at a pillory: opens the page if they may and are near. Whether it opened. */
export function openPillory(officer: Player, placeId: unknown): boolean {
    const place = PILLORIES.find((candidate) => candidate.id === placeId);
    if (place === undefined || !officer.ready || !officer.alive || isArrested(officer)) {
        return false;
    }
    if (!isAdmin(officer) && !mayArrestWith(titlesOf(officer.steamId))) {
        return false;
    }
    if (!nearPillory(officer, place) || Dialogue.sessionOf(officer.id) !== 0) {
        return false;
    }
    const session = Dialogue.open(officer.id, whoPage(officer, place));
    if (session === 0) {
        return false;
    }
    pages.set(session, { officer, place, step: "who", prisoner: 0 });
    return true;
}

function closePage(session: number): void {
    pages.delete(session);
    Dialogue.close(session);
}

/** A choice on a dialogue page: true when it was one of this module's pages. */
export function pageChoice(session: number, player: Player, option: string): boolean {
    const page = pages.get(session);
    if (page === undefined || page.officer.id !== player.id) {
        return false;
    }
    if (option === "leave") {
        closePage(session);
        return true;
    }
    if (!nearPillory(player, page.place)) {
        closePage(session);
        tell(player, "Você se afastou do pelourinho.");
        return true;
    }
    if (option === "back") {
        page.step = "who";
        page.prisoner = 0;
        if (!Dialogue.update(session, whoPage(player, page.place))) {
            pages.delete(session);
        }
        return true;
    }
    if (option.startsWith("p:") && page.step === "who") {
        const prisoner = Player.getById(Number(option.slice(2)));
        if (prisoner === null || !listed(player).some((one) => one.id === prisoner.id)) {
            Dialogue.update(session, whoPage(player, page.place));
            tell(player, "Essa pessoa não está mais por perto.");
            return true;
        }
        page.step = "time";
        page.prisoner = prisoner.id;
        if (!Dialogue.update(session, timePage(prisoner, page.place))) {
            pages.delete(session);
        }
        return true;
    }
    if (option.startsWith("t:") && page.step === "time") {
        const prisoner = Player.getById(page.prisoner);
        closePage(session);
        if (prisoner === null) {
            tell(player, "Essa pessoa não está mais por perto.");
            return true;
        }
        tell(player, sentence(player, prisoner, page.place.id, Number(option.slice(2))).message);
        return true;
    }
    return true;
}

export function pageClosed(session: number): void {
    pages.delete(session);
}

// ---------------------------------------------------------------------------------------------
// Time, entries, the officers' hint, and the gate.

/** The pillories an officer is told of, for their client's hint: nothing for a player who has no power to use one. */
function officerPayload(player: Player): string {
    const power = player.steamId !== "" && !isArrested(player) && (isAdmin(player) || mayArrestWith(titlesOf(player.steamId)));
    return JSON.stringify({ on: power, points: power ? PILLORIES.map((place) => ({ id: place.id, x: place.x, y: place.y, z: place.z })) : [] });
}

function tellOfficers(): void {
    const seen = new Set<number>();
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        seen.add(player.id);
        const payload = officerPayload(player);
        if (officerSent.get(player.id) !== payload) {
            officerSent.set(player.id, payload);
            player.emit(`${RESOURCE}:arrest.officer`, payload);
        }
    }
    for (const id of [...officerSent.keys()]) {
        if (!seen.has(id)) {
            officerSent.delete(id);
        }
    }
    // The hold is said again to whoever is under it: the client may not have been ready at the entry, and it takes the same word twice for once.
    for (const record of records.values()) {
        const player = playerBySteam(record.steamId);
        if (player !== null) {
            player.emit(`${RESOURCE}:arrest.state`, statePayload(record));
        }
    }
}

/** A second of the clock: the time of every prisoner, the pillory's hold on those in it. */
export function tick(now: number = Date.now()): void {
    if (stopAgainAt.size > 0) {
        stopAgain(now);
    }
    for (const record of [...records.values()]) {
        if (now >= record.until) {
            end(record, "tempo");
            continue;
        }
        const player = playerBySteam(record.steamId);
        if (player === null) {
            continue;
        }
        if (!player.alive) {
            end(record, "morte", true);
            continue;
        }
        const place = pilloryOf(record);
        if (place !== null) {
            keep(player, place, now);
        } else {
            keepCuffs(player, record, now);
        }
    }
}

/** An arrested player who comes back into the game is held again, or freed if their time ran out meanwhile. */
function entered(player: Player, now: number = Date.now()): void {
    const record = arrestOf(player.steamId);
    if (record === null) {
        return;
    }
    if (now >= record.until) {
        end(record, "tempo");
        return;
    }
    escorts.delete(record.steamId);
    cuffHolds.delete(record.steamId);
    bind(player, record);
    const place = pilloryOf(record);
    if (place !== null) {
        holdAt(player, place, now);
    }
    const minutes = Math.max(1, Math.ceil((record.until - now) / 60_000));
    tell(player, record.kind === "pillory" ? `Você continua no pelourinho de ${place?.name ?? ""}: faltam ${minutes} min.` : `Você continua preso, de mãos amarradas: faltam até ${minutes} min.`);
}

/** The commands an arrested player may still type: the ones that are only speaking, or reading (an administrator is never held). */
export const ALLOWED_COMMANDS_WHILE_ARRESTED: ReadonlySet<string> = new Set(["help", "me", "do", "try", "mute", "unmute", "mutes", "idioma", "language", "camera", "admin"]);

/** The messages an arrested player's client may still send: what keeps it in the game, never what acts. */
export const ALLOWED_WHILE_ARRESTED: ReadonlySet<string> = new Set(["players.peek", "options.get", "options.set", "posture", "combat.sync", "dice.sync", "status.dict", "status.lang", "status.image", "panel.poll"]);

/**
 * Before any module registers a handler for its client's messages (it is installed ahead of `perf-watch`): what an arrested player's client sends is dropped unless it is one
 * of `ALLOWED_WHILE_ARRESTED`. The client takes the actions away already; this is for a page that is open anyway, and for a client that was changed.
 */
export function installRestraintGate(): void {
    const bus = Events as unknown as Record<string, (name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]) => unknown>;
    const real = bus["onClient"];
    if (typeof real !== "function") {
        return;
    }
    bus["onClient"] = function (this: unknown, name: string, handler: (...args: unknown[]) => unknown, ...rest: unknown[]): unknown {
        if (typeof handler !== "function") {
            return real.call(this, name, handler, ...rest);
        }
        const short = name.startsWith(`${RESOURCE}:`) ? name.slice(RESOURCE.length + 1) : name;
        const gated = (sender: unknown, ...args: unknown[]): unknown => {
            const steamId = typeof sender === "object" && sender !== null ? (sender as { steamId?: unknown }).steamId : undefined;
            if (typeof steamId === "string" && records.size > 0 && records.has(steamId) && !ALLOWED_WHILE_ARRESTED.has(short)) {
                return undefined;
            }
            return handler(sender, ...args);
        };
        return real.call(this, name, gated, ...rest);
    };
}

export function installArrest(): void {
    const loaded = read<{ arrests?: Record<string, unknown> }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value.arrests === "object" && loaded.value.arrests !== null) {
        for (const [steamId, raw] of Object.entries(loaded.value.arrests)) {
            const entry = raw as Partial<ArrestRecord> | null;
            if (entry === null || typeof entry !== "object" || steamId === "" || typeof entry.until !== "number" || !Number.isFinite(entry.until)) {
                continue;
            }
            records.set(steamId, {
                steamId,
                name: typeof entry.name === "string" ? entry.name : "",
                kind: entry.kind === "pillory" ? "pillory" : "cuffs",
                by: typeof entry.by === "string" ? entry.by : "",
                byName: typeof entry.byName === "string" ? entry.byName : "",
                byLevel: typeof entry.byLevel === "number" && Number.isFinite(entry.byLevel) ? entry.byLevel : 0,
                at: typeof entry.at === "number" && Number.isFinite(entry.at) ? entry.at : 0,
                until: entry.until,
                pillory: typeof entry.pillory === "string" ? entry.pillory : "",
            });
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`arrest: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    console.log(`arrest: ${records.size} preso(s) guardado(s); ${PILLORIES.length} pelourinho(s) do nível`);

    // Nothing but speaking: no `/preso`, no horse or cart called, no gesture (the chat commands do not pass through the gate of the client's messages).
    addCommandGate((player, name) => (records.has(player.steamId) && !ALLOWED_COMMANDS_WHILE_ARRESTED.has(name) && !isAdmin(player) ? "Você está preso: só pode falar." : null));

    Events.on("playerSpawned", (player) => entered(player));
    Player.all().forEach((player) => {
        if (player.ready) {
            entered(player);
        }
    });
    Events.onClient(`${RESOURCE}:arrest.pillory`, (sender, payload) => {
        const player = sender as Player;
        let value = payload;
        if (typeof value === "string" && value.length <= 128) {
            try {
                value = JSON.parse(value) as unknown;
            } catch {
                return;
            }
        }
        const id = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : undefined;
        openPillory(player, id);
    });
    Events.on("dialogueChoice", (session, player, option) => {
        pageChoice(session, player, option);
    });
    Events.on("dialogueClosed", (session) => pageClosed(session));
    Events.on("playerAnimationEnd", (player, fragment, reason) => animationEnded(player, fragment, reason));
    Events.on("playerDisconnect", (player) => {
        officerSent.delete(player.id);
        holds.delete(player.steamId);
        cuffHolds.delete(player.steamId);
        escorts.delete(player.steamId);
        // An officer who leaves lets go of whoever he led: the prisoner is held still again at the next beat.
        for (const [steamId, officerId] of [...escorts]) {
            if (officerId === player.id) {
                const record = records.get(steamId);
                if (record !== undefined) {
                    stopEscort(record, playerBySteam(steamId), "o oficial saiu");
                }
            }
        }
        for (const [session, page] of [...pages]) {
            if (page.officer.id === player.id) {
                pages.delete(session);
            }
        }
    });
    const timer = setInterval(() => tick(), 1_000);
    const officers = setInterval(tellOfficers, 4_000);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            clearInterval(officers);
            for (const record of records.values()) {
                const player = playerBySteam(record.steamId);
                if (player !== null) {
                    try {
                        player.stopAnimation({ standUp: true });
                    } catch {
                        // Nothing was playing.
                    }
                    unbind(player);
                }
            }
            holds.clear();
            cuffHolds.clear();
            escorts.clear();
        }
    });
}

/** What `/preso` shows and does (administrators): the prisoners and who put them there, and a way to free one. */
export function prisoners(now: number = Date.now()): Array<{ readonly name: string; readonly kind: ArrestKind; readonly by: string; readonly minutes: number; readonly online: boolean; readonly place: string }> {
    return [...records.values()].map((record) => ({
        name: record.name,
        kind: record.kind,
        by: record.byName,
        minutes: Math.max(0, Math.ceil((record.until - now) / 60_000)),
        online: playerBySteam(record.steamId) !== null,
        place: pilloryOf(record)?.name ?? "",
    }));
}

/**
 * An administrator frees a player the server no longer holds but whose game still does (2026-11-06: a tied pose left running): the pose is stopped, the walking pace given back and the
 * client told it is free. The ones in the game whose name (the character's, or the account's) has `query` in it, who are not arrested; their names.
 */
export function unstickByName(query: string): string[] {
    const wanted = query.trim().toLowerCase();
    if (wanted === "") {
        return [];
    }
    const names: string[] = [];
    for (const player of Player.all()) {
        if (!player.ready || arrestOf(player.steamId) !== null) {
            continue;
        }
        const name = nameOf(player);
        if (!name.toLowerCase().includes(wanted) && !player.nickname.toLowerCase().includes(wanted)) {
            continue;
        }
        cuffHolds.delete(player.steamId);
        holds.delete(player.steamId);
        escorts.delete(player.steamId);
        try {
            player.stopAnimation({ standUp: true });
        } catch {
            // Nothing was playing.
        }
        unbind(player);
        stopAgainAt.set(player.steamId, Date.now() + STOP_AGAIN_MS);
        names.push(name);
    }
    return names;
}

/** An administrator frees whoever matches `query` (a name or a part of one). How many were freed. */
export function releaseByName(query: string): number {
    const wanted = query.trim().toLowerCase();
    if (wanted === "") {
        return 0;
    }
    let freed = 0;
    for (const record of [...records.values()]) {
        if (record.name.toLowerCase().includes(wanted)) {
            end(record, "administrador");
            freed += 1;
        }
    }
    return freed;
}
