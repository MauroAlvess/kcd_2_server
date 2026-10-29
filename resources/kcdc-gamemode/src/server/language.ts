/**
 * The language of a player (user, 2026-10-17): Portuguese, which everything is written in, or English. It is kept by Steam id
 * in `playerdata/language.json` (a player with no Steam id keeps it only while connected) and chosen in the panel's Opções
 * section or with `/idioma`.
 *
 * Everything the server says is written in Portuguese and translated on its way out for a player who chose English: the
 * chat goes through `Chat.sendToPlayer`, which `installLanguage` wraps, and the toast of the panel through `notice`; the
 * panel's own texts are translated by the page, with the dictionary `dictionaryParts` cuts into pieces (`language-panel.ts`).
 * A text the dictionaries do not know is shown as it is, in Portuguese: nothing is ever lost to a missing entry.
 */

import { MESSAGES, MESSAGE_PATTERNS } from "./lang-en-messages.js";
import { PANEL, PANEL_PATTERNS } from "./lang-en-panel.js";
import { ensureDir, read, write } from "./store.js";

const FILE = "playerdata/language.json";

export type Lang = "pt" | "en";

export const DEFAULT_LANG: Lang = "pt";

export function isLang(value: unknown): value is Lang {
    return value === "pt" || value === "en";
}

/** One dictionary ready to use: whole texts, and sentences as regular expressions with what they say in English. */
export interface Dictionary {
    readonly exact: ReadonlyMap<string, string>;
    readonly patterns: ReadonlyArray<{ readonly test: RegExp; readonly say: string }>;
}

export function compile(exact: Readonly<Record<string, string>>, patterns: ReadonlyArray<readonly [string, string]>): Dictionary {
    return { exact: new Map(Object.entries(exact)), patterns: patterns.map(([source, say]) => ({ test: new RegExp(source), say })) };
}

/** Whole texts first, then sentences, then a command's line (`  /preso -- ...`), then a text of parts joined by " · ". */
export function translateWith(dictionary: Dictionary, text: string): string {
    const whole = dictionary.exact.get(text);
    if (whole !== undefined) {
        return whole;
    }
    for (const { test, say } of dictionary.patterns) {
        if (test.test(text)) {
            // `$1` is what the sentence caught as it was; `$T1` is the same, translated.
            return text.replace(test, (...caught: unknown[]) => say.replace(/\$(T?)(\d)/g, (_all, translated: string, n: string) => {
                const part = (caught[Number(n)] as string | undefined) ?? "";
                return translated === "T" ? translateWith(dictionary, part) : part;
            }));
        }
    }
    const line = /^(\s*\/\S+\s+-- )(.+)$/s.exec(text);
    if (line !== null) {
        const rest = translateWith(dictionary, line[2] as string);
        return rest === line[2] ? text : `${line[1]}${rest}`;
    }
    if (text.includes(" · ")) {
        const parts = text.split(" · ");
        const done = parts.map((part) => translateWith(dictionary, part));
        return done.some((part, index) => part !== parts[index]) ? done.join(" · ") : text;
    }
    return text;
}

const panel = compile(PANEL, PANEL_PATTERNS);
const everything = compile({ ...PANEL, ...MESSAGES }, [...MESSAGE_PATTERNS, ...PANEL_PATTERNS]);

/** What the server says, in the language asked. */
export function translate(text: string, lang: Lang): string {
    return lang === "en" ? translateWith(everything, text) : text;
}

const chosen = new Map<string, Lang>();
const byConnection = new Map<number, Lang>();
let writable = true;

function keyOf(player: { readonly steamId: string }): string | null {
    return player.steamId !== "" ? player.steamId : null;
}

export function languageOf(player: { readonly id: number; readonly steamId: string }): Lang {
    const key = keyOf(player);
    return (key !== null ? chosen.get(key) : byConnection.get(player.id)) ?? DEFAULT_LANG;
}

export function setLanguage(player: { readonly id: number; readonly steamId: string }, lang: Lang): void {
    const key = keyOf(player);
    if (key === null) {
        byConnection.set(player.id, lang);
        return;
    }
    chosen.set(key, lang);
    if (!writable) {
        return;
    }
    try {
        ensureDir("playerdata");
        // Portuguese is the default: only a choice of something else is worth keeping.
        write(FILE, Object.fromEntries([...chosen].filter(([, value]) => value !== DEFAULT_LANG)));
    } catch (error: unknown) {
        console.log(`language: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** The dictionary of the panel's page, in pieces small enough to send one by one: `[0, "Portuguese", "English"]` is a text, `[1, ...]` a sentence. */
export type Entry = readonly [0 | 1, string, string];

export function dictionaryParts(maxChars = 9000): Entry[][] {
    const entries: Entry[] = [...Object.entries(PANEL).map(([key, value]): Entry => [0, key, value]), ...PANEL_PATTERNS.map(([key, value]): Entry => [1, key, value])];
    const parts: Entry[][] = [];
    let current: Entry[] = [];
    let size = 0;
    for (const entry of entries) {
        const length = entry[1].length + entry[2].length + 12;
        if (size + length > maxChars && current.length > 0) {
            parts.push(current);
            current = [];
            size = 0;
        }
        current.push(entry);
        size += length;
    }
    if (current.length > 0) {
        parts.push(current);
    }
    return parts;
}

/** The panel's dictionary, as the page would build it: for tests that check the page and the server agree. */
export const panelDictionary: Dictionary = panel;

/** Loads the choices and puts the translation on the chat: from now on a line sent to an English player is in English when it is known. */
export function installLanguage(): void {
    const loaded = read<Record<string, unknown>>(FILE);
    if (loaded.status === "ok") {
        for (const [key, value] of Object.entries(loaded.value)) {
            if (isLang(value)) {
                chosen.set(key, value);
            }
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`language: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }

    const original = Chat.sendToPlayer.bind(Chat);
    try {
        // A line with an author is somebody's own words (`local-chat.ts`), never put through the dictionary: a player who types "Família" says it.
        Chat.sendToPlayer = (player, text, options): void => original(player, typeof options?.author === "string" && options.author !== "" ? text : translate(text, languageOf(player as Player)), options);
    } catch (error: unknown) {
        console.log(`language: não consegui traduzir o chat (${error instanceof Error ? error.message : String(error)}); só o painel e as mensagens dele serão traduzidos`);
        return;
    }
    if (Chat.sendToPlayer === original) {
        console.log("language: o chat não aceitou a tradução; só o painel e as mensagens dele serão traduzidos");
    }
}
