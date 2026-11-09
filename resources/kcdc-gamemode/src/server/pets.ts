/**
 * The "Animais" section of the panel: the player's horses and their dog -- how they are, where, what they are doing --
 * and the buttons to name them and to call them (the dog's orders are on E in front of it, `dog-menu.ts`: the panel's buttons for them went
 * on 2026-10-26).
 *
 * A horse that dies is lost, as in the game: `horses.ts` forgets it, and a new one is bought. The game's dog does not
 * die (knocked down, it gets up), and the framework says nothing of its health: what is shown of it is its mood, its
 * order, and what it is doing. A dog is the supporters' gift (`supporters.ts`).
 *
 * The page asks every few seconds while the section is open, and is answered with the whole view.
 */

import { nameOf } from "./acquaintances.js";
import { bringCart, CART_NAME_MAX, CART_NAME_MIN, cartName, cartsOf, giveCartTo, renameCart, setCartShared, whereIs } from "./carts.js";
import type { OwnedCart } from "./carts.js";
import { compassDirection, giveHorseTo, HORSE_NAME_MAX, HORSE_NAME_MIN, callHorse, horsesOf, letHorseGo, moodOf, moodWord, renameHorse, setActiveHorse, setHorseShared } from "./horses.js";
import type { Outcome } from "./horses.js";
import { itemName } from "./item-names.js";
import { stuckIn, unstickAnimal } from "./animal-stuck.js";
import { DOG_NAME_MAX, DOG_NAME_MIN, supporters } from "./supporters.js";

const RESOURCE = "kcdc-gamemode";

/** The dog's order, by the game's own numbers (`Dog.mode`). */
const DOG_ORDERS: Readonly<Record<number, string>> = {
    0: "sentado, esperando",
    1: "seguindo você",
    2: "solto",
    3: "agressivo",
    4: "procurando",
    5: "caçando",
    6: "de guarda",
    7: "de tocaia",
};

/** What the dog is doing, by the game's own numbers (`Dog.objective`). */
const DOG_DOING: Readonly<Record<number, string>> = {
    0: "parado",
    2: "latindo",
    4: "seguindo",
    5: "colado em você",
    7: "farejando",
    8: "brigando",
    9: "buscando algo",
    10: "caçando",
    19: "comendo",
    21: "distraindo",
    22: "recebendo carinho",
};

export interface HorseView {
    readonly key: string;
    readonly name: string;
    readonly alive: boolean;
    readonly health: readonly [number, number];
    readonly stamina: readonly [number, number];
    /** "Com você", "a 120 m, a norte", "montado por Hans", "não está no mundo agora". */
    readonly where: string;
    readonly near: boolean;
    readonly gear: readonly string[];
    /** Left free by its owner: anybody may mount it. */
    readonly shared: boolean;
    /** The one X calls (`setActiveHorse`). */
    readonly active: boolean;
    /** Seconds until "Animal preso" may be used on it again; 0 when it may be now (`animal-stuck.ts`). */
    readonly stuckIn: number;
    /** Its mood, of a hundred (`horses.ts`, `moodOf`): the owner's blows lower it; "calmo", "irritado" or "de mau humor" (`moodWord`). Always sent, in the world or not. */
    readonly mood: readonly [number, number];
    readonly moodWord: string;
}

export interface DogView {
    readonly name: string;
    readonly here: boolean;
    /** Sent away by its owner (`Supporters.sendAway`): out of the world until it is called. */
    readonly away: boolean;
    readonly order: string;
    readonly doing: string;
    /** 0 to 100, or null before the owner's game has said. */
    readonly morale: number | null;
    readonly stuckIn: number;
}

export interface CartView {
    readonly key: string;
    /** The name the owner gave it, "" for none. */
    readonly name: string;
    /** "Carroça coberta", "Carro de duas rodas". */
    readonly model: string;
    readonly where: string;
    readonly horses: number;
    /** Seats and how many are taken. */
    readonly seats: readonly [number, number];
    /** The owner is near enough for "Trazer" to be asked (any distance works; this says it is in the world). */
    readonly inWorld: boolean;
    /** Left free by its owner: anybody may get on and drive it. */
    readonly shared: boolean;
    readonly stuckIn: number;
}

