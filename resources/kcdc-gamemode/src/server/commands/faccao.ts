import { nameOf } from "../acquaintances.js";
import type { Command, CommandContext } from "../command.js";
import { findPlayer } from "../players.js";
import { clearFactionId, FACTIONS, getFactionId, setFactionId } from "../status.js";

/** A faction by its id or by what the players call it, or null. */
function factionNamed(word: string) {
    const folded = word.toLowerCase();
    return FACTIONS.find((faction) => faction.id === folded || faction.name.toLowerCase() === folded || faction.name.toLowerCase().includes(folded)) ?? null;
}

export const faccaoCommand: Command = {
    name: "faccao",
    summary: "(admin) Mostra as facções, ou muda a facção de lealdade de um jogador: o juramento dele é definitivo.",
    usage: ["/faccao  -- as facções", "/faccao ver <jogador>  -- a facção dele", "/faccao definir <jogador> <facção>  -- põe o jogador na facção (id ou parte do nome)", "/faccao limpar <jogador>  -- tira a lealdade, para que ele jure de novo"],

    run({ args, reply, usage }: CommandContext): void {
        const [sub, who, word] = args;
        if (sub === undefined) {
            reply.lines(FACTIONS.map((faction) => `${faction.id} -- ${faction.name}`));
            return;
        }
        if ((sub !== "ver" && sub !== "definir" && sub !== "limpar") || who === undefined || (sub === "definir" && word === undefined)) {
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
            reply.line(`${target.nickname} entrou sem identificação Steam: não há onde guardar a facção.`);
            return;
        }
        const current = FACTIONS.find((faction) => faction.id === getFactionId(target.steamId));
        if (sub === "ver") {
            reply.line(current ? `${nameOf(target)} jurou lealdade à ${current.name}.` : `${nameOf(target)} não jurou lealdade a nenhuma facção.`);
            return;
        }
        if (sub === "limpar") {
            reply.line(clearFactionId(target.steamId) ? `${nameOf(target)} deixou a ${current?.name ?? "facção"} e pode jurar de novo.` : `${nameOf(target)} não tinha facção.`);
            return;
        }
        const faction = factionNamed(word ?? "");
        if (faction === null || !setFactionId(target.steamId, faction.id)) {
            reply.line("Facção desconhecida. /faccao lista as facções.");
            return;
        }
        reply.line(`${nameOf(target)} agora jura lealdade à ${faction.name}.`);
    },
};
