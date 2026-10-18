import type { Command, CommandContext } from "../command.js";
import { cook } from "../cooking.js";

export const cozinharCommand: Command = {
    name: "cozinhar",
    summary: "Junto de um fogo, de um secador ou de um defumador, cozinha, seca ou defuma a comida que você leva (o jogo faz isso só na máquina do jogador, o servidor não ouve).",
    usage: ["/cozinhar  -- no fogo, tudo o que é cru vira cozido; no secador, o que pode virar seco; no defumador, o defumado. O \"Usar\" de uma carne ou peixe no inventário faz o mesmo para o monte em que você apertou"],

    run({ player, reply }: CommandContext): void {
        reply.line(cook(player));
    },
};
