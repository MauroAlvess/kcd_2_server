/**
 * Each player's own settings, from the "Opções" section of the panel: whether they play in third person and how far
 * behind them the camera sits, (2026-10-23) how their microphone opens, and (2026-10-25) how big the server's pages are drawn. They are kept here, by Steam id in
 * `playerdata/options.json`, because the game's client has no storage of its own; so the choice follows the player to
 * any computer.
 *
 * The client asks for them once the player is in the world and applies them itself (`src/client/camera.ts`): the view
 * is that machine's own, the server only remembers it. A choice the client sends is checked field by field and kept;
 * the answer is the whole of what is kept, so the client and the page always draw what the server holds.
 */

import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/options.json`;

/** How far behind the player the third-person camera sits: the client turns each into metres. */
export const VIEWS = ["perto", "normal", "longe"] as const;
export type CameraView = (typeof VIEWS)[number];

/**
 * How the microphone opens (user, 2026-10-23: "o mod permite tirar do push para open o tempo inteiro"): `aberto` sends whenever the
 * player speaks, `apertar` only while the voice key (H) is held; and how sensitive the open one is.
 */
export const MIC_MODES = ["aberto", "apertar"] as const;
export type MicMode = (typeof MIC_MODES)[number];
export const SENSITIVITIES = ["alta", "media", "baixa"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

/**
 * How big the server's pages are drawn, in percent of what fits the screen (user, 2026-10-25: "uma opção de resolução para o jogador poder mudar a
 * resolução da interface"): the panel, the trades, the creator, the notice board, the welcome and the chat (`src/client/ui-scale.ts`).
 */
export const UI_SCALES = ["80", "90", "100", "110", "125"] as const;
export type UiScale = (typeof UI_SCALES)[number];

export interface PlayerOptions {
    readonly thirdPerson: boolean;
    readonly view: CameraView;
    readonly mic: MicMode;
    readonly sensitivity: Sensitivity;
    readonly ui: UiScale;
}

export const DEFAULT_OPTIONS: PlayerOptions = { thirdPerson: false, view: "normal", mic: "aberto", sensitivity: "media", ui: "100" };

let cache: Record<string, PlayerOptions> | null = null;

function isView(value: unknown): value is CameraView {
    return typeof value === "string" && (VIEWS as readonly string[]).includes(value);
}

export function isMicMode(value: unknown): value is MicMode {
    return typeof value === "string" && (MIC_MODES as readonly string[]).includes(value);
}

export function isSensitivity(value: unknown): value is Sensitivity {
    return typeof value === "string" && (SENSITIVITIES as readonly string[]).includes(value);
}

export function isUiScale(value: unknown): value is UiScale {
    return typeof value === "string" && (UI_SCALES as readonly string[]).includes(value);
}

/** A stored or sent record with every field valid; anything missing or wrong falls back to `base`. */
function normalize(raw: unknown, base: PlayerOptions): PlayerOptions {
    const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const third = r["thirdPerson"];
    return {
        thirdPerson: typeof third === "boolean" ? third : third === 1 ? true : third === 0 ? false : base.thirdPerson,
        view: isView(r["view"]) ? r["view"] : base.view,
        mic: isMicMode(r["mic"]) ? r["mic"] : base.mic,
        sensitivity: isSensitivity(r["sensitivity"]) ? r["sensitivity"] : base.sensitivity,
        ui: isUiScale(r["ui"]) ? r["ui"] : base.ui,
    };
}

function load(): Record<string, PlayerOptions> {
    if (cache !== null) {
        return cache;
    }
    cache = {};
    const loaded = read<Record<string, unknown>>(FILE);
    if (loaded.status === "ok") {
        for (const [steamId, raw] of Object.entries(loaded.value)) {
            cache[steamId] = normalize(raw, DEFAULT_OPTIONS);
        }
    } else if (loaded.status === "corrupt") {
        console.error(`options: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    return cache;
}

function persist(): void {
    try {
        ensureDir(DIR);
        write(FILE, load());
    } catch (error: unknown) {
        console.log(`options: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** What `steamId` chose, or the defaults for somebody who never chose (and for a player with no Steam id). */
export function optionsOf(steamId: string): PlayerOptions {
    return steamId === "" ? DEFAULT_OPTIONS : (load()[steamId] ?? DEFAULT_OPTIONS);
}

/**
 * Keeps the fields of `change` that are valid over what `steamId` had. Returns what is kept now. A player with no
 * Steam id gets the defaults back and nothing is written: there is nobody to keep it for.
 */
export function chooseOptions(steamId: string, change: unknown): PlayerOptions {
    if (steamId === "") {
        return DEFAULT_OPTIONS;
    }
    const before = optionsOf(steamId);
    const after = normalize(change, before);
    if (after.thirdPerson !== before.thirdPerson || after.view !== before.view || after.mic !== before.mic || after.sensitivity !== before.sensitivity || after.ui !== before.ui) {
        load()[steamId] = after;
        persist();
    }
    return after;
}

function fieldsOf(payload: unknown): unknown {
    if (typeof payload === "string" && payload.length <= 256) {
        try {
            return JSON.parse(payload) as unknown;
        } catch {
            return {};
        }
    }
    return payload;
}

function answer(player: Player, options: PlayerOptions): void {
    player.emit(`${RESOURCE}:options.state`, JSON.stringify(options));
}

export function installOptions(): void {
    Events.onClient(`${RESOURCE}:options.get`, (sender) => {
        const player = sender as Player;
        answer(player, optionsOf(player.steamId));
    });
    Events.onClient(`${RESOURCE}:options.set`, (sender, payload) => {
        const player = sender as Player;
        answer(player, chooseOptions(player.steamId, fieldsOf(payload)));
    });
}
