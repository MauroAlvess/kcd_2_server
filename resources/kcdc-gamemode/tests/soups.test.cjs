"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The tavern keepers' soups (src/server/soups.ts; user, 2026-10-20: "adicione sopa nas receitas do taverneiro na profissão da guilda"):
// items of our own with an action in the bag, which fill the stomach and quench a little thirst, and the recipes of the fire that make them.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
    const data = { exports: {}, require: () => assert.fail("craft-data requires nothing") };
    vm.runInNewContext(dist("craft-data.js"), data);
    const state = { chat: [], handlers: new Map(), removed: [], removeOk: true, quenched: [], emitted: [], logs: [] };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./craft-data.js") return data.exports;
            if (id === "./thirst.js") return { thirstPace: { quench: (player, amount) => state.quenched.push({ id: player.id, amount }) } };
            return assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => state.logs.push(line) },
        Math,
        JSON,
        Number,
        Chat: { sendToPlayer: (player, text) => state.chat.push({ to: player.id, text }) },
        Inventory: {
            remove: (player, request) => {
                state.removed.push({ id: player.id, request: plain(request) });
                return { ok: state.removeOk };
            },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
    };
    vm.runInNewContext(dist("soups.js"), context);
    const player = (over = {}) => {
        const made = {
            id: 7,
            nickname: "Hans",
            ready: true,
            alive: true,
            hunger: 40,
            maxHunger: 100,
            sets: [],
            setHunger(value) {
                this.sets.push(value);
                this.hunger = value;
                return true;
            },
            emit: (event, payload) => state.emitted.push({ event, payload: JSON.parse(payload) }),
            ...over,
        };
        return made;
    };
    const row = (name = "kcdc-craft:sopa-repolho", over = {}) => ({ id: "row1", item: "guid", name, amount: 2, quality: 1, health: 1, condition: 1, equipped: 0, metadata: {}, ...over });
    return { api: context.exports, data: data.exports, state, player, row };
}

test("every soup is an item of our own with an action in the bag and an effect, in the order the recipes name them", () => {
    const { data } = load();
    const soups = Object.keys(data.CUSTOM_ITEMS).filter((id) => id.startsWith("kcdc-craft:sopa-"));
    assert.equal(soups.length, 12);
    assert.deepEqual(plain(Object.keys(data.SOUP_EFFECTS)), plain(soups), "an effect for every soup, and no other");
    for (const id of soups) {
        const [name, description, visual, weight, price, verb] = plain(data.CUSTOM_ITEMS[id]);
        assert.ok(name.length > 3, id);
        assert.match(description, /Sacia \d+% da fome e mata um pouco da sede\.$/, id);
        assert.match(visual, /^[0-9a-f-]{36}$/, `${id}: looks like a game item`);
        assert.ok(weight > 0 && price > 0, id);
        assert.ok(verb === "Comer" || verb === "Tomar", `${id}: the action is Comer or Tomar`);
        const [nutrition, thirst] = plain(data.SOUP_EFFECTS[id]);
        assert.ok(nutrition >= 0.15 && nutrition <= 0.4, `${id}: fills between 15 and 40 of a hundred, as the game's own food does (bread 19, a roast 26)`);
        assert.ok(thirst > 0 && thirst <= 25, id);
        assert.match(description, new RegExp(`Sacia ${Math.round(nutrition * 100)}% `), `${id}: the description says what the effect is`);
    }
    // The other custom items are not food.
    for (const id of ["kcdc-craft:farinha", "kcdc-craft:malte", "kcdc-craft:lupulo", "kcdc-craft:linha", "kcdc-craft:madeira"]) {
        assert.equal(plain(data.CUSTOM_ITEMS[id])[5], undefined, `${id}: no action`);
        assert.equal(data.SOUP_EFFECTS[id], undefined, id);
    }
});

test("the fire has a category of soups for the tavern keepers, each batch made from the kitchen's goods and worth its level", () => {
    const { data } = load();
    const soups = data.CRAFT_RECIPES.filter((recipe) => recipe.category === "Sopas");
    assert.equal(soups.length, 12);
    assert.ok(soups.every((recipe) => recipe.station === "fogo" && recipe.track === "survival" && recipe.output.startsWith("kcdc-craft:sopa-")), "at the fire, training survival, making our soups");
    assert.ok(soups.every((recipe) => recipe.id === `fogo:${recipe.output.slice("kcdc-craft:".length)}`), "named after what they make");
    assert.ok(soups.every((recipe) => recipe.amount >= 2 && recipe.amount <= 3), "two or three bowls from a pot");
    const levels = soups.map((recipe) => recipe.level);
    assert.deepEqual(plain(levels), plain([...levels].sort((a, b) => a - b)), "easier soups first");
    assert.ok(levels[0] >= 3 && levels.at(-1) <= 20, "from the fire's third level to its twentieth");
    for (const recipe of soups) {
        assert.ok(recipe.ingredients.length >= 4 && recipe.ingredients.length <= 7, `${recipe.id}: a handful of ingredients`);
        for (const [item, amount] of recipe.ingredients) {
            assert.ok(amount >= 1 && amount <= 2, `${recipe.id}: one or two of each`);
            assert.ok(item in data.CRAFT_ITEMS, `${recipe.id}: the page knows ${item}`);
        }
        assert.ok(recipe.xp > 0 && recipe.seconds >= 7, recipe.id);
    }
    // The page can name and draw each soup.
    for (const recipe of soups) {
        const [name, icon] = plain(data.CRAFT_ITEMS[recipe.output]);
        assert.equal(name, plain(data.CUSTOM_ITEMS[recipe.output])[0]);
        assert.ok(icon === "loot_copperPlate" || icon === "budovaniLazni_mug", `${recipe.output}: looks like a plate or a mug`);
    }
    // A cabbage soup at level 3 needs only what a garden gives, with salt and water.
    const cabbage = soups.find((recipe) => recipe.id === "fogo:sopa-repolho");
    assert.equal(cabbage.level, 3);
    assert.deepEqual(plain(cabbage.ingredients.map(([item]) => data.CRAFT_ITEMS[item][0])), ["Repolho", "Cebola", "Sal", "Água potável"]);
});

