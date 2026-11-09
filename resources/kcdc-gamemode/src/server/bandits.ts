/**
 * The bandit camps of the level, peopled again: hard to beat and poor to rob.
 *
 * The camps are the level's own. `Npc.placements()` lists every human the level places, with the layer it sits in,
 * and the ones whose layer or name says bandit ("bandit", Czech "lapka", "zbojník") are grouped by distance into
 * camps: Grunta, Vrchlicko, Kopec Vysoká, Rabštejnsko, Mezholezsko and the hideouts the quests use. Each camp gets a
 * few bandits, one of them an archer where there are three or more.
 *
 * Hard: more health than an ordinary man, a heavier hand (their blows on players are multiplied in `playerHit`), they
 * see you from further off and the whole camp joins in when one of them is hit. Poor: what a bandit wears and carries
 * is plain -- rags, a club or a work axe, a few coins, a crust -- because an NPC's clothes and weapon are its loot,
 * and good gear here would make robbing bandits a better trade than the trades the guilds play. Dead bandits come back
 * after a while, when nobody is near.
 *
 * The chests at each camp are filled with what the guilds work with (iron and steel, herbs, arrows, hides, raw meat)
 * and now and then a piece of clothing, and filled again every three hours while nobody is around (every hour before 2026-10-25).
 *
 * Harder still since 2026-10-21 (user: "colocar nos NPC de bandidos armaduras melhores em alguns e deixar eles mais hard ainda; se o jogador
 * se afastar eles começam a disparar com besta e tomam poção também, assim evitar jogador ficar abusando"): one in three of a camp is a
 * veteran, in a soldier's battered kit with more health and a heavier hand; every one who fights hand to hand carries a bow too and takes it
 * up when his man runs off (the game lets a server's NPC shoot a bow, not a crossbow), and drinks a draught when badly hurt. The veteran's
 * armour and the second bow are not loot: they are taken off the body when he falls, so robbing bandits stays a poor trade.
 *
 * More camps and the roads since 2026-10-24 (user: "existe acampamento de inimigos sem bandidos"; "coloque alguns bandidos pelas estradas já que o
 * sistema de emboscada não funciona"): the level's other camps of enemies, which had tents and fires and nobody at them because the quests that
 * people them do not run here (the poachers' camps of Suchdol and Vrchlicko, the treasure hunters' camp of Lorec, the deserters' barn at Přítoky),
 * are bandit camps now; and gangs of three or four stand at some places of the roads (`addRoads`: the level's own road events and caravan starts,
 * `data/road-posts.json`), away from every village and camp.
 *
 * A fight is no rush of everybody at once since 2026-10-30 (user: "fui matar bandido, eles correram junto e fizeram tudo junto, sem mecânica, sem sistema de inteligência,
 * cerco nem nada; além de que estão muito difíceis de matar e quase impossível matar só um"): only the men near whoever is already fighting hear the alarm, and each
 * answers after a moment (a reaction of his own, and the shout's travel); of the men after one player only `frontMax` fight hand to hand at a time (more when the player has
 * company), the archers shoot, and the rest go round the player in a ring (`circle`), waiting their turn: a man badly hurt falls back into the ring and another steps up, and
 * one the player comes close to defends himself. They are also easier to bring down alone: less health, lighter blows, a draught that heals less.
 */

import { dressingOrder, fitKit, kitProblems } from "./equipment-rules.js";
import { coins, giveMoney, moneyOf, takeMoney } from "./money.js";
import { speak } from "./npc-speech.js";
import { propertyOfStash } from "./properties.js";
import { ensureDir, read, write } from "./store.js";

declare const __dirname: string | undefined;

const RESOURCE = "kcdc-gamemode";

export const banditSettings = {
    // The user's call (2026-10-16: "encher com bem mais bandidos"): the level's camps hold up to eight, and the script adds
    // hideouts of its own in the wild, away from every place where the level puts ordinary people.
    maxPerCamp: 8,
    minPerCamp: 5,
    // 2026-10-17: more hideouts along the roads (was 14), the user wanting travellers to meet bandits more often; and the same day
    // "o spawn tá muito forte" with bandits that stood still (dormant, for want of room in the game that was to run them):
    // sixteen hideouts of three to five.
    wildCamps: 16,
    wildMinPerCamp: 3,
    wildMaxPerCamp: 5,
    /** Between two hideouts of the script's. */
    wildSeparationM: 550,
    /** From the level's own camps. */
    wildFromCampsM: 450,
    /** From any place the level puts ordinary people (villages, farms, mills, guard posts). */
    wildFromPeopleM: 300,
    /** How far from its centre a hideout's bandits stand. */
    wildSpotRadius: 7,
    // The roads (2026-10-24): small gangs at the level's road events, far from villages and camps, and from one another.
    roadPosts: 10,
    roadMinPerPost: 3,
    roadMaxPerPost: 4,
    // On the level's own data these give ten posts (the limit); at 170, 380 and 650 only five were left (measured 2026-10-24).
    roadSeparationM: 550,
    roadFromCampsM: 330,
    roadFromPeopleM: 140,
    roadSpotRadius: 5,
    clusterRadius: 45,
    health: 140,
    damageMultiplier: 1.4,
    aggroRadius: 24,
    leashRadius: 60,
    homeRadius: 6,
    activationRadius: 200,
    corpseMs: 10 * 60_000,
    respawnMs: 30 * 60_000,
    /**
     * The gangs of the roads (`Estrada N`) come back much later than a camp's men (user, 2026-10-25: "os bandidos de estrada, o respawn tá muito
     * rápido, devia ser umas 2h a 4h"): each dead man waits a time of his own between these two, counted from his death.
     */
    roadRespawnMs: [2 * 60 * 60_000, 4 * 60 * 60_000] as readonly [number, number],
    respawnClearRadius: 90,
    corpseClearRadius: 50,
    alarmMs: 45_000,
    retryMs: 4_000,
    /**
     * The cerco (2026-10-30). The alarm is heard by the men within `earshotM` of one already in the fight, each after his own reaction (`reactMs`) and the time the shout takes
     * to reach him (`alarmSpeedMps`); at most `frontMax` of a camp fight one player hand to hand, one more for every other player within `companyM` of that one (up to
     * `frontMore`), and the rest go round the player at `ringM`, a man to a spot, sent again when the spot has moved `ringMovedM`, no oftener than `ringEveryMs`. A man in the
     * ring whom the player comes within `defendM` of fights; one below `backOffBelow` of his health gives his place to another; one struck in the last `hurtStaysMs` fights.
     */
    earshotM: 30,
    alarmSpeedMps: 8,
    reactMs: [300, 1_800] as readonly [number, number],
    // One at a time since 2026-11-02 (the presets say the same; this is the start's, before one is read).
    frontMax: 1,
    frontMore: 2,
    companyM: 12,
    // 9 m until 2026-11-02 ("o sistema de combate dos bandidos deve fazer eles serem reais: rodear e alternar no ataque, nunca entrando um dentro do outro para atacar"): the ring
    // closes round the player, near enough to be a ring, its spots apart enough that no two men stand in each other.
    ringM: 5.5,
    ringArriveM: 2.2,
    ringEveryMs: 2_000,
    ringMovedM: 3,
    // 4.5 m until 2026-11-02 ("ao chegar perto eles correm juntos para cima de você, entrando um no outro"): the ring's men, crossing near the player on the way to their spots, all
    // became the front line at once and ran into each other at him. Now only one he is right beside fights back.
    defendM: 2.5,
    /**
     * The pace the server sends a bandit at whenever it sends him (a chase, a run back, a horse to steal, a retreat): a jog since 2026-11-02 (user: "os NPCs bandidos correm muito
     * rápido"): the game's NPC run outpaces a player. The game's own fight still closes in at its own pace.
     */
    chaseSpeed: "jog" as "walk" | "jog" | "run",
    /** How near the player a ring man's way to his spot may pass: farther round than this, he goes by a spot on the ring between (`circle`). */
    ringClearM: 3.5,
    /**
     * Turns (2026-11-02): a man at the player hand to hand gives his place to another of the ring after a turn of his own (between the two), and walks back to the ring; for
     * `yieldKeepMs` after it the player coming close does not make him fight again at once (he falls back, the next one comes on). The ring is kept to the flanks and the back of the
     * man at him (`RING_OFFSETS_DEG`), so that no spot is ever where he is.
     */
    // 6-10 s until 2026-11-04 (user: "na hora da luta eles estão alternando muito"): the men changed places at the player too often.
    turnMs: [15_000, 25_000] as readonly [number, number],
    yieldKeepMs: 4_000,
    /**
     * A man who steps in out of his turn -- the player right at him (`defendM`), or a blow -- stays in the line `commitMs` after the last of it, instead of walking back to the ring
     * the moment the player is a step farther or the blow is five seconds old (2026-11-04: "o que deixa de luta"). A blow after he gave up his turn brings him back; one taken during
     * his turn does not keep him (that is what `yieldKeepMs` is for).
     */
    commitMs: 6_000,
    /**
     * The ring is not a row of statues (2026-11-04, user: "ficando estáticos"): a man standing at his spot walks to the next step of his own every `stalkMs` (between the two, his own):
     * `stalkDeg` round the ring and `stalkInM` nearer the player, back to his spot, the other way round and in, and back again, and turns to the player on arriving. Arrived within
     * `stalkArriveM` of a step. Steps so small that two neighbours of the ring (30 degrees apart at the least) never meet.
     */
    stalkMs: [3_500, 6_000] as readonly [number, number],
    stalkDeg: 8,
    stalkInM: 1,
    stalkArriveM: 0.6,
    /** A fallen man's purse goes to the players who fought him (struck him in the last `shareWithinMs`, and within `shareM` of the body), in equal parts (`sharePurse`). */
    shareWithinMs: 90_000,
    shareM: 60,
    /** A man is run by the game of a player who fights him this close (`runByFighter`) when the game that runs him is farther than that player by `fightRunGapM`. */
    fighterM: 4,
    backOffBelow: 0.45,
    hurtStaysMs: 5_000,
    // A bandit nobody's game runs is dormant: no step, no blow (user, 2026-10-18: "bandidos ... precisam poder se movimentar e o
    // combate deve ativar assim que se aproxima"). Within this of a player he is pinned to that player's game, which runs him
    // although the games near them already run others; out of everybody's reach he is let go.
    pinM: 140,
    unpinM: 190,
    // The game that runs a bandit judges the blows on him, and the server keeps whoever runs him until he is 160 m away (2026-10-25, user: "os bandidos de
    // estrada desviam de todos os golpes e não morrem"; from the log, half the blows against the roads' gangs were struck at a man run by somebody else's game,
    // up to sixty metres off, and none of the camps' and hideouts'). A man whose runner is farther than `runnerFarM` from him is given to whoever strikes him,
    // when that one is within `runnerNearM`; and a man whose runner is past `runnerLostM` is given to a player `runnerGapM` nearer than that runner.
    runnerFarM: 20,
    runnerNearM: 15,
    runnerLostM: 60,
    runnerGapM: 25,
    // A man after a player is run by that player's game (2026-11-01, players: "alguns NPCs ficam imortais, os bandidos e os assaltantes da estrada"): of 7,501 notes of the day, 310
    // had the man run by another player's game 20 to 60 m off while his target fought him up close (Vaelgor at 5 m from a man Aspen's game ran from 47 m), and blows judged there
    // missed. A man within `fightRunM` of his target, whose runner is farther from him than `fightRunNearM` and than the target by `fightRunGapM`, is given to the target.
    fightRunM: 30,
    fightRunNearM: 10,
    fightRunGapM: 6,
    /** A man given to a player's game is not given to the same game again before this (2026-11-02): `simulator` may lag the handoff, and each look gave him again. */
    pinAgainMs: 3_000,
    /**
     * The voices of a fight (2026-11-01, user: "frases que eles falam ao lutar; vamos deixar os bandidos dando grito e sendo inteligentes nos combates"). A man is quiet for
     * `BARK_EVERY_MS` after a line; the camp's men, `campBarkGapMs` after any of them, for the lines that are not an answer to something (a sight, a blow, a death and the chief
     * are heard at once); a man who fights hand to hand taunts now and then (`tauntMs`). The game's own voice for the line is played at him on the games within `shoutM`.
     */
    campBarkGapMs: 2_500,
    tauntMs: [9_000, 16_000] as readonly [number, number],
    shoutM: 45,
    /**
     * Their tactics (2026-11-01): an archer whose man comes within `archerBackM` runs back a few steps and shoots again (no oftener than `archerBackEveryMs`); a man who sees
     * another player near him (`weakM`) brought to `weakShare` of his health goes for him, looked at every `weakEveryMs`; and a man left with `retreatBelow` of his health and no
     * draught may fall back for `retreatMs` (one in `retreatChance`, once in his life) and come again.
     */
    archerBackM: 5,
    archerBackEveryMs: 6_000,
    /**
     * Shooters apart (2026-11-04, user: "os bandidos na hora de puxar flechas estão ficando um dentro do outro"): the game's bow attack stops within 18 m of the target wherever the
     * man is, and two of a camp who came the same way stopped in each other. A shooter standing within `shooterGapM` of another man of the fight steps `shooterStepM` to the side
     * (across the line to his target, away from the other; back, when both sides are taken) and shoots again from there; of two shooters only the later in the camp's line moves.
     * Not again within `shooterEveryMs`.
     */
    shooterGapM: 2.2,
    shooterStepM: 3.5,
    shooterEveryMs: 4_000,
    /** Only a shooter who has stood where he is this long is moved: one passing another on his way is not. */
    shooterStillMs: 1_500,
    weakShare: 0.3,
    weakM: 8,
    weakEveryMs: 6_000,
    /**
     * Turning to the players near (2026-11-02, user: "eles devem focar os jogadores próximos, assim evitando de ficarem focados apenas em um jogador enquanto outros podem ficar matando
     * eles"): a man struck in the last `strikerMs` by a player within `strikerM` of him who is not his man turns to that player; and of the men after one player, one goes for another
     * player within `spreadM` of him who has two fewer of the camp on him. A man changes his man no oftener than every `switchEveryMs`.
     */
    strikerMs: 3_000,
    strikerM: 6,
    spreadM: 12,
    switchEveryMs: 5_000,
    retreatBelow: 0.25,
    retreatChance: 0.5,
    retreatMs: 6_000,
    /**
     * The chief (2026-11-01, user: "em todos os acampamentos de bandidos vamos colocar um bandido chefe, esse que é bem equipado e um mestre na esgrima da arma que ele usar"):
     * the first man of every camp and hideout (not of a gang of the roads), in the soul of one of the game's best bandits (`CHIEF_SOULS`, the game's combat level 1.0, where the
     * camps' own are 0.3 to 0.7), in good armour and with a good weapon, neither of them loot. When he falls, the men of his camp who are badly hurt (`chiefFleeBelow`) run, and
     * the rest are enraged for `rageMs`: their blows weigh `rageDamage` more.
     */
    chiefHealth: 320,
    chiefDamage: 1.35,
    chiefPotions: 4,
    chiefFleeBelow: 0.4,
    rageMs: 60_000,
    rageDamage: 1.25,
    /**
     * The players' horses (2026-11-01, user: "bandidos roubarem cavalos e lutarem neles ou até tentarem matar os cavalos dos jogadores"). No server's NPC can sit a saddle (a rider is
     * a player, `Horse.rider`), so no bandit rides; but a man of the front line within `spookM` of a rider may rear the horse and throw him off (one in `spookChance` at a look every
     * `spookLookMs`, no oftener than `spookEveryMs` for the same rider); a bandit's blow on a rider wounds the horse too (`horseHitShare` of it, at least `horseHitMin`); and a
     * riderless horse of a player who is `stealOwnerM` or farther from it is taken by a man of the camp within `stealFromM` of it, who leads it home, unless he is struck, its owner
     * comes within `stealBreakM` of it, or `stealGiveUpMs` go by. A horse taken is not taken again for `stealAgainMs`.
     */
    spookM: 3.2,
    spookEveryMs: 20_000,
    spookChance: 0.35,
    spookLookMs: 2_000,
    horseHitShare: 0.5,
    horseHitMin: 4,
    stealLookMs: 4_000,
    stealFromM: 25,
    stealOwnerM: 20,
    stealTakeM: 2.5,
    stealBreakM: 6,
    stealGiveUpMs: 120_000,
    stealAgainMs: 10 * 60_000,
    // Ordered to fight and still for this long, farther from the target than `chaseFromM` (a bow's reach for an archer): sent
    // running at the target by the route the server plans, which is what a vendor is walked by and does work (user, 2026-10-18:
    // "os bandidos estão estáticos ainda ... deviam ir direto para o ataque").
    stillMs: 3_000,
    // A blow on a bandit orders him to fight again at once, but no oftener than this for the same man.
    hitOrderMs: 800,
    chaseEveryMs: 5_000,
    chaseFromM: 3,
    archerFromM: 20,
    // Idle, he strolls about his spot: a few steps, a pause, again.
    roamM: 5,
    roamPauseMs: [12_000, 35_000] as readonly [number, number],
    chestRadius: 35,
    chestRefillMs: 3 * 60 * 60_000,
    chestClearRadius: 60,
    spawnAfterMs: 25_000,
    tickMs: 1_000,
    /** A veteran's health, and his blows on a player on top of the camp's `damageMultiplier`. */
    veteranHealth: 200,
    veteranDamage: 1.25,
    /** A bandit who fights hand to hand takes up his bow when his target is farther than this, and his blade again nearer than `meleeFromM`. */
    bowFromM: 12,
    meleeFromM: 6,
    /**
     * A man left with this share of his health or less (and never fewer than `finishPoints`) is finished: held where he stands and killed `finishAfterMs` later
     * (2026-10-27: "matei um bandido com combo e ele bugou, ficou caído no chão mas não morreu"). The journal of that evening has two men of a hideout left at 5 and 11 of
     * 180 who lay on the ground for 13 and 15 seconds, until the player struck them again, and the archer of a road gang at 3: the game lays a body down at the edge of
     * death, where no blow lands any more, and the server's ledger never reaches zero. The men seen standing and fighting were at 25 and above (14%).
     */
    finishBelow: 0.12,
    finishPoints: 12,
    finishAfterMs: 1_500,
    /** Below this share of his health a bandit drinks, while he has a draught left, and gets `potionHeal` of his health back. */
    potionBelow: 0.4,
    potionHeal: 0.35,
    potionEveryMs: 15_000,
    potions: 2,
    veteranPotions: 3,
    /** An archer's draughts. */
    archerPotions: 1,
    /**
     * Every plain bandit and archer in a full set of armour that is not loot (2026-11-02, user: "os bandidos estão fáceis de matar, acredito por estarem sem equipamentos completos e
     * sem poções"). Off until the veterans' and chiefs' sets, which were never seen (see `equipment-rules.ts`), are seen on a client; `/bandidos armadura ligar` turns it on for the bodies made from then on (not kept: off again at the next start).
     */
    armourAll: false,
};

