const STATE_EVENT = "kcdc-gamemode:combat.state";
const VOTE_EVENT = "kcdc-gamemode:combat.vote";
const RELEASE_EVENT = "kcdc-gamemode:combat.release";
const AFTER_EVENT = "kcdc-gamemode:combat.after";
/**
 * "NPCs first" (`src/server/lockon-priority.ts`, user 2026-10-25): while an enemy NPC is about, the server names the players round this one, and they stay
 * out of this machine's lock-on; when none is, they are let back in. Whatever else keeps a player out (a fight just ended) still does.
 */
const PRIORITY_EVENT = "kcdc-gamemode:combat.priority";

/** U by default, rebindable under Multiplayer controls. */
const COMBAT_HINT_KEY = "kcdc_end_combat";

/**
 * How long a former opponent stays out of this machine's combat lock-on once the fight is over, so the game lets go of it
 * (2026-10-19: after peace, U and `/paz`, Radovan could open neither the map nor the inventory until he left and came back).
 * Then they can be locked on again, as before.
 */
const RELEASE_MS = 5_000;

/** How long after a release this machine tells the server what its hands and menus look like, for the log. */
const REPORT_AFTER_MS = 2_500;

interface Fight {
    opponent: number;
    name: string;
    token: number;
    voted: boolean;
    offered: boolean;
}

export function installCombat(): void {
    let fights: Fight[] = [];
    let selected: Fight | undefined;
    let hint = 0;
    const released = new Map<number, ReturnType<typeof setTimeout>>();
    /** The players kept out of the lock-on because an enemy NPC is about. */
    let npcFirst = new Set<number>();
    let report: ReturnType<typeof setTimeout> | undefined;
    const remove = (): void => {
        if (hint) ActionHint.remove(hint);
        hint = 0;
    };
    const targetable = (opponent: number, on: boolean): void => {
        try { new Player(opponent).setTargetable(on); }
        catch { /* not on this machine any more */ }
    };
    /** Whether a player may be locked on now: not just out of a fight, and not while an enemy NPC is about. */
    const refresh = (opponent: number): void => targetable(opponent, !released.has(opponent) && !npcFirst.has(opponent));
    const release = (opponents: number[], why: string): void => {
        for (const opponent of opponents) {
            const previous = released.get(opponent);
            if (previous !== undefined) clearTimeout(previous);
            released.set(opponent, setTimeout(() => {
                released.delete(opponent);
                refresh(opponent);
            }, RELEASE_MS));
            refresh(opponent);
        }
        if (report !== undefined) clearTimeout(report);
        report = setTimeout(() => {
            report = undefined;
            const local = LocalPlayer;
            if (!local) return;
            Events.emitServer(AFTER_EVENT, JSON.stringify({
                why, fistsUp: local.fistsUp, guard: local.guard, right: local.rightHandItem, left: local.leftHandItem,
                inventory: NativeUI.isMenuEnabled("inventory"), map: NativeUI.isMenuEnabled("map"),
            }));
        }, REPORT_AFTER_MS);
    };
    // A new blow between the two lets them lock on each other again at once.
    const engage = (opponent: number): void => {
        const timer = released.get(opponent);
        if (timer === undefined) return;
        clearTimeout(timer);
        released.delete(opponent);
        refresh(opponent);
    };
    const update = (): void => {
        const local = LocalPlayer;
        const distance = (fight: Fight): number => {
            const other = new Player(fight.opponent);
            return local && other.ready ? Math.hypot(local.position.x - other.position.x, local.position.y - other.position.y, local.position.z - other.position.z) : Infinity;
        };
        const next = local && local.canAct ? fights.slice().sort((a, b) => distance(a) - distance(b))[0] : undefined;
        // A hold begun for one opponent must never vote for another.
        if (next?.token !== selected?.token) remove();
        selected = next;
        if (!selected) { remove(); return; }
        const name = selected.name.slice(0, 40);
        const text = selected.voted ? `End combat with ${name}: waiting (1/2)` : selected.offered ? `Accept peace with ${name} (1/2)` : `Offer peace to ${name} (0/2)`;
        if (!hint) {
            const fight = selected;
            hint = ActionHint.create({ key: COMBAT_HINT_KEY, text, mode: "hold", holdDuration: 1, enabled: !fight.voted }, () => {
                if (selected !== fight || fight.voted) return;
                Events.emitServer(VOTE_EVENT, { opponent: fight.opponent, token: fight.token });
            });
        } else {
            ActionHint.setText(hint, text);
            ActionHint.setEnabled(hint, !selected.voted);
        }
    };
    Events.on(STATE_EVENT, (payload) => {
        let state: unknown;
        try { state = typeof payload === "string" ? JSON.parse(payload) : payload; }
        catch { return; }
        if (!Array.isArray(state) || state.some((entry) => !entry || !Number.isSafeInteger(entry.opponent) || !Number.isSafeInteger(entry.token) || typeof entry.name !== "string" || typeof entry.voted !== "boolean" || typeof entry.offered !== "boolean")) return;
        // Replace the callback as well as its title when a vote changes.
        remove();
        const before = fights.map((fight) => fight.opponent);
        fights = state;
        const now = new Set(fights.map((fight) => fight.opponent));
        for (const opponent of now) engage(opponent);
        const ended = before.filter((opponent) => !now.has(opponent));
        if (ended.length > 0) release(ended, "fim da luta");
        update();
    });
    Events.on(PRIORITY_EVENT, (payload) => {
        let state: unknown;
        try { state = typeof payload === "string" ? JSON.parse(payload) : payload; }
        catch { return; }
        const ids = (state as { ids?: unknown } | null)?.ids;
        const on = (state as { on?: unknown } | null)?.on === true;
        if (!Array.isArray(ids)) return;
        const next = new Set<number>(on ? ids.filter((id): id is number => Number.isSafeInteger(id)).slice(0, 64) : []);
        const before = npcFirst;
        npcFirst = next;
        for (const id of new Set([...before, ...next])) refresh(id);
    });
    // `/paz` with no fight left on the server: the bodies around are let go of all the same.
    Events.on(RELEASE_EVENT, (payload) => {
        let request: unknown;
        try { request = typeof payload === "string" ? JSON.parse(payload) : payload; }
        catch { return; }
        const opponents = (request as { opponents?: unknown } | null)?.opponents;
        if (!Array.isArray(opponents)) return;
        release(opponents.filter((id): id is number => Number.isSafeInteger(id)).slice(0, 64), "/paz");
    });
    const timer = setInterval(update, 100);
    Events.on("resourceStop", (name) => {
        if (name !== "kcdc-gamemode") return;
        clearInterval(timer);
        remove();
        if (report !== undefined) clearTimeout(report);
        const everyone = new Set([...released.keys(), ...npcFirst]);
        for (const pending of released.values()) clearTimeout(pending);
        released.clear();
        npcFirst = new Set();
        for (const opponent of everyone) targetable(opponent, true);
    });
    Events.emitServer("kcdc-gamemode:combat.sync");
}
