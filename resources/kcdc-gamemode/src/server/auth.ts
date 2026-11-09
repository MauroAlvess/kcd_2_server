/**
 * Who may join, and what each of them may run.
 *
 * A player joins through a link that carries a ticket --
 * `kcdc://host?nickname=Name&ticket=label.secret` -- and `playerConnecting` checks it before they
 * are sent anything. The server keeps only a salted scrypt hash of each secret, in
 * `secrets/auth.json` (written by `scripts/auth.mjs`), so reading that file lets nobody in.
 * A ticket has a role: a `player` runs the few commands in COMMON_COMMANDS, an `admin` runs all.
 *
 * What the file says decides how strict this is:
 *
 *   - no file             nobody is checked and everyone is an admin, as on a fresh checkout;
 *   - "enforce": false    tickets are read and roles given, but a missing or wrong ticket is let in
 *                         as a player, so a link that does not work cannot lock its owner out while
 *                         it is being tried;
 *   - "enforce": true     a missing or wrong ticket is turned away;
 *   - unreadable file     everybody is turned away. Failing open would hide the mistake.
 *
 * The file is read again on every join request, so `scripts/auth.mjs` changes (a revoked ticket, the
 * switch to enforcing) take effect for the next player without a restart.
 *
 * A player who joined without a ticket (from the launcher's own menu, which has no field for one) can
 * present it afterwards with `/admin <ticket>`: `promote` checks it the same way as a join does, with the
 * same limit on wrong tries per address, and gives the ticket's role until they leave.
 *
 * This guards chat commands and who gets in. It does not stop a modified client from sending the
 * gamemode's own events by hand.
 */

declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

interface NodeCrypto {
    scrypt(
        password: string,
        salt: Uint8Array,
        keylen: number,
        options: { N: number; r: number; p: number; maxmem: number },
        callback: (error: Error | null, key: Uint8Array) => void,
    ): void;
    timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}

export type Role = "player" | "admin";

/**
 * The commands a plain player may run. Anything not listed here, including a command added later, is for admins.
 * `ui` is deliberately absent: it opens the F4 debug panel, which is for administrators only (see `panel.ts`). Nor is `creator`
 * (user, 2026-10-20: "/creator é só admin que pode usar"): a player makes their character once, at their first entry, and what
 * they may change afterwards is changed at the barber's and the tailor's, not by a command.
 */
export const COMMON_COMMANDS: ReadonlySet<string> = new Set(["help", "camera", "mute", "unmute", "mutes", "dice", "anim", "face", "chave", "admin", "cavalo", "fome", "sede", "cansaco", "sujeira", "cachorro", "leitura", "cozinhar", "me", "do", "try", "preso", "acordar", "paz", "carroca", "carroça", "idioma", "language", "levantar", "horta", "mural"]);

const FILE = "secrets/auth.json";

/** `label.secret`: the label picks the one hash to check, so a join costs one scrypt, never one per ticket. */
const SHAPE = /^([a-z0-9-]{1,20})\.([a-z0-9]{16,64})$/;

const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const PENDING_MS = 2 * 60 * 1000;

const DENIED = "Acesso restrito. Entre pelo atalho de acesso rápido do servidor.";
const TOO_MANY = "Muitas tentativas com ticket errado. Aguarde alguns minutos.";
const UNAVAILABLE = "Servidor indisponível: a verificação de acesso não está funcionando. Avise a administração.";

interface StoredTicket {
    readonly label: string;
    readonly role: Role;
    readonly N: number;
    readonly r: number;
    readonly p: number;
    readonly salt: Uint8Array;
    readonly hash: Uint8Array;
}

type Mode = "open" | "observe" | "enforce" | "broken";

interface Admission {
    readonly role: Role;
    readonly label: string;
    readonly at: number;
}

interface Identity {
    readonly nickname: string;
    readonly steamId: string;
    readonly epicId: string;
    readonly discordId: string;
    readonly hardwareId: string;
}

