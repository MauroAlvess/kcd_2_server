# Sinergia entre as guildas

Análise das **802 receitas** dos ofícios (gerada de `craft-data.ts`, 2026-10-27), feita para a retirada dos NPCs: o que cada guilda pede, de quem vem, e o que foi fechado para que as guildas se abasteçam entre si. "Slot" abaixo é um ingrediente numa receita (a soma de todos os ingredientes de todas as receitas: 2.195). Um teste (`tests/synergy.test.cjs`) falha se uma receita nova pedir um ingrediente que ninguém consegue.

## 1. O que cada guilda pede, e de quem vem

Linhas = quem **consome** (a guilda da receita). Colunas = quem **fornece** o ingrediente.

| Consome \ Fornece | Agricultor | Coletor | Ferreiro | Taberneiro | Alquimista | Caçador | Mundo¹ | Sem fonte |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Artesão** (339 receitas) | **602** | 25 | 12 | – | – | 179 | – | **0** |
| **Ferreiro** (276) | 61 | **473** | 358 | – | – | 108 | 10 | **0** |
| **Taberneiro** (78) | 52 | 20 | – | 31 | 4 | 31 | 27 | **0** |
| **Alquimista** (43 secador + 39 mesa) | **97** | 11 | 5 | 23 | 6 | 21 | 2 | **0** |
| **Caçador** (27 defumador) | 4 | 5 | – | 1 | – | 25 | 2 | **0** |

¹ Mundo = o que o servidor já põe no mapa: ovos e penas nos ninhos, mel nas colmeias, peixes nas armadilhas (a cada 40 min, `nests.ts`) e o leite das vacas.

O que isso diz:

- **Artesão ← Agricultor** é a dependência mais pesada de todo o servidor: 602 slots, quase tudo **linho** (290 receitas) e **linha de costura** (375 receitas, 885 unidades). Era o NPC alfaiate quem vendia as duas.
- **Ferreiro ← Coletor**: 473 slots (sucata, ferro, fixação, cobre, lenha, madeira de arco). E o Ferreiro depende de si mesmo (358): carvão, aços, barras de prata.
- **Taberneiro** é o mais variado: grãos e legumes (Agricultor), lenha e sal (Coletor), carne (Caçador), ovos, mel, peixe e leite (mundo), e a própria água, vinho e banha.
- **Alquimista** vivia de **ervas** (97 slots do Agricultor agora) e de água e vinho (Taberneiro).
- O **Domador** não tem receitas: é cliente de todos (cenouras e maçãs do Agricultor, ferraduras e arreios do Ferreiro e do Artesão).

## 2. As cadeias fechadas

