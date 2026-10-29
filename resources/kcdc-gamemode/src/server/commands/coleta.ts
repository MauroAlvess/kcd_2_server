import type { Command, CommandContext, Reply } from "../command.js";
import { gatherSummary, restAll } from "../gather.js";
import { probeAhead } from "../level-edits.js";
import { findPlayer } from "../players.js";
import { yawOf } from "../position.js";

/** The player a line names, or the caller; null after saying why not. */
function targetOf(player: Player, who: string | undefined, reply: Reply): Player | null {
    if (who === undefined) {
        return player;
    }
    const found = findPlayer(who);
    if ("error" in found) {
        reply.line(found.error);
        return null;
    }
    return found.player;
}

/**
 * `/coleta`: the Coletores' work (`gather.ts`) for an administrator: the rules, what the game calls what a player faces (a tree, a rock),
 * the two tools to try it with, and every tree and rock made to give again.
 */
export const coletaCommand: Command = {
    name: "coleta",
    summary: "(admin) A guilda dos Coletores: as regras do machado e da picareta, o que o jogo diz que está na sua frente, as ferramentas para testar.",
    usage: [
        "/coleta  -- as regras e quantas árvores e pedras estão em trabalho ou descansando",
        "/coleta sondar  -- o que está para onde você olha (árvore, pedra, o modelo), a até 6 m",
        "/coleta kit [jogador]  -- um machado de lenhador e uma picareta, para testar",
        "/coleta descansar  -- toda árvore e pedra volta a dar",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, who] = args;
        if (sub === undefined) {
            reply.lines(gatherSummary());
            return;
        }
        if (sub === "sondar") {
            void probeAhead(player, yawOf(player.rotation), 6).then((lines) => {
                lines.forEach((line) => console.log(`coleta: ${player.nickname} sondou: ${line}`));
                reply.lines(lines);
            });
            return;
        }
        if (sub === "kit") {
            const target = targetOf(player, who, reply);
            if (target === null) {
                return;
            }
            const axe = Inventory.add(target, { item: "axeWork01", amount: 1 }).ok;
            const pick = Inventory.add(target, { item: "axeBattle03", amount: 1, metadata: { quality: 1, condition: 0.5 } }).ok;
            reply.line(`${target.nickname}: ${axe ? "machado de lenhador" : "o machado não entrou"}, ${pick ? "picareta" : "a picareta não entrou"}. Com eles na bolsa, olhe para uma árvore ou uma pedra e aperte E.`);
            return;
        }
        if (sub === "descansar") {
            reply.line(`${restAll()} árvore(s) e pedra(s) voltaram a dar.`);
            return;
        }
        usage();
    },
};
