import { isAdmin } from "../auth.js";
import { barberListing, isBarberId, moveBarber, resetBarbers } from "../barbers.js";
import type { Command, CommandContext } from "../command.js";
import { yawOf } from "../position.js";

/**
 * `/barbeiro` (admin): where the barbers stand, and the place of one moved to where the administrator is (2026-11-02, user: "na seção NPC de região vamos colocar os NPC barbeiro e de
 * carroça também, assim se eu quiser posso mover eles de lugar também"); the NPCs section of the panel (F3) shows the command for each.
 */
export const barbeiroCommand: Command = {
    name: "barbeiro",
    summary: "(admin) Os barbeiros: onde estão, e para mudar um de lugar.",
    usage: [
        "/barbeiro  -- cada barbeiro, onde está e se o lugar foi escolhido",
        "/barbeiro aqui <id>  -- o barbeiro (ex.: barbeiro-suchdol) passa a ficar onde você está, virado como você",
        "/barbeiro padrao [id]  -- um barbeiro (ou todos) volta ao lugar original",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        if (!isAdmin(player)) {
            reply.line("Só administradores.");
            return;
        }
        const [sub, which] = args;
        if (sub === undefined) {
            reply.lines(barberListing().map((one) => `${one.id}: em ${Math.round(one.x)} ${Math.round(one.y)} ${Math.round(one.z)}${one.chosen ? " (lugar escolhido)" : ""}${one.up ? "" : ", fora do mundo agora"}`));
            return;
        }
        if (sub === "aqui") {
            if (which === undefined || !isBarberId(which)) {
                usage();
                return;
            }
            moveBarber(which, player.position, yawOf(player.rotation as Quaternion));
            reply.line(`${which} agora fica onde você está.`);
            return;
        }
        if (sub === "padrao") {
            if (which !== undefined && !isBarberId(which)) {
                usage();
                return;
            }
            const back = resetBarbers(which);
            reply.line(back === 0 ? "Nenhum lugar tinha sido trocado." : `${back} ${back === 1 ? "barbeiro voltou" : "barbeiros voltaram"} ao lugar original.`);
            return;
        }
        usage();
    },
};
