/**
 * Trading between two players, on the trades' page (`ui/craft.html`, on the right of the screen: user, 2026-10-18, "no trade
 * entre jogadores vamos usar a nossa HUD personalizada de ofício: clicou em negociar, aceitou, aparece na direita").
 *
 * KCD2 has no screen for two players to barter on, so each side gets an offer: a virtual container
 * (`Stash.createVirtual`) its owner fills from their own inventory on the game's transfer screen. Money is one of the things that
 * screen moves (the Groschen are an item of the inventory), so the page has no field for it (user, 2026-10-21: "não precisa estar
 * na tela personalizada, a tela do vanilla já tem como passar dinheiro"). The page shows both offers, each item with the game's own
 * icon, and has the buttons: change my items, accept, cancel (Esc too). It was the game's dialogue list until 2026-10-18. Any change
 * to either offer takes both acceptances back, so nobody accepts one deal and gets another. When both have accepted, the items cross
 * over; anything the other side cannot carry goes back to whoever offered it. A cancelled trade gives every item back.
 *
 * Items in an offer are out of their owner's inventory, so they are written down (`playerdata/escrow.json`) for as long
 * as they are there, and anything that could not be handed back (a full inventory, a player who left, a restart in the
 * middle of a trade) is given back the next time its owner's inventory is ready.
 */

import { labelFor } from "./acquaintances.js";
import { emitLarge } from "./big-emit.js";
import { craftTitle } from "./craft-titles.js";
import { onRestartSettle, restartPending } from "./restart-notice.js";
import { addUnits, addUnitsToStash } from "./inventory-add.js";
import { iconOf } from "./item-icons.js";
import { itemName } from "./item-names.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/escrow.json`;

/** How far apart the two may stand while trading. */
export const TRADE_REACH_M = 8;
/** A trade nobody touches for this long is called off. */
export const TRADE_IDLE_MS = 10 * 60_000;
const TICK_MS = 2_000;

export interface EscrowRow {
    item: string;
    amount: number;
    metadata: Record<string, unknown>;
}

/** The page comes back this long after the transfer screen has closed, once the game has put that screen away. */
export const REOPEN_AFTER_SCREEN_MS = 700;
/** The transfer screen opens this long after the page is put away: the game's screen and ours do not open in one frame. */
export const SCREEN_AFTER_PAGE_MS = 250;
/**
 * The transfer screen moves an offer one row at a time, and each move raised the container's change event, which read both containers again, wrote the escrow
 * file and sent both pages with the icon of every item: seven rows were seven rounds (574 ms in one, 2026-10-26, perf-watch). A burst of changes is now
 * drawn once, this long after the last; the acceptances go at once, and an accept pressed while the page is behind is not taken (the other could be accepting
 * what is no longer on the table).
 */
export const TRADE_REFRESH_MS = 250;

/** What sends a page's data: the trade's view, and the word to put it away or end it. Tests give their own. */
export type Send = (player: Player, name: string, json: string) => void;

interface Side {
    readonly player: Player;
    readonly steamId: string;
    readonly stash: Stash;
    accepted: boolean;
    /** The side has its container open on the transfer screen (or it is about to open): the page is put away meanwhile. */
    editing: boolean;
    /** The page is waiting to come back after the transfer screen; nothing puts it up before its time. */
    waiting: boolean;
    /** The title image went with a page of this trade already: the page keeps it. */
    titled: boolean;
}

interface Trade {
    readonly id: number;
    readonly sides: [Side, Side];
    lastActivity: number;
    done: boolean;
    /** Items are being moved out of the offers by this module: their containers' change events are its own. */
    settling: boolean;
    /** The sides whose offers changed since the pages were last drawn, and whether the drawing is waiting for its time. */
    readonly dirty: Set<Side>;
    refreshing: boolean;
}

/** A copy of what a container holds: the rows are read before anything is moved, never through a live list. */
function rowsOf(stash: Stash): InventoryRow[] {
    try {
        return (stash.getInventory()?.items ?? []).map((row) => ({ ...row, metadata: { ...row.metadata } }));
    } catch {
        return [];
    }
}

