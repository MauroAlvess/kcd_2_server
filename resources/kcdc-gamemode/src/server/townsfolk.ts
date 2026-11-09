/**
 * The people of this server who are not players: the body they all stand in, the walkable spot it is put on, and the
 * posts of those who only stand where they are put and talk through the game's choice list (the barbers and the skill
 * teachers). The vendors (`vendors.ts`) are townsfolk too, and walk about, so they keep their own day.
 *
 * A post has a day (`installPostLife`): by day it greets whoever comes near, looks at them, now and then takes a few steps
 * about its place, and says a word to whoever passes; at night it walks to the nearest door of a building and goes in, and
 * comes out of it in the morning (user, 2026-10-18: "eles precisam ir para dentro de casa à noite"). A post with no such door
 * within reach goes in where it stands, once nobody is near to see it (2026-10-25, user: "uns NPC dormem na rua"): nobody spends the
 * night in the street. A body that fell into a river, strayed or is shut in somewhere is made again at its place (`npc-keeper.ts`). And
 * a body that has no clothes on (the soul's own outfit not landing) is dressed in a villager's, so that nobody stands in the street in
 * his shirt (`clothe`).
 *
 * The framework forgets NPCs at every restart, and the level's own population is not run here, so each post is made
 * again from the lists a little after the server starts (once the level and the navigation mesh are up), and one that is
 * somehow brought down is back a moment later. Nobody can hurt them, nobody can loot them, and no name or health bar
 * floats over them, like the level's own townsfolk.
 */

import { maybeGesture } from "./idle-gestures.js";
import { keeperNote, npcKeeper } from "./npc-keeper.js";
import { speak, turnBackAfterTalk } from "./npc-speech.js";

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

/**
 * A townsperson's body: nobody's quest-giver, nobody's loot. With a `label` the body wears it as its nametag over its head (the guild vendors wear their trade, 2026-10-31); `name` is still
 * what picks its clothes.
 */
