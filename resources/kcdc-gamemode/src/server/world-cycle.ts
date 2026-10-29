/**
 * The world's clock and sky: forty real minutes of day, forty of night, and weather that changes by itself.
 *
 * The game's day is not split in halves (it is light from about 06:00 to 21:00), so one time scale cannot give equal
 * real lengths to day and night. The clock runs faster by day and slower by night instead: fifteen game hours in
 * forty real minutes is 22.5 game seconds per real second, nine hours in forty minutes is 13.5. The scale is set again
 * whenever the hour crosses into the other half.
 *
 * The sky is one of the game's own time-of-day presets, the ones its own scripts blend to
 * (`EnvironmentModule.BlendTimeOfDay` in Scripts.pak); rain and wind are separate from the preset, so they are
 * ramped along with each change. A weather lasts twenty to forty-five real minutes and blends into the next over four. Rain is
 * the exception rather than the rule (2026-10-20: "está chovendo muito"): the three rainy kinds together are about a tenth of the
 * draws, last half as long as the rest, never follow one another, and fall lighter.
 *
 * The framework forgets the clock at every restart, so the day and hour are kept in `playerdata/world.json`.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/world.json`;
const RESOURCE = "kcdc-gamemode";

export const DAY_STARTS = 6;
export const NIGHT_STARTS = 21;
export const DAY_REAL_MINUTES = 40;
export const NIGHT_REAL_MINUTES = 40;

const TICK_MS = 5_000;
const SAVE_EVERY_MS = 60_000;
const WEATHER_MIN_MS = 20 * 60_000;
const WEATHER_MAX_MS = 45 * 60_000;
const BLEND_MS = 4 * 60_000;

export interface WeatherKind {
    readonly id: string;
    readonly label: string;
    readonly presets: readonly string[];
    readonly weight: number;
    /** Rain intensity, 0 to 1, drawn between these. */
    readonly rain: readonly [number, number];
    /** Wind speed in m/s, drawn between these. */
    readonly wind: readonly [number, number];
    /** How long it lasts, in real minutes, drawn between these; the usual twenty to forty-five where not said. */
    readonly lasts?: readonly [number, number];
}

export const WEATHER: readonly WeatherKind[] = [
    { id: "limpo", label: "Céu limpo", presets: ["cloudless_sunny", "cloudless_sunny_B"], weight: 32, rain: [0, 0], wind: [0.5, 3] },
    { id: "poucas-nuvens", label: "Poucas nuvens", presets: ["semicloudy_clear", "semicloudy_clear_B"], weight: 26, rain: [0, 0], wind: [1, 4] },
    { id: "nublado", label: "Nublado", presets: ["cloudy_no_rain", "cloudy_no_rain_B", "cloudy_no_rain_C", "summer_overcast", "summer_overcast_B", "summer_overcast_C"], weight: 22, rain: [0, 0], wind: [2, 6] },
    { id: "pancadas", label: "Pancadas de chuva", presets: ["cloudy_frequent_showers", "cloudy_frequent_showers_B"], weight: 5, rain: [0.25, 0.45], wind: [3, 7], lasts: [10, 20] },
    { id: "garoa", label: "Neblina com garoa", presets: ["foggy_drizzly", "foggy_drizzly_B"], weight: 3, rain: [0.1, 0.2], wind: [0.5, 2], lasts: [10, 20] },
    { id: "tempestade", label: "Tempestade", presets: ["foggy_storm", "foggy_storm_B"], weight: 2, rain: [0.6, 0.85], wind: [10, 18], lasts: [8, 15] },
    { id: "ventania", label: "Ventania", presets: ["foggy_storm_no_rain"], weight: 4, rain: [0, 0], wind: [9, 15] },
];

export function isDay(hour: number): boolean {
    return hour >= DAY_STARTS && hour < NIGHT_STARTS;
}

/** Game seconds per real second for the half of the day this hour is in. */
export function scaleFor(hour: number): number {
    const dayHours = NIGHT_STARTS - DAY_STARTS;
    const nightHours = 24 - dayHours;
    return isDay(hour) ? (dayHours * 3600) / (DAY_REAL_MINUTES * 60) : (nightHours * 3600) / (NIGHT_REAL_MINUTES * 60);
}

/** Real minutes until the other half of the day begins, at the current scales. */
export function minutesToTurn(hour: number): number {
    const target = isDay(hour) ? NIGHT_STARTS : DAY_STARTS;
    const gameHours = (target - hour + 24) % 24;
    return (gameHours * 3600) / scaleFor(hour) / 60;
}

interface Ramp {
    fromRain: number;
    toRain: number;
    fromWind: { x: number; y: number };
    toWind: { x: number; y: number };
    startedAt: number;
}

interface Saved {
    day: number;
    hour: number;
}

