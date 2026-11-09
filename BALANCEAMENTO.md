# Balanceamento do reino: levantamento e padrão (03/11/2026)

Pedido: *"vamos fazer um levantamento em todas profissões, na fome, na energia, na fome do cavalo, no drop de itens, na fabricação, e vamos padronizar tudo: xp ganho em profissões e etc; vamos refazer o balanceamento de up; a ideia é deixar tudo em um nível médio padronizado que faça sentido, igual valor de venda de couro do NPC e o valor de compra de outro NPC, para evitar jogadores quebrarem a economia; vamos ver dados de up de jogadores e de item"*.

Os dados são do servidor de verdade: as **147 fichas de personagem** (84 jogaram nos últimos 3 dias) e os **logs de 28/10 18:41 a 02/11 23:23** (cerca de 5 dias, 204 mil linhas do gamemode). As contas com o apelido "Player" são várias pessoas com o mesmo nome no log; onde isso confunde, elas ficaram de fora das contas por jogador.

## Resumo do que muda

| O quê | Antes | Agora |
| --- | --- | --- |
| XP por hora de ofício | de ~480 (costura) a ~2.800 (lenha) | todos perto de ~700, o da horta |
| XP de carvão, fundição, linha, água fervida | inteiro | 1/4 |
| Limite de XP de ofício por dia | nenhum (houve dia de 36 mil) | 2.500 por habilidade, depois 25% |
| Preço de uma coisa em comerciantes diferentes | podia ser diferente | um só, em todo o reino |
| Quem compra cada coisa | 84 coisas compradas por 2 ou 3 guildas | uma guilda só |
| Peça feita (poção, espada, arco, roupa) vendida ao NPC | valor do jogo (até 60 moedas) | o valor dos materiais, mais o do nível |
| Equipamento de saque que ninguém faz | até 60 moedas | até 7,2 |
| Lasca de pedra | 0,8 moeda | ninguém compra |
| Moedas dos baús do mundo | 5-30 / 10-120 / 15-270 | 2-8 / 4-16 / 6-24 |
| Fome, sede, energia | — | sem mudança (já fazem sentido) |

## 1. O XP dos ofícios

**Quanto custa um nível.** Medido nos logs, entre duas linhas "chegou ao nível" do mesmo jogador: cerca de **28 vezes o número do nível** (uns 200 XP para o 7, 300 para o 10, 420 para o 15, 560 para o 20, 670 para o 24). **Do 5 ao 30 são uns 13 mil XP.**

**Quanto cada ofício dava por hora de trabalho firme** (com o 4x que valia para todos):

| Ofício | XP por hora | Observação |
| --- | --- | --- |
| Lenha (Coletor) | ~2.800 | um corte a cada 5-10 s, 16 XP cada |
| Forja | ~2.600 | o carvão e o aço eram a fazenda: **5.007 carvões e 1.906 aços em 5 dias** |
| Alquimia | ~2.600 | |
| Beneficiar a colheita | ~1.400 | moer 10 trigos dava 120 XP; colher o canteiro, 24 |
| Defumador | ~1.300 | |
| Fogo (cozinha) | ~1.200 | |
| **Horta** | **~580** | o ritmo acertado em 27/10 (*"principalmente agricultor"*) |
| Costura | ~480 | rendia menos que a horta |

**Quem subiu rápido demais:** Áttila foi do ofício manual 7 ao 24 em **7,4 horas**; Lypos do 6 ao 16 em 2,1 h; Marek fez **36.565 XP** de ofício num dia (o 5→30 inteiro duas vezes e meia); uma das contas "Player" fez 64.508. Entre os 28 jogadores com ofício manual acima de 5, **um quarto já está no 30**.

**O padrão novo** (`src/server/profession-xp.ts`, `/xpoficios`):
- **Quanto cada ofício paga** (vezes o XP das tabelas): forja, alquimia, lenha, mineração e beneficiar **1x**; fogo, defumador e secador **2x**; horta, ordenha e tosquia **4x** (como antes); costura **5x**.
- **O começo da cadeia** (carvão, fundição, barra de prata, linha, água fervida) paga **1/4** do XP da receita. O que se faz com eles paga inteiro.
- **Limite do dia:** os primeiros **2.500 XP de cada habilidade** por dia rendem inteiros; depois, **25%** de cada obra, até a meia-noite de Brasília. O jogador é avisado no chat quando passa. O XP do próprio jogo (luta, montaria, livros) não conta.

**Os mesmos 5 dias de log, refeitos com o padrão novo** (XP de um dia de trabalho forte de cada ofício: o dia típico forte, os 10% mais fortes e o recorde):

| Ofício | Antes | Agora |
| --- | --- | --- |
| Forja | 7.452 / 16.748 / 33.224 | 1.051 / 2.150 / 2.775 |
| Alquimia | 7.088 / 7.088 / 11.232 | 1.772 / 1.772 / 2.586 |
| Lenha | 6.752 / 9.600 / 14.624 | 1.688 / 2.400 / 2.789 |
| Fogo | 5.676 / 5.676 / 13.666 | 2.289 / 2.289 / 5.022 |
| Horta | 2.252 / 3.648 / 5.756 | 2.141 / 2.252 / 2.787 |
| Costura | 1.192 / 3.182 / 3.876 | 1.139 / 1.660 / 2.993 |
| Defumador | 1.380 / 1.920 / 5.052 | 690 / 960 / 2.509 |

