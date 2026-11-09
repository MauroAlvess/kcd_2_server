/**
 * The status panel: character and guild information, a full-screen CEF view
 * separate from the F4 debug panel (`panel.ts` manages exactly one view, so
 * this one keeps its own state rather than share it).
 *
 * The view lives only while the panel is open. The panel key creates it hidden and it is shown once its page says
 * it has drawn (a view shown at creation puts up a blank frame while the page loads); closing destroys
 * it, so a closed panel holds no browser, page or pictures. The server's last answers, a few kilobytes,
 * stay here and go to each new page before it is shown, so it opens filled in rather than blank.
 *
 * The panel key belongs to the game while the panel is closed and to the page while it is open, and each side must
 * see only its own presses: one seen by both opens the panel and closes it again in the same instant,
 * the blink that took several presses. So the view takes the keyboard only once the key press that opened it
 * is back up, and the page closes on the release of that key or of Escape, never on the press.
 */

import { onLarge } from "./big-events.js";
import { isRestrained } from "./restraint.js";
import { thirstGauge } from "./thirst.js";
import { scaleView } from "./ui-scale.js";

const RESOURCE = "kcdc-gamemode";

/**
 * The panel has two doors. F2 opens it on the sections everybody has; F3 next to it opens the same panel on the
 * administrator's sections, and only for an administrator (F4, beside them, is the administrator's debug panel).
 * The comma and the full stop were wanted first, but the mod's table of key names (KCDC 1.6.9) has no punctuation key
 * at all: Key.bind throws on "comma" and "period". The arrows that stood in for them walk the character in KCD2. In the
 * game's own key maps F2 is bound to nothing and F3 only in the debug map, which is off in play; U is the game's
 * (held, it offers peace in a duel). A key the mod refuses leaves its door shut and says so in the log. The key taken
 * tells the page (which closes on the same key) and the player.
 */
type Mode = "common" | "admin";
const KEY_CHOICES: Readonly<Record<Mode, readonly string[]>> = { common: ["f2"], admin: ["f3"] };

/** For each key: what a web page calls it (`KeyboardEvent.code`), what the keycap shows, and how a sentence names it. */
const KEY_INFO: Readonly<Record<string, { readonly code: string; readonly label: string; readonly name: string }>> = {
    f2: { code: "F2", label: "F2", name: "F2" },
    f3: { code: "F3", label: "F3", name: "F3" },
};

/** The key bound for each door, "" until one is. */
const keyOf: Record<Mode, string> = { common: "", admin: "" };

/** Which door the panel was opened by, or last switched to. */
let mode: Mode = "common";

/** The key that opened the panel: its release gives the page the keyboard. */
let heldKey = "";

/** Whether this player is an administrator, as the server last said (status.social); null until it has. */
let admin: boolean | null = null;

/** The administrator's door was tried before the server had said who this player is: it opens if the answer is yes. */
let adminAsked = false;

/** What the player called the character in the creator, as the server last said (status.social); "" for one made before the names. */
let characterName = "";
const PAGE = `fw://resources/${RESOURCE}/ui/status.html`;

const SAMPLE_MS = 500;

/** A press of the panel key this soon after the panel opened or closed is the same press, not a new one. */
const TOGGLE_DEBOUNCE_MS = 250;

/** Messages a new page needs at once (the server's answers, the camera's and the microphone's state); a notice is of the moment and is not kept. */
const KEPT_MESSAGES = ["status:social", "status:options", "status:voice", "status:dict", "status:image"];

/** How long after the panel has gone the free camera starts, so the click that asked for it is over. */
const FREE_CAMERA_DELAY_MS = 300;

let view = -1;
let pageReady = false;

/** The player asked for the panel; it is on screen as soon as the page is ready. */
let wanted = false;

/** On screen, but the key that opened it is still down: the keyboard goes to the page when it comes up. */
let focusOnRelease = false;

let lastToggleAt = 0;

/** The newest of each kept server message, for the next page. */
const latest = new Map<string, unknown>();

