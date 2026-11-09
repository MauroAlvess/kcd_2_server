/**
 * The menu of a trade's place (user, 2026-10-17: "na interação com o negócio de cozinhar do próprio jogo ... aparece opção
 * cozinhar ou sair"; 2026-10-18: "ao interagir com a forja devia aparecer a opção forjar ou sair igual demais ofícios").
 *
 * The game's fire, rack, smokehouse and forge work on the player's own machine and the server hears nothing of them
 * (`cooking.ts`). So beside the game's own prompt there is ours (`src/client/cook-hint.ts`): the client is told where the
 * places are near the player, puts "Cozinhar", "Secar", "Defumar" or "Forjar" up on the interaction key when they stand at one,
 * and on the press asks for this menu: the game's own choice list, "Cozinhar" or "Sair", and the first opens the trade's page
 * (`craft-menu.ts`: the recipes, what they take, and the work). A player whose guild does not own the place is told so
 * (`guild-crafts.ts`) and gets no page.
 */

import { hasMeal, stationPoints, stationsNear } from "./cooking.js";
import { alchemyTableNear, forgeNear } from "./craft.js";
import { craftPlacesWithin } from "./craft-places.js";
import { openCraftHud } from "./craft-menu.js";
import { FURNITURE_KIND_INDEX, spotPointsWithin, useSpot } from "./furniture.js";
import type { SpotKind } from "./furniture.js";
import { mayCraft, showRefusal } from "./guild-crafts.js";
import type { Craft } from "./guild-crafts.js";
import { muralAsked, muralPointsWithin, openMural } from "./mural.js";
import { grindstoneNear, grindstonesWithin, openRepairPage } from "./repair.js";
import type { StationKind } from "./stations-data.js";

const RESOURCE = "kcdc-gamemode";

export const cookMenu = {
    /** The client is told of the places this near it, and again when they change. */
    syncM: 120,
    syncEveryMs: 6_000,
};

export type Kind = StationKind | "forja" | "alquimia" | "amolar";

const PLACE: Readonly<Record<Kind, { readonly name: string; readonly verb: string; readonly craft: Craft }>> = {
    fogo: { name: "O fogo", verb: "Cozinhar", craft: "fogo" },
    secador: { name: "O secador", verb: "Secar", craft: "secador" },
    defumador: { name: "O defumador", verb: "Defumar", craft: "defumador" },
    forja: { name: "A forja", verb: "Forjar", craft: "smithing" },
    // Every alchemy table: the level's own and the ones this server put in the world (`craft-places.ts`); the game's own E is held back at them
    // (2026-10-24: it left the player in the game's alchemy, which the server refuses until a potion is chosen).
    alquimia: { name: "A mesa de alquimia", verb: "Preparar", craft: "alchemy" },
    // The level's grindstones (2026-10-27: "só ferreiro vai poder usar; apertar E abre o menu Reparar e Sair"): the repairs of `repair.ts`.
    amolar: { name: "A pedra de amolar", verb: "Reparar", craft: "smithing" },
};

/** The kind number the client uses for each. */
export const KIND_INDEX: Readonly<Record<Kind, number>> = { fogo: 0, secador: 1, defumador: 2, forja: 3, alquimia: 4, amolar: 8 };

interface Session {
    readonly player: Player;
    readonly kind: Kind;
}

const sessions = new Map<number, Session>();

/** The kinds of place within reach of the player, the fire, rack and smokehouse first. */
export function kindsNear(position: { x: number; y: number; z: number }): Kind[] {
    const here: Kind[] = [...stationsNear(position)];
    if (forgeNear(position)) {
        here.push("forja");
    }
    if (alchemyTableNear(position)) {
        here.push("alquimia");
    }
    if (grindstoneNear(position)) {
        here.push("amolar");
    }
    return here;
}

export function menuPage(kind: Kind): DialoguePage {
    const place = PLACE[kind];
    return {
        line: `${place.name}: o que vai ser?`,
        onRight: false,
        options: [
            { id: "cook", text: place.verb, enabled: true },
            { id: "leave", text: "Sair", enabled: true },
        ],
    };
}

/** The place a press of the client's hint was on: its kind number, when it names one of the places near. */
export function askedKind(payload: unknown): Kind | null {
    let fields: Record<string, unknown> = {};
    try {
        const value = typeof payload === "string" && payload.length <= 300 ? (JSON.parse(payload) as unknown) : payload;
        fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return null;
    }
    return (Object.keys(KIND_INDEX) as Kind[]).find((name) => KIND_INDEX[name] === fields["kind"]) ?? null;
}

