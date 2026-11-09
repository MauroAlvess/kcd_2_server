# As passivas do jogo, vistas para o servidor

Pedido de 26/10/2026: *vamos ver todas as passivas e ver quais fazem sentido para um co-op e quais são muito roubadas e quais precisamos add no sistema de ofício, exemplo uma que faz mais poções ou que melhora comida e por aí vai.*

São as **268 passivas** que o jogo mostra na tela de vantagens (as de visibilidade *Visible*, as de cada habilidade e atributo e as de herança e prestígio), com o que cada uma faz **nas palavras do próprio jogo** e a **opinião** desta revisão. Ficam de fora as 51 combinações de arma e o que o jogo esconde. Gerado por `tools/make-perks-doc.py` a partir das tabelas e dos textos do jogo; as opiniões são de `tools/perks-verdicts.py` e podem ser mudadas lá.

> **Nada disto foi testado no jogo.** Os veredictos vêm do texto de cada passiva, de quais sistemas do jogo o servidor usa (os vendedores são os nossos, as fechaduras são as nossas, a alquimia e os outros ofícios se fazem na página dos ofícios, o cão do apoiador é do servidor, não há reputação, regateio nem guardas conversando com o jogador) e de bom senso de RP. Um número que o texto não diz (o quanto uma luta fica mais fácil) fica sem número: a opinião é qualitativa.

## Os vereditos

| Veredito | O que quer dizer | Quantas |
| --- | --- | --- |
| Fica | um bônus pequeno ou de sabor, só de quem o tem | 143 |
| Fica, bom para o co-op | serve a quem joga em grupo: carga, luta contra vários, enfermaria, taverna | 13 |
| Fica, com cuidado | forte numa luta de jogador contra jogador ou na economia, mas dentro do que o jogo quis; vale vigiar e, se pesar, cortar | 49 |
| **Forte demais** | tira o peso da morte, da fechadura, da armadura ou do ferimento; sugestão: **bloquear** (`Progression.blockPerks`, como já se faz com as combinações) | 9 |
| Sem efeito aqui | depende de uma parte do jogo de um jogador só (reputação, regateio, guardas, minijogos, o cão do jogo) que o servidor não usa: não faz mal, mas gasta o ponto de quem a escolhe | 40 |
| **Levar para o ofício** | age num trabalho que hoje se faz na página dos ofícios (alquimia, cozinha, forja, colheita), e lá **não faz nada**: o efeito pode ser refeito no sistema de ofícios | 14 |

## O que a revisão pede, em resumo

### Bloquear (forte demais para um servidor de RP)

São passivas que o jogador escolhe na tela de vantagens e que mudam o que o servidor quer decidir pelo RP: a morte, a fechadura, a corrida, o ferimento. Bloqueadas, o jogo não as concede e o servidor as tira de quem tem (como se faz com as combinações). **Bloqueadas desde 01/11/2026** (pedido: *desativa essas passivas roubadas, deixe apenas Marbon com elas; os jogadores que a tinham, retire e devolve os pontos*): ninguém as aprende na tela de vantagens; quem as tinha as perde ao entrar e recebe o ponto de volta na árvore de cada uma, com um aviso; só o Marbon fica com as nove (`STRONG_KEEPERS` em `src/server/perk-guard.ts`).

- **Golpe Destruidor II** (Armas pesadas, nível 14): A armadura do alvo conta com 20 pontos a menos (10 no primeiro nível): desfaz num golpe o que o ferreiro levou horas para forjar.
- **Golpe Abalador** (Armas pesadas, nível 16): Depois de um combo de martelo, maça ou porrete o inimigo não esquiva nem faz golpe mestre por 20 s: quase indefeso.
- **Mestre de Ringen** (Desarmado, nível 14): Estrangulamento depois do agarramento que neutraliza o oponente: nocaute garantido, em briga de taverna e fora dela.
- **Teologia** (Erudição, nível 14): Rezar num santuário protege de um ferimento fatal e devolve 25% da Vida por 12 horas de jogo: é uma vida a mais, e a morte é uma decisão do RP.
- **Fatiador de Tendões** (Espadas, nível 8): Cada combo de espada que acerta reduz muito a Agilidade e a Força do outro: bola de neve em luta de jogadores.
- **Mestre-ladrão** (Roubo, nível 18): Abre fechadura simples quase na hora, sem minijogo e sem crime: tira o peso das fechaduras e das chaves das casas.
- **Velocidade de Hermes** (Vitalidade, nível 12): Corre 20% mais rápido, sempre: decide fuga, perseguição e viagem a pé.
- **Duro de Matar** (Vitalidade, nível 16): Um ferimento que mataria não mata e devolve 25% da Vida: tira a decisão da morte do RP.
- **Ressuscitado II** (Vitalidade, nível 20): A Vida volta sozinha até 75 fora de combate: o ferimento deixa de importar e o curandeiro de ser necessário.

### Levar para o sistema de ofícios

Agem em trabalhos que o jogo faz numa tela dele (a mesa de alquimia, o caldeirão, a bigorna) e que aqui se fazem na página dos ofícios: o jogador que gastou o ponto não recebe nada. Cada uma pode virar um efeito do ofício (rendimento, qualidade, tempo, Cansaço); a primeira da lista, as poções extras, é a mais clara.

- **Entusiasta** (Alquimia, nível 6): Dava Energia e segurava a fome enquanto se preparava poção na mesa do jogo; na página dos ofícios não faz nada.
- **Vendedor de Poções** (Alquimia, nível 6): Vende poção por +30%: os vendedores do servidor pagam 35% do preço e têm bolsa de 300 por dia; seria um bônus do Boticário a desenhar.
- **Segredo do Equilíbrio** (Alquimia, nível 8): Tolerância a erro no minijogo da mesa, que a alquimia daqui não tem: sem efeito. Poderia virar chance de poção de qualidade melhor.
- **Segredo da Matéria** (Alquimia, nível 8): Cada poção bem-sucedida vem com uma extra. Sem efeito hoje (a alquimia é feita na página dos ofícios): é o exemplo mais claro do que levar para o ofício.
- **Aprendiz de Artes das Trevas** (Alquimia, nível 12): Preparar entre meia-noite e o amanhecer erra menos: efeito do minijogo da mesa, perdido na página dos ofícios.
- **Segredo da Matéria II** (Alquimia, nível 14): Duas poções extras a cada sucesso (três com o primeiro nível): o dobro do efeito do primeiro; ao levar, tem de ser medido para não inundar de poção.
- **Segredo do Equilíbrio II** (Alquimia, nível 14): Mesmo caso do primeiro nível: o minijogo não existe aqui.
- **Segredo dos Segredos** (Alquimia, nível 16): Poções excepcionais para quem acerta a receita e o tempo: não há tempo a acertar na página dos ofícios.
- **Aço Temperado** (Artesanato, nível 10): Armas forjadas por você duram 20% mais: a forja daqui não aplica isso. Poderia virar durabilidade a mais na peça forjada.
- **Segredo de Martin** (Artesanato, nível 16): Libera a forja de armas de qualidade quatro: a forja daqui não tem esse degrau; poderia ser a trava das peças de topo.
- **Sabedoria de Espadachim** (Espadas, nível 10): Criação conta 3 níveis acima ao forjar e espadas sofrem 25% menos dano: a primeira parte é da forja, que daqui não a aplica.
- **Achadinho da Sorte** (Sobrevivência, nível 10): Ao colher erva, chance de uma extra ou de um tesouro: pode ser um bônus dos Agricolae na colheita.
- **Flecheiro de Elite** (Sobrevivência, nível 14): Flechas e virotes com melhor balística: as do arqueiro daqui são as do jogo, sem esse ganho; poderia ser rendimento ou alcance a mais do flecheiro.
- **Alma Criativa** (Vitalidade, nível 8): Energia sobe fazendo Alquimia, Afiação, Forja ou dados: o trabalho na página dos ofícios poderia devolver Cansaço.

#### Como seria, no ofício, o que fazem (uma proposta, nada disto está feito)

| Ofício | Passivas | O que o ofício faria | Por onde se faz |
| --- | --- | --- | --- |
| **Alquimia** (Alchemistae) | Segredo da Matéria I e II | **Mais poções:** quem tem a I recebe **uma poção extra** em cada receita feita, quem tem a II, **duas** (três com as duas), como o jogo diz. É o dobro ou o triplo do que a erva rende; a versão branda é 1 extra a cada 2 receitas na I e 1 por receita na II. | `finishWork` soma ao `amount` (a tela já mostra `3x Poção`) |
| **Alquimia** | Segredo do Equilíbrio I e II, Segredo dos Segredos, Aprendiz de Artes das Trevas | **Qualidade:** uma chance (cada passiva soma um pouco; à noite a Aprendiz soma mais) de a poção sair de qualidade melhor. Só vale se o jogo aceitar a qualidade no item que o servidor entrega; senão fica uma chance de **uma poção a mais**. | `metadata` do `Inventory.add`, ou o rendimento |
| **Cozinha, defumador e secador** (Tabernarii, Venatores) | Mestre Cozinheiro, Arte da Preservação | **Rendimento:** uma chance de **uma porção a mais** em cada receita de comida, para quem tem a passiva; a comida já nasce com a condição cheia, então o resto do que a passiva promete já está cumprido. | `finishWork` |
| **Forja** (Fabri Ferrarii) | Aço Temperado, Sabedoria de Espadachim, Segredo de Martin | **Peça melhor:** a arma forjada por quem tem a passiva sai com **mais condição** (e a de topo, de qualidade quatro, pede a de Martin). Depende de o item aceitar a condição no `metadata`; é o que `spoilage.ts` e o ladrão já leem. | `metadata` do `Inventory.add` |
| **Todos os ofícios** | Entusiasta, Alma Criativa | **Cansaço:** trabalhar numa estação devolve um pouco de Energia (ou segura a fome) a quem tem a passiva, como na mesa do jogo. | o Cansaço do servidor (`tiredness.ts`) em `finishWork` |
| **Colheita** (Agricolae, Coletores) | Achadinho da Sorte | **Mais uma:** chance de uma planta ou erva a mais na colheita das hortas e de um achado pequeno. | `farm.ts` na colheita |
| **Venda** (o Boticário) | Vendedor de Poções | O vendedor Boticário paga **+30%** (35% → 45% do preço) pela poção de quem tem a passiva. | `vendors.ts` (o preço de compra por jogador) |

As duas primeiras linhas valem o trabalho já: são o exemplo que o pedido deu, e hoje quem gastou o ponto na Matéria não recebe nada.

### Vigiar (fortes em luta de jogador contra jogador ou na economia)

Ficam, mas pesam: bola de neve em luta, golpes que se encadeiam, esquiva e armadura baratas, tiros que se somam, vendas em dobro. Se o RP pedir, o corte é de passiva em passiva.

