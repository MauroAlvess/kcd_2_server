const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadServer() {
    const handlers = new Map();
    const intervals = [];
    const cleared = [];
    const logs = [];
    const said = [];
    const players = [];
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: (id) => cleared.push(id),
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => said.push({ id: player.id, text }) },
        Player: { all: () => players },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/dirt.js"), "utf8"), context);
    return { api: context.exports, handlers, intervals, cleared, logs, said, players };
}

/** A body: what its client last reported of the dirt, and the effects it carries. */
function body(id, { dirt = 0, smell = 0, blood = 0, buffs = [], ready = true, alive = true } = {}) {
    const player = {
        id,
        nickname: `jogador${id}`,
        ready,
        alive,
        dirt,
        smell,
        blood,
        buffs: new Set(buffs),
        removed: [],
        hasBuff(name) { return this.buffs.has(name); },
        removeBuff(name) { this.removed.push(name); return true; },
        getDerivedStat(stat) { return { dirtiness: this.dirt, smell: this.smell, bloodiness: this.blood }[stat]; },
    };
    return player;
}

function watched(api) {
    const clock = { now: 1_000_000 };
    const said = [];
    const logs = [];
    const watch = new api.DirtWatch((player, text) => said.push({ id: player.id, text }), (line) => logs.push(line), () => clock.now);
    return { watch, clock, said, logs };
}

test("the game's own thresholds of relative dirtiness say how dirty a body is", () => {
    const { api } = loadServer();
    assert.deepEqual([0, 0.29, 0.3, 0.59, 0.6, 0.89, 0.9, 1.4].map(api.dirtLevelOf), [0, 0, 1, 1, 2, 2, 3, 3]);
    assert.equal(api.dirtLevelOf(-1), 0);
    assert.equal(api.dirtLevelOf(Number.NaN), 0, "a reading that is no number is no dirt");
    assert.equal(api.DIRT_LOW, 0.3);
    assert.equal(api.DIRT_MEDIUM, 0.6);
    assert.equal(api.DIRT_HIGH, 0.9);
});

test("the effect that keeps a body clean is asked to come off when the game reports it, once in the log and not in a hurry again", () => {
    const { api } = loadServer();
    const { watch, clock, logs } = watched(api);
    const hans = body(1, { buffs: ["quest_noDirt"] });

    assert.equal(watch.lift(hans, "quest_noDirt"), true);
    assert.deepEqual(hans.removed, ["quest_noDirt"]);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /jogador1 tinha quest_noDirt, que não deixa o corpo sujar: pedi para tirar/);

    // the client is slow and the game may put it straight back: not asked every time it is said
    clock.now += 1_000;
    assert.equal(watch.lift(hans, "quest_noDirt"), false);
    assert.deepEqual(hans.removed, ["quest_noDirt"]);

    clock.now += api.LIFT_GAP_MS;
    assert.equal(watch.lift(hans, "quest_noDirt"), true);
    assert.deepEqual(hans.removed, ["quest_noDirt", "quest_noDirt"]);
    assert.equal(logs.length, 1, "told once per player and effect, not every time");

    // another body is its own case, and any other effect is none of this module's
    assert.equal(watch.lift(body(2), "quest_noDirt"), true);
    assert.equal(watch.lift(hans, "potion_marigold_decoction"), false);
    assert.deepEqual(hans.removed.filter((name) => name !== "quest_noDirt"), []);
});

test("the beat takes the effect off a body that carries it, and leaves bodies that are not ready or are dead alone", () => {
    const { api } = loadServer();
    const { watch } = watched(api);
    const carrying = body(1, { buffs: ["quest_noDirt"] });
    const clean = body(2);
    const waiting = body(3, { buffs: ["quest_noDirt"], ready: false });
    const dead = body(4, { buffs: ["quest_noDirt"], alive: false });

    watch.tick([carrying, clean, waiting, dead]);

    assert.deepEqual(carrying.removed, ["quest_noDirt"]);
    assert.deepEqual([clean.removed, waiting.removed, dead.removed], [[], [], []]);
});

test("a body that gets dirty is told once for each step, with where to wash, and again after a wash", () => {
    const { api } = loadServer();
    const { watch, said } = watched(api);
    const hans = body(1);

    for (const dirt of [0.05, 0.2, 0.45]) {
        hans.dirt = dirt;
        watch.tick([hans]);
    }
    assert.deepEqual(said, [], "a little dirt is not worth a word");

    hans.dirt = 0.62;
    watch.tick([hans]);
    assert.equal(said.length, 1);
    assert.match(said[0].text, /^Você está sujo: a roupa e a pele pedem água\. Lave-se num rio, numa fonte, numa bacia ou nos banhos/);

    hans.dirt = 0.7;
    watch.tick([hans]);
    watch.tick([hans]);
    assert.equal(said.length, 1, "not again while it stays at that step");

    hans.dirt = 0.93;
    watch.tick([hans]);
    assert.equal(said.length, 2);
    assert.match(said[1].text, /^Você está imundo e o cheiro já incomoda quem passa\. Lave-se/);

    // washed a little, not clean yet: still no word, and no word again for the step it was told about
    hans.dirt = 0.5;
    watch.tick([hans]);
    hans.dirt = 0.65;
    watch.tick([hans]);
    assert.equal(said.length, 2);

    // washed clean: the next time it is told again
    hans.dirt = 0.04;
    watch.tick([hans]);
    hans.dirt = 0.7;
    watch.tick([hans]);
    assert.equal(said.length, 3);
    assert.match(said[2].text, /^Você está sujo/);
});

