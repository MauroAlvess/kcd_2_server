/**
 * Meeting other players, with the game's own screens.
 *
 * Nobody's name floats over their head. Looked at from close by, a player is "Desconhecido" (or "Desconhecida") with
 * the game's "[E] Conversar" hint (`src/client/property-labels.ts`); the talk key opens the game's dialogue list on them:
 *
 * - **Apresentar-se**: they learn your name, and from then on see it instead of "Desconhecido" (`acquaintances.ts`).
 *   The option is gone once they know it.
 * - **Jogar dados**: an invitation they answer in their own dialogue list; accepted, the two sit down at the dice table
 *   they share and agree the score (`dice.ts`). It is offered only when both stand at the same dice table.
 * - **Negociar**: the same kind of invitation; accepted, a trade opens on both screens (`trade.ts`).
 * - **Prender** / **Soltar** (`arrest.ts`, 2026-10-29): for an officer, on somebody below them on the ladder, or somebody they may let go.
 * - **Sair**.
 *
 * Nothing happens to a player without their answer, and an unanswered invitation lapses.
 */

import { introduce, knows, labelFor, nameOf } from "./acquaintances.js";
import { choose as arrestChoose, isArrested, menuOptions as arrestOptions } from "./arrest.js";
import { diceLobby } from "./dice.js";
import { applyNametag, restoreNametag } from "./titles.js";
import { trades } from "./trade.js";
import { allowedTo, EDGE_M } from "./reach.js";

const RESOURCE = "kcdc-gamemode";

/** How close two players must stand to talk; a little more than the client's own reach, for the time the press takes (`reach.ts`). */
export const TALK_REACH_M = allowedTo(EDGE_M.person);
/** How close they must still be when an invitation is accepted. */
export const ANSWER_REACH_M = 8;
/** How long an invitation waits for its answer. */
export const REQUEST_MS = 30_000;
/** How long before the same invitation can be sent to the same player again. */
export const REQUEST_COOLDOWN_MS = 15_000;

type RequestKind = "dice" | "trade";

interface Talk {
    readonly speaker: Player;
    readonly target: Player;
}

interface Request {
    readonly kind: RequestKind;
    readonly from: Player;
    readonly to: Player;
    readonly session: number;
    readonly expires: number;
}

const WHAT: Readonly<Record<RequestKind, string>> = { dice: "jogar dados", trade: "negociar" };

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 256) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function apart(a: Player, b: Player): number {
    return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
}

function present(player: Player): boolean {
    return player.ready && player.alive;
}

export class Encounters {
    private readonly talks = new Map<number, Talk>();
    private readonly requests = new Map<number, Request>();
    private readonly cooldowns = new Map<string, number>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    /** The menu `speaker` sees for `target`. */
    private menu(speaker: Player, target: Player): DialoguePage {
        const options: DialogueOption[] = [];
        if (!knows(target, speaker)) {
            options.push({ id: "introduce", text: "Apresentar-se", enabled: true });
        }
        // Somebody in handcuffs or in the pillory is nobody's to play dice with or to trade with: only the officers' rows, and the way out.
        if (isArrested(target)) {
            options.push(...arrestOptions(speaker, target));
            options.push({ id: "leave", text: "Sair", enabled: true });
            return { line: undefined, onRight: false, options };
        }
        const atTable = diceLobby.sameTable(speaker, target);
        options.push(atTable ? { id: "dice", text: "Jogar dados", enabled: true } : { id: "dice", text: "Jogar dados (só junto de uma mesa de dados)", enabled: false });
        if (!atTable) {
            const why = diceLobby.explainApart(speaker, target);
            if (why !== null) console.log(`encounters: dados indisponíveis no menu: ${why}`);
        }
        options.push({ id: "trade", text: "Negociar", enabled: true });
        options.push(...arrestOptions(speaker, target));
        options.push({ id: "leave", text: "Sair", enabled: true });
        return { line: undefined, onRight: false, options };
    }

