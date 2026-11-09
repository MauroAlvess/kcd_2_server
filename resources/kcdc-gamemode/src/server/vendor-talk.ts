/**
 * What a guild's vendor answers about the trade (2026-11-01, user: "vamos adicionar diálogos nos NPCs de venda, conversas possíveis com eles para tirar dúvidas, exemplo: o que eu
 * posso fazer sendo um ferreiro"). "Tirar dúvidas" in the vendor's list (`guild-vendors.ts`) offers the trade's own questions and the three every vendor answers; each answer is a
 * line or a few of the game's dialogue, with "Continuar" between them. What they say is what the server does (`SINERGIA.md`, `COMANDOS.md`): change them with the trade.
 */

export interface TalkTopic {
    readonly id: string;
    readonly question: string;
    /** The answer, a line of the dialogue each. */
    readonly answer: readonly string[];
}

/** How the vendors of each trade are called together. */
const PLURAL: Readonly<Record<string, string>> = {
    "fabri-ferrarii": "ferreiros",
    artifices: "artesãos",
    alchemistae: "alquimistas",
    tabernarii: "taberneiros",
    venatores: "caçadores",
    agricolae: "agricultores",
    collectores: "coletores",
    domitores: "domadores",
};

/** The skill each guild's work trains, as the game names it. */
const SKILL: Readonly<Record<string, string>> = {
    "fabri-ferrarii": "Artesanato",
    artifices: "Artesanato",
    alchemistae: "Alquimia",
    tabernarii: "Sobrevivência",
    venatores: "Sobrevivência",
    agricolae: "Sobrevivência",
    collectores: "Sobrevivência (árvores) e Força (pedras)",
    domitores: "",
};

