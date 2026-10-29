/**
 * What a dice match is played for, and the dice the two players carry while it lasts.
 *
 * - The stake both agreed before sitting down (`dice.ts`), in coins, is taken from each when the match starts and written
 *   down (`playerdata/dice-pot.json`). The winner takes both stakes when it ends. A match nobody played -- no die thrown,
 *   the table left at 0 : 0 -- or one with no winner gives each their own back; so does a restart in the middle of one, at
 *   the player's next entry. Giving up a match that was played loses the stake, as the game itself warns.
 * - The dice and the dice badges each player carries are kept out of their inventory while the match lasts, and given
 *   back when it ends. With dice in the inventory the game first puts up its own "Escolha os dados e insígnias para jogar"
 *   screen, which a match the server deals has no use for (badges and dice perks are off), and whose X did nothing: three
 *   matches were left at 0 : 0, nobody having thrown (2026-10-16).
 *
 * Anything that cannot be handed back (a player who left, a full inventory) is owed, and given at the owner's next entry.
 */

import { addUnits } from "./inventory-add.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/dice-pot.json`;

const MONEY_ITEM = "money";
const MONEY_GUID = "5ef63059-322e-4e1b-abe8-926e100c770e";
/** The game shows a tenth of the money item's amount: a coin is ten units. */
export const MONEY_UNIT = 10;

/** The stakes on offer, in coins, one step at a time from nothing up. */
export const STAKE_STEPS: readonly number[] = [0, 5, 10, 20, 50, 100, 200, 500, 1000];

/** The game's dice (`Die`, 45) and dice badges (`DiceBadge`, 36), by item class GUID, from the KCDC item reference. */
const DICE_ITEMS: ReadonlySet<string> = new Set([
    "329d2697-b6d2-452d-9ba9-09649a607740", "6a479d81-e642-40b3-92ad-0e43793f8c66", "dce71bd0-4397-4d00-8a01-1e734a8255a6",
    "6f0c9c31-474f-4254-9dd6-2ab54fb87060", "b43b8e5b-4891-48ce-a39f-143956862c96", "8ee58bb4-d928-4caf-9246-9a4706299543",
    "23e4412b-10fe-49eb-aba0-734a121cef67", "ba357fbc-ba9b-46d1-a743-b31842cd9fd4", "5a9e23d3-e8dc-4eb7-9805-3bd2fa6d8351",
    "75a0739e-fa75-4f99-be68-e1c3ba30d57e", "11834cfd-bd67-41d8-8fe7-503f5076fa1d", "b8c8b160-9c66-4484-ae36-e775b39e4191",
    "6bfa4927-3af4-4871-8ecb-b3b2bf13cecb", "1c1c88ca-61dd-4b64-965a-fd1e9a840364", "5ca4ea9d-a556-4051-a90e-ad645eb16b80",
    "aa0b6bc8-e7f6-4777-b931-1ae81d7ef8da", "a671d0f9-f52e-48e9-a5cf-d51c8765f89d", "fd2e7345-5584-49d1-a0f9-e69c51d2bdf0",
    "c4f01ba9-3b75-47e6-81b8-f4da7f58a416", "9a9d9c0d-2c94-475d-ab72-75b8ced9ac05", "3844bfed-e66b-4e97-bea4-4bf84d90ae82",
    "bd819743-3e32-474e-8333-bebe92b16e98", "4ede7cfe-e698-4917-a092-a01d8ac3646f", "8895b262-ddfb-4392-a784-eee616798c96",
    "1bd8d5d2-f57e-48c8-8f82-df7ae1ea90d3", "bdcd8605-9632-4792-b5bf-539eb4bf2e9d", "65ccc0cd-de18-4305-9d64-42bb3c6d8d30",
    "4c465f33-a20e-4428-b2f5-09cfc6c4f6d7", "1b1345f6-75c0-4477-b6d7-b9d73ec9d9f0", "4306e2d9-f09b-444a-b05d-79c55449ef46",
    "dccf7f80-e965-4666-957c-dbf975381fff", "55cc9e0d-63b4-491f-a74c-098654f58e61", "3a6e12fe-a494-4a34-85a9-ebdf4f1d3a14",
    "06d3757e-2882-4d75-99f9-1008a4e9d2d1", "b41171bf-9332-44ce-96fa-7e64d6e5e92a", "d9207a2d-9c94-4669-816f-a83186367392",
    "62bb62c7-8200-4cda-967e-02ee22c95caa", "1c3a6424-dfcf-4d34-b33f-d22b055d944b", "f8e3162a-dff1-4099-a60f-05be4e40f7ca",
    "86b7cd9f-2d1e-4e0d-8267-c5850a71d877", "93e67a15-6545-46d3-8820-87fd690e1f0d", "8ab8d048-2ca7-4bb4-a0d4-963555750bc9",
    "1f610871-6df4-4c86-a5a2-4df8dc6500df", "85e24c29-d5b7-4792-89e4-19350e3e14ac", "c57c2cb4-5d16-4fbe-a55c-db20dd740efe",
    "b26e6c86-2970-4106-a25b-9e4ffa181979", "859204c7-683e-4238-97d6-dafcd7aec3ed", "3acd1712-9ab9-44f1-a0c9-275e89f1b2c3",
    "493e9946-4ec1-40ca-bde2-07fa5fa40307", "dd9d4349-9713-4a79-960c-859e60ed2e13", "48fd950c-294c-439c-96f3-2d6baf88ceb6",
    "b7e10a4a-08f8-4582-b71e-b562c72fe8da", "a16e6c86-2970-4106-a25b-9f4ffa181982", "1ee30641-d703-4556-80d9-db9ece7cbfd3",
    "a16e6c86-2970-4106-a25b-9b4ffa181972", "6d2453f5-e251-4604-ae1e-863322604399", "6b6575d6-a553-43a3-9ad1-5ccc900e23ad",
    "a16e6c86-2970-4106-a25b-9b4ffa181977", "24da7902-d6be-4410-b774-e8907fe71714", "d9d807a4-58d1-4504-a904-7c2c8d15c092",
    "f953cb01-8f55-4075-a16a-f1e3a4001a9e", "a16e6c86-2970-4106-a25b-9e4ffa181972", "b9d08c7e-94cf-48ea-a82e-6abdf8c48b33",
    "a16e6c86-2970-4106-a25b-9f4ffa181972", "34a822bc-21b5-4b7f-9088-be794b94d4e3", "bb8ecc03-acc5-4ae6-8459-163fb3f8af39",
    "a16e6c86-2970-4106-a25b-9f4ffa181983", "f16e6c86-2970-4106-a25b-9f4ffa181983", "140fae91-d3dd-44e7-b51f-7b335644631c",
    "b26e6c86-2970-4106-a25b-9e4ffa181972", "b16e6c86-2970-4106-a25b-9e4ffa181972", "f654fdda-783a-4460-8c66-a6d2b5927820",
    "d55221a0-e40c-11ec-8fea-0242ac120002", "3b1384f8-36bf-453b-8f17-66fb360a72f9", "8a88ac39-471b-4088-8826-5a47adf6c16c",
    "6692bde3-cd11-48e6-a796-06e6cda4a690", "0e292c1d-5d8b-4030-9b47-9dfc0779b095", "f16e6c86-2970-4106-a21c-9f4ffa181983",
    "a0a9d335-44c5-4664-af92-558cf97d8283", "57ddd40b-3fbd-4bb3-8556-0f9ee5247f40", "44cd24ab-28c5-4835-bd45-3bd87c49a89f",
]);

