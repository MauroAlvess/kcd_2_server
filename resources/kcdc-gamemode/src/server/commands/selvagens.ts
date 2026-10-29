import type { Command, CommandContext } from "../command.js";
import { nearestWild, resetWild, setTrustNearest, trustBar, trustLabel, wildSummary } from "../wild-horses.js";

/**
 * `/selvagens`: the wild horses of the open fields (`wild-horses.ts`), for an administrator who wants to find one, to try the taming without
 * hours of carrots (`confianca`), or to have the herds put back at their meadows (`repor`).
 */
export const selvagensCommand: Command = {
    name: "selvagens",
    summary: "(admin) Os cavalos selvagens dos campos abertos: onde estão, quanto confiam em você, e como testar a doma.",
    usage: [
        "/selvagens  -- quantos cavalos selvagens há e como eles se comportam",
        "/selvagens perto  -- os cinco mais perto de você, com a distância e a confiança deles em você",
        "/selvagens ir  -- leva você ao cavalo selvagem mais perto (a até 5 m dele)",
        "/selvagens confianca <0-100>  -- a confiança do cavalo mais perto em você, para testar (100: ele já aceita ser montado)",
        "/selvagens repor  -- tira todos e põe de volta nos seus campos",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, value] = args;
        if (sub === undefined) {
            reply.lines(wildSummary(player));
            return;
        }
        if (sub === "perto") {
            const rows = nearestWild(player, 5);
            reply.lines(rows.length === 0 ? ["Nenhum cavalo selvagem no mundo agora."] : rows.map((row) => `${row.id}: ${row.breed}, a ${Math.round(row.distance)} m; ${trustBar(row.trust)} ${Math.round(row.trust)}/100 (${trustLabel(row.trust)})`));
            return;
        }
        if (sub === "ir") {
            const near = nearestWild(player, 1)[0];
            if (near === undefined) {
                reply.line("Nenhum cavalo selvagem no mundo agora.");
                return;
            }
            const at = near.horse.position;
            const sent = player.teleport({ x: at.x + 4, y: at.y, z: at.z + 1 }, near.id);
            reply.line(sent ? `Indo para o cavalo de ${near.id}.` : "Não consegui pedir o teletransporte agora.");
            return;
        }
        if (sub === "confianca" || sub === "confiança") {
            const trust = Number(value);
            if (value === undefined || !Number.isFinite(trust)) {
                usage();
                return;
            }
            const place = setTrustNearest(player, trust);
            reply.line(place === "" ? "Nenhum cavalo selvagem no mundo agora." : `O cavalo de ${place} agora confia em você ${Math.max(0, Math.min(100, Math.round(trust)))}/100.`);
            return;
        }
        if (sub === "repor") {
            reply.line(`${resetWild()} cavalo(s) selvagem(ns) tirados; os campos voltam a ter os seus.`);
            return;
        }
        usage();
    },
};
