"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The notice boards' page on the player's machine (src/client/mural.ts, 2026-10-24), over fakes of the framework: it is made when the server sends a
// board, shown once it has drawn, closed by its own button, by the server and by a death, and a board sent a moment after it was put away does not bring
// it back.

const PAGE = "fw://resources/kcdc-gamemode/ui/mural.html";
const PUBLISH = "kcdc-gamemode:mural.publish";
const REMOVE = "kcdc-gamemode:mural.remove";
const CLOSED = "kcdc-gamemode:mural.closed";
const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
    const state = {
        now: 1_000_000, me: { ready: true, alive: true }, screen: { width: 1920, height: 1080 },
        views: [], emitted: [], shown: [], hidden: [], focused: [], destroyed: [], sent: [], logs: [], errors: [], createFails: false, resized: [],
    };
    const events = new Map();
    const page = new Map();
    const large = new Map();
    const intervals = [];
    const context = {
        exports: {},
        require: (id) => ({ "./big-events.js": { onLarge: (name, fn) => large.set(name, fn) }, "./ui-scale.js": { scaleView() {}, onUiScale() {}, uiFactor: () => 1, installUiScale() {} } })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line), error: (line) => state.errors.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Web: {
            getScreenSize: () => state.screen,
            createView: (url, options) => {
                if (state.createFails) throw new Error("no browser");
                state.views.push({ url, options: plain(options) });
                return state.views.length;
            },
            on: (view, name, fn) => page.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => { state.emitted.push({ view, name, payload: plain(payload ?? null) }); return true; },
            showView: (view) => { state.shown.push(view); return true; },
            hideView: (view) => { state.hidden.push(view); return true; },
            focusView: (view, on) => { state.focused.push([view, on]); return true; },
            destroyView: (view) => { state.destroyed.push(view); return true; },
            resizeView: (view, width, height) => { state.resized.push([view, width, height]); return true; },
        },
        Events: { on: (name, fn) => events.set(name, fn), emitServer: (name, payload) => state.sent.push({ name, payload: payload === undefined ? undefined : JSON.parse(payload) }) },
        get LocalPlayer() { return state.me; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/mural.js"), "utf8"), context);
    context.exports.installMural();
    const tick = (advance = 500) => { state.now += advance; intervals[0].fn(); };
    const board = (payload) => large.get("mural.view")(payload);
    const art = (payload) => large.get("mural.art")(payload);
    const fromPage = (name, payload, view = 1) => page.get(`${view}:${name}`)?.(payload);
    const fromServer = (name, payload) => events.get(name)(payload === undefined ? undefined : JSON.stringify(payload));
    const names = () => state.emitted.map((entry) => entry.name);
    return { api: context.exports, state, tick, board, art, fromPage, fromServer, events, names };
}

const VIEW = { board: { id: "suchdol", name: "Suchdol" }, posters: [], fee: 10 };

test("nothing is made until the server sends a board; then the page is made hidden over the screen, and shown, with the board, once it has drawn", () => {
    const sut = load();
    sut.tick();
    assert.equal(sut.state.views.length, 0);

    sut.board(JSON.stringify(VIEW));
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, PAGE);
    assert.deepEqual(sut.state.views[0].options, { width: 1920, height: 1080, x: 0, y: 0, zIndex: 100, visible: false, focus: false });
    assert.deepEqual(sut.state.shown, [], "not before it has drawn");
    assert.equal(sut.api.muralOpen(), false);

    sut.fromPage("mural:ready");
    assert.deepEqual(sut.names(), ["mural:view", "mural:open"], "the board first, then the page is told it is opened afresh");
    assert.deepEqual(plain(sut.state.emitted[0].payload), VIEW);
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.state.focused, [[1, true]], "the keyboard and the mouse go to the page");
    assert.deepEqual(sut.state.resized, [[1, 1920, 1080]]);
    assert.equal(sut.api.muralOpen(), true);
});

test("the pictures are kept and given to the page whenever it is made; the client says it has them", () => {
    const sut = load();
    assert.equal(sut.api.muralHasArt(), false);
    sut.art({ mural: "data:image/webp;base64,M", avisos: "data:image/webp;base64,A" });
    assert.equal(sut.api.muralHasArt(), true);
    sut.board(VIEW);
    sut.fromPage("mural:ready");
    assert.deepEqual(sut.names(), ["mural:art", "mural:view", "mural:open"], "the pictures go in first");
    assert.deepEqual(plain(sut.state.emitted[0].payload), { mural: "data:image/webp;base64,M", avisos: "data:image/webp;base64,A" });

    // A second batch of pictures reaches the page that is already there.
    sut.art({ mural: "data:image/webp;base64,N" });
    assert.equal(sut.state.emitted.at(-1).name, "mural:art");
    assert.deepEqual(plain(sut.state.emitted.at(-1).payload), { mural: "data:image/webp;base64,N" });

    // A page that is thrown away takes the pictures with it, and the server is asked for them again.
    sut.events.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.api.muralHasArt(), false);
});

