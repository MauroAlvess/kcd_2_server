"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function module_(name, requires, globals = {}) {
    const sandbox = { exports: {}, require: (id) => requires[id] ?? assert.fail(`${name}: unexpected require ${id}`), console: { log() {} }, ...globals };
    vm.runInNewContext(dist(name), sandbox);
    return sandbox.exports;
}

const panelData = module_("lang-en-panel.js", {});
const messageData = module_("lang-en-messages.js", {});

function load({ saved = null } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/language.json", saved);
    const writes = [];
    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? (files.get(file) === "corrupt" ? { status: "corrupt", reason: "bad" } : { status: "ok", value: JSON.parse(files.get(file)) }) : { status: "missing" }),
        write: (file, body) => { writes.push(plain(body)); files.set(file, JSON.stringify(body)); },
    };
    const sent = [];
    const original = (player, text, options) => sent.push({ to: player.id, text, options });
    const Chat = { sendToPlayer: original };
    const api = module_("language.js", { "./store.js": store, "./lang-en-panel.js": panelData, "./lang-en-messages.js": messageData }, { Chat });
    return { api, files, writes, sent, Chat, original };
}

const body = (id, steamId) => ({ id, steamId });

test("a text the dictionary knows is said in English, a sentence with a name in it too, and what it does not know is left as it is", () => {
    const { api } = load();
    assert.equal(api.translate("Fechar", "en"), "Close");
    assert.equal(api.translate("Fechar", "pt"), "Fechar", "Portuguese is never touched");
    assert.equal(api.translate("Apoiador desde 14/10/2026 · obrigado!", "en"), "Supporter since 14/10/2026 · thank you!");
    assert.equal(api.translate("Hans (você)", "en"), "Hans (you)");
    assert.equal(api.translate("Isto não está no dicionário.", "en"), "Isto não está no dicionário.");
    assert.equal(api.translate("", "en"), "");
});

test("a line made of parts is translated part by part, and a command's line keeps its name and its dashes", () => {
    const { api } = load();
    assert.equal(api.translate("Jogador · Caçador · vivo", "en"), "Player · Hunter · alive");
    assert.equal(api.translate("Jogador · Desconhecido · vivo", "en"), "Player · Desconhecido · alive");
    assert.equal(api.translate("Desconhecido · Outro", "en"), "Desconhecido · Outro", "nothing known: unchanged");
    assert.equal(api.translate("  /preso -- Fiquei preso: leva você à igreja mais próxima, uma vez a cada 60 minutos.", "en"), "  /preso -- I'm stuck: takes you to the nearest church, once every 60 minutes.");
    assert.equal(api.translate("  /xyz -- nada disto existe", "en"), "  /xyz -- nada disto existe");
});

test("the sentences of the actions say what they caught: names, places and numbers", () => {
    const { api } = load();
    assert.equal(api.translate("Você foi levado para a igreja de Suchdol. Só poderá usar isto de novo daqui a 60 minutos.", "en"), "You were taken to the church of Suchdol. You can use this again in 60 minutes.");
    assert.equal(api.translate("Fiquei preso só pode ser usado uma vez a cada 60 minutos. Disponível de novo em 43 minutos.", "en"), "I'm stuck can only be used once every 60 minutes. Available again in 43 minutes.");
    assert.equal(api.translate("Hans entregou a você uma chave de uma porta. Fique perto da porta ou do baú e digite /chave para usá-la.", "en"), "Hans handed you a key to one door. Stay near the door or the chest and type /chave to use it.");
    assert.equal(api.translate("Você já faz parte de Venatores.", "en"), "You are already part of Venatores.");
    assert.equal(api.translate("1 minuto", "en"), "1 minute");
    assert.equal(api.translate("43 minutos", "en"), "43 minutes");
});

