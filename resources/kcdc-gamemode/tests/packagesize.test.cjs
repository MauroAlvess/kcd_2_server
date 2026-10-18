// The client package -- everything `mafiahub.files` lists plus the client scripts -- is sent to
// every joining player as one blob. Observed on this server: packages up to 510,619 bytes
// (as the server logs them, compressed) download fine; 643,623 bytes and above never finish,
// and the player sits on the loading screen with no error anywhere. So the package is kept
// well under the last size that worked, and this test fails before a deploy can cross it.
//
// The server logs the compressed size ("Packaged client resource ...: N bytes"). zlib is
// within 1% of it, which is close enough for a guard with a 6% margin.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const LIMIT = 480000;

function filesUnder(directory) {
    const found = [];
    if (!fs.existsSync(directory)) {
        return found;
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            found.push(...filesUnder(full));
        } else {
            found.push(full);
        }
    }
    return found;
}

test("the client package stays under the size that is known to download", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const folders = manifest.mafiahub.files.map((pattern) => pattern.replace(/\/\*\*$/, ""));

    const files = folders.flatMap((folder) => filesUnder(path.join(root, folder)));
    assert.ok(files.length > 0, "no packaged files found; run `npm run build` first");

    let total = 0;
    const sizes = [];
    for (const file of files) {
        const compressed = zlib.deflateSync(fs.readFileSync(file), { level: 6 }).length;
        total += compressed;
        sizes.push([compressed, path.relative(root, file)]);
    }

    const heaviest = sizes
        .sort((a, b) => b[0] - a[0])
        .slice(0, 6)
        .map(([size, name]) => `  ${String(size).padStart(7)}  ${name}`)
        .join("\n");
    assert.ok(
        total < LIMIT,
        `the client package is about ${total} bytes compressed; keep it under ${LIMIT}.\nHeaviest files:\n${heaviest}\n` +
            "Shrink the images (tools/make-ui-images.py) or drop assets. Past ~510 KB the join hangs.",
    );
});
