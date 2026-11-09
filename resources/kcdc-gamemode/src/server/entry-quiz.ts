/**
 * The questions of the door (user, 2026-10-29: "uma hub de boas vindas com 10 perguntas com multi opções e com base nas respostas decide se ele foi ou não aprovado para jogar o servidor ...
 * perguntas sobre RP e Kingdom Come: Deliverance"). Anyone may come in now, and the whitelist is this quiz: a player is approved when they get `PASS_SCORE` of `QUESTIONS_PER_ATTEMPT` right.
 *
 * The bank is larger than one attempt: each attempt draws ten questions at random and shuffles the options of each, so a second try is not the first one again and the order of the options
 * tells nothing. The right answers never leave the server: the page gets the questions and the options in the order they were shuffled to, and sends back the POSITION it picked.
 *
 * Pure: the draw takes its random numbers from the caller, so it can be tried without a game.
 */

export const QUESTIONS_PER_ATTEMPT = 10;
export const PASS_SCORE = 7;

export interface Text {
    readonly q: string;
    readonly options: readonly [string, string, string, string];
}

export interface Question {
    readonly id: string;
    readonly pt: Text;
    readonly en: Text;
    /** The right option, by its place in `options` (the same in both languages). */
    readonly answer: 0 | 1 | 2 | 3;
}