test("the doors and chests of the properties speak English too, with the part's name translated", () => {
    const { api } = load();
    assert.equal(api.translate("Casa 03: trancada.", "en"), "House 03: locked.");
    assert.equal(api.translate("Casa 03 · Baú 1: destrancado.", "en"), "House 03 · Chest 1: unlocked.");
    assert.equal(api.translate("Casa 03 · Porta 2 está trancada: aperte F para destrancar.", "en"), "House 03 · Door 2 is locked: press F to unlock.");
    assert.equal(api.translate("Casa 03 está trancada.", "en"), "House 03 is locked.");
    assert.equal(api.translate("Você abriu Casa 03 por dentro.", "en"), "You opened House 03 from inside.");
    assert.equal(api.translate("Alguém está tentando arrombar Casa 03 · Baú 1.", "en"), "Somebody is trying to pick the lock of House 03 · Chest 1.");
    assert.equal(api.translate("Alguém arrombou Casa 03!", "en"), "Somebody picked the lock of House 03!");
    assert.equal(api.translate("Essa carroça está trancada: só o dono sobe nela.", "en"), "That cart is locked: only its owner gets on.", "the old lines keep theirs");
});

test("the coachmen speak English too", () => {
    const { api } = load();
    assert.equal(api.translate("Você paga 18 moedas ao cocheiro e sobe na carroça para Raborsch.", "en"), "You pay 18 coins to the coachman and climb on the wagon to Raborsch.");
    assert.equal(api.translate("Você chegou a Malešov.", "en"), "You arrived at Malešov.");
    assert.equal(api.translate("A viagem até Kuttenberg custa 56 moedas e você não tem o bastante.", "en"), "The trip to Kuttenberg costs 56 coins and you do not have enough.");
    assert.equal(api.translate("O cocheiro de Suchdol foi dormir: as viagens voltam de manhã.", "en"), "The coachman of Suchdol went to bed: the trips start again in the morning.");
    assert.equal(api.translate("Não dá para viajar no meio de uma briga.", "en"), "You cannot travel in the middle of a fight.");
});

test("the tamers' hint and the farmers' hint (2026-10-25): the taming went to the Domitores, and the farmers' hint is the gardens' alone", () => {
    const { api } = load();
    const en = (text) => api.translate(text, "en");
    assert.equal(
        en("Para domar: ande devagar até um cavalo selvagem dos campos abertos, olhe para ele e aperte E; ofereça comida (cenoura, maçã, pera, beterraba, nabo ou pão) até ele confiar em você. O cavalo foge de quem corre."),
        "To tame: walk slowly up to a wild horse in the open fields, look at it and press E; offer food (carrot, apple, pear, beet, turnip or bread) until it trusts you. A horse runs from anybody who runs.",
    );
    assert.equal(en("os domadores (guilda Domitores)"), "the tamers (the Domitores guild)");
    assert.equal(en("É um cavalo selvagem: só os domadores sabem amansá-lo."), "It is a wild horse: only the tamers know how to tame it.");
});

