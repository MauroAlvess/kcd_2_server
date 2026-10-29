/**
 * Voice, the client's half (`src/server/voice-settings.ts`, 2026-10-23).
 *
 * **The microphone is open** (user: "ao segurar o H abre o voip ... o mod permite tirar do push para open o tempo inteiro"): it sends
 * whenever the player speaks (`voiceActivity`), with the noise of the room filtered out and an activation level of the player's choosing
 * (Opções, Microfone: alta, média, baixa). Whoever prefers it may go back to holding the voice key, H, which the game keeps (this module no
 * longer asks for another key: it asked for V, which was never the one the players used). The choice is the player's, kept by the server with
 * the other options, asked for once the player is in the world and said again when it changes. Until the server has answered, the
 * microphone sends only while the key is held, so that nothing is sent by a profile that starts "very sensitive".
 *
 * **The indicator is ours** (user: "ao invés de ficar o ícone na esquerda vamos criar um retângulo no nosso padrão de cor, ícone do voip com a
 * cor do alcance, sussurro, fala e grito, e aquele efeito de ruído mostrando se falando alto ou baixo, acima da barra de vida, na parte
 * inferior no centro da tela; e ao apertar Y, que muda o alcance, o mesmo padrão de layout"). The mod's own (a microphone low on the left
 * while the player sends, and a talking icon on the nametag of whoever they hear) is hidden once our page (`ui/voice.html`) is up; should
 * the page not come up, the mod's stays. The page is a small view at the bottom centre, hidden while nobody speaks (a view that is shown
 * paints every frame): it comes up while the player speaks, with the colour of the range they are on and the bars of the microphone's
 * level, and for a moment after the range was changed, which is read from `Voice.getTier()` (the key, Y, is the mod's own).
 */

import { chatShown } from "./chat-state.js";

const RESOURCE = "kcdc-gamemode";
const PAGE = `fw://resources/${RESOURCE}/ui/voice.html`;
const STATE = `${RESOURCE}:voice.state`;
const ASK = `${RESOURCE}:voice.get`;
const SET = `${RESOURCE}:voice.set`;

export type Mic = "aberto" | "apertar";
export type Sensitivity = "alta" | "media" | "baixa";

/** Where the open microphone starts to send, on the scale of `Voice.getInputLevel` (0 to 1), by the player's choice. */
export const THRESHOLDS: Readonly<Record<Sensitivity, number>> = { alta: 0.02, media: 0.04, baixa: 0.08 };

/** How far whisper, speech and shout carry until the server says (the framework's own). */
export const DEFAULT_RANGES: readonly number[] = [3, 15, 25];

/** How often the voice is looked at, how long the indicator stays after the last word and after a change of range, and how long it fades. */
export const LOOK_MS = 66;
export const HANG_MS = 700;
export const FLASH_MS = 2_400;
export const FADE_MS = 600;
/** How long the page has to say it drew, and how long the server has to answer before the defaults stand. */
const READY_WAIT_MS = 8_000;
const SETTLE_WAIT_MS = 10_000;
/** How many spells of speech of a session are written to the log, each with the loudest level the microphone read. */
const SPELLS_LOGGED = 40;

export const isMic = (value: unknown): value is Mic => value === "aberto" || value === "apertar";
export const isSensitivity = (value: unknown): value is Sensitivity => value === "alta" || value === "media" || value === "baixa";

/**
 * The microphone's level as the bars show it: a decibel scale, so that a low voice is a low bar and a loud one a tall bar, not an on and an off.
 * -42 dB (0.008, a hiss) is nothing, -10 dB (0.32, a shout into the microphone) is everything; the open microphone's sensitivities
 * (0.02 to 0.08) fall between a quarter and two thirds of the way up. Unverified in game: if every word fills the bars or none does, these two.
 */
export const LEVEL_FLOOR_DB = -42;
export const LEVEL_CEIL_DB = -10;

export function levelScale(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) {
        return 0;
    }
    const decibels = 20 * Math.log10(raw);
    return Math.max(0, Math.min(1, (decibels - LEVEL_FLOOR_DB) / (LEVEL_CEIL_DB - LEVEL_FLOOR_DB)));
}

/** Where the indicator goes for a screen of this size: the middle, a hand above the bottom (the health bar stands there). */
export function hudGeometry(screen: { width: number; height: number }): { x: number; y: number; width: number; height: number } {
    // A small plate (2026-10-24: "vamos deixar menor, tá muito grande"): 15% of the width between 230 and 310 px, 4% of the height between 38 and 50.
    const width = Math.round(Math.max(230, Math.min(310, screen.width * 0.15)));
    const height = Math.round(Math.max(38, Math.min(50, screen.height * 0.04)));
    return { x: Math.round((screen.width - width) / 2), y: Math.round(screen.height - height - screen.height * 0.118), width, height };
}

