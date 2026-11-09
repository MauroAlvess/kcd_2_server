import type { Command, CommandContext } from "../command.js";
import { describeWear, MAX_SHARE, MIN_SHARE, setWearShare } from "../wear-ease.js";

/**
 * `/desgaste`: how fast the things players carry wear out (2026-10-31, user: "a durabilidade dos itens está quebrando muito rápido ... deixar no médio"). The server gives back
 * part of the condition the game takes off a weapon or an armour (`wear-ease.ts`); an administrator reads the share and changes it. Admin only: it is not among the commands of a player.
 */
export const desgasteCommand: Command = {
    name: "desgaste",
    summary: "(admin) Mostra e muda o quanto do desgaste do jogo os itens sofrem (armas, armaduras e as ferramentas dos coletores).",
    usage: [
        "/desgaste  -- quanto do desgaste do jogo os itens sofrem agora",
        `/desgaste <${Math.round(MIN_SHARE * 100)} a ${Math.round(MAX_SHARE * 100)}>  -- põe esse tanto por cento do desgaste do jogo (100 é o do jogo; 55 é o padrão; vale já e fica guardado)`,
    ],

    run({ args, reply, usage }: CommandContext): void {
        const [word] = args;
        if (word === undefined) {
            reply.line(describeWear());
            return;
        }
        const wanted = Number(word.replace(",", ".").replace("%", ""));
        if (!Number.isFinite(wanted) || wanted < MIN_SHARE * 100 || wanted > MAX_SHARE * 100) {
            usage();
            return;
        }
        setWearShare(wanted / 100);
        reply.line(describeWear());
    },
};