export interface PotRow {
    item: string;
    amount: number;
    metadata: Record<string, unknown>;
}

interface Seat {
    readonly steamId: string;
    readonly name: string;
    /** Coins taken from this player for the stake. */
    readonly coins: number;
    /** The dice and badges taken out of this player's inventory. */
    readonly items: PotRow[];
}

export interface Pot {
    /** The match it is for, once started; 0 before. */
    match: number;
    readonly stake: number;
    readonly seats: [Seat, Seat];
}

/** How a match was settled: whether a die was thrown at all, the stake, and who took what. */
export interface Settled {
    readonly played: boolean;
    readonly stake: number;
    /** `won`: the winner took both stakes; `refunded`: each had their own back; `none`: nothing was at stake. */
    readonly outcome: "won" | "refunded" | "none";
    readonly winner: 0 | 1 | null;
    /** Coins the winner took. */
    readonly pot: number;
    /** How many rows of dice each seat had back. */
    readonly itemsBack: [number, number];
}

export const coinsText = (coins: number): string => `${coins} ${coins === 1 ? "moeda" : "moedas"}`;

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function validRows(raw: unknown): PotRow[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .filter((row): row is PotRow => typeof row === "object" && row !== null && typeof (row as PotRow).item === "string" && typeof (row as PotRow).amount === "number" && (row as PotRow).amount > 0)
        .map((row) => ({ item: row.item, amount: row.amount, metadata: typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {} }));
}

export class DicePots {
    private readonly pots = new Set<Pot>();
    private readonly rolls = new Map<number, number>();
    private owed: Record<string, PotRow[]> = {};
    /** The server is going down: what a match holds stays written down, and is owed back at the next start. */
    private stopping = false;

    // -----------------------------------------------------------------------------------------
    // The file.

