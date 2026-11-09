const STATE_EVENT = "kcdc-gamemode:combat.state";
const VOTE_EVENT = "kcdc-gamemode:combat.vote";
/** The client keeps the bodies it names out of its combat lock-on for a few seconds (`src/client/combat.ts`). */
const RELEASE_EVENT = "kcdc-gamemode:combat.release";
/** What a client's hands and menus look like a moment after a release, for the log. */
const AFTER_EVENT = "kcdc-gamemode:combat.after";

/** Resource policy, in milliseconds. Zero disables inactivity cancellation. */
export const COMBAT_TIMEOUT_MS = 45_000;

/**
 * Peace offered (U held) and no blow since: the fight ends this long after, without the other's hold (2026-10-19: Radovan
 * offered peace, Veckks22 never held U back, and neither could open the map or the inventory until they left). Zero disables.
 */
export const PEACE_QUIET_MS = 5_000;

/** `/paz` ends a fight once this long has passed without a blow, so it is no escape from the middle of an exchange. */
export const PAZ_QUIET_MS = 5_000;

/**
 * `/paz` with no fight left on the server: the players this close are let go of by the lock-on of whoever typed it, for a few
 * seconds (2026-10-19: the fights had all ended on the server, yet Radovan's map and inventory stayed shut until he left).
 */
export const PAZ_RELEASE_M = 30;

/** At most one client report a player is logged for in this long. */
const REPORT_EVERY_MS = 2_000;

/** What `/paz` does: set by `installCombat`. */
let makePeace: (player: Player) => { ended: string[]; busy: string[] } = () => ({ ended: [], busy: [] });
let releaseNear: (player: Player) => number = () => 0;
let endBetween: (first: Player, second: Player, why: string) => void = () => undefined;

/**
 * Ends the fight between these two at once, whatever its age (a duel that is over, `duel.ts`): the game lets go of their lock-on
 * and retires the blows in the air. Nothing happens when the server knows of no fight between them.
 */
export function endFightBetween(first: Player, second: Player, why: string): void {
    endBetween(first, second, why);
}

/** Ends every fight of `player` that has been quiet for `PAZ_QUIET_MS`: the opponents' names, and those still exchanging blows. */
export function endQuietFights(player: Player): { ended: string[]; busy: string[] } {
    return makePeace(player);
}

/** Asks `player`'s client to let go of every player within `PAZ_RELEASE_M` for a few seconds: how many it named. */
export function releaseNearby(player: Player): number {
    return releaseNear(player);
}

interface Fight {
    first: Player;
    second: Player;
    world: number;
    token: number;
    lastAttack: number;
    votes: Set<number>;
    /** When the first of the two offered peace, 0 while nobody has. */
    offeredAt: number;
}

