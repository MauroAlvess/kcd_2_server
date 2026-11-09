const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESOURCE = "kcdc-gamemode";
const SWORD = "a".repeat(32);

/** The buffs the mocked game knows: name -> its table row. */
const TABLE = {
    marigold: { name: "marigold", class: "potion", custom: false, aiTag: null },
    deathcap: { name: "deathcap", class: "poison", custom: false, aiTag: "poison" },
    drunk: { name: "drunk", class: "alcohol", custom: false, aiTag: "alcohol_drunk" },
    sede: { name: "sede", class: "hangover", custom: true, aiTag: null },
    brokenArm: { name: "brokenArm", class: "injury", custom: false, aiTag: null },
    perk: { name: "perk", class: "perk", custom: false, aiTag: null },
};

function load() {
    const handlers = new Map();
    const logs = [];
    const players = [];
    const clock = { now: 1_000_000 };
    const fightsEnded = [];
    const thirst = { suspended: () => false };
    let beat;
    let beatCleared = false;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./acquaintances.js") return { labelFor: (viewer, target) => (target.hidden ? "Desconhecido" : target.nickname) };
            if (id === "./combat.js") return { endFightBetween: (a, b, why) => fightsEnded.push([a.id, b.id, why]) };
            if (id === "./thirst.js") return { thirstPace: thirst };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn) => { beat = fn; return 1; },
        clearInterval: () => { beatCleared = true; },
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) },
        Player: { all: () => players },
        Buffs: { find: (name) => TABLE[name] ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/duel.js"), "utf8"), context);
    const api = context.exports;

    /** Fires an event; the answers of its handlers. */
    const fire = (name, ...args) => (handlers.get(name) ?? []).map((fn) => fn(...args));
    const refused = (name, ...args) => fire(name, ...args).includes(false);

    const make = (id, nickname, over = {}) => {
        const player = {
            id, nickname, ready: true, alive: true, canAct: true, virtualWorld: 0, position: { x: id, y: 0, z: 0 },
            health: 100, maxHealth: 100, consciousness: 1, bleeding: 0,
            injuries: { head: false, torso: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
            rightHandItem: SWORD, leftHandItem: "", fistsUp: false, guard: 0,
            buffs: [], removed: [], cleared: [], healed: [], chat: [], notices: [],
            removeBuff(name) { this.removed.push(name); this.buffs = this.buffs.filter((buff) => buff.name !== name); return true; },
            clearBuffs(tag) { this.cleared.push(tag); return true; },
            heal(options) { this.healed.push(options); return true; },
            emit(event, payload) { if (event === `${RESOURCE}:notify`) this.notices.push(JSON.parse(payload).text); },
            ...over,
        };
        players.push(player);
        return player;
    };

    const sut = {
        api, duels: api.duels, handlers, logs, players, clock, fightsEnded, thirst, make, fire, refused,
        beat: () => beat(),
        beatCleared: () => beatCleared,
        /** Moves the clock in quarter seconds, with a beat each. */
        run(ms) {
            for (let left = ms; left > 0; left -= api.TICK_MS) {
                clock.now += Math.min(api.TICK_MS, left);
                beat();
            }
        },
        /** Two fit players who accepted, taken to the first blow. */
        begin() {
            const hans = make(1, "Hans");
            const kat = make(2, "Katerina");
            assert.equal(api.duels.start(hans, kat), null);
            sut.run(api.READY_MS + api.TICK_MS);
            sut.run(api.COUNTDOWN_MS + api.TICK_MS);
            return { hans, kat };
        },
        /** A blow of `damage` from `attacker` on `victim`: whether it was refused, and what it ended up taking. */
        blow(attacker, victim, damage) {
            const info = { damage, source: "melee", blocked: false };
            const answers = fire("playerHit", victim, attacker, info);
            return { refused: answers.includes(false), taken: info.damage };
        },
    };
    api.installDuels();
    return sut;
}

test("the duel starts only for two who are fit: more than 80% of the health, no injury, no bleeding, up and about, and free", () => {
    const sut = load();
    const { duels } = sut;
    const hans = sut.make(1, "Hans");
    const kat = sut.make(2, "Katerina");
    assert.equal(duels.canChallenge(hans, kat), null);
    assert.equal(duels.canChallenge(hans, hans), "Não dá para duelar consigo mesmo.");

    hans.health = 80;
    assert.equal(duels.canChallenge(hans, kat), "Para duelar, a sua vida precisa estar acima de 80%.");
    hans.health = 81;
    assert.equal(duels.canChallenge(hans, kat), null);
    hans.injuries.leftLeg = true;
    assert.equal(duels.canChallenge(hans, kat), "Para duelar, você não pode estar ferido nem sangrando.");
    hans.injuries.leftLeg = false;
    hans.bleeding = 0.4;
    assert.equal(duels.canChallenge(hans, kat), "Para duelar, você não pode estar ferido nem sangrando.");
    hans.bleeding = 0;
    hans.canAct = false;
    assert.equal(duels.canChallenge(hans, kat), "Você não está em condições de duelar agora.");
    hans.canAct = true;

    kat.health = 50;
    assert.match(duels.canChallenge(hans, kat), /^Katerina não está em condições de duelar agora: precisa de mais de 80% da vida, sem ferimentos e sem sangrar\.$/);
    kat.hidden = true;
    assert.match(duels.canChallenge(hans, kat), /^Desconhecido não está/);
    kat.health = 100;

    assert.equal(duels.start(hans, kat), null);
    assert.equal(duels.canChallenge(hans, kat), "Você já está em um duelo.");
    const gus = sut.make(3, "Gustav");
    assert.equal(duels.canChallenge(gus, kat), "Desconhecido já está em um duelo.");
    assert.equal(duels.busy(hans) && duels.busy(kat) && !duels.busy(gus), true);
});

test("on accepting, every potion, poison, drink and server effect comes off both bodies; injuries and the game's own bonuses stay; the thirst lets go of them", () => {
    const sut = load();
    const hans = sut.make(1, "Hans", { buffs: [TABLE.marigold, TABLE.sede, TABLE.brokenArm, TABLE.perk] });
    const kat = sut.make(2, "Katerina", { buffs: [TABLE.deathcap, TABLE.drunk] });
    assert.equal(sut.duels.busy(hans), false);
    assert.equal(sut.thirst.suspended(hans), false, "not before the duel");

    assert.equal(sut.duels.start(hans, kat), null);
    assert.deepEqual(hans.removed, ["marigold", "sede"]);
    assert.deepEqual(kat.removed, ["deathcap", "drunk"]);
    assert.deepEqual(hans.cleared, ["poison", "alcohol_drunk"]);
    assert.deepEqual(kat.cleared, ["poison", "alcohol_drunk"]);
    assert.equal(sut.thirst.suspended(hans), true);
    assert.equal(sut.thirst.suspended(sut.make(9, "Fora")), false);
    assert.ok(hans.chat[0].startsWith("Duelo com Katerina: saque a arma"), hans.chat[0]);
    assert.ok(sut.logs.some((line) => /segue com efeitos do jogo que o duelo não tira: brokenArm \(injury\), perk \(perk\)/.test(line)));
});

test("preparing: blows land harmlessly; when both hold a weapon the count of three begins, and then they fight", () => {
    const sut = load();
    const hans = sut.make(1, "Hans", { rightHandItem: "" });
    const kat = sut.make(2, "Katerina");
    assert.equal(sut.duels.start(hans, kat), null);
    assert.equal(sut.blow(kat, hans, 30).refused, true, "nobody is hurt before the count is over");
    sut.run(3_000);
    assert.equal(hans.notices.some((line) => /^3\.\.\./.test(line)), false, "no count while Hans has nothing in hand");

    hans.rightHandItem = SWORD;
    sut.run(sut.api.READY_MS + sut.api.TICK_MS);
    sut.run(sut.api.TICK_MS);
    assert.deepEqual(hans.notices.filter((line) => /\.\.\.$/.test(line)), ["3..."]);
    assert.equal(sut.blow(kat, hans, 30).refused, true, "still counting");
    sut.run(1_000);
    sut.run(1_000);
    assert.deepEqual(hans.notices.filter((line) => /\.\.\.$/.test(line)), ["3...", "2...", "1..."]);
    sut.run(sut.api.TICK_MS * 3);
    assert.ok(hans.chat.at(-1).startsWith("Lutem! Vence quem deixar o outro com 20% da vida."), hans.chat.at(-1));
    assert.ok(kat.chat.at(-1).startsWith("Lutem!"));
    assert.deepEqual(sut.blow(kat, hans, 30), { refused: false, taken: 30 }, "now it is real");
});

test("fists raised count as ready, a lowered guard does not, a weapon in the left hand does", () => {
    const sut = load();
    const { api } = sut;
    const hans = sut.make(1, "Hans", { rightHandItem: "" });
    const kat = sut.make(2, "Katerina", { rightHandItem: "", leftHandItem: SWORD });
    sut.duels.start(hans, kat);
    hans.fistsUp = true;
    hans.guard = 0;
    sut.run(2_000);
    assert.equal(hans.notices.some((line) => /\.\.\.$/.test(line)), false, "the engine keeps fistsUp true after the arm comes down");
    hans.guard = 1;
    sut.run(api.READY_MS + api.TICK_MS * 2);
    assert.deepEqual(hans.notices.filter((line) => /\.\.\.$/.test(line)), ["3..."]);
});

test("a hand put away during the count sends them back to preparing, told to both", () => {
    const sut = load();
    const hans = sut.make(1, "Hans");
    const kat = sut.make(2, "Katerina");
    sut.duels.start(hans, kat);
    sut.run(sut.api.READY_MS + sut.api.TICK_MS * 2);
    kat.rightHandItem = "";
    sut.run(sut.api.TICK_MS);
    assert.ok(hans.chat.includes("Os dois precisam estar com a arma na mão (ou os punhos erguidos)."));
    assert.ok(kat.chat.includes("Os dois precisam estar com a arma na mão (ou os punhos erguidos)."));
    assert.equal(sut.duels.busy(hans), true, "the duel is still on the books");
    kat.rightHandItem = SWORD;
    sut.run(sut.api.READY_MS + sut.api.COUNTDOWN_MS + sut.api.TICK_MS * 3);
    assert.ok(hans.chat.at(-1).startsWith("Lutem!"));
});

test("nobody drew a weapon within 20 s: the duel does not begin, and says who", () => {
    const sut = load();
    const hans = sut.make(1, "Hans");
    const kat = sut.make(2, "Katerina", { rightHandItem: "" });
    sut.duels.start(hans, kat);
    sut.run(sut.api.PREPARE_MS - sut.api.TICK_MS);
    assert.equal(sut.duels.busy(kat), true);
    sut.run(sut.api.TICK_MS * 2);
    assert.equal(sut.duels.busy(kat), false);
    assert.ok(hans.chat.includes("O duelo não começou: Katerina não sacou a arma a tempo."));
    assert.ok(kat.chat.includes("O duelo não começou: Você não sacou a arma a tempo."));
    assert.deepEqual(hans.healed, [], "nothing was fought, nothing treated");
    assert.equal(sut.fightsEnded.length, 1);
});

test("the blow that would take someone under 20% takes them to 20% and no further; the duel is won there, and the wounds are treated", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    assert.deepEqual(sut.blow(hans, kat, 50), { refused: false, taken: 50 });
    sut.run(sut.api.RULED_MS + sut.api.TICK_MS);
    kat.health = 50; // what her game reports after the blow
    const last = sut.blow(hans, kat, 60);
    assert.equal(last.refused, false);
    assert.equal(last.taken, 30, "50 - 20 = 30: the rest of the blow is not taken");

    // Between the blow and the ruling nothing more is taken from either.
    assert.equal(sut.blow(hans, kat, 10).refused, true);
    assert.equal(sut.blow(kat, hans, 10).refused, true, "the counter-blow in the air takes nothing either");
    assert.equal(sut.duels.busy(kat), true);

    sut.fire("playerDamage", kat, hans, 30, "torso", "combat");
    assert.equal(sut.duels.busy(hans) || sut.duels.busy(kat), false);
    assert.ok(hans.chat.includes("Você venceu o duelo contra Katerina."), hans.chat.join("|"));
    assert.ok(kat.chat.includes("Você perdeu o duelo para Hans."), kat.chat.join("|"));
    assert.deepEqual(sut.fightsEnded.map(([a, b]) => [a, b]), [[1, 2]]);
    assert.match(sut.fightsEnded[0][2], /^duelo: /);
    for (const player of [hans, kat]) {
        assert.deepEqual(JSON.parse(JSON.stringify(player.healed)), [{ health: false, injuries: true, bleeding: true, poisons: true }], "the wounds of the duel are treated, the health left alone");
    }
    assert.ok(sut.logs.some((line) => /^duel: Hans venceu Katerina \(vida de agora: /.test(line)));
});

test("a blow that does not reach the mark is left as the game ruled it", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    for (const damage of [10, 25, 79.5]) {
        kat.health = 100;
        sut.run(sut.api.RULED_MS + sut.api.TICK_MS);
        assert.deepEqual(sut.blow(hans, kat, damage), { refused: false, taken: damage });
        if (damage < 79.5) assert.equal(sut.duels.busy(kat), true);
    }
    assert.equal(sut.duels.busy(kat), true, "79.5 leaves her 20.5, over the mark by half a point: it is the blow that finishes, but the duel waits for the ruling or the beat");
    sut.run(sut.api.FINISH_MS + sut.api.TICK_MS);
    assert.equal(sut.duels.busy(kat), false, "a minute margin of 0.5% counts as being at the mark");
});

