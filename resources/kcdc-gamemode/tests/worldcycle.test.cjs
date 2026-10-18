const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fakeDisk(seed = {}) {
    const files = new Map(Object.entries(seed));
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

/** A World that records what was asked of it; `blending` makes setWeather refuse, as a running blend does. */
function load({ seed = {}, randoms = [], hour = 8, day = 0 } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);

    const calls = { weather: [], rain: [], wind: [], scale: [], time: [], hour: [] };
    const world = {
        day, hour, timeScale: 15, weather: "", rainIntensity: 0, wind: { x: 0, y: 0, z: 0 }, windSpeed: 0, blending: false,
        setWeather(preset, seconds) { if (this.blending) return false; calls.weather.push([preset, seconds]); this.weather = preset; return true; },
        setRain(intensity, amount) { calls.rain.push([intensity, amount]); this.rainIntensity = intensity; return true; },
        setWind(wind) { calls.wind.push(wind); this.wind = { ...wind }; this.windSpeed = Math.hypot(wind.x, wind.y); return true; },
        setTimeScale(scale) { calls.scale.push(scale); this.timeScale = scale; return true; },
        setTime(d, h) { calls.time.push([d, h]); if (d < this.day || (d === this.day && h < this.hour)) return false; this.day = d; this.hour = h; return true; },
        setHour(h) { calls.hour.push(h); this.hour = h; return true; },
    };
    const clock = { now: 1_000_000 };
    let r = 0;
    const handlers = new Map();
    const intervals = [];
    const logs = [];
    const context = {
        exports: {},
        require: (id) => { assert.equal(id, "./store.js"); return storeSandbox.exports; },
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        World: world,
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Events: { on: (name, fn) => handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/world-cycle.js"), "utf8"), context);
    const random = () => (r < randoms.length ? randoms[r++] : 0.5);
    const cycle = new context.exports.WorldCycle(() => clock.now, random);
    return { api: context.exports, cycle, world, calls, clock, disk, handlers, intervals, logs };
}

test("forty real minutes of day and forty of night: the clock runs faster by day than by night", () => {
    const { api } = load();
    assert.equal(api.scaleFor(12), 22.5, "15 game hours (06:00-21:00) in 40 minutes");
    assert.equal(api.scaleFor(0), 13.5, "9 game hours (21:00-06:00) in 40 minutes");
    assert.equal(api.scaleFor(5.99), 13.5);
    assert.equal(api.scaleFor(6), 22.5);
    assert.equal(api.scaleFor(20.99), 22.5);
    assert.equal(api.scaleFor(21), 13.5);
    // The two halves really are forty minutes each.
    assert.equal((15 * 3600) / api.scaleFor(12) / 60, 40);
    assert.equal((9 * 3600) / api.scaleFor(0) / 60, 40);
});

test("how long until the turn is counted in real minutes at the current half's pace", () => {
    const { api } = load();
    assert.equal(api.minutesToTurn(6), 40, "dawn: a whole day ahead");
    assert.equal(api.minutesToTurn(21), 40, "dusk: a whole night ahead");
    assert.equal(Math.round(api.minutesToTurn(13.5)), 20, "halfway through the day");
    assert.equal(Math.round(api.minutesToTurn(1.5)), 20, "halfway through the night");
});

test("each tick puts the scale right for the hour, and leaves it alone when it already is", () => {
    const sut = load({ hour: 12 });
    sut.world.timeScale = 15;
    sut.cycle.until = Number.MAX_SAFE_INTEGER;
    sut.cycle.tick();
    assert.deepEqual(sut.calls.scale, [22.5]);
    sut.cycle.tick();
    assert.equal(sut.calls.scale.length, 1);

    sut.world.hour = 22;
    sut.cycle.tick();
    assert.deepEqual(sut.calls.scale, [22.5, 13.5]);
});

test("an administrator who stops the clock is not overruled by the tick", () => {
    const sut = load({ hour: 12 });
    sut.cycle.until = Number.MAX_SAFE_INTEGER;
    sut.cycle.clockManaged = false;
    sut.world.timeScale = 0;
    sut.cycle.tick();
    assert.deepEqual(sut.calls.scale, []);
});

test("a new weather is one of the game's own presets, never the one already on, and lasts 20 to 45 minutes", () => {
    const sut = load();
    const first = sut.api.WEATHER[0];
    sut.cycle.kind = first;
    for (let i = 0; i < 30; i += 1) {
        const next = sut.cycle.pick();
        assert.notEqual(next.id, first.id);
    }
    const all = sut.api.WEATHER.flatMap((kind) => kind.presets);
    assert.ok(all.includes("cloudless_sunny"), "the preset the documentation names");
    assert.ok(all.every((preset) => /^[a-z]+(_[a-z]+)*(_[ABC])?$/.test(preset)), "spelled as the game's scripts spell them");

    sut.clock.now = 5_000_000;
    assert.equal(sut.cycle.apply(sut.api.weatherById("nublado")), true);
    const minutes = (sut.cycle.until - sut.clock.now) / 60_000;
    assert.ok(minutes >= 20 && minutes <= 45, `${minutes} minutes`);
});

test("a storm brings the rain and the wind up over the blend, and a clear sky takes them down", () => {
    const sut = load({ randoms: [0, 0.5, 0.5, 0.5] });
    sut.world.timeScale = 22.5;
    assert.equal(sut.cycle.apply(sut.api.weatherById("tempestade")), true);
    const [preset, seconds] = sut.calls.weather.at(-1);
    assert.match(preset, /^foggy_storm/);
    assert.equal(seconds, 4 * 60 * 22.5, "four real minutes, in game seconds at the current scale");
    assert.equal(sut.calls.rain.at(-1)[0], 0, "the ramp starts where the rain was");

    sut.clock.now += 2 * 60_000;
    sut.cycle.tick();
    const halfway = sut.calls.rain.at(-1)[0];
    assert.ok(halfway > 0.35 && halfway < 0.55, `halfway ${halfway}`);

    sut.clock.now += 3 * 60_000;
    sut.cycle.tick();
    const rain = sut.calls.rain.at(-1)[0];
    assert.ok(rain >= 0.8 && rain <= 1, `full ${rain}`);
    const wind = sut.calls.wind.at(-1);
    const speed = Math.hypot(wind.x, wind.y);
    assert.ok(speed >= 10 && speed <= 18, `wind ${speed}`);

    sut.cycle.apply(sut.api.weatherById("limpo"), true);
    assert.equal(sut.calls.rain.at(-1)[0], 0, "an instant change lands at once");
});

test("a change asked for while the sky is still blending waits and happens on a later tick", () => {
    const sut = load();
    sut.world.blending = true;
    assert.equal(sut.cycle.force(sut.api.weatherById("garoa")), false);
    assert.equal(sut.cycle.pending.id, "garoa");
    sut.cycle.tick();
    assert.equal(sut.calls.weather.length, 0);

    sut.world.blending = false;
    sut.cycle.tick();
    assert.match(sut.calls.weather.at(-1)[0], /^foggy_drizzly/);
    assert.equal(sut.cycle.pending, null);
});

test("when a weather has run its time the next one starts by itself", () => {
    const sut = load();
    sut.cycle.apply(sut.api.weatherById("limpo"), true);
    const before = sut.calls.weather.length;
    sut.clock.now = sut.cycle.until + 1;
    sut.cycle.tick();
    assert.equal(sut.calls.weather.length, before + 1);
    assert.notEqual(sut.cycle.kind.id, "limpo");
});

test("the clock is saved and comes back after a restart, even when the saved hour is earlier than 08:00", () => {
    const sut = load({ day: 3, hour: 14.25 });
    sut.cycle.save();
    const saved = JSON.parse(sut.disk.files.get("playerdata/world.json"));
    assert.deepEqual([saved.day, saved.hour], [3, 14.25]);

    // A restart: day 0, 08:00.
    const later = load({ seed: { "playerdata/world.json": JSON.stringify({ day: 3, hour: 14.25 }) } });
    later.cycle.restoreClock();
    assert.deepEqual(later.calls.time, [[3, 14.25]]);
    assert.equal(later.world.day, 3);

    const early = load({ seed: { "playerdata/world.json": JSON.stringify({ day: 0, hour: 5 }) } });
    early.cycle.restoreClock();
    assert.deepEqual(early.calls.hour, [5], "05:00 of day 0 is behind the 08:00 a restart starts at, so the next 05:00 is taken");

    const junk = load({ seed: { "playerdata/world.json": JSON.stringify({ day: -1, hour: 99 }) } });
    junk.cycle.restoreClock();
    assert.deepEqual(junk.calls.time.concat(junk.calls.hour), []);
});

test("starting up restores the clock, sets the pace for the hour and puts a sky on at once", () => {
    const sut = load({ hour: 22, seed: { "playerdata/world.json": JSON.stringify({ day: 2, hour: 23 }) } });
    sut.api.installWorldCycle();
    assert.deepEqual(sut.calls.time, [[2, 23]]);
    assert.equal(sut.calls.scale[0], 13.5, "it is night");
    assert.equal(sut.calls.weather.length, 1);
    assert.equal(sut.calls.weather[0][1], 0, "instant");
    assert.equal(sut.intervals[0].ms, 5000);
    assert.ok(sut.logs.some((line) => /40 min de dia e 40 min de noite/.test(line)));

    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.ok(sut.disk.files.has("playerdata/world.json"), "stopping saves the clock");
});
