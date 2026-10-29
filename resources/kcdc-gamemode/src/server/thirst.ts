/**
 * Thirst: the game has none, this server does (user, 2026-10-20: "ativar sede e beber água no rio igual o jogo tem por padrão; temos que
 * adicionar a sede no painel Personagem e em outras telas que mostram dados de players, também no padrão").
 *
 * A body starts quenched (100) and dries out by the clock, from quenched to parched in `THIRST_MINUTES` of play standing about, half as
 * fast while asleep. It is kept per character (`playerdata/thirst.json`, by Steam id) so a rejoin does not water anybody, and a body
 * that dies comes back with a mouthful (60). The panel's "Sede" bar reads it, in the Personagem section and in the administrator's
 * list of players.
 *
 * What it does, in three steps (the game's own buffs, drawn with their names and icons in the panel, `Buffs.register`):
 *   - under 30: "Sede", stamina comes back slower;
 *   - under 10: "Desidratação", slower still, a smaller breath and a heavier step;
 *   - at 0 the body fails: a few points of health at each tick, never below a fifth of it -- thirst alone does not kill.
 *
 * What quenches it: a drink from the game's own item tables (`drink-data.ts`: water first, then milk, beer, wine and the spirits, which
 * quench less) heard through `playerConsumed`, and water drunk where it runs: a player who aims at a river, a pond or a stream presses
 * E (`src/client/thirst.ts` finds the water by its surface, `mat_water`, `mat_mudwater`, `mat_rockwater`, `mat_slowwater`) and kneels to
 * drink, the game's own animation of drinking from a tub or a spring where the body's database has one.
 */

import { DRINKS } from "./drink-data.js";
import type { DrinkKind } from "./drink-data.js";
import { ensureDir, read, write } from "./store.js";
import { allowedTo, EDGE_M } from "./reach.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/thirst.json`;

export const THIRST_TICK_MS = 15_000;

/** Real minutes from quenched to parched, standing about. */
export const THIRST_MINUTES = 150;

/** A stall is not made up for: at most this many ticks are charged at once. */
const MAX_TICKS_CHARGED = 3;

export const FULL = 100;
/** Under this a body is thirsty; under `PARCHED`, parched; at 0 it fails. A thirsty body is quenched again at `RECOVERED`. */
export const THIRSTY = 30;
export const PARCHED = 10;
export const RECOVERED = 40;

/** What a body comes back with after dying. */
export const AFTER_DEATH = 60;

/** How much each kind of drink quenches, in points of a hundred: water the most, spirits barely. */
export const GAINS: Readonly<Record<DrinkKind, number>> = { water: 45, milk: 30, beer: 18, wine: 12, liquor: 5, drink: 0 };

export const RIVER = {
    /** What a drink from a river or a pond quenches. */
    gain: 40,
    /** How far from the player the water they name may be, on the ground, in metres: a point on the water itself, so the one reach of our prompts and a metre more (`reach.ts`). */
    reachM: allowedTo(EDGE_M.surface),
    /** One drink at a time, and this long before the next. */
    gapMs: 6_000,
    /** A player this quenched has no need to drink. */
    stopAt: 96,
    /** The animation's length is held between these, in seconds. */
    secondsMin: 3,
    secondsMax: 8,
    /** The animations tried, in order, by their fragment's name (the game's smart objects of a tub and a spring). */
    fragments: ["WaterTubDrinking", "CampDrinkWatertube", "CampDrinkSpruit", "HousekeeperDrinkWaterTub", "WashFace"] as readonly string[],
};

/** At 0 each tick takes this share of the player's health, never below `FLOOR_SHARE` of it. */
export const FAILING = { share: 0.02, floor: 0.2 };

export type Level = 0 | 1 | 2;