test("two blows inside the time the game needs to report the first are reckoned together", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    assert.deepEqual(sut.blow(hans, kat, 50), { refused: false, taken: 50 });
    sut.run(sut.api.TICK_MS);
    // Her game has not reported the 50 yet: it still says 100.
    const second = sut.blow(hans, kat, 50);
    assert.equal(second.taken, 30, "50 + 30 = 80 taken: she stays at 20");
    assert.equal(sut.duels.busy(kat), true);
    sut.fire("playerDamage", kat, hans, 30, "head", "combat");
    assert.equal(sut.duels.busy(kat), false);
});

test("a body found at the mark by the beat (bleeding) loses the duel; so does one knocked out", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    kat.health = 20.4;
    sut.run(sut.api.TICK_MS);
    assert.equal(sut.duels.busy(kat), true, "marked, waiting out the end");
    assert.equal(sut.blow(hans, kat, 5).refused, true);
    sut.run(sut.api.FINISH_MS + sut.api.TICK_MS);
    assert.equal(sut.duels.busy(kat), false);
    assert.ok(hans.chat.includes("Você venceu o duelo contra Katerina."));

    const other = load();
    const pair = other.begin();
    pair.hans.consciousness = 0;
    other.run(other.api.TICK_MS);
    other.run(other.api.FINISH_MS + other.api.TICK_MS);
    assert.ok(pair.kat.chat.includes("Você venceu o duelo contra Hans."));
    assert.deepEqual(pair.hans.cleared.slice(-1), ["unconscious"], "the knocked-out body is woken");
});

