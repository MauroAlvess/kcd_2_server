// The pages (the status panel and the character creator) are written in ui-src/<page>.html and packed into ui/<page>.html by
// scripts/pack-ui.mjs (comments and indentation are what compresses worst, and the client package has to stay small: see
// packagesize.test.cjs). These checks make sure the packing never changes what a page says or does, and that what is
// shipped is the current page.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const packer = () => import(pathToFileURL(path.join(root, "scripts", "pack-ui.mjs")).href);

test("comments and indentation go, strings and regular expressions that only look like comments stay", async () => {
    const { packScript, packStyle } = await packer();

    const script = packScript(`
        "use strict";
        /* a block comment */
        const note = "a /* string */ that is no comment";
        const pattern = /x\\/*y/; // a line comment, after a regular expression with a slash and a star in it
        function twice(value) {
            return value * 2; /* trailing */
        }
        out.push(note, String(pattern), twice(21));
    `);
    assert.ok(!/block comment|line comment|trailing/.test(script), "the comments are gone");
    assert.ok(!/^\s/m.test(script), "no line starts with an indent");

    const out = [];
    vm.runInNewContext(script, { out, String });
    assert.deepEqual(out, ["a /* string */ that is no comment", "/x\\/*y/", 42], "and the script still does the same");

    const style = packStyle(`
        /* the page */
        .a { content: "keep"; }   /* trailing */
        .b > .c,
        .d .e:hover {
            color: rgba(0, 0, 0, .5);
            margin: 0 auto;
        }
    `);
    assert.equal(style, '.a{content:"keep"}.b>.c,.d .e:hover{color:rgba(0,0,0,.5);margin:0 auto}', "a space between two selectors, or two values, stays");
});

test("what cannot be packed safely is refused rather than guessed at", async () => {
    const { packScript, packStyle } = await packer();
    assert.throws(() => packScript("const a = ;"), /does not parse/);
    assert.throws(() => packScript("const a = `one\n   two`;"), /template literal/);
    assert.throws(() => packStyle('.a { content: "/* not closed"; }'), /comment marker/);
});

test("a page is packed whole: style, script and markup, with a note on where it comes from", async () => {
    const { packPage } = await packer();
    const page = packPage(`<!DOCTYPE html>
<html>
<head>
    <!-- an html comment -->
    <style>
        /* gone */
        body { margin: 0; }
    </style>
</head>
<body>
    <p>
        text
    </p>
    <script>
        // kept as code: no comment here survives
        document.title = "x"; /* gone too */
    </script>
</body>
</html>
`);
    assert.match(page, /^<!DOCTYPE html>\n<!-- Written by scripts\/pack-ui\.mjs from ui-src\/status\.html: edit that one\. -->\n<html>/);
    assert.ok(!/gone|html comment|kept as code/.test(page));
    assert.ok(page.includes("body{margin:0}") && page.includes("<p>\ntext\n</p>") && page.includes('document.title="x"'));
    assert.ok(page.endsWith("</html>\n"));
});

test("the pages the players download are the current ones, and are smaller than the pages as they are written", async () => {
    const { packPage, PAGES } = await packer();
    assert.deepEqual([...PAGES], ["status", "creator", "freecam", "chat", "craft", "emotes", "voice", "welcome", "mural"]);
    for (const name of PAGES) {
        const source = fs.readFileSync(path.join(root, "ui-src", `${name}.html`), "utf8");
        const shipped = fs.readFileSync(path.join(root, "ui", `${name}.html`), "utf8");
        assert.equal(shipped, packPage(source, name), `ui/${name}.html is out of date: run \`npm run build\``);
        assert.ok(shipped.length < source.length * 0.85, `${name}: packed ${shipped.length} bytes from ${source.length}: it should be well under`);
        assert.match(shipped, new RegExp(`from ui-src/${name}\\.html: edit that one`), "and says where it comes from");
    }
});

