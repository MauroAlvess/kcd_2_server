/**
 * The wild horses of the open fields, and how a Domador tames one. It was the Agricultores' trade when it was made (user, 2026-10-22: "a gente
 * colocar cavalos espalhados pelos mapas em campos abertos, sem sela nem roupa, e o agricultor consegue interagir com eles; eles sempre correm
 * um pouco dos jogadores, mas o agricultor eles chegam perto; à medida que ele vai alimentando o cavalo, o cavalo vai dando carinho a ele, e
 * quando ele ganha a confiança ele pode mandar o cavalo seguir ou até montar, e aparece nos meus animais, permitindo editar nome"), and the
 * whole of it went to a guild of its own on 2026-10-25 (user: "vamos separar a mecânica de domar cavalo totalmente da guilda dos
 * agricultores e criar a guilda de domadores, colocando a mecânica completa de domar cavalo nessa nova guilda"): the Domitores, the craft
 * `domar` of `guild-crafts.ts`. The Agricultores keep the gardens and nothing of this.
 *
 * **Where.** `data/farm.json` (`tools/make-farm-data.py`): twenty-one open meadows, away from the villages, found on the navigation mesh; each
 * holds `wildHorseSettings.perMeadow` horses, bare (no saddle, no cloth, `gearLocked`), grazing round their meadow. A slot is a horse's place:
 * what breed stands in it and how far each player has won it over are kept in `playerdata/wild-horses.json`, so a restart does not undo a
 * taming; a horse that is tamed or killed is replaced by another of another breed after `respawnMs`.
 *
 * **How they behave.** Whoever is not a Domador frightens them from `fleeM` (further when riding): the horse runs away from them, a way off
 * the player along the mesh, and comes back to graze when they are gone. A Domador who walks (`calmMps` or less) can come up to a horse: it
 * stands watching, and runs only from one who runs at it.
 *
 * **How a horse is won.** E at it (`horse-menu.ts` hooks, "Domar") opens a menu: "Oferecer" a carrot, an apple, a pear, a beet, a turnip or
 * bread from the bag, once a `feedCooldownMs`, each worth some trust of `tameAt`; the Domador pets it (the game's own petting, for a man)
 * and the menu comes back with how much it trusts them. At the full trust the menu offers **Montar** and **Mandar seguir**: either makes the
 * horse theirs (`giveTo`: `horses.ts` files it, and it is in their Animais, to name, give or leave), and the second sends it
 * after them (`horse-follow.ts`). Nobody who is not a Domador may mount a wild horse; the game's own climb is refused.
 *
 * **More than the carrot (user, 2026-10-28: "além da cenoura poder dar maçã e pera, assim dando mais chance de domar o cavalo").** The apple and the pear were
 * already treats (since 2026-10-22), but the menu showed one row, "Oferecer cenoura", the best the bag had, and a player with apples and pears never saw them.
 * Now the menu has a row for each kind of treat the bag holds, and each kind has its own wait (`feedCooldownMs`) beside a short gap between any two feedings
 * (`feedGapMs`): a tamer who carries a carrot, an apple and a pear may give all three in a minute and a half instead of one, and the horse is won over in a third of
 * the time. The trust each treat gives is the same as before.
 *
 * **Harder (user, 2026-10-23: "deixe mais difícil domar um cavalo").** A treat is worth about a third of what it was (the best, a carrot, five
 * points of a hundred: twenty feedings, half an hour at a feeding every minute and a half); a horse that does not trust them yet may turn a
 * treat down (35% at no trust, fading to none at half); and what is not kept up fades: after twenty minutes without a feeding the trust goes
 * down a point every six.
 *
 * **Dressed (same day: "quando um cavalo ficar 100% domado ele recebe sela e coisas básicas para poder montar já setados nele via códigos").**
 * The horse that becomes theirs is put in the game's plain tack before it is given: a saddle, a bridle and horseshoes, one of the generic
 * `horse_common` sets (`BASIC_TACK`), or the same pieces by name when the preset is not there. The saddle brings the saddlebags.
 */

import { farmData } from "./farm-data.js";
import { mayCraft } from "./guild-crafts.js";
import { startFollowing } from "./horse-follow.js";
import { askExtras, grantClimb, nearExtras } from "./horse-menu.js";
import { languageOf, translate } from "./language.js";
import { ensureDir, read, write } from "./store.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const NOTIFY = `${RESOURCE}:notify`;
const DIR = "playerdata";
const FILE = `${DIR}/wild-horses.json`;

export const wildHorseSettings = {
    perMeadow: 2,
    name: "Cavalo selvagem",
    /** How often the horses look about them. */
    tickMs: 700,
    /** How near a player who is not a Domador frightens them (further when the player rides). */
    fleeM: 14,
    fleeRidingM: 22,
    /** How near a Domador who runs or sprints at one frightens it, and how fast is "running" (metres a second). */
    tamerFleeM: 9,
    calmMps: 3.4,
    /** A calm Domador this near makes a grazing horse stand and watch. */
    watchM: 10,
    /** How far a frightened horse runs, how far from its meadow it may go, and how long before it is frightened again. */
    runM: 20,
    leashM: 70,
    fleeAgainMs: 4_000,
    /** Nobody near this long, and it goes back to grazing. */
    calmAfterMs: 20_000,
    /** What a feeding is: the wait before the same kind of treat is given again, the shortest wait between two feedings of any kind, and how long a horse is held for the Domador who has its menu up. */
    feedCooldownMs: 90_000,
    feedGapMs: 20_000,
    heldMs: 15_000,
    /** Trust that is not kept up fades: nothing for this long after a feeding, then a point every `forgetEveryMs`. */
    forgetAfterMs: 20 * 60_000,
    forgetEveryMs: 6 * 60_000,
    /** A horse may turn a treat down while it does not trust enough: this chance at no trust at all, fading to none at `refuseUntil` of 100. */
    refuseChance: 0.35,
    refuseUntil: 50,
    /** The trust at which a horse is theirs to take. */
    tameAt: 100,
    /** How long before a tamed or dead horse's place has another, and a horse that was simply lost. */
    respawnMs: 6 * 60 * 60_000,
    lostMs: 2 * 60_000,
    /** A horse is let graze this seldom, so a mesh that gives it no path is not asked again at every look. */
    grazeEveryMs: 20_000,
    /** How long the petting plays, in milliseconds. */
    petMs: 5_000,
    /** How far from the menu's horse the player may be when they choose. */
    reachM: 5,
};

