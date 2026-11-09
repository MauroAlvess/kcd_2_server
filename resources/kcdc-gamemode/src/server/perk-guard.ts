/**
 * Perks the server cannot brew with. The alchemy tables of a player who holds "Secrets of matter I" never open: every try
 * logs `[Crafting] Player N alchemy character unavailable: nativeModifierTieOrderRequired:f9de0477-...` (that GUID is this
 * perk), on KCDC 1.6.9 and on 1.6.10 alike -- the framework cannot work out the alchemy character with it (2026-10-17, two
 * players with the perk, nobody else affected). Until KCDC fixes it the perk and the one that stands on it are blocked on the
 * perk screen, and a saved character that has them is put back without them, the point each cost returned in its tree.
 *
 * 2026-10-18: a second one (user: "Luance e outros jogadores falaram que não estão conseguindo usar a bancada de alquimia").
 * Luance tried a table 56 times in three sessions and every try logged the same line with another GUID,
 * `ca293053-bcd4-49cc-9432-68d651b2b114`; the only perks of hers that nobody else holds are "Secrets of equilibrium I" and "II".
 * The GUIDs the framework names are kept in `BROKEN_PERK_GUIDS` and looked up in the game's own perk tables when the resource
 * starts (`Progression.findPerk`): the perk found, and every perk that stands on it, is added to the blocked ones. What was
 * found is said in the log, so that the guess about the name is read there, not taken on trust. It was read there on the first
 * start: `ca293053-...` is "Secrets of equilibrium I" (alchemy, buff), as guessed. Its "II" has nothing standing on it in the
 * tables (the Is and IIs of the alchemy tree are siblings, not parent and child), so the whole family -- every perk of the
 * alchemy tree called "Secrets of ..." -- is blocked by its name, which also covers the next one of them to be found.
 */

/**
 * Whether the guard is on. It was off from 2026-10-19 (user: "ative de volta as passivas de alquimia": the potions were to be brewed on
 * the trades page, never at the game's own table, so the framework's alchemy character these perks break would not be asked for), and
 * is on again since 2026-10-21 (user: "vamos desativar a alquimia de novo, não todas as passivas, mas tem uma que quebra a alquimia, já
 * vimos isso"): the page still hands the potion to the game's own alchemy table, which asks for that character, and the first night the
 * perks were free "Secrets of matter I" made it unavailable again for the one player who held it (17 tries in four minutes, every one
 * naming `f9de0477-2f59-4eec-b522-fa943f542277`). Only the family of perks that does this is blocked (the four by name below, and any
 * other "Secrets of ..." of the alchemy tree); the other passives of the tree are untouched. Switched off, it blocks nothing and takes
 * nothing off saved characters.
 */
export const perkGuard = { enabled: true };

/** What the framework's `nativeModifierTieOrderRequired:<guid>` has named so far (besides the perks below, known by name). */
export const BROKEN_PERK_GUIDS: ReadonlyArray<string> = ["ca293053-bcd4-49cc-9432-68d651b2b114", "f9de0477-2f59-4eec-b522-fa943f542277"];

interface Unsupported {
    readonly name: string;
    readonly track: string;
}

/** The perks, by name, and the tree whose point each one gives back. Grown at start by the GUIDs above. */
const unsupported: Unsupported[] = [
    { name: "Secrets of matter I", track: "alchemy" },
    { name: "Secrets of matter II", track: "alchemy" },
    { name: "Secrets of equilibrium I", track: "alchemy" },
    { name: "Secrets of equilibrium II", track: "alchemy" },
];

export const UNSUPPORTED_PERKS: ReadonlyArray<Unsupported> = unsupported;

/**
 * The passives too strong for a server of roleplay (user, 2026-11-01: "desativa essas passivas roubadas, deixe apenas Marbon com elas; os jogadores que a tinham, retire e
 * devolve os pontos"): the nine `PASSIVAS.md` calls "Forte demais" (`tools/perks-verdicts.py`), which take the weight of death, of the lock, of the armour or of the wound away.
 * They are blocked on everybody's perk screen; a saved character that holds one is put back without it and the point it cost given back in its tree. The keepers
 * (`STRONG_KEEPERS`) have all nine, handed over by `addPerk` a little after they come in (`giveStrongPerks`): a blocked perk is left out of `restoreProgression`, and `addPerk`
 * still grants it.
 */