export const BANK: readonly Question[] = [
    {
        id: "rdm",
        answer: 0,
        pt: { q: "O que é RDM?", options: ["Matar ou agredir alguém sem um motivo de RP", "Combinar um duelo entre dois personagens", "Defender-se de um ataque", "Caçar animais na mata"] },
        en: { q: "What is RDM?", options: ["Killing or attacking somebody with no RP reason", "Agreeing on a duel between two characters", "Defending yourself from an attack", "Hunting animals in the forest"] },
    },
    {
        id: "hdm",
        answer: 2,
        pt: { q: "Você vê outro jogador parado na estrada. Atropelá-lo de propósito com o cavalo, sem motivo de RP, é:", options: ["Permitido: o cavalo é uma arma", "Permitido, se ele for plebeu", "HDM: é proibido", "Permitido à noite"] },
        en: { q: "You see another player standing on the road. Running them down on purpose with your horse, with no RP reason, is:", options: ["Allowed: the horse is a weapon", "Allowed, if they are a commoner", "HDM: it is forbidden", "Allowed at night"] },
    },
    {
        id: "anti-rp",
        answer: 1,
        pt: { q: "O seu personagem leva uma flechada no peito e segue correndo e lutando como se nada tivesse acontecido. Isso é:", options: ["Boa interpretação de um guerreiro valente", "Anti-RP: ignorar a lógica e as consequências da cena", "Fear RP", "Um bug do jogo"] },
        en: { q: "Your character takes an arrow in the chest and goes on running and fighting as if nothing had happened. That is:", options: ["Good acting of a brave warrior", "Anti-RP: ignoring the logic and the consequences of the scene", "Fear RP", "A bug of the game"] },
    },
    {
        id: "metagaming",
        answer: 3,
        pt: { q: "Você soube, num grupo de Discord, onde um jogador escondeu os bens dele, e o seu personagem vai direto até lá. Isso é:", options: ["Faro de bom rastreador", "Powergaming", "Fear RP", "Metagaming: usar no jogo o que se soube fora dele"] },
        en: { q: "You learned, in a Discord group, where a player hid their goods, and your character goes straight there. That is:", options: ["A good tracker's nose", "Powergaming", "Fear RP", "Metagaming: using in the game what was learned outside it"] },
    },
    {
        id: "powergaming",
        answer: 0,
        pt: { q: "Escrever que o seu personagem amarra, tranca e leva outro personagem sem deixar que ele reaja é:", options: ["Powergaming: forçar a ação sobre o outro sem deixá-lo reagir", "Boa interpretação", "Fear RP", "Permitido, se o outro for mais fraco"] },
        en: { q: "Writing that your character ties up, locks away and carries off another character without letting them react is:", options: ["Powergaming: forcing the action on the other without letting them react", "Good acting", "Fear RP", "Allowed, if the other is weaker"] },
    },
    {
        id: "fear-rp",
        answer: 2,
        pt: { q: "Três bandidos armados cercam o seu personagem, que está sozinho e sem armas. O mais adequado é:", options: ["Atacar os três sem pensar", "Ignorar e continuar o que fazia", "Agir com medo: render-se, negociar ou fugir, valorizando a vida do personagem", "Sair do jogo"] },
        en: { q: "Three armed bandits surround your character, who is alone and unarmed. The most fitting thing is:", options: ["Attack all three without thinking", "Ignore them and go on with what you were doing", "Act with fear: surrender, negotiate or run, valuing the character's life", "Leave the game"] },
    },
    {
        id: "respeito",
        answer: 1,
        pt: { q: "Um jogador faz insultos racistas ou misóginos dizendo que é \"só o personagem\". O servidor:", options: ["Aceita: é RP medieval", "Tem tolerância zero: o RP nunca justifica abuso, e a Staff pode punir", "Aceita, se for contra plebeus", "Aceita, se for à noite"] },
        en: { q: "A player makes racist or misogynistic insults saying it is \"just the character\". The server:", options: ["Accepts it: it is medieval RP", "Has zero tolerance: RP never justifies abuse, and the Staff may punish it", "Accepts it, if it is against commoners", "Accepts it, if it is at night"] },
    },
    {
        id: "ooc",
        answer: 3,
        pt: { q: "O que quer dizer OOC (fora do personagem)?", options: ["Falar como o personagem, em voz alta", "Um tipo de armadura", "Um castigo da Staff", "Falar como jogador, não como personagem"] },
        en: { q: "What does OOC (out of character) mean?", options: ["Speaking as the character, out loud", "A kind of armour", "A punishment from the Staff", "Speaking as the player, not as the character"] },
    },
    {
        id: "motivo",
        answer: 0,
        pt: { q: "Quando um personagem pode atacar outro?", options: ["Quando há um motivo de RP (conflito, crime, defesa) e ele aceita as consequências", "Sempre que estiver entediado", "Quando o outro tem itens bonitos", "Só de dia"] },
        en: { q: "When may a character attack another?", options: ["When there is an RP reason (a feud, a crime, self-defence) and they accept the consequences", "Whenever they are bored", "When the other has nice items", "Only by day"] },
    },
    {
        id: "bug",
        answer: 2,
        pt: { q: "Você descobre um erro do jogo que multiplica moedas. O correto é:", options: ["Usar até corrigirem", "Contar só aos amigos", "Avisar a Staff e não explorar o erro", "Vender o truque"] },
        en: { q: "You find a flaw in the game that multiplies coins. The right thing is:", options: ["Use it until they fix it", "Tell only your friends", "Tell the Staff and not exploit the flaw", "Sell the trick"] },
    },
    {
        id: "ano",
        answer: 1,
        pt: { q: "Em que ano se passa o servidor?", options: ["1203", "1403", "1503", "1603"] },
        en: { q: "In what year is the server set?", options: ["1203", "1403", "1503", "1603"] },
    },
    {
        id: "reino",
        answer: 3,
        pt: { q: "Em que reino se passa Kingdom Come: Deliverance?", options: ["Inglaterra", "França", "Castela", "Boêmia"] },
        en: { q: "In which kingdom is Kingdom Come: Deliverance set?", options: ["England", "France", "Castile", "Bohemia"] },
    },
    {
        id: "regiao",
        answer: 0,
        pt: { q: "Qual região da Boêmia o servidor ocupa?", options: ["Kuttenberg (Kutná Hora)", "Praga", "Viena", "Cracóvia"] },
        en: { q: "Which part of Bohemia does the server take place in?", options: ["Kuttenberg (Kutná Hora)", "Prague", "Vienna", "Kraków"] },
    },
    {
        id: "prata",
        answer: 2,
        pt: { q: "Por que a região de Kuttenberg é tão cobiçada?", options: ["Pelos portos do mar", "Pelos vinhedos", "Pelas minas de prata", "Pelas florestas de cedro"] },
        en: { q: "Why is the region of Kuttenberg so coveted?", options: ["For its seaports", "For its vineyards", "For its silver mines", "For its cedar forests"] },
    },
    {
        id: "henry",
        answer: 1,
        pt: { q: "Quem é o protagonista de Kingdom Come: Deliverance?", options: ["Geralt de Rívia", "Henry, filho de um ferreiro de Skalitz", "Altaïr", "Arthur Morgan"] },
        en: { q: "Who is the protagonist of Kingdom Come: Deliverance?", options: ["Geralt of Rivia", "Henry, the son of a blacksmith of Skalitz", "Altaïr", "Arthur Morgan"] },
    },
    {
        id: "lingua",
        answer: 3,
        pt: { q: "Que língua falava o povo comum na Boêmia daquela época?", options: ["Inglês", "Italiano", "Árabe", "Tcheco (boêmio)"] },
        en: { q: "What language did the common people of Bohemia speak at that time?", options: ["English", "Italian", "Arabic", "Czech (Bohemian)"] },
    },
    {
        id: "anacronismo",
        answer: 0,
        pt: { q: "Qual destes objetos NÃO existia na Boêmia de 1403?", options: ["Telefone", "Arco e flecha", "Espada", "Vela"] },
        en: { q: "Which of these objects did NOT exist in Bohemia in 1403?", options: ["Telephone", "Bow and arrow", "Sword", "Candle"] },
    },
    {
        id: "igreja",
        answer: 2,
        pt: { q: "Qual era a grande força religiosa do reino naquela época?", options: ["O islamismo", "A Igreja ortodoxa", "A Igreja Católica", "Nenhuma religião"] },
        en: { q: "What was the great religious power of the kingdom at that time?", options: ["Islam", "The Orthodox Church", "The Catholic Church", "No religion at all"] },
    },
    {
        id: "guilda",
        answer: 1,
        pt: { q: "Como um jogador consegue uma guilda neste servidor?", options: ["Compra de outro jogador", "Escolhe no painel F2, na seção Guildas: a primeira é de graça", "Aprende de qualquer NPC do reino", "Só a Staff entrega"] },
        en: { q: "How does a player get a guild on this server?", options: ["Buys it from another player", "Picks it in the F2 panel, in the Guilds section: the first one is free", "Learns it from any NPC of the realm", "Only the Staff hands it out"] },
    },
    {
        id: "prender",
        answer: 3,
        pt: { q: "Quem pode prender outro jogador?", options: ["Qualquer jogador", "Só a Staff", "Só os nobres", "Oficiais com cargo adequado (soldado, guarda, capitão, juiz...), e só alguém abaixo deles na hierarquia"] },
        en: { q: "Who may arrest another player?", options: ["Any player", "Only the Staff", "Only nobles", "Officers with a fitting office (soldier, guard, captain, judge...), and only someone below them in the hierarchy"] },
    },
    {
        id: "cavaleiro",
        answer: 0,
        pt: { q: "Como um personagem vira cavaleiro?", options: ["Sendo nomeado por um lorde (ou acima) que o conhece", "Comprando o título", "Escolhendo ao criar o personagem", "Esperando sete dias"] },
        en: { q: "How does a character become a knight?", options: ["By being named by a lord (or above) who knows them", "By buying the title", "By choosing it when creating the character", "By waiting seven days"] },
    },
    {
        id: "morte",
        answer: 2,
        pt: { q: "O que acontece quando o seu personagem morre?", options: ["O personagem é apagado para sempre", "Você volta ao menu e perde tudo", "Acorda na sua cidade (ou numa igreja), e o que levava fica no lugar da morte para buscar", "Nada, ele continua de pé"] },
        en: { q: "What happens when your character dies?", options: ["The character is deleted for ever", "You go back to the menu and lose everything", "They wake up in their town (or in a church), and what they carried stays where they died, to be fetched", "Nothing, they stay on their feet"] },
    },
    {
        id: "venda",
        answer: 1,
        pt: { q: "Como vender algo a outro jogador?", options: ["Deixar no chão e torcer", "Apertar E diante dele e escolher Negociar", "Gritar o preço no chat da Staff", "Só pelos NPCs vendedores"] },
        en: { q: "How do you sell something to another player?", options: ["Leave it on the ground and hope", "Press E in front of them and choose Trade", "Shout the price in the Staff's chat", "Only through the NPC vendors"] },
    },
    {
        id: "voz",
        answer: 3,
        pt: { q: "A voz do servidor é:", options: ["Ouvida por todos, em qualquer lugar", "Só entre amigos", "Só para a Staff", "De proximidade: só ouve quem está perto"] },
        en: { q: "The server's voice chat is:", options: ["Heard by everybody, anywhere", "Only between friends", "Only for the Staff", "By proximity: only those who are near hear it"] },
    },
    {
        id: "casa",
        answer: 0,
        pt: { q: "Como se consegue uma casa neste servidor?", options: ["Pedindo ao senhor das terras, que cede a casa ou dá acesso a ela", "Arrombando a primeira que encontrar", "Pagando a um NPC", "Escolhendo no menu F2"] },
        en: { q: "How do you get a house on this server?", options: ["By asking the lord of the lands, who hands over the house or gives access to it", "By breaking into the first one you find", "By paying an NPC", "By picking it in the F2 menu"] },
    },
];

