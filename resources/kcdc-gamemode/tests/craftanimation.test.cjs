"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { lowered, torch } = require("./torchstub.cjs");

// What a player's hands do while a trade's work is done (src/server/craft-animation.ts): the game's own animation at that place
// first (the pan at a fire), then one found by the trade's words, then the game's own played by name.

function load(catalog) {
    const logs = [];
    const played = [];
    const context = {
        require: (id) => (id === "./torch-down.js" ? torch : assert.fail(`unexpected require ${id}`)),
        exports: {},
        console: { log: (line) => logs.push(line) },
        Animations: {
            list: (search) => catalog.filter((row) => `${row.fragment} ${row.tags}`.toLowerCase().includes(String(search).toLowerCase())),
            props: () => [],
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-animation.js"), "utf8"), context);
    const player = { playAnimation: (fragment, options) => { played.push({ fragment, options }); return true; }, stopAnimation() {} };
    return { api: context.exports, logs, played, player };
}

const row = (fragment, extra = {}) => ({ fragment, tags: "", duration: 3, oneShot: false, fullBody: true, rightHand: "", leftHand: "", male: true, female: true, sequence: "", ...extra });

test("at a fire the cooks' own stirring of the pot is played, when the catalog has it, before anything found by a word", () => {
    const sut = load([row("CookingStirPot"), row("Cooking"), row("CookingPanKitchen", { tags: "playerUse" })]);
    assert.equal(sut.api.pickWorkAnimation("fogo").fragment, "Cooking");
    assert.match(sut.logs.at(-1), /a do próprio jogo nesse lugar/);
    assert.equal(sut.api.playWork(sut.player, "fogo"), true);
    assert.equal(sut.played[0].fragment, "Cooking");
    assert.equal(sut.played[0].options.loop, true);
});

test("never the player's own kitchen pan, whose sound every client played at full volume wherever they were", () => {
    const sut = load([row("CookingPanKitchen", { tags: "playerUse" }), row("CookingPanCampx")]);
    const picked = sut.api.pickWorkAnimation("fogo");
    assert.notEqual(picked.fragment, "CookingPanKitchen", "not even found by the word 'cook'");
    assert.equal(picked.fragment, "CookingPanCampx");
    const none = load([row("CookingPanKitchen")]);
    assert.equal(none.api.pickWorkAnimation("fogo").fragment, "Cooking", "and by name, the cooks' one, never the pan");
});

test("without the game's own in the catalog a word finds one, and without either the game's own is played by name", () => {
    const found = load([row("CookingStirPot")]);
    assert.equal(found.api.pickWorkAnimation("fogo").fragment, "CookingStirPot");
    const none = load([]);
    assert.equal(none.api.pickWorkAnimation("defumador").fragment, "SmokehouseSniff");
    assert.match(none.logs.at(-1), /pelo nome \(fora do catálogo\)/);
    assert.equal(none.api.pickWorkAnimation("forja"), null, "a forge has no own one to fall back on");
});

test("the Coletores' work plays the woodcutter's felling with the lumberjack's axe in hand, and the stonemason's pick (2026-10-21)", () => {
    const played = [];
    const context = {
        require: (id) => (id === "./torch-down.js" ? torch : assert.fail(`unexpected require ${id}`)),
        exports: {},
        console: { log() {} },
        Animations: {
            list: (search) => [row("LumberJackCuttingTree", { rightHand: "axe_tool", male: true, female: false }), row("StonemasonPick", { rightHand: "pickaxe", male: true, female: false })].filter((one) => one.fragment.toLowerCase().includes(String(search).toLowerCase())),
            props: () => [{ name: "axeWork01", hand: "axe", model: "a" }, { name: "axe_chopping", hand: "axe_tool", model: "b" }, { name: "lumberjack_axe", hand: "axe_tool", model: "b" }, { name: "pick", hand: "pickaxe", model: "c" }, { name: "axeBattle03", hand: "axe", model: "d" }],
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-animation.js"), "utf8"), context);
    const player = { playAnimation: (fragment, options) => { played.push({ fragment, options }); return true; }, stopAnimation() {} };
    assert.equal(context.exports.playWork(player, "lenha"), true);
    assert.equal(context.exports.playWork(player, "mina"), true);
    assert.deepEqual(played.map(({ fragment, options }) => [fragment, options.props?.item, options.lockMovement]), [["LumberJackCuttingTree", "lumberjack_axe", true], ["StonemasonPick", "axeBattle03", true]]);
});

test("the pick in the hand falls back to the miner's own when the catalog has no knight's pick prop (2026-10-22)", () => {
    const played = [];
    const context = {
        require: (id) => (id === "./torch-down.js" ? torch : assert.fail(`unexpected require ${id}`)),
        exports: {},
        console: { log() {} },
        Animations: {
            list: (search) => [row("StonemasonPick", { rightHand: "", male: true, female: false })].filter((one) => one.fragment.toLowerCase().includes(String(search).toLowerCase())),
            props: () => [{ name: "pick", hand: "pickaxe", model: "c" }],
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-animation.js"), "utf8"), context);
    const player = { playAnimation: (fragment, options) => { played.push({ fragment, options }); return true; }, stopAnimation() {} };
    assert.equal(context.exports.playWork(player, "mina"), true);
    assert.equal(played[0].options.props.item, "pick");
    assert.equal(played[0].options.props.hand, "right");
});

// ---------------------------------------------------------------------------------------------
// The game's own work, step by step (2026-10-25: "ao selecionar um item passar para a animação de forja do vanilla").

function routineSut(catalog, propNames = ["big_blacksmith_hammer", "semifinished_sword", "wooden_scoop", "flask", "herb_coltsfoot", "pestle", "mortar"]) {
    const logs = [];
    const played = [];
    const timers = [];
    const context = {
        require: (id) => (id === "./torch-down.js" ? torch : assert.fail(`unexpected require ${id}`)),
        exports: {},
        console: { log: (line) => logs.push(line) },
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; },
        clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
        Animations: {
            list: (search) => catalog.filter((one) => one.fragment.toLowerCase().includes(String(search).toLowerCase())),
            props: () => propNames.map((name) => ({ name, hand: "light", model: name + ".cgf" })),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/craft-animation.js"), "utf8"), context);
    const spawns = [];
    const player = {
        id: 7,
        nickname: "Hans",
        position: { x: 0, y: 0, z: 10 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        playAnimation: (fragment, options) => { played.push({ fragment, options: JSON.parse(JSON.stringify(options)) }); return true; },
        stopAnimation: () => { played.push({ fragment: "(stop)" }); return true; },
        spawn: (at, rotation) => { spawns.push({ at: { x: at.x, y: at.y }, heading: rotation.z }); return true; },
    };
    // Runs the routine's steps in time order.
    const runAll = () => timers.filter((one) => !one.cleared).sort((a, b) => a.ms - b.ms).forEach((one) => one.fn());
    return { api: context.exports, logs, played, timers, player, spawns, runAll };
}

const FORGE = [
    row("BlacksmithBehaviorHeatingIn", { oneShot: true, duration: 4, female: false }),
    row("BlacksmithBehaviorHeatingLoop", { tags: "forgeBag", duration: 5, female: false }),
    row("BlacksmithBehaviorHeatingToForging", { oneShot: true, duration: 3, female: false }),
    row("BlacksmithBehaviorForgingLoop", { duration: 6, female: false }),
    row("BlacksmithBehaviorForgingOut", { oneShot: true, duration: 5, female: false }),
    row("BlacksmithingAnvilIdle", { tags: "slaveTongs" }),
];

test("the forge plays the game's smith: the blade heated at the hearth, hammered on the anvil and quenched, hammer and blade in the hands while it is hammered, over the recipe's time", () => {
    const sut = routineSut(FORGE);
    const heldBefore = lowered.length;
    assert.equal(sut.api.playWork(sut.player, "forja", { ms: 24_000, point: { x: 0, y: 2, z: 10 } }), true);
    assert.equal(lowered.length - heldBefore, 1, "a torch in the hand is put away once, before the work begins (2026-10-25)");
    sut.runAll();
    assert.deepEqual(sut.played.map((one) => one.fragment), ["BlacksmithBehaviorHeatingIn", "BlacksmithBehaviorHeatingLoop", "BlacksmithBehaviorHeatingToForging", "BlacksmithBehaviorForgingLoop", "BlacksmithBehaviorForgingOut"]);
    const hammering = sut.played[3].options;
    assert.equal(hammering.loop, true);
    assert.equal(hammering.lockMovement, true);
    assert.deepEqual(hammering.props, [{ item: "big_blacksmith_hammer", hand: "right" }, { item: "semifinished_sword", hand: "left" }]);
    // The hand-over events inside the other clips (pickup/place at the anvil's slots) let go of a prop and left it hanging in the air
    // (user, 2026-10-25: "fica um martelo flutuando na hora de forjar"): the tools are in the hands only for the hammering.
    for (const index of [0, 1, 2, 4]) {
        assert.equal(sut.played[index].options.props, undefined, `${sut.played[index].fragment}: empty hands`);
    }
    assert.equal(sut.played[1].options.tags, "forgeBag");
    // 24 s: 12 s of steps played once, the 12 left shared 1:3 between the heating and the hammering.
    assert.deepEqual(sut.timers.map((one) => one.ms), [4_000, 7_000, 10_000, 19_000]);
    assert.equal(sut.spawns.length, 0, "already facing the anvil: no turn");
    assert.ok(sut.logs.some((line) => /^craft: rotina de forja \(homem\): BlacksmithBehaviorHeatingIn 4\.0 s > BlacksmithBehaviorHeatingLoop\[forgeBag\] \(repete\) > BlacksmithBehaviorHeatingToForging 3\.0 s > BlacksmithBehaviorForgingLoop \(repete\) d:big_blacksmith_hammer e:semifinished_sword > BlacksmithBehaviorForgingOut 5\.0 s$/.test(line)), sut.logs.join("\n"));
});

test("a short piece of work leaves the heating out, the body is turned to the station first, and stopping the work stops the steps to come", () => {
    const sut = routineSut(FORGE);
    // 12 s: the heating's 7 s played once would be more than its share; the hammering and the quench stay.
    sut.api.playWork(sut.player, "forja", { ms: 12_000, point: { x: 3, y: 0, z: 10 } });
    assert.deepEqual(sut.spawns, [{ at: { x: 0, y: 0 }, heading: -90 }], "turned to face the anvil, 3 m to the east");
    assert.equal(sut.played.length, 0, "the first step waits for the turn");
    assert.deepEqual(sut.timers.map((one) => one.ms), [300, 7_300]);
    sut.timers[0].fn();
    assert.equal(sut.played[0].fragment, "BlacksmithBehaviorForgingLoop");
    sut.api.stopWork(sut.player);
    assert.equal(sut.timers[1].cleared, true, "the quench is not played after the work stopped");
    assert.equal(sut.played.at(-1).fragment, "(stop)");
});

test("a woman's body, for which the game has no smith, keeps the trade's one animation; at the alchemy table she grinds at the mortar", () => {
    const sut = routineSut([...FORGE, row("ApothecaryMortarIn", { oneShot: true, duration: 2, male: false }), row("ApothecaryMortar", { duration: 4, male: false }), row("ApothecaryMortarOut", { oneShot: true, duration: 2, male: false }), row("AlchemyPutBasis", { tags: "alchemyPot", female: false })]);
    sut.api.playWork(sut.player, "forja", { ms: 16_000, female: true });
    assert.equal(sut.played[0].fragment, "BlacksmithingAnvilIdle", "the old way");
    assert.ok(sut.logs.some((line) => /rotina de forja \(mulher\): o catálogo não tem BlacksmithBehaviorHeatingIn, .*fica a animação de antes/.test(line)));
    sut.api.playWork(sut.player, "alquimia", { ms: 20_000, female: true });
    sut.runAll();
    assert.deepEqual(sut.played.slice(-3).map((one) => one.fragment), ["ApothecaryMortarIn", "ApothecaryMortar", "ApothecaryMortarOut"]);
    assert.deepEqual(sut.played.at(-2).options.props, [{ item: "pestle", hand: "right" }, { item: "mortar", hand: "left" }]);
});

test("an open fire stirs the pot over the fire, a cauldron the ladle; the scoop is in the hand; and the camp pan is never played", () => {
    const sut = routineSut([row("CookingIn", { oneShot: true, duration: 2 }), row("CookingIn", { tags: "campfire", oneShot: true, duration: 2 }), row("Cooking"), row("Cooking", { tags: "campfire" }), row("CookingOut", { oneShot: true, duration: 2 }), row("CookingOut", { tags: "campfire", oneShot: true, duration: 2 }), row("CookingPanCamp")]);
    sut.api.playWork(sut.player, "fogo", { ms: 12_000, campfire: true });
    sut.runAll();
    assert.deepEqual(sut.played.map((one) => [one.fragment, one.options.tags]), [["CookingIn", "campfire"], ["Cooking", "campfire"], ["CookingOut", "campfire"]]);
    assert.deepEqual(sut.played[1].options.props, [{ item: "wooden_scoop", hand: "right" }]);
    assert.equal(sut.played[0].options.props, undefined, "the scoop is taken from its slot by an event of the way in...");
    assert.equal(sut.played[2].options.props, undefined, "...and put back by one of the way out: a prop in the hand there is let go and left in the air");
    sut.played.length = 0;
    sut.api.playWork(sut.player, "fogo", { ms: 12_000, campfire: false });
    sut.runAll();
    assert.deepEqual(sut.played.map((one) => [one.fragment, one.options.tags]), [["CookingIn", ""], ["Cooking", ""], ["CookingOut", ""]]);
    assert.ok(sut.api.PLAYER_ONLY_SOUND.has("cookingpancamp"), "its kettle sound is the player's own head's");
});

test("a piece of work too short for the quench is all hammering", () => {
    const sut = routineSut(FORGE);
    sut.api.playWork(sut.player, "forja", { ms: 8_000 });
    assert.deepEqual(sut.played.map((one) => one.fragment), ["BlacksmithBehaviorForgingLoop"]);
    assert.equal(sut.timers.length, 0);
});
