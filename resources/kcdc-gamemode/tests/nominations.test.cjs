const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ADMIN = "76561198000000100";
const LORD = "76561198000000101";
const KNIGHT = "76561198000000102";
const PEASANT = "76561198000000103";
const WIFE = "76561198000000104";
const SON = "76561198000000105";
const STRANGER = "76561198000000106";

const plain = (value) => JSON.parse(JSON.stringify(value));
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

/** The real catalog, to count it. */
const CATALOG = (() => {
    const box = { exports: {} };
    vm.runInNewContext(dist("nobility.js"), box);
    return box.exports.TITLES;
})();

/** Every key of every object in a value, however deep. */
function keysOf(value, found = new Set()) {
    if (Array.isArray(value)) {
        value.forEach((item) => keysOf(item, found));
    } else if (typeof value === "object" && value !== null) {
        for (const [key, inner] of Object.entries(value)) {
            found.add(key);
            keysOf(inner, found);
        }
    }
    return found;
}

/**
 * The real nominations over the real catalog and the real titles store, on a fake disk; the status module, the family
 * book, the properties and the acquaintances are fakes that remember what they were asked.
 */
function load({ social = {}, knowing = {}, heirs = {}, lands = {}, genders = {}, surnames = {}, towns = {}, consorts = {}, trades = [], memberNames = {} } = {}) {
    const baseHeirs = {};
    const files = new Map();
    const logs = [];
    const handlers = new Map();
    const clientHandlers = new Map();
    const statusListeners = [];
    const payloadContributors = [];
    const nomineeSources = [];
    const players = [];
    const notices = [];
    const socialSent = [];
    const rosterSent = [];
    const setStatus = [];

    const nobility = { exports: {} };
    vm.runInNewContext(dist("nobility.js"), nobility);
    const fakeStore = {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, body) => files.set(file, JSON.stringify(body)),
    };
    const characters = { getCharacter: (steamId) => (genders[steamId] ? { appearance: { gender: genders[steamId] } } : null) };
    const titlesBox = { exports: {} };
    vm.runInNewContext(dist("titles.js"), {
        exports: titlesBox.exports,
        require: (id) => (id === "./nobility.js" ? nobility.exports : id === "./characters.js" ? characters : id === "./store.js" ? fakeStore : id === "./thieves.js" ? { onThiefChange() {}, thiefMark: () => null } : assert.fail(`titles: unexpected ${id}`)),
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
    });

    const status = {
        SOCIAL_STATUS: { plebeius: { label: "Plebeius", gloss: "plebeu" }, nobilis: { label: "Nobilis", gloss: "nobre" } },
        getSocialStatus: (steamId) => social[steamId] ?? "plebeius",
        setSocialStatus: (steamId, next) => {
            const before = social[steamId] ?? "plebeius";
            social[steamId] = next;
            setStatus.push([steamId, next]);
            if (before !== next) statusListeners.forEach((listener) => listener(steamId, next, before));
        },
        onStatusChange: (listener) => statusListeners.push(listener),
        addPayload: (contributor) => payloadContributors.push(contributor),
        setNominees: (source) => nomineeSources.push(source),
        getGuildId: (steamId) => (steamId === LORD ? "fabri-ferrarii" : null),
        getFactionId: (steamId) => (steamId === LORD ? "leao-dourado" : null),
        notice: (player, text) => notices.push({ to: player.steamId, text }),
        sendSocial: (player) => socialSent.push(player.steamId),
        sendRoster: (player) => rosterSent.push(player.steamId),
        familyLinked: [],
    };

    const context = {
        exports: {},
        require: (id) => {
            switch (id) {
                case "./acquaintances.js":
                    return { knows: (viewer, target) => viewer.id === target.id || (knowing[viewer.steamId] ?? []).includes(target.steamId), nameOf: (player) => (surnames[player.steamId] ? `${player.nickname} ${surnames[player.steamId]}` : player.nickname), adminLabel: (player) => player.nickname };
                case "./auth.js":
                    return { isAdmin: (player) => player.steamId === ADMIN };
                case "./characters.js":
                    return characters;
                case "./family.js":
                    return {
                        familyHeirs: (steamId) => (heirs[steamId] ?? []).map((heir) => ({ steamId: heir, name: "" })),
                        familyBaseHeirs: (steamId) => (baseHeirs[steamId] ?? []).map((heir) => ({ steamId: heir, name: "" })),
                        getSurname: (steamId) => surnames[steamId] ?? null,
                        maritalStatus: (steamId, gender) => (steamId === LORD ? { label: "Coniugatus", gloss: "casado" } : { label: "Caelebs", gloss: gender === "female" ? "solteira" : "solteiro" }),
                    };
                case "./nobility.js":
                    return nobility.exports;
                case "./properties.js":
                    return { landSummary: (steamId) => lands[steamId] ?? [] };
                case "./status.js":
                    return status;
                case "./titles.js":
                    return titlesBox.exports;
                case "./big-emit.js":
                    return { emitLarge: (player, name, json) => { player.emit(`kcdc-gamemode:${name}`, json); return 1; } };
                case "./citizenship.js":
                    return { townOf: (steamId) => (towns[steamId] ? { id: towns[steamId].toLowerCase(), name: towns[steamId] } : null) };
                case "./consort.js":
                    return { consortsOf: (steamId) => consorts[steamId] ?? [] };
                case "./scribe.js":
                    return { tradesmen: () => trades };
                case "./guild-members.js":
                    return { nameOfMember: (steamId) => memberNames[steamId] ?? "um jogador" };
                default:
                    return assert.fail(`nominations: unexpected require ${id}`);
            }
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Math: Object.create(Math, { random: { value: () => 0.123456789 } }),
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => clientHandlers.set(name, fn) },
        Player: { all: () => players, getById: (id) => players.find((player) => player.id === id) ?? null },
    };
    vm.runInNewContext(dist("nominations.js"), context);
    context.exports.installNominations();

    let nextId = 1;
    const makePlayer = (steamId, nickname) => {
        const player = {
            id: nextId++,
            steamId,
            nickname,
            ready: true,
            appearance: { gender: genders[steamId] ?? "male" },
            emitted: [],
            calls: [],
            emit(event, payload) { this.emitted.push({ event, payload: JSON.parse(payload) }); },
            setNametagVisible(value) { this.calls.push(["visible", value]); },
            setNametagText(value) { this.calls.push(["text", value]); },
            setNametagColor() {},
            setNametagHealthVisible() {},
        };
        players.push(player);
        return player;
    };
    const titles = titlesBox.exports;
    const give = (steamId, name, ...ids) => ids.forEach((id) => titles.addTitle(steamId, name, id, { steamId: "admin", name: "a Coroa" }));
    return { api: context.exports, baseHeirs, statusApi: status, nobility: nobility.exports, titles, social, notices, socialSent, rosterSent, setStatus, setSocial: status.setSocialStatus, players, handlers, clientHandlers, payloadContributors, nomineeSources, logs, makePlayer, give, files };
}

