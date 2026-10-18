/**
 * The "alforjes" of a horse: its saddlebags, kept by the server (user, 2026-10-17: "os cavalos estão surgindo com itens em
 * seus inventários, mas os jogadores não conseguem retirá-los ... nem transferir itens do jogador para o cavalo").
 *
 * The framework gives a script no way to read or write a horse's inventory (`Inventory` takes a player or an NPC), so what the
 * game's own saddlebag screen shows is the game's alone: it is not replicated, nobody can take it, and nothing put in
 * it is kept. The horse's storage is therefore this one. The owner opens it from the panel's
 * "Animais" section, or with `/alforje`, standing within a few metres of the horse: a virtual stash is filled with what
 * the horse carries and shown on the game's own transfer screen, so taking things out and putting things in work the way
 * they do at a chest. Every change is written to the horse's record (`horses.ts`, `bags`) at once, and when the screen
 * closes the stash goes. One screen at a time per horse and per player.
 *
 * A horse that dies is lost, as in the game, and what its alforjes held is given back to its owner if they are in the
 * world and have room, and left on the ground where it fell otherwise.
 */

import { bagsOf, cleanBags, horseLost, horsesOf, recordOf, saveBags } from "./horses.js";
import type { BagRow, OwnedHorse } from "./horses.js";

/** How near the horse the owner must stand to open its alforjes, in metres. */
export const BAG_REACH_M = 8;

interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

interface Session {
    readonly key: string;
    readonly playerId: number;
    readonly stash: Stash;
}

const byStash = new Map<number, Session>();
const byKey = new Map<string, Session>();
const byPlayer = new Map<number, Session>();

function rowsOf(stash: Stash): BagRow[] {
    const state = stash.getInventory();
    return state === null ? [] : cleanBags(state.items.map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: { ...row.metadata } })));
}

/** Fills a container with rows, as they are; once more without their identities when it refuses them. */
function fill(stash: Stash, rows: readonly BagRow[]): boolean {
    const first = stash.setInventory({ items: rows.map((row) => ({ ...row })) });
    return first.ok || stash.setInventory({ items: rows.map(({ item, amount, metadata }) => ({ item, amount, ...(metadata === undefined ? {} : { metadata }) })) }).ok;
}

function labelOf(owned: OwnedHorse): string {
    return owned.horse?.name || owned.record.name || "Seu cavalo";
}

/** The distance on the ground from the player to a horse. */
function distanceTo(player: Player, horse: Horse): number {
    return Math.hypot(horse.position.x - player.position.x, horse.position.y - player.position.y);
}

/** Which of the player's horses is meant: the one with this key, else the nearest of them that is in the world and alive. */
export function horseFor(player: Player, key: string | null): OwnedHorse | null {
    const mine = horsesOf(player.steamId).filter((owned) => owned.horse !== null && owned.horse.alive && (key === null || owned.record.key === key));
    mine.sort((a, b) => distanceTo(player, a.horse as Horse) - distanceTo(player, b.horse as Horse));
    return mine[0] ?? null;
}

/** Opens the alforjes of a horse of the player's on the transfer screen. */
export function openBags(player: Player, key: string | null): Outcome {
    if (!player.ready || !player.alive) {
        return { ok: false, message: "Você não pode abrir as alforjes agora." };
    }
    if (byPlayer.has(player.id)) {
        return { ok: false, message: "Você já está com um inventário aberto." };
    }
    const owned = horseFor(player, key);
    if (owned === null || owned.horse === null) {
        return { ok: false, message: key === null ? "Você não tem um cavalo por perto." : "Esse cavalo não está no mundo agora." };
    }
    const label = labelOf(owned);
    if (!owned.horse.alive) {
        return { ok: false, message: `${label} está morto.` };
    }
    if (distanceTo(player, owned.horse) > BAG_REACH_M) {
        return { ok: false, message: `${label} está longe demais: chegue a menos de ${BAG_REACH_M} m dele para abrir as alforjes.` };
    }
    if (owned.horse.rider !== null) {
        return { ok: false, message: `${label} está montado: desça antes de abrir as alforjes.` };
    }
    if (byKey.has(owned.record.key)) {
        return { ok: false, message: `As alforjes de ${label} já estão abertas.` };
    }
    const stash = Stash.createVirtual(player.virtualWorld);
    if (!fill(stash, bagsOf(owned.record.key))) {
        stash.destroy();
        return { ok: false, message: `As alforjes de ${label} não puderam ser abertas.` };
    }
    const session: Session = { key: owned.record.key, playerId: player.id, stash };
    byStash.set(stash.id, session);
    byKey.set(session.key, session);
    byPlayer.set(player.id, session);
    if (!stash.open(player)) {
        end(session);
        return { ok: false, message: "O jogo não abriu as alforjes agora. Tente de novo." };
    }
    return { ok: true, message: `Alforjes de ${label}: o que você deixar aqui fica com o cavalo.` };
}

/** Writes what the screen holds into the horse's record. */
function sync(session: Session): void {
    saveBags(session.key, rowsOf(session.stash));
}

function end(session: Session): void {
    sync(session);
    byStash.delete(session.stash.id);
    byKey.delete(session.key);
    byPlayer.delete(session.playerId);
    const stash = session.stash;
    // On the next tick, so every other handler of this event still finds the stash.
    setTimeout(() => stash.destroy(), 0);
}

/** What a dead horse's alforjes held: to the owner's pockets if they are in the world and have room, else to the ground where it fell. */
export function rescue(record: { readonly key: string; readonly owner: string; readonly bags?: readonly BagRow[]; readonly x: number; readonly y: number; readonly z: number }, horse: Horse | null): number {
    const rows = record.bags ?? [];
    if (rows.length === 0) {
        return 0;
    }
    const owner = Player.all().find((player) => player.steamId === record.owner && player.ready) ?? null;
    let moved = 0;
    for (const row of rows) {
        const kept = owner !== null && Inventory.add(owner, { item: row.item, amount: row.amount, ...(row.metadata === undefined ? {} : { metadata: row.metadata }) }).ok;
        if (!kept) {
            try {
                GroundItem.spawn(row.item, { x: horse?.position.x ?? record.x, y: horse?.position.y ?? record.y, z: horse?.position.z ?? record.z }, undefined, row.amount, horse?.virtualWorld);
            } catch {
                continue;
            }
        }
        moved += 1;
    }
    if (owner !== null) {
        Chat.sendToPlayer(owner, "O cavalo morreu; o que ele levava nas alforjes foi para os seus bolsos ou ficou no chão onde ele caiu.");
    }
    return moved;
}

export function installHorseBags(): void {
    Events.on("stashInventoryChanged", (stash) => {
        const session = byStash.get(stash.id);
        if (session !== undefined) {
            sync(session);
        }
    });
    Events.on("stashClose", (stash) => {
        const session = byStash.get(stash.id);
        if (session !== undefined) {
            end(session);
        }
    });
    Events.on("stashDestroy", (stash) => {
        const session = byStash.get(stash.id);
        if (session !== undefined) {
            byStash.delete(stash.id);
            byKey.delete(session.key);
            byPlayer.delete(session.playerId);
        }
    });
    Events.on("playerDisconnect", (player) => {
        const session = byPlayer.get(player.id);
        if (session !== undefined) {
            end(session);
        }
    });
    horseLost.push((record, horse) => {
        const open = byKey.get(record.key);
        if (open !== undefined) {
            sync(open);
            end(open);
        }
        const fresh = recordOf(record.key);
        rescue(fresh ?? record, horse);
    });
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            for (const session of [...byStash.values()]) {
                sync(session);
            }
        }
    });
}
