import { labelFor } from "../acquaintances.js";
import type { Command, CommandContext } from "../command.js";
import { coinsText, dicePots } from "../dice-pot.js";
import { diceLobby } from "../dice.js";
import { findPlayer } from "../players.js";

export const diceCommand: Command = {
    name: "dice",
    summary: "Invites a nearby opponent to choose a dice score, or leaves the table lobby.",
    usage: ["/dice <player> [target score]", "/dice accept", "/dice decline", "/dice cancel"],

    async run({ player, args, reply, usage }: CommandContext): Promise<void> {
        const word = args[0]?.toLowerCase();
        if (!word) {
            usage();
            return;
        }
        if (["accept", "decline", "cancel"].includes(word)) {
            if (args.length !== 1) {
                usage();
                return;
            }
            if (word === "accept") diceLobby.accept(player);
            else diceLobby.cancelFor(player);
            return;
        }
        if (args.length > 2) {
            usage();
            return;
        }
        const found = findPlayer(args[0]!);
        if ("error" in found) {
            reply.line(found.error);
            return;
        }
        await diceLobby.invite(player, found.player, args[1] === undefined ? 2000 : Number(args[1]));
    },
};

/** Why a game ended without a winner, as the players read it. */
const ENDED: Readonly<Record<string, string>> = {
    gaveUp: "alguém saiu da mesa",
    left: "alguém saiu do servidor",
    timedOut: "a vez ficou parada tempo demais",
    failed: "o jogo falhou",
    stopped: "o jogo foi interrompido",
};

export function installDiceHandlers(): void {
    diceLobby.install();
    dicePots.load();
    // What happened at the table, for the log: the first turn and the first throw of each match say how far it got.
    Events.on("diceTurnStart", (event) => {
        if (event.turn === 1) console.log(`dice: partida ${event.match}: a primeira vez é do assento ${event.seat}`);
    });
    Events.on("diceRoll", (event) => {
        if (dicePots.rolled(event.match) === 1) console.log(`dice: partida ${event.match}: primeiro lance, do assento ${event.seat} (${event.faces.join(" ")})`);
    });
    Events.on("playerInventoryReady", (player) => {
        dicePots.deliver(player);
    });
    Events.on("diceMatchEnd", (match, first, second, winner, reason, firstScore, secondScore) => {
        console.log(`diceMatchEnd: match ${match} ${reason}, seat ${winner} won, ${firstScore} : ${secondScore}, ${dicePots.rollsOf(match)} lance(s)`);
        const settled = dicePots.settle(match, first, second, winner, firstScore, secondScore);
        const played = settled?.played ?? firstScore + secondScore > 0;
        const players = [first, second];
        const winning = (winner === 0 || winner === 1 ? players[winner] : null) ?? null;
        players.forEach((player, index) => {
            if (!player) return;
            const score = `${firstScore} a ${secondScore}`;
            const line = !played ? `O jogo de dados acabou antes do primeiro lance (${ENDED[reason] ?? reason}).` : winning === null ? `O jogo de dados acabou sem vencedor (${ENDED[reason] ?? reason}).` : winning.id === player.id ? `Você venceu o jogo de dados, ${score}.` : `${labelFor(player, winning)} venceu o jogo de dados, ${score}.`;
            Chat.sendToPlayer(player, line);
            if (settled === null) return;
            if (settled.outcome === "won") Chat.sendToPlayer(player, settled.winner === index ? `Você levou a aposta: ${coinsText(settled.pot)}.` : `Você perdeu a aposta (${coinsText(settled.stake)}).`);
            if (settled.outcome === "refunded") Chat.sendToPlayer(player, played ? "Sem vencedor: a sua aposta voltou para você." : "Ninguém chegou a jogar: a sua aposta voltou para você.");
            if ((settled.itemsBack[index] ?? 0) > 0) Chat.sendToPlayer(player, "Seus dados voltaram para o inventário.");
        });
    });
}
