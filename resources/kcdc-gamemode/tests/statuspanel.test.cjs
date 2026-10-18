const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** `refuse`: key names the fake Key.bind throws on, the way the mod does for a name it does not know. */
function load({ refuse = [] } = {}) {
    const log = [];
    const state = {
        now: 1_000_000,
        timers: new Map(),
        timeouts: [],
        nextTimer: 1,
        nextView: 7,
        created: [],
        pageHandlers: new Map(),
        emitted: [],
        payloads: [],
        server: [],
        sent: [],
        visible: false,
        uDown: false,
        local: { ready: true },
        bound: [],
        unbound: [],
        held: "",
        shot: false,
        localEvents: [],
        notified: [],
        logs: [],
    };
    const events = new Map();
    const locals = new Map();
    const keys = new Map();

    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line), error: (line) => log.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn) => {
            const id = state.nextTimer++;
            state.timers.set(id, fn);
            return id;
        },
        clearInterval: (id) => state.timers.delete(id),
        setTimeout: (fn) => state.timeouts.push(fn),
        Key: {
            bind: (key, phase, fn) => {
                if (refuse.includes(key)) throw new Error(`unknown key '${key}'`);
                keys.set(`${key}:${phase}`, fn);
                if (!state.bound.includes(key)) state.bound.push(key);
            },
            unbind: (key) => { state.unbound.push(key); return false; },
            isDown: (key) => key === state.held && state.uDown,
        },
        Hud: { showNotification: (text) => { state.notified.push(text); return true; } },
        Camera: { isShotActive: () => state.shot },
        Events: {
            on: (name, fn) => events.set(name, fn),
            onLocal: (name, fn) => locals.set(name, fn),
            emitLocal: (name, payload) => { state.localEvents.push({ name, payload }); return Promise.resolve(); },
            emitServer: (name, payload) => { state.server.push(name); state.sent.push({ name, payload }); },
        },
        get LocalPlayer() { return state.local; },
        Web: {
            getScreenSize: () => ({ width: 1920, height: 1080 }),
            createView: (page, options) => {
                const id = state.nextView++;
                state.created.push({ id, page, options });
                state.pageHandlers = new Map();
                return id;
            },
            on: (view, name, fn) => state.pageHandlers.set(name, fn),
            showView: () => { state.visible = true; log.push("show"); },
            hideView: () => { state.visible = false; log.push("hide"); },
            focusView: (view, on) => log.push(`focus:${on}`),
            emit: (view, channel, payload) => {
                state.emitted.push(channel);
                state.payloads.push({ channel, payload });
            },
            destroyView: (view) => log.push(`destroy:${view}`),
            isViewVisible: () => state.visible,
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/status.js"), "utf8"), context);
    context.exports.installStatus();

    const tick = (ms) => {
        for (let spent = 0; spent < ms; spent += 500) {
            state.now += 500;
            for (const fn of [...state.timers.values()]) fn();
        }
    };
    const flush = () => {
        const due = state.timeouts.splice(0);
        for (const fn of due) fn();
    };
    // Advances the mock clock past the 250ms debounce before each press by default, so a test calling
    // press() more than once gets a genuine toggle each time; pass 0 to test the debounce itself.
    const press = (advanceMs = 300, key = state.bound[0]) => {
        state.now += advanceMs;
        state.held = key;
        keys.get(`${key}:down`)();
    };
    /** The administrator's door: the second key bound. */
    const pressAdmin = (advanceMs = 300) => press(advanceMs, state.bound[1]);
    const release = () => {
        state.uDown = false;
        keys.get(`${state.held}:up`)();
    };
    const social = (payload) => events.get("kcdc-gamemode:status.social")(payload);
    const page = (name, payload) => state.pageHandlers.get(name)(payload);
    const localNames = () => state.localEvents.map((entry) => entry.name);
    return { state, log, events, locals, localNames, press, pressAdmin, release, social, tick, flush, page, pageReady: () => page("status:ready") };
}

