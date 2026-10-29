/**
 * The game's own item icons in the trades' page (`craft-page.ts`). The page is a browser page and cannot read the game's
 * archives, and the icons are too many to ship (3,576 of them; the client package has a few KB to spare), so they are drawn
 * by the game itself: a native screen of ours (`NativeUI`) loads each from the archive (`img://Libs/UI/Textures/Icons/Items/`)
 * into a clip, and puts it where the page says each slot is, as shares of the screen. The page leaves the slots see-through
 * once it is told the icons are up (`craft:icons`), whichever of the two is drawn over the other. Behind each icon is the
 * colour of the paper at that slot, which the page works out (`bg`): the icons are see-through around the object, and the
 * first round's dark square made every one a black box (2026-10-18).
 */

export interface IconSlot {
    readonly icon: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    /** The paper's colour there, 0xRRGGBB. */
    readonly bg?: number;
}

/** How big the game draws an icon by itself, in stage units: the archive's icons are 64 pixels. */
const NATURAL = 64;
const ICONS = "img://Libs/UI/Textures/Icons/Items/";
/** The paper's colour in the middle of the page, for a slot the page gave none. */
const PAPER = 0xc6a77f;

let screen: NativeScreen | null = null;
let ready = false;
let failed = false;
let clips: NativeClip[] = [];
let wanted: readonly IconSlot[] = [];
let visible = false;
const listeners: Array<(on: boolean) => void> = [];

function clear(): void {
    for (const clip of clips) {
        try {
            clip.remove();
        } catch {
            // Gone with the screen.
        }
    }
    clips = [];
}

function draw(): void {
    clear();
    if (!ready || screen === null || !visible) {
        return;
    }
    const root = screen.root;
    if (root === null) {
        return;
    }
    for (const slot of wanted) {
        const from = screen.screenToStage(slot.x, slot.y);
        const to = screen.screenToStage(slot.x + slot.w, slot.y + slot.h);
        if (from === null || to === null || slot.icon === "") {
            continue;
        }
        const holder = root.createClip();
        if (holder === null) {
            continue;
        }
        // The paper behind the icon, so a see-through slot is never the world behind the page.
        holder.invoke("beginFill", [slot.bg ?? PAPER, 100]);
        holder.invoke("moveTo", [0, 0]);
        holder.invoke("lineTo", [NATURAL, 0]);
        holder.invoke("lineTo", [NATURAL, NATURAL]);
        holder.invoke("lineTo", [0, NATURAL]);
        holder.invoke("endFill");
        const picture = holder.createClip();
        picture?.load(`${ICONS}${slot.icon}_icon.dds`);
        holder.set({ x: from.x, y: from.y, scaleX: (to.x - from.x) / NATURAL, scaleY: (to.y - from.y) / NATURAL, visible: true });
        clips.push(holder);
    }
}

function open(): void {
    if (screen !== null || failed) {
        return;
    }
    try {
        screen = NativeUI.createScreen();
    } catch (error: unknown) {
        failed = true;
        console.log(`craft icons: no native screen (${error instanceof Error ? error.message : String(error)}); the page keeps its signs`);
        return;
    }
    screen.on("ready", () => {
        ready = true;
        screen?.setVisible(visible);
        for (const listener of listeners) {
            listener(true);
        }
        draw();
    });
    screen.on("unload", () => {
        ready = false;
        clips = [];
        for (const listener of listeners) {
            listener(false);
        }
    });
}

/** Told whenever the icons come up or go (the page shows its own signs while they are not). */
export function onIcons(listener: (on: boolean) => void): void {
    listeners.push(listener);
}

export function iconsUp(): boolean {
    return ready;
}

/** The slots of the page now: the icons are drawn there. */
export function showIcons(slots: readonly IconSlot[]): void {
    wanted = slots;
    visible = true;
    open();
    if (ready) {
        screen?.setVisible(true);
        draw();
    }
}

export function hideIcons(): void {
    visible = false;
    wanted = [];
    clear();
    if (ready) {
        screen?.setVisible(false);
    }
}
