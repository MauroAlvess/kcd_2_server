/**
 * A horse of a player's sent to follow them (user, 2026-10-22: "adicionamos uma nova opção no menu do cavalo: mandar seguir e mandar ficar; o
 * mandar ficar só para de seguir e continua indo se usar o assobiar"). The framework gives a horse no follow order, only `moveTo` and `patrol`,
 * so the server walks it: every `tickMs` it looks at where the owner stands and, once they have moved on, sends the horse to them with a
 * radius (so it stops a few steps short), faster the further behind it is. It follows on foot while the owner rides another horse, too.
 *
 * It ends when the owner says to stay (the horse is held where it is, and still comes at their whistle, `horses.ts`), when the owner mounts this
 * horse, dies or leaves, when somebody else is on it, when it is dead or knocked out, when the owner goes further than `giveUpM`, or when no way
 * to them is found `failures` times in a row. Nothing of it outlives a restart: a horse that waited keeps waiting.
 */

import { languageOf, translate } from "./language.js";

const RESOURCE = "kcdc-gamemode";
const NOTIFY = `${RESOURCE}:notify`;

export const followSettings = {
    tickMs: 1_200,
    /** How near the owner the horse stops: the radius of its order. */
    stopRadiusM: 3,
    /** The owner this far from where the horse was last sent is the horse sent again. */
    resendM: 3.5,
    /** Further than this behind, the horse runs; further than `jogM`, it jogs; else it walks. */
    runM: 14,
    jogM: 7,
    /** Further than this, it is left behind for good and the owner is told to whistle. */
    giveUpM: 120,
    /** Orders that found no way, or ended blocked, with the horse no nearer than before: so many and it is let be. */
    failures: 3,
    /** How much nearer the owner the horse must get for the failed orders not to count. */
    progressM: 2,
};

interface Follow {
    readonly horseId: number;
    readonly ownerId: number;
    /** Where the horse was last sent. */
    target: { x: number; y: number } | null;
    /** Orders that found no way or ended blocked since the horse last got nearer (or arrived). */
    failures: number;
    /** The nearest the horse has been to its owner since it was last stuck. */
    best: number;
}

const follows = new Map<number, Follow>();

const flat = (a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function tell(player: Player | null, text: string): void {
    if (player === null) {
        return;
    }
    try {
        Chat.sendToPlayer(player, text);
        player.emit(NOTIFY, JSON.stringify({ text: translate(text, languageOf(player)) }));
    } catch {
        // Gone already.
    }
}

export function isFollowing(horse: Horse): boolean {
    return follows.has(horse.id);
}

/** What a horse is called in what it is told to the owner. */
function nameOf(horse: Horse): string {
    return horse.name !== "" ? horse.name : "O cavalo";
}

export interface FollowOutcome {
    readonly ok: boolean;
    readonly message: string;
}

/** Sends the owner's horse after them. */
export function startFollowing(horse: Horse, owner: Player): FollowOutcome {
    if (!horse.alive || horse.mounted || horse.unconscious === true) {
        return { ok: false, message: `${nameOf(horse)} não pode seguir agora.` };
    }
    if (owner.horse && owner.horse.id === horse.id) {
        return { ok: false, message: "Você está montado nele: desça para mandá-lo seguir." };
    }
    follows.set(horse.id, { horseId: horse.id, ownerId: owner.id, target: null, failures: 0, best: flat(horse.position, owner.position) });
    // The first order goes at once, not at the next tick.
    followTick(Date.now());
    return { ok: true, message: `${nameOf(horse)} vai seguir você. Em "Ficar" ele para; o assobio (X) continua chamando.` };
}

/** Ends a horse's following; `hold` keeps it where it stands. False when it was not following. */
export function stopFollowing(horse: Horse | number, hold = true): boolean {
    const id = typeof horse === "number" ? horse : horse.id;
    if (!follows.delete(id)) {
        return false;
    }
    if (hold) {
        try {
            (typeof horse === "number" ? Horse.getById(horse) : horse)?.hold();
        } catch {
            // Gone already.
        }
    }
    return true;
}

/** How fast a horse `distance` behind its owner goes. */
export function speedFor(distance: number): "walk" | "jog" | "run" {
    return distance > followSettings.runM ? "run" : distance > followSettings.jogM ? "jog" : "walk";
}

/** One look at every horse that follows: ends the ones that cannot, and sends the others on after their owners. */
export function followTick(_now: number = Date.now()): void {
    for (const follow of [...follows.values()]) {
        const horse = Horse.getById(follow.horseId);
        const owner = Player.getById(follow.ownerId);
        if (horse === null || !horse.alive) {
            follows.delete(follow.horseId);
            continue;
        }
        if (owner === null || !owner.ready || !owner.alive) {
            stopFollowing(horse);
            continue;
        }
        if (horse.mounted || horse.unconscious === true || (owner.horse && owner.horse.id === horse.id)) {
            follows.delete(follow.horseId);
            continue;
        }
        const distance = flat(horse.position, owner.position);
        if (distance > followSettings.giveUpM) {
            stopFollowing(horse);
            tell(owner, `${nameOf(horse)} ficou para trás, longe demais. Assobie (X) para chamá-lo.`);
            continue;
        }
        // Getting nearer is not being stuck: the count of failed orders starts again.
        if (distance < follow.best - followSettings.progressM) {
            follow.best = distance;
            follow.failures = 0;
        }
        if (distance <= followSettings.stopRadiusM + 0.5) {
            continue;
        }
        // Stuck: the orders found no way, or ended blocked, and the horse got no nearer.
        if (follow.failures >= followSettings.failures) {
            stopFollowing(horse);
            tell(owner, `${nameOf(horse)} não achou caminho até você e parou. Assobie (X) para chamá-lo.`);
            continue;
        }
        const moving = horse.navigationStatus === "running";
        if (moving && follow.target !== null && flat(follow.target, owner.position) <= followSettings.resendM) {
            continue;
        }
        const ok = horse.moveTo(owner.position, { speed: speedFor(distance), radius: followSettings.stopRadiusM });
        follow.target = { x: owner.position.x, y: owner.position.y };
        if (!ok) {
            follow.failures += 1;
        }
    }
}

export function installHorseFollow(): void {
    const timer = setInterval(() => {
        try {
            followTick();
        } catch (error: unknown) {
            console.log(`horse-follow: a volta falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, followSettings.tickMs);
    // An order that ended blocked or failed counts; one that arrived clears the count.
    Events.on("horseIntentDone", (horse, status) => {
        const follow = follows.get(horse.id);
        if (follow === undefined) {
            return;
        }
        if (status === "blocked" || status === "failed") {
            follow.failures += 1;
            follow.target = null;
        } else if (status === "reached") {
            follow.failures = 0;
        }
    });
    Events.on("horseMount", (horse) => {
        follows.delete(horse.id);
    });
    Events.on("horseDestroy", (horse) => {
        follows.delete(horse.id);
    });
    Events.on("playerDisconnect", (player) => {
        for (const follow of [...follows.values()]) {
            if (follow.ownerId === player.id) {
                stopFollowing(follow.horseId);
            }
        }
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            follows.clear();
        }
    });
}