- **Postura Perfeita** (Agilidade, nível 8): Esquivas custam 40% menos Vigor: numa luta de jogadores pesa.
- **Mão Dominante** (Agilidade, nível 8): Uma mão só, sem escudo: -20% de Vigor nos ataques e bloqueio melhor. Faz do duelista de espada solta a escolha óbvia.
- **Soldado de Infantaria** (Armas de haste, nível 12): Os inimigos acertam menos o bloqueio perfeito, a riposta e o golpe mestre contra a haste: o combo sai mais fácil.
- **Primeiro Golpe** (Armas de haste, nível 12): O primeiro ataque de cada luta faz +35%.
- **Golpe Atormentador** (Armas de haste, nível 14): Depois de um combo, o oponente recupera o Vigor mais devagar.
- **Chuva de Ferro** (Armas de haste, nível 18): Cada ataque de haste em sequência faz mais dano que o anterior.
- **Destruidor de Escudo** (Armas pesadas, nível 6): O escudo do outro se quebra muito mais depressa: acaba com o estilo de escudo em luta de jogadores.
- **Golpe Destruidor** (Armas pesadas, nível 6): A armadura atingida conta com 10 pontos a menos: tira valor do que o ferreiro forjou.
- **Mira e Mutila!** (Armas pesadas, nível 10): Sangramento do machado 25% mais rápido: mata mais depressa quem não tem médico por perto.
- **Massacre!** (Armas pesadas, nível 14): Depois de um combo, os ataques seguintes custam metade do Vigor por 10 s.
- **Espetar e Cortar** (Armas pesadas, nível 18): Cada golpe seguido faz mais dano que o anterior: a sequência sem erro mata.
- **Botas de Sete Léguas** (Artesanato, nível 6): Botas que você consertou: correr custa 25% menos Vigor; fica de graça com o kit de sapateiro.
- **Chaveiro** (Artesanato, nível 12): +3 em arrombamento e gazuas extras do ferro-velho: facilita invadir casa, que o servidor quer difícil.
- **Manutenção Completa II** (Artesanato, nível 14): -20% de desgaste do equipamento: diminui o trabalho de ferreiro e de artesão que repõe o que quebra.
- **Botas de Sete Léguas II** (Artesanato, nível 16): Botas consertadas por você: correr custa 50% menos Vigor, fuga e perseguição muito mais longas.
- **Canse-os e Derrote-os** (Desarmado, nível 10): Depois de 30 s de luta desarmada, +30% de ataque e de Vigor: a luta longa favorece quem tem a passiva.
- **Aríete** (Desarmado, nível 12): Depois de um combo desarmado o oponente fica abalado e recupera 50% mais devagar.
- **Quebra-queixo** (Desarmado, nível 16): Cada soco em sequência faz mais dano que o anterior.
- **Explorador** (Erudição, nível 18): Revela o mapa inteiro: tira o mistério dos lugares (mas ajuda a saber onde fica o quê).
- **Primeiro Golpe** (Espadas, nível 6): Acertar uma zona sem guarda dificulta os bloqueios seguintes do outro.
- **Golpe Preciso** (Espadas, nível 6): Ataque de espada totalmente carregado conta a Esgrima três vezes: mais forte e mais difícil de bloquear.
- **Hora do Espetáculo** (Espadas, nível 8): Depois de um combo o Vigor volta de imediato: o combo vira ataque sem fim.
- **Redemoinho** (Espadas, nível 12): Espada curta: defesa +30% e ataques e bloqueios 20% mais baratos.
- **Mestre da Dimicatoria** (Espadas, nível 14): Depois de um combo, +5 em Esgrima por 30 s.
- **Primeiro Golpe II** (Espadas, nível 14): O efeito do ataque inicial fica bem maior.
- **Cortar e Fatiar** (Espadas, nível 18): Cada golpe de espada em sequência faz mais dano que o anterior.
- **Feito Rocha** (Guerra, nível 10): +20 de armadura parado por 10 s em combate: só enquanto não corre nem se esquiva.
- **Finta Magistral** (Guerra, nível 14): A finta fica muito difícil de ler: em duelo de jogadores decide.
- **Furor Teutônico** (Guerra, nível 16): Quanto mais ferido (75 de Vida ou menos), mais forte o ataque: faz o ferido perigoso.
- **Movido pela Vingança** (Heranças e prestígio, nível 8): +10% de dano e Vigor mais rápido por 30 s depois de matar de perto: bola de neve numa luta contra vários jogadores.
- **Cavaleiro Destemido** (Heranças e prestígio, nível 8): +15 de armadura fixa a quem tem Carisma acima de 20; soma com tudo o resto.
- **Sangue de Siegfried** (Heranças e prestígio, nível 14): +10 de armadura fixa, sempre: vale mais que um bom elmo e não depende do ferreiro.
- **Mistura Aprimorada** (Inebriação, nível 16): Bêbado, toda poção ainda cura até 20 de Vida: soma com a de cura e com Água da Vida.
- **O Hal Atirou Primeiro** (Pontaria, nível 8): O primeiro tiro faz +15% de dano: soma com a Mira Firme.
- **Explosão Trovejante** (Pontaria, nível 12): O primeiro disparo enfraquece os inimigos por perto: forte contra bandido, estranho entre jogadores.
- **Disparo Glorioso** (Pontaria, nível 14): Depois de matar com arma de longo alcance, o tiro seguinte faz +50%.
- **O Hal Atirou Primeiro II** (Pontaria, nível 16): O primeiro tiro soma +30% no total.
- **Mira Firme II** (Pontaria, nível 16): Parado mirando, +30% de dano do tiro.
- **Escaramuçador do Beco** (Roubo, nível 12): Uma arma só: +10% de dano.
- **Na Trilha do Caçador Clandestino** (Sobrevivência, nível 6): Ervas, caça, peles e troféus valem o dobro na venda: os vendedores do servidor pagam 35% e têm bolsa diária, mas o dobro vira 70%.
- **Amigo do Peito** (Sobrevivência, nível 12): Tiro no peito (e pelas costas) +10%: soma com os outros bônus de arco.
- **Lenhador** (Sobrevivência, nível 12): Na floresta: odor pela metade, Vigor +15%, +1 de atributos e +2 de Furtividade.
- **Homem Selvagem** (Sobrevivência, nível 16): Leva o bônus da floresta para qualquer lugar fora de povoado: no mato quem tem essa passiva joga em outro nível.
- **Amigo do Peito II** (Sobrevivência, nível 18): Tiro no peito +25%: com a Mira Firme e o Primeiro Tiro passa de 80% a mais.
- **Leshy II** (Sobrevivência, nível 20): Floresta: Vigor +25%, Força e Agilidade +2, Furtividade +4.
- **Corredor de Maratona** (Vitalidade, nível 12): Correr gasta 20% menos Vigor.
- **Ressuscitado** (Vitalidade, nível 14): A Vida volta sozinha até 50 fora de combate: enfraquece o RP de ferimento e de curandeiro.
- **Névoa Vermelha** (Vitalidade, nível 14): Abaixo de 25 de Vida: +3 de Força e Agilidade e Vigor quatro vezes mais rápido.
- **Render-se Jamais** (Vitalidade, nível 18): Abaixo de 25 de Vida: +25 de armadura até sair do apuro.

## Heranças e prestígio

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Oportunista** | Perde 10% a menos de Reputação. | Sem efeito aqui | Depende da reputação do jogo, que o servidor não usa nem mostra. |
| 6 | **Charmoso** | Se você ganhar Reputação, o aumento será 10% maior. | Sem efeito aqui | Depende da reputação do jogo, que o servidor não usa nem mostra. |
| 8 | **Movido pela Vingança** | Após matar um oponente em combate de curta distância, você ganha 10% de dano de ataque e recuperação de Vigor mais rápida. O efeito dura 30 segundos. | Fica, com cuidado | +10% de dano e Vigor mais rápido por 30 s depois de matar de perto: bola de neve numa luta contra vários jogadores. |
| 8 | **Memorável** | Mudanças na sua reputação, para melhor ou pior, se espalham mais rapidamente pelo território e entre grupos diferentes de pessoas. | Sem efeito aqui | A reputação não circula pelo servidor. |
| 8 | **Cavaleiro Destemido** | Se o seu Carisma for maior que 20, sua armadura será considerada +15. | Fica, com cuidado | +15 de armadura fixa a quem tem Carisma acima de 20; soma com tudo o resto. |
| 10 | **Herói Local** | Se você estiver em uma área onde conta com uma boa Reputação (60 ou mais), ganha um bônus de +2 em Força, Agilidade, Vitalidade e Eloquência. | Sem efeito aqui | Depende de reputação 60 ou mais na região. |
| 10 | **Herança de Radzig** | Você melhora mais rápido nas habilidades Arma Pesada e Erudição, pois toda experiência adquirida será 10% maior. | Fica | 10% a mais de experiência em Arma Pesada e Erudição. |
| 10 | **Herança de Martin** | Você melhora mais rápido nas habilidades Esgrima, Criação e Sobrevivência, pois toda experiência adquirida será 10% maior. | Fica | 10% a mais de experiência em Esgrima, Criação e Sobrevivência. |
| 10 | **Burguês** | Em cidades, vilarejos e arredores, você ganha um bônus de +1 em Força, Agilidade, Vitalidade e Eloquência. | Fica | +1 nos atributos nas cidades e vilarejos: pequeno e de sabor. |
| 12 | **Elemento Criminal** | As marcas criminais desaparecem 25% mais rápido. Com a cicatriz da marca, você venderá bens roubados por +10%, parecerá mais ameaçador e ganhará um bônus de +2 para Coagir, Dominar e Intimidar. | Sem efeito aqui | Mexe na marca de crime e na venda de roubado do jogo; o servidor tem o seu próprio sistema de ladrão. |
| 12 | **Boa Gente** | Você tem mais facilidade de convencer os outros com gentileza. Você ganha +2 de Persuasão, Impressão e Presença. Além disso, as pessoas tentam resolver mais os crimes com você, em vez de recorrer diretamente aos guardas. Mas cuidado: quanto mais perigosa a sua aparência, maior as chances de eles pedirem ajuda aos guardas. | Sem efeito aqui | É regateio e conversa com guardas, que não existem para o jogador aqui. |
| 12 | **Animal Noturno** | À noite, você tem bônus de +2 de Força, Agilidade e Vitalidade, e bônus de +3 de Furtividade. | Fica | À noite +2 de Força, Agilidade e Vitalidade e +3 de Furtividade: serve ao RP de quem vive de noite. |
| 14 | **Sangue de Siegfried** | Em combate, você é muito mais resiliente que um reles mortal. Sua armadura terá sempre 10 pontos a mais. | Fica, com cuidado | +10 de armadura fixa, sempre: vale mais que um bom elmo e não depende do ferreiro. |
| 14 | **Pacifista** | Se você não matar ninguém, suas habilidades não relacionadas a combate aumentarão em 2, e sua Eloquência aumentará em 3. Se você matar alguém, perderá o bônus, mas poderá recuperá-lo se não matar ninguém por 12 horas no jogo. | Fica, bom para o co-op | Premia quem não mata ninguém (+2 nas habilidades que não são de combate): bom para o RP pacífico. |
| 14 | **Poder Bélico** | Após o fim de uma luta, você ganha um bônus de +2 em Força, Agilidade e nas habilidades de Combate. O efeito dura 6 horas de jogo. Para renová-lo, entre em combate novamente. | Fica | +2 em Força, Agilidade e combate por seis horas de jogo depois de uma luta. |
| 16 | **Vigor Heroico** | Cada nível de Vitalidade adiciona 1 ponto extra de Vigor. O efeito também se aplica retroativamente. | Fica | Mais Vigor por nível de Vitalidade. |
| 16 | **Musculoso** | À medida que sua Força aumenta, sua capacidade de carga aumenta mais. Para cada nível de Força, você ganha 12 pontos de capacidade de carga em vez de 10. Também funciona retroativamente. | Fica, bom para o co-op | Carrega 12 por nível de Força em vez de 10: ajuda a carregar pelo grupo. |

