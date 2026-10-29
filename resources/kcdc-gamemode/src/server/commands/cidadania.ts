import { nameOf } from "../acquaintances.js";
import { citizensOf, setCitizenship, TOWNS, townOf } from "../citizenship.js";
import type { Command, CommandContext } from "../command.js";
import { findPlayer } from "../players.js";

export const cidadaniaCommand: Command = {
    name: "cidadania",
    summary: "(admin) Mostra as cidades e os cidadãos, ou define a cidadania de um jogador (que, depois, só o senhor das terras depõe).",
    usage: ["/cidadania  -- as cidades e quantos cidadãos cada uma tem", "/cidadania ver <jogador>  -- a cidade dele", "/cidadania definir <jogador> <cidade>  -- faz dele cidadão da cidade ou terra (sedes: suchdol, raborsch, malesov, kuttenberg, pschitoky; terras: wysoka, bohunowitz, horschan, bylany, stara-kutna, miskowitz)", "/cidadania limpar <jogador>  -- tira a cidadania, para que ele escolha de novo"],

    run({ args, reply, usage }: CommandContext): void {
        const [sub, who, townWord] = args;
        if (sub === undefined) {
            reply.lines(TOWNS.map((town) => `${town.id} -- ${town.name}, ${citizensOf(town).length} cidadão(s)`));
            return;
        }
        if ((sub !== "ver" && sub !== "definir" && sub !== "limpar") || who === undefined || (sub === "definir" && townWord === undefined)) {
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
            reply.line(`${target.nickname} entrou sem identificação Steam: não há onde guardar a cidadania.`);
            return;
        }
        const current = townOf(target.steamId);
        if (sub === "ver") {
            reply.line(current ? `${nameOf(target)} é cidadão de ${current.name}.` : `${nameOf(target)} não tem cidadania.`);
            return;
        }
        if (sub === "limpar") {
            reply.line(setCitizenship(target.steamId, null) ? `${nameOf(target)} deixou de ser cidadão de ${current?.name ?? ""} e pode escolher de novo.` : `${nameOf(target)} não tinha cidadania.`);
            return;
        }
        const wanted = (townWord ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
        const town = TOWNS.find((candidate) => candidate.id === wanted || candidate.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === wanted);
        if (town === undefined || !setCitizenship(target.steamId, town.id)) {
            reply.line("Cidade desconhecida. /cidadania lista as cidades.");
            return;
        }
        reply.line(`${nameOf(target)} agora é cidadão de ${town.name}.`);
    },
};
