/**
 * Which pieces of armour and clothing a body can wear together (2026-11-02, user: "os npcs bandidos a mais que você colocou estão invisíveis").
 *
 * The veterans and the chiefs of the bandit camps were never seen by anybody: the game of a player near one made the body, found that the lot
 * of armour it was to wear did not fit (`Body N inventory item X was displaced`), and rolled the whole body back (`Rolled back NPC N: the engine refused to dress
 * it in its spawn tick`, 67 times in the client log of 2026-10-29 to 2026-11-01, never once for a plain bandit or an archer, whose kit is tunic, hose and hood) -- while the
 * server went on shouting for them, throwing riders off their horses and hitting. The game's table of equipment slots (`Libs/Tables/item/equipment_slot.xml`) says
 * what fits with what: a helmet needs a padded or mail coif under it (`RequiresFilledSlot`), mail, a brigandine and arm armour need a gambeson (a padded garment)
 * under them, a cap needs the padded coif slot empty. And what the table does not say, the game's own 2,400 outfits (`Libs/Tables/item/clothing_preset.xml`) do: not one
 * of them puts a tunic with a gambeson, nor a cloth coif with a padded one (0 of 2,400), while every one of the 791 with a helmet has a padded coif under it. The
 * veterans' kit was a tunic AND a gambeson, and a helmet over a coif of cloth half the time.
 *
 * This is the table of those rules, a check for a list of items (`kitProblems`), the order to dress them in (`dressingOrder`: what a piece needs first), and the repair of a
 * list the game's tables would not take whole (`fitKit`). A kit that is put together from here on is checked against it, in the tests and before it is sent.
 */

export interface SlotRule {
    readonly slot: string;
    /** The game's armour types (`Libs/Tables/item/armor_type.xml`) that go in it: the item's name up to its first digit. */
    readonly types: readonly string[];
    /** The slot that must be filled under it. */
    readonly needs?: string;
    /** The slot that must be empty. */
    readonly without?: string;
}

export const SLOT_RULES: readonly SlotRule[] = [
    { slot: "head_coif", types: ["CoifCap"] },
    { slot: "head_coif_padded", types: ["CoifSmall", "CoifLarge", "CoifMail"] },
    { slot: "head_cap", types: ["Cap", "F_Hood", "F_Bonnet", "F_CapAndWimple", "F_Hat", "F_HoodOpen", "F_Veil", "F_VeilAndWimple", "LeatherCap"], without: "head_coif_padded" },
    { slot: "head_helmet", types: ["KettleHat", "SkullCap", "BascinetOpen", "BascinetVisor"], needs: "head_coif_padded" },
    { slot: "head_hood", types: ["Hood"] },
    { slot: "body_cloth", types: ["TunicShort", "TunicLong", "F_SimpleDress", "F_Smock", "LeatherApron"] },
    { slot: "body_cloth_padded", types: ["GambesonShort", "GambesonLong", "Caftan", "Pourpoint"] },
    { slot: "body_chainmail", types: ["MailShort", "MailLong"], needs: "body_cloth_padded" },
    { slot: "body_plate", types: ["Brigandine", "Cuirass"], needs: "body_cloth_padded" },
    // The arm brigandine's items are named `BrigandineArm...` (type ArmBrigandine): in 329 outfits, never with arm plates, and with a padded garment in all but two.
    { slot: "sleeves", types: ["ArmBrigandine", "BrigandineArm", "ArmPlate"], needs: "body_cloth_padded" },
    { slot: "body_coat", types: ["Coat", "Waffenrock", "Habit"] },
    { slot: "gloves", types: ["Gloves", "Gauntlets", "HandWrap"] },
    { slot: "leg_trousers", types: ["HoseJoined", "HoseLoose", "HoseSeparate"] },
    { slot: "leg_trousers_padded", types: ["LegsPadded", "LegsChain"] },
    { slot: "leg_armor", types: ["LegsBrigandine", "LegsPlate"], needs: "leg_trousers_padded" },
    { slot: "boot", types: ["BootsAnkle", "BootsKnee", "Shoes", "F_Shoes"] },
];

/**
 * Slots no body wears together although the table gives each its own, as [the lesser, the greater]: none of the game's 2,400 outfits with armour puts a tunic with a gambeson (the
 * body's cloth layer has the one or the other), nor a cap-coif with a padded one. A body given both loses one of them, and the game's dressing is refused; `fitKit` drops the lesser.
 */
export const EXCLUSIVE: ReadonlyArray<readonly [string, string]> = [
    ["body_cloth", "body_cloth_padded"],
    ["head_coif", "head_coif_padded"],
];

