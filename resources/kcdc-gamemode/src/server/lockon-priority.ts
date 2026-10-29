/**
 * Who the combat lock-on picks first (user, 2026-10-25: "se formos lutar, se tiver player e bandido, o fixar na luta foca os jogadores como prioridade; o
 * correto deve ser os NPCs primeiro e só depois player"). The game's lock-on and the opponent picker choose among every body in front of the player,
 * players included, and the framework gives a client one control over that: `Player.setTargetable(false)` keeps a player's body out of THAT client's
 * picker (`src/client/combat.ts`). So the order is made by taking the players out while an enemy NPC is about, and letting them back in once none is.
 *
 * The enemy NPCs are the ones this resource sets on people: the camps' bandits, the gangs of the roads (highwaymen, Cumans) and the animals that hunt
 * (wolves, wild dogs). Once a second the server looks at each ready player: within `nearM` of one of them, "NPCs first" is on for that player's client,
 * which is told, with the ids of the players round it (`playersM`); it stays on until none has been within `farM` for `holdMs`, so a bandit running round a
 * tree does not make the lock-on flicker. Only a change is sent. A player's own swing is never stopped: this only decides what the lock-on offers.
 */

const EVENT = "kcdc-gamemode:combat.priority";

export const lockOnPriority = {
    /** How often each player is looked at. */
    everyMs: 1_000,
    /** An enemy NPC this near turns "NPCs first" on. */
    nearM: 28,
    /** And it stays on while one is within this, and for `holdMs` after the last. */
    farM: 40,
    holdMs: 4_000,
    /** The players this near are the ones the client is told to keep out of its lock-on. */
    playersM: 80,
};

/** Where the enemy NPCs' bodies are: each source gives the ids of the bodies it keeps alive. */
export type HostileSource = () => Iterable<number>;

interface State {
    on: boolean;
    until: number;
    /** What was last sent, so that only a change is. */
    sent: string;
}

const states = new Map<number, State>();

/** Match MafiaNet visibility: the global world sees and is seen by every world. */
const worldsOverlap = (a: number, b: number): boolean => a === b || a === 0xFFFFFFFF || b === 0xFFFFFFFF;

/** Whether "NPCs first" is on after a look at `nearest` metres from the closest enemy NPC (Infinity for none), and until when. */
export function decide(state: { on: boolean; until: number }, nearest: number, now: number, settings = lockOnPriority): { on: boolean; until: number } {
    if (nearest <= settings.nearM) {
        return { on: true, until: now + settings.holdMs };
    }
    if (state.on && nearest <= settings.farM) {
        return { on: true, until: now + settings.holdMs };
    }
    if (state.on && now < state.until) {
        return state;
    }
    return { on: false, until: 0 };
}

export function installLockOnPriority(sources: readonly HostileSource[]): void {
    const look = (): void => {
        const now = Date.now();
        const players = Player.all().filter((player) => player.ready);
        if (players.length === 0) {
            return;
        }
        // Every place is copied into plain numbers once: each `.x` of an engine's vector is a call into the engine, and the loops below measured every enemy
        // against every player (6 of those reads a pair: 10 ms a second at thirty players, 2026-10-28, worse than before the round of the 27th that meant to cut it).
        const seen = players.map((player) => {
            const at = player.position;
            return { player, at: { x: at.x, y: at.y, z: at.z }, world: player.virtualWorld };
        });
        // An enemy decides nothing unless it is within `farM` of somebody (`decide` compares the nearest with `nearM` and `farM` only), so its life and
        // its world are asked of the engine for those alone (2026-10-27). The answer is the same.
        const hostile: Array<{ x: number; y: number; z: number; world: number }> = [];
        for (const source of sources) {
            for (const id of source()) {
                const npc = Npc.getById(id);
                if (npc === null) {
                    continue;
                }
                const place = npc.position;
                const x = place.x;
                const y = place.y;
                const z = place.z;
                if (!seen.some((one) => Math.hypot(one.at.x - x, one.at.y - y, one.at.z - z) <= lockOnPriority.farM) || !npc.alive) {
                    continue;
                }
                hostile.push({ x, y, z, world: npc.virtualWorld });
            }
        }
        for (const { player, at, world } of seen) {
            let nearest = Infinity;
            for (const enemy of hostile) {
                if (worldsOverlap(enemy.world, world)) {
                    const distance = Math.hypot(enemy.x - at.x, enemy.y - at.y, enemy.z - at.z);
                    if (distance < nearest) {
                        nearest = distance;
                    }
                }
            }
            // A player never told anything is as the client starts: nobody kept out, so "off" is not worth saying first.
            const state = states.get(player.id) ?? { on: false, until: 0, sent: "0|" };
            const next = decide(state, nearest, now);
            state.on = next.on;
            state.until = next.until;
            const ids = state.on
                ? seen.filter((other) => other.player.id !== player.id && worldsOverlap(other.world, world) && Math.hypot(other.at.x - at.x, other.at.y - at.y, other.at.z - at.z) <= lockOnPriority.playersM).map((other) => other.player.id).sort((a, b) => a - b)
                : [];
            const key = `${state.on ? 1 : 0}|${ids.join(",")}`;
            if (key !== state.sent) {
                state.sent = key;
                try {
                    player.emit(EVENT, JSON.stringify({ on: state.on, ids }));
                } catch {
                    // Gone since the look.
                }
            }
            states.set(player.id, state);
        }
    };
    const timer = setInterval(look, lockOnPriority.everyMs);
    Events.on("playerDisconnect", (player) => {
        states.delete(player.id);
    });
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(timer);
            states.clear();
        }
    });
    console.log(`combat: o alvo fixado prefere os NPCs inimigos aos jogadores (a menos de ${lockOnPriority.nearM} m de um bandido, de uma emboscada ou de um lobo)`);
}
