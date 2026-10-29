/**
 * What the player is looking at, named under the crosshair where the game puts its own "press [key]" prompt:
 *
 * - a door or chest of a property: its name, and its owner's when it has one ("Casa 03 · Entrada - Hans"; user, 2026-10-19: "o nome
 *   dos baús, propriedades e portas exibindo na tela, vamos devolver"). The server is told it is looked at (`props.look`) and
 *   answers what F does there for this player (`props.can`): "[F] Trancar" or "[F] Destrancar" for whoever
 *   holds its key or owns it (user, 2026-10-19: "o E é apenas abrir, o F destrancar ou trancar"). The E stays the game's own; it is
 *   told to the server too (`props.use`, with whether the game's own "Abrir" was on the screen), which draws the bolt of a locked
 *   door from inside and says when a door or chest is locked (`src/server/property-menu.ts`);
 * - another player: "Desconhecido" until they have introduced themselves, then their name, with the game's own
 *   "[E] Conversar" hint, which opens the talk menu on them (`src/server/encounters.ts`).
 *
 * The name is drawn with `NativeUI`, so it is the game's own font (Kingdom Come, the regular face), in white with a dark
 * shadow so it reads on snow and on stone alike. Every 150 ms a short ray goes out from the camera through the crosshair;
 * what it meets is asked of the server, which knows the properties and who has introduced themselves to whom, and
 * answers with the text, or with nothing. Answers are kept for half a minute, and the server sends a new one at once
 * when somebody introduces themselves.
 *
 * Nothing here is authority: it is a name on a screen and keys that ask the server. Where the name sits and how big it
 * is are the constants below.
 */

import { cartIsNear } from "./carts.js";
import { playingDice } from "./dice-quiet.js";
import { setPersonInView } from "./interaction.js";
import { REACH_M } from "./reach.js";

const RESOURCE = "kcdc-gamemode";

const SCAN_EVERY_MS = 150;

/**
 * How far from the BODY a door, a chest or another player is read and talked to: the one reach of all our prompts (`reach.ts`, two metres to the
 * thing's surface; the game's own prompt appears at about that). It was read along the camera's ray before, 2.8 m for a door and 3 m for a person,
 * which in the mod's third person (a camera 3.5 m behind the body) left a door two metres off out of reach. The server allows a metre more.
 */
const LOOK_RANGE_M = 10;
/** How high above or below the feet a thing may be hit and still be within reach. */
const REACH_UP_M = 3;

const KEEP_MS = 30_000;
const ASK_AGAIN_MS = 2_000;

/** An E at a property is told to the server once in this long at most. */
const USE_EVERY_MS = 600;
/** The physical key the game's "use" is on by default: E. */
const USE_KEY = "e";

/** Living things are never properties; no need to ask the server about each villager looked at. */
const LIVING = /NPC|Player|Horse|Dog|Wolf|Animal/i;

// The game's own stage is 1920 by 1080, whatever the screen: the text is centred on it, a little under the middle.
const TEXT_Y = 720;
const TEXT_HEIGHT = 56;
const TEXT_SIZE = 30;
const TEXT_COLOR = 0xffffff;
const SHADOW_COLOR = 0x000000;
const SHADOW_OFFSET = 2;
const FONT = "DefaultFont";

/** The talk hint: the interaction key, whatever the player has bound to it. */
const TALK_KEY = "primary_action";
const TALK_TEXT = "Conversar";

/** The control the game's own "Abrir"/"Fechar" of a door is on (its lockpick is on another, "use_other"). */
const USE_CONTROL = "use";

/**
 * Locking and unlocking: F by default (the game's "attack_special", which grabs a body or butchers, nothing a door or a chest
 * has), so that the E stays the door's own.
 */
const LOCK_KEY = "attack_special";
const LOCK_WORDS: Readonly<Record<string, string>> = { lock: "Trancar", unlock: "Destrancar" };

/** The part looked at is told to the server this often while it lasts, and no faster than this when it changes. */
const LOOK_EVERY_MS = 700;
const LOOK_MIN_GAP_MS = 300;

