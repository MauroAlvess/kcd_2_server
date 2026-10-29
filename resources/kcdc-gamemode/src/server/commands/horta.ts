import type { Command, CommandContext } from "../command.js";
import { isAdmin } from "../auth.js";
import { clearAll, farmSummary, FIELD_ROWS, markBed, markField, MARK_LENGTH, nearestGardens, ripenAll, unmarkBed } from "../farm.js";

/**
 * `/horta`: the gardens of the Agricultores (`farm.ts`). Everybody may ask what they have sown and where the nearest gardens are; the
 * rest, to try it, is an administrator's: every sown bed ripened at once, every bed emptied, and a bed marked where the level has none
 * (`aqui`) or taken away again (`tirar`).
 */
export const hortaCommand: Command = {
    name: "horta",
    summary: "As hortas dos agricultores: o que você plantou e quando fica pronto, e as hortas mais perto de você.",
    usage: [
        "/horta  -- o que você plantou e quando fica pronto",
        "/horta perto  -- as cinco hortas mais perto de você, com quantos canteiros livres",
        "/horta crescer  -- (admin) toda plantação fica pronta agora, para testar",
        "/horta limpar  -- (admin) esvazia todos os canteiros",
        "/horta aqui [metros]  -- (admin) marca um canteiro onde você está, com a fileira para onde você olha (3 m; de 1,5 a 8)",
        `/horta campo [fileiras] [metros]  -- (admin) marca um campo: várias fileiras lado a lado, a primeira onde você está e as outras para a sua direita, correndo para onde você olha (${FIELD_ROWS.normal} de ${MARK_LENGTH.max} m; de ${FIELD_ROWS.min} a ${FIELD_ROWS.max} fileiras)`,
        "/horta tirar  -- (admin) tira o canteiro marcado mais perto (até 4 m), com o que nele estiver plantado",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub] = args;
        if (sub === undefined) {
            reply.lines(farmSummary(player));
            return;
        }
        if (sub === "perto") {
            reply.lines(nearestGardens(player));
            return;
        }
        if ((sub === "crescer" || sub === "limpar" || sub === "aqui" || sub === "campo" || sub === "tirar") && !isAdmin(player)) {
            reply.line("Só um administrador faz isso.");
            return;
        }
        if (sub === "crescer") {
            reply.line(`${ripenAll()} plantação(ões) prontas para colher.`);
            return;
        }
        if (sub === "aqui") {
            const said = args[1];
            const length = said === undefined ? MARK_LENGTH.normal : Number(said.replace(",", "."));
            if (!Number.isFinite(length)) {
                usage();
                return;
            }
            const marked = markBed(player, length);
            reply.line(marked.ok ? `Canteiro marcado: ${marked.name}, fileira de ${length} m para onde você olha. Quem é agricultor já o vê.` : marked.why);
            return;
        }
        if (sub === "campo") {
            const rows = args[1] === undefined ? FIELD_ROWS.normal : Number(args[1]);
            const length = args[2] === undefined ? MARK_LENGTH.max : Number(args[2].replace(",", "."));
            if (!Number.isFinite(rows) || !Number.isFinite(length)) {
                usage();
                return;
            }
            const field = markField(player, rows, length);
            reply.line(field.ok ? `Campo marcado: ${field.made} canteiro(s) de ${length} m lado a lado (${field.first}${field.made > 1 ? ` a ${field.last}` : ""}), para a sua direita.${field.skipped > 0 ? ` ${field.skipped} ficou(aram) de fora: já havia canteiro ali.` : ""} Quem é agricultor já os vê. /horta tirar tira um por vez.` : field.why);
            return;
        }
        if (sub === "tirar") {
            const removed = unmarkBed(player);
            reply.line(removed.ok ? `Canteiro tirado: ${removed.name}.${removed.lost === "" ? "" : ` A plantação de ${removed.lost} nele se desfez.`}` : removed.why);
            return;
        }
        if (sub === "limpar") {
            reply.line(`${clearAll()} canteiro(s) esvaziados.`);
            return;
        }
        usage();
    },
};
