/**
 * The cooking menu (user, 2026-10-17: "na interação com o negócio de cozinhar do próprio jogo ... aparece opção cozinhar ou
 * sair e dependendo da escolha abre a tela para ele cozinhar mas configurada pela gente").
 *
 * The game's fire, rack and smokehouse work on the player's own machine and the server hears nothing of them
 * (`cooking.ts`). So beside the game's own prompt there is ours (`src/client/cook-hint.ts`): the client is told where the
 * places are near the player, puts "Cozinhar" up on the interaction key when they stand at one, and on the press asks for
 * this menu. It is the game's own choice list, driven from here: "Cozinhar" or "Sair"; "Cozinhar" lists what the player
 * carries that the place can make something of, one choice each and one for all of it. A player whose guild does not own the
 * place is told so (`guild-crafts.ts`) and gets no menu.
 */

import { cookables, cook, stationPoints, stationsNear } from "./cooking.js";
import type { Cookable } from "./cooking.js";
import { mayCraft, refusal } from "./guild-crafts.js";
import type { StationKind } from "./stations-data.js";

const RESOURCE = "kcdc-gamemode";

export const cookMenu = {
    /** The client is told of the places this near it, and again when they change. */
    syncM: 120,
    syncEveryMs: 6_000,
    /** The most foods one page lists (the choice list takes eight rows, and two are "tudo" and "sair"). */
    foods: 6,
};

const PLACE: Readonly<Record<StationKind, { readonly name: string; readonly verb: string }>> = {
    fogo: { name: "O fogo", verb: "Cozinhar" },
    secador: { name: "O secador de carne", verb: "Secar" },
    defumador: { name: "O defumador", verb: "Defumar" },
};

/** The kind number the client uses for each. */
export const KIND_INDEX: Readonly<Record<StationKind, number>> = { fogo: 0, secador: 1, defumador: 2 };

interface Session {
    readonly player: Player;
    readonly kind: StationKind;
    view: "menu" | "list";
    /** The foods the list shows, by the number in their choice id (`food:0`). */
    foods: Cookable[];
}

const sessions = new Map<number, Session>();

function menuPage(session: Session): DialoguePage {
    const have = cookables(session.player).filter((food) => food.kind === session.kind);
    const place = PLACE[session.kind];
    return {
        line: have.length === 0 ? `${place.name}: você não leva nada que dê para fazer aqui.` : `${place.name}: o que vai ser?`,
        onRight: false,
        options: [
            { id: "cook", text: place.verb, enabled: have.length > 0 },
            { id: "leave", text: "Sair", enabled: true },
        ],
    };
}

function listPage(session: Session): DialoguePage {
    const have = cookables(session.player).filter((food) => food.kind === session.kind);
    session.foods = have.slice(0, cookMenu.foods);
    const options: DialogueOption[] = session.foods.map((food, index) => ({ id: `food:${index}`, text: food.text, enabled: true }));
    if (have.length > 0) {
        options.push({ id: "all", text: "Tudo o que der", enabled: true });
    }
    options.push({ id: "leave", text: "Sair", enabled: true });
    const more = have.length > session.foods.length ? ` (são ${have.length}; "Tudo o que der" faz o resto)` : "";
    return { line: have.length === 0 ? "Não sobrou nada para fazer aqui." : `${PLACE[session.kind].verb}: o quê?${more}`, onRight: false, options };
}

function show(session: number, page: DialoguePage): void {
    if (!Dialogue.update(session, page)) {
        sessions.delete(session);
    }
}

/** A player asked for the menu at a place. False when there is none to offer. */
export function openCookMenu(player: Player): boolean {
    if (!player.ready || !player.alive || player.steamId === "" || Dialogue.sessionOf(player.id) !== 0) {
        return false;
    }
    const here = stationsNear(player.position);
    if (here.length === 0) {
        return false;
    }
    const kind = here.find((candidate) => mayCraft(player, candidate));
    if (kind === undefined) {
        Chat.sendToPlayer(player, refusal(here[0] as StationKind));
        return false;
    }
    const session: Session = { player, kind, view: "menu", foods: [] };
    const id = Dialogue.open(player.id, menuPage(session));
    if (id === 0) {
        return false;
    }
    sessions.set(id, session);
    return true;
}

export function chooseCook(id: number, player: Player, option: string): void {
    const session = sessions.get(id);
    if (session === undefined || session.player.id !== player.id) {
        return;
    }
    if (option === "leave") {
        sessions.delete(id);
        Dialogue.close(id);
        return;
    }
    // They may have walked off: the choice list does not watch distance.
    if (!stationsNear(player.position).includes(session.kind)) {
        sessions.delete(id);
        Dialogue.close(id);
        Chat.sendToPlayer(player, "Você se afastou do lugar: nada foi feito.");
        return;
    }
    if (session.view === "menu") {
        if (option === "cook") {
            session.view = "list";
            show(id, listPage(session));
        }
        return;
    }
    const food = option.startsWith("food:") ? session.foods[Number(option.slice(5))] : undefined;
    if (option !== "all" && food === undefined) {
        return;
    }
    const text = cook(player, option === "all" ? undefined : food?.id);
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
    session.view = "menu";
    show(id, menuPage(session));
}

export function installCookMenu(): void {
    Events.onClient(`${RESOURCE}:cook.menu`, (sender) => {
        openCookMenu(sender as Player);
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
            const points = stationPoints(player.position, cookMenu.syncM).map((station) => [KIND_INDEX[station[0]], round(station[1]), round(station[2]), round(station[3])]);
            const text = JSON.stringify(points);
            if (told.get(player.id) !== text) {
                told.set(player.id, text);
                player.emit(`${RESOURCE}:cook.stations`, text);
            }
        }
    }, cookMenu.syncEveryMs);
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
