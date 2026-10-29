"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Esgrima (src/server/esgrima.ts, 2026-10-26): the weapon combos are blocked in the game and taught from one player to another; an administrator
// knows them all and is the only one to take one away; they are kept in a file of their own and put back a little after each entry.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const comboSandbox = { exports: {} };
vm.runInNewContext(dist("combo-data.js"), comboSandbox);
const { COMBOS, COMBO_GROUPS } = comboSandbox.exports;
const FIRST = COMBOS[0].perk;
const SECOND = COMBOS[1].perk;
const THIRD = COMBOS[2].perk;
const FILE = "playerdata/esgrima.json";

function load({ stored = null, corrupt = false, restoreWorks = true, blocked = ["Secrets of matter I"] } = {}) {
    const state = { files: new Map(), notices: [], logs: [], payloads: [], clients: new Map(), handlers: new Map(), timers: [], blocked: [...blocked], online: new Map(), added: [], removed: [], restores: [], emitted: [], restoreWorks };
    if (stored !== null) state.files.set(FILE, JSON.parse(JSON.stringify(stored)));
    const store = {
        ensureDir() {},
        read: () => (corrupt ? { status: "corrupt", reason: "bad json" } : state.files.has(FILE) ? { status: "ok", value: JSON.parse(JSON.stringify(state.files.get(FILE))), fromBackup: false } : { status: "missing" }),
        write: (file, data) => state.files.set(file, JSON.parse(JSON.stringify(data))),
    };
    const context = {
        exports: {},
        require: (id) =>
            ({
                "./acquaintances.js": { nameOf: (player) => player.nickname },
                "./auth.js": { isAdmin: (player) => player.admin === true },
                "./combo-data.js": comboSandbox.exports,
                "./language.js": { languageOf: (player) => player.lang ?? "pt" },
                "./status.js": { addPayload: (fn) => state.payloads.push(fn), notice: (player, text) => state.notices.push([player.nickname, text]) },
                "./store.js": store,
            })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Player: { getById: (id) => state.online.get(id) ?? null },
        Progression: {
            get blockedPerks() {
                return [...state.blocked];
            },
            blockPerks: (names) => {
                state.blocked = [...names];
            },
        },
        Events: { onClient: (name, fn) => state.clients.set(name, fn), on: (name, fn) => state.handlers.set(name, fn) },
        setTimeout: (fn, ms) => {
            state.timers.push({ fn, ms });
            return state.timers.length;
        },
        JSON,
        Set,
        Map,
    };
    vm.runInNewContext(dist("esgrima.js"), context);
    let nextId = 1;
    const player = (nickname, extra = {}) => {
        const id = nextId++;
        const made = {
            id,
            steamId: `7656119800000${String(id).padStart(4, "0")}`,
            nickname,
            ready: true,
            admin: false,
            perks: [],
            addPerk(name) {
                state.added.push([nickname, name]);
                if (extra.refusesAdd === true) return false;
                made.perks = [...made.perks, name];
                return true;
            },
            removePerk(name) {
                state.removed.push([nickname, name]);
                made.perks = made.perks.filter((one) => one !== name);
                return true;
            },
            restoreProgression(snapshot) {
                state.restores.push(plain(snapshot));
                if (state.restoreWorks) made.perks = [...snapshot.perks];
                return true;
            },
            emit: (event, payload) => state.emitted.push([nickname, event, JSON.parse(payload)]),
            ...extra,
        };
        state.online.set(id, made);
        return made;
    };
    return { api: context.exports, state, player };
}

const LOG_FREE = (sut) => sut.state.logs.every((line) => !/7656119/.test(line));
/** Runs, one after another, every timer of this delay that is waiting (a round that runs may schedule the next of the same delay). */
const pump = (sut, ms) => {
    for (let at = 0; at < 40; at += 1) {
        const next = sut.state.timers.find((timer) => timer.ms === ms && !timer.done);
        if (next === undefined) return;
        next.done = true;
        next.fn();
    }
};