const fire = (sut, name, player, payload) => sut.clientHandlers.get(`kcdc-gamemode:${name}`)(player, payload);

/** A table: a lord (with the right to name), a knight, a peasant, and a stranger the lord has not met. */
function realm(more = {}) {
    const sut = load({
        social: { [LORD]: "nobilis", [KNIGHT]: "nobilis", [WIFE]: "plebeius", [SON]: "plebeius", ...(more.social ?? {}) },
        knowing: { [LORD]: [KNIGHT, PEASANT, WIFE], [KNIGHT]: [LORD] },
        heirs: { [PEASANT]: [WIFE, SON], ...(more.heirs ?? {}) },
        genders: { [WIFE]: "female" },
        lands: { [LORD]: [{ region: "Suchdol", houses: 3, chests: 5, whole: false }, { region: "Wysoka", houses: 0, chests: 0, whole: true }] },
        surnames: { [LORD]: "Capon" },
        consorts: more.consorts ?? {},
        towns: more.towns ?? {},
        trades: more.trades ?? [],
        memberNames: more.memberNames ?? {},
    });
    const admin = sut.makePlayer(ADMIN, "Mauro");
    const lord = sut.makePlayer(LORD, "Radovan");
    const knight = sut.makePlayer(KNIGHT, "Ivan");
    const peasant = sut.makePlayer(PEASANT, "Kath");
    const wife = sut.makePlayer(WIFE, "Dorota");
    const son = sut.makePlayer(SON, "Jan");
    const stranger = sut.makePlayer(STRANGER, "Hans");
    sut.give(LORD, "Radovan", "lorde");
    sut.give(KNIGHT, "Ivan", "escudeiro");
    return { sut, admin, lord, knight, peasant, wife, son, stranger };
}

test("the section is a noble's and an administrator's: a commoner is told nothing and answered nothing", () => {
    const { sut, lord, peasant, knight, admin } = realm();
    assert.deepEqual(plain(sut.api.nobilityFor(peasant)), { visible: false });
    assert.equal(sut.api.canUse(peasant), false);
    assert.equal(sut.api.canUse(lord), true);
    assert.equal(sut.api.canUse(admin), true, "an administrator names as the Crown");

    const asked = sut.clientHandlers.get("kcdc-gamemode:status.hierarchy");
    asked(peasant);
    assert.deepEqual(peasant.emitted, [], "no hierarchy for a commoner");
    asked(knight);
    assert.equal(knight.emitted.at(-1).event, "kcdc-gamemode:status.hierarchy");
});

test("a noble sees what they may name and whom they know; an administrator sees every title and every player", () => {
    const { sut, lord, knight, admin } = realm();
    const own = sut.api.nobilityFor(lord);
    assert.equal(own.visible, true);
    assert.equal(own.power, true);
    assert.deepEqual(plain(own.options.map((option) => option.id)).slice(0, 3), ["cavaleiro", "escudeiro", "pequeno-nobre"]);
    assert.ok(!own.options.some((option) => ["rei", "lorde", "bispo"].includes(option.id)));
    assert.deepEqual(plain(sut.api.candidatesFor(lord).map((candidate) => candidate.name)).sort(), ["Dorota", "Ivan", "Kath"], "only who has introduced themselves, never the stranger");
    assert.equal(own.candidates, undefined, "whom to name is asked for a page at a time, not sent with the block");
    assert.deepEqual(plain(own.mine.map((line) => line.id)), ["lorde"]);
    assert.equal(own.mine[0].by, "", "named by the Crown");

    const squire = sut.api.nobilityFor(knight);
    assert.equal(squire.power, false, "a squire names nobody");
    assert.deepEqual(plain(squire.options), []);

    const crown = sut.api.nobilityFor(admin);
    assert.equal(crown.power, false, "in the Nomeação section an administrator names as their character, who holds no title");
    assert.deepEqual(plain(crown.options), []);
    assert.equal(crown.crownOptions.length, CATALOG.length, "the whole catalog, for the Jogadores page");
    assert.ok(crown.crownOptions.some((option) => option.id === "rei"));
    assert.equal(own.crownOptions, undefined, "and for nobody else");
    assert.equal(sut.api.candidatesFor(admin).length, 6, "everybody else, by their nickname");
});

