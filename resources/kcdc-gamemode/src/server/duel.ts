/**
 * Duels between two players (user, 2026-11-01: "ao apertar E em um jogador ele pode desafiar para um duelo; o duelo acaba quando um
 * deles chega a 20% de vida; durante o duelo qualquer efeito de buff é desativado, veneno, poção e coisa do tipo, para o duelo ser
 * justo; o duelo pode ser cancelado caso o jogador guarde a arma ou passe 45 s sem bater").
 *
 * The challenge is an option of the [E] menu on a player and an invitation the other answers (`encounters.ts`); accepted, `start`
 * opens a duel that goes through three steps:
 *
 * - **Preparing** (20 s at most): both take a weapon in hand, or raise their fists. Blows between them land harmlessly, and the
 *   effects each carries are taken off (potions, poison, drink, the thirst of `thirst.ts`).
 * - **Counting**: 3 s once both are ready.
 * - **On**: a blow that would take someone under 20% of their health is cut short so it takes them to 20% and no further
 *   (`playerHit`); the duel is won there. Nobody dies of a duel, and the blows already in the air are retired.
 *
 * It is cancelled, with no winner, when somebody keeps their hands empty for 2 s (the weapon put away), when 45 s go by with no
 * blow, when someone from outside strikes either of them (or one of them strikes someone from outside), when they drift 80 m
 * apart, when the game's peace is made (`combat.ts`), or when one of them leaves, falls or is taken elsewhere.
 *
 * Whatever lands on a duelist during the duel and is a potion, a poison or a drink is taken off at once, and food and potions are
 * refused (`playerConsuming`). The effects they had are not given back: the invitation says so. Perks and the bonuses of
 * the equipment are the game's own and stay. What the duel itself did (limb injuries, bleeding, poison) is treated at the end, so
 * nobody bleeds to death at 20%; the health stays where the duel left it.
 *
 * Only the health to start from is asked for: more than 80% of the most one can have, no injury, no bleeding, so that the 20% mark
 * is not a blow away. Nothing here is saved: a restart ends every duel.
 */

import { labelFor } from "./acquaintances.js";
import { endFightBetween } from "./combat.js";
import { thirstPace } from "./thirst.js";

const RESOURCE = "kcdc-gamemode";

/** The duel is won when a fighter's health is at or under this share of the most they can have. */
export const DUEL_FLOOR = 0.2;

/** To duel at all, health must be above this share of the most one can have. */
export const FIT_SHARE = 0.8;

/** No blow between the two for this long cancels the duel (the game's own fight timeout since 1.7.1). */
export const QUIET_MS = 45_000;

/** The fighters are told this long before the quiet timeout. */
export const WARN_BEFORE_MS = 10_000;

/** After accepting, both have this long to take a weapon in hand. */
export const PREPARE_MS = 20_000;

/** Both must have held a weapon this long before the count begins. */
export const READY_MS = 500;

export const COUNTDOWN_MS = 3_000;

/** Empty hands this long mean the weapon was put away on purpose (drawing another one takes less). */
export const SHEATHED_MS = 2_000;

/** Further apart than this, the duel is over. */
export const LEASH_M = 80;

/** From the blow that took somebody to the mark to the end, when no `playerDamage` ends it sooner. */
export const FINISH_MS = 600;

/** After a duel is won, blows between the two still land harmlessly for this long. */
export const AFTER_MS = 3_000;

/** For this long after the server ruled on a blow, its own reckoning of the victim's health beats the last report. */
export const RULED_MS = 800;

/** Players this close are told who won. */
export const WITNESS_M = 40;

export const TICK_MS = 250;

/** The kinds of effect a duel keeps off (`BuffInfo.class`); the effects registered by this server (the thirst) go as well. */
export const STRIPPED_CLASSES: readonly string[] = ["potion", "poison", "alcohol"];

/** Families of effect asked to come off at the start, for what the player's last report did not name. */
export const STRIP_FAMILIES: readonly string[] = ["poison", "alcohol_drunk"];

/** An effect that keeps coming back is taken off this many times a duel, no more. */
export const STRIP_TRIES = 6;

/** Health within this share of the most one can have, above the mark, counts as being at it. */
const MARK_SLACK = 0.005;

type Phase = "prepare" | "count" | "on";

type Unfit = "down" | "weak" | "hurt";

