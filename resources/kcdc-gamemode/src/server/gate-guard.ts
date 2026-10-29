/**
 * The castle gates the level draws as two sets of leaves (`Gate` of kind `gate`: the fortress gate of Ratborsch among them),
 * kept the way the server says by KCDC on every client near them.
 *
 * KCDC sets the leaves on a client when the gate comes into its range. A player who appears right by the gate -- a join inside
 * the castle, a respawn, a teleport -- has the gate set before the game has finished putting the castle up, and the game then
 * turns its own shut leaves and the invisible barrier back on over KCDC's open ones (user, 2026-10-19: both leaves and the shut
 * door drawn at once, and stuck inside; the client log has the gate "found off ... switched on" at the spawn and nothing after).
 * So some seconds after a player arrives near such a gate, the server says the gate's state again: shut and open again in the
 * same instant (a `gate` opens and closes at once, so both orders reach every client in one frame and nothing is seen shut),
 * and every client near it sets the leaves afresh. Only an open gate is said again (a shut one is already what the game
 * draws), at most once in a while per gate.
 *
 * Walking or riding up to the castle is an arrival too (2026-10-27, "os portões de Raborsch continuam fechando sozinhos"): the castle's story module
 * (`ratbor_fortress`, whose default phase switches on the profile `closedCastles_ratbor`: the shut leaves and the wall) loads when a player comes into its
 * zone, some seconds after KCDC has bound the gate on their client as it streamed in, and so the gate was drawn shut a moment after they came up to it, and
 * stayed so. A player who comes within `approachM` of a gate from beyond `leaveM` has it said again twice, `afterMs` later.
 *
 * It was shut for 1.2 s at first, then only with nobody else near; the user still saw the gate close at every arrival (the log has
 * "gate ... is closing" and "is opening" 1.2 s apart at each join, 2026-10-20: "os portões continuam fechando por algum motivo",
 * after "os portões só podem fechar se forem fechados manualmente pelo dono"). A gate is never left shut by this: if the second order
 * is not taken, it is given again a moment later until the gate is open.
 */

const RESOURCE = "kcdc-gamemode";

/**
 * Saying a gate again shuts it for a moment for everybody near it (in the same instant it opens again, but the order is still two),
 * so it is kept for the arrivals that need it (user, 2026-10-19: "os portões ... continuam fechando": it was done at every arrival
 * within 150 m, galloping riders included, twice each): a body put near the gate -- a join, a respawn, a trip -- or coming up to it
 * from afar, twice, and the same gate no more often than every ten seconds.
 */
export const gateGuard = {
    /**
     * How near a gate a player who appears (a join, a respawn, a trip) is an arrival, on the ground, in metres; and a player who comes this
     * near, having been farther than `leaveM`, is arriving on foot or by horse (the castle's own layers load as they come).
     */
    approachM: 120,
    leaveM: 170,
    /** A body that moves this far between two looks has been put somewhere: an arrival (a horse at the gallop covers some 50 m). */
    jumpM: 100,
    /** How often bodies are looked at. */
    lookEveryMs: 4_000,
    /** How long after an arrival the gate is said again (the game sets the castle up in its own time): twice, since it is not known to the second. */
    afterMs: [12_000, 28_000] as readonly number[],
    /** If the gate is not open again right after it was said again, it is told to open after this long (and again after the same). */
    blinkMs: 400,
    /** A gate is said again at most this often: players arriving together are served by one saying, and the second shot of an arrival (`afterMs`) is not refused. */
    minGapMs: 10_000,
};

export interface GateLike {
    readonly guid: string;
    readonly kind: string;
    readonly cycle: string;
    readonly moving: boolean;
    readonly position: { readonly x: number; readonly y: number };
    toggle(open?: boolean): { readonly accepted: boolean };
}

export interface BodyLike {
    readonly id: number;
    readonly nickname: string;
    readonly ready: boolean;
    readonly position: { readonly x: number; readonly y: number };
}

export class GateGuard {
    private readonly seen = new Map<number, { x: number; y: number }>();
    /** The gates each body is within reach of (with `approachM` and `leaveM`, so one that stands at the edge does not count twice). */
    private readonly inside = new Map<number, Set<string>>();
    private readonly lastSaid = new Map<string, number>();
    private said = 0;

    constructor(
        private readonly gates: () => readonly GateLike[],
        private readonly now: () => number = () => Date.now(),
        private readonly later: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
        private readonly log: (line: string) => void = (line) => console.log(line),
        _bodies: () => readonly BodyLike[] = () => [],
    ) {}

