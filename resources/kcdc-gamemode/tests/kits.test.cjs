const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** The real books module, so a kit's books resolve to real GUIDs. */
function loadBooks() {
    const context = {
        exports: {},
        console: { log() {} },
        Items: { register: (id) => `guid:${id}` },
        Events: { on() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/books.js"), "utf8"), context);
    context.exports.registerBooks();
    return context.exports;
}

/**
 * kept decides what character-state says about the player; looks maps steamId -> a saved look; presets lists the outfits the
 * game offers per gender; refuse names the inventory items to turn down.
 */
function load({ kept = true, looks = { 1: { appearance: { gender: "male" } } }, presets = { male: ["labourer_05", "villager_10"], female: ["f_villager_31"] } } = {}) {
    const ledger = new Set();
    const logs = [];
    const chat = [];
    const added = [];
    const given = [];
    const dressed = [];
    const state = { refuse: new Set(), giveFails: false, outfitFails: false, held: [] };
    const timers = [];
    const online = new Map();

    const context = {
        exports: {},
        require: (id) => {
            if (id === "./books.js") return loadBooks();
            if (id === "./character-state.js") {
                return {
                    canKeep: () => kept,
                    hasKit: (player, kit) => ledger.has(`${player.steamId}/${kit}`),
                    markKit: (player, kit) => ledger.add(`${player.steamId}/${kit}`),
                };
            }
            if (id === "./characters.js") return { getCharacter: (steamId) => looks[steamId] ?? null };
            // Our own items (the Agricultores' seeds) go by the GUID the game gave them once registered.
            if (id === "./craft-items.js") return { craftItemGuid: (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : null) };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Player: { outfitPresets: (gender) => presets[gender] ?? [], getById: (id) => online.get(id) ?? null },
        Inventory: {
            add: (player, request) => {
                if (state.refuse.has(request.item)) return { ok: false, code: "inventoryCapacity" };
                added.push(request);
                return { ok: true, code: "" };
            },
            get: () => ({ items: state.held.map((name, index) => ({ id: index + 1, name, item: `guid:${name}`, amount: 1 })) }),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/kits.js"), "utf8"), context);

    let nextId = 1;
    const makePlayer = (steamId = "1", gender = "male") => {
        const player = buildPlayer(steamId, gender);
        online.set(player.id, player);
        return player;
    };
    const buildPlayer = (steamId, gender) => ({
        id: nextId++,
        steamId,
        nickname: "Mauro",
        appearance: { gender },
        giveItem: (item, amount) => {
            if (state.giveFails) return false;
            given.push([item, amount]);
            return true;
        },
        setOutfit: (preset) => {
            if (state.outfitFails) return false;
            dressed.push(preset);
            return true;
        },
    });
    return { api: context.exports, ledger, logs, chat, added, given, dressed, state, makePlayer, timers, online };
}

// ---------------------------------------------------------------------------------------------

const STARTER_ITEMS = [["dieNormal", 6], ["huntingSwordBasic", 1], ["daggerCommon", 1], ["salamiDried", 3], ["beefDried", 2], ["cheeseQuarterDried", 2], ["walnuts", 2], ["rutinaAVypad_trackview_torch_weapon", 1]];

test("the starter pack is working clothes, worn, a hunting sword and a dagger, food, dice and 100 coins as the game shows them, once", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.api.ensureStarter(player);

    assert.deepEqual(sut.given, [["money", 1000]], "the game shows a tenth of the item: 1,000 reads 100");
    assert.deepEqual(sut.dressed, ["labourer_05"]);
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), STARTER_ITEMS);
    for (const part of ["starter:money:v2", "starter:outfit", "starter:weapon:huntingSwordBasic", "starter:weapon:daggerCommon", "starter:dice", "starter:food", "starter:torch"]) {
        assert.ok(sut.ledger.has(`1/${part}`), part);
    }
    assert.ok(sut.chat.some((line) => /uma tocha para as noites/.test(line)));
    assert.ok(sut.chat.some((line) => /6 dados comuns/.test(line)));
    assert.ok(sut.chat.some((line) => /roupas simples/.test(line)));
    assert.ok(sut.chat.some((line) => /uma espada de caça e uma adaga para não lutar de mãos nuas/.test(line)));
    assert.ok(sut.chat.some((line) => /comida que não estraga, para umas cinco horas: 3 salame seco, 2 carne-seca, 2 queijo seco, 2 nozes/.test(line)));

    sut.api.ensureStarter(player);
    assert.equal(sut.given.length, 1, "no second helping");
    assert.equal(sut.dressed.length, 1);
    assert.equal(sut.added.length, STARTER_ITEMS.length, "each item, once");
});

test("the food keeps, and lasts at least five hours at the default hunger level", () => {
    const sut = load();
    const food = Array.from(sut.api.STARTER_FOOD, (entry) => ({ ...entry }));
    const nourishment = food.reduce((sum, entry) => sum + entry.amount * entry.nourishment, 0);
    // A full stomach is 100 and lasts 180 minutes at "média" (hunger.ts).
    assert.ok((nourishment / 100) * 180 >= 300, `${nourishment} of nourishment is ${((nourishment / 100) * 3).toFixed(1)} h`);
    assert.deepEqual(food.map((entry) => entry.item), ["salamiDried", "beefDried", "cheeseQuarterDried", "walnuts"], "dried food: the game's tables give it no decay");
});

test("food the inventory refuses altogether is tried again at the next join; a part refused is not handed twice", () => {
    const sut = load();
    const player = sut.makePlayer();
    for (const entry of sut.api.STARTER_FOOD) sut.state.refuse.add(entry.item);
    sut.api.ensureStarter(player);
    assert.equal(sut.ledger.has("1/starter:food"), false);

    sut.state.refuse.clear();
    sut.state.refuse.add("walnuts");
    sut.api.ensureStarter(player);
    assert.equal(sut.ledger.has("1/starter:food"), true);
    assert.ok(sut.logs.some((line) => /walnuts não foi entregue/.test(line)));
    sut.state.refuse.clear();
    sut.api.ensureStarter(player);
    assert.equal(sut.added.filter((entry) => entry.item === "salamiDried").length, 1);
});

test("the starter dice are six ordinary ones, and a set the inventory refuses is tried again at the next join", () => {
    const sut = load();
    const player = sut.makePlayer();
    assert.deepEqual({ ...sut.api.STARTER_DICE }, { item: "dieNormal", amount: 6 });

    sut.state.refuse.add("dieNormal");
    sut.api.ensureStarter(player);
    assert.equal(sut.ledger.has("1/starter:dice"), false);
    assert.ok(sut.logs.some((line) => /os dados não foram entregues/.test(line)));
    assert.equal(sut.ledger.has("1/starter:weapon:huntingSwordBasic"), true, "the weapons are not held back by the dice");

    sut.state.refuse.clear();
    sut.api.ensureStarter(player);
    assert.deepEqual(sut.added.filter((entry) => entry.item === "dieNormal").map((entry) => entry.amount), [6]);
    sut.api.ensureStarter(player);
    assert.equal(sut.added.filter((entry) => entry.item === "dieNormal").length, 1, "never twice");
});

test("a character that already has everything else is given only the dice it lacks", () => {
    const sut = load();
    const player = sut.makePlayer();
    for (const part of ["starter:money:v2", "starter:outfit", "starter:weapon:huntingSwordBasic", "starter:weapon:daggerCommon", "starter:food", "starter:torch"]) sut.ledger.add(`1/${part}`);
    sut.api.ensureStarter(player);
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [["dieNormal", 6]]);
    assert.deepEqual(sut.given, []);
});

test("nothing is drawn by lot any more: everybody gets the hunting sword and the dagger", () => {
    assert.deepEqual(Array.from(load().api.STARTER_WEAPONS, (weapon) => weapon.item), ["huntingSwordBasic", "daggerCommon"]);
    for (let run = 0; run < 3; run += 1) {
        const sut = load();
        sut.api.ensureStarter(sut.makePlayer());
        assert.deepEqual(sut.added.filter((entry) => /sword|dagger/i.test(entry.item)).map((entry) => entry.item), ["huntingSwordBasic", "daggerCommon"]);
    }
});

test("a character from the time of the draw keeps the weapon it carries and gets the other one", () => {
    for (const [held, expected] of [[["huntingSwordBasic"], ["daggerCommon"]], [["daggerCommon"], ["huntingSwordBasic"]], [["shortswordTraining"], ["huntingSwordBasic", "daggerCommon"]], [[], ["huntingSwordBasic", "daggerCommon"]]]) {
        const sut = load();
        const player = sut.makePlayer();
        for (const part of ["starter:money:v2", "starter:outfit", "starter:dice", "starter:food", "starter:torch", "starter:weapon"]) sut.ledger.add(`1/${part}`);
        sut.state.held = held;
        sut.api.ensureStarter(player);
        assert.deepEqual(sut.added.map((entry) => entry.item), expected, `carrying ${held.join(", ") || "nothing"}`);
        assert.ok(sut.ledger.has("1/starter:weapon:huntingSwordBasic") && sut.ledger.has("1/starter:weapon:daggerCommon"));
        sut.api.ensureStarter(player);
        assert.equal(sut.added.length, expected.length, "and nothing more later");
    }
});

test("a weapon the inventory refuses is not written off, so the next join tries again; the other is not repeated", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.state.refuse.add("daggerCommon");
    sut.api.ensureStarter(player);
    assert.equal(sut.ledger.has("1/starter:weapon:daggerCommon"), false);
    assert.equal(sut.ledger.has("1/starter:weapon:huntingSwordBasic"), true);
    assert.ok(sut.logs.some((line) => /daggerCommon não foi entregue/.test(line)));
    assert.equal(sut.ledger.has("1/starter:money:v2"), true, "the coin is not held back by the weapon");

    sut.added.length = 0;
    sut.state.refuse.clear();
    sut.api.ensureStarter(player);
    assert.deepEqual(sut.added.map((entry) => entry.item), ["daggerCommon"]);
    assert.ok(sut.chat.some((line) => /Você recebeu uma adaga para não lutar/.test(line)));
    sut.api.ensureStarter(player);
    assert.equal(sut.added.length, 1, "once given, never again");
});

