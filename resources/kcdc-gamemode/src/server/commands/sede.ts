import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { chooseEnabled, feeling, thirstPace } from "../thirst.js";

/**
 * `/sede`: how thirsty the player is (the server's own thirst, `thirst.ts`: the game has none), and how to quench it. An
 * administrator turns it on and off for everybody, and may put their own at a value to see what it does at each step.
 */
export const sedeCommand: Command = {
    name: "sede",
    summary: "Mostra como está a sua sede; o admin liga e desliga a sede do servidor.",
    usage: ["/sede  -- como está a sua sede e como matá-la", "/sede <ligar|desligar>  -- (admin) liga ou desliga a sede de todos", "/sede definir <0 a 100>  -- (admin) põe a sua própria sede nesse valor, para ver o que ela faz em cada passo"],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, word] = args;

        if (sub === undefined) {
            const value = Math.round(thirstPace.value(player));
            reply.lines([`Você está ${feeling(value)} (${value}%).`, thirstPace.describe(), "Mate a sede com água (a do Boticário ou a dos poços), leite, cerveja ou vinho; ou ajoelhe-se à beira de um rio, de uma lagoa ou de um riacho, mire na água e aperte F."]);
            return;
        }

        if (sub === "ligar" || sub === "desligar") {
            if (!isAdmin(player)) {
                reply.line("Só administradores ligam e desligam a sede.");
                return;
            }
            chooseEnabled(sub === "ligar");
            reply.line(thirstPace.describe());
            return;
        }

        if (sub === "definir") {
            if (!isAdmin(player)) {
                reply.line("Só administradores põem a sede num valor.");
                return;
            }
            const wanted = Number(word);
            if (word === undefined || !Number.isFinite(wanted) || wanted < 0 || wanted > 100) {
                usage();
                return;
            }
            const value = thirstPace.set(player, wanted);
            reply.line(`A sua sede está em ${Math.round(value)}%; os efeitos acompanham no próximo olhar (até 15 s).`);
            return;
        }

        usage();
    },
};