    /** The gates of kind `gate` near a point. */
    near(position: { readonly x: number; readonly y: number }): GateLike[] {
        return this.gates().filter((gate) => gate.kind === "gate" && Math.hypot(gate.position.x - position.x, gate.position.y - position.y) <= gateGuard.approachM);
    }

    /** Says an open gate's state again: shut and open in the same instant. False when it was not (shut, moving, said lately). */
    sayAgain(gate: GateLike, why: string, _arrivedId = -1): boolean {
        const now = this.now();
        if (gate.cycle !== "open" || gate.moving || now - (this.lastSaid.get(gate.guid) ?? Number.NEGATIVE_INFINITY) < gateGuard.minGapMs) {
            return false;
        }
        if (!gate.toggle(false).accepted) {
            return false;
        }
        gate.toggle(true);
        this.lastSaid.set(gate.guid, now);
        this.said += 1;
        // Never left shut: a gate that is not open a moment later is told to open, twice at most.
        for (const wait of [gateGuard.blinkMs, 2 * gateGuard.blinkMs]) {
            this.later(() => {
                if (gate.cycle !== "open" && gate.cycle !== "opening") {
                    gate.toggle(true);
                }
            }, wait);
        }
        if (this.said <= 20 || this.said % 50 === 0) {
            this.log(`gate-guard: o portão ${gate.guid} foi dito aberto de novo (${why}); nº ${this.said}`);
        }
        return true;
    }

    /** A player has appeared at a place: the gates near it are said again a little later. */
    arrived(body: BodyLike, why: string): number {
        const gates = this.near(body.position);
        if (gates.length === 0) {
            return 0;
        }
        for (const ms of gateGuard.afterMs) {
            this.later(() => {
                for (const gate of this.near(body.position)) {
                    this.sayAgain(gate, `${body.nickname}: ${why}`, body.id);
                }
            }, ms);
        }
        return gates.length;
    }

    /** A player has come up to a gate from afar: it is said again a little later, twice (the castle's own layers come up after KCDC has bound the gate). */
    approached(body: BodyLike, gate: GateLike): void {
        for (const ms of gateGuard.afterMs) {
            this.later(() => {
                if (Math.hypot(gate.position.x - body.position.x, gate.position.y - body.position.y) <= gateGuard.leaveM) {
                    this.sayAgain(gate, `${body.nickname}: chegou perto`, body.id);
                }
            }, ms);
        }
    }

    /** One look at every body: a first sight, or a jump, is an arrival, and so is coming up to a gate from beyond `leaveM`. */
    look(bodies: readonly BodyLike[]): void {
        const present = new Set<number>();
        const gates = this.gates().filter((gate) => gate.kind === "gate");
        for (const body of bodies) {
            if (!body.ready) {
                continue;
            }
            present.add(body.id);
            const before = this.seen.get(body.id);
            const here = { x: body.position.x, y: body.position.y };
            this.seen.set(body.id, here);
            let placed = false;
            if (before === undefined) {
                this.arrived(body, "entrou no mundo");
                placed = true;
            } else if (Math.hypot(here.x - before.x, here.y - before.y) >= gateGuard.jumpM) {
                this.arrived(body, "foi posto ali");
                placed = true;
            }
            // Which gates they are within reach of now; one they were not within reach of before, and that no arrival has just seen to, is an approach.
            const was = this.inside.get(body.id) ?? new Set<string>();
            const now = new Set<string>();
            for (const gate of gates) {
                const gone = Math.hypot(gate.position.x - here.x, gate.position.y - here.y);
                if (gone <= (was.has(gate.guid) ? gateGuard.leaveM : gateGuard.approachM)) {
                    now.add(gate.guid);
                    if (!was.has(gate.guid) && !placed && before !== undefined) {
                        this.approached(body, gate);
                    }
                }
            }
            this.inside.set(body.id, now);
        }
        for (const id of [...this.seen.keys()]) {
            if (!present.has(id)) {
                this.seen.delete(id);
                this.inside.delete(id);
            }
        }
    }

    forget(id: number): void {
        this.seen.delete(id);
        this.inside.delete(id);
    }
}

export function installGateGuard(): void {
    const guard = new GateGuard(
        () => (typeof Gate === "undefined" ? [] : Gate.all()),
        () => Date.now(),
        (fn, ms) => setTimeout(fn, ms),
        (line) => console.log(line),
        () => Player.all(),
    );
    const timer = setInterval(() => guard.look(Player.all()), gateGuard.lookEveryMs);
    Events.on("playerDisconnect", (player) => guard.forget(player.id));
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
