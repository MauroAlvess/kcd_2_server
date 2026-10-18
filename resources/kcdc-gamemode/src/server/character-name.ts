/**
 * What a character is called: one first name, and an alcunha (the Latin agnomen) chosen from a list that fits Bohemia in 1403.
 *
 * The user's rule (2026-10-15): "apenas o primeiro nome; proibido espaço, números e caracteres especiais", and "dar opção de
 * alcunha: Henry I, Henry II, Henry Júnior, que faça sentido a Boêmia". The family's surname comes later, from the Família
 * section, and is not part of this: the name read by other players is `Henry II Capon`, the first name, the alcunha, the
 * surname.
 *
 * Two characters may not be called the same (a first name and an alcunha, compared without capitals, accents or
 * punctuation), which is what the alcunha is for: the second Henry is Henry II, or Henry the Red.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 16;

export interface Epithet {
    /** What is kept and sent; never shown. */
    readonly id: string;
    /** What follows the first name: "II", "Júnior", "o Ruivo". */
    readonly label: string;
    /** The Czech of the time, for the ones that have one, in the page's way of glossing a Latin word. */
    readonly gloss: string;
    readonly group: string;
}

export const EPITHET_GROUPS: readonly { readonly id: string; readonly label: string }[] = [
    { id: "ordem", label: "Ordem" },
    { id: "idade", label: "Idade" },
    { id: "corpo", label: "Aparência" },
    { id: "carater", label: "Caráter" },
];

/** In the order the list shows them: the numerals first, then age, looks and character. */
export const EPITHETS: readonly Epithet[] = [
    { id: "i", label: "I", gloss: "", group: "ordem" },
    { id: "ii", label: "II", gloss: "", group: "ordem" },
    { id: "iii", label: "III", gloss: "", group: "ordem" },
    { id: "iv", label: "IV", gloss: "", group: "ordem" },
    { id: "v", label: "V", gloss: "", group: "ordem" },
    { id: "junior", label: "Júnior", gloss: "Mladší", group: "idade" },
    { id: "velho", label: "o Velho", gloss: "Starší", group: "idade" },
    { id: "jovem", label: "o Jovem", gloss: "Mladý", group: "idade" },
    { id: "ruivo", label: "o Ruivo", gloss: "Zrzavý", group: "corpo" },
    { id: "moreno", label: "o Moreno", gloss: "Snědý", group: "corpo" },
    { id: "louro", label: "o Louro", gloss: "Plavý", group: "corpo" },
    { id: "grisalho", label: "o Grisalho", gloss: "Šedivý", group: "corpo" },
    { id: "alto", label: "o Alto", gloss: "Vysoký", group: "corpo" },
    { id: "baixo", label: "o Baixo", gloss: "Malý", group: "corpo" },
    { id: "forte", label: "o Forte", gloss: "Silný", group: "corpo" },
    { id: "calvo", label: "o Calvo", gloss: "Plešatý", group: "corpo" },
    { id: "barbudo", label: "o Barbudo", gloss: "Vousatý", group: "corpo" },
    { id: "coxo", label: "o Coxo", gloss: "Kulhavý", group: "corpo" },
    { id: "justo", label: "o Justo", gloss: "Spravedlivý", group: "carater" },
    { id: "valente", label: "o Valente", gloss: "Statečný", group: "carater" },
    { id: "piedoso", label: "o Piedoso", gloss: "Zbožný", group: "carater" },
    { id: "sabio", label: "o Sábio", gloss: "Moudrý", group: "carater" },
    { id: "bom", label: "o Bom", gloss: "Dobrý", group: "carater" },
    { id: "generoso", label: "o Generoso", gloss: "Štědrý", group: "carater" },
];

export function epithetById(id: unknown): Epithet | null {
    return typeof id === "string" ? (EPITHETS.find((epithet) => epithet.id === id) ?? null) : null;
}

/** What nobody may be called: the words the game itself uses for somebody who has not introduced themselves, and for the staff. */
const RESERVED = new Set(["desconhecido", "desconhecida", "admin", "administrador", "administradora", "moderador", "moderadora", "servidor", "sistema", "coroa"]);

/** Letters of the alphabets of Bohemia and Brazil: A to Z, and the accented letters of Latin-1 and Latin Extended-A (no signs). */
const LETTERS = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]+$/;

export type NameCheck = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly reason: string };

/**
 * A first name as the player typed it: letters only, between NAME_MIN and NAME_MAX of them, set in the usual case
 * (a capital, then small letters). Anything else is refused with the reason to say.
 */
export function cleanName(raw: unknown): NameCheck {
    if (typeof raw !== "string") {
        return { ok: false, reason: "Escreva o nome do personagem." };
    }
    const text = raw.normalize("NFC");
    if (text.trim() === "") {
        return { ok: false, reason: "Escreva o nome do personagem." };
    }
    if (/\s/.test(text)) {
        return { ok: false, reason: "O nome é só o primeiro nome: sem espaços." };
    }
    if (/[0-9]/.test(text)) {
        return { ok: false, reason: "Sem números no nome." };
    }
    if (!LETTERS.test(text)) {
        return { ok: false, reason: "Só letras: sem símbolos, pontuação nem emojis." };
    }
    if (text.length < NAME_MIN || text.length > NAME_MAX) {
        return { ok: false, reason: `O nome precisa ter entre ${NAME_MIN} e ${NAME_MAX} letras.` };
    }
    const name = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    if (RESERVED.has(nameKey(name))) {
        return { ok: false, reason: "Esse nome não pode ser usado." };
    }
    return { ok: true, name };
}

/** First name and alcunha as other players read them: "Henry II", "Henry o Ruivo", "Henry". */
export function fullName(name: string, epithetId?: string | null): string {
    const epithet = epithetById(epithetId);
    return epithet === null ? name : `${name} ${epithet.label}`;
}

/** What two names are compared by: no capitals, no accents, nothing but letters and digits ("Matyáš II" is "matyasii"). */
export function nameKey(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}
