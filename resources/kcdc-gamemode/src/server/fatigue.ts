/**
 * Tiredness: the game's own energy (`exhaust`, "higher means better rested"), the "Energia" bar of the panel. It wears
 * down slowly while a player is up and about, and comes back by resting: quickly lying down (a bed, a bedroll, the
 * ground), slowly sitting (a bench, a chair, the ground). Nights cannot be slept through in multiplayer, so resting is
 * how a player gets rested.
 *
 * The posture is the client's to say: its animation system's stance tag (`LocalPlayer.stanceTag`), sent when it changes
 * and every few seconds (`src/client/posture.ts`), and whether the game has the body asleep. The pace is the server's,
 * every 15 seconds, the way hunger's is: what the game took off by itself in that time counts toward the wear, so the
 * two are never added up. The energy itself is kept across sessions with the rest of the body (`character-state.ts`).
 */

const RESOURCE = "kcdc-gamemode";

export const FATIGUE_TICK_MS = 15_000;

/** Real minutes from rested to the floor while up and about. */
export const DRAIN_MINUTES = 240;

/** Real minutes from empty to rested: lying down, and sitting. */
export const LYING_MINUTES = 12;
export const SITTING_MINUTES = 30;

/** The wear stops here: tired, never emptied by this pace. */
export const FLOOR_SHARE = 0.05;

/** A posture said longer ago than this is not believed (the client says it every 5 s). */
const REPORT_FRESH_MS = 12_000;

/** A change smaller than this share of the reserve is not worth asking the player's game for. */
const MIN_STEP = 0.0005;

/** A stall is not made up for: at most this many ticks are counted at once. */
const MAX_TICKS_CHARGED = 3;

export type Posture = "lying" | "sitting" | "up";

/**
 * The stance tags that are rest, by their place in the game's stance group (Animations.pak,
 * `Animations/Mannequin/ADB/kcd_male_tags.xml`): lying down and lying in a bed, a shelter or a tent; sitting at a table,
 * on the ground, on a table edge, and the sitting variations.
 */
export const LYING_TAGS: ReadonlySet<number> = new Set([5, 6, 8, 9, 10, 11, 15, 16, 28, 29]);
export const SITTING_TAGS: ReadonlySet<number> = new Set([1, 3, 7, 17, 34, 35, 36, 37, 38]);

export function postureOf(tag: number, asleep = false): Posture {
    if (asleep || LYING_TAGS.has(tag)) {
        return "lying";
    }
    return SITTING_TAGS.has(tag) ? "sitting" : "up";
}

/** What the pace needs of a player: what a player object offers. */
export interface Rester {
    readonly id: number;
    readonly ready: boolean;
    readonly alive: boolean;
    readonly maxExhaust: number;
    getStat(stat: "exhaust"): number;
    setStat(stat: "exhaust", value: number): boolean;
}

interface Report {
    readonly tag: number;
    readonly asleep: boolean;
    readonly at: number;
}

interface Look {
    expected: number;
    at: number;
}

export class FatiguePace {
    private readonly reports = new Map<number, Report>();
    private readonly looks = new Map<number, Look>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    /** The client's word on how the body is held. */
    report(playerId: number, tag: number, asleep: boolean): void {
        this.reports.set(playerId, { tag, asleep, at: this.now() });
    }

    /** How the player is resting now, as last said; "up" when nothing fresh was said. */
    posture(playerId: number): { readonly posture: Posture; readonly tag: number | null } {
        const report = this.reports.get(playerId);
        if (report === undefined || this.now() - report.at > REPORT_FRESH_MS) {
            return { posture: "up", tag: report?.tag ?? null };
        }
        return { posture: postureOf(report.tag, report.asleep), tag: report.tag };
    }

    tick(players: readonly Rester[]): void {
        const now = this.now();
        const present = new Set<number>();
        for (const player of players) {
            present.add(player.id);
            if (!player.ready || !player.alive) {
                this.looks.delete(player.id);
                continue;
            }
            const reading = player.getStat("exhaust");
            if (!Number.isFinite(reading)) {
                continue;
            }
            const before = this.looks.get(player.id);
            if (before === undefined) {
                this.looks.set(player.id, { expected: reading, at: now });
                continue;
            }
            const max = player.maxExhaust > 0 ? player.maxExhaust : 100;
            const seconds = Math.min((now - before.at) / 1000, (FATIGUE_TICK_MS / 1000) * MAX_TICKS_CHARGED);
            const { posture } = this.posture(player.id);

            let expected = reading;
            if (posture !== "up") {
                const minutes = posture === "lying" ? LYING_MINUTES : SITTING_MINUTES;
                const gain = (max * seconds) / (minutes * 60);
                if (reading < max && gain >= max * MIN_STEP) {
                    expected = Math.min(max, reading + gain);
                    player.setStat("exhaust", expected);
                }
            } else {
                const floor = max * FLOOR_SHARE;
                const wanted = ((max - floor) * seconds) / (DRAIN_MINUTES * 60);
                // What the game took off on its own since the last look is part of what was wanted.
                const takenByGame = reading < before.expected ? before.expected - reading : 0;
                const owed = wanted - takenByGame;
                if (owed >= max * MIN_STEP && reading > floor) {
                    expected = Math.max(floor, reading - owed);
                    player.setStat("exhaust", expected);
                }
            }
            this.looks.set(player.id, { expected, at: now });
        }
        for (const id of [...this.looks.keys()]) {
            if (!present.has(id)) {
                this.looks.delete(id);
            }
        }
        for (const id of [...this.reports.keys()]) {
            if (!present.has(id)) {
                this.reports.delete(id);
            }
        }
    }
}

export const fatiguePace = new FatiguePace();

const POSTURE_WORDS: Readonly<Record<Posture, string>> = { lying: "deitado", sitting: "sentado", up: "de pé" };

/** "Energia 64%, sentado (postura 1): sentado volta tudo em 30 min, deitado em 12." For `/cansaco`. */
export function describeFatigue(player: Player): string {
    const max = player.maxExhaust > 0 ? player.maxExhaust : 100;
    const share = Math.round((Math.max(0, player.getStat("exhaust")) / max) * 100);
    const { posture, tag } = fatiguePace.posture(player.id);
    const said = tag === null ? "o cliente ainda não disse a postura" : `postura ${tag}`;
    return `Energia ${share}%, ${POSTURE_WORDS[posture]} (${said}). Deitado, a energia volta toda em ${LYING_MINUTES} min; sentado, em ${SITTING_MINUTES} min; de pé, ela cai até ${Math.round(FLOOR_SHARE * 100)}% em ${DRAIN_MINUTES / 60} h.`;
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

export function installFatigue(): void {
    Events.onClient(`${RESOURCE}:posture`, (sender, payload) => {
        const fields = fieldsOf(payload);
        const tag = fields["tag"];
        if (typeof tag === "number" && Number.isInteger(tag) && tag >= 0 && tag <= 255) {
            fatiguePace.report((sender as Player).id, tag, fields["asleep"] === 1);
        }
    });
    const timer = setInterval(() => fatiguePace.tick(Player.all()), FATIGUE_TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`fatigue: deitado recupera em ${LYING_MINUTES} min, sentado em ${SITTING_MINUTES} min; de pé gasta até ${Math.round(FLOOR_SHARE * 100)}% em ${DRAIN_MINUTES / 60} h`);
}
