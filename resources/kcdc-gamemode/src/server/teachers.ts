/**
 * The skill teachers (user, 2026-10-16: "os NPC que ensinam esgrima, caça e outras habilidades, cada um em seu local de
 * origem"). The game has 78 of them, each a named person of the world who takes a pupil up to a level in one or more skills
 * for a price (`skill_teacher.xml`, `skill_lesson_level.xml`); the 38 whose home is in this level stand here where the
 * level puts them (`teachers-data.ts`, made by `tools/make-teachers.py`): Captain Frenzl at Suchdol's castle, the sword
 * masters of Kuttenberg, the bowyer, the miller, the priests of Wysoka and Raborsch, and the rest.
 *
 * A player who talks to one gets the game's choice list with what the teacher teaches. A lesson takes the skill up to the
 * next step of 5 (5, 10, 15 or 20) the teacher still teaches, for what the game charges for that step, and is the game's
 * own `AdvanceToSkillLevel` (`player.setLevel`): exactly the XP between the two levels, with the level-ups and the perk
 * points on the way. The game's lessons also take hours of the clock; here the clock is the server's, so a lesson is the
 * price and nothing else. Fencing is not a skill of its own (the game derives it from the weapon skills): the sword
 * teachers teach "Espadas", which is it.
 */

import { LESSON_PRICES, TEACHERS } from "./teachers-data.js";
import type { TeacherData } from "./teachers-data.js";
import { coins, moneyOf, MONEY_UNIT, takeMoney, giveMoney } from "./money.js";
import { installPostLife, installPosts } from "./townsfolk.js";
import type { Post } from "./townsfolk.js";

/** How far from the teacher a conversation is kept, in metres. */
export const STAY_M = 8;
const LOOK_EVERY_MS = 2_000;

/** What the skills are called, and what they are for, as the teacher reads them out. */
export const SKILL_LABELS: Readonly<Record<string, string>> = {
    weapon_sword: "Espadas (esgrima)",
    weapon_large: "Armas de haste",
    heavy_weapons: "Armas pesadas (maças, machados)",
    weapon_unarmed: "Briga (luta desarmada)",
    marksmanship: "Pontaria (arco e besta, caça)",
    survival: "Sobrevivência (caça, rastros, ervas)",
    houndmaster: "Adestramento (cães)",
    horse_riding: "Equitação",
    stealth: "Furtividade",
    thievery: "Roubo",
    alchemy: "Alquimia",
    craftsmanship: "Artesanato",
    scholarship: "Erudição",
    drinking: "Bebida",
};

/** The next step of the game's lesson table above a level, up to what the teacher teaches: its level and price in coins. Null when there is none. */
export function nextLesson(level: number, cap: number): { level: number; price: number } | null {
    for (const [step, price] of LESSON_PRICES) {
        if (step > level && step <= cap) {
            return { level: step, price };
        }
    }
    return null;
}

const teacherOf = new Map<string, TeacherData>(TEACHERS.map((teacher) => [teacher.id, teacher]));

export const POSTS: readonly Post[] = TEACHERS.map((teacher) => ({ id: teacher.id, name: teacher.name, soul: teacher.female ? "townswoman" : "townsman", x: teacher.x, y: teacher.y, z: teacher.z }));

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

interface Lecture {
    readonly player: Player;
    readonly teacher: TeacherData;
    readonly npc: Npc;
    readonly session: number;
}

export class Teaching {
    private readonly lectures = new Map<number, Lecture>();
    /** The level each pupil was last taken to, by Steam id and skill: the game reports the new level a moment later. */
    private readonly taught = new Map<string, number>();

    private levelOf(player: Player, track: string): number | null {
        let reported: number | null = null;
        try {
            reported = player.getTrack(track)?.level ?? null;
        } catch {
            reported = null;
        }
        if (reported === null) {
            return null;
        }
        return Math.max(reported, this.taught.get(`${player.steamId}:${track}`) ?? 0);
    }

    private page(lecture: Lecture): DialoguePage {
        const { player, teacher } = lecture;
        const options: DialogueOption[] = teacher.lessons.map(([track, cap]) => {
            const label = SKILL_LABELS[track] ?? track;
            const level = this.levelOf(player, track);
            const next = level === null ? null : nextLesson(level, cap);
            if (level === null) {
                return { id: `learn:${track}`, text: `${label}: o jogo ainda não leu o seu nível`, enabled: false };
            }
            return next === null
                ? { id: `learn:${track}`, text: `${label}: nível ${level}; não tenho mais o que lhe ensinar`, enabled: false }
                : { id: `learn:${track}`, text: `${label}: do nível ${level} ao ${next.level}, por ${next.price} moedas`, enabled: true };
        });
        options.push({ id: "leave", text: "Sair", enabled: true });
        return { line: `${teacher.name}: o que quer aprender?`, onRight: false, options };
    }

