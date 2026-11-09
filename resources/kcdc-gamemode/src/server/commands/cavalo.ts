import { isAdmin } from "../auth.js";
import type { Command, CommandContext } from "../command.js";
import { allHorses, CALL_RANGE_M, callHorse, compassDirection as direction, horsesOf, moodOf, moodWord, release, setMood } from "../horses.js";
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
    const mood = moodOf(owned.record);
    // Only when it is not at its best: a horse that is well disposed has nothing to say.
    const humour = mood < 100 ? ` Humor: ${moodWord(mood)} (${Math.round(mood)}%).` : "";
    return `${label}: a ${distance.toFixed(0)} m, a ${direction(player.position, position)}${ridden}.${humour}`;
}

export const cavaloCommand: Command = {
    name: "cavalo",
    summary: "Mostra onde está o seu cavalo e o chama; o admin lista e libera os cavalos guardados.",
    usage: [
        "/cavalo  -- onde estão os seus cavalos",
        `/cavalo chamar  -- o seu cavalo vem correndo, se estiver a até ${CALL_RANGE_M} m`,
        "/cavalo humor  -- o humor dos seus cavalos: o que bate no próprio cavalo o deixa irritado, depois de mau humor (não anda, não corre) e por fim ele vai embora",
        "/cavalo humor definir <0 a 100>  -- (admin) põe o humor do cavalo mais perto de você nesse valor",
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

        if (sub === "humor") {
            const [, word, value] = args;
            if (word === "definir") {
                if (!isAdmin(player)) {
                    reply.line("Só administradores.");
                    return;
                }
                const wanted = Number(value);
                const here = player.position;
                const nearest = allHorses()
                    .filter((owned) => owned.horse !== null && owned.horse.alive)
                    .map((owned) => ({ owned, distance: Math.hypot((owned.horse as Horse).position.x - here.x, (owned.horse as Horse).position.y - here.y) }))
                    .sort((a, b) => a.distance - b.distance)[0];
                if (value === undefined || !Number.isFinite(wanted) || wanted < 0 || wanted > 100) {
                    usage();
                    return;
                }
                if (nearest === undefined || nearest.distance > 10 || !setMood(nearest.owned.horse as Horse, wanted)) {
                    reply.line("Nenhum cavalo com dono a menos de 10 m de você.");
                    return;
                }
                reply.line(`${nearest.owned.record.name || "O cavalo"} de ${nearest.owned.record.ownerName} está de humor ${Math.round(wanted)}% (${moodWord(wanted)}); o efeito no corpo vem em até 15 segundos.`);
                return;
            }
            const mine = horsesOf(player.steamId);
            reply.lines([
                "O humor do cavalo cai com cada pancada do dono: irritado, depois de mau humor (não anda, não corre, não deixa montar nem vem ao assobio) e, no fim, ele abandona o dono e vai embora. Com o tempo ele se acalma.",
                ...(mine.length === 0 ? ["Você não tem cavalo."] : mine.map((owned) => `${owned.record.name || "Seu cavalo"}: ${moodWord(moodOf(owned.record))} (${Math.round(moodOf(owned.record))}%).`)),
            ]);
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