/** A player asked for the menu at a place. False when there is none to offer. `asked` is the place the hint was on, when the client says. */
export function openCookMenu(player: Player, asked: Kind | null = null): boolean {
    if (!player.ready || !player.alive || player.steamId === "" || Dialogue.sessionOf(player.id) !== 0) {
        return false;
    }
    const here = kindsNear(player.position);
    if (here.length === 0) {
        return false;
    }
    // A grindstone stands beside the forge: the one the hint was on is the one asked for.
    const wanted = asked !== null && here.includes(asked) ? [asked] : here;
    const kind = wanted.find((candidate) => mayCraft(player, PLACE[candidate].craft));
    if (kind === undefined) {
        showRefusal(player, PLACE[wanted[0] as Kind].craft);
        return false;
    }
    const id = Dialogue.open(player.id, menuPage(kind));
    if (id === 0) {
        return false;
    }
    sessions.set(id, { player, kind });
    return true;
}

export function chooseCook(id: number, player: Player, option: string): void {
    const session = sessions.get(id);
    if (session === undefined || session.player.id !== player.id) {
        return;
    }
    sessions.delete(id);
    Dialogue.close(id);
    if (option !== "cook") {
        return;
    }
    // They may have walked off: the choice list does not watch distance.
    if (!kindsNear(player.position).includes(session.kind)) {
        Chat.sendToPlayer(player, "Você se afastou do lugar.");
        return;
    }
    if (session.kind === "amolar") {
        openRepairPage(player);
        return;
    }
    openCraftHud(player, session.kind);
}

/**
 * The client saw the game's blade picker come up after our "Forjar": the player was at the grindstone beside the forge, whose
 * sharpening is the game's own. Our menu is closed and the game's screen left to them. True when there was one to close.
 */
export function cancelCookMenu(player: Player): boolean {
    for (const [id, session] of sessions) {
        if (session.player.id !== player.id) {
            continue;
        }
        sessions.delete(id);
        Dialogue.close(id);
        console.log(`cook-menu: ${player.nickname} estava na pedra de amolar: o nosso menu (${session.kind}) foi fechado e a afiação ficou com o jogo`);
        return true;
    }
    return false;
}

/** The forges and the alchemy tables about a point (the level's and the ones this server put in the world), for the client's hint: kind, x, y, z. */
export function forgePoints(position: { x: number; y: number }, radius: number): Array<[Kind, number, number, number]> {
    const ours = craftPlacesWithin(position, radius).map((place): [Kind, number, number, number] => [place.kind, place.x, place.y, place.z]);
    const stones = grindstonesWithin(position, radius).map((stone): [Kind, number, number, number] => ["amolar", stone[0], stone[1], stone[2]]);
    try {
        const level = (kind: "smithing" | "alchemy", name: Kind): Array<[Kind, number, number, number]> =>
            levelStations(kind)
                .filter((station) => Math.hypot(station[0] - position.x, station[1] - position.y) <= radius)
                .map((station): [Kind, number, number, number] => [name, station[0], station[1], station[2]]);
        return [...level("smithing", "forja"), ...level("alchemy", "alquimia"), ...ours, ...stones];
    } catch {
        return [...ours, ...stones];
    }
}

/**
 * The level's own forges and alchemy tables (`Crafting.stations` lists only those, and they are in the level for good): a list of them is a call into the
 * engine for each station and each coordinate, and every player's look of this menu asked for both lists again. Kept, and asked for again once a minute.
 */
export const LEVEL_STATIONS_KEPT_MS = 60_000;
const levelKept = new Map<string, { at: number; list: Array<readonly [number, number, number]> }>();

function levelStations(kind: "smithing" | "alchemy"): ReadonlyArray<readonly [number, number, number]> {
    const now = Date.now();
    const kept = levelKept.get(kind);
    if (kept !== undefined && now - kept.at < LEVEL_STATIONS_KEPT_MS) {
        return kept.list;
    }
    const list = Crafting.stations(kind).map((station): readonly [number, number, number] => {
        const at = station.position;
        return [at.x, at.y, at.z];
    });
    levelKept.set(kind, { at: now, list });
    return list;
}

/**
 * A press of the client's hint on a chair or a bed (kinds 5 and 6, `furniture.ts`), with the point the hint was on; null for the
 * rest, which are the fire, the rack, the smokehouse, the forge and the tables.
 */
export function furnitureAsked(payload: unknown): { readonly kind: SpotKind; readonly aimed: { x: number; y: number } | null } | null {
    let fields: Record<string, unknown> = {};
    try {
        const value = typeof payload === "string" && payload.length <= 300 ? (JSON.parse(payload) as unknown) : payload;
        fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return null;
    }
    const kind = (Object.keys(FURNITURE_KIND_INDEX) as SpotKind[]).find((name) => FURNITURE_KIND_INDEX[name] === fields["kind"]);
    if (kind === undefined) {
        return null;
    }
    const { x, y } = fields;
    return { kind, aimed: typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null };
}

/** What a client closed of the game's own screens after a press of ours (`cook-hint.ts`), for the log: one line per player at most every 10 s. */
const nativeTold = new Map<number, number>();