/** The section each door was last on, so the panel opens there again. */
const lastTabOf: Record<Mode, string> = { common: "", admin: "" };

function selfPayload(): Record<string, unknown> {
    const me = LocalPlayer;
    if (!me || !me.ready) {
        return { name: "", health: [0, 0], stamina: [0, 0], hunger: [0, 0], thirst: [0, 0], energy: [0, 0] };
    }
    return {
        name: characterName !== "" ? characterName : me.nickname,
        health: [me.health, me.maxHealth],
        stamina: [me.stamina, me.maxStamina],
        hunger: [me.hunger, me.maxHunger],
        // The server's own thirst, as it last said (`thirst.ts`).
        thirst: thirstGauge(),
        energy: [me.exhaust, me.maxExhaust],
    };
}

function pushSelf(): void {
    if (view >= 0 && pageReady) {
        Web.emit(view, "status:self", selfPayload());
    }
}

function askServer(): void {
    Events.emitServer(`${RESOURCE}:status.poll`);
}

function reveal(): void {
    Web.showView(view);
    // The view does not hold the keyboard yet, so this is still the game's own reading of the key.
    focusOnRelease = heldKey !== "" && Key.isDown(heldKey);
    if (!focusOnRelease) {
        Web.focusView(view, true);
    }
    Web.emit(view, "status:shown", {});
    pushSelf();
    askServer();
}

/** Gives the page the keyboard once the key that opened the panel has been let go. */
function focusAfterRelease(): void {
    if (!focusOnRelease || (heldKey !== "" && Key.isDown(heldKey))) {
        return;
    }
    focusOnRelease = false;
    if (view >= 0 && wanted) {
        Web.focusView(view, true);
    }
}

/** What a field of a page event must be: a string, a number, or a number that may be left out. */
type FieldKind = "string" | "string?" | "number" | "number?";

/**
 * Hands what the page chose to the server, which decides whether it is a valid choice. A page event
 * that is missing a field, or has one of the wrong type, goes no further; fields not listed are dropped.
 */
function relay(pageEvent: string, fields: Readonly<Record<string, FieldKind>>, closing = false, answer?: (forwarded: Record<string, unknown>, id: number) => boolean): void {
    const id = view;
    Web.on(view, pageEvent, (payload) => {
        const source = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
        const forwarded: Record<string, unknown> = {};
        for (const [key, kind] of Object.entries(fields)) {
            const value = source[key];
            if ((kind === "number?" || kind === "string?") && value === undefined) {
                continue;
            }
            const fits = kind === "string" || kind === "string?" ? typeof value === "string" : typeof value === "number" && Number.isFinite(value);
            if (!fits) {
                return;
            }
            forwarded[key] = value;
        }
        // A request this side can answer itself (a picture it already holds) is not sent on.
        if (answer?.(forwarded, id) === true) {
            return;
        }
        const send = (): void => Events.emitServer(`${RESOURCE}:${pageEvent.replace(":", ".")}`, JSON.stringify(forwarded));
        // A request that opens one of the game's own screens (a transfer screen) puts the panel away first, then asks.
        if (closing && id === view) {
            hide();
            setTimeout(send, FREE_CAMERA_DELAY_MS);
        } else {
            send();
        }
    });
}

/** The pictures the page asked for before it was ready: each is answered from what is kept the moment it is. */
const askedEarly = new Set<string>();

/** A picture the server has already sent this session is given to the page from here, with no round trip. True when it was. */
function answerImage(forwarded: Record<string, unknown>, id: number): boolean {
    const name = typeof forwarded["name"] === "string" ? forwarded["name"].slice(0, 40) : "";
    const kept = latest.get(`status:image:${name}`);
    if (kept === undefined) {
        return false;
    }
    if (id === view && pageReady) {
        Web.emit(view, "status:image", kept);
    } else if (id === view) {
        askedEarly.add(name);
    }
    return true;
}

