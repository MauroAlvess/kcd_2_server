/**
 * Skill books: the game's own reading skips the clock and hangs (`src/server/skillbooks.ts` says why), so the book's action
 * is taken over (`item-uses.ts`) and the server is asked to read it at the world's pace. When the server starts a reading it
 * sends the pages: the inventory is closed and the book opened in the player's hands with the game's own reading screen. Closing it
 * puts the book down; the server closes it when the reading is done.
 */

const RESOURCE = "kcdc-gamemode";

export function installSkillBooks(): void {
    let open: number | null = null;

    Events.on(`${RESOURCE}:skillbook.open`, (payload) => {
        let pages: string[] = [];
        try {
            const fields = (typeof payload === "string" ? JSON.parse(payload) : payload) as { pages?: unknown };
            pages = Array.isArray(fields.pages) ? fields.pages.filter((page): page is string => typeof page === "string") : [];
        } catch {
            pages = [];
        }
        // The inventory the book was used from closes, and the book opens in the player's hands a moment later.
        NativeUI.setMenuEnabled("inventory", false);
        setTimeout(() => {
            NativeUI.setMenuEnabled("inventory", true);
            open = pages.length > 0 ? Book.open({ style: "book", type: 3, visual: 3, pages }) : null;
            if (open === null) {
                Events.emitServer(`${RESOURCE}:skillbook.shut`, JSON.stringify({ failed: pages.length > 0 ? Book.getLastError() : "sem páginas" }));
            }
        }, 300);
    });

    Events.on("bookClosed", (id) => {
        if (open !== null && id === open) {
            open = null;
            Events.emitServer(`${RESOURCE}:skillbook.shut`, "{}");
        }
    });

    Events.on(`${RESOURCE}:skillbook.close`, () => {
        if (open !== null) {
            Book.close();
        }
    });
}