export function townsperson(soul: Soul, name: string, position: Vector3, yaw: number, outfit = "", label = ""): Npc {
    const options: Parameters<typeof Npc.create>[0] = {
        soul,
        position,
        rotation: new Vector3(0, 0, yaw),
        name: label !== "" ? label : name,
        nametag: label !== "",
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
    /** Whose posts these are, for the log: `barbers`, `teachers`, `travel`. */
    readonly label: string;
    standing(): ReadonlyMap<string, number>;
    readonly posts: readonly Post[];
    /** Takes the post's body out of the world for the night (it went in). */
    sleep(id: string): void;
    /** Makes the body of a post that slept again, at `position`; null when it was not asleep. */
    wake(id: string, position: Vector3, yaw: number): Npc | null;
    asleep(id: string): boolean;
}

export function installPosts(label: string, posts: readonly Post[], talk: (player: Player, post: Post, npc: Npc) => void): PostHandle {
    const byNpc = new Map<number, Post>();
    const bodies = new Map<string, number>();
    const sleeping = new Set<string>();

    const make = (post: Post, position: Vector3 = placeOf(post), yaw: number = post.yaw ?? 0): Npc => {
        const npc = townsperson(post.soul, post.name, position, yaw);
        byNpc.set(npc.id, post);
        bodies.set(post.id, npc.id);
        return npc;
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
            // It turns to the player, and back to its own way when the talk is over (2026-11-02).
            npc.lookAt(player);
            talk(player, post, npc);
            turnBackAfterTalk(npc, player, post.yaw ?? 0);
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
                if (sleeping.has(post.id)) {
                    return;
                }
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

    return {
        label,
        standing: () => bodies,
        posts,
        sleep(id: string): void {
            const npcId = bodies.get(id);
            sleeping.add(id);
            if (npcId === undefined) {
                return;
            }
            byNpc.delete(npcId);
            bodies.delete(id);
            Npc.getById(npcId)?.remove();
        },
        wake(id: string, position: Vector3, yaw: number): Npc | null {
            const post = posts.find((candidate) => candidate.id === id);
            if (post === undefined || !sleeping.has(id)) {
                return null;
            }
            sleeping.delete(id);
            return make(post, position, yaw);
        },
        asleep: (id: string) => sleeping.has(id),
    };
}

// ---------------------------------------------------------------------------------------------
// A post's day.

/**
 * At dusk and at dawn the whole town started at once: every post that went in planned its walk to a door (a route on the navigation mesh), and every post that
 * came out was made again, all in the same turn (up to 476 ms, perf-watch, 2026-10-26). Such an order is now given `perTurn` at a time in each `turnMs`, for
 * all the posts of all the handles together, and the rest of the town goes on the turns that follow.
 */
export const postOrders = { perTurn: 4, turnMs: 1_000 };
let ordersLeft = 0;
let ordersSince = Number.NEGATIVE_INFINITY;

function mayOrder(now: number): boolean {
    if (now - ordersSince >= postOrders.turnMs) {
        ordersSince = now;
        ordersLeft = postOrders.perTurn;
    }
    if (ordersLeft <= 0) {
        return false;
    }
    ordersLeft -= 1;
    return true;
}

export const postLife = {
    tickMs: 2_000,
    /** Who comes this near is looked at and greeted. */
    greetM: 5,
    greetAgainMs: 10 * 60_000,
    lookAgainMs: 4_000,
    /**
     * Nobody is left alone to stroll with somebody this near (a lesson or a haircut is on). It was 12 m, which kept every post
     * standing still the whole time a player looked at it (user, 2026-10-18: "ainda parecem só bonecos parados nas vilas").
     */
    quietM: 6,
    roamM: 12,
    pauseMs: [6_000, 16_000] as readonly [number, number],
    /** A word to whoever passes within this (and not nearer than `greetM`), once in a while. */
    chatM: 14,
    chatEveryMs: [150_000, 300_000] as readonly [number, number],
    open: 6,
    bed: 22,
    /** The door a post goes in at night: the level's nearest that belongs to a building, this near its place. */
    homeM: 70,
    arriveM: 2.5,
    /** A walk to the door that does not get there in this long is finished in one step; with nobody near, after a few seconds. */
    walkTimeoutMs: 180_000,
    unseenAfterMs: 20_000,
    unseenM: 80,
};

/** What a post says to whoever passes by, now and then (by day). */
export const AMBIENT_LINES: readonly string[] = [
    "Dizem que há salteadores na estrada de Kuttenberg.",
    "O tempo anda bom para a colheita.",
    "Ouvi dizer que o senhor destas terras vai dar uma festa.",
    "Cuidado com os lobos depois que escurece.",
    "O ferreiro não para de martelar desde cedo.",
    "Tem caça de sobra nos bosques, mas é preciso saber onde procurar.",
    "A taverna estava cheia ontem à noite.",
    "Vi um mercador passar com uma carroça cheia de tecidos.",
    "Dizem que o rei anda preocupado com os nobres do sul.",
    "Se for viajar, leve uma tocha. As noites são escuras.",
];

/** A door of the level, as much of it as the night needs. */
export interface DoorLike {
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    readonly areas: ReadonlyArray<{ contains(point: { x: number; y: number; z: number }): boolean }>;
}

/**
 * Where a post goes in at night: just outside the nearest of the level's doors that belongs to a building (a door the level's
 * areas link to a house, a workshop, a shop), within `homeM` of its place. Null when there is none.
 */
export function doorStepFor(spot: Spot, doors: readonly DoorLike[], homeM: number): Vector3 | null {
    let best: DoorLike | null = null;
    let nearest = homeM;
    for (const door of doors) {
        if (door.areas.length === 0) {
            continue;
        }
        const range = flatDistance(door.position, spot);
        if (range < nearest) {
            nearest = range;
            best = door;
        }
    }
    if (best === null) {
        return null;
    }
    const origin = best.position;
    for (const radius of [1.8, 2.6, 3.5]) {
        for (let bearing = 0; bearing < 12; bearing += 1) {
            const angle = (bearing / 12) * 2 * Math.PI;
            const raw = new Vector3(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, origin.z);
            const step = placeOf(raw);
            if (Navigation.ready && flatDistance(step, raw) > 1.2) {
                continue;
            }
            if (best.areas.some((area) => area.contains(step))) {
                continue;
            }
            return step;
        }
    }
    return placeOf(origin);
}

const GREETINGS = ["nod", "waveSmall", "nodSubmissive"];

function greetingWord(hour: number): string {
    const h = ((hour % 24) + 24) % 24;
    return h >= 5 && h < 12 ? "Bom dia!" : h >= 12 && h < 19 ? "Boa tarde!" : "Boa noite!";
}

const flatDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Gives the posts of `handle` a day: by day each greets whoever comes near (once in a while, with one of `lines` after the
 * greeting of the hour), looks at them, and strolls a few steps about its place when nobody is near; at night it goes in, by the
 * nearest door of a building or, with none near, where it stands.
 */
export function installPostLife(handle: PostHandle, lines: readonly string[], settings = postLife, doors: () => readonly DoorLike[] = () => Door.all()): void {
    interface Life {
        next: number;
        lookedAt: number;
        looking: number;
        greeted: Map<number, number>;
        chatAt: number;
        mode: "about" | "home" | "asleep";
        /** Where it goes in at night; undefined until it is looked for. */
        door?: Vector3 | null;
        /** Its place on the walkable ground, worked out once for the spot it was worked out for (`placeFor`): a post moved by an administrator gets its new one. */
        place?: Vector3;
        placeFor?: string;
        started: number;
    }
    const state = new Map<string, Life>();
    const timer = setInterval(() => {
        try {
            const now = Date.now();
            const hour = World.hour;
            const day = hour >= settings.open && hour < settings.bed;
            // The world everybody plays in is the global one (4294967295); a test against 0 alone left every real player out.
            const players = Player.all().filter((player) => player.ready && player.alive && (player.virtualWorld === 0 || player.virtualWorld === 0xffffffff));
            // Where each player is, in plain numbers, read once for the round: each `.x` of an engine's vector is a call into the engine, and every post below
            // measured every player (2026-10-28: the round was 4 ms of every call at thirty players).
            const standing = players.map((player) => {
                const at = player.position;
                return { player, x: at.x, y: at.y };
            });
            const nobodyNear = (point: { x: number; y: number }): boolean => {
                const spot = { x: point.x, y: point.y };
                return standing.every((one) => flatDistance(one, spot) > settings.unseenM);
            };
            for (const post of handle.posts) {
                let mine = state.get(post.id);
                if (mine === undefined) {
                    mine = { next: now + 5_000 + Math.random() * 20_000, lookedAt: 0, looking: 0, greeted: new Map(), chatAt: now + settings.chatEveryMs[0] * Math.random(), mode: "about", started: 0 };
                    state.set(post.id, mine);
                }
                if (handle.asleep(post.id)) {
                    if (day) {
                        // The morning is spread over the turns: a post is made again `postOrders.perTurn` at a time.
                        if (!mayOrder(now)) {
                            continue;
                        }
                        // Morning: out of the door, and back to its place.
                        const body = handle.wake(post.id, mine.door ?? placeOf(post), post.yaw ?? 0);
                        mine.mode = "about";
                        mine.next = now + 4_000;
                        if (body !== null && mine.door) {
                            body.moveTo(placeOf(post), { speed: "walk", pathfinding: Navigation.ready ? "server" : "game", radius: 1.5 });
                        }
                    }
                    continue;
                }
                const npcId = handle.standing().get(post.id);
                const npc = npcId === undefined ? null : Npc.getById(npcId);
                if (npc === null || !npc.alive) {
                    continue;
                }
                // Fallen into a river, strayed or shut in a house: made again at its place by day, in for the night by night (`npc-keeper.ts`).
                const here = npc.position;
                const hereFlat = { x: here.x, y: here.y };
                const spotKey = `${post.x},${post.y},${post.z}`;
                if (mine.placeFor !== spotKey) {
                    mine.place = undefined;
                    mine.door = undefined;
                    mine.placeFor = spotKey;
                }
                const place = mine.place ?? placeOf(post);
                if (Navigation.ready) {
                    mine.place = place;
                }
                // It walks about its place, and in the morning from its door back to it.
                const walks = Math.max(settings.roamM, mine.door ? flatDistance(mine.door, place) : 0);
                const stray = npcKeeper.look(`${handle.label}:${post.id}`, here, place, walks, now, mine.mode === "home");
                if (stray !== null) {
                    console.log(keeperNote(handle.label, post.name, here, place, stray, npcKeeper.rescued(`${handle.label}:${post.id}`, now)));
                    handle.sleep(post.id);
                    if (day) {
                        handle.wake(post.id, place, post.yaw ?? 0);
                        mine.mode = "about";
                        mine.next = now + 4_000;
                    } else {
                        mine.mode = "asleep";
                    }
                    continue;
                }
                if (!day) {
                    if (mine.door === undefined) {
                        mine.door = doorStepFor(post, doors(), settings.homeM);
                    }
                    const door = mine.door;
                    if (door !== null) {
                        if (mine.mode !== "home") {
                            // The evening too: a post sets out for its door when its turn comes.
                            if (!mayOrder(now)) {
                                continue;
                            }
                            mine.mode = "home";
                            mine.started = now;
                            npc.moveTo(door, { speed: "walk", pathfinding: Navigation.ready ? "server" : "game", radius: 1.5 });
                        } else if (
                            flatDistance(npc.position, door) <= settings.arriveM ||
                            now - mine.started >= settings.walkTimeoutMs ||
                            (now - mine.started >= settings.unseenAfterMs && nobodyNear(npc.position) && nobodyNear(door))
                        ) {
                            // At the door: in, to bed.
                            handle.sleep(post.id);
                            mine.mode = "asleep";
                        }
                        continue;
                    }
                    // No door near: in for the night where it stands, once nobody is near to see it go.
                    if (mine.mode !== "home") {
                        mine.mode = "home";
                        mine.started = now;
                    } else if (now - mine.started >= settings.unseenAfterMs && nobodyNear(here)) {
                        handle.sleep(post.id);
                        mine.mode = "asleep";
                        continue;
                    }
                } else if (mine.mode === "home") {
                    // Day came while it walked home.
                    mine.mode = "about";
                    npc.hold();
                }
                const nearest = standing.filter((one) => flatDistance(one, hereFlat) <= settings.greetM).sort((a, b) => flatDistance(a, hereFlat) - flatDistance(b, hereFlat))[0];
                const near = nearest?.player;
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
                        // Said to the one greeted, in their chat card too (`npc-speech.ts`): the game's line over the body was not seen.
                        speak(npc, post.name, `${greetingWord(hour)}${line}`, { to: [near] });
                    }
                    continue;
                }
                mine.looking = 0;
                // A word to whoever passes by, now and then.
                const passer = day ? standing.find((one) => flatDistance(one, hereFlat) <= settings.chatM)?.player : undefined;
                if (passer !== undefined && now >= mine.chatAt) {
                    const [soon, late] = settings.chatEveryMs;
                    mine.chatAt = now + soon + Math.random() * (late - soon);
                    npc.lookAt(passer);
                    speak(npc, post.name, AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)] ?? "", { to: [passer] });
                }
                if (!day || !Navigation.ready || now < mine.next || npc.status === "running" || standing.some((one) => flatDistance(one, hereFlat) <= settings.quietM)) {
                    continue;
                }
                const [low, high] = settings.pauseMs;
                mine.next = now + low + Math.random() * (high - low);
                if (maybeGesture(npc, now)) {
                    mine.next = now + 5_000 + Math.random() * 4_000;
                    continue;
                }
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
