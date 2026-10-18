import { getPersonInView } from "./interaction.js";

const STATIONS = "kcdc-gamemode:cook.stations";
const ASK = "kcdc-gamemode:cook.menu";
const TEXT = ["Cozinhar", "Secar", "Defumar"];

/** Beside the game's own prompt at a fire, a rack or a smokehouse: ours, which asks the server for the cooking menu. */
export function installCookHint(): void {
    let points: number[][] = [];
    let hint = 0;
    let shown = -1;
    const remove = (): void => {
        if (hint) ActionHint.remove(hint);
        hint = 0;
        shown = -1;
    };
    const update = (): void => {
        const me = LocalPlayer;
        if (!me?.ready || !me.alive || getPersonInView()) {
            remove();
            return;
        }
        const p = me.position;
        let kind = -1;
        let best = 2.6;
        for (const s of points) {
            const d = Math.hypot(s[1]! - p.x, s[2]! - p.y);
            if (d < best && Math.abs(s[3]! - p.z) <= 2.5) {
                best = d;
                kind = s[0]!;
            }
        }
        if (kind < 0) {
            remove();
            return;
        }
        if (!hint) hint = ActionHint.create({ key: "primary_action", text: TEXT[kind] ?? "Cozinhar" }, () => Events.emitServer(ASK, {}));
        else if (shown !== kind) ActionHint.setText(hint, TEXT[kind] ?? "Cozinhar");
        shown = kind;
    };
    Events.on(STATIONS, (payload) => {
        try {
            const list = typeof payload === "string" ? JSON.parse(payload) : payload;
            points = Array.isArray(list) ? list.filter((s) => Array.isArray(s) && s.length === 4 && s.every(Number.isFinite)) : [];
        } catch {
            points = [];
        }
    });
    const timer = setInterval(update, 150);
    Events.on("resourceStop", (name) => {
        if (name !== "kcdc-gamemode") return;
        clearInterval(timer);
        remove();
    });
}
