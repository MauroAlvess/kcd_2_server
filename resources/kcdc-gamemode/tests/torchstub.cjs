"use strict";

// The stand-in for src/server/torch-down.js in the tests of the modules that call it before an animation plays on a player (2026-10-25). The
// real one has its own test (torchdown.test.cjs); here it only says for whom it was asked.
const lowered = [];
const torch = { lowerTorch: (player) => { lowered.push(player.nickname ?? player.id); return false; } };

module.exports = { lowered, torch };
