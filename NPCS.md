# NPCs do servidor

Lista de todos os NPCs que o gamemode `kcdc-gamemode` mantém, gerada a partir do código, dos dados e do log de início do servidor (17/10/2026; vilas e cocheiros atualizados em 21/10/2026).

> **Atualização de 31/10/2026.** Voltam os vendedores, de outro jeito: **um comerciante por guilda em cada cidade** (veja "Comerciantes de guilda", abaixo). Os comerciantes antigos de Suchdol, das vilas, das fogueiras e dos banhos continuam desligados.

> **Atualização de 29/10/2026.** Os NPCs **vendedores** (os comerciantes de Suchdol, o ferreiro, o boticário e o taberneiro das vilas, os mascates e os banhistas) e os **mestres de habilidade** foram **removidos** a pedido do dono do servidor: compra e venda são entre jogadores, e as habilidades se aprendem jogando. Os interruptores `vendorSettings.enabled` (`src/server/vendors.ts`) e `teacherSettings.enabled` (`src/server/teachers.ts`) ficam em `false`; o código e os dados continuam no projeto, e as seções abaixo descrevem como eles eram. Continuam: cocheiros, barbeiros, bandidos e animais.

## Resumo

| Grupo | Quantos | Onde / como vivem |
| --- | ---: | --- |
| ~~Comerciantes de Suchdol~~ (removidos) | 5 | cada um na sua loja, à noite em casa (entram e saem pelo degrau de fora da porta) |
| ~~Ferreiro, boticário e taberneiro das vilas~~ (removidos) | 27 | Malešov, Raborsch, Wysoka, Bylany, Bohunowitz, Minas, Kuttenberg, Miskowitz, Pschitoky: fora de uma casa livre da vila, de dia pela vila e à noite na cama (sem casa livre, ficam no lugar) |
| **Comerciantes de guilda** | 128 (8 em cada uma das 16 cidades) | parados onde o jogo põe o ofício; só de dia (de noite somem) |
| Cocheiros da viagem rápida | 13 | ao lado da carroça de cada parada; de noite vão dormir na casa mais perto |
| ~~Mascates (e bufarinheiras)~~ (removidos) | 13 | uma em cada fogueira de beira de estrada |
| ~~Banhistas~~ (removidos) | 8 | nos banhos de Suchdol, Zikmundovo, Minas, Kuttenberg e Malešov; à noite entram pela porta de prédio mais perto (ou somem onde estão, sem ninguém vendo) |
| Barbeiros | 5 | um em cada vila grande, com cadeira |
| ~~Mestres de habilidade~~ (removidos) | 38 | onde o jogo os põe; ensinam por moedas |
| Bandidos de acampamento | 25 em 5 acampamentos | os do nível, com baús de saque |
| Bandidos de esconderijo | 53 em 14 esconderijos | na mata, a mais de 300 m de qualquer lugar com gente |
| Salteadores de estrada | até 4 bandos de cada vez | aparecem nas estradas diante de quem viaja (sem lugar fixo) |
| Animais selvagens e de fazenda | até 700 corpos ao mesmo tempo | 4796 vagas nos pontos do nível; só existem perto de jogadores |

Fixos hoje (cocheiros e barbeiros): **18** (eram 109 com as lojas, vilas, mascates, banhos e mestres). Com os bandidos de lugar fixo, **96** (eram 187). Os animais vêm e vão com os jogadores.

## Comerciantes de guilda

Pedido de 31/10/2026: *um NPC por guilda, parado onde devia ficar no jogo; E abre o menu Comprar/Vender, Aprender Guilda Ofício e Sair*. São **oito comerciantes em cada uma das 16 cidades e terras** da Cidadania (`src/server/guild-vendors.ts`, `guild-shops.ts`, lugares em `guild-posts-data.ts`, feito por `tools/make-guild-posts.py`). Ficam em pé, sem rotina (nada de passeio nem de cama), e **só existem de dia**: o dia do mundo dura 40 minutos reais e a noite outros 40; ao anoitecer o corpo some e de manhã volta. Cada corpo existe só enquanto há um jogador a menos de 110 m, e ninguém os fere; um que cai no rio ou fica preso é refeito no lugar (o guarda de `npc-keeper.ts`).