test("the gardens, the wild horses and the horses that follow speak English too, with the crop, the garden and the horse translated inside the sentence", () => {
    const { api } = load();
    const en = (text) => api.translate(text, "en");
    assert.equal(en("Só os agricultores (guilda Agricolae) usam as hortas. Escolha a guilda no painel (F2), em Guildas."), "Only the farmers (the Agricolae guild) use the gardens. Pick the guild in the panel (F2), under Guilds.");
    assert.equal(en("Só os domadores (guilda Domitores) usam a doma dos cavalos selvagens. Escolha a guilda no painel (F2), em Guildas."), "Only the tamers (the Domitores guild) can tame wild horses. Pick the guild in the panel (F2), under Guilds.");
    assert.equal(en("Só os artesãos (guilda Artifices) usam a costura. Escolha a guilda no painel (F2), em Guildas."), "Only the tailors (the Artifices guild) use the sewing. Pick the guild in the panel (F2), under Guilds.", "the guilds that had no English before");
    assert.equal(en("Plantado: cebola na Horta de Suchdol 2. Volte para colher em 30 min."), "Planted: onion in Garden of Suchdol 2. Come back to pick in 30 min.");
    assert.equal(en("Colheita: 5x Cebola e 2 sementes para semear de novo (+4 XP)."), "Harvest: 5x Onion and 2 seeds to sow again (+4 XP).");
    assert.equal(en("Colheita: 3x Cravo-de-defunto e 1 semente para semear de novo (+9 XP)."), "Harvest: 3x Marigold and 1 seed to sow again (+9 XP).");
    assert.equal(en("Repolho: faltam 12 min para colher."), "Cabbage: 12 min to go before it can be picked.");
    assert.equal(en("Alho-poró: falta 1 min para colher."), "Leek: 1 min to go before it can be picked.");
    assert.equal(en("A sua plantação de nabo na Horta de Raborsch 1 está pronta para colher."), "Your turnip in Garden of Raborsch 1 is ready to pick.");
    assert.equal(en("A sua plantação de papoula na Horta de Wysoka 3 passou do ponto e se perdeu."), "Your poppy in Garden of Wysoka 3 went past its time and was lost.");
    assert.equal(en("É preciso nível 12 de sobrevivência para plantar raiz-forte."), "You need survival level 12 to plant horseradish.");
    assert.equal(en("Você já cuida de 4 canteiros: colha um deles antes de semear outro."), "You already tend 4 beds: pick one of them before sowing another.");
    assert.equal(en("Falta: 1x Sementes de cenoura (tem 0)."), "Missing: 1x Carrot seeds (you have 0).");
    assert.equal(en("Nada foi plantado. Fique junto do canteiro para plantar."), "Nothing was planted. Stay beside the bed to plant.");
    assert.equal(en("Hortas: 67 com 118 canteiros nas aldeias; 3 semeado(s) agora. Cada agricultor cuida de 4 canteiros, mais 1 a cada 5 níveis de sobrevivência; uma colheita esquecida se perde 48 h depois de pronta."), "Gardens: 67 with 118 beds in the villages; 3 sown now. Each farmer tends 4 beds, plus 1 for every 5 levels of survival; a forgotten harvest is lost 48 h after it is ripe.");
    assert.equal(en("Cebola na Horta de Suchdol 2: pronta para colher."), "Onion in Garden of Suchdol 2: ready to pick.");
    assert.equal(en("Calêndula na Horta de Suchdol 2: colheita em 1 h 05 min."), "Calendula in Garden of Suchdol 2: harvest in 1 h 05 min.");
    assert.equal(en("Horta de Suchdol 2: 120 m a nordeste, 2 de 3 canteiro(s) livre(s)."), "Garden of Suchdol 2: 120 m to the northeast, 2 of 3 beds free.");
    assert.equal(en("Você não tem nada plantado."), "You have nothing planted.");
    assert.equal(en("Cebola na Horta marcada 2: pronta para colher."), "Onion in Marked garden 2: ready to pick.");
    assert.equal(en("/horta tirar  -- (admin) tira o canteiro marcado mais perto (até 4 m), com o que nele estiver plantado"), "/horta tirar  -- (admin) takes away the nearest marked bed (within 4 m), with what is sown in it");
    assert.equal(en("/horta perto  -- as cinco hortas mais perto de você, com quantos canteiros livres"), "/horta perto  -- the five gardens nearest you, with how many beds are free");

    assert.equal(en("O cavalo aceita a cenoura (arisco, confiança 14/100)."), "The horse accepts the carrot (skittish, trust 14/100).");
    assert.equal(en("O cavalo aceita o pão (quase manso, confiança 85/100)."), "The horse accepts the bread (almost tame, trust 85/100).");
    assert.equal(en("O cavalo come a pera da sua mão e encosta o focinho em você: ele confia em você agora. Monte, ou mande-o seguir."), "The horse eats the pear from your hand and rests its muzzle against you: it trusts you now. Mount it, or send it to follow.");
    assert.equal(en("Cavalo selvagem ainda mastiga: espere 40 s."), "Wild horse is still chewing: wait 40 s.");
    assert.equal(en("O cavalo cheira a cenoura, vira a cabeça e recua: ainda não confia o bastante para comer da sua mão."), "The horse sniffs the carrot, turns its head away and backs off: it does not trust you enough yet to eat from your hand.");
    assert.equal(en("O cavalo agora é seu: veja em Animais (F2) para dar um nome. Ele já vem com sela, rédeas e ferraduras simples."), "The horse is yours now: see it in Animals (F2) to give it a name. It already comes with a plain saddle, reins and horseshoes.");
    assert.equal(en("Você não tem o que oferecer: uma cenoura, maçã, pera, beterraba, nabo ou pão na bolsa."), "You have nothing to offer: a carrot, apple, pear, beetroot, turnip or bread in your bag.");
    assert.equal(en("O cavalo agora é seu: veja em Animais (F2) para dar um nome. Ele ainda não tem sela nem arreios."), "The horse is yours now: see it in Animals (F2) to give it a name. It has no saddle or harness yet.");
    assert.equal(en("Carpiado vai seguir você. Em \"Ficar\" ele para; o assobio (X) continua chamando."), "Carpiado will follow you. \"Stay\" stops it; the whistle (X) still calls it.");
    assert.equal(en("O cavalo vai seguir você. Em \"Ficar\" ele para; o assobio (X) continua chamando."), "The horse will follow you. \"Stay\" stops it; the whistle (X) still calls it.", "the horse with no name of its own is translated inside the sentence");
    assert.equal(en("Carpiado ficou para trás, longe demais. Assobie (X) para chamá-lo."), "Carpiado was left behind, too far away. Whistle (X) to call it.");
    assert.equal(en("Carpiado não achou caminho até você e parou. Assobie (X) para chamá-lo."), "Carpiado found no way to you and stopped. Whistle (X) to call it.");
    assert.equal(en("Carpiado fica onde está. O assobio (X) ainda o chama."), "Carpiado stays where it is. The whistle (X) still calls it.");
    assert.equal(en("O cavalo já estava parado."), "The horse was already standing still.");
    assert.equal(en("Só o dono manda no cavalo."), "Only the owner gives the horse orders.");
    assert.equal(en("Carpiado não pode seguir agora."), "Carpiado cannot follow now.");
    assert.equal(en("Para plantar: com a pá e as sementes na bolsa, olhe para o chão de um canteiro de horta, atrás das casas das aldeias, e aperte E; a página à direita diz o que cada planta pede e em quanto tempo dá. Quando ficar pronta, E de novo no canteiro colhe. /horta mostra o que você plantou.").startsWith("To plant: with the shovel and the seeds"), true);
    assert.equal(api.translate("Plantado: cebola na Horta de Suchdol 2. Volte para colher em 30 min.", "pt"), "Plantado: cebola na Horta de Suchdol 2. Volte para colher em 30 min.", "Portuguese is never touched");
});

