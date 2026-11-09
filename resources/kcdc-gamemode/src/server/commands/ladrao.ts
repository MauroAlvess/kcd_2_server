import { allCharacters } from "../characters.js";
import type { Command, CommandContext } from "../command.js";
import { findPlayer } from "../players.js";
import { fold } from "../roster.js";
import { BREAKIN_WINDOW_MS, BREAKINS_FOR_MARK, clearThief, markThief, MARK_DAYS, recorded, thieves } from "../thieves.js";

/**
 * Whoever has a mark or counted break-ins against them and reads like `who`: by the name of the character (the one made in the creator, with the alcunha), the account's nickname, or the name
 * the mark was given under -- also when they are not here and the mark has run out (2026-11-06: the marks are filed under the account's nickname, "Player" for two of them, so the
 * character's name could not find either).
 */
export function recordedNamed(who: string): Array<{ readonly steamId: string; readonly label: string }> {
    const key = fold(who);
    if (key === "") {
        return [];
    }
    const characters = new Map(allCharacters().map((one) => [one.steamId, one]));
    const found: Array<{ steamId: string; label: string }> = [];
    for (const row of recorded()) {
        const character = characters.get(row.steamId);
        const names = [character === undefined ? "" : `${character.name} ${character.epithet}`.trim(), character?.nickname ?? "", row.name ?? ""].filter((name) => name !== "");
        if (names.some((name) => fold(name).includes(key))) {
            found.push({ steamId: row.steamId, label: names[0] ?? row.steamId });
        }
    }
    return found;
}

/** `/ladrao`: the thieves' marks (`thieves.ts`): who wears one and why, and an administrator's mark or pardon. */
export const ladraoCommand: Command = {
    name: "ladrao",
    summary: `(admin) A marca de ladrão: quem tem e por quê, marcar ou perdoar. Quem arromba ${BREAKINS_FOR_MARK} fechaduras (portas, portões ou baús) de outros jogadores em ${Math.round(BREAKIN_WINDOW_MS / 86_400_000)} dias é marcado sozinho por ${MARK_DAYS} dia; de parente não conta.`,
    usage: ["/ladrao  -- quem está marcado, até quando e por quê", `/ladrao marcar <jogador> [dias]  -- marca (${MARK_DAYS} dias se não disser)`, "/ladrao perdoar <jogador>  -- tira a marca (e zera os arrombamentos contados); serve também para quem não está online, pelo nome da marca"],

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
            // Not here: a pardon finds who it is for by the character's name or the one the mark was given under, a mark that ran out and break-ins still counted too (2026-11-02, 2026-11-06).
            const marked = sub === "perdoar" ? recordedNamed(who) : [];
            const only = marked.length === 1 ? marked[0] : undefined;
            if (only !== undefined) {
                clearThief(only.steamId);
                reply.line(`${only.label} não é mais marcado como ladrão, e os arrombamentos contados contra ele foram zerados.`);
                return;
            }
            reply.line(marked.length > 1 ? `Mais de um com '${who}': ${marked.map(({ label }) => label).join(", ")}. Escreva mais do nome.` : found.error);
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
