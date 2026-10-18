/**
 * Trading between two players, on the game's own screens.
 *
 * KCD2 has no screen for two players to barter on, so each side gets an offer: a virtual container
 * (`Stash.createVirtual`) its owner fills from their own inventory on the game's transfer screen, and an amount of money
 * chosen in the dialogue list. Both offers are shown in the game's dialogue list, where each side can change theirs, look
 * at the other's, accept or cancel. Any change to either offer takes both acceptances back, so nobody accepts one deal and
 * gets another. When both have accepted, the money and the items cross over; anything the other side cannot carry goes
 * back to whoever offered it. A cancelled trade gives every item back.
 *
 * Items in an offer are out of their owner's inventory, so they are written down (`playerdata/escrow.json`) for as long
 * as they are there, and anything that could not be handed back (a full inventory, a player who left, a restart in the
 * middle of a trade) is given back the next time its owner's inventory is ready.
 */

import { labelFor } from "./acquaintances.js";
import { itemLine } from "./item-names.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/escrow.json`;

const MONEY_ITEM = "money";
const MONEY_GUID = "5ef63059-322e-4e1b-abe8-926e100c770e";
/** The game shows a tenth of the money item's amount. */
const MONEY_UNIT = 10;

/** How far apart the two may stand while trading. */
export const TRADE_REACH_M = 8;
/** A trade nobody touches for this long is called off. */
export const TRADE_IDLE_MS = 10 * 60_000;
const TICK_MS = 2_000;

/** How many of the other side's items the dialogue list can show at once (eight rows, two of them taken). */
const SHOWN_ITEMS = 6;

export interface EscrowRow {
    item: string;
    amount: number;
    metadata: Record<string, unknown>;
}

type Page = "main" | "money" | "theirs";

/**
 * The list comes back this long after the transfer screen has closed. Opened while the game was still closing that
 * screen, it came up empty, with the player held in the conversation until a second Esc ended the trade (reported
 * 2026-10-14).
 */
export const REOPEN_AFTER_SCREEN_MS = 700;

/** The list is drawn once more this long after it comes back, in case the first drawing was lost all the same. */
export const REDRAW_AFTER_MS = 400;

/** An Esc this soon after the list came back is taken for an empty list being dismissed: it is shown again, once. */
export const GRACE_AFTER_REOPEN_MS = 3_000;

interface Side {
    readonly player: Player;
    readonly steamId: string;
    readonly stash: Stash;
    /** Offered money, in units of the money item. */
    money: number;
    accepted: boolean;
    /** The dialogue on this side's screen, or 0. */
    session: number;
    page: Page;
    /** The side has its container open on the transfer screen. */
    editing: boolean;
    /** The list is waiting to come back after the transfer screen; nothing opens it before its time. */
    waiting: boolean;
    /** When the list last came back after the transfer screen, or 0. */
    reopenedAt: number;
    /** The one Esc forgiven after that has been used. */
    graceUsed: boolean;
}

interface Trade {
    readonly id: number;
    readonly sides: [Side, Side];
    lastActivity: number;
    done: boolean;
    /** Items are being moved out of the offers by this module: their containers' change events are its own. */
    settling: boolean;
}