| Cadeia | Como funciona agora |
|---|---|
| **Linho → Linha → roupa** | Agricultor planta **Linho** (nível 0, 40 min, 3-5 por canteiro) e **fia** na própria página da horta: 1 linho → 3 linhas de costura. O Artesão compra linho e linha do Agricultor. |
| **Trigo → Farinha** | Agricultor planta **Trigo** (nível 1) e **mói** (1 trigo → 1 farinha). O Taberneiro assa pão. |
| **Cevada → Malte, Lúpulo** | Agricultor planta **Cevada** (nível 3) e **maltea**; planta **Lúpulo** (nível 9). O Taberneiro faz cerveja. |
| **Uva → Vinho** | Agricultor planta **Uva** (nível 14); o Taberneiro faz **Vinho** (4 uvas + 1 água → 2 vinhos) no fogo; o Alquimista usa o vinho nas bases. |
| **Lenha → Água** | O Coletor corta lenha; o Taberneiro **ferve água** (1 lenha → 4 águas potáveis); o Alquimista e a cozinha usam a água. |
| **Vaca → Leite** | O **Agricultor** aperta **E na vaca** (hint "Ordenhar"; 6 s, 1-3 leites, +1 do nível 15, +4 XP de sobrevivência; a mesma vaca dá de novo depois de 30 min). O **Caçador** que abate uma vaca acha 1-3 leites na carcaça, junto da carne e do couro (touro não tem). |
| **Sucata → Fixação, Ferro** | A pedra dá sucata; o Ferreiro faz **Material de fixação** (1 sucata → 3) e **Ferro** (2 sucatas + carvão). |
| **Ferro → Aço → Frankfurt → Toledo** | Categoria **Fundição** na forja: Aço = ferro + carvão; Frankfurt = 2 aços + 2 carvões; Toledo = Frankfurt + aço + 3 carvões. |
| **Guardas e pomos de espada** | Categoria **Peças de espada** na forja, de ferro, aço e cobre (as espadas as pediam; o NPC as vendia). |
| **Pá** | O Ferreiro forja a pá do Agricultor (2 ferros + lenha + carvão). |
| **Sementes sem NPC** | Na página da horta, "Sementes": 2 colheitas de qualquer planta → 1 semente dela (no nível da planta). O kit do Agricultor agora traz linho e trigo (os agricultores que já existiam recebem as duas na próxima entrada). |
| **Ervas** | O Agricultor ganhou as ervas que só o boticário vendia: dente-de-leão, cardo, confrei, sabugueiro, absinto, valeriana, erva-de-são-joão, eufrásia, tanaceto, beladona, meimendro, paris, gengibre: 19 ervas no total. E a **ervilha** (as "ervilhas assadas" da sopa). |
| **Cogumelos e raridades** (receita do Alquimista, na página da mesa de alquimia, "Fazer") | **Carvão lixiviado** (3 carvões + 2 águas → 2, nível 2); **Boletos** (lenha + água → 2, nível 4); **Lepiotas** (+ camomila, nível 7); **Amanita** (+ meimendro, nível 11); **Pérola de água-doce** (2 pós de esmalte + teia + sal + água, nível 14); **Raiz de mandrágora** (2 beladonas + 2 meimendros + água, nível 17). Os cogumelos crescem na lenha do Coletor. |
| **Cobre, jaspe, esmalte, enxofre, salitre** | Saem da **pedra** (picareta do Coletor): cobre 6%, jaspe 2%, pó de esmalte 3%, enxofre 4%, salitre 4%, teia de aranha 1% (e já saíam ferro 16%, sucata 15%, fixação 8%, sal 8%; prata à parte). |
| **Madeira de arco, nozes, madeira exótica** | Saem da **árvore** (machado): a cada corte, 87% lenha, 10% madeira de arco, 2% nozes, 1% madeira exótica. |
| **Penas** | Os **ninhos** dão, de vez em quando (40%), 1-2 penas de galo junto dos ovos: a empenagem das flechas. |
| **Sabão e perfume** | Nos **baús espalhados do mapa** (os mesmos do tesouro, `treasure.ts`): sabão e sabão do cavaleiro em todo baú, perfume simples nos baús perto de gente, perfume bom a partir do segundo círculo e perfume raro nos mais distantes. |

## 3. Extrair

Na forja e na costura há duas abas: **Fabricar | Extrair**. Extrair quebra uma peça da bolsa que o ofício faz e devolve **metade do material da receita** (arredondado para baixo no total; as metades que sobram viram uma unidade a mais do ingrediente mais caro, então uma espada de seis peças devolve as três melhores e não nada).

- só peças com **50% de condição ou mais**; abaixo disso a linha fica "Gasto";
- só peças **fora do corpo** (as vestidas aparecem como "Em uso");
- só quem é da guilda (e, na forja, junto da forja);
- não dá XP (não é jeito de subir de nível);
- se a bolsa não comporta o material, **nada acontece** e a peça continua com você (o material é adicionado antes, a peça sai por último);
- receitas que fazem várias unidades de uma vez (flechas, sopas) não são equipamento e não entram.

### Fabricar em lote (27/10/2026)

Em toda página de ofício (fogo, defumador, secador, forja, costura, a mesa de alquimia do vilarejo e o trabalho da horta: fiar, moer, maltear, guardar sementes) o jogador escolhe de **1 a 10** de uma vez, com os botões **− / + / máx** ao lado do botão de fabricar. Cada peça leva o tempo da receita, uma depois da outra, e cada uma dá o que a receita faz **e o seu XP**; o "máx" é o que a bolsa aguenta (até dez). O pedido inteiro é conferido no começo (nada começa pela metade); se acabar um ingrediente no meio, ou o jogador apertar **Parar** ou fechar a página, o que já foi feito fica feito e o resto não é gasto. Os potions da mesa de alquimia do próprio jogo continuam sendo escolhidos e feitos no minijogo.

### Roupas cumanas (costura)