export interface AnimalsView {
    readonly horses: readonly HorseView[];
    /** The player's carts and wagons. */
    readonly carts: readonly CartView[];
    /** Null for somebody who has no dog (it is a supporter's). */
    readonly dog: DogView | null;
    readonly limits: { readonly horseName: readonly [number, number]; readonly dogName: readonly [number, number]; readonly cartName: readonly [number, number] };
}

function horseView(player: Player, owned: ReturnType<typeof horsesOf>[number]): HorseView {
    const { record, horse } = owned;
    const gear = [record.gear.saddle, record.gear.head, record.gear.torso, record.gear.shoe].filter((item): item is string => typeof item === "string" && item !== "").map((item) => itemName({ item }));
    const mood = moodOf(record);
    const humor = { mood: [Math.round(mood), 100] as const, moodWord: moodWord(mood) };
    if (horse === null) {
        return { key: record.key, name: record.name, alive: true, health: [0, 0], stamina: [0, 0], where: "não está no mundo agora", near: false, gear, shared: record.shared === true, active: record.active === true, stuckIn: stuckIn("horse", record.key, player.steamId), ...humor };
    }
    const distance = Math.hypot(horse.position.x - player.position.x, horse.position.y - player.position.y);
    const rider = horse.rider;
    const where =
        rider !== null && rider.id === player.id
            ? "com você, montado"
            : rider !== null
              ? `montado por ${rider.nickname}`
              : distance < 6
                ? "aqui, ao seu lado"
                : `a ${distance.toFixed(0)} m, a ${compassDirection(player.position, horse.position)}`;
    return {
        key: record.key,
        name: horse.name || record.name,
        alive: horse.alive,
        health: [Math.round(horse.health), Math.round(horse.maxHealth)],
        stamina: [Math.round(horse.stamina), Math.round(horse.maxStamina)],
        where,
        near: distance < 300,
        gear,
        shared: record.shared === true,
        active: record.active === true,
        stuckIn: stuckIn("horse", record.key, player.steamId),
        ...humor,
    };
}

function cartView(player: Player, owned: OwnedCart): CartView {
    const { record, cart } = owned;
    const taken = cart === null ? 0 : cart.seats.filter((seat) => cart.getOccupant(seat) !== null).length;
    return {
        key: record.key,
        name: record.name,
        model: cartName(record.blueprint),
        where: whereIs(player, cart, compassDirection),
        horses: cart === null ? 0 : cart.horseCount,
        seats: [taken, cart === null ? 0 : cart.seats.length],
        inWorld: cart !== null,
        shared: record.shared === true,
        stuckIn: stuckIn("cart", record.key, player.steamId),
    };
}

function dogView(player: Player): DogView | null {
    const record = supporters.get(player.steamId);
    if (record === null) {
        return null;
    }
    const dog = player.dog;
    if (dog === null) {
        return { name: record.dogName, here: false, away: record.dogAway === true, order: record.dogAway === true ? "embora" : "longe", doing: "", morale: null, stuckIn: stuckIn("dog", "", player.steamId) };
    }
    return {
        name: dog.name || record.dogName,
        here: true,
        away: false,
        order: DOG_ORDERS[dog.mode] ?? "à vontade",
        doing: DOG_DOING[dog.objective] ?? "",
        morale: dog.morale > 0 ? Math.round(Math.min(100, dog.morale)) : null,
        stuckIn: stuckIn("dog", "", player.steamId),
    };
}

export function animalsOf(player: Player): AnimalsView {
    return {
        horses: horsesOf(player.steamId).map((owned) => horseView(player, owned)),
        carts: cartsOf(player.steamId).map((owned) => cartView(player, owned)),
        dog: dogView(player),
        limits: { horseName: [HORSE_NAME_MIN, HORSE_NAME_MAX], dogName: [DOG_NAME_MIN, DOG_NAME_MAX], cartName: [CART_NAME_MIN, CART_NAME_MAX] },
    };
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 1024) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function answer(player: Player): void {
    player.emit(`${RESOURCE}:status.animals`, JSON.stringify(animalsOf(player)));
}