/** The server negotiates; clients can only vote on a fight it already knows. */
export function installCombat(timeoutMs = COMBAT_TIMEOUT_MS, peaceQuietMs = PEACE_QUIET_MS): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("Combat timeout must be non-negative; 0 disables it.");
    const fights = new Map<string, Fight>();
    let nextToken = 1;
    const key = (first: Player, second: Player): string => `${Math.min(first.id, second.id)}:${Math.max(first.id, second.id)}`;
    const eligible = (fight: Fight): boolean => [fight.first, fight.second].every((player) => player.ready && player.canAct && player.virtualWorld === fight.world);
    const publish = (player: Player): void => {
        if (!player.ready) return;
        const state = [...fights.values()].filter((fight) => fight.first.id === player.id || fight.second.id === player.id).map((fight) => {
            const other = fight.first.id === player.id ? fight.second : fight.first;
            return { opponent: other.id, name: other.nickname, token: fight.token, voted: fight.votes.has(player.id), offered: fight.votes.has(other.id) };
        });
        player.emit(STATE_EVENT, JSON.stringify(state));
    };
    const remove = (fight: Fight): void => {
        if (!fights.delete(key(fight.first, fight.second))) return;
        publish(fight.first);
        publish(fight.second);
    };
    const end = (fight: Fight, why: string): void => {
        // cancelCombat also raises playerCombatCancelled when another resource calls it.
        const sent = fight.first.cancelCombat(fight.second);
        console.log(`combat: a luta de ${fight.first.nickname} e ${fight.second.nickname} acabou (${why})${sent ? "" : "; o fim não pôde ser mandado a eles"}`);
        remove(fight);
    };
    const forget = (player: Player, why: string): void => {
        for (const fight of [...fights.values()]) {
            if (fight.first.id === player.id || fight.second.id === player.id) end(fight, why);
        }
    };
    makePeace = (player) => {
        const now = Date.now();
        const ended: string[] = [];
        const busy: string[] = [];
        for (const fight of [...fights.values()]) {
            if (fight.first.id !== player.id && fight.second.id !== player.id) continue;
            const other = fight.first.id === player.id ? fight.second : fight.first;
            if (now - fight.lastAttack < PAZ_QUIET_MS) {
                busy.push(other.nickname);
                continue;
            }
            end(fight, `/paz de ${player.nickname}`);
            ended.push(other.nickname);
        }
        return { ended, busy };
    };
    endBetween = (first, second, why) => {
        const fight = fights.get(key(first, second));
        if (fight) end(fight, why);
    };
    releaseNear = (player) => {
        if (!player.ready) return 0;
        const here = player.position;
        const ids = Player.all()
            .filter((other) => other.id !== player.id && other.ready && other.virtualWorld === player.virtualWorld
                && Math.hypot(other.position.x - here.x, other.position.y - here.y, other.position.z - here.z) <= PAZ_RELEASE_M)
            .map((other) => other.id);
        player.emit(RELEASE_EVENT, JSON.stringify({ opponents: ids }));
        console.log(`combat: ${player.nickname} usou /paz sem luta; ${ids.length} jogador(es) por perto saem da mira dele por alguns segundos`);
        return ids.length;
    };
    const reported = new Map<number, number>();
    Events.onClient(AFTER_EVENT, (sender, payload) => {
        const player = sender as Player;
        const now = Date.now();
        if (now - (reported.get(player.id) ?? -Infinity) < REPORT_EVERY_MS) return;
        let report: unknown;
        try { report = typeof payload === "string" ? payload.length <= 512 ? JSON.parse(payload) : null : payload; }
        catch { return; }
        if (!report || typeof report !== "object") return;
        reported.set(player.id, now);
        const { why, fistsUp, guard, right, left, inventory, map } = report as Record<string, unknown>;
        const hand = (value: unknown): string => typeof value === "string" && /^[0-9a-f]{32}$/i.test(value) ? `com algo (${value.slice(0, 8)})` : "vazia";
        const menu = (value: unknown): string => value === false ? "fechado por um recurso" : "permitido";
        console.log(`combat: depois da paz (${String(why).slice(0, 20)}), ${player.nickname}: mão direita ${hand(right)}, esquerda ${hand(left)}, punhos ${fistsUp === true ? "erguidos" : "baixos"}, guarda ${Number(guard)}; inventário ${menu(inventory)}, mapa ${menu(map)}`);
    });
    const attack = (first: Player, second: Player): void => {
        if (first.id === second.id) return;
        let fight = fights.get(key(first, second));
        if (!fight) {
            fight = { first, second, world: first.virtualWorld, token: 0, lastAttack: 0, votes: new Set(), offeredAt: 0 };
            console.log(`combat: ${first.nickname} e ${second.nickname} começaram a lutar`);
        }
        if (!eligible(fight)) { remove(fight); return; }
        fight.lastAttack = Date.now();
        fight.token = nextToken++;
        fight.votes.clear();
        fight.offeredAt = 0;
        fights.set(key(first, second), fight);
        publish(first);
        publish(second);
    };
    Events.on("playerAttack", attack);
    // A contact can name a different victim from the swing's original target.
    Events.on("playerHit", (victim, attacker, hit) => { if (hit.source === "melee" && "nickname" in attacker) attack(attacker, victim); });
    Events.on("playerCombatCancelled", (first, second) => {
        const fight = fights.get(key(first, second));
        if (fight) remove(fight);
    });
    Events.on("playerDisconnect", (player) => { reported.delete(player.id); forget(player, `${player.nickname} saiu`); });
    Events.on("playerDied", (player) => forget(player, `${player.nickname} caiu`));
    Events.on("playerSpawning", (player) => forget(player, `${player.nickname} foi levado a outro lugar`));
    Events.onClient("kcdc-gamemode:combat.sync", (sender) => publish(sender as Player));
    Events.onClient(VOTE_EVENT, (sender, payload) => {
        const player = sender as Player;
        let request: unknown;
        try { request = typeof payload === "string" ? payload.length <= 128 ? JSON.parse(payload) : null : payload; }
        catch { return; }
        if (!request || typeof request !== "object") return;
        const { opponent, token } = request as { opponent?: unknown; token?: unknown };
        if (!Number.isSafeInteger(opponent) || !Number.isSafeInteger(token)) return;
        const fight = [...fights.values()].find((fight) => fight.token === token &&
            ((fight.first.id === player.id && fight.second.id === opponent) || (fight.second.id === player.id && fight.first.id === opponent)));
        if (!fight) {
            // An accept sent for an offer a blow had already replaced (2026-10-19: "ele tinha aceitado, o sistema entende que recusou").
            const pair = [...fights.values()].find((candidate) => (candidate.first.id === player.id && candidate.second.id === opponent) || (candidate.second.id === player.id && candidate.first.id === opponent));
            if (pair !== undefined) console.log(`combat: ${player.nickname} segurou U por um pedido de paz que um golpe já tinha trocado (luta de ${pair.first.nickname} e ${pair.second.nickname}); o pedido novo foi mostrado de novo`);
            publish(player);
            return;
        }
        if (!eligible(fight)) { end(fight, "um dos dois não podia mais lutar"); return; }
        fight.votes.add(player.id);
        if (fight.votes.size === 2) end(fight, "os dois aceitaram a paz");
        else {
            if (fight.offeredAt === 0) fight.offeredAt = Date.now();
            console.log(`combat: ${player.nickname} ofereceu paz na luta de ${fight.first.nickname} e ${fight.second.nickname}`);
            publish(fight.first);
            publish(fight.second);
        }
    });
    const timer = setInterval(() => {
        const now = Date.now();
        for (const fight of [...fights.values()]) {
            if (!eligible(fight)) end(fight, "um dos dois não podia mais lutar");
            else if (timeoutMs > 0 && now - fight.lastAttack >= timeoutMs) end(fight, `${Math.round(timeoutMs / 1000)} s sem golpes`);
            else if (peaceQuietMs > 0 && fight.offeredAt > 0 && now - Math.max(fight.offeredAt, fight.lastAttack) >= peaceQuietMs) end(fight, `paz oferecida e ${Math.round(peaceQuietMs / 1000)} s sem golpes`);
        }
    }, 250);
    Events.on("resourceStop", (name) => {
        if (name !== "kcdc-gamemode") return;
        clearInterval(timer);
        for (const fight of [...fights.values()]) end(fight, "o recurso parou");
    });
}
