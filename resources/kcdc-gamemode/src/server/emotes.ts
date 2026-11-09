/**
 * The gestures a player picks on G (`src/client/emotes.ts`, `ui/emotes.html`), played on their body for everybody to see. The numbers
 * are the page's: 1 to 6 are the game's emote catalog's (KCDC's `EmoteWheel.getCatalog`, the docs' table), 101 on are ours, from the
 * game's own animation databases (2026-10-26, user: "vamos adicionar também mais emotes, exemplo usar lampião ou levantar estandarte e
 * coisas do tipo que o jogo deve ter"): seven groups on the wheel, the greetings and signals, the feelings, the face (what the face
 * does for a moment), the mood (what it keeps), the party and the music, the faith, and what is carried (a lamp, a standard). The page
 * sends a number, and only the gestures below are played.
 *
 * A one-shot stays on the body until it is stopped, so each is let go when the game says it finished (`playerAnimationEnd`), and at the
 * latest a little after its length. A woman's body plays the fragment of her own database where it has another name, and a gesture the
 * game has for one body only is offered to that body only (`availableFor`: the catalog rows say `male` and `female`). What is carried
 * (`hold`) is no gesture that ends: the lamp stays in the hand, and the body walks, until the same gesture is asked for again, another
 * replaces it, or "Parar" lets everything go. The face is the face's: a gesture of it plays once, a mood stays until "Neutro".
 */

import { sessionOf } from "./furniture.js";
import { ensureDir, read, write } from "./store.js";
import { lowerTorch } from "./torch-down.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/emotes.json`;

export interface Way {
    readonly fragment: string;
    readonly tags: string;
}

/**
 * A model the game puts in a hand while the gesture plays: one of `Animations.props()` by its name (`item`), or any model of the game's by its path (`model`).
 * The catalog has the tools the game authored a grip for; it has no horn and no flute, its lamp is one that did not show (2026-10-27: "o de trompa não aparece a trompa, mesma
 * coisa no de flauta", "o lampião não aparece"), and it has no standard (the game's flags are a pole and a cloth, hung one by one), so those are given by model.
 */
export interface Prop {
    readonly item?: string;
    readonly model?: string;
    readonly hand: "left" | "right";
    /** Where the model sits in the hand's own space, in metres: it is hung from the hand by its origin, shifted by this. */
    readonly position?: Offset;
    /** How it is turned there, in degrees about each axis. */
    readonly rotation?: Offset;
}

