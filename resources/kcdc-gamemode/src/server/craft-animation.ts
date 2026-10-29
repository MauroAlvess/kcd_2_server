/**
 * What a player does with their hands while a trade's work is done (`craft.ts`): the game's own work, as its craftsmen do it.
 *
 * Since 2026-10-25 (user: "ao selecionar um item passar para a animação de forja do vanilla"; the same for alchemy, cooking, smoking and
 * drying) a piece of work is a routine of the game's own fragments laid over its time, with the tools in the hands and the body turned to
 * the station (`ROUTINES`): at the forge the game's smith takes the blade, heats it at the hearth with the bellows, hammers it on the anvil
 * and quenches it (`BlacksmithBehavior*`, hammer in the right hand and the blade in the left while it is hammered); at a fire the cook stirs the
 * cauldron with the ladle, or the pot over an open fire (`Cooking`, `campfire`), a scoop in hand while it is stirred; at the alchemy table the base goes into the pot and then the
 * herbs (`AlchemyPutBasis`, `AlchemyPutSpecialIngredience`), and a woman grinds at the mortar (`ApothecaryMortar`, authored for her body); the
 * smokehouse and the rack are the game's own player animations there. Each fragment's own sounds are the craftsman's: anvil, bellows, pot.
 *
 * The game's own minigames are not these. The anvil's and the alchemy table's run only on the game's own E at its own stations, for the
 * game's own recipes, and twice they left a player stuck in a screen under ours (forge 2026-10-22, table 2026-10-24); no script can open
 * them on a recipe chosen elsewhere.
 *
 * A trade with no routine, a body the routine was not authored for, or a catalog that lacks its middle part plays the trade's one animation as
 * before: first the very one the game plays the player at that place (`FRAGMENTS`), when the catalog (`Animations.list`) has it; else one
 * looked for by the words of each trade; else the game's own played by name. What was picked is written to the log once, so it can be
 * changed by name.
 */

import { lowerTorch } from "./torch-down.js";

/**
 * The game's own: the smokehouse's `player_useSmokehouse` (`so_smokehouse.xml`), whose drying is the rack's too, and for the fire
 * the cooks' stirring of the pot with the ladle (`Cooking`, what the game's NPCs play at a fire).
 *
 * The fire played the player's own kitchen pan (`CookingPanKitchen`, from `so_fireplace.xml`) until 2026-10-18 evening: its
 * animation fires `special_player_cooking` (`event:/special/player_cooking`), a sound the game plays in the player's head while
 * they cook. Played on a body here it plays on every client, so everybody heard it wherever they were (user: "se um jogador
 * cozinha, independente de onde você estiver, você vai escutar o som"). The NPCs' `Cooking` makes only the pot's and the ladle's
 * noises, which the game lets carry 10 m.
 */
const FRAGMENTS: Readonly<Record<string, readonly string[]>> = {
    fogo: ["Cooking"],
    defumador: ["SmokehouseSniff", "Drying"],
    secador: ["Drying"],
    // The alchemy table (2026-10-24, brewed on the page): what the game plays the player at its own table, putting the base in and then the herbs.
    alquimia: ["AlchemyPutBasis", "AlchemyPutSpecialIngredience"],
    // The Coletores (2026-10-21, `gather.ts`): the woodcutters' felling at a tree and the stonemasons' pick, from the game's male database
    // (`kcd_male_database.adb`: `LumberJackCuttingTree`, a loop with its variations; `StonemasonPick`).
    lenha: ["LumberJackCuttingTree", "LumberJackCut"],
    mina: ["StonemasonPick", "StonemasonPickSoft", "StonemasonChisel"],
};

/**
 * The tool put in the hand for a work, by the game's prop name, the first the catalog has (`Animations.props()`): the lumberjack's axe and
 * a pick, whatever grip the catalog says the animation has, for a fragment played by name has none (neither `LumberJackCuttingTree` nor
 * `StonemasonPick` names a hand: the game's own NPCs pick their tool up in the fragments before them).
 *
 * The pick is the knight's own, `axeBattle03` (the one the Coletores carry, a weapon the game always has loaded), before the miner's `pick`
 * (`mining/pick.cgf`): that one was played with the work on 2026-10-22 and was not seen in the hands (user: "na animação de minerar a
 * picareta deve aparecer nas mãos do jogador").
 */
const PROPS: Readonly<Record<string, readonly string[]>> = {
    lenha: ["lumberjack_axe", "axe_chopping", "lumberjack_axe_big"],
    mina: ["axeBattle03", "pick", "pick_a"],
};