**Onde ficam.** Cada um no lugar que o próprio jogo dá ao ofício: o ferreiro na loja do ferreiro (ou na ferraria), o taberneiro no balcão da taverna (ou junto do estalajadeiro do nível), o alquimista na mesa de alquimia ou na casa do boticário, o caçador junto do curtidor ou do açougueiro, o coletor nos serrados e minas, o agricultor nas lavouras, o domador onde o nível vende cavalos, o artesão no alfaiate, no sapateiro ou em loja de feira. Em Suchdol, os cinco primeiros ficam onde estavam os vendedores antigos. **79 dos 128** têm lugar do jogo; os **49 restantes** (vilas pequenas, sem aquele ofício no mapa) ficam em volta do meio da vila, para o dono mover com `/mercador aqui <id>`.

**No chão** (01/11/2026: *ficam no ar voando*): quando um jogador chega a 40 m, o jogo dele diz o que há sob os pés do comerciante, e um comerciante no ar (mais de 0,3 m) ou afundado é posto no chão; o log diz `guild-vendors: ... estava N m acima do chão ...: posto no chão`. Os 42 que ainda estão na roda em volta do meio da vila (`ring`, na contagem de 01/11/2026) ficam onde a altura foi estimada: o melhor é o administrador pô-los no lugar com `/mercador aqui <número>`.

**O menu (E).** *Comprar/Vender*, *Aprender Guilda: <ofício>*, *Tirar dúvidas* e *Sair*.

**Tirar dúvidas** (01/11/2026: *conversas possíveis com eles para tirar dúvidas, exemplo: o que eu posso fazer sendo um ferreiro*): seis perguntas, três do ofício (o que se faz nele, onde se trabalha e como começar, de onde vêm os materiais; no Domador, onde ficam os cavalos selvagens e que comida aceitam) e três de todo comerciante (como subir de nível, o que ele compra e vende, como entrar na guilda). Respostas longas vêm em partes, com *Continuar*; depois *Outra pergunta*, *Voltar* ou *Sair*. As respostas estão em `src/server/vendor-talk.ts`: mude junto com o ofício.

| Guilda | Nome | Vende (só o básico) | Compra |
| --- | --- | --- | --- |
| Ferreiro | Mestre Ferreiro | kits de reparo (armadura, arma, arco), sucata, ferro, aço, cobre, material de fixação, carvão | o que ele vende, o que a forja faz (armas, arcos, bestas, ferraduras, peças de espada, barra de prata) |
| Caçador | Mestre Caçador | peles (vaca, porco, ovelha, veado) e flechas | peles, carne, peixe, penas, presas, o que o defumador faz |
| Taberneiro | Taberneiro | farinha, malte, lúpulo, ovos, água, leite, sal, mel, banha (a banha também vem do porco abatido por caçador) | o que ele vende, bebidas e o que o fogo faz |
| Alquimista | Boticário | flores (camomila, dente-de-leão, calêndula, hipérico, hortelã, sálvia, valeriana, cardo, confrei, urtiga) e água potável | **todas as ervas**, poções, o que o secador faz |
| Artesão | Costureira | linha, pano, peles | linha, pano e o que a costura faz (roupas, joias) |
| Coletor | Mestre Coletor | machado e picareta | o machado e a picareta, lenha, madeira de arco e exótica, minério de prata, enxofre, salitre, jaspe, pó de esmalte, teia (**não compra lasca de pedra**) |
| Agricultor | Agricultor | sementes das lavouras comuns (legumes, grãos, linho) | as colheitas (menos as ervas), as sementes, o que se beneficia na horta |
| Domador | Mestre Domador | **os três cavalos mais fracos do jogo, a 200 moedas cada** (Pebbles, o cavalo comum e Bitterklee, de sela e rédea simples; **um por jogador**, outro só quando esse morrer) e o que um cavalo come | comida de cavalo e ferraduras |

