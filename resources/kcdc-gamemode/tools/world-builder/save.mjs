import { edit } from "./wb.mjs";
console.log(JSON.stringify(await edit("wb_project_save", { path: process.argv[2], overwrite: process.argv[3] === "overwrite" }), null, 1));
