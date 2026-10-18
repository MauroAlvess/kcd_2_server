/**
 * The players who support the server, and what that brings them.
 *
 * A player who wants to help pays by Pix (the "Apoiador" page of the status panel shows how) and sends the receipt on
 * Discord; an administrator then hands the benefits over from the "Jogadores" page. Nothing here sees a payment: the
 * administrator's word is the proof. The benefits are:
 *
 * - **a set of noble clothes**, from the game's own noble outfits, for the body the player chose, put in the inventory
 *   for them to wear (a second hand-over gives a second set);
 * - **firearms** (2026-10-17): one musket (the game's "Arcabuz", `hookgunNormal01`: its only long gun), one hand cannon
 *   (the "Bombarda de mão", `handgonneNormal01`) and ten balls to load them with (`shot_ball`), each hand-over;
 * - **a dog**, the game's own companion. A dog goes when its owner leaves the server, so the server brings it back at
 *   every entry. `/cachorro` calls it, names it and tells it to follow or wait.
 *
 * Kept by Steam id in `playerdata/supporters.json`.
 */

import { getCharacter } from "./characters.js";
import { inFrontOf } from "./place.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/supporters.json`;

/** How far in front of its owner a dog is brought. */
const DOG_DISTANCE = 1.6;
/** A dog is brought this long after its owner's body is in the world, so their game is ready to run it. */
export const DOG_DELAY_MS = 6_000;
/** `/cachorro` brings the dog anew; not more often than this. */
export const CALL_COOLDOWN_MS = 10_000;

export const DOG_NAME_MIN = 2;
export const DOG_NAME_MAX = 24;

/** The dog's companion modes the command offers, by the game's own numbers (`E_DogCompanionMode`). */
export const DOG_ORDERS: Readonly<Record<string, { readonly mode: number; readonly said: string }>> = {
    seguir: { mode: 1, said: "Seu cão vai seguir você." },
    esperar: { mode: 0, said: "Seu cão vai esperar aqui." },
};

export interface SupporterRecord {
    /** When the benefits were first handed over, and the last time. */
    since: number;
    last: number;
    times: number;
    /** The administrator who handed them over last. */
    by: string;
    /** The player's nickname when last seen, for whoever reads the file. */
    name: string;
    /** What the dog is called, or "" for the name the game gives it. */
    dogName: string;
}

interface ClothingPiece {
    readonly item: string;
    readonly label: string;
}

/** A noble's clothes for each body, from the game's noble outfits (`noble_*` and `f_noble_*` in clothing_preset.xml). */
export const NOBLE_CLOTHES: Readonly<Record<"male" | "female", readonly ClothingPiece[]>> = {
    male: [
        { item: "TunicShort04_m07_A", label: "gibão do cortesão" },
        { item: "HoseJoined02_m12_B", label: "meias do cortesão" },
        { item: "BootsKnee01_m06_C", label: "botas de nobre" },
        { item: "Gloves06_m02_A2", label: "luvas de nobre" },
        { item: "Cap18_m07_A", label: "chapéu de nobre" },
        { item: "Hood03_m03_A", label: "capuz de brocado" },
    ],
    female: [
        { item: "F_Cotehardie01_m06_B", label: "cotehardie de mulher da nobreza" },
        { item: "F_Cotehardie03_m09_A", label: "cotehardie de mulher da nobreza, de outra cor" },
        { item: "F_Shoes01_m10_A", label: "sapatos femininos" },
        { item: "F_Veil01_m01_B", label: "véu com babados" },
        { item: "F_HairDecor04_m02_B", label: "acessório de cabeça decorado" },
    ],
};

/** What a hand-over adds besides the clothes: a musket, a hand cannon and ten balls for them. */
export const SUPPORTER_ARMS: readonly { readonly item: string; readonly amount: number; readonly label: string }[] = [
    { item: "hookgunNormal01", amount: 1, label: "mosquete (arcabuz)" },
    { item: "handgonneNormal01", amount: 1, label: "canhão de mão (bombarda de mão)" },
    { item: "shot_ball", amount: 10, label: "10 balas" },
];

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

const STEAM_ID = /^\d{5,20}$/;

function bodyOf(player: Player): "male" | "female" {
    const chosen = getCharacter(player.steamId)?.appearance.gender ?? player.appearance.gender;
    return chosen === "female" ? "female" : "male";
}

