/**
 * Whether a spawning player needs the character creator, or already has a
 * look saved from a previous visit. A brand new player and one who has
 * played before but never finished the creator look the same here -- both
 * have no entry in `characters.ts` -- so both are asked the same way.
 */

import { getCharacter } from "./characters.js";
import { openCreatorFor } from "./commands/creator.js";

export function installFirstJoin(): void {
    Events.on("playerSpawned", (player) => {
        const saved = getCharacter(player.steamId);
        if (saved) {
            player.setAppearance(saved.appearance);
            return;
        }

        Chat.sendToPlayer(player, "Let's set up your character. Type /creator any time to change it later.");
        openCreatorFor(player, "both");
    });
}
