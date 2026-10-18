import type { Command, CommandContext } from "../command.js";
import { BAG_REACH_M, openBags } from "../horse-bags.js";
import { horsesOf } from "../horses.js";

export const alforjeCommand: Command = {
    name: "alforje",
    summary: "Abre as alforjes do seu cavalo, para guardar e pegar coisas, estando perto dele.",
    usage: [`/alforje  -- abre as alforjes do seu cavalo mais próximo (a até ${BAG_REACH_M} m)`, "/alforje <nome do cavalo>  -- as alforjes do cavalo com esse nome"],

    run({ player, args, reply }: CommandContext): void {
        const wanted = args.join(" ").trim().toLowerCase();
        const key = wanted === "" ? null : (horsesOf(player.steamId).find((owned) => (owned.horse?.name || owned.record.name).toLowerCase() === wanted)?.record.key ?? "");
        if (key === "") {
            reply.line(`Você não tem um cavalo chamado '${args.join(" ")}'.`);
            return;
        }
        reply.line(openBags(player, key).message);
    },
};
