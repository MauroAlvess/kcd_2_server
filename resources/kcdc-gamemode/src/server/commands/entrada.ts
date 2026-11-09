import type { Command, CommandContext } from "../command.js";
import { approve, entryStats, hasPassed, isPending, reset } from "../entry.js";
import { findPlayer } from "../players.js";

const STEAM_ID = /^\d{5,20}$/;

/** `/entrada`: the door of the server (`entry.ts`): who has passed the questions, and a way to approve or send somebody back. */
export const entradaCommand: Command = {
    name: "entrada",
    summary: "(admin) A porta do servidor: quem já passou nas perguntas de entrada; aprova um jogador ou o manda refazer.",
    usage: [
        "/entrada  -- quantos já passaram e quem está na porta agora",
        "/entrada aprovar <jogador ou Steam id>  -- aprova sem as perguntas",
        "/entrada zerar <jogador ou Steam id>  -- tira a aprovação: ele vê as perguntas de novo",
    ],

    run({ args, reply, usage }: CommandContext): void {
        const [verb, who] = args;
        if (verb === undefined) {
            const stats = entryStats();
            const waiting = Player.all().filter((player) => isPending(player));
            reply.line(`${stats.passed} jogador(es) aprovado(s) de ${stats.known} conhecido(s).`);
            reply.line(waiting.length === 0 ? "Ninguém está na porta agora." : `Na porta agora (${waiting.length}): ${waiting.slice(0, 40).map((player) => player.nickname).join(", ")}${waiting.length > 40 ? `, e mais ${waiting.length - 40}` : ""}.`);
            return;
        }
        if ((verb !== "aprovar" && verb !== "zerar") || who === undefined) {
            usage();
            return;
        }
        let steamId = "";
        let name = who;
        if (STEAM_ID.test(who)) {
            steamId = who;
        } else {
            const found = findPlayer(who);
            if ("error" in found) {
                reply.line(found.error);
                return;
            }
            steamId = found.player.steamId;
            name = found.player.nickname;
            if (steamId === "") {
                reply.line(`${name} entrou sem identificação Steam: não há onde guardar a aprovação.`);
                return;
            }
        }
        if (verb === "aprovar") {
            if (!approve(steamId, name)) {
                reply.line("Não consegui guardar a aprovação agora.");
                return;
            }
            reply.line(`${name} está aprovado.`);
            const live = Player.all().find((player) => player.steamId === steamId);
            if (live !== undefined && hasPassed(live)) {
                reply.line("Se ele estava na porta, ela abre quando a página dele disser que acabou.");
            }
            return;
        }
        reply.line(reset(steamId) ? `${name} vai passar pela porta de novo no próximo ponto de entrada.` : `${name} não tinha aprovação guardada.`);
    },
};