test("blows between the two keep landing harmlessly for three seconds after a win, and count again after", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    kat.health = 20;
    sut.run(sut.api.TICK_MS);
    sut.run(sut.api.FINISH_MS + sut.api.TICK_MS);
    assert.equal(sut.duels.busy(kat), false);
    assert.equal(sut.blow(hans, kat, 10).refused, true);
    assert.equal(sut.blow(kat, hans, 10).refused, true);
    sut.run(sut.api.AFTER_MS);
    assert.deepEqual(sut.blow(hans, kat, 10), { refused: false, taken: 10 }, "a quarrel is a quarrel again");
});

test("45 s without a blow cancel the duel, told 10 s before; a swing renews the 45 s", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    sut.run(34_000);
    assert.equal(hans.chat.filter((line) => /^Sem golpes há/.test(line)).length, 0);
    sut.run(1_500);
    assert.equal(hans.chat.filter((line) => /^Sem golpes há 3[56] s: o duelo se cancela em \d+ s se ninguém golpear\.$/.test(line)).length, 1, hans.chat.join("|"));
    sut.fire("playerAttack", hans, kat);
    sut.run(44_000);
    assert.equal(sut.duels.busy(hans), true, "the swing began a new 45 s");
    sut.run(1_500);
    assert.equal(sut.duels.busy(hans), false);
    assert.ok(hans.chat.includes("45 s sem golpes: duelo cancelado."));
    assert.ok(kat.chat.includes("45 s sem golpes: duelo cancelado."));
    assert.equal(hans.chat.filter((line) => /^Você venceu|^Você perdeu/.test(line)).length, 0, "no winner");
    assert.deepEqual(JSON.parse(JSON.stringify(hans.healed)), [{ health: false, injuries: true, bleeding: true, poisons: true }]);
    assert.equal(sut.blow(hans, kat, 10).refused, false, "a cancelled duel leaves no protection behind");
});

