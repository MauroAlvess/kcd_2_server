/**
 * The client half of the character creator (`src/server/creator.ts`): a page of this resource over the screen, and the
 * player's own body filmed from the front while they choose.
 *
 * The server asks for it (`creator.begin`) the moment a newcomer spawns, which is before the game has finished loading
 * on this machine, so it waits until the body is ready. Then the camera is put in front of the body (`Camera.setShot`),
 * placed so the figure stands left of centre and leaves the right of the screen to the page, with a warm light on it; the
 * HUD and the chat are put away; and the page is created hidden, shown when it says it has drawn, and given the keyboard.
 * What the page picks goes to the server, which puts it on the real body (a camera shows what the body wears, so the
 * preview is the body); dragging on the page turns the camera round the figure and the wheel moves it near or far.
 *
 * Nothing here may leave the player stuck with a pointer and a frozen screen: the page has an exit, a page that does not
 * come up is given up on after a few seconds, and every way out (accepted, left, the server's word, death, a stop) goes
 * through `finish`, which gives back the camera, the HUD and the keyboard. A page that cannot open at all reports it, and
 * the server asks again and then falls back to the game's own character stage.
 *
 * A newcomer has no exit on purpose (the user, 2026-10-15: on the first join the player is obliged to create the character
 * and give it a name): the page shows none and a leave it should send is dropped here; the body that dies ends it, because
 * the next spawn opens it again; and on a horse the creator waits until the player has got down.
 */

