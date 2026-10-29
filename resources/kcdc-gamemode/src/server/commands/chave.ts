import type { Command, CommandContext } from "../command.js";
import { useKeyAt } from "../properties.js";

export const chaveCommand: Command = {
    name: "chave",
    summary: "Tranca ou destranca a porta, ou o baú, à sua frente, se você tiver a chave dele ou o acesso.",
    usage: ["/chave"],

    async run({ player, args, reply, usage }: CommandContext): Promise<void> {
        if (args.length > 0) {
            usage();
            return;
        }
        const result = await useKeyAt(player);
        reply.line(result.message);
    },
};
