import type { Command, CommandContext } from "../command.js";
import { endQuietFights, PAZ_QUIET_MS, releaseNearby } from "../combat.js";

/**
 * `/paz`: ends the duels of whoever types it, once the blows have stopped for a few seconds (user, 2026-10-19: after a duel
 * Radovan could open neither the map nor the inventory, "mesmo encerrando o duelo"). A duel also ends by itself 45 s after the
 * last blow, and 5 s after one of the two held U to offer peace with no blow since.
 */
export const pazCommand: Command = {
    name: "paz",
    summary: "Encerra o duelo em que você está, depois de alguns segundos sem golpes: o mapa e o inventário voltam.",
    usage: ["/paz  -- encerra os seus duelos parados (sem golpes há 5 segundos)"],

    run({ player, reply }: CommandContext): void {
        const { ended, busy } = endQuietFights(player);
        if (ended.length > 0) {
            reply.line(`Duelo encerrado com ${ended.join(", ")}.`);
        }
        if (busy.length > 0) {
            reply.line(`Com ${busy.join(", ")} ainda há golpes: espere ${Math.round(PAZ_QUIET_MS / 1000)} segundos sem golpes e use /paz de novo.`);
        }
        if (ended.length === 0 && busy.length === 0) {
            // The server has no fight left, yet the game may still hold the last opponent in its lock-on.
            const near = releaseNearby(player);
            reply.line(near > 0
                ? `Você não está em nenhum duelo. Por alguns segundos ninguém por perto fica na sua mira: guarde a arma (tecla B) e abra o inventário.`
                : "Você não está em nenhum duelo e não há ninguém por perto.");
            reply.line("Se o mapa ou o inventário continuarem travados, diga a hora para a administração ver o registro.");
        }
    },
};
