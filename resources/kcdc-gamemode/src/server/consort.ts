/**
 * The spouse of a player as the realm names them at their side (user, 2026-10-25: "um lorde manda em uma terra; se ele tiver uma esposa ela vira lady, então
 * na árvore eles deviam estar juntos ... e na cidadania deve aparecer o nome da lady também"). The hierarchy's tree shows a holder with their spouse in the
 * same box, and a town's page shows the lord of its lands with theirs.
 *
 * Who the spouse is comes from the family trees (`family.ts`: the living "Esposo" or "Esposa" of a player's own tree, linked to a player or only a name,
 * and the players whose trees name them as theirs). What they are called comes from the holder's rank of the blood (`consortStyle`, in `nobility.ts`): the
 * wife of a lord is a Lady, of a marquis a Marquesa, of a prince a Princesa, of a king a Rainha, of a knight, a squire or a small noble a Dama; anybody
 * else's spouse, and a husband, only "Esposa" or "Esposo". A spouse marked dead is not a consort, and neither is the partner of a union.
 *
 * Only the character's name is told, never the player's: the hierarchy shows what a character is known by.
 */

import { getCharacter } from "./characters.js";
import { spousesOf } from "./family.js";
import { nameOfMember } from "./guild-members.js";
import { bloodTitleOf, consortStyle } from "./nobility.js";
import { titlesOf } from "./titles.js";

export interface Consort {
    /** The courtesy style ("Lady", "Marquesa", "Dama"...) or the plain word ("Esposa", "Esposo", "Consorte"). */
    readonly label: string;
    /** The character's name. */
    readonly name: string;
    /** Whether `label` is a courtesy style (and not the plain word for a spouse). */
    readonly courtesy: boolean;
    /** How it is written beside the holder: "Lady Elisabeth", or "Kath (esposa)" for a spouse with no style. */
    readonly text: string;
    /** The spouse's Steam id when they are a player (the tree draws one who holds a title as that holder, once), null for a name only. Never sent to a page. */
    readonly steamId: string | null;
}

const PLAIN = new Set(["Esposa", "Esposo", "Consorte"]);

const genderOf = (steamId: string): "male" | "female" | null => {
    const gender = getCharacter(steamId)?.appearance.gender;
    return gender === "female" || gender === "male" ? gender : null;
};

/** The living spouses of a player, as the realm calls them at their side; none when they have none. */
export function consortsOf(steamId: string): Consort[] {
    if (steamId === "") {
        return [];
    }
    const rank = bloodTitleOf(titlesOf(steamId));
    const holderFemale = genderOf(steamId) === "female";
    return spousesOf(steamId).map((spouse) => {
        const gender = spouse.steamId === null ? null : genderOf(spouse.steamId);
        const female = gender !== null ? gender === "female" : spouse.relation === "esposa" ? true : spouse.relation === "esposo" ? false : null;
        const name = spouse.steamId === null ? spouse.name : nameOfMember(spouse.steamId);
        const label = consortStyle(rank, holderFemale, female);
        const courtesy = !PLAIN.has(label);
        return { label, name, courtesy, text: courtesy ? `${label} ${name}` : `${name} (${label.toLowerCase()})`, steamId: spouse.steamId };
    });
}
