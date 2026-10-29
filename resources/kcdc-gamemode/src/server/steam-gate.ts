/**
 * Whoever walks in is the Steam account they walk in with (user, 2026-10-25: "independente do nome que o jogador colocar no menu no jogo ao entrar no
 * mundo ele sempre deve ir para um personagem já criado vinculado à steam dele"). A character is kept under the Steam id and never under the name typed in
 * the game's join menu (`characters.ts`), so that name can be anything -- the default "Player" (38 of the 68 saved characters were made under it), or
 * another character's name -- without changing which character a player gets. What can go wrong is the other end: now and then a client reports no Steam
 * account at all (its Steam closed or offline at that moment: 26 of 1,378 joins in nine days, always from the same eight machines, which came in with an
 * account the next minute). Such a body used to be let in as a stranger: the arrival road, the creator once more, and nothing it did was ever saved.
 *
 * So a join with no Steam account is turned away at the door, told what to do, and tries again. The player the game authenticated (`player.steamId`) has to
 * have one too, once in the world, or they are sent out. `secrets/steam-gate.json` -- `{ "required": false }` -- lets everybody in again without a restart (the day the
 * framework's own Steam check misbehaves for everyone); with no file, or one that cannot be read, the account is required.
 */

declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
}

const FILE = "secrets/steam-gate.json";

/** Shown on the connecting screen (512 bytes at most): what happened, what to do, and that the menu's name is not what picks the character. */
export const STEAM_NEEDED =
    "O servidor não recebeu a sua conta Steam (isto não é a lista de aprovados). Abra o Steam e espere ficar online, feche o jogo e o launcher, abra o launcher de novo (sem 'Executar como administrador') e entre. O personagem é ligado à conta Steam, não ao nome do menu. " +
    "/ No Steam account reached the server: open Steam (online), close the game and the launcher, open the launcher again (not as administrator) and join.";

/** Whether an account is demanded, from the file as it reads now: yes unless it says `"required": false`. */
export function readRequired(read: (path: string) => string): { readonly required: boolean; readonly problem: string | null } {
    let text: string;
    try {
        text = read(FILE);
    } catch (error: unknown) {
        if ((error as { code?: string }).code === "ENOENT") {
            return { required: true, problem: null };
        }
        return { required: true, problem: `não consegui ler ${FILE}: ${error instanceof Error ? error.message : String(error)}` };
    }
    try {
        const parsed = JSON.parse(text) as { required?: unknown } | null;
        return { required: parsed === null || typeof parsed !== "object" || parsed.required !== false, problem: null };
    } catch (error: unknown) {
        return { required: true, problem: `${FILE} não é um JSON válido: ${error instanceof Error ? error.message : String(error)}` };
    }
}

export function installSteamGate(): void {
    let fs: NodeFs | null = null;
    try {
        fs = require("node:fs") as NodeFs;
    } catch {
        fs = null;
    }
    const read = (path: string): string => {
        if (fs === null) {
            throw new Error("o módulo fs não está disponível neste servidor");
        }
        return fs.readFileSync(path, "utf8");
    };
    const state = (): boolean => {
        const gate = readRequired(read);
        if (gate.problem !== null) {
            console.error(`steam-gate: ${gate.problem}; a conta Steam continua sendo exigida`);
        }
        return gate.required;
    };
    console.log(`steam-gate: ${state() ? "quem entra sem conta Steam é recusado e tenta de novo" : `exigência desligada em ${FILE}: entra quem não informa a Steam`}`);

    Events.on("playerConnecting", (connection) => {
        if (connection.steamId !== "") {
            return;
        }
        if (!state()) {
            console.log(`steam-gate: ${connection.nickname} (sem Steam) de ${connection.ip || "?"} entrou porque a exigência está desligada`);
            return;
        }
        console.log(`steam-gate: recusei ${connection.nickname} de ${connection.ip || "?"}: o cliente não informou uma conta Steam (hardware ${connection.hardwareId || "?"}); o nome do menu não escolhe o personagem`);
        connection.reject(STEAM_NEEDED);
    });

    // The account the framework itself authenticated, looked at once the body is in the world (at `playerConnect` it may still be on its way): with none,
    // nothing this player does could be kept.
    Events.on("playerSpawned", (player) => {
        if (player.steamId !== "" || !state()) {
            return;
        }
        console.log(`steam-gate: ${player.nickname} chegou sem conta Steam autenticada (hardware ${player.hardwareId || "?"}): saiu do servidor`);
        player.kick(STEAM_NEEDED);
    });
}
