import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { choosePotFires, describePotFires, parsePotFireMode } from "../pot-fires.js";

/**
 * `/fogueiras`: how the stew pots' fires are kept (`pot-fires.ts`, 2026-11-02); an administrator chooses: all lit, lit when somebody cooks, or the game's own.
 */
export const fogueirasCommand: Command = {
    name: "fogueiras",
    summary: "(admin) As fogueiras dos caldeirões: todas acesas, acesas ao cozinhar, ou do jogo.",
    usage: [
        "/fogueiras  -- como as fogueiras dos caldeirões estão",
        "/fogueiras todas  -- todas acesas, dia e noite, para todos",
        "/fogueiras cozinhar  -- acendem quando alguém cozinha nelas, por 10 minutos",
        "/fogueiras jogo  -- do jogo de cada um, como no jogo sozinho",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        if (!isAdmin(player)) {
            reply.line("Só administradores.");
            return;
        }
        const [word] = args;
        if (word === undefined) {
            reply.line(describePotFires());
            return;
        }
        const mode = parsePotFireMode(word);
        if (mode === null) {
            usage();
            return;
        }
        reply.line(choosePotFires(mode));
    },
};
