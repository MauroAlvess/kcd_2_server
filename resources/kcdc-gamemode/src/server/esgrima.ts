/**
 * Esgrima: the weapon combos, taught from one player to another (user, 2026-10-26: "vamos criar a categoria combate, uma seção nova chamada
 * esgrima; todo admin recebe todas habilidades de esgrima: ele aprende todos combos de armas; na seção esgrima vai aparecer, na mesma ideia do
 * padrão de informações, o nome do combo; ao clicar, as informações do combo e o botão ensinar e retirar; um admin pode ensinar um combo a
 * outro jogador, e quando um player comum aprender um combo ele recebe acesso à seção, também categoria combate, e pode ensinar outros jogadores o
 * combo que aprendeu mas não pode retirar: só um admin vê o botão retirar").
 *
 * A combo is a perk of the game's tables (`combo-data.ts`: 51 of them, by weapon), which the game hands a character by itself as its weapon skill
 * reaches a level -- the twelve of the fifth level to every one of them, which is why 63 of the 80 saved characters held twelve when this was
 * written. Here nobody gets one by playing:
 *
 * - **they are blocked** (`Progression.blockPerks`): the game's own grants are turned down on every client, and `player.addPerk` still works;
 * - **they are taught**: by an administrator to anybody, by a player to anybody, of the ones the teacher knows (`teach`); only an administrator
 *   takes one away (`retire`); an administrator is given all of them at every entry;
 * - **they are kept here** (`playerdata/esgrima.json`, by Steam id): a character starts every session blank and its saved perks are put back by
 *   the game's own restore (`character-state.ts`), which since KCDC 1.7.2 leaves a blocked perk out ("takes perks out of the game: ... and
 *   `player.restoreProgression` leaves it out ... `player.addPerk` still grants one, as the script's own decision"), so the combos are left out of
 *   what is restored (`takeOut`), kept in this file, and handed over a little after by `addPerk` (`refill`: all of them in a few quick rounds, and
 *   whatever the game did not take, once more, a few at a time);
 * - **those already held are kept**: the combos a saved character had when this began are written down at its next entry (`takeOut` again), so
 *   nobody loses what they had; an administrator can take them away;
 * - **the role only lends them** (user, 2026-10-26: "ao virar admin usando o comando o personagem deve aprender todos combos de uma vez"): whoever becomes
 *   an administrator, at an entry or by `/admin <ticket>` mid-session, is given all of them at once (`roleChanged`), and may give one to themselves in the
 *   section; what the role lent is never written down as theirs (`takeOut` ignores a full set, and the character's saved progression carries no combo at
 *   all: `leaveOutCombos`), and `/admin sair` takes it out of their game again, so a test as a common player is a test as one.
 *
 * The section of the panel (`ui-src/status.html`, category Combate) is shown to an administrator and to whoever knows one combo at least.
 */

import { nameOf } from "./acquaintances.js";
import { isAdmin } from "./auth.js";
import { COMBOS, COMBO_FINISHERS, COMBO_GROUPS } from "./combo-data.js";
import type { Combo } from "./combo-data.js";
import { languageOf } from "./language.js";
import { addPayload, notice } from "./status.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/esgrima.json`;
const STEAM_ID = /^\d{5,20}$/;

/**
 * How long after a player is ready their combos are put back: after the checks of `character-state.ts`, which restore their levels again at 5 and at 20
 * seconds if they lag, and would drop what was added meanwhile.
 */
export const REFILL_AFTER_MS = 25_000;
/** How long the game gets to take the combos handed over before what it did not take is given once more. */
export const CHECK_AFTER_MS = 4_000;
/** The combos are handed over this many at a time, this far apart: all of them, to the eye (51 for an administrator are four rounds, a second). */
export const GIVE_ROUND = 13;
export const GIVE_EVERY_MS = 300;
/** What the game did not take is given once more this many at a time, this far apart (the game may say "Você aprendeu um novo combo" for each). */
export const BATCH = 4;
export const BATCH_EVERY_MS = 2_500;

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