**O dinheiro.** Cada jogador tem **300 moedas com cada ofício** (31/10/2026: *o limite de 300 deve valer para todos os NPCs do mesmo tipo no mapa, isso evita o jogador farmar infinito*): os ferreiros de todas as cidades vendem a você, juntos, até 300 moedas de mercadoria e pagam, juntos, até 300 moedas por coisa sua; o que você comprou ou vendeu no ferreiro de Suchdol já saiu do ferreiro de Kuttenberg. Os caçadores têm a sua bolsa, os taberneiros a deles, e assim por diante. Outro jogador esvaziar o comerciante não muda o seu valor. Tudo volta ao normal um dia depois do primeiro negócio (`playerdata/guild-shops.json`, uma linha para cada jogador e ofício; o arquivo antigo, com uma linha por comerciante, é juntado na subida: vale o que sobrou de menos). A tela de compra é a do próprio jogo, numa loja feita só para aquele jogador. Ao abrir a tela o comerciante diz no chat quanto ainda compra **de você**, que a conta é só sua e vale para todos os comerciantes do ofício, e quando enche de novo (01/11/2026: um jogador achou que os valores *estavam todos zerados e não eram individuais*; em `guild-shops.json` não há conta partilhada entre jogadores: cada uma é de um jogador e um ofício, e a que ele via era a dele, gasta num outro comerciante do mesmo ofício). Exemplo: *Mestre Ferreiro: ainda compra até 200 moedas de você. A conta é só sua e vale para todos os vendedores desse ofício no reino; enche de novo em 19 h.*

**Os preços** são **pela raridade do item** (Boêmia, 1403: bem mais baixos que os do jogo): comum 2 moedas, incomum 6, raro 18, muito raro 50, excepcional 150; o comerciante paga **40%** disso.

**Um preço só para cada coisa, em todo o reino (03/11/2026:** *"padronizar ... igual valor de venda de couro do NPC e o valor de compra de outro NPC, para evitar jogadores quebrarem a economia"***).** Até então cada comerciante dava preço do seu jeito, e dava para comprar num e vender noutro com lucro: a **pele de vaca** saía a 6 no Caçador e na Costureira e o Boticário pagava 7,2 por ela; o **cobre** saía a 6 no Ferreiro e o Coletor pagava 7,2; o **sal**, o **linho** e o **lúpulo** saíam a 2 e outro comerciante pagava 2,4. E o que os ofícios fazem era comprado pelo valor do jogo, três a dez vezes o do reino: o Boticário pagava **20 moedas** por uma poção *do Henry* feita com uma moeda de ervas, e o Ferreiro e o Caçador **60** por qualquer espada, arco ou besta (também as dos bandidos). Agora (`makePriceBook` em `src/server/guild-shops.ts`):
- **O que um comerciante vende** custa a raridade, a mesma em todos que vendem (a pele de vaca é incomum em todo lugar).
- **O que os ofícios fazem** vale o que entra nele: o preço das coisas cruas da receita mais barata (o carvão é a sua lenha, o aço o seu ferro e carvão), mais **5% por nível** da receita (o ofício vale alguma coisa: no nível 10 é 1,5 vez, no 30 é 2,5 vezes), nunca mais que a raridade pelo valor do jogo. O comerciante paga 40% disso, então paga por uma peça **no máximo o que os materiais custam na prateleira**: comprar o material para fazer e vender de volta nunca dá lucro; fazer com o que se colheu, cortou, plantou ou caçou dá. Exemplos: Aqua Vitalis do Henry 20 → **8**; a fraca 7,2 → **4**; espada militar 60 → **15,7**; espada de caça 20 → **7,9**; arco da vila 20 → **5,3**; balestra de caça antiga 60 → **13,5**; carne de cervo defumada 2,4 → **2,6**. Uma coisa que o comerciante vende mas que sai barata da receita é comprada pelo valor da receita: a linha (3 carretéis de um linho) por 0,3, a água fervida por 0,2, o carvão por 0,6.
- **Equipamento que nenhum ofício faz** (o elmo de um bandido, uma arma de missão) vale no máximo como coisa **rara** (o comerciante paga até 7,2).
- **Um comprador só:** cada coisa é comprada pelos comerciantes de **uma guilda**: quem vende compra de volta; senão as **ervas** são do Boticário, o que a **horta** dá e beneficia é do Agricultor, o que as **árvores e pedras** dão é do Coletor, o que uma **bancada** faz é da guilda dela (forja → Ferreiro, costura → Costureira, alquimia e secador → Boticário, defumador → Caçador, fogo → Taberneiro), e o resto do primeiro comerciante cuja lista o nomeia. Antes, **84 coisas** eram compradas por duas ou três guildas, e a mesma mercadoria enchia várias bolsas de 300 moedas por dia (no último dia antes da mudança, contas tiraram de 1.000 a 1.234 moedas de cinco guildas). O Domador compra agora só o que ele vende (pera, beterraba e nabo); ferraduras são do Ferreiro e cenoura e maçã do Agricultor.
- A **lasca de pedra** não é mais comprada por ninguém: é o "nada" da pedra (um quarto de cada batida) e, a 0,8 moeda, era dinheiro.
- O log do início diz `guild-vendors: um preço por coisa em todo o reino, e uma guilda que compra cada uma (ferreiro N, cacador N, ... tipos)` na primeira tela de compra aberta.