test("the packed page's script is a script and still names every event the client relays to the server", async () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "status.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "status.ts"), "utf8");
    const relayed = [...client.matchAll(/relay\("(status:[A-Za-z]+)"/g)].map((match) => match[1]);
    assert.ok(relayed.length > 20);
    // The page asks only for what the client carries: every event it sends is one the client relays (or handles itself).
    const sent = [...script.matchAll(/send\("(status:[A-Za-z]+)"/g)].map((match) => match[1]);
    const handled = new Set([...relayed, "status:ready", "status:close", "status:tab", "status:mode", "status:option", "status:voice", "status:freeCam", "status:ui"]);
    for (const event of new Set(sent)) {
        assert.ok(handled.has(event), `the page sends ${event}, which the client does not carry`);
    }
});

test("the creator page's script is a script, and the page and its client script speak the same events", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "creator.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "creator-page.ts"), "utf8");
    const handled = new Set([...client.matchAll(/Web\.on\(view, "(creator:[A-Za-z]+)"/g)].map((match) => match[1]));
    const sent = new Set([...script.matchAll(/send\("(creator:[A-Za-z]+)"/g)].map((match) => match[1]));
    assert.ok(sent.size >= 6, "the page asks for its things");
    for (const event of sent) {
        assert.ok(handled.has(event), `the page sends ${event}, which the client does not carry`);
    }

    const emitted = new Set([...client.matchAll(/(?:Web\.emit\(view, |toPage\()"(creator:[A-Za-z]+)"/g)].map((match) => match[1]));
    const listened = new Set([...script.matchAll(/addEventListener\("(creator:[A-Za-z]+)"/g)].map((match) => match[1]));
    assert.ok(listened.size >= 3);
    for (const event of listened) {
        assert.ok(emitted.has(event), `the page listens for ${event}, which the client never sends`);
    }

    // every event the client carries from the page is one the page sends (nothing handled for nobody)
    for (const event of handled) {
        if (event !== "creator:ready") assert.ok(sent.has(event), `the client handles ${event}, which the page never sends`);
    }
    assert.ok(sent.has("creator:ready") && handled.has("creator:ready"));
});

test("the free camera page's script is a script, and the page and the camera speak the same events", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "freecam.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "camera.ts"), "utf8");
    const handled = [...new Set([...client.matchAll(/Web\.on\(page, "(freecam:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const sent = [...new Set([...script.matchAll(/send\("(freecam:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(handled, ["freecam:exit", "freecam:heard", "freecam:keys", "freecam:look", "freecam:ready"]);
    assert.deepEqual(sent, handled, "everything the page says is heard, and nothing is heard that the page never says");

    // the client's word back (the game's keys fly it now) is one the page listens for, and the other way round
    const emitted = [...new Set([...client.matchAll(/Web\.emit\(page, "(freecam:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const listened = [...new Set([...script.matchAll(/addEventListener\("(freecam:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(emitted, ["freecam:mode"]);
    assert.deepEqual(listened, emitted);

    // the page reads keys by their number (the game's browser leaves `code` empty), Esc, F2 and F3 among them, and they end the flight
    assert.doesNotMatch(script, /event\.code ===|code === "/);
    // (the packed script has no spaces and shorter local names)
    assert.match(script, /27:"esc"/);
    assert.match(script, /113:"f2",114:"f3"/);
    assert.match(script, /\w==="esc"/);
    assert.match(script, /\w==="f2"\|\|\w==="f3"/);
});


test("the chat page's script is a script, and the page and the chat card speak the same events", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "chat.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "chat-card.ts"), "utf8");
    const handled = [...new Set([...client.matchAll(/Web\.on\(view, "(chat:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const sent = [...new Set([...script.matchAll(/send\("(chat:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(handled, ["chat:close", "chat:ready", "chat:submit"]);
    assert.deepEqual(sent, handled, "everything the page says is heard, and nothing is heard that the page never says");

    const emitted = [...new Set([...client.matchAll(/Web\.emit\(view, "(chat:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const listened = [...new Set([...script.matchAll(/addEventListener\("(chat:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(emitted, ["chat:line", "chat:open", "chat:shut"]);
    assert.deepEqual(listened, emitted);

    // Enter, Esc and the arrows are read by their number (the game's browser leaves `code` empty), as the free camera's page does.
    assert.doesNotMatch(script, /event\.code ===|code === "/);
    assert.match(script, /13/);
    assert.match(script, /27/);
});

test("the chat page's commands menu offers only commands a player can run, and the card wears the panel's two corners", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "chat.html"), "utf8");
    const modes = [...shipped.matchAll(/\{id:"\/([a-z]+)"/g)].map((match) => match[1]);
    assert.ok(modes.length >= 8, "the menu lists the roleplay commands and the few a player writes with words");
    for (const name of ["me", "do", "try"]) {
        assert.ok(modes.includes(name), `/${name} is in the menu`);
    }
    assert.equal(new Set(modes).size, modes.length, "no command twice");

    const auth = fs.readFileSync(path.join(root, "src", "server", "auth.ts"), "utf8");
    const listed = auth.match(/COMMON_COMMANDS[^=]*=\s*new Set\(\[([^\]]*)\]/);
    assert.ok(listed, "auth.ts lists the commands a player runs");
    const common = new Set([...listed[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
    for (const name of modes) {
        assert.ok(common.has(name), `/${name} is in the chat's menu but a player cannot run it`);
    }

    // the same two corners as every other page, from the images the package already carries
    assert.match(shipped, /src="img\/frame-corner-tl\.webp"/);
    assert.match(shipped, /src="img\/frame-corner-br\.webp"/);
    for (const name of ["frame-corner-tl.webp", "frame-corner-br.webp"]) {
        assert.ok(fs.existsSync(path.join(root, "ui", "img", name)), `${name} is shipped`);
    }
    // Esc shuts the menu first, and only then the writing line (the page's own order)
    const source = fs.readFileSync(path.join(root, "ui-src", "chat.html"), "utf8");
    assert.match(source, /Escape[\s\S]{0,200}menu\.classList\.contains\("open"\)[\s\S]{0,80}closeMenu\(\);[\s\S]{0,40}return;/);
});

test("the trades' page's script is a script, and the page and its client speak the same events", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "craft.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "craft-page.ts"), "utf8");
    const handled = [...new Set([...client.matchAll(/Web\.on\(view, "(craft:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const sent = [...new Set([...script.matchAll(/send\("(craft:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(handled, ["craft:cancel", "craft:close", "craft:make", "craft:mode", "craft:ready", "craft:slots"]);
    assert.deepEqual(sent, handled, "everything the page says is heard, and nothing is heard that the page never says");

    const emitted = new Set([...client.matchAll(/(?:Web\.emit\(view, |toPage\()"(craft:[A-Za-z]+)"/g)].map((match) => match[1]));
    const listened = [...new Set([...script.matchAll(/addEventListener\("(craft:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(listened, ["craft:icons", "craft:progress", "craft:result", "craft:view"]);
    for (const event of listened) assert.ok(emitted.has(event), `the page listens for ${event}, which the client never sends`);
    // Esc closes it, read by its number as the other pages do.
    assert.match(script, /27/);

    // The trade between players on the same page (2026-10-18): its buttons, each passed on to the server by the client.
    const tradeSent = [...new Set([...script.matchAll(/send\("trade:([a-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(tradeSent, ["accept", "cancel", "items"], "no money field: the game's transfer screen moves the money");
    const relayed = client.match(/for \(const action of \[([^\]]*)\]\)/);
    assert.ok(relayed, "the client passes the trade's buttons on");
    assert.deepEqual(JSON.parse("[" + relayed[1] + "]").sort(), tradeSent);
    for (const event of ["trade:view", "trade:end"]) assert.ok(script.includes(`addEventListener("${event}"`), `the page listens for ${event}`);
});

test("the voice page's script is a script, and the page and the voice indicator speak the same events", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "voice.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "voice.ts"), "utf8");
    const handled = [...new Set([...client.matchAll(/Web\.on\(view, "(voice:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const sent = [...new Set([...script.matchAll(/send\("(voice:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(handled, ["voice:ready"]);
    assert.deepEqual(sent, handled, "everything the page says is heard, and nothing is heard that the page never says");

    const emitted = [...new Set([...client.matchAll(/Web\.emit\(view, "(voice:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const listened = [...new Set([...script.matchAll(/addEventListener\("(voice:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(emitted, ["voice:state"]);
    assert.deepEqual(listened, emitted);
});

test("the welcome page's script is a script, and the page and the welcome client speak the same events", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "welcome.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "welcome.ts"), "utf8");
    const handled = [...new Set([...client.matchAll(/Web\.on\(view, "(welcome:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const sent = [...new Set([...script.matchAll(/send\("(welcome:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(handled, ["welcome:accept", "welcome:ready"]);
    assert.deepEqual(sent, handled, "everything the page says is heard, and nothing is heard that the page never says");

    const emitted = [...new Set([...client.matchAll(/Web\.emit\(view, "(welcome:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const listened = [...new Set([...script.matchAll(/addEventListener\("(welcome:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(emitted, ["welcome:done", "welcome:open"]);
    assert.deepEqual(listened, emitted);

    // It has no way out but its button: no Escape, no close button.
    assert.doesNotMatch(script, /keydown|keyCode|Escape/);
    assert.doesNotMatch(shipped, /class="close"/);
});

test("the notice board's page: its script is a script, it and the client speak the same events, and the fonts and pictures it names are in the package", () => {
    const shipped = fs.readFileSync(path.join(root, "ui", "mural.html"), "utf8");
    const script = shipped.slice(shipped.indexOf("<script>") + 8, shipped.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));

    const client = fs.readFileSync(path.join(root, "src", "client", "mural.ts"), "utf8");
    const handled = [...new Set([...client.matchAll(/Web\.on\(view, "(mural:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const sent = [...new Set([...script.matchAll(/send\("(mural:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(handled, ["mural:close", "mural:publish", "mural:ready", "mural:remove"]);
    assert.deepEqual(sent, handled, "everything the page says is heard, and nothing is heard that the page never says");

    const emitted = [...new Set([...client.matchAll(/(?:Web\.emit\(view, |toPage\()"(mural:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    const listened = [...new Set([...script.matchAll(/addEventListener\("(mural:[A-Za-z]+)"/g)].map((match) => match[1]))].sort();
    assert.deepEqual(emitted, ["mural:art", "mural:open", "mural:result", "mural:view"]);
    assert.deepEqual(listened, emitted);

    // What it draws from the package: the two faces and the paper's pictures (the posters themselves come from the server).
    for (const file of [...shipped.matchAll(/url\("((?:fonts|img)\/[^"]+)"\)/g)].map((match) => match[1]).concat([...shipped.matchAll(/src="((?:fonts|img)\/[^"]+)"/g)].map((match) => match[1]))) {
        assert.ok(fs.existsSync(path.join(root, "ui", file)), `ui/${file}`);
    }
    assert.match(shipped, /fonts\/grenze-gotisch\.woff2/);
    // A way out: its button and Escape.
    assert.match(script, /Escape/);
    assert.match(shipped, /id="close"/);
});
