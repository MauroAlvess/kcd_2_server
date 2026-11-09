/**
 * What the death screen reads (2026-10-31, user: "ao morrer vamos add a câmera rodando em volta do corpo devagar, um texto, alguma reza da bíblia, e embaixo um contador de 10 s até voltar à
 * vida ... tipo uma tela customizada de morte"): a verse or a prayer of Scripture, drawn at random for each death, in the language of the one who fell, with its reference. The words are
 * the old ones (the psalms, the Our Father, the Gospel of John), set down here in plain Portuguese and in the English of the King James Bible, which is nobody's property; the page itself
 * has no dictionary, it is sent the verse already in the player's language.
 */

export interface Verse {
    /** Where it is written: "Salmo 23:1,4". */
    readonly ref: { readonly pt: string; readonly en: string };
    readonly pt: string;
    readonly en: string;
}

export const VERSES: readonly Verse[] = [
    {
        ref: { pt: "Salmo 23:1,4", en: "Psalm 23:1,4" },
        pt: "O Senhor é o meu pastor, nada me faltará. Ainda que eu ande pelo vale da sombra da morte, não temerei mal algum, porque tu estás comigo.",
        en: "The Lord is my shepherd; I shall not want. Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me.",
    },
    {
        ref: { pt: "Salmo 130:1-2", en: "Psalm 130:1-2" },
        pt: "Das profundezas clamo a ti, Senhor. Senhor, escuta a minha voz; estejam atentos os teus ouvidos à voz das minhas súplicas.",
        en: "Out of the depths have I cried unto thee, O Lord. Lord, hear my voice: let thine ears be attentive to the voice of my supplications.",
    },
    {
        ref: { pt: "Salmo 121:1-2", en: "Psalm 121:1-2" },
        pt: "Levanto os meus olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor, que fez o céu e a terra.",
        en: "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the Lord, which made heaven and earth.",
    },
    {
        ref: { pt: "Salmo 51:1", en: "Psalm 51:1" },
        pt: "Tem misericórdia de mim, ó Deus, segundo a tua bondade; segundo a grandeza das tuas misericórdias, apaga as minhas transgressões.",
        en: "Have mercy upon me, O God, according to thy lovingkindness: according unto the multitude of thy tender mercies blot out my transgressions.",
    },
    {
        ref: { pt: "Mateus 6:9-10", en: "Matthew 6:9-10" },
        pt: "Pai nosso, que estás nos céus, santificado seja o teu nome; venha o teu reino; seja feita a tua vontade, assim na terra como no céu.",
        en: "Our Father which art in heaven, Hallowed be thy name. Thy kingdom come, Thy will be done in earth, as it is in heaven.",
    },
    {
        ref: { pt: "João 11:25", en: "John 11:25" },
        pt: "Eu sou a ressurreição e a vida: quem crê em mim, ainda que esteja morto, viverá.",
        en: "I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live.",
    },
    {
        ref: { pt: "Salmo 4:8", en: "Psalm 4:8" },
        pt: "Em paz me deito e logo adormeço, porque só tu, Senhor, me fazes habitar em segurança.",
        en: "I will both lay me down in peace, and sleep: for thou, Lord, only makest me dwell in safety.",
    },
    {
        ref: { pt: "Salmo 27:1", en: "Psalm 27:1" },
        pt: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?",
        en: "The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?",
    },
    {
        ref: { pt: "Isaías 41:10", en: "Isaiah 41:10" },
        pt: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo.",
        en: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.",
    },
];

/** What is said above the counter. */
export const LABEL = { pt: "Você volta a si em", en: "You will rise again in" } as const;

/** A verse drawn with a roll in [0, 1). */
export function verseAt(roll: number): Verse {
    const at = Math.min(VERSES.length - 1, Math.max(0, Math.floor(roll * VERSES.length)));
    return VERSES[at] as Verse;
}

/** What the page is sent for a death: the verse, its reference and the line over the counter, in the one language, and how long the wait is. */
export function screenFor(lang: "pt" | "en", seconds: number, roll: number = Math.random()): { seconds: number; text: string; ref: string; label: string } {
    const verse = verseAt(roll);
    return { seconds, text: verse[lang], ref: verse.ref[lang], label: LABEL[lang] };
}
