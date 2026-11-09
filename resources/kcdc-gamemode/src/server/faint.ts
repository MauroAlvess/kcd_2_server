/**
 * A player who drank until the body gave out (2026-10-25, user: "quando um jogador fica bêbado e desmaia ele fica preso na tela preta e só volta depois de sair
 * e voltar do jogo"). The game's effects run on each client's frame delta, never on the calendar, and the story scene a faint plays is kept from playing in
 * multiplayer, so nothing ends the unconsciousness the way the single-player game would: the body lies black until the session is left. This is the end the
 * game does not give.
 *
 * A server pace looks at every player's consciousness (0 is knocked out). One who has lain down for a while is woken by taking off the families of effect
 * that hold the body down (`unconscious`, and the drink with it, or it knocks the body out again); one still down after that is asked again, and from the
 * third time nursed with the game's own cure. A drunk body is woken sooner than one that was struck down, which is a fight's and not ours to cut short.
 * `/acordar` is the same wake for the one who lies there, once they have been down long enough (`WAKE_ASKED_MS`), and only a drunk one: a blow's knockout is
 * never shortened by the one on the ground.
 *
 * Nothing is written to the player's data, and the log names the player by nickname only.
 */

/** Cadence of the look. */
export const FAINT_TICK_MS = 2_000;

/** A drunk body down this long is woken by the pace. */
export const WAKE_DRUNK_MS = 45_000;

/** A body down for another reason (a blow, a fall) is woken only when it is plainly stuck. */
export const WAKE_OTHER_MS = 150_000;

/** A drunk body can ask to be woken after this long. */
export const WAKE_ASKED_MS = 20_000;

/** Between one try and the next, for a body that is still down. */
export const WAKE_RETRY_MS = 15_000;

/** From this try on, the game's own cure is given as well. */
export const NURSE_FROM_TRY = 3;

/** The families that hold a body down: the faint, and the drink that caused it. */
export const WAKE_FAMILIES: readonly string[] = ["unconscious", "alcohol_drunk"];

/**
 * The effects that hold a drunk body down, taken off by name (2026-11-01: Václav lay 643 s through 37 tries; his body carried `unconscious_alcohol`, with `drunkenness` and
 * `overeat`, and taking the two families off never woke it).
 */
export const WAKE_BUFFS: readonly string[] = ["unconscious_alcohol", "drunkenness"];

/**
 * A drunk body that comes round further than this from where it lay is put back there (2026-11-01, user: "quando um jogador beber demais e desmaiar ele deve acordar no mesmo
 * local que desmaiou"). Moved further than `JUMP_M` between two looks while it lay, it was taken by the game, not carried: where it lay before is kept.
 */
export const SAME_PLACE_M = 3;
export const JUMP_M = 15;

interface Spot {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** What the pace needs of a player: what a player object offers. */
export interface Faintable {
    readonly id: number;
    readonly nickname: string;
    readonly ready: boolean;
    readonly alive: boolean;
    readonly consciousness: number;
    readonly drunkenness: number;
    readonly buffs: readonly { readonly name: string; readonly aiTag: string | null }[];
    readonly position?: Spot;
    clearBuffs(tag: string): boolean;
    removeBuff?(buff: string): boolean;
    teleport?(position: Spot): boolean;
    heal(options?: { health?: boolean; injuries?: boolean; poisons?: boolean; bleeding?: boolean }): boolean;
}

interface Down {
    since: number;
    drunk: boolean;
    tries: number;
    nextAt: number;
    /** Where the body lies, to wake it there; null when its place could not be read. */
    at: Spot | null;
}

const spotOf = (player: Faintable): Spot | null => {
    const at = player.position;
    return at !== undefined && Number.isFinite(at.x) && Number.isFinite(at.y) && Number.isFinite(at.z) ? { x: at.x, y: at.y, z: at.z } : null;
};

const apart = (a: Spot, b: Spot): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export interface Waking {
    ok: boolean;
    message: string;
}

/** The effects the player's game last reported, for the log: what held the body down tells which family to take off. */
function effectsOf(player: Faintable): string {
    const names = player.buffs.map((buff) => buff.name).slice(0, 8);
    return `embriaguez ${player.drunkenness.toFixed(2)}, efeitos: ${names.length === 0 ? "nenhum" : names.join(", ")}`;
}

function drunkBody(player: Faintable): boolean {
    return player.drunkenness > 0 || player.buffs.some((buff) => buff.aiTag === "alcohol_drunk");
}

export class FaintWatch {
    private readonly down = new Map<number, Down>();
    /** Where each body last stood on its feet, at the last look. */
    private readonly standing = new Map<number, Spot>();

