import { furnitureBusy } from "./furniture.js";
import { getPersonInView, isInteractionTargetVisible } from "./interaction.js";
import { muralHasArt, muralOpen, muralPressed } from "./mural.js";
import { EDGE_M, reachTo } from "./reach.js";

const STATIONS = "kcdc-gamemode:cook.stations";
const ASK = "kcdc-gamemode:cook.menu";
const NATIVE_SEEN = "kcdc-gamemode:cook.native";
const CANCEL = "kcdc-gamemode:cook.cancel";
const TEXT = ["Cozinhar", "Secar", "Defumar", "Forjar", "Preparar", "Sentar", "Deitar", "Quadro de avisos", "Reparar"];
const FIRE = 0;
const RACK = 1;
const SMOKEHOUSE = 2;
const FORGE = 3;
const ALCHEMY = 4;
/** A notice board (`src/server/mural.ts`, 2026-10-24): its prompt is on F, like the fire's, and opens a page of ours. */
const MURAL = 7;
/** A grindstone (`src/server/repair.ts`, 2026-10-27): the smiths' repair bench, "Reparar / Sair" on E. */
const AMOLAR = 8;
/**
 * The places whose E is ours alone: the game's own is held back while the hint is up and E is read by the key (2026-10-23: "a cabine de
 * defumar está prendendo os jogadores igual ocorria com a forja"; the rack is the same kind of place; and 2026-10-24: "o bug que ocorreu na
 * forja e no defumar ocorreu na mesa de alquimia: jogador abre e fica preso sem conseguir sair nem iniciar o processo de criação").
 */
export const OWN_E_KINDS: readonly number[] = [RACK, SMOKEHOUSE, FORGE, ALCHEMY, AMOLAR];

/**
 * The key of each hint. At a fire the E is taken twice over by the game itself: "Comer da panela" (the pot's `Click`, on the use
 * action, which nothing can rebind or press for the player) and its own "Cozinhar"; so ours stands on F, the game's "attack_special"
 * (2026-10-20: "na fogueira tem E cozinhar e E comer da panela; o E comer da panela precisa virar F, se não tiver como, inverte os
 * dois"). Everywhere else ours shares E with the game's prompt, as before.
 */
export const FIRE_KEY = "attack_special";
export const STATION_KEY = "primary_action";
const keyOf = (kind: number): string => (kind === FIRE || kind === MURAL ? FIRE_KEY : STATION_KEY);

/**
 * How near and how true the aim must be, by kind of place (fire, rack, smokehouse). A hearth is small and may stand beside a door,
 * so the aim must be on it (2026-10-18); the rack is a frame, and the smokehouse a hut with the point the level gives for it
 * inside, its walls between the camera and that point: with the hearth's tolerance the player's "Defumar" never came up, they
 * pressed the game's own prompt (which the server hears nothing of) and smoked 40 pieces of pork for nothing.
 *
 * How near is the one reach of all our E and F prompts (`reach.ts`, 2026-10-22: two metres from the edge of the thing): the game gives
 * one point for each of these, and the point is `EDGE_M` of the edge of what it stands for.
 */
const REACH = [
    { maxDistance: reachTo(EDGE_M.fire), aimRadius: 0.8, height: 0.5 },
    { maxDistance: reachTo(EDGE_M.rack), aimRadius: 1.6, height: 1 },
    { maxDistance: reachTo(EDGE_M.hut), aimRadius: 2.6, height: 1 },
    // The forge: the point the level gives a smithery is its anvil and hearth together.
    { maxDistance: reachTo(EDGE_M.forge), aimRadius: 1.6, height: 1 },
    // An alchemy table this server put in the world (`src/server/craft-places.ts`): its frame and furnace, three metres wide.
    { maxDistance: reachTo(EDGE_M.alchemy), aimRadius: 1.8, height: 1 },
    // A chair or a stool of a World Builder export (`src/server/furniture.ts`): a small seat among others at a table.
    { maxDistance: reachTo(EDGE_M.chair), aimRadius: 0.55, height: 0.5 },
    // A bed of an export: the whole bed is the target.
    { maxDistance: reachTo(EDGE_M.bed), aimRadius: 1.2, height: 0.8 },
    // A notice board (`src/server/mural-places.ts`): the point is on the ground in front of its planks, which are two metres wide and as high.
    { maxDistance: reachTo(EDGE_M.mural), aimRadius: 2.2, height: 1.3 },
    // A grindstone: found by the entity under the crosshair (its class), so only the distance counts.
    { maxDistance: reachTo(EDGE_M.grindstone), aimRadius: 1, height: 0.6 },
];

