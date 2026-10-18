/**
 * Containers the level places that the server fills again every forty minutes: eggs in the nests, fish in the fishing
 * traps (user, 2026-10-16: "nos lugares onde tem ovos, ninho de galinha e etc, vamos colocar ovos que voltam a cada 40m";
 * then "tem umas armadilhas de pesca no jogo também, coloque peixes nelas, mesmo esquema dos ovos").
 *
 * The level places its hens' nests as containers of their own -- a hen coop in a village's henhouse
 * (`Stash2[animalcare/henCareNN:henCare_coop1...]`, 87 of them with the prefabs) and a few bird's nests
 * (`Nest[Stash/nestNN]`) -- and its fishing traps (`Stash[Stash/fish_trap_cageN]`), and in a game of one player they
 * hold what was caught. Nothing fills them here, so the server does: now and again every forty real minutes, a little
 * of what belongs in each, while nobody is near and nobody has it open. What a container held is replaced, like a camp's
 * chest. The hens' egg baskets of the villages are the townsfolk's chores, not containers, and the game's own chickens
 * are left out of the multiplayer mod (it cannot make them), so the nests are what there is.
 */

import { resolveItems } from "./bandits.js";

const RESOURCE = "kcdc-gamemode";

export const nestSettings = {
    everyMs: 40 * 60_000,
    /** Nobody this close when a container is filled, so things do not appear under somebody's eyes. */
    clearM: 25,
    /** The level reports its containers a little after the start. */
    firstAfterMs: 30_000,
    lookEveryMs: 60_000,
};

/** What to fill, and with what: one stack of one of `items` (table names), `min` to `max` of it. */
export interface Refill {
    /** The word in the log. */
    readonly name: string;
    readonly what: string;
    readonly pattern: RegExp;
    readonly items: readonly string[];
    readonly min: number;
    readonly max: number;
}

export const EGGS: Refill = { name: "nests", what: "ninho(s) do nível ganham ovos", pattern: /nest|coop/i, items: ["egg"], min: 1, max: 3 };
export const FISH: Refill = { name: "traps", what: "armadilha(s) de pesca do nível ganham peixes", pattern: /fish_trap/i, items: ["perch", "trout", "crayfish"], min: 2, max: 4 };

interface Filled {
    readonly guid: string;
    filledAt: number;
}

export class Nests {
    private readonly found: Filled[] = [];
    private classes: string[] | null = null;

    constructor(
        readonly kind: Refill,
        private readonly settings = nestSettings,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
        private readonly resolve: (names: readonly string[]) => Map<string, string> = resolveItems,
    ) {}

    /** Finds the level's containers of this kind. Returns how many there are. */
    find(stashes: readonly Stash[]): number {
        for (const stash of stashes) {
            if (stash.levelGuid !== "" && this.kind.pattern.test(stash.name) && !this.found.some((entry) => entry.guid === stash.levelGuid)) {
                this.found.push({ guid: stash.levelGuid, filledAt: -Infinity });
            }
        }
        return this.found.length;
    }

    /** Fills every container that is due and that nobody is near. Returns how many were filled. */
    fill(players: ReadonlyArray<{ readonly position: { readonly x: number; readonly y: number } }>): number {
        if (this.classes === null) {
            const known = this.resolve(this.kind.items);
            this.classes = this.kind.items.flatMap((name) => known.get(name) ?? []);
        }
        if (this.classes.length === 0) {
            return 0;
        }
        const now = this.now();
        let filled = 0;
        for (const entry of this.found) {
            if (now - entry.filledAt < this.settings.everyMs) {
                continue;
            }
            const stash = Stash.find(entry.guid);
            if (stash === null || stash.isOpen || players.some((player) => Math.hypot(player.position.x - stash.position.x, player.position.y - stash.position.y) < this.settings.clearM)) {
                continue;
            }
            const item = this.classes[Math.floor(this.random() * this.classes.length)] ?? this.classes[0]!;
            const amount = this.kind.min + Math.floor(this.random() * (this.kind.max - this.kind.min + 1));
            if (stash.setInventory({ items: [{ item, amount }] }).ok) {
                entry.filledAt = now;
                filled += 1;
            }
        }
        return filled;
    }

    count(): number {
        return this.found.length;
    }

    /** Whether the game knows any of the items to fill with. */
    ready(): boolean {
        return this.classes === null || this.classes.length > 0;
    }

    /** A few of the kinds of container found, by name with the numbers taken out, for the log: it says what was filled. */
    kinds(): string[] {
        const names = this.found.map((entry) => (Stash.find(entry.guid)?.name ?? "").replace(/\d+/g, "N").slice(0, 70));
        return [...new Set(names)].slice(0, 4);
    }
}

export const nests = new Nests(EGGS);
export const traps = new Nests(FISH);

export function installNests(): void {
    const all = [nests, traps];
    let timer: ReturnType<typeof setInterval> | null = null;
    const players = (): Array<{ position: { x: number; y: number } }> => Player.all().filter((player) => player.ready && player.virtualWorld === 0);
    const first = setTimeout(() => {
        for (const group of all) {
            const found = group.find(Stash.all());
            const filled = group.fill(players());
            console.log(found === 0 ? `${group.kind.name}: o nível não tem esses baús` : `${group.kind.name}: ${found} ${group.kind.what} a cada ${nestSettings.everyMs / 60_000} min; ${filled} já cheios${group.ready() ? "" : " (o jogo não conhece o item)"}; por exemplo ${group.kinds().join(" | ")}`);
        }
        // A container the level reports late joins the rest on the next look.
        timer = setInterval(() => {
            for (const group of all) {
                group.find(Stash.all());
                group.fill(players());
            }
        }, nestSettings.lookEveryMs);
    }, nestSettings.firstAfterMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearTimeout(first);
            if (timer !== null) {
                clearInterval(timer);
            }
        }
    });
}