    /** One look at everybody; `now` is the clock in milliseconds. */
    tick(players: readonly Faintable[], now: number): void {
        const seen = new Set<number>();
        for (const player of players) {
            if (!player.ready || !player.alive) {
                continue;
            }
            seen.add(player.id);
            if (player.consciousness > 0) {
                this.up(player, now);
                const here = spotOf(player);
                if (here !== null) {
                    this.standing.set(player.id, here);
                }
                continue;
            }
            const drunk = drunkBody(player);
            let state = this.down.get(player.id);
            const here = spotOf(player);
            if (state === undefined) {
                // Where it lies, or where it stood a look ago when the game took the falling body somewhere else.
                const stood = this.standing.get(player.id);
                const at = here !== null && stood !== undefined && apart(here, stood) > JUMP_M ? stood : here;
                state = { since: now, drunk, tries: 0, nextAt: now + (drunk ? WAKE_DRUNK_MS : WAKE_OTHER_MS), at };
                this.down.set(player.id, state);
                console.log(`faint: ${player.nickname} caiu${drunk ? " de bêbado" : ""}; ${effectsOf(player)}; acorda sozinho em ${Math.round((state.nextAt - now) / 1000)} s se não se levantar`);
            } else {
                if (drunk && !state.drunk) {
                    // Drink was found on a body first seen as struck down: it is a drunk one from here on.
                    state.drunk = true;
                    state.nextAt = Math.min(state.nextAt, state.since + WAKE_DRUNK_MS);
                }
                // A body dragged or carried while it lies is followed; one the game took far between two looks is not.
                if (here !== null && (state.at === null || apart(here, state.at) <= JUMP_M)) {
                    state.at = here;
                }
            }
            if (now >= state.nextAt) {
                this.wake(player, state, now);
            }
        }
        // Those who left are forgotten.
        for (const id of [...this.down.keys()]) {
            if (!seen.has(id)) {
                this.down.delete(id);
            }
        }
        for (const id of [...this.standing.keys()]) {
            if (!seen.has(id)) {
                this.standing.delete(id);
            }
        }
    }

    /** The player asks to be woken (`/acordar`). */
    ask(player: Faintable, now: number): Waking {
        const state = this.down.get(player.id);
        if (!player.ready || !player.alive || player.consciousness > 0 || state === undefined) {
            return { ok: false, message: "Você não está desmaiado." };
        }
        if (!state.drunk) {
            return { ok: false, message: "Quem foi derrubado não acorda por comando: espere voltar a si." };
        }
        const waited = now - state.since;
        if (waited < WAKE_ASKED_MS) {
            return { ok: false, message: `Espere mais ${Math.ceil((WAKE_ASKED_MS - waited) / 1000)} s e peça de novo.` };
        }
        this.wake(player, state, now);
        return { ok: true, message: "Você foi acordado." };
    }

    /** How long this player has been down, in milliseconds, or null when they are not. */
    downFor(playerId: number, now: number): number | null {
        const state = this.down.get(playerId);
        return state === undefined ? null : now - state.since;
    }

    forget(playerId: number): void {
        this.down.delete(playerId);
        this.standing.delete(playerId);
    }

    private up(player: Faintable, now: number): void {
        const state = this.down.get(player.id);
        if (state === undefined) {
            return;
        }
        this.down.delete(player.id);
        console.log(`faint: ${player.nickname} voltou a si depois de ${Math.round((now - state.since) / 1000)} s${state.tries > 0 ? `, com ${state.tries} tentativa(s) do servidor` : ""}`);
        // A drunk one wakes where it fell.
        const here = spotOf(player);
        if (state.drunk && state.at !== null && here !== null && apart(here, state.at) > SAME_PLACE_M) {
            let back = false;
            try {
                back = player.teleport?.(state.at) === true;
            } catch {
                back = false;
            }
            console.log(`faint: ${player.nickname} acordou a ${Math.round(apart(here, state.at))} m de onde caiu: ${back ? "posto de volta lá" : "o jogo não deixou pôr de volta"}`);
        }
    }

    private wake(player: Faintable, state: Down, now: number): void {
        state.tries += 1;
        state.nextAt = now + WAKE_RETRY_MS;
        let sent = 0;
        for (const family of WAKE_FAMILIES) {
            try {
                if (player.clearBuffs(family)) {
                    sent += 1;
                }
            } catch {
                // A family the game's tables do not know: the others are still asked.
            }
        }
        // The drunk faint's own effects, by name: the families above leave them on.
        for (const buff of state.drunk ? WAKE_BUFFS : []) {
            try {
                if (player.buffs.some((one) => one.name === buff) && player.removeBuff?.(buff) === true) {
                    sent += 1;
                }
            } catch {
                // An effect the game's tables do not know.
            }
        }
        let nursed = false;
        if (state.tries >= NURSE_FROM_TRY) {
            try {
                nursed = player.heal({ health: false, injuries: false, poisons: true, bleeding: false });
            } catch {
                nursed = false;
            }
        }
        console.log(`faint: ${player.nickname} está caído há ${Math.round((now - state.since) / 1000)} s${state.drunk ? " (bêbado)" : ""}: acordando, tentativa ${state.tries} (${sent} pedido(s) ao jogo dele${nursed ? ", e a cura do jogo" : ""})`);
    }
}

export const faintWatch = new FaintWatch();

export function installFaint(): void {
    const timer = setInterval(() => faintWatch.tick(Player.all() as unknown as Faintable[], Date.now()), FAINT_TICK_MS);
    Events.on("playerDisconnect", (player) => faintWatch.forget(player.id));
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(timer);
        }
    });
    console.log(`faint: quem fica caído de bêbado é acordado em ${WAKE_DRUNK_MS / 1000} s (outro motivo: ${WAKE_OTHER_MS / 1000} s); /acordar após ${WAKE_ASKED_MS / 1000} s`);
}