const TRADE: Readonly<Record<string, readonly TalkTopic[]>> = {
    "fabri-ferrarii": [
        {
            id: "what",
            question: "O que eu posso fazer sendo ferreiro?",
            answer: [
                "Na forja se faz quase tudo de metal: espadas, machados, maças, lanças, escudos, arcos e flechas, bestas e virotes; capacetes, cotas de malha, couraças e manoplas.",
                "Também ferraduras, selas e arreios, kits de reparo, a pá do agricultor, e a fundição: ferro, aços e a barra de prata. Na aba Extrair você desmancha uma peça e recebe metade do material.",
            ],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["Em qualquer ferraria: chegue à forja, aperte E e escolha Forjar. As receitas abrem conforme o seu nível de Artesanato; comece pelas de nível baixo, como o material de fixação e o ferro."],
        },
        {
            id: "supply",
            question: "De onde vêm os materiais?",
            answer: [
                "Do Coletor vêm a sucata, o ferro, o cobre, a lenha e a madeira de arco. Você mesmo faz o carvão, o material de fixação, o ferro e os aços.",
                "Couro vem do Caçador, penas dos ninhos, linho e linha do Agricultor e do Artesão. Bandido também carrega um pouco de ferro de vez em quando.",
            ],
        },
    ],
    artifices: [
        {
            id: "what",
            question: "O que eu posso fazer sendo artesão?",
            answer: [
                "Na costura se fazem roupas, chapéus e capuzes, calçados e luvas, gibões e couraças de couro, cintos e bolsas, casacos com brasão e os conjuntos das cidades, em várias cores.",
                "E as joias, anéis, colares e broches, que são peças de nobre; e os kits de reparo de roupa e de botas. Na aba Extrair você desmancha uma peça e recebe metade do material.",
            ],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["A costura se faz em qualquer lugar: abra o painel (F2), entre em Guildas e abra a Costura. Comece fiando a própria linha: 1 linho e 1 água potável dão 3 linhas."],
        },
        {
            id: "supply",
            question: "De onde vêm os materiais?",
            answer: ["Linho e linha vêm do Agricultor, que planta linho e tosquia ovelhas. Os couros vêm do Caçador, as fivelas e a fixação do Ferreiro, e a prata das joias, dos Coletores."],
        },
    ],
    alchemistae: [
        {
            id: "what",
            question: "O que eu posso fazer sendo alquimista?",
            answer: [
                "Poções, venenos e óleos na mesa de alquimia. Cada poção tem quatro qualidades, a Fraca, a comum, a Forte e a do Henry, e as melhores abrem conforme o seu nível.",
                "No secador você seca ervas; e na mesa faz também carvão lixiviado, cogumelos e raridades como a pérola de água-doce e a raiz de mandrágora.",
            ],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["Na mesa de alquimia: aperte E e escolha Criar. Na mesa do jogo a poção é feita no minijogo; numa mesa nossa, direto na página. O secador fica no açougue."],
        },
        {
            id: "supply",
            question: "De onde vêm os materiais?",
            answer: ["As ervas vêm do Agricultor, que planta dezenove delas, e das plantas do campo. A água fervida e o vinho vêm do Taberneiro, o carvão do Ferreiro e a lenha do Coletor."],
        },
    ],
    tabernarii: [
        {
            id: "what",
            question: "O que eu posso fazer sendo taberneiro?",
            answer: [
                "No fogo você cozinha carnes e legumes, assa pão, faz as doze sopas e ferve água: 1 lenha dá 4 águas potáveis.",
                "Faz também cerveja, hidromel, vinho e aguardente, e até fia linha com a água do próprio corpo, o que dá sede. As bebidas treinam a sua Inebriação.",
            ],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["Em qualquer fogo de cozinha: aperte F e escolha Cozinhar. O E do fogo é do jogo, para comer da panela. Comece pelas receitas simples, como assar legumes e ferver água."],
        },
        {
            id: "supply",
            question: "De onde vêm os materiais?",
            answer: ["Grãos, legumes, uvas, malte e lúpulo vêm do Agricultor; a carne, do Caçador; a lenha e o sal, do Coletor. Ovos, mel, peixe e leite estão no mundo: ninhos, colmeias, armadilhas e vacas."],
        },
    ],
    venatores: [
        {
            id: "what",
            question: "O que eu posso fazer sendo caçador?",
            answer: ["Você caça e abate os animais, o que dá carne, couro e miúdos. No defumador você defuma carnes e peixes, que duram muito mais, e vende couro e carne para as outras guildas."],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["Abata o animal que você caçou com F na carcaça. O defumador fica nas vilas e nos acampamentos: aperte E nele. A caça vive nos bosques, e os lobos também; ande armado."],
        },
        {
            id: "supply",
            question: "De onde vêm os materiais?",
            answer: ["A caça é o seu material. Sal e lenha vêm do Coletor. Quem compra o seu couro é o Artesão e o Ferreiro; a sua carne, o Taberneiro."],
        },
    ],
    collectores: [
        {
            id: "what",
            question: "O que eu posso fazer sendo coletor?",
            answer: [
                "Você corta árvores e quebra pedras. A árvore dá lenha, madeira de arco, nozes e às vezes madeira exótica.",
                "A pedra dá sucata, ferro, sal, cobre, jaspe, enxofre, salitre e, com sorte, minério de prata, mais nas pedras da região de Kuttenberg.",
            ],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["Leve o machado ou a picareta na bolsa e aperte E numa árvore ou numa pedra. Cada uma descansa um tempo depois. A ferramenta se gasta com o uso: leve uma de reserva."],
        },
        {
            id: "supply",
            question: "Para quem eu trabalho?",
            answer: ["O seu material é o mundo, e quem depende de você é o Ferreiro, mais que todos: sucata, ferro, cobre, lenha e madeira de arco. A lenha também vai para o Taberneiro e o Alquimista."],
        },
    ],
    agricolae: [
        {
            id: "what",
            question: "O que eu posso fazer sendo agricultor?",
            answer: [
                "Você planta nas hortas das vilas: legumes, ervas, linho, trigo, cevada, lúpulo e uvas, vinte e uma plantas.",
                "Na página da horta você fia o linho em linha, mói o trigo, maltea a cevada e guarda sementes. E ordenha as vacas e tosquia as ovelhas: aperte E nelas.",
            ],
        },
        {
            id: "where",
            question: "Onde eu trabalho e como começo?",
            answer: ["Leve a pá na bolsa e aperte E num canteiro de horta: escolha a planta e plante. Ela cresce em tempo real, mesmo com você fora do jogo, e você é avisado quando estiver pronta."],
        },
        {
            id: "supply",
            question: "De onde vêm as sementes?",
            answer: ["Do seu kit, de duas colheitas da mesma planta (Sementes, na página da horta) e das plantas do campo, que às vezes dão a semente junto. A pá é forjada pelo Ferreiro."],
        },
    ],
    domitores: [
        {
            id: "what",
            question: "O que eu posso fazer sendo domador?",
            answer: ["Você doma os cavalos selvagens dos campos abertos. Ofereça comida até a confiança dele chegar a 100; então monte ou mande seguir, e ele é seu, já de sela e rédeas."],
        },
        {
            id: "where",
            question: "Onde ficam os cavalos selvagens?",
            answer: ["Em campos abertos longe das vilas, dois em cada. Chegue a uns três metros e aperte E: Domar. Eles se assustam e fogem; tenha paciência. Ninguém monta um cavalo selvagem antes de domá-lo."],
        },
        {
            id: "supply",
            question: "Que comida eles aceitam?",
            answer: ["Cenoura é a que mais conquista; depois maçã, pera, beterraba, nabo e pão. Tudo isso vem do Agricultor. Ferraduras, selas e arreios vêm do Ferreiro."],
        },
    ],
};

