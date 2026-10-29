const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FILE = "playerdata/family.json";

function load() {
    const files = new Map();
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "node:fs");
            return {
                readFileSync(file) {
                    if (!files.has(file)) throw new Error("ENOENT");
                    return files.get(file);
                },
                writeFileSync(file, data) { files.set(file, data); },
                mkdirSync() {},
            };
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/family.js"), "utf8"), context);
    const api = context.exports;
    // A link as it is made now: the request, then the other player's yes. What adding or editing gave, with the person as
    // it stands after the answer and the other side the yes made.
    const accept = (owner, id, target) => {
        const key = JSON.parse(files.get(FILE))[owner].persons.find((person) => person.id === id)?.invite?.key;
        return key === undefined ? null : api.answerInvite(target, key, true);
    };
    const now = (owner, id) => plain(api.listFamily(owner)).find((person) => person.id === id);
    const linked = (owner, relation, degree, name, target, who) => {
        const asked = api.addPerson(owner, relation, degree, name, target, who);
        if (!asked.ok || asked.invited === undefined) return asked;
        const answer = accept(owner, asked.person.id, target);
        return { ...asked, person: now(owner, asked.person.id), mirror: answer?.mirror ?? undefined };
    };
    const relinked = (owner, id, change, who) => {
        const edited = api.editPerson(owner, id, change, who);
        if (!edited.ok || edited.invited === undefined) return edited;
        const answer = accept(owner, id, edited.invited);
        return { ...edited, person: now(owner, id), mirrors: [...(edited.mirrors ?? []), ...(answer?.mirror ? [answer.mirror] : [])] };
    };
    return { api, files, linked, relinked };
}

// The module runs in its own vm realm, so arrays and objects it returns have that realm's prototypes;
// copy them through JSON before comparing structurally.
const plain = (value) => JSON.parse(JSON.stringify(value));

const ME = "76561198000000001";
const OTHER = "76561198000000002";

test("a new player has an empty tree", () => {
    const { api } = load();
    assert.deepEqual(plain(api.listFamily(ME)), []);
    assert.equal(api.getSurname(ME), null);
});

test("adding a relative saves it by Steam id, in the row of its generation", () => {
    const { api, files } = load();
    const result = api.addPerson(ME, "avo", undefined, "Wenzel Capon");

    assert.equal(result.ok, true);
    assert.equal(result.person.name, "Wenzel Capon");
    assert.equal(result.person.label, "Avô");
    assert.equal(result.person.row, "avos");
    assert.equal(result.person.relation, "avo");
    assert.deepEqual(plain(api.listFamily(ME)).map((p) => p.name), ["Wenzel Capon"]);
    assert.equal(JSON.parse(files.get(FILE))[ME].persons.length, 1);
});

test("every relation the page offers sits in the generation its name says", () => {
    const { api } = load();
    const rows = Object.fromEntries(plain(api.RELATIONS).map((relation) => [relation.id, relation.row]));
    assert.deepEqual(rows, {
        bisavo: "bisavos", bisava: "bisavos",
        avo: "avos", ava: "avos",
        pai: "pais", mae: "pais", tio: "pais", tia: "pais", sogro: "pais", sogra: "pais", padrasto: "pais", madrasta: "pais",
        esposo: "geracao", esposa: "geracao", companheiro: "geracao", companheira: "geracao", irmao: "geracao", irma: "geracao", primo: "geracao", prima: "geracao", cunhado: "geracao", cunhada: "geracao",
        filho: "filhos", filha: "filhos", filho_adotivo: "filhos", filha_adotiva: "filhos", filho_bastardo: "filhos", filha_bastarda: "filhos", sobrinho: "filhos", sobrinha: "filhos", genro: "filhos", nora: "filhos", enteado: "filhos", enteada: "filhos",
        neto: "netos", neta: "netos",
        bisneto: "bisnetos", bisneta: "bisnetos",
    });
    const known = new Set(plain(api.ROWS).map((row) => row.id));
    for (const row of Object.values(rows)) assert.ok(known.has(row), `${row} is a row`);
});

test("the ordinary cousin has no degree spelt out, a further one does", () => {
    const { api } = load();
    assert.equal(api.addPerson(ME, "primo", undefined, "Vaclav").person.label, "Primo");
    assert.equal(api.addPerson(ME, "primo", 1, "Vaclav Dois").person.label, "Primo");
    assert.equal(api.addPerson(ME, "prima", 2, "Anezka").person.label, "Prima de 2º grau");
    assert.equal(api.addPerson(ME, "primo", 4, "Bohuslav").person.label, "Primo de 4º grau");
});

test("a cousin's degree must be a whole number from 1 to 4", () => {
    const { api } = load();
    for (const bad of [0, 5, 1.5, -1, "2", null, NaN]) {
        const result = api.addPerson(ME, "primo", bad, "Vaclav");
        assert.equal(result.ok, false, `degree ${String(bad)}`);
        assert.match(result.reason, /grau/);
    }
    assert.equal(plain(api.listFamily(ME)).length, 0);
});

test("a degree given for anyone but a cousin is ignored", () => {
    const { api } = load();
    const result = api.addPerson(ME, "irmao", 3, "Petr");
    assert.equal(result.ok, true);
    assert.equal(result.person.label, "Irmão");
});