Na prática, quem trabalha firme sobe **de 2 a 5 níveis por dia** (antes, até 20), e do 5 ao 30 leva **pelo menos uns 6 dias** de trabalho cheio. Quem já subiu fica com o nível. Para acelerar ou frear tudo de uma vez: `/xpoficios <fator>` (1 é o padrão) e `/xpoficios limite <xp>`.

## 2. A economia dos comerciantes

**O dinheiro que os NPCs puseram no jogo** em 5 dias: pagaram **24.608 moedas** aos jogadores e receberam **8.596**. Por guilda, o que pagaram: Boticário 7.545, Caçador 5.942, Agricultor 5.542, Taberneiro 2.666, Coletor 1.150, Ferreiro 987, Costureira 714, Domador 62. **No último dia, 39 contas tiraram 11.100 moedas** das bolsas; as maiores tiraram **1.234, 1.054 e 1.019 moedas cada, de cinco guildas diferentes** (a bolsa é de 300 por guilda, e a mesma mercadoria era comprada por várias).

**O dinheiro dos jogadores:** 40.051 moedas carregadas no total; metade dos personagens tem até 100, 10% têm mais de 711 e o mais rico 2.714.

**As brechas encontradas:**
- **Comprar num NPC e vender noutro com lucro** (o exemplo do couro): a **pele de vaca** saía a 6 no Caçador e na Costureira, e o Boticário pagava 7,2; o **cobre** saía a 6 no Ferreiro, e o Coletor pagava 7,2; o **sal**, o **linho** e o **lúpulo** saíam a 2, e outro NPC pagava 2,4. A causa: o NPC vendia pela raridade escrita à mão, e o outro comprava pela raridade do valor do jogo.
- **84 coisas** eram compradas por duas ou três guildas (as ervas pelo Boticário e pelo Agricultor, as carnes pelo Caçador e pelo Taberneiro, a cenoura por três).
- **O que os ofícios fazem** era comprado pelo valor do jogo, de três a dez vezes o do reino: o Boticário pagava **20 moedas** por uma poção *do Henry* feita com uma moeda de ervas; o Ferreiro **60** por qualquer espada (as dos bandidos também) e o Caçador **60** por qualquer arco ou besta.

**O padrão novo** (`makePriceBook` em `src/server/guild-shops.ts`; detalhes em `NPCS.md`):
- **Um preço só** para cada coisa, em todo NPC que a vende ou compra (a raridade: comum 2, incomum 6, raro 18, muito raro 50, excepcional 150; o NPC paga 40%).
- **O que os ofícios fazem vale o que entra nele:** os materiais crus da receita mais barata, mais **5% por nível** da receita, nunca mais que a raridade pelo valor do jogo. Assim o NPC paga por uma peça **no máximo o que os materiais custam na prateleira**: comprar material do NPC para fazer e vender de volta nunca dá lucro; fazer com o que se colheu, cortou, plantou ou caçou dá. Uma coisa que o NPC vende mas que sai barata da receita (linha, água fervida, carvão) ele compra pelo valor da receita.
- **Um comprador só:** quem vende compra de volta; as ervas são do Boticário; o que a horta dá e beneficia, do Agricultor; o que as árvores e pedras dão, do Coletor; o que uma bancada faz, da guilda dela.
- **Equipamento que nenhum ofício faz** (de bandido, de missão) vale no máximo como raro (o NPC paga até 7,2).
- **Lasca de pedra:** ninguém compra (é o "nada" da pedra).

**Exemplos** (o que o NPC paga, em moedas):

| Coisa | Antes | Agora |
| --- | --- | --- |
| Aqua Vitalis do Henry | 20 | 8 |
| Aqua Vitalis fraca | 7,2 | 4 |
| Espada militar | 60 | 15,7 |
| Espada de caça (a dos bandidos) | 20 | 7,9 |
| Arco da vila | 20 | 5,3 |
| Balestra de caça antiga | 60 | 13,5 |
| Pele de vaca | 2,4 (Caçador) / 7,2 (Boticário) | 2,4 (só o Caçador) |
| Carne de cervo defumada | 2,4 | 2,6 |
| Linha | 0,8 | 0,3 |
| Lasca de pedra | 0,8 | — |

Conferido por testes com o valor real de cada item do jogo (`tests/pricebook.test.cjs`): **nenhum** NPC paga por uma coisa o que outro pede por ela, **nenhuma** coisa tem dois compradores e **nenhuma** das receitas feitas com material de prateleira dá lucro vendida de volta.

**Ficou como estava:** a bolsa de **300 moedas por guilda e por jogador** (pedido de 31/10). Com um comprador só para cada coisa, a mesma mercadoria não enche mais várias bolsas.

## 3. Saque e recursos

