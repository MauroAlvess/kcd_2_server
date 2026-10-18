/**
 * The player's camera, as they choose it in the "Opções" section of the panel (and as `/camera` sets it):
 *
 * - Third person: `Camera.setThirdPerson`, at one of three distances. The choice is kept by the server by Steam id
 *   (`src/server/options.ts`), since the client has no storage of its own: it is asked for once the player is in the
 *   world and applied then. A change is applied at once and sent to be kept.
 * - The free camera, for recording and taking pictures: `NoClip` in `camera` mode, so the body stays where it is and
 *   only the view flies, on the keys of the game's own photo mode. It stays within FREE_RADIUS_M of the body: a camera
 *   that could fly anywhere, and through walls, would scout bandit camps and look into locked houses. The HUD and the
 *   chat are hidden while it flies, so the picture is clean. Esc ends it, and so do the panel's keys, death and the
 *   level going away -- and, whatever else happens, FREE_MAX_MS after it started.
 *
 *   The camera is flown by a page of ours (`ui/freecam.html`), not by the framework's own keyboard driver. That driver
 *   (`input: true`) takes every key press, Esc and F2 included: neither `Key.bind` nor `Key.isDown` hears them, and a
 *   player was stuck in a flight until its time limit (2026-10-14, and again 2026-10-15 with a `Key.isDown` poll). A
 *   focused page does hear them, so the page reads the keys (W A S D, the arrows, Space, Ctrl, Shift, Alt) and the mouse
 *   dragged, and the flight's own tick (`NoClip.move`) does the flying; Esc, F2 and F3 on the page end it, and so does
 *   its "Sair da câmera" button. The first round of the page read `event.code`, which the game's browser leaves empty:
 *   no key did anything (2026-10-15 night); it reads `keyCode` and `key` now. Should the page still hear nothing in
 *   PAGE_DEAF_MS -- no key, no click -- the keyboard goes back to the game and the camera is flown by the game's own keys
 *   (`Key.isDown`, which a flight with no driver of its own does not take): W A S D, the arrows to turn, Esc and F2 out.
 *   There is no flight without the page: if it cannot open, the camera does not start, so nobody is shut in. The time
 *   limit stays.
 *
 * There is one view to draw through: the free camera cannot start while the third-person camera holds it, so that is
 * put down first and taken up again when the flight ends.
 *
 * The panel (`status.ts`) talks to this through the resource's own local events: `camera.choose`, `camera.free`,
 * `camera.stopFree` and `camera.ask` in, `camera.state` out.
 */

const RESOURCE = "kcdc-gamemode";

/** Sent by `/camera` (`src/server/commands/camera.ts`). */
const CAMERA_EVENT = `${RESOURCE}:camera.thirdPerson`;

export type CameraView = "perto" | "normal" | "longe";

/** Where the third-person camera sits, in metres: back from the body, the height it orbits at, and to the right. */
export const VIEWS: Readonly<Record<CameraView, { readonly distance: number; readonly height: number; readonly shoulder: number }>> = {
    perto: { distance: 2.2, height: 1.65, shoulder: 0.5 },
    normal: { distance: 3.2, height: 1.7, shoulder: 0.45 },
    longe: { distance: 4.8, height: 1.85, shoulder: 0.35 },
};

/** How far from the player's eyes the free camera may go. */
export const FREE_RADIUS_M = 25;

/** Metres a second at rest; the game's "fast movement" key boosts it. Slow enough to frame a picture. */
const FREE_SPEED = 4;

/** The eyes, above the feet: the middle of the sphere the free camera stays in, and where it starts. */
const EYE_HEIGHT_M = 1.6;

const FREE_TICK_MS = 100;

/** The page that flies it: it is what hears Esc, F2 and F3. */
const FREECAM_PAGE = `fw://resources/${RESOURCE}/ui/freecam.html`;

/** The page must say it has drawn within this long, or the flight is given up on. */
export const PAGE_WAIT_MS = 5_000;

/** The flying is done on this beat, and the mouse turns the camera by this many degrees for each pixel it is dragged. */
export const DRIVER_TICK_MS = 16;
export const LOOK_DEGREES_PER_PIXEL = 0.12;

/** The arrows turn the camera this many degrees a second. */
export const TURN_DEGREES_PER_SECOND = 70;

/** A page that has heard nothing at all this long after it drew gives the keyboard back, and the game's keys fly the camera. */
export const PAGE_DEAF_MS = 6_000;

