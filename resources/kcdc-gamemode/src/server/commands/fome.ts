import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { chooseLevel, choosePaused, HUNGER_LEVELS, hungerPace, parseLevel } from "../hunger.js";

/** How a share of the stomach reads aloud. */
function feeling(share: number): string {
    if (share >= 0.75) {
        return "bem alimentado";
    }
    if (share >= 0.45) {
        return "com um pouco de fome";
    }
    if (share >= 0.2) {
        return "com fome";
    }
    return "faminto";
}

export const fomeCommand: Command = {
    name: "fome",
    summary: "Mostra como está a sua fome; o admin escolhe o nível da fome do servidor.",
    usage: ["/fome  -- como está o seu estômago e o nível da fome do servidor", `/fome nivel <${Object.keys(HUNGER_LEVELS).join("|")}>  -- (admin) muda o nível de fome de todos`, "/fome pausa <ligar|desligar>  -- (admin) a pausa mantém a saciedade de todos em 100%; desligá-la faz a fome valer de novo"],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, word] = args;

        if (sub === undefined) {
            const max = player.maxHunger > 0 ? player.maxHunger : 100;
            const share = Math.max(0, Math.min(1, player.hunger / max));
            reply.lines([`Você está ${feeling(share)} (${Math.round(share * 100)}%).`, hungerPace.describe()]);
            return;
        }

        if (sub === "nivel" || sub === "nível") {
            if (!isAdmin(player)) {
                reply.line("Só administradores mudam o nível da fome.");
                return;
            }
            const level = word === undefined ? null : parseLevel(word);
            if (level === null) {
                usage();
                return;
            }
            chooseLevel(level);
            reply.line(hungerPace.paused ? `Nível ${HUNGER_LEVELS[level].label} guardado, mas a fome está pausada: ${hungerPace.describe()}` : hungerPace.describe());
            return;
        }

        if (sub === "pausa") {
            if (!isAdmin(player)) {
                reply.line("Só administradores pausam a fome.");
                return;
            }
            const on = word === "ligar" || word === "ligada" || word === "sim";
            const off = word === "desligar" || word === "desligada" || word === "nao" || word === "não";
            if (!on && !off) {
                usage();
                return;
            }
            choosePaused(on);
            reply.line(hungerPace.describe());
            return;
        }

        usage();
    },
};