test("a body that is told is told alone, and one that jumps to filthy is told of that and not of both", () => {
    const { api } = loadServer();
    const { watch, said } = watched(api);
    const hans = body(1, { dirt: 0.95 });
    const katerina = body(2, { dirt: 0.1 });
    watch.tick([hans, katerina]);
    assert.deepEqual(said.map((line) => line.id), [1]);
    assert.match(said[0].text, /imundo/);
});

test("the first sign of dirt is written to the log once, which is how to tell the game's own count is running", () => {
    const { api } = loadServer();
    const { watch, logs } = watched(api);
    const hans = body(1);
    watch.tick([hans]);
    assert.deepEqual(logs, []);
    hans.dirt = 0.04;
    watch.tick([hans]);
    hans.dirt = 0.5;
    watch.tick([hans]);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /^dirt: jogador1 começou a ficar sujo \(0\.04\): o jogo está contando a sujeira$/);
});

test("a player who left is forgotten, and told again if they come back dirty", () => {
    const { api } = loadServer();
    const { watch, said, logs } = watched(api);
    const hans = body(1, { dirt: 0.7, buffs: ["quest_noDirt"] });
    watch.tick([hans]);
    watch.forget(1);
    watch.tick([hans]);
    assert.equal(said.length, 2);
    assert.equal(logs.filter((line) => /pedi para tirar/.test(line)).length, 2, "and the effect is asked about from scratch");
});

test("the installed watch lifts the effect the game reports, forgets a player who leaves, beats every twenty seconds and stops with the resource", () => {
    const { api, handlers, intervals, cleared, logs, said, players } = loadServer();
    api.installDirt();
    assert.equal(intervals.length, 1);
    assert.equal(intervals[0].ms, 20_000);
    assert.ok(logs.some((line) => /dirt: a sujeira é a do jogo/.test(line)));

    const hans = body(1, { buffs: ["quest_noDirt"] });
    handlers.get("playerBuffAdded")(hans, "quest_noDirt", "native");
    assert.deepEqual(hans.removed, ["quest_noDirt"]);
    handlers.get("playerBuffAdded")(hans, "alcohol_drunk", "native");
    assert.deepEqual(hans.removed, ["quest_noDirt"], "no other effect is touched");

    hans.dirt = 0.8;
    players.push(hans);
    intervals[0].fn();
    assert.equal(said.length, 1, "the beat reads the players who are in");
    assert.equal(said[0].id, 1);

    handlers.get("playerDisconnect")(hans);
    intervals[0].fn();
    assert.equal(said.length, 2, "forgotten at disconnect, so told afresh");

    handlers.get("resourceStop")("outro-recurso");
    assert.deepEqual(cleared, []);
    handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(cleared, [1]);
});

test("/sujeira reads the dirt, the smell and the blood as the game keeps them, with the scale and where to wash", () => {
    const { api } = loadServer();
    const reading = api.describeDirt(body(1, { dirt: 0.34, smell: 0.1, blood: 0 }));
    assert.match(reading, /^Sujeira 0,34 \(um pouco de sujeira\), cheiro 0,10, sangue 0,00\./);
    assert.match(reading, /0,30 é um pouco, 0,60 é sujo, 0,90 é imundo/);
    assert.match(reading, /Lave-se num rio, numa fonte, numa bacia ou nos banhos/);
    assert.ok(!/impede de sujar/.test(reading));

    assert.match(api.describeDirt(body(1)), /^Sujeira 0,00 \(limpo\)/);
    assert.match(api.describeDirt(body(1, { dirt: 0.95 })), /\(imundo\)/);
    assert.match(api.describeDirt(body(1, { dirt: 0.7 })), /\(sujo\)/);
    assert.match(api.describeDirt(body(1, { buffs: ["quest_noDirt"] })), /Efeito ligado que impede de sujar: quest_noDirt\.$/);
    assert.match(api.describeDirt(body(1, { dirt: Number.NaN })), /^Sujeira 0,00/, "a reading that is no number reads as none");
});

function loadCommand({ admin = false, found = null } = {}) {
    const context = {
        exports: {},
        require: (id) => {
            if (id === "../auth.js") return { isAdmin: () => admin };
            if (id === "../dirt.js") return { describeDirt: (player) => `leitura de ${player.nickname}` };
            if (id === "../players.js") {
                return {
                    retarget: (args, caller) => {
                        const at = args.findIndex((argument) => argument.startsWith("@"));
                        if (at === -1) return { target: caller, rest: args };
                        return found === null ? { error: "Jogador não encontrado." } : { target: found, rest: [] };
                    },
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/sujeira.js"), "utf8"), context);
    const lines = [];
    const run = (player, args) => context.exports.sujeiraCommand.run({ player, args, reply: { line: (text) => lines.push(text) } });
    return { command: context.exports.sujeiraCommand, run, lines };
}

test("/sujeira answers a player with their own reading, and an administrator may ask for somebody else's", () => {
    const hans = body(1);
    const katerina = body(2);

    const player = loadCommand();
    player.run(hans, []);
    player.run(hans, ["@jogador2"]);
    assert.deepEqual(player.lines, ["leitura de jogador1", "leitura de jogador1"], "a player cannot read another's");

    const admin = loadCommand({ admin: true, found: katerina });
    admin.run(hans, []);
    admin.run(hans, ["@jogador2"]);
    assert.deepEqual(admin.lines, ["leitura de jogador1", "jogador2: leitura de jogador2"]);

    const lost = loadCommand({ admin: true });
    lost.run(hans, ["@ninguem"]);
    assert.deepEqual(lost.lines, ["Jogador não encontrado."]);
    assert.equal(admin.command.name, "sujeira");
});

test("any player may run /sujeira", () => {
    const source = fs.readFileSync(path.join(__dirname, "../dist/server/auth.js"), "utf8");
    assert.match(source, /COMMON_COMMANDS = new Set\(\[[^\]]*"sujeira"/);
});
