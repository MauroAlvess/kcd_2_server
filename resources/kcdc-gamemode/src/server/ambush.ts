/**
 * Bandits on the road.
 *
 * Now and then a player travelling between villages is stopped by a small gang who want their purse. The game's own
 * dialogue list puts the choice: pay what they ask (a share of what the player carries), hand over what little there
 * is, or refuse and fight. Paid, they pocket the coins and go; the leader carries them, so whoever catches and beats
 * him gets them back. Refused, or left without an answer, they attack, as hard as the camps' bandits (`bandits.ts`,
 * whose clothes, weapons and heavier hand they share), and what they wear and carry is the loot.
 *
 * Who is stopped: a player who has been in the world a while and keeps moving, on foot or on horseback, outside every
 * place the map names (a village and a margin around it, and anywhere among houses), away from the bandit camps, and
 * not talking, trading or at the dice. The road counts: on the game's road surface the chance is four times what it is
 * elsewhere. Nobody is stopped twice within a quarter of an hour, and there are never more than four gangs on the roads.
 *
 * More of them since 2026-10-17 (user: "aumentar a probabilidade de encontrar bandidos nas estradas e de sofrer emboscadas"):
 * the chance is rolled for EVERY traveller at each look, so it does not shrink as more people travel (it used to be one
 * traveller picked at random per look, which made a road with ten travellers a tenth as dangerous for each).
 *
 * `/emboscada` (administrators) says how it goes, switches it off and on, and sends a gang at a player to try it.
 *
 * Run by the victim's own game (user, 2026-10-18: "bati neles, correram estáticos e não lutaram comigo nem foram atrás de mim,
 * só foram embora para sempre"). A body is run by the client the server elects, and each client runs a limited number: near a
 * village's herds the gang went to nobody, ran on the spot and gave up. The gang is pinned to the victim (`npc.pin`) from the
 * start, an order to fight that ended is given again, and a bandit who stands still for a few seconds away from his target is
 * sent running at it along the server's route; each of them is told in the log (`ambush: ...`).
 */

import { banditCamps, banditSettings, sharePurse } from "./bandits.js";
import { coins, giveMoney, moneyOf, MONEY_UNIT, takeMoney } from "./money.js";
import { speak } from "./npc-speech.js";

/** Who the road's robbers' lines are said by in the chat card (`npc-speech.ts`). */
const ROBBER = "Assaltante";
import { distanceBetween, groundForward, yawTowards } from "./place.js";
import { ensureDir, read, write } from "./store.js";
import { trades } from "./trade.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/ambush.json`;

export const ambushSettings = {
    /** How often the roads are looked at for somebody to stop. */
    checkMs: 20_000,
    /** The chance, at each look, that a player who may be stopped is: on a road, and anywhere else outside villages. */
    chanceOnRoad: 0.2,
    chanceOffRoad: 0.05,
    /** The game's road surfaces (`Libs/MaterialEffects/SurfaceTypes.xml`). */
    roadSurfaces: ["mat_road", "mat_gravel"] as readonly string[],
    /** Nobody is stopped twice within this, nor this soon after coming into the world. */
    playerCooldownMs: 15 * 60_000,
    graceMs: 5 * 60_000,
    /** Gangs start at least this far apart in time, and never more than this many at once. */
    globalCooldownMs: 90_000,
    maxActive: 4,
    /** A traveller: moved at least this far since the last look. */
    minTravelM: 30,
    /** Not this close to a village's area, nor to a bandit camp. */
    settlementMarginM: 120,
    housesMarginM: 40,
    campMarginM: 220,
    gangMin: 2,
    gangMax: 3,
    /** Of the gangs, this share are Cumans: more of them, one with a bow, and they do not talk -- they strike. */
    cumanChance: 0.35,
    cumanMin: 3,
    cumanMax: 4,
    /**
     * A place the map names counts as a village only when its outline is no wider than this: the level names its countryside
     * too, and a road between villages was never far enough from every named place (not one gang was started from 2026-10-15 to
     * 2026-10-19).
     */
    settlementMaxM: 900,
    /** The reasons nobody was stopped are written to the log this often. */
    reportEveryMs: 10 * 60_000,
    /** Where the gang comes from: this far behind the player, out of their sight. */
    spawnDistanceM: 30,
    /** How close the leader comes before making his demand. */
    demandRangeM: 7,
    approachMs: 75_000,
    answerMs: 25_000,
    /** A gang whose victim got away gives up after this. */
    escapeM: 80,
    escapeMs: 30_000,
    /** Living bandits leaving the scene are taken off once nobody is this close, or after `leaveMs` with nobody near. */
    leaveRadiusM: 90,
    leaveMs: 120_000,
    corpseMs: 10 * 60_000,
    corpseClearM: 50,
    retryMs: 4_000,
    /** Standing this long, farther than `chaseFromM` from the one he is after: sent running there by the server's route. */
    stillMs: 3_000,
    chaseFromM: 3,
    chaseEveryMs: 5_000,
    /** What they ask: this share of the purse, in whole coins, between the two bounds (units of the money item). */
    demandShare: 0.3,
    demandMin: 10 * MONEY_UNIT,
    demandMax: 200 * MONEY_UNIT,
    /** A player with an empty purse is let go this often; otherwise they pay in blood. */
    mercyChance: 0.5,
};

