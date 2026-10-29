"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The game's armour sets by place (src/server/armor-sets.ts) and `/conjunto` (src/server/commands/conjunto.ts): list, give whole,
// dress a body in one.

const DATA = {
    "raborsch-1": { place: "Raborsch", name: "Guarda de Raborsch", category: "comum", weight: "leve", description: "Capacete de aço, jaquetão longo", price: 467, preset: "guard_raborsch_01", presetGuid: "e7534f15-32fd-4405-bc63-91f0dc1fa786", gender: "male", pieces: [{ part: "Cabeça", name: "Capacete de aço", code: "SkullCap02_m01_C2" }, { part: "Tronco", name: "Jaquetão longo", code: "GambesonLong01_m08_C3" }] },
    "malesov-1": { place: "Malešov", name: "Vigia da vila", category: "básica", weight: "leve", description: "Gibão", price: 100, preset: "x", presetGuid: "", gender: "male", pieces: [{ part: "Tronco", name: "Gibão", code: "Gambeson01_m01_D" }] },
};

function load({ full = [], refuse = false } = {}) {
    const added = [];
    const bags = new Map();
    const outfits = [];
    const armor = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/armor-sets.js"), "utf8"), {
        exports: armor.exports,
        require: (id) => (id === "node:fs" ? { readFileSync: () => JSON.stringify(DATA) } : assert.fail(id)),
        console: { log() {} },
        JSON,
        Inventory: {
            add: (player, request) => { const ok = !full.includes(request.item); if (ok) added.push([player.nickname, request.item, request.metadata?.quality]); return { ok }; },
            get: (player) => (bags.has(player.nickname) ? { revision: 1, items: bags.get(player.nickname) } : null),
            remove: (player, request) => {
                if (refuse) return { ok: false };
                const bag = bags.get(player.nickname);
                for (const unit of request.units) {
                    const row = bag.find((one) => one.id === unit.id);
                    row.amount -= unit.amount;
                }
                bags.set(player.nickname, bag.filter((row) => row.amount > 0));
                return { ok: true };
            },
        },
    });
    const players = [];
    const context = {
        exports: {},
        require: (id) => ({
            "../armor-sets.js": armor.exports,
            "../players.js": { findPlayer: (q) => { const p = players.find((one) => one.nickname.toLowerCase().startsWith(q.toLowerCase())); return p ? { player: p } : { error: `No player called '${q}'.` }; } },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Number,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/conjunto.js"), "utf8"), context);
    const make = (nickname, gender = "male") => {
        const p = { nickname, appearance: { gender }, setOutfit: (guid) => { outfits.push([nickname, guid]); return true; } };
        players.push(p);
        return p;
    };
    const run = (player, args) => {
        const lines = [];
        let usage = false;
        context.exports.conjuntoCommand.run({ player, args, reply: { line: (l) => lines.push(l), lines: (ls) => lines.push(...ls) }, usage: () => { usage = true; } });
        return { lines, usage };
    };
    return { run, make, added, outfits, bags };
}

test("the places and their sets are listed, by any spelling of the place", () => {
    const sut = load();
    const me = sut.make("Mauro");
    assert.match(sut.run(me, []).lines[0], /Lugares \(2\): Raborsch \(1\), Malešov \(1\)/);
    const malesov = sut.run(me, ["malesov"]).lines;
    assert.equal(malesov[0], "Malešov: 1 conjunto(s)");
    assert.match(malesov[1], /malesov-1 -- Vigia da vila \(básica, leve\)/);
    assert.match(sut.run(me, ["ver", "raborsch-1"]).lines.join("\n"), /Cabeça: Capacete de aço -- SkullCap02_m01_C2/);
});

test("the Brasões packs of the real data give the coat of arms, the knight's shield and the knight's sword together (2026-10-21)", () => {
    const real = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/armor-sets.json"), "utf8"));
    const packs = Object.entries(real).filter(([, set]) => set.place === "Brasões");
    assert.ok(packs.length >= 15, "one pack for each city, house, order and kingdom that has arms");
    for (const [id, set] of packs) {
        assert.match(id, /^brasao-[a-z-]+$/);
        const codes = set.pieces.map((piece) => piece.code);
        assert.ok(codes.includes("shortswordHeavy"), `${id}: the knight's sword`);
        assert.ok(codes.some((code) => /^shield(Kite|Heater)_|petrsShield$/.test(code)), `${id}: the shield of that arms`);
        assert.equal(set.presetGuid, "", `${id}: a pack is only given, never worn`);
        assert.equal(new Set(codes).size, codes.length, `${id}: no piece twice`);
    }
    const withCoat = packs.filter(([, set]) => set.pieces.some((piece) => /^Coat\d+_m/.test(piece.code)));
    assert.ok(withCoat.length >= 10, "the houses the game gives a coat of arms");
    const kuttenberg = real["brasao-kuttenberg"].pieces.map((piece) => piece.code);
    assert.deepEqual(kuttenberg, ["Coat02_mKuttenberg_D", "Coat04_mKuttenberg_C", "shieldKite_kuttenberg_A", "shortswordHeavy"]);
    assert.ok(!Object.entries(real).some(([id, set]) => set.place !== "Brasões" && id.startsWith("brasao-")), "the ids of the packs are theirs alone");
});

test("dar puts every piece in the named player's inventory, in the quality asked, and says what did not fit", () => {
    const sut = load({ full: ["GambesonLong01_m08_C3"] });
    const me = sut.make("Mauro");
    sut.make("Radovan");
    const done = sut.run(me, ["dar", "raborsch-1", "Rad", "3"]).lines[0];
    assert.deepEqual(sut.added, [["Radovan", "SkullCap02_m01_C2", 3]]);
    assert.match(done, /raborsch-1 \(Guarda de Raborsch\) para Radovan: 1 de 2 peças\. Não entraram: GambesonLong01_m08_C3/);
    assert.equal(sut.run(me, ["dar", "raborsch-1", "Mauro", "9"]).usage, true);
    assert.match(sut.run(me, ["dar", "nada-1"]).lines[0], /Não há conjunto 'nada-1'/);
});

test("vestir dresses a man's body in the game's own outfit; a woman's, or a set the server lacks, is sent to dar", () => {
    const sut = load();
    const me = sut.make("Mauro");
    sut.make("Ludmilla", "female");
    assert.match(sut.run(me, ["vestir", "raborsch-1"]).lines[0], /Mauro vestiu raborsch-1/);
    assert.deepEqual(sut.outfits, [["Mauro", "e7534f15-32fd-4405-bc63-91f0dc1fa786"]]);
    assert.match(sut.run(me, ["vestir", "raborsch-1", "Lud"]).lines[0], /corpo feminino use dar/);
    assert.match(sut.run(me, ["vestir", "malesov-1"]).lines[0], /o servidor não tem esse conjunto para vestir/);
});

test("tirar takes one unit of each piece of the set back out of the named player's inventory, and nothing else (2026-10-22)", () => {
    const sut = load();
    const me = sut.make("Mauro");
    sut.make("Joachim Meyer");
    sut.bags.set("Joachim Meyer", [
        { id: "a", name: "SkullCap02_m01_C2", amount: 1, quality: 1, equipped: 0 },
        { id: "b", name: "GambesonLong01_m08_C3", amount: 2, quality: 1, equipped: 0 },
        { id: "c", name: "GambesonLong01_m08_C3", amount: 1, quality: 3, equipped: 0 },
        { id: "d", name: "bread", amount: 4, quality: 1, equipped: 0 },
    ]);
    const done = sut.run(me, ["tirar", "raborsch-1", "Joachim"]).lines[0];
    assert.match(done, /raborsch-1 \(Guarda de Raborsch\) de Joachim Meyer: 2 de 2 peças tiradas\./);
    assert.deepEqual(sut.bags.get("Joachim Meyer").map((row) => [row.id, row.amount]), [["b", 1], ["c", 1], ["d", 4]], "one unit of the quality given, the rest and the bread stay");
    const again = sut.run(me, ["tirar", "raborsch-1", "Joachim"]).lines[0];
    assert.match(again, /1 de 2 peças tiradas\. Não estavam no inventário: SkullCap02_m01_C2/);
});

test("tirar says so when the game refuses, and takes nothing", () => {
    const sut = load({ refuse: true });
    const me = sut.make("Mauro");
    sut.bags.set("Mauro", [{ id: "a", name: "SkullCap02_m01_C2", amount: 1, quality: 1, equipped: 1 }]);
    assert.match(sut.run(me, ["tirar", "raborsch-1"]).lines[0], /O jogo recusou tirar as peças de Mauro.*Nada foi tirado/);
    assert.equal(sut.bags.get("Mauro").length, 1);
});