/**
 * How hard the bandits are, three presets an administrator picks (`/bandidos agressividade`, kept in `playerdata/bandits.json`):
 * how far off they see a player, how heavy their blows are on a player, how long a whole camp stays turned on one, how many fight one player hand to hand at a time
 * (the others go round them) and how far a shout carries. Lowered on 2026-10-30 (user: "estão muito difíceis de matar e quase impossível matar só um"); the middle one
 * is how they are by default.
 */
export type Aggression = "baixa" | "media" | "alta";

export const AGGRESSION: Readonly<Record<Aggression, { readonly label: string; readonly aggroRadius: number; readonly damageMultiplier: number; readonly alarmMs: number; readonly front: number; readonly earshotM: number; readonly about: string }>> = {
    // One fights a player hand to hand at a time at every level since 2026-11-02 (it was 1, 2 and 3): the others close round him and take their turns.
    baixa: { label: "baixa", aggroRadius: 14, damageMultiplier: 1.0, alarmMs: 25_000, front: 1, earshotM: 15, about: "só reagem a quem chega perto, batem fraco, um luta de perto por vez enquanto os outros cercam, e o acampamento esquece logo" },
    media: { label: "média", aggroRadius: 24, damageMultiplier: 1.4, alarmMs: 45_000, front: 1, earshotM: 30, about: "veem de longe e batem forte; um luta de perto por vez, os outros cercam e revezam, e só ouve o alarme quem está perto de quem luta" },
    alta: { label: "alta", aggroRadius: 36, damageMultiplier: 1.8, alarmMs: 90_000, front: 1, earshotM: 50, about: "veem de muito longe e batem muito forte; um luta de perto por vez e os outros cercam e revezam depressa, e o acampamento persegue por um minuto e meio" },
};

export const DEFAULT_AGGRESSION: Aggression = "media";

let aggression: Aggression = DEFAULT_AGGRESSION;
const AGGRESSION_FILE = "playerdata/bandits.json";

/** The level the bandits are at. */
export function aggressionLevel(): Aggression {
    return aggression;
}