export class WorldCycle {
    kind: WeatherKind | null = null;
    preset = "";
    until = 0;
    /** A change asked for while the sky was still blending; tried again on each tick. */
    pending: WeatherKind | null = null;
    clockManaged = true;
    private ramp: Ramp | null = null;
    private lastSave = 0;

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
    ) {}

    private between(range: readonly [number, number]): number {
        return range[0] + (range[1] - range[0]) * this.random();
    }

    /** A weighted draw. The weather that is on is not drawn again, so a change is a change, and rain is never followed by rain. */
    pick(): WeatherKind {
        const raining = (kind: WeatherKind | null): boolean => kind !== null && kind.rain[1] > 0;
        const pool = WEATHER.filter((kind) => kind !== this.kind && !(raining(this.kind) && raining(kind)));
        const total = pool.reduce((sum, kind) => sum + kind.weight, 0);
        let left = this.random() * total;
        for (const kind of pool) {
            left -= kind.weight;
            if (left <= 0) {
                return kind;
            }
        }
        return pool[pool.length - 1] ?? WEATHER[0]!;
    }

    /** Starts a change of weather. False when the sky is still blending and the change has to wait. */
    apply(kind: WeatherKind, instant = false): boolean {
        const preset = kind.presets[Math.floor(this.random() * kind.presets.length)] ?? kind.presets[0] ?? "cloudless_sunny";
        const seconds = instant ? 0 : Math.min(21_600, Math.round((BLEND_MS / 1000) * Math.max(1, World.timeScale)));
        if (!World.setWeather(preset, seconds)) {
            return false;
        }
        const angle = this.random() * Math.PI * 2;
        const speed = this.between(kind.wind);
        const wind = World.wind;
        this.ramp = {
            fromRain: World.rainIntensity,
            toRain: this.between(kind.rain),
            fromWind: { x: wind.x, y: wind.y },
            toWind: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            startedAt: instant ? this.now() - BLEND_MS : this.now(),
        };
        this.kind = kind;
        this.preset = preset;
        const [least, most] = kind.lasts !== undefined ? [kind.lasts[0] * 60_000, kind.lasts[1] * 60_000] : [WEATHER_MIN_MS, WEATHER_MAX_MS];
        this.until = this.now() + least + this.random() * (most - least);
        this.pending = null;
        this.stepRamp();
        return true;
    }

    /** Asks for a kind of weather now; it starts on this tick or, if the sky is blending, as soon as it can. */
    force(kind: WeatherKind): boolean {
        if (this.apply(kind)) {
            return true;
        }
        this.pending = kind;
        return false;
    }

    private stepRamp(): void {
        const ramp = this.ramp;
        if (ramp === null) {
            return;
        }
        const t = Math.min(1, (this.now() - ramp.startedAt) / BLEND_MS);
        World.setRain(ramp.fromRain + (ramp.toRain - ramp.fromRain) * t, 1);
        World.setWind({ x: ramp.fromWind.x + (ramp.toWind.x - ramp.fromWind.x) * t, y: ramp.fromWind.y + (ramp.toWind.y - ramp.fromWind.y) * t, z: 0 });
        if (t >= 1) {
            this.ramp = null;
        }
    }

    tick(): void {
        if (this.clockManaged) {
            const wanted = scaleFor(World.hour);
            if (Math.abs(World.timeScale - wanted) > 0.01) {
                World.setTimeScale(wanted);
            }
        }

        if (this.pending !== null) {
            this.apply(this.pending);
        } else if (this.now() >= this.until) {
            this.apply(this.pick());
        }
        this.stepRamp();

        if (this.now() - this.lastSave >= SAVE_EVERY_MS) {
            this.save();
        }
    }

    save(): void {
        this.lastSave = this.now();
        try {
            ensureDir(DIR);
            write(FILE, { day: World.day, hour: World.hour, savedAt: this.now() });
        } catch (error: unknown) {
            console.log(`world: não consegui salvar o relógio: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /** Puts the saved day and hour back. A restart starts at day 0, 08:00, so the saved moment is normally ahead of it. */
    restoreClock(): void {
        const loaded = read<Partial<Saved>>(FILE);
        if (loaded.status !== "ok") {
            return;
        }
        const { day, hour } = loaded.value;
        if (typeof day !== "number" || typeof hour !== "number" || !Number.isInteger(day) || day < 0 || hour < 0 || hour >= 24) {
            return;
        }
        if (!World.setTime(day, hour)) {
            World.setHour(hour);
        }
    }
}

export const worldCycle = new WorldCycle();

export function weatherById(id: string): WeatherKind | null {
    return WEATHER.find((kind) => kind.id === id) ?? null;
}

export function describeWorld(cycle: WorldCycle = worldCycle): string {
    const hour = World.hour;
    const hh = Math.floor(hour);
    const mm = Math.floor((hour - hh) * 60);
    const half = isDay(hour) ? "dia" : "noite";
    const turn = Math.round(minutesToTurn(hour));
    const next = Math.max(0, Math.round((cycle.until - Date.now()) / 60_000));
    const clock = cycle.clockManaged ? `${half}; ${turn} min reais para ${isDay(hour) ? "a noite" : "o dia"}` : `${half}; relógio parado pela administração`;
    return `Dia ${World.day}, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} (${clock}). Clima: ${cycle.kind?.label ?? "?"} (${cycle.preset || World.weather}), chuva ${World.rainIntensity.toFixed(2)}, vento ${World.windSpeed.toFixed(1)} m/s; muda em cerca de ${next} min.`;
}

export function installWorldCycle(): void {
    worldCycle.restoreClock();
    World.setTimeScale(scaleFor(World.hour));
    worldCycle.apply(worldCycle.pick(), true);

    const timer = setInterval(() => worldCycle.tick(), TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        worldCycle.save();
    });

    console.log(`world: ${DAY_REAL_MINUTES} min de dia e ${NIGHT_REAL_MINUTES} min de noite (escalas ${scaleFor(12)} e ${scaleFor(0)}); dia ${World.day}, ${World.hour.toFixed(2)} h; clima ${worldCycle.kind?.label ?? "?"} (${worldCycle.preset})`);
}
