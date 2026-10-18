/**
 * Dirt: the game's own, left to the game. A body gets dirty by itself as it moves (the clothes take dust and mud, faster the
 * faster they go: `FullClothDirtyingOnFullSpeed` among the game's rpg params) and stays so until it is washed: a river or a
 * spring (the water's `washFace_player` and `washSoap_player`), a basin, a tub, the baths (`use_washGuest`). The number the
 * game keeps is `dirtiness`, a derived stat: a server can read it and cannot set it, and the character kept between sessions
 * (`character-state.ts`) has no place for it either, so a player who comes back starts clean.
 *
 * What this module does is stay out of the game's way and say what it sees:
 *  - `quest_noDirt` (`cds=0,drt=0`, a constant) freezes the dirtiness at zero. The game's quests put it on for a scene (a
 *    wedding, a dialogue) and take it off after; if it is ever left on a body that body never gets dirty. It is taken off
 *    wherever it is found: when the client reports it, and on every beat after.
 *  - the player is told, once, when the body gets dirty (the game's own thresholds: 0.3, 0.6 and 0.9 of "relative
 *    dirtiness") and where to wash, and told again after a wash has taken it below the first one.
 *  - `/sujeira` says what the game reads, which is also how to tell whether any of this works: nothing about it could be seen
 *    running when it was written.
 */

export const DIRT_TICK_MS = 20_000;

/** The game's own thresholds of relative dirtiness (the script params `rpg_drt_low`, `_medium` and `_high`). */
export const DIRT_LOW = 0.3;
export const DIRT_MEDIUM = 0.6;
export const DIRT_HIGH = 0.9;

/** Effects that stop a body getting dirty. The game's quests put them on for a scene and take them off after. */
export const DIRT_BLOCKERS: readonly string[] = ["quest_noDirt"];

/** An effect asked to come off is not asked again sooner than this: the client takes its time, and the game may put it back at once. */
export const LIFT_GAP_MS = 5_000;

/** The least that counts as the first sign of dirt, for the log. */
const FIRST_SIGN = 0.02;

/** 0 clean, 1 a little dirty, 2 dirty, 3 filthy. */
export type DirtLevel = 0 | 1 | 2 | 3;

export function dirtLevelOf(value: number): DirtLevel {
    if (!Number.isFinite(value) || value < DIRT_LOW) {
        return 0;
    }
    return value < DIRT_MEDIUM ? 1 : value < DIRT_HIGH ? 2 : 3;
}

const LEVEL_WORDS: readonly string[] = ["limpo", "um pouco de sujeira", "sujo", "imundo"];

/** What the watch needs of a player: what a player object offers. */
export interface DirtBody {
    readonly id: number;
    readonly nickname: string;
    readonly ready: boolean;
    readonly alive: boolean;
    hasBuff(buff: string): boolean;
    removeBuff(buff: string): boolean;
    getDerivedStat(stat: "dirtiness" | "smell" | "bloodiness"): number;
}

/** Where to wash, which the game offers the player as it does everybody. */
export const WHERE_TO_WASH = "num rio, numa fonte, numa bacia ou nos banhos (com sabão fica mais limpo)";

const TOLD: readonly (string | null)[] = [
    null,
    null,
    `Você está sujo: a roupa e a pele pedem água. Lave-se ${WHERE_TO_WASH}.`,
    `Você está imundo e o cheiro já incomoda quem passa. Lave-se ${WHERE_TO_WASH}.`,
];

interface Seen {
    /** The level the last beat read. */
    level: DirtLevel;
    /** The highest level the player was told about since they last were clean. */
    told: DirtLevel;
    /** Whether the first sign of dirt was written to the log. */
    sawDirt: boolean;
    /** The effects found on this body and asked to come off, so the log says it once. */
    lifted: Set<string>;
}

export class DirtWatch<P extends DirtBody = DirtBody> {
    private readonly seen = new Map<number, Seen>();
    private readonly asked = new Map<string, number>();

    constructor(
        private readonly say: (player: P, text: string) => void,
        private readonly log: (line: string) => void,
        private readonly now: () => number = () => Date.now(),
    ) {}

