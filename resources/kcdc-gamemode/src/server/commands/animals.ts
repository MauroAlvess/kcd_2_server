import type { Command } from "../command.js";
import { animalPopulation, animalPopulationSettings } from "../animals.js";
import { carcassSettings } from "../carcass.js";
import { hasPose, NO_POSE_YET, distanceBetween } from "../place.js";

export const animalsCommand: Command = {
    name: "animals",
    summary: "Runs animal populations at the level's spawnpoints.",
    usage: ["/animals list", "/animals start <spawnpointGuid>", "/animals stop", "/animals status", "/animals max <0-2000>", "/animals carne [0.1-1]  -- quanto da carne de um animal abatido o caçador fica (metade, no mínimo uma de cada)"],
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
        if (args[0] === "carne") {
            if (args[1] === undefined) {
                reply.line(`O caçador fica com ${Math.round(carcassSettings.meatShare * 100)}% da carne de cada animal abatido (no mínimo uma de cada). Troque com /animals carne <0.1 a 1>.`);
                return;
            }
            const share = Number(args[1].replace(",", "."));
            if (!Number.isFinite(share) || share < 0.1 || share > 1) {
                usage();
                return;
            }
            carcassSettings.meatShare = share;
            reply.line(`O caçador fica com ${Math.round(share * 100)}% da carne de cada animal abatido, até o servidor reiniciar (o fixo está em src/server/carcass.ts). Vale para os próximos abates.`);
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
