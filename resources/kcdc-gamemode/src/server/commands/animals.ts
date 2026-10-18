import type { Command } from "../command.js";
import { animalPopulation, animalPopulationSettings } from "../animals.js";
import { hasPose, NO_POSE_YET, distanceBetween } from "../place.js";
import { petsEnabled, setPetsEnabled, villagePets } from "../village-pets.js";

export const animalsCommand: Command = {
    name: "animals",
    summary: "Runs animal populations at the level's spawnpoints.",
    usage: ["/animals list", "/animals start <spawnpointGuid>", "/animals stop", "/animals status", "/animals max <0-2000>", "/animals vila [ligar|desligar]  -- os cães e gatos das vilas: quantos há e onde, ou ligar e desligar"],
    run({ player, args, reply, usage }): void {
        if (args[0] === "status") {
            const { bodies, sites } = animalPopulation.standing();
            reply.line(`${bodies} animais no mundo agora, no máximo ${animalPopulationSettings.maxAnimals} ao mesmo tempo; ${sites} pontos de nascimento (herdades). Por espécie, as vagas: ${[...animalPopulation.census()].map(([name, count]) => `${name} ${count}`).join(", ")}.`);
            return;
        }
        if (args[0] === "max") {
            const wanted = Number(args[1]);
            if (!Number.isInteger(wanted) || wanted < 0 || wanted > 2000) {
                usage();
                return;
            }
            animalPopulationSettings.maxAnimals = wanted;
            reply.line(`No máximo ${wanted} animais ao mesmo tempo, até o servidor reiniciar (o fixo está em src/server/animals.ts). Os que já existem não somem de uma vez: deixam de voltar quando morrem ou quando o jogador se afasta.`);
            return;
        }
        if (args[0] === "vila") {
            if (args[1] === "ligar" || args[1] === "desligar") {
                setPetsEnabled(args[1] === "ligar");
                reply.line(args[1] === "ligar" ? "Cães e gatos das vilas ligados: voltam no próximo início do servidor." : "Cães e gatos das vilas desligados: saíram agora e não voltam até ligar de novo.");
                return;
            }
            if (villagePets === null) {
                reply.line("Os animais das vilas ainda não foram montados.");
                return;
            }
            reply.lines([`Animais das vilas ${petsEnabled() ? "ligados" : "desligados"}: ${villagePets.count("dog")} cão(ães) e ${villagePets.count("cat")} gato(s).`, ...villagePets.describe()]);
            return;
        }
        if (args[0] === "stop") {
            animalPopulation.clear();
            reply.line("Removed the sample's animal populations.");
            return;
        }
        if (!hasPose(player)) {
            reply.line(NO_POSE_YET);
            return;
        }
        const points = Npc.animalSpawnpoints();
        if (!args[0] || args[0] === "list") {
            const nearby = points.sort((a, b) => distanceBetween(a.position, player.position) - distanceBetween(b.position, player.position)).slice(0, 10);
            for (const point of nearby) reply.line(`${point.guid}: ${point.actorClass}, ${point.count} authored animals, ${Math.round(distanceBetween(point.position, player.position))} m away.`);
            return;
        }
        if (args[0] === "start") {
            const point = points.find(candidate => candidate.guid === args[1]);
            if (!point) {
                reply.line("Choose a spawnpoint GUID from /animals list.");
                return;
            }
            if (point.count === 0) {
                reply.line("This spawnpoint has no authored animals. Choose a point with a nonzero count.");
                return;
            }
            if (!Navigation.ready) {
                reply.line("Animal roaming needs the server's navigation mesh.");
                return;
            }
            reply.line(animalPopulation.add(point, player.virtualWorld)
                ? `Population enabled. Animals spawn while players are 60–350 m away; deaths respawn after ${animalPopulationSettings.respawnMs / 60_000}–${(animalPopulationSettings.respawnMs + animalPopulationSettings.respawnJitterMs) / 60_000} minutes, once players are over 60 m away.`
                : "This spawnpoint is already enabled.");
            return;
        }
        usage();
    },
};
