/**
 * What the player is looking at, named under the crosshair where the game puts its own "press [key]" prompt:
 *
 * - a door or chest of a property: "Casa 03 - Fulano", or just "Casa 03" when nobody owns it;
 * - another player: "Desconhecido" until they have introduced themselves, then their name, with the game's own
 *   "[E] Conversar" hint, which opens the talk menu on them (`src/server/encounters.ts`).
 *
 * A door or chest of a property gets no hint of ours beside the game's own: its "Abrir" is the one thing on offer there, and
 * the server hears it and puts up the menu (`src/server/property-menu.ts`). Our own "[E] Fechadura" beside the game's "Abrir"
 * was the two options a player found at a door after logging in inside a house (2026-10-15). An E pressed at a property
 * is told to the server too (`props.use`): a client whose door is out of step with the server (KCDC logs "Door
 * dispatcher unavailable") never reports the game's own press, and the server then puts the menu up without it.
 *
 * The one exception is a door the server holds locked in the world for this very look (`props.gaze` says which door is
 * looked at, `props.gazed` says it is held): the game then offers nothing at it, so that the press does not open the door
 * and have it put back (the body opened it and it closed by itself before the menu, 2026-10-15), and our own "Abrir" takes
 * the game's place -- the same hint, drawn by the game's own HUD, with the same key -- but only once the game's own prompt
 * is gone, never beside it. Its press is the E told to the server above, which brings the menu up. Where the game's prompt
 * stays up under the lock -- the side of the door without the keyhole, where the game always offers its "Abrir" and the lock
 * would only make it a refusal, or a door that does not lock -- the hold is let go for that look (`released`), and the E
 * told to the server says whether the game's own prompt was up when it was pressed.
 *
 * The name is drawn with `NativeUI`, so it is the game's own font (Kingdom Come, the regular face), in white with a dark
 * shadow so it reads on snow and on stone alike. Every 150 ms a short ray goes out from the camera through the crosshair;
 * what it meets is asked of the server, which knows the properties and who has introduced themselves to whom, and
 * answers with the text, or with nothing. Answers are kept for half a minute, and the server sends a new one at once
 * when somebody introduces themselves.
 *
 * Nothing here is authority: it is a name on a screen and a key that asks the server. Where the name sits and how big it
 * is are the constants below.
 */

import { setPersonInView } from "./interaction.js";

const RESOURCE = "kcdc-gamemode";

const LOOK_EVERY_MS = 150;

/** How far from the eye a door or chest is read. The game's own prompt appears at about two metres. */
const REACH_M = 2.8;
/** How far from the eye another player can be talked to. The server allows a little more, for the time a press takes. */
const PLAYER_REACH_M = 3;

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

/** The door hint, at a door the server holds locked: the same key, and the game's own word for it. */
const OPEN_TEXT = "Abrir";
/** The controls the game's own door prompt can be on. */
const GAME_PROMPT_KEYS: readonly string[] = ["use", "primary_action"];

/** The door looked at is told to the server this often while it lasts (the server lets a look go after two seconds), and no faster than this when it changes. */
const GAZE_EVERY_MS = 700;
const GAZE_MIN_GAP_MS = 300;
/** What the server said it holds is believed this long after it last said so. */
const HELD_FRESH_MS = 2_500;
/** A held door whose game prompt is still up this long after the hold is let go for the look: the side without the keyhole. */
const RELEASE_AFTER_MS = 800;

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

/** The door last told to the server as looked at, and when. */
let gazeSent = "";
let gazeSentAt = 0;

/** The door the server says it holds locked for this look, since when, and when it last said so. */
let held = "";
let heldSince = 0;
let heldAt = 0;

/** Our own "Abrir" hint, up only at a door the server holds and the game says nothing at. */
let openHint = 0;
let openHintBroken = false;
let openHintShown = false;
/** The door let go for this look because the game's own "Abrir" stayed up under the lock, until the look leaves it; and the doors said in the log. */
let releasedDoor = "";
const releaseLogged = new Set<string>();

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

/**
 * Whether the game's own prompt is up on the interaction key right now, whoever's it is. A game that cannot say counts as one
 * with its prompt up: the hold is then let go, and the door works the old way, rather than shutting somebody in.
 */
function gamePromptUp(): boolean {
    try {
        return GAME_PROMPT_KEYS.some((key) => ActionHint.isKeyInUse(key));
    } catch {
        return true;
    }
}

/**
 * Our own "Abrir" at the door the server holds for this look: put up when the game's prompt is gone (the lock has reached its
 * door), taken down when the look ends. It is never put up beside the game's own, and not looked at again once it is up (its
 * own presence would be taken for the game's).
 */