const BY_PERK = new Map<string, Combo>(COMBOS.map((combo) => [combo.perk, combo]));

/** A line in the player's language: the names of the combos are the game's own, in each, and the panel's dictionary has no pattern for them. */
function said(player: Player, portuguese: string, english: string): string {
    return languageOf(player) === "en" ? english : portuguese;
}

/** A combo's name in the player's language. */
function called(player: Player, combo: Combo): string {
    return languageOf(player) === "en" ? combo.name[1] || combo.name[0] : combo.name[0];
}

/** Whether this perk is one of the combos. */
export function isCombo(perk: string): boolean {
    return BY_PERK.has(perk);
}

/** The combos a list of perks holds, by perk name, each once. */
function combosIn(perks: readonly string[]): string[] {
    return [...new Set(perks.filter((perk) => BY_PERK.has(perk)))];
}

/** What the page lists of a combo. */
export interface EsgrimaRow {
    readonly id: string;
    readonly code: string;
    readonly group: string;
    readonly level: number;
    readonly name: string;
}

export interface EsgrimaView {
    readonly admin: boolean;
    readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>;
    readonly combos: readonly EsgrimaRow[];
}

export interface EsgrimaInfo {
    readonly id: string;
    readonly name: string;
    readonly group: string;
    readonly level: number;
    readonly desc: string;
    readonly lore: string;
    readonly finisher: string;
    readonly charged: boolean;
    readonly steps: number;
}

export class Esgrima {
    /** What each player is known to have been taught or to have held, by Steam id, perk names. */
    private kept: Record<string, string[]> = {};
    /** False while the file could not be read: nothing is written over it then. */
    private writable = true;

    load(): void {
        const loaded = read<Record<string, unknown>>(FILE);
        if (loaded.status === "corrupt") {
            this.writable = false;
            console.log(`esgrima: ${FILE} ilegível (${loaded.reason}); nada será gravado por cima até que seja consertado`);
            return;
        }
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        for (const [steamId, raw] of Object.entries(loaded.value)) {
            if (STEAM_ID.test(steamId) && Array.isArray(raw)) {
                const combos = combosIn(raw.filter((one): one is string => typeof one === "string"));
                if (combos.length > 0) {
                    this.kept[steamId] = combos;
                }
            }
        }
    }