**Aprender Guilda.** O comerciante ensina o seu ofício, numa conversa, **só a quem é cidadão da vila onde ele vive**. **O primeiro ofício que um jogador aprende é de graça; cada outro custa 100 moedas** (um ofício aprendido de novo também), sem usar a troca grátis do painel. Quem aprende ganha o título do ofício e o kit da guilda. Desde 09/11/2026 não há mais o Escrivão: quem cedia a guilda pelo painel (o escrivão, o mestre de ofício e o senhor das terras) deixou de poder, e o jogador escolhe a guilda sozinho na seção **Guildas** do painel. O administrador aprende sem pagar.

## Comerciantes de Suchdol

| Nome | Ofício | Roupa | Dinheiro |
| --- | --- | --- | --- |
| Mestre Ferreiro | ferreiro | do ofício (preset do jogo) | 500 moedas |
| Boticário | boticário (alquimista) | do ofício (preset do jogo) | 500 moedas |
| Taberneiro | taberneiro | do ofício (preset do jogo) | 500 moedas |
| Mestre Caçador | caçador | do ofício (preset do jogo) | 500 moedas |
| Costureira | costureira (alfaiate) | de camponesa | 500 moedas |

## Vilas: ferreiro, boticário e taberneiro

Uma vila é uma região mapeada com **três casas ou mais** no censo ("Casa 01"...). Em 20/10/2026 o mapa passou de 6 para 17 regiões (veja `/propriedade` em `COMANDOS.md`), e as vilas novas ganharam os seus vendedores; cada um mora na casa livre mais perto de onde fica (a do taberneiro passa a se chamar "Taverna de <vila>", e ele prefere uma taverna do censo, se houver uma livre); sem casa livre ao alcance, fica no lugar, dia e noite. O log do início diz `vendors: N vendedor(es) de vilas`.

| Vila | Casas no censo | Moram em casa | Observação |
| --- | ---: | ---: | --- |
| Bohunowitz | 3 | 2 | ferreiro e boticário em casa; o taberneiro fica no lugar (nenhuma casa livre ao alcance) |
| Bylany | 6 | 3 | os três, cada um numa casa livre |
| Minas | 6 | 3 | os três, cada um numa casa livre |
| Kuttenberg | 84 | 3 | só os três, apesar do tamanho da cidade |
| Malešov | 6 | 0 | todas as casas têm dono (a conta de administração): os três ficam no lugar |
| Miskowitz | 8 | 3 | os três, cada um numa casa livre |
| Pschitoky | 4 | 2 | ferreiro e boticário em casa; o taberneiro fica no lugar (nenhuma casa livre ao alcance) |
| Raborsch | 4 | 0 | todas as casas têm dono (a conta de administração): os três ficam no lugar, sem casa, até haver casa livre |
| Wysoka | 4 | 2 | ferreiro e boticário em casa; o taberneiro fica no lugar (nenhuma casa livre ao alcance) |

Sem vendedores por terem menos de três casas: Stará Kutná (2), Stará Lhota (2), Horschan (2), Danemark (1), Opatowitz (1), Estalagem de Pschitoky (1) e Rabstein (0). O Devil's Den e o acampamento do exército (Zikmundovo) não foram mapeados.

## Cocheiros da viagem rápida