As quatro peças do jogo, em todas as cores: **Chapéu de couro cumano** (10, nível 3), **Chapéu cumano alto** (10, nível 4), **Botas cumanas** (9, nível 10) e **Cafetã cumano** (10, nível 18), 39 receitas numa categoria só, "Roupas cumanas", com a cor depois do nome (lida do ícone; "cor 7" onde o jogo não tem ícone). As armas, elmos e escudos cumanos já eram do ferreiro.

## 4. O que ainda depende de teste em jogo

Todos os ingredientes das receitas têm fonte agora, mas várias fontes não foram vistas funcionando:

- **Peles** (cervo 74, carneiro 125, vaca 61, porco 26 receitas): saem da caça e do abate, a coleta da carcaça é a nativa do jogo. É o ponto que mais precisa de teste (o servidor registra a coleta como `harvest`); se algum couro não vier, o plano é uma receita de curtume.
- **Ervas e cogumelos do mato**: a coleta nativa existe (o servidor tem os eventos `gatheringHarvest`), mas ninguém a usou ainda. Com as 19 ervas da horta e os cogumelos do Alquimista, o mato é um complemento e não mais a única fonte.
- **O leite**: o E na vaca depende de a mira achar a vaca pela posição que o servidor informa (como o cão); se o hint "Ordenhar" não aparecer, vale um teste ao lado de um pasto.
- As **taxas** (pedra, árvore, ninho, conversões, leite) são um primeiro palpite pelos preços do jogo.

## 5. Decisões que são suas

1. **Livros de aprendizado**: hoje só os NPCs vendem. Sem eles ninguém compra. Ficam com os mestres (já são NPCs fixos), viram receita de escriba, ou o NPC fica só para isso?
2. **Mascates**: vendem dados, joias e quinquilharias; os 13 também levam ingredientes (`ROAD_GOODS`). Saem junto? (Os banhistas só vendiam sabão, perfume e bandagem: sabão e perfume vão para os baús, bandagem é do Alquimista.)
3. **Coach, mestres de ofício e barbeiros**: pelo que entendi, ficam; digam se não.
4. Onde ajustar: `gather.ts` (`ROCK_FINDS`, `TREE_FINDS`), `nests.ts` (`EGGS`), `cows.ts` (`milkSettings`), `treasure.ts` (a tabela dos baús), `tools/make-craft-recipes.py` (`PROCESSES`, "Fundição", os preparos do Alquimista) e `extract.ts` (`RETURN_SHARE`, `MIN_CONDITION`).

## 6. Números de referência

Ingredientes mais usados (receitas / unidades) e quem os fornece agora:

| Ingrediente | Receitas | Unid. | Fornece |
|---|---:|---:|---|
| Linha de costura | 375 | 885 | Agricultor (fia o linho) |
| Linho | 290 | 640 | Agricultor |
| Material de fixação | 215 | 376 | Coletor (pedra 8%), Ferreiro (de sucata) |
| Carvão | 204 | 204 | Ferreiro (2 lenhas → 3 carvões) |
| Pele de carneiro | 125 | 125 | Caçador |
| Ferro | 87 | 273 | Coletor (pedra 16%), Ferreiro (de sucata) |
| Pele de cervo | 74 | 165 | Caçador |
| Cobre | 74 | 77 | Coletor (pedra 6%) |
| Pele de vaca | 61 | 81 | Caçador |
| Aço | 53 | 238 | Ferreiro (Fundição) |
| Aço de Frankfurt | 51 | 248 | Ferreiro (Fundição) |
| Sucata | 41 | 109 | Coletor (pedra 15%) |
| Madeira de arco | 37 | 126 | Coletor (árvore 10%) |
| Água potável | 30 | 37 | Taberneiro (ferve) |
| Pele de porco | 26 | 61 | Caçador |
| Sal | 23 | 23 | Coletor (pedra 8%) |
| Aço de Toledo | 18 | 67 | Ferreiro (Fundição) |
| Farinha | 10 | 13 | Agricultor (mói o trigo) |
| Pena de galo | 10 | 10 | Mundo (ninhos) |
| Jaspe | 8 | 13 | Coletor (pedra 2%) |
| Leite | 5 | 9 | Agricultor (ordenha), Caçador (carcaça) |

Preços do jogo usados nas razões (grosz): sucata 25, ferro 48, aço 50, Frankfurt 200, Toledo 350, fixação 15, cobre 270, jaspe 450, carvão 6, linho 85.