test("a lord names a commoner a knight: the knight and their family become lesser nobles (2026-10-19), everybody is told, the page is redrawn", () => {
    const { sut, lord, peasant, wife, son } = realm();
    fire(sut, "status.nominate", lord, { targetId: peasant.id, title: "cavaleiro" });

    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), ["cavaleiro"]);
    assert.equal(sut.titles.grantsOf(PEASANT)[0].by, LORD);
    assert.equal(sut.titles.grantsOf(PEASANT)[0].byName, "Radovan Capon");
    assert.equal(sut.social[PEASANT], "minor", "a knight is of the lesser nobility");
    assert.equal(sut.social[WIFE], "minor", "the spouse rises with them");
    assert.equal(sut.social[SON], "minor", "and the legitimate line");
    assert.match(sut.notices.find((entry) => entry.to === LORD).text, /Kath agora é Cavaleiro\. Agora é da nobreza menor, e a família com ele: Dorota, Jan\./);
    assert.match(sut.notices.find((entry) => entry.to === PEASANT).text, /Radovan Capon nomeou você Cavaleiro\. Você agora é da nobreza menor: veja a seção Nomeação do painel \(F2\)\./);
    assert.match(sut.notices.find((entry) => entry.to === WIFE).text, /Kath foi nomeado Cavaleiro, e você agora é da nobreza menor/);
    assert.ok(sut.socialSent.includes(PEASANT) && sut.socialSent.includes(WIFE) && sut.socialSent.includes(SON) && sut.socialSent.includes(LORD));
    assert.ok(sut.logs.some((line) => /Radovan nomeou Kath Cavaleiro; subiram: Kath \(minor\), Dorota \(minor\), Jan \(minor\)/.test(line)));
    assert.ok(!sut.setStatus.some(([steamId]) => steamId === STRANGER));
});

test("the great titles make a noble (the Crown names a lord), and a lesser noble named higher rises; nobody is ever lowered", () => {
    const { sut, admin, peasant, wife } = realm();
    fire(sut, "status.nominate", admin, { targetId: peasant.id, title: "cavaleiro", via: "coroa" });
    assert.equal(sut.social[PEASANT], "minor");
    fire(sut, "status.nominate", admin, { targetId: peasant.id, title: "lorde", via: "coroa" });
    assert.equal(sut.social[PEASANT], "nobilis", "a lord is a noble");
    assert.equal(sut.social[WIFE], "nobilis", "and so is the spouse");
    fire(sut, "status.nominate", admin, { targetId: wife.id, title: "escudeiro", via: "coroa" });
    assert.equal(sut.social[WIFE], "nobilis", "a squire's title lowers nobody");
});

test("a noble's adopted children and bastards are of the lesser nobility, the legitimate line takes the noble's own standing", () => {
    const { sut } = realm({ social: { [LORD]: "nobilis" }, heirs: { [LORD]: [SON] } });
    sut.baseHeirs[LORD] = [WIFE];
    const risen = Array.from(sut.api.spreadStanding(LORD));
    assert.deepEqual(risen.sort(), [SON, WIFE].sort());
    assert.equal(sut.social[SON], "nobilis");
    assert.equal(sut.social[WIFE], "minor", "the bastard (here, whoever is in the base line) is a lesser noble");
    assert.deepEqual(Array.from(sut.api.spreadStanding(PEASANT)), [], "a commoner gives nobody anything");
});

test("joining a noble's family raises the newcomer: the link accepted is heard from the family section", () => {
    const { sut } = realm({ social: { [LORD]: "nobilis" }, heirs: { [LORD]: [PEASANT] } });
    assert.equal(sut.statusApi.familyLinked.length, 1);
    sut.statusApi.familyLinked[0](LORD, PEASANT);
    assert.equal(sut.social[PEASANT], "nobilis");
    assert.ok(sut.notices.some((entry) => entry.to === PEASANT && /entrou numa família nobre e agora é nobre/.test(entry.text)));
    assert.ok(sut.logs.some((line) => /entrou numa família nobre e agora é nobre/.test(line)));
});

test("an office names nobody to nobility: a burgrave is a post, and a commoner holding one stays a commoner", () => {
    const { sut, lord, peasant } = realm();
    fire(sut, "status.nominate", lord, { targetId: peasant.id, title: "burgrave" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), ["burgrave"]);
    assert.equal(sut.social[PEASANT] ?? "plebeius", "plebeius");
    assert.deepEqual(sut.setStatus, []);
    assert.match(sut.notices.find((entry) => entry.to === PEASANT).text, /nomeou você Burgrave\. Em Opções/);
    assert.ok(!/Você agora é nobre/.test(sut.notices.find((entry) => entry.to === PEASANT).text));
});

