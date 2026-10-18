import { labelFor } from "./acquaintances.js";
import { coinsText, dicePots, STAKE_STEPS } from "./dice-pot.js";

const STATE_EVENT = "kcdc-gamemode:dice.state";
const INTERACT_EVENT = "kcdc-gamemode:dice.interact";
const SETUP_TIMEOUT = 60_000;
const DEFAULT_SCORE = 2000;
const MIN_SCORE = 100;
const MAX_SCORE = 100_000;
const SCORE_STEP = 500;

interface Table {
    readonly info: DiceTableInfo;
    readonly area: Area;
    /** Shared by catalog rows that are one physical table on different quest layers. */
    readonly station: string;
}

interface Lobby {
    readonly key: string;
    readonly table: Table;
    readonly world: number;
    readonly members: Set<Member>;
    negotiation?: Negotiation;
    match: number;
}

interface Member {
    readonly player: Player;
    readonly lobby: Lobby;
    readonly seat: string;
}

interface Invitation {
    readonly first: Player;
    readonly second: Player;
    readonly table: Table;
    readonly score: number;
    readonly deadline: number;
}

/** A line for each player it is sent to: names are what that player knows the other by (`acquaintances.ts`). */
type Message = string | ((viewer: Player) => string);

const say = (viewer: Player, message: Message): void => Chat.sendToPlayer(viewer, typeof message === "function" ? message(viewer) : message);

/** "Você saiu" to the one who did it, "Hans saiu" (or "Desconhecido saiu") to the other. */
const about = (actor: Player, mine: string, theirs: string): Message => (viewer) => (viewer.id === actor.id ? mine : `${labelFor(viewer, actor)} ${theirs}`);

interface Negotiation {
    readonly players: [Member, Member];
    readonly sessions: Map<number, number>;
    readonly accepted: Set<number>;
    turn: 0 | 1;
    score: number;
    /** Coins each puts in, taken when the match starts (`dice-pot.ts`); 0 for none. */
    stake: number;
    deadline: number;
}

/** "apostando 10 moedas cada", or "sem aposta". */
const stakeText = (stake: number): string => (stake === 0 ? "sem aposta" : `apostando ${coinsText(stake)} cada`);

/** The keys of the game's dice table, said to both when a match starts. */
const TABLE_KEYS = "Teclas padrão da mesa: E marca um dado, F pontua e joga o resto, Q pontua e passa a vez; segure Esc para desistir. No controle: A marca, X pontua, Y passa, segure B.";

/** How near a table a player stands to play at it: the radius of the table's area. */
const TABLE_REACH_M = 3;

/** Retries of a table list that came back empty at start, in case the level was not there yet. */
const TABLE_RETRY_MS = [30_000, 120_000];

/** Readiness and consent belong to this resource; Dice owns the actual match. */
class DiceLobby {
    private readonly offers = new Map<number, { token: number; tables: Table[]; state: string }>();
    private readonly tables: Table[] = [];
    private readonly lobbies = new Map<string, Lobby>();
    private readonly members = new Map<number, Member>();
    private readonly invitations = new Map<number, Invitation>();
    /** The tables whose area each player stands in, from areaEnter/areaExit. */
    private readonly inside = new Map<number, Set<Table>>();
    private nextToken = 1;

