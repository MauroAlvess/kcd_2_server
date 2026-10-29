/**
 * The players who support the server, and what that brings them.
 *
 * A player who wants to help pays by Pix (the "Apoiador" page of the status panel shows how) and sends the receipt on
 * Discord; an administrator then hands the benefits over from the "Jogadores" page. Nothing here sees a payment: the
 * administrator's word is the proof. The benefits are:
 *
 * - **a set of noble clothes**, from the game's own noble outfits, for the body the player chose, put in the inventory
 *   for them to wear (a second hand-over gives a second set);
 * - **a firearm** (2026-10-17, corrected 2026-10-18): the hand cannon, the game's "Bombarda de mão" (`handgonneNormal01`),
 *   the píšťala, the first firearm of medieval Bohemia, and ten balls to load it with (`shot_ball`), each hand-over; the musket
 *   it had been given with was taken out (the user: it is not a musket and a cannon, it is the hand cannon);
 * - **a horse** (2026-10-18), in noble tack when the game has some, standing beside them, each hand-over;
 * - **a dog**, the game's own companion. A dog goes when its owner leaves the server, so the server brings it back at
 *   every entry. `/cachorro` calls it, names it and tells it to follow or wait, and so does E in front of it (`dog-menu.ts`).
 *   Each supporter's dog is a different one (2026-10-26, user: "vamos randomizar os cachorros, eles só são dados por apoiador mas
 *   tem que ser diferentes"): the first time it comes it is drawn at random from the village dogs' souls (`dog-souls.ts`), one that
 *   no other supporter's dog wears while any is left, and the record keeps it, so that the dog looks the same at every entry.
 *
 * A hand-over given by mistake is taken back from the same page (`revoke`, 2026-10-25, user: "na aba jogadores deve ter como retirar benefícios
 * de um jogador, para o caso de ceder errado"): the clothes and arms still in the bag, the horses the hand-overs gave, the dog and the record.
 *
 * Kept by Steam id in `playerdata/supporters.json`.
 */

import { getCharacter } from "./characters.js";
import { DOG_SOULS } from "./dog-souls.js";
import { keyOfHorse, removeHorse } from "./horses.js";
import { inFrontOf } from "./place.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/supporters.json`;
/** A hand-over or a taking-back reserved for somebody who is not in the game (`Supporters.queue`). */
const PENDING_FILE = `${DIR}/supporters-pending.json`;

export interface PendingItem {
    readonly action: "grant" | "revoke";
    /** The administrator who asked. */
    readonly by: string;
    readonly at: number;
}

/** How far in front of its owner a dog is brought. */
const DOG_DISTANCE = 1.6;
/** A dog is brought this long after its owner's body is in the world, so their game is ready to run it. */
export const DOG_DELAY_MS = 6_000;
/** `/cachorro` brings the dog anew; not more often than this. */
export const CALL_COOLDOWN_MS = 10_000;
/** How many souls a dog is tried with before the game's generic dog comes in their place. */
export const DOG_SOUL_TRIES = 3;

export const DOG_NAME_MIN = 2;
export const DOG_NAME_MAX = 24;