/** Sets the bandits' hardness for good: the settings change at once, and the choice is kept for the next start. */
export function setAggression(level: Aggression): void {
    aggression = level;
    applyPreset(level);
    try {
        ensureDir("playerdata");
        write(AGGRESSION_FILE, { aggression: level });
    } catch (error: unknown) {
        console.log(`bandits: não consegui salvar a agressividade: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** The settings the level stands for. */
function applyPreset(level: Aggression): void {
    const preset = AGGRESSION[level];
    banditSettings.aggroRadius = preset.aggroRadius;
    banditSettings.damageMultiplier = preset.damageMultiplier;
    banditSettings.alarmMs = preset.alarmMs;
    banditSettings.frontMax = preset.front;
    banditSettings.earshotM = preset.earshotM;
}

function loadAggression(): void {
    const loaded = read<{ aggression?: unknown }>(AGGRESSION_FILE);
    if (loaded.status === "ok" && typeof loaded.value.aggression === "string" && loaded.value.aggression in AGGRESSION) {
        aggression = loaded.value.aggression as Aggression;
        applyPreset(aggression);
    }
}

/**
 * What a bandit says in a fight (user, 2026-10-17: the NPCs should speak when the moment is theirs; 2026-11-01: "frases que eles falam ao lutar"): when he sees somebody to fight,
 * when the camp is roused, when he is struck or drinks, when the ring closes, now and then as he fights, when his man is nearly down, when a fellow falls, when he falls back,
 * the chief's orders and his pride, the chief's fall, the rage after it, at a rider and his horse, at a horse taken, over a fallen player, and at one who runs off.
 */
export const BARKS = {
    sight: ["Ei, você! Largue o que tem!", "Aqui não é lugar de gente de bem!", "Um viajante! Peguem-no!", "Quem mandou entrar no nosso acampamento?", "Olha só quem veio nos visitar...", "A bolsa ou a vida, forasteiro!", "Mais um tolo perdido na mata!", "Você escolheu o caminho errado, amigo."],
    alarm: ["Às armas! Estão nos atacando!", "Todos aqui! Rápido!", "Peguem esse desgraçado!", "Acordem, seus porcos! Temos visita!", "Ninguém sai daqui vivo!"],
    hurt: ["Maldito!", "Você vai pagar por isso!", "Ah, seu porco!", "Argh! Isso doeu!", "Filho de uma cadela!", "Vai ter troco!"],
    potion: ["Ainda não acabou!", "Isto me põe de pé...", "Hah! Venha de novo!", "Um gole e estou novo!"],
    surround: ["Cerquem esse sujeito!", "Pelos lados! Peguem-no pelos lados!", "Fechem o cerco!", "Por trás dele! Vão por trás!"],
    taunt: ["É só isso que você sabe fazer?", "Vou arrancar sua cabeça!", "Sua bolsa vai ser minha!", "Morra, cão!", "Já matei gente melhor que você!", "Vou te mandar para o inferno!", "Você luta como uma velha!", "Corre enquanto pode!", "Ninguém escapa da gente!", "Vou pendurar sua cabeça na estrada!"],
    weak: ["Ele está sangrando! Acabem com ele!", "Mais um golpe e ele cai!", "Olha como ele treme!", "Esse aí já era!"],
    fallen: ["Mataram o nosso irmão!", "Vão pagar por ele!", "Ele está morto! Vinguem-no!", "Desgraçado... vai morrer por isso!"],
    retreat: ["Me cobrem! Estou ferido!", "Recuar! Recuar!", "Ai... preciso de ajuda!", "Segurem ele enquanto eu respiro!"],
    chief: ["Cerquem ele! Ninguém foge!", "Peguem-no! Quero a cabeça dele!", "Arqueiros, atirem nesse verme!", "Mostrem pra ele quem manda aqui!", "Quem invade meu acampamento não sai vivo!"],
    chiefHurt: ["Acha que pode comigo? Eu lutei em Kuttenberg!", "Foi só um arranhão...", "Agora você me irritou!", "Já derrubei cavaleiros melhores que você!"],
    chiefFell: ["O chefe caiu! Fujam!", "Mataram o chefe! Salve-se quem puder!"],
    rage: ["Vinguem o chefe!", "Pelo chefe! Matem esse desgraçado!", "Sangue por sangue!"],
    horseSpook: ["Derrubem ele do cavalo!", "Assustem o cavalo!", "Para o chão, cavaleiro!"],
    horseHit: ["Matem o cavalo!", "Acertem o bicho!", "Sem cavalo você não foge!"],
    horseSteal: ["Que belo cavalo... agora é meu!", "Esse cavalo vai valer uma fortuna!", "Obrigado pelo presente, forasteiro!"],
    victory: ["Revistem o corpo!", "Mais um que aprendeu a lição!", "Hah! Fácil demais."],
    chase: ["Covarde! Volte aqui!", "Fugindo? Hahaha!", "Corre, coelhinho, corre!"],
};

export type BarkKind = keyof typeof BARKS;

/** The lines that answer something (a sight, a blow, a draught, a death, an order): heard at once, whoever of the camp spoke a moment ago. */
const URGENT_BARKS: ReadonlySet<BarkKind> = new Set<BarkKind>(["sight", "alarm", "hurt", "potion", "fallen", "retreat", "chief", "chiefHurt", "chiefFell", "rage", "horseSpook", "horseSteal", "victory"]);

/** The lines of a moment that comes once in a man's life (he falls back, his chief falls): said even if he spoke a moment ago. */
const ONCE_BARKS: ReadonlySet<BarkKind> = new Set<BarkKind>(["retreat", "chiefFell", "rage"]);

/**
 * The game's own voice for a line (`Libs/GameAudio/voices.xml`): the soldiers' attack cries for a shout, their cries when struck, a scream in pain for one who falls back or sees
 * his chief fall, the sip of a draught; a line with none is only said.
 */
export const SHOUTS: Readonly<Record<BarkKind, readonly string[]>> = {
    sight: ["v_soldier_1_attack", "v_soldier_2_attack"],
    alarm: ["v_soldier_1_attack", "v_soldier_2_attack", "v_attack"],
    hurt: ["v_soldier_1_hit", "v_soldier_2_hit", "v_male_injured_reaction1"],
    potion: ["v_sipping_potion"],
    surround: ["v_attack"],
    taunt: ["v_soldier_1_attack", "v_soldier_2_attack", "v_attack"],
    weak: ["v_attack"],
    fallen: ["v_soldier_2_attack"],
    retreat: ["v_male_scream_in_pain1"],
    chief: ["v_soldier_1_attack"],
    chiefHurt: ["v_soldier_1_hit"],
    chiefFell: ["v_male_scream_in_pain1"],
    rage: ["v_soldier_1_attack", "v_soldier_2_attack"],
    horseSpook: ["v_attack"],
    horseHit: ["v_soldier_2_attack"],
    horseSteal: [],
    victory: [],
    chase: ["v_attack"],
};

/** The event that has the games near a bandit play his shout (`client/bandit-shouts.ts`): `{ t: trigger, x, y, z }`. */
export const SHOUT_EVENT = `${RESOURCE}:bandit.shout`;

/** How long a bandit is quiet after a line (20 s before 2026-11-01, when they were to speak more as they fight). */
export const BARK_EVERY_MS = 9_000;

/**
 * What a placement's layer or name says of a bandit: the bandit camps of the level, and (2026-10-24) the other enemies' camps whose people
 * the quests do not bring here -- the poachers (`poach`, Czech `pytlak`), the treasure hunters and the deserters' barn (`zbeh`).
 */
const PATTERN = /bandit|lapk|zbojn|poach|pytlak|pytlack|treasureHunter|zbeh/i;
const CONTAINER = /chest|stash|sack|crate|box|barrel/i;
/** Containers that are not a camp's stores: beehives, bodies, and anything a quest or a cutscene owns. */
const NOT_STORES = /bee|hive|corpse|deadbody|cin_|quest|dlc/i;

/** Region codes of the level's layers, as people say them. */
const REGIONS: Readonly<Record<string, string>> = {
    grunta: "Minas",
    vrchlicko: "Vrchlicko",
    kopecVysoka: "Kopec Vysoká",
    rabstejnsko: "Rabštejnsko",
    mezholezsko: "Mezholezsko",
    zikmundovo: "Zikmundovo",
    malesov: "Malešov",
    kutnaHora: "Kutná Hora",
    bohounovice: "Bohounovice",
    kuklicko: "Kuklicko",
    naBylance: "Na Bylance",
    suchdol: "Suchdol",
    lorec: "Lorec",
    pritoky: "Přítoky",
};

/**
 * Where the camps were in the level data when this was written, for a server whose catalog lists no bandits (a
 * different level build). Only used when `Npc.placements()` finds none.
 */
const FALLBACK_CAMPS: ReadonlyArray<{ name: string; x: number; y: number; z: number }> = [
    { name: "Minas", x: 3311.4, y: 2533.7, z: 89.9 },
    { name: "Vrchlicko (moinho)", x: 1575.5, y: 224.7, z: 56.1 },
    { name: "Kopec Vysoká", x: 1065.9, y: 2443.0, z: 192.6 },
    { name: "Rabštejnsko", x: 598.1, y: 1380.1, z: 118.4 },
    { name: "Mezholezsko", x: 211.3, y: 1472.6, z: 133.2 },
];

// ---------------------------------------------------------------------------------------------
// What they wear and carry, and what the camp chests hold. Item names from the game's own tables.

const TUNICS = ["TunicLong04_m01_D", "TunicLong05_m01_E", "TunicLong04_m02_D"];
const HOSE = ["HoseSeparate01_m01_E", "HoseSeparate04_m01_E"];
const HEADS = ["Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E"];
const COATS = ["Coat03_m01_E", "Coat03_m02_E"];
const MELEE = ["axeWork01", "maceClub", "shortswordCleaver"];
const BOW = "bow_b";
const ARROWS = "arrow_crude";

/**
 * The armour the bandits wear (2026-11-02), put together as the game's own outfits are (`equipment-rules.ts`): a gambeson and no tunic, a padded or mail coif under every helmet, the
 * mail, the brigandine and the arm armour over the gambeson. The names are the game's, taken from outfits of its own bandits. It stays on the body when he falls, for whoever looted it
 * (2026-11-02, user: "os bandidos de armadura e o chefe, ao morrer os itens dele somem; é para manter no corpo para poder saquear"; it was taken off since 2026-10-21).
 */
const GAMBESON_SHORT = ["GambesonShort01_m02_D2", "GambesonShort01_m04_D2", "GambesonShort02_m03_E1"];
const GAMBESON_LONG = ["GambesonLong01_m01_C3", "GambesonLong01_m15_C3"];
const COIF_SOFT = ["CoifSmall02_m01_E1", "CoifSmall01_m02_C2", "CoifLarge02_m03_C3"];
const COIF_MAIL = ["CoifMail02_m01_B3", "CoifMail02_m03_B3"];
const HOODS = ["Hood04_m01_E", "Hood04_m03_E"];
const VETERAN_HEADS = ["KettleHat02_m01_D2", "SkullCap04_m01_C3", "SkullCap04_m02_C3", "KettleHat04_m01_B4"];
const VETERAN_MAIL = ["MailLong02_m01_C2", "MailShort01_m01_C4", "MailShort02_m01_C1"];
const VETERAN_ARMS = ["ArmPlate01_m01_C2", "BrigandineArm01_m01_D1"];
const VETERAN_MELEE = ["shortswordCommon", "axeBattle01", "mace01", "huntingSwordFalchion"];
const BOOTS = ["BootsAnkle03_m01_D", "BootsAnkle01_m01_C"];
const GLOVES = "Gloves05_m01_B2";

/**
 * The chiefs' souls: the game's own best bandits (`Libs/Tables/rpg/soul__prepadeni.xml`, the ambushers of the Trosky road: combat level 1.0, the most the game gives; the camps' own
 * bandits are 0.3 to 0.7), in the bandits' looks and voices. Their faction sits under the game's `enemies`, as every bandit's here does, with no relation of its own to the camps'.
 */
export const CHIEF_SOULS: readonly string[] = [
    "995bbdf4-e7f4-49f2-903d-a0756b3d1d4f",
    "f7b172cf-dfcd-48de-a485-d0c57bb301c6",
    "69c60d28-52d5-44a1-b77c-2af68066ae1f",
    "23bb6a94-5d00-4936-8345-e9243b60ffdf",
    "3159db1c-61bb-4218-a83c-2273f2515ec7",
    "c347572a-a4d0-4306-8ec5-93910355daf8",
    "34de42d2-c27e-4b71-a8c3-28b3892c3580",
    "ad8badea-6e53-49c2-bee0-ace1c3dd73f4",
];
/** A chief's armour, not loot (taken off him when he falls, as a veteran's is): the bascinet with its aventail over a mail coif, the long gambeson, mail and the bandits' dark brigandine over it, rondels, gauntlets and boots. */
const CHIEF_HEAD = "BascinetOpen08_m01_B3";
const CHIEF_PLATE = "Brigandine02_m04_E2";
const CHIEF_GAUNTLETS = "Gauntlets04_m01_C2";
/** The weapon a chief is a master of, one to a camp: a longsword, a captain's mace, an executioner's axe or a war hammer. Not loot either. */
export const CHIEF_WEAPONS: readonly string[] = ["longswordCommon", "maceHetman", "axeFancy", "warhammer03"];

/**
 * The Cumans of the roads (user, 2026-10-19: "seria legal alguns cumanos pela estrada"): the caftan, the tall or the leather hat
 * (now and then the open bascinet), the knee boots, a shashka or a fokos, sometimes a Cuman shield; their archer has a Cuman bow.
 * Item names from the game's tables (ITENS.md).
 */
const CUMAN_TUNICS = ["Caftan01_m01_D1", "Caftan01_m02_D1", "Caftan01_m03_D1", "Caftan01_m05_D1", "Caftan01_m07_D1"];
const CUMAN_HEADS = ["Cap13_m01_D", "Cap13_m03_D", "Cap06_m02_D", "Cap06_m05_D"];
const CUMAN_HELMET = "BascinetOpen09_m01_B1";
/** The padded coif under the Cuman bascinet: a helmet with none under it is refused by the game's dressing (`equipment-rules.ts`). */
const CUMAN_COIF = "CoifSmall02_m01_E1";
const CUMAN_BOOTS = ["BootsKnee05_m01_C", "BootsKnee05_m03_C", "BootsKnee05_m04_C"];
const CUMAN_MELEE = ["huntingSwordSashka", "huntingSwordSashka", "axeCuman"];
const CUMAN_SHIELDS = ["shieldCuman_01", "shieldCuman_02", "shieldCuman_03", "shieldCuman_05"];
const CUMAN_BOW = "cuman_bow_b";
const FOOD = ["bread", "apple", "carrot"];

const HERBS = ["herb_belladona", "herb_chamomile", "herb_comfrey", "herb_dandelion", "herb_eyewort", "herb_hypericum", "herb_marigold", "herb_mint", "herb_poppy", "herb_salvia", "herb_thistle", "herb_urticaria", "herb_valerian", "herb_wormwood"];
const CLOTHES = ["TunicLong01_m01_C", "TunicShort01_m01_D", "TunicLong02_m01_C", "TunicShort03_m01_D", "HoseSeparate05_m01_D", "HoseLoose01_m01_C", "Shoes01_m01_D", "Coat02_m01_D", "Cap27_m01_D", "Hood01_m01_D", "F_SimpleDress01_m01_D", "F_Hood01_m01_C"];

interface LootEntry {
    readonly items: readonly string[];
    readonly min: number;
    readonly max: number;
    readonly weight: number;
}

/** Guild work: the smith's metal, the alchemist's herbs, the hunter's arrows and hides, the cook's meat. */
export const CHEST_LOOT: readonly LootEntry[] = [
    { items: ["bsmt_ironBad"], min: 2, max: 6, weight: 12 },
    { items: ["bsmt_ironGood"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_steelBad"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_hardware"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_guardSimple", "bsmt_pommelCoin"], min: 1, max: 1, weight: 3 },
    { items: HERBS, min: 2, max: 6, weight: 14 },
    { items: ["special_charcoal"], min: 1, max: 3, weight: 5 },
    { items: ["special_cobweb"], min: 1, max: 2, weight: 3 },
    { items: ["arrow_crude", "arrow_normal"], min: 5, max: 15, weight: 10 },
    { items: ["special_deerSkin", "special_pigSkin", "special_cowSkin"], min: 1, max: 2, weight: 6 },
    { items: ["beef", "pigMeat", "lambMeat", "chicken"], min: 1, max: 2, weight: 6 },
    // The rest of what the guilds' recipes take (user, 2026-10-18: "todos os recursos das guildas nas receitas precisam estar ...
    // em baús pelo mundo afora de bandidos, ou até em bandidos, assim mantemos um equilíbrio").
    { items: ["special_sulfur", "special_saltpeter"], min: 1, max: 3, weight: 4 },
    { items: ["loot_cloth", "skin_sheep"], min: 1, max: 3, weight: 5 },
    { items: ["loot_salt", "driedPepperSpice", "garlic", "honey"], min: 1, max: 3, weight: 5 },
    { items: ["wine"], min: 1, max: 2, weight: 4 },
    { items: ["herb_dried_poppy", "special_mushroomAmanita", "special_charcoalImproved"], min: 1, max: 2, weight: 3 },
    { items: ["bsmt_woodExotic", "bsmt_guardSpecial", "bsmt_copper", "special_attire"], min: 1, max: 1, weight: 2 },
    { items: ["maliruvLek_mandrakeRoot", "maliruvLek_freshwaterPearl"], min: 1, max: 1, weight: 1 },
];

/**
 * How often a bandit carries something of the guilds' on him, besides his coins: one row of the chests' table, a small lot. Lowered with
 * his purse and his bread on 2026-10-25 (the user: "diminuir o rate de drop de mobs").
 */
export const CARRIED_GOODS_CHANCE = 0.15;
/** How often a bandit carries a bite to eat. */
export const CARRIED_FOOD_CHANCE = 0.4;

// ---------------------------------------------------------------------------------------------

type Point = { x: number; y: number; z: number };

interface Spot {
    readonly position: Point;
    readonly soul: string;
}

interface Slot {
    readonly spot: Spot;
    readonly archer: boolean;
    /** One in three of a camp: battered armour, more health, a heavier hand, two draughts. */
    readonly veteran?: boolean;
    /** The first man of a camp or a hideout (2026-11-01): the chief (`chiefHealth`, `CHIEF_SOULS`, `CHIEF_WEAPONS`). */
    readonly chief?: boolean;
    /** What he fights with now, for one who has a bow and a blade; whether he has both; not before this is the bow tried again. */
    mode?: "melee" | "bow";
    hasBow?: boolean;
    noBowUntil?: number;
    /** Draughts left, and not before this does he drink again. */
    potions?: number;
    potionAt?: number;
    /** The classes taken off his body when he falls (the veteran's armour, the second bow and its arrows). */
    strip?: string[];
    npcId: number | null;
    state: "vacant" | "alive" | "dead";
    deathAt: number;
    /** How long after `deathAt` his place is filled again, when it is not the camp's: chosen the first time it is asked, and dropped when a man stands there. */
    respawnWait?: number;
    target: number | null;
    retryAt: number;
    /** Not before this may he shout again. */
    barkAt?: number;
    /** Not before this does he stroll about his place again. */
    roamAt?: number;
    /** A player's game is made to run him whatever the distances say (`pin`). */
    pinned?: boolean;
    /** To whose game he was last given by the fight (`pinTo`), and when. */
    pinnedTo?: number;
    pinnedAt?: number;
    /** Where he was last time he was seen to move, and since when he has stood there: a bandit ordered to fight who does not stir. */
    watchX?: number;
    watchY?: number;
    watchAt?: number;
    /** Not before this is he ordered to fight again because a blow reached him. */
    hitOrderAt?: number;
    /** He is being finished (`finishOff`): when he is killed, and who is credited with it. */
    finishAt?: number;
    finishBy?: number;
    /** Not before this is he sent running at his target by the server's own route again. */
    chaseAt?: number;
    /** What he does in the fight now: hand to hand at the front, the bow, or waiting in the ring round the target (`assign`). */
    role?: "front" | "bow" | "ring";
    /** Whom he has noticed and not before this does he act on it: a man roused by his camp's alarm takes a moment, the longer the farther he is from the fight. */
    reactTo?: number;
    reactAt?: number;
    /** Who struck him last, and when: he knows it whatever the distance, and fights at once. */
    hurtBy?: number;
    hurtAt?: number;
    /** His turn at the player hand to hand: since when, and how long it is; when he last gave it up (2026-11-02). */
    frontSince?: number;
    turnMs?: number;
    yieldedAt?: number;
    /** He stays in the line until this, whatever the turns say: he stepped in to defend himself or was struck (`commitMs`, 2026-11-04). */
    committedUntil?: number;
    /** The ring's small steps (`stalkMs`): which step he is at, when he takes the next, and whether he is walking to one (2026-11-04). */
    stalkStep?: number;
    stalkAt?: number;
    stalking?: boolean;
    /** A shooter sent aside from another man (`shooterGapM`): not before `spaceAt` again, and his bow not ordered again while he walks there, until `spacingUntil`. */
    spaceAt?: number;
    spacingUntil?: number;
    /** Who struck him, by player id, and when last: his purse is theirs when he falls (2026-11-02). */
    hitters?: Map<number, number>;
    /** The ring: where he was last sent, not before this is he sent again, whether he stands there, and how many times the game would not take him there. */
    ringGoal?: Point;
    ringAt?: number;
    ringStill?: boolean;
    ringFails?: number;
    /** Not before this does he taunt (`tauntMs`), look for a weaker man (`weakEveryMs`), run back from his man (an archer), or try to rear his man's horse. */
    tauntAt?: number;
    weakAt?: number;
    /** Not before this does he change his man for one who struck him or one with fewer of the camp on him (2026-11-02). */
    switchAt?: number;
    backAt?: number;
    spookAt?: number;
    /** He fell back once (`retreatBelow`), and is falling back until this. */
    retreated?: boolean;
    retreatUntil?: number;
    /** His blows weigh `rageDamage` more until this: his chief fell. */
    rageUntil?: number;
    /** He is taking a player's horse (`theft` of his camp). */
    stealing?: boolean;
}

/** A man of a camp who is after a player this look, and how he is to fight. */
interface Acting {
    readonly slot: Slot;
    readonly npc: Npc;
    readonly target: { readonly player: Player; readonly position: Point };
    readonly position: Point;
    readonly range: number;
    role: "front" | "bow" | "ring";
}

/** Where, round the target, the men of the ring stand, as degrees from the side the front line is on: both flanks first, then behind. */
export const RING_OFFSETS_DEG: readonly number[] = [80, -80, 150, -150, 180, 115, -115, 45, -45];

/**
 * Where a shooter standing at `from` steps to get clear of `crowd` (2026-11-04): `step` across the line from him to `target`, on the side away from `crowd`, else the other side,
 * else `step` back from the target -- the first of them with nobody of `others` within `gap`. Null when all three are taken.
 */
export function asideSpot(from: Point, crowd: Point, target: Point, step: number, gap: number, others: readonly Point[]): Point | null {
    let dx = from.x - target.x;
    let dy = from.y - target.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) {
        dx = 1;
        dy = 0;
    } else {
        dx /= length;
        dy /= length;
    }
    const left = { x: -dy, y: dx };
    const right = { x: dy, y: -dx };
    const crowdOnLeft = (crowd.x - from.x) * left.x + (crowd.y - from.y) * left.y > 0;
    for (const way of [crowdOnLeft ? right : left, crowdOnLeft ? left : right, { x: dx, y: dy }]) {
        const spot = { x: from.x + way.x * step, y: from.y + way.y * step, z: from.z };
        if (others.every((other) => Math.hypot(other.x - spot.x, other.y - spot.y) >= gap)) {
            return spot;
        }
    }
    return null;
}

/** A ring man's small steps about his spot (2026-11-04): [which way round, in units of `stalkDeg`; whether `stalkInM` nearer]. */
export const STALK_STEPS: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [1, 1],
    [0, 0],
    [-1, 1],
];

/** How near the straight way from `from` to `to` passes `centre`, on the ground. */
export function passesWithin(from: Point, to: Point, centre: Point): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((centre.x - from.x) * dx + (centre.y - from.y) * dy) / length));
    return Math.hypot(from.x + dx * t - centre.x, from.y + dy * t - centre.y);
}

/**
 * Where a ring man heads for his spot round the target (`centre`): the spot itself when the straight way keeps `clearM` off the target, and otherwise the point on the ring halfway round
 * from his side to the spot's, the shorter way, so that he goes round the player and not through him.
 */
export function ringWay(from: Point, spot: Point, centre: Point, ringM: number, clearM: number): Point {
    if (passesWithin(from, spot, centre) >= clearM) {
        return spot;
    }
    const mine = Math.atan2(from.y - centre.y, from.x - centre.x);
    const theirs = Math.atan2(spot.y - centre.y, spot.x - centre.x);
    let turn = theirs - mine;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    const half = mine + turn / 2;
    return { x: centre.x + Math.cos(half) * ringM, y: centre.y + Math.sin(half) * ringM, z: spot.z };
}

type Row = { item: string; amount: number; equipped?: number; metadata?: Record<string, unknown>; strip?: boolean };
/** A row whose `item` is the class GUID, with the name it was asked for kept for the log. */
type Classed = Row & { name: string };

/** Every item name this module hands out, to be turned into class GUIDs once. */
const ITEM_NAMES: readonly string[] = [...TUNICS, ...HOSE, ...HEADS, ...COATS, ...MELEE, BOW, ARROWS, ...FOOD, "money", ...CLOTHES, ...CHEST_LOOT.flatMap((entry) => entry.items), ...GAMBESON_SHORT, ...GAMBESON_LONG, ...COIF_SOFT, ...COIF_MAIL, ...HOODS, ...VETERAN_HEADS, ...VETERAN_MAIL, ...VETERAN_ARMS, ...VETERAN_MELEE, ...BOOTS, GLOVES, CHIEF_HEAD, CHIEF_PLATE, CHIEF_GAUNTLETS, ...CHIEF_WEAPONS, CUMAN_COIF];

/**
 * Item names to class GUIDs. `Inventory.set` and `setInventory` take only GUIDs (a name is refused as `invalidItem`,
 * or as `invalidEquipment` on a worn row), while `addItem` takes either. The worn things come from
 * `Inventory.classes()`; any other name is put in a scratch stash, and the row it makes says its GUID. A name the game
 * does not know is left out of the map.
 */
export function resolveItems(names: readonly string[]): Map<string, string> {
    const guids = new Map<string, string>();
    for (const entry of Inventory.classes()) {
        guids.set(entry.name.toLowerCase(), entry.id);
    }
    const missing = [...new Set(names)].filter((name) => !guids.has(name.toLowerCase()));
    if (missing.length === 0) {
        return guids;
    }
    const scratch = Stash.createVirtual();
    try {
        for (const name of missing) {
            if (scratch.setInventory({ items: [] }).ok && scratch.addItem({ item: name, amount: 1 }).ok) {
                const row = scratch.getInventory()?.items[0];
                if (row !== undefined) {
                    guids.set(name.toLowerCase(), row.item);
                }
            }
        }
    } finally {
        scratch.destroy();
    }
    return guids;
}

export interface Camp {
    readonly id: number;
    readonly name: string;
    readonly center: Point;
    readonly slots: Slot[];
    chests: string[];
    /** Whether the containers around the camp have been looked for. */
    scanned: boolean;
    chestsFilledAt: number;
    alarm: { targetId: number; until: number } | null;
    /** The least and the most a dead man of this camp waits to be replaced, when it is not `respawnMs`: the roads' gangs. */
    readonly respawn?: readonly [number, number];
    /** Not before this does another of its men speak a line that answers nothing (`campBarkGapMs`). */
    barkAt?: number;
    /** Not before this is a rider's horse reared again, by rider. */
    spooked?: Map<number, number>;
    /** A player's horse its man is taking home (`stealHorses`), and when the camp looks for one again. */
    theft?: { npcId: number; horseId: number; ownerId: number; stage: "to" | "lead"; since: number; orderAt: number; goal: Point } | null;
    stealAt?: number;
}

export type Placement = ReturnType<typeof Npc.placements>[number];

const flat = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** How long is left of a wait, for an administrator: "em 1 h 52 min", "em 14 min", or "assim que ninguém estiver por perto" when it is over. */
function waitText(leftMs: number): string {
    const minutes = Math.ceil(leftMs / 60_000);
    if (minutes <= 0) {
        return "assim que ninguém estiver por perto";
    }
    return minutes < 60 ? `em ${minutes} min` : `em ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** A stable number out of a name (FNV-1a), so the same level always gets the same hideouts. */
export function stableHash(text: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/** Points in square cells, to ask whether any lies within a radius without looking at all of them. */
class Crowd {
    private readonly cells = new Map<string, Point[]>();

    constructor(private readonly cell: number) {}

    private key(x: number, y: number): string {
        return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
    }

    add(point: Point): void {
        const key = this.key(point.x, point.y);
        const list = this.cells.get(key);
        if (list === undefined) {
            this.cells.set(key, [point]);
        } else {
            list.push(point);
        }
    }

    /** Whether any point lies closer than `radius` (at most one cell) to `at`. */
    near(at: Point, radius: number): boolean {
        const column = Math.floor(at.x / this.cell);
        const row = Math.floor(at.y / this.cell);
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                if (this.cells.get(`${column + dx},${row + dy}`)?.some((point) => flat(point, at) < radius) === true) {
                    return true;
                }
            }
        }
        return false;
    }
}

/** A place the script may hide bandits at: a marker of the level and a name to sort it by. */
export interface WildCandidate {
    readonly guid: string;
    readonly position: Point;
}

/** What the navigation mesh says about a place; the game's own is `NAVIGATION`. */
export interface Reach {
    /** The walkable point nearest a marker, or null when there is none. */
    project(point: Point): Point | null;
    /** A walkable point at random within `radius` of a centre, or null. */
    around(centre: Point, radius: number): Point | null;
}

const NAVIGATION: Reach = {
    project(point) {
        if (!Navigation.ready) {
            return null;
        }
        const found = Navigation.closestPoint(new Vector3(point.x, point.y, point.z), { searchRadius: 12, searchHeight: 20, doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    },
    around(centre, radius) {
        if (!Navigation.ready) {
            return null;
        }
        const found = Navigation.randomPoint(new Vector3(centre.x, centre.y, centre.z), radius, { doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    },
};

/** How many sites to keep and how far from people, from camps and from one another. */
export interface SiteRules {
    readonly count: number;
    readonly fromPeopleM: number;
    readonly fromCampsM: number;
    readonly separationM: number;
}

/**
 * Picks sites out of candidates, the same ones on every start. The candidates are taken in an order fixed by their names, and one is kept
 * when it can be walked to, is not near any place the level puts ordinary people (`people`), is clear of the camps given and of the sites
 * kept before it.
 */
export function chooseSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    rules: SiteRules,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    const crowd = new Crowd(rules.fromPeopleM);
    people.forEach((point) => crowd.add(point));
    const ordered = [...candidates].sort((a, b) => stableHash(a.guid) - stableHash(b.guid) || (a.guid < b.guid ? -1 : 1));
    const chosen: Array<{ candidate: WildCandidate; centre: Point }> = [];
    for (const candidate of ordered) {
        if (chosen.length >= rules.count) {
            break;
        }
        const at = candidate.position;
        if (crowd.near(at, rules.fromPeopleM) || camps.some((camp) => flat(camp, at) < rules.fromCampsM) || chosen.some((other) => flat(other.centre, at) < rules.separationM)) {
            continue;
        }
        const centre = reach.project(at);
        if (centre !== null && !crowd.near(centre, rules.fromPeopleM)) {
            chosen.push({ candidate, centre });
        }
    }
    return chosen;
}

/** Where the script adds hideouts: spread across the wild (`chooseSites` with the wild's rules). */
export function chooseWildSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    settings = banditSettings,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    return chooseSites(candidates, people, camps, reach, { count: settings.wildCamps, fromPeopleM: settings.wildFromPeopleM, fromCampsM: settings.wildFromCampsM, separationM: settings.wildSeparationM });
}

/**
 * Where the script puts gangs on the roads: the road places of the level (`data/road-posts.json`), fewer, nearer to people than a hideout
 * may be (a road runs between villages) and as far from the camps as the hideouts are, from the ones kept so far.
 */
export function chooseRoadSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    settings = banditSettings,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    return chooseSites(candidates, people, camps, reach, { count: settings.roadPosts, fromPeopleM: settings.roadFromPeopleM, fromCampsM: settings.roadFromCampsM, separationM: settings.roadSeparationM });
}

/** One archer for every four bandits in a camp of three or more. */
export function archersFor(count: number): number {
    return count >= 3 ? Math.max(1, Math.floor(count / 4)) : 0;
}

/** One veteran for every three bandits in a camp of three or more (2026-10-21). */
export function veteransFor(count: number): number {
    return count >= 3 ? Math.max(1, Math.floor(count / 3)) : 0;
}

function regionName(layer: string): string | null {
    const match = /Main\/k[a-z]{3}_([A-Za-z]+)\//.exec(layer);
    const code = match?.[1];
    return code === undefined ? null : (REGIONS[code] ?? null);
}

/** Not before this is a horse taken again, by horse id. */
const stolenUntil = new Map<number, number>();

/** How a bandit is armed and armoured (`inventoryFor`). */
type KitTier = "plain" | "archer" | "veteran" | "chief";

/** What a bandit is called, as his body's name is at its making: the author of what he shouts. */
function nameOfSlot(slot: Slot): string {
    return slot.chief === true ? "Chefe dos bandidos" : slot.archer ? "Bandido arqueiro" : slot.veteran === true ? "Bandido veterano" : "Bandido";
}

export class BanditCamps {
    readonly camps: Camp[] = [];
    /** Worn items the game would not put on a bandit, with how many times. */
    readonly refusedGear = new Map<string, number>();
    /** Goods a camp chest would not take. */
    readonly refusedLoot = new Set<string>();
    /** Why bandits or chests got nothing at all, by the game's code, with how many times. */
    readonly failures = new Map<string, number>();
    /** Names the game's tables do not have. */
    readonly unknownNames = new Set<string>();
    private readonly bySlot = new Map<number, { camp: Camp; slot: Slot }>();
    private guids: Map<string, string> | null = null;
    private running = true;

    constructor(
        private readonly settings = banditSettings,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
        private readonly resolve: (names: readonly string[]) => Map<string, string> = resolveItems,
    ) {}

    /** The bodies of the camps' bandits standing alive now: what a lock-on prefers over a player (`lockon-priority.ts`). */
    liveIds(): number[] {
        const ids: number[] = [];
        for (const [id, entry] of this.bySlot) {
            if (entry.slot.state === "alive") ids.push(id);
        }
        return ids;
    }

    /** Rows by name to rows by class GUID, which is all `Inventory.set` and `setInventory` take. */
    private byClass(rows: readonly Row[]): Classed[] {
        if (this.guids === null) {
            this.guids = this.resolve(ITEM_NAMES);
        }
        const out: Classed[] = [];
        for (const row of rows) {
            const guid = this.guids.get(row.item.toLowerCase());
            if (guid === undefined) {
                this.unknownNames.add(row.item);
            } else {
                out.push({ ...row, item: guid, name: row.item });
            }
        }
        return out;
    }

    private pick<T>(list: readonly T[]): T {
        return list[Math.floor(this.random() * list.length)] ?? list[0]!;
    }

    private between(min: number, max: number): number {
        return min + Math.floor(this.random() * (max - min + 1));
    }

    /** Groups the level's bandit placements into camps. Returns how many it made. */
    discover(placements: readonly Placement[]): number {
        const picks = placements.filter((p) => (PATTERN.test(p.layer) || PATTERN.test(p.name)) && !/cinematic/i.test(p.layer));
        const clusters: Array<{ center: Point; members: Placement[] }> = [];
        for (const p of picks) {
            const position = { x: p.position.x, y: p.position.y, z: p.position.z };
            const cluster = clusters.find((c) => flat(c.center, position) < this.settings.clusterRadius);
            if (cluster === undefined) {
                clusters.push({ center: position, members: [p] });
                continue;
            }
            cluster.members.push(p);
            const n = cluster.members.length;
            cluster.center = {
                x: cluster.members.reduce((s, m) => s + m.position.x, 0) / n,
                y: cluster.members.reduce((s, m) => s + m.position.y, 0) / n,
                z: cluster.members.reduce((s, m) => s + m.position.z, 0) / n,
            };
        }

        if (clusters.length === 0) {
            for (const fallback of FALLBACK_CAMPS) {
                this.addCamp(fallback.name, fallback, [{ position: fallback, soul: "bandit" }]);
            }
            return this.camps.length;
        }

        clusters.sort((a, b) => b.members.length - a.members.length || a.center.x - b.center.x);
        const regions = clusters.map((cluster) => {
            const layer = cluster.members[0]?.layer ?? "";
            return /_quest\//.test(layer) ? null : regionName(layer);
        });
        // A region with more than one camp numbers them from west to east: "Vrchlicko 1", "Vrchlicko 2".
        const numbers = new Map<number, number>();
        for (const region of new Set(regions)) {
            const indexes = regions.flatMap((other, index) => (region !== null && other === region ? [index] : []));
            if (indexes.length > 1) {
                indexes.sort((a, b) => clusters[a]!.center.x - clusters[b]!.center.x).forEach((clusterIndex, order) => numbers.set(clusterIndex, order + 1));
            }
        }
        let hideouts = 0;
        clusters.forEach((cluster, index) => {
            const region = regions[index] ?? null;
            const number = numbers.get(index);
            let name: string;
            if (region === null) {
                hideouts += 1;
                name = `Esconderijo ${hideouts}`;
            } else {
                name = number === undefined ? region : `${region} ${number}`;
            }
            this.addCamp(name, cluster.center, cluster.members.map((m) => ({ position: { x: m.position.x, y: m.position.y, z: m.position.z }, soul: m.soul })));
        });
        return this.camps.length;
    }

    private addCamp(name: string, center: Point, spots: readonly Spot[], min = this.settings.minPerCamp, max = this.settings.maxPerCamp, respawn?: readonly [number, number], chief = true): void {
        const count = Math.max(min, Math.min(max, spots.length));
        const archers = archersFor(count);
        const veterans = Math.min(veteransFor(count), count - archers);
        const slots: Slot[] = [];
        for (let index = 0; index < count; index += 1) {
            const base = spots[index % spots.length]!;
            // A spot used a second time is moved a little, so two bandits do not stand in one another.
            const lap = Math.floor(index / spots.length);
            const position = lap === 0 ? base.position : { x: base.position.x + 1.5 * lap, y: base.position.y + 1.5 * lap, z: base.position.z };
            // The first man of a camp or a hideout is its chief (2026-11-01), a veteran too; a gang of the roads has none.
            const isChief = chief && index === 0 && count >= 3 && index < count - archers;
            slots.push({ spot: { position, soul: base.soul }, archer: index >= count - archers, veteran: index < veterans, ...(isChief ? { chief: true } : {}), npcId: null, state: "vacant", deathAt: 0, target: null, retryAt: 0 });
        }
        this.camps.push({ id: this.camps.length + 1, name, center, slots, chests: [], scanned: false, chestsFilledAt: 0, alarm: null, ...(respawn === undefined ? {} : { respawn }) });
    }

    /**
     * Adds hideouts in the wild, on top of the level's camps (`chooseWildSites` says where). Each is a few bandits standing
     * about a point of the walkable ground, in the souls the level's own bandits come in. `people` are the places where the
     * level puts ordinary people, which a hideout keeps away from. Returns how many hideouts were added.
     */
    addWild(candidates: readonly WildCandidate[], people: readonly Point[], reach: Reach = NAVIGATION): number {
        const chosen = chooseWildSites(candidates, people, this.camps.map((camp) => camp.center), reach, this.settings);
        const souls = this.souls();
        let hideouts = this.camps.filter((camp) => camp.name.startsWith("Esconderijo")).length;
        for (const { centre } of chosen) {
            const count = this.between(this.settings.wildMinPerCamp, this.settings.wildMaxPerCamp);
            const spots: Spot[] = [];
            for (let index = 0; index < count; index += 1) {
                // Walkable ground about the centre; failing that, a ring round it.
                const angle = (index / count) * 2 * Math.PI;
                const ring = { x: centre.x + 3 * Math.cos(angle), y: centre.y + 3 * Math.sin(angle), z: centre.z };
                spots.push({ position: reach.around(centre, this.settings.wildSpotRadius) ?? ring, soul: this.pick(souls) });
            }
            hideouts += 1;
            this.addCamp(`Esconderijo ${hideouts}`, centre, spots, this.settings.wildMinPerCamp, this.settings.wildMaxPerCamp);
        }
        return chosen.length;
    }

    /**
     * Adds gangs on the roads, at the places `chooseRoadSites` keeps (2026-10-24): three or four bandits about each, in the souls the level's
     * own bandits come in, an archer among them from three. `people` are the places where the level puts ordinary people. Returns how many gangs
     * were added.
     */
    addRoads(candidates: readonly WildCandidate[], people: readonly Point[], reach: Reach = NAVIGATION): number {
        const chosen = chooseRoadSites(candidates, people, this.camps.map((camp) => camp.center), reach, this.settings);
        const souls = this.souls();
        let posts = this.camps.filter((camp) => camp.name.startsWith("Estrada")).length;
        for (const { centre } of chosen) {
            const count = this.between(this.settings.roadMinPerPost, this.settings.roadMaxPerPost);
            const spots: Spot[] = [];
            for (let index = 0; index < count; index += 1) {
                const angle = (index / count) * 2 * Math.PI;
                const ring = { x: centre.x + 3 * Math.cos(angle), y: centre.y + 3 * Math.sin(angle), z: centre.z };
                spots.push({ position: reach.around(centre, this.settings.roadSpotRadius) ?? ring, soul: this.pick(souls) });
            }
            posts += 1;
            this.addCamp(`Estrada ${posts}`, centre, spots, this.settings.roadMinPerPost, this.settings.roadMaxPerPost, this.settings.roadRespawnMs, false);
        }
        return chosen.length;
    }

    /**
     * What one bandit wears and carries: plain clothes, a cheap weapon, a few coins and a bite to eat. A camp's (`bow`) has a bow and arrows besides his blade; a veteran, a chief
     * and (with `armourAll`) every bandit a set of armour (`armourRows`), all of it loot since 2026-11-02; rows marked `strip` (the second bow of a camp's man) are taken off his body when he falls.
     */
    inventoryFor(archer: boolean, options: { readonly veteran?: boolean; readonly bow?: boolean; readonly chief?: string } = {}): Row[] {
        const tier: KitTier = options.chief !== undefined && !archer ? "chief" : archer ? "archer" : options.veteran === true ? "veteran" : "plain";
        const armoured = tier === "chief" || tier === "veteran" || this.settings.armourAll;
        const items: Row[] = armoured
            ? this.armourRows(tier)
            : [
                  { item: this.pick(TUNICS), amount: 1, equipped: 1 },
                  { item: this.pick(HOSE), amount: 1, equipped: 1 },
                  { item: this.pick(HEADS), amount: 1, equipped: 1 },
              ];
        if (!armoured && tier !== "archer" && this.random() < 0.4) {
            items.push({ item: this.pick(COATS), amount: 1, equipped: 1 });
        }
        if (tier === "archer") {
            const arrows = this.between(10, 20);
            items.push({ item: BOW, amount: 1, equipped: 1 }, { item: ARROWS, amount: arrows, equipped: arrows });
        } else {
            // A veteran and a chief carry a better blade, and it is not loot either.
            items.push(
                tier === "chief" && options.chief !== undefined
                    ? { item: options.chief, amount: 1, equipped: 1 }
                    : tier === "veteran"
                      ? { item: this.pick(VETERAN_MELEE), amount: 1, equipped: 1 }
                      : { item: this.pick(MELEE), amount: 1, equipped: 1 },
            );
            if (options.bow === true && tier !== "chief") {
                const arrows = this.between(8, 14);
                items.push({ item: BOW, amount: 1, equipped: 1, strip: true }, { item: ARROWS, amount: arrows, equipped: arrows, strip: true });
            }
        }
        // The game shows a tenth of the item's amount: 20 to 80 reads as 2 to 8 coins (5 to 20 before 2026-10-25); a chief's purse is 40 to 90.
        items.push({ item: "money", amount: tier === "chief" ? this.between(400, 900) : this.between(20, 80) });
        if (this.random() < CARRIED_FOOD_CHANCE) {
            items.push({ item: this.pick(FOOD), amount: 1 });
        }
        if (tier !== "chief" && this.random() < CARRIED_GOODS_CHANCE) {
            const entry = this.pick(CHEST_LOOT);
            items.push({ item: this.pick(entry.items), amount: this.between(entry.min, Math.max(entry.min, Math.ceil(entry.max / 2))) });
        }
        return items;
    }

    /**
     * The armour of a bandit by his tier (2026-11-02), as the game's own outfits of bandits are put together and in the order they are dressed (`equipment-rules.ts`): the
     * hose (his own clothes: loot) under a gambeson, never a tunic; a padded coif under a hood or a helmet; the mail, the brigandine and the arm armour over the gambeson; boots
     * and gloves. An archer is in a short gambeson and a coif, light on his feet; a plain bandit adds a long gambeson now and then; a veteran has a helmet over a mail coif, mail
     * most of the time and rondels; a chief the bascinet, mail, the brigandine, rondels and gauntlets. Not loot: every piece but the hose and the hood.
     */
    private armourRows(tier: KitTier): Row[] {
        // The condition of the armour, as the game's own outfits of bandits have it (`Condition` 0.35 to 0.84, 0.58 on the average): a chief's sound, a veteran's worn, the rest's battered.
        const [least, spread] = tier === "chief" ? [0.75, 0.2] : tier === "veteran" ? [0.45, 0.2] : [0.35, 0.15];
        const worn = (item: string): Row => ({ item, amount: 1, equipped: 1, metadata: { condition: Math.round((least + this.random() * spread) * 100) / 100 } });
        const rows: Row[] = [{ item: this.pick(HOSE), amount: 1, equipped: 1 }];
        if (tier === "chief") {
            rows.push(worn(this.pick(GAMBESON_LONG)), worn(this.pick(COIF_MAIL)), worn(CHIEF_HEAD), worn(VETERAN_MAIL[0] as string), worn(CHIEF_PLATE), worn(VETERAN_ARMS[0] as string), worn(CHIEF_GAUNTLETS), worn(BOOTS[0] as string));
        } else if (tier === "veteran") {
            rows.push(worn(this.pick(GAMBESON_LONG)), worn(this.pick(COIF_MAIL)), worn(this.pick(VETERAN_HEADS)), worn(this.pick(VETERAN_ARMS)), worn(this.pick(BOOTS)), worn(GLOVES));
            if (this.random() < 0.6) {
                rows.push(worn(this.pick(VETERAN_MAIL)));
            }
        } else if (tier === "plain") {
            rows.push(worn(this.pick(this.random() < 0.4 ? GAMBESON_LONG : GAMBESON_SHORT)), worn(this.pick(COIF_SOFT)), { item: this.pick(HOODS), amount: 1, equipped: 1 });
            if (this.random() < 0.6) {
                rows.push(worn(this.pick(BOOTS)));
            }
            if (this.random() < 0.3) {
                rows.push(worn(GLOVES));
            }
        } else {
            rows.push(worn(this.pick(GAMBESON_SHORT)), worn(this.pick(COIF_SOFT)), { item: this.pick(HOODS), amount: 1, equipped: 1 }, worn(this.pick(BOOTS)));
        }
        return dressingOrder(rows, (row) => row.item);
    }

    /** The chief's soul and weapon of a camp: the same every start, one of `CHIEF_SOULS` and one of `CHIEF_WEAPONS` by the camp's name. */
    chiefOf(camp: Camp): { soul: string; weapon: string } {
        const hash = stableHash(`${camp.name}#chefe`);
        return { soul: CHIEF_SOULS[hash % CHIEF_SOULS.length] ?? "bandit", weapon: CHIEF_WEAPONS[Math.floor(hash / 7) % CHIEF_WEAPONS.length] ?? CHIEF_WEAPONS[0]! };
    }

    /** Two to four different kinds of guild goods (three to six before 2026-10-25), and now and then a piece of clothing. */
    chestLoot(): { item: string; amount: number }[] {
        const rows: { item: string; amount: number }[] = [];
        const wanted = this.between(2, 4);
        const total = CHEST_LOOT.reduce((sum, entry) => sum + entry.weight, 0);
        for (let guard = 0; rows.length < wanted && guard < 40; guard += 1) {
            let left = this.random() * total;
            let entry = CHEST_LOOT[0]!;
            for (const candidate of CHEST_LOOT) {
                left -= candidate.weight;
                if (left <= 0) {
                    entry = candidate;
                    break;
                }
            }
            const item = this.pick(entry.items);
            if (!rows.some((row) => row.item === item)) {
                rows.push({ item, amount: this.between(entry.min, entry.max) });
            }
        }
        if (this.random() < 0.2) {
            rows.push({ item: this.pick(CLOTHES), amount: 1 });
        }
        return rows;
    }

    private failed(code: string): void {
        this.failures.set(code, (this.failures.get(code) ?? 0) + 1);
    }

    /**
     * Offers rows one at a time, keeping those the game takes. Each try replaces the whole stock and a refused one
     * changes nothing, so what stays is the last lot that was taken. Returns the rows kept and the ones refused.
     */
    private oneByOne<T>(rows: readonly T[], take: (rows: T[]) => boolean): { kept: T[]; refused: T[] } {
        const kept: T[] = [];
        const refused: T[] = [];
        for (const row of rows) {
            if (take([...kept, row])) {
                kept.push(row);
            } else {
                refused.push(row);
            }
        }
        return { kept, refused };
    }

    /**
     * Dresses and stocks a new bandit. When the game refuses the lot (a garment that body cannot wear, two in one
     * place), the worn things are offered one by one and the bandit goes without the ones refused. When it takes none
     * of them the bandit is left in the clothes its soul came with rather than stripped.
     */
    private stock(npc: Npc, archer: boolean): void {
        this.stockWith(npc, this.inventoryFor(archer));
    }

    private stockWith(npc: Npc, wanted: Row[]): void {
        // What the game's tables do not know leaves a hole in a set of armour; a piece whose base is missing (a helmet with no coif) is taken out too, since the game's dressing of a
        // body whose armour does not fit is refused on the player's game, and the body rolled back: a bandit nobody can see (`equipment-rules.ts`, 2026-11-02).
        const fitted = fitKit(this.byClass(wanted), (row) => row.name);
        for (const row of fitted.dropped) {
            this.refusedGear.set(row.name, (this.refusedGear.get(row.name) ?? 0) + 1);
        }
        const rows = fitted.kept;
        const send = (list: readonly Classed[]): InventoryResult =>
            Inventory.set(npc, {
                items: list.map(({ item, amount, equipped, metadata }) => ({ item, amount, ...(equipped === undefined ? {} : { equipped }), ...(metadata === undefined ? {} : { metadata }) })),
                harvested: false,
            });
        const whole = send(rows);
        if (whole.ok) {
            return;
        }
        const worn = rows.filter((row) => (row.equipped ?? 0) > 0);
        const loose = rows.filter((row) => (row.equipped ?? 0) === 0);
        const tried = this.oneByOne(worn, (list) => send(list).ok);
        // What the body took one piece at a time may have lost a piece another stands on (the coif under the helmet): that one goes too.
        const refit = fitKit(tried.kept, (row) => row.name);
        const kept = refit.kept;
        const refused = [...tried.refused, ...refit.dropped];
        if (kept.length === 0) {
            this.failed(`roupa e arma: ${whole.code}`);
            return;
        }
        for (const row of refused) {
            this.refusedGear.set(row.name, (this.refusedGear.get(row.name) ?? 0) + 1);
        }
        const result = send([...kept, ...loose]);
        if (!result.ok) {
            this.failed(`dinheiro e comida: ${result.code}`);
        }
    }

    /** What is wrong with the armour of a list of rows, if anything (`equipment-rules.ts`): for the tests and the matrix. */
    kitProblemsOf(rows: readonly Row[]): string[] {
        return kitProblems(rows.map((row) => row.item));
    }

    /** Dresses and arms a bandit made elsewhere (the road's, `ambush.ts`) as the camps' own are. */
    dress(npc: Npc, archer: boolean): void {
        this.stock(npc, archer);
    }

    /** What a Cuman of the roads wears and carries. */
    cumanInventory(archer: boolean): Row[] {
        const items: Row[] = [
            { item: this.pick(CUMAN_TUNICS), amount: 1, equipped: 1 },
            { item: this.pick(HOSE), amount: 1, equipped: 1 },
            { item: this.pick(CUMAN_BOOTS), amount: 1, equipped: 1 },
        ];
        if (this.random() < 0.2) {
            items.push({ item: CUMAN_COIF, amount: 1, equipped: 1 }, { item: CUMAN_HELMET, amount: 1, equipped: 1 });
        } else {
            items.push({ item: this.pick(CUMAN_HEADS), amount: 1, equipped: 1 });
        }
        if (archer) {
            const arrows = this.between(12, 24);
            items.push({ item: CUMAN_BOW, amount: 1, equipped: 1 }, { item: ARROWS, amount: arrows, equipped: arrows });
        } else {
            items.push({ item: this.pick(CUMAN_MELEE), amount: 1, equipped: 1 });
            if (this.random() < 0.4) {
                items.push({ item: this.pick(CUMAN_SHIELDS), amount: 1, equipped: 1 });
            }
        }
        items.push({ item: "money", amount: this.between(30, 100) });
        if (this.random() < CARRIED_GOODS_CHANCE) {
            const entry = this.pick(CHEST_LOOT);
            items.push({ item: this.pick(entry.items), amount: this.between(entry.min, Math.max(entry.min, Math.ceil(entry.max / 2))) });
        }
        return items;
    }

    /** Dresses and arms a Cuman of the roads (`ambush.ts`). */
    dressCuman(npc: Npc, archer: boolean): void {
        this.stockWith(npc, this.cumanInventory(archer));
    }

    /** The souls the level gives its bandits, to make more of them; the generic one when it gives none. */
    souls(): string[] {
        const found = [...new Set(this.camps.flatMap((camp) => camp.slots.map((slot) => slot.spot.soul)).filter((soul) => soul !== ""))];
        return found.length > 0 ? found : ["bandit"];
    }

    /** Fills one camp chest. Goods the game will not take are left out, and left out of later fills too. */
    private fill(stash: Stash): boolean {
        const rows = this.byClass(this.chestLoot().filter((row) => !this.refusedLoot.has(row.item)));
        if (rows.length === 0) {
            this.failed("baú: nada que o jogo conheça");
            return false;
        }
        const send = (list: readonly Classed[]): InventoryResult => stash.setInventory({ items: list.map(({ item, amount }) => ({ item, amount })) });
        const whole = send(rows);
        if (whole.ok) {
            return true;
        }
        const { kept, refused } = this.oneByOne(rows, (list) => send(list).ok);
        if (kept.length === 0) {
            this.failed(`baú: ${whole.code}`);
            return false;
        }
        refused.forEach((row) => this.refusedLoot.add(row.name));
        return true;
    }

    /** What the game refused since the start, for the log. */
    report(): string[] {
        const lines: string[] = [];
        if (this.unknownNames.size > 0) {
            lines.push(`nomes que o jogo não conhece: ${[...this.unknownNames].join(", ")}`);
        }
        if (this.refusedGear.size > 0) {
            lines.push(`o jogo não vestiu: ${[...this.refusedGear].map(([item, times]) => `${item} (${times}x)`).join(", ")}`);
        }
        if (this.refusedLoot.size > 0) {
            lines.push(`os baús não aceitaram: ${[...this.refusedLoot].join(", ")}`);
        }
        if (this.failures.size > 0) {
            lines.push(`recusado por inteiro: ${[...this.failures].map(([code, times]) => `${code} (${times}x)`).join(", ")}`);
        }
        return lines;
    }

    private snap(point: Point): Vector3 {
        const raw = new Vector3(point.x, point.y, point.z);
        if (Navigation.ready) {
            const snapped = Navigation.closestPoint(raw, { searchRadius: 6, searchHeight: 10, doors: "none" });
            if (snapped !== null) {
                return snapped;
            }
        }
        return raw;
    }

    /** Puts a bandit in a slot. True when it stands there now. */
    spawn(camp: Camp, slot: Slot): boolean {
        try {
            const chief = slot.chief === true ? this.chiefOf(camp) : null;
            const health = chief !== null ? this.settings.chiefHealth : slot.veteran === true ? this.settings.veteranHealth : this.settings.health;
            const npc = Npc.create({
                soul: chief?.soul ?? (slot.spot.soul || "bandit"),
                position: this.snap(slot.spot.position),
                rotation: new Vector3(0, 0, this.random() * 360),
                name: chief !== null ? "Chefe dos bandidos" : slot.archer ? "Bandido arqueiro" : slot.veteran === true ? "Bandido veterano" : "Bandido",
                nametag: false,
                interactable: false,
                lootable: true,
                health,
                maxHealth: health,
            });
            const rows = this.inventoryFor(slot.archer, { veteran: slot.veteran === true, bow: !slot.archer && chief === null, ...(chief === null ? {} : { chief: chief.weapon }) });
            this.stockWith(npc, rows);
            slot.strip = this.byClass(rows.filter((row) => row.strip === true)).map((row) => row.item);
            slot.potions = chief !== null ? this.settings.chiefPotions : slot.archer ? this.settings.archerPotions : slot.veteran === true ? this.settings.veteranPotions : this.settings.potions;
            slot.retreated = undefined;
            slot.retreatUntil = undefined;
            slot.rageUntil = undefined;
            slot.stealing = undefined;
            slot.tauntAt = undefined;
            slot.potionAt = 0;
            slot.finishAt = undefined;
            slot.finishBy = undefined;
            slot.mode = slot.archer ? "bow" : "melee";
            this.forgetFight(slot);
            slot.hurtBy = undefined;
            slot.hurtAt = undefined;
            slot.hasBow = !slot.archer && rows.some((row) => row.item === BOW);
            slot.noBowUntil = 0;
            slot.npcId = npc.id;
            slot.state = "alive";
            slot.target = null;
            slot.retryAt = 0;
            delete slot.respawnWait;
            this.bySlot.set(npc.id, { camp, slot });
            return true;
        } catch (error: unknown) {
            console.log(`bandits: ${camp.name}: não consegui criar um bandido: ${error instanceof Error ? error.message : String(error)}`);
            slot.state = "dead";
            slot.deathAt = this.now();
            // A place that failed to be filled is tried again as a camp's is, not after the hours a gang's dead wait.
            slot.respawnWait = this.settings.respawnMs;
            return false;
        }
    }

    spawnAll(): number {
        let spawned = 0;
        for (const camp of this.camps) {
            for (const slot of camp.slots) {
                if (slot.state === "vacant" && this.spawn(camp, slot)) {
                    spawned += 1;
                }
            }
        }
        return spawned;
    }

    /** Finds each camp's containers once, then fills them. Returns how many containers were filled. */
    stockChests(force = false): number {
        let filled = 0;
        const stashes = this.camps.some((camp) => !camp.scanned) ? Stash.all() : [];
        for (const camp of this.camps) {
            if (!camp.scanned) {
                camp.scanned = true;
                camp.chests = stashes
                    .filter((stash) => stash.levelGuid !== "" && CONTAINER.test(stash.name) && !NOT_STORES.test(stash.name) && flat(stash.position, camp.center) <= this.settings.chestRadius && propertyOfStash(stash.levelGuid) === null)
                    .map((stash) => stash.levelGuid);
            }
            if (!force && this.now() - camp.chestsFilledAt < this.settings.chestRefillMs) {
                continue;
            }
            if (!force && this.playersNear(camp.center, this.settings.chestClearRadius)) {
                continue;
            }
            for (const guid of camp.chests) {
                const stash = Stash.find(guid);
                if (stash === null) {
                    this.failed("baú: não encontrado");
                } else if (!stash.isOpen && this.fill(stash)) {
                    filled += 1;
                }
            }
            camp.chestsFilledAt = this.now();
        }
        return filled;
    }

    private players(): Array<{ player: Player; position: Point }> {
        return Player.all()
            // The world everybody plays in is the global one (4294967295); a test against 0 alone left every real player out, and with
            // them every bandit never saw anybody (user, 2026-10-18: "os bandidos estão estáticos").
            .filter((player) => player.ready && player.alive && (player.virtualWorld === 0 || player.virtualWorld === 0xffffffff))
            .map((player) => ({ player, position: player.position }));
    }

    private playersNear(point: Point, radius: number): boolean {
        return this.players().some((entry) => flat(entry.position, point) <= radius);
    }

    // -----------------------------------------------------------------------------------------
    // Events.

    isBandit(npcId: number): boolean {
        return this.bySlot.has(npcId);
    }

    isVeteran(npcId: number): boolean {
        return this.bySlot.get(npcId)?.slot.veteran === true;
    }

    isChief(npcId: number): boolean {
        return this.bySlot.get(npcId)?.slot.chief === true;
    }

    /** How much heavier this bandit's blow on a player is than an ordinary man's: the camp's hand, the veteran's or the chief's, and his rage after his chief fell. */
    handOf(npcId: number): number {
        const entry = this.bySlot.get(npcId);
        if (entry === undefined) {
            return 1;
        }
        const own = entry.slot.chief === true ? this.settings.chiefDamage : entry.slot.veteran === true ? this.settings.veteranDamage : 1;
        const rage = this.now() < (entry.slot.rageUntil ?? 0) ? this.settings.rageDamage : 1;
        return this.settings.damageMultiplier * own * rage;
    }

    died(npcId: number, killer?: Player): void {
        const entry = this.bySlot.get(npcId);
        if (entry !== undefined && entry.slot.state === "alive") {
            // The killing blow's player fought him, whichever event came first.
            if (killer !== undefined) {
                (entry.slot.hitters ??= new Map()).set(killer.id, this.now());
            }
            const fought = entry.slot.target;
            entry.slot.state = "dead";
            entry.slot.deathAt = this.now();
            entry.slot.target = null;
            entry.slot.finishAt = undefined;
            entry.slot.finishBy = undefined;
            const corpse = Npc.getById(npcId);
            if (corpse !== null && (entry.slot.strip?.length ?? 0) > 0) {
                this.strip(corpse, entry.slot.strip ?? []);
            }
            if (corpse !== null) {
                sharePurse(corpse, entry.slot.hitters, this.now(), this.settings);
            }
            entry.slot.hitters = undefined;
            if (entry.camp.theft?.npcId === npcId) {
                this.endTheft(entry.camp, "o ladrão caiu");
            }
            if (fought !== null) {
                this.mourn(entry.camp, entry.slot);
            }
        }
    }

    /**
     * A man of a camp fell in a fight: the one of his fellows nearest the fight cries for him; and a chief's fall breaks the camp (2026-11-01): the men badly hurt run, and the
     * rest are enraged for a while.
     */
    private mourn(camp: Camp, fallen: Slot): void {
        const now = this.now();
        const fighting = camp.slots.filter((slot) => slot !== fallen && slot.state === "alive" && slot.npcId !== null && slot.target !== null);
        if (fallen.chief !== true) {
            const voice = fighting[0];
            if (voice !== undefined) {
                this.bark(voice, "fallen", camp);
            }
            return;
        }
        let fled = 0;
        let enraged = 0;
        for (const slot of fighting) {
            const npc = Npc.getById(slot.npcId ?? -1);
            if (npc === null || !npc.alive) {
                continue;
            }
            const target = slot.target === null ? null : Player.getById(slot.target);
            if (npc.maxHealth > 0 && npc.health <= npc.maxHealth * this.settings.chiefFleeBelow && target !== null && npc.flee(target, { speed: this.settings.chaseSpeed, radius: 25 })) {
                slot.retreated = true;
                slot.retreatUntil = now + this.settings.retreatMs * 2;
                this.bark(slot, "chiefFell", camp);
                fled += 1;
            } else {
                slot.rageUntil = now + this.settings.rageMs;
                this.bark(slot, "rage", camp);
                enraged += 1;
            }
        }
        console.log(`bandits: ${camp.name}: o chefe caiu; ${fled} fugiram, ${enraged} enfurecidos`);
    }

    /** Takes off a fallen bandit what is not loot (the veteran's armour, the second bow): what is left on him is his clothes, blade and purse. */
    private strip(corpse: Npc, classes: readonly string[]): number {
        try {
            const wanted = new Set(classes.map((item) => item.toLowerCase()));
            const units = (Inventory.get(corpse)?.items ?? []).filter((row) => wanted.has(String(row.item).toLowerCase())).map((row) => ({ id: row.id, amount: row.amount }));
            if (units.length === 0) {
                return 0;
            }
            return Inventory.remove(corpse, { units, notify: false }).ok ? units.length : 0;
        } catch {
            return 0;
        }
    }

    /**
     * A bandit left with next to nothing is finished (2026-10-27: "matei um bandido com combo e ele bugou, ficou caído no chão mas não morreu"). The archer of a road gang
     * went from 25 to 3 of 180 and lay there alive: the game lays a body down at the edge of death, where no blow lands, and the server's ledger never reaches zero (the
     * same as the animals', `animals.ts`). A man at or below `finishBelow` of his health is held where he is and killed a moment later, for the last who struck him. True
     * while he is being finished (nothing else is done for him), and when he has just been.
     */
    finishOff(slot: Slot, npc: Npc, now: number, attacker?: Player): boolean {
        if (slot.finishAt !== undefined) {
            if (now < slot.finishAt) {
                return true;
            }
            const by = slot.finishBy;
            slot.finishAt = undefined;
            slot.finishBy = undefined;
            if (npc.alive) {
                npc.kill(by);
            }
            return true;
        }
        if (!npc.alive || !(npc.maxHealth > 0) || npc.health > Math.max(this.settings.finishPoints, npc.maxHealth * this.settings.finishBelow)) {
            return false;
        }
        // A man who still has a draught drinks it before anything: it is what he does when he is this hurt, and what stands him up again.
        if (this.drink(slot, npc)) {
            return false;
        }
        slot.finishAt = now + this.settings.finishAfterMs;
        slot.finishBy = attacker?.id ?? slot.target ?? undefined;
        npc.hold();
        return true;
    }

    /**
     * A bandit badly hurt drinks a draught, while he has one: a good part of his health back, and a shout. True when he drank.
     */
    drink(slot: Slot, npc: Npc): boolean {
        const now = this.now();
        if ((slot.potions ?? 0) <= 0 || now < (slot.potionAt ?? 0) || !npc.alive || !(npc.maxHealth > 0) || !(npc.health <= npc.maxHealth * this.settings.potionBelow)) {
            return false;
        }
        slot.potions = (slot.potions ?? 0) - 1;
        slot.potionAt = now + this.settings.potionEveryMs;
        npc.health = Math.min(npc.maxHealth, npc.health + npc.maxHealth * this.settings.potionHeal);
        speak(npc, nameOfSlot(slot), BARKS.potion[Math.floor(this.random() * BARKS.potion.length)] ?? "", { radiusM: this.settings.shoutM });
        this.shout(npc, "potion");
        return true;
    }

    /**
     * What a bandit should fight with at this range: the bow for an archer; for one with a bow and a blade, the bow once his man is farther than
     * `bowFromM`, and the blade again once he is nearer than `meleeFromM` (the gap keeps him from changing at every step); the blade alone for
     * one whose bow the game refused a moment ago.
     */
    weaponFor(slot: Slot, range: number): "melee" | "bow" {
        if (slot.archer) {
            return "bow";
        }
        if (slot.hasBow !== true || this.now() < (slot.noBowUntil ?? 0)) {
            return "melee";
        }
        if (slot.mode === "bow") {
            return range < this.settings.meleeFromM ? "melee" : "bow";
        }
        return range > this.settings.bowFromM ? "bow" : "melee";
    }

    /** Orders a bandit who fights hand to hand to fight with the weapon the range asks for, falling back on the blade. True when the order went out. */
    private order(slot: Slot, npc: Npc, player: Player, range: number): boolean {
        if (this.weaponFor(slot, range) === "bow") {
            if (npc.attack(player, { weapon: "bow" })) {
                slot.mode = "bow";
                return true;
            }
            slot.noBowUntil = this.now() + 30_000;
        }
        const ordered = npc.attack(player);
        if (ordered) {
            slot.mode = "melee";
        }
        return ordered;
    }

    removed(npcId: number): void {
        const entry = this.bySlot.get(npcId);
        if (entry === undefined) {
            return;
        }
        this.bySlot.delete(npcId);
        if (entry.slot.npcId === npcId) {
            if (entry.slot.state === "alive") {
                entry.slot.deathAt = this.now();
            }
            entry.slot.state = "dead";
            entry.slot.npcId = null;
        }
    }

    /**
     * A bandit was hit by a player: the whole camp turns on them for a while, and he curses. And he is ordered to fight there and then,
     * not at the next look a second later: struck, the game's own reaction is fright, and the bandits of 2026-10-21 "corriam quando eu
     * batia neles, pareciam NPC"; an order to fight given right after the blow takes the place of it.
     */
    hit(npcId: number, attacker: Player): void {
        const entry = this.bySlot.get(npcId);
        if (entry === undefined) {
            return;
        }
        const now = this.now();
        entry.camp.alarm = { targetId: attacker.id, until: now + this.settings.alarmMs };
        // He knows who struck him, whatever the distance, and needs no reaction: he is in the fight, and a voice for the men near him.
        entry.slot.hurtBy = attacker.id;
        entry.slot.hurtAt = now;
        // Struck, a man of the blade holds his ground for a while (2026-11-04): he does not walk back to the ring five seconds after the blow.
        if (!entry.slot.archer) {
            entry.slot.committedUntil = now + this.settings.commitMs;
        }
        (entry.slot.hitters ??= new Map()).set(attacker.id, now);
        entry.slot.reactTo = attacker.id;
        entry.slot.reactAt = now;
        this.bark(entry.slot, entry.slot.chief === true ? "chiefHurt" : "hurt", entry.camp);
        if (entry.camp.theft?.npcId === npcId) {
            this.endTheft(entry.camp, "o ladrão foi atacado");
        }
        const npc = Npc.getById(npcId);
        if (npc === null || !npc.alive) {
            return;
        }
        // Next to nothing left: he is finished, not ordered to fight.
        if (this.finishOff(entry.slot, npc, now, attacker)) {
            return;
        }
        if (now < (entry.slot.hitOrderAt ?? 0)) {
            return;
        }
        entry.slot.hitOrderAt = now + this.settings.hitOrderMs;
        const before = npc.simulator;
        const moved = this.runBy(entry.slot, npc, attacker);
        if (moved) {
            const there = before === null || before === undefined ? "ninguém o rodava" : `o jogo de ${before.nickname}, a ${Math.round(flat(before.position, npc.position))} m dele, o rodava`;
            this.note(entry.camp, npc, attacker, `preso ao jogo de quem bate (${there})`);
        }
        this.drink(entry.slot, npc);
        const range = flat(npc.position, attacker.position);
        const ordered = entry.slot.archer ? (range > this.settings.chaseFromM && npc.attack(attacker, { weapon: "bow" })) || npc.attack(attacker) : this.order(entry.slot, npc, attacker, range);
        if (ordered) {
            entry.slot.target = attacker.id;
            entry.slot.retryAt = now + this.settings.retryMs;
            entry.slot.role = entry.slot.archer ? "bow" : "front";
        }
        this.note(entry.camp, npc, attacker, `atingido (vida ${Math.round(npc.health)}/${Math.round(npc.maxHealth)}): ataque ${ordered ? "reordenado" : "RECUSADO"}`);
    }

    /**
     * Whoever strikes a bandit runs him, when his own runner is far from him (see `runnerFarM`): the blow is judged by the game that runs the one struck, so a
     * blow at a man run from sixty metres away came to nothing. Never taken from a runner who is near him, so two players at one man do not pull him between
     * their games. True when he was given to the attacker.
     */
    private runBy(slot: Slot, npc: Npc, attacker: Player): boolean {
        const runner = npc.simulator;
        if (runner !== null && runner !== undefined && (runner.id === attacker.id || flat(runner.position, npc.position) <= this.settings.runnerFarM)) {
            return false;
        }
        if (flat(attacker.position, npc.position) > this.settings.runnerNearM) {
            return false;
        }
        npc.pin(attacker);
        slot.pinned = true;
        return true;
    }

    /**
     * A bandit says a line of `kind`, no oftener than every `BARK_EVERY_MS`; a line that answers nothing (a taunt, the ring's call) waits too for the camp's `campBarkGapMs`, so
     * that a camp does not speak all at once. His shout is heard on the games near him (`shout`). True when he spoke.
     */
    private bark(slot: Slot, kind: BarkKind, camp?: Camp): boolean {
        const now = this.now();
        if (slot.npcId === null || (now < (slot.barkAt ?? 0) && !ONCE_BARKS.has(kind))) {
            return false;
        }
        const urgent = URGENT_BARKS.has(kind);
        if (!urgent && camp !== undefined && now < (camp.barkAt ?? 0)) {
            return false;
        }
        const npc = Npc.getById(slot.npcId);
        if (npc === null || !npc.alive) {
            return false;
        }
        slot.barkAt = now + BARK_EVERY_MS;
        if (camp !== undefined) {
            camp.barkAt = now + this.settings.campBarkGapMs;
        }
        const lines = BARKS[kind];
        // Over the body, and in the chat card of those within earshot (`npc-speech.ts`, 2026-11-02: the game's line over the body was not seen).
        speak(npc, nameOfSlot(slot), lines[Math.floor(this.random() * lines.length)] ?? "", { radiusM: this.settings.shoutM });
        this.shout(npc, kind);
        return true;
    }

    /** The game's own voice for a line of `kind`, played at the man on the games of the players within `shoutM` (`SHOUT_EVENT`). */
    private shout(npc: Npc, kind: BarkKind): void {
        const triggers = SHOUTS[kind];
        if (triggers.length === 0) {
            return;
        }
        const trigger = triggers[Math.floor(this.random() * triggers.length)] ?? triggers[0]!;
        const at = npc.position;
        const payload = JSON.stringify({ t: trigger, x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100, z: Math.round((at.z + 1.6) * 100) / 100 });
        for (const entry of this.players()) {
            if (flat(entry.position, at) <= this.settings.shoutM) {
                try {
                    entry.player.emit(SHOUT_EVENT, payload);
                } catch {
                    // Gone.
                }
            }
        }
    }

    // -----------------------------------------------------------------------------------------

    tick(): void {
        if (!this.running) {
            return;
        }
        const now = this.now();
        const players = this.players().filter((entry) => entry.player.canAct);
        // The players' horses, read once a round and only when a camp looks for one to take.
        let horses: Horse[] | null = null;
        const horsesNow = (): Horse[] => {
            if (horses === null) {
                try {
                    horses = Horse.all();
                } catch {
                    horses = [];
                }
            }
            return horses;
        };
        for (const camp of this.camps) {
            const near = players.filter((entry) => flat(entry.position, camp.center) <= this.settings.activationRadius);
            const alarm = camp.alarm !== null && camp.alarm.until > now ? camp.alarm : null;
            if (camp.alarm !== null && alarm === null) {
                camp.alarm = null;
            }
            // The alarm is heard by the men near one who is already in the fight, not by the whole camp at once.
            const voices = alarm === null || near.length === 0 ? [] : this.voicesOf(camp, alarm.targetId, now);
            const acting: Acting[] = [];
            // How many of the camp are after each player, for spreading them out (2026-11-02): kept up as men change their man this round.
            const onPlayer = new Map<number, number>();
            for (const one of camp.slots) {
                if (one.state === "alive" && one.target !== null && !one.archer) {
                    onPlayer.set(one.target, (onPlayer.get(one.target) ?? 0) + 1);
                }
            }

            for (const slot of camp.slots) {
                if (slot.state !== "alive") {
                    this.tendDead(camp, slot, now);
                    continue;
                }
                const npc = slot.npcId === null ? null : Npc.getById(slot.npcId);
                if (npc === null) {
                    continue;
                }
                if (!npc.alive) {
                    this.died(npc.id);
                    continue;
                }
                if (this.finishOff(slot, npc, now)) {
                    continue;
                }
                if (near.length === 0) {
                    if (slot.pinned === true) {
                        slot.pinned = false;
                        slot.pinnedTo = undefined;
                        npc.pin(null);
                    }
                    continue;
                }
                this.keepRunning(slot, npc, near);
                if (slot.stealing === true) {
                    continue;
                }
                const inLeash = (entry: { position: Point }): boolean => flat(entry.position, camp.center) <= this.settings.leashRadius;
                const here = npc.position;
                const position: Point = { x: here.x, y: here.y, z: here.z };

                let target = slot.target === null ? undefined : near.find((entry) => entry.player.id === slot.target && inLeash(entry));
                // Who struck him he knows, wherever they stand; the camp's alarm he hears only if he is near a man who fights.
                let heard: number | null = null;
                if (target === undefined && slot.hurtBy !== undefined && now - (slot.hurtAt ?? Number.NEGATIVE_INFINITY) < this.settings.alarmMs) {
                    const struck = slot.hurtBy;
                    target = near.find((entry) => entry.player.id === struck && inLeash(entry));
                }
                if (target === undefined && alarm !== null) {
                    let nearest = Number.POSITIVE_INFINITY;
                    for (const voice of voices) {
                        nearest = Math.min(nearest, flat(voice, position));
                    }
                    if (nearest <= this.settings.earshotM) {
                        target = near.find((entry) => entry.player.id === alarm.targetId && inLeash(entry));
                        if (target !== undefined) {
                            heard = nearest;
                        }
                    }
                }
                if (target === undefined) {
                    let best = this.settings.aggroRadius;
                    for (const entry of near) {
                        const range = flat(entry.position, position);
                        if (range <= best && inLeash(entry)) {
                            best = range;
                            target = entry;
                        }
                    }
                }

                // A man fighting one player and struck close by by another turns to the one who struck him; and one of many on one player goes for another, near, with fewer on him.
                if (target !== undefined && slot.target === target.player.id && now >= (slot.switchAt ?? 0)) {
                    const other = this.turnTo(slot, target, near, position, inLeash, onPlayer, now);
                    if (other !== undefined) {
                        onPlayer.set(target.player.id, Math.max(0, (onPlayer.get(target.player.id) ?? 1) - 1));
                        onPlayer.set(other.player.id, (onPlayer.get(other.player.id) ?? 0) + 1);
                        target = other;
                        slot.switchAt = now + this.settings.switchEveryMs;
                        slot.reactTo = other.player.id;
                        slot.reactAt = now;
                    }
                }

                // A man already fighting looks now and then for another player near him who is nearly down, and goes for him (2026-11-01).
                if (target !== undefined && slot.target === target.player.id && now >= (slot.weakAt ?? 0)) {
                    slot.weakAt = now + this.settings.weakEveryMs;
                    const weak = this.weakerNear(near, target, position, inLeash);
                    if (weak !== undefined) {
                        target = weak;
                        slot.reactTo = weak.player.id;
                        slot.reactAt = now;
                        this.bark(slot, "weak", camp);
                    }
                }

                if (target !== undefined) {
                    // A man who sees the player himself acts at once; one roused by the alarm answers after a moment of his own and the shout's travel.
                    if (slot.reactTo !== target.player.id) {
                        slot.reactTo = target.player.id;
                        slot.reactAt = heard === null ? now : now + this.reactionOf(camp, slot) + (heard / this.settings.alarmSpeedMps) * 1000;
                    }
                    if (now >= (slot.reactAt ?? 0)) {
                        acting.push({ slot, npc, target, position, range: flat(position, target.position), role: slot.archer ? "bow" : "front" });
                    }
                    continue;
                }

                this.forgetFight(slot);
                if (slot.target !== null) {
                    // His man got away: a word after him.
                    this.bark(slot, "chase", camp);
                    slot.target = null;
                    npc.hold();
                    slot.retryAt = 0;
                }
                if (flat(position, slot.spot.position) > this.settings.homeRadius && npc.status !== "running" && now >= slot.retryAt) {
                    npc.moveTo(slot.spot.position, { speed: "walk", radius: 2, pathfinding: "server" });
                    slot.retryAt = now + 10_000;
                } else if (npc.status !== "running" && now >= (slot.roamAt ?? 0)) {
                    this.stroll(slot, npc, now);
                }
            }
            if (acting.length > 0) {
                this.fight(camp, acting, near, alarm, now);
            }
            if (near.length > 0) {
                this.stealHorses(camp, near, now, horsesNow);
            }
        }
    }

    /** Where the men already in the fight with `targetId` stand: the voices the rest of the camp hears. */
    private voicesOf(camp: Camp, targetId: number, now: number): Point[] {
        const voices: Point[] = [];
        for (const slot of camp.slots) {
            if (slot.state !== "alive" || slot.npcId === null) {
                continue;
            }
            const struck = slot.hurtBy === targetId && now - (slot.hurtAt ?? Number.NEGATIVE_INFINITY) < this.settings.alarmMs;
            if (slot.target !== targetId && !struck) {
                continue;
            }
            const npc = Npc.getById(slot.npcId);
            if (npc !== null && npc.alive) {
                const at = npc.position;
                voices.push({ x: at.x, y: at.y, z: at.z });
            }
        }
        return voices;
    }

    /** How long a man takes to answer the alarm, apart from the shout's travel: his own, the same every time (between the two of `reactMs`). */
    private reactionOf(camp: Camp, slot: Slot): number {
        const [low, high] = this.settings.reactMs;
        return low + ((stableHash(`${camp.name}#${camp.slots.indexOf(slot)}`) % 1000) / 1000) * (high - low);
    }

    /** A man is in no fight: nothing he was told about one is true any more. */
    private forgetFight(slot: Slot): void {
        slot.reactTo = undefined;
        slot.reactAt = undefined;
        slot.role = undefined;
        slot.frontSince = undefined;
        slot.turnMs = undefined;
        slot.yieldedAt = undefined;
        slot.committedUntil = undefined;
        slot.switchAt = undefined;
        slot.ringGoal = undefined;
        slot.ringAt = undefined;
        slot.ringStill = undefined;
        slot.ringFails = undefined;
        slot.stalkStep = undefined;
        slot.stalkAt = undefined;
        slot.stalking = undefined;
        slot.spaceAt = undefined;
        slot.spacingUntil = undefined;
    }

    /**
     * The men of a camp who are after a player, sorted by whom they are after into a front line, archers and a ring (`assign`), and each ordered as his place asks: the front
     * line and the archers as before (`engage`), the ring to its spots round the player (`circle`).
     */
    private fight(camp: Camp, acting: Acting[], near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>, alarm: Camp["alarm"], now: number): void {
        const byTarget = new Map<number, Acting[]>();
        for (const one of acting) {
            const list = byTarget.get(one.target.player.id);
            if (list === undefined) {
                byTarget.set(one.target.player.id, [one]);
            } else {
                list.push(one);
            }
        }
        for (const group of byTarget.values()) {
            const target = (group[0] as Acting).target;
            const company = near.filter((entry) => entry.player.id !== target.player.id && flat(entry.position, target.position) <= this.settings.companyM).length;
            this.assign(group, this.settings.frontMax + Math.min(this.settings.frontMore, company), now);
            const ring = group.filter((one) => one.role === "ring");
            const base = this.flankBase(group, target.position);
            for (const one of group) {
                // The man's own target judges the blows on him (2026-11-01), or the player fighting him close (2026-11-02).
                if (!this.runByFighter(camp, one, near)) {
                    this.runByTarget(camp, one);
                }
                const before = one.slot.role;
                one.slot.role = one.role;
                // His turn begins when he steps up, and is over when it has run (`assign`).
                if (one.role === "front" && (before !== "front" || one.slot.frontSince === undefined)) {
                    const [low, high] = this.settings.turnMs;
                    one.slot.frontSince = now;
                    one.slot.turnMs = low + this.random() * (high - low);
                } else if (one.role !== "front") {
                    one.slot.frontSince = undefined;
                }
                // A man of the front line badly hurt may fall back a moment.
                if (this.retreat(camp, one, now)) {
                    continue;
                }
                if (one.role === "ring") {
                    this.circle(one, ring.indexOf(one), base, before !== "ring", now);
                } else {
                    this.engage(camp, one, before === "ring", alarm, now);
                }
            }
        }
        // Shooters who stand in another man are sent a few steps aside (2026-11-04).
        this.spaceShooters(camp, acting, now);
    }

    /**
     * Shooters apart (2026-11-04, user: "na hora de puxar flechas estão ficando um dentro do outro"): a shooter (an archer, or a man of the line at his bow) standing within
     * `shooterGapM` of another man of the fight is sent `shooterStepM` aside -- across the line to his target, on the side away from the other; back from the target when both
     * sides are taken -- and shoots again once there (`engage`: the order ended). Of two shooters the later in the camp's line moves; a shooter always gives way to a man who is not
     * shooting. Not again within `shooterEveryMs`. Returns how many were sent.
     */
    spaceShooters(camp: Camp, acting: readonly Acting[], now: number): number {
        const shooting = (one: Acting): boolean => one.role === "bow" || (one.role === "front" && one.slot.mode === "bow");
        let sent = 0;
        for (const one of acting) {
            const { slot, npc } = one;
            // Standing where he was (`pursue` keeps the watch): one on his way somewhere, or walking aside already, is left to it.
            const standing = slot.watchAt !== undefined && now - slot.watchAt >= this.settings.shooterStillMs;
            if (!shooting(one) || !standing || now < (slot.spaceAt ?? 0) || (npc.status === "running" && npc.intent !== "attack")) {
                continue;
            }
            let crowd: Acting | undefined;
            let closest = this.settings.shooterGapM;
            for (const other of acting) {
                const apart = other === one ? Number.POSITIVE_INFINITY : flat(other.position, one.position);
                if (apart < closest) {
                    closest = apart;
                    crowd = other;
                }
            }
            if (crowd === undefined || (shooting(crowd) && camp.slots.indexOf(crowd.slot) > camp.slots.indexOf(slot))) {
                continue;
            }
            slot.spaceAt = now + this.settings.shooterEveryMs;
            const spot = asideSpot(one.position, crowd.position, one.target.position, this.settings.shooterStepM, this.settings.shooterGapM, acting.filter((other) => other !== one).map((other) => other.position));
            if (spot === null) {
                continue;
            }
            if (npc.moveTo(new Vector3(spot.x, spot.y, spot.z), { speed: "jog", radius: 0.8, pathfinding: Navigation.ready ? "server" : "game" })) {
                slot.spacingUntil = now + this.settings.shooterEveryMs;
                slot.retryAt = now;
                sent += 1;
                this.note(camp, npc, one.target.player, `atirador afastado de ${crowd.npc.name} ${crowd.npc.id}: estavam a ${closest.toFixed(1)} m um do outro`);
            }
        }
        return sent;
    }

    /**
     * Who of the men after one player fights hand to hand: `limit` of the blades. The ones already in the line keep their places (the ring's men get to the player before the line
     * does when he runs off, and must not take them), the free places go to the nearest of the others, and a man badly hurt comes last, so another takes his place; one just
     * struck keeps his. The rest wait in the ring, except one the player is close to, who defends himself, and one the game would not send to his spot. Archers shoot whatever
     * the line.
     */
    private assign(group: Acting[], limit: number, now: number): void {
        const blades = group.filter((one) => !one.slot.archer);
        if (blades.length <= limit) {
            return;
        }
        const struck = (one: Acting): boolean => now - (one.slot.hurtAt ?? Number.NEGATIVE_INFINITY) < this.settings.hurtStaysMs;
        const wounded = (one: Acting): boolean => one.npc.maxHealth > 0 && one.npc.health < one.npc.maxHealth * this.settings.backOffBelow;
        // A man whose turn is over goes after the ring's (2026-11-02): another steps up, and he falls back.
        const turnOver = (one: Acting): boolean => one.slot.role === "front" && one.slot.frontSince !== undefined && now - one.slot.frontSince >= (one.slot.turnMs ?? this.settings.turnMs[0]);
        const score = (one: Acting): number => (wounded(one) ? 2_000 : turnOver(one) ? 1_500 : one.slot.role === "front" ? 0 : 1_000) + one.range - (struck(one) ? 8 : 0);
        const ranked = blades.map((one) => ({ one, score: score(one) })).sort((a, b) => a.score - b.score);
        ranked.forEach(({ one }, index) => {
            if (index >= limit) {
                // His turn ran out: he falls back, and for a moment neither the player close nor a blow brings him back. One in the line only for a blow or the player close
                // to him is not giving up a turn: he stays while that holds (below).
                if (turnOver(one)) {
                    one.slot.yieldedAt = now;
                }
                one.role = "ring";
            }
        });
        const yielded = (one: Acting): boolean => now - (one.slot.yieldedAt ?? Number.NEGATIVE_INFINITY) < this.settings.yieldKeepMs;
        // Struck since he last gave up his turn (or never gave one up): a blow taken during his turn does not hold him at the player, one after it does (2026-11-04).
        const struckSince = (one: Acting): boolean => struck(one) && !wounded(one) && (one.slot.hurtAt ?? Number.NEGATIVE_INFINITY) > (one.slot.yieldedAt ?? Number.NEGATIVE_INFINITY);
        // Stepped in to defend himself or struck: he stays `commitMs` after the last of it (2026-11-04: they walked off the moment the player was a step farther).
        const committed = (one: Acting): boolean => now < (one.slot.committedUntil ?? Number.NEGATIVE_INFINITY) && !wounded(one);
        for (const one of blades) {
            if (one.role !== "ring") {
                continue;
            }
            const close = one.range <= this.settings.defendM && !yielded(one);
            if (close || struckSince(one) || committed(one) || (one.slot.ringFails ?? 0) >= 2) {
                one.role = "front";
                if (close) {
                    one.slot.committedUntil = Math.max(one.slot.committedUntil ?? 0, now + this.settings.commitMs);
                }
            }
        }
    }

    /** The side of the target the front line comes from, as an angle: the ring goes round from there. */
    private flankBase(group: readonly Acting[], at: Point): number {
        const holders = group.filter((one) => one.role !== "ring");
        const used = holders.length > 0 ? holders : group;
        let x = 0;
        let y = 0;
        for (const one of used) {
            x += one.position.x;
            y += one.position.y;
        }
        return Math.atan2(y / used.length - at.y, x / used.length - at.x);
    }

    /**
     * A man of the front line or an archer: told to fight (the blade or the bow by the range), sent running at his target when he does not stir, and the camp's alarm kept.
     * `fresh` is a man come out of the ring: he is told at once.
     */
    private engage(camp: Camp, one: Acting, fresh: boolean, alarm: Camp["alarm"], now: number): void {
        const { slot, npc, target, range } = one;
        // An archer whose man came up to him runs back a few steps, and shoots again when the order runs out (2026-11-01).
        if (slot.archer && range < this.settings.archerBackM && now >= (slot.backAt ?? 0) && slot.target === target.player.id && npc.flee(target.player, { speed: this.settings.chaseSpeed, radius: 9 })) {
            slot.backAt = now + this.settings.archerBackEveryMs;
            slot.retryAt = now + 2_500;
            this.note(camp, npc, target.player, "o arqueiro recuou: o alvo chegou perto");
            return;
        }
        if (!slot.archer && range <= 4 && slot.target === target.player.id) {
            this.taunt(camp, slot, now);
            this.spook(camp, one, now);
        }
        // An order that ended (the body stands, or reached its goal) is given again; one that failed, too; and one the game's own
        // fright put out (he is no longer told to fight, nor to run at the target) is given back. One with a bow and a blade who
        // should change (his man ran off, or came close) is given the other.
        const ended = npc.status === "failed" || npc.status === "blocked" || npc.status === "idle" || npc.status === "reached" || (npc.intent !== "attack" && npc.intent !== "moveTo");
        const change = !slot.archer && this.weaponFor(slot, range) !== (slot.mode ?? "melee");
        this.drink(slot, npc);
        // A shooter walking aside from another man (`spaceShooters`) gets there first; the bow is ordered again when he does.
        if (now < (slot.spacingUntil ?? 0) && slot.target === target.player.id && npc.intent === "moveTo" && npc.status === "running") {
            return;
        }
        if (slot.target !== target.player.id || fresh || change || (ended && now >= slot.retryAt)) {
            const first = slot.target !== target.player.id;
            // An archer whose bow the game would not put on fights hand to hand instead.
            const ordered = slot.archer ? npc.attack(target.player, { weapon: "bow" }) || npc.attack(target.player) : this.order(slot, npc, target.player, range);
            if (change && ordered) {
                this.note(camp, npc, target.player, slot.mode === "bow" ? "tomou o arco: o alvo se afastou" : "voltou à lâmina: o alvo chegou perto");
            }
            if (first || !ordered) {
                this.note(camp, npc, target.player, `ataque ${ordered ? "ordenado" : "RECUSADO"}`);
            }
            if (ordered) {
                slot.target = target.player.id;
                slot.ringGoal = undefined;
                slot.ringStill = undefined;
                if (first) {
                    this.bark(slot, slot.chief === true ? "chief" : alarm !== null && alarm.targetId === target.player.id ? "alarm" : "sight", camp);
                }
            }
            slot.retryAt = now + this.settings.retryMs;
        }
        this.pursue(camp, slot, npc, target, now);
        // Anyone in the camp who sees a fight joins it.
        if (camp.alarm === null || camp.alarm.until <= now) {
            camp.alarm = { targetId: target.player.id, until: now + this.settings.alarmMs };
        }
    }

    /**
     * A man of the ring: walks to his spot round the target (`ringM` away, on the side `RING_OFFSETS_DEG` gives his number), stands there looking at him, and goes to a new
     * spot when the target has moved. He keeps the target without a blade order.
     */
    private circle(one: Acting, index: number, base: number, fresh: boolean, now: number): void {
        const { slot, npc, target, position } = one;
        if (fresh) {
            slot.ringAt = 0;
            slot.ringStill = false;
            slot.ringGoal = undefined;
            slot.stalking = false;
            slot.stalkAt = undefined;
        }
        slot.target = target.player.id;
        this.drink(slot, npc);
        // His spot, moved by the small step he is at (2026-11-04: the ring stood like statues).
        const [round, nearer] = STALK_STEPS[(slot.stalkStep ?? 0) % STALK_STEPS.length] as readonly [number, number];
        const angle = base + (((RING_OFFSETS_DEG[index % RING_OFFSETS_DEG.length] as number) + round * this.settings.stalkDeg) * Math.PI) / 180;
        const radius = this.settings.ringM - nearer * this.settings.stalkInM;
        const spot: Point = { x: target.position.x + Math.cos(angle) * radius, y: target.position.y + Math.sin(angle) * radius, z: target.position.z };
        // The way there round the player, not through him (2026-11-02): when the straight way passes within `ringClearM` of him, the man goes first by the spot on the ring halfway round.
        const goal = ringWay(position, spot, target.position, this.settings.ringM, this.settings.ringClearM);
        if (fresh && index === 0) {
            this.bark(slot, "surround");
        }
        if (flat(position, goal) <= (slot.stalking === true ? this.settings.stalkArriveM : this.settings.ringArriveM)) {
            // There: held, turned to the player at once, and turned again every couple of seconds as he moves; after a while of his own he takes his next small step.
            if (slot.ringStill !== true) {
                slot.ringStill = true;
                slot.stalking = false;
                slot.ringAt = now + this.settings.ringEveryMs;
                slot.stalkAt = now + this.stalkWait(slot);
                npc.hold();
                npc.lookAt(target.player);
            } else if (now >= (slot.stalkAt ?? Number.POSITIVE_INFINITY)) {
                slot.stalkStep = ((slot.stalkStep ?? 0) + 1) % STALK_STEPS.length;
                slot.stalking = true;
                slot.ringStill = false;
                slot.ringAt = 0;
                slot.ringGoal = undefined;
                this.circle(one, index, base, false, now);
            } else if (now >= (slot.ringAt ?? 0)) {
                slot.ringAt = now + this.settings.ringEveryMs;
                npc.lookAt(target.player);
            }
            return;
        }
        const last = slot.ringGoal;
        if (last !== undefined && (npc.status === "failed" || npc.status === "blocked")) {
            // A small step the game would not take is given up (back to his spot), and never counted against the spot itself.
            if (slot.stalking === true) {
                slot.stalking = false;
                slot.stalkStep = 0;
            } else {
                slot.ringFails = (slot.ringFails ?? 0) + 1;
            }
            slot.ringGoal = undefined;
        } else if (last !== undefined && npc.status === "running" && npc.intent === "moveTo" && flat(last, goal) <= this.settings.ringMovedM) {
            return;
        }
        if (now < (slot.ringAt ?? 0)) {
            return;
        }
        slot.ringAt = now + this.settings.ringEveryMs;
        slot.ringStill = false;
        slot.ringGoal = goal;
        // A small step is walked; a spot that went off with the player is run to like any other, and the step is over.
        const stepping = slot.stalking === true && flat(position, goal) <= this.settings.stalkInM + this.settings.ringArriveM;
        if (!stepping) {
            slot.stalking = false;
        }
        const sent = npc.moveTo(new Vector3(goal.x, goal.y, goal.z), { speed: stepping ? "walk" : "jog", radius: stepping ? 0.4 : 1.5, pathfinding: Navigation.ready ? "server" : "game" });
        if (!sent) {
            if (stepping) {
                slot.stalking = false;
                slot.stalkStep = 0;
            } else {
                slot.ringFails = (slot.ringFails ?? 0) + 1;
            }
        }
    }

    /** How long a ring man stands before his next small step: his own, between the two of `stalkMs`, and not the same at every step. */
    private stalkWait(slot: Slot): number {
        const [low, high] = this.settings.stalkMs;
        return low + ((stableHash(`${slot.npcId ?? 0}#${slot.stalkStep ?? 0}`) % 1000) / 1000) * (high - low);
    }

    /**
     * A man after a player is run by that player's game (2026-11-01, players: "alguns NPCs ficam imortais"): the game that runs a body judges the blows on it, and a man run by a
     * game far from the fight dodged every blow of the one who fought him. One whose runner is farther from him than `fightRunNearM` and than his target by `fightRunGapM`, with
     * the target within `fightRunM`, is given to the target's game.
     */
    /**
     * A man is run by the game of the player who fights him close (2026-11-02, user: "alguns bandidos continuam imortais"). In melee the game that runs the body judges the hit, and a man
     * after one player and run by that player's game was struck by another, right beside him, whose blows that game did not take: the man stood, unhurt, before the one hitting him. The
     * nearest player within `fighterM` of him takes him over when the game that runs him is `fightRunGapM` farther. True when he was given to that player.
     */
    private runByFighter(camp: Camp, one: Acting, near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>): boolean {
        let fighter: Player | null = null;
        let closest = this.settings.fighterM;
        for (const entry of near) {
            const away = flat(entry.position, one.position);
            if (away <= closest) {
                closest = away;
                fighter = entry.player;
            }
        }
        if (fighter === null) {
            return false;
        }
        const runner = one.npc.simulator;
        if (runner !== null && runner !== undefined && runner.id === fighter.id) {
            return true;
        }
        const there = runner === null || runner === undefined ? Number.POSITIVE_INFINITY : flat(runner.position, one.position);
        if (there <= closest + this.settings.fightRunGapM) {
            return false;
        }
        if (this.pinTo(one.slot, one.npc, fighter)) {
            this.note(camp, one.npc, fighter, `preso ao jogo de quem luta colado nele (${runner === null || runner === undefined ? "ninguém o rodava" : `o jogo de ${runner.nickname}, a ${Math.round(there)} m dele, o rodava`})`);
        }
        return true;
    }

    /** Gives the man to the player's game, unless he was given to it a moment ago (`pinAgainMs`): true when given now. */
    private pinTo(slot: Slot, npc: Npc, player: Player): boolean {
        const now = this.now();
        if (slot.pinnedTo === player.id && now - (slot.pinnedAt ?? Number.NEGATIVE_INFINITY) < this.settings.pinAgainMs) {
            return false;
        }
        npc.pin(player);
        slot.pinned = true;
        slot.pinnedTo = player.id;
        slot.pinnedAt = now;
        return true;
    }

    private runByTarget(camp: Camp, one: Acting): void {
        const runner = one.npc.simulator;
        const target = one.target.player;
        if (one.range > this.settings.fightRunM || (runner !== null && runner !== undefined && runner.id === target.id)) {
            return;
        }
        const there = runner === null || runner === undefined ? Number.POSITIVE_INFINITY : flat(runner.position, one.position);
        if (there <= Math.max(this.settings.fightRunNearM, one.range + this.settings.fightRunGapM)) {
            return;
        }
        if (this.pinTo(one.slot, one.npc, target)) {
            this.note(camp, one.npc, target, `preso ao jogo do alvo (${runner === null || runner === undefined ? "ninguém o rodava" : `o jogo de ${runner.nickname}, a ${Math.round(there)} m dele, o rodava`})`);
        }
    }

    /**
     * A man badly hurt with no draught left falls back a moment, once in his life and not every man (`retreatChance`), and comes again (2026-11-01): true while he does, and
     * nothing else is ordered him. A chief never does.
     */
    private retreat(camp: Camp, one: Acting, now: number): boolean {
        const { slot, npc, target } = one;
        if (slot.retreatUntil !== undefined) {
            if (now < slot.retreatUntil) {
                return true;
            }
            // Back into the fight, ordered at once.
            slot.retreatUntil = undefined;
            slot.target = null;
            slot.retryAt = 0;
            return false;
        }
        if (one.role !== "front" || slot.retreated === true || slot.chief === true || slot.archer || (slot.potions ?? 0) > 0 || !(npc.maxHealth > 0) || npc.health > npc.maxHealth * this.settings.retreatBelow) {
            return false;
        }
        slot.retreated = true;
        if (this.random() >= this.settings.retreatChance || !npc.flee(target.player, { speed: this.settings.chaseSpeed, radius: 14 })) {
            return false;
        }
        slot.retreatUntil = now + this.settings.retreatMs;
        this.bark(slot, "retreat", camp);
        this.note(camp, npc, target.player, `recuou ferido (vida ${Math.round(npc.health)}/${Math.round(npc.maxHealth)})`);
        return true;
    }

    /**
     * Another man for one already fighting (2026-11-02): the player who struck him in the last `strikerMs` from within `strikerM`, when that is not his man; otherwise, when more of the
     * camp are on his man than on another player within `spreadM` of him by two or more, that player (the one with the fewest on him, the nearest of those). Undefined: he keeps his man.
     * An archer turns to one who struck him, and does not spread.
     */
    private turnTo(
        slot: Slot,
        target: { readonly player: Player; readonly position: Point },
        near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>,
        position: Point,
        inLeash: (entry: { position: Point }) => boolean,
        onPlayer: ReadonlyMap<number, number>,
        now: number,
    ): { readonly player: Player; readonly position: Point } | undefined {
        if (slot.hurtBy !== undefined && slot.hurtBy !== target.player.id && now - (slot.hurtAt ?? Number.NEGATIVE_INFINITY) < this.settings.strikerMs) {
            const struck = slot.hurtBy;
            const striker = near.find((entry) => entry.player.id === struck && inLeash(entry) && flat(entry.position, position) <= this.settings.strikerM);
            if (striker !== undefined) {
                return striker;
            }
        }
        if (slot.archer) {
            return undefined;
        }
        const mine = onPlayer.get(target.player.id) ?? 0;
        let best: { readonly player: Player; readonly position: Point } | undefined;
        let fewest = mine - 2;
        let nearest = Number.POSITIVE_INFINITY;
        for (const entry of near) {
            if (entry.player.id === target.player.id || !inLeash(entry)) {
                continue;
            }
            const range = flat(entry.position, position);
            const count = onPlayer.get(entry.player.id) ?? 0;
            if (range <= this.settings.spreadM && (count < fewest || (count === fewest && range < nearest))) {
                fewest = count;
                nearest = range;
                best = entry;
            }
        }
        return best;
    }

    /** Another player near the man (`weakM`) who is nearly down (`weakShare` of his health), while the man's own is not: the one to go for. */
    private weakerNear(near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>, target: { readonly player: Player; readonly position: Point }, position: Point, inLeash: (entry: { position: Point }) => boolean): { readonly player: Player; readonly position: Point } | undefined {
        const share = (player: Player): number => (player.maxHealth > 0 && Number.isFinite(player.health) ? player.health / player.maxHealth : 1);
        if (share(target.player) <= 0.5) {
            return undefined;
        }
        return near.find((entry) => entry.player.id !== target.player.id && inLeash(entry) && flat(entry.position, position) <= this.settings.weakM && share(entry.player) <= this.settings.weakShare);
    }

    /** A man of the front line taunts his man now and then; a chief gives his orders. */
    private taunt(camp: Camp, slot: Slot, now: number): void {
        const [low, high] = this.settings.tauntMs;
        if (slot.tauntAt === undefined) {
            slot.tauntAt = now + low + this.random() * (high - low);
            return;
        }
        if (now < slot.tauntAt) {
            return;
        }
        slot.tauntAt = now + low + this.random() * (high - low);
        this.bark(slot, slot.chief === true && this.random() < 0.5 ? "chief" : "taunt", camp);
    }

    /** A man of the front line next to a rider may rear the horse and throw him off (2026-11-01): no bandit rides, but they know a rider up there is out of their reach. */
    private spook(camp: Camp, one: Acting, now: number): void {
        const { slot, npc, target, range } = one;
        const rider = target.player;
        if (rider.mounted !== true || range > this.settings.spookM || now < (slot.spookAt ?? 0)) {
            return;
        }
        slot.spookAt = now + this.settings.spookLookMs;
        if (now < (camp.spooked?.get(rider.id) ?? 0) || this.random() >= this.settings.spookChance) {
            return;
        }
        let thrown = false;
        try {
            thrown = rider.horse?.rearAndThrowDown() === true;
        } catch {
            thrown = false;
        }
        if (!thrown) {
            return;
        }
        (camp.spooked ??= new Map()).set(rider.id, now + this.settings.spookEveryMs);
        this.bark(slot, "horseSpook", camp);
        this.note(camp, npc, rider, "assustou o cavalo: o cavaleiro foi ao chão");
    }

    /**
     * A bandit's blow on a rider wounds the horse as well (2026-11-01: "até tentarem matar os cavalos dos jogadores"): `horseHitShare` of the blow, at least `horseHitMin`, off the
     * horse's health, which its own game keeps. The striker cries out now and then.
     */
    woundHorse(victim: Player, attackerId: number, damage: number): void {
        const entry = this.bySlot.get(attackerId);
        if (entry === undefined || victim.mounted !== true) {
            return;
        }
        const horse = victim.horse;
        if (horse === null || horse === undefined || !(horse.health > 0)) {
            return;
        }
        const loss = Math.max(this.settings.horseHitMin, (Number.isFinite(damage) ? damage : 0) * this.settings.horseHitShare);
        try {
            horse.health = Math.max(0, horse.health - loss);
        } catch {
            return;
        }
        this.bark(entry.slot, "horseHit", entry.camp);
    }

    /** A bandit took the last of a player's health: the one who did crows over him. */
    killedPlayer(attackerId: number): void {
        const entry = this.bySlot.get(attackerId);
        if (entry !== undefined && entry.slot.state === "alive") {
            this.bark(entry.slot, "victory", entry.camp);
        }
    }

    /**
     * A riderless horse of a player who is away from it, near a camp with players about, is taken by one of the camp's men who is not in the fight (2026-11-01, user: "bandidos
     * roubarem cavalos"): he runs to it, and leads it to the camp's middle. It stays the player's (he whistles it back, or takes it there); the theft ends when the thief is struck
     * or falls, when the owner comes within `stealBreakM` of the horse or rides it, when it is home, or after `stealGiveUpMs`. One theft at a time a camp.
     */
    private stealHorses(camp: Camp, near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>, now: number, horsesNow: () => Horse[]): void {
        const theft = camp.theft ?? null;
        if (theft !== null) {
            this.tendTheft(camp, theft, now);
            return;
        }
        if (now < (camp.stealAt ?? 0)) {
            return;
        }
        camp.stealAt = now + this.settings.stealLookMs;
        for (const horse of horsesNow()) {
            if (horse.ownerId === 0 || horse.rider !== null || !(horse.health > 0) || now < (stolenUntil.get(horse.id) ?? 0)) {
                continue;
            }
            const at = horse.position;
            if (flat(at, camp.center) > this.settings.leashRadius) {
                continue;
            }
            const owner = near.find((entry) => entry.player.id === horse.ownerId);
            if (owner === undefined || flat(owner.position, at) < this.settings.stealOwnerM) {
                continue;
            }
            let thief: Slot | null = null;
            let best = this.settings.stealFromM;
            for (const slot of camp.slots) {
                if (slot.state !== "alive" || slot.npcId === null || slot.archer || slot.chief === true || slot.role === "front" || slot.retreatUntil !== undefined) {
                    continue;
                }
                const npc = Npc.getById(slot.npcId);
                if (npc === null || !npc.alive) {
                    continue;
                }
                const range = flat(npc.position, at);
                if (range <= best) {
                    best = range;
                    thief = slot;
                }
            }
            if (thief === null || thief.npcId === null) {
                continue;
            }
            const npc = Npc.getById(thief.npcId);
            if (npc === null) {
                continue;
            }
            this.forgetFight(thief);
            thief.target = null;
            thief.stealing = true;
            camp.theft = { npcId: npc.id, horseId: horse.id, ownerId: horse.ownerId, stage: "to", since: now, orderAt: now, goal: { x: camp.center.x, y: camp.center.y, z: camp.center.z } };
            npc.moveTo(new Vector3(at.x, at.y, at.z), { speed: this.settings.chaseSpeed, radius: 1.5, pathfinding: Navigation.ready ? "server" : "game" });
            console.log(`bandits: ${camp.name}: ${npc.name} ${npc.id} vai roubar o cavalo ${horse.id} de ${owner.player.nickname}, a ${Math.round(best)} m dele`);
            return;
        }
    }

    private tendTheft(camp: Camp, theft: NonNullable<Camp["theft"]>, now: number): void {
        const npc = Npc.getById(theft.npcId);
        let horse: Horse | null = null;
        try {
            horse = Horse.getById(theft.horseId);
        } catch {
            horse = null;
        }
        if (npc === null || !npc.alive || horse === null || horse.rider !== null || !(horse.health > 0)) {
            this.endTheft(camp, "o ladrão ou o cavalo não estão mais lá");
            return;
        }
        const owner = Player.getById(theft.ownerId);
        if (owner !== null && flat(owner.position, horse.position) <= this.settings.stealBreakM) {
            this.endTheft(camp, `${owner.nickname} alcançou o cavalo`);
            return;
        }
        if (now - theft.since > this.settings.stealGiveUpMs) {
            this.endTheft(camp, "demorou demais");
            return;
        }
        const at = horse.position;
        if (theft.stage === "to") {
            if (flat(npc.position, at) <= this.settings.stealTakeM) {
                theft.stage = "lead";
                theft.orderAt = now;
                const goal = new Vector3(theft.goal.x, theft.goal.y, theft.goal.z);
                horse.moveTo(goal, { speed: "jog", radius: 3 });
                npc.moveTo(goal, { speed: "jog", radius: 3, pathfinding: Navigation.ready ? "server" : "game" });
                const slot = camp.slots.find((one) => one.npcId === npc.id);
                if (slot !== undefined) {
                    this.bark(slot, "horseSteal", camp);
                }
                if (owner !== null) {
                    try {
                        Chat.sendToPlayer(owner, "Um bandido está levando o seu cavalo para o acampamento dele!");
                    } catch {
                        // The chat is the server's: not there in a test.
                    }
                }
                console.log(`bandits: ${camp.name}: ${npc.name} ${npc.id} pegou o cavalo ${horse.id} e o leva para o acampamento`);
            } else if (now - theft.orderAt >= 3_000) {
                theft.orderAt = now;
                npc.moveTo(new Vector3(at.x, at.y, at.z), { speed: this.settings.chaseSpeed, radius: 1.5, pathfinding: Navigation.ready ? "server" : "game" });
            }
            return;
        }
        if (flat(at, theft.goal) <= 4) {
            horse.hold();
            stolenUntil.set(horse.id, now + this.settings.stealAgainMs);
            console.log(`bandits: ${camp.name}: o cavalo ${horse.id} ficou no acampamento`);
            this.endTheft(camp, "", false);
            return;
        }
        if (now - theft.orderAt >= 4_000) {
            theft.orderAt = now;
            const goal = new Vector3(theft.goal.x, theft.goal.y, theft.goal.z);
            horse.moveTo(goal, { speed: "jog", radius: 3 });
            npc.moveTo(new Vector3(at.x, at.y, at.z), { speed: "jog", radius: 2, pathfinding: Navigation.ready ? "server" : "game" });
        }
    }

    /** The theft of a camp ends: the horse is stopped where it is (unless it got home), and the thief is free again. */
    private endTheft(camp: Camp, why: string, stop = true): void {
        const theft = camp.theft ?? null;
        if (theft === null) {
            return;
        }
        camp.theft = null;
        camp.stealAt = this.now() + this.settings.stealLookMs * 5;
        const slot = camp.slots.find((one) => one.npcId === theft.npcId);
        if (slot !== undefined) {
            slot.stealing = undefined;
            slot.retryAt = 0;
        }
        if (stop) {
            try {
                Horse.getById(theft.horseId)?.hold();
            } catch {
                // No horses here.
            }
            stolenUntil.set(theft.horseId, this.now() + this.settings.stealAgainMs / 2);
        }
        if (why !== "") {
            console.log(`bandits: ${camp.name}: roubo do cavalo ${theft.horseId} acabou: ${why}`);
        }
    }

    /** The game that runs him: his own (`npc.simulator`), or, when nobody's does, the nearest player's, made to. */
    private keepRunning(slot: Slot, npc: Npc, near: ReadonlyArray<{ readonly player: Player; readonly position: Point }>): void {
        const runner = npc.simulator;
        const position = npc.position;
        // A runner far past reach, with somebody much nearer, is replaced; one that is near enough is left to the game's own election.
        const there = runner === null || runner === undefined ? Infinity : flat(runner.position, position);
        if (runner !== null && runner !== undefined && there <= this.settings.runnerLostM) {
            return;
        }
        let best: Player | null = null;
        let nearest = this.settings.pinM;
        for (const entry of near) {
            const range = flat(entry.position, position);
            if (range <= nearest) {
                nearest = range;
                best = entry.player;
            }
        }
        if (best === null || (runner !== null && runner !== undefined && (best.id === runner.id || nearest + this.settings.runnerGapM >= there))) {
            return;
        }
        npc.pin(best);
        if (slot.pinned !== true) {
            slot.pinned = true;
            console.log(`bandits: ${npc.id} ${runner === null || runner === undefined ? "estava parado (nenhum jogo o rodava)" : `era rodado por ${runner.nickname}, a ${Math.round(there)} m`}: preso ao jogo de ${best.nickname}, a ${Math.round(nearest)} m`);
        }
    }

    private noted = 0;
    private notedAt = 0;

    /** One line in the log about a bandit and the player he is after (at most forty a minute): who runs him, what he was told, how far. */
    private note(camp: Camp, npc: Npc, player: Player, what: string): void {
        const now = this.now();
        if (now - this.notedAt > 60_000) {
            this.notedAt = now;
            this.noted = 0;
        }
        if (this.noted >= 40) {
            return;
        }
        this.noted += 1;
        const runner = npc.simulator;
        console.log(`bandits: ${camp.name}: ${npc.name} ${npc.id} e ${player.nickname}, a ${Math.round(flat(npc.position, player.position))} m: ${what}; ${npc.status}/${npc.intent}, ${runner === null || runner === undefined ? "PARADO (nenhum jogo o roda)" : `rodado por ${runner.nickname}${runner.id === player.id ? "" : `, a ${Math.round(flat(runner.position, npc.position))} m dele`}`}`);
    }

    /**
     * A bandit ordered to fight who stands where he was for a few seconds, still far from his target, is sent running at it along
     * the route the server plans: the game's own pursuit is not in his hands to see, a walk is, and when he arrives the order to
     * fight is given again (the next look, `ended`).
     */
    private pursue(camp: Camp, slot: Slot, npc: Npc, target: { readonly player: Player; readonly position: Point }, now: number): void {
        const here = npc.position;
        if (slot.watchX === undefined || slot.watchY === undefined || flat(here, { x: slot.watchX, y: slot.watchY, z: here.z }) > 0.7) {
            slot.watchX = here.x;
            slot.watchY = here.y;
            slot.watchAt = now;
            return;
        }
        const range = flat(here, target.position);
        const shooting = slot.archer || slot.mode === "bow";
        const from = shooting ? this.settings.archerFromM : this.settings.chaseFromM;
        if (now - (slot.watchAt ?? now) < this.settings.stillMs || range <= from || now < (slot.chaseAt ?? 0)) {
            return;
        }
        slot.chaseAt = now + this.settings.chaseEveryMs;
        slot.retryAt = Math.min(slot.retryAt, now + 2_000);
        const goal = new Vector3(target.position.x, target.position.y, target.position.z);
        const sent = npc.moveTo(goal, { speed: this.settings.chaseSpeed, radius: shooting ? this.settings.archerFromM - 4 : 1.8, pathfinding: Navigation.ready ? "server" : "game" });
        this.note(camp, npc, target.player, `parado há ${Math.round((now - (slot.watchAt ?? now)) / 1000)} s: mandado correr até o alvo (${sent ? "aceito" : "RECUSADO"})`);
    }

    /** What stands about the player, camp by camp, for an administrator watching (`/bandidos estado`). */
    inspect(position: Point, radius = 250): string[] {
        const lines: string[] = [];
        const now = this.now();
        for (const camp of this.camps) {
            if (flat(camp.center, position) > radius) {
                continue;
            }
            lines.push(`${camp.id}. ${camp.name}, a ${Math.round(flat(camp.center, position))} m:`);
            for (const slot of camp.slots) {
                const npc = slot.npcId === null ? null : Npc.getById(slot.npcId);
                if (slot.state !== "alive" || npc === null) {
                    lines.push(`    ${slot.state === "dead" ? `morto, volta ${waitText(this.respawnWaitOf(camp, slot) - (now - slot.deathAt))}` : "vago"}`);
                    continue;
                }
                const runner = npc.simulator;
                lines.push(`    ${npc.name} ${npc.id}: a ${Math.round(flat(npc.position, position))} m, ${npc.status}/${npc.intent}, ${runner === null || runner === undefined ? "PARADO (ninguém o roda)" : `rodado por ${runner.nickname}`}, alvo ${slot.target ?? "nenhum"}, ${slot.mode === "bow" ? "arco" : "lâmina"}, vida ${Math.round(npc.health)}/${Math.round(npc.maxHealth)}, ${slot.potions ?? 0} poção(ões)${slot.pinned === true ? ", preso" : ""}${slot.role === "ring" ? ", cercando" : ""}${slot.chief === true ? ", CHEFE" : ""}${slot.retreatUntil !== undefined ? ", recuando" : ""}${slot.stealing === true ? ", roubando um cavalo" : ""}${now < (slot.rageUntil ?? 0) ? ", enfurecido" : ""}${npc.frozen ? ", CONGELADO" : ""}`);
            }
        }
        return lines;
    }

    /** A few steps about his own spot, and a pause: a camp that never moves looks dead. */
    private stroll(slot: Slot, npc: Npc, now: number): void {
        const [low, high] = this.settings.roamPauseMs;
        slot.roamAt = now + low + Math.random() * (high - low);
        const point = NAVIGATION.around({ x: slot.spot.position.x, y: slot.spot.position.y, z: slot.spot.position.z }, this.settings.roamM);
        if (point !== null) {
            npc.moveTo(new Vector3(point.x, point.y, point.z), { speed: "walk", radius: 1.5, pathfinding: "server" });
        }
    }

    private tendDead(camp: Camp, slot: Slot, now: number): void {
        if (slot.npcId !== null) {
            const corpse = Npc.getById(slot.npcId);
            if (corpse === null) {
                this.bySlot.delete(slot.npcId);
                slot.npcId = null;
            } else if (now - slot.deathAt >= this.settings.corpseMs && !this.playersNear(corpse.position, this.settings.corpseClearRadius)) {
                const id = slot.npcId;
                slot.npcId = null;
                this.bySlot.delete(id);
                corpse.remove();
            }
        }
        const wait = slot.state === "dead" ? this.respawnWaitOf(camp, slot) : this.settings.respawnMs;
        if (slot.npcId === null && now - slot.deathAt >= wait && !this.playersNear(camp.center, this.settings.respawnClearRadius)) {
            slot.state = "vacant";
            this.spawn(camp, slot);
        }
    }

    /** How long after his death a dead man's place is filled again: the camp's `respawnMs`, or, for a gang of the roads, a time of his own between the two of its window. */
    private respawnWaitOf(camp: Camp, slot: Slot): number {
        if (slot.respawnWait === undefined) {
            const window = camp.respawn;
            slot.respawnWait = window === undefined ? this.settings.respawnMs : window[0] + this.random() * (window[1] - window[0]);
        }
        return slot.respawnWait;
    }

    /** Every dead bandit back, now, and every chest filled; for an administrator. */
    restockNow(): { spawned: number; chests: number } {
        let spawned = 0;
        for (const camp of this.camps) {
            for (const slot of camp.slots) {
                if (slot.state !== "alive") {
                    if (slot.npcId !== null) {
                        const id = slot.npcId;
                        slot.npcId = null;
                        this.bySlot.delete(id);
                        Npc.getById(id)?.remove();
                    }
                    slot.state = "vacant";
                    // The new man is nobody's game's yet: what the old one in this place had (a pin) is not his.
                    slot.pinned = false;
                    slot.pinnedTo = undefined;
                    if (this.spawn(camp, slot)) {
                        spawned += 1;
                    }
                }
            }
        }
        return { spawned, chests: this.stockChests(true) };
    }

    describe(): string[] {
        return this.camps.map((camp) => {
            const alive = camp.slots.filter((slot) => slot.state === "alive").length;
            return `  ${camp.id}. ${camp.name} em ${camp.center.x.toFixed(0)} ${camp.center.y.toFixed(0)} ${camp.center.z.toFixed(0)}: ${alive}/${camp.slots.length} vivos, ${camp.chests.length} baú(s)`;
        });
    }

    stop(): void {
        this.running = false;
        for (const id of [...this.bySlot.keys()]) {
            Npc.getById(id)?.remove();
        }
        this.bySlot.clear();
    }
}

export const banditCamps = new BanditCamps();

/** The places of the roads, from `data/road-posts.json` (made by `tools/make-road-posts.py`); none when the file is not there. */
export function loadRoadPosts(): WildCandidate[] {
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/road-posts.json` : "", "resources/kcdc-gamemode/data/road-posts.json", "data/road-posts.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        const loaded = read<{ posts?: unknown }>(place);
        if (loaded.status !== "ok" || !Array.isArray(loaded.value.posts)) {
            continue;
        }
        const found: WildCandidate[] = [];
        for (const post of loaded.value.posts as Array<Record<string, unknown>>) {
            if (typeof post["id"] === "string" && typeof post["x"] === "number" && typeof post["y"] === "number" && typeof post["z"] === "number") {
                found.push({ guid: post["id"], position: { x: post["x"], y: post["y"], z: post["z"] } });
            }
        }
        return found;
    }
    return [];
}

/** The animals whose markers say the wild (a forest, a meadow), not a pasture or a yard. */
const WILD_ANIMALS = /^(Boar|Hare|RoeDeer|RedDeer|Wolf|WildDog)/;
/** How many times, ten seconds apart, the hideouts wait for the navigation mesh before giving up. */
const WILD_TRIES = 12;

/**
 * A fallen bandit's purse goes to the players who fought him, in equal parts, the moment he falls (2026-11-02, user: "os groschens dos bandidos não dá para saquear; às vezes
 * buga, um pega e outro jogador não consegue"): the coins left on the corpse were a race of loot screens, and a player who opened it after another took nothing he could see.
 * Whoever struck him in the last `shareWithinMs` (`hitters`: player id → when) and stands within `shareM` of the body gets a share; with nobody of them near, the purse stays
 * on the corpse for the loot. A share the game will not take goes back on the body. For the camps' men and the road's (`ambush.ts`).
 */
export function sharePurse(corpse: Npc, hitters: ReadonlyMap<number, number> | undefined, now: number, settings: { readonly shareWithinMs: number; readonly shareM: number } = banditSettings): void {
    const at = corpse.position;
    const takers: Player[] = [];
    for (const [id, when] of hitters ?? []) {
        const player = now - when <= settings.shareWithinMs ? Player.getById(id) : null;
        if (player !== null && player.ready && flat(player.position, at) <= settings.shareM) {
            takers.push(player);
        }
    }
    if (takers.length === 0) {
        return;
    }
    let total = 0;
    try {
        total = moneyOf(corpse);
        if (total <= 0 || !takeMoney(corpse, total)) {
            return;
        }
    } catch {
        return;
    }
    const share = Math.floor(total / takers.length);
    let odd = total - share * takers.length;
    const given: string[] = [];
    let back = 0;
    for (const player of takers) {
        const units = share + (odd > 0 ? 1 : 0);
        odd -= 1;
        if (units <= 0) {
            continue;
        }
        if (giveMoney(player, units)) {
            given.push(player.nickname);
            Chat.sendToPlayer(player, takers.length > 1 ? `Você pegou ${coins(units)} da bolsa do bandido, a sua parte entre ${takers.length}.` : `Você pegou ${coins(units)} da bolsa do bandido.`);
        } else {
            back += units;
        }
    }
    if (back > 0) {
        try {
            giveMoney(corpse, back);
        } catch {
            // Gone with the body: nothing more to do.
        }
    }
    console.log(`bandits: a bolsa de ${corpse.name || "um bandido"} (${coins(total)}) foi para ${given.length > 0 ? given.join(", ") : "ninguém"}${back > 0 ? ` (${coins(back)} de volta ao corpo)` : ""}`);
}

export function installBandits(): void {
    loadAggression();
    const placements = Npc.placements();
    const camps = banditCamps.discover(placements);

    Events.on("npcDeath", (npc, attacker) => banditCamps.died(npc.id, typeof attacker === "object" && attacker !== null && "steamId" in attacker ? attacker : undefined));
    Events.on("npcDestroy", (npc) => banditCamps.removed(npc.id));

    // The heavier hand: a bandit's blow on a player is worth more than an ordinary man's.
    Events.on("playerHit", (victim, attacker, hit) => {
        if (attacker !== null && typeof attacker === "object" && banditCamps.isBandit(attacker.id) && !("steamId" in attacker)) {
            hit.damage *= banditCamps.handOf(attacker.id);
            // A rider's horse takes part of the blow (2026-11-01).
            banditCamps.woundHorse(victim, attacker.id, hit.damage);
        }
    });
    Events.on("playerDied", (_player, killer) => {
        if (killer !== null && typeof killer === "object" && !("steamId" in killer) && banditCamps.isBandit(killer.id)) {
            banditCamps.killedPlayer(killer.id);
        }
    });

    Events.on("npcDamage", (npc, attacker) => {
        if (attacker !== null && "steamId" in attacker && banditCamps.isBandit(npc.id)) {
            banditCamps.hit(npc.id, attacker);
        }
    });

    // The hideouts in the wild need the navigation mesh to put them on walkable ground, which may not be ready yet.
    let wildTimer: ReturnType<typeof setTimeout> | null = null;
    const placeWild = (attempt: number): void => {
        wildTimer = null;
        if (!Navigation.ready) {
            if (attempt >= WILD_TRIES) {
                console.log("bandits: a malha de navegação não ficou pronta: sem esconderijos na mata");
            } else {
                wildTimer = setTimeout(() => placeWild(attempt + 1), 10_000);
            }
            return;
        }
        const wild = Npc.animalSpawnpoints()
            .filter((point) => point.count > 0 && WILD_ANIMALS.test(point.actorClass))
            .map((point) => ({ guid: point.guid, position: { x: point.position.x, y: point.position.y, z: point.position.z } }));
        const people = placements
            .filter((place) => !((PATTERN.test(place.layer) || PATTERN.test(place.name)) && !/cinematic/i.test(place.layer)))
            .map((place) => place.position);
        const before = banditCamps.camps.length;
        const added = banditCamps.addWild(wild, people);
        // The roads, after the hideouts so that these keep their places (the numbers and the places of the hideouts do not change with the roads).
        const roadPosts = loadRoadPosts();
        if (roadPosts.length === 0) {
            console.log("bandits: data/road-posts.json não foi encontrado ou está vazio: sem bandidos nas estradas");
        }
        const roads = banditCamps.addRoads(roadPosts, people);
        const spawned = banditCamps.spawnAll();
        console.log(`bandits: ${added} esconderijo(s) na mata, a pelo menos ${banditSettings.wildFromPeopleM} m de qualquer lugar com gente, e ${roads} posto(s) nas estradas; ${spawned} bandido(s) a mais`);
        banditCamps.describe().slice(before).forEach((line) => console.log(`bandits: ${line.trim()}`));
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
        const spawned = banditCamps.spawnAll();
        const chests = banditCamps.stockChests(true);
        console.log(`bandits: ${spawned} bandido(s) em ${camps} acampamento(s); ${chests} baú(s) de acampamento abastecido(s)`);
        banditCamps.describe().forEach((line) => console.log(`bandits: ${line.trim()}`));
        banditCamps.report().forEach((line) => console.log(`bandits: ${line}`));
        timer = setInterval(() => {
            banditCamps.tick();
            banditCamps.stockChests();
        }, banditSettings.tickMs);
        placeWild(0);
    }, banditSettings.spawnAfterMs);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearTimeout(start);
        if (wildTimer !== null) {
            clearTimeout(wildTimer);
        }
        if (timer !== null) {
            clearInterval(timer);
        }
        banditCamps.stop();
    });

    console.log(`bandits: ${camps} acampamento(s) de bandidos encontrados no nível; aparecem ${banditSettings.spawnAfterMs / 1000} s depois de o servidor subir`);
}
