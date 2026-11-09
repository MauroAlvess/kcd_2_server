import { nameOfAccount } from "../acquaintances.js";
import { isAdmin } from "../auth.js";
import { allCharacters } from "../characters.js";
import type { Command, CommandContext } from "../command.js";
import { allLetters, lettersSettings, removeLetter, sealInfo } from "../letters.js";
import type { Letter } from "../letters.js";
import { fold } from "../roster.js";

const LIST_MAX = 25;

/** "há 3 h", "em 4 min": when a letter went or comes, as an administrator reads it. */
function when(at: number, now: number): string {
    const minutes = Math.round((now - at) / 60_000);
    if (minutes < 0) {
        return `chega em ${Math.max(1, -minutes)} min`;
    }
    if (minutes < 60) {
        return `há ${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    return hours < 48 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} dias`;
}

/** The accounts whose character's name has every word typed. */
function accountsNamed(query: string): string[] {
    const words = fold(query).split(" ").filter((word) => word !== "");
    return allCharacters()
        .map((character) => character.steamId)
        .filter((steamId) => {
            const name = fold(nameOfAccount(steamId));
            return words.every((word) => name.includes(word));
        });
}

function lineOf(letter: Letter, now: number): string {
    const seal = sealInfo(letter.seal).label;
    const state = letter.droppedByTo === true ? ", jogada fora" : letter.readAt !== undefined ? ", lida" : letter.arriveAt > now ? "" : ", não lida";
    return `  ${letter.id} -- de ${letter.fromName}${letter.anonymous ? " (sem assinatura)" : ""} para ${letter.toName}, ${when(letter.arriveAt, now)}, ${letter.km.toFixed(1)} km, selo: ${seal}${state}: "${letter.title.slice(0, 40)}"`;
}

/**
 * `/cartas`: the letters of the panel's Cartas section (`letters.ts`), for the administrators. What a player wrote stays theirs: the command
 * names who wrote to whom and when, the heading and the seal, the real writer of an unsigned letter included (an unsigned letter that is
 * an offence can be traced), and takes a letter away for good; it never prints a letter's text.
 */
export const cartasCommand: Command = {
    name: "cartas",
    summary: "(admin) As cartas do painel (seção Cartas): quantas há, as de um jogador (quem escreveu, mesmo sem assinatura) e apagar uma.",
    usage: [
        "/cartas  -- (admin) quantas cartas há, a caminho e guardadas, e o preço",
        "/cartas de <nome>  -- (admin) as cartas que um jogador mandou",
        "/cartas para <nome>  -- (admin) as cartas que um jogador recebeu, com quem escreveu (mesmo as sem assinatura)",
        "/cartas apagar <id>  -- (admin) apaga uma carta de vez, para os dois lados",
    ],

    run({ player, args, reply, usage }: CommandContext): void {
        if (!isAdmin(player)) {
            reply.line("Só o administrador usa /cartas. As suas cartas estão no painel (F2), em Cartas.");
            return;
        }
        const now = Date.now();
        const [sub, ...rest] = args;
        const all = allLetters();
        if (sub === undefined) {
            const onTheWay = all.filter((letter) => letter.arriveAt > now).length;
            const unread = all.filter((letter) => letter.arriveAt <= now && letter.readAt === undefined && letter.droppedByTo !== true).length;
            reply.line(`Cartas: ${all.length} guardada(s), ${onTheWay} a caminho, ${unread} esperando leitura. Cada uma custa ${lettersSettings.feeCoins} moedas.`);
            usage();
            return;
        }
        if (sub === "de" || sub === "para") {
            const query = rest.join(" ").trim();
            if (query === "") {
                usage();
                return;
            }
            const accounts = new Set(accountsNamed(query));
            if (accounts.size === 0) {
                reply.line(`Nenhum personagem com o nome '${query}'.`);
                return;
            }
            const found = all.filter((letter) => accounts.has(sub === "de" ? letter.from : letter.to)).sort((a, b) => b.sentAt - a.sentAt);
            if (found.length === 0) {
                reply.line(sub === "de" ? `Nenhuma carta mandada por '${query}'.` : `Nenhuma carta para '${query}'.`);
                return;
            }
            reply.line(`${found.length} carta(s) ${sub === "de" ? "mandadas por" : "para"} '${query}' (a mais nova primeiro):`);
            reply.lines(found.slice(0, LIST_MAX).map((letter) => lineOf(letter, now)));
            if (found.length > LIST_MAX) {
                reply.line(`  ... e mais ${found.length - LIST_MAX}.`);
            }
            return;
        }
        if (sub === "apagar") {
            const id = rest[0];
            if (id === undefined) {
                usage();
                return;
            }
            const gone = removeLetter(id);
            reply.line(gone === null ? `Não achei a carta '${id}'.` : `Carta ${gone.id} de ${gone.fromName} para ${gone.toName} apagada.`);
            if (gone !== null) {
                console.log(`letters: ${player.nickname} (administrador) apagou a carta ${gone.id} de ${gone.fromName} para ${gone.toName}`);
            }
            return;
        }
        usage();
    },
};