/** The prop each trade was given the first time, written to the log once. */
const propLogged = new Set<string>();

/**
 * Fragments never played for anybody's work: their animation fires a sound the game meant for the player alone, heard at full
 * volume by every client that plays it (the kitchen pan's cooking, the camp pan's eating from the kettle, the laundry's washing). Lower case.
 */
export const PLAYER_ONLY_SOUND = new Set(["cookingpankitchen", "cookingpancamp", "laundrywash"]);

const quiet = (row: AnimationInfo): boolean => !PLAYER_ONLY_SOUND.has(row.fragment.toLowerCase());

const SEARCHES: Readonly<Record<string, readonly string[]>> = {
    fogo: ["cook", "stir", "roast", "pot"],
    defumador: ["cook", "hang", "pot"],
    secador: ["herb", "sort", "crush", "cook"],
    alquimia: ["alchemy", "herb", "crush", "sort"],
    forja: ["anvil", "hammer", "smith", "forge", "repair"],
    costura: ["sew", "needle", "stitch", "tailor", "knit", "mend", "repair"],
    lenha: ["lumberjack", "chop", "woodcut"],
    mina: ["stonemason", "pickaxe", "chisel"],
};

const chosen = new Map<string, AnimationInfo | null>();

/** The animation a trade plays, or null when the catalog has none that fits. */
export function pickWorkAnimation(trade: string): AnimationInfo | null {
    const known = chosen.get(trade);
    if (known !== undefined) {
        return known;
    }
    let best: AnimationInfo | null = null;
    try {
        for (const fragment of FRAGMENTS[trade] ?? []) {
            const rows = Animations.list(fragment).filter((row) => row.fragment.toLowerCase() === fragment.toLowerCase() && quiet(row));
            best = rows.find((row) => row.male && row.female) ?? rows[0] ?? null;
            if (best !== null) {
                console.log(`craft: animação de ${trade}: '${best.fragment}' (${best.tags || "sem tags"}), a do próprio jogo nesse lugar`);
                chosen.set(trade, best);
                return best;
            }
        }
        for (const word of SEARCHES[trade] ?? []) {
            const rows = Animations.list(word).filter(quiet);
            if (rows.length === 0) {
                continue;
            }
            const fitting = rows.filter((row) => row.male && row.female);
            best = fitting.find((row) => row.fullBody && !row.oneShot) ?? fitting[0] ?? rows[0] ?? null;
            if (best !== null) {
                console.log(`craft: animação de ${trade}: '${best.fragment}' (${best.tags || "sem tags"}), achada por '${word}' entre ${rows.length}; outras: ${rows.slice(0, 8).map((row) => row.fragment).join(", ")}`);
                break;
            }
        }
        const own = FRAGMENTS[trade]?.find((fragment) => !PLAYER_ONLY_SOUND.has(fragment.toLowerCase()));
        if (best === null && own !== undefined) {
            // Not in the catalog, which lists what the game plays on people; the body may still know it.
            best = { fragment: own, tags: "", duration: 0, oneShot: false, fullBody: true, rightHand: "", leftHand: "", male: true, female: true, sequence: "" } as AnimationInfo;
            console.log(`craft: animação de ${trade}: '${own}' pelo nome (fora do catálogo)`);
        } else if (best === null) {
            console.log(`craft: o catálogo de animações não tem nada para ${trade}; o trabalho não toca animação`);
        }
    } catch (error: unknown) {
        console.log(`craft: não consegui procurar a animação de ${trade}: ${error instanceof Error ? error.message : String(error)}`);
    }
    chosen.set(trade, best);
    return best;
}

// ---------------------------------------------------------------------------------------------
// The routines: the game's own work, step by step.

interface Step {
    /** The fragment, as the catalog names it. */
    readonly fragment: string;
    /** A tag the variant carries (`campfire`, `alchemyPot`); the plain variant when the catalog has none with it. */
    readonly tag?: string;
    /** The middle of the work: it repeats for this share of the time the steps that play once leave. A step without it plays once. */
    readonly share?: number;
    /** A way in that a short piece of work leaves out (the forge's heating). */
    readonly lead?: boolean;
    /** The tools in the hands, by the catalog's prop names (`Animations.props()`). */
    readonly right?: string;
    readonly left?: string;
}

interface Routine {
    /** For a man's body, and for a woman's when it has no list of its own and the catalog has the fragments for her. */
    readonly steps: readonly Step[];
    readonly female?: readonly Step[];
}