interface Known {
    label: string;
    at: number;
    /** The server says this is a door or chest of a property: an E pressed at it is told to the server. */
    use: boolean;
    /** ... and that it is one of the doors, the only part a look is told for. */
    door: boolean;
}

interface Look {
    readonly label: string;
    /** Network id of the player looked at, or 0. */
    readonly player: number;
    /** GUID of the door or chest of a property in reach, with nothing alive in front of it, or "". */
    readonly use: string;
    /** Whether that is a door. */
    readonly door: boolean;
}

const NOTHING: Look = { label: "", player: 0, use: "", door: false };

const known = new Map<string, Known>();
const asked = new Map<string, number>();
const knownPlayers = new Map<number, Known>();
const askedPlayers = new Map<number, number>();

let screen: NativeScreen | null = null;
let main: NativeClip | null = null;
let shadow: NativeClip | null = null;
let shown = "";
let reopenAt = 0;
let lastError = "";

let talkTarget = 0;
let talkHint = 0;
let hintBroken = false;

/** The property under the crosshair as of the last look, for an E press. */
let useTarget = "";
let usedAt = 0;

/** The part last told to the server as looked at, and when. */
let lookSent = "";
let lookSentAt = 0;

/** What the server said F does, and at which part. */
let canGuid = "";
let canState = "";
/** Our "[F] Trancar/Destrancar" hint, and the word it shows. */
let lockHint = 0;
let lockHintWord = "";
let lockHintBroken = false;

function field(root: NativeClip, width: number, offset: number, color: number): NativeClip | null {
    const text = root.createText({ x: offset, y: TEXT_Y + offset, width, height: TEXT_HEIGHT });
    if (text === null) {
        return null;
    }
    text.setTextStyle({ font: FONT, size: TEXT_SIZE, color, align: "center" });
    text.set({ visible: false });
    return text;
}

function open(): void {
    const made = NativeUI.createScreen();
    screen = made;
    made.on("ready", () => {
        const root = made.root;
        if (root === null) {
            return;
        }
        const width = made.stage()?.width ?? 1920;
        shadow = field(root, width, SHADOW_OFFSET, SHADOW_COLOR);
        main = field(root, width, 0, TEXT_COLOR);
        shown = "";
    });
    made.on("unload", () => {
        // A level load takes the movie away: the next look builds it again.
        screen = null;
        main = null;
        shadow = null;
        shown = "";
        reopenAt = Date.now() + 2_000;
    });
}

function show(text: string): void {
    if (text === shown || main === null || shadow === null) {
        return;
    }
    shown = text;
    if (text === "") {
        main.set({ visible: false });
        shadow.set({ visible: false });
        return;
    }
    shadow.setText(text);
    main.setText(text);
    shadow.set({ visible: true });
    main.set({ visible: true });
}

