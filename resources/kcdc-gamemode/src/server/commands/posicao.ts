import type { Command, CommandContext } from "../command.js";
import { forgetPlace, getSavedPlace } from "../position.js";
import { retarget } from "../players.js";

export const placeCommand: Command = {
    name: "posicao",
    summary: "Mostra, ou apaga, o lugar onde um jogador será colocado ao entrar.",
    usage: [
        "/posicao [@jogador]         -- onde ele nasce da próxima vez que entrar",
        "/posicao limpar [@jogador]  -- ele volta a nascer no ponto inicial do mapa; serve para quem ficou preso",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const retargeted = retarget(args, player);
        if ("error" in retargeted) {
            reply.line(retargeted.error);
            return;
        }
        const { target, rest } = retargeted;
        if (rest.length > 1 || (rest.length === 1 && rest[0] !== "limpar")) {
            usage();
            return;
        }

        if (rest[0] === "limpar") {
            const had = forgetPlace(target);
            reply.line(
                had
                    ? `${target.nickname} volta a nascer no ponto inicial. Nada mais é salvo dele até ele entrar de novo.`
                    : `${target.nickname} não tinha lugar salvo. Nada mais é salvo dele até ele entrar de novo.`,
            );
            return;
        }

        const place = getSavedPlace(target.steamId);
        reply.line(
            place
                ? `${target.nickname} nasce em x ${place.x}, y ${place.y}, z ${place.z} (salvo às ${new Date(place.savedAt).toISOString()}).`
                : `${target.nickname} não tem lugar salvo: nasce no ponto inicial do mapa.`,
        );
    },
};
