/**
 * The people of this server who are not players: the body they all stand in, the walkable spot it is put on, and the
 * posts of those who only stand where they are put and talk through the game's choice list (the barbers and the skill
 * teachers). The vendors (`vendors.ts`) are townsfolk too, and walk about, so they keep their own day.
 *
 * A post has a day (`installPostLife`): by day it greets whoever comes near, looks at them, and now and then takes a few
 * steps about its place; at night it stands. And a body that has no clothes on (the soul's own outfit not landing) is
 * dressed in a villager's, so that nobody stands in the street in his shirt (`clothe`).
 *
 * The framework forgets NPCs at every restart, and the level's own population is not run here, so each post is made
 * again from the lists a little after the server starts (once the level and the navigation mesh are up), and one that is
 * somehow brought down is back a moment later. Nobody can hurt them, nobody can loot them, and no name or health bar
 * floats over them, like the level's own townsfolk.
 */

const RESOURCE = "kcdc-gamemode";

/** The NPCs appear this long after the server starts, so the level and the navigation mesh are up. */
export const SPAWN_AFTER_MS = 15_000;
/** One brought down is back this long after. */
export const REVIVE_AFTER_MS = 10_000;

export type Soul = "townsman" | "townswoman";

export interface Spot {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** A person who stands at a place and talks. */
export interface Post extends Spot {
    readonly id: string;
    readonly name: string;
    readonly soul: Soul;
    readonly yaw?: number;
}

/** Where to put a body for a spot: the nearest walkable ground, or the spot itself while there is no mesh. */
export function placeOf(spot: Spot): Vector3 {
    const raw = new Vector3(spot.x, spot.y, spot.z);
    if (Navigation.ready) {
        const snapped = Navigation.closestPoint(raw, { searchRadius: 6, searchHeight: 8, doors: "none" });
        if (snapped !== null) {
            return snapped;
        }
    }
    return raw;
}

/**
 * What a body with nothing on is dressed in: villagers' outfits from the game's table `clothing_preset`, by GUID (a preset's
 * name is not taken by `setOutfit` or the `outfit` option: the names the first version used left the bodies bare, which is what
 * the user saw on the pedlars by the fires, 2026-10-17). Several of each, so a village is not one man and one woman repeated:
 * labourer_05, villager_42, 30, 50, 44, 26, labourer_50 and villager_34; f_villager_31, 30, 19, 24 and 08. Only presets the server's own
 * build has (`KCDCServer` holds 1889 of the game's 2702: a GUID it lacks logs "names clothing preset ..., which this build does not have" and leaves the body bare).
 */
export const VILLAGER_OUTFITS: Readonly<Record<Soul, readonly string[]>> = {
    townsman: [
        "3c047c94-255e-46b4-bbc1-4ba85c987e50",
        "0c305afc-b6d3-4496-a8a9-3c1209b9b6a4",
        "1a5eeadd-a4bf-4902-895b-64f8b7050142",
        "1eff9522-76b0-4c95-9626-ed6d13b423db",
        "1f2ea527-5420-4626-af3f-7c0418f2f40e",
        "23673622-5b84-4c56-b2fd-ca5326a960d8",
        "25165eae-8e86-4945-82f2-2df702f1a554",
        "384fed12-8bed-4787-8579-1a5a2cca3004",
    ],
    townswoman: [
        "18aace1e-eb89-4894-a4b0-964dec1b3a5f",
        "05602b37-1320-4925-b53f-c5e6ff47c8b3",
        "137293ba-ed65-406f-9abf-532fbfbeca51",
        "294358ea-c28a-449d-a4c2-5a85ce21ef44",
        "08fd88a1-0f0e-4de2-8ba9-c4689ebc29a5",
    ],
};

/** One of the soul's villager outfits, always the same for the same seed (a name and a place), so a body made again is dressed as before. */
export function outfitFor(soul: Soul, seed: string): string {
    const pool = VILLAGER_OUTFITS[soul];
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return pool[hash % pool.length] as string;
}

/** How long after a body is made it is looked at, to see whether it is dressed. */
export const CLOTHE_AFTER_MS = 4_000;

/** Dresses a body in a villager's outfit when it wears nothing. True when it did. */
export function clothe(npc: Npc, soul: Soul, seed: string = String(npc.id)): boolean {
    try {
        if (npc.wearing.length > 0) {
            return false;
        }
        return npc.setOutfit(outfitFor(soul, seed));
    } catch (error: unknown) {
        console.log(`townsfolk: não consegui vestir ${npc.id}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** A townsperson's body: nobody's quest-giver, nobody's loot. */
export function townsperson(soul: Soul, name: string, position: Vector3, yaw: number, outfit = ""): Npc {
    const options: Parameters<typeof Npc.create>[0] = {
        soul,
        position,
        rotation: new Vector3(0, 0, yaw),
        name,
        nametag: false,
        interactable: true,
        invulnerable: true,
        lootable: false,
    };
    // A body is made dressed: the given outfit, or a villager's picked by its name and place.
    options.outfit = outfit !== "" ? outfit : outfitFor(soul, `${name}@${Math.round(position.x)},${Math.round(position.y)}`);
    const npc = Npc.create(options);
    npc.setNametagHealthVisible(false);
    if (outfit === "") {
        // The soul's own clothes are put on while the body is made; a body found bare a moment later is dressed.
        const id = npc.id;
        setTimeout(() => {
            const body = Npc.getById(id);
            if (body !== null) {
                clothe(body, soul, name);
            }
        }, CLOTHE_AFTER_MS);
    }
    return npc;
}

/**
 * Keeps `posts` standing, and `talk` is what happens when a player uses the key on one of them. Returns how many bodies
 * stand (once they have been made), for a test or an administrator's list.
 */
export interface PostHandle {
    standing(): ReadonlyMap<string, number>;
    readonly posts: readonly Post[];
}

export function installPosts(label: string, posts: readonly Post[], talk: (player: Player, post: Post, npc: Npc) => void): PostHandle {
    const byNpc = new Map<number, Post>();
    const bodies = new Map<string, number>();

    const make = (post: Post): void => {
        const npc = townsperson(post.soul, post.name, placeOf(post), post.yaw ?? 0);
        byNpc.set(npc.id, post);
        bodies.set(post.id, npc.id);
    };

    const spawn = setTimeout(() => {
        let made = 0;
        for (const post of posts) {
            try {
                make(post);
                made += 1;
            } catch (error: unknown) {
                console.error(`${label}: não consegui criar ${post.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        console.log(`${label}: ${made} de ${posts.length} no lugar`);
    }, SPAWN_AFTER_MS);

    Events.on("npcInteract", (npc, player) => {
        const post = byNpc.get(npc.id);
        if (post !== undefined) {
            npc.lookAt(player);
            talk(player, post, npc);
        }
    });

    Events.on("npcDeath", (npc) => {
        const post = byNpc.get(npc.id);
        if (post === undefined) {
            return;
        }
        byNpc.delete(npc.id);
        setTimeout(() => {
            try {
                Npc.getById(npc.id)?.remove();
                make(post);
            } catch (error: unknown) {
                console.error(`${label}: ${post.id} não voltou: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, REVIVE_AFTER_MS);
    });

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearTimeout(spawn);
        for (const id of bodies.values()) {
            Npc.getById(id)?.remove();
        }
        byNpc.clear();
        bodies.clear();
    });

    return { standing: () => bodies, posts };
}

// ---------------------------------------------------------------------------------------------
// A post's day.

export const postLife = {
    tickMs: 2_000,
    /** Who comes this near is looked at and greeted. */
    greetM: 5,
    greetAgainMs: 10 * 60_000,
    lookAgainMs: 4_000,
    /** Nobody is left alone to stroll with somebody this near (a lesson or a haircut is on). */
    quietM: 12,
    roamM: 12,
    pauseMs: [8_000, 25_000] as readonly [number, number],
    open: 6,
    bed: 22,
};

const GREETINGS = ["nod", "waveSmall", "nodSubmissive"];

function greetingWord(hour: number): string {
    const h = ((hour % 24) + 24) % 24;
    return h >= 5 && h < 12 ? "Bom dia!" : h >= 12 && h < 19 ? "Boa tarde!" : "Boa noite!";
}

const flatDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Gives the posts of `handle` a day: by day each greets whoever comes near (once in a while, with one of `lines` after the
 * greeting of the hour), looks at them, and strolls a few steps about its place when nobody is near; at night it stands.
 */
export function installPostLife(handle: PostHandle, lines: readonly string[], settings = postLife): void {
    const state = new Map<string, { next: number; lookedAt: number; looking: number; greeted: Map<number, number> }>();
    const timer = setInterval(() => {
        try {
            const now = Date.now();
            const hour = World.hour;
            const day = hour >= settings.open && hour < settings.bed;
            const players = Player.all().filter((player) => player.ready && player.alive && player.virtualWorld === 0);
            for (const post of handle.posts) {
                const npcId = handle.standing().get(post.id);
                const npc = npcId === undefined ? null : Npc.getById(npcId);
                if (npc === null || !npc.alive) {
                    continue;
                }
                let mine = state.get(post.id);
                if (mine === undefined) {
                    mine = { next: now + 5_000 + Math.random() * 20_000, lookedAt: 0, looking: 0, greeted: new Map() };
                    state.set(post.id, mine);
                }
                const here = npc.position;
                const near = players.filter((player) => flatDistance(player.position, here) <= settings.greetM).sort((a, b) => flatDistance(a.position, here) - flatDistance(b.position, here))[0];
                if (near !== undefined) {
                    if (npc.status === "running") {
                        npc.hold();
                    }
                    if (mine.looking !== near.id || now - mine.lookedAt >= settings.lookAgainMs) {
                        npc.lookAt(near);
                        mine.looking = near.id;
                        mine.lookedAt = now;
                    }
                    if (day && now - (mine.greeted.get(near.id) ?? Number.NEGATIVE_INFINITY) >= settings.greetAgainMs) {
                        mine.greeted.set(near.id, now);
                        npc.playAnimation("GreetingsUpperBody", { tags: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] });
                        const line = lines.length === 0 ? "" : ` ${lines[Math.floor(Math.random() * lines.length)]}`;
                        npc.say(`${greetingWord(hour)}${line}`);
                    }
                    continue;
                }
                mine.looking = 0;
                if (!day || !Navigation.ready || now < mine.next || npc.status === "running" || players.some((player) => flatDistance(player.position, here) <= settings.quietM)) {
                    continue;
                }
                const [low, high] = settings.pauseMs;
                mine.next = now + low + Math.random() * (high - low);
                const spot = Navigation.randomPoint(placeOf(post), settings.roamM, { doors: "none" });
                if (spot !== null) {
                    npc.moveTo(spot, { speed: "walk", pathfinding: "server", radius: 1.5 });
                }
            }
        } catch (error: unknown) {
            console.log(`townsfolk: o dia dos postos tropeçou: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, settings.tickMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
