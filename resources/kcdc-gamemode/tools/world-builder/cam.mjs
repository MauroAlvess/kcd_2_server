// node cam.mjs cx cy cz tx ty tz [fov]: puts the editor camera at (cx,cy,cz) looking at (tx,ty,tz). Forward = (-sin yaw, cos yaw).
import { edit } from "./wb.mjs";
const [cx, cy, cz, tx, ty, tz, fov] = process.argv.slice(2).map(Number);
const dx = tx - cx, dy = ty - cy, dz = tz - cz;
const yaw = (Math.atan2(-dx, dy) * 180) / Math.PI;
const pitch = (Math.atan2(dz, Math.hypot(dx, dy)) * 180) / Math.PI;
await edit("wb_camera_set", { position: [cx, cy, cz], yaw, pitch, fov: fov || 63 });
console.log(`camera yaw ${yaw.toFixed(1)} pitch ${pitch.toFixed(1)}`);