test("the catalog is the game's 51 weapon combos, by weapon, each a perk of its own", () => {
    assert.equal(COMBOS.length, 51);
    assert.equal(new Set(COMBOS.map((combo) => combo.perk)).size, 51, "each perk once");
    assert.equal(new Set(COMBOS.map((combo) => combo.id)).size, 51);
    assert.deepEqual(plain(COMBO_GROUPS.map((group) => group.id)), ["longsword", "sword", "sword_shield", "blunt", "blunt_shield", "halberd", "unarmed"]);
    const counts = {};
    for (const combo of COMBOS) counts[combo.group] = (counts[combo.group] ?? 0) + 1;
    assert.deepEqual(counts, { longsword: 10, sword: 9, sword_shield: 7, blunt: 6, blunt_shield: 7, halberd: 4, unarmed: 8 });
    for (const combo of COMBOS) {
        assert.match(combo.perk, /^C\d\d \(.+\)$/, combo.perk);
        assert.match(combo.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        assert.ok(combo.name[0] !== "" && combo.name[1] !== "" && combo.desc[0] !== "" && combo.desc[1] !== "", `${combo.perk} has its words in both languages`);
        assert.ok(combo.steps >= 3 && combo.steps <= 4 && combo.level >= 0 && combo.level <= 22, combo.perk);
    }
    const sut = load();
    assert.ok(sut.api.isCombo("C01 (longsword)"));
    assert.ok(!sut.api.isCombo("Ringenmeister") && !sut.api.isCombo("Ascetic"), "the wrestler's perk is no combo");
});

test("installed: every combo is blocked in the game, what was blocked before stays, and the panel is told who has the section", () => {
    const sut = load({ blocked: ["Secrets of matter I", "Secrets of matter II"] });
    sut.api.installEsgrima();
    assert.equal(sut.state.blocked.length, 53, "the two that were, the 51 combos");
    assert.ok(sut.state.blocked.includes("Secrets of matter II") && sut.state.blocked.includes(FIRST));
    assert.equal(new Set(sut.state.blocked).size, sut.state.blocked.length);
    assert.ok(sut.state.logs.some((line) => /51 combos bloqueados no jogo \(53 talentos bloqueados ao todo\)/.test(line)));

    const admin = sut.player("Mauro", { admin: true });
    const none = sut.player("Hans");
    const knows = sut.player("Jan", { perks: ["Ascetic", SECOND] });
    const contributor = sut.state.payloads[0];
    assert.deepEqual(plain(contributor(admin)), { esgrima: { visible: true } });
    assert.deepEqual(plain(contributor(none)), { esgrima: { visible: false } });
    assert.deepEqual(plain(contributor(knows)), { esgrima: { visible: true } }, "one combo is enough");
});

test("what a player sees: an administrator all 51, anybody else what they know, in their language; nothing of one they do not know", () => {
    const sut = load();
    const admin = sut.player("Mauro", { admin: true });
    assert.equal(sut.api.esgrima.view(admin).combos.length, 51);
    assert.equal(sut.api.esgrima.view(admin).admin, true);
    assert.equal(sut.api.esgrima.view(admin).groups.length, 7);

    const hans = sut.player("Hans", { perks: [FIRST, THIRD, "Ascetic"] });
    const view = sut.api.esgrima.view(hans);
    assert.deepEqual(plain(view.combos.map((row) => row.id)), [FIRST, THIRD]);
    assert.equal(view.admin, false);
    assert.equal(view.groups[0].label, "Montante");
    assert.equal(view.combos[0].name, COMBOS[0].name[0]);

    const english = sut.player("John", { perks: [FIRST], lang: "en" });
    const seen = sut.api.esgrima.view(english);
    assert.equal(seen.groups[0].label, "Longsword");
    assert.equal(seen.combos[0].name, COMBOS[0].name[1]);

    const info = sut.api.esgrima.info(hans, FIRST);
    assert.equal(info.id, FIRST);
    assert.equal(info.desc, COMBOS[0].desc[0]);
    assert.equal(info.group, "Montante");
    assert.equal(info.finisher, "corte");
    assert.equal(info.steps, 3);
    assert.equal(sut.api.esgrima.info(hans, SECOND), null, "not one they do not know");
    assert.equal(sut.api.esgrima.info(hans, "Ringenmeister"), null);
    assert.equal(sut.api.esgrima.info(admin, SECOND).id, SECOND, "an administrator knows all");
    assert.equal(sut.api.esgrima.info(english, FIRST).finisher, "slash");
});

test("a player teaches a combo they know to another, who then knows it, is told, and may teach it too; the file keeps it", () => {
    const sut = load();
    sut.api.installEsgrima();
    const hans = sut.player("Hans", { perks: [FIRST] });
    const jan = sut.player("Jan");
    const outcome = sut.api.esgrima.teach(hans, FIRST, jan.id);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.message, `Você ensinou o combo ${COMBOS[0].name[0]} a Jan.`);
    assert.deepEqual(plain(sut.state.added), [["Jan", FIRST]]);
    assert.ok(sut.state.notices.some(([who, text]) => who === "Jan" && text === `Hans ensinou a você o combo ${COMBOS[0].name[0]}: veja na seção Esgrima do painel (F2).`), JSON.stringify(sut.state.notices));
    assert.deepEqual(plain(sut.state.files.get(FILE)), { [jan.steamId]: [FIRST] }, "kept for the next entry");
    assert.ok(sut.state.emitted.some(([who, event, view]) => who === "Jan" && event === "kcdc-gamemode:status.esgrima" && view.combos.length === 1), "the learner's page is sent the new list");
    assert.ok(sut.state.logs.some((line) => line.startsWith(`esgrima: Hans ensinou "${COMBOS[0].name[0]}"`) && line.endsWith("a Jan")));
    assert.ok(LOG_FREE(sut), "no Steam id in the log");

    const eva = sut.player("Eva");
    assert.equal(sut.api.esgrima.teach(jan, FIRST, eva.id).ok, true, "and the learner teaches the next");
});