/** The three questions every vendor answers, in the trade's words. */
function common(guildId: string, profession: string): TalkTopic[] {
    const skill = SKILL[guildId] ?? "";
    const level: TalkTopic =
        guildId === "domitores"
            ? { id: "level", question: "Como fico melhor no ofício?", answer: ["A doma não dá XP de habilidade: o que conta é a confiança do cavalo e a comida que você leva. Quem monta muito treina a Equitação."] }
            : {
                  id: "level",
                  question: "Como subo de nível no ofício?",
                  answer: [
                      `Cada trabalho feito dá XP de ${skill}. As receitas do seu nível dão mais, e as muito abaixo dele rendem pouco; quanto mais alto o nível da receita, mais XP e mais material ela pede.`,
                      "Quanto mais o seu nível passa o da receita, melhor a qualidade da peça. As peças de nobre só são feitas por quem é nobre, ou tem o título de Mestre de ofício ou de guilda.",
                  ],
              };
    const shop: TalkTopic =
        guildId === "domitores"
            ? {
                  id: "shop",
                  question: "O que você vende?",
                  answer: ["Três cavalos mansos, por 200 moedas cada, um só por pessoa: outro, só quando o seu morrer. E o que um cavalo come."],
              }
            : {
                  id: "shop",
                  question: "O que você compra e vende?",
                  answer: [
                      `Vendo o material do ofício pelo preço da raridade, e compro de você o que é do ofício por 40% do preço. Cada um tem 300 moedas comigo: vale para todos os ${PLURAL[guildId] ?? profession.toLowerCase()} do reino.`,
                      "A sua conta enche de novo 24 horas depois do primeiro negócio. E nós só estamos aqui de dia.",
                  ],
              };
    return [
        level,
        shop,
        {
            id: "join",
            question: "Como eu entro na guilda?",
            answer: ["Se você é cidadão desta cidade, aprenda comigo, em Aprender Guilda: o primeiro ofício é de graça, os outros custam 100 moedas."],
        },
    ];
}

/** Every question a vendor of `guildId` answers: the trade's own, then the three every vendor answers. */
export function topicsOf(guildId: string, profession: string): TalkTopic[] {
    return [...(TRADE[guildId] ?? []), ...common(guildId, profession)];
}
