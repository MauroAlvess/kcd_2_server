"""Writes PASSIVAS.md: every passive the game shows a player (its perk screen), what it does in the game's own words, and what the review of 2026-10-26 says of it.

    python tools/make-perks-doc.py [game folder]

The user's request: "vamos ver todas as passivas e ver quais fazem sentido para um co-op e quais são muito roubadas e quais precisamos add no sistema de
ofício, exemplo uma que faz mais poções ou que melhora comida e por aí vai". The passives (the game's `perk` rows that are `Visible`, 268 of them, not the
fifty-one weapon combos) come from the game's tables and texts; the opinion on each is `perks-verdicts.py`'s, an opinion read from the
texts and from what the server does and does not have, none of it tried in the game.
"""

import html
import importlib.util
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Program Files (x86)\Steam\steamapps\common\KingdomComeDeliverance2")
OUT = HERE.parent.parent.parent / "PASSIVAS.md"

spec = importlib.util.spec_from_file_location("perks_verdicts", HERE / "perks-verdicts.py")
verdicts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verdicts)
VERDICTS = verdicts.VERDICTS

ATTR = re.compile(r'(\w+)="([^"]*)"')

# The order of the sections: the unattached ones, the four attributes, then the skills as the game's perk screen groups them.
ORDER = [
    ("?", "Heranças e prestígio"),
    ("strength", None),
    ("agility", None),
    ("vitality", None),
    ("speech", None),
    ("weapon_sword", None),
    ("weapon_large", None),
    ("heavy_weapons", None),
    ("weapon_unarmed", None),
    ("fencing", None),
    ("marksmanship", None),
    ("horse_riding", None),
    ("houndmaster", None),
    ("stealth", None),
    ("thievery", None),
    ("survival", None),
    ("alchemy", None),
    ("craftsmanship", None),
    ("scholarship", None),
    ("drinking", None),
]

LABELS = {
    "ok": "Fica",
    "coop": "Fica, bom para o co-op",
    "atencao": "Fica, com cuidado",
    "forte": "**Forte demais**",
    "sem": "Sem efeito aqui",
    "oficio": "**Levar para o ofício**",
}


# What the craft system could do with them, from what it has (`craft.ts` hands the product out in `finishWork`, with `Inventory.add`, which takes the amount and a
# `metadata` of the item; the tiredness and the thirst are the server's own; the vendors are ours). A proposal, nothing of it is done.
PROPOSAL = [
    "#### Como seria, no ofício, o que fazem (uma proposta, nada disto está feito)",
    "",
    "| Ofício | Passivas | O que o ofício faria | Por onde se faz |",
    "| --- | --- | --- | --- |",
    "| **Alquimia** (Alchemistae) | Segredo da Matéria I e II | **Mais poções:** quem tem a I recebe **uma poção extra** em cada receita feita, quem tem a II, **duas** (três com as duas), como o jogo diz. É o dobro ou o triplo do que a erva rende; a versão branda é 1 extra a cada 2 receitas na I e 1 por receita na II. | `finishWork` soma ao `amount` (a tela já mostra `3x Poção`) |",
    "| **Alquimia** | Segredo do Equilíbrio I e II, Segredo dos Segredos, Aprendiz de Artes das Trevas | **Qualidade:** uma chance (cada passiva soma um pouco; à noite a Aprendiz soma mais) de a poção sair de qualidade melhor. Só vale se o jogo aceitar a qualidade no item que o servidor entrega; senão fica uma chance de **uma poção a mais**. | `metadata` do `Inventory.add`, ou o rendimento |",
    "| **Cozinha, defumador e secador** (Tabernarii, Venatores) | Mestre Cozinheiro, Arte da Preservação | **Rendimento:** uma chance de **uma porção a mais** em cada receita de comida, para quem tem a passiva; a comida já nasce com a condição cheia, então o resto do que a passiva promete já está cumprido. | `finishWork` |",
    "| **Forja** (Fabri Ferrarii) | Aço Temperado, Sabedoria de Espadachim, Segredo de Martin | **Peça melhor:** a arma forjada por quem tem a passiva sai com **mais condição** (e a de topo, de qualidade quatro, pede a de Martin). Depende de o item aceitar a condição no `metadata`; é o que `spoilage.ts` e o ladrão já leem. | `metadata` do `Inventory.add` |",
    "| **Todos os ofícios** | Entusiasta, Alma Criativa | **Cansaço:** trabalhar numa estação devolve um pouco de Energia (ou segura a fome) a quem tem a passiva, como na mesa do jogo. | o Cansaço do servidor (`tiredness.ts`) em `finishWork` |",
    "| **Colheita** (Agricolae, Coletores) | Achadinho da Sorte | **Mais uma:** chance de uma planta ou erva a mais na colheita das hortas e de um achado pequeno. | `farm.ts` na colheita |",
    "| **Venda** (o Boticário) | Vendedor de Poções | O vendedor Boticário paga **+30%** (35% → 45% do preço) pela poção de quem tem a passiva. | `vendors.ts` (o preço de compra por jogador) |",
    "",
    "As duas primeiras linhas valem o trabalho já: são o exemplo que o pedido deu, e hoje quem gastou o ponto na Matéria não recebe nada.",
    "",
]