## Força

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Rapaz Esforçado** | Se você carregar um saco ou até um corpo morto ou inconsciente, o peso contará apenas pela metade. Portanto, eles dificilmente serão um fardo, e carregá-los não custará Vigor extra.Além disso, você ganha mais 8 libras de capacidade de carga. | Fica, bom para o co-op | Saco, corpo morto ou desacordado pesa a metade e não gasta Vigor extra: bom para resgate e enterro; +8 libras. |
| 6 | **Treine duro, lute fácil!** | O nível de Força requerido por todas as armas é 1 ponto menor. Em geral, se o seu nível de Força for menor do que o exigido pela arma, você causa menos dano com ela. Por outro lado, se for maior, seu dano também aumenta. Com essa vantagem, você obterá esse efeito mais cedo. A Força também afeta a sua capacidade de puxar e de... | Fica | Armas pedem 1 de Força a menos. |
| 8 | **Mula de Carga** | Ganha +12 libras de capacidade de carga. | Fica, bom para o co-op | +12 libras de carga: ajuda a carregar pelo grupo. |
| 8 | **Lutador** | Sua Força facilitará a vitória em lutas corpo a corpo, pois será mais difícil reagir às suas ações. | Fica | A Força ajuda a vencer no corpo a corpo. |
| 10 | **Segurando Firme** | Quanto maior a sua Força, mais fácil será neutralizar ou matar alguém furtivamente. | Fica | A Força facilita neutralizar e matar de forma furtiva. |
| 10 | **Treino Duro, Lute Fácil! II** | O nível de Força requerido por todas as armas é 2 pontos menor. Em geral, se o seu nível de Força for menor do que o exigido pela arma, você causa menos dano com ela. Por outro lado, se for maior, seu dano também aumenta. Com essa vantagem, você obterá esse efeito mais cedo. A Força também afeta a sua capacidade de puxar e... | Fica | Armas pedem 2 de Força a menos. |
| 12 | **Forte como um Touro** | Ganha +20 libras de capacidade de carga. | Fica, bom para o co-op | +20 libras de carga: ajuda a carregar pelo grupo. |
| 12 | **Vanguarda** | Bloquear com escudo lhe custará 30% menos Vigor. | Fica | Bloquear com escudo custa 30% menos Vigor. |
| 14 | **Pancadaria** | O dano de contusão de todas as armas brancas aumenta em 5%. | Fica | +5% de dano de contusão. |
| 14 | **Espancador** | Seus ataques carregados ficarão mais poderosos por padrão. Com esta vantagem, eles se tornarão 5% mais poderosos, ficando mais fácil de acertar e causar mais dano. | Fica | Ataques carregados 5% mais fortes. |
| 16 | **Braço Forte** | Se você permanecer em um ataque totalmente carregado, seu Vigor será recuperado lentamente. | Fica | Segurando um ataque carregado o Vigor volta devagar. |
| 18 | **Pancadaria II** | O dano de contusão de todas as armas brancas aumenta em mais 5%. | Fica | Mais 5% de dano de contusão. |
| 18 | **Hércules** | A cada 5 níveis de Força, seu Carisma aumenta em 1. | Fica | +1 de Carisma a cada 5 níveis de Força. |

## Agilidade

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Mãos Hábeis** | O nível de Agilidade requerido por todas as armas é 1 ponto menor. Em geral, se o seu nível de Agilidade for menor do que o exigido pela arma, fica mais difícil usá-la em combate. Por outro lado, se for maior, seus ataques consomem menos Vigor. Com essa vantagem, você obterá esse efeito mais cedo. | Fica | Armas pedem 1 de Agilidade a menos. |
| 6 | **Peso-pena** | O dano de queda é reduzido em 30%. | Fica | 30% menos dano de queda. |
| 8 | **Mão Dominante** | Se você usar uma arma de uma só mão sem escudo, os ataques custarão 20% menos Vigor. Os bloqueios também custarão menos Vigor e serão mais eficazes. Esse efeito se aplica mesmo que você tenha uma tocha na mão. | Fica, com cuidado | Uma mão só, sem escudo: -20% de Vigor nos ataques e bloqueio melhor. Faz do duelista de espada solta a escolha óbvia. |
| 8 | **Postura Perfeita** | Esquivas custam 40% menos Vigor. | Fica, com cuidado | Esquivas custam 40% menos Vigor: numa luta de jogadores pesa. |
| 10 | **Mãos Hábeis II** | O nível de Agilidade requerido por todas as armas é 2 pontos menor. Em geral, se o seu nível de Agilidade for menor do que o exigido pela arma, fica mais difícil usá-la em combate. Por outro lado, se for maior, seus ataques consomem menos Vigor. Com essa vantagem, você obterá esse efeito mais cedo. | Fica | Armas pedem 2 de Agilidade a menos. |
| 10 | **Corredor** | Após 10 segundos correndo rápido, você ganha brevemente um grande bônus de recuperação de Vigor. Depois, ao desacelerar, você logo recupera a Força e pode começar a correr novamente. | Fica | Depois de 10 s correndo, o Vigor volta mais depressa. |
| 12 | **Fantasma Sorrateiro** | Ao andar furtivamente, seu movimento será 15% mais rápido. | Fica | Furtivo 15% mais rápido. |
| 12 | **Totentanz** | Após executar uma esquiva perfeita (esquiva dentro do intervalo de tempo de um bloqueio perfeito), você ganha 15% de bônus de ataque da arma. O efeito dura 5 segundos. | Fica | +15% de ataque por 5 s depois de uma esquiva perfeita: recompensa quem acerta o tempo. |
| 14 | **Finesse** | O dano de corte de todas as armas brancas será 5% maior. | Fica | +5% de dano de corte. |
| 14 | **Víbora** | O dano de perfuração de todas as armas brancas aumenta em 5%. | Fica | +5% de dano de perfuração. |
| 16 | **Fantasma Sorrateiro II** | Ao andar furtivamente (agachar), seu movimento será 35% mais rápido. | Fica | Furtivo 35% mais rápido. |
| 18 | **Finesse II** | O dano de corte de todas as armas brancas aumenta em mais 5%. | Fica | Mais 5% de dano de corte. |
| 18 | **Víbora II** | O dano de perfuração de todas as armas brancas aumenta em mais 5%. | Fica | Mais 5% de dano de perfuração. |

## Vitalidade

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Ascético** | Sua Saciedade diminui 30% mais devagar, ou seja, você aguenta mais tempo sem comida antes de ser incomodado pela fome. | Fica | A Saciedade cai 30% mais devagar. |
| 6 | **Sangue nas Veias** | Você vai sangrar perceptivelmente mais devagar. Mesmo assim, se você não usar uma atadura, vai acabar morrendo. A diferença é que terá mais tempo. | Fica | Sangra mais devagar: dá mais tempo, não salva. |
| 8 | **Dieta Balanceada** | Se você não comer demais, ficar bêbado ou passar fome por 3 dias consecutivos, seu Vigor será restaurado 20% mais rápido e você ganhará +10% de experiência no atributo Vitalidade. Se você comer demais, ficar bêbado ou passar fome, perderá o efeito da vantagem e precisará reativá-lo. | Fica | Vigor mais rápido e experiência de Vitalidade para quem se alimenta bem por três dias. |
| 8 | **Alma Criativa** | Sua Energia aumenta lentamente ao usar Alquimia, Afiação, Forja ou Jogo de Dados. | **Levar para o ofício** | Energia sobe fazendo Alquimia, Afiação, Forja ou dados: o trabalho na página dos ofícios poderia devolver Cansaço. |
| 10 | **Lavar a Alma** | Ao se lavar numa banheira, cais ou casa de banho, você recuperará 10 pontos de Vida. Além disso, se você for para a cama limpo, se curará 25% mais rápido enquanto dorme. | Fica, bom para o co-op | Banho cura 10 de Vida e dormir limpo cura 25% mais depressa: combina com os banhos e as banhistas do servidor. |
| 10 | **Bem-vestido** | Suas roupas e seu corpo ficam sujos 20% mais devagar. Além disso, ao lavar-se em uma banheira, você pode se livrar de toda a sujeira do corpo, mas ainda precisará ir a um banho público ou lago para lavar suas roupas. | Fica | A roupa e o corpo sujam 20% mais devagar. |
| 12 | **Velocidade de Hermes** | Você corre 20% mais rápido. | **Forte demais** | Corre 20% mais rápido, sempre: decide fuga, perseguição e viagem a pé. |
| 12 | **Corredor de Maratona** | Ao correr rápido, você consome Vigor 20% mais devagar. | Fica, com cuidado | Correr gasta 20% menos Vigor. |
| 14 | **Névoa Vermelha** | Quando sua Vida cair para menos de 25 pontos durante o combate, você ganhará +3 de bônus de Força e Agilidade por um tempo, e seu Vigor se regenerará 4 vezes mais rápido. | Fica, com cuidado | Abaixo de 25 de Vida: +3 de Força e Agilidade e Vigor quatro vezes mais rápido. |
| 14 | **Ressuscitado** | Sua Vida se recuperará gradualmente até chegar a 50. Este efeito não se aplica se você estiver em combate ou sangrando. | Fica, com cuidado | A Vida volta sozinha até 50 fora de combate: enfraquece o RP de ferimento e de curandeiro. |
| 16 | **Duro de Matar** | Feridas que normalmente o matariam, não matam mais, e você recuperará 25% de Vida. Essa vantagem tem uma recarga antes de poder ser ativada novamente. | **Forte demais** | Um ferimento que mataria não mata e devolve 25% da Vida: tira a decisão da morte do RP. |
| 18 | **Render-se Jamais** | Se você ficar com menos de 25 pontos de Vida durante o combate, vai receber um bônus de +25 de armadura, aumentando suas chances de sobrevivência. O efeito dura até sua Vida voltar a ficar acima de 25, ou o combate acabar. | Fica, com cuidado | Abaixo de 25 de Vida: +25 de armadura até sair do apuro. |
| 20 | **Ressuscitado II** | Sua Vida se recuperará lenta e continuamente até chegar a 75. O efeito não se aplica se você estiver em combate ou sangrando. | **Forte demais** | A Vida volta sozinha até 75 fora de combate: o ferimento deixa de importar e o curandeiro de ser necessário. |