test("names are tidied, and must be 2 to 40 letters long", () => {
    const { api } = load();
    assert.equal(api.addPerson(ME, "pai", undefined, "  Hans \t  Capon\n").person.name, "Hans Capon");
    assert.equal(api.addPerson(ME, "mae", undefined, "Kate\u0000rina").person.name, "Kate rina", "a control character becomes a space");

    for (const bad of ["", " ", "A", "   B   ", "x".repeat(41)]) {
        const result = api.addPerson(ME, "pai", undefined, bad);
        assert.equal(result.ok, false, JSON.stringify(bad));
        assert.match(result.reason, /2 e 40/);
    }
    assert.equal(api.addPerson(ME, "pai", undefined, "x".repeat(40)).ok, true);
});

test("something that is not a relation or not a name is refused", () => {
    const { api } = load();
    for (const [relation, name] of [["avô-do-meu-avô", "Fulano"], ["", "Fulano"], [7, "Fulano"], [null, "Fulano"], ["pai", 7], ["pai", null], ["pai", { x: 1 }], ["__proto__", "Fulano"]]) {
        assert.equal(api.addPerson(ME, relation, undefined, name).ok, false, `${String(relation)} / ${String(name)}`);
    }
    assert.equal(plain(api.listFamily(ME)).length, 0);
});

test("a player with no Steam id cannot keep a tree", () => {
    const { api, files } = load();
    const result = api.addPerson("", "pai", undefined, "Hans");
    assert.equal(result.ok, false);
    assert.match(result.reason, /Steam/);
    assert.equal(files.size, 0);
    assert.equal(api.setSurname("", "Capon").ok, false);
});

test("a tree holds at most 80 people", () => {
    const { api } = load();
    for (let n = 0; n < 80; n += 1) {
        assert.equal(api.addPerson(ME, "filho", undefined, `Filho ${n}`).ok, true, `person ${n}`);
    }
    const over = api.addPerson(ME, "filho", undefined, "Um a mais");
    assert.equal(over.ok, false);
    assert.match(over.reason, /80/);
    assert.equal(plain(api.listFamily(ME)).length, 80);
    assert.equal(api.addPerson(OTHER, "filho", undefined, "Outro").ok, true, "someone else's tree is not full");
});

test("each player's tree is their own", () => {
    const { api } = load();
    api.addPerson(ME, "pai", undefined, "Hans");
    api.addPerson(OTHER, "mae", undefined, "Katerina");
    assert.deepEqual(plain(api.listFamily(ME)).map((p) => p.name), ["Hans"]);
    assert.deepEqual(plain(api.listFamily(OTHER)).map((p) => p.name), ["Katerina"]);

    // Both trees start at p1: an id means something only inside the tree it was made in.
    assert.equal(api.removePerson(OTHER, plain(api.listFamily(OTHER))[0].id), true);
    assert.deepEqual(plain(api.listFamily(ME)).map((p) => p.name), ["Hans"]);
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
});

test("removing a relative takes only that one, and an id is never reused while it is taken", () => {
    const { api } = load();
    const ana = api.addPerson(ME, "filho", undefined, "Ana").person;
    const beto = api.addPerson(ME, "filho", undefined, "Beto").person;
    const caio = api.addPerson(ME, "filho", undefined, "Caio").person;

    assert.equal(api.removePerson(ME, beto.id), true);
    assert.deepEqual(plain(api.listFamily(ME)).map((p) => p.name), ["Ana", "Caio"]);
    assert.equal(api.removePerson(ME, beto.id), false, "already gone");

    const davi = api.addPerson(ME, "filho", undefined, "Davi").person;
    assert.equal(new Set([ana.id, caio.id, davi.id]).size, 3, "Davi did not take the id of Ana or Caio");
});

test("removing something that is not an id, or from nobody's tree, does nothing", () => {
    const { api } = load();
    api.addPerson(ME, "pai", undefined, "Hans");
    for (const bad of [undefined, null, 1, {}, ["p1"], ""]) assert.equal(api.removePerson(ME, bad), false);
    assert.equal(api.removePerson("76561198999999999", "p1"), false);
    assert.equal(plain(api.listFamily(ME)).length, 1);
});

test("the tree survives a restart", () => {
    const first = load();
    first.api.addPerson(ME, "esposa", undefined, "Elisabeth");
    first.api.setSurname(ME, "Capon");

    const second = load();
    second.files.set(FILE, first.files.get(FILE));
    assert.deepEqual(plain(second.api.listFamily(ME)).map((p) => p.name), ["Elisabeth"]);
    assert.equal(second.api.getSurname(ME), "Capon");
});

test("a relative whose relation the catalog no longer has is skipped, not shown wrongly", () => {
    const { api, files } = load();
    files.set(FILE, JSON.stringify({
        [ME]: { persons: [
            { id: "p1", relation: "pai", degree: null, name: "Hans", createdAt: 1 },
            { id: "p2", relation: "tio-avo-de-quinto", degree: null, name: "Antigo", createdAt: 2 },
        ], updatedAt: 2 },
    }));
    assert.deepEqual(plain(api.listFamily(ME)).map((p) => p.name), ["Hans"]);
});

test("a surname is saved tidied, can be changed, and an empty one clears it", () => {
    const { api } = load();
    assert.deepEqual(plain(api.setSurname(ME, "  de   Skalitz ")), { ok: true, surname: "de Skalitz" });
    assert.equal(api.getSurname(ME), "de Skalitz");
    assert.deepEqual(plain(api.setSurname(ME, "Capon")), { ok: true, surname: "Capon" });
    assert.deepEqual(plain(api.setSurname(ME, "   ")), { ok: true, surname: null });
    assert.equal(api.getSurname(ME), null);
});

