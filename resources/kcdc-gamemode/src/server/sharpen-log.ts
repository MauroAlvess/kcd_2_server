/**
 * The grindstone (2026-10-25, user: "jogador falou que mesmo após ficar afiando a lâmina muito tempo ela não reparava"). Nothing of ours has stood
 * between a player and the game's own sharpening since the evening of 2026-10-22: it was the smiths' for that afternoon, and the log of the 22nd
 * holds the refusals of then (`guild-crafts: ... barrado em sharpen`). What the KCDC server takes of a sharpening arrives as one `sharpen` change,
 * once it has checked the grindstone (one of the level's own: a copy placed with the World Builder is not one), the distance and the weapon's class;
 * any gain it did not approve it undoes, and says nothing. Each sharpening it took is written here, so a player who says the stone did nothing can be
 * told apart from one whose stone the server did not accept.
 */

const percent = (value: number | undefined): string => (typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "?");

export function installSharpenLog(): void {
    Events.on("playerInventoryChanged", (player, change) => {
        if (change.reason !== "sharpen") {
            return;
        }
        let undone = 0;
        for (const row of change.items) {
            const name = row.after?.name ?? row.before?.name ?? row.id;
            console.log(`sharpen: ${player.nickname} afiou ${name}: ${percent(row.before?.condition)} -> ${percent(row.after?.condition)}`);
            // 2026-10-27: the grindstone is the smiths' repair bench (`repair.ts`), three repairs for a weapon; the game's own sharpening would repair without end.
            // What it did is undone: the condition the row had before is put back (the rest of the row as it is now).
            const before = row.before?.condition;
            if (row.after !== null && row.after !== undefined && typeof before === "number" && row.after.condition > before) {
                const metadata: Record<string, unknown> = { ...row.after.metadata };
                delete metadata["health"];
                metadata["condition"] = before;
                if (Inventory.setProperties(player, { id: row.id, metadata }).ok) {
                    undone += 1;
                }
            }
        }
        if (undone > 0) {
            Chat.sendToPlayer(player, "A pedra de amolar agora é a mesa de reparo dos ferreiros: olhe para ela e aperte E (Reparar). A afiação do jogo não vale.");
        }
    });
}