/** The game's armour type of an item, from its name: the letters up to the first digit (`KettleHat02_m01_D2` is `KettleHat`). */
export function armorTypeOf(name: string): string {
    const match = /^([A-Za-z_]+?)(?=\d)/.exec(name);
    return match?.[1] ?? name;
}

const SLOT_OF_TYPE = new Map<string, SlotRule>(SLOT_RULES.flatMap((rule) => rule.types.map((type): [string, SlotRule] => [type, rule])));

/** The slot an item of armour or clothing goes in, or null for an item that is not worn there (a weapon, an arrow, a coin). */
export function slotOf(name: string): string | null {
    return SLOT_OF_TYPE.get(armorTypeOf(name))?.slot ?? null;
}

const RULE_OF_SLOT = new Map<string, SlotRule>(SLOT_RULES.map((rule) => [rule.slot, rule]));

/** What is wrong with a list of items worn together: two in one slot, a slot whose base is missing, a slot that must be empty, a pair that is never worn together. Empty when it fits. */
export function kitProblems(names: readonly string[]): string[] {
    const problems: string[] = [];
    const bySlot = new Map<string, string>();
    for (const name of names) {
        const slot = slotOf(name);
        if (slot === null) {
            continue;
        }
        const other = bySlot.get(slot);
        if (other !== undefined) {
            problems.push(`${name} e ${other} disputam o encaixe ${slot}`);
        } else {
            bySlot.set(slot, name);
        }
    }
    for (const [slot, name] of bySlot) {
        const rule = RULE_OF_SLOT.get(slot);
        if (rule?.needs !== undefined && !bySlot.has(rule.needs)) {
            problems.push(`${name} (${slot}) pede ${rule.needs} por baixo`);
        }
        if (rule?.without !== undefined && bySlot.has(rule.without)) {
            problems.push(`${name} (${slot}) não vai com ${rule.without}`);
        }
    }
    for (const [first, second] of EXCLUSIVE) {
        if (bySlot.has(first) && bySlot.has(second)) {
            problems.push(`${bySlot.get(first)} e ${bySlot.get(second)} nunca são vestidos juntos`);
        }
    }
    return problems;
}

/** How many pieces a slot's base is under: 0 for a slot that needs nothing. */
function depthOf(slot: string, seen = 0): number {
    const needs = RULE_OF_SLOT.get(slot)?.needs;
    return needs === undefined || seen > 4 ? 0 : 1 + depthOf(needs, seen + 1);
}

/**
 * The order to dress a list of items in: what a piece needs under it comes first (the coif before the helmet, the gambeson before the mail, the brigandine and the arm armour),
 * everything else as it was. Not an item of armour or clothing (a weapon, an arrow) keeps its place among the rest.
 */
export function dressingOrder<T>(items: readonly T[], nameOf: (item: T) => string): T[] {
    const keyed = items.map((item, index) => ({ item, index, depth: depthOf(slotOf(nameOf(item)) ?? "") }));
    keyed.sort((a, b) => a.depth - b.depth || a.index - b.index);
    return keyed.map((entry) => entry.item);
}

/**
 * Makes a list fit: a piece that disputes a slot with an earlier one, whose base is missing, that must go without one that is there, or that is the lesser of a pair never worn
 * together (the tunic against the gambeson, the cloth coif against the padded one) is taken out, until nothing is wrong. Used on a kit once its names are known to the game (an
 * unknown piece leaves a hole), so that a missing coif does not leave a helmet to roll a whole body back. Returns what is kept and what was dropped.
 */
export function fitKit<T>(items: readonly T[], nameOf: (item: T) => string): { readonly kept: T[]; readonly dropped: T[] } {
    let kept = [...items];
    const dropped: T[] = [];
    for (let round = 0; round < 24; round += 1) {
        const slots = kept.map((item) => slotOf(nameOf(item)));
        const has = (slot: string): boolean => slots.includes(slot);
        const seen = new Set<string>();
        let remove = -1;
        for (let index = 0; index < kept.length && remove < 0; index += 1) {
            const slot = slots[index];
            if (slot === null || slot === undefined) {
                continue;
            }
            const rule = RULE_OF_SLOT.get(slot);
            if (seen.has(slot) || (rule?.needs !== undefined && !has(rule.needs)) || (rule?.without !== undefined && has(rule.without)) || EXCLUSIVE.some(([lesser, greater]) => slot === lesser && has(greater))) {
                remove = index;
            }
            seen.add(slot);
        }
        if (remove < 0) {
            break;
        }
        dropped.push(kept[remove] as T);
        kept = kept.filter((_item, index) => index !== remove);
    }
    return { kept, dropped };
}