test("the first press makes a hidden full-screen view and shows it only when the page has drawn", () => {
    const { state, log, press, pageReady } = load();
    press();

    assert.equal(state.created.length, 1);
    assert.equal(state.created[0].options.visible, false);
    assert.equal(state.created[0].options.width, 1920);
    assert.equal(state.created[0].options.height, 1080);
    assert.equal(state.created[0].options.x, 0);
    assert.equal(state.created[0].options.y, 0);
    assert.ok(!log.includes("show"), "nothing is on screen while the page loads");

    pageReady();
    assert.deepEqual(log.filter((entry) => entry === "show" || entry.startsWith("focus")), ["show", "focus:true"]);
    assert.ok(state.emitted.includes("status:shown"));
    assert.ok(state.server.includes("kcdc-gamemode:status.poll"));
});

test("the panel does not open over the character creator, which holds the camera; it opens again once the shot is over", () => {
    const { state, press, pressAdmin } = load();
    state.shot = true;
    press();
    pressAdmin();
    assert.equal(state.created.length, 0, "no view while the creator films the player");
    state.shot = false;
    press();
    assert.equal(state.created.length, 1);
});

test("the panel's own name is the one the player gave the character, and the account's nickname for a character made before the names", () => {
    const { state, press, pageReady, social } = load();
    state.local = { ready: true, nickname: "Mauro", health: 70, maxHealth: 100, stamina: 50, maxStamina: 100, hunger: 60, maxHunger: 100, exhaust: 20, maxExhaust: 100 };
    social({ role: "player", characterName: "Henry II" });
    press();
    pageReady();
    const selfNames = () => state.payloads.filter((entry) => entry.channel === "status:self").map((entry) => entry.payload.name);
    assert.deepEqual(selfNames(), ["Henry II"]);
    social({ role: "player", characterName: "Henry III" });
    assert.equal(selfNames().at(-1), "Henry III", "a new answer is pushed to the open page at once");
    social({ role: "player", characterName: "" });
    assert.equal(selfNames().at(-1), "Mauro", "no name given: the nickname");
    social({ role: "player" });
    assert.equal(selfNames().at(-1), "Mauro", "an answer without it changes nothing");
    social({ role: "player", characterName: 42 });
    assert.equal(selfNames().at(-1), "Mauro");
});

test("nothing is made before the first press, however long the player has been in the world", () => {
    const { state, tick } = load();
    tick(120_000);
    assert.equal(state.created.length, 0);
});

test("closing throws the view away, and the next press makes a fresh one", () => {
    const { state, log, press, flush, pageReady } = load();
    press();
    pageReady();

    press();
    assert.deepEqual(log.slice(-2), ["focus:false", "hide"]);
    assert.equal(state.visible, false);
    flush();
    assert.ok(log.includes("destroy:7"), "the closed panel keeps no browser");

    log.length = 0;
    press();
    assert.equal(state.created.length, 2);
    assert.ok(!log.includes("show"), "the new page is hidden until it has drawn");
    pageReady();
    assert.deepEqual(log, ["show", "focus:true"]);
});

test("the browser is destroyed on the next tick, not inside the page's own close event", () => {
    const { log, press, flush, page, pageReady } = load();
    press();
    pageReady();

    page("status:close");
    assert.ok(!log.some((entry) => entry.startsWith("destroy")), "not while the page's event is still running");
    flush();
    assert.ok(log.includes("destroy:7"));
});

test("a second press while the page is still loading cancels the opening and drops the view", () => {
    const { log, press, flush, pageReady } = load();
    press();
    press();
    flush();
    assert.ok(log.includes("destroy:7"));
    pageReady();
    assert.ok(!log.includes("show"), "a late ready from the dropped page shows nothing");
});

test("the page's own close button hides the panel", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    page("status:close");
    assert.equal(state.visible, false);
});

test("a page that fails to load is dropped, and the next press tries a new view", () => {
    const { state, log, events, press, flush } = load();
    press();
    events.get("browserLoadingFailed")({ isMainFrame: true, viewId: 7, description: "net::ERR", errorCode: -6, url: "fw://x" });
    flush();
    assert.ok(log.includes("destroy:7"));

    press();
    assert.equal(state.created.length, 2);
});