test("the refusals: a combo one does not know, a player who is gone or not ready, oneself, one who knows it already, a game that does not take the order", () => {
    const sut = load();
    const hans = sut.player("Hans", { perks: [FIRST] });
    const jan = sut.player("Jan");
    assert.equal(sut.api.esgrima.teach(hans, SECOND, jan.id).message, "Você só ensina os combos que conhece.");
    assert.equal(sut.api.esgrima.teach(hans, "C99 (nothing)", jan.id).message, "Esse combo não existe.");
    assert.equal(sut.api.esgrima.teach(hans, FIRST, 999).message, "Esse jogador não está mais no servidor.");
    assert.equal(sut.api.esgrima.teach(hans, FIRST, "7").message, "Esse jogador não está mais no servidor.", "an id that is no number");
    jan.ready = false;
    assert.equal(sut.api.esgrima.teach(hans, FIRST, jan.id).message, "Esse jogador não está mais no servidor.");
    jan.ready = true;
    assert.equal(sut.api.esgrima.teach(hans, FIRST, hans.id).message, "Você já conhece esse combo.");
    const knows = sut.player("Eva", { perks: [FIRST] });
    assert.equal(sut.api.esgrima.teach(hans, FIRST, knows.id).message, "Eva já conhece esse combo.");
    const stubborn = sut.player("Ondra", { refusesAdd: true });
    assert.equal(sut.api.esgrima.teach(hans, FIRST, stubborn.id).message, "O jogo não aceitou o combo agora. Tente de novo em instantes.");
    assert.equal(sut.state.files.has(FILE), false, "and nothing was written down for it");
    assert.deepEqual(plain(sut.state.added.filter(([who]) => who === "Jan")), [], "nothing was given on the way");
});

test("an administrator teaches any combo, to anybody; one who is taught is not an administrator, and cannot take one back", () => {
    const sut = load();
    const admin = sut.player("Mauro", { admin: true });
    const hans = sut.player("Hans");
    assert.equal(sut.api.esgrima.teach(admin, THIRD, hans.id).ok, true);
    assert.equal(sut.api.esgrima.retire(hans, THIRD, admin.id).message, "Só um administrador retira um combo.");
    const jan = sut.player("Jan");
    sut.api.esgrima.teach(hans, THIRD, jan.id);
    assert.equal(sut.api.esgrima.retire(hans, THIRD, jan.id).ok, false, "not the one who taught either");
    assert.ok(sut.state.removed.length === 0, "nothing was taken");
});

test("an administrator takes a combo from a player: the game's perk and the file's line; the player is told; the section goes with the last one", () => {
    const sut = load({ stored: { "76561198000000009": [FIRST] } });
    sut.api.esgrima.load();
    const admin = sut.player("Mauro", { admin: true });
    const hans = sut.player("Hans", { perks: [FIRST, SECOND], steamId: "76561198000000009" });
    assert.deepEqual(plain(sut.api.esgrima.keptFor("76561198000000009")), [FIRST]);
    const outcome = sut.api.esgrima.retire(admin, FIRST, hans.id);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.message, `Você retirou o combo ${COMBOS[0].name[0]} de Hans.`);
    assert.deepEqual(plain(sut.state.removed), [["Hans", FIRST]]);
    assert.deepEqual(plain(sut.state.files.get(FILE)), {}, "the file has no line for him now");
    assert.ok(sut.state.notices.some(([who, text]) => who === "Hans" && text === `Um administrador retirou de você o combo ${COMBOS[0].name[0]}.`));
    assert.equal(sut.api.esgrima.retire(admin, FIRST, hans.id).message, "Hans não conhece esse combo.");
    assert.equal(sut.api.esgrima.retire(admin, FIRST, 999).message, "Esse jogador não está mais no servidor.");
    assert.equal(sut.api.esgrima.retire(admin, "C99 (nothing)", hans.id).message, "Esse combo não existe.");
    assert.ok(sut.state.logs.some((line) => /^esgrima: Mauro retirou ".+" \(C01 \(longsword\)\) de Hans$/.test(line)), sut.state.logs.join("|"));
});

