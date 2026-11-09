/**
 * What a player's written text may carry and how it may look: the notice boards' posters (`mural.ts`) and the letters (`letters.ts`) clean
 * their texts by the same rules, so that what one page draws the other draws the same way. A text has one style for the whole of it: the
 * page's own face or a gothic one, bold or not, the spacing of its lines and its alignment.
 */

export interface TextStyle {
    /** "normal" is the page's own text face; "bohemia" a gothic one. */
    readonly font: "normal" | "bohemia";
    readonly bold: boolean;
    readonly spacing: "tight" | "normal" | "wide";
    readonly align: "left" | "center";
}

export const DEFAULT_STYLE: TextStyle = { font: "normal", bold: false, spacing: "normal", align: "left" };

/** The style a request asks for: each field is one of its own values or the default's, so nothing else ever reaches a page's classes. */
export function cleanStyle(value: unknown): TextStyle {
    const fields = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    return {
        font: fields["font"] === "bohemia" ? "bohemia" : "normal",
        bold: fields["bold"] === true,
        spacing: fields["spacing"] === "tight" || fields["spacing"] === "wide" ? fields["spacing"] : "normal",
        align: fields["align"] === "center" ? "center" : "left",
    };
}

// What no text may carry: control characters (but the line break), the invisible ones that turn a line around or hide a word, and a lone
// surrogate. Listed as ranges of code points and walked, not as a pattern, so that none of them has to be written into this file.
const UNWANTED: ReadonlyArray<readonly [number, number]> = [
    [0x00, 0x09],
    [0x0b, 0x1f],
    [0x7f, 0x9f],
    [0xad, 0xad],
    [0x200b, 0x200f],
    [0x2028, 0x202e],
    [0x2060, 0x2064],
    [0xd800, 0xdfff],
    [0xfeff, 0xfeff],
    [0xfff9, 0xfffb],
];

/** The text without them. */
export function stripUnwanted(text: string): string {
    let out = "";
    for (const character of text) {
        const code = character.codePointAt(0) ?? 0;
        if (!UNWANTED.some(([from, to]) => code >= from && code <= to)) {
            out += character;
        }
    }
    return out;
}

/** A heading: one line, no strange characters, spaces in runs made one, no longer than `max`. */
export function cleanLine(value: unknown, max: number): string {
    if (typeof value !== "string") {
        return "";
    }
    return stripUnwanted(value.replace(/[\r\n\t]+/g, " ")).replace(/\s{2,}/g, " ").trim().slice(0, max).trim();
}

/** A text: lines kept, no strange characters, at most one empty line in a row, at most `maxLines` lines and `max` characters. */
export function cleanText(value: unknown, max: number, maxLines: number): string {
    if (typeof value !== "string") {
        return "";
    }
    const lines = stripUnwanted(value.replace(/\r\n?/g, "\n"))
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim());
    const kept: string[] = [];
    for (const line of lines) {
        if (line === "" && (kept.length === 0 || kept[kept.length - 1] === "")) {
            continue;
        }
        kept.push(line);
    }
    while (kept.length > 0 && kept[kept.length - 1] === "") {
        kept.pop();
    }
    return kept.slice(0, maxLines).join("\n").slice(0, max).trim();
}
