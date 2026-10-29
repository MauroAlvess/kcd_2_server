/**
 * Containers the level places that the server fills again every forty minutes: eggs in the nests, fish in the fishing
 * traps, honey in the beehives (user, 2026-10-16: "nos lugares onde tem ovos, ninho de galinha e etc, vamos colocar ovos que
 * voltam a cada 40m"; then "tem umas armadilhas de pesca no jogo também, coloque peixes nelas, mesmo esquema dos ovos"; and on
 * 2026-10-19 "adicione mel nos lugares de abelha para poder pegar"). The game's beehive is the container prefab `Stash/bee_hive`
 * (a hive box that restocks every four game days from the preset `inventory_beeHive`); the forest's wild hives and the
 * beekeeper's skeps are only scenery.
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
    /** How often the containers that are due are filled. */
    lookEveryMs: 60_000,
    /**
     * How often the level is looked through again for containers it reported late. Every look reads each of the level's containers (a few thousand, a native
     * read or two each, three kinds): it was done every minute and stalled the server for up to 300 ms each time (perf-watch, 2026-10-26), though nothing is
     * reported after the first minutes; so it is rare, and done in slices.
     */
    rescanEveryMs: 10 * 60_000,
    /** How many containers one slice of a look reads, and the pause between slices. */
    scanChunk: 250,
    scanGapMs: 80,
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
    /** Now and then a second stack beside the first: the feather a hen leaves in her nest (2026-10-27: the fletching of the arrows had only the smiths' vendors to come from). */
    readonly extra?: { readonly item: string; readonly chance: number; readonly min: number; readonly max: number };
}

export const EGGS: Refill = {
    name: "nests",
    what: "ninho(s) do nível ganham ovos",
    pattern: /nest|coop/i,
    items: ["egg"],
    min: 1,
    max: 3,
    extra: { item: "special_featherRooster", chance: 0.4, min: 1, max: 2 },
};
export const FISH: Refill = { name: "traps", what: "armadilha(s) de pesca do nível ganham peixes", pattern: /fish_trap/i, items: ["perch", "trout", "crayfish"], min: 2, max: 4 };
export const HONEY: Refill = { name: "hives", what: "colmeia(s) do nível ganham mel", pattern: /bee_?hive/i, items: ["honey"], min: 1, max: 2 };

interface Filled {
    readonly guid: string;
    filledAt: number;
}

export class Nests {
    private readonly found: Filled[] = [];
    /** The level GUIDs of `found`, so that a look does not search a list for each container. */
    private readonly known = new Set<string>();
    private classes: string[] | null = null;
    /** The class of `kind.extra`, "" when the game has none (the nest then gets only its first stack). */
    private extraClass = "";

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
            const guid = stash.levelGuid;
            if (guid !== "" && !this.known.has(guid) && this.kind.pattern.test(stash.name)) {
                this.known.add(guid);
                this.found.push({ guid, filledAt: -Infinity });
            }
        }
        return this.found.length;
    }

    /** Fills every container that is due and that nobody is near. Returns how many were filled. */
    fill(players: ReadonlyArray<{ readonly position: { readonly x: number; readonly y: number } }>): number {
        if (this.classes === null) {
            const known = this.resolve(this.kind.extra === undefined ? this.kind.items : [...this.kind.items, this.kind.extra.item]);
            this.classes = this.kind.items.flatMap((name) => known.get(name) ?? []);
            this.extraClass = this.kind.extra === undefined ? "" : (known.get(this.kind.extra.item) ?? "");
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
            const stacks = [{ item, amount }];
            const extra = this.kind.extra;
            if (extra !== undefined && this.extraClass !== "" && this.random() < extra.chance) {
                stacks.push({ item: this.extraClass, amount: extra.min + Math.floor(this.random() * (extra.max - extra.min + 1)) });
            }
            if (stash.setInventory({ items: stacks }).ok) {
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
export const hives = new Nests(HONEY);

export function installNests(): void {
    const all = [nests, traps, hives];
    const timers = new Set<unknown>();
    const players = (): Array<{ position: { x: number; y: number } }> => Player.all().filter((player) => player.ready && (player.virtualWorld === 0 || player.virtualWorld === 0xffffffff));

    /** Looks through the level's containers once for the three kinds (one `Stash.all()`, not three), a slice at a time, and then says `done`. */
    const scan = (done: () => void): void => {
        const stashes = Stash.all();
        let at = 0;
        const step = (): void => {
            const part = stashes.slice(at, at + nestSettings.scanChunk);
            at += part.length;
            for (const group of all) {
                group.find(part);
            }
            if (at < stashes.length) {
                timers.add(setTimeout(step, nestSettings.scanGapMs));
            } else {
                done();
            }
        };
        step();
    };

    const first = setTimeout(() => {
        scan(() => {
            for (const group of all) {
                const found = group.count();
                const filled = group.fill(players());
                console.log(found === 0 ? `${group.kind.name}: o nível não tem esses baús` : `${group.kind.name}: ${found} ${group.kind.what} a cada ${nestSettings.everyMs / 60_000} min; ${filled} já cheios${group.ready() ? "" : " (o jogo não conhece o item)"}; por exemplo ${group.kinds().join(" | ")}`);
            }
            // The containers that are due are filled every minute, with what was found; a container the level reports late joins them on a rarer look.
            timers.add(
                setInterval(() => {
                    for (const group of all) {
                        group.fill(players());
                    }
                }, nestSettings.lookEveryMs),
            );
            timers.add(setInterval(() => scan(() => undefined), nestSettings.rescanEveryMs));
        });
    }, nestSettings.firstAfterMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearTimeout(first);
            for (const timer of timers) {
                clearInterval(timer as never);
                clearTimeout(timer as never);
            }
        }
    });
}
