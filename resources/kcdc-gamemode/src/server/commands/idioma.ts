import type { Command, CommandContext } from "../command.js";
import { chooseLanguage } from "../language-panel.js";
import { languageOf } from "../language.js";

const WORDS: Readonly<Record<string, "pt" | "en">> = { pt: "pt", br: "pt", portugues: "pt", português: "pt", en: "en", english: "en", ingles: "en", inglês: "en" };

export const idiomaCommand: Command = {
    name: "idioma",
    summary: "Idioma do painel, das mensagens e dos comandos: pt ou en.",
    usage: ["/idioma  -- mostra o idioma de agora", "/idioma pt  -- português", "/idioma en  -- English (panel, messages and commands)"],

    run({ player, args, reply }: CommandContext): void {
        const asked = args[0];
        if (asked === undefined) {
            reply.line(languageOf(player) === "en" ? "Language: English. /idioma pt for Portuguese." : "Idioma: português. /idioma en para English.");
            return;
        }
        const lang = WORDS[asked.toLowerCase()];
        if (lang === undefined) {
            reply.line("Idioma desconhecido / Unknown language. /idioma pt, /idioma en");
            return;
        }
        chooseLanguage(player, lang);
    },
};