export interface StrongPerk extends Unsupported {
    /** What the game's Portuguese calls it, for the chat. */
    readonly pt: string;
}

export const STRONG_PERKS: ReadonlyArray<StrongPerk> = [
    { name: "Hard to kill", track: "vitality", pt: "Duro de Matar" },
    { name: "Revenant II", track: "vitality", pt: "Ressuscitado II" },
    { name: "Runaway boy", track: "vitality", pt: "Velocidade de Hermes" },
    { name: "Clean cut", track: "weapon_sword", pt: "Fatiador de Tendões" },
    { name: "Sundering blow II", track: "heavy_weapons", pt: "Golpe Destruidor II" },
    { name: "Painkiller", track: "heavy_weapons", pt: "Golpe Abalador" },
    { name: "Ringenmeister", track: "weapon_unarmed", pt: "Mestre de Ringen" },
    { name: "Master thief", track: "thievery", pt: "Mestre-ladrão" },
    { name: "Zaklady bohoslovectvi meta", track: "scholarship", pt: "Teologia" },
];

/** Who keeps the nine, by Steam id: Marbon, the user's own character. */
export const STRONG_KEEPERS: ReadonlySet<string> = new Set(["76561198906140019"]);

/** Whether the strong passives are blocked. Switched off, nobody loses them. */
export const strongGuard = { enabled: true };

/** How long after a keeper's progression is restored the nine are handed over. */
export const KEEPER_GRANT_MS = 20_000;

/** The Portuguese name of a strong passive (its own name for any other). */
export function strongName(name: string): string {
    return STRONG_PERKS.find((one) => one.name === name)?.pt ?? name;
}

export interface Cleaned {
    readonly snapshot: ProgressionSnapshot;
    /** The perks that were taken out, a point given back for each. */
    readonly removed: string[];
    /** Of those, the strong passives (the others are the ones the alchemy tables cannot work with). */
    readonly strong: string[];
    /** The strong passives a keeper had: left out of what is restored, with no point back, and handed over again by `giveStrongPerks`. */
    readonly kept: string[];
}

/** A saved progression without the perks above and with their points back; the same object when it had none of them. `steamId` says whose it is (a keeper keeps the strong ones). */
export function cleanSnapshot(snapshot: ProgressionSnapshot, steamId = ""): Cleaned {
    const alchemy = perkGuard.enabled ? snapshot.perks.filter((perk) => unsupported.some((bad) => bad.name === perk)) : [];
    const held = strongGuard.enabled ? snapshot.perks.filter((perk) => STRONG_PERKS.some((one) => one.name === perk)) : [];
    const keeper = STRONG_KEEPERS.has(steamId);
    const strong = keeper ? [] : held;
    const kept = keeper ? held : [];
    const removed = [...alchemy, ...strong];
    if (removed.length === 0 && kept.length === 0) {
        return { snapshot, removed, strong, kept };
    }
    const perkPoints = { ...snapshot.perkPoints };
    for (const name of removed) {
        const track = unsupported.find((bad) => bad.name === name)?.track ?? STRONG_PERKS.find((one) => one.name === name)?.track ?? "main";
        perkPoints[track] = (perkPoints[track] ?? 0) + 1;
    }
    const out = new Set([...removed, ...kept]);
    return { snapshot: { ...snapshot, perks: snapshot.perks.filter((perk) => !out.has(perk)), perkPoints }, removed, strong, kept };
}

/** Whether this account keeps the strong passives. */
export function isStrongKeeper(steamId: string): boolean {
    return strongGuard.enabled && STRONG_KEEPERS.has(steamId);
}

