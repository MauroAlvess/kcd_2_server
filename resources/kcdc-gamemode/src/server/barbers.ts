/**
 * The barbers (user, 2026-10-16: "vamos adicionar NPC barbeiros"). The level has one, in Kuttenberg beside the baths
 * (`kkut_betasBarber`, with its tent); this server has four more, in the villages of the roleplay, since a day's ride to
 * Kuttenberg for a haircut is no way to play.
 *
 * A player who talks to one gets the game's choice list: the haircut, the colour of the hair, the beard (a man's, of the
 * ones his face can grow). Each choice is put on the body at once, for the player to see in the mirror of the game's
 * own camera, and asks whether they will keep it: a yes costs the price and is saved as the character's look
 * (`characters.ts`, the same place the creator keeps it); anything else puts the old look back, and so does leaving,
 * walking away, dying or disconnecting. The face, the skin and the name are the creator's and are never touched here.
 */

import { getCharacter, saveCharacter } from "./characters.js";
import { buildCatalog, pickedFrom } from "./creator-catalog.js";
import type { Catalog, GenderCatalog, Tone } from "./creator-catalog.js";
import { coins, moneyOf, MONEY_UNIT, takeMoney } from "./money.js";
import { installPostLife, installPosts } from "./townsfolk.js";
import type { Post } from "./townsfolk.js";

/** What every service costs, in coins as the game shows them. */
export const BARBER_PRICE = 20;

/** How far from the barber a conversation is kept, in metres. */
export const STAY_M = 8;

const PAGE = 5;
/** How often a chair is looked at, to see whether its player is still there. */
const LOOK_EVERY_MS = 2_000;

export const BARBERS: readonly Post[] = [
    { id: "barbeiro-kuttenberg", name: "Barbeiro", soul: "townsman", x: 3043.56, y: 469.93, z: 33.28 },
    { id: "barbeiro-suchdol", name: "Barbeiro", soul: "townsman", x: 598.5, y: 3281.5, z: 146.8 },
    { id: "barbeiro-wysoka", name: "Barbeiro", soul: "townsman", x: 428.0, y: 2511.0, z: 217.5 },
    { id: "barbeiro-raborsch", name: "Barbeiro", soul: "townsman", x: 1441.0, y: 3830.0, z: 118.1 },
    { id: "barbeiro-malesov", name: "Barbeiro", soul: "townsman", x: 560.5, y: 258.3, z: 109.6 },
];

const TONE_NAMES: Readonly<Record<Tone, string>> = {
    black: "Preto",
    dark_brown: "Castanho escuro",
    light_brown: "Castanho claro",
    dark_ginger: "Ruivo escuro",
    ginger: "Ruivo",
    blonde: "Louro",
    dark_grey: "Grisalho escuro",
    grey: "Grisalho",
    white: "Branco",
};

type Part = "hair" | "tone" | "beard";
type View = "menu" | "list" | "confirm";

interface Chair {
    readonly player: Player;
    readonly post: Post;
    /** The barber's body, to measure the walk away from. */
    readonly npc: Npc;
    /** The look the body wears when nothing is being tried: the saved one. */
    base: Appearance;
    /** The look being tried, once one is picked. */
    trial: Appearance | null;
    view: View;
    part: Part;
    offset: number;
    session: number;
}

let catalog: Catalog | null = null;

function theCatalog(): Catalog {
    if (catalog === null) {
        catalog = buildCatalog(Appearances);
    }
    return catalog;
}

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** What the catalog says of the look: its half of the catalog, and the numbers of the hairstyle and the colour it wears. */
function stateOf(look: Appearance): { part: GenderCatalog; hair: number; tone: number; head: number } {
    const part = theCatalog()[look.gender];
    const picked = pickedFrom(theCatalog(), look, look.gender, () => 0);
    return { part, hair: picked.hair, tone: picked.tone, head: part.heads.indexOf(look.head) };
}

/** The rows of a list the barber reads out, for the part being chosen. */
function rowsOf(look: Appearance, part: Part): Array<{ id: string; text: string }> {
    const { part: parts, hair, tone, head } = stateOf(look);
    if (part === "hair") {
        return parts.hairs.map((_, index) => ({ id: `pick:${index}`, text: `Corte ${index + 1}${index === hair ? " (o seu)" : ""}` }));
    }
    if (part === "tone") {
        return (parts.hairs[hair]?.colours ?? []).map((colour, index) => ({ id: `pick:${index}`, text: `${TONE_NAMES[colour.tone]}${index === tone ? " (o seu)" : ""}` }));
    }
    const growable = head >= 0 ? (parts.beards[head] ?? []) : [];
    return [{ id: "pick:-1", text: `Sem barba${look.beard === "" ? " (o seu)" : ""}` }, ...growable.map((name, index) => ({ id: `pick:${index}`, text: `Barba ${index + 1}${look.beard === name ? " (a sua)" : ""}` }))];
}