function create(): boolean {
    // The page draws its own margins and scales itself to the view, so the view is the whole screen.
    const { width, height } = Web.getScreenSize();

    try {
        view = Web.createView(PAGE, {
            width,
            height,
            x: 0,
            y: 0,
            zIndex: 100,
            visible: false,
            focus: false,
        });
    } catch (thrown: unknown) {
        console.error(`could not create the status panel view: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
        view = -1;
        return false;
    }

    pageReady = false;
    askedEarly.clear();
    // A page closed while it loaded can still answer before its browser is gone; only this one counts.
    const id = view;

    Web.on(view, "status:ready", () => {
        if (id !== view) {
            return;
        }
        pageReady = true;
        scaleView(view);
        Web.emit(view, "status:key", { common: KEY_INFO[keyOf.common] ?? KEY_INFO["f2"], admin: KEY_INFO[keyOf.admin] ?? null });
        // The camera's state comes back as camera.state, kept like the server's answers.
        void Events.emitLocal("camera.ask").catch(() => undefined);
        // So does the microphone's (voice.ts).
        void Events.emitLocal("voice.ask").catch(() => undefined);
        // The pictures are not replayed: the page asks for the ones it draws, and is answered from what is kept (`answerImage`).
        for (const [channel, payload] of latest) {
            if (!channel.startsWith("status:image:")) {
                Web.emit(view, channel, payload);
            }
        }
        for (const name of askedEarly) {
            const kept = latest.get(`status:image:${name}`);
            if (kept !== undefined) {
                Web.emit(view, "status:image", kept);
            }
        }
        askedEarly.clear();
        // After the server's answers: the page shows the administrator's door only to somebody it already knows is one,
        // and a door asked for before that turned it back to the common one (F3 opened the same panel as F2).
        Web.emit(view, "status:mode", { mode });
        // After the door, whose buttons must be there for the section to be chosen.
        if (lastTabOf[mode]) {
            Web.emit(view, "status:tab", { tab: lastTabOf[mode] });
        }
        if (wanted) {
            reveal();
        }
    });

    Web.on(view, "status:close", () => {
        if (id === view) {
            hide();
        }
    });

    Web.on(view, "status:tab", (payload) => {
        const tab = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).tab : undefined;
        if (typeof tab === "string" && /^[a-z]{1,24}$/.test(tab)) {
            lastTabOf[mode] = tab;
            // The server sends the data of the section on screen and of no other (2026-10-31): it is told which one opened.
            Events.emitServer(`${RESOURCE}:status.section`, JSON.stringify({ tab }));
        }
    });

    // The page switched doors itself, on the other key.
    Web.on(view, "status:mode", (payload) => {
        const next = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).mode : undefined;
        if (id === view && (next === "common" || (next === "admin" && admin === true))) {
            mode = next;
        }
    });

    relay("status:selectGuild", { guildId: "string" });
    relay("status:grantKey", { propertyId: "string", targetId: "number?", doorIndex: "number?" });
    relay("status:propSave", { id: "string", name: "string", description: "string", region: "string?" });
    relay("status:propOwner", { id: "string", targetId: "number?" });
    relay("status:propDisown", { id: "string" });
    // A lord takes back a house of their region whose owner stopped coming (2026-11-02).
    relay("status:propReclaim", { id: "string" });
    relay("status:familyAdd", { relation: "string", name: "string", degree: "number?", linkId: "number?" });
    relay("status:familyEdit", { id: "string", relation: "string?", deceased: "number?", linkId: "number?" });
    relay("status:familyRemove", { id: "string" });
    relay("status:familyAnswer", { key: "string", accept: "number" });
    relay("status:familySurname", { surname: "string" });
    relay("status:familyProfile", { description: "string", crest: "string" });
    relay("status:roster", { tag: "string?", q: "string?", page: "number?", filter: "string?" });
    // The administrator's NPCs page (guild-vendors.ts, 2026-10-31): the vendors by region and village, with their ids.
    relay("status:npcs", {});
    relay("status:npcDisable", { id: "string", off: "number" });
    relay("status:guildMembers", { guildId: "string", page: "number" });
    relay("status:unstick", {});
    relay("status:lang", { lang: "string" });
    // The Cidadania section left the panel (2026-11-09): the citizenship, its lords' lists and the wars have no page to ask for them; the server keeps them (`/cidadania`).
    // The Cartas section (letters.ts, 2026-11-02): the lists asked for, a letter opened (its text; one received is read from then on), one written and sent, one
    // thrown away from a list, and how long the courier would take to somebody. A letter's style comes flat: this side carries strings and numbers only.
    relay("status:lettersAsk", {});
    relay("status:letterOpen", { id: "string" });
    relay("status:letterSend", { to: "number", title: "string", body: "string", font: "string", bold: "number", spacing: "string", align: "string", anon: "number", seal: "string" });
    relay("status:letterDrop", { id: "string" });
    relay("status:letterQuote", { to: "number" });
    relay("status:supporterGrant", { targetId: "number" });
    relay("status:supporterRevoke", { targetId: "number" });
    relay("status:ban", { targetId: "number" });
    relay("status:animalStuck", { kind: "string", key: "string?" });
    relay("status:unban", { targetId: "number" });
    relay("status:execute", { targetId: "number" });
    relay("status:pardon", { targetId: "number" });
    relay("status:propLock", { id: "string", locked: "number" });
    relay("status:propGates", { id: "string", open: "number" });
    relay("status:resetCharacter", { confirm: "number" });
    // "Refazer aparência": the creator comes up over the body, so the panel is put away first.
    relay("status:remakeLook", { confirm: "number" }, true);
    relay("status:setSocial", { targetId: "number", status: "string", family: "number" });
    // The Nomeação section (nominations.ts): naming and taking away a title, the title worn over the head, and the hierarchy.
    // `via` says it is given in the Crown's name (the Jogadores page), `region` the town the title is of (2026-10-31; `via` was left out of the list and never reached the server).
    relay("status:nominate", { targetId: "number", title: "string", via: "string?", region: "string?" });
    relay("status:revokeTitle", { targetId: "number?", key: "string?", title: "string", self: "number?" });
    relay("status:shownTitle", { title: "string" });
    relay("status:hierarchy", {});
    relay("status:image", { name: "string" }, false, answerImage);
    // Chaves and Propriedades open one region at a time (src/server/status.ts, `propertiesFor`).
    relay("status:propRegion", { tab: "string", region: "string" });
    // One door of a house, a property given on by its owner, and a whole region ceded by an administrator.
    relay("status:doorLock", { id: "string", index: "number", locked: "number" });
    relay("status:propGive", { id: "string", targetId: "number" });
    // Access (2026-10-28), instead of keys: given to a player, taken back by the owner, let go by the one who has it.
    relay("status:propAccess", { id: "string", targetId: "number" });
    relay("status:propAccessRemove", { id: "string", index: "number", name: "string" });
    relay("status:propAccessLeave", { id: "string" });
    relay("status:roomSave", { house: "string", room: "string?", name: "string", doors: "string", chests: "string" });
    relay("status:roomGive", { room: "string", targetId: "number?" });
    relay("status:roomVacate", { room: "string", self: "number?" });
    relay("status:roomDelete", { room: "string" });
    relay("status:regionCede", { region: "string", targetId: "number?", confirm: "number?", remove: "number?" });
    relay("status:animals", {});
    relay("status:animalName", { kind: "string", key: "string?", name: "string" });
    relay("status:animalCall", { kind: "string", key: "string?" });
    relay("status:animalAway", { kind: "string" });
    // A horse let go to the free world, after the panel's own question (`horses.ts`, `letHorseGo`).
    relay("status:horseRelease", { key: "string" });
    relay("status:cartName", { key: "string", name: "string" });
    relay("status:cartBring", { key: "string" });
    relay("status:animalGive", { kind: "string", key: "string", targetId: "number" });
    relay("status:craftOpen", { station: "string" }, true);
    relay("status:horseShared", { key: "string", shared: "number" });
    relay("status:horseActive", { key: "string" });
    relay("status:cartShared", { key: "string", shared: "number" });

    // The "Opções" section: the camera is this machine's own (camera.ts), which keeps the choice through the server.
    Web.on(view, "status:option", (payload) => {
        const fields = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
        const third = fields["thirdPerson"];
        const chosen = fields["view"];
        if ((third !== 0 && third !== 1) || (chosen !== "perto" && chosen !== "normal" && chosen !== "longe")) {
            return;
        }
        void Events.emitLocal("camera.choose", { thirdPerson: third, view: chosen }).catch(() => undefined);
    });
    // The microphone is this machine's own as well (voice.ts): how it opens, and how sensitive it is when it is open.
    Web.on(view, "status:voice", (payload) => {
        const fields = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
        const mic = fields["mic"];
        const sensitivity = fields["sensitivity"];
        const change: Record<string, string> = {};
        if (mic === "aberto" || mic === "apertar") {
            change["mic"] = mic;
        }
        if (sensitivity === "alta" || sensitivity === "media" || sensitivity === "baixa") {
            change["sensitivity"] = sensitivity;
        }
        if (Object.keys(change).length > 0) {
            void Events.emitLocal("voice.choose", change).catch(() => undefined);
        }
    });
    // The size of the server's pages (Opções, Resolução da interface): every page of ours, kept by the server (ui-scale.ts).
    Web.on(view, "status:ui", (payload) => {
        const ui = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>)["ui"] : undefined;
        if (typeof ui === "string") {
            void Events.emitLocal("ui.choose", { ui }).catch(() => undefined);
        }
    });
    Web.on(view, "status:freeCam", () => {
        if (id !== view) {
            return;
        }
        hide();
        setTimeout(() => void Events.emitLocal("camera.free").catch(() => undefined), FREE_CAMERA_DELAY_MS);
    });

    console.log(`status panel view ${view} created at ${width}x${height}, hidden`);
    return true;
}

/**
 * Throws the view away. The page asking to close is still inside its own event when this runs, so the
 * browser itself goes on the next tick; the id is forgotten at once, and a new press makes a new view.
 */
function destroy(): void {
    if (view < 0) {
        return;
    }
    const dying = view;
    view = -1;
    pageReady = false;
    setTimeout(() => Web.destroyView(dying), 0);
}

function open(): void {
    // The panel's key is also a way out of the free camera, besides Escape.
    void Events.emitLocal("camera.stopFree").catch(() => undefined);
    if (view < 0 && !create()) {
        return;
    }
    wanted = true;
    if (pageReady) {
        reveal();
    }
}

function hide(): void {
    wanted = false;
    focusOnRelease = false;
    lastToggleAt = Date.now();
    if (view >= 0) {
        Web.focusView(view, false);
        Web.hideView(view);
        destroy();
        // Nothing of the panel is worked out at the server while it is closed: the next page asks for its own section when it opens (2026-10-31).
        Events.emitServer(`${RESOURCE}:status.section`, JSON.stringify({ tab: "closed" }));
    }
}

/** A press of one door's key: opens the panel on it, closes it when it is open on it, or turns it to it. */
function toggle(which: Mode): void {
    const now = Date.now();
    if (focusOnRelease || now - lastToggleAt < TOGGLE_DEBOUNCE_MS) {
        return;
    }
    // Handcuffed or in the pillory (arrest.ts, 2026-10-29): no menu but the pause menu's. A panel that was up when the cuffs went on can still be put away.
    if (isRestrained() && !wanted) {
        return;
    }
    // The character creator holds the camera and the screen (creator-page.ts): the panel does not open over it.
    if (!wanted && typeof Camera !== "undefined" && typeof Camera.isShotActive === "function" && Camera.isShotActive()) {
        return;
    }
    if (which === "admin" && admin !== true) {
        // Not an administrator as far as this client knows: ask, and open on a yes. The answer may have changed since the
        // last one (`/admin` after joining), which is why F3 used to open only after F2 had asked first.
        if (!wanted) {
            adminAsked = true;
            askServer();
        }
        return;
    }
    lastToggleAt = now;
    heldKey = keyOf[which];

    if (wanted && mode === which) {
        hide();
        return;
    }
    mode = which;
    if (wanted) {
        if (view >= 0 && pageReady) {
            Web.emit(view, "status:mode", { mode });
        }
        return;
    }
    open();
}

/** Whether the server's description says administrator: an object, or the JSON of one. */
function characterNameIn(payload: unknown): string {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return characterName;
        }
    }
    const given = typeof value === "object" && value !== null ? (value as { characterName?: unknown }).characterName : undefined;
    return typeof given === "string" ? given.slice(0, 60) : characterName;
}

function roleIsAdmin(payload: unknown): boolean | null {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return null;
        }
    }
    const role = typeof value === "object" && value !== null ? (value as Record<string, unknown>).role : undefined;
    return role === "admin" ? true : role === "player" ? false : null;
}

/** The language the server says the player chose, and the pieces of the English dictionary of the page that have come. */
let language = "pt";
let dictAsked = false;
let dictParts: unknown[][] = [];

function langIn(payload: unknown): string | null {
    const value = typeof payload === "string" ? (JSON.parse(payload) as unknown) : payload;
    const lang = typeof value === "object" && value !== null ? (value as { lang?: unknown }).lang : undefined;
    return lang === "en" ? "en" : lang === "pt" ? "pt" : null;
}

/** The name a picture the server sent goes by: each is kept apart, so a page opened again gets every one the panel has had. */
function imageName(payload: unknown): string {
    try {
        const value = typeof payload === "string" ? (JSON.parse(payload) as unknown) : payload;
        const name = typeof value === "object" && value !== null ? (value as { name?: unknown }).name : undefined;
        return typeof name === "string" ? name.slice(0, 40) : "";
    } catch {
        return "";
    }
}

function keep(channel: string, payload: unknown): void {
    if (KEPT_MESSAGES.includes(channel)) {
        latest.set(channel === "status:image" ? `status:image:${imageName(payload)}` : channel, payload);
    }
    if (view >= 0 && pageReady) {
        Web.emit(view, channel, payload);
    }
}

export function installStatus(): void {
    for (const which of ["common", "admin"] as const) {
        for (const name of KEY_CHOICES[which]) {
            try {
                Key.bind(name, "down", () => toggle(which));
                Key.bind(name, "up", focusAfterRelease);
                keyOf[which] = name;
                break;
            } catch (thrown: unknown) {
                // The mod does not know this key name (see KEY_CHOICES): the next one, if any, is tried.
                Key.unbind(name);
                console.log(`status panel: the key '${name}' was refused: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
            }
        }
    }

    onLarge("status.social", (payload) => {
        keep("status:social", payload);
        // English: the server sends the page's dictionary once (a piece at a time); back to Portuguese: it is dropped.
        let lang: string | null = null;
        try {
            lang = langIn(payload);
        } catch {
            lang = null;
        }
        if (lang !== null && lang !== language) {
            language = lang;
            dictAsked = false;
            if (lang === "pt") {
                latest.delete("status:dict");
            }
        }
        if (language === "en" && !dictAsked && !latest.has("status:dict")) {
            dictAsked = true;
            Events.emitServer(`${RESOURCE}:status.dict`);
        }
        admin = roleIsAdmin(payload) ?? admin;
        characterName = characterNameIn(payload);
        pushSelf();
        if (admin !== true && mode === "admin") {
            mode = "common";
        }
        if (adminAsked) {
            adminAsked = false;
            if (admin === true && !wanted) {
                mode = "admin";
                heldKey = "";
                open();
            }
        }
    });
    // Asked by the free camera's page when it is left by F2 or F3: the panel comes up on that door.
    Events.onLocal("status.open", (payload) => {
        const next = typeof payload === "object" && payload !== null ? (payload as { mode?: unknown }).mode : undefined;
        // Up already: the key reached the panel by its own way as well, and a second opening would only blink it.
        if (wanted || isRestrained() || (next !== "common" && next !== "admin") || (next === "admin" && admin !== true)) {
            return;
        }
        mode = next;
        heldKey = "";
        lastToggleAt = Date.now();
        open();
    });
    Events.on(`${RESOURCE}:status.dict`, (payload) => {
        const part = typeof payload === "string" ? (JSON.parse(payload) as { part?: number; parts?: number; items?: unknown[] }) : (payload as { part?: number; parts?: number; items?: unknown[] });
        if (typeof part.part !== "number" || typeof part.parts !== "number" || !Array.isArray(part.items)) {
            return;
        }
        dictParts[part.part] = part.items;
        if (dictParts.filter((one) => one !== undefined).length === part.parts) {
            const items: unknown[] = [];
            dictParts.forEach((one) => items.push(...one));
            dictParts = [];
            keep("status:dict", { items });
        }
    });
    Events.on(`${RESOURCE}:status.roster`, (payload) => keep("status:roster", payload));
    Events.on(`${RESOURCE}:status.guildMembers`, (payload) => keep("status:guildMembers", payload));
    // The letters' lists and a letter's text may be long (`emitLarge`); the courier's time and the answer to a letter sent are short.
    onLarge("status.letters", (payload) => keep("status:letters", payload));
    onLarge("status.letter", (payload) => keep("status:letter", payload));
    Events.on(`${RESOURCE}:status.letterQuote`, (payload) => keep("status:letterQuote", payload));
    Events.on(`${RESOURCE}:status.letterResult`, (payload) => keep("status:letterResult", payload));
    Events.on(`${RESOURCE}:status.notice`, (payload) => keep("status:notice", payload));
    Events.on(`${RESOURCE}:status.animals`, (payload) => keep("status:animals", payload));
    // The hierarchy is asked for while its page is open and is not kept: it goes stale in seconds.
    onLarge("status.hierarchy", (payload) => keep("status:hierarchy", payload));
    onLarge("status.npcs", (payload) => keep("status:npcs", payload));
    onLarge("status.image", (payload) => keep("status:image", payload));
    Events.onLocal("camera.state", (payload) => keep("status:options", payload));
    Events.onLocal("voice.state", (payload) => keep("status:voice", payload));

    Events.on("browserLoadingFailed", (event) => {
        if (event.isMainFrame && view >= 0 && event.viewId === view) {
            console.error(`status page failed to load: ${event.description} (${event.errorCode}) at ${event.url}`);
            wanted = false;
            focusOnRelease = false;
            destroy();
        }
    });

    const timer = setInterval(() => {
        // In case the release of the key came while something else held the keyboard and was never seen.
        focusAfterRelease();
        if (wanted && pageReady) {
            pushSelf();
        }
    }, SAMPLE_MS);

    Events.on("resourceStop", (resourceName) => {
        if (resourceName === RESOURCE) {
            clearInterval(timer);
            if (view >= 0) {
                Web.destroyView(view);
                view = -1;
            }
        }
    });

    console.log(keyOf.common === "" ? "status panel: no key could be bound, the panel cannot be opened" : `status panel armed; '${keyOf.common}' for everybody, '${keyOf.admin || "nothing"}' for administrators`);

    // Once the player is in the world, say which key opens the panel.
    const hinted = setInterval(() => {
        if (LocalPlayer?.ready) {
            clearInterval(hinted);
            if (keyOf.common !== "") {
                const key = KEY_INFO[keyOf.common]?.name ?? keyOf.common;
                Hud.showNotification(language === "en" ? `Press ${key} to open your panel.` : `Aperte ${key} para abrir o seu painel.`);
            }
        }
    }, 1000);
}
