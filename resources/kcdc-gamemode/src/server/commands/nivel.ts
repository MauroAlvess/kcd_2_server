import type { Command, CommandContext } from "../command.js";
import { raiseSavedTrack, savedProgression } from "../character-state.js";
import { allCharacters } from "../characters.js";
import { findPlayer } from "../players.js";

/** The levels a skill can reach in the game. */
export const MAX_LEVEL = 30;

/** "alchemy 20, survival 6, ..." for the tracks that are not at the 5 everybody starts with, then how many are. */
export function levelsLine(tracks: Readonly<Record<string, { readonly level: number; readonly xp: number }>>): string {
    const names = Object.keys(tracks);
    const raised = names.filter((name) => (tracks[name]?.level ?? 0) !== 5);
    const text = raised.length === 0 ? "nenhuma trilha acima do 5 do começo" : raised.map((name) => `${name} ${tracks[name]?.level}`).join(", ");
    return `${text} (de ${names.length} trilhas)`;
}

/**
 * `/nivel`: an administrator's look at a character's levels and the way to give back levels that were lost (2026-10-23: a player's whole
 * progression read as a fresh character's). A level is put in exactly (`restoreProgression`: no pop-up and no perk points, since the perks
 * the character had stay), and only upward; for a character who is not in, it is put in the file and they have it at the next entry.
 */
export const nivelCommand: Command = {
    name: "nivel",
    summary: "(admin) Mostra os níveis de um personagem, ou devolve a ele o nível de uma trilha perdido (só sobe; sem pontos de talento).",
    usage: [
        "/nivel <jogador>  -- os níveis dele (quem não está no servidor: os do arquivo)",
        "/nivel <jogador> <trilha> <nível>  -- põe a trilha (alchemy, survival, weapon_sword...) nesse nível, de 1 a 30; só sobe",
    ],

    run({ args, reply, usage }: CommandContext): void {
        const words = [...args];
        let track = "";
        let wanted = 0;
        if (words.length >= 3 && /^\d+$/.test(words.at(-1) ?? "") && /^[a-z_]+$/.test(words.at(-2) ?? "")) {
            wanted = Number(words.pop());
            track = words.pop() as string;
        }
        const who = words.join(" ").trim();
        if (who === "" || (track !== "" && (wanted < 1 || wanted > MAX_LEVEL))) {
            usage();
            return;
        }

        const found = findPlayer(who);
        if (!("error" in found)) {
            const target = found.player;
            const live = target.progression;
            if (live === null) {
                reply.line(`${target.nickname} ainda não disse os níveis (o jogo dele não reportou).`);
                return;
            }
            if (track === "") {
                reply.line(`${target.nickname}: ${levelsLine(live.tracks)}.`);
                return;
            }
            const now = live.tracks[track];
            if (now === undefined) {
                reply.line(`Trilha desconhecida: ${track}. Elas são: ${Object.keys(live.tracks).join(", ")}.`);
                return;
            }
            if (now.level >= wanted) {
                reply.line(`${target.nickname} já está no nível ${now.level} de ${track}: o comando só sobe.`);
                return;
            }
            // The track alone: the perks and the points are left as they are (a restore that carried the perks would drop the blocked ones, the weapon combos, since KCDC 1.7.2).
            const ok = target.restoreProgression({ tracks: { ...live.tracks, [track]: { level: wanted, xp: 0 } } } as ProgressionSnapshot);
            console.log(`nivel: ${track} de ${target.nickname}: ${now.level} -> ${wanted} (${ok ? "feito" : "o jogo não aceitou"})`);
            reply.line(ok ? `${target.nickname}: ${track} do nível ${now.level} para o ${wanted}.` : `O jogo não aceitou devolver o nível de ${target.nickname} agora.`);
            return;
        }

        // Away: by the character's name, its nickname or the Steam id.
        const key = who.toLowerCase();
        const matches = allCharacters().filter((entry) => entry.steamId === who || entry.name.toLowerCase() === key || entry.nickname.toLowerCase() === key);
        if (matches.length !== 1) {
            reply.line(matches.length === 0 ? found.error : `Mais de um personagem com "${who}": use o Steam id.`);
            return;
        }
        const entry = matches[0]!;
        const saved = savedProgression(entry.steamId);
        if (saved === null) {
            reply.line(`${entry.name} não tem níveis guardados.`);
            return;
        }
        if (track === "") {
            reply.line(`${entry.name} (no arquivo): ${levelsLine(saved.tracks)}.`);
            return;
        }
        const outcome = raiseSavedTrack(entry.steamId, track, wanted);
        const text: Record<string, string> = {
            feito: `${entry.name} não está no servidor: ${track} vai para o nível ${wanted} no arquivo dele, e ele a terá na próxima entrada.`,
            "sem personagem": `${entry.name} não tem arquivo de personagem.`,
            "sem trilha": `Trilha desconhecida: ${track}. Elas são: ${Object.keys(saved.tracks).join(", ")}.`,
            "já está": `${entry.name} já está no nível ${saved.tracks[track]?.level ?? "?"} de ${track}: o comando só sobe.`,
        };
        if (outcome === "feito") {
            console.log(`nivel: ${track} de ${entry.name} (no arquivo): ${saved.tracks[track]?.level ?? "?"} -> ${wanted}`);
        }
        reply.line(text[outcome] ?? outcome);
    },
};