/**
 * The game's own E, held back where ours stands in for it (user, 2026-10-22: "apertei E na forja e ao sair fiquei preso igual na pedra de
 * afiar"): at a forge the game's E starts its own smithing, whose screen we keep shut (the page is ours), and the interaction it began was
 * left half done when our menu was left; so while our "Forjar" is up the game's `use` is off and E is read here (`Key.bind` still hears
 * it). The smokehouse and the drying rack are the same (2026-10-23: "a cabine de defumar está prendendo os jogadores igual ocorria com a
 * forja"): the game's E there begins its own preparation, the goods screen it opens is shut under our page, and the player was left in the
 * animation; now their "Defumar" and "Secar" hold the game's E back too (`OWN_E_KINDS`), and give way to a door or a chest in the aim, as a
 * bed's does, so the hut's own door still opens. The grindstone beside a forge was held back the same way for whoever was not a smith
 * (2026-10-22), until the same evening: from one angle the game's own E still reached it, and the user had it free for everybody ("para
 * facilitar nossa vida vamos deixar liberado para todo mundo mesmo"), so its E is the game's alone again (`NATIVE_ONLY`).
 */
export const NATIVE_USE_ACTIONS = ["use", "trigger_use"];
/** The same press is not taken twice (the hint's own and the key's). */
const PRESS_GAP_MS = 700;

/**
 * The game's own "Cozinhar" at a fire, held back too (a player, 2026-10-25: "tem a opção E na panela que, se aperta, trava o game e tenho que
 * relogar"; the user: "pode deixar o E de comer na panela e o F de cozinhar, o problema só está no E de cozinhar"). That E opens the game's
 * food picker, which we close (cooking is our F); closed under it, the game's cooking was left half begun and the player stuck. The pot's
 * "Comer" is on the same E and must stay.
 *
 * Held back, the game takes its prompt down (a horse's "[E] Montar" went the same way, 2026-10-20), so the hold of 2026-10-25, made only while
 * the prompt was seen (`ActionHint.shown`, in the player's language), lapsed after a moment to look again: the prompt came back, was seen and
 * held, over and over, and an E in that moment opened the game's picker (the user, 2026-10-28: "o E de cozinhar item no fogo aparece ainda";
 * the server heard the picker come up for them at 01:44 UTC). Since 2026-10-28:
 *  - aimed at a fire whose pot has no meal in it (the server says which have one), or at a camp's fire, which has no pot, the game's E can be
 *    nothing but its cooking: it is held for as long as the aim is there, and its prompt never shows;
 *  - anywhere else within reach of a fire and `FIRE_HOLD.aroundM` more (a pot with a meal, the aim beside the hearth), the game's prompt is
 *    looked at: its "Cozinhar", once seen, is held until the aim turns or the body moves (`FIRE_HOLD`), and is then looked at again; its
 *    "Comer" leaves E alone. A door or a chest in the aim leaves it alone too.
 */
export const NATIVE_COOK = /cozinh|cook|va[rř]it/i;
export const NATIVE_EAT = /comer|\beat\b|j[ií]st|naj[ií]st/i;
export const FIRE_HOLD = { aroundM: 1, turnDeg: 8, moveM: 0.5 };

/** Where the aim pointed and the body stood when the game's "Cozinhar" was held back at a fire. */
export interface FireAim {
    readonly dx: number;
    readonly dy: number;
    readonly dz: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** Whether the aim has turned or the body moved since a hold began, by `FIRE_HOLD`. */
export function movedFrom(from: FireAim, to: FireAim): boolean {
    const lengths = Math.hypot(from.dx, from.dy, from.dz) * Math.hypot(to.dx, to.dy, to.dz);
    if (lengths === 0) return true;
    const turned = (from.dx * to.dx + from.dy * to.dy + from.dz * to.dz) / lengths < Math.cos((FIRE_HOLD.turnDeg * Math.PI) / 180);
    return turned || Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z) > FIRE_HOLD.moveM;
}

/** Whether the game's own prompts on its use key are its cooking and not the pot's meal. */
export function nativeCookOnUse(hints: ReadonlyArray<{ key: string; map: string; text: string }>): "cook" | "eat" | "" {
    let cook = false;
    for (const hint of hints) {
        if (hint.key !== "use" || hint.map !== "player") continue;
        if (NATIVE_EAT.test(hint.text)) return "eat";
        if (NATIVE_COOK.test(hint.text)) cook = true;
    }
    return cook ? "cook" : "";
}

