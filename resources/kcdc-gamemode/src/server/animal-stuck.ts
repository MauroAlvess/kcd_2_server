/**
 * "Animal preso": the way out for a horse, a dog or a cart that is bugged (user, 2026-10-27: "nos meus animais, caso um cavalo, cachorro ou carroça fique bugada deve ter um
 * botão, exemplo 'animal preso': ao clicar ele teleporta para perto do dono e só pode ser usado uma vez a cada 60m"). The button is in the Animais section of the panel, on
 * each animal. It puts the animal in front of its owner, as `/preso` does for the owner; it is refused to an animal that is ridden, a cart with people on it and a horse that
 * is dead or not in the world, and an animal can be taken out of a tight spot once every 60 minutes (kept by animal in `playerdata/animal-stuck.json`, so a restart does not
 * give it back). A dog that is not in the world is brought back, which is what the owner wants of it too.
 */

import { bringCart, cartsOf } from "./carts.js";
import { horsesOf } from "./horses.js";
import { inFrontOf } from "./place.js";
import { ensureDir, read, write } from "./store.js";
import { supporters } from "./supporters.js";

const DIR = "playerdata";
const FILE = `${DIR}/animal-stuck.json`;

/** How long an animal waits for its next release. */
export const ANIMAL_STUCK_COOLDOWN_MS = 60 * 60_000;
/** How far in front of its owner a horse or a dog is put. */
export const PUT_NEAR_M = 3;

export type AnimalKind = "horse" | "cart" | "dog";

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** Minutes as a player reads them: "1 minuto", "43 minutos"; a started minute counts. */
export function minutesText(ms: number): string {
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

/** The last release of each animal: `horse:<key>`, `cart:<key>`, `dog:<steamId>`. */
export class AnimalStuckLog {
    private readonly last = new Map<string, number>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    load(saved: unknown): void {
        if (typeof saved !== "object" || saved === null) {
            return;
        }
        for (const [key, at] of Object.entries(saved as Record<string, unknown>)) {
            if (typeof at === "number" && Number.isFinite(at) && at > 0 && this.now() - at < ANIMAL_STUCK_COOLDOWN_MS) {
                this.last.set(key, at);
            }
        }
    }

    /** Milliseconds until the animal may be released again; 0 when it may be now. */
    remaining(key: string): number {
        const at = this.last.get(key);
        return at === undefined ? 0 : Math.max(0, at + ANIMAL_STUCK_COOLDOWN_MS - this.now());
    }

    mark(key: string): void {
        this.last.set(key, this.now());
    }

    toJSON(): Record<string, number> {
        const out: Record<string, number> = {};
        for (const [key, at] of this.last) {
            if (this.now() - at < ANIMAL_STUCK_COOLDOWN_MS) {
                out[key] = at;
            }
        }
        return out;
    }
}

export const animalStuck = new AnimalStuckLog();

function persist(): void {
    try {
        ensureDir(DIR);
        write(FILE, animalStuck.toJSON());
    } catch (error: unknown) {
        console.log(`animal-stuck: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function installAnimalStuck(): void {
    const saved = read<unknown>(FILE);
    if (saved.status === "ok") {
        animalStuck.load(saved.value);
    }
}

/** The key an animal is kept under in the log. */
export function stuckKey(kind: AnimalKind, key: string, steamId: string): string {
    return kind === "dog" ? `dog:${steamId}` : `${kind}:${key}`;
}

/** Seconds until an animal may be released again, for the panel; 0 when it may be now. */
export function stuckIn(kind: AnimalKind, key: string, steamId: string): number {
    return Math.ceil(animalStuck.remaining(stuckKey(kind, key, steamId)) / 1000);
}

/** Puts one of `player`'s animals in front of them. */
export function unstickAnimal(player: Player, kind: unknown, key: unknown, now: number = Date.now()): Outcome {
    if (kind !== "horse" && kind !== "cart" && kind !== "dog") {
        return { ok: false, message: "Escolha um animal." };
    }
    if (player.steamId === "") {
        return { ok: false, message: "Sem conta Steam não dá para guardar quando foi usado." };
    }
    if (!player.ready || !player.alive) {
        return { ok: false, message: "Você não pode fazer isto agora." };
    }
    const id = stuckKey(kind, typeof key === "string" ? key : "", player.steamId);
    const wait = animalStuck.remaining(id);
    if (wait > 0) {
        return { ok: false, message: `Esse animal já foi tirado do aperto há pouco: de novo em ${minutesText(wait)}.` };
    }
    const done = (message: string): Outcome => {
        animalStuck.mark(id);
        persist();
        return { ok: true, message };
    };

    if (kind === "horse") {
        const owned = horsesOf(player.steamId).find((each) => each.record.key === key);
        if (owned === undefined) {
            return { ok: false, message: "Esse cavalo não é seu." };
        }
        const label = owned.record.name || "Seu cavalo";
        const horse = owned.horse;
        if (horse === null) {
            return { ok: false, message: `${label} não está no mundo agora.` };
        }
        if (!horse.alive) {
            return { ok: false, message: `${label} está morto.` };
        }
        if (horse.rider !== null) {
            return { ok: false, message: `${label} está montado: espere que desça.` };
        }
        const place = inFrontOf(player, PUT_NEAR_M);
        horse.position = place.position;
        horse.rotation = place.rotation;
        console.log(`animal-stuck: ${player.nickname} tirou o cavalo ${owned.record.name || owned.record.key} do aperto`);
        return done(`${label} está ao seu lado.`);
    }

    if (kind === "cart") {
        const owned = cartsOf(player.steamId).find((each) => each.record.key === key);
        if (owned === undefined) {
            return { ok: false, message: "Essa carroça não é sua." };
        }
        const brought = bringCart(player, owned.record.key, now, true);
        if (!brought.ok) {
            return brought;
        }
        console.log(`animal-stuck: ${player.nickname} tirou a carroça ${owned.record.name || owned.record.key} do aperto`);
        return done(brought.message);
    }

    if (supporters.get(player.steamId) === null) {
        return { ok: false, message: "Você não tem um cão." };
    }
    const dog = player.dog;
    if (dog !== null) {
        const place = inFrontOf(player, PUT_NEAR_M);
        dog.position = place.position;
        dog.rotation = place.rotation;
        console.log(`animal-stuck: ${player.nickname} tirou o cão do aperto`);
        return done("Seu cão está ao seu lado.");
    }
    if (supporters.bringDog(player) === null) {
        return { ok: false, message: "Seu cão não pôde vir agora. Tente de novo daqui a pouco." };
    }
    console.log(`animal-stuck: ${player.nickname} trouxe o cão de volta`);
    return done("Seu cão voltou para perto de você.");
}