    /** The talk key on another player. False when the conversation could not start. */
    talk(speaker: Player, target: Player): boolean {
        if (speaker.id === target.id || !present(speaker) || !present(target) || speaker.virtualWorld !== target.virtualWorld || apart(speaker, target) > TALK_REACH_M) {
            return false;
        }
        // Handcuffed hands open no list (2026-10-29).
        if (isArrested(speaker)) {
            return false;
        }
        if (Dialogue.sessionOf(speaker.id) !== 0 || trades.isTrading(speaker)) {
            return false;
        }
        // Somebody in a dice match is nobody's to talk to (2026-10-20: "quando um jogador estiver jogando dados não deve ter como
        // interagir com ele quem estiver por fora do jogo"): the client shows no hint either (`dice-quiet.ts`).
        if (diceLobby.playingNow(speaker)) {
            return false;
        }
        if (diceLobby.playingNow(target)) {
            tell(speaker, `${labelFor(speaker, target)} está jogando dados.`);
            return false;
        }
        const session = Dialogue.open(speaker.id, this.menu(speaker, target));
        if (session === 0) {
            return false;
        }
        this.talks.set(session, { speaker, target });
        return true;
    }

    choose(session: number, player: Player, option: string): void {
        const talk = this.talks.get(session);
        if (talk !== undefined && talk.speaker.id === player.id) {
            this.onTalk(session, talk, option);
            return;
        }
        const request = this.requests.get(session);
        if (request !== undefined && request.to.id === player.id) {
            this.onAnswer(session, request, option);
        }
    }

    private end(session: number): void {
        this.talks.delete(session);
        Dialogue.close(session);
    }

    private onTalk(session: number, talk: Talk, option: string): void {
        const { speaker, target } = talk;
        if (option === "leave") {
            this.end(session);
            return;
        }
        if (!present(target) || target.virtualWorld !== speaker.virtualWorld || apart(speaker, target) > ANSWER_REACH_M) {
            this.end(session);
            tell(speaker, "Essa pessoa não está mais por perto.");
            return;
        }
        if (option === "introduce") {
            if (introduce(speaker, target)) {
                const name = nameOf(speaker);
                tell(target, `${name} se apresentou a você.`);
                target.emit(`${RESOURCE}:players.label`, JSON.stringify({ id: speaker.id, label: name }));
                tell(speaker, "Você se apresentou.");
            }
            // The conversation goes on, without the option it no longer needs.
            if (!Dialogue.update(session, this.menu(speaker, target))) {
                this.talks.delete(session);
            }
            return;
        }
        if (option === "arrest" || option === "release") {
            this.end(session);
            const said = arrestChoose(speaker, target, option);
            if (said !== null) {
                tell(speaker, said);
            }
            return;
        }
        if (option === "dice" || option === "trade") {
            this.end(session);
            this.ask(option, speaker, target);
        }
    }

    /** Sends an invitation, which the other player answers in their own dialogue list. */
    private ask(kind: RequestKind, from: Player, to: Player): void {
        if (kind === "dice" && !diceLobby.sameTable(from, to)) {
            tell(from, "Para jogar dados, os dois precisam estar junto da mesma mesa de dados.");
            return;
        }
        const key = `${from.id}:${to.id}:${kind}`;
        const now = this.now();
        if ((this.cooldowns.get(key) ?? 0) > now) {
            tell(from, "Espere um pouco antes de chamar de novo.");
            return;
        }
        if (isArrested(to) || isArrested(from) || Dialogue.sessionOf(to.id) !== 0 || trades.isTrading(to) || trades.isTrading(from) || diceLobby.playingNow(to) || diceLobby.playingNow(from)) {
            tell(from, `${labelFor(from, to)} não pode agora.`);
            return;
        }
        const page: DialoguePage = {
            line: undefined,
            onRight: false,
            options: [
                { id: "info", text: `${labelFor(to, from)} quer ${WHAT[kind]} com você.`, enabled: false },
                { id: "accept", text: "Aceitar", enabled: true },
                { id: "decline", text: "Recusar", enabled: true },
            ],
        };
        const session = Dialogue.open(to.id, page);
        if (session === 0) {
            tell(from, `${labelFor(from, to)} não pôde responder agora.`);
            return;
        }
        this.cooldowns.set(key, now + REQUEST_COOLDOWN_MS);
        this.requests.set(session, { kind, from, to, session, expires: now + REQUEST_MS });
        tell(from, `Você chamou ${labelFor(from, to)} para ${WHAT[kind]}. Esperando a resposta.`);
    }