/** The look with one part changed to the choice at `index` of the list. Null when there is no such choice. */
function tried(look: Appearance, part: Part, index: number): Appearance | null {
    const { part: parts, hair, tone, head } = stateOf(look);
    if (part === "beard") {
        if (index === -1) {
            return { ...look, beard: "" };
        }
        const name = (head >= 0 ? parts.beards[head] : undefined)?.[index];
        return name === undefined ? null : { ...look, beard: name };
    }
    if (part === "tone") {
        const colour = parts.hairs[hair]?.colours[index];
        return colour === undefined ? null : { ...look, hair: colour.name };
    }
    const style = parts.hairs[index];
    if (style === undefined) {
        return null;
    }
    const kept = parts.hairs[hair]?.colours[tone]?.tone;
    const same = style.colours.find((colour) => colour.tone === kept) ?? style.colours[0];
    return { ...look, hair: same === undefined ? style.base : same.name };
}

export class Barbering {
    private readonly chairs = new Map<number, Chair>();

    private menu(chair: Chair): DialoguePage {
        const { look, growable } = this.options(chair);
        const options: DialogueOption[] = [
            { id: "hair", text: "Cortar o cabelo", enabled: true },
            { id: "tone", text: "Tingir o cabelo", enabled: look.hair !== "" && rowsOf(look, "tone").length > 1 },
            { id: "beard", text: growable ? "Barba" : "Barba (o seu rosto não deixa)", enabled: growable },
            { id: "leave", text: "Sair", enabled: true },
        ];
        return { line: `${chair.post.name}: o que vai ser? Cada serviço custa ${BARBER_PRICE} moedas.`, onRight: false, options };
    }

    private options(chair: Chair): { look: Appearance; growable: boolean } {
        const { part, head } = stateOf(chair.base);
        return { look: chair.base, growable: chair.base.gender === "male" && head >= 0 && (part.beards[head]?.length ?? 0) > 0 };
    }

    private list(chair: Chair): DialoguePage {
        const rows = rowsOf(chair.base, chair.part);
        const shown = rows.slice(chair.offset, chair.offset + PAGE).map((row): DialogueOption => ({ ...row, enabled: true }));
        if (chair.offset > 0) {
            shown.push({ id: "less", text: "‹ Os de antes", enabled: true });
        }
        if (chair.offset + PAGE < rows.length) {
            shown.push({ id: "more", text: "Mais ›", enabled: true });
        }
        shown.push({ id: "back", text: "Voltar", enabled: true });
        const what = chair.part === "hair" ? "o corte" : chair.part === "tone" ? "a cor" : "a barba";
        return { line: `Escolha ${what}; a gente vê como fica. (${chair.offset + 1} a ${Math.min(rows.length, chair.offset + PAGE)} de ${rows.length})`, onRight: false, options: shown };
    }

    private confirm(): DialoguePage {
        return {
            line: "Fica bem assim?",
            onRight: false,
            options: [
                { id: "accept", text: `Ficar assim (${BARBER_PRICE} moedas)`, enabled: true },
                { id: "other", text: "Escolher outro", enabled: true },
                { id: "undo", text: "Deixar como estava", enabled: true },
            ],
        };
    }

    private show(chair: Chair): void {
        const page = chair.view === "menu" ? this.menu(chair) : chair.view === "list" ? this.list(chair) : this.confirm();
        if (!Dialogue.update(chair.session, page)) {
            this.chairs.delete(chair.session);
        }
    }

    /** The old look back on the body, if something else is on it. */
    private restore(chair: Chair): void {
        if (chair.trial !== null) {
            chair.trial = null;
            chair.player.setAppearance(chair.base);
        }
    }

    /** A player sits down. False when they cannot now. */
    open(player: Player, post: Post, npc: Npc): boolean {
        if (!player.ready || !player.alive || player.steamId === "" || Dialogue.sessionOf(player.id) !== 0) {
            return false;
        }
        const base = getCharacter(player.steamId)?.appearance ?? player.appearance;
        const chair: Chair = { player, post, npc, base, trial: null, view: "menu", part: "hair", offset: 0, session: 0 };
        chair.session = Dialogue.open(player.id, this.menu(chair));
        if (chair.session === 0) {
            return false;
        }
        this.chairs.set(chair.session, chair);
        return true;
    }

