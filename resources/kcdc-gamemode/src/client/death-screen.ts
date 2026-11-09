/**
 * The death screen, the client's half (server: `src/server/respawn.ts` and `death-verses.ts`; user, 2026-10-31: "ao morrer vamos add a câmera rodando em volta do corpo devagar, um texto, alguma
 * reza da bíblia, e embaixo um contador de 10 s até voltar à vida, exemplo 00:10, tipo uma tela customizada de morte").
 *
 * The server says the body has fallen (`death.begin`, with the verse in the player's language, its reference, the line over the counter and the seconds to wait) and, when the player
 * is up again, that it is over (`death.end`). Between the two:
 * - the camera is put round the body (`Camera.setShot`) and moved a step round it every `ORBIT.stepMs`, slowly, from where the view was when the body fell, nearer to it where a wall is in
 *   the way (`World.raycast`), looking down at the body from a man's height and a half;
 * - a page of ours (`ui/death.html`) covers the screen with a shade, the verse, its reference and the counter (00:10 down to 00:00);
 * - the HUD and the chat are put away, and given back at the end, only those this screen put away.
 * The same screen is the one of an execution (`execution.ts`, 2026-11-04): the body is alive and standing, so the server says `standing`, the camera is a man's height higher, the screen does not
 * end because the body is on its feet, and it ends with the time given.
 * Nothing here may leave the player with a camera that does not come back: the end comes from the server, from the body standing up (somebody raised it), or from the time given plus a
 * grace, whichever is first, and every one of them goes through `finish`.
 */

