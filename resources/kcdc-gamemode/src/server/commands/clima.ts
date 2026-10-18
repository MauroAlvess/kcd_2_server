import type { Command, CommandContext } from "../command.js";
import { describeWorld, scaleFor, WEATHER, weatherById, worldCycle } from "../world-cycle.js";

export const climaCommand: Command = {
    name: "clima",
    summary: "Mostra a hora, a parte do dia e o clima; troca o clima na hora ou para e solta o relógio.",
    usage: [
        "/clima  -- dia, hora, quanto falta para anoitecer ou amanhecer, e o clima",
        `/clima <${WEATHER.map((kind) => kind.id).join("|")}>  -- troca o clima agora (passa em cerca de 4 minutos)`,
        "/clima relogio parar  -- o relógio para na hora em que está",
        "/clima relogio seguir  -- volta aos 40 minutos de dia e 40 de noite",
    ],

    run({ args, reply, usage }: CommandContext): void {
        const [sub, arg] = args;
        if (sub === undefined) {
            reply.line(describeWorld());
            return;
        }

        if (sub === "relogio") {
            if (arg === "parar") {
                worldCycle.clockManaged = false;
                World.setTimeScale(0);
                reply.line("O relógio parou. /clima relogio seguir faz ele andar de novo.");
                return;
            }
            if (arg === "seguir") {
                worldCycle.clockManaged = true;
                World.setTimeScale(scaleFor(World.hour));
                reply.line("O relógio voltou a andar: 40 minutos de dia e 40 de noite.");
                return;
            }
            usage();
            return;
        }

        const kind = weatherById(sub);
        if (kind === null) {
            usage();
            return;
        }
        reply.line(worldCycle.force(kind) ? `O clima está virando: ${kind.label}.` : `O céu ainda está mudando; ${kind.label} começa assim que terminar.`);
    },
};
