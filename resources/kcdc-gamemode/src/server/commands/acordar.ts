import type { Command, CommandContext } from "../command.js";
import { faintWatch, type Faintable, WAKE_ASKED_MS, WAKE_DRUNK_MS } from "../faint.js";

export const acordarCommand: Command = {
    name: "acordar",
    summary: "Acordar: tira você do desmaio da bebedeira, se a tela ficou preta.",
    usage: [`/acordar  -- se você desmaiou de bêbado e a tela não volta: acorda você, depois de ${WAKE_ASKED_MS / 1000} s caído (sozinho, o servidor acorda em ${WAKE_DRUNK_MS / 1000} s)`],

    run({ player, reply }: CommandContext): void {
        reply.line(faintWatch.ask(player as unknown as Faintable, Date.now()).message);
    },
};