let mode: Mode = "open";
let tickets: readonly StoredTicket[] = [];
let crypto: NodeCrypto | null = null;
let fs: NodeFs | null = null;

/** Admitted at the gate, waiting for the player to appear. Keyed by what the client reported about itself. */
const pending = new Map<string, Admission>();
const roles = new Map<number, Role>();
const failures = new Map<string, number[]>();

function identityKey(who: Identity): string {
    return [who.steamId, who.epicId, who.discordId, who.hardwareId, who.nickname].join("|");
}

function describe(who: Identity & { readonly ip: string }): string {
    return `${who.nickname} (${who.steamId || "sem Steam"}) de ${who.ip || "?"}`;
}

function fromHex(hex: string): Uint8Array | null {
    if (!/^(?:[0-9a-f]{2})+$/.test(hex)) {
        return null;
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}

/** `scrypt$N$r$p$saltHex$hashHex`, as `scripts/auth.mjs` writes it. */
function parseTicket(raw: unknown): StoredTicket | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const { label, role, hash } = raw as { label?: unknown; role?: unknown; hash?: unknown };
    if (typeof label !== "string" || !/^[a-z0-9-]{1,20}$/.test(label) || (role !== "player" && role !== "admin") || typeof hash !== "string") {
        return null;
    }
    const parts = hash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") {
        return null;
    }
    const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    const salt = fromHex(parts[4] ?? "");
    const key = fromHex(parts[5] ?? "");
    const sane = Number.isInteger(N) && N >= 1024 && N <= 1 << 20 && (N & (N - 1)) === 0 && Number.isInteger(r) && r >= 1 && r <= 32 && Number.isInteger(p) && p >= 1 && p <= 16;
    if (!sane || salt === null || key === null || key.length < 16) {
        return null;
    }
    return { label, role, N, r, p, salt, hash: key };
}

/** Reads the file again. Returns what went wrong, or null. */
function refresh(): string | null {
    if (fs === null || crypto === null) {
        mode = "broken";
        return "o módulo crypto ou fs não está disponível neste servidor";
    }

    let text: string;
    try {
        text = fs.readFileSync(FILE, "utf8");
    } catch (error: unknown) {
        if ((error as { code?: string }).code === "ENOENT") {
            mode = "open";
            tickets = [];
            return null;
        }
        mode = "broken";
        return `não consegui ler ${FILE}: ${error instanceof Error ? error.message : String(error)}`;
    }

    let parsed: { enforce?: unknown; tickets?: unknown };
    try {
        parsed = JSON.parse(text) as { enforce?: unknown; tickets?: unknown };
    } catch (error: unknown) {
        mode = "broken";
        return `${FILE} não é um JSON válido: ${error instanceof Error ? error.message : String(error)}`;
    }

    const list = Array.isArray(parsed.tickets) ? (parsed.tickets as unknown[]) : null;
    const understood = list === null ? [] : list.map(parseTicket);
    if (list === null || understood.some((entry) => entry === null)) {
        mode = "broken";
        return `${FILE} tem um ticket que não entendo`;
    }
    const ready = understood as StoredTicket[];
    if (new Set(ready.map((entry) => entry.label)).size !== ready.length) {
        mode = "broken";
        return `${FILE} repete um nome de ticket`;
    }

    tickets = ready;
    mode = parsed.enforce === true ? "enforce" : "observe";
    return null;
}

function derive(secret: string, entry: Pick<StoredTicket, "N" | "r" | "p" | "salt"> & { readonly hash: Uint8Array }): Promise<Uint8Array> {
    const active = crypto;
    if (active === null) {
        return Promise.reject(new Error("crypto indisponível"));
    }
    return new Promise((resolve, reject) => {
        active.scrypt(secret, entry.salt, entry.hash.length, { N: entry.N, r: entry.r, p: entry.p, maxmem: 256 * entry.N * entry.r }, (error, key) => {
            if (error) {
                reject(error);
            } else {
                resolve(key);
            }
        });
    });
}

