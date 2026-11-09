/**
 * What is over a head is read only by who knows the one it is over (2026-11-04, user: "título na cabeça e título de ladrão só aparece acima da cabeça para quem já se apresentou a outro
 * jogador, e sempre que um jogador morre todo mundo que se apresentou pra ele desapresenta").
 *
 * The title the player chose to wear and the thief's mark (`titles.ts` `headOf`) used to be the game's nametag, the same for everybody. The nametag is now a blank line (`applyNametag`), and the
 * text is a label that each player's own client hangs on it (`Nametags.setLabel`, local to that client): the server tells each player, alone, the labels of the players they have been
 * introduced to -- `acquaintances.ts`: one of the two told the other their name, whichever way (the user's words, "para quem já se apresentou a outro jogador", read both ways) --
 * and tells again when something that decides it changes: a title chosen or taken, a mark put on or run out, an introduction, a death that forgot them all (`acquaintances.ts`
 * `installAcquaintances`, both ways), somebody coming in or going out. A stranger reads nothing over the head, as before they read no name.
 *
 * Told by `kcdc-gamemode:head.labels` `{ labels: [{ id, text, colour }] }`, always the whole list of that player, and only when it is not the one already told; the client says
 * `head.ask` once it is in the world. A change is told a moment later, so that a burst of them (a crowd coming in) is one telling.
 */

import { knows, onKnowledgeChange } from "./acquaintances.js";
import { headOf, onHeadChange } from "./titles.js";

const RESOURCE = "kcdc-gamemode";

export const LABELS_EVENT = `${RESOURCE}:head.labels`;
export const ASK_EVENT = `${RESOURCE}:head.ask`;

/** How long a change waits for others before it is told. */
export const TELL_AFTER_MS = 250;

export interface HeadLabel {
    readonly id: number;
    readonly text: string;
    readonly colour: number;
}

/** Whether one of the two was told the other's name: they have been introduced, whichever way it went. */
export function introduced(a: Player, b: Player): boolean {
    return knows(a, b) || knows(b, a);
}

/** The labels `viewer` may read over the heads of `others`: the ones that wear something, and to whom the viewer has been introduced. Never their own. */
export function labelsFor(viewer: Player, others: readonly Player[]): HeadLabel[] {
    const labels: HeadLabel[] = [];
    for (const other of others) {
        if (other.id === viewer.id || other.steamId === "") {
            continue;
        }
        const head = headOf(other);
        if (head !== null && introduced(viewer, other)) {
            labels.push({ id: other.id, text: head.text, colour: head.colour });
        }
    }
    return labels;
}

/** What each player was last told, as the text of the list: only a different list is told again. */
const told = new Map<number, string>();
let pending: ReturnType<typeof setTimeout> | null = null;

/** Tells `only`, or everybody who is in the game, the labels they may read, when they are not the ones they were told. */
export function tellLabels(only?: Player): number {
    const everyone = Player.all();
    let sent = 0;
    for (const viewer of only === undefined ? everyone : [only]) {
        if (!viewer.ready) {
            continue;
        }
        const body = JSON.stringify({ labels: labelsFor(viewer, everyone) });
        if (told.get(viewer.id) === body) {
            continue;
        }
        try {
            viewer.emit(LABELS_EVENT, body);
            told.set(viewer.id, body);
            sent += 1;
        } catch {
            // Gone between the list and here.
        }
    }
    return sent;
}

function soon(): void {
    if (pending !== null) {
        return;
    }
    pending = setTimeout(() => {
        pending = null;
        tellLabels();
    }, TELL_AFTER_MS);
}

export function installHeadLabels(): void {
    onHeadChange(() => soon());
    onKnowledgeChange(() => soon());
    Events.onClient(ASK_EVENT, (sender) => {
        const viewer = sender as Player;
        told.delete(viewer.id);
        tellLabels(viewer);
    });
    Events.on("playerSpawned", () => soon());
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
        soon();
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE && pending !== null) {
            clearTimeout(pending);
            pending = null;
        }
    });
    console.log("head-labels: o título e a marca de ladrão só aparecem para quem conhece o jogador");
}
