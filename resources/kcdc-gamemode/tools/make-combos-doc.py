"""Writes COMBOS.md: the fifty-one weapon combos of the game, what each does in its own words, and what the review of 2026-10-26 says of each for an RP server.

    python tools/make-combos-doc.py [game folder]

The user's request: "vamos ver todos combos para ver qual não quebra o combate por se tratar de um servidor rp online, algumas podem ser muito roubadas". The
combos come from the game's tables and texts through `make-combos.py` (`load`): the weapon, the level at which the game handed it over, how many strokes it has,
what the finisher is, whether the finisher is aimed by the game's solver (`UseSolver`: it picks the zone the opponent is not guarding, so a block does not stop
it) and whether it is charged (slow, and seen coming). The game has no number for what a combo does; the opinion below is read from those facts and from the
words of each, and none of it was tried in the game.
"""

import importlib.util
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent.parent / "COMBOS.md"

spec = importlib.util.spec_from_file_location("make_combos", HERE / "make-combos.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

# What the finisher hits, by what the game says of it: the body where it lands decides how much a blow that cannot be blocked is worth.
# risk: baixo / medio / alto. advice: livre (anyone who knows it may teach it), mestre (only an administrator teaches it).
NOTES: dict[tuple[str, str], tuple[str, str, str]] = {
    # ---- Montante
    ("longsword", "C01"): ("o corpo, por baixo", "medio", "O golpe final passa pela guarda sozinho: depois de dois golpes bloqueados, o terceiro acerta. É o combo básico do jogo, dado ao nível 5; faz de quem se defende só bloqueando um alvo fácil."),
    ("longsword", "C02"): ("o corpo, por baixo", "medio", "O espelho do anterior, do outro lado: mesma coisa."),
    ("longsword", "C12"): ("o rosto, com o pomo", "medio", "Estocada carregada (lenta e vista de longe), acerta o rosto com o pomo: atordoa, não corta."),
    ("longsword", "C07"): ("o rosto, apunhalado", "alto", "Quatro golpes e uma estocada carregada no rosto: ferimento fatal em quem não esquiva. Difícil de encadear, mas decide uma luta."),
    ("longsword", "C09"): ("o abdômen", "baixo", "Três golpes de corpo, sem passar a guarda: só vale contra quem já se descuidou."),
    ("longsword", "C06"): ("o joelho", "medio", "O golpe final passa a guarda e vai ao joelho: tira a perna do outro."),
    ("longsword", "C05"): ("o lado, rente à lâmina", "medio", "Passa a guarda por dentro da lâmina do outro e acerta de lado."),
    ("longsword", "C08"): ("a cabeça, por cima", "alto", "Estocada carregada na cabeça depois de dois golpes por cima: vista de longe, mas a cabeça é a cabeça."),
    ("longsword", "C11"): ("o peito, a duas mãos", "alto", "Estocada de duas mãos no peito: o ferimento mais fundo do montante, sem a lentidão da carga."),
    ("longsword", "C13"): ("a cabeça, desviando a arma", "alto", "Quatro golpes e o último desvia a espada do outro e acerta a cabeça: o combo mais caro do montante (nível 22) e o mais certeiro."),
    # ---- Espada
    ("sword", "C03"): ("o corpo, por baixo", "medio", "Passa a guarda sozinho (golpe inferior): o combo básico da espada."),
    ("sword", "C04"): ("o corpo, por baixo", "medio", "Idem, do outro lado."),
    ("sword", "C06"): ("o pescoço", "alto", "Quatro golpes e um corte carregado no pescoço: carregado dá tempo de ver, mas pescoço é pescoço."),
    ("sword", "C12"): ("a garganta", "alto", "Quatro golpes e um corte na garganta, sem carga: o mais traiçoeiro da espada."),
    ("sword", "C14"): ("o joelho", "medio", "Estocada no joelho depois de dois golpes: tira a perna do outro, sem passar a guarda."),
    ("sword", "C13"): ("o rosto, com o pomo", "medio", "Pomo no rosto depois de dois golpes por cima: atordoa."),
    ("sword", "C01"): ("o rosto, com o pomo", "medio", "Pomo carregado no rosto: atordoa e se vê chegar."),
    ("sword", "C05"): ("o abdômen", "medio", "Passa a guarda sozinho e corta o abdômen."),
    ("sword", "C11"): ("a lâmina do outro", "medio", "Escorrega pela lâmina do oponente e a trespassa: tira a arma da linha."),
    # ---- Espada e escudo
    ("sword_shield", "C03"): ("o corpo, por baixo", "medio", "Passa a guarda sozinho: o escudo não ajuda contra ele."),
    ("sword_shield", "C04"): ("o corpo, por baixo", "medio", "Idem, do outro lado."),
    ("sword_shield", "C14"): ("o joelho", "medio", "Estocada no joelho."),
    ("sword_shield", "C02"): ("o rosto, com a borda do escudo", "medio", "Escudada carregada no rosto: atordoa."),
    ("sword_shield", "C05"): ("o abdômen", "medio", "Passa a guarda sozinho e corta o abdômen."),
    ("sword_shield", "C06"): ("o pescoço", "alto", "O mesmo da espada solta: quatro golpes e um corte carregado no pescoço."),
    ("sword_shield", "C11"): ("a lâmina do outro", "medio", "Escorrega pela lâmina do oponente (nível 18)."),
    # ---- Maça ou machado
    ("blunt", "C05"): ("o abdômen", "baixo", "Três golpes de corpo, sem passar a guarda."),
    ("blunt", "C15"): ("o joelho, esmagado", "medio", "Quatro golpes e uma pancada no joelho: quem a leva manca de verdade."),
    ("blunt", "C03"): ("o corpo, por baixo", "medio", "Passa a guarda sozinho."),
    ("blunt", "C04"): ("o corpo, por baixo", "medio", "Idem, do outro lado."),
    ("blunt", "C01"): ("o rosto, com o cabo", "medio", "Cabo carregado no rosto: atordoa."),
    ("blunt", "C09"): ("o queixo", "medio", "Quatro golpes e um no queixo: nocaute."),
    # ---- Maça ou machado e escudo
    ("blunt_shield", "C03"): ("o corpo, por baixo", "medio", "Passa a guarda sozinho."),
    ("blunt_shield", "C04"): ("o corpo, por baixo", "medio", "Idem, do outro lado."),
    ("blunt_shield", "C02"): ("o rosto, com a borda do escudo", "medio", "Escudada carregada no rosto: atordoa."),
    ("blunt_shield", "C05"): ("o abdômen", "baixo", "Três golpes de corpo, sem passar a guarda."),
    ("blunt_shield", "C16"): ("as costelas, com o escudo", "baixo", "Quatro golpes e uma escudada nas costelas: dói, não mata."),
    ("blunt_shield", "C09"): ("o queixo", "medio", "Quatro golpes e um no queixo: nocaute."),
    ("blunt_shield", "C15"): ("o joelho, esmagado", "medio", "Quatro golpes e uma pancada no joelho (nível 22)."),
    # ---- Alabarda
    ("halberd", "C04"): ("o corpo, por baixo", "baixo", "Sem passar a guarda: só vale contra quem já se descuidou."),
    ("halberd", "C03"): ("o corpo, por baixo", "medio", "Passa a guarda sozinho, com o alcance da haste."),
    ("halberd", "C07"): ("a perna, fazendo tropeçar", "medio", "Faz o oponente tropeçar: perde o equilíbrio e o ritmo."),
    ("halberd", "C05"): ("o estômago", "medio", "Estocada no abdômen desprotegido (nível 18): com o alcance da haste, é o combo mais longo da arma."),
    # ---- Corpo a corpo
    ("unarmed", "C09"): ("derruba", "alto", "Arremesso que derruba o oponente: dois corpos animados juntos e o do outro cai de verdade; é a única que o jogo dá por missão, sem nível. Se algo vai dar errado com o outro jogador, é aqui."),
    ("unarmed", "C06"): ("o rosto", "baixo", "Gancho de esquerda no rosto: soco de taverna."),
    ("unarmed", "C02"): ("o rosto, com as costas da mão", "baixo", "O revés boêmio: humilha mais do que machuca."),
    ("unarmed", "C03"): ("o queixo, com o cotovelo", "medio", "Cotovelada carregada no queixo: nocaute, e se vê chegar."),
    ("unarmed", "C01"): ("o rosto", "baixo", "Martelo carregado no rosto: se vê chegar."),
    ("unarmed", "C08"): ("o rosto, contra o cotovelo", "medio", "Quatro golpes e a cabeçada: nocaute."),
    ("unarmed", "C05"): ("o pescoço", "medio", "Quatro golpes e um soco carregado no pescoço."),
    ("unarmed", "C07"): ("o rosto", "baixo", "Soco direto carregado no rosto (nível 15)."),
}

RISK = {"baixo": "Baixo", "medio": "Médio", "alto": "**Alto**"}
ADVICE = {
    "baixo": "livre",
    "medio": "livre, vigiando",
    "alto": "**só o admin ensina**",
}


def main() -> None:
    combos = generator.load()
    missing = [(c["group"], c["code"]) for c in combos if (c["group"], c["code"]) not in NOTES]
    if missing:
        raise SystemExit(f"sem nota: {missing}")
    groups = {gid: pt for _ui, gid, pt, _en, _track in generator.GROUPS}
    by_group = defaultdict(list)
    for combo in combos:
        by_group[combo["group"]].append(combo)

    count = Counter(NOTES[(c["group"], c["code"])][1] for c in combos)
    bypass = [c for c in combos if c["solver"]]
    lines = [
        "# As combinações de arma, vistas para o servidor",
        "",
        "Pedido de 26/10/2026: *vamos ver todos combos para ver qual não quebra o combate por se tratar de um servidor RP online; algumas podem ser muito roubadas.*",
        "",
        f"São as **{len(combos)} combinações** de arma do jogo (as da seção **Esgrima** do painel): uma sequência de golpes que termina num golpe especial. Gerado por `tools/make-combos-doc.py` a partir das tabelas do jogo (`CombatCombos__generated.xml`) e dos textos de cada uma; as opiniões estão nesse arquivo e podem ser mudadas lá.",
        "",
        "> **O jogo não dá número nenhum para uma combinação** (nem dano, nem Vigor): o golpe final é uma animação de duas pessoas (as tabelas de ações sincronizadas do jogo), e o que ele faz é o que o texto diz. Por isso a opinião aqui é qualitativa, lida de quatro fatos de cada uma, **e nada foi testado numa luta de verdade entre dois jogadores**: (1) quanto vale o lugar que o golpe final acerta (cabeça, pescoço e peito ferem fundo; corpo e queixo, não); (2) se o golpe final **passa a guarda sozinho** (o jogo escolhe a zona que o outro não está protegendo: bloquear não adianta); (3) se é **carregado** (lento, e o outro o vê chegar); (4) quantos golpes pede (de dois a quatro: mais golpes, mais difícil de armar).",
        "",
        "## O que sai da revisão",
        "",
        f"- **Alto risco ({count['alto']}):** o golpe final vai à cabeça, ao pescoço, à garganta ou ao peito, ou **derruba** o outro com o corpo animado junto. Numa luta que o RP não combinou, é a morte (ou um corpo jogado no chão) sem volta. Sugestão: **só o administrador ensina** (quem aprende usa, mas não passa adiante), e o admin ensina quando houver história para isso (um mestre de esgrima, uma escola).",
        f"- **Risco médio ({count['medio']}):** atordoam (pomo, escudo ou cabo no rosto), tiram a perna (joelho, tropeço) ou passam a guarda por baixo. Ficam livres: são a esgrima do jogo, com quem sabe vencendo quem não sabe. Vigiar.",
        f"- **Baixo risco ({count['baixo']}):** acertam o corpo ou dão soco de taverna, sem passar a guarda. Livres.",
        f"- **Passam a guarda sozinhas ({len(bypass)}):** a família dos *golpes inferiores* (a primeira que o jogo dá, ao nível 5 ou 6), *No Joelho* (montante), *Oben Abnehmen* e os *Mittelhaw* de espada e de espada e escudo. O jogo as dá a todo mundo cedo: é a resposta dele a quem só sabe bloquear. Num servidor em que a luta é rara e narrada, é ótimo que sejam raras: o ensino já faz isso (ninguém ganha combinação lutando, só ensinada).",
        "- **A que dá mais medo no multijogador é a única do corpo a corpo que derruba** (*Ataque de Ombro*): o golpe final é, tudo indica, uma animação sincronizada de dois corpos (o de quem bate e o de quem cai), e o jogo não foi feito para isso entre dois jogadores. Se alguma combinação travar o outro jogador no chão ou deixá-lo preso, é ela. Não a ensinar sem testar com dois admins.",
        "- **Quem já as tem:** 63 dos 80 personagens salvos tinham 12 combinações dadas pelo jogo (as de nível 5 ou 6 que o jogo dá a todo novo personagem); continuam com elas. Personagem novo não ganha nenhuma, e o admin recebe todas.",
        "",
        "## As combinações",
        "",
        "Nível = o nível da habilidade de arma em que o jogo a dava sozinho (0: a de uma missão). Golpes = quantos golpes tem a sequência, o final incluído. **Guarda** = o golpe final passa a guarda sozinho. **Carga** = o golpe final é carregado (lento).",
        "",
    ]
    for gid, label in groups.items():
        rows = by_group.get(gid)
        if not rows:
            continue
        lines += [f"### {label}", "", "| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |", "| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |"]
        for combo in rows:
            target, risk, note = NOTES[(combo["group"], combo["code"])]
            finisher = generator.FINISHERS[combo["finisher"]][0]
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"**{combo['name'][0]}** ({combo['code']})",
                        str(combo["level"]),
                        str(combo["steps"]),
                        finisher,
                        "sim" if combo["solver"] else "não",
                        "sim" if combo["charged"] else "não",
                        target,
                        RISK[risk],
                        note,
                        ADVICE[risk],
                    ]
                )
                + " |"
            )
        lines.append("")

    lines += [
        "## O que dá para fazer, se o RP pedir",
        "",
        "1. **Só o admin ensina as de alto risco.** Uma lista no `esgrima.ts` (hoje todas são livres: quem sabe, ensina) e a tela mostra *Ensinar* só para o admin nelas. Pequeno e sem efeito em quem já as tem.",
        "2. **Não dar o Ataque de Ombro** enquanto não houver teste de dois jogadores: o admin a tem, mas não a ensina.",
        "3. **Dar as combinações por escola:** só as de risco baixo e médio no começo, as de alto risco quando houver um mestre de esgrima (um NPC que ensina, o que já existe para as habilidades: `/mestres`).",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\r\n")
    print(f"{len(combos)} combinações -> {OUT}: {dict(count)}, {len(bypass)} passam a guarda")


if __name__ == "__main__":
    main()
