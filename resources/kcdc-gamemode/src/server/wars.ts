/**
 * Wars between lands (2026-10-31, user: "na seção cidadania um lorde da terras ou admin pode marcar a região como em guerra assim jogadores podem ficar cientes além disso um lorde pode
 * entregar suas terras caso perca alguma guerra além de poder colocar em guerra e vincular a quais terras está em guerra").
 *
 * A war is a link between two towns of the Cidadania section (a seat or a land), declared from one of them by the lord of its lands, or by an administrator: "Suchdol está em guerra com
 * Raborsch e Bohunowitz". The lord chooses, in one form, the towns his is at war with, and that list is the whole truth of it: a town added begins a war, a town taken off ends it. Marking
 * a war is for the players to KNOW -- the cards of both towns wear a ribbon, the detail says with whom and since when, everybody online is told when one begins or ends, and a citizen is
 * told at the entry -- and the server stands behind one thing only: a lord who lost may SURRENDER, handing the lands of that town to the lord of a town he is at war with. The properties
 * that were his in them go to the winner as `cedeRegionTo` gives a region (the chests keep what is in them), and the war between those two ends there. Either side's lord may end a
 * war (it is a matter of word between them; the server is not the judge of who won), and a lord does not declare war on lands that are his own.
 *
 * Kept in `playerdata/wars.json`, a link a line: `{ a, b, since, by }`, `a` the town it was declared from.
 */

import { isAdmin } from "./auth.js";
import { TOWNS, lordOfTown, mayDepose, townById, townOf } from "./citizenship.js";
import type { Town } from "./citizenship.js";
import { nameOfMember } from "./guild-members.js";
import { languageOf, translate } from "./language.js";
import { cedeRegionTo, regionCeded, regionLordOf, releaseRegion } from "./properties.js";
import { addLazyPayload, notice, sendSocial } from "./status.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/wars.json`;
/** A citizen of a town at war is reminded of it this long after the entry: the door and the creator are over by then. */
const REMIND_AFTER_MS = 25_000;

