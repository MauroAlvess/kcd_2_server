/**
 * The plants a player can pick grow back sooner than the game would have them.
 *
 * The level decides where every herb grows; a script cannot add one. What it can choose is how long a picked plant
 * takes to come back (`Gathering`). The framework's default is a fifth of the game's own time, 40 to 120 real minutes
 * at this server's clock; here it is 4.5 to 12 game hours, which at the 40-and-40-minute day (`world-cycle.ts`, 18 game
 * seconds to the real second on average) is about 15 to 40 real minutes, a little longer at night and shorter by day.
 *
 * The setting lives in the server's memory, so it is made again at every start. `/herbs` still changes it until the
 * next one.
 */

/** Game hours a picked plant takes to grow back: the shortest and the longest. */
export const HERB_REGROW_HOURS = { min: 4.5, max: 12 } as const;

export function installFlora(): void {
    const set = Gathering.setRespawnTime(HERB_REGROW_HOURS.min, HERB_REGROW_HOURS.max);
    console.log(
        set
            ? `flora: as ervas colhidas voltam em ${HERB_REGROW_HOURS.min} a ${HERB_REGROW_HOURS.max} horas de jogo (uns 15 a 40 minutos reais)`
            : "flora: o servidor recusou o tempo de rebrota das ervas; ficam os padrões",
    );
}
