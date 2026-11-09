import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { nameOfMember } from "../guild-members.js";
import { adminRemove, allPosters, CATEGORIES, muralSettings, openMural } from "../mural.js";
import { muralBoards } from "../mural-places.js";

const days = (ms: number): string => (ms >= 86_400_000 ? `${Math.floor(ms / 86_400_000)} d` : `${Math.max(0, Math.floor(ms / 3_600_000))} h`);

/**
 * `/mural`: the notice boards of the villages and towns (`mural.ts`). For everybody, the board within reach opens, as the F at it does (a
 * way in for a player whose prompt does not come up); for an administrator, the boards and their letters are listed and letters taken down.
 */
export const muralCommand: Command = {
    name: "mural",
    summary: "Abre o quadro de avisos que estiver perto de você (o mesmo que a tecla F no quadro). (admin) lista os quadros e os cartazes, e retira cartazes.",
    usage: [
        "/mural  -- abre o quadro de avisos perto de você",
        "/mural quadros  -- (admin) os quadros que o servidor conhece, onde estão e quantos cartazes têm",
        "/mural lista [quadro]  -- (admin) os cartazes de um quadro, ou de todos, com quem os afixou (mesmo os anônimos)",
        "/mural remover <id>  -- (admin) retira um cartaz",
        "/mural limpar <quadro>  -- (admin) retira todos os cartazes de um quadro",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, target] = args;
        if (sub === undefined) {
            const outcome = openMural(player);
            if (!outcome.ok && outcome.message !== "") {
                reply.line(outcome.message);
            }
            return;
        }
        if (!isAdmin(player)) {
            reply.line("Só o administrador usa essas formas de /mural. /mural, sozinho, abre o quadro de avisos perto de você.");
            return;
        }
        const now = Date.now();
        if (sub === "quadros") {
            const boards = muralBoards();
            if (boards.length === 0) {
                reply.line("Nenhum quadro de avisos foi encontrado: a exportação dos quadros está em mod.world_resources?");
                return;
            }
            reply.line(`Quadros de avisos (${boards.length}):`);
            reply.lines(boards.map((board) => `  ${board.id} -- ${board.name} (${board.x.toFixed(0)}, ${board.y.toFixed(0)}, ${board.z.toFixed(0)}): ${allPosters(board.id).length} cartaz(es)`));
            return;
        }
        if (sub === "lista") {
            const list = [...allPosters(target)].sort((a, b) => b.at - a.at);
            if (list.length === 0) {
                reply.line(target === undefined ? "Não há cartazes nos quadros." : `Não há cartazes em '${target}'.`);
                return;
            }
            reply.line(`Cartazes (${list.length}; o mais novo primeiro):`);
            reply.lines(
                list.slice(0, 30).map((poster) => {
                    const kind = CATEGORIES.find((category) => category.id === poster.category)?.label ?? poster.category;
                    return `  ${poster.id} -- ${poster.board}, ${kind}: "${poster.title.slice(0, 30)}" de ${nameOfMember(poster.owner)}${poster.anonymous ? " (anônimo)" : ""}, sai em ${days(poster.until - now)}`;
                }),
            );
            if (list.length > 30) {
                reply.line(`  ... e mais ${list.length - 30}. /mural lista <quadro> mostra os de um só.`);
            }
            return;
        }
        if (sub === "remover" || sub === "limpar") {
            if (target === undefined) {
                usage();
                return;
            }
            const count = adminRemove(target, `${player.nickname} (administrador) retirou`);
            reply.line(count === 0 ? `Não achei cartaz nem quadro '${target}'.` : `${count} cartaz(es) retirado(s).`);
            return;
        }
        usage();
        reply.line(`Um cartaz custa ${muralSettings.feeCoins} moedas e fica ${Math.round(muralSettings.lifetimeMs / 86_400_000)} dias.`);
    },
};