test("what a noble may not do is refused in words: no power, a title above theirs, a stranger, themselves, a commoner who asks", () => {
    const { sut, lord, knight, peasant, stranger } = realm();
    const say = (actor) => sut.notices.filter((entry) => entry.to === actor.steamId).at(-1).text;

    fire(sut, "status.nominate", knight, { targetId: lord.id, title: "escudeiro" });
    assert.match(say(knight), /ainda não recebeu um título de nomeação/);
    fire(sut, "status.nominate", lord, { targetId: knight.id, title: "lorde" });
    assert.match(say(lord), /só se nomeia para um título abaixo do seu/);
    fire(sut, "status.nominate", lord, { targetId: stranger.id, title: "cavaleiro" });
    assert.match(say(lord), /quem já se apresentou a você/);
    fire(sut, "status.nominate", lord, { targetId: lord.id, title: "cavaleiro" });
    assert.match(say(lord), /apresentou|ninguém se nomeia/i);
    fire(sut, "status.nominate", peasant, { targetId: knight.id, title: "escudeiro" });
    assert.match(say(peasant), /Só um nobre pode nomear/);
    fire(sut, "status.nominate", lord, { targetId: 99999, title: "cavaleiro" });
    assert.match(say(lord), /não está mais no servidor/);
    fire(sut, "status.nominate", lord, { targetId: knight.id, title: 7 });
    assert.match(say(lord), /Escolha um título/);
    fire(sut, "status.nominate", lord, "not json at all");
    assert.deepEqual(Array.from(sut.titles.titlesOf(STRANGER)), []);
    assert.deepEqual(Array.from(sut.titles.titlesOf(LORD)), ["lorde"], "nothing changed for anybody");
});

test("the administrator names anyone to anything as the Crown, and the Rei is only ever one", () => {
    const { sut, admin, lord, knight } = realm();
    fire(sut, "status.nominate", admin, { targetId: lord.id, title: "rei", via: "coroa" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(LORD)), ["rei"], "the lord's own rank is replaced");
    assert.equal(sut.titles.grantsOf(LORD)[0].by, "admin");
    assert.equal(sut.titles.grantsOf(LORD)[0].byName, "a Coroa");
    assert.deepEqual(sut.rosterSent, [ADMIN], "the administrator's players page is drawn again");

    fire(sut, "status.nominate", admin, { targetId: knight.id, title: "rei", via: "coroa" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(LORD)), [], "the crown passed on");
    assert.deepEqual(Array.from(sut.titles.titlesOf(KNIGHT)), ["rei"]);
    assert.match(sut.notices.filter((entry) => entry.to === LORD).at(-1).text, /Você deixou de ser Rei: o título passou a Ivan/);
    assert.match(sut.notices.filter((entry) => entry.to === ADMIN).at(-1).text, /Ivan agora é Rei\..*Radovan( Capon)? deixou de ser Rei/);

    fire(sut, "status.nominate", admin, { targetId: admin.id, title: "arcebispo", via: "coroa" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(ADMIN)), ["arcebispo"], "even themselves");
    assert.equal(sut.social[ADMIN], "nobilis", "the high Church is noble by its office");
});

test("a title is written in the form of the one who holds it", () => {
    const { sut, admin, wife } = realm();
    fire(sut, "status.nominate", admin, { targetId: wife.id, title: "cavaleiro", via: "coroa" });
    assert.match(sut.notices.find((entry) => entry.to === WIFE).text, /nomeou você Cavaleira/);
    assert.match(sut.notices.find((entry) => entry.to === ADMIN).text, /Dorota agora é Cavaleira/);
});

test("a title is taken away by its holder, by whoever named it, by a rank above it and by the administrator, and by nobody else", () => {
    const { sut, admin, lord, knight, peasant } = realm();
    sut.give(PEASANT, "Kath", "burgrave");
    const say = (actor) => sut.notices.filter((entry) => entry.to === actor.steamId).at(-1).text;

    fire(sut, "status.revokeTitle", knight, { targetId: peasant.id, title: "burgrave" });
    assert.match(say(knight), /Só quem pode nomear/);
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), ["burgrave"]);

    fire(sut, "status.revokeTitle", peasant, { self: 1, title: "burgrave" });
    assert.match(say(peasant), /Você deixou o título de Burgrave/);
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), [], "giving a title up needs nobody's leave");

    fire(sut, "status.nominate", lord, { targetId: peasant.id, title: "escudeiro" });
    fire(sut, "status.revokeTitle", lord, { targetId: peasant.id, title: "escudeiro" });
    assert.match(say(lord), /Kath não é mais Escudeiro/);
    assert.match(say(peasant), /O título de Escudeiro foi retirado de você/);

    sut.give(KNIGHT, "Ivan", "burgrave");
    fire(sut, "status.revokeTitle", admin, { targetId: knight.id, title: "burgrave" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(KNIGHT)), ["escudeiro"]);
    fire(sut, "status.revokeTitle", lord, { targetId: knight.id, title: "cavaleiro" });
    assert.match(say(lord), /não tem esse título/);
});

