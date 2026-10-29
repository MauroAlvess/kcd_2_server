/**
 * Whether the chat is shown, and the one place that says so: the game's own overlay until our card (`chat-card.ts`) takes its
 * place, the card after. The free camera, the character creator and the debug panel's switch hide the chat for a picture and
 * bring it back through here, so they never need to know which of the two is up.
 */

export interface ChatDriver {
    read(): boolean;
    write(visible: boolean): void;
}

const native: ChatDriver = {
    read: () => Chat.isUIVisible(),
    write: (visible) => Chat.setUIVisible(visible),
};

let driver: ChatDriver = native;

export function chatShown(): boolean {
    return driver.read();
}

export function showChat(visible: boolean): void {
    driver.write(visible);
}

/** The card says it is the chat now; null gives the game's own overlay back. */
export function useChatDriver(next: ChatDriver | null): void {
    driver = next ?? native;
}
