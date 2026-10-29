const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/nobility.js"), "utf8"), sandbox);
const N = sandbox.exports;

const ids = (list) => Array.from(list, (title) => title.id);

function nominate(over = {}) {
    return N.judgeNomination({ actorIsAdmin: false, actorIsNoble: true, actorHeld: [], sameActor: false, titleId: "cavaleiro", nomineeHeld: [], ...over });
}

test("the catalog has every rank of the user's list, each once, in five branches, and every title names a real one", () => {
    const seen = new Set();
    for (const title of N.TITLES) {
        assert.ok(!seen.has(title.id), `repeated ${title.id}`);
        seen.add(title.id);
        assert.ok(N.BRANCHES.some((branch) => branch.id === title.branch), title.id);
        assert.ok(title.male !== "" && title.female !== "" && title.gloss !== "", title.id);
        for (const named of title.appoints ?? []) {
            assert.ok(N.titleById(named) !== null, `${title.id} names a title that does not exist: ${named}`);
        }
    }
    for (const wanted of ["rei", "principe", "marques", "lorde", "cavaleiro", "escudeiro", "pequeno-nobre", "burgrave", "hetman", "chanceler", "mordomo", "tesoureiro", "arauto", "arcebispo", "bispo", "abade", "prior", "padre", "monge", "burgomestre", "conselheiro", "mestre-guilda"]) {
        assert.ok(seen.has(wanted), wanted);
    }
    assert.deepEqual(ids(N.BRANCHES), ["crown", "great", "lesser", "church", "town"]);
});

test("nobody names upward or sideways: a title names only titles strictly below it, in its own ladder", () => {
    for (const title of N.TITLES) {
        for (const id of title.appoints ?? []) {
            const named = N.titleById(id);
            assert.notEqual(named.id, title.id, `${title.id} names itself`);
            assert.ok(!(named.appoints ?? []).includes(title.id), `${title.id} and ${id} name each other`);
            if (named.branch === title.branch && named.kind === title.kind) {
                assert.ok(named.tier >= title.tier, `${title.id} names ${id}, which stands above it`);
            }
        }
    }
    assert.ok(!N.TITLES.some((title) => (title.appoints ?? []).includes("rei")), "the Rei is named by an administrator alone");
    assert.ok(!N.TITLES.some((title) => (title.appoints ?? []).includes("arcebispo")), "and so is the arcebispo");
    assert.ok(!N.titleById("lorde").appoints.includes("bispo"), "a lord does not name bishops: the Church is its own ladder");
    assert.ok(N.titleById("bispo").appoints.includes("padre"));
});

test("a knight names the small nobility and nothing else; a lord names knights and the posts of a lordship", () => {
    assert.deepEqual(ids(N.appointable(["cavaleiro"])), ["escudeiro", "pequeno-nobre", "soldado"]);
    const lord = ids(N.appointable(["lorde"]));
    for (const wanted of ["cavaleiro", "escudeiro", "burgrave", "hetman", "chanceler", "burgomestre"]) {
        assert.ok(lord.includes(wanted), wanted);
    }
    assert.ok(!lord.includes("lorde") && !lord.includes("principe") && !lord.includes("rei"));
    assert.deepEqual(ids(N.appointable(["escudeiro"])), [], "a squire names nobody");
    assert.equal(N.hasNominationPower(["escudeiro"]), false);
    assert.equal(N.hasNominationPower(["escudeiro", "cavaleiro"]), true);
    assert.equal(N.hasNominationPower(["nao-existe"]), false);
});

test("the titles of the blood and of the high Church raise; an office does not", () => {
    for (const [id, expected] of [["rei", true], ["lorde", true], ["cavaleiro", true], ["bispo", true], ["abade", true], ["burgrave", false], ["padre", false], ["burgomestre", false], ["mestre-guilda", false]]) {
        assert.equal(N.raises(N.titleById(id)), expected, id);
    }
});

test("a title is written for the body that holds it", () => {
    assert.equal(N.labelOf(N.titleById("cavaleiro"), false), "Cavaleiro");
    assert.equal(N.labelOf(N.titleById("cavaleiro"), true), "Cavaleira");
    assert.equal(N.labelOf(N.titleById("rei"), true), "Rainha");
    assert.equal(N.summarize(["burgrave", "lorde", "x"], false), "Lorde · Burgrave", "the highest first, what is not a title left out");
    assert.equal(N.summarize([], false), "");
});