test("a character paid the first version's 100 of the item is topped up to 1,000, once, and told in coins", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.ledger.add("1/starter:money");
    sut.ledger.add("1/starter:outfit");

    sut.api.ensureStarter(player);
    assert.deepEqual(sut.given, [["money", 900]], "what was missing, not another 1,000");
    assert.ok(sut.chat.some((line) => /mais 90 moedas, para somar as 100 do começo/.test(line)));
    assert.ok(sut.ledger.has("1/starter:money:v2"));

    sut.api.ensureStarter(player);
    assert.equal(sut.given.length, 1);
    assert.equal(sut.api.STARTER_MONEY, 1000);
});

test("a top-up the game would not give is tried again at the next join", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.ledger.add("1/starter:money");
    sut.state.giveFails = true;
    sut.api.ensureStarter(player);
    assert.equal(sut.ledger.has("1/starter:money:v2"), false);
    sut.state.giveFails = false;
    sut.api.ensureStarter(player);
    assert.deepEqual(sut.given, [["money", 900]]);
});

test("a newcomer without a saved look yet is given nothing: the creator comes first", () => {
    const sut = load({ looks: {} });
    sut.api.ensureStarter(sut.makePlayer());
    assert.equal(sut.given.length + sut.dressed.length, 0);
});

test("a character that is not being kept is given nothing, since no ledger could remember it", () => {
    const sut = load({ kept: false });
    sut.api.ensureStarter(sut.makePlayer());
    assert.equal(sut.given.length + sut.dressed.length, 0);
    assert.equal(sut.ledger.size, 0);
});

