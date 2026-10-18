import type { Command, CommandContext } from "../command.js";
import { unstick } from "../stuck.js";

export const presoCommand: Command = {
    name: "preso",
    summary: "Fiquei preso: leva você à igreja mais próxima, uma vez a cada 60 minutos.",
    usage: ["/preso  -- se você ficou preso no cenário ou numa casa trancada: vai para a igreja mais próxima (uma vez por hora)"],

    run({ player, reply }: CommandContext): void {
        reply.line(unstick(player).message);
    },
};
