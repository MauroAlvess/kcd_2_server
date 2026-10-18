import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { allHorses, CALL_RANGE_M, callHorse, compassDirection as direction, horsesOf, release } from "../horses.js";
import type { OwnedHorse } from "../horses.js";

function where(player: Player, owned: OwnedHorse): string {
    const label = owned.record.name || "Seu cavalo";
    const horse = owned.horse;
    if (horse === null) {
        return `${label}: não está no mundo agora.`;
    }
    if (!horse.alive) {
        return `${label}: morto.`;
    }
    const position = horse.position;
    const distance = Math.hypot(position.x - player.position.x, position.y - player.position.y);
    const rider = horse.rider;
    const ridden = rider !== null && rider.id !== player.id ? `, montado por ${rider.nickname}` : rider !== null ? ", com você" : "";
    return `${label}: a ${distance.toFixed(0)} m, a ${direction(player.position, position)}${ridden}.`;
}

export const cavaloCommand: Command = {
    name: "cavalo",
    summary: "Mostra onde está o seu cavalo e o chama; o admin lista e libera os cavalos guardados.",
    usage: [
        "/cavalo  -- onde estão os seus cavalos",
        `/cavalo chamar  -- o seu cavalo vem correndo, se estiver a até ${CALL_RANGE_M} m`,
        "/cavalo listar  -- (admin) todos os cavalos com dono",
        "/cavalo liberar <n>  -- (admin) o cavalo n da lista deixa de ter dono e de ser guardado",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const [sub, arg] = args;

        if (sub === undefined || sub === "onde") {
            const mine = horsesOf(player.steamId);
            reply.lines(mine.length === 0 ? ["Você não tem cavalo. Peça a um administrador."] : mine.map((owned) => where(player, owned)));
            return;
        }

        if (sub === "chamar") {
            reply.line(callHorse(player, null).message);
            return;
        }

        if (sub === "listar" || sub === "liberar") {
            if (!isAdmin(player)) {
                reply.line("Só administradores.");
                return;
            }
            const all = allHorses();
            if (sub === "listar") {
                reply.lines(
                    all.length === 0
                        ? ["Nenhum cavalo com dono."]
                        : all.map((owned, index) => {
                              const r = owned.record;
                              const state = owned.horse === null ? "fora do mundo" : owned.horse.alive ? "vivo" : "morto";
                              return `  ${index + 1}. ${r.name || "(sem nome)"} de ${r.ownerName || r.owner}, ${state}, em ${r.x.toFixed(0)} ${r.y.toFixed(0)} ${r.z.toFixed(0)}`;
                          }),
                );
                return;
            }
            const index = Number(arg) - 1;
            const owned = Number.isInteger(index) ? all[index] : undefined;
            if (owned === undefined) {
                usage();
                return;
            }
            reply.line(release(owned.record.key) ? `${owned.record.name || "O cavalo"} de ${owned.record.ownerName} agora é de ninguém.` : "Esse cavalo já não estava guardado.");
            return;
        }

        usage();
    },
};