/** The ticket a valid `label.secret` names, or null. Anything that is not shaped like one costs nothing. */
async function identify(raw: string): Promise<StoredTicket | null> {
    const match = SHAPE.exec(raw);
    if (match === null) {
        return null;
    }
    const entry = tickets.find((candidate) => candidate.label === match[1]);
    if (entry === undefined || crypto === null) {
        return null;
    }
    const key = await derive(match[2] ?? "", entry);
    return crypto.timingSafeEqual(key, entry.hash) ? entry : null;
}

function recentFailures(ip: string, now: number): number[] {
    const recent = (failures.get(ip) ?? []).filter((at) => now - at < FAILURE_WINDOW_MS);
    if (recent.length > 0) {
        failures.set(ip, recent);
    } else {
        failures.delete(ip);
    }
    return recent;
}

function noteFailure(ip: string, now: number): void {
    const recent = recentFailures(ip, now);
    recent.push(now);
    failures.set(ip, recent);
    if (failures.size > 500) {
        for (const known of [...failures.keys()]) {
            recentFailures(known, now);
        }
    }
}

function forgetOldAdmissions(now: number): void {
    for (const [key, admission] of pending) {
        if (now - admission.at > PENDING_MS) {
            pending.delete(key);
        }
    }
}

export function roleOf(player: Player): Role {
    if (mode === "open") {
        return "admin";
    }
    return roles.get(player.id) ?? "player";
}

export function isAdmin(player: Player): boolean {
    return roleOf(player) === "admin";
}

export function canRun(player: Player, commandName: string): boolean {
    return COMMON_COMMANDS.has(commandName) || isAdmin(player);
}

async function admit(connection: PendingConnection): Promise<void> {
    const problem = refresh();
    if (problem !== null) {
        console.error(`auth: ${problem}; ninguém entra até isso ser corrigido`);
        connection.reject(UNAVAILABLE);
        return;
    }
    if (mode === "open") {
        return;
    }

    const now = Date.now();
    forgetOldAdmissions(now);

    if (mode === "enforce" && recentFailures(connection.ip, now).length >= MAX_FAILURES) {
        console.log(`auth: recusei ${describe(connection)}: tickets errados demais`);
        connection.reject(TOO_MANY);
        return;
    }

    let entry: StoredTicket | null;
    try {
        entry = await identify(connection.ticket);
    } catch (error: unknown) {
        console.error(`auth: a verificação falhou: ${error instanceof Error ? error.message : String(error)}`);
        connection.reject(UNAVAILABLE);
        return;
    }

    if (entry !== null) {
        pending.set(identityKey(connection), { role: entry.role, label: entry.label, at: now });
        console.log(`auth: ${describe(connection)} entrou com o ticket '${entry.label}' (${entry.role})`);
        return;
    }

    const given = connection.ticket === "" ? "sem ticket" : "ticket inválido";
    if (mode === "enforce") {
        noteFailure(connection.ip, now);
        console.log(`auth: recusei ${describe(connection)}: ${given}`);
        connection.reject(DENIED);
        return;
    }
    pending.set(identityKey(connection), { role: "player", label: "-", at: now });
    console.log(`auth: ${describe(connection)} entrou como jogador comum (${given}; o bloqueio está desligado)`);
}

export type PromoteResult = { readonly ok: boolean; readonly message: string };

/**
 * `/admin <ticket>`: checks a ticket given after joining and, if it is good, gives that ticket's role for
 * the rest of the session. A ticket only ever raises a role: a player ticket never takes admin away.
 */