export interface Offset {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** A light that goes with a carried lamp: the colour (0 to 1 each), its strength and reach in metres, and how high above the carrier's feet it hangs. */
export interface Glow {
    readonly color: readonly [number, number, number];
    readonly intensity: number;
    readonly radius: number;
    readonly rise: number;
}

/** The game's models of the instruments, the lamps and the standard, by path (lower case, as `Animations.props()` spells them). */
const MUSIC = "objects/manmade/task_specific_props/entertainment/music/";
const LIGHT = "objects/manmade/common_illumination/";
const FLAGS = "objects/manmade/common_decorations/flags/";

/**
 * The game's models of things held carry a mark of where the fingers close (a helper called `slt_1` for the right hand, upright in the model's own frame, read out of the
 * .cgf files, centimetres), and the game puts that mark in the hand. A model given by its path hangs from the hand by its origin instead, so it is shifted by the same
 * amount the other way. The flute is a tube of 33 cm that runs from its mouthpiece along +Z, gripped 7.5 cm along it: on its origin it lay whole on one side of the hand, where
 * the forearm is (2026-10-27: "a flauta continua não aparecendo"), and the horn sat 17 cm from the hand.
 */
const grip = (x: number, y: number, z: number): Offset => ({ x: -x / 100, y: -y / 100, z: -z / 100 });
const FLUTE_GRIP = grip(0.383, -0.019, 7.48);
const HORN_GRIP = grip(-11.482, 12.382, 5.94);
/** The fine lantern hangs from its base up (its body is 47 cm above its origin: "o lampião apareceu acima da mão"): moved down so that it hangs from the hand like the other. */
const FANCY_LANTERN_DOWN: Offset = { x: 0, y: 0, z: -0.45 };
/**
 * A lantern's flame lights its surroundings (2026-10-27: "o lampião não tem brilho"): the deep orange of an oil flame, warmer than the first one's (2026-11-02: "a luz está artificial, com cara
 * de LED piscando; o correto é uma cor mais quente, passando sensação de fogo natural"). It was one light of the server's moved after its carrier four times a second, and a walking carrier's
 * light jumped from spot to spot; now each client draws it on the body that carries it, breathing like a flame (`src/client/lamps.ts`), and the server only says who carries a lit lamp.
 */
const LAMP_GLOW: Glow = { color: [1, 0.5, 0.16], intensity: 1.1, radius: 6, rise: 0.9 };
/** How often the server looks whether the carriers of lit lamps are still there, alive and in the world: a lamp of one who is not is put out. */
export const LAMP_CHECK_MS = 2_000;
/** What the clients are told of the lamps: one lit (`on` 1, with its looks) or put out, or all of them at once for a player who has just come in. */
export const LAMP_EVENT = "kcdc-gamemode:lamp";

export type Group = "saudacoes" | "emocoes" | "rosto" | "humor" | "festa" | "fe" | "objetos";

/** The groups of the wheel, in its order, as the page names them. */
export const GROUPS: ReadonlyArray<{ readonly id: Group; readonly name: string }> = [
    { id: "saudacoes", name: "Saudações" },
    { id: "emocoes", name: "Emoções" },
    { id: "rosto", name: "Rosto" },
    { id: "humor", name: "Humor" },
    { id: "festa", name: "Festa" },
    { id: "fe", name: "Fé" },
    { id: "objetos", name: "Objetos" },
];

export interface Gesture extends Way {
    /** What the page calls it. */
    readonly name: string;
    readonly group: Group;
    /** How long it plays, in seconds, after which the body is let go whatever the game said. */
    readonly seconds: number;
    /** `body` (the default) moves the body; `face` is a gesture of the face that plays once; `mood` is the face's held expression (an empty fragment hands the face back). */
    readonly kind?: "body" | "face" | "mood";
    /** What a woman's body plays, where the game's fragment for her has another name, and the seconds she is let go after where hers runs longer. */
    readonly female?: Way & { readonly seconds?: number };
    /** Carried until it is asked for again: no timer lets it go, and the body is free to walk (an upper-body animation). */
    readonly hold?: boolean;
    /** What the hands hold while it plays. */
    readonly props?: readonly Prop[];
    /** The light it carries: a lamp that is held lights what is around the one who holds it. */
    readonly glow?: Glow;
    /** Seconds a player must wait before this one again (the horn is heard for 200 m). */
    readonly wait?: number;
}

/** What "Parar" sends: it lets go of what the wheel started. */
export const STOP = 0;

/** The lamps are held in the left hand with the lamp's own hand pose (the game's `HoldItemLeft`, which has it for walking and running too). */
const LAMP: Way = { fragment: "HoldItemLeft", tags: "l_lamp" };
/**
 * The standard is carried upright in the right hand like a broom (`HoldItemRight` with `r_broom`: the hand closes round a shaft that stands beside the body). The torch's pose held it
 * slanting ("segurando na diagonal"), and then the left hand's hoe grip hung the pole from a frame that is turned over, so that it pointed into the ground and nothing showed
 * ("o estandarte não apareceu", 2026-10-27).
 */
const STANDARD_HAND: Way = { fragment: "HoldItemRight", tags: "r_broom" };
/**
 * The game's flags are two models, as its level places them (read with the World Builder): a tall pole (`flag_spear_scaled`, 3.43 m, with a spear's grip marks) and the cloth hung on it
 * (`flag_temporary`, 1.4 m by 0.6 m, modelled lying flat, the pole 0.34 m from its origin along its length); the level puts the cloth 2.7 m up the pole and 0.34 m from its axis.
 * The broom's grip is 65 cm up from its foot, so the pole is let down by as much to stand where the broom does, and the cloth is stood up beside it (its width becomes its height).
 */
const STANDARD_POLE: Offset = { x: 0, y: 0, z: -0.65 };
const STANDARD_CLOTH: Offset = { x: 0.344, y: 0, z: 2.05 };
const STANDARD_CLOTH_TURN: Offset = { x: 90, y: 0, z: 0 };

const face = (name: string, fragment: string, female?: string): Gesture => ({
    name,
    group: "rosto",
    kind: "face",
    fragment,
    tags: "",
    seconds: 4,
    ...(female === undefined ? {} : { female: { fragment: female, tags: "" } }),
});

const mood = (name: string, tags: string): Gesture => ({ name, group: "humor", kind: "mood", fragment: tags === "" ? "" : "FE_Default", tags, seconds: 0 });

export const GESTURES: Readonly<Record<number, Gesture>> = {
    // Greetings and signals.
    1: { name: "Acenar", group: "saudacoes", fragment: "GreetingsUpperBody", tags: "waveSmall", seconds: 2.8 },
    2: { name: "Saudar", group: "saudacoes", fragment: "GreetingsUpperBody", tags: "waveBig", seconds: 4.2 },
    3: { name: "Assentir", group: "saudacoes", fragment: "GreetingsUpperBody", tags: "nod", seconds: 2.2 },
    4: { name: "Respeito", group: "saudacoes", fragment: "GreetingsUpperBody", tags: "nodSubmissive", seconds: 1.8 },
    5: { name: "Reverência", group: "saudacoes", fragment: "Greetings", tags: "bowBig", seconds: 3.0 },
    102: { name: "Apontar", group: "saudacoes", fragment: "Pointing", tags: "", seconds: 3 },
    107: { name: "Chamar", group: "saudacoes", fragment: "Come", tags: "", seconds: 5.8 },
    108: { name: "Siga-me", group: "saudacoes", fragment: "FollowMe", tags: "", seconds: 6.6 },
    109: { name: "Sentido", group: "saudacoes", fragment: "Soldier_Attention", tags: "", seconds: 10 },
    110: { name: "Anunciar", group: "saudacoes", fragment: "SellerInvite", tags: "", seconds: 2.5 },
    111: { name: "Discursar", group: "saudacoes", fragment: "NPC_Monologue", tags: "monologue", seconds: 25 },
    112: { name: "Incitar", group: "saudacoes", fragment: "Commander_Urge", tags: "", seconds: 8.8 },

    // Feelings.
    6: { name: "Comemorar", group: "emocoes", fragment: "TournamentCheersHappyGesture", tags: "", seconds: 3.9 },
    101: { name: "Aplaudir", group: "emocoes", fragment: "ApplauseHappy", tags: "", seconds: 6 },
    113: { name: "Aplauso triste", group: "emocoes", fragment: "ApplauseSad", tags: "", seconds: 6 },
    106: { name: "Lamentar", group: "emocoes", fragment: "TournamentCheersSadGesture", tags: "", seconds: 4 },
    105: { name: "Susto", group: "emocoes", fragment: "CrimeScareEasy", tags: "", seconds: 3 },
    114: { name: "Encolher-se", group: "emocoes", fragment: "Cower", tags: "", seconds: 6 },
    115: { name: "Nervoso", group: "emocoes", fragment: "Waiting_Nervous_LookingAround_Loop", tags: "", seconds: 8 },
    116: { name: "Chorar", group: "emocoes", fragment: "CryingStanding", tags: "", seconds: 8 },
    117: { name: "Exausto", group: "emocoes", fragment: "ExhaustedShort", tags: "", seconds: 10.8 },
    118: { name: "Palma na testa", group: "emocoes", fragment: "DiceGameKibitzerFacepalm", tags: "diceGameKibitzer", seconds: 7.1 },

    // The face, for a moment (the game's `ADLG_FA_*`; the man's laugh is `Haha`, the woman's `Laugh`).
    140: face("Sorrir", "ADLG_FA_Smile"),
    141: face("Sorriso largo", "ADLG_FA_SmileTeeth"),
    142: { ...face("Gargalhar", "ADLG_FA_Haha", "ADLG_FA_Laugh"), seconds: 5 },
    143: face("Piscar", "ADLG_FA_Wink"),
    144: face("Surpresa", "ADLG_FA_Surprise"),
    145: face("Desconfiar", "ADLG_FA_HmmSuspicious"),
    146: face("Dúvida", "ADLG_FA_IDontKnow"),
    147: face("Suspirar", "ADLG_FA_Sigh"),
    148: face("Nojo", "ADLG_FA_Disgust"),
    149: face("Irritação", "ADLG_FA_Annoyed"),

    // The face, kept (`FE_Default` with the mood's tag), until the neutral one hands it back.
    150: mood("Feliz", "happy"),
    151: mood("Bravo", "angry"),
    152: mood("Triste", "sad"),
    153: mood("Aflito", "nervous"),
    154: mood("Pensativo", "pensive"),
    155: mood("Arrogante", "arogant"),
    156: mood("Bêbado", "drunk"),
    157: mood("Olhos fechados", "FE_Sleeping"),
    158: mood("Neutro", ""),

    // The party and the music.
    119: { name: "Dançar", group: "festa", fragment: "Party_Standing_Dancing", tags: "variant_01", seconds: 20 },
    120: { name: "Conversar", group: "festa", fragment: "Party_Standing_Talking", tags: "variant_01", seconds: 20 },
    121: { name: "Flauta", group: "festa", fragment: "PlayFluteSong", tags: "tempo_slow", seconds: 66, props: [{ model: `${MUSIC}flute.cgf`, hand: "right", position: FLUTE_GRIP }] },
    122: { name: "Flauta alegre", group: "festa", fragment: "PlayFluteSong", tags: "tempo_fast", seconds: 67, props: [{ model: `${MUSIC}flute.cgf`, hand: "right", position: FLUTE_GRIP }] },
    123: { name: "Trompa", group: "festa", fragment: "WatchmanBlowhorn", tags: "", seconds: 14.1, wait: 60, props: [{ model: `${MUSIC}hunting_horn.cgf`, hand: "right", position: HORN_GRIP }] },

    // The faith.
    103: { name: "Persignar", group: "fe", fragment: "CrimeCross", tags: "", seconds: 3 },
    104: { name: "Rezar", group: "fe", fragment: "PrayStandShort", tags: "", seconds: 8, female: { fragment: "PrayStand", tags: "" } },
    124: { name: "Rezar muito", group: "fe", fragment: "PrayStandLong", tags: "", seconds: 25, female: { fragment: "PrayStand", tags: "" } },
    125: { name: "Ouvir a missa", group: "fe", fragment: "MassListener", tags: "var1", seconds: 20 },
    126: { name: "Pregar", group: "fe", fragment: "PriestSermonOutdoor", tags: "", seconds: 30 },
    127: { name: "Meditar", group: "fe", fragment: "Meditation", tags: "", seconds: 20 },

    // What is carried or done with the hands.
    128: { name: "Lampião", group: "objetos", ...LAMP, seconds: 0, hold: true, glow: LAMP_GLOW, props: [{ model: `${LIGHT}lamp_leather_hanging.cgf`, hand: "left" }] },
    129: { name: "Lampião fino", group: "objetos", ...LAMP, seconds: 0, hold: true, glow: LAMP_GLOW, props: [{ model: `${LIGHT}lantern_fancy_a_hanging.cgf`, hand: "left", position: FANCY_LANTERN_DOWN }] },
    130: {
        name: "Estandarte",
        group: "objetos",
        ...STANDARD_HAND,
        seconds: 0,
        hold: true,
        props: [
            { model: `${FLAGS}flag_spear_scaled.cgf`, hand: "right", position: STANDARD_POLE },
            { model: `${FLAGS}flag_temporary.cgf`, hand: "right", position: STANDARD_CLOTH, rotation: STANDARD_CLOTH_TURN },
        ],
    },
    131: { name: "Curativo", group: "objetos", fragment: "SelfBandaging", tags: "", seconds: 7.7 },
    132: { name: "Aquecer as mãos", group: "objetos", fragment: "WarmingHands", tags: "", seconds: 15.8 },
};

/** The dog's "Fazer carinho" (`dog-menu.ts`). */
export const DOG_PETTING = 201;

/**
 * Gestures the server plays from menus of its own and the wheel does not know: asked for by a client they are not played (`play`'s `fromMenu`).
 * The caress of the dog is the player's own animation in the game (`player_dog_carees_v01`, a man's body only); a woman's body has only the
 * housekeeper's (`housekeeper_dog_carees`), fifteen seconds in the game, of which the first seven are played.
 */
export const MENU_GESTURES: Readonly<Record<number, Gesture>> = {
    [DOG_PETTING]: { name: "Fazer carinho", group: "objetos", fragment: "DogPetting", tags: "", seconds: 3, female: { fragment: "HousekeeperDogCarees", tags: "", seconds: 7 } },
};

/** One gesture at a time per player. */
export const EVERY_MS = 800;

/** A gesture is let go this long after its seconds, if the game never said it was over. */
export const GRACE_MS = 1_500;

/** The list of gestures a player may pick is given at most this often. */
export const LIST_EVERY_MS = 500;

type Body = "male" | "female";

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 128) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