const HAMMER = "big_blacksmith_hammer";
const BLADE = "semifinished_sword";
const SCOOP = "wooden_scoop";
const HERBS = "herb_coltsfoot";

/**
 * The routines, by trade; the fire's open-fire variant is `fogo:campfire`. The fragments are the game's (`Animations/Mannequin/ADB/kcd_male_database.adb`,
 * `wh_female_database.adb`).
 *
 * THE TOOLS ARE IN THE HANDS ONLY WHERE THE CLIP HAS NO HAND-OVER EVENT. The game's smith and cook take their hammer, blade and scoop from a slot
 * of their station and put them back in it, by events inside the clips (`pickup pickupHammer,hammerSlot,Right`, `place placeHammer,hammerSlot,
 * Right,true`, `place placeSword,swordSlot,Left,true`, `place,scoopSlot,Right,true`). A player has no such slot, and a prop in the hand of the
 * one who plays the clip was let go of by the `place` and left hanging in the air (user, 2026-10-25: "na animação do ferreiro fica um martelo
 * flutuando na hora de forjar"). So the hammer and the blade are in the hands for the hammering (`BlacksmithBehaviorForgingLoop`, which has no
 * such event) and the scoop for the stirring (`Cooking`); the heating, the way in and the quench are played with empty hands.
 */
const ROUTINES: Readonly<Record<string, Routine>> = {
    forja: {
        steps: [
            { fragment: "BlacksmithBehaviorHeatingIn", lead: true },
            { fragment: "BlacksmithBehaviorHeatingLoop", lead: true, share: 1 },
            { fragment: "BlacksmithBehaviorHeatingToForging", lead: true },
            { fragment: "BlacksmithBehaviorForgingLoop", share: 3, right: HAMMER, left: BLADE },
            { fragment: "BlacksmithBehaviorForgingOut" },
        ],
    },
    fogo: {
        steps: [
            { fragment: "CookingIn", lead: true },
            { fragment: "Cooking", share: 1, right: SCOOP },
            { fragment: "CookingOut" },
        ],
    },
    "fogo:campfire": {
        steps: [
            { fragment: "CookingIn", tag: "campfire", lead: true },
            { fragment: "Cooking", tag: "campfire", share: 1, right: SCOOP },
            { fragment: "CookingOut", tag: "campfire" },
        ],
    },
    alquimia: {
        steps: [
            { fragment: "AlchemyPutBasis", tag: "alchemyPot", lead: true, right: "flask" },
            { fragment: "AlchemyPutSpecialIngredience", tag: "alchemyPot", share: 1, right: HERBS },
        ],
        female: [
            { fragment: "ApothecaryMortarIn", lead: true },
            { fragment: "ApothecaryMortar", share: 1, right: "pestle", left: "mortar" },
            { fragment: "ApothecaryMortarOut" },
        ],
    },
    defumador: { steps: [{ fragment: "SmokehouseSniff", share: 1 }] },
    secador: { steps: [{ fragment: "Drying", share: 1, right: HERBS }] },
    costura: {
        steps: [
            { fragment: "TailorPatternIn", lead: true },
            { fragment: "TailorPattern", share: 1 },
            { fragment: "TailorPatternOut" },
        ],
    },
};

/** One step as it will be played: its row of the catalog and how long. */
export interface PlannedStep {
    readonly fragment: string;
    readonly tags: string;
    readonly loop: boolean;
    readonly ms: number;
    readonly right?: string;
    readonly left?: string;
}

/** A step that plays once and the catalog gives no length for lasts this long. */
const ONCE_FALLBACK_S = 3;

/** The steps that play once may take at most this share of a piece of work; past it, the ways in are left out. */
const ONCE_SHARE = 0.6;

/** The catalog's row for a step, for the body it is played on. */
function rowFor(step: Step, female: boolean): AnimationInfo | null {
    const rows = Animations.list(step.fragment).filter((row) => row.fragment.toLowerCase() === step.fragment.toLowerCase() && quiet(row) && (female ? row.female : row.male));
    if (step.tag !== undefined) {
        const tagged = rows.find((row) => row.tags.split("+").includes(step.tag as string));
        if (tagged !== undefined) {
            return tagged;
        }
    }
    return rows.find((row) => row.tags === "") ?? rows[0] ?? null;
}

const planned = new Map<string, readonly { readonly step: Step; readonly row: AnimationInfo }[] | null>();

