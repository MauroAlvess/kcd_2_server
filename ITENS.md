# Itens do servidor: armaduras, armas, roupas, acessórios e brasões

Todas as peças de equipamento do jogo, tiradas das tabelas do próprio jogo (`Tables.pak`) e com os nomes em português do jogo, separadas por **categoria** e, dentro de cada uma, por **qualidade**. Gerado por `resources/kcdc-gamemode/tools/make-items-doc.py`; rode de novo se o jogo atualizar.

## Índice

1. [Armaduras](#1-armaduras): 738 códigos, de capacetes a perneiras
2. [Roupas](#2-roupas): 1538 códigos, de chapéus e vestidos a botas
3. [Armas](#3-armas): 176 armas e 112 escudos
4. [Acessórios](#4-acessórios): 55 códigos, de anéis e óculos à montaria
5. [Brasões](#5-brasões-cidades-famílias-guildas-e-ordens): 127 códigos com o brasão de cidades, famílias, guildas e ordens

## Como usar

- **Para dar um item** (admin): `/give <código> [quantidade] [qualidade 1-4]`, com o código da coluna *Código* entre aspas se tiver espaço (os códigos aqui não têm). Exemplo: `/give Cap03_m03_E 1 4`. Cada peça tem **variantes** (cores, desgaste) com um código cada; a linha lista todas.
- **Q máx.** é a maior qualidade (de 1 a 4) em que a peça existe; peças únicas e joias costumam ter só 1.
- **Preço** é o que o jogo mostra, em grosches (o número da tabela dividido por 10). Faixa `a–b` quando as variantes diferem.
- **Defesa** de armaduras: corte / perfuração / esmagamento. **Carisma**, nas roupas e acessórios, é o que o jogo chama de *Charisma*. **Ataque**, **Defesa** e **Força** das armas são os da tabela do jogo.
- O que não entra: peças quebradas, pedaços de arma, equipamento de treino, adereços de cena e itens de teste. Os escudos e as peças que levam brasão ou insígnia estão **só na seção Brasões**, não repetidos nas outras; as selas, caparazões e ferraduras ficam em Acessórios, em *Montaria*.

## Como a qualidade foi separada

O jogo não dá um nome de qualidade às peças, então aqui vale o **preço base do jogo**, comparando cada peça com as do **mesmo tipo** (armadura com armadura, arma com arma). As faixas abaixo são os cortes de 20%, 50%, 80% e 95% do preço das peças de cada tipo; uma peça das tabelas de **itens únicos**, de **missão** ou de **recompensa** é *única*, custe o que custar.

| Tipo | Básica | Comum | Boa | Excelente | Nobre | Única |
|---|---|---|---|---|---|---|
| Armaduras | até 250 g | até 1.100 g | até 4.200 g | até 8.200 g | acima | tabela de únicos |
| Roupas | até 41 g | até 83 g | até 190 g | até 470 g | acima | tabela de únicos |
| Armas | até 340 g | até 1.100 g | até 2.500 g | até 3.200 g | acima | tabela de únicos |
| Escudos | até 44 g | até 140 g | até 160 g | até 220 g | acima | tabela de únicos |
| Acessórios | até 45 g | até 200 g | até 660 g | – | acima | tabela de únicos |

(Para os de gênero masculino, acessório e escudo, os nomes são básico, comum, bom, excelente, nobre e único.)

## 1. Armaduras

### Armadura básica (até 250 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|---|
| Almofre | Almofres | `CoifCap01_m01_C`, `CoifCap01_m02_C`, `CoifCap01_m03_C`, `CoifCap01_m04_C`, `CoifCap01_m05_C`, `CoifCap01_m06_C`, `CoifCap01_m07_C`, `CoifCap01_m08_C` | 16,5–72,8 | 4 | 0,2 | 0 / 0 / 2 |
| Almofre acolchoado rústico | Almofres | `CoifSmall02_m01_E1`, `CoifSmall02_m02_E1`, `CoifSmall02_m03_E1`, `CoifSmall02_m04_E1`, `CoifSmall02_m06_E1`, `CoifSmall02_m07_E1`, `CoifSmall02_m08_E1` | 33,1–35,2 | 4 | 1,7 | 31 / 20 / 33 |
| Almofre acolchoado de torneio | Almofres | `CoifLarge01_mkhTournament_07_D2_Henry` | 49,6 | 4 | 4,3 | 40 / 28 / 37 |
| Grande almofre de batalha | Almofres | `CoifLarge01_m01_D2`, `CoifLarge01_m03_D2`, `CoifLarge01_m04_D2`, `CoifLarge01_m05_D2`, `CoifLarge01_m06_D2`, `CoifLarge01_m07_D2`, `CoifLarge01_m08_D2`, `CoifLarge01_mkhTournament_01_D2`, `CoifLarge01_mkhTournament_02_D2`, `CoifLarge01_mkhTournament_03_D2`, `CoifLarge01_mkhTournament_04_D2`, `CoifLarge01_mkhTournament_05_D2`, `CoifLarge01_mkhTournament_06_D2`, `CoifLarge01_mkhTournament_07_D2` | 49,6–104 | 4 | 4,3 | 40 / 28 / 37 |
| Gorro acolchoado de andarilho | Almofres | `CoifSmall02_m05_E1` | 51,3 | 4 | 1,6 | 31 / 20 / 33 |
| Coifa acolchoada | Almofres | `CoifSmall01_m01_C2`, `CoifSmall01_m02_C2`, `CoifSmall01_m03_C2`, `CoifSmall01_m05_C2`, `CoifSmall01_m06_C2`, `CoifSmall01_m07_C2`, `CoifSmall01_m08_C2`, `CoifSmall03_m01_B3`, `CoifSmall03_m05_B3`, `CoifSmall03_m06_B3`, `CoifSmall03_m07_B3` | 108–248 | 4 | 1,8–1,9 | 35–45 / 24–32 / 35–38 |
| Grande almofre de batalha: preto | Almofres | `CoifLarge01_m02_D2` | 136 | 4 | 3,9 | 40 / 28 / 37 |
| Almofre: preto | Almofres | `CoifSmall01_m04_C2` | 179 | 4 | 1,6 | 35 / 24 / 35 |
| Capuz acolchoado | Almofres | `CoifLarge02_m01_C3`, `CoifLarge02_m02_C3`, `CoifLarge02_m05_C3`, `CoifLarge02_m07_C3`, `CoifLarge02_m08_C3` | 244 | 4 | 4,5 | 50 / 37 / 40 |
| Gola acolchoada | Golas | `CollarPadded01_m01_C1`, `CollarPadded01_m02_C1`, `CollarPadded01_m03_C1`, `CollarPadded01_m04_C1`, `CollarPadded01_m05_C1`, `CollarPadded01_m06_C1`, `CollarPadded01_m07_C1`, `CollarPadded01_m08_C1`, `CollarPadded01_mHanushBattleNoHelmet_C1` | 72,8 | 4 | 2,4 | 37 / 25 / 34 |
| Gola de armadura | Golas | `CollarChain01_m01_C1`, `CollarChain01_m02_C1`, `CollarChain01_m03_C1`, `CollarChain01_m04_C1`, `CollarChain01_m05_C1`, `CollarChain01_m06_C1`, `CollarChain01_m07_C1`, `CollarChain01_m08_C1` | 207 | 4 | 3,2 | 41 / 20 / 43 |
| Jaquetão longo | Tronco | `GambesonLong01_mHenryStartStage1_noBags` | 54 | 4 | 0,5 | 24 / 8 / 21 |
| Jaquetão desgastado | Tronco | `GambesonShort02_m02_E1`, `GambesonShort02_m03_E1`, `GambesonShort02_m04_E1`, `GambesonShort02_m05_E1`, `GambesonShort02_m06_E1`, `GambesonShort02_m07_E1`, `GambesonShort02_m08_E1`, `GambesonShort02_m09_E1`, `GambesonShort02_m10_E1`, `GambesonShort02_m11_E1` | 99,3–102 | 4 | 9,4 | 32 / 12 / 34 |
| Jaquetão usado | Tronco | `GambesonShort02_m01_E1` | 99,3 | 4 | 9,4 | 32 / 12 / 34 |
| Jaquetão do andarilho | Tronco | `GambesonShort02_m12_E1` | 114 | 4 | 8,1 | 31 / 12 / 33 |
| Jaquetão de torneio | Tronco | `GambesonLong01_m01_C3_KHtournament_Henry` | 179 | 4 | 12,5 | 38 / 13 / 35 |
| Cotoveleiras em forma de folha | Braços e mãos | `LegsPlate07_m01_E1`, `LegsPlate07_m02_E1`, `LegsPlate07_m03_E1` | 33,1–33,2 | 4 | 0,9 | 23 / 17 / 9 |
| Cotoveleiras | Braços e mãos | `ArmPlate03_m01_D1`, `ArmPlate03_m02_D1`, `ArmPlate03_m03_D1`, `ArmPlate03_m04_D1` | 46 | 4 | 1 | 27 / 20 / 12 |
| Cotoveleiras com rondelas | Braços e mãos | `ArmPlate01_m01_C2`, `ArmPlate01_m02_C2`, `ArmPlate01_m03_C2`, `ArmPlate01_m04_C2` | 74,1–74,5 | 4 | 1 | 37 / 28 / 18 |
| Luvas de carniceiro | Braços e mãos | `rasuvUcen_knackersGloves` | 76,9 | 4 | 0,9 | 7 / 3 / 9 |
| Luvas de couro | Braços e mãos | `Gloves01_m02_C1`, `Gloves01_m03_C1`, `Gloves01_m04_C1`, `Gloves01_m05_C1`, `Gloves01_m06_C1`, `Gloves01_m07_C1`, `Gloves01_m08_C1` | 106–143 | 4 | 0,9–1 | 7 / 3 / 9 |
| Luvas do punguista | Braços e mãos | `Gloves01_m01_C1` | 106 | 4 | 1 | 7 / 3 / 9 |
| Luvas | Braços e mãos | `Gloves02_m01_D3`, `Gloves02_m02_D3`, `Gloves02_m03_D3`, `Gloves02_m04_D3`, `Gloves02_m05_D3`, `Gloves02_m06_D3`, `Gloves02_m07_D3`, `Gloves02_m08_D3` | 135–160 | 4 | 1 | 23 / 9 / 23 |
| Luvas de equitação | Braços e mãos | `Gloves05_m01_B2`, `Gloves05_m02_B2`, `Gloves05_m03_B2`, `Gloves05_m05_B2`, `Gloves05_m07_B2` | 181–214 | 4 | 1 | 15 / 6 / 16 |
| Luvas de ferreiro do Henry | Braços e mãos | `Gloves05_mPros` | 181 | 4 | 1 | 15 / 6 / 16 |
| Luvas de nobre | Braços e mãos | `Gloves06_mRings02_A`, `Gloves06_mRings_A` | 214 | 4 | 0,9 | 0 / 1 / 2 |
| Joelheiras | Pernas | `LegsPlate06_m01_D1`, `LegsPlate06_m02_D1`, `LegsPlate06_m03_D1` | 48,1–48,3 | 4 | 1 | 27 / 20 / 12 |
| Calças acolchoadas do andarilho | Pernas | `LegsPadded02_m08_E1` | 99,3 | 4 | 4,6 | 31 / 20 / 33 |
| Calças acolchoadas velhas | Pernas | `LegsPadded02_m01_E1`, `LegsPadded02_m02_E1`, `LegsPadded02_m03_E1`, `LegsPadded02_m04_E1`, `LegsPadded02_m05_E1`, `LegsPadded02_m06_E1`, `LegsPadded02_m07_E1`, `LegsPadded02_m09_E1`, `LegsPadded02_m10_E1`, `LegsPadded02_m11_E1`, `LegsPadded02_m12_E1`, `LegsPadded02_m13_E1`, `LegsPadded02_m14_E1` | 120–123 | 4 | 5,3 | 35 / 24 / 34 |
| Botas de equitação – Altas | Pernas | `LegsPadded05_m01_B1`, `LegsPadded05_m02_B1`, `LegsPadded05_m03_B1`, `LegsPadded05_m04_B1`, `LegsPadded05_m05_B1` | 163–174 | 4 | 5,3 | 35 / 24 / 34 |
| Calças acolchoadas do nobre | Pernas | `LegsPadded03_m03_B2`, `LegsPadded03_m05_B2`, `LegsPadded03_m07_B2`, `LegsPadded03_m08_B2` | 250 | 4 | 5,5 | 43 / 30 / 37 |
| Calças nobres acolchoadas | Pernas | `LegsPadded03_m01_B2` | 250 | 4 | 5,5 | 43 / 30 / 37 |

### Armadura comum (250 a 1.100 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|---|
| Capacete encardido | Capacetes | `SkullCap01_m01_D1`, `SkullCap01_m02_D1`, `SkullCap01_m03_D1` | 298 | 4 | 4,5 | 80 / 109 / 27 |
| Capacete escamado | Capacetes | `SkullCap03_m01_D2`, `SkullCap03_m02_D2`, `SkullCap03_m03_D2` | 596 | 4 | 4,8 | 84 / 116 / 29 |
| Capacete de chaleira de torneio | Capacetes | `KettleHat03_m01_B2_khTournament_Henry` | 640 | 4 | 6,5 | 94 / 125 / 33 |
| Capacete de chaleira | Capacetes | `KettleHat01_m01_E1`, `KettleHat01_m03_E1` | 662–664 | 4 | 6,2 | 89 / 120 / 31 |
| Capacete de aço | Capacetes | `SkullCap02_m01_C2`, `SkullCap02_m02_C2`, `SkullCap02_m03_C2` | 736 | 4 | 4,9 | 85 / 118 / 30 |
| Capacete de chaleira: escuro | Capacetes | `KettleHat01_m02_E1` | 872 | 4 | 5,4 | 86 / 115 / 30 |
| Bacinete cumano | Capacetes | `BascinetOpen09_m01_B1`, `BascinetOpen09_m02_B1`, `BascinetOpen09_m03_B1` | 910 | 4 | 5 | 91 / 115 / 34 |
| Bacinete de Nuremberg | Capacetes | `BascinetVisor03_m03_NoVisor` | 945 | 3 | 1 | 21 / 58 / 0 |
| Capuz acolchoado | Almofres | `CoifLarge02_m04_C3`, `CoifLarge02_m06_C3`, `CoifLarge02_mBergov_C3`, `CoifLarge02_mKuttenberg_C3`, `CoifLarge02_mLeipa_C3`, `CoifLarge02_mNebak_C3`, `CoifLarge02_mPisek_C3`, `CoifLarge02_mPrague_C3`, `CoifLarge02_mVavak_C3` | 250–256 | 4 | 4,5 | 50 / 37 / 40 |
| Coifa acolchoada | Almofres | `CoifSmall03_m02_B3`, `CoifSmall03_m03_B3`, `CoifSmall03_m04_B3` | 258 | 4 | 1,9 | 45 / 32 / 38 |
| Capuz acolchoado: preto | Almofres | `CoifLarge02_m03_C3` | 273 | 4 | 4,1 | 50 / 37 / 40 |
| Almofre acolchoado: preto | Almofres | `CoifSmall03_m08_B3` | 291 | 4 | 1,8 | 45 / 32 / 38 |
| Almofre de malha | Almofres | `CoifMail01_m01_C2`, `CoifMail01_m02_C2`, `CoifMail01_m03_C2`, `CoifMail01_m04_C2`, `CoifMailSuk_m01` | 297–497 | 4 | 6,7–7,7 | 70–89 / 28–33 / 59–69 |
| Jaquetão curto | Tronco | `GambesonShort01_m01_D2`, `GambesonShort01_m02_D2`, `GambesonShort01_m03_D2`, `GambesonShort01_m04_D2`, `GambesonShort01_m05_D2`, `GambesonShort01_m06_D2`, `GambesonShort01_m07_D2`, `GambesonShort01_m08_D2`, `GambesonShort01_m09_D2`, `GambesonShort01_m10_D2`, `GambesonShort01_m11_B2`, `GambesonShort01_m12_B2` | 281–319 | 4 | 10,8 | 38 / 13 / 36 |
| Jaquetão longo | Tronco | `GambesonLong01_fnc_mAulitz`, `GambesonLong01_m01_C3`, `GambesonLong01_m02_C3`, `GambesonLong01_m03_C3`, `GambesonLong01_m04_C3`, `GambesonLong01_m05_C3`, `GambesonLong01_m06_C3`, `GambesonLong01_m07_C3`, `GambesonLong01_m08_C3`, `GambesonLong01_m09_C3`, `GambesonLong01_m11_C3`, `GambesonLong01_m12_C3`, `GambesonLong01_m13_C3`, `GambesonLong01_m15_C3`, `GambesonLong01_m16_B3`, `GambesonLong01_m17_B3`, `GambesonLong01_m18_B3`, `GambesonLong01_m19_B3`, `GambesonLong01_m20_B3` | 343–560 | 4 | 12,5–13,9 | 38–43 / 13–14 / 35–37 |
| Jaquetão longo: preto | Tronco | `GambesonLong01_m10_C3` | 393 | 4 | 10,6 | 35 / 13 / 34 |
| Aketon curto | Tronco | `GambesonShort04_m01_C3`, `GambesonShort04_m02_C3`, `GambesonShort04_m03_C3`, `GambesonShort04_m04_C3`, `GambesonShort04_m06_C3`, `GambesonShort04_m07_C3`, `GambesonShort04_m08_C3`, `GambesonShort04_m09_C3`, `GambesonShort04_m10_C3`, `GambesonShort04_m11_C3`, `GambesonShort04_m12_C3`, `GambesonShortKomar_mNoBags` | 393–418 | 4 | 12,1 | 44 / 14 / 38 |
| Cota de malha italiana | Tronco | `MailShort02_m01_C1`, `MailShort02_m02_C1`, `MailShort02_m03_C1` | 414 | 4 | 15 | 41 / 20 / 43 |
| Aketon do barão ladrão | Tronco | `GambesonShort04_m05_C3` | 529 | 4 | 10 | 40 / 14 / 36 |
| Cota de malha saxônica | Tronco | `MailLong02_m01_C2`, `MailLong02_m02_C2`, `MailLong02_m03_C2` | 579 | 4 | 19 | 50 / 25 / 48 |
| Gibão longo | Tronco | `GambesonLong03_m01_B4`, `GambesonLong03_m02_B4`, `GambesonLong03_m03_B4`, `GambesonLong03_m04_B4`, `GambesonLong03_m05_B4`, `GambesonLong03_m06_B4`, `GambesonLong03_m08_B4`, `GambesonLong03_m09_B4`, `GambesonLong03_m10_B4`, `GambesonLong03_m11_B4`, `GambesonLong03_m12_B4`, `GambesonLong03_m13_B4`, `GambesonLong03_m14_B4` | 597–624 | 4 | 14,6 | 45 / 15 / 38 |
| Brigandina de salteador | Tronco | `Brigandine02_m01_E2`, `Brigandine02_m02_E2`, `Brigandine02_m03_E2`, `Brigandine02_m05_E2` | 662 | 4 | 7 | 54 / 75 / 18 |
| Gibão curto | Tronco | `GambesonShort03_m01_A4`, `GambesonShort03_m02_A4`, `GambesonShort03_m03_A4`, `GambesonShort03_m05_A4`, `GambesonShort03_m06_A4`, `GambesonShort03_m07_A4`, `GambesonShort03_m08_A4`, `GambesonShort03_m09_A4`, `GambesonShort03_m10_A4` | 714–743 | 4 | 14 | 53 / 16 / 41 |
| Brigandina do bandido: escura | Tronco | `Brigandine02_m04_E2` | 715 | 4 | 5,9 | 52 / 72 / 17 |
| Gibão comprido: preto | Tronco | `GambesonLong03_m07_B4` | 773 | 4 | 12,5 | 43 / 14 / 37 |
| Prato enferrujado: escuro | Tronco | `Cuirass06_m06_E1` | 776 | 4 | 6,3 | 54 / 75 / 18 |
| Placa enferrujada | Tronco | `Cuirass06_m01_E1`, `Cuirass06_m02_E1`, `Cuirass06_m03_E1`, `Cuirass06_m04_E1`, `Cuirass06_m05_E1`, `Cuirass06_m07_E1`, `Cuirass06_m08_E1` | 785 | 4 | 7,4 | 56 / 77 / 19 |
| Gibão curto: preto | Tronco | `GambesonShort03_m04_A4` | 820 | 4 | 12,1 | 50 / 15 / 40 |
| Jaquetão de nobre | Tronco | `GambesonLong04_m01_A5`, `GambesonLong04_m02_A5`, `GambesonLong04_m03_A5`, `GambesonLong04_m04_A5`, `GambesonLong04_m05_A5`, `GambesonLong04_m06_A5`, `GambesonLong04_m07_A5`, `GambesonLong04_m08_A5`, `GambesonLong04_m09_A5`, `GambesonLong04_m10_A5`, `GambesonLong04_m11_A5`, `GambesonLong04_m12_A5`, `GambesonLong04_m13_A5`, `GambesonLong04_m14_A5` | 881–910 | 4 | 16 | 50 / 16 / 40 |
| Luvas de ladrão | Braços e mãos | `Gloves05_m04_B2` | 379 | 4 | 0,9 | 15 / 6 / 16 |
| Luvas de equitação | Braços e mãos | `Gloves05_m06_B2`, `Gloves05_m08_B2` | 392 | 4 | 1 | 15 / 6 / 16 |
| Luvas de nobre | Braços e mãos | `Gloves06_m01_A2`, `Gloves06_m02_A2`, `Gloves06_m03_A2`, `Gloves06_m04_A2`, `Gloves06_m05_A2`, `Gloves06_m06_A2`, `Gloves06_m07_A2`, `Gloves06_m08_A2`, `Gloves06_mMurderer` | 436–563 | 4 | 1 | 15 / 6 / 16 |
| Manoplas de cota de malha | Braços e mãos | `Gauntlets03_m01_D1`, `Gauntlets03_m02_D1`, `Gauntlets03_m03_D1` | 662–667 | 4 | 2,5 | 86 / 121 / 33 |
| Manoplas de torneio | Braços e mãos | `Gauntlets02_m01_B4_khTournament_Henry` | 1.068 | 4 | 3 | 100 / 138 / 37 |
| Calças acolchoadas do nobre | Pernas | `LegsPadded03_m02_B2`, `LegsPadded03_m04_B2`, `LegsPadded03_m06_B2`, `LegsPadded03_m09_B2`, `LegsPadded03_m10_B2` | 261–310 | 4 | 4,9–5,5 | 39–43 / 27–30 / 36–37 |
| Calça acolchoada | Pernas | `LegsPadded01_m01_C3`, `LegsPadded01_m05_C3`, `LegsPadded01_m06_C3`, `LegsPadded01_m07_C3`, `LegsPadded01_m09_C3`, `LegsPadded01_m10_C3`, `LegsPadded01_m11_C3` | 355–364 | 4 | 5,7 | 50 / 37 / 40 |
| Chausses acolchoadas | Pernas | `LegsPadded01_m02_C3`, `LegsPadded01_m03_C3`, `LegsPadded01_m04_C3` | 355–364 | 4 | 5,7 | 50 / 37 / 40 |
| Calça acolchoada: escura | Pernas | `LegsPadded01_m08_C3` | 363 | 4 | 5,1 | 46 / 33 / 39 |

### Armadura boa (1.100 a 4.200 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|---|
| Capacete de chaleira composto | Capacetes | `KettleHat02_m01_D2`, `KettleHat02_m02_D2`, `KettleHat02_m03_D2`, `KettleHat02_m04_D2` | 1.100 | 4 | 6,5 | 94 / 125 / 33 |
| Capacete do assassino | Capacetes | `KettleHat09_m01_D2` | 1.100 | 4 | 6,5 | 94 / 125 / 33 |
| Bacinete com camal | Capacetes | `BascinetOpen08_m01_B3`, `BascinetOpen08_m02_B3`, `BascinetOpen08_m03_B3`, `BascinetOpen08_mDevil` | 1.113–2.059 | 4 | 2,7–5,3 | 100–105 / 134–144 / 38 |
| Elmo pintado do assassino | Capacetes | `KettleHat09_mPainted_D2` | 1.168 | 4 | 6,5 | 94 / 125 / 33 |
| Bacinete de Constantinopla | Capacetes | `BascinetOpen10_m01_D2`, `BascinetOpen10_m03_D2` | 1.287 | 4 | 5,2 | 96 / 125 / 36 |
| Bacinete em forma de sino | Capacetes | `BascinetOpen02_m01_C1`, `BascinetOpen02_m02_C1`, `BascinetOpen02_m03_C1` | 1.299 | 4 | 5,2 | 95 / 124 / 36 |
| Capacete de chaleira saxão | Capacetes | `KettleHat07_m01_A5`, `KettleHat07_m02_A5`, `KettleHat07_m03_A5`, `KettleHat07_m04_A5`, `KettleHat07_m05_A5`, `KettleHat07_m06_A5`, `KettleHat07_m07_A5`, `KettleHat08_m01_E3`, `KettleHat08_m02_E3`, `KettleHat08_m03_E3` | 1.447–2.761 | 4 | 6,7–7 | 98–104 / 131–138 / 34–37 |
| Capacete de Rondel | Capacetes | `SkullCap04_m01_C3`, `SkullCap04_m02_C3`, `SkullCap04_m03_C3` | 1.457 | 4 | 5,5 | 92 / 132 / 34 |
| Elmo de Kiev | Capacetes | `BascinetOpen07_m01_C2`, `BascinetOpen07_m02_C2`, `BascinetOpen07_m03_C2` | 1.600 | 4 | 5,3 | 98 / 129 / 37 |
| Bacinete aberto | Capacetes | `BascinetAlberich_m01`, `BascinetOpen01_m01_C2`, `BascinetOpen01_m02_C2`, `BascinetOpen01_m03_C2` | 1.644 | 4 | 5,2 | 97–100 / 128–131 / 36 |
| Capacete de chaleira em forma de sino | Capacetes | `KettleHat05_m01_D3`, `KettleHat05_m03_D3` | 1.764 | 4 | 6,9 | 101 / 135 / 35 |
| Capacete de chaleira: escuro | Capacetes | `KettleHat05_m02_D3` | 1.796 | 4 | 6,1 | 99 / 132 / 35 |
| Capacete de chaleira com saliência | Capacetes | `KettleHat03_m01_B3`, `KettleHat03_m02_B3`, `KettleHat03_m03_B3` | 1.871 | 4 | 6,8 | 99 / 133 / 35 |
| Elmo cumano com crista | Capacetes | `BascinetOpen06_m01_B3`, `BascinetOpen06_m02_B3`, `BascinetOpen06_m03_B3`, `BascinetOpen06_m04_B3`, `BascinetOpen06_m05_B3`, `BascinetOpen06_m06_B3`, `BascinetOpen06_m07_B3`, `BascinetOpen06_m08_B3` | 1.985–2.062 | 4 | 5,3 | 99 / 133 / 37 |
| Bacinete italiano | Capacetes | `BascinetVisor05_mDevil` | 2.076 | 4 | 5,5 | 109 / 150 / 38 |
| Bacinete do nobre | Capacetes | `BascinetVisor04_m02_A5_noVisor` | 2.277 | 3 | 2 | 23 / 66 / 0 |
| Capacete de chaleira alto | Capacetes | `KettleHat06_m01_A4`, `KettleHat06_m02_A4`, `KettleHat06_m03_A4`, `KettleHat06_m04_A4`, `KettleHat06_m05_A4`, `KettleHat06_m06_A4`, `KettleHat06_m07_A4`, `KettleHat06_m08_A4` | 2.397–2.446 | 4 | 6,9 | 101 / 135 / 36 |
| Capacete de chaleira com bico | Capacetes | `KettleHat04_m01_B4`, `KettleHat04_m02_B4`, `KettleHat04_m03_B4`, `KettleHat04_m04_B4` | 2.477 | 4 | 7 | 103 / 138 / 36 |
| Capacete de chaleira bicudo: escuro | Capacetes | `KettleHat04_m05_B4` | 2.647 | 4 | 6,2 | 101 / 135 / 35 |
| Bacinete de cavaleiro | Capacetes | `BascinetVisor02_m01_D3`, `BascinetVisor02_m02_D3`, `BascinetVisor02_m03_D3` | 3.473 | 4 | 11,4 | 104 / 142 / 37 |
| Bacinete saxão | Capacetes | `BascinetVisor01_m01_C3`, `BascinetVisor01_m02_C3`, `BascinetVisor01_m03_C3`, `BascinetVisor01_m04_C3`, `BascinetVisor01_m05_C3` | 3.486 | 4 | 11,7 | 104 / 143 / 37 |
| Bacinete com bretache | Capacetes | `BascinetOpen03_m01_C4`, `BascinetOpen03_m02_C4`, `BascinetOpen03_m03_C4` | 3.696 | 4 | 5,5 | 106 / 147 / 40 |
| Couraça remendada | Tronco | `Cuirass04_m01_E2`, `Cuirass04_m02_E2`, `Cuirass04_m03_E2`, `Cuirass04_m05_E2` | 1.106 | 4 | 9 | 63 / 86 / 24 |
| Couraça remendada: escura | Tronco | `Cuirass04_m04_E2` | 1.159 | 4 | 7,7 | 61 / 83 / 22 |
| Brigandina simples | Tronco | `Brigandine01_m01_D3`, `Brigandine01_m02_D3`, `Brigandine01_m03_D3`, `Brigandine01_m04_D3`, `Brigandine01_m05_D3`, `Brigandine01_m06_D3`, `Brigandine01_m07_D3`, `Brigandine01_m08_D3`, `Brigandine01_m09_D3`, `Brigandine01_m10_D3`, `Brigandine01_m11_D3`, `Brigandine01_m12_D3` | 1.490–1.564 | 4 | 12 | 91 / 127 / 34 |
| Cota de malha curta | Tronco | `MailShort01_m01_C4`, `MailShort01_m02_C4`, `MailShort01_m03_C4`, `MailShort01_m04_C4` | 1.490 | 4 | 22 | 72 / 34 / 61 |
| Cota de malha longa | Tronco | `MailLong01_m01_C5`, `MailLong01_m02_C5`, `MailLong01_m03_C5`, `MailLong01_m04_C5` | 1.821 | 4 | 26 | 79 / 38 / 64 |
| Couraça lisa | Tronco | `Cuirass01_m01_C2`, `Cuirass01_m02_C2`, `Cuirass01_m03_C2`, `Cuirass01_m05_C2`, `Cuirass01_m06_C2`, `Cuirass01_m07_C2`, `Cuirass01_m08_C2` | 2.315 | 4 | 10,4 | 95 / 132 / 35 |
| Couraça lisa: escurecida | Tronco | `Cuirass01_m04_C2` | 2.343 | 4 | 9 | 93 / 129 / 34 |
| Brigandina milanesa | Tronco | `Brigandine05_m03_C3`, `Brigandine05_m04_C3`, `Brigandine05_m05_C3`, `Brigandine05_m06_C3`, `Brigandine05_m07_C3`, `Brigandine05_m08_C3`, `Brigandine05_m09_C3`, `Brigandine05_m10_C3` | 2.552–2.629 | 4 | 12,7 | 95 / 131 / 35 |
| Brigandina milanesa: escura | Tronco | `Brigandine05_m01_C3` | 3.351 | 4 | 10,8 | 91 / 127 / 34 |
| Brigandina teutônica | Tronco | `Brigandine05_mTeuton` | 3.351 | 4 | 10,8 | 91 / 127 / 34 |
| Couraça de equitação | Tronco | `Cuirass05_m01_B3`, `Cuirass05_m02_B3`, `Cuirass05_m03_B3`, `Cuirass05_m04_B3` | 4.188 | 4 | 11,3 | 102 / 140 / 37 |
| Mangas laminares simples | Braços e mãos | `BrigandineArm01_m01_D1`, `BrigandineArm01_m02_D1`, `BrigandineArm01_m03_D1`, `BrigandineArm01_m04_D1`, `BrigandineArm01_m05_D1` | 1.159–1.193 | 4 | 3,5 | 86 / 121 / 33 |
| Manoplas de nobre | Braços e mãos | `Gauntlets04_m01_C2`, `Gauntlets04_m02_C2`, `Gauntlets04_m03_C2`, `Gauntlets04_m04_C2`, `Gauntlets04_m05_C2`, `Gauntlets04_m06_C2`, `Gauntlets04_m07_C2` | 1.458–1.479 | 4 | 2,8 | 93 / 130 / 35 |
| Manoplas de placa para cavaleiros | Braços e mãos | `ArmPlate02_m01_C3`, `ArmPlate02_m02_C3`, `ArmPlate02_m03_C3`, `ArmPlate02_m04_C3`, `ArmPlate02_m05_C3` | 1.656 | 4 | 4 | 100 / 138 / 37 |
| Manoplas de ampulheta | Braços e mãos | `Gauntlets01_m01_C3`, `Gauntlets01_m02_C3`, `Gauntlets01_m03_C3`, `Gauntlets01_mAlberich` | 2.205–2.212 | 4 | 3 | 100 / 138 / 37 |
| Mangas reforçadas e temperadas | Braços e mãos | `BrigandineArm03_m01_C2`, `BrigandineArm03_m02_C2`, `BrigandineArm03_m03_C2`, `BrigandineArm03_m04_C2`, `BrigandineArm03_m05_C2`, `BrigandineArm03_m06_C2`, `BrigandineArm03_m07_C2`, `BrigandineArm03_m08_C2` | 2.508–2.559 | 4 | 4,1 | 93 / 129 / 35 |
| Manoplas milanesas | Braços e mãos | `Gauntlets02_m01_B4`, `Gauntlets02_m02_B4`, `Gauntlets02_m03_B4` | 2.642–3.448 | 4 | 3,2 | 105 / 144 / 38 |
| Braçais de placa de Magdeburgo | Braços e mãos | `ArmPlate05_m01_B4`, `ArmPlate05_m02_B4`, `ArmPlate05_m03_B4`, `ArmPlate05_m04_B4` | 2.756–2.931 | 4 | 4,5 | 104 / 143 / 37 |
| Mangas laminares com rondelas | Braços e mãos | `BrigandineArm02_m01_C3`, `BrigandineArm02_m02_C3`, `BrigandineArm02_m03_C3`, `BrigandineArm02_m04_C3`, `BrigandineArm02_m05_C3`, `BrigandineArm02_m06_C3`, `BrigandineArm02_m07_C3`, `BrigandineArm02_m08_C3` | 2.874–2.924 | 4 | 4,4 | 97 / 134 / 35 |
| Mangas com proteção de Kuttenberg | Braços e mãos | `ArmPlate06_m01_A5` | 2.931 | 4 | 4,2 | 104 / 145 / 37 |
| Manoplas de brigandina | Braços e mãos | `Gauntlets08_m01_B4`, `Gauntlets08_m02_B4`, `Gauntlets08_m03_B4`, `Gauntlets08_m04_B4`, `Gauntlets08_m05_B4`, `Gauntlets08_m06_B4` | 3.696–3.734 | 4 | 3,3 | 107 / 147 / 38 |
| Perneiras de brigandina antigas | Pernas | `LegsBrigandine01_m01_D2`, `LegsBrigandine01_m02_D2`, `LegsBrigandine01_m03_D2`, `LegsBrigandine01_m04_D2`, `LegsBrigandine01_m05_D2`, `LegsBrigandine01_m06_D2`, `LegsBrigandine01_m07_D2`, `LegsBrigandine01_m08_D2` | 1.656–1.688 | 4 | 10 | 93 / 130 / 34 |
| Perneiras de meia placa | Pernas | `LegsPlate04_m01_D1`, `LegsPlate04_m02_D1`, `LegsPlate04_m03_D1`, `LegsPlate04_m04_D1`, `LegsPlate04_m05_D1` | 1.821–1.830 | 4 | 11 | 86 / 121 / 33 |
| Perneiras de placa da Baviera | Pernas | `LegsPlate01_m01_C3`, `LegsPlate01_m02_C3`, `LegsPlate01_m03_C3`, `LegsPlate01_mAlberich` | 3.684–3.698 | 4 | 12,2 | 97 / 134 / 36 |
| Perneiras de brigandina de nobre | Pernas | `LegsBrigandine03_m01_B4`, `LegsBrigandine03_m02_B4`, `LegsBrigandine03_m03_B4`, `LegsBrigandine03_m04_B4`, `LegsBrigandine03_m05_B4`, `LegsBrigandine03_m06_B4`, `LegsBrigandine03_m07_B4`, `LegsBrigandine03_m08_B4`, `LegsBrigandine03_m09_B4`, `LegsBrigandine03_m10_B4`, `LegsBrigandine03_m11_B4`, `LegsBrigandine03_m12_B4` | 4.067–4.132 | 4 | 11,8 | 104 / 143 / 37 |

### Armadura excelente (4.200 a 8.200 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|---|
| Bacinete italiano | Capacetes | `BascinetVisor05_m01_C4`, `BascinetVisor05_m02_C4`, `BascinetVisor05_m03_C4`, `BascinetVisor05_m04_C4`, `BascinetVisor05_m05_C4`, `BascinetVisor05_m06_C4` | 4.998 | 4 | 13,5 | 109 / 150 / 38 |
| Bacinete de Nuremberg | Capacetes | `BascinetVisor03_m01_A4`, `BascinetVisor03_m02_A4`, `BascinetVisor03_m03_A4`, `BascinetVisor03_m04_A4` | 5.314 | 4 | 13,5 | 109 / 150 / 38 |
| Elmo cumano com máscara | Capacetes | `BascinetVisor06_m01_B4` | 6.354 | 4 | 13,8 | 111 / 151 / 39 |
| Capacete de Senhor do Inferno | Capacetes | `BascinetVisorScaring_m01`, `BascinetVisorScaring_m01_closed` | 6.764 | 4 | 13,8 | 111 / 151 / 39 |
| Couraça de equitação: escurecida | Tronco | `Cuirass05_m05_B3` | 4.226 | 4 | 9,9 | 99 / 137 / 36 |
| Kastenbrust | Tronco | `Cuirass08_m01_C4`, `Cuirass08_m02_C4`, `Cuirass08_m03_C4`, `Cuirass08_m04_C4`, `Cuirass08_m05_C4`, `Cuirass08_m06_C4`, `Cuirass08_m07_C4`, `Cuirass08_m08_C4` | 5.120 | 4 | 11,9 | 106 / 146 / 38 |
| Brigandina saxônica | Tronco | `Brigandine03_m01_A4`, `Brigandine03_m02_A4`, `Brigandine03_m03_A4`, `Brigandine03_m05_A4`, `Brigandine03_m06_A4`, `Brigandine03_m07_A4`, `Brigandine03_m08_A4`, `Brigandine03_m09_A4`, `Brigandine03_m10_A4` | 5.482–7.063 | 4 | 14,7 | 106 / 144 / 37 |
| Couraça em camadas de Kuttenberg | Tronco | `Cuirass10_m01` | 5.680 | 4 | 22,5 | 110 / 150 / 38 |
| Couraça de nobre | Tronco | `Cuirass07_m01_A4`, `Cuirass07_m02_A4`, `Cuirass07_m03_A4`, `Cuirass07_m04_A4`, `Cuirass07_m05_A4`, `Cuirass07_m06_A4`, `Cuirass07_m07_A4`, `Cuirass07_m08_A4` | 5.808 | 4 | 24,3 | 108 / 148 / 38 |
| Couraça ornamentada de Kuttenberg | Tronco | `Cuirass07_mDLC` | 5.850 | 4 | 22 | 112 / 148 / 38 |
| Couraça de Magdeburg | Tronco | `Cuirass02_m01_B4`, `Cuirass02_m02_B4`, `Cuirass02_m03_B4`, `Cuirass02_m04_B4`, `Cuirass02_m05_B4`, `Cuirass02_m06_B4`, `Cuirass02_m07_B4`, `Cuirass02_m08_B4` | 5.894 | 4 | 24,8 | 110 / 150 / 39 |
| Brigandina de placas | Tronco | `Cuirass09_m02_B4`, `Cuirass09_m03_B4`, `Cuirass09_m04_B4`, `Cuirass09_m05_B4`, `Cuirass09_m06_B4`, `Cuirass09_m07_B4` | 7.255–7.296 | 4 | 25,3 | 112 / 152 / 39 |
| Brigandina do barão ladrão | Tronco | `Brigandine03_m04_A4` | 7.353 | 4 | 12,3 | 100 / 138 / 36 |
| Couraça do avarento | Tronco | `Cuirass09_m01_B4` | 7.377 | 4 | 25,3 | 112 / 152 / 39 |
| Couraça com faldas | Tronco | `Brigandine10_m10_A5` | 8.199 | 4 | 16 | 113 / 153 / 39 |
| Mangas laminares de nobre | Braços e mãos | `BrigandineAlberich_m01`, `BrigandineArm06_m01_B5`, `BrigandineArm06_m02_B5`, `BrigandineArm06_m03_B5`, `BrigandineArm06_m04_B5`, `BrigandineArm06_m05_A4`, `BrigandineArm06_m06_B5`, `BrigandineArm06_m07_B5`, `BrigandineArm06_m08_B5` | 5.248–7.007 | 4 | 5,5–14,7 | 106–111 / 144–151 / 37–39 |
| Braço de brigandina | Braços e mãos | `BrigandineArm05_m01_B4`, `BrigandineArm05_m02_B4`, `BrigandineArm05_m03_B4`, `BrigandineArm05_m04_B4`, `BrigandineArm05_m05_B4`, `BrigandineArm05_m06_B4`, `BrigandineArm05_m07_B4`, `BrigandineArm05_m08_B4`, `BrigandineArm05_m09_B4`, `BrigandineArm05_m10_B4`, `BrigandineArm05_m11_B4` | 5.252–5.330 | 4 | 5,3 | 107 / 147 / 38 |
| Manoplas de Nuremberg | Braços e mãos | `Gauntlets05_m01_A5`, `Gauntlets05_m02_A5`, `Gauntlets05_m03_A5` | 5.458–5.693 | 4 | 3,5 | 114 / 156 / 40 |
| Perneiras de placa saxônicas | Pernas | `LegsPlate05_m01_C3`, `LegsPlate05_m02_C3`, `LegsPlate05_m03_C3`, `LegsPlate05_m04_C3`, `LegsPlate05_m05_C3`, `LegsPlate05_m06_C3`, `LegsPlate05_m07_C3`, `LegsPlate05_m08_C3` | 4.249 | 4 | 12,5 | 100 / 138 / 37 |
| Perneiras milanesas | Pernas | `LegsPlate02_m01_B4`, `LegsPlate02_m02_B4`, `LegsPlate02_m03_B4`, `LegsPlate02_m04_B4` | 6.502–6.522 | 4 | 13,3 | 107 / 147 / 38 |
| Perneiras laminares de cavaleiro | Pernas | `LegsBrigandine04_m01_A5`, `LegsBrigandine04_m02_A5`, `LegsBrigandine04_m03_A5`, `LegsBrigandine04_m04_A5`, `LegsBrigandine04_m05_A5`, `LegsBrigandine04_m06_A5`, `LegsBrigandine04_m07_A5`, `LegsBrigandine04_m08_A5`, `LegsBrigandine04_m09_A5`, `LegsBrigandine04_m10_A5` | 7.447–7.554 | 4 | 13 | 111 / 151 / 39 |
| Perneiras de Kuttenberg | Pernas | `LegsPlate08_m01_A5` | 7.986 | 4 | 12,8 | 114 / 156 / 40 |

### Armadura nobre (acima de 8.200 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|---|
| Bacinete de Kuttenberg | Capacetes | `BascinetVisor07_m01_A5` | 8.755 | 4 | 13,2 | 114 / 155 / 40 |
| Bacinete do nobre | Capacetes | `BascinetVisor04_m01_A5`, `BascinetVisor04_m02_A5`, `BascinetVisor04_m03_A5`, `BascinetVisor04_m04_A5`, `BascinetVisor04_m05_A5` | 8.866 | 4 | 15 | 114 / 156 / 40 |
| Couraça com faldas | Tronco | `Brigandine10_m01_A5`, `Brigandine10_m02_A5`, `Brigandine10_m03_A5`, `Brigandine10_m04_A5`, `Brigandine10_m05_A5`, `Brigandine10_m06_A5`, `Brigandine10_m07_A5`, `Brigandine10_m08_A5`, `Brigandine10_m09_A5` | 8.318–9.634 | 4 | 16 | 113 / 153 / 39 |
| Couraça milanesa | Tronco | `Cuirass03_m01_A5`, `Cuirass03_m02_A5`, `Cuirass03_m03_A5`, `Cuirass03_m04_A5`, `Cuirass03_m05_A5` | 10.007–10.072 | 4 | 26 | 114 / 156 / 40 |
| Mangas com proteção de Nuremberg | Braços e mãos | `ArmPlate04_m01_A5`, `ArmPlate04_m02_A5`, `ArmPlate04_m03_A5`, `ArmPlate04_m04_A5`, `ArmPlate04_m05_A5`, `ArmPlate04_m06_A5`, `ArmPlate04_m07_A5`, `ArmPlate04_m08_A5`, `ArmPlate04_mAlberich` | 8.470–8.758 | 4 | 6 | 114 / 156 / 40 |
| Perneiras de placa de nobre | Pernas | `LegsPlate03_m01_A5`, `LegsPlate03_m03_A5`, `LegsPlate03_m04_A5`, `LegsPlate03_m05_A5` | 8.948 | 4 | 14 | 114 / 156 / 40 |
| Perneiras de placa de nobre: escuras | Pernas | `LegsPlate03_m02_A5` | 8.977 | 4 | 14 | 114 / 156 / 40 |

### Armadura única (itens únicos, de missão e de recompensa)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|---|
| Bacinete de cavaleiro | Capacetes | `BascinetVisor02_mNoVisor_B3`, `tarasMura_invisibleHelmet` | 37–204 | 3 | 5,2–13 | 42 / 118 / 0 |
| Bacinete de Capon | Capacetes | `BascinetVisorCapon_m01`, `BascinetVisorCapon_m01_duel` | 72,4–5.501 | 3–4 | 2–13,8 | 46–111 / 134–151 / 0–39 |
| Bacinete de Nuremberg | Capacetes | `BascinetVisor03_m01_NoVisor`, `BascinetVisor03_mErik`, `BascinetVisor03_mOderin_A3` | 221–5.398 | 3–4 | 5,2–13,5 | 42–109 / 118–150 / 0–38 |
| Bacinete saxão | Capacetes | `BascinetVisorZizkaNoVisor_m01`, `BascinetVisorZizka_m01` | 287–5.501 | 3–4 | 2–13,8 | 50–111 / 150–151 / 0–39 |
| Velho capacete do Rugado | Capacetes | `zbranePanaSemina_sukHelmet` | 715 | 4 | 6,2 | 89 / 120 / 31 |
| Bacinete de Brunswick | Capacetes | `BascinetVisorBrunswig_m01` | 1.656 | 4 | 9 | 97 / 134 / 34 |
| Bacinete com camal | Capacetes | `BascinetOpen08_mKomar` | 2.059 | 4 | 5,3 | 100 / 134 / 38 |
| Bacinete para cavalo de guerra | Capacetes | `BascinetOpen03_mTwitch` | 2.160 | 4 | 5,3 | 101 / 135 / 38 |
| Bacinete do nobre | Capacetes | `BascinetVisor04_mAulitz_A5`, `BascinetVisorRuthard_m01_A5` | 5.501–8.977 | 4 | 13,8–15 | 111–114 / 151–156 / 39–40 |
| Elmo de Jezhek | Capacetes | `ztracenaCest_jezeksHelmet` | 5.501 | 4 | 13,8 | 111 / 151 / 39 |
| Almofre | Almofres | `CoifCap01_mRabi` | 16,5 | 4 | 0,2 | 0 / 0 / 2 |
| Coifa acolchoada | Almofres | `CoifSmall01_mUher_C1` | 114 | 4 | 1,8 | 35 / 24 / 35 |
| Almofre de malha | Almofres | `CoifMailTomas_m01`, `CoifMailZizka_m01` | 116 | 4 | 5 | 41 / 20 / 43 |
| Almofre de cota de malha de Brunswick | Almofres | `CoifMailBrunswig_m01` | 235 | 4 | 6,1 | 60 / 25 / 54 |
| Gola acolchoada | Golas | `CollarPadded01_mDevil_C1` | 33,1 | 4 | 2,4 | 31 / 20 / 33 |
| Gola de armadura | Golas | `CollarChain01_mSamuel` | 507 | 4 | 3,6 | 67 / 27 / 57 |
| Jaquetão do Rugado | Tronco | `zbranePanaSemina_sukGambeson` | 132 | 4 | 11 | 33 / 12 / 33 |
| Aketon curto | Tronco | `GambesonShortIstvan_m01`, `GambesonShortIstvan_mNoScabbard`, `GambesonShortKomar_m01`, `GambesonShortKubyenka_m01`, `GambesonShortKubyenka_mNoDagger`, `GambesonShortLichtenstein_m01`, `GambesonShortSamuel_m01` | 408–568 | 4 | 12,1–13,4 | 44–50 / 14–15 / 38–40 |
| Jaquetão velho | Tronco | `GambesonLongGodwin_m01`, `GambesonLongGodwin_mNoBags`, `GambesonLongGodwin_mNoDagger` | 426–430 | 4 | 13,2 | 40 / 14 / 36 |
| Gibão longo | Tronco | `GambesonLong03_mCapon_NoBags`, `GambesonLong03_mSamuel` | 438–597 | 4 | 13,2–14,6 | 40–45 / 14–15 / 36–38 |
| Jaquetão do Capon | Tronco | `GambesonLongCapon_m01` | 461 | 4 | 13,2 | 40 / 14 / 36 |
| Gibão para cavalo de guerra | Tronco | `GambesonLong03_mTwitch` | 480 | 4 | 13,2 | 40 / 14 / 36 |
| Gibão do ladrão | Tronco | `GambesonLong04_mTwitch` | 500 | 4 | 11,2 | 38 / 13 / 35 |
| Gibão do Erik | Tronco | `GambesonLong03_mErik` | 613 | 4 | 14,6 | 45 / 15 / 38 |
| Jaquetão do afogado | Tronco | `GambesonLong01_mdrowner` | 759 | 4 | 16 | 50 / 16 / 40 |
| Kastenbrust | Tronco | `CuirassCapon_m01`, `CuirassCapon_mRadzig` | 760–4.237 | 4 | 7,4–11,3 | 56–102 / 77–140 / 19–37 |
| Cota de malha longa | Tronco | `MailLong01_m01_mCapon_NoBags` | 1.039 | 4 | 21,4 | 60 / 29 / 54 |
| Brigandina de Brunswick | Tronco | `CuirassBrunswig_m01` | 1.599 | 4 | 12 | 91 / 127 / 34 |
| Brigandina do Jezhek | Tronco | `ztracenaCest_jezeksCuirass` | 3.624 | 4 | 13,4 | 98 / 136 / 36 |
| Couraça do Peter de Suchotlesky | Tronco | `dvojityAgent_petrsCuirass` | 3.968 | 4 | 11,3 | 102 / 140 / 37 |
| Luvas do afogado | Braços e mãos | `Gloves02_mdrowner` | 24,8 | 4 | 1 | 7 / 3 / 9 |
| Luvas do mestre-caçador | Braços e mãos | `Gloves07_m01_B` | 141 | 4 | 1 | 3 / 2 / 5 |
| Luvas de equitação | Braços e mãos | `Gloves05_mHanush`, `Gloves05_mIstvan`, `Gloves05_mRadzig` | 186–1.597 | 4 | 1–2,8 | 7–93 / 3–130 / 9–35 |
| Luvas do ladrão | Braços e mãos | `Gloves05_mTwitch` | 200 | 4 | 0,9 | 7 / 3 / 9 |
| Luvas de nobre | Braços e mãos | `Gloves06_mAbbot_A`, `Gloves06_mChamberlain_A`, `Gloves06_mPisek_A`, `Gloves06_mRuthard_A` | 214 | 4 | 0,9 | 0 / 1 / 2 |
| Luvas do legado | Braços e mãos | `Gloves06_mLegate` | 423 | 4 | 1 | 7 / 3 / 9 |
| Manoplas de Brunswick | Braços e mãos | `GauntletsBrunswig_m01` | 1.505 | 4 | 2,8 | 93 / 130 / 35 |
| Mangas com proteção de Brunswick | Braços e mãos | `ArmPlateBrunswig_m01` | 1.746 | 4 | 4 | 100 / 138 / 37 |
| Manoplas de Nuremberg | Braços e mãos | `Gauntlets05_mAulitz`, `Gauntlets05_mBergov` | 2.265 | 4 | 3 | 100 / 138 / 37 |
| Manoplas de brigandina | Braços e mãos | `Gauntlets08_mErik`, `GauntletsZizka_m01` | 2.265–3.811 | 4 | 3–3,3 | 100–107 / 138–147 / 37–38 |
| Mangas de brigandina para cavalo de guerra | Braços e mãos | `BrigandineArm03_mTwitch` | 2.693 | 4 | 4,3 | 95 / 132 / 35 |
| Manoplas para cavalo de guerra | Braços e mãos | `Gauntlets08_mTwitch` | 3.811 | 4 | 3,3 | 107 / 147 / 38 |
| Braçais de placa de Magdeburgo | Braços e mãos | `ArmPlate05_mAulitz`, `ArmPlateBergov_m01`, `ArmPlateHanush_m01` | 3.966 | 4 | 5 | 107 / 147 / 38 |
| Ombreiras de placa da Jezhek | Braços e mãos | `ztracenaCest_jezeksArms` | 4.075 | 4 | 5 | 104 / 142 / 37 |
| Luvas do Jezhek | Braços e mãos | `ztracenaCest_jezeksGauntlets` | 4.195 | 4 | 3,4 | 111 / 151 / 39 |
| Mangas laminares de nobre | Braços e mãos | `BrigandineArm06_mErik_A3`, `BrigandineAulitz01_m01` | 5.248–5.736 | 4 | 5,5–14,7 | 106–111 / 144–151 / 37–39 |
| Calças acolchoadas remendadas | Pernas | `LegsPaddedGodwin_m01` | 170 | 4 | 5,3 | 35 / 24 / 34 |
| Calças acolchoadas do nobre | Pernas | `LegsPadded03_mSamuel` | 355 | 4 | 5,7 | 50 / 37 / 40 |
| Perneiras de brigandina antigas | Pernas | `LegsBrigandine01_mMarkvartDream` | 1.656 | 4 | 10 | 93 / 130 / 34 |
| Perneiras de brigandina de nobre | Pernas | `LegsBrigandine03_mSamuel` | 3.145 | 4 | 11,2 | 100 / 138 / 36 |
| Proteção para pernas do cavalo de guerra | Pernas | `LegsBrigandine03_mTwitch` | 3.145 | 4 | 11,2 | 100 / 138 / 36 |
| Proteção para pernas de Brunswick | Pernas | `LegsPlateBrunswig_m01` | 3.421 | 4 | 11,8 | 93 / 130 / 35 |
| Perneiras de placa da Baviera | Pernas | `LegsPlate01_mIstvan` | 3.698 | 4 | 12,2 | 97 / 134 / 36 |
| Chausses de placa do Capon | Pernas | `LegsPlateCapon_m01` | 3.800 | 4 | 12,2 | 97 / 134 / 36 |
| Chausses de placa do Jezhek | Pernas | `ztracenaCest_jezeksLegs` | 4.692 | 4 | 12,4 | 107 / 147 / 38 |
| Perneiras laminares de cavaleiro | Pernas | `LegsBrigandine04_mErik`, `LegsBrigandine04_mOderin_A5`, `LegsBrigandine04_mRuthard_A5` | 6.475 | 4 | 13 | 111 / 151 / 39 |

## 2. Roupas

### Roupa básica (até 41 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Chapéu redondo | Cabeça | `Wreath01_m01` | 0 | 4 | 5 | 6 |
| Chapéu de feltro | Cabeça | `Cap20_m01_E`, `Cap20_m02_E`, `Cap20_m03_E`, `Cap20_m04_E`, `Cap20_m05_E`, `Cap20_m06_E`, `Cap20_m07_E`, `Cap20_m08_E`, `Cap20_m09_E`, `Cap20_m10_E`, `Cap27_m01_Apprentice`, `Cap27_m01_D`, `Cap27_m02_Apprentice`, `Cap27_m02_D`, `Cap27_m03_D`, `Cap27_m04_Apprentice`, `Cap27_m04_D`, `Cap27_m05_D`, `Cap27_m06_D`, `Cap27_m07_D` | 1,6–31,1 | 4 | 0,5 | 5–12 |
| Gorro de feltro | Cabeça | `Cap03_m01_E`, `Cap03_m02_E`, `Cap03_m03_E`, `Cap03_m04_E`, `Cap03_m05_E`, `Cap03_m06_E`, `Cap03_m07_E`, `Cap03_m08_E`, `Cap03_mMikes_E` | 1,6–8,9 | 4 | 0,5 | 5–7 |
| Lenço de cabeça | Cabeça | `Cap16_m01_E`, `Cap16_m02_E`, `Cap16_m03_E`, `Cap16_m04_E`, `Cap16_m05_E`, `Cap16_m06_E`, `Cap16_m07_Apprentice`, `Cap16_m07_E`, `Cap16_m08_E` | 1,6–5,9 | 4 | 0,5 | 5–7 |
| Chapéu de palha velho | Cabeça | `Cap32_m01_E`, `Cap32_m02_E` | 3,8 | 4 | 0,5 | 6 |
| Capuz de mendigo | Cabeça | `Hood04_m01_E`, `Hood04_m02_E`, `Hood04_m03_E`, `Hood04_m04_E`, `Hood04_m05_E`, `Hood04_m06_E`, `Hood04_m07_E`, `Hood04_m08_E`, `Hood04_m09_E`, `Hood04_m10_E` | 4,9–16,7 | 4 | 0,7 | 3–4 |
| Guirlanda | Cabeça | `F_HairDecor01_m01_D`, `F_HairDecor01_m02_D`, `F_HairDecor01_m03_D`, `F_HairDecor01_m04_D`, `F_HairDecor01_m05_D`, `F_Wreath01_m01`, `F_Wreath01_m02`, `F_Wreath01_m03`, `F_Wreath01_m04`, `F_Wreath01_m05` | 10–14,9 | 1–4 | 0,1–0,2 | 0–12 |
| Chapéu de palha feminino | Cabeça | `F_Cap03_m03_B` | 11,5 | 4 | 0,5 | 19 |
| Touca | Cabeça | `F_Bonnet01_m01_B` | 11,5 | 4 | 0,2 | 0 |
| Lenço de cabeça colorido | Cabeça | `F_Veil05_m01_D`, `F_Veil05_m02_D`, `F_Veil05_m03_D`, `F_Veil05_m04_D`, `F_Veil05_m05_D`, `F_Veil05_m06_D`, `F_Veil05_m07_D`, `F_Veil05_m08_D`, `F_Veil05_m09_D`, `F_Veil05_m10_D` | 14,9 | 4 | 0,2 | 12 |
| Lenço de cabeça de trabalho | Cabeça | `F_Veil06_m01_D`, `F_Veil06_m02_D`, `F_Veil06_m03_D`, `F_Veil06_m04_D`, `F_Veil06_m05_D`, `F_Veil06_m06_D`, `F_Veil06_m07_D`, `F_Veil06_m08_D` | 14,9 | 4 | 0,2 | 12 |
| Véu com babados | Cabeça | `F_Veil03_m01_D`, `F_Veil03_m02_D` | 14,9 | 4 | 0,2 | 12 |
| Capuz de servo | Cabeça | `Hood11_mPrague01`, `Hood11_mPrague02` | 16,7–30,2 | 4 | 0,8 | 4–5 |
| Chapéu cumano alto | Cabeça | `Cap13_m01_D`, `Cap13_m02_D`, `Cap13_m03_D`, `Cap13_m04_D`, `Cap13_m05_D`, `Cap13_m06_D`, `Cap13_m07_D`, `Cap13_m08_D`, `Cap13_m09_D`, `Cap13_m10_D` | 22,5–31,1 | 4 | 0,5 | 9–12 |
| Chapéu de couro cumano | Cabeça | `Cap06_m01_D`, `Cap06_m02_D`, `Cap06_m03_D`, `Cap06_m04_D`, `Cap06_m05_D`, `Cap06_m06_D`, `Cap06_m07_D`, `Cap06_m08_D`, `Cap06_m09_D`, `Cap06_m10_D` | 22,5–31,1 | 4 | 0,5 | 9–12 |
| Chapéu de vagabundo | Cabeça | `Cap30_m01_D`, `Cap30_m02_D`, `Cap30_m03_D`, `Cap30_m04_D`, `Cap30_m05_D`, `Cap30_m06_D`, `Cap30_m07_D` | 22,5–37,5 | 4 | 0,5 | 9–13 |
| Chapéu de viajante | Cabeça | `Cap12_m01_D`, `Cap12_m02_D`, `Cap12_m03_D`, `Cap12_m04_Blacksmith`, `Cap12_m04_D`, `Cap12_m05_D`, `Cap12_m06_D`, `Cap12_m07_D`, `Cap12_mKozlik_D` | 22,5–40,8 | 4 | 0,5 | 9–14 |
| Chapéu forrado de pele | Cabeça | `Cap26_m01_D`, `Cap26_m02_D`, `Cap26_m03_D`, `Cap26_m04_D`, `Cap26_m05_D` | 22,5 | 4 | 0,5 | 9 |
| Gorro folgado | Cabeça | `Cap05_m01_D`, `Cap05_m02_D`, `Cap05_m03_D`, `Cap05_m04_D`, `Cap05_m05_D`, `Cap05_m06_D`, `Cap05_m07_D`, `Cap05_m08_D`, `Cap05_m09_D`, `Cap05_m10_D` | 22,5–31,1 | 4 | 0,5 | 9–12 |
| Lenço de trabalho | Cabeça | `Cap11_m01_D`, `Cap11_m02_D`, `Cap11_m03_D`, `Cap11_m04_D`, `Cap11_m05_D`, `Cap11_m06_D`, `Cap11_m07_D`, `Cap11_m08_D`, `Cap11_m09_D`, `Cap11_m10_D` | 22,5–31,1 | 4 | 0,5 | 9–12 |
| Faixa simples | Cabeça | `F_HairDecor07_m01_C`, `F_HairDecor07_m02_C`, `F_HairDecor07_m03_C`, `F_HairDecor07_m04_C` | 24,7 | 1 | 0,2 | 8 |
| Capuz feminino | Cabeça | `F_Hood01_m06_C`, `F_Hood01_m08_C`, `F_Hood01_m09_C`, `F_Hood01_m11_C`, `F_Hood02_m01_C`, `F_Hood02_m05_C`, `F_Hood02_m06_C`, `F_Hood02_m08_C` | 24,8 | 4 | 1 | 15 |
| Chapéu de palha com fita | Cabeça | `Cap31_m01_D`, `Cap31_m02_D`, `Cap31_m03_D` | 26,8 | 4 | 0,5 | 10 |
| Chapéu de palha estreito | Cabeça | `Cap15_m01_D`, `Cap15_m02_D` | 26,8 | 4 | 0,5 | 10 |
| Chapéu de palha largo | Cabeça | `Cap04_m01_D`, `Cap04_m02_D` | 26,8 | 4 | 0,5 | 10 |
| Acessório de cabeça decorado | Cabeça | `F_HairDecor06_m05_B` | 39,5 | 1 | 0,2 | 16 |
| Avental de ferreiro do Henry | Tronco e vestidos | `TunicShort05_mPros` | 0 | 1 | 0 | 0 |
| Túnica de mendigo | Tronco e vestidos | `TunicLong05_m01_E`, `TunicLong05_m02_E`, `TunicLong05_m03_E`, `TunicLong05_m04_E`, `TunicLong05_m05_E`, `TunicLong05_m06_E`, `TunicLong05_m07_E`, `TunicLong05_m08_E`, `TunicLong05_m09_E`, `TunicLong05_m10_E`, `TunicLong05_m11_E`, `TunicLong05_m12_E` | 4,1 | 4 | 1 | 2 |
| Túnica velha | Tronco e vestidos | `podMostem_tunic` | 8,2 | 4 | 1 | 5 |
| Túnica curta | Tronco e vestidos | `TunicShort01_m08_D`, `TunicShort01_mHenry` | 12,5–24,3 | 3–4 | 1 | 8–12 |
| Camisa de mendigo | Tronco e vestidos | `TunicShort07_m01_E`, `TunicShort07_m02_E`, `TunicShort07_m03_E`, `TunicShort07_m04_E`, `TunicShort07_m05_E`, `TunicShort07_m06_E` | 16,2–25,3 | 4 | 1 | 5–7 |
| Avental de açougueiro | Tronco e vestidos | `TunicLong03_mButcher01_D`, `TunicLong03_mButcher02_D`, `TunicLong03_mButcher03_D`, `TunicLong03_mButcher_D` | 17 | 4 | 1 | 8 |
| Avental de couro | Tronco e vestidos | `TunicLong03_m01_D`, `TunicLong03_m02_D`, `TunicLong03_m03_D`, `TunicLong03_m04_D`, `TunicLong03_m05_D`, `TunicLong03_m06_D`, `TunicLong03_m07_D`, `TunicLong03_m08_D`, `TunicLong03_m09_D`, `TunicLong03_m10_D`, `TunicShort05_m01_D`, `TunicShort05_m02_D`, `TunicShort05_m04_D`, `TunicShort05_m05_D`, `TunicShort05_m06_D`, `TunicShort05_m07_D`, `TunicShort05_m09_D`, `TunicShort05_m10_D`, `TunicShort05_mHenrysYoungFather` | 17–34,9 | 4 | 1 | 8–12 |
| Túnica desgastada | Tronco e vestidos | `TunicLong04_m01_D`, `TunicLong04_m02_D`, `TunicLong04_m03_D`, `TunicLong04_m05_D`, `TunicLong04_m06_D`, `TunicLong04_m07_D`, `TunicLong04_m08_D`, `TunicLong04_m09_D`, `TunicLong04_m10_D` | 17–24,6 | 4 | 1 | 8–12 |
| Túnica de andarilho | Tronco e vestidos | `TunicLong04_m04_D` | 19,3 | 4 | 0,9 | 8 |
| Túnica | Tronco e vestidos | `TunicLong01_m01_C`, `TunicLong01_m04_C`, `TunicLong01_m07_C`, `TunicLong01_m08_C`, `TunicLong01_m09_C`, `TunicLong01_m12_C` | 30,1 | 4 | 1 | 14 |
| Túnica de estalajadeiro | Tronco e vestidos | `TunicLong02_m02_C`, `TunicLong02_m06_C`, `TunicLong02_m07_C`, `TunicLong02_m09_C` | 30,1 | 4 | 1 | 14 |
| Casacão de mendigo | Tronco e vestidos | `Coat03_m01_E`, `Coat03_m02_E`, `Coat03_m04_E`, `Coat03_m05_E` | 33,1 | 4 | 2,9 | 4 |
| Vestido de trabalho | Tronco e vestidos | `F_SimpleDress01_m01_D`, `F_SimpleDress01_m11_D`, `F_SimpleDress01_m12_D`, `F_SimpleDress01_m13_D`, `F_SimpleDress06_m02_D`, `F_SimpleDress06_m07_D`, `F_SimpleDress06_m14_D`, `F_SimpleDress06_m19_D`, `F_SimpleDress06_mMother_D` | 33,1 | 4 | 2,5 | 10 |
| Sobretudo | Tronco e vestidos | `F_Surcote01_m01_C`, `F_Surcote01_m09_C` | 34,7 | 4 | 3 | 16 |
| Avental curto de açougueiro | Tronco e vestidos | `TunicShort05_mButcher01_D`, `TunicShort05_mButcher02_D`, `TunicShort05_mButcher03_D`, `TunicShort05_mButcher_D` | 34,9 | 4 | 1 | 8 |
| Camisa de estalajadeiro | Tronco e vestidos | `TunicShort06_m02_D`, `TunicShort06_m06_D`, `TunicShort06_m07_D`, `TunicShort06_m07_NoSpoon_D`, `TunicShort06_m08_D`, `TunicShort06_m09_D`, `TunicShort06_m10_D` | 34,9 | 4 | 1 | 8–10 |
| Túnica de minerador | Tronco e vestidos | `TunicShort03_m01_D`, `TunicShort03_m02_D`, `TunicShort03_m05_D`, `TunicShort03_m07_D`, `TunicShort03_m09_D`, `TunicShort03_m10_D` | 34,9 | 4 | 1 | 8 |
| Túnica do punguista | Tronco e vestidos | `TunicLong01_m05_C` | 38,2 | 4 | 0,9 | 14 |
| Calças largas | Calças | `HoseLoose01_m02_C`, `HoseLoose01_m04_C`, `HoseLoose01_m05_C`, `HoseLoose01_m06_C`, `HoseLoose01_m10_C` | 16,5 | 4 | 0,5 | 10 |
| Calças de mendigo | Calças | `HoseSeparate04_m01_E`, `HoseSeparate04_m02_E`, `HoseSeparate04_m04_E`, `HoseSeparate04_m05_E`, `HoseSeparate04_m06_E`, `HoseSeparate04_m07_E`, `HoseSeparate04_m08_E`, `HoseSeparate04_m09_E`, `HoseSeparate04_m10_E`, `HoseSeparate04_m11_E`, `HoseSeparate04_m12_E`, `HoseSeparate04_m13_E`, `HoseSeparate04_m14_E` | 33,1–40,7 | 4 | 0,5 | 4–6 |
| Calças simples | Calças | `HoseSeparate01_m01_E`, `HoseSeparate01_m03_E` | 33,1–40,7 | 4 | 0,5 | 4–6 |
| Botas de andarilho | Calçados | `BootsAnkle03_m01_D`, `BootsAnkle03_m02_D`, `BootsAnkle03_m03_D`, `BootsAnkle03_m04_D`, `BootsAnkle03_m05_D`, `BootsAnkle03_m06_D`, `BootsAnkle03_m07_D`, `BootsAnkle03_m08_D` | 16,5–29,8 | 4 | 2 | 12–15 |
| Botas | Calçados | `BootsKnee04_m02_D`, `BootsKnee04_m03_D`, `BootsKnee04_m04_D`, `BootsKnee04_m05_D`, `BootsKnee04_m08_D` | 24,8 | 4 | 3 | 13 |
| Sapatos de bobo da corte | Calçados | `BootsAnkle06_m06_C` | 31,1 | 4 | 2 | 14 |
| Bandagem de mão | Mãos | `HandWrap01_m01_E`, `HandWrap01_m02_E`, `HandWrap01_m03_E`, `HandWrap01_m04_E` | 1–1,7 | 2 | 0,1 | 1 |

### Roupa comum (41 a 83 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Chapéu de minerador | Cabeça | `Cap29_m01_C`, `Cap29_m02_C`, `Cap29_m03_C`, `Cap29_m04_C`, `Cap29_m05_C`, `Cap29_m06_C` | 43,3–56,1 | 4 | 0,5 | 13–16 |
| Chapéu redondo | Cabeça | `Cap01_m01_Apprentice`, `Cap01_m01_C`, `Cap01_m02_C`, `Cap01_m03_C`, `Cap01_m04_Apprentice`, `Cap01_m04_Apprentice02`, `Cap01_m04_C`, `Cap01_m05_C`, `Cap01_m07_C`, `Cap01_m08_Blacksmith`, `Cap01_m08_C`, `Cap01_m09_Blacksmith`, `Cap01_m09_C`, `Cap01_m10_C` | 43,3–56,1 | 4 | 0,5 | 13–16 |
| Chapéu silesiano | Cabeça | `Cap21_m02_C`, `Cap21_m03_C`, `Cap21_m04_C`, `Cap21_m05_C`, `Cap21_m06_C`, `Cap21_m07_C`, `Cap21_m08_C`, `Cap21_m09_C`, `Cap21_m10_C` | 43,3–56,1 | 4 | 0,5 | 13–16 |
| Gorro de minerador | Cabeça | `Cap19_m01_C`, `Cap19_m02_C`, `Cap19_m04_C`, `Cap19_m05_C`, `Cap19_m06_C`, `Cap19_m07_C`, `Cap19_m08_C`, `Cap19_m09_C`, `Cap19_m10_C` | 43,3–70,8 | 4 | 0,5 | 13–21 |
| Gorro pontudo | Cabeça | `Cap09_m01_C`, `Cap09_m02_C`, `Cap09_m03_C`, `Cap09_m04_C`, `Cap09_m05_C`, `Cap09_m06_C`, `Cap09_m07_C`, `Cap09_m08_C`, `Cap09_m09_C`, `Cap09_m10_C` | 43,3–56,1 | 4 | 0,5 | 13–16 |
| Coroa perdida | Cabeça | `ztratyANalezy_wreath` | 44,8 | 1 | 4,5 | 18 |
| Capuz de minerador | Cabeça | `Hood08_m01_D`, `Hood08_m02_D`, `Hood08_m03_D`, `Hood08_m04_D`, `Hood08_m05_D`, `Hood08_m06_D`, `Hood08_m07_D`, `Hood08_m08_D`, `Hood08_m09_D`, `Hood08_m10_D` | 45,6–69,3 | 4 | 0,7 | 6–9 |
| Capuz simples | Cabeça | `Hood01_m01_D`, `Hood01_m02_D`, `Hood01_m03_D`, `Hood01_m04_D`, `Hood01_m05_D`, `Hood01_m06_D`, `Hood01_m07_D`, `Hood01_m09_D`, `Hood01_m10_D`, `Hood01_m11_D` | 45,6–69,3 | 4 | 0,7 | 6–9 |
| Chapéu do andarilho | Cabeça | `Cap12_m08_D` | 49 | 4 | 0,5 | 9 |
| Véu judaico | Cabeça | `F_Veil04_m01_C` | 50,4 | 4 | 0,2 | 18 |
| Chaperon | Cabeça | `Cap25_m01_C`, `Cap25_m02_C`, `Cap25_m03_C`, `Cap25_m04_C`, `Cap25_m05_C`, `Cap25_m06_C`, `Cap25_m07_C`, `Cap25_m08_C`, `Cap25_m09_C`, `Cap25_m10_C` | 52,4–68,3 | 4 | 0,5 | 15–20 |
| Faixa simples | Cabeça | `F_HairDecor07_m05_C` | 53,5 | 1 | 0,2 | 24 |
| Chapéu boêmio | Cabeça | `Cap17_m01_C`, `Cap17_m02_C`, `Cap17_m03_C`, `Cap17_m04_C`, `Cap17_m05_C`, `Cap17_m06_C`, `Cap17_m07_C`, `Cap17_m08_C`, `Cap17_m09_C`, `Cap17_m10_C` | 54,3–70,8 | 4 | 0,5 | 16–21 |
| Chapéu judeu | Cabeça | `Cap28_m01_C`, `Cap28_m02_C`, `Cap28_m03_C` | 56,1 | 4 | 0,5 | 16 |
| Chapéu de palha estranho | Cabeça | `poi_luffy_strawhat` | 57 | 4 | 36 | 24 |
| Acessório de cabeça decorado | Cabeça | `F_HairDecor04_m01_B`, `F_HairDecor04_m02_B`, `F_HairDecor04_m03_B`, `F_HairDecor04_m04_B`, `F_HairDecor04_m05_B`, `F_HairDecor05_m01_B`, `F_HairDecor05_m02_B`, `F_HairDecor05_m03_B`, `F_HairDecor05_m04_B`, `F_HairDecor05_m05_B`, `F_HairDecor06_m01_B`, `F_HairDecor06_m02_B`, `F_HairDecor06_m03_B`, `F_HairDecor06_m04_B` | 57,4 | 1 | 0,2 | 26 |
| Capuz feminino | Cabeça | `F_Hood01_m01_C`, `F_Hood01_m02_C`, `F_Hood01_m03_C`, `F_Hood01_m04_C`, `F_Hood01_m05_C`, `F_Hood01_m07_C`, `F_Hood01_m10_C`, `F_Hood02_m02_C`, `F_Hood02_m03_C`, `F_Hood02_m04_C`, `F_Hood02_m07_C`, `F_Hood02_m09_C`, `F_Hood02_m10_C`, `F_Hood02_m11_C`, `F_Hood02_m12_C` | 58,2 | 4 | 1 | 20 |
| Chapéu de palha feminino | Cabeça | `F_Cap01_m01_B`, `F_Cap01_m02_B`, `F_Cap01_m03_B`, `F_Cap01_m04_B`, `F_Cap01_m05_B`, `F_Cap01_m06_B`, `F_Cap02_m01_B`, `F_Cap02_m02_B`, `F_Cap03_m01_B`, `F_Cap03_m02_B` | 60 | 4 | 0,5 | 19 |
| Chapéu de burguês | Cabeça | `Cap12_m02_Apprentice`, `Cap12_m02_Blacksmith`, `Cap23_m02_B`, `Cap23_m03_B`, `Cap23_m04_B`, `Cap23_m05_B`, `Cap23_m06_B`, `Cap23_m07_B`, `Cap23_m08_B`, `Cap23_m09_B`, `Cap23_m10_B` | 64,2–81,2 | 4 | 0,5 | 16–21 |
| Touca | Cabeça | `F_Bonnet01_m02_B`, `F_Bonnet01_m03_B`, `F_Bonnet01_m04_B` | 67,3 | 4 | 0,2 | 20 |
| Touca bordada | Cabeça | `F_Bonnet02_m01_B`, `F_Bonnet02_m02_B`, `F_Bonnet02_m03_B` | 67,3 | 4 | 0,2 | 20 |
| Touca simples | Cabeça | `F_Bonnet03_m01_B`, `F_Bonnet03_m02_B`, `F_Bonnet03_m03_B` | 67,3 | 4 | 0,2 | 20 |
| Chapéu de mestre-caçador | Cabeça | `Cap24_m07_B`, `Cap24_m09_B`, `Cap33_m03_B`, `Cap33_m06_B` | 69–81,6 | 4 | 0,5 | 18–21 |
| Capuz de monge | Cabeça | `Hood01_mMonks_D` | 69,3 | 4 | 0,7 | 9 |
| Chaperon bordado | Cabeça | `Cap07_m04_B`, `Cap07_m11_B` | 76,3 | 4 | 0,5 | 20 |
| Véu de Santa Ludmila | Cabeça | `magicShop_veilOfLudmila` | 78 | 4 | 0,2 | 12 |
| Chapéu borgonhês | Cabeça | `Cap08_m05_B`, `Cap08_m09_B`, `Cap08_m10_B` | 78,8–81,2 | 4 | 0,5 | 21 |
| Chapéu com babados | Cabeça | `Cap02_m06_B`, `Cap02_m07_B`, `Cap02_m08_B`, `Cap02_m09_B` | 78,8–81,2 | 4 | 0,5 | 21 |
| Capuz de apanhador de cogumelos | Cabeça | `Hood08_mmushrooms` | 81,9 | 4 | 0,7 | 13 |
| Túnica de estalajadeiro | Tronco e vestidos | `TunicLong02_m01_C`, `TunicLong02_m03_C`, `TunicLong02_m04_C`, `TunicLong02_m05_C`, `TunicLong02_m08_C`, `TunicLong02_m10_C`, `TunicLong02_m11_C`, `TunicLong02_m12_C`, `TunicLong02_mPusko`, `TunicLong02_mPusko_NoVest` | 41,3–45,5 | 4 | 1 | 18–20 |
| Avental de couro | Tronco e vestidos | `TunicShort05_m03_D`, `TunicShort05_m08_D` | 41,7 | 4 | 1 | 10 |
| Camisa de estalajadeiro | Tronco e vestidos | `TunicShort06_m01_D`, `TunicShort06_m03_D`, `TunicShort06_m04_D`, `TunicShort06_m05_D` | 41,7–45,1 | 4 | 1 | 10 |
| Túnica curta | Tronco e vestidos | `TunicShort01_m02_C`, `TunicShort01_m03_C`, `TunicShort01_m04_C`, `TunicShort01_m05_C`, `TunicShort01_m06_C`, `TunicShort01_m07_C`, `TunicShort01_m09_C`, `TunicShort01_m10_C`, `TunicShort01_m11_C`, `TunicShort01_m12_C`, `TunicShort02_m01_D`, `TunicShort02_m02_D`, `TunicShort02_m03_D`, `TunicShort02_m04_D`, `TunicShort02_m05_D`, `TunicShort02_m06_D`, `TunicShort02_m07_D`, `TunicShort02_m08_D`, `TunicShort02_m09_D`, `TunicShort02_m10_D` | 41,7–69 | 4 | 1 | 10–15 |
| Túnica de minerador | Tronco e vestidos | `TunicShort03_m03_D`, `TunicShort03_m04_D`, `TunicShort03_m06_D`, `TunicShort03_m08_D`, `TunicShort03_m11_D`, `TunicShort03_m12_D` | 41,7–45,1 | 4 | 1 | 10 |
| Vestido de trabalho | Tronco e vestidos | `F_SimpleDress01_m02_D`, `F_SimpleDress01_m03_D`, `F_SimpleDress01_m04_D`, `F_SimpleDress01_m05_D`, `F_SimpleDress01_m06_D`, `F_SimpleDress01_m07_D`, `F_SimpleDress01_m08_D`, `F_SimpleDress01_m09_D`, `F_SimpleDress01_m10_D`, `F_SimpleDress02_m01_C`, `F_SimpleDress02_m02_C`, `F_SimpleDress02_m03_C`, `F_SimpleDress02_m09_C`, `F_SimpleDress02_m11_C`, `F_SimpleDress02_mCatLady`, `F_SimpleDress06_m01_D`, `F_SimpleDress06_m03_D`, `F_SimpleDress06_m04_D`, `F_SimpleDress06_m05_D`, `F_SimpleDress06_m06_D`, `F_SimpleDress06_m08_D`, `F_SimpleDress06_m10_D`, `F_SimpleDress06_m11_D`, `F_SimpleDress06_m12_D`, `F_SimpleDress06_m13_D`, `F_SimpleDress06_m15_D`, `F_SimpleDress06_m16_D`, `F_SimpleDress06_m17_D`, `F_SimpleDress06_m18_D`, `F_SimpleDress06_m20_D`, `F_SimpleDress06_mDivozenka` | 43,5–75,3 | 4 | 2,5 | 12–19 |
| Casacão de mendigo | Tronco e vestidos | `Coat03_m03_E` | 44,5 | 4 | 2,9 | 5 |
| Túnica | Tronco e vestidos | `TunicLong01_m02_C`, `TunicLong01_m03_C`, `TunicLong01_m06_C`, `TunicLong01_m10_C`, `TunicLong01_m11_C` | 45,5 | 4 | 1 | 20 |
| Vestido de viagem | Tronco e vestidos | `F_SimpleDress03_m01_C`, `F_SimpleDress03_m03_C`, `F_SimpleDress03_m08_C`, `F_SimpleDress03_m13_C`, `F_SimpleDress03_m14_C`, `F_SimpleDress03_m15_C` | 49,5–59,6 | 4 | 2,5 | 15–16 |
| Cotehardie de mulher da nobreza | Tronco e vestidos | `F_Cotehardie01_m12_B`, `F_Cotehardie04_mGretaF` | 49,6–78,3 | 4 | 3 | 18 |
| Hábito clerical | Tronco e vestidos | `Habit01_m01_C`, `Habit01_m02_C`, `Habit01_m03_C`, `Habit01_m04_C`, `Habit03_m02_C`, `Habit03_m03_C`, `Habit03_m05_C`, `Habit03_m06_C` | 49,6–81,4 | 4 | 2 | 12–15 |
| Sobretudo de lorde | Tronco e vestidos | `Habit02_m01_C`, `Habit02_m06_C` | 49,6 | 4 | 2 | 12 |
| Camisa bordada | Tronco e vestidos | `TunicShort08_m01_C`, `TunicShort08_m02_C`, `TunicShort08_m03_C`, `TunicShort08_m04_C`, `TunicShort08_m05_C`, `TunicShort08_m06_C`, `TunicShort08_m07_C`, `TunicShort08_m08_C`, `TunicShort08_m10_C`, `TunicShort08_m11_C` | 53,4–80,9 | 4 | 1 | 11–17 |
| Capuz feminino | Tronco e vestidos | `F_SimpleDress05_m23_C` | 59,6 | 4 | 2,5 | 15 |
| Vestido com babados | Tronco e vestidos | `F_SimpleDress04_m02_C`, `F_SimpleDress07_m03_C`, `F_SimpleDress07_m08_C`, `F_SimpleDress07_m11_C`, `F_SimpleDress07_m13_C`, `F_SimpleDress07_m15_C` | 59,6 | 4 | 2,5 | 15 |
| Vestido de festa | Tronco e vestidos | `F_SimpleDress05_m08_C`, `F_SimpleDress05_m11_C`, `F_SimpleDress05_m13_C`, `F_SimpleDress05_m18_C`, `F_SimpleDress05_m20_C`, `F_SimpleDress05_m21_C`, `F_SimpleDress05_m22_C` | 59,6 | 4 | 2,5 | 15 |
| Vestido de festa colorido | Tronco e vestidos | `F_SimpleDress05_mMusician01_C` | 59,6 | 4 | 2,5 | 15 |
| Sobretudo | Tronco e vestidos | `F_Surcote01_m02_C`, `F_Surcote01_m03_C`, `F_Surcote01_m04_C`, `F_Surcote01_m05_C`, `F_Surcote01_m06_C`, `F_Surcote01_m07_C`, `F_Surcote01_m08_C`, `F_Surcote01_m10_C`, `F_Surcote01_m11_C`, `F_Surcote01_m12_C`, `F_Surcote01_m13_C`, `F_Surcote01_m14_C`, `F_Surcote01_m15_C` | 63,7 | 4 | 3 | 20 |
| Casaco comum | Tronco e vestidos | `Coat02_m01_D`, `Coat02_m04_D`, `Coat02_m06_D`, `Coat02_m13_D` | 80,9 | 4 | 2,9 | 7 |
| Túnica de andarilho | Tronco e vestidos | `Coat10_m02_D`, `Coat10_m05_D` | 80,9 | 4 | 2,9 | 7 |
| Calças largas | Calças | `HoseLoose01_m01_C`, `HoseLoose01_m07_C`, `HoseLoose01_m08_C`, `HoseLoose01_m09_C`, `HoseLoose01_mUher_C` | 42,2–55,1 | 4 | 0,5 | 12–13 |
| Calças do punguista | Calças | `HoseSeparate04_m03_E` | 45,5 | 4 | 0,5 | 4 |
| Calças de mineiro | Calças | `HoseSeparate05_m01_D`, `HoseSeparate05_m02_D`, `HoseSeparate05_m03_D`, `HoseSeparate05_m04_D`, `HoseSeparate05_m05_D`, `HoseSeparate05_m06_D`, `HoseSeparate05_m07_D`, `HoseSeparate05_m08_D`, `HoseSeparate05_m09_D`, `HoseSeparate05_m10_D`, `HoseSeparate05_m11_D`, `HoseSeparate05_m12_D`, `HoseSeparate05_m13_D`, `HoseSeparate05_m14_D`, `HoseSeparate05_mBurned` | 57,9–73,3 | 4 | 0,5 | 9–12 |
| Calças do mestre-caçador | Calças | `HoseSeparate01_m21_D` | 57,9 | 4 | 0,5 | 9 |
| Calças simples | Calças | `HoseSeparate01_m01_D`, `HoseSeparate01_m02_D`, `HoseSeparate01_m03_D`, `HoseSeparate01_m04_D`, `HoseSeparate01_m05_D`, `HoseSeparate01_m07_D`, `HoseSeparate01_m08_D`, `HoseSeparate01_m09_D`, `HoseSeparate01_m11_D`, `HoseSeparate01_m12_D`, `HoseSeparate01_m13_D`, `HoseSeparate01_m14_D`, `HoseSeparate01_m16_D`, `HoseSeparate01_m18_D`, `HoseSeparate01_m19_D`, `HoseSeparate01_m20_D` | 57,9–79,6 | 4 | 0,5 | 9–13 |
| Calça do andarilho | Calças | `HoseSeparate01_m06_D` | 64,2 | 4 | 0,5 | 9 |
| Botas de trabalho | Calçados | `BootsAnkle01_m01_C`, `BootsAnkle01_m02_C`, `BootsAnkle01_m03_C`, `BootsAnkle01_m04_C`, `BootsAnkle01_m05_C`, `BootsAnkle01_m07_C`, `BootsAnkle01_m08_C` | 42,3 | 4 | 2 | 16 |
| Botas firmes | Calçados | `BootsAnkle05_m01_C`, `BootsAnkle05_m02_C`, `BootsAnkle05_m03_C`, `BootsAnkle05_m04_C`, `BootsAnkle05_m05_C`, `BootsAnkle05_m07_C`, `BootsAnkle05_m08_C` | 42,3–62,4 | 4 | 2 | 16–21 |
| Sapatos de bobo da corte | Calçados | `BootsAnkle06_m01_C`, `BootsAnkle06_m02_C`, `BootsAnkle06_m03_C`, `BootsAnkle06_m04_C`, `BootsAnkle06_m05_C` | 47 | 4 | 2 | 17 |
| Botas | Calçados | `BootsKnee04_m06_D`, `BootsKnee04_m07_D` | 53,3 | 4 | 3 | 18 |
| Sapatos femininos | Calçados | `F_Shoes02_m07_B` | 61,2 | 4 | 0,4 | 20 |
| Sapatos femininos comuns | Calçados | `F_Shoes02_m01_B`, `F_Shoes02_m02_B`, `F_Shoes02_m03_B`, `F_Shoes02_m04_B`, `F_Shoes02_m05_B`, `F_Shoes02_m06_B`, `F_Shoes02_m08_B`, `F_Shoes02_m09_B`, `F_Shoes02_m10_B` | 61,2 | 4 | 0,4 | 20 |
| Botas de viagem | Calçados | `BootsAnkle02_m01_B`, `BootsAnkle02_m02_B`, `BootsAnkle02_m04_B`, `BootsAnkle02_m05_B`, `BootsAnkle02_m06_B`, `BootsAnkle02_m07_B`, `BootsAnkle02_m08_B` | 68,3 | 4 | 2 | 20 |
| Botas cumanas | Calçados | `BootsKnee05_m01_C`, `BootsKnee05_m03_C`, `BootsKnee05_m04_C`, `BootsKnee05_m07_C`, `BootsKnee05_m08_C`, `BootsKnee05_mUher_C` | 74,3 | 4 | 3 | 20 |
| Botas de equitação | Calçados | `BootsKnee03_m01_C`, `BootsKnee03_m03_C`, `BootsKnee03_m06_C`, `BootsKnee03_m07_C`, `BootsKnee03_m08_C` | 74,3 | 4 | 3 | 20 |
| Sapatos simples | Calçados | `Shoes04_m01_E`, `Shoes04_m03_E`, `Shoes04_m04_E` | 79,1 | 4 | 1 | 4 |

### Roupa boa (83 a 190 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Chapéu de burguês | Cabeça | `Cap23_m01_A` | 85 | 4 | 0,5 | 20 |
| Capuz de andarilho | Cabeça | `Hood07_m01_C`, `Hood07_m03_C`, `Hood07_m04_C`, `Hood07_m05_C`, `Hood07_m06_C`, `Hood07_m07_C`, `Hood07_m08_C` | 86,4–162 | 4 | 0,7 | 9–17 |
| Capuz de clérigo | Cabeça | `Hood09_m01_C`, `Hood09_m02_C`, `Hood09_m04_C`, `Hood09_m05_C`, `Hood09_m06_C`, `Hood09_m07_C`, `Hood09_m08_C`, `Hood09_m09_C`, `Hood09_m10_C`, `Hood09_mLibrarianSack_C` | 86,4–122 | 4 | 0,7 | 9–13 |
| Capuz de servo | Cabeça | `Hood11_m01_C`, `Hood11_m02_C`, `Hood11_m03_C`, `Hood11_m04_C`, `Hood11_m05_C`, `Hood11_m06_C`, `Hood11_m07_C`, `Hood11_m08_C`, `Hood11_m09_C`, `Hood11_m10_C`, `Hood11_m11_C`, `Hood11_m12_C`, `Hood11_mBergov_C`, `Hood11_mKuttenberg_C`, `Hood11_mMagyar_C`, `Hood11_mNebak_C`, `Hood11_mPapal_C`, `Hood11_mPisek_C`, `Hood11_mSemin02_C`, `Hood11_mSemin_C`, `Hood11_mVavak_C` | 86,4–162 | 4 | 0,7 | 9–17 |
| Chapéu de mestre-caçador | Cabeça | `Cap24_m01_B`, `Cap24_m02_B`, `Cap24_m03_B`, `Cap24_m04_B`, `Cap24_m05_B`, `Cap24_m06_B`, `Cap24_m08_B`, `Cap24_m10_B`, `Cap33_m01_B`, `Cap33_m02_B`, `Cap33_m04_B` | 87,9 | 4 | 0,5 | 23 |
| Capuz do andarilho | Cabeça | `Hood01_m08_D` | 88,5 | 4 | 0,7 | 8 |
| Chaperon bordado | Cabeça | `Cap07_m01_B`, `Cap07_m02_B`, `Cap07_m03_B`, `Cap07_m05_B`, `Cap07_m06_B`, `Cap07_m07_B`, `Cap07_m08_B`, `Cap07_m09_B`, `Cap07_m10_B`, `Cap07_m12_B` | 90,5–97,6 | 4 | 0,5 | 24–26 |
| Faixa estreita de cabeça | Cabeça | `F_HairDecor02_m01_A`, `F_HairDecor02_m02_A`, `F_HairDecor02_m03_A`, `F_HairDecor02_m04_A`, `F_HairDecor02_m05_A`, `F_HairDecor03_m01_A`, `F_HairDecor03_m02_A`, `F_HairDecor03_m03_A`, `F_HairDecor03_m04_A`, `F_HairDecor03_m05_A` | 91,3 | 1 | 0,2 | 41 |
| Chapéu com babados | Cabeça | `Cap02_m01_B`, `Cap02_m02_B`, `Cap02_m03_B`, `Cap02_m04_B`, `Cap02_m05_B`, `Cap02_m10_B` | 93,5–101 | 4 | 0,5 | 25–27 |
| Chapéu de caça | Cabeça | `Cap10_m02_B`, `Cap10_m03_B`, `Cap10_m04_B`, `Cap10_m05_B`, `Cap10_m06_B`, `Cap10_m07_B`, `Cap10_m08_B`, `Cap10_m09_B`, `Cap10_m10_B` | 94,3–122 | 4 | 0,5 | 25–34 |
| Véu com babados | Cabeça | `F_Veil01_m01_B`, `F_VeilMagdalena_m01` | 94,7 | 4 | 0,2 | 24 |
| Véu simples | Cabeça | `F_Veil02_m01_B` | 94,7 | 4 | 0,2 | 24 |
| Chaperon nobre | Cabeça | `Cap34_m01_A`, `Cap34_m02_A`, `Cap34_m03_A`, `Cap34_m04_A`, `Cap34_m05_A`, `Cap34_m06_A`, `Cap34_mGottfried` | 97,8–124 | 4 | 0,5 | 24–31 |
| Chapéu borgonhês | Cabeça | `Cap08_m01_B`, `Cap08_m02_B`, `Cap08_m03_B`, `Cap08_m04_B`, `Cap08_m06_B`, `Cap08_m07_B`, `Cap08_m08_B` | 101 | 4 | 0,5 | 27 |
| Chapéu do punguista | Cabeça | `Cap19_m03_C` | 105 | 4 | 0,5 | 15 |
| Capuz com bainha | Cabeça | `Hood02_m01_C`, `Hood02_m02_C`, `Hood02_m03_C`, `Hood02_m04_C`, `Hood02_m05_C`, `Hood02_m06_C`, `Hood02_m07_C`, `Hood02_m08_C`, `Hood02_m10_C` | 106–148 | 4 | 0,7 | 11–15 |
| Chapéu do pintor Vojta | Cabeça | `CapPainter_flipped_m01`, `CapPainter_m01`, `CapZachary_m01` | 109 | 4 | 0,5 | 41 |
| Capuz dos Cavaleiros da Cruz | Cabeça | `Hood09_mKrizovnik01_C`, `Hood09_mKrizovnik02_C` | 110 | 4 | 0,7 | 12 |
| Gorro com penas de pavão | Cabeça | `Cap14_m01_A`, `Cap14_m02_A`, `Cap14_m03_A`, `Cap14_m04_A`, `Cap14_m05_A`, `Cap14_m06_A`, `Cap14_m07_A`, `Cap14_m08_A`, `Cap14_m09_A`, `Cap14_m10_A` | 115–147 | 4 | 0,5 | 29–38 |
| Capuz de monge | Cabeça | `Hood09_mMonks_C`, `Hood11_mMonks_C` | 116–122 | 4 | 0,7 | 12–13 |
| Capuz teutônico | Cabeça | `Hood11_mTeuton` | 116 | 4 | 0,7 | 21 |
| Gorro pontudo | Cabeça | `Cap10_m01_B` | 122 | 4 | 0,5 | 34 |
| Chapéu do cortesão | Cabeça | `Cap33_m05_B` | 148 | 4 | 0,5 | 18 |
| Capuz bordado | Cabeça | `Hood06_m04_B`, `Hood06_m05_B`, `Hood06_m11_B` | 167 | 4 | 0,7 | 17 |
| Capuz da peste | Cabeça | `PlagueSuit_m01` | 175 | 4 | 0,7 | 5 |
| Vestido colorido com babados | Tronco e vestidos | `F_SimpleDress04_mMusician01_C`, `F_SimpleDress04_mMusician02_C`, `F_SimpleDress04_mMusician03_C` | 83,1 | 4 | 2,5 | 20 |
| Vestido com babados | Tronco e vestidos | `F_SimpleDress04_m01_C`, `F_SimpleDress04_m03_C`, `F_SimpleDress04_m04_C`, `F_SimpleDress04_m05_C`, `F_SimpleDress04_m06_C`, `F_SimpleDress04_m07_B`, `F_SimpleDress04_m08_B`, `F_SimpleDress04_m09_B`, `F_SimpleDress04_m10_B`, `F_SimpleDress04_m11_B`, `F_SimpleDress04_m12_B`, `F_SimpleDress04_m13_B`, `F_SimpleDress04_m14_B`, `F_SimpleDress04_mDoubravka`, `F_SimpleDress07_m01_C`, `F_SimpleDress07_m02_C`, `F_SimpleDress07_m04_C`, `F_SimpleDress07_m05_C`, `F_SimpleDress07_m06_C`, `F_SimpleDress07_m07_C`, `F_SimpleDress07_m09_C`, `F_SimpleDress07_m10_C`, `F_SimpleDress07_m12_C`, `F_SimpleDress07_m14_C`, `F_SimpleDress07_m16_C`, `F_SimpleDress07_m17_C`, `F_SimpleDress07_m18_C`, `F_SimpleDress07_m19_C`, `F_SimpleDress07_m20_C` | 83,1–129 | 4 | 2,5 | 20–27 |
| Vestido da Katherine | Tronco e vestidos | `F_SimpleDressMagdalena_m01` | 83,1 | 4 | 2,5 | 20 |
| Vestido da Rosa | Tronco e vestidos | `F_SimpleDressRose_HiddenBelt` | 83,1 | 4 | 2,5 | 20 |
| Vestido de festa | Tronco e vestidos | `F_SimpleDress05_m01_C`, `F_SimpleDress05_m02_C`, `F_SimpleDress05_m03_C`, `F_SimpleDress05_m04_C`, `F_SimpleDress05_m05_C`, `F_SimpleDress05_m06_C`, `F_SimpleDress05_m07_C`, `F_SimpleDress05_m09_C`, `F_SimpleDress05_m10_C`, `F_SimpleDress05_m12_C`, `F_SimpleDress05_m14_C`, `F_SimpleDress05_m15_C`, `F_SimpleDress05_m16_C`, `F_SimpleDress05_m17_C`, `F_SimpleDress05_m19_C` | 83,1 | 4 | 2,5 | 20 |
| Vestido de festa colorido | Tronco e vestidos | `F_SimpleDress05_mMusician02_C` | 83,1 | 4 | 2,5 | 20 |
| Vestido de trabalho | Tronco e vestidos | `F_SimpleDress02_m04_C`, `F_SimpleDress02_m05_C`, `F_SimpleDress02_m06_C`, `F_SimpleDress02_m07_C`, `F_SimpleDress02_m08_C`, `F_SimpleDress02_m10_C`, `F_SimpleDress02_m12_C`, `F_SimpleDress02_m13_C`, `F_SimpleDress02_m14_C`, `F_SimpleDress06_m09_D` | 83,1–108 | 4 | 2,5 | 20–25 |
| Vestido de viagem | Tronco e vestidos | `F_SimpleDress03_m02_C`, `F_SimpleDress03_m04_C`, `F_SimpleDress03_m05_C`, `F_SimpleDress03_m06_C`, `F_SimpleDress03_m07_C`, `F_SimpleDress03_m09_C`, `F_SimpleDress03_m10_C`, `F_SimpleDress03_m11_C`, `F_SimpleDress03_m12_C` | 83,1 | 4 | 2,5 | 20 |
| Hábito clerical | Tronco e vestidos | `Habit01_m05_C`, `Habit01_m06_C`, `Habit02_mAlbikNoBags_C`, `Habit02_mAlbik_C`, `Habit03_m01_C`, `Habit03_m04_C` | 98,1–185 | 4 | 2 | 17–26 |
| Casaco comum | Tronco e vestidos | `Coat02_m03_D`, `Coat02_m05_D`, `Coat02_m08_D`, `Coat02_m09_D`, `Coat02_m10_D`, `Coat02_m11_D`, `Coat02_m12_D`, `Coat04_m01_C`, `Coat04_m02_C`, `Coat04_m03_C`, `Coat04_m04_C`, `Coat04_m06_C`, `Coat04_m07_C`, `Coat04_m08_C`, `Coat04_m09_C`, `Coat04_m10_C`, `Coat04_m11_C`, `Coat04_m12_C` | 104–163 | 4 | 2,9 | 10–14 |
| Sobretudo de irmão leigo teutônico | Tronco e vestidos | `Coat02_mTeuton` | 104 | 4 | 2,9 | 12 |
| Sobretudo teutônico | Tronco e vestidos | `Coat02_mTeuton02` | 104 | 4 | 2,9 | 12 |
| Túnica de andarilho | Tronco e vestidos | `Coat10_m01_D`, `Coat10_m03_D`, `Coat10_m04_D` | 104 | 4 | 2,9 | 10 |
| Túnica de montaria | Tronco e vestidos | `Waffenrock08_m05_B`, `Waffenrock08_m10_B`, `Waffenrock08_m11_D`, `Waffenrock08_m15_B`, `Waffenrock08_mkhTournament_01_B`, `Waffenrock08_mkhTournament_02_B`, `Waffenrock08_mkhTournament_03_B`, `Waffenrock08_mkhTournament_04_B`, `Waffenrock08_mkhTournament_06_B`, `Waffenrock08_mkhTournament_07_B` | 113–190 | 4 | 2 | 19–28 |
| Túnica simples | Tronco e vestidos | `Waffenrock02_m01_D`, `Waffenrock02_m02_D`, `Waffenrock02_m03_D`, `Waffenrock02_m04_D`, `Waffenrock02_m05_D`, `Waffenrock02_mBergov_D`, `Waffenrock02_mKuttenberg01_D`, `Waffenrock02_mKuttenberg02_D`, `Waffenrock02_mKuttenberg03_D`, `Waffenrock02_mKuttenberg_D`, `Waffenrock02_mNebak_D`, `Waffenrock02_mRuthart01_D`, `Waffenrock02_mRuthart_D`, `Waffenrock02_mSemin_D` | 116–125 | 4 | 2 | 18–19 |
| Disfarce de bobo da corte | Tronco e vestidos | `Coat06_m01_C`, `Coat06_m02_C`, `Coat06_m03_C`, `Coat06_m04_C`, `Coat06_m05_C` | 119 | 4 | 2,9 | 10 |
| Fantasia de Jimbo | Tronco e vestidos | `Coat06_mJimbo_C` | 119 | 4 | 2,9 | 10 |
| Túnica de torneio | Tronco e vestidos | `Waffenrock08_mkhTournament_05_B_Henry` | 122 | 4 | 2 | 28 |
| Casaco do andarilho | Tronco e vestidos | `Coat02_m07_D` | 127 | 4 | 2,7 | 7 |
| Casaco de caça | Tronco e vestidos | `Coat05_m01_C`, `Coat05_m02_C`, `Coat05_m03_C`, `Coat05_m04_C`, `Coat05_m05_C`, `Coat05_m07_C`, `Coat05_m08_C`, `Coat05_m09_C`, `Coat05_m10_C` | 129–163 | 4 | 2,9 | 10–14 |
| Casaco de comerciante | Tronco e vestidos | `Coat12_m01_C`, `Coat12_m02_C`, `Coat12_m03_C`, `Coat12_m04_C`, `Coat12_m05_C`, `Coat12_m06_C`, `Coat12_m07_C` | 129–163 | 4 | 2,9 | 10–14 |
| Casaco de gracejo | Tronco e vestidos | `Coat13_m01_C`, `Coat13_m02_C`, `Coat13_m03_C`, `Coat13_m04_C`, `Coat13_m05_C`, `Coat13_m06_C`, `Coat13_m07_C`, `Coat13_m09_C`, `Coat13_m11_C` | 129–163 | 4 | 2,9 | 10–14 |
| Sobretudo de lorde | Tronco e vestidos | `Habit02_m02_C`, `Habit02_m05_C` | 140 | 4 | 2 | 21 |
| Cotehardie de mulher da nobreza | Tronco e vestidos | `F_Cotehardie01_m10_B`, `F_Cotehardie01_m14_B`, `F_Cotehardie04_m01_B`, `F_Cotehardie04_m02_B`, `F_Cotehardie04_m05_B`, `F_Cotehardie04_m06_B`, `F_Cotehardie04_m07_B`, `F_Cotehardie04_m10_B`, `F_Cotehardie04_m14_B` | 140–171 | 4 | 3 | 23–25 |
| Casaco bordado | Tronco e vestidos | `Coat11_m02_C`, `Coat11_m05_C`, `Coat11_m08_C` | 158 | 4 | 2,9 | 13 |
| Túnica do ladrão | Tronco e vestidos | `TunicShort08_m09_C` | 162 | 4 | 0,9 | 11 |
| Cafetã com fecho | Tronco e vestidos | `Caftan03_m01_C1`, `Caftan03_m03_C1`, `Caftan03_m06_C1`, `Caftan03_m08_C1`, `Caftan03_m10_C1` | 166–169 | 4 | 13,6 | 17 |
| Túnica com bainha | Tronco e vestidos | `Waffenrock01_m01_C`, `Waffenrock01_m02_C`, `Waffenrock01_m03_C`, `Waffenrock01_mBergov_C`, `Waffenrock01_mCimburk_C`, `Waffenrock01_mMagyar01_C`, `Waffenrock01_mMagyar_C`, `Waffenrock01_mNebak_C`, `Waffenrock01_mPisek_C`, `Waffenrock01_mRuthart_C`, `Waffenrock01_mSemin_C` | 171–185 | 4 | 2 | 22–23 |
| Túnica dos Cruzados da Estrela Vermelha | Tronco e vestidos | `Waffenrock01_mKrizovnik01_C`, `Waffenrock01_mKrizovnik02_C`, `Waffenrock01_mKrizovnik03_C` | 171 | 4 | 2 | 22 |
| Gibão de burguês | Tronco e vestidos | `TunicShort04_m01_A`, `TunicShort04_m02_A`, `TunicShort04_m03_A`, `TunicShort04_m04_A`, `TunicShort04_m05_A`, `TunicShort04_m09_A`, `TunicShort04_m10_A`, `TunicShort04_mMurderer` | 173–187 | 4 | 1 | 21–35 |
| Casaco acolchoado | Tronco e vestidos | `Coat07_m01_B`, `Coat07_m04_B` | 177 | 4 | 2,9 | 14 |
| Túnica de irmão leigo teutônico | Tronco e vestidos | `Waffenrock01_mTeuton` | 179 | 4 | 2 | 24 |
| Túnica com bainha de Praga | Tronco e vestidos | `Waffenrock01_mPrague01_C`, `Waffenrock01_mPrague02_C` | 185 | 4 | 2 | 23 |
| Uniforme da família Polner | Tronco e vestidos | `Waffenrock01_mPolner` | 185 | 4 | 2 | 23 |
| Calça costurada | Calças | `HoseJoined01_m01_C`, `HoseJoined01_m03_C`, `HoseJoined01_m04_C`, `HoseJoined01_m05_C`, `HoseJoined01_m06_C`, `HoseJoined01_m07_C`, `HoseJoined01_m08_C`, `HoseJoined01_m09_C`, `HoseJoined01_m11_C`, `HoseJoined01_m12_C`, `HoseJoined01_m13_C`, `HoseJoined01_m14_C`, `HoseJoined01_m15_C` | 100–128 | 4 | 0,5 | 15–20 |
| Calças simples | Calças | `HoseSeparate01_m10_D`, `HoseSeparate01_m15_D`, `HoseSeparate01_m17_D` | 103 | 4 | 0,5 | 17 |
| Calças simples de trovador | Calças | `HoseSeparate01_mPattern01_D`, `HoseSeparate01_mPattern01_m01_D`, `HoseSeparate01_mPattern02_D`, `HoseSeparate01_mPattern02_m01_D`, `HoseSeparate01_mPattern03_D`, `HoseSeparate01_mPattern03_m01_D`, `HoseSeparate01_mPattern03_m02_D` | 103 | 4 | 0,5 | 17 |
| Calças largas | Calças | `HoseLoose01_m03_C` | 109 | 4 | 0,5 | 17 |
| Calça com ligas | Calças | `HoseJoined02_m01_B`, `HoseJoined02_m02_B`, `HoseJoined02_m03_B`, `HoseJoined02_m04_B`, `HoseJoined02_m05_B`, `HoseJoined02_m06_B`, `HoseJoined02_m09_B`, `HoseJoined02_m10_B`, `HoseJoined02_m11_B`, `HoseJoined02_m15_B`, `HoseJoined02_m16_B`, `HoseJoined02_m18_B`, `HoseJoined02_m21_B`, `HoseJoined02_mGottfried`, `HoseJoined02_mOderin_B`, `HoseJoined02_mPainter`, `HoseJoined02_mPisek_B`, `HoseJoined02_mSamuel` | 119–178 | 4 | 0,5 | 18–27 |
| Calças de bobo da corte | Calças | `HoseJoined02_mPattern01_B`, `HoseJoined02_mPattern01_m01_B`, `HoseJoined02_mPattern02_B`, `HoseJoined02_mPattern03_B` | 176 | 4 | 0,5 | 26 |
| Botas de viagem | Calçados | `BootsAnkle02_m03_B` | 86 | 4 | 2 | 24 |
| Sapatos do punguista | Calçados | `BootsAnkle05_m06_C` | 87,5 | 4 | 1,8 | 19 |
| Botas silenciosas | Calçados | `BootsAnkle01_m06_C` | 90,3 | 4 | 1,8 | 16 |
| Botas cumanas | Calçados | `BootsKnee05_m02_C`, `BootsKnee05_m05_C`, `BootsKnee05_m06_C`, `BootsKnee05_m09_C` | 103–117 | 4 | 3 | 24–27 |
| Sapatos simples | Calçados | `Shoes01_m01_D`, `Shoes01_m02_D`, `Shoes01_m03_D`, `Shoes01_m04_D`, `Shoes01_m05_D`, `Shoes01_m06_D`, `Shoes01_m07_D`, `Shoes01_m08_D` | 109–129 | 4 | 1 | 9–12 |
| Botas de equitação | Calçados | `BootsKnee03_m04_C`, `BootsKnee03_m05_C` | 117 | 4 | 3 | 27 |
| Botas de cortesão | Calçados | `BootsAnkle04_m01_A`, `BootsAnkle04_m02_A`, `BootsAnkle04_m04_A`, `BootsAnkle04_m05_A`, `BootsAnkle04_m06_A`, `BootsAnkle04_m07_A`, `BootsAnkle04_m08_A` | 122–182 | 4 | 2 | 31–40 |
| Sapatos de burguês | Calçados | `BootsKnee02_m02_B`, `BootsKnee02_m05_B`, `BootsKnee02_m07_B`, `BootsKnee02_m08_B`, `Shoes02_m02_B`, `Shoes02_m04_B`, `Shoes02_m06_B`, `Shoes02_m08_B`, `Shoes02_mOderin_B` | 124–178 | 4 | 1–3 | 19–32 |
| Sapatos do andarilho | Calçados | `Shoes04_m02_E` | 125 | 4 | 0,9 | 5 |
| Sapatos de ladrão | Calçados | `BootsKnee04_m01_D` | 126 | 4 | 2,7 | 16 |
| Botas de nobre | Calçados | `BootsKnee01_m01_C`, `BootsKnee01_m07_C`, `BootsKnee01_m08_C` | 135 | 4 | 3 | 30 |
| Sapatos macios | Calçados | `Shoes03_m01_C`, `Shoes03_m02_C`, `Shoes03_m04_C`, `Shoes03_m05_C`, `Shoes03_m06_C`, `Shoes03_m07_C`, `Shoes03_m08_C` | 138–169 | 4 | 1 | 14–19 |
| Sapatos femininos | Calçados | `F_Shoes01_m01_A`, `F_Shoes01_m02_A`, `F_Shoes01_m03_A`, `F_Shoes01_m04_A`, `F_Shoes01_m05_A`, `F_Shoes01_m06_A`, `F_Shoes01_m07_A`, `F_Shoes01_m08_A`, `F_Shoes01_m09_A`, `F_Shoes01_m10_A` | 140 | 4 | 0,4 | 26 |
| Botas macias | Calçados | `BootsKnee03_m02_C` | 144 | 4 | 2,7 | 24 |
| Botas do cortesão | Calçados | `BootsAnkle04_m03_A` | 166 | 4 | 2 | 37 |
| Sapatos pontudos | Calçados | `Shoes05_m01_B`, `Shoes05_m02_B`, `Shoes05_m03_B`, `Shoes05_m06_B`, `Shoes05_m08_B`, `Shoes05_mPainter` | 168–174 | 4 | 1 | 19–20 |

### Roupa excelente (190 a 470 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Capuz do ladrão | Cabeça | `Hood09_m03_C` | 195 | 4 | 0,7 | 9 |
| Gorro de ladrão | Cabeça | `Cap21_m01_C` | 197 | 4 | 0,5 | 15 |
| Chapéu de nobre | Cabeça | `Cap18_m01_A`, `Cap18_m02_A`, `Cap18_m03_A`, `Cap18_m04_A`, `Cap18_m05_A`, `Cap18_m06_A`, `Cap18_m07_A`, `Cap18_m08_A`, `Cap18_m09_A`, `Cap18_m10_A`, `Cap18_mMurderer` | 197–264 | 4 | 0,5 | 42–58 |
| Capuz do punguista | Cabeça | `Hood07_m02_C` | 201 | 4 | 0,7 | 15 |
| Capuz bordado | Cabeça | `Hood06_m01_B`, `Hood06_m02_B`, `Hood06_m03_B`, `Hood06_m06_B`, `Hood06_m07_B`, `Hood06_m08_B`, `Hood06_m09_B`, `Hood06_m10_B` | 208–229 | 4 | 0,7 | 21–23 |
| Capacete do cortesão | Cabeça | `Hood02_m09_C` | 215 | 4 | 0,7 | 14 |
| Capuz do Capon | Cabeça | `HoodHuntingCapon_m01` | 227 | 4 | 0,7 | 22 |
| Capuz do abade | Cabeça | `HoodAlbik_m01` | 227 | 4 | 0,7 | 22 |
| Capuz de burguês | Cabeça | `Hood05_m01_B`, `Hood05_m02_B`, `Hood05_m03_B`, `Hood05_m04_B`, `Hood05_m05_B`, `Hood05_m06_B`, `Hood05_m07_B`, `Hood05_m08_B` | 229–454 | 4 | 0,7 | 23–32 |
| Chaperon com broche | Cabeça | `Cap22_m01_A`, `Cap22_m02_A`, `Cap22_m03_A`, `Cap22_m04_A`, `Cap22_m05_A`, `Cap22_m06_A`, `Cap22_m07_A`, `Cap22_m08_A`, `Cap22_m09_A`, `Cap22_m10_A` | 231–310 | 4 | 0,5 | 50–69 |
| Capuz de nobre | Cabeça | `Hood12_m06_A` | 422 | 4 | 0,7 | 29 |
| Sobretudo de lorde | Tronco e vestidos | `Habit02_m03_C`, `Habit02_m04_C` | 193–241 | 4 | 2 | 26–29 |
| Cafetã com fecho | Tronco e vestidos | `Caftan03_m02_C1`, `Caftan03_m04_C1`, `Caftan03_m05_C1`, `Caftan03_m07_C1`, `Caftan03_m09_C1` | 196–243 | 4 | 13,6 | 21–28 |
| Casaco bordado | Tronco e vestidos | `Coat11_m01_C`, `Coat11_m03_C`, `Coat11_m04_C`, `Coat11_m06_C`, `Coat11_m07_C`, `Coat11_m09_C` | 203–344 | 4 | 2,9 | 18–31 |
| Casaco quente bordado | Tronco e vestidos | `Coat11_mKuttenberg01_C`, `Coat11_mKuttenberg_C` | 203 | 4 | 2,9 | 18 |
| Casaco acolchoado | Tronco e vestidos | `Coat07_m02_B`, `Coat07_m03_B`, `Coat07_m05_B` | 223 | 4 | 2,9 | 18 |
| Túnica de montaria | Tronco e vestidos | `Waffenrock08_m01_B`, `Waffenrock08_m02_B`, `Waffenrock08_m03_B`, `Waffenrock08_m04_B`, `Waffenrock08_m06_B`, `Waffenrock08_m07_B`, `Waffenrock08_m08_B`, `Waffenrock08_m09_B`, `Waffenrock08_m12_B`, `Waffenrock08_m13_B`, `Waffenrock08_m14_B`, `Waffenrock08_mBergov_B`, `Waffenrock08_mKuttenberg01_B`, `Waffenrock08_mKuttenberg02_B`, `Waffenrock08_mKuttenberg03_B`, `Waffenrock08_mKuttenberg_B`, `Waffenrock08_mPapal_B`, `Waffenrock08_mPisek_B`, `Waffenrock08_mSemin_B` | 226–245 | 4 | 2 | 26–28 |
| Túnica dos Cruzados da Estrela Vermelha | Tronco e vestidos | `Waffenrock08_mKrizovnik01_B`, `Waffenrock08_mKrizovnik02_B` | 226 | 4 | 2 | 26 |
| Túnica para cavaleiro | Tronco e vestidos | `Waffenrock09_m01_B`, `Waffenrock09_m02_B`, `Waffenrock09_m03_B`, `Waffenrock09_m04_B`, `Waffenrock09_m05_B`, `Waffenrock09_m06_B`, `Waffenrock09_mBergov_B`, `Waffenrock09_mDesert_B`, `Waffenrock09_mKuttenberg01_B`, `Waffenrock09_mKuttenberg02_B`, `Waffenrock09_mKuttenberg03_B`, `Waffenrock09_mKuttenberg04_B`, `Waffenrock09_mKuttenberg05_B`, `Waffenrock09_mKuttenberg_B`, `Waffenrock09_mLeipa_B`, `Waffenrock09_mNebak01_B`, `Waffenrock09_mNebak_B`, `Waffenrock09_mPisek_B`, `Waffenrock09_mSemin_B`, `Waffenrock09_mVavak_B` | 226–245 | 4 | 2 | 26–30 |
| Gibão do cortesão | Tronco e vestidos | `TunicShort04_m07_A` | 230 | 4 | 0,9 | 21 |
| Gibão de burguês | Tronco e vestidos | `TunicShort04_m06_A`, `TunicShort04_m08_A` | 235–318 | 4 | 1 | 29–40 |
| Cotehardie de mulher da nobreza | Tronco e vestidos | `F_Cotehardie01_m01_B`, `F_Cotehardie01_m02_B`, `F_Cotehardie01_m03_B`, `F_Cotehardie01_m04_B`, `F_Cotehardie01_m05_B`, `F_Cotehardie01_m07_B`, `F_Cotehardie01_m08_B`, `F_Cotehardie01_m09_B`, `F_Cotehardie01_m11_B`, `F_Cotehardie01_m13_B`, `F_Cotehardie03_m02_A`, `F_Cotehardie03_m03_A`, `F_Cotehardie03_m04_A`, `F_Cotehardie03_m05_A`, `F_Cotehardie03_m06_A`, `F_Cotehardie03_m07_A`, `F_Cotehardie03_m08_A`, `F_Cotehardie03_m10_A`, `F_Cotehardie03_m11_A`, `F_Cotehardie03_m13_A`, `F_Cotehardie03_m14_A`, `F_Cotehardie04_m03_B`, `F_Cotehardie04_m04_B`, `F_Cotehardie04_m11_B`, `F_Cotehardie04_m12_B`, `F_Cotehardie04_m13_B`, `F_Cotehardie04_m15_B` | 243–466 | 4 | 3 | 31–49 |
| Túnica dos Lordes de Garbow | Tronco e vestidos | `Waffenrock01_mZavis` | 243 | 4 | 2 | 28 |
| Túnica da forja do Henry | Tronco e vestidos | `Waffenrock09_mPros` | 245 | 4 | 2 | 29 |
| Túnica de montaria de Praga | Tronco e vestidos | `Waffenrock08_mPrague_B` | 245 | 4 | 2 | 28 |
| Túnica teutônica | Tronco e vestidos | `Waffenrock09_mTeuton` | 263 | 4 | 2 | 32 |
| Casaco de comerciante | Tronco e vestidos | `Coat12_m08_C` | 272 | 4 | 2,9 | 24 |
| Casaco de gracejo | Tronco e vestidos | `Coat13_m08_C`, `Coat13_m10_C` | 272 | 4 | 2,9 | 24 |
| Hábito clerical | Tronco e vestidos | `Habit03_m07_C`, `Habit04_m01_C`, `Habit04_mAbbot_C`, `Habit04_mHerbalist_C`, `Habit04_mLibrarian_C`, `Habit05_m01_C`, `Habit05_mCustodian_C`, `Habit05_mElias`, `Habit05_mInfirmarius_C`, `Habit05_mScribe_C` | 273 | 4 | 2 | 26–32 |
| Cafetã cumano | Tronco e vestidos | `Caftan01_m01_D1`, `Caftan01_m02_D1`, `Caftan01_m03_D1`, `Caftan01_m04_D1`, `Caftan01_m05_D1`, `Caftan01_m06_D1`, `Caftan01_m07_D1`, `Caftan01_m08_D1`, `Caftan01_m09_D1`, `Caftan01_m10_D1` | 278–295 | 4 | 14 | 11–14 |
| Casaco de burguês | Tronco e vestidos | `Coat01_m04_A`, `Coat01_m06_A`, `CoatInjuredAulitz` | 282–447 | 4 | 2,9 | 22–34 |
| Casaco justo | Tronco e vestidos | `Coat08_m03_A`, `Coat08_m05_A`, `Coat08_m09_A` | 282 | 4 | 2,9 | 22 |
| Túnica com fecho | Tronco e vestidos | `Waffenrock03_m01_A`, `Waffenrock03_m02_A`, `Waffenrock03_m03_A`, `Waffenrock03_m04_A`, `Waffenrock03_mKuttenberg01_A`, `Waffenrock03_mKuttenberg02_A`, `Waffenrock03_mKuttenberg03_A`, `Waffenrock03_mKuttenberg_A`, `Waffenrock03_mLeipa_A` | 310–335 | 4 | 2 | 30–32 |
| Túnica ornamentada | Tronco e vestidos | `Waffenrock04_m01_A`, `Waffenrock04_m02_A`, `Waffenrock04_m03_A`, `Waffenrock04_m04_A`, `Waffenrock04_m05_A`, `Waffenrock04_mBergov_A`, `Waffenrock04_mPapal_A` | 310–335 | 4 | 2 | 30–32 |
| Túnica de Praga com botões | Tronco e vestidos | `Waffenrock03_mPrague_A` | 335 | 4 | 2 | 32 |
| Casaco de ladrão | Tronco e vestidos | `Coat05_m06_C` | 336 | 4 | 2,7 | 13 |
| Túnica teutônica dividida | Tronco e vestidos | `Waffenrock04_mTeuton` | 364 | 4 | 2 | 39 |
| Veste de Senhor do Inferno | Tronco e vestidos | `WaffenrockScaring_m01` | 364 | 4 | 2 | 34 |
| Casaco do cortesão | Tronco e vestidos | `Coat08_m02_A` | 441 | 4 | 2,7 | 20 |
| Calças do ladrão | Calças | `HoseJoined01_m10_C` | 206 | 4 | 0,5 | 18 |
| Calça com ligas | Calças | `HoseJoined02_m07_B`, `HoseJoined02_m08_B`, `HoseJoined02_m13_B`, `HoseJoined02_m14_B`, `HoseJoined02_m17_B`, `HoseJoined02_m19_B`, `HoseJoined02_m20_B` | 212 | 4 | 0,5 | 32 |
| Meias do cortesão | Calças | `HoseJoined02_m12_B` | 228 | 4 | 0,5 | 24 |
| Botas de nobre | Calçados | `BootsKnee01_m02_C`, `BootsKnee01_m03_C`, `BootsKnee01_m04_C`, `BootsKnee01_m05_C`, `BootsKnee01_m06_C` | 195–218 | 4 | 3 | 37–40 |
| Sapatos de burguês | Calçados | `BootsKnee02_m03_B`, `BootsKnee02_m04_B`, `BootsKnee02_m06_B`, `Shoes02_m01_B`, `Shoes02_m03_B`, `Shoes02_m05_B`, `Shoes02_m07_B` | 195–209 | 4 | 1–3 | 23–36 |
| Sapatos pontudos | Calçados | `Shoes05_m04_B`, `Shoes05_m05_B`, `Shoes05_m07_B` | 209 | 4 | 1 | 25 |
| Sapatos de ladrão | Calçados | `Shoes03_m03_C` | 315 | 4 | 0,9 | 17 |
| Sapatos do legado | Calçados | `Shoes03_mLegate` | 455 | 4 | 1 | 58 |

### Roupa nobre (acima de 470 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Capuz de nobre | Cabeça | `Hood12_m01_A`, `Hood12_m02_A`, `Hood12_m03_A`, `Hood12_m04_A`, `Hood12_m05_A`, `Hood12_m07_A`, `Hood12_m08_A`, `Hood12_m09_A`, `Hood12_m10_A` | 476–571 | 4 | 0,7 | 33–39 |
| Capuz de brocado | Cabeça | `Hood03_m01_A`, `Hood03_m02_A`, `Hood03_m03_A`, `Hood03_m04_A`, `Hood03_m05_A`, `Hood03_m06_A`, `Hood03_m07_A`, `Hood03_m08_A`, `Hood03_m09_A`, `Hood03_m10_A` | 497–579 | 4 | 0,7 | 34–40 |
| Chaperon de Istvan | Cabeça | `CapIstvan_m01_poi` | 559 | 4 | 1,9 | 15 |
| Casaco de burguês | Tronco e vestidos | `Coat01_m01_A`, `Coat01_m02_A`, `Coat01_m03_A`, `Coat01_m05_A`, `Coat01_m07_A`, `Coat01_m08_A`, `Coat01_m09_A`, `Coat01_m10_A`, `CoatZachary_m01` | 510 | 4 | 2,9 | 40 |
| Casaco de patrono | Tronco e vestidos | `Coat15_mPros` | 510 | 4 | 2,9 | 40 |
| Casaco justo | Tronco e vestidos | `Coat08_m01_A`, `Coat08_m04_A`, `Coat08_m06_A`, `Coat08_m07_A`, `Coat08_m08_A`, `Coat08_m10_A` | 510 | 4 | 2,9 | 40 |
| Cotehardie de brocado do Tirol | Tronco e vestidos | `pracharna_concubineDress` | 534 | 4 | 5 | 0 |
| Cotehardie de mulher da nobreza | Tronco e vestidos | `F_Cotehardie01_m06_B`, `F_Cotehardie03_m01_A`, `F_Cotehardie03_m09_A`, `F_Cotehardie03_m12_A` | 600–728 | 4 | 3 | 52–64 |
| Cafetã luxuoso | Tronco e vestidos | `Caftan02_m01_A2`, `Caftan02_m02_A2`, `Caftan02_m03_A2`, `Caftan02_m04_A2`, `Caftan02_m05_A2`, `Caftan02_m06_A2`, `Caftan02_m07_A2`, `Caftan02_m08_A2`, `Caftan02_m09_A2`, `Caftan02_m10_A2` | 665–786 | 4 | 14,4 | 16–34 |
| Casaco de caça | Tronco e vestidos | `sedmStatecnych_ZizkaCoat` | 675 | 4 | 10 | 14 |
| Cafetã de montaria | Tronco e vestidos | `Caftan04_m01_D2`, `Caftan04_m02_D2`, `Caftan04_m03_D2`, `Caftan04_m04_D2`, `Caftan04_m05_D2`, `Caftan04_m06_D2`, `Caftan04_m07_D2`, `Caftan04_m08_D2`, `Caftan04_m09_D2`, `Caftan04_m10_D2` | 702–714 | 4 | 14,6 | 9–10 |
| Cafetã acolchoado | Tronco e vestidos | `Caftan05_m01_D3`, `Caftan05_m02_D3`, `Caftan05_m04_D3`, `Caftan05_m05_D3`, `Caftan05_m06_D3`, `Caftan05_m07_D3`, `Caftan05_m08_D3`, `Caftan05_m09_D3`, `Caftan05_m10_D3`, `Caftan05_m11_D3`, `Caftan05_m12_D3` | 1.257–1.270 | 4 | 15,2 | 9–10 |
| Cafetã acolchoado: preto | Tronco e vestidos | `Caftan05_m03_D3` | 1.275 | 4 | 13,4 | 10 |

### Roupa única (itens únicos, de missão e de recompensa)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Capuz de afogador | Cabeça | `Hood08_mdrowner` | 4,9 | 4 | 0,7 | 3 |
| Chapéu do Ovo Choco | Cabeça | `taboryKutnohorsko_pukavecCap` | 7,6 | 4 | 0,5 | 7 |
| Coroa enfeitada | Cabeça | `WreathTwitch_m01` | 8,2 | 4 | 0,5 | 29 |
| Chapéu de palha inesperado | Cabeça | `ztratyANalezy_strawHat` | 12 | 4 | 0,5 | 13 |
| Gorro de Nebakov | Cabeça | `nebakovPruzkum_Cap21_m01_C_nebakClue` | 22,5 | 4 | 0,5 | 9 |
| Cachecol da Marina | Cabeça | `kocovnickaCest_marikasScarf` | 36,2 | 4 | 0,2 | 12 |
| Chapéu de garçom real | Cabeça | `setkaniVRatbori1_cupbearerCap` | 43,3 | 4 | 0,5 | 13 |
| Chapéu silesiano | Cabeça | `Cap21_mGodwin`, `Cap21_mOderin_C` | 43,3–56,1 | 4 | 0,5 | 13–16 |
| Chapéu do Charlie | Cabeça | `Cap24_mKarlik` | 64,2 | 4 | 0,5 | 16 |
| Chapéu do Charlie Bonitão | Cabeça | `taboryTrosecko_karlikCap` | 64,2 | 4 | 0,5 | 16 |
| Chapéu do camareiro Ulrich | Cabeça | `CapChamberlain_flipped_m01`, `CapChamberlain_m01` | 64,2–96,6 | 3–4 | 0,5–4,5 | 29–30 |
| Chapéu do Mestre Corvo | Cabeça | `Kafka_Cap33_m06_B` | 69 | 4 | 0,5 | 18 |
| Chaperon do Lorde Toth | Cabeça | `Cap07_mIstvan_A` | 81,2 | 4 | 0,5 | 21 |
| Gorro do Mikush | Cabeça | `Cap10_mMikus_B` | 81,2 | 4 | 0,5 | 21 |
| Chapéu do legado | Cabeça | `CapLegate_m01` | 86 | 4 | 0,5 | 29 |
| Chapéu de Santo Humberto | Cabeça | `Cap35_m01_B` | 99,1 | 4 | 0,5 | 27 |
| Capuz de servo | Cabeça | `Hood11_mDvojityAgentJan_C` | 122 | 4 | 0,7 | 13 |
| Capuz bordado | Cabeça | `Hood06_mIstvan`, `Hood06_mRadzig` | 168–256 | 4 | 0,7–6,1 | 16 |
| Capuz do mestre-caçador | Cabeça | `Hood13_m01_B` | 168 | 4 | 0,7 | 16 |
| Capuz do ladrão | Cabeça | `Hood01_mTwitch_D` | 175 | 4 | 0,7 | 13 |
| Capuz de Sigismundo | Cabeça | `HoodSigismund_m01` | 227 | 4 | 0,7 | 22 |
| Capuz de rabino | Cabeça | `HoodRabi_m01` | 227 | 4 | 0,7 | 22 |
| Capuz do Capon | Cabeça | `HoodCapon_m01` | 227 | 4 | 0,7 | 22 |
| Capuz do Semine | Cabeça | `HoodSemin_m01` | 227 | 4 | 0,7 | 22 |
| Capuz do abade | Cabeça | `HoodAbbot_m01` | 227 | 4 | 0,7 | 22 |
| Capuz do legado | Cabeça | `HoodLegate_m01` | 227 | 4 | 0,7 | 22 |
| Capuz preto | Cabeça | `HoodGodwin_m01`, `HoodGodwin_mNoBags` | 227 | 4 | 0,7 | 22 |
| Capuz de brocado | Cabeça | `Hood03_mPisek_A` | 497 | 4 | 0,7 | 34 |
| Cafetã luxuoso | Tronco e vestidos | `Caftan02_mCherthanBlood_A2`, `Caftan02_mCherthan_A2` | 0–767 | 3–4 | 0,5–14,4 | 4–31 |
| Casaco de burguês | Tronco e vestidos | `CoatBergov_m01`, `CoatBergov_mCaptured`, `CoatBrabant_m01`, `CoatHans_m01`, `CoatHanush_m01`, `CoatJobstPoncho_m01`, `CoatJobst_m01_A`, `CoatMusa_m01`, `CoatOderin_m01`, `CoatOderin_mArmor`, `CoatOderin_mNoDagger`, `CoatRuthard_m01`, `CoatRuthard_mArmor`, `CoatSigismund_m01`, `CoatVavak_m01`, `CoatZizkaSword_m01`, `CoatZizkaSwordless_m01` | 0–719 | 3–4 | 1–3 | 5–22 |
| Túnica de bêbado | Tronco e vestidos | `ztratyANalezy_tunic` | 24 | 3 | 1 | 14 |
| Avental de couro | Tronco e vestidos | `TunicShort05_mFather`, `TunicShort05_mFather_cutscene` | 34,9 | 4 | 1 | 8 |
| Sobretudo | Tronco e vestidos | `F_Surcote01_mBlanka_C` | 63,7 | 4 | 3 | 20 |
| Hábito clerical | Tronco e vestidos | `Habit02_mChamberlain_C`, `HabitRabi_m01` | 81,4–140 | 4 | 2 | 15–21 |
| Túnica do legado | Tronco e vestidos | `HabitLegate_m01`, `TunicShortLegate_m01`, `TunicShortLegate_m01_NoHat` | 81,4–318 | 4 | 1–2 | 15–40 |
| Vestido da Katherine | Tronco e vestidos | `F_SimpleDressKatherine_m01`, `F_SimpleDressKatherine_m02`, `F_SimpleDressKatherine_m03` | 83,1 | 4 | 2,5 | 20 |
| Vestido da Rosa | Tronco e vestidos | `F_SimpleDressRose_m01` | 83,1 | 4 | 2,5 | 20 |
| Casaco de garçom real | Tronco e vestidos | `setkaniVRatbori1_cupbearerCoat` | 129 | 4 | 2,9 | 10 |
| Casaco bordado | Tronco e vestidos | `Coat11_mBergov_C` | 188 | 4 | 2,9 | 16 |
| Casaco de Nimrod | Tronco e vestidos | `Coat14_m01_B` | 238 | 4 | 3 | 18 |
| Túnica para cavalo de guerra | Tronco e vestidos | `Waffenrock01_mTwitch` | 246 | 4 | 2 | 28 |
| Cotehardie de mulher da nobreza | Tronco e vestidos | `F_Cotehardie04_mAnna`, `F_Cotehardie04_mBridal` | 254–728 | 4 | 3 | 29–62 |
| Casaco justo | Tronco e vestidos | `Coat08_mPisek_A` | 510 | 4 | 2,9 | 40 |
| Calças perdidas | Calças | `ztratyANalezy_hose` | 18 | 3 | 0,5 | 14 |
| Calças de duende da água | Calças | `poi_vodnik_vodnikovyKalhoty` | 24,8 | 4 | 0,5 | 5 |
| Calças do afogado | Calças | `HoseJoined01_mdrowner` | 24,8 | 4 | 0,5 | 5 |
| Calças largas | Calças | `HoseLooseMusa_m01` | 42,2 | 4 | 0,5 | 12 |
| Calça com ligas | Calças | `HoseJoined02_mBergovCaptured`, `HoseJoined02_mJobst_B`, `HoseJoined02_mKomar`, `HoseJoinedCapon_m01`, `HoseJoinedDevil_m01`, `HoseJoinedSigismund_m01` | 62,4–175 | 4 | 0,5 | 10–24 |
| Calças de garçom real | Calças | `setkaniVRatbori1_cupbearerPants` | 100 | 4 | 0,5 | 15 |
| Calças simples de trovador | Calças | `HoseSeparate01_mBrabant`, `HoseSeparate01_mHanush` | 146 | 4 | 0,5 | 21 |
| Calças do ladrão | Calças | `HoseJoined02_mTwitch_B` | 184 | 4 | 0,5 | 18 |
| Calças do legado | Calças | `HoseJoined02_mLegate` | 410 | 4 | 0,5 | 58 |
| Sapatos de bêbado | Calçados | `ztratyANalezy_shoes` | 17 | 3 | 1 | 14 |
| Botas para cavalo de guerra | Calçados | `BootsAnkle03_mTwitch` | 53,9 | 4 | 2 | 19 |
| Sapatos femininos comuns | Calçados | `F_ShoesKatherine_m01` | 61,2 | 4 | 0,4 | 20 |
| Sapatos simples | Calçados | `Shoes01_mCapon`, `Shoes01_mDevil_D` | 119–168 | 4 | 1 | 11–19 |
| Sapatos de burguês | Calçados | `BootsKnee02_mLichtenstein`, `Shoes02_mJobst_B` | 124–188 | 4 | 1–3 | 22–26 |
| Sapatos finos do sapateiro Vejmola | Calçados | `spravedlnost_boots` | 138 | 4 | 1 | 14 |
| Botas do mestre-caçador | Calçados | `BootsKnee06_m01_B` | 180 | 4 | 3 | 32 |
| Botas de equitação | Calçados | `BootsKnee03_mHanush` | 190 | 4 | 3 | 33 |
| Sapatos do ladrão | Calçados | `Shoes01_mTwitch_D` | 220 | 4 | 0,9 | 11 |

## 3. Armas

### Armas

#### Arma básica (até 340 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Espada de caça caseira | Espadas | `shortswordCleaver` | 49,6 | 4 | 2,9 | 80 | 75 | 4 |
| Espada de caça | Espadas | `huntingSwordBasic` | 82,2 | 4 | 2,9 | 82 | 80 | 4 |
| Espada do torneio | Espadas | `shortswordCommon_khTournament` | 82,7 | 4 | 3,3 | 92 | 180 | 5 |
| Espada de caça de burguês | Espadas | `huntingSwordGuard` | 214 | 4 | 2,6 | 91 | 103 | 6 |
| Montante de torneio | Espadas | `longSwordDuel_khTournament` | 243 | 4 | 4,1 | 115 | 272 | 10 |
| Montante do cavaleiro | Espadas | `longswordOld` | 331 | 4 | 4,4 | 109 | 168 | 10 |
| Defensora do ferreiro | Espadas | `kovaniNaKovarne_smithsDefense` | 336 | 4 | 2,4 | 99 | 126 | 7 |
| Espada de caça de competição | Espadas | `kovaniKovarskaSoutez_huntingKnifeApprentice` | 336 | 4 | 2,4 | 99 | 126 | 7 |
| Espada de competição | Espadas | `kovaniKovarskaSoutez_huntingKnifeForContest` | 336 | 4 | 2,4 | 99 | 126 | 7 |
| Shashka cumana | Espadas | `huntingSwordSashka` | 336 | 4 | 2,2 | 99 | 126 | 7 |
| Adaga antiga | Adagas | `daggerAncient` | 20 | 1 | 1 | 22 | 0 | 0 |
| Adaga | Adagas | `daggerCommon` | 23 | 1 | 1 | 30 | 0 | 0 |
| Adaga de Denes | Adagas | `nalezeniDelnici_denesDagger` | 23 | 1 | 1 | 30 | 0 | 0 |
| Adaga de rodelas | Adagas | `svatyne_dagger` | 250 | 1 | 1 | 30 | 0 | 0 |
| Porrete | Maças e martelos | `maceClub` | 8,2 | 4 | 2 | 75 | 56 | 5 |
| Porrete do Rugado | Maças e martelos | `zbranePanaSemina_sukClub` | 74,5 | 4 | 2,1 | 75 | 56 | 5 |
| Clava com pontas | Maças e martelos | `maceClubSpiked` | 291 | 4 | 2,4 | 84 | 66 | 7 |
| Machado de lenhador | Machados | `axeWork01` | 24,8 | 4 | 4,6 | 86 | 74 | 6 |
| Machado do Kolda | Machados | `naTroskach_axeKolda` | 49,8 | 4 | 4,6 | 86 | 74 | 6 |
| Machado de carpintaria | Machados | `axeWork02` | 216 | 4 | 6 | 92 | 80 | 9 |
| Forquilha do fazendeiro Matthew | Armas de haste | `polearmPitchforkSedlakaMateje` | 3 | 4 | 11,4 | 70 | 109 | 10 |
| Bastão | Armas de haste | `polearmTraining` | 3,2 | 1 | 4 | 10 | 25 | 2 |
| Estandarte de Santo Antônio | Armas de haste | `sesivaniTonici_svancara` | 8,2 | 4 | 11,4 | 95 | 152 | 7 |
| Forcado | Armas de haste | `polearmPitchfork` | 62,4 | 4 | 11,4 | 95 | 152 | 7 |
| Podão | Armas de haste | `polearmSpear` | 279 | 4 | 10,8 | 113 | 168 | 11 |
| Arco de corniso do vilarejo | Arcos | `bow_b_a` | 200 | 4 | 2 | 0 | 10 | 1 |
| Arco de nogueira do vilarejo | Arcos | `bow_b`, `bow_b_empty` | 200 | 4 | 2 | 0 | 10 | 1 |
| Balestra de caça antiga | Bestas | `crossbowLightCheap01` | 320 | 4 | 3 | 0 | 10 | 1 |
| Tocha | Tochas | `rutinaAVypad_trackview_torch_weapon` | 6 | 1 | 1 | 20 | 5 | 1 |

#### Arma comum (340 a 1.100 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Espada militar | Espadas | `shortswordCommon` | 367 | 4 | 3,2 | 94 | 127 | 6 |
| Alfange | Espadas | `huntingSwordFalchion` | 486 | 4 | 2,9 | 107 | 149 | 10 |
| Excalibosta | Espadas | `kovarskeZakazky_fejxcalibur` | 486 | 4 | 4,4 | 109 | 168 | 11 |
| Merderendal | Espadas | `kovarskeZakazky_durensral` | 486 | 4 | 2 | 109 | 168 | 11 |
| Espada de concha | Espadas | `huntingSwordMussle` | 583 | 4 | 1,9 | 115 | 172 | 10 |
| Espada de caça de nobre | Espadas | `huntingSwordSword` | 705 | 4 | 1,6 | 124 | 195 | 11 |
| Sabre comum | Espadas | `sabreCommon` | 773 | 4 | 3,5 | 111 | 161 | 9 |
| Oportunidade | Espadas | `shortswordBrabant` | 963 | 4 | 2,2 | 110 | 145 | 13 |
| Montante antigo | Espadas | `oblehaniSuchdole_oldSword` | 1.075 | 4 | 4 | 117 | 189 | 12 |
| Marotte do Jimbo | Maças e martelos | `balatro_jimboMace` | 365 | 4 | 3 | 81 | 76 | 9 |
| Martelo de guerra comum | Maças e martelos | `warhammer01` | 447 | 4 | 5,6 | 104 | 74 | 6 |
| Maça leve | Maças e martelos | `mace01` | 574 | 4 | 3 | 93 | 76 | 9 |
| Maça do Zizka | Maças e martelos | `maceZizka` | 868 | 4 | 3,5 | 102 | 86 | 11 |
| Maça do torneio | Maças e martelos | `tournament_maceHerald` | 898 | 4 | 3,5 | 102 | 86 | 11 |
| Martelo de guerra do cavaleiro montado | Maças e martelos | `warhammer02` | 918 | 4 | 6,3 | 114 | 94 | 9 |
| Maça de adaga | Maças e martelos | `maceDagger` | 942 | 4 | 3,5 | 102 | 86 | 13 |
| Maça buchar | Maças e martelos | `maceBuchar` | 980 | 4 | 3,7 | 110 | 95 | 15 |
| Machado farpado | Machados | `axeBattle01` | 485 | 4 | 5,3 | 105 | 94 | 9 |
| Machado decorado | Machados | `kovaniPoklad_adornedAxe` | 700 | 4 | 5,7 | 114 | 104 | 11 |
| Machado do açougueiro Raborsch | Machados | `poi_ratborschButcherAxe` | 904 | 4 | 9,4 | 124 | 114 | 16 |
| Machado de Skalitz | Machados | `axeWork02_kunesh` | 914 | 4 | 6 | 124 | 114 | 12 |
| Machado largo | Machados | `axeBattle02` | 1.073 | 4 | 8,7 | 124 | 114 | 16 |
| Glaive | Armas de haste | `polearmGlaive` | 354 | 4 | 10,8 | 113 | 168 | 11 |
| Bardiche | Armas de haste | `polearmBardiche` | 649 | 4 | 10,2 | 131 | 184 | 15 |
| Venábulo | Armas de haste | `polearmVoulge` | 649 | 4 | 10,2 | 131 | 184 | 15 |
| Morgenstern | Armas de haste | `polearmMorgenstern` | 828 | 4 | 9,6 | 149 | 200 | 18 |
| Alabarda do Ramalhete | Armas de haste | `bratriZCimburka_balsanHalberd` | 828 | 4 | 9,9 | 139 | 192 | 16 |
| Bisarma | Armas de haste | `polearmGuisarm` | 1.013 | 4 | 9,6 | 149 | 200 | 18 |
| Arco de ulmeiro do vilarejo | Arcos | `bow_b_b`, `bow_b_b_empty` | 488 | 4 | 2 | 0 | 10 | 4 |
| Arco cumano usado | Arcos | `cuman_bow_b` | 631 | 4 | 3 | 0 | 10 | 2 |
| Arco de freixo do vilarejo | Arcos | `bow_e_a` | 631 | 4 | 3 | 0 | 10 | 5 |
| Arco de caça de corniso | Arcos | `bow_c_b` | 775 | 4 | 3 | 0 | 10 | 6 |
| Arco de caça de ulmeiro | Arcos | `bow_c_c` | 775 | 4 | 3 | 0 | 10 | 6 |
| Arco longo de nogueira | Arcos | `bow_a`, `bow_a_empty` | 775 | 4 | 3 | 0 | 10 | 6 |
| Balestra de caça | Bestas | `crossbowLightNormal01` | 418 | 4 | 3 | 0 | 10 | 1 |
| Balestra de campo antiga | Bestas | `crossbowMediumCheap01` | 600 | 4 | 3 | 0 | 10 | 1 |
| Balestra de Pasha | Bestas | `magickySip_pechCrossbow` | 614 | 3 | 2 | 0 | 10 | 1 |
| Balestra de campo | Bestas | `crossbowMediumNormal01` | 848 | 4 | 3 | 0 | 10 | 5 |

#### Arma boa (1.100 a 2.500 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Montante comum | Espadas | `longswordCommon`, `longswordZizka_duel` | 1.103–1.239 | 1–4 | 3,6–3,9 | 109–120 | 194–207 | 12–14 |
| Espada de caça de Emmeram | Espadas | `sermiry_huntingSwordJimram` | 1.138 | 4 | 2,7 | 132 | 218 | 16 |
| Espada de Boleslav Bavor | Espadas | `artefakt_shortswordBavor` | 1.253 | 4 | 3,3 | 111 | 209 | 16 |
| Montante de Godwin | Espadas | `longswordBohuta` | 1.349 | 1 | 3,4 | 113 | 220 | 15 |
| Machado presa de dragão | Espadas | `kovarskeZakazky_dragonAxe` | 1.444 | 4 | 6,7 | 138 | 134 | 17 |
| Espada do Pieschel | Espadas | `kovaniNaKovarne_pajslSword` | 1.567 | 4 | 2,4 | 122 | 192 | 12 |
| Mandoble | Espadas | `shortswordBroad` | 1.567 | 4 | 2,4 | 122 | 192 | 12 |
| Espada reforjada de Boleslav Bavor | Espadas | `artefakt_shortswordBavor_reforged` | 1.793 | 4 | 3,2 | 117 | 225 | 18 |
| Baselarda | Espadas | `shortSwordBasilard` | 1.866 | 4 | 1,9 | 128 | 209 | 13 |
| Espada de São Jorge | Espadas | `shortSwordStGeorge` | 1.866 | 4 | 2,8 | 136 | 278 | 15 |
| Montante do Diabo Seco. | Espadas | `longswordDevil`, `longswordDevil_empty` | 2.047–2.472 | 4 | 3,1–3,4 | 130–136 | 220–233 | 14–15 |
| Montante do Henry | Espadas | `longswordHenry` | 2.047 | 4 | 3,4 | 130 | 220 | 14 |
| Montante do Lorde Capon | Espadas | `longswordCapon` | 2.047 | 4 | 3,4 | 130 | 220 | 14 |
| Montante do Radzig Kobyla | Espadas | `longswordIstvan` | 2.047 | 4 | 3,4 | 130 | 220 | 14 |
| Espada de nobre | Espadas | `shortswordCeremony` | 2.078 | 4 | 2 | 135 | 225 | 14 |
| Montante de guerra | Espadas | `longswordSturdy` | 2.400 | 4 | 4,5 | 130 | 220 | 16 |
| Montante "Absolvedora" | Espadas | `kovaniKopie_longSwordAbsolver` | 2.451 | 4 | 3,1 | 136 | 233 | 15 |
| Réplica da espada "Absolvedora" | Espadas | `kovaniKopie_penitent` | 2.451 | 4 | 2,8 | 136 | 233 | 15 |
| Maça comum | Maças e martelos | `mace02` | 1.139 | 4 | 3,9 | 111 | 96 | 14 |
| Maça do meirinho | Maças e martelos | `maceBailiff` | 1.140 | 4 | 3,9 | 111 | 96 | 14 |
| Maça pesada | Maças e martelos | `maceHeavy` | 1.325 | 4 | 6,8 | 111 | 96 | 18 |
| Maça com flange | Maças e martelos | `mace03` | 1.419 | 4 | 4,4 | 120 | 106 | 16 |
| Martelo de guerra do cavaleiro | Maças e martelos | `warhammer03` | 1.428 | 4 | 7 | 124 | 114 | 13 |
| Martelo de guerra | Maças e martelos | `warhammerStab` | 1.482 | 4 | 7 | 124 | 114 | 14 |
| Maça de capitão | Maças e martelos | `maceHetman` | 1.726 | 4 | 4,8 | 129 | 116 | 18 |
| Martelo Matatrolls | Maças e martelos | `warhammer03_trollslayer` | 1.854 | 4 | 10,3 | 129 | 124 | 20 |
| Fokos cumano | Machados | `axeCuman` | 1.121 | 4 | 5,9 | 134 | 124 | 14 |
| Machado do carrasco | Machados | `axeFancy` | 1.427 | 4 | 6,7 | 143 | 134 | 15 |
| Machado Calvaria | Machados | `axeCalvaria` | 1.527 | 4 | 5,8 | 140 | 134 | 17 |
| Picareta do cavaleiro | Machados | `axeBattle03` | 2.218 | 4 | 7,5 | 161 | 155 | 18 |
| Machado do cavaleiro | Machados | `axeBattle04` | 2.483 | 4 | 7,5 | 161 | 155 | 20 |
| Acha | Armas de haste | `polearmPoleaxe` | 1.656 | 4 | 9 | 166 | 216 | 22 |
| Arco cumano dobrado | Arcos | `cuman_bow_a_b` | 1.350 | 4 | 3 | 0 | 10 | 9 |
| Arco de caça de teixo | Arcos | `bow_e` | 1.350 | 4 | 3 | 0 | 10 | 12 |
| Arco de salteador | Arcos | `prepadeni_banditBow` | 1.350 | 4 | 4 | 0 | 10 | 12 |
| Arco cumano ornamentado | Arcos | `cuman_bow_a` | 1.494 | 4 | 3 | 0 | 10 | 10 |
| Arco de caça de freixo | Arcos | `bow_c` | 1.494 | 4 | 3 | 0 | 10 | 13 |
| Arco de caçador clandestino | Arcos | `poi_skrysStarehoPytlaka_poachersBow` | 1.638 | 4 | 3 | 0 | 10 | 14 |
| Arco de caça de Hans Capon | Arcos | `zachranaPtacka_caponRewardBow` | 1.781 | 4 | 3 | 0 | 10 | 18 |
| Arco do chefe cumano | Arcos | `cuman_bow_a_a` | 1.781 | 4 | 3 | 0 | 10 | 12 |
| Arco do Ranyek | Arcos | `sedmStatecnych2_raneksBow` | 2.069 | 4 | 4 | 0 | 10 | 17 |
| Arco longo de ulmeiro | Arcos | `bow_d` | 2.069 | 4 | 4 | 0 | 10 | 19 |
| Balestra pesada reforçada | Bestas | `crossbowHeavyNormal01` | 2.047 | 4 | 3 | 0 | 10 | 1 |
| Balestra de caça ornamentada | Bestas | `crossbowLightFancy01` | 2.150 | 4 | 3 | 0 | 10 | 1 |
| Balestra do minerador | Bestas | `havirskyTurnajMediumCrossbow` | 2.162 | 4 | 3 | 0 | 10 | 5 |
| Balestra pesada | Bestas | `crossbowHeavyCheap01` | 2.317 | 4 | 3 | 0 | 10 | 1 |
| Balestra de campo decorada | Bestas | `crossbowMediumFancy01` | 2.446 | 4 | 3 | 0 | 10 | 7 |
| Bombarda de mão | Armas de fogo | `handgonneNormal01` | 2.175 | 4 | 6 | 0 | 10 | 1 |

#### Arma excelente (2.500 a 3.200 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Montante de duelo | Espadas | `longSwordDuel_empty` | 2.626 | 4 | 2,7 | 114 | 122 | 21 |
| Montante do Diabo Seco. | Espadas | `longswordDevil_duel` | 2.641 | 4 | 3,1 | 136 | 233 | 16 |
| Sabre de ataman | Espadas | `sabreNoble` | 2.690 | 4 | 2,2 | 137 | 242 | 18 |
| Espada de Markvart von Aulitz | Espadas | `stealthMiseZaJindru_aulitzSword` | 2.692 | 4 | 4,9 | 143 | 252 | 17 |
| Espada do Lorde von Bergow | Espadas | `shortswordBergov` | 2.709 | 4 | 2 | 135 | 225 | 14 |
| Montante de Kuttenberg | Espadas | `tournament_kuttenbergSword` | 2.854 | 4 | 2,9 | 141 | 246 | 16 |
| Montante largo | Espadas | `longswordBroad` | 2.854 | 4 | 2,9 | 141 | 246 | 16 |
| Sabre Garra da Coruja | Espadas | `duels_blackKnightSabre` | 2.959 | 4 | 2,5 | 151 | 275 | 20 |
| Espada do cavaleiro | Espadas | `shortswordHeavy` | 3.047 | 4 | 3,2 | 135 | 225 | 18 |
| Espada do Sir Valentine | Espadas | `kovaniRelikvie_shortSwordKnightValentin` | 3.081 | 4 | 1,8 | 142 | 242 | 15 |
| Espada do Peter de Suchotlesky | Espadas | `dvojityAgent_petrsShortSword` | 3.104 | 4 | 1,8 | 142 | 242 | 15 |
| Martelo de guerra basilisco | Maças e martelos | `warhammerBasilisc` | 2.550 | 4 | 7,2 | 134 | 125 | 18 |
| Bico de corvo | Maças e martelos | `warhammerRaven` | 2.622 | 4 | 7,7 | 134 | 134 | 18 |
| Martelo de cabeça de carneiro | Maças e martelos | `hromovyKamen_ramsHead` | 2.653 | 4 | 11,1 | 134 | 134 | 22 |
| Martelo de guerra luxuoso | Maças e martelos | `warhammer04` | 2.897 | 4 | 7,7 | 144 | 155 | 19 |
| Maça ornamentada | Maças e martelos | `mace04` | 3.104 | 4 | 5,3 | 138 | 126 | 20 |
| Arco longo de freixo | Arcos | `bow_d_a` | 2.500 | 4 | 4 | 0 | 10 | 22 |
| Arcabuz | Armas de fogo | `hookgunNormal01` | 2.587 | 4 | 6 | 0 | 10 | 1 |
| Bombarda de mão do mestre | Armas de fogo | `handgunFancy01` | 2.780 | 4 | 11 | 0 | 10 | 1 |
| Arma de gancho do atirador | Armas de fogo | `hookgunFancy01` | 3.079 | 4 | 12 | 0 | 10 | 1 |

#### Arma nobre (acima de 3.200 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Kilij Rugido do Leão | Espadas | `sabreLionHead` | 3.205 | 4 | 2,8 | 137 | 242 | 18 |
| Montante da guilda dos ferreiros | Espadas | `uchazec_guildSword` | 3.218 | 4 | 2,4 | 143 | 252 | 17 |
| Montante dos Quatro Evangelistas | Espadas | `longswordevangelists` | 3.311 | 4 | 3,5 | 153 | 235 | 18 |
| Montante dos Quatro Profetas | Espadas | `kovarskeZakazky_4evangeliste` | 3.311 | 4 | 3,5 | 153 | 235 | 18 |
| Montante de duelo | Espadas | `longSwordDuel` | 3.662 | 4 | 1,9 | 151 | 272 | 18 |
| Montante do Mestre Menhard | Espadas | `sermiry_longSwordMenhart` | 5.057 | 4 | 2,1 | 157 | 285 | 19 |
| Montante do louco | Espadas | `pomatenec_longsword` | 5.083 | 4 | 2,1 | 157 | 285 | 19 |
| Montante lingua belli | Espadas | `longSwordLilium` | 5.204 | 4 | 3,6 | 155 | 275 | 18 |
| Espada reforjada do Henry | Espadas | `longswordHenry_reforged` | 5.588 | 4 | 1,9 | 161 | 299 | 20 |
| Empurrador de Pushko | Armas de fogo | `hookgunPushek` | 3.587 | 4 | 9 | 0 | 10 | 1 |

#### Arma única (itens únicos, de missão e de recompensa)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Sabre de Rikonaris | Espadas | `kovaniVajdovaKletba_botchedRikonaris`, `kovaniVajdovaKletba_rikonaris` | 82,7–1.462 | 4 | 2,9–4,2 | 98–124 | 120–201 | 5–14 |
| Espada antiga enferrujada | Espadas | `nemcuvPoklad_bejkovecShortSwordRusty` | 367 | 4 | 3,2 | 94 | 127 | 6 |
| Espada de caça do Samuel | Espadas | `stealthMiseZaJindru_samHuntingKnife` | 460 | 4 | 2,1 | 107 | 149 | 8 |
| Espada de aço de Toledo | Espadas | `poustevnik_seminLongSword` | 1.239 | 4 | 3,9 | 120 | 194 | 12 |
| Montante do Radzig Kobyla | Espadas | `longswordRadzig` | 2.047 | 4 | 3,4 | 130 | 220 | 14 |
| Espada do carrasco | Espadas | `kovaniKatuvSleh_longSwordExecutioner` | 2.472 | 4 | 4,4 | 136 | 233 | 17 |
| Espada do Ramalhete | Espadas | `bratriZCimburka_balsanSword` | 2.709 | 4 | 2 | 135 | 225 | 14 |
| Espada do Hanush | Espadas | `finale_hanusLongsword` | 2.854 | 4 | 2,9 | 141 | 246 | 16 |
| Montante da irmandade | Espadas | `sermiry_longSwordGuild` | 3.101 | 4 | 2,6 | 146 | 259 | 17 |
| Montante da guilda dos ferreiros | Espadas | `uchazec_guildSwordQuest` | 3.218 | 4 | 2,4 | 143 | 252 | 17 |
| Montante da Irmandade | Espadas | `kovaniSymbolSermirny_longSwordGuildRemake` | 3.258 | 4 | 2,6 | 146 | 259 | 17 |
| Excalibur | Espadas | `kovarskeZakazky_excalibur` | 3.731 | 4 | 2,4 | 151 | 272 | 18 |
| Durindana | Espadas | `kovarskeZakazky_durendal` | 3.805 | 4 | 4,1 | 152 | 275 | 18 |
| Espada reforjada de Radzig Kobyla | Espadas | `longswordRadzig_reforged` | 5.588 | 4 | 1,9 | 161 | 299 | 20 |
| Adaga de Brunswick | Adagas | `daggerBruncvik` | 23 | 1 | 1 | 30 | 0 | 0 |
| Adaga roubada | Adagas | `setkaniVRatbori1_stolenDagger` | 23 | 1 | 1 | 30 | 0 | 0 |
| Faca ensanguentada | Adagas | `zikmunduvTabor_stabProofDagger` | 23 | 1 | 1 | 30 | 0 | 0 |
| Maça do Cancro | Maças e martelos | `taboryLapkuTrosecko_plesnivecMace` | 726 | 4 | 3,2 | 98 | 81 | 10 |
| Machado da Magdalena | Machados | `kovarskeZakazky_magdalenaAxe` | 58,6 | 4 | 4,6 | 86 | 74 | 6 |
| Machado protetor | Machados | `kovaniAsiDoVezi_protectiveAxe` | 97,5 | 4 | 4,6 | 86 | 74 | 6 |
| Estandarte de Santo Antônio | Armas de haste | `svatyAntonin_svancaraAntonFlag` | 8,2 | 4 | 11,4 | 95 | 152 | 7 |
| Acha de Brunswick | Armas de haste | `polearmBruncvik` | 478 | 4 | 10,5 | 122 | 176 | 13 |
| Balestra do Rugado | Bestas | `zbranePanaSemina_sukCrossbow` | 541 | 4 | 3 | 0 | 10 | 3 |
| Balestra de Ártemis | Bestas | `crossbowLightArtemis01` | 2.150 | 4 | 3 | 0 | 10 | 1 |
| Balestra de campo de Corvo | Bestas | `archery_bloodTrail_kafkaCrossbow` | 2.446 | 4 | 3 | 0 | 10 | 7 |

### Escudos

#### Escudo básico (até 44 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Escudo dourado do torneio | Escudos | `tournament_shieldHeaterGold` | 15,4 | 1 | 4,5 | – | 158 | 0 |
| Escudo vermelho do torneio | Escudos | `tournament_shieldHeaterRed` | 15,4 | 1 | 4,5 | – | 158 | 0 |
| Pavese pintado | Escudos | `shieldPavise_GY_A`, `shieldPavise_Pisek_Combat_A`, `shieldPavise_Pisek_Combat_A_02`, `shieldPavise_Pisek_Combat_B`, `shieldPavise_Pisek_Combat_C`, `shieldPavise_Pisek_Combat_D`, `shieldPavise_RGW_A`, `shieldPavise_RG_A`, `shieldPavise_RK_A`, `shieldPavise_RWY_A`, `shieldPavise_RW_A`, `shieldPavise_RY_A`, `shieldPavise_bar_GW`, `shieldPavise_bar_GY`, `shieldPavise_bar_KW`, `shieldPavise_bar_RK`, `shieldPavise_bar_RW`, `shieldPavise_bar_RY`, `shieldPavise_whole_G`, `shieldPavise_whole_K`, `shieldPavise_whole_R`, `shieldPavise_whole_W` | 30–43,6 | 1 | 10,5 | – | 200 | 0 |
| Pavese dividido | Escudos | `shieldPavise_half_KW`, `shieldPavise_half_RK`, `shieldPavise_half_RW` | 36,8 | 1 | 10,5 | – | 200 | 0 |

#### Escudo comum (44 a 140 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Escudo do Rugado | Escudos | `zbranePanaSemina_sukShield` | 44,7 | 1 | 10,4 | – | 203 | 0 |
| Pavese pintado | Escudos | `shieldPavise_dragon` | 50,4 | 1 | 10,5 | – | 200 | 0 |
| Escudo triangular | Escudos | `shieldHeater_chevronny_gw`, `shieldHeater_chevronny_rw_a`, `shieldHeater_chevronny_rw_b`, `shieldHeater_chevronny_ryw`, `shieldHeater_chevronny_yk`, `shieldHeater_eagle_A`, `shieldHeater_eagle_B`, `shieldHeater_prague_A`, `shieldHeater_whole_K`, `shieldHeater_whole_R`, `shieldHeater_whole_T`, `shieldHeater_whole_W`, `shieldHeater_zizka`, `shieldHeater_zizka_inverted` | 61,7–92,3 | 1 | 9 | – | 225 | 0 |
| Escudo cumano | Escudos | `shieldCuman`, `shieldCuman_01`, `shieldCuman_01_A`, `shieldCuman_01_B`, `shieldCuman_02`, `shieldCuman_03`, `shieldCuman_04`, `shieldCuman_05`, `shieldCuman_06`, `shieldCuman_07`, `shieldCuman_08`, `shieldCuman_09`, `shieldCuman_10`, `shieldCuman_11`, `shieldCuman_12`, `shieldCuman_12_B`, `shieldCuman_12_C` | 121–138 | 1 | 7,5 | – | 250 | 0 |
| Escudo de cavaleiro | Escudos | `shieldKite_whole_K`, `shieldKite_whole_R`, `shieldKite_whole_T`, `shieldKite_whole_W` | 126 | 1 | 6,8 | – | 263 | 0 |

#### Escudo bom (140 a 160 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Escudo de cavaleiro | Escudos | `shieldKite_bendy_by`, `shieldKite_bendy_gw`, `shieldKite_bendy_gy`, `shieldKite_bendy_quart_by`, `shieldKite_bendy_quart_kw`, `shieldKite_bendy_quart_kw_inverted`, `shieldKite_bendy_quart_rw_A`, `shieldKite_bendy_quart_rw_B`, `shieldKite_bendy_quart_rwg`, `shieldKite_bendy_quart_rwy`, `shieldKite_bendy_quart_ry`, `shieldKite_bendy_rg`, `shieldKite_bendy_rw`, `shieldKite_bendy_ry`, `shieldKite_chevronny_gw`, `shieldKite_chevronny_rw`, `shieldKite_chevronny_rwy`, `shieldKite_chevronny_yk`, `shieldKite_cross_gw`, `shieldKite_cross_gy`, `shieldKite_cross_rw`, `shieldKite_cross_ry`, `shieldKite_cross_yk`, `shieldKite_embattled_gy`, `shieldKite_embattled_wk`, `shieldKite_embattled_yk`, `shieldKite_gyronny_gy`, `shieldKite_gyronny_gy_B`, `shieldKite_gyronny_rwy`, `shieldKite_gyronny_yb`, `shieldKite_gyronny_yk`, `shieldKite_partyPerBend_by`, `shieldKite_partyPerBend_gr`, `shieldKite_partyPerBend_rw`, `shieldKite_partyPerBend_wk`, `shieldKite_partyPerBend_yk`, `shieldKite_partyPerFess_yb`, `shieldKite_partyPerPale_rw`, `shieldkite_partyPerBend_by` | 143 | 1 | 6,8 | – | 263 | 0 |
| Escudo de pipa de desertor | Escudos | `shieldKite_deserter_A` | 156 | 1 | 6,8 | – | 263 | 0 |

#### Escudo excelente (160 a 220 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Escudo do Coruja | Escudos | `shieldKite_owl` | 160 | 1 | 6,8 | – | 263 | 0 |

#### Escudo nobre (acima de 220 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Escudo de cavaleiro | Escudos | `shieldKite_bendy_devil` | 317 | 1 | 6,8 | – | 263 | 0 |

#### Escudo único (itens únicos, de missão e de recompensa)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Ataque | Defesa | Força |
|---|---|---|---|---|---|---|---|---|
| Escudo do inverno | Escudos | `shieldPavise_winter` | 30 | 1 | 10,5 | – | 200 | 0 |
| Escudo do outono | Escudos | `shieldHeater_autumn` | 41,3 | 1 | 9 | – | 225 | 0 |
| Escudo de Johnny, o Escarro | Escudos | `taboryLapkuTrosecko_tlamaShield` | 45,9 | 1 | 10,2 | – | 205 | 0 |
| Escudo do verão | Escudos | `shieldCuman_summer` | 52,7 | 1 | 7,5 | – | 250 | 0 |
| Escudo Warhorse | Escudos | `shieldKite_twitch` | 58,3 | 1 | 6,8 | – | 263 | 0 |
| Escudo da primavera | Escudos | `shieldKite_spring` | 58,3 | 1 | 6,8 | – | 263 | 0 |

## 4. Acessórios

### Acessório básico (até 45 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Broche de latão com letras | Colares e broches | `brooch_brass_inscription` | 30 | 1 | 0 | 10 |
| Broche de prata | Colares e broches | `brooch_silver` | 30 | 1 | 0 | 10 |
| Óculos | Óculos | `Spectacles01_m01_parler` | 5 | 1 | 0 | 25 |
| Ferraduras de Tengri | Ferraduras | `mountedArchery_slowingHorseshoes` | 11 | 1 | 4 | 0 |
| Sela de Tengri | Montaria | `mountedArchery_slowingSaddle` | 10 | 4 | 26 | 0 |
| Bridão de Tengri | Montaria | `mountedArchery_slowingBridle` | 12 | 4 | 5 | 0 |
| Caparazão de Tengri | Montaria | `mountedArchery_slowingCaparison` | 15 | 4 | 35 | 0 |

### Acessório comum (45 a 200 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Anel do Barnabás | Anéis | `taboryUCesty_barnabasSilverRingSecond` | 48 | 1 | 0,1 | 18 |
| Anel antigo | Anéis | `ring_poi_cistenaStudanka` | 147 | 1 | 0 | 18 |
| Anel de prata com pedra preciosa | Anéis | `ring_silver_gem` | 147 | 1 | 0 | 18 |
| Anel de prata gravado | Anéis | `ring_silver_engraved` | 147 | 1 | 0 | 18 |
| Cruz de estanho | Colares e broches | `necklace_tin_cross` | 62,7 | 1 | 0 | 10 |
| Escapulário de santo | Colares e broches | `necklace_scapular_saint` | 148 | 1 | 0 | 17 |
| Broche de prata esmaltado | Colares e broches | `brooch_silver_enamel` | 195 | 1 | 0 | 17 |
| Broche feminino | Colares e broches | `brooch_inlaid` | 195 | 1 | 0 | 17 |
| Esporas de roseta | Esporas | `Spurs01_m01_C` | 100 | 1 | 0,5 | 18 |
| Ferraduras | Ferraduras | `kovaniZavodniPodkovy_caulkinHorseshoe` | 45 | 3 | 1 | 18 |

### Acessório bom (200 a 660 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Anel de pedra preciosa | Anéis | `ring_engraved_gem` | 264 | 1 | 0 | 26 |
| Anel de pedras preciosas | Anéis | `ring_gem` | 264 | 1 | 0 | 26 |
| Escapulário com abertura | Colares e broches | `necklace_scapular_window` | 204 | 1 | 0 | 21 |
| Cruz prateada com granate | Colares e broches | `necklace_silver_cross_garnet` | 249 | 1 | 0 | 24 |
| Óculos | Óculos | `Spectacles01_m01` | 281 | 1 | 0 | 26 |
| Esporas húngaras | Esporas | `Spurs01_m02_C` | 218 | 1 | 0,5 | 23 |
| Esporas de cavaleiro | Esporas | `Spurs01_m03_C` | 462 | 1 | 0,5 | 34 |
| Ferraduras fantasmas | Ferraduras | `horseshoeSpecial_phantomHorse` | 300 | 1 | 0,5 | 0 |
| Caparazão teutônico | Montaria | `Caparison02_mTeuton` | 200 | 4 | 8 | 0 |

### Acessório nobre (acima de 660 g)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Anel de cruz dourada | Anéis | `ring_golden_cross` | 660 | 1 | 0 | 50 |
| Anel de ouro maciço | Anéis | `ring_golden_large` | 660 | 1 | 0 | 50 |
| Broche inicial dourado | Colares e broches | `brooch_golden_letter` | 660 | 1 | 0 | 40 |
| Cruz dourada com granates | Colares e broches | `necklace_golden_cross_garnet` | 660 | 1 | 0 | 50 |
| Cruz dourada com pérolas | Colares e broches | `necklace_golden_cross_pearl` | 660 | 1 | 0 | 50 |
| Esporas de nobre | Esporas | `Spurs01_m04_C` | 800 | 1 | 0,5 | 50 |
| Chanfron de unicórnio | Montaria | `WarChanfron04_mPros` | 1.265 | 4 | 9 | 30 |

### Acessório único (itens únicos, de missão e de recompensa)

| Peça | Tipo | Código (para `/give`) | Preço (g) | Q máx. | Peso (kg) | Carisma |
|---|---|---|---|---|---|---|
| Anel barato | Anéis | `svatba_tournamentCheapRing` | 15 | 1 | 0 | 10 |
| Anel comum | Anéis | `spizovaciOddil_ringFromPlagueGrave` | 74 | 1 | 0 | 11 |
| Anel do Aveia | Anéis | `RingsSamuel_m01`, `prepadeni_voves_ring` | 88,5–118 | 1 | 0 | 14–16 |
| Anel de prata do bolo | Anéis | `spravedlnost_ring` | 147 | 1 | 0 | 18 |
| Anel do Casper | Anéis | `taboryTrosecko_casperRing` | 147 | 1 | 0 | 18 |
| Anel do Godwin | Anéis | `vezniNaTroskch_godwinsRing` | 182 | 1 | 0 | 20 |
| Anel de camareiro | Anéis | `svatba_ringFromChamberlein` | 205 | 1 | 0 | 22 |
| Colar da Pavlena | Colares e broches | `korenarkaZachrana_pavelnasNecklace` | 50 | 1 | 0 | 10 |
| Colar do Lorde Semine | Colares e broches | `svatba_tournamentRewardNecklace` | 73,1 | 1 | 0 | 17 |
| Amuleto de voivoda | Colares e broches | `kocovnickaCest_amulet` | 122 | 1 | 0 | 15 |
| Medalhão da Virgem Maria | Colares e broches | `spizovaciOddil_vrbasRewardNecklace` | 122 | 1 | 0 | 15 |
| Medalhão de Santa Catarina | Colares e broches | `KucharskaKniha_medailon` | 122 | 1 | 0 | 15 |
| Colar de voivoda | Colares e broches | `Necklace01_mVajda` | 170 | 1 | 0 | 18 |
| Óculos do Cellarius | Óculos | `dlc3_zasobovani_spectacles_cellarius` | 281 | 1 | 0 | 26 |
| Atadura de cabeça | Tapa-olho | `EyepatchZizka_m01`, `EyepatchZizka_m02` | 1,7 | 2 | 0,1 | 1 |
| Esporas do Jezhek | Esporas | `ztracenaCest_jezeksSpurs` | 336 | 1 | 0,5 | 28 |
| Ferradura fantasma | Ferraduras | `kovaniKatuvSleh_magicHorseshoe` | 60 | 1 | 0,5 | 0 |
| Caparazão de torneio para cavalo de guerra | Montaria | `NobleCaparison01_mTwitch` | 212 | 4 | 5 | 24 |
| Caparazão de Brunswick | Montaria | `CaparisonBrunswig_m01` | 218 | 4 | 4,8 | 24 |
| Chapéu do Markvart von Aulitz | Montaria | `NobleCaparison04_mMarkvart` | 518 | 4 | 14,4 | 9 |

## 5. Brasões: cidades, famílias, guildas e ordens

Escudos, pavieses, sobretudos e caparazões que levam o brasão de um lugar ou de uma casa, agrupados pelo dono do brasão. Dentro de cada um, as peças vêm separadas pela mesma qualidade das tabelas acima.

### Cidades e vilas

#### Kuttenberg

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo triangular de Kuttenberg | escudo | `ShieldHeater_TournamentA`, `ShieldHeater_TournamentB` | comum | 82,1 | 1 |
| Escudo de cavaleiro de Kuttenberg | escudo | `shieldKite_kuttenberg_A`, `shieldKite_kuttenberg_B` | excelente | 160 | 1 |

#### Praga

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Pavese da cidade de Praga | escudo | `shieldPavise_prague_A`, `shieldPavise_prague_B`, `shieldPavise_prague_C`, `shieldPavise_prague_D` | básico | 43,6 | 1 |
| Escudo triangular da Cidade de Praga | escudo | `shieldHeater_prague_B`, `shieldHeater_prague_C`, `shieldHeater_prague_D` | comum | 82,1 | 1 |
| Casaco comum de Praga com brasão | roupa | `Coat04_mPrague_C` | boa | 163 | 4 |
| Escudo de cavaleiro da Cidade Velha de Praga | escudo | `shieldKite_prague_A`, `shieldKite_prague_B`, `shieldKite_prague_B_inverted`, `shieldKite_prague_C`, `shieldKite_prague_C_inverted` | excelente | 160 | 1 |

#### Skalitz

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro de Skalitz | escudo | `shieldKite_skalitz` | comum | 136 | 1 |

#### Suchdol

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Pavese de Suchdol | escudo | `shieldPavise_pisek_A`, `shieldPavise_pisek_B`, `shieldPavise_pisek_C` | básico | 43,6 | 1 |

#### Trosky

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Pavese de Trosky | escudo | `shieldPavise_bergov_A`, `shieldPavise_bergov_B` | básico | 43,6 | 1 |

### Famílias e senhores

#### Aulitz

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Caparazão costurado nas cores de Aulitz | acessório | `NobleCaparison02_mMarkvart` | único | 518 | 4 |

#### Bergow

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro do Lorde de Bergow | escudo | `shieldHeater_bergov_A` | comum | 82,1 | 1 |
| Escudo de cavaleiro do Lorde de Bergow | escudo | `shieldKite_bergov_A`, `shieldKite_bergov_B` | excelente | 160 | 1 |
| Escudo de cavaleiro do Lorde de Bergow | escudo | `shieldKite_lipa` | nobre | 343 | 1 |

#### Holohlavy

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo triangular do Lorde de Holohlavy | escudo | `ztracenaCest_lordsOfHolohlavShield` | comum | 115 | 1 |
| Escudo triangular dos Lordes de Holohlavy | escudo | `shieldHeater_holohlav_A`, `shieldHeater_pisek_C`, `shieldHeater_pisek_D` | comum | 82,1–92,3 | 1 |
| Caparazão dos Lordes de Holohlavy | acessório | `NobleCaparison01_mJezek`, `ztracenaCest_jezeksCaparison` | único | 518 | 4 |

#### Hradetz

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro dos Lordes de Hradetz | escudo | `shieldKite_pisek_A`, `shieldKite_pisek_B`, `shieldKite_pisek_C`, `shieldKite_vavak_A`, `shieldKite_vavak_B` | excelente | 160 | 1 |

#### Leipa

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo dos Lordes de Leipa | escudo | `nebakovPruzkum_lordsOfLeipaShield` | comum | 104 | 1 |
| Escudo triangular dos Lordes de Leipa | escudo | `shieldHeater_lipa_A`, `shieldHeater_lipa_B` | comum | 82,1 | 1 |

#### Nebakov

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de pipa dos lordes de Nebakov | escudo | `shieldKite_nebak_A`, `shieldKite_nebak_B`, `shieldKite_nebak_C`, `shieldKite_nebak_C_inverted` | excelente | 160 | 1 |

#### Pisek

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro do Lorde de Pisek | escudo | `shieldHeater_pisek_B` | comum | 82,1 | 1 |
| Escudo triangular do Lorde Pisek | escudo | `shieldHeater_pisek_A` | comum | 82,1 | 1 |

#### Polner

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo triangular do Lorde Polner | escudo | `shieldHeater_polner` | comum | 92,3 | 1 |

#### Radzig

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro de Sir Radzig | escudo | `shieldKite_skalitz_02` | bom | 148 | 1 |

#### Ruthard

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro do Lorde Ruthard | escudo | `shieldKite_ruthard_A`, `shieldKite_ruthard_A_inverted` | excelente | 160 | 1 |

#### Semine

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro dos Lordes de Semine | escudo | `shieldKite_semin_A` | excelente | 160 | 1 |

#### Suchotlesky

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo triangular do Lorde de Suchotlesky | escudo | `dvojityAgent_petrsShield` | nobre | 250 | 1 |

#### Zavish

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo triangular de Sir Zavish | escudo | `shieldHeater_peony`, `shieldHeater_zavis` | comum | 92,3 | 1 |

#### Zimburg

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro dos Lordes de Zimburg | escudo | `shieldKite_cimburk` | bom | 143 | 1 |

### Guildas

#### Guilda dos Açougueiros

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Guilda dos Açougueiros | escudo | `shieldKite_cech_D` | nobre | 222 | 1 |

#### Guilda dos Boticários

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Guilda dos Boticários | escudo | `shieldKite_cech_B` | nobre | 222 | 1 |

#### Guilda dos Padeiros

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Guilda dos Padeiros | escudo | `shieldKite_cech_F` | nobre | 222 | 1 |

#### Guilda dos Pintores

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Guilda dos Pintores | escudo | `shieldKite_3Wells_A`, `shieldKite_3Wells_B`, `shieldKite_armoursmith`, `shieldKite_blacksmith`, `shieldKite_weaponsmith` | bom | 143 | 1 |
| Escudo de cavaleiro da Guilda dos Pintores | escudo | `shieldKite_cech_E` | nobre | 222 | 1 |

#### Guilda dos Sapateiros

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Guilda dos Sapateiros | escudo | `shieldKite_cech_A` | nobre | 222 | 1 |

#### Guilda dos Seladores

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Guilda dos Seladores | escudo | `shieldKite_cech_C` | nobre | 222 | 1 |

### Ordens e reinos

#### Ordem Teutônica

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Pavese teutônico | escudo | `shieldPavise_teuton_01`, `shieldPavise_teuton_02` | básico | 17,6 | 1 |
| Escudo de cavaleiro teutônico | escudo | `shieldKite_teuton_01`, `shieldKite_teuton_02`, `shieldKite_teuton_03` | excelente | 218 | 1 |

#### Ordem da Cruz

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Escudo de cavaleiro da Ordem da Cruz | escudo | `shieldKite_redstar_A`, `shieldKite_redstar_B` | nobre | 243 | 1 |

#### Reino da Hungria

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Pavese húngaro | escudo | `shieldPavise_sigismund_A`, `shieldPavise_sigismund_B` | básico | 43,6 | 1 |
| Escudo triangular húngaro | escudo | `shieldHeater_sigismund_A`, `shieldHeater_sigismund_B`, `shieldHeater_sigismund_C`, `shieldHeater_sigismund_D` | comum | 82,1 | 1 |
| Escudo de cavaleiro húngaro | escudo | `shieldKite_sigismund_A`, `shieldKite_sigismund_B`, `shieldKite_sigismund_C` | excelente | 160 | 1 |

### Peças com brasão ou insígnia, sem casa definida

#### Brasão ou insígnia

| Peça | Tipo | Código (para `/give`) | Qualidade | Preço (g) | Q máx. |
|---|---|---|---|---|---|
| Capuz de malha com brasão | armadura | `CoifMail02_m01_B3`, `CoifMail02_m02_B3`, `CoifMail02_m03_B3`, `CoifMail02_m04_B3`, `CoifMail02_mBergov_B3`, `CoifMail02_mKuttenberg_B3`, `CoifMail02_mMagyar_B3`, `CoifMail02_mNebak_B3`, `CoifMail02_mPapal_B3`, `CoifMail02_mPisek_B3`, `CoifMail02_mPrague_B3`, `CoifMail02_mRuthart_B3`, `CoifMail02_mSemin_B3` | comum | 497 | 4 |
| Gola de armadura com insígnia | armadura | `CollarChain02_m01_A4`, `CollarChain02_m02_A4`, `CollarChain02_m03_A4`, `CollarChain02_m04_A4`, `CollarChain02_m05_A4`, `CollarChain02_m06_A4` | comum | 801–820 | 4 |
| Casaco comum com brasão | roupa | `Coat04_mKuttenberg01_C`, `Coat04_mKuttenberg02_C`, `Coat04_mKuttenberg03_C`, `Coat04_mKuttenberg_C`, `Coat04_mMagyar_C` | boa | 163 | 4 |
| Cruz de prata com insígnia | acessório | `necklace_silver_cross_insignia` | bom | 249 | 1 |
| Escapulário com insígnia | acessório | `necklace_scapular_letter` | bom | 340 | 1 |
| Sobretudo de brasão | roupa | `Coat02_mBergov_D`, `Coat02_mDesert_D`, `Coat02_mKuttenberg01_D`, `Coat02_mKuttenberg02_D`, `Coat02_mKuttenberg03_D`, `Coat02_mKuttenberg_D`, `Coat02_mLeipa_D`, `Coat02_mMagyar01_D`, `Coat02_mMagyar_D`, `Coat02_mNebak_D`, `Coat02_mPisek_D`, `Coat02_mPolner_D`, `Coat02_mRuthart_D`, `Coat02_mSemin_D`, `Coat02_mVavak_D` | boa | 96,3–104 | 4 |
| Broche heráldico de ouro | acessório | `brooch_golden_erb` | nobre | 660 | 1 |
| Gola de armadura com insígnia | armadura | `CollarChain02_mAulitz` | única | 801 | 4 |

---

2746 códigos de peças em 669 nomes.
