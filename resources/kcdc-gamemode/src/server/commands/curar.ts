import type { Command, CommandContext } from "../command.js";
import { allCharacters } from "../characters.js";
import { cure, cureLater } from "../heal.js";
import type { Cure } from "../heal.js";
import { findPlayer } from "../players.js";

/** `/curar`: an administrator stops somebody's bleeding (and closes their injuries), or heals them whole (`heal.ts`). */
export const curarCommand: Command = {
    name: "curar",
    summary: "(admin) Estanca o sangramento (e fecha os ferimentos) de um jogador, ou cura tudo. Quem não está no servidor é curado na próxima entrada.",
    usage: ["/curar <jogador>  -- estanca o sangramento e fecha os ferimentos", "/curar <jogador> tudo  -- cura tudo: vida, ferimentos, venenos e sangramento"],

    run({ args, reply, usage }: CommandContext): void {
        const words = [...args];
        const what: Cure = words.at(-1) === "tudo" ? "tudo" : "sangramento";
        if (words.at(-1) === "tudo" || words.at(-1) === "sangramento") {
            words.pop();
        }
        const who = words.join(" ").trim();
        if (who === "") {
            usage();
            return;
        }
        const found = findPlayer(who);
        if (!("error" in found)) {
            reply.line(cure(found.player, what) ? `${found.player.nickname}: ${what === "tudo" ? "curado" : "sangramento estancado"}.` : `Não consegui curar ${found.player.nickname} agora.`);
            return;
        }
        // Away: by the character's name, its nickname or the Steam id.
        const key = who.toLowerCase();
        const matches = allCharacters().filter((entry) => entry.steamId === who || entry.name.toLowerCase() === key || entry.nickname.toLowerCase() === key);
        if (matches.length !== 1) {
            reply.line(matches.length === 0 ? found.error : `Mais de um personagem com "${who}": use o Steam id.`);
            return;
        }
        cureLater(matches[0]!.steamId, what);
        reply.line(`${matches[0]!.name} não está no servidor: será ${what === "tudo" ? "curado" : "tratado"} na próxima entrada.`);
    },
};
