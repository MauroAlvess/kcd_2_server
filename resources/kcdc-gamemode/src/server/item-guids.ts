/**
 * The GUID of each item the server's lists name by the game's table name (`bsmt_ironBad`, `herb_salvia`): the gear from `Inventory.classes()`, everything else by putting one in a
 * scratch stash once and reading back the class the game gave it (the way `bandits.ts` resolves its gear). Keys and values in lower case.
 */

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isGuid = (item: string): boolean => GUID.test(item);

export function resolveItemGuids(names: readonly string[]): Map<string, string> {
    const guids = new Map<string, string>();
    try {
        for (const entry of Inventory.classes()) {
            guids.set(entry.name.toLowerCase(), entry.id.toLowerCase());
        }
    } catch (error: unknown) {
        console.log(`itens: a lista de classes do jogo não veio: ${error instanceof Error ? error.message : String(error)}`);
    }
    // As written (the game is asked by the name as its tables have it), one of each.
    const missing = new Map<string, string>();
    for (const name of names) {
        if (!isGuid(name) && !name.startsWith("kcdc-craft:") && !guids.has(name.toLowerCase()) && !missing.has(name.toLowerCase())) {
            missing.set(name.toLowerCase(), name);
        }
    }
    if (missing.size === 0) {
        return guids;
    }
    let scratch: ReturnType<typeof Stash.createVirtual> | null = null;
    try {
        scratch = Stash.createVirtual();
        for (const [lower, name] of missing) {
            if (scratch.setInventory({ items: [] }).ok && scratch.addItem({ item: name, amount: 1 }).ok) {
                const row = scratch.getInventory()?.items[0];
                if (row !== undefined) {
                    guids.set(lower, row.item.toLowerCase());
                }
            }
        }
    } catch (error: unknown) {
        console.log(`itens: não consegui ler as classes de ${missing.size} nome(s): ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        scratch?.destroy();
    }
    return guids;
}