test("a surname that is too short, too long or not text is refused and the old one stays", () => {
    const { api } = load();
    api.setSurname(ME, "Capon");
    for (const bad of ["C", "x".repeat(31), 7, null, {}]) {
        assert.equal(api.setSurname(ME, bad).ok, false, JSON.stringify(bad));
    }
    assert.equal(api.getSurname(ME), "Capon");
    assert.equal(api.setSurname(ME, "x".repeat(30)).ok, true);
});

test("setting a surname leaves the relatives alone", () => {
    const { api } = load();
    api.addPerson(ME, "pai", undefined, "Hans");
    api.setSurname(ME, "Capon");
    assert.equal(plain(api.listFamily(ME)).length, 1);
    api.addPerson(ME, "mae", undefined, "Katerina");
    assert.equal(api.getSurname(ME), "Capon");
});

test("single until there is a spouse in the tree, married after, single again once the spouse is removed", () => {
    const { api } = load();
    assert.deepEqual(plain(api.maritalStatus(ME, "male")), { label: "Caelebs", gloss: "solteiro" });

    api.addPerson(ME, "irmao", undefined, "Petr");
    assert.equal(api.maritalStatus(ME, "male").label, "Caelebs", "a brother is not a spouse");

    const wife = api.addPerson(ME, "esposa", undefined, "Elisabeth").person;
    assert.deepEqual(plain(api.maritalStatus(ME, "male")), { label: "Coniugatus", gloss: "casado" });

    api.removePerson(ME, wife.id);
    assert.equal(api.maritalStatus(ME, "male").label, "Caelebs");
});

test("the marital status is worded for the character's gender, and a husband counts as a spouse too", () => {
    const { api } = load();
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Caelebs", gloss: "solteira" });
    api.addPerson(ME, "esposo", undefined, "Jan");
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Coniugata", gloss: "casada" });
    assert.deepEqual(plain(api.maritalStatus(ME, null)), { label: "Coniugatus", gloss: "casado" }, "no known gender reads as masculine");
    assert.equal(api.maritalStatus(OTHER, "male").label, "Caelebs", "someone else's spouse is not mine");
});

const THIRD = "76561198000000003";
const FOURTH = "76561198000000004";

test("a relative can be a player of the server, asked first and linked by Steam id once they say yes, which the page never sees", () => {
    const { api, files } = load();
    const son = api.addPerson(ME, "filho", undefined, "Jindrich", OTHER, { name: "Mauro Capon", gender: "male" });
    assert.equal(son.ok, true);
    assert.equal(son.invited, OTHER);
    assert.deepEqual([son.person.player, son.person.asked], [false, true], "in the tree as a name, the link waiting");
    assert.equal(JSON.parse(files.get(FILE))[ME].persons[0].steamId, undefined);
    assert.deepEqual(plain(api.familyHeirs(ME)), [], "nothing follows a link not made yet");
    const asks = plain(api.invitesFor(OTHER));
    assert.deepEqual(asks.map((ask) => [ask.name, ask.label]), [["Mauro Capon", "Filho"]]);
    assert.deepEqual(plain(api.invitesFor(ME)), [], "asked of the other, not of oneself");

    const yes = api.answerInvite(OTHER, asks[0].key, true);
    assert.deepEqual([yes.ok, yes.owner, yes.accepted, yes.label, yes.mirror.kind], [true, ME, true, "Filho", "added"]);
    assert.equal(JSON.parse(files.get(FILE))[ME].persons[0].steamId, OTHER);
    const mine = plain(api.listFamily(ME));
    assert.deepEqual([mine[0].player, mine[0].asked], [true, false]);
    assert.ok(!JSON.stringify(mine).includes(OTHER) && !JSON.stringify(asks).includes(ME), "the Steam ids stay on the server");
    assert.deepEqual(plain(api.invitesFor(OTHER)), []);
    assert.equal(api.answerInvite(OTHER, asks[0].key, true).ok, false, "answered once");

    assert.equal(api.addPerson(ME, "filha", undefined, "Outra", OTHER).ok, false, "one player once in a tree");
    assert.equal(api.addPerson(ME, "irmao", undefined, "Eu mesmo", ME).ok, false, "nobody is their own relative");
    assert.equal(api.addPerson(ME, "irmao", undefined, "Hynek").person.player, false);
});

test("a no leaves the relative a name; a player is asked once, only they can answer, and unlinking or removing takes it back", () => {
    const { api, files } = load();
    const who = { name: "Mauro Capon", gender: "male" };
    const wife = api.addPerson(ME, "esposa", undefined, "Dorota", OTHER, who).person;
    assert.equal(api.addPerson(ME, "irma", undefined, "De novo", OTHER, who).ok, false, "asked already");
    const [ask] = plain(api.invitesFor(OTHER));
    assert.equal(api.answerInvite(THIRD, ask.key, true).ok, false, "somebody else cannot answer it");
    assert.equal(api.answerInvite(OTHER, "outra", true).ok, false);
    const no = api.answerInvite(OTHER, ask.key, false);
    assert.deepEqual([no.ok, no.accepted, no.mirror], [true, false, null]);
    assert.deepEqual(plain(api.listFamily(ME)).map((person) => [person.id, person.name, person.player, person.asked]), [[wife.id, "Dorota", false, false]]);
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
    assert.equal(api.maritalStatus(OTHER, "female").gloss, "solteira");
    assert.equal(JSON.parse(files.get(FILE))[ME].persons[0].invite, undefined);

    const again = api.editPerson(ME, wife.id, { link: OTHER }, who);
    assert.equal(again.invited, OTHER, "asked again through an edit");
    assert.equal(plain(api.invitesFor(OTHER)).length, 1);
    assert.equal(api.editPerson(ME, wife.id, { link: null }, who).person.asked, false);
    assert.deepEqual(plain(api.invitesFor(OTHER)), [], "unlinking takes the request back");
    api.editPerson(ME, wife.id, { link: OTHER }, who);
    api.removePerson(ME, wife.id);
    assert.deepEqual(plain(api.invitesFor(OTHER)), [], "and so does removing the relative");
});

