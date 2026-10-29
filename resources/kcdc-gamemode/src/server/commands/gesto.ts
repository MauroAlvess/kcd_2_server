import type { Command, CommandContext } from "../command.js";
import { emotes, GESTURES, GROUPS } from "../emotes.js";

/**
 * The wheel's gestures, for an administrator (2026-10-26, when the wheel grew past sixty gestures from the game's own animations, none of
 * which could be tried here before they went up): the list, and a switch that takes one off the wheel (or puts it back) at once and for
 * everybody, with no restart, in case one looks wrong in the game. The switch is kept in `playerdata/emotes.json`.
 */
export const gestoCommand: Command = {
    name: "gesto",
    summary: "Lista os gestos da roda do G e liga ou desliga um deles, sem reiniciar o servidor.",
    usage: [
        "/gesto lista                 -- os gestos de cada grupo, com o número; os desligados vêm marcados",
        "/gesto desligar <número>     -- tira da roda um gesto que ficou feio no jogo",
        "/gesto ligar <número>        -- põe de volta",
        "/gesto ajustar <número> <x> <y> <z> [rx ry rz]  -- muda onde o objeto fica na mão (metros e graus, no espaço da mão: z sobe, x vai para os dedos) e toca de novo para você ver; vale para todos e fica guardado",
        "/gesto ajustar <número>.2 <x> <y> <z> [rx ry rz]  -- o mesmo para o segundo objeto do gesto (o estandarte tem dois: 130 é o cabo e 130.2 é o pano)",
        "/gesto ajustar <número> padrao  -- volta ao lugar de fábrica (todos os objetos do gesto; <número>.2 padrao só o segundo)",
        "/gesto ajustes               -- os objetos que você mexeu, com os números",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        const verb = args[0];

        if (verb === "ajustes") {
            const list = emotes.tunedList();
            reply.lines(list.length === 0 ? ["Nenhum objeto foi mexido: todos estão no lugar de fábrica."] : list.map((one) => `${one.id}${one.piece > 1 ? `.${one.piece}` : ""} ${GESTURES[one.id]?.name ?? ""}: x ${one.position.x} y ${one.position.y} z ${one.position.z} | rx ${one.rotation.x} ry ${one.rotation.y} rz ${one.rotation.z}`));
            return;
        }

        if (verb === "ajustar") {
            const named = /^(\d+)(?:[.:](\d+))?$/.exec(args[1] ?? "");
            const id = named === null ? Number.NaN : Number(named[1]);
            const piece = named?.[2] === undefined ? 1 : Number(named[2]);
            const gesture = GESTURES[id];
            if (named === null || gesture === undefined || gesture.props === undefined) {
                reply.line("Diga o número de um gesto com objeto na mão (/gesto lista): lampiões, estandarte, flautas, trompa.");
                return;
            }
            if (gesture.props[piece - 1] === undefined) {
                reply.line(`${gesture.name} tem ${gesture.props.length} objeto(s) na mão: ${gesture.props.length === 1 ? String(id) : `${id}, ${id}.2${gesture.props.length > 2 ? ", ..." : ""}`}.`);
                return;
            }
            const name = gesture.props.length > 1 ? `${gesture.name} (objeto ${piece})` : gesture.name;
            if (args[2] === "padrao" || args[2] === "padrão") {
                const whole = named[2] === undefined;
                reply.line(emotes.untune(id, whole ? undefined : piece) ? `${whole ? gesture.name : name}: ${whole && gesture.props.length > 1 ? "os objetos voltaram" : "o objeto voltou"} ao lugar de fábrica.` : `${whole ? gesture.name : name} já está no lugar de fábrica.`);
                return;
            }
            const numbers = args.slice(2, 8).map((word) => Number(word.replace(",", ".")));
            if (numbers.length !== 3 && numbers.length !== 6) {
                usage();
                return;
            }
            if (!numbers.every(Number.isFinite) || numbers.slice(0, 3).some((metres) => Math.abs(metres) > 2) || numbers.slice(3).some((degrees) => Math.abs(degrees) > 360)) {
                reply.line("Números fora do razoável: x, y e z em metros (até 2) e os giros em graus (até 360).");
                return;
            }
            const [x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0] = numbers;
            emotes.tune(id, { x, y, z }, { x: rx, y: ry, z: rz }, piece);
            const played = emotes.preview(player, id);
            reply.line(`${name}: objeto em x ${x} y ${y} z ${z}, giro ${rx} ${ry} ${rz}; guardado para todos.${played ? "" : " (Não consegui tocar agora para você ver.)"}`);
            return;
        }

        if (verb === "lista") {
            for (const group of GROUPS) {
                const inside = Object.entries(GESTURES)
                    .filter(([, gesture]) => gesture.group === group.id)
                    .map(([id, gesture]) => `${id} ${gesture.name}${emotes.isOff(Number(id)) ? " (desligado)" : ""}`);
                reply.line(`${group.name}: ${inside.join(", ")}`);
            }
            return;
        }

        if (verb === "desligar" || verb === "ligar") {
            const id = Number(args[1]);
            if (args[1] === undefined || !Number.isInteger(id) || GESTURES[id] === undefined) {
                reply.line("Diga o número de um gesto da roda: /gesto lista.");
                return;
            }
            const off = verb === "desligar";
            if (emotes.isOff(id) === off) {
                reply.line(`${GESTURES[id]?.name ?? id} já está ${off ? "desligado" : "ligado"}.`);
                return;
            }
            emotes.setOff(id, off);
            reply.line(`${GESTURES[id]?.name ?? id}: ${off ? "tirado da roda" : "de volta na roda"}. Vale na próxima vez que alguém abrir o G.`);
            return;
        }

        usage();
    },
};
