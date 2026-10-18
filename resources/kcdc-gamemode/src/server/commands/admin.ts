import { promote } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { sendSocial } from "../status.js";

export const adminCommand: Command = {
    name: "admin",
    summary: "Vira administrador com um ticket, depois de entrar pelo menu do jogo.",
    usage: ["/admin <ticket>  -- o ticket de admin, inteiro, no formato nome.segredo"],

    async run({ player, args, reply, usage }: CommandContext): Promise<void> {
        if (args.length !== 1) {
            usage();
            return;
        }
        const result = await promote(player, args[0] ?? "");
        reply.line(result.message);
        // The panel learns the new role at once: F3 opens the administrator's sections without F2 first.
        if (result.ok) {
            sendSocial(player);
        }
    },
};