    install(): void {
        Messages.handle("playground:freeDice", (payload, reply) => {
            const id = typeof payload === "object" && payload !== null ? (payload as { player?: unknown }).player : undefined;
            const player = typeof id === "number" ? Player.getById(id) : null;
            reply(player ? this.teleportToFreeTable(player) : { error: "No such player." });
        });
        if (this.setupTables() === 0) {
            for (const delay of TABLE_RETRY_MS) setTimeout(() => { if (this.tables.length === 0) this.setupTables(); }, delay);
        }
        const timer = setInterval(() => this.tick(), 250);
        Events.onClient("kcdc-gamemode:dice.sync", (sender) => this.offer(sender as Player, true));
        Events.onClient(INTERACT_EVENT, (sender, payload) => {
            let state: unknown;
            try {
                state = typeof payload === "string" ? payload.length <= 128 ? JSON.parse(payload) : null : payload;
            } catch { return; }
            if (!state || typeof state !== "object") return;
            const player = sender as Player;
            const previous = this.offers.get(player.id);
            this.refresh(player);
            const offer = this.offers.get(player.id);
            if (offer && offer === previous && offer.token === (state as Record<string, unknown>).token) {
                const table = offer.tables.find((table) => table.info.id === (state as Record<string, unknown>).table);
                if (!table) return;
                const member = this.members.get(player.id);
                if (member) this.cancelFor(player);
                else {
                    try { this.join(player, table); }
                    catch (error) { Chat.sendToPlayer(player, error instanceof Error ? error.message : String(error)); }
                }
            }
            this.offer(player, true);
        });
        Events.on("dialogueChoice", (session, player, option) => this.choose(session, player, option));
        Events.on("dialogueClosed", (session, player) => {
            const member = this.members.get(player.id);
            if (member?.lobby.negotiation?.sessions.get(player.id) === session) this.cancel(member.lobby, about(player, "Você saiu do jogo de dados.", "saiu do jogo de dados."));
        });
        Events.on("playerDisconnect", (player) => { this.leave(player); this.offers.delete(player.id); this.inside.delete(player.id); });
        Events.on("playerDied", (player) => this.leave(player));
        Events.on("playerSpawning", (player) => this.leave(player));
        Events.on("areaEnter", (area, entity) => {
            const table = this.tables.find((table) => table.area.id === area.id);
            if (!table || !(entity instanceof Player)) return;
            const tables = this.inside.get(entity.id) ?? new Set<Table>();
            tables.add(table);
            this.inside.set(entity.id, tables);
            this.refresh(entity);
        });
        Events.on("areaExit", (area, entity) => {
            const table = this.tables.find((table) => table.area.id === area.id);
            if (!table || !(entity instanceof Player)) return;
            const tables = this.inside.get(entity.id);
            tables?.delete(table);
            if (!tables?.size) this.inside.delete(entity.id);
            if (this.members.get(entity.id)?.lobby.table === table || this.invitations.get(entity.id)?.table === table) this.leave(entity);
            this.refresh(entity);
        });
        Events.on("diceMatchStart", (_match, first, second) => {
            this.leave(first);
            this.leave(second);
        });
        Events.on("diceMatchEnd", (match) => {
            for (const lobby of this.lobbies.values()) {
                if (lobby.match === match) lobby.match = 0;
            }
        });
        Events.on("resourceStop", (name) => {
            if (name !== "kcdc-gamemode") return;
            clearInterval(timer);
            for (const lobby of this.lobbies.values()) {
                this.cancel(lobby);
                if (lobby.match) Dice.stop(lobby.match);
            }
            for (const member of [...this.members.values()]) this.leave(member.player);
            for (const table of this.tables) table.area.destroy();
        });
    }

    /** One area per table of the level. Returns how many tables there are; said in the log, since nothing works without them. */
    private setupTables(): number {
        for (const info of Dice.tables()) {
            if (this.tables.some((table) => table.info.id === info.id)) continue;
            const area = Area.create({ id: `kcdc-gamemode:dice:${info.id}`, name: "Dice table", type: "sphere", position: new Vector3(info.position.x, info.position.y, info.position.z), radius: TABLE_REACH_M, labels: ["dice"] });
            // Quest layers can place the same table twice; both rows seat the same chairs.
            const twin = this.tables.find((other) => Math.hypot(other.info.position.x - info.position.x, other.info.position.y - info.position.y, other.info.position.z - info.position.z) < 1);
            this.tables.push({ info, area, station: twin?.station ?? info.id });
        }
        const stations = new Set(this.tables.map((table) => table.station)).size;
        console.log(this.tables.length === 0 ? "dice: o nível ainda não listou nenhuma mesa de dados" : `dice: ${stations} mesas de dados no nível (${this.tables.length} contando as camadas de missão)`);
        return this.tables.length;
    }

