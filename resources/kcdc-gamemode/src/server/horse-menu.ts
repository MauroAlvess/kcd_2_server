/**
 * E at a horse (user, 2026-10-18: "ao apertar E no cavalo abre opção montar, bolsa e sair"; the panel's button for the
 * horse's inventory is gone). The game's own prompt at a horse is "Montar", and its press puts the player in the saddle on
 * their own machine before the server hears of it (`horseMounting`), so the menu is made in two ways at once:
 *
 * - **Before the climb.** The client is told which kept horse stands within reach (`horse.near`), and its own E, heard at the
 *   same moment as the game's, asks the server for the menu (`horse.menu`): the game's choice list is up before the climb
 *   reaches the saddle, and a list takes the game's own actions away.
 * - **Instead of it.** The climb that does reach the saddle is refused (`horseMounting` returning false: the player's game
 *   plays the get-off) and the player is told to get off at once; when no menu is up yet it comes now.
 *
 * The list is **Montar**, **Bolsa** (the alforjes, `horse-bags.ts`), **Seguir** or **Ficar** (2026-10-22: "adicionamos uma nova opção no menu do
 * cavalo: mandar seguir e mandar ficar"; `horse-follow.ts`; the owner's alone) and **Sair**. "Montar" lets the one climb after it through,
 * and waits for the get-off of a refused climb to be over first (on 2026-10-18 a "Montar" chosen two seconds after the refusal
 * was undone by that get-off a second later). A horse that is not kept (a stranger's, a vanilla one) is left to the game, and
 * so is whoever may not ride it (`horses.ts` refuses them with its own word); a wild horse is the Agricultores' to tame, and
 * `wild-horses.ts` hooks in here (`nearExtras`, `askExtras`) to give them its own menu at it.
 */

import { bagsBusy, bagsClosed, openBags } from "./horse-bags.js";
import { isFollowing, startFollowing, stopFollowing } from "./horse-follow.js";
import { horsesOf, mayRide } from "./horses.js";
import { allowedTo, EDGE_M, reachTo } from "./reach.js";

const RESOURCE = "kcdc-gamemode";

export const horseMenu = {
    /** How long after "Montar" the climb goes through, in milliseconds. */
    allowMs: 6_000,
    /** How long the get-off of a refused climb takes: a "Montar" chosen sooner waits for it. */
    getOffMs: 3_600,
    /** How near the horse the player must still be to choose, with the menu already up: not an interaction's reach, a walk's. */
    reachM: 8,
    /**
     * How near a horse the client is told of it (for the E), and how near the player's E must be to be believed: the one reach of our E prompts
     * to a horse's point, which is its middle (`reach.ts`, 2026-10-22).
     */
    nearM: reachTo(EDGE_M.horse),
    askM: allowedTo(EDGE_M.horse),
    /** The client is told of the horse near it this often. */
    nearEveryMs: 500,
    /** A menu asked for by the E stands for a climb refused this soon after it: no second one is opened. */
    askedMs: 5_000,
    /** How long after the alforjes screen closes the menu comes back: the screen must be gone first. */
    afterBagsMs: 400,
    /**
     * A choice this soon after the menu opened is the same E that asked for it (the game's E also confirms a choice list), not a
     * choice: the menu is put back up.
     */
    sameKeyMs: 250,
};

interface Session {
    readonly playerId: number;
    readonly horseId: number;
}

const sessions = new Map<number, Session>();
const openedAt = new Map<number, number>();
const sessionOf = new Map<number, number>();
const allowed = new Map<number, { horseId: number; until: number }>();
const refusedAt = new Map<number, number>();
const askedAt = new Map<number, number>();
const told = new Map<number, string>();

/**
 * Horses that are not a kept horse's but have a menu of their own at a player: `wild-horses.ts` adds itself here. `near` answers, for a player,
 * the horse (and its kind: `w` is a wild one, for the client's word on E) within `reachM` of them that their E would open a menu for, or null; `ask`
 * opens that menu for the horse the client named and says whether it did. The round's look hands in where the player is (`here`, read once) and the
 * round's number (`round`): what a module reads of its own horses can then be read once a round and not once for every player (2026-10-27, thirty
 * players: the wild horses were read again for each Domador, eight reads a horse, twice a second). Called without them, it reads everything afresh.
 * An answer may say where the horse is and how far (`x`, `y`, `z`, `distance`), which spares reading it again.
 */
