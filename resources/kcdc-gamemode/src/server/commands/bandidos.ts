import { AGGRESSION, aggressionLevel, banditCamps, setAggression } from "../bandits.js";
import type { Aggression } from "../bandits.js";
import type { Command, CommandContext } from "../command.js";

export const bandidosCommand: Command = {
    name: "bandidos",
    summary: "Mostra os acampamentos de bandidos, leva você até um deles ou repõe os bandidos e os baús.",
    usage: [
        "/bandidos  -- cada acampamento, quantos bandidos estão vivos e quantos baús ele tem",
        "/bandidos ir <n>  -- leva você até o acampamento n (cuidado: eles atacam)",
        "/bandidos repor  -- traz de volta os bandidos mortos e enche os baús agora",
        "/bandidos agressividade [baixa|media|alta]  -- o quanto os bandidos veem de longe, batem forte e perseguem (sem argumento mostra a atual)",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, arg] = args;
        if (sub === undefined) {
            const lines = banditCamps.describe();
            reply.lines(lines.length === 0 ? ["Nenhum acampamento de bandidos (ainda estão aparecendo, se o servidor acabou de subir)."] : lines);
            return;
        }

        if (sub === "ir") {
            const camp = banditCamps.camps.find((candidate) => candidate.id === Number(arg));
            if (camp === undefined) {
                usage();
                return;
            }
            // A little outside the camp, so the admin arrives in sight of it rather than in the middle of it.
            const sent = player.teleport({ x: camp.center.x + 40, y: camp.center.y, z: camp.center.z + 2 }, camp.name);
            reply.line(sent ? `Indo para ${camp.name}.` : "Não consegui pedir o teletransporte agora.");
            return;
        }

        if (sub === "agressividade") {
            const word = arg === undefined ? undefined : arg.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
            if (word !== undefined) {
                if (!(word in AGGRESSION)) {
                    usage();
                    return;
                }
                setAggression(word as Aggression);
            }
            const now = AGGRESSION[aggressionLevel()];
            reply.lines([
                `Agressividade ${now.label}: ${now.about}.`,
                `(veem a ${now.aggroRadius} m, golpe vezes ${now.damageMultiplier}, o acampamento persegue por ${now.alarmMs / 1000} s.) ${word === undefined ? "Troque com /bandidos agressividade baixa|media|alta." : "Vale já, e fica gravada para o próximo início."}`,
            ]);
            return;
        }

        if (sub === "repor") {
            const { spawned, chests } = banditCamps.restockNow();
            reply.line(`${spawned} bandido(s) de volta e ${chests} baú(s) abastecido(s).`);
            return;
        }

        usage();
    },
};
