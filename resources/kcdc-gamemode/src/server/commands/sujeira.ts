import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { describeDirt } from "../dirt.js";
import { retarget } from "../players.js";

export const sujeiraCommand: Command = {
    name: "sujeira",
    summary: "Mostra o quanto o seu corpo está sujo (o jogo suja a roupa e a pele com o movimento) e onde se lavar; o admin vê a de outro jogador.",
    usage: ["/sujeira  -- a sua sujeira, o cheiro e o sangue, como o jogo os lê", "/sujeira @jogador  -- (admin) a de outro jogador"],

    run({ player, args, reply }: CommandContext): void {
        if (args.length > 0 && isAdmin(player)) {
            const retargeted = retarget(args, player);
            if ("error" in retargeted) {
                reply.line(retargeted.error);
                return;
            }
            reply.line(`${retargeted.target.nickname}: ${describeDirt(retargeted.target)}`);
            return;
        }
        reply.line(describeDirt(player));
    },
};