Um cocheiro ao lado da carroça de cada uma das 13 paradas, postas à mão em 20/10/2026 (`src/server/travel.ts`): Suchdol, Raborsch, Malešov, Wysoka, Kuttenberg, Zikmundovo, Minas, Bylany, Bohunowitz, Miskowitz, Pschitoky, Stará Kutná e Horschan. Falar com o cocheiro (E) lista as outras paradas com o preço (5 moedas mais 15 por km); de noite ele vai dormir na casa mais perto e as viagens param. Veja "Viagem rápida de carroça" em `COMANDOS.md`.

## Mascates das fogueiras

Cada um fica a poucos passos da fogueira (que o servidor acende), olha e cumprimenta quem chega, anda um pouco em volta. Vestem agora as roupas dos mascates do próprio jogo (antes estavam sem roupa).

| # | Nome | Lugar | Fogueira (x, y) |
| ---: | --- | --- | --- |
| 1 | Mascate | Bohounovice, à beira d'água | 1775, 3696 |
| 2 | Mascate | Bylansko, estrada do campo | 1654, 829 |
| 3 | Bufarinheira | Kuklicko, na clareira | 2527, 2072 |
| 4 | Mascate | Lorec, à beira da estrada | 3669, 1137 |
| 5 | Mascate | Malešov, na mata | 757, 748 |
| 6 | Bufarinheira | Miskovicko, estrada da estalagem | 1895, 1691 |
| 7 | Mascate | Miskovicko, à beira da estrada | 1316, 1855 |
| 8 | Mascate | Rabštejnsko, na mata | 779, 1285 |
| 9 | Bufarinheira | Ratboricko, no campo de feno | 1304, 3477 |
| 10 | Mascate | Rozcestí, na encruzilhada | 1207, 2993 |
| 11 | Mascate | Rozcestí, à beira da estrada | 764, 2711 |
| 12 | Bufarinheira | Stará Kutná, à beira da estrada | 3226, 1159 |
| 13 | Mascate | Zikmundovo, à beira da estrada | 1481, 2363 |

## Banhistas

| # | Nome | Banho | Posição (x, y) |
| ---: | --- | --- | --- |
| 1 | Dona dos Banhos | Suchdol | 741, 3348 |
| 2 | Dona dos Banhos | Zikmundovo | 1740, 2806 |
| 3 | Banhista | Zikmundovo | 1739, 2805 |
| 4 | Banhista | Minas | 3208, 2168 |
| 5 | Banhista | Minas | 3210, 2167 |
| 6 | Administradora dos Banhos | Kuttenberg | 3083, 465 |
| 7 | Banhista | Kuttenberg | 3082, 466 |
| 8 | Banhista | Malešov | 564, 256 |

## Barbeiros

| Nome | Vila | Posição (x, y) |
| --- | --- | --- |
| Barbeiro | Kuttenberg | 3044, 470 |
| Barbeiro | Suchdol | 598, 3282 |
| Barbeiro | Wysoka | 428, 2511 |
| Barbeiro | Raborsch | 1441, 3830 |
| Barbeiro | Malesov | 560, 258 |

## Mestres de habilidade (38)