test("while the key that opened the panel is still held, the page is shown but does not get the keyboard", () => {
    const { state, log, press, release, pageReady } = load();
    state.uDown = true;
    press();
    pageReady();
    assert.ok(log.includes("show"));
    assert.ok(!log.includes("focus:true"), "the page would read the same press as the key pressed again and close");

    release();
    assert.deepEqual(log.filter((entry) => entry.startsWith("focus")), ["focus:true"]);
});

test("the keyboard still reaches the page when the release of the key was never seen", () => {
    const { state, log, press, tick, pageReady } = load();
    state.uDown = true;
    press();
    pageReady();
    assert.ok(!log.includes("focus:true"));

    state.uDown = false;
    tick(500);
    assert.ok(log.includes("focus:true"));
});

test("a press while the panel waits for the release does not close it", () => {
    const { state, log, press, pageReady } = load();
    state.uDown = true;
    press();
    pageReady();

    press();
    assert.equal(state.visible, true);
    assert.ok(!log.includes("hide"));
});

test("a second press within 250ms of the first is dropped, so one physical press cannot blink the panel", () => {
    const { state, log, press, pageReady } = load();
    press();
    pageReady();

    log.length = 0;
    press(100);
    assert.deepEqual(log, [], "too soon after the open to register");
    assert.equal(state.visible, true);

    press(0);
    assert.deepEqual(log, [], "still too soon");
    assert.equal(state.visible, true);

    press(160);
    assert.ok(log.includes("hide"), "250ms after the open, a press closes it");
    assert.equal(state.visible, false);
});

test("a press just after the page closed itself is the same press, not a new opening", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();

    state.now += 5000;
    page("status:close");
    press(50);
    assert.equal(state.created.length, 1, "the panel does not come straight back");

    press(300);
    assert.equal(state.created.length, 2);
});

test("a new page gets the server's last answers, then its door, then the section it was on, before it is shown", () => {
    const { state, events, press, page, flush, pageReady } = load();
    press();
    pageReady();
    events.get("kcdc-gamemode:status.social")({ guildId: "venatores" });
    events.get("kcdc-gamemode:status.roster")({ players: [] });
    events.get("kcdc-gamemode:status.notice")({ text: "só agora" });
    events.get("kcdc-gamemode:status.dict")({ part: 0, parts: 1, items: [[0, "Fechar", "Close"]] });
    page("status:tab", { tab: "supporter" });

    press();
    flush();
    press();
    state.emitted.length = 0;
    state.payloads.length = 0;
    pageReady();

    // The player lists are of their moment (a page of what was asked): only the social answer and the dictionary are kept.
    assert.deepEqual(state.emitted.slice(0, 6), ["status:key", "status:social", "status:dict", "status:mode", "status:tab", "status:shown"]);
    assert.deepEqual({ ...state.payloads[1].payload }, { guildId: "venatores" });
    assert.deepEqual(JSON.parse(JSON.stringify(state.payloads[2].payload)), { items: [[0, "Fechar", "Close"]] });
    assert.deepEqual({ ...state.payloads[4].payload }, { tab: "supporter" });
    assert.ok(!state.emitted.includes("status:notice"), "a notice is of its moment and is not replayed");
});

test("a section name that is not a plain word is not remembered", () => {
    const { state, press, page, flush, pageReady } = load();
    press();
    pageReady();
    page("status:tab", { tab: "players" });
    page("status:tab", { tab: "x\"]; alert(1)" });
    page("status:tab", { tab: 7 });

    press();
    flush();
    press();
    state.payloads.length = 0;
    pageReady();
    const tab = state.payloads.find((entry) => entry.channel === "status:tab");
    assert.deepEqual({ ...tab.payload }, { tab: "players" });
});

test("the page's guild, faction and showcase choices reach the server as the strings it chose", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    page("status:selectGuild", { guildId: "venatores" });
    page("status:selectFaction", { factionId: "corvo" });
    page("status:selectShowcase", { showcase: "faction" });

    assert.deepEqual(state.sent, [
        { name: "kcdc-gamemode:status.selectGuild", payload: JSON.stringify({ guildId: "venatores" }) },
        { name: "kcdc-gamemode:status.selectFaction", payload: JSON.stringify({ factionId: "corvo" }) },
        { name: "kcdc-gamemode:status.selectShowcase", payload: JSON.stringify({ showcase: "faction" }) },
    ]);
});

