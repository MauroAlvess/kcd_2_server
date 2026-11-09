import { join } from "../args.js";
import type { Command, CommandContext } from "../command.js";
import { DOG_NAME_MAX, DOG_ORDERS, supporters } from "../supporters.js";

export const cachorroCommand: Command = {
    name: "cachorro",
    summary: "O cão de quem apoia o servidor: chama, dá nome e dá ordens.",
    usage: [
        "/cachorro  -- chama o seu cão (se ele sumiu ou foi mandado embora, vem de novo)",
        "/cachorro embora  -- manda o cão embora: ele some do mundo, e não volta nem quando você entra, até você chamá-lo",
        `/cachorro nome <nome>  -- dá um nome ao cão (até ${DOG_NAME_MAX} letras); sem nome, ele volta ao nome de antes`,
        `/cachorro <${Object.keys(DOG_ORDERS).join("|")}>  -- manda o cão seguir você, esperar (sentar) onde está, ou andar solto`,
        "E diante do cão  -- abre o menu: Fazer carinho, Mandar ficar (ou Mandar seguir) e Sair",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub] = args;
        if (sub === undefined) {
            reply.line(supporters.call(player).message);
            return;
        }
        if (sub === "embora") {
            reply.line(supporters.sendAway(player).message);
            return;
        }
        if (sub === "nome") {
            reply.line(supporters.rename(player, join(args, 1)).message);
            return;
        }
        if (Object.keys(DOG_ORDERS).includes(sub)) {
            reply.line(supporters.order(player, sub).message);
            return;
        }
        usage();
    },
};
