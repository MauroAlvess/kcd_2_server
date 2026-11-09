/**
 * The horses' mood (user, 2026-11-04: "tem jogador upando batendo no próprio cavalo: se bater várias vezes deve mostrar a mensagem 'seu cavalo não gosta mais de você e te abandonou', e aí sair dos
 * animais dele e ir embora ... para isso adicione o sistema de humor: cavalos com mau humor não andam, não correm e vão embora"). The blows a player lands on the horse they keep were a way to practise
 * weapons on a body that cannot be killed (the game holds a player's own horse immortal: a blow that would kill it knocks it out, `horses.ts`).
 *
 * **The mood** is a number of a hundred in the horse's record (`SavedHorse.mood`, `horses.ts`; a hundred is the best), a hundred when it comes to its owner. Each blow of the OWNER on it
 * (`horseDamage` tells who dealt it; the blows of anybody else, a fall, a collision, poison do not count) takes `moodSettings.blowCost` points. It recovers `recoverPerMinute` points a minute, only
 * while its owner is in the game.
 *
 * **What it does to the horse.** From a hundred down to 60 it is calm. Under 60 it is irritated (the owner is warned, and it has a little less wind). Under 30 it is in a bad mood
 * (`BAD_MOOD_BELOW`, `horses.ts`): it will not carry anybody (the rider is thrown, and nobody may climb: `horseMounting`), will not come to the whistle, and an effect of ours takes
 * its wind and its gallop (`Buffs.register`), so that it neither walks with a rider nor runs. A little time brings it back. At `leaveAt` points it has had enough:
 * the owner is told that it no longer likes them and has left, the horse leaves their Animais (`abandonHorse`), runs off and is taken out of the world.
 */

import { abandonHorse, allHorses, BAD_MOOD_BELOW, CALM_MOOD_FROM, keyOfHorse, moodOf, recordOf, saveHorseRecords } from "./horses.js";

export const moodSettings = {
    /** What an owner's blow on their own horse takes off its mood. */
    blowCost: 20,
    /** At or under this the horse leaves. */
    leaveAt: 5,
    /** What a horse recovers in a minute, with its owner in the game. */
    recoverPerMinute: 4,
    tickMs: 15_000,
    /** A stall (a slow server) is not made up for: at most this many ticks are charged at once. */
    maxTicksCharged: 3,
};

export type Band = "calm" | "uneasy" | "bad";

export const moodState = {
    /** The GUIDs `Buffs.register` gave the effects ("" for none). */
    buffs: { calm: "", uneasy: "", bad: "" } as Record<Band, string>,
};

/** What a blow is, for the game: blades and fists (combat), arrows and shots, and what it does not name. The rest (a fall, a collision, poison, a script's) is not a blow. */
const BLOWS: ReadonlySet<string> = new Set(["combat", "gunshot", "unknown"]);

export const IRRITATED = "está irritado com as pancadas. Se você continuar, ele vai ficar de mau humor.";
export const SULKING = "está de mau humor: não anda, não corre e não deixa ninguém montar. Pare de bater nele; um pouco de paz o acalma. Se bater mais, ele vai embora.";
export const CALMED = "se acalmou e volta a andar.";
export const ABANDONED = "não gosta mais de você e te abandonou.";

export function bandOf(mood: number): Band {
    return mood < BAD_MOOD_BELOW ? "bad" : mood < CALM_MOOD_FROM ? "uneasy" : "calm";
}

/** The band whose effect each live horse carries now, by horse id. */
const applied = new Map<number, Band>();
/** The band each kept horse was last seen in, by its key: a horse that was in a bad mood and is not any more is said to have calmed. */
const last = new Map<string, Band>();
let lastTick = 0;

function tell(player: Player | null, text: string): void {
    if (player === null) {
        return;
    }
    try {
        Chat.sendToPlayer(player, text);
        player.emit("kcdc-gamemode:notify", JSON.stringify({ text }));
    } catch {
        // Gone already.
    }
}

const labelOf = (name: string): string => (name === "" ? "Seu cavalo" : `Seu cavalo ${name}`);