/** What thirst reads of a player: what a player object offers. */
export interface Thirsty {
    readonly id: number;
    readonly steamId: string;
    readonly ready: boolean;
    readonly alive: boolean;
    readonly health: number;
    readonly maxHealth: number;
    /** Above 0 while the body is asleep. */
    readonly sleeping?: number;
    readonly mounted?: boolean;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    readonly appearance?: { readonly gender?: string };
    setHealth(value: number): boolean;
    hasBuff(buff: string): boolean;
    addBuff(buff: string): boolean;
    removeBuff(buff: string): boolean;
    emit(event: string, payload: string): void;
    playAnimation(fragment: string, options?: { tags?: string }): boolean;
    stopAnimation(): void;
}

export interface AnimationRow {
    readonly fragment: string;
    readonly tags: string;
    readonly duration: number;
    readonly oneShot: boolean;
    readonly male: boolean;
    readonly female: boolean;
}

/** The buffs that show the level, by the GUID `Buffs.register` gave (empty: none, the level only counts). */
export interface Buffing {
    thirsty: string;
    parched: string;
}

const clamp = (value: number): number => Math.max(0, Math.min(FULL, value));

/** "Matou a sede", "com sede": how a value reads aloud. */
export function feeling(value: number): string {
    if (value >= 75) {
        return "com a sede saciada";
    }
    if (value >= 45) {
        return "com um pouco de sede";
    }
    if (value >= THIRSTY) {
        return "com sede";
    }
    return value >= PARCHED ? "com muita sede" : "desidratado";
}

/** The level a measure puts a body at: a thirsty one stays thirsty until it has drunk its way back up to `RECOVERED`. */
export function levelOf(value: number, before: Level): Level {
    if (value < PARCHED) {
        return 2;
    }
    if (value < THIRSTY) {
        return 1;
    }
    return before > 0 && value < RECOVERED ? 1 : 0;
}

