import { ambushes, ambushSettings } from "../ambush.js";
import type { Command, CommandContext } from "../command.js";
import { findPlayer } from "../players.js";

export const emboscadaCommand: Command = {
    name: "emboscada",
    summary: "Salteadores nas estradas: como vão, ligar e desligar, e mandar uma gangue para testar.",
    usage: [
        "/emboscada  -- se estão ligados, quantas gangues estão nas estradas e o chão onde os jogadores andam",
        "/emboscada <liga|desliga>",
        "/emboscada agora [jogador]  -- manda uma gangue atrás do jogador (ou de você) agora, para testar",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, who] = args;
        if (sub === undefined) {
            const status = ambushes.status();
            const seen = status.surfaces.slice(0, 6).map(([surface, times]) => `${surface} ${times}`).join(", ");
            reply.lines([
                `Salteadores ${status.enabled ? "ligados" : "desligados"}: ${status.active} gangue(s) nas estradas agora, ${status.started} desde o início.`,
                `A cada ${ambushSettings.checkMs / 1000} s, ${Math.round(ambushSettings.chanceOnRoad * 100)}% de chance para quem viaja numa estrada e ${Math.round(ambushSettings.chanceOffRoad * 100)}% fora dela, fora dos povoados; a mesma pessoa no máximo a cada ${ambushSettings.playerCooldownMs / 60_000} min.`,
                seen === "" ? "Ainda não li o chão sob ninguém." : `Chão lido sob os jogadores: ${seen}.`,
            ]);
            return;
        }
        if (sub === "liga" || sub === "desliga") {
            ambushes.setEnabled(sub === "liga");
            reply.line(sub === "liga" ? "Salteadores ligados." : "Salteadores desligados; as gangues que estavam nas estradas vão embora.");
            return;
        }
        if (sub === "agora") {
            let target = player;
            if (who !== undefined) {
                const found = findPlayer(who);
                if ("error" in found) {
                    reply.line(found.error);
                    return;
                }
                target = found.player;
            }
            if (!target.ready || !target.alive) {
                reply.line(`${target.nickname} não está de pé no mundo.`);
                return;
            }
            reply.line(ambushes.start(target) ? `Uma gangue de salteadores vai atrás de ${target.nickname}.` : "Não achei chão para os salteadores perto dessa pessoa. Tente noutro lugar.");
            return;
        }
        usage();
    },
};