test("eating a soup takes one bowl from the bag, fills the share of the stomach it says, quenches the thirst and says so", () => {
    const sut = load();
    const hans = sut.player({ hunger: 40 });
    const result = sut.api.eat(hans, sut.row("kcdc-craft:sopa-repolho"), 12);
    assert.equal(result.ok, true);
    assert.deepEqual(sut.state.removed, [{ id: 7, request: { units: [{ id: "row1", amount: 1 }], revision: 12, notify: false } }]);
    assert.deepEqual(hans.sets, [62], "22 of a hundred on 40");
    assert.deepEqual(sut.state.quenched, [{ id: 7, amount: 14 }]);
    assert.equal(result.message, "Você come sopa de repolho: sacia 22% da fome e um pouco da sede.");

    // A broth is drunk, and the stomach's own size is the scale.
    const big = sut.player({ hunger: 100, maxHunger: 400 });
    const broth = sut.api.eat(big, sut.row("kcdc-craft:sopa-galinha"), 3);
    assert.equal(broth.ok, true);
    assert.deepEqual(big.sets, [220], "30 of a hundred of a stomach of 400 is 120, on 100");
    assert.equal(broth.message, "Você toma caldo de galinha: sacia 30% da fome e um pouco da sede.");

    // Never past full.
    const nearly = sut.player({ hunger: 90 });
    sut.api.eat(nearly, sut.row("kcdc-craft:sopa-gulache"), 1);
    assert.deepEqual(nearly.sets, [100]);
});

test("a stomach that is full takes no soup, and nothing is spent; neither does a body that is not up, or a bag that changed", () => {
    const sut = load();
    const full = sut.player({ hunger: 98 });
    const refused = sut.api.eat(full, sut.row(), 1);
    assert.equal(refused.ok, false);
    assert.equal(refused.message, "Você está sem fome: sopa de repolho fica na bolsa para depois.");
    assert.deepEqual(sut.state.removed, [], "the bowl stays");
    assert.deepEqual(full.sets, []);
    assert.deepEqual(sut.state.quenched, []);

    for (const over of [{ ready: false }, { alive: false }]) {
        assert.equal(sut.api.eat(sut.player(over), sut.row(), 1).ok, false);
    }
    assert.deepEqual(sut.state.removed, []);
    assert.equal(sut.api.eat(sut.player({ hunger: Number.NaN }), sut.row(), 1).ok, false, "a stomach not read yet");

    sut.state.removeOk = false;
    const hans = sut.player({ hunger: 10 });
    const stale = sut.api.eat(hans, sut.row(), 5);
    assert.equal(stale.ok, false);
    assert.equal(stale.message, "Não consegui pegar o prato agora. Tente de novo.");
    assert.deepEqual(hans.sets, [], "nothing is given for a bowl that was not taken");
    assert.deepEqual(sut.state.quenched, []);

    // A stomach with no size known is the game's hundred.
    sut.state.removeOk = true;
    const unknown = sut.player({ hunger: 50, maxHunger: 0 });
    assert.equal(sut.api.eat(unknown, sut.row("kcdc-craft:sopa-alho"), 1).ok, true);
    assert.deepEqual(unknown.sets, [74]);
});

test("the action in the bag reaches the server by the custom-item event: a soup is eaten and told, anything else is left to the others", () => {
    const sut = load();
    sut.api.installSoups();
    assert.ok(sut.state.logs.some((line) => /soups: 12 sopas nas receitas do fogo/.test(line)));
    const use = sut.state.handlers.get("playerCustomItemUse");
    const hans = sut.player({ hunger: 20 });

    use(hans, sut.row("kcdc-craft:sopa-cogumelos"), 4);
    assert.equal(hans.hunger, 48);
    assert.deepEqual(sut.state.chat.map((line) => line.text), ["Você come sopa de cogumelos: sacia 28% da fome e um pouco da sede."]);
    assert.deepEqual(sut.state.emitted.map((entry) => [entry.event, entry.payload.text]), [["kcdc-gamemode:notify", "Você come sopa de cogumelos: sacia 28% da fome e um pouco da sede."]], "and as a toast, over the panel");

    use(hans, sut.row("kcdc-book:smith-1"), 5);
    use(hans, sut.row("kcdc-craft:farinha"), 5);
    assert.equal(sut.state.removed.length, 1, "a book or the flour is not a soup");

    const full = sut.player({ hunger: 100 });
    use(full, sut.row("kcdc-craft:sopa-urtiga"), 6);
    assert.match(sut.state.chat.at(-1).text, /^Você está sem fome/);
    assert.equal(sut.state.removed.length, 1);

    // A body not up says nothing at all.
    const before = sut.state.chat.length;
    use(sut.player({ ready: false }), sut.row(), 7);
    assert.equal(sut.state.chat.length, before);
});