| Nome | O que ensinam (até que nível) | Posição (x, y) |
| --- | --- | --- |
| Jan Ramalhete de Zimburg | Armas pesadas (maças, machados) 20, Espadas (esgrima) 20, Armas de haste 20, Equitação 15 | 1751, 1077 |
| Alfaiate Mikush | Artesanato 10 | 1703, 1029 |
| Kubyenka | Briga (luta desarmada) 15, Pontaria (arco e besta, caça) 15, Bebida 15 | 2908, 2914 |
| Diabo Seco | Espadas (esgrima) 15, Armas de haste 10, Armas pesadas (maças, machados) 15, Equitação 10 | 2908, 2914 |
| Tobias "Querido" | Equitação 15, Adestramento (cães) 15 | 3268, 2215 |
| Fundidor Volkmar | Artesanato 15, Bebida 15, Roubo 10 | 3262, 2210 |
| Ferreiro Zdimir | Artesanato 15 | 3193, 2196 |
| Matthew, o Coletor | Espadas (esgrima) 10, Armas de haste 10, Armas pesadas (maças, machados) 10, Roubo 10, Furtividade 10, Pontaria (arco e besta, caça) 10 | 1064, 2445 |
| Meirinho Andreas Plumel | Espadas (esgrima) 15, Armas de haste 15, Pontaria (arco e besta, caça) 15, Briga (luta desarmada) 15, Armas pesadas (maças, machados) 15 | 3201, 747 |
| Arne, o GermÃ¢nico | Espadas (esgrima) 10, Armas de haste 20, Armas pesadas (maças, machados) 20, Briga (luta desarmada) 15 | 3092, 856 |
| Comandante da Guarda Hans Plumel | Espadas (esgrima) 15, Armas pesadas (maças, machados) 15, Armas de haste 15, Briga (luta desarmada) 15, Pontaria (arco e besta, caça) 15 | 3148, 787 |
| Coveiro Frantishek | Furtividade 20, Briga (luta desarmada) 20, Artesanato 15 | 3172, 958 |
| Estalajadeiro Havel | Alquimia 5, Bebida 15 | 3090, 856 |
| Mestre Sem Pelos | Pontaria (arco e besta, caça) 15, Adestramento (cães) 10, Artesanato 15 | 3175, 394 |
| AÃ§ougueiro Emmeram | Briga (luta desarmada) 15, Adestramento (cães) 15, Armas pesadas (maças, machados) 15 | 3299, 776 |
| Mestre Nicholas Krondel | Artesanato 20 | 3213, 782 |
| Rata | Roubo 15, Furtividade 15, Pontaria (arco e besta, caça) 10 | 3215, 456 |
| Minerador Lazar | Pontaria (arco e besta, caça) 20, Furtividade 10 | 3304, 774 |
| Sapateiro Linhart | Espadas (esgrima) 15, Armas de haste 15, Armas pesadas (maças, machados) 10, Briga (luta desarmada) 15, Artesanato 10 | 3140, 804 |
| Espadeiro Hans Mannlicher | Artesanato 15 | 3203, 674 |
| Carpinteiro Corvo | Furtividade 10, Artesanato 15, Pontaria (arco e besta, caça) 15 | 2763, 642 |
| Menhard von Frankfurt | Espadas (esgrima) 20, Armas de haste 10, Armas pesadas (maças, machados) 10 | 3093, 855 |
| Mestre Nicholas de Praga | Espadas (esgrima) 15, Armas de haste 10, Armas pesadas (maças, machados) 15 | 2942, 762 |
| BoticÃ¡rio Oswald Torwart | Alquimia 20, Sobrevivência (caça, rastros, ervas) 20, Erudição 15 | 3057, 805 |
| Mestre Prokop Eldris | Alquimia 15, Artesanato 15 | 3113, 400 |
| Rosa Ruthard | Erudição 15, Pontaria (arco e besta, caça) 10 | 2993, 665 |
| Golias | Armas pesadas (maças, machados) 10, Briga (luta desarmada) 15 | 3217, 446 |
| CavalariÃ§o Hashtal | Equitação 15, Artesanato 10, Furtividade 10 | 448, 734 |
| Janosh Uher | Armas pesadas (maças, machados) 15, Roubo 10, Furtividade 10, Sobrevivência (caça, rastros, ervas) 10 | 1538, 1995 |
| Paskal, filho do ferreiro | Briga (luta desarmada) 15, Artesanato 10, Furtividade 10 | 1538, 1925 |
| FuncionÃ¡rio Krizhan | Bebida 10, Erudição 10, Artesanato 10 | 2280, 1845 |
| Vauquelin Brabant | Espadas (esgrima) 10, Armas de haste 10, Pontaria (arco e besta, caça) 10, Equitação 10, Erudição 10 | 1438, 3833 |
| Padre Hroznata | Alquimia 10, Erudição 15, Sobrevivência (caça, rastros, ervas) 15 | 1574, 3850 |
| CapitÃ£o Frenzl | Espadas (esgrima) 15, Armas de haste 15, Armas pesadas (maças, machados) 15 | 751, 3345 |
| Estalajadeiro Slivka | Alquimia 5, Sobrevivência (caça, rastros, ervas) 5 | 593, 3242 |
| Moleiro Hermann | Alquimia 5, Roubo 20, Furtividade 20 | 1570, 216 |
| Padre AntÃ´nio | Briga (luta desarmada) 15, Erudição 10, Pontaria (arco e besta, caça) 15 | 425, 2514 |
| Musa do Mali | Alquimia 20, Erudição 20, Sobrevivência (caça, rastros, ervas) 20 | 1632, 2783 |