test("a choice that is not a string never reaches the server", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    for (const name of ["status:selectGuild", "status:selectFaction", "status:selectShowcase"]) {
        page(name, null);
        page(name, "corvo");
        page(name, {});
        page(name, { guildId: 7, factionId: 7, showcase: 7 });
    }
    assert.deepEqual(state.sent, []);
});

test("a relative the page adds reaches the server with only the fields that belong to it", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    page("status:familyAdd", { relation: "prima", name: "Anezka", degree: 2, injected: "<script>" });
    page("status:familyAdd", { relation: "avo", name: "Wenzel" });

    assert.deepEqual(state.sent, [
        { name: "kcdc-gamemode:status.familyAdd", payload: JSON.stringify({ relation: "prima", name: "Anezka", degree: 2 }) },
        { name: "kcdc-gamemode:status.familyAdd", payload: JSON.stringify({ relation: "avo", name: "Wenzel" }) },
    ]);
});

test("a relative with a field of the wrong kind never leaves the client", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    page("status:familyAdd", { relation: "primo", name: "Vaclav", degree: "2" });
    page("status:familyAdd", { relation: "primo", name: "Vaclav", degree: Infinity });
    page("status:familyAdd", { relation: 7, name: "Vaclav" });
    page("status:familyAdd", { relation: "pai" });
    page("status:familyAdd", { name: "Hans" });
    page("status:familyAdd", null);
    page("status:familyAdd", "pai");

    assert.deepEqual(state.sent, []);
});

test("removing a relative and setting a surname reach the server, an empty surname included", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    page("status:familyRemove", { id: "p3" });
    page("status:familyRemove", { id: 3 });
    page("status:familySurname", { surname: "Capon" });
    page("status:familySurname", { surname: "" });
    page("status:familySurname", { surname: null });

    assert.deepEqual(state.sent, [
        { name: "kcdc-gamemode:status.familyRemove", payload: JSON.stringify({ id: "p3" }) },
        { name: "kcdc-gamemode:status.familySurname", payload: JSON.stringify({ surname: "Capon" }) },
        { name: "kcdc-gamemode:status.familySurname", payload: JSON.stringify({ surname: "" }) },
    ]);
});

test("the nominations, the doors, a property given on and a region ceded reach the server with only their own fields", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    page("status:nominate", { targetId: 4, title: "cavaleiro", injected: "<script>" });
    page("status:revokeTitle", { key: "h1a2b", title: "escudeiro" });
    page("status:revokeTitle", { self: 1, title: "burgrave" });
    page("status:revokeTitle", { targetId: 9, title: "burgrave", extra: 1 });
    page("status:shownTitle", { title: "" });
    page("status:hierarchy", {});
    page("status:doorLock", { id: "casa-03", index: 2, locked: 1 });
    page("status:propGive", { id: "casa-03", targetId: 6 });
    page("status:regionCede", { region: "Suchdol", targetId: 3, confirm: 1 });
    page("status:regionCede", { region: "Wysoka" });

    const byName = (name) => state.sent.filter((entry) => entry.name === name).map((entry) => JSON.parse(entry.payload));
    assert.deepEqual(byName("kcdc-gamemode:status.nominate"), [{ targetId: 4, title: "cavaleiro" }]);
    assert.deepEqual(byName("kcdc-gamemode:status.revokeTitle"), [{ title: "escudeiro", key: "h1a2b" }, { self: 1, title: "burgrave" }, { targetId: 9, title: "burgrave" }]);
    assert.deepEqual(byName("kcdc-gamemode:status.shownTitle"), [{ title: "" }]);
    assert.deepEqual(byName("kcdc-gamemode:status.hierarchy"), [{}]);
    assert.deepEqual(byName("kcdc-gamemode:status.doorLock"), [{ id: "casa-03", index: 2, locked: 1 }]);
    assert.deepEqual(byName("kcdc-gamemode:status.propGive"), [{ id: "casa-03", targetId: 6 }]);
    assert.deepEqual(byName("kcdc-gamemode:status.regionCede"), [{ region: "Suchdol", targetId: 3, confirm: 1 }, { region: "Wysoka" }]);
});

