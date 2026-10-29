/**
 * E at the player's dog (user, 2026-10-26: "permitir apertar E no cachorro; ao apertar E no cachorro abre o menu: fazer carinho, mandar ficar /
 * mandar seguir e sair, estilo do cavalo"; the panel's buttons for the dog's orders went with it, as the horse's follow and stay were never there).
 * The menu is made as the horse's (`horse-menu.ts`):
 *
 * - the client is told which dog is the player's and stands within reach (`dog.near`), and its own E, heard while the aim is on the dog, asks
 *   for the menu (`dog.menu`); the game's own prompts at a dog are held back by the client for as long as the aim is on it;
 * - the list is **Fazer carinho** (the game's own caress of a dog, `emotes.ts`), **Mandar ficar** or **Mandar seguir** (whichever it is not doing:
 *   the dog's order, `supporters.ts`) and **Sair**.
 *
 * Only the owner is told of the dog and only the owner may open it: a dog is a supporter's gift, and the one `Player.dog` names is theirs.
 */

import { DOG_PETTING, emotes } from "./emotes.js";
import { allowedTo, EDGE_M, reachTo } from "./reach.js";
import { supporters } from "./supporters.js";

const RESOURCE = "kcdc-gamemode";

export const dogMenu = {
    /** How near the dog the player must still be to choose, with the menu already up: not an interaction's reach, a walk's. */
    reachM: 6,
    /** How near the dog the client is told of it (for the E), and how near the player's E must be to be believed (`reach.ts`). */
    nearM: reachTo(EDGE_M.dog),
    askM: allowedTo(EDGE_M.dog),
    /** The client is told of the dog this often, and only when it has moved on, come into reach or gone out of it: a dog on the trot changes place. */
    nearEveryMs: 300,
    /** A choice this soon after the menu opened is the same E that asked for it (the game's E also confirms a choice list), not a choice: the menu is put back up. */
    sameKeyMs: 250,
    /** A caress is not repeated sooner than this: it is as long as the animation. */
    petEveryMs: 3_000,
};

interface Session {
    readonly playerId: number;
    readonly dogId: number;
}

const sessions = new Map<number, Session>();
const openedAt = new Map<number, number>();
const sessionOf = new Map<number, number>();
const pettedAt = new Map<number, number>();
const told = new Map<number, string>();

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

/** What the dog is called to its owner: the name it was given, or just "seu cão". */
function called(dog: Dog): string {
    return dog.name === "" ? "seu cão" : dog.name;
}

export function menuPage(dog: Dog): DialoguePage {
    const following = dog.mode === 1;
    return {
        line: dog.name === "" ? "Seu cão: o que você quer fazer?" : `${dog.name}: o que você quer fazer?`,
        onRight: false,
        options: [
            { id: "pet", text: "Fazer carinho", enabled: true },
            following ? { id: "stay", text: "Mandar ficar", enabled: true } : { id: "follow", text: "Mandar seguir", enabled: true },
            { id: "close", text: "Sair", enabled: true },
        ],
    };
}

function close(player: Player): void {
    const old = sessionOf.get(player.id);
    if (old !== undefined) {
        sessions.delete(old);
        sessionOf.delete(player.id);
        openedAt.delete(old);
        Dialogue.close(old);
    }
}

/** Opens the menu of the dog for its owner. False when there is none to offer now. */
export function openDogMenu(player: Player, dog: Dog): boolean {
    if (!player.ready || !player.alive || Dialogue.sessionOf(player.id) !== 0) {
        return false;
    }
    close(player);
    const session = Dialogue.open(player.id, menuPage(dog));
    if (session === 0) {
        return false;
    }
    sessions.set(session, { playerId: player.id, dogId: dog.id });
    sessionOf.set(player.id, session);
    openedAt.set(session, Date.now());
    return true;
}

/** Whether this player has the dog's menu up now. */
export function menuUp(player: Player): boolean {
    const session = sessionOf.get(player.id);
    return session !== undefined && sessions.has(session);
}

