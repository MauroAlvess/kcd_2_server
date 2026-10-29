/**
 * Banned Steam accounts (user, 2026-10-26: "na tela de jogadores na seção admin deve ter um botão banir; esse botão bane o perfil da steam do jogador ao servidor"; a
 * player had killed three kept horses in Raborsch with a bow). The ban is the Steam account, the one a character is kept under, so a new name in the game's menu
 * changes nothing. It is kept in `playerdata/bans.json`, read again by nobody but this module (the administrators' panel and `/banir` write it), and checked at the
 * door (`playerConnecting`, before the whitelist's own check) and again once the body is in the world, where a ban made while the player was loading kicks them.
 * A ban also takes the account off `secrets/whitelist.json`'s reach for good: the whitelist never un-bans, and un-banning does not put anyone on the whitelist.
 *
 *   { "v": 1, "bans": { "<steamId>": { "name": "askelad", "by": "Mauro", "at": 1792930000000, "reason": "…" } } }
 *
 * A file that cannot be read is not written over, and nobody is banned by it: the server logs it.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/bans.json`;
const STEAM_ID = /^7656119\d{10}$/;

export const BANNED_MESSAGE =
    "Sua conta Steam foi banida deste servidor. Quem acha que foi um engano pode falar com a administração pelo Discord. / Your Steam account is banned from this server.";

export interface Ban {
    readonly steamId: string;
    readonly name: string;
    readonly by: string;
    readonly at: number;
    readonly reason: string;
}

export interface BanOutcome {
    readonly ok: boolean;
    readonly message: string;
}

export class Bans {
    private bans = new Map<string, Ban>();
    /** False while the file could not be read: nothing is written over it then. */
    private writable = true;

    constructor(private readonly now: () => number = () => Date.now()) {}

    load(): void {
        const loaded = read<{ bans?: unknown }>(FILE);
        if (loaded.status === "corrupt") {
            this.writable = false;
            console.log(`bans: ${FILE} ilegível (${loaded.reason}); ninguém é banido por ele e nada será gravado por cima até que seja consertado`);
            return;
        }
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        const raw = loaded.value.bans;
        if (typeof raw !== "object" || raw === null) {
            return;
        }
        for (const [steamId, entry] of Object.entries(raw as Record<string, unknown>)) {
            if (!STEAM_ID.test(steamId) || typeof entry !== "object" || entry === null) {
                continue;
            }
            const fields = entry as Partial<Record<keyof Ban, unknown>>;
            this.bans.set(steamId, {
                steamId,
                name: typeof fields.name === "string" ? fields.name : "",
                by: typeof fields.by === "string" ? fields.by : "",
                at: typeof fields.at === "number" && Number.isFinite(fields.at) ? fields.at : 0,
                reason: typeof fields.reason === "string" ? fields.reason : "",
            });
        }
    }

    private persist(): void {
        if (!this.writable) {
            return;
        }
        try {
            ensureDir(DIR);
            const bans: Record<string, Omit<Ban, "steamId">> = {};
            for (const [steamId, ban] of this.bans) {
                bans[steamId] = { name: ban.name, by: ban.by, at: ban.at, reason: ban.reason };
            }
            write(FILE, { v: 1, bans });
        } catch (error: unknown) {
            console.log(`bans: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    isBanned(steamId: string): boolean {
        return this.bans.has(steamId);
    }

    get(steamId: string): Ban | null {
        return this.bans.get(steamId) ?? null;
    }

    count(): number {
        return this.bans.size;
    }

    /** Every ban, for the panel's list of the banned (an account that never made a character is only there). */
    list(): Ban[] {
        return [...this.bans.values()];
    }

    /** Bans a Steam account; `name` is how the administration knows them (the character's name, else the nickname). */
    ban(steamId: string, name: string, by: string, reason = ""): BanOutcome {
        if (!STEAM_ID.test(steamId)) {
            return { ok: false, message: `${name || "Esse jogador"} não tem uma conta Steam conhecida: não há o que banir.` };
        }
        if (!this.writable) {
            return { ok: false, message: "O arquivo de banidos não pôde ser lido; nada foi banido para não apagar o que está nele." };
        }
        if (this.bans.has(steamId)) {
            return { ok: false, message: `${name || "Esse jogador"} já está banido.` };
        }
        this.bans.set(steamId, { steamId, name, by, at: this.now(), reason: reason.slice(0, 200) });
        this.persist();
        console.log(`bans: ${by} baniu ${name || "uma conta"}${reason !== "" ? ` (${reason})` : ""}`);
        return { ok: true, message: `${name || "O jogador"} foi banido do servidor.` };
    }

    unban(steamId: string, name: string, by: string): BanOutcome {
        if (!this.bans.has(steamId)) {
            return { ok: false, message: `${name || "Esse jogador"} não está banido.` };
        }
        if (!this.writable) {
            return { ok: false, message: "O arquivo de banidos não pôde ser lido; nada foi alterado." };
        }
        this.bans.delete(steamId);
        this.persist();
        console.log(`bans: ${by} desbaniu ${name || "uma conta"}`);
        return { ok: true, message: `${name || "O jogador"} foi desbanido: pode voltar a entrar se estiver na lista de aprovados.` };
    }
}

export const bans = new Bans();

/** Puts the banned out of the server as soon as they are in a body, and at the door before that. */
export function installBans(): void {
    bans.load();
    console.log(`bans: ${bans.count()} conta(s) banida(s)`);

    Events.on("playerConnecting", (connection) => {
        if (connection.steamId !== "" && bans.isBanned(connection.steamId)) {
            console.log(`bans: recusei ${connection.nickname}: conta banida`);
            connection.reject(BANNED_MESSAGE);
        }
    });

    // A ban made while the player was still loading, or an account that reached the world by another way.
    Events.on("playerSpawned", (player) => {
        if (player.steamId !== "" && bans.isBanned(player.steamId)) {
            console.log(`bans: ${player.nickname} está banido e saiu do servidor`);
            player.kick(BANNED_MESSAGE);
        }
    });
}

/** Whoever of the online players holds a banned account is sent out now (called after a ban). */
export function kickBanned(): number {
    let kicked = 0;
    for (const player of Player.all()) {
        if (player.steamId !== "" && bans.isBanned(player.steamId)) {
            try {
                player.kick(BANNED_MESSAGE);
                kicked += 1;
            } catch (error: unknown) {
                console.log(`bans: não consegui tirar ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    return kicked;
}
