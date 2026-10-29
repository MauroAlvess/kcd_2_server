/**
 * Food spoils (user, 2026-10-19: "existe algum sistema que estraga as comidas ativo no servidor? se não, ative-o"). The game gives
 * each food a time to spoil (`DecayTime`: hours of game time from fresh to nothing; `food-decay-data.ts`, made from its tables)
 * and counts it spoiled below a fifth of its condition, when eating it makes one sick (the game's own effect, when it is eaten).
 * The multiplayer server keeps every item's condition itself and never lowers it -- all 101 foods in the saved characters were at
 * 100% on 2026-10-19 -- so this does: every minute, the food a player carries loses the share of its condition that the game time
 * gone by takes from it.
 *
 * - Only what a player in the world carries spoils, and as fast as the world's clock turns (`World.day`, `World.hour`): nothing
 *   spoils in the bags of somebody away, nor in chests.
 * - Dried, smoked and salted food, and the drinks that keep, never spoil (their DecayTime is 0); cooking, drying and smoking give
 *   a new row, fresh.
 * - A food that turns spoiled is told to its owner, once.
 */

import { FOOD_DECAY, SPOILED_BELOW } from "./food-decay-data.js";
import { itemLine } from "./item-names.js";

const RESOURCE = "kcdc-gamemode";

export const spoilage = {
    enabled: true,
    tickMs: 60_000,
    /** A jump of the clock bigger than this (set by hand, or a long stall) spoils no more than this many game hours. */
    maxStepHours: 3,
    /** A condition is written in steps no smaller than this; what is less waits for the next minutes. */
    stepCondition: 0.01,
};

/** How long a food takes to spoil, in game hours, by its class GUID; undefined for what never spoils. */
export function decayHours(item: string): number | undefined {
    return FOOD_DECAY[item.toLowerCase()]?.[1];
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

export class Spoilage {
    private lastHours: number | null = null;
    /** Condition owed by each row and not written yet, by `steamId:rowId`. */
    private readonly owed = new Map<string, number>();

    constructor(private readonly clock: () => number = () => World.day * 24 + World.hour) {}

    /** Spoils the food of the players in the world by the game time gone since the last look. How many rows changed. */
    tick(players: readonly Player[] = Player.all()): number {
        const now = this.clock();
        const elapsed = this.lastHours === null ? 0 : now - this.lastHours;
        this.lastHours = now;
        if (!spoilage.enabled || !(elapsed > 0)) {
            return 0;
        }
        const hours = Math.min(elapsed, spoilage.maxStepHours);
        const seen = new Set<string>();
        let changed = 0;
        for (const player of players) {
            if (!player.ready || !player.alive || player.steamId === "") {
                continue;
            }
            for (const row of Inventory.get(player)?.items ?? []) {
                const decay = decayHours(row.item);
                if (decay === undefined) {
                    continue;
                }
                const key = `${player.steamId}:${row.id}`;
                seen.add(key);
                const condition = Number.isFinite(row.condition) ? row.condition : Number(row.metadata["condition"] ?? 1);
                if (!(condition > 0)) {
                    continue;
                }
                const owed = (this.owed.get(key) ?? 0) + hours / decay;
                if (owed < spoilage.stepCondition) {
                    this.owed.set(key, owed);
                    continue;
                }
                this.owed.delete(key);
                const next = Math.max(0, Math.round((condition - owed) * 1000) / 1000);
                // The condition alone: an absolute health beside it would disagree with it.
                const metadata: Record<string, unknown> = { ...row.metadata, condition: next };
                delete metadata["health"];
                const result = Inventory.setProperties(player, { id: row.id, metadata });
                if (!result.ok) {
                    continue;
                }
                changed += 1;
                if (condition >= SPOILED_BELOW && next < SPOILED_BELOW) {
                    tell(player, `Estragou: ${itemLine({ item: row.item, amount: row.amount, name: row.name, metadata: row.metadata })}. Comer comida estragada faz mal.`);
                }
            }
        }
        for (const key of [...this.owed.keys()]) {
            if (!seen.has(key)) {
                this.owed.delete(key);
            }
        }
        return changed;
    }
}

export const spoiling = new Spoilage();

export function installSpoilage(): void {
    const timer = setInterval(() => {
        try {
            spoiling.tick();
        } catch (error: unknown) {
            console.log(`spoilage: a comida não pôde ser olhada: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, spoilage.tickMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`spoilage: ${Object.keys(FOOD_DECAY).length} comidas estragam com o tempo do jogo (carne crua em cerca de ${Math.round(36 * (1 - SPOILED_BELOW))} horas de jogo); só o que está com quem está no mundo`);
}