test("a blow that lands renews the 45 s as well, and a swing at somebody else does not", () => {
    const sut = load();
    const { hans } = sut.begin();
    const gus = sut.make(3, "Gustav");
    sut.run(40_000);
    sut.fire("playerAttack", hans, gus);
    sut.run(6_000);
    assert.equal(sut.duels.busy(hans), false, "a swing at a third player is nothing to the duel");

    const sut2 = load();
    const pair = sut2.begin();
    sut2.run(40_000);
    sut2.blow(pair.hans, pair.kat, 1);
    sut2.run(40_000);
    assert.equal(sut2.duels.busy(pair.hans), true);
});

test("putting the weapon away for 2 s cancels the duel; changing weapons does not", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    hans.rightHandItem = "";
    sut.run(1_500);
    assert.equal(sut.duels.busy(hans), true, "a weapon being changed");
    hans.rightHandItem = "b".repeat(32);
    sut.run(1_000);
    hans.rightHandItem = "";
    sut.run(sut.api.SHEATHED_MS + sut.api.TICK_MS);
    assert.equal(sut.duels.busy(hans), false);
    assert.ok(hans.chat.includes("Você guardou a arma: duelo cancelado."));
    assert.ok(kat.chat.includes("Hans guardou a arma: duelo cancelado."));
    assert.ok(sut.logs.some((line) => /^duel: Hans e Katerina: Hans guardou a arma$/.test(line)));
});