const bodyOf = (player: Player): Body => (player.appearance?.gender === "female" ? "female" : "male");

/** The catalog's rows of a fragment, read once (the game's catalog does not change while the server runs). */
const rowsKept = new Map<string, AnimationInfo[]>();

function rowsOf(fragment: string): AnimationInfo[] | null {
    const key = fragment.toLowerCase();
    const kept = rowsKept.get(key);
    if (kept !== undefined) {
        return kept;
    }
    try {
        const rows = Animations.list(fragment).filter((row) => row.fragment.toLowerCase() === key);
        rowsKept.set(key, rows);
        return rows;
    } catch {
        // The catalog cannot be asked: the game is then left to say no.
        return null;
    }
}

/** Whether the game has this fragment, with these tags, for this body (true when it cannot be asked). */
function hasWay(way: Way, body: Body): boolean {
    const rows = rowsOf(way.fragment);
    if (rows === null) {
        return true;
    }
    const wanted = way.tags === "" ? [] : way.tags.split("+");
    return rows.some((row) => {
        const forBody = body === "female" ? row.female : row.male;
        const tags = row.tags === undefined || row.tags === "" ? [] : row.tags.split("+");
        return forBody !== false && wanted.every((tag) => tags.includes(tag));
    });
}

/** The names `Animations.props()` has, read once; null when it cannot be asked. */
let propNames: Set<string> | null | undefined;

