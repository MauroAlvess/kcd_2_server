import type { Command, CommandContext } from "../command.js";
import { findPlayer } from "../players.js";
import { clearThief, markThief, MARK_DAYS, thieves } from "../thieves.js";

/** `/ladrao`: the thieves' marks (`thieves.ts`): who wears one and why, and an administrator's mark or pardon. */
export const ladraoCommand: Command = {
    name: "ladrao",
    summary: "(admin) A marca de ladrão: quem tem e por quê, marcar ou perdoar. Quem rouba mais de 3 baús de outros jogadores em uma hora é marcado sozinho por 1 dia; baú de parente não conta.",
    usage: ["/ladrao  -- quem está marcado, até quando e por quê", `/ladrao marcar <jogador> [dias]  -- marca (${MARK_DAYS} dias se não disser)`, "/ladrao perdoar <jogador>  -- tira a marca"],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, who, daysWord] = args;
        if (sub === undefined) {
            const marked = thieves();
            reply.lines(
                marked.length === 0
                    ? ["Ninguém está marcado como ladrão."]
                    : marked.map(({ mark }) => `${mark.name} -- até ${new Date(mark.until).toISOString().slice(0, 16).replace("T", " ")} UTC -- ${mark.reason}`),
            );
            return;
        }
        if ((sub !== "marcar" && sub !== "perdoar") || who === undefined) {
            usage();
            return;
        }
        const found = findPlayer(who);
        if ("error" in found) {
            reply.line(found.error);
            return;
        }
        const target = found.player;
        if (sub === "perdoar") {
            reply.line(clearThief(target.steamId) ? `${target.nickname} não é mais marcado como ladrão.` : `${target.nickname} não tinha a marca.`);
            return;
        }
        const days = daysWord === undefined ? MARK_DAYS : Number(daysWord);
        if (!Number.isFinite(days) || days <= 0 || days > 60) {
            usage();
            return;
        }
        markThief(target.steamId, target.nickname, `marcado por ${player.nickname}`, Date.now(), days);
        reply.line(`${target.nickname} está marcado como ladrão por ${days} dia(s).`);
    },
};
