import { AGGRESSION, aggressionLevel, banditCamps, banditSettings, setAggression } from "../bandits.js";
import type { Aggression } from "../bandits.js";
import type { Command, CommandContext } from "../command.js";

export const bandidosCommand: Command = {
    name: "bandidos",
    summary: "Mostra os acampamentos de bandidos, leva você até um deles ou repõe os bandidos e os baús.",
    usage: [
        "/bandidos  -- cada acampamento, quantos bandidos estão vivos e quantos baús ele tem",
        "/bandidos ir <n>  -- leva você até o acampamento n (cuidado: eles atacam)",
        "/bandidos repor  -- traz de volta os bandidos mortos e enche os baús agora",
        "/bandidos estado  -- o que cada bandido dos acampamentos a até 250 m de você está fazendo, e quem o roda (para achar os que ficam parados)",
        "/bandidos agressividade [baixa|media|alta]  -- o quanto os bandidos veem de longe, batem forte, quantos lutam de perto por vez e perseguem (sem argumento mostra a atual)",
        "/bandidos armadura [ligar|desligar]  -- todos os bandidos (não só os veteranos e os chefes) num conjunto de armadura que não é saque; vale para os que nascerem daqui em diante (os mortos que voltam, e todos no próximo início)",
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
                `(veem a ${now.aggroRadius} m, golpe vezes ${now.damageMultiplier}, ${now.front} lutam de perto por vez e os outros cercam, o alarme se ouve a ${now.earshotM} m, o acampamento persegue por ${now.alarmMs / 1000} s.) ${word === undefined ? "Troque com /bandidos agressividade baixa|media|alta." : "Vale já, e fica gravada para o próximo início."}`,
            ]);
            return;
        }

        // Every bandit in a set of armour (2026-11-02, `armourAll`): for when the veterans' and the chiefs' sets are seen on the players' games.
        if (sub === "armadura") {
            if (arg === "ligar" || arg === "desligar") {
                banditSettings.armourAll = arg === "ligar";
            } else if (arg !== undefined) {
                usage();
                return;
            }
            reply.line(
                banditSettings.armourAll
                    ? "Todos os bandidos nascem de armadura (gambesão, coifa e capuz; os arqueiros, mais leves): os que voltarem daqui em diante, e todos no próximo início."
                    : "Só os veteranos e os chefes nascem de armadura; os outros, de roupa: os que voltarem daqui em diante, e todos no próximo início.",
            );
            return;
        }

        if (sub === "estado") {
            const lines = banditCamps.inspect(player.position);
            reply.lines(lines.length === 0 ? ["Nenhum acampamento de bandidos a até 250 m de você."] : lines);
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