test("the language of a player is kept by Steam id, read again at the next start, and Portuguese is not written down", () => {
    const first = load();
    const hans = body(1, "76561198000000001");
    assert.equal(first.api.languageOf(hans), "pt", "Portuguese until chosen");
    first.api.setLanguage(hans, "en");
    assert.equal(first.api.languageOf(hans), "en");
    assert.deepEqual(first.writes.at(-1), { "76561198000000001": "en" });
    first.api.setLanguage(hans, "pt");
    assert.deepEqual(first.writes.at(-1), {}, "back to the default: nothing to keep");

    const second = load({ saved: JSON.stringify({ "76561198000000002": "en", "76561198000000003": "klingon" }) });
    second.api.installLanguage();
    assert.equal(second.api.languageOf(body(2, "76561198000000002")), "en");
    assert.equal(second.api.languageOf(body(3, "76561198000000003")), "pt", "a value that is no language is dropped");
});

test("a player with no Steam id keeps the language only while connected, and nothing is written for them", () => {
    const { api, writes } = load();
    const guest = body(7, "");
    api.setLanguage(guest, "en");
    assert.equal(api.languageOf(guest), "en");
    assert.equal(writes.length, 0);
    assert.equal(api.languageOf(body(8, "")), "pt", "another connection is its own");
});

test("a file that cannot be read is left alone: nothing is written over it", () => {
    const { api, writes, files } = load({ saved: "corrupt" });
    api.installLanguage();
    api.setLanguage(body(1, "76561198000000001"), "en");
    assert.equal(writes.length, 0);
    assert.equal(files.get("playerdata/language.json"), "corrupt");
});

test("the chat is put through the translation: an English player is told in English, the others as written, and the options go along", () => {
    const sut = load({ saved: JSON.stringify({ "76561198000000011": "en" }) });
    sut.api.installLanguage();
    assert.notEqual(sut.Chat.sendToPlayer, sut.original, "wrapped");
    sut.Chat.sendToPlayer(body(1, "76561198000000011"), "Esse jogador não está mais no servidor.", { color: 0xff0000ff });
    sut.Chat.sendToPlayer(body(2, "76561198000000012"), "Esse jogador não está mais no servidor.");
    assert.equal(sut.sent[0].text, "That player is no longer on the server.");
    assert.deepEqual(plain(sut.sent[0].options), { color: 0xff0000ff });
    assert.equal(sut.sent[1].text, "Esse jogador não está mais no servidor.");
});

