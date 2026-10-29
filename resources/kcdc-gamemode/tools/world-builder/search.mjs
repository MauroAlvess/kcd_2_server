// node search.mjs bed chest carpet ... : the catalog's prop paths for each word.
import { call } from "./wb.mjs";

for (const query of process.argv.slice(2)) {
    try {
        const result = await call("wb_assets_search", { kind: "prop", query, limit: 200 });
        const items = result.items ?? result.results ?? result.assets ?? [];
        const names = items.map((item) => item.path ?? item.name ?? JSON.stringify(item));
        console.log(`== ${query} (${result.total ?? names.length})`);
        console.log(names.join("\n"));
    } catch (error) {
        console.log(`== ${query}: ${error.message.slice(0, 200)}`);
    }
}