## Eloquência

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Produtos Perfeitos** | Ganha 10% mais dinheiro ao vender armas, armaduras ou roupas em condições quase perfeitas ou perfeitas (98-100%). | Fica | +10% ao vender peça em condição quase perfeita: a tela de troca do jogo aplica. |
| 6 | **Lábia** | Você recebe +4 de Eloquência ao pechinchar, facilitando a negociação de preços melhores. | Sem efeito aqui | Eloquência no regateio, que o servidor não tem. |
| 8 | **Adepto das Artes Místicas** | Você compra e vende poções, ervas, receitas, livros e itens relacionados à alquimia a preços 10% melhores. | Fica | Poções, ervas, livros e receitas 10% melhor na compra e na venda. |
| 8 | **Artesão** | Você pode vender e comprar armas, armaduras e roupas com 10% de desconto. | Fica | 10% de desconto em armas, armaduras e roupas dos vendedores. |
| 10 | **Pau para Toda Obra** | Ganha um bônus de +2 em testes de habilidade. Você também ganha 2x mais experiência nesses testes de habilidade. | Sem efeito aqui | +2 e experiência em dobro nos testes de habilidade, que o servidor não tem. |
| 10 | **Vigarista** | Você tem mais facilidade de vender produtos roubados. Se tiver sucesso, você ganhará experiência em Furtividade e Roubo. | Sem efeito aqui | Venda de roubado: os vendedores do servidor só compram o que é do ofício deles. |
| 12 | **Grito de Guerra** | Se você usar um grito de guerra durante um combate, o dano causado aumenta em 10%. O efeito dura 20 segundos. | Fica, bom para o co-op | Gritar na luta dá +10% de dano por 20 s. Confirmar se o grito do jogo está ligado para o jogador. |
| 12 | **Galanteador** | Ao lidar com mulheres, você ganha bônus de +2 em todos os testes de habilidade, desconto de 15% em compras e desconto de 25% em serviços do banho público. | Fica | Mulheres: +2 nos testes, 15% de desconto e 25% nos banhos: só na tela de troca das vendedoras. |
| 14 | **Guerreiro Temido** | Se você usar um grito de guerra durante uma luta, além de ganhar coragem, também colocará medo nos seus inimigos. Como resultado, o moral deles diminuirá e é mais provável que eles desistam, fujam ou achem mais difícil enfrentar você. | Fica | O grito assusta o inimigo (moral): serve contra bandido e animal. |
| 16 | **Oferta Final** | Quando um comerciante perde a paciência durante a negociação, em vez de cancelar o acordo totalmente, ele te dará uma última chance de oferecer um preço justo. | Sem efeito aqui | Última chance no regateio, que o servidor não tem. |
| 18 | **Grito de Guerra II** | Se você ouvir um grito de guerra durante o combate, o dano causado aos seus oponentes aumentará em 15% no total. O efeito dura 20 segundos. | Fica, bom para o co-op | Ouvir o grito de guerra dá +15% de dano no total: a versão de grupo, se o grito estiver ligado. |
| 20 | **Guerreiro Temível II** | O efeito da vantagem Guerreiro Temível ficará ainda mais poderoso! | Fica | O efeito do medo fica mais forte. |
| 20 | **Parceiro de Crime** | Agora você pode vender produtos roubados a qualquer pessoa sem medo de ser detectado. | Sem efeito aqui | Vende roubado a qualquer um: os vendedores do servidor só compram o ofício. |

## Espadas

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Primeiro Golpe** | Se você acertar uma zona desprotegida (ou seja, uma zona de onde seu oponente não está bloqueando), o adversário terá mais dificuldades em bloquear seus ataques subsequentes. | Fica, com cuidado | Acertar uma zona sem guarda dificulta os bloqueios seguintes do outro. |
| 6 | **Golpe Preciso** | Com um ataque de espada totalmente carregado, sua habilidade Esgrima será 3 vezes maior. Seu ataque, além de mais forte, será mais difícil de ser bloqueado. | Fica, com cuidado | Ataque de espada totalmente carregado conta a Esgrima três vezes: mais forte e mais difícil de bloquear. |
| 8 | **Fatiador de Tendões** | Cada combo de espada bem-sucedido reduz muito a Agilidade e a Força do seu oponente, tornando mais difícil para ele continuar lutando e mais fácil para você derrotá-lo. | **Forte demais** | Cada combo de espada que acerta reduz muito a Agilidade e a Força do outro: bola de neve em luta de jogadores. |
| 8 | **Hora do Espetáculo** | Após executar um combo de espada ou um golpe de mestre, você recupera instantaneamente parte do seu Vigor e pode atacar novamente! | Fica, com cuidado | Depois de um combo o Vigor volta de imediato: o combo vira ataque sem fim. |
| 10 | **Gladiador** | Se você usar uma espada de uma só mão enquanto mantém a outra livre (com exceção de uma tocha), você ganha um bônus de +5 na habilidade Esgrima. | Fica | Espada de uma mão com a outra livre: +5 em Esgrima. |
| 10 | **Sabedoria de Espadachim** | Seu nível de Artesanato conta como 3 níveis acima enquanto estiver forjando, e todas as armas semelhantes a espadas sofrem 25% a menos de dano em combate. | **Levar para o ofício** | Criação conta 3 níveis acima ao forjar e espadas sofrem 25% menos dano: a primeira parte é da forja, que daqui não a aplica. |
| 12 | **Cutelo** | Você sabe fazer bom uso disso, e causa +15% de dano de esmagamento com espadas de caça. | Fica | Espada de caça faz +15% de esmagamento. |
| 12 | **De Ponta** | Se o seu ataque com o sabre causar sangramento, o oponente sangrará 25% mais rápido, tornando-o um alvo mais fácil de lidar. | Fica | O sangramento do sabre é 25% mais rápido. |
| 12 | **Redemoinho** | Se você lutar com uma espada curta (não com uma espada de caça ou sabre), a defesa dela aumenta em 30% e seus ataques e bloqueios custam 20% menos Vigor. | Fica, com cuidado | Espada curta: defesa +30% e ataques e bloqueios 20% mais baratos. |
| 14 | **Mestre da Dimicatoria** | Ao executar uma combinação, você ganha +5 na habilidade Esgrima, deixando os ataques subsequentes mais fáceis de executar e mais poderosos. O efeito dura 30 segundos. | Fica, com cuidado | Depois de um combo, +5 em Esgrima por 30 s. |
| 14 | **Primeiro Golpe II** | O efeito de um ataque inicial bem-sucedido aumenta bastante. | Fica, com cuidado | O efeito do ataque inicial fica bem maior. |
| 16 | **Braço de Beowulf** | Você pode usar um montante junto com um escudo ou uma tocha. Embora o alcance da arma seja maior, seus ataques serão 30% mais lentos, 20% mais fracos e custarão 20% a mais de Vigor. Você poderá executar combos de espada curta, mas não poderá realizar combos de montante. | Fica | Montante com escudo ou tocha, mais lento e mais fraco: sabor, e abre combos de espada curta. |
| 18 | **Cortar e Fatiar** | Cada golpe de espada subsequente numa sequência ininterrupta causará mais dano do que o anterior. A sequência de golpes pode ser interrompida por um bloqueio ou esquiva do oponente, por um longo intervalo entre os ataques ou por danos sofridos por você. | Fica, com cuidado | Cada golpe de espada em sequência faz mais dano que o anterior. |

## Armas de haste

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Madeira de Lei** | Armas de haste sofrem dano 25% mais lentamente. | Fica | Armas de haste sofrem 25% menos dano. |
| 6 | **Mantendo Distância** | Bloquear com uma arma de haste será mais fácil, mais eficaz e custará menos Vigor. | Fica | Bloquear com haste fica mais fácil e barato. |
| 8 | **Longo Alcance** | Atacar com armas de haste lhe custará 10% menos Vigor. | Fica | Atacar com haste custa 10% menos Vigor. |
| 8 | **Treinamento de Milícia** | A Força e Agilidade necessária para usar armas de haste é reduzida em 3. | Fica | A Força e a Agilidade pedidas por haste caem 3. |
| 10 | **Colheita de Ferro** | Após executar uma combinação, você recupera um pouco do seu Vigor e pode continuar lutando com mais facilidade. | Fica | Depois de um combo, um pouco de Vigor volta. |
| 10 | **Empalador** | Seu dano de perfuração aumenta em 10%. | Fica | +10% de dano de perfuração. |
| 12 | **Primeiro Golpe** | Em cada luta, seu primeiro ataque com uma arma de haste será 35% mais forte. | Fica, com cuidado | O primeiro ataque de cada luta faz +35%. |
| 12 | **Soldado de Infantaria** | Ao usar armas de haste, os inimigos têm chance muito menor de executar bloqueio perfeito, riposta ou golpes mestre contra seus ataques, permitindo que você encadeie combinações com muito mais facilidade. | Fica, com cuidado | Os inimigos acertam menos o bloqueio perfeito, a riposta e o golpe mestre contra a haste: o combo sai mais fácil. |
| 14 | **Longo Alcance II** | Ataques com armas de haste custam 10% menos Vigor. | Fica | Mais 10% de economia de Vigor. |
| 14 | **Golpe Atormentador** | Após um combo, o Vigor do oponente se regenera mais devagar, reduzindo a capacidade de luta do alvo. | Fica, com cuidado | Depois de um combo, o oponente recupera o Vigor mais devagar. |
| 16 | **Destruidor de Artérias** | Se você causar um ferimento sangrento com uma arma de haste, o ferido sangrará mais rápido e, portanto, morrerá antes. | Fica | O ferimento sangrento da haste sangra mais depressa. |
| 16 | **Empalador II** | O dano de perfuração será 10% maior. | Fica | Mais 10% de dano de perfuração. |
| 18 | **Chuva de Ferro** | Cada ataque com arma de haste numa série ininterrupta causará mais dano do que o anterior. A sequência pode ser interrompida por um bloqueio ou esquiva perfeita do oponente, por um longo intervalo entre ataques ou por danos sofridos. | Fica, com cuidado | Cada ataque de haste em sequência faz mais dano que o anterior. |

## Armas pesadas

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Destruidor de Escudo** | Os adversários terão mais dificuldade de bloquear seus ataques de arma pesada com escudo. Além disso, você levará menos tempo para destruir completamente o escudo do oponente com seus golpes. | Fica, com cuidado | O escudo do outro se quebra muito mais depressa: acaba com o estilo de escudo em luta de jogadores. |
| 6 | **Golpe Destruidor** | Armaduras inimigas atingidas por armas pesadas sofrem dano como se tivessem 10 pontos a menos. | Fica, com cuidado | A armadura atingida conta com 10 pontos a menos: tira valor do que o ferreiro forjou. |
| 8 | **Força Bruta** | O dano que você causa com armas pesadas será 5% mais alto. | Fica | +5% de dano de arma pesada. |
| 8 | **Trauma Contundente** | Sempre que você carregar totalmente seu ataque com uma arma branca pesada, o ataque será 10% mais forte. | Fica | Ataque totalmente carregado +10%. |
| 10 | **Mira e Mutila!** | Se o ataque do seu machado causar sangramento, o oponente sangrará 25% mais rápido, facilitando acabar com ele e impedindo-o de fugir para longe. | Fica, com cuidado | Sangramento do machado 25% mais rápido: mata mais depressa quem não tem médico por perto. |
| 10 | **Quebra-ossos** | Se você ferir um oponente com um martelo de guerra, uma maça ou uma clava, a recuperação do seu Vigor será 15% mais lenta. O efeito dura 10 segundos. | Fica | Quem é ferido por maça, martelo ou clava recupera o Vigor mais devagar por 10 s. |
| 12 | **Presença Ameaçadora** | Quando você está com uma armadura e equipado com uma arma pesada, os inimigos ficam mais propensos a fugir ou se renderem. E se ousarem enfrentar você, a luta será mais difícil. Além disso, é mais fácil se sair bem nos testes de habilidade de Poder e Intimidação. | Fica | Armadura com arma pesada assusta mais o inimigo (moral): serve contra bandido. |
| 14 | **Massacre!** | Após realizar um combo com uma arma pesada, os ataques subsequentes custarão apenas metade do vigor! O efeito dura 10 segundos. | Fica, com cuidado | Depois de um combo, os ataques seguintes custam metade do Vigor por 10 s. |
| 14 | **Golpe Destruidor II** | Se você atingir um inimigo com uma arma pesada, a armadura dele conta como se tivesse 20 pontos a menos. | **Forte demais** | A armadura do alvo conta com 20 pontos a menos (10 no primeiro nível): desfaz num golpe o que o ferreiro levou horas para forjar. |
| 16 | **Cavaleiro Verde** | Após um combo com machado, os ataques subsequentes serão 20% mais fortes! O efeito dura 5 segundos. | Fica | Depois de um combo de machado, +20% por 5 s. |
| 16 | **Golpe Abalador** | Após executar uma combinação com martelo de guerra, maça ou porrete, o inimigo afetado não conseguirá executar uma esquiva ou golpe mestre, e a capacidade dele se defender será bastante reduzida no geral. O efeito durará 20 segundos. | **Forte demais** | Depois de um combo de martelo, maça ou porrete o inimigo não esquiva nem faz golpe mestre por 20 s: quase indefeso. |
| 18 | **Força Bruta II** | O dano que você causa com armas pesadas será 5% mais alto. | Fica | Mais 5% de dano de arma pesada. |
| 18 | **Espetar e Cortar** | Cada um dos seus ataques subsequentes com armas pesadas em uma sequência ininterrupta causará muito mais dano do que o anterior. A sequência pode ser interrompida por um bloqueio ou esquiva do oponente, por um intervalo excessivo entre os ataques ou por danos sofridos por você. | Fica, com cuidado | Cada golpe seguido faz mais dano que o anterior: a sequência sem erro mata. |

