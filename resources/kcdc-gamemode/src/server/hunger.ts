/**
 * Hunger at a level an administrator picks (medium by default).
 *
 * Nourishment is the game's own stat, which the player's game keeps and reports (`player.hunger`, `maxHunger`) and a
 * script can set (`player.setHunger`). The server owns the pace: every few seconds each living player is lowered by
 * what their level wants for the time that has passed, as a share of their stomach, so a full one lasts a known number
 * of real minutes. If the game has already worn hunger down by itself in that time, what it took counts toward what is
 * wanted rather than being added to, so the pace is the level's whichever way it is kept. Eating raises it as usual, and
 * what happens at an empty stomach is the game's own.
 *
 * Nobody is lowered while offline, nor before their body is ready. The level is kept in `playerdata/hunger.json`.
 *
 * Hunger is PAUSED for now (2026-10-17, until the food system is reviewed): while it is, no level charges anything and every
 * living player's stomach is put back to full on each tick, so satiety reads 100% for everybody. The level an administrator
 * picks is still kept, and takes over again when `/fome pausa desligar` ends the pause.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/hunger.json`;
const RESOURCE = "kcdc-gamemode";

export const HUNGER_TICK_MS = 15_000;

/** A change smaller than this share of the stomach is not worth asking the player's game for. */
const MIN_STEP = 0.0005;

/** A stall (a slow server, a script that paused) is not made up for: at most this many ticks are charged at once. */
const MAX_TICKS_CHARGED = 3;

export type HungerLevel = "desligada" | "leve" | "media" | "forte";

/** How many real minutes a full stomach lasts at each level; 0 is off. */
export const HUNGER_LEVELS: Readonly<Record<HungerLevel, { readonly label: string; readonly minutes: number }>> = {
    desligada: { label: "desligada", minutes: 0 },
    leve: { label: "leve", minutes: 300 },
    media: { label: "média", minutes: 180 },
    forte: { label: "forte", minutes: 100 },
};

export const DEFAULT_LEVEL: HungerLevel = "media";

/** Whether hunger starts paused when nothing was saved: no. It was paused on 2026-10-17 while the food system was reviewed and the user then asked to keep it (the pause stays available: `/fome pausa`). */
export const DEFAULT_PAUSED = false;

/** "Média", "media" and "MEDIA" are the same level. Null for a word that is none. */
export function parseLevel(word: string): HungerLevel | null {
    const plain = word
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
    const aliases: Readonly<Record<string, HungerLevel>> = { desligada: "desligada", desligado: "desligada", off: "desligada", leve: "leve", media: "media", medio: "media", forte: "forte", dificil: "forte" };
    return aliases[plain] ?? null;
}

/** The part of a hungry player's state the pace needs: what a player object offers. */
export interface Eater {
    readonly id: number;
    readonly ready: boolean;
    readonly alive: boolean;
    readonly hunger: number;
    readonly maxHunger: number;
    /** Above 0 while the body is asleep (the game's own sleep, which speeds its clock up and takes hunger off by it). */
    readonly sleeping?: number;
    setHunger(value: number): boolean;
}

interface Look {
    /** What the stomach should read now: the last reading, or what it was set to. */
    expected: number;
    at: number;
}

export class HungerPace {
    level: HungerLevel;
    /** While true nobody gets hungrier: every stomach is kept full. */
    paused = false;
    private readonly looks = new Map<number, Look>();

    constructor(
        level: HungerLevel = DEFAULT_LEVEL,
        private readonly now: () => number = () => Date.now(),
    ) {
        this.level = level;
    }

    setLevel(level: HungerLevel): void {
        this.level = level;
        this.looks.clear();
    }

    describe(): string {
        if (this.paused) {
            return "Fome pausada: a saciedade de todos fica em 100% até o sistema de alimentação ser revisado.";
        }
        const { label, minutes } = HUNGER_LEVELS[this.level];
        if (minutes === 0) {
            return `Fome ${label}.`;
        }
        const hours = minutes / 60;
        return `Fome ${label}: um estômago cheio dura ${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")} h de jogo.`;
    }

