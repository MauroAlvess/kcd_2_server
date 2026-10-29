import type { Command, CommandContext } from "../command.js";
import { setFreeCrafts, usesFreeCrafts } from "../guild-crafts.js";
import { getGuildId } from "../status.js";

export const oficiosCommand: Command = {
    name: "oficios",
    summary: "(admin) Usar só as ferramentas da sua guilda, como um jogador, ou as de todos os ofícios.",
    usage: [
        "/oficios  -- como você está",
        "/oficios guilda  -- só as ferramentas da sua guilda (a forja, as mesas de alquimia, o fogo, o secador, o defumador), como um jogador comum",
        "/oficios livre  -- as de todos os ofícios, até você sair do servidor",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [mode] = args;
        const guild = player.steamId === "" ? null : getGuildId(player.steamId);
        if (mode === undefined) {
            reply.line(guild === null ? "Você não tem guilda: usa as ferramentas de todos os ofícios." : usesFreeCrafts(player) ? `Você é da guilda ${guild} e está com as ferramentas de todos os ofícios (/oficios guilda para voltar à sua).` : `Você é da guilda ${guild} e usa só as ferramentas dela, como um jogador comum (/oficios livre para usar todas).`);
            return;
        }
        if (mode !== "livre" && mode !== "guilda") {
            usage();
            return;
        }
        setFreeCrafts(player, mode === "livre");
        reply.line(mode === "livre" ? "Você usa as ferramentas de todos os ofícios até sair do servidor." : "Você usa só as ferramentas da sua guilda, como um jogador comum.");
    },
};