test("a saved character's combos are left out of what the game restores and written down, once; a character with none is untouched", () => {
    const sut = load();
    const snapshot = { tracks: { weapon_sword: { level: 5, xp: 0 } }, perks: ["Ascetic", FIRST, SECOND], perkPoints: { main: 1 } };
    const taken = sut.api.esgrima.takeOut("76561198000000001", snapshot);
    assert.deepEqual(plain(taken.snapshot.perks), ["Ascetic"]);
    assert.deepEqual(plain(taken.combos), [FIRST, SECOND]);
    assert.deepEqual(plain(taken.snapshot.tracks), plain(snapshot.tracks));
    assert.deepEqual(plain(taken.snapshot.perkPoints), { main: 1 });
    assert.deepEqual(plain(sut.state.files.get(FILE)), { "76561198000000001": [FIRST, SECOND] });
    assert.equal(snapshot.perks.length, 3, "what was saved is not changed in place");

    sut.api.esgrima.takeOut("76561198000000001", snapshot);
    assert.deepEqual(plain(sut.state.files.get(FILE)), { "76561198000000001": [FIRST, SECOND] }, "twice writes it once");
    const none = { tracks: {}, perks: ["Ascetic"], perkPoints: {} };
    assert.equal(sut.api.esgrima.takeOut("76561198000000002", none).snapshot, none, "the same object when it held none");
    assert.equal(sut.api.takeOutCombos("76561198000000001", snapshot).perks.length, 1);
    assert.equal(sut.api.esgrima.takeOut("not a steam id", snapshot).snapshot.perks.length, 1, "even so the combos leave the restore");
    assert.ok(!sut.state.files.get(FILE)["not a steam id"], "but nothing is written down for a name that is no Steam id");
});

test("a little after an entry the combos are handed over by addPerk, at once, and the log says it (KCDC 1.7.2: a restore leaves a blocked perk out)", () => {
    const sut = load({ stored: { "76561198000000001": [FIRST, SECOND] } });
    sut.api.esgrima.load();
    const hans = sut.player("Hans", { steamId: "76561198000000001", perks: ["Ascetic"] });
    sut.api.esgrima.refill(hans, (fn, ms) => sut.state.timers.push({ fn, ms }));
    assert.deepEqual(plain(sut.state.restores), [], "not by a restore, which would leave them out");
    assert.deepEqual(plain(sut.state.added), [["Hans", FIRST], ["Hans", SECOND]], "by addPerk, the two in the first round");
    assert.equal(sut.state.timers.at(-1).ms, sut.api.CHECK_AFTER_MS);
    sut.state.timers.at(-1).fn();
    assert.ok(sut.state.logs.some((line) => line === "esgrima: Hans: 2 combo(s) de volta"), sut.state.logs.join("|"));
    assert.ok(sut.state.emitted.some(([who, event]) => who === "Hans" && event === "kcdc-gamemode:status.esgrima"), "and the page is told");
});

test("what the game did not take at once is given once more, a few at a time", () => {
    const stored = { "76561198000000001": COMBOS.slice(0, 9).map((combo) => combo.perk) };
    const sut = load({ stored });
    sut.api.esgrima.load();
    let calls = 0;
    // The first nine orders go out and are lost; the later ones hold.
    const hans = sut.player("Hans", {
        steamId: "76561198000000001",
        addPerk(name) {
            calls += 1;
            sut.state.added.push(["Hans", name]);
            if (calls > 9) hans.perks = [...hans.perks, name];
            return true;
        },
    });
    const later = (fn, ms) => sut.state.timers.push({ fn, ms });
    sut.api.esgrima.refill(hans, later);
    assert.equal(sut.state.added.length, 9, "all nine went out in the first round");
    assert.equal(hans.perks.length, 0, "and none was taken");
    sut.state.timers.at(-1).fn();
    assert.equal(sut.state.added.length, 9 + sut.api.BATCH, "the second try: a few");
    assert.ok(sut.state.logs.some((line) => /o jogo não pegou 9 de 9 combo\(s\) de uma vez; mais uma vez, aos poucos/.test(line)), sut.state.logs.join("|"));
    let rounds = 0;
    while (hans.perks.length < 9 && rounds < 10) {
        rounds += 1;
        const next = sut.state.timers.at(-1);
        assert.equal(next.ms, sut.api.BATCH_EVERY_MS);
        next.fn();
    }
    assert.equal(hans.perks.length, 9);
    assert.deepEqual(plain(sut.state.added.slice(9).map(([, name]) => name)), plain(stored["76561198000000001"]));
});