/** What of the arms went in, in a phrase: all of them, or which did not. */
function armsHanded(refused: readonly { readonly label: string }[]): string {
    return refused.length === 0 ? "um mosquete, um canhão de mão e 10 balas" : `parte das armas (faltou: ${refused.map((arm) => arm.label).join(", ")})`;
}

function date(at: number): string {
    const day = new Date(at);
    const two = (n: number): string => String(n).padStart(2, "0");
    return `${two(day.getDate())}/${two(day.getMonth() + 1)}/${day.getFullYear()}`;
}

export class Supporters {
    private records: Record<string, SupporterRecord> = {};
    /** False while the file could not be read: nothing is written over it then. */
    private writable = true;
    private readonly calledAt = new Map<number, number>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    load(): void {
        const loaded = read<Record<string, unknown>>(FILE);
        if (loaded.status === "corrupt") {
            this.writable = false;
            console.log(`supporters: ${FILE} ilegível (${loaded.reason}); nada será gravado por cima até que seja consertado`);
            return;
        }
        if (loaded.status !== "ok" || typeof loaded.value !== "object" || loaded.value === null) {
            return;
        }
        for (const [steamId, raw] of Object.entries(loaded.value)) {
            if (!STEAM_ID.test(steamId) || typeof raw !== "object" || raw === null) {
                continue;
            }
            const entry = raw as Partial<SupporterRecord>;
            const number = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
            const text = (value: unknown): string => (typeof value === "string" ? value : "");
            const since = number(entry.since, 0);
            this.records[steamId] = {
                since,
                last: number(entry.last, since),
                times: Math.max(1, Math.floor(number(entry.times, 1))),
                by: text(entry.by),
                name: text(entry.name),
                dogName: text(entry.dogName).slice(0, DOG_NAME_MAX),
            };
        }
    }

