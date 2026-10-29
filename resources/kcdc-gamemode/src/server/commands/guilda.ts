import { nameOf } from "../acquaintances.js";
import type { Command, CommandContext } from "../command.js";
import { findPlayer } from "../players.js";
import { clearGuildId, getGuildId, GUILDS, listGuildMembers, sendSocial, setGuildId } from "../status.js";

/** A guild by its id or by what the players call it ("ferreiro", "Fabri Ferrarii"), or null. */
function guildNamed(word: string) {
    const folded = word.toLowerCase();
    return GUILDS.find((guild) => guild.id === folded || guild.profession.toLowerCase() === folded || guild.nameLatin.toLowerCase() === folded) ?? null;
}

export const guildaCommand: Command = {
    name: "guilda",
    summary: "(admin) Mostra as guildas, ou muda a guilda de um jogador (o jogador troca a sua uma vez de graça, e depois por 100 moedas).",
    usage: [
        "/guilda  -- as guildas e quantos membros cada uma tem",
        "/guilda entrar <guilda>  -- você entra na guilda na hora, e troca de uma para outra quantas vezes quiser (para testar)",
        "/guilda sair  -- você sai da sua guilda",
        "/guilda ver <jogador>  -- a guilda dele",
        "/guilda definir <jogador> <guilda>  -- põe o jogador na guilda (id, ofício ou nome latino)",
        "/guilda limpar <jogador>  -- tira o jogador da guilda, para que ele escolha de novo",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, who, guildWord] = args;
        if (sub === undefined) {
            reply.lines(GUILDS.map((guild) => `${guild.id} -- ${guild.profession} (${guild.nameLatin}), ${listGuildMembers(guild.id).length} membro(s)`));
            return;
        }
        // The administrator's own guild (2026-10-18: "o admin deve poder alternar guildas a vontade para teste").
        if (sub === "entrar" || sub === "sair") {
            if (player.steamId === "") {
                reply.line("Você entrou sem identificação Steam: não há onde guardar a guilda.");
                return;
            }
            if (sub === "sair") {
                const left = GUILDS.find((guild) => guild.id === getGuildId(player.steamId));
                reply.line(clearGuildId(player.steamId) ? `Você saiu da guilda ${left?.profession ?? ""}.` : "Você não tem guilda.");
                sendSocial(player);
                return;
            }
            const wanted = guildNamed(who ?? "");
            if (wanted === null) {
                reply.line("Qual guilda? /guilda entrar <guilda>: " + GUILDS.map((guild) => guild.id).join(", ") + ".");
                return;
            }
            if (!setGuildId(player.steamId, wanted.id)) {
                reply.line("Essa guilda não pôde ser guardada.");
                return;
            }
            reply.line(`Você agora é da guilda ${wanted.profession} (${wanted.nameLatin}). Troque quando quiser com /guilda entrar.`);
            sendSocial(player);
            return;
        }
        if ((sub !== "ver" && sub !== "definir" && sub !== "limpar") || who === undefined || (sub === "definir" && guildWord === undefined)) {
            usage();
            return;
        }
        const found = findPlayer(who);
        if ("error" in found) {
            reply.line(found.error);
            return;
        }
        const target = found.player;
        if (target.steamId === "") {
            reply.line(`${target.nickname} entrou sem identificação Steam: não há onde guardar a guilda.`);
            return;
        }
        const current = GUILDS.find((guild) => guild.id === getGuildId(target.steamId));
        if (sub === "ver") {
            reply.line(current ? `${nameOf(target)} é da guilda ${current.profession} (${current.nameLatin}).` : `${nameOf(target)} não tem guilda.`);
            return;
        }
        if (sub === "limpar") {
            reply.line(clearGuildId(target.steamId) ? `${nameOf(target)} saiu da guilda ${current?.profession ?? ""} e pode escolher de novo.` : `${nameOf(target)} não tinha guilda.`);
            return;
        }
        const guild = guildNamed(guildWord ?? "");
        if (guild === null) {
            reply.line("Guilda desconhecida. /guilda lista as guildas.");
            return;
        }
        if (!setGuildId(target.steamId, guild.id)) {
            reply.line("Essa guilda não pôde ser guardada.");
            return;
        }
        reply.line(`${nameOf(target)} agora é da guilda ${guild.profession} (${guild.nameLatin}).`);
    },
};
