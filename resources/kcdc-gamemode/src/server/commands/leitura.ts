import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { FACTOR_MAX, FACTOR_MIN, skillReading } from "../skillbooks.js";

export const leituraCommand: Command = {
    name: "leitura",
    summary: "Mostra o livro de habilidade que você lê, larga o livro, ou o admin ajusta o ritmo da leitura.",
    usage: [
        "/leitura  -- o que você está lendo, quanto falta e o que já começou",
        "/leitura parar  -- larga o livro (o que você leu fica guardado)",
        `/leitura fator <${FACTOR_MIN}-${FACTOR_MAX}>  -- (admin) quanto das horas de cada livro precisa passar no relógio do mundo; 1 é por inteiro`,
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const reading = skillReading();
        if (reading === null) {
            reply.line("A leitura de livros ainda não está pronta; tente de novo em instantes.");
            return;
        }
        const [sub, word] = args;

        if (sub === undefined) {
            reply.lines(reading.describe(player));
            return;
        }

        if (sub === "parar") {
            if (!reading.drop(player)) {
                reply.line("Você não está lendo.");
            }
            return;
        }

        if (sub === "fator") {
            if (!isAdmin(player)) {
                reply.line("Só administradores mudam o ritmo da leitura.");
                return;
            }
            const factor = word === undefined ? Number.NaN : Number(word.replace(",", "."));
            if (!reading.setFactor(factor)) {
                usage();
                return;
            }
            reply.line(reading.pace());
            return;
        }

        usage();
    },
};