def texts(pak_path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    with zipfile.ZipFile(pak_path) as pak:
        for name in pak.namelist():
            raw = pak.read(name)
            try:
                body = raw.decode("utf-8")
            except UnicodeDecodeError:
                body = raw.decode("cp1252", "replace")
            for key, english, portuguese in re.findall(r"<Row><Cell>([^<]*)</Cell><Cell>([^<]*)</Cell><Cell>([^<]*)</Cell></Row>", body):
                out[key] = html.unescape(portuguese)
    return out


def clean(text: str) -> str:
    """What a perk's description says, without the markup, the keys' placeholders and the line breaks."""
    text = re.sub(r"<br\s*/?>|</p>|<p>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    text = re.sub(r"\$[A-Za-z_]+;", "[tecla]", text)
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    tables = zipfile.ZipFile(GAME / "Data" / "Tables.pak")
    words = texts(GAME / "Localization" / "Portuguese_xml.pak")

    perks = {}
    for name in ("perk.xml", "perk__kcd2.xml", "perk__combat.xml", "perk__hardcore.xml", "perk__dlc2.xml", "perk__recipe.xml"):
        body = tables.read(f"Libs/Tables/rpg/{name}").decode("utf-8", "replace")
        for row in re.findall(r"<perk ([^>]*?)/>", body):
            fields = dict(ATTR.findall(row))
            perks[fields["perk_id"]] = {key: html.unescape(value).strip() for key, value in fields.items()}
    skills = {}
    for row in re.findall(r"<skill ([^>]*?)/>", tables.read("Libs/Tables/rpg/skill.xml").decode("utf-8", "replace")):
        fields = dict(ATTR.findall(row))
        skills[fields["skill_id"]] = fields
    stats = {}
    for row in re.findall(r"<stat ([^>]*?)/>", tables.read("Libs/Tables/rpg/stat.xml").decode("utf-8", "replace")):
        fields = dict(ATTR.findall(row))
        stats[fields["stat_id"]] = fields

    shown = defaultdict(list)
    for perk in perks.values():
        # The weapon combos and what the game hides are no passive of the player's: only what the perk screen shows.
        if perk.get("visibility") != "2":
            continue
        if "skill_selector" in perk:
            track = skills[perk["skill_selector"]]["skill_name"]
        elif "stat_selector" in perk:
            track = stats[perk["stat_selector"]]["stat_name"]
        else:
            track = "?"
        shown[track].append(perk)

    names = {perk["perk_name"] for ps in shown.values() for perk in ps}
    missing = sorted(names - set(VERDICTS))
    extra = sorted(set(VERDICTS) - names)
    if missing or extra:
        raise SystemExit(f"sem veredito: {missing}; veredito de passiva que não existe: {extra}")

    def title_of(track: str) -> str:
        for key, label in ORDER:
            if key == track and label:
                return label
        if track in skills_by_name:
            return words.get(skills_by_name[track]["ui_string_name"], track)
        return words.get(stats_by_name[track]["ui_string_name"], track)

    skills_by_name = {s["skill_name"]: s for s in skills.values()}
    stats_by_name = {s["stat_name"]: s for s in stats.values()}

    total = Counter(VERDICTS[perk["perk_name"]][0] for ps in shown.values() for perk in ps)
    lines = [
        "# As passivas do jogo, vistas para o servidor",
        "",
        "Pedido de 26/10/2026: *vamos ver todas as passivas e ver quais fazem sentido para um co-op e quais são muito roubadas e quais precisamos add no sistema de ofício, exemplo uma que faz mais poções ou que melhora comida e por aí vai.*",
        "",
        f"São as **{sum(total.values())} passivas** que o jogo mostra na tela de vantagens (as de visibilidade *Visible*, as de cada habilidade e atributo e as de herança e prestígio), com o que cada uma faz **nas palavras do próprio jogo** e a **opinião** desta revisão. Ficam de fora as 51 combinações de arma e o que o jogo esconde. Gerado por `tools/make-perks-doc.py` a partir das tabelas e dos textos do jogo; as opiniões são de `tools/perks-verdicts.py` e podem ser mudadas lá.",
        "",
        "> **Nada disto foi testado no jogo.** Os veredictos vêm do texto de cada passiva, de quais sistemas do jogo o servidor usa (os vendedores são os nossos, as fechaduras são as nossas, a alquimia e os outros ofícios se fazem na página dos ofícios, o cão do apoiador é do servidor, não há reputação, regateio nem guardas conversando com o jogador) e de bom senso de RP. Um número que o texto não diz (o quanto uma luta fica mais fácil) fica sem número: a opinião é qualitativa.",
        "",
        "## Os vereditos",
        "",
        "| Veredito | O que quer dizer | Quantas |",
        "| --- | --- | --- |",
        f"| {LABELS['ok']} | um bônus pequeno ou de sabor, só de quem o tem | {total['ok']} |",
        f"| {LABELS['coop']} | serve a quem joga em grupo: carga, luta contra vários, enfermaria, taverna | {total['coop']} |",
        f"| {LABELS['atencao']} | forte numa luta de jogador contra jogador ou na economia, mas dentro do que o jogo quis; vale vigiar e, se pesar, cortar | {total['atencao']} |",
        f"| {LABELS['forte']} | tira o peso da morte, da fechadura, da armadura ou do ferimento; sugestão: **bloquear** (`Progression.blockPerks`, como já se faz com as combinações) | {total['forte']} |",
        f"| {LABELS['sem']} | depende de uma parte do jogo de um jogador só (reputação, regateio, guardas, minijogos, o cão do jogo) que o servidor não usa: não faz mal, mas gasta o ponto de quem a escolhe | {total['sem']} |",
        f"| {LABELS['oficio']} | age num trabalho que hoje se faz na página dos ofícios (alquimia, cozinha, forja, colheita), e lá **não faz nada**: o efeito pode ser refeito no sistema de ofícios | {total['oficio']} |",
        "",
    ]

    def block(code: str, heading: str, note: str) -> None:
        picked = [(perk, track) for track, ps in shown.items() for perk in ps if VERDICTS[perk["perk_name"]][0] == code]
        lines.extend([f"### {heading}", "", note, ""])
        for perk, track in sorted(picked, key=lambda pair: (title_of(pair[1]), int(pair[0].get("level") or 0))):
            name = words.get(perk.get("perk_ui_name", ""), perk["perk_name"])
            lines.append(f"- **{name}** ({title_of(track)}, nível {perk.get('level', '?')}): {VERDICTS[perk['perk_name']][1]}")
        lines.append("")

    lines += ["## O que a revisão pede, em resumo", ""]
    block("forte", "Bloquear (forte demais para um servidor de RP)", "São passivas que o jogador escolhe na tela de vantagens e que mudam o que o servidor quer decidir pelo RP: a morte, a fechadura, a corrida, o ferimento. Bloqueadas, o jogo não as concede e o servidor as tira de quem tem (como se faz com as combinações). **Bloqueadas desde 01/11/2026** (pedido: *desativa essas passivas roubadas, deixe apenas Marbon com elas; os jogadores que a tinham, retire e devolve os pontos*): ninguém as aprende na tela de vantagens; quem as tinha as perde ao entrar e recebe o ponto de volta na árvore de cada uma, com um aviso; só o Marbon fica com as nove (`STRONG_KEEPERS` em `src/server/perk-guard.ts`).")
    block("oficio", "Levar para o sistema de ofícios", "Agem em trabalhos que o jogo faz numa tela dele (a mesa de alquimia, o caldeirão, a bigorna) e que aqui se fazem na página dos ofícios: o jogador que gastou o ponto não recebe nada. Cada uma pode virar um efeito do ofício (rendimento, qualidade, tempo, Cansaço); a primeira da lista, as poções extras, é a mais clara.")
    lines += PROPOSAL
    block("atencao", "Vigiar (fortes em luta de jogador contra jogador ou na economia)", "Ficam, mas pesam: bola de neve em luta, golpes que se encadeiam, esquiva e armadura baratas, tiros que se somam, vendas em dobro. Se o RP pedir, o corte é de passiva em passiva.")

    for track, _label in ORDER:
        group = shown.get(track)
        if not group:
            continue
        lines += [f"## {title_of(track)}", "", "| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |", "| ---: | --- | --- | --- | --- |"]
        for perk in sorted(group, key=lambda p: (int(p.get("level") or 0), p["perk_name"])):
            code, why = VERDICTS[perk["perk_name"]]
            name = words.get(perk.get("perk_ui_name", ""), perk["perk_name"])
            desc = clean(words.get(perk.get("perk_ui_desc", ""), ""))
            if len(desc) > 330:
                desc = desc[:327].rsplit(" ", 1)[0] + "..."
            cells = [perk.get("level", "?"), f"**{name}**", desc.replace("|", "/"), LABELS[code], why.replace("|", "/")]
            lines.append("| " + " | ".join(cells) + " |")
        lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\r\n")
    print(f"{sum(total.values())} passivas -> {OUT}: {dict(total)}")


if __name__ == "__main__":
    main()