test("a noble who holds a title that names may name below it; everybody else is told why not", () => {
    assert.equal(nominate({ actorHeld: ["cavaleiro"], titleId: "escudeiro" }).ok, true);
    assert.match(nominate({ actorHeld: ["cavaleiro"], titleId: "lorde" }).reason, /só se nomeia para um título abaixo do seu/);
    assert.match(nominate({ actorHeld: ["cavaleiro"], titleId: "cavaleiro" }).reason, /só se nomeia para um título abaixo do seu/, "never the same rank");
    assert.match(nominate({ actorHeld: ["escudeiro"], titleId: "escudeiro" }).reason, /ainda não recebeu um título de nomeação/);
    assert.match(nominate({ actorHeld: [], titleId: "escudeiro" }).reason, /ainda não recebeu um título de nomeação/);
    assert.match(nominate({ actorIsNoble: false, actorHeld: ["cavaleiro"], titleId: "escudeiro" }).reason, /Só um nobre pode nomear/);
    assert.match(nominate({ actorHeld: ["lorde"], titleId: "tesouro" }).reason, /não existe/);
    assert.match(nominate({ actorHeld: ["lorde"], titleId: "cavaleiro", sameActor: true }).reason, /ninguém se nomeia a si mesmo/i);
});

test("an administrator names anybody to anything, themselves included, as the Crown", () => {
    for (const titleId of ["rei", "arcebispo", "lorde", "burgomestre", "monge"]) {
        assert.equal(nominate({ actorIsAdmin: true, actorIsNoble: false, actorHeld: [], titleId }).ok, true, titleId);
    }
    assert.equal(nominate({ actorIsAdmin: true, sameActor: true, titleId: "rei" }).ok, true);
});

test("somebody who already holds the title is not named again, and the blood is one rank at a time", () => {
    assert.match(nominate({ actorHeld: ["lorde"], nomineeHeld: ["cavaleiro"], titleId: "cavaleiro" }).reason, /Já é Cavaleiro/);
    assert.equal(nominate({ actorHeld: ["lorde"], nomineeHeld: ["escudeiro"], titleId: "cavaleiro" }).ok, true, "a squire becomes a knight: the new rank takes the place of the old");
    assert.match(nominate({ actorHeld: ["lorde"], nomineeHeld: ["lorde"], titleId: "cavaleiro" }).reason, /no seu nível ou acima/, "never take the rank of an equal");
    assert.match(nominate({ actorHeld: ["lorde"], nomineeHeld: ["principe"], titleId: "cavaleiro" }).reason, /no seu nível ou acima/);
    assert.equal(nominate({ actorIsAdmin: true, nomineeHeld: ["principe"], titleId: "cavaleiro" }).ok, true, "an administrator may");
});

test("six titles at most, but a new rank in place of the old one is never refused for the count", () => {
    const six = ["burgrave", "hetman", "mordomo", "tesoureiro", "arauto", "chanceler"];
    assert.match(nominate({ actorHeld: ["lorde"], nomineeHeld: six, titleId: "escrivao" }).reason, /máximo/);
    const five = [...six.slice(0, 5), "escudeiro"];
    assert.equal(nominate({ actorHeld: ["lorde"], nomineeHeld: [...five, "chanceler"].slice(0, 6), titleId: "cavaleiro" }).ok, true, "replacing the blood rank costs no room");
});

test("a title is taken away by its holder, by whoever named it, by an administrator, and by a rank that may name it", () => {
    const revoke = (over) => N.judgeRevocation({ actorIsAdmin: false, actorHeld: [], ownTitle: false, titleId: "burgrave", holderHeld: ["burgrave"], namedByActor: false, ...over });
    assert.equal(revoke({ ownTitle: true }).ok, true, "giving a title up is always allowed");
    assert.equal(revoke({ actorIsAdmin: true }).ok, true);
    assert.equal(revoke({ namedByActor: true }).ok, true);
    assert.equal(revoke({ actorHeld: ["lorde"] }).ok, true, "a lord may take a lordship's post");
    assert.match(revoke({ actorHeld: ["cavaleiro"] }).reason, /Só quem pode nomear/);
    assert.match(revoke({ titleId: "lorde", holderHeld: ["lorde"], actorHeld: ["lorde"] }).reason, /Só quem pode nomear/);
    assert.match(revoke({ titleId: "cavaleiro", holderHeld: ["burgrave"] }).reason, /não tem esse título/);
    assert.match(revoke({ titleId: "nao-existe", holderHeld: [] }).reason, /não tem esse título/);
});

test("the blood rank is read as one ladder from the crown down", () => {
    assert.ok(N.bloodRank(["rei"]) < N.bloodRank(["principe"]));
    assert.ok(N.bloodRank(["lorde"]) < N.bloodRank(["cavaleiro"]));
    assert.equal(N.bloodRank([]), Infinity);
    assert.equal(N.bloodRank(["burgrave"]), Infinity, "an office is not a rank of the blood");
    assert.equal(N.bloodTitleOf(["burgrave", "cavaleiro"]).id, "cavaleiro");
    assert.equal(N.bloodTitleOf(["burgrave"]), null);
});

