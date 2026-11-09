/**
 * The accounts an administrator has sentenced to be executed and whose sentence has not been carried out yet (user, 2026-11-04: "na seção jogadores vamos criar, além do banir, a opção executar
 * um jogador: executa, aparece na tela dele mostrando que ele foi executado e fazendo ele recriar um personagem do zero"). A player who is in the game is executed at once; one who is not is
 * written here and executed when they come in (`execution.ts`). Kept in `playerdata/executions.json`, read by this module alone:
 *
 *   { "v": 1, "pending": { "<steamId>": { "name": "Hans", "by": "Mauro", "at": 1793760000000 } } }
 *
 * A file that cannot be read is not written over, and nobody is sentenced by it: the server logs it. A sentence is taken out of the file when it is carried out.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/executions.json`;
const STEAM_ID = /^[0-9]{5,20}$/;

export interface Sentence {
    readonly steamId: string;
    readonly name: string;
    readonly by: string;
    readonly at: number;
}

export class Sentences {
    private pending = new Map<string, Sentence>();
    /** False while the file could not be read: nothing is written over it then. */
    private writable = true;

    constructor(private readonly now: () => number = () => Date.now()) {}

    load(): void {
        this.pending = new Map();
        const loaded = read<{ pending?: unknown }>(FILE);
        if (loaded.status === "corrupt") {
            this.writable = false;
            console.log(`execution: ${FILE} ilegível (${loaded.reason}); ninguém é executado por ele e nada será gravado por cima até que seja consertado`);
            return;
        }
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        const raw = loaded.value.pending;
        if (typeof raw !== "object" || raw === null) {
            return;
        }
        for (const [steamId, entry] of Object.entries(raw as Record<string, unknown>)) {
            if (!STEAM_ID.test(steamId) || typeof entry !== "object" || entry === null) {
                continue;
            }
            const fields = entry as Partial<Record<keyof Sentence, unknown>>;
            this.pending.set(steamId, {
                steamId,
                name: typeof fields.name === "string" ? fields.name.slice(0, 60) : "",
                by: typeof fields.by === "string" ? fields.by.slice(0, 60) : "",
                at: typeof fields.at === "number" && Number.isFinite(fields.at) ? fields.at : 0,
            });
        }
    }

    private persist(): boolean {
        if (!this.writable) {
            return false;
        }
        try {
            ensureDir(DIR);
            const pending: Record<string, Omit<Sentence, "steamId">> = {};
            for (const [steamId, sentence] of this.pending) {
                pending[steamId] = { name: sentence.name, by: sentence.by, at: sentence.at };
            }
            write(FILE, { v: 1, pending });
            return true;
        } catch (error: unknown) {
            console.log(`execution: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    has(steamId: string): boolean {
        return this.pending.has(steamId);
    }

    get(steamId: string): Sentence | null {
        return this.pending.get(steamId) ?? null;
    }

    count(): number {
        return this.pending.size;
    }

    list(): Sentence[] {
        return [...this.pending.values()];
    }

    /** Writes a sentence down. False when the account is not one, the file cannot be written, or it is sentenced already (`has` tells which). */
    add(steamId: string, name: string, by: string): boolean {
        if (!STEAM_ID.test(steamId) || this.pending.has(steamId) || !this.writable) {
            return false;
        }
        this.pending.set(steamId, { steamId, name: name.slice(0, 60), by: by.slice(0, 60), at: this.now() });
        if (!this.persist()) {
            this.pending.delete(steamId);
            return false;
        }
        return true;
    }

    /** Takes a sentence out: carried out, or pardoned. */
    remove(steamId: string): boolean {
        if (!this.pending.has(steamId)) {
            return false;
        }
        const kept = this.pending.get(steamId) as Sentence;
        this.pending.delete(steamId);
        if (!this.persist()) {
            this.pending.set(steamId, kept);
            return false;
        }
        return true;
    }

    /** Whether the file can be written (a file that could not be read is left alone). */
    get canWrite(): boolean {
        return this.writable;
    }
}

export const sentences = new Sentences();
