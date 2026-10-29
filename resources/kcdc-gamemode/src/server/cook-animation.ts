/**
 * The cooking animation (user, 2026-10-18: "agora cozinhar não tá fazendo mais animação"). The game's own cooking happens
 * on the player's machine with its animation and the server takes over the swap of items (`cooking.ts`); what the server
 * does by itself is silent. So while it works, the player plays one of the game's animations for it, held still, with what
 * it asks to hold in the hand, for a few seconds, and the swap is made when it ends.
 *
 * The animation is looked for in the game's own catalog (`Animations.list`) by what it is called, the first of these words
 * that has any (a cook at a pot, a stirring, a roast): the catalog has over six thousand rows and no list of them is kept
 * here. What was picked is written to the log once, with a few of the others, so it can be changed by name.
 */

import { PLAYER_ONLY_SOUND, playWork, stopWork } from "./craft-animation.js";

const SEARCHES: readonly string[] = ["cook", "stir", "roast", "spit", "pot", "fire"];

export const cookingAnimation = {
    /** How long the player cooks, in milliseconds. */
    ms: 4_000,
};

let chosen: AnimationInfo | null | undefined;

/** The animation cooking plays, or null when the catalog has none that fits. */
export function pickCookingAnimation(): AnimationInfo | null {
    if (chosen !== undefined) {
        return chosen;
    }
    chosen = null;
    try {
        for (const word of SEARCHES) {
            // Never one whose sound the game meant for the player alone: every client would play it, heard everywhere.
            const rows = Animations.list(word).filter((row) => !PLAYER_ONLY_SOUND.has(row.fragment.toLowerCase()));
            if (rows.length === 0) {
                continue;
            }
            const fitting = rows.filter((row) => row.male && row.female);
            const best = fitting.find((row) => row.fullBody && !row.oneShot) ?? fitting[0] ?? rows[0];
            if (best !== undefined) {
                chosen = best;
                console.log(`cooking: animação de cozinhar: '${best.fragment}' (${best.tags || "sem tags"}), achada por '${word}' entre ${rows.length}; outras: ${rows.slice(0, 8).map((row) => row.fragment).join(", ")}`);
                break;
            }
        }
        if (chosen === null) {
            console.log("cooking: o catálogo de animações não tem nada de cozinhar; o preparo não toca animação");
        }
    } catch (error: unknown) {
        console.log(`cooking: não consegui procurar a animação de cozinhar: ${error instanceof Error ? error.message : String(error)}`);
    }
    return chosen;
}

/**
 * Starts it on a player, held still: the cooks' own stirring of the pot with the scoop in hand, as at the trades' page (2026-10-25,
 * `craft-animation.ts`); the word search only when that cannot play. False when there is none to play or it was refused.
 */
export function playCooking(player: Player): boolean {
    if (playWork(player, "fogo", { ms: cookingAnimation.ms })) {
        return true;
    }
    const row = pickCookingAnimation();
    if (row === null) {
        return false;
    }
    try {
        const prop = row.rightHand === "" ? undefined : Animations.props().find((entry) => entry.hand === row.rightHand);
        return player.playAnimation(row.fragment, {
            tags: row.tags,
            loop: true,
            lockMovement: true,
            ...(prop === undefined ? {} : { props: { item: prop.name, hand: "right" as const } }),
        });
    } catch (error: unknown) {
        console.log(`cooking: a animação de cozinhar não tocou: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export function stopCooking(player: Player): void {
    stopWork(player);
}
