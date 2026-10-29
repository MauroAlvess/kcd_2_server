/**
 * Who is in a saddle, or has just got on or off one, told to every client so that each keeps the sound of it to the players near (players,
 * 2026-10-26: "sempre que alguém sobe no cavalo, escutam de longe").
 *
 * The get-on and the get-off are the game's own animations, on the rider and on the horse, on every machine that sees them, and they fire
 * the game's foley (the tack, the saddle, the horse's snort, the hand on the saddle, the boots landing). A horse with a rider is also given the
 * sounds the game makes for the player's own horse: its hoofsteps (`event:/animals/horse/hoofsteps_player/...`), its breath when tired, its
 * answer to a call, which the game lets carry 219 m or does not cut by distance at all, because in single player that horse is always the
 * listener's own. The server cannot say who hears an animation, so it says who rides and who has just got on or off, and each machine stops
 * those sounds on the riders and horses further away (`client/mount-quiet.ts`, as `work-quiet.ts` does for the axe and the pick).
 */

const RESOURCE = "kcdc-gamemode";
export const MOUNT_SOUNDS_EVENT = `${RESOURCE}:mount.sounds`;
/** A client that found no horse beside a far rider says which classes it found, once, for the log. */
export const MOUNT_SEEN_EVENT = `${RESOURCE}:mount.seen`;

/** The list is said again this often while anybody rides, so a machine that came in later, or missed one, has it. */
export const REPEAT_MS = 3_000;
/** A get-on or a get-off goes on being quieted this long after the server hears of it: the animation and its sounds. */
export const STIR_MS = 6_000;
/** Riders said at once, at most. */
const MAX_RIDERS = 128;
/**
 * Every get-on and get-off is said to every player in the world, so that each of the hundreds of machines has the list before the sound: a burst of them (a
 * crowd setting off, 2026-10-27, when the server was asked to be ready for two hundred) would send hundreds of packets for each. The list is said at most
 * this often; what comes inside the window is said once, when it ends, and the first one of a quiet spell is still at once.
 */
export const COALESCE_MS = 250;

const stirring = new Map<number, number>();
let saidSome = false;
let lastTold = Number.NEGATIVE_INFINITY;
let waiting = false;

/** The network ids of the players in a saddle now and of those who got on or off one in the last `STIR_MS`. */
export function ridersNow(now: number = Date.now()): number[] {
    const ids = new Set<number>();
    for (const player of Player.all()) {
        if (player.ready && player.mounted) {
            ids.add(player.id);
        }
    }
    for (const [id, until] of [...stirring]) {
        if (until <= now) {
            stirring.delete(id);
            continue;
        }
        ids.add(id);
    }
    return [...ids].slice(0, MAX_RIDERS);
}

function tell(only?: Player, now: number = Date.now()): void {
    const riders = ridersNow(now);
    const text = JSON.stringify({ r: riders });
    const to = only === undefined ? Player.all() : [only];
    for (const player of to) {
        if (!player.ready) {
            continue;
        }
        try {
            player.emit(MOUNT_SOUNDS_EVENT, text);
        } catch {
            // Gone already.
        }
    }
    if (only === undefined) {
        saidSome = riders.length > 0;
        lastTold = now;
    }
}

/** The list said to everybody now, or at the end of the window if one was said a moment ago. */
function tellSoon(now: number): void {
    const since = now - lastTold;
    if (since >= COALESCE_MS) {
        tell(undefined, now);
        return;
    }
    if (!waiting) {
        waiting = true;
        setTimeout(() => {
            waiting = false;
            tell(undefined, Date.now());
        }, COALESCE_MS - since);
    }
}

/** A player got on or off a horse, or is climbing: every machine is told at once, so the far ones quiet the animation's sounds. */
export function stirred(player: Player | null | undefined, now: number = Date.now()): void {
    if (player === null || player === undefined) {
        return;
    }
    stirring.set(player.id, now + STIR_MS);
    tellSoon(now);
}

/** The list said again, while anybody rides, and once more when nobody does any more (so the machines let go). */
export function repeat(now: number = Date.now()): void {
    if (saidSome || ridersNow(now).length > 0) {
        tell(undefined, now);
    }
}

const reported = new Set<string>();

export function installMountSound(): void {
    const timer = setInterval(() => repeat(), REPEAT_MS);
    // Nothing is decided here: the handler of the climb returns nothing, so the ride goes on as the other handlers say.
    Events.on("horseMounting", (_horse, rider) => {
        stirred(rider);
    });
    Events.on("horseMount", (_horse, rider) => {
        stirred(rider);
    });
    Events.on("horseDismount", (_horse, rider) => {
        stirred(rider);
    });
    Events.on("playerReady", (player) => {
        tell(player);
    });
    Events.onClient(MOUNT_SEEN_EVENT, (sender, payload) => {
        let classes: unknown;
        try {
            classes = typeof payload === "string" ? (JSON.parse(payload) as { c?: unknown }).c : undefined;
        } catch {
            return;
        }
        if (!Array.isArray(classes)) {
            return;
        }
        const named = classes.filter((one): one is string => typeof one === "string" && /^[\w.:-]{1,40}$/.test(one)).slice(0, 8).sort();
        const key = named.join(",");
        if (reported.has(key) || reported.size >= 20) {
            return;
        }
        reported.add(key);
        console.log(`montaria: nenhum cavalo achado junto de um cavaleiro distante, por ${(sender as Player).nickname}; o que havia ali: ${key || "nada"}`);
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            stirring.clear();
        }
    });
}