/** What a horse takes from the bag, best first, and the trust each gives. The class GUIDs are the game's. */
export const TREATS: ReadonlyArray<{ readonly guid: string; readonly name: string; readonly the: string; readonly trust: number }> = [
    { guid: "b7ee311c-736b-4f7c-987b-8431ce3b5600", name: "cenoura", the: "a cenoura", trust: 5 },
    { guid: "2264f217-590e-4c0f-a4c6-f50c6532b9f6", name: "maçã", the: "a maçã", trust: 4.5 },
    { guid: "2eeb7bf7-f0ac-4c46-9468-97c2f76cb254", name: "pera", the: "a pera", trust: 4 },
    { guid: "7899825d-ed6f-4f00-b698-649ba652cf6d", name: "beterraba", the: "a beterraba", trust: 3 },
    { guid: "ea84be32-b3fc-4dfa-8dab-7169bd9e441d", name: "nabo", the: "o nabo", trust: 3 },
    { guid: "86e4ff24-88db-4024-abe6-46545fa0fbd1", name: "pão", the: "o pão", trust: 2 },
];

/** At most this many kinds of treat get a row of their own in the menu (a page has eight rows, and Montar, Mandar seguir and Sair take three). */
const MENU_TREATS = 4;

/**
 * The game's plain tack for a horse that has become somebody's: its generic `horse_common` sets of a Praga saddle, soft leather reins and the
 * farmer's or the soldier's shoes (`Libs/Tables/item/clothing_preset.xml`), the sets the game puts on a village horse. `PLAIN_PIECES` are the
 * same by name, for a server whose presets do not have them.
 */
export const BASIC_TACK: readonly string[] = ["horse_common01", "horse_common02", "horse_common05", "horse_common18"];
export const PLAIN_PIECES = { saddle: "BasicSaddle01_m03", head: "BasicBridle01_m01", shoe: "horseshoeMilitary" } as const;

/** The breeds a wild horse may be (the ones the game sells, with its plain riding horse), those the server's `Horse.breeds()` knows. */
const BREEDS = ["horse", "pebbles", "bitterklee", "soldier", "tarant", "kasztanka", "khartoum", "crow", "artax", "erdel", "shlamhak", "bill", "mark", "kincsem", "pisek_lad", "gavora", "napoli", "svadilfari", "veillantif", "windwurf", "kluger_hans", "jarmilka", "acorn", "meadow"];

interface Bond {
    trust: number;
    /** When the horse was last fed with anything: the trust fades from it. */
    fedAt: number;
    /** When each kind of treat (its class GUID) was last given; absent for a bond kept from before the kinds had their own wait (then `fedAt` counts for all of them). */
    fed?: Record<string, number>;
}

interface Slot {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** The angle this horse's grazing round the meadow starts at, in degrees. */
    readonly angle: number;
    soul: string;
    /** 0 while it has a horse; the time its place may have another, after one was tamed or killed. */
    takenUntil: number;
    bonds: Record<string, Bond>;
    horseId: number;
}

interface Wild {
    readonly slot: Slot;
    lastFleeAt: number;
    lastThreatAt: number;
    patrolling: boolean;
    heldUntil: number;
    /** The next time it may be set grazing. */
    grazeAt: number;
}

const slots = new Map<string, Slot>();
const wilds = new Map<number, Wild>();
const speeds = new Map<number, { x: number; y: number; at: number; mps: number }>();
const menus = new Map<number, { readonly playerId: number; readonly horseId: number }>();
let lastWritten = "";
let counter = 0;

