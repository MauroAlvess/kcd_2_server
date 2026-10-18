import type { Command, CommandContext } from "../command.js";
import { retarget } from "../players.js";
import { getSocialStatus, SOCIAL_STATUS, type SocialStatus, setSocialStatus } from "../status.js";

function isSocialStatus(value: string | undefined): value is SocialStatus {
    return value === "plebeius" || value === "nobilis";
}

export const socialStatusCommand: Command = {
    name: "socialstatus",
    summary: "Reads or sets a player's social status (plebeius or nobilis), shown in the status panel (F2).",
    usage: ["/socialstatus [@player]", "/socialstatus <plebeius|nobilis> [@player]"],

    run(context: CommandContext): void {
        const { player, args, reply, usage } = context;
        const retargeted = retarget(args, player);
        if ("error" in retargeted) {
            reply.line(retargeted.error);
            return;
        }
        const { target, rest } = retargeted;
        const whose = target === player ? "Seu" : `O de ${target.nickname}`;

        if (rest.length === 0) {
            reply.line(`${whose} status socialis: ${SOCIAL_STATUS[getSocialStatus(target.steamId)].label}.`);
            return;
        }

        if (rest.length > 1 || !isSocialStatus(rest[0])) {
            usage();
            return;
        }
        if (!target.steamId) {
            reply.line("Sem identificação Steam não há onde salvar o status social.");
            return;
        }

        setSocialStatus(target.steamId, rest[0]);
        reply.line(`${whose} status socialis agora é ${SOCIAL_STATUS[rest[0]].label}.`);
    },
};
