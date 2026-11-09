/**
 * The fires of the level's stew pots (2026-11-02, user: "existe fogueira de caldeirão para cozinhar: temos que deixar todas acesas, ou pelo menos ao cozinhar acendermos elas").
 *
 * Each player's own game lit and put out a pot's fire by itself, as in single player (the villagers stoke it, and it burns out), so most of the cauldrons the Tabernarii cook at stood
 * cold. The server can light one for every player at once (`CookPot.setFireLit`, with its steam and smoke), and from then on the game leaves it as set. Three ways, an administrator's
 * choice (`/fogueiras`, kept in `playerdata/pot-fires.json`):
 *
 * - **todas** (the default): every catalogued pot burns, day and night; a look every few minutes lights one the game had not listed yet.
 * - **cozinhar**: a pot is lit when somebody cooks at it (`litForCooking`, from the kitchen's work, `cooking.ts` and `craft.ts`), and handed back to the game `cookingLitMs` later.
 * - **jogo**: every pot is the game's again, as it was before.
 *
 * The pots' stock is world 0's for the players of the global world (`cook-pots.ts`), and an empty list is a world nobody has entered yet: the first look waits for it.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/pot-fires.json`;

export type PotFireMode = "todas" | "cozinhar" | "jogo";

export const potFireSettings = {
    /** How often the pots are looked at, to light one found unlit. */
    everyMs: 3 * 60_000,
    /** The first look, after the level's pots are known (a player has entered). */
    firstMs: 20_000,
    /** How long a pot lit for cooking burns before it is the game's again. */
    cookingLitMs: 10 * 60_000,
    /** How near the cook the pot must be (the game's own reach of a pot). */
    nearM: 4,
};

export const potFires = {
    mode: "todas" as PotFireMode,
};

/** The pots lit for cooking, by GUID, and when they go back to the game. */
const cookingLit = new Map<string, number>();

/** The stock world of a player: the global world's is 0 (`cook-pots.ts`). */
function worldOf(player: Player): number {
    return player.virtualWorld === 0xffffffff ? 0 : player.virtualWorld;
}

/** One look: in `todas`, every pot not burning is lit. Returns how many were lit now, and how many pots there are. */
export function lightAllPots(): { readonly lit: number; readonly pots: number } {
    if (potFires.mode !== "todas") {
        return { lit: 0, pots: 0 };
    }
    let lit = 0;
    let pots = 0;
    for (const pot of CookPot.all(0)) {
        pots += 1;
        if (pot.fireLit !== true && CookPot.setFireLit(pot.guid, true, 0)) {
            lit += 1;
        }
    }
    return { lit, pots };
}

/** Every pot handed back to each player's own game (`jogo`, and `cozinhar` but for the ones lit for a cook). */
function handBackAll(keepCooking: boolean): number {
    let given = 0;
    for (const pot of CookPot.all(0)) {
        if (keepCooking && cookingLit.has(pot.guid)) {
            continue;
        }
        if (pot.fireLit !== null && CookPot.setFireLit(pot.guid, null, 0)) {
            given += 1;
        }
    }
    if (!keepCooking) {
        cookingLit.clear();
    }
    return given;
}

/** The pots lit for cooking whose time is up go back to the game. */
function endCookingFires(now: number): void {
    for (const [guid, until] of [...cookingLit]) {
        if (now >= until) {
            cookingLit.delete(guid);
            if (potFires.mode === "cozinhar") {
                CookPot.setFireLit(guid, null, 0);
            }
        }
    }
}

/**
 * A player begins to cook at a fire: the pot within reach, if there is one, burns (in `cozinhar`, for `cookingLitMs`; in `todas` it burns already, and is lit now if it was not).
 * Returns the pot's GUID, or "" when no pot is near or the pots are the game's.
 */
export function litForCooking(player: Player, now = Date.now()): string {
    if (potFires.mode === "jogo") {
        return "";
    }
    const world = worldOf(player);
    const here = player.position;
    let best: CookPotSnapshot | null = null;
    let distance = potFireSettings.nearM;
    for (const pot of CookPot.all(world)) {
        const at = pot.position;
        const away = Math.hypot(at.x - here.x, at.y - here.y, at.z - here.z);
        if (away <= distance) {
            distance = away;
            best = pot;
        }
    }
    if (best === null) {
        return "";
    }
    if (best.fireLit !== true) {
        CookPot.setFireLit(best.guid, true, world);
    }
    if (potFires.mode === "cozinhar") {
        cookingLit.set(best.guid, now + potFireSettings.cookingLitMs);
    }
    return best.guid;
}

export function describePotFires(): string {
    return potFires.mode === "todas"
        ? "As fogueiras dos caldeirões ficam todas acesas, dia e noite, para todos."
        : potFires.mode === "cozinhar"
          ? `As fogueiras dos caldeirões acendem quando alguém cozinha nelas, por ${potFireSettings.cookingLitMs / 60_000} minutos; fora isso, são do jogo de cada um.`
          : "As fogueiras dos caldeirões são do jogo de cada um, como no jogo sozinho: os moradores acendem e elas se apagam.";
}

/** An administrator's choice of way, kept on disk; the pots are set to it at once. */
export function choosePotFires(mode: PotFireMode): string {
    potFires.mode = mode;
    try {
        ensureDir(DIR);
        write(FILE, { mode });
    } catch (error: unknown) {
        console.log(`pot-fires: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (mode === "todas") {
        const { lit, pots } = lightAllPots();
        return `${describePotFires()} ${lit} de ${pots} acesas agora.`;
    }
    const given = handBackAll(mode === "cozinhar");
    return `${describePotFires()} ${given} devolvidas ao jogo.`;
}

export function parsePotFireMode(word: string | undefined): PotFireMode | null {
    const plain = (word ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return plain === "todas" || plain === "acesas" || plain === "acender" ? "todas" : plain === "cozinhar" ? "cozinhar" : plain === "jogo" || plain === "apagar" ? "jogo" : null;
}

export function installPotFires(): void {
    const loaded = read<{ mode?: unknown }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value.mode === "string") {
        potFires.mode = parsePotFireMode(loaded.value.mode) ?? "todas";
    }
    let told = false;
    const look = (): void => {
        try {
            endCookingFires(Date.now());
            const { lit, pots } = lightAllPots();
            if (lit > 0 || (!told && pots > 0)) {
                console.log(`pot-fires: ${lit} fogueira(s) de caldeirão acesa(s) agora, de ${pots} (${potFires.mode})`);
                told = pots > 0;
            }
        } catch (error: unknown) {
            console.log(`pot-fires: não consegui olhar as fogueiras: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const first = setTimeout(look, potFireSettings.firstMs);
    const timer = setInterval(look, potFireSettings.everyMs);
    // The first player in makes world 0's pots known: they are lit a little after.
    Events.on("playerSpawned", () => {
        if (!told) {
            setTimeout(look, 5_000);
        }
    });
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearTimeout(first);
            clearInterval(timer);
        }
    });
    console.log(`pot-fires: ${describePotFires()}`);
}
