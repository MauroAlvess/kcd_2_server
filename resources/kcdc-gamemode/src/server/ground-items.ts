/**
 * Items on the ground last thirty minutes.
 *
 * A stack a player drops (or a script lays down) stays in the world until somebody picks it up or the server stops.
 * This takes away any that has lain there for thirty real minutes, so the roads do not fill with what people throw
 * away. Nothing on the ground is kept across a restart.
 */

const RESOURCE = "kcdc-gamemode";

export const GROUND_LIFETIME_MS = 30 * 60_000;
const SWEEP_EVERY_MS = 60_000;

export class GroundItemExpiry {
    /** When each stack was first seen, by its network id. */
    private readonly born = new Map<number, number>();

    constructor(
        private readonly lifetimeMs = GROUND_LIFETIME_MS,
        private readonly now: () => number = () => Date.now(),
    ) {}

    seen(id: number): void {
        if (!this.born.has(id)) {
            this.born.set(id, this.now());
        }
    }

    gone(id: number): void {
        this.born.delete(id);
    }

    /** Removes what has lain longer than its lifetime. Returns how many stacks went. */
    sweep(): number {
        const now = this.now();
        // Anything that appeared without an event (from before this script started, say) is dated from now.
        for (const item of GroundItem.all()) {
            this.seen(item.id);
        }
        let removed = 0;
        for (const [id, born] of [...this.born]) {
            if (now - born < this.lifetimeMs) {
                continue;
            }
            this.born.delete(id);
            const item = GroundItem.getById(id);
            if (item !== null) {
                item.destroy();
                removed += 1;
            }
        }
        return removed;
    }

    get tracked(): number {
        return this.born.size;
    }
}

export const groundItemExpiry = new GroundItemExpiry();

export function installGroundItemExpiry(): void {
    Events.on("groundItemSpawn", (item) => groundItemExpiry.seen(item.id));
    Events.on("groundItemDestroy", (item) => groundItemExpiry.gone(item.id));

    const timer = setInterval(() => {
        const removed = groundItemExpiry.sweep();
        if (removed > 0) {
            console.log(`ground: ${removed} item(ns) no chão sumiram depois de ${GROUND_LIFETIME_MS / 60_000} min`);
        }
    }, SWEEP_EVERY_MS);

    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });

    console.log(`ground: itens largados no chão somem depois de ${GROUND_LIFETIME_MS / 60_000} min`);
}
