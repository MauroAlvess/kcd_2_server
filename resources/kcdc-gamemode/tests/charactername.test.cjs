const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const box = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-name.js"), "utf8"), box);
const { cleanName, epithetById, fullName, nameKey, EPITHETS, EPITHET_GROUPS, NAME_MIN, NAME_MAX } = box.exports;

const refused = (raw) => {
    const check = cleanName(raw);
    assert.equal(check.ok, false, `${JSON.stringify(raw)} should be refused`);
    return check.reason;
};

test("a first name is letters only, set in the usual case, with the accents of Bohemia and Brazil", () => {
    for (const [typed, kept] of [["henry", "Henry"], ["HENRY", "Henry"], ["hENRY", "Henry"], ["Matyáš", "Matyáš"], ["jiří", "Jiří"], ["JOÃO", "João"], ["Štěpán", "Štěpán"], ["Zdeněk", "Zdeněk"], ["Ça", "Ça"]]) {
        assert.deepEqual({ ...cleanName(typed) }, { ok: true, name: kept }, typed);
    }
    assert.equal(cleanName("a".repeat(NAME_MAX)).ok, true, "the longest");
    assert.equal(cleanName("a".repeat(NAME_MIN)).ok, true, "the shortest");
});

test("no spaces, no numbers, no symbols, and the length is held", () => {
    assert.match(refused("Henry Capon"), /sem espaços/);
    assert.match(refused(" Henry"), /sem espaços/, "a leading blank too");
    assert.match(refused("Henry "), /sem espaços/, "a no-break space too");
    assert.match(refused("Henry2"), /números/);
    assert.match(refused("1403"), /números/);
    for (const bad of ["Henry!", "Hen-ry", "O'Neil", "Henry_", "Hen.ry", "Hen@ry", "Henry<b>", "😀😀", "Ηenry", "Генрих", "ＨＥＮＲＹ", "Hen×ry"]) {
        assert.match(refused(bad), /Só letras/, bad);
    }
    assert.match(refused("H"), /entre 2 e 16 letras/);
    assert.match(refused("a".repeat(NAME_MAX + 1)), /entre 2 e 16 letras/);
    assert.match(refused(""), /Escreva/);
    assert.match(refused("   "), /Escreva/);
    for (const notText of [null, undefined, 42, {}, ["Henry"]]) {
        assert.match(refused(notText), /Escreva/);
    }
});

test("the words the game uses for a stranger and for the staff are not names", () => {
    for (const word of ["Desconhecido", "desconhecida", "ADMIN", "Administrador", "Coroa", "Servidor"]) {
        assert.match(refused(word), /não pode ser usado/, word);
    }
    assert.equal(cleanName("Coroado").ok, true, "only the whole word");
});

test("a name and its alcunha read the way Bohemia would write them", () => {
    assert.equal(fullName("Henry", "ii"), "Henry II");
    assert.equal(fullName("Henry", "junior"), "Henry Júnior");
    assert.equal(fullName("Henry", "ruivo"), "Henry o Ruivo");
    assert.equal(fullName("Henry", ""), "Henry");
    assert.equal(fullName("Henry"), "Henry");
    assert.equal(fullName("Henry", "nao-existe"), "Henry", "an unknown alcunha is no alcunha");
});

test("two names are the same when only capitals, accents and punctuation tell them apart", () => {
    assert.equal(nameKey("Matyáš II"), "matyasii");
    assert.equal(nameKey("MATYAS ii"), "matyasii");
    assert.equal(nameKey("Henry o Ruivo"), "henryoruivo");
    assert.notEqual(nameKey("Henry"), nameKey("Henry II"));
    assert.equal(nameKey("Jiří"), "jiri");
});

test("the list of alcunhas has what the user asked for, each once, in groups that exist", () => {
    const labels = EPITHETS.map((epithet) => epithet.label);
    for (const wanted of ["I", "II", "Júnior"]) {
        assert.ok(labels.includes(wanted), wanted);
    }
    assert.equal(new Set(EPITHETS.map((epithet) => epithet.id)).size, EPITHETS.length, "ids are unique");
    assert.equal(new Set(labels).size, labels.length, "labels are unique");
    const groups = new Set(EPITHET_GROUPS.map((group) => group.id));
    for (const epithet of EPITHETS) {
        assert.ok(groups.has(epithet.group), `${epithet.id}: group ${epithet.group}`);
        assert.match(epithet.id, /^[a-z]+$/, "an id is plain letters");
    }
    assert.equal(epithetById("ii").label, "II");
    assert.equal(epithetById("zzz"), null);
    assert.equal(epithetById(undefined), null);
    assert.equal(epithetById(7), null);
});
