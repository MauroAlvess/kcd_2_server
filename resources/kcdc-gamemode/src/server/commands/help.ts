import { canRun } from "../auth.js";
import type { Command, CommandContext, CommandRegistry } from "../command.js";

/** Built from a registry rather than declared like the others, because it lists one. */
export function helpCommand(registry: CommandRegistry): Command {
    return {
        name: "help",
        summary: "Lists the commands this server answers.",
        usage: ["/help", "/help <command>"],

        run({ player, args, reply }: CommandContext): void {
            const asked = args[0];
            if (asked === undefined) {
                const allowed = registry.all().filter((command) => canRun(player, command.name));
                reply.line(`${allowed.length} command(s):`);
                reply.lines(allowed.map((command) => `  /${command.name} -- ${command.summary}`));
                return;
            }

            const command = registry.get(asked.replace(/^\//, "").toLowerCase());
            if (!command) {
                reply.line(`No command called '${asked}'. /help lists them.`);
                return;
            }

            reply.line(`/${command.name} -- ${command.summary}`);
            reply.lines(command.usage.map((form) => `  ${form}`));
            if (!canRun(player, command.name)) {
                reply.line("  Só administradores podem usar este comando.");
            }
        },
    };
}