test("an administrator is given every combo, and an administrator who has them all is given none; a player with none stored is given none", () => {
    const sut = load();
    const admin = sut.player("Mauro", { admin: true });
    const later = (fn, ms) => sut.state.timers.push({ fn, ms });
    sut.api.esgrima.refill(admin, later);
    assert.equal(sut.state.added.length, sut.api.GIVE_ROUND, "the first round of the four");
    pump(sut, sut.api.GIVE_EVERY_MS);
    assert.equal(sut.state.added.length, 51);
    assert.equal(new Set(sut.state.added.map(([, perk]) => perk)).size, 51, "each once");
    sut.state.added.length = 0;
    sut.api.esgrima.refill(admin, later);
    assert.deepEqual(plain(sut.state.added), [], "all of them are there: nothing is asked");
    const hans = sut.player("Hans");
    sut.api.esgrima.refill(hans, later);
    assert.deepEqual(plain(sut.state.added), [], "and nothing for a player who knows none");
});

test("a player who is gone before the check is left alone; the entry schedules the refill a while after it", () => {
    const sut = load({ stored: { "76561198000000001": [FIRST] } });
    sut.api.installEsgrima();
    const hans = sut.player("Hans", { steamId: "76561198000000001" });
    sut.state.handlers.get("playerReady")(hans);
    const timer = sut.state.timers.at(-1);
    assert.equal(timer.ms, sut.api.REFILL_AFTER_MS);
    assert.ok(sut.api.REFILL_AFTER_MS > 20_000, "after the checks of the levels' restore (5 s and 20 s)");
    timer.fn();
    assert.equal(sut.state.added.length, 1, "the refill ran: the combo was handed over");
    sut.state.online.delete(hans.id);
    sut.state.timers.at(-1).fn();
    assert.equal(sut.state.added.length, 1, "and a player who is gone is not asked again");
    const gone = sut.player("Jan", { steamId: "76561198000000002" });
    sut.api.esgrima.refill(gone, (fn, ms) => sut.state.timers.push({ fn, ms }));
    sut.state.online.delete(gone.id);
});

test("the page asks, and is answered: the list only for who has the section, what a combo is only for who knows it, teaching and taking one away through the same answers", () => {
    const sut = load();
    sut.api.installEsgrima();
    const none = sut.player("Hans");
    sut.state.clients.get("kcdc-gamemode:status.esgrima")(none, "{}");
    assert.deepEqual(sut.state.emitted, [], "a player who knows no combo is sent no list");
    const jan = sut.player("Jan", { perks: [FIRST] });
    sut.state.clients.get("kcdc-gamemode:status.esgrima")(jan, "{}");
    assert.equal(sut.state.emitted.at(-1)[1], "kcdc-gamemode:status.esgrima");
    assert.equal(sut.state.emitted.at(-1)[2].combos.length, 1);

    sut.state.clients.get("kcdc-gamemode:status.esgrimaInfo")(jan, JSON.stringify({ id: FIRST }));
    assert.equal(sut.state.emitted.at(-1)[1], "kcdc-gamemode:status.esgrimaInfo");
    const before = sut.state.emitted.length;
    sut.state.clients.get("kcdc-gamemode:status.esgrimaInfo")(jan, JSON.stringify({ id: SECOND }));
    sut.state.clients.get("kcdc-gamemode:status.esgrimaInfo")(jan, "not json");
    sut.state.clients.get("kcdc-gamemode:status.esgrimaInfo")(jan, JSON.stringify({ id: 5 }));
    assert.equal(sut.state.emitted.length, before, "nothing for a combo they do not know, or nonsense");

    sut.state.clients.get("kcdc-gamemode:status.esgrimaTeach")(jan, JSON.stringify({ id: FIRST, targetId: none.id }));
    assert.ok(sut.state.notices.some(([who, text]) => who === "Jan" && /^Você ensinou o combo .+ a Hans\.$/.test(text)), JSON.stringify(sut.state.notices));
    assert.deepEqual(plain(sut.state.added), [["Hans", FIRST]]);
    sut.state.clients.get("kcdc-gamemode:status.esgrimaTeach")(jan, JSON.stringify({ id: 4, targetId: none.id }));
    sut.state.clients.get("kcdc-gamemode:status.esgrimaRetire")(jan, JSON.stringify({ id: FIRST, targetId: none.id }));
    assert.ok(sut.state.notices.some(([who, text]) => who === "Jan" && text === "Só um administrador retira um combo."));
    assert.deepEqual(plain(sut.state.removed), []);
});