/** A trade's routine for a body, as the catalog has it: null when it has no routine, or the catalog lacks its middle part. */
function routineFor(key: string, female: boolean): readonly { readonly step: Step; readonly row: AnimationInfo }[] | null {
    const cacheKey = `${key}:${female ? "f" : "m"}`;
    const known = planned.get(cacheKey);
    if (known !== undefined) {
        return known;
    }
    const routine = ROUTINES[key];
    const steps = routine === undefined ? null : female ? (routine.female ?? routine.steps) : routine.steps;
    let found: { step: Step; row: AnimationInfo }[] | null = null;
    try {
        if (steps !== null) {
            const rows = steps.map((step) => ({ step, row: rowFor(step, female) }));
            const middle = rows.filter((entry) => entry.step.share !== undefined && entry.step.lead !== true);
            if (middle.length > 0 && middle.every((entry) => entry.row !== null)) {
                found = rows.filter((entry): entry is { step: Step; row: AnimationInfo } => entry.row !== null);
            }
            console.log(
                `craft: rotina de ${key} (${female ? "mulher" : "homem"}): ${
                    found === null
                        ? `o catálogo não tem ${steps.filter((_, index) => rows[index]?.row === null).map((step) => step.fragment).join(", ")}; fica a animação de antes`
                        : found.map((entry) => `${entry.row.fragment}${entry.row.tags ? `[${entry.row.tags}]` : ""} ${entry.step.share !== undefined ? "(repete)" : `${entry.row.duration.toFixed(1)} s`}${entry.step.right ? ` d:${entry.step.right}` : ""}${entry.step.left ? ` e:${entry.step.left}` : ""}`).join(" > ")
                }`,
            );
        }
    } catch (error: unknown) {
        console.log(`craft: não consegui montar a rotina de ${key}: ${error instanceof Error ? error.message : String(error)}`);
        found = null;
    }
    planned.set(cacheKey, found);
    return found;
}

/**
 * Lays a routine over a piece of work of `totalMs`: the steps that play once take their own length, the middle ones share what is left.
 * When the steps that play once would take more than `ONCE_SHARE` of the time, the ways in are left out, and then the way out.
 */
export function layOut(steps: readonly { readonly step: Step; readonly row: AnimationInfo }[], totalMs: number): PlannedStep[] {
    const onceMs = (entry: { readonly step: Step; readonly row: AnimationInfo }): number => (entry.step.share !== undefined ? 0 : Math.max(0.5, entry.row.duration > 0 ? entry.row.duration : ONCE_FALLBACK_S) * 1000);
    const sumOnce = (list: readonly { readonly step: Step; readonly row: AnimationInfo }[]): number => list.reduce((sum, entry) => sum + onceMs(entry), 0);
    let kept = [...steps];
    if (sumOnce(kept) > totalMs * ONCE_SHARE) {
        kept = kept.filter((entry) => entry.step.lead !== true);
    }
    if (sumOnce(kept) > totalMs * ONCE_SHARE) {
        kept = kept.filter((entry) => entry.step.share !== undefined);
    }
    const left = Math.max(0, totalMs - sumOnce(kept));
    const shares = kept.reduce((sum, entry) => sum + (entry.step.share ?? 0), 0);
    return kept.map((entry) => ({
        fragment: entry.row.fragment,
        tags: entry.row.tags,
        loop: entry.step.share !== undefined,
        ms: entry.step.share !== undefined ? (shares > 0 ? (left * entry.step.share) / shares : left) : onceMs(entry),
        ...(entry.step.right === undefined ? {} : { right: entry.step.right }),
        ...(entry.step.left === undefined ? {} : { left: entry.step.left }),
    }));
}

/** Where and how a piece of work is done, as the caller knows it. */
export interface WorkOptions {
    /** How long it lasts: the routine is laid over it. Without it, the trade's one animation plays until stopped. */
    readonly ms?: number;
    /** The station, for the body to face it. */
    readonly point?: { readonly x: number; readonly y: number; readonly z: number } | null;
    /** An open fire rather than a cauldron. */
    readonly campfire?: boolean;
    /** A woman's body: some of the game's work is authored only for a man's. */
    readonly female?: boolean;
}

/** The body is turned to the station when it faces more than this away from it, in degrees. */
const TURN_FROM_DEG = 30;

/** After a turn the work waits this long, so the turn does not cut its first animation. */
const AFTER_TURN_MS = 300;

/** The timers of each player's routine, by player id. */
const runs = new Map<number, ReturnType<typeof setTimeout>[]>();