/** A shuffled copy (Fisher-Yates), with the random numbers the caller gives. */
export function shuffled<T>(list: readonly T[], random: () => number = Math.random): T[] {
    const copy = [...list];
    for (let at = copy.length - 1; at > 0; at -= 1) {
        const other = Math.floor(random() * (at + 1));
        const keep = copy[at] as T;
        copy[at] = copy[other] as T;
        copy[other] = keep;
    }
    return copy;
}

/** One question as an attempt shows it: where each option of the page stands in the question's own list. */
export interface Drawn {
    readonly id: string;
    readonly order: readonly number[];
}

export interface Attempt {
    readonly at: number;
    readonly drawn: readonly Drawn[];
}

/** Ten questions out of the bank, each with its options shuffled. */
export function draw(now: number, count: number = QUESTIONS_PER_ATTEMPT, random: () => number = Math.random): Attempt {
    const picked = shuffled(BANK, random).slice(0, count);
    return { at: now, drawn: picked.map((question) => ({ id: question.id, order: shuffled([0, 1, 2, 3], random) })) };
}

/** What the page is sent for an attempt: the text in both languages, in the shuffled order, and no answer. */
export function view(attempt: Attempt): Array<{ readonly id: string; readonly pt: Text; readonly en: Text }> {
    return attempt.drawn.map((one) => {
        const question = BANK.find((candidate) => candidate.id === one.id) as Question;
        const arrange = (text: Text): Text => ({ q: text.q, options: one.order.map((original) => text.options[original] as string) as unknown as Text["options"] });
        return { id: one.id, pt: arrange(question.pt), en: arrange(question.en) };
    });
}

/** How many of the picks are right: `picks[i]` is the place the player chose for the i-th question, a number from 0 to 3; anything else is a wrong answer. */
export function grade(attempt: Attempt, picks: readonly unknown[]): number {
    let right = 0;
    attempt.drawn.forEach((one, index) => {
        const pick = picks[index];
        if (typeof pick !== "number" || !Number.isInteger(pick) || pick < 0 || pick > 3) {
            return;
        }
        const question = BANK.find((candidate) => candidate.id === one.id);
        if (question !== undefined && one.order[pick] === question.answer) {
            right += 1;
        }
    });
    return right;
}
