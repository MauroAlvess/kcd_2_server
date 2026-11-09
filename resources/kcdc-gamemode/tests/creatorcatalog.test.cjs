const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const box = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/creator-catalog.js"), "utf8"), box);
const { buildCatalog, pageCatalog, resolveLook, pickedFrom, TONES } = box.exports;

const plain = (value) => JSON.parse(JSON.stringify(value));

/** A small game: the shapes of the real catalog (faces made for somebody, hairstyles in colours, beards per face). */
const OPTIONS = {
    male: {
        head: ["henry", "henry_injured", "m_head_000", "m_head_000_b00", "m_head_001", "m_head_034", "m_head_drowner", "m_head_zizka"],
        body: ["henry_body", "drowner_body", "m_body_pale_01", "m_body_pale_02", "m_body_tan_01", "m_body_roma_01", "m_body_pale_old_01", "male_body_npc"],
        hair: [
            ["x_hair_01", "m_hair_001_black"], ["x_hair_01", "m_hair_001_blonde"], ["x_hair_01", "m_hair_001_dark_brown"], ["x_hair_01", "m_hair_001_dark_ginger"], ["x_hair_01", "m_hair_001_dark_grey"], ["x_hair_01", "x_hair_01"],
            ["x_hair_02", "m_hair_002_white"], ["x_hair_02", "m_hair_002_grey"], ["x_hair_02", "x_hair_02"],
            ["m_hair_barber_01", "m_hair_barber_01"],
            ["m_hair_capon", "m_hair_capon"],
            ["x_hair_monk_01", "m_hair_monk_01_ginger"], ["x_hair_monk_01", "x_hair_monk_01"],
            ["x_hair_19", "m_hair_019_black"], ["x_hair_19", "x_hair_19_blonde"], ["x_hair_19", "x_hair_19"],
        ],
        beards: { m_head_000: ["m_beard_00", "m_beard_01", "UC_beard_capon", "UC_beard_barber_01"], m_head_001: [], m_head_034: ["m_beard_00"] },
    },
    female: {
        head: ["f_head_000", "f_head_001", "f_head_special"],
        body: ["f_body_pale_01", "f_roma_01", "female_body_naked", "f_body_old_pale_01"],
        hair: [["f_hair_001", "f_hair_001"], ["f_hair_001", "f_hair_001_black"], ["f_hair_001", "f_hair_001_ginger"], ["f_hair_katherine", "f_hair_katherine"], ["f_hair_zz", "f_hair_zz"]],
        beards: {},
    },
};

const appearances = {
    options: (part, gender = "male") => (part === "hair" ? OPTIONS[gender].hair.map(([group, name]) => ({ name, group })) : OPTIONS[gender][part].map((name) => ({ name, group: name }))),
    beards: (head, gender = "male") => (OPTIONS[gender].beards[head] ?? []).map((name) => ({ name })),
};

test("what is offered: the generic faces, then the game's people as they stand (never hurt, dead or drowned), the old skins after the others, no skin that is a corpse (2026-11-02)", () => {
    const catalog = buildCatalog(appearances);
    assert.deepEqual(plain(catalog.male.heads), ["m_head_000", "m_head_001", "m_head_034", "henry", "m_head_zizka"], "what was offered before keeps its numbers");
    assert.deepEqual(plain(catalog.male.skins), ["m_body_pale_01", "m_body_pale_02", "m_body_roma_01", "m_body_tan_01", "m_body_pale_old_01"]);
    assert.deepEqual(plain(catalog.female.heads), ["f_head_000", "f_head_001"], "a face of nobody the list names is not offered");
    assert.deepEqual(plain(catalog.female.skins), ["f_body_pale_01", "f_roma_01", "f_body_old_pale_01"]);
});

test("a hairstyle comes with its colours in the order of the swatches, one name for each, and the named men's styles come after the others (2026-11-02)", () => {
    const { male, female } = buildCatalog(appearances);
    assert.deepEqual(plain(male.hairs.map((style) => style.base)), ["m_hair_barber_01", "x_hair_01", "x_hair_02", "x_hair_19", "x_hair_monk_01", "m_hair_capon"]);
    const first = male.hairs.find((style) => style.base === "x_hair_01");
    assert.deepEqual(plain(first.colours), [
        { tone: "black", name: "m_hair_001_black" },
        { tone: "dark_brown", name: "m_hair_001_dark_brown" },
        { tone: "dark_ginger", name: "m_hair_001_dark_ginger" },
        { tone: "blonde", name: "m_hair_001_blonde" },
        { tone: "dark_grey", name: "m_hair_001_dark_grey" },
    ]);
    assert.deepEqual(plain(male.hairs.find((style) => style.base === "x_hair_02").colours.map((colour) => colour.tone)), ["grey", "white"], "grey before white; dark_grey is its own colour");
    assert.deepEqual(plain(male.hairs.find((style) => style.base === "m_hair_barber_01").colours), [], "a barber's style has no colours");
    assert.deepEqual(plain(male.hairs.find((style) => style.base === "x_hair_19").colours.map((colour) => colour.name)), ["m_hair_019_black", "x_hair_19_blonde"], "colours named in two ways");
    assert.ok(TONES.indexOf("dark_ginger") < TONES.indexOf("ginger"), "a colour that ends like another is told apart by the order");
    assert.deepEqual(plain(female.hairs.map((style) => style.base)), ["f_hair_001", "f_hair_katherine"], "all of a woman's, bar the one nobody could tell what it is");
});