const flat = (a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function tell(player: Player, text: string): void {
    try {
        Chat.sendToPlayer(player, text);
        player.emit(NOTIFY, JSON.stringify({ text: translate(text, languageOf(player)) }));
    } catch {
        // Gone already.
    }
}

// ---------------------------------------------------------------------------------------------
// Trust.

/** How much a horse trusts, in words. */
export function trustLabel(trust: number): string {
    if (trust >= wildHorseSettings.tameAt) {
        return "confia em você";
    }
    return trust < 20 ? "arisco" : trust < 50 ? "desconfiado" : trust < 80 ? "atento" : "quase manso";
}

/** What a bond holds now: the trust it had, less a point for every `forgetEveryMs` it has gone unfed beyond `forgetAfterMs`. */
export function trustNow(bond: { readonly trust: number; readonly fedAt: number } | undefined, now: number): number {
    if (bond === undefined || bond.trust <= 0 || bond.trust >= wildHorseSettings.tameAt) {
        return bond?.trust ?? 0;
    }
    const idle = now - bond.fedAt - wildHorseSettings.forgetAfterMs;
    return idle <= 0 ? bond.trust : Math.max(0, bond.trust - Math.floor(idle / wildHorseSettings.forgetEveryMs));
}

/** The chance a horse turns a treat down at this trust: `refuseChance` at none, fading to nothing at `refuseUntil`. */
export function refusalChance(trust: number): number {
    return wildHorseSettings.refuseChance * Math.max(0, 1 - trust / wildHorseSettings.refuseUntil);
}

/** A bar of ten for a trust: "■■■□□□□□□□". */
export function trustBar(trust: number): string {
    const filled = Math.max(0, Math.min(10, Math.floor(trust / 10)));
    return "■".repeat(filled) + "□".repeat(10 - filled);
}

/** The best thing to feed in a bag of `counts` (class GUID -> how many), or null. */
export function treatFor(counts: ReadonlyMap<string, number>): { readonly guid: string; readonly name: string; readonly the: string; readonly trust: number } | null {
    return TREATS.find((treat) => (counts.get(treat.guid) ?? 0) > 0) ?? null;
}

/** Every kind of treat the bag holds, the best first. */
export function treatsIn(counts: ReadonlyMap<string, number>): Array<(typeof TREATS)[number]> {
    return TREATS.filter((treat) => (counts.get(treat.guid) ?? 0) > 0);
}

/** How long, in milliseconds, before a bond may be given this kind of treat: its own wait, and the gap after any feeding. 0 when it may now. */
export function waitFor(bond: { readonly fedAt: number; readonly fed?: Record<string, number> } | undefined, guid: string, now: number): number {
    if (bond === undefined) {
        return 0;
    }
    const kindAt = bond.fed === undefined ? bond.fedAt : (bond.fed[guid] ?? 0);
    return Math.max(0, kindAt + wildHorseSettings.feedCooldownMs - now, bond.fedAt + wildHorseSettings.feedGapMs - now);
}

// ---------------------------------------------------------------------------------------------
// The slots.

function persist(): void {
    const body: Record<string, { soul: string; takenUntil: number; bonds: Record<string, Bond> }> = {};
    for (const slot of slots.values()) {
        const bonds = Object.fromEntries(Object.entries(slot.bonds).filter(([, bond]) => bond.trust > 0));
        body[slot.id] = { soul: slot.soul, takenUntil: slot.takenUntil, bonds };
    }
    const text = JSON.stringify(body);
    if (text === lastWritten) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, slots: body });
        lastWritten = text;
    } catch (error: unknown) {
        console.log(`wild-horses: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

let usableBreeds: string[] | null = null;

function breeds(): string[] {
    if (usableBreeds === null) {
        let known: string[] = [];
        try {
            known = Horse.breeds();
        } catch {
            known = [];
        }
        const usable = BREEDS.filter((name) => known.includes(name));
        usableBreeds = usable.length > 0 ? usable : ["horse"];
    }
    return usableBreeds;
}

function pickBreed(avoid: string, random: () => number = Math.random): string {
    const list = breeds();
    const others = list.filter((name) => name !== avoid);
    return (others.length > 0 ? others : list)[Math.floor(random() * (others.length > 0 ? others.length : list.length))] ?? "horse";
}

/** The slots the meadows of `data/farm.json` make, with what the saved file remembers of each. */
function loadSlots(): void {
    const saved = read<{ slots?: Record<string, { soul?: unknown; takenUntil?: unknown; bonds?: unknown }> }>(FILE);
    const memory = saved.status === "ok" && typeof saved.value.slots === "object" && saved.value.slots !== null ? saved.value.slots : {};
    if (saved.status === "corrupt") {
        console.error(`wild-horses: ${FILE} está ilegível e foi deixado como está: ${saved.reason}`);
    }
    farmData().meadows.forEach((meadow, index) => {
        for (let n = 0; n < wildHorseSettings.perMeadow; n += 1) {
            const id = `m${index + 1}-${n + 1}`;
            const kept = memory[id];
            const bonds: Record<string, Bond> = {};
            if (kept !== undefined && typeof kept.bonds === "object" && kept.bonds !== null) {
                for (const [who, bond] of Object.entries(kept.bonds as Record<string, unknown>)) {
                    const row = (typeof bond === "object" && bond !== null ? bond : {}) as { trust?: unknown; fedAt?: unknown };
                    if (typeof row.trust === "number" && Number.isFinite(row.trust) && row.trust > 0) {
                        bonds[who] = { trust: Math.min(wildHorseSettings.tameAt, row.trust), fedAt: typeof row.fedAt === "number" ? row.fedAt : 0 };
                    }
                }
            }
            slots.set(id, {
                id,
                x: meadow.x,
                y: meadow.y,
                z: meadow.z,
                angle: (index * 47 + n * 180) % 360,
                soul: typeof kept?.soul === "string" && breeds().includes(kept.soul) ? kept.soul : pickBreed(""),
                takenUntil: typeof kept?.takenUntil === "number" ? kept.takenUntil : 0,
                bonds,
                horseId: 0,
            });
        }
    });
    lastWritten = "";
    persist();
}

/** Where a slot's horse grazes: round the meadow, a few metres out, on the mesh. */
function grazingSpots(slot: Slot): Array<{ x: number; y: number; z: number }> {
    const spots: Array<{ x: number; y: number; z: number }> = [];
    for (let k = 0; k < 3; k += 1) {
        const angle = ((slot.angle + k * 120) * Math.PI) / 180;
        const reach = 5 + k * 2;
        const wanted = { x: slot.x + Math.cos(angle) * reach, y: slot.y + Math.sin(angle) * reach, z: slot.z };
        const on = snap(wanted, 8);
        if (on !== null) {
            spots.push(on);
        }
    }
    return spots;
}

function snap(point: { x: number; y: number; z: number }, radius: number): { x: number; y: number; z: number } | null {
    try {
        const found = Navigation.closestPoint(point, { searchRadius: radius, searchHeight: 10, doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    } catch {
        return null;
    }
}

/** Puts a slot's horse in the world. False when the mesh has no ground there (yet). */
function spawnSlot(slot: Slot, now: number): boolean {
    if (slot.horseId !== 0 && Horse.getById(slot.horseId) !== null) {
        return true;
    }
    if (slot.takenUntil > now) {
        return false;
    }
    const spots = grazingSpots(slot);
    const at = spots[0] ?? snap({ x: slot.x, y: slot.y, z: slot.z }, 10);
    if (at === null) {
        return false;
    }
    try {
        // Bare: `{}` is a horse with no saddle and no cloth.
        const horse = Horse.spawn(at, new Vector3(0, 0, Math.floor(Math.random() * 360)), slot.soul, wildHorseSettings.name, {});
        horse.gearLocked = true;
        horse.destroyWithOwner = false;
        slot.horseId = horse.id;
        slot.takenUntil = 0;
        wilds.set(horse.id, { slot, lastFleeAt: 0, lastThreatAt: 0, patrolling: false, heldUntil: 0, grazeAt: 0 });
        return true;
    } catch (error: unknown) {
        console.log(`wild-horses: ${slot.id}: a alma ${slot.soul} não foi aceita: ${error instanceof Error ? error.message : String(error)}`);
        slot.soul = "horse";
        return false;
    }
}

export function isWild(horse: Horse): boolean {
    return wilds.has(horse.id);
}

/**
 * The horse of a slot is gone (tamed, killed, taken away): its place has another after `waitMs`, of another breed. A horse that vanished
 * with no taming and no death (an administrator took it away, the game lost it) is put back soon, with what the players had won of it.
 */
function vacate(slot: Slot, now: number, waitMs: number = wildHorseSettings.respawnMs): void {
    wilds.delete(slot.horseId);
    slot.horseId = 0;
    slot.takenUntil = now + waitMs;
    if (waitMs >= wildHorseSettings.respawnMs) {
        slot.soul = pickBreed(slot.soul);
        slot.bonds = {};
    }
    persist();
}

// ---------------------------------------------------------------------------------------------
// How they behave.

/** Where a frightened horse runs: away from the threat, `distance` off, kept within `leash` of its meadow. */
export function fleePoint(from: { readonly x: number; readonly y: number }, threat: { readonly x: number; readonly y: number }, home: { readonly x: number; readonly y: number }, distance: number, leash: number, turn = 0): { x: number; y: number } {
    let dx = from.x - threat.x;
    let dy = from.y - threat.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    if (turn !== 0) {
        const radians = (turn * Math.PI) / 180;
        [dx, dy] = [dx * Math.cos(radians) - dy * Math.sin(radians), dx * Math.sin(radians) + dy * Math.cos(radians)];
    }
    let x = from.x + dx * distance;
    let y = from.y + dy * distance;
    const away = Math.hypot(x - home.x, y - home.y);
    if (away > leash) {
        x = home.x + ((x - home.x) / away) * leash;
        y = home.y + ((y - home.y) / away) * leash;
    }
    return { x, y };
}

/** How fast each player is moving (metres a second), from where they were the last time they were looked at. */
/** A player's speed brought up to date with where they are now, and what it is. */
function speedOf(id: number, at: { readonly x: number; readonly y: number }, now: number): number {
    const before = speeds.get(id);
    if (before === undefined || now - before.at <= 0) {
        speeds.set(id, { x: at.x, y: at.y, at: now, mps: 0 });
        return 0;
    }
    const seconds = (now - before.at) / 1000;
    // A jump (a teleport, a fast travel) is not a run.
    const moved = flat(at, before);
    const mps = moved > 40 ? 0 : moved / seconds;
    speeds.set(id, { x: at.x, y: at.y, at: now, mps });
    return mps;
}

/** Whether a player is one a wild horse lets come close: a Domador, on foot, who is not running at it. */
export function isCalm(player: Player, mps: number): boolean {
    return mayCraft(player, "domar") && !player.horse && mps <= wildHorseSettings.calmMps;
}

/**
 * What one round of `wildTick` knows of the players, read once: where they are, how fast they go, whether they are Domadores and on a
 * horse. The loop used to ask the game for all of that again for every horse (a hundred and more horses by twenty players, a guild lookup
 * in each pair: 185 ms a round on the main thread, 15 s of every minute, 2026-10-25), and the work is the same for every horse of the round.
 */
/**
 * Whether a player is a Domador and whether they ride are read when a horse first needs to know, once a round (2026-10-27: they were read for every player every
 * round, and most players are near no wild horse).
 */
class Seen {
    private tamerRead: boolean | undefined;
    private ridingRead: boolean | undefined;

    constructor(
        readonly player: Player,
        readonly x: number,
        readonly y: number,
        readonly mps: number,
    ) {}

    get tamer(): boolean {
        if (this.tamerRead === undefined) {
            this.tamerRead = mayCraft(this.player, "domar");
        }
        return this.tamerRead;
    }

    get riding(): boolean {
        if (this.ridingRead === undefined) {
            this.ridingRead = Boolean(this.player.horse);
        }
        return this.ridingRead;
    }
}

/** The players of the round, their speeds brought up to date on the way: where each one is is read once for both (it was read twice a round). */
function seePlayers(now: number): Seen[] {
    const seen: Seen[] = [];
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        const at = player.position;
        const mps = speedOf(player.id, at, now);
        if (!player.alive) {
            continue;
        }
        seen.push(new Seen(player, at.x, at.y, mps));
    }
    return seen;
}

/**
 * How far from every player a horse is left to itself: the range inside which a player's own game runs bodies (about 120 m). Past it nobody
 * sees it, and it has no one to be frightened by or to graze for; it starts again a round after somebody comes within.
 */
export const WILD_ACTIVE_M = 150;

/** The nearest player a wild horse is afraid of now, or null. */
function threatTo(at: { x: number; y: number }, seen: readonly Seen[]): Player | null {
    let worst: Player | null = null;
    let nearest = Infinity;
    const farthest = Math.max(wildHorseSettings.tamerFleeM, wildHorseSettings.fleeRidingM, wildHorseSettings.fleeM);
    for (const one of seen) {
        const distance = flat(at, one);
        // Past the farthest any fright reaches, whatever the player is: what they are is not asked.
        if (distance > farthest || distance >= nearest) {
            continue;
        }
        const radius = one.tamer ? (one.mps > wildHorseSettings.calmMps || one.riding ? wildHorseSettings.tamerFleeM : 0) : one.riding ? wildHorseSettings.fleeRidingM : wildHorseSettings.fleeM;
        if (distance <= radius && distance < nearest) {
            nearest = distance;
            worst = one.player;
        }
    }
    return worst;
}

/** The nearest Domador on foot who is calm and within `watchM` of the horse, or null. */
function watcherOf(at: { x: number; y: number }, seen: readonly Seen[]): Player | null {
    let best: Player | null = null;
    let nearest = wildHorseSettings.watchM;
    for (const one of seen) {
        const distance = flat(at, one);
        if (distance > nearest || one.mps > wildHorseSettings.calmMps || !one.tamer || one.riding) {
            continue;
        }
        if (distance <= nearest) {
            nearest = distance;
            best = one.player;
        }
    }
    return best;
}

function runFrom(horse: Horse, wild: Wild, threat: Player, now: number): void {
    const home = wild.slot;
    const from = horse.position;
    const at = threat.position;
    const close = flat(from, at) < 8;
    for (const turn of [0, 40, -40, 80, -80]) {
        const wanted = fleePoint(from, at, home, wildHorseSettings.runM, wildHorseSettings.leashM, turn);
        const on = snap({ x: wanted.x, y: wanted.y, z: from.z }, 12);
        if (on !== null && horse.moveTo(new Vector3(on.x, on.y, on.z), { speed: close ? "run" : "jog", radius: 2 })) {
            wild.lastFleeAt = now;
            wild.patrolling = false;
            return;
        }
    }
    // Cornered: the mesh gave it no way out. It stands.
    wild.lastFleeAt = now;
}

function graze(horse: Horse, wild: Wild, now: number): void {
    wild.grazeAt = now + wildHorseSettings.grazeEveryMs;
    const spots = grazingSpots(wild.slot);
    if (spots.length === 0) {
        return;
    }
    try {
        wild.patrolling = horse.patrol(spots.map((spot) => new Vector3(spot.x, spot.y, spot.z)), { speed: "walk", loop: true, waitSeconds: 14 });
    } catch {
        wild.patrolling = false;
    }
}

/** One look at every wild horse: the ones with somebody to fear run; the ones a Domador watches stand; the rest graze. */
export function wildTick(now: number = Date.now()): void {
    const seen = seePlayers(now);
    // The horses found standing this round: their places are not asked about again below.
    const standing = new Set<number>();
    for (const [id, wild] of [...wilds]) {
        const horse = Horse.getById(id);
        if (horse === null) {
            vacate(wild.slot, now, wildHorseSettings.lostMs);
            continue;
        }
        if (!horse.alive) {
            vacate(wild.slot, now);
            continue;
        }
        standing.add(id);
        const at = horse.position;
        // Nobody within reach of its fright, its watching or its grazing: nothing to decide, and nobody's game is running it anyway.
        if (!seen.some((one) => flat(at, one) <= WILD_ACTIVE_M)) {
            continue;
        }
        if (horse.mounted || horse.unconscious === true || wild.heldUntil > now) {
            continue;
        }
        const threat = threatTo(at, seen);
        if (threat !== null) {
            wild.lastThreatAt = now;
            if (now - wild.lastFleeAt >= wildHorseSettings.fleeAgainMs) {
                runFrom(horse, wild, threat, now);
            }
            continue;
        }
        if (watcherOf(at, seen) !== null) {
            wild.lastThreatAt = now;
            if (wild.patrolling || horse.navigationStatus === "running") {
                horse.hold();
                wild.patrolling = false;
            }
            continue;
        }
        if (!wild.patrolling && now >= wild.grazeAt && now - wild.lastThreatAt >= wildHorseSettings.calmAfterMs && horse.navigationStatus !== "running") {
            graze(horse, wild, now);
        }
    }
    // The places that have no horse: spawned once the mesh is up, and again when a tamed or killed horse's place has waited long enough.
    for (const slot of slots.values()) {
        if (slot.horseId !== 0 && standing.has(slot.horseId) && wilds.has(slot.horseId)) {
            continue;
        }
        if (slot.horseId === 0 || Horse.getById(slot.horseId) === null) {
            if (slot.horseId !== 0) {
                wilds.delete(slot.horseId);
                slot.horseId = 0;
            }
            if (Navigation.ready && slot.takenUntil <= now) {
                spawnSlot(slot, now);
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The menu.

function bondOf(slot: Slot, steamId: string): Bond {
    let bond = slot.bonds[steamId];
    if (bond === undefined) {
        bond = { trust: 0, fedAt: 0 };
        slot.bonds[steamId] = bond;
    }
    return bond;
}

function countsOf(player: Player): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of Inventory.get(player)?.items ?? []) {
        const key = String(row.item).toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + row.amount);
    }
    return counts;
}

function takeOne(player: Player, guid: string): boolean {
    const state = Inventory.get(player);
    const row = state?.items.find((candidate) => String(candidate.item).toLowerCase() === guid && candidate.amount > 0);
    if (state === null || state === undefined || row === undefined) {
        return false;
    }
    return Inventory.remove(player, { units: [{ id: row.id, amount: 1 }], revision: state.revision }).ok;
}

export function menuPageFor(player: Player, horse: Horse, now = Date.now()): DialoguePage | null {
    const wild = wilds.get(horse.id);
    if (wild === undefined) {
        return null;
    }
    const bond = wild.slot.bonds[player.steamId] ?? { trust: 0, fedAt: 0 };
    const trust = trustNow(bond, now);
    const treats = treatsIn(countsOf(player)).slice(0, MENU_TREATS);
    const tame = trust >= wildHorseSettings.tameAt;
    // A row for each kind of treat in the bag: the first keeps the old id, "feed" (what the menu had when it offered only the best), the others are "feed:<place in TREATS>".
    const feedRows: DialogueOption[] =
        tame || treats.length === 0
            ? [{ id: "feed", text: tame ? "Oferecer comida" : "Oferecer comida (cenoura, maçã, pera, beterraba, nabo ou pão)", enabled: false }]
            : treats.map((treat, row) => {
                  const wait = waitFor(bond, treat.guid, now);
                  return { id: row === 0 ? "feed" : `feed:${TREATS.indexOf(treat)}`, text: wait > 0 ? `Oferecer ${treat.name} (daqui a ${Math.ceil(wait / 1000)} s)` : `Oferecer ${treat.name}`, enabled: wait <= 0 };
              });
    return {
        line: `${wildHorseSettings.name}: ${trustLabel(trust)}. Confiança ${trustBar(trust)} ${Math.round(trust)}/${wildHorseSettings.tameAt}.`,
        onRight: false,
        options: [
            ...feedRows,
            { id: "mount", text: tame ? "Montar" : "Montar (ele ainda não confia)", enabled: tame },
            { id: "follow", text: tame ? "Mandar seguir" : "Mandar seguir (ele ainda não confia)", enabled: tame },
            { id: "leave", text: "Sair", enabled: true },
        ],
    };
}

function closeMenu(player: Player): void {
    for (const [session, menu] of menus) {
        if (menu.playerId === player.id) {
            menus.delete(session);
            Dialogue.close(session);
        }
    }
}

/** Opens the taming menu of a wild horse for a player. Null when the horse is not wild; false when the menu cannot be had now. */
export function openTamingMenu(player: Player, horse: Horse, now = Date.now()): boolean | null {
    const wild = wilds.get(horse.id);
    if (wild === undefined) {
        return null;
    }
    if (!mayCraft(player, "domar")) {
        tell(player, "Só os domadores (guilda Domitores) sabem amansar um cavalo selvagem. Escolha a guilda no painel (F2), em Guildas.");
        return false;
    }
    if (!player.ready || !player.alive || player.horse || !horse.alive || horse.rider !== null || Dialogue.sessionOf(player.id) !== 0) {
        return false;
    }
    if (flat(horse.position, player.position) > wildHorseSettings.reachM) {
        return false;
    }
    if (player.steamId === "") {
        tell(player, "Sem identificação Steam não há como guardar a confiança do cavalo.");
        return false;
    }
    const page = menuPageFor(player, horse, now);
    if (page === null) {
        return false;
    }
    horse.hold();
    wild.patrolling = false;
    wild.heldUntil = now + wildHorseSettings.heldMs;
    closeMenu(player);
    const session = Dialogue.open(player.id, page);
    if (session === 0) {
        return false;
    }
    menus.set(session, { playerId: player.id, horseId: horse.id });
    return true;
}

function pet(player: Player): void {
    if (player.appearance?.gender === "female") {
        return;
    }
    lowerTorch(player);
    try {
        player.playAnimation("HorsePetting_2", { lockMovement: true });
        setTimeout(() => {
            try {
                player.stopAnimation();
            } catch {
                // Gone.
            }
        }, wildHorseSettings.petMs);
    } catch (error: unknown) {
        console.log(`wild-horses: o carinho não tocou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * What a feeding does: the treat is taken, the trust grows, and the menu comes back once the petting is done. Returns what was said, for the tests.
 * `kind` is the class GUID of the treat to give; without it, the best kind in the bag that may be given now.
 */
export function feed(player: Player, horse: Horse, now = Date.now(), random: () => number = Math.random, kind?: string): string {
    const wild = wilds.get(horse.id);
    if (wild === undefined || !horse.alive) {
        return "";
    }
    const bond = bondOf(wild.slot, player.steamId);
    const before = trustNow(bond, now);
    if (before >= wildHorseSettings.tameAt) {
        return "";
    }
    const carried = treatsIn(countsOf(player));
    const wanted = kind === undefined ? carried : carried.filter((candidate) => candidate.guid === kind);
    if (wanted.length === 0) {
        const text = "Você não tem o que oferecer: uma cenoura, maçã, pera, beterraba, nabo ou pão na bolsa.";
        tell(player, text);
        return text;
    }
    const treat = wanted.find((candidate) => waitFor(bond, candidate.guid, now) <= 0);
    if (treat === undefined) {
        const soonest = Math.min(...wanted.map((candidate) => waitFor(bond, candidate.guid, now)));
        const text = `${wildHorseSettings.name} ainda mastiga: espere ${Math.ceil(soonest / 1000)} s.`;
        tell(player, text);
        return text;
    }
    // A horse that does not trust them yet may turn the treat down: it is not taken, and the minute and a half of that kind starts all the same.
    if (random() < refusalChance(before)) {
        bond.trust = before;
        bond.fed = { ...(bond.fed ?? Object.fromEntries(TREATS.map((each) => [each.guid, bond.fedAt]))), [treat.guid]: now };
        bond.fedAt = now;
        persist();
        const text = `O cavalo cheira ${treat.the}, vira a cabeça e recua: ainda não confia o bastante para comer da sua mão.`;
        console.log(`wild-horses: o cavalo de ${wild.slot.id} recusou ${treat.name} de ${player.nickname} (confiança ${Math.round(before)})`);
        tell(player, text);
        wild.heldUntil = now + wildHorseSettings.heldMs;
        setTimeout(() => {
            const again = Horse.getById(horse.id);
            if (again !== null && wilds.has(again.id) && player.ready && Dialogue.sessionOf(player.id) === 0) {
                openTamingMenu(player, again, Date.now());
            }
        }, 1_500);
        return text;
    }
    if (!takeOne(player, treat.guid)) {
        return "";
    }
    bond.trust = Math.min(wildHorseSettings.tameAt, before + treat.trust);
    // A bond kept from before the kinds had their own wait counts its last feeding for all of them, once.
    bond.fed = { ...(bond.fed ?? Object.fromEntries(TREATS.map((each) => [each.guid, bond.fedAt]))), [treat.guid]: now };
    bond.fedAt = now;
    persist();
    pet(player);
    wild.heldUntil = now + wildHorseSettings.petMs + wildHorseSettings.heldMs;
    const done = bond.trust >= wildHorseSettings.tameAt;
    const text = done
        ? `O cavalo come ${treat.the} da sua mão e encosta o focinho em você: ele confia em você agora. Monte, ou mande-o seguir.`
        : `O cavalo aceita ${treat.the} (${trustLabel(bond.trust)}, confiança ${Math.round(bond.trust)}/${wildHorseSettings.tameAt}).`;
    console.log(`wild-horses: ${player.nickname} deu ${treat.name} ao cavalo de ${wild.slot.id}: confiança ${Math.round(bond.trust)}`);
    tell(player, text);
    // The menu comes back when the petting is over.
    setTimeout(() => {
        const again = Horse.getById(horse.id);
        if (again !== null && wilds.has(again.id) && player.ready && Dialogue.sessionOf(player.id) === 0) {
            openTamingMenu(player, again, Date.now());
        }
    }, wildHorseSettings.petMs + 400);
    return text;
}

/**
 * Puts the game's plain tack on a horse that is about to be somebody's: one of the generic `horse_common` sets the server has, else the same
 * pieces by name. What was put on, for the log and the tests ("" when nothing could be: the horse stays bare).
 */
export function dress(horse: Horse, where: string): string {
    let known: string[] = [];
    try {
        known = Horse.gearPresets();
    } catch {
        known = [];
    }
    const sets = BASIC_TACK.filter((name) => known.includes(name));
    if (sets.length > 0) {
        const preset = sets[Math.floor(Math.random() * sets.length)] ?? sets[0]!;
        try {
            if (horse.setGear(preset)) {
                return preset;
            }
        } catch (error: unknown) {
            console.log(`wild-horses: o conjunto ${preset} não foi posto no cavalo de ${where}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    try {
        if (horse.setGear({ ...PLAIN_PIECES })) {
            return "sela, rédeas e ferraduras pelo nome";
        }
    } catch (error: unknown) {
        console.log(`wild-horses: a sela, as rédeas e as ferraduras não foram postas no cavalo de ${where}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return "";
}

/** The horse becomes the player's: no longer wild, theirs in the Animais; in the game's plain tack, a saddle and bridle and horseshoes. */
export function tame(player: Player, horse: Horse, then: "mount" | "follow", now = Date.now()): boolean {
    const wild = wilds.get(horse.id);
    if (wild === undefined || !horse.alive) {
        return false;
    }
    if (trustNow(wild.slot.bonds[player.steamId], now) < wildHorseSettings.tameAt) {
        tell(player, "Ele ainda não confia em você o bastante.");
        return false;
    }
    vacate(wild.slot, now);
    horse.gearLocked = false;
    // Its own name again (the breed's), for the owner to change in Animais.
    horse.name = "";
    horse.destroyWithOwner = false;
    // Dressed before it is given, so that `horses.ts` files it with its tack.
    const tack = dress(horse, wild.slot.id);
    try {
        horse.giveTo(player);
    } catch (error: unknown) {
        console.log(`wild-horses: o cavalo de ${wild.slot.id} não passou para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
    console.log(`wild-horses: ${player.nickname} amansou o cavalo de ${wild.slot.id}${tack === "" ? ", que ficou sem sela" : `, vestido com ${tack}`}`);
    tell(player, tack === "" ? "O cavalo agora é seu: veja em Animais (F2) para dar um nome. Ele ainda não tem sela nem arreios." : "O cavalo agora é seu: veja em Animais (F2) para dar um nome. Ele já vem com sela, rédeas e ferraduras simples.");
    if (then === "follow") {
        tell(player, startFollowing(horse, player).message);
    } else {
        grantClimb(player, horse, now);
        if (!player.mount(horse)) {
            tell(player, "Não consegui pôr você na sela agora. Chegue-se a ele e aperte E.");
        }
    }
    return true;
}

function choose(session: number, player: Player, option: string): void {
    const menu = menus.get(session);
    if (menu === undefined || menu.playerId !== player.id) {
        return;
    }
    menus.delete(session);
    Dialogue.close(session);
    const horse = Horse.getById(menu.horseId);
    if (horse === null || option === "leave" || !wilds.has(horse.id)) {
        return;
    }
    if (!horse.alive || flat(horse.position, player.position) > wildHorseSettings.reachM) {
        tell(player, "Você se afastou demais do cavalo.");
        return;
    }
    if (option === "feed") {
        feed(player, horse);
    } else if (option.startsWith("feed:")) {
        const treat = TREATS[Number(option.slice(5))];
        if (treat !== undefined) {
            feed(player, horse, Date.now(), Math.random, treat.guid);
        }
    } else if (option === "mount" || option === "follow") {
        tame(player, horse, option);
    }
}

// ---------------------------------------------------------------------------------------------
// The admins' word.

export function wildSummary(player: Player): string[] {
    const alive = [...wilds.keys()].filter((id) => Horse.getById(id) !== null).length;
    const waiting = [...slots.values()].filter((slot) => slot.horseId === 0).length;
    const mine = [...slots.values()].filter((slot) => trustNow(slot.bonds[player.steamId], Date.now()) > 0).length;
    return [
        `Cavalos selvagens: ${alive} nos campos abertos (${farmData().meadows.length} campos, ${wildHorseSettings.perMeadow} por campo); ${waiting} lugar(es) esperando outro cavalo; ${mine} deles já conhecem você.`,
        `Fogem de quem não é domador a ${wildHorseSettings.fleeM} m (${wildHorseSettings.fleeRidingM} m montado) e de domador que corre a ${wildHorseSettings.tamerFleeM} m; confiança de ${wildHorseSettings.tameAt}, ${wildHorseSettings.feedCooldownMs / 1000} s entre duas comidas do mesmo tipo (e ${wildHorseSettings.feedGapMs / 1000} s entre quaisquer duas), e o cavalo pode recusar (${Math.round(wildHorseSettings.refuseChance * 100)}% sem confiança nenhuma); sem comida a confiança cai 1 ponto a cada ${wildHorseSettings.forgetEveryMs / 60_000} min depois de ${wildHorseSettings.forgetAfterMs / 60_000} min; um lugar tem outro cavalo ${wildHorseSettings.respawnMs / 3_600_000} h depois de um ser amansado ou morrer.`,
    ];
}

/** The wild horses nearest the player, with their trust of them, nearest first. */
export function nearestWild(player: Player, count = 5): Array<{ readonly id: string; readonly distance: number; readonly trust: number; readonly breed: string; readonly horse: Horse }> {
    const rows: Array<{ id: string; distance: number; trust: number; breed: string; horse: Horse }> = [];
    for (const [horseId, wild] of wilds) {
        const horse = Horse.getById(horseId);
        if (horse !== null) {
            rows.push({ id: wild.slot.id, distance: flat(horse.position, player.position), trust: trustNow(wild.slot.bonds[player.steamId], Date.now()), breed: wild.slot.soul, horse });
        }
    }
    return rows.sort((a, b) => a.distance - b.distance).slice(0, count);
}

/** Sets how much the nearest wild horse trusts a player (to try the taming). Returns that horse's place, or "" when none is near. */
export function setTrustNearest(player: Player, trust: number): string {
    const near = nearestWild(player, 1)[0];
    if (near === undefined) {
        return "";
    }
    const wild = wilds.get(near.horse.id);
    if (wild === undefined) {
        return "";
    }
    const bond = bondOf(wild.slot, player.steamId);
    bond.trust = Math.max(0, Math.min(wildHorseSettings.tameAt, trust));
    // The fading counts from now, and the wait between two feedings is over.
    bond.fedAt = Date.now() - wildHorseSettings.feedCooldownMs;
    delete bond.fed;
    persist();
    return near.id;
}

/** Every wild horse taken away and put back at its meadow (`/selvagens repor`). */
/** What a deleted character had won over of the wild horses goes with it (2026-10-25). How many horses it had begun with. */
export function forgetTamer(steamId: string): number {
    let count = 0;
    for (const slot of slots.values()) {
        if (slot.bonds[steamId] !== undefined) {
            delete slot.bonds[steamId];
            count += 1;
        }
    }
    if (count > 0) {
        persist();
    }
    return count;
}

export function resetWild(now = Date.now()): number {
    let count = 0;
    for (const [horseId, wild] of [...wilds]) {
        try {
            Horse.getById(horseId)?.destroy();
        } catch {
            // Gone already.
        }
        wilds.delete(horseId);
        wild.slot.horseId = 0;
        count += 1;
    }
    for (const slot of slots.values()) {
        slot.takenUntil = 0;
    }
    wildTick(now);
    return count;
}

export function installWildHorses(): void {
    loadSlots();
    // The herd as the horse menu's round sees it: read once a round (the round's number says when a new one began), not again for every Domador
    // (2026-10-27: eight reads a horse for each of them, twice a second). Asked without a round (a test, a one-off), it is read afresh.
    let herdRound = -1;
    let herd: Array<{ readonly horse: Horse; readonly x: number; readonly y: number; readonly z: number }> = [];
    const readHerd = (): typeof herd => {
        const list: typeof herd = [];
        for (const id of wilds.keys()) {
            const horse = Horse.getById(id);
            if (horse === null || !horse.alive || horse.rider !== null) {
                continue;
            }
            const at = horse.position;
            list.push({ horse, x: at.x, y: at.y, z: at.z });
        }
        return list;
    };
    nearExtras.push((player, reachM, here, round) => {
        if (!mayCraft(player, "domar")) {
            return null;
        }
        if (round === undefined) {
            herd = readHerd();
            herdRound = -1;
        } else if (round !== herdRound) {
            herd = readHerd();
            herdRound = round;
        }
        const at = here ?? player.position;
        let best: (typeof herd)[number] | null = null;
        let nearest = reachM;
        for (const one of herd) {
            const distance = Math.hypot(one.x - at.x, one.y - at.y);
            if (distance <= nearest && Math.abs(one.z - at.z) <= 2.5) {
                nearest = distance;
                best = one;
            }
        }
        return best === null ? null : { horse: best.horse, w: true, x: best.x, y: best.y, z: best.z, distance: nearest };
    });
    askExtras.push((player, horse) => openTamingMenu(player, horse));
    // Nobody who is not a Domador climbs on a wild horse, and a Domador wins it first: the game's own climb is refused.
    Events.on("horseMounting", (horse, rider) => {
        if (!wilds.has(horse.id)) {
            return undefined;
        }
        try {
            rider.dismount();
        } catch {
            // Not in a saddle as far as the server knows.
        }
        tell(rider, mayCraft(rider, "domar") ? "Ele é selvagem: chegue devagar, aperte E e ofereça comida até ele confiar em você." : "É um cavalo selvagem: só os domadores sabem amansá-lo.");
        return false;
    });
    Events.on("dialogueChoice", (session, player, option) => choose(session, player, option));
    Events.on("dialogueClosed", (session) => {
        menus.delete(session);
    });
    Events.on("horseDeath", (horse) => {
        const wild = wilds.get(horse.id);
        if (wild !== undefined) {
            console.log(`wild-horses: o cavalo de ${wild.slot.id} morreu`);
            vacate(wild.slot, Date.now());
        }
    });
    Events.on("playerDisconnect", (player) => {
        speeds.delete(player.id);
        closeMenu(player);
    });
    // The mesh may not be up at the first look: the tick spawns what is missing as soon as it is.
    const timer = setInterval(() => {
        counter += 1;
        try {
            wildTick();
        } catch (error: unknown) {
            if (counter % 50 === 1) {
                console.log(`wild-horses: a volta falhou: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }, wildHorseSettings.tickMs);
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        persist();
        // Taken away so a restarted resource does not put a second herd beside the first.
        for (const id of wilds.keys()) {
            try {
                Horse.getById(id)?.destroy();
            } catch {
                // Gone already.
            }
        }
        wilds.clear();
    });
    console.log(`wild-horses: ${slots.size} lugar(es) em ${farmData().meadows.length} campo(s) aberto(s), ${wildHorseSettings.perMeadow} por campo; confiança de ${wildHorseSettings.tameAt} para amansar`);
}
