import type { Command, CommandContext } from "../command.js";
import { yawOf } from "../position.js";
import { describeVendors, isVendorId, moveVendor, resetVendors, restockNow, vendorIds } from "../vendors.js";

export const vendedorCommand: Command = {
    name: "vendedor",
    summary: "Mostra e posiciona os NPCs vendedores (ferreiro, boticário, taberneiro, caçador e alfaiate de Suchdol, os mascates das fogueiras de beira de estrada e as banhistas dos banhos).",
    usage: [
        "/vendedor listar  -- cada vendedor e mascate, onde está e o que faz",
        `/vendedor aqui <${vendorIds().filter((id) => !/-\d+$/.test(id)).join("|")}|mascate-1..${vendorIds().filter((id) => id.startsWith("mascate-")).length}|banho-1..${vendorIds().filter((id) => id.startsWith("banho-")).length}>  -- leva o vendedor para onde você está, virado como você (o lugar escolhido passa a ser o dele)`,
        "/vendedor reabastecer  -- enche as prateleiras agora (elas se enchem sozinhas a cada 15 minutos)",
        "/vendedor padrao  -- todos voltam aos lugares originais",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, which] = args;
        switch (sub) {
            case "listar":
                reply.lines(describeVendors());
                return;

            case "aqui": {
                if (which === undefined || !isVendorId(which) || args.length > 2) {
                    usage();
                    return;
                }
                moveVendor(which, player.position, yawOf(player.rotation as Quaternion));
                reply.line(`${which} agora fica onde você está.`);
                return;
            }

            case "reabastecer":
                restockNow();
                reply.line("Prateleiras cheias.");
                return;

            case "padrao":
                resetVendors();
                reply.line("Os vendedores voltaram aos lugares originais.");
                return;

            default:
                usage();
        }
    },
};
