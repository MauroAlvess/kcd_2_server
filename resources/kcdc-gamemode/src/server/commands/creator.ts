import type { Command, CommandContext } from "../command.js";
import { allCharacters, askRedo, getCharacter, redoPending, saveCharacter } from "../characters.js";
import { closeCreatorFor, openCreatorFor, tuneCreatorFor } from "../creator.js";
import { isAdmin } from "../auth.js";
import { ensureStarter } from "../kits.js";

/**
 * `/creator`. The creator itself is `creator.ts` (a page of this resource over the player's own body). This file keeps the
 * other one, the game's own character stage, which `CharacterCreator` in the client opens: `/creator nativo`, and what a
 * player gets when the page cannot open.
 *
 * The native stage is client-only: the client script opens it and hears what the player accepted. This half only asks a
 * client to open one and puts on whatever look comes back -- through `player.setAppearance`, which checks it against the
 * catalog like any other look a script asks for. An accepted look is also remembered in `characters.ts`, by Steam id, so a
 * returning player keeps it instead of being asked again (see `first-join.ts`); the name and the alcunha already kept stay.
 */

const RESOURCE = "kcdc-gamemode";
export const OPEN_EVENT = `${RESOURCE}:creator.open`;
export const CLOSE_EVENT = `${RESOURCE}:creator.close`;
export const ACCEPTED_EVENT = `${RESOURCE}:creator.accepted`;

/** The players this asked to open the game's own stage, so a look nobody asked for is not put on. */
const asked = new Set<number>();

/**
 * Asks this player's client to open the game's own character stage. `mandatory` is for a newcomer, who cannot back out of it:
 * the client opens it again when they do.
 */
export function openNativeCreatorFor(player: Player, genders: "male" | "female" | "both" = "both", mandatory = false): void {
    asked.add(player.id);
    player.emit(OPEN_EVENT, JSON.stringify({ genders, mandatory }));
}

export function installCreatorSample(): void {
    Events.onClient(ACCEPTED_EVENT, (sender, payload) => {
        const player = sender as Player;
        if (!asked.delete(player.id)) {
            return;
        }

        let look: unknown;
        try {
            look = typeof payload === "string" ? JSON.parse(payload) : payload;
        } catch {
            look = undefined;
        }
        if (typeof look !== "object" || look === null || !player.setAppearance(look as Partial<Appearance>)) {
            Chat.sendToPlayer(player, "That look could not be put on.");
            return;
        }
        saveCharacter(player.steamId, look as Appearance, player.nickname);
        Chat.sendToPlayer(player, "You are wearing your new look.");
        // A newcomer is dressed and given their coin once the look is chosen, for the gender they chose.
        ensureStarter(player);
    });

    Events.on("playerDisconnect", (player) => {
        asked.delete(player.id);
    });
}

/** What each number of `/creator camera` is, in order, and the range it may be in. */
const TUNING: readonly { readonly key: string; readonly name: string; readonly low: number; readonly high: number }[] = [
    { key: "distance", name: "distancia", low: 1.5, high: 6 },
    { key: "figure", name: "figura", low: 0, high: 0.9 },
    { key: "fov", name: "fov", low: 20, high: 70 },
    { key: "aim", name: "altura", low: -0.6, high: 0.6 },
    { key: "light", name: "luz", low: 0, high: 20 },
];