test("a woman is dressed from the women's list", () => {
    const sut = load({ looks: { 1: { appearance: { gender: "female" } } } });
    sut.api.ensureStarter(sut.makePlayer("1", "female"));
    assert.deepEqual(sut.dressed, ["f_villager_31"]);
});

test("when none of the preferred outfits exists, a plain villager or labourer one is used; when none at all, nothing breaks", () => {
    const fallback = load({ presets: { male: ["knight_01", "villager_99", "labourer_77"], female: [] } });
    fallback.api.ensureStarter(fallback.makePlayer());
    assert.deepEqual(fallback.dressed, ["villager_99"]);

    const none = load({ presets: { male: ["knight_01"], female: [] } });
    none.api.ensureStarter(none.makePlayer());
    assert.deepEqual(none.dressed, []);
    assert.ok(none.logs.some((line) => /nenhuma roupa simples/.test(line)));
    assert.equal(none.ledger.has("1/starter:outfit"), false, "tried again at the next join");
    assert.equal(none.ledger.has("1/starter:money:v2"), true, "the coin is not held back by the clothes");
});

test("a part that failed is retried later while the part that worked is not repeated", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.state.outfitFails = true;
    sut.api.ensureStarter(player);
    assert.equal(sut.given.length, 1);
    assert.equal(sut.ledger.has("1/starter:outfit"), false);

    sut.state.outfitFails = false;
    sut.api.ensureStarter(player);
    assert.equal(sut.given.length, 1, "the coin is not paid twice");
    assert.deepEqual(sut.dressed, ["labourer_05"]);
});