## Desarmado

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Duro na Queda** | Se você lutar desarmado contra um oponente com uma arma, sua habilidade Combate Desarmado contará 5 pontos a mais. | Fica | Desarmado contra quem tem arma: +5 em Combate Desarmado. |
| 6 | **Lutador Beligerante** | Após o primeiro golpe em combate, os ataques sem arma subsequentes custarão 20% menos Vigor e serão 10% mais potentes. O efeito dura 30 segundos. Essa vantagem também é ativada depois que você realiza uma neutralização furtiva. | Fica | Depois do primeiro golpe, os seguintes custam 20% menos e são 10% mais fortes por 30 s. |
| 8 | **Kurzkampf** | Todos os ataques feitos durante um agarramento causarão dano 10% maior. | Fica | Ataques no agarramento +10%. |
| 8 | **Não Há Vitória Sem Dor** | Ao lutar desarmado, você ganha 15% a mais de experiência em Força, Agilidade e Vitalidade. | Fica | 15% a mais de experiência em Força, Agilidade e Vitalidade lutando desarmado. |
| 10 | **Manda Ver!** | Se você derrotar um oponente desarmado, ganha um bônus de +3 na habilidade de Combate Desarmado e recupera Vigor 25% mais rápido, facilitando todo o resto. O efeito dura 30 segundos. | Fica | Depois de vencer um desarmado: +3 e Vigor mais rápido por 30 s. |
| 10 | **Incansável** | Após executar um combo ou um golpe mestre em combate desarmado, você recupera imediatamente um pouco do Vigor. | Fica | Depois de um combo ou golpe mestre desarmado, um pouco de Vigor volta. |
| 10 | **Canse-os e Derrote-os** | Após os primeiros 30 segundos de um combate em que você está desarmado, seus ataques ficarão 30% mais fortes e seu Vigor se recuperará 30% mais rápido. | Fica, com cuidado | Depois de 30 s de luta desarmada, +30% de ataque e de Vigor: a luta longa favorece quem tem a passiva. |
| 12 | **Aríete** | Se você executar um combo desarmado, seu oponente ficará seriamente abalado e o Vigor dele se recuperará 50% mais lentamente, deixando-o muito mais vulnerável. | Fica, com cuidado | Depois de um combo desarmado o oponente fica abalado e recupera 50% mais devagar. |
| 12 | **João Pestana** | De modo geral, você tem mais facilidade para neutralizar ou matar alguém furtivamente. | Fica | Mais fácil neutralizar e matar furtivamente. |
| 14 | **Equilibrando a Situação** | Seus ataques desarmados ficam 10% mais fortes. | Fica | Ataques desarmados 10% mais fortes. |
| 14 | **Mestre de Ringen** | Quando você e seu oponente estão desarmados, você pode aplicar um estrangulamento após o agarramento e neutralizar o oponente. Para fazer isso, ataque pela zona esquerda ainda no agarramento. Se o ataque for bem-sucedido, você aplicará a alavanca e depois poderá atacar de novo para aplicar o estrangulamento. | **Forte demais** | Estrangulamento depois do agarramento que neutraliza o oponente: nocaute garantido, em briga de taverna e fora dela. |
| 16 | **Quebra-queixo** | Cada ataque sem arma subsequente em uma sequência ininterrupta causará mais dano do que o anterior. A sequência pode ser interrompida se você bloquear ou se esquivar do oponente, por um longo intervalo entre os ataques ou se você for atingido. Essa vantagem também é ativada depois que você realiza uma neutralização furtiva. | Fica, com cuidado | Cada soco em sequência faz mais dano que o anterior. |
| 16 | **Kurzkampf II** | Todos os ataques feitos durante um agarramento causarão dano 5% maior. | Fica | Mais 5% nos ataques do agarramento. |

## Guerra

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Proteção de Cabeça** | Se você usar elmo, golpes na cabeça causarão 20% menos dano. | Fica | Com elmo, -20% de dano na cabeça. |
| 6 | **Firme** | Os bloqueios custarão 20% menos Vigor, e seu escudo e arma se desgastarão 20% mais lentamente ao bloquear. | Fica | Bloqueios custam 20% menos Vigor e gastam menos a arma e o escudo. |
| 8 | **Contra Tudo e Contra Todos** | Ao lutar contra muitos inimigos, você ganha um bônus de +2 nas habilidades de Guerra, Força e Agilidade. | Fica, bom para o co-op | Contra vários, +2 em Guerra, Força e Agilidade: premia quem luta de lado em grupo. |
| 8 | **Veterano Embrutecido** | Em combate, você recupera Vigor 10% mais rápido. | Fica | 10% mais rápido de Vigor em combate. |
| 10 | **Feito Rocha** | Em combate, você pode manter uma postura firme e usá-la em vantagem própria. Se você não correr nem se esquivar por 10 segundos em combate, você ganha +20 de Armadura. Se você correr ou se esquivar, perde o efeito. | Fica, com cuidado | +20 de armadura parado por 10 s em combate: só enquanto não corre nem se esquiva. |
| 10 | **Rio** | Após uma esquiva, uma esquiva perfeita ou uma corrida rápida em combate, você ganha +3 na habilidade Guerra, e o Vigor se regenera 15% mais rápido. O efeito dura 10 segundos. | Fica | Depois de esquivar ou correr em combate: +3 em Guerra e 15% mais Vigor por 10 s. |
| 12 | **Blindagem** | O peso da sua armadura afeta a sua velocidade de movimento e quanto Vigor é consumido ao correr. Sua armadura pesará 20 libras a menos, portanto o efeito sobre o seu Vigor será menor. No entanto, o peso real da armadura e a sua capacidade de carga não serão alterados. | Fica | A armadura pesa 20 libras a menos para o Vigor e a velocidade. |
| 12 | **Inquebrável** | Se você estiver em desvantagem numérica numa luta, recupera Vigor 20% mais rápido. | Fica, bom para o co-op | Em desvantagem numérica, +20% de Vigor: protege quem luta contra vários. |
| 14 | **Cavaleiro de Armadura Reluzente** | Quando você usa uma armadura de placas, ganha um bônus de Carisma que varia de +1 a +4. | Fica | De armadura de placas, +1 a +4 de Carisma: sabor de nobre. |
| 14 | **Finta Magistral** | Você aperfeiçoou sua finta a tal ponto que até um guerreiro experiente tem muita dificuldade para reagir a ela. | Fica, com cuidado | A finta fica muito difícil de ler: em duelo de jogadores decide. |
| 16 | **Furor Teutônico** | Quando mais machucado você estiver, mais seus ataques ficarão fortes. O efeito só funcionará se você tiver 75 pontos de Vida ou menos. | Fica, com cuidado | Quanto mais ferido (75 de Vida ou menos), mais forte o ataque: faz o ferido perigoso. |
| 16 | **Veterano Embrutecido II** | Em combate, você recupera Vigor 10% mais rápido. | Fica | Mais 10% de Vigor em combate. |
| 16 | **Exército de Um Homem Só** | Se você estiver em menor número numa luta, seu ataque ficará 10% mais forte. | Fica, bom para o co-op | +10% de ataque em menor número: para o grupo que enfrenta uma emboscada. |

## Pontaria

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Tiro Debilitante** | Se você causar dano a um inimigo com uma arma de longo alcance, o Vigor dele se recuperará mais lentamente e sua capacidade de combate será reduzida. | Fica | Quem leva um tiro recupera o Vigor mais devagar. |
| 6 | **Mira Firme** | Se você permanecer imóvel por 2 ou mais segundos enquanto estiver mirando, seu Vigor acabará 20% mais devagar e seu tiro será 15% mais potente. | Fica | Parado mirando por 2 s: 20% menos Vigor e tiro 15% mais forte. |
| 8 | **O Hal Atirou Primeiro** | Seu primeiro tiro causará +15% de dano. A vantagem ficará ativa novamente após o término da luta em que foi usada ou dentro de um minuto caso não haja luta. | Fica, com cuidado | O primeiro tiro faz +15% de dano: soma com a Mira Firme. |
| 8 | **Salva** | Após cada disparo, você recebe um efeito de curto prazo durante o qual recarrega e mira com mais rapidez. Assim, você também pode atirar mais rápido e, se fizer isso a tempo, recuperará o efeito a cada disparo. | Fica | Recarrega e mira mais depressa depois de cada tiro. |
| 10 | **Sagitário** | Se você estiver montado na sela, a diminuição de Vigor ao mirar com arma de longo alcance será reduzida pela metade. | Fica | Montado, mirar gasta metade do Vigor. |
| 12 | **Arma Proibida** | Se você infligir um ferimento com sangramento usando uma seta de balestra, o sangramento será mais rápido e forte, enfraquecendo ou matando o inimigo mais cedo. | Fica | O sangramento de seta de balestra é mais rápido e forte. |
| 12 | **Escaramuçador** | Ao atirar com um arco enquanto estiver a pé, você recuperará Vigor 25% mais rápido e gastará 50% menos, facilitando o movimento ou a fuga. O efeito dura 10 s. | Fica | A pé com arco: recupera Vigor 25% mais rápido e gasta 50% menos por 10 s. |
| 12 | **Explosão Trovejante** | Seu primeiro disparo em combate faz os oponentes próximos sofrerem uma penalidade temporária na habilidade de combate e no moral, fazendo deles ameaças menores. | Fica, com cuidado | O primeiro disparo enfraquece os inimigos por perto: forte contra bandido, estranho entre jogadores. |
| 14 | **Tiro Debilitante II** | Se você causar dano a um inimigo com uma arma de longo alcance, o Vigor dele se recuperará muito mais lentamente, e sua eficácia de combate será mais reduzida. O efeito negativo também durará mais. | Fica | O tiro enfraquece mais e por mais tempo. |
| 14 | **Disparo Glorioso** | Ao matar um inimigo com uma arma de longo alcance, seu próximo disparo causa +50% de dano. | Fica, com cuidado | Depois de matar com arma de longo alcance, o tiro seguinte faz +50%. |
| 16 | **O Hal Atirou Primeiro II** | Seu primeiro disparo causará 15% mais dano, totalizando 30% no primeiro nível da vantagem. O resto do efeito permanece inalterado. | Fica, com cuidado | O primeiro tiro soma +30% no total. |
| 16 | **Mira Firme II** | Se você permanecer imóvel por 2 ou mais segundos enquanto estiver mirando, seu tiro será 30% mais potente. | Fica, com cuidado | Parado mirando, +30% de dano do tiro. |
| 18 | **Olho de Águia** | Ao mirar com arco ou balestra, o mundo à sua volta fica mais lento por um momento, facilitando a mira. O efeito dura 3 segundos ou até você disparar. | Sem efeito aqui | O mundo fica mais lento ao mirar: o tempo do servidor é o mesmo para todos, não dá para desacelerar só para um. |