test("a relative can be marked dead, made adopted or a bastard within the same generation, and linked or unlinked", () => {
    const { api, files, linked, relinked } = load();
    const son = api.addPerson(ME, "filho", undefined, "Jindrich").person;
    const daughter = api.addPerson(ME, "filha", undefined, "Dorota").person;
    assert.equal(daughter.female, true);

    const adopted = api.editPerson(ME, son.id, { relation: "filho_adotivo" });
    assert.equal(adopted.person.label, "Filho adotivo");
    assert.equal(api.editPerson(ME, son.id, { relation: "filho_bastardo" }).person.label, "Filho bastardo");
    assert.equal(api.editPerson(ME, son.id, { relation: "pai" }).ok, false, "a son cannot become a father");

    const dead = api.editPerson(ME, daughter.id, { deceased: true });
    assert.equal(dead.person.deceased, true);
    assert.equal(api.editPerson(ME, daughter.id, { deceased: "sim" }).ok, false);
    assert.equal(plain(api.listFamily(ME)).find((p) => p.id === daughter.id).deceased, true, "kept");
    assert.equal(api.editPerson(ME, daughter.id, { deceased: false }).person.deceased, false);

    assert.equal(relinked(ME, son.id, { link: OTHER }).person.player, true);
    assert.equal(api.editPerson(ME, daughter.id, { link: OTHER }).ok, false, "already linked to the son");
    assert.equal(api.editPerson(ME, son.id, { link: null }).person.player, false);
    assert.equal(api.editPerson(ME, "p99", { deceased: true }).ok, false);
    assert.equal(api.editPerson(OTHER, son.id, { deceased: true }).ok, false, "only in one's own tree");
});

test("a cousin keeps the degree through an edit", () => {
    const { api, files, linked, relinked } = load();
    const cousin = api.addPerson(ME, "primo", 3, "Bohuslav").person;
    assert.equal(api.editPerson(ME, cousin.id, { relation: "prima" }).person.label, "Prima de 3º grau");
});

test("the heirs of a player's standing are the living spouse and the legitimate line, never the adopted, bastards or the rest", () => {
    const { api, files, linked, relinked } = load();
    linked(ME, "esposa", undefined, "Dorota", OTHER);
    linked(ME, "filho", undefined, "Jindrich", THIRD);
    linked(ME, "filho_adotivo", undefined, "Adotado", FOURTH);
    linked(ME, "filho_bastardo", undefined, "Bastardo", "76561198000000005");
    linked(ME, "irmao", undefined, "Irmao", "76561198000000006");
    linked(ME, "avo", undefined, "Avo", "76561198000000007");
    linked(ME, "neta", undefined, "Neta", "76561198000000008");
    const deadSon = linked(ME, "filho", undefined, "Morto", "76561198000000009").person;
    api.editPerson(ME, deadSon.id, { deceased: true });
    api.addPerson(ME, "filha", undefined, "Sem conta");

    const heirs = plain(api.familyHeirs(ME));
    assert.deepEqual(heirs.map((heir) => heir.steamId).sort(), [OTHER, THIRD, "76561198000000008"].sort());
    assert.equal(heirs.find((heir) => heir.steamId === OTHER).name, "Dorota");
    assert.deepEqual(plain(api.familyHeirs("")), []);
});

test("somebody who names a player as their spouse is that player's heir too, and makes them married", () => {
    const { api, files, linked, relinked } = load();
    linked(OTHER, "esposo", undefined, "Mauro", ME);
    assert.deepEqual(plain(api.familyHeirs(ME)), [{ steamId: OTHER, name: "" }]);
    assert.equal(api.maritalStatus(ME, "male").gloss, "casado", "married because she says so");
});

test("a spouse marked dead makes a widow or widower; a living one, married; none, single", () => {
    const { api, files, linked, relinked } = load();
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Caelebs", gloss: "solteira" });
    const husband = api.addPerson(ME, "esposo", undefined, "Hans").person;
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Coniugata", gloss: "casada" });
    api.editPerson(ME, husband.id, { deceased: true });
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Vidua", gloss: "viúva" });
    assert.deepEqual(plain(api.maritalStatus(ME, "male")), { label: "Viduus", gloss: "viúvo" });
    api.addPerson(ME, "esposo", undefined, "Jan");
    assert.equal(api.maritalStatus(ME, "female").gloss, "casada", "married again");
});

// ---------------------------------------------------------------------------------------------
// The other side of a link: a player added as a relative gets the one who adds them in their own tree.

const MALE = { name: "Mauro Capon", gender: "male" };
const FEMALE = { name: "Dorota Capon", gender: "female" };

