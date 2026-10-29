# Armaduras por lugar: os conjuntos completos

Os conjuntos de armadura que o próprio jogo veste nos guardas e soldados de cada cidade, vila ou senhor, peça por peça, com a **categoria** (pelo preço, como no [ITENS.md](ITENS.md)), o **peso** e uma descrição. Gerado por `resources/kcdc-gamemode/tools/make-armor-sets.py` a partir das tabelas do jogo; rode de novo se o jogo atualizar.

## Como dar um conjunto

- `/conjunto` lista os lugares; `/conjunto <lugar>` lista os conjuntos dele (por exemplo `/conjunto raborsch`).
- `/conjunto dar <id> [jogador]` põe **todas as peças** do conjunto no inventário (o seu, ou o do jogador citado). Exemplo: `/conjunto dar raborsch-1 Radovan`.
- `/conjunto vestir <id> [jogador]` **veste** o conjunto na hora (as roupas de antes vão para o inventário). Só para corpo masculino: os conjuntos dos soldados são do jogo para homens; num corpo feminino use `dar`.
- Uma peça avulsa continua com `/give <código>`. Cada peça tem outras cores (códigos na coluna *Outras cores*).
- Os **[Brasões](#brasões)**, no fim, não são trajes do jogo: cada pacote junta o **casaco com o brasão** da cidade, da casa ou da ordem, o **escudo de cavaleiro** dela e a **espada do cavaleiro**. Só `dar`: `/conjunto dar brasao-kuttenberg Radovan`.
- As **[Casas e cidades](#casas-e-cidades)**, no fim de tudo: para cada uma que tem brasão, **uma lista só** com as peças dele, o escudo e a espada, as armaduras do lugar e a roupa do cavalo, com o comando de cada coisa.
- Os **[Cavalos](#cavalos)**, depois dos brasões: os arreios que o jogo põe nos cavalos de cada lugar e casa, e as peças de cavalo nas cores de cada casa. Vão direto no cavalo, com `/horse gear preset <conjunto>` (por exemplo `/horse gear preset ttro_bergovHorse`, o cavalo do senhor de Trosky).

## Categorias

| Categoria | Preço do conjunto |
|---|---|
| básica | até 3.494 g |
| comum | 3.494 a 9.334 g |
| boa | 9.334 a 16.633 g |
| excelente | 16.633 a 25.731 g |
| nobre | acima de 25.731 g |

**Peso:** *pesada* tem placas ou brigantina no tronco, *média* cota de malha, *leve* só acolchoado e couro.

## Índice

- [Kuttenberg](#kuttenberg) (20 conjuntos)
- [Suchdol](#suchdol) (3 conjuntos)
- [Raborsch](#raborsch) (4 conjuntos)
- [Malešov](#malešov) (19 conjuntos)
- [Praga](#praga) (12 conjuntos)
- [Písek](#písek) (9 conjuntos)
- [Semine](#semine) (9 conjuntos)
- [Nebakov](#nebakov) (9 conjuntos)
- [Trosky](#trosky) (3 conjuntos)
- [Lípa](#lípa) (8 conjuntos)
- [Kunštát](#kunštát) (8 conjuntos)
- [Ruthard](#ruthard) (9 conjuntos)
- [Vavák](#vavák) (11 conjuntos)
- [Polner](#polner) (3 conjuntos)
- [Jobst](#jobst) (3 conjuntos)
- [Sigismundo](#sigismundo) (14 conjuntos)
- [Cumanos](#cumanos) (1 conjunto)
- [Brabantinos](#brabantinos) (10 conjuntos)
- [Soldados comuns](#soldados-comuns) (18 conjuntos)
- [Brasões](#brasões) (19 conjuntos)
- [Cavalos](#cavalos) (71 conjuntos de cavalo, 45 peças nas cores de uma casa)
- [Casas e cidades](#casas-e-cidades) (19 casas, cidades, ordens e reinos com tudo junto: as peças com o brasão, o escudo e a espada, as armaduras do lugar e a roupa do cavalo)

## Kuttenberg

### `kuttenberg-1` — Soldado da cidade, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 3.699 g

Capacete de chaleira composto, capuz de malha com brasão, cota de malha saxônica, jaquetão longo, cotoveleiras com rondelas, manoplas de cota de malha, calça acolchoada, joelheiras, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m02_D` | – |

Dar: `/conjunto dar kuttenberg-1` · Vestir: `/conjunto vestir kuttenberg-1`

### `kuttenberg-2` — Soldado da cidade, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 5.205 g

Capacete de Rondel, almofre de malha, cota de malha longa, jaquetão longo, túnica simples, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, joelheiras em forma de folha, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m01_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica simples | `Waffenrock02_mKuttenberg03_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m02_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m08_D` | – |

Dar: `/conjunto dar kuttenberg-2` · Vestir: `/conjunto vestir kuttenberg-2`

### `kuttenberg-3` — Soldado da cidade, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 7.960 g

Capacete de chaleira com bico, capuz de malha com brasão, cota de malha longa, jaquetão longo, casaco comum, cotoveleiras com rondelas, manoplas de ampulheta, calça acolchoada, joelheiras, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat02_m05_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m02_D` | – |

Dar: `/conjunto dar kuttenberg-3` · Vestir: `/conjunto vestir kuttenberg-3`

### `kuttenberg-4` — Soldado da cidade, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 5.096 g

Capacete de aço, almofre de malha, cota de malha saxônica, jaquetão longo, túnica de montaria, cotoveleiras com rondelas, manoplas de cota de malha, calças acolchoadas do nobre, perneiras de meia placa, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m01_C2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mKuttenberg01_B` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m02_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m08_D` | – |

Dar: `/conjunto dar kuttenberg-4` · Vestir: `/conjunto vestir kuttenberg-4`

### `kuttenberg-5` — Soldado da cidade, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 7.150 g

Capacete de Rondel, almofre de malha, cota de malha saxônica, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de ampulheta, calças acolchoadas do nobre, perneiras de meia placa, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m02_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mKuttenberg02_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m07_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m04_D` | – |

Dar: `/conjunto dar kuttenberg-5` · Vestir: `/conjunto vestir kuttenberg-5`

### `kuttenberg-6` — Soldado da cidade, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 8.580 g

Capacete de chaleira saxão, almofre de malha, cota de malha saxônica, jaquetão longo, túnica de montaria, cotoveleiras, manoplas de ampulheta, calças nobres acolchoadas, perneiras de meia placa, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mKuttenberg03_B` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m02_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m05_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m05_D` | – |

Dar: `/conjunto dar kuttenberg-6` · Vestir: `/conjunto vestir kuttenberg-6`

### `kuttenberg-7` — Soldado da cidade, nível 5

**Categoria:** comum · **Peso:** pesada · **Preço:** 5.494 g

Aketon curto, brigandina simples, cota de malha curta, sobretudo de brasão, calças nobres acolchoadas, perneiras de brigandina antigas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Tronco | Aketon curto | `GambesonShort04_m01_C3` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Por cima | Sobretudo de brasão | `Coat02_mKuttenberg01_D` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m05_D` | – |

Dar: `/conjunto dar kuttenberg-7` · Vestir: `/conjunto vestir kuttenberg-7`

### `kuttenberg-8` — Soldado da cidade, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 15.424 g

Bacinete em forma de sino, capuz de malha com brasão, cota de malha curta, couraça lisa, jaquetão curto, sobretudo de brasão, mangas laminares com rondelas, manoplas de ampulheta, calças nobres acolchoadas, perneiras de brigandina de nobre, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete em forma de sino | `BascinetOpen02_m03_C1` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | – |
| Tronco | Cota de malha curta | `MailShort01_m04_C4` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão curto | `GambesonShort01_m01_D2` | – |
| Por cima | Sobretudo de brasão | `Coat02_mKuttenberg01_D` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m04_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m05_B4` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar kuttenberg-8` · Vestir: `/conjunto vestir kuttenberg-8`

### `kuttenberg-9` — Soldado da cidade, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 16.807 g

Capacete de chaleira alto, capuz de malha com brasão, brigandina simples, cota de malha curta, gibão curto, braço de brigandina, manoplas milanesas, calças nobres acolchoadas, perneiras de meia placa, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m01_A4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | – |
| Tronco | Brigandina simples | `Brigandine01_m07_D3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Gibão curto | `GambesonShort03_m07_A4` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m09_B4` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar kuttenberg-9` · Vestir: `/conjunto vestir kuttenberg-9`

### `kuttenberg-10` — Soldado da cidade, nível 6

**Categoria:** boa · **Peso:** pesada · **Preço:** 16.253 g

Capacete de chaleira saxão, capuz de malha com brasão, cota de malha curta, couraça de equitação, jaquetão longo, túnica para cavaleiro, mangas reforçadas e temperadas, manoplas de ampulheta, calças nobres acolchoadas, perneiras de brigandina antigas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | – |
| Tronco | Cota de malha curta | `MailShort01_m03_C4` | – |
| Tronco | Couraça de equitação | `Cuirass05_m01_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_m05_B` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m05_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Sapatos simples | `Shoes01_m05_D` | – |

Dar: `/conjunto dar kuttenberg-10` · Vestir: `/conjunto vestir kuttenberg-10`

### `kuttenberg-11` — Soldado da cidade, nível 6

**Categoria:** excelente · **Peso:** pesada · **Preço:** 22.400 g

Bacinete italiano, capuz de malha com brasão, brigandina milanesa, cota de malha curta, jaquetão longo, braço de brigandina, manoplas milanesas, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m01_C4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m03_C3` | – |
| Tronco | Cota de malha curta | `MailShort01_m04_C4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m02_B4` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Sapatos macios | `Shoes03_m04_C` | – |

Dar: `/conjunto dar kuttenberg-11` · Vestir: `/conjunto vestir kuttenberg-11`

### `kuttenberg-12` — Soldado da cidade, nível 6

**Categoria:** excelente · **Peso:** pesada · **Preço:** 25.597 g

Bacinete italiano, almofre de malha, cota de malha longa, couraça de equitação, jaquetão longo, túnica para cavaleiro, mangas laminares de nobre, manoplas de ampulheta, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m01_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Couraça de equitação | `Cuirass05_m01_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mKuttenberg05_B` | – |
| Braços | Mangas laminares de nobre | `BrigandineArm06_m03_B5` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Sapatos simples | `Shoes01_m05_D` | – |

Dar: `/conjunto dar kuttenberg-12` · Vestir: `/conjunto vestir kuttenberg-12`

### `kuttenberg-13` — Comandante da cidade

**Categoria:** excelente · **Peso:** pesada · **Preço:** 21.931 g

Capacete de chaleira saxão, coifa acolchoada, gola de armadura, aketon curto, brigandina milanesa, cota de malha italiana, túnica com fecho, mangas laminares de nobre, manoplas de brigandina, calças acolchoadas do nobre, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m05_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m02_C1` | – |
| Tronco | Aketon curto | `GambesonShort04_m08_C3` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m03_C3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m02_C1` | – |
| Por cima | Túnica com fecho | `Waffenrock03_mKuttenberg02_A` | – |
| Braços | Mangas laminares de nobre | `BrigandineArm06_m08_B5` | – |
| Braços | Manoplas de brigandina | `Gauntlets08_m02_B4` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m03_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m12_B4` | – |
| Pés | Sapatos macios | `Shoes03_m04_C` | – |

Dar: `/conjunto dar kuttenberg-13` · Vestir: `/conjunto vestir kuttenberg-13`

### `kuttenberg-14` — Guarda de loja

**Categoria:** comum · **Peso:** pesada · **Preço:** 7.248 g

Gola de armadura, couraça de Magdeburg, jaquetão longo, casaco de caça, cotoveleiras com rondelas, luvas de couro, calça acolchoada: escura, joelheiras em forma de folha, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Couraça de Magdeburg | `Cuirass02_m01_B4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco de caça | `Coat05_m08_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m02_C2` | – |
| Braços | Luvas de couro | `Gloves01_m04_C1` | – |
| Pernas | Calça acolchoada: escura | `LegsPadded01_m08_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar kuttenberg-14` · Vestir: `/conjunto vestir kuttenberg-14`

### `kuttenberg-15` — Torneio, leve

**Categoria:** básica · **Peso:** leve · **Preço:** 406 g

Calça acolchoada, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pernas | Calça acolchoada | `LegsPadded01_m05_C3` | – |
| Pés | Botas firmes | `BootsAnkle05_m02_C` | – |

Dar: `/conjunto dar kuttenberg-15` · Vestir: `/conjunto vestir kuttenberg-15`

### `kuttenberg-16` — Torneio, leve

**Categoria:** básica · **Peso:** leve · **Preço:** 3.048 g

Capacete de chaleira em forma de sino, grande almofre de batalha, jaquetão longo, túnica de montaria, manoplas de cota de malha, calças simples, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m03_D3` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_mkhTournament_06_D2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mkhTournament_03_B` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças simples | `HoseSeparate01_m20_D` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar kuttenberg-16` · Vestir: `/conjunto vestir kuttenberg-16`

### `kuttenberg-17` — Torneio, leve

**Categoria:** comum · **Peso:** leve · **Preço:** 4.983 g

Capacete de chaleira com saliência, grande almofre de batalha, jaquetão longo, túnica de montaria, manoplas de ampulheta, chausses acolchoadas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_mkhTournament_07_D2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mkhTournament_07_B` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar kuttenberg-17` · Vestir: `/conjunto vestir kuttenberg-17`

### `kuttenberg-18` — Torneio, pesado

**Categoria:** comum · **Peso:** média · **Preço:** 3.747 g

Capacete encardido, almofre de malha, cota de malha longa, jaquetão longo, casaco de caça, cotoveleiras com rondelas, manoplas de cota de malha, calças simples de trovador, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete encardido | `SkullCap01_m01_D1` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Casaco de caça | `Coat05_m10_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças simples de trovador | `HoseSeparate01_mPattern03_D` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar kuttenberg-18` · Vestir: `/conjunto vestir kuttenberg-18`

### `kuttenberg-19` — Torneio, pesado

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.270 g

Capacete de chaleira com bico, almofre de malha, jaquetão longo, kastenbrust, casaco de caça, mangas laminares com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de meia placa, sapatos de burguês.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Tronco | Kastenbrust | `Cuirass08_m01_C4` | – |
| Por cima | Casaco de caça | `Coat05_m07_C` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos de burguês | `Shoes02_m02_B` | – |

Dar: `/conjunto dar kuttenberg-19` · Vestir: `/conjunto vestir kuttenberg-19`

### `kuttenberg-20` — Torneio, pesado

**Categoria:** nobre · **Peso:** pesada · **Preço:** 36.295 g

Bacinete de Nuremberg, almofre de malha, brigandina saxônica, cota de malha longa, jaquetão de nobre, mangas com proteção de Nuremberg, manoplas de Nuremberg, calça acolchoada, perneiras laminares de cavaleiro, botas de nobre.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m04_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Brigandina saxônica | `Brigandine03_m05_A4` | – |
| Tronco | Cota de malha longa | `MailLong01_m02_C5` | – |
| Tronco | Jaquetão de nobre | `GambesonLong04_m04_A5` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m02_A5` | – |
| Braços | Manoplas de Nuremberg | `Gauntlets05_m02_A5` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m09_C3` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m03_A5` | – |
| Pés | Botas de nobre | `BootsKnee01_m02_C` | – |

Dar: `/conjunto dar kuttenberg-20` · Vestir: `/conjunto vestir kuttenberg-20`

## Suchdol

**Cavalo:** `/horse gear preset oblehaniSuchdole_horse_suchdol01` (defensor, no cerco de Suchdol); os outros em [Cavalo de Suchdol](#cavalo-de-suchdol).

### `suchdol-1` — Defensor (cerco de Suchdol)

**Categoria:** básica · **Peso:** leve · **Preço:** 1.443 g

Capacete de aço, coifa acolchoada, capuz de servo, jaquetão desgastado, casacão de mendigo, cotoveleiras, luvas do punguista, calças de mendigo, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m01_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mPisek_C` | – |
| Tronco | Jaquetão desgastado | `GambesonShort02_m03_E1` | – |
| Por cima | Casacão de mendigo | `Coat03_m03_E` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Calças de mendigo | `HoseSeparate04_m02_E` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar suchdol-1` · Vestir: `/conjunto vestir suchdol-1`

### `suchdol-2` — Defensor (cerco de Suchdol)

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.602 g

Capuz de malha com brasão, cota de malha italiana, couraça de equitação, jaquetão longo, cotoveleiras com rondelas, manoplas de ampulheta, chausses acolchoadas, perneiras milanesas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Capuz de malha com brasão | `CoifMail02_mPrague_B3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça de equitação | `Cuirass05_m01_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras milanesas | `LegsPlate02_m01_B4` | – |

Dar: `/conjunto dar suchdol-2` · Vestir: `/conjunto vestir suchdol-2`

### `suchdol-3` — Defensor (cerco de Suchdol)

**Categoria:** nobre · **Peso:** pesada · **Preço:** 28.806 g

Bacinete de Nuremberg, almofre de malha, cota de malha longa, couraça com faldas, jaquetão longo, braço de brigandina, manoplas de ampulheta, calças acolchoadas velhas, perneiras de placa da Baviera, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m01_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Couraça com faldas | `Brigandine10_m01_A5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m01_B4` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m01_E1` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pés | Botas firmes | `BootsAnkle05_m01_C` | – |

Dar: `/conjunto dar suchdol-3` · Vestir: `/conjunto vestir suchdol-3`

## Raborsch

**Cavalo:** `/horse gear preset setkaniVRatbori1_tempRatiborRetinueHorse` (comitiva em Ratboř); os outros em [Cavalo de Raborsch](#cavalo-de-raborsch).

### `raborsch-1` — Guarda de Raborsch

**Categoria:** comum · **Peso:** leve · **Preço:** 4.674 g

Capacete de aço, almofre de malha, jaquetão longo, casaco comum, luvas do punguista, mangas reforçadas e temperadas, chausses acolchoadas, joelheiras, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m01_C2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m03_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m08_C3` | – |
| Por cima | Casaco comum | `Coat04_m10_C` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m02_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m03_D1` | – |
| Pés | Botas firmes | `BootsAnkle05_m01_C` | – |

Dar: `/conjunto dar raborsch-1` · Vestir: `/conjunto vestir raborsch-1`

### `raborsch-2` — Guarda de Raborsch

**Categoria:** excelente · **Peso:** pesada · **Preço:** 16.661 g

Bacinete aberto, capuz de malha com brasão, capuz simples, cota de malha italiana, jaquetão longo, kastenbrust, manoplas de ampulheta, manoplas de placa para cavaleiros, chausses acolchoadas, perneiras de placa saxônicas, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_m01_B3` | – |
| Cabeça | Capuz simples | `Hood01_m11_D` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m08_C3` | – |
| Tronco | Kastenbrust | `Cuirass08_m07_C4` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m05_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m02_C3` | – |
| Pés | Botas de viagem | `BootsAnkle02_m03_B` | – |

Dar: `/conjunto dar raborsch-2` · Vestir: `/conjunto vestir raborsch-2`

### `raborsch-3` — Guarda de Raborsch

**Categoria:** nobre · **Peso:** pesada · **Preço:** 37.195 g

Bacinete italiano, almofre de malha, capuz bordado, cota de malha italiana, couraça com faldas, jaquetão de nobre, mangas com proteção de Nuremberg, manoplas milanesas, chausses acolchoadas, perneiras de placa de nobre.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m05_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m02_C2` | – |
| Cabeça | Capuz bordado | `Hood06_m08_B` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça com faldas | `Brigandine10_m07_A5` | – |
| Tronco | Jaquetão de nobre | `GambesonLong04_m04_A5` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m02_A5` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de placa de nobre | `LegsPlate03_m04_A5` | – |

Dar: `/conjunto dar raborsch-3` · Vestir: `/conjunto vestir raborsch-3`

### `raborsch-4` — Comandante (Ratboř)

**Categoria:** boa · **Peso:** pesada · **Preço:** 16.577 g

Gola de armadura, cota de malha saxônica, couraça com faldas, jaquetão longo, mangas reforçadas e temperadas, manoplas de torneio, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Gola de armadura | `CollarChain01_m02_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça com faldas | `Brigandine10_m01_A5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m07_C3` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m01_C2` | – |
| Braços | Manoplas de torneio | `Gauntlets02_m01_B4_khTournament_Henry` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m02_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar raborsch-4` · Vestir: `/conjunto vestir raborsch-4`

## Malešov

**Cavalo:** o jogo não tem cavalo de Malešov; use o do Lorde von Bergow, `/horse gear preset ttro_bergovHorse` ([Cavalo de Malešov](#cavalo-de-malešov)).

### `malesov-1` — Soldado de Malešov

**Categoria:** comum · **Peso:** média · **Preço:** 3.494 g

Capacete de chaleira composto, almofre de malha, cota de malha saxônica, jaquetão longo, sobretudo de brasão, manoplas de cota de malha, calça acolchoada, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m02_D2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m02_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mBergov_D` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m10_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar malesov-1` · Vestir: `/conjunto vestir malesov-1`

### `malesov-2` — Soldado de Malešov

**Categoria:** comum · **Peso:** leve · **Preço:** 6.862 g

Bacinete com camal, almofre de malha, jaquetão longo, túnica para cavaleiro, mangas laminares com rondelas, manoplas de cota de malha, calça acolchoada, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m01_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m02_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mBergov_B` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m02_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m02_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m06_C3` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar malesov-2` · Vestir: `/conjunto vestir malesov-2`

### `malesov-3` — Soldado de Malešov

**Categoria:** boa · **Peso:** pesada · **Preço:** 12.360 g

Capacete de chaleira alto, almofre de malha, cota de malha italiana, couraça lisa, jaquetão longo, túnica ornamentada, cotoveleiras com rondelas, manoplas de nobre, chausses acolchoadas, perneiras de brigandina de nobre, botas do cortesão.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m01_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça lisa | `Cuirass01_m05_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Túnica ornamentada | `Waffenrock04_mBergov_A` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m04_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Botas do cortesão | `BootsAnkle04_m03_A` | – |

Dar: `/conjunto dar malesov-3` · Vestir: `/conjunto vestir malesov-3`

### `malesov-4` — Vigia da vila

**Categoria:** básica · **Peso:** leve · **Preço:** 1.133 g

Chapéu redondo, jaquetão longo, casaco comum, cotoveleiras com rondelas, luvas de equitação, calças acolchoadas do nobre, joelheiras em forma de folha, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Chapéu redondo | `Cap01_m09_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Casaco comum | `Coat02_m05_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m04_C2` | – |
| Braços | Luvas de equitação | `Gloves05_m02_B2` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m07_B2` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de viagem | `BootsAnkle02_m02_B` | – |

Dar: `/conjunto dar malesov-4` · Vestir: `/conjunto vestir malesov-4`

### `malesov-5` — Guarda de Bergow, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 13.401 g

Capacete de Rondel, almofre de malha, capuz de servo, jaquetão longo, kastenbrust, mangas laminares simples, manoplas milanesas, calça acolchoada: escura, perneiras de meia placa, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m02_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mBergov_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Tronco | Kastenbrust | `Cuirass08_m01_C4` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m04_D1` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calça acolchoada: escura | `LegsPadded01_m08_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar malesov-5` · Vestir: `/conjunto vestir malesov-5`

### `malesov-6` — Guarda de Bergow, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 19.946 g

Capacete de chaleira saxão, almofre acolchoado rústico, capuz bordado, aketon curto, brigandina milanesa: escura, cota de malha curta, manoplas de ampulheta, manoplas de placa para cavaleiros, calças nobres acolchoadas, perneiras laminares de cavaleiro, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz bordado | `Hood06_m09_B` | – |
| Tronco | Aketon curto | `GambesonShort04_m08_C3` | – |
| Tronco | Brigandina milanesa: escura | `Brigandine05_m01_C3` | – |
| Tronco | Cota de malha curta | `MailShort01_m02_C4` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m09_A5` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar malesov-6` · Vestir: `/conjunto vestir malesov-6`

### `malesov-7` — Guarda de Bergow, nível 5

**Categoria:** nobre · **Peso:** pesada · **Preço:** 25.731 g

Bacinete de cavaleiro, capuz de malha com brasão, cota de malha curta, couraça de Magdeburg, gibão curto, mangas laminares de nobre, manoplas de ampulheta, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mBergov_B3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça de Magdeburg | `Cuirass02_m01_B4` | – |
| Tronco | Gibão curto | `GambesonShort03_m06_A4` | – |
| Braços | Mangas laminares de nobre | `BrigandineArm06_m01_B5` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m03_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar malesov-7` · Vestir: `/conjunto vestir malesov-7`

### `malesov-8` — Soldado de Bergow, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 1.495 g

Capacete encardido, almofre acolchoado rústico, capuz de servo, aketon curto, cotoveleiras com rondelas, luvas, calça acolchoada, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete encardido | `SkullCap01_m01_D1` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_mBergov_C` | – |
| Tronco | Aketon curto | `GambesonShort04_m02_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Luvas | `Gloves02_m01_D3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m07_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar malesov-8` · Vestir: `/conjunto vestir malesov-8`

### `malesov-9` — Soldado de Bergow, nível 2

**Categoria:** comum · **Peso:** média · **Preço:** 7.169 g

Capacete de chaleira alto, almofre acolchoado rústico, capuz de servo, cota de malha saxônica, jaquetão longo, túnica de montaria, luvas de equitação, mangas laminares simples, chausses acolchoadas, perneiras de brigandina antigas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m01_A4` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_mPrague02` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m03_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mBergov_B` | – |
| Braços | Luvas de equitação | `Gloves05_m01_B2` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m02_D2` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar malesov-9` · Vestir: `/conjunto vestir malesov-9`

### `malesov-10` — Soldado de Bergow, nível 2

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.514 g

Capacete de chaleira saxão, capuz de malha com brasão, brigandina simples, cota de malha curta, jaquetão longo, túnica para cavaleiro, manoplas de cota de malha, manoplas de placa para cavaleiros, calça acolchoada, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mBergov_B3` | – |
| Tronco | Brigandina simples | `Brigandine01_m11_D3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mBergov_B` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m02_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m07_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar malesov-10` · Vestir: `/conjunto vestir malesov-10`

### `malesov-11` — Soldado de Bergow, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 4.186 g

Bacinete aberto, capuz de malha com brasão, cota de malha saxônica, jaquetão longo, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_m01_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar malesov-11` · Vestir: `/conjunto vestir malesov-11`

### `malesov-12` — Soldado de Bergow, nível 3

**Categoria:** comum · **Peso:** pesada · **Preço:** 7.404 g

Bacinete aberto, almofre de malha, couraça lisa, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de ampulheta, chausses acolchoadas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mBergov_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar malesov-12` · Vestir: `/conjunto vestir malesov-12`

### `malesov-13` — Soldado de Bergow, nível 3

**Categoria:** boa · **Peso:** média · **Preço:** 12.892 g

Capacete de chaleira em forma de sino, almofre de malha, cota de malha saxônica, jaquetão longo, casaco de caça, mangas laminares com rondelas, manoplas de ampulheta, chausses acolchoadas, perneiras de placa saxônicas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco de caça | `Coat05_m05_C` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m04_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m02_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar malesov-13` · Vestir: `/conjunto vestir malesov-13`

### `malesov-14` — Soldado de Bergow, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 6.768 g

Capacete de chaleira alto, capuz de malha com brasão, cota de malha saxônica, jaquetão longo, túnica com bainha, cotoveleiras com rondelas, manoplas de cota de malha, calças acolchoadas velhas, perneiras de brigandina antigas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m01_A4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mBergov_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mBergov_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m01_E1` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m02_D2` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar malesov-14` · Vestir: `/conjunto vestir malesov-14`

### `malesov-15` — Soldado de Bergow, nível 4

**Categoria:** boa · **Peso:** média · **Preço:** 9.334 g

Capacete de chaleira saxão, coifa acolchoada, capuz de servo, cota de malha italiana, jaquetão longo, túnica para cavaleiro, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_m02_C` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mBergov_B` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m02_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar malesov-15` · Vestir: `/conjunto vestir malesov-15`

### `malesov-16` — Soldado de Bergow, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.482 g

Capacete de chaleira com bico, almofre de malha, cota de malha curta, couraça lisa, jaquetão longo, túnica de montaria, manoplas de nobre, manoplas de placa para cavaleiros, calça acolchoada, perneiras de placa da Baviera, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_m04_B` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m03_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m06_C3` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar malesov-16` · Vestir: `/conjunto vestir malesov-16`

### `malesov-17` — Soldado de Bergow, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.252 g

Bacinete de cavaleiro, almofre de malha, cota de malha saxônica, couraça lisa, jaquetão longo, túnica de montaria, mangas laminares simples, manoplas de cota de malha, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mBergov_B` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar malesov-17` · Vestir: `/conjunto vestir malesov-17`

### `malesov-18` — Soldado de Bergow, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 17.208 g

Capacete de chaleira com saliência, almofre de malha, cota de malha saxônica, couraça de equitação, jaquetão longo, mangas reforçadas e temperadas, manoplas milanesas, chausses acolchoadas, perneiras de placa saxônicas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m03_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça de equitação | `Cuirass05_m01_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m01_C2` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m01_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar malesov-18` · Vestir: `/conjunto vestir malesov-18`

### `malesov-19` — Soldado de Bergow, nível 5

**Categoria:** nobre · **Peso:** pesada · **Preço:** 37.748 g

Bacinete italiano, almofre acolchoado rústico, capuz bordado, aketon curto, cota de malha curta, couraça com faldas, mangas com proteção de Nuremberg, manoplas de Nuremberg, calças nobres acolchoadas, perneiras laminares de cavaleiro, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m01_C4` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz bordado | `Hood06_m03_B` | – |
| Tronco | Aketon curto | `GambesonShort04_m01_C3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça com faldas | `Brigandine10_m08_A5` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m02_A5` | – |
| Braços | Manoplas de Nuremberg | `Gauntlets05_m01_A5` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m09_A5` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar malesov-19` · Vestir: `/conjunto vestir malesov-19`

## Praga

**Cavalo:** `/horse gear preset oblehaniSuchdole_horse_prague01` (de Praga, no cerco de Suchdol); os outros em [Cavalo de Praga](#cavalo-de-praga).

### `praga-1` — Soldado de Praga, nível 1

**Categoria:** básica · **Peso:** leve · **Preço:** 570 g

Almofre, gola acolchoada, gorro pontudo, casaco comum de Praga com brasão, túnica de minerador, bandagem de mão, calça com ligas, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Almofre | `CoifCap01_m01_C` | – |
| Pescoço | Gola acolchoada | `CollarPadded01_m01_C1` | – |
| Cabeça | Gorro pontudo | `Cap09_m01_C` | – |
| Por cima | Casaco comum de Praga com brasão | `Coat04_mPrague_C` | – |
| Por cima | Túnica de minerador | `TunicShort03_m03_D` | – |
| Mãos | Bandagem de mão | `HandWrap01_m01_E` | – |
| Pernas | Calça com ligas | `HoseJoined02_m21_B` | – |
| Pés | Botas firmes | `BootsAnkle05_m02_C` | – |

Dar: `/conjunto dar praga-1` · Vestir: `/conjunto vestir praga-1`

### `praga-2` — Soldado de Praga, nível 1

**Categoria:** básica · **Peso:** leve · **Preço:** 890 g

Capuz de servo, chapéu boêmio, jaquetão longo, casaco comum, cotoveleiras, luvas do punguista, calça costurada, botas de equitação.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capuz de servo | `Hood11_mPrague01` | – |
| Cabeça | Chapéu boêmio | `Cap17_m04_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat02_m05_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Calça costurada | `HoseJoined01_m04_C` | – |
| Pés | Botas de equitação | `BootsKnee03_m01_C` | – |

Dar: `/conjunto dar praga-2` · Vestir: `/conjunto vestir praga-2`

### `praga-3` — Soldado de Praga, nível 1

**Categoria:** básica · **Peso:** leve · **Preço:** 1.304 g

Almofre, gola acolchoada, gorro de feltro, jaquetão longo, túnica de Praga com botões, chausses acolchoadas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Almofre | `CoifCap01_m03_C` | – |
| Pescoço | Gola acolchoada | `CollarPadded01_m01_C1` | – |
| Cabeça | Gorro de feltro | `Cap03_m03_E` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica de Praga com botões | `Waffenrock03_mPrague_A` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar praga-3` · Vestir: `/conjunto vestir praga-3`

### `praga-4` — Soldado de Praga, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.017 g

Capacete de chaleira composto, coifa acolchoada, capuz de servo, jaquetão longo, cotoveleiras, luvas de equitação, calça costurada, botas de equitação.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mPrague01` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m03_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas de equitação | `Gloves05_m01_B2` | – |
| Pernas | Calça costurada | `HoseJoined01_m04_C` | – |
| Pés | Botas de equitação | `BootsKnee03_m03_C` | – |

Dar: `/conjunto dar praga-4` · Vestir: `/conjunto vestir praga-4`

### `praga-5` — Soldado de Praga, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 3.066 g

Bacinete aberto, coifa acolchoada, gola de armadura, jaquetão longo, túnica com bainha de Praga, cotoveleiras com rondelas, luvas do punguista, chausses acolchoadas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Túnica com bainha de Praga | `Waffenrock01_mPrague01_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar praga-5` · Vestir: `/conjunto vestir praga-5`

### `praga-6` — Soldado de Praga, nível 2

**Categoria:** comum · **Peso:** leve · **Preço:** 7.096 g

Bacinete com bretache, coifa acolchoada, jaquetão longo, túnica com bainha de Praga, manoplas de ampulheta, chausses acolchoadas, botas do cortesão.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m07_C3` | – |
| Por cima | Túnica com bainha de Praga | `Waffenrock01_mPrague01_C` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Botas do cortesão | `BootsAnkle04_m03_A` | – |

Dar: `/conjunto dar praga-6` · Vestir: `/conjunto vestir praga-6`

### `praga-7` — Soldado de Praga, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 6.362 g

Capacete de chaleira alto, coifa acolchoada, gola de armadura, cota de malha italiana, jaquetão longo, túnica com bainha de Praga, cotoveleiras, manoplas de ampulheta, chausses acolchoadas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m01_A4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m04_C1` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Túnica com bainha de Praga | `Waffenrock01_mPrague01_C` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar praga-7` · Vestir: `/conjunto vestir praga-7`

### `praga-8` — Soldado de Praga, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 8.063 g

Capacete de chaleira em forma de sino, coifa acolchoada, gola de armadura, cota de malha saxônica, jaquetão curto, casaco comum de Praga com brasão, mangas laminares simples, manoplas de nobre, chausses acolchoadas, perneiras de meia placa, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m04_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão curto | `GambesonShort01_m01_D2` | – |
| Por cima | Casaco comum de Praga com brasão | `Coat04_mPrague_C` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar praga-8` · Vestir: `/conjunto vestir praga-8`

### `praga-9` — Soldado de Praga, nível 3

**Categoria:** boa · **Peso:** média · **Preço:** 13.152 g

Bacinete com bretache, coifa acolchoada, cota de malha longa, jaquetão longo, túnica de Praga com botões, cotoveleiras com rondelas, manoplas de ampulheta, calça acolchoada, perneiras de brigandina de nobre, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica de Praga com botões | `Waffenrock03_mPrague_A` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m03_B4` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar praga-9` · Vestir: `/conjunto vestir praga-9`

### `praga-10` — Soldado de Praga, nível 4

**Categoria:** comum · **Peso:** pesada · **Preço:** 6.091 g

Capacete de chaleira saxão, capuz de malha com brasão, brigandina simples, jaquetão longo, túnica de montaria de Praga, cotoveleiras com rondelas, luvas do punguista, chausses acolchoadas, joelheiras, botas de equitação.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mPrague_B3` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m03_C3` | – |
| Por cima | Túnica de montaria de Praga | `Waffenrock08_mPrague_B` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Botas de equitação | `BootsKnee03_m01_C` | – |

Dar: `/conjunto dar praga-10` · Vestir: `/conjunto vestir praga-10`

### `praga-11` — Soldado de Praga, nível 4

**Categoria:** excelente · **Peso:** pesada · **Preço:** 17.367 g

Bacinete saxão, almofre de malha, brigandina milanesa, jaquetão curto, braço de brigandina, manoplas de cota de malha, chausses acolchoadas, perneiras de placa saxônicas, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete saxão | `BascinetVisor01_m01_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m03_C3` | – |
| Tronco | Jaquetão curto | `GambesonShort01_m02_D2` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m01_B4` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m01_C3` | – |
| Pés | Botas de viagem | `BootsAnkle02_m01_B` | – |

Dar: `/conjunto dar praga-11` · Vestir: `/conjunto vestir praga-11`

### `praga-12` — Soldado de Praga, nível 4

**Categoria:** nobre · **Peso:** pesada · **Preço:** 27.080 g

Bacinete de Nuremberg, almofre de malha, couraça com faldas, jaquetão longo, túnica ornamentada, braço de brigandina, manoplas de nobre, chausses acolchoadas, perneiras de brigandina de nobre, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m01_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Couraça com faldas | `Brigandine10_m02_A5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Túnica ornamentada | `Waffenrock04_m04_A` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m05_B4` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m06_B4` | – |
| Pés | Botas de viagem | `BootsAnkle02_m01_B` | – |

Dar: `/conjunto dar praga-12` · Vestir: `/conjunto vestir praga-12`

## Písek

### `pisek-1` — Soldado de Písek, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 3.932 g

Capacete de chaleira em forma de sino, coifa acolchoada, capuz de servo, cota de malha italiana, jaquetão longo, cotoveleiras, manoplas de cota de malha, calça acolchoada, joelheiras em forma de folha, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mPisek_C` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar pisek-1` · Vestir: `/conjunto vestir pisek-1`

### `pisek-2` — Soldado de Písek, nível 3

**Categoria:** comum · **Peso:** pesada · **Preço:** 7.050 g

Bacinete em forma de sino, almofre de malha, couraça lisa, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de ampulheta, calça acolchoada, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete em forma de sino | `BascinetOpen02_m01_C1` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m06_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mPisek_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar pisek-2` · Vestir: `/conjunto vestir pisek-2`

### `pisek-3` — Soldado de Písek, nível 3

**Categoria:** boa · **Peso:** pesada · **Preço:** 10.461 g

Capacete de chaleira com saliência, almofre de malha, couraça lisa, jaquetão longo, mangas laminares simples, manoplas de ampulheta, calça acolchoada, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m02_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m04_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m06_C3` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar pisek-3` · Vestir: `/conjunto vestir pisek-3`

### `pisek-4` — Soldado de Písek, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 6.924 g

Capacete de chaleira com saliência, almofre de malha, cota de malha italiana, jaquetão longo, casaco de caça, cotoveleiras com rondelas, manoplas de nobre, chausses acolchoadas, perneiras de meia placa, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Casaco de caça | `Coat05_m07_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar pisek-4` · Vestir: `/conjunto vestir pisek-4`

### `pisek-5` — Soldado de Písek, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 8.450 g

Capacete de chaleira em forma de sino, capuz de malha com brasão, cota de malha saxônica, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de cota de malha, calças acolchoadas velhas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mPisek_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mPisek_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m01_E1` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar pisek-5` · Vestir: `/conjunto vestir pisek-5`

### `pisek-6` — Soldado de Písek, nível 4

**Categoria:** boa · **Peso:** média · **Preço:** 9.802 g

Capacete de chaleira alto, coifa acolchoada, capuz de servo, cota de malha curta, jaquetão longo, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m05_A4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_m10_C` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m06_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m04_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar pisek-6` · Vestir: `/conjunto vestir pisek-6`

### `pisek-7` — Soldado de Písek, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 12.967 g

Bacinete de cavaleiro, almofre de malha, cota de malha saxônica, couraça lisa, jaquetão longo, túnica de montaria, mangas laminares com rondelas, manoplas de cota de malha, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_mPisek_B` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m03_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar pisek-7` · Vestir: `/conjunto vestir pisek-7`

### `pisek-8` — Soldado de Písek, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 16.633 g

Bacinete italiano, almofre acolchoado rústico, aketon curto, brigandina milanesa, cota de malha curta, mangas reforçadas e temperadas, manoplas milanesas, calças nobres acolchoadas, perneiras de brigandina antigas, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m03_C4` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Tronco | Aketon curto | `GambesonShort04_m04_C3` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m06_C3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m03_C2` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m05_D2` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar pisek-8` · Vestir: `/conjunto vestir pisek-8`

### `pisek-9` — Soldado de Písek, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 17.184 g

Bacinete de cavaleiro, capuz de malha com brasão, brigandina saxônica, cota de malha saxônica, jaquetão longo, manoplas de cota de malha, manoplas de placa para cavaleiros, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mPisek_B3` | – |
| Tronco | Brigandina saxônica | `Brigandine03_m02_A4` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m04_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar pisek-9` · Vestir: `/conjunto vestir pisek-9`

## Semine

**Cavalo:** `/horse gear preset battle_semin_08` (cavaleiro de Semine); os outros em [Cavalo de Semine](#cavalo-de-semine).

### `semine-1` — Soldado de Semine, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 1.989 g

Capacete de chaleira composto, coifa acolchoada, capuz de servo, jaquetão longo, cotoveleiras, luvas do punguista, calças de mendigo, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mSemin_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Calças de mendigo | `HoseSeparate04_m01_E` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar semine-1` · Vestir: `/conjunto vestir semine-1`

### `semine-2` — Soldado de Semine, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.466 g

Capacete de Rondel, almofre acolchoado rústico, capuz de servo, jaquetão longo, cotoveleiras com rondelas, luvas, calças nobres acolchoadas, joelheiras em forma de folha, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m01_C3` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_mSemin02_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Luvas | `Gloves02_m01_D3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar semine-2` · Vestir: `/conjunto vestir semine-2`

### `semine-3` — Soldado de Semine, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.790 g

Capacete de chaleira composto, almofre acolchoado rústico, gola acolchoada, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Pescoço | Gola acolchoada | `CollarPadded01_m05_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mSemin_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m04_C` | – |

Dar: `/conjunto dar semine-3` · Vestir: `/conjunto vestir semine-3`

### `semine-4` — Soldado de Semine, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 4.092 g

Bacinete aberto, coifa acolchoada, gola de armadura, cota de malha saxônica, jaquetão longo, sobretudo de brasão, manoplas de cota de malha, chausses acolchoadas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mSemin_D` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar semine-4` · Vestir: `/conjunto vestir semine-4`

### `semine-5` — Soldado de Semine, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 6.187 g

Capacete de chaleira em forma de sino, coifa acolchoada, capuz de servo, cota de malha saxônica, jaquetão longo, sobretudo de brasão, mangas laminares simples, manoplas de nobre, calça acolchoada, joelheiras, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mSemin02_C` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mSemin_D` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m05_D1` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m06_C2` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m06_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m04_C` | – |

Dar: `/conjunto dar semine-5` · Vestir: `/conjunto vestir semine-5`

### `semine-6` — Soldado de Semine, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 7.151 g

Bacinete com camal, almofre de malha, cota de malha saxônica, jaquetão de torneio, túnica simples, mangas laminares simples, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina antigas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m02_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão de torneio | `GambesonLong01_m01_C3_KHtournament_Henry` | – |
| Por cima | Túnica simples | `Waffenrock02_mSemin_D` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m05_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m03_D2` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar semine-6` · Vestir: `/conjunto vestir semine-6`

### `semine-7` — Soldado de Semine, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 5.914 g

Bacinete em forma de sino, capuz de malha com brasão, cota de malha saxônica, jaquetão longo, casaco comum, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete em forma de sino | `BascinetOpen02_m01_C1` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mSemin_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat04_m10_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos simples | `Shoes01_m03_D` | – |

Dar: `/conjunto dar semine-7` · Vestir: `/conjunto vestir semine-7`

### `semine-8` — Soldado de Semine, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 10.507 g

Bacinete com camal, almofre de malha, brigandina milanesa, cota de malha saxônica, gibão longo, manoplas de cota de malha, manoplas de placa para cavaleiros, chausses acolchoadas, perneiras de brigandina antigas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m02_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m03_C2` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m06_C3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Gibão longo | `GambesonLong03_m02_B4` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m05_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar semine-8` · Vestir: `/conjunto vestir semine-8`

### `semine-9` — Soldado de Semine, nível 4

**Categoria:** excelente · **Peso:** pesada · **Preço:** 19.138 g

Bacinete aberto, capuz de malha com brasão, cota de malha italiana, couraça de equitação, jaquetão longo, braço de brigandina, manoplas de ampulheta, chausses acolchoadas, perneiras de brigandina de nobre, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m02_C2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mSemin_B3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça de equitação | `Cuirass05_m03_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m11_C3` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m10_B4` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m03_B4` | – |
| Pés | Sapatos simples | `Shoes01_m04_D` | – |

Dar: `/conjunto dar semine-9` · Vestir: `/conjunto vestir semine-9`

## Nebakov

**Cavalo:** `/horse gear preset utokNaNebakov_bartosHorse` (no ataque a Nebakov); os outros em [Cavalo de Nebakov](#cavalo-de-nebakov).

### `nebakov-1` — Soldado de Nebakov, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.207 g

Capacete escamado, almofre acolchoado rústico, capuz de servo, jaquetão longo, casaco comum, manoplas de cota de malha, calças acolchoadas velhas, joelheiras, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete escamado | `SkullCap03_m01_D2` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_mNebak_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Casaco comum | `Coat02_m13_D` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m03_E1` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar nebakov-1` · Vestir: `/conjunto vestir nebakov-1`

### `nebakov-2` — Soldado de Nebakov, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.444 g

Capacete de chaleira composto, coifa acolchoada, gola de armadura, jaquetão longo, túnica simples, cotoveleiras, luvas, calça acolchoada, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m02_D2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica simples | `Waffenrock02_mNebak_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas | `Gloves02_m06_D3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar nebakov-2` · Vestir: `/conjunto vestir nebakov-2`

### `nebakov-3` — Soldado de Nebakov, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.835 g

Capacete de Rondel, almofre de malha, jaquetão curto, sobretudo de brasão, cotoveleiras com rondelas, luvas do punguista, chausses acolchoadas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m01_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão curto | `GambesonShort01_m02_D2` | – |
| Por cima | Sobretudo de brasão | `Coat02_mNebak_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar nebakov-3` · Vestir: `/conjunto vestir nebakov-3`

### `nebakov-4` — Soldado de Nebakov, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 7.898 g

Bacinete aberto, almofre de malha, cota de malha saxônica, jaquetão longo, túnica com bainha, mangas laminares simples, manoplas de nobre, calça acolchoada, perneiras de meia placa, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m03_C2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mNebak_C` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m04_D1` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m02_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar nebakov-4` · Vestir: `/conjunto vestir nebakov-4`

### `nebakov-5` — Soldado de Nebakov, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 8.663 g

Bacinete com camal, coifa acolchoada, cota de malha italiana, jaquetão longo, sobretudo de brasão, mangas laminares com rondelas, manoplas de cota de malha, calça acolchoada, perneiras de brigandina antigas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_mKomar` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mNebak_D` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m04_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m05_D2` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar nebakov-5` · Vestir: `/conjunto vestir nebakov-5`

### `nebakov-6` — Soldado de Nebakov, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 6.845 g

Capacete de chaleira com bico, capuz de malha com brasão, cota de malha saxônica, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de cota de malha, calças nobres acolchoadas, perneiras de meia placa, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mNebak_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m03_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mNebak_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar nebakov-6` · Vestir: `/conjunto vestir nebakov-6`

### `nebakov-7` — Soldado de Nebakov, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 15.087 g

Bacinete com camal, capuz de malha com brasão, cota de malha saxônica, couraça de equitação, jaquetão longo, túnica para cavaleiro, mangas laminares com rondelas, manoplas de ampulheta, calças nobres acolchoadas, perneiras de meia placa, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m01_B3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mNebak_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça de equitação | `Cuirass05_m03_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mNebak_B` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m03_C` | – |

Dar: `/conjunto dar nebakov-7` · Vestir: `/conjunto vestir nebakov-7`

### `nebakov-8` — Homem armado de Nebakov

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.284 g

Capacete de chaleira alto, almofre de malha, brigandina simples, cota de malha italiana, jaquetão longo, casaco acolchoado, cotoveleiras com rondelas, manoplas de nobre, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m03_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m04_C2` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Casaco acolchoado | `Coat07_m04_B` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m01_C2` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar nebakov-8` · Vestir: `/conjunto vestir nebakov-8`

### `nebakov-9` — Homem armado de Nebakov

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.630 g

Capacete de chaleira alto, capuz de malha com brasão, capuz de servo, brigandina simples, cota de malha italiana, jaquetão longo, casaco acolchoado, cotoveleiras com rondelas, manoplas de nobre, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m04_A4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mNebak_B3` | – |
| Cabeça | Capuz de servo | `Hood11_mNebak_C` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Casaco acolchoado | `Coat07_m04_B` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m01_C2` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar nebakov-9` · Vestir: `/conjunto vestir nebakov-9`

## Trosky

**Cavalo:** `/horse gear preset ttro_bergovHorse` (Lorde von Bergow); os outros em [Cavalo de Trosky](#cavalo-de-trosky).

### `trosky-1` — Homem armado de Trosky

**Categoria:** boa · **Peso:** pesada · **Preço:** 13.755 g

Bacinete com bretache, grande almofre de batalha, cota de malha saxônica, couraça lisa, jaquetão de nobre, cotoveleiras com rondelas, manoplas de nobre, chausses acolchoadas, perneiras de placa saxônicas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_m01_D2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão de nobre | `GambesonLong04_m01_A5` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m01_C3` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar trosky-1` · Vestir: `/conjunto vestir trosky-1`

### `trosky-2` — Homem armado de Trosky

**Categoria:** excelente · **Peso:** pesada · **Preço:** 20.314 g

Bacinete de cavaleiro, capuz de malha com brasão, aketon curto, brigandina milanesa, mangas laminares de nobre, manoplas de ampulheta, chausses acolchoadas, perneiras de placa da Baviera, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mBergov_B3` | – |
| Tronco | Aketon curto | `GambesonShort04_m02_C3` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m03_C3` | – |
| Braços | Mangas laminares de nobre | `BrigandineArm06_m01_B5` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pés | Sapatos macios | `Shoes03_m01_C` | – |

Dar: `/conjunto dar trosky-2` · Vestir: `/conjunto vestir trosky-2`

### `trosky-3` — Homem armado de Trosky

**Categoria:** excelente · **Peso:** pesada · **Preço:** 24.899 g

Bacinete do nobre, grande almofre de batalha, gibão longo, kastenbrust, braço de brigandina, luvas do punguista, chausses acolchoadas, perneiras de placa saxônicas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete do nobre | `BascinetVisor04_m01_A5` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_m01_D2` | – |
| Tronco | Gibão longo | `GambesonLong03_m01_B4` | – |
| Tronco | Kastenbrust | `Cuirass08_m01_C4` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m01_B4` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m01_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar trosky-3` · Vestir: `/conjunto vestir trosky-3`

## Lípa

**Cavalo:** `/horse gear preset battle_leipa_08` (cavaleiro de Leipa); os outros em [Cavalo de Lípa](#cavalo-de-lípa).

### `lipa-1` — Soldado dos senhores de Lípa, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.695 g

Capacete de chaleira em forma de sino, almofre acolchoado rústico, capuz de servo, jaquetão longo, cotoveleiras, luvas de equitação, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_m01_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas de equitação | `Gloves05_m01_B2` | – |
| Pernas | Calças simples | `HoseSeparate01_m05_D` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar lipa-1` · Vestir: `/conjunto vestir lipa-1`

### `lipa-2` — Soldado dos senhores de Lípa, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 3.123 g

Capacete de chaleira composto, coifa acolchoada, gola de armadura, jaquetão longo, túnica para cavaleiro, cotoveleiras, manoplas de cota de malha, calças acolchoadas do nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m02_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mLeipa_B` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m07_B2` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar lipa-2` · Vestir: `/conjunto vestir lipa-2`

### `lipa-3` — Soldado dos senhores de Lípa, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 3.713 g

Bacinete aberto, coifa acolchoada, capuz simples, cota de malha italiana, jaquetão longo, cotoveleiras, manoplas de cota de malha, chausses acolchoadas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz simples | `Hood01_m06_D` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar lipa-3` · Vestir: `/conjunto vestir lipa-3`

### `lipa-4` — Soldado dos senhores de Lípa, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 4.831 g

Capacete de chaleira alto, almofre de malha, cota de malha saxônica, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m06_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mLeipa_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar lipa-4` · Vestir: `/conjunto vestir lipa-4`

### `lipa-5` — Soldado dos senhores de Lípa, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 6.990 g

Capacete de chaleira composto, almofre de malha, cota de malha saxônica, jaquetão longo, túnica simples, cotoveleiras com rondelas, manoplas de ampulheta, calça acolchoada, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica simples | `Waffenrock02_m02_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar lipa-5` · Vestir: `/conjunto vestir lipa-5`

### `lipa-6` — Soldado dos senhores de Lípa, nível 4

**Categoria:** comum · **Peso:** leve · **Preço:** 8.912 g

Bacinete aberto, almofre de malha, jaquetão longo, túnica simples, mangas laminares com rondelas, manoplas de nobre, chausses acolchoadas, perneiras de brigandina antigas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Túnica simples | `Waffenrock02_m03_D` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m06_C3` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m01_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m08_D2` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar lipa-6` · Vestir: `/conjunto vestir lipa-6`

### `lipa-7` — Soldado dos senhores de Lípa, nível 4

**Categoria:** boa · **Peso:** leve · **Preço:** 11.827 g

Bacinete italiano, almofre de malha, jaquetão longo, casaco de caça, mangas laminares simples, manoplas milanesas, chausses acolchoadas, perneiras de meia placa, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m01_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Por cima | Casaco de caça | `Coat05_m07_C` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m04_D1` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar lipa-7` · Vestir: `/conjunto vestir lipa-7`

### `lipa-8` — Soldado dos senhores de Lípa, nível 4

**Categoria:** boa · **Peso:** leve · **Preço:** 13.569 g

Bacinete com camal, almofre de malha, jaquetão longo, túnica com fecho, braço de brigandina, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m03_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Por cima | Túnica com fecho | `Waffenrock03_m02_A` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m04_B4` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m06_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar lipa-8` · Vestir: `/conjunto vestir lipa-8`

## Kunštát

### `kunstat-1` — Soldado de Kunštát, nível 2

**Categoria:** comum · **Peso:** leve · **Preço:** 4.635 g

Capacete de Rondel, almofre de malha, jaquetão curto, túnica com fecho, luvas do punguista, chausses acolchoadas, perneiras de brigandina antigas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m01_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão curto | `GambesonShort01_m05_D2` | – |
| Por cima | Túnica com fecho | `Waffenrock03_m01_A` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar kunstat-1` · Vestir: `/conjunto vestir kunstat-1`

### `kunstat-2` — Soldado de Kunštát, nível 2

**Categoria:** comum · **Peso:** leve · **Preço:** 4.798 g

Capacete de chaleira composto, coifa acolchoada, gola de armadura, jaquetão longo, túnica simples, cotoveleiras, manoplas de cota de malha, calça acolchoada, perneiras de meia placa, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m02_D2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica simples | `Waffenrock02_mNebak_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m03_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m03_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar kunstat-2` · Vestir: `/conjunto vestir kunstat-2`

### `kunstat-3` — Soldado de Kunštát, nível 2

**Categoria:** comum · **Peso:** leve · **Preço:** 5.937 g

Capacete de chaleira saxão, almofre acolchoado rústico, capuz de servo, gibão do Erik, luvas, chausses acolchoadas, perneiras de meia placa, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m02_A5` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_mNebak_C` | – |
| Tronco | Gibão do Erik | `GambesonLong03_mErik` | – |
| Braços | Luvas | `Gloves02_m01_D3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar kunstat-3` · Vestir: `/conjunto vestir kunstat-3`

### `kunstat-4` — Soldado de Kunštát, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 5.943 g

Capacete de chaleira com saliência, almofre de malha, capuz simples, cota de malha saxônica, jaquetão longo, túnica com bainha, manoplas de ampulheta, calça acolchoada, joelheiras em forma de folha, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Cabeça | Capuz simples | `Hood01_m02_D` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mNebak_C` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar kunstat-4` · Vestir: `/conjunto vestir kunstat-4`

### `kunstat-5` — Soldado de Kunštát, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 7.981 g

Bacinete com camal, almofre de malha, cota de malha saxônica, jaquetão longo, túnica com bainha, cotoveleiras, manoplas de ampulheta, calça acolchoada, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m02_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mNebak_C` | – |
| Braços | Cotoveleiras | `ArmPlate03_m02_D1` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m03_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m03_D1` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar kunstat-5` · Vestir: `/conjunto vestir kunstat-5`

### `kunstat-6` — Soldado de Kunštát, nível 3

**Categoria:** boa · **Peso:** média · **Preço:** 12.127 g

Bacinete com bretache, almofre de malha, cota de malha longa, jaquetão longo, túnica de montaria, mangas laminares simples, manoplas de ampulheta, calça acolchoada, perneiras de meia placa, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha longa | `MailLong01_m02_C5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_m03_B` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m04_D1` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m03_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m03_D1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar kunstat-6` · Vestir: `/conjunto vestir kunstat-6`

### `kunstat-7` — Soldado de Kunštát, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 7.668 g

Capacete de chaleira com bico, capuz de malha com brasão, cota de malha curta, jaquetão longo, cotoveleiras com rondelas, manoplas de cota de malha, calças nobres acolchoadas, perneiras de meia placa, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mNebak_B3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar kunstat-7` · Vestir: `/conjunto vestir kunstat-7`

### `kunstat-8` — Soldado de Kunštát, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.859 g

Bacinete com camal, capuz de malha com brasão, cota de malha saxônica, couraça lisa, jaquetão longo, mangas laminares com rondelas, manoplas de ampulheta, calças nobres acolchoadas, perneiras de placa da Baviera, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m01_B3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mNebak_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pés | Botas firmes | `BootsAnkle05_m03_C` | – |

Dar: `/conjunto dar kunstat-8` · Vestir: `/conjunto vestir kunstat-8`

## Ruthard

**Cavalo:** `/horse gear preset battle_ruthard_06` (cavaleiro de Ruthard); os outros em [Cavalo de Ruthard](#cavalo-de-ruthard).

### `ruthard-1` — Soldado de Ruthard, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.487 g

Capacete de aço, capuz de malha com brasão, jaquetão longo, túnica com bainha, cotoveleiras com rondelas, luvas, calça com ligas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m01_C2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m20_B3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mRuthart_C` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m04_C2` | – |
| Braços | Luvas | `Gloves02_m01_D3` | – |
| Pernas | Calça com ligas | `HoseJoined02_m09_B` | – |
| Pés | Sapatos macios | `Shoes03_m01_C` | – |

Dar: `/conjunto dar ruthard-1` · Vestir: `/conjunto vestir ruthard-1`

### `ruthard-2` — Soldado de Ruthard, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.799 g

Capacete de aço, coifa acolchoada, gola de armadura, jaquetão longo, túnica simples, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, joelheiras, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m03_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m05_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m06_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Túnica simples | `Waffenrock02_mRuthart_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m03_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m01_C` | – |

Dar: `/conjunto dar ruthard-2` · Vestir: `/conjunto vestir ruthard-2`

### `ruthard-3` — Soldado de Ruthard, nível 3

**Categoria:** boa · **Peso:** média · **Preço:** 11.699 g

Capacete de chaleira com saliência, capuz de malha com brasão, cota de malha italiana, jaquetão longo, sobretudo de brasão, braço de brigandina, manoplas milanesas, chausses acolchoadas, joelheiras em forma de folha, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mRuthart_D` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m02_B4` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar ruthard-3` · Vestir: `/conjunto vestir ruthard-3`

### `ruthard-4` — Soldado de Ruthard, nível 3

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.440 g

Bacinete aberto, capuz de malha com brasão, cota de malha italiana, couraça de Magdeburg, jaquetão longo, casaco acolchoado, mangas laminares com rondelas, manoplas de ampulheta, calça com ligas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça de Magdeburg | `Cuirass02_m01_B4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Por cima | Casaco acolchoado | `Coat07_m04_B` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m03_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça com ligas | `HoseJoined02_m02_B` | – |
| Pés | Sapatos macios | `Shoes03_m01_C` | – |

Dar: `/conjunto dar ruthard-4` · Vestir: `/conjunto vestir ruthard-4`

### `ruthard-5` — Soldado de Ruthard, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 9.741 g

Capacete de chaleira alto, capuz de malha com brasão, brigandina milanesa, cota de malha saxônica, jaquetão longo, túnica simples, cotoveleiras com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de meia placa, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m06_A4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m04_C3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m19_B3` | – |
| Por cima | Túnica simples | `Waffenrock02_mRuthart01_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas firmes | `BootsAnkle05_m01_C` | – |

Dar: `/conjunto dar ruthard-5` · Vestir: `/conjunto vestir ruthard-5`

### `ruthard-6` — Soldado de Ruthard, nível 4

**Categoria:** excelente · **Peso:** pesada · **Preço:** 18.452 g

Bacinete com bretache, almofre de malha, jaquetão longo, kastenbrust, sobretudo de brasão, manoplas de placa para cavaleiros, manoplas milanesas, chausses acolchoadas, perneiras de brigandina de nobre, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Tronco | Kastenbrust | `Cuirass08_m01_C4` | – |
| Por cima | Sobretudo de brasão | `Coat02_mRuthart_D` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Botas de viagem | `BootsAnkle02_m01_B` | – |

Dar: `/conjunto dar ruthard-6` · Vestir: `/conjunto vestir ruthard-6`

### `ruthard-7` — Soldado de Ruthard, nível 4

**Categoria:** excelente · **Peso:** pesada · **Preço:** 22.502 g

Bacinete com camal, capuz de malha com brasão, couraça com faldas, gibão curto, mangas laminares com rondelas, manoplas de ampulheta, chausses acolchoadas, perneiras de brigandina de nobre, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m01_B3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Tronco | Couraça com faldas | `Brigandine10_m03_A5` | – |
| Tronco | Gibão curto | `GambesonShort03_m03_A4` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m02_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m02_B4` | – |
| Pés | Botas de viagem | `BootsAnkle02_m01_B` | – |

Dar: `/conjunto dar ruthard-7` · Vestir: `/conjunto vestir ruthard-7`

### `ruthard-8` — Soldado de Ruthard, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 24.626 g

Bacinete de cavaleiro, capuz de malha com brasão, cota de malha curta, couraça de Magdeburg, jaquetão longo, sobretudo de brasão, braço de brigandina, manoplas de cota de malha, chausses acolchoadas, perneiras milanesas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça de Magdeburg | `Cuirass02_m01_B4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mRuthart_D` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m08_B4` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras milanesas | `LegsPlate02_m02_B4` | – |

Dar: `/conjunto dar ruthard-8` · Vestir: `/conjunto vestir ruthard-8`

### `ruthard-9` — Soldado de Ruthard, nível 5

**Categoria:** nobre · **Peso:** pesada · **Preço:** 27.108 g

Bacinete italiano, capuz de malha com brasão, capuz bordado, cota de malha italiana, gibão longo, kastenbrust, túnica com bainha, mangas com proteção de Nuremberg, manoplas de ampulheta, chausses acolchoadas, perneiras de placa da Baviera, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m01_C4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | – |
| Cabeça | Capuz bordado | `Hood06_m01_B` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Gibão longo | `GambesonLong03_m03_B4` | – |
| Tronco | Kastenbrust | `Cuirass08_m01_C4` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mRuthart_C` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m02_A5` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m02_C3` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar ruthard-9` · Vestir: `/conjunto vestir ruthard-9`

## Vavák

### `vavak-1` — Soldado de Vavák, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 1.147 g

Almofre, capuz de servo, chapéu de caça, jaquetão longo, chausses acolchoadas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Almofre | `CoifCap01_m01_C` | – |
| Cabeça | Capuz de servo | `Hood11_mVavak_C` | – |
| Cabeça | Chapéu de caça | `Cap10_m04_B` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar vavak-1` · Vestir: `/conjunto vestir vavak-1`

### `vavak-2` — Soldado de Vavák, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 1.910 g

Capacete escamado, coifa acolchoada, gola de armadura, jaquetão longo, túnica para cavaleiro, cotoveleiras com rondelas, calça com ligas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete escamado | `SkullCap03_m01_D2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mVavak_B` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Pernas | Calça com ligas | `HoseJoined02_m03_B` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar vavak-2` · Vestir: `/conjunto vestir vavak-2`

### `vavak-3` — Soldado de Vavák, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.402 g

Capacete de chaleira composto, almofre acolchoado rústico, capuz de servo, jaquetão longo, cotoveleiras, luvas de equitação, chausses acolchoadas, joelheiras em forma de folha, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de servo | `Hood11_mVavak_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas de equitação | `Gloves05_m01_B2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar vavak-3` · Vestir: `/conjunto vestir vavak-3`

### `vavak-4` — Soldado de Vavák, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 5.947 g

Capacete de chaleira em forma de sino, almofre de malha, cota de malha saxônica, jaquetão longo, sobretudo de brasão, cotoveleiras com rondelas, manoplas de cota de malha, calças acolchoadas do nobre, perneiras de meia placa, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m06_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mVavak_D` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m04_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m02_D` | – |

Dar: `/conjunto dar vavak-4` · Vestir: `/conjunto vestir vavak-4`

### `vavak-5` — Soldado de Vavák, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 7.502 g

Bacinete em forma de sino, coifa acolchoada, capuz de servo, cota de malha italiana, jaquetão longo, cotoveleiras, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina de nobre, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete em forma de sino | `BascinetOpen02_m01_C1` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mVavak_C` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m05_B4` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar vavak-5` · Vestir: `/conjunto vestir vavak-5`

### `vavak-6` — Soldado de Vavák, nível 4

**Categoria:** boa · **Peso:** média · **Preço:** 10.119 g

Capacete de chaleira com saliência, coifa acolchoada, gola de armadura, cota de malha saxônica, jaquetão longo, túnica ornamentada, manoplas de cota de malha, manoplas de placa para cavaleiros, calças acolchoadas velhas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m03_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Túnica ornamentada | `Waffenrock04_m05_A` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m01_E1` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m05_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar vavak-6` · Vestir: `/conjunto vestir vavak-6`

### `vavak-7` — Soldado de Vavák, nível 4

**Categoria:** boa · **Peso:** leve · **Preço:** 11.338 g

Capacete de chaleira saxão, almofre de malha, jaquetão longo, túnica para cavaleiro, braçais de placa de Magdeburgo, manoplas milanesas, chausses acolchoadas, perneiras de meia placa, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m03_A5` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mVavak_B` | – |
| Braços | Braçais de placa de Magdeburgo | `ArmPlate05_m01_B4` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar vavak-7` · Vestir: `/conjunto vestir vavak-7`

### `vavak-8` — Soldado de Vavák, nível 4

**Categoria:** boa · **Peso:** leve · **Preço:** 15.000 g

Bacinete com bretache, almofre de malha, jaquetão longo, sobretudo de brasão, braço de brigandina, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mVavak_D` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m02_B4` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m02_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar vavak-8` · Vestir: `/conjunto vestir vavak-8`

### `vavak-9` — Soldado de Vavák, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.041 g

Capacete de chaleira saxão, almofre de malha, brigandina milanesa, cota de malha saxônica, jaquetão longo, sobretudo de brasão, manoplas de cota de malha, manoplas de placa para cavaleiros, calças nobres acolchoadas, perneiras de meia placa, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m03_A5` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m04_C3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m06_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mVavak_D` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m02_D` | – |

Dar: `/conjunto dar vavak-9` · Vestir: `/conjunto vestir vavak-9`

### `vavak-10` — Soldado de Vavák, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 13.090 g

Bacinete com camal, coifa acolchoada, gola de armadura, cota de malha italiana, couraça lisa: escurecida, jaquetão longo, túnica para cavaleiro, mangas reforçadas e temperadas, manoplas de cota de malha, chausses acolchoadas, perneiras de placa da Baviera, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com camal | `BascinetOpen08_m01_B3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça lisa: escurecida | `Cuirass01_m04_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_mVavak_B` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m07_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar vavak-10` · Vestir: `/conjunto vestir vavak-10`

### `vavak-11` — Soldado de Vavák, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 15.263 g

Bacinete saxão, capuz de malha com brasão, capuz de servo, cota de malha curta, couraça lisa, jaquetão longo, mangas reforçadas e temperadas, manoplas de ampulheta, chausses acolchoadas, perneiras de meia placa, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete saxão | `BascinetVisor01_m04_C3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_m01_B3` | – |
| Cabeça | Capuz de servo | `Hood11_mVavak_C` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m02_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas firmes | `BootsAnkle05_m01_C` | – |

Dar: `/conjunto dar vavak-11` · Vestir: `/conjunto vestir vavak-11`

## Polner

### `polner-1` — Homem de Polner

**Categoria:** boa · **Peso:** leve · **Preço:** 12.450 g

Capacete de chaleira com bico, capuz de malha com brasão, jaquetão longo, uniforme da família Polner, braço de brigandina, manoplas de nobre, chausses acolchoadas, perneiras de brigandina antigas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_m02_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Por cima | Uniforme da família Polner | `Waffenrock01_mPolner` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m09_B4` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m01_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m03_D2` | – |
| Pés | Sapatos macios | `Shoes03_m01_C` | – |

Dar: `/conjunto dar polner-1` · Vestir: `/conjunto vestir polner-1`

### `polner-2` — Homem de Polner

**Categoria:** boa · **Peso:** pesada · **Preço:** 16.328 g

Capacete de chaleira alto, capuz de malha com brasão, cota de malha italiana, couraça lisa, jaquetão longo, sobretudo de brasão, braço de brigandina, manoplas milanesas, chausses acolchoadas, perneiras de meia placa, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m06_A4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_m02_B3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m05_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mPolner_D` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m02_B4` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar polner-2` · Vestir: `/conjunto vestir polner-2`

### `polner-3` — Homem de Polner

**Categoria:** excelente · **Peso:** pesada · **Preço:** 18.452 g

Bacinete com bretache, almofre de malha, jaquetão longo, kastenbrust, sobretudo de brasão, manoplas de placa para cavaleiros, manoplas milanesas, chausses acolchoadas, perneiras de brigandina de nobre, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m09_C3` | – |
| Tronco | Kastenbrust | `Cuirass08_m01_C4` | – |
| Por cima | Sobretudo de brasão | `Coat02_mPolner_D` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m01_B4` | – |
| Pés | Botas de viagem | `BootsAnkle02_m01_B` | – |

Dar: `/conjunto dar polner-3` · Vestir: `/conjunto vestir polner-3`

## Jobst

### `jobst-1` — Homem de Jobst, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 13.780 g

Capacete de chaleira saxão, capuz de malha com brasão, brigandina milanesa: escura, cota de malha saxônica, jaquetão longo, casaco comum, mangas reforçadas e temperadas, manoplas de nobre, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira saxão | `KettleHat07_m01_A5` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_m01_B3` | – |
| Tronco | Brigandina milanesa: escura | `Brigandine05_m01_C3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Casaco comum | `Coat02_m03_D` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar jobst-1` · Vestir: `/conjunto vestir jobst-1`

### `jobst-2` — Homem de Jobst, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 24.782 g

Bacinete de Nuremberg, grande almofre de batalha, capuz de nobre, cota de malha curta, couraça lisa, jaquetão longo, túnica para cavaleiro, braço de brigandina, manoplas de ampulheta, calça acolchoada, perneiras milanesas, calças simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m01_A4` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_m01_D2` | – |
| Cabeça | Capuz de nobre | `Hood12_m01_A` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_m04_B` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m03_B4` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras milanesas | `LegsPlate02_m02_B4` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |

Dar: `/conjunto dar jobst-2` · Vestir: `/conjunto vestir jobst-2`

### `jobst-3` — Homem de Jobst, nível 5

**Categoria:** nobre · **Peso:** pesada · **Preço:** 27.787 g

Bacinete do nobre, almofre de malha, cota de malha saxônica, couraça lisa, jaquetão longo, túnica de montaria, braço de brigandina, manoplas de Nuremberg, calça acolchoada, perneiras de placa da Baviera, calças simples, botas de viagem.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete do nobre | `BascinetVisor04_m01_A5` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_m08_B` | – |
| Braços | Braço de brigandina | `BrigandineArm05_m03_B4` | – |
| Braços | Manoplas de Nuremberg | `Gauntlets05_m01_A5` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Botas de viagem | `BootsAnkle02_m01_B` | – |

Dar: `/conjunto dar jobst-3` · Vestir: `/conjunto vestir jobst-3`

## Sigismundo

### `sigismundo-1` — Soldado do exército de Sigismundo, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 2.029 g

Capacete de aço, coifa acolchoada, capuz simples, jaquetão longo, sobretudo de brasão, cotoveleiras, luvas, chausses acolchoadas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m01_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Cabeça | Capuz simples | `Hood01_m01_D` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Sobretudo de brasão | `Coat02_mMagyar01_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas | `Gloves02_m01_D3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Sapatos simples | `Shoes01_m03_D` | – |

Dar: `/conjunto dar sigismundo-1` · Vestir: `/conjunto vestir sigismundo-1`

### `sigismundo-2` — Soldado do exército de Sigismundo, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 3.191 g

Capacete de chaleira em forma de sino, coifa acolchoada, gola de armadura, jaquetão longo, casaco comum com brasão, cotoveleiras, luvas do punguista, chausses acolchoadas, joelheiras em forma de folha, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Casaco comum com brasão | `Coat04_mMagyar_C` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar sigismundo-2` · Vestir: `/conjunto vestir sigismundo-2`

### `sigismundo-3` — Soldado do exército de Sigismundo, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 3.227 g

Bacinete aberto, capuz de malha com brasão, jaquetão longo, casaco comum, cotoveleiras, luvas do punguista, chausses acolchoadas, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mMagyar_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m08_C3` | – |
| Por cima | Casaco comum | `Coat02_m05_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pés | Sapatos simples | `Shoes01_m02_D` | – |

Dar: `/conjunto dar sigismundo-3` · Vestir: `/conjunto vestir sigismundo-3`

### `sigismundo-4` — Soldado do exército de Sigismundo, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 4.394 g

Bacinete aberto, coifa acolchoada, gola de armadura, cota de malha saxônica, jaquetão longo, túnica com fecho, cotoveleiras, manoplas de cota de malha, chausses acolchoadas, joelheiras em forma de folha, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete aberto | `BascinetOpen01_m01_C2` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m07_C3` | – |
| Por cima | Túnica com fecho | `Waffenrock03_m03_A` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar sigismundo-4` · Vestir: `/conjunto vestir sigismundo-4`

### `sigismundo-5` — Soldado do exército de Sigismundo, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 4.967 g

Capacete de chaleira alto, coifa acolchoada, gola de armadura, cota de malha saxônica, jaquetão longo, túnica com bainha, cotoveleiras, manoplas de cota de malha, calça acolchoada, joelheiras em forma de folha, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m06_A4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mMagyar01_C` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar sigismundo-5` · Vestir: `/conjunto vestir sigismundo-5`

### `sigismundo-6` — Soldado do exército de Sigismundo, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 5.015 g

Capacete de chaleira com saliência, capuz de malha com brasão, gola de armadura, cota de malha saxônica, jaquetão longo, túnica com fecho, cotoveleiras, manoplas de cota de malha, calça acolchoada, joelheiras, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mMagyar_B3` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m07_C3` | – |
| Por cima | Túnica com fecho | `Waffenrock03_m04_A` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m11_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar sigismundo-6` · Vestir: `/conjunto vestir sigismundo-6`

### `sigismundo-7` — Soldado do exército de Sigismundo, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.705 g

Capacete de chaleira com saliência, almofre de malha, brigandina simples, cota de malha longa, jaquetão longo, casaco comum com brasão, mangas laminares com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina antigas, botas de equitação.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Casaco comum com brasão | `Coat04_mMagyar_C` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Botas de equitação | `BootsKnee03_m01_C` | – |

Dar: `/conjunto dar sigismundo-7` · Vestir: `/conjunto vestir sigismundo-7`

### `sigismundo-8` — Soldado do exército de Sigismundo, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 13.487 g

Capacete de chaleira com bico, almofre de malha, brigandina simples, cota de malha curta, jaquetão longo, túnica com bainha, mangas laminares com rondelas, manoplas de ampulheta, chausses acolchoadas, perneiras de brigandina antigas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mMagyar01_C` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar sigismundo-8` · Vestir: `/conjunto vestir sigismundo-8`

### `sigismundo-9` — Soldado do exército de Sigismundo, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.235 g

Capacete de chaleira alto, almofre de malha, capuz de servo, cota de malha curta, couraça lisa, jaquetão longo, casaco comum, mangas laminares com rondelas, manoplas de ampulheta, chausses acolchoadas, perneiras de brigandina antigas, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m02_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Cabeça | Capuz de servo | `Hood11_mMagyar_C` | – |
| Tronco | Cota de malha curta | `MailShort01_m03_C4` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat02_m05_D` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar sigismundo-9` · Vestir: `/conjunto vestir sigismundo-9`

### `sigismundo-10` — Soldado do exército de Sigismundo, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 10.546 g

Capacete de chaleira com bico, capuz de malha com brasão, cota de malha saxônica, couraça lisa, jaquetão longo, túnica com fecho, mangas laminares simples, manoplas de cota de malha, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m01_B4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mMagyar_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica com fecho | `Waffenrock03_m03_A` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar sigismundo-10` · Vestir: `/conjunto vestir sigismundo-10`

### `sigismundo-11` — Soldado do exército de Sigismundo, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 15.427 g

Bacinete de cavaleiro, capuz de malha com brasão, cota de malha saxônica, couraça de equitação, jaquetão longo, túnica com fecho, mangas laminares simples, manoplas milanesas, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mMagyar_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça de equitação | `Cuirass05_m01_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica com fecho | `Waffenrock03_m04_A` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m02_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar sigismundo-11` · Vestir: `/conjunto vestir sigismundo-11`

### `sigismundo-12` — Soldado do exército de Sigismundo, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 16.862 g

Bacinete italiano, capuz de malha com brasão, cota de malha saxônica, couraça de equitação, jaquetão longo, túnica para cavaleiro, mangas laminares simples, manoplas milanesas, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m01_C4` | – |
| Pescoço | Capuz de malha com brasão | `CoifMail02_mMagyar_B3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça de equitação | `Cuirass05_m01_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Túnica para cavaleiro | `Waffenrock09_m04_B` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m02_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar sigismundo-12` · Vestir: `/conjunto vestir sigismundo-12`

### `sigismundo-13` — Soldado do exército de Sigismundo, nível 6

**Categoria:** excelente · **Peso:** pesada · **Preço:** 18.278 g

Bacinete de Nuremberg, almofre de malha, capuz bordado, brigandina simples, cota de malha curta, jaquetão longo, túnica com bainha, manoplas de ampulheta, manoplas de placa para cavaleiros, chausses acolchoadas, perneiras de placa saxônicas, botas do cortesão.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m02_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m02_C2` | – |
| Cabeça | Capuz bordado | `Hood06_m08_B` | – |
| Tronco | Brigandina simples | `Brigandine01_m01_D3` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m18_B3` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mMagyar01_C` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m02_C3` | – |
| Pés | Botas do cortesão | `BootsAnkle04_m03_A` | – |

Dar: `/conjunto dar sigismundo-13` · Vestir: `/conjunto vestir sigismundo-13`

### `sigismundo-14` — Soldado do exército de Sigismundo, nível 6

**Categoria:** nobre · **Peso:** pesada · **Preço:** 32.630 g

Bacinete de Nuremberg, almofre de malha, capuz de nobre, cota de malha curta, couraça de Magdeburg, gibão longo, túnica com bainha, mangas com proteção de Nuremberg, manoplas milanesas, chausses acolchoadas, perneiras milanesas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m01_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Cabeça | Capuz de nobre | `Hood12_m03_A` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça de Magdeburg | `Cuirass02_m04_B4` | – |
| Tronco | Gibão longo | `GambesonLong03_m10_B4` | – |
| Por cima | Túnica com bainha | `Waffenrock01_mMagyar_C` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m02_A5` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m02_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras milanesas | `LegsPlate02_m01_B4` | – |

Dar: `/conjunto dar sigismundo-14` · Vestir: `/conjunto vestir sigismundo-14`

## Cumanos

### `cumanos-1` — Guerreiro cumano, nível 3

**Categoria:** boa · **Peso:** média · **Preço:** 9.998 g

Elmo cumano com crista, almofre acolchoado rústico, cota de malha curta, cafetã acolchoado, mangas laminares com rondelas, manoplas de ampulheta, calças largas, botas cumanas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Elmo cumano com crista | `BascinetOpen06_m03_B3` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Por cima | Cafetã acolchoado | `Caftan05_m06_D3` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças largas | `HoseLoose01_m02_C` | – |
| Pés | Botas cumanas | `BootsKnee05_m01_C` | – |

Dar: `/conjunto dar cumanos-1` · Vestir: `/conjunto vestir cumanos-1`

## Brabantinos

### `brabantinos-1` — Mercenário brabantino, nível 1

**Categoria:** excelente · **Peso:** leve · **Preço:** 18.448 g

Gorro com penas de pavão, gibão longo, casaco justo, luvas de nobre, mangas com proteção de Nuremberg, chausses acolchoadas, perneiras laminares de cavaleiro, botas do cortesão.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Gorro com penas de pavão | `Cap14_m07_A` | – |
| Tronco | Gibão longo | `GambesonLong03_m06_B4` | – |
| Por cima | Casaco justo | `Coat08_m05_A` | – |
| Braços | Luvas de nobre | `Gloves06_m02_A2` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m01_A5` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m09_A5` | – |
| Pés | Botas do cortesão | `BootsAnkle04_m03_A` | – |

Dar: `/conjunto dar brabantinos-1` · Vestir: `/conjunto vestir brabantinos-1`

### `brabantinos-2` — Mercenário brabantino, nível 1

**Categoria:** nobre · **Peso:** pesada · **Preço:** 34.499 g

Bacinete de cavaleiro, coifa acolchoada, gola de armadura, cota de malha longa, couraça milanesa, jaquetão longo, mangas com proteção de Nuremberg, manoplas de nobre, chausses acolchoadas, perneiras laminares de cavaleiro, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall03_m02_B3` | – |
| Pescoço | Gola de armadura | `CollarChain01_m04_C1` | – |
| Tronco | Cota de malha longa | `MailLong01_m01_C5` | – |
| Tronco | Couraça milanesa | `Cuirass03_m02_A5` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m17_B3` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m01_A5` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m06_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m09_A5` | – |
| Pés | Botas firmes | `BootsAnkle05_m02_C` | – |

Dar: `/conjunto dar brabantinos-2` · Vestir: `/conjunto vestir brabantinos-2`

### `brabantinos-3` — Mercenário brabantino, nível 2

**Categoria:** comum · **Peso:** leve · **Preço:** 8.086 g

Gola de armadura, chapéu de caça, jaquetão longo, casaco acolchoado, luvas de equitação, mangas reforçadas e temperadas, chausses acolchoadas, perneiras de brigandina de nobre, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Gola de armadura | `CollarChain01_m05_C1` | – |
| Cabeça | Chapéu de caça | `Cap10_m02_B` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m11_C3` | – |
| Por cima | Casaco acolchoado | `Coat07_m05_B` | – |
| Braços | Luvas de equitação | `Gloves05_m02_B2` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m01_C2` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m04_B4` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar brabantinos-3` · Vestir: `/conjunto vestir brabantinos-3`

### `brabantinos-4` — Mercenário brabantino, nível 2

**Categoria:** excelente · **Peso:** pesada · **Preço:** 24.946 g

Bacinete italiano, coifa acolchoada, brigandina simples, cota de malha longa, jaquetão de nobre, mangas com proteção de Nuremberg, manoplas milanesas, chausses acolchoadas, perneiras de brigandina de nobre, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete italiano | `BascinetVisor05_m02_C4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m07_C2` | – |
| Tronco | Brigandina simples | `Brigandine01_m04_D3` | – |
| Tronco | Cota de malha longa | `MailLong01_m02_C5` | – |
| Tronco | Jaquetão de nobre | `GambesonLong04_m11_A5` | – |
| Braços | Mangas com proteção de Nuremberg | `ArmPlate04_m07_A5` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m02_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m04_B4` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar brabantinos-4` · Vestir: `/conjunto vestir brabantinos-4`

### `brabantinos-5` — Mercenário brabantino, nível 3

**Categoria:** básica · **Peso:** leve · **Preço:** 2.179 g

Almofre, chapéu de palha estreito, avental de couro, calças nobres acolchoadas, perneiras de meia placa, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Almofre | `CoifCap01_m01_C` | – |
| Cabeça | Chapéu de palha estreito | `Cap15_m01_D` | – |
| Por cima | Avental de couro | `TunicLong03_m07_D` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas firmes | `BootsAnkle05_m03_C` | – |

Dar: `/conjunto dar brabantinos-5` · Vestir: `/conjunto vestir brabantinos-5`

### `brabantinos-6` — Mercenário brabantino, nível 3

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.000 g

Bacinete em forma de sino, almofre de malha, capuz de servo, cota de malha longa, couraça de equitação, jaquetão longo, mangas laminares simples, manoplas milanesas, calças nobres acolchoadas, perneiras de meia placa, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete em forma de sino | `BascinetOpen02_m02_C1` | – |
| Pescoço | Almofre de malha | `CoifMail01_m04_C2` | – |
| Cabeça | Capuz de servo | `Hood11_m11_C` | – |
| Tronco | Cota de malha longa | `MailLong01_m03_C5` | – |
| Tronco | Couraça de equitação | `Cuirass05_m02_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m08_C3` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m02_D1` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m01_B4` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Botas firmes | `BootsAnkle05_m03_C` | – |

Dar: `/conjunto dar brabantinos-6` · Vestir: `/conjunto vestir brabantinos-6`

### `brabantinos-7` — Mercenário brabantino, nível 4

**Categoria:** básica · **Peso:** leve · **Preço:** 1.520 g

Gola de armadura, capuz simples, gibão curto: preto, cotoveleiras com rondelas, luvas do punguista, calças simples de trovador, botas do cortesão.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Cabeça | Capuz simples | `Hood01_m03_D` | – |
| Tronco | Gibão curto: preto | `GambesonShort03_m04_A4` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Calças simples de trovador | `HoseSeparate01_mPattern03_D` | – |
| Pés | Botas do cortesão | `BootsAnkle04_m03_A` | – |

Dar: `/conjunto dar brabantinos-7` · Vestir: `/conjunto vestir brabantinos-7`

### `brabantinos-8` — Mercenário brabantino, nível 4

**Categoria:** boa · **Peso:** pesada · **Preço:** 9.498 g

Capacete de Rondel, almofre de malha, gola de armadura, capuz simples, brigandina simples, cota de malha italiana, gibão curto: preto, cotoveleiras com rondelas, manoplas milanesas, calças acolchoadas do nobre, perneiras de brigandina antigas, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m02_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m02_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Cabeça | Capuz simples | `Hood01_m03_D` | – |
| Tronco | Brigandina simples | `Brigandine01_m04_D3` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Gibão curto: preto | `GambesonShort03_m04_A4` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas milanesas | `Gauntlets02_m02_B4` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m09_B2` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m02_D2` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m01_C` | – |

Dar: `/conjunto dar brabantinos-8` · Vestir: `/conjunto vestir brabantinos-8`

### `brabantinos-9` — Mercenário brabantino, nível 5

**Categoria:** boa · **Peso:** leve · **Preço:** 10.148 g

Almofre, gola de armadura, capuz simples, chapéu de mestre-caçador, jaquetão longo, manoplas de placa para cavaleiros, calças nobres acolchoadas, perneiras laminares de cavaleiro, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Almofre | `CoifCap01_m02_C` | – |
| Pescoço | Gola de armadura | `CollarChain01_m02_C1` | – |
| Cabeça | Capuz simples | `Hood01_m06_D` | – |
| Cabeça | Chapéu de mestre-caçador | `Cap24_m04_B` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m11_C3` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m02_A5` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m02_C` | – |

Dar: `/conjunto dar brabantinos-9` · Vestir: `/conjunto vestir brabantinos-9`

### `brabantinos-10` — Mercenário brabantino, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 19.973 g

Bacinete com bretache, grande almofre de batalha, capuz simples, cota de malha longa, couraça lisa, jaquetão longo, manoplas de ampulheta, manoplas de placa para cavaleiros, calças nobres acolchoadas, perneiras laminares de cavaleiro, botas de trabalho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m01_C4` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_m07_D2` | – |
| Cabeça | Capuz simples | `Hood01_m06_D` | – |
| Tronco | Cota de malha longa | `MailLong01_m03_C5` | – |
| Tronco | Couraça lisa | `Cuirass01_m02_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m11_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras laminares de cavaleiro | `LegsBrigandine04_m02_A5` | – |
| Pés | Botas de trabalho | `BootsAnkle01_m02_C` | – |

Dar: `/conjunto dar brabantinos-10` · Vestir: `/conjunto vestir brabantinos-10`

## Soldados comuns

### `soldados-comuns-1` — Soldado, nível 1

**Categoria:** básica · **Peso:** leve · **Preço:** 240 g

Almofre, capuz de afogador, chapéu de feltro, jaquetão usado, bandagem de mão, calças simples, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Pescoço | Almofre | `CoifCap01_m01_C` | – |
| Cabeça | Capuz de afogador | `Hood08_mdrowner` | – |
| Cabeça | Chapéu de feltro | `Cap27_m01_D` | – |
| Tronco | Jaquetão usado | `GambesonShort02_m01_E1` | – |
| Mãos | Bandagem de mão | `HandWrap01_m02_E` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar soldados-comuns-1` · Vestir: `/conjunto vestir soldados-comuns-1`

### `soldados-comuns-2` — Soldado, nível 1

**Categoria:** básica · **Peso:** leve · **Preço:** 1.174 g

Capacete de chaleira, almofre acolchoado rústico, capuz simples, jaquetão desgastado, casaco comum, cotoveleiras, bandagem de mão, calças acolchoadas do andarilho, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira | `KettleHat01_m01_E1` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz simples | `Hood01_m06_D` | – |
| Tronco | Jaquetão desgastado | `GambesonShort02_m05_E1` | – |
| Por cima | Casaco comum | `Coat02_m04_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Mãos | Bandagem de mão | `HandWrap01_m01_E` | – |
| Pernas | Calças acolchoadas do andarilho | `LegsPadded02_m08_E1` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar soldados-comuns-2` · Vestir: `/conjunto vestir soldados-comuns-2`

### `soldados-comuns-3` — Soldado, nível 1

**Categoria:** básica · **Peso:** leve · **Preço:** 2.665 g

Capacete de chaleira em forma de sino, capuz acolchoado, capuz de clérigo, jaquetão longo, casaco comum, cotoveleiras, calças simples, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira em forma de sino | `KettleHat05_m01_D3` | – |
| Pescoço | Capuz acolchoado | `CoifLarge02_m02_C3` | – |
| Cabeça | Capuz de clérigo | `Hood09_m04_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat02_m04_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Pernas | Calças simples | `HoseSeparate01_m05_D` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m01_D` | – |

Dar: `/conjunto dar soldados-comuns-3` · Vestir: `/conjunto vestir soldados-comuns-3`

### `soldados-comuns-4` — Soldado, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 907 g

Capacete encardido, almofre acolchoado rústico, capuz de mendigo, jaquetão desgastado, bandagem de mão, calça acolchoada, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete encardido | `SkullCap01_m01_D1` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Cabeça | Capuz de mendigo | `Hood04_m01_E` | – |
| Tronco | Jaquetão desgastado | `GambesonShort02_m03_E1` | – |
| Mãos | Bandagem de mão | `HandWrap01_m01_E` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar soldados-comuns-4` · Vestir: `/conjunto vestir soldados-comuns-4`

### `soldados-comuns-5` — Soldado, nível 2

**Categoria:** básica · **Peso:** leve · **Preço:** 1.388 g

Capacete de chaleira, coifa acolchoada, jaquetão longo, cotoveleiras, luvas do punguista, calças de mendigo, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira | `KettleHat01_m01_E1` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Calças de mendigo | `HoseSeparate04_m01_E` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar soldados-comuns-5` · Vestir: `/conjunto vestir soldados-comuns-5`

### `soldados-comuns-6` — Soldado, nível 2

**Categoria:** comum · **Peso:** leve · **Preço:** 3.937 g

Capacete de aço, almofre acolchoado rústico, gola de armadura, capuz simples, jaquetão longo, casaco comum, cotoveleiras, luvas, calça acolchoada, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de aço | `SkullCap02_m02_C2` | – |
| Pescoço | Almofre acolchoado rústico | `CoifSmall02_m01_E1` | – |
| Pescoço | Gola de armadura | `CollarChain01_m01_C1` | – |
| Cabeça | Capuz simples | `Hood01_m03_D` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat02_m06_D` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas | `Gloves02_m01_D3` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m03_D1` | – |
| Pés | Sapatos simples | `Shoes01_m01_D` | – |

Dar: `/conjunto dar soldados-comuns-6` · Vestir: `/conjunto vestir soldados-comuns-6`

### `soldados-comuns-7` — Soldado, nível 3

**Categoria:** básica · **Peso:** leve · **Preço:** 994 g

Gorro pontudo, jaquetão longo, casaco comum, cotoveleiras, luvas do punguista, calças acolchoadas do nobre, joelheiras em forma de folha, botas de andarilho.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Gorro pontudo | `Cap09_m06_C` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Por cima | Casaco comum | `Coat04_m03_C` | – |
| Braços | Cotoveleiras | `ArmPlate03_m01_D1` | – |
| Braços | Luvas do punguista | `Gloves01_m01_C1` | – |
| Pernas | Calças acolchoadas do nobre | `LegsPadded03_m04_B2` | – |
| Pernas | Joelheiras em forma de folha | `LegsPlate07_m01_E1` | – |
| Pés | Botas de andarilho | `BootsAnkle03_m06_D` | – |

Dar: `/conjunto dar soldados-comuns-7` · Vestir: `/conjunto vestir soldados-comuns-7`

### `soldados-comuns-8` — Soldado, nível 3

**Categoria:** comum · **Peso:** média · **Preço:** 6.627 g

Capacete de Rondel, almofre de malha, cota de malha italiana, jaquetão longo, casaco comum, mangas laminares com rondelas, manoplas de cota de malha, calça acolchoada, joelheiras, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m03_C3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m02_C2` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m01_C3` | – |
| Por cima | Casaco comum | `Coat02_m01_D` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m02_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Joelheiras | `LegsPlate06_m01_D1` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar soldados-comuns-8` · Vestir: `/conjunto vestir soldados-comuns-8`

### `soldados-comuns-9` — Soldado, nível 3

**Categoria:** boa · **Peso:** pesada · **Preço:** 10.942 g

Capacete de Rondel, coifa acolchoada, gola de armadura, couraça lisa: escurecida, jaquetão longo, mangas laminares com rondelas, manoplas de nobre, calças nobres acolchoadas, perneiras de meia placa, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de Rondel | `SkullCap04_m03_C3` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m01_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m07_C1` | – |
| Tronco | Couraça lisa: escurecida | `Cuirass01_m04_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m13_C3` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m02_C3` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m02_C2` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de meia placa | `LegsPlate04_m01_D1` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar soldados-comuns-9` · Vestir: `/conjunto vestir soldados-comuns-9`

### `soldados-comuns-10` — Soldado, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 5.007 g

Capacete de chaleira composto, almofre de malha, cota de malha saxônica, jaquetão longo, cotoveleiras com rondelas, manoplas de cota de malha, calças acolchoadas velhas, perneiras de brigandina antigas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira composto | `KettleHat02_m01_D2` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Cotoveleiras com rondelas | `ArmPlate01_m01_C2` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m01_E1` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m04_D2` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar soldados-comuns-10` · Vestir: `/conjunto vestir soldados-comuns-10`

### `soldados-comuns-11` — Soldado, nível 4

**Categoria:** comum · **Peso:** média · **Preço:** 7.467 g

Capacete de chaleira com bico, almofre de malha, cota de malha saxônica, jaquetão longo, mangas laminares simples, manoplas de cota de malha, calças acolchoadas velhas, perneiras de brigandina antigas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com bico | `KettleHat04_m02_B4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m04_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m02_D1` | – |
| Pernas | Calças acolchoadas velhas | `LegsPadded02_m01_E1` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m06_D2` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar soldados-comuns-11` · Vestir: `/conjunto vestir soldados-comuns-11`

### `soldados-comuns-12` — Soldado, nível 4

**Categoria:** boa · **Peso:** média · **Preço:** 11.414 g

Capacete de chaleira alto, grande almofre de batalha, cota de malha italiana, jaquetão longo, mangas laminares com rondelas, manoplas de cota de malha, chausses acolchoadas, perneiras de brigandina de nobre, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m03_A4` | – |
| Pescoço | Grande almofre de batalha | `CoifLarge01_m01_D2` | – |
| Tronco | Cota de malha italiana | `MailShort02_m01_C1` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m03_C3` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m02_B4` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar soldados-comuns-12` · Vestir: `/conjunto vestir soldados-comuns-12`

### `soldados-comuns-13` — Soldado, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 11.008 g

Bacinete de cavaleiro, almofre de malha, cota de malha saxônica, couraça lisa, jaquetão longo, mangas laminares simples, manoplas de cota de malha, calça acolchoada, perneiras de brigandina antigas, calças simples, sapatos simples.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m01_D3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça lisa | `Cuirass01_m01_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m12_C3` | – |
| Braços | Mangas laminares simples | `BrigandineArm01_m01_D1` | – |
| Braços | Manoplas de cota de malha | `Gauntlets03_m01_D1` | – |
| Pernas | Calça acolchoada | `LegsPadded01_m01_C3` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pernas | Calças simples | `HoseSeparate01_m09_D` | – |
| Pés | Sapatos simples | `Shoes04_m01_E` | – |

Dar: `/conjunto dar soldados-comuns-13` · Vestir: `/conjunto vestir soldados-comuns-13`

### `soldados-comuns-14` — Soldado, nível 5

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.552 g

Bacinete com bretache, coifa acolchoada, gola de armadura, aketon curto, brigandina milanesa, cota de malha saxônica, mangas laminares com rondelas, manoplas de ampulheta, calças nobres acolchoadas, perneiras de brigandina antigas, botas.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete com bretache | `BascinetOpen03_m02_C4` | – |
| Pescoço | Coifa acolchoada | `CoifSmall01_m05_C2` | – |
| Pescoço | Gola de armadura | `CollarChain01_m07_C1` | – |
| Tronco | Aketon curto | `GambesonShort04_m04_C3` | – |
| Tronco | Brigandina milanesa | `Brigandine05_m05_C3` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Braços | Mangas laminares com rondelas | `BrigandineArm02_m01_C3` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina antigas | `LegsBrigandine01_m01_D2` | – |
| Pés | Botas | `BootsKnee04_m02_D` | – |

Dar: `/conjunto dar soldados-comuns-14` · Vestir: `/conjunto vestir soldados-comuns-14`

### `soldados-comuns-15` — Soldado, nível 5

**Categoria:** excelente · **Peso:** pesada · **Preço:** 17.312 g

Capacete de chaleira alto, almofre de malha, cota de malha saxônica, couraça de equitação, jaquetão longo, mangas reforçadas e temperadas, manoplas de ampulheta, chausses acolchoadas, perneiras de placa saxônicas, sapatos macios.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira alto | `KettleHat06_m03_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça de equitação | `Cuirass05_m03_B3` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m04_C3` | – |
| Braços | Mangas reforçadas e temperadas | `BrigandineArm03_m01_C2` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m02_C3` | – |
| Pernas | Chausses acolchoadas | `LegsPadded01_m04_C3` | – |
| Pernas | Perneiras de placa saxônicas | `LegsPlate05_m01_C3` | – |
| Pés | Sapatos macios | `Shoes03_m02_C` | – |

Dar: `/conjunto dar soldados-comuns-15` · Vestir: `/conjunto vestir soldados-comuns-15`

### `soldados-comuns-16` — Soldado, nível 6

**Categoria:** boa · **Peso:** pesada · **Preço:** 14.360 g

Capacete de chaleira com saliência, almofre de malha, cota de malha curta, couraça lisa, jaquetão longo, túnica de montaria, manoplas de ampulheta, manoplas de placa para cavaleiros, calças nobres acolchoadas, perneiras de placa da Baviera, botas firmes.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Capacete de chaleira com saliência | `KettleHat03_m01_B3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha curta | `MailShort01_m01_C4` | – |
| Tronco | Couraça lisa | `Cuirass01_m02_C2` | – |
| Tronco | Jaquetão longo | `GambesonLong01_m15_C3` | – |
| Por cima | Túnica de montaria | `Waffenrock08_m05_B` | – |
| Braços | Manoplas de ampulheta | `Gauntlets01_m02_C3` | – |
| Braços | Manoplas de placa para cavaleiros | `ArmPlate02_m01_C3` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de placa da Baviera | `LegsPlate01_m01_C3` | – |
| Pés | Botas firmes | `BootsAnkle05_m04_C` | – |

Dar: `/conjunto dar soldados-comuns-16` · Vestir: `/conjunto vestir soldados-comuns-16`

### `soldados-comuns-17` — Soldado, nível 6

**Categoria:** excelente · **Peso:** pesada · **Preço:** 18.001 g

Bacinete de cavaleiro, almofre de malha, cota de malha saxônica, couraça de equitação, gibão curto, braçais de placa de Magdeburgo, manoplas de nobre, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos pontudos.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de cavaleiro | `BascinetVisor02_m02_D3` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Tronco | Couraça de equitação | `Cuirass05_m02_B3` | – |
| Tronco | Gibão curto | `GambesonShort03_m06_A4` | – |
| Braços | Braçais de placa de Magdeburgo | `ArmPlate05_m02_B4` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m01_C2` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m07_B4` | – |
| Pés | Sapatos pontudos | `Shoes05_m01_B` | – |

Dar: `/conjunto dar soldados-comuns-17` · Vestir: `/conjunto vestir soldados-comuns-17`

### `soldados-comuns-18` — Soldado, nível 6

**Categoria:** excelente · **Peso:** pesada · **Preço:** 19.300 g

Bacinete de Nuremberg, almofre de malha, aketon curto, brigandina saxônica, cota de malha saxônica, manoplas de nobre, calças nobres acolchoadas, perneiras de brigandina de nobre, sapatos pontudos.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Cabeça | Bacinete de Nuremberg | `BascinetVisor03_m01_A4` | – |
| Pescoço | Almofre de malha | `CoifMail01_m01_C2` | – |
| Tronco | Aketon curto | `GambesonShort04_m01_C3` | – |
| Tronco | Brigandina saxônica | `Brigandine03_m01_A4` | – |
| Tronco | Cota de malha saxônica | `MailLong02_m01_C2` | – |
| Braços | Manoplas de nobre | `Gauntlets04_m01_C2` | – |
| Pernas | Calças nobres acolchoadas | `LegsPadded03_m01_B2` | – |
| Pernas | Perneiras de brigandina de nobre | `LegsBrigandine03_m02_B4` | – |
| Pés | Sapatos pontudos | `Shoes05_m01_B` | – |

Dar: `/conjunto dar soldados-comuns-18` · Vestir: `/conjunto vestir soldados-comuns-18`

## Brasões

Pacotes montados aqui, não vestimentas do jogo: para cada cidade, casa, ordem ou reino que tem um brasão no jogo, **o casaco (ou os casacos) com o brasão, o escudo de cavaleiro dele e a espada do cavaleiro** (`shortswordHeavy`). Só se dá (`/conjunto dar brasao-<nome> [jogador]`); cada peça tem outras versões do brasão (coluna *Outras cores*, para dar com `/give <código>`). Onde o jogo não tem casaco com o brasão (Skalitz, Radzig, Zimburg, Holohlavy, Zavish, Suchotlesky e a Ordem da Cruz) o pacote é o escudo e a espada. Onde o jogo só tem o escudo triangular (Polner, Holohlavy, Zavish, Suchotlesky), é ele. O Pavese de Suchdol e o de Trosky e as guildas ficam de fora: não são escudos de cavaleiro de uma região.

### `brasao-kuttenberg` — Kuttenberg (cidade)

**Traz:** casaco, escudo e espada · **Preço:** 3.474 g

Sobretudo de brasão, casaco comum com brasão, escudo de cavaleiro de Kuttenberg, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mKuttenberg_D` | `Coat02_mKuttenberg01_D`, `Coat02_mKuttenberg02_D`, `Coat02_mKuttenberg03_D` |
| Por cima | Casaco comum com brasão | `Coat04_mKuttenberg_C` | `Coat04_mKuttenberg01_C`, `Coat04_mKuttenberg02_C`, `Coat04_mKuttenberg03_C` |
| Escudo | Escudo de cavaleiro de Kuttenberg | `shieldKite_kuttenberg_A` | `shieldKite_kuttenberg_B` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-kuttenberg`

### `brasao-praga` — Praga (cidade)

**Traz:** casaco, escudo e espada · **Preço:** 3.370 g

Casaco comum de Praga com brasão, escudo de cavaleiro da Cidade Velha de Praga, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Casaco comum de Praga com brasão | `Coat04_mPrague_C` | – |
| Escudo | Escudo de cavaleiro da Cidade Velha de Praga | `shieldKite_prague_A` | `shieldKite_prague_B`, `shieldKite_prague_B_inverted`, `shieldKite_prague_C`, `shieldKite_prague_C_inverted` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-praga`

### `brasao-skalitz` — Skalitz (cidade)

**Traz:** escudo e espada · **Preço:** 3.183 g

Escudo de cavaleiro de Skalitz, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo de cavaleiro de Skalitz | `shieldKite_skalitz` | – |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-skalitz`

**Cavalo:** `/horse gear preset horse_pros` (nas cores de Skalitz) ou só o caparazão, `/horse gear Caparison01_mPros` (Caparazão de Skalitz). Mais em [Cavalos](#cavalos).

### `brasao-bergow` — Bergow (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.311 g

Sobretudo de brasão, escudo de cavaleiro do Lorde de Bergow, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mBergov_D` | – |
| Escudo | Escudo de cavaleiro do Lorde de Bergow | `shieldKite_bergov_A` | `shieldKite_bergov_B`, `shieldHeater_bergov_A` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-bergow`

**Cavalo:** o jogo não tem caparazão com este brasão; o cavalo do Lorde von Bergow é `/horse gear preset ttro_bergovHorse` (veja [Cavalos](#cavalos)).

### `brasao-holohlavy` — Holohlavy (casa)

**Traz:** escudo e espada · **Preço:** 3.139 g

Escudo triangular dos Lordes de Holohlavy, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo triangular dos Lordes de Holohlavy | `shieldHeater_holohlav_A` | `shieldHeater_pisek_C`, `shieldHeater_pisek_D` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-holohlavy`

Dos Holohlavy o jogo só tem o escudo triangular; `shieldHeater_pisek_C` e `_D` levam o mesmo brasão.

**Cavalo:** `/horse gear preset kzik_horse_gringolet` (Gringolet, nas cores dos Lordes de Holohlavy) ou só o caparazão, `/horse gear NobleCaparison01_mJezek` (Caparazão dos Lordes de Holohlavy). Mais em [Cavalos](#cavalos).

### `brasao-leipa` — Leipa (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.494 g

Sobretudo de brasão, escudo de cavaleiro do Lorde de Bergow, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mLeipa_D` | – |
| Escudo | Escudo de cavaleiro do Lorde de Bergow | `shieldKite_lipa` | `shieldHeater_lipa_A`, `shieldHeater_lipa_B` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-leipa`

O escudo de cavaleiro de Leipa (`shieldKite_lipa`) aparece no inventário com o nome que o jogo lhe deu, *Escudo de cavaleiro do Lorde de Bergow*.

**Cavalo:** `/horse gear preset battle_leipa_08` (cavaleiro de Leipa) ou só o caparazão, `/horse gear NobleCaparison03_mLeipa` (Caparazão de carrasco nas cores de Leipa). Mais em [Cavalos](#cavalos).

### `brasao-nebakov` — Nebakov (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.303 g

Sobretudo de brasão, escudo de pipa dos lordes de Nebakov, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mNebak_D` | – |
| Escudo | Escudo de pipa dos lordes de Nebakov | `shieldKite_nebak_A` | `shieldKite_nebak_B`, `shieldKite_nebak_C`, `shieldKite_nebak_C_inverted` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-nebakov`

### `brasao-pisek` — Písek (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.311 g

Sobretudo de brasão, escudo de cavaleiro dos Lordes de Hradetz, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mPisek_D` | – |
| Escudo | Escudo de cavaleiro dos Lordes de Hradetz | `shieldKite_pisek_A` | `shieldKite_pisek_B`, `shieldKite_pisek_C`, `shieldHeater_pisek_A`, `shieldHeater_pisek_B` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-pisek`

Os escudos de cavaleiro de Písek (`shieldKite_pisek_*`) aparecem no inventário como *Escudo de cavaleiro dos Lordes de Hradetz*, o nome que o jogo lhes deu.

### `brasao-polner` — Polner (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.243 g

Sobretudo de brasão, escudo triangular do Lorde Polner, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mPolner_D` | – |
| Escudo | Escudo triangular do Lorde Polner | `shieldHeater_polner` | – |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-polner`

### `brasao-radzig` — Radzig (casa)

**Traz:** escudo e espada · **Preço:** 3.195 g

Escudo de cavaleiro de Sir Radzig, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo de cavaleiro de Sir Radzig | `shieldKite_skalitz_02` | – |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-radzig`

### `brasao-ruthard` — Ruthard (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.311 g

Sobretudo de brasão, escudo de cavaleiro do Lorde Ruthard, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mRuthart_D` | – |
| Escudo | Escudo de cavaleiro do Lorde Ruthard | `shieldKite_ruthard_A` | `shieldKite_ruthard_A_inverted` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-ruthard`

**Cavalo:** `/horse gear preset battle_ruthard_06` (cavaleiro de Ruthard) ou só o caparazão, `/horse gear Caparison03_mRuthard` (Caparazão do Lorde Ruthard). Mais em [Cavalos](#cavalos).

### `brasao-semine` — Semine (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.311 g

Sobretudo de brasão, escudo de cavaleiro dos Lordes de Semine, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mSemin_D` | – |
| Escudo | Escudo de cavaleiro dos Lordes de Semine | `shieldKite_semin_A` | – |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-semine`

**Cavalo:** `/horse gear preset battle_semin_08` (cavaleiro de Semine) ou só o caparazão, `/horse gear Caparison03_mSemin` (Caparazão do Lorde de Semine). Mais em [Cavalos](#cavalos).

### `brasao-suchotlesky` — Suchotlesky (casa)

**Traz:** escudo e espada · **Preço:** 3.297 g

Escudo triangular do Lorde de Suchotlesky, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo triangular do Lorde de Suchotlesky | `dvojityAgent_petrsShield` | – |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-suchotlesky`

### `brasao-vavak` — Vavák (casa)

**Traz:** casaco, escudo e espada · **Preço:** 3.311 g

Sobretudo de brasão, escudo de cavaleiro dos Lordes de Hradetz, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mVavak_D` | – |
| Escudo | Escudo de cavaleiro dos Lordes de Hradetz | `shieldKite_vavak_A` | `shieldKite_vavak_B` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-vavak`

Os escudos de cavaleiro de Vavák (`shieldKite_vavak_*`) aparecem no inventário como *Escudo de cavaleiro dos Lordes de Hradetz*, o nome que o jogo lhes deu.

### `brasao-zavish` — Zavish (casa)

**Traz:** escudo e espada · **Preço:** 3.139 g

Escudo triangular de Sir Zavish, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo triangular de Sir Zavish | `shieldHeater_zavis` | `shieldHeater_peony` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-zavish`

### `brasao-zimburg` — Zimburg (casa)

**Traz:** escudo e espada · **Preço:** 3.190 g

Escudo de cavaleiro dos Lordes de Zimburg, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo de cavaleiro dos Lordes de Zimburg | `shieldKite_cimburk` | – |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-zimburg`

### `brasao-ordem-teutonica` — Ordem Teutônica (ordem)

**Traz:** casaco, escudo e espada · **Preço:** 3.473 g

Sobretudo de irmão leigo teutônico, sobretudo teutônico, escudo de cavaleiro teutônico, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de irmão leigo teutônico | `Coat02_mTeuton` | – |
| Por cima | Sobretudo teutônico | `Coat02_mTeuton02` | – |
| Escudo | Escudo de cavaleiro teutônico | `shieldKite_teuton_01` | `shieldKite_teuton_02`, `shieldKite_teuton_03` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-ordem-teutonica`

**Cavalo:** o caparazão, `/horse gear Caparison02_mTeuton` (Caparazão teutônico); o jogo não tem conjunto de cavalo com este brasão.

### `brasao-ordem-da-cruz` — Ordem da Cruz (ordem)

**Traz:** escudo e espada · **Preço:** 3.290 g

Escudo de cavaleiro da Ordem da Cruz, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Escudo | Escudo de cavaleiro da Ordem da Cruz | `shieldKite_redstar_A` | `shieldKite_redstar_B` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-ordem-da-cruz`

### `brasao-hungria` — Reino da Hungria (reino)

**Traz:** casaco, escudo e espada · **Preço:** 3.474 g

Sobretudo de brasão, casaco comum com brasão, escudo de cavaleiro húngaro, espada do cavaleiro.

| Parte | Peça | Código | Outras cores |
|---|---|---|---|
| Por cima | Sobretudo de brasão | `Coat02_mMagyar_D` | `Coat02_mMagyar01_D` |
| Por cima | Casaco comum com brasão | `Coat04_mMagyar_C` | – |
| Escudo | Escudo de cavaleiro húngaro | `shieldKite_sigismund_A` | `shieldKite_sigismund_B`, `shieldKite_sigismund_C` |
| Arma | Espada do cavaleiro | `shortswordHeavy` | – |

Dar: `/conjunto dar brasao-hungria`

## Cavalos

Os arreios que o próprio jogo põe nos cavalos dos senhores, cavaleiros e soldados de cada lugar, e as peças de cavalo nas cores de cada casa. Cavalo não entra no `/conjunto`: o arreio vai no próprio cavalo, com o `/horse gear` (só admin), montado nele ou a até 12 m dele.

- `/horse gear preset <conjunto>` põe o conjunto inteiro: sela, cabeça, corpo e ferraduras (o que o conjunto não tem fica vazio). Exemplo: `/horse gear preset ttro_bergovHorse`.
- `/horse gear <código>` põe uma peça só (o caparazão pede uma sela antes); `/horse gear off torso` tira a do corpo, `/horse gear bare` tira tudo, e `/horse gear` sozinho diz o que ele veste.
- `/horse gear lock` não deixa quem monta trocar o arreio; `/horse gear unlock` libera.
- No cavalo de um jogador o arreio fica guardado com o cavalo e volta depois de um reinício.
- A peça também vai para a bolsa com `/give <código>`, mas vestir o cavalo pela tela do próprio jogo ainda não foi testado no servidor.

### Cavalo de Trosky

O cavalo do senhor de Trosky, o Lorde von Bergow. O jogo não tem caparazão com o brasão de Bergow: o dele vai de arreio.

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `ttro_bergovHorse` | Lorde von Bergow | Sela de Bravante `NobleSaddle01_m11` | Chanfron tirolês `WarChanfron03_m07` | Arreio de Haia `BasicHarness03_m13` | 3.158 |
| `horse_capontrosecko` | Capon, em Trosky | Sela de cavaleiro da Transilvânia `WarSaddle02_m02` | Chanfron milanês `WarChanfron02_m06` | Arreio de Haia `BasicHarness03_m04` | 2.038 |

Pôr: `/horse gear preset ttro_bergovHorse`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Malešov

O jogo não tem cavalo de Malešov, e os soldados que ele põe lá são os de Bergow: use o do Lorde von Bergow, `/horse gear preset ttro_bergovHorse` (em [Cavalo de Trosky](#cavalo-de-trosky)).

### Cavalo de Raborsch

A comitiva que o jogo põe em Ratboř (Raborsch) monta com as cores de Leipa; os cavaleiros de Leipa estão em [Cavalo de Lípa](#cavalo-de-lípa).

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `setkaniVRatbori1_tempRatiborRetinueHorse` | comitiva em Ratboř | Sela de Bridon `NobleSaddle02_m15` | Bridão de placa `BasicBridle02_m04` | Caparazão dos Lordes de Leipa `Caparison03_mLeipa03` | 2.031 |
| `setkaniVRatbori1_tempRatiborRetinueHorse2` | comitiva em Ratboř | Sela normanda `BasicSaddle03_m09` | Bridão de placa `BasicBridle02_m02` | Caparazão costurado nas cores de Leipa `NobleCaparison02_mLeipa02` | 1.282 |
| `setkaniVRatbori1_tempRatiborRetinueHorse10` | comitiva em Ratboř | Sela de soldado `BasicSaddle02_m04` | Bridão com focinheira `BasicBridle03_m05` | Arreio de Wieluń `BasicHarness01_m12` | 767 |

Pôr: `/horse gear preset setkaniVRatbori1_tempRatiborRetinueHorse`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Suchdol

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `oblehaniSuchdole_horse_suchdol01` | defensor, no cerco de Suchdol | Sela húngara `WarSaddle01_m03` | Rédeas de couro macio `BasicBridle01_m09` | Arreio de Wieluń `BasicHarness01_m09` | 1.367 |
| `oblehaniSuchdole_horse_suchdol02` | defensor, no cerco de Suchdol | Sela de cavaleiro da Transilvânia `WarSaddle02_m05` | Chanfron milanês `WarChanfron02_m10` | Caparazão de torneio liso `Caparison01_m03` | 2.044 |
| `oblehaniSuchdole_horse_suchdol03` | defensor, no cerco de Suchdol | Sela húngara `WarSaddle01_m01` | Rédeas de couro macio `BasicBridle01_m04` | Caparazão acolchoado com arreio `PaddedCaparison04_mSemin` | 1.525 |
| `oblehaniSuchdole_horse_suchdol04` | defensor, no cerco de Suchdol | Sela normanda `BasicSaddle03_m08` | Chanfron tirolês `WarChanfron03_m03` | Arreio de Mainz `BasicHarness02_m10` | 1.600 |

Pôr: `/horse gear preset oblehaniSuchdole_horse_suchdol01`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Praga

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `oblehaniSuchdole_horse_prague01` | de Praga, no cerco de Suchdol | Sela de dragão `NobleSaddle03_m01` | Rédeas de couro macio `BasicBridle01_m04` | Caparazão de torneio decorado `NobleCaparison01_m03` | 2.968 |
| `oblehaniSuchdole_horse_prague02` | de Praga, no cerco de Suchdol | Sela de Praga `BasicSaddle01_m05` | Rédeas de couro macio `BasicBridle01_m04` | Arreio de Mainz `BasicHarness02_m01` | 550 |
| `oblehaniSuchdole_horse_prague03` | de Praga, no cerco de Suchdol | Sela de cavaleiro da Transilvânia `WarSaddle02_m04` | Chanfron milanês `WarChanfron02_m01` | Arreio de Wieluń `BasicHarness01_m05` | 1.967 |
| `oblehaniSuchdole_horse_prague04` | de Praga, no cerco de Suchdol | Sela de cavaleiro da Transilvânia `WarSaddle02_m03` | Chanfron de dragão `WarChanfron01_m01` | Arreio de Haia `BasicHarness03_m03` | 2.952 |
| `oblehaniSuchdole_horse_prague05` | de Praga, no cerco de Suchdol | Sela de cavaleiro da Transilvânia `WarSaddle02_m03` | Rédeas de couro macio `BasicBridle01_m02` | Caparazão de carrasco decorado `NobleCaparison03_m02` | 1.906 |

Pôr: `/horse gear preset oblehaniSuchdole_horse_prague01`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Semine

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `battle_semin_01` | cavaleiro de Semine | Sela de Bridon `NobleSaddle02_m05` | Bridão do Sacro Império Romano `NobleBridle01_m04` | Caparazão acolchoado com arreio `PaddedCaparison04_mSemin` | 2.325 |
| `battle_semin_02` | cavaleiro de Semine | Sela húngara `WarSaddle01_m08` | Chanfron de dragão `WarChanfron01_m02` | Caparazão de carrasco acolchoado `PaddedCaparison02_mSemin02` | 2.515 |
| `battle_semin_03` | cavaleiro de Semine | Sela húngara `WarSaddle01_m06` | Bridão com focinheira `BasicBridle03_m01` | Caparazão de carrasco acolchoado `PaddedCaparison02_mSemin02` | 1.400 |
| `battle_semin_04` | cavaleiro de Semine | Sela húngara `WarSaddle01_m03` | Bridão do Sacro Império Romano `NobleBridle01_m04` | Caparazão de carrasco acolchoado `PaddedCaparison02_mSemin` | 1.600 |
| `battle_semin_05` | cavaleiro de Semine | Sela de Bridon `NobleSaddle02_m06` | Chanfron milanês `WarChanfron02_m06` | Caparazão de carrasco acolchoado `PaddedCaparison02_mSemin` | 2.200 |
| `battle_semin_06` | cavaleiro de Semine | Sela de Bridon `NobleSaddle02_m06` | Chanfron milanês `WarChanfron02_m06` | Caparazão de torneio acolchoado `PaddedCaparison01_mSemin02` | 2.525 |
| `battle_semin_07` | cavaleiro de Semine | Sela de Bravante `NobleSaddle01_m01` | Chanfron tirolês `WarChanfron03_m02` | Caparazão de torneio acolchoado `PaddedCaparison01_mSemin` | 3.445 |
| `battle_semin_08` | cavaleiro de Semine | Sela de Bridon `NobleSaddle02_m03` | Chanfron tirolês `WarChanfron03_m02` | Caparazão do Lorde de Semine `Caparison03_mSemin` | 2.631 |
| `battle_semin_09` | cavaleiro de Semine | Sela de Bravante `NobleSaddle01_m07` | Bridão do Sacro Império Romano `NobleBridle01_m01` | Caparazão do Lorde de Semine `Caparison03_mSemin` | 2.651 |
| `battle_semin_10` | cavaleiro de Semine | Sela de Bravante `NobleSaddle01_m01` | Chanfron de dragão `WarChanfron01_m02` | Caparazão de torneio liso `Caparison01_mSemin02` | 3.629 |
| `battle_semin_11` | cavaleiro de Semine | Sela húngara `WarSaddle01_m06` | Rédeas de couro macio `BasicBridle01_m03` | Caparazão de torneio liso `Caparison01_mSemin` | 1.444 |
| `tsem_seminsrHorse` | o senhor de Semine | Sela da Cracóvia `WarSaddle03_m08` | Bridão com focinheira `BasicBridle03_m05` | Caparazão de carrasco com arreio `NobleCaparison07_m03` | 2.968 |
| `tsem_jostHorse` | Jošt, nas missões de Semine | Sela de Bridon `NobleSaddle02_m15` | Chanfron milanês `WarChanfron02_m10` | Caparazão acolchoado com arreio `PaddedCaparison05_m07` | 2.325 |
| `tsem_racekHorse` | Racek, nas missões de Semine | Sela da Cracóvia `WarSaddle03_m13` | Bridão do Sacro Império Romano `NobleBridle01_m01` | Caparazão dividido decorado `NobleCaparison05_m07` | 3.038 |
| `tsem_sukHorse` | Suk, nas missões de Semine | Sela de Bridon `NobleSaddle02_m09` | Bridão de torneio `NobleBridle02_m05` | – | 2.060 |

Pôr: `/horse gear preset battle_semin_08`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Nebakov

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `utokNaNebakov_bartosHorse` | no ataque a Nebakov | Sela da Cracóvia `WarSaddle03_m05` | Bridão do Sacro Império Romano `NobleBridle01_m01` | Arreio de Mainz `BasicHarness02_m02` | 2.850 |
| `utokNaNebakov_hankoHorse` | no ataque a Nebakov | Sela húngara `WarSaddle01_m02` | Chanfron de dragão `WarChanfron01_m02` | Arreio de Wieluń `BasicHarness01_m07` | 2.482 |
| `utokNaNebakov_hermanHorse` | no ataque a Nebakov | Sela húngara `WarSaddle01_m03` | Chanfron de dragão `WarChanfron01_m01` | Caparazão de carrasco simples `Caparison02_m02` | 2.465 |
| `utokNaNebakov_janHorse` | no ataque a Nebakov | Sela de dragão `NobleSaddle03_m02` | Chanfron milanês `WarChanfron02_m02` | Caparazão acolchoado com arreio `PaddedCaparison04_m01` | 3.025 |
| `utokNaNebakov_jesekHorse` | no ataque a Nebakov | Sela de Bridon `NobleSaddle02_m05` | Bridão de placa `BasicBridle02_m04` | Arreio de Haia `BasicHarness03_m01` | 2.088 |
| `utokNaNebakov_komoriHorse` | no ataque a Nebakov | Sela de Bridon `NobleSaddle02_m03` | Chanfron tirolês `WarChanfron03_m02` | Caparazão de carrasco com arreio `NobleCaparison07_m02` | 2.918 |
| `utokNaNebakov_olbramHorse` | no ataque a Nebakov | Sela normanda `BasicSaddle03_m01` | Chanfron milanês `WarChanfron02_m06` | Caparazão acolchoado com arreio `PaddedCaparison04_m01` | 1.325 |

Pôr: `/horse gear preset utokNaNebakov_bartosHorse`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Lípa

Os senhores de Leipa (Lípa).

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `battle_leipa_01` | cavaleiro de Leipa | Sela de Bridon `NobleSaddle02_m05` | Chanfron tirolês `WarChanfron03_m02` | Caparazão acolchoado com arreio `PaddedCaparison05_mLeipa` | 2.775 |
| `battle_leipa_02` | cavaleiro de Leipa | Sela normanda `BasicSaddle03_m02` | Chanfron de dragão `WarChanfron01_m02` | Caparazão acolchoado com arreio `PaddedCaparison03_mLeipa` | 2.240 |
| `battle_leipa_03` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Bridão de placa `BasicBridle02_m02` | Caparazão acolchoado com arreio `PaddedCaparison03_mLeipa` | 1.575 |
| `battle_leipa_04` | cavaleiro de Leipa | Sela normanda `BasicSaddle03_m05` | Rédeas de couro macio `BasicBridle01_m02` | Caparazão acolchoado com arreio `PaddedCaparison03_mLeipa01` | 1.125 |
| `battle_leipa_05` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Chanfron milanês `WarChanfron02_m03` | Caparazão de torneio acolchoado `PaddedCaparison01_mLeipa01` | 1.925 |
| `battle_leipa_06` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Chanfron milanês `WarChanfron02_m06` | Caparazão de torneio acolchoado `PaddedCaparison01_mLeipa` | 1.925 |
| `battle_leipa_07` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Chanfron milanês `WarChanfron02_m06` | Caparazão de carrasco nas cores de Leipa `NobleCaparison03_mLeipa02` | 1.706 |
| `battle_leipa_08` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Chanfron tirolês `WarChanfron03_m02` | Caparazão de carrasco nas cores de Leipa `NobleCaparison03_mLeipa` | 2.156 |
| `battle_leipa_09` | cavaleiro de Leipa | Sela de Bridon `NobleSaddle02_m03` | Bridão do Sacro Império Romano `NobleBridle01_m03` | Caparazão costurado nas cores de Leipa `NobleCaparison02_mLeipa02` | 2.432 |
| `battle_leipa_10` | cavaleiro de Leipa | Sela de Bridon `NobleSaddle02_m06` | Chanfron tirolês `WarChanfron03_m02` | Caparazão costurado nas cores de Leipa `NobleCaparison02_mLeipa` | 2.882 |
| `battle_leipa_11` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m09` | Chanfron milanês `WarChanfron02_m03` | Caparazão de torneio nas cores de Leipa `NobleCaparison01_mLeipa02` | 1.868 |
| `battle_leipa_12` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m10` | Bridão com focinheira `BasicBridle03_m02` | Caparazão de torneio nas cores de Leipa `NobleCaparison01_mLeipa` | 1.668 |
| `battle_leipa_13` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Bridão de placa `BasicBridle02_m02` | Caparazão dos Lordes de Leipa `Caparison03_mLeipa03` | 1.431 |
| `battle_leipa_14` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Chanfron de dragão `WarChanfron01_m02` | Caparazão dos Lordes de Leipa `Caparison03_mLeipa02` | 2.496 |
| `battle_leipa_15` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Chanfron milanês `WarChanfron02_m06` | Caparazão dos Lordes de Leipa `Caparison03_mLeipa01` | 1.581 |
| `battle_leipa_16` | cavaleiro de Leipa | Sela húngara `WarSaddle01_m13` | Bridão do Sacro Império Romano `NobleBridle01_m01` | Caparazão dos Lordes de Leipa `Caparison03_mLeipa` | 1.581 |
| `battle_leipa_17` | cavaleiro de Leipa | Sela de cavaleiro da Transilvânia `WarSaddle02_m01` | Rédeas de couro macio `BasicBridle01_m02` | Caparazão de torneio liso `Caparison01_mLeipa01` | 1.844 |
| `battle_leipa_18` | cavaleiro de Leipa | Sela normanda `BasicSaddle03_m09` | Rédeas de couro macio `BasicBridle01_m02` | Caparazão de torneio liso `Caparison01_mLeipa` | 1.044 |
| `tsem_hanusHorse` | Hanuš de Leipa | Sela de Bravante `NobleSaddle01_m04` | Bridão de torneio `NobleBridle02_m03` | Caparazão de carrasco nas cores de Leipa `NobleCaparison07_mLeipa` | 2.532 |

Pôr: `/horse gear preset battle_leipa_08`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Ruthard

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `battle_ruthard_01` | cavaleiro de Ruthard | Sela de Bridon `NobleSaddle02_m06` | Chanfron tirolês `WarChanfron03_m02` | Caparazão de carrasco acolchoado `PaddedCaparison02_mRuthard03` | 2.650 |
| `battle_ruthard_02` | cavaleiro de Ruthard | Sela húngara `WarSaddle01_m13` | Chanfron milanês `WarChanfron02_m03` | Caparazão de carrasco acolchoado `PaddedCaparison02_mRuthard02` | 1.600 |
| `battle_ruthard_03` | cavaleiro de Ruthard | Sela húngara `WarSaddle01_m13` | Bridão de placa `BasicBridle02_m02` | Caparazão de torneio acolchoado `PaddedCaparison01_mRuthard02` | 1.775 |
| `battle_ruthard_04` | cavaleiro de Ruthard | Sela húngara `WarSaddle01_m13` | Bridão com focinheira `BasicBridle03_m02` | Caparazão de torneio acolchoado `PaddedCaparison01_mRuthard` | 1.725 |
| `battle_ruthard_05` | cavaleiro de Ruthard | Sela húngara `WarSaddle01_m13` | Chanfron tirolês `WarChanfron03_m02` | Caparazão de torneio acolchoado `PaddedCaparison01_mRuthard` | 2.375 |
| `battle_ruthard_06` | cavaleiro de Ruthard | Sela de Bridon `NobleSaddle02_m04` | Chanfron tirolês `WarChanfron03_m02` | Caparazão do Lorde Ruthard `Caparison03_mRuthard02` | 2.631 |
| `battle_ruthard_07` | cavaleiro de Ruthard | Sela de Bridon `NobleSaddle02_m05` | Chanfron de dragão `WarChanfron01_m02` | Caparazão do Lorde Ruthard `Caparison03_mRuthard` | 3.096 |
| `battle_ruthard_08` | cavaleiro de Ruthard | Sela normanda `BasicSaddle03_m01` | Bridão do Sacro Império Romano `NobleBridle01_m01` | Caparazão de torneio liso `Caparison01_mRuhard02` | 1.244 |
| `battle_ruthard_09` | cavaleiro de Ruthard | Sela normanda `BasicSaddle03_m02` | Chanfron de dragão `WarChanfron01_m02` | Caparazão de torneio liso `Caparison01_mRuhard` | 2.159 |

Pôr: `/horse gear preset battle_ruthard_06`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Aulitz

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `horse_markvart` | Markvart von Aulitz | Sela normanda `BasicSaddle03_m02` | Chanfron milanês `WarChanfron02_m06` | Chapéu do Markvart von Aulitz `NobleCaparison04_mMarkvart` | 1.468 |
| `horse_markvart_dream` | Markvart von Aulitz | Sela normanda `BasicSaddle03_m02` | – | Caparazão costurado nas cores de Aulitz `NobleCaparison02_mMarkvart` | 1.118 |

Pôr: `/horse gear preset horse_markvart`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Holohlavy

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `kzik_horse_gringolet` | Gringolet, nas cores dos Lordes de Holohlavy | Sela de cavaleiro da Transilvânia `WarSaddle02_m01` | Chanfron milanês `WarChanfron02_m03` | Caparazão dos Lordes de Holohlavy `NobleCaparison01_mJezek` | 2.268 |

Pôr: `/horse gear preset kzik_horse_gringolet`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Cavalo de Skalitz

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `horse_pros` | nas cores de Skalitz | Sela da Cracóvia `WarSaddle03_m05` | Bridão de torneio `NobleBridle02_m01` | Caparazão de Skalitz `Caparison01_mPros` | 2.787 |

Pôr: `/horse gear preset horse_pros`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### Outros cavaleiros

Com caparazão próprio, de personagens do jogo, e o cavalo de guerra de nobre sem brasão.

| Conjunto | De quem | Sela | Cabeça | Corpo | Preço (g) |
|---|---|---|---|---|---|
| `horse_erik_battle` | Erik | Sela de Bridon `NobleSaddle02_m04` | Chanfron milanês `WarChanfron02_m01` | Caparazão de torneio decorado `NobleCaparison08_mErik` | 2.011 |
| `horse_brunswiq` | Brunswick | Sela da Cracóvia `WarSaddle03_m01` | Bridão de torneio `NobleBridle02_m04` | Caparazão de Brunswick `CaparisonBrunswig_m01` | 2.978 |
| `horse_war_noble_01` | nobre, de guerra | Sela da Cracóvia `WarSaddle03_m01` | Chanfron tirolês `WarChanfron03_m01` | Caparazão acolchoado com arreio `PaddedCaparison05_m01` | 3.475 |

Pôr: `/horse gear preset horse_erik_battle`, montado no cavalo ou a até 12 m dele (troque pelo nome de outro conjunto da tabela).

### As peças nas cores de cada casa

Para pôr uma só: `/horse gear <código>`. Bergow, Kuttenberg, Praga, Nebakov, Písek, Vavák, Polner, Radzig, Zavish, Zimburg, Suchotlesky, a Ordem da Cruz e a Hungria não têm peça de cavalo com o brasão no jogo.

#### Leipa

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão de torneio liso | `Caparison01_mLeipa` | Corpo | 294 | 10,4 | 8 / 6 / 3 |
| Caparazão de torneio liso | `Caparison01_mLeipa01` | Corpo | 294 | 10,4 | 8 / 6 / 3 |
| Caparazão dos Lordes de Leipa | `Caparison03_mLeipa` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão dos Lordes de Leipa | `Caparison03_mLeipa01` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão dos Lordes de Leipa | `Caparison03_mLeipa02` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão dos Lordes de Leipa | `Caparison03_mLeipa03` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão de torneio nas cores de Leipa | `NobleCaparison01_mLeipa` | Corpo | 518 | 14,4 | 12 / 10 / 5 |
| Caparazão de torneio nas cores de Leipa | `NobleCaparison01_mLeipa02` | Corpo | 518 | 14,4 | 12 / 10 / 5 |
| Caparazão costurado nas cores de Leipa | `NobleCaparison02_mLeipa` | Corpo | 482 | 13,6 | 11 / 9 / 4 |
| Caparazão costurado nas cores de Leipa | `NobleCaparison02_mLeipa02` | Corpo | 482 | 13,6 | 11 / 9 / 4 |
| Caparazão de carrasco nas cores de Leipa | `NobleCaparison03_mLeipa` | Corpo | 356 | 12 | 9 / 7 / 4 |
| Caparazão de carrasco nas cores de Leipa | `NobleCaparison03_mLeipa02` | Corpo | 356 | 12 | 9 / 7 / 4 |
| Caparazão de carrasco nas cores de Leipa | `NobleCaparison06_mLeipa` | Corpo | 914 | 0,5 | 62 / 59 / 22 |
| Caparazão de carrasco nas cores de Leipa | `NobleCaparison07_mLeipa` | Corpo | 2 | 0,5 | 0 / 0 / 0 |
| Caparazão de torneio acolchoado | `PaddedCaparison01_mLeipa` | Corpo | 575 | 33,6 | 70 / 15 / 40 |
| Caparazão de torneio acolchoado | `PaddedCaparison01_mLeipa01` | Corpo | 575 | 33,6 | 70 / 15 / 40 |
| Caparazão acolchoado com arreio | `PaddedCaparison03_mLeipa` | Corpo | 375 | 28,8 | 50 / 10 / 30 |
| Caparazão acolchoado com arreio | `PaddedCaparison03_mLeipa01` | Corpo | 375 | 28,8 | 50 / 10 / 30 |
| Caparazão acolchoado com arreio | `PaddedCaparison05_mLeipa` | Corpo | 375 | 28,8 | 50 / 10 / 30 |

#### Semine

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão de torneio liso | `Caparison01_mSemin` | Corpo | 294 | 10,4 | 8 / 6 / 3 |
| Caparazão de torneio liso | `Caparison01_mSemin02` | Corpo | 294 | 10,4 | 8 / 6 / 3 |
| Caparazão do Lorde de Semine | `Caparison03_mSemin` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão de torneio acolchoado | `PaddedCaparison01_mSemin` | Corpo | 575 | 33,6 | 70 / 15 / 40 |
| Caparazão de torneio acolchoado | `PaddedCaparison01_mSemin02` | Corpo | 575 | 33,6 | 70 / 15 / 40 |
| Caparazão de carrasco acolchoado | `PaddedCaparison02_mSemin` | Corpo | 250 | 24 | 30 / 5 / 20 |
| Caparazão de carrasco acolchoado | `PaddedCaparison02_mSemin02` | Corpo | 250 | 24 | 30 / 5 / 20 |
| Caparazão acolchoado com arreio | `PaddedCaparison04_mSemin` | Corpo | 375 | 28,8 | 50 / 10 / 30 |

#### Ruthard

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão de torneio liso | `Caparison01_mRuhard` | Corpo | 294 | 10,4 | 8 / 6 / 3 |
| Caparazão de torneio liso | `Caparison01_mRuhard02` | Corpo | 294 | 10,4 | 8 / 6 / 3 |
| Caparazão do Lorde Ruthard | `Caparison03_mRuthard` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão do Lorde Ruthard | `Caparison03_mRuthard02` | Corpo | 231 | 8,8 | 6 / 4 / 3 |
| Caparazão de torneio acolchoado | `PaddedCaparison01_mRuthard` | Corpo | 575 | 33,6 | 70 / 15 / 40 |
| Caparazão de torneio acolchoado | `PaddedCaparison01_mRuthard02` | Corpo | 575 | 33,6 | 70 / 15 / 40 |
| Caparazão de carrasco acolchoado | `PaddedCaparison02_mRuthard02` | Corpo | 250 | 24 | 30 / 5 / 20 |
| Caparazão de carrasco acolchoado | `PaddedCaparison02_mRuthard03` | Corpo | 250 | 24 | 30 / 5 / 20 |

#### Aulitz

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão costurado nas cores de Aulitz | `NobleCaparison02_mMarkvart` | Corpo | 518 | 14,4 | 12 / 10 / 5 |
| Chapéu do Markvart von Aulitz (o nome que o jogo lhe deu; é um caparazão) | `NobleCaparison04_mMarkvart` | Corpo | 518 | 14,4 | 12 / 10 / 5 |

#### Holohlavy

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão dos Lordes de Holohlavy | `NobleCaparison01_mJezek` | Corpo | 518 | 14,4 | 12 / 10 / 5 |
| Caparazão dos Lordes de Holohlavy | `ztracenaCest_jezeksCaparison` | Corpo | 518 | 14,4 | 12 / 10 / 5 |

#### Skalitz

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão de Skalitz | `Caparison01_mPros` | Corpo | 26,9 | 1,7 | 8 / 6 / 4 |

#### Ordem Teutônica

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão teutônico | `Caparison02_mTeuton` | Corpo | 200 | 8 | 0 / 0 / 0 |

#### Rattay

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Rédeas de Rattay | `loot_rattayBridle` | Cabeça | 35 | 2 | 5 / 1 / 2 |
| Arreio de Rattay | `loot_rattayHarness` | Corpo | 61 | 8 | 20 / 10 / 15 |

#### Brunswick

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão de Brunswick | `CaparisonBrunswig_m01` | Corpo | 218 | 4,8 | 10 / 8 / 5 |

#### Erik

| Peça | Código | Parte | Preço (g) | Peso (kg) | Defesa corte / perf. / esm. |
|---|---|---|---|---|---|
| Caparazão de torneio decorado | `NobleCaparison08_mErik` | Corpo | 61 | 0,5 | 18 / 12 / 40 |

**Sem brasão:** o jogo tem ainda as famílias `horse_noble01` a `horse_noble20` (com `horse_noble_05` e `_06`), `horse_common01` a `horse_common20`, `horse_nomad01` a `horse_nomad20` (selas do leste, as dos cumanos) e `horse_draft` (de carroça). `/horse gear presets` lista todos, e a lista inteira com as peças de cada um está em `docs/guides/Resources/horse-gear.md`, na pasta do projeto.

## Casas e cidades

Para cada cidade, casa, ordem e reino que tem brasão no jogo, **tudo dele num lugar só**: as peças que levam o brasão (casacos, túnicas, capuzes, almofres...), o escudo de cavaleiro e a espada, as armaduras dos soldados do lugar e a **roupa do cavalo** (o conjunto do jogo e o caparazão). Cada bloco diz o comando: `/conjunto dar` para o pacote e as armaduras, `/give <código>` para uma peça, `/horse gear preset <nome>` para vestir o cavalo (só admin, montado nele ou a até 12 m).

Na ordem: [Kuttenberg](#kuttenberg), [Praga](#praga), [Skalitz](#skalitz), [Bergow: Trosky e Malešov](#bergow-trosky-e-malešov), [Leipa (Lípa): Raborsch](#leipa-lípa-raborsch), [Nebakov](#nebakov), [Písek](#písek), [Polner](#polner), [Ruthard](#ruthard), [Semine](#semine), [Vavák](#vavák), [Zavish](#zavish), [Zimburg](#zimburg), [Radzig](#radzig), [Holohlavy](#holohlavy), [Aulitz](#aulitz), [Ordem Teutônica](#ordem-teutônica), [Ordem da Cruz](#ordem-da-cruz), [Reino da Hungria](#reino-da-hungria).

### Kuttenberg

*cidade*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-kuttenberg [jogador]`. Veja o [pacote](#brasao-kuttenberg--kuttenberg-cidade).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro de Kuttenberg | `shieldKite_kuttenberg_A`, `shieldKite_kuttenberg_B` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mKuttenberg01_D`, `Coat02_mKuttenberg02_D`, `Coat02_mKuttenberg03_D`, `Coat02_mKuttenberg_D` | 104 |
| Casacos, túnicas e vestidos | Túnica simples | `Waffenrock02_mKuttenberg01_D`, `Waffenrock02_mKuttenberg02_D`, `Waffenrock02_mKuttenberg03_D`, `Waffenrock02_mKuttenberg_D` | 125 |
| Casacos, túnicas e vestidos | Casaco comum com brasão | `Coat04_mKuttenberg01_C`, `Coat04_mKuttenberg02_C`, `Coat04_mKuttenberg03_C`, `Coat04_mKuttenberg_C` | 163 |
| Casacos, túnicas e vestidos | Casaco quente bordado | `Coat11_mKuttenberg01_C`, `Coat11_mKuttenberg_C` | 203 |
| Casacos, túnicas e vestidos | Túnica de montaria | `Waffenrock08_mKuttenberg01_B`, `Waffenrock08_mKuttenberg02_B`, `Waffenrock08_mKuttenberg03_B`, `Waffenrock08_mKuttenberg_B` | 245 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mKuttenberg01_B`, `Waffenrock09_mKuttenberg02_B`, `Waffenrock09_mKuttenberg03_B`, `Waffenrock09_mKuttenberg04_B`, `Waffenrock09_mKuttenberg05_B`, `Waffenrock09_mKuttenberg_B` | 245 |
| Casacos, túnicas e vestidos | Túnica com fecho | `Waffenrock03_mKuttenberg01_A`, `Waffenrock03_mKuttenberg02_A`, `Waffenrock03_mKuttenberg03_A`, `Waffenrock03_mKuttenberg_A` | 335 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mKuttenberg_C` | 162 |
| Almofres | Capuz acolchoado | `CoifLarge02_mKuttenberg_C3` | 250 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mKuttenberg_B3` | 497 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Kuttenberg* ([ver todas](#kuttenberg)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `kuttenberg-1` | Soldado da cidade, nível 3 | comum | média | 3.699 |
| `kuttenberg-2` | Soldado da cidade, nível 3 | comum | média | 5.205 |
| `kuttenberg-3` | Soldado da cidade, nível 3 | comum | média | 7.960 |
| `kuttenberg-4` | Soldado da cidade, nível 4 | comum | média | 5.096 |
| `kuttenberg-5` | Soldado da cidade, nível 4 | comum | média | 7.150 |
| `kuttenberg-6` | Soldado da cidade, nível 4 | comum | média | 8.580 |
| `kuttenberg-7` | Soldado da cidade, nível 5 | comum | pesada | 5.494 |
| `kuttenberg-8` | Soldado da cidade, nível 5 | boa | pesada | 15.424 |
| `kuttenberg-9` | Soldado da cidade, nível 5 | excelente | pesada | 16.807 |
| `kuttenberg-10` | Soldado da cidade, nível 6 | boa | pesada | 16.253 |
| `kuttenberg-11` | Soldado da cidade, nível 6 | excelente | pesada | 22.400 |
| `kuttenberg-12` | Soldado da cidade, nível 6 | excelente | pesada | 25.597 |
| `kuttenberg-13` | Comandante da cidade | excelente | pesada | 21.931 |
| `kuttenberg-14` | Guarda de loja | comum | pesada | 7.248 |
| `kuttenberg-15` | Torneio, leve | básica | leve | 406 |
| `kuttenberg-16` | Torneio, leve | básica | leve | 3.048 |
| `kuttenberg-17` | Torneio, leve | comum | leve | 4.983 |
| `kuttenberg-18` | Torneio, pesado | comum | média | 3.747 |
| `kuttenberg-19` | Torneio, pesado | boa | pesada | 14.270 |
| `kuttenberg-20` | Torneio, pesado | nobre | pesada | 36.295 |

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Praga

*cidade*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-praga [jogador]`. Veja o [pacote](#brasao-praga--praga-cidade).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro da Cidade Velha de Praga | `shieldKite_prague_A`, `shieldKite_prague_B`, `shieldKite_prague_B_inverted`, `shieldKite_prague_C`, `shieldKite_prague_C_inverted` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Casaco comum de Praga com brasão | `Coat04_mPrague_C` | 163 |
| Casacos, túnicas e vestidos | Túnica com bainha de Praga | `Waffenrock01_mPrague01_C`, `Waffenrock01_mPrague02_C` | 185 |
| Casacos, túnicas e vestidos | Túnica de montaria de Praga | `Waffenrock08_mPrague_B` | 245 |
| Casacos, túnicas e vestidos | Túnica de Praga com botões | `Waffenrock03_mPrague_A` | 335 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mPrague01`, `Hood11_mPrague02` | 16,7–30,2 |
| Almofres | Capuz acolchoado | `CoifLarge02_mPrague_C3` | 250 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mPrague_B3` | 497 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Praga* ([ver todas](#praga)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `praga-1` | Soldado de Praga, nível 1 | básica | leve | 570 |
| `praga-2` | Soldado de Praga, nível 1 | básica | leve | 890 |
| `praga-3` | Soldado de Praga, nível 1 | básica | leve | 1.304 |
| `praga-4` | Soldado de Praga, nível 2 | básica | leve | 2.017 |
| `praga-5` | Soldado de Praga, nível 2 | básica | leve | 3.066 |
| `praga-6` | Soldado de Praga, nível 2 | comum | leve | 7.096 |
| `praga-7` | Soldado de Praga, nível 3 | comum | média | 6.362 |
| `praga-8` | Soldado de Praga, nível 3 | comum | média | 8.063 |
| `praga-9` | Soldado de Praga, nível 3 | boa | média | 13.152 |
| `praga-10` | Soldado de Praga, nível 4 | comum | pesada | 6.091 |
| `praga-11` | Soldado de Praga, nível 4 | excelente | pesada | 17.367 |
| `praga-12` | Soldado de Praga, nível 4 | nobre | pesada | 27.080 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Praga: `oblehaniSuchdole_horse_prague01`, `oblehaniSuchdole_horse_prague02`, `oblehaniSuchdole_horse_prague03`, `oblehaniSuchdole_horse_prague04`, `oblehaniSuchdole_horse_prague05` ([detalhes](#cavalo-de-praga)). Para pôr: `/horse gear preset oblehaniSuchdole_horse_prague01`.

### Skalitz

*cidade*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-skalitz [jogador]`. Veja o [pacote](#brasao-skalitz--skalitz-cidade).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro de Skalitz | `shieldKite_skalitz` | 136 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Avental de ferreiro do Henry | `TunicShort05_mPros` | 0 |
| Casacos, túnicas e vestidos | Túnica da forja do Henry | `Waffenrock09_mPros` | 245 |
| Casacos, túnicas e vestidos | Casaco de patrono | `Coat15_mPros` | 510 |
| Braços e mãos | Luvas de ferreiro do Henry | `Gloves05_mPros` | 181 |
| Outras | Chanfron de unicórnio | `WarChanfron04_mPros` | 1.265 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:**

- **Conjuntos do jogo** de Skalitz: `horse_pros` ([detalhes](#cavalo-de-skalitz)). Para pôr: `/horse gear preset horse_pros`.
- **Caparazões nas cores de Skalitz** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão de Skalitz: `Caparison01_mPros`.

### Bergow: Trosky e Malešov

*casa* · O jogo não tem caparazão com o brasão de Bergow: o cavalo do senhor é o do Lorde von Bergow, de arreio.

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-bergow [jogador]`. Veja o [pacote](#brasao-bergow--bergow-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro do Lorde de Bergow | `shieldHeater_bergov_A`, `shieldKite_bergov_A`, `shieldKite_bergov_B` | 82,1–160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mBergov_D` | 104 |
| Casacos, túnicas e vestidos | Túnica simples | `Waffenrock02_mBergov_D` | 125 |
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mBergov_C` | 185 |
| Casacos, túnicas e vestidos | Casaco bordado | `Coat11_mBergov_C` | 188 |
| Casacos, túnicas e vestidos | Túnica de montaria | `Waffenrock08_mBergov_B` | 245 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mBergov_B` | 245 |
| Casacos, túnicas e vestidos | Túnica ornamentada | `Waffenrock04_mBergov_A` | 335 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mBergov_C` | 147 |
| Almofres | Capuz acolchoado | `CoifLarge02_mBergov_C3` | 256 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mBergov_B3` | 497 |
| Braços e mãos | Manoplas de Nuremberg | `Gauntlets05_mBergov` | 2.265 |
| Calças | Calça com ligas | `HoseJoined02_mBergovCaptured` | 175 |
| Armas | Espada do Lorde von Bergow | `shortswordBergov` | 2.709 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`). **A do senhor:** Espada do Lorde von Bergow `shortswordBergov`.

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Malešov* ([ver todas](#malešov)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `malesov-1` | Soldado de Malešov | comum | média | 3.494 |
| `malesov-2` | Soldado de Malešov | comum | leve | 6.862 |
| `malesov-3` | Soldado de Malešov | boa | pesada | 12.360 |
| `malesov-4` | Vigia da vila | básica | leve | 1.133 |
| `malesov-5` | Guarda de Bergow, nível 5 | boa | pesada | 13.401 |
| `malesov-6` | Guarda de Bergow, nível 5 | excelente | pesada | 19.946 |
| `malesov-7` | Guarda de Bergow, nível 5 | nobre | pesada | 25.731 |
| `malesov-8` | Soldado de Bergow, nível 2 | básica | leve | 1.495 |
| `malesov-9` | Soldado de Bergow, nível 2 | comum | média | 7.169 |
| `malesov-10` | Soldado de Bergow, nível 2 | boa | pesada | 11.514 |
| `malesov-11` | Soldado de Bergow, nível 3 | comum | média | 4.186 |
| `malesov-12` | Soldado de Bergow, nível 3 | comum | pesada | 7.404 |
| `malesov-13` | Soldado de Bergow, nível 3 | boa | média | 12.892 |
| `malesov-14` | Soldado de Bergow, nível 4 | comum | média | 6.768 |
| `malesov-15` | Soldado de Bergow, nível 4 | boa | média | 9.334 |
| `malesov-16` | Soldado de Bergow, nível 4 | boa | pesada | 14.482 |
| `malesov-17` | Soldado de Bergow, nível 5 | boa | pesada | 11.252 |
| `malesov-18` | Soldado de Bergow, nível 5 | excelente | pesada | 17.208 |
| `malesov-19` | Soldado de Bergow, nível 5 | nobre | pesada | 37.748 |

*Trosky* ([ver todas](#trosky)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `trosky-1` | Homem armado de Trosky | boa | pesada | 13.755 |
| `trosky-2` | Homem armado de Trosky | excelente | pesada | 20.314 |
| `trosky-3` | Homem armado de Trosky | excelente | pesada | 24.899 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Trosky: `ttro_bergovHorse`, `horse_capontrosecko` ([detalhes](#cavalo-de-trosky)). Para pôr: `/horse gear preset ttro_bergovHorse`.
- Malešov: o jogo não tem cavalo próprio; o do Lorde von Bergow é `/horse gear preset ttro_bergovHorse`.

### Leipa (Lípa): Raborsch

*casa* · Os cavaleiros de Raborsch (Ratboř) montam com as cores de Leipa.

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-leipa [jogador]`. Veja o [pacote](#brasao-leipa--leipa-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo triangular dos Lordes de Leipa | `shieldHeater_lipa_A`, `shieldHeater_lipa_B` | 82,1 |
| Escudo de cavaleiro do Lorde de Bergow | `shieldKite_lipa` | 343 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mLeipa_D` | 104 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mLeipa_B` | 245 |
| Casacos, túnicas e vestidos | Túnica com fecho | `Waffenrock03_mLeipa_A` | 335 |
| Almofres | Capuz acolchoado | `CoifLarge02_mLeipa_C3` | 250 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Lípa* ([ver todas](#lípa)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `lipa-1` | Soldado dos senhores de Lípa, nível 2 | básica | leve | 2.695 |
| `lipa-2` | Soldado dos senhores de Lípa, nível 2 | básica | leve | 3.123 |
| `lipa-3` | Soldado dos senhores de Lípa, nível 3 | comum | média | 3.713 |
| `lipa-4` | Soldado dos senhores de Lípa, nível 3 | comum | média | 4.831 |
| `lipa-5` | Soldado dos senhores de Lípa, nível 3 | comum | média | 6.990 |
| `lipa-6` | Soldado dos senhores de Lípa, nível 4 | comum | leve | 8.912 |
| `lipa-7` | Soldado dos senhores de Lípa, nível 4 | boa | leve | 11.827 |
| `lipa-8` | Soldado dos senhores de Lípa, nível 4 | boa | leve | 13.569 |

*Raborsch* ([ver todas](#raborsch)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `raborsch-1` | Guarda de Raborsch | comum | leve | 4.674 |
| `raborsch-2` | Guarda de Raborsch | excelente | pesada | 16.661 |
| `raborsch-3` | Guarda de Raborsch | nobre | pesada | 37.195 |
| `raborsch-4` | Comandante (Ratboř) | boa | pesada | 16.577 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Lípa: `battle_leipa_01`, `battle_leipa_02`, `battle_leipa_03`, `battle_leipa_04`, `battle_leipa_05`, `battle_leipa_06`, `battle_leipa_07`, `battle_leipa_08`, `battle_leipa_09`, `battle_leipa_10`, `battle_leipa_11`, `battle_leipa_12` e mais 7 em [Cavalo de Lípa](#cavalo-de-lípa). Para pôr: `/horse gear preset battle_leipa_08`.
- **Conjuntos do jogo** de Raborsch: `setkaniVRatbori1_tempRatiborRetinueHorse`, `setkaniVRatbori1_tempRatiborRetinueHorse2`, `setkaniVRatbori1_tempRatiborRetinueHorse10` ([detalhes](#cavalo-de-raborsch)). Para pôr: `/horse gear preset setkaniVRatbori1_tempRatiborRetinueHorse`.
- **Caparazões nas cores de Leipa** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão de torneio liso: `Caparison01_mLeipa`, `Caparison01_mLeipa01`; Caparazão dos Lordes de Leipa: `Caparison03_mLeipa`, `Caparison03_mLeipa01`, `Caparison03_mLeipa02`, `Caparison03_mLeipa03`; Caparazão de torneio nas cores de Leipa: `NobleCaparison01_mLeipa`, `NobleCaparison01_mLeipa02`; Caparazão costurado nas cores de Leipa: `NobleCaparison02_mLeipa`, `NobleCaparison02_mLeipa02`; Caparazão de carrasco nas cores de Leipa: `NobleCaparison03_mLeipa`, `NobleCaparison03_mLeipa02`, `NobleCaparison06_mLeipa`, `NobleCaparison07_mLeipa`; Caparazão de torneio acolchoado: `PaddedCaparison01_mLeipa`, `PaddedCaparison01_mLeipa01`; Caparazão acolchoado com arreio: `PaddedCaparison03_mLeipa`, `PaddedCaparison03_mLeipa01`, `PaddedCaparison05_mLeipa`.

### Nebakov

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-nebakov [jogador]`. Veja o [pacote](#brasao-nebakov--nebakov-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de pipa dos lordes de Nebakov | `shieldKite_nebak_A`, `shieldKite_nebak_B`, `shieldKite_nebak_C`, `shieldKite_nebak_C_inverted` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mNebak_D` | 96,3 |
| Casacos, túnicas e vestidos | Túnica simples | `Waffenrock02_mNebak_D` | 116 |
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mNebak_C` | 171 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mNebak01_B`, `Waffenrock09_mNebak_B` | 226 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mNebak_C` | 162 |
| Almofres | Capuz acolchoado | `CoifLarge02_mNebak_C3` | 250 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mNebak_B3` | 497 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Nebakov* ([ver todas](#nebakov)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `nebakov-1` | Soldado de Nebakov, nível 2 | básica | leve | 2.207 |
| `nebakov-2` | Soldado de Nebakov, nível 2 | básica | leve | 2.444 |
| `nebakov-3` | Soldado de Nebakov, nível 2 | básica | leve | 2.835 |
| `nebakov-4` | Soldado de Nebakov, nível 3 | comum | média | 7.898 |
| `nebakov-5` | Soldado de Nebakov, nível 3 | comum | média | 8.663 |
| `nebakov-6` | Soldado de Nebakov, nível 4 | comum | média | 6.845 |
| `nebakov-7` | Soldado de Nebakov, nível 5 | boa | pesada | 15.087 |
| `nebakov-8` | Homem armado de Nebakov | boa | pesada | 11.284 |
| `nebakov-9` | Homem armado de Nebakov | boa | pesada | 11.630 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Nebakov: `utokNaNebakov_bartosHorse`, `utokNaNebakov_hankoHorse`, `utokNaNebakov_hermanHorse`, `utokNaNebakov_janHorse`, `utokNaNebakov_jesekHorse`, `utokNaNebakov_komoriHorse`, `utokNaNebakov_olbramHorse` ([detalhes](#cavalo-de-nebakov)). Para pôr: `/horse gear preset utokNaNebakov_bartosHorse`.

### Písek

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-pisek [jogador]`. Veja o [pacote](#brasao-pisek--písek-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro do Lorde de Pisek | `shieldHeater_pisek_B` | 82,1 |
| Escudo triangular do Lorde Pisek | `shieldHeater_pisek_A` | 82,1 |
| Escudo de cavaleiro dos Lordes de Hradetz | `shieldKite_pisek_A`, `shieldKite_pisek_B`, `shieldKite_pisek_C` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mPisek_D` | 104 |
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mPisek_C` | 185 |
| Casacos, túnicas e vestidos | Túnica de montaria | `Waffenrock08_mPisek_B` | 245 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mPisek_B` | 245 |
| Casacos, túnicas e vestidos | Casaco justo | `Coat08_mPisek_A` | 510 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mPisek_C` | 162 |
| Capuzes e chapéus | Capuz de brocado | `Hood03_mPisek_A` | 497 |
| Almofres | Capuz acolchoado | `CoifLarge02_mPisek_C3` | 250 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mPisek_B3` | 497 |
| Braços e mãos | Luvas de nobre | `Gloves06_mPisek_A` | 214 |
| Calças | Calça com ligas | `HoseJoined02_mPisek_B` | 163 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Písek* ([ver todas](#písek)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `pisek-1` | Soldado de Písek, nível 3 | comum | média | 3.932 |
| `pisek-2` | Soldado de Písek, nível 3 | comum | pesada | 7.050 |
| `pisek-3` | Soldado de Písek, nível 3 | boa | pesada | 10.461 |
| `pisek-4` | Soldado de Písek, nível 4 | comum | média | 6.924 |
| `pisek-5` | Soldado de Písek, nível 4 | comum | média | 8.450 |
| `pisek-6` | Soldado de Písek, nível 4 | boa | média | 9.802 |
| `pisek-7` | Soldado de Písek, nível 5 | boa | pesada | 12.967 |
| `pisek-8` | Soldado de Písek, nível 5 | excelente | pesada | 16.633 |
| `pisek-9` | Soldado de Písek, nível 5 | excelente | pesada | 17.184 |

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Polner

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-polner [jogador]`. Veja o [pacote](#brasao-polner--polner-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo triangular do Lorde Polner | `shieldHeater_polner` | 92,3 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mPolner_D` | 104 |
| Casacos, túnicas e vestidos | Uniforme da família Polner | `Waffenrock01_mPolner` | 185 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Polner* ([ver todas](#polner)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `polner-1` | Homem de Polner | boa | leve | 12.450 |
| `polner-2` | Homem de Polner | boa | pesada | 16.328 |
| `polner-3` | Homem de Polner | excelente | pesada | 18.452 |

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Ruthard

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-ruthard [jogador]`. Veja o [pacote](#brasao-ruthard--ruthard-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro do Lorde Ruthard | `shieldKite_ruthard_A`, `shieldKite_ruthard_A_inverted` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mRuthart_D` | 104 |
| Casacos, túnicas e vestidos | Túnica simples | `Waffenrock02_mRuthart01_D`, `Waffenrock02_mRuthart_D` | 125 |
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mRuthart_C` | 185 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mRuthart_B3` | 497 |
| Braços e mãos | Luvas de nobre | `Gloves06_mRuthard_A` | 214 |
| Pernas (armadura) | Perneiras laminares de cavaleiro | `LegsBrigandine04_mRuthard_A5` | 6.475 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Ruthard* ([ver todas](#ruthard)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `ruthard-1` | Soldado de Ruthard, nível 2 | básica | leve | 2.487 |
| `ruthard-2` | Soldado de Ruthard, nível 2 | básica | leve | 2.799 |
| `ruthard-3` | Soldado de Ruthard, nível 3 | boa | média | 11.699 |
| `ruthard-4` | Soldado de Ruthard, nível 3 | boa | pesada | 14.440 |
| `ruthard-5` | Soldado de Ruthard, nível 4 | boa | pesada | 9.741 |
| `ruthard-6` | Soldado de Ruthard, nível 4 | excelente | pesada | 18.452 |
| `ruthard-7` | Soldado de Ruthard, nível 4 | excelente | pesada | 22.502 |
| `ruthard-8` | Soldado de Ruthard, nível 5 | excelente | pesada | 24.626 |
| `ruthard-9` | Soldado de Ruthard, nível 5 | nobre | pesada | 27.108 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Ruthard: `battle_ruthard_01`, `battle_ruthard_02`, `battle_ruthard_03`, `battle_ruthard_04`, `battle_ruthard_05`, `battle_ruthard_06`, `battle_ruthard_07`, `battle_ruthard_08`, `battle_ruthard_09` ([detalhes](#cavalo-de-ruthard)). Para pôr: `/horse gear preset battle_ruthard_06`.
- **Caparazões nas cores de Ruthard** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão de torneio liso: `Caparison01_mRuhard`, `Caparison01_mRuhard02`; Caparazão do Lorde Ruthard: `Caparison03_mRuthard`, `Caparison03_mRuthard02`; Caparazão de torneio acolchoado: `PaddedCaparison01_mRuthard`, `PaddedCaparison01_mRuthard02`; Caparazão de carrasco acolchoado: `PaddedCaparison02_mRuthard02`, `PaddedCaparison02_mRuthard03`.

### Semine

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-semine [jogador]`. Veja o [pacote](#brasao-semine--semine-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro dos Lordes de Semine | `shieldKite_semin_A` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mSemin_D` | 104 |
| Casacos, túnicas e vestidos | Túnica simples | `Waffenrock02_mSemin_D` | 125 |
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mSemin_C` | 185 |
| Casacos, túnicas e vestidos | Túnica de montaria | `Waffenrock08_mSemin_B` | 245 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mSemin_B` | 245 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mSemin02_C`, `Hood11_mSemin_C` | 122–162 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mSemin_B3` | 497 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Semine* ([ver todas](#semine)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `semine-1` | Soldado de Semine, nível 2 | básica | leve | 1.989 |
| `semine-2` | Soldado de Semine, nível 2 | básica | leve | 2.466 |
| `semine-3` | Soldado de Semine, nível 2 | básica | leve | 2.790 |
| `semine-4` | Soldado de Semine, nível 3 | comum | média | 4.092 |
| `semine-5` | Soldado de Semine, nível 3 | comum | média | 6.187 |
| `semine-6` | Soldado de Semine, nível 3 | comum | média | 7.151 |
| `semine-7` | Soldado de Semine, nível 4 | comum | média | 5.914 |
| `semine-8` | Soldado de Semine, nível 4 | boa | pesada | 10.507 |
| `semine-9` | Soldado de Semine, nível 4 | excelente | pesada | 19.138 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Semine: `battle_semin_01`, `battle_semin_02`, `battle_semin_03`, `battle_semin_04`, `battle_semin_05`, `battle_semin_06`, `battle_semin_07`, `battle_semin_08`, `battle_semin_09`, `battle_semin_10`, `battle_semin_11`, `tsem_seminsrHorse` e mais 3 em [Cavalo de Semine](#cavalo-de-semine). Para pôr: `/horse gear preset battle_semin_08`.
- **Caparazões nas cores de Semine** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão de torneio liso: `Caparison01_mSemin`, `Caparison01_mSemin02`; Caparazão do Lorde de Semine: `Caparison03_mSemin`; Caparazão de torneio acolchoado: `PaddedCaparison01_mSemin`, `PaddedCaparison01_mSemin02`; Caparazão de carrasco acolchoado: `PaddedCaparison02_mSemin`, `PaddedCaparison02_mSemin02`; Caparazão acolchoado com arreio: `PaddedCaparison04_mSemin`.

### Vavák

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-vavak [jogador]`. Veja o [pacote](#brasao-vavak--vavák-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro dos Lordes de Hradetz | `shieldKite_vavak_A`, `shieldKite_vavak_B` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mVavak_D` | 104 |
| Casacos, túnicas e vestidos | Túnica para cavaleiro | `Waffenrock09_mVavak_B` | 245 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mVavak_C` | 162 |
| Almofres | Capuz acolchoado | `CoifLarge02_mVavak_C3` | 250 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Vavák* ([ver todas](#vavák)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `vavak-1` | Soldado de Vavák, nível 2 | básica | leve | 1.147 |
| `vavak-2` | Soldado de Vavák, nível 2 | básica | leve | 1.910 |
| `vavak-3` | Soldado de Vavák, nível 2 | básica | leve | 2.402 |
| `vavak-4` | Soldado de Vavák, nível 3 | comum | média | 5.947 |
| `vavak-5` | Soldado de Vavák, nível 3 | comum | média | 7.502 |
| `vavak-6` | Soldado de Vavák, nível 4 | boa | média | 10.119 |
| `vavak-7` | Soldado de Vavák, nível 4 | boa | leve | 11.338 |
| `vavak-8` | Soldado de Vavák, nível 4 | boa | leve | 15.000 |
| `vavak-9` | Soldado de Vavák, nível 5 | boa | pesada | 11.041 |
| `vavak-10` | Soldado de Vavák, nível 5 | boa | pesada | 13.090 |
| `vavak-11` | Soldado de Vavák, nível 5 | boa | pesada | 15.263 |

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Zavish

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-zavish [jogador]`. Veja o [pacote](#brasao-zavish--zavish-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo triangular de Sir Zavish | `shieldHeater_peony`, `shieldHeater_zavis` | 92,3 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Túnica dos Lordes de Garbow | `Waffenrock01_mZavis` | 243 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Zimburg

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-zimburg [jogador]`. Veja o [pacote](#brasao-zimburg--zimburg-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro dos Lordes de Zimburg | `shieldKite_cimburk` | 143 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mCimburk_C` | 185 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Radzig

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-radzig [jogador]`. Veja o [pacote](#brasao-radzig--radzig-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro de Sir Radzig | `shieldKite_skalitz_02` | 148 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Capuzes e chapéus | Capuz bordado | `Hood06_mRadzig` | 168 |
| Tronco (armadura) | Kastenbrust | `CuirassCapon_mRadzig` | 4.237 |
| Braços e mãos | Luvas de equitação | `Gloves05_mRadzig` | 186 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Holohlavy

*casa*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-holohlavy [jogador]`. Veja o [pacote](#brasao-holohlavy--holohlavy-casa).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo triangular dos Lordes de Holohlavy | `shieldHeater_holohlav_A`, `shieldHeater_pisek_C`, `shieldHeater_pisek_D` | 82,1–92,3 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Outras | Caparazão dos Lordes de Holohlavy | `NobleCaparison01_mJezek` | 518 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:**

- **Conjuntos do jogo** de Holohlavy: `kzik_horse_gringolet` ([detalhes](#cavalo-de-holohlavy)). Para pôr: `/horse gear preset kzik_horse_gringolet`.
- **Caparazões nas cores de Holohlavy** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão dos Lordes de Holohlavy: `NobleCaparison01_mJezek`, `ztracenaCest_jezeksCaparison`.

### Aulitz

*casa*

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Capacetes | Bacinete do nobre | `BascinetVisor04_mAulitz_A5` | 8.977 |
| Golas | Gola de armadura com insígnia | `CollarChain02_mAulitz` | 801 |
| Tronco (armadura) | Jaquetão longo | `GambesonLong01_fnc_mAulitz` | 343 |
| Braços e mãos | Manoplas de Nuremberg | `Gauntlets05_mAulitz` | 2.265 |
| Braços e mãos | Braçais de placa de Magdeburgo | `ArmPlate05_mAulitz` | 3.966 |
| Outras | Caparazão costurado nas cores de Aulitz | `NobleCaparison02_mMarkvart` | 518 |
| Outras | Chapéu do Markvart von Aulitz | `NobleCaparison04_mMarkvart` | 518 |

**Roupa do cavalo:**

- **Conjuntos do jogo** de Aulitz: `horse_markvart`, `horse_markvart_dream` ([detalhes](#cavalo-de-aulitz)). Para pôr: `/horse gear preset horse_markvart`.
- **Caparazões nas cores de Aulitz** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão costurado nas cores de Aulitz: `NobleCaparison02_mMarkvart`; Chapéu do Markvart von Aulitz: `NobleCaparison04_mMarkvart`.

### Ordem Teutônica

*ordem*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-ordem-teutonica [jogador]`. Veja o [pacote](#brasao-ordem-teutonica--ordem-teutônica-ordem).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro teutônico | `shieldKite_teuton_01`, `shieldKite_teuton_02`, `shieldKite_teuton_03` | 218 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de irmão leigo teutônico | `Coat02_mTeuton` | 104 |
| Casacos, túnicas e vestidos | Sobretudo teutônico | `Coat02_mTeuton02` | 104 |
| Casacos, túnicas e vestidos | Túnica de irmão leigo teutônico | `Waffenrock01_mTeuton` | 179 |
| Casacos, túnicas e vestidos | Túnica teutônica | `Waffenrock09_mTeuton` | 263 |
| Casacos, túnicas e vestidos | Túnica teutônica dividida | `Waffenrock04_mTeuton` | 364 |
| Capuzes e chapéus | Capuz teutônico | `Hood11_mTeuton` | 116 |
| Tronco (armadura) | Brigandina teutônica | `Brigandine05_mTeuton` | 3.351 |
| Outras | Caparazão teutônico | `Caparison02_mTeuton` | 200 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:**

- **Caparazões nas cores de Ordem Teutônica** (`/horse gear <código>`; os detalhes em [As peças nas cores de cada casa](#as-peças-nas-cores-de-cada-casa)): Caparazão teutônico: `Caparison02_mTeuton`.

### Ordem da Cruz

*ordem*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-ordem-da-cruz [jogador]`. Veja o [pacote](#brasao-ordem-da-cruz--ordem-da-cruz-ordem).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro da Ordem da Cruz | `shieldKite_redstar_A`, `shieldKite_redstar_B` | 243 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Túnica dos Cruzados da Estrela Vermelha | `Waffenrock01_mKrizovnik01_C`, `Waffenrock01_mKrizovnik02_C`, `Waffenrock01_mKrizovnik03_C`, `Waffenrock08_mKrizovnik01_B`, `Waffenrock08_mKrizovnik02_B` | 171–226 |
| Capuzes e chapéus | Capuz dos Cavaleiros da Cruz | `Hood09_mKrizovnik01_C`, `Hood09_mKrizovnik02_C` | 110 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.

### Reino da Hungria

*reino*

**Pacote pronto** (casaco com o brasão, escudo de cavaleiro e espada do cavaleiro): `/conjunto dar brasao-hungria [jogador]`. Veja o [pacote](#brasao-hungria--reino-da-hungria-reino).

**Escudos:**

| Escudo | Código | Preço (g) |
|---|---|---|
| Escudo de cavaleiro húngaro | `shieldKite_sigismund_A`, `shieldKite_sigismund_B`, `shieldKite_sigismund_C` | 160 |

**Peças com o brasão:**

| Parte | Peça | Código | Preço (g) |
|---|---|---|---|
| Casacos, túnicas e vestidos | Sobretudo de brasão | `Coat02_mMagyar01_D`, `Coat02_mMagyar_D` | 104 |
| Casacos, túnicas e vestidos | Casaco comum com brasão | `Coat04_mMagyar_C` | 163 |
| Casacos, túnicas e vestidos | Túnica com bainha | `Waffenrock01_mMagyar01_C`, `Waffenrock01_mMagyar_C` | 185 |
| Capuzes e chapéus | Capuz de servo | `Hood11_mMagyar_C` | 162 |
| Almofres | Capuz de malha com brasão | `CoifMail02_mMagyar_B3` | 497 |

**Espada do cavaleiro:** Espada do cavaleiro `shortswordHeavy` (`/give shortswordHeavy`).

**Armaduras dos soldados do lugar** (cada uma é um conjunto inteiro: `/conjunto dar <id> [jogador]`, ou `/conjunto vestir <id>` num corpo masculino):

*Sigismundo* ([ver todas](#sigismundo)):

| Conjunto | Quem | Categoria | Peso | Preço (g) |
|---|---|---|---|---|
| `sigismundo-1` | Soldado do exército de Sigismundo, nível 2 | básica | leve | 2.029 |
| `sigismundo-2` | Soldado do exército de Sigismundo, nível 2 | básica | leve | 3.191 |
| `sigismundo-3` | Soldado do exército de Sigismundo, nível 2 | básica | leve | 3.227 |
| `sigismundo-4` | Soldado do exército de Sigismundo, nível 3 | comum | média | 4.394 |
| `sigismundo-5` | Soldado do exército de Sigismundo, nível 3 | comum | média | 4.967 |
| `sigismundo-6` | Soldado do exército de Sigismundo, nível 3 | comum | média | 5.015 |
| `sigismundo-7` | Soldado do exército de Sigismundo, nível 4 | boa | pesada | 11.705 |
| `sigismundo-8` | Soldado do exército de Sigismundo, nível 4 | boa | pesada | 13.487 |
| `sigismundo-9` | Soldado do exército de Sigismundo, nível 4 | boa | pesada | 14.235 |
| `sigismundo-10` | Soldado do exército de Sigismundo, nível 5 | boa | pesada | 10.546 |
| `sigismundo-11` | Soldado do exército de Sigismundo, nível 5 | boa | pesada | 15.427 |
| `sigismundo-12` | Soldado do exército de Sigismundo, nível 5 | excelente | pesada | 16.862 |
| `sigismundo-13` | Soldado do exército de Sigismundo, nível 6 | excelente | pesada | 18.278 |
| `sigismundo-14` | Soldado do exército de Sigismundo, nível 6 | nobre | pesada | 32.630 |

**Roupa do cavalo:** o jogo não tem nenhuma com as cores deste lugar.