test("a deleted character's combos go with it; the file is read back as it was written, and what is not a combo is dropped", () => {
    const sut = load({ stored: { "76561198000000001": [FIRST, "Ascetic", 7], "76561198000000002": ["Ascetic"], oops: [FIRST], "76561198000000003": "no" } });
    sut.api.esgrima.load();
    assert.deepEqual(plain(sut.api.esgrima.keptFor("76561198000000001")), [FIRST]);
    assert.deepEqual(plain(sut.api.esgrima.keptFor("76561198000000002")), []);
    assert.deepEqual(plain(sut.api.esgrima.keptFor("oops")), []);
    assert.equal(sut.api.esgrima.forget("76561198000000001"), true);
    assert.equal(sut.api.esgrima.forget("76561198000000001"), false);
    assert.deepEqual(plain(sut.state.files.get(FILE)), {});
});

test("a file that cannot be read is not written over, and says so", () => {
    const sut = load({ corrupt: true });
    sut.api.esgrima.load();
    assert.ok(sut.state.logs.some((line) => /ilegível \(bad json\); nada será gravado por cima/.test(line)));
    sut.api.esgrima.takeOut("76561198000000001", { tracks: {}, perks: [FIRST], perkPoints: {} });
    assert.equal(sut.state.files.has(FILE), false, "nothing written");
});

test("every line comes in the language of who reads it, with the combo's own name in that language (2026-10-26)", () => {
    const sut = load();
    const john = sut.player("John", { perks: [FIRST], lang: "en" });
    const hans = sut.player("Hans");
    const eva = sut.player("Eva", { lang: "en" });
    assert.equal(sut.api.esgrima.teach(john, FIRST, hans.id).message, `You taught the combo ${COMBOS[0].name[1]} to Hans.`);
    assert.ok(sut.state.notices.some(([who, text]) => who === "Hans" && text === `John ensinou a você o combo ${COMBOS[0].name[0]}: veja na seção Esgrima do painel (F2).`), "the Portuguese reader is told in Portuguese");
    assert.equal(sut.api.esgrima.teach(john, FIRST, eva.id).ok, true);
    assert.ok(sut.state.notices.some(([who, text]) => who === "Eva" && text === `John taught you the combo ${COMBOS[0].name[1]}: see the Fencing section of the panel (F2).`), JSON.stringify(sut.state.notices));
    assert.equal(sut.api.esgrima.teach(john, SECOND, eva.id).message, "You can only teach the combos you know.");
    assert.equal(sut.api.esgrima.teach(john, FIRST, hans.id).message, "Hans already knows that combo.");
    assert.equal(sut.api.esgrima.teach(john, FIRST, 999).message, "That player is no longer on the server.");
    assert.equal(sut.api.esgrima.teach(john, "C99 (x)", eva.id).message, "That combo does not exist.");
    assert.equal(sut.api.esgrima.teach(john, FIRST, john.id).message, "You already know that combo.");

    const admin = sut.player("Mauro", { admin: true, lang: "en" });
    assert.equal(sut.api.esgrima.retire(john, FIRST, eva.id).message, "Only an administrator takes a combo away.");
    assert.equal(sut.api.esgrima.retire(admin, FIRST, eva.id).message, `You took the combo ${COMBOS[0].name[1]} from Eva.`);
    assert.ok(sut.state.notices.some(([who, text]) => who === "Eva" && text === `An administrator took the combo ${COMBOS[0].name[1]} from you.`));
    assert.equal(sut.api.esgrima.retire(admin, FIRST, eva.id).message, "Eva does not know that combo.");
});