test("the outfit follows the saved look, which is fresher than the look the client has published right after the creator", () => {
    const sut = load({ looks: { 1: { appearance: { gender: "female" } } } });
    // The client still reports the default male body.
    sut.api.ensureStarter(sut.makePlayer("1", "male"));
    assert.deepEqual(sut.dressed, ["f_villager_31"]);
});

test("a refused outfit is tried again a few times, a few seconds apart, and then left for the next join", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.state.outfitFails = true;
    sut.api.ensureStarter(player);
    assert.equal(sut.timers.length, 1);
    assert.equal(sut.timers[0].ms, 4000);

    sut.timers.shift().fn();
    sut.timers.shift().fn();
    sut.timers.shift().fn();
    assert.equal(sut.timers.length, 0, "three retries in all, and the third one's own failure schedules none");
    assert.equal(sut.dressed.length, 0);

    sut.state.outfitFails = false;
    sut.api.ensureStarter(player);
    assert.deepEqual(sut.dressed, ["labourer_05"], "the next join tries from scratch");
});

test("a retry that finds the outfit accepted stops there, and a player who left is not retried", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.state.outfitFails = true;
    sut.api.ensureStarter(player);
    sut.state.outfitFails = false;
    sut.timers.shift().fn();
    assert.deepEqual(sut.dressed, ["labourer_05"]);
    assert.equal(sut.timers.length, 0);

    const gone = sut.makePlayer("1");
    sut.ledger.delete("1/starter:outfit");
    sut.state.outfitFails = true;
    sut.api.ensureStarter(gone);
    sut.online.delete(gone.id);
    sut.timers.shift().fn();
    assert.equal(sut.timers.length, 0);
});

test("a coin the game would not give is not written off", () => {
    const sut = load();
    sut.state.giveFails = true;
    sut.api.ensureStarter(sut.makePlayer());
    assert.equal(sut.ledger.has("1/starter:money:v2"), false);
});

// ---------------------------------------------------------------------------------------------

test("the blacksmith guild hands out its two recipe books and the first materials", () => {
    const sut = load();
    const handed = sut.api.grantGuildKit(sut.makePlayer(), "fabri-ferrarii");

    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [
        ["guid:kcdc:book:ferreiro-ferramentas", 1],
        ["guid:kcdc:book:ferreiro-aprendiz", 1],
        ["bsmt_ironBad", 10],
        ["bsmt_ironGood", 2],
        ["bsmt_steelBad", 4],
        ["bsmt_hardware", 2],
    ]);
    assert.deepEqual(Array.from(handed), [
        "Manual do Ferreiro I: Ferramentas",
        "Manual do Ferreiro II: Lâminas de Aprendiz",
        "10 sucata de metal",
        "2 ferro",
        "4 aço",
        "2 material de fixação",
    ]);
});

test("the hunters' guild hands out a bow and arrows", () => {
    const sut = load();
    sut.api.grantGuildKit(sut.makePlayer(), "venatores");
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [["bow_b", 1], ["arrow_hunting", 20], ["arrow_normal", 20]]);
});

test("the tavern keepers' guild hands out raw meat", () => {
    const sut = load();
    sut.api.grantGuildKit(sut.makePlayer(), "tabernarii");
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [["pigMeat", 3]]);
});

