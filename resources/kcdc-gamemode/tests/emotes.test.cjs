"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { lowered, torch } = require("./torchstub.cjs");

// The gestures on G (src/server/emotes.ts, ui-src/emotes.html): the game's six and ours, in seven groups (user, 2026-10-20: "uma roda de emotes e não
// quadrado ... mais emotes"; 2026-10-26: "mais emotes, exemplo usar lampião ou levantar estandarte e coisas do tipo que o jogo deve ter").

const PROPS = ["lamp_tool", "lamp_toolFancy", "oblehaniSuchdole_flag", "torch_tool"];

/**
 * `rows`: the catalog, by fragment, as `Animations.list` answers it: when it is not given, the game has every way the wheel names, for both
 * bodies. `only` makes a way a man's or a woman's alone; `props` are the names `Animations.props()` knows.
 */
function load({ rows = null, only = {}, sitting = [], props = PROPS, store = {} } = {}) {
    const state = { logs: [], chat: [], handlers: new Map(), client: new Map(), timers: [], intervals: [], lights: [], lightRefuses: false, bodies: new Map(), now: 1_000_000, written: [], disk: store };
    const catalog = new Map();
    const context = {
        exports: {},
        Math,
        JSON,
        Date: { now: () => state.now },
        setTimeout: (fn, ms) => state.timers.push({ fn, ms }),
        setInterval: (fn, ms) => state.intervals.push({ fn, ms }),
        Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        Player: { getById: (id) => state.bodies.get(id) ?? null, all: () => [...state.bodies.values()] },
        // A replicated point light, as the game has it: made with a place and its looks, moved by assigning its position, put out by destroy().
        Light: {
            spawn: (position, options) => {
                if (state.lightRefuses) throw new Error("no light");
                const light = { position: { ...position }, options: JSON.parse(JSON.stringify(options)), destroyed: false, destroy() { this.destroyed = true; } };
                state.lights.push(light);
                return light;
            },
        },
        console: { log: (line) => state.logs.push(line) },
        Chat: { sendToPlayer: (player, text) => state.chat.push([player.id, text]) },
        Animations: {
            list: (name) => catalog.get(name.toLowerCase()) ?? [],
            props: () => props.map((name) => ({ name })),
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        require: (id) => {
            if (id === "./furniture.js") return { sessionOf: (playerId) => (sitting.includes(playerId) ? { phase: "on" } : null) };
            if (id === "./torch-down.js") return torch;
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: () => (state.disk.off === undefined ? { status: "missing" } : { status: "ok", value: state.disk, fromBackup: false }),
                    write: (file, value) => {
                        state.written.push([file, JSON.parse(JSON.stringify(value))]);
                        state.disk = JSON.parse(JSON.stringify(value));
                    },
                };
            }
            return assert.fail(`unexpected require ${id}`);
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/emotes.js"), "utf8"), context);
    // The game's catalog of the ways the wheel names (and the faces, which it does not list), for both bodies unless a row says otherwise.
    const ways = [];
    for (const gesture of Object.values(context.exports.GESTURES)) {
        ways.push({ fragment: gesture.fragment, tags: gesture.tags });
        if (gesture.female !== undefined) ways.push({ fragment: gesture.female.fragment, tags: gesture.female.tags });
    }
    for (const gesture of Object.values(context.exports.MENU_GESTURES)) {
        ways.push({ fragment: gesture.fragment, tags: gesture.tags });
        if (gesture.female !== undefined) ways.push({ fragment: gesture.female.fragment, tags: gesture.female.tags });
    }
    if (rows === null) {
        for (const way of ways) {
            if (way.fragment === "" || way.fragment.startsWith("ADLG_FA_")) continue;
            const key = way.fragment.toLowerCase();
            const flags = only[way.fragment] ?? "both";
            const row = { fragment: way.fragment, tags: way.tags, male: flags !== "female", female: flags !== "male" };
            catalog.set(key, [...(catalog.get(key) ?? []), row]);
        }
    } else {
        for (const [fragment, list] of Object.entries(rows)) catalog.set(fragment.toLowerCase(), list.map((row) => ({ fragment, male: true, female: true, ...row })));
    }
    const emotes = new context.exports.Emotes(() => state.now, (fn, ms) => state.timers.push({ fn, ms }));
    return { api: context.exports, state, emotes };
}

const player = (id, extra = {}) => {
    const made = {
        id,
        ready: true,
        alive: true,
        mounted: false,
        appearance: { gender: "male" },
        played: [],
        stopped: 0,
        faces: [],
        emitted: [],
        playAnimation(fragment, options) {
            made.played.push([fragment, options]);
            return true;
        },
        stopAnimation() {
            made.stopped += 1;
            return true;
        },
        setFacialExpression(fragment, options) {
            made.faces.push([fragment, options ?? null]);
            return true;
        },
        emit(name, payload) {
            made.emitted.push([name, payload]);
        },
        ...extra,
    };
    return made;
};
const woman = (id, extra = {}) => player(id, { appearance: { gender: "female" }, ...extra });
const plain = (value) => JSON.parse(JSON.stringify(value));
const later = (sut) => (sut.state.now += sut.api.EVERY_MS);
/** The mark of where the fingers close in the game's models (`slt_1`, centimetres, read out of the .cgf files), carried to the other side: where the model sits in the hand. */
const slot = (x, y, z) => ({ x: -x / 100, y: -y / 100, z: -z / 100 });
const GRIPS = { flute: slot(0.383, -0.019, 7.48), horn: slot(-11.482, 12.382, 5.94) };

test("the gestures are the page's: the same numbers, groups and names, and each has a fragment and a length", () => {
    const sut = load();
    const page = fs.readFileSync(path.join(__dirname, "../ui-src/emotes.html"), "utf8");
    const onPage = [...page.matchAll(/\{ id: (\d+), group: "(\w+)", label: "([^"]+)"/g)].map((match) => [Number(match[1]), match[2], match[3]]);
    const wanted = Object.entries(sut.api.GESTURES).map(([id, gesture]) => [Number(id), gesture.group, gesture.name]);
    assert.deepEqual(plain(onPage.slice().sort((a, b) => a[0] - b[0])), plain(wanted), "the wheel and the server speak the same numbers, groups and names");
    const groups = [...page.matchAll(/\{ id: "(\w+)", label: "([^"]+)", icon: /g)].map((match) => [match[1], match[2]]);
    assert.deepEqual(plain(groups), plain(sut.api.GROUPS.map((group) => [group.id, group.name])), "and the same groups, in the same order");
    for (const [id, gesture] of Object.entries(sut.api.GESTURES)) {
        assert.ok(sut.api.GROUPS.some((group) => group.id === gesture.group), `${id}: a group of the wheel`);
        if (gesture.kind === "mood" || gesture.hold === true) {
            assert.equal(gesture.seconds, 0, `${id}: what is kept has no length`);
        } else {
            assert.ok(gesture.fragment !== "" && gesture.seconds > 0 && gesture.seconds <= 70, `${id}: a fragment and a length`);
        }
    }
    assert.equal(Object.keys(sut.api.GESTURES).length, 57);
    for (const old of [1, 2, 3, 4, 5, 6, 101, 102, 103, 104, 105, 106]) {
        assert.ok(sut.api.GESTURES[old] !== undefined, `${old}: the wheel's first twelve are still there, by their numbers`);
    }
});

test("a gesture is played on the body with its tag, once in a short while, and not by the dead, the mounted or the seated", () => {
    const sut = load({ sitting: [9] });
    const anna = player(1);
    const before = lowered.length;
    assert.equal(sut.emotes.play(anna, 1), true);
    assert.deepEqual(lowered.slice(before), [1], "a torch in the hand is put away before the gesture (2026-10-25)");
    assert.deepEqual(plain(anna.played), [["GreetingsUpperBody", { tags: "waveSmall" }]]);
    assert.equal(sut.emotes.play(anna, 3), false, "not again within a moment");
    later(sut);
    assert.equal(sut.emotes.play(anna, 101), true);
    assert.deepEqual(plain(anna.played.at(-1)), ["ApplauseHappy", {}], "no tag: no options");

    for (const other of [player(2, { alive: false }), player(3, { mounted: true }), player(4, { ready: false }), player(9)]) {
        assert.equal(sut.emotes.play(other, 1), false);
        assert.equal(other.played.length, 0);
    }
    assert.equal(sut.emotes.play(player(5), 7), false, "a number that is not a gesture");
    assert.equal(sut.emotes.play(player(6), "1"), false);
});

test("a woman's body plays her own fragment where the game names it so", () => {
    const sut = load();
    const man = player(1);
    const mary = woman(2);
    sut.emotes.play(man, 104);
    sut.emotes.play(mary, 104);
    assert.equal(man.played[0][0], "PrayStandShort");
    assert.equal(mary.played[0][0], "PrayStand");
    sut.emotes.play(mary, 102);
    assert.equal(mary.played.length, 1, "within a moment of the last");
    later(sut);
    sut.emotes.play(mary, 124);
    assert.equal(mary.played.at(-1)[0], "PrayStand", "the long prayer is the same loop for her, let go after her own twenty-five seconds");
    assert.equal(sut.state.timers.at(-1).ms, 25_000 + sut.api.GRACE_MS);
});

test("the game saying a gesture finished lets the body go at once; the timer is only the last word, and one cut short is not stopped twice", () => {
    const sut = load();
    const anna = player(1);
    sut.emotes.play(anna, 102);
    assert.equal(sut.state.timers.length, 1);
    assert.equal(sut.state.timers[0].ms, 3000 + sut.api.GRACE_MS);
    sut.emotes.ended(anna, "OtherFragment", "finished");
    assert.equal(anna.stopped, 0, "another animation's end is not ours");
    sut.emotes.ended(anna, "Pointing", "finished");
    assert.equal(anna.stopped, 1);
    sut.state.timers[0].fn();
    assert.equal(anna.stopped, 1, "nothing is stopped again");

    const bruno = player(2);
    sut.emotes.play(bruno, 103);
    sut.emotes.ended(bruno, "CrimeCross", "interrupted");
    sut.state.timers.at(-1).fn();
    assert.equal(bruno.stopped, 0, "the game cut it short: the timer leaves the body alone");

    const carla = player(3);
    sut.emotes.play(carla, 105);
    sut.state.timers.at(-1).fn();
    assert.equal(carla.stopped, 1, "never told it finished: let go at the latest");
});

test("a fragment the catalog does not have is not played, the player is told, and the log says it once", () => {
    const sut = load({ rows: { GreetingsUpperBody: [{ tags: "l_noweapon+waveSmall" }] } });
    const anna = player(1);
    assert.equal(sut.emotes.play(anna, 105), false);
    assert.equal(anna.played.length, 0);
    assert.match(sut.state.chat[0][1], /não está disponível/);
    later(sut);
    sut.emotes.play(anna, 105);
    assert.equal(sut.state.logs.filter((line) => /não tem 'CrimeScareEasy'/.test(line)).length, 1);
    later(sut);
    assert.equal(sut.emotes.play(anna, 1), true, "the ones it has still play: the tag is one of the row's");
});

test("a gesture the game has for one body only is offered to that body only, and refused to the other", () => {
    const sut = load({ only: { Soldier_Attention: "male", Commander_Urge: "male", CryingStanding: "female", PrayStandLong: "male", WatchmanBlowhorn: "male" } });
    const man = player(1);
    const mary = woman(2);
    const his = sut.emotes.availableFor(man);
    const hers = sut.emotes.availableFor(mary);
    assert.ok(his.includes(109) && his.includes(112) && his.includes(123), "a man can stand at attention, urge and blow the horn");
    assert.ok(!hers.includes(109) && !hers.includes(112) && !hers.includes(123), "a woman is not offered them");
    assert.ok(hers.includes(116) && !his.includes(116), "and she can cry standing, which he cannot");
    assert.ok(hers.includes(124), "the long prayer has her own way: the loop she prays in");
    assert.ok(his.includes(1) && hers.includes(1) && his.includes(128) && hers.includes(128), "the rest is for both");
    assert.ok(hers.includes(140) && hers.includes(150), "and so are the face and the mood, which the catalog does not list");

    assert.equal(sut.emotes.play(mary, 109), false);
    assert.equal(mary.played.length, 0);
    assert.match(sut.state.chat.at(-1)[1], /não está disponível/);
    assert.ok(sut.state.logs.some((line) => /não tem 'Soldier_Attention' para o corpo de mulher/.test(line)));
    later(sut);
    assert.equal(sut.emotes.play(man, 109), true);
});

test("the wheel asks which gestures it may offer, and is told in one answer, not more often than every half second", () => {
    const sut = load({ only: { CryingStanding: "female", Soldier_Attention: "male" } });
    sut.api.installEmotes();
    const anna = woman(1);
    sut.state.client.get("kcdc-gamemode:emote.list")(anna, "{}");
    assert.equal(anna.emitted.length, 1);
    assert.equal(anna.emitted[0][0], "kcdc-gamemode:emote.list");
    const told = JSON.parse(anna.emitted[0][1]).ids;
    assert.ok(told.includes(116) && !told.includes(109));
    sut.state.client.get("kcdc-gamemode:emote.list")(anna, "{}");
    assert.equal(anna.emitted.length, 1, "asked again at once: not answered again");
    sut.state.now += sut.api.LIST_EVERY_MS;
    sut.state.client.get("kcdc-gamemode:emote.list")(anna, "{}");
    assert.equal(anna.emitted.length, 2);
});

test("the lamp is carried, not played: the hand holds it while the body walks, asking again puts it down, another gesture replaces it", () => {
    const sut = load();
    const anna = player(1);
    assert.equal(sut.emotes.play(anna, 128), true);
    assert.deepEqual(plain(anna.played), [["HoldItemLeft", { tags: "l_lamp", props: [{ model: "objects/manmade/common_illumination/lamp_leather_hanging.cgf", hand: "left" }] }]], "the game's own left-hand pose, with a lamp's own model in the hand: the catalog's lamp did not show (2026-10-27)");
    assert.equal(sut.state.timers.length, 0, "no timer lets it go");

    later(sut);
    assert.equal(sut.emotes.play(anna, 128), true, "asked again: put down");
    assert.equal(anna.stopped, 1);
    assert.equal(anna.played.length, 1, "and nothing new is played");

    later(sut);
    sut.emotes.play(anna, 129);
    assert.deepEqual(plain(anna.played.at(-1)), ["HoldItemLeft", { tags: "l_lamp", props: [{ model: "objects/manmade/common_illumination/lantern_fancy_a_hanging.cgf", hand: "left", position: { x: 0, y: 0, z: -0.45 } }] }]);
    later(sut);
    sut.emotes.play(anna, 130);
    assert.deepEqual(
        plain(anna.played.at(-1)),
        [
            "HoldItemRight",
            {
                tags: "r_broom",
                props: [
                    { model: "objects/manmade/common_decorations/flags/flag_spear_scaled.cgf", hand: "right", position: { x: 0, y: 0, z: -0.65 } },
                    { model: "objects/manmade/common_decorations/flags/flag_temporary.cgf", hand: "right", position: { x: 0.344, y: 0, z: 2.05 }, rotation: { x: 90, y: 0, z: 0 } },
                ],
            },
        ],
        "the standard is the game's pole and the cloth it hangs on it (two models, as the level places them), upright in the right hand like a broom: the left hand's hoe grip held the pole upside down, into the ground and out of sight",
    );
    sut.emotes.ended(anna, "HoldItemLeft", "replaced");
    later(sut);
    assert.equal(sut.emotes.play(anna, 130), true);
    assert.equal(anna.stopped, 2, "the game's \"replaced\" for the lamp that the standard took the place of is not the standard's end: asked again, it is put down");
});

test("what is carried is forgotten when the game cuts it short, so the next ask carries it again and does not stop somebody else's animation", () => {
    const sut = load();
    const anna = player(1);
    sut.emotes.play(anna, 128);
    sut.emotes.ended(anna, "HoldItemLeft", "interrupted");
    later(sut);
    assert.equal(sut.emotes.play(anna, 128), true);
    assert.equal(anna.played.length, 2, "carried again");
    assert.equal(anna.stopped, 0);

    // A loop does not finish; if the game said it did, the pose is over and is forgotten, not stopped (a stop would be some other animation's).
    sut.emotes.ended(anna, "HoldItemLeft", "finished");
    assert.equal(anna.stopped, 0);
    later(sut);
    sut.emotes.play(anna, 128);
    assert.equal(anna.played.length, 3);
    assert.equal(anna.stopped, 0);
});

test("\"Parar\" lets go of what the wheel started and of nothing else", () => {
    const sut = load();
    const anna = player(1);
    assert.equal(sut.emotes.play(anna, sut.api.STOP), true, "with nothing playing there is nothing to do, and no complaint");
    assert.equal(anna.stopped, 0, "an animation of another system is not stopped");
    sut.emotes.play(anna, 130);
    later(sut);
    sut.emotes.play(anna, 140);
    later(sut);
    sut.emotes.play(anna, 150);
    assert.equal(sut.emotes.play(anna, sut.api.STOP), true, "it is not held to the wait between gestures");
    assert.equal(anna.stopped, 1);
    assert.deepEqual(plain(anna.faces.at(-1)), ["", null], "and hands the face back");
    assert.equal(sut.emotes.play(player(2, { alive: false }), sut.api.STOP), false);
});

test("a gesture of the face plays once and hands the face back, to the mood the player keeps if there is one", () => {
    const sut = load();
    const anna = player(1);
    assert.equal(sut.emotes.play(anna, 140), true);
    assert.deepEqual(plain(anna.faces), [["ADLG_FA_Smile", {}]]);
    assert.equal(anna.played.length, 0, "the body is left alone");
    assert.equal(sut.state.timers.at(-1).ms, 4000);
    sut.state.timers.at(-1).fn();
    assert.deepEqual(plain(anna.faces.at(-1)), ["", null], "the game's own face again");

    later(sut);
    assert.equal(sut.emotes.play(anna, 151), true);
    assert.deepEqual(plain(anna.faces.at(-1)), ["FE_Default", { tags: "angry" }], "a mood is the face's held expression");
    assert.equal(sut.state.timers.length, 1, "no timer for it");
    later(sut);
    sut.emotes.play(anna, 143);
    sut.state.timers.at(-1).fn();
    assert.deepEqual(plain(anna.faces.at(-1)), ["FE_Default", { tags: "angry" }], "after the wink the face is angry again");
    later(sut);
    sut.emotes.play(anna, 158);
    assert.deepEqual(plain(anna.faces.at(-1)), ["", null], "\"Neutro\" hands the face back");
    later(sut);
    sut.emotes.play(anna, 143);
    sut.state.timers.at(-1).fn();
    assert.deepEqual(plain(anna.faces.at(-1)), ["", null]);

    // The laugh is the man's Haha and the woman's Laugh; a gesture of a face that was replaced meanwhile does not hand the face back over the new one.
    const mary = woman(2);
    sut.emotes.play(mary, 142);
    assert.equal(mary.faces[0][0], "ADLG_FA_Laugh");
    const bruno = player(3);
    sut.emotes.play(bruno, 142);
    assert.equal(bruno.faces[0][0], "ADLG_FA_Haha");
    assert.equal(sut.state.timers.at(-1).ms, 5000);
    later(sut);
    sut.emotes.play(bruno, 144);
    const stale = sut.state.timers.at(-2);
    stale.fn();
    assert.equal(bruno.faces.length, 2, "the first gesture's timer finds a newer one and leaves the face alone");
});

test("a face the game refuses is not made, and the player is told", () => {
    const sut = load();
    const anna = player(1, { setFacialExpression: () => { throw new Error("no such fragment"); } });
    assert.equal(sut.emotes.play(anna, 140), false);
    assert.match(sut.state.chat.at(-1)[1], /não está disponível/);
    assert.ok(sut.state.logs.some((line) => /o gesto 140 \(ADLG_FA_Smile\) foi recusado: (Error: )?no such fragment/.test(line)));
});

test("what is held is given by the model's own path, so the catalog of props does not decide the wheel; and a prop that throws is refused with the log saying so", () => {
    const without = load({ props: [] });
    const anna = player(1);
    const offered = without.emotes.availableFor(anna);
    for (const number of [121, 122, 123, 128, 129, 130]) {
        assert.ok(offered.includes(number), `${String(number)} is offered with an empty catalog of props`);
    }
    assert.equal(without.emotes.play(anna, 130), true);
    assert.equal(anna.played.length, 1);

    const sut = load();
    const bruno = player(2, { playAnimation: () => { throw new Error("no such prop"); } });
    assert.equal(sut.emotes.play(bruno, 128), false);
    assert.ok(sut.state.logs.some((line) => /o gesto 128 \(HoldItemLeft\) foi recusado: (Error: )?no such prop/.test(line)));
    assert.ok(sut.state.logs.some((line) => /o gesto 128 \(HoldItemLeft\) foi recusado sem o objeto também: (Error: )?no such prop/.test(line)), "tried again with the hands empty, and said so");
    assert.match(sut.state.chat.at(-1)[1], /não está disponível/);

    // A model the game will not hold only costs the gesture its object: the pose is played with the hands empty, and the horn is still blown.
    const lenient = load();
    const tried = [];
    const carla = player(3, { playAnimation: (fragment, options) => { tried.push([fragment, { ...options }]); if (options.props !== undefined) throw new Error("model not found"); return true; } });
    assert.equal(lenient.emotes.play(carla, 123), true);
    assert.equal(tried.length, 2);
    assert.ok(tried[0][1].props !== undefined && tried[1][1].props === undefined);
    assert.equal(tried[1][0], "WatchmanBlowhorn");
    assert.ok(lenient.state.logs.some((line) => /o gesto 123 \(WatchmanBlowhorn\) foi recusado: (Error: )?model not found/.test(line)));
    assert.equal(lenient.state.chat.length, 0, "and the player is told nothing");
});

test("the horn, heard two hundred metres away, may be blown once a minute by each player", () => {
    const sut = load();
    const man = player(1);
    const other = player(2);
    assert.equal(sut.emotes.play(man, 123), true);
    assert.deepEqual(plain(man.played[0]), ["WatchmanBlowhorn", { props: [{ model: "objects/manmade/task_specific_props/entertainment/music/hunting_horn.cgf", hand: "right", position: GRIPS.horn }] }], "with the horn in the hand (2026-10-27: it was blown with nothing)");
    sut.state.now += 20_000;
    assert.equal(sut.emotes.play(man, 123), false);
    assert.match(sut.state.chat.at(-1)[1], /Aguarde 40 s/);
    assert.equal(man.played.length, 1);
    later(sut);
    assert.equal(sut.emotes.play(other, 123), true, "the next player's wait is their own");
    sut.state.now += 40_000;
    assert.equal(sut.emotes.play(man, 123), true);
    assert.equal(man.played.length, 2);
});

test("an administrator switches a gesture off for everybody: not offered, not played, kept across restarts; and on again", () => {
    const sut = load();
    const anna = player(1);
    assert.equal(sut.emotes.setOff(130, true), true);
    assert.equal(sut.emotes.setOff(999, true), false, "a number that is no gesture");
    assert.deepEqual(plain(sut.state.written.at(-1)), ["playerdata/emotes.json", { v: 1, off: [130] }]);
    assert.ok(!sut.emotes.availableFor(anna).includes(130));
    assert.equal(sut.emotes.play(anna, 130), false);
    assert.equal(anna.played.length, 0);

    const next = load({ store: { v: 1, off: [130, 128, "x", 4242] } });
    next.emotes.load();
    assert.deepEqual(plain(next.emotes.switchedOff()), [128, 130], "what is on the disk is taken back, and only what is a gesture");
    next.api.installEmotes();
    assert.ok(next.state.logs.some((line) => /57 gestos em 7 grupos na roda do G/.test(line) && /desligados por um administrador: 128, 130/.test(line)), next.state.logs.join("\n"));

    sut.emotes.setOff(130, false);
    later(sut);
    assert.equal(sut.emotes.play(anna, 130), true);
});

test("installed: a click's number plays it, the end of the animation lets go, and a player who leaves or comes back to life is a new body", () => {
    const sut = load();
    sut.api.installEmotes();
    assert.ok(sut.state.logs.some((line) => /57 gestos em 7 grupos na roda do G/.test(line)), sut.state.logs.join("\n"));
    const anna = player(1);
    sut.state.client.get("kcdc-gamemode:emote.play")(anna, JSON.stringify({ id: 6 }));
    assert.equal(anna.played[0][0], "TournamentCheersHappyGesture");
    sut.state.handlers.get("playerAnimationEnd")(anna, "TournamentCheersHappyGesture", "finished");
    assert.equal(anna.stopped, 1);

    later(sut);
    sut.state.client.get("kcdc-gamemode:emote.play")(anna, JSON.stringify({ id: 151 }));
    later(sut);
    sut.state.client.get("kcdc-gamemode:emote.play")(anna, JSON.stringify({ id: 128 }));
    sut.state.handlers.get("playerSpawned")(anna);
    later(sut);
    sut.state.client.get("kcdc-gamemode:emote.play")(anna, JSON.stringify({ id: 140 }));
    sut.state.timers.at(-1).fn();
    assert.deepEqual(plain(anna.faces.at(-1)), ["", null], "the mood of the body that died is not worn by the new one");
    later(sut);
    sut.state.client.get("kcdc-gamemode:emote.play")(anna, JSON.stringify({ id: 128 }));
    assert.equal(anna.played.at(-1)[0], "HoldItemLeft", "and a lamp it carried is not put down: it is carried anew");
    sut.state.handlers.get("playerDisconnect")(anna);
});

test("the wheel's page: its groups and its ring, Parar, Backspace, no frame and no square outline on a click", () => {
    const page = fs.readFileSync(path.join(__dirname, "../ui-src/emotes.html"), "utf8");
    assert.doesNotMatch(page, /<image|emotes:frame/, "the golden frame was tried and taken out");
    assert.match(page, /outline:\s*none/, "no focus rectangle round a gesture that was clicked");
    assert.doesNotMatch(page, /tabindex/, "a segment that cannot take focus has no focus ring to draw");
    assert.match(page, /viewBox="-250 -250 500 500"/);
    assert.match(page, /const STOP = 0;/, "Parar is the number 0, which the server lets go of what it started for");
    assert.match(page, /addEventListener\("emotes:list"/, "the client tells it which gestures the body may play");
    assert.match(page, /addEventListener\("emotes:open"/, "and that it was opened: back to the groups");
    assert.match(page, /code === 8/, "Backspace goes back to the groups");
    assert.match(page, /send\("emotes:ready"\)/, "the client is told the page is up, so what it sends is heard");
});

test("the dog's caress is a gesture of the server's menus, not of the wheel: a click cannot ask for it, the dog menu can (2026-10-26)", () => {
    const sut = load();
    sut.api.installEmotes();
    assert.equal(sut.api.DOG_PETTING, 201);
    assert.ok(!(201 in sut.api.GESTURES), "the wheel does not know it");
    const anna = player(1);
    sut.state.client.get("kcdc-gamemode:emote.play")(anna, JSON.stringify({ id: 201 }));
    assert.equal(anna.played.length, 0, "a client that asks for it is not answered");
    assert.equal(sut.emotes.play(anna, 201), false, "nor is a call that is not from a menu");

    assert.equal(sut.emotes.play(anna, 201, true), true);
    assert.deepEqual(plain(anna.played), [["DogPetting", {}]], "the player's own caress of the game's dog");
    assert.equal(sut.state.timers.at(-1).ms, 3000 + sut.api.GRACE_MS);
});

test("a woman's caress of the dog is the housekeeper's, which runs fifteen seconds in the game and is let go after seven", () => {
    const sut = load();
    const mary = woman(2);
    assert.equal(sut.emotes.play(mary, 201, true), true);
    assert.equal(mary.played[0][0], "HousekeeperDogCarees");
    assert.equal(sut.state.timers.at(-1).ms, 7000 + sut.api.GRACE_MS, "her own length, not the man's three seconds");
    const gesture = sut.api.MENU_GESTURES[201];
    assert.equal(gesture.female.seconds, 7);
    assert.ok(gesture.seconds < gesture.female.seconds);

    const man = player(3);
    sut.emotes.play(man, 104);
    assert.equal(sut.state.timers.at(-1).ms, 8000 + sut.api.GRACE_MS, "a gesture whose woman's way has no length of its own keeps the gesture's");
    const praying = woman(4);
    sut.emotes.play(praying, 104);
    assert.equal(sut.state.timers.at(-1).ms, 8000 + sut.api.GRACE_MS);
});

test("the flutes are played with the flute in the hand (2026-10-27: nothing showed)", () => {
    const sut = load();
    const anna = player(1);
    assert.equal(sut.emotes.play(anna, 121), true);
    assert.deepEqual(plain(anna.played.at(-1)), ["PlayFluteSong", { tags: "tempo_slow", props: [{ model: "objects/manmade/task_specific_props/entertainment/music/flute.cgf", hand: "right", position: GRIPS.flute }] }]);
});


// The flute that could not be seen, the fine lantern above the hand, and the lamp without a glow (user, 2026-10-27: "a flauta continua não aparecendo nos emotes, o lampião não tem
// brilho e um dos outros lampiões apareceu acima da mão").

test("the flute and the horn are held by the mark where the fingers close, not by the end of the model; the fine lantern hangs from the hand, not stands on it", () => {
    const sut = load();
    const g = sut.api.GESTURES;
    assert.deepEqual(plain(g[121].props[0].position), plain(GRIPS.flute));
    assert.deepEqual(plain(g[122].props[0].position), plain(GRIPS.flute));
    assert.deepEqual(plain(g[123].props[0].position), plain(GRIPS.horn));
    assert.deepEqual(plain(g[129].props[0].position), { x: 0, y: 0, z: -0.45 }, "its body is 47 cm above its origin");
    assert.equal(g[128].props[0].position, undefined, "the leather lamp hangs from its ring already");
    // The flute is a tube of 33 cm that runs from the mouthpiece along +Z: gripped 7.5 cm along it, it now stands on both sides of the hand, never wholly on one.
    assert.ok(GRIPS.flute.z < -0.07 && GRIPS.flute.z > -0.08);
});

// The lamps' light (2026-11-02, "a luz está artificial, com cara de LED piscando; o correto é uma cor mais quente, passando sensação de fogo natural"): the server says who carries a lit
// lamp, and each client draws a light of its own on the body (src/client/lamps.ts); the server's own light, moved four times a second, is gone.
const told = (sut) => {
    const sent = [];
    sut.emotes.broadcast = (payload) => sent.push(JSON.parse(payload));
    return sent;
};

test("a lamp that is carried is told to every client with a flame's warm light, and put out for them when it is put down", () => {
    const sut = load();
    const sent = told(sut);
    const anna = player(1, { position: { x: 10, y: 20, z: 5 }, nickname: "Anna" });
    sut.state.bodies.set(1, anna);
    assert.equal(sut.emotes.play(anna, 128), true);
    assert.deepEqual(sent, [{ on: [1, [1, 0.5, 0.16], 1.1, 6, 0.9] }], "the carrier, a deep orange, its strength, reach and height in the hand");
    assert.equal(sut.state.lights.length, 0, "no light of the server's");
    assert.equal(sut.emotes.lit(), 1);
    later(sut);
    sut.emotes.play(anna, 128);
    assert.deepEqual(sent.at(-1), { off: 1 });
    assert.equal(sut.emotes.lit(), 0);
});

test("the fine lantern lights too, one lamp replacing the other leaves one lit, and a gesture with no lamp puts it out", () => {
    const sut = load();
    const sent = told(sut);
    const anna = player(1, { position: { x: 0, y: 0, z: 0 } });
    sut.state.bodies.set(1, anna);
    sut.emotes.play(anna, 128);
    later(sut);
    sut.emotes.play(anna, 129);
    assert.deepEqual(sent.map((one) => Object.keys(one)[0]), ["on", "on"], "the second lamp takes the first one's place");
    assert.equal(sut.emotes.lit(), 1);
    later(sut);
    sut.emotes.play(anna, 130);
    assert.deepEqual(sent.at(-1), { off: 1 }, "the standard carries no light");
    assert.equal(sut.emotes.lit(), 0);
});

test("a lamp is put out when its carrier dies, leaves, comes back as a new body, or the game cuts the gesture short", () => {
    const sut = load();
    const sent = told(sut);
    const make = (id) => {
        const body = player(id, { position: { x: id, y: 0, z: 0 } });
        sut.state.bodies.set(id, body);
        sut.emotes.play(body, 128);
        return body;
    };
    const dead = make(1);
    const gone = make(2);
    const renewed = make(3);
    const cut = make(4);
    assert.equal(sut.emotes.lit(), 4);
    dead.alive = false;
    sut.state.bodies.delete(2);
    sut.emotes.checkLamps((id) => sut.state.bodies.get(id) ?? null);
    assert.deepEqual(sent.filter((one) => one.off !== undefined).map((one) => one.off), [1, 2], "the dead and the vanished");
    sut.emotes.reset(renewed);
    sut.emotes.ended(cut, "HoldItemLeft", "interrupted");
    assert.deepEqual(sent.filter((one) => one.off !== undefined).map((one) => one.off), [1, 2, 3, 4]);
    assert.equal(sut.emotes.lit(), 0);
    sut.emotes.left(gone);
    assert.equal(sent.filter((one) => one.off !== undefined).length, 4, "nothing put out twice");
});

test("installed: the carriers are looked at every two seconds, and a player who comes in is told of every lamp lit", () => {
    const sut = load();
    sut.api.installEmotes();
    const timer = sut.state.intervals.find((entry) => entry.ms === sut.api.LAMP_CHECK_MS);
    assert.ok(timer, "a timer for the carriers");
    assert.equal(sut.api.LAMP_CHECK_MS, 2_000);
    assert.doesNotThrow(() => timer.fn());
    // The module's own Emotes, the one the installed handlers use.
    sut.api.emotes.broadcast = () => undefined;
    const anna = player(1, { position: { x: 0, y: 0, z: 0 } });
    sut.state.bodies.set(1, anna);
    sut.api.emotes.play(anna, 129);
    const emitted = [];
    const ben = player(2, { position: { x: 5, y: 0, z: 0 }, emit: (event, payload) => emitted.push([event, JSON.parse(payload)]) });
    sut.state.handlers.get("playerSpawned")(ben);
    assert.deepEqual(emitted, [["kcdc-gamemode:lamp", { all: [[1, [1, 0.5, 0.16], 1.1, 6, 0.9]] }]]);
    // Nobody carries a lamp: nothing is said to one who comes in.
    sut.api.emotes.reset(anna);
    sut.state.handlers.get("playerSpawned")(player(3, { emit: () => assert.fail("nothing to tell") }));
});

test("an administrator moves the model in the hand for everybody (/gesto ajustar): it is used, kept across restarts, and given back with 'padrao'", () => {
    const sut = load();
    const anna = player(1, { position: { x: 0, y: 0, z: 0 } });
    sut.state.bodies.set(1, anna);
    assert.equal(sut.emotes.tune(1, { x: 0, y: 0, z: 0 }), false, "a gesture with nothing in the hand has nothing to move");
    assert.equal(sut.emotes.tune(121, { x: 0.1, y: -0.05, z: 0.2 }, { x: 0, y: 90, z: 0 }), true);
    assert.deepEqual(plain(sut.state.written.at(-1)), ["playerdata/emotes.json", { v: 1, off: [], tune: { 121: { position: { x: 0.1, y: -0.05, z: 0.2 }, rotation: { x: 0, y: 90, z: 0 } } } }]);
    assert.equal(sut.emotes.preview(anna, 121), true);
    assert.deepEqual(plain(anna.played.at(-1)), ["PlayFluteSong", { tags: "tempo_slow", props: [{ model: "objects/manmade/task_specific_props/entertainment/music/flute.cgf", hand: "right", position: { x: 0.1, y: -0.05, z: 0.2 }, rotation: { x: 0, y: 90, z: 0 } }] }]);
    // The same gesture tried again, a carried one included, plays again from the start instead of being put down.
    assert.equal(sut.emotes.preview(anna, 128), true);
    const played = anna.played.length;
    assert.equal(sut.emotes.preview(anna, 128), true);
    assert.equal(anna.played.length, played + 1);
    assert.equal(anna.played.at(-1)[0], "HoldItemLeft");
    assert.deepEqual(plain(sut.emotes.tunedList()), [{ id: 121, piece: 1, position: { x: 0.1, y: -0.05, z: 0.2 }, rotation: { x: 0, y: 90, z: 0 } }]);

    // After a restart the place is the administrator's.
    const again = load({ store: JSON.parse(JSON.stringify(sut.state.disk)) });
    again.emotes.load();
    assert.deepEqual(plain(again.emotes.tuning(121)), { position: { x: 0.1, y: -0.05, z: 0.2 }, rotation: { x: 0, y: 90, z: 0 } });
    const bea = player(2, { position: { x: 0, y: 0, z: 0 } });
    again.emotes.play(bea, 121);
    assert.deepEqual(plain(bea.played[0][1].props[0].position), { x: 0.1, y: -0.05, z: 0.2 });

    assert.equal(sut.emotes.untune(121), true);
    assert.equal(sut.emotes.untune(121), false);
    assert.deepEqual(plain(sut.state.written.at(-1)), ["playerdata/emotes.json", { v: 1, off: [] }], "nothing tuned: the file is as it was");
    later(sut);
    sut.emotes.play(anna, 121);
    assert.deepEqual(plain(anna.played.at(-1)[1].props[0].position), plain(GRIPS.flute), "the catalog's own again");
});

test("a place kept for a gesture that has no model, or with numbers that are not numbers, is left out when read back", () => {
    const sut = load({ store: { v: 1, off: [], tune: { 1: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, 121: { position: { x: "a", y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, 123: { position: { x: 0.1, y: 0.2, z: 0.3 }, rotation: { x: 0, y: 0, z: 45 } } } } });
    sut.emotes.load();
    assert.deepEqual(plain(sut.emotes.tunedList()), [{ id: 123, piece: 1, position: { x: 0.1, y: 0.2, z: 0.3 }, rotation: { x: 0, y: 0, z: 45 } }]);
    const odd = load({ store: { v: 1, off: [], tune: { "130.2": { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, "130.3": { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, "130.0": { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, "130.x": { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, "121.2": { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } } } });
    odd.emotes.load();
    assert.deepEqual(plain(odd.emotes.tunedList().map((one) => [one.id, one.piece])), [[130, 2]], "only a model the gesture has: the cloth of the standard, and not a third, a zeroth or a second flute");
});

test("a gesture with two models in the hands has each moved on its own (/gesto ajustar 130.2): the cloth of the standard is kept as 130.2, read back, and given back alone or with the pole", () => {
    const sut = load();
    const anna = player(1, { position: { x: 0, y: 0, z: 0 } });
    sut.state.bodies.set(1, anna);
    const place = { position: { x: 0.5, y: 0, z: 2 }, rotation: { x: 90, y: 0, z: 180 } };
    assert.equal(sut.emotes.tune(130, place.position, place.rotation, 2), true);
    assert.equal(sut.emotes.tune(130, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 3), false, "the standard has no third model");
    assert.equal(sut.emotes.tune(121, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 2), false, "the flute has one");
    assert.deepEqual(plain(sut.state.written.at(-1)), ["playerdata/emotes.json", { v: 1, off: [], tune: { "130.2": place } }]);

    assert.equal(sut.emotes.preview(anna, 130), true);
    const props = plain(anna.played.at(-1)[1].props);
    assert.deepEqual(props[0].position, { x: 0, y: 0, z: -0.65 }, "the pole stays where the catalog puts it");
    assert.deepEqual(props[1].position, place.position);
    assert.deepEqual(props[1].rotation, place.rotation);
    assert.deepEqual(plain(sut.emotes.tunedList()), [{ id: 130, piece: 2, ...place }]);

    const again = load({ store: JSON.parse(JSON.stringify(sut.state.disk)) });
    again.emotes.load();
    assert.deepEqual(plain(again.emotes.tuning(130, 2)), place);
    assert.equal(again.emotes.tuning(130), undefined, "the pole was not touched");

    assert.equal(sut.emotes.tune(130, { x: 0.1, y: 0, z: 0 }), true, "the pole too");
    assert.deepEqual(plain(sut.emotes.tunedList().map((one) => one.piece)), [1, 2]);
    assert.equal(sut.emotes.untune(130, 2), true);
    assert.deepEqual(plain(sut.emotes.tunedList().map((one) => one.piece)), [1], "the cloth went back alone");
    assert.equal(sut.emotes.tune(130, place.position, place.rotation, 2), true);
    assert.equal(sut.emotes.untune(130), true, "no model named: every model of the gesture goes back");
    assert.deepEqual(plain(sut.emotes.tunedList()), []);
    assert.equal(sut.emotes.untune(130), false);
});
