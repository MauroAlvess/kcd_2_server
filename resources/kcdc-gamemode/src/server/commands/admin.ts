import { demote, promote } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { sendSocial } from "../status.js";

export const adminCommand: Command = {
    name: "admin",
    summary: "Vira administrador com um ticket, depois de entrar pelo menu do jogo.",
    usage: ["/admin <ticket>  -- o ticket de admin, inteiro, no formato nome.segredo", "/admin sair  -- volta a ser jogador comum até sair do servidor (o ticket devolve o admin)"],

    async run({ player, args, reply, usage }: CommandContext): Promise<void> {
        if (args.length !== 1) {
            usage();
            return;
        }
        const result = args[0]?.toLowerCase() === "sair" ? demote(player) : await promote(player, args[0] ?? "");
        reply.line(result.message);
        // The panel learns the new role at once: F3 opens the administrator's sections without F2 first (or closes them).
        if (result.ok) {
            sendSocial(player);
        }
    },
};