    /** The pause: every living, ready player's stomach is brought back to full (a gain smaller than a hair is not worth asking the game for). */
    private fill(players: readonly Eater[]): void {
        this.looks.clear();
        for (const player of players) {
            if (!player.ready || !player.alive || !Number.isFinite(player.hunger)) {
                continue;
            }
            const max = player.maxHunger > 0 ? player.maxHunger : 100;
            if (player.hunger < max - max * MIN_STEP) {
                player.setHunger(max);
            }
        }
    }

    /** Charges every living, ready player the hunger of the time since the last look. */
    tick(players: readonly Eater[]): void {
        if (this.paused) {
            this.fill(players);
            return;
        }
        const minutes = HUNGER_LEVELS[this.level].minutes;
        const now = this.now();
        const present = new Set<number>();

        for (const player of players) {
            present.add(player.id);
            if (!player.ready || !player.alive) {
                this.looks.delete(player.id);
                continue;
            }
            const reading = player.hunger;
            if (!Number.isFinite(reading)) {
                continue;
            }
            const before = this.looks.get(player.id);
            if (before === undefined || minutes === 0) {
                this.looks.set(player.id, { expected: reading, at: now });
                continue;
            }

            const max = player.maxHunger > 0 ? player.maxHunger : 100;
            const seconds = Math.min((now - before.at) / 1000, (HUNGER_TICK_MS / 1000) * MAX_TICKS_CHARGED);
            const wanted = (max * seconds) / (minutes * 60);
            // The game's sleep runs its clock fast and takes hunger off by it: eight hours in minutes, down to nothing
            // (2026-10-15). A sleeping body pays only this pace; what the game took off beyond it is put back.
            if ((player.sleeping ?? 0) > 0) {
                const held = Math.max(0, before.expected - wanted);
                if (reading < held - max * MIN_STEP) {
                    player.setHunger(held);
                }
                this.looks.set(player.id, { expected: Math.max(reading, held), at: now });
                continue;
            }
            // What the game took off on its own since the last look is part of what was wanted.
            const takenByGame = reading < before.expected ? before.expected - reading : 0;
            const owed = wanted - takenByGame;

            let expected = reading;
            if (owed >= max * MIN_STEP && reading > 0) {
                expected = Math.max(0, reading - owed);
                player.setHunger(expected);
            }
            this.looks.set(player.id, { expected, at: now });
        }

        for (const id of [...this.looks.keys()]) {
            if (!present.has(id)) {
                this.looks.delete(id);
            }
        }
    }
}

export const hungerPace = new HungerPace();

interface Saved {
    level: HungerLevel;
    paused: boolean;
}

function loadSaved(): Saved {
    const loaded = read<{ level?: unknown; paused?: unknown }>(FILE);
    if (loaded.status === "ok") {
        return {
            level: typeof loaded.value.level === "string" ? (parseLevel(loaded.value.level) ?? DEFAULT_LEVEL) : DEFAULT_LEVEL,
            paused: typeof loaded.value.paused === "boolean" ? loaded.value.paused : DEFAULT_PAUSED,
        };
    }
    return { level: DEFAULT_LEVEL, paused: DEFAULT_PAUSED };
}

function save(): void {
    try {
        ensureDir(DIR);
        write(FILE, { level: hungerPace.level, paused: hungerPace.paused });
    } catch (error: unknown) {
        console.log(`hunger: não consegui salvar o nível: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Changes the level and keeps it. */
export function chooseLevel(level: HungerLevel): void {
    hungerPace.setLevel(level);
    save();
}

/** Pauses hunger (everybody full) or lets it run again, and keeps the choice. */
export function choosePaused(paused: boolean): void {
    hungerPace.paused = paused;
    hungerPace.setLevel(hungerPace.level);
    save();
}

export function installHunger(): void {
    const saved = loadSaved();
    hungerPace.setLevel(saved.level);
    hungerPace.paused = saved.paused;
    const timer = setInterval(() => hungerPace.tick(Player.all()), HUNGER_TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`hunger: ${hungerPace.describe()}`);
}