test("a stranger who strikes either of them, or an enemy, ends the duel and is let through; so does a duelist who strikes a stranger", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    const gus = sut.make(3, "Gustav");
    const info = { damage: 40, source: "melee", blocked: false };
    assert.deepEqual(sut.fire("playerHit", hans, gus, info), [undefined]);
    assert.equal(info.damage, 40, "the stranger's blow is the game's");
    assert.equal(sut.duels.busy(hans), false);
    assert.ok(kat.chat.includes("Alguém de fora entrou na luta: duelo cancelado."));
    assert.deepEqual(hans.healed, [], "what an outsider did is not the duel's to treat");

    const second = load();
    const pair = second.begin();
    const bandit = { name: "Bandido", id: 900 };
    second.fire("playerHit", pair.hans, bandit, { damage: 12, source: "melee" });
    assert.equal(second.duels.busy(pair.hans), false);

    const third = load();
    const duo = third.begin();
    const outsider = third.make(3, "Gustav");
    third.fire("playerHit", outsider, duo.hans, { damage: 8, source: "melee", blocked: false });
    assert.equal(third.duels.busy(duo.kat), false);
    assert.ok(duo.kat.chat.includes("Hans golpeou alguém de fora: duelo cancelado."));
});

test("leaving, falling or being taken elsewhere cancels it, told to the other; nothing is treated", () => {
    for (const [event, text] of [["playerDisconnect", "saiu do jogo"], ["playerDied", "caiu"], ["playerSpawning", "foi levado a outro lugar"]]) {
        const sut = load();
        const { hans, kat } = sut.begin();
        sut.fire(event, hans);
        assert.equal(sut.duels.busy(kat), false, event);
        assert.ok(kat.chat.includes(`Hans ${text}: duelo cancelado.`), `${event}: ${kat.chat.join("|")}`);
        assert.deepEqual(kat.healed, []);
    }
    const sut = load();
    const hans = sut.make(1, "Hans");
    const kat = sut.make(2, "Katerina");
    sut.duels.start(hans, kat);
    sut.fire("playerDisconnect", sut.make(7, "Passante"));
    assert.equal(sut.duels.busy(hans), true, "somebody else leaving is nothing");
});

test("a fighter who is not there any more, or in another world, or 80 m away, ends it", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    kat.alive = false;
    sut.run(sut.api.TICK_MS);
    assert.equal(sut.duels.busy(hans), false);
    assert.ok(hans.chat.includes("Katerina não pôde continuar: duelo cancelado."));

    const world = load();
    const w = world.begin();
    w.kat.virtualWorld = 5;
    world.run(world.api.TICK_MS);
    assert.equal(world.duels.busy(w.hans), false);
    assert.ok(w.hans.chat.includes("Os dois não estão mais no mesmo lugar: duelo cancelado."));

    const far = load();
    const f = far.begin();
    f.kat.position = { x: 100, y: 0, z: 0 };
    far.run(far.api.TICK_MS);
    assert.equal(far.duels.busy(f.hans), false);
    assert.ok(f.hans.chat.includes("Os dois se afastaram demais: duelo cancelado."));
    assert.equal(f.hans.healed.length, 1, "they did fight: treated");
});