/** The dog's companion modes the command offers, by the game's own numbers (`E_DogCompanionMode`). */
export const DOG_ORDERS: Readonly<Record<string, { readonly mode: number; readonly said: string }>> = {
    seguir: { mode: 1, said: "Seu cão vai seguir você." },
    esperar: { mode: 0, said: "Seu cão vai esperar aqui." },
    // User, 2026-10-18 night: "deve ter como mandar o cachorro ficar sentado no local". The game's Wait is the dog sitting where it is.
    sentar: { mode: 0, said: "Seu cão senta e fica aqui até você chamar." },
    solto: { mode: 2, said: "Seu cão está solto: anda por perto à vontade." },
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
    /** The soul (a GUID of `dog-souls.ts`) the dog is spawned against, which decides how it looks: drawn once and kept. None until the dog first comes. */
    dogSoul?: string;
    /** The keys (`horses.ts`) of the horses the hand-overs gave, so a hand-over given by mistake can take them back. None for a hand-over before 2026-10-25. */
    horseKeys?: string[];
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

/** What a hand-over adds besides the clothes: the hand cannon (the píšťala) and ten balls for it. */
export const SUPPORTER_ARMS: readonly { readonly item: string; readonly amount: number; readonly label: string }[] = [
    { item: "handgonneNormal01", amount: 1, label: "bombarda de mão (píšťala)" },
    { item: "shot_ball", amount: 10, label: "10 balas" },
];

/** How far in front of the new owner the horse of a hand-over stands. */
const HORSE_DISTANCE = 3;
/** The gift horse's key is looked for this long after it was given, and again this many times. */
const NOTE_HORSE_MS = 1_500;
const NOTE_HORSE_TRIES = 6;

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

const STEAM_ID = /^\d{5,20}$/;
const SOUL_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function bodyOf(player: Player): "male" | "female" {
    const chosen = getCharacter(player.steamId)?.appearance.gender ?? player.appearance.gender;
    return chosen === "female" ? "female" : "male";
}

/** What of the arms went in, in a phrase: all of them, or which did not. */
function armsHanded(refused: readonly { readonly label: string }[]): string {
    return refused.length === 0 ? "uma bombarda de mão (a píšťala, a primeira arma de fogo da Boêmia) e 10 balas" : `parte das armas (faltou: ${refused.map((arm) => arm.label).join(", ")})`;
}

/** A soul by the name the game files it under, for the log; its GUID when it is not one of the list's. */
function soulName(guid: string): string {
    return DOG_SOULS.find(([, one]) => one === guid)?.[0] ?? guid;
}

function date(at: number): string {
    const day = new Date(at);
    const two = (n: number): string => String(n).padStart(2, "0");
    return `${two(day.getDate())}/${two(day.getMonth() + 1)}/${day.getFullYear()}`;
}

export class Supporters {
    private records: Record<string, SupporterRecord> = {};
    private pending: Record<string, PendingItem> = {};
    /** False while the file could not be read: nothing is written over it then. */
    private writable = true;
    private readonly calledAt = new Map<number, number>();

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
    ) {}

    load(): void {
        const loaded = read<Record<string, unknown>>(FILE);
        if (loaded.status === "corrupt") {
            this.writable = false;
            console.log(`supporters: ${FILE} ilegível (${loaded.reason}); nada será gravado por cima até que seja consertado`);
            return;
        }
        this.loadPending();
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
                ...(typeof entry.dogSoul === "string" && SOUL_GUID.test(entry.dogSoul) ? { dogSoul: entry.dogSoul } : {}),
                ...(Array.isArray(entry.horseKeys) ? { horseKeys: entry.horseKeys.filter((key): key is string => typeof key === "string" && key !== "").slice(0, 50) } : {}),
            };
        }
    }

    private loadPending(): void {
        const waiting = read<Record<string, unknown>>(PENDING_FILE);
        if (waiting.status !== "ok" || typeof waiting.value !== "object" || waiting.value === null) {
            return;
        }
        for (const [steamId, raw] of Object.entries(waiting.value)) {
            if (!STEAM_ID.test(steamId) || typeof raw !== "object" || raw === null) {
                continue;
            }
            const item = raw as Partial<Record<keyof PendingItem, unknown>>;
            if (item.action === "grant" || item.action === "revoke") {
                this.pending[steamId] = { action: item.action, by: typeof item.by === "string" ? item.by : "", at: typeof item.at === "number" ? item.at : 0 };
            }
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

    /** What is reserved for an account that is not in the game: nothing, a hand-over or a taking-back. */
    pendingFor(steamId: string): PendingItem | null {
        return this.pending[steamId] ?? null;
    }

    private persistPending(): void {
        try {
            ensureDir(DIR);
            write(PENDING_FILE, this.pending);
        } catch (error: unknown) {
            console.log(`supporters: não consegui gravar ${PENDING_FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * The benefits of somebody who is not in the game (user, 2026-10-26: the administrator's list carries the offline too, "até entregar benefícios ou retirar"):
     * the hand-over or the taking-back is written down and happens, as if the administrator had pressed it then, when the player comes in and their body is in
     * the world. One thing is reserved per account; a new one replaces the old.
     */
    queue(action: PendingItem["action"], steamId: string, name: string, by: string): Outcome {
        if (!STEAM_ID.test(steamId)) {
            return { ok: false, message: `${name} não tem uma conta Steam conhecida.` };
        }
        if (action === "revoke" && this.records[steamId] === undefined) {
            return { ok: false, message: `${name} não é apoiador: não há benefícios para retirar.` };
        }
        this.pending[steamId] = { action, by, at: this.now() };
        this.persistPending();
        console.log(`supporters: ${by} reservou ${action === "grant" ? "a entrega" : "a retirada"} dos benefícios de ${name} para a próxima entrada`);
        return {
            ok: true,
            message: action === "grant"
                ? `${name} não está no jogo: os benefícios ficam reservados e são entregues quando entrar.`
                : `${name} não está no jogo: a retirada dos benefícios fica reservada e acontece quando entrar.`,
        };
    }

    /** What was reserved for this player, done now that they are in. Null when nothing was; a hand-over that could not be made yet stays reserved. */
    applyPending(player: Player): Outcome | null {
        const item = this.pending[player.steamId];
        if (item === undefined) {
            return null;
        }
        const admin = { nickname: item.by === "" ? "a administração" : item.by };
        const outcome = item.action === "grant" ? this.grant(admin, player) : this.revoke(admin, player);
        if (outcome.ok || item.action === "revoke" || player.ready) {
            delete this.pending[player.steamId];
            this.persistPending();
        }
        console.log(`supporters: o que estava reservado para ${player.nickname} (${item.action === "grant" ? "entrega" : "retirada"}): ${outcome.ok ? "feito" : outcome.message}`);
        return outcome;
    }

    /** A deleted character's support goes with it (2026-10-25, user: "ao apagar o personagem deve perder os cavalos, carroças e tudo, até apoiador"): no benefits, no dog. True when there was any. */
    forgetSupport(steamId: string): boolean {
        if (this.records[steamId] === undefined) {
            return false;
        }
        delete this.records[steamId];
        this.persist();
        return true;
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
    grant(admin: { readonly nickname: string }, target: Player): Outcome {
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
            ...(before?.dogSoul === undefined ? {} : { dogSoul: before.dogSoul }),
            ...(before?.horseKeys === undefined ? {} : { horseKeys: [...before.horseKeys] }),
        };
        this.persist();
        this.bringDog(target);
        const gift = this.giveHorse(target);
        const horse = gift !== null;
        if (gift !== null) {
            this.noteHorse(target.steamId, gift);
        }

        const pieces = clothes.length - refused.length;
        Chat.sendToPlayer(
            target,
            `Obrigado por apoiar o reino! Você recebeu trajes de nobre (${pieces} peças, no inventário), ${armsHanded(refusedArms)}, ${horse ? "um cavalo, " : ""}e um cão fiel, que volta com você a cada entrada. /cachorro chama, dá nome e dá ordens ao seu cão.`,
        );
        console.log(`supporters: ${admin.nickname} entregou os benefícios a ${target.nickname} (${target.steamId}), ${this.records[target.steamId]?.times ?? 1}ª vez`);
        for (const piece of [...refused, ...refusedArms]) {
            console.log(`supporters: o jogo recusou ${piece.item} para ${target.nickname}`);
        }
        const turnedDown = [...refused, ...refusedArms];
        const missing = turnedDown.length === 0 ? "" : ` O jogo recusou ${turnedDown.length === 1 ? "um item" : `${turnedDown.length} itens`} (${turnedDown.map((piece) => piece.label).join(", ")}).`;
        return { ok: true, message: `Benefícios entregues a ${target.nickname}: ${pieces} de ${clothes.length} peças de roupa nobre, ${armsHanded(refusedArms)}, ${horse ? "o cavalo " : ""}e o cão.${missing}` };
    }

    /** A horse in noble tack, given to the player and standing in front of them: the game's own generic riding horse. Null when it could not be. */
    private giveHorse(player: Player): Horse | null {
        try {
            const { position, rotation } = inFrontOf(player, HORSE_DISTANCE);
            const noble = Horse.gearPresets().find((preset) => preset.startsWith("horse_noble"));
            const horse = Horse.spawn(position, rotation, undefined, undefined, noble);
            horse.giveTo(player);
            return horse;
        } catch (error: unknown) {
            console.log(`supporters: o cavalo de ${player.nickname} não pôde vir: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Writes down the key a gift horse is kept under once `horses.ts` has filed it (when its owner changes, on the next tick or so), so that
     * `revoke` can take exactly that horse back and none the player came by otherwise.
     */
    private noteHorse(steamId: string, horse: Horse, tries = 0): void {
        setTimeout(() => {
            try {
                const key = keyOfHorse(horse);
                const record = this.records[steamId];
                if (key === null) {
                    if (tries < NOTE_HORSE_TRIES) {
                        this.noteHorse(steamId, horse, tries + 1);
                    }
                    return;
                }
                if (record !== undefined && !(record.horseKeys ?? []).includes(key)) {
                    record.horseKeys = [...(record.horseKeys ?? []), key];
                    this.persist();
                }
            } catch (error: unknown) {
                console.log(`supporters: não consegui anotar o cavalo entregue: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, NOTE_HORSE_MS);
    }

    /**
     * The benefits taken back from `target`, by an administrator (the caller checks who may): for a hand-over made by mistake. The clothes and
     * the arms the hand-overs gave that are still in the bag (one set for each time), the horses they gave (only those the record knows), the
     * dog and the record go. What the player used up or sold is not asked back.
     */
    revoke(admin: { readonly nickname: string }, target: Player): Outcome {
        if (!STEAM_ID.test(target.steamId)) {
            return { ok: false, message: `${target.nickname} entrou sem identificação Steam.` };
        }
        const record = this.records[target.steamId];
        if (record === undefined) {
            return { ok: false, message: `${target.nickname} não é apoiador: não há benefícios para retirar.` };
        }
        if (!this.writable) {
            return { ok: false, message: `O arquivo de apoiadores não pôde ser lido; nada foi retirado para não apagar o que está nele.` };
        }
        const sets = Math.max(1, record.times);
        const wanted = [...NOBLE_CLOTHES[bodyOf(target)].map((piece) => ({ item: piece.item, amount: sets, label: piece.label })), ...SUPPORTER_ARMS.map((arm) => ({ item: arm.item, amount: arm.amount * sets, label: arm.label }))];
        const back: string[] = [];
        const state = Inventory.get(target);
        if (state !== null && state.ready) {
            for (const want of wanted) {
                let left = want.amount;
                const units: { id: string; amount: number }[] = [];
                for (const row of state.items) {
                    if (left > 0 && String(row.name) === want.item) {
                        const take = Math.min(row.amount, left);
                        units.push({ id: row.id, amount: take });
                        left -= take;
                    }
                }
                if (units.length === 0) {
                    continue;
                }
                if (Inventory.remove(target, { units }).ok) {
                    back.push(want.label);
                } else {
                    console.log(`supporters: o jogo não deixou tirar ${want.item} de ${target.nickname}`);
                }
            }
        }
        let horses = 0;
        for (const key of record.horseKeys ?? []) {
            if (removeHorse(key, target.steamId)) {
                horses += 1;
            }
        }
        const knewHorses = (record.horseKeys ?? []).length > 0;
        try {
            target.dog?.destroy();
        } catch {
            // Gone already.
        }
        delete this.records[target.steamId];
        this.persist();
        Chat.sendToPlayer(target, "Os benefícios de apoiador foram retirados por um administrador.");
        console.log(`supporters: ${admin.nickname} retirou os benefícios de ${target.nickname}: ${back.length} item(ns), ${horses} cavalo(s), o cão e o registro`);
        const items = back.length === 0 ? "nenhum item (já não tinha)" : `${back.length} item(ns) (${back.join(", ")})`;
        const horse = horses > 0 ? `${horses} cavalo(s) entregue(s)` : knewHorses ? "o cavalo entregue já não era dele" : "o cavalo ficou (a entrega é anterior ao registro dos cavalos: retire-o em Animais, se for o caso)";
        return { ok: true, message: `Benefícios retirados de ${target.nickname}: ${items}, ${horse}, o cão e o registro de apoiador.` };
    }

    /**
     * A soul no other supporter's dog wears, drawn at random; when every soul is worn, one of those worn the fewest times. Null when the list has
     * none to offer (all of it is in `except`).
     */
    private drawSoul(except: readonly string[] = []): string | null {
        const worn = new Map<string, number>();
        for (const record of Object.values(this.records)) {
            if (record.dogSoul !== undefined) {
                worn.set(record.dogSoul, (worn.get(record.dogSoul) ?? 0) + 1);
            }
        }
        const open = DOG_SOULS.filter(([, guid]) => !except.includes(guid));
        const least = Math.min(...open.map(([, guid]) => worn.get(guid) ?? 0));
        const pool = open.filter(([, guid]) => (worn.get(guid) ?? 0) === least);
        const pick = pool[Math.floor(this.random() * pool.length)];
        return pick === undefined ? null : pick[1];
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
        const name = record.dogName === "" ? undefined : record.dogName;
        // The soul it has worn, or a draw at its first coming. Should the game turn a soul down another is drawn, and the game's generic dog is the last resort.
        const tried: string[] = [];
        for (let attempt = 0; attempt < DOG_SOUL_TRIES; attempt += 1) {
            const soul = attempt === 0 && record.dogSoul !== undefined ? record.dogSoul : this.drawSoul(tried);
            if (soul === null) {
                break;
            }
            tried.push(soul);
            try {
                const dog = Dog.spawn(player, position, rotation, soul, name);
                if (record.dogSoul !== soul) {
                    record.dogSoul = soul;
                    this.persist();
                    console.log(`supporters: o cão de ${player.nickname} é a alma ${soulName(soul)}`);
                }
                return dog;
            } catch (error: unknown) {
                console.log(`supporters: o cão de ${player.nickname} não veio com a alma ${soulName(soul)}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        try {
            return Dog.spawn(player, position, rotation, undefined, name);
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
        if (supporters.get(player.steamId) === null && supporters.pendingFor(player.steamId) === null) {
            return;
        }
        const id = player.id;
        setTimeout(() => {
            const again = Player.getById(id);
            if (again !== null) {
                // What an administrator reserved for them while they were away (the Jogadores list carries the offline too).
                supporters.applyPending(again);
                supporters.bringDog(again);
            }
        }, DOG_DELAY_MS);
    });
    Events.on("playerDisconnect", (player) => supporters.forget(player));
    console.log(`supporters: ${supporters.count()} apoiador(es); o cão de cada um volta a cada entrada`);
}
