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

/**
 * How long a join is watched, counted from the moment the body is ready (or from the spawn, when that was quick). It was 36 s; a slow client
 * that finishes loading after that dressed Henry over a look nobody was watching any more (2026-10-25), so the client's own report is looked at
 * for two minutes, and the look is sent again whenever it says it is not the saved one.
 */
const WATCH_MS = 120_000;

/**
 * How long a body that is not ready yet is waited for. The watch used to end 36 s after the spawn, ready or not, and a body that took
 * longer to load (a slow machine, a server whose ticks run late: 2026-10-25, "perdem a aparência e ficam como Henry") was never given
 * its look: 16 joins in nine days ended with "saved look sent 0 time(s)". The moments of `CHECKPOINTS_S` are counted from `READY_LEAD_S`
 * seconds before the body was ready when that was later than the spawn's own.
 */
const READY_WAIT_MS = 5 * 60_000;
const READY_LEAD_S = 5;

/** Refusals before the saved look is written off. */
const MAX_REFUSALS = 3;

const PARTS = ["head", "hair", "beard", "body"] as const;

/** An empty part in the saved look means "leave it to the game", so only the named parts are compared. */
function holds(published: Appearance, wanted: Appearance): boolean {
    return published.gender === wanted.gender && PARTS.every((part) => wanted[part] === "" || wanted[part] === undefined || published[part] === wanted[part]);
}

function watchLook(id: number): void {
    const startedAt = Date.now();
    /** Where the watch's own clock starts: the spawn, or a little before the body was ready when it took long to be. */
    let clockFrom = startedAt;
    let readySeen = false;
    let lastSentAt = -MIN_GAP_MS;
    let sends = 0;
    let refusals = 0;
    let checkpoint = 0;

    const timer = setInterval(() => {
        const player = Player.getById(id);
        if (!player) {
            clearInterval(timer);
            return;
        }
        if (player.ready && !readySeen) {
            readySeen = true;
            clockFrom = Math.max(startedAt, Date.now() - READY_LEAD_S * 1000);
        }
        const elapsed = Date.now() - clockFrom;

        const saved = getCharacter(player.steamId);
        const waitedTooLong = !readySeen && Date.now() - startedAt > READY_WAIT_MS;
        if ((readySeen && elapsed > WATCH_MS) || waitedTooLong || !saved) {
            clearInterval(timer);
            if (saved) {
                console.log(`${player.nickname}: saved look sent ${sends} time(s); the client reports ${holds(player.appearance, saved.appearance) ? "it" : `${JSON.stringify(player.appearance)}, not it`}`);
            }
            return;
        }
        if (!readySeen) {
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
        const saved = getCharacter(player.steamId);
        if (saved?.redo === true) {
            // Made again by an administrator's decision: the creator, which cannot be left until the new look is accepted.
            Chat.sendToPlayer(player, "A administração pediu que você refaça o seu personagem: escolha o visual de novo (o nome pode ficar ou mudar).");
            console.log(`first-join: ${player.nickname} vai refazer o personagem`);
            openCreatorFor(player, "both");
            return;
        }
        if (saved) {
            watchLook(player.id);
            return;
        }

        Chat.sendToPlayer(player, "Vamos criar o seu personagem. Digite /creator a qualquer momento para mudar depois.");
        openCreatorFor(player, "both");
    });
}