    choose(session: number, player: Player, option: string): void {
        const chair = this.chairs.get(session);
        if (chair === undefined || chair.player.id !== player.id) {
            return;
        }
        if (option === "leave") {
            this.close(chair, "");
            return;
        }
        if (chair.view === "menu") {
            if (option === "hair" || option === "tone" || option === "beard") {
                chair.part = option;
                chair.offset = 0;
                chair.view = "list";
                this.show(chair);
            }
            return;
        }
        if (chair.view === "list") {
            if (option === "more" || option === "less") {
                chair.offset = Math.max(0, chair.offset + (option === "more" ? PAGE : -PAGE));
            } else if (option === "back") {
                this.restore(chair);
                chair.view = "menu";
            } else if (option.startsWith("pick:")) {
                const look = tried(chair.base, chair.part, Number(option.slice(5)));
                if (look === null) {
                    return;
                }
                chair.trial = look;
                chair.view = "confirm";
                if (!player.setAppearance(look)) {
                    this.restore(chair);
                    chair.view = "list";
                    tell(player, "O jogo não aceitou esse visual agora. Escolha outro.");
                }
            } else {
                return;
            }
            this.show(chair);
            return;
        }
        if (option === "accept") {
            this.accept(chair);
        } else if (option === "other" || option === "undo") {
            if (option === "undo") {
                this.restore(chair);
            }
            chair.view = option === "undo" ? "menu" : "list";
            this.show(chair);
        }
    }

    private accept(chair: Chair): void {
        const { player, trial } = chair;
        if (trial === null) {
            return;
        }
        if (moneyOf(player) < BARBER_PRICE * MONEY_UNIT) {
            tell(player, `Isso custa ${coins(BARBER_PRICE * MONEY_UNIT)} e você não tem o bastante.`);
            return;
        }
        if (!takeMoney(player, BARBER_PRICE * MONEY_UNIT)) {
            tell(player, "Não consegui receber o pagamento agora. Tente de novo.");
            return;
        }
        saveCharacter(player.steamId, trial, player.nickname);
        chair.base = trial;
        chair.trial = null;
        chair.view = "menu";
        console.log(`barbers: ${player.nickname} pagou ${BARBER_PRICE} moedas a ${chair.post.id}: ${JSON.stringify({ hair: trial.hair, beard: trial.beard })}`);
        tell(player, `Pronto. São ${coins(BARBER_PRICE * MONEY_UNIT)}.`);
        this.show(chair);
    }

    /** The conversation is over, whoever ended it: what was only tried comes off. */
    closed(session: number): void {
        const chair = this.chairs.get(session);
        if (chair !== undefined) {
            this.restore(chair);
            this.chairs.delete(session);
        }
    }

    private close(chair: Chair, why: string): void {
        this.restore(chair);
        this.chairs.delete(chair.session);
        Dialogue.close(chair.session);
        if (why !== "") {
            tell(chair.player, why);
        }
    }

    /** A chair whose player walked off, died or left is let go. */
    tick(): void {
        for (const chair of [...this.chairs.values()]) {
            const player = Player.getById(chair.player.id);
            if (player === null || player.steamId !== chair.player.steamId || !player.alive) {
                this.restore(chair);
                this.chairs.delete(chair.session);
                Dialogue.close(chair.session);
            } else if (flat(player.position, chair.npc.position) > STAY_M) {
                this.close(chair, "Você se afastou do barbeiro.");
            }
        }
    }

    /** How many are in a chair now. */
    sitting(): number {
        return this.chairs.size;
    }
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
}

export const barbering = new Barbering();

export function installBarbers(): void {
    const posts = installPosts("barbers", BARBERS, (player, post, npc) => {
        barbering.open(player, post, npc);
    });
    // What a barber says to whoever comes to the chair (user, 2026-10-17: the NPCs should speak when the moment is theirs).
    installPostLife(posts, ["Cabelo e barba ao seu gosto, é só sentar.", "Uma tesoura afiada e a mão firme: é o que o senhor precisa.", "Venha, que lhe dou outra cara."]);
    Events.on("dialogueChoice", (session, player, option) => barbering.choose(session, player, option));
    Events.on("dialogueClosed", (session) => barbering.closed(session));
    setInterval(() => barbering.tick(), LOOK_EVERY_MS);
}