interface Fighter {
    readonly player: Player;
    /** Since when the hands have been empty; 0 while they are not. */
    emptySince: number;
    /** The server's reckoning of the health after the last blow it ruled on, and when that was. */
    reckoned: number;
    ruledAt: number;
}

interface Finish {
    readonly winner: Fighter;
    readonly loser: Fighter;
    readonly at: number;
}

interface Duel {
    readonly a: Fighter;
    readonly b: Fighter;
    phase: Phase;
    readonly since: number;
    /** Since when both have held a weapon; 0 while they have not. */
    readyAt: number;
    startAt: number;
    /** The last number of the count said aloud. */
    counted: number;
    lastBlow: number;
    warned: boolean;
    finish: Finish | null;
}

/** Why a duel ended with no winner: what each of them is told, what the log says, and whether the wounds it made are treated. */
interface Ending {
    text(viewer: Player): string;
    log: string;
    treat: boolean;
}

const MINE: Readonly<Record<Unfit, string>> = {
    down: "Você não está em condições de duelar agora.",
    weak: `Para duelar, a sua vida precisa estar acima de ${Math.round(FIT_SHARE * 100)}%.`,
    hurt: "Para duelar, você não pode estar ferido nem sangrando.",
};

const percent = Math.round(DUEL_FLOOR * 100);

/** The lines an invitation to a duel carries under the question (`encounters.ts`). */
export const INVITATION_NOTES: readonly string[] = [
    `Vai até um dos dois chegar a ${percent}% da vida.`,
    "Poções e efeitos saem do corpo e não voltam.",
    `Arma guardada ou ${QUIET_MS / 1000} s sem golpes cancela.`,
];

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