## Equitação

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Treinamento de Cavaleiro** | Ataques corpo a corpo a cavalo custarão 15% menos Vigor, e os inimigos terão mais dificuldade para derrubá-lo da montaria. | Fica | Ataque a cavalo custa 15% menos e é mais difícil ser derrubado. |
| 6 | **Selador** | Reparos com um kit de Sapateiro são 20% mais eficientes. Além disso, por conhecer bem bolsas e bolsilhas, você tem um bônus de +1 na habilidade de Roubo quando furta alguma coisa. | Fica | Reparo com o kit de sapateiro 20% mais eficiente e +1 em Roubo ao furtar bolsas. |
| 8 | **Boa Arrancada** | Se você usar uma Arrancada Rápida [tecla] [tecla], seu cavalo correrá, por um breve período, mais rápido que o vento! O efeito durará 10 segundos. Só pode ser ativada uma vez a cada 2 minutos. | Fica | Arrancada do cavalo por 10 s, a cada 2 minutos. |
| 8 | **Ameaça Imponente** | Empinar o seu cavalo assusta ainda mais os inimigos. | Fica | Empinar o cavalo assusta mais os inimigos. |
| 10 | **Rápido como o Vento** | Seu cavalo consome Vigor 5% mais devagar quando está galopando. | Fica | O cavalo gasta 5% menos Vigor ao galopar. |
| 10 | **Veloz como o Vento** | Ao cavalgar na estrada, seu cavalo consome Vigor 15 % mais devagar. | Fica | Na estrada o cavalo gasta 15% menos Vigor: boa para quem viaja. |
| 10 | **Ginete Selvagem** | Ao cavalgar fora da estrada, seu cavalo consome Vigor 10 % mais devagar. | Fica | Fora da estrada o cavalo gasta 10% menos Vigor. |
| 12 | **Últimos Metros** | Quando seu cavalo estiver quase sem Vigor, você pode esporeá-lo com [tecla] para recuperar uma parte. Essa vantagem tem uma recarga de 120 segundos antes de poder ser usada novamente. | Fica | Esporear recupera um pouco do Vigor do cavalo. |
| 12 | **Pisotear** | Se você avançar contra alguém com um cavalo, o moral da pessoa cairá de forma significativa e subitamente ela se tornará um oponente mais fácil. A menos que resolva dar no pé. | Fica | Avançar com o cavalo derruba o moral de quem é atropelado (NPC). |
| 14 | **Entrando em Campo** | Ataques carregados executados de cima da sela serão 10% mais fortes. | Fica | Ataque carregado da sela 10% mais forte. |
| 14 | **Cavalo de Batalha** | Todos os inimigos que você matar montado na sela aumenta o moral do seu cavalo. Assim, ele dificilmente vacilará em combate. | Fica | O cavalo que viu matar fica firme no combate. |
| 16 | **Rápido como o Vento II** | Seu cavalo consome Vigor 10% mais devagar quando está galopando. | Fica | O cavalo gasta 10% menos Vigor ao galopar. |
| 16 | **Boa Arrancada II** | Ao usar a Arrancada Rápida [tecla] [tecla], o cavalo partirá ainda mais rápido do que antes e não perderá Vigor. O efeito dura 10 segundos. Só pode ser ativada uma vez a cada 2 minutos. | Fica | A arrancada não gasta Vigor do cavalo. |
| 18 | **Últimos Metros II** | Se você esporear o seu cavalo, ele recuperará muito mais Vigor do que antes! O resto do efeito permanece o mesmo. | Fica | O esporear devolve bem mais Vigor. |

## Adestramento

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Procure!** | Você pode mandar o Vira-lata farejar locais de interesse ou caça. Para fazer isso, selecione o comando "Liberar!". Caso encontre algo, ele irá latir para alertá-lo. Graças ao seu fiel companheiro, você não perderá nada. | Sem efeito aqui | Manda o cão farejar por comando do jogo; o cão do apoiador não tem esses comandos. |
| 6 | **Vá Caçar!** | Você pode mandar o Vira-lata caçar animais selvagens. Você verá que ele é um ótimo ajudante! | Sem efeito aqui | Manda o cão caçar por comando do jogo; o cão do apoiador não tem esse comando. |
| 8 | **Calor Canino** | Ao dormir no meio do mato, seu cachorro mantém você aquecido. Portanto, a qualidade da cama aumentará em 20%, sem ultrapassar 50% da qualidade da cama. | Sem efeito aqui | Depende de o cão ser o companheiro do jogo; o do apoiador é um cão do servidor. |
| 8 | **Companheiro Leal** | Quando o Vira-lata foge, o tempo que ele demora para voltar é 25% menor. | Sem efeito aqui | Tempo de volta do cão que foge: o cão do servidor não foge. |
| 10 | **Cão Infernal** | Com o seu cachorro ao lado, você parece mais ameaçador e durão. Isso será representado ao usar as habilidades Presença e Intimidação, mas também em combate, já que os inimigos ficam mais propensos a desistir ou fugir. E, mesmo que não façam isso, terão mais dificuldade em lutar contra você. | Sem efeito aqui | Depende de o cão ser o companheiro do jogo. |
| 10 | **Companheiro Encantador** | Quando está ao lado de seu cão, você ganha +3 de Carisma. | Sem efeito aqui | +3 de Carisma junto do cão do jogo: não vale para o cão do servidor. |
| 12 | **Latir!** | Você ensinou o Vira-lata a fazer barulho e a chamar a atenção. Isso pode ser útil, especialmente se você tiver que chegar a algum lugar sem ser detectado. O comando para latir pode ser acionado na seção Comandos. O cão começará a latir no local em que estiver, então não fique parado se quiser que o truque dê certo. | Sem efeito aqui | Comando de latir do jogo: o cão do servidor não o tem. |
| 12 | **Faro Intenso** | O Vira-lata consegue farejar inimigos e outros possíveis incômodos a uma distância muito maior. Assim, fica mais fácil avistar e evitar uma emboscada ou outros incidentes durante a viagem rápida. | Sem efeito aqui | Faro de emboscada na viagem rápida do jogo, que o servidor trocou pela carroça. |
| 12 | **Melhor Amigo do Cão** | Cães estranhos não latem para você, só rosnam. Isso pode ser útil, por exemplo, ao invadir um quintal privado, porque o dono da casa pode nem perceber que o cachorro está rosnando. No entanto, se você atacar o cachorro, ele provavelmente vai latir e arrancar as suas bragas. | Fica | Cães estranhos só rosnam para você. |
| 14 | **Defensor** | Em combate, o Vira-lata ficará mais forte e sofrerá 10% menos dano dos inimigos. | Sem efeito aqui | Cão do jogo mais forte em combate: o do servidor não luta. |
| 16 | **Companheiro Fiel** | A obediência do Vira-lata diminuirá 25% mais lentamente ao longo do tempo. | Sem efeito aqui | Obediência do cão do jogo. |
| 18 | **Cortar e Rasgar** | Se o seu cão infligir um ferimento com sangramento no inimigo, o sangramento será acelerado, e o inimigo cairá mais rápido. | Sem efeito aqui | Ataque do cão do jogo. |
| 20 | **Pega Eles!** | Os ataques do seu cão são 20% mais fortes, de modo que ele lida com os inimigos com mais facilidade e rapidez. | Sem efeito aqui | Ataque do cão do jogo. |

## Furtividade

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Homem das Matas** | Você faz 50% menos barulho quando se move nos arbustos. | Fica | 50% menos barulho nos arbustos. |
| 6 | **De um Jeito ou de Outro** | Se um oponente se defender contra sua tentativa de atordoamento ou execução furtiva, os atributos dele serão penalizados. Assim, será mais fácil derrotá-lo convencionalmente. O efeito dura 20 segundos. | Fica | Quem defende o atordoamento furtivo fica enfraquecido por 20 s. |
| 8 | **Sombra Fugaz** | Ganha um bônus de +3 em Furtividade e +2 em Agilidade e Vitalidade quando estiver sendo procurado por um crime, facilitando a fuga. O efeito dura 120 segundos. | Sem efeito aqui | Bônus de fuga de crime procurado pelo jogo; o servidor tem o seu sistema. |
| 8 | **Camuflagem Natural** | Quanto mais sujo você estiver, mais difícil será encontrá-lo. Mas cuidado, porque o seu cheiro continua sendo perfeitamente identificável. | Fica | Quanto mais sujo, mais difícil de achar: combina com a sujeira do servidor. |
| 10 | **Homem Comum** | As pessoas esquecerão seus crimes mais rapidamente. Também reduz as chances de você ser revistado pelos guardas. | Sem efeito aqui | Esquecimento de crime e revista de guarda. |
| 10 | **Roedor** | Você fará 25% menos barulho ao entrar furtivamente em ambientes fechados e causará apenas metade do barulho ao abrir a porta. | Fica | 25% menos barulho entrando em ambientes fechados. |
| 10 | **Homem-doninha** | Você faz 35% menos barulho ao se esgueirar em áreas externas. | Fica | 35% menos barulho ao se esgueirar fora de casa. |
| 12 | **Postura Enganosa** | Se você não estiver usando uma armadura muito pesada, pode fintar com o corpo e deixar o oponente inseguro. Ganha +3 na habilidade Guerra. | Fica | Sem armadura pesada, +3 em Guerra com a finta. |
| 12 | **A Arte de Escapar** | Se alguém estiver indo atrás de você e não tiver sucesso, a pessoa desistirá um pouco antes. | Fica | Quem persegue desiste um pouco antes (NPC). |
| 12 | **Ataque-surpresa** | Se você usar uma arma de longo alcance para atingir alguém que não sabe da sua presença, seu alvo sofrerá uma penalidade de habilidade de combate, ficando mais fácil de enfrentar. Ele pode até entrar em pânico e fugir. | Fica | Tiro à distância em quem não sabe de você enfraquece o alvo. |
| 14 | **Sombra Fugaz II** | Quando você é procurado por um crime, você ganha um bônus total de +5 em Furtividade e +3 em Agilidade e Vitalidade, facilitando a fuga. O efeito dura 120 segundos. | Sem efeito aqui | Bônus de fuga de crime procurado pelo jogo. |
| 14 | **Mão Ágil** | Você pode ser muito furtivo ao arrombar fechaduras ou furtar pessoas. De longe, ninguém nota nada. | Fica | Arrombar e furtar sem ninguém notar de longe. |
| 16 | **A Arte de Escapar II** | Se alguém estiver atrás de você e não tiver sucesso, a pessoa desistirá bem mais cedo. | Fica | Quem persegue desiste bem mais cedo (NPC). |
| 18 | **Emboscador** | Acertar um alvo que não percebeu sua presença causará +20% de dano. | Fica | +20% de dano em quem não percebeu você. |