    private persist(): void {
        if (!this.writable) {
            return;
        }
        try {
            ensureDir(DIR);
            write(FILE, this.kept);
        } catch (error: unknown) {
            console.log(`esgrima: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /** What is written down for this player. */
    keptFor(steamId: string): readonly string[] {
        return this.kept[steamId] ?? [];
    }

    /** Writes combos down for a player. True when something was new. */
    private keep(steamId: string, combos: readonly string[]): boolean {
        if (!STEAM_ID.test(steamId)) {
            return false;
        }
        const have = new Set(this.kept[steamId] ?? []);
        const fresh = combosIn(combos).filter((perk) => !have.has(perk));
        if (fresh.length === 0) {
            return false;
        }
        this.kept[steamId] = [...have, ...fresh];
        this.persist();
        return true;
    }

    private unkeep(steamId: string, perk: string): void {
        const have = this.kept[steamId];
        if (have === undefined || !have.includes(perk)) {
            return;
        }
        const left = have.filter((one) => one !== perk);
        if (left.length === 0) {
            delete this.kept[steamId];
        } else {
            this.kept[steamId] = left;
        }
        this.persist();
    }

    /** A deleted character's combos go with it ("Apagar personagem"). True when there were any. */
    forget(steamId: string): boolean {
        if (this.kept[steamId] === undefined) {
            return false;
        }
        delete this.kept[steamId];
        this.persist();
        return true;
    }

    /** The combos a player has in their game now. */
    private live(player: Player): string[] {
        try {
            return combosIn(player.perks);
        } catch {
            return [];
        }
    }

    /** The combos this player knows: all of them for an administrator, otherwise what is written down and what their game holds. */
    known(player: Player): Set<string> {
        if (isAdmin(player)) {
            return new Set(BY_PERK.keys());
        }
        return new Set([...this.keptFor(player.steamId), ...this.live(player)]);
    }

    /** Whether the section is theirs to see: an administrator, or a player who knows a combo. */
    visible(player: Player): boolean {
        return isAdmin(player) || this.keptFor(player.steamId).length > 0 || this.live(player).length > 0;
    }

    view(player: Player): EsgrimaView {
        const lang = languageOf(player) === "en" ? 1 : 0;
        const known = this.known(player);
        return {
            admin: isAdmin(player),
            groups: COMBO_GROUPS.map((group) => ({ id: group.id, label: group.label[lang] })),
            combos: COMBOS.filter((combo) => known.has(combo.perk)).map((combo) => ({ id: combo.perk, code: combo.code, group: combo.group, level: combo.level, name: combo.name[lang] || combo.name[0] })),
        };
    }

    /** What the page shows when a combo is clicked: only of one the viewer knows. */
    info(player: Player, perk: string): EsgrimaInfo | null {
        const combo = BY_PERK.get(perk);
        if (combo === undefined || !this.known(player).has(perk)) {
            return null;
        }
        const lang = languageOf(player) === "en" ? 1 : 0;
        const group = COMBO_GROUPS.find((one) => one.id === combo.group);
        const finisher = COMBO_FINISHERS[combo.finisher];
        return {
            id: combo.perk,
            name: combo.name[lang] || combo.name[0],
            group: group === undefined ? combo.group : group.label[lang],
            level: combo.level,
            desc: combo.desc[lang] || combo.desc[0],
            lore: combo.lore[lang] || combo.lore[0],
            finisher: finisher === undefined ? combo.finisher : finisher[lang],
            charged: combo.charged,
            steps: combo.steps,
        };
    }

    /** `target` is taught `perk` by `teacher`: an administrator may teach any, a player one they know. */
    teach(teacher: Player, perk: string, targetId: unknown): Outcome {
        const combo = BY_PERK.get(perk);
        if (combo === undefined) {
            return { ok: false, message: said(teacher, "Esse combo não existe.", "That combo does not exist.") };
        }
        if (!this.known(teacher).has(perk)) {
            return { ok: false, message: said(teacher, "Você só ensina os combos que conhece.", "You can only teach the combos you know.") };
        }
        // No target: oneself (the section's "Para mim", which only an administrator is offered).
        if (targetId === undefined || targetId === null) {
            return this.takeForSelf(teacher, combo);
        }
        const target = typeof targetId === "number" && Number.isInteger(targetId) ? Player.getById(targetId) : null;
        if (target === null || !target.ready) {
            return { ok: false, message: said(teacher, "Esse jogador não está mais no servidor.", "That player is no longer on the server.") };
        }
        if (target.id === teacher.id) {
            return this.takeForSelf(teacher, combo);
        }
        if (this.known(target).has(perk)) {
            return { ok: false, message: said(teacher, `${nameOf(target)} já conhece esse combo.`, `${nameOf(target)} already knows that combo.`) };
        }
        if (!this.give(target, perk)) {
            return { ok: false, message: said(teacher, "O jogo não aceitou o combo agora. Tente de novo em instantes.", "The game did not take the combo now. Try again in a moment.") };
        }
        console.log(`esgrima: ${teacher.nickname} ensinou "${combo.name[0]}" (${perk}) a ${target.nickname}`);
        notice(target, said(target, `${nameOf(teacher)} ensinou a você o combo ${called(target, combo)}: veja na seção Esgrima do painel (F2).`, `${nameOf(teacher)} taught you the combo ${called(target, combo)}: see the Fencing section of the panel (F2).`));
        this.tell(target);
        return { ok: true, message: said(teacher, `Você ensinou o combo ${called(teacher, combo)} a ${nameOf(target)}.`, `You taught the combo ${called(teacher, combo)} to ${nameOf(target)}.`) };
    }

    /** An administrator takes `perk` away from `target`. */
    retire(admin: Player, perk: string, targetId: unknown): Outcome {
        const combo = BY_PERK.get(perk);
        if (combo === undefined) {
            return { ok: false, message: said(admin, "Esse combo não existe.", "That combo does not exist.") };
        }
        if (!isAdmin(admin)) {
            return { ok: false, message: said(admin, "Só um administrador retira um combo.", "Only an administrator takes a combo away.") };
        }
        const target = typeof targetId === "number" && Number.isInteger(targetId) ? Player.getById(targetId) : null;
        if (target === null || !target.ready) {
            return { ok: false, message: said(admin, "Esse jogador não está mais no servidor.", "That player is no longer on the server.") };
        }
        if (!this.keptFor(target.steamId).includes(perk) && !this.live(target).includes(perk)) {
            return { ok: false, message: said(admin, `${nameOf(target)} não conhece esse combo.`, `${nameOf(target)} does not know that combo.`) };
        }
        this.unkeep(target.steamId, perk);
        try {
            target.removePerk(perk);
        } catch (error: unknown) {
            console.log(`esgrima: o jogo não tirou ${perk} de ${target.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.log(`esgrima: ${admin.nickname} retirou "${combo.name[0]}" (${perk}) de ${target.nickname}`);
        notice(target, said(target, `Um administrador retirou de você o combo ${called(target, combo)}.`, `An administrator took the combo ${called(target, combo)} from you.`));
        this.tell(target);
        return { ok: true, message: said(admin, `Você retirou o combo ${called(admin, combo)} de ${nameOf(target)}.`, `You took the combo ${called(admin, combo)} from ${nameOf(target)}.`) };
    }

    /**
     * An administrator knows every combo by their role, and the game holds the ones it was given (`refill`): this gives them one the game does not hold,
     * for the moment (it is the role's, so it is not written down). For anybody else there is nothing to take: they know what they hold.
     */
    private takeForSelf(player: Player, combo: Combo): Outcome {
        if (!isAdmin(player) || this.live(player).includes(combo.perk)) {
            return { ok: false, message: said(player, "Você já conhece esse combo.", "You already know that combo.") };
        }
        let taken = false;
        try {
            taken = player.addPerk(combo.perk);
        } catch (error: unknown) {
            console.log(`esgrima: o jogo não aceitou ${combo.perk} para ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!taken) {
            return { ok: false, message: said(player, "O jogo não aceitou o combo agora. Tente de novo em instantes.", "The game did not take the combo now. Try again in a moment.") };
        }
        console.log(`esgrima: ${player.nickname} (administrador) pegou "${combo.name[0]}" (${combo.perk}) para si`);
        this.tell(player);
        return { ok: true, message: said(player, `O combo ${called(player, combo)} voltou ao seu jogo.`, `The combo ${called(player, combo)} is back in your game.`) };
    }

    /**
     * A player's role changed in this session (`/admin <ticket>`, `/admin sair`): an administrator is given every combo at once (the same `refill` as at an
     * entry, with no wait: nothing is being restored now), and one who stops being it keeps only what is theirs, the rest being taken out of their game.
     */
    roleChanged(player: Player, later: (fn: () => void, ms: number) => void = (fn, ms) => void setTimeout(fn, ms)): void {
        if (isAdmin(player)) {
            this.refill(player, later);
        } else {
            this.dropLent(player);
        }
        this.tell(player);
    }

    /** What the role lent: the combos the game holds for a player that are not written down as theirs, taken out of the game. How many. */
    dropLent(player: Player): number {
        const own = new Set(this.keptFor(player.steamId));
        const lent = this.live(player).filter((perk) => !own.has(perk));
        for (const perk of lent) {
            try {
                player.removePerk(perk);
            } catch (error: unknown) {
                console.log(`esgrima: o jogo não tirou ${perk} de ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        if (lent.length > 0) {
            console.log(`esgrima: ${player.nickname} deixou de ser administrador: ${lent.length} combo(s) do cargo saíram do jogo dele`);
        }
        return lent.length;
    }

    /** Gives a player a combo and writes it down. False when the game would not take the order. */
    private give(target: Player, perk: string): boolean {
        let sent = false;
        try {
            sent = target.addPerk(perk);
        } catch (error: unknown) {
            console.log(`esgrima: o jogo não aceitou ${perk} para ${target.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!sent) {
            return false;
        }
        this.keep(target.steamId, [perk]);
        return true;
    }

    /** What a player's page should know after something happened to their combos (the section may have just come to be, or gone). */
    tell(player: Player): void {
        player.emit(`${RESOURCE}:status.esgrima`, JSON.stringify(this.view(player)));
    }

    /**
     * A saved progression without the combos, which are written down for the player and put back by `refill`; and the combos it held. The same
     * object when it held none.
     */
    takeOut(steamId: string, snapshot: ProgressionSnapshot): { readonly snapshot: ProgressionSnapshot; readonly combos: string[] } {
        const combos = combosIn(snapshot.perks);
        if (combos.length === 0) {
            return { snapshot, combos };
        }
        // Every combo at once is what an administrator is lent, saved with their progression before it was told apart (2026-10-26): never written down as theirs.
        if (combos.length >= BY_PERK.size) {
            console.log(`esgrima: um personagem salvo tinha os ${combos.length} combos de uma vez (o cargo de administrador os empresta): não foram guardados como dele`);
            return { snapshot: { ...snapshot, perks: snapshot.perks.filter((perk) => !BY_PERK.has(perk)) }, combos: [] };
        }
        if (this.keep(steamId, combos)) {
            console.log(`esgrima: ${combos.length} combo(s) de um personagem salvo ficam guardados em ${FILE}`);
        }
        return { snapshot: { ...snapshot, perks: snapshot.perks.filter((perk) => !BY_PERK.has(perk)) }, combos };
    }

    /** What a player should have in their game: all, for an administrator; what is written down, for anybody else. */
    wanted(player: Player): string[] {
        return isAdmin(player) ? [...BY_PERK.keys()] : [...this.keptFor(player.steamId)];
    }

    /**
     * Puts back what a player is missing, a while after they came in (or at once, for an administrator made one by `/admin`): by `addPerk`, all of it in a
     * few quick rounds (`restoreProgression` leaves a blocked perk out since KCDC 1.7.2, so it cannot carry them), and then, for what the game did not
     * take, once more a few at a time.
     */
    refill(player: Player, later: (fn: () => void, ms: number) => void = (fn, ms) => void setTimeout(fn, ms)): void {
        const live = new Set(this.live(player));
        const missing = this.wanted(player).filter((perk) => !live.has(perk));
        if (missing.length === 0) {
            return;
        }
        const rounds = this.giveQuickly(player, missing, later);
        const id = player.id;
        later(() => {
            const again = Player.getById(id);
            if (again === null || !again.ready) {
                return;
            }
            const have = new Set(this.live(again));
            const left = this.wanted(again).filter((perk) => !have.has(perk));
            if (left.length === 0) {
                console.log(`esgrima: ${again.nickname}: ${missing.length} combo(s) de volta`);
                this.tell(again);
                return;
            }
            console.log(`esgrima: ${again.nickname}: o jogo não pegou ${left.length} de ${missing.length} combo(s) de uma vez; mais uma vez, aos poucos`);
            this.oneByOne(again, left, later);
        }, CHECK_AFTER_MS + (rounds - 1) * GIVE_EVERY_MS);
    }

    /** Hands `perks` over by `addPerk`, `GIVE_ROUND` at a time, the first round now. How many rounds there are. */
    private giveQuickly(player: Player, perks: readonly string[], later: (fn: () => void, ms: number) => void): number {
        const id = player.id;
        const queue = [...perks];
        const round = (): void => {
            const again = Player.getById(id);
            if (again === null || !again.ready) {
                return;
            }
            for (const perk of queue.splice(0, GIVE_ROUND)) {
                try {
                    if (!again.addPerk(perk)) {
                        console.log(`esgrima: o jogo não aceitou ${perk} para ${again.nickname}`);
                    }
                } catch (error: unknown) {
                    console.log(`esgrima: o jogo não aceitou ${perk} para ${again.nickname}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            if (queue.length > 0) {
                later(round, GIVE_EVERY_MS);
            }
        };
        round();
        return Math.ceil(perks.length / GIVE_ROUND);
    }

    private oneByOne(player: Player, perks: string[], later: (fn: () => void, ms: number) => void): void {
        const id = player.id;
        const queue = [...perks];
        const step = (): void => {
            const again = Player.getById(id);
            if (again === null || !again.ready) {
                return;
            }
            for (let index = 0; index < BATCH && queue.length > 0; index += 1) {
                const perk = queue.shift() as string;
                try {
                    if (!again.addPerk(perk)) {
                        console.log(`esgrima: o jogo não aceitou ${perk} para ${again.nickname}`);
                    }
                } catch (error: unknown) {
                    console.log(`esgrima: o jogo não aceitou ${perk} para ${again.nickname}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            if (queue.length > 0) {
                later(step, BATCH_EVERY_MS);
            } else {
                this.tell(again);
            }
        };
        step();
    }
}

export const esgrima = new Esgrima();

/** What `character-state.ts` leaves out of the progression it restores: the combos, written down here. */
export function takeOutCombos(steamId: string, snapshot: ProgressionSnapshot): ProgressionSnapshot {
    return esgrima.takeOut(steamId, snapshot).snapshot;
}

/**
 * What `character-state.ts` saves of a progression: with no combo in it. They are kept in `playerdata/esgrima.json` and nowhere else: what the game holds of
 * them is the role's loan or what was written down, never a thing to save again (an administrator's full set would come back, at the next entry, as the
 * player's own). The same object when it held none.
 */
export function leaveOutCombos(snapshot: ProgressionSnapshot): ProgressionSnapshot {
    return snapshot.perks.some((perk) => BY_PERK.has(perk)) ? { ...snapshot, perks: snapshot.perks.filter((perk) => !BY_PERK.has(perk)) } : snapshot;
}

export function installEsgrima(): void {
    esgrima.load();

    // No combo comes by playing: the game's own grants of them are turned down, and only `addPerk` hands one over. What this server already blocks is kept.
    try {
        const names = [...new Set([...Progression.blockedPerks, ...BY_PERK.keys()])];
        Progression.blockPerks(names);
        console.log(`esgrima: ${COMBOS.length} combos bloqueados no jogo (${names.length} talentos bloqueados ao todo); só se ensinam`);
    } catch (error: unknown) {
        console.log(`esgrima: não consegui bloquear os combos: ${error instanceof Error ? error.message : String(error)}`);
    }

    // The panel's section (Combate > Esgrima) is shown to an administrator and to whoever knows a combo.
    addPayload((player) => ({ esgrima: { visible: esgrima.visible(player) } }));

    Events.onClient(`${RESOURCE}:status.esgrima`, (sender) => {
        const player = sender as Player;
        if (esgrima.visible(player)) {
            esgrima.tell(player);
        }
    });

    Events.onClient(`${RESOURCE}:status.esgrimaInfo`, (sender, payload) => {
        const player = sender as Player;
        const id = fieldsOf(payload)["id"];
        const info = typeof id === "string" ? esgrima.info(player, id) : null;
        if (info !== null) {
            player.emit(`${RESOURCE}:status.esgrimaInfo`, JSON.stringify(info));
        }
    });

    const answer = (player: Player, outcome: Outcome): void => {
        notice(player, outcome.message);
        esgrima.tell(player);
    };
    Events.onClient(`${RESOURCE}:status.esgrimaTeach`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["id"] === "string") {
            // A message with no target is the administrator's "Para mim".
            answer(player, esgrima.teach(player, fields["id"], fields["targetId"]));
        }
    });
    Events.onClient(`${RESOURCE}:status.esgrimaRetire`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["id"] === "string") {
            answer(player, esgrima.retire(player, fields["id"], fields["targetId"]));
        }
    });

    // A little after each entry the combos are put back.
    Events.on("playerReady", (player) => {
        const id = player.id;
        setTimeout(() => {
            const again = Player.getById(id);
            if (again !== null && again.ready) {
                esgrima.refill(again);
            }
        }, REFILL_AFTER_MS);
    });
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 512) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