    /** Whether `player` stands at `table`: by the area's own events, or by the distance, in case an event was missed. */
    private at(player: Player, table: Table): boolean {
        return this.inside.get(player.id)?.has(table) === true || this.distance(player, table) <= TABLE_REACH_M;
    }

    private eligible(player: Player, table: Table, world: number): boolean {
        return player.ready && player.health > 0 && player.virtualWorld === world && table.area.exists && table.area.enabled && (table.area.containsPlayer(player) || this.distance(player, table) <= TABLE_REACH_M) && Dice.matchOf(player.id) === 0;
    }

    /** Server-resource request only. Waiting lobbies and invitations occupy a table too. */
    private teleportToFreeTable(player: Player): { message?: string; error?: string } {
        if (!player.ready || !player.alive || player.mounted || Dice.matchOf(player.id) || Crafting.session(player)) return { error: "Leave the current activity before teleporting." };
        const tables = this.tables.filter((table) => {
            if (table.info.id !== table.station) return false;
            const lobby = this.lobbies.get(`${player.virtualWorld}:${table.station}`);
            if (lobby && (lobby.match || lobby.negotiation || lobby.members.size)) return false;
            if ([...this.invitations.values()].some((invitation) => invitation.first.virtualWorld === player.virtualWorld && invitation.table.station === table.station)) return false;
            // Also cover direct Dice.start callers and people using the chairs.
            return !Player.all().some((other) => other.id !== player.id && other.ready && (other.virtualWorld === player.virtualWorld || other.virtualWorld === -1) && this.distance(other, table) < 3);
        }).sort((a, b) => this.distance(player, a) - this.distance(player, b));
        const table = tables[0];
        if (!table) return { error: "No unoccupied dice table is available in this level." };
        const p = table.info.position;
        // Use the server navmesh when supplied, otherwise the teleport's native
        // grounding handles the catalog height as it does for /tp.
        const approach = new Vector3(p.x + 2, p.y, p.z);
        const floor = Navigation.ready ? Navigation.closestPoint(approach, { searchRadius: 2, searchHeight: 2 }) : approach;
        if (!floor || !player.teleport(floor, "Nearest free dice table")) return { error: "Could not move to the nearest free dice table." };
        return { message: "Teleport requested to the nearest unoccupied dice table. Quest-layer tables may need their area to load." };
    }

    private distance(player: Player, table: Table): number {
        const p = player.position, q = table.info.position;
        return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    }

    private refresh(player: Player): void {
        const member = this.members.get(player.id);
        if (member && !this.eligible(player, member.lobby.table, member.lobby.world)) this.leave(player);
        this.offer(player);
    }

    private offer(player: Player, force = false): void {
        const member = this.members.get(player.id);
        const candidates = member ? [member.lobby.table] : this.tables.filter((table) => this.at(player, table) && this.eligible(player, table, player.virtualWorld));
        const tables = candidates.filter((table) => {
            const lobby = this.lobbies.get(`${player.virtualWorld}:${table.station}`);
            return !lobby?.match && !lobby?.negotiation && !Dialogue.sessionOf(player.id) && !this.invitations.has(player.id) && (!!member || (lobby?.members.size ?? 0) < 2);
        });
        const payload = { tables: tables.map((table) => table.info), joined: !!member, world: player.virtualWorld };
        const state = JSON.stringify(payload);
        if (!force && this.offers.get(player.id)?.state === state) return;
        const token = this.nextToken++;
        this.offers.set(player.id, { token, tables, state });
        player.emit(STATE_EVENT, JSON.stringify({ token, ...payload }));
    }