export interface NearExtraFound {
    readonly horse: Horse;
    readonly w: boolean;
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly distance?: number;
}
export const nearExtras: Array<(player: Player, reachM: number, here?: { readonly x: number; readonly y: number; readonly z: number }, round?: number) => NearExtraFound | null> = [];
/** The number of the near look's round, for `nearExtras`. */
let nearRound = 0;
export const askExtras: Array<(player: Player, horse: Horse) => boolean | null> = [];

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

export function menuPage(player: Player, horse: Horse): DialoguePage {
    const owner = horse.owner;
    const mine = owner !== null && owner.id === player.id;
    // KCDC 1.7.0: a horse the game could not kill is knocked out, lying where it fell, and gets up by itself after some minutes.
    const down = horse.unconscious === true;
    return {
        line: down ? `${horse.name || "Cavalo"} está desacordado e se levanta sozinho em alguns minutos.` : `${horse.name || "Cavalo"}: o que você quer fazer?`,
        onRight: false,
        options: [
            { id: "mount", text: "Montar", enabled: horse.alive && !down && horse.rider === null },
            { id: "bags", text: mine ? "Bolsa" : "Bolsa (só o dono)", enabled: mine && horse.alive && horse.rider === null },
            // The owner's order: follow, or stay (which only stops the following: the whistle still calls it).
            isFollowing(horse)
                ? { id: "stay", text: "Ficar", enabled: mine && horse.alive }
                : { id: "follow", text: mine ? "Seguir" : "Seguir (só o dono)", enabled: mine && horse.alive && !down && horse.rider === null },
            { id: "close", text: "Sair", enabled: true },
        ],
    };
}

function close(player: Player): void {
    const old = sessionOf.get(player.id);
    if (old !== undefined) {
        sessions.delete(old);
        sessionOf.delete(player.id);
        Dialogue.close(old);
    }
}

/** Opens the menu of a horse for a player. False when there is none to offer now. */
export function openHorseMenu(player: Player, horse: Horse): boolean {
    if (!player.ready || !player.alive || !horse.alive || Dialogue.sessionOf(player.id) !== 0) {
        return false;
    }
    close(player);
    const session = Dialogue.open(player.id, menuPage(player, horse));
    if (session === 0) {
        return false;
    }
    sessions.set(session, { playerId: player.id, horseId: horse.id });
    sessionOf.set(player.id, session);
    openedAt.set(session, Date.now());
    return true;
}

/** Whether this player has a horse's menu up now. */
export function menuUp(player: Player): boolean {
    const session = sessionOf.get(player.id);
    return session !== undefined && sessions.has(session);
}

/** Whether a climb of this player onto this horse is the one "Montar" let through. */
export function climbAllowed(player: Player, horse: Horse, now = Date.now()): boolean {
    const grant = allowed.get(player.id);
    if (grant === undefined) {
        return false;
    }
    if (grant.until < now) {
        allowed.delete(player.id);
        return false;
    }
    return grant.horseId === horse.id;
}

/** The player's E, heard by their client at a kept horse: the menu, before the climb gets anywhere. */
export function askMenu(player: Player, horseId: unknown, now = Date.now()): boolean {
    const horse = typeof horseId === "number" ? Horse.getById(horseId) : null;
    // A horse that has a menu of its own (a wild one) is that module's to answer.
    if (horse !== null && !player.horse) {
        for (const ask of askExtras) {
            const answered = ask(player, horse);
            if (answered !== null) {
                return answered;
            }
        }
    }
    if (horse === null || !horse.alive || horse.rider !== null || mayRide(horse, player) !== true || player.horse || flat(horse.position, player.position) > horseMenu.askM || bagsBusy(player.id, now)) {
        return false;
    }
    // Only a menu that did open stands for the climb the same E may set off (2026-10-19: one that could not open -- another list
    // up -- left the climb refused with no menu at all: "subiu direto, depois desceu sem abrir o menu").
    const opened = openHorseMenu(player, horse);
    if (opened) {
        askedAt.set(player.id, now);
    }
    return opened;
}