export class ThirstPace {
    enabled = true;
    private readonly values = new Map<number, number>();
    private readonly levels = new Map<number, Level>();
    private readonly lastTick = new Map<number, number>();
    private readonly told = new Map<number, number>();
    private readonly drinkAt = new Map<number, number>();
    private readonly drinking = new Map<number, number>();
    /** What is kept, by Steam id; `dirty` is what changed since it was last written. */
    readonly kept = new Map<string, number>();
    private readonly dirty = new Set<string>();
    buffs: Buffing = { thirsty: "", parched: "" };
    private serial = 0;

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly later: (fn: () => void, ms: number) => void = (fn, ms) => {
            setTimeout(fn, ms);
        },
        private readonly say: (player: Thirsty, text: string) => void = () => undefined,
        private readonly animations: (fragment: string) => readonly AnimationRow[] = () => [],
    ) {}

    /** What the body holds now: the full measure for one nothing is known of, and always the full measure while thirst is off. */
    value(player: { readonly id: number }): number {
        return this.enabled ? (this.values.get(player.id) ?? FULL) : FULL;
    }

    describe(): string {
        const hours = String(THIRST_MINUTES / 60).replace(".", ",");
        return this.enabled ? `Sede ligada: um corpo saciado leva ${hours} h de jogo para ficar seco, e a água, o leite, a cerveja, o vinho e o rio matam a sede.` : "Sede desligada: ninguém tem sede.";
    }

    /** The saved measure of a character, or a full one. */
    restore(player: Thirsty): void {
        const saved = player.steamId === "" ? undefined : this.kept.get(player.steamId);
        this.set(player, saved ?? FULL, false);
        this.lastTick.delete(player.id);
        this.levels.set(player.id, levelOf(this.values.get(player.id) ?? FULL, 0));
    }

    /** Sets the measure (an administrator's, a drink's, a rest's), tells the panel and keeps it. */
    set(player: Thirsty, value: number, tell = true): number {
        // Kept whole, not rounded: a tick's share is a sixth of a point, and a rounding at every look would make the clock drift.
        const next = clamp(value);
        this.values.set(player.id, next);
        if (player.steamId !== "") {
            if (this.kept.get(player.steamId) !== next) {
                this.dirty.add(player.steamId);
            }
            this.kept.set(player.steamId, next);
        }
        if (tell) {
            this.push(player);
        }
        return next;
    }

    /** The panel is told the whole number when it changes, and again at every look (`force`) for a client that came up after the first. */
    private push(player: Thirsty, force = false): void {
        const shown = Math.round(this.value(player));
        if (!force && this.told.get(player.id) === shown) {
            return;
        }
        this.told.set(player.id, shown);
        try {
            player.emit(`${RESOURCE}:thirst.value`, JSON.stringify({ v: shown }));
        } catch {
            // Gone meanwhile.
        }
    }

    /** Quenches the body by `amount` points. */
    drink(player: Thirsty, amount: number): number {
        return this.set(player, this.value(player) + amount);
    }

    /** Something that is no drink of the tables quenches the body by `amount` points (a soup, 2026-10-20), the buffs put right at once. */
    quench(player: Thirsty, amount: number): number {
        if (!this.enabled || !(amount > 0)) {
            return this.value(player);
        }
        const value = this.drink(player, amount);
        this.settle(player);
        return value;
    }

    /** A drink of the game's tables was drunk: what it is, how much it quenches. Zero for what is no drink. */
    consumed(player: Thirsty, item: string): number {
        const drink = DRINKS[item.toLowerCase()];
        const gain = drink === undefined || !this.enabled ? 0 : GAINS[drink[1]];
        if (gain > 0) {
            this.drink(player, gain);
            this.settle(player);
        }
        return gain;
    }

    /** A body that dies comes back with a mouthful at least. */
    died(player: Thirsty): void {
        if (this.value(player) < AFTER_DEATH) {
            this.set(player, AFTER_DEATH);
        }
        this.settle(player);
    }

    left(player: { readonly id: number }): void {
        for (const map of [this.values, this.levels, this.lastTick, this.told, this.drinkAt, this.drinking]) {
            map.delete(player.id);
        }
    }

    /** The buff and the word that go with the level, put right at once. */
    private settle(player: Thirsty): void {
        const before = this.levels.get(player.id) ?? 0;
        const level = this.enabled ? levelOf(this.value(player), before) : 0;
        this.levels.set(player.id, level);
        this.dress(player, level, level !== before);
        if (level !== before) {
            this.speak(player, level, before);
        }
    }

    private speak(player: Thirsty, level: Level, before: Level): void {
        if (level > before) {
            this.say(player, level === 2 ? "Sua boca está seca e a cabeça pesa: você precisa beber, e logo." : "Você sente sede. Beba água, ou do rio, quando passar por um.");
        } else if (level === 0) {
            this.say(player, "A sede passou.");
        }
    }

    /** Puts the buff of the level on, and the other off; asked again each tick for a body that lost it (a death, a new body). */
    private dress(player: Thirsty, level: Level, force: boolean): void {
        const wanted = level === 1 ? this.buffs.thirsty : level === 2 ? this.buffs.parched : "";
        const other = level === 1 ? this.buffs.parched : level === 2 ? this.buffs.thirsty : "";
        try {
            for (const buff of [this.buffs.thirsty, this.buffs.parched]) {
                if (buff !== "" && buff !== wanted && (force || buff === other) && player.hasBuff(buff)) {
                    player.removeBuff(buff);
                }
            }
            if (wanted !== "" && !player.hasBuff(wanted)) {
                player.addBuff(wanted);
            }
        } catch {
            // The body is not there to be dressed.
        }
    }

    /** One look at every body: the clock takes its share, the level is put right, a failing body loses a little health. */
    tick(players: readonly Thirsty[]): void {
        const now = this.now();
        const present = new Set<number>();
        for (const player of players) {
            present.add(player.id);
            if (!player.ready || !player.alive) {
                this.lastTick.delete(player.id);
                continue;
            }
            const before = this.lastTick.get(player.id);
            this.lastTick.set(player.id, now);
            if (!this.enabled) {
                this.settle(player);
                continue;
            }
            if (before !== undefined) {
                const seconds = Math.min((now - before) / 1000, (THIRST_TICK_MS / 1000) * MAX_TICKS_CHARGED);
                const share = (player.sleeping ?? 0) > 0 ? 0.5 : 1;
                this.set(player, this.value(player) - (FULL * seconds * share) / (THIRST_MINUTES * 60), false);
            }
            this.push(player, true);
            this.settle(player);
            const value = this.value(player);
            if (value <= 0 && player.maxHealth > 0 && Number.isFinite(player.health)) {
                const floor = player.maxHealth * FAILING.floor;
                if (player.health > floor) {
                    player.setHealth(Math.max(floor, player.health - player.maxHealth * FAILING.share));
                }
            }
        }
        for (const id of [...this.values.keys()]) {
            if (!present.has(id)) {
                this.left({ id });
            }
        }
    }

    /**
     * A player names water they aim at (`thirst.drink`, from `src/client/thirst.ts`, which found it by its surface): they kneel and
     * drink. Refused (with the reason) when it is not allowed; `null` when it began.
     */
    drinkFromWater(player: Thirsty, at: { readonly x: number; readonly y: number; readonly z: number }): string | null {
        if (!this.enabled) {
            return "A sede está desligada neste servidor.";
        }
        if (!player.ready || !player.alive || player.mounted === true) {
            return "Agora não.";
        }
        const now = this.now();
        if (this.drinking.has(player.id) || now - (this.drinkAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < RIVER.gapMs) {
            return "Com calma: um gole de cada vez.";
        }
        if (this.value(player) >= RIVER.stopAt) {
            return "Você não está com sede.";
        }
        if (![at.x, at.y, at.z].every(Number.isFinite) || Math.hypot(at.x - player.position.x, at.y - player.position.y) > RIVER.reachM || Math.abs(at.z - player.position.z) > RIVER.reachM) {
            return "A água está longe demais.";
        }
        this.drinkAt.set(player.id, now);
        const mine = ++this.serial;
        this.drinking.set(player.id, mine);
        const row = this.pick(player);
        let seconds: number = RIVER.secondsMin;
        if (row !== null) {
            seconds = Math.max(RIVER.secondsMin, Math.min(RIVER.secondsMax, row.duration));
            let played = false;
            // `Thirsty` is the part of a Player this module uses, so that a test can stand in for one; the one drinking is a Player.
            lowerTorch(player as unknown as Player);
            try {
                played = player.playAnimation(row.fragment, row.tags === "" ? {} : { tags: row.tags });
            } catch {
                played = false;
            }
            if (!played) {
                seconds = RIVER.secondsMin;
            }
        }
        this.later(() => {
            if (this.drinking.get(player.id) !== mine) {
                return;
            }
            this.drinking.delete(player.id);
            try {
                player.stopAnimation();
            } catch {
                // Gone, or the animation ended by itself.
            }
            const value = this.drink(player, RIVER.gain);
            this.settle(player);
            this.say(player, `Você matou a sede na água (${Math.round(value)}%).`);
        }, Math.round(seconds * 1000));
        return null;
    }

    /** The animation to drink with: the first fragment of the list the body's database has, for this body, that ends by itself. */
    pick(player: Thirsty): AnimationRow | null {
        const female = player.appearance?.gender === "female";
        for (const fragment of RIVER.fragments) {
            const row = this.animations(fragment).find((one) => one.fragment.toLowerCase() === fragment.toLowerCase() && one.oneShot && (female ? one.female : one.male));
            if (row !== undefined) {
                return row;
            }
        }
        return null;
    }
}