    private onAnswer(session: number, request: Request, option: string): void {
        const { kind, from, to } = request;
        if (option !== "accept" && option !== "decline") {
            return;
        }
        this.requests.delete(session);
        Dialogue.close(session);
        if (option === "decline") {
            tell(from, `${labelFor(from, to)} recusou ${kind === "dice" ? "o jogo de dados" : "a negociação"}.`);
            return;
        }
        if (!present(from) || from.virtualWorld !== to.virtualWorld || apart(from, to) > ANSWER_REACH_M) {
            tell(to, "Quem chamou não está mais por perto.");
            return;
        }
        if (kind === "trade") {
            if (!trades.start(from, to)) {
                for (const player of [from, to]) {
                    tell(player, "A negociação não pôde começar agora.");
                }
            }
            return;
        }
        diceLobby.pair(from, to).catch((error: unknown) => {
            const message = typeof error === "object" && error !== null ? (error as { message?: unknown }).message : undefined;
            const reason = typeof message === "string" ? message : String(error);
            for (const player of [from, to]) {
                tell(player, `Os dados não puderam começar: ${reason}`);
            }
        });
    }

    closed(session: number, reason: number): void {
        this.talks.delete(session);
        const request = this.requests.get(session);
        if (request === undefined) {
            return;
        }
        this.requests.delete(session);
        // Esc, or another conversation over it: the same as saying no.
        if (reason !== 0) {
            tell(request.from, `${labelFor(request.from, request.to)} não aceitou o convite.`);
        }
    }

    /** What `viewer` calls the player with network id `id`, for the label over the talk hint. Empty for nobody there. */
    peek(viewer: Player, id: number): string {
        const target = Player.getById(id);
        if (target === null || target.id === viewer.id || !target.ready || diceLobby.playingNow(target)) {
            return "";
        }
        return labelFor(viewer, target);
    }

    tick(): void {
        const now = this.now();
        for (const [session, request] of [...this.requests]) {
            if (now >= request.expires) {
                this.requests.delete(session);
                Dialogue.close(session);
                tell(request.from, `${labelFor(request.from, request.to)} não respondeu.`);
            }
        }
        for (const [key, until] of [...this.cooldowns]) {
            if (until <= now) {
                this.cooldowns.delete(key);
            }
        }
    }

    forget(player: Player): void {
        for (const [session, talk] of [...this.talks]) {
            if (talk.speaker.id === player.id || talk.target.id === player.id) {
                this.talks.delete(session);
                if (talk.speaker.id !== player.id) {
                    Dialogue.close(session);
                }
            }
        }
        for (const [session, request] of [...this.requests]) {
            if (request.from.id === player.id || request.to.id === player.id) {
                this.requests.delete(session);
                if (request.to.id !== player.id) {
                    Dialogue.close(session);
                }
            }
        }
    }
}

export const encounters = new Encounters();

/**
 * Names off: only the server says who somebody is, and only to whoever they told. A title an administrator gave is the
 * one thing over a head (`titles.ts`).
 */
function hideName(player: Player): void {
    applyNametag(player);
}

export function installEncounters(): void {
    Player.all().forEach(hideName);
    Events.on("playerSpawned", (player) => hideName(player));

    Events.onClient(`${RESOURCE}:players.peek`, (sender, payload) => {
        const viewer = sender as Player;
        const id = fieldsOf(payload)["id"];
        if (typeof id !== "number" || !Number.isInteger(id)) {
            return;
        }
        viewer.emit(`${RESOURCE}:players.label`, JSON.stringify({ id, label: encounters.peek(viewer, id) }));
    });

    Events.onClient(`${RESOURCE}:players.talk`, (sender, payload) => {
        const speaker = sender as Player;
        const id = fieldsOf(payload)["id"];
        const target = typeof id === "number" && Number.isInteger(id) ? Player.getById(id) : null;
        if (target !== null) {
            encounters.talk(speaker, target);
        }
    });

    Events.on("dialogueChoice", (session, player, option) => encounters.choose(session, player, option));
    Events.on("dialogueClosed", (session, _player, reason) => encounters.closed(session, reason));
    Events.on("playerDisconnect", (player) => encounters.forget(player));

    const timer = setInterval(() => encounters.tick(), 1_000);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            // Names come back when the resource that hid them stops, so a server without it is not left nameless.
            Player.all().forEach(restoreNametag);
        }
    });
    console.log("encounters: nomes escondidos; [E] em outro jogador abre apresentar-se, jogar dados e negociar");
}
