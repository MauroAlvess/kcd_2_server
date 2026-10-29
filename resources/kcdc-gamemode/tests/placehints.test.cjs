// The words that place a region and a property on the game's own map (2026-10-26: "não sei me localizar pelas regiões que você mapeou e não aparecem com nome no
// mapa ... colocar alguma identificação, exemplo próximo a X local, até mesmo no dropdown da seção Chaves"): the map's places as it writes them in Portuguese,
// how a spot is told against them, and what a region and a property of a place of its own say.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const run = (file, requires = {}) => {
    const sandbox = { exports: {}, require: (id) => requires[id] ?? (() => { throw new Error("require " + id); })(), console };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server", file), "utf8"), sandbox);
    return sandbox.exports;
};

// The list of regions is the real one: read out of the source, as plain literals.
const source = fs.readFileSync(path.join(__dirname, "../src/server/properties.ts"), "utf8");
const from = source.indexOf("export const REGIONS: readonly Region[] = [");
const REGIONS = vm.runInNewContext("(" + source.slice(source.indexOf("[", from), source.indexOf("\n];", from) + 2) + ")");

function load() {
    const data = run("map-places-data.js");
    const places = run("map-places.js", { "./map-places-data.js": data });
    const hints = run("place-hints.js", { "./properties.js": { REGIONS }, "./map-places.js": places });
    return { data, places, hints };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const house = (region, name, x, y, extra = {}) => ({ id: name, name, region, kind: "house", parentId: "", x, y, z: 0, ...extra });

test("the places are the map's own, in Portuguese as the map writes them: Grund is Minas, the Devil's Den is Toca do Diabo, Old Lhota is Lhota", () => {
    const { data, places } = load();
    assert.equal(data.MAP_PLACE_DATA.length, 27);
    assert.equal(places.mapPlaceNamed("Grund").name, "Minas", "the level's name finds the map's");
    assert.equal(places.mapPlaceNamed("minas").en, "Grund", "the map's name, with or without accents or capitals, finds the level's");
    assert.equal(places.mapPlaceNamed("Devil's Den").name, "Toca do Diabo");
    assert.equal(places.mapPlaceNamed("Old Lhota").name, "Lhota");
    assert.equal(places.mapPlaceNamed("Stara Kutna").name, "Stará Kutná");
    assert.equal(places.mapPlaceNamed("Atlântida"), null);
    assert.equal(places.mapPlaceNamed("Sigismund's camp and Opatowitz"), null, "the outline that holds the camp and the village is no place of its own");
    // The villages, towns, camps and strongholds are what a thing is told against; an inn, a vineyard, a hill and a graveyard are parts of places.
    assert.deepEqual(plain(data.MAP_PLACE_DATA.filter((place) => !place.landmark).map((place) => place.name).sort()), ["Cemitério do Monastério", "Colina de Wysoka", "Estalagem dos Carroceiros de Pschitoky", "Estalagem dos Carroceiros de Stará Kutná", "Ossuário", "Vinhedo do Monastério"]);
    for (const place of data.MAP_PLACE_DATA) {
        assert.ok(place.maxX > place.minX && place.maxY > place.minY, `${place.en}: an outline`);
        assert.ok(/^(de|da|das|do) /.test(place.of) && place.of.endsWith(place.name), `${place.en}: its name after "de"`);
    }
    assert.equal(places.mapPlaceNamed("Grund").of, "das Minas", "the game speaks of the Minas as plural: \"Você quer ir às Minas?\"");
    assert.equal(places.mapPlaceNamed("Devil's Den").of, "da Toca do Diabo");
    assert.equal(places.mapPlaceNamed("Suchdol").of, "de Suchdol");
});

test("a spot is in the smallest place whose outline holds it, and open country is in none", () => {
    const { places } = load();
    assert.equal(places.mapPlaceAt({ x: 3955, y: 742 }).name, "Ossuário", "the ossuary, not the monastery round it");
    assert.equal(places.mapPlaceAt({ x: 3800, y: 400 }).name, "Monastério de Sedletz");
    assert.equal(places.mapPlaceAt({ x: 2168, y: 1510 }).name, "Estalagem dos Carroceiros de Pschitoky");
    assert.equal(places.mapPlaceAt({ x: 3207, y: 2230 }).name, "Minas");
    assert.equal(places.mapPlaceAt({ x: 2500, y: 100 }), null);
});

test("the way to a spot is said on the compass, north up: +Y is north and +X east", () => {
    const { places } = load();
    const at = { x: 1000, y: 1000 };
    const point = (dx, dy) => places.pointOf(at, { x: at.x + dx, y: at.y + dy });
    assert.deepEqual([point(0, 100), point(100, 100), point(100, 0), point(100, -100), point(0, -100), point(-100, -100), point(-100, 0), point(-100, 100)],
        ["ao norte", "a nordeste", "a leste", "a sudeste", "ao sul", "a sudoeste", "a oeste", "a noroeste"]);
    assert.equal(point(20, 100), "ao norte", "a little off the line is still the same side");
    assert.equal(point(100, 20), "a leste");
});

test("against a place a spot is inside it, or on a side of it and how far, to the ten metres", () => {
    const { places } = load();
    const minas = places.mapPlaceNamed("Minas");
    assert.equal(places.against(minas, { x: 3207, y: 2230 }), "dentro das Minas", "inside the outline: \"dentro\", with the name as the game says it");
    assert.equal(places.against(minas, { x: 3200, y: 2230 }, true), "dentro das Minas", "inside there is no distance");
    assert.equal(places.against(minas, { x: 2912, y: 2937 }), "a noroeste das Minas");
    assert.equal(places.against(minas, { x: 2912, y: 2937 }, true), "a noroeste das Minas (770 m)");
    assert.equal(places.against(places.mapPlaceNamed("Maleshov"), { x: 440, y: 737 }, true), "ao norte de Maleshov (500 m)");
    assert.equal(places.roundedMetres(3), 10, "never a nought");
    assert.equal(places.roundedMetres(344), 340);
});

test("the nearest landmark leaves out the places a thing is not told by, and the one asked to be left out", () => {
    const { places } = load();
    const inn = { x: 2168, y: 1510 };
    assert.equal(places.nearestLandmark(inn).place.name, "Pschitoky", "the inn is no landmark: the village it belongs to is");
    const minas = places.mapPlaceNamed("Minas");
    assert.equal(places.nearestLandmark({ x: 3207, y: 2230 }).place.name, "Minas");
    assert.equal(places.nearestLandmark({ x: 3207, y: 2230 }, [minas]).place.name, "Horschan", "left out, the next nearest");
    assert.equal(places.nearestLandmark({ x: 3207, y: 2230 }, [minas]).metres.toFixed(0), "757");
});

test("every region of the list tells where it is: Minas is above Stará Kutná, as the user places it, and the map's own name shows where it differs from ours", () => {
    const { hints } = load();
    const said = Object.fromEntries(REGIONS.map((region) => [region.name, plain(hints.regionHint(region.name))]));
    assert.deepEqual(said["Minas"], { kind: "village", map: "", where: "ao norte de Stará Kutná" });
    assert.deepEqual(said["Stará Lhota"], { kind: "village", map: "Lhota", where: "a oeste de Rabstein" }, "the map calls it Lhota");
    assert.deepEqual(said["Malešov"], { kind: "castle", map: "Maleshov", where: "ao sul de Lhota" }, "the map spells it Maleshov");
    assert.deepEqual(said["Suchdol"], { kind: "castle", map: "", where: "ao norte de Wysoka" });
    assert.deepEqual(said["Kuttenberg"], { kind: "castle", map: "", where: "ao sul de Stará Kutná" });
    assert.deepEqual(said["Horschan"], { kind: "village", map: "", where: "a sudoeste da Toca do Diabo" });
    assert.deepEqual(said["Opatowitz"], { kind: "village", map: "", where: "a nordeste do Acampamento de Sigismundo" });
    for (const region of REGIONS) {
        const hint = said[region.name];
        assert.ok(hint !== null && hint.where !== "", `${region.name}: it says where it is`);
        assert.ok(!hint.where.includes(region.name) || region.near !== undefined, `${region.name}: never told against itself`);
        assert.equal(hint.kind, region.fortress !== undefined || region.id === "kuttenberg" ? "castle" : "village", `${region.name}: its drawing`);
    }
    assert.equal(REGIONS.filter((region) => said[region.name].map !== "").length, 2, "only two of ours are written otherwise on the map");
    assert.equal(hints.regionHint("Minas").where, hints.regionHint("minas").where, "found with or without capitals");
});

test("a region nobody listed is told by where its houses stand; one with nothing in it says nothing", () => {
    const { hints } = load();
    const catalog = [house("Feira de Verão", "Tenda 1", 1650, 1050), house("Feira de Verão", "Tenda 2", 1680, 1070), house("Feira de Verão", "Baú 1", 1655, 1055, { kind: "chest", parentId: "Tenda 1" })];
    const said = plain(hints.regionHint("Feira de Verão", catalog));
    assert.deepEqual(said, { kind: "village", map: "Bylany", where: "ao norte de Zimburg" }, "the middle of its houses is inside Bylany's outline, which the map names, and Zimburg is the next place over");
    assert.equal(hints.regionHint("Lugar nenhum", catalog), null);
    assert.deepEqual(plain(hints.regionHints(["Minas", "Lugar nenhum", "Feira de Verão"], catalog)), { Minas: plain(hints.regionHint("Minas")), "Feira de Verão": said }, "a list of names: the ones nothing is known of are left out");
});

test("a property that is a place of its own says what the map calls it and where it stands against its village", () => {
    const { hints } = load();
    assert.equal(hints.propertyHint(house("Pschitoky", "Estalagem de Pschitoky", 2168, 1510)), "no mapa: Estalagem dos Carroceiros de Pschitoky · a sudoeste de Pschitoky (340 m)");
    assert.equal(hints.propertyHint(house("Malešov", "Haras de Malešov", 440, 737)), "ao norte de Maleshov (500 m)", "the stud farm is on the map by no name: only where it is");
    assert.equal(hints.propertyHint(house("Minas", "Toca do Diabo", 2912, 2937)), "a noroeste das Minas (770 m)", "the map calls the den by the very name: only where it is, left of Minas");
    assert.equal(hints.propertyHint(house("Pschitoky", "Castelo de Pschitoky", 2260, 1807)), "dentro de Pschitoky");
    assert.equal(hints.propertyHint(house("Suchdol", "Castelo de Suchdol", 775, 3360)), "dentro de Suchdol");
    // A house, a chest, a region the list does not know, a compound renamed: nothing to add.
    assert.equal(hints.propertyHint(house("Suchdol", "Casa 01", 520, 3250)), "");
    assert.equal(hints.propertyHint(house("Suchdol", "Baú 1", 520, 3250, { kind: "chest" })), "");
    assert.equal(hints.propertyHint(house("Feira de Verão", "Tenda 1", 1650, 1050)), "");
    assert.equal(hints.propertyHint(house("Pschitoky", "Estalagem renomeada", 2168, 1510)), "");
});