/** The props of a step, by name, as the catalog has them; the ones it lacks are left out. */
function propsOf(step: PlannedStep): { item: string; hand: "right" | "left" }[] {
    const wanted: { item: string; hand: "right" | "left" }[] = [];
    if (step.right === undefined && step.left === undefined) {
        return wanted;
    }
    const catalog = new Set(Animations.props().map((entry) => entry.name));
    if (step.right !== undefined && catalog.has(step.right)) {
        wanted.push({ item: step.right, hand: "right" });
    }
    if (step.left !== undefined && catalog.has(step.left)) {
        wanted.push({ item: step.left, hand: "left" });
    }
    return wanted;
}

function playStep(player: Player, step: PlannedStep): boolean {
    try {
        const props = propsOf(step);
        return player.playAnimation(step.fragment, { tags: step.tags, loop: step.loop, lockMovement: true, ...(props.length === 0 ? {} : { props }) });
    } catch (error: unknown) {
        console.log(`craft: ${step.fragment} não tocou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** The way a body faces, in degrees about the vertical (0 along +Y, as `player.spawn` takes it), from its rotation. */
function headingOf(rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w?: number }): number {
    if (typeof rotation.w !== "number") {
        // Euler degrees, Z up.
        return rotation.z;
    }
    const { w, x, y, z } = rotation as { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
    return (Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180) / Math.PI;
}

/** Turns the body to the station, when it faces well away from it. True when it was turned. */
function face(player: Player, point: { readonly x: number; readonly y: number }): boolean {
    try {
        const at = player.position;
        const dx = point.x - at.x;
        const dy = point.y - at.y;
        if (Math.hypot(dx, dy) < 0.3) {
            return false;
        }
        const heading = (Math.atan2(-dx, dy) * 180) / Math.PI;
        const now = headingOf(player.rotation);
        const off = Math.abs((((heading - now) % 360) + 540) % 360 - 180);
        if (off <= TURN_FROM_DEG) {
            return false;
        }
        return player.spawn(new Vector3(at.x, at.y, at.z), new Vector3(0, 0, heading));
    } catch {
        return false;
    }
}

/** Starts the trade's work on a player, held still: its routine over `options.ms` when it has one, else its one animation. False when there is none to play or it was refused. */
export function playWork(player: Player, trade: string, options: WorkOptions = {}): boolean {
    stopRoutine(player.id);
    // A torch drawn in a hand would be carried through the whole work (user, 2026-10-25).
    lowerTorch(player);
    const key = trade === "fogo" && options.campfire === true ? "fogo:campfire" : trade;
    const routine = options.ms === undefined ? null : routineFor(key, options.female === true);
    if (routine !== null && options.ms !== undefined) {
        const steps = layOut(routine, options.ms);
        const turned = options.point ? face(player, options.point) : false;
        const timers: ReturnType<typeof setTimeout>[] = [];
        let at = turned ? AFTER_TURN_MS : 0;
        steps.forEach((step, index) => {
            if (index === 0 && !turned) {
                playStep(player, step);
            } else {
                timers.push(setTimeout(() => playStep(player, step), at));
            }
            at += step.ms;
        });
        runs.set(player.id, timers);
        return true;
    }
    if (options.point) {
        face(player, options.point);
    }
    return playOne(player, trade);
}

/** The trade's one animation, looped. */
function playOne(player: Player, trade: string): boolean {
    const row = pickWorkAnimation(trade);
    if (row === null) {
        return false;
    }
    try {
        const props = Animations.props();
        const wanted = PROPS[trade]?.map((name) => props.find((entry) => entry.name === name)).find((entry) => entry !== undefined);
        const prop = wanted ?? (row.rightHand === "" ? undefined : props.find((entry) => entry.hand === row.rightHand));
        if (!propLogged.has(trade)) {
            propLogged.add(trade);
            console.log(`craft: ${trade}: ${row.fragment}${prop === undefined ? " sem objeto na mão (o catálogo não tem o que se queria)" : ` com ${prop.name} (${prop.model}, empunhadura ${prop.hand}) na mão direita`}`);
        }
        return player.playAnimation(row.fragment, {
            tags: row.tags,
            loop: true,
            lockMovement: true,
            ...(prop === undefined ? {} : { props: { item: prop.name, hand: "right" as const } }),
        });
    } catch (error: unknown) {
        console.log(`craft: a animação de ${trade} não tocou: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

function stopRoutine(playerId: number): void {
    for (const timer of runs.get(playerId) ?? []) {
        clearTimeout(timer);
    }
    runs.delete(playerId);
}

export function stopWork(player: Player): void {
    stopRoutine(player.id);
    try {
        player.stopAnimation();
    } catch {
        // The player went away.
    }
}