test("a holder who is away is named by the page's key, which is no Steam id, and a stale one names nobody", () => {
    const { sut, lord, peasant } = realm();
    fire(sut, "status.nominate", lord, { targetId: peasant.id, title: "escudeiro" });
    const named = sut.api.nobilityFor(lord).named;
    assert.equal(named.length, 1);
    assert.equal(named[0].name, "Kath");
    assert.equal(named[0].title, "escudeiro");
    assert.ok(!JSON.stringify(named).includes(PEASANT), "the key is not the Steam id");
    assert.match(named[0].key, /^h[0-9a-f]{1,8}$/);

    sut.players.splice(sut.players.indexOf(peasant), 1); // the holder leaves the server
    fire(sut, "status.revokeTitle", lord, { key: "h0", title: "escudeiro" });
    assert.match(sut.notices.filter((entry) => entry.to === LORD).at(-1).text, /não tem esse título/);
    fire(sut, "status.revokeTitle", lord, { key: named[0].key, title: "escudeiro" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), []);
});

test("a title is worn over the head only when its holder chooses, and only one they hold", () => {
    const { sut, knight, lord } = realm();
    fire(sut, "status.shownTitle", lord, { title: "lorde" });
    assert.deepEqual(plain(lord.calls), [["text", "Lorde"], ["visible", true]], "put on");
    assert.equal(sut.titles.shownOf(LORD), "lorde");
    assert.equal(sut.api.nobilityFor(lord).shown, "lorde");
    assert.match(sut.notices.filter((entry) => entry.to === LORD).at(-1).text, /Lorde aparece sobre a sua cabeça/);

    fire(sut, "status.shownTitle", lord, { title: "rei" });
    assert.match(sut.notices.filter((entry) => entry.to === LORD).at(-1).text, /Você não tem esse título/);
    assert.equal(sut.titles.shownOf(LORD), "lorde", "a refusal changes nothing");

    fire(sut, "status.shownTitle", lord, { title: "" });
    assert.equal(sut.titles.shownOf(LORD), null);
    assert.match(sut.notices.filter((entry) => entry.to === LORD).at(-1).text, /Nenhum título sobre a sua cabeça/);
    assert.deepEqual(plain(lord.calls).slice(-2), [["visible", false], ["text", ""]], "taken off");
    fire(sut, "status.shownTitle", knight, { title: "lorde" });
    assert.equal(sut.titles.shownOf(KNIGHT), null);
});

test("a noble set back to commoner loses the titles of the blood and of the Church and keeps the posts", () => {
    const { sut } = realm();
    sut.give(LORD, "Radovan", "burgrave", "bispo");
    sut.titles.setShown(LORD, "lorde");

    sut.setSocial(LORD, "plebeius"); // the status module tells its listeners, as the real one does
    assert.deepEqual(Array.from(sut.titles.titlesOf(LORD)), ["burgrave"]);
    assert.equal(sut.titles.shownOf(LORD), null, "what is gone is no longer worn");
    assert.match(sut.notices.find((entry) => entry.to === LORD).text, /Você deixou de ser nobre: Lorde · Bispo foram retirados\. Os cargos continuam/);
});

test("being raised to noble takes nothing away, and a commoner's offices are left alone when they stay a commoner", () => {
    const { sut } = realm();
    sut.give(PEASANT, "Kath", "burgrave");
    sut.setSocial(PEASANT, "nobilis");
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), ["burgrave"]);
    sut.setSocial(PEASANT, "plebeius");
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), ["burgrave"], "a post is no noble's by nature");
    assert.deepEqual(sut.notices.filter((entry) => entry.to === PEASANT), [], "and nobody is told of what did not change");
});

test("the hierarchy lists every title of the five branches with its holders, and of each holder only what a character is known by", () => {
    const { sut, knight, lord } = realm();
    sut.give(KNIGHT, "Ivan", "burgrave");
    sut.titles.addTitle(PEASANT, "Kath", "burgomestre", { steamId: LORD, name: "Radovan Capon" });
    fire(sut, "status.hierarchy", knight);
    const answer = knight.emitted.at(-1).payload;

    assert.deepEqual(plain(answer.branches.map((branch) => branch.id)), ["crown", "great", "lesser", "church", "town"]);
    const lordship = answer.branches.find((branch) => branch.id === "great").titles.find((title) => title.id === "lorde");
    assert.equal(lordship.holders.length, 1, "the lord holds the lordship");
    assert.equal(answer.branches.find((branch) => branch.id === "crown").titles[0].holders.length, 0, "a vacant title is shown vacant");

    const holder = answer.holders.find((entry) => entry.name === "Radovan Capon");
    assert.ok(holder);
    // The town is what a character is known by too (2026-10-18: the citizenship shown when a noble is picked).
    assert.deepEqual(plain(Object.keys(holder).sort()), ["consorts", "factionId", "guildId", "key", "lands", "marital", "name", "self", "status", "statusId", "surname", "titles", "town", "townId"]);
    assert.deepEqual(plain(holder.lands), [{ region: "Suchdol", houses: 3, chests: 5, whole: false }, { region: "Wysoka", houses: 0, chests: 0, whole: true }]);
    assert.equal(holder.statusId, "nobilis");
    assert.equal(holder.marital.gloss, "casado");
    assert.equal(holder.factionId, "leao-dourado");
    assert.equal(holder.surname, "Capon");
    assert.deepEqual(plain(holder.titles.map((title) => [title.id, title.crown])), [["lorde", true]]);
    assert.equal(holder.self, false);
    assert.equal(answer.holders.find((entry) => entry.name === "Ivan").self, true, "the viewer's own row is marked");

    const keys = keysOf(answer);
    for (const secret of ["steamId", "position", "health", "hunger", "energy", "stamina", "supporter", "role", "online", "ready", "alive", "inventory", "nickname"]) {
        assert.ok(!keys.has(secret), `the hierarchy must not carry '${secret}'`);
    }
    const text = JSON.stringify(answer);
    for (const steamId of [ADMIN, LORD, KNIGHT, PEASANT, WIFE, SON, STRANGER]) {
        assert.ok(!text.includes(steamId), "no Steam id anywhere");
    }
    assert.ok(lord);
});