    private enroll(player: Player, table: Table): Member {
        if (!this.eligible(player, table, player.virtualWorld) || Dialogue.sessionOf(player.id) || this.members.has(player.id)) throw new Error("Chegue perto da mesa de dados e termine qualquer outra conversa antes.");
        const key = `${player.virtualWorld}:${table.station}`;
        let lobby = this.lobbies.get(key);
        if (!lobby) {
            lobby = { key, table, world: player.virtualWorld, members: new Set(), match: 0 };
            this.lobbies.set(key, lobby);
        }
        if (lobby.match || lobby.negotiation || lobby.members.size >= 2) throw new Error("Essa mesa de dados está ocupada.");
        const seat = lobby.table.info.seats.find((seat) => ![...lobby!.members].some((member) => member.seat === seat))!;
        const member = { player, lobby, seat };
        this.members.set(player.id, member);
        lobby.members.add(member);
        return member;
    }

    private join(player: Player, table: Table): void {
        const member = this.enroll(player, table);
        const opponent = [...member.lobby.members].find((other) => other !== member);
        if (opponent) this.begin(opponent, member, DEFAULT_SCORE);
        else {
            Chat.sendToPlayer(player, "Pronto para os dados. Esperando outra pessoa; use a mesa de novo ou afaste-se para sair.");
            this.offer(player, true);
        }
    }

    private updateHints(lobby: Lobby): void {
        for (const member of lobby.members) this.offer(member.player, true);
    }

    private leave(player: Player): void {
        const left = about(player, "Você saiu da mesa de dados.", "saiu da mesa de dados.");
        this.cancelInvitation(player.id, left);
        const member = this.members.get(player.id);
        if (!member) return;
        if (member.lobby.negotiation?.players.includes(member)) this.cancel(member.lobby, left);
        member.lobby.members.delete(member);
        this.members.delete(player.id);
        this.offer(player, true);
    }

    private tick(): void {
        // Only players standing at a table can change what they are offered (or who just walked off one: their offer
        // still lists it).
        for (const player of Player.all()) {
            const offered = (this.offers.get(player.id)?.tables.length ?? 0) > 0;
            if (this.inside.has(player.id) || this.members.has(player.id) || offered || this.tables.some((table) => this.distance(player, table) <= TABLE_REACH_M)) this.refresh(player);
        }
        for (const invitation of new Set(this.invitations.values())) {
            if (Date.now() >= invitation.deadline) this.cancelInvitation(invitation.first.id, "O convite para os dados expirou.");
        }
        for (const lobby of this.lobbies.values()) {
            if (lobby.negotiation && Date.now() >= lobby.negotiation.deadline) this.cancel(lobby, "O acerto dos dados demorou demais. Use a mesa de novo para tentar outra vez.");
            if (!lobby.members.size && !lobby.match) this.lobbies.delete(lobby.key);
        }
    }

    private pairValid(first: Member, second: Member): boolean {
        return first !== second && first.lobby === second.lobby && first.seat !== second.seat && !first.lobby.match && [first, second].every((member) => this.members.get(member.player.id) === member && this.eligible(member.player, member.lobby.table, member.lobby.world));
    }

    private begin(first: Member, second: Member, score: number): void {
        if (!this.pairValid(first, second) || [first, second].some((member) => Dialogue.sessionOf(member.player.id) !== 0)) {
            this.cancel(first.lobby);
            for (const member of [first, second]) Chat.sendToPlayer(member.player, "Os dois precisam estar livres e junto da mesma mesa de dados.");
            return;
        }
        first.lobby.negotiation = { players: [first, second], sessions: new Map(), accepted: new Set(), turn: 0, score, stake: 0, deadline: Date.now() + SETUP_TIMEOUT };
        this.updateHints(first.lobby);
        this.show(first.lobby);
    }