## Bandidos

Acampamentos (os do nível):

| # | Acampamento | Bandidos | Baús | Posição (x, y) |
| ---: | --- | ---: | ---: | --- |
| 1 | Bohounovice | 5 | 6 | 1888, 3763 |
| 2 | Mezholezsko | 5 | 1 | 219, 1467 |
| 3 | Vrchlicko 2 | 5 | 2 | 1216, 391 |
| 4 | Vrchlicko 3 | 5 | 6 | 1742, 155 |
| 5 | Kuklicko 2 | 5 | 1 | 2972, 1778 |

Esconderijos na mata (escolhidos pelo servidor a cada subida, longe de qualquer lugar com gente):

| # | Esconderijo | Bandidos | Posição (x, y) |
| ---: | --- | ---: | --- |
| 1 | Esconderijo 1 | 3 | 2004, 779 |
| 2 | Esconderijo 2 | 4 | 673, 2848 |
| 3 | Esconderijo 3 | 4 | 279, 120 |
| 4 | Esconderijo 4 | 4 | 1127, 3162 |
| 5 | Esconderijo 5 | 3 | 1667, 2644 |
| 6 | Esconderijo 6 | 3 | 1427, 1371 |
| 7 | Esconderijo 7 | 3 | 332, 3367 |
| 8 | Esconderijo 8 | 3 | 2365, 3278 |
| 9 | Esconderijo 9 | 4 | 364, 2048 |
| 10 | Esconderijo 10 | 5 | 3753, 346 |
| 11 | Esconderijo 11 | 5 | 720, 481 |
| 12 | Esconderijo 12 | 4 | 968, 2172 |
| 13 | Esconderijo 13 | 4 | 1017, 963 |
| 14 | Esconderijo 14 | 4 | 1665, 3321 |

A agressividade é uma escolha da administração (`/bandidos agressividade baixa|media|alta`): quão longe veem, quão forte batem, quantos lutam de perto por vez, até onde se ouve o alarme e quanto tempo o acampamento persegue. Eles gritam ao ver alguém, ao dar o alarme e ao levar um golpe.

**O cerco** (2026-10-30: *"eles correram junto e fizeram tudo junto, sem mecânica nem cerco; quase impossível matar só um"*): um acampamento não ataca mais todo de uma vez.

- O alarme só é ouvido por quem está perto de um bandido que já luta (30 m no nível médio, 15 no baixo, 50 no alto) e cada um responde depois de um instante: a reação própria (0,3 a 1,8 s) mais o tempo do grito até ele (8 m por segundo). Quem foi golpeado sabe quem bateu e luta na hora. Atacar um bandido isolado, longe dos outros, não chama o acampamento.
- Dos bandidos atrás de um jogador, só **um** luta de perto por vez em todos os níveis (desde 02/11; mais um para cada amigo do jogador a até 12 m, até dois). Os arqueiros atiram, **afastados uns dos outros**: quem para a menos de 2,2 m de outro homem dá 3,5 m para o lado e atira de lá (04/11). Os demais **cercam** a 5,5 m do jogador, um de cada lado e depois atrás, chegando por fora (nunca através dele), e **não ficam parados**: de 3,5 a 6 s dão um passo pequeno, um pouco de lado e mais perto, e se viram de novo para ele (04/11).
- **Turnos de 15 a 25 s** (eram 6 a 10 s até 04/11): acabada a vez, quem estava na frente volta para o cerco e o mais próximo assume. Um bandido com menos de 45% da vida recua e outro assume; quem o jogador encosta (2,5 m) ou quem leva um golpe luta na hora e **segura a posição 6 s depois do último contato**; quem acabou de dar a vez não volta só porque o jogador chegou perto, mas **reage a um golpe novo**. Um ponto do cerco onde o jogo não consegue pôr o bandido o manda para a frente depois de duas recusas.
- Mais fáceis de derrubar: vida 140 (veteranos 200), golpe ×1,4 no nível médio (×1,0 no baixo, ×1,8 no alto), poção que cura 35% da vida.

## Animais