test("the hierarchy is built once for the panels that ask within five seconds, and a nomination made here starts it over (2026-10-25)", () => {
    const { sut, knight, lord } = realm();
    const holdersSeen = () => knight.emitted.at(-1).payload.holders.map((entry) => entry.name);
    fire(sut, "status.hierarchy", knight);
    const first = holdersSeen();
    // A title given behind the module's back is not in the next answer yet: it is the same tree, a moment old.
    sut.titles.addTitle("76561198000000200", "Viajante", "burgomestre", { steamId: LORD, name: "Radovan Capon" });
    fire(sut, "status.hierarchy", knight);
    assert.deepEqual(holdersSeen(), first, "answered from what was built a moment ago");
    // A nomination through the section starts it over.
    fire(sut, "status.nominate", lord, { targetId: 99999, title: "cavaleiro" });
    fire(sut, "status.hierarchy", knight);
    assert.ok(holdersSeen().includes("Viajante"), "and the next answer is built again");
});

test("a holder is listed by name and family surname even while away, and who named them is told", () => {
    const { sut, knight } = realm();
    sut.titles.addTitle("76561198000000200", "Viajante", "burgomestre", { steamId: LORD, name: "Radovan Capon" });
    fire(sut, "status.hierarchy", knight);
    const away = knight.emitted.at(-1).payload.holders.find((entry) => entry.name === "Viajante");
    assert.ok(away, "a holder who is offline is still in the realm");
    assert.equal(away.titles[0].by, "Radovan Capon");
    assert.equal(away.titles[0].crown, false);
    assert.ok(away.titles[0].at === "" || /^\d\d\/\d\d\/\d{4}$/.test(away.titles[0].at));
});

test("the payload contributor adds the block to every panel, and a spawning holder's name is kept", () => {
    const { sut, lord, peasant } = realm();
    assert.equal(sut.payloadContributors.length, 1);
    assert.equal(sut.payloadContributors[0](peasant).nobility.visible, false);
    assert.equal(sut.payloadContributors[0](lord).nobility.visible, true);

    lord.nickname = "Radovan Novo";
    sut.handlers.get("playerSpawned")(lord);
    assert.equal(Array.from(sut.titles.holders()).find((holder) => holder.steamId === LORD).name, "Radovan Novo");
    assert.ok(sut.logs.some((line) => /nominations: \d+ título\(s\) no catálogo, em 5 ramos/.test(line)));
});

test("the lists carry the labels the page draws: a holder's title in their own form, and what each of mine is", () => {
    const { sut, lord, peasant, wife } = realm();
    fire(sut, "status.nominate", lord, { targetId: wife.id, title: "escudeiro" });
    fire(sut, "status.nominate", lord, { targetId: peasant.id, title: "cavaleiro" });

    const block = sut.api.nobilityFor(lord);
    const byName = Object.fromEntries(plain(block.named).map((line) => [line.name, line]));
    assert.equal(byName.Dorota.label, "Escudeira", "a woman is called by the woman's form");
    assert.equal(byName.Kath.label, "Cavaleiro");
    assert.equal(byName.Kath.kind, "blood");
    assert.equal(byName.Kath.branch, "lesser");
    assert.match(byName.Kath.at, /^\d{2}\/\d{2}\/\d{4}$/);

    const mine = plain(block.mine)[0];
    assert.equal(mine.label, "Lorde");
    assert.equal(mine.native, "pán");
    assert.match(mine.gloss, /Alta nobreza/);
});

test("the list of whom to name is the roster's \"nom\" source: a noble's acquaintances as they are now, nobody for a commoner", () => {
    const knowing = { [LORD]: [KNIGHT] };
    const sut = load({ social: { [LORD]: "nobilis" }, knowing });
    sut.makePlayer(ADMIN, "Mauro");
    const lord = sut.makePlayer(LORD, "Radovan");
    sut.makePlayer(KNIGHT, "Ivan");
    sut.makePlayer(STRANGER, "Hans");
    const peasant = sut.makePlayer(PEASANT, "Kath");
    sut.give(LORD, "Radovan", "lorde");

    assert.equal(sut.nomineeSources.length, 1);
    const nominees = (player) => plain(sut.nomineeSources[0](player));
    assert.deepEqual(nominees(lord).map((candidate) => candidate.name), ["Ivan"]);
    assert.deepEqual(nominees(peasant), [], "nobody for a commoner");

    knowing[LORD].push(STRANGER); // Hans introduces himself while the page is open
    assert.deepEqual(nominees(lord).map((candidate) => candidate.name).sort(), ["Hans", "Ivan"], "the next ask has him");
});

