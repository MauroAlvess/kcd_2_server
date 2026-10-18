/**
 * A property chest opened from its menu (`property-menu.ts`).
 *
 * The server cannot open a level chest's screen for a player: `Stash.open` opens only a virtual stash. So "Abrir" in the
 * menu opens a copy: a virtual stash filled with what the chest holds, shown on the game's own transfer screen, and kept
 * in step with the chest at every move (`stashInventoryChanged`), so the chest -- which `chest-state.ts` saves -- always
 * holds what the copy does. When the screen closes the copy is written back once more and thrown away.
 *
 * While a copy is open nobody else opens that chest, from its prompt or from its menu; and its owner sees no difference
 * but that the screen came from a menu.
 */

/** A row as a container's `setInventory` takes it back: its identity, class, amount and everything about the unit. */
interface CopiedRow {
    id: string;
    item: string;
    amount: number;
    metadata: Record<string, unknown>;
}

interface View {
    readonly playerId: number;
    readonly source: Stash;
    readonly copy: Stash;
}

function rowsOf(stash: Stash): CopiedRow[] | null {
    const state = stash.getInventory();
    if (state === null) {
        return null;
    }
    return state.items.map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: { ...row.metadata } }));
}

/**
 * Fills a container with rows, as they are; if it refuses them, once more without their identities (a container may want
 * its own), which changes nothing a player sees.
 */
function fill(stash: Stash, rows: CopiedRow[]): InventoryResult {
    const first = stash.setInventory({ items: rows });
    return first.ok ? first : stash.setInventory({ items: rows.map(({ item, amount, metadata }) => ({ item, amount, metadata })) });
}

export class ChestViews {
    private readonly bySource = new Map<string, View>();
    private readonly byCopy = new Map<number, View>();

    constructor(private readonly makeCopy: (virtualWorld: number) => Stash = (virtualWorld) => Stash.createVirtual(virtualWorld)) {}

    /** Whether somebody but `playerId` has this chest open on a copy. */
    busy(sourceGuid: string, playerId = -1): boolean {
        const view = this.bySource.get(sourceGuid);
        return view !== undefined && view.playerId !== playerId;
    }

    /** Whether this player has a chest open on a copy. */
    openBy(playerId: number): boolean {
        return [...this.byCopy.values()].some((view) => view.playerId === playerId);
    }

    /** Whether this stash is one of the copies. */
    isCopy(stash: Stash): boolean {
        return this.byCopy.has(stash.id);
    }

    /** Opens the chest's contents to the player on the game's transfer screen. False, with nothing changed, when it cannot. */
    open(player: Player, source: Stash): boolean {
        if (this.busy(source.levelGuid, player.id) || (source.holderId !== 0 && source.holderId !== player.id)) {
            return false;
        }
        const old = this.bySource.get(source.levelGuid);
        if (old !== undefined) {
            this.end(old);
        }
        const rows = rowsOf(source);
        if (rows === null) {
            return false;
        }
        const copy = this.makeCopy(player.virtualWorld);
        const filled = fill(copy, rows);
        if (!filled.ok) {
            console.log(`chest-view: o baú ${source.levelGuid} não pôde ser copiado (${filled.code})`);
            copy.destroy();
            return false;
        }
        const view: View = { playerId: player.id, source, copy };
        this.bySource.set(source.levelGuid, view);
        this.byCopy.set(copy.id, view);
        if (!copy.open(player)) {
            this.end(view);
            return false;
        }
        return true;
    }

    /** Writes what the copy holds into the chest. */
    private sync(view: View): void {
        const rows = rowsOf(view.copy);
        if (rows === null) {
            return;
        }
        const written = fill(view.source, rows);
        if (!written.ok) {
            console.log(`chest-view: o baú ${view.source.levelGuid} não aceitou o que a cópia tem (${written.code}); a cópia continua aberta`);
        }
    }

    /** Something moved in a container: in a copy, the chest takes it at once. */
    changed(stash: Stash): void {
        const view = this.byCopy.get(stash.id);
        if (view !== undefined) {
            this.sync(view);
        }
    }

    /** A screen closed: on a copy, the chest takes what it holds once more and the copy goes. */
    closed(stash: Stash): void {
        const view = this.byCopy.get(stash.id);
        if (view !== undefined) {
            this.end(view);
        }
    }

    private end(view: View): void {
        this.sync(view);
        this.bySource.delete(view.source.levelGuid);
        this.byCopy.delete(view.copy.id);
        view.copy.destroy();
    }

    /** Every copy written back and thrown away: the resource is stopping. */
    endAll(): void {
        for (const view of [...this.byCopy.values()]) {
            this.end(view);
        }
    }
}
