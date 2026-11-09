import type { Command, CommandContext } from "../command.js";
import { townById } from "../citizenship.js";
import { describeGuildPosts, guildPostCount, isGuildPostId, moveGuildPost, resetGuildPosts } from "../guild-vendors.js";
import { yawOf } from "../position.js";

export const mercadorCommand: Command = {
    name: "mercador",
    summary: "Mostra e posiciona os comerciantes de guilda (um para cada guilda em cada cidade, parados onde o jogo põe o ofício).",
    usage: [
        "/mercador listar [cidade]  -- cada comerciante, se está em pé (eles só existem com um jogador por perto), onde fica e se o lugar veio do jogo",
        "/mercador aqui <id>  -- leva o comerciante (ex.: ferreiro-suchdol, alquimista-wysoka) para onde você está, virado como você; o lugar escolhido passa a ser o dele",
        "/mercador padrao [id]  -- um comerciante (ou todos) volta ao lugar original",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, which] = args;
        switch (sub) {
            case "listar": {
                if (which !== undefined && townById(which) === null) {
                    reply.line(`Não conheço a cidade '${which}'. Os ids são os da seção Cidadania (suchdol, wysoka, raborsch, malesov...).`);
                    return;
                }
                reply.line(`${guildPostCount()} comerciantes de guilda${which !== undefined ? ` (${which})` : ""}:`);
                reply.lines(describeGuildPosts(which));
                return;
            }

            case "aqui": {
                if (which === undefined || !isGuildPostId(which) || args.length > 2) {
                    usage();
                    return;
                }
                moveGuildPost(which, player.position, yawOf(player.rotation as Quaternion));
                reply.line(`${which} agora fica onde você está.`);
                return;
            }

            case "padrao": {
                if (which !== undefined && !isGuildPostId(which)) {
                    usage();
                    return;
                }
                const back = resetGuildPosts(which);
                reply.line(back === 0 ? "Nenhum lugar tinha sido trocado." : `${back} ${back === 1 ? "comerciante voltou" : "comerciantes voltaram"} ao lugar original.`);
                return;
            }

            default:
                usage();
        }
    },
};
