import type { Command, CommandContext } from "../command.js";
import { allSpots, distanceTo, occupantOf, setTuning, standUp, tuningFields, tuningLines } from "../furniture.js";

/** How many spots the list shows. */
const SHOWN = 10;

/**
 * `/mobilia` (admin): the chairs and beds that World Builder exports placed (`furniture.ts`), nearest first, and the numbers that
 * say where the body goes on them. The game's sitting and lying animations are made for its own seats, so the first sitter may
 * hang a hand's breadth off the seat or lie with the head at the wrong end: `/mobilia ajustar cadeira-frente -0.35` and the like
 * move it, and the numbers are kept.
 */
export const mobiliaCommand: Command = {
    name: "mobilia",
    summary: "(admin) As cadeiras e camas do World Builder que aceitam o jogador, e o ajuste de onde o corpo fica nelas.",
    usage: [
        "/mobilia  -- as mais perto de você e os números do ajuste",
        `/mobilia ajustar <campo> <valor>  -- muda um número (${tuningFields().join(", ")}); metros, ou graus no giro`,
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, field, value] = args;
        if (sub === "ajustar" && field !== undefined && value !== undefined) {
            reply.line(setTuning(field, Number(value.replace(",", "."))));
            return;
        }
        if (sub !== undefined) {
            usage();
            return;
        }
        const near = allSpots()
            .map((spot) => ({ spot, distance: distanceTo(spot, player.position) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, SHOWN);
        if (near.length === 0) {
            reply.line("Nenhuma cadeira ou cama das exportações do World Builder.");
        } else {
            reply.line(`${allSpots().length} lugar(es) no total; os ${near.length} mais perto de você:`);
            for (const { spot, distance } of near) {
                const holder = occupantOf(spot.id);
                reply.line(`  ${spot.kind}, a ${distance.toFixed(1)} m (x ${spot.x.toFixed(1)}, y ${spot.y.toFixed(1)}), giro ${((spot.yaw * 180) / Math.PI).toFixed(0)}°${holder === null ? "" : `, ocupado (#${holder})`}`);
            }
        }
        reply.line(`Ajuste: ${tuningLines().join("; ")}.`);
    },
};

/** `/levantar` (everybody): up from a seat or a bed, if the keys did not do it. */
export const levantarCommand: Command = {
    name: "levantar",
    summary: "Levanta da cadeira ou da cama.",
    usage: ["/levantar"],

    run({ player, reply }: CommandContext): void {
        if (!standUp(player, "comando")) {
            reply.line("Você não está sentado nem deitado em móvel nenhum.");
        }
    },
};