import { PHOTO_HIDDEN } from "./camera.js";
import { chatShown, showChat } from "./chat-state.js";
import { scaleView } from "./ui-scale.js";

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/death.html`;
const BEGIN = `${RESOURCE}:death.begin`;
const END = `${RESOURCE}:death.end`;

/** The camera, in metres and degrees. A turn of nine degrees a second takes a little under a quarter of a circle in ten seconds: slow enough to read by. */
export const ORBIT = {
    radius: 3.3,
    height: 1.9,
    /** The point looked at, above the body's feet: a body lying down. */
    aim: 0.45,
    /** A body on its feet (an execution): the camera is a little over its head, and looks at its chest. */
    standingHeight: 2.5,
    standingAim: 1.1,
    degreesPerSecond: 9,
    stepMs: 250,
    /** Each step glides on for a little more than the time to the next, so the motion has no pauses in it. */
    glideMs: 330,
    /** The first shot comes from wherever the view was. */
    firstGlideMs: 1_800,
    fov: 42,
    /** How far from a wall the camera keeps, how near the body it may come, and the height of the point the wall is looked for from. */
    wallGap: 0.35,
    minRadius: 1.4,
    headHeight: 1.0,
} as const;

/** After the wait the screen is given up on if the server has not said it is over. */
export const GRACE_MS = 6_000;
/** A body that stands up before this has not yet been told it fell: not taken as raised. */
export const ALIVE_AFTER_MS = 2_500;
/** A page that has not said it has drawn by then is given up on. */
export const PAGE_WAIT_MS = 8_000;
/** How long the page takes to fade before it is taken away. */
export const LEAVE_MS = 700;
export const MIN_SECONDS = 3;
export const MAX_SECONDS = 60;

export interface Point {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface Ask {
    readonly seconds: number;
    readonly text: string;
    readonly ref: string;
    readonly label: string;
    /** The body is alive and on its feet: an execution's screen, not a death's. */
    readonly standing: boolean;
}

/** "00:10": the time left on the counter, whole seconds, rounded up (the counter reads 00:00 only when the wait is over). */
export function countdownText(msLeft: number): string {
    const seconds = Math.max(0, Math.ceil((Number.isFinite(msLeft) ? msLeft : 0) / 1000));
    const two = (value: number): string => String(value).padStart(2, "0");
    return `${two(Math.floor(seconds / 60))}:${two(seconds % 60)}`;
}

/** The angle, in degrees, of a camera seen from the body: where the orbit starts, so that the first shot glides from where the view was. */
export function startAngle(center: Point, camera: Point | null): number {
    if (camera === null) {
        return 0;
    }
    const dx = camera.x - center.x;
    const dy = camera.y - center.y;
    return Math.hypot(dx, dy) < 0.05 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** The shot at `elapsedMs` into the wait: the camera on the circle round the body at `radius` (or less), looking at the body. */
export function orbitShot(center: Point, startDeg: number, elapsedMs: number, radius: number, standing = false): { position: Point; lookAt: Point } {
    const degrees = startDeg + (Math.max(0, elapsedMs) / 1000) * ORBIT.degreesPerSecond;
    const radians = (degrees * Math.PI) / 180;
    const reach = Math.max(ORBIT.minRadius, Math.min(ORBIT.radius, radius));
    return {
        position: { x: center.x + Math.cos(radians) * reach, y: center.y + Math.sin(radians) * reach, z: center.z + (standing ? ORBIT.standingHeight : ORBIT.height) },
        lookAt: { x: center.x, y: center.y, z: center.z + (standing ? ORBIT.standingAim : ORBIT.aim) },
    };
}

/** What the server sent, read and bounded: the page is shown what it can bear. */
export function askOf(payload: unknown): Ask | null {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return null;
        }
    }
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const fields = value as Record<string, unknown>;
    const seconds = typeof fields["seconds"] === "number" && Number.isFinite(fields["seconds"]) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(fields["seconds"]))) : 10;
    const text = (name: string, most: number): string => (typeof fields[name] === "string" ? (fields[name] as string).slice(0, most) : "");
    return { seconds, text: text("text", 400), ref: text("ref", 60), label: text("label", 60), standing: fields["standing"] === true };
}

export function installDeathScreen(): void {
    let view = -1;
    let ready = false;
    let active = false;
    let ask: Ask | null = null;
    let beganAt = 0;
    let center: Point = { x: 0, y: 0, z: 0 };
    let startDeg = 0;
    let steps = 0;
    let sceneOn = false;
    let hiddenByUs: string[] = [];
    let chatWasVisible = false;
    let stepper: ReturnType<typeof setInterval> | null = null;
    let ender: ReturnType<typeof setTimeout> | null = null;
    let pageTimer: ReturnType<typeof setTimeout> | null = null;

    const putAway = (): void => {
        hiddenByUs = [];
        for (const element of PHOTO_HIDDEN) {
            // Only what nothing else has hidden: giving it back must not undo somebody else's hide.
            try {
                if (Hud.isElementVisible(element) && Hud.setElementVisible(element, false)) {
                    hiddenByUs.push(element);
                }
            } catch {
                // An element this build does not know.
            }
        }
        chatWasVisible = chatShown();
        if (chatWasVisible) {
            showChat(false);
        }
    };

    const putBack = (): void => {
        for (const element of hiddenByUs) {
            try {
                Hud.setElementVisible(element, true);
            } catch {
                // Gone with the page.
            }
        }
        hiddenByUs = [];
        if (chatWasVisible) {
            showChat(true);
            chatWasVisible = false;
        }
    };

    const destroyPage = (): void => {
        if (view < 0) {
            return;
        }
        const dying = view;
        view = -1;
        ready = false;
        // The page that was asked to go may still be inside its own event: the browser goes on the next tick.
        setTimeout(() => {
            try {
                Web.destroyView(dying);
            } catch {
                // It is gone already.
            }
        }, 0);
    };

    /** How far from the body the camera can stand at this angle before a wall: the whole radius when nothing is in the way. */
    const room = (degrees: number): number => {
        const radians = (degrees * Math.PI) / 180;
        const from = new Vector3(center.x, center.y, center.z + ORBIT.headHeight);
        const to = new Vector3(center.x + Math.cos(radians) * (ORBIT.radius + ORBIT.wallGap), center.y + Math.sin(radians) * (ORBIT.radius + ORBIT.wallGap), center.z + (ask?.standing === true ? ORBIT.standingHeight : ORBIT.height));
        try {
            const hit = World.raycast(from, to, { mode: "cover" });
            return hit === null ? ORBIT.radius : Math.max(ORBIT.minRadius, Math.min(ORBIT.radius, hit.distance - ORBIT.wallGap));
        } catch {
            return ORBIT.radius;
        }
    };

    const finish = (why: string): void => {
        if (!active) {
            return;
        }
        active = false;
        if (stepper !== null) {
            clearInterval(stepper);
            stepper = null;
        }
        if (ender !== null) {
            clearTimeout(ender);
            ender = null;
        }
        if (pageTimer !== null) {
            clearTimeout(pageTimer);
            pageTimer = null;
        }
        if (sceneOn) {
            try {
                Camera.clearShot(800);
            } catch {
                // The view is the game's again by itself when the session ends.
            }
            sceneOn = false;
        }
        putBack();
        if (view >= 0) {
            const leaving = view;
            try {
                Web.emit(leaving, "death:leave", {});
            } catch {
                // Gone already.
            }
            setTimeout(() => {
                if (view === leaving) {
                    destroyPage();
                }
            }, LEAVE_MS);
        }
        console.log(`death-screen: terminou (${why}) depois de ${Math.round((Date.now() - beganAt) / 1000)} s e ${steps} passo(s) da câmera`);
    };

    const sendState = (): void => {
        if (view < 0 || !ready || ask === null) {
            return;
        }
        const left = Math.max(0, ask.seconds * 1000 - (Date.now() - beganAt));
        try {
            Web.emit(view, "death:state", { left, text: ask.text, ref: ask.ref, label: ask.label });
            Web.showView(view);
        } catch {
            // The page went away meanwhile.
        }
    };

    const createPage = (): void => {
        try {
            const size = Web.getScreenSize();
            view = Web.createView(PAGE, { width: size.width, height: size.height, x: 0, y: 0, zIndex: 85, visible: false, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            console.log(`death-screen: a página não abriu (${thrown instanceof Error ? thrown.message : String(thrown)}); fica só a câmera`);
            return;
        }
        const id = view;
        Web.on(view, "death:ready", () => {
            if (id !== view || ready) {
                return;
            }
            ready = true;
            if (pageTimer !== null) {
                clearTimeout(pageTimer);
                pageTimer = null;
            }
            scaleView(view);
            sendState();
        });
        pageTimer = setTimeout(() => {
            pageTimer = null;
            if (!ready && view >= 0) {
                console.log("death-screen: a página não disse que desenhou; fica só a câmera");
                destroyPage();
            }
        }, PAGE_WAIT_MS);
    };

    const step = (): void => {
        if (!active) {
            return;
        }
        const me = LocalPlayer;
        const elapsed = Date.now() - beganAt;
        // Somebody raised the body before the time was up (an administrator): the screen goes.
        if (ask?.standing !== true && me?.ready === true && me.alive && elapsed > ALIVE_AFTER_MS) {
            finish("de pé");
            return;
        }
        const degrees = startDeg + (elapsed / 1000) * ORBIT.degreesPerSecond;
        const shot = orbitShot(center, startDeg, elapsed, room(degrees), ask?.standing === true);
        try {
            const taken = Camera.setShot({
                position: new Vector3(shot.position.x, shot.position.y, shot.position.z),
                lookAt: new Vector3(shot.lookAt.x, shot.lookAt.y, shot.lookAt.z),
                duration: steps === 0 ? ORBIT.firstGlideMs : ORBIT.glideMs,
                fov: ORBIT.fov,
            });
            sceneOn = sceneOn || taken !== false;
            steps += 1;
        } catch {
            // A step the game would not take: the next one tries again.
        }
    };

    const begin = (payload: unknown): void => {
        const wanted = askOf(payload);
        if (wanted === null) {
            return;
        }
        if (active) {
            finish("outra morte");
            destroyPage();
        }
        ask = wanted;
        active = true;
        beganAt = Date.now();
        steps = 0;
        sceneOn = false;
        const me = LocalPlayer;
        if (me !== undefined && me !== null && me.ready) {
            const at = me.position;
            center = { x: at.x, y: at.y, z: at.z };
        }
        // The free camera holds the view, and a shot cannot start while it flies.
        if (typeof Events.emitLocal === "function") {
            void Events.emitLocal("camera.stopFree").catch(() => undefined);
        }
        let from: Point | null = null;
        try {
            const pose = Camera.getPose();
            from = pose === null ? null : { x: pose.position.x, y: pose.position.y, z: pose.position.z };
        } catch {
            from = null;
        }
        startDeg = startAngle(center, from);
        putAway();
        createPage();
        step();
        stepper = setInterval(step, ORBIT.stepMs);
        ender = setTimeout(() => finish("tempo"), wanted.seconds * 1000 + GRACE_MS);
    };

    Events.on(BEGIN, (payload) => begin(payload));
    Events.on(END, () => finish("servidor"));
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            finish("parada");
            destroyPage();
        }
    });
}