function parse(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function reasonOf(thrown: unknown): string {
    return thrown instanceof Error ? thrown.message : String(thrown);
}

export function installVoice(): void {
    let mic: Mic = "aberto";
    let sensitivity: Sensitivity = "media";
    let ranges: number[] = [...DEFAULT_RANGES];
    /** What was last put on the microphone, so that it is not put again at every answer. */
    let applied = "";
    let settled = false;
    let askedAt = 0;
    /** Choices sent to the server and not answered yet: an older answer must not undo a newer choice. */
    let pending = 0;

    let view = -1;
    let ready = false;
    let failed = false;
    let createdAt = 0;
    let screen = "";
    let hidden = false;
    let visible = false;
    let fadingSince = 0;
    let talkedAt = -Infinity;
    let flashUntil = 0;
    let lastTier = -1;
    /** The spell of speech now going on: when it began and the loudest the microphone read, for the log that tunes the sensitivities. */
    let spellStart = 0;
    let spellPeak = 0;
    let spellsLogged = 0;

    // Until the server has said what this player chose, nothing is sent unless the key is held.
    try {
        Voice.setTransmitMode("pushToTalk");
    } catch (thrown: unknown) {
        console.error(`voice: could not put push-to-talk on until the choice is known: ${reasonOf(thrown)}`);
    }

    const apply = (): void => {
        const key = `${mic}:${sensitivity}`;
        if (key === applied) {
            return;
        }
        applied = key;
        try {
            if (mic === "aberto") {
                Voice.setTransmitMode("voiceActivity");
                Voice.setActivationThreshold(THRESHOLDS[sensitivity]);
                Voice.setNoiseSuppression(true);
                console.log(`voice: ${Voice.getTransmitMode()}, level ${THRESHOLDS[sensitivity]} (${sensitivity})`);
            } else {
                Voice.setTransmitMode("pushToTalk");
                console.log(`voice: ${Voice.getTransmitMode()} on ${Voice.getPushToTalkKey().toUpperCase()}`);
            }
        } catch (thrown: unknown) {
            console.error(`voice: could not put the microphone on ${mic}: ${reasonOf(thrown)}`);
        }
    };

    const announce = (): void => {
        void Events.emitLocal("voice.state", { mic, sensitivity, ranges }).catch(() => undefined);
    };

    const restoreIndicator = (): void => {
        if (!hidden) {
            return;
        }
        hidden = false;
        try {
            Voice.setIndicatorVisible(true);
        } catch {
            // Not in this build.
        }
    };

    const fail = (why: string): void => {
        console.log(`voice: ${why}; fica o indicador do mod`);
        failed = true;
        ready = false;
        visible = false;
        if (view >= 0) {
            try {
                Web.destroyView(view);
            } catch {
                // It is gone already.
            }
            view = -1;
        }
        restoreIndicator();
    };

    const create = (): void => {
        const size = Web.getScreenSize();
        const spot = hudGeometry(size);
        try {
            view = Web.createView(PAGE, { width: spot.width, height: spot.height, x: spot.x, y: spot.y, zIndex: 55, visible: false, focus: false });
        } catch (thrown: unknown) {
            view = -1;
            fail(`a página não abriu (${reasonOf(thrown)})`);
            return;
        }
        screen = `${size.width}x${size.height}`;
        createdAt = Date.now();
        const id = view;
        Web.on(view, "voice:ready", () => {
            if (id !== view || ready) {
                return;
            }
            ready = true;
            try {
                Voice.setIndicatorVisible(false);
                hidden = true;
            } catch (thrown: unknown) {
                console.error(`voice: the mod's indicator could not be hidden: ${reasonOf(thrown)}`);
            }
        });
    };

    const place = (): void => {
        const size = Web.getScreenSize();
        const key = `${size.width}x${size.height}`;
        if (key !== screen) {
            screen = key;
            const spot = hudGeometry(size);
            Web.resizeView(view, spot.width, spot.height);
            Web.setViewPosition(view, spot.x, spot.y);
        }
    };

    const enabled = (): boolean => {
        try {
            return Voice.isEnabled();
        } catch {
            return true;
        }
    };

    /** One look at the voice: what the player is doing, and what the indicator is to show for it. */
    const look = (now: number): void => {
        let talking = false;
        let tier = lastTier;
        try {
            talking = Voice.isTalking();
            tier = Voice.getTier();
        } catch {
            // The voice is not up yet.
        }
        if (tier !== lastTier) {
            if (lastTier !== -1) {
                flashUntil = now + FLASH_MS;
            }
            lastTier = tier;
        }
        let raw = 0;
        if (talking) {
            talkedAt = now;
            try {
                raw = Voice.getInputLevel();
            } catch {
                raw = 0;
            }
            if (spellStart === 0) {
                spellStart = now;
                spellPeak = 0;
            }
            spellPeak = Math.max(spellPeak, raw);
        } else if (spellStart !== 0 && now - talkedAt >= HANG_MS) {
            if (spellsLogged < SPELLS_LOGGED) {
                spellsLogged += 1;
                console.log(`voice: falou ${((talkedAt - spellStart) / 1000).toFixed(1)} s, nível máximo ${spellPeak.toFixed(3)} (${mic}, abre em ${THRESHOLDS[sensitivity]})`);
            }
            spellStart = 0;
        }
        const flashing = now < flashUntil;
        const showing = enabled() && chatShown() && (talking || now - talkedAt < HANG_MS || flashing);
        if (showing) {
            if (!visible) {
                Web.showView(view);
                visible = true;
            }
            fadingSince = 0;
            Web.emit(view, "voice:state", { on: true, talking, level: levelScale(raw), tier, ranges, flash: flashing });
            return;
        }
        if (!visible) {
            return;
        }
        if (fadingSince === 0) {
            fadingSince = now;
            Web.emit(view, "voice:state", { on: false, talking: false, level: 0, tier, ranges, flash: false });
        } else if (now - fadingSince >= FADE_MS) {
            Web.hideView(view);
            visible = false;
            fadingSince = 0;
        }
    };

    const tick = (): void => {
        const now = Date.now();
        if (askedAt === 0 && LocalPlayer?.ready) {
            askedAt = now;
            Events.emitServer(ASK);
        }
        // The server said nothing (an old one): the open microphone, as the defaults have it.
        if (!settled && askedAt > 0 && now - askedAt > SETTLE_WAIT_MS) {
            settled = true;
            apply();
            announce();
        }
        if (failed) {
            return;
        }
        if (view < 0) {
            if (LocalPlayer?.ready) {
                create();
            }
            return;
        }
        if (!ready) {
            if (now - createdAt > READY_WAIT_MS) {
                fail("a página não respondeu");
            }
            return;
        }
        place();
        try {
            look(now);
        } catch (thrown: unknown) {
            fail(`o indicador falhou (${reasonOf(thrown)})`);
        }
    };

    // What the server keeps for this player: at the start, and as the answer to each choice. Only the answer to the newest choice is applied.
    Events.on(STATE, (payload) => {
        if (pending > 0) {
            pending -= 1;
            if (pending > 0) {
                return;
            }
        }
        const fields = parse(payload);
        if (isMic(fields["mic"])) {
            mic = fields["mic"];
        }
        if (isSensitivity(fields["sensitivity"])) {
            sensitivity = fields["sensitivity"];
        }
        const sent = fields["ranges"];
        if (Array.isArray(sent) && sent.length === 3 && sent.every((metres) => typeof metres === "number" && Number.isFinite(metres) && metres > 0)) {
            ranges = sent.map(Number);
        }
        settled = true;
        apply();
        announce();
    });

    // A choice from the panel: put on now, then kept by the server.
    Events.onLocal("voice.choose", (payload) => {
        const fields = parse(payload);
        const nextMic = isMic(fields["mic"]) ? fields["mic"] : mic;
        const nextSensitivity = isSensitivity(fields["sensitivity"]) ? fields["sensitivity"] : sensitivity;
        if (nextMic === mic && nextSensitivity === sensitivity) {
            announce();
            return;
        }
        mic = nextMic;
        sensitivity = nextSensitivity;
        settled = true;
        apply();
        announce();
        pending += 1;
        Events.emitServer(SET, JSON.stringify({ mic, sensitivity }));
    });
    Events.onLocal("voice.ask", () => announce());

    Events.on("browserLoadingFailed", (event) => {
        if (view >= 0 && event.isMainFrame && event.viewId === view && !failed) {
            fail(`a página não carregou (${event.description})`);
        }
    });

    const timer = setInterval(() => {
        try {
            tick();
        } catch (thrown: unknown) {
            console.error(`voice: ${reasonOf(thrown)}`);
        }
    }, LOOK_MS);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearInterval(timer);
        if (view >= 0) {
            try {
                Web.destroyView(view);
            } catch {
                // It is gone already.
            }
            view = -1;
        }
        restoreIndicator();
    });
}