/** The dog of this player, when it is the one with this id and they are a supporter. Null for anything else. */
function ownDog(player: Player, dogId: unknown): Dog | null {
    const dog = player.dog;
    return typeof dogId === "number" && dog !== null && dog.id === dogId && supporters.get(player.steamId) !== null ? dog : null;
}

/** The player's E, heard by their client with the aim on their dog: the menu. */
export function askMenu(player: Player, dogId: unknown): boolean {
    const dog = ownDog(player, dogId);
    if (dog === null || player.mounted === true || player.horse || flat(dog.position, player.position) > dogMenu.askM) {
        return false;
    }
    return openDogMenu(player, dog);
}

/** "Fazer carinho": the player's caress of the dog, and a word on the chat. */
function pet(player: Player, dog: Dog, now: number): void {
    if (now - (pettedAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < dogMenu.petEveryMs) {
        return;
    }
    pettedAt.set(player.id, now);
    // The word comes whether or not the body could play it (a seat, a bad moment): the animation is the show, not the act.
    emotes.play(player, DOG_PETTING, true);
    tell(player, `Você faz carinho em ${called(dog)}.`);
}

export function chooseDog(session: number, player: Player, option: string, now = Date.now()): void {
    const menu = sessions.get(session);
    if (menu === undefined || menu.playerId !== player.id) {
        return;
    }
    const opened = openedAt.get(session) ?? Number.NEGATIVE_INFINITY;
    sessions.delete(session);
    sessionOf.delete(player.id);
    openedAt.delete(session);
    Dialogue.close(session);
    const dog = ownDog(player, menu.dogId);
    if (dog === null || option === "close") {
        return;
    }
    if (now - opened < dogMenu.sameKeyMs) {
        openDogMenu(player, dog);
        return;
    }
    if (flat(dog.position, player.position) > dogMenu.reachM) {
        tell(player, "Você se afastou demais do seu cão.");
        return;
    }
    if (option === "pet") {
        pet(player, dog, now);
    } else if (option === "stay") {
        tell(player, supporters.order(player, "sentar").message);
    } else if (option === "follow") {
        tell(player, supporters.order(player, "seguir").message);
    }
}

/** Tells each supporter's client of its dog when it stands within reach of them, so that its E can ask for the menu. */
function tellNear(): void {
    const round = (value: number): number => Math.round(value * 4) / 4;
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        let text = "";
        // The supporters are few: the others cost nothing but this look (asked first, before the body's own reads).
        if (supporters.get(player.steamId) !== null && player.alive) {
            const dog = player.dog;
            if (dog !== null && !player.horse) {
                const at = dog.position;
                const here = player.position;
                if (flat(at, here) <= dogMenu.nearM && Math.abs(at.z - here.z) <= 2.5) {
                    text = JSON.stringify({ id: dog.id, x: round(at.x), y: round(at.y), z: round(at.z) });
                }
            }
        }
        if ((told.get(player.id) ?? "") !== text) {
            told.set(player.id, text);
            player.emit(`${RESOURCE}:dog.near`, text === "" ? JSON.stringify({ id: 0 }) : text);
        }
    }
}

export function installDogMenu(): void {
    Events.onClient(`${RESOURCE}:dog.menu`, (sender, payload) => {
        let id: unknown;
        try {
            id = ((typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown } | null)?.id;
        } catch {
            return;
        }
        askMenu(sender as Player, id);
    });
    Events.on("dialogueChoice", (session, player, option) => chooseDog(session, player, option));
    Events.on("dialogueClosed", (session) => {
        const menu = sessions.get(session);
        if (menu !== undefined) {
            sessions.delete(session);
            sessionOf.delete(menu.playerId);
            openedAt.delete(session);
        }
    });
    Events.on("playerDisconnect", (player) => {
        pettedAt.delete(player.id);
        told.delete(player.id);
        close(player);
    });
    const timer = setInterval(tellNear, dogMenu.nearEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