test("an administrator who becomes one mid-session (/admin) is given all 51 combos at once; asking again asks the game for nothing (2026-10-26)", () => {
    const sut = load();
    sut.api.installEsgrima();
    const later = (fn, ms) => sut.state.timers.push({ fn, ms });
    const mauro = sut.player("Mauro", { steamId: "76561198000000010", perks: ["Ascetic", FIRST] });
    assert.equal(sut.api.esgrima.visible(mauro), true, "one combo is enough to see the section");
    mauro.admin = true;
    sut.api.esgrima.roleChanged(mauro, later);
    assert.deepEqual(plain(sut.state.restores), [], "not by a restore, which leaves a blocked perk out (KCDC 1.7.2)");
    assert.equal(sut.state.added.length, sut.api.GIVE_ROUND, "the first round at once");
    // The rounds that follow, a third of a second apart: all 51 in about a second.
    const rounds = sut.state.timers.filter((timer) => timer.ms === sut.api.GIVE_EVERY_MS);
    assert.equal(rounds.length, 1, "each round schedules the next");
    pump(sut, sut.api.GIVE_EVERY_MS);
    assert.equal(sut.state.added.length, 50, "the 50 they lacked, each once");
    assert.equal(mauro.perks.filter((perk) => sut.api.isCombo(perk)).length, 51);
    const told = sut.state.emitted.filter(([who, event]) => who === "Mauro" && event === "kcdc-gamemode:status.esgrima");
    assert.ok(told.length >= 1 && told.at(-1)[2].admin === true && told.at(-1)[2].combos.length === 51, "the page is told at once, with the whole list");
    sut.state.timers.filter((timer) => timer.ms >= sut.api.CHECK_AFTER_MS).at(-1).fn();
    assert.ok(sut.state.logs.some((line) => line === "esgrima: Mauro: 50 combo(s) de volta"), sut.state.logs.join("|"));
    assert.equal(sut.state.files.has(FILE), false, "what the role lends is not written down as theirs");

    sut.state.added.length = 0;
    sut.api.esgrima.roleChanged(mauro, later);
    assert.deepEqual(plain(sut.state.added), [], "they have them all: nothing is asked");
    assert.ok(LOG_FREE(sut), "no Steam id in the log");
});

test("should the game take none of the administrator's combos at first, they are given again, a few at a time, until it does", () => {
    const sut = load();
    const later = (fn, ms) => sut.state.timers.push({ fn, ms });
    let calls = 0;
    const mauro = sut.player("Mauro", {
        steamId: "76561198000000010",
        admin: true,
        addPerk(name) {
            calls += 1;
            sut.state.added.push(["Mauro", name]);
            if (calls > 51) mauro.perks = [...mauro.perks, name];
            return true;
        },
    });
    sut.api.esgrima.roleChanged(mauro, later);
    // Every quick round goes out and is lost.
    pump(sut, sut.api.GIVE_EVERY_MS);
    assert.equal(sut.state.added.length, 51);
    assert.equal(mauro.perks.length, 0);
    sut.state.timers.filter((timer) => timer.ms >= sut.api.CHECK_AFTER_MS).at(-1).fn();
    assert.equal(sut.state.added.length, 51 + sut.api.BATCH, "then a few at a time");
    let rounds = 0;
    while (mauro.perks.length < 51 && rounds < 30) {
        rounds += 1;
        const next = sut.state.timers.at(-1);
        assert.equal(next.ms, sut.api.BATCH_EVERY_MS);
        next.fn();
    }
    assert.equal(mauro.perks.length, 51);
});

test("an administrator who goes back to a common player (/admin sair) keeps only what is theirs: the lent combos leave their game, the taught one stays (2026-10-26)", () => {
    const sut = load({ stored: { "76561198000000010": [SECOND] } });
    sut.api.esgrima.load();
    const later = (fn, ms) => sut.state.timers.push({ fn, ms });
    const mauro = sut.player("Mauro", { steamId: "76561198000000010", admin: true, perks: ["Ascetic"] });
    sut.api.esgrima.roleChanged(mauro, later);
    pump(sut, sut.api.GIVE_EVERY_MS);
    assert.equal(mauro.perks.filter((perk) => sut.api.isCombo(perk)).length, 51);

    mauro.admin = false;
    sut.api.esgrima.roleChanged(mauro, later);
    assert.equal(sut.state.removed.length, 50, "all but the one that is theirs");
    assert.ok(sut.state.removed.every(([who, perk]) => who === "Mauro" && perk !== SECOND));
    assert.deepEqual(plain(mauro.perks.filter((perk) => sut.api.isCombo(perk))), [SECOND]);
    assert.ok(mauro.perks.includes("Ascetic"), "what is not a combo is not touched");
    assert.ok(sut.state.logs.some((line) => line === "esgrima: Mauro deixou de ser administrador: 50 combo(s) do cargo saíram do jogo dele"), sut.state.logs.join("|"));
    const view = sut.state.emitted.filter(([who, event]) => who === "Mauro" && event === "kcdc-gamemode:status.esgrima").at(-1)[2];
    assert.equal(view.admin, false);
    assert.deepEqual(plain(view.combos.map((row) => row.id)), [SECOND], "the page shows what a player would see");
    assert.equal(sut.api.esgrima.visible(mauro), true);

    const hans = sut.player("Hans", { steamId: "76561198000000011" });
    sut.api.esgrima.roleChanged(hans, later);
    assert.deepEqual(plain(sut.state.removed.filter(([who]) => who === "Hans")), [], "a player who knew none loses none");
});

