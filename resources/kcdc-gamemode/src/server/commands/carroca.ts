import { nameOf } from "../acquaintances.js";
import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { allCarts, bringCart, cartGiftNote, cartName, cartsOf, giveCart, isWorldCart, placeCart, registerCart, releaseCart, removeCart, renameCart, whereIs } from "../carts.js";
import { compassDirection } from "../horses.js";
import { findPlayer } from "../players.js";

export const carrocaCommand: Command = {
    name: "carroca",
    summary: "As suas carroças: onde estão, trazer para perto, dar nome; o admin dá, coloca no mundo, registra, libera e remove.",
    usage: [
        "/carroca  -- as suas carroças e onde estão",
        "/carroca trazer [n]  -- a carroça vazia vem para a sua frente (de dois em dois minutos)",
        "/carroca nome [n] <nome>  -- dá nome à carroça (sem nome, volta ao comum)",
        "/carroca dar <jogador ou nº> [modelo]  -- (admin) uma carroça nova para o jogador (o nome, ou o número da página Jogadores, como 4438)",
        "/carroca colocar [modelo]  -- (admin) deixa uma carroça aqui, de todos: fica para sempre e volta ao lugar depois de cada reinício",
        "/carroca registrar <jogador ou nº>  -- (admin) a carroça sem dono ao lado do jogador passa a ser dele (o nome, ou o número da página Jogadores, como 4438)",
        "/carroca listar  -- (admin) todas as carroças guardadas, as de jogadores e as do mundo",
        "/carroca liberar <n>  -- (admin) a carroça n da lista deixa de ter dono e fica no mundo, para todos",
        "/carroca remover <n>  -- (admin) a carroça n da lista sai do mundo e não volta",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, ...rest] = args;

        if (sub === undefined || sub === "onde") {
            const mine = cartsOf(player.steamId);
            reply.lines(mine.length === 0 ? ["Você não tem carroça. Peça a um administrador."] : mine.map((owned, index) => `${index + 1}. ${owned.record.name || cartName(owned.record.blueprint)}: ${whereIs(player, owned.cart, compassDirection)}.`));
            return;
        }

        if (sub === "trazer") {
            const index = rest[0] === undefined ? null : Number(rest[0]) - 1;
            const owned = index === null ? null : (cartsOf(player.steamId)[index] ?? null);
            if (index !== null && owned === null) {
                reply.line("Você não tem uma carroça com esse número. /carroca lista as suas.");
                return;
            }
            reply.line(bringCart(player, owned === null ? null : owned.record.key).message);
            return;
        }

        if (sub === "nome") {
            const mine = cartsOf(player.steamId);
            const first = Number(rest[0]);
            const numbered = Number.isInteger(first) && first >= 1 && first <= mine.length && rest.length >= 1;
            const target = numbered ? mine[first - 1] : mine.length === 1 ? mine[0] : undefined;
            if (target === undefined) {
                reply.line(mine.length === 0 ? "Você não tem carroça." : "Você tem mais de uma: diga o número, como /carroca nome 2 Dourada.");
                return;
            }
            reply.line(renameCart(player.steamId, target.record.key, (numbered ? rest.slice(1) : rest).join(" ")).message);
            return;
        }

        if (!isAdmin(player)) {
            reply.line("Só administradores dão, colocam, registram, liberam e removem carroças.");
            return;
        }

        if (sub === "colocar") {
            reply.line(placeCart(player, rest[0]).message);
            return;
        }

        if (sub === "listar" || sub === "liberar" || sub === "remover") {
            const all = allCarts();
            if (sub === "listar") {
                reply.lines(
                    all.length === 0
                        ? ["Nenhuma carroça guardada."]
                        : all.map((owned, index) => `  ${index + 1}. ${owned.record.name || cartName(owned.record.blueprint)} ${isWorldCart(owned.record) ? "(do mundo, de todos)" : `de ${owned.record.ownerName || owned.record.owner}`}, ${owned.cart === null ? "fora do mundo" : "no mundo"}, em ${owned.record.x.toFixed(0)} ${owned.record.y.toFixed(0)} ${owned.record.z.toFixed(0)}`),
                );
                return;
            }
            const owned = all[Number(rest[0]) - 1];
            if (owned === undefined) {
                usage();
                return;
            }
            const label = `${owned.record.name || cartName(owned.record.blueprint)}${isWorldCart(owned.record) ? "" : ` de ${owned.record.ownerName}`}`;
            if (sub === "remover") {
                reply.line(removeCart(owned.record.key) ? `${label} saiu do mundo e não volta.` : "Essa carroça já não estava guardada.");
                return;
            }
            reply.line(releaseCart(owned.record.key) ? `${label} agora é do mundo: fica onde está, para todos, e volta ali depois de cada reinício.` : "Essa carroça já é do mundo.");
            return;
        }

        if (sub === "dar" || sub === "registrar") {
            if (rest[0] === undefined) {
                usage();
                return;
            }
            const found = findPlayer(rest[0]);
            if ("error" in found) {
                reply.line(found.error);
                return;
            }
            const outcome = sub === "dar" ? giveCart(found.player, rest[1]) : registerCart(found.player);
            reply.line(outcome.message);
            if (outcome.ok && found.player.id !== player.id) {
                Chat.sendToPlayer(found.player, cartGiftNote(nameOf(player)));
            }
            return;
        }

        usage();
    },
};
