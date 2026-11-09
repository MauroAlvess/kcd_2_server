import type { Command, CommandContext } from "../command.js";
import { DAILY_MAX, earnedToday, professionXp, RATE_MAX, RATE_MIN, STANDARD_RATES, TRADE_RATES } from "../profession-xp.js";
import type { Trade } from "../profession-xp.js";
import { chooseDailyFull, chooseRate, trackWord } from "../profession-xp-settings.js";

/** The trades by the name the players know. */
const TRADE_WORDS: Readonly<Record<Trade, string>> = {
    forja: "forja",
    costura: "costura",
    fogo: "cozinha",
    defumador: "defumador",
    secador: "secador",
    alquimia: "alquimia",
    horta: "horta",
    beneficiar: "beneficiar a colheita",
    lenha: "lenha",
    mina: "mineração",
    ordenha: "ordenha",
    tosquia: "tosquia",
};

const TRACKS = ["craftsmanship", "survival", "alchemy", "drinking", "strength"];

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * `/xpoficios`: the pace of the trades' XP (`profession-xp.ts`, the standard of 2026-11-03): each trade's rate, the factor over all of them, and the day's limit; and what a player has
 * earned of each track today. An administrator's knob for the pace at which the guilds level up.
 */
export const xpOficiosCommand: Command = {
    name: "xpoficios",
    summary: "(admin) O ritmo do XP dos ofícios: o padrão de cada ofício, um fator sobre todos e o limite por dia.",
    usage: [
        "/xpoficios  -- o padrão de cada ofício, o fator e o limite do dia",
        `/xpoficios <${RATE_MIN} a ${RATE_MAX}>  -- multiplica o XP de todos os ofícios (1 é o padrão); vale na próxima obra de cada um`,
        `/xpoficios limite <0 a ${DAILY_MAX}>  -- o XP de cada habilidade que rende inteiro por dia (0 tira o limite); depois rende ${Math.round(professionXp.overShare * 100)}%`,
        "/xpoficios hoje <jogador>  -- o XP de ofício que um jogador já fez hoje, por habilidade",
    ],

    run({ args, reply, usage }: CommandContext): void {
        const [word, value, ...rest] = args;
        if (word === undefined) {
            const rates = (Object.keys(STANDARD_RATES) as Trade[]).map((trade) => `${TRADE_WORDS[trade]} ${TRADE_RATES[trade] * professionXp.rate}x`).join(", ");
            reply.line(`XP dos ofícios (vezes o das tabelas): ${rates}. Fator ${professionXp.rate} sobre o padrão.`);
            reply.line(
                professionXp.dailyFull > 0
                    ? `Limite do dia: ${professionXp.dailyFull} XP de cada habilidade rendem inteiros; depois, ${Math.round(professionXp.overShare * 100)}% de cada obra, até a meia-noite (Brasília).`
                    : "Sem limite por dia.",
            );
            return;
        }
        if (fold(word) === "limite") {
            const xp = Number((value ?? "").replace(/\./g, "").replace(",", "."));
            if (value === undefined || !chooseDailyFull(xp)) {
                usage();
                return;
            }
            reply.line(professionXp.dailyFull > 0 ? `Pronto: ${professionXp.dailyFull} XP de cada habilidade rendem inteiros por dia; depois, ${Math.round(professionXp.overShare * 100)}%.` : "Pronto: sem limite por dia.");
            return;
        }
        if (fold(word) === "hoje") {
            const name = [value, ...rest].filter((one) => one !== undefined).join(" ").trim();
            const who = name === "" ? undefined : Player.all().find((one) => fold(one.nickname).includes(fold(name)));
            if (who === undefined) {
                reply.line(name === "" ? "Diga o nome do jogador." : `Nenhum jogador no jogo com '${name}' no nome.`);
                return;
            }
            const done = TRACKS.map((track) => [track, earnedToday(who.steamId, track)] as const).filter(([, xp]) => xp > 0);
            reply.line(done.length === 0 ? `${who.nickname} não fez XP de ofício hoje.` : `${who.nickname} hoje: ${done.map(([track, xp]) => `${trackWord(track)} ${xp}`).join(", ")} (limite ${professionXp.dailyFull}).`);
            return;
        }
        const rate = Number(word.replace(",", "."));
        if (!chooseRate(rate)) {
            usage();
            return;
        }
        reply.line(`Pronto: o XP de todos os ofícios vale ${professionXp.rate} vez(es) o padrão.`);
    },
};