    private persist(): void {
        if (!this.writable) {
            return;
        }
        try {
            ensureDir(DIR);
            write(FILE, this.records);
        } catch (error: unknown) {
            console.log(`supporters: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    get(steamId: string): SupporterRecord | null {
        return STEAM_ID.test(steamId) ? (this.records[steamId] ?? null) : null;
    }

    count(): number {
        return Object.keys(this.records).length;
    }

    /** What the panel says about a player's support: when it began, the last time, how many times. Null for none. */
    summary(steamId: string): { since: string; last: string; times: number } | null {
        const record = this.get(steamId);
        return record === null ? null : { since: date(record.since), last: date(record.last), times: record.times };
    }

    /** The benefits, handed to `target` by an administrator (the caller checks who may). */
    grant(admin: Player, target: Player): Outcome {
        if (!STEAM_ID.test(target.steamId)) {
            return { ok: false, message: `${target.nickname} entrou sem identificação Steam, então os benefícios não poderiam ser guardados.` };
        }
        if (!target.ready) {
            return { ok: false, message: `${target.nickname} ainda está entrando no mundo. Tente de novo em instantes.` };
        }
        if (!this.writable) {
            return { ok: false, message: `O arquivo de apoiadores não pôde ser lido; nada foi entregue para não apagar o que está nele.` };
        }

        const clothes = NOBLE_CLOTHES[bodyOf(target)];
        const refused = clothes.filter((piece) => !Inventory.add(target, { item: piece.item, amount: 1 }).ok);
        const refusedArms = SUPPORTER_ARMS.filter((arm) => !Inventory.add(target, { item: arm.item, amount: arm.amount }).ok);
        const now = this.now();
        const before = this.records[target.steamId];
        this.records[target.steamId] = {
            since: before?.since ?? now,
            last: now,
            times: (before?.times ?? 0) + 1,
            by: admin.nickname,
            name: target.nickname,
            dogName: before?.dogName ?? "",
        };
        this.persist();
        this.bringDog(target);

        const pieces = clothes.length - refused.length;
        Chat.sendToPlayer(
            target,
            `Obrigado por apoiar o reino! Você recebeu trajes de nobre (${pieces} peças, no inventário), ${armsHanded(refusedArms)} e um cão fiel, que volta com você a cada entrada. /cachorro chama, dá nome e dá ordens ao seu cão.`,
        );
        console.log(`supporters: ${admin.nickname} entregou os benefícios a ${target.nickname} (${target.steamId}), ${this.records[target.steamId]?.times ?? 1}ª vez`);
        for (const piece of [...refused, ...refusedArms]) {
            console.log(`supporters: o jogo recusou ${piece.item} para ${target.nickname}`);
        }
        const turnedDown = [...refused, ...refusedArms];
        const missing = turnedDown.length === 0 ? "" : ` O jogo recusou ${turnedDown.length === 1 ? "um item" : `${turnedDown.length} itens`} (${turnedDown.map((piece) => piece.label).join(", ")}).`;
        return { ok: true, message: `Benefícios entregues a ${target.nickname}: ${pieces} de ${clothes.length} peças de roupa nobre, ${armsHanded(refusedArms)} e o cão.${missing}` };
    }

    /** A supporter's dog, brought to them when they have none. Null for anybody else, or a body not in the world. */
    bringDog(player: Player): Dog | null {
        const record = this.get(player.steamId);
        if (record === null) {
            return null;
        }
        if (player.dog !== null) {
            return player.dog;
        }
        if (!player.ready || !player.alive) {
            return null;
        }
        const { position, rotation } = inFrontOf(player, DOG_DISTANCE);
        try {
            return Dog.spawn(player, position, rotation, undefined, record.dogName === "" ? undefined : record.dogName);
        } catch (error: unknown) {
            console.log(`supporters: o cão de ${player.nickname} não pôde vir: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /** `/cachorro`: the dog comes to its owner, a new one when it is gone. */
    call(player: Player): Outcome {
        if (this.get(player.steamId) === null) {
            return { ok: false, message: "O cão é um presente para quem apoia o servidor: veja a seção Apoiador no painel (tecla , ao lado do M)." };
        }
        if (!player.ready || !player.alive) {
            return { ok: false, message: "Seu cão vem quando você estiver de pé no mundo." };
        }
        const now = this.now();
        const last = this.calledAt.get(player.id) ?? Number.NEGATIVE_INFINITY;
        if (now - last < CALL_COOLDOWN_MS) {
            return { ok: false, message: "Seu cão já está vindo. Espere um pouco antes de chamar de novo." };
        }
        this.calledAt.set(player.id, now);
        // Brought anew beside the owner: the dog's body is run by its owner's game, so moving it from here would not hold.
        player.dog?.destroy();
        return this.bringDog(player) === null ? { ok: false, message: "Seu cão não pôde vir agora. Tente de novo em instantes." } : { ok: true, message: "Seu cão veio para perto de você." };
    }

    /** `/cachorro nome`: names the dog, now and at every entry. An empty name gives it back the game's own. */
    rename(player: Player, wanted: string): Outcome {
        const record = this.get(player.steamId);
        if (record === null) {
            return { ok: false, message: "Só quem apoia o servidor tem um cão para dar nome." };
        }
        const name = wanted.replace(/\s+/g, " ").trim();
        if (name !== "" && (name.length < DOG_NAME_MIN || name.length > DOG_NAME_MAX)) {
            return { ok: false, message: `O nome do cão precisa ter entre ${DOG_NAME_MIN} e ${DOG_NAME_MAX} letras.` };
        }
        record.dogName = name;
        this.persist();
        if (player.dog !== null) {
            player.dog.name = name;
        }
        return { ok: true, message: name === "" ? "Seu cão voltou a usar o nome de antes." : `Seu cão agora se chama ${name}.` };
    }

    /** `/cachorro seguir|esperar`. */
    order(player: Player, word: string): Outcome {
        const order = Object.keys(DOG_ORDERS).includes(word) ? DOG_ORDERS[word] : undefined;
        if (order === undefined) {
            return { ok: false, message: `Ordens: ${Object.keys(DOG_ORDERS).join(", ")}.` };
        }
        const dog = this.get(player.steamId) === null ? null : player.dog;
        if (dog === null) {
            return { ok: false, message: "Você não tem um cão por perto. /cachorro chama o seu." };
        }
        dog.mode = order.mode;
        return { ok: true, message: order.said };
    }

    forget(player: Player): void {
        this.calledAt.delete(player.id);
    }
}

export const supporters = new Supporters();

export function installSupporters(): void {
    supporters.load();

    // A dog goes with its owner when they leave; at every entry the server brings it back, once their body is in the
    // world and their game can run it. A respawn after death finds the dog still there and leaves it.
    Events.on("playerSpawned", (player) => {
        if (supporters.get(player.steamId) === null) {
            return;
        }
        const id = player.id;
        setTimeout(() => {
            const again = Player.getById(id);
            if (again !== null) {
                supporters.bringDog(again);
            }
        }, DOG_DELAY_MS);
    });
    Events.on("playerDisconnect", (player) => supporters.forget(player));
    console.log(`supporters: ${supporters.count()} apoiador(es); o cão de cada um volta a cada entrada`);
}