test("a nomination, a door or a cession with a field of the wrong kind never leaves the client", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;

    page("status:nominate", { targetId: "4", title: "cavaleiro" });
    page("status:nominate", { targetId: 4, title: 7 });
    page("status:nominate", { title: "cavaleiro" });
    page("status:revokeTitle", { title: 5 });
    page("status:shownTitle", {});
    page("status:doorLock", { id: "casa", index: "1", locked: 1 });
    page("status:doorLock", { id: "casa", index: 1 });
    page("status:propGive", { id: "casa" });
    page("status:regionCede", { region: 3 });
    page("status:regionCede", { region: "Suchdol", targetId: "x" });
    page("status:nominate", null);
    assert.deepEqual(state.sent, []);
});

test("the hierarchy the server answers goes to the page at once and is not kept for the next one", () => {
    const { state, events, press, pageReady, flush } = load();
    press();
    pageReady();
    state.emitted.length = 0;
    state.payloads.length = 0;
    events.get("kcdc-gamemode:status.hierarchy")({ branches: [], holders: [] });
    assert.deepEqual(state.emitted, ["status:hierarchy"]);

    press();
    flush();
    press();
    state.emitted.length = 0;
    pageReady();
    assert.ok(!state.emitted.includes("status:hierarchy"), "a new page asks for its own");
});

test("a line the server wants the player to read is passed on to the page, and dropped while there is no page", () => {
    const { state, events, press, pageReady } = load();
    const notice = events.get("kcdc-gamemode:status.notice");

    notice({ text: "antes da página" });
    assert.ok(!state.emitted.includes("status:notice"), "no view yet");

    press();
    notice({ text: "página ainda carregando" });
    assert.ok(!state.emitted.includes("status:notice"), "view made, page not ready");

    pageReady();
    notice({ text: "agora sim" });
    assert.ok(state.emitted.includes("status:notice"));
});

test("the panel opens on F2 and the administrator's door is F3: the mod knows no comma or full stop, and the arrows walk", () => {
    const { state, press, pageReady } = load();
    assert.deepEqual(state.bound, ["f2", "f3"]);
    press();
    pageReady();
    assert.equal(state.created.length, 1);
    assert.equal(state.visible, true);
});

test("a key the mod refuses leaves its door shut, clears the half-made binding and says so in the log", () => {
    const { state, tick } = load({ refuse: ["f2", "f3"] });
    assert.deepEqual(state.bound, []);
    assert.ok(state.unbound.includes("f2") && state.unbound.includes("f3"));
    assert.ok(state.logs.some((line) => line.includes("'f2' was refused")));
    assert.ok(state.logs.includes("status panel: no key could be bound, the panel cannot be opened"));
    tick(3000);
    assert.deepEqual(state.notified, [], "no key to tell the player about");
});

test("the page is told which key closes it, before anything else", () => {
    const { state, press, pageReady } = load();
    press();
    pageReady();
    assert.equal(state.emitted[0], "status:key");
    assert.deepEqual({ ...state.payloads[0].payload.common }, { code: "F2", label: "F2", name: "F2" });
    assert.deepEqual({ ...state.payloads[0].payload.admin }, { code: "F3", label: "F3", name: "F3" });
});

test("once the player is in the world, they are told once which key opens the panel", () => {
    const { state, tick } = load();
    state.local = { ready: false };
    tick(3000);
    assert.deepEqual(state.notified, []);

    state.local = { ready: true };
    tick(3000);
    assert.deepEqual(state.notified, ["Aperte F2 para abrir o seu painel."]);
});