## Roubo

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Dedos Ágeis** | Durante a fase de coleta de tempo, no minijogo de furto, você ganha tempo 10% mais rápido. | Fica | Ganha tempo 10% mais rápido no furto. |
| 6 | **Trapaceiro Silencioso** | Você praticamente não faz barulho quando usa uma gazua, e, se ela quebrar, o som fica 75% mais baixo. | Fica | Quase nenhum barulho com a gazua. |
| 8 | **Voo Rápido** | Se não conseguir voltar pela porta durante o minijogo de roubo, você não roubará nada, mas sua vítima não o perceberá. Após usar a vantagem, o efeito terá uma recarga de 3 minutos antes de poder ser usado novamente. | Fica | Escapar do furto sem ser notado, a cada 3 minutos. |
| 8 | **Mestre das Ferramentas** | Suas gazuas são mais resistentes e duram 15 % mais antes de quebrar. Se mesmo assim você quebrar uma gazua, depois de arrombar a fechadura, uma gazua retornará ao seu inventário. | Fica | Gazuas duram 15% mais e uma volta ao inventário se quebrar. |
| 10 | **Bolsos Secretos** | Se um guarda revistar você, ele tem 33% de chance de não encontrar itens roubados. | Sem efeito aqui | Chance de o guarda não achar o roubado: o servidor tem a própria regra de ladrão. |
| 10 | **Olhos de Ladrão** | É mais fácil vender itens roubados para os comerciantes. Você também pode reconhecer quais itens roubados podem ser vendidos com segurança no local onde você está — eles estarão marcados com uma mão branca em vez de uma vermelha. Mas cuidado! Eles ainda são considerados roubados e serão confiscados se um guarda revistar você. | Sem efeito aqui | Marca o roubado que o vendedor aceita: os vendedores do servidor só compram o ofício. |
| 12 | **Escaramuçador do Beco** | Se você usar apenas uma arma de uma só mão, seus ataques causarão +10% de dano. Se você tiver uma tocha na outra mão, o efeito também se aplica. | Fica, com cuidado | Uma arma só: +10% de dano. |
| 12 | **Bandido** | Se for procurado por um crime, você ganhará bônus de +3 de Força e Guerra, e +1 de Agilidade, o efeito dura 120 segundos. | Sem efeito aqui | Bônus de procurado do jogo. |
| 14 | **Mestre das Travessuras** | Após arrombar uma fechadura ou furtar com sucesso, você ganha +3 de bônus de Roubo e +3 de bônus de Furtividade. O efeito dura 120 segundos ou até você quebrar uma gazua ou fracassar no furto. | Fica | Depois de arrombar ou furtar, +3 em Roubo e Furtividade por 120 s. |
| 14 | **Marcando Terreno** | Quando você está em aglomerações de humanos ou nas proximidades imediatas, sua habilidade de Furtividade será 3 pontos mais alta. | Fica | Em multidão, +3 em Furtividade. |
| 16 | **Traficante** | Itens roubados no seu inventário perdem o status de roubado 25% mais rápido. | Sem efeito aqui | Roubado perde a marca mais depressa: o servidor tem a própria regra. |
| 18 | **Imperceptível** | A pessoa que você está roubando pode não te ver, então você pode alcançar até mesmo a bolsilha na frente dela, mas enquanto estiver mexendo nos bolsos, ela ainda pode sentir sua presença. | Fica | Dá para furtar a bolsilha diante da pessoa. |
| 18 | **Mestre-ladrão** | Você pode abrir fechaduras simples quase instantaneamente, sem necessidade de ativar o minijogo ou cometer crimes. Mesmo assim, tome cuidado, pois roubar um baú destrancado assim continua sendo crime. | **Forte demais** | Abre fechadura simples quase na hora, sem minijogo e sem crime: tira o peso das fechaduras e das chaves das casas. |

## Sobrevivência

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Na Trilha do Caçador Clandestino** | Você pode vender ervas, caça, peles e troféus pelo dobro do preço. | Fica, com cuidado | Ervas, caça, peles e troféus valem o dobro na venda: os vendedores do servidor pagam 35% e têm bolsa diária, mas o dobro vira 70%. |
| 6 | **Andarilho** | A qualidade das camas aumenta de acordo com a sua habilidade de Sobrevivência. Mas esta vantagem melhora a qualidade de uma cama em no máximo 50%. Em camas de qualidade superior, a vantagem não terá efeito. | Fica | Cama melhor conforme a Sobrevivência, até 50%. |
| 8 | **Poder Floral** | Se você tiver mais de 30 ervas frescas ou secas (não estragadas) no seu inventário, seu Carisma contará como 2 a mais. | Fica | Com mais de 30 ervas no inventário, +2 de Carisma. |
| 8 | **Mestre Cozinheiro** | Se você cozinhar, secar ou defumar um ingrediente ou alimento não estragado, ele terá condição de 100% após o processamento. Isso não se aplica a ervas, pois elas sempre têm condição de 100% após a secagem, independentemente da vantagem. | Fica | Comida cozida, seca ou defumada sai com 100% de condição: o fogo, o defumador e o secador daqui já entregam a peça nova, então já está cumprida; um bônus de rendimento do cozinheiro seria outra coisa. |
| 10 | **Riquezas da Natureza** | Você também extrai pele, troféus, cortes de carne selecionados e vísceras dos animais que caçar. | Fica | Tira pele, troféu e cortes de quem o caçador abate. |
| 10 | **Treino de Perna** | Ao colher ervas, você também ganhará uma pequena quantidade de experiência na habilidade Força. | Fica | Colher erva dá um pouco de experiência de Força. |
| 10 | **Achadinho da Sorte** | Ao colher ervas, você tem a chance de encontrar uma erva adicional ou um pequeno tesouro. | **Levar para o ofício** | Ao colher erva, chance de uma extra ou de um tesouro: pode ser um bônus dos Agricolae na colheita. |
| 12 | **Amigo do Peito** | Se você acertar seu alvo no peito, seu tiro causará +10% de dano. O efeito também será aplicado ao atingir pelas costas. | Fica, com cuidado | Tiro no peito (e pelas costas) +10%: soma com os outros bônus de arco. |
| 12 | **Lenhador** | Enquanto você estiver na floresta, seu odor é reduzido pela metade, seu Vigor se regenera 15% mais rápido, sua Força, Vitalidade e Agilidade aumentam em 1 e sua Furtividade aumenta em 2. | Fica, com cuidado | Na floresta: odor pela metade, Vigor +15%, +1 de atributos e +2 de Furtividade. |
| 14 | **Flecheiro de Elite** | Suas flechas e virotes têm melhores propriedades balísticas, com mais velocidade, mais alcance e maior capacidade de perfuração. | **Levar para o ofício** | Flechas e virotes com melhor balística: as do arqueiro daqui são as do jogo, sem esse ganho; poderia ser rendimento ou alcance a mais do flecheiro. |
| 16 | **Homem Selvagem** | Os efeitos das vantagens Leshy e Leshy II agora se aplicam não apenas na floresta, mas em qualquer região selvagem, ou seja, essencialmente em qualquer lugar fora dos assentamentos humanos e nas terras diretamente adjacentes. | Fica, com cuidado | Leva o bônus da floresta para qualquer lugar fora de povoado: no mato quem tem essa passiva joga em outro nível. |
| 18 | **Amigo do Peito II** | Se você atingir o alvo no peito, seu tiro causará +25% de dano. O efeito também se aplicará ao acertar por trás. | Fica, com cuidado | Tiro no peito +25%: com a Mira Firme e o Primeiro Tiro passa de 80% a mais. |
| 20 | **Leshy II** | Você pode se locomover pela floresta como se fosse um espírito florestal. Seu Vigor se regenerará 25% mais rápido, sua Força e Agilidade contarão como 2 pontos mais altas, e sua habilidade Furtividade contará como 4 pontos mais alta. O restante dos efeitos continuará igual. | Fica, com cuidado | Floresta: Vigor +25%, Força e Agilidade +2, Furtividade +4. |

## Alquimia

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Arte da Preservação** | Os alimentos crus e as ervas em seu inventário estragarão 50% mais devagar. | Fica | Comida crua e ervas do inventário estragam 50% mais devagar: vale no inventário, serve ao cozinheiro e ao boticário. |
| 6 | **Vendedor de Poções** | Você pode vender as poções que preparou por +30% do preço. | **Levar para o ofício** | Vende poção por +30%: os vendedores do servidor pagam 35% do preço e têm bolsa de 300 por dia; seria um bônus do Boticário a desenhar. |
| 6 | **Entusiasta** | Ao preparar poções, sua Energia aumenta lentamente, e sua Saciedade não diminui. | **Levar para o ofício** | Dava Energia e segurava a fome enquanto se preparava poção na mesa do jogo; na página dos ofícios não faz nada. |
| 8 | **Segredo do Equilíbrio** | O processo de preparação será mais tolerante a pequenos erros, facilitando a obtenção de poções de melhor qualidade. | **Levar para o ofício** | Tolerância a erro no minijogo da mesa, que a alquimia daqui não tem: sem efeito. Poderia virar chance de poção de qualidade melhor. |
| 8 | **Segredo da Matéria** | Cada vez que você preparar uma poção com sucesso, receberá uma extra da mesma qualidade. | **Levar para o ofício** | Cada poção bem-sucedida vem com uma extra. Sem efeito hoje (a alquimia é feita na página dos ofícios): é o exemplo mais claro do que levar para o ofício. |
| 10 | **Especialista em Veneno** | Você pode envenenar mais flechas com uma única dose de veneno, e ele durará por mais golpes na sua arma. | Fica | Uma dose envenena mais flechas. |
| 10 | **Névoa Púrpura** | Ganha +1 de Vitalidade para cada efeito de poção ou de álcool ativo ao mesmo tempo. | Fica | +1 de Vitalidade por poção ou bebida ativa. |
| 12 | **Aprendiz de Artes das Trevas** | Ao preparar poções entre meia-noite e o amanhecer (0:00 - 4:30), você trabalha melhor: o processo inteiro fica menos suscetível a pequenos erros e será mais fácil de obter um produto de maior qualidade. Além disso, você recebe um bônus de +2 em Coerção, Dominação e Intimidação ao falar com plebeus. | **Levar para o ofício** | Preparar entre meia-noite e o amanhecer erra menos: efeito do minijogo da mesa, perdido na página dos ofícios. |
| 12 | **Água da Vida** | Você ganha recuperação 25% maior ao usar poções de cura. | Fica | Poções de cura curam 25% a mais. |
| 14 | **Segredo do Equilíbrio II** | No processo de preparar poções, a tolerância aos próprios erros é considerável. Se você também tiver o primeiro nível dessa vantagem, os efeitos se acumulam e o benefício será ainda maior. | **Levar para o ofício** | Mesmo caso do primeiro nível: o minijogo não existe aqui. |
| 14 | **Segredo da Matéria II** | Cada vez que você preparar uma poção com sucesso, receberá 2 extras da mesma qualidade. Se você também tiver o primeiro nível da vantagem, recebe 3 poções extras. | **Levar para o ofício** | Duas poções extras a cada sucesso (três com o primeiro nível): o dobro do efeito do primeiro; ao levar, tem de ser medido para não inundar de poção. |
| 16 | **Segredo dos Segredos** | Se você seguir a receita à risca e acertar o tempo de preparo, poderá preparar poções de qualidade excepcional com as quais herbalistas comuns só poderiam sonhar. | **Levar para o ofício** | Poções excepcionais para quem acerta a receita e o tempo: não há tempo a acertar na página dos ofícios. |
| 18 | **Pólvora Especial** | Ao usar a munição e pólvora que você mesmo fabricou, a eficiência das armas de fogo aumenta em 20%, e a arma sofre menos dano ao disparar. | Sem efeito aqui | Pólvora e balas feitas pelo jogador: a píšťala é só do apoiador e ninguém fabrica a pólvora. |
| 18 | **Especialista em Veneno II** | Ao usar uma dose de veneno nas flechas, você pode envenenar um maior número delas e o efeito dura mais na sua arma. | Fica | Mais flechas por dose, e o veneno dura mais na arma. |
| 18 | **Névoa Púrpura II** | Ganha +2 de Vitalidade para cada efeito de poção ou de álcool ativo ao mesmo tempo. | Fica | +2 de Vitalidade por poção ou bebida ativa. |