function syncOpenHint(door: string): void {
    const now = Date.now();
    const holding = door !== "" && held === door && now - heldAt < HELD_FRESH_MS;
    if (!holding) {
        if (openHint !== 0) {
            ActionHint.remove(openHint);
            openHint = 0;
        }
        return;
    }
    if (openHint !== 0 || openHintBroken) {
        return;
    }
    if (gamePromptUp()) {
        if (now - heldSince > RELEASE_AFTER_MS) {
            // The lock has had its time and the game still offers its Abrir: let it go, so that this press is the game's own.
            releasedDoor = door;
            gazeSent = "";
            gazeSentAt = now;
            Events.emitServer(`${RESOURCE}:props.gaze`, JSON.stringify({ guid: "", released: door }));
            if (!releaseLogged.has(door)) {
                releaseLogged.add(door);
                console.log(`property labels: a porta ${door} está travada pelo servidor e o "Abrir" do jogo continua na tela (lado do ferrolho, ou porta que não tranca): a trava foi solta para este olhar`);
            }
        }
        return;
    }
    try {
        openHint = ActionHint.create({ key: TALK_KEY, text: OPEN_TEXT }, () => pressedUse());
        if (!openHintShown) {
            openHintShown = true;
            console.log(`property labels: a dica "${OPEN_TEXT}" própria subiu na porta ${door}, onde o jogo não oferecia nada`);
        }
    } catch (thrown: unknown) {
        // A build without that control: the E still brings the menu up, only without a word on the screen.
        openHintBroken = true;
        console.error(`property labels: the door hint could not be put up: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
}

/**
 * Tells the server which door of a property the player looks at ("" for none), and keeps our hint in step with what it holds.
 * A door let go for this look is not told again until the look has left it.
 */
function looked(seen: string): void {
    if (seen !== releasedDoor) {
        releasedDoor = "";
    }
    const door = releasedDoor !== "" ? "" : seen;
    const now = Date.now();
    const same = door === gazeSent;
    if (!(same && (door === "" || now - gazeSentAt < GAZE_EVERY_MS)) && (door === "" || now - gazeSentAt >= GAZE_MIN_GAP_MS)) {
        gazeSent = door;
        gazeSentAt = now;
        Events.emitServer(`${RESOURCE}:props.gaze`, JSON.stringify({ guid: door }));
    }
    syncOpenHint(door);
}

/** E was pressed: at a property in reach, the server is told, in case the game itself does not tell it. */
function pressedUse(): void {
    const now = Date.now();
    if (useTarget === "" || now - usedAt < USE_EVERY_MS || Hud.isInDialogue() || !LocalPlayer?.ready) {
        return;
    }
    usedAt = now;
    // Whether it was the game's own prompt on the screen (and not our "Abrir", which goes up only once the game's is gone).
    const prompt = openHint === 0 && gamePromptUp();
    Events.emitServer(`${RESOURCE}:props.use`, JSON.stringify({ guid: useTarget, prompt }));
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
    const ray = Camera.screenRay({ range: Math.max(REACH_M, PLAYER_REACH_M) });
    if (!ray) {
        return NOTHING;
    }
    const now = Date.now();
    // Something alive in front of a door: an E then is for it, not for the door.
    let blocked = false;
    for (const hit of World.raycastAll(ray.origin, ray.target, { mode: "anything", maxHits: 3 })) {
        const body = hit.player;
        if (body !== null && body !== undefined) {
            if (body.local) {
                continue;
            }
            // A body further off than talking range hides whatever is behind it.
            if (hit.distance > PLAYER_REACH_M) {
                return NOTHING;
            }
            const id = body.id;
            const entry = remembered(knownPlayers, askedPlayers, id, () => Events.emitServer(`${RESOURCE}:players.peek`, JSON.stringify({ id })), now);
            return entry !== undefined && entry.label !== "" ? { label: entry.label, player: id, use: "", door: false } : NOTHING;
        }
        const guid = hit.entityGuid;
        if (LIVING.test(hit.entityClass ?? "")) {
            blocked = true;
            continue;
        }
        if (hit.distance > REACH_M || guid === null) {
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

    // The server holds this door locked for the look it was told of, or lets it go ("").
    Events.on(`${RESOURCE}:props.gazed`, (payload) => {
        const guid = parse(payload)["guid"];
        if (typeof guid !== "string" || (guid !== "" && !/^[0-9a-f]{8,32}$/.test(guid))) {
            return;
        }
        if (guid !== held) {
            heldSince = Date.now();
        }
        held = guid;
        heldAt = Date.now();
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
                return;
            }
            if (screen === null && Date.now() >= reopenAt) {
                open();
                reopenAt = Date.now() + 2_000;
            }
            const look = lookUnderCrosshair();
            show(look.label);
            hint(look.player);
            // A person under the crosshair comes first.
            useTarget = look.player === 0 ? look.use : "";
            looked(look.player === 0 && look.door ? look.use : "");
        } catch (thrown: unknown) {
            // A frame the view could not be read (a level loading, a cutscene) is not worth more than a pause.
            reopenAt = Date.now() + 5_000;
            const message = thrown instanceof Error ? thrown.message : String(thrown);
            if (message !== lastError) {
                lastError = message;
                console.error(`property labels: ${message}`);
            }
        }
    }, LOOK_EVERY_MS);

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
            syncOpenHint("");
            screen?.close();
        }
    });
}
