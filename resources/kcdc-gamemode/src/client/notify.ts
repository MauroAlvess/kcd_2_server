/**
 * A line the server wants the player to read, on the game's own notification line (`Hud.showNotification`) rather than
 * only in the chat: an introduction, an invitation answered, a trade done. The server sends the same line to the chat.
 */

const RESOURCE = "kcdc-gamemode";

export function installNotify(): void {
    Events.on(`${RESOURCE}:notify`, (payload) => {
        let parsed: unknown = payload;
        if (typeof payload === "string") {
            try {
                parsed = JSON.parse(payload) as unknown;
            } catch {
                return;
            }
        }
        const text = typeof parsed === "object" && parsed !== null ? (parsed as { text?: unknown }).text : undefined;
        if (typeof text === "string" && text !== "") {
            Hud.showNotification(text.slice(0, 200));
        }
    });
}