test("the page's requests go to the server as they are, the board changing under it is handed over without a second opening, and its own button closes it, once", () => {
    const sut = load();
    sut.board(VIEW);
    sut.fromPage("mural:ready");
    sut.state.emitted.length = 0;

    sut.fromPage("mural:publish", { board: "suchdol", category: "avisos", title: "T", body: "Um texto bom.", anonymous: true, style: { font: "bohemia" } });
    sut.fromPage("mural:remove", { id: "abc", extra: "dropped" });
    sut.fromPage("mural:publish", "not an object");
    assert.deepEqual(plain(sut.state.sent), [
        { name: PUBLISH, payload: { board: "suchdol", category: "avisos", title: "T", body: "Um texto bom.", anonymous: true, style: { font: "bohemia" } } },
        { name: REMOVE, payload: { id: "abc" } },
    ]);

    // Somebody else puts a letter up: the page gets the new list, and is not shown or focused again.
    sut.board({ ...VIEW, posters: [{ id: "n1" }] });
    assert.deepEqual(sut.names(), ["mural:view"]);
    assert.equal(sut.state.shown.length, 1);
    assert.equal(sut.state.focused.length, 1);

    // The answer to its request.
    sut.fromServer("kcdc-gamemode:mural.result", { what: "publish", ok: true, message: "Cartaz afixado.", id: "n1" });
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { view: 1, name: "mural:result", payload: { what: "publish", ok: true, message: "Cartaz afixado.", id: "n1" } });

    sut.fromPage("mural:close");
    assert.deepEqual(sut.state.hidden, [1]);
    assert.deepEqual(sut.state.focused.at(-1), [1, false]);
    assert.equal(sut.api.muralOpen(), false);
    assert.equal(sut.state.sent.filter((entry) => entry.name === CLOSED).length, 1, "the server is told the page is shut");
    sut.fromPage("mural:close");
    assert.equal(sut.state.sent.filter((entry) => entry.name === CLOSED).length, 1, "and not twice");
});

test("a board that was on its way when the page was put away does not bring it back; one the player asked for does", () => {
    const sut = load();
    sut.board(VIEW);
    sut.fromPage("mural:ready");
    sut.fromPage("mural:close");
    assert.equal(sut.state.shown.length, 1);

    sut.state.now += 300;
    sut.board(VIEW);
    assert.equal(sut.state.shown.length, 1, "ignored: a refresh that crossed the closing");
    assert.equal(sut.api.muralOpen(), false);

    // The prompt pressed again (cook-hint.ts): the next board is wanted.
    sut.api.muralPressed();
    sut.board(VIEW);
    assert.equal(sut.state.shown.length, 2);
    assert.equal(sut.api.muralOpen(), true);
    assert.equal(sut.state.views.length, 1, "the same page, kept");

    // Or the window passes.
    sut.fromPage("mural:close");
    sut.state.now += 900;
    sut.board(VIEW);
    assert.equal(sut.state.shown.length, 3);
});

test("the server's close (the player walked away) puts the page away without telling the server; a death does and tells it", () => {
    const sut = load();
    sut.board(VIEW);
    sut.fromPage("mural:ready");
    sut.fromServer("kcdc-gamemode:mural.close", {});
    assert.deepEqual(sut.state.hidden, [1]);
    assert.equal(sut.api.muralOpen(), false);
    assert.deepEqual(sut.state.sent, []);

    sut.api.muralPressed();
    sut.board(VIEW);
    assert.equal(sut.api.muralOpen(), true);
    sut.state.me = { ready: true, alive: false };
    sut.tick();
    assert.equal(sut.api.muralOpen(), false);
    assert.deepEqual(plain(sut.state.sent), [{ name: CLOSED }]);
});

test("a page that cannot be made, does not load or never answers is given up on, and the next press tries again", () => {
    const refused = load();
    refused.state.createFails = true;
    refused.board(VIEW);
    assert.equal(refused.state.views.length, 0);
    assert.match(refused.state.errors[0], /não abriu/);
    refused.state.createFails = false;
    refused.api.muralPressed();
    refused.board(VIEW);
    assert.equal(refused.state.views.length, 1);

    const lost = load();
    lost.art({ mural: "x" });
    lost.board(VIEW);
    lost.events.get("browserLoadingFailed")({ isMainFrame: false, viewId: 1, description: "a frame" });
    assert.deepEqual(lost.state.destroyed, []);
    lost.events.get("browserLoadingFailed")({ isMainFrame: true, viewId: 1, description: "net::ERR_FILE_NOT_FOUND" });
    assert.deepEqual(lost.state.destroyed, [1]);
    assert.equal(lost.api.muralHasArt(), false, "the page that held the pictures is gone");
    assert.match(lost.state.errors.at(-1), /não carregou/);

    const silent = load();
    silent.board(VIEW);
    silent.tick(14_000);
    assert.deepEqual(silent.state.destroyed, []);
    silent.tick(2_000);
    assert.deepEqual(silent.state.destroyed, [1]);
    assert.match(silent.state.errors.at(-1), /não respondeu/);
    silent.tick();
    assert.equal(silent.state.views.length, 1, "no second try by itself");
});

test("garbage from the server is let be", () => {
    const sut = load();
    sut.board("not json");
    sut.board(null);
    sut.art("{broken");
    sut.fromServer("kcdc-gamemode:mural.result", "nope");
    assert.equal(sut.state.views.length, 0);
    assert.equal(sut.api.muralHasArt(), false);
    assert.deepEqual(sut.state.errors, []);
});
