import type { Command, CommandContext } from "../command.js";
import { agreeAndTell, hasAgreed, showTo } from "../welcome.js";

/**
 * `/aceitar`: the way to agree to the rules and the lore when the welcome form (`ui/welcome.html`) cannot come up on a player's machine (2026-10-24).
 * It does what the form's button does.
 */
export const aceitarCommand: Command = {
    name: "aceitar",
    summary: "Concorda com as regras e com a lore do servidor (o mesmo que o botão da janela de boas-vindas).",
    usage: ["/aceitar  -- diz que você leu as regras e está ciente da lore do servidor"],

    run({ player, reply }: CommandContext): void {
        if (hasAgreed(player)) {
            reply.line("Você já concordou com as regras e com a lore do servidor.");
            return;
        }
        agreeAndTell(player);
    },
};

/** `/boasvindas`: the administrator's look at the welcome form, whether or not they have agreed. */
export const boasVindasCommand: Command = {
    name: "boasvindas",
    summary: "(admin) Mostra para você a janela de boas-vindas, para ver como ela ficou.",
    usage: ["/boasvindas  -- abre a janela de boas-vindas para você (o botão dela só guarda a concordância de quem ainda não concordou)"],

    run({ player, reply }: CommandContext): void {
        showTo(player);
        reply.line("A janela de boas-vindas vai abrir; o botão Concordo a fecha.");
    },
};
