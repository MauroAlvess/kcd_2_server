/**
 * A character's age and height (user, 2026-11-02: "na criação de personagem vamos adicionar a opção de colocar idade, com limite de uma idade razoável
 * naquela época, tanto mínima quanto máxima; vamos colocar altura também, respeitando limites masculino e feminino"). Both are the character's own word
 * on itself, kept with its look (`characters.ts`) and shown in the panel's Personagem section: the game has no way to make a body taller or shorter,
 * so the height is said, not drawn.
 *
 * The limits are those of Bohemia in 1403 as a player can read them: an adult (18, also because the realm has marriages and families in it) up to an
 * old age a man of the time could reach (80); a man of 1.55 to 2.00 m and a woman of 1.45 to 1.85 m, around what the skeletons of the time say was
 * usual (some 1.70 m for a man and 1.60 m for a woman).
 */

export type Gender = "male" | "female";

export const AGE_LIMITS = { min: 18, max: 80 } as const;

/** In centimetres. */
export const HEIGHT_LIMITS: Readonly<Record<Gender, { readonly min: number; readonly max: number }>> = {
    male: { min: 155, max: 200 },
    female: { min: 145, max: 185 },
};

/** What the creator starts at for a character that has said neither. */
export const DEFAULT_DETAILS = { age: 25, height: { male: 172, female: 162 } } as const;

export interface CharacterDetails {
    readonly age: number;
    /** In centimetres. */
    readonly height: number;
}

/** An age a character may have, or null. */
export function cleanAge(value: unknown): number | null {
    return typeof value === "number" && Number.isInteger(value) && value >= AGE_LIMITS.min && value <= AGE_LIMITS.max ? value : null;
}

/** A height, in centimetres, a character of this gender may have, or null. */
export function cleanHeight(value: unknown, gender: Gender): number | null {
    const limits = HEIGHT_LIMITS[gender];
    return typeof value === "number" && Number.isInteger(value) && value >= limits.min && value <= limits.max ? value : null;
}

/** What the page shows and sends: "1,74 m". */
export function heightText(centimetres: number): string {
    return `${(centimetres / 100).toFixed(2).replace(".", ",")} m`;
}

/** What the creator page is told: the limits, and where it starts. */
export function detailsForPage(): Record<string, unknown> {
    return { age: AGE_LIMITS, height: HEIGHT_LIMITS, defaults: DEFAULT_DETAILS };
}

/** Whether a saved character has yet to say its age and height (made before they were asked: the creator asks at the next entry). */
export function lacksDetails(saved: { readonly age?: number; readonly height?: number } | null): boolean {
    return saved !== null && (typeof saved.age !== "number" || typeof saved.height !== "number");
}

/**
 * The character's level, as the Personagem section shows it (user, 2026-11-02: "o nível é a soma de todos os níveis dele"): the levels of every track
 * of the game's progression added up. Null when nothing is known of it.
 */
export function levelOf(progression: { readonly tracks?: Readonly<Record<string, { readonly level?: unknown }>> } | null | undefined): number | null {
    const tracks = progression?.tracks;
    if (tracks === undefined || tracks === null) {
        return null;
    }
    let sum = 0;
    let any = false;
    for (const track of Object.values(tracks)) {
        const level = track?.level;
        if (typeof level === "number" && Number.isFinite(level) && level >= 0) {
            sum += Math.floor(level);
            any = true;
        }
    }
    return any ? sum : null;
}