/** Lets the one climb of this player onto this horse through the refusal of `horseMounting` (a taming's "Montar" sets one off by itself). */
export function grantClimb(player: Player, horse: Horse, now = Date.now()): void {
    allowed.set(player.id, { horseId: horse.id, until: now + horseMenu.allowMs });
}

/** Puts the player in the saddle, letting the one climb through the refusal of `horseMounting` (`allowed`). */
export function startMount(player: Player, horse: Horse, now = Date.now()): void {
    if (!player.ready || !player.alive || !horse.alive || horse.rider !== null || flat(horse.position, player.position) > horseMenu.reachM) {
        tell(player, "Você se afastou demais do cavalo.");
        return;
    }
    allowed.set(player.id, { horseId: horse.id, until: now + horseMenu.allowMs });
    if (!player.mount(horse)) {
        allowed.delete(player.id);
        tell(player, "Não consegui pôr você na sela agora. Tente de novo.");
    }
}

export function chooseHorse(session: number, player: Player, option: string, now = Date.now()): void {
    const menu = sessions.get(session);
    if (menu === undefined || menu.playerId !== player.id) {
        return;
    }
    const opened = openedAt.get(session) ?? Number.NEGATIVE_INFINITY;
    sessions.delete(session);
    sessionOf.delete(player.id);
    openedAt.delete(session);
    Dialogue.close(session);
    const horse = Horse.getById(menu.horseId);
    if (horse === null || option === "close") {
        return;
    }
    if (now - opened < horseMenu.sameKeyMs) {
        openHorseMenu(player, horse);
        return;
    }
    if (!horse.alive || flat(horse.position, player.position) > horseMenu.reachM) {
        tell(player, "Você se afastou demais do cavalo.");
        return;
    }
    if (option === "bags") {
        const owned = horse.owner !== null && horse.owner.id === player.id;
        tell(player, owned ? openBags(player, null).message : "Só o dono abre as alforjes.");
        return;
    }
    if (option === "follow" || option === "stay") {
        if (horse.owner === null || horse.owner.id !== player.id) {
            tell(player, "Só o dono manda no cavalo.");
            return;
        }
        if (option === "follow") {
            tell(player, startFollowing(horse, player).message);
        } else {
            tell(player, stopFollowing(horse) ? `${horse.name || "O cavalo"} fica onde está. O assobio (X) ainda o chama.` : `${horse.name || "O cavalo"} já estava parado.`);
        }
        return;
    }
    if (option === "mount") {
        if (horse.rider !== null) {
            tell(player, "Esse cavalo já tem um cavaleiro.");
            return;
        }
        // The get-off of a climb that was refused is still playing: a mount asked for now would be undone by it.
        const wait = (refusedAt.get(player.id) ?? Number.NEGATIVE_INFINITY) + horseMenu.getOffMs - now;
        if (wait > 0) {
            const id = horse.id;
            setTimeout(() => {
                const again = Horse.getById(id);
                if (again !== null) {
                    startMount(player, again);
                }
            }, wait);
            return;
        }
        startMount(player, horse, now);
    }
}

/**
 * The alforjes screen was closed by its player: the horse's menu comes back by itself, so that the next E is a choice and never
 * the game's own climb. Not for a horse gone, mounted, or left behind.
 */
export function menuAfterBags(player: Player, key: string, now = Date.now()): boolean {
    const owned = horsesOf(player.steamId).find((entry) => entry.record.key === key);
    const horse = owned?.horse ?? null;
    if (horse === null || !horse.alive || horse.rider !== null || !player.ready || !player.alive || player.horse || flat(horse.position, player.position) > horseMenu.reachM) {
        return false;
    }
    // The climb an E sets off while the menu is coming is refused and asks for no second menu.
    askedAt.set(player.id, now);
    return openHorseMenu(player, horse);
}

