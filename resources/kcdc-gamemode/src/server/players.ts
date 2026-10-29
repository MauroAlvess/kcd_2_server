/** Finding the player a chat line names. */

/** One player, or the reason there is not exactly one. */
export type Lookup = { player: Player } | { error: string };

/**
 * The player a query names: exact name, then unique prefix, then the player's number (the "Nº" the Jogadores page shows: the
 * network id, such as 4438), then connection slot -- so a player named for a number still wins over the one with that number.
 * A number is the sure way to name somebody whose name has spaces or is shared by another (user, 2026-10-20: "o comando de
 * carroça registrar deve usar o número do jogador, exemplo 4438").
 */
export function findPlayer(query: string): Lookup {
    if (query.trim() === "") {
        return { error: "Say which player: a name, or the player's number from the Jogadores page." };
    }
    const players = Player.all();
    const folded = query.toLowerCase();

    const exact = players.find((player) => player.nickname.toLowerCase() === folded);
    if (exact) {
        return { player: exact };
    }

    const prefixed = players.filter((player) => player.nickname.toLowerCase().startsWith(folded));
    if (prefixed.length === 1) {
        return { player: prefixed[0] as Player };
    }
    if (prefixed.length > 1) {
        return { error: `'${query}' matches more than one player; type more of the name.` };
    }

    const slot = Number(query);
    const byId = Number.isInteger(slot) && query.trim() !== "" ? players.find((player) => player.id === slot) : undefined;
    if (byId) {
        return { player: byId };
    }
    const bySlot = Number.isInteger(slot) ? players.find((player) => player.playerIndex === slot) : undefined;
    if (bySlot) {
        return { player: bySlot };
    }

    return { error: `No player called '${query}'. A name, or the player's number from the Jogadores page, will do.` };
}

/**
 * The player a trailing `@name` aims at, and the rest of the line without
 * it. Aiming at somebody else is how you see the request reach the right
 * owner rather than whoever typed it.
 */
export function retarget(args: readonly string[], caller: Player): { target: Player; rest: readonly string[] } | { error: string } {
    const at = args.findIndex((argument) => argument.startsWith("@"));
    if (at === -1) {
        return { target: caller, rest: args };
    }

    const found = findPlayer(args[at]!.slice(1));
    if ("error" in found) {
        return found;
    }
    return { target: found.player, rest: [...args.slice(0, at), ...args.slice(at + 1)] };
}
