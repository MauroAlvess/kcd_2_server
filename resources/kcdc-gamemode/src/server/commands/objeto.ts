import type { Command, CommandContext } from "../command.js";
import { yawOf } from "../position.js";
import { hideObject, hideWallsAround, listObjects, probeAhead, restoreObject } from "../level-edits.js";
import { listSites, lookAround } from "../wall-sites.js";

/**
 * `/objeto`: the level's own objects taken out of the world for everybody (`level-edits.ts`), a static gate first of all. The place
 * of an object is where the level put it, to 5 cm: the World Builder (`/builder on`, then F7) shows it, and its "Copy selection as
 * API calls" line can be pasted here whole.
 */
export const objetoCommand: Command = {
    name: "objeto",
    summary: "(admin) Tira do mundo, para todos e de vez, um objeto do próprio mapa: um portão que o jogo nunca abre, uma cerca, entulho.",
    usage: [
        "/objeto  -- o que já foi tirado do mapa, numerado",
        "/objeto esconder <malha.cgf> <x> <y> <z>  -- tira o objeto (a malha e a posição que o World Builder mostra; a linha que ele copia em 'Copy selection as API calls' pode ser colada inteira)",
        "/objeto devolver <n>  -- põe de volta o objeto nº n",
        "/objeto sondar  -- o que há na sua frente, a até 8 m (o que o seu jogo vê): o nome, o guid e a posição de uma parede invisível, para tirá-la com 'esconder'",
        "/objeto portas [metros]  -- as portas que os mundos exportados tiraram do mapa: ande até perto delas e use; o seu jogo olha de novo cada uma a até tantos metros (40 por padrão) e o servidor tira de vez a parede invisível que ficou (só colisão); /objeto portas lista mostra quais já foram olhadas",
        "/objeto parede [metros]  -- encoste na parede invisível e use: o seu jogo procura ao redor (3 m, até 8) e o servidor tira de vez o que é só colisão (caixa de designer, volume de colisão, entidade bloqueadora); o que tem desenho não é tocado; /objeto devolver <n> desfaz",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, ...rest] = args;
        if (sub === undefined) {
            const lines = listObjects();
            reply.lines(lines.length === 0 ? ["Nada foi tirado do mapa."] : lines);
            return;
        }
        if (sub === "esconder" && rest.length > 0) {
            reply.line(hideObject(rest.join(" "), "", player.nickname).message);
            return;
        }
        if (sub === "devolver" && rest.length === 1 && /^\d+$/.test(rest[0] ?? "")) {
            reply.line(restoreObject(Number(rest[0]), player.nickname).message);
            return;
        }
        if (sub === "sondar" || sub === "olhar") {
            void probeAhead(player, yawOf(player.rotation)).then((lines) => {
                lines.forEach((line) => console.log(`objeto: ${player.nickname} sondou: ${line}`));
                reply.lines(lines);
            });
            return;
        }
        if (sub === "portas") {
            if (rest[0] === "lista") {
                reply.lines(listSites());
                return;
            }
            const metres = rest[0] === undefined ? 40 : Number(rest[0].replace(",", "."));
            if (!Number.isFinite(metres) || metres <= 0 || metres > 200) {
                usage();
                return;
            }
            void lookAround(player, metres)
                .then((lines) => reply.lines(lines))
                .catch((error: unknown) => reply.line(`Não consegui olhar as portas: ${error instanceof Error ? error.message : String(error)}`));
            return;
        }
        if (sub === "parede") {
            const metres = rest[0] === undefined ? 3 : Number(rest[0].replace(",", "."));
            if (!Number.isFinite(metres) || metres <= 0) {
                usage();
                return;
            }
            void hideWallsAround(player, player.nickname, metres)
                .then((lines) => {
                    lines.forEach((line) => console.log(`objeto: ${player.nickname} procurou parede: ${line}`));
                    reply.lines(lines);
                })
                .catch((error: unknown) => reply.line(`Não consegui procurar a parede: ${error instanceof Error ? error.message : String(error)}`));
            return;
        }
        usage();
    },
};