test("every relation turns around, for either gender, into one of the opposite generation", () => {
    const { api, files, linked, relinked } = load();
    const opposite = { bisavos: "bisnetos", avos: "netos", pais: "filhos", geracao: "geracao", filhos: "pais", netos: "avos", bisnetos: "bisavos" };
    const rowOf = new Map(Array.from(api.RELATIONS, (relation) => [relation.id, relation.row]));
    for (const relation of api.RELATIONS) {
        for (const gender of ["male", "female"]) {
            const inverse = api.inverseRelation(relation.id, gender);
            assert.notEqual(inverse, null, `${relation.id} as ${gender}`);
            assert.equal(rowOf.get(inverse), opposite[relation.row], `${relation.id} as ${gender} turns into ${inverse}`);
        }
    }
    assert.equal(api.inverseRelation("esposa", "male"), "esposo");
    assert.equal(api.inverseRelation("esposo", "female"), "esposa");
    assert.equal(api.inverseRelation("filho", "female"), "mae");
    assert.equal(api.inverseRelation("pai", "male"), "filho");
    assert.equal(api.inverseRelation("tia", "male"), "sobrinho");
    assert.equal(api.inverseRelation("neto", "female"), "ava");
    assert.equal(api.inverseRelation("irmao", "female"), "irma");
    assert.equal(api.inverseRelation("filho_bastardo", "male"), "pai");
    assert.equal(api.inverseRelation("filha_adotiva", "female"), "mae");
    assert.equal(api.inverseRelation("esposa", null), null, "no gender, no word");
    assert.equal(api.inverseRelation("tio-avo", "male"), null, "a relation the catalog does not have");
});

test("the other side of a marriage and the step-family turn around too, by the gender of who adds them (2026-10-25)", () => {
    const { api } = load();
    const turned = (relation, gender) => api.inverseRelation(relation, gender);
    assert.deepEqual([turned("sogra", "male"), turned("sogra", "female"), turned("sogro", "male")], ["genro", "nora", "genro"], "the mother-in-law has a son-in-law or a daughter-in-law");
    assert.deepEqual([turned("genro", "male"), turned("nora", "female"), turned("genro", "female")], ["sogro", "sogra", "sogra"]);
    assert.deepEqual([turned("cunhado", "male"), turned("cunhado", "female"), turned("cunhada", "female")], ["cunhado", "cunhada", "cunhada"]);
    assert.deepEqual([turned("padrasto", "male"), turned("madrasta", "female"), turned("enteado", "male"), turned("enteada", "female")], ["enteado", "enteada", "padrasto", "madrasta"]);
    assert.deepEqual([turned("companheiro", "male"), turned("companheira", "female"), turned("companheira", "male")], ["companheiro", "companheira", "companheiro"]);
});

test("in-laws, step-relatives and the partner of a union are relatives of the tree and no more: none is an heir, and a mirror is made for each", () => {
    const { api, linked } = load();
    for (const [relation, name] of [["sogro", "Hans"], ["sogra", "Anezka"], ["cunhado", "Petr"], ["cunhada", "Eliska"], ["genro", "Vaclav"], ["nora", "Dorota"], ["padrasto", "Jindrich"], ["enteada", "Marketa"], ["companheira", "Katka"]]) {
        const made = api.addPerson(ME, relation, undefined, name);
        assert.equal(made.ok, true, relation);
    }
    const rows = Object.fromEntries(plain(api.listFamily(ME)).map((person) => [person.relation, person.row]));
    assert.deepEqual(rows, { sogro: "pais", sogra: "pais", cunhado: "geracao", cunhada: "geracao", genro: "filhos", nora: "filhos", padrasto: "pais", enteada: "filhos", companheira: "geracao" });

    // A player added as a mother-in-law: the one who adds is her daughter-in-law in her tree.
    const made = linked(ME, "sogra", undefined, "Anezka Kovar", OTHER, { name: "Dorota Capon", gender: "female" });
    assert.equal(made.mirror.kind, "added");
    assert.equal(plain(api.listFamily(OTHER))[0].label, "Nora");
    assert.deepEqual(plain(api.familyHeirs(ME)), [], "an in-law is no heir");
    assert.deepEqual(plain(api.familyHeirs(OTHER)), [], "and neither is the daughter-in-law of one");
    assert.deepEqual(plain(api.spousesOf(ME)), [], "nor is any of them a spouse");
});

test("a partner of a union is not married, and not alone: 'em união' for a living one; a spouse is still the first word (2026-10-25)", () => {
    const { api } = load();
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Caelebs", gloss: "solteira" });
    const partner = api.addPerson(ME, "companheiro", undefined, "Jindrich Kovar").person;
    assert.deepEqual(plain(api.maritalStatus(ME, "female")), { label: "Coniuncta", gloss: "em união" });
    assert.deepEqual(plain(api.maritalStatus(ME, "male")), { label: "Coniunctus", gloss: "em união" });
    const wife = api.addPerson(ME, "esposa", undefined, "Dorota").person;
    assert.equal(api.maritalStatus(ME, "male").gloss, "casado", "the marriage comes first");
    api.editPerson(ME, wife.id, { deceased: true });
    assert.equal(api.maritalStatus(ME, "male").gloss, "em união", "a widower with a living partner is in a union");
    api.editPerson(ME, partner.id, { deceased: true });
    assert.equal(api.maritalStatus(ME, "male").gloss, "viúvo", "and a widower again when the partner dies too");
});

