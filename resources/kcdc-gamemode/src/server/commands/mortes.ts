import type { Command, CommandContext } from "../command.js";
import { allCharacters } from "../characters.js";
import { describeRows, dropBySeq, drops, giveBack, units } from "../death-drop.js";
import type { DropRecord, DropView } from "../death-drop.js";

/** How many drops a plain `/mortes` lists. */
const LIST_MAX = 12;

/** A moment in Brasília time (UTC-3), as the staff reads it: "18/10 19:05". */
export function brasilia(at: number): string {
    const local = new Date(at - 3 * 60 * 60 * 1000);
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** The character's name, with the Steam nickname beside it when they differ. */
function ownerOf(record: DropRecord, names: ReadonlyMap<string, string>): string {
    const character = names.get(record.owner);
    return character !== undefined && character !== record.ownerName ? `${character} (${record.ownerName})` : record.ownerName;
}

const ENDS: Record<DropRecord["end"], string> = {
    "": "?",
    recuperado: "o dono pegou tudo de volta",
    saqueado: "saqueado",
    dividido: "o dono pegou parte, outros o resto",
    expirou: "o tempo acabou",
    devolvido: "a administração devolveu",
};

function stateOf(view: DropView, now: number): string {
    const record = view.record;
    if (view.live) {
        return `no mundo, ${units(record.rows)} item(ns) dentro, faltam ${Math.max(1, Math.ceil((record.expiresAt - now) / 60_000))} min`;
    }
    const lost = units(record.lost);
    return `${ENDS[record.end]}${lost > 0 && record.end !== "devolvido" ? `; o dono perdeu ${lost} item(ns)` : ""}${record.returnedAt > 0 && record.end !== "devolvido" ? "; devolvido" : ""}`;
}

function line(view: DropView, names: ReadonlyMap<string, string>, now: number): string {
    const record = view.record;
    return `#${record.seq} ${brasilia(record.at)} ${ownerOf(record, names)}${record.place !== "" ? `, ${record.place}` : ""}: ${stateOf(view, now)}`;
}

/** `/mortes`: the death drops, what was in each, who took it, and giving an owner back what they lost (`death-drop.ts`). */
export const mortesCommand: Command = {
    name: "mortes",
    summary: "(admin) Os baús de morte: o que caiu, quem levou e o que o dono perdeu; devolve ao dono o que ele perdeu.",
    usage: [
        "/mortes  -- os últimos baús de morte, no mundo e passados (hora de Brasília)",
        "/mortes <jogador>  -- os de um jogador (nome do personagem, apelido ou Steam id)",
        "/mortes ver <n>  -- o que caiu no baú #n, quem levou e o que o dono perdeu",
        "/mortes devolver <n>  -- devolve ao dono o que ele perdeu no baú #n (na hora, ou na próxima entrada)",
    ],

    run({ args, reply, usage }: CommandContext): void {
        const now = Date.now();
        const names = new Map(allCharacters().map((entry) => [entry.steamId, entry.name]));
        const [first, second] = args;
        const verb = first?.toLowerCase();

        if (verb === "ver" || verb === "devolver") {
            const number = Number((second ?? "").replace(/^#/, ""));
            if (!Number.isInteger(number) || number <= 0) {
                usage();
                return;
            }
            if (verb === "devolver") {
                reply.line(giveBack(number, now).message);
                return;
            }
            const view = dropBySeq(number);
            if (view === null) {
                reply.line(`Não há baú de morte #${number}.`);
                return;
            }
            const record = view.record;
            reply.line(line(view, names, now));
            reply.line(`Caiu: ${record.fell.length > 0 ? describeRows(record.fell) : "nada registrado"}`);
            const takers = record.takers.map((taker) => `${taker.steamId === record.owner ? "o dono" : (names.get(taker.steamId) ?? taker.name)} ${taker.units}`);
            if (takers.length > 0) {
                reply.line(`Levaram: ${takers.join(", ")}`);
            }
            if (view.live) {
                reply.line(`Dentro agora: ${record.rows.length > 0 ? describeRows(record.rows) : "nada"}`);
            }
            if (record.lost.length > 0) {
                reply.line(`O dono perdeu: ${describeRows(record.lost)}${record.returnedAt > 0 ? " (devolvido)" : ""}`);
            }
            return;
        }

        const all = drops();
        let shown = all;
        if (args.length > 0) {
            const who = args.join(" ").trim().toLowerCase();
            const owners = new Set(allCharacters().filter((entry) => entry.steamId === who || entry.name.toLowerCase() === who || entry.nickname.toLowerCase() === who).map((entry) => entry.steamId));
            shown = all.filter((view) => owners.has(view.record.owner) || view.record.ownerName.toLowerCase() === who);
            if (shown.length === 0) {
                reply.line(`Nenhum baú de morte de "${args.join(" ")}" registrado.`);
                return;
            }
        }
        if (shown.length === 0) {
            reply.line("Nenhum baú de morte registrado ainda.");
            return;
        }
        for (const view of shown.slice(0, LIST_MAX)) {
            reply.line(line(view, names, now));
        }
        if (shown.length > LIST_MAX) {
            reply.line(`... e mais ${shown.length - LIST_MAX}. /mortes <jogador> mostra os de um só.`);
        }
    },
};