/** Tells each client of the kept horse that stands within reach of its player, so that its E can ask for the menu. */
function tellNear(): void {
    // Each horse's position and each player's is read once for the round: every read is a call into the engine, and they were made again for each pair
    // (a hundred horses by twenty players, twice a second, 2026-10-25).
    const horses = Horse.all()
        .filter((horse) => horse.alive && horse.rider === null)
        .map((horse) => {
            const at = horse.position;
            return { horse, x: at.x, y: at.y, z: at.z };
        });
    nearRound += 1;
    const round = nearRound;
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        // What is near is found first, by distance, and whether the player can take it (alive, on foot) is asked of the engine only when something is: most
        // players are near no horse, and two reads fewer each, for thirty players twice a second, add up (2026-10-27). The answer is the same.
        let best: Horse | null = null;
        let bestAt: { readonly x: number; readonly y: number; readonly z: number } | null = null;
        let wild = false;
        let nearest = horseMenu.nearM;
        // In plain numbers: each `.x` of an engine's vector is a call into the engine, and it was read for every horse (2026-10-28).
        const place = player.position;
        const here = { x: place.x, y: place.y, z: place.z };
        for (const one of horses) {
            const range = Math.hypot(one.x - here.x, one.y - here.y);
            if (range <= nearest && Math.abs(one.z - here.z) <= 2.5 && mayRide(one.horse, player) === true) {
                nearest = range;
                best = one.horse;
                bestAt = one;
            }
        }
        // A wild horse the player may tame, when it is nearer than any kept one.
        for (const extra of nearExtras) {
            const found = extra(player, nearest, here, round);
            if (found !== null) {
                const at = found.x !== undefined && found.y !== undefined && found.z !== undefined ? { x: found.x, y: found.y, z: found.z } : found.horse.position;
                const range = found.distance ?? flat(at, here);
                if (range <= nearest) {
                    nearest = range;
                    best = found.horse;
                    bestAt = at;
                    wild = found.w;
                }
            }
        }
        if (best !== null && (!player.alive || player.horse)) {
            best = null;
        }
        let text = "";
        if (best !== null && bestAt !== null) {
            const at = bestAt;
            text = JSON.stringify({ id: best.id, x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, z: Math.round(at.z * 10) / 10, ...(wild ? { w: 1 } : {}) });
        }
        if ((told.get(player.id) ?? "") !== text) {
            told.set(player.id, text);
            player.emit(`${RESOURCE}:horse.near`, text === "" ? JSON.stringify({ id: 0 }) : text);
        }
    }
}

export function installHorseMenu(): void {
    // A climb of a kept horse by one who may ride it is the menu's to allow; the others are `horses.ts`'s to refuse.
    Events.on("horseMounting", (horse, rider) => {
        if (mayRide(horse, rider) !== true || climbAllowed(rider, horse)) {
            return undefined;
        }
        const now = Date.now();
        refusedAt.set(rider.id, now);
        try {
            // Told to get off at once, besides the refusal's own get-off.
            rider.dismount();
        } catch {
            // Not in a saddle as far as the server knows.
        }
        // A climb from the alforjes screen is refused and asks nothing: the E was for an item.
        if (bagsBusy(rider.id, now)) {
            return false;
        }
        if (!menuUp(rider) && now - (askedAt.get(rider.id) ?? Number.NEGATIVE_INFINITY) > horseMenu.askedMs) {
            openHorseMenu(rider, horse);
        }
        // Once the get-off is over, a menu that the climb took down (or that never came) is put up.
        const id = horse.id;
        setTimeout(() => {
            const again = Horse.getById(id);
            if (again !== null && !menuUp(rider) && !rider.horse && rider.alive && again.rider === null && flat(again.position, rider.position) <= horseMenu.reachM && !bagsBusy(rider.id, Date.now())) {
                openHorseMenu(rider, again);
            }
        }, horseMenu.getOffMs);
        return false;
    });
    Events.onClient(`${RESOURCE}:horse.menu`, (sender, payload) => {
        let id: unknown;
        try {
            id = ((typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown } | null)?.id;
        } catch {
            return;
        }
        askMenu(sender as Player, id);
    });
    Events.on("dialogueChoice", (session, player, option) => chooseHorse(session, player, option));
    bagsClosed.push((player, key) => {
        setTimeout(() => {
            menuAfterBags(player, key);
        }, horseMenu.afterBagsMs);
    });
    Events.on("dialogueClosed", (session) => {
        const menu = sessions.get(session);
        if (menu !== undefined) {
            sessions.delete(session);
            sessionOf.delete(menu.playerId);
            openedAt.delete(session);
        }
    });
    Events.on("playerDisconnect", (player) => {
        allowed.delete(player.id);
        refusedAt.delete(player.id);
        askedAt.delete(player.id);
        told.delete(player.id);
        close(player);
    });
    const timer = setInterval(tellNear, horseMenu.nearEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
