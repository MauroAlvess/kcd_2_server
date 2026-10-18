import type { Command, CommandContext } from "../command.js";
import { treasure } from "../treasure.js";

export const tesourosCommand: Command = {
    name: "tesouros",
    summary: "(admin) Os baús do mundo e o que guardam: como estão, abastecer, ligar e desligar, a parte dos baús que tem algo.",
    usage: ["/tesouros  -- quantos baús, de que nível, e se está ligado", "/tesouros abastecer  -- enche agora os baús vazios", "/tesouros ligar|desligar", "/tesouros chance <0-100>  -- de cada 100 baús do mundo, quantos têm algo (vale a partir de já)"],

    run({ args, reply, usage }: CommandContext): void {
        if (treasure === null) {
            reply.line("Os tesouros ainda não foram montados; tente de novo em alguns segundos.");
            return;
        }
        const [sub, value] = args;
        if (sub === undefined) {
            const status = treasure.status();
            reply.lines([
                `Tesouros ${status.enabled ? "ligados" : "desligados"}: ${status.chests} baú(s) do mundo com algo (${Math.round(status.share * 100)}% dos que podem ter): nível 1 (perto de gente) ${status.byTier[1]}, nível 2 ${status.byTier[2]}, nível 3 (longe ou trancado) ${status.byTier[3]}.`,
                `${status.filled} abastecimento(s) desde que o servidor subiu; um baú vazio é abastecido de novo depois de uma hora, sem ninguém perto.${status.refused.length > 0 ? ` O jogo não conhece: ${status.refused.join(", ")}.` : ""}`,
            ]);
            return;
        }
        if (sub === "abastecer") {
            reply.line(`${treasure.run(true)} baú(s) abastecido(s).`);
            return;
        }
        if (sub === "ligar" || sub === "desligar") {
            treasure.setEnabled(sub === "ligar");
            reply.line(`Tesouros ${sub === "ligar" ? "ligados" : "desligados"}: os baús ${sub === "ligar" ? "voltam a ser abastecidos" : "ficam como estão, sem abastecimento novo"}.`);
            return;
        }
        if (sub === "chance") {
            const percent = Number(value);
            if (value === undefined || !Number.isFinite(percent) || percent < 0 || percent > 100) {
                usage();
                return;
            }
            treasure.setShare(percent / 100);
            reply.line(`De cada 100 baús do mundo, ${Math.round(percent)} terão algo. /tesouros abastecer enche os novos agora.`);
            return;
        }
        usage();
    },
};