/** The game's keys, by `Key.isDown` name, for a flight the page could not take: each axis and which way. */
const GAME_KEYS: readonly (readonly [key: string, axis: "forward" | "strafe" | "lift" | "yaw" | "pitch", sign: number])[] = [
    ["w", "forward", 1], ["s", "forward", -1], ["d", "strafe", 1], ["a", "strafe", -1],
    ["space", "lift", 1], ["e", "lift", 1], ["ctrl", "lift", -1], ["c", "lift", -1], ["q", "lift", -1],
    ["left", "yaw", 1], ["right", "yaw", -1], ["up", "pitch", 1], ["down", "pitch", -1],
];

/** The keys that end a flight if the framework ever lets the mod hear them: Esc, and the panel's two (`status.ts`). The page's own are the ones that count. */
export const FREE_EXIT_KEYS = ["escape", "f2", "f3"];

/** No flight lasts longer than this, and the player is told shortly before it ends. */
export const FREE_MAX_MS = 5 * 60_000;
const FREE_WARN_BEFORE_MS = 30_000;

/** Everything of the HUD that would be in a picture, hidden while the free camera flies. */
export const PHOTO_HIDDEN = ["Compass", "Stats", "QAMWeapon", "QAMFood", "Hints", "Buffs", "GameLog", "InfoText", "Subtitles", "Crime", "Wanted", "Trespassing", "Bubbles"];

let thirdPerson = false;
let view: CameraView = "normal";
/** A distance `/camera third <metres>` asked for, kept until another view is chosen. */
let customDistance: number | null = null;
/** Choices sent to the server and not answered yet: an older answer must not undo a newer choice. */
let pending = 0;

let flying = false;
let flyingSince = 0;
/** The page that flies it: its view, whether it has drawn, what it reports is held, and the pixels dragged not yet turned. */
let page = -1;
let pageReady = false;
let pageTimer: ReturnType<typeof setTimeout> | null = null;
let driver: ReturnType<typeof setInterval> | null = null;
let lastDrive = 0;
const held = { forward: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0, boost: false, crawl: false };
const dragged = { x: 0, y: 0 };
/** Whether the page has heard anything (a key, a click), and whether the game's keys fly the camera instead of it. */
let pageHeard = false;
let byGameKeys = false;
/** Whether this flight has already said that NoClip would not move. */
let moveRefusedSaid = false;
let deafTimer: ReturnType<typeof setTimeout> | null = null;
let warned = false;
let freeTimer: ReturnType<typeof setInterval> | null = null;
let hiddenByUs: string[] = [];
let chatWasVisible = false;

function isView(value: unknown): value is CameraView {
    return value === "perto" || value === "normal" || value === "longe";
}

