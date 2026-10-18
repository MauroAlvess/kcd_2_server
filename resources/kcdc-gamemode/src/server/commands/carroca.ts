import { nameOf } from "../acquaintances.js";
import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { allCarts, bringCart, cartName, cartsOf, giveCart, registerCart, releaseCart, renameCart, whereIs } from "../carts.js";
import { compassDirection } from "../horses.js";
import { findPlayer } from "../players.js";

export const carrocaCommand: Command = {
    name: "carroca",
    summary: "As suas carroças: onde estão, trazer para perto, dar nome; o admin dá, registra e libera.",
    usage: [
        "/carroca  -- as suas carroças e onde estão",
        "/carroca trazer [n]  -- a carroça vazia vem para a sua frente (de dois em dois minutos)",
        "/carroca nome [n] <nome>  -- dá nome à carroça (sem nome, volta ao comum)",
        "/carroca dar <jogador> [modelo]  -- (admin) uma carroça nova para o jogador",
        "/carroca registrar <jogador>  -- (admin) a carroça sem dono ao lado do jogador passa a ser dele",
        "/carroca listar  -- (admin) todas as carroças com dono",
        "/carroca liberar <n>  -- (admin) a carroça n da lista deixa de ter dono",
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
            reply.line("Só administradores dão, registram e liberam carroças.");
            return;
        }

        if (sub === "listar" || sub === "liberar") {
            const all = allCarts();
            if (sub === "listar") {
                reply.lines(
                    all.length === 0
                        ? ["Nenhuma carroça com dono."]
                        : all.map((owned, index) => `  ${index + 1}. ${owned.record.name || cartName(owned.record.blueprint)} de ${owned.record.ownerName || owned.record.owner}, ${owned.cart === null ? "fora do mundo" : "no mundo"}, em ${owned.record.x.toFixed(0)} ${owned.record.y.toFixed(0)} ${owned.record.z.toFixed(0)}`),
                );
                return;
            }
            const owned = all[Number(rest[0]) - 1];
            if (owned === undefined) {
                usage();
                return;
            }
            reply.line(releaseCart(owned.record.key) ? `${cartName(owned.record.blueprint)} de ${owned.record.ownerName} agora é de ninguém (continua no mundo).` : "Essa carroça já não estava guardada.");
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
                Chat.sendToPlayer(found.player, `${nameOf(player)} deu a você uma carroça. /carroca mostra onde ela está; a seção Animais do painel (F2) a mostra também, e E perto dela escolhe o assento.`);
            }
            return;
        }

        usage();
    },
};
