import { edit } from "./wb.mjs";
const path = process.argv[2];
console.log(JSON.stringify(await edit("wb_world_export", { path, overwrite: process.argv[3] === "overwrite" }), null, 1));
