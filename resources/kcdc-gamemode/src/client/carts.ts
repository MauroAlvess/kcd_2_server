/**
 * "[E] Subir na carroça": the game's own interaction hint, up while the player stands beside a cart (the server says which, every
 * second, in `cart.near`). The press asks the server for the seats (`src/server/carts.ts`); nothing is decided here.
 */

const RESOURCE = "kcdc-gamemode";

export function installCarts(): void {
    let hint = 0;
    Events.on(`${RESOURCE}:cart.near`, (payload) => {
        let id = 0;
        try {
            const value = typeof payload === "string" ? (JSON.parse(payload) as unknown) : payload;
            const near = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : 0;
            id = typeof near === "number" ? near : 0;
        } catch {
            return;
        }
        if (id > 0 && hint === 0) {
            try {
                hint = ActionHint.create({ key: "primary_action", text: "Subir na carroça" }, () => Events.emitServer(`${RESOURCE}:cart.use`));
            } catch {
                hint = 0;
            }
        } else if (id === 0 && hint !== 0) {
            ActionHint.remove(hint);
            hint = 0;
        }
    });
}
