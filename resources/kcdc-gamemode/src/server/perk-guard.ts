/**
 * Perks the server cannot brew with. The alchemy tables of a player who holds "Secrets of matter I" never open: every try
 * logs `[Crafting] Player N alchemy character unavailable: nativeModifierTieOrderRequired:f9de0477-...` (that GUID is this
 * perk), on KCDC 1.6.9 and on 1.6.10 alike -- the framework cannot work out the alchemy character with it (2026-10-17, two
 * players with the perk, nobody else affected). Until KCDC fixes it the perk and the one that stands on it are blocked on the
 * perk screen, and a saved character that has them is put back without them, the point each cost returned in its tree.
 */

/** The perks, by name, and the tree whose point each one gives back. */
export const UNSUPPORTED_PERKS: ReadonlyArray<{ readonly name: string; readonly track: string }> = [
    { name: "Secrets of matter I", track: "alchemy" },
    { name: "Secrets of matter II", track: "alchemy" },
];

export interface Cleaned {
    readonly snapshot: ProgressionSnapshot;
    /** The perks that were taken out. */
    readonly removed: string[];
}

/** A saved progression without the perks above and with their points back; the same object when it had none of them. */
export function cleanSnapshot(snapshot: ProgressionSnapshot): Cleaned {
    const removed = snapshot.perks.filter((perk) => UNSUPPORTED_PERKS.some((bad) => bad.name === perk));
    if (removed.length === 0) {
        return { snapshot, removed };
    }
    const perkPoints = { ...snapshot.perkPoints };
    for (const name of removed) {
        const track = UNSUPPORTED_PERKS.find((bad) => bad.name === name)?.track ?? "main";
        perkPoints[track] = (perkPoints[track] ?? 0) + 1;
    }
    return { snapshot: { ...snapshot, perks: snapshot.perks.filter((perk) => !removed.includes(perk)), perkPoints }, removed };
}

export function installPerkGuard(): void {
    try {
        Progression.blockPerks(UNSUPPORTED_PERKS.map((bad) => bad.name));
    } catch (error: unknown) {
        console.log(`perks: não consegui bloquear ${UNSUPPORTED_PERKS.map((bad) => bad.name).join(", ")}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
