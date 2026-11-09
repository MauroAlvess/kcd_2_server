/**
 * Execution (user, 2026-11-04: "na seção jogadores vamos criar, além do banir, a opção executar um jogador: executa, aparece na tela dele mostrando que ele foi executado e fazendo ele recriar um
 * personagem do zero"). An administrator, from the same page as the ban (`status.execute`), sentences a player: the character is deleted, as the player's own "Apagar personagem" does (`character-reset.ts`:
 * body, standing, houses, horses, carts, support... everything of it), and the player is sent back to the mod's main menu to make a new one from nothing. The ban takes the Steam account; this takes the
 * character, and the account may come in again at once.
 *
 * What the player sees first is the screen of the death (`client/death-screen.ts`, `ui/death.html`): the camera turns slowly round their body, a line says they were executed and by whose order, and the
 * counter runs down to the end (`EXECUTION_SECONDS`); only then is the character deleted and the player sent out, with the reason on the menu (`EXECUTED_REASON`). Waiting for the end to delete keeps
 * the body's own saves from putting the character back, and lets a player who leaves in the middle be sentenced still.
 *
 * A player who is not in the game is not executed in their absence: the sentence is written down (`sentences.ts`) and carried out when they come in, with the same screen. An administrator may pardon
 * a sentence that waits (`status.pardon`); one whose screen is already up cannot be taken back. The sentence is looked for every `CHECK_MS` among those who are in the game, which is nothing to
 * do while no sentence waits.
 */

import { isAdmin } from "./auth.js";
import { resetCharacter } from "./character-reset.js";
import { languageOf } from "./language.js";
import { sentences } from "./sentences.js";
import { accountOfTarget, goneText, notice, sendRoster } from "./status.js";

const RESOURCE = "kcdc-gamemode";
export const DEATH_BEGIN = `${RESOURCE}:death.begin`;

/** The counter of the screen, and how long after the body is in the world a sentence may start (the client must have its page ready). */
export const EXECUTION_SECONDS = 9;
export const AFTER_SPAWN_MS = 5_000;
export const CHECK_MS = 3_000;
/** The player is sent out this long after the character is deleted: the screen is still up. */
export const KICK_AFTER_MS = 1_200;

export const EXECUTED_REASON = "Você foi executado. Entre de novo no servidor para criar um novo personagem. / You were executed. Join the server again to create a new character.";

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** What the screen says, in the player's language: the line, whose order it was, and the line over the counter. */
export function screenFor(language: string): { readonly text: string; readonly ref: string; readonly label: string } {
    return language === "en"
        ? { text: "You have been executed.", ref: "By order of the realm's administration", label: "Back to the main menu in" }
        : { text: "Você foi executado.", ref: "Por ordem da administração do reino", label: "De volta ao menu principal em" };
}

/** The screens that are up, by the player's id: the timer that ends them. */
const running = new Map<number, { readonly steamId: string; readonly timer: ReturnType<typeof setTimeout> }>();
/** When each body came into the world (`playerSpawned`): a sentence waits a few seconds after. */
const spawnedAt = new Map<number, number>();

export function isBeingExecuted(player: Player): boolean {
    return running.has(player.id);
}

function carryOut(player: Player, steamId: string): void {
    running.delete(player.id);
    // The id can pass to whoever comes in next: it is the account that is executed.
    if (player.steamId !== steamId) {
        return;
    }
    const sentence = sentences.get(steamId);
    if (!sentences.remove(steamId)) {
        console.log(`execution: a sentença de ${player.nickname} não pôde ser tirada do arquivo; fica para a próxima vez`);
        return;
    }
    const result = resetCharacter(player, Date.now(), { reason: EXECUTED_REASON, kickAfterMs: KICK_AFTER_MS, did: "foi executado" });
    console.log(`execution: ${player.nickname} foi executado${sentence === null ? "" : ` (sentença de ${sentence.by})`}${result.ok ? "" : `, mas ${result.message}`}`);
}

/** Puts the screen up for a sentenced player, who is deleted when its counter ends. False when it is already up, or the body is not ready for it. */
export function beginExecution(player: Player): boolean {
    if (running.has(player.id) || !player.ready || !player.alive || player.steamId === "" || !sentences.has(player.steamId)) {
        return false;
    }
    const steamId = player.steamId;
    const screen = screenFor(languageOf(player));
    try {
        player.emit(DEATH_BEGIN, JSON.stringify({ seconds: EXECUTION_SECONDS, standing: true, ...screen }));
    } catch {
        return false;
    }
    running.set(player.id, { steamId, timer: setTimeout(() => carryOut(player, steamId), EXECUTION_SECONDS * 1000) });
    console.log(`execution: ${player.nickname} está vendo a tela da execução (${EXECUTION_SECONDS} s)`);
    return true;
}