/** The framework usually hands over a parsed object; a string is parsed here. */
function parse(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function flagOf(value: unknown): boolean | undefined {
    return value === true || value === 1 ? true : value === false || value === 0 ? false : undefined;
}

export function cameraState(): { thirdPerson: boolean; view: CameraView; flying: boolean } {
    return { thirdPerson, view, flying };
}

function announce(): void {
    void Events.emitLocal("camera.state", cameraState()).catch(() => undefined);
}

/** Puts the third-person camera up, moves it, or hands the view back to the game, as chosen. Waits out a flight. */
function applyThirdPerson(): void {
    if (flying) {
        return;
    }
    if (!thirdPerson) {
        if (Camera.isThirdPerson()) {
            Camera.setThirdPerson(null);
        }
        return;
    }
    const shape = VIEWS[view];
    Camera.setThirdPerson(customDistance === null ? { ...shape } : { ...shape, distance: customDistance });
}

/** A choice from the panel or `/camera`: applied now, then kept by the server. Fields left out stay as they were. */
export function chooseCamera(change: Record<string, unknown>): void {
    const third = flagOf(change["thirdPerson"]);
    const nextView = isView(change["view"]) ? change["view"] : view;
    if (nextView !== view) {
        customDistance = null;
    }
    thirdPerson = third ?? thirdPerson;
    view = nextView;
    applyThirdPerson();
    pending += 1;
    Events.emitServer(`${RESOURCE}:options.set`, JSON.stringify({ thirdPerson, view }));
    announce();
}

/** What the server keeps: at join, and as the answer to each choice. Only the answer to the newest choice is applied. */
function received(payload: unknown): void {
    if (pending > 0) {
        pending -= 1;
        if (pending > 0) {
            return;
        }
    }
    const fields = parse(payload);
    const third = flagOf(fields["thirdPerson"]);
    if (third === undefined || !isView(fields["view"])) {
        return;
    }
    if (fields["view"] !== view) {
        customDistance = null;
    }
    thirdPerson = third;
    view = fields["view"];
    applyThirdPerson();
    announce();
}

function hideForPicture(): void {
    hiddenByUs = [];
    for (const element of PHOTO_HIDDEN) {
        // Only what nothing else has hidden: showing it again afterwards must not undo somebody else's hide.
        if (Hud.isElementVisible(element) && Hud.setElementVisible(element, false)) {
            hiddenByUs.push(element);
        }
    }
    chatWasVisible = Chat.isUIVisible();
    if (chatWasVisible) {
        Chat.setUIVisible(false);
    }
}

function showAfterPicture(): void {
    for (const element of hiddenByUs) {
        Hud.setElementVisible(element, true);
    }
    hiddenByUs = [];
    if (chatWasVisible) {
        Chat.setUIVisible(true);
        chatWasVisible = false;
    }
}

/** Keeps the free camera within FREE_RADIUS_M of the eyes, and ends it if the player has died. */
function freeTick(): void {
    if (!flying) {
        return;
    }
    if (!NoClip.isActive()) {
        flightEnded();
        return;
    }
    const me = LocalPlayer;
    if (me === null || !me.alive) {
        stopFreeCamera();
        return;
    }
    const pressed = FREE_EXIT_KEYS.find((key) => Key.isDown(key));
    if (pressed !== undefined) {
        console.log(`free camera: ended by ${pressed}`);
        stopFreeCamera();
        return;
    }
    const flown = Date.now() - flyingSince;
    if (flown >= FREE_MAX_MS) {
        console.log("free camera: ended by the time limit");
        stopFreeCamera();
        Hud.showNotification("A câmera livre voltou sozinha (limite de 5 minutos).");
        return;
    }
    if (!warned && flown >= FREE_MAX_MS - FREE_WARN_BEFORE_MS) {
        warned = true;
        Hud.showNotification("A câmera livre volta sozinha em 30 segundos.");
    }
    const at = NoClip.getPosition();
    if (at === null) {
        return;
    }
    const eyes = { x: me.position.x, y: me.position.y, z: me.position.z + EYE_HEIGHT_M };
    const dx = at.x - eyes.x;
    const dy = at.y - eyes.y;
    const dz = at.z - eyes.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > FREE_RADIUS_M) {
        const scale = FREE_RADIUS_M / distance;
        NoClip.setPosition(new Vector3(eyes.x + dx * scale, eyes.y + dy * scale, eyes.z + dz * scale));
    }
}

export function startFreeCamera(): void {
    if (flying || NoClip.isActive()) {
        return;
    }
    const me = LocalPlayer;
    if (me === null || !me.ready || !me.alive) {
        Hud.showNotification("A câmera livre só funciona com o personagem vivo e no mundo.");
        return;
    }
    if (Camera.isThirdPerson()) {
        Camera.setThirdPerson(null);
    }
    const result = NoClip.enable({ mode: "camera", input: false, speed: FREE_SPEED });
    if (result !== "enabled") {
        applyThirdPerson();
        Hud.showNotification(result === "cameraBusy" ? "A câmera está com o editor de mapa; feche-o primeiro." : "Não deu para ligar a câmera livre agora.");
        console.log(`free camera refused: ${result}`);
        return;
    }
    flying = true;
    flyingSince = Date.now();
    warned = false;
    hideForPicture();
    freeTimer = setInterval(freeTick, FREE_TICK_MS);
    announce();
    if (!openDriverPage()) {
        stopFreeCamera();
        Hud.showNotification("Não deu para ligar a câmera livre agora: a página que a comanda não abriu.");
        return;
    }
    Hud.showNotification("Câmera livre: W A S D voam, setas ou o mouse arrastado viram, Espaço sobe, Ctrl desce, Shift acelera. Esc, F2 ou o botão Sair voltam; ela volta sozinha em 5 minutos.");
}

/** What the page says: a number on an axis is only ever -1, 0 or 1. */
function axisOf(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, Math.round(value))) : 0;
}

function pixelsOf(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(-2_000, Math.min(2_000, value)) : 0;
}