/** An administrator's way to frame the creator's camera without a deploy: the numbers go to their own client, for the next creator. */
function tuneCamera(context: CommandContext): void {
    const { player, args } = context;
    if (!isAdmin(player)) {
        Chat.sendToPlayer(player, "O ajuste da câmera do criador é só do administrador.");
        return;
    }
    if (args[1] === "padrao") {
        tuneCreatorFor(player, {});
        Chat.sendToPlayer(player, "Câmera do criador: voltou ao padrão.");
        return;
    }
    const given = args.slice(1);
    const tuning: Record<string, number> = {};
    for (const [index, text] of given.entries()) {
        const field = TUNING[index];
        const value = Number(text.replace(",", "."));
        if (field === undefined || !Number.isFinite(value) || value < field.low || value > field.high) {
            Chat.sendToPlayer(player, `Câmera do criador: ${field === undefined ? "números demais" : `${field.name} precisa estar entre ${field.low} e ${field.high}`}. Ordem: ${TUNING.map((entry) => `${entry.name} (${entry.low} a ${entry.high})`).join(", ")}.`);
            return;
        }
        tuning[field.key] = value;
    }
    if (given.length === 0) {
        Chat.sendToPlayer(player, `Câmera do criador: a ordem é ${TUNING.map((entry) => entry.name).join(", ")}; /creator camera padrao volta ao padrão. Os valores valem a partir do próximo /creator.`);
        return;
    }
    tuneCreatorFor(player, tuning);
    Chat.sendToPlayer(player, "Câmera do criador: ajustada (o jogo mostra os valores); vale já num criador aberto e nos próximos.");
}

/**
 * `/creator refazer <jogador>`: an administrator asks for somebody's character to be made again. Online, the creator opens for
 * them now; otherwise at their next entry. Found by the name of the character, the nickname or the Steam id.
 */
function redoFor(context: CommandContext): void {
    const { player, args } = context;
    if (!isAdmin(player)) {
        Chat.sendToPlayer(player, "Pedir para alguém refazer o personagem é só do administrador.");
        return;
    }
    const wanted = args.slice(1).join(" ").trim();
    if (wanted === "") {
        const waiting = redoPending();
        Chat.sendToPlayer(player, waiting.length === 0 ? "Ninguém está esperando para refazer o personagem. /creator refazer <jogador>" : `Vão refazer o personagem na próxima entrada: ${waiting.map((entry) => entry.name).join(", ")}.`);
        return;
    }
    const key = wanted.toLowerCase();
    const matches = allCharacters().filter((entry) => entry.steamId === wanted || entry.name.toLowerCase() === key || entry.nickname.toLowerCase() === key);
    if (matches.length !== 1) {
        Chat.sendToPlayer(player, matches.length === 0 ? `Nenhum personagem chamado "${wanted}".` : `Mais de um personagem com "${wanted}": use o Steam id.`);
        return;
    }
    const target = matches[0]!;
    askRedo(target.steamId);
    const online = Player.all().find((other) => other.steamId === target.steamId);
    if (online !== undefined) {
        Chat.sendToPlayer(online, "A administração pediu que você refaça o seu personagem.");
        openCreatorFor(online, "both");
        Chat.sendToPlayer(player, `${target.name} está refazendo o personagem agora.`);
        return;
    }
    Chat.sendToPlayer(player, `${target.name} vai refazer o personagem na próxima vez que entrar.`);
}

export const creatorCommand: Command = {
    name: "creator",
    summary: "Abre o criador de personagem: visual, nome e alcunha. `nativo` abre o criador do próprio jogo.",
    usage: ["/creator [male|female|both]", "/creator nativo [male|female|both]", "/creator stop", "/creator camera [distancia] [figura] [fov] [altura] [luz]  (admin)", "/creator camera padrao  (admin)", "/creator refazer [jogador]  (admin) -- o jogador refaz o personagem (agora, ou na próxima entrada)"],
    run(context: CommandContext): void {
        const { player, args } = context;
        if (args[0] === "stop") {
            // A newcomer cannot leave: the answer is the creator's own.
            if (closeCreatorFor(player)) {
                asked.delete(player.id);
                player.emit(CLOSE_EVENT);
            }
            return;
        }

        if (args[0] === "camera") {
            tuneCamera(context);
            return;
        }

        if (args[0] === "refazer") {
            redoFor(context);
            return;
        }

        const native = args[0] === "nativo";
        const genders = (native ? args[1] : args[0]) ?? "both";
        if (args.length > (native ? 2 : 1) || (genders !== "male" && genders !== "female" && genders !== "both")) {
            context.usage();
            return;
        }

        if (native) {
            // Whoever has no character yet cannot back out of the game's own stage either.
            openNativeCreatorFor(player, genders, getCharacter(player.steamId) === null);
        } else {
            openCreatorFor(player, genders);
        }
    },
};
