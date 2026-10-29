// Places each model at a scratch point, reads its bounds at yaw 0 (size along x, y, z and the pivot's place in the box),
// and removes it. node measure.mjs model1 model2 ... -> sizes.json (merged)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { call, edit } from "./wb.mjs";

const OUT = "sizes.json";
const sizes = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const AT = [1426.5, 3820.2, 125.07];
for (const model of process.argv.slice(2)) {
    const path = model.includes("/") ? model : model;
    try {
        const created = await edit("wb_props_create", { model: path, position: AT, rotation: [0, 0, 0, 1], physics: "none" });
        const id = created.id ?? created.objectId ?? created.ids?.[0];
        const info = await call("wb_object_get", { id });
        const { min, max } = info.bounds;
        sizes[path.split("/").pop().replace(".cgf", "")] = {
            path,
            size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((v) => +v.toFixed(2)),
            // Where the pivot sits inside the box, from its min corner.
            pivot: [AT[0] - min[0], AT[1] - min[1], AT[2] - min[2]].map((v) => +v.toFixed(2)),
        };
        await edit("wb_objects_delete", { ids: [id] });
        console.log(path.split("/").pop(), JSON.stringify(sizes[path.split("/").pop().replace(".cgf", "")]));
    } catch (error) {
        console.log(`${path}: ${error.message.slice(0, 160)}`);
    }
}
writeFileSync(OUT, JSON.stringify(sizes, null, 1));