test("an administrator may take a combo for themselves in the section, when the game does not hold it; nothing is written down; a player cannot (2026-10-26)", () => {
    const sut = load();
    const admin = sut.player("Mauro", { admin: true });
    const outcome = sut.api.esgrima.teach(admin, FIRST, undefined);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.message, `O combo ${COMBOS[0].name[0]} voltou ao seu jogo.`);
    assert.deepEqual(plain(sut.state.added), [["Mauro", FIRST]]);
    assert.equal(sut.state.files.has(FILE), false, "the role's, not theirs");
    assert.equal(sut.api.esgrima.teach(admin, FIRST, undefined).message, "Você já conhece esse combo.", "the game holds it now");
    assert.equal(sut.api.esgrima.teach(admin, SECOND, admin.id).ok, true, "choosing oneself in the list is the same");
    assert.equal(sut.api.esgrima.teach(admin, THIRD, null).ok, true);

    const hans = sut.player("Hans", { perks: [FIRST] });
    assert.equal(sut.api.esgrima.teach(hans, FIRST, undefined).message, "Você já conhece esse combo.");
    assert.equal(sut.api.esgrima.teach(hans, SECOND, undefined).message, "Você só ensina os combos que conhece.");
    const stubborn = sut.player("Ondra", { admin: true, refusesAdd: true });
    assert.equal(sut.api.esgrima.teach(stubborn, FIRST, undefined).message, "O jogo não aceitou o combo agora. Tente de novo em instantes.");

    const english = sut.player("John", { admin: true, lang: "en" });
    assert.equal(sut.api.esgrima.teach(english, FIRST, undefined).message, `The combo ${COMBOS[0].name[1]} is back in your game.`);
});

test("the page's message with no target is the administrator's own: it reaches the same answer", () => {
    const sut = load();
    sut.api.installEsgrima();
    const admin = sut.player("Mauro", { admin: true });
    sut.state.clients.get("kcdc-gamemode:status.esgrimaTeach")(admin, JSON.stringify({ id: FIRST }));
    assert.deepEqual(plain(sut.state.added), [["Mauro", FIRST]]);
    assert.ok(sut.state.notices.some(([who, text]) => who === "Mauro" && text === `O combo ${COMBOS[0].name[0]} voltou ao seu jogo.`), JSON.stringify(sut.state.notices));
});

test("every combo at once in a saved character is an administrator's loan, never written down as the player's own; what is saved carries no combo (2026-10-26)", () => {
    const sut = load();
    const all = COMBOS.map((combo) => combo.perk);
    const taken = sut.api.esgrima.takeOut("76561198000000001", { tracks: {}, perks: ["Ascetic", ...all], perkPoints: {} });
    assert.deepEqual(plain(taken.snapshot.perks), ["Ascetic"], "the game is not asked to restore them either");
    assert.equal(sut.state.files.has(FILE), false, "and none is written down");
    assert.ok(sut.state.logs.some((line) => /os 51 combos de uma vez \(o cargo de administrador os empresta\)/.test(line)), sut.state.logs.join("|"));

    sut.api.esgrima.takeOut("76561198000000002", { tracks: {}, perks: all.slice(0, 50), perkPoints: {} });
    assert.equal(sut.state.files.get(FILE)["76561198000000002"].length, 50, "a set that is not whole is somebody's own");

    const snapshot = { tracks: { weapon_sword: { level: 5, xp: 0 } }, perks: ["Ascetic", FIRST, SECOND], perkPoints: { main: 1 } };
    const saved = sut.api.leaveOutCombos(snapshot);
    assert.deepEqual(plain(saved.perks), ["Ascetic"]);
    assert.deepEqual(plain(saved.tracks), plain(snapshot.tracks));
    assert.equal(snapshot.perks.length, 3, "not changed in place");
    const none = { tracks: {}, perks: ["Ascetic"], perkPoints: {} };
    assert.equal(sut.api.leaveOutCombos(none), none, "the same object when it held none");
});