const coins = (units: number): string => {
    const amount = units / MONEY_UNIT;
    const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(".", ",");
    return `${shown} ${amount === 1 ? "moeda" : "moedas"}`;
};

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
    private readonly bySession = new Map<number, Side>();
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
            if (Inventory.add(player, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
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
    // Money, read and moved in the player's own inventory.

    moneyOf(player: Player): number {
        const state = Inventory.get(player);
        return (state?.items ?? []).filter((row) => row.item === MONEY_GUID || row.name === MONEY_ITEM).reduce((sum, row) => sum + row.amount, 0);
    }

    private takeMoney(player: Player, units: number): boolean {
        if (units <= 0) {
            return true;
        }
        const rows = (Inventory.get(player)?.items ?? []).filter((row) => row.item === MONEY_GUID || row.name === MONEY_ITEM);
        const taken: InventoryUnit[] = [];
        let left = units;
        for (const row of rows) {
            if (left <= 0) {
                break;
            }
            const amount = Math.min(row.amount, left);
            taken.push({ id: row.id, amount });
            left -= amount;
        }
        return left <= 0 && Inventory.remove(player, { units: taken }).ok;
    }

    private giveMoney(player: Player, units: number): boolean {
        return units <= 0 || Inventory.add(player, { item: MONEY_ITEM, amount: units }).ok;
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
            if (Inventory.add(to, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
                moved += 1;
            } else if (!side.stash.addItem({ item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
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
        if (first.id === second.id || this.isTrading(first) || this.isTrading(second) || first.steamId === "" || second.steamId === "") {
            return false;
        }
        const make = (player: Player): Side => ({
            player,
            steamId: player.steamId,
            stash: Stash.createVirtual(player.virtualWorld),
            money: 0,
            accepted: false,
            session: 0,
            page: "main",
            editing: false,
            waiting: false,
            reopenedAt: 0,
            graceUsed: false,
        });
        const trade: Trade = { id: this.nextId++, sides: [make(first), make(second)], lastActivity: this.now(), done: false, settling: false };
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

    private describe(side: Side): string {
        const units = rowsOf(side.stash).reduce((sum, row) => sum + row.amount, 0);
        const parts = [units > 0 ? `${units} ${units === 1 ? "item" : "itens"}` : "", side.money > 0 ? coins(side.money) : ""].filter((part) => part !== "");
        return parts.length === 0 ? "nada" : parts.join(" e ");
    }

    private page(trade: Trade, side: Side): DialoguePage {
        const other = this.other(trade, side);
        const name = labelFor(side.player, other.player);
        if (side.page === "money") {
            const has = this.moneyOf(side.player);
            return {
                line: undefined,
                onRight: false,
                options: [
                    { id: "info", text: `Dinheiro na sua oferta: ${coins(side.money)} (você tem ${coins(has)})`, enabled: false },
                    { id: "money:+10", text: "Mais 1 moeda", enabled: side.money + 10 <= has },
                    { id: "money:+100", text: "Mais 10 moedas", enabled: side.money + 100 <= has },
                    { id: "money:+500", text: "Mais 50 moedas", enabled: side.money + 500 <= has },
                    { id: "money:-10", text: "Menos 1 moeda", enabled: side.money >= 10 },
                    { id: "money:-100", text: "Menos 10 moedas", enabled: side.money >= 100 },
                    { id: "money:0", text: "Nenhum dinheiro", enabled: side.money > 0 },
                    { id: "back", text: "Voltar", enabled: true },
                ],
            };
        }
        if (side.page === "theirs") {
            const rows = rowsOf(other.stash);
            const lines: DialogueOption[] = [];
            if (other.money > 0) {
                lines.push({ id: "info:money", text: `Dinheiro: ${coins(other.money)}`, enabled: false });
            }
            const room = SHOWN_ITEMS - lines.length;
            rows.slice(0, rows.length > room ? room - 1 : room).forEach((row, index) => lines.push({ id: `info:${index}`, text: itemLine(row), enabled: false }));
            if (rows.length > room) {
                lines.push({ id: "info:more", text: `... e mais ${rows.length - (room - 1)}`, enabled: false });
            }
            if (lines.length === 0) {
                lines.push({ id: "info:none", text: `${name} ainda não ofereceu nada.`, enabled: false });
            }
            return { line: undefined, onRight: false, options: [...lines, { id: "back", text: "Voltar", enabled: true }] };
        }
        return {
            line: undefined,
            onRight: false,
            options: [
                { id: "info:mine", text: `Você oferece: ${this.describe(side)}`, enabled: false },
                { id: "info:theirs", text: `${name} oferece: ${this.describe(other)}${other.accepted ? " (aceitou)" : ""}`, enabled: false },
                { id: "items", text: "Mudar os meus itens", enabled: true },
                { id: "money", text: `Mudar o dinheiro (${coins(side.money)})`, enabled: true },
                { id: "theirs", text: `Ver o que ${name} oferece`, enabled: true },
                side.accepted ? { id: "info:waiting", text: `Você aceitou; esperando ${name}`, enabled: false } : { id: "accept", text: "Aceitar a troca", enabled: true },
                { id: "cancel", text: "Cancelar a troca", enabled: true },
            ],
        };
    }

    /** Puts the side's page on their screen: the open conversation is updated, or a new one opened. */
    private show(trade: Trade, side: Side): void {
        if (trade.done || side.editing || side.waiting) {
            return;
        }
        const page = this.page(trade, side);
        if (side.session !== 0 && Dialogue.update(side.session, page)) {
            return;
        }
        if (side.session !== 0) {
            this.bySession.delete(side.session);
        }
        const session = Dialogue.open(side.player.id, page);
        side.session = session;
        if (session === 0) {
            this.cancel(trade, "A negociação não pôde ser aberta.");
            return;
        }
        this.bySession.set(session, side);
    }

    /** Brings the list back after `delay`, with what is on the table by then, and draws it once more a moment later. */
    private reopen(trade: Trade, side: Side, delay: number): void {
        side.waiting = true;
        this.later(() => {
            side.waiting = false;
            if (trade.done || side.editing || side.session !== 0) {
                return;
            }
            side.reopenedAt = this.now();
            this.show(trade, side);
            this.later(() => {
                if (!trade.done && !side.editing && side.session !== 0) {
                    Dialogue.update(side.session, this.page(trade, side));
                }
            }, REDRAW_AFTER_MS);
        }, delay);
    }

    private closeDialogue(side: Side): void {
        const session = side.session;
        side.session = 0;
        if (session !== 0) {
            this.bySession.delete(session);
            Dialogue.close(session);
        }
    }

    /** Either offer changed: both acceptances go, and both pages say what is on the table now. */
    private changed(trade: Trade, side: Side): void {
        trade.lastActivity = this.now();
        const hadAccepted = trade.sides.some((each) => each.accepted);
        for (const each of trade.sides) {
            each.accepted = false;
        }
        this.remember(side);
        if (hadAccepted) {
            for (const each of trade.sides) {
                tell(each.player, "A oferta mudou: os dois precisam aceitar de novo.");
            }
        }
        for (const each of trade.sides) {
            this.show(trade, each);
        }
    }

    choose(session: number, player: Player, option: string): void {
        const side = this.bySession.get(session);
        if (side === undefined || side.player.id !== player.id) {
            return;
        }
        const trade = this.byPlayer.get(player.id);
        if (trade === undefined || trade.done) {
            return;
        }
        trade.lastActivity = this.now();

        if (option === "cancel") {
            this.cancel(trade, `${labelFor(this.other(trade, side).player, player)} cancelou a troca.`, side);
            return;
        }
        if (option === "items") {
            side.editing = true;
            this.closeDialogue(side);
            if (!side.stash.open(player)) {
                side.editing = false;
                tell(player, "Não consegui abrir a sua oferta agora.");
                this.show(trade, side);
            }
            return;
        }
        if (option === "money" || option === "theirs") {
            side.page = option;
            this.show(trade, side);
            return;
        }
        if (option === "back") {
            side.page = "main";
            this.show(trade, side);
            return;
        }
        if (option.startsWith("money:")) {
            const has = this.moneyOf(player);
            const step = option.slice("money:".length);
            const next = step === "0" ? 0 : side.money + Number(step);
            if (!Number.isFinite(next) || next < 0 || next > has || next === side.money) {
                this.show(trade, side);
                return;
            }
            side.money = next;
            this.changed(trade, side);
            return;
        }
        if (option === "accept") {
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

    /** Both accepted: the money first, all of it or none, then the items. */
    private complete(trade: Trade): void {
        const [a, b] = trade.sides;
        trade.settling = true;
        if (a.money > this.moneyOf(a.player) || b.money > this.moneyOf(b.player)) {
            trade.settling = false;
            for (const side of trade.sides) {
                side.accepted = false;
                side.money = Math.min(side.money, this.moneyOf(side.player));
                tell(side.player, "O dinheiro oferecido mudou desde a oferta; confiram e aceitem de novo.");
                this.show(trade, side);
            }
            return;
        }
        if (!this.takeMoney(a.player, a.money)) {
            this.cancel(trade, "A troca não pôde ser feita: o dinheiro não saiu.");
            return;
        }
        if (!this.takeMoney(b.player, b.money)) {
            this.giveMoney(a.player, a.money);
            this.cancel(trade, "A troca não pôde ser feita: o dinheiro não saiu.");
            return;
        }
        if (!this.giveMoney(b.player, a.money)) {
            this.owe(a.steamId, [{ item: MONEY_ITEM, amount: a.money, metadata: {} }]);
        }
        if (!this.giveMoney(a.player, b.money)) {
            this.owe(b.steamId, [{ item: MONEY_ITEM, amount: b.money, metadata: {} }]);
        }
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
        console.log(`trade: ${a.player.nickname} e ${b.player.nickname} trocaram (${this.describeDone(a)} por ${this.describeDone(b)})`);
    }

    private describeDone(side: Side): string {
        return side.money > 0 ? coins(side.money) : "itens";
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
            this.closeDialogue(side);
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

    dialogueClosed(session: number, player: Player, reason: number): void {
        const side = this.bySession.get(session);
        if (side === undefined) {
            return;
        }
        this.bySession.delete(session);
        side.session = 0;
        const trade = this.byPlayer.get(player.id);
        // Reason 0 is this module closing it; anything else -- Esc, another conversation, a disconnect -- ends the trade.
        if (trade !== undefined && !trade.done && reason !== 0 && !side.editing) {
            // Except an Esc just after the list came back from the transfer screen, once: the list may have come up empty.
            if (reason === 1 && !side.graceUsed && side.reopenedAt > 0 && this.now() - side.reopenedAt < GRACE_AFTER_REOPEN_MS) {
                side.graceUsed = true;
                tell(player, "A negociação continua. Para sair dela, escolha Cancelar a troca ou aperte Esc de novo.");
                this.reopen(trade, side, REDRAW_AFTER_MS);
                return;
            }
            this.cancel(trade, `${labelFor(this.other(trade, side).player, player)} saiu da negociação.`, side);
        }
    }

    stashChanged(stash: Stash): void {
        const side = this.byStash.get(stash.id);
        const trade = side === undefined ? undefined : this.byPlayer.get(side.player.id);
        if (side !== undefined && trade !== undefined && !trade.done && !trade.settling) {
            this.changed(trade, side);
        }
    }

    stashClosed(stash: Stash, player: Player): void {
        const side = this.byStash.get(stash.id);
        if (side === undefined || side.player.id !== player.id) {
            return;
        }
        side.editing = false;
        const trade = this.byPlayer.get(player.id);
        if (trade !== undefined && !trade.done) {
            side.page = "main";
            side.graceUsed = false;
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

    Events.on("dialogueChoice", (session, player, option) => trades.choose(session, player, option));
    Events.on("dialogueClosed", (session, player, reason) => trades.dialogueClosed(session, player, reason));
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
    console.log("trade: negociação entre jogadores pela tela de baú e pela lista de diálogo do jogo");
}
