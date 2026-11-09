"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The perks the alchemy tables cannot work with (src/server/perk-guard.ts): the two known by name, and those the framework's
// `nativeModifierTieOrderRequired:<guid>` names, looked up in the game's perk tables when the resource starts.

const GUID = "ca293053-bcd4-49cc-9432-68d651b2b114";
const perk = (name, extra = {}) => ({ name, id: `id-${name}`, uiName: "", track: "alchemy", level: 0, parent: null, visibility: "visible", kinds: ["param"], autolearnable: false, ...extra });

function load({ findPerk, perks, keepDefault = false, already = [], strong = false } = {}) {
    const logs = [];
    const blocked = [];
    const sandbox = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Progression: {
            findPerk: findPerk ?? ((query) => (query === GUID ? perk("Secrets of equilibrium I", { id: GUID }) : null)),
            perks: perks ?? (() => [perk("Secrets of equilibrium I", { id: GUID }), perk("Secrets of equilibrium II", { parent: "Secrets of equilibrium I" }), perk("Secrets of equilibrium III", { parent: "Secrets of equilibrium II" }), perk("Ascetic", { track: "main" })]),
            blockedPerks: already,
            blockPerks: (names) => blocked.push(...names),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/perk-guard.js"), "utf8"), sandbox);
    // The tests below are of the guard switched on, which is how it starts (the tests at the end); it is set here so that they say what they
    // test whatever the default is.
    if (!keepDefault) {
        sandbox.exports.perkGuard.enabled = true;
        // The passives too strong for the server (2026-11-01) are blocked by the same call: the tests of the alchemy family leave them out unless asked.
        sandbox.exports.strongGuard.enabled = strong;
    }
    return { api: sandbox.exports, logs, blocked };
}

const names = (list) => Array.from(list, (one) => one.name);
/** The family the guard knows before it looks anything up. */
const BY_NAME = ["Secrets of matter I", "Secrets of matter II", "Secrets of equilibrium I", "Secrets of equilibrium II"];

test("the GUID the framework named is looked up at start, and the perk with every perk that stands on it is blocked", () => {
    const sut = load();
    assert.deepEqual(names(sut.api.UNSUPPORTED_PERKS), BY_NAME, "before: the four known by name");
    sut.api.installPerkGuard();
    assert.deepEqual(names(sut.api.UNSUPPORTED_PERKS), [...BY_NAME, "Secrets of equilibrium III"], "and the one standing on them, found by the GUID");
    assert.deepEqual(sut.blocked, names(sut.api.UNSUPPORTED_PERKS), "all of them are blocked on the perk screen");
    assert.ok(sut.logs.some((line) => line.includes(`${GUID} é "Secrets of equilibrium I"`) && line.includes('"Secrets of equilibrium II"')), sut.logs.join("|"));
    assert.ok(sut.logs.some((line) => /árvore da alquimia \(4\)/.test(line)), "the alchemy tree is written down once");
});

test("a saved character that has them loses them and gets a point each in the tree of the perk", () => {
    const sut = load();
    sut.api.installPerkGuard();
    const snapshot = { tracks: {}, perks: ["Ascetic", "Secrets of equilibrium I", "Secrets of equilibrium II", "Secrets of matter I"], perkPoints: { alchemy: 1, main: 2 } };
    const cleaned = sut.api.cleanSnapshot(snapshot);
    assert.deepEqual(Array.from(cleaned.snapshot.perks), ["Ascetic"]);
    assert.deepEqual(Array.from(cleaned.removed), ["Secrets of equilibrium I", "Secrets of equilibrium II", "Secrets of matter I"]);
    assert.equal(cleaned.snapshot.perkPoints.alchemy, 4);
    assert.equal(cleaned.snapshot.perkPoints.main, 2);

    const clean = { tracks: {}, perks: ["Ascetic"], perkPoints: {} };
    assert.equal(sut.api.cleanSnapshot(clean).snapshot, clean, "the same object when it had none of them");
});

test("a GUID the tables do not know, a system perk, and a lookup that throws leave the blocked list as it was", () => {
    const unknown = load({ findPerk: () => null, perks: () => [] });
    unknown.api.installPerkGuard();
    assert.deepEqual(names(unknown.api.UNSUPPORTED_PERKS), BY_NAME);
    assert.ok(unknown.logs.some((line) => /não é um talento/.test(line)));

    const system = load({ findPerk: () => perk("Core rule", { visibility: "system" }), perks: () => [] });
    system.api.installPerkGuard();
    assert.deepEqual(names(system.api.UNSUPPORTED_PERKS), BY_NAME);
    assert.ok(system.logs.some((line) => /talento de sistema/.test(line)));

    const broken = load({ findPerk: () => { throw new Error("tables not ready"); }, perks: () => [] });
    broken.api.installPerkGuard();
    assert.deepEqual(broken.blocked, BY_NAME, "the four known by name are still blocked");
    assert.ok(broken.logs.some((line) => /não consegui procurar.*tables not ready/.test(line)));
});

test("a perk without a tree gives its point back to the main bank, and a lookup run twice adds nothing twice", () => {
    const sut = load({ findPerk: () => perk("Odd one", { track: null }), perks: () => [perk("Odd one", { track: null })] });
    sut.api.resolveBrokenPerks(["x"]);
    sut.api.resolveBrokenPerks(["x"]);
    assert.deepEqual(names(sut.api.UNSUPPORTED_PERKS).filter((name) => name === "Odd one").length, 1);
    const cleaned = sut.api.cleanSnapshot({ tracks: {}, perks: ["Odd one"], perkPoints: { main: 1 } });
    assert.equal(cleaned.snapshot.perkPoints.main, 2);
});

test("every perk of the alchemy tree called Secrets of ... is blocked by its name, with no GUID needed; the others of the tree are left alone", () => {
    const tree = ["Secrets of matter I", "Secrets of matter II", "Secrets of equilibrium I", "Secrets of equilibrium II", "Secrets of the unknown I", "Secret of secrets", "Purple haze", "Water of life"].map((name) => perk(name));
    const sut = load({ findPerk: () => null, perks: () => tree });
    sut.api.installPerkGuard();
    assert.deepEqual(names(sut.api.UNSUPPORTED_PERKS), [...BY_NAME, "Secrets of the unknown I"], "a fifth of the family is found in the tree");
    assert.deepEqual(sut.blocked, names(sut.api.UNSUPPORTED_PERKS));
    assert.ok(sut.logs.some((line) => line.includes('"Secrets of the unknown I" é da família')), sut.logs.join("|"));
    assert.ok(!sut.logs.some((line) => line.includes("Secret of secrets") && /bloqueado/.test(line)));
});

test("on as the server starts (user, 2026-10-21: \"vamos desativar a alquimia de novo, não todas as passivas, mas tem uma que quebra a alquimia\"): the family is blocked, a saved character loses it, the rest of the alchemy tree is left alone", () => {
    const sut = load({ keepDefault: true });
    assert.equal(sut.api.perkGuard.enabled, true);
    sut.api.installPerkGuard();
    assert.deepEqual(sut.blocked, [...names(sut.api.UNSUPPORTED_PERKS), ...names(sut.api.STRONG_PERKS)], "the family, and the passives too strong for the server");
    for (const name of BY_NAME) {
        assert.ok(sut.blocked.includes(name), name);
    }
    assert.ok(!sut.blocked.includes("Ascetic") && !sut.blocked.includes("Purple haze"), "the other passives are not blocked");
    // Luance's file on 2026-10-21: "Secrets of matter I" and "II", and the rest of her perks.
    const snapshot = { tracks: {}, perks: ["Ascetic", "Secrets of matter I", "Secrets of matter II", "Purple haze"], perkPoints: { alchemy: 0, main: 1 } };
    const cleaned = sut.api.cleanSnapshot(snapshot);
    assert.deepEqual(Array.from(cleaned.snapshot.perks), ["Ascetic", "Purple haze"]);
    assert.deepEqual(Array.from(cleaned.removed), ["Secrets of matter I", "Secrets of matter II"]);
    assert.equal(cleaned.snapshot.perkPoints.alchemy, 2, "a point back for each, in the alchemy tree");
    assert.equal(cleaned.snapshot.perkPoints.main, 1);
});

test("the GUID the log named on 2026-10-21 (Secrets of matter I) is among those looked up, and is told in the log by its name", () => {
    assert.ok(load().api.BROKEN_PERK_GUIDS.includes("f9de0477-2f59-4eec-b522-fa943f542277"));
    assert.ok(load().api.BROKEN_PERK_GUIDS.includes(GUID));
    const matter = "f9de0477-2f59-4eec-b522-fa943f542277";
    const sut = load({ findPerk: (query) => (query === matter ? perk("Secrets of matter I", { id: matter }) : null), perks: () => [perk("Secrets of matter I", { id: matter })] });
    sut.api.installPerkGuard();
    assert.deepEqual(names(sut.api.UNSUPPORTED_PERKS), BY_NAME, "already one of the four: nothing is added twice");
    assert.ok(sut.logs.some((line) => line.includes(`${matter} é "Secrets of matter I"`) && /bloqueado/.test(line)), sut.logs.join("|"));
});

test("switched off (as it was from 2026-10-19 to 2026-10-21, \"ative de volta as passivas de alquimia\"): nothing is blocked and a saved character keeps its perks", () => {
    const sut = load();
    sut.api.perkGuard.enabled = false;
    sut.api.installPerkGuard();
    assert.deepEqual(sut.blocked, []);
    assert.ok(sut.logs.some((line) => /passivas de alquimia .* liberadas/.test(line)));
    const snapshot = { tracks: {}, perks: ["Secrets of matter I", "Ascetic"], perkPoints: { alchemy: 0 } };
    const cleaned = sut.api.cleanSnapshot(snapshot);
    assert.equal(cleaned.snapshot, snapshot);
    assert.deepEqual(Array.from(cleaned.removed), []);
});

test("what the server already blocks is kept when the guard blocks its own, and nothing is blocked twice (2026-10-26)", () => {
    const sut = load({ already: ["C01 (longsword)", "Secrets of matter I"] });
    sut.api.installPerkGuard();
    assert.ok(sut.blocked.includes("C01 (longsword)"), "the combo stays blocked");
    assert.equal(new Set(sut.blocked).size, sut.blocked.length, "each name once");
    for (const name of BY_NAME) assert.ok(sut.blocked.includes(name), name);
});

// ---------------------------------------------------------------------------------------------
// The passives too strong for the server (2026-11-01, user: "desativa essas passivas roubadas, deixe apenas Marbon com elas; os jogadores que a tinham, retire e devolve os pontos").

const MARBON = "76561198906140019";
const NINE = ["Hard to kill", "Revenant II", "Runaway boy", "Clean cut", "Sundering blow II", "Painkiller", "Ringenmeister", "Master thief", "Zaklady bohoslovectvi meta"];

test("the nine are the ones the review of the passives calls too strong, each with its tree and its Portuguese name", () => {
    const sut = load({ strong: true });
    assert.deepEqual(names(sut.api.STRONG_PERKS), NINE);
    const verdicts = fs.readFileSync(path.join(__dirname, "../tools/perks-verdicts.py"), "utf8");
    const strong = [...verdicts.matchAll(/^\s+"([^"]+)": v\("forte",/gm)].map((match) => match[1]);
    assert.deepEqual(strong.slice().sort(), NINE.slice().sort(), "the same list as tools/perks-verdicts.py");
    assert.deepEqual(Array.from(sut.api.STRONG_PERKS, (one) => one.track), ["vitality", "vitality", "vitality", "weapon_sword", "heavy_weapons", "heavy_weapons", "weapon_unarmed", "thievery", "scholarship"]);
    assert.equal(sut.api.strongName("Hard to kill"), "Duro de Matar");
    assert.equal(sut.api.strongName("Zaklady bohoslovectvi meta"), "Teologia");
    assert.equal(sut.api.strongName("Ascetic"), "Ascetic");
});

test("at start the nine are blocked for everybody, with what the server already blocked kept", () => {
    const sut = load({ strong: true, already: ["C01 (longsword)"] });
    sut.api.installPerkGuard();
    for (const name of NINE) assert.ok(sut.blocked.includes(name), name);
    assert.ok(sut.blocked.includes("C01 (longsword)"), "what was blocked before stays blocked");
    assert.ok(sut.logs.some((line) => /passivas fortes demais bloqueadas para todos \(Duro de Matar, Ressuscitado II/.test(line)), sut.logs.join("|"));
});

test("a player who had them loses them and gets a point back for each in its tree; the alchemy ones are told apart", () => {
    const sut = load({ strong: true });
    const snapshot = { tracks: {}, perks: ["Ascetic", "Hard to kill", "Revenant II", "Clean cut", "Master thief", "Secrets of matter I"], perkPoints: { vitality: 1, main: 2 } };
    const cleaned = sut.api.cleanSnapshot(snapshot, "76561198000000005");
    assert.deepEqual(Array.from(cleaned.snapshot.perks), ["Ascetic"]);
    assert.deepEqual(Array.from(cleaned.strong), ["Hard to kill", "Revenant II", "Clean cut", "Master thief"]);
    assert.deepEqual(Array.from(cleaned.removed), ["Secrets of matter I", "Hard to kill", "Revenant II", "Clean cut", "Master thief"]);
    assert.deepEqual(Array.from(cleaned.kept), []);
    assert.deepEqual(JSON.parse(JSON.stringify(cleaned.snapshot.perkPoints)), { vitality: 3, main: 2, weapon_sword: 1, thievery: 1, alchemy: 1 });
    const none = { tracks: {}, perks: ["Ascetic"], perkPoints: {} };
    assert.equal(sut.api.cleanSnapshot(none, "x").snapshot, none, "the same object when it had none");
});

test("Marbon keeps them: left out of what is restored, with no point back, and handed over again by addPerk, the ones he lacks", () => {
    const sut = load({ strong: true });
    const snapshot = { tracks: {}, perks: ["Ascetic", "Hard to kill", "Master thief"], perkPoints: { vitality: 0 } };
    const cleaned = sut.api.cleanSnapshot(snapshot, MARBON);
    assert.deepEqual(Array.from(cleaned.snapshot.perks), ["Ascetic"]);
    assert.deepEqual(Array.from(cleaned.kept), ["Hard to kill", "Master thief"]);
    assert.deepEqual(Array.from(cleaned.removed), []);
    assert.equal(cleaned.snapshot.perkPoints.vitality, 0, "no point back");
    assert.equal(sut.api.isStrongKeeper(MARBON), true);
    assert.equal(sut.api.isStrongKeeper("76561198000000005"), false);

    const added = [];
    const marbon = { steamId: MARBON, nickname: "Player", perks: ["Ascetic", "Hard to kill"], addPerk(name) { added.push(name); return name !== "Painkiller"; } };
    assert.equal(sut.api.giveStrongPerks(marbon), 7, "eight asked for, the game took seven");
    assert.deepEqual(added, NINE.filter((name) => name !== "Hard to kill"));
    assert.ok(sut.logs.some((line) => /o jogo não aceitou Painkiller para Player/.test(line)));
    const other = { steamId: "76561198000000005", nickname: "Kath", perks: [], addPerk() { throw new Error("must not be asked"); } };
    assert.equal(sut.api.giveStrongPerks(other), 0, "nobody else is given any");
});

test("switched off, the strong passives are neither blocked nor taken from anybody", () => {
    const sut = load({ strong: false });
    sut.api.perkGuard.enabled = false;
    sut.api.installPerkGuard();
    assert.deepEqual(sut.blocked, []);
    const snapshot = { tracks: {}, perks: ["Hard to kill"], perkPoints: {} };
    assert.equal(sut.api.cleanSnapshot(snapshot, "x").snapshot, snapshot);
    assert.equal(sut.api.isStrongKeeper(MARBON), false);
});