test("what a player says in the chat is never translated: a line with an author goes out as it was typed (2026-10-25, local-chat.ts)", () => {
    const sut = load({ saved: JSON.stringify({ "76561198000000011": "en" }) });
    sut.api.installLanguage();
    // "Esse jogador não está mais no servidor." is a text of the server's, in the dictionary; typed by a player it is theirs.
    sut.Chat.sendToPlayer(body(1, "76561198000000011"), "Esse jogador não está mais no servidor.", { author: "Jan" });
    sut.Chat.sendToPlayer(body(1, "76561198000000011"), "Esse jogador não está mais no servidor.", { author: "" });
    sut.Chat.sendToPlayer(body(1, "76561198000000011"), "Esse jogador não está mais no servidor.");
    assert.equal(sut.sent[0].text, "Esse jogador não está mais no servidor.", "somebody's words");
    assert.deepEqual(plain(sut.sent[0].options), { author: "Jan" });
    assert.equal(sut.sent[1].text, "That player is no longer on the server.", "an empty author is no author");
    assert.equal(sut.sent[2].text, "That player is no longer on the server.", "the server's own lines still are");
});

test("a chat that cannot be wrapped is no reason to fail: the server says so and goes on", () => {
    const logs = [];
    const store = { ensureDir() {}, read: () => ({ status: "missing" }), write() {} };
    const Chat = Object.freeze({ sendToPlayer() {} });
    const sandbox = { exports: {}, require: (id) => ({ "./store.js": store, "./lang-en-panel.js": panelData, "./lang-en-messages.js": messageData })[id], console: { log: (line) => logs.push(line) }, Chat };
    vm.runInNewContext(dist("language.js"), sandbox);
    sandbox.exports.installLanguage();
    assert.ok(logs.some((line) => /não aceitou|não consegui traduzir/.test(line)), logs.join("|"));
});

test("the dictionary of the page comes in pieces that stay under the size asked, and put together are all of it", () => {
    const { api } = load();
    const parts = plain(api.dictionaryParts(4000));
    assert.ok(parts.length > 3);
    const sizes = parts.map((part) => JSON.stringify(part).length);
    assert.ok(Math.max(...sizes) < 6000, sizes.join(","));
    const flat = parts.flat();
    assert.equal(flat.filter(([kind]) => kind === 0).length, Object.keys(panelData.PANEL).length);
    assert.equal(flat.filter(([kind]) => kind === 1).length, panelData.PANEL_PATTERNS.length);
    for (const [kind, key] of flat) {
        if (kind === 1) new RegExp(key);
    }
});

test("every pattern is a valid regular expression, and every English text keeps the $1... that its sentence catches", () => {
    for (const [source, say] of [...panelData.PANEL_PATTERNS, ...messageData.MESSAGE_PATTERNS]) {
        const found = new RegExp(source);
        const groups = new RegExp(`${source}|`).exec("").length - 1;
        const used = [...say.matchAll(/\$(\d)/g)].map((one) => Number(one[1]));
        assert.ok(used.every((n) => n >= 1 && n <= groups), `${source} -> ${say}`);
        assert.ok(found instanceof RegExp);
    }
});