## Artesanato

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Afiado como Navalha** | Se você afiar uma arma a 98% ou mais na pedra de amolar, o dano de corte dessa arma aumentará em 10%. O efeito dura até que a condição da arma caia abaixo de 75%. | Fica | Arma afiada a 98% ou mais na pedra: +10% de corte até a condição cair a 75%. A pedra é de todos. |
| 6 | **Botas de Sete Léguas** | Se você usar botas consertadas por você mesmo, correr rápido custará 25% menos Vigor, assim você poderá correr por mais tempo e ir mais longe. | Fica, com cuidado | Botas que você consertou: correr custa 25% menos Vigor; fica de graça com o kit de sapateiro. |
| 6 | **Caimento Perfeito** | Armaduras e roupas consertadas por você com um kit de Armeiro fazem menos barulho ao serem usadas. O efeito dura até o nível de qualidade do item cair. | Fica | Armadura e roupa consertadas por você fazem menos barulho. |
| 8 | **Mão Amiga** | Os reparos feitos por artesãos ficam 20% mais baratos. | Sem efeito aqui | Conserto de artesão 20% mais barato: não há artesão de conserto no servidor. |
| 8 | **Manutenção Completa** | Seu equipamento é danificado 10% mais devagar, não sendo necessário consertá-lo com tanta frequência. | Fica | O equipamento se gasta 10% mais devagar. |
| 10 | **Aço Temperado** | As armas que você forjar terão excelentes propriedades e, portanto, sofrerão dano 20% mais lentamente. | **Levar para o ofício** | Armas forjadas por você duram 20% mais: a forja daqui não aplica isso. Poderia virar durabilidade a mais na peça forjada. |
| 10 | **Olhar Atento** | Se você mandar um artesão consertar seu equipamento, ganhará um pouco de experiência em Artesanato. A experiência que você ganhará aumentará com o preço do reparo. | Sem efeito aqui | Experiência por mandar um artesão consertar: não há artesão de conserto. |
| 12 | **Chaveiro** | Ao arrombar fechaduras, sua habilidade de Roubo contará como 3 pontos mais alta, facilitando muito a sua vida. Além disso, você também pode usar ferro-velho. Assim, você receberá 1–3 gazuas extras para cada item que conseguir forjar. | Fica, com cuidado | +3 em arrombamento e gazuas extras do ferro-velho: facilita invadir casa, que o servidor quer difícil. |
| 12 | **Indiscutivelmente Legítimo** | Armas, armaduras e roupas roubadas no seu inventário perdem o status de roubado 20% mais rápido. | Sem efeito aqui | Tira a marca de roubado mais depressa: o servidor tem a própria regra de ladrão. |
| 14 | **Bowyer** | Os arcos e balestras consertados por você com o kit de Bowyer são 10% mais poderosos. Assim, seus disparos vão mais longe e têm maior capacidade de perfuração. | Fica | Arco consertado com o kit de arqueiro é 10% mais forte. |
| 14 | **Manutenção Completa II** | Seu equipamento sofre -20% de dano. | Fica, com cuidado | -20% de desgaste do equipamento: diminui o trabalho de ferreiro e de artesão que repõe o que quebra. |
| 16 | **Botas de Sete Léguas II** | Se você calçar botas que reparou por conta própria, correr rápido custará 50% menos Vigor, para aguentar mais tempo e ir mais longe. | Fica, com cuidado | Botas consertadas por você: correr custa 50% menos Vigor, fuga e perseguição muito mais longas. |
| 16 | **Segredo de Martin** | Agora você poderá forjar armas do nível quatro, ou seja, da mais alta qualidade. Armas dessa qualidade só podem ser obtidas se forem forjadas por você mesmo, e a resistência e eficácia delas são incomparáveis. | **Levar para o ofício** | Libera a forja de armas de qualidade quatro: a forja daqui não tem esse degrau; poderia ser a trava das peças de topo. |

## Erudição

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Almofada** | Ganha 50% de efeito de conforto ao sentar, para que você possa estudar mais rápido. | Fica | Mais conforto sentado: estuda mais depressa. |
| 8 | **Maravilhas da Fauna** | Você melhora mais rápido nas habilidades Adestramento e Equitação, pois toda experiência adquirida será 20% maior. | Fica | 20% a mais de experiência em Adestramento e Equitação. |
| 8 | **Maravilhas da Humanidade** | Você melhora mais rápido nas habilidades Artesanato e Roubo, pois toda experiência adquirida será 20% maior. | Fica | 20% a mais de experiência em Criação e Roubo. |
| 8 | **Maravilhas da Natureza** | Você melhora mais rápido nas habilidades Sobrevivência e Alquimia, pois toda experiência adquirida será 20% maior. | Fica | 20% a mais de experiência em Sobrevivência e Alquimia. |
| 10 | **Contemplativo** | Enquanto você permanecer imóvel, sua Energia e sua Saciedade diminuirão muito mais devagar. | Fica, bom para o co-op | Parado, Energia e Saciedade caem bem mais devagar: serve a quem passa o tempo na taverna ou no posto. |
| 10 | **Artes Liberais** | Você é capaz de reconhecer a dificuldade dos testes de habilidade, mas não suas chances de sucesso. Ainda assim, você terá que decidir se vale a pena o risco. O efeito da sua reputação não é levado em conta na dificuldade exibida. | Sem efeito aqui | Mostra a dificuldade dos testes de habilidade das conversas, que o servidor não tem. |
| 12 | **Direito** | Ao lidar com guardas, sua Persuasão e sua Impressão receberão 2 pontos a mais. A multa total será 20% menor. | Sem efeito aqui | Conversa e multa com guardas: não vale para o jogador aqui. |
| 12 | **Medicina** | As ataduras ficam 25% mais eficazes e os efeitos curativos dos alimentos são duplicados. Você se recupera mais rápido ao dormir e leva menos tempo para se curar completamente. | Fica, bom para o co-op | Ataduras 25% mais eficazes e comida que cura em dobro: bom para o RP de curandeiro e de enfermaria. |
| 14 | **Medicina II** | Os efeitos das poções de cura ficam 20% mais fortes. | Fica | Poções de cura 20% mais fortes. |
| 14 | **Teologia** | Você pode orar em santuários, cruzes e locais semelhantes. Se fizer isso, receberá um potencializador que pode protegê-lo de ferimentos fatais em combate e restaurar 25% da Vida. O efeito dura 12 horas de jogo ou até ser usado. | **Forte demais** | Rezar num santuário protege de um ferimento fatal e devolve 25% da Vida por 12 horas de jogo: é uma vida a mais, e a morte é uma decisão do RP. |
| 16 | **Direito II** | Se um guarda quiser prendê-lo por seus crimes, você pode usar sua Erudição em um teste de habilidade para tentar interpretar a lei a seu favor e escapar da punição. | Sem efeito aqui | Escapa de prisão por teste de Erudição com guarda. |
| 18 | **Explorador** | O mapa inteiro é revelado, mostrando todos os assentamentos, locais de viagem rápida, áreas de caça, cavernas e outros lugares interessantes. | Fica, com cuidado | Revela o mapa inteiro: tira o mistério dos lugares (mas ajuda a saber onde fica o quê). |
| 18 | **Teologia II** | A Peregrinação Penitencial recupera mais reputação, e o efeito do primeiro nível dessa vantagem agora dura 24 horas no jogo. | Sem efeito aqui | Peregrinação penitencial devolve reputação: o servidor não usa reputação. |

## Inebriação

| Nível | Passiva | O que faz (o jogo diz) | Veredito | Por quê |
| ---: | --- | --- | --- | --- |
| 6 | **Saideira** | Antes você teria ressaca ao dormir, mas agora não terá mais. Além disso, quando você estiver bêbado, todas as camas ficarão 10% mais confortáveis e você dormirá como um rei. | Fica | Sem ressaca e cama 10% mais confortável bêbado. |
| 6 | **Bênção de Santa Vivian** | Sob a influência do álcool, você tem menos probabilidade de se machucar ao cair do alto, porque o santo padroeiro dos beberrões aparentemente decidiu lhe estender uma mão protetora. | Fica | Bêbado, cai com menos dano. |
| 8 | **Dia de Sorte** | Quanto mais bêbado você estiver, maior a chance de não gastar sua insígnia ao usá-la. | Fica | Bêbado, menos chance de gastar a insígnia dos dados. |
| 8 | **Beberrão** | É incrível, mas quando está bêbado, você faz 20% menos barulho ao se mover em ambientes fechados. | Fica | Bêbado, faz 20% menos barulho em ambientes fechados. |
| 10 | **Trabalho Pesado** | Quando você está na fase positiva da embriaguez, você gradualmente ganha um bônus de +4 na habilidade Artesanato. | Fica | Na fase boa da embriaguez, +4 em Criação. |
| 10 | **Sorte do Bêbado** | Quando você está na fase positiva da embriaguez, ganha um bônus de até +4 na habilidade Roubo. | Fica | Na fase boa da embriaguez, +4 em Roubo. |
| 10 | **Barriga de Cerveja** | Você fica duas vezes mais saciado com cerveja, por isso, caso não tenha medo de se embriagar, é possível substituir comida por cerveja. No entanto, as poções dão 50% de saciedade, então você pode beber mais delas. | Fica | Cerveja sacia o dobro: bom para quem vive na taverna. |
| 12 | **Saúde!** | Beber vinho ou cerveja recupera 5 pontos de Vida e destilados podem curar envenenamento. Não desperdice uma gota! | Fica | Vinho e cerveja curam 5 de Vida; destilado trata veneno. |
| 12 | **Bêbado Indomável** | Os efeitos negativos da embriaguez são mais brandos. | Fica | Os efeitos ruins da bebedeira são mais brandos. |
| 14 | **Álibi Alcoólico** | Se você cometer um crime leve enquanto estiver bêbado, poderá tentar se justificar alegando embriaguez. | Sem efeito aqui | Álibi de bêbado perante guarda: não há guarda para isso. |
| 14 | **Lutador de Taverna** | Quando você está na fase positiva da embriaguez, ganha um bônus de +4 na habilidade de combate Desarmado. | Fica | Na fase boa da embriaguez, +4 em Combate Desarmado: briga de taverna. |
| 16 | **Mistura Aprimorada** | Enquanto estiver bêbado, usar qualquer poção, além dos próprios efeitos, também pode curar você. Quanto mais embriagado você estiver, mais forte será o efeito de cura (na fase positiva da embriaguez), mas ele nunca excederá 20 de Vida. | Fica, com cuidado | Bêbado, toda poção ainda cura até 20 de Vida: soma com a de cura e com Água da Vida. |
| 16 | **Folião Experiente** | Quando você está bêbado, a vida fica simplesmente melhor. Os bônus da fase positiva da embriaguez entram em vigor mais cedo. | Fica | Os bônus da embriaguez começam mais cedo. |