test("the alchemists' guild hands out its first recipe book and the herbs for the first potions", () => {
    const sut = load();
    sut.api.grantGuildKit(sut.makePlayer(), "alchemistae");
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [
        ["guid:kcdc:book:alquimia-aprendiz", 1],
        ["herb_urticaria", 5],
        ["herb_marigold", 8],
        ["herb_dandelion", 4],
        ["herb_thistle", 4],
        ["special_charcoal", 2],
    ]);
});

test("a guild kit comes once per guild, however often the guild is joined", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.api.grantGuildKit(player, "venatores");
    const first = sut.added.length;

    assert.deepEqual(Array.from(sut.api.grantGuildKit(player, "venatores")), []);
    assert.equal(sut.added.length, first);

    sut.api.grantGuildKit(player, "tabernarii");
    assert.equal(sut.added.length, first + 1, "another guild has its own kit");
    sut.api.grantGuildKit(player, "venatores");
    assert.equal(sut.added.length, first + 1, "and going back to the first brings nothing");
});

test("an item the inventory refuses is not marked, so only it is retried", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.state.refuse.add("arrow_hunting");
    const handed = sut.api.grantGuildKit(player, "venatores");
    assert.deepEqual(Array.from(handed), ["arco de aveleira", "20 flechas comuns"]);

    sut.state.refuse.clear();
    const later = sut.api.grantGuildKit(player, "venatores");
    assert.deepEqual(Array.from(later), ["20 flechas de caça"]);
});

test("a character that is not being kept gets no kit, and is told why", () => {
    const sut = load({ kept: false });
    assert.deepEqual(Array.from(sut.api.grantGuildKit(sut.makePlayer(), "venatores")), []);
    assert.equal(sut.added.length, 0);
    assert.match(sut.chat.at(-1), /não está sendo salvo/);
});

test("a guild without a kit, or one that does not exist, hands out nothing", () => {
    const sut = load();
    assert.deepEqual(Array.from(sut.api.grantGuildKit(sut.makePlayer(), "sartores")), []);
    assert.equal(sut.added.length, 0);
});

test("the Coletores' kit: the lumberjack's axe, the pick used and worn, and working clothes cut for the body (2026-10-21)", () => {
    const sut = load({ looks: { 1: { appearance: { gender: "male" } }, 2: { appearance: { gender: "female" } } } });
    const man = sut.makePlayer("1", "male");
    const handed = sut.api.grantGuildKit(man, "collectores");
    assert.deepEqual(sut.added.map((entry) => entry.item), ["axeWork01", "axeBattle03", "TunicShort03_m01_D", "HoseSeparate05_m01_D", "Hood08_m01_D", "BootsAnkle01_m03_C", "HandWrap01_m01_E"]);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.added[1].metadata)), { quality: 1, condition: 0.5 }, "the pick is worn: the smith makes new ones");
    assert.equal(sut.added[0].metadata, undefined);
    assert.deepEqual(Array.from(handed).slice(0, 2), ["machado de lenhador", "picareta (usada)"]);

    const woman = sut.makePlayer("2", "female");
    sut.added.length = 0;
    sut.api.grantGuildKit(woman, "collectores");
    assert.deepEqual(sut.added.map((entry) => entry.item), ["axeWork01", "axeBattle03", "F_SimpleDress06_m05_D", "F_Veil06_m01_D", "F_Shoes02_m06_B", "HandWrap01_m01_E"]);
    assert.equal(sut.ledger.has("2/guild:collectores:2"), false, "a piece for the other body is not marked as given");
    sut.added.length = 0;
    assert.deepEqual(Array.from(sut.api.grantGuildKit(woman, "collectores")), [], "and nothing twice");
});