export interface War {
    /** The town the war was declared from. */
    readonly a: string;
    readonly b: string;
    readonly since: number;
    /** The name of the character who declared it (the file's record; the pages are never told). */
    readonly by: string;
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

let links: War[] = [];
let writable = true;

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, wars: links });
    } catch (error: unknown) {
        console.log(`wars: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

const same = (war: War, x: string, y: string): boolean => (war.a === x && war.b === y) || (war.a === y && war.b === x);

/** The war between two towns, or null. */
export function linkOf(x: string, y: string): War | null {
    return links.find((war) => same(war, x, y)) ?? null;
}

/** The wars on the books. */
export function allWars(): readonly War[] {
    return links;
}

/** The towns a town is at war with, in the order the wars were declared. */
export function opponentsOf(id: string): string[] {
    return links.filter((war) => war.a === id || war.b === id).map((war) => (war.a === id ? war.b : war.a));
}

export function isAtWar(id: string): boolean {
    return links.some((war) => war.a === id || war.b === id);
}

/** Begins a war between two towns. False when they are at war already. */
export function beginWar(a: string, b: string, by: string, now: number = Date.now()): boolean {
    if (a === b || linkOf(a, b) !== null) {
        return false;
    }
    links.push({ a, b, since: now, by });
    save();
    return true;
}

/** Ends the war between two towns. False when there was none. */
export function endWar(x: string, y: string): boolean {
    const before = links.length;
    links = links.filter((war) => !same(war, x, y));
    if (links.length === before) {
        return false;
    }
    save();
    return true;
}

/** "Suchdol", "Suchdol e Wysoka", "Suchdol, Wysoka e Raborsch". */
export function joinNames(names: readonly string[]): string {
    if (names.length <= 1) {
        return names[0] ?? "";
    }
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1] as string}`;
}

const nameOfTown = (id: string): string => townById(id)?.name ?? id;

/** What a lord is called on the pages: the name the character was given when the region was ceded, or the one the guilds know. */
function lordName(lord: { readonly steamId: string; readonly name: string }): string {
    return lord.name !== "" ? lord.name : nameOfMember(lord.steamId);
}

/** Whether two towns are ruled by one and the same lord (a lord is not at war with his own lands). */
function sameLord(x: Town, y: Town): boolean {
    const first = lordOfTown(x);
    const second = lordOfTown(y);
    return first !== null && second !== null && first.steamId === second.steamId;
}

/**
 * Takes the wars that ended by themselves: two towns that one lord now rules are no longer at war (after a surrender, or an administrator's cession). How many.
 */
export function endWarsOfOneLord(): number {
    const before = links.length;
    links = links.filter((war) => {
        const x = townById(war.a);
        const y = townById(war.b);
        return x === null || y === null || !sameLord(x, y);
    });
    if (links.length !== before) {
        save();
    }
    return before - links.length;
}

/** Tells everybody online, in the chat and on the game's notification line, in each one's language. */
function tellEverybody(text: string): void {
    for (const player of Player.all()) {
        try {
            const shown = translate(text, languageOf(player));
            Chat.sendToPlayer(player, shown);
            player.emit(`${RESOURCE}:notify`, JSON.stringify({ text: shown }));
        } catch {
            // Leaving meanwhile.
        }
    }
}

function listOf(wanted: unknown): string[] {
    const raw = Array.isArray(wanted) ? wanted : typeof wanted === "string" ? wanted.split(",") : [];
    const seen = new Set<string>();
    for (const item of raw) {
        if (typeof item === "string" && item.trim() !== "") {
            seen.add(item.trim());
        }
    }
    return [...seen];
}

/**
 * Sets the towns a town is at war with: `wanted` is the whole list, the ones not at war yet begin one and the ones left out end it. The lord of the town's lands (or an administrator) only.
 */
export function setWars(actor: Player, townId: unknown, wanted: unknown, now: number = Date.now()): Outcome {
    const town = townById(townId);
    if (town === null) {
        return { ok: false, message: "Essa cidade não existe." };
    }
    if (!mayDepose(actor, town)) {
        return { ok: false, message: `Só o senhor das terras de ${town.name} marca a guerra.` };
    }
    const ids = listOf(wanted);
    for (const id of ids) {
        if (id === town.id || townById(id) === null) {
            return { ok: false, message: "Essa cidade não existe." };
        }
    }
    const own = ids.map((id) => townById(id) as Town).filter((other) => sameLord(town, other));
    if (own.length > 0) {
        return { ok: false, message: `Você não faz guerra às suas próprias terras: ${joinNames(own.map((other) => other.name))}.` };
    }
    const current = opponentsOf(town.id);
    const begin = ids.filter((id) => !current.includes(id));
    const stop = current.filter((id) => !ids.includes(id));
    if (begin.length === 0 && stop.length === 0) {
        return { ok: false, message: ids.length === 0 ? `${town.name} não está em guerra.` : `${town.name} já está em guerra com ${joinNames(ids.map(nameOfTown))}: nada mudou.` };
    }
    const by = nameOfMember(actor.steamId);
    for (const id of begin) {
        beginWar(town.id, id, by, now);
    }
    for (const id of stop) {
        endWar(town.id, id);
    }
    console.log(`wars: ${actor.nickname} marcou ${town.name}: guerra com ${ids.length > 0 ? ids.map(nameOfTown).join(", ") : "ninguém"}${begin.length > 0 ? ` (começou: ${begin.map(nameOfTown).join(", ")})` : ""}${stop.length > 0 ? ` (acabou: ${stop.map(nameOfTown).join(", ")})` : ""}`);
    if (begin.length > 0) {
        tellEverybody(`[Guerra] ${town.name} declarou guerra a ${joinNames(begin.map(nameOfTown))}.`);
    }
    if (stop.length > 0) {
        tellEverybody(`[Guerra] A guerra entre ${town.name} e ${joinNames(stop.map(nameOfTown))} terminou.`);
    }
    return {
        ok: true,
        message: ids.length > 0 ? `${town.name} está em guerra com ${joinNames(ids.map(nameOfTown))}.` : `${town.name} está em paz: nenhuma guerra marcada.`,
    };
}

export interface Surrender {
    readonly town: string;
    readonly lord: string;
}

/** The lords a lord of `town` may hand the lands to: the lords of the towns it is at war with (not himself). */
export function surrenderOptions(town: Town): Surrender[] {
    const giver = lordOfTown(town);
    if (giver === null) {
        return [];
    }
    const options: Surrender[] = [];
    for (const id of opponentsOf(town.id)) {
        const other = townById(id);
        const winner = other === null ? null : lordOfTown(other);
        if (other !== null && winner !== null && winner.steamId !== giver.steamId) {
            options.push({ town: other.id, lord: lordName(winner) });
        }
    }
    return options;
}

/**
 * The lord of a town hands its lands to the lord of a town it is at war with (he lost): the region passes to the winner with the properties that were the loser's in it, the chests keep what
 * is in them, and the war between the two towns ends. What the town declared on the lord's word is taken off the books (the new lord begins his own). An administrator may do it for the lord.
 */
export function surrender(actor: Player, townId: unknown, toId: unknown): Outcome {
    const town = townById(townId);
    const to = townById(toId);
    if (town === null || to === null || town.id === to.id) {
        return { ok: false, message: "Essa cidade não existe." };
    }
    if (!mayDepose(actor, town)) {
        return { ok: false, message: `Só o senhor das terras de ${town.name} entrega as terras.` };
    }
    if (linkOf(town.id, to.id) === null) {
        return { ok: false, message: `${town.name} não está em guerra com ${to.name}: só se entregam terras a quem se está em guerra.` };
    }
    const giver = lordOfTown(town);
    if (giver === null) {
        return { ok: false, message: `${town.name} não tem senhor das terras.` };
    }
    // The lands are handed by their own lord (a seat's lord is lord of its lands to close and to mark a war, but a land ceded to somebody else is that one's to give).
    if (!isAdmin(actor) && giver.steamId !== actor.steamId) {
        return { ok: false, message: `Só o senhor de ${town.name} entrega as suas terras.` };
    }
    const winner = lordOfTown(to);
    if (winner === null) {
        return { ok: false, message: `${to.name} não tem senhor para receber as terras.` };
    }
    if (winner.steamId === giver.steamId) {
        return { ok: false, message: "As duas terras são do mesmo senhor." };
    }
    // The title is lifted off the loser first (what he held in the region goes back to nobody), then given: a region with no title of its own (a land that follows its seat's lord) is just given.
    const lifted = regionLordOf(town.region) !== null ? releaseRegion(town.region) : null;
    const given = cedeRegionTo(town.region, { steamId: winner.steamId, name: lordName(winner) }, `guerra (${nameOfTown(to.id)})`);
    endWar(town.id, to.id);
    links = links.filter((war) => war.a !== town.id);
    endWarsOfOneLord();
    save();
    console.log(`wars: ${actor.nickname} entregou ${town.name} (de ${lordName(giver)}) a ${lordName(winner)}, de ${to.name}: ${lifted?.released ?? 0} propriedade(s) do perdedor soltas, ${given.given} dadas, ${given.chests} baú(s); ${given.kept} de outros donos e ${given.npc} de NPC ficaram como estavam`);
    tellEverybody(`[Guerra] O senhor de ${town.name} perdeu a guerra e entregou as suas terras ao senhor de ${to.name}: ${town.name} agora é governada de lá.`);
    const taker = Player.all().find((candidate) => candidate.steamId === winner.steamId && candidate.ready);
    if (taker !== undefined) {
        notice(taker, `${town.name} foi entregue a você pelo senhor de lá: ${given.given} ${given.given === 1 ? "propriedade" : "propriedades"} (e ${given.chests} ${given.chests === 1 ? "baú" : "baús"}) passaram para você.`);
        sendSocial(taker);
    }
    return {
        ok: true,
        message: `Você entregou ${town.name} ao senhor de ${to.name}: as propriedades que eram suas lá passaram para ele, os baús continuam com o que têm, e a guerra entre as duas terras acabou.`,
    };
}

/** What the page is told of the wars: all of them (a town's card wears a ribbon), and, for a lord (or an administrator), what each of his towns may do. */
export function warPayload(player: Player): Record<string, unknown> {
    const admin = isAdmin(player);
    const command: Record<string, { targets: string[]; surrender: Surrender[] }> = {};
    for (const town of TOWNS) {
        if (!mayDepose(player, town) || (!admin && lordOfTown(town) === null)) {
            continue;
        }
        command[town.id] = {
            targets: TOWNS.filter((other) => other.id !== town.id && !sameLord(town, other)).map((other) => other.id),
            surrender: admin || lordOfTown(town)?.steamId === player.steamId ? surrenderOptions(town) : [],
        };
    }
    return { wars: { links: links.map((war) => ({ a: war.a, b: war.b, since: war.since })), command } };
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    try {
        const value = typeof payload === "string" && payload.length <= 1024 ? (JSON.parse(payload) as unknown) : payload;
        return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

export function installWars(): void {
    const loaded = read<{ wars?: unknown }>(FILE);
    if (loaded.status === "ok" && Array.isArray(loaded.value.wars)) {
        for (const raw of loaded.value.wars) {
            const war = raw as Partial<War> | null;
            if (war !== null && typeof war === "object" && typeof war.a === "string" && typeof war.b === "string" && townById(war.a) !== null && townById(war.b) !== null && war.a !== war.b && linkOf(war.a, war.b) === null) {
                links.push({ a: war.a, b: war.b, since: typeof war.since === "number" && Number.isFinite(war.since) ? war.since : 0, by: typeof war.by === "string" ? war.by : "" });
            }
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`wars: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    console.log(`wars: ${links.length} guerra(s) marcada(s)`);

    addLazyPayload("citizenship", warPayload);

    // An administrator who cedes a region may put two towns under one lord: the war between them is over.
    regionCeded.push(() => {
        const ended = endWarsOfOneLord();
        if (ended > 0) {
            console.log(`wars: ${ended} guerra(s) acabaram por terem o mesmo senhor`);
        }
    });

    // A citizen of a town at war is told at the entry, once the door and the creator are over.
    Events.on("playerReady", (player) => {
        setTimeout(() => {
            try {
                if (!player.ready) {
                    return;
                }
                const town = townOf(player.steamId);
                if (town === null) {
                    return;
                }
                const against = opponentsOf(town.id);
                if (against.length > 0) {
                    Chat.sendToPlayer(player, translate(`[Guerra] Sua cidade, ${town.name}, está em guerra com ${joinNames(against.map(nameOfTown))}.`, languageOf(player)));
                }
            } catch {
                // Gone meanwhile.
            }
        }, REMIND_AFTER_MS);
    });

    Events.onClient(`${RESOURCE}:status.warSet`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = setWars(player, fields["town"], fields["against"]);
        notice(player, result.message);
        sendSocial(player);
    });

    Events.onClient(`${RESOURCE}:status.warSurrender`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = surrender(player, fields["town"], fields["to"]);
        notice(player, result.message);
        sendSocial(player);
    });
}