**Vendedores de guilda (31/10/2026).** Cada vendedor mostra o nome do ofício sobre a cabeça (Ferreiro, Caçador, Taberneiro, Alquimista, Artesão, Coletor, Agricultor, Domador). Na tela F3 há a seção **NPCs** (título "NON LUSOR PERSONA"): os 128 vendedores por região (um senhorio e as suas terras) e por vila, cada um com o número que `/mercador aqui <número>` pede, o estado (em pé, é noite, sem ninguém), a origem do lugar, a posição e um botão que copia o comando. Busca por vila, ofício ou número; filtro por ofício (`npcListing`, `src/server/guild-vendors.ts`). **Um vendedor desativado (botão *Desativar NPC*) não conta** entre os moradores que a seção Cidadania mostra de cada cidade (01/11/2026), e volta a contar quando é ativado.

**O lorde e a trava (04/11/2026), retirados em 09/11/2026.** *"delete também a tela de npc que um lorde pode ter acesso onde ele consegue desativar npcs, deixando só a tela de npc do admin"*. A seção **NPCs** do **F2** (grupo Reino), onde o lorde ativava e desativava os vendedores de guilda das terras dele, saiu, e com ela o botão **Trancar NPC / Destrancar NPC** do F3, que só existia para manter o lorde de fora, e a recusa que ele lia (*"Este NPC foi trancado por um administrador..."*). Fica a seção **NPCs** do **F3**, só do administrador: os vendedores de guilda, os barbeiros e os cocheiros por região e vila, com o número que `/mercador aqui` pede, o estado, o lugar, a posição, o botão que copia o comando e **Ativar NPC** / **Desativar NPC** (os vendedores de guilda). Desativado, o vendedor **some do mundo** até ser ativado de novo e deixa de contar entre os moradores da vila. Tudo fica em `playerdata/guild-disabled.json` (`off`) e sobrevive a um reinício; um arquivo de antes, com a lista `locked`, é lido sem ela. Código: `src/server/guild-vendors.ts` (`npcListing`), eventos `status.npcs` e `status.npcDisable`, só do administrador.

**Cavalos mortos (31/10/2026).** O corpo de um cavalo que morre, de jogador, selvagem ou do nível, fica no chão **5 minutos** (o tempo de um caçador abatê-lo) e é tirado do mundo (`src/server/horse-corpses.ts`); um que voltou à vida no meio tempo (o do dono que está fora do jogo) fica. Os corpos dos outros animais saem depois de 90 segundos, como antes.

| Animal | Vagas nos pontos do nível |
| --- | ---: |
| Lebre (`Hare`) | 286 |
| Javali (`Boar`) | 543 |
| Porco (`Pig`) | 84 |
| Corça (`RoeDeerHind`) | 1212 |
| Corço (`RoeDeerBuck`) | 734 |
| Cerva (`RedDeerDoe`) | 563 |
| Veado (`RedDeerStag`) | 482 |
| Ovelha (`SheepEwe`) | 170 |
| Carneiro (`SheepRam`) | 31 |
| Vaca (`CattleCow`) | 172 |
| Touro (`CattleBull`) | 17 |
| Lobo (`Wolf`) | 300 |
| Cão selvagem (`WildDog`) | 202 |

Cada ponto do nível guarda 1,6 vez o rebanho que o nível previu (lobos e cães selvagens 1,3; bichos de fazenda 1; **lebres só 0,3** e sem rebanhos extras: eram 36% das vagas e as mais difíceis de acertar). Só existem corpos perto de jogadores (até 150 m) e, somando tudo o que o jogo do jogador já roda a 120 m (bandidos, gente das vilas, animais), no máximo 24 por jogador: o servidor entrega cada corpo ao jogo do jogador mais próximo, e um corpo que ninguém roda fica parado e não leva golpe. Lebres, corças e veados fogem de quem chega perto. Só lobos e cães selvagens atacam (é o único ataque de animal que o mod aceita). Um animal de caça ferido além de 65% da vida é abatido na hora, com a morte do próprio jogo.

## Não são NPCs, mas andam pelo mundo

- Os cavalos, as carroças e o cão de apoiador de cada jogador (seção Animais do painel).
- Baús de tesouro espalhados pelo mapa (`/tesouros`).
