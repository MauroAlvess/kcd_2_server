/**
 * The light of a lantern carried in the gestures (`src/server/emotes.ts`), drawn by this client (2026-11-02, user: "os lampiões do emote: a luz está artificial, com cara de LED piscando; o
 * correto é uma cor mais quente, passando sensação de fogo natural"). It was one light of the server's, moved after its carrier four times a second: a walking carrier's light jumped
 * from spot to spot, which read as an LED blinking. Now the server only says who carries a lit lamp (`lamp`), and this client keeps a light of its own on each one near it
 * (`Light.spawn`, local, not replicated), moved with the body fifteen times a second and breathing like a flame: its strength wavers slowly round its mean, by a few smooth waves out of
 * step with each other, and no two lamps in step.
 */

const RESOURCE = "kcdc-gamemode";

/** A lamp farther than this from the player is not drawn here: the local lights of every resource share a budget of 192. */
const SEEN_M = 60;
const EVERY_MS = 66;

interface Glow {
    readonly color: readonly [number, number, number];
    readonly intensity: number;
    readonly radius: number;
    /** How far above the carrier's feet the flame is. */
    readonly rise: number;
}

interface Lamp {
    readonly glow: Glow;
    light: Light | null;
    /** Its own place in the flame's waves, so that two lamps never waver together. */
    readonly phase: number;
}

const lamps = new Map<number, Lamp>();

/** A flame's breathing, around 1: slow, smooth waves out of step, a few in a hundred each (from half a wave to a wave and a half a second); never the on and off of a blink. */
export function flame(seconds: number, phase: number): number {
    return 1 + 0.06 * Math.sin(seconds * 3.1 + phase) + 0.04 * Math.sin(seconds * 5.3 + phase * 1.7) + 0.025 * Math.sin(seconds * 8.9 + phase * 2.9);
}

/** A row of the server's ([id, colour, intensity, radius, rise]) as a lamp, or null for one that is not. */
function lampOf(row: unknown): [number, Glow] | null {
    if (!Array.isArray(row) || row.length < 5) {
        return null;
    }
    const [id, color, intensity, radius, rise] = row as [unknown, unknown, unknown, unknown, unknown];
    if (typeof id !== "number" || !Array.isArray(color) || color.length !== 3 || !color.every((part) => typeof part === "number" && part >= 0 && part <= 1)) {
        return null;
    }
    if (typeof intensity !== "number" || typeof radius !== "number" || typeof rise !== "number" || !(intensity > 0) || !(radius > 0)) {
        return null;
    }
    return [id, { color: [color[0], color[1], color[2]] as const, intensity, radius, rise }];
}

function light(id: number, glow: Glow): void {
    put(id);
    lamps.set(id, { glow, light: null, phase: (id % 97) * 0.731 });
}

function put(id: number): void {
    const lamp = lamps.get(id);
    if (lamp === undefined) {
        return;
    }
    lamps.delete(id);
    try {
        lamp.light?.destroy();
    } catch {
        // Gone with the world.
    }
}

/** Where a carrier stands, as this game sees them; null when they cannot be seen (a body this game does not stream reads as nothing, or as the world's origin). */
function placeOf(id: number): { x: number; y: number; z: number } | null {
    try {
        const me = LocalPlayer;
        if (me !== null && me !== undefined && me.id === id) {
            const place = me.position;
            return Number.isFinite(place.x) ? { x: place.x, y: place.y, z: place.z } : null;
        }
        const place = new Entity(id).position;
        return Number.isFinite(place.x) && !(place.x === 0 && place.y === 0) ? { x: place.x, y: place.y, z: place.z } : null;
    } catch {
        return null;
    }
}

/** One look: each lamp's light on its carrier, breathing; one far from the player, or whose carrier cannot be seen, is not drawn. */
export function drawLamps(now = Date.now()): void {
    const here = placeOf(LocalPlayer?.id ?? -1);
    const seconds = now / 1000;
    for (const [id, lamp] of lamps) {
        const at = placeOf(id);
        if (at === null || here === null || Math.hypot(at.x - here.x, at.y - here.y) > SEEN_M) {
            if (lamp.light !== null) {
                try {
                    lamp.light.destroy();
                } catch {
                    // Gone.
                }
                lamp.light = null;
            }
            continue;
        }
        const { glow } = lamp;
        const strength = glow.intensity * flame(seconds, lamp.phase);
        const spot = new Vector3(at.x, at.y, at.z + glow.rise);
        try {
            if (lamp.light === null || !lamp.light.valid) {
                lamp.light = Light.spawn(spot, { color: new Vector3(glow.color[0], glow.color[1], glow.color[2]), intensity: strength, radius: glow.radius, castShadows: false });
            } else {
                lamp.light.position = spot;
                lamp.light.intensity = strength;
            }
        } catch {
            // The budget of local lights is full, or the world is changing: tried again at the next look.
            lamp.light = null;
        }
    }
}

export function installLamps(): void {
    Events.on(`${RESOURCE}:lamp`, (payload) => {
        let value: unknown;
        try {
            value = typeof payload === "string" ? JSON.parse(payload) : payload;
        } catch {
            return;
        }
        if (typeof value !== "object" || value === null) {
            return;
        }
        const { on, off, all } = value as { on?: unknown; off?: unknown; all?: unknown };
        if (Array.isArray(all)) {
            for (const id of [...lamps.keys()]) {
                put(id);
            }
            for (const row of all) {
                const lamp = lampOf(row);
                if (lamp !== null) {
                    light(lamp[0], lamp[1]);
                }
            }
        }
        const lit = lampOf(on);
        if (lit !== null) {
            light(lit[0], lit[1]);
        }
        if (typeof off === "number") {
            put(off);
        }
        drawLamps();
    });
    setInterval(() => {
        if (lamps.size > 0) {
            drawLamps();
        }
    }, EVERY_MS);
}