/** On the screen only, for a count that would fill the chat. */
function flash(player: Player, text: string): void {
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

const pairOf = (a: Player, b: Player): string => `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;

function apart(a: Player, b: Player): number {
    return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
}

/** A weapon, a tool or a torch in a hand, or the fists raised. */
export function armed(player: Player): boolean {
    return player.rightHandItem !== "" || player.leftHandItem !== "" || (player.fistsUp && player.guard > 0);
}

function injured(player: Player): boolean {
    const hurt = player.injuries;
    return hurt.head || hurt.torso || hurt.leftArm || hurt.rightArm || hurt.leftLeg || hurt.rightLeg;
}

/** Whether a duel keeps this effect off the body. */
export function strippable(buff: { readonly class: string; readonly custom: boolean }): boolean {
    return buff.custom === true || STRIPPED_CLASSES.includes(String(buff.class ?? "").toLowerCase());
}

/** "Você" for the player themselves, the name `viewer` knows the other by otherwise. */
const named = (viewer: Player, who: Player): string => (viewer.id === who.id ? "Você" : labelFor(viewer, who));

const outsideStruck = (): Ending => ({ text: () => "Alguém de fora entrou na luta: duelo cancelado.", log: "alguém de fora golpeou um dos dois", treat: false });
const struckOutside = (who: Player): Ending => ({ text: (viewer) => `${named(viewer, who)} golpeou alguém de fora: duelo cancelado.`, log: `${who.nickname} golpeou alguém de fora`, treat: false });
const sheathed = (who: Player): Ending => ({ text: (viewer) => `${named(viewer, who)} guardou a arma: duelo cancelado.`, log: `${who.nickname} guardou a arma`, treat: true });
const gone = (who: Player, what: string): Ending => ({ text: (viewer) => `${named(viewer, who)} ${what}: duelo cancelado.`, log: `${who.nickname} ${what}`, treat: false });

export class Duels {
    private readonly byPlayer = new Map<number, Duel>();
    private readonly cool = new Map<string, number>();
    /** How often each effect was taken off a body in a duel, by `<player id>:<effect>`. */
    private readonly lifted = new Map<string, number>();
    private readonly told = new Map<number, number>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    /** Whether this player is in a duel, in whatever step. */
    busy(player: { readonly id: number }): boolean {
        return this.byPlayer.has(player.id);
    }

    private unfit(player: Player): Unfit | null {
        if (!player.ready || !player.alive || !player.canAct) {
            return "down";
        }
        if (!(player.maxHealth > 0) || player.health <= player.maxHealth * FIT_SHARE) {
            return "weak";
        }
        return injured(player) || player.bleeding > 0 ? "hurt" : null;
    }

    /** What `from` is told when they cannot challenge `to` to a duel now, or null when they can. */
    canChallenge(from: Player, to: Player): string | null {
        if (from.id === to.id) {
            return "Não dá para duelar consigo mesmo.";
        }
        if (this.busy(from)) {
            return "Você já está em um duelo.";
        }
        if (this.busy(to)) {
            return `${labelFor(from, to)} já está em um duelo.`;
        }
        const mine = this.unfit(from);
        if (mine !== null) {
            return MINE[mine];
        }
        if (this.unfit(to) !== null) {
            return `${labelFor(from, to)} não está em condições de duelar agora: precisa de mais de ${Math.round(FIT_SHARE * 100)}% da vida, sem ferimentos e sem sangrar.`;
        }
        return null;
    }

    /** The invitation was accepted: the duel begins. The reason it could not, or null. */
    start(from: Player, to: Player): string | null {
        const why = this.canChallenge(from, to);
        if (why !== null) {
            return why;
        }
        if (from.virtualWorld !== to.virtualWorld) {
            return "O duelo não pôde começar.";
        }
        const duel: Duel = {
            a: this.fighter(from),
            b: this.fighter(to),
            phase: "prepare",
            since: this.now(),
            readyAt: 0,
            startAt: 0,
            counted: 0,
            lastBlow: this.now(),
            warned: false,
            finish: null,
        };
        this.byPlayer.set(from.id, duel);
        this.byPlayer.set(to.id, duel);
        const offs: string[] = [];
        for (const [player, other] of [[from, to], [to, from]] as const) {
            offs.push(`${player.nickname}: ${this.strip(player).join(", ") || "nada"}`);
            tell(player, `Duelo com ${labelFor(player, other)}: saque a arma (ou erga os punhos). Os efeitos do corpo foram tirados e ninguém se fere até a contagem acabar.`);
        }
        console.log(`duel: ${from.nickname} desafiou ${to.nickname} e foi aceito; efeitos tirados (${offs.join("; ")})`);
        return null;
    }

    private fighter(player: Player): Fighter {
        return { player, emptySince: 0, reckoned: player.health, ruledAt: Number.NEGATIVE_INFINITY };
    }

    private fighterOf(duel: Duel, player: Player): Fighter {
        return duel.a.player.id === player.id ? duel.a : duel.b;
    }

    private otherOf(duel: Duel, player: { readonly id: number }): Fighter {
        return duel.a.player.id === player.id ? duel.b : duel.a;
    }

    /** Takes the effects a duel keeps off the body, and says which were found. */
    private strip(player: Player): string[] {
        const found: string[] = [];
        for (const state of player.buffs) {
            if (strippable(state) && player.removeBuff(state.name)) {
                found.push(state.name);
            }
        }
        for (const family of STRIP_FAMILIES) {
            try {
                player.clearBuffs(family);
            } catch {
                // A family the game's tables do not know.
            }
        }
        const others = player.buffs.filter((state) => !strippable(state)).map((state) => `${state.name} (${state.class})`).slice(0, 8);
        if (others.length > 0) {
            console.log(`duel: ${player.nickname} segue com efeitos do jogo que o duelo não tira: ${others.join(", ")}`);
        }
        return found;
    }

    /** Health the server takes the fighter to have now. */
    private reading(fighter: Fighter, now: number): number {
        const reported = fighter.player.health;
        return now - fighter.ruledAt <= RULED_MS ? Math.min(fighter.reckoned, reported) : reported;
    }

    // ---------------------------------------------------------------------------------------------
    // What the game says.

    /** A swing at another player, hit or missed. */
    attacked(player: Player, opponent: Player): void {
        const duel = this.byPlayer.get(player.id);
        if (duel !== undefined && duel.phase === "on" && this.otherOf(duel, player).player.id === opponent.id) {
            duel.lastBlow = this.now();
            duel.warned = false;
        }
    }

    /** A blow lands on a player: `false` refuses it. */
    hit(victim: Player, attacker: Player | Npc, info: PlayerHit): boolean | undefined {
        const now = this.now();
        const duel = this.byPlayer.get(victim.id);
        const hitter = "nickname" in attacker ? attacker : null;
        if (duel !== undefined && hitter !== null && this.otherOf(duel, victim).player.id === hitter.id) {
            return this.between(duel, victim, info, now);
        }
        // The two of a duel just won: the blades already swung still meet, and take nothing.
        if (hitter !== null && (this.cool.get(pairOf(victim, hitter)) ?? 0) > now) {
            return false;
        }
        if (duel !== undefined) {
            this.cancel(duel, outsideStruck());
        }
        const theirs = hitter === null ? undefined : this.byPlayer.get(hitter.id);
        if (theirs !== undefined && theirs !== duel && hitter !== null) {
            this.cancel(theirs, struckOutside(hitter));
        }
        return undefined;
    }

    /** A blow between the two of a duel. */
    private between(duel: Duel, victim: Player, info: PlayerHit, now: number): boolean | undefined {
        if (duel.phase !== "on" || duel.finish !== null) {
            return false;
        }
        duel.lastBlow = now;
        duel.warned = false;
        const max = victim.maxHealth;
        if (!(max > 0)) {
            return undefined;
        }
        const fighter = this.fighterOf(duel, victim);
        const mark = max * DUEL_FLOOR;
        const reading = this.reading(fighter, now);
        const room = reading - mark;
        if (!(room > 0)) {
            this.mark(duel, fighter, now);
            return false;
        }
        if (info.damage > room) {
            info.damage = room;
        }
        fighter.reckoned = reading - info.damage;
        fighter.ruledAt = now;
        if (fighter.reckoned <= mark + max * MARK_SLACK) {
            this.mark(duel, fighter, now);
        }
        return undefined;
    }

    private mark(duel: Duel, loser: Fighter, now: number): void {
        if (duel.finish === null) {
            duel.finish = { winner: this.otherOf(duel, loser.player), loser, at: now };
        }
    }

    /** Health came off a player (the ruling is taken): a duel whose loser is marked ends here. */
    damaged(player: Player): void {
        const duel = this.byPlayer.get(player.id);
        if (duel !== undefined && duel.finish !== null && duel.finish.loser.player.id === player.id) {
            this.settle(duel);
        }
    }

    /** An effect appeared on a body. */
    buffAdded(player: Player, buff: string): void {
        if (!this.busy(player)) {
            return;
        }
        const info = Buffs.find(buff);
        if (info === null || !strippable(info)) {
            return;
        }
        const key = `${player.id}:${info.name}`;
        const tries = this.lifted.get(key) ?? 0;
        if (tries >= STRIP_TRIES) {
            return;
        }
        this.lifted.set(key, tries + 1);
        player.removeBuff(info.name);
        if (tries === 0) {
            console.log(`duel: ${player.nickname} recebeu ${info.name} (${info.class}) durante o duelo: tirado`);
        }
    }

    /** Food and potions are refused in a duel. */
    consuming(player: Player): boolean | undefined {
        if (!this.busy(player)) {
            return undefined;
        }
        const now = this.now();
        if (now - (this.told.get(player.id) ?? Number.NEGATIVE_INFINITY) >= 3_000) {
            this.told.set(player.id, now);
            tell(player, "Em duelo não se come nem se bebe poção.");
        }
        return false;
    }

    /** The game's fight between two players ended (peace, `/paz`, its own timeout): so does a duel that was on. */
    peace(first: Player, second: Player): void {
        const duel = this.byPlayer.get(first.id);
        if (duel === undefined || duel.phase !== "on" || this.otherOf(duel, first).player.id !== second.id) {
            return;
        }
        this.cancel(duel, { text: () => "A luta foi encerrada: duelo cancelado.", log: "a luta do jogo acabou", treat: true });
    }

    /** A player left, fell or was taken elsewhere. */
    left(player: Player, what: string): void {
        const duel = this.byPlayer.get(player.id);
        if (duel !== undefined) {
            this.cancel(duel, gone(player, what));
        }
        this.told.delete(player.id);
    }

    // ---------------------------------------------------------------------------------------------
    // The beat.

    tick(): void {
        if (this.byPlayer.size === 0 && this.cool.size === 0) {
            return;
        }
        const now = this.now();
        for (const [pair, until] of [...this.cool]) {
            if (until <= now) {
                this.cool.delete(pair);
            }
        }
        for (const duel of new Set(this.byPlayer.values())) {
            this.step(duel, now);
        }
    }

    private step(duel: Duel, now: number): void {
        const { a, b } = duel;
        for (const fighter of [a, b]) {
            if (!fighter.player.ready || !fighter.player.alive) {
                this.cancel(duel, gone(fighter.player, "não pôde continuar"));
                return;
            }
        }
        if (a.player.virtualWorld !== b.player.virtualWorld) {
            this.cancel(duel, { text: () => "Os dois não estão mais no mesmo lugar: duelo cancelado.", log: "mundos diferentes", treat: false });
            return;
        }
        if (duel.phase === "prepare") {
            this.prepare(duel, now);
        } else if (duel.phase === "count") {
            this.count(duel, now);
        } else {
            this.fight(duel, now);
        }
    }

    private prepare(duel: Duel, now: number): void {
        const empty = [duel.a, duel.b].filter((fighter) => !armed(fighter.player));
        if (empty.length === 0) {
            if (duel.readyAt === 0) {
                duel.readyAt = now;
            }
            if (now - duel.readyAt >= READY_MS) {
                duel.phase = "count";
                duel.startAt = now + COUNTDOWN_MS;
                duel.counted = COUNTDOWN_MS / 1000 + 1;
            }
            return;
        }
        duel.readyAt = 0;
        if (now - duel.since >= PREPARE_MS) {
            const first = empty[0];
            const only = empty.length === 1 && first !== undefined ? first.player : null;
            this.cancel(duel, {
                text: (viewer) => `O duelo não começou: ${only === null ? "ninguém sacou" : `${named(viewer, only)} não sacou`} a arma a tempo.`,
                log: "ninguém sacou a arma a tempo",
                treat: false,
            });
        }
    }

    private count(duel: Duel, now: number): void {
        if (![duel.a, duel.b].every((fighter) => armed(fighter.player))) {
            duel.phase = "prepare";
            duel.readyAt = 0;
            for (const fighter of [duel.a, duel.b]) {
                tell(fighter.player, "Os dois precisam estar com a arma na mão (ou os punhos erguidos).");
            }
            return;
        }
        const left = Math.ceil((duel.startAt - now) / 1000);
        if (left >= 1 && left < duel.counted) {
            duel.counted = left;
            for (const fighter of [duel.a, duel.b]) {
                flash(fighter.player, `${left}...`);
            }
        }
        if (now < duel.startAt) {
            return;
        }
        duel.phase = "on";
        duel.lastBlow = now;
        duel.warned = false;
        for (const fighter of [duel.a, duel.b]) {
            fighter.reckoned = fighter.player.health;
            fighter.ruledAt = Number.NEGATIVE_INFINITY;
            fighter.emptySince = 0;
            tell(fighter.player, `Lutem! Vence quem deixar o outro com ${percent}% da vida.`);
        }
        console.log(`duel: ${duel.a.player.nickname} e ${duel.b.player.nickname} começaram a lutar`);
    }

    private fight(duel: Duel, now: number): void {
        if (duel.finish !== null) {
            if (now - duel.finish.at >= FINISH_MS) {
                this.settle(duel);
            }
            return;
        }
        for (const fighter of [duel.a, duel.b]) {
            const max = fighter.player.maxHealth;
            if (fighter.player.consciousness <= 0 || (max > 0 && this.reading(fighter, now) <= max * (DUEL_FLOOR + MARK_SLACK))) {
                this.mark(duel, fighter, now);
                return;
            }
        }
        for (const fighter of [duel.a, duel.b]) {
            if (armed(fighter.player)) {
                fighter.emptySince = 0;
            } else if (fighter.emptySince === 0) {
                fighter.emptySince = now;
            } else if (now - fighter.emptySince >= SHEATHED_MS) {
                this.cancel(duel, sheathed(fighter.player));
                return;
            }
        }
        if (apart(duel.a.player, duel.b.player) > LEASH_M) {
            this.cancel(duel, { text: () => "Os dois se afastaram demais: duelo cancelado.", log: "se afastaram demais", treat: true });
            return;
        }
        const quiet = now - duel.lastBlow;
        if (quiet >= QUIET_MS) {
            this.cancel(duel, { text: () => `${QUIET_MS / 1000} s sem golpes: duelo cancelado.`, log: `${QUIET_MS / 1000} s sem golpes`, treat: true });
        } else if (!duel.warned && quiet >= QUIET_MS - WARN_BEFORE_MS) {
            duel.warned = true;
            for (const fighter of [duel.a, duel.b]) {
                tell(fighter.player, `Sem golpes há ${Math.round(quiet / 1000)} s: o duelo se cancela em ${Math.ceil((QUIET_MS - quiet) / 1000)} s se ninguém golpear.`);
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // The end.

    /** The duel is over and somebody won. */
    private settle(duel: Duel): void {
        const finish = duel.finish;
        if (finish === null) {
            return;
        }
        const { winner, loser } = finish;
        const now = this.now();
        const share = (fighter: Fighter): number => (fighter.player.maxHealth > 0 ? Math.round((this.reading(fighter, now) / fighter.player.maxHealth) * 100) : 0);
        this.release(duel, "um dos dois chegou ao limite");
        this.cool.set(pairOf(winner.player, loser.player), now + AFTER_MS);
        tell(winner.player, `Você venceu o duelo contra ${labelFor(winner.player, loser.player)}.`);
        tell(loser.player, `Você perdeu o duelo para ${labelFor(loser.player, winner.player)}.`);
        const here = winner.player.position;
        for (const other of Player.all()) {
            if (other.id === winner.player.id || other.id === loser.player.id || !other.ready || other.virtualWorld !== winner.player.virtualWorld) {
                continue;
            }
            if (Math.hypot(other.position.x - here.x, other.position.y - here.y, other.position.z - here.z) <= WITNESS_M) {
                Chat.sendToPlayer(other, `${labelFor(other, winner.player)} venceu o duelo contra ${labelFor(other, loser.player)}.`);
            }
        }
        this.treat(winner.player);
        this.treat(loser.player);
        console.log(`duel: ${winner.player.nickname} venceu ${loser.player.nickname} (vida de agora: ${share(winner)}% e ${share(loser)}%)`);
    }

    /** The duel is over with no winner. */
    private cancel(duel: Duel, ending: Ending): void {
        const phase = duel.phase;
        this.release(duel, ending.log);
        for (const fighter of [duel.a, duel.b]) {
            try {
                tell(fighter.player, ending.text(fighter.player));
            } catch {
                // The body is gone.
            }
            if (ending.treat && phase === "on") {
                this.treat(fighter.player);
            }
        }
        console.log(`duel: ${duel.a.player.nickname} e ${duel.b.player.nickname}: ${ending.log}`);
    }

    /** Takes the duel off the books and the game's fight with it. */
    private release(duel: Duel, why: string): void {
        for (const fighter of [duel.a, duel.b]) {
            if (this.byPlayer.get(fighter.player.id) === duel) {
                this.byPlayer.delete(fighter.player.id);
            }
            for (const key of [...this.lifted.keys()]) {
                if (key.startsWith(`${fighter.player.id}:`)) {
                    this.lifted.delete(key);
                }
            }
        }
        try {
            endFightBetween(duel.a.player, duel.b.player, `duelo: ${why}`);
        } catch {
            // One of them is gone; the game forgets the fight with them.
        }
    }

    /** What the duel itself did to the body: limb injuries, bleeding and poison are treated, the health is left; a knocked-out body is woken. */
    private treat(player: Player): void {
        try {
            player.heal({ health: false, injuries: true, bleeding: true, poisons: true });
            if (player.consciousness <= 0) {
                player.clearBuffs("unconscious");
            }
        } catch {
            // The body is not there to be treated.
        }
    }

    /** Every duel ends (the resource stops). */
    stop(): void {
        for (const duel of new Set(this.byPlayer.values())) {
            this.cancel(duel, { text: () => "O servidor parou: duelo cancelado.", log: "o recurso parou", treat: false });
        }
        this.cool.clear();
        this.lifted.clear();
        this.told.clear();
    }
}

export const duels = new Duels();

export function installDuels(): void {
    // A body in a duel is neither dressed in the thirst's effects nor hurt by it (`thirst.ts`).
    thirstPace.suspended = (player) => duels.busy(player);
    Events.on("playerAttack", (player, opponent) => duels.attacked(player, opponent));
    Events.on("playerHit", (victim, attacker, hit) => duels.hit(victim, attacker, hit));
    Events.on("playerDamage", (player) => duels.damaged(player));
    Events.on("playerBuffAdded", (player, buff) => duels.buffAdded(player, buff));
    Events.on("playerConsuming", (player) => duels.consuming(player));
    Events.on("playerCombatCancelled", (first, second) => duels.peace(first, second));
    Events.on("playerDisconnect", (player) => duels.left(player, "saiu do jogo"));
    Events.on("playerDied", (player) => duels.left(player, "caiu"));
    Events.on("playerSpawning", (player) => duels.left(player, "foi levado a outro lugar"));
    const timer = setInterval(() => duels.tick(), TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            duels.stop();
            thirstPace.suspended = () => false;
        }
    });
    console.log(`duel: duelos combinados prontos ([E] em outro jogador); terminam em ${percent}% da vida, cancelam sem golpes por ${QUIET_MS / 1000} s ou com a arma guardada`);
}