/**
 * Our hint shares E with the game's own prompt, and a hint leaves the game's action on its key alone: at a fire the press also
 * opened the game's food picker under our menu (2026-10-18: "abriu a interface padrão e o menu por cima ... preciso que só abra o
 * menu"). The game's screens a press of ours opens are closed as they come up, for a few seconds after it: the fire's picker
 * (`ItemSelection`, in the level's `player_cooking`) and the goods screen of a smokehouse or rack (`ItemTransfer`). At a forge
 * the game's recipe screen is its crafting menu, kept off while our "Forjar" is up and a moment after. The server is told what
 * was closed, for its log.
 */
export const NATIVE = { screens: ["ItemSelection", "ItemTransfer"], watchMs: 4000 };

/**
 * The grindstone beside a forge. It was the game's alone (2026-10-19: aimed at it, our "Forjar" took E, the game's blade picker flashed and was
 * closed, and the player was left in "Forjar / Sair"; "na pedra de amolar podemos usar o padrão do vanilla"); since 2026-10-27 it is a place of ours
 * (`AMOLAR`, "Reparar"), found by the entity under the crosshair, and while the aim is on one the other places give way to it. `AIM_CHECK_M` is how far
 * along the aim we look.
 */
export const NATIVE_ONLY = /^grindstone$/i;
const AIM_CHECK_M = 6;

/**
 * What a chair's "Sentar" or a bed's "Deitar" gives way to when the aim is on it: a chest or a door beside it (2026-10-20: at the
 * chest at the foot of a bed in Raborsch, E laid the player on the bed instead of opening the chest, "me bugou ao tentar abrir").
 */
export const SEAT_GIVES_WAY = /stash|chest|container|door/i;
/** The places a chest or a door in the aim takes the hint down at: the rack, the smokehouse, a chair and a bed. */
const GIVE_WAY_KINDS = [RACK, SMOKEHOUSE, 5, 6];

/**
 * Beside the game's own prompt at a fire, a rack, a smokehouse or a forge, and alone at an alchemy table of this server's: ours,
 * which asks the server for the trade's menu.
 */
