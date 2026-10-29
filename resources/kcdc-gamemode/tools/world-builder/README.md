# World Builder helpers

Small scripts that drive the World Builder through its MCP endpoint (127.0.0.1:7781, JSON-RPC), kept from the sessions in which the user opened the
builder for us (2026-10-19 to 2026-10-24). They talk to the user's running editor: use them only in a session the user starts, one piece at a time,
and never move or delete what they made (see the memory note "World Builder is the user's").

- `wb.mjs` -- the client (`node wb.mjs tools|schema <tool>|call <tool> '<json>'|edit <tool> '<json>'|state`); `wbpy.py` is its Python twin, with `look`
  (a top-down capture with a world-coordinate grid drawn on it).
- `board.mjs <name> x y yaw` -- builds a notice board (16 pieces, the buried `scroll_c` marker the server reads: `src/server/mural-places.ts`);
  `--clear` takes it away again. `boards.first-placement.json` is where it put the first 19 (the user moved all of them afterwards: the export is the truth).
- `cam.mjs cx cy cz tx ty tz` -- the camera at a point looking at another (forward = (-sin yaw, cos yaw)); `verify.py`, `sheet.py`, `cap.sh` -- look at a
  board from the front and make a contact sheet; `looks.py` -- top-down looks of the villages; `measure.mjs`, `search.mjs` -- sizes and the prop catalog.
- `export.mjs <path> [overwrite]` and `save.mjs <path>` -- `wb_world_export` and `wb_project_save`; the export must be under the maps folder of the client.
- Backslash pairs in a Bash command arrive halved on this machine: write patch text with the Write tool.