/** Puts the talk hint up for a player, or takes it down for 0. */
function hint(target: number): void {
    // Beside a cart the E is the cart's: a talk hint put up there, over it, took the key from "Subir na carroça" whenever
    // somebody else was getting down too.
    if (target !== 0 && cartIsNear()) {
        target = 0;
    }
    talkTarget = target;
    if (target === 0) {
        if (talkHint !== 0) {
            ActionHint.remove(talkHint);
            talkHint = 0;
        }
    } else if (talkHint === 0 && !hintBroken) {
        try {
            talkHint = ActionHint.create({ key: TALK_KEY, text: TALK_TEXT }, () => {
                if (talkTarget !== 0) {
                    Events.emitServer(`${RESOURCE}:players.talk`, JSON.stringify({ id: talkTarget }));
                }
            });
        } catch (thrown: unknown) {
            // A build without that control: the name still shows, and nothing is tried again.
            hintBroken = true;
            console.error(`property labels: the talk hint could not be put up: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }
    // Only a hint that is really up takes the key from the dice table's.
    setPersonInView(talkHint !== 0 ? talkTarget : 0);
}

/** Whether the game's own "Abrir"/"Fechar" is on the screen: at a locked door, the game offers it only from inside. */
function usePromptUp(): boolean {
    try {
        return ActionHint.isKeyInUse(USE_CONTROL);
    } catch {
        return false;
    }
}

/** Tells the server which part of a property the player looks at ("" for none), again every so often while the look lasts. */
function looked(part: string): void {
    const now = Date.now();
    const same = part === lookSent;
    if (same && (part === "" || now - lookSentAt < LOOK_EVERY_MS)) {
        return;
    }
    if (!same && part !== "" && now - lookSentAt < LOOK_MIN_GAP_MS) {
        return;
    }
    lookSent = part;
    lookSentAt = now;
    Events.emitServer(`${RESOURCE}:props.look`, JSON.stringify({ guid: part }));
}

/** Our "[F] Trancar" or "[F] Destrancar" at the part looked at, while the server says the player may. */
function syncLockHint(part: string): void {
    const word = part !== "" && part === canGuid ? (LOCK_WORDS[canState] ?? "") : "";
    if (word === "") {
        if (lockHint !== 0) {
            ActionHint.remove(lockHint);
            lockHint = 0;
            lockHintWord = "";
        }
        return;
    }
    if (lockHint !== 0) {
        if (word !== lockHintWord) {
            ActionHint.setText(lockHint, word);
            lockHintWord = word;
        }
        return;
    }
    if (lockHintBroken) {
        return;
    }
    try {
        lockHint = ActionHint.create({ key: LOCK_KEY, text: word }, () => {
            if (canGuid !== "") {
                Events.emitServer(`${RESOURCE}:props.toggle`, JSON.stringify({ guid: canGuid }));
            }
        });
        lockHintWord = word;
    } catch (thrown: unknown) {
        // A build without that control: the panel's lock buttons still lock and unlock.
        lockHintBroken = true;
        console.error(`property labels: the lock hint could not be put up: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
}

/** E was pressed: at a property in reach, the server is told, with whether the game's own "Abrir" was on the screen. */
function pressedUse(): void {
    const now = Date.now();
    if (useTarget === "" || now - usedAt < USE_EVERY_MS || Hud.isInDialogue() || !LocalPlayer?.ready) {
        return;
    }
    usedAt = now;
    Events.emitServer(`${RESOURCE}:props.use`, JSON.stringify({ guid: useTarget, use: usePromptUp() }));
}

function remembered<K>(cache: Map<K, Known>, sent: Map<K, number>, key: K, ask: () => void, now: number): Known | undefined {
    const entry = cache.get(key);
    if ((entry === undefined || now - entry.at >= KEEP_MS) && now - (sent.get(key) ?? 0) >= ASK_AGAIN_MS) {
        sent.set(key, now);
        ask();
    }
    return entry;
}

/** What is under the crosshair: remembered, or asked of the server (and shown when it answers). */
function lookUnderCrosshair(): Look {
    const me = LocalPlayer;
    if (!me || !me.ready || !me.alive) {
        return NOTHING;
    }
    const ray = Camera.screenRay({ range: LOOK_RANGE_M });
    if (!ray) {
        return NOTHING;
    }
    const now = Date.now();
    // How far a hit is from the player's body, flat, and whether it is within reach of it: what the camera is, in third person, does not matter.
    const feet = me.position;
    const within = (hit: { position: { x: number; y: number; z: number } }): boolean => Math.hypot(hit.position.x - feet.x, hit.position.y - feet.y) <= REACH_M && Math.abs(hit.position.z - feet.z) <= REACH_UP_M;
    // Something alive in front of a door: an E then is for it, not for the door.
    let blocked = false;
    for (const hit of World.raycastAll(ray.origin, ray.target, { mode: "anything", maxHits: 4 })) {
        const body = hit.player;
        if (body !== null && body !== undefined) {
            if (body.local) {
                continue;
            }
            // A body further off than talking range hides whatever is behind it.
            if (!within(hit)) {
                return NOTHING;
            }
            const id = body.id;
            // Somebody in a dice match is nobody's to talk to, not even by name (2026-10-20): neither label nor hint.
            if (playingDice(id)) {
                return NOTHING;
            }
            const entry = remembered(knownPlayers, askedPlayers, id, () => Events.emitServer(`${RESOURCE}:players.peek`, JSON.stringify({ id })), now);
            return entry !== undefined && entry.label !== "" ? { label: entry.label, player: id, use: "", door: false } : NOTHING;
        }
        const guid = hit.entityGuid;
        if (LIVING.test(hit.entityClass ?? "")) {
            blocked = within(hit) || blocked;
            continue;
        }
        if (!within(hit) || guid === null) {
            continue;
        }
        const entry = remembered(known, asked, guid, () => Events.emitServer(`${RESOURCE}:props.peek`, JSON.stringify({ guid })), now);
        if (entry !== undefined && entry.label !== "") {
            return { label: entry.label, player: 0, use: entry.use && !blocked ? guid : "", door: entry.door };
        }
    }
    return NOTHING;
}

function parse(payload: unknown): Record<string, unknown> {
    let parsed: unknown = payload;
    if (typeof payload === "string") {
        try {
            parsed = JSON.parse(payload) as unknown;
        } catch {
            return {};
        }
    }
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

export function installPropertyLabels(): void {
    Events.on(`${RESOURCE}:props.label`, (payload) => {
        const body = parse(payload);
        if (typeof body["guid"] === "string" && typeof body["label"] === "string") {
            known.set(body["guid"], { label: body["label"].slice(0, 120), at: Date.now(), use: body["use"] === true, door: body["door"] === true });
        }
    });

    // What F does at the part looked at, for this player: "lock", "unlock" or "".
    Events.on(`${RESOURCE}:props.can`, (payload) => {
        const body = parse(payload);
        const guid = body["guid"];
        const lock = body["lock"];
        if ((guid === "" || (typeof guid === "string" && /^[0-9a-f]{8,32}$/.test(guid))) && (lock === "lock" || lock === "unlock" || lock === "")) {
            canGuid = guid;
            canState = lock;
        }
    });

    Events.on(`${RESOURCE}:players.label`, (payload) => {
        const body = parse(payload);
        if (typeof body["id"] === "number" && typeof body["label"] === "string") {
            knownPlayers.set(body["id"], { label: body["label"].slice(0, 80), at: Date.now(), use: false, door: false });
        }
    });

    const timer = setInterval(() => {
        try {
            // Not before the player is in the world: a screen asked for while the level is still loading is
            // one more thing for the join to wait on, and the join has enough to wait on.
            if (!LocalPlayer?.ready) {
                hint(0);
                useTarget = "";
                looked("");
                syncLockHint("");
                return;
            }
            // The free camera (camera.ts) is for pictures: nothing written over them, and its view is not the player's aim.
            // The same goes for a shot the creator (creator-page.ts) holds the camera on.
            const shot = typeof Camera !== "undefined" && typeof Camera.isShotActive === "function" && Camera.isShotActive();
            if (shot || (typeof NoClip !== "undefined" && NoClip.isActive())) {
                show("");
                hint(0);
                useTarget = "";
                looked("");
                syncLockHint("");
                return;
            }
            if (screen === null && Date.now() >= reopenAt) {
                open();
                reopenAt = Date.now() + 2_000;
            }
            const look = lookUnderCrosshair();
            // A person, or a door or chest of a property (the menu that had their names is gone).
            show(look.label);
            hint(look.player);
            // A person under the crosshair comes first.
            useTarget = look.player === 0 ? look.use : "";
            looked(useTarget);
            syncLockHint(useTarget);
        } catch (thrown: unknown) {
            // A frame the view could not be read (a level loading, a cutscene) is not worth more than a pause.
            reopenAt = Date.now() + 5_000;
            const message = thrown instanceof Error ? thrown.message : String(thrown);
            if (message !== lastError) {
                lastError = message;
                console.error(`property labels: ${message}`);
            }
        }
    }, SCAN_EVERY_MS);

    try {
        Key.bind(USE_KEY, "down", pressedUse);
    } catch (thrown: unknown) {
        console.error(`property labels: the E key could not be watched: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }

    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            hint(0);
            useTarget = "";
            syncLockHint("");
            screen?.close();
        }
    });
}
