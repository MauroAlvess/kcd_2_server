/**
 * Whether a spawning player needs the character creator, or already has a
 * look saved from a previous visit. A brand new player and one who has
 * played before but never finished the creator look the same here -- both
 * have no entry in `characters.ts` -- so both are asked the same way.
 *
 * A saved look is not sent once. `playerSpawned` fires while the player's own
 * game is still behind its loading screen, and when the game finishes loading
 * (about five seconds later on a quick machine, more on a slow one) it dresses
 * its default Henry over whatever was asked for. `player.appearance` is the
 * look the client last published, so it can show the right look while the body
 * wears the wrong one. The look is therefore sent again at fixed moments as
 * well as whenever the published look differs.
 */

import { getCharacter } from "./characters.js";
import { openCreatorFor } from "./creator.js";

const CHECK_MS = 2000;

/** Seconds after spawning at which the look is sent whatever the client reports. */
const CHECKPOINTS_S = [6, 12, 20, 30] as const;

/** The same look is not sent more often than this. */
const MIN_GAP_MS = 4000;

/** How long a join is watched. */
const WATCH_MS = 36_000;

/** Refusals before the saved look is written off. */
const MAX_REFUSALS = 3;

const PARTS = ["head", "hair", "beard", "body"] as const;

/** An empty part in the saved look means "leave it to the game", so only the named parts are compared. */
function holds(published: Appearance, wanted: Appearance): boolean {
    return published.gender === wanted.gender && PARTS.every((part) => wanted[part] === "" || wanted[part] === undefined || published[part] === wanted[part]);
}

function watchLook(id: number): void {
    const startedAt = Date.now();
    let lastSentAt = -MIN_GAP_MS;
    let sends = 0;
    let refusals = 0;
    let checkpoint = 0;

    const timer = setInterval(() => {
        const player = Player.getById(id);
        const elapsed = Date.now() - startedAt;
        if (!player) {
            clearInterval(timer);
            return;
        }

        const saved = getCharacter(player.steamId);
        if (elapsed > WATCH_MS || !saved) {
            clearInterval(timer);
            if (saved) {
                console.log(`${player.nickname}: saved look sent ${sends} time(s); the client reports ${holds(player.appearance, saved.appearance) ? "it" : `${JSON.stringify(player.appearance)}, not it`}`);
            }
            return;
        }
        if (!player.ready) {
            return;
        }

        let due = false;
        while (checkpoint < CHECKPOINTS_S.length && elapsed >= CHECKPOINTS_S[checkpoint]! * 1000) {
            checkpoint += 1;
            due = true;
        }
        if ((!due && holds(player.appearance, saved.appearance)) || elapsed - lastSentAt < MIN_GAP_MS) {
            return;
        }

        lastSentAt = elapsed;
        sends += 1;
        if (!player.setAppearance(saved.appearance)) {
            refusals += 1;
            console.log(`${player.nickname}: the game refused the saved look ${JSON.stringify(saved.appearance)}`);
            if (refusals >= MAX_REFUSALS) {
                clearInterval(timer);
            }
        }
    }, CHECK_MS);
}

export function installFirstJoin(): void {
    Events.on("playerSpawned", (player) => {
        if (getCharacter(player.steamId)) {
            watchLook(player.id);
            return;
        }

        Chat.sendToPlayer(player, "Vamos criar o seu personagem. Digite /creator a qualquer momento para mudar depois.");
        openCreatorFor(player, "both");
    });
}