test("a holder of a title of nobility found a commoner at start is made noble, alone; offices change nothing", () => {
    const sut = load({ social: { [LORD]: "plebeius", [PEASANT]: "plebeius" }, heirs: { [LORD]: [WIFE] } });
    sut.give(LORD, "Radovan", "marques");
    sut.give(PEASANT, "Kath", "burgrave");
    const risen = Array.from(sut.api.settleStanding());
    assert.deepEqual(risen, ["Radovan"]);
    assert.equal(sut.social[LORD], "nobilis");
    assert.equal(sut.social[WIFE] ?? "plebeius", "plebeius", "the family rises with a nomination, not with this");
    assert.equal(sut.social[PEASANT] ?? "plebeius", "plebeius", "a post makes nobody noble");
    assert.deepEqual(Array.from(sut.api.settleStanding()), [], "and once is enough");
});

test("the hierarchy links each title to whoever named it, by the page's key, and to nobody for the Crown", () => {
    const { sut, lord, peasant } = realm();
    fire(sut, "status.nominate", lord, { targetId: peasant.id, title: "cavaleiro" });
    const tree = sut.api.hierarchyFor();
    const holders = plain(tree.holders);
    const radovan = holders.find((holder) => holder.name.startsWith("Radovan"));
    const kath = holders.find((holder) => holder.name === "Kath");
    assert.equal(radovan.titles[0].byKey, "", "named by the Crown");
    assert.equal(kath.titles[0].byKey, radovan.key, "named by Radovan: under him in the tree");
    assert.ok(!JSON.stringify(holders).includes(LORD), "a key, never a Steam id");
});


test("the realm's ladder is the same in every branch: a captain of the guard stands below a lord, a bishop beside him, the King above all", () => {
    const sut = load();
    const level = (id) => sut.nobility.levelOf(sut.nobility.titleById(id));
    assert.equal(level("rei"), 1);
    assert.deepEqual(["principe", "marques", "arcebispo"].map(level), [2, 2, 2]);
    assert.deepEqual(["lorde", "bispo", "burgomestre"].map(level), [3, 3, 3]);
    assert.deepEqual(["cavaleiro", "escudeiro", "burgrave", "padre", "conselheiro"].map(level), [4, 4, 4, 4, 4]);
    assert.deepEqual(["capitao-guarda", "capitao-milicia", "escrivao"].map(level), [5, 5, 5]);
    assert.ok(level("capitao-guarda") > level("lorde"), "the user's example: Luance is not in a lord's row");
    assert.equal(level("guarda-portoes"), 6, "2026-10-19: a guard is below the captains");
    assert.ok(level("guarda-portoes") > level("capitao-milicia") && level("guarda-portoes") > level("capitao-guarda"));
    for (const title of sut.nobility.TITLES) {
        const own = sut.nobility.levelOf(title);
        assert.ok(Number.isInteger(own) && own >= 1 && own <= 6, `${title.id} is on the ladder`);
        for (const chief of title.reportsTo ?? []) {
            assert.ok(sut.nobility.titleById(chief), `${title.id} serves under a title that exists`);
            assert.ok(sut.nobility.levelOf(sut.nobility.titleById(chief)) < own, `${title.id} serves under somebody above it`);
        }
    }
});

test("the hierarchy tells each title's level, so the page can draw the rows", () => {
    const { sut, lord } = realm();
    const tree = sut.api.hierarchyFor();
    const holder = tree.holders.find((one) => one.titles.some((title) => title.id === "lorde"));
    assert.equal(holder.titles.find((title) => title.id === "lorde").level, 3);
    assert.deepEqual(Array.from(holder.titles.find((title) => title.id === "lorde").reportsTo), [], "and whom it serves under, for the tree");
    assert.ok(lord);
});

test("from the Nomeação section an administrator names as their character, by its titles; from the Jogadores page, as the Crown", () => {
    const { sut, admin, peasant } = realm();
    sut.give(ADMIN, "Mauro", "lorde");
    sut.setSocial(ADMIN, "nobilis");
    fire(sut, "status.nominate", admin, { targetId: peasant.id, title: "cavaleiro" });
    const grant = sut.titles.grantsOf(PEASANT)[0];
    assert.equal(grant.id, "cavaleiro");
    assert.equal(grant.by, ADMIN, "in their character's name, so the tree hangs the knight under them");
    assert.notEqual(grant.byName, "a Coroa");

    fire(sut, "status.nominate", admin, { targetId: peasant.id, title: "rei" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(PEASANT)), ["cavaleiro"], "a lord makes no king");
    assert.match(sut.notices.filter((entry) => entry.to === ADMIN).at(-1).text, /seção Jogadores/);

    fire(sut, "status.nominate", admin, { targetId: peasant.id, title: "rei", via: "coroa" });
    assert.equal(sut.titles.grantsOf(PEASANT).find((one) => one.id === "rei").by, "admin", "the Crown names anybody to anything");
});

test("a holder's spouse stands in the holder's own record, as the realm calls them: a lord's wife is a Lady (2026-10-25)", () => {
    const lady = { label: "Lady", name: "Elisabeth of England", courtesy: true, text: "Lady Elisabeth of England" };
    const wife = { label: "Esposa", name: "Kath", courtesy: false, text: "Kath (esposa)" };
    const { sut, knight } = realm({ consorts: { [LORD]: [lady], [KNIGHT]: [wife, wife, wife] } });
    fire(sut, "status.hierarchy", knight);
    const answer = knight.emitted.at(-1).payload;
    const of = (name) => answer.holders.find((entry) => entry.name === name);
    assert.deepEqual(plain(of("Radovan Capon").consorts), [lady], "the lord's lady");
    assert.equal(of("Ivan").consorts.length, 2, "no more than two are drawn beside one holder");
    const text = JSON.stringify(answer);
    for (const steamId of [ADMIN, LORD, KNIGHT, PEASANT, WIFE, SON, STRANGER]) assert.ok(!text.includes(steamId), "the spouse's name is told, never a Steam id");
});