export function noteNativeScreen(player: Player, payload: unknown, now = Date.now()): string | null {
    if (now - (nativeTold.get(player.id) ?? -Infinity) < 10_000) {
        return null;
    }
    let fields: Record<string, unknown> = {};
    try {
        const value = typeof payload === "string" && payload.length <= 200 ? (JSON.parse(payload) as unknown) : payload;
        fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return null;
    }
    const screen = typeof fields["screen"] === "string" ? fields["screen"].replace(/[^A-Za-z]/g, "").slice(0, 32) : "";
    if (screen === "") {
        return null;
    }
    nativeTold.set(player.id, now);
    const kind = Object.entries(KIND_INDEX).find(([, index]) => index === fields["kind"])?.[0] ?? "?";
    if (fields["own"] === false) {
        return `cook-menu: ${player.nickname}: a tela do jogo ${screen} abriu no ${kind} com o E do jogo, sem o nosso menu (que é no F), e foi fechada`;
    }
    return `cook-menu: ${player.nickname}: a tela do jogo ${screen} abriu com o nosso menu (${kind}) e foi fechada`;
}

/**
 * What a player is told when the game's own cooking prompt at a fire (the E, which opens the game's food picker) was pressed instead
 * of ours: our menu is on F there, since the E is the pot's "Comer da panela" (2026-10-20). Null for anything else.
 */
export function fireKeyNote(payload: unknown): string | null {
    let fields: Record<string, unknown> = {};
    try {
        const value = typeof payload === "string" && payload.length <= 200 ? (JSON.parse(payload) as unknown) : payload;
        fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return null;
    }
    return fields["own"] === false && fields["kind"] === KIND_INDEX.fogo ? "No fogo, cozinhar é com a tecla F; o E é do jogo (comer da panela)." : null;
}

export function installCookMenu(): void {
    Events.onClient(`${RESOURCE}:cook.menu`, (sender, payload) => {
        const furniture = furnitureAsked(payload);
        if (furniture !== null) {
            const result = useSpot(sender as Player, furniture.kind, furniture.aimed);
            if (result.message !== "") {
                Chat.sendToPlayer(sender as Player, result.message);
            }
            return;
        }
        // The notice board's F (kind 7): its page, not a trade's menu.
        const mural = muralAsked(payload);
        if (mural !== null) {
            const outcome = openMural(sender as Player, mural.haveArt);
            if (!outcome.ok && outcome.message !== "") {
                Chat.sendToPlayer(sender as Player, outcome.message);
            }
            return;
        }
        openCookMenu(sender as Player, askedKind(payload));
    });
    Events.onClient(`${RESOURCE}:cook.cancel`, (sender) => {
        cancelCookMenu(sender as Player);
    });
    Events.onClient(`${RESOURCE}:cook.native`, (sender, payload) => {
        const line = noteNativeScreen(sender as Player, payload);
        if (line !== null) {
            console.log(line);
            const note = fireKeyNote(payload);
            if (note !== null) {
                Chat.sendToPlayer(sender as Player, note);
                (sender as Player).emit(`${RESOURCE}:notify`, JSON.stringify({ text: note }));
            }
        }
    });
    Events.on("dialogueChoice", (session, player, option) => chooseCook(session, player, option));
    Events.on("dialogueClosed", (session) => {
        sessions.delete(session);
    });
    // The client is told of the places about the player: kind number and position, only when they change.
    const told = new Map<number, string>();
    const timer = setInterval(() => {
        for (const player of Player.all()) {
            if (!player.ready || !player.alive) {
                continue;
            }
            const round = (n: number): number => Math.round(n * 10) / 10;
            // The player's place is read once, in plain numbers: it was read four times (an engine vector each), and each `.x` of one is a call into the engine,
            // once for every place of the level the helpers below measure it against (2026-10-28).
            const place = player.position;
            const at = { x: place.x, y: place.y, z: place.z };
            const near: Array<readonly [Kind, number, number, number]> = [...stationPoints(at, cookMenu.syncM), ...forgePoints(at, cookMenu.syncM)];
            const text = JSON.stringify([
                // A fire whose pot has a meal in it has a fifth number, 1: its E is the pot's "Comer", which the client leaves alone (2026-10-28).
                ...near.map((station) => [KIND_INDEX[station[0]], round(station[1]), round(station[2]), round(station[3]), ...(station[0] === "fogo" && hasMeal(station) ? [1] : [])]),
                // The chairs and beds the World Builder exports placed (`furniture.ts`).
                ...spotPointsWithin(at, cookMenu.syncM).map((point) => [point[0], round(point[1]), round(point[2]), round(point[3])]),
                // The notice boards (`mural.ts`): the point in front of each one.
                ...muralPointsWithin(at, cookMenu.syncM).map((point) => [point[0], round(point[1]), round(point[2]), round(point[3])]),
            ]);
            if (told.get(player.id) !== text) {
                told.set(player.id, text);
                player.emit(`${RESOURCE}:cook.stations`, text);
            }
        }
    }, cookMenu.syncEveryMs);
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
        nativeTold.delete(player.id);
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