    private show(lobby: Lobby): void {
        const negotiation = lobby.negotiation;
        if (!negotiation) return;
        const active = negotiation.players[negotiation.turn];
        const stake = negotiation.stake;
        const more = STAKE_STEPS.find((step) => step > stake);
        const less = [...STAKE_STEPS].reverse().find((step) => step < stake);
        // A stake is only raised to what the one raising it carries; the other's purse is looked at when both have agreed.
        const affords = more !== undefined && dicePots.coinsOf(active.player) >= more;
        for (const member of negotiation.players) {
            const page: DialoguePage = {
                line: member === active ? `Primeiro a ${negotiation.score} pontos, ${stakeText(stake)}. Aceite ou proponha outra coisa.` : `${labelFor(member.player, active.player)} está escolhendo: primeiro a ${negotiation.score} pontos, ${stakeText(stake)}. Você ainda pode desistir.`,
                options: member === active ? [
                    { id: "agree", text: negotiation.accepted.size ? `Aceitar: até ${negotiation.score} pontos, ${stakeText(stake)}.` : `Propor: até ${negotiation.score} pontos, ${stakeText(stake)}.` },
                    { id: "lower", text: `Baixar para ${Math.max(MIN_SCORE, negotiation.score - SCORE_STEP)} pontos.`, enabled: negotiation.score > MIN_SCORE },
                    { id: "raise", text: `Subir para ${Math.min(MAX_SCORE, negotiation.score + SCORE_STEP)} pontos.`, enabled: negotiation.score < MAX_SCORE },
                    { id: "stakeUp", text: more === undefined ? "Apostar mais." : affords ? `Apostar ${coinsText(more)} cada.` : `Apostar ${coinsText(more)} cada (você não tem).`, enabled: affords },
                    { id: "stakeDown", text: less === undefined ? "Apostar menos." : less === 0 ? "Jogar sem aposta." : `Apostar só ${coinsText(less)} cada.`, enabled: less !== undefined },
                    { id: "quit", text: "Não quero jogar." },
                ] : [
                    { id: "quit", text: "Não quero jogar." },
                    { id: "waiting", text: `Esperando ${labelFor(member.player, active.player)}: até ${negotiation.score} pontos, ${stakeText(stake)}.`, enabled: false },
                ],
            };
            const existing = negotiation.sessions.get(member.player.id);
            const session = existing === undefined ? Dialogue.open(member.player.id, page) : Dialogue.update(existing, page) ? existing : 0;
            if (!session) {
                this.cancel(lobby, "A conversa dos dados não abriu. Use a mesa de novo.");
                return;
            }
            negotiation.sessions.set(member.player.id, session);
        }
    }