    /** A player talks to a teacher. False when they cannot now. */
    open(player: Player, teacherId: string, npc: Npc): boolean {
        const teacher = teacherOf.get(teacherId);
        if (teacher === undefined || !player.ready || !player.alive || player.steamId === "" || Dialogue.sessionOf(player.id) !== 0) {
            return false;
        }
        const lecture = { player, teacher, npc, session: 0 };
        const session = Dialogue.open(player.id, this.page(lecture));
        if (session === 0) {
            return false;
        }
        this.lectures.set(session, { ...lecture, session });
        return true;
    }

    choose(session: number, player: Player, option: string): void {
        const lecture = this.lectures.get(session);
        if (lecture === undefined || lecture.player.id !== player.id) {
            return;
        }
        if (option === "leave") {
            this.lectures.delete(session);
            Dialogue.close(session);
            return;
        }
        if (option.startsWith("learn:")) {
            this.learn(lecture, option.slice(6));
        }
    }

    private learn(lecture: Lecture, track: string): void {
        const { player, teacher, session } = lecture;
        const lesson = teacher.lessons.find(([skill]) => skill === track);
        const level = this.levelOf(player, track);
        const next = lesson === undefined || level === null ? null : nextLesson(level, lesson[1]);
        if (lesson === undefined || level === null || next === null) {
            tell(player, "Não tenho mais o que lhe ensinar nisso.");
        } else if (moneyOf(player) < next.price * MONEY_UNIT) {
            tell(player, `A lição custa ${coins(next.price * MONEY_UNIT)} e você não tem o bastante.`);
        } else if (!takeMoney(player, next.price * MONEY_UNIT)) {
            tell(player, "Não consegui receber o pagamento agora. Tente de novo.");
        } else if (!this.raise(player, track, next.level)) {
            giveMoney(player, next.price * MONEY_UNIT);
            tell(player, "O jogo não aceitou a lição agora; seu dinheiro foi devolvido. Tente de novo daqui a pouco.");
        } else {
            this.taught.set(`${player.steamId}:${track}`, next.level);
            console.log(`teachers: ${player.nickname} aprendeu ${track} até o nível ${next.level} com ${teacher.id} por ${next.price} moedas`);
            tell(player, `${teacher.name} lhe ensinou: ${SKILL_LABELS[track] ?? track} agora no nível ${next.level} (${next.price} moedas).`);
        }
        if (!Dialogue.update(session, this.page(lecture))) {
            this.lectures.delete(session);
        }
    }

    private raise(player: Player, track: string, level: number): boolean {
        try {
            return player.setLevel(track, level);
        } catch (error: unknown) {
            console.log(`teachers: ${player.nickname}: o jogo recusou ${track} no nível ${level}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    closed(session: number): void {
        this.lectures.delete(session);
    }

    /** A lecture whose pupil walked off, died or left is closed. */
    tick(): void {
        for (const lecture of [...this.lectures.values()]) {
            const player = Player.getById(lecture.player.id);
            if (player === null || player.steamId !== lecture.player.steamId || !player.alive || flat(player.position, lecture.npc.position) > STAY_M) {
                this.lectures.delete(lecture.session);
                Dialogue.close(lecture.session);
            }
        }
    }

    sitting(): number {
        return this.lectures.size;
    }
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
}

export const teaching = new Teaching();

/**
 * Whether the skill teachers stand in the world (user, 2026-10-29: "vamos remover todos npcs que ensinam coisas também; os demais continuam"). Off: none of the 38 is made. The code and
 * the data stay for the day they come back: set it to true.
 */
export const teacherSettings = { enabled: false };

export function installTeachers(): void {
    if (!teacherSettings.enabled) {
        console.log(`teachers: desligados: nenhum dos ${POSTS.length} mestres que ensinavam habilidades fica no mundo`);
        return;
    }
    const posts = installPosts("teachers", POSTS, (player, post, npc) => {
        teaching.open(player, post.id, npc);
    });
    // What a master says to whoever comes near (user, 2026-10-17): that he teaches, and what he asks.
    installPostLife(posts, ["Quer aprender alguma coisa? Fale comigo.", "Quem treina, aprende; quem não treina, apanha.", "Pago o que sei com o que o senhor tiver de moedas."]);
    Events.on("dialogueChoice", (session, player, option) => teaching.choose(session, player, option));
    Events.on("dialogueClosed", (session) => teaching.closed(session));
    setInterval(() => teaching.tick(), LOOK_EVERY_MS);
}
