/**
 * The language's part of the status panel: the player's choice travels in the payload (`lang`), the Opções section asks
 * for a change (`status.lang`) and an English player's page asks for its dictionary (`status.dict`, in pieces). See `language.ts`.
 */

import { dictionaryParts, isLang, languageOf, setLanguage } from "./language.js";
import { addPayload, notice, sendSocial } from "./status.js";

const RESOURCE = "kcdc-gamemode";

function fieldsOf(payload: unknown): Record<string, unknown> {
    try {
        const value = typeof payload === "string" && payload.length <= 256 ? (JSON.parse(payload) as unknown) : payload;
        return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** Changes a player's language and says so, in the new one. */
export function chooseLanguage(player: Player, lang: unknown): boolean {
    if (!isLang(lang)) {
        return false;
    }
    setLanguage(player, lang);
    notice(player, lang === "en" ? "Idioma: inglês." : "Idioma: português.");
    sendSocial(player);
    return true;
}

export function installLanguagePanel(): void {
    addPayload((player) => ({ lang: languageOf(player) }));

    Events.onClient(`${RESOURCE}:status.lang`, (sender, payload) => {
        chooseLanguage(sender as Player, fieldsOf(payload)["lang"]);
    });

    Events.onClient(`${RESOURCE}:status.dict`, (sender) => {
        const player = sender as Player;
        if (languageOf(player) !== "en") {
            return;
        }
        const parts = dictionaryParts();
        parts.forEach((items, part) => {
            player.emit(`${RESOURCE}:status.dict`, JSON.stringify({ part, parts: parts.length, items }));
        });
    });
}