| O quê | Números | Decisão |
| --- | --- | --- |
| Baús do mundo | 257 com tesouro (153 perto das vilas, 66 no meio, 38 longe), 3 h para reabastecer | **moedas baixadas**: perto 2-8, meio 4-16, longe 6-24 (eram 5-30, 10-120, 15-270) |
| Bandidos | bolsa 2-8 moedas, chefe 40-90 | ficou; o equipamento deles agora vende pelo padrão (espada de caça 7,9) |
| Coletor | até 787 lenhas e 53 minérios de prata num dia (prata 1% a 3% da pedra) | ficou; o XP baixou (1x) |
| Horta | até 1.636 colheitas num dia (Ctibor) | ficou; o XP do beneficiar baixou para 1x (moer 10 trigos: 30 XP, colher o canteiro: 24) |
| Abate | a carne do animal cortada pela metade | ficou |

## 4. Fome, sede e energia

| Necessidade | Ritmo | Como se repõe |
| --- | --- | --- |
| Sede | **2,5 h** de cheio a seco | água de poço e rio, bebidas |
| Energia | **4 h** acordado; **12 min** deitado ou 30 sentado para encher | cama, saco de dormir, chão |
| Fome (nível *leve*, o escolhido) | **5 h** de barriga cheia | pão ~19%, assado ~26%, sopas 18-38% |

A ordem faz sentido (a sede é a mais rápida, a fome a mais lenta) e nenhum número está fora: **sem mudança**. Para apertar ou afrouxar a fome existe `/fome`. (A fome do cavalo, que durava **6 h** só com o dono no jogo, saiu em 09/11/2026 com o menu do cavalo e a comida dele.)

## 5. Também nesta atualização: passivas e pontos perdidos

Reportado (*"Lev Von Staufen ... depois que retiramos as passivas roubadas não recebeu seus pontos de volta; temos que ver se não prejudicamos jogadores e tomar cuidado ao dar pontos de volta para não upar eles sem querer"*).

**O que houve.** A retirada das 9 passivas fortes em 01/11 devolveu os pontos certos a 15 entradas (o Lev recebeu 5 às 06:50). O problema foi outro: às vezes o jogo entrega ao corpo, no meio da sessão, a progressão de um **personagem novo** (tudo no nível 5). O servidor punha os **níveis** de volta, mas o salvamento seguinte gravava as **passivas e os pontos do personagem novo** por cima dos do jogador. Assim **Lev** (02/11 18:00), **Arthur** (17:58), **Agnes** (18:40) e **Ludmilla** (03:15) perderam **todas** as passivas e **todos** os pontos. O Lev tinha 150 talentos em 30/10 e ficou com 26.

**A conferência de todos.** O jogo dá **1 ponto a cada 2 níveis acima do 5** (13 no nível 30); a conta "pontos dos níveis = passivas compradas + pontos sobrando" fecha **exatamente em 137 dos 147 personagens**. Fora dela: o Marbon e a Luance, com pontos a mais (as concessões de administrador), e 8 com pontos faltando: os quatro acima e 4 casos pequenos e mais antigos (de antes de 30/10, causa desconhecida): Goran (6), Urik (6), Arvid (2) e Joachim (2).

**A correção** (`src/server/character-state.ts`, `looksFresh`/`keepProgression`): quando a progressão do jogo é a de um personagem novo, o salvamento **mantém as passivas e os pontos do arquivo**, e a olhada periódica devolve **tudo** (níveis, passivas e pontos). Um atraso de uma habilidade só (um XP que veio baixo) continua devolvendo só os níveis, para não desfazer uma passiva comprada na hora.

**A devolução** (com o servidor parado, na subida): as passivas que cada um tinha no backup de **30/10** (nunca as 9 fortes, a família da alquimia ou os combos) e, em cada árvore, os pontos que os níveis dão, menos as passivas e os pontos que já tem. **Os níveis não são tocados e nada passa do que a regra do jogo dá**:

| Personagem | Passivas de volta | Pontos de volta |
| --- | --- | --- |
| Lev | 80 | 46 |
| Arthur | 11 | 11 |
| Ludmilla | 10 | 6 |
| Agnes | — (não tinha comprado em 30/10) | 24 |
| Goran | — | 6 |
| Urik | — | 6 |
| Arvid | — | 2 |
| Joachim | — | 2 |

O que alguém comprou entre 30/10 e a perda volta como ponto, para comprar de novo. Seis personagens que ainda não entraram desde 01/11 (Kael, Patrik, Sytzigan, Vincenc, Urik e Joachim) ainda têm passivas fortes na ficha: na próxima entrada elas saem e o ponto volta, como para os outros.

## 6. Decisões que ficam com você

- **A bolsa dos NPCs:** 300 moedas por guilda e por jogador (hoje). Uma alternativa é **300 por jogador somando todas as guildas**: o NPC vira de fato só um piso e o dinheiro passa a circular entre os jogadores.
- **O limite diário do XP:** 2.500 por habilidade. Mais alto deixa quem joga muito subir mais rápido; mais baixo nivela mais.
- **O ritmo geral:** `/xpoficios <fator>` multiplica todos os ofícios de uma vez, sem mexer no equilíbrio entre eles.