test("the Domadores' kit: treats to win a horse over with, and riding clothes cut for the body (2026-10-25)", () => {
    const sut = load({ looks: { 1: { appearance: { gender: "male" } }, 2: { appearance: { gender: "female" } } } });
    const man = sut.makePlayer("1", "male");
    const handed = sut.api.grantGuildKit(man, "domitores");
    assert.deepEqual(sut.added.map((entry) => entry.item), ["carrot", "apple", "TunicShort01_m01_D", "HoseLoose01_m01_C", "BootsKnee05_m01_C", "Cap03_m01_E", "HandWrap01_m03_E"]);
    assert.deepEqual(sut.added.slice(0, 2).map((entry) => entry.amount), [6, 4]);
    assert.deepEqual(Array.from(handed).slice(0, 2), ["6 cenouras", "4 maçãs"]);

    const woman = sut.makePlayer("2", "female");
    sut.added.length = 0;
    sut.api.grantGuildKit(woman, "domitores");
    assert.deepEqual(sut.added.map((entry) => entry.item), ["carrot", "apple", "F_SimpleDress03_m01_C", "F_Hood01_m01_C", "F_Shoes02_m01_B", "HandWrap01_m03_E"]);
    assert.equal(sut.ledger.has("2/guild:domitores:2"), false, "a piece for the other body is not marked as given");
    sut.added.length = 0;
    assert.deepEqual(Array.from(sut.api.grantGuildKit(woman, "domitores")), [], "and nothing twice");
});

test("the Domadores' kit says how a horse is won (E at a wild horse, food from the bag), and says nothing of the farmers' gardens (2026-10-25)", () => {
    const sut = load();
    assert.match(sut.api.guildKitHint("domitores"), /cavalo selvagem.*aperte E.*cenoura, maçã, pera, beterraba, nabo ou pão/);
    assert.doesNotMatch(sut.api.guildKitHint("domitores"), /canteiro|horta|plantar/i);
    assert.doesNotMatch(sut.api.guildKitHint("agricolae"), /cavalo/i, "the Agricultores' hint is the gardens' alone now");
});

test("every guild in the catalog has a kit, and the old tailors' id has none", () => {
    const sut = load();
    assert.deepEqual(Object.keys(sut.api.GUILD_KITS).sort(), ["agricolae", "alchemistae", "artifices", "collectores", "domitores", "fabri-ferrarii", "tabernarii", "venatores"]);
});

test("the artisans' guild hands out plain clothes to sell, worn by nobody", () => {
    const sut = load();
    const handed = sut.api.grantGuildKit(sut.makePlayer(), "artifices");
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [
        ["TunicShort01_m01_D", 2],
        ["TunicLong03_m01_D", 1],
        ["TunicLong05_m01_E", 1],
        ["F_SimpleDress01_m01_D", 1],
        ["Cap03_m01_E", 2],
        ["Hood04_m01_E", 2],
        ["F_Veil05_m01_D", 1],
    ]);
    assert.equal(Array.from(handed).length, 7, "each is told by name");
    assert.ok(sut.added.every((entry) => entry.amount <= 2), "a few of each, not a stock");
});

test("a man sworn to the Golden Lion gets the red embroidered coat and the red padded collar, and to the Raven the blue ones", () => {
    const sut = load();
    const player = sut.makePlayer();

    const lion = sut.api.grantFactionColours(player, "leao-dourado");
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [["Coat11_m03_C", 1], ["CollarPadded01_m06_C1", 1]]);
    assert.deepEqual(Array.from(lion), ["o manto vermelho (casaco bordado)", "a gola acolchoada vermelha"]);

    sut.added.length = 0;
    const raven = sut.api.grantFactionColours(player, "corvo");
    assert.deepEqual(sut.added.map((entry) => [entry.item, entry.amount]), [["Coat11_m04_C", 1], ["CollarPadded01_m04_C1", 1]]);
    assert.deepEqual(Array.from(raven), ["o manto azul (casaco bordado)", "a gola acolchoada azul"]);
});

test("a woman gets the women's surcoat and hooded collar in the house's colours", () => {
    const sut = load({ looks: { 1: { appearance: { gender: "female" } } } });
    sut.api.grantFactionColours(sut.makePlayer("1", "female"), "leao-dourado");
    sut.api.grantFactionColours(sut.makePlayer("1", "female"), "corvo");
    assert.deepEqual(sut.added.map((entry) => entry.item), ["F_Surcote01_m09_C", "F_Hood01_m01_C", "F_Surcote01_m15_C", "F_Hood01_m05_C"]);
});