test("a face grows every beard the game made for it, named ones too (2026-11-02), and no other", () => {
    const { male, female } = buildCatalog(appearances);
    assert.deepEqual(plain(male.beards), [["UC_beard_barber_01", "UC_beard_capon", "m_beard_00", "m_beard_01"], [], ["m_beard_00"], [], []]);
    assert.deepEqual(plain(female.beards), [[], []], "a woman has none");
});

test("the page is sent how many of each and the colours, and never a name of the game's", () => {
    const sent = pageCatalog(buildCatalog(appearances));
    assert.deepEqual(plain(sent.male.beards), [4, 0, 1, 0, 0]);
    assert.equal(sent.male.heads, 5);
    assert.equal(sent.male.skins, 5);
    assert.deepEqual(plain(sent.male.hairs[1]), ["black", "dark_brown", "dark_ginger", "blonde", "dark_grey"]);
    assert.doesNotMatch(JSON.stringify(sent), /m_head|m_hair|x_hair|m_body|beard_0/);
});

test("a look from the page is put into the game's names, and anything out of range is refused", () => {
    const catalog = buildCatalog(appearances);
    const ok = { gender: "male", head: 0, hair: 1, tone: 3, beard: 3, skin: 2 };
    assert.deepEqual(plain(resolveLook(catalog, ok)), { gender: "male", head: "m_head_000", hair: "m_hair_001_blonde", beard: "m_beard_01", body: "m_body_roma_01" });
    assert.deepEqual(plain(resolveLook(catalog, { gender: "male", head: 1, hair: 0, tone: -1, beard: -1, skin: 0 })), { gender: "male", head: "m_head_001", hair: "m_hair_barber_01", beard: "", body: "m_body_pale_01" }, "no colours: the style itself");
    assert.equal(resolveLook(catalog, { ...ok, beard: -1 }).beard, "", "no beard");
    assert.equal(resolveLook(catalog, { ...ok, head: 1, beard: 5 }).beard, "", "a face with no beard ignores the number");
    for (const bad of [{ ...ok, head: 5 }, { ...ok, head: -1 }, { ...ok, head: 0.5 }, { ...ok, hair: 9 }, { ...ok, tone: 5 }, { ...ok, tone: -1 }, { ...ok, beard: 4 }, { ...ok, skin: 5 }, { ...ok, gender: "other" }, { ...ok, head: "0" }, null, "x", 3, undefined]) {
        assert.equal(resolveLook(catalog, bad), null, JSON.stringify(bad));
    }
});

test("a creator opened for one gender takes no look of the other", () => {
    const catalog = buildCatalog(appearances);
    const woman = { gender: "female", head: 1, hair: 0, tone: 1, beard: -1, skin: 1 };
    assert.deepEqual(plain(resolveLook(catalog, woman, "female")), { gender: "female", head: "f_head_001", hair: "f_hair_001_ginger", beard: "", body: "f_roma_01" });
    assert.equal(resolveLook(catalog, woman, "male"), null);
    assert.equal(resolveLook(catalog, { gender: "male", head: 0, hair: 0, tone: -1, beard: -1, skin: 0 }, "female"), null);
    assert.notEqual(resolveLook(catalog, woman, "both"), null);
});

test("a look already worn is found again in the catalog by its names, and what is not in it is picked", () => {
    const catalog = buildCatalog(appearances);
    const never = () => 0.99;
    const worn = { gender: "male", head: "m_head_034", hair: "m_hair_001_dark_brown", beard: "m_beard_00", body: "m_body_tan_01" };
    assert.deepEqual(plain(pickedFrom(catalog, worn, "both", never)), { gender: "male", head: 2, hair: 1, tone: 1, beard: 0, skin: 3 });
    // Henry's own face is offered since 2026-11-02 and found again; a hairstyle this catalog does not offer is replaced by a pick; what is offered stays
    const henry = { gender: "male", head: "henry", hair: "m_hair_henry", beard: "", body: "m_body_pale_02" };
    const picked = pickedFrom(catalog, henry, "both", () => 0);
    assert.equal(picked.head, 3, "Henry's face, after the generic ones");
    assert.equal(picked.hair, 0);
    assert.equal(picked.skin, 1, "the skin it wears is in the catalog");
    assert.equal(picked.beard, -1, "no beard worn, none picked for a body that is not new");
    // a hairstyle with no colours is found by its name and has no tone
    assert.deepEqual(plain(pickedFrom(catalog, { ...worn, hair: "m_hair_barber_01", head: "m_head_001", beard: "" }, "both", never)), { gender: "male", head: 1, hair: 0, tone: -1, beard: -1, skin: 3 });
});

test("for somebody new, everything is picked, so the server is not full of Henrys", () => {
    const catalog = buildCatalog(appearances);
    const first = pickedFrom(catalog, null, "both", () => 0);
    const last = pickedFrom(catalog, null, "both", () => 0.999);
    assert.equal(first.gender, "male");
    assert.notDeepEqual(plain(first), plain(last));
    for (const look of [first, last]) {
        assert.notEqual(resolveLook(catalog, look), null, "what is picked is always a look the catalog takes");
    }
    // opened for women only, a man's look becomes a woman's
    const woman = pickedFrom(catalog, { gender: "male", head: "m_head_000", hair: "", beard: "", body: "" }, "female", () => 0);
    assert.equal(woman.gender, "female");
    assert.notEqual(resolveLook(catalog, woman, "female"), null);
});
