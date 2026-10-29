import { giveSet, placesOf, setById, setsOf, takeSet, wearSet } from "../armor-sets.js";
import type { ArmorSet } from "../armor-sets.js";
import type { Command, CommandContext, Reply } from "../command.js";
import { findPlayer } from "../players.js";

/** The player a line names, or the caller; null after saying why not. */
function targetOf(player: Player, who: string | undefined, reply: Reply): Player | null {
    if (who === undefined) {
        return player;
    }
    const found = findPlayer(who);
    if ("error" in found) {
        reply.line(found.error);
        return null;
    }
    return found.player;
}

const line = (set: ArmorSet): string => `${set.id} -- ${set.name} (${set.category}, ${set.weight})`;

/**
 * `/conjunto`: the game's armour sets by town, village or lord (`armor-sets.ts`; the list with every piece is ARMADURAS.md),
 * handed out whole.
 */
export const conjuntoCommand: Command = {
    name: "conjunto",
    summary: "(admin) Os conjuntos de armadura do jogo por cidade, vila e senhor, e os pacotes de brasão (casaco, escudo e espada do cavaleiro) de cada casa (lista completa em ARMADURAS.md): dá ou veste um inteiro.",
    usage: [
        "/conjunto  -- os lugares e quantos conjuntos cada um tem",
        "/conjunto <lugar>  -- os conjuntos de um lugar (kuttenberg, suchdol, raborsch, malesov... e brasoes: o casaco com o brasão, o escudo e a espada do cavaleiro de cada casa)",
        "/conjunto ver <id>  -- as peças de um conjunto",
        "/conjunto dar <id> [jogador] [qualidade 1-4]  -- todas as peças no inventário (o seu, ou o do jogador)",
        "/conjunto tirar <id> [jogador]  -- tira do inventário uma de cada peça do conjunto (para desfazer um dar enganado)",
        "/conjunto vestir <id> [jogador]  -- veste o conjunto na hora (corpo masculino; as roupas de antes vão para o inventário)",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, id, who, qualityWord] = args;
        if (sub === undefined) {
            const places = placesOf();
            reply.line(places.length === 0 ? "Não há conjuntos: falta data/armor-sets.json." : `Lugares (${places.length}): ${places.map((p) => `${p.place} (${p.count})`).join(", ")}. /conjunto <lugar> lista os de um.`);
            return;
        }
        if (sub === "ver" || sub === "dar" || sub === "vestir" || sub === "tirar") {
            const set = id === undefined ? null : setById(id);
            if (set === null) {
                reply.line(id === undefined ? "Qual conjunto? Por exemplo: /conjunto dar raborsch-1." : `Não há conjunto '${id}'. /conjunto <lugar> mostra os ids.`);
                return;
            }
            if (sub === "ver") {
                reply.line(`${line(set)}: ${set.description}.`);
                reply.lines(set.pieces.map((piece) => `  ${piece.part}: ${piece.name} -- ${piece.code}`));
                return;
            }
            const target = targetOf(player, who, reply);
            if (target === null) {
                return;
            }
            if (sub === "vestir") {
                const why = wearSet(target, set);
                reply.line(why === "" ? `${target.nickname} vestiu ${set.id} (${set.name}).` : `Não deu para vestir ${set.id}: ${why}.`);
                return;
            }
            if (sub === "tirar") {
                const done = takeSet(target, set);
                if (done.refused) {
                    reply.line(`O jogo recusou tirar as peças de ${target.nickname} (peça vestida? inventário aberto?). Nada foi tirado.`);
                    return;
                }
                reply.line(`${set.id} (${set.name}) de ${target.nickname}: ${done.taken.length} de ${set.pieces.length} peças tiradas.${done.missing.length > 0 ? ` Não estavam no inventário: ${done.missing.join(", ")}.` : ""}`);
                return;
            }
            const quality = qualityWord === undefined ? 1 : Number(qualityWord);
            if (!Number.isInteger(quality) || quality < 1 || quality > 4) {
                usage();
                return;
            }
            const done = giveSet(target, set, quality);
            reply.line(`${set.id} (${set.name}) para ${target.nickname}: ${done.given} de ${set.pieces.length} peças.${done.failed.length > 0 ? ` Não entraram: ${done.failed.join(", ")} (inventário cheio?).` : ""}`);
            return;
        }
        const found = setsOf(args.join(" "));
        if (found.length === 0) {
            reply.line(`Nenhum lugar chamado '${args.join(" ")}'. /conjunto mostra os lugares.`);
            return;
        }
        reply.lines([`${found[0]?.place}: ${found.length} conjunto(s)`, ...found.map((set) => `  ${line(set)}`)]);
    },
};