    private stateOf(player: P): Seen {
        let state = this.seen.get(player.id);
        if (state === undefined) {
            state = { level: 0, told: 0, sawDirt: false, lifted: new Set() };
            this.seen.set(player.id, state);
        }
        return state;
    }

    /** Asks the player's game to take off an effect that stops the dirt, unless it was asked a moment ago. */
    lift(player: P, buff: string): boolean {
        if (!DIRT_BLOCKERS.includes(buff)) {
            return false;
        }
        const key = `${player.id}:${buff}`;
        const at = this.now();
        const before = this.asked.get(key);
        if (before !== undefined && at - before < LIFT_GAP_MS) {
            return false;
        }
        this.asked.set(key, at);
        const state = this.stateOf(player);
        if (!state.lifted.has(buff)) {
            state.lifted.add(buff);
            this.log(`dirt: ${player.nickname} tinha ${buff}, que não deixa o corpo sujar: pedi para tirar`);
        }
        return player.removeBuff(buff);
    }

    /** One beat over the players: the blockers off, and what the body reads said where it needs to be. */
    tick(players: readonly P[]): void {
        for (const player of players) {
            if (!player.ready || !player.alive) {
                continue;
            }
            for (const buff of DIRT_BLOCKERS) {
                if (player.hasBuff(buff)) {
                    this.lift(player, buff);
                }
            }

            const value = player.getDerivedStat("dirtiness");
            const state = this.stateOf(player);
            if (!state.sawDirt && value >= FIRST_SIGN) {
                state.sawDirt = true;
                this.log(`dirt: ${player.nickname} começou a ficar sujo (${value.toFixed(2)}): o jogo está contando a sujeira`);
            }
            const level = dirtLevelOf(value);
            if (level > state.told) {
                const text = TOLD[level];
                if (text !== null && text !== undefined) {
                    this.say(player, text);
                }
                state.told = level;
            } else if (level === 0) {
                // A wash brought it down: the next time it gets dirty, they are told again.
                state.told = 0;
            }
            state.level = level;
        }
    }

    forget(id: number): void {
        this.seen.delete(id);
        for (const key of [...this.asked.keys()]) {
            if (key.startsWith(`${id}:`)) {
                this.asked.delete(key);
            }
        }
    }
}

const comma = (value: number): string => (Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",");

/** What `/sujeira` answers: the three readings, in the game's own units, and what would keep the body clean. */
export function describeDirt(player: DirtBody): string {
    const level = dirtLevelOf(player.getDerivedStat("dirtiness"));
    const blocked = DIRT_BLOCKERS.filter((buff) => player.hasBuff(buff));
    const reading = `Sujeira ${comma(player.getDerivedStat("dirtiness"))} (${LEVEL_WORDS[level]}), cheiro ${comma(player.getDerivedStat("smell"))}, sangue ${comma(player.getDerivedStat("bloodiness"))}.`;
    const scale = `Na escala do jogo: ${comma(DIRT_LOW)} é um pouco, ${comma(DIRT_MEDIUM)} é sujo, ${comma(DIRT_HIGH)} é imundo.`;
    const tail = blocked.length > 0 ? ` Efeito ligado que impede de sujar: ${blocked.join(", ")}.` : "";
    return `${reading} ${scale} Lave-se ${WHERE_TO_WASH}.${tail}`;
}

export const dirtWatch = new DirtWatch<Player>(
    (player, text) => Chat.sendToPlayer(player, text),
    (line) => console.log(line),
);

const RESOURCE = "kcdc-gamemode";

export function installDirt(): void {
    // The game says what a body already carries as it first reports, and what it takes on after: `quest_noDirt` is lifted both ways.
    Events.on("playerBuffAdded", (player, buff) => {
        dirtWatch.lift(player, buff);
    });
    Events.on("playerDisconnect", (player) => {
        dirtWatch.forget(player.id);
    });
    const timer = setInterval(() => dirtWatch.tick(Player.all()), DIRT_TICK_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
    console.log(`dirt: a sujeira é a do jogo; o que a impede (${DIRT_BLOCKERS.join(", ")}) é tirado, e quem fica sujo é avisado`);
}