test("somebody whose tree names a player as their partner puts that player in a union, and the other side of a link they made does not count twice", () => {
    const { api, linked } = load();
    const made = linked(OTHER, "companheira", undefined, "Dorota", ME, { name: "Mauro Capon", gender: "male" });
    assert.equal(made.mirror.kind, "added");
    assert.equal(api.maritalStatus(OTHER, "male").gloss, "em união", "by his own tree");
    assert.equal(api.maritalStatus(ME, "female").gloss, "em união", "and by her mirror of it");
    // The mirror is an echo of his word: with the partner of his tree marked dead, he is not in a union by her mirror.
    api.editPerson(OTHER, plain(api.listFamily(OTHER))[0].id, { deceased: true });
    assert.equal(api.maritalStatus(OTHER, "male").gloss, "solteiro");
});

test("the living spouses of a player: the ones of their own tree, linked or only a name, and those whose trees name them; nobody twice, nobody dead", () => {
    const named = load();
    named.api.addPerson(ME, "esposa", undefined, "Alzbeta Capon");
    assert.deepEqual(plain(named.api.spousesOf(ME)), [{ steamId: null, name: "Alzbeta Capon", relation: "esposa" }]);

    const { api, linked } = load();
    const added = linked(ME, "esposa", undefined, "Dorota", OTHER, { name: "Mauro Capon", gender: "male" });
    assert.equal(added.mirror.kind, "added");
    assert.deepEqual(plain(api.spousesOf(ME)), [{ steamId: OTHER, name: "Dorota", relation: "esposa" }], "linked: the player is named");
    assert.deepEqual(plain(api.spousesOf(OTHER)), [{ steamId: ME, name: "Mauro Capon", relation: "esposo" }], "and so is he in hers, once, though both trees say it");

    const dead = api.editPerson(ME, added.person.id, { deceased: true });
    assert.equal(dead.ok, true);
    assert.deepEqual(plain(api.spousesOf(ME)), [], "a spouse marked dead is not a consort");
    assert.deepEqual(plain(api.spousesOf(OTHER)).map((spouse) => spouse.steamId), [ME], "though he is still her husband in her own tree");
    assert.deepEqual(plain(api.spousesOf("")), []);
});

test("whose tree names a player as their spouse, of its own accord, is that player's spouse even when the player's own tree is empty", () => {
    const sut = load();
    sut.files.set(FILE, JSON.stringify({ [OTHER]: { persons: [{ id: "p1", relation: "esposo", degree: null, name: "Mauro", createdAt: 1, steamId: ME }], updatedAt: 1 } }));
    assert.deepEqual(plain(sut.api.spousesOf(ME)), [{ steamId: OTHER, name: "", relation: null }]);
});

test("a relative who is a player gets the one who added them in their own tree, as the relation turned around", () => {
    const { api, files, linked, relinked } = load();
    const result = linked(ME, "esposa", undefined, "Dorota", OTHER, MALE);
    assert.equal(result.ok, true);
    assert.equal(result.person.label, "Esposa", "the owner's own entry is as it always was");
    assert.equal(result.mirror.kind, "added");
    assert.equal(result.mirror.steamId, OTHER);
    assert.equal(result.mirror.person.label, "Esposo");

    const theirs = plain(api.listFamily(OTHER));
    assert.deepEqual(theirs.map((person) => [person.name, person.label, person.row, person.player, person.deceased]), [["Mauro Capon", "Esposo", "geracao", true, false]]);
    assert.ok(!JSON.stringify(theirs).includes(ME), "the Steam id stays on the server");
    assert.ok(!JSON.stringify(theirs).includes("mirror"), "and so does the marker");

    const saved = JSON.parse(files.get(FILE));
    assert.equal(saved[OTHER].persons[0].steamId, ME);
    assert.deepEqual(saved[OTHER].persons[0].mirrorOf, { owner: ME, id: "p1" });
    assert.equal(saved[ME].persons[0].mirrored, true, "the link is marked: its other side is made once");
    assert.equal(api.maritalStatus(OTHER, "female").gloss, "casada", "married by her own tree now");
});

test("a parent, a child, a sibling, an uncle, a grandchild and a cousin turn around by the gender of who adds them", () => {
    const cases = [
        ["filho", MALE, "Pai"], ["filha", FEMALE, "Mãe"], ["filho_adotivo", MALE, "Pai"], ["filha_bastarda", FEMALE, "Mãe"],
        ["pai", MALE, "Filho"], ["mae", FEMALE, "Filha"], ["avo", FEMALE, "Neta"], ["tio", MALE, "Sobrinho"], ["sobrinha", FEMALE, "Tia"],
        ["irmao", FEMALE, "Irmã"], ["bisneta", MALE, "Bisavô"], ["neto", MALE, "Avô"], ["esposo", FEMALE, "Esposa"],
    ];
    for (const [relation, who, label] of cases) {
        const { api, files, linked, relinked } = load();
        const result = linked(ME, relation, undefined, "Alguem", OTHER, who);
        assert.equal(result.mirror.kind, "added", relation);
        assert.equal(plain(api.listFamily(OTHER))[0].label, label, `${relation} added by a ${who.gender}`);
    }
    const { api, files, linked, relinked } = load();
    const cousin = linked(ME, "primo", 3, "Bohuslav", OTHER, FEMALE);
    assert.equal(cousin.mirror.person.label, "Prima de 3º grau", "the degree is the same from both sides");
});

test("nothing is mirrored for a request that did not say who asks, or for a relative who is no player", () => {
    const { api, files, linked, relinked } = load();
    const plainAdd = linked(ME, "esposa", undefined, "Dorota", OTHER);
    assert.equal(plainAdd.person.player, true, "the yes makes the link");
    assert.equal(plainAdd.mirror.kind, "unknown", "but not the other side");
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
    const noLink = api.addPerson(ME, "irmao", undefined, "Hynek", null, MALE);
    assert.equal(noLink.invited, undefined);
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
});