export const thirstPace = new ThirstPace(
    () => Date.now(),
    (fn, ms) => {
        setTimeout(fn, ms);
    },
    (player, text) => Chat.sendToPlayer(player as unknown as Player, text),
    (fragment) => {
        try {
            return Animations.list(fragment);
        } catch {
            return [];
        }
    },
);

interface Saved {
    enabled?: unknown;
    players?: Record<string, unknown>;
}

function load(): void {
    const loaded = read<Saved>(FILE);
    if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
        return;
    }
    if (typeof loaded.value.enabled === "boolean") {
        thirstPace.enabled = loaded.value.enabled;
    }
    for (const [steamId, value] of Object.entries(loaded.value.players ?? {})) {
        if (typeof value === "number" && Number.isFinite(value) && /^[0-9]{5,20}$/.test(steamId)) {
            thirstPace.kept.set(steamId, clamp(value));
        }
    }
}

export function saveThirst(): void {
    try {
        ensureDir(DIR);
        write(FILE, { enabled: thirstPace.enabled, players: Object.fromEntries([...thirstPace.kept].map(([steamId, value]) => [steamId, Math.round(value * 10) / 10])) });
    } catch (error: unknown) {
        console.log(`thirst: não consegui guardar a sede: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** A deleted character's thirst goes with it: the next one starts with the body of a newcomer (2026-10-25). */
export function forgetThirst(steamId: string): boolean {
    if (!thirstPace.kept.delete(steamId)) {
        return false;
    }
    saveThirst();
    return true;
}

/** Switches thirst on or off for everybody, and keeps the choice. */
export function chooseEnabled(enabled: boolean): void {
    thirstPace.enabled = enabled;
    saveThirst();
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 256) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Registers the two buffs that show the level; one that cannot be made leaves the level counting without it. */
function registerBuffs(): void {
    const make = (id: string, name: string, description: string, modifiers: Record<string, { operation: "multiply"; value: number }>): string => {
        try {
            return Buffs.register(`${RESOURCE}:${id}`, { name, description, visual: "hangover", duration: -1, modifiers });
        } catch (error: unknown) {
            console.log(`thirst: o efeito ${name} não pôde ser registrado com os modificadores (${error instanceof Error ? error.message : String(error)}); tento sem eles`);
        }
        try {
            return Buffs.register(`${RESOURCE}:${id}`, { name, description, visual: "hangover", duration: -1 });
        } catch (error: unknown) {
            console.log(`thirst: o efeito ${name} não pôde ser registrado: ${error instanceof Error ? error.message : String(error)}`);
            return "";
        }
    };
    thirstPace.buffs = {
        thirsty: make("sede", "Sede", "Falta água: o fôlego volta mais devagar. Beba água, leite ou do rio.", { staminaRegeneration: { operation: "multiply", value: 0.8 } }),
        parched: make("desidratacao", "Desidratação", "Sem água há muito tempo: o fôlego quase não volta, o corpo pesa e as forças se vão. Beba, e logo.", {
            staminaRegeneration: { operation: "multiply", value: 0.55 },
            maxStamina: { operation: "multiply", value: 0.85 },
            runSpeed: { operation: "multiply", value: 0.96 },
        }),
    };
}

export function installThirst(): void {
    load();
    registerBuffs();
    Events.on("playerReady", (player) => thirstPace.restore(player));
    Events.on("playerDisconnect", (player) => {
        thirstPace.left(player);
        saveThirst();
    });
    Events.on("playerDied", (player) => thirstPace.died(player));
    Events.on("playerConsumed", (player, consumption) => {
        thirstPace.consumed(player, consumption.item);
    });
    Events.onClient(`${RESOURCE}:thirst.drink`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const refused = thirstPace.drinkFromWater(player, { x: Number(fields["x"]), y: Number(fields["y"]), z: Number(fields["z"]) });
        if (refused !== null) {
            Chat.sendToPlayer(player, refused);
        }
    });
    const timer = setInterval(() => thirstPace.tick(Player.all()), THIRST_TICK_MS);
    const saver = setInterval(saveThirst, 60_000);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            clearInterval(saver);
            saveThirst();
        }
    });
    console.log(`thirst: ${thirstPace.describe()}`);
}
