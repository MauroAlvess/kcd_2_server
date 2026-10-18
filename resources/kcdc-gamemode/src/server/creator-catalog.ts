/**
 * What the character creator offers, picked out of the game's whole appearance catalog (`Appearances`).
 *
 * The catalog has 212 faces, 262 hairstyles and 47 skins for a man, and most of them are somebody: a face made for one
 * of the game's characters, a hairstyle named after a lord, a skin that is a corpse or a wound. The creator offers the
 * ones made to be worn: the generic faces, the generic and the barber's hairstyles (each in its colours), a handful of
 * skins, and the beards a face can actually grow. Women have far fewer, so all their hairstyles are offered.
 *
 * The page never sees a name of the game's: it holds numbers (the nth face, the nth style in its nth colour) and the
 * server turns them into names. An out-of-range number is refused, which is also all the checking a look needs.
 */

export type Gender = "male" | "female";

/** The colours the game ships a hairstyle in, in the order the swatches are shown. */
export const TONES = ["black", "dark_brown", "light_brown", "dark_ginger", "ginger", "blonde", "dark_grey", "grey", "white"] as const;
export type Tone = (typeof TONES)[number];

/** A hairstyle: the name of each of its colours, or just the one name of a style that has no colours. */
export interface HairStyle {
    /** The colours it comes in, as `TONES` names, and the game's name for each. Empty for a style with a single look. */
    readonly colours: readonly { readonly tone: Tone; readonly name: string }[];
    /** What to put on when the style has no colours (or none of them is chosen). */
    readonly base: string;
}

export interface GenderCatalog {
    readonly heads: readonly string[];
    readonly skins: readonly string[];
    readonly hairs: readonly HairStyle[];
    /** For each face, the beards it can grow (never more than the generic ones and the barber's); empty for none. */
    readonly beards: readonly (readonly string[])[];
}

export interface Catalog {
    readonly male: GenderCatalog;
    readonly female: GenderCatalog;
}

/** A look as the page holds it: numbers only. `beard` and `tone` are -1 where the part has no choice. */
export interface PickedLook {
    readonly gender: Gender;
    readonly head: number;
    readonly hair: number;
    readonly tone: number;
    readonly beard: number;
    readonly skin: number;
}

/** The part of the framework's `Appearances` this reads, so it can be tested without the game. */
export interface AppearancesLike {
    options(part: "body" | "head" | "hair" | "beard", gender?: Gender): readonly { readonly name: string; readonly group: string | null }[];
    beards(head?: string, gender?: Gender): readonly { readonly name: string }[];
}

const HEAD = { male: /^m_head_\d{3}$/, female: /^f_head_\d{3}$/ } as const;
const SKIN = { male: /^m_body_(pale|tan|roma)_\d{2}$/, female: /^(f_body_(pale|tan)_\d{2}|f_roma_\d{2})$/ } as const;
/** The styles made to be worn: x_hair_NN (men's generic), the monk's tonsures and the barber's; women's generic ones and four named ones. */
const HAIR_GROUP = { male: /^(x_hair_\d{2}|x_hair_monk_\d{2}|m_hair_barber_\d{2})$/, female: /^(f_hair_\d{3}|f_hair_(katherine|miriam|mother|rose))$/ } as const;
const BEARD = /^(m_beard_\d{2}|UC_beard_barber_\d{2})$/;

function toneOf(name: string): Tone | null {
    for (const tone of TONES) {
        if (name.endsWith(`_${tone}`)) {
            return tone;
        }
    }
    return null;
}