test("a tree that already has the player is left as it is, a full one too, and a player of no known gender or name gets nothing", () => {
    const present = load();
    present.linked(OTHER, "esposo", undefined, "Mauro", ME);
    const again = present.linked(ME, "esposa", undefined, "Dorota", OTHER, MALE);
    assert.equal(again.mirror.kind, "present");
    assert.equal(plain(present.api.listFamily(OTHER)).length, 1, "no second entry for the same player");
    assert.equal(JSON.parse(present.files.get(FILE))[ME].persons[0].mirrored, true);

    const full = load();
    for (let i = 0; i < 80; i += 1) {
        full.api.addPerson(OTHER, "primo", 1, `Primo ${i}`);
    }
    const added = full.linked(ME, "irmao", undefined, "Hynek", OTHER, MALE);
    assert.equal(added.ok, true, "the first tree takes it all the same");
    assert.equal(added.mirror.kind, "full");
    assert.equal(plain(full.api.listFamily(OTHER)).length, 80);
    assert.equal(JSON.parse(full.files.get(FILE))[ME].persons[0].mirrored, undefined, "not marked: it may be tried again");

    const odd = load();
    assert.equal(odd.linked(ME, "irmao", undefined, "Hynek", OTHER, { name: "Mauro", gender: null }).mirror.kind, "unknown");
    assert.equal(odd.linked(ME, "irma", undefined, "Outra", THIRD, { name: "M", gender: "male" }).mirror.kind, "unknown");
    assert.deepEqual(plain(odd.api.listFamily(OTHER)), []);
    assert.deepEqual(plain(odd.api.listFamily(THIRD)), []);
});

test("a long name is cut to fit the other tree, and its ids are its own", () => {
    const { api, files, linked, relinked } = load();
    api.addPerson(OTHER, "irmao", undefined, "Um");
    api.addPerson(OTHER, "irma", undefined, "Dois");
    const result = linked(ME, "filho", undefined, "Jindrich", OTHER, { name: "A".repeat(60), gender: "male" });
    assert.equal(result.mirror.person.name.length, 40);
    assert.equal(result.mirror.person.id, "p3");
});

test("changing the relation of the first changes the other side with it, and a cousin keeps the degree", () => {
    const { api, files, linked, relinked } = load();
    const spouse = linked(ME, "esposa", undefined, "Dorota", OTHER, MALE).person;
    const changed = api.editPerson(ME, spouse.id, { relation: "irma" }, MALE);
    assert.equal(changed.ok, true);
    assert.deepEqual(plain(changed.mirrors).map((outcome) => [outcome.kind, outcome.steamId, outcome.person.label]), [["updated", OTHER, "Irmão"]]);
    assert.equal(plain(api.listFamily(OTHER))[0].label, "Irmão");
    assert.equal(plain(api.listFamily(OTHER)).length, 1, "the same entry, not a new one");

    const kin = load();
    const cousin = kin.linked(ME, "primo", 3, "Bohuslav", OTHER, MALE).person;
    kin.api.editPerson(ME, cousin.id, { relation: "prima" }, MALE);
    assert.equal(plain(kin.api.listFamily(OTHER))[0].label, "Primo de 3º grau");

    const quiet = load();
    const son = quiet.linked(ME, "filho", undefined, "Jindrich", OTHER, MALE).person;
    assert.equal(quiet.api.editPerson(ME, son.id, { deceased: true }, MALE).mirrors, undefined, "a mark of life or death is the first one's alone");
});

test("changing the player of a link moves the other side; unlinking removes it; linking an unlinked one makes it", () => {
    const { api, files, linked, relinked } = load();
    const son = linked(ME, "filho", undefined, "Jindrich", OTHER, MALE).person;
    const moved = relinked(ME, son.id, { link: THIRD }, MALE);
    assert.deepEqual(plain(moved.mirrors).map((outcome) => [outcome.kind, outcome.steamId]), [["removed", OTHER], ["added", THIRD]]);
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
    assert.equal(plain(api.listFamily(THIRD))[0].label, "Pai");
    assert.equal(JSON.parse(files.get(FILE))[ME].persons[0].mirrored, true);

    const unlinked = api.editPerson(ME, son.id, { link: null }, MALE);
    assert.deepEqual(plain(unlinked.mirrors).map((outcome) => [outcome.kind, outcome.steamId]), [["removed", THIRD]]);
    assert.deepEqual(plain(api.listFamily(THIRD)), []);
    assert.equal(JSON.parse(files.get(FILE))[ME].persons[0].mirrored, undefined);

    const relink = relinked(ME, son.id, { link: OTHER }, MALE);
    assert.deepEqual(plain(relink.mirrors).map((outcome) => [outcome.kind, outcome.steamId]), [["added", OTHER]]);
    assert.equal(plain(api.listFamily(OTHER))[0].label, "Pai");

    // a link edited by a caller that does not say who it is leaves the other trees as they are
    const quiet = api.editPerson(ME, son.id, { link: FOURTH });
    assert.equal(quiet.mirrors, undefined);
    assert.equal(plain(api.listFamily(OTHER)).length, 1);
    assert.deepEqual(plain(api.listFamily(FOURTH)), []);
});