export async function promote(player: Player, raw: string): Promise<PromoteResult> {
    const problem = refresh();
    if (problem !== null) {
        console.error(`auth: ${problem}`);
        return { ok: false, message: UNAVAILABLE };
    }
    if (mode === "open") {
        return { ok: true, message: "Este servidor está sem bloqueio de acesso: todos já são administradores." };
    }
    if (roleOf(player) === "admin") {
        return { ok: true, message: "Você já é administrador." };
    }

    const now = Date.now();
    if (recentFailures(player.ip, now).length >= MAX_FAILURES) {
        console.log(`auth: recusei o /admin de ${player.nickname} (${player.ip || "?"}): tickets errados demais`);
        return { ok: false, message: TOO_MANY };
    }

    let entry: StoredTicket | null;
    try {
        entry = await identify(raw);
    } catch (error: unknown) {
        console.error(`auth: a verificação falhou: ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false, message: UNAVAILABLE };
    }
    if (entry === null) {
        noteFailure(player.ip, Date.now());
        console.log(`auth: ${player.nickname} (${player.ip || "?"}) errou o ticket no /admin`);
        return { ok: false, message: "Ticket inválido." };
    }

    // The hashing took a moment; a player who left in the meantime must not leave a role behind.
    if (!Player.getById(player.id)) {
        return { ok: false, message: "Você saiu antes de a verificação terminar." };
    }
    if (entry.role !== "admin") {
        return { ok: true, message: "Ticket reconhecido, mas é de jogador: nada muda para você." };
    }
    roles.set(player.id, entry.role);
    console.log(`auth: ${player.nickname} (${player.ip || "?"}) virou administrador com o ticket '${entry.label}' pelo /admin`);
    return { ok: true, message: "Você agora é administrador, até sair do servidor." };
}

/**
 * `/admin sair`: back to a common player until they leave (2026-10-18, the user tests as a player); `/admin <ticket>` makes them
 * an administrator again. On a server with no tickets everybody is one, and nobody stops being.
 */
export function demote(player: Player): PromoteResult {
    if (mode === "open") {
        return { ok: false, message: "Este servidor está sem bloqueio de acesso: todos são administradores, e ninguém deixa de ser." };
    }
    if (roleOf(player) !== "admin") {
        return { ok: false, message: "Você já é um jogador comum." };
    }
    roles.set(player.id, "player");
    console.log(`auth: ${player.nickname} (${player.ip || "?"}) voltou a ser jogador comum pelo /admin sair`);
    return { ok: true, message: "Você voltou a ser um jogador comum até sair do servidor. Para ser administrador de novo: /admin <ticket>." };
}

export function installAuth(): void {
    try {
        fs = require("node:fs") as NodeFs;
        crypto = require("node:crypto") as NodeCrypto;
    } catch (error: unknown) {
        fs = null;
        crypto = null;
        console.error(`auth: não carreguei fs/crypto: ${error instanceof Error ? error.message : String(error)}`);
    }

    const problem = refresh();
    if (problem !== null) {
        console.error(`auth: ${problem}; ninguém entra até isso ser corrigido`);
    } else if (mode === "open") {
        console.log(`auth: sem ${FILE}; ninguém é verificado e todos são administradores`);
    } else {
        const admins = tickets.filter((entry) => entry.role === "admin").length;
        console.log(`auth: ${mode === "enforce" ? "bloqueio ligado" : "só observando (o bloqueio está desligado)"}; ${admins} ticket(s) de admin, ${tickets.length - admins} de jogador`);
        // Proves the runtime's scrypt works before the first player needs it.
        derive("teste", { N: 1024, r: 8, p: 1, salt: new Uint8Array(16), hash: new Uint8Array(32) }).catch((error: unknown) => {
            mode = "broken";
            console.error(`auth: o scrypt não funciona neste servidor: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    Events.on("playerConnecting", admit);

    Events.on("playerConnect", (player) => {
        if (mode === "open") {
            return;
        }
        const key = identityKey(player);
        const admission = pending.get(key);
        pending.delete(key);
        roles.set(player.id, admission?.role ?? "player");
        if (admission === undefined) {
            console.log(`auth: ${player.nickname} apareceu sem passar pela portaria; tratado como jogador comum`);
        }
    });

    Events.on("playerDisconnect", (player) => {
        roles.delete(player.id);
    });
}
