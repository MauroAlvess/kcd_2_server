import type { Command, CommandContext } from "../command.js";
import { compassDirection } from "../horses.js";

/** How many stations the list shows. */
const SHOWN = 8;

const NAME: Readonly<Record<string, string>> = { smithing: "forja", alchemy: "mesa de alquimia" };

/**
 * The smitheries and alchemy tables the level has, nearest first (user, 2026-10-18: "consegue colocar uma forja em Raborsch e
 * uma mesa de alquimia?"). The mod only lists them (`Crafting.stations`): the game's own stations are placed by the level and
 * none can be made, so the answer to "is there one near?" is here.
 */
export const oficinasCommand: Command = {
    name: "oficinas",
    summary: "(admin) As forjas e as mesas de alquimia do mapa mais perto de você.",
    usage: ["/oficinas  -- as oito mais perto, de qualquer tipo", "/oficinas forja  -- só as forjas", "/oficinas alquimia  -- só as mesas de alquimia"],

    run({ player, args, reply, usage }: CommandContext): void {
        const [which] = args;
        if (which !== undefined && which !== "forja" && which !== "alquimia") {
            usage();
            return;
        }
        const stations = Crafting.stations(which === "forja" ? "smithing" : which === "alquimia" ? "alchemy" : undefined);
        const here = player.position;
        const near = stations
            .map((station) => ({ station, distance: Math.hypot(station.position.x - here.x, station.position.y - here.y) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, SHOWN);
        if (near.length === 0) {
            reply.line("O mapa não tem estação desse tipo.");
            return;
        }
        reply.line(`As ${near.length} mais perto de você (o mapa tem ${stations.length}):`);
        for (const { station, distance } of near) {
            reply.line(`  ${NAME[station.kind] ?? station.kind}, a ${distance.toFixed(0)} m, a ${compassDirection(here, station.position)} (x ${station.position.x.toFixed(0)}, y ${station.position.y.toFixed(0)}; ${station.layer})`);
        }
    },
};
