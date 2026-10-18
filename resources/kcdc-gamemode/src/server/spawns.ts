import { placeBack } from "./position.js";

/**
 * Where arriving players are put. Joiners with no saved place are drawn between the
 * places listed here; with none, everybody lands on the level's own start point (the castle).
 *
 * Coordinates are the level's own, the ones `/tp` reports. `yaw` is degrees
 * around Z. `weight` is a share of the draw, so 0 keeps a point in the list
 * but out of rotation. `tags` are for picking by faction, district or team.
 */
export interface SpawnPoint {
    name: string;
    position: Partial<Vector3>;
    yaw?: number;
    tags?: string[];
    weight?: number;
}

/**
 * Where a player with no saved place arrives: on the road the game itself brings Henry in by to the lands of Kuttenberg,
 * west of Suchdol (user, 2026-10-16: "o ponto de nascimento na estrada de chegada à terra de Kuttenberg, perto de Suchdol,
 * na esquerda: todo jogador que entrar a primeira vez nasce lá"). These are the level's own markers of that arrival (the
 * `prijezdNaSuchdol` quest, where the cart with Žižka and Katerina starts): where the cart's horses stand, the cart's
 * starting point and the first stop it makes, a few steps apart so that two newcomers do not stand in the same spot, all on
 * the road and looking down it toward Suchdol, which is some five hundred metres on.
 */
export const spawnPoints: SpawnPoint[] = [
    { name: "Estrada de chegada, a oeste de Suchdol", position: { x: 364.94, y: 3745.57, z: 131.35 }, yaw: -140, tags: ["chegada"] },
    { name: "Estrada de chegada, junto das carroças", position: { x: 359.7, y: 3744.2, z: 131.3 }, yaw: -140, tags: ["chegada"] },
    { name: "Estrada de chegada, onde a carroça pára", position: { x: 381.58, y: 3727.83, z: 131.45 }, yaw: -140, tags: ["chegada"] },
];

/** One point drawn by weight, restricted to `tag` when given. Null when nothing matches. */
export function pickSpawnPoint(tag?: string): SpawnPoint | null {
    const candidates = tag ? spawnPoints.filter((point) => point.tags?.includes(tag)) : spawnPoints;
    const total = candidates.reduce((sum, point) => sum + Math.max(0, point.weight ?? 1), 0);
    if (total <= 0) {
        return null;
    }

    let remaining = Math.random() * total;
    for (const point of candidates) {
        remaining -= Math.max(0, point.weight ?? 1);
        if (remaining <= 0) {
            return point;
        }
    }
    return candidates[candidates.length - 1] ?? null;
}

/** `playerSpawning`: a returning player is put back where they stood (`position.ts`); anybody else is given a start point. */
export function installSpawns(): void {
    Events.on("playerSpawning", (player) => {
        if (placeBack(player)) {
            return;
        }
        const point = pickSpawnPoint();
        if (point) {
            player.spawn(point.position, new Vector3(0, 0, point.yaw ?? 0));
            console.log(`spawns: ${player.nickname} chegou pela primeira vez: ${point.name}`);
        }
    });
}