test("a house's colours come once, however often the oath is sworn, and a body changed later does not earn the other cut", () => {
    const looks = { 1: { appearance: { gender: "male" } } };
    const sut = load({ looks });
    const player = sut.makePlayer();
    sut.api.grantFactionColours(player, "corvo");
    assert.equal(sut.added.length, 2);

    assert.deepEqual(Array.from(sut.api.grantFactionColours(player, "corvo")), []);
    sut.api.grantFactionColours(player, "leao-dourado");
    sut.api.grantFactionColours(player, "corvo");
    assert.equal(sut.added.length, 4, "back and forth between the houses brings nothing new");

    looks[1].appearance.gender = "female";
    assert.deepEqual(Array.from(sut.api.grantFactionColours(player, "corvo")), []);
    assert.equal(sut.added.length, 4);
});

test("a piece of the colours the inventory refuses is not marked, so only it is tried again", () => {
    const sut = load();
    const player = sut.makePlayer();
    sut.state.refuse.add("Coat11_m03_C");
    assert.deepEqual(Array.from(sut.api.grantFactionColours(player, "leao-dourado")), ["a gola acolchoada vermelha"]);
    assert.match(sut.logs.at(-1), /Coat11_m03_C não foi entregue/);

    sut.state.refuse.clear();
    assert.deepEqual(Array.from(sut.api.grantFactionColours(player, "leao-dourado")), ["o manto vermelho (casaco bordado)"]);
});

test("a character that is not being kept gets no colours and is told why; an unknown house hands nothing", () => {
    const unkept = load({ kept: false });
    assert.deepEqual(Array.from(unkept.api.grantFactionColours(unkept.makePlayer(), "corvo")), []);
    assert.equal(unkept.added.length, 0);
    assert.match(unkept.chat.at(-1), /não está sendo salvo/);

    const sut = load();
    assert.deepEqual(Array.from(sut.api.grantFactionColours(sut.makePlayer(), "no-such-house")), []);
    assert.equal(sut.added.length, 0);
});

test("both houses have a mantle and a collar for each body", () => {
    const sut = load();
    assert.deepEqual(Object.keys(sut.api.FACTION_COLOURS).sort(), ["corvo", "leao-dourado"]);
    for (const [house, cuts] of Object.entries(sut.api.FACTION_COLOURS)) {
        for (const body of ["male", "female"]) {
            assert.deepEqual(Array.from(cuts[body], (entry) => entry.piece), ["manto", "gola"], `${house} ${body}`);
        }
    }
});

test("the Coletores' kit says how the work is done: E at a tree or a rock, not the left click (2026-10-22); the other guilds' kits say nothing more", () => {
    const sut = load();
    assert.match(sut.api.guildKitHint("collectores"), /olhe para uma árvore ou uma pedra e aperte E/);
    assert.doesNotMatch(sut.api.guildKitHint("collectores"), /esquerdo|clique/i);
    for (const guild of ["fabri-ferrarii", "venatores", "tabernarii", "alchemistae", "artifices"]) {
        assert.equal(sut.api.guildKitHint(guild), "", guild);
    }
    assert.equal(sut.api.guildKitHint("unknown"), "");
});

test("a piece added to a kit goes at the end of its list: the ledger is by position, so one put in the middle would hand every piece after it a second time to whoever had the old list (2026-10-27)", () => {
    const sut = load();
    const farmers = Array.from(sut.api.GUILD_KITS.agricolae, (entry) => entry.item);
    assert.deepEqual(farmers.slice(0, 6), ["player_shovel", "kcdc-craft:semente-cebola", "kcdc-craft:semente-repolho", "kcdc-craft:semente-nabo", "kcdc-craft:semente-cenoura", "kcdc-craft:semente-urtiga"]);
    assert.equal(farmers.length, 16);
    assert.equal(farmers[13], "HandWrap01_m02_E", "the last piece of the list as it was: its position, and so its ledger entry, did not move");
    assert.deepEqual(farmers.slice(14), ["kcdc-craft:semente-linho", "kcdc-craft:semente-trigo"], "flax and wheat for the Artifices' thread and the Tabernarii's flour, handed to the farmers of before at their next entry");
});