/** What a button did, on the panel (which covers the screen) and in the chat. */
function report(player: Player, outcome: Outcome): void {
    Chat.sendToPlayer(player, outcome.message);
    player.emit(`${RESOURCE}:status.notice`, JSON.stringify({ text: outcome.message }));
    answer(player);
}

export function installPets(): void {
    Events.onClient(`${RESOURCE}:status.animals`, (sender) => answer(sender as Player));

    Events.onClient(`${RESOURCE}:status.animalName`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (fields["kind"] === "horse" && typeof fields["key"] === "string") {
            report(player, renameHorse(player.steamId, fields["key"], fields["name"]));
        } else if (fields["kind"] === "dog" && typeof fields["name"] === "string") {
            report(player, supporters.rename(player, fields["name"]));
        }
    });

    Events.onClient(`${RESOURCE}:status.cartName`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["key"] === "string") {
            report(player, renameCart(player.steamId, fields["key"], fields["name"]));
        }
    });

    Events.onClient(`${RESOURCE}:status.horseShared`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["key"] === "string") {
            report(player, setHorseShared(player.steamId, fields["key"], fields["shared"] === 1));
        }
    });

    // The horse X calls, of an owner who keeps several.
    Events.onClient(`${RESOURCE}:status.horseActive`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["key"] === "string") {
            report(player, setActiveHorse(player.steamId, fields["key"]));
        }
    });

    Events.onClient(`${RESOURCE}:status.cartShared`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["key"] === "string") {
            report(player, setCartShared(player.steamId, fields["key"], fields["shared"] === 1));
        }
    });

    Events.onClient(`${RESOURCE}:status.cartBring`, (sender, payload) => {
        const player = sender as Player;
        const key = fieldsOf(payload)["key"];
        if (typeof key === "string") {
            report(player, bringCart(player, key));
        }
    });

    // A horse, a dog or a cart that is bugged, put in front of its owner once an hour (2026-10-27, the panel's "Animal preso").
    Events.onClient(`${RESOURCE}:status.animalStuck`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        report(player, unstickAnimal(player, fields["kind"], fields["key"]));
    });

    // A horse or a cart of the player's, given to another player who is here (2026-10-19, the panel's "Dar").
    Events.onClient(`${RESOURCE}:status.animalGive`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const id = fields["targetId"];
        const key = fields["key"];
        const target = typeof id === "number" && Number.isInteger(id) ? Player.getById(id) : null;
        if (typeof key !== "string" || (fields["kind"] !== "horse" && fields["kind"] !== "cart")) {
            return;
        }
        if (target === null || !target.ready) {
            report(player, { ok: false, message: "Esse jogador não está mais no servidor." });
            return;
        }
        const outcome = fields["kind"] === "horse" ? giveHorseTo(player.steamId, key, target) : giveCartTo(player.steamId, key, target);
        report(player, outcome);
        if (outcome.ok) {
            Chat.sendToPlayer(target, `${nameOf(player)} deu a você ${fields["kind"] === "horse" ? "um cavalo" : "uma carroça"}: veja na seção Animais do painel (F2).`);
            answer(target);
        }
    });

    Events.onClient(`${RESOURCE}:status.animalCall`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (fields["kind"] === "horse") {
            report(player, callHorse(player, typeof fields["key"] === "string" ? fields["key"] : null));
        } else if (fields["kind"] === "dog") {
            report(player, supporters.call(player));
        }
    });

    // The dog sent away, out of the world until it is called (2026-10-30, the panel's "Mandar embora").
    Events.onClient(`${RESOURCE}:status.animalAway`, (sender, payload) => {
        const player = sender as Player;
        if (fieldsOf(payload)["kind"] === "dog") {
            report(player, supporters.sendAway(player));
        }
    });

    // A horse let go to the free world (2026-11-04, the panel's "Soltar", after its own confirmation).
    Events.onClient(`${RESOURCE}:status.horseRelease`, (sender, payload) => {
        const player = sender as Player;
        const key = fieldsOf(payload)["key"];
        if (typeof key === "string") {
            report(player, letHorseGo(player, key));
        }
    });
}