    /** What was at stake or kept when the server stopped is owed back: the matches are gone. */
    load(): void {
        const loaded = read<{ pots?: unknown; owed?: unknown }>(FILE);
        if (loaded.status !== "ok") {
            return;
        }
        const owed: Record<string, PotRow[]> = {};
        if (typeof loaded.value.owed === "object" && loaded.value.owed !== null) {
            for (const [steamId, rows] of Object.entries(loaded.value.owed as Record<string, unknown>)) {
                const valid = validRows(rows);
                if (valid.length > 0) {
                    owed[steamId] = valid;
                }
            }
        }
        let open = 0;
        for (const pot of Array.isArray(loaded.value.pots) ? (loaded.value.pots as unknown[]) : []) {
            const seats = typeof pot === "object" && pot !== null ? (pot as { seats?: unknown }).seats : undefined;
            if (!Array.isArray(seats)) {
                continue;
            }
            open += 1;
            for (const seat of seats as unknown[]) {
                if (typeof seat !== "object" || seat === null || typeof (seat as Seat).steamId !== "string" || (seat as Seat).steamId === "") {
                    continue;
                }
                const { steamId, coins } = seat as Seat;
                const rows = [...validRows((seat as Seat).items), ...(typeof coins === "number" && coins > 0 ? [{ item: MONEY_ITEM, amount: Math.floor(coins) * MONEY_UNIT, metadata: {} }] : [])];
                if (rows.length > 0) {
                    owed[steamId] = [...(owed[steamId] ?? []), ...rows];
                }
            }
        }
        this.owed = owed;
        this.persist();
        if (open > 0) {
            console.log(`dice: ${open} jogo(s) de dados estava(m) aberto(s) quando o servidor parou: apostas e dados voltam aos jogadores na próxima entrada`);
        }
    }