test("the soldier is a title of the lesser branch, below the captains, named by a knight, with a level of its own", () => {
    const soldier = N.titleById("soldado");
    assert.equal(soldier.male, "Soldado");
    assert.equal(soldier.female, "Soldada");
    assert.equal(soldier.kind, "office");
    assert.deepEqual(Array.from(soldier.reportsTo), ["capitao-guarda", "capitao-milicia", "hetman"]);
    assert.equal(N.levelOf(soldier), 6, "level with the gate guard, under the captains (5)");
    assert.ok(N.levelOf(N.titleById("capitao-guarda")) < N.levelOf(soldier));
    for (const namer of ["rei", "principe", "marques", "lorde", "cavaleiro"]) {
        assert.ok(ids(N.appointable([namer])).includes("soldado"), `${namer} names a soldier`);
    }
    for (const nobody of ["escudeiro", "burgrave", "hetman", "capitao-guarda"]) {
        assert.ok(!ids(N.appointable([nobody])).includes("soldado"), `${nobody} names no soldier: the nobles of the blood do`);
    }
});

test("the level of a player is the best of their titles, and a commoner stands below the last rung", () => {
    assert.equal(N.COMMONER_LEVEL, 7);
    assert.equal(N.levelOfTitles([]), 7);
    assert.equal(N.levelOfTitles(["nao-existe"]), 7, "a title that is not in the catalog counts for nothing");
    assert.equal(N.levelOfTitles(["soldado"]), 6);
    assert.equal(N.levelOfTitles(["soldado", "capitao-guarda"]), 5, "the highest of them");
    assert.equal(N.levelOfTitles(["lorde", "soldado"]), 3);
    assert.equal(N.levelOfTitles(["rei"]), 1);
    assert.ok(N.levelOfTitles(["soldado"]) < N.COMMONER_LEVEL, "even the lowest title stands above a commoner");
});

test("who may arrest: the ones that keep the peace by arms or judge, and the lords above them; a clerk, a monk or a master craftsman may not", () => {
    for (const id of ["soldado", "guarda-portoes", "capitao-guarda", "capitao-milicia", "hetman", "burgrave", "juiz-senhorial", "bailio", "burgomestre", "cavaleiro", "lorde", "marques", "principe", "rei"]) {
        assert.equal(N.mayArrestWith([id]), true, id);
    }
    for (const id of ["escrivao", "mestre-oficio", "mestre-guilda", "padre", "monge", "escudeiro", "pequeno-nobre", "chanceler", "arauto", "nao-existe"]) {
        assert.equal(N.mayArrestWith([id]), false, id);
    }
    assert.equal(N.mayArrestWith([]), false);
    assert.equal(N.mayArrestWith(["escrivao", "soldado"]), true, "any one title is enough");
    for (const id of N.ARREST_TITLES) {
        assert.ok(N.titleById(id) !== null, `${id} is a real title`);
    }
});

test("who hands out the guilds: the clerk, the masters, the town's officers, the lord's chancellor and burgrave, the lords and the Crown; the masters only their own", () => {
    for (const id of ["escrivao", "mestre-guilda", "mestre-oficio", "burgomestre", "conselheiro", "alcaide", "chanceler", "burgrave", "lorde", "marques", "principe", "rei"]) {
        assert.equal(N.mayGrantGuildWith([id]), true, id);
    }
    for (const id of ["soldado", "guarda-portoes", "padre", "cavaleiro", "escudeiro", "hetman", "nao-existe"]) {
        assert.equal(N.mayGrantGuildWith([id]), false, id);
    }
    assert.equal(N.mayGrantGuildWith([]), false);
    for (const id of N.GUILD_GRANT_TITLES) {
        assert.ok(N.titleById(id) !== null, `${id} is a real title`);
    }
    assert.equal(N.grantsOwnGuildOnly(["mestre-oficio"]), true);
    assert.equal(N.grantsOwnGuildOnly(["mestre-guilda", "mestre-oficio"]), true);
    assert.equal(N.grantsOwnGuildOnly(["mestre-oficio", "escrivao"]), false, "a master who is also a clerk hands any guild");
    assert.equal(N.grantsOwnGuildOnly(["escrivao"]), false);
    assert.equal(N.grantsOwnGuildOnly(["soldado"]), false, "no power at all is not a master's power");
    assert.equal(N.grantsOwnGuildOnly(["mestre-oficio", "soldado"]), true, "a title that gives no power does not change it");
    assert.equal(N.grantsOwnGuildOnly([]), false);
});
