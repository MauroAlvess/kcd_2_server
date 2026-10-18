const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(voice) {
    const errors = [];
    const context = { exports: {}, console: { log() {}, error: (line) => errors.push(line) }, Voice: voice };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/voice.js"), "utf8"), context);
    return { install: context.exports.installVoice, errors };
}

test("voice is put on push-to-talk and the V key", () => {
    const state = { mode: "voiceActivity", key: "h" };
    const { install, errors } = load({
        setTransmitMode: (mode) => { state.mode = mode; },
        setPushToTalkKey: (key) => { state.key = key; },
        getTransmitMode: () => state.mode,
        getPushToTalkKey: () => state.key,
    });
    install();

    assert.equal(state.mode, "pushToTalk");
    assert.equal(state.key, "v");
    assert.equal(errors.length, 0);
});

test("a voice setting the client refuses is reported and does not stop the rest of the script", () => {
    const { install, errors } = load({
        setTransmitMode: () => { throw new Error("no microphone"); },
        setPushToTalkKey: () => {},
        getTransmitMode: () => "voiceActivity",
        getPushToTalkKey: () => "v",
    });
    assert.doesNotThrow(() => install());
    assert.equal(errors.length, 1);
    assert.match(errors[0], /no microphone/);
});