/** Puts on a horse the effect of its band and takes off the one it had: a call to the engine only when the band changes. */
export function applyBand(horse: Horse, band: Band): void {
    const known = applied.get(horse.id);
    if (known === band) {
        return;
    }
    const next = moodState.buffs[band];
    for (const other of ["uneasy", "bad"] as const) {
        const id = moodState.buffs[other];
        if (id === "" || id === next || (known !== undefined && known !== other)) {
            continue;
        }
        try {
            if (horse.hasBuff(id)) {
                horse.removeBuff(id);
            }
        } catch {
            // Gone, or never had it.
        }
    }
    if (next !== "") {
        try {
            if (!horse.hasBuff(next)) {
                horse.addBuff(next);
            }
        } catch (error: unknown) {
            console.log(`horse-mood: não consegui pôr o efeito de ${band} em ${horse.name || horse.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    applied.set(horse.id, band);
}

/** What a horse in a bad mood does to whoever is on it, and to what it was doing: the rider is thrown, and it stands where it is. */
function sulk(horse: Horse): void {
    try {
        if (horse.rider !== null && !horse.rearAndThrowDown()) {
            horse.dismountRider();
        }
    } catch {
        // Not in the saddle any more.
    }
    try {
        if (horse.rider === null) {
            horse.hold();
        }
    } catch {
        // Gone already.
    }
}

/** Counts a blow of `attacker` on `horse`. True when it was the one that made the horse leave. */
export function struckBy(horse: Horse, attacker: Player | null, amount: number, reason: string): boolean {
    if (attacker === null || attacker.steamId === "" || !(amount > 0) || !BLOWS.has(reason)) {
        return false;
    }
    const key = keyOfHorse(horse);
    const record = key === null ? null : recordOf(key);
    if (key === null || record === null || record.owner !== attacker.steamId) {
        return false;
    }
    const before = moodOf(record);
    const after = Math.max(0, before - moodSettings.blowCost);
    record.mood = after;
    saveHorseRecords();
    const label = labelOf(record.name);
    if (after <= moodSettings.leaveAt) {
        // The owner is told first, while the horse is still theirs to name; then it goes out of their animals and runs off from them.
        tell(attacker, `${label} ${ABANDONED}`);
        console.log(`horse-mood: ${attacker.nickname} bateu em ${record.name || "um cavalo"} (${key}) até o humor chegar a ${Math.round(after)}%: o cavalo o abandonou`);
        last.delete(key);
        applied.delete(horse.id);
        abandonHorse(key, attacker.position);
        return true;
    }
    const band = bandOf(after);
    if (band !== bandOf(before)) {
        applyBand(horse, band);
        last.set(key, band);
        console.log(`horse-mood: ${record.name || key} de ${record.ownerName} ficou ${band === "bad" ? "de mau humor" : "irritado"} (${Math.round(after)}%) com as pancadas de ${attacker.nickname}`);
        if (band === "bad") {
            tell(attacker, `${label} ${SULKING}`);
            sulk(horse);
        } else {
            tell(attacker, `${label} ${IRRITATED}`);
        }
    }
    return false;
}

/** One look: each kept horse whose owner is in the game recovers a little, and every one that is not at its best carries the effect of its band. */
export function moodTick(now = Date.now()): void {
    const elapsed = lastTick === 0 ? 0 : Math.max(0, Math.min(now - lastTick, moodSettings.tickMs * moodSettings.maxTicksCharged));
    lastTick = now;
    const horses = allHorses().filter((owned) => owned.horse !== null && owned.horse.alive && (moodOf(owned.record) < 100 || applied.has((owned.horse as Horse).id)));
    if (horses.length === 0) {
        return;
    }
    const online = new Map<string, Player>();
    for (const player of Player.all()) {
        if (player.ready) {
            online.set(player.steamId, player);
        }
    }
    const live = new Set<number>();
    for (const { record, horse } of horses) {
        const body = horse as Horse;
        live.add(body.id);
        const before = moodOf(record);
        if (elapsed > 0 && before < 100 && online.has(record.owner)) {
            // To four places, so that a slow recovery is not rounded away at each look.
            record.mood = Math.round(Math.min(100, before + (moodSettings.recoverPerMinute * elapsed) / 60_000) * 10_000) / 10_000;
        }
        const mood = moodOf(record);
        const band = bandOf(mood);
        applyBand(body, band);
        const was = last.get(record.key);
        last.set(record.key, band);
        if (band === "bad") {
            sulk(body);
        } else if (was === "bad") {
            tell(online.get(record.owner) ?? null, `${labelOf(record.name)} ${CALMED}`);
        }
    }
    for (const id of [...applied.keys()]) {
        if (!live.has(id)) {
            applied.delete(id);
        }
    }
}

function registerBuffs(): void {
    const make = (id: string, name: string, description: string, modifiers: Record<string, { operation: "add" | "multiply"; value: number }>, plain: Record<string, { operation: "add" | "multiply"; value: number }>): string => {
        for (const tried of [modifiers, plain]) {
            try {
                return Buffs.register(`kcdc-gamemode:${id}`, { name, description, visual: "hangover", duration: -1, modifiers: tried });
            } catch (error: unknown) {
                console.log(`horse-mood: o efeito ${name} não pôde ser registrado (${Object.keys(tried).join(", ")}): ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return "";
    };
    const times = (value: number) => ({ operation: "multiply" as const, value });
    const plus = (value: number) => ({ operation: "add" as const, value });
    moodState.buffs.uneasy = make("cavalo-irritado", "Cavalo irritado", "O cavalo está irritado com o dono: tem menos fôlego.", { maxStamina: times(0.85), staminaRegeneration: times(0.85) }, { maxStamina: times(0.85) });
    moodState.buffs.bad = make(
        "cavalo-mau-humor",
        "Cavalo de mau humor",
        "O cavalo está de mau humor: não anda, não corre e não deixa ninguém montar.",
        { maxStamina: times(0.2), staminaRegeneration: times(0.2), runSpeed: plus(-0.5) },
        { maxStamina: times(0.2), runSpeed: plus(-0.5) },
    );
}

export function installHorseMood(): void {
    registerBuffs();
    Events.on("horseDamage", (horse, attacker, amount, reason) => {
        struckBy(horse, attacker, amount, reason);
    });
    Events.on("horseDestroy", (horse) => {
        const key = keyOfHorse(horse);
        if (key !== null) {
            last.delete(key);
        }
        applied.delete(horse.id);
    });
    const timer = setInterval(() => moodTick(), moodSettings.tickMs);
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(timer);
        }
    });
    const effects = (["uneasy", "bad"] as const).filter((band) => moodState.buffs[band] !== "").length;
    console.log(`horse-mood: ${Math.round(100 / moodSettings.blowCost)} pancadas do dono levam o cavalo do bom humor ao abandono; mau humor abaixo de ${BAD_MOOD_BELOW}%; ${effects} de 2 efeitos registrados.`);
}