test("a camera choice from the Opções section goes to the camera, never straight to the server, and only when well-formed", () => {
    const { state, press, page, pageReady } = load();
    press();
    pageReady();
    state.localEvents.length = 0;
    state.sent.length = 0;

    page("status:option", { thirdPerson: 1, view: "longe" });
    page("status:option", { thirdPerson: 2, view: "longe" });
    page("status:option", { thirdPerson: 1, view: "atrás" });
    page("status:option", { thirdPerson: "1", view: "perto" });
    page("status:option", { view: "perto" });

    assert.deepEqual(state.localEvents.map((entry) => entry.name), ["camera.choose"]);
    assert.deepEqual({ ...state.localEvents[0].payload }, { thirdPerson: 1, view: "longe" });
    assert.deepEqual(state.sent, [], "the camera keeps the choice through the server itself");
});

test("the free camera button closes the panel first, and the flight starts a moment later", () => {
    const { state, log, localNames, press, page, flush, pageReady } = load();
    press();
    pageReady();
    state.localEvents.length = 0;

    page("status:freeCam");
    assert.ok(log.includes("hide"), "the panel goes away at once");
    assert.equal(state.visible, false);
    assert.ok(!localNames().includes("camera.free"), "not while the click is still under way");

    flush();
    assert.ok(localNames().includes("camera.free"));
});

test("the free camera's page, left by F2 or F3, has the panel come up on that door; a player is not given the administrator's", () => {
    const common = load();
    common.locals.get("status.open")({ mode: "common" });
    assert.equal(common.state.created.length, 1);
    common.pageReady();
    assert.equal(common.state.visible, true);
    assert.equal(common.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "common");
    assert.ok(common.localNames().includes("camera.stopFree"), "a panel opened over a flight ends it too");
    assert.ok(common.log.includes("focus:true"), "the key that asked is let go by then: the page has the keyboard at once");

    const admin = load();
    admin.social({ role: "admin" });
    admin.locals.get("status.open")({ mode: "admin" });
    admin.pageReady();
    assert.equal(admin.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "admin");

    const player = load();
    player.social({ role: "player" });
    player.locals.get("status.open")({ mode: "admin" });
    assert.equal(player.state.created.length, 0, "a player is given no administrator's door");
    player.locals.get("status.open")({ mode: "common" });
    assert.equal(player.state.created.length, 1, "but the common one");

    const odd = load();
    for (const payload of [undefined, null, "common", 7, {}, { mode: "root" }, { mode: ["common"] }]) {
        odd.locals.get("status.open")(payload);
    }
    assert.equal(odd.state.created.length, 0, "anything but one of the two doors is no request");
});

test("a request for the panel while it is up already changes nothing: the key reached it by its own way too", () => {
    const sut = load();
    sut.press();
    sut.pageReady();
    const shown = sut.state.emitted.filter((channel) => channel === "status:shown").length;
    const created = sut.state.created.length;

    sut.locals.get("status.open")({ mode: "common" });
    assert.equal(sut.state.created.length, created);
    assert.equal(sut.state.emitted.filter((channel) => channel === "status:shown").length, shown);
    assert.equal(sut.state.visible, true);
});

test("opening the panel ends the free camera, a second way out besides Escape", () => {
    const { localNames, press } = load();
    press();
    assert.ok(localNames().includes("camera.stopFree"));
});

test("the camera's state is kept for the next page, and a page that comes up asks for a fresh one", () => {
    const { state, locals, localNames, press, pageReady } = load();
    locals.get("camera.state")({ thirdPerson: true, view: "perto", flying: false });

    press();
    pageReady();
    const sent = state.payloads.find((entry) => entry.channel === "status:options");
    assert.deepEqual({ ...sent.payload }, { thirdPerson: true, view: "perto", flying: false });
    assert.ok(localNames().includes("camera.ask"));
});

test("F3 opens the administrator's sections for an administrator, and nothing for a player", () => {
    const player = load();
    player.social({ role: "player" });
    player.pressAdmin();
    assert.equal(player.state.created.length, 0, "nothing for a player");

    const admin = load();
    admin.social({ role: "admin" });
    admin.pressAdmin();
    admin.pageReady();
    assert.equal(admin.state.visible, true);
    assert.deepEqual({ ...admin.state.payloads.find((entry) => entry.channel === "status:mode").payload }, { mode: "admin" });
});