function propKnown(item: string): boolean {
    if (propNames === undefined) {
        try {
            propNames = new Set(Animations.props().map((prop) => prop.name));
        } catch {
            propNames = null;
        }
    }
    return propNames === null || propNames.has(item);
}

/** How a model of a gesture is named when an administrator moves it: the gesture's number, and `.2` or `.3` for the second or third model in its hands (the standard's cloth is `130.2`). */
export const tuneKey = (id: number, piece: number): string => (piece <= 1 ? String(id) : `${id}.${piece}`);

export class Emotes {
    private readonly lastAt = new Map<number, number>();
    private readonly listedAt = new Map<number, number>();
    /** The body gesture each player is playing (ours), so that only ours is let go when it is over. */
    private readonly playing = new Map<number, { readonly serial: number; readonly fragment: string; readonly id: number }>();
    /** The face gesture a player is making, to hand the face back when it is over. */
    private readonly faces = new Map<number, number>();
    /** The mood each player keeps on the face. */
    private readonly moods = new Map<number, Way>();
    /** The fragment a player's last gesture was replaced from by the next one of ours, for the "replaced" the game says of it not to be taken for the new gesture's end. */
    private readonly replacing = new Map<number, { readonly fragment: string; readonly until: number }>();
    /** When each player may play the gestures that make them wait. */
    private readonly waiting = new Map<number, Map<number, number>>();
    private readonly missing = new Set<string>();
    private readonly off = new Set<number>();
    /** Where an administrator has put the models of a gesture in the hand (`/gesto ajustar`), over what the catalog above says, by `tuneKey`; kept in `playerdata/emotes.json`. */
    private readonly tuned = new Map<string, { readonly position: Offset; readonly rotation: Offset }>();
    /** The light of each lamp that is carried, by the carrier's id, and where it was put last. */
    private readonly lamps = new Map<number, Glow>();
    /** Says something of the lamps to every player in the game (each client draws them, `src/client/lamps.ts`). */
    broadcast: (payload: string) => void = (payload) => {
        let players: Player[];
        try {
            players = Player.all();
        } catch {
            return;
        }
        for (const player of players) {
            if (player.ready) {
                try {
                    player.emit(LAMP_EVENT, payload);
                } catch {
                    // Gone.
                }
            }
        }
    };
    private serial = 0;

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly later: (fn: () => void, ms: number) => void = (fn, ms) => {
            setTimeout(fn, ms);
        },
    ) {}

    /** Which gestures an administrator has switched off, and a switch for one of them (kept in `playerdata/emotes.json`). */
    switchedOff(): number[] {
        return [...this.off].sort((a, b) => a - b);
    }

    isOff(id: number): boolean {
        return this.off.has(id);
    }

    /** Switches a gesture of the wheel off or on, for everybody, and keeps it so. False for a number that is no gesture of the wheel. */
    setOff(id: number, off: boolean): boolean {
        if (GESTURES[id] === undefined) {
            return false;
        }
        if (off) {
            this.off.add(id);
        } else {
            this.off.delete(id);
        }
        return this.save();
    }

    /** Keeps what the administrators chose (the gestures switched off, and the models put where they wanted in the hand). */
    private save(): boolean {
        const tune: Record<string, { position: Offset; rotation: Offset }> = {};
        for (const [key, place] of this.tuned) {
            tune[key] = { position: place.position, rotation: place.rotation };
        }
        try {
            ensureDir(DIR);
            write(FILE, this.tuned.size === 0 ? { v: 1, off: this.switchedOff() } : { v: 1, off: this.switchedOff(), tune });
        } catch (error: unknown) {
            console.log(`emotes: não consegui guardar o que o administrador escolheu: ${error instanceof Error ? error.message : String(error)}`);
        }
        return true;
    }

    /** What an administrator put a model of a gesture at, if they did (`piece` counts the models in its hands from 1). */
    tuning(id: number, piece = 1): { readonly position: Offset; readonly rotation: Offset } | undefined {
        return this.tuned.get(tuneKey(id, piece));
    }

    /** Puts a model of a gesture (the first, or the `piece`th) where the administrator wants it in the hand, for everybody, and keeps it so. False for a gesture with no such model in its hands. */
    tune(id: number, position: Offset, rotation: Offset = { x: 0, y: 0, z: 0 }, piece = 1): boolean {
        if (!Number.isInteger(piece) || piece < 1 || GESTURES[id]?.props?.[piece - 1] === undefined) {
            return false;
        }
        this.tuned.set(tuneKey(id, piece), { position, rotation });
        return this.save();
    }

    /** Takes the administrator's place for a model away (for every model of the gesture when no `piece` is named): the catalog's is used again. */
    untune(id: number, piece?: number): boolean {
        const keys = piece === undefined ? [...this.tuned.keys()].filter((key) => Number(key.split(".")[0]) === id) : [tuneKey(id, piece)];
        let any = false;
        for (const key of keys) {
            any = this.tuned.delete(key) || any;
        }
        return any && this.save();
    }

    /** Every model of a gesture that an administrator has moved. */
    tunedList(): Array<{ readonly id: number; readonly piece: number; readonly position: Offset; readonly rotation: Offset }> {
        return [...this.tuned]
            .map(([key, place]) => {
                const [id = 0, piece = 1] = key.split(".").map(Number);
                return { id, piece, position: place.position, rotation: place.rotation };
            })
            .sort((a, b) => a.id - b.id || a.piece - b.piece);
    }

    /** Plays a gesture again from the start for the one who is trying it, a carried one included (asking for it twice would put it down). */
    preview(player: Player, id: number): boolean {
        this.lastAt.delete(player.id);
        this.waiting.get(player.id)?.delete(id);
        if (this.playing.get(player.id)?.id === id) {
            this.release(player);
            this.lastAt.delete(player.id);
        }
        return this.play(player, id);
    }

    /** Takes back the gestures that were switched off before the last stop. */
    load(): void {
        const found = read<{ off?: unknown }>(FILE);
        if (found.status === "corrupt") {
            console.log(`emotes: ${FILE} está ilegível e foi deixado como está: ${found.reason}`);
            return;
        }
        if (found.status !== "ok" || !Array.isArray(found.value.off)) {
            return;
        }
        for (const id of found.value.off) {
            if (typeof id === "number" && GESTURES[id] !== undefined) {
                this.off.add(id);
            }
        }
        const tune = (found.value as { tune?: unknown }).tune;
        if (typeof tune === "object" && tune !== null) {
            const offsetOf = (value: unknown): Offset | null => {
                const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
                const x = raw["x"];
                const y = raw["y"];
                const z = raw["z"];
                return typeof x === "number" && typeof y === "number" && typeof z === "number" && [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
            };
            for (const [key, place] of Object.entries(tune as Record<string, unknown>)) {
                const [id = Number.NaN, piece = 1] = key.split(".").map(Number);
                const raw = (typeof place === "object" && place !== null ? place : {}) as Record<string, unknown>;
                const position = offsetOf(raw["position"]);
                const rotation = offsetOf(raw["rotation"]);
                if (/^\d+(\.\d+)?$/.test(key) && Number.isInteger(id) && Number.isInteger(piece) && piece >= 1 && GESTURES[id]?.props?.[piece - 1] !== undefined && position !== null && rotation !== null) {
                    this.tuned.set(tuneKey(id, piece), { position, rotation });
                }
            }
        }
    }

    /** What a body plays for a gesture: the woman's own where the game names hers otherwise. */
    private wayOf(gesture: Gesture, body: Body): { readonly way: Way; readonly seconds: number } {
        const hers = body === "female" ? gesture.female : undefined;
        return { way: hers ?? gesture, seconds: hers?.seconds ?? gesture.seconds };
    }

    /** Whether the game can play this gesture on this body: the fragment and its tags are in the catalog for that sex, and so are the props it holds. */
    private usable(gesture: Gesture, body: Body): boolean {
        const { way } = this.wayOf(gesture, body);
        if (gesture.kind === "face" || (gesture.kind === "mood" && way.fragment === "")) {
            return true;
        }
        return hasWay(way, body) && (gesture.props ?? []).every((prop) => prop.item === undefined || propKnown(prop.item));
    }

    /** The numbers of the gestures this player's body can play, which the wheel offers them (2026-10-26: a gesture the game has for a man only is not offered to a woman). */
    availableFor(player: Player): number[] {
        const body = bodyOf(player);
        return Object.keys(GESTURES)
            .map(Number)
            .filter((id) => !this.off.has(id) && this.usable(GESTURES[id] as Gesture, body));
    }

    /** Tells a player which gestures they may pick (the wheel asks each time it opens). */
    sendList(player: Player): boolean {
        const now = this.now();
        if (now - (this.listedAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < LIST_EVERY_MS) {
            return false;
        }
        this.listedAt.set(player.id, now);
        player.emit(`${RESOURCE}:emote.list`, JSON.stringify({ ids: this.availableFor(player) }));
        return true;
    }

    /** Plays gesture `id` on the player (one of `MENU_GESTURES` only when `fromMenu`, a menu of the server's own asking; `STOP` lets go of what the wheel started). False when it was not played. */
    play(player: Player, id: unknown, fromMenu = false): boolean {
        if (typeof id !== "number" || !player.ready || !player.alive || player.mounted === true || sessionOf(player.id) !== null) {
            return false;
        }
        if (id === STOP) {
            return this.stop(player);
        }
        const gesture = GESTURES[id] ?? (fromMenu ? MENU_GESTURES[id] : undefined);
        if (gesture === undefined || (this.off.has(id) && GESTURES[id] !== undefined)) {
            return false;
        }
        const now = this.now();
        if (now - (this.lastAt.get(player.id) ?? Number.NEGATIVE_INFINITY) < EVERY_MS) {
            return false;
        }
        this.lastAt.set(player.id, now);
        // What is carried is put down by asking for it again.
        const current = this.playing.get(player.id);
        if (gesture.hold === true && current?.id === id) {
            this.release(player);
            return true;
        }
        const body = bodyOf(player);
        const { way, seconds } = this.wayOf(gesture, body);
        if (!this.usable(gesture, body)) {
            if (!this.missing.has(way.fragment)) {
                this.missing.add(way.fragment);
                console.log(`emotes: o catálogo de animações não tem '${way.fragment}'${way.tags === "" ? "" : ` [${way.tags}]`} para o corpo ${body === "female" ? "de mulher" : "de homem"}; o gesto ${String(id)} não toca`);
            }
            Chat.sendToPlayer(player, "Esse gesto não está disponível para o seu personagem.");
            return false;
        }
        const waited = this.waiting.get(player.id)?.get(id) ?? 0;
        if (gesture.wait !== undefined && now < waited) {
            Chat.sendToPlayer(player, `Aguarde ${Math.ceil((waited - now) / 1000)} s para fazer esse gesto de novo.`);
            return false;
        }
        const played = gesture.kind === "face" || gesture.kind === "mood" ? this.playFace(player, id, gesture, way, seconds) : this.playBody(player, id, gesture, way, seconds);
        if (played && gesture.wait !== undefined) {
            const mine = this.waiting.get(player.id) ?? new Map<number, number>();
            mine.set(id, now + gesture.wait * 1000);
            this.waiting.set(player.id, mine);
        }
        return played;
    }

    private playBody(player: Player, id: number, gesture: Gesture, way: Way, seconds: number): boolean {
        lowerTorch(player);
        const before = this.playing.get(player.id);
        const options: { tags?: string; props?: Array<{ item?: string; model?: string; hand: "left" | "right"; position?: Offset; rotation?: Offset }> } = {};
        if (way.tags !== "") {
            options.tags = way.tags;
        }
        if (gesture.props !== undefined) {
            options.props = gesture.props.map((prop, index) => {
                const place = this.tuned.get(tuneKey(id, index + 1)) ?? { position: prop.position, rotation: prop.rotation };
                return {
                    ...(prop.item === undefined ? {} : { item: prop.item }),
                    ...(prop.model === undefined ? {} : { model: prop.model }),
                    hand: prop.hand,
                    ...(place.position === undefined ? {} : { position: place.position }),
                    ...(place.rotation === undefined || (place.rotation.x === 0 && place.rotation.y === 0 && place.rotation.z === 0) ? {} : { rotation: place.rotation }),
                };
            });
        }
        let played = false;
        try {
            played = player.playAnimation(way.fragment, options);
        } catch (error: unknown) {
            // A prop or an option the game cannot use on this build. A model the game will not put in a hand (2026-10-27: they are given by path now) costs the gesture its
            // object and not the gesture: it is played again with the hands empty, as the horn and the flute were before, and the log says what was refused.
            console.log(`emotes: o gesto ${String(id)} (${way.fragment}) foi recusado: ${error instanceof Error ? error.message : String(error)}`);
            if (options.props === undefined) {
                Chat.sendToPlayer(player, "Esse gesto não está disponível para o seu personagem.");
                return false;
            }
            delete options.props;
            try {
                played = player.playAnimation(way.fragment, options);
            } catch (again: unknown) {
                console.log(`emotes: o gesto ${String(id)} (${way.fragment}) foi recusado sem o objeto também: ${again instanceof Error ? again.message : String(again)}`);
                Chat.sendToPlayer(player, "Esse gesto não está disponível para o seu personagem.");
                return false;
            }
        }
        if (!played) {
            return false;
        }
        if (gesture.glow === undefined) {
            this.stopGlow(player);
        } else {
            this.startGlow(player, gesture.glow);
        }
        if (before !== undefined) {
            this.replacing.set(player.id, { fragment: before.fragment, until: this.now() + 2_000 });
        }
        const mine = ++this.serial;
        this.playing.set(player.id, { serial: mine, fragment: way.fragment, id });
        if (gesture.hold !== true) {
            this.later(() => {
                if (this.playing.get(player.id)?.serial === mine) {
                    this.release(player);
                }
            }, Math.round(seconds * 1000) + GRACE_MS);
        }
        return true;
    }

    /** A gesture of the face plays once and hands the face back (to the mood kept, if there is one); a mood is kept until the neutral one. */
    private playFace(player: Player, id: number, gesture: Gesture, way: Way, seconds: number): boolean {
        try {
            const done = way.fragment === "" ? player.setFacialExpression("") : player.setFacialExpression(way.fragment, way.tags === "" ? {} : { tags: way.tags });
            if (!done) {
                return false;
            }
        } catch (error: unknown) {
            console.log(`emotes: o gesto ${String(id)} (${way.fragment}) foi recusado: ${error instanceof Error ? error.message : String(error)}`);
            Chat.sendToPlayer(player, "Esse gesto não está disponível para o seu personagem.");
            return false;
        }
        if (gesture.kind === "mood") {
            this.faces.delete(player.id);
            if (way.fragment === "") {
                this.moods.delete(player.id);
            } else {
                this.moods.set(player.id, way);
            }
            return true;
        }
        const mine = ++this.serial;
        this.faces.set(player.id, mine);
        this.later(() => {
            if (this.faces.get(player.id) === mine) {
                this.faces.delete(player.id);
                this.faceBack(player);
            }
        }, Math.round(seconds * 1000));
        return true;
    }

    /** The face as it was before a gesture: the mood the player keeps, or the game's own. */
    private faceBack(player: Player): void {
        const kept = this.moods.get(player.id);
        try {
            if (kept === undefined) {
                player.setFacialExpression("");
            } else {
                player.setFacialExpression(kept.fragment, kept.tags === "" ? {} : { tags: kept.tags });
            }
        } catch {
            // Gone meanwhile.
        }
    }

    /** "Parar": lets go of the body gesture, the face gesture and the mood the wheel started. */
    private stop(player: Player): boolean {
        if (this.playing.has(player.id)) {
            this.release(player);
        }
        if (this.faces.delete(player.id) || this.moods.delete(player.id)) {
            try {
                player.setFacialExpression("");
            } catch {
                // Gone meanwhile.
            }
        }
        return true;
    }

    /** Lets the body go. */
    private release(player: Player): void {
        this.playing.delete(player.id);
        this.stopGlow(player);
        try {
            player.stopAnimation();
        } catch {
            // Gone meanwhile.
        }
    }

    /** What the game says of the animation of a request: a gesture of ours that finished is let go at once; one cut short (or replaced, or one that is carried) is forgotten. */
    ended(player: Player, fragment: string, reason: string): void {
        // The old gesture's end, said by the game when ours took its place, is not the end of ours (it may come before or after the new one is written down).
        const swap = this.replacing.get(player.id);
        if (reason === "replaced" && swap !== undefined && swap.fragment === fragment && this.now() <= swap.until) {
            this.replacing.delete(player.id);
            return;
        }
        const mine = this.playing.get(player.id);
        if (mine === undefined || mine.fragment !== fragment) {
            return;
        }
        if (reason === "finished" && GESTURES[mine.id]?.hold !== true) {
            this.release(player);
        } else if (reason !== "stopped") {
            this.playing.delete(player.id);
            this.stopGlow(player);
        }
    }

    /** One lamp as the clients are told of it: [the carrier's id, colour, intensity, radius, height above the feet]. */
    private static lampRow(id: number, glow: Glow): readonly [number, readonly [number, number, number], number, number, number] {
        return [id, glow.color, glow.intensity, glow.radius, glow.rise];
    }

    /** A lamp lit on its carrier: every client draws its light from now on, kept by the carrier's id until the lamp is put down. */
    private startGlow(player: Player, glow: Glow): void {
        this.lamps.set(player.id, glow);
        this.broadcast(JSON.stringify({ on: Emotes.lampRow(player.id, glow) }));
    }

    private stopGlow(player: Player | number): void {
        const id = typeof player === "number" ? player : player.id;
        if (!this.lamps.delete(id)) {
            return;
        }
        this.broadcast(JSON.stringify({ off: id }));
    }

    /** Every lamp lit now, for a player who has just come in: their client draws the others' too. */
    lampsPayload(): string {
        return JSON.stringify({ all: [...this.lamps].map(([id, glow]) => Emotes.lampRow(id, glow)) });
    }

    /** How many lamps are lit. */
    lit(): number {
        return this.lamps.size;
    }

    /** A lamp whose carrier is gone, dead or not in the world any more is put out (each client moves the light with the body, `src/client/lamps.ts`). */
    checkLamps(bodyOf: (id: number) => Player | null = (id) => Player.getById(id)): void {
        for (const id of [...this.lamps.keys()]) {
            const carrier = bodyOf(id);
            if (carrier === null || !carrier.ready || !carrier.alive) {
                this.stopGlow(id);
            }
        }
    }

    /** A body that comes back from the dead or from the menu is a new one: what the old one wore on its face is gone. */
    reset(player: Player): void {
        this.stopGlow(player);
        this.playing.delete(player.id);
        this.replacing.delete(player.id);
        this.faces.delete(player.id);
        this.moods.delete(player.id);
    }

    left(player: Player): void {
        this.lastAt.delete(player.id);
        this.listedAt.delete(player.id);
        this.waiting.delete(player.id);
        this.reset(player);
    }
}

export const emotes = new Emotes();

export function installEmotes(): void {
    emotes.load();
    Events.onClient(`${RESOURCE}:emote.play`, (sender, payload) => {
        emotes.play(sender as Player, fieldsOf(payload)["id"]);
    });
    Events.onClient(`${RESOURCE}:emote.list`, (sender) => {
        emotes.sendList(sender as Player);
    });
    Events.on("playerAnimationEnd", (player, fragment, reason) => emotes.ended(player, fragment, reason));
    setInterval(() => {
        if (emotes.lit() > 0) {
            emotes.checkLamps();
        }
    }, LAMP_CHECK_MS);
    // A body that comes in is told of the lamps the others carry, after its own (a new body's) is put out.
    Events.on("playerSpawned", (player) => {
        emotes.reset(player);
        if (emotes.lit() > 0) {
            player.emit(LAMP_EVENT, emotes.lampsPayload());
        }
    });
    Events.on("playerDisconnect", (player) => emotes.left(player));
    const off = emotes.switchedOff();
    console.log(`emotes: ${Object.keys(GESTURES).length} gestos em ${GROUPS.length} grupos na roda do G, escolhidos com um clique na página nossa (a roda do framework fica desligada)${off.length > 0 ? `; desligados por um administrador: ${off.join(", ")}` : ""}`);
}
