const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The torch is put away before an animation plays on a player (src/server/torch-down.ts, 2026-10-25: "nas animações gerais, quando o
// jogador vai fazer e estiver com tochas em mãos, a tocha deve abaixar"). The modules that play animations call `lowerTorch`; their own
// tests stand a stub in for it (torchstub.cjs) and check it was asked.

const TORCH = "aaaaaaaa-bbbb-cccc-dddd-0123456789ab";
const SWORD = "11111111-2222-3333-4444-556677889900";
const SECOND_TORCH = "bbbbbbbb-bbbb-cccc-dddd-0123456789ab";

// The docs' own conversion, written again here so the test does not lean on the module's.
function engineClass(guid) {
    const hex = guid.replace(/-/g, "");
    const tail = hex.slice(16).match(/../g).reverse().join("");
    return hex.slice(12, 16) + hex.slice(8, 12) + hex.slice(0, 8) + tail;
}

function load({ inventoryOk = true, bagThrows = false } = {}) {
    const logs = [];
    const chat = [];
    const sets = [];
    const gets = { count: 0 };
    const bags = new Map();
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Chat: { sendToPlayer: (player, text) => chat.push([player.nickname, text]) },
        Inventory: {
            get: (player) => {
                gets.count += 1;
                if (bagThrows) throw new Error("o inventário caiu");
                return bags.get(player.id) ?? null;
            },
            set: (player, request) => {
                sets.push([player.nickname, JSON.parse(JSON.stringify(request))]);
                return inventoryOk ? { ok: true, code: "" } : { ok: false, code: "inventoryUnavailable" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/torch-down.js"), "utf8"), context);
    let nextId = 1;
    const body = (nickname, { right = "", left = "", rows = [], ready = true, bagReady = true } = {}) => {
        const player = { id: nextId++, nickname, ready, rightHandItem: right, leftHandItem: left };
        bags.set(player.id, { ready: bagReady, revision: 3, items: rows, quickslots: { a: "row-1" } });
        return player;
    };
    return { api: context.exports, logs, chat, sets, gets, body };
}

const row = (id, item, name, equipped = 1, extra = {}) => ({ id, item, name, amount: 1, equipped, metadata: { quality: 1 }, ...extra });

test("the class of an item is spelled as the hands report it, the docs' conversion", () => {
    const sut = load();
    assert.equal(sut.api.itemClassOf(TORCH), engineClass(TORCH));
    assert.equal(sut.api.itemClassOf("1fc42528-2bef-4dde-bf8a-04febeef41c8"), "4dde2bef1fc42528c841efbefe048abf", "the example in the notes (axeWork01)");
});

test("a torch drawn in a hand is put away: its row un-equipped, every other row and the quick slots as they were", () => {
    const sut = load();
    const jan = sut.body("Jan", {
        right: engineClass(SWORD),
        left: engineClass(TORCH),
        rows: [row("row-1", SWORD, "huntingSwordBasic", 1), row("row-2", TORCH, "rutinaAVypad_trackview_torch_weapon", 1), row("row-3", "99999999-0000-0000-0000-000000000000", "apple", 0, { amount: 3 })],
    });
    assert.equal(sut.api.lowerTorch(jan), true);
    assert.equal(sut.sets.length, 1);
    const [, request] = sut.sets[0];
    assert.deepEqual(request.items.map((one) => [one.id, one.equipped, one.amount]), [["row-1", 1, 1], ["row-2", 0, 1], ["row-3", 0, 3]], "only the torch comes off: the sword in the other hand stays");
    assert.deepEqual(request.quickslots, { a: "row-1" });
    assert.deepEqual(request.items[1].metadata, { quality: 1 });
    assert.deepEqual(sut.chat, [["Jan", "Você abaixou a tocha para fazer isso. Empunhe-a de novo quando terminar."]]);
});

test("both torches of the game's tables are torches, and a torch in each hand comes off both; a torch equipped but not in a hand, empty hands and a drawn sword leave the bag alone", () => {
    const sut = load();
    const two = sut.body("Duas", { right: engineClass(TORCH), left: engineClass(SECOND_TORCH), rows: [row("a", TORCH, "rutinaAVypad_trackview_torch_weapon"), row("b", SECOND_TORCH, "torch_weapon")] });
    assert.equal(sut.api.lowerTorch(two), true);
    assert.deepEqual(sut.sets[0][1].items.map((one) => one.equipped), [0, 0]);

    const sheathed = sut.body("Embainhada", { rows: [row("a", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    const before = sut.gets.count;
    assert.equal(sut.api.lowerTorch(sheathed), false);
    assert.equal(sut.gets.count, before, "empty hands: the bag is not even read");

    const elsewhere = sut.body("Longe", { left: engineClass("55555555-6666-7777-8888-999999999999"), rows: [row("a", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    assert.equal(sut.api.lowerTorch(elsewhere), false, "the hand holds something that is not that torch");
    const swordsman = sut.body("Espada", { right: engineClass(SWORD), rows: [row("s", SWORD, "huntingSwordBasic")] });
    assert.equal(sut.api.lowerTorch(swordsman), false, "a sword is not put away: only torches");
    assert.equal(sut.sets.length, 1, "nothing else was put away");
});

test("the player is told once a minute at most", () => {
    const sut = load();
    const jan = sut.body("Jan", { left: engineClass(TORCH), rows: [row("t", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    assert.equal(sut.api.lowerTorch(jan, 1_000), true);
    assert.equal(sut.api.lowerTorch(jan, 30_000), true);
    assert.equal(sut.chat.length, 1);
    assert.equal(sut.api.lowerTorch(jan, 62_000), true);
    assert.equal(sut.chat.length, 2);
});

test("an inventory that is not ready and a player not in the world are left alone; a bag that refuses says so in the log and nobody is told a torch went down", () => {
    const sut = load();
    const loading = sut.body("Carregando", { left: engineClass(TORCH), bagReady: false, rows: [row("t", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    assert.equal(sut.api.lowerTorch(loading), false);
    const early = sut.body("Cedo", { left: engineClass(TORCH), ready: false, rows: [row("t", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    assert.equal(sut.api.lowerTorch(early), false);
    assert.equal(sut.sets.length, 0);

    const refused = load({ inventoryOk: false });
    const jan = refused.body("Jan", { left: engineClass(TORCH), rows: [row("t", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    assert.equal(refused.api.lowerTorch(jan), false);
    assert.ok(refused.logs.some((line) => /a tocha de Jan não pôde ser abaixada \(inventoryUnavailable\)/.test(line)), refused.logs.join("|"));
    assert.equal(refused.chat.length, 0);
});

test("a bag that throws never reaches the animation: lowerTorch answers false and the log says what happened", () => {
    const sut = load({ bagThrows: true });
    const jan = sut.body("Jan", { left: engineClass(TORCH), rows: [row("t", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    assert.equal(sut.api.lowerTorch(jan), false);
    assert.ok(sut.logs.some((line) => /tocha: não consegui abaixar a tocha de Jan: (Error: )?o inventário caiu/.test(line)), sut.logs.join("|"));
});

test("a hand that reads wrong is no torch and no error", () => {
    const sut = load();
    const jan = sut.body("Jan", { rows: [row("t", TORCH, "rutinaAVypad_trackview_torch_weapon")] });
    jan.leftHandItem = 42;
    jan.rightHandItem = undefined;
    assert.equal(sut.api.lowerTorch(jan), false);
    assert.equal(sut.logs.length, 0);
});
