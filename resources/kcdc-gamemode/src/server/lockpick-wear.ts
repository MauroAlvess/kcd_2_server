/**
 * The lockpick that breaks (user, 2026-10-26: "Lockpick não está quebrando, fica infinito o arrombar"). The lockpicking minigame is the game's own and runs on the
 * player's machine; the inventory is the server's, and the game's "the pick broke" never took the pick out of it, so a player picked any lock for ever with the
 * one pick they carried.
 *
 * It first broke at the START of the attempt (a chance of 30% in `doorInteract` / `stashInteract` with the action `lockpick`, refusing the attempt), which a player
 * called a bug on 2026-10-28: "gazuas estão quebrando sem fazer o minijogo". Now the attempt is never refused: the minigame is played as the game has it, and the
 * pick may snap in the lock once it has OPENED (`lockpickWear.breakChance`): one lockpick goes out of the bag and the player is told. The server learns the
 * lock has opened from the door's or the chest's own state (`locked` going false, looked at every `lookMs` while an attempt is followed), and from the first
 * thing that follows an open lock (the chest's `stashOpen`, the door's `unlock` or `open`). A failed or given-up attempt costs nothing but the time it took.
 *
 * A player with no lockpick in the bag is never touched (the game does not offer the pick then).
 */

export const lockpickWear = {
    /** The chance, once a lock has been picked, that the pick snaps in it. */
    breakChance: 0.3,
    /** The game's own name for the item, the spelling `player.takeItem` takes. */
    item: "player_lockpick",
    /** How often the locks being picked are looked at. */
    lookMs: 700,
    /** How long an attempt is followed: the minigame is over by then, picked or given up. */
    followMs: 3 * 60_000,
};

interface Attempt {
    /** A door is followed by its GUID, a chest by its id. */
    readonly kind: "door" | "stash";
    readonly key: string;
    readonly startedAt: number;
}

/** The lockpicks in a player's bag, 0 when the inventory is not ready. */
function picksIn(player: Player): number {
    const state = Inventory.get(player);
    if (state === null || !state.ready) {
        return 0;
    }
    return state.items.filter((row) => String(row.name) === lockpickWear.item).reduce((sum, row) => sum + row.amount, 0);
}

/** Whether what is being picked is locked: true or false, or null when it cannot be read any more (gone, or the world changed). */
function lockedNow(attempt: Attempt): boolean | null {
    try {
        const target = attempt.kind === "door" ? Door.find(attempt.key) : Stash.getById(Number(attempt.key));
        return target === null ? null : target.locked;
    } catch {
        return null;
    }
}

export function installLockpickWear(random: () => number = Math.random, now: () => number = Date.now): void {
    /** A player picks one lock at a time. */
    const attempts = new Map<number, Attempt>();

    /** The lock has opened: the pick may break in it. */
    const opened = (player: Player): void => {
        attempts.delete(player.id);
        if (picksIn(player) < 1 || random() >= lockpickWear.breakChance) {
            return;
        }
        player.takeItem(lockpickWear.item, 1).then(
            (result) => {
                if (!result.ok) {
                    console.log(`lockpick: ${player.nickname} tinha uma gazua que não pôde ser tirada (${result.reason})`);
                }
            },
            () => undefined,
        );
        Chat.sendToPlayer(player, "A fechadura abriu, mas a gazua quebrou nela. Você perdeu uma gazua.");
        console.log(`lockpick: ${player.nickname} quebrou uma gazua ao abrir a fechadura`);
    };

    const begin = (player: Player, kind: Attempt["kind"], key: string): void => {
        if (picksIn(player) < 1) {
            attempts.delete(player.id);
            return;
        }
        attempts.set(player.id, { kind, key, startedAt: now() });
    };

    Events.on("doorInteract", (player, door, action) => {
        if (action === "lockpick") {
            begin(player, "door", door.guid);
            return undefined;
        }
        // The first thing a player does at a door they have just opened (the pick's "unlock", then "open").
        const attempt = attempts.get(player.id);
        if (attempt !== undefined && attempt.kind === "door" && attempt.key === door.guid && (action === "unlock" || action === "open")) {
            opened(player);
        }
        return undefined;
    });
    Events.on("stashInteract", (player, stash, action) => {
        if (action === "lockpick") {
            begin(player, "stash", String(stash.id));
        }
        return undefined;
    });
    // A successful pick opens the chest without asking `stashInteract` again.
    Events.on("stashOpen", (stash, player) => {
        const attempt = attempts.get(player.id);
        if (attempt !== undefined && attempt.kind === "stash" && attempt.key === String(stash.id)) {
            opened(player);
        }
    });
    Events.on("playerDisconnect", (player) => {
        attempts.delete(player.id);
    });
    // What the game says of a lock it counts as picked: written down (the first ones of a run), to learn what its XP tells of a minigame's end.
    let xpSeen = 0;
    Events.on("playerXpGaining", (player, track, xp, source) => {
        if (source === "LockpickingResult" && xpSeen < 200) {
            xpSeen += 1;
            console.log(`lockpick: ${player.nickname}: o jogo deu ${xp} de experiência em ${track} por arrombar (${attempts.has(player.id) ? "tentativa seguida" : "sem tentativa seguida"})`);
        }
        return undefined;
    });

    const timer = setInterval(() => {
        const at = now();
        for (const [id, attempt] of attempts) {
            const player = Player.getById(id);
            if (player === null || at - attempt.startedAt > lockpickWear.followMs) {
                attempts.delete(id);
                continue;
            }
            const locked = lockedNow(attempt);
            if (locked === null) {
                attempts.delete(id);
            } else if (!locked) {
                opened(player);
            }
        }
    }, lockpickWear.lookMs);
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(timer);
        }
    });
    console.log(`lockpick: a gazua pode quebrar em ${Math.round(lockpickWear.breakChance * 100)}% das fechaduras que abre, depois do minijogo`);
}