test("removing the first removes the other side with it, and says so", () => {
    const { api, files, linked, relinked } = load();
    const son = linked(ME, "filho", undefined, "Jindrich", OTHER, MALE).person;
    const loose = api.addPerson(ME, "irma", undefined, "Dorota").person;
    assert.deepEqual(plain(api.removePersonDetailed(ME, loose.id)), { removed: true, mirror: null });
    const gone = api.removePersonDetailed(ME, son.id);
    assert.equal(gone.removed, true);
    assert.deepEqual(plain(gone.mirror), { kind: "removed", steamId: OTHER });
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
    assert.deepEqual(plain(api.removePersonDetailed(ME, son.id)), { removed: false, mirror: null });

    const again = linked(ME, "filho", undefined, "Jindrich", OTHER, MALE);
    assert.equal(again.mirror.kind, "added", "and a later link is made again");
    assert.equal(api.removePerson(ME, again.person.id), true, "removePerson is the same, with only the yes or no");
    assert.deepEqual(plain(api.listFamily(OTHER)), []);
});

test("an entry its own player has touched is theirs: the first one's changes and removal no longer reach it, and theirs never reach the first", () => {
    const { api, files, linked, relinked } = load();
    const son = linked(ME, "filho", undefined, "Jindrich", OTHER, MALE).person;
    const entry = plain(api.listFamily(OTHER))[0];
    const taken = api.editPerson(OTHER, entry.id, { deceased: true }, FEMALE);
    assert.equal(taken.ok, true);
    assert.equal(taken.mirrors, undefined, "a change in the other tree does not travel back");

    const changed = api.editPerson(ME, son.id, { relation: "filho_adotivo" }, MALE);
    assert.equal(changed.mirrors, undefined, "nothing left to follow");
    assert.equal(plain(api.listFamily(OTHER))[0].deceased, true);
    const gone = api.removePersonDetailed(ME, son.id);
    assert.equal(gone.mirror, null);
    assert.equal(plain(api.listFamily(OTHER)).length, 1, "theirs stays");

    // theirs can be removed by them without touching the first's
    const second = load();
    const kid = second.linked(ME, "filha", undefined, "Dorota", OTHER, MALE).person;
    const theirs = plain(second.api.listFamily(OTHER))[0];
    assert.equal(second.api.removePerson(OTHER, theirs.id), true);
    assert.deepEqual(plain(second.api.listFamily(ME)).map((person) => person.id), [kid.id]);
});

test("a spouse marked dead in one's own tree still leaves one a widow: the other side's echo is not a second voice", () => {
    const { api, files, linked, relinked } = load();
    const wife = linked(ME, "esposa", undefined, "Dorota", OTHER, MALE).person;
    assert.equal(api.maritalStatus(ME, "male").gloss, "casado");
    assert.equal(api.maritalStatus(OTHER, "female").gloss, "casada");

    api.editPerson(ME, wife.id, { deceased: true }, MALE);
    assert.equal(api.maritalStatus(ME, "male").gloss, "viúvo", "not married again because of her mirror of him");
    assert.deepEqual(plain(api.familyHeirs(ME)), [], "and she is no heir of his once dead in his tree");
    assert.equal(api.maritalStatus(OTHER, "female").gloss, "casada", "she is still married by her own tree");
    assert.deepEqual(plain(api.familyHeirs(OTHER)).map((heir) => heir.steamId), [ME], "and he rises with her");

    // once she makes the entry hers, it is a voice of her own
    const entry = plain(api.listFamily(OTHER))[0];
    api.editPerson(OTHER, entry.id, { deceased: false }, FEMALE);
    assert.equal(api.maritalStatus(ME, "male").gloss, "casado", "she says so herself");
    assert.deepEqual(plain(api.familyHeirs(ME)).map((heir) => heir.steamId), [OTHER]);
});

test("the links made before the mirror existed are given their other side once, and never again for one that was removed", () => {
    const { api, files, linked, relinked } = load();
    linked(ME, "filha", undefined, "Dorota", OTHER);
    linked(THIRD, "irmao", undefined, "Hynek", FOURTH);
    const info = (steamId) => (steamId === ME ? { name: "Mauro Capon", gender: "male" } : null);

    assert.equal(api.backfillMirrors(info), 1);
    assert.deepEqual(plain(api.listFamily(OTHER)).map((person) => [person.name, person.label]), [["Mauro Capon", "Pai"]]);
    assert.deepEqual(plain(api.listFamily(FOURTH)), [], "somebody who is not known yet is left for later");
    assert.equal(api.backfillMirrors(info), 0, "once");

    api.removePerson(OTHER, plain(api.listFamily(OTHER))[0].id);
    assert.equal(api.backfillMirrors(info), 0);
    assert.deepEqual(plain(api.listFamily(OTHER)), [], "removed by its own player: not made again");

    assert.equal(api.backfillMirrors(() => ({ name: "Hans", gender: "male" })), 1, "the one left for later is made when it is known");
    assert.equal(plain(api.listFamily(FOURTH))[0].label, "Irmão");
    assert.deepEqual(plain(api.listFamily(OTHER)), [], "and the removed one still is not");
});

test("an entry the other side took over is not made again from it, even after the first one is removed", () => {
    const { api, files, linked, relinked } = load();
    const son = linked(ME, "filho", undefined, "Jindrich", OTHER, MALE).person;
    const entry = plain(api.listFamily(OTHER))[0];
    api.editPerson(OTHER, entry.id, { deceased: false }, FEMALE);
    api.removePerson(ME, son.id);
    assert.equal(api.backfillMirrors(() => ({ name: "Dorota", gender: "female" })), 0, "her entry is marked: the one who removed hers is not put back");
    assert.deepEqual(plain(api.listFamily(ME)), []);
});