/** Puts the page up, hidden, and gives it its handlers. False when the browser would not make it. */
function openDriverPage(): boolean {
    const { width, height } = Web.getScreenSize();
    try {
        page = Web.createView(FREECAM_PAGE, { width, height, x: 0, y: 0, zIndex: 90, visible: false, focus: false });
    } catch (thrown: unknown) {
        page = -1;
        console.error(`free camera: the page could not be made: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        return false;
    }
    pageReady = false;
    // A page closed while it loaded can still answer before its browser is gone; only this one counts.
    const id = page;
    pageTimer = setTimeout(() => {
        pageTimer = null;
        if (flying && id === page && !pageReady) {
            console.log("free camera: the page did not say it had drawn");
            stopFreeCamera();
            Hud.showNotification("Não deu para ligar a câmera livre agora: a página que a comanda não respondeu.");
        }
    }, PAGE_WAIT_MS);

    Web.on(page, "freecam:ready", () => {
        if (!flying || id !== page) {
            return;
        }
        pageReady = true;
        if (pageTimer !== null) {
            clearTimeout(pageTimer);
            pageTimer = null;
        }
        Web.showView(page);
        Web.focusView(page, true);
        lastDrive = Date.now();
        driver = setInterval(drive, DRIVER_TICK_MS);
        console.log("free camera: the page drew; it has the keyboard and the mouse");
        deafTimer = setTimeout(() => {
            deafTimer = null;
            if (flying && id === page && !pageHeard) {
                flyByGameKeys();
            }
        }, PAGE_DEAF_MS);
    });
    Web.on(page, "freecam:heard", (payload) => {
        if (id !== page || pageHeard) {
            return;
        }
        pageHeard = true;
        if (deafTimer !== null) {
            clearTimeout(deafTimer);
            deafTimer = null;
        }
        const fields = parse(payload);
        console.log(`free camera: the page hears the player (${String(fields["kind"])}: key '${String(fields["key"])}', code '${String(fields["code"])}', keyCode ${String(fields["keyCode"])})`);
    });
    Web.on(page, "freecam:keys", (payload) => {
        if (id !== page) {
            return;
        }
        if (byGameKeys) {
            return;
        }
        const fields = parse(payload);
        held.forward = axisOf(fields["forward"]);
        held.strafe = axisOf(fields["strafe"]);
        held.lift = axisOf(fields["lift"]);
        held.yaw = axisOf(fields["yaw"]);
        held.pitch = axisOf(fields["pitch"]);
        held.boost = fields["boost"] === true;
        held.crawl = fields["crawl"] === true;
    });
    Web.on(page, "freecam:look", (payload) => {
        if (id !== page) {
            return;
        }
        const fields = parse(payload);
        dragged.x += pixelsOf(fields["dx"]);
        dragged.y += pixelsOf(fields["dy"]);
    });
    Web.on(page, "freecam:exit", (payload) => {
        if (id !== page) {
            return;
        }
        const panel = parse(payload)["panel"];
        console.log(`free camera: ended by the page${panel === "common" || panel === "admin" ? ` (${String(panel)})` : ""}`);
        stopFreeCamera();
        if (panel === "common" || panel === "admin") {
            // The panel's own key: the camera is gone, and the panel comes up where it would have.
            setTimeout(() => void Events.emitLocal("status.open", { mode: panel }).catch(() => undefined), 200);
        }
    });
    return true;
}

/**
 * The page heard nothing: the keyboard goes back to the game, and the game's own keys fly the camera (`Key.isDown`, read on
 * the flight's beat). The page stays up for its help, which it changes to the keys that work now; Esc and F2 end the flight
 * by the flight's own tick (`freeTick`), which hears them again once no page holds the keyboard.
 */
function flyByGameKeys(): void {
    byGameKeys = true;
    held.forward = 0;
    held.strafe = 0;
    held.lift = 0;
    held.yaw = 0;
    held.pitch = 0;
    held.boost = false;
    held.crawl = false;
    if (page >= 0) {
        Web.focusView(page, false);
        Web.emit(page, "freecam:mode", { mode: "keys" });
    }
    console.log(`free camera: the page heard nothing in ${PAGE_DEAF_MS / 1000} s; the game's keys fly it now`);
    Hud.showNotification("Câmera livre pelo teclado do jogo: W A S D voam, setas viram, Espaço sobe, Ctrl desce, Shift acelera. Esc ou F2 saem.");
}

/** What the game's keys hold now, for a flight the page could not take. */
function readGameKeys(): void {
    const axes = { forward: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0 };
    for (const [key, axis, sign] of GAME_KEYS) {
        if (Key.isDown(key)) {
            axes[axis] += sign;
        }
    }
    held.forward = Math.max(-1, Math.min(1, axes.forward));
    held.strafe = Math.max(-1, Math.min(1, axes.strafe));
    held.lift = Math.max(-1, Math.min(1, axes.lift));
    held.yaw = Math.max(-1, Math.min(1, axes.yaw));
    held.pitch = Math.max(-1, Math.min(1, axes.pitch));
    held.boost = Key.isDown("shift");
    held.crawl = Key.isDown("alt");
}

/** One beat of flying: what is held (by the page, or the game's keys), and the pixels dragged since the last beat, turned into this frame's move. */
function drive(): void {
    if (!flying || !pageReady || !NoClip.isActive()) {
        return;
    }
    const now = Date.now();
    const delta = Math.min(0.1, Math.max(0, (now - lastDrive) / 1000));
    lastDrive = now;
    if (byGameKeys) {
        readGameKeys();
    }
    // A mouse dragged to the right turns the camera to the right, which is a falling yaw (a rising one turns left); down looks down.
    const yaw = -dragged.x * LOOK_DEGREES_PER_PIXEL + held.yaw * TURN_DEGREES_PER_SECOND * delta;
    const pitch = -dragged.y * LOOK_DEGREES_PER_PIXEL + held.pitch * TURN_DEGREES_PER_SECOND * delta;
    dragged.x = 0;
    dragged.y = 0;
    if (held.forward === 0 && held.strafe === 0 && held.lift === 0 && yaw === 0 && pitch === 0) {
        return;
    }
    if (!NoClip.move({ forward: held.forward, strafe: held.strafe, lift: held.lift, boost: held.boost, crawl: held.crawl, yaw, pitch }, delta) && !moveRefusedSaid) {
        moveRefusedSaid = true;
        console.log("free camera: NoClip.move refused to move the camera");
    }
}

/** The page thrown away, and what it held let go. The browser itself goes on the next tick: the page may be inside its own event. */
function closeDriverPage(): void {
    if (driver !== null) {
        clearInterval(driver);
        driver = null;
    }
    if (pageTimer !== null) {
        clearTimeout(pageTimer);
        pageTimer = null;
    }
    if (deafTimer !== null) {
        clearTimeout(deafTimer);
        deafTimer = null;
    }
    held.forward = 0;
    held.strafe = 0;
    held.lift = 0;
    held.yaw = 0;
    held.pitch = 0;
    held.boost = false;
    held.crawl = false;
    dragged.x = 0;
    dragged.y = 0;
    pageReady = false;
    pageHeard = false;
    byGameKeys = false;
    moveRefusedSaid = false;
    if (page >= 0) {
        const dying = page;
        page = -1;
        Web.focusView(dying, false);
        Web.hideView(dying);
        setTimeout(() => Web.destroyView(dying), 0);
    }
}

/** Everything a flight changed, put back, however it ended. */
function flightEnded(): void {
    if (!flying) {
        return;
    }
    flying = false;
    if (freeTimer !== null) {
        clearInterval(freeTimer);
        freeTimer = null;
    }
    closeDriverPage();
    showAfterPicture();
    applyThirdPerson();
    announce();
}

export function stopFreeCamera(): void {
    if (!flying) {
        return;
    }
    if (NoClip.isActive()) {
        NoClip.disable();
    }
    flightEnded();
}

/** `/camera`, `/camera third [metres]`, `/camera first`: the same choice the panel makes, so both show the same thing. */
function fromCommand(payload: unknown): void {
    const fields = parse(payload);
    const mode = fields["mode"];
    if (mode !== "toggle" && mode !== "third" && mode !== "first") {
        return;
    }
    const third = mode === "toggle" ? !thirdPerson : mode === "third";
    const distance = fields["distance"];
    customDistance = third && typeof distance === "number" && Number.isFinite(distance) ? Math.min(20, Math.max(0.3, distance)) : null;
    chooseCamera({ thirdPerson: third });
    Hud.showNotification(third ? "Câmera em terceira pessoa" : "Câmera em primeira pessoa");
}

export function installCamera(): void {
    Events.on(CAMERA_EVENT, fromCommand);
    Events.on(`${RESOURCE}:options.state`, received);
    Events.onLocal("camera.choose", (payload) => chooseCamera(parse(payload)));
    Events.onLocal("camera.free", () => startFreeCamera());
    Events.onLocal("camera.stopFree", () => stopFreeCamera());
    Events.onLocal("camera.ask", () => announce());
    Events.on("noclipChanged", (active) => {
        if (!active) {
            flightEnded();
        }
    });

    try {
        Key.bind("escape", "down", () => {
            if (flying) {
                stopFreeCamera();
            }
        });
    } catch (thrown: unknown) {
        console.error(`free camera: Escape could not be bound: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }

    // What the player chose last time, asked for once they are in the world.
    const asking = setInterval(() => {
        if (LocalPlayer?.ready) {
            clearInterval(asking);
            Events.emitServer(`${RESOURCE}:options.get`);
        }
    }, 1000);

    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(asking);
            stopFreeCamera();
            if (Camera.isThirdPerson()) {
                Camera.setThirdPerson(null);
            }
        }
    });
}
