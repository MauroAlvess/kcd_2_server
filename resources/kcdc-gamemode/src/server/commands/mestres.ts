import type { Command, CommandContext } from "../command.js";
import { BARBERS } from "../barbers.js";
import { POSTS, SKILL_LABELS, teacherSettings } from "../teachers.js";
import { TEACHERS } from "../teachers-data.js";

/** The barbers and the skill teachers: where each stands, and what a teacher teaches. The teachers are out of the world while `teacherSettings.enabled` is off (2026-10-29). */
const ALL = [
    ...BARBERS.map((post) => ({ post, what: "corta cabelo e barba" })),
    ...(!teacherSettings.enabled ? [] : POSTS).map((post) => ({ post, what: (TEACHERS.find((teacher) => teacher.id === post.id)?.lessons ?? []).map(([track, cap]) => `${SKILL_LABELS[track]?.replace(/ \(.*\)/, "") ?? track} até ${cap}`).join(", ") })),
];

export const mestresCommand: Command = {
    name: "mestres",
    summary: "Lista os barbeiros (os mestres que ensinavam habilidades foram removidos do mundo) e leva você até um deles.",
    usage: ["/mestres [texto]  -- cada barbeiro e mestre, onde fica e o que ensina; o texto filtra pelo nome, pelo id ou pela habilidade", "/mestres ir <id>  -- leva você até ele"],

    run({ player, args, reply, usage }: CommandContext): void {
        if (args[0] === "ir") {
            const found = ALL.find((entry) => entry.post.id === args[1]);
            if (found === undefined || args.length !== 2) {
                usage();
                return;
            }
            reply.line(player.teleport({ x: found.post.x, y: found.post.y, z: found.post.z + 1 }, found.post.name) ? `Levando você a ${found.post.name}.` : "Não consegui falar com o seu cliente para levar você.");
            return;
        }
        const wanted = args.join(" ").toLowerCase();
        const lines = ALL.filter((entry) => wanted === "" || `${entry.post.id} ${entry.post.name} ${entry.what}`.toLowerCase().includes(wanted)).map((entry) => `  ${entry.post.id} -- ${entry.post.name} em ${entry.post.x.toFixed(0)} ${entry.post.y.toFixed(0)} ${entry.post.z.toFixed(0)}: ${entry.what}`);
        reply.lines(lines.length > 0 ? lines : ["Ninguém com esse nome ou habilidade."]);
    },
};