test("the catalogs the panel shows are all in the dictionary: guilds, houses, titles, relatives, branches", () => {
    const nobility = module_("nobility.js", {});
    const missing = [];
    const LATIN = new Set(["Caelebs"]);
    const need = (text) => {
        if (typeof text === "string" && text !== "" && !LATIN.has(text) && panelData.PANEL[text] === undefined) missing.push(text);
    };
    for (const title of nobility.TITLES) {
        [title.male, title.female, title.gloss].forEach(need);
    }
    for (const branch of nobility.BRANCHES) {
        [branch.label, branch.note].forEach(need);
    }
    const family = fs.readFileSync(path.join(__dirname, "../src/server/family.ts"), "utf8");
    for (const match of family.matchAll(/label: "([^"]+)"/g)) need(match[1]);
    for (const match of family.matchAll(/title: "([^"]+)"/g)) need(match[1]);
    const status = fs.readFileSync(path.join(__dirname, "../src/server/status.ts"), "utf8");
    for (const match of status.matchAll(/(?:profession|name|motto): "([^"]+)"/g)) need(match[1]);
    for (const match of status.matchAll(/description:\s*((?:\s*"[^"]*"\s*\+?)+),/g)) need([...match[1].matchAll(/"([^"]*)"/g)].map((one) => one[1]).join(""));
    assert.deepEqual(missing, []);
});

test("what the notice boards and the welcome form say is said in English, the numbers in the sentences kept", () => {
    const { api } = load();
    const en = (text) => api.translate(text, "en");
    assert.equal(en("Não há quadro de avisos por perto."), "There is no notice board nearby.");
    assert.equal(en("Cartaz retirado."), "Poster taken down.");
    assert.equal(en("Você precisa de 10 moedas para afixar um cartaz."), "You need 10 coins to pin up a poster.");
    assert.equal(en("Você já tem 4 cartazes neste quadro. Retire um, ou espere que saiam."), "You already have 4 posters on this board. Take one down, or wait for them to leave.");
    assert.equal(en("Cartaz afixado: fica 7 dias no quadro."), "Poster pinned up: it stays 7 days on the board.");
    assert.match(en("Que a sorte lhe acompanhe, viajante. As regras e a história do reino estão sempre à mão: no menu F2, em Informações, e no nosso site."), /^May fortune go with you, traveller\./);
    assert.match(en("A janela de boas-vindas não abriu no seu jogo. Leia as regras no menu F2 (Informações) e no nosso site e digite /aceitar para concordar com elas e com a lore do servidor."), /type \/aceitar/);
    // The player's own words are never touched.
    assert.equal(en("Procura-se o ladrão"), "Procura-se o ladrão");
});

test("no pattern of the dictionaries has lost a backslash: a single one before ( ) d . in a string literal is nothing at all (2026-10-26)", () => {
    for (const file of ["lang-en-panel.ts", "lang-en-messages.ts"]) {
        const lines = fs.readFileSync(path.join(__dirname, "../src/server", file), "utf8").split(/\r?\n/);
        const lost = [];
        lines.forEach((line, index) => {
            if (!/^\s*\["\^/.test(line)) return;
            const source = line.slice(line.indexOf('["') + 2, line.indexOf('", "'));
            // What is left when the doubled backslashes and the escaped quotes are taken out must have none.
            if (/\\/.test(source.replace(/\\\\/g, "").replace(/\\"/g, ""))) lost.push(`${file}:${index + 1}: ${line.slice(0, 90)}`);
        });
        assert.deepEqual(lost, [], "every regex escape of a pattern is written with two backslashes in the source");
    }
});

test("the Escrivão section, the guild's new rule and the tree by region speak English (2026-10-29)", () => {
    const { api } = load();
    const en = (text) => api.translate(text, "en");
    assert.equal(en("Escrivão"), "Scribe");
    assert.equal(en("Reino"), "Realm");
    assert.equal(en("Ceder a guilda VENATORES (Caçador) a Hans?"), "Hand the guild VENATORES (Hunter) to Hans?");
    assert.equal(en("Hans deixa de ser Caçador e passa a ser Ferreiro."), "Hans stops being Hunter and becomes Blacksmith.");
    assert.equal(en("Recebe o título de Caçador, aparece na árvore da hierarquia e ganha o kit da guilda."), "Receives the title of Hunter, shows in the hierarchy tree and gets the guild's kit.");
    assert.equal(en("Retirar de Hans a guilda VENATORES (Caçador)?"), "Take the guild VENATORES (Hunter) away from Hans?");
    assert.equal(en("Cidadão de Wysoka"), "Citizen of Wysoka");
    assert.equal(en("Cidadãos com guilda / cidadãos de Suchdol"), "Citizens with a guild / citizens of Suchdol");
    assert.equal(en("Página 1 de 3 · 29 cidadãos"), "Page 1 of 3 · 29 citizens");
    assert.equal(en("Página 2 de 5 · 57 jogadores"), "Page 2 of 5 · 57 players");
    assert.equal(en("1 cidadão"), "1 citizen");
    assert.equal(en("Senhor: Radovan Capon"), "Lord: Radovan Capon");
    assert.equal(en("terras: Wysoka, Opatowitz"), "lands: Wysoka, Opatowitz");
    assert.equal(en("Sem senhor"), "No lord");
    assert.equal(en("11 cargos · 6 ofícios"), "11 offices · 6 trades");
    assert.equal(en("1 cargo · 1 ofício"), "1 office · 1 trade");
    assert.equal(en("Retirar guilda"), "Take away guild");
    assert.equal(en("Soldado"), "Soldier");
});

test("every line of Informações, by category, is in the dictionary: the categories, the topics, their subtitles and each paragraph (2026-10-29)", () => {
    const { api } = load();
    const page = fs.readFileSync(path.join(__dirname, "../ui-src/status.html"), "utf8");
    const topics = JSON.parse(/const INFO_TOPICS = (\[.*\]);/.exec(page)[1]);
    const cats = JSON.parse(/const INFO_CATS = (\[.*\]);/.exec(page)[1]);
    assert.ok(topics.length >= 25);
    const known = new Set(cats.map(([id]) => id));
    for (const [, label] of cats) assert.notEqual(api.translate(label, "en"), label, label);
    for (const topic of topics) {
        assert.ok(known.has(topic.cat), `${topic.id} has a category the list knows`);
        for (const text of [topic.name, topic.sub, ...topic.paras]) {
            assert.notEqual(api.translate(text, "en"), text, `${topic.id}: ${text.slice(0, 60)}`);
        }
    }
    const ids = topics.map((topic) => topic.id);
    for (const wanted of ["como-guilda", "escrivao", "como-casa", "como-cavaleiro", "prisao", "vender", "comecar"]) assert.ok(ids.includes(wanted), wanted);
    assert.equal(new Set(ids).size, ids.length);
    const joined = topics.flatMap((topic) => topic.paras).join(" ");
    assert.ok(!/a primeira troca é grátis e cada troca depois custa 100 moedas\.$/.test(topics.find((topic) => topic.id === "guildas").paras.at(-1)), "the old rule of choosing a guild is gone from the guilds' topic");
    assert.ok(/escrivão/i.test(joined));
});

test("arrest, the pillory and the Escrivão speak English in the chat, with the sentence and the place translated inside the sentence (2026-10-29)", () => {
    const { api } = load();
    const en = (text) => api.translate(text, "en");
    assert.equal(en("Você está preso: só pode falar."), "You are arrested: you can only speak.");
    assert.equal(en("Hans prendeu você. As suas mãos estão algemadas: você só pode andar e falar, até que um oficial solte você ou o leve ao pelourinho."), "Hans arrested you. Your hands are cuffed: you can only walk and speak, until an officer releases you or takes you to the pillory.");
    assert.equal(en("Você prendeu Kath. Leve-o ao pelourinho, ou solte-o pela tecla E."), "You arrested Kath. Take them to the pillory, or release them with the E key.");
    assert.equal(en("Kath foi solto."), "Kath was released.");
    assert.equal(en("Kath foi solto do pelourinho."), "Kath was released from the pillory.");
    assert.equal(en("Ivan pôs você no pelourinho de Kuttenberg, na prefeitura por 1 hora. Você sai quando o tempo acabar, mesmo se sair do jogo e voltar."), "Ivan put you in the pillory of Kuttenberg, at the town hall for 1 hour. You are freed when the time is up, even if you leave the game and come back.");
    assert.equal(en("Kath foi posto no pelourinho de Suchdol por 15 minutos."), "Kath was put in the pillory of Suchdol for 15 minutes.");
    assert.equal(en("Você continua no pelourinho de Zikmundovo: faltam 12 min."), "You are still in the pillory of Zikmundovo: 12 min left.");
    assert.equal(en("Anežka cedeu a você a guilda VENATORES (Caçador)."), "Anežka handed you the guild VENATORES (Hunter).");
    assert.equal(en("Hans agora é Caçador (VENATORES)."), "Hans is now Hunter (VENATORES).");
    assert.equal(en("Hans deixou de ser Caçador."), "Hans is no longer Hunter.");
    assert.equal(en("Ninguém cede uma guilda a si mesmo: peça a outro escrivão ou mestre."), "Nobody hands a guild to themselves: ask another scribe or master.");
    assert.equal(en("Anežka retirou de você a guilda VENATORES. Procure um escrivão ou um mestre de ofício para receber outra."), "Anežka took the guild VENATORES away from you. Look for a scribe or a master of a trade to receive another.");
    assert.match(en("A guilda não se escolhe mais no painel: procure um escrivão, um mestre de ofício ou guilda, ou o senhor das terras, que cede a guilda a quem é cidadão. Sem cidadania, escolha primeiro a sua cidade na seção Cidadania."), /^A guild is no longer chosen in the panel/);
});