/** Starts every sentence whose player is in the game and has been for a moment. How many started. */
export function look(now = Date.now()): number {
    if (sentences.count() === 0) {
        return 0;
    }
    let started = 0;
    for (const player of Player.all()) {
        if (player.steamId === "" || !sentences.has(player.steamId) || !player.ready || now - (spawnedAt.get(player.id) ?? 0) < AFTER_SPAWN_MS) {
            continue;
        }
        if (beginExecution(player)) {
            started += 1;
        }
    }
    return started;
}

/** An administrator's sentence on an account: at once for somebody in the game, written down for somebody who is not. */
export function sentence(target: { readonly steamId: string; readonly name: string; readonly player: Player | null }, by: string): Outcome {
    if (!sentences.canWrite) {
        return { ok: false, message: "O arquivo das execuções não pôde ser lido; ninguém foi condenado para não apagar o que está nele." };
    }
    if (sentences.has(target.steamId) || (target.player !== null && running.has(target.player.id))) {
        return { ok: false, message: `${target.name} já está condenado(a) à execução.` };
    }
    if (!sentences.add(target.steamId, target.name, by)) {
        return { ok: false, message: `${target.name} não tem uma conta Steam conhecida, ou a sentença não pôde ser gravada: nada foi feito.` };
    }
    console.log(`execution: ${by} condenou ${target.name} à execução`);
    if (target.player !== null && target.player.ready && !running.has(target.player.id)) {
        // A body that has only just come in is given its few seconds; the look does the rest.
        if (Date.now() - (spawnedAt.get(target.player.id) ?? 0) >= AFTER_SPAWN_MS && beginExecution(target.player)) {
            return { ok: true, message: `${target.name} foi condenado(a): a tela da execução aparece para ele(a) agora, e o personagem é apagado em ${EXECUTION_SECONDS} segundos.` };
        }
        return { ok: true, message: `${target.name} foi condenado(a): a execução começa em instantes.` };
    }
    return { ok: true, message: `${target.name} não está no jogo: a execução será cumprida quando entrar.` };
}

/** Takes back a sentence that has not started. */
export function pardon(target: { readonly steamId: string; readonly name: string; readonly player: Player | null }, by: string): Outcome {
    if (target.player !== null && running.has(target.player.id)) {
        return { ok: false, message: `A execução de ${target.name} já começou e não pode ser cancelada.` };
    }
    if (!sentences.has(target.steamId)) {
        return { ok: false, message: `${target.name} não está condenado(a).` };
    }
    if (!sentences.remove(target.steamId)) {
        return { ok: false, message: "Não consegui tirar a sentença do arquivo agora. Tente de novo." };
    }
    console.log(`execution: ${by} perdoou ${target.name}`);
    return { ok: true, message: `${target.name} foi perdoado(a): a execução não vai mais acontecer.` };
}

function targetOf(payload: unknown): unknown {
    try {
        return ((typeof payload === "string" ? JSON.parse(payload) : payload) as { targetId?: unknown } | null)?.targetId;
    } catch {
        return undefined;
    }
}

export function installExecution(): void {
    sentences.load();
    console.log(`execution: ${sentences.count()} sentença(s) esperando`);

    Events.on("playerSpawned", (player) => {
        spawnedAt.set(player.id, Date.now());
    });
    Events.on("playerDisconnect", (player) => {
        const up = running.get(player.id);
        if (up !== undefined) {
            // Left in the middle of the screen: the sentence stays, and is carried out when they are back.
            clearTimeout(up.timer);
            running.delete(player.id);
        }
        spawnedAt.delete(player.id);
    });

    Events.onClient(`${RESOURCE}:status.execute`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const id = targetOf(payload);
        const target = accountOfTarget(id);
        if (target === null) {
            notice(player, goneText(id));
            return;
        }
        if (target.steamId === player.steamId) {
            notice(player, "Você não pode executar a si mesmo.");
            return;
        }
        notice(player, sentence(target, player.nickname).message);
        sendRoster(player);
    });
    Events.onClient(`${RESOURCE}:status.pardon`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const id = targetOf(payload);
        const target = accountOfTarget(id);
        if (target === null) {
            notice(player, goneText(id));
            return;
        }
        notice(player, pardon(target, player.nickname).message);
        sendRoster(player);
    });

    const timer = setInterval(() => look(), CHECK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
            for (const up of running.values()) {
                clearTimeout(up.timer);
            }
            running.clear();
        }
    });
}