    private persist(): void {
        try {
            ensureDir(DIR);
            write(FILE, { pots: [...this.pots], owed: this.owed });
        } catch (error: unknown) {
            console.log(`dice: não consegui salvar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // -----------------------------------------------------------------------------------------
    // Money and dice, in the player's own inventory.

    /** Whole coins a player carries. */
    coinsOf(player: Player): number {
        const units = (Inventory.get(player)?.items ?? []).filter((row) => row.item === MONEY_GUID || row.name === MONEY_ITEM).reduce((sum, row) => sum + row.amount, 0);
        return Math.floor(units / MONEY_UNIT);
    }

    private takeCoins(player: Player, coins: number): boolean {
        if (coins <= 0) {
            return true;
        }
        let left = coins * MONEY_UNIT;
        const units: InventoryUnit[] = [];
        for (const row of (Inventory.get(player)?.items ?? []).filter((candidate) => candidate.item === MONEY_GUID || candidate.name === MONEY_ITEM)) {
            if (left <= 0) {
                break;
            }
            const amount = Math.min(row.amount, left);
            units.push({ id: row.id, amount });
            left -= amount;
        }
        return left <= 0 && Inventory.remove(player, { units }).ok;
    }

    /** Takes the dice and dice badges out of a player's inventory: the rows taken (none, when the game would not let them go). */
    private takeDice(player: Player): PotRow[] {
        const rows = (Inventory.get(player)?.items ?? []).filter((row) => DICE_ITEMS.has(row.item) && row.amount > 0);
        if (rows.length === 0) {
            return [];
        }
        if (!Inventory.remove(player, { units: rows.map((row) => ({ id: row.id, amount: row.amount })) }).ok) {
            console.log(`dice: os dados de ${player.nickname} não saíram do inventário; a tela de escolher dados do jogo pode aparecer`);
            return [];
        }
        return rows.map((row) => ({ item: row.item, amount: row.amount, metadata: { ...row.metadata } }));
    }

    /** Gives rows to a player, or owes them when they are gone or the inventory will not take them. */
    private give(steamId: string, player: Player | null, rows: readonly PotRow[]): number {
        let given = 0;
        const left: PotRow[] = [];
        for (const row of rows) {
            if (player !== null && player.steamId === steamId && addUnits(player, { item: row.item, amount: row.amount, metadata: row.metadata }).ok) {
                given += 1;
            } else {
                left.push(row);
            }
        }
        if (left.length > 0 && steamId !== "") {
            this.owed[steamId] = [...(this.owed[steamId] ?? []), ...left];
        }
        return given;
    }

    private coinsRow(coins: number): PotRow[] {
        return coins > 0 ? [{ item: MONEY_ITEM, amount: coins * MONEY_UNIT, metadata: {} }] : [];
    }

    // -----------------------------------------------------------------------------------------
    // A match.

    /**
     * Before a match starts: the stake from both, and their dice out of their inventories. The pot to bind to the match, or
     * the player who cannot pay (nothing is taken from anybody then).
     */
    hold(first: Player, second: Player, stake: number): Pot | { readonly short: Player } {
        const coins = Math.max(0, Math.floor(stake));
        for (const player of [first, second]) {
            if (this.coinsOf(player) < coins) {
                return { short: player };
            }
        }
        if (!this.takeCoins(first, coins)) {
            return { short: first };
        }
        if (!this.takeCoins(second, coins)) {
            this.give(first.steamId, first, this.coinsRow(coins));
            this.persist();
            return { short: second };
        }
        const seat = (player: Player): Seat => ({ steamId: player.steamId, name: player.nickname, coins, items: this.takeDice(player) });
        const pot: Pot = { match: 0, stake: coins, seats: [seat(first), seat(second)] };
        this.pots.add(pot);
        this.persist();
        return pot;
    }

    /** The match started: the pot is its. */
    bind(pot: Pot, match: number): void {
        pot.match = match;
        this.rolls.set(match, 0);
        this.persist();
        const kept = pot.seats.map((seat) => seat.items.reduce((sum, row) => sum + row.amount, 0));
        console.log(`dice: partida ${match}: ${pot.stake > 0 ? `aposta de ${coinsText(pot.stake)} de cada` : "sem aposta"}; dados guardados durante o jogo: ${pot.seats[0].name} ${kept[0]}, ${pot.seats[1].name} ${kept[1]}`);
    }

    /** The match could not start: everything goes back. */
    release(pot: Pot, players: readonly [Player | null, Player | null]): void {
        this.pots.delete(pot);
        pot.seats.forEach((seat, index) => this.give(seat.steamId, players[index] ?? null, [...this.coinsRow(seat.coins), ...seat.items]));
        this.persist();
    }

    /** A die was thrown in this match: it was played. */
    rolled(match: number): number {
        const count = (this.rolls.get(match) ?? 0) + 1;
        this.rolls.set(match, count);
        return count;
    }

    rollsOf(match: number): number {
        return this.rolls.get(match) ?? 0;
    }

    /**
     * The server is stopping (2026-10-19: Elisabeth's six dice were handed back after her character had been saved for the
     * stop, and were lost). From now on a match's end hands nothing over: the pot stays in the file, owed at the next entry.
     */
    stop(): void {
        this.stopping = true;
    }

    /** The match is over: the stake to the winner, or back to each; the dice back to their owners. */
    settle(match: number, first: Player | null, second: Player | null, winner: number, firstScore: number, secondScore: number): Settled | null {
        const rolls = this.rolls.get(match) ?? 0;
        this.rolls.delete(match);
        if (this.stopping) {
            console.log(`dice: partida ${match} parou com o servidor: o que estava guardado volta na próxima entrada`);
            return null;
        }
        const pot = [...this.pots].find((candidate) => candidate.match === match && match !== 0);
        if (pot === undefined) {
            return null;
        }
        this.pots.delete(pot);
        const players: [Player | null, Player | null] = [first, second];
        const played = rolls > 0 || firstScore + secondScore > 0;
        const won = winner === 0 || winner === 1 ? winner : null;
        let outcome: Settled["outcome"] = "none";
        let taken = 0;
        if (pot.stake > 0 && played && won !== null) {
            taken = pot.seats[0].coins + pot.seats[1].coins;
            this.give(pot.seats[won].steamId, players[won], this.coinsRow(taken));
            outcome = "won";
        } else if (pot.stake > 0) {
            pot.seats.forEach((seat, index) => this.give(seat.steamId, players[index] ?? null, this.coinsRow(seat.coins)));
            outcome = "refunded";
        }
        const itemsBack: [number, number] = [this.give(pot.seats[0].steamId, players[0], pot.seats[0].items), this.give(pot.seats[1].steamId, players[1], pot.seats[1].items)];
        this.persist();
        console.log(`dice: partida ${match} acertada: ${rolls} lance(s), ${outcome === "won" ? `${pot.seats[won ?? 0].name} levou ${coinsText(taken)}` : outcome === "refunded" ? "a aposta voltou a cada um" : "sem aposta"}`);
        return { played, stake: pot.stake, outcome, winner: won, pot: taken, itemsBack };
    }

    /** Hands a player back whatever a dice match owes them. Called when their inventory is ready. */
    deliver(player: Player): number {
        const rows = this.owed[player.steamId];
        if (rows === undefined) {
            return 0;
        }
        delete this.owed[player.steamId];
        const given = this.give(player.steamId, player, rows);
        this.persist();
        if (given > 0) {
            tell(player, this.owed[player.steamId] !== undefined ? "Parte do que estava guardado num jogo de dados voltou para você; o resto volta quando houver espaço." : "O que estava guardado num jogo de dados (aposta e dados) voltou para você.");
        }
        return given;
    }

    owes(steamId: string): readonly PotRow[] {
        return this.owed[steamId] ?? [];
    }

    /** Whether this item class is a die or a dice badge. */
    isDice(item: string): boolean {
        return DICE_ITEMS.has(item);
    }
}

export const dicePots = new DicePots();