test("an effect that lands during the duel is taken off at once, six times at most; injuries and unknown effects are left", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    hans.removed.length = 0;
    sut.fire("playerBuffAdded", hans, "deathcap", "native");
    sut.fire("playerBuffAdded", hans, "sede", "native");
    sut.fire("playerBuffAdded", hans, "brokenArm", "native");
    sut.fire("playerBuffAdded", hans, "mystery", "native");
    assert.deepEqual(hans.removed, ["deathcap", "sede"]);
    for (let n = 0; n < 10; n += 1) sut.fire("playerBuffAdded", kat, "drunk", "native");
    assert.equal(kat.removed.filter((name) => name === "drunk").length, sut.api.STRIP_TRIES);
    assert.equal(sut.logs.filter((line) => /Katerina recebeu drunk \(alcohol\) durante o duelo/.test(line)).length, 1, "said once");

    const outside = sut.make(3, "Gustav");
    sut.fire("playerBuffAdded", outside, "marigold", "native");
    assert.deepEqual(outside.removed, [], "a body outside a duel keeps its potion");
});

test("food and potions are refused in a duel, said now and then", () => {
    const sut = load();
    const hans = sut.make(1, "Hans");
    const kat = sut.make(2, "Katerina");
    const gus = sut.make(3, "Gustav");
    assert.deepEqual(sut.fire("playerConsuming", hans, {}), [undefined], "before the duel, anything goes");
    sut.duels.start(hans, kat);
    assert.equal(sut.refused("playerConsuming", hans, {}), true);
    assert.equal(sut.refused("playerConsuming", hans, {}), true);
    assert.equal(hans.chat.filter((line) => line === "Em duelo não se come nem se bebe poção.").length, 1, "not repeated at once");
    sut.clock.now += 3_000;
    sut.refused("playerConsuming", hans, {});
    assert.equal(hans.chat.filter((line) => line === "Em duelo não se come nem se bebe poção.").length, 2);
    assert.deepEqual(sut.fire("playerConsuming", gus, {}), [undefined]);
});

test("the game's own peace, or its fight timeout, ends a duel that was on; a fight that ended while preparing is nothing", () => {
    const sut = load();
    const hans = sut.make(1, "Hans");
    const kat = sut.make(2, "Katerina");
    sut.duels.start(hans, kat);
    sut.fire("playerCombatCancelled", hans, kat);
    assert.equal(sut.duels.busy(hans), true, "an old quarrel ending while they draw their weapons");

    sut.run(sut.api.READY_MS + sut.api.COUNTDOWN_MS + sut.api.TICK_MS * 3);
    sut.fire("playerCombatCancelled", kat, hans);
    assert.equal(sut.duels.busy(hans), false);
    assert.ok(hans.chat.includes("A luta foi encerrada: duelo cancelado."));
    assert.equal(sut.fightsEnded.length, 1, "the duel's own end of the fight does not come back round");

    const third = sut.make(3, "Gustav");
    const fourth = sut.make(4, "Ulrich");
    sut.duels.start(third, fourth);
    sut.run(sut.api.READY_MS + sut.api.COUNTDOWN_MS + sut.api.TICK_MS * 3);
    sut.fire("playerCombatCancelled", third, hans);
    assert.equal(sut.duels.busy(third), true, "a fight with somebody else is nothing to it");
});

test("whoever stands within 40 m hears who won, by the names they know", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    const near = sut.make(3, "Perto", { position: { x: 30, y: 0, z: 0 } });
    const far = sut.make(4, "Longe", { position: { x: 400, y: 0, z: 0 } });
    kat.hidden = true;
    sut.blow(hans, kat, 80);
    sut.fire("playerDamage", kat, hans, 80, "head", "combat");
    assert.deepEqual(near.chat, ["Hans venceu o duelo contra Desconhecido."]);
    assert.deepEqual(far.chat, []);
    assert.ok(hans.chat.includes("Você venceu o duelo contra Desconhecido."));
});

test("a duel is not saved: stopping the resource ends every duel and gives the thirst its bodies back", () => {
    const sut = load();
    const { hans, kat } = sut.begin();
    assert.equal(sut.thirst.suspended(hans), true);
    sut.fire("resourceStop", "another-resource");
    assert.equal(sut.duels.busy(hans), true);
    sut.fire("resourceStop", RESOURCE);
    assert.equal(sut.beatCleared(), true);
    assert.equal(sut.duels.busy(hans) || sut.duels.busy(kat), false);
    assert.equal(sut.thirst.suspended(hans), false);
    assert.ok(hans.chat.includes("O servidor parou: duelo cancelado."));
});

test("the invitation names the rules it will be held to", () => {
    const sut = load();
    assert.deepEqual(Array.from(sut.api.INVITATION_NOTES), [
        "Vai até um dos dois chegar a 20% da vida.",
        "Poções e efeitos saem do corpo e não voltam.",
        "Arma guardada ou 45 s sem golpes cancela.",
    ]);
});
