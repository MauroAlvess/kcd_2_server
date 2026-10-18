import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { describeFatigue } from "../fatigue.js";
import { retarget } from "../players.js";

export const cansacoCommand: Command = {
    name: "cansaco",
    summary: "Mostra a sua energia e se o jogo vê você descansando (deitado ou sentado); o admin vê a de outro jogador.",
    usage: ["/cansaco  -- a sua energia, e a postura que o jogo vê", "/cansaco @jogador  -- (admin) a de outro jogador"],

    run({ player, args, reply }: CommandContext): void {
        if (args.length > 0 && isAdmin(player)) {
            const retargeted = retarget(args, player);
            if ("error" in retargeted) {
                reply.line(retargeted.error);
                return;
            }
            reply.line(`${retargeted.target.nickname}: ${describeFatigue(retargeted.target)}`);
            return;
        }
        reply.line(describeFatigue(player));
    },
};