test("a commoner who holds a title reads the hierarchy, a soldier or a clerk; naming and revoking stay with the nobles", () => {
    const { sut, peasant, knight } = realm();
    assert.equal(sut.api.canView(peasant), false, "no title, no tree");
    sut.give(PEASANT, "Kath", "soldado");
    assert.equal(sut.api.canUse(peasant), false);
    assert.equal(sut.api.canView(peasant), true);
    assert.equal(sut.api.canView(knight), true);
    const block = plain(sut.api.nobilityFor(peasant));
    assert.equal(block.visible, true);
    assert.equal(block.power, false, "a soldier names nobody");
    assert.deepEqual(block.options, []);
    fire(sut, "status.hierarchy", peasant);
    assert.equal(peasant.emitted.at(-1).event, "kcdc-gamemode:status.hierarchy");

    const before = Array.from(sut.titles.titlesOf(KNIGHT));
    fire(sut, "status.nominate", peasant, { targetId: knight.id, title: "escudeiro" });
    fire(sut, "status.revokeTitle", peasant, { key: "h1", title: "escudeiro" });
    assert.deepEqual(Array.from(sut.titles.titlesOf(KNIGHT)), before, "a soldier may look at the tree, not change it");
});

test("the hierarchy tells the land of each holder by its id as well as by its name, so the tree can be read region by region", () => {
    const { sut, knight } = realm({ towns: { [LORD]: "Suchdol", [KNIGHT]: "Wysoka" } });
    fire(sut, "status.hierarchy", knight);
    const answer = knight.emitted.at(-1).payload;
    const lord = answer.holders.find((one) => one.name === "Radovan Capon");
    assert.equal(lord.town, "Suchdol");
    assert.equal(lord.townId, "suchdol");
    assert.equal(answer.holders.find((one) => one.name === "Ivan").townId, "wysoka");
    const homeless = realm().sut.api.hierarchyFor().holders.find((one) => one.name === "Ivan");
    assert.equal(homeless.town, null);
    assert.equal(homeless.townId, null, "no citizenship, no land");
});

test("the tradesmen hang in the tree: everybody with a guild who holds no title, under the one who handed it, set in their land; a holder is not drawn twice", () => {
    const hunter = "76561198000000200";
    const cook = "76561198000000201";
    const named = [
        { steamId: hunter, guild: "venatores", town: "wysoka", by: KNIGHT },
        { steamId: cook, guild: "tabernarii", town: null, by: "" },
        { steamId: LORD, guild: "fabri-ferrarii", town: "suchdol", by: "" },
    ];
    const { sut, knight } = realm({ trades: named, towns: { [hunter]: "Wysoka" }, memberNames: { [hunter]: "Hans Lovec", [cook]: "Anežka" } });
    fire(sut, "status.hierarchy", knight);
    const answer = knight.emitted.at(-1).payload;
    assert.equal(answer.trades.length, 2, "the lord holds a title already: he stands in the tree as a holder, with his guild on his card");
    const byName = (name) => answer.trades.find((one) => one.name === name);
    const lovec = byName("Hans Lovec");
    assert.equal(lovec.guildId, "venatores");
    assert.equal(lovec.townId, "wysoka");
    assert.equal(lovec.town, "Wysoka");
    const knightRow = answer.holders.find((one) => one.name === "Ivan");
    assert.equal(lovec.byKey, knightRow.key, "hung from the one who handed it");
    assert.equal(lovec.self, false);
    const anezka = byName("Anežka");
    assert.equal(anezka.byKey, "", "a guild from an administrator or from before hangs from nobody");
    assert.equal(anezka.townId, null);
    assert.equal(anezka.town, null);
    const text = JSON.stringify(answer);
    for (const steamId of [hunter, cook, ADMIN, LORD, KNIGHT, PEASANT]) assert.ok(!text.includes(steamId), "no Steam id goes in the tree");
    assert.deepEqual(Array.from(new Set(Object.keys(lovec))).sort(), ["byKey", "guildId", "key", "name", "self", "town", "townId"]);
});

test("the own card of a tradesman who reads the tree is marked, and nobody else's", () => {
    const hunter = "76561198000000200";
    const { sut } = realm({ social: { [hunter]: "nobilis" }, trades: [{ steamId: hunter, guild: "venatores", town: null, by: "" }], memberNames: { [hunter]: "Hans Lovec" } });
    const me = sut.makePlayer(hunter, "Hans");
    fire(sut, "status.hierarchy", me);
    const answer = me.emitted.at(-1).payload;
    assert.equal(answer.trades.length, 1, "a noble with no title, but with a guild, is a tradesman card of the tree");
    assert.equal(answer.trades[0].self, true);
    assert.equal(sut.api.hierarchyFor().trades[0].self, false, "the tree kept for the others carries no mark");
});