    private choose(session: number, player: Player, option: string): void {
        const member = this.members.get(player.id);
        const negotiation = member?.lobby.negotiation;
        if (!member || !negotiation || negotiation.sessions.get(player.id) !== session) return;
        if (Date.now() >= negotiation.deadline || !this.pairValid(...negotiation.players)) {
            this.cancel(member.lobby, "O jogo de dados não está mais disponível.");
            return;
        }
        if (option === "quit") {
            this.cancel(member.lobby, about(player, "Você desistiu do jogo de dados.", "desistiu do jogo de dados."));
            return;
        }
        if (negotiation.players[negotiation.turn] !== member) return;
        if (option === "lower" || option === "raise") {
            const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, negotiation.score + (option === "lower" ? -SCORE_STEP : SCORE_STEP)));
            if (score === negotiation.score) return;
            negotiation.score = score;
            negotiation.accepted.clear();
        } else if (option === "stakeUp" || option === "stakeDown") {
            const stake = option === "stakeUp" ? STAKE_STEPS.find((step) => step > negotiation.stake) : [...STAKE_STEPS].reverse().find((step) => step < negotiation.stake);
            if (stake === undefined || (option === "stakeUp" && dicePots.coinsOf(player) < stake)) return;
            negotiation.stake = stake;
            negotiation.accepted.clear();
        } else if (option === "agree") {
            negotiation.accepted.add(player.id);
            if (negotiation.accepted.size === 2) {
                this.start(member.lobby, negotiation);
                return;
            }
            negotiation.turn = negotiation.turn === 0 ? 1 : 0;
            negotiation.deadline = Date.now() + SETUP_TIMEOUT;
        } else {
            return;
        }
        this.show(member.lobby);
    }

    private start(lobby: Lobby, negotiation: Negotiation): void {
        // Detach before close: dialogueClosed is synchronous and means cancel
        // only while these sessions still belong to a pending negotiation.
        this.cancel(lobby);
        const first = negotiation.players.find((member) => member.seat === lobby.table.info.seats[0])!;
        const second = negotiation.players.find((member) => member !== first)!;
        // The stake from both, and their dice out of the inventory for the match (the game's own dice screen stays away).
        const pot = dicePots.hold(first.player, second.player, negotiation.stake);
        if ("short" in pot) {
            for (const member of negotiation.players) say(member.player, about(pot.short, `Você não tem ${coinsText(negotiation.stake)} para a aposta.`, `não tem ${coinsText(negotiation.stake)} para a aposta.`));
            return;
        }
        try {
            // The scoreboard shows each player as the other knows them: a name once introduced, "Desconhecido" before.
            lobby.match = Dice.start(first.player.id, second.player.id, { targetScore: negotiation.score, firstName: labelFor(second.player, first.player), secondName: labelFor(first.player, second.player) });
            dicePots.bind(pot, lobby.match);
            this.updateHints(lobby);
        } catch (error) {
            dicePots.release(pot, [first.player, second.player]);
            for (const member of negotiation.players) Chat.sendToPlayer(member.player, `Os dados não puderam começar: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        for (const [index, member] of [first, second].entries()) {
            if (pot.stake > 0) Chat.sendToPlayer(member.player, `Aposta: ${coinsText(pot.stake)} de cada um, guardadas até o fim; quem vencer leva ${coinsText(pot.stake * 2)}. Quem desistir depois do primeiro lance perde a sua.`);
            if ((pot.seats[index]?.items.length ?? 0) > 0) Chat.sendToPlayer(member.player, "Seus dados ficam guardados durante o jogo e voltam no fim: a mesa joga com os dados comuns.");
            Chat.sendToPlayer(member.player, TABLE_KEYS);
        }
    }

    private cancel(lobby: Lobby, message?: Message): void {
        const negotiation = lobby.negotiation;
        lobby.negotiation = undefined;
        if (negotiation) {
            for (const session of negotiation.sessions.values()) Dialogue.close(session);
            if (message) for (const member of negotiation.players) say(member.player, message);
        }
        for (const member of [...lobby.members]) {
            lobby.members.delete(member);
            this.members.delete(member.player.id);
            this.offer(member.player, true);
        }
    }

    private cancelInvitation(playerId: number, message?: Message): void {
        const invitation = this.invitations.get(playerId);
        if (!invitation) return;
        for (const player of [invitation.first, invitation.second]) this.invitations.delete(player.id);
        for (const player of [invitation.first, invitation.second]) {
            if (message) say(player, message);
            this.offer(player, true);
        }
    }

    cancelFor(player: Player): void {
        this.cancelInvitation(player.id, about(player, "Você recusou o convite para os dados.", "recusou o convite para os dados."));
        const member = this.members.get(player.id);
        if (!member) return;
        if (member.lobby.negotiation?.players.includes(member)) this.cancel(member.lobby, about(player, "Você desistiu do jogo de dados.", "desistiu do jogo de dados."));
        else this.leave(player);
    }

    /**
     * Invites `opponent` to the dice table both stand at. `quiet` leaves out the chat lines that tell the opponent to
     * answer with `/dice accept`, for an invitation that has already been answered elsewhere (`pair`).
     */
    async invite(player: Player, opponent: Player, score: number, quiet = false): Promise<void> {
        if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) throw new Error("A pontuação é um número inteiro de 100 a 100000.");
        if (player === opponent || player.virtualWorld !== opponent.virtualWorld) throw new Error("Escolha outra pessoa.");
        const world = player.virtualWorld;
        const nearby = await World.entitiesInRadius(player, player.position, 6, { class: "SmartObjectHolder", max: 64 });
        if (!nearby.answered) throw new Error("Não consegui conferir as mesas de dados por perto. Tente de novo.");
        const loaded = new Set(nearby.entities.map((entity) => entity.guid));
        const table = this.tables.filter((table) => loaded.has(table.info.id) && this.eligible(player, table, world) && this.eligible(opponent, table, world)).sort((a, b) => this.distance(player, a) + this.distance(opponent, a) - this.distance(player, b) - this.distance(opponent, b))[0];
        if (!table) throw new Error("Os dois precisam estar junto da mesma mesa de dados.");
        if ([player, opponent].some((p) => this.members.has(p.id) || this.invitations.has(p.id) || Dialogue.sessionOf(p.id))) throw new Error("Um de vocês já está esperando um jogo ou numa conversa.");
        const lobby = this.lobbies.get(`${world}:${table.station}`);
        if (lobby && (lobby.match || lobby.negotiation || lobby.members.size)) throw new Error("Essa mesa de dados está ocupada.");
        // Seats are taken on acceptance, so an unanswered invitation never blocks the table.
        const invitation = { first: player, second: opponent, table, score, deadline: Date.now() + SETUP_TIMEOUT };
        for (const invited of [player, opponent]) {
            this.invitations.set(invited.id, invitation);
            this.offer(invited, true);
        }
        if (quiet) return;
        Chat.sendToPlayer(opponent, `${labelFor(opponent, player)} convida você para jogar dados, primeiro a ${score} pontos. /dice accept para aceitar, /dice decline para recusar.`);
        Chat.sendToPlayer(player, "Convite enviado. /dice cancel desiste.");
    }

    accept(player: Player): void {
        const invitation = this.invitations.get(player.id);
        if (!invitation || invitation.second.id !== player.id) throw new Error("Ninguém convidou você para os dados.");
        this.cancelInvitation(player.id);
        if (Date.now() >= invitation.deadline) throw new Error("Esse convite para os dados expirou.");
        const first = this.enroll(invitation.first, invitation.table);
        let second: Member;
        try { second = this.enroll(invitation.second, invitation.table); }
        catch (error) { this.leave(invitation.first); throw error; }
        this.begin(first, second, invitation.score);
    }

    /** Whether two players stand at the same dice table, which a game between them needs. */
    sameTable(a: Player, b: Player): boolean {
        if (a.virtualWorld !== b.virtualWorld) return false;
        const mine = new Set(this.tables.filter((table) => this.at(a, table)).map((table) => table.station));
        return this.tables.some((table) => mine.has(table.station) && this.at(b, table));
    }

    /**
     * For the log, when the talk menu found no table the two share: how far each stands from the nearest table. Null
     * when neither is anywhere near one (nobody tried to play dice), so walking around writes nothing.
     */
    explainApart(a: Player, b: Player): string | null {
        if (this.tables.length === 0) return "o nível não listou nenhuma mesa de dados";
        const nearest = (player: Player) => this.tables.reduce((best, table) => (this.distance(player, table) < this.distance(player, best) ? table : best));
        const [first, second] = [nearest(a), nearest(b)];
        if (this.distance(a, first) > 10 && this.distance(b, second) > 10) return null;
        const side = (player: Player, table: Table) => `${player.nickname} a ${this.distance(player, table).toFixed(1)} m da mesa ${table.info.id}${this.inside.get(player.id)?.has(table) ? " (dentro da área)" : ""}`;
        return `${side(a, first)}; ${side(b, second)}; alcance ${TABLE_REACH_M} m${a.virtualWorld !== b.virtualWorld ? "; mundos diferentes" : ""}`;
    }

    /** Two players who already agreed to play (the talk menu, `encounters.ts`): seated at the table they share to agree the score. */
    async pair(first: Player, second: Player, score = DEFAULT_SCORE): Promise<void> {
        // Agreed with each other, neither keeps waiting at the table for whoever comes (an earlier "[E] Jogar dados").
        for (const player of [first, second]) {
            const member = this.members.get(player.id);
            if (member && !member.lobby.negotiation && !member.lobby.match) this.leave(player);
        }
        await this.invite(first, second, score, true);
        this.accept(second);
    }
}

export const diceLobby = new DiceLobby();
