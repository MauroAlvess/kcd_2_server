import type { Command, CommandContext } from "../command.js";
import { professionXp, RATE_MAX, RATE_MIN } from "../profession-xp.js";
import { chooseRate } from "../profession-xp-settings.js";

/**
 * `/xpoficios`: how many times the tables' XP the trades give (`profession-xp.ts`): the forge, the sewing, the fire, the smokehouse, the alchemy table, the gardens, the milking,
 * the felling and the quarrying. An administrator's knob for the pace at which the guilds level up.
 */
export const xpOficiosCommand: Command = {
    name: "xpoficios",
    summary: "(admin) Quantas vezes o XP das tabelas os ofícios dão: o ritmo com que as guildas sobem de nível.",
    usage: [
        "/xpoficios  -- o ritmo de agora",
        `/xpoficios <${RATE_MIN} a ${RATE_MAX}>  -- muda o ritmo para todos (1 é o das tabelas; o padrão é 4); vale na próxima obra de cada um`,
    ],

    run({ args, reply, usage }: CommandContext): void {
        const [word] = args;
        if (word === undefined) {
            reply.line(`O XP dos ofícios vale ${professionXp.rate} vez(es) o das tabelas (uma cebola colhida, por exemplo, dava 6 e dá ${Math.max(1, Math.round(6 * professionXp.rate))}).`);
            return;
        }
        const rate = Number(word.replace(",", "."));
        if (!chooseRate(rate)) {
            usage();
            return;
        }
        reply.line(`Pronto: o XP dos ofícios vale ${professionXp.rate} vez(es) o das tabelas, para todos.`);
    },
};
