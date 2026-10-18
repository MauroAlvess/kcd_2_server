import type { Command, CommandContext } from "../command.js";
import { say, tidyText, TEXT_MAX } from "../roleplay.js";
import type { RoleplayKind } from "../roleplay.js";

/** One roleplay command: the same checks, and a different line. */
function roleplay(kind: RoleplayKind, summary: string, example: string): Command {
    return {
        name: kind,
        summary,
        usage: [`/${kind} <texto>  -- ${example}`],

        run({ player, args, reply, usage }: CommandContext): void {
            const text = tidyText(args);
            if (text === "") {
                usage();
                return;
            }
            if (text.length > TEXT_MAX) {
                reply.line(`Muito longo: no máximo ${TEXT_MAX} letras (você escreveu ${text.length}).`);
                return;
            }
            if (!player.ready) {
                reply.line("Seu personagem ainda não entrou no mundo; tente de novo em um instante.");
                return;
            }
            say(player, kind, text);
        },
    };
}

export const meCommand = roleplay("me", "Descreve uma ação do seu personagem, para quem está por perto.", "/me saca a espada devagar");
export const doCommand = roleplay("do", "Descreve a cena ou um detalhe dela, para quem está por perto.", "/do A porta da estalagem está entreaberta");
export const tryCommand = roleplay("try", "Tenta uma ação: ela dá certo ou falha, ao acaso (50%), e quem está por perto vê.", "/try arrombar a porta");
