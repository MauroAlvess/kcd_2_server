import { join } from "../args.js";
import type { Command, CommandContext } from "../command.js";
import { DOG_NAME_MAX, DOG_ORDERS, supporters } from "../supporters.js";

export const cachorroCommand: Command = {
    name: "cachorro",
    summary: "O cão de quem apoia o servidor: chama, dá nome e dá ordens.",
    usage: [
        "/cachorro  -- chama o seu cão (se ele sumiu, vem de novo)",
        `/cachorro nome <nome>  -- dá um nome ao cão (até ${DOG_NAME_MAX} letras); sem nome, ele volta ao nome de antes`,
        `/cachorro <${Object.keys(DOG_ORDERS).join("|")}>  -- manda o cão seguir você ou esperar onde está`,
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub] = args;
        if (sub === undefined) {
            reply.line(supporters.call(player).message);
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