type Stage = "approach" | "demand" | "fight" | "leaving" | "over";

interface Ambush {
    readonly id: number;
    /** Highwaymen ask for the purse; Cumans strike. */
    readonly kind: "bandits" | "cumans";
    readonly victim: Player;
    readonly gang: number[];
    readonly leader: number;
    stage: Stage;
    since: number;
    /** The demand's dialogue on the victim's screen, or 0. */
    session: number;
    demand: number;
    /** Who each bandit fights: the victim, or somebody who struck it. */
    readonly targets: Map<number, number>;
    readonly orderedAt: Map<number, number>;
    readonly deadAt: Map<number, number>;
    /** Who struck each of the gang, by player id, and when last: a fallen man's purse is theirs (2026-11-02, `sharePurse` in bandits.ts). */
    readonly hitters: Map<number, Map<number, number>>;
    /** When the victim was last within reach of the gang, for giving up a chase. */
    seenAt: number;
    /** Where each bandit was last seen to move, and when: one who stands still is sent running. */
    readonly watch: Map<number, { x: number; y: number; at: number; chaseAt: number }>;
}

export interface AmbushStatus {
    readonly enabled: boolean;
    readonly active: number;
    readonly started: number;
    readonly surfaces: ReadonlyArray<[string, number]>;
}

/** Tells a player something on the game's notification line, and keeps it in the chat. */
function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

