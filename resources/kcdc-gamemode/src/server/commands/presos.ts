import type { Command, CommandContext } from "../command.js";
import { prisoners, releaseByName } from "../arrest.js";

/** `/presos`: who is in handcuffs or in a pillory, and a way to free somebody (`arrest.ts`). Not `/preso`, which is the players' "Fiquei preso". */
export const presosCommand: Command = {
    name: "presos",
    summary: "(admin) Quem está algemado ou no pelourinho, quem prendeu, quanto falta; solta quem você disser.",
    usage: [
        "/presos  -- quem está preso agora, quem prendeu e quanto falta",
        "/presos soltar <nome>  -- solta quem tiver esse nome (ou parte dele), algemado ou no pelourinho",
    ],

    run({ args, reply, usage }: CommandContext): void {
        const verb = args[0]?.toLowerCase();
        if (verb === undefined) {
            const held = prisoners();
            if (held.length === 0) {
                reply.line("Não há ninguém preso.");
                return;
            }
            reply.line(`Presos (${held.length}):`);
            for (const one of held) {
                const where = one.kind === "pillory" ? `no pelourinho${one.place !== "" ? ` de ${one.place}` : ""}` : "algemado";
                reply.line(`  ${one.name}: ${where}${one.by !== "" ? `, por ${one.by}` : ""}, faltam ${one.minutes} min${one.online ? "" : " (fora do servidor)"}`);
            }
            return;
        }
        if (verb === "soltar" && args.length > 1) {
            const query = args.slice(1).join(" ");
            const freed = releaseByName(query);
            reply.line(freed > 0 ? `${freed === 1 ? "1 preso solto" : `${freed} presos soltos`}.` : `Nenhum preso com o nome "${query}".`);
            return;
        }
        usage();
    },
};