test("on F3 the page hears that the player is an administrator before it hears the door, which it would otherwise turn to the common one", () => {
    const sut = load();
    sut.social({ role: "admin" });
    sut.pressAdmin();
    sut.pageReady();
    const order = sut.state.emitted;
    assert.ok(order.includes("status:social") && order.includes("status:mode"), order.join(", "));
    assert.ok(order.indexOf("status:social") < order.indexOf("status:mode"), order.join(", "));
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "admin");
});

test("pressed before the server has said who the player is, F3 asks, and opens on a yes", () => {
    const sut = load();
    sut.pressAdmin();
    assert.equal(sut.state.created.length, 0);
    assert.ok(sut.state.server.includes("kcdc-gamemode:status.poll"), "the server is asked");

    sut.social(JSON.stringify({ role: "admin" }));
    assert.equal(sut.state.created.length, 1, "an administrator: it opens");
    sut.pageReady();
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "admin");

    const other = load();
    other.pressAdmin();
    other.social({ role: "player" });
    assert.equal(other.state.created.length, 0, "a player: nothing");
});

test("F3 asks again when the last answer said player: a player who became an administrator with /admin opens it at once, with no F2 first", () => {
    const sut = load();
    sut.social({ role: "player" });
    const polls = () => sut.state.server.filter((name) => name === "kcdc-gamemode:status.poll").length;

    sut.pressAdmin();
    assert.equal(sut.state.created.length, 0);
    assert.equal(polls(), 1, "the server is asked, not taken at its old word");
    sut.social({ role: "player" });
    assert.equal(sut.state.created.length, 0, "still a player: nothing opens");

    sut.pressAdmin();
    sut.social({ role: "admin" });
    assert.equal(sut.state.created.length, 1, "an administrator now: the panel opens on F3");
    sut.pageReady();
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "admin");
});

test("the key of the door the panel is on closes it; each door remembers its own section", () => {
    const sut = load();
    sut.social({ role: "admin" });
    sut.pressAdmin();
    sut.pageReady();
    sut.page("status:tab", { tab: "players" });
    sut.pressAdmin();
    assert.equal(sut.state.visible, false, "the same key closes it");
    sut.flush();

    sut.press();
    sut.state.payloads.length = 0;
    sut.pageReady();
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "common");
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:tab"), undefined, "the common door was never on a section");
    sut.page("status:tab", { tab: "family" });
    sut.press();
    sut.flush();

    sut.pressAdmin();
    sut.state.payloads.length = 0;
    sut.pageReady();
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:tab").payload.tab, "players", "back where it was");
});

test("the page turning to the administrator's door is believed only for an administrator", () => {
    const sut = load();
    sut.social({ role: "player" });
    sut.press();
    sut.pageReady();
    sut.page("status:mode", { mode: "admin" });
    sut.page("status:tab", { tab: "keys" });
    sut.press();
    sut.flush();
    sut.press();
    sut.state.payloads.length = 0;
    sut.pageReady();
    assert.equal(sut.state.payloads.find((entry) => entry.channel === "status:mode").payload.mode, "common");
});

test("an English player's page is sent its dictionary, once, in the pieces the server cuts it in; back to Portuguese drops it", () => {
    const { state, events, press, pageReady } = load();
    press();
    pageReady();
    state.sent.length = 0;
    events.get("kcdc-gamemode:status.social")({ lang: "en" });
    assert.deepEqual(state.sent.map((one) => one.name), ["kcdc-gamemode:status.dict"]);
    events.get("kcdc-gamemode:status.social")({ lang: "en" });
    assert.equal(state.sent.length, 1, "asked once");

    state.emitted.length = 0;
    events.get("kcdc-gamemode:status.dict")({ part: 1, parts: 2, items: [[1, "^a$", "b"]] });
    assert.ok(!state.emitted.includes("status:dict"), "not until every piece is here");
    events.get("kcdc-gamemode:status.dict")({ part: 0, parts: 2, items: [[0, "Fechar", "Close"]] });
    assert.ok(state.emitted.includes("status:dict"));

    events.get("kcdc-gamemode:status.social")({ lang: "pt" });
    state.sent.length = 0;
    events.get("kcdc-gamemode:status.social")({ lang: "en" });
    assert.equal(state.sent.length, 1, "after a change of language the dictionary is asked for again");
});