function flat(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** What the client says is under a player's feet: a surface name, or null when it could not say. */
async function surfaceUnder(player: Player): Promise<string | null> {
    const trace = await World.resolveGround(player, player.position, { up: 2, down: 6 });
    return trace.answered && trace.hit !== null ? trace.hit.surface : null;
}

export class Ambushes {
    enabled = true;
    private readonly ambushes = new Map<number, Ambush>();
    private readonly byNpc = new Map<number, Ambush>();
    private readonly bySession = new Map<number, Ambush>();
    /** No ambush on this player before this time. */
    private readonly notBefore = new Map<number, number>();
    private readonly lastSeen = new Map<number, { x: number; y: number; z: number }>();
    private readonly surfaces = new Map<string, number>();
    private nextId = 1;
    private nextStart = 0;
    private started = 0;
    private probing = false;
    /** Why players were not stopped since the last report, and each player's last reason, for `/emboscada`. */
    private readonly reasons = new Map<string, number>();
    readonly lastReason = new Map<number, string>();
    private looks = 0;
    private reportedAt = 0;

    constructor(
        private readonly settings = ambushSettings,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
        private readonly probe: (player: Player) => Promise<string | null> = surfaceUnder,
    ) {}

    load(): void {
        const loaded = read<{ enabled?: unknown }>(FILE);
        if (loaded.status === "ok" && typeof loaded.value.enabled === "boolean") {
            this.enabled = loaded.value.enabled;
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        try {
            ensureDir(DIR);
            write(FILE, { enabled });
        } catch (error: unknown) {
            console.log(`ambush: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!enabled) {
            for (const ambush of [...this.ambushes.values()]) {
                this.leave(ambush, "");
            }
        }
    }

    status(): AmbushStatus {
        return {
            enabled: this.enabled,
            active: this.active(),
            started: this.started,
            surfaces: [...this.surfaces].sort((a, b) => b[1] - a[1]),
        };
    }

    /** Gangs still about on the roads; bodies left for their pockets do not count. */
    private active(): number {
        return [...this.ambushes.values()].filter((ambush) => ambush.stage === "approach" || ambush.stage === "demand" || ambush.stage === "fight" || (ambush.stage === "leaving" && this.living(ambush).length > 0)).length;
    }

    /** The bodies of the gangs that are out now (highwaymen, Cumans): what a lock-on prefers over a player (`lockon-priority.ts`). */
    gangIds(): number[] {
        return [...this.byNpc.keys()];
    }

    isRoadBandit(npcId: number): boolean {
        return this.byNpc.has(npcId);
    }

    /** A player has just come into the world: some time on the road before anybody waylays them. */
    arrived(player: Player): void {
        this.notBefore.set(player.id, Math.max(this.notBefore.get(player.id) ?? 0, this.now() + this.settings.graceMs));
    }

    // -----------------------------------------------------------------------------------------
    // Who may be stopped.

    /** Why this player may not be stopped now, or "" when they may. */
    reasonNotTo(player: Player, moved: number): string {
        if (!player.ready || !player.alive || (player.virtualWorld !== 0 && player.virtualWorld !== 0xffffffff)) {
            return "fora do mundo";
        }
        if ((this.notBefore.get(player.id) ?? 0) > this.now()) {
            return "ainda não";
        }
        if ([...this.ambushes.values()].some((ambush) => ambush.victim.id === player.id && ambush.stage !== "over")) {
            return "já está numa emboscada";
        }
        if (Dialogue.sessionOf(player.id) !== 0 || trades.isTrading(player) || Dice.matchOf(player.id) !== 0) {
            return "ocupado";
        }
        if (moved < this.settings.minTravelM) {
            return "parado";
        }
        const position = player.position;
        if (banditCamps.camps.some((camp) => flat(camp.center, position) < this.settings.campMarginM)) {
            return "perto de um acampamento";
        }
        // A place the map names (a village, a town, a castle), or houses all around: not a road between places. Only an outline
        // the size of a village counts: the countryside has names too.
        const village = (area: Area): boolean => {
            if (area.location === "") {
                return false;
            }
            try {
                const { min, max } = area.bounds;
                return Math.max(max.x - min.x, max.y - min.y) <= this.settings.settlementMaxM;
            } catch {
                return true;
            }
        };
        if (Area.nearby(position, this.settings.settlementMarginM).some(village)) {
            return "perto de um povoado";
        }
        if (Area.nearby(position, this.settings.housesMarginM).some((area) => area.labels.some((label) => /^(private|personal|interior|castle)$/i.test(label)))) {
            return "entre casas";
        }
        return "";
    }

    /** Looks at every player once: at most one gang starts. */
    look(): void {
        const now = this.now();
        const players = Player.all();
        const moved = new Map<number, number>();
        for (const player of players) {
            if (!player.ready) {
                continue;
            }
            const position = player.position;
            const last = this.lastSeen.get(player.id);
            moved.set(player.id, last === undefined ? 0 : flat(last, position));
            this.lastSeen.set(player.id, { x: position.x, y: position.y, z: position.z });
        }
        if (!this.enabled || this.probing || now < this.nextStart || this.active() >= this.settings.maxActive) {
            return;
        }
        const candidates = players.filter((player) => {
            const reason = this.reasonNotTo(player, moved.get(player.id) ?? 0);
            this.lastReason.set(player.id, reason === "" ? "pode ser parado" : reason);
            this.reasons.set(reason === "" ? "pode ser parado" : reason, (this.reasons.get(reason === "" ? "pode ser parado" : reason) ?? 0) + 1);
            return reason === "";
        });
        this.looks += 1;
        this.report(now);
        if (candidates.length === 0) {
            return;
        }
        // Each traveller has the chance of their own; of those who got it, one is tried now (the others, at a later look).
        const rolled = candidates.filter(() => this.random() < this.settings.chanceOnRoad);
        if (rolled.length === 0) {
            return;
        }
        const player = rolled[Math.floor(this.random() * rolled.length)]!;
        // The road is asked of the player's own game, a moment late; off the road the chance is a quarter of it.
        this.probing = true;
        this.probe(player)
            .then((surface) => {
                this.probing = false;
                if (surface !== null) {
                    this.surfaces.set(surface, (this.surfaces.get(surface) ?? 0) + 1);
                }
                const onRoad = surface !== null && this.settings.roadSurfaces.includes(surface);
                if (!onRoad && this.random() >= this.settings.chanceOffRoad / this.settings.chanceOnRoad) {
                    return;
                }
                if (Player.getById(player.id) === player && this.reasonNotTo(player, this.settings.minTravelM) === "") {
                    this.start(player);
                }
            })
            .catch((error: unknown) => {
                this.probing = false;
                console.log(`ambush: o chão de ${player.nickname} não pôde ser lido: ${error instanceof Error ? error.message : String(error)}`);
            });
    }

    /** Every so often, why nobody was stopped: the next report after a quiet road says where to look. */
    private report(now: number): void {
        if (this.reportedAt === 0) {
            this.reportedAt = now;
            return;
        }
        if (now - this.reportedAt < this.settings.reportEveryMs) {
            return;
        }
        if (this.reasons.size > 0) {
            const parts = [...this.reasons].sort((a, b) => b[1] - a[1]).map(([reason, count]) => `${reason} ${count}`);
            const seen = [...this.surfaces].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([surface, count]) => `${surface} ${count}`);
            console.log(`ambush: em ${this.looks} olhada(s): ${parts.join(", ")}; chão lido: ${seen.join(", ") || "nenhum"}; gangues desde o início: ${this.started}`);
        }
        this.reasons.clear();
        this.looks = 0;
        this.reportedAt = now;
    }

    // -----------------------------------------------------------------------------------------
    // The gang.

    /** Sends a gang at a player. False when none could be put on the ground near them. */
    start(victim: Player): boolean {
        if (!Navigation.ready) {
            return false;
        }
        const kind: Ambush["kind"] = this.random() < this.settings.cumanChance ? "cumans" : "bandits";
        const [least, most] = kind === "cumans" ? [this.settings.cumanMin, this.settings.cumanMax] : [this.settings.gangMin, this.settings.gangMax];
        const count = least + Math.floor(this.random() * (most - least + 1));
        const souls = banditCamps.souls();
        const forward = groundForward(victim.rotation as Quaternion);
        const back = Math.atan2(-forward.y, -forward.x);
        const from = victim.position;
        const gang: number[] = [];
        for (let index = 0; index < count; index += 1) {
            // Behind the player and a little to either side, where they are not looking.
            const angle = back + (this.random() - 0.5) * 1.4;
            const distance = this.settings.spawnDistanceM + this.random() * 8;
            const raw = new Vector3(from.x + Math.cos(angle) * distance, from.y + Math.sin(angle) * distance, from.z);
            const point = Navigation.closestPoint(raw, { searchRadius: 12, searchHeight: 25, doors: "none" });
            if (point === null || distanceBetween(point, from) < this.settings.spawnDistanceM * 0.6) {
                continue;
            }
            try {
                const npc = Npc.create({
                    soul: souls[Math.floor(this.random() * souls.length)] ?? "bandit",
                    position: point,
                    rotation: yawTowards(from.x - point.x, from.y - point.y),
                    name: kind === "cumans" ? "Cumano" : "Salteador",
                    nametag: false,
                    interactable: false,
                    lootable: true,
                    health: banditSettings.health,
                    maxHealth: banditSettings.health,
                });
                if (kind === "cumans") {
                    // The last of them shoots.
                    banditCamps.dressCuman(npc, index === count - 1);
                } else {
                    banditCamps.dress(npc, false);
                }
                // The victim's own game runs them, whatever else it is running near there.
                npc.pin(victim);
                gang.push(npc.id);
            } catch (error: unknown) {
                console.log(`ambush: um salteador não pôde ser criado: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        if (gang.length < this.settings.gangMin) {
            gang.forEach((id) => Npc.getById(id)?.remove());
            // No room here: try this traveller again a little later rather than at once.
            this.notBefore.set(victim.id, this.now() + 2 * 60_000);
            return false;
        }

        const now = this.now();
        const ambush: Ambush = {
            id: this.nextId++,
            kind,
            victim,
            gang,
            leader: gang[0]!,
            stage: "approach",
            since: now,
            session: 0,
            demand: 0,
            targets: new Map(gang.map((id) => [id, victim.id])),
            orderedAt: new Map(),
            deadAt: new Map(),
            hitters: new Map(),
            seenAt: now,
            watch: new Map(),
        };
        this.ambushes.set(ambush.id, ambush);
        gang.forEach((id) => this.byNpc.set(id, ambush));
        this.notBefore.set(victim.id, now + this.settings.playerCooldownMs);
        this.nextStart = now + this.settings.globalCooldownMs;
        this.started += 1;
        for (const id of gang) {
            Npc.getById(id)?.follow(victim, { speed: banditSettings.chaseSpeed, radius: 3 });
        }
        console.log(`ambush: ${gang.length} ${kind === "cumans" ? "cumano(s)" : "salteador(es)"} atrás de ${victim.nickname} em ${from.x.toFixed(0)} ${from.y.toFixed(0)}`);
        return true;
    }

    private living(ambush: Ambush): Npc[] {
        return ambush.gang.flatMap((id) => {
            const npc = Npc.getById(id);
            return npc !== null && npc.alive ? [npc] : [];
        });
    }

    private enter(ambush: Ambush, stage: Stage): void {
        ambush.stage = stage;
        ambush.since = this.now();
        ambush.orderedAt.clear();
    }

    /** The demand, on the victim's screen. */
    private demandPage(ambush: Ambush): DialoguePage {
        const purse = moneyOf(ambush.victim);
        const options: DialogueOption[] = [
            { id: "info:who", text: "Salteadores fecham o caminho.", enabled: false },
            { id: "info:ask", text: `— A bolsa ou a vida! Passa ${coins(ambush.demand)} e segue viagem.`, enabled: false },
        ];
        if (purse >= ambush.demand) {
            options.push({ id: "pay", text: `Pagar ${coins(ambush.demand)}`, enabled: true });
        } else if (purse > 0) {
            options.push({ id: "all", text: `Dar tudo o que tenho (${coins(purse)})`, enabled: true });
        } else {
            options.push({ id: "broke", text: "Não tenho nada", enabled: true });
        }
        options.push({ id: "fight", text: "Não vou pagar nada", enabled: true });
        return { line: undefined, onRight: false, options };
    }

    /** What they ask for: a share of the purse in whole coins, between the bounds. */
    demandFor(purse: number): number {
        const share = Math.round((purse * this.settings.demandShare) / MONEY_UNIT) * MONEY_UNIT;
        return Math.min(this.settings.demandMax, Math.max(this.settings.demandMin, share));
    }

    private makeDemand(ambush: Ambush): void {
        const leader = Npc.getById(ambush.leader);
        for (const npc of this.living(ambush)) {
            npc.hold();
            npc.lookAt(ambush.victim);
        }
        if (leader !== null) speak(leader, ROBBER, "A bolsa ou a vida!", { radiusM: 30 });
        ambush.demand = this.demandFor(moneyOf(ambush.victim));
        this.enter(ambush, "demand");
    }

    /** The victim's answer. */
    choose(session: number, player: Player, option: string): void {
        const ambush = this.bySession.get(session);
        if (ambush === undefined || ambush.victim.id !== player.id || ambush.stage !== "demand") {
            return;
        }
        if (option.startsWith("info")) {
            return;
        }
        this.bySession.delete(session);
        ambush.session = 0;
        Dialogue.close(session);
        const leader = Npc.getById(ambush.leader);
        if (option === "pay" || option === "all") {
            const amount = option === "pay" ? ambush.demand : moneyOf(player);
            if (amount > 0 && takeMoney(player, amount)) {
                // In the leader's pocket: beaten later, he gives it back.
                if (leader !== null) {
                    giveMoney(leader, amount);
                }
                if (leader !== null) speak(leader, ROBBER, option === "pay" ? "Sábia escolha." : "Só isso? Some daqui!", { radiusM: 30 });
                tell(player, `Os salteadores levaram ${coins(amount)} e sumiram no mato.`);
                this.leave(ambush, "");
                return;
            }
            this.fight(ambush, "O dinheiro não estava lá. Os salteadores atacam!");
            return;
        }
        if (option === "broke") {
            if (this.random() < this.settings.mercyChance) {
                if (leader !== null) speak(leader, ROBBER, "Pobre diabo... Some daqui!", { radiusM: 30 });
                tell(player, "Os salteadores riram da sua bolsa vazia e deixaram você passar.");
                this.leave(ambush, "");
            } else {
                if (leader !== null) speak(leader, ROBBER, "Então paga com o couro!", { radiusM: 30 });
                this.fight(ambush, "Sem nada para dar, os salteadores atacam!");
            }
            return;
        }
        this.fight(ambush, "Você se recusou a pagar. Os salteadores atacam!");
    }

    /** The demand's list closed: Esc, or something else over it. Not answering is answering no. */
    closed(session: number, reason: number): void {
        const ambush = this.bySession.get(session);
        if (ambush === undefined) {
            return;
        }
        this.bySession.delete(session);
        ambush.session = 0;
        if (reason !== 0 && ambush.stage === "demand") {
            this.fight(ambush, "Sem resposta, os salteadores atacam!");
        }
    }

    private fight(ambush: Ambush, message: string): void {
        if (ambush.session !== 0) {
            this.bySession.delete(ambush.session);
            Dialogue.close(ambush.session);
            ambush.session = 0;
        }
        if (message !== "") {
            tell(ambush.victim, message);
        }
        ambush.seenAt = this.now();
        this.enter(ambush, "fight");
    }

    private leave(ambush: Ambush, message: string): void {
        if (ambush.session !== 0) {
            this.bySession.delete(ambush.session);
            Dialogue.close(ambush.session);
            ambush.session = 0;
        }
        if (message !== "") {
            tell(ambush.victim, message);
        }
        const from = ambush.victim.position;
        for (const npc of this.living(ambush)) {
            npc.pin(null);
            npc.flee(from, { speed: banditSettings.chaseSpeed, radius: 70 });
        }
        this.enter(ambush, "leaving");
    }

    /** A road bandit was struck: whoever did it is fought, whatever the gang was doing. */
    hit(npcId: number, attacker: Player): void {
        const ambush = this.byNpc.get(npcId);
        if (ambush === undefined) {
            return;
        }
        let struck = ambush.hitters.get(npcId);
        if (struck === undefined) {
            struck = new Map();
            ambush.hitters.set(npcId, struck);
        }
        struck.set(attacker.id, this.now());
        if (ambush.stage === "over") {
            return;
        }
        ambush.targets.set(npcId, attacker.id);
        ambush.orderedAt.delete(npcId);
        if (ambush.stage !== "fight") {
            this.fight(ambush, attacker.id === ambush.victim.id ? "" : `${attacker.nickname} atacou os salteadores!`);
        }
    }

    died(npcId: number, killer?: Player): void {
        const ambush = this.byNpc.get(npcId);
        if (ambush !== undefined && !ambush.deadAt.has(npcId)) {
            const now = this.now();
            ambush.deadAt.set(npcId, now);
            // His purse to those who fought him, the killing blow's player among them (2026-11-02): the leader's holds what a victim paid.
            const struck = ambush.hitters.get(npcId) ?? new Map<number, number>();
            if (killer !== undefined) {
                struck.set(killer.id, now);
            }
            ambush.hitters.delete(npcId);
            const corpse = Npc.getById(npcId);
            if (corpse !== null) {
                sharePurse(corpse, struck, now);
            }
        }
    }

    removed(npcId: number): void {
        const ambush = this.byNpc.get(npcId);
        if (ambush === undefined) {
            return;
        }
        this.byNpc.delete(npcId);
        const index = ambush.gang.indexOf(npcId);
        if (index >= 0) {
            ambush.gang.splice(index, 1);
        }
        if (ambush.gang.length === 0) {
            this.ambushes.delete(ambush.id);
            if (ambush.session !== 0) {
                this.bySession.delete(ambush.session);
                Dialogue.close(ambush.session);
            }
        }
    }

    /** A player left: the gang after them leaves too. */
    gone(player: Player): void {
        this.lastSeen.delete(player.id);
        for (const ambush of [...this.ambushes.values()]) {
            if (ambush.victim.id === player.id && (ambush.stage === "approach" || ambush.stage === "demand" || ambush.stage === "fight")) {
                this.leave(ambush, "");
            }
        }
    }

    private noted = 0;
    private notedAt = 0;

    /** One line in the log about a bandit of a gang (at most forty a minute): what he was told, who runs him, how far he is. */
    private note(npc: Npc, target: Player, what: string): void {
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
        console.log(`ambush: salteador ${npc.id} e ${target.nickname}, a ${Math.round(flat(npc.position, target.position))} m: ${what}; ${npc.status}, ${runner === null || runner === undefined ? "PARADO (nenhum jogo o roda)" : `rodado por ${runner.nickname}`}`);
    }

    /**
     * A man of the gang is run by the game of the one he fights when his own runner is far off (2026-11-01, as the camps' men are, `bandits.ts`): the game that runs a body
     * judges the blows on it, and a man pinned to a victim who ran off dodged the blows of whoever stayed to fight him.
     */
    private runByTarget(npc: Npc, target: Player): void {
        const runner = npc.simulator;
        if (runner !== null && runner !== undefined && runner.id === target.id) {
            return;
        }
        const range = flat(npc.position, target.position);
        if (range > banditSettings.fightRunM) {
            return;
        }
        const there = runner === null || runner === undefined ? Number.POSITIVE_INFINITY : flat(runner.position, npc.position);
        if (there <= Math.max(banditSettings.fightRunNearM, range + banditSettings.fightRunGapM)) {
            return;
        }
        npc.pin(target);
        this.note(npc, target, `preso ao jogo do alvo (${runner === null || runner === undefined ? "ninguém o rodava" : `o jogo de ${runner.nickname}, a ${Math.round(there)} m dele, o rodava`})`);
    }

    /**
     * A bandit who has stood where he is for `stillMs`, farther than `chaseFromM` from `target`, is sent running at it along
     * the server's route. True when he was.
     */
    private chase(ambush: Ambush, npc: Npc, target: Player, now: number): boolean {
        const here = npc.position;
        const seen = ambush.watch.get(npc.id);
        if (seen === undefined || flat(here, seen) > 0.7) {
            ambush.watch.set(npc.id, { x: here.x, y: here.y, at: now, chaseAt: seen?.chaseAt ?? 0 });
            return false;
        }
        if (now - seen.at < this.settings.stillMs || now < seen.chaseAt || flat(here, target.position) <= this.settings.chaseFromM) {
            return false;
        }
        seen.chaseAt = now + this.settings.chaseEveryMs;
        // The victim's game runs him: pinned again, in case the pin was lost (the victim went out of range and came back).
        npc.pin(target.id === ambush.victim.id ? ambush.victim : target);
        const goal = target.position;
        const sent = npc.moveTo(new Vector3(goal.x, goal.y, goal.z), { speed: banditSettings.chaseSpeed, radius: 1.8, pathfinding: Navigation.ready ? "server" : "game" });
        this.note(npc, target, `parado há ${Math.round((now - seen.at) / 1000)} s: mandado correr até ele (${sent ? "aceito" : "RECUSADO"})`);
        ambush.orderedAt.set(npc.id, now - this.settings.retryMs);
        return true;
    }

    private nearestPlayer(point: Vector3): number {
        let nearest = Number.POSITIVE_INFINITY;
        for (const player of Player.all()) {
            if (player.ready) {
                nearest = Math.min(nearest, distanceBetween(player.position, point));
            }
        }
        return nearest;
    }

    tick(): void {
        const now = this.now();
        for (const ambush of [...this.ambushes.values()]) {
            const victimHere = Player.getById(ambush.victim.id) === ambush.victim && ambush.victim.ready;
            const gang = this.living(ambush);

            // The dead lie where they fell for a while, for their pockets; the living who are done go.
            for (const id of [...ambush.gang]) {
                const npc = Npc.getById(id);
                if (npc === null) {
                    this.removed(id);
                    continue;
                }
                const diedAt = ambush.deadAt.get(id);
                if (diedAt !== undefined && now - diedAt >= this.settings.corpseMs && this.nearestPlayer(npc.position) > this.settings.corpseClearM) {
                    npc.remove();
                }
            }
            if (!this.ambushes.has(ambush.id)) {
                continue;
            }

            if (ambush.stage === "approach") {
                const leader = Npc.getById(ambush.leader);
                if (!victimHere || !ambush.victim.alive || gang.length === 0) {
                    this.leave(ambush, "");
                } else if (leader !== null && leader.alive && distanceBetween(leader.position, ambush.victim.position) <= this.settings.demandRangeM) {
                    if (ambush.kind === "cumans") {
                        // Cumans do not bargain.
                        speak(leader, ROBBER, "Hayde! Hayde!", { radiusM: 45 });
                        this.fight(ambush, "Cumanos! Eles atacam sem dizer palavra.");
                    } else {
                        this.makeDemand(ambush);
                    }
                } else if (now - ambush.since >= this.settings.approachMs) {
                    this.leave(ambush, "");
                } else {
                    for (const npc of gang) {
                        if (this.chase(ambush, npc, ambush.victim, now)) {
                            continue;
                        }
                        if (now - (ambush.orderedAt.get(npc.id) ?? 0) >= this.settings.retryMs * 2) {
                            npc.follow(ambush.victim, { speed: banditSettings.chaseSpeed, radius: 3 });
                            ambush.orderedAt.set(npc.id, now);
                        }
                    }
                }
                continue;
            }

            if (ambush.stage === "demand") {
                if (!victimHere || !ambush.victim.alive || gang.length === 0) {
                    this.leave(ambush, "");
                    continue;
                }
                if (ambush.session === 0) {
                    if (Dialogue.sessionOf(ambush.victim.id) === 0) {
                        const session = Dialogue.open(ambush.victim.id, this.demandPage(ambush));
                        if (session !== 0) {
                            ambush.session = session;
                            this.bySession.set(session, ambush);
                        }
                    }
                    if (ambush.session === 0 && now - ambush.since >= 10_000) {
                        this.fight(ambush, "Os salteadores perderam a paciência!");
                    }
                    continue;
                }
                if (now - ambush.since >= this.settings.answerMs) {
                    this.fight(ambush, "Sem resposta, os salteadores atacam!");
                }
                continue;
            }

            if (ambush.stage === "fight") {
                if (gang.length === 0) {
                    tell(ambush.victim, "Os salteadores caíram. O que levavam está com eles.");
                    this.enter(ambush, "over");
                    continue;
                }
                if (!victimHere || !ambush.victim.alive) {
                    this.leave(ambush, "");
                    continue;
                }
                const close = gang.some((npc) => distanceBetween(npc.position, ambush.victim.position) <= this.settings.escapeM);
                if (close) {
                    ambush.seenAt = now;
                } else if (now - ambush.seenAt >= this.settings.escapeMs) {
                    this.leave(ambush, "Você despistou os salteadores.");
                    continue;
                }
                for (const npc of gang) {
                    const target = Player.getById(ambush.targets.get(npc.id) ?? ambush.victim.id) ?? ambush.victim;
                    this.runByTarget(npc, target);
                    if (this.chase(ambush, npc, target, now)) {
                        continue;
                    }
                    // An order that ended (the body stands, or reached its goal) is given again; one that failed, too.
                    const ended = npc.status === "blocked" || npc.status === "failed" || npc.status === "idle" || npc.status === "reached";
                    if (!ambush.orderedAt.has(npc.id) || (ended && now - (ambush.orderedAt.get(npc.id) ?? 0) >= this.settings.retryMs)) {
                        const first = !ambush.orderedAt.has(npc.id);
                        const ordered = npc.attack(target);
                        if (first || !ordered) {
                            this.note(npc, target, `ataque ${ordered ? "ordenado" : "RECUSADO"}`);
                        }
                        ambush.orderedAt.set(npc.id, now);
                    }
                }
                continue;
            }

            if (ambush.stage === "leaving") {
                for (const npc of gang) {
                    const nearest = this.nearestPlayer(npc.position);
                    if (nearest > this.settings.leaveRadiusM || (now - ambush.since >= this.settings.leaveMs && nearest > 40)) {
                        npc.remove();
                    }
                }
                if (this.living(ambush).length === 0 && ambush.deadAt.size === 0) {
                    this.enter(ambush, "over");
                }
            }
        }
    }

    stop(): void {
        for (const ambush of this.ambushes.values()) {
            if (ambush.session !== 0) {
                Dialogue.close(ambush.session);
            }
            for (const id of ambush.gang) {
                Npc.getById(id)?.remove();
            }
        }
        this.ambushes.clear();
        this.byNpc.clear();
        this.bySession.clear();
    }
}

export const ambushes = new Ambushes();

export function installAmbushes(): void {
    ambushes.load();
    Events.on("playerSpawned", (player) => ambushes.arrived(player));
    Events.on("playerDisconnect", (player) => ambushes.gone(player));
    Events.on("dialogueChoice", (session, player, option) => ambushes.choose(session, player, option));
    Events.on("dialogueClosed", (session, _player, reason) => ambushes.closed(session, reason));
    Events.on("npcDeath", (npc, attacker) => ambushes.died(npc.id, typeof attacker === "object" && attacker !== null && "steamId" in attacker ? attacker : undefined));
    Events.on("npcDestroy", (npc) => ambushes.removed(npc.id));
    Events.on("npcDamage", (npc, attacker) => {
        if (attacker !== null && "steamId" in attacker) {
            ambushes.hit(npc.id, attacker);
        }
    });
    // Their hand is as heavy as the camps' bandits'.
    Events.on("playerHit", (_victim, attacker, hit) => {
        if (attacker !== null && typeof attacker === "object" && !("steamId" in attacker) && ambushes.isRoadBandit(attacker.id)) {
            hit.damage *= banditSettings.damageMultiplier;
        }
    });

    const looking = setInterval(() => ambushes.look(), ambushSettings.checkMs);
    const ticking = setInterval(() => ambushes.tick(), 1_000);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(looking);
            clearInterval(ticking);
            ambushes.stop();
        }
    });
    console.log(`ambush: salteadores nas estradas ${ambushes.enabled ? "ligados" : "desligados"} (no máximo ${ambushSettings.maxActive} gangues; a mesma pessoa a cada ${ambushSettings.playerCooldownMs / 60_000} min, no mínimo)`);
}