import { onLarge } from "./big-events.js";
import { scaleView } from "./ui-scale.js";
import { PHOTO_HIDDEN } from "./camera.js";
import { chatShown, showChat } from "./chat-state.js";

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/creator.html`;

/** Server to client. */
const BEGIN = `${RESOURCE}:creator.begin`;
const NAME = `${RESOURCE}:creator.name`;
const REFUSED = `${RESOURCE}:creator.refused`;
const DONE = `${RESOURCE}:creator.done`;
const END = `${RESOURCE}:creator.end`;
const TUNE = `${RESOURCE}:creator.tune`;

/** Client to server. */
const PREVIEW = `${RESOURCE}:creator.preview`;
const CHECK = `${RESOURCE}:creator.check`;
const ACCEPT = `${RESOURCE}:creator.accept`;
const CANCEL = `${RESOURCE}:creator.cancel`;
const FAILED = `${RESOURCE}:creator.failed`;
const DRESS = `${RESOURCE}:creator.dress`;

/** How long the body must have been ready before the scene goes up: the game dresses its default Henry at the end of loading. */
export const SETTLE_MS = 6_000;
export const GIVE_UP_MS = 90_000;
/** A page that has not said it has drawn by then is given up on. */
export const PAGE_WAIT_MS = 15_000;
export const POLL_MS = 500;

/** The camera, in metres and degrees. */
export const FOV = 36;
export const DISTANCE = { start: 3.5, min: 1.5, max: 5.6 } as const;
/** How far left of the middle of the screen the figure stands, as a fraction of half its width. */
export const FIGURE_AT = 0.4;
/** The body is filmed from its waist at full length, and up to its face when the camera is near. */
const AIM = { far: 0.95, near: 1.5 } as const;
/** The warm light on the figure. */
export const LIGHT = 2.2;

/** What an administrator may change without a deploy (`/creator camera`): added to, or put in place of, the numbers above. */
export interface Framing {
    readonly distance: number;
    readonly figure: number;
    readonly fov: number;
    /** Metres added to where the body is aimed at. */
    readonly aim: number;
    readonly light: number;
}

export const DEFAULT_FRAMING: Framing = { distance: DISTANCE.start, figure: FIGURE_AT, fov: FOV, aim: 0, light: LIGHT };
/** Where the player is looked at from, when the front is blocked: the nearest of these turns that is free. */
export const TURNS = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180] as const;
/** Degrees the camera turns round the figure for each pixel the page is dragged, and metres per unit of the wheel. */
export const DEGREES_PER_PIXEL = 0.4;
export const METRES_PER_WHEEL = 0.0025;
/** Never closer to a wall than this, so the camera is not inside it. */
const WALL_GAP = 0.3;
const HEAD_HEIGHT = 1.5;

interface Plain {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, value));
}

function objectOf(payload: unknown): Record<string, unknown> {
    return typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function textOf(value: unknown, max: number): string | null {
    return typeof value === "string" && value.length <= max ? value : null;
}

/** The direction the body faces on the ground, from where the player looks, or from the body's own turn when they look straight up or down. */
export function frontOf(look: Plain, rotation: { readonly w: number; readonly x: number; readonly y: number; readonly z: number }): { x: number; y: number } {
    const length = Math.hypot(look.x, look.y);
    if (length > 0.05) {
        return { x: look.x / length, y: look.y / length };
    }
    // The +Y axis of the body, turned by its rotation (Z up).
    const x = -2 * rotation.w * rotation.z + 2 * rotation.x * rotation.y;
    const y = 1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z);
    const turn = Math.hypot(x, y);
    return turn > 0.01 ? { x: x / turn, y: y / turn } : { x: 0, y: 1 };
}

/** Where the camera stands and what it looks at, for a body at `foot` facing `front`, the camera `turn` degrees round it and `distance` away. */
export function shotFor(foot: Plain, front: { x: number; y: number }, turn: number, distance: number, aspect: number, framing: Framing = DEFAULT_FRAMING): { position: Plain; lookAt: Plain } {
    const radians = (turn * Math.PI) / 180;
    const dir = { x: front.x * Math.cos(radians) - front.y * Math.sin(radians), y: front.x * Math.sin(radians) + front.y * Math.cos(radians) };
    const nearness = clamp((framing.distance - distance) / (framing.distance - DISTANCE.min), 0, 1);
    const aimZ = AIM.far + (AIM.near - AIM.far) * nearness + framing.aim;
    const horizontalHalf = Math.tan((framing.fov * Math.PI) / 360) * aspect;
    // The camera looks back at the figure, so its right is the figure's left-front: shift the aim that way and the figure
    // stands left of the middle of the screen.
    const shift = framing.figure * distance * horizontalHalf;
    return {
        position: { x: foot.x + dir.x * distance, y: foot.y + dir.y * distance, z: foot.z + aimZ + 0.12 },
        lookAt: { x: foot.x - dir.y * shift, y: foot.y + dir.x * shift, z: foot.z + aimZ },
    };
}

export function installCreatorPage(): void {
    const started = Date.now();
    let active = false;
    let begin: unknown = null;
    /** The clothes a newcomer may choose (`creator.clothes`), kept for a page that comes up after them. */
    let clothes: unknown = null;
    let view = -1;
    let pageReady = false;
    let waiting: ReturnType<typeof setInterval> | null = null;
    let readySince = 0;
    let foot: Plain = { x: 0, y: 0, z: 0 };
    let front = { x: 0, y: 1 };
    let turn = 0;
    let distance: number = DISTANCE.start;
    let framing: Framing = DEFAULT_FRAMING;
    let sceneOn = false;
    let light: Light | null = null;
    let hiddenByUs: string[] = [];
    let chatWasVisible = false;
    let watch: ReturnType<typeof setInterval> | null = null;
    let pageTimer: ReturnType<typeof setTimeout> | null = null;
    let toldToDismount = false;

    /** A newcomer, who cannot leave the creator before making a character. */
    function mandatory(): boolean {
        return objectOf(begin)["mandatory"] === true;
    }

    function aspect(): number {
        const { width, height } = Web.getScreenSize();
        return height > 0 ? width / height : 16 / 9;
    }

    /** How far the camera can stand from the head, in this direction, before a wall: the whole distance asked for when nothing is in the way. */
    function freeDistance(at: number, wanted: number): number {
        const radians = (at * Math.PI) / 180;
        const dir = { x: front.x * Math.cos(radians) - front.y * Math.sin(radians), y: front.x * Math.sin(radians) + front.y * Math.cos(radians) };
        const head = new Vector3(foot.x, foot.y, foot.z + HEAD_HEIGHT);
        const target = new Vector3(foot.x + dir.x * (wanted + WALL_GAP), foot.y + dir.y * (wanted + WALL_GAP), foot.z + HEAD_HEIGHT);
        const hit = World.raycast(head, target, { mode: "cover" });
        return hit === null ? wanted : Math.max(0.9, Math.min(wanted, hit.distance - WALL_GAP));
    }

    /** The camera is put (or moved) there. False when the game would not take the shot (the free camera is flying, say). */
    function applyShot(duration: number): boolean {
        const room = freeDistance(turn, distance);
        const { position, lookAt } = shotFor(foot, front, turn, room, aspect(), framing);
        const taken = Camera.setShot({ position: new Vector3(position.x, position.y, position.z), lookAt: new Vector3(lookAt.x, lookAt.y, lookAt.z), duration, fov: framing.fov });
        if (light !== null && light.valid) {
            // Above the camera and to its side, so the face is lit and the figure is not flat.
            light.position = new Vector3(position.x - front.y * 0.5, position.y + front.x * 0.5, position.z + 0.7);
            light.intensity = framing.light;
        }
        return taken !== false;
    }

    function putAway(): void {
        hiddenByUs = [];
        for (const element of PHOTO_HIDDEN) {
            // Only what nothing else has hidden: showing it again afterwards must not undo somebody else's hide.
            if (Hud.isElementVisible(element) && Hud.setElementVisible(element, false)) {
                hiddenByUs.push(element);
            }
        }
        chatWasVisible = chatShown();
        if (chatWasVisible) {
            showChat(false);
        }
    }

    function putBack(): void {
        for (const element of hiddenByUs) {
            Hud.setElementVisible(element, true);
        }
        hiddenByUs = [];
        if (chatWasVisible) {
            showChat(true);
            chatWasVisible = false;
        }
    }

    function startScene(me: Player): boolean {
        // The free camera holds the view, and a shot cannot start while it flies.
        if (typeof Events.emitLocal === "function") {
            void Events.emitLocal("camera.stopFree").catch(() => undefined);
        }
        foot = { x: me.position.x, y: me.position.y, z: me.position.z };
        const q = me.rotation as Quaternion;
        front = frontOf(me.lookDirection, { w: q.w, x: q.x, y: q.y, z: q.z });
        distance = framing.distance;
        // The nearest turn from the front with room for the camera; with none, the one with the most.
        turn = 0;
        let best = -1;
        for (const candidate of TURNS) {
            const room = freeDistance(candidate, DISTANCE.start);
            if (room > best + 1e-6) {
                best = room;
                turn = candidate;
            }
            if (room >= DISTANCE.start - 1e-6) {
                turn = candidate;
                break;
            }
        }
        putAway();
        try {
            light = Light.spawn(new Vector3(foot.x, foot.y, foot.z + 2), { color: new Vector3(1, 0.86, 0.62), intensity: framing.light, radius: 7, castShadows: false });
        } catch {
            light = null;
        }
        sceneOn = applyShot(900);
        return sceneOn;
    }

    function stopScene(): void {
        if (sceneOn) {
            Camera.clearShot(600);
            sceneOn = false;
        }
        if (light !== null) {
            light.destroy();
            light = null;
        }
        putBack();
    }

    function destroyView(): void {
        if (view < 0) {
            return;
        }
        const dying = view;
        view = -1;
        pageReady = false;
        Web.focusView(dying, false);
        Web.hideView(dying);
        // The page that asked to close is still inside its own event: the browser goes on the next tick.
        setTimeout(() => Web.destroyView(dying), 0);
    }

    function finish(): void {
        active = false;
        begin = null;
        clothes = null;
        if (waiting !== null) {
            clearInterval(waiting);
            waiting = null;
        }
        if (watch !== null) {
            clearInterval(watch);
            watch = null;
        }
        if (pageTimer !== null) {
            clearTimeout(pageTimer);
            pageTimer = null;
        }
        destroyView();
        stopScene();
    }

    /** The page could not come up: everything given back, and the server told, which falls back to the game's own stage. */
    function fail(reason: string): void {
        console.log(`creator page: ${reason}`);
        const was = active;
        finish();
        if (was) {
            Events.emitServer(FAILED, JSON.stringify({ reason }));
        }
    }

    function createPage(): void {
        const { width, height } = Web.getScreenSize();
        try {
            view = Web.createView(PAGE, { width, height, x: 0, y: 0, zIndex: 100, visible: false, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            fail(`createView: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
            return;
        }
        pageReady = false;
        // A page closed while it loaded can still answer before its browser is gone; only this one counts.
        const id = view;
        pageTimer = setTimeout(() => {
            pageTimer = null;
            if (id === view && !pageReady) {
                fail("a página não disse que estava pronta");
            }
        }, PAGE_WAIT_MS);

        Web.on(view, "creator:ready", () => {
            if (id !== view || !active) {
                return;
            }
            pageReady = true;
            scaleView(view);
            if (pageTimer !== null) {
                clearTimeout(pageTimer);
                pageTimer = null;
            }
            Web.emit(view, "creator:begin", { ...objectOf(begin), aspect: aspect() });
            if (clothes !== null) {
                Web.emit(view, "creator:clothes", clothes);
            }
            Web.showView(view);
            Web.focusView(view, true);
        });

        Web.on(view, "creator:dress", (payload) => {
            const fields = objectOf(payload);
            const gender = fields["gender"];
            const picks: Record<string, number> = {};
            for (const part of ["top", "legs", "feet"]) {
                const value = fields[part];
                if (typeof value === "number" && Number.isInteger(value) && value >= -1 && value < 64) {
                    picks[part] = value;
                }
            }
            if (id === view && (gender === "male" || gender === "female")) {
                Events.emitServer(DRESS, JSON.stringify({ gender, ...picks }));
            }
        });

        Web.on(view, "creator:preview", (payload) => {
            const look = objectOf(payload)["look"];
            if (id === view && typeof look === "object" && look !== null) {
                Events.emitServer(PREVIEW, JSON.stringify({ look }));
            }
        });

        Web.on(view, "creator:check", (payload) => {
            const fields = objectOf(payload);
            const name = textOf(fields["name"], 40);
            const epithet = textOf(fields["epithet"], 24);
            if (id === view && name !== null && epithet !== null) {
                Events.emitServer(CHECK, JSON.stringify({ name, epithet }));
            }
        });

        Web.on(view, "creator:accept", (payload) => {
            const fields = objectOf(payload);
            const look = fields["look"];
            const name = textOf(fields["name"], 40);
            const epithet = textOf(fields["epithet"], 24);
            if (id === view && typeof look === "object" && look !== null && name !== null && epithet !== null) {
                const sent: Record<string, unknown> = { look, name, epithet };
                // The age and the height (2026-11-02): whole numbers, which the server checks against the limits. Left out here at first, and nobody could save.
                for (const key of ["age", "height"]) {
                    const value = fields[key];
                    if (typeof value === "number" && Number.isInteger(value) && value > 0 && value < 1000) {
                        sent[key] = value;
                    }
                }
                // The pieces a character that exists marked in the "Roupas" tab, to receive once each (the server checks them against the catalog).
                const clothes = fields["clothes"];
                if (typeof clothes === "object" && clothes !== null) {
                    const picked = clothes as Record<string, unknown>;
                    const kept: Record<string, unknown> = {};
                    if (picked["gender"] === "male" || picked["gender"] === "female") {
                        kept["gender"] = picked["gender"];
                        for (const part of ["top", "legs", "feet"]) {
                            const value = picked[part];
                            if (typeof value === "number" && Number.isInteger(value) && value >= -1 && value < 64) {
                                kept[part] = value;
                            }
                        }
                        sent["clothes"] = kept;
                    }
                }
                Events.emitServer(ACCEPT, JSON.stringify(sent));
            }
        });

        Web.on(view, "creator:cancel", () => {
            // The page of a newcomer has no way to ask this; a page that did would not be let out.
            if (id === view && !mandatory()) {
                Events.emitServer(CANCEL);
                finish();
            }
        });

        Web.on(view, "creator:orbit", (payload) => {
            const dx = objectOf(payload)["dx"];
            if (id === view && sceneOn && typeof dx === "number" && Number.isFinite(dx)) {
                turn = ((((turn + clamp(dx, -400, 400) * DEGREES_PER_PIXEL) % 360) + 540) % 360) - 180;
                applyShot(90);
            }
        });

        Web.on(view, "creator:zoom", (payload) => {
            const body = objectOf(payload);
            const dy = body["dy"];
            if (id === view && sceneOn && typeof dy === "number" && Number.isFinite(dy)) {
                distance = clamp(distance + clamp(dy, -400, 400) * METRES_PER_WHEEL, DISTANCE.min, DISTANCE.max);
                applyShot(120);
            } else if (id === view && sceneOn && (body["face"] === 1 || body["face"] === 0)) {
                // W goes up to the face, S comes back to where the camera began (user, 2026-10-18).
                distance = body["face"] === 1 ? DISTANCE.min : framing.distance;
                applyShot(350);
            }
        });
    }

    /** The body is ready and has been for a while: the scene goes up and the page is made. */
    function go(me: Player): void {
        if (!startScene(me)) {
            fail("o jogo não aceitou a câmera do criador");
            return;
        }
        createPage();
    }

    function waitForBody(): void {
        if (waiting !== null) {
            clearInterval(waiting);
        }
        readySince = 0;
        const waitingSince = Date.now();
        waiting = setInterval(() => {
            if (!active) {
                return;
            }
            const now = Date.now();
            if (now - waitingSince > GIVE_UP_MS) {
                fail("o corpo do jogador não ficou pronto");
                return;
            }
            const me = LocalPlayer;
            if (!me || !me.ready || !me.alive || now - started < SETTLE_MS) {
                readySince = 0;
                return;
            }
            if (me.mounted) {
                // A creator filmed round a rider is no creator. A newcomer waits for them to get down; anybody else is told, and leaves.
                if (!toldToDismount) {
                    toldToDismount = true;
                    Hud.showNotification("Desça do cavalo para criar o personagem.");
                }
                readySince = 0;
                if (!mandatory()) {
                    Events.emitServer(CANCEL, JSON.stringify({ forced: true }));
                    finish();
                }
                return;
            }
            toldToDismount = false;
            if (readySince === 0) {
                readySince = now;
            }
            if (now - readySince < SETTLE_MS) {
                return;
            }
            if (waiting !== null) {
                clearInterval(waiting);
                waiting = null;
            }
            go(me);
        }, POLL_MS);
    }

    Events.on(BEGIN, (payload) => {
        let value: unknown = payload;
        if (typeof value === "string") {
            try {
                value = JSON.parse(value) as unknown;
            } catch {
                return;
            }
        }
        begin = value;
        if (active) {
            // Asked again while it is open: the page starts over with what the server sent.
            if (view >= 0 && pageReady) {
                Web.emit(view, "creator:begin", { ...objectOf(begin), aspect: aspect() });
            }
            return;
        }
        active = true;
        toldToDismount = false;
        waitForBody();
        // Whatever ends it from here on: a body that dies, or goes away, under the page.
        watch = setInterval(() => {
            const me = LocalPlayer;
            if (active && sceneOn && (!me || !me.alive)) {
                // Not the player's choice: the server ends the session even for a newcomer, whose next spawn opens it again.
                Events.emitServer(CANCEL, JSON.stringify({ forced: true }));
                finish();
            }
        }, 1_000);
    });

    // A newcomer's clothes to choose from, with their icons: they come after `creator.begin`, maybe before the page is up.
    onLarge("creator.clothes", (payload) => {
        try {
            clothes = typeof payload === "string" ? (JSON.parse(payload) as unknown) : payload;
        } catch {
            clothes = null;
        }
        if (view >= 0 && pageReady && clothes !== null) {
            Web.emit(view, "creator:clothes", clothes);
        }
    });

    const toPage = (channel: string) => (payload: unknown) => {
        if (view >= 0 && pageReady) {
            let value: unknown = payload;
            if (typeof value === "string") {
                try {
                    value = JSON.parse(value) as unknown;
                } catch {
                    return;
                }
            }
            Web.emit(view, channel, value);
        }
    };
    Events.on(NAME, toPage("creator:name"));
    Events.on(REFUSED, toPage("creator:refused"));

    Events.on(DONE, (payload) => {
        let full = "";
        try {
            const value = typeof payload === "string" ? (JSON.parse(payload) as unknown) : payload;
            full = String(objectOf(value)["full"] ?? "");
        } catch {
            full = "";
        }
        finish();
        if (full !== "") {
            Hud.showNotification(`Bem-vindo, ${full}.`);
        }
    });

    Events.on(END, () => finish());

    // An administrator's numbers for the framing (`/creator camera`): the ones given replace the ones in use, an empty message
    // goes back to the defaults, and the numbers that result are written on the screen so they can be told to whoever sets them.
    Events.on(TUNE, (payload) => {
        let value: unknown = payload;
        if (typeof value === "string") {
            try {
                value = JSON.parse(value) as unknown;
            } catch {
                return;
            }
        }
        const fields = objectOf(value);
        const base = Object.keys(fields).length === 0 ? DEFAULT_FRAMING : framing;
        const number = (key: string, fallback: number, low: number, high: number): number => {
            const raw = fields[key];
            return typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, low, high) : fallback;
        };
        framing = {
            distance: number("distance", base.distance, DISTANCE.min, 6),
            figure: number("figure", base.figure, 0, 0.9),
            fov: number("fov", base.fov, 20, 70),
            aim: number("aim", base.aim, -0.6, 0.6),
            light: number("light", base.light, 0, 20),
        };
        Hud.showNotification(`Câmera do criador: distância ${framing.distance}, figura ${framing.figure}, fov ${framing.fov}, altura ${framing.aim}, luz ${framing.light}.`);
        if (sceneOn) {
            distance = framing.distance;
            applyShot(300);
        }
    });

    Events.on("browserLoadingFailed", (event) => {
        if (active && view >= 0 && event.isMainFrame && event.url.includes("creator.html")) {
            fail(`a página não carregou (${event.description})`);
        }
    });

    Events.on("resourceStop", (name) => {
        if (name === RESOURCE && active) {
            finish();
        }
    });
}