function byName(a: { readonly name: string }, b: { readonly name: string }): number {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function buildGender(api: AppearancesLike, gender: Gender): GenderCatalog {
    const heads = api
        .options("head", gender)
        .map((option) => option.name)
        .filter((name) => HEAD[gender].test(name))
        .sort();
    const skins = api
        .options("body", gender)
        .map((option) => option.name)
        .filter((name) => SKIN[gender].test(name))
        .sort();

    const groups = new Map<string, { name: string; group: string | null }[]>();
    for (const option of api.options("hair", gender)) {
        const id = option.group ?? option.name;
        if (HAIR_GROUP[gender].test(id)) {
            groups.set(id, [...(groups.get(id) ?? []), { name: option.name, group: option.group }]);
        }
    }
    const hairs: HairStyle[] = [...groups.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([id, options]) => {
            const coloured = options
                .map((option) => ({ name: option.name, tone: toneOf(option.name) }))
                .filter((entry): entry is { name: string; tone: Tone } => entry.tone !== null);
            const colours = TONES.flatMap((tone) => coloured.filter((entry) => entry.tone === tone).sort(byName).slice(0, 1));
            const base = options.some((option) => option.name === id) ? id : (options[0]?.name ?? id);
            return { colours, base };
        });

    // Beards: what each face can grow, minus the ones made for the game's own characters.
    const beards = gender === "male" ? heads.map((head) => api.beards(head, gender).map((option) => option.name).filter((name) => BEARD.test(name)).sort()) : heads.map(() => []);
    return { heads, skins, hairs, beards };
}

export function buildCatalog(api: AppearancesLike): Catalog {
    return { male: buildGender(api, "male"), female: buildGender(api, "female") };
}

/** What the page is sent: how many of each, never a name of the game's. */
export function pageCatalog(catalog: Catalog): Record<Gender, { heads: number; skins: number; hairs: string[][]; beards: number[] }> {
    const shape = (part: GenderCatalog) => ({
        heads: part.heads.length,
        skins: part.skins.length,
        hairs: part.hairs.map((style) => style.colours.map((colour) => colour.tone)),
        beards: part.beards.map((list) => list.length),
    });
    return { male: shape(catalog.male), female: shape(catalog.female) };
}

function inRange(value: unknown, count: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;
}

/**
 * The look the page asked for, in the game's names, or null when anything in it is out of range. `genders` is what the
 * creator was opened for ("both", or one of them).
 */
export function resolveLook(catalog: Catalog, picked: unknown, genders: Gender | "both" = "both"): Appearance | null {
    if (typeof picked !== "object" || picked === null) {
        return null;
    }
    const fields = picked as Record<string, unknown>;
    const gender = fields["gender"];
    if ((gender !== "male" && gender !== "female") || (genders !== "both" && genders !== gender)) {
        return null;
    }
    const part = catalog[gender];
    const head = fields["head"];
    const hair = fields["hair"];
    const skin = fields["skin"];
    if (!inRange(head, part.heads.length) || !inRange(hair, part.hairs.length) || !inRange(skin, part.skins.length)) {
        return null;
    }
    const style = part.hairs[hair]!;
    const tone = fields["tone"];
    let hairName = style.base;
    if (style.colours.length > 0) {
        if (!inRange(tone, style.colours.length)) {
            return null;
        }
        hairName = style.colours[tone]!.name;
    }
    const growable = part.beards[head]!;
    const beard = fields["beard"];
    let beardName = "";
    if (growable.length > 0 && beard !== -1) {
        if (!inRange(beard, growable.length)) {
            return null;
        }
        beardName = growable[beard]!;
    }
    return { gender, head: part.heads[head]!, hair: hairName, beard: beardName, body: part.skins[skin]! };
}

/**
 * The page's numbers for a look the game's names say, as far as the catalog has them; a part it has not (a face or a
 * hairstyle of the game's own people) is the first of the catalog. `random` picks where there is nothing to go by.
 */
export function pickedFrom(catalog: Catalog, look: Partial<Appearance> | null, genders: Gender | "both", random: () => number): PickedLook {
    const wanted: Gender = look?.gender === "female" ? "female" : "male";
    const gender: Gender = genders === "both" ? wanted : genders;
    const part = catalog[gender];
    const pickAt = (count: number): number => Math.min(count - 1, Math.floor(random() * count));
    const fresh = look === null || look.gender !== gender;

    const at = (names: readonly string[], name: string | undefined): number => (name === undefined || name === "" ? -1 : names.indexOf(name));
    let head = fresh ? -1 : at(part.heads, look?.head);
    if (head < 0) {
        head = pickAt(part.heads.length);
    }
    let skin = fresh ? -1 : at(part.skins, look?.body);
    if (skin < 0) {
        skin = pickAt(part.skins.length);
    }

    let hair = -1;
    let tone = -1;
    const wornHair = fresh ? "" : (look?.hair ?? "");
    if (wornHair !== "") {
        part.hairs.forEach((style, index) => {
            if (hair >= 0) {
                return;
            }
            const colour = style.colours.findIndex((candidate) => candidate.name === wornHair);
            if (colour >= 0) {
                hair = index;
                tone = colour;
            } else if (style.colours.length === 0 && style.base === wornHair) {
                hair = index;
            }
        });
    }
    if (hair < 0) {
        hair = pickAt(part.hairs.length);
    }
    const colours = part.hairs[hair]!.colours.length;
    if (colours === 0) {
        tone = -1;
    } else if (tone < 0) {
        tone = pickAt(colours);
    }

    const growable = part.beards[head]!;
    let beard = -1;
    if (growable.length > 0) {
        const have = fresh ? -1 : at(growable, look?.beard);
        beard = have >= 0 ? have : fresh && gender === "male" && random() < 0.4 ? pickAt(growable.length) : -1;
    }
    return { gender, head, hair, tone, beard, skin };
}