export function installCookHint(): void {
    let points: number[][] = [];
    let hint = 0;
    /** The key the hint on show was made on: a hint cannot change key, so a place of the other key takes it down and puts up a new one. */
    let hintKey = "";
    let shown = -1;
    let pressedAt = 0;
    let pressedKind = -1;
    /** Where the hint on show is: sent with the press, so the server takes the chair or the bed the player was aimed at. */
    let shownAt = { x: 0, y: 0 };
    let craftingOff = false;
    /** Where the aim and the body were when the game's "Cozinhar" was held back at a fire; null while it is not (`FIRE_HOLD`). */
    let fireHold: FireAim | null = null;
    let shownBroken = false;
    /** What the game draws on its use key: its cooking, the pot's meal, or neither (a read that fails is neither, said once). */
    const nativeOnUse = (): "cook" | "eat" | "" => {
        if (shownBroken) return "";
        try {
            return nativeCookOnUse(ActionHint.shown());
        } catch (thrown: unknown) {
            shownBroken = true;
            console.error(`cook hint: the game's prompts could not be read: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
            return "";
        }
    };
    let useHeld = false;
    let useBroken = false;
    let keyAt = 0;
    const holdUse = (on: boolean): void => {
        if (on === useHeld || useBroken) {
            return;
        }
        try {
            for (const action of NATIVE_USE_ACTIONS) {
                if (on) {
                    Controls.disableAction(action);
                } else {
                    Controls.enableAction(action);
                }
            }
            useHeld = on;
        } catch (thrown: unknown) {
            useBroken = true;
            console.error(`cook hint: the game's use could not be held back: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    };
    const remove = (): void => {
        if (hint) ActionHint.remove(hint);
        hint = 0;
        hintKey = "";
        shown = -1;
    };
    const press = (): void => {
        pressedAt = Date.now();
        pressedKind = shown;
        if (shown === MURAL) {
            muralPressed();
            Events.emitServer(ASK, { kind: shown, x: shownAt.x, y: shownAt.y, art: muralHasArt() });
            return;
        }
        Events.emitServer(ASK, { kind: shown, x: shownAt.x, y: shownAt.y });
    };
    const crafting = (off: boolean): void => {
        if (off === craftingOff) return;
        craftingOff = off;
        try {
            NativeUI.setMenuEnabled("crafting", !off);
        } catch {
            // Not in this build: the game's screen stays as it is.
        }
    };
    /**
     * The game's screens that came up with our press, closed. At a fire the food picker is closed whenever it comes up, press of ours
     * or not: ours is on F now, so the game's own E there ("Cozinhar", which opens that picker) is what the player may press, and
     * cooking is done in our menu, not in the game's (`own: false` tells the server, which says so to the player).
     */
    const watch = (): void => {
        const recent = Date.now() - pressedAt < NATIVE.watchMs;
        crafting(shown === FORGE || shown === ALCHEMY || (recent && (pressedKind === FORGE || pressedKind === ALCHEMY)));
        const atFire = shown === FIRE;
        if (!recent && !atFire) return;
        for (const name of NATIVE.screens) {
            if (!recent && name !== "ItemSelection") continue;
            try {
                const screen = NativeUI.element(name, 0);
                if (!screen.visible) continue;
                // A forge's own screen is its crafting menu: a blade picker after our "Forjar" is the grindstone's, the aim
                // having missed it. That one is the game's to keep, and our menu goes instead.
                if (recent && pressedKind === FORGE && name === "ItemSelection") {
                    pressedAt = 0;
                    Events.emitServer(CANCEL, JSON.stringify({ screen: name, kind: pressedKind }));
                    return;
                }
                screen.call("Close", [true]);
                if (screen.visible) screen.hide();
                Events.emitServer(NATIVE_SEEN, JSON.stringify(recent ? { screen: name, kind: pressedKind } : { screen: name, kind: FIRE, own: false }));
            } catch {
                // Not loaded: nothing up.
            }
        }
    };
    /** Whether the aim is on one of the game's own things whose class `pattern` names. */
    const aimedAt = (pattern: RegExp): boolean => {
        const ray = Camera.screenRay();
        if (!ray) return false;
        const to = new Vector3(ray.origin.x + ray.direction.x * AIM_CHECK_M, ray.origin.y + ray.direction.y * AIM_CHECK_M, ray.origin.z + ray.direction.z * AIM_CHECK_M);
        const hit = World.raycast(ray.origin, to, { mode: "anything", ignoreSelf: true });
        return hit !== null && hit.kind === "entity" && hit.entityClass !== null && pattern.test(hit.entityClass);
    };
    /**
     * Whether the game's use is held back at a fire (`NATIVE_COOK`): `aimed` is the fire our hint is on, null for none; `around`, whether a fire
     * is within reach and `FIRE_HOLD.aroundM` more.
     */
    const fireUseHeld = (aimed: readonly number[] | null, around: boolean, body: { readonly x: number; readonly y: number; readonly z: number }): boolean => {
        const ray = around ? Camera.screenRay() : null;
        if (!ray || aimedAt(SEAT_GIVES_WAY)) {
            fireHold = null;
            return false;
        }
        const here: FireAim = { dx: ray.direction.x, dy: ray.direction.y, dz: ray.direction.z, x: body.x, y: body.y, z: body.z };
        // A fire with no meal in its pot: the game's E there is its cooking alone.
        if (aimed !== null && aimed[4] !== 1) {
            fireHold = here;
            return true;
        }
        if (fireHold !== null && !movedFrom(fireHold, here)) return true;
        // Looked at again: with the hold just given back, the game draws its prompt again by the next look.
        fireHold = nativeOnUse() === "cook" ? here : null;
        return fireHold !== null;
    };
    const update = (): void => {
        const me = LocalPlayer;
        if (!me?.ready || !me.alive || getPersonInView() || furnitureBusy() || muralOpen()) {
            fireHold = null;
            holdUse(false);
            remove();
            return;
        }
        // The body's place in plain numbers: each `.x` of the engine's vector is a call into the engine, and it was read again for every place near.
        const body = me.position;
        const p = { x: body.x, y: body.y, z: body.z };
        let kind = -1;
        let best = 6;
        let at = shownAt;
        let aimedPoint: readonly number[] | null = null;
        let fireAround = false;
        const fireAroundM = (REACH[FIRE]?.maxDistance ?? 2.6) + FIRE_HOLD.aroundM;
        for (const s of points) {
            // A grindstone is found by the entity under the crosshair, below, never by this look at its point.
            if (s[0] === AMOLAR) continue;
            const d = Math.hypot(s[1]! - p.x, s[2]! - p.y);
            if (s[0] === FIRE && d <= fireAroundM && Math.abs(s[3]! - p.z) <= 2.5) fireAround = true;
            const reach = REACH[s[0]!] ?? REACH[0]!;
            // Near is not enough (a hearth beside a door put "Cozinhar" up for whoever aimed at the door, 2026-10-18): the aim must be on it.
            if (d < best && Math.abs(s[3]! - p.z) <= 2.5 && isInteractionTargetVisible({ x: s[1]!, y: s[2]! , z: s[3]! }, reach)) {
                best = d;
                kind = s[0]!;
                at = { x: s[1]!, y: s[2]! };
                aimedPoint = s;
            }
        }
        // With the aim on a grindstone the places beside it give way (the forge's "Forjar" stayed down there since 2026-10-19); when its point is in reach the
        // grindstone's own "Reparar" stands in their place (2026-10-27), and with none the game's alone is left.
        // The aim is traced only when it can change anything: a place of ours is near, or a grindstone within its reach (it was traced every 150 ms for every
        // player, anywhere, because the level has grindstones somewhere; 2026-10-27).
        const amolarReach = REACH[AMOLAR]?.maxDistance ?? 3;
        const amolarNear = points.some((s) => s[0] === AMOLAR && Math.hypot(s[1]! - p.x, s[2]! - p.y) <= amolarReach && Math.abs(s[3]! - p.z) <= 2.5);
        if ((kind >= 0 || amolarNear) && aimedAt(NATIVE_ONLY)) {
            kind = -1;
            best = 6;
            for (const s of points) {
                if (s[0] !== AMOLAR) continue;
                const d = Math.hypot(s[1]! - p.x, s[2]! - p.y);
                if (d < best && d <= (REACH[AMOLAR]?.maxDistance ?? 3) && Math.abs(s[3]! - p.z) <= 2.5) {
                    best = d;
                    kind = AMOLAR;
                    at = { x: s[1]!, y: s[2]! };
                }
            }
        }
        if (kind < 0 || (GIVE_WAY_KINDS.includes(kind) && aimedAt(SEAT_GIVES_WAY))) {
            // Our hint goes; beside a fire the game's own cooking is still held back (its prompt reaches farther than our aim).
            holdUse(kind < 0 && fireUseHeld(null, fireAround, p));
            remove();
            return;
        }
        holdUse(OWN_E_KINDS.includes(kind) || fireUseHeld(kind === FIRE ? aimedPoint : null, fireAround, p));
        shownAt = at;
        const key = keyOf(kind);
        if (hint && hintKey !== key) {
            // From a fire (F) to a rack or a chair (E), or the other way: another key, another hint.
            ActionHint.remove(hint);
            hint = 0;
        }
        if (!hint) {
            hint = ActionHint.create({ key, text: TEXT[kind] ?? "Cozinhar" }, press);
            hintKey = key;
        } else if (shown !== kind) ActionHint.setText(hint, TEXT[kind] ?? "Cozinhar");
        shown = kind;
    };
    Events.on(STATIONS, (payload) => {
        try {
            const list = typeof payload === "string" ? JSON.parse(payload) : payload;
            // Four numbers, and a fifth at a fire whose pot has a meal in it (2026-10-28).
            points = Array.isArray(list) ? list.filter((s) => Array.isArray(s) && (s.length === 4 || s.length === 5) && s.every(Number.isFinite)) : [];
        } catch {
            points = [];
        }
    });
    const timer = setInterval(() => {
        try {
            update();
            watch();
        } catch (thrown: unknown) {
            // A frame the view could not be read (a level loading, a cutscene): the game's own E is never left off for it.
            holdUse(false);
            remove();
            console.error(`cook hint: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        }
    }, 150);
    // With the game's use held back, E is ours: at the forge, the smokehouse and the rack it is the menu.
    try {
        Key.bind("e", "down", () => {
            const now = Date.now();
            if (now - keyAt < PRESS_GAP_MS || Hud.isInDialogue() || !Controls.isEnabled() || !useHeld) {
                return;
            }
            keyAt = now;
            if (OWN_E_KINDS.includes(shown)) {
                press();
            }
        });
    } catch (thrown: unknown) {
        console.error(`cook hint: the E key could not be watched: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
    Events.on("resourceStop", (name) => {
        if (name !== "kcdc-gamemode") return;
        clearInterval(timer);
        remove();
        crafting(false);
        holdUse(false);
    });
}
