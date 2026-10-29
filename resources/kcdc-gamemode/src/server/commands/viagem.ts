import type { Command, CommandContext } from "../command.js";
import { coaches } from "../travel.js";

/**
 * `/viagem` (admin): the coach stops of the fast travel (`travel.ts`), where their wagons and coachmen stand, and the price. The
 * wagon of each stop was put by hand, by the road outside the village (looked at from above in World Builder); one that is not right
 * is put right with `/viagem aqui <parada>` (the wagon in front of the administrator, broadside, and the coachman on their side of
 * it) and `/viagem original <parada>` brings the chosen place back. A stop an administrator made with `/viagem nova` has no chosen
 * place: `/viagem procurar <parada>` (standing near it) has their game read the ground by the road.
 */
export const viagemCommand: Command = {
    name: "viagem",
    summary: "(admin) As paradas da viagem rápida de carroça: onde estão, o preço, e para mudar de lugar.",
    usage: [
        "/viagem  -- as paradas, as carroças, os cocheiros e o preço",
        "/viagem aqui <parada>  -- a carroça da parada na sua frente, de lado, e o cocheiro do seu lado dela",
        "/viagem cocheiro <parada>  -- só o cocheiro, onde você está",
        "/viagem original <parada>  -- a carroça e o cocheiro voltam ao lugar escolhido à mão para a parada",
        "/viagem procurar <parada>  -- (parada nova) o chão é lido pelo SEU jogo (fique a menos de 150 m do ponto da parada) e a carroça vai para a beira da estrada",
        "/viagem malha <parada>  -- só a malha de navegação escolhe o lugar (não sabe o que é estrada: a carroça pode ficar sobre ela)",
        "/viagem ir <parada>  -- leva você até a parada",
        "/viagem preco <base> <por km>  -- o preço das viagens, em moedas",
        "/viagem nova <id> <nome>  -- uma parada nova onde você está",
        "/viagem remover <parada>  -- tira a parada (carroça e cocheiro)",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, first, ...rest] = args;
        if (sub === undefined) {
            for (const line of coaches.lines()) {
                reply.line(line);
            }
            return;
        }
        const what = (sub ?? "").toLowerCase();
        if ((what === "preco" || what === "preço") && first !== undefined && rest[0] !== undefined) {
            reply.line(coaches.setPrices(Number(first.replace(",", ".")), Number(rest[0].replace(",", "."))));
            return;
        }
        if (first === undefined) {
            usage();
            return;
        }
        switch (what) {
            case "aqui":
                reply.line(coaches.placeHere(player, first));
                return;
            case "cocheiro":
                reply.line(coaches.coachHere(player, first));
                return;
            case "original":
                reply.line(coaches.restore(first));
                return;
            case "procurar":
                reply.line(coaches.research(player, first));
                return;
            case "malha":
                reply.line(coaches.researchMesh(first));
                return;
            case "ir":
                reply.line(coaches.goTo(player, first));
                return;
            case "nova":
                reply.line(coaches.addStop(player, first, rest.join(" ")));
                return;
            case "remover":
                reply.line(coaches.removeStop(first));
                return;
            default:
                usage();
        }
    },
};