/** Hands a keeper whichever of the nine their body does not have, by `addPerk`. How many the game took. */
export function giveStrongPerks(player: Player): number {
    if (!isStrongKeeper(player.steamId)) {
        return 0;
    }
    let live: string[] = [];
    try {
        live = [...player.perks];
    } catch {
        // Read as none: every one is asked for.
    }
    let given = 0;
    for (const one of STRONG_PERKS) {
        if (live.includes(one.name)) {
            continue;
        }
        try {
            if (player.addPerk(one.name)) {
                given += 1;
            } else {
                console.log(`perks: o jogo não aceitou ${one.name} para ${player.nickname}`);
            }
        } catch (error: unknown) {
            console.log(`perks: o jogo não aceitou ${one.name} para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    console.log(`perks: ${player.nickname} fica com as passivas fortes (${given} dada(s) agora, ${STRONG_PERKS.length - given} já tinha ou o jogo recusou)`);
    return given;
}

/** Every perk that stands on this one, however far down the tree (a perk's `parent` is what has to be owned first). */
function standingOn(root: PerkInfo): PerkInfo[] {
    const everything = Progression.perks();
    const found: PerkInfo[] = [];
    const known = new Set([root.name, root.id]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const candidate of everything) {
            if (candidate.parent !== null && known.has(candidate.parent) && !known.has(candidate.name)) {
                found.push(candidate);
                known.add(candidate.name);
                known.add(candidate.id);
                grew = true;
            }
        }
    }
    return found;
}

/** Looks each GUID up in the game's perk tables and adds what it finds, with the perks standing on it. The names added. */
export function resolveBrokenPerks(guids: ReadonlyArray<string> = BROKEN_PERK_GUIDS): string[] {
    const added: string[] = [];
    for (const guid of guids) {
        try {
            const perk = Progression.findPerk(guid);
            if (perk === null) {
                console.log(`perks: ${guid} não é um talento que as tabelas do jogo conheçam: nada a bloquear por ele`);
                continue;
            }
            if (perk.visibility === "system" || perk.visibility === "obsolete") {
                console.log(`perks: ${guid} é "${perk.name}", um talento ${perk.visibility === "system" ? "de sistema" : "obsoleto"}: não o bloqueio`);
                continue;
            }
            const family = [perk, ...standingOn(perk)];
            for (const one of family) {
                if (!unsupported.some((bad) => bad.name === one.name)) {
                    unsupported.push({ name: one.name, track: one.track ?? "main" });
                    added.push(one.name);
                }
            }
            console.log(`perks: ${guid} é "${perk.name}" (${perk.track ?? "sem árvore"}, ${perk.kinds.join("/") || "sem efeito próprio"}); bloqueado${family.length > 1 ? ` junto com ${family.slice(1).map((one) => `"${one.name}"`).join(", ")}` : ""}`);
        } catch (error: unknown) {
            console.log(`perks: não consegui procurar ${guid} nas tabelas do jogo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return added;
}

/** The family of the perks the alchemy character cannot be worked out with: "Secrets of matter I", "... II", "Secrets of equilibrium I", "... II". */
const FAMILY = /^Secrets of /;

/** The alchemy tree as the game's tables have it, once in the log; and every perk of it that belongs to the family, blocked. */
function blockAlchemyFamily(): void {
    try {
        const tree = Progression.perks({ track: "alchemy" });
        console.log(`perks: árvore da alquimia (${tree.length}): ${tree.slice(0, 60).map((perk) => `${perk.name}${perk.parent === null ? "" : ` <- ${perk.parent}`} [${perk.kinds.join("/") || "-"}]`).join("; ")}`);
        for (const perk of tree) {
            if (FAMILY.test(perk.name) && perk.visibility !== "system" && perk.visibility !== "obsolete" && !unsupported.some((bad) => bad.name === perk.name)) {
                unsupported.push({ name: perk.name, track: perk.track ?? "alchemy" });
                console.log(`perks: "${perk.name}" é da família "Secrets of ...", que as mesas de alquimia não aguentam: bloqueado`);
            }
        }
    } catch (error: unknown) {
        console.log(`perks: não consegui ler a árvore da alquimia: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function installPerkGuard(): void {
    const names: string[] = [];
    if (perkGuard.enabled) {
        resolveBrokenPerks();
        blockAlchemyFamily();
        names.push(...unsupported.map((bad) => bad.name));
    } else {
        console.log("perks: as passivas de alquimia (Secrets of ...) estão liberadas: a alquimia é feita na página dos ofícios, não na mesa do jogo");
    }
    if (strongGuard.enabled) {
        names.push(...STRONG_PERKS.map((one) => one.name));
        console.log(`perks: passivas fortes demais bloqueadas para todos (${STRONG_PERKS.map((one) => one.pt).join(", ")}); quem as tinha recebe o ponto de volta ao entrar; ${STRONG_KEEPERS.size} conta(s) fica(m) com elas`);
    }
    if (names.length === 0) {
        return;
    }
    try {
        // What the server already blocks is kept.
        Progression.blockPerks([...new Set([...Progression.blockedPerks, ...names])]);
    } catch (error: unknown) {
        console.log(`perks: não consegui bloquear ${names.join(", ")}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