function escrowRows(rows: readonly InventoryRow[]): EscrowRow[] {
    return rows.map((row) => ({ item: row.item, amount: row.amount, metadata: { ...row.metadata } }));
}

/** Tells a player something on the game's own notification line, and keeps it in the chat. */
function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

export class Trades {
    private readonly byPlayer = new Map<number, Trade>();
    private readonly byStash = new Map<number, Side>();
    /** Items owed back to players who could not take them when a trade ended, by Steam id. */
    private owed: Record<string, EscrowRow[]> = {};
    /** What each trading player has in their offer right now, by Steam id: what a crash would cost them. */
    private held: Record<string, EscrowRow[]> = {};
    private nextId = 1;

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly later: (fn: () => void, ms: number) => void = (fn, ms) => {
            setTimeout(fn, ms);
        },
        private readonly send: Send = (player, name, json) => {
            if (name === "trade.view") {
                emitLarge(player, name, json);
            } else {
                player.emit(`${RESOURCE}:${name}`, json);
            }
        },
    ) {}

    // -----------------------------------------------------------------------------------------
    // The escrow file.

    load(): void {
        const loaded = read<{ owed?: unknown; held?: unknown }>(FILE);
        if (loaded.status !== "ok") {
            return;
        }
        const pick = (raw: unknown): Record<string, EscrowRow[]> => {
            const out: Record<string, EscrowRow[]> = {};
            if (typeof raw !== "object" || raw === null) {
                return out;
            }
            for (const [steamId, rows] of Object.entries(raw as Record<string, unknown>)) {
                if (!Array.isArray(rows)) {
                    continue;
                }
                const valid = rows.filter((row): row is EscrowRow => typeof row === "object" && row !== null && typeof (row as EscrowRow).item === "string" && typeof (row as EscrowRow).amount === "number" && (row as EscrowRow).amount > 0);
                if (valid.length > 0) {
                    out[steamId] = valid.map((row) => ({ item: row.item, amount: row.amount, metadata: typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {} }));
                }
            }
            return out;
        };
        this.owed = pick(loaded.value.owed);
        // What was in an offer when the server stopped is owed back: the containers are gone.
        for (const [steamId, rows] of Object.entries(pick(loaded.value.held))) {
            this.owed[steamId] = [...(this.owed[steamId] ?? []), ...rows];
        }
        this.held = {};
        this.persist();
    }

    private persist(): void {
        try {
            ensureDir(DIR);
            write(FILE, { owed: this.owed, held: this.held });
        } catch (error: unknown) {
            console.log(`trade: não consegui salvar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private remember(side: Side): void {
        const rows = escrowRows(rowsOf(side.stash));
        if (rows.length > 0) {
            this.held[side.steamId] = rows;
        } else {
            delete this.held[side.steamId];
        }
        this.persist();
    }

    private owe(steamId: string, rows: readonly EscrowRow[]): void {
        if (rows.length === 0 || steamId === "") {
            return;
        }
        this.owed[steamId] = [...(this.owed[steamId] ?? []), ...rows];
        this.persist();
    }

    /** Hands a player back whatever a trade owes them. Called when their inventory is ready. */
    deliver(player: Player): number {
        const rows = this.owed[player.steamId];
        if (rows === undefined) {
            return 0;
        }
        const left: EscrowRow[] = [];
        let given = 0;
        for (const row of rows) {
            if (addUnits(player, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
                given += 1;
            } else {
                left.push(row);
            }
        }
        if (left.length > 0) {
            this.owed[player.steamId] = left;
        } else {
            delete this.owed[player.steamId];
        }
        this.persist();
        if (given > 0) {
            tell(player, left.length > 0 ? "Parte do que estava numa troca voltou para você; o resto volta quando houver espaço." : "O que estava numa troca desfeita voltou para o seu inventário.");
        }
        return given;
    }

    owes(steamId: string): readonly EscrowRow[] {
        return this.owed[steamId] ?? [];
    }

    // -----------------------------------------------------------------------------------------
    // Items, moved out of an offer.

    /** Moves every row of a side's offer to `to`. A row the target cannot take stays in the offer. */
    private moveAll(side: Side, to: Player): number {
        let moved = 0;
        for (const row of rowsOf(side.stash)) {
            // Out of the offer first and back in if it does not fit: an item can be in one place only.
            if (!side.stash.removeItem({ units: [{ id: row.id, amount: row.amount }] }).ok) {
                continue;
            }
            if (addUnits(to, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
                moved += 1;
            } else if (!addUnitsToStash(side.stash, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
                // Neither the target nor the offer would take it back: it is owed to whoever offered it.
                this.owe(side.steamId, escrowRows([row]));
            }
        }
        return moved;
    }

    /** Gives a side everything still in its offer; what does not fit is owed and given at their next entry. */
    private giveBack(side: Side): void {
        this.moveAll(side, side.player);
        const rows = rowsOf(side.stash);
        const left = escrowRows(rows);
        if (left.length > 0) {
            for (const row of rows) {
                side.stash.removeItem({ units: [{ id: row.id, amount: row.amount }] });
            }
            this.owe(side.steamId, left);
            tell(side.player, "Parte da sua oferta não coube no seu inventário; ela volta para você na próxima vez que entrar.");
        }
        delete this.held[side.steamId];
        this.persist();
    }

    // -----------------------------------------------------------------------------------------
    // Sessions.

    isTrading(player: Player): boolean {
        return this.byPlayer.has(player.id);
    }

    /** Opens a trade between two players who both agreed to it. False when it cannot start. */
    start(first: Player, second: Player): boolean {
        if (first.id === second.id || this.isTrading(first) || this.isTrading(second) || first.steamId === "" || second.steamId === "" || restartPending()) {
            return false;
        }
        const make = (player: Player): Side => ({
            player,
            steamId: player.steamId,
            stash: Stash.createVirtual(player.virtualWorld),
            accepted: false,
            editing: false,
            waiting: false,
            titled: false,
        });
        const trade: Trade = { id: this.nextId++, sides: [make(first), make(second)], lastActivity: this.now(), done: false, settling: false, dirty: new Set(), refreshing: false };
        for (const side of trade.sides) {
            this.byPlayer.set(side.player.id, trade);
            this.byStash.set(side.stash.id, side);
        }
        for (const side of trade.sides) {
            this.show(trade, side);
        }
        return !trade.done;
    }

    private other(trade: Trade, side: Side): Side {
        return trade.sides[0] === side ? trade.sides[1] : trade.sides[0];
    }

    /** What the page shows of one offer: each item with its name, how many and the game's icon (the money too, an item like the rest); whether it was accepted. */
    private offerOf(side: Side): Record<string, unknown> {
        return {
            items: rowsOf(side.stash).map((row) => ({ name: itemName(row), n: row.amount, icon: iconOf(row.item) })),
            accepted: side.accepted,
        };
    }

    /** What one side's page is sent: both offers and the other's name. */
    viewFor(trade: Trade, side: Side): Record<string, unknown> {
        const other = this.other(trade, side);
        return { mode: "trade", id: trade.id, partner: labelFor(side.player, other.player), mine: this.offerOf(side), theirs: this.offerOf(other) };
    }

    /** Puts the side's page up, or draws it again with what is on the table now. Not while their transfer screen is up. */
    private show(trade: Trade, side: Side): void {
        if (trade.done || side.editing || side.waiting) {
            return;
        }
        const view = this.viewFor(trade, side);
        // The title image ("NEGOCIAÇÃO", `data/craft-titles.json`) with the first page of the trade only: 15 KB, and the page keeps it.
        const img = side.titled ? "" : craftTitle("negociacao");
        side.titled = true;
        this.send(side.player, "trade.view", JSON.stringify(img === "" ? view : { ...view, img }));
    }

    /** Brings the page back `delay` after the transfer screen, with what is on the table by then. */
    private reopen(trade: Trade, side: Side, delay: number): void {
        side.waiting = true;
        this.later(() => {
            side.waiting = false;
            if (!trade.done && !side.editing) {
                this.show(trade, side);
            }
        }, delay);
    }

    /** Either offer changed: both acceptances go at once, and both pages say what is on the table a moment later, once for a burst of changes. */
    private changed(trade: Trade, side: Side): void {
        trade.lastActivity = this.now();
        const hadAccepted = trade.sides.some((each) => each.accepted);
        for (const each of trade.sides) {
            each.accepted = false;
        }
        if (hadAccepted) {
            for (const each of trade.sides) {
                tell(each.player, "A oferta mudou: os dois precisam aceitar de novo.");
            }
        }
        trade.dirty.add(side);
        if (trade.refreshing) {
            return;
        }
        trade.refreshing = true;
        this.later(() => this.refresh(trade), TRADE_REFRESH_MS);
    }

    /** The drawing a burst of changes waited for: the escrow of the offers that changed, and both pages as they are now. */
    private refresh(trade: Trade): void {
        trade.refreshing = false;
        const sides = [...trade.dirty];
        trade.dirty.clear();
        if (trade.done || trade.settling) {
            return;
        }
        for (const side of sides) {
            this.remember(side);
        }
        for (const each of trade.sides) {
            this.show(trade, each);
        }
    }

    /**
     * What a player did on their page: `items` (to the transfer screen), `accept` or `cancel` (the page's button, its X or Esc).
     */
    act(player: Player, action: string): void {
        const trade = this.byPlayer.get(player.id);
        if (trade === undefined || trade.done) {
            return;
        }
        const side = trade.sides[0].player.id === player.id ? trade.sides[0] : trade.sides[1];
        trade.lastActivity = this.now();

        if (action === "cancel") {
            this.cancel(trade, `${labelFor(this.other(trade, side).player, player)} cancelou a troca.`, side);
            return;
        }
        if (action === "items") {
            if (side.editing) {
                return;
            }
            side.editing = true;
            this.send(player, "trade.hide", "{}");
            this.later(() => {
                if (trade.done || !side.editing) {
                    return;
                }
                if (!side.stash.open(player)) {
                    side.editing = false;
                    tell(player, "Não consegui abrir a sua oferta agora.");
                    this.show(trade, side);
                }
            }, SCREEN_AFTER_PAGE_MS);
            return;
        }
        if (action === "accept") {
            if (side.accepted) {
                return;
            }
            // The offer has just changed and the pages are not drawn yet: what is on the table is not what this page shows.
            if (trade.refreshing) {
                tell(player, "A oferta acabou de mudar: confira a tela e aceite de novo.");
                return;
            }
            side.accepted = true;
            if (trade.sides.every((each) => each.accepted)) {
                this.complete(trade);
                return;
            }
            const other = this.other(trade, side);
            tell(other.player, `${labelFor(other.player, player)} aceitou a troca.`);
            for (const each of trade.sides) {
                this.show(trade, each);
            }
        }
    }

    /** Both accepted: what each put on the table crosses over. */
    private complete(trade: Trade): void {
        const [a, b] = trade.sides;
        trade.settling = true;
        const offered = trade.sides.map((side) => rowsOf(side.stash).length);
        this.moveAll(a, b.player);
        this.moveAll(b, a.player);
        const leftovers = trade.sides.some((side) => rowsOf(side.stash).length > 0);
        for (const side of trade.sides) {
            this.giveBack(side);
        }
        this.finish(trade);
        for (const side of trade.sides) {
            tell(side.player, leftovers ? "Troca feita. O que não coube no inventário do outro voltou para quem ofereceu." : "Troca feita.");
        }
        console.log(`trade: ${a.player.nickname} e ${b.player.nickname} trocaram (${offered[0]} item(ns) por ${offered[1]})`);
    }

    /** Calls a trade off: every item back to whoever offered it. `by` is the side that called it off, told nothing more. */
    cancel(trade: Trade, message: string, by?: Side): void {
        if (trade.done) {
            return;
        }
        trade.settling = true;
        for (const side of trade.sides) {
            this.giveBack(side);
        }
        this.finish(trade);
        for (const side of trade.sides) {
            tell(side.player, side === by ? "Você cancelou a troca. Seus itens voltaram." : message);
        }
    }

    private finish(trade: Trade): void {
        trade.done = true;
        for (const side of trade.sides) {
            this.send(side.player, "trade.end", "{}");
            this.byPlayer.delete(side.player.id);
            this.byStash.delete(side.stash.id);
            delete this.held[side.steamId];
            try {
                side.stash.destroy();
            } catch {
                // Already gone.
            }
        }
        this.persist();
    }

    // -----------------------------------------------------------------------------------------
    // Events.

    stashChanged(stash: Stash): void {
        const side = this.byStash.get(stash.id);
        const trade = side === undefined ? undefined : this.byPlayer.get(side.player.id);
        if (side !== undefined && trade !== undefined && !trade.done && !trade.settling) {
            this.changed(trade, side);
        }
    }

    stashClosed(stash: Stash, player: Player): void {
        let id: number;
        try {
            id = stash.id;
        } catch {
            // A container taken away while open (a death drop emptied, 2026-10-18 23:48 log): none of a trade's.
            return;
        }
        const side = this.byStash.get(id);
        if (side === undefined || side.player.id !== player.id) {
            return;
        }
        side.editing = false;
        const trade = this.byPlayer.get(player.id);
        if (trade !== undefined && !trade.done) {
            this.reopen(trade, side, REOPEN_AFTER_SCREEN_MS);
        }
    }

    /** Only the owner opens an offer's container. */
    mayOpen(player: Player, stash: Stash): boolean {
        const side = this.byStash.get(stash.id);
        return side === undefined || side.player.id === player.id;
    }

    left(player: Player, message: string): void {
        const trade = this.byPlayer.get(player.id);
        if (trade !== undefined) {
            this.cancel(trade, message);
        }
    }

    tick(): void {
        const now = this.now();
        for (const trade of new Set(this.byPlayer.values())) {
            const [a, b] = trade.sides;
            const apart = Math.hypot(a.player.position.x - b.player.position.x, a.player.position.y - b.player.position.y, a.player.position.z - b.player.position.z);
            if (!a.player.alive || !b.player.alive || a.player.virtualWorld !== b.player.virtualWorld || apart > TRADE_REACH_M) {
                this.cancel(trade, "A troca foi desfeita: vocês se afastaram.");
            } else if (now - trade.lastActivity > TRADE_IDLE_MS) {
                this.cancel(trade, "A troca foi desfeita: ficou parada tempo demais.");
            }
        }
    }

    cancelAll(): void {
        for (const trade of new Set(this.byPlayer.values())) {
            this.cancel(trade, "A troca foi desfeita: o servidor está reiniciando.");
        }
    }
}

export const trades = new Trades();

export function installTrades(): void {
    trades.load();
    // An announced restart undoes the open trades first: what was put up goes back to each side while the server still runs.
    onRestartSettle(() => {
        trades.cancelAll();
        return "negociações abertas desfeitas antes do reinício";
    });

    // The page's buttons (`src/client/craft-page.ts` passes them on).
    for (const action of ["items", "accept", "cancel"]) {
        Events.onClient(`${RESOURCE}:trade.${action}`, (sender) => {
            trades.act(sender as Player, action);
        });
    }
    Events.on("stashInventoryChanged", (stash) => trades.stashChanged(stash));
    Events.on("stashClose", (stash, player) => trades.stashClosed(stash, player));
    Events.on("stashInteract", (player, stash) => (trades.mayOpen(player, stash) ? undefined : false));
    Events.on("playerDisconnect", (player) => trades.left(player, "A troca foi desfeita: a outra pessoa saiu."));
    Events.on("playerDied", (player) => trades.left(player, "A troca foi desfeita."));
    Events.on("playerInventoryReady", (player) => {
        trades.deliver(player);
    });

    const timer = setInterval(() => trades.tick(), TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            trades.cancelAll();
        }
    });
    console.log("trade: negociação entre jogadores pela página de ofícios (à direita) e pela tela de baú do jogo");
}
