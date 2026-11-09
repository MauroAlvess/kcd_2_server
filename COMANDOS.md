# Comandos do servidor

Lista de todos os comandos de chat (`/`) que o gamemode `kcdc-gamemode` já tem, gerada a partir do código (`src/server/commands/*.ts`).
São **79 comandos**, em 17/10/2026 (gamemode 1.1.0, KCDC 1.6.10). Serve como mapa de pesquisa: para cada comando há o que ele faz, quem ele afeta, o arquivo que o implementa e as partes da API do motor que ele usa, para reaproveitar quando formos programar.

As formas de uso abaixo são copiadas do próprio `/help` do jogo, por isso estão em inglês.

> **Perfis.** Há dois: **jogador** (roda só 29 comandos: `/acordar`, `/admin`, `/anim`, `/cachorro`, `/camera`, `/cansaco`, `/carroca`, `/cavalo`, `/chave`, `/cozinhar`, `/dice`, `/do`, `/face`, `/fome`, `/help`, `/horta`, `/idioma`, `/language`, `/leitura`, `/me`, `/mural`, `/mute`, `/mutes`, `/paz`, `/preso`, `/sede`, `/sujeira`, `/try`, `/unmute`) e **admin** (roda todos). Quem é o quê é decidido pelo ticket com que a pessoa entra; veja [Acesso, tickets e perfis](#acesso-tickets-e-perfis). Um comando novo é só de admin até entrar na lista.

## Índice

1. [Resumo de todos os comandos](#resumo-de-todos-os-comandos)
2. [Ajuda e painéis](#ajuda-e-painéis)
3. [Personagem](#personagem)
4. [Voz e jogos entre jogadores](#voz-e-jogos-entre-jogadores)
5. [Mundo e ambiente](#mundo-e-ambiente)
6. [Objetos, marcadores e efeitos](#objetos-marcadores-e-efeitos)
7. [Montarias, cães e carroças](#montarias-cães-e-carroças)
8. [NPCs, animações e conversas](#npcs-animações-e-conversas)
9. [Ofícios e itens](#ofícios-e-itens)
10. [Cerco](#cerco)
11. [Diversão e testes](#diversão-e-testes)
12. [Teclas](#teclas)
13. [Comandos do console do servidor](#comandos-do-console-do-servidor)
14. [Como criar um comando novo](#como-criar-um-comando-novo)
15. [Do que o RP precisa e por onde começar](#do-que-o-rp-precisa-e-por-onde-começar)
16. [Conceitos que aparecem nos comandos](#conceitos-que-aparecem-nos-comandos)
17. [Acesso, tickets e perfis](#acesso-tickets-e-perfis)
18. [Limite de tamanho do pacote do cliente](#limite-de-tamanho-do-pacote-do-cliente)
19. [Seções do painel](#seções-do-painel)
20. [O que é salvo e o que não é](#o-que-é-salvo-e-o-que-não-é)
21. [Criação de personagem](#criação-de-personagem)
22. [Kits, livros de receita e vendedores](#kits-livros-de-receita-e-vendedores)
23. [Propriedades e o mapeamento de Suchdol](#propriedades-e-o-mapeamento-de-suchdol)
24. [Animais e ervas](#animais-e-ervas)
25. [Dia, noite e clima](#dia-noite-e-clima)
26. [Bandidos](#bandidos)
27. [Fome](#fome)
28. [Encontros entre jogadores](#encontros-entre-jogadores)
29. [Apoiador](#apoiador)
30. [Salteadores nas estradas](#salteadores-nas-estradas)
31. [Morte e renascimento](#morte-e-renascimento)
32. [Cansaço](#cansaço)
33. [Sujeira](#sujeira)
34. [Livros de habilidade](#livros-de-habilidade)
35. [Cidadania](#cidadania)
36. [Ofícios das guildas](#ofícios-das-guildas)
37. [Idioma](#idioma)
38. [NPCs](#npcs)
39. [Viagem rápida de carroça](#viagem-rápida-de-carroça)
40. [Móveis do World Builder](#móveis-do-world-builder)
41. [Quadros de avisos](#quadros-de-avisos)
42. [O chat do T](#o-chat-do-t)

## Resumo de todos os comandos

| Comando | Para que serve | Quem é afetado | Quem pode usar | Seção |
| --- | --- | --- | --- | --- |
| `/admin` | Vira administrador, até sair do servidor, apresentando um ticket de admin depois de já estar dentro; `/admin sair` volta a ser jogador comum | só você | jogador e admin | Ajuda e painéis |
| `/book` | Abre livros de demonstração nas suas mãos: a crônica do Kingdoms Connected, uma carta de arauto e uma versão em que a tinta aparece aos poucos | só você | só admin | Ajuda e painéis |
| `/camera` | Alterna a sua câmera entre primeira pessoa e uma câmera atrás de você (`third [distância]`) | só você | jogador e admin | Ajuda e painéis |
| `/help` | Lista os comandos que o servidor atende | só você | jogador e admin | Ajuda e painéis |
| `/hud` | Esconde e mostra elementos do HUD nativo do jogo no seu cliente (padrão: a barra `Stats`) | só você | só admin | Ajuda e painéis |
| `/idioma` | Escolhe o **idioma** do painel, das mensagens e dos comandos: `pt` (português) ou `en` (English) | o jogador | jogador e admin | Ajuda e painéis |
| `/screenfx` | Aplica efeitos na sua tela: embriaguez (`drunk`), ferimento (`injured`), flash de sangue (`hit`), cores em cinza (`grey`) e efeitos crus (`raw blur\|ghosting\|screenBlood`) | só você | só admin | Ajuda e painéis |
| `/ui` | Abre o painel de debug do gamemode, o mesmo da tecla F4: dados do seu personagem, do mundo, dos jogadores e a lista de comandos | só você | só admin | Ajuda e painéis |
| `/appearance` | Lê e muda a aparência do corpo: `info` (o que você veste), `who` (todos), `list` (nomes do catálogo), `set` (uma parte), `gender`, `random` e `reset` | você ou outro jogador (`@jogador`) | só admin | Personagem |
| `/cansaco` | Diz a sua energia (a barra **Energia** do painel) e a postura que o jogo vê: deitado, sentado ou de pé, com o número da postura (para conferir que uma cama ou um banco conta como descanso) | o jogador; o admin vê o de outro | jogador e admin | Personagem |
| `/cidadania` | (admin) Mostra as cidades e quantos cidadãos cada uma tem, ou define a cidadania de um jogador (`definir`, `limpar`, `ver`) | o jogador citado | só admin | Personagem |
| `/fogueiras` | As fogueiras dos caldeirões: todas acesas (padrão), acesas ao cozinhar, ou do jogo | todos | só admin | Personagem |
| `/cozinhar` | Junto de um fogo (cozinha), de um secador de açougueiro (seca) ou de um defumador (defuma), troca toda a comida que o lugar sabe fazer e que você leva pela comida pronta, uma por uma | o jogador | jogador e admin | Personagem |
| `/creator` | (admin) Abre o **criador de personagem**: uma tela do mod, à direita, com o corpo do jogador filmado de frente à esquerda. O jogador faz o personagem uma vez, na primeira entrada (a tela abre sozinha); depois só o admin abre | o jogador | só admin | Personagem |
| `/do` | Descreve a **cena** ou um detalhe dela (o que o ambiente mostra, o que se ouve, como está a porta): `/do A porta range ao abrir` | quem está a 30 m | jogador e admin | Personagem |
| `/fome` | Diz como está o seu estômago (bem alimentado, com fome, faminto) e o nível da fome do servidor | o jogador; o nível vale para todos | jogador e admin | Personagem |
| `/sede` | Diz como está a sua **sede** (a do servidor: o jogo não tem) e como matá-la; o admin liga e desliga a sede de todos e põe a sua num valor para ver o que ela faz | o jogador; o liga/desliga vale para todos | jogador e admin | Personagem |
| `/give` | Coloca itens no seu inventário, por GUID ou pelo nome exato entre aspas | só você | só admin | Personagem |
| `/guilda` | (admin) Mostra as guildas e quantos membros cada uma tem, muda a guilda de um jogador, ou a sua, à vontade, para testar (`entrar`, `sair`) | o jogador citado, ou você | só admin | Personagem |
| `/leitura` | Diz o livro de habilidade que você está lendo, quanto falta e o que já começou, larga o livro (`parar`; o que você leu fica guardado) e, para o admin, ajusta o ritmo da leitura (`fator`) | o jogador; o admin ajusta o ritmo de todos | jogador e admin | Personagem |
| `/lookalike` | Veste o mesmo visual (rosto, cabelo, barba, corpo) que outro jogador está usando | só você | só admin | Personagem |
| `/me` | Escreve no chat o que o **seu personagem faz**, em terceira pessoa, com o nome que os outros conhecem dele (quem ainda não foi apresentado vê "Desconhecido") | quem está a 30 m | jogador e admin | Personagem |
| `/outfit` | Veste um dos conjuntos de roupa do próprio jogo para o seu gênero (`random`, por nome, `list [filtro]`) | só você | só admin | Personagem |
| `/posicao` | Mostra onde um jogador nasce na próxima vez que entrar, ou apaga esse lugar com `limpar` | o jogador indicado (`@jogador`) | só admin | Personagem |
| `/preso` | **Fiquei preso**: leva você à igreja mais próxima de onde está, **uma vez a cada 60 minutos**, se o personagem ficou preso numa parede, numa pedra ou numa casa trancada | o jogador | jogador e admin | Personagem |
| `/acordar` | **Acordar** do desmaio da bebedeira, se a tela ficou preta: vale para quem caiu de bêbado e está caído há pelo menos 20 s (o servidor acorda sozinho em 45 s) | o jogador | jogador e admin | Personagem |
| `/paz` | Encerra o **duelo** em que você está, depois de 5 segundos sem golpes; o mapa e o inventário voltam. Um duelo também acaba sozinho 45 s depois do último golpe (15 s até o KCDC 1.7.1), e 5 s depois que um dos dois segura **U** (oferecer paz) sem golpe desde então | os seus duelos | jogador e admin | Personagem |
| `/socialstatus` | Lê ou define o **Status Socialis** (`plebeius` ou `nobilis`) mostrado no painel | você ou outro jogador (`@jogador`) | só admin | Personagem |
| `/sujeira` | Diz quanto o seu corpo está sujo, como o jogo o lê (a **sujeira**, o **cheiro** e o **sangue**), com a escala do próprio jogo (0,30 é um pouco, 0,60 é sujo, 0,90 é imundo) e onde se lavar | o jogador; o admin vê a de outro | jogador e admin | Personagem |
| `/take` | Tira itens do seu inventário (mesmos formatos do `/give`) | só você | só admin | Personagem |
| `/tp` | Leva você para o lado de outro jogador (nome ou slot, o número da lista da tecla Tab) ou para uma coordenada do mapa | só você | só admin | Personagem |
| `/try` | **Tenta** uma ação: ela dá certo ou falha ao acaso (50%), e quem está por perto vê o resultado: `/try arrombar a porta` | quem está a 30 m | jogador e admin | Personagem |
| `/levantar` | Levanta da cadeira ou da cama do World Builder em que você está, se as teclas de andar não levantaram | só você | jogador e admin | Personagem |
| `/dice` | Convida um oponente próximo para jogar dados e combinar a pontuação alvo (padrão 2000, passos de 500, de 100 a 100000) | você e outro jogador, perto de uma mesa de dados | jogador e admin | Voz e jogos entre jogadores |
| `/mute` | Silencia, só para você, a voz de outro jogador | só você | jogador e admin | Voz e jogos entre jogadores |
| `/mutes` | Lista os jogadores que você silenciou | só você | jogador e admin | Voz e jogos entre jogadores |
| `/unmute` | Volta a ouvir um jogador que você silenciou | só você | jogador e admin | Voz e jogos entre jogadores |
| `/animals` | Controla as populações de animais dos pontos de spawn do nível | seu mundo virtual | só admin | Mundo e ambiente |
| `/area` | Lista as áreas do nível (e as criadas por script) ao seu redor e as portas que uma área liga | só leitura | só admin | Mundo e ambiente |
| `/clima` | Mostra o dia, a hora, se é dia ou noite e quanto falta para virar, e o clima | **todos os jogadores** | só admin | Mundo e ambiente |
| `/door` | Lê (`near`, `list`), tranca, destranca, abre e fecha as portas do próprio nível, por GUID ou a mais próxima | estado compartilhado (todos veem) | só admin | Mundo e ambiente |
| `/gate` | Abre e fecha os portões de castelo: pontes levadiças, grades e portões de fortaleza (`toggle`, `open`, `close`, `list`) | estado compartilhado (todos veem) | só admin | Mundo e ambiente |
| `/objeto` | Tira do mundo, para todos e de vez, um objeto do próprio mapa (um portão que o jogo nunca abre, como o da frente de Malešov; uma cerca; entulho; a parede invisível de um portão de castelo), põe de volta (`esconder`, `devolver`), procura a parede invisível que ficou onde uma porta foi tirada (`portas`) e mostra o que há na frente de quem pergunta (`sondar`) | estado compartilhado (todos veem) | só admin | Mundo e ambiente |
| `/herbs` | Controla a rebrota das ervas: `time` (em segundos reais na velocidade atual do mundo; `0 0` desliga a rebrota por tempo), `defaults`, `respawn [raio]` e `respawn-all` refazem ervas já colhidas | `time`/`defaults`: servidor inteiro; `respawn`: seu mundo virtual | só admin | Mundo e ambiente |
| `/mural` | Abre o quadro de avisos que estiver perto de você (o mesmo que a tecla **F** no quadro); o admin lista os quadros e os cartazes, com quem os afixou, e retira cartazes | só você (retirar: o quadro) | jogador e admin (listar e retirar: só admin) | Mundo e ambiente |
| `/cartas` | (admin) As **cartas** da seção Cartas do painel: quantas há, as que um jogador mandou ou recebeu (com quem escreveu, mesmo sem assinatura) e apagar uma; nunca mostra o texto | as cartas citadas | só admin | Mundo e ambiente |
| `/tesouros` | (admin) Os **baús de tesouro** espalhados pelo mapa: `abastecer` (enche agora), `ligar`/`desligar` e `chance <n>` | o mundo | só admin | Mundo e ambiente |
| `/world` | Lê e define o relógio e o clima compartilhados: `scale` (velocidade do tempo, 0 a 200), `hour`, `day`, `weather` (predefinição e duração em segundos, até 21600), `rain` e `wind` (m/s, até 50) | **todos os jogadores** | só admin | Mundo e ambiente |
| `/blip` | Cria um ponto na bússola e no mapa de todos (ou só no seu, com `me`) | todos no mundo virtual (ou só você com `me`) | só admin | Objetos, marcadores e efeitos |
| `/build` | Como o `/prop`, mas o objeto é colocado onde você mira, com pré-visualização ao vivo | todos veem | só admin | Objetos, marcadores e efeitos |
| `/builder` | Liga ou desliga o seu acesso ao World Builder, o editor de mapas (tecla F7) | só você | só admin | Objetos, marcadores e efeitos |
| `/carry` | Faz você carregar um item nos braços (cesta, lenha, saco) ou deixa um no chão para ser pego pelo prompt do jogo (`prop`) | você | só admin | Objetos, marcadores e efeitos |
| `/chave` | Tranca ou destranca a porta, ou o baú, à sua frente se você tiver a chave dele no inventário ou o dono lhe tiver dado acesso | a porta ou o baú à sua frente | jogador e admin | Objetos, marcadores e efeitos |
| `/drop` | Deixa uma pilha de um item no chão, para qualquer um pegar | todos veem | só admin | Objetos, marcadores e efeitos |
| `/marker` | Coloca marcadores no mundo: um decalque projetado no chão ou uma forma (cilindro, esfera, seta, cubo, plano) com cor, tamanho, giro, flutuação e gatilho | todos veem | só admin | Objetos, marcadores e efeitos |
| `/prop` | Coloca no mundo uma peça do catálogo de objetos do jogo, construída em todos os clientes | todos veem | só admin | Objetos, marcadores e efeitos |
| `/propriedade` | Mapeia e administra as **propriedades**: casas, oficinas, tavernas e baús, cada uma com um nome, uma região, uma descrição, um dono e uma chave própria (um item novo, `kcdc-property:<id>`) | as portas e baús da propriedade; quem tem a chave destranca | só admin | Objetos, marcadores e efeitos |
| `/ladrao` | (admin) A **marca de ladrão**: quem está marcado, até quando e por quê; marcar ou perdoar alguém (também quem não está online). Quem **arromba 3 fechaduras** (portas, portões ou baús) de outros jogadores **em 3 dias** é marcado sozinho **por 1 dia**; de parente não conta | o jogador citado | só admin | Objetos, marcadores e efeitos |
| `/mortes` | (admin) Os **baús de morte**: o que caiu, quem levou, o que o dono perdeu; `devolver <n>` dá ao dono o que ele perdeu (na hora, ou na próxima entrada) | o dono do baú | só admin | Objetos, marcadores e efeitos |
| `/presos` | (admin) Quem está **algemado ou no pelourinho**, quem prendeu e quanto falta; `soltar <nome>` solta quem tiver o nome | o preso | só admin | Objetos, marcadores e efeitos |
| `/entrada` | (admin) A **porta do servidor** (29/10/2026): quem já passou nas dez perguntas de entrada; `aprovar <jogador ou Steam id>` aprova sem as perguntas, `zerar <jogador ou Steam id>` faz o jogador passar de novo | o jogador citado | só admin | Objetos, marcadores e efeitos |
| `/curar` | (admin) Estanca o **sangramento** (e fecha os ferimentos) de um jogador, ou cura **tudo**; quem não está no servidor é curado na próxima entrada | o jogador citado | só admin | Objetos, marcadores e efeitos |
| `/nivel` | (admin) Os níveis de um personagem (quem não está no servidor: os do arquivo) e a devolução do nível de uma trilha perdido: só sobe, sem pontos de talento | o personagem citado | só admin | Objetos, marcadores e efeitos |
| `/stash` | Baús: abre um estoque virtual só seu (`virtual`), cria contêineres e lê, tranca e destranca os baús do próprio nível (`near`, `lock`, `unlock`, `pick`, `key`, `goto`) | você / baús do mundo | só admin | Objetos, marcadores e efeitos |
| `/vfx` | Coloca efeitos de partículas das bibliotecas do jogo, fixos (`/vfx <efeito>`) ou de um disparo só (`burst`) | todos veem | só admin | Objetos, marcadores e efeitos |
| `/mobilia` | (admin) As **cadeiras e camas** das exportações do World Builder que aceitam o jogador, as mais perto de você, e o **ajuste** de onde o corpo fica nelas (`ajustar <campo> <valor>`) | todos que sentam e deitam nelas | só admin | Objetos, marcadores e efeitos |
| `/cachorro` | O cão de quem apoia o servidor: chama o seu cão para perto (se ele sumiu, vem de novo), dá um nome (`nome <nome>`, até 24 letras; sem nome ele volta ao nome do jogo) e dá ordens: `seguir`, `sentar` (ou `esperar`: senta e fica onde está até você chamar) e `solto`. O **E** diante do cão abre o menu *Fazer carinho*, *Mandar ficar* (ou *Mandar seguir*) e *Sair* | o seu cão | jogador e admin | Montarias, cães e carroças |
| `/carroca` | As suas **carroças**: onde estão, `trazer` (a vazia vem para a sua frente, a cada 2 minutos), `nome` (dar nome) | as suas carroças | jogador e admin | Montarias, cães e carroças |
| `/cart` | Cria carroças e carroções do jogo, cavalos incluídos, na sua frente (`list` mostra os modelos) | todos veem | só admin | Montarias, cães e carroças |
| `/cavalo` | Diz onde estão os seus cavalos (a quantos metros e em que direção) e chama o mais perto para vir correndo até você, se estiver a até 300 m | o seu cavalo | jogador e admin | Montarias, cães e carroças |
| `/dog` | Dá um cão a você, ou lê, renomeia e comanda o que você tem | seu cão; todos veem | só admin | Montarias, cães e carroças |
| `/horse` | Cria um cavalo seu por raça (`breeds`) ou por alma, e lê, renomeia, monta (`ride`), entrega a outro jogador (`give`), mata e reanima o cavalo perto de você | seu cavalo; todos veem | só admin | Montarias, cães e carroças |
| `/anim` | Navega pelas animações do próprio jogo e toca em você ou no NPC mais próximo, com os objetos que elas seguram na mão | você ou o NPC mais próximo | jogador e admin | NPCs, animações e conversas |
| `/bandidos` | Mostra os acampamentos de bandidos (quantos estão vivos e quantos baús cada um tem), leva você até um deles (`ir <n>`) ou traz de volta os mortos e enche os baús na hora (`repor`) | os acampamentos de bandidos; todos veem | só admin | NPCs, animações e conversas |
| `/dialogue` | Abre uma conversa de exemplo na lista de diálogo do próprio jogo | só você | só admin | NPCs, animações e conversas |
| `/emboscada` | Mostra se os salteadores das estradas estão ligados, quantas gangues estão na rua e o chão que o servidor leu sob os jogadores; liga e desliga (`liga`, `desliga`, salvo em `playerdata/ambush.json`) e manda uma gangue atrás de um jogador para testar (`agora [jogador]`) | salteadores nas estradas; todos veem | só admin | NPCs, animações e conversas |
| `/face` | Define uma expressão facial e faz a boca falar (`talk`, `quiet`) em você ou no NPC mais próximo (`npc ...`) | você ou o NPC mais próximo | jogador e admin | NPCs, animações e conversas |
| `/gesto` | Lista os gestos da roda do **G** e liga ou desliga um deles, sem reiniciar (`lista`, `desligar <número>`, `ligar <número>`) | todos os jogadores | só admin | NPCs, animações e conversas |
| `/mestres` | Lista os **barbeiros** (os mestres NPC de habilidades foram **removidos em 29/10/2026**), onde cada um fica, e leva você até um deles (`ir <id>`) | os barbeiros e os mestres; só admin lista e visita | só admin | NPCs, animações e conversas |
| `/npc` | Cria NPCs do servidor por papel (`roles`) ou alma e dá ordens: seguir, patrulhar, vir, esperar (`hold`), falar (`say`), trocar a locomoção (`native` é a do jogo, `kinematic` é movida pelo servidor), `kill\|revive`, `pin\|unpin`, `remove\|clear` | servidor (todos veem) | só admin | NPCs, animações e conversas |
| `/npcdemo` | Arranjos prontos de NPCs: caçador experimental, posto de guarda, patrulha em quadrado, escolta, multidão, cena roteirizada e teste de locomoção nativa | servidor (todos veem) | só admin | NPCs, animações e conversas |
| `/patrol` | Lista as rotas do World Builder, valida uma (`validate`) e a atribui a NPCs próximos (`start`, `stop`, `status`) | servidor | só admin | NPCs, animações e conversas |
| `/quest` | Escreve uma missão no diário do jogo e a faz avançar: `give <chave> "<título>" [tipo]`, `desc`, `step` (objetivo), `done <chave> <índice>`, `state` (active, done, failed), `list`, `show`, `remove`, `clear` | só você | só admin | NPCs, animações e conversas |
| `/vendedor` | (**desligado desde 29/10/2026**: os NPCs vendedores foram removidos) Mostra e posiciona os NPCs vendedores do servidor: cinco ofícios (ferreiro, boticário, taberneiro, caçador e alfaiate) em Suchdol, e 13 mascates, um em cada fogueira de beira de estrada do nível | os NPCs vendedores; todos veem | só admin | NPCs, animações e conversas |
| `/mercador` | (admin) Mostra e posiciona os **comerciantes de guilda** (um para cada guilda em cada cidade, 128 em 16 cidades, parados onde o jogo põe o ofício; só existem de dia): `listar [cidade]`, `aqui <id>`, `padrao [id]` | os comerciantes de guilda; todos veem | só admin | NPCs, animações e conversas |
| `/barbeiro` | Os barbeiros: onde estão, e para pôr um onde você está (fica guardado); a seção NPCs (F3) mostra o comando de cada um | o barbeiro | só admin | Mundo e ambiente |
| `/desgaste` | (admin) Mostra e muda **quanto do desgaste** que o jogo põe nos itens (armas, armaduras, ferramentas) continua valendo: 5 a 100%, 55% por padrão | todos os jogadores | só admin | Personagem |
| `/vendor` | Abre a tela de comércio do próprio jogo com preços definidos pelo servidor | só você | só admin | NPCs, animações e conversas |
| `/viagem` | (admin) As **paradas da viagem rápida de carroça**: onde estão as carroças e os cocheiros, o **preço** (`preco <base> <por km>`), e para mudar de lugar (`aqui`, `cocheiro`, `procurar`, `malha`), visitar (`ir`), criar (`nova`) e tirar (`remover`) | as paradas e quem viaja | só admin | NPCs, animações e conversas |
| `/crafttest` | Teste das bancadas de ofício: confere a posição das estações de alquimia e ferraria (`alchemy`, `smithing`), dá ingredientes de teste e ensina as receitas | só você | só admin | Ofícios e itens |
| `/oficios` | (admin) Usar só as ferramentas da sua guilda, como um jogador (`guilda`), ou as de todos os ofícios (`livre`) | só você | só admin | Ofícios e itens |
| `/coleta` | (admin) A guilda dos **Coletores**: as regras do machado e da picareta, o que o jogo diz que está para onde você olha (árvore, pedra), um machado e uma picareta para testar, e toda árvore e pedra dando de novo | só você, ou o jogador citado (`kit`) | só admin | Ofícios e itens |
| `/horta` | As hortas dos Agricultores: o que você plantou e quando fica pronto, as cinco hortas mais perto; (admin) toda plantação pronta na hora, os canteiros esvaziados, e canteiros marcados à mão onde o nível não tem fileira | só você (`crescer` e `limpar`, todos) | jogador e admin (`crescer` e `limpar`, só admin) | Ofícios e itens |
| `/selvagens` | (admin) Os cavalos selvagens dos campos abertos: quantos há, os mais perto com a confiança deles em você, a confiança posta para testar a doma, e os campos repovoados | só você | só admin | Ofícios e itens |
| `/oficinas` | (admin) As forjas e mesas de alquimia que o nível tem, com a distância e quem está nelas | só você | só admin | Ofícios e itens |
| `/conjunto` | (admin) Os **conjuntos de armadura** do jogo por vila, cidade ou senhor e os **pacotes de brasão** de cada casa, com o casaco com o brasão, o escudo e a espada do cavaleiro (`ARMADURAS.md`): lista, mostra um, entrega as peças ou veste o conjunto | o jogador citado | só admin | Ofícios e itens |
| `/customitems` | Prepara itens personalizados para teste | só você | só admin | Ofícios e itens |
| `/pot` | Panelões de comida: inspeciona (`/pot`), lista receitas, reabastece gastando comida do inventário (`refill porridge\|vegetable\|meat`), lista os seus venenos e envenena (`poison <linha>`) | panelão próximo | só admin | Ofícios e itens |
| `/siege` | Constrói, carrega e dispara trabucos e canhões (`trebuchet`, `cannon`) | servidor (todos veem) | só admin | Cerco |
| `/blipdemo` | Coloca um de cada tipo de blip ao seu redor, mais um que gira, para conferir a bússola e o mapa | todos no mundo virtual | só admin | Diversão e testes |
| `/disguise` | Desenha você, ou outro jogador, como um objeto do catálogo (`barrel_a`, `crate_box_a`...) | você ou outro jogador (`@jogador`) | só admin | Diversão e testes |
| `/invisible` | Para de desenhar você, ou outro jogador, em qualquer lugar: corpo, roupas e o que está na mão | você ou outro jogador (`@jogador`) | só admin | Diversão e testes |
| `/pick` | Traça uma linha da sua mira e diz o que ela encontrou, inclusive qual jogador, disfarçado ou não | só você | só admin | Diversão e testes |

## Ajuda e painéis

### `/admin`

Vira administrador, até sair do servidor, apresentando um ticket de admin depois de já estar dentro. É o caminho para quem entra pelo menu do jogo, que não tem campo para o ticket. O ticket é conferido como na entrada, com o mesmo limite de 8 erros por endereço em 10 minutos. **`/admin sair` faz o caminho de volta:** você vira jogador comum até sair do servidor (para testar como um jogador vê o servidor); o ticket devolve o admin.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Nota:** O que você digita aparece no seu chat, na sua tela: cuidado ao gravar ou transmitir. Um ticket de jogador não muda nada.
- **Código:** `src/server/commands/admin.ts`, com apoio em `src/server/auth.ts`, `src/server/status.ts`
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/admin <ticket>  -- o ticket de admin, inteiro, no formato nome.segredo
/admin sair  -- volta a ser jogador comum até sair do servidor (o ticket devolve o admin)
```

### `/book`

Abre livros de demonstração nas suas mãos: a crônica do Kingdoms Connected, uma carta de arauto e uma versão em que a tinta aparece aos poucos.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Base para cartas, editais e livros de lore (o texto vem do servidor).
- **Código:** `src/server/commands/book.ts`
- **No jogador:** `player.emit`
- **Para ler mais** (pasta `docs/guides`): `User interface/books.md`, `Tutorials/custom-letter.md`

```text
/book [book|plainBook|letter]  -- the chronicle of Kingdoms Connected, in that binding
/book letter                   -- a herald's letter, on folded parchment
/book fade                     -- the chronicle starting illegible, its ink coming clear a tenth at a time
/book legibility <0..1>        -- changes how legible the open book is
/book close                    -- puts the book down
/book status                   -- whether a book is open
```

### `/camera`

Alterna a sua câmera entre primeira pessoa e uma câmera atrás de você (`third [distância]`). `shot` roda uma cena curta de câmera ao seu redor.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Nota:** É a mesma escolha da seção **Opções** do painel, e fica salva do mesmo jeito: vale nas próximas entradas.
- **Código:** `src/server/commands/camera.ts`
- **API do motor que usa:** `Camera.setShot`, `Camera.clearShot`
- **No jogador:** `player.emit`, `player.position`
- **Para ler mais** (pasta `docs/guides`): `Client scripting/camera.md`, `Client scripting/camera-shots.md`

```text
/camera                      -- flips between first and third person
/camera third [distance]     -- behind you, 3.5 m back unless told otherwise
/camera first                -- back to the game's own camera
/camera shot                 -- a short cutscene around you: cut, two glides, glide back
/camera shot stop            -- your own view back at once
```

### `/help`

Lista os comandos que o servidor atende. `/help <comando>` mostra todas as formas de uso daquele comando.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Nota:** A lista sai do registro de comandos: um comando novo aparece sozinho aqui.
- **Código:** `src/server/commands/help.ts`, com apoio em `src/server/auth.ts`
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/help
/help <command>
```

### `/hud`

Esconde e mostra elementos do HUD nativo do jogo no seu cliente (padrão: a barra `Stats`). É uma ferramenta de teste; o console do servidor tem também `hudspawn on|off|status`.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Útil quando quisermos trocar o HUD nativo por um HUD nosso.
- **Código:** `src/server/commands/hud.ts`
- **No jogador:** `player.emit`
- **Para ler mais** (pasta `docs/guides`): `User interface/hud.md`

```text
/hud hide [element]   -- suppress Stats, or the named element
/hud show [element]   -- release suppression; the game decides when it appears
/hud status [element] -- report the multiplayer permission, not visible pixels
/hud list             -- list accepted element names
/hud reset            -- release hides made by this demo's HUD commands
```

### `/idioma`

Escolhe o **idioma** do painel, das mensagens e dos comandos: `pt` (português) ou `en` (English). A escolha fica salva por Steam ID. Também responde por `/language`, e o mesmo botão está na seção **Opções** do painel.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador
- **Nota:** O painel se traduz sozinho com um dicionário que o servidor manda para quem escolheu inglês (não pesa no pacote do cliente); o chat e os avisos passam pelo mesmo dicionário. O que o dicionário não conhece aparece em português, como está escrito.
- **Código:** `src/server/commands/idioma.ts`, com apoio em `src/server/language-panel.ts`, `src/server/language.ts`
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/idioma  -- mostra o idioma de agora
/idioma pt  -- português
/idioma en  -- English (panel, messages and commands)
```

### `/screenfx`

Aplica efeitos na sua tela: embriaguez (`drunk`), ferimento (`injured`), flash de sangue (`hit`), cores em cinza (`grey`) e efeitos crus (`raw blur|ghosting|screenBlood`).

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Base para embriaguez, dor e tontura de verdade.
- **Código:** `src/server/commands/screenfx.ts`
- **No jogador:** `player.emit`
- **Para ler mais** (pasta `docs/guides`): `Client scripting/screen-effects.md`

```text
/screenfx drunk [0-1]              -- the intoxication example at that level, 0 to sober up
/screenfx injured [0-1]            -- the injury example at that level, 0 to heal
/screenfx hit                      -- one flash of blood, as a hit would
/screenfx grey [0-2]               -- a colour grade at that saturation, 0 being grey
/screenfx raw <blur|ghosting|screenBlood> [0-1]
/screenfx clear                    -- takes every effect from this command off
/screenfx list                     -- every effect and its parameters, in the client console
```

### `/ui`

Abre o painel de debug do gamemode, o mesmo da tecla F4: dados do seu personagem, do mundo, dos jogadores e a lista de comandos.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** **Só admin**, como a tecla F4: o painel mostra a lista de jogadores e de comandos do servidor. O servidor decide (`src/server/panel.ts`), não o cliente. Desde 02/11/2026 a lista de jogadores é **você e os 40 mais perto**, com quantos há no servidor, e a mensagem vai em partes (`emitLarge`): só a lista de comandos já tinha uns 40 KB, acima dos ~29 KB que o cliente lê numa mensagem, e com 512 jogadores seriam uns 130 KB a cada consulta.
- **Código:** `src/server/commands/ui.ts`, com apoio em `src/server/panel.ts`
- **Para ler mais** (pasta `docs/guides`): `Tutorials/game-panel.md`

```text
/ui
```

## Personagem

### `/appearance`

Lê e muda a aparência do corpo: `info` (o que você veste), `who` (todos), `list` (nomes do catálogo), `set` (uma parte), `gender`, `random` e `reset`.

- **Quem pode usar:** só admin
- **Quem é afetado:** você ou outro jogador (`@jogador`)
- **Nota:** Mudanças feitas aqui **não são salvas**; só o `/creator` salva. Nos primeiros ~36 s depois de entrar, o servidor reaplica o visual salvo e pode desfazer o que você mudou.
- **Código:** `src/server/commands/appearance.ts`, com apoio em `src/server/players.ts` (o mesmo arquivo implementa também `/lookalike`)
- **API do motor que usa:** `Appearances.beards`, `Appearances.options`, `Player.all`, `Appearances.find`, `Appearances.random`
- **No jogador:** `player.appearance`, `player.setAppearance`
- **Para ler mais** (pasta `docs/guides`): `Players/appearance.md`, `Resources/appearance.md`, `Resources/beards.md`

```text
/appearance [info] -- what you are wearing
/appearance who -- what everyone is wearing
/appearance list <head|hair|beard|body> [filter] [male|female]
/appearance set <head|hair|beard|body> <name|->
/appearance gender <male|female>
/appearance random [male|female]
/appearance reset
Add @<player> to any of the last four to aim it at somebody else.
```

### `/cansaco`

Diz a sua energia (a barra **Energia** do painel) e a postura que o jogo vê: deitado, sentado ou de pé, com o número da postura (para conferir que uma cama ou um banco conta como descanso). O admin vê a de outro jogador (`/cansaco @jogador`).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador; o admin vê o de outro
- **Nota:** Deitado, a energia volta toda em 12 minutos; sentado, em 30; de pé, cai até 5% em 4 horas. Veja [Cansaço](#cansaço).
- **Código:** `src/server/commands/cansaco.ts`, com apoio em `src/server/auth.ts`, `src/server/fatigue.ts`, `src/server/players.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/stats.md`

```text
/cansaco  -- a sua energia, e a postura que o jogo vê
/cansaco @jogador  -- (admin) a de outro jogador
```

### `/cidadania`

(admin) Mostra as cidades e quantos cidadãos cada uma tem, ou define a cidadania de um jogador (`definir`, `limpar`, `ver`). Desde 09/11/2026 **não há mais a seção Cidadania no painel**: o jogador não tem mais onde escolher a sua; o administrador a define com `definir`.

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** Cinco cidades, a sede de cada casa (Suchdol, Raborsch, Malešov, Kuttenberg e Pschitoky), e as terras que cada uma manda, que também são cidadania: Wysoka (de Suchdol), Bohunowitz e Horschan (de Raborsch), Bylany (de Malešov), Stará Kutná (de Kuttenberg) e Miskowitz (de Pschitoky); a terra usa o brasão da sede, marcada como Terra, e quem manda na sede manda nas terras. Quem é cidadão acorda na sua cidade ou terra quando morre (na igreja, onde há: Suchdol, Raborsch, São Tiago em Kuttenberg, Wysoka e Stará Kutná; senão na praça ou junto das lojas da vila); sem cidadania, acorda nas igrejas. A primeira troca de cidadania (e a de guilda) é grátis; cada troca depois custa 100 moedas, tiradas da bolsa. O senhor das terras (o jogador a quem a região foi cedida) também depõe a cidadania, na mesma seção.
- **Código:** `src/server/commands/cidadania.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/citizenship.ts`, `src/server/players.ts`
- **No jogador:** `player.steamId`

```text
/cidadania  -- as cidades e quantos cidadãos cada uma tem
/cidadania ver <jogador>  -- a cidade dele
/cidadania definir <jogador> <cidade>  -- faz dele cidadão da cidade ou terra (sedes: suchdol, raborsch, malesov, kuttenberg, pschitoky; terras: wysoka, bohunowitz, horschan, bylany, stara-kutna, miskowitz)
/cidadania limpar <jogador>  -- tira a cidadania, para que ele escolha de novo
```

### `/cozinhar`

Junto de um fogo (cozinha), de um secador de açougueiro (seca) ou de um defumador (defuma), troca toda a comida que o lugar sabe fazer e que você leva pela comida pronta, uma por uma. O **Usar** do inventário numa carne ou peixe crus faz o mesmo para o monte em que você apertou. Junto do lugar também aparece a dica **Cozinhar / Secar / Defumar** na tecla de interação (no fogo é o **F**; o E do fogo é do jogo), que abre um menu **Cozinhar ou Sair** e, em **Cozinhar**, a lista do que você leva que o lugar sabe fazer (uma escolha para cada comida e uma para tudo).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador
- **Nota:** O cozinhar, secar e defumar do jogo acontecem na máquina do jogador e o multiplayer não os leva ao servidor, então a carne crua ficava e a pronta nunca chegava à bolsa. Veja [Cozinhar, secar e defumar](#cozinhar-secar-e-defumar).
- **Código:** `src/server/commands/cozinhar.ts`, com apoio em `src/server/cooking.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/inventory.md`

```text
/cozinhar  -- no fogo, tudo o que é cru vira cozido; no secador, o que pode virar seco; no defumador, o defumado. O "Usar" de uma carne ou peixe no inventário faz o mesmo para o monte em que você apertou
```

### `/fogueiras`

As fogueiras dos caldeirões (as panelas de ensopado do mapa) e como ficam (2026-11-02). Por padrão, **todas acesas**, dia e noite, para todos: o servidor acende o fogo de cada caldeirão para todos os jogadores, e o jogo deixa de apagá-lo. **cozinhar**: o caldeirão acende quando alguém cozinha nele (o *Cozinhar* do fogo ou uma receita da Cozinha) e volta a ser do jogo 10 minutos depois. **jogo**: como era antes, cada jogo acende e apaga sozinho.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos (as fogueiras de todos os caldeirões)
- **Nota:** a escolha fica guardada em `playerdata/pot-fires.json` e vale no próximo início.
- **Código:** `src/server/commands/fogueiras.ts`, com apoio em `src/server/pot-fires.ts`, `src/server/cooking.ts`, `src/server/craft.ts`

```text
/fogueiras  -- como as fogueiras dos caldeirões estão
/fogueiras todas  -- todas acesas, dia e noite, para todos
/fogueiras cozinhar  -- acendem quando alguém cozinha nelas, por 10 minutos
/fogueiras jogo  -- do jogo de cada um, como no jogo sozinho
```

### `/creator`

Abre o **criador de personagem**: uma tela do mod, à direita, com o corpo do jogador filmado de frente à esquerda. Escolhe-se o sexo (**Vir** ou **Femina**), o cabelo e a cor (círculos), o rosto, a barba, a pele, o **primeiro nome** e, se quiser, uma **alcunha**; **Salvar e criar** guarda tudo por Steam ID em `playerdata/characters.json`. `nativo` abre o criador do próprio jogo, que não tem nome nem alcunha; `stop` fecha o criador aberto; `camera` (admin) ajusta o enquadramento sem novo deploy.

- **Quem pode usar:** só admin (desde 20/10/2026: *"/creator é só admin que pode usar"*; antes era de todos)
- **Quem é afetado:** o jogador
- **Nota:** **Quem entra pela primeira vez é obrigado a criar o personagem e dar um nome**: a tela abre sozinha (`src/server/first-join.ts`), sem botão de fechar e sem Esc, e o `stop` é recusado; isso não depende do comando. Depois, só um admin abre o `/creator` e sai quando quiser: o visual volta ao que era. O que um jogador ainda muda sozinho é no barbeiro e no alfaiate. Veja a seção [Criação de personagem](#criação-de-personagem).
- **Código:** `src/server/commands/creator.ts`, com apoio em `src/server/characters.ts`, `src/server/creator.ts`, `src/server/auth.ts`, `src/server/kits.ts`
- **No jogador:** `player.emit`, `player.steamId`, `player.setAppearance`
- **Para ler mais** (pasta `docs/guides`): `User interface/character-creator.md`, `User interface/web-views.md`, `Client scripting/camera-shots.md`, `Players/appearance.md`

```text
/creator [male|female|both]
/creator nativo [male|female|both]
/creator stop
/creator camera [distancia] [figura] [fov] [altura] [luz]  (admin)
/creator camera padrao  (admin)
/creator refazer [jogador]  (admin) -- o jogador refaz o personagem: agora, se estiver no servidor, ou na próxima entrada; sem nome, lista quem está esperando
```

- **Refazer (admin).** `/creator refazer <jogador>` (pelo nome do personagem, o apelido ou o Steam id) marca o personagem para ser feito de novo: o criador abre **obrigatório** (sem fechar) na próxima entrada, com o nome atual já escrito e **livre para mudar**. O inventário, a progressão, a família e o resto ficam como estão; só o visual, o nome e a alcunha são escolhidos de novo. Usado em 18/10/2026 para o Vavřinec (conta Garcia).

### `/do`

Descreve a **cena** ou um detalhe dela (o que o ambiente mostra, o que se ouve, como está a porta): `/do A porta range ao abrir`.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** quem está a 30 m
- **Nota:** Mesma regra do `/me`: 30 m, nomes por apresentação, 240 letras.
- **Código:** `src/server/commands/roleplay.ts`, com apoio em `src/server/roleplay.ts` (o mesmo arquivo implementa também `/me`, `/try`)
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/do <cena>  -- ex.: /do A porta range ao abrir
```

### `/fome`

Diz como está o seu estômago (bem alimentado, com fome, faminto) e o nível da fome do servidor. O admin muda o nível: `desligada`, `leve` (um estômago cheio dura 5 h de jogo), `media` (3 h, o padrão) ou `forte` (1 h 40).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador; o nível vale para todos
- **Nota:** O servidor desconta a fome a cada 15 segundos, em tempo real, de quem está jogando; veja a seção [Fome](#fome).
- **Código:** `src/server/commands/fome.ts`, com apoio em `src/server/auth.ts`, `src/server/hunger.ts`
- **No jogador:** `player.maxHunger`, `player.hunger`
- **Para ler mais** (pasta `docs/guides`): `Players/stats.md`, `Players/restoring-stats.md`

```text
/fome  -- como está o seu estômago e o nível da fome do servidor
/fome nivel <desligada|leve|media|forte>  -- (admin) muda o nível de fome de todos
/fome pausa <ligar|desligar>  -- (admin) a pausa mantém a saciedade de todos em 100%; desligá-la faz a fome valer de novo
```

### `/sede`

Diz como está a sua **sede**. O jogo não tem sede; o servidor tem (20/10/2026: *"ativar sede e beber água no rio, e a sede no painel Personagem e nas outras telas que mostram dados de players"*). Um corpo saciado leva **2 h 30 de jogo** para ficar seco, e a água, o leite, a cerveja, o vinho e o hidromel matam a sede; ou se bebe **no rio**: perto da água, mirando nela, aparece **[F] Beber água** (o F, não o E, que é do cavalo, das portas e dos fogos). O admin liga e desliga a sede de todos e pode pôr a sua num valor, para ver o que ela faz em cada passo. Veja a seção [Sede](#sede).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador; o liga/desliga vale para todos
- **Nota:** A sede é guardada por Steam ID (`playerdata/thirst.json`): quem sai e volta não volta saciado, e quem morre volta com um gole (60%).
- **Código:** `src/server/commands/sede.ts`, com apoio em `src/server/thirst.ts`, `src/server/drink-data.ts` (feito por `tools/make-drinks.py` das tabelas do jogo) e, no cliente, `src/client/thirst.ts`
- **No jogador:** `player.addBuff`, `player.removeBuff`, `player.setHealth`, `player.playAnimation`, o evento `playerConsumed`, `Buffs.register`

```text
/sede  -- como está a sua sede e como matá-la
/sede <ligar|desligar>  -- (admin) liga ou desliga a sede de todos
/sede definir <0 a 100>  -- (admin) põe a sua própria sede nesse valor, para ver o que ela faz em cada passo
```

### `/give`

Coloca itens no seu inventário, por GUID ou pelo nome exato entre aspas. Quantidade de 1 a 10000, qualidade de 1 a 4.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Os códigos de todas as armaduras, roupas, armas, acessórios e brasões do jogo, com preço, peso e qualidade, estão em [ITENS.md](ITENS.md).
- **Código:** `src/server/commands/give.ts`, com apoio em `src/server/args.ts`
- **API do motor que usa:** `Inventory.add`
- **Para ler mais** (pasta `docs/guides`): `Players/items.md`, `Players/inventory.md`, `Resources/items.md`

```text
/give <GUID|"exact item name"> [amount] [quality 1-4]
```

### `/guilda`

(admin) Mostra as guildas e quantos membros cada uma tem, ou muda a guilda de um jogador. A primeira troca de guilda é grátis para o jogador, no painel; cada troca depois custa 100 moedas, tiradas da bolsa (um administrador também desfaz a escolha, `limpar`). O botão **Ver membros** da seção Guildas é só dos administradores. **O administrador troca a própria guilda quantas vezes quiser**, para testar os ofícios: `/guilda entrar <guilda>` (e `sair`), ou o botão **Trocar (admin)** na seção Guildas do painel (F2). Com guilda, o admin obedece às ferramentas dela, como um jogador; `/oficios livre` libera todas.

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** A seção Guildas do painel também tem **Ver membros**: a lista da guilda na ordem da hierarquia do reino, dez por página, com os nomes que o jogador pode ler.
- **Código:** `src/server/commands/guilda.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/players.ts`, `src/server/status.ts`
- **No jogador:** `player.steamId`

```text
/guilda  -- as guildas e quantos membros cada uma tem
/guilda entrar <guilda>  -- você entra na guilda na hora, e troca de uma para outra quantas vezes quiser (para testar)
/guilda sair  -- você sai da sua guilda
/guilda ver <jogador>  -- a guilda dele
/guilda definir <jogador> <guilda>  -- põe o jogador na guilda (id, ofício ou nome latino)
/guilda limpar <jogador>  -- tira o jogador da guilda, para que ele escolha de novo
```

### `/leitura`

Diz o livro de habilidade que você está lendo, quanto falta e o que já começou, larga o livro (`parar`; o que você leu fica guardado) e, para o admin, ajusta o ritmo da leitura (`fator`).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador; o admin ajusta o ritmo de todos
- **Nota:** Os livros de habilidade (a espada, a lança, a alquimia, a eloquência...) não se leem pelo "Ler" do jogo, que pula o relógio e trava o servidor: o servidor abre o livro na tela (a tela de livro do próprio jogo, com o inventário fechado) e conta a leitura, no ritmo do relógio do mundo, enquanto ele fica aberto; no fim dá a experiência. Veja [Livros de habilidade](#livros-de-habilidade).
- **Código:** `src/server/commands/leitura.ts`, com apoio em `src/server/auth.ts`, `src/server/skillbooks.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/progression.md`, `Players/inventory.md`

```text
/leitura  -- o que você está lendo, quanto falta e o que já começou
/leitura parar  -- larga o livro (o que você leu fica guardado)
/leitura fator <0.02-2>  -- (admin) quanto das horas de cada livro precisa passar no relógio do mundo; 1 é por inteiro
```

### `/lookalike`

Veste o mesmo visual (rosto, cabelo, barba, corpo) que outro jogador está usando.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Não copia roupas; roupa é inventário.
- **Código:** `src/server/commands/appearance.ts`, com apoio em `src/server/players.ts` (o mesmo arquivo implementa também `/appearance`)
- **API do motor que usa:** `Appearances.beards`, `Appearances.options`, `Player.all`, `Appearances.find`, `Appearances.random`
- **No jogador:** `player.appearance`, `player.setAppearance`
- **Para ler mais** (pasta `docs/guides`): `Players/appearance.md`

```text
/lookalike <player|slot>
```

### `/me`

Escreve no chat o que o **seu personagem faz**, em terceira pessoa, com o nome que os outros conhecem dele (quem ainda não foi apresentado vê "Desconhecido"). Cor própria, até 240 letras.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** quem está a 30 m
- **Nota:** É a ação de RP: `/me saca a espada devagar` aparece para quem está por perto como *Dorota saca a espada devagar*.
- **Código:** `src/server/commands/roleplay.ts`, com apoio em `src/server/roleplay.ts` (o mesmo arquivo implementa também `/do`, `/try`)
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/me <ação>  -- ex.: /me saca a espada devagar
```

### `/outfit`

Veste um dos conjuntos de roupa do próprio jogo para o seu gênero (`random`, por nome, `list [filtro]`). As roupas antigas ficam no inventário.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Repetir o comando pode acumular peças de roupa.
- **Código:** `src/server/commands/outfit.ts`
- **API do motor que usa:** `Player.outfitPresets`
- **No jogador:** `player.appearance`, `player.setOutfit`
- **Para ler mais** (pasta `docs/guides`): `Players/appearance.md`

```text
/outfit random
/outfit <preset>
/outfit list [filter]
```

### `/posicao`

Mostra onde um jogador nasce na próxima vez que entrar, ou apaga esse lugar com `limpar`. Quem entra é colocado de volta onde estava ao sair (veja Conceitos); `limpar` é a saída para quem ficou preso num lugar ruim: ele volta a nascer no ponto inicial do mapa e nada mais é salvo dele até entrar de novo.

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador indicado (`@jogador`)
- **Nota:** Se o jogador está conectado e preso, use `limpar` nele e peça que reconecte.
- **Código:** `src/server/commands/posicao.ts`, com apoio em `src/server/position.ts`, `src/server/players.ts`
- **No jogador:** `player.steamId`
- **Para ler mais** (pasta `docs/guides`): `Players/join-and-spawn.md`

```text
/posicao [@jogador]         -- onde ele nasce da próxima vez que entrar
/posicao limpar [@jogador]  -- ele volta a nascer no ponto inicial do mapa; serve para quem ficou preso
```

### `/paz`

Encerra o duelo em que você está, se já passaram **5 segundos sem golpes** (no meio de uma troca de golpes ele recusa). Pedido de 19/10/2026: depois de um duelo, Radovan não conseguia abrir o mapa nem o inventário, "mesmo encerrando o duelo".

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** os seus duelos
- **Nota:** Segurar **U** oferece paz; o outro segura **U** para aceitar. Desde 19/10/2026 a oferta já basta: 5 segundos sem golpes depois dela e o duelo acaba. Sem oferta, acaba 45 segundos depois do último golpe (eram 15 até o KCDC 1.7.1, que passou o padrão para 45 para segurar a guarda, rodear e fintar sem encerrar o duelo). Qualquer golpe (mesmo um que erre) retira a oferta. O começo, as ofertas, os aceites atrasados e o fim de cada duelo aparecem no registro do servidor (`combat:`).
- **Duelo combinado:** um [duelo](#duelo) feito pelo menu do E também se cancela quando a luta do jogo acaba, por paz, por `/paz` ou pelos 45 segundos.
- **Código:** `src/server/commands/paz.ts`, com apoio em `src/server/combat.ts`

```text
/paz  -- encerra os seus duelos parados (sem golpes há 5 segundos)
```

### `/preso`

**Fiquei preso**: leva você à igreja mais próxima de onde está, **uma vez a cada 60 minutos**, se o personagem ficou preso numa parede, numa pedra ou numa casa trancada. O mesmo botão está na seção **Opções** do painel, com o aviso de quando volta a estar disponível.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador
- **Nota:** Não vale para quem está morto (acorda numa igreja de qualquer jeito) e o último uso fica guardado por Steam ID: reiniciar o servidor ou entrar de novo não devolve o tempo. Se foi alguém que trancou a porta, o melhor é pedir a chave.
- **Código:** `src/server/commands/preso.ts`, com apoio em `src/server/stuck.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/join-and-spawn.md`

```text
/preso  -- se você ficou preso no cenário ou numa casa trancada: vai para a igreja mais próxima (uma vez por hora)
```

### `/acordar`

**Acordar do desmaio** (25/10/2026: *quando um jogador fica bêbado e desmaia, ele fica preso na tela preta e só volta depois de sair e voltar do jogo*). Os efeitos do jogo correm pelo relógio de cada cliente e a cena que o desmaio tocaria é cortada no multijogador, então nada encerrava o desmaio: o corpo ficava caído e a tela preta até o jogador sair. Agora o servidor olha a consciência de cada jogador a cada 2 s (`player.consciousness`, 0 é desmaiado): quem está caído **de bêbado** há **45 s** é acordado (o servidor tira as famílias de efeito `unconscious` e `alcohol_drunk`, senão a bebida derruba de novo); quem caiu por **outro motivo** (um golpe, uma queda) só é acordado se ficar caído **150 s**, porque um nocaute de luta é da luta. Se continuar caído, tenta de novo a cada 15 s, e da terceira vez dá também a cura do próprio jogo. O `/acordar` faz o mesmo na hora, para quem caiu **de bêbado** há pelo menos **20 s**; quem foi derrubado não acorda por comando.

**No mesmo lugar** (01/11/2026: *quando um jogador beber demais e desmaiar ele deve acordar no mesmo local que desmaiou*): o servidor guarda onde o corpo caiu (ou onde estava de pé um instante antes, se o jogo levou o corpo para longe ao cair; um corpo arrastado alguns metros enquanto está caído é seguido). Quem caiu **de bêbado** e volta a si a mais de **3 m** desse lugar é posto de volta lá; quem foi derrubado numa luta não é movido. O servidor também tira pelo nome os efeitos do desmaio da bebida, `unconscious_alcohol` e `drunkenness` (o Václav ficou 643 s caído, em 37 tentativas: tirar as famílias não acordava esse desmaio). O log diz `faint: Fulano acordou a N m de onde caiu: posto de volta lá`. **Não verificado no jogo:** para onde o jogo leva o corpo e se o teleporte na hora de acordar não briga com a cena do jogo.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador
- **Nota:** O log diz `faint: Fulano caiu de bêbado; embriaguez 0,92, efeitos: ...` quando alguém cai (com os efeitos que o jogo dele tinha, para sabermos qual segura o corpo), `faint: ... acordando, tentativa N` e `faint: Fulano voltou a si depois de N s`. Não grava nada nos dados do jogador. **Ainda não testado no jogo:** se a tela preta é mesmo o desmaio que o servidor vê (consciência 0); se o log não mostrar `caiu de bêbado` quando acontecer, a tela preta é outra coisa, e os efeitos que o log escrever dizem qual.
- **Código:** `src/server/commands/acordar.ts`, com apoio em `src/server/faint.ts`

```text
/acordar  -- se você desmaiou de bêbado e a tela não volta: acorda você, depois de 20 s caído (sozinho, o servidor acorda em 45 s)
```

### `/socialstatus`

Lê ou define o **Status Socialis** (`plebeius` ou `nobilis`) mostrado no painel.

- **Quem pode usar:** só admin
- **Quem é afetado:** você ou outro jogador (`@jogador`)
- **Nota:** É só de admin, então ninguém se promove sozinho; a regra de como alguém vira nobre no jogo ainda não existe. Salvo em `playerdata/social.json`.
- **Código:** `src/server/commands/socialstatus.ts`, com apoio em `src/server/players.ts`, `src/server/status.ts`
- **No jogador:** `player.steamId`

```text
/socialstatus [@player]
/socialstatus <plebeius|nobilis> [@player]
```

### `/sujeira`

Diz quanto o seu corpo está sujo, como o jogo o lê (a **sujeira**, o **cheiro** e o **sangue**), com a escala do próprio jogo (0,30 é um pouco, 0,60 é sujo, 0,90 é imundo) e onde se lavar. O admin vê a de outro jogador (`/sujeira @jogador`).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador; o admin vê a de outro
- **Nota:** A sujeira é a do jogo: a roupa e a pele sujam com o movimento, mais depressa quanto mais rápido o corpo anda, e só saem com água. O servidor não a muda (o jogo só deixa **ler** a sujeira, não escrever): tira o efeito `quest_noDirt`, que a congela em zero, se algum aparecer no corpo, e avisa quem fica sujo. Veja [Sujeira](#sujeira).
- **Código:** `src/server/commands/sujeira.ts`, com apoio em `src/server/auth.ts`, `src/server/dirt.ts`, `src/server/players.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/stats.md`, `Players/restoring-stats.md`, `Resources/buffs.md`

```text
/sujeira  -- a sua sujeira, o cheiro e o sangue, como o jogo os lê
/sujeira @jogador  -- (admin) a de outro jogador
```

### `/take`

Tira itens do seu inventário (mesmos formatos do `/give`).

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/take.ts`, com apoio em `src/server/args.ts`
- **No jogador:** `player.takeItem`
- **Para ler mais** (pasta `docs/guides`): `Players/items.md`, `Players/inventory.md`

```text
/take <GUID|"exact item name"> [amount]
```

### `/tp`

Leva você para o lado de outro jogador (nome ou slot, o número da lista da tecla Tab) ou para uma coordenada do mapa. `/tp list` lista quem está no servidor.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/teleport.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`, `src/server/players.ts`
- **API do motor que usa:** `Player.all`
- **No jogador:** `player.position`, `player.teleport`, `player.ready`, `player.rotation`
- **Para ler mais** (pasta `docs/guides`): `Players/actions.md`

```text
/tp <player|slot>
/tp <x> <y> [z]
/tp list
```

### `/try`

**Tenta** uma ação: ela dá certo ou falha ao acaso (50%), e quem está por perto vê o resultado: `/try arrombar a porta`.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** quem está a 30 m
- **Nota:** O servidor decide o resultado, não o jogador.
- **Código:** `src/server/commands/roleplay.ts`, com apoio em `src/server/roleplay.ts` (o mesmo arquivo implementa também `/me`, `/do`)
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/try <ação>  -- ex.: /try arrombar a porta
```

### `/levantar`

Levanta da cadeira ou da cama do World Builder em que você está sentado ou deitado, se as teclas de andar (`W` `A` `S` `D`, `Espaço`) não levantaram. Veja [Móveis do World Builder](#móveis-do-world-builder).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/mobilia.ts`, com apoio em `src/server/furniture.ts`

```text
/levantar
```

## Voz e jogos entre jogadores

### `/dice`

Convida um oponente próximo para jogar dados e combinar a pontuação alvo (padrão 2000, passos de 500, de 100 a 100000). `accept`, `decline` e `cancel` respondem ou saem do lobby. A **aposta** (em moedas) se combina na conversa que abre depois do convite, junto com a pontuação: veja *Jogar dados: a aposta e os seus dados*, em [Encontros entre jogadores](#encontros-entre-jogadores).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** você e outro jogador, perto de uma mesa de dados
- **Nota:** O mesmo convite sai do menu de conversa, sem comando: `E` no outro jogador, **Jogar dados**. Veja [Encontros entre jogadores](#encontros-entre-jogadores).
- **Código:** `src/server/commands/dice.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/dice-pot.ts`, `src/server/dice.ts`, `src/server/players.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/dice.md`

```text
/dice <player> [target score]
/dice accept
/dice decline
/dice cancel
```

### `/mute`

Silencia, só para você, a voz de outro jogador.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Nota:** O servidor garante o efeito.
- **Código:** `src/server/commands/voice.ts`, com apoio em `src/server/args.ts`, `src/server/players.ts` (o mesmo arquivo implementa também `/unmute`, `/mutes`)
- **API do motor que usa:** `Voice.isLocallyMuted`, `Voice.setLocalMute`, `Player.all`
- **Para ler mais** (pasta `docs/guides`): `Client scripting/sound-and-voice.md`

```text
/mute <player|slot>
```

### `/mutes`

Lista os jogadores que você silenciou.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/voice.ts`, com apoio em `src/server/args.ts`, `src/server/players.ts` (o mesmo arquivo implementa também `/mute`, `/unmute`)
- **API do motor que usa:** `Voice.isLocallyMuted`, `Voice.setLocalMute`, `Player.all`
- **Para ler mais** (pasta `docs/guides`): `Client scripting/sound-and-voice.md`

```text
/mutes
```

### `/unmute`

Volta a ouvir um jogador que você silenciou.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/voice.ts`, com apoio em `src/server/args.ts`, `src/server/players.ts` (o mesmo arquivo implementa também `/mute`, `/mutes`)
- **API do motor que usa:** `Voice.isLocallyMuted`, `Voice.setLocalMute`, `Player.all`
- **Para ler mais** (pasta `docs/guides`): `Client scripting/sound-and-voice.md`

```text
/unmute <player|slot>
```

## Mundo e ambiente

### `/animals`

Controla as populações de animais dos pontos de spawn do nível. `list` mostra os pontos próximos, `start <spawnpointGuid>` liga um no seu mundo virtual e `stop` limpa as populações até serem ligadas de novo. `status` diz quantos animais há agora no mundo, o máximo e as vagas por espécie, e `max <n>` muda o máximo de animais ao mesmo tempo (até o servidor reiniciar), para aliviar uma máquina fraca.

- **Quem pode usar:** só admin
- **Quem é afetado:** seu mundo virtual
- **Nota:** No mundo 0 elas já ligam sozinhas quando a malha de navegação está pronta, e na VPS está.
- **Código:** `src/server/commands/animals.ts`, com apoio em `src/server/animals.ts`, `src/server/place.ts`
- **API do motor que usa:** `Npc.animalSpawnpoints`, `Navigation.ready`
- **No jogador:** `player.position`, `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/animals.md`, `NPCs and animals/navigation.md`

```text
/animals list
/animals start <spawnpointGuid>
/animals stop
/animals status
/animals max <0-2000>
/animals carne [0.1-1]  -- quanto da carne de um animal abatido o caçador fica (metade, no mínimo uma de cada)
```

### `/area`

Lista as áreas do nível (e as criadas por script) ao seu redor e as portas que uma área liga.

- **Quem pode usar:** só admin
- **Quem é afetado:** só leitura
- **Código:** `src/server/commands/area.ts`
- **API do motor que usa:** `Area.getAtPlayer`, `Door.getForArea`, `Area.nearby`, `Area.getById`
- **No jogador:** `player.position`, `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `World/world-builder-areas.md`

```text
/area [here]
/area near [radius]
/area doors [id]
```

### `/clima`

Mostra o dia, a hora, se é dia ou noite e quanto falta para virar, e o clima. Troca o clima na hora (`/clima tempestade`) ou para e solta o relógio (`/clima relogio parar|seguir`).

- **Quem pode usar:** só admin
- **Quem é afetado:** **todos os jogadores**
- **Nota:** O relógio anda sozinho em 40 minutos de dia e 40 de noite, e o clima muda sozinho; veja a seção [Dia, noite e clima](#dia-noite-e-clima). O `/world` continua existindo para mexer no relógio e no céu à mão, mas a escala de tempo volta à do ciclo em até 5 segundos, a não ser que o relógio esteja parado pelo `/clima`.
- **Código:** `src/server/commands/clima.ts`, com apoio em `src/server/world-cycle.ts`
- **API do motor que usa:** `World.setTimeScale`, `World.hour`
- **Para ler mais** (pasta `docs/guides`): `World/clock-and-weather.md`

```text
/clima  -- dia, hora, quanto falta para anoitecer ou amanhecer, e o clima
/clima <limpo|poucas-nuvens|nublado|pancadas|garoa|tempestade|ventania>  -- troca o clima agora (passa em cerca de 4 minutos)
/clima relogio parar  -- o relógio para na hora em que está
/clima relogio seguir  -- volta aos 40 minutos de dia e 40 de noite
```

### `/door`

Lê (`near`, `list`), tranca, destranca, abre e fecha as portas do próprio nível, por GUID ou a mais próxima.

- **Quem pode usar:** só admin
- **Quem é afetado:** estado compartilhado (todos veem)
- **Nota:** Base para casas trancadas.
- **Código:** `src/server/commands/door.ts`, com apoio em `src/server/args.ts`
- **API do motor que usa:** `Door.queryNearest`, `Door.all`, `Door.find`
- **No jogador:** `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `World/doors-and-gates.md`

```text
/door [near] [guid]
/door lock|unlock|open|close [guid]
/door list
```

### `/gate`

Abre e fecha os portões de castelo: pontes levadiças, grades e portões de fortaleza (`toggle`, `open`, `close`, `list`).

- **Quem pode usar:** só admin
- **Quem é afetado:** estado compartilhado (todos veem)
- **Código:** `src/server/commands/gate.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Gate.find`, `Gate.nearest`, `Gate.all`
- **No jogador:** `player.virtualWorld`, `player.position`
- **Para ler mais** (pasta `docs/guides`): `World/doors-and-gates.md`

```text
/gate [toggle] [guid]
/gate open|close [guid]
/gate list
```

### `/objeto`

Tira do mundo, para todos e de vez, um objeto do próprio mapa: um portão que o jogo nunca abre, uma cerca, entulho. O objeto some com a colisão, para todo jogador, mesmo quem entra depois; a lista fica salva e volta a valer a cada início do servidor. **O portão da frente de Malešov** (duas folhas de vigas que o jogo deixa fechadas para sempre) já sai assim: a folha esquerda vai sozinha, num servidor novo, da posição que o próprio guia do KCDC dá; a folha direita precisa da posição exata, que o World Builder mostra (`/builder on`, F7, clique na folha, **Copy selection as API calls**) e que pode ser colada inteira depois de `/objeto esconder`.

**A parede invisível dos portões de castelo** (20/10/2026: *"o fechar e abrir portão de castelo deve remover a parede invisível também"*): um portão de folhas (o de Raborsch) tem, além das folhas, um volume de colisão do nível (`brush/clipvolume_381.cgf`, sem desenho) que o jogo liga com as folhas fechadas e liga de novo por cima das folhas abertas. Uma folha fechada já barra a passagem sozinha, então a parede só atrapalha quem a encontra com o portão aberto: o servidor a tira em todo início, depois de carregar os mundos exportados (se um mundo exportado já a tira, ele fica com ela: dois recursos no mesmo objeto param o servidor). O nome e a posição vêm dos dados da camada `gateBarrier` do portão em `level.pak`; o motor pode chamar a malha pelo caminho curto ou pelo longo, e o servidor pede os dois. **`/objeto sondar`** mostra, para o admin, o que o jogo dele acha à frente (até 8 m): tipo, nome, guid, material e posição de cada coisa sólida, para achar a parede de outro portão e tirá-la com `esconder`.

**A parede invisível que não tem nome** (27/10/2026: *"na entrada do castelo de Malešov há uma parede invisível"*): `/objeto parede` é para quem está encostado nela. O jogo do próprio administrador lança uma volta de raios (doze direções, na altura dos joelhos e do peito) e pergunta ao motor que entidades de geometria há por perto; o que é só colisão (uma caixa de designer `.../Brush/designer_<guid>.cgf`, um volume `brush/clipvolume_<n>.cgf`, uma entidade com nome de bloqueio) sai do mapa para todos e fica na lista (`/objeto devolver <n>` desfaz); parede, árvore ou porta com desenho nunca são tocadas. O que o motor não registra com nome (geometria estática sem fonte) é só listado, com a posição. Um objeto que um mundo exportado já tira não é pedido de novo: dois recursos no mesmo objeto param o servidor.

**A parede invisível que fica onde uma porta foi tirada** (27/10/2026: *"mesmo removendo essas portas estáticas fica uma parede invisível, preciso que retire"*): o mundo exportado `portas-removidas` (o projeto do World Builder do usuário) esconde 22 objetos estáticos (portões, portas de celeiro, um carro de boi, uma cerca) na área das fortalezas de Kuttenberg, e onde uma porta ficava o nível costuma ter uma caixa de colisão do designer (material `mat_level_barrier`, sem desenho) que continua barrando a abertura. Cada lugar de onde um desses objetos saiu é um **ponto** (uma porta e o vão dela no mesmo lugar são um ponto só). A primeira vez que um jogador com o jogo respondendo chega a 40 m de um ponto, o jogo dele lança 36 raios que atravessam o lugar da porta (três alturas, doze direções, 4 m para cada lado) e pergunta que entidades de geometria há ali; o que é só colisão, a até uns 4 m da porta (a mesma regra do `/objeto parede`: uma caixa `designer_<guid>`, um volume de colisão, ou qualquer coisa feita de `mat_level_barrier`, `mat_nodraw_designer` ou de um material `nodraw`), sai do mapa para todos e fica na lista do `/objeto`. O que tem desenho nunca é tocado; mais de seis coisas só de colisão num ponto é sinal de que algo está errado e nada é tirado. Cada ponto é olhado **uma vez** (guardado em `playerdata/wall-sites.json`); um olhar em que o jogo não respondeu ou não tinha nada para traçar vale por nada e é repetido depois de um minuto. O servidor escreve cada olhar no log (`wall-sites: ...`, com o que tirou, o que viu e deixou, e a geometria sem nome). **`/objeto portas [metros]`** (admin) olha de novo, agora mesmo, os pontos a até tantos metros do administrador (40 por padrão, no máximo seis, o mais perto primeiro) e responde linha a linha; **`/objeto portas lista`** mostra quais pontos já foram olhados. Os pontos vêm dos mundos exportados listados em `SITE_WORLDS` (`src/server/wall-sites.ts`).

**Tudo o que sai do mapa vai para baixo da terra** (27/10/2026, o usuário: *"deu certo agora a remoção ... essa ideia de jogar embaixo da terra foi top ... faça o mesmo em Malešov e Raborsch"*): um objeto estático só *escondido* continuava com a colisão no jogo (os raios dos jogadores ainda acertavam as portas que o World Builder escondeu, e a Ludmilla bateu numa parede invisível ali). Posto 300 m abaixo do lugar e encolhido a um centésimo (`hidden` + `position` + `scale 0.01`, a mesma edição repetida por cima da que o esconde, sem criar outra), o objeto deixou de ser acertado. Por isso: (1) a cada início do servidor, na primeira varredura, **todo objeto que qualquer mundo exportado esconde** é posto embaixo da terra (as 22 portas, os 43 objetos do `raborsch.world.json`: barris, fogão, tampas de caixão, arbustos, as quatro argolas de Malešov); (2) tudo o que a **lista do `/objeto`** tira (as duas folhas e os dois bloqueios de designer do portão de Malešov, o que o `esconder` e o `parede` acrescentam) entra já assim, em `level-edits.ts` (`sunkBrush`); entidades continuam só escondidas. **Os portões de Raborsch e de Malešov** são mais dois pontos para olhar (`EXTRA_SPOTS`, o jogo de quem chega perto procura ali a caixa de designer, `mat_level_barrier`, que nenhum mundo exportado nomeia) e entram em `/objeto portas lista`.

- **Quem pode usar:** só admin
- **Quem é afetado:** estado compartilhado (todos veem)
- **Nota:** De longe, o desenho distante do mapa ainda pode mostrar o objeto até a pessoa chegar perto. A posição precisa estar certa em 5 cm: é ela que identifica o objeto.
- **Código:** `src/server/commands/objeto.ts`, com apoio em `src/server/level-edits.ts` (salvo em `playerdata/level-edits.json`) e `src/server/wall-sites.ts` (`playerdata/wall-sites.json`)
- **API do motor que usa:** `LevelEdit.apply`, `LevelEdit.restore`
- **Para ler mais** (pasta `docs/guides`): `World/level-edits.md`

```text
/objeto  -- o que já foi tirado do mapa, numerado
/objeto esconder <malha.cgf> <x> <y> <z>  -- tira o objeto (a linha que o World Builder copia pode ser colada inteira)
/objeto devolver <n>  -- põe de volta o objeto nº n
/objeto portas [metros]  -- olha de novo a parede invisível que ficou onde uma porta foi tirada do mapa (as portas a até tantos metros, 40 por padrão) e tira o que é só colisão; /objeto portas lista mostra quais já foram olhadas
/objeto sondar  -- o que há para onde você olha e na sua frente (na altura do peito e dos joelhos), a até 8 m (o que o seu jogo vê): o nome, o guid e a posição de uma parede invisível, para tirá-la com 'esconder'; uma árvore ou pedra vem marcada /tree ou /rock
/objeto parede [metros]  -- encoste na parede invisível e use: o seu jogo procura ao redor (3 m, até 8) e o servidor tira de vez o que é só colisão (caixa de designer, volume de colisão, entidade bloqueadora); o que tem desenho não é tocado; /objeto devolver <n> desfaz
```

### `/mural`

Os **quadros de avisos** das vilas e cidades (veja [Quadros de avisos](#quadros-de-avisos)). Sozinho, abre o quadro que estiver ao alcance, como a tecla **F** diante dele (um caminho para quem o aviso da tela não aparece). O administrador lista os quadros que o servidor conhece e os cartazes de cada um, com **quem os afixou, até os anônimos**, e retira cartazes.

- **Quem pode usar:** jogador e admin (as outras formas, só admin)
- **Quem é afetado:** só você (retirar cartazes muda o quadro de todos)
- **Nota:** Um cartaz custa **10 moedas** e fica **7 dias**. O registro do servidor diz quem afixou e quem retirou cada cartaz (`mural:`).
- **Código:** `src/server/commands/mural.ts`, com apoio em `src/server/mural.ts` e `src/server/mural-places.ts`

```text
/mural  -- abre o quadro de avisos perto de você
/mural quadros  -- (admin) os quadros que o servidor conhece, onde estão e quantos cartazes têm
/mural lista [quadro]  -- (admin) os cartazes de um quadro, ou de todos, com quem os afixou
/mural remover <id>  -- (admin) retira um cartaz
/mural limpar <quadro>  -- (admin) retira todos os cartazes de um quadro
```

### `/cartas`

As **cartas** que os jogadores mandam uns aos outros pela seção **Cartas** do painel (veja [Cartas](#cartas)). O administrador vê quantas há, as que um jogador mandou ou recebeu, com **quem escreveu, até as sem assinatura** (uma carta anônima ofensiva tem dono), o título, o selo, quando chegou e se foi lida, e apaga uma carta de vez. O texto de uma carta **nunca** aparece no comando.

- **Quem pode usar:** só admin
- **Quem é afetado:** as cartas citadas (apagar tira a carta dos dois lados)
- **Nota:** O registro do servidor diz quem mandou carta a quem, a distância e quando chega (`letters:`), e quem apagou uma.
- **Código:** `src/server/commands/cartas.ts`, com apoio em `src/server/letters.ts`

```text
/cartas  -- (admin) quantas cartas há, a caminho e guardadas, e o preço
/cartas de <nome>  -- (admin) as cartas que um jogador mandou
/cartas para <nome>  -- (admin) as cartas que um jogador recebeu, com quem escreveu (mesmo as sem assinatura)
/cartas apagar <id>  -- (admin) apaga uma carta de vez, para os dois lados
```

### `/herbs`

Controla a rebrota das ervas: `time` (em segundos reais na velocidade atual do mundo; `0 0` desliga a rebrota por tempo), `defaults`, `respawn [raio]` e `respawn-all` refazem ervas já colhidas.

- **Quem pode usar:** só admin
- **Quem é afetado:** `time`/`defaults`: servidor inteiro; `respawn`: seu mundo virtual
- **Código:** `src/server/commands/herbs.ts`, com apoio em `src/server/args.ts`
- **API do motor que usa:** `World.timeScale`, `Gathering.respawnTime`, `Gathering.setRespawnTime`, `Gathering.resetRespawnTime`, `Gathering.respawnAll`, `Gathering.respawn`
- **No jogador:** `player.virtualWorld`, `player.ready`, `player.position`
- **Para ler mais** (pasta `docs/guides`): `World/gathering.md`

```text
/herbs [info]
/herbs time <minSeconds> [maxSeconds]  (0 0 disables timed regrowth)
/herbs defaults
/herbs respawn [radiusMetres]  (default 10, in your virtual world)
/herbs respawn-all  (in your virtual world)
```

### `/tesouros`

(admin) Os **baús de tesouro** espalhados pelo mapa: `abastecer` (enche agora), `ligar`/`desligar` e `chance <n>`. Cerca de 40% dos baús do nível passam a ter saque de verdade (comida, minérios, receitas, roupas e, raramente, armas e armaduras simples), melhor quanto mais longe das vilas e mais difícil a tranca.

- **Quem pode usar:** só admin
- **Quem é afetado:** o mundo
- **Nota:** Um baú esvaziado volta a encher depois de 1 hora. Os baús de casas e de acampamentos de bandidos não entram. **Armas e armaduras são raras e pobres** (pedido de 20/10/2026: *os itens dos baús avulsos não podem ter armadura e espada muito boas, têm que ser mais raros; coisas de cavalo; senão tira o sentido das profissões*): não aparecem nos baús perto de gente (a menos de 150 m de uma vila, igreja ou acampamento de estrada); nos outros são peças **simples e gastas**, e só nos baús mais longe e nos trancados, uma vez em três, uma peça **comum**; nunca uma boa ou excelente, e **nunca arreios de cavalo** (sela, rédea, testeira, manta, ferraduras), que se fazem e se compram. Saem com um terço da chance de antes. As roupas podem chegar a boas, só nos baús de longe. As peças boas são o ofício do ferreiro e do alfaiate.
- **Código:** `src/server/commands/tesouros.ts`, com apoio em `src/server/treasure.ts`
- **Para ler mais** (pasta `docs/guides`): `World/stashes.md`

```text
/tesouros  -- quantos baús, de que nível, e se está ligado
/tesouros abastecer  -- enche agora os baús vazios
/tesouros ligar|desligar
/tesouros chance <0-100>  -- de cada 100 baús do mundo, quantos têm algo (vale a partir de já)
```

### `/world`

Lê e define o relógio e o clima compartilhados: `scale` (velocidade do tempo, 0 a 200), `hour`, `day`, `weather` (predefinição e duração em segundos, até 21600), `rain` e `wind` (m/s, até 50).

- **Quem pode usar:** só admin
- **Quem é afetado:** **todos os jogadores**
- **Nota:** Muda a hora e o clima do servidor inteiro, por isso é só de admin. O ciclo de dia e noite (`/clima`) devolve a escala de tempo à dele em até 5 segundos, e o céu posto à mão fica só até a próxima troca do ciclo. Para o relógio ficar parado, use `/clima relogio parar`; para escolher o clima, `/clima <id>`.
- **Código:** `src/server/commands/world.ts`, com apoio em `src/server/args.ts`
- **API do motor que usa:** `World.weatherBlending`, `World.previousWeather`, `World.weatherRemaining`, `World.wind`, `World.day`, `World.hour`, `World.timeScale`, `World.weather`, `World.rainIntensity`, `World.wetness`
- **Para ler mais** (pasta `docs/guides`): `World/clock-and-weather.md`

```text
/world [info]
/world scale <0..200>
/world hour <0..24>
/world day <day> <hour>
/world weather <preset> [seconds 0..21600]
/world rain <0..1> [amount 0..1]
/world wind <x> <y> [z]  (metres per second, up to 50)
```

## Objetos, marcadores e efeitos

### `/blip`

Cria um ponto na bússola e no mapa de todos (ou só no seu, com `me`). `set`, `move`, `types`, `list`, `remove`, `clear`.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos no mundo virtual (ou só você com `me`)
- **Código:** `src/server/commands/blip.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Blip.types`, `Blip.getById`, `Blip.all`, `Blip.removeAll`, `Blip.create`
- **No jogador:** `player.position`, `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `User interface/map.md`, `Resources/blip-icons.md`

```text
/blip [type] [label]
/blip me [type] [label]
/blip set <id> type|label|state|compass|map <value>
/blip move <id>
/blip types [prefix]
/blip list
/blip remove <id>
/blip clear
```

### `/build`

Como o `/prop`, mas o objeto é colocado onde você mira, com pré-visualização ao vivo. `/build stop` cancela.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos veem
- **Código:** `src/server/commands/build.ts`, com apoio em `src/server/args.ts`, `src/server/build.ts`, `src/server/place.ts`
- **Para ler mais** (pasta `docs/guides`): `Tutorials/build-mode.md`, `Client scripting/placement.md`

```text
/build <model> [scale] [rigid|static|none]
/build stop
```

### `/builder`

Liga ou desliga o seu acesso ao World Builder, o editor de mapas (tecla F7). O acesso zera quando você sai.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Dá a quem o digita o acesso ao editor de mapas (F7). O acesso zera quando o jogador sai.
- **Código:** `src/server/commands/builder.ts`
- **No jogador:** `player.setWorldBuilderEnabled`
- **Para ler mais** (pasta `docs/guides`): `World/world-builder.md`

```text
/builder [on|off]
```

### `/carry`

Faz você carregar um item nos braços (cesta, lenha, saco) ou deixa um no chão para ser pego pelo prompt do jogo (`prop`). `drop [now]` solta.

- **Quem pode usar:** só admin
- **Quem é afetado:** você
- **Código:** `src/server/commands/carry.ts`, com apoio em `src/server/place.ts`
- **API do motor que usa:** `GroundItem.spawn`
- **No jogador:** `player.carriedItem`, `player.putDownItem`, `player.virtualWorld`, `player.carryItem`
- **Para ler mais** (pasta `docs/guides`): `Players/carrying.md`

```text
/carry <item>    -- carry it
/carry prop <item>   -- lay one down in front of you; the game's pick-up prompt carries it
/carry list
/carry drop [now]   -- put it down; now lets go at once
```

### `/chave`

Tranca ou destranca a porta, ou o baú, à sua frente se você tiver a chave dele no inventário ou se o dono lhe deu acesso (o **Dar acesso** do painel, em Propriedades, que vale como a chave). Numa casa com mais de uma porta (a entrada e o depósito), todas mudam juntas. É o que dá serventia à chave que o admin entrega.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** a porta ou o baú à sua frente
- **Nota:** Libera a propriedade para todo mundo até alguém trancar de novo, porque o estado trancado/destrancado de uma porta é de todos, não de um jogador. O estado em que ficou é o que volta depois de um reinício.
- **Código:** `src/server/commands/chave.ts`, com apoio em `src/server/properties.ts`
- **Para ler mais** (pasta `docs/guides`): `World/doors-and-gates.md`

```text
/chave
```

### `/drop`

Deixa uma pilha de um item no chão, para qualquer um pegar. `list`, `remove <id>`, `clear`.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos veem
- **Código:** `src/server/commands/drop.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `GroundItem.all`, `GroundItem.destroyAll`, `GroundItem.getById`, `GroundItem.spawn`
- **No jogador:** `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `Players/items.md`

```text
/drop <GUID|"exact item name"> [amount]
/drop list
/drop remove <id>
/drop clear
```

### `/marker`

Coloca marcadores no mundo: um decalque projetado no chão ou uma forma (cilindro, esfera, seta, cubo, plano) com cor, tamanho, giro, flutuação e gatilho. Edita (`resize`, `spin`, `bob`, `trigger`, `tint`) e remove.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos veem
- **Código:** `src/server/commands/marker.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Marker.all`, `Marker.getById`, `Marker.list`, `Marker.removeAll`, `Marker.place`
- **No jogador:** `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `World/markers.md`, `Resources/markers.md`

```text
/marker <material> [size]
/marker <cylinder|sphere|chevron|cube|plane> <colour> [size] [height]
/marker colours
/marker names [prefix]
/marker list
/marker resize <id> <size> [height]
/marker spin <id> <degreesPerSecond>
/marker bob <id> <metres>
/marker trigger <id> on|off
/marker tint <id> <r> <g> <b> [a]
/marker remove <id>
/marker clear
```

### `/prop`

Coloca no mundo uma peça do catálogo de objetos do jogo, construída em todos os clientes. A física é `static` (padrão), `rigid` ou `none`. `list`, `remove <id>`, `clear`.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos veem
- **Código:** `src/server/commands/prop.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Prop.all`, `Prop.destroyAll`, `Prop.getById`, `Prop.spawn`
- **No jogador:** `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `World/props.md`

```text
/prop <model> [scale] [rigid|static|none]
/prop list
/prop remove <id>
/prop clear
```

### `/ladrao`

A **marca de ladrão**: o título **Ladrão** (ou **Ladra**), em vermelho, sobre a cabeça, no lugar de qualquer outro título; **desde 04/11/2026 só quem já foi apresentado ao marcado o lê** (o mesmo rótulo do título sobre a cabeça). Desde 02/11/2026 vem sozinha só no **terceiro arrombamento** (*"esse título só deve ser dado depois do jogador arrombar 3 coisas, exemplo portão, baú, porta ou baú, baú, porta"*): quem arromba (gazua) as fechaduras de **3 coisas** de outros jogadores (portas, portões ou baús, em qualquer ordem; a mesma fechadura conta uma vez) **em 3 dias** é marcado por **1 dia**, e cada arrombamento seguinte nesses 3 dias renova a marca. De 01/11 a 02/11/2026 a marca vinha no primeiro arrombamento (assim o Aspen foi marcado por um só, a Casa do Gordo do Kunst II Schmiede; a marca dele foi tirada na atualização de 02/11); até 01/11, de tirar coisas de mais de 3 baús em uma hora (pedido de 18/10/2026). O comando lista quem está marcado, marca à mão ou perdoa; o perdão também zera os arrombamentos contados.

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** Conta o arrombamento na hora em que o servidor vê a fechadura aberta (até 3 minutos depois de começar a arrombar); o log diz `thieves: Fulano arrombou X (2 de 3 para a marca de ladrão)`. **Não conta:** o dono, quem tem a chave, quem mora no quarto, **parente** do dono (o vínculo aceito na seção Família), propriedade de NPC ou sem dono, e quem só tira de um baú destrancado (fica no log, linhas `baús: ...`). As marcas ficam em `playerdata/thieves.json` e os arrombamentos contados em `playerdata/thief-breakins.json` (um reinício não apaga nenhum dos dois). `/ladrao perdoar <nome>` acha também a marca de quem não está online, pelo nome dela. Veja [Baús de outro jogador: o roubo e a marca de ladrão](#baús-de-outro-jogador-o-roubo-e-a-marca-de-ladrão).
- **Código:** `src/server/commands/ladrao.ts`, com apoio em `src/server/thieves.ts`, `src/server/property-menu.ts`, `src/server/family.ts`, `src/server/titles.ts`

```text
/ladrao  -- quem está marcado, até quando e por quê
/ladrao marcar <jogador> [dias]  -- marca (1 dia se não disser)
/ladrao perdoar <jogador>  -- tira a marca (e zera os arrombamentos contados); serve também para quem não está online, pelo nome da marca
```

### `/mortes`

Os **baús de morte**. Ao cair, o que o jogador não tinha vestido ou equipado vai para um baú junto ao corpo, **marcado no mapa e na bússola do dono** (um túmulo), por **30 minutos**. **O dono pode abrir e pegar tudo de volta** (pedido de 18/10/2026, à noite; antes disso o dono era recusado), e quem passar antes também pode levar. Faltando 5 minutos o dono é avisado. Um reinício não apaga mais o baú: ele volta ao mesmo lugar com o que tinha, com pelo menos 10 minutos. O comando lista os baús (no mundo e os que já acabaram, por 7 dias), mostra o que caiu, quem levou quanto e o que o dono perdeu, e devolve ao dono o que ele perdeu.

- **Quem pode usar:** só admin
- **Quem é afetado:** o dono do baú
- **Nota:** As horas aparecem no horário de Brasília. `devolver` entrega o que outros levaram e o que sobrou quando o tempo acabou; num baú ainda no mundo, entrega tudo o que está nele e o baú some. Quem não está no servidor recebe uns segundos depois da próxima entrada. Fica em `playerdata/death-drops.json` (os baús no mundo) e `playerdata/death-drops-past.json` (os que acabaram e as devoluções esperando). Os baús de antes de 18/10/2026, 23:49 UTC, não foram registrados.
- **Código:** `src/server/commands/mortes.ts`, com apoio em `src/server/death-drop.ts`, `src/server/characters.ts`

```text
/mortes  -- os últimos baús de morte, no mundo e passados (hora de Brasília)
/mortes <jogador>  -- os de um jogador (nome do personagem, apelido ou Steam id)
/mortes ver <n>  -- o que caiu no baú #n, quem levou e o que o dono perdeu
/mortes devolver <n>  -- devolve ao dono o que ele perdeu no baú #n (na hora, ou na próxima entrada)
```

### `/presos`

As **prisões** do reino (pedido de 29/10/2026): um jogador de cargo que faça sentido (soldado, guarda, capitão, juiz, cavaleiro, lorde...) aperta E diante de alguém **abaixo dele na hierarquia** e escolhe **Prender** na lista; o preso fica de **mãos algemadas** (só anda: não corre, não abre menu algum além do Esc, não age; fala no chat e na voz) e pode ser solto por quem o prendeu ou por quem está acima. As algemas se soltam sozinhas em 30 minutos; a morte também solta. Diante de um **pelourinho** (os das vilas do nível) o oficial aperta E, escolhe quem será posto e a pena (15 min, 30 min, 1 h ou 2 h): o preso fica no pelourinho até o tempo acabar, **mesmo que saia do jogo e volte** (conta pelo relógio). O comando lista os presos e solta quem a administração mandar.

- **Quem pode usar:** só admin (os oficiais prendem pela lista do E, não por comando)
- **Quem é afetado:** o preso
- **Nota:** Não confundir com `/preso`, o "Fiquei preso" dos jogadores. Um preso só consegue falar: os comandos que movem, chamam animais ou levam a uma igreja ficam recusados enquanto ele estiver preso (um administrador mantém todos os comandos, mesmo preso). Fica em `playerdata/arrests.json`.
- **De mãos amarradas** (01/11/2026: *ao prender normal um jogador temos que travar em uma animação parecida de mão cruzada*): quem é algemado fica **parado**, na pose do jogo de um homem com as mãos amarradas nas costas (`Tied`, `hands_tied_back_idle`); a mulher, que não tem essa pose de pé no jogo, fica sentada e amarrada (`TiedUpIdle_Slave`). As teclas de andar saem no cliente. Para levar o preso, o oficial aperta **E** nele e escolhe **Conduzir**: o preso volta a andar (só no passo), e quem fica a mais de 8 m do oficial é trazido para o lado dele; **Parar de conduzir** o deixa parado e amarrado de novo, e o oficial que sai do jogo ou se afasta mais de 60 m larga o preso. Pôr no pelourinho ou soltar acaba com isso. Não verificado no jogo: as poses.
- **No tronco** (01/11/2026: *tentei colocar um jogador no pelourinho, ele não ficou na posição e preso ao pelourinho*): até então o corpo só era levado ao ponto onde o próprio evento do pelourinho faz nascer o seu preso, uns 2 m atrás do tronco, e puxado de volta se andasse. Agora o **homem** é posto na origem do próprio tronco (o `so_pillory` do nível), virado como ele está, e recebe a pose do jogo, **`Pillory`** (`quest_pillory`, em loop), com o movimento travado; é o mesmo lugar e a mesma pose que o jogo usa (`Libs/SmartObjects.xml`). O jogo só tem essa pose para homens: a **mulher** fica de joelhos ao lado do tronco, chorando (`CryingKneeling`). Se o jogo recusar a pose, o preso fica de joelhos como um mendigo (`Beggar`), e se recusar essa também, só preso ao lugar como antes. Empurrado (um golpe, a colisão do tronco), o corpo é posto de novo, no máximo quatro vezes por minuto; solto, a pose acaba e ele sai do tronco para o lado. **Sem sair andando** (01/11/2026: *o pelourinho faz a animação mas o jogador consegue sair andando*): as teclas de andar de quem está no pelourinho são tiradas no cliente, e quem se afasta mais de 1,2 m do lugar onde a pose começou é posto de volta **sempre** (os quatro por minuto deixavam ir embora depois do quarto). O registro diz `arrest: <nome> no pelourinho de <lugar>: preso no tronco (Pillory; a 0.00 m do lugar)`. **Não verificado no jogo**: se o corpo fica de fato com a cabeça e as mãos no tronco (depende da rotação e da colisão), e se a pose feminina é a melhor.
- **Código:** `src/server/commands/presos.ts`, com apoio em `src/server/arrest.ts`, `src/client/arrest.ts`, `src/server/encounters.ts`

```text
/presos  -- quem está preso agora, quem prendeu e quanto falta
/presos soltar <nome>  -- solta quem tiver esse nome (ou parte dele), algemado ou no pelourinho
```

### `/entrada`

A **porta do servidor** (pedido de 29/10/2026, no lugar da lista de aprovados): quem entra pela primeira vez responde a **dez perguntas** sorteadas de um banco maior, sobre RP e sobre Kingdom Come: Deliverance, e com **7 acertos** passa (quem erra espera 30 segundos para tentar de novo); só então cria o personagem (corpo e roupas). Quem já tinha personagem passa só pelas perguntas. **O trailer que rodava a cada entrada foi tirado em 09/11/2026** (*vamos remover o trailer que roda ao iniciar no servidor*): nem a página, nem o código, nem o arquivo de ajustes `entry-settings.json` existem mais, e quem já passou entra direto. Sem comando, `/entrada` diz quantos passaram e quem está na porta agora.

- **Quem pode usar:** só admin (os administradores também veem a porta na primeira entrada, mas as mensagens e os comandos deles nunca são barrados; `aprovar` libera quem não queira responder)
- **Quem é afetado:** o jogador citado
- **Nota:** A aprovação fica em `playerdata/entry.json`, por Steam id. A lista antiga de aprovados (`kcdc-whitelist`) continua no disco, desligada com `kcdc-whitelist enforce off`.
- **Código:** `src/server/commands/entrada.ts`, com apoio em `src/server/entry.ts`, `src/server/entry-quiz.ts`, `src/client/entry.ts`, `ui-src/entry.html`

```text
/entrada  -- quantos já passaram e quem está na porta agora
/entrada aprovar <jogador ou Steam id>  -- aprova sem as perguntas
/entrada zerar <jogador ou Steam id>  -- tira a aprovação: ele vê as perguntas de novo
```

### `/curar`

Um médico da administração: estanca o **sangramento** e fecha os ferimentos de um jogador, ou cura **tudo** (vida, ferimentos, venenos e sangramento). Quem não está no servidor é tratado uns segundos depois da próxima entrada.

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** Quem cai ferido acorda com 30% da vida e é mandado procurar um médico alquimista; as ataduras são feitas pelos alquimistas (pano + confrei ou calêndula, 2 ataduras). As curas esperando ficam em `playerdata/heal-on-join.json`.
- **Código:** `src/server/commands/curar.ts`, com apoio em `src/server/heal.ts`, `src/server/characters.ts`, `src/server/players.ts`

```text
/curar <jogador>  -- estanca o sangramento e fecha os ferimentos
/curar <jogador> tudo  -- cura tudo: vida, ferimentos, venenos e sangramento
```

### `/nivel`

Os **níveis** de um personagem, e o jeito de devolver um nível que se perdeu (23/10/2026: *"o Luance falou que perdeu os níveis"*; no arquivo dele todas as trilhas estavam no 5 do começo, e o registro do servidor tinha a alquimia no 20 e a esgrima de espada no 10). Sem trilha, lista as trilhas **acima do 5**; com trilha e nível, põe a trilha **exatamente** nesse nível (`restoreProgression`: sem janelinha de nível novo e **sem pontos de talento**, porque os talentos que o personagem já tinha continuam com ele), e **só para cima**. Para quem **não está no servidor** o nível vai para o **arquivo** do personagem e ele o tem na próxima entrada.

- **Quem pode usar:** só admin
- **Quem é afetado:** o personagem citado (o nome pode ter espaços: `/nivel Patrik Ondřej`; fora do servidor vale o nome, o apelido ou o Steam ID)
- **As trilhas:** `stealth`, `horse_riding`, `fencing`, `thievery`, `alchemy`, `craftsmanship`, `drinking`, `survival`, `weapon_sword`, `heavy_weapons`, `marksmanship`, `weapon_large`, `weapon_unarmed`, `scholarship`, `houndmaster`, `strength`, `agility`, `vitality`, `speech`, `prestige`; níveis de 1 a 30.
- **Os níveis só sobem no arquivo** (`character-state.ts`, `keepClimbs`): se o jogo do jogador reporta uma trilha **abaixo** da que está gravada (uma restauração que não pegou, ou um corpo que ainda não foi avisado), o que se grava continua sendo o nível salvo, e o jogo é **mandado restaurar de novo** (inteiro, com talentos e pontos, aos 5 s e aos 20 s da entrada; depois só as trilhas atrasadas, a cada olhada de 30 s, no máximo 3 vezes por sessão). O log diz `characters: X: N trilha(s) abaixo do salvo (alchemy 5 < 20, ...); restaurei de novo (5 s depois, vez 1)`. A esgrima (`fencing`) o jogo calcula sozinho e não entra na comparação; quem **recomeça do zero** tem o arquivo apagado e não é afetado.
- **Nem as passivas e os pontos** (03/11/2026, `looksFresh`/`keepProgression`; *"Lev Von Staufen ... não recebeu seus pontos de volta; temos que ver se não prejudicamos jogadores"*): até então só as **trilhas** eram protegidas. Quando o jogo entregava ao corpo, no meio da sessão, a progressão de um **personagem novo** (todas as trilhas no 5), a olhada de 30 s punha os níveis de volta e o salvamento seguinte gravava **as passivas e os pontos do personagem novo** por cima: Lev, Arthur, Agnes e Ludmilla perderam todos em 02/11 (o Lev tinha 150 talentos em 30/10 e ficou com 26). Agora, quando **toda trilha que está acima de 5 no arquivo aparece no 5**, a progressão não é do jogador: o arquivo fica com as passivas e os pontos dele, a olhada restaura **tudo** (níveis, passivas e pontos), e o Marbon as passivas fortes (a Esgrima, que devolvia os combos 3 s depois, saiu em 09/11/2026). O log diz `... trilha(s) abaixo do salvo (...); o jogo deu um personagem novo: restaurei de novo, com as passivas e os pontos (olhada periódica, vez 1)`. Uma trilha ou duas atrasadas com o resto no lugar (um XP que veio baixo) continuam voltando sozinhas, sem desfazer uma passiva comprada na hora.
- **A conferência dos pontos** (03/11/2026): o jogo dá **1 ponto a cada 2 níveis acima do 5** de cada habilidade (13 no 30); a conta *pontos dos níveis = passivas compradas + pontos sobrando* fecha exatamente em 137 dos 147 personagens. Os 8 com pontos faltando receberam de volta, com o servidor parado, as passivas que tinham no backup de 30/10 (nunca as 9 fortes, a família da alquimia ou os combos) e, em cada árvore, os pontos até essa conta (nunca acima, nunca um nível): Lev 80 passivas e 46 pontos, Arthur 11 e 11, Ludmilla 10 e 6, Agnes 24 pontos, Goran 6, Urik 6, Arvid 2, Joachim 2. Os números e o porquê estão em `BALANCEAMENTO.md`.
- **Código:** `src/server/commands/nivel.ts`, com apoio em `src/server/character-state.ts` (`savedProgression`, `raiseSavedTrack`, `keepClimbs`), `src/server/characters.ts`, `src/server/players.ts`

```text
/nivel <jogador>  -- os níveis dele (quem não está no servidor: os do arquivo)
/nivel <jogador> <trilha> <nível>  -- põe a trilha (alchemy, survival, weapon_sword...) nesse nível, de 1 a 30; só sobe
```

### `/propriedade`

Mapeia e administra as **propriedades**: casas, oficinas, tavernas e baús, cada uma com um nome, uma região, uma descrição, um dono e uma chave própria (um item novo, `kcdc-property:<id>`). **`mapear suchdol` (ou `wysoka`, `raborsch`, ou qualquer lugar que `locais` lista) cataloga tudo sozinho** (o servidor já conhece cada porta, cada baú e quais portas são de qual edifício); isso também roda sozinho na primeira vez que o servidor sobe, nas **17 regiões** da lista (`REGIONS` em `properties.ts`): Suchdol, Wysoka, Raborsch, Malešov, Bylany e Bohunowitz e, desde 20/10/2026 (*vamos mapear o resto inteiro logo*), Kuttenberg, Miskowitz, Pschitoky, Grunta, Horschan, Stará Kutná, Stará Lhota, Danemark, Rabstein, Opatowitz e a Estalagem de Pschitoky; Devil's Den, um vale de bandidos, e o acampamento do exército, que tem tendas e nenhuma porta, ficaram de fora (um lugar que a lista não tem se mapeia com o nome que `locais` mostra). `perto` lista o que há ao seu redor com a distância, `organizar` põe os baús e as portas soltos (que o mapeamento deixou fora das casas) para dentro da propriedade mais perto: o baú até 50 m da casa ou de um baú dela (75 m com o nome do lugar, como (Taverna)), só os sem dono ou do senhor das terras e nunca para dentro da casa de outro jogador; a porta até 35 m, com a tranca que ela tinha (aberta ou fechada), na casa do mesmo dono, ou, sendo do senhor ou de ninguém, na casa mais perto, e na casa de outro jogador só a que está colada nela (até 12 m); nenhum com chave feita para ele. Isso também roda sozinho 2,5 minutos depois de cada início ("as portas que ligam propriedade são da propriedade"), `ir` leva você até uma propriedade, `renomear` troca o nome, `trancar` e `destrancar` mexem na tranca, `castelo [região]` junta as portas e os baús dentro das muralhas num só imóvel (Suchdol e Raborsch; também roda sozinho a cada início). `registrar` cria uma propriedade à mão, na porta à sua frente. `regiao <id> <nome>` põe a propriedade e os baús dela numa região (é assim que as regiões nascem), `descricao <id> "<texto>"` escreve a descrição e `dono <id> [@jogador]` entrega a propriedade (o dono e as chaves da casa e dos baús; `dono <id> nenhum` tira). As propriedades aparecem na seção **Chaves** do painel (todas, para o admin) e na seção **Propriedades** (as do próprio jogador). Salvo em `playerdata/properties.json`.

- **Quem pode usar:** só admin
- **Quem é afetado:** as portas e baús da propriedade; quem tem a chave destranca
- **Nota:** A tranca é a **do jogo**: o que alguém trancou **de propósito** (o **F**, o painel, `/chave`, `trancar`, `registrar`) fica trancado de verdade no mundo, e volta trancado depois de cada reinício; o resto segue a tranca do próprio nível (as casas de NPCs e as do cenário são trancadas pelo jogo). Na porta ou no baú, o **E** é o do jogo (abre o que está destrancado; o arrombamento é segurar E) e o **F** tranca e destranca para quem tem a chave (o item), é o dono, mora no quarto ou é admin: veja [Fechaduras](#fechaduras-e-abre-f-tranca). Pelo painel, o dono e o admin trancam e destrancam de longe. `/chave` também funciona perto do baú.
- **Código:** `src/server/commands/properties.ts`, com apoio em `src/server/args.ts`, `src/server/players.ts`, `src/server/property-menu.ts`, `src/server/properties.ts`, `src/server/properties.ts`
- **Portas que o censo deixou de fora (04/11/2026, a Casa do Caçador de Suchdol):** *"na casa do caçador em Suchdol ficou faltando mapear duas portas"*. O censo arquiva só a **entrada** de cada prédio (e as portas de depósito); as outras portas que o nível liga ao prédio contam como dele, mas nunca entram na propriedade, e então não trancam com a chave da casa. A Casa do Caçador (`suchdol-casa-03`, a área `troskovice_10_house1`) tinha a entrada e uma porta de aldeia solta, e o nível liga a ela **mais três portas**, a 9, 14 e 15 m ao sul da entrada (as duas últimas lado a lado: as duas folhas de uma porta dupla); nenhuma estava em propriedade alguma. `MISSED_DOORS` (`src/server/properties.ts`) as junta à casa **a cada início** (uma vez só; se o nível ainda não mostrou a porta, a próxima inicialização tenta de novo), e uma casa trancada de propósito tranca as portas novas junto. Para outra casa que falte uma porta: fique ao lado dela e use `/propriedade porta <id da casa>`. O log diz `properties: Casa do Caçador: 3 porta(s) nova(s)`.
- **No jogador:** `player.position`, `player.teleport`
- **Para ler mais** (pasta `docs/guides`): `World/doors-and-gates.md`, `Players/custom-items.md`

```text
/propriedade mapear <região> [portas]  -- cataloga sozinho os edifícios e baús da região (suchdol, wysoka, raborsch, ou um lugar do mapa); 'portas' inclui portas soltas
/propriedade locais  -- os lugares que o mapa do jogo nomeia, para mapear
/propriedade castelo [região]  -- junta as portas e os baús dentro das muralhas num só imóvel, o castelo (suchdol, raborsch, malesov, pschitoky); sem região, todos
/propriedade lugar [região]  -- junta numa propriedade só cada lugar da região que é uma coisa só: a Estalagem de Pschitoky, o Haras de Malešov, a Toca do Diabo (em Minas); sem região, todas
/propriedade organizar  -- põe os baús e as portas soltos para dentro da propriedade mais perto (até 35 m; um baú com o nome de um lugar, como (Taverna), até 75 m)
/propriedade perto [metros]  -- o que há perto de você, com a distância
/propriedade ir <id>  -- leva você até a propriedade
/propriedade renomear <id> "<nome>"
/propriedade regiao <id> <nome da região>  -- põe a propriedade (e os baús dela) numa região; é assim que as regiões nascem
/propriedade descricao <id> "<texto>"
/propriedade dono <id> [@jogador]  -- o jogador (você, se omitido) vira o dono; nenhuma chave vai junto, e o acesso que o dono anterior deu acaba
/propriedade dono <id> nenhum  -- tira o dono (o acesso que ele deu acaba; as chaves já entregues continuam com quem as tem)
/propriedade regioes  -- as regiões que já existem
/propriedade trancar <id>  |  /propriedade destrancar <id>
/propriedade registrar "<nome>" [região]  -- a porta mais próxima vira essa propriedade, trancada
/propriedade porta <id>  -- a porta mais perto de você (até 4 m) que não é de nenhuma propriedade passa a ser desta: uma casa que ficou sem uma porta
/propriedade remover <id>
/propriedade listar [região]
/propriedade <id>  -- detalhes de uma propriedade
```

### `/stash`

Baús: abre um estoque virtual só seu (`virtual`), cria contêineres e lê, tranca e destranca os baús do próprio nível (`near`, `lock`, `unlock`, `pick`, `key`, `goto`).

- **Quem pode usar:** só admin
- **Quem é afetado:** você / baús do mundo
- **Nota:** Base para casas e baús com chave.
- **Código:** `src/server/commands/stash.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Stash.all`, `Stash.find`, `Stash.nearest`, `Stash.getById`, `Stash.createVirtual`, `Stash.destroyAll`, `Stash.spawn`
- **No jogador:** `player.position`, `player.virtualWorld`, `player.spawn`
- **Para ler mais** (pasta `docs/guides`): `World/stashes.md`

```text
/stash
/stash virtual
/stash info
/stash clear
/stash near [guid]
/stash lock|unlock [guid]
/stash pick on|off [guid]
/stash key <item guid>|clear [guid]
/stash goto [locked|unlocked|guid]
```

### `/vfx`

Coloca efeitos de partículas das bibliotecas do jogo, fixos (`/vfx <efeito>`) ou de um disparo só (`burst`). `names`, `list`, `remove`, `clear`.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos veem
- **Código:** `src/server/commands/vfx.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Vfx.all`, `Vfx.list`, `Vfx.destroyAll`, `Vfx.getById`, `Vfx.burst`, `Vfx.spawn`
- **No jogador:** `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `World/effects.md`, `Resources/effects.md`

```text
/vfx <effect> [scale]
/vfx burst <effect> [scale]
/vfx names [prefix]
/vfx list
/vfx remove <id>
/vfx clear
```

### `/mobilia`

As **cadeiras e camas** que as exportações do World Builder puseram e que aceitam o jogador (`src/server/furniture.ts`), as mais perto de você, e os números de onde o corpo fica nelas. As animações de sentar e deitar do jogo foram feitas para os assentos dele, então o primeiro a sentar pode ficar um palmo fora do assento ou deitar com a cabeça do lado errado: `/mobilia ajustar cadeira-frente -0.35` e semelhantes corrigem para todos, e os números ficam em `playerdata/furniture-tuning.json`.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos que sentam e deitam nesses móveis
- **Código:** `src/server/commands/mobilia.ts`, com apoio em `src/server/furniture.ts`

```text
/mobilia  -- as mais perto de você e os números do ajuste
/mobilia ajustar <campo> <valor>  -- muda um número (cadeira-frente, cadeira-altura, cadeira-giro, cama-altura, cama-cabeceira, cama-giro, cama-lado); metros, ou graus no giro
```

## Montarias, cães e carroças

### `/cachorro`

O cão de quem apoia o servidor: chama o seu cão para perto (se ele sumiu, vem de novo), dá um nome (`nome <nome>`, até 24 letras; sem nome ele volta ao nome do jogo) e manda seguir ou esperar (`seguir`, `esperar`). O **E** diante do cão (a até 2,5 m, com a mira nele) abre o menu, como o do cavalo: *Fazer carinho* (a animação de carinho do jogo, 3 s num corpo masculino; num feminino, os primeiros 7 s da animação da governanta), *Mandar ficar* (o cão senta e fica) ou *Mandar seguir*, e *Sair*. Os botões de ordem do painel foram tirados (26/10/2026: *vamos tirar o mandar ficar do cachorro da interface na seção meus animais*).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o seu cão
- **Nota:** Só para apoiadores: o cão vem com os benefícios que o admin entrega na seção Jogadores do painel e volta sozinho a cada entrada. **Cada cão é diferente** (26/10/2026: *vamos randomizar os cachorros, eles só são dados por apoiador mas tem que ser diferentes*): na primeira vez que o cão vem, o servidor sorteia a alma de um dos cães de vila do jogo (64 almas, `src/server/dog-souls.ts`, feitas por `tools/make-dog-souls.py`; ficam de fora as dos cães das vilas deste servidor), uma que nenhum outro apoiador esteja usando enquanto sobrar alguma, e a grava em `supporters.json` (`dogSoul`): o cão volta igual a cada entrada, a cada `/cachorro` e a cada nova entrega. A alma é que define como o cão parece; quem já tinha o cão genérico ganha a sua na próxima entrada. *Ainda não visto no jogo:* quanto as almas se distinguem na aparência. Veja [Apoiador](#apoiador).
- **Onde o cão fica** (30/10/2026: *"quando sair ou voltar do jogo onde mandou o cachorro ficar ele deve continuar lá"*; *"se eu mando o cachorro ficar, ao ir longe e voltar ele buga, ficando andando: preciso mandar seguir e depois ficar"*): ao mandar **esperar** ou **sentar**, o lugar e o rumo do cão são gravados em `supporters.json` (`dogStay`) e valem até mandar **seguir** ou **solto**, ou chamar com `/cachorro`. A cada entrada o cão volta **para o lugar onde ficou** (não para perto do dono) assim que o dono chega a 60 m dele; se o dono entra longe, o cão espera lá. Enquanto isso o servidor olha os cães deixados a cada 2 s: um que o jogo do dono diz estar seguindo, ou que saiu a mais de 3,5 m do lugar, recebe de novo as ordens seguir e, 0,4 s depois, esperar (era o defeito de depois de uma caminhada longa: o modo era *esperar*, mas o cão andava), e se na terceira olhada ainda está errado é refeito no lugar. Um lugar onde o jogo não consegue pôr o cão é largado e o cão vem para perto do dono.
- **Código:** `src/server/commands/cachorro.ts`, com apoio em `src/server/args.ts`, `src/server/supporters.ts`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/dogs.md`

- **Mandar embora** (30/10/2026: *"na seção Animais, no cachorro, deve ter uma opção mandar embora; isso faz o cachorro sumir e o chamar traz ele de volta ao mundo"*): `/cachorro embora`, ou o botão **Mandar embora** do cão na seção **Animais** do painel (com confirmação), tira o cão do mundo e o registro o guarda como "foi embora": ele **não volta nem quando você entra de novo**, até você chamar (`/cachorro`, ou **Chamar** no painel), que o traz de volta ao mundo ao seu lado. O cão não precisa estar no mundo para ser mandado embora; o lugar onde ele fora deixado esperando é esquecido; **Animal preso** não o traz enquanto estiver longe.

```text
/cachorro  -- chama o seu cão (se ele sumiu ou foi mandado embora, vem de novo)
/cachorro embora  -- manda o cão embora: ele some do mundo, e não volta nem quando você entra, até você chamá-lo
/cachorro nome <nome>  -- dá um nome ao cão (até 24 letras); sem nome, ele volta ao nome de antes
/cachorro <seguir|esperar|sentar|solto>  -- manda o cão seguir você, esperar (sentar) onde está, ou andar solto
E diante do cão  -- abre o menu: Fazer carinho, Mandar ficar (ou Mandar seguir) e Sair
```

### `/carroca`

As suas **carroças**: onde estão, `trazer` (a vazia vem para a sua frente, a cada 2 minutos), `nome` (dar nome). O admin `dar`, `registrar`, `listar` e `liberar`. Também há a seção **Animais** do painel, com o brasão da carroça, o botão **Trazer até mim**, **Dar nome** e **Deixar livre / Trancar**. A tecla **E** diante da carroça abre a escolha do assento.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** as suas carroças
- **Nota:** Trancada (o padrão), só o dono e os administradores sobem; **livre**, qualquer jogador sobe e conduz. A carroça fica onde for deixada, com o dono e o nome, e volta ao mundo depois de uma reinicialização. O comando também responde por `/carroça`. O **[E] Subir na carroça** aparece a até **3,5 m do corpo** da carroça (o trecho da traseira, 5,5 m atrás do eixo da frente, até o banco do condutor, 1,5 m adiante dele: uma carroça não é um ponto), e a escolha do assento vale até 5 m (a primeira medida, de 6 m a partir de cinco pontos, alcançava 12 m do eixo: *carroças está dando para interagir de muito distante*, 21/10/2026); quem o servidor ainda tem sentado numa carroça que está a mais de 30 m dele (levado por um admin, ou solto pelo jogo sem aviso) é solto, e a dica volta (relato de 20/10/2026: *andei na carroça de um amigo como admin; depois que larguei ela, ao chegar perto o E não apareceu para entrar*).
- **Código:** `src/server/commands/carroca.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/auth.ts`, `src/server/carts.ts`, `src/server/horses.ts`, `src/server/players.ts`
- **No jogador:** `player.steamId`, `player.record`
- **Para ler mais** (pasta `docs/guides`): `World/carts.md`

```text
/carroca  -- as suas carroças e onde estão
/carroca trazer [n]  -- a carroça vazia vem para a sua frente (de dois em dois minutos)
/carroca nome [n] <nome>  -- dá nome à carroça (sem nome, volta ao comum)
/carroca dar <jogador> [modelo]  -- (admin) uma carroça nova para o jogador
/carroca registrar <jogador ou nº>  -- (admin) a carroça sem dono ao lado do jogador, ou uma que o admin deixou no mundo com `colocar`, passa a ser dele (o nome, ou o número da página Jogadores, como 4438)
/carroca listar  -- (admin) todas as carroças com dono
/carroca liberar <n>  -- (admin) a carroça n da lista deixa de ter dono
```

### `/cart`

Cria carroças e carroções do jogo, cavalos incluídos, na sua frente (`list` mostra os modelos). `sit [lugar]` e `leave` sentam e saem. `clear` remove.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos veem
- **Código:** `src/server/commands/cart.ts`, com apoio em `src/server/place.ts`
- **API do motor que usa:** `Cart.blueprints`, `Cart.all`, `Cart.destroyAll`, `Cart.spawn`
- **No jogador:** `player.virtualWorld`, `player.position`, `player.rotation`
- **Para ler mais** (pasta `docs/guides`): `World/carts.md`

```text
/cart [blueprint]
/cart list
/cart sit [seat]
/cart leave
/cart clear
```

### `/cavalo`

Diz onde estão os seus cavalos (a quantos metros e em que direção) e chama o mais perto para vir correndo até você, se estiver a até 300 m. O admin vê todos os cavalos com dono (`listar`) e pode soltar um (`liberar <n>`), que fica no mundo sem dono.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o seu cavalo
- **Nota:** Os cavalos com dono são guardados: veja [O que é salvo e o que não é](#o-que-é-salvo-e-o-que-não-é). O **E** diante do cavalo é o *Montar* do próprio jogo: desde 09/11/2026 não há menu (nem bolsa, nem comida, nem ordem de seguir, e o cavalo não tem mais fome); o **X** assobia, e quem está por perto escuta (veja [O assobio do cavalo](#o-assobio-do-cavalo)).
- **Código:** `src/server/commands/cavalo.ts`, com apoio em `src/server/auth.ts`, `src/server/horses.ts`, `src/server/horses.ts`
- **No jogador:** `player.position`, `player.steamId`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/horses.md`, `NPCs and animals/horse-owners.md`

```text
/cavalo  -- onde estão os seus cavalos
/cavalo chamar  -- o seu cavalo vem correndo, se estiver a até 300 m
/cavalo humor  -- o humor dos seus cavalos (cai com as pancadas do dono, volta com o tempo)
/cavalo humor definir <0 a 100>  -- (admin) põe o humor do cavalo mais perto de você (até 10 m) nesse valor
/cavalo listar  -- (admin) todos os cavalos com dono
/cavalo liberar <n>  -- (admin) o cavalo n da lista deixa de ter dono e de ser guardado
```

### `/dog`

Dá um cão a você, ou lê, renomeia e comanda o que você tem. Modos: `wait`, `follow`, `free`, `aggressive`, `search`, `hunt`, `guard`, `ambush`. `give <id>` entrega e `remove` tira.

- **Quem pode usar:** só admin
- **Quem é afetado:** seu cão; todos veem
- **Código:** `src/server/commands/dog.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Player.getById`, `Dog.spawn`
- **No jogador:** `player.dog`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/dogs.md`

```text
/dog [soul]
/dog info
/dog name [text]
/dog mode <wait|follow|free|aggressive|search|hunt|guard|ambush>
/dog give <player id>
/dog remove
```

### `/horse`

Cria um cavalo seu por raça (`breeds`) ou por alma, e lê, renomeia, monta (`ride`), entrega a outro jogador (`give`), mata e reanima o cavalo perto de você. `gear` equipa e tira arreios.

- **Quem pode usar:** só admin
- **Quem é afetado:** seu cavalo; todos veem
- **Código:** `src/server/commands/horse.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Horse.all`, `Horse.gearItems`, `Horse.gearPresets`, `Horse.breeds`, `Player.getById`, `Horse.spawn`
- **No jogador:** `player.position`, `player.mount`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/horses.md`, `NPCs and animals/horse-owners.md`, `Resources/horse-breeds.md`, `Resources/horse-gear.md`

```text
/horse [breed | soul]
/horse breeds
/horse name [text]
/horse info
/horse ride [instant]
/horse give [player id]
/horse kill | /horse revive
/horse gear [item | off <slot> | bare | preset <name> | presets | lock | unlock | items [slot]]
```

## NPCs, animações e conversas

### `/anim`

Navega pelas animações do próprio jogo e toca em você ou no NPC mais próximo, com os objetos que elas seguram na mão. `hold` carrega um objeto andando. `stop` para.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** você ou o NPC mais próximo
- **Nota:** Emotes e poses (sentar, deitar, trabalhar) para cenas de RP.
- **Código:** `src/server/commands/anim.ts`, com apoio em `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Animations.props`, `Animations.list`, `Player.getById`
- **No jogador:** `player.playAnimation`, `player.stopAnimation`
- **Para ler mais** (pasta `docs/guides`): `Players/actions.md`, `Resources/animation-props.md`

```text
/anim list <search>        -- find animations; then /anim next, /anim prev or /anim <n>
/anim play <fragment> [tags|-] [loop] [prop] [left]
/anim hold <prop>          -- carry a prop while walking
/anim props [search]
/anim npc <fragment> [tags|-] [loop] [prop]  -- on the nearest NPC
/anim stop [standup] | /anim npcstop [standup]  -- standup gets up out of a sitting or lying stance
```

### `/bandidos`

Mostra os acampamentos de bandidos (quantos estão vivos e quantos baús cada um tem), leva você até um deles (`ir <n>`) ou traz de volta os mortos e enche os baús na hora (`repor`).

- **Quem pode usar:** só admin
- **Quem é afetado:** os acampamentos de bandidos; todos veem
- **Nota:** Os acampamentos vêm do próprio nível e se mantêm sozinhos; o comando é para conferir e testar. Veja a seção [Bandidos](#bandidos).
- **Código:** `src/server/commands/bandidos.ts`, com apoio em `src/server/bandits.ts`, `src/server/bandits.ts`
- **No jogador:** `player.teleport`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/npc-combat.md`, `NPCs and animals/npc-inventories.md`

```text
/bandidos  -- cada acampamento, quantos bandidos estão vivos e quantos baús ele tem
/bandidos ir <n>  -- leva você até o acampamento n (cuidado: eles atacam)
/bandidos repor  -- traz de volta os bandidos mortos e enche os baús agora
/bandidos agressividade [baixa|media|alta]  -- o quanto os bandidos veem de longe, batem forte e perseguem; um luta de perto por vez em todos desde 02/11 (sem argumento mostra a atual)
/bandidos armadura [ligar|desligar]  -- (2026-11-02) todos os bandidos num conjunto de armadura que não é saque, não só veteranos e chefes; vale para os que nascerem daqui em diante e volta a desligado no próximo início
```

### `/dialogue`

Abre uma conversa de exemplo na lista de diálogo do próprio jogo. `stop` fecha.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/dialogue.ts`
- **API do motor que usa:** `Dialogue.close`, `Dialogue.update`, `Dialogue.open`
- **Para ler mais** (pasta `docs/guides`): `Quests, dialogue and shops/dialogue.md`

```text
/dialogue
/dialogue stop
```

### `/emboscada`

Mostra se os salteadores das estradas estão ligados, quantas gangues estão na rua e o chão que o servidor leu sob os jogadores; liga e desliga (`liga`, `desliga`, salvo em `playerdata/ambush.json`) e manda uma gangue atrás de um jogador para testar (`agora [jogador]`).

- **Quem pode usar:** só admin
- **Quem é afetado:** salteadores nas estradas; todos veem
- **Nota:** Veja a seção [Salteadores nas estradas](#salteadores-nas-estradas).
- **Código:** `src/server/commands/emboscada.ts`, com apoio em `src/server/ambush.ts`, `src/server/players.ts`
- **No jogador:** `player.ready`, `player.alive`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/npc-combat.md`, `NPCs and animals/npc-inventories.md`

```text
/emboscada  -- se estão ligados, quantas gangues estão nas estradas e o chão onde os jogadores andam
/emboscada <liga|desliga>
/emboscada agora [jogador]  -- manda uma gangue atrás do jogador (ou de você) agora, para testar
```

### `/face`

Define uma expressão facial e faz a boca falar (`talk`, `quiet`) em você ou no NPC mais próximo (`npc ...`). `list` mostra os humores `FE_` do jogo.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** você ou o NPC mais próximo
- **Código:** `src/server/commands/face.ts`, com apoio em `src/server/place.ts`
- **API do motor que usa:** `Animations.list`
- **No jogador:** `player.setTalking`, `player.setFacialExpression`

```text
/face <fragment> [tags|-]   -- e.g. /face FE_DialogueSpeaking happy, /face ADLG_FA_Smile
/face clear                 -- back to the game's own face
/face talk [neutral|happy|drunk|chew] | /face quiet
/face npc <fragment> [tags|-] | /face npcclear | /face npctalk [style] | /face npcquiet
/face list                  -- the FE_ moods the game plays
```

### `/mestres`

Lista os **barbeiros**, onde cada um fica, e leva você até um deles (`ir <id>`). Desde 29/10/2026 os mestres NPC que ensinavam habilidades (esgrima, caça, luta, alquimia e outras) **não existem mais** (`teacherSettings.enabled = false`); o comando só os listaria se o interruptor voltasse a ser ligado. O texto filtra pelo nome ou pelo id.

- **Quem pode usar:** só admin
- **Quem é afetado:** os barbeiros e os mestres; só admin lista e visita
- **Nota:** Os barbeiros e os mestres são NPCs parados que o servidor cria; veja [Barbeiros](#barbeiros) e [Mestres de habilidades](#mestres-de-habilidades).
- **Código:** `src/server/commands/mestres.ts`, com apoio em `src/server/barbers.ts`, `src/server/teachers.ts`, `src/server/teachers-data.ts`
- **No jogador:** `player.teleport`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/npcs.md`, `Quests, dialogue and shops/dialogue.md`

```text
/mestres [texto]  -- cada barbeiro e mestre, onde fica e o que ensina; o texto filtra pelo nome, pelo id ou pela habilidade
/mestres ir <id>  -- leva você até ele
```

### `/gesto`

A **roda do G** (26/10/2026: *vamos adicionar também mais emotes, exemplo usar lampião ou levantar estandarte e coisas do tipo que o jogo deve ter*) tem hoje **57 gestos em 7 grupos**, todos das animações do próprio jogo (`Animations.list`), e `/gesto` é a chave do administrador sobre eles: **`lista`** mostra os gestos de cada grupo com o número, **`desligar <número>`** tira um gesto da roda para todo mundo na hora, **sem reiniciar**, e **`ligar <número>`** põe de volta. Existe porque nenhum desses gestos pôde ser visto no jogo antes de subir: se um ficar feio, o administrador o desliga e avisa qual era. O que está desligado fica em `playerdata/emotes.json` e vale depois de um reinício; o log de início diz quais estão desligados.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos os jogadores, na próxima vez que abrirem o G
- **Os grupos:** *Saudações* (acenar, saudar, assentir, respeito, reverência, apontar, chamar, siga-me, sentido, anunciar, discursar, incitar), *Emoções* (comemorar, aplaudir, aplauso triste, lamentar, susto, encolher-se, nervoso, chorar, exausto, palma na testa), *Rosto* (sorrir, sorriso largo, gargalhar, piscar, surpresa, desconfiar, dúvida, suspirar, nojo, irritação: o rosto faz o gesto e volta), *Humor* (feliz, bravo, triste, aflito, pensativo, arrogante, bêbado, olhos fechados e neutro: o rosto **fica** assim até o *Neutro* ou o *Parar*), *Festa* (dançar, conversar, flauta, flauta alegre, trompa), *Fé* (persignar, rezar, rezar muito, ouvir a missa, pregar, meditar) e *Objetos* (**lampião**, **lampião fino**, **estandarte**, curativo, aquecer as mãos).
- **O lampião e o estandarte são carregados, não tocados:** a mão esquerda segura o objeto (`lamp_tool`, `lamp_toolFancy`, a bandeira da missão do cerco de Suchdol, `oblehaniSuchdole_flag`) com a pose da mão esquerda do próprio jogo (`HoldItemLeft`, que tem a versão andando e correndo), o corpo anda livre, e **pedir o mesmo gesto de novo guarda o objeto** (outro gesto o troca, o **Parar** o guarda).
- **O que o jogo só tem para um corpo só é oferecido a esse corpo só:** a roda pergunta ao servidor a cada abertura (`emote.list`) e o servidor responde pelo catálogo do jogo (as linhas `male` e `female` de `Animations.list`): sentido, incitar, exausto, palma na testa, flauta, trompa, pregar, meditar e aquecer as mãos são de homem; chorar é de mulher; o resto é dos dois.
- **A trompa** é a do vigia da cidade e se ouve a **200 m**: cada jogador só a toca de 60 em 60 segundos.
- **Parar** (o último segmento da roda) solta o que a roda começou: o gesto do corpo, o lampião, o rosto e o humor. Um gesto dura o tempo da animação (ou o limite de cada um, de 2 a 30 s) e termina sozinho; os longos (a flauta, 66 s) se cortam com o Parar.
- **Código:** `src/server/emotes.ts` (a tabela `GESTURES`), `src/server/commands/gesto.ts`, `src/client/emotes.ts` e a página `ui-src/emotes.html` (a roda: os grupos no centro da tela, um clique abre o anel do grupo, o meio volta, `Backspace` também, `1` a `9` e `0` escolhem)
- **API do motor que usa:** `Animations.list`, `Animations.props`
- **No jogador:** `player.playAnimation` (com `props` na mão), `player.stopAnimation`, `player.setFacialExpression`

```text
/gesto lista                 -- os gestos de cada grupo, com o número; os desligados vêm marcados
/gesto desligar <número>     -- tira da roda um gesto que ficou feio no jogo
/gesto ligar <número>        -- põe de volta
```

### `/npc`

Cria NPCs do servidor por papel (`roles`) ou alma e dá ordens: seguir, patrulhar, vir, esperar (`hold`), falar (`say`), trocar a locomoção (`native` é a do jogo, `kinematic` é movida pelo servidor), `kill|revive`, `pin|unpin`, `remove|clear`.

- **Quem pode usar:** só admin
- **Quem é afetado:** servidor (todos veem)
- **Código:** `src/server/commands/npc.ts`, com apoio em `src/server/npc-spawn.ts`, `src/server/args.ts`, `src/server/place.ts`
- **API do motor que usa:** `Npc.roles`, `Npc.all`, `Npc.removeAll`
- **No jogador:** `player.position`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/npcs.md`, `NPCs and animals/npc-orders.md`, `NPCs and animals/npc-events.md`

```text
/npc [role|soulGuid]
/npc roles
/npc list
/npc info
/npc name [text]
/npc follow
/npc patrol
/npc come
/npc hold
/npc say <text>
/npc native | /npc kinematic
/npc kill | /npc revive
/npc pin | /npc unpin
/npc remove | /npc clear
```

### `/npcdemo`

Arranjos prontos de NPCs: caçador experimental, posto de guarda, patrulha em quadrado, escolta, multidão, cena roteirizada e teste de locomoção nativa. `stats` e `reset`.

- **Quem pode usar:** só admin
- **Quem é afetado:** servidor (todos veem)
- **Código:** `src/server/commands/npcdemo.ts`, com apoio em `src/server/npc-spawn.ts`, `src/server/place.ts`
- **API do motor que usa:** `Npc.getById`, `Player.all`, `Npc.roles`, `Npc.all`
- **No jogador:** `player.position`, `player.virtualWorld`, `player.ready`, `player.canAct`, `player.x`, `player.y`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/npc-orders.md`, `Tutorials/scripted-scene.md`

```text
/npcdemo hunter [bow]
/npcdemo guardpost
/npcdemo square [size]
/npcdemo escort
/npcdemo stand [auto|game|server]
/npcdemo crowd [count]
/npcdemo scene
/npcdemo native
/npcdemo stats
/npcdemo reset
```

### `/patrol`

Lista as rotas do World Builder, valida uma (`validate`) e a atribui a NPCs próximos (`start`, `stop`, `status`).

- **Quem pode usar:** só admin
- **Quem é afetado:** servidor
- **Código:** `src/server/commands/patrol.ts`, com apoio em `src/server/place.ts`
- **API do motor que usa:** `WorldResource.all`, `WorldResource.ready`, `PatrolRoute.all`, `PatrolRoute.getById`, `Navigation.validatePatrol`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/patrol-routes.md`, `Tutorials/world-builder-patrol.md`

```text
/patrol list
/patrol start <route-id>
/patrol validate <route-id>
/patrol status
/patrol stop
```

### `/quest`

Escreve uma missão no diário do jogo e a faz avançar: `give <chave> "<título>" [tipo]`, `desc`, `step` (objetivo), `done <chave> <índice>`, `state` (active, done, failed), `list`, `show`, `remove`, `clear`. Tipos: main, side, activity, event, micro, racing.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/quest.ts`, com apoio em `src/server/args.ts`
- **API do motor que usa:** `Quest.all`, `Quest.find`, `Quest.removeAll`, `Quest.give`
- **No jogador:** `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `Quests, dialogue and shops/quests.md`, `Quests, dialogue and shops/quest-tracking.md`

```text
/quest give <key> "<title>" [main|side|activity|event|micro|racing]
/quest desc <key> "<description>"
/quest step <key> "<objective text>" [optional]
/quest done <key> <index>
/quest state <key> <active|done|failed>
/quest list
/quest show <key>
/quest remove <key>
/quest clear
```

### `/vendedor`

**Desligado desde 29/10/2026:** os NPCs vendedores foram removidos (`vendorSettings.enabled = false` em `src/server/vendors.ts`), então a lista vem vazia; o comando serve de novo se o interruptor for religado. Mostra e posiciona os NPCs vendedores do servidor: cinco ofícios (ferreiro, boticário, taberneiro, caçador e alfaiate) em Suchdol, e 13 mascates, um em cada fogueira de beira de estrada do nível. `listar` diz onde fica o lugar de cada um, a casa onde mora, quanto tem na bolsa e o que está fazendo agora; `aqui <id>` leva o vendedor para onde você está, virado como você, e o lugar escolhido passa a ser o dele; `reabastecer` enche as prateleiras e `padrao` devolve todos aos lugares originais.

- **Quem pode usar:** só admin
- **Quem é afetado:** os NPCs vendedores; todos veem
- **Nota:** A posição escolhida fica em `playerdata/vendors.json` e volta depois de um reinício. As prateleiras se enchem sozinhas a cada 15 minutos.
- **Código:** `src/server/commands/vendedor.ts`, com apoio em `src/server/position.ts`, `src/server/vendors.ts`
- **No jogador:** `player.position`, `player.rotation`
- **Para ler mais** (pasta `docs/guides`): `Quests, dialogue and shops/vendors.md`, `NPCs and animals/npcs.md`

```text
/vendedor listar  -- cada vendedor e mascate, onde está e o que faz
/vendedor aqui <id>  -- leva o vendedor para onde você está, virado como você, e o lugar escolhido passa a ser o dele (ids: ferreiro, alquimista, taberneiro, cacador, alfaiate, em Suchdol, e mascate-1 a mascate-13, nas fogueiras de beira de estrada)
/vendedor reabastecer  -- enche as prateleiras agora (elas se enchem sozinhas a cada 15 minutos)
/vendedor padrao  -- todos voltam aos lugares originais
```

### `/barbeiro`

Os barbeiros (2026-11-02): onde está cada um, e para pôr um onde você está, virado como você; o lugar escolhido fica guardado em `playerdata/barbers.json` e vale nos próximos inícios. Na seção NPCs do painel (F3) os barbeiros e os cocheiros da viagem aparecem junto dos comerciantes de cada cidade, cada um com o comando que o muda de lugar (o cocheiro com `/viagem cocheiro <parada>`; `/viagem aqui <parada>` leva a carroça junto).

- **Quem pode usar:** só admin
- **Quem é afetado:** o barbeiro
- **Código:** `src/server/commands/barbeiro.ts`, com apoio em `src/server/barbers.ts`, `src/server/townsfolk.ts`

```text
/barbeiro  -- cada barbeiro, onde está e se o lugar foi escolhido
/barbeiro aqui <id>  -- o barbeiro (ex.: barbeiro-suchdol) passa a ficar onde você está
/barbeiro padrao [id]  -- um barbeiro (ou todos) volta ao lugar original
```

### `/mercador`

Mostra e posiciona os **comerciantes de guilda** (31/10/2026): um para cada uma das oito guildas em cada uma das 16 cidades e terras da Cidadania, 128 ao todo, parados onde o jogo põe o ofício (o ferreiro na loja do ferreiro, o taberneiro no balcão da taverna, o domador onde o nível vende cavalos...). Os lugares vêm das entidades do próprio nível (`tools/make-guild-posts.py`); onde a vila é pequena e o jogo não põe aquele ofício, o comerciante fica **em volta do meio da vila**, e `listar` avisa para você levá-lo para o lugar certo com `aqui <id>`. Eles só existem **de dia** (40 minutos de dia, 40 de noite): ao anoitecer o corpo some (quem está falando com ele termina a conversa) e de manhã volta, perto de um jogador.

- **Quem pode usar:** só admin
- **Quem é afetado:** os comerciantes de guilda; todos veem
- **Nota:** O lugar escolhido fica em `playerdata/guild-posts.json` e volta depois de um reinício. O que cada comerciante vende e compra, e a bolsa de 300 moedas de cada jogador com ele, estão em `NPCS.md`.
- **Código:** `src/server/commands/mercador.ts`, com apoio em `src/server/guild-vendors.ts`, `src/server/guild-shops.ts`, `src/server/guild-posts-data.ts`
- **No jogador:** `player.position`, `player.rotation`

```text
/mercador listar [cidade]  -- cada comerciante, se está em pé, onde fica e se o lugar veio do jogo (ids: <ofício>-<cidade>, ex.: ferreiro-suchdol, alquimista-wysoka)
/mercador aqui <id>  -- leva o comerciante para onde você está, virado como você; o lugar escolhido passa a ser o dele
/mercador padrao [id]  -- um comerciante (ou todos) volta ao lugar original
```

### `/desgaste`

O jogo desgasta armas, armaduras e ferramentas depressa demais para este servidor (31/10/2026: *os itens estão quebrando muito rápido*, "deixar no médio"). O servidor devolve ao item parte do que o jogo tirou de cada vez: com o valor padrão, **55% do desgaste do jogo** continua valendo. `/desgaste` mostra o valor; `/desgaste <5 a 100>` muda, para todos (100 é o desgaste do jogo, sem ajuda). As ferramentas dos Coletores (machado e picareta) gastam além disso menos por golpe.

**Quebrar no zero (04/11/2026).** *"Quando uma roupa, arma ou armadura, qualquer coisa do tipo, chegar a 0 de durabilidade deve quebrar e sumir do inventário do jogador."* Quando o desgaste do jogo (golpe, pancada levada, caminhada para as botas) deixa uma peça em **0%**, o servidor a **tira do inventário**, vestida ou não, e o dono lê no chat *"(nome da peça) quebrou de tanto uso e sumiu do seu inventário."* Só o desgaste de uso quebra: **comida estragada também fica em 0% e continua no inventário**, e nada que foi feito, achado, comprado, dado ou consertado em 0% some por isso. Quem não quer perder a peça conserta antes (kit de reparo, ferreiro, sapateiro). O ajuste do `/desgaste` não muda o ponto de quebra. As peças que **já estavam em 0%** antes da regra (96 em 67 personagens no dia, 69 delas botas e sapatos) **somem na próxima entrada do dono**, 15 s depois de ele aparecer no mundo, uma vez por sessão, com uma linha só no chat: *"Peças que estavam com 0 de durabilidade quebraram e sumiram do seu inventário: ..."* (só o que o jogo lista como equipável: roupa, armadura, capuz, elmo, arma; nunca comida nem peça de missão). As **ferramentas dos Coletores** (machado e picareta) seguem a mesma regra: trabalham até 0 e **quebram** (*"O seu machado quebrou de tanto uso e sumiu do inventário. Faça outro no ferreiro."*); antes paravam em 2% esperando conserto. Log: `wear: <jogador>: <peça> (<classe>) quebrou com o uso e saiu do inventário`, `wear: <jogador>: N peça(s) com 0 de durabilidade saíram do inventário na entrada: ...` e `coleta: <jogador>: o machado quebrou com o uso e saiu do inventário`. Código: `src/server/wear-break.ts` (e `wear-ease.ts` não devolve nada à peça que chegou a 0).

- **Quem pode usar:** só admin
- **Quem é afetado:** todos os jogadores
- **Nota:** O valor fica em `playerdata/wear-ease.json`.
- **Código:** `src/server/commands/desgaste.ts`, com apoio em `src/server/wear-ease.ts`

```text
/desgaste  -- quanto do desgaste do jogo continua valendo
/desgaste <5 a 100>  -- muda para todos (100 = o desgaste do jogo)
```

### `/vendor`

Abre a tela de comércio do próprio jogo com preços definidos pelo servidor. `stall` cria um NPC feirante (Ondra) na sua frente, que abre a loja quando você fala com ele e tem 500 moedas. `here` abre a mesma loja de exemplo direto, sem ninguém atrás do balcão e com bolsa que nunca acaba. `reset` remove as barracas e a loja.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Nota:** Os preços são em unidades do item `money`, o mesmo que `/give money 100` entrega. Base para mercados e lojas.
- **Código:** `src/server/commands/vendor.ts`, com apoio em `src/server/npc-spawn.ts`, `src/server/place.ts`
- **API do motor que usa:** `Vendor.open`, `Vendor.destroy`, `Vendor.create`, `Vendor.setStock`, `Vendor.setBuyPrices`, `Npc.getById`
- **Para ler mais** (pasta `docs/guides`): `Quests, dialogue and shops/vendors.md`, `Tutorials/market-stall.md`

```text
/vendor stall
/vendor here
/vendor reset
```

### `/viagem`

As **paradas da viagem rápida de carroça** (`src/server/travel.ts`): cada uma com a sua carroça, o seu cocheiro, onde estão, quem escolheu o lugar (à mão, vendo a vila de cima no World Builder; um admin; ou o jogo), se o cocheiro está acordado, e o preço. São **13 paradas**, e a carroça de cada uma foi **posta à mão** em 20/10/2026: na beira da estrada que sai da vila, **do lado de fora**, fora da pista e ao longo dela, de frente para longe da vila, com o cocheiro do lado da estrada e o ponto de chegada do outro lado da carroça. O servidor não lê chão nenhum para elas (a posição, o giro, o cocheiro e a chegada de cada uma estão em `STOPS`, no campo `fixed`). Uma que ficou num lugar estranho se corrige com `/viagem aqui <parada>`: a carroça vai para a sua frente, de lado, e o cocheiro fica do seu lado dela; `/viagem original <parada>` traz de volta o lugar escolhido à mão. Só uma parada que um admin cria com `/viagem nova` não tem lugar escolhido: `/viagem procurar <parada>` faz o jogo do admin ler o chão em volta do ponto (`World.resolveGround`: grama limpa ao lado da estrada) e `/viagem malha` deixa só a malha de navegação escolher. Veja [Viagem rápida de carroça](#viagem-rápida-de-carroça).

- **Quem pode usar:** só admin
- **Quem é afetado:** as paradas e quem viaja
- **Código:** `src/server/commands/viagem.ts`, com apoio em `src/server/travel.ts`, `src/server/townsfolk.ts`, `src/server/carts.ts`
- **No jogador:** `player.teleport` (`ir`)

```text
/viagem  -- as paradas, as carroças, os cocheiros e o preço
/viagem aqui <parada>  -- a carroça da parada na sua frente, de lado, e o cocheiro do seu lado dela
/viagem cocheiro <parada>  -- só o cocheiro, onde você está
/viagem original <parada>  -- a carroça e o cocheiro voltam ao lugar escolhido à mão para a parada
/viagem procurar <parada>  -- (parada nova) o chão é lido pelo SEU jogo (fique a menos de 150 m do ponto da parada) e a carroça vai para a beira da estrada
/viagem malha <parada>  -- (parada nova) só a malha de navegação escolhe o lugar (não sabe o que é estrada: a carroça pode ficar sobre ela)
/viagem ir <parada>  -- leva você até a parada
/viagem preco <base> <por km>  -- o preço das viagens, em moedas
/viagem nova <id> <nome>  -- uma parada nova onde você está
/viagem remover <parada>  -- tira a parada (carroça e cocheiro)
```

## Ofícios e itens

### `/conjunto`

Os **conjuntos de armadura** do próprio jogo (os trajes com que ele veste guardas e soldados), separados pela **vila, cidade ou senhor** de quem os usa, cada um com a **categoria** pelo preço (básica, comum, boa, excelente, nobre), o **peso** (roupa, leve, média, pesada) e o código de cada peça. A lista completa, para ler, está em `ARMADURAS.md` (ao lado de `ITENS.md`): 173 conjuntos de 19 lugares, até três por tipo de soldado (o mais barato, o do meio e o mais caro), e mais o 20º lugar, **Brasões** (`/conjunto brasoes`), com 19 pacotes; e, no fim do arquivo, os **Cavalos** (pedido de 22/10/2026: *me dê o do cavalo de Trosky e dos brasões também das casas*: os 71 conjuntos de arreio do próprio jogo, por lugar e casa, e as 45 peças de cavalo nas cores de cada casa, para o `/horse gear`) e as **Casas e cidades** (*casacos com brasões de casas e cavaleiros por região, em uma lista separada, junto ao escudo, à armadura e à roupa dos cavalos*: uma lista só para cada uma das 19 casas, cidades, ordens e reinos com brasão, com as peças que levam o brasão, o escudo e a espada, as armaduras do lugar e a roupa do cavalo, e o comando de cada coisa).

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado (ou você)
- **Nota:** `vestir` troca a roupa inteira pela do conjunto (o jogo só tem esses trajes para corpo de homem); `dar` põe as peças no inventário, para quem quiser vestir aos poucos, e serve para mulher também. A qualidade vai de 1 a 4.
- **Brasões** (pedido de 21/10/2026: *os casacos com o brasão de cada casa junto ao escudo dos cavaleiros de cada região que tem um brasão, e a espada do cavaleiro também*): um pacote por cidade, casa, ordem ou reino que tem brasão no jogo (`brasao-kuttenberg`, `brasao-praga`, `brasao-skalitz`, `brasao-bergow`, `brasao-holohlavy`, `brasao-leipa`, `brasao-nebakov`, `brasao-pisek`, `brasao-polner`, `brasao-radzig`, `brasao-ruthard`, `brasao-semine`, `brasao-suchotlesky`, `brasao-vavak`, `brasao-zavish`, `brasao-zimburg`, `brasao-ordem-teutonica`, `brasao-ordem-da-cruz`, `brasao-hungria`). Cada um traz o **sobretudo (e o casaco comum) com o brasão**, o **escudo de cavaleiro** dele e a **espada do cavaleiro** (`shortswordHeavy`); onde o jogo não tem casaco com o brasão (Skalitz, Radzig, Zimburg, Holohlavy, Zavish, Suchotlesky, Ordem da Cruz) vêm só o escudo e a espada, e onde só há o escudo triangular (Polner, Holohlavy, Zavish, Suchotlesky) é ele. São pacotes montados pela ferramenta, não trajes do jogo: só `dar` (`/conjunto dar brasao-kuttenberg Radovan`), nunca `vestir`. As outras versões do brasão de cada peça estão em `ARMADURAS.md`, na coluna *Outras cores*.
- **Tirar** (pedido de 22/10/2026: *coloquei um set de Malešov nele sem querer, retire urgente, foram 8 itens*): `/conjunto tirar <id> [jogador]` tira do inventário do jogador **uma unidade de cada peça** do conjunto, a de qualidade 1 (a que o `dar` entrega) primeiro, e diz quantas saíram e quais não estavam; não mexe em mais nada. O jogador precisa estar online. Se o jogo recusar (peça vestida, por exemplo), nada sai e o comando avisa.
- **Código:** `src/server/commands/conjunto.ts`, com apoio em `src/server/armor-sets.ts` e `data/armor-sets.json` (feitos por `tools/make-armor-sets.py`)

```text
/conjunto  -- os lugares, com quantos conjuntos cada um tem
/conjunto <lugar>  -- os conjuntos de um lugar, com o id, a categoria e o peso (brasoes: os pacotes de brasão)
/conjunto ver <id>  -- as peças de um conjunto
/conjunto dar <id> [jogador] [qualidade]  -- as peças no inventário
/conjunto vestir <id> [jogador]  -- veste o conjunto inteiro
/conjunto tirar <id> [jogador]  -- tira do inventário uma de cada peça do conjunto (desfaz um dar enganado)
```

### `/crafttest`

Teste das bancadas de ofício: confere a posição das estações de alquimia e ferraria (`alchemy`, `smithing`), dá ingredientes de teste e ensina as receitas. O servidor é dono dos ingredientes e dos resultados.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/crafttest.ts`, com apoio em `src/server/args.ts`
- **API do motor que usa:** `Player.getById`, `World.raycast`, `Crafting.stations`, `World.resolveGround`, `World.entitiesInRadius`, `World.raycastAll`, `Crafting.recipes`, `Crafting.knowledge`, `Crafting.setKnowledge`
- **No jogador:** `player.position`, `player.ready`, `player.teleport`, `player.giveItem`, `player.hasPerk`, `player.addPerk`
- **Para ler mais** (pasta `docs/guides`): `Players/alchemy.md`, `Players/smithing.md`

```text
/crafttest <alchemy|smithing> [rounds=1] [station=1]
/crafttest move <alchemy|smithing> [station=1]
/crafttest <alchemy|smithing> list
/crafttest check
```

### `/oficios`

(admin) Usar só as ferramentas da sua guilda, como um jogador comum, ou as de todos os ofícios. Um administrador com guilda obedece a ela (a forja, as mesas de alquimia, o fogo, o secador, o defumador); `livre` libera todas até ele sair do servidor. Também aceita `/ofícios`.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/oficios.ts`, com apoio em `src/server/guild-crafts.ts`, `src/server/status.ts`

```text
/oficios  -- como você está
/oficios guilda  -- só as ferramentas da sua guilda, como um jogador comum
/oficios livre  -- as de todos os ofícios, até você sair do servidor
```

### `/coleta`

(admin) A guilda dos **Coletores** (veja [A coleta](#a-coleta)): as regras de agora (os segundos por lenha e por tentativa na pedra, quanto cada árvore e pedra dá, quanto descansa, as chances da pedra), e quantas árvores e pedras estão em trabalho ou descansando. `sondar` diz o que o jogo vê para onde você olha, a até 6 m (a categoria `tree` ou `rock`, o modelo e o lugar): é o que conta para a coleta. `kit` dá um machado de lenhador e uma picareta para testar (a picareta usada, como a do kit). `descansar` faz toda árvore e pedra voltar a dar.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você, ou o jogador citado (`kit`)
- **Código:** `src/server/commands/coleta.ts`, com apoio em `src/server/gather.ts` e `src/server/level-edits.ts` (a sondagem)

```text
/coleta  -- as regras e quantas árvores e pedras estão em trabalho ou descansando
/coleta sondar  -- o que está para onde você olha (árvore, pedra, o modelo), a até 6 m
/coleta kit [jogador]  -- um machado de lenhador e uma picareta, para testar
/coleta descansar  -- toda árvore e pedra volta a dar
```

### `/horta`

As **hortas** dos Agricultores (veja [A horta e os cavalos selvagens](#a-horta-e-os-cavalos-selvagens)). Qualquer jogador pergunta o que plantou e quando fica pronto, e as cinco hortas mais perto; o administrador, para testar, faz toda plantação ficar pronta na hora ou esvazia todos os canteiros.

- **Quem pode usar:** jogador e admin (`crescer` e `limpar`, só admin)
- **Quem é afetado:** só você (`crescer` e `limpar`, todos)
- **Código:** `src/server/commands/horta.ts`, com apoio em `src/server/farm.ts` e `src/server/farm-data.ts`

```text
/horta  -- o que você plantou e quando fica pronto
/horta perto  -- as cinco hortas mais perto de você, com quantos canteiros livres
/horta crescer  -- (admin) toda plantação fica pronta agora, para testar
/horta limpar  -- (admin) esvazia todos os canteiros
/horta aqui [metros]  -- (admin) marca um canteiro onde você está, com a fileira para onde você olha (3 m; de 1,5 a 8)
/horta tirar  -- (admin) tira o canteiro marcado mais perto (até 4 m), com o que nele estiver plantado
```

### `/selvagens`

(admin) Os **cavalos selvagens** dos campos abertos: quantos há e como se comportam, os cinco mais perto com a confiança de cada um em você, e como testar a doma sem horas de cenoura (`confianca 100`: o cavalo mais perto já aceita ser montado). `ir` leva você até o mais perto; `repor` tira todos e põe de volta nos seus campos. Um administrador sem guilda doma como um agricultor; um com guilda usa `/oficios livre`.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/selvagens.ts`, com apoio em `src/server/wild-horses.ts`

```text
/selvagens  -- quantos cavalos selvagens há e como eles se comportam
/selvagens perto  -- os cinco mais perto de você, com a distância e a confiança deles em você
/selvagens ir  -- leva você ao cavalo selvagem mais perto (a até 5 m dele)
/selvagens confianca <0-100>  -- a confiança do cavalo mais perto em você, para testar (100: ele já aceita ser montado)
/selvagens repor  -- tira todos e põe de volta nos seus campos
```

### `/oficinas`

(admin) As forjas e mesas de alquimia que o nível tem, com a distância de você e quem está usando cada uma.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/oficinas.ts`
- **API do motor que usa:** `Crafting.stations`, `Crafting.occupancy`

```text
/oficinas
```

### `/customitems`

Prepara itens personalizados para teste. `grant` (padrão) entrega madeira e uma carta personalizadas; `rename` troca o nome mostrado da carta enquanto o inventário está aberto; `defaults` devolve o nome padrão; `vendor` abre um vendedor com esses itens.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/customitems.ts`, com apoio em `src/server/commands/book.ts`
- **API do motor que usa:** `Items.register`, `Inventory.add`, `Vendor.create`, `Vendor.setStock`, `Vendor.setBuyPrices`, `Vendor.open`, `Inventory.get`, `Inventory.updateCustom`
- **No jogador:** `player.emit`, `player.ready`
- **Para ler mais** (pasta `docs/guides`): `Players/custom-items.md`, `Tutorials/custom-letter.md`

```text
/customitems [grant]
/customitems rename
/customitems defaults
/customitems vendor
```

### `/pot`

Panelões de comida: inspeciona (`/pot`), lista receitas, reabastece gastando comida do inventário (`refill porridge|vegetable|meat`), lista os seus venenos e envenena (`poison <linha>`).

- **Quem pode usar:** só admin
- **Quem é afetado:** panelão próximo
- **Nota:** Afeta as refeições dos jogadores; não envenena NPCs nem dispara o sistema de crime do jogo.
- **Código:** `src/server/commands/pot.ts`, com apoio em `src/server/cook-pots.ts`
- **API do motor que usa:** `CookPot.poisons`, `Inventory.get`, `CookPot.refillFromInventory`, `CookPot.poison`
- **Para ler mais** (pasta `docs/guides`): `World/cook-pots.md`

```text
/pot
/pot recipes
/pot refill <porridge|vegetable|meat>
/pot poisons
/pot poison <inventory row>
```

## Cerco

### `/siege`

Constrói, carrega e dispara trabucos e canhões (`trebuchet`, `cannon`). Ajusta velocidade, vida (`health`), munição (`ammo`), tripulação (`crew`) e guia de mira (`guide`), repara, e cuida de escadas de cerco (`ladder`) e pilhas de pedra (`stones`). `list`, `remove`, `clear`.

- **Quem pode usar:** só admin
- **Quem é afetado:** servidor (todos veem)
- **Código:** `src/server/commands/siege.ts`, com apoio em `src/server/args.ts`, `src/server/build.ts`, `src/server/place.ts`
- **API do motor que usa:** `SiegeEngine.all`, `SiegeEngine.getById`, `SiegeLadder.getById`, `SiegeLadder.all`, `Navigation.floorAt`, `SiegeEngine.destroyAll`, `SiegeLadder.destroyAll`, `StonePile.destroyAll`
- **No jogador:** `player.position`, `player.virtualWorld`, `player.rotation`
- **Para ler mais** (pasta `docs/guides`): `World/siege-engines.md`

```text
/siege trebuchet|cannon
/siege load [id]
/siege fire [distance] [id]
/siege fire at <player id> [id]
/siege speed <multiplier> [id]
/siege health <hit points> [id]
/siege ammo <shots> [id]
/siege crew <winches> [id]
/siege repair [id]
/siege guide on|off [id]
/siege ladder [siege|tall|short|low]
/siege ladder push|raise|break|repair [id]
/siege stones [count]
/siege list
/siege remove <id>
/siege clear
```

## Diversão e testes

### `/blipdemo`

Coloca um de cada tipo de blip ao seu redor, mais um que gira, para conferir a bússola e o mapa. `clear` remove.

- **Quem pode usar:** só admin
- **Quem é afetado:** todos no mundo virtual
- **Código:** `src/server/commands/blipdemo.ts`, com apoio em `src/server/place.ts`
- **API do motor que usa:** `Blip.getById`, `Blip.create`
- **No jogador:** `player.position`, `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `Resources/blip-icons.md`

```text
/blipdemo
/blipdemo clear
```

### `/disguise`

Desenha você, ou outro jogador, como um objeto do catálogo (`barrel_a`, `crate_box_a`...). `off` volta ao corpo.

- **Quem pode usar:** só admin
- **Quem é afetado:** você ou outro jogador (`@jogador`)
- **Código:** `src/server/commands/prophunt.ts`, com apoio em `src/server/players.ts`, `src/server/commands/camera.ts` (o mesmo arquivo implementa também `/invisible`, `/pick`)
- **No jogador:** `player.emit`, `player.setDisguise`, `player.setVisible`

```text
/disguise <model> [@player]  -- a path or a file stem, e.g. barrel_a, crate_box_a
/disguise off [@player]      -- back to a body
```

### `/invisible`

Para de desenhar você, ou outro jogador, em qualquer lugar: corpo, roupas e o que está na mão. `off` volta.

- **Quem pode usar:** só admin
- **Quem é afetado:** você ou outro jogador (`@jogador`)
- **Código:** `src/server/commands/prophunt.ts`, com apoio em `src/server/players.ts`, `src/server/commands/camera.ts` (o mesmo arquivo implementa também `/disguise`, `/pick`)
- **No jogador:** `player.emit`, `player.setDisguise`, `player.setVisible`

```text
/invisible [@player]      -- stop drawing them
/invisible off [@player]  -- draw them again
```

### `/pick`

Traça uma linha da sua mira e diz o que ela encontrou, inclusive qual jogador, disfarçado ou não.

- **Quem pode usar:** só admin
- **Quem é afetado:** só você
- **Código:** `src/server/commands/prophunt.ts`, com apoio em `src/server/players.ts`, `src/server/commands/camera.ts` (o mesmo arquivo implementa também `/disguise`, `/invisible`)
- **No jogador:** `player.emit`, `player.setDisguise`, `player.setVisible`

```text
/pick
```

## Teclas

| Tecla | O que faz | Onde está definido |
| --- | --- | --- |
| `F2` | Abre e fecha o painel na categoria **Comum** (também fecha com `Esc` ou no X). Fecha quando a tecla é **solta**, não quando é apertada, e o painel só recebe o teclado depois que a tecla que o abriu foi solta: assim um mesmo toque não é lido pelo jogo e pela página ao mesmo tempo. Com um nome sendo digitado ou um formulário aberto, a tecla não fecha o painel. O aviso de entrada diz qual tecla apertar | `src/client/status.ts` |
| `F3` | **Só admin**: abre o mesmo painel na categoria **Administração** (Chaves e Jogadores), **sem precisar abrir o F2 antes**: enquanto o servidor não disse que o jogador é admin, cada aperto pergunta de novo (quem virou admin com `/admin` no meio da sessão abre na hora). Com o painel aberto, a tecla da outra categoria troca de categoria, e a da categoria aberta fecha. Para um jogador, não faz nada | `src/client/status.ts` |
| `H` | **Voz**. O jogador **segura o `H` para falar**, a tecla do próprio mod (09/11/2026: *vamos deixar pré-ativo o de segurar para falar*). Na manhã de 09/11/2026 o mod pôs o `V` no lugar e desligou o carinho do jogo (`companion_bond`, `horse_saddle_bond`); à noite o pedido foi desfeito (*devolva o voip para o H e ativar o carinho no cavalo, pelo visto no próprio menu do mod tem como mudar*): o mod **não põe mais tecla nenhuma** (a que o jogador escolher no menu do próprio mod vale) e o `V` é do jogo de novo, o carinho com o cavalo e o cão. Quem preferir escolhe o **microfone aberto** em Opções → Microfone: ele envia sozinho quando o jogador fala, sem segurar tecla (`voiceActivity`, com o ruído do ambiente filtrado e uma sensibilidade à escolha: alta, média ou baixa). Enquanto o servidor não disse o que o jogador escolheu, o microfone só envia com a tecla apertada | `src/client/voice.ts`, `src/server/voice-settings.ts` |
| `Y` | Troca o alcance da voz: sussurro (3 m), fala (15 m) e grito (25 m) (a ação *Voice range* do KCDC, em Controles → Multiplayer). Ao trocar, o **indicador da voz** aparece por 2,4 s com o alcance novo, na cor dele | KCDC e `src/client/voice.ts` |
| `F4` | Painel de debug do gamemode (mesmo que `/ui`). **Só admin**: a tecla pede ao servidor, que abre o painel para admin e responde com uma linha no chat para os outros | `src/client/index.ts` e `src/server/panel.ts` |
| `Tab` | **Desligada para todos** (`mod.scoreboard: false` no `server.json`): é uma opção do servidor inteiro, não dá para ligar só para o admin. A lista de jogadores do admin está no painel, seção **Jogadores** | `server.json` |
| `E` olhando para outro jogador | **Conversar**: abre a lista de diálogo do jogo com Apresentar-se, Jogar dados, Negociar, Desafiar para um duelo e Sair (é a tecla de interação do jogo, a que o jogador tiver configurado). Veja [Encontros entre jogadores](#encontros-entre-jogadores) | `src/client/property-labels.ts` e `src/server/encounters.ts` |
| `E` numa porta ou baú de uma propriedade | O **E do jogo**: abre e fecha o que está destrancado. Numa porta ou baú trancado o jogo só oferece, do lado da fechadura, o **arrombamento dele** (segurar `E`, com gazua e a habilidade), e o servidor diz que está trancado (*aperte F para destrancar*, para quem pode). **Por dentro**, o `E` numa porta trancada puxa o ferrolho e abre. Veja [Fechaduras](#fechaduras-e-abre-f-tranca) | `src/client/property-labels.ts` e `src/server/property-menu.ts` |
| `F` numa porta ou baú de uma propriedade | **[F] Trancar** ou **[F] Destrancar**, para quem tem a chave, é o dono, mora no quarto daquela porta ou baú, ou é admin, dos dois lados da porta; numa casa de várias portas, só aquela porta. O **[F] Trancar** só aparece numa porta **fechada e destrancada**: numa porta **aberta** o F não oferece nada (trancá-la a fechava sozinha; 25/10/2026: *o trancar no F só pode aparecer nas portas fechadas, não nas abertas*), e uma porta já trancada continua com **[F] Destrancar**. Para os outros o `F` não faz nada ali. É a tecla do jogo para agarrar e esfolar (`attack_special`), que porta e baú não usam | `src/client/property-labels.ts` e `src/server/property-menu.ts` |
| `F` diante de um quadro de avisos | **[F] Quadro de avisos**: abre a página dos cartazes do quadro (o aviso aparece a 3,2 m do ponto diante das tábuas, com a mira no quadro). `Esc`, o X ou andar para longe a fecham. É a mesma tecla do fogo: não há fogo ao lado de um quadro | `src/client/cook-hint.ts` (tipo 7), `src/client/mural.ts` e `src/server/mural.ts` |
| `Esc`, `F2` ou `F3` com a câmera livre ligada, ou o botão **Sair da câmera** | `Esc`, `F2` e o botão voltam à câmera normal; `F3` também, e abre o painel da administração (`F2`, o comum); de qualquer jeito, ela volta sozinha em 5 minutos. Quem ouve as teclas é uma página do mod (`ui/freecam.html`), porque o voo pronto do jogo engole todas | `src/client/camera.ts`, `ui-src/freecam.html` |
| `W` `A` `S` `D`, `Espaço`, `Ctrl`, `Shift`, `Alt`, as **setas**, o mouse arrastado e `H` na câmera livre | `W A S D` voam, `Espaço` sobe, `Ctrl` desce, `Shift` acelera, `Alt` vai devagar; as **setas** e o mouse arrastado viram a câmera; `H` mostra de novo a ajuda e o botão de sair, que somem sozinhos depois de 9 segundos (e voltam quando o ponteiro se mexe) | `ui-src/freecam.html` |
| `G` | A **roda de gestos**: abre uma roda de **sete grupos** (Saudações, Emoções, Rosto, Humor, Festa, Fé e Objetos) e o **Parar**; um clique num grupo abre o anel dos gestos dele (o meio da roda volta, `Backspace` também, `1` a `9` e `0` escolhem, `G`, `Esc` ou um clique fora fecham). Entre os gestos há o **lampião** e o **estandarte**, que a mão esquerda carrega enquanto o corpo anda (o mesmo gesto de novo guarda). Cada corpo vê só os gestos que o jogo tem para ele. Veja [`/gesto`](#gesto) | `src/client/emotes.ts`, `src/server/emotes.ts` e `ui-src/emotes.html` |
| `X` | **Assobio**: o cavalo do jogador mais perto vem correndo, o mesmo que **Chamar** no painel (o assobio do jogo chama um cavalo que no multiplayer ninguém tem; o mod ouve a tecla). Montado no próprio cavalo, ou sem cavalo, não acontece nada. **No inventário (o menu de pausa) vale**: é de lá que o jogador chama o cavalo para guardar itens nele (pedido de 16/10/2026). **Não vale** nas telas do jogo em que o X confirma (seleção de itens, troca, livro, tela de pular o tempo, arrombamento, roubo, a inspeção do cavalo), nem numa conversa, com um livro aberto ou com uma página do mod no teclado: um **X** apertado para confirmar numa dessas telas não chama o cavalo | `src/client/whistle.ts` e `src/server/horses.ts` |
| `T` | Abre o chat: o **cartão de papel** embaixo à esquerda (acima do logo do mod), na identidade do painel, com os **dois cantos dourados** (o leão em cima à esquerda e o corvo embaixo à direita) e, **à esquerda do campo de texto, um menu** (*Falar*, `/me`, `/do`, `/try`, `/dice`, `/anim`, `/face`, `/camera`, `/idioma` e `/help`, cada um com uma linha do que faz): escolher um põe o comando no começo da linha, e o nome do botão acompanha o que o jogador escreve. `Esc` fecha o menu e, de novo, o chat; `Enter` envia; as setas para cima e para baixo trazem as linhas de antes | `ui-src/chat.html` e `src/client/chat-card.ts` |
| `F7` | World Builder, depois de `/builder` | framework |
| `U` (segurar 1 s) | Oferece a paz para encerrar um combate | `src/server/combat.ts` e `src/client/combat.ts` |
| `F9` | Desconecta do servidor | cliente do jogo |
| `G`, `R`, `Backspace` | Só no criador **do próprio jogo** (`/creator nativo`): trocar gênero, visual aleatório e voltar ao visual de abertura | framework |
| Mouse e `Esc` no criador de personagem | Arrastar à esquerda gira a câmera em volta do personagem, a roda do mouse aproxima e afasta; `Esc` fecha uma lista aberta e, para quem já tem personagem, pergunta se quer sair (**quem entra pela primeira vez não pode sair**) | `ui-src/creator.html` |

> **Por que `F2` e `F3`.** O painel morava no `U`, que é do jogo: segurar `U` por 1 segundo perto de um oponente em luta oferece a paz (`Offer to end combat`). Depois ele foi pedido na vírgula e no ponto, mas o mod (KCDC 1.6.9) não aceita nenhuma tecla de pontuação: `Key.bind` só conhece letras, números, `F1` a `F12`, setas, modificadoras, teclas de edição, teclado numérico e botões do mouse, e recusa `comma` e `period`. As setas, que ficaram no lugar por um dia, também andam com o personagem no KCD2. Nos mapas de teclas do próprio jogo (`Libs/Config/defaultProfile.xml` e `keybindSuperactions.xml`, dentro de `Data/IPL_GameData.pak`), o `F2` não faz nada e o `F3` só existe no mapa de debug, desligado no jogo normal. Entre os controles do mod, o `F2` só seria do `kcdc-playground`, que não está instalado.

As demais ações do mod (roda de emotes, grupo, interação com NPC, alcance da voz: sussurro, fala e grito) ficam em **Controles → Multiplayer** no jogo.

> **O indicador da voz (23/10/2026, refeito em 09/11/2026).** O microfone que o mod desenha embaixo à esquerda (e o ícone de fala no nome de quem o jogador ouve) fica escondido (`Voice.setIndicatorVisible(false)`, só depois que a página do servidor desenhou; se ela não abre, o do mod continua). No lugar, um **ícone de microfone com três ondas de cada lado, sem moldura e sem texto**, embaixo no centro da tela, onde ficava o retângulo, um pouco acima da barra de vida (`ui/voice.html`, 3,4% da altura da tela, entre 30 e 44 px: 52 x 37 px numa tela de 1080p; era 5,2%, de 44 a 64 px, e ficou grande demais): a **cor é a do alcance** (**sussurro** azul-aço, **fala** dourado, **grito** vermelho) e as ondas acesas são o volume do microfone (`Voice.getInputLevel`, numa escala de decibéis: −42 dB é nada e −10 dB é tudo; uma onda no mínimo enquanto o jogador fala, três numa voz alta). Aparece quando o jogador fala e some 0,7 s depois da última palavra; ao apertar o `Y` aparece por 2,4 s mesmo calado, com tantas ondas acesas quanto o alcance novo (uma, duas ou três). Não aparece com o chat escondido (câmera livre, criador de personagem) nem com a voz do jogo desligada. Como a vista só existe enquanto alguém fala, ela não pesa nos quadros por segundo.
>
> **A ajustar depois de testar no jogo** (tudo em `src/client/voice.ts`): `THRESHOLDS` (onde o microfone aberto passa a enviar: 0,02, 0,04 e 0,08 para alta, média e baixa), `LEVEL_FLOOR_DB` e `LEVEL_CEIL_DB` (a escala das barras), `hudGeometry` (a posição, que foi um palpite em relação à barra de vida), `HANG_MS` e `FLASH_MS`. O log do cliente guarda as primeiras 40 falas de cada sessão com o nível máximo lido, como `voice: falou 2.4 s, nível máximo 0.173 (aberto, abre em 0.04)`: com esses números dá para acertar a sensibilidade sem adivinhar.

O jogador comum vê a lista das teclas e dos comandos do servidor no próprio painel, em **F2 → Opções → Teclas**.

## Comandos do console do servidor

São digitados no terminal do servidor, não no chat. Hoje o servidor roda como serviço do sistema (`systemd`) e não tem terminal interativo, então na prática o caminho é `systemctl restart kcdc-server` depois de mexer no código. Se quisermos o console, dá para rodar o servidor dentro de `tmux` ou `screen`.

| Comando | O que faz |
| --- | --- |
| `start <recurso>` / `stop <recurso>` | Liga e desliga um recurso (pasta em `resources/`) |
| `restart <recurso>` | Recarrega um recurso que está ligado |
| `ensure <recurso>` | Recarrega se estiver ligado, liga se não estiver |
| `refresh` / `refreshall` | Registra pastas novas em `resources/` / e recarrega todos os recursos ligados |
| `status` | Nome, endereço e número de jogadores |
| `stop` (sem nome) ou `quit` | Desliga o servidor |
| `help` | Lista os verbos do console |
| `hudspawn on\|off\|status` | Teste do `/hud`: esconde a barra Stats no spawn |

## Como criar um comando novo

Cada comando é um objeto `Command` (`src/server/command.ts`) com `name`, `summary`, `usage` e `run`. Um arquivo novo em `src/server/commands/` e uma linha em `src/server/index.ts` bastam; o `/help` e o painel F4 passam a listá-lo sozinhos.

```ts
// src/server/commands/ola.ts
import type { Command, CommandContext } from "../command.js";

export const olaCommand: Command = {
    name: "ola",
    summary: "Cumprimenta quem digitou.",
    usage: ["/ola [nome]"],

    run({ player, args, reply, usage }: CommandContext): void {
        if (args.length > 1) {
            usage();
            return;
        }
        reply.line(`Salve, ${args[0] ?? player.nickname}.`);
    },
};
```

```ts
// src/server/index.ts
import { olaCommand } from "./commands/ola.js";
commands.add(olaCommand);
```

- `args` já vem separado por espaços; `readQuoted` e `readNumber` (`src/server/args.ts`) tratam nomes entre aspas e números.
- `retarget(args, player)` (`src/server/players.ts`) entende o `@jogador` no fim da linha, como em `/appearance` e `/socialstatus`.
- Um erro lançado dentro de `run` não derruba nada: o jogador recebe a mensagem e o erro vai para o log.
- Comandos que precisam de tela, teclado ou câmera têm uma metade no cliente (`src/client/`), que fala com o servidor por eventos (`player.emit` e `Events.emitServer`). O `/creator` e o painel são os exemplos mais completos.

Ciclo para testar na VPS:

```text
npm run build                              (na pasta resources/kcdc-gamemode, para conferir se compila)
npm test                                   (os testes automáticos; precisa de Node 20 ou mais novo)
enviar os arquivos para /opt/kcdc/server-linux/resources/kcdc-gamemode
ssh kcdc-vps, e lá: npm run build, depois systemctl restart kcdc-server
journalctl -u kcdc-server -f               (acompanhar o log)
```

## Do que o RP precisa e por onde começar

| Necessidade | O que já existe para aproveitar |
| --- | --- |
| Visual, bens e progresso do personagem | `/creator`, `/appearance`, `/outfit`; `characters.ts` (visual por Steam ID), `first-join.ts` (aplica ao entrar) e `character-state.ts` (inventário, níveis, receitas e vitais) |
| Classe social e guilda | `status.ts` (catálogos e persistência em `playerdata/social.json`), `/socialstatus`, painel com as abas Personagem e Guildas |
| Casas e propriedades | `/propriedade mapear` (cataloga sozinho as casas e os baús), seção Chaves do painel, `/chave`; `/door` e `/stash` para ajustes pontuais; `/marker` e `/blip` para sinalizar |
| Comércio | Os cinco vendedores do servidor (`vendors.ts`, `/vendedor`); entre jogadores, a negociação do menu de conversa (`trade.ts`); `/vendor`, API `Vendor`, `/customitems vendor` e o tutorial `Tutorials/market-stall.md` para o resto |
| Quem é quem | Nomes escondidos e apresentações (`encounters.ts`, `acquaintances.ts`): cada um só vê o nome de quem se apresentou a ele |
| Ofícios | Kits e livros de receita (`kits.ts`, `books.ts`), `/crafttest` (alquimia e ferraria), `/pot`, ervas (`/herbs`, `World/gathering.md`) |
| Transporte | `/horse` e `/cavalo` (cavalos com dono são guardados: `horses.ts`), `/cart`, `/dog` |
| Voz e imersão | segurar o `H` para falar, o padrão, ou microfone aberto (`voice.ts`, `voice-settings.ts`, escolha em Opções → Microfone); indicador próprio da voz (`ui/voice.html`); alcance por jogador (`Voice.setPlayerRange`); sussurro, fala e grito (`Voice.setTier`, tecla `Y`); `/mute` |
| Hora e clima | Ciclo de 40 minutos de dia e 40 de noite com clima sorteado (`world-cycle.ts`, `/clima`); `/world` e `World/clock-and-weather.md` para o resto |
| Vida no mundo | Acampamentos de bandidos (`bandits.ts`, `/bandidos`), animais (`animals.ts`, `/animals`), `/npc`, `/patrol`, `/dialogue`, `/quest` |
| Entrada e administração | `auth.ts` (tickets com hash, perfis jogador e admin, bloqueio de comandos) e `scripts/auth.mjs`. Ainda não há comando de expulsar ou banir; as ações estão em `Players/actions.md` |

## Conceitos que aparecem nos comandos

- **GUID:** identificador único de um item, alma (NPC), porta, baú ou área do jogo. Vários comandos aceitam o GUID ou o nome exato entre aspas.
- **Slot:** o número da conexão de um jogador, o mesmo da lista da tecla Tab. Vale para `/tp`, `/mute`, `/lookalike`.
- **Mundo virtual (`virtualWorld`):** camada que separa o que cada grupo de jogadores vê. Muitos comandos agem só no mundo virtual de quem digitou (`Core concepts/virtual-worlds.md`).
- **Alma (`soul`):** a identidade de um personagem no jogo, usada para criar NPCs, cavalos e cães específicos (`Resources/souls.md`).
- **Moeda:** o item `money` aparece no jogo dividido por 10. Todo valor em dinheiro no código está na unidade do item (1.000 = 100 moedas); veja o kit inicial.
- **Steam ID:** a chave com que o servidor lembra do jogador entre sessões. Jogadores sem Steam ID não têm visual, guilda nem status salvos.
- **Servidor é a autoridade:** o cliente só pede; quem decide e aplica é o servidor (`Core concepts/authority.md`).
- **O que fica salvo em disco**: veja a seção [O que é salvo e o que não é](#o-que-é-salvo-e-o-que-não-é).
- **Onde o jogador nasce:** o jogo não tem pontos de nascimento, então sem ajuda todo mundo cai no ponto inicial do nível (o castelo). `src/server/position.ts` grava onde cada jogador está (a cada 20 segundos, ao sair e quando o servidor para) e, no `playerSpawning`, põe quem volta no mesmo lugar, virado para o mesmo lado. **Um jogador novo, sem lugar salvo, nasce na estrada de chegada às terras de Kuttenberg, a oeste de Suchdol** (pedido de 16/10/2026): o próprio caminho por onde o jogo traz o Henry à vila (a missão *Chegada a Suchdol*), onde a carroça de Žižka e Katerina começa, a uns 500 m de Suchdol, virado para a vila. Há três pontos a poucos passos um do outro (364,9 / 3745,6 / 131,4; 359,7 / 3744,2 / 131,3; 381,6 / 3727,8 / 131,5), sorteados, para dois novatos não nascerem no mesmo lugar (`src/server/spawns.ts`, marcadores do nível `prijezdNaSuchdol_*`); o log diz `spawns: Fulano chegou pela primeira vez: Estrada de chegada, ...`. Quem já jogou continua voltando ao último lugar. Para mudar o ponto de chegada, edite a lista `spawnPoints`. Nunca se grava o lugar de quem ainda não nasceu (seria o ponto inicial) nem de quem está em outro mundo virtual.


## Acesso, tickets e perfis

A entrada no servidor e o perfil de cada pessoa vêm de um **ticket** no link de entrada. O servidor guarda só o **hash** (scrypt, com sal) de cada ticket, em `secrets/auth.json` na VPS: quem ler o arquivo não consegue entrar. O ticket em si só aparece uma vez, quando é criado.

```text
kcdc://37.148.132.184?nickname=Mauro&ticket=admin.xxxxxxxxxxxxxxxxxxxxxxxxxx
                                          rotulo.segredo
```

Os atalhos `Entrar no servidor - Jogador.lnk` e `Entrar no servidor - Admin.lnk` (na pasta `RP KCD II`) abrem o jogo já neste link, sem passar pelo menu. Eles contêm o ticket em texto: guarde e não compartilhe, nem suba para o GitHub. Atalhos `.bat` não servem: o `cmd` com `start` travou o jogo no menu.

**A entrada às vezes trava na tela de carregamento.** Em 13 e 14/10 travou várias vezes, conectando 0,1 segundo, 3,4 segundos e até 11 minutos depois de o menu aparecer, então não é só o atalho (que conecta logo que o menu aparece). O servidor responde igual nas entradas que dão certo e nas que travam (numa delas mandou o pacote inteiro em 0,3 segundo), e o cliente para depois de `Loading the session level`, sem erro nenhum. A saída é fechar o jogo por completo e entrar de novo. O `/admin` continua valendo: entre pelo menu, como jogador comum, e digite `/admin nome.segredo` no chat para virar administrador até sair. O diagnóstico completo está na memória do projeto (`join-hang-diagnosis`).

| Estado | Quando acontece | O que o servidor faz |
| --- | --- | --- |
| Aberto | Não existe `secrets/auth.json` | Ninguém é verificado e todos são admins. É o estado de uma instalação nova |
| Observação | O arquivo existe com `"enforce": false` | Lê os tickets e dá os perfis, mas quem chega sem ticket ou com ticket errado entra como jogador. Serve para testar o link sem se trancar para fora |
| Bloqueio | O arquivo existe com `"enforce": true` | Ticket ausente ou errado é recusado antes de baixar qualquer coisa. Oito erros seguidos do mesmo IP em 10 minutos travam esse IP por um tempo |
| Quebrado | O arquivo não pode ser lido ou entendido | Recusa todo mundo e registra o motivo no log. Falhar aberto esconderia o erro |

O arquivo é lido de novo a cada pedido de entrada, então mudar um ticket ou ligar o bloqueio vale para o próximo jogador, sem reiniciar. Comandos, sempre a partir de `/opt/kcdc/server-linux` e como o usuário `kcdc` (senão o servidor não consegue ler o que foi escrito):

```sh
sudo -u kcdc /opt/nodejs/bin/node resources/kcdc-gamemode/scripts/auth.mjs list
sudo -u kcdc /opt/nodejs/bin/node resources/kcdc-gamemode/scripts/auth.mjs add player amigo     # imprime o ticket novo, uma vez
sudo -u kcdc /opt/nodejs/bin/node resources/kcdc-gamemode/scripts/auth.mjs revoke amigo
sudo -u kcdc /opt/nodejs/bin/node resources/kcdc-gamemode/scripts/auth.mjs enforce on          # liga o bloqueio (off desliga)
```

Para trocar o ticket de admin: `revoke admin`, depois `add admin admin`, e refazer o atalho `.lnk` de admin com o ticket novo (ou usar o `/admin` com ele).

**O que isto não cobre.** O bloqueio vale para quem entra e para os comandos de chat. Um cliente modificado que mande à mão os eventos internos do gamemode (por exemplo, os de construção) não passa por ele. E a documentação do servidor não garante que a conexão do jogo seja cifrada, então o ticket pode ser visto por quem espiar o tráfego: é uma tranca de porta, não um cofre.

**Ao atualizar o servidor** (trocar a pasta `server-linux` por uma versão nova), copie junto `secrets/`, `playerdata/`, `server.json` e `files/`. Sem `secrets/`, o servidor volta ao estado aberto e todos viram admins.

### Lista de contas aprovadas

Uma **segunda tranca**, ao lado da senha do mundo (que todos compartilham): só entram as contas que a administração aprovou (pedido de 16/10/2026). Fluxo: a pessoa preenche o formulário do servidor (Google Forms), a administração a aprova e põe o **Steam ID** dela na lista. O personagem é guardado pelo Steam ID (`playerdata/characters/<steamId>.json`), então fica preso à conta com que foi criado.

A lista é o arquivo `secrets/whitelist.json` (junto de `auth.json`), lido de novo a cada pedido de entrada: uma aprovação vale na próxima tentativa da pessoa, sem reiniciar. Comandos, sempre a partir de `/opt/kcdc/server-linux` (na VPS há o atalho `kcdc-whitelist`, que roda o mesmo como o usuário certo):

```sh
kcdc-whitelist add <steamId ou link do perfil> [nome]    # aprova uma conta (o link steamcommunity.com/profiles/<id> serve)
kcdc-whitelist remove <steamId>                          # tira a aprovação
kcdc-whitelist list                                      # quem está aprovado
kcdc-whitelist enforce on                                # liga o bloqueio (off desliga)
```

| Estado | Quando acontece | O que o servidor faz |
| --- | --- | --- |
| Aberto | Não existe `secrets/whitelist.json` | Entra quem souber a senha |
| Observação | O arquivo existe com `"enforce": false` | Entra todo mundo, e o log diz quem a lista teria recusado (`whitelist: Fulano (Steam ...) não está na lista; entrou porque o bloqueio está desligado`) |
| Bloqueio | O arquivo existe com `"enforce": true` | Quem não está na lista é recusado antes de baixar qualquer coisa, com a mensagem *Sua conta ainda não foi aprovada no Kingdom RP Brasil. Faça a inscrição pelo formulário (no nosso Discord) e aguarde a aprovação.* |
| Quebrado | O arquivo não pode ser lido ou entendido | Recusa todo mundo e registra o motivo no log, como o `auth.json` |

**Quem entra sem conta Steam é recusado** (pedido de 25/10/2026: *independente do nome que o jogador colocar no menu, ao entrar no mundo ele sempre deve ir para um personagem já criado vinculado à Steam dele*). O personagem é guardado pelo Steam ID (`playerdata/characters/<steamId>.json`), nunca pelo nome digitado no menu de entrada do jogo (38 dos 68 personagens salvos foram feitos por quem entrou como "Player", o nome padrão); o que podia dar errado era o outro lado: de vez em quando o cliente não informa conta alguma (a Steam fechada ou fora do ar naquele instante: 26 de 1.378 entradas em nove dias, sempre das mesmas oito máquinas, que entravam com a conta no minuto seguinte). Esse corpo entrava como um estranho: estrada de chegada, o criador de novo, e nada do que fizesse era salvo. Agora `src/server/steam-gate.ts` recusa a entrada sem conta Steam, com a mensagem *Não recebi a sua conta Steam. Abra o Steam (ligado e online), feche o jogo e entre de novo pelo launcher...* (em português e inglês), e um corpo que chega ao mundo sem a conta que o jogo autenticou (`player.steamId`) é tirado do servidor. O arquivo `secrets/steam-gate.json` com `{ "required": false }` desliga a exigência na hora (para o dia em que a checagem do próprio mod falhar para todo mundo); sem o arquivo, ou com ele ilegível, a conta é exigida. O boas-vindas já não usa o nome do menu: diz o nome do personagem (ou só *Bem-vindo ao Kingdom RP BRASIL* a quem ainda não criou um). **Só contas Steam entram na lista.** O personagem é guardado pelo Steam ID, e o servidor só recebe do jogo, de quem o comprou na GOG, nenhum identificador; de quem usa a Epic, um id que o resto do mod não usa. Essas contas são recusadas como as que não estão na lista, até o mod aprender a guardar os personagens por outra chave. **Comece pondo o seu próprio Steam ID na lista, antes de ligar o bloqueio**, ou você mesmo fica de fora. **Estado atual (16/10/2026, a pedido: *desativar por enquanto, até eu conseguir configurar 100%*): o bloqueio está DESLIGADO** (`"enforce": false` em `secrets/whitelist.json`; `kcdc-whitelist list` diz `bloqueio: desligado`): entra quem souber a senha, e o log só anota quem a lista teria recusado. As 4 contas que já jogaram estão na lista. O comando `whitelist` do console, que valia só até o servidor parar, deixou de existir.

### Quem pode o quê

| Perfil | Comandos |
| --- | --- |
| Jogador | `/acordar`, `/admin`, `/anim`, `/cachorro`, `/camera`, `/cansaco`, `/carroca`, `/cavalo`, `/chave`, `/cozinhar`, `/dice`, `/do`, `/face`, `/fome`, `/help`, `/horta`, `/idioma`, `/language`, `/leitura`, `/me`, `/mural`, `/mute`, `/mutes`, `/paz`, `/preso`, `/sede`, `/sujeira`, `/try`, `/unmute` |
| Admin | Todos os 80 |

Para liberar mais um comando aos jogadores, inclua o nome em `COMMON_COMMANDS` (`src/server/auth.ts`) e gere de novo este documento. A checagem fica em `CommandRegistry.dispatch` (`src/server/command.ts`), então vale para o chat e para a caixa de comando do F4.

## Limite de tamanho do pacote do cliente

Tudo que o servidor manda para o jogador ao entrar (os scripts de cliente compilados e a pasta `ui/` com suas imagens e fontes) vai num **único pacote**. O servidor loga o tamanho dele, comprimido, a cada início: `Packaged client resource 'kcdc-gamemode': N files, B bytes`.

Foi medido neste servidor: pacotes de até **510.619 bytes** baixam normalmente (213 KB, 411 KB, 435 KB, 475 KB e 510 KB deram certo). Com **643.623 bytes** o download não termina: o jogo trava na tela de carregamento, sem erro em lugar nenhum, e o log do cliente para em `Loading the session level` sem nunca registrar `Asset downloaded` (visto em duas tentativas seguidas). Os pacotes de **705.903 bytes** e de **4,5 MB** também travaram, em testes anteriores. Não se sabe o limite exato; ele fica entre 510 KB e 643 KB, e 512 KiB (524.288 bytes) cabe em todos os pontos medidos.

Por isso o pacote é mantido abaixo de **480.000 bytes** e o teste `tests/packagesize.test.cjs` falha se passar disso. Para ficar dentro:

- as imagens da interface são geradas por `tools/make-ui-images.py` já no tamanho em que aparecem na tela (cerca de 1,5 vez o tamanho a 1920×1080), e não no tamanho em que foram desenhadas;
- imagens WebP e fontes não comprimem mais, então cada KB delas conta como um KB no pacote;
- as texturas do livro de demonstração saíram: a `parchment_diff.dds` (177 KB comprimidos; com ela o `/book parchment`) e o selo `seal.dds` (8 KB; o `/book` perdeu a figura do selo). A pasta `assets/` deixou de existir e de ser empacotada;
- para caber a seção Apoiador (arte de 35 KB, título, QR code), a fonte Cinzel virou só o peso 600, o único que o painel usa (de 23 KB para 13 KB), os brasões passaram para qualidade 62 (iguais a olho nu; 33 KB a menos), as molduras dos cantos para 220 px e a foto do fundo para 560 px;
- os scripts do cliente são compilados **sem comentários** (`removeComments` em `src/client/tsconfig.json`): 11 KB a menos;
- a página do painel é escrita em `ui-src/status.html`, com comentários e recuos, e o `npm run build` a **empacota** em `ui/status.html` (`scripts/pack-ui.mjs`, que lê o script com o parser do TypeScript e tira comentários e recuos: de 161 KB para 130 KB, ou de 38 KB para 31 KB comprimidos). **Edita-se `ui-src/status.html`.** O `tests/packui.test.cjs` confere que o empacotamento não muda o que a página diz e que `ui/status.html` é o atual;
- a árvore da hierarquia (a arte bordada da seção Nomeação) tem 400 px de altura e a transparência em qualidade 35, que era a maior parte do peso: 24 KB em vez de 30 KB. Numa arte de contorno cheio de folhas, quase tudo pesa na transparência, não na cor.

Com a seção Nomeação o pacote chegou a 503.000 bytes pela medida local e voltou a **478.931** com essas reduções. O servidor loga uns 1,7% a mais (`487005 bytes` em 2026-10-15), ainda abaixo dos 510.619 já medidos.

Com a árvore, o ceder região e as barras novas a página chegou a 175,3 KB escritos, e o empacotador passou a **tirar também os espaços do CSS** (133,9 KB empacotados). Os onze títulos de seção passaram a qualidade 40 de transparência. O pacote atual é de **476.655** bytes pela medida local, contra o limite de 480.000 do teste.

Para caber a página do criador de personagem (24 KB empacotados, 7,6 KB comprimidos, mais 3,7 KB do script de cliente dele), a **transparência dos ornamentos** baixou para qualidade 12 a 30 (os onze títulos de seção, os cantos, a corda, os brasões pequenos e a árvore da hierarquia): comparados lado a lado e ampliados duas vezes, não se distinguem dos de antes, e foram 14 KB a menos. O empacotador (`scripts/pack-ui.mjs`) passou a empacotar **as duas páginas**, `status` e `creator` (uma lista `PAGES`), e o teste confere que cada uma é a atual. O pacote é de **474.497** bytes pela medida local (o servidor loga uns 1,7% a mais), contra o limite de 480.000: **sobram 5,5 KB**. Depois vieram a câmera livre (a página `freecam`, 3,7 KB), o cartão da região, a chave de duas faces da hierarquia, a lista de baús que rola sozinha e a trava ao olhar: o pacote está em **479.010** bytes pela medida local, contra o mesmo limite, e **sobra menos de 1 KB**. Qualquer coisa nova na página do painel pede antes diminuir imagens ou estilo.

**2026-10-21: as imagens do painel saíram do pacote** (305 KB delas): as 28 do painel (brasões das guildas, facções e cidades, títulos das seções menos o do Personagem, a árvore, os brasões dos animais e das propriedades, o logo) viraram entradas de `data/ui-images.json` e o servidor as manda quando a página as pede. O pacote logado foi de `52 files, 166897 bytes` (eram `80 files, 470525`), e a margem sob os 480.000 do teste é de uns 300 KB. Para acrescentar uma imagem ao painel, ponha-a em `tools/make-ui-images.py` (fora da lista `LOCAL`) e use `data-img="nome"` no HTML ou `setPic(img, "nome")` no script.

As pastas `stream/` e `replace/` de um recurso (modelos, sons, texturas do jogo) seguem outro caminho, os *asset paks*, e não entram nesse pacote; mas eles servem para arte do próprio jogo, não para as imagens de uma página da interface.

## Seções do painel

O painel abre com o **F2** na categoria **Comum**, para todos, e com o **F3** na categoria **Administração**, só para admin; é a mesma página, mostrando uma categoria de cada vez (cliente em `src/client/status.ts`, página em `ui-src/status.html`, empacotada em `ui/status.html`, servidor em `src/server/status.ts`). Quem decide quem é admin é o servidor, pelo perfil do ticket; a página só esconde o que não é do jogador, e o servidor confere o perfil de novo em cada pedido.

**As imagens vêm do servidor** (21/10/2026: *as imagens do F2 vamos deixar para vir do servidor, assim o F2 fica mais leve*). Do painel só ficam no pacote do cliente o papel, a foto do fundo, as molduras dos cantos, o título do Personagem e o QR do Pix; os brasões, os títulos das outras seções, a árvore e o painel dos animais são pedidos pela página, pelo nome, quando ela os desenha (`status.image`, `src/server/ui-images.ts`, de `data/ui-images.json`, feito por `tools/make-ui-images.py`), e o cliente guarda o que recebeu para a abertura seguinte. O pacote foi de 470.525 para **166.897 bytes**.

**Fechar limpa tudo.** A página só existe enquanto o painel está aberto: cada abertura cria uma página nova (escondida até terminar de desenhar) e fechar a descarta inteira, com as imagens e a memória dela, então o painel fechado não pesa no jogo. O cliente guarda só as últimas respostas do servidor (alguns KB) e a seção em que o painel estava, para a página nova abrir já preenchida e no mesmo lugar. Por isso abrir leva uma fração de segundo a mais do que antes, quando a página ficava carregada escondida.

| Seção | Categoria | O que mostra e faz | Onde fica salvo |
| --- | --- | --- | --- |
| Personagem | Comum | Nome (o que o jogador deu ao personagem no criador, com a alcunha; o apelido da conta, para um personagem feito antes do criador pedir o nome); **Titulus** (os títulos que o jogador tem, do mais alto ao mais baixo, quando tem algum); **Status Socialis** (Plebeius ou Nobilis); **Status Coniugalis** (Caelebs, solteiro; Coniugatus, casado; Viduus, viúvo; no feminino se o personagem for mulher); **Cognomen** (o sobrenome, quando há um); numa linha de três (02/11/2026), **Aetas** (a idade), **Statura** (a altura) e **Gradus** (o **nível**: a soma dos níveis de todas as habilidades do jogo, a do relatório do jogo, ou a salva enquanto ele não chega); vida, stamina, fome, **sede** e **energia**; e, à direita, abas **Guilda** e **Cidadania** para escolher o que fica em destaque | `playerdata/social.json`, `titles.json` |
| Guildas | Comum | As seis guildas (Ferreiro, Caçador, Taberneiro, Alquimista, **Artesão**, que é a antiga de alfaiate; o jogo não tem ofício de alfaiate, mas tem as roupas para vender; e **Coletor**, desde 21/10/2026, com o brasão do usuário); o jogador escolhe uma e, na primeira vez em cada guilda, recebe o kit dela | `playerdata/social.json` |
| Cartas | Comum | As cartas que chegaram para o jogador (lacradas até ele romper o selo) e as que ele mandou, e o formulário de uma carta nova: para quem (qualquer personagem), título, texto com os estilos dos cartazes, com o nome ou sem assinatura, e o selo (lacre simples, o brasão da cidadania ou o da guilda dele). 10 moedas; o mensageiro demora mais quanto mais longe. Veja [Cartas](#cartas) | `playerdata/letters.json` |
| Família | Comum | Árvore genealógica por gerações, com o sobrenome da família. Cada parente pode ser marcado como **falecido**, ser **um jogador do servidor** e, sendo filho, **legítimo, adotivo ou bastardo** | `playerdata/family.json` |
| Propriedades | Comum | As casas e baús que são do jogador, agrupados por **região** (um menu filtra: **Minhas**, ou uma das regiões cedidas ao jogador, uma de cada vez). Clicar numa propriedade abre à direita o brasão, o nome, a região, a descrição, o dono e o estado, **parados no alto**, e a lista **dos baús e das portas**, que é a única parte que rola (os botões ficam parados embaixo). O dono **edita o nome e a descrição**, **tranca e destranca** a casa e cada baú pelos botões, e **faz chaves** da casa e de cada baú, para si ou para outro jogador do servidor (até 8 chaves por propriedade). Uma casa com **várias portas** lista as portas sob ela, como lista os baús, cada uma com o seu botão de trancar. O dono pode **entregar a casa** a outro jogador (com confirmação). Uma **região cedida** a ele pelo admin aparece inteira: o que é dele ele mexe, o que é de um NPC ou de outro dono aparece só para ler | `playerdata/properties.json`, `regions.json` |
| Animais | Comum | Os cavalos do jogador (vida, fôlego, arreios, onde está, se está montado) e o cão, para quem apoia (o que está fazendo, a ordem e o ânimo). **Chamar**, **Dar nome** (e, para o cão, só esses dois: as ordens dele são o **E** diante dele). Atualiza a cada 2,5 segundos enquanto a seção está aberta. Veja [Animais do jogador](#animais-do-jogador) | `horses.json`, `supporters.json` |
| Opções | **Configurações** | **Terceira pessoa** (ligar, desligar, e a distância: perto, normal ou longe; fica salva), **Microfone** (segurar o `H`, o padrão, ou aberto, e a sensibilidade do aberto), **Teclas** (todas as teclas e os comandos do chat do servidor, por grupo, para o jogador comum), **Câmera livre**, para gravar e tirar fotos, e **Título sobre a cabeça** (mostrar um dos seus títulos, ou nenhum). Veja [Opções](#opções) | `playerdata/options.json`, `titles.json` |
| Nomeação | **Nobre** (só para quem é nobre, e para o admin, que nomeia como a Coroa) | Três vistas: **Nomear** (os títulos que o jogador pode dar e, à direita, o título escolhido com o botão **Nomear**, que abre o quadro *Para quem* e a confirmação), **Títulos** (os dele, quem o nomeou, e as pessoas que ele nomeou, com **Deixar o título** e **Retirar o título**) e **Ver hierarquia** (o reino todo, título por título, com os jogadores que os têm, as terras de cada um e a árvore da hierarquia). Veja [Títulos e status social](#títulos-e-status-social) | `playerdata/titles.json` |
| Chaves | Administração | As propriedades de **uma região de cada vez** (o menu de regiões escolhe; abre na região mais perto do admin, e as propriedades do próprio admin vêm de qualquer região), com busca dentro dela: com 17 regiões mapeadas o catálogo tem mais de mil propriedades, e uma linha para cada uma deixava o F3 pesado de abrir e baixava o FPS (21/10/2026). O servidor manda só a região aberta e uma linha por região com o que ela tem (para a conta do cartão da região); a escolha de outra região é pedida ao servidor (`status:propRegion`). Só aparecem as casas e os edifícios; os baús ficam dentro da casa, no detalhe à direita (os que não estão em casa nenhuma aparecem com o botão **Baús avulsos**). O detalhe mostra, parados no alto, o brasão, o nome, a região, a descrição, o dono e o estado, e só a lista dos baús e das portas rola. O admin **entrega a propriedade** a um jogador (ele vira o dono; **nenhuma chave vai junto**, ele pega as que precisar, uma de cada vez, pelo painel), tira o dono, entrega ou pega chaves, **tranca e destranca** a casa e cada baú, e edita o nome, a descrição e a região. Uma **casa de vendedor** mostra o morador (NPC) e não pode ser entregue. O **cartão da região**, sempre à vista logo acima da lista (*Ceder a região inteira a ...* ou, com *Para mim* em *Quem recebe*, *Pegar a região inteira*), vale para a região do filtro ou, sem filtro, a da propriedade escolhida, diz quantas propriedades sem dono ela tem e passa a quem foi escolhido tudo o que não tem dono nela, depois de mostrar a conta: quantas propriedades e baús passam, quantas casas de NPC e quantas de outros donos ficam | `playerdata/properties.json`, `regions.json` |
| Apoiador | **Configurações** | A arte do nobre com o cão, a frase *Concordia parvae res crescunt* e o agradecimento, com o que o apoio dá (trajes de nobre e um cão fiel) e o botão **Apoiar**, que abre à direita um **aviso em vermelho** (*Diga por qual streamer você chegou ao jogo*: o jogador escreve o nome do streamer, ou do canal, junto com o comprovante no Discord, ou diz que chegou por conta própria), o QR code do Pix, o valor e o que conferir no banco antes de pagar. Quem já apoia vê *Apoiador desde ...* | `supporters.json` |
| Jogadores | Administração | Quem está no servidor agora. Clicar num jogador abre à direita o brasão da guilda dele, o nome, o status social e civil, o sobrenome, a guilda, se é apoiador, os títulos e as cinco barras (vida, stamina, fome, **sede** e **energia**), e os botões **Títulos** (os que tem, para retirar, e todo o catálogo, para dar), **Status social**, **Terras** (cede a ele uma região inteira, com a conta antes: o que passa, o que é de NPC e o que já tem dono) e **Dar benefícios** (este com Confirmar e Cancelar). Substitui a lista do `Tab`, que está desligada para todos; atualiza a cada 3 segundos enquanto a página está aberta | `supporters.json` |
| Cidadania | Comum | As cinco cidades (Suchdol, Raborsch, Malešov, Kuttenberg e Pschitoky), cada uma com o brasão; ao clicar abre à direita o senhor das terras, a **Lady das terras** (a esposa dele, quando há), o nome da família dele e a quantidade de cidadãos. O botão *Tornar-me cidadão* é definitivo; para o senhor das terras há *Ver cidadãos* (oito por página, com *Depor*). | `playerdata/citizenship.json` |

**As listas de jogadores, uma página de cada vez (02/11/2026: *"imagina 512 jogadores e ter que carregar tudo isso sem paginação"*).** Toda lista de jogadores do painel vem do servidor uma página de cada vez, com a busca e o filtro feitos no servidor: **Jogadores** (12 por página), os seletores **Para quem** de dar, ceder, ligar parente e nomear (8), o **Para quem** das **Cartas** (8, todos os personagens, no jogo ou não), os **membros de uma guilda** (10), os **cidadãos** de uma cidade (8). A **hierarquia** da Nomeação vai inteira, em partes, e se filtra por região na página (uma árvore não se pagina). Fora do painel: o F4 mostra você e os 40 mais perto; `/teleport list` mostra 60 nomes, `/emboscada` 20, `/appearance who` 30 e `/entrada` 40, cada um com "e mais N".

**A barra de seções (09/11/2026).** *"vamos retirar o ícone de logo do menu F2 e F3, que é o brasão, e vamos colocar as opções da sidebar de forma de navbar, tudo lá no topo, assim não usamos mais os brasões e o conteúdo pega toda a horizontal"*. As seções ficam numa **barra no topo** e a página ocupa a **largura toda** embaixo dela; a coluna da esquerda e o brasão do leão e do corvo saíram. Os grupos de antes viram trechos da barra, separados por um traço fino vertical (o nome do grupo não é mais escrito; a linha que corria embaixo da barra, a do título de cada seção, menos o marcador vermelho, e a de cima do rodapé *F2 Comum, Esc Fechar* saíram em 09/11/2026): **Comum** (Personagem, Guildas, Cidadania, Família, Cartas, Propriedades, Animais), **Reino** (Nomeação, para nobres e admin), **Guildas** (Costurar, só para o Artesão), **Configurações** (**Apoiador** e **Opções**; a seção **Informações**, com os tópicos de cada parte do painel, foi apagada em 09/11/2026: *apaga a seção informações também por favor*) e **Administração** (Chaves, Jogadores e NPCs, no F3). A página decide o que mostrar pelo que o servidor diz (`nobility.visible`, `lordNpcs.visible`, a guilda, o perfil). A guilda sem brasão (quem ainda não escolheu uma) mostra um escudo apagado. O leão do canto de cima ficou menor, para caber sobre o começo da barra.

**Executar (04/11/2026).** *"Na seção jogadores vamos criar, além do banir, a opção executar um jogador: executa, aparece na tela dele mostrando que ele foi executado, e ele recria um personagem do zero."* Só o **administrador**, no botão **Executar** do jogador (ao lado de *Banir*; não em si mesmo). `src/server/execution.ts`, `src/server/sentences.ts`.
- **O que o jogador vê:** a tela da morte (a câmera gira devagar em volta do corpo, de pé) com *"Você foi executado."*, *"Por ordem da administração do reino"* e a contagem de **9 segundos** até voltar ao menu principal (em inglês, para quem joga em inglês). **Só no fim da contagem** o personagem é apagado, exatamente como o *Apagar personagem* do próprio jogador (corpo, bens, casas, cavalos, carroças, títulos, família, cidadania...), e ele volta ao menu com o motivo; **ao entrar de novo cria um personagem do zero**. A conta Steam fica livre (não é banimento).
- **Quem não está no jogo** não é executado na ausência: a sentença fica gravada (`playerdata/executions.json`) e é cumprida **quando ele entrar**, com a mesma tela. O jogador aparece com *execução marcada*, e o botão vira **Perdoar** (cancela a sentença que espera). Uma execução cuja tela já subiu não volta atrás. Quem sai no meio da contagem continua condenado.
- **Não testado no jogo:** a tela de pé (a câmera 2,5 m acima do corpo), e o corpo continuar ativo durante os 9 segundos.

**O que mudou nas seções em 17/10/2026:** *Guildas* — escolha definitiva (com pergunta antes) e o botão **Ver membros**, na ordem da hierarquia; *Animais* — as carroças (brasão próprio, **Trazer até mim**, **Dar nome**) e, em cavalos e carroças, **Deixar livre / Trancar**; *Opções* — **Fiquei preso** e **Idioma / Language**; *Chaves* e *Propriedades* — a chave de **uma porta** ao lado do botão de trancar; *Jogadores* — busca por nome ou número, filtros (administradores, apoiadores, nobres, sem guilda) e páginas de 12, e as listas de "quem recebe" e de parente jogador buscam e viram páginas de 8; *Nomeação* — a árvore é desenhada em pé, a Coroa no alto; *Apoiador* — o novo brasão e o mosquete, o canhão de mão e as 10 balas no que o apoio dá. As barras de rolagem ficaram douradas, e o menu da esquerda rola quando há mais seções do que cabem.

### Cartas

A seção **Cartas** do painel (F2, 02/11/2026: *"no menu F2 vai ter uma nova seção chamada Cartas, parecida com quadro de aviso; lá você vai poder enviar uma carta para um jogador; quanto mais longe, mais tempo demora para a carta chegar a ele; nessa seção vai poder ler cartas também; formatação e fonte de texto, mesma coisa; o jogador pode escolher se vai ser anônima ou vai com o nome dele, e qual brasão usar: só pegar os brasões de cidadania ou brasões de guilda; cada carta custa 10 moedas para enviar"*). O título é o **EPISTULAE** do usuário; as figuras da carta fechada (com barbante) e da carta aberta são as dele (`img/carta fechada.png`, `img/carta aberta.png`), mandadas pelo servidor como as outras do painel.

- **A lista:** duas abas, **Recebidas** (com quantas não foram lidas) e **Enviadas**, o cartão **Escrever uma carta** e as cartas, a mais nova primeiro. Uma carta recebida e não lida aparece **lacrada** (a carta fechada, *Nova*), com quem mandou ou *Sem assinatura*; as enviadas dizem **a caminho** ou **entregue**. O botão **Cartas** do menu ganha um ponto vermelho enquanto houver carta por ler.
- **Ler:** uma carta lacrada mostra a carta fechada com o **selo de cera no nó do barbante** (o brasão escolhido, ou um lírio na cera simples) e o botão **Romper o selo**; aberta, mostra o título, quem escreveu, quando chegou, o selo e o texto no estilo de quem escreveu, assinado ou *sem assinatura*. **Responder** (só carta assinada) abre uma carta para quem escreveu, com "Re:" no título; **Jogar fora** tira a carta da lista. O texto, os títulos e os nomes escritos pelos jogadores nunca passam pelo dicionário do inglês (`data-notr`).
- **Escrever:** **Para quem** é qualquer personagem do servidor, no jogo ou não (a lista `mail` do servidor, buscada por nome, 8 por página; nunca você mesmo nem banidos); embaixo, quanto o mensageiro leva até lá e a distância. **Título**, **Texto** (até 1500 caracteres e 40 linhas) com os mesmos estilos dos cartazes (**B** negrito, fonte normal ou **boêmia**, linhas juntas, normais ou largas, à esquerda ou centralizado) e a prévia; **Assinatura**: com o seu nome ou sem; **Selo**: o lacre simples, o brasão da cidade de que você é **cidadão** ou o da sua **guilda** (só os seus). **Enviar · 10 moedas**. A carta pela metade fica guardada na página se o painel fechar.
- **O mensageiro:** a carta chega em **1 minuto + 2 minutos e meio por quilômetro** entre quem escreveu (onde estava) e quem recebe (onde está, ou onde foi visto pela última vez; nunca visto, 1,5 km), de **1 a 12 minutos**. Até chegar, quem recebe não sabe dela. Quando chega, ele é avisado no chat (*Chegou uma carta para você...*); quem não está no jogo é avisado 20 segundos depois de entrar.
- **Regras:** **10 moedas** por carta, tiradas só quando a carta é guardada (devolvidas se o disco falhar); uma carta a cada 10 segundos e no máximo 30 por dia por jogador; cada um guarda **40 cartas**: uma nova empurra para fora a lida mais antiga, e sem nenhuma lida a carta é recusada antes de cobrar. As lidas ficam **30 dias**, as não lidas 60; jogar fora tira só da própria lista, e a carta some de vez quando os dois lados jogam fora. Tudo em `playerdata/letters.json`.
- **Código:** `src/server/letters.ts` (regras, mensageiro, entrega), `src/server/roster.ts` e `status.ts` (a lista `mail`), `src/server/text-style.ts` (as regras do texto, as mesmas dos cartazes), `src/client/status.ts` (os eventos `status:letters*`), `ui-src/status.html` (a seção), `tools/make-ui-images.py` (`title-cartas`, `carta-fechada`, `carta-aberta`).
- Não verificado no jogo: a seção dentro do jogo (as figuras, a fonte boêmia, o rascunho guardado no navegador do jogo) e o aviso de chegada.

### Família

**A descrição e o brasão da família (09/11/2026):** *no sistema de família o jogador pode dar uma descrição para a família e anexar o link do brasão; ao salvar, o brasão sempre carrega no painel de família e na cidadania; ela pega o brasão da família do dono, e se não houver fica sem*. A seção **Família** é uma lista com detalhe, como as outras (09/11/2026: *o brasão, a descrição e a quantidade de membros devem ficar na direita, numa seção igual às demais*): **a árvore à esquerda** e, **à direita**, o **brasão** da família (o link que o jogador pôs, ou um escudo apagado), o nome *Família Fulano*, a **descrição**, os **membros** (quantos há na árvore, contando o jogador) e se há brasão, e embaixo os botões **Descrição e brasão** e **Mudar o sobrenome**. O cartão **Você** da árvore fica só com o sobrenome. O botão **Descrição e brasão** abre um formulário com a **descrição** (até 300 letras) e o **link do brasão**, com uma prévia. O link é o de **qualquer imagem** (*"você só vai renderizar, não vai rodar nada"*): a página só o põe numa imagem (`setRemote`, sem scripts, sem enviar quem olha), e o servidor só aceita **`https://` com nome de site** (`cleanCrestLink`: não `http`, não endereço numérico, não `localhost` nem nomes de rede de casa, sem usuário, sem espaços, até 400 letras). O brasão passa a coroar o cartão do jogador na árvore; **a cidade** em que ele é senhor das terras (Cidadania, lista, detalhe e a árvore da hierarquia) e **as propriedades de que ele é dono** (Propriedades e Chaves) desenham esse brasão, e quem não tem um fica com o escudo apagado. Guardado em `playerdata/family.json` (`description`, `crest`) com o sobrenome; apagar o personagem apaga tudo. Evento da página: `status:familyProfile`. **Não verificado no jogo:** que a página do jogo carrega imagens de fora (https) e de quais sites (um link de uma imagem que o site não deixa usar em outra página aparece como o escudo apagado).

A árvore tem sete linhas, de cima para baixo, e o jogador está sempre na do meio. Cada linha abre e fecha clicando no título; as que não têm ninguém e não são básicas (bisavós, netos, bisnetos) começam fechadas. O `+` ao fim de cada linha abre o formulário de novo parente, que só oferece os parentescos daquela linha.

**O formulário com listas e os cartões com desenhos (25/10/2026: *na modal que abre para colocar o parente, as opções filhos, neto etc., ao invés de ser daquele jeito vamos usar o padrão de dropdown, além de colocar ícone nos cards*).** No formulário de novo parente e no de editar, o **parentesco** é uma lista do painel (o mesmo menu suspenso das outras seções), cada opção com o seu desenho, e o **grau** do primo também (1º grau, o primo comum, até o 4º). Cada cartão da árvore mostra, antes do parentesco, o desenho do tipo de parente: uma **árvore velha** para avós e bisavós, **adulto e criança** para pais, padrastos e sogros, **duas alianças** para cônjuge e companheiro, **dois lado a lado** para irmãos, primos, tios e cunhados, e um **broto** para filhos, genros, sobrinhos, netos e bisnetos. O ornamento sobre cada cartão (*o ícone de família que fica em cima de cada parente está achatado*) agora tem a caixa presa à proporção da arte (3 por 2), é um pouco maior e vem do servidor com o dobro da resolução (240 px).


| Linha | Parentescos |
| --- | --- |
| Bisavós | bisavô, bisavó |
| Avós | avô, avó |
| Pais, sogros e tios | pai, mãe, tio, tia, sogro, sogra, padrasto, madrasta |
| Cônjuge, irmãos, primos e cunhados | esposo, esposa, companheiro e companheira (de uma união que não é casamento), irmão, irmã, primo e prima (do 1º ao 4º grau; o 1º é o primo comum), cunhado e cunhada |
| Filhos, genros e sobrinhos | filho, filha, filho adotivo, filha adotiva, filho bastardo, filha bastarda, sobrinho, sobrinha, genro, nora, enteado, enteada |
| Netos | neto, neta |
| Bisnetos | bisneto, bisneta |

- Cada parente é só um **parentesco e um nome** (2 a 40 letras). O jogo não trata a árvore como mecânica: ela é o relato do personagem. Cabem até 80 parentes por jogador.
- Cada parente é ligado à linha pelo parentesco, não a outro parente: um primo não precisa de um tio cadastrado antes. É por isso que a lista inclui diretamente os graus de primo.
- **Estado civil** não é escolhido: é **casado** quando a árvore tem um cônjuge vivo, ou quando outro jogador põe você como cônjuge na árvore dele; **viúvo** quando todos os cônjuges da árvore estão marcados como falecidos; solteiro caso contrário. Um **companheiro ou companheira** vivo, de uma união que não é casamento, deixa de ser solteiro e vira **em união** (*Coniunctus*, *Coniuncta*); o casamento vem primeiro, e quem enviuvou e tem um companheiro vivo está em união.

**A família por casamento e por união (25/10/2026: *a árvore de família deve se estender a cunhado, genro e coisa do tipo, e conexão de família, caso haja casamento e uniões*).** Além dos parentes de sangue, a árvore tem os do outro lado de um casamento (**sogro e sogra, genro e nora, cunhado e cunhada**), os de uma família refeita (**padrasto e madrasta, enteado e enteada**) e o **companheiro ou companheira** de uma união. Valem como os outros: o ligado a um jogador é pedido a ele e, no sim, a árvore dele ganha o lado de lá com a relação virada (a sogra de um é o genro ou a nora dela; o cunhado, cunhado ou cunhada; o padrasto, enteado ou enteada). Mas ninguém desses é herdeiro nem sobe com o nobre: só o cônjuge e a linha legítima, como sempre. Na árvore, o companheiro fica ao lado do jogador, como o cônjuge; os cunhados, junto dos irmãos e primos; os sogros, junto dos pais; os genros e noras, junto dos filhos.
- **Editar** (o lápis na peça): o parentesco, dentro da mesma linha (um filho vira **adotivo** ou **bastardo**, ou filha), a situação (**vivo** ou **falecido**: a peça ganha uma cruz e fica apagada) e **se é um jogador**: um dos jogadores online, escolhido numa lista. O Steam ID do parente fica só no servidor; a página só sabe que é um jogador (a peça mostra a etiqueta *jogador*). Ao adicionar um parente também dá para escolher o jogador, que é então **perguntado** (veja abaixo).
- **Os parentes que são jogadores** são o que o status social segue: veja [Títulos e status social](#títulos-e-status-social).
- **O vínculo é um pedido, não uma imposição** (16/10/2026). Quando o parente é ligado a **outro jogador**, ele entra na sua árvore como um nome, com a etiqueta *aguardando*, e o pedido vai para a seção **Família do outro jogador**: lá aparece *"Fulano quer registrar você como Esposa"*, com **Aceitar** e **Recusar**. Ele também recebe um aviso no chat. Enquanto não responde, nada segue o vínculo (nem herdeiro, nem estado civil, nem a árvore dele). Trocar o jogador ou tirar o vínculo cancela o pedido; remover o parente também.
- **O outro lado, ao aceitar.** O vínculo é feito e a árvore **dele** ganha você, com o parentesco ao contrário e pelo seu corpo: você pôs o jogador como *filho*, e na árvore dele você aparece como *pai* ou *mãe*; *esposa* e *esposo* se respondem, *irmão* e *irmã*, *tio* e *tia* viram *sobrinho* e *sobrinha*, *avô* e *avó* viram *neto* e *neta*, e assim por diante (o filho adotivo ou bastardo também vira *pai* ou *mãe*). Quem pediu é avisado no chat (*"X aceitou ser Esposa na sua árvore de família"*). Se a árvore dele já tem você, nada muda lá; se está cheia (80), o vínculo vale mas você não entra nela, e ele é avisado. **Recusar** deixa o parente só com o nome, e quem pediu é avisado. Depois, mudar o parentesco muda o lado dele junto, e tirar o vínculo ou remover o parente tira você da árvore dele (os dois são avisados).
- **O espelho não conta duas vezes.** A peça que veio do outro lado é marcada e **não vale como uma segunda voz**: não faz de você um cônjuge a mais no estado civil nem um herdeiro em dobro. Quando o outro jogador **edita** a peça (o parentesco, vivo ou falecido), ela passa a ser dele e deixa de seguir o vínculo. Os vínculos feitos **antes** do pedido existir ficam valendo e ganham o lado deles uma vez, quando o servidor liga (log: `family: N ligação(ões) antiga(s) ganharam o lado delas na árvore do outro jogador`).
- **Sobrenome**: 2 a 30 letras, definido no cartão "Você" da árvore e mostrado em Personagem como Cognomen. Esvaziar remove.
- Remover um parente pede confirmação na própria peça.

### Títulos e status social

São duas coisas que parecem a mesma e não são: o **status social** (Plebeius ou Nobilis, a condição do personagem diante do reino) e os **títulos** (Rei, Lorde, Cavaleiro, Burgrave, Padre... os postos que ele tem). **O status social nunca aparece sobre a cabeça de ninguém; um título só aparece se o jogador quiser.**

**O catálogo** (`src/server/nobility.ts`; quem tem o quê fica em `src/server/titles.ts`, em `playerdata/titles.json`; o painel, em `src/server/nominations.ts`). São **37 títulos**, em cinco ramos, na ordem em que a hierarquia é lida:

| Ramo | Títulos |
| --- | --- |
| Coroa da Boêmia | Rei, Rainha |
| Grandes senhores e alta nobreza | Príncipe, Marquês, Lorde (*pán*) |
| Nobreza inferior e oficiais | Cavaleiro (*rytíř*), Escudeiro, Pequeno nobre (*zeman*, *vladyka*); e os oficiais de um senhorio: burgrave (*purkrabí*), hetman, capitão da guarda, chanceler, juiz senhorial, mordomo, tesoureiro, bailio, meirinho, arauto |
| Igreja | Arcebispo, bispo, abade, prior, padre, monge, frade, diácono, acólito |
| Cidades e guildas | Burgomestre, conselheiro municipal, alcaide da aldeia, mestre de guilda, chefe de mercado, coletor de pedágios, guarda dos portões, capitão da milícia urbana, escrivão, mestre de ofício, administrador de hospedaria |

Quem não tem nenhum é a **população comum**. Cada título tem a forma feminina onde o português tem uma (Rainha, Lady, Cavaleira, Abadessa, Monja...), a palavra da Boêmia da época quando ajuda e uma linha dizendo o que é; um jogador guarda até **6**. Há três tipos:

- **de sangue** (rei, príncipe, marquês, lorde, cavaleiro, escudeiro, pequeno nobre): quem recebe vira **nobre**, e o cônjuge e os descendentes legítimos que são jogadores sobem junto (a mesma regra do status social, mais abaixo). Só se tem um por vez: um novo toma o lugar do antigo;
- **do alto clero** (arcebispo, bispo, abade, prior): também fazem nobre, e a Igreja tem a escada dela: um bispo nomeia padres e monges, um lorde não;
- **cargos** (burgrave, burgomestre, padre...): não mudam a condição social de ninguém. Um plebeu pode ser burgomestre.

**Quem nomeia quem.** A seção **Nomeação**, na categoria **Nobre** do painel, só abre para quem é **nobre** (e para o admin, que nomeia como *a Coroa*); um plebeu não a vê, e o servidor não responde aos pedidos dela. Duas regras:

1. só nomeia quem tem um **título que dá esse direito** (cada título diz a quais nomeia: o Rei, o Príncipe e o Marquês a quase todos; o Lorde aos de baixo; o Cavaleiro a escudeiros e pequenos nobres; o Arcebispo e o Bispo ao clero; um cargo, a ninguém). Um nobre sem um título desses vê a seção, mas não nomeia;
2. **sempre para baixo**: nunca para um título igual ou acima do seu, e nunca muda o título de alguém no nível dele ou acima. O **Rei** é um só e só o admin o nomeia (e o admin nomeia qualquer um a qualquer título).

Um nobre pode nomear um **plebeu**, mas **só quem já se apresentou a ele** (veja [Encontros](#encontros-entre-jogadores)): a lista de quem pode ser nomeado mostra essas pessoas, pelo nome que ele conhece, e se atualiza enquanto a seção está aberta. O servidor confere tudo de novo em cada pedido.

| Vista | O que faz |
| --- | --- |
| **Nomear** | A lista dos títulos que o jogador pode dar, por ramo; no alto, quem recebe. À direita, o título escolhido, com o que é e o que pode. **Nomear** pede confirmação e avisa, num título de nobreza, que o nomeado e a família dele passam a ser nobres |
| **Títulos** | Os títulos do jogador, quem o nomeou e quando, e as pessoas que ele nomeou. **Deixar o título** e **Retirar o título** (de quem ele nomeou ou de alguém abaixo; o admin retira de todos), com confirmação. Tirar um título **não** muda a condição social: quem foi elevado a nobre continua nobre |
| **Ver hierarquia** | O reino todo, ramo por ramo, título por título, com os jogadores que o têm (ou *vago*). Clicar num jogador abre à direita o brasão da guilda, o nome, os títulos e quem os deu, o status social e civil, o sobrenome, o cônjuge (a **Lady**, quando o titular é um lorde) e as **terras** (regiões, casas e baús). Enquanto nada é escolhido, a árvore da hierarquia (a arte) enche o lado direito. Atualiza a cada 6 segundos |
| ↳ a vista da hierarquia | Uma chave de duas faces, cada uma com o seu desenho: **Árvore**, a hierarquia como uma árvore de verdade, deitada, com **A Coroa** na raiz e cada nomeado (junto do cônjuge, no mesmo quadro: *& Lady Elisabeth*) ligado a quem o nomeou (um título dado pela Coroa sai dela; um dado por um lorde sai do lorde), do mais alto ao mais baixo; encolhe sozinha quando o reino é largo; e **Lista**, a lista ramo por ramo de antes |

**O que a hierarquia não mostra**, para não quebrar o *metagaming*: onde a pessoa está, vida, fome, se está online, Steam ID, se apoia o servidor, se é admin. Só o que um personagem é **conhecido** por ser: nome, título, condição, casa, guilda, terras. Na página, cada jogador é uma chave embaralhada que muda a cada início; ela nunca recebe um Steam ID.

**Título sobre a cabeça.** Em **Opções**, **Título sobre a cabeça**: o jogador escolhe **um** dos títulos que tem (ou nenhum) para aparecer sobre a cabeça dele, em dourado, no lugar do nome que ninguém vê (os nomes continuam escondidos: veja [Encontros](#encontros-entre-jogadores)). **Desde 04/11/2026 o título só aparece para quem já foi apresentado ao jogador** (*"título na cabeça e título de ladrão só aparece acima da cabeça para quem já se apresentou a outro jogador"*): quem se apresentou a ele, ou a quem ele se apresentou (valem as duas direções), lê o título; **quem não o conhece não lê nada**. O nome do jogo sobre a cabeça fica numa linha em branco e o texto vai, só para quem pode ler, como um rótulo desenhado no cliente de cada um (`src/server/head-labels.ts`, `src/client/head-labels.ts`, `Nametags.setLabel`). A escolha é salva e posta de novo a cada entrada. Em **Personagem**, o **Titulus** lista todos os títulos do jogador.

**O admin e os títulos.** Em **Jogadores**, o botão **Títulos** mostra os do jogador (cada um com **Retirar**) e uma lista com todo o catálogo e **Dar título**, dado em nome da Coroa. Quem volta de nobre a plebeu (pelo status social) perde os títulos de sangue e do alto clero e **fica com os cargos**, e é avisado. Os títulos de texto livre da versão anterior foram convertidos, os que combinam com o catálogo; os outros ficaram em `playerdata/titles.legacy.json`.

**Título de sangue e plebeu não combinam, e o servidor acerta isso a cada início:** quem tem um título de sangue ou do alto clero e ainda consta como plebeu (um título dado antes da regra, ou o status mudado depois) é feito **nobre**, sozinho, e o log diz quem (`nominations: ... feito nobre`). A família dele não sobe com isso: só sobe com uma nomeação.

**Status social** (admin, em **Jogadores**): Plebeius ou Nobilis. Se o jogador tem parentes que são jogadores, o formulário mostra quem **muda junto** e deixa escolher **com a família** ou **só ele**. Mudam junto o **cônjuge vivo** e a **linha legítima** viva (filhos, netos e bisnetos), da árvore dele, e quem o põe como cônjuge na própria árvore. **Filhos adotivos, bastardos, irmãos, primos e avós não mudam.** Cada um é avisado no chat, e o painel dele muda na hora.

### Animais do jogador

A seção **Animais** (`src/server/pets.ts`) mostra um cartão por cavalo do jogador, com o brasão do cavalo, o nome, a vida e o fôlego (o jogo não tem fome de cavalo), os arreios pelo nome em português e onde ele está: *com você, montado*, *aqui, ao seu lado*, *a 120 m, a norte* ou *montado por <nome>*. **Chamar** faz o cavalo vir correndo, se estiver a até 300 m (o mesmo do `/cavalo chamar`), e **Dar nome** troca o nome (2 a 24 letras; vazio volta ao nome de antes). **Soltar** (com uma pergunta antes) larga o cavalo no mundo livre: ele deixa de ser do jogador, leva a sela e os arreios e não volta. **Um cavalo que morre se perde**, como no jogo: some da lista e é preciso comprar outro. O **E** diante de um cavalo que o jogador tem é o *Montar* do próprio jogo: desde 09/11/2026 não há menu, nem bolsa, nem comida, nem ordem de seguir (o carinho do jogo, no `V`, continua do jogo).

O **assobio** (`X`, a tecla do próprio jogo) chama do mesmo jeito. O cavalo chamado corre por uma rota que o servidor planeja na malha de navegação (`moveTo`); cada chamado vai para o log com a rota (`horses: Mauro chamou Carpiado a 65 m; rota de 6 cantos, 84 m`: uma rota de 2 cantos é uma linha reta) e com o fim dela. Se ele **empaca no caminho** (`blocked` ou `failed`), o servidor manda de novo, do lugar onde ele parou, até 2 vezes; depois disso o dono é avisado de que ele ficou preso e em que direção.

> **Ainda não visto no jogo:** por que o cavalo vinha em linha reta sem desviar (relato de 2026-10-14). As linhas `horses:` do log dizem se a rota da malha era reta (cercas, árvores e pedras fora da malha) ou se ele empacou.

Para quem apoia, um cartão do **cão**: o que ele está fazendo (seguindo, farejando, comendo...), a ordem (seguindo você ou esperando), o **ânimo** quando o jogo já disse, e os botões **Chamar** e **Dar nome** (os mesmos do `/cachorro`). As ordens (*Mandar ficar*, *Mandar seguir*) e o carinho estão no **E** diante do cão (`src/server/dog-menu.ts`); os botões *Sentar aqui* e *Seguir* do painel saíram em 26/10/2026. O cão do jogo não morre (derrubado, ele se levanta) e o framework não dá a vida dele, então não há regra de perda para o cão.

### Opções

A seção **Opções** (`src/client/camera.ts`, guardada em `src/server/options.ts`):

- **Terceira pessoa**: a câmera atrás do personagem (a câmera do próprio mod, `Camera.setThirdPerson`), em três distâncias: **perto** (2,2 m), **normal** (3,2 m) e **longe** (4,8 m), um pouco por cima do ombro direito. Escolher uma distância já liga. A escolha fica **salva no servidor** pelo Steam ID (`playerdata/options.json`), porque o cliente do jogo não tem onde guardar nada, e é posta de novo a cada entrada. O `/camera` faz a mesma escolha.
- **Microfone** (`src/client/voice.ts`, guardado pelo mesmo `src/server/options.ts` e respondido por `src/server/voice-settings.ts`): o **modo** (`apertar`, que é segurar o `H`, o padrão de todos desde 09/11/2026, ou `aberto`) e, no aberto, a **sensibilidade** (`alta`, `media` ou `baixa`: o nível do microfone a partir do qual ele envia, 0,02, 0,04 ou 0,08, com o ruído do ambiente filtrado). Os campos `mic` e `sensitivity` ficam em `playerdata/options.json` ao lado da câmera (um arquivo antigo, sem eles, lê como segurar o `H` e sensibilidade média), e o cliente os põe a cada entrada; a escolha vale na hora e o servidor guarda. O servidor também diz ao cliente o **alcance** de cada voz (`Voice.getTierRange`: 3, 15 e 25 m hoje), que o indicador e a seção escrevem. Eventos do cliente: `voice.get` e `voice.set` (cliente → servidor), `voice.state` (servidor → cliente); eventos locais entre o painel e o cliente: `voice.choose`, `voice.ask`, `voice.state`.
- **Resolução da interface** (25/10/2026: *uma opção de resolução para o jogador poder mudar a resolução da interface, se quiser*): o tamanho do painel e das janelas do servidor (ofícios, criação de personagem, mural e o chat) em **80%, 90%, 100%, 110% ou 125%** do que cabe na tela. Em 100% tudo já se ajusta sozinho à resolução da tela; o jogador diminui se ficar grande demais, aumenta se ficar pequeno. Fica **salva no servidor** com as outras opções (campo `ui` em `playerdata/options.json`) e vale em qualquer computador. O cliente avisa cada página quando ela abre e a cada troca (`src/client/ui-scale.ts`, evento `ui:scale`); o chat muda o tamanho da própria janela. O círculo de voz e a roda de emotes ficam como estão.
- **Apagar personagens que não estão no jogo** (01/11/2026: *tire do mapa os cavalos do Gunther que saiu ... além de todos itens no mundo, depois apague os personagens*): com o servidor parado, o administrador escreve `playerdata/erase-pending.json` (`{ "v": 1, "characters": [Steam ids], "houses": [ids de propriedade] }`). No fim da subida o servidor apaga cada personagem **do mesmo jeito que o jogador apagaria** (cavalos, carroças, casas e baús, títulos, família, tudo abaixo), sem desconectar ninguém, e esvazia os baús de cada casa de `houses` **só se ela não tem dono nem convidados** (os baús de uma casa com dono ou com gente autorizada ficam como estão). Depois reescreve o arquivo sem nada a fazer, com o que foi feito (`done`), e o log diz o que foi junto. Código: `runPendingErasures` em `src/server/character-reset.ts`.
- **Apagar personagem** (25/10/2026: *uma opção na seção Opções: apagar personagem, isso deleta o personagem dele, irreversível, deve avisar e joga ele na tela de menu principal do mod*; e, na mesma tarde, *ao apagar o personagem deve perder os cavalos, carroças e tudo, até apoiador, afinal ele perdeu o personagem*). Era o **Recomeçar do zero**, que valia uma vez por conta (dez jogadores já o tinham usado): agora o jogador pode apagar quando quiser. O painel avisa **duas vezes** que não tem volta; depois o servidor apaga **tudo** o que era do personagem: inventário, progressão, receitas, rosto e nome, guilda, cidadania, títulos, família, conhecidos, o lugar onde estava e a marca de ladrão; os **cavalos** e as **carroças** (somem do mundo), o **apoio** ao servidor com os benefícios e o **cão**, as **casas e os baús** que eram dele (voltam a não ter dono, e os baús são **esvaziados**), os **quartos**, as **terras** cedidas a ele, os **canteiros** da horta, a confiança dos **cavalos selvagens** que domava, a sede, a leitura dos livros de habilidade, as trocas grátis, o que lhe era devido e os seus **baús de morte** (passam a ser de ninguém, e nada é devolvido ao próximo personagem). **2,5 s depois o jogador volta ao menu principal do mod** (é desconectado, com o aviso *Seu personagem foi apagado. Entre de novo no servidor para criar um novo.*); ao entrar de novo, cria outro personagem. Ficam só as **opções** do jogador (câmera, microfone, tamanho da interface e idioma) e o papel de administrador. O log diz `reset: Fulano apagou o personagem; foram junto 2 cavalos, 1 carroça, ...`. O último apagamento de cada conta fica em `playerdata/character-resets.json` (`src/server/character-reset.ts`).
- **Refazer aparência** (25/10/2026: *uma opção chamada refazer aparência; essa é uma por conta, permite o jogador refazer a aparência do personagem uma vez, caso não tenha gostado, e trocar o nome; não perde nada*). Abre a **criação de personagem** de novo sobre o corpo, com o **nome e a alcunha livres** para trocar (o servidor confere se o nome novo está livre, como sempre), e nada mais do personagem muda: inventário, progressão, guilda, família, casas e cavalos continuam. O corpo continua do mesmo sexo (a família, os títulos e as roupas são de homem ou de mulher). Vale **uma vez por conta** e só é gasto quando o jogador **salva** a nova aparência: saindo sem salvar, a chance continua (`playerdata/look-remakes.json`, `src/server/look-remake.ts`). Apagar o personagem não devolve a chance.
- **Câmera livre**, para gravar e tirar fotos: o painel fecha e a câmera passa a voar, comandada por uma **página do mod** (`ui/freecam.html`): **W A S D** voam, **Espaço** (ou `E`) sobe, **Ctrl** (ou `C`, `Q`) desce, **Shift** acelera, **Alt** vai devagar, as **setas** viram a câmera (70° por segundo) e o **mouse arrastado** (botão esquerdo ou direito) também; `H` mostra de novo a ajuda, que some sozinha depois de 9 segundos para a foto sair limpa, e o ponteiro que se mexe a traz de volta. **O corpo fica parado onde está.** Enquanto ela voa, o HUD (bússola, barras, dicas, legendas...) e o chat somem, e os nomes de portas e as dicas `[E]` também. **`Esc` volta** à câmera normal, **`F2` também** e o botão vermelho **Sair da câmera**, que fica no canto; **`F3`** também, e abre o painel da administração. Morrer também tira, e a terceira pessoa volta se estava ligada. Ela **volta sozinha em 5 minutos**, com aviso 30 segundos antes. A câmera não se afasta mais de **25 m** dos olhos do personagem: uma câmera que fosse a qualquer lugar, atravessando paredes, serviria para espiar casas trancadas e acampamentos.

  **Se a página não ouvir nada** (a primeira versão lia o código de posição da tecla, `event.code`, que o navegador do jogo deixa vazio, e nenhuma tecla funcionava: 2026-10-15 à noite), ela agora lê o número e o nome da tecla (`keyCode` e `key`). E se em **6 segundos** ela não ouvir nem uma tecla nem um clique, o teclado volta ao jogo e **a câmera passa a voar pelas teclas do próprio jogo** (`W A S D`, as setas, `Espaço`/`E` e `Ctrl`/`C`/`Q`, `Shift`, `Alt`; `Esc` e `F2` saem), com um aviso na tela. O log do cliente diz em que pé está: `free camera: the page drew`, `the page hears the player (key: ...)` na primeira tecla ouvida, `the page heard nothing in 6 s; the game's keys fly it now`, e `NoClip.move refused to move the camera` se o jogo recusar o movimento.

Por que uma página: o voo pronto do jogo (as teclas do **modo foto**) engole todas as teclas, e nem o `Key.bind` nem o `Key.isDown` do mod ouviam o `Esc` nem o `F2`: um jogador ficou preso na câmera em 2026-10-14 (só o `F9`, que desconecta, tirou), e uma segunda tentativa, que perguntava as teclas a cada 100 ms, também não funcionou (2026-10-15). Agora o voo é ligado **sem** o teclado dele (`NoClip.enable({ mode: "camera", input: false })`) e uma página do mod, em foco, ouve as teclas e o mouse e diz ao cliente o que está apertado (`freecam:keys`, `freecam:look`); o cliente voa a câmera a cada 16 ms (`NoClip.move`), e a página diz `freecam:exit` no `Esc`, no `F2` e no `F3`. **Sem a página não há voo**: se ela não abre, ou não diz que desenhou em 5 segundos, a câmera nem começa (ou é desfeita) e o jogador é avisado. O limite de 5 minutos continua, e o `Esc` e o `F2` que o mod ainda consegue ouvir também valem.

> **Ainda não testado no jogo:** se a página recebe o teclado e o mouse com o voo ligado (uma página em foco recebe as teclas, `Esc` e `F2` incluídos, e é o que se espera), e se o mouse arrastado vira a câmera na medida certa (0,12 grau por pixel). Se o voo não começar, o jogo diz *a página que a comanda não abriu*; o log do cliente tem `free camera: ...`.

### Como a página e o servidor conversam

A página (CEF) fala com o script do cliente por `callEvent`, e o script repassa ao servidor por `Events.emitServer`. O servidor responde sempre com o pacote inteiro `status.social`, e a página se redesenha. Cada evento da página só segue adiante se tiver os campos certos, com os tipos certos (`relay` em `src/client/status.ts`); o servidor confere tudo de novo.

| Evento da página | Campos | Quem pode |
| --- | --- | --- |
| `status:selectGuild` | `guildId` | todos |
| `status:selectShowcase` | `showcase` (`guild` ou `citizenship`) | todos |
| `status:familyAdd` | `relation`, `name`, `degree` (só para primos) | todos |
| `status:familyRemove` | `id` | todos |
| `status:familyAnswer` | `key`, `accept` (1 aceita, 0 recusa) | o jogador a quem o pedido foi feito |
| `status:familySurname` | `surname` (vazio apaga) | todos |
| `status:grantKey` | `propertyId`, `targetId` (opcional: o número do jogador que recebe) | o admin, ou o dono da propriedade (até 8 chaves); o servidor decide, não a página |
| `status:propSave` | `id`, `name`, `description`, `region` (opcional) | o dono ou o admin; a região só o admin |
| `status:propOwner` | `id`, `targetId` (opcional) | só admin: entrega a propriedade e as chaves |
| `status:propDisown` | `id` | só admin: tira o dono |
| `status:roster` | nenhum | todos; o admin recebe a lista completa, os demais só o nome e o número de cada jogador (para escolher quem recebe uma chave) |
| `status:nominate` | `targetId`, `title` | nobre ou admin: dá o título; o servidor confere o direito de nomear, a direção, quem se apresentou e o limite de 6 |
| `status:revokeTitle` | `title` e um de `self` (deixar o seu), `targetId` ou `key` (retirar de alguém) | o dono do título, quem o nomeou, quem nomeia aquele título e o admin |
| `status:shownTitle` | `title` (vazio: nenhum) | todos, só entre os títulos que têm |
| `status:hierarchy` | nenhum | nobre ou admin; a resposta (`status.hierarchy`) não é guardada para a página seguinte |
| `status:doorLock` | `id`, `index`, `locked` | o dono ou o admin: uma porta de uma casa com várias |
| `status:propLock` | `id`, `locked` | o dono ou o admin: a casa inteira ou um baú |
| `status:propGive` | `id`, `targetId` | o dono (ou o admin), a um jogador que está aqui; casa de vendedor nunca |
| `status:regionCede` | `region`, `targetId` (opcional), `confirm` (1 cede; sem ele só diz o que passaria) | só admin |
| `status:setSocial` | `targetId`, `status`, `family` | só admin |
| `status:supporterGrant` | `targetId` | só admin |
| `status:animals`, `status:animalName`, `status:animalCall`, `status:dogOrder` | o animal e o que fazer com ele | o dono do animal |
| `props.use` | `guid`, `use` (o *Abrir* do próprio jogo estava na tela quando o **E** foi apertado) | todos: o cliente avisou que apertou **E** numa porta ou baú de propriedade; numa trancada o servidor diz que está trancada, ou, de dentro, puxa o ferrolho e abre a porta |
| `props.peek` | `guid` | todos: o cliente pergunta o nome da porta ou do baú que está mirando; o servidor responde com `props.label` (`label`, `use`, e `door` quando é uma porta) |
| `props.look` | `guid` (vazio: a mira saiu da porta ou do baú) | todos: a porta ou o baú de propriedade sob a mira, a cada 700 ms enquanto durar; o servidor responde com `props.can` (`guid`, `lock`: `lock`, `unlock` ou vazio), o que o **F** faz ali para aquele jogador |
| `props.toggle` | `guid` | quem tem a chave, o dono, o morador do quarto e o admin: o **F**, que tranca ou destranca aquela porta ou baú; quem pode, a distância e a tranca são conferidos de novo no servidor |

O painel ocupa a tela toda e esconde o chat, então um aviso só no chat não seria visto: o servidor manda também o evento `status.notice`, que a página mostra como uma faixa no rodapé por alguns segundos (`notice` em `src/server/status.ts`). Recusas de nome inválido, limite de parentes, pedidos de chave e edições de propriedade usam esse caminho.

### Como acrescentar uma seção

1. Dados e regras no servidor, num módulo próprio (`src/server/family.ts` e `src/server/properties.ts` são os modelos), salvos em `playerdata/`.
2. Campos novos no `payloadFor` de `src/server/status.ts`, e um `Events.onClient` para cada ação. Ação que só admin pode fazer chama `isAdmin(player)` primeiro.
3. Um `relay(...)` para cada evento novo em `src/client/status.ts`.
4. Em `ui-src/status.html` (o `npm run build` a empacota em `ui/status.html`): o botão da navegação (dentro de Comum, ou do grupo Administração, que o `role` mostra ou esconde), a `<section id="tab-...">` com a imagem do título, e a função que desenha a partir do pacote.
5. Testes em `tests/`. **Cuidado com o tamanho**: cada imagem de título custa cerca de 23 KB no pacote do cliente, e o pacote está perto do limite (veja a seção anterior). `tests/packagesize.test.cjs` falha se passar de 480.000 bytes.

## O que é salvo e o que não é

O framework **não guarda nada** de um jogador que sai: ao voltar ele é um Henry novo. Tudo o que está na primeira tabela abaixo é guardado pelo gamemode, na pasta `playerdata/` do servidor, e devolvido na entrada. A chave é o **Steam ID** que o cliente informa (o servidor não o confere; veja o limite em [Acesso, tickets e perfis](#acesso-tickets-e-perfis)). Quem entra sem Steam ID não tem nada salvo.

| O quê | Onde | Quando é gravado | Quando volta |
| --- | --- | --- | --- |
| Visual, nome e alcunha do personagem | `characters.json` (`appearance`, `name`, `epithet`) | ao aceitar o criador | o visual, ao entrar; o nome, sempre que é lido |
| Status social, guilda, aba do Personagem | `social.json` | ao escolher | ao abrir o painel |
| Árvore de família e sobrenome | `family.json` | ao mudar | ao abrir o painel |
| Último lugar onde o jogador esteve | `positions.json` | a cada 20 s, ao sair e quando o servidor para | ao entrar |
| **Inventário**: itens, quantidade, qualidade e condição, o que está vestido e os atalhos rápidos | `characters/<SteamID>.json` | 2,5 s depois de mudar, a cada 30 s, ao sair e quando o servidor para | na entrada, antes de o jogo carregar |
| **Níveis, perks e pontos** (progressão) | o mesmo arquivo | idem | quando o jogador pode jogar (`playerReady`) |
| **Receitas de alquimia aprendidas** | o mesmo arquivo | idem | quando o inventário aparece |
| **Vida, fome, energia e stamina** | o mesmo arquivo | idem, só de quem está vivo e já jogando | quando o jogador pode jogar |
| **Kits já entregues** (inicial e de cada guilda) | o mesmo arquivo | ao entregar | ao entrar |
| Propriedades: nome, região, descrição, dono, chaves emitidas e estado das trancas | `properties.json` | ao mudar | as trancas são refeitas a cada início |
| **Títulos**: quem tem qual, quem o nomeou e quando, o nome de quem tem (para a hierarquia listá-lo longe) e o título que mostra sobre a cabeça | `titles.json` | ao nomear, retirar ou escolher | a cada início; o título escolhido volta sobre a cabeça a cada entrada |
| Regiões cedidas: de quem é cada uma, desde quando e por quem | `regions.json` | ao ceder | a cada início |
| Nível da fome | `hunger.json` | ao mudar com `/fome nivel` | a cada início |
| **Livros de habilidade**: as horas já lidas de cada livro, por jogador, e os livros aprendidos; o ritmo da leitura (`/leitura fator`) | `skillbooks.json` | ao largar o livro, ao terminar, ao sair do servidor e ao mudar o ritmo | a cada início |
| Quem se apresentou a quem | `acquaintances.json` | ao se apresentar | sempre: é o que decide o nome que cada um vê |
| **Apoiadores**: desde quando, quantas vezes, quem entregou e o nome do cão | `supporters.json` | ao entregar os benefícios e ao dar nome ao cão | a cada início; o cão volta a cada entrada |
| Salteadores das estradas ligados ou não | `ambush.json` | ao usar `/emboscada liga\|desliga` | a cada início |
| **Itens numa negociação aberta**, e o que não coube no inventário ao fim de uma | `escrow.json` | a cada mudança na oferta | na próxima entrada do dono (o que estava numa negociação quando o servidor caiu também) |
| **Conteúdo dos baús de propriedade** (os do catálogo, com chave ou sem) | `chests/<GUID do baú>.json` | 3 s depois de mudar e quando o servidor para | a cada início |
| Onde cada vendedor está | `vendors.json` | ao usar `/vendedor aqui` | a cada início |
| **O que resta na bolsa de cada vendedor** e quando ela foi enchida | `vendor-purses.json` | 3 s depois de cada negócio e quando o servidor para | a cada início; a bolsa só volta cheia 24 h depois de enchida |
| **Cavalos com dono**: raça, nome, equipamento e onde foram deixados | `horses.json` | ao dar o cavalo, quando o cavaleiro desce, quando o equipamento muda e a cada minuto | a cada início, no mesmo lugar, e o dono o recebe de volta ao entrar |
| Dia e hora do mundo | `world.json` | a cada minuto e quando o servidor para | a cada início |

**O que não é salvo** (some quando o servidor reinicia, ou nunca existiu): cães, o baú que se forma onde alguém morre (dura 30 minutos), props e marcadores, o conteúdo de baús que não estão no catálogo de propriedades (os dos acampamentos de bandidos são reabastecidos sozinhos), o clima (um novo é sorteado a cada início), os efeitos de poções (buffs), e a **descoberta do mapa**: os pontos de interesse que o jogador descobre ficam só no cliente dele, e a API do mod só avisa quando um é descoberto (`poiDiscovered`), sem dar um jeito de marcar um como descoberto na volta.

**Itens no chão duram 30 minutos.** O que alguém larga no chão (ou um script põe lá) some depois de 30 minutos se ninguém pegar, e some também num reinício (`src/server/ground-items.ts`).

**Cavalos.** Um cavalo passa a ser guardado quando é dado a um jogador (o `/horse` do admin cria um já do autor, e `/horse give` entrega a outro). O dono pode sair: o cavalo fica onde estava, ninguém mais monta (só o dono e os admins), e volta a ser dele quando ele entra. Morreu, foi esquecido, como no jogo. **Derrubado também** (25/10/2026: *matei o cavalo duas vezes, ele voltou à vida; devia ir embora definitivo e sumir dos meus animais*): o jogo não mata o cavalo de um jogador, só o derruba, e ele se levantava sozinho minutos depois, sem ter saído da seção Animais. Agora um cavalo com dono que o servidor vê desacordado em duas olhadas seguidas (uma por segundo) **morre de vez**: o registro some (e com ele a linha da seção Animais), o dono é avisado, o cavalo deixa de ser dele e é morto; se o jogo ainda o mantiver vivo 5 segundos depois, é tirado do mundo. Cavalo sem dono não é mexido (`src/server/horses.ts`, `watchKnockouts`; o log diz `horses: o cavalo ... ficou desacordado e morre de vez`). **Cavalo de dono que está fora (04/11/2026, o farm de XP).** *"Tinha jogador batendo no cavalo dele infinitamente para upar."* Desde 26/10 o cavalo de um dono que está fora do jogo não morre de vez: se o jogo o mata, o servidor o traz de volta onde ele caiu. Só que era um **alvo sem fim**: o log de dois dias tem **8.852 mortes de cavalo**, 8.418 delas só em 04/11, nove personagens matando e matando o mesmo cavalo a cada 1 ou 2 segundos, por horas. Agora, **morto por um jogador com o dono fora, o cavalo sai do mundo 3 s depois** (o corpo cai e some) e **volta onde caiu, inteiro, com os arreios, quando o dono entra** (o dono lê *"Seu cavalo X foi atacado enquanto você estava fora, mas está bem"*); um reinício do servidor não o traz de volta para ser atacado de novo. Morto **sem culpado** (flechas de bandido, queda), ele volta duas vezes e, na terceira vez em 5 minutos, também é guardado. Com o dono no jogo nada mudou: o cavalo morto de verdade continua perdido. O log diz `horses: o cavalo ... foi morto por <conta> [Steam] com o dono fora do jogo: guardado fora do mundo até o dono voltar`, com a conta do atacante. Código: `parkHorse`, `unparkHorsesOf` e `giveBackTo` em `src/server/horses.ts`. `/cavalo` diz onde ele está e chama ele; `/cavalo listar` e `liberar` são do admin.

**Como o salvamento se protege.** Cada arquivo é gravado em duas etapas, com cópia da versão anterior (`.bak`), então uma queda no meio não deixa um arquivo pela metade. Cada parte só é gravada depois de ter sido devolvida: um jogador que sai antes de o jogo carregar não apaga o que estava salvo. Um inventário vazio nunca substitui um cheio. Se o arquivo do jogador não puder ser lido, ou o jogo recusar o inventário salvo, a sessão dele **não grava nada** e ele é avisado no chat; o que estava salvo continua intacto para a administração. Itens personalizados que o servidor não conhece mais (uma propriedade apagada) ficam guardados à parte e voltam quando o tipo existir de novo. O log mostra `characters: <nome>: inventário devolvido (N itens)` na entrada e `gravado (saída)` na saída.

## Criação de personagem

Quem entra pela primeira vez **cria o personagem antes de jogar**: a tela de criação abre sozinha, **não tem saída** (sem botão de fechar, sem `Esc`, e o `/creator stop` é recusado) e só fecha quando o jogador escolhe o visual e **dá um nome**. Quem já tem personagem abre a tela com `/creator` e pode sair quando quiser; o visual volta ao que era.

**A aba Roupas veste o corpo (25/10/2026: *na criação de personagem, na seção roupa, ao ir alterando as roupas deve refletir no boneco também*).** Para quem cria o primeiro personagem, a roupa escolhida nunca tinha aparecido: o servidor vestia as peças pelo **nome** do item, e essa forma de vestir só aceita o **código (GUID)**; o log mostrava `creator: Fulano: o jogo não vestiu TunicLong04_m02_D, ...` a cada troca. Agora vai pelo código, e o corpo mostra o que é escolhido. Quem **já tem personagem** (o `/creator` ou o *Refazer aparência*) também **prova** as peças: enquanto a criação está aberta sai o que ele veste **naquela parte do corpo** (a túnica ou a armadura do tronco, as calças, as botas) e o **capuz ou o elmo**, para o rosto aparecer; o resto (luvas, armas) fica. Tudo o que ele tinha continua no inventário, e **ao sair ou salvar volta exatamente como estava**, linhas e atalhos; ao salvar, as peças marcadas vão para o inventário, cada uma uma vez só, como antes.

**Quem já tinha personagem completa a idade e a altura (02/11/2026: *"todo jogador que entrar já tendo personagem vai receber a tela de criação para ele poder colocar essas informações"*).** Um personagem salvo sem idade ou altura recebe o criador na entrada seguinte, com o visual e o nome como estão; a tela diz *"O seu personagem agora tem idade e altura: escolha as duas para continuar (o visual também pode mudar, se quiser)"*, não tem saída até salvar, o nome fica travado (quem não tinha nome pode dar um) e não há o passo do nascimento. Ao salvar: *"Personagem completo: Fulano, 34 anos, 1,81 m. Bom jogo!"*. O visual pode mudar nessa vez, com as opções novas, sem gastar o **Refazer aparência**. Se a página não abrir, o jogador entra normalmente (não vai para o criador do próprio jogo, que não pergunta idade nem altura) e é perguntado de novo na próxima entrada. O log diz `first-join: Fulano vai completar o personagem` e `creator: Fulano completou ...`.

**A cabeça descoberta (02/11/2026: *"ao abrir, o jogador pode estar com elmo equipado ou coisa na cabeça, e precisamos retirar"*).** Quando o criador abre para um personagem que já existe, o que ele tem na cabeça (elmo, capuz, touca de malha) sai enquanto o criador está aberto, para o rosto aparecer, e volta como estava quando o criador fecha (salvando ou não). O resto do que veste fica. O log diz `creator: Fulano: o que cobria a cabeça saiu enquanto o criador está aberto`.

### O que o jogador vê

A tela é uma **página do próprio mod** (`ui-src/creator.html`, empacotada em `ui/creator.html`) no lado **direito**, com margem nos quatro lados, o canto superior esquerdo e o inferior direito dos nossos ornamentos, o bege, o vermelho e o preto do painel (F2). À esquerda fica **o corpo do próprio jogador**, filmado de frente por uma câmera do mod, com uma luz quente e uma névoa dourada sobre o mundo; o HUD e o chat somem. Arrastar na esquerda gira a câmera em volta do personagem, e a roda do mouse aproxima e afasta.

Tudo numa só aba, com os nomes em latim e o português ao lado, como no painel:

| Campo | O que é |
| --- | --- |
| **Sexus** *homem ou mulher* | **Vir** ou **Femina**. Trocar de sexo recomeça do catálogo do outro (para o jogo, o sexo é o corpo-base, e trocar mexe nos quatro números de combate que o corpo carrega: armadura base, visibilidade, furtividade e ataque desarmado, os mesmos do criador do próprio jogo) |
| **Capillus** *cabelo* e **Color** *cor* | O estilo (setas) e, **no centro, círculos com a cor**: preto, castanho escuro, castanho claro, ruivo escuro, ruivo, loiro, grafite, grisalho e branco (nem todo estilo vem em todas; os do barbeiro têm uma cor só) |
| **Facies** *rosto* | Os rostos genéricos e, depois deles (02/11/2026), os dos personagens adultos do jogo como eles são (Henry, Capon, Žižka, Katherine...), nunca um ferido, morto, criança, o demônio ou a cabeça cortada |
| **Barba** *só para homens* | Uma barba que o rosto escolhido pode ter, ou nenhuma (o jogo recusa o visual inteiro se o rosto não tem aquela barba) |
| **Cutis** *pele* | Os tons claro, moreno e romani e, desde 02/11/2026, as peles de idoso, a africana e a da mulher mais encorpada; nunca a de ferido, de afogado ou de cadáver |
| **Aetas** *idade* e **Statura** *altura* | Desde 02/11/2026 (*"idade com limite de uma idade razoável naquela época, tanto mínima quanto máxima; altura respeitando limites masculino e feminino"*): idade de **18 a 80 anos** (adultos: o reino tem casamentos e famílias) e altura de **1,55 a 2,00 m** para homem e **1,45 a 1,85 m** para mulher (por volta de 1,70 m e 1,60 m era o comum na época). As setas sobem e descem de um em um, mais rápido segurando, e a roda do mouse também. O jogo não deixa o corpo mais alto ou mais baixo: a altura é o que o personagem diz de si, e aparece no painel (Personagem) |
| **Nomen** *o primeiro nome* | Veja abaixo |
| **Agnomen** *alcunha, se quiser* | Veja abaixo |
| **Sortear** | Um visual ao acaso do sexo escolhido |
| **Salvar e criar** | Só abre com um nome que o servidor disse estar livre |

O que o criador oferece, pela documentação do KCDC (o servidor loga a contagem de verdade a cada início, em `creator: catálogo dos homens ... das mulheres ...`): desde 02/11/2026 (*"vamos disponibilizar mais opções de rosto, cabelo e etc, se tiver como e não quebrar"*), homem, **115 rostos** (os 73 genéricos e 42 de personagens), **57 estilos de cabelo** (18 genéricos em nove cores, 16 do barbeiro, 3 de monge, a tonsura em nove cores e 19 com nome), **24 peles** e até **25 barbas por rosto** (as genéricas, as do barbeiro e as com nome que aquele rosto pode ter: o jogo recusa a combinação que não existe); mulher, **59 rostos**, 11 estilos (todos os que existem) e **27 peles**. Até 02/11 eram 73 rostos, 37 estilos, 14 peles e 20 barbas para o homem e 50 rostos e 14 peles para a mulher. Ficam de fora os rostos feridos, mortos, de criança, do demônio e a cabeça cortada; os cabelos do demônio e os que podem trazer chapéu ou coroa (do rabino, do Musa, do Samuel e do Sigismundo); e as peles de ferido, de afogado, nuas e de cadáver. Os novos vêm depois dos de antes, que guardam os seus números. Quem abre o criador pela primeira vez já vem com um **visual sorteado**, para o servidor não ficar cheio de Henrys.

### O nome e a alcunha

Pedido do usuário: **só o primeiro nome**, sem espaço, número nem símbolo, e uma alcunha que faça sentido na Boêmia (*Henry I*, *Henry II*, *Henry Júnior*).

- O nome tem de **2 a 16 letras**, só letras do alfabeto da Boêmia e do Brasil (de A a Z e as acentuadas: `Matyáš`, `Jiří`, `João`). **Espaço, número, pontuação, símbolo e emoji** são tirados da caixa enquanto se digita, e a tela avisa por que. Sai com a primeira letra maiúscula (`hENRY` vira `Henry`). Palavras do jogo e da equipe (`Desconhecido`, `Admin`, `Coroa`, `Servidor`...) não servem.
- A **alcunha** (*agnomen*) é escolhida numa lista, em quatro grupos, com a palavra tcheca da época ao lado quando há uma: **Ordem** (I, II, III, IV, V), **Idade** (Júnior *Mladší*, o Velho *Starší*, o Jovem *Mladý*), **Aparência** (o Ruivo *Zrzavý*, o Moreno *Snědý*, o Louro *Plavý*, o Grisalho *Šedivý*, o Alto *Vysoký*, o Baixo *Malý*, o Forte *Silný*, o Calvo *Plešatý*, o Barbudo *Vousatý*, o Coxo *Kulhavý*) e **Caráter** (o Justo *Spravedlivý*, o Valente *Statečný*, o Piedoso *Zbožný*, o Sábio *Moudrý*, o Bom *Dobrý*, o Generoso *Štědrý*). Está em `src/server/character-name.ts` (`EPITHETS`).
- **Dois personagens não têm o mesmo nome.** Compara-se o primeiro nome com a alcunha, sem maiúsculas, acentos ou pontuação (`Matyáš II` e `matyas ii` são o mesmo), contra os outros personagens (os que já deram nome, e os feitos antes disso, pelo apelido que usam) e contra os jogadores que estão online e ainda não têm personagem. É para isso que existe a alcunha: o segundo Henry é *Henry II* ou *Henry o Ruivo*. A tela pergunta ao servidor enquanto se digita e mostra o resultado (*Esse nome está livre*, ou *Já existe um Henry II. Escolha outra alcunha ou outro nome*); o servidor confere de novo ao salvar.
- **O nome se escolhe uma vez.** Depois, quem abre o `/creator` vê o nome e a alcunha, sem poder mudar. O administrador pode. Um personagem feito **antes** do criador pedir o nome ainda usa o apelido da conta; ao abrir o `/creator` a tela sugere a primeira palavra do apelido, quando ela pode ser um nome.

**Onde o nome aparece.** O que os outros jogadores leem é `nameOf` (`src/server/acquaintances.ts`): **o primeiro nome, a alcunha e o sobrenome da família**, nessa ordem (*Henry II Capon*). Vale para o que sai de **Desconhecido** quando alguém se apresenta, para os dados, o comércio, as nomeações e a hierarquia, para as mensagens de quem lhe entrega uma chave, uma casa ou uma região, e para o **dono no letreiro das portas e baús** (*Casa 03 - Henry II*, que acompanha um sobrenome dado depois). O painel (F2) mostra o nome no alto da seção Personagem e na raiz da árvore da família. O **administrador** lê os dois: *Henry II Capon (Mauro)*, com a conta entre parênteses, nas listas de Jogadores, de quem receber e de quem nomear.

### Como funciona

O servidor (`src/server/creator.ts`) e o cliente (`src/client/creator-page.ts`) conversam por eventos; o que o jogador escolhe vai **em números** (o enésimo rosto, o enésimo penteado na enésima cor) e o servidor os traduz para os nomes do jogo, recusando o que está fora do catálogo (`src/server/creator-catalog.ts`).

- **A prévia é o próprio corpo.** Cada escolha vai ao servidor, que a põe no corpo real com `player.setAppearance`, no máximo a cada 120 ms; a câmera mostra o que o corpo veste. Se o jogo vestir o Henry padrão por cima (ele faz isso no fim do carregamento), o servidor repõe o visual a cada 1,5 s. Depois de **aceito**, o visual é mantido por mais **20 s** pelo mesmo motivo.
- **A câmera** (`Camera.setShot`) fica em frente ao corpo, a **3,5 m**, com campo de visão de **36°**, de modo que o personagem fique **à esquerda do meio** (0,4 da meia largura) e a direita fique para a tela. Raios (`World.raycast`) a mantêm fora das paredes: se a frente está tapada, ela vai para o lado mais livre, e se vem uma parede por trás, aproxima-se. A tela espera o corpo estar pronto e **mais 12 s** depois do início do jogo (o jogo veste o padrão no fim do carregamento).
- **Sair.** Quem já tem personagem recebe de volta o visual de antes. Uma tela parada por **15 minutos** fecha sozinha (nunca a de quem entra pela primeira vez). Se o corpo morre, a tela fecha, e quem não tinha personagem a recebe de novo no próximo nascimento. A cavalo, a tela espera o jogador descer (a quem só ia mudar o visual, ela avisa e desiste).
- **Quando a página não abre** (o navegador do mod ainda não subiu, o arquivo faltou, a câmera foi recusada), o cliente avisa, o servidor **tenta de novo duas vezes, com 4 s entre elas**, e depois abre o criador **do próprio jogo**, que quem não tem personagem também não pode deixar. O log diz (`creator: ... a página não abriu`).
- **Enquanto a tela está aberta**, o painel F2/F3 não abre, os letreiros das portas se calam e o jogador não se mexe: a página tem o teclado.

### Comandos

| Comando | O que faz |
| --- | --- |
| `/creator [male\|female\|both]` | Abre o criador (para os dois sexos, ou só um) |
| `/creator nativo [male\|female\|both]` | Abre o criador **do próprio jogo**, sem nome nem alcunha; quem não tem personagem não pode deixá-lo |
| `/creator stop` | Fecha o criador e repõe o visual. Para quem entra pela primeira vez, é recusado (o administrador pode) |
| `/creator camera [distancia] [figura] [fov] [altura] [luz]` | **Só admin.** Ajusta o enquadramento do próprio cliente, sem novo deploy: a distância em metros (1,5 a 6), onde fica o personagem na tela (0 é o meio, 0,9 é quase na borda), o campo de visão em graus (20 a 70), a altura da mira em metros (-0,6 a 0,6) e a luz (0 a 20). Os números dados trocam os em uso, os outros ficam; o jogo escreve na tela os valores que ficaram, e vale já num criador aberto e nos próximos. `/creator camera padrao` volta ao padrão. Como a tela aberta tem o teclado, o ajuste se faz **antes** de abrir |

### Eventos

| Evento | Sentido | Campos | O que o servidor confere |
| --- | --- | --- | --- |
| `creator.begin` | servidor → cliente | o catálogo em contagens, o visual de partida, o nome e a alcunha, a lista de alcunhas, as regras, `mandatory` | |
| `creator.preview` | cliente → servidor | `look` (números) | os números, contra o catálogo e o sexo permitido |
| `creator.check` | cliente → servidor | `name`, `epithet` | as regras do nome e se está livre; a resposta (`creator.name`) leva de volta o que foi perguntado |
| `creator.accept` | cliente → servidor | `look`, `name`, `epithet` | tudo de novo; salva, veste e dá o kit inicial |
| `creator.cancel` | cliente → servidor | `forced` (a tela fechou por si, sem escolha do jogador) | quem entra pela primeira vez só sai por `forced` |
| `creator.failed` | cliente → servidor | `reason` | a nova tentativa e, depois de duas, o criador do jogo |
| `creator.refused`, `creator.done`, `creator.end`, `creator.tune` | servidor → cliente | a recusa e o campo, o nome final, nada, os números do enquadramento | |

### Ainda não testado no jogo

A **câmera de frente** (que o corpo mire para onde o jogador olha, e que o enquadramento fique bom: por isso o `/creator camera`), a **luz** (a escala da intensidade do jogo não é conhecida: 2,2 é um palpite), a **névoa dourada** em vez do fundo dourado do palco do jogo (o palco, com o painel dele, é todo do KCDC e não aceita a nossa tela), o **visual mudando em tempo real** no corpo, a **página transparente sobre o mundo**, e se o **HUD** e o **chat** somem e voltam. O criador que o servidor abre sozinho espera o corpo estar pronto: se o log disser `a página não abriu`, é isso.

## Kits, livros de receita e vendedores

### Kit inicial

Todo personagem recebe **uma vez**:

- roupas simples de trabalho, **já vestidas**: as que o jogador escolheu na aba **Roupas** do criador (parte de cima, calças e calçados, entre 8 peças básicas de cada, com o ícone do jogo; `data/creator-clothes.json`, feito por `tools/make-creator-clothes.py`). Quem não mexeu na aba sai com a primeira de cada; se o jogo recusar, valem os presets `labourer_*` para homem e `f_villager_*` para mulher;
- **100 moedas**;
- **uma espada de caça** (`huntingSwordBasic`) **e uma adaga** (`daggerCommon`), as duas, para todos. A adaga do jogo não é feita para combate, e por isso o sorteio de antes (adaga, espada de treino ou espada de caça) foi trocado. Quem ganhou uma arma no sorteio e ainda a tem recebe só a outra;
- **comida que não estraga para umas cinco horas**: 3 salames secos, 2 carnes-secas, 2 queijos secos e 2 porções de nozes, 188 de nutrição ao todo. No nível de fome padrão (`media`) um estômago cheio (100) dura 3 horas, então isso dá cerca de 5 h 30. Os quatro têm tempo de estrago 0 nas tabelas do jogo;
- **uma tocha** (`rutinaAVypad_trackview_torch_weapon`, a única tocha das tabelas do jogo: o nome é de uma cena de missão, mas é a tocha de mão do jogador, com o seu próprio encaixe de equipamento e luz);
- **6 dados comuns** (`dieNormal`, para jogar nas mesas das tavernas: `E` no outro jogador e **Jogar dados**, ou `/dice <jogador>`; ficam guardados durante o jogo e voltam no fim).

As armas, a tocha e a comida vão para o inventário; o jogador as equipa. Quem já tinha personagem antes recebe o que falta na próxima entrada. Se o jogo recusar a roupa na hora, o servidor tenta de novo 3 vezes e depois na próxima entrada; nada é pago duas vezes. Os valores ficam em `STARTER_MONEY`, `STARTER_WEAPONS`, `STARTER_FOOD`, `STARTER_TORCH` e `STARTER_DICE` (`src/server/kits.ts`).

> **A moeda do jogo.** O item `money` aparece na tela dividido por 10: 1.000 do item são 100 moedas. Por isso o kit inicial dá **1.000** (`/give money 1000` dá o mesmo), os bandidos levam de 50 a 200 (5 a 20 moedas) e os preços das lojas, que vêm da tabela do jogo, já estão nessa escala. A primeira versão do kit pagou 100 do item (que aparecia como 10 moedas); quem recebeu isso é completado com os 900 que faltavam, uma vez, na próxima entrada.

### Kit de cada guilda

Entregue **na primeira vez** que o jogador entra na guilda (pelo painel). Trocar de guilda e voltar não repete; cada guilda tem o seu kit uma vez, então quem passa por várias recebe o kit de cada uma. O kit da guilda a que o jogador já pertence é oferecido de novo a cada entrada, o que alcança quem entrou na guilda antes de os kits existirem ou estava com a mochila cheia na hora.

| Guilda | Kit |
| --- | --- |
| Ferreiro (Fabri Ferrarii) | Os livros **Manual do Ferreiro I: Ferramentas** (machado de trabalho, machado de carpinteiro, ferraduras de fazenda) e **II: Lâminas de Aprendiz** (espada de caça de treino e espada de caça), mais 10 sucatas de metal, 2 ferros, 4 de aço e 2 de material de fixação, o suficiente para forjar uma peça de cada |
| Caçador (Venatores) | Um arco de aveleira (`bow_b`), 20 flechas de caça e 20 flechas comuns |
| Taberneiro (Tabernarii) | 3 carnes de porco cruas, para cozinhar |
| Alquimista (Alchemistae) | O livro **Herbário do Aprendiz** (decocção de calêndula, poção digestiva e Aqua Vitalis) e as ervas para duas a três levas de cada: 5 urtigas, 8 calêndulas, 4 dentes-de-leão, 4 cardos e 2 carvões. A base líquida das poções vem da própria mesa de alquimia |
| Coletor (Collectores) | O **machado de lenhador** (`axeWork01`), a **picareta** (a do cavaleiro, `axeBattle03`, a única picareta do jogo, **usada**: qualidade 1 e metade da condição; novas, o ferreiro forja) e a **roupa de trabalho**, cortada para o corpo: para homem, a túnica de minerador, as calças de mineiro, o capuz de minerador e botas de trabalho; para mulher, o vestido de trabalho, o lenço de cabeça de trabalho e os sapatos; para os dois, a bandagem de mão. Tudo no inventário (vestir é com o jogador) |
| Artesão (Artifices) | **Dez roupas simples para vender**, nenhuma vestida: 2 túnicas curtas, 1 túnica longa, 1 túnica gasta, 1 vestido simples, 2 toucas, 2 capuzes e 1 véu. O jogo avalia o conjunto em cerca de 1.150, no meio dos outros kits (ferreiro 580 mais dois livros, taberneiro 140, alquimista 60 mais o livro, e o caçador 3.600 por causa do arco) |

### Livros de receita

São itens do servidor (`Items.register`, `src/server/books.ts`), com a aparência de um documento de receita do jogo, e a ação **Ler**. Ler o livro o consome e ensina as receitas: na alquimia, pelo livro de receitas do jogador (`Crafting.setKnowledge`); na forja, dando o perk que libera cada receita (`player.addPerk`). Um livro cujas receitas o jogador já sabe **não é gasto**. Se nada pôde ser ensinado depois de o livro ser tirado, ele é devolvido. O que o jogador aprendeu é salvo junto com o personagem.

Há 15 livros. Os dois primeiros de ferreiro e o primeiro de alquimia vêm nos kits; os outros são vendidos:

| Vendedor | Livros |
| --- | --- |
| Ferreiro | Machados de Guerra, Ferraduras (4 tipos), Espadas de Caça (4), Espadas Curtas (6), Sabres (2), Espadas Longas (5) |
| Boticário | Receituários de Tônicos, de Vigor, do Caçador, de Medicina, de Perfumaria e o Proibido (venenos) |

As receitas de missão e as especiais do jogo (artefatos, espadas lendárias) não estão em nenhum livro.

### Vendedores

São os NPCs da cidade que o servidor cria (além dos bandidos): **cinco ofícios em Suchdol**, cada um numa loja que o próprio nível tem (as entidades `Shop` do nível): o taberneiro na taverna, o ferreiro na ferraria da vila, o boticário e o caçador nas duas bancas de mercado e a costureira entre elas; **13 mascates**, um em cada fogueira de beira de estrada que o nível guarda para os mercadores errantes do jogo (os lugares `taboryUCesty`); e **8 banhistas** nos banhos que o nível tem (pedido de 16/10/2026: *ative os NPC de banho*). **Wysoka e Raborsch não têm loja nenhuma no jogo** (a loja de Wysoka que o nível guarda, `Shop[...seller/shop_noDesk5...]` em 378, 2458, é só uma marca de lugar, sem balcão), e as outras vilas também não: por isso o servidor põe em **toda vila mapeada** (três casas do censo ou mais) um **ferreiro, um boticário e um taberneiro** do lado de fora de uma casa livre, de dia pela vila e à noite na cama (pedido de 17/10/2026). Em 20/10/2026 (*vamos mapear o resto inteiro e já ir colocando os NPC de venda nas cidades*) o mapa passou de 6 para 17 regiões (veja [`/propriedade`](#propriedade)), e a vila que o censo arquiva nesse início ganha os seus 50 segundos depois de o servidor subir, sem esperar o reinício seguinte (o log diz `vendors: N vendedor(es) de vilas novas, mapeadas neste início: ...`). Aparecem uns 12 segundos depois de o servidor subir, **sem nome nem barra de vida sobre a cabeça**, como a gente do próprio nível, e **não podem ser feridos** (se algo os derrubar, voltam 10 segundos depois). Vendem pelo preço que o jogo dá ao item mais 20%, ou pelo preço do livro, e as prateleiras se enchem de novo a cada 15 minutos. Falar com o NPC abre a tela de comércio do jogo.

**Não têm dinheiro** (pedido de 18/10/2026: *zerar o dinheiro dos NPC, fixo sempre, mesmo se comprar algo o NPC continua com 0, assim nenhum jogador vai vender mais nada aos NPCs*): a bolsa de todo vendedor é 0 e o que o jogador paga numa compra é tirado dela logo depois do negócio. **Não vendem mais livros de receita**, só os **livros de habilidade** do próprio jogo do seu ofício e os ingredientes que as receitas das guildas pedem. Os **mascates** levam, além das miudezas, 8 ingredientes das guildas (outros em cada fogueira) e um ou dois livros de habilidade da estrada (furto, briga, montaria). Os **baús dos bandidos**, os **tesouros** pelo mundo e às vezes **o próprio bandido** também trazem esses materiais.

**Compram só o que é do ofício deles**, e pagam 35% do que o jogo diz que o item vale: o ferreiro, materiais de forja, armas do dia a dia e ferraduras; o boticário, ervas, poções, unguentos e o que a alquimia usa; o taberneiro, bebida, pão, queijo, frutas, legumes, carnes e peixes; o caçador, carne de caça, peixe, peles, flechas, arcos e balestras; o alfaiate, roupas; o mascate, miudezas (dados, insígnias, óculos, tapa-olho, broches, terços). Cada um aceita no máximo 128 tipos (é o limite do jogo); a lista fica em `data/vendor-buys.json`, só no servidor, gerada das tabelas do jogo por `tools/make-vendor-buys.py`. Cada vendedor tem uma **bolsa de 5.000 moedas** (como o jogo mostra) para pagar: quando acaba, ele para de comprar, e ela volta cheia **24 horas** depois de enchida, com reinício ou sem. O que resta em cada bolsa fica em `playerdata/vendor-purses.json`.

**O dia de um vendedor**, pelo relógio do jogo:

- **De dia, soltos pela vila** (pedido de 16/10/2026: *o correto era deixar eles livres ali na vila e eles mesmos decidirem o que fazem*). O servidor não dá vida própria a um NPC (a do jogo não vem junto), então o pouco que a imita está em `src/server/vendors.ts`: o vendedor caminha até um ponto andável a até 16 m do seu lugar, fica ali de 15 a 50 segundos, escolhe outro. Quem chega a 5 m é olhado, cumprimentado com uma frase do ofício (no máximo uma vez a cada 10 minutos por pessoa) e **o vendedor para** enquanto a pessoa estiver ali.
- **Da hora de dormir até as 6 h, em casa.** Às 22 h (o taberneiro, que abre às 9 h, também às 22 h) vai até a porta da casa, entra (some) e sai pela porta às 6 h. Dormindo, não vende. Quem não tem casa fica onde está.
- **O mascate não tem casa**: fica junto da fogueira (a até 5 m), dia e noite, e o servidor **acende a fogueira** (`WH_Particels.fires.exterior_fireplace`, do catálogo de partículas do jogo; o `campfire_a` do exemplo do framework não existe nele) para ela se ver de longe.
- **As banhistas não têm casa**: ficam nos banhos (a até 5 m do lugar), dia e noite, como o mascate, sem fogueira.
- **Sem as poses de balcão.** As posturas de vendedor de barraca do jogo (`SellerLoop` e as outras) foram tiradas: elas foram feitas para quem fica encostado no balcão, e sem o balcão deixavam o NPC *sentado no ar*.

Os trajetos são **planejados pelo servidor na malha de navegação do nível** (contornando casas, cercas e paredes). Um trajeto que trava é tentado de novo pelo próprio jogo e depois completado de uma vez; com ninguém por perto para ver, o vendedor chega na hora; com alguém olhando, em até 3 minutos. A casa de cada um é a casa vazia (sem dono) da própria vila mais perto da banca, até 250 m (a taverna, para o taberneiro), e **fica marcada como dele no catálogo**: ganha o nome do morador quando ainda tem o nome do censo (`Casa do Ferreiro`, `Casa do Boticário`, `Casa do Caçador`, `Casa da Costureira`, `Taverna de Suchdol`), as seções Chaves e Propriedades mostram o morador (NPC) e o servidor **não deixa entregar a casa a um jogador**. A cada início o vendedor volta para a casa que já é dele; uma casa que deixou de ser de algum vendedor volta a ficar livre. Quem não tem casa fica na banca a noite toda. O NPC só se move quando há um jogador por perto para o jogo dele rodar o corpo. O log do servidor diz `vendors: 5 vendedores (Suchdol) e 13 mascates` e `13 mascate(s) nas fogueiras de beira de estrada, N fogueira(s) acesa(s)`.

| Id (`/vendedor`) | NPC | O que vende |
| --- | --- | --- |
| `ferreiro` | Mestre Ferreiro | Ferro, aço (3 tipos), cobre, material de fixação, guardas e pomos de espada, guarda especial, madeira exótica, adornos, e os **livros de habilidade** de artesanato, espada, armas pesadas, armas grandes e força |
| `alquimista` | Boticário | 19 ervas, carvão (e carvão melhor), teia de aranha, presa de javali, vinho, enxofre, salitre, papoula seca, amanita, raiz de mandrágora, pérola de água doce, e os **livros de habilidade** de alquimia, erudição e vitalidade |
| `taberneiro` | Taberneiro | Carnes cruas, farinha, malte, lúpulo, ovos, leite, sal, mel, banha, legumes, frutas, temperos, vinho, cortes nobres, queijos, salame, peixes, lagostins, miúdos e cogumelos, e os **livros de habilidade** de bebida e de lábia |
| `cacador` | Mestre Caçador | Arcos (3), flechas comuns, rústicas, de caça e de caça melhoradas |
| `alfaiate` | Costureira | Roupas simples: túnicas, calças, sapatos, botas, casacos, chapéus e capuzes, e vestidos, sapatos e véus femininos |
| `mascate-1` a `mascate-13` | Mascate (a cada três, Bufarinheira) | Peças de **bijuteria que o jogo não vende em outro lugar**, trocadas por sorteio entre as visitas: dados (o comum sempre, e mais 3 entre sortudo, favorável, ímpar, par, da Santíssima Trindade, azul, desequilibrado, equilibrado e de dentes), 2 insígnias de dados, 3 peças para vestir (óculos, tapa-olho do Žižka, broches, colar de cruz de estanho, escapulários, anel de prata gravado) e 2 miudezas (pente, flauta, terço, colar de jaspe) |
| `banho-1` a `banho-8` | Dona dos Banhos, Banhista, Administradora dos Banhos | **Sabão** (o comum e o do cavaleiro), **perfumes** (Mintha e Leão, fraco, médio e forte) e **ataduras**; compram o mesmo, a um terço do valor |

**Os banhos** estão onde o próprio nível põe as suas banhistas e abadessas dos banhos (`kgru_bathmaid`, `kzik_bathmaid`, `kzik_bathhouseAbess`, `kkut_betasBathmaid_1`, `kkut_spaAdministrator`, `ksuc_bathhouseAbess_1`) e, em Malešov, onde ele tem as tinas e as lavadeiras (`kmal_woman_18`): Suchdol (741, 3348), Zikmundovo (2), Grunta (2), Kuttenberg (2) e Malešov. **Elas não lavam o jogador**: a sujeira é do próprio jogo e o servidor não consegue mexer nela (veja [Sujeira](#sujeira)). O que elas fazem é vender o sabão e o perfume, que o jogador usa do inventário na água (rio, fonte, bacia, tina); a água continua sendo a do jogo. Ainda não testado no jogo: que o sabão comprado limpa de fato o corpo. `/vendedor listar` mostra onde cada uma está.

As posições originais vêm do nível (as lojas de Suchdol e as fogueiras de beira de estrada); se algum ficar fora do lugar, fique no ponto certo e use `/vendedor aqui <id>`.

## Barbeiros

Pedido de 16/10/2026: *vamos adicionar NPC barbeiros*. O nível tem **um**, em Kuttenberg, ao lado dos banhos (`kkut_betasBarber`, com a tenda dele); o servidor tem **mais quatro** nas vilas do roleplay, para ninguém precisar cavalgar até Kuttenberg por um corte de cabelo: **Suchdol, Wysoka, Raborsch e Malešov** (`src/server/barbers.ts`). São NPCs parados, sem nome nem barra de vida sobre a cabeça, que ninguém fere nem saqueia.

**Como funciona.** Quem usa a tecla de falar no barbeiro recebe a **lista de escolhas do jogo**: *Cortar o cabelo*, *Tingir o cabelo* e *Barba* (só para quem tem rosto que deixa crescer uma). Cada escolha é **posta no corpo na hora**, para o jogador ver como fica, e o barbeiro pergunta *Fica bem assim?*: **Ficar assim** custa **20 moedas** (200 unidades do item `money`, que o jogo mostra como a décima parte) e vira o visual do personagem (`playerdata/characters.json`, o mesmo lugar do criador); **Escolher outro** volta à lista; **Deixar como estava** devolve o visual de antes. Sair, se afastar mais de 8 m, morrer ou desconectar também devolvem o visual de antes. As listas têm 5 por página, com *Mais ›* e *‹ Os de antes*, e o que o jogador já usa vem marcado (*o seu*). Os cortes e as barbas são os mesmos que o criador de personagem oferece (`creator-catalog.ts`), e a **cor** de um corte novo é a que o jogador já usa.

**O que o barbeiro nunca mexe:** o rosto, a pele, o sexo e o nome, que são do criador. Só atende quem tem personagem salvo (Steam ID); sem dinheiro ele diz quanto falta e deixa o visual provado no corpo até a pessoa escolher outro ou desfazer. O log diz `barbers: Fulano pagou 20 moedas a barbeiro-suchdol: {...}`.

> **Ainda não testado no jogo:** que a lista de escolhas abre pelo uso do NPC, e que `setAppearance` troca o cabelo e a barba do corpo na hora, em quem já está no mundo. Os cinco lugares estão em `BARBERS`; os quatro das vilas são palpites ao lado de lugares conhecidos e ficam na malha de navegação mais próxima (`/mestres ir barbeiro-suchdol` leva até lá).

## Mestres de habilidades

Pedido de 16/10/2026: *os NPC que ensinam esgrima, caça e outras habilidades, cada um em seu local de origem*. O jogo tem **78 mestres** (cada um uma pessoa do mundo que leva o aluno até um nível em uma ou mais habilidades, por um preço: `skill_teacher.xml` e `skill_lesson_level.xml`); os **38 que moram neste mapa** ficam onde o nível os põe (`src/server/teachers.ts`, dados em `teachers-data.ts`, gerados por `tools/make-teachers.py`). Os outros 40 vivem nos outros mapas do jogo (Trosky, o mosteiro de Sedlec), que este servidor não roda. O Capitão Frenzl fica no castelo de Suchdol; os mestres de espada e de armas, em Kuttenberg; o arqueiro Lazar, o moleiro Hermann, o padre de Wysoka, o de Raborsch, e o resto, cada um no seu canto. `/mestres` lista todos, com onde ficam e o que ensinam.

**Como funciona.** Falar com um mestre abre a lista de escolhas com o que ele ensina, e para cada habilidade o nível do aluno, o degrau a que a lição o leva e o preço. **Uma lição leva a habilidade ao próximo degrau de 5 (5, 10, 15 ou 20)** que o mestre ainda ensina, pelo preço da tabela do jogo para aquele degrau: **75, 200, 500 e 1.000 moedas**. A lição é o `AdvanceToSkillLevel` do próprio jogo (`player.setLevel`): o aluno ganha exatamente a experiência entre os dois níveis, com os avisos de subir de nível e os pontos de perícia no caminho. As lições do jogo também gastam horas do relógio; aqui o relógio é do servidor, então a lição é só o preço. Se o jogo não aceitar a lição, o dinheiro volta. O que cada um ensina é o que o jogo diz (e até onde: um mestre de nível 15 não leva ninguém ao 20).

**Esgrima e caça.** A esgrima não é uma habilidade à parte (o jogo a deriva das habilidades de arma): quem ensina **Espadas** ensina a esgrima. Para armas de haste, armas pesadas e briga há mestres próprios, e a **caça** é **Pontaria** (arco e besta) e **Sobrevivência** (rastros, ervas), com mestres como o arqueiro Lazar, Mestre Sem Pelos (o arqueiro de Kuttenberg) e o padre de Wysoka. Também ensinam: alquimia, artesanato, equitação, furtividade, roubo, adestramento de cães, erudição e bebida.

> **Ainda não testado no jogo:** que o preço da tabela (75 a 1.000) são moedas como o jogo as mostra (o servidor trata assim; se for a décima parte, é só dividir em `LESSON_PRICES`), que `setLevel` sobe a habilidade de quem já está no mundo, e os lugares: os mestres ficam onde o nível os pôs, que às vezes é um lugar de cena ou de missão (o log diz `teachers: N de 38 no lugar`).

## Propriedades e o mapeamento de Suchdol

Ninguém precisa ir de porta em porta. O servidor já conhece **todas as portas e todos os baús do nível** (`Door.all()` e `Stash.all()`) e também quais portas pertencem a qual edifício (`Area.doors`, os vínculos que o próprio jogo usa para crime). `/propriedade mapear suchdol` varre a região de Suchdol, e roda sozinho na primeira vez que o servidor sobe com essa versão.

| O que é encontrado | Nome | O que a chave abre |
| --- | --- | --- |
| Um edifício com portas ligadas a ele (casa, oficina, celeiro, taverna, igreja, moinho) | `Casa 01`, `Oficina 02`, `Celeiro 03`... numerado de oeste para leste | A entrada e o depósito (portas internas ficam livres) |
| Portas sem edifício ligado, mas com o nome do prédio (uma taverna, uma casa) | `Taverna 01`, `Casa 11`... portas do mesmo prédio juntas | Todas as portas do prédio |
| Portas soltas sem nome de prédio, fora da fortaleza | `Porta 01`... **e o que ela é e junto de quê**: `Porta 08 (portão, junto da Casa 06)`, `Porta 12 (latrina, a 27 m da Casa 11)`, `Porta 15 (a 40 m do Celeiro 02)` | A porta |

Uma porta solta sozinha não diz o que é (um portão de cerca, a porta de uma latrina, a de um barracão), então as seções **Chaves** e **Propriedades**, o prompt e o menu a mostram com **uma nota**: a palavra que o nome da porta no próprio nível dá (*portão*, *latrina*, *porão*, *celeiro*, *estábulo*, *igreja*, *moinho*, *oficina*, *barracão*) e a casa mais perto, até 80 m (*junto da*, até 8 m, ou *a N m da*). A nota é só para ler: o nome guardado continua `Porta 08`, e quem renomeia muda esse nome.

| Baú dentro de um edifício | `Casa 03 · Baú 1` | O baú |
| Baú fora de tudo | `Baú 12`, com uma dica do que o jogo diz haver em volta: `Baú 07 (Torre)`, `(Taverna)`, `(Igreja)` | O baú |

Barris, sacos e cestos não são propriedades, nem as portas da fortaleza e as de cenas de cinema; `/propriedade mapear suchdol portas` inclui as da fortaleza como `Fortaleza NN`.

**Outras vilas.** O mapa do próprio jogo dá nome às áreas dos lugares (`Area.location`), e `/propriedade locais` lista todos com o tamanho. `/propriedade mapear "<nome>"` mapeia qualquer um deles pelo contorno que o mapa dá. **Wysoka** e **Raborsch** já estão em `REGIONS` e foram mapeadas sozinhas no primeiro início desta versão, pelo contorno do mapa: Wysoka deu 5 casas, 1 porta e 13 baús; Raborsch, 6 edifícios (casas e celeiros), 12 portas (as da fortaleza de Ratboř entram como `Fortaleza NN`) e 28 baús. As propriedades de cada vila ficam na região dela (o menu de região das seções Chaves e Propriedades).

**Malešov e o castelo dele** (pedido de 16/10/2026). A vila (x 430 a 660, y 225 a 410) e a fortaleza a oeste (x 440 a 500, y 344 a 402) vieram das camadas do nível (`kmal_malesov`) e entraram em `REGIONS`: no próximo início o censo mapeia a vila sozinho e o mapeador de castelos junta as portas e os baús da fortaleza em um só imóvel, *Castelo de Malešov*, como em Suchdol e Raborsch. O log diz `properties: mapeamento automático (...) Malešov` e `castelo de Malešov`. Se o contorno que o mapa dá à vila (`Maleshov`) for maior que a caixa de reserva, vale o do mapa.

Rodando de novo, o comando só acrescenta o que é novo e nunca renumera. Dê `/propriedade perto` em frente a um prédio para saber o nome dele e `/propriedade renomear <id> "Casa do Ferreiro"` para trocá-lo; a chave passa a mostrar o nome novo na hora.

**A chave é criada quando precisa.** O tipo de item da chave de cada propriedade (`kcdc-property:<id>`) só é registrado na primeira vez que uma chave dela é entregue, porque o servidor envia a cada jogador a definição de todo tipo registrado, e são quase duzentas propriedades. Os que já foram entregues são registrados de novo a cada início, para que o inventário salvo de quem tem a chave volte inteiro.

**Quando uma propriedade fica trancada.** O mapeamento não tranca nada: uma propriedade nova segue a tranca que o nível do jogo pôs (a maioria das casas está aberta; as de NPCs e as do cenário o jogo tranca, e o menu respeita isso). Ela passa a ser trancada **de propósito** quando alguém a tranca (o dono ou o admin pelo painel; quem tem a chave, pelo menu ou por `/chave`; o admin ao `registrar`), e daí em diante o servidor a mantém assim, depois de cada reinício. Entregar uma chave **não tranca** mais a casa. Se uma porta ainda não existir quando o servidor sobe, ele tenta de novo por até dois minutos e avisa no log.

**Donos, descrição e região.** Cada propriedade pode ter um **dono** (guardado pelo Steam ID, com o nome que ele tinha ao ser visto pela última vez), uma **descrição** de até 240 caracteres e uma **região**, que é só um nome: quem cria a região é o admin, ao pôr uma propriedade nela (`/propriedade regiao <id> <nome>` ou o botão Editar da seção Chaves). O admin **entrega a propriedade** a um jogador pela seção Chaves ou por `/propriedade dono`: o jogador vira o dono, e **nenhuma chave vai junto** (um castelo entregou 59 chaves de uma vez e lotou o inventário de quem talvez não usasse nenhuma): ele pega as que precisar, uma de cada vez, pelos botões da casa e dos baús na seção Propriedades. O dono, pela seção **Propriedades**, muda o nome e a descrição e faz chaves da casa e dos baús para si ou para outro jogador, até 8 chaves por propriedade; o admin não tem limite. Quem tem a chave de uma casa a leva no inventário; para tirar o acesso de alguém é preciso o admin (`/propriedade dono <id> nenhum` e uma nova entrega), porque a chave é um item. Um **baú dentro de uma casa** é guardado sob ela (o servidor liga os baús às casas pelo nome, uma vez, no primeiro início desta versão), tem o dono da casa e não aparece sozinho nas listas.

**As portas de uma casa, como os baús.** Uma casa com **mais de uma porta** lista as portas sob ela, no detalhe das seções Propriedades e Chaves, como lista os baús: **Entrada** (a porta que o mapa marca como a da frente) e **Porta 2**, **Porta 3**..., cada uma com o seu botão **Trancar/Destrancar**. O botão da casa passa a dizer **Trancar tudo** e **Destrancar tudo**, e uma casa com só algumas portas trancadas aparece como **parcial**. O estado de cada porta é guardado (`doorLocks`, em `playerdata/properties.json`) e refeito a cada início.

**Ceder uma região inteira.** O admin pode ceder uma região a um jogador (o cartão da região, na seção Chaves, abre o quadro **Ceder uma região**, com *Para quem*; com *Para mim* o admin pega a região para si): tudo o que ainda não tem dono nela passa a ser dele (as casas e, sob elas, os baús; nenhuma chave é feita, porque o dono não precisa de uma), e ele **decide por si** o que fazer: dar nome e descrição, trancar, fazer chaves, **entregar** a outros. O que não passa fica na lista dele **só para ler**: a casa de um vendedor (um NPC) e o que já era de outro dono. A região fica registrada com o seu senhor (`playerdata/regions.json`): uma propriedade nova que o censo achar nela vai para ele também, e a hierarquia mostra a região entre as terras dele. Antes de ceder o painel mostra a conta, e o servidor confere de novo; `status.regionCede` sem `confirm` só diz o que passaria. A casa de um vendedor nunca é dada a ninguém, nem por quem a vê na lista.

**Remover o dono de uma região** (28/10/2026: *no ceder, adicione a opção "remover dono" no dropdown; ao selecionar, remove o dono da região*; e, depois de um teste que deixou mais de 100 propriedades no nome do administrador: *as propriedades da terra que eram do dono devem sair também; ao perder a terra ele perde as propriedades da região*). Numa região que tem senhor, o dropdown *Para quem* do quadro **Ceder uma região** ganha uma terceira opção, **Remover dono** (depois de *Para mim*); escolhida, o botão passa a dizer **Remover dono** e o quadro explica o que vai acontecer. A região deixa de constar em `playerdata/regions.json` (a Cidadania e a hierarquia deixam de mostrá-lo como senhor das terras, e uma propriedade nova que o censo achar lá não vai mais para ele) **e o senhor perde as propriedades que tem nela**, o que recebeu na cessão e o que já tinha lá: voltam a não ter dono (os baús vão junto com a casa, com o que há dentro). **O que é de outros donos na região continua com eles**, o que o senhor tem em outras regiões não é tocado, e as chaves já entregues continuam com quem as tem. O senhor que sai, se estiver no jogo, é avisado no chat. Sem confirmar, o evento só conta (*N propriedade(s) dele ficariam sem dono e M de outros donos continuariam*). **Para limpar uma região que ficou sem senhor mas com propriedades no nome de um jogador** (o que fazia a primeira versão do "Remover dono", de 28/10/2026): *Ceder a região inteira* → *Para mim* (ou para quem tem as propriedades) e logo *Remover dono*. É o evento `status.regionCede` com `remove: 1` (e `confirm: 1`, que sem ele só conta); só admin (`releaseRegion`, em `src/server/properties.ts`). A opção só aparece quando a linha da região diz que há senhor (`lord`, em `regionLines`, `src/server/status.ts`).

**Dar e ceder, sempre pelo mesmo quadro** (22/10/2026: *nos meus animais existe um botão ceder, achei bem legal esse padrão, muito mais do que na tela Nomeação, Chaves e Propriedades, a forma de ceder algo ali é ruim; prefiro que sejam tudo no padrão do ceder igual de animais*). Chaves, Propriedades e Nomeação escolhiam o destinatário num seletor no alto da lista (*Quem recebe*, *Quem será nomeado*) e os botões agiam sobre ele; o seletor foi embora. Agora **o botão está na coisa** e abre o quadro dos Animais (`openGiveForm`, em `ui-src/status.html`): o que é (o tipo e o nome), **Para quem** (a lista de jogadores, pedida ao servidor uma página por vez, com busca; *Para mim* primeiro quando o jogador pode ficar com a coisa), uma nota do que vai acontecer, dita com o nome escolhido, e o botão de confirmar com **Cancelar**. Os botões: **Dar chave** (a casa, uma porta, um baú; admin e dono; com *Para mim*), **Ceder** (a propriedade: o dono a outro jogador, e o admin a um jogador ou a si mesmo), **Ceder o quarto**, **Ceder a região inteira** (o cartão de Chaves, com *Para mim* e, havendo senhor, *Remover dono*), **Nomear** (em Nomeação: os jogadores que o nobre pode nomear, ou qualquer um para o admin) e **Dar** o cavalo ou a carroça (Animais, o que já era). Os eventos que o painel manda ao servidor são os mesmos de antes (`status:grantKey`, `propOwner`, `propGive`, `roomGive`, `regionCede`, `nominate`, `animalGive`): só a escolha do jogador mudou de lugar.

**O nome na porta e no baú.** (Tirado em 18/10/2026, quando o nome ia no menu do **E**, e devolvido em 19/10/2026, quando o menu saiu.) Ao olhar para uma porta ou um baú de uma propriedade, a poucos metros, aparece um texto branco, na fonte do próprio KCD2 (a Kingdom Come), um pouco abaixo da mira: `Casa 03 - Hans`, ou só `Casa 03` se não tem dono; um baú de uma casa mostra `Casa 03 · Baú 1 - Hans`. É o cliente que traça um raio curto da câmera pela mira e pergunta ao servidor o nome do que o raio encontrou (`src/client/property-labels.ts`, resposta em `labelFor`, `src/server/properties.ts`); a resposta fica guardada por meia minuto. O que não é propriedade não mostra nada. A posição do texto (`TEXT_Y`) e o tamanho (`TEXT_SIZE`) são constantes no começo do arquivo.

**A chave.** É o **item** da propriedade (`kcdc-property:...`) no inventário: a de uma casa vale para os baús dela, e uma porta pode ter chave própria, que vale só para ela. O **dono** não precisa da chave; pega as que quiser no painel (*Pegar chave*, *Dar chave*), uma de cada vez. Pelo **painel**, o dono (seção Propriedades) e o admin (Chaves) trancam e destrancam a casa, as portas e os baús sem estar perto.

### O mapeamento de Trosky (09/11/2026)

Pedido do dono: *"vamos mapear Trosky; todas as propriedades, baús e armários ... mapeie de forma perfeita, igual se fez na época em Kuttenberg: as portas de forma correta dentro da casa"*. O servidor roda o **mapa de Trosky** (`trosecko`), e as regiões do catálogo são **as do nível que o servidor tem** (`REGIONS` é `KUTTENBERG_REGIONS` ou `TROSKY_REGIONS`, pela `level.ts`; o mesmo vale para `TOWNS` da cidadania e para os lugares do mapa em `map-places-data*.ts`). O censo (o mesmo de Kuttenberg: as portas e os baús que o nível põe, as áreas de edifício que o jogo liga às portas) roda sozinho 20 s depois da primeira subida com cada região; os castelos e os lugares próprios, em 30 s e 120 s; o que sobrou solto vai para dentro dos prédios perto dele aos 150 s.

- **De onde vêm os lugares:** uma sonda numa cópia descartável do servidor leu os 17 lugares que o próprio mapa nomeia (`Area.location`), os nomes em português do jogo (`tools/make-map-places.py ... trosecko`) e as 297 portas e os 918 recipientes do nível. As regiões: **Semine** (com a cidadela, que é o *Castelo de Semine*, e o *Moinho do Baixo Semine*), **Nebakov** (o *Castelo de Nebakov*, a ferraria, a torre de vigia, as casas e o *Moinho de Nebakov* com a casa dele), **Trosky** (o *Castelo de Trosky*, com as casas dentro das muralhas, e a vila ao pé), **Acampamento nômade**, **Zhelejov** (com a *Estalagem de Zhelejov*), **Troskowitz**, **Tachov**, **Apolônia**, e ainda **Slatego**, **Schdiar** (as duas fazendas, cada uma uma propriedade) e **Vidlak** (o povoado em volta da lagoa: a casa do caçador, a do pescador, a oficina e as casas; o mapa só nomeia a lagoa, então a região é uma caixa).
- **Resultado do censo de teste** (instância descartável, dados vazios): 94 casas, castelos, moinhos, galpões e terrenos, e 335 baús e armários, com **nenhuma porta nem baú solto** ao fim. Ex.: Troskowitz 27 propriedades e 53 baús; o Castelo de Trosky 58 portas e 77 baús; a Estalagem de Zhelejov 16 portas e 24 baús.
- **Baús e armários:** além dos baús, o censo registra a **mobília que guarda coisas** (estante, armário, guarda-roupa: `FURNITURE_STASH`), com o nome **Armário N** (e **Casa 03 · Armário 1** dentro de uma casa), contados à parte dos baús. Barris, sacos, cestos, colmeias, armadilhas de peixe e as pilhas de mercadoria não são propriedades.
- **Nomes:** cada prédio tem o nome do seu tipo e um número (a ordem de oeste para leste, estável de um censo para o outro): Casa, Celeiro, Galpão, Oficina, Ferraria, Taverna, Moinho, Torre, Fortaleza e, desde hoje, **Banhos**, **Cozinha**, **Casa do Caçador**, **Casa do Pescador**, **Casa do Herbanário**, **Casa do Eremita**, **Esconderijo**, **Tenda**, **Acampamento de Bandidos**, **Terreno** e **Pátio** (os três últimos vêm dos nomes das áreas privadas do nível: uma tenda do acampamento nômade era "Edifício 01"). **O nome é livre**: o dono troca o de qualquer propriedade dele (2 a 60 letras) e o administrador troca qualquer um (`/propriedade renomear`, a seção Propriedades e a Chaves).
- **Portas:** uma casa tem as portas que o jogo liga a ela como **entrada** ou **depósito** (as que a chave tranca); as portas internas (`basic`) são da casa mas ficam livres, como em Kuttenberg; um castelo ou um lugar próprio leva **todas** as portas dentro das suas paredes (a de baixo do castelo, do moinho, da estalagem), e as portas de cena (`cin_`) nunca.
- **Dono responsável:** como sempre, o administrador **cede a região** a um jogador (Chaves → Terras) e ele passa a ser o responsável pelo lugar e por tudo o que não tem dono; **não precisa ser lorde**, nem ter título: pode ser quem ocupa um cargo abaixo dele. Nenhuma propriedade tem brasão (veja o brasão da família, em Família).
- **Ficou de fora, sem nome no mapa** (para o dono dar nome e mapear): uma casa com porão a leste de Troskowitz (2644, 2031), o casebre do herbanário de Kopanina (2280, 2967), um galpão a oeste de Semine (1216, 1555) e sete portas de vila soltas pelo mapa. Um lugar novo entra no catálogo com uma linha em `TROSKY_REGIONS` (o nome, a caixa ou o nome do mapa) e `/propriedade mapear`.
- **Não verificado no jogo:** nada deste mapeamento foi visto por um jogador: as portas e baús certos de cada casa, o nome de cada uma, os pontos onde o cidadão acorda.

### O alcance do E e do F

Pedido de 22/10/2026: *as distâncias das interações do E e F que fizemos personalizadas em tudo devem ter o mesmo padrão de distância, exemplo 1 m a 2 m*. Cada aviso nosso tinha o seu número (de 2,6 m a 5,5 m no cliente, de 3 m a 8 m no servidor), e a porta e a pessoa eram medidas **da câmera**, não do corpo: na terceira pessoa do mod (a câmera 3,5 m atrás) uma porta a dois metros ficava fora de alcance. Agora há **um alcance só**, em `src/client/reach.ts` e `src/server/reach.ts`:

- **O padrão é 2 m, do corpo até a borda da coisa** (o ponto da mira numa árvore, numa pedra, numa porta, num baú, numa pessoa, na água). Onde o jogo dá **um ponto só** para uma coisa grande, o ponto está a uma *margem* da borda, e o alcance até ele é o padrão mais a margem: pessoa 0, porta e baú 0,5, cadeira 0,4, cama 1, a mesa de dados 1, o fogo 0,6, o canteiro da horta 0,5 (medido até o ponto mais perto da fileira de terra: 2,5 m do corpo), a carroça 1 (medida até o eixo dela), o cavalo 1,1 (até o meio dele), o secador 1,2, a forja e a mesa de alquimia 1,5, o quadro de avisos 1,2 (o ponto fica no chão, meio metro diante das tábuas) e o defumador 2,5 (um casebre com o ponto dentro).
- **O servidor aceita 1 m a mais** (`SLACK_M`): o cliente decidiu com os olhos dele, e o aperto, a rede e um passo dado no meio não podem fazer um aviso que estava na tela responder *longe demais*.
- Onde ficou: **árvore e pedra 2 m** (era 3), **porta e baú 2 m** (era 2,8 da câmera; o servidor 3,5, era 3,2 e 3,5), **pessoa para conversar 2 m** (era 3; o servidor 3, era 4), **água para beber 2 m** (era 3,2, e o chão lido até 2,5 m adiante; o servidor 3, era 6), **cavalo 3,1 m até o meio dele** (era 4; o servidor 4,1, era 4,5), **fogo 2,6 m** (era 3,2), **secador 3,2** (era 4,5), **defumador 4,5** (era 5,5), **forja e mesa de alquimia 3,5** (era 4), **cadeira 2,4** (era 2,6) e **cama 3** (era 3,2), **carroça 3 m do eixo** (era 3,5; 4 para o aperto) e **mesa de dados 3** (como era). Os números dos servidores das mesas (`cookingSettings`, `craftSettings.forgeM`, `PLACE_REACH_M`) e dos assentos (`REACH_M`, `BED_REACH_M`) saem da mesma tabela.
- **Não mudaram**, porque não são um E nem um F nosso: os NPCs com o menu do jogo (vendedores, barbeiros, mestres, cocheiros), que usam a distância do próprio jogo, e o *Seguir* do jogo (20 m).
- *Ainda não testado no jogo:* que as margens (`EDGE_M`) servem para o tamanho de cada coisa: o fogo, a forja e o defumador são os mais prováveis de pedir ajuste. É o primeiro lugar para mexer se um aviso não aparecer a dois metros da coisa.

### Fechaduras: E abre, F tranca

Pedido de 19/10/2026: *o E é apenas abrir, o F destrancar ou trancar (caso tenha a chave ou seja o dono da propriedade); se não for nenhum dos 2, continue E abrir e F vira arrombar (se tiver gazua); assim fica bem mais simples ... o mesmo vale para baús*. Não há mais menu na porta nem no baú (`src/server/property-menu.ts`, `src/server/properties.ts`, `src/client/property-labels.ts`):

- **A tranca é a do jogo.** O que foi trancado de propósito (pelo **F**, pelo painel ou por `/propriedade trancar`) fica **trancado de verdade no mundo**; o resto fica como o nível deixa. A cada 5 segundos o servidor põe a tranca numa porta ou baú que o jogo informou tarde e fecha uma porta que ficou aberta estando trancada.
- **E** é o do jogo: abre e fecha o que está destrancado. Numa porta ou baú **trancado**, do lado da fechadura, o jogo só oferece o arrombamento dele; o servidor diz *Casa 03 está trancada.* (*... aperte F para destrancar.*, para quem pode), no máximo uma vez a cada 3 segundos.
- **F**: para quem **tem a chave**, é o **dono**, mora no **quarto** daquela porta ou baú, ou é **admin**, a mira numa porta ou baú da propriedade (até 2 m do corpo, o alcance padrão: veja [O alcance do E e do F](#o-alcance-do-e-e-do-f)) mostra **[F] Trancar** ou **[F] Destrancar**, de fora e de dentro. Numa casa de várias portas, o F mexe só naquela porta; num baú, só no baú. Quem não pode não vê nada no F. Quem trancou ouve *Casa 03: trancada.*, e o log guarda (`property-menu: Hans trancou Casa 03 com F`).
- **Arrombar** continua sendo o do jogo, **segurar E** (com gazua e a habilidade): o minijogo não pode ser começado por um script, então não dá para pô-lo no F. Quando alguém começa, o dono (se estiver no servidor) ouve *Alguém está tentando arrombar Casa 03.*; quando a varredura vê aberta no jogo uma tranca que o servidor pôs, ela foi arrombada: fica aberta, quem arrombou ouve *Você arrombou Casa 03.* e o dono *Alguém arrombou Casa 03!*.
- **Por dentro**, uma porta trancada abre com o **E**: o framework recusa a mão do jogador numa tranca que um script pôs, então o servidor puxa o ferrolho e abre a porta (*Você abriu Casa 03 por dentro.*); se quem abriu não tinha a chave, o dono é avisado (*Alguém abriu Casa 03 por dentro.*). Qual lado é dentro: as áreas do nível, onde elas cobrem a porta; senão, o que o jogo disse naquela porta antes (o lado da fechadura de cada aperto, guardado em `playerdata/door-sides.json`); senão, o próprio *Abrir* do jogo na tela, que numa porta trancada só aparece do lado de dentro.
- Numa porta que o **nível** trancou (casas de NPCs e cenário), o jogo abre por dentro sozinho e o servidor não mexe.

**O que saiu em 19/10/2026:** o menu da porta e do baú (Abrir, Destrancar, Trancar, a propriedade inteira, Arrombar, Abrir por dentro, Roubar), a **cópia do baú** (a tela do jogo abre o baú de verdade) e a **trava ao olhar** (`/propriedade olhar`), que existia só para o menu não brigar com o *Abrir* do jogo.

> **Ainda não testado no jogo:** a dica **[F] Trancar/Destrancar** aparecer junto do *Abrir* do jogo e o F trancar sem o jogo agarrar nada; o **E** por dentro puxar o ferrolho onde as áreas do nível não dizem o lado; os avisos de arrombamento.

### Castelos

O castelo de cada região com muralhas é **uma propriedade só**: `Castelo de Suchdol` e `Castelo de Raborsch`, com **todas as portas dentro das muralhas** (uma chave, uma tranca para todas) e **os baús de dentro sob ele** (`Castelo de Suchdol · Baú 7`), como uma casa tem os seus. O censo deixava a fortaleza de fora; em Raborsch tinha cadastrado as portas uma a uma, como `Fortaleza` e `Porta`, e as que ninguém tinha trancado, ganhado chave ou recebido foram juntadas ao castelo. Um baú que alguém já renomeou mantém o nome; um que tem dono ou chaves entregues fica como está. Roda sozinho 30 segundos e 2 minutos depois de cada início (só acrescenta o que é novo) e por `/propriedade castelo [região]`.

**Pschitoky tem castelo, e a estalagem, o haras e a Toca do Diabo são uma propriedade cada (2026-10-26).** Pschitoky ganhou as muralhas da sua fortaleza (`Castelo de Pschitoky`, 7 portas, 5 baús: os baús que o arrumador tinha posto sob a Casa 01 passam para o castelo). 
A **Estalagem de Pschitoky deixou de ser uma região**: é uma propriedade da região Pschitoky, com as portas do lugar e os baús sob ela (`Estalagem de Pschitoky · Baú 3`); a casa e os 10 baús que ela tinha como região foram juntados a essa propriedade. 
O **Haras de Malešov** (a casa, os dois celeiros e o estábulo ao sul de Malešov, perto da antiga `kmal_courtStudFarmArea`) é uma propriedade da região Malešov. A **Toca do Diabo** (o lugar que o mapa chama de Devil's Den: a estalagem Čertovka, celeiros e estábulo) é uma propriedade da região **Minas** (a antiga Grunta: veja abaixo), 770 m a noroeste da vila, e **não conta como povoado** para os baús do mundo.

**Minas, e onde fica cada região (26/10/2026: *no mapa se chama Minas em português, que fica acima de Stará Kutná; não sei me localizar pelas regiões que você mapeou e não aparecem com nome no mapa; poderia corrigir Minas e colocar alguma identificação, exemplo próximo a X local, até mesmo no dropdown da seção Chaves, e também usar o nosso padrão de ícones*).** A região que o censo chamava de **Grunta** (o `Grund` do nível) chama-se **Minas** no mapa do jogo em português (o próprio texto dele, `location_grunta`), e agora também aqui: as propriedades, as vendedoras dos banhos, a parada da carroça, a igreja, o quadro de avisos, as hortas e os bandidos usam o nome do mapa; o catálogo salvo é lido com o nome novo (o `id` interno `grunta` não mudou, nem as chaves, as hortas plantadas e as paradas) e a Toca do Diabo, que o dia anterior tinha posto numa região "Minas" à parte, passou a ser uma propriedade da Minas de verdade. Os nomes do mapa, em português, saem do próprio jogo (`tools/make-map-places.py` grava `src/server/map-places-data.ts`: 27 lugares do mapa com o contorno de cada um). No **dropdown de regiões** das *Chaves* e das *Propriedades*, cada região leva o desenho do que é (o **castelo** para quem tem muralhas, a **casa** para as outras), o nome e, embaixo, um **alfinete** com **onde fica pelo mapa do jogo**: *ao norte de Stará Kutná* para a Minas (a referência do pedido), *a leste de Miskowitz* para Pschitoky, e, quando o mapa a escreve de outro jeito, *no mapa: Lhota* (Stará Lhota) ou *no mapa: Maleshov* (Malešov). A propriedade que é um lugar próprio (o castelo, a estalagem, o haras, a Toca do Diabo) mostra, sob o nome, a mesma linha com a distância: *a noroeste das Minas (770 m)* para a Toca do Diabo, *no mapa: Estalagem dos Carroceiros de Pschitoky · a sudoeste de Pschitoky (340 m)*. (`src/server/place-hints.ts`; o servidor manda `regionHints` na página e `where` em cada propriedade.)
Cada um é como um castelo (`Região.compounds` em `properties.ts`): todas as portas dentro do lugar e todos os baús sob ele; o censo da região deixa o lugar para ele. Rodam sozinhos junto dos castelos, e por `/propriedade lugar [região]`. No primeiro início: **Suchdol com 33 portas e 62 baús; Raborsch com 12 portas e 5 baús**, juntando 7 portas soltas. Um castelo pode ser entregue a um jogador como qualquer casa.

### Quartos

Castelos e casas têm **quartos** (pedido de 18/10/2026: *assim eu posso dar quartos às pessoas ou famílias minhas*). Um quarto é uma parte da casa, **algumas portas e alguns baús**, que o dono dá a um jogador ou a vários (uma família, até 8) **sem dar a casa**.

- **Criar:** na seção **Propriedades** (ou **Chaves**, o admin), escolha a casa e aperte **Novo quarto**: dê um nome (*Aposentos do senhor*, *Quarto da torre*) e marque as portas e os baús que são dele. Uma porta ou um baú fica em um quarto só.
- **Dar:** escolha o jogador no alto da lista (**Para ...**) e aperte **Dar a ...** na linha do quarto. Ele é avisado e o quarto aparece nas Propriedades dele, com as portas e os baús para **trancar e destrancar**.
- **Quem mora no quarto** é, para as portas e os baús dele, como quem tem a chave: o **F** tranca e destranca, e mexer nos baús do quarto **não é roubo**. O resto da casa continua só do dono.
- **Esvaziar** tira todos os moradores; **Apagar** desfaz o quarto; o morador pode **Deixar o quarto**.
- Fica em `playerdata/rooms.json`. Código: `src/server/rooms.ts`, `src/server/status.ts`, `src/server/property-menu.ts`.

### Baús de outro jogador: o roubo e a marca de ladrão

Um baú que **tem dono** (um jogador) e está **destrancado** abre para qualquer um, pela tela do próprio jogo; trancado, só com a chave (o **F**) ou arrombado. O log do servidor guarda o que cada um tirou e pôs em cada baú com dono (linhas `baús: ...`).

**A marca de ladrão vem do arrombamento** (01/11/2026: *vamos remover as tags de ladrão e ela só se aplica se o jogador arrombar um baú ou portão a partir de agora*), e só do **terceiro** desde 02/11/2026 (*"esse título só deve ser dado depois do jogador arrombar 3 coisas"*): quem arromba as fechaduras de 3 coisas (portas, portões ou baús) de outros jogadores em 3 dias, sem ser o dono, sem ter a chave, sem morar no quarto e sem ser da família do dono, ganha a **marca de ladrão por 1 dia** (o título sobre a cabeça) no momento em que a terceira fechadura é vista aberta. Tirar coisas de um baú destrancado não marca mais ninguém (até então, mais de 3 baús em uma hora davam a marca). As marcas que existiam foram apagadas na atualização de 01/11/2026. O caso do **Malak**: ele não arrombou nada; quem arrombou o Baú 2 da Casa 01 foi o jogador de nome *Player* (às 18:31 UTC, 2 s depois de receber 1 item do Malak numa troca), e os dois ganharam a marca minutos depois por tirar dos baús da *Casa do Punho de Prata* (do Victor Von Silberhände), que estavam destrancados. Veja [`/ladrao`](#ladrao).

O motivo (18/10/2026): os baús 4 e 62 do Castelo de Suchdol, do Radovan, foram esvaziados pela tela do próprio jogo enquanto estavam destrancados. O que foi levado voltou para o Radovan (entregue na próxima entrada dele, por `playerdata/restitution.json`).

## Animais e ervas

Os animais vêm do gerenciador de populações do gamemode (`src/server/animals.ts`), que usa os pontos de nascimento autorados no próprio nível: **711 pontos**. Para o mundo ter bem mais caça e mais vida (pedido de 16/10/2026: *mais animais para caçar no mapa*), cada ponto guarda **duas vezes e meia** o bando que o nível pôs lá (`animalDensity`, no mínimo 1 e no máximo **10** por ponto; eram 1,5 vez e 6), e **lobos e cães selvagens, o dobro** (eram 1,5 vez). Os animais **selvagens** (lebre, javali, corça, cervo, lobo, cão selvagem) ganham ainda, em volta de cada ponto, **um bando menor num chão próprio** (60% do bando, até 120 m do ponto, escolhido uma vez numa área andável): enche o mato entre os pontos que o nível pôs. As vacas, os touros, as ovelhas e os porcos ficam nos pastos e **mantêm os números do nível** (1×: até 16/10/2026 também eram 2,5×, e mais de 60 bichos de fazenda na vila pesaram no FPS de Suchdol). Ao subir, o servidor loga as vagas por espécie; hoje: lebres 3014, javalis 802, porcos 195, corças e cervos 1647 + 1051 + 799 + 759, ovelhas 254 + 77, vacas e touros 247 + 43, **lobos 466** e **cães selvagens 316** (antes: 1000, 288, 121, 568 + 374 + 279 + 283, 153 + 48, 149 + 27, 205 e 141). No máximo **700 corpos** ao mesmo tempo (eram 384), só perto de jogadores (350 m), nascendo até 4 por segundo (eram 2) fora da vista (60 m), e quem morre volta uns **3 minutos** depois. Lobos e cães selvagens atacam quem chega a 18 metros. A carne dos animais caçados é entregue ao esfolar (`animalDropChance` em `src/server/npc-spawn.ts`). **`/animals status`** diz quantos há agora e **`/animals max <n>`** muda o máximo na hora (até o servidor reiniciar), se a máquina de alguém sentir o peso.

**Lobos e cães selvagens (24/10/2026).** *"Jogador reportou que spawn de cachorros selvagens: ele mata eles e depois de 1 m já dá spawn de novo."* Um bando morto (lobos e cães selvagens, `PREDATORS`) agora só volta depois de **20 a 30 minutos** (`predatorRespawnMs` e `predatorRespawnJitterMs`, em `src/server/animals.ts`); os outros animais mantêm o tempo de antes.

**Ervas.** O nível decide onde cada planta nasce, e um script não cria plantas novas. O que dá para mudar é o tempo de rebrota de uma planta colhida (`Gathering`): o padrão do framework (um quinto do tempo do jogo) dava de 40 a 120 minutos reais neste relógio; agora são **4,5 a 12 horas de jogo**, cerca de **15 a 40 minutos reais** (`src/server/flora.ts`). A regra fica na memória do servidor e é posta de novo a cada início; o `/herbs` ainda muda até o próximo.

**Galinhas não dá para ligar.** O framework não cria galinhas: elas são bandos do jogo (*flock*) que a lista de animais do `Npc.create` deixa de fora. Coelhos há: são as lebres. Vacas, ovelhas e porcos há, nos pastos. Fica para uma versão futura do mod.

**A lebre corre.** Os animais andavam de um ponto ao outro e a lebre, que parece parada, andava como a vaca (pedido de 16/10/2026). Agora a lebre **corre** (`speed: run`) e troca de ponto mais depressa (a cada 3 a 9 segundos, contra 5 a 15 dos outros, que andam). A consulta ao terreno por segundo subiu de 25 para 40 para acompanhar.

**Ovos nos ninhos e peixes nas armadilhas** (pedidos de 16/10/2026). Como galinhas não dá para ligar, os ovos vêm de onde o nível os guarda: os **ninhos de galinha** (`henCare_coop`, os galinheiros das vilas: 87 no servidor) e os poucos **ninhos de ave** (`Nest`) que o servidor conhece como baús; e os peixes vêm das **armadilhas de pesca** do nível (`fish_trap_cage`). Meio minuto depois de cada início, e a cada 40 minutos reais, `src/server/nests.ts` põe **1 a 3 ovos** em cada ninho e **2 a 4 peixes** (perca, truta ou lagostim, um tipo por vez) em cada armadilha (o que havia é trocado), desde que **ninguém esteja a menos de 25 m** e o baú não esteja aberto; se alguém está perto, fica para a próxima olhada (a cada minuto, que também acolhe um baú que o nível só informa mais tarde). O log diz `nests: 87 ninho(s) do nível ganham ovos a cada 40 min; M já cheios; por exemplo ...` e `traps: N armadilha(s) de pesca do nível ganham peixes ...`. Os cestos de ovos das casas são tarefa dos moradores do jogo, não baús: ficam de fora. **Penas** (01/11/2026: *no ninho e no galinheiro não achou penas*): desde 31/10 todo ninho deveria ter 2 a 4 **penas de galo** ao lado dos ovos, mas o servidor procurava o item com o nome em maiúsculas e minúsculas (`special_featherRooster`) e o jogo devolve os nomes todos em minúsculas: nenhum ninho recebia penas. Corrigido; a linha do log termina em `; com 2 a 4 de special_featherRooster em cada um` (ou `; sem special_featherRooster, que o jogo não conhece`).


**Quem passeia e quem fica parado (25/10/2026, desempenho).** O servidor roda tudo numa linha só, e a rodada dos animais, uma vez por segundo, era o maior gasto dos nossos scripts (cerca de 30 ms a cada segundo, com as ordens de caminhada, que o servidor traça na malha de navegação, e a conta de todos os 1000 pontos contra todos os jogadores). Agora um bando só passeia, foge ou ataca quando há um jogador a até **76 m do ponto-base dele** (a coleira de 45 m mais o maior alcance de uma caça ou de uma fuga, 26 m, mais uma folga): mais longe que isso nenhum animal vivo do bando pode ter o que fazer com ninguém, então o servidor nem pergunta ao jogo por ele. Os bandos longe de todos ficam parados onde estão e voltam a andar quando um jogador chega perto; a carga de cada jogador (quantos corpos o jogo dele roda) é contada pelo último lugar visto de cada corpo, e os pontos perto de um jogador são achados por quadrados de 200 m, sem medir todos. O que muda para quem joga: nada que se veja, porque nada se vê a mais de 76 m do bando; se um animal for morto fora do alcance, a morte vem pelo evento do jogo. O `perf-watch` (`src/server/perf-watch.ts`, uma linha por minuto no registro) mostra o que cada timer gastou e, na parte `por dentro:`, o tempo das ordens, da malha e dos nascimentos da rodada dos animais.

## Dia, noite e clima

**40 minutos de dia e 40 de noite.** O dia do jogo não é dividido ao meio (é claro das 06:00 às 21:00, 15 horas, e escuro das 21:00 às 06:00, 9 horas), então o relógio anda mais rápido de dia (22,5 segundos de jogo por segundo real) e mais devagar de noite (13,5), e cada metade dura 40 minutos reais. O dia completo leva 80 minutos. O servidor ajusta a escala sozinho a cada 5 segundos e guarda o dia e a hora em `playerdata/world.json`, então um reinício continua de onde parou. `/clima relogio parar` congela a hora; `seguir` volta ao ciclo.

**Clima que muda sozinho.** Cada clima dura de 20 a 45 minutos (os de chuva, de 8 a 20) e passa para o próximo em cerca de 4 minutos. A chuva é a exceção (20/10/2026: *"está chovendo muito"*): os três climas de chuva juntos são cerca de um décimo dos sorteios, e a chuva nunca é seguida de chuva. A chuva e o vento sobem e descem junto com a troca. Os céus são os do próprio jogo, os mesmos que os scripts do jogo usam (`BlendTimeOfDay` no `Scripts.pak`):

| Id (`/clima`) | Clima | Chance | Céus do jogo | Chuva | Vento |
| --- | --- | --- | --- | --- | --- |
| `limpo` | Céu limpo | 34% | `cloudless_sunny`, `_B` | nenhuma | fraco |
| `poucas-nuvens` | Poucas nuvens | 28% | `semicloudy_clear`, `_B` | nenhuma | fraco |
| `nublado` | Nublado | 23% | `cloudy_no_rain` (3), `summer_overcast` (3) | nenhuma | moderado |
| `pancadas` | Pancadas de chuva | 5% | `cloudy_frequent_showers`, `_B` | fraca a média | moderado |
| `garoa` | Neblina com garoa | 3% | `foggy_drizzly`, `_B` | fraca | quase nenhum |
| `tempestade` | Tempestade | 2% | `foggy_storm`, `_B` | forte (menos que antes) | forte (10 a 18 m/s) |
| `ventania` | Ventania | 4% | `foggy_storm_no_rain` | nenhuma | forte |

O mesmo clima não é sorteado duas vezes seguidas. O admin troca na hora com `/clima <id>`. O servidor aceita qualquer nome de céu sem conferir (um nome errado só gera erro no cliente), por isso só os nomes que o próprio jogo usa estão na lista. Código: `src/server/world-cycle.ts`.

## Bandidos

### A inteligência dos bandidos (01/11/2026)

Pedido: *"jogadores falaram que alguns NPCs ficam imortais, os bandidos no caso e os assaltantes que colocamos na estrada; vamos melhorar a IA deles, corrigir isso, criar sistema de inteligência neles e frases que eles falam ao lutar; vamos deixar os bandidos dando grito e sendo inteligentes nos combates, além de ter bandidos em cavalo também, e adicionar inteligência dos bandidos roubarem cavalos e lutarem neles ou até tentarem matar os cavalos dos jogadores; e em todos os acampamentos de bandidos vamos colocar um bandido chefe, esse que é bem equipado e um mestre na esgrima da arma que ele usar"*.

- **Os "imortais".** O golpe num bandido é julgado pelo jogo de quem o *simula* (o KCDC escolhe um jogador perto). No registro do dia, em 310 anotações de luta o bandido era simulado pelo jogo de **outro jogador, a 20 a 60 m**, enquanto o alvo lutava colado nele (o Vaelgor a 5 m de um bandido que o jogo do Aspen rodava a 47 m): os golpes de quem lutava não pegavam, o bandido "desviava de tudo". Até então só se trocava quem o simula com o simulador a mais de 60 m. Agora o bandido que luta com alguém passa a ser simulado pelo jogo **do próprio alvo** quando o simulador atual está mais longe dele (mais de 10 m e mais longe que o alvo em 6 m), com o alvo a até 30 m. Vale para os acampamentos, esconderijos, postos das estradas e para os salteadores das emboscadas. O log diz `preso ao jogo do alvo (o jogo de Fulano, a N m dele, o rodava)`.
- **Gritos e falas.** Cada situação tem as suas frases, ditas sobre a cabeça (`npc.say`) com a **voz do próprio jogo** tocada no lugar do bandido para quem está a até 45 m: os gritos de ataque dos soldados ao avistar e no alarme, o grito de quem é atingido, um grito de dor de quem recua, o gole da poção. Durante a luta, quem luta de perto provoca de tempos em tempos (*"É só isso que você sabe fazer?"*, *"Vou arrancar sua cabeça!"*...); há frases para o cerco, para o alvo quase caído, para o companheiro morto, para quem foge, para o jogador derrubado. Um bandido fala no máximo a cada 9 s (eram 20 s), e o acampamento não fala todo ao mesmo tempo (2,5 s entre falas que não respondem a nada). Código: `BARKS`, `SHOUTS` em `src/server/bandits.ts`; o som é tocado por `src/client/bandit-shouts.ts`.
- **Táticas.** Além do cerco (um de frente por vez desde 02/11, os outros em volta; eram dois, 30/10): o **arqueiro** que vê o alvo chegar a menos de 5 m recua alguns passos e volta a atirar; um bandido que luta procura, a cada 6 s, outro jogador a até 8 m com **30% de vida ou menos** e vai nele (*"Ele está sangrando! Acabem com ele!"*); um homem da linha de frente com **25% de vida ou menos**, sem poção, pode **recuar** uma vez na vida (metade deles), por 6 s, e volta para a luta.
- **O chefe.** Todo acampamento e esconderijo (os postos das estradas não) tem um **Chefe dos bandidos**, o primeiro do bando: **320 de vida**, golpe 35% mais pesado que o do bandido, **3 poções**, a alma de um dos melhores bandidos do jogo (nível de combate 1,0, o máximo do jogo; os dos acampamentos têm de 0,3 a 0,7), bem armado (bacinete com camal, almofre de malha, gambesão longo, cota de malha, a brigandina escura dos bandidos, braçais e botas) e com a arma de que é mestre, uma por acampamento (montante, maça de capitão, machado do carrasco ou martelo de guerra). Ele dá as ordens (*"Cerquem ele! Ninguém foge!"*). A armadura e a arma dele **ficam no corpo para o saque** desde 02/11/2026 (antes saíam do corpo quando ele caía, como as do veterano), com uma bolsa mais pesada (40 a 90 moedas). Quando o chefe cai, quem do bando está com 40% de vida ou menos **foge** (*"O chefe caiu! Fujam!"*) e os outros ficam **enfurecidos** por 1 minuto, com o golpe 25% mais pesado (*"Vinguem o chefe!"*).
- **Os cavalos.** Nenhum NPC do servidor monta: o KCDC só aceita jogador na sela (`Horse.rider`), então **bandido a cavalo não existe** nesta versão. Mas eles agem contra os cavalos: quem está na linha de frente, a até 3 m de um jogador montado, pode **empinar o cavalo e derrubá-lo** (uma chance em três a cada 2 s, no máximo a cada 20 s para o mesmo cavaleiro); o golpe de um bandido num cavaleiro **fere o cavalo** também (metade do golpe, pelo menos 4); e um bandido do acampamento que não está na linha de frente **rouba um cavalo sem cavaleiro** de um jogador que está a 20 m ou mais dele, a até 25 m do bandido e dentro da área do acampamento: corre até ele e o leva para o meio do acampamento (*"Que belo cavalo... agora é meu!"*), e o dono é avisado no chat. O roubo acaba se o ladrão é atingido ou morre, se o dono chega a 6 m do cavalo ou monta, ou em 2 minutos; o cavalo continua do jogador (o assobio o chama). Um cavalo levado não é levado de novo em 10 minutos.
- `/bandidos estado` mostra quem é **CHEFE**, quem está **recuando**, **roubando um cavalo** ou **enfurecido**.
- Não verificado no jogo: os sons (os nomes vêm de `Libs/GameAudio/voices.xml`), o empinar do cavalo, o roubo e a alma do chefe.

### Turnos, foco e a bolsa (02/11/2026)

Pedidos: *"o sistema de combate dos bandidos deve fazer eles serem reais: rodear e alternar no ataque, nunca entrando um dentro do outro para atacar"*; *"os groschens dos bandidos não dá para saquear; às vezes buga, um pega e outro jogador não consegue"*; *"eles devem focar os jogadores próximos, assim evitando de ficarem focados apenas em um jogador enquanto outros podem ficar matando eles"*.

- **Um de cada vez, em turnos.** Em todos os níveis de `/bandidos agressividade`, **um** bandido luta de perto com cada jogador (eram 1, 2 e 3), mais um para cada companheiro do jogador a até 12 m (no máximo dois a mais). Os outros esperam **em volta, a 5,5 m** (eram 9 m), em lugares afastados uns dos outros, e dão a volta no jogador para chegar ao seu lugar, sem passar por ele. Quem está lutando tem um **turno de 6 a 10 s**: acabado, recua para o cerco e o mais perto do cerco entra no lugar dele. Por 4 s depois de recuar, nem o jogador chegando perto nem um golpe o trazem de volta. Fora dos turnos, um homem do cerco luta quando o jogador chega a 2,5 m dele ou quando é atingido.
- **Foco nos jogadores próximos.** A cada segundo, um bandido atingido nos últimos 3 s por outro jogador a até 6 m dele vira-se para quem o atingiu; e, se há dois bandidos a mais num jogador do que noutro jogador a até 12 m, um deles vai para o outro. Um bandido troca de alvo no máximo a cada 5 s.
- **A bolsa.** Quando um bandido (de acampamento, esconderijo, posto ou emboscada de estrada) cai, as moedas dele vão **na hora**, em partes iguais, para os jogadores que bateram nele nos últimos 90 s e estão a até 60 m do corpo (quem deu o golpe final conta sempre). Cada um lê no chat *"Você pegou X moedas da bolsa do bandido, a sua parte entre N."*. Sem nenhum deles perto, a bolsa fica no corpo para o saque. O resto do saque (roupa, armas, armaduras, comida) continua no corpo. Na emboscada, a bolsa do chefe dos salteadores tem o que a vítima pagou. O log diz `bandits: a bolsa de ... foi para ...`.
- Código: `turnMs`, `yieldKeepMs`, `ringM`, `strikerMs`, `spreadM`, `shareWithinMs`, `shareM` em `banditSettings`, a função `sharePurse` em `src/server/bandits.ts` (usada também por `src/server/ambush.ts`).
- Não verificado no jogo: o revezamento e o cerco com jogadores de verdade.

### Arqueiros afastados, turnos longos e um cerco que se mexe (04/11/2026)

Pedido: *"os bandidos na hora de puxar flechas estão ficando um dentro do outro, não é correto; além disso, na hora da luta eles estão alternando muito e ficando estáticos: o que deixa de luta só volta para a posição de luta quando vira a vez dele"*

- **Arqueiros afastados.** O tiro de arco do jogo para a 18 m do alvo, onde o homem estiver, e dois atiradores do mesmo bando que vinham pelo mesmo caminho paravam um dentro do outro. Agora, um atirador (o arqueiro, ou um homem da linha que tomou o arco) **parado há 1,5 s a menos de 2,2 m de outro homem da luta dá 3,5 m para o lado** (de través à linha até o alvo, para o lado contrário ao do outro; para trás, se os dois lados estão tomados) e volta a atirar de lá. De dois atiradores, só o que vem depois na fila do bando se mexe; um atirador sempre abre espaço para quem luta de perto. No máximo a cada 4 s. O log diz `atirador afastado de ...`.
- **Turnos mais longos.** A vez de cada um na frente do jogador passou de **6 a 10 s para 15 a 25 s**: trocam bem menos.
- **Quem entra para se defender fica.** Quem o jogador encosta (a 2,5 m) ou quem leva um golpe **segura a posição por 6 s depois do último** contato, em vez de voltar para o cerco assim que o jogador dá um passo para trás ou o golpe fica velho. E **quem já deu a vez e leva um golpe depois disso vira e luta na hora** (antes, por 4 s, ignorava o golpe e parecia estátua); os golpes levados durante a própria vez não o prendem na frente quando a vez acaba.
- **O cerco se mexe.** Quem espera não fica mais parado como estátua: de **3,5 a 6 s** (o tempo de cada um), dá **um passo pequeno**, andando: um pouco para o lado (8 graus) e 1 m mais perto, volta, vai para o outro lado, volta, e se vira de novo para o jogador. Passos tão pequenos que dois vizinhos do cerco nunca se encontram; um passo que o jogo recusa é largado sem contar contra o lugar do homem no cerco.
- O jogo não tem um comando de "ficar em guarda" para NPC (só atacar, andar, parar, olhar, fugir): **quem espera não fica com a arma em posição de luta**; o que dá para fazer é trocar menos, manter na luta quem está nela e deixar o cerco andando em volta.
- Código: `shooterGapM`, `shooterStepM`, `shooterEveryMs`, `shooterStillMs`, `turnMs`, `commitMs`, `stalkMs`, `stalkDeg`, `stalkInM` em `banditSettings`; `spaceShooters`, `asideSpot`, `circle` e `assign` em `src/server/bandits.ts`.
- Não verificado no jogo: que o passo para o lado chega ao lugar e o arco volta a atirar, e o passo pequeno do cerco com jogadores de verdade.

Os acampamentos são os do próprio nível: `Npc.placements()` lista cada pessoa que o nível posiciona, com a camada do mapa, e as que a camada ou o nome dizem ser bandidos (`bandit`, o tcheco `lapka`, `zbojník`) são agrupadas por distância. Neste nível são **8 acampamentos, com 45 bandidos** (pedido de 16/10/2026: *bem mais bandidos*; eram 35): três em volta de Vrchlicko (Vrchlicko 1, 2 e 3, numerados de oeste para leste), dois na aldeia abandonada de Kuklicko (Kuklicko 1 e 2), e um em Mezholezsko, em Na Bylance e em Bohounovice. Cada acampamento tem de **5 a 8** bandidos (eram de 3 a 5), **um arqueiro para cada quatro**. Eles aparecem uns 25 segundos depois de o servidor subir. Código: `src/server/bandits.ts`.

**Esconderijos na mata.** Além dos acampamentos do nível, o servidor espalha até **14 esconderijos** seus (hoje **11**, com **53 bandidos**), de 4 a 6 bandidos cada um e um arqueiro, chamados `Esconderijo N`. Cada um fica num ponto de caça **selvagem** do nível (nunca num pasto), num chão que a malha de navegação diz ser andável, **a pelo menos 300 m de qualquer lugar onde o nível põe gente comum** (vilas, fazendas, moinhos, postos de guarda), a 450 m dos acampamentos do nível e a 650 m um do outro. O sorteio é sempre o mesmo, em cada início: os esconderijos não mudam de lugar. Usam as mesmas almas de bandido do nível, a mesma dureza e o mesmo saque pobre, e não têm baú. Se a malha de navegação demora para ficar pronta, eles esperam até 2 minutos (log: `bandits: N esconderijo(s) na mata ...`, e uma linha por esconderijo com onde fica).

**Mais acampamentos e postos nas estradas (24/10/2026).** *"Existe acampamento de inimigos sem bandidos"* e *"coloque alguns bandidos pelas estradas, já que o sistema de emboscada não funciona"*. O nível tem acampamentos de outros inimigos, com barracas e fogueiras e ninguém neles, porque as missões que os povoam não rodam aqui: os dos **caçadores furtivos** de Suchdol e de Vrchlicko, o dos **caçadores de tesouro** de Lorec e o **celeiro dos desertores** de Přítoky. Agora a camada ou o nome com `poach`, `pytlak`, `treasureHunter` ou `zbeh` também vira acampamento de bandidos (14 pessoas, 4 acampamentos: *Suchdol*, *Vrchlicko*, *Lorec* e *Přítoky*), com o mesmo modo difícil e os mesmos baús. E o servidor põe **postos de 3 ou 4 bandidos nas estradas**: os lugares de estrada do próprio nível (os cruzamentos, entroncamentos e estradas de floresta, de campo e de estalagem onde o jogo faz os encontros, e os pontos de saída das caravanas, **64** lugares em `data/road-posts.json`, feito por `tools/make-road-posts.py`) escolhidos de um jeito sempre igual: **10 postos** (o limite; com 170, 380 e 650 m só sobravam 5), a pelo menos 140 m de qualquer lugar com gente, 330 m de um acampamento e 550 m um do outro, em chão onde se anda (a malha de navegação). Chamam-se `Estrada 1`, `Estrada 2`... em `/bandidos`, com um arqueiro e um veterano em cada. O servidor diz no registro quantos pôs (*"e N posto(s) nas estradas"*) e, se o arquivo `data/road-posts.json` faltar, que não pôs nenhum.

**Modo mais difícil:**

- 180 de vida (o padrão de um NPC é 100);
- golpes 60% mais fortes nos jogadores (o servidor aumenta o dano no `playerHit`);
- enxergam o jogador a 28 m e perseguem até 60 m do acampamento;
- quando um bandido é atingido ou entra em luta, **o acampamento inteiro vem junto** por um minuto, e **o atingido recebe a ordem de lutar na hora** (não na olhada seguinte, um segundo depois; no máximo uma vez a cada 0,8 s por bandido): o susto que o próprio jogo dá a quem leva um golpe é trocado pela ordem de lutar (relato de 21/10/2026: *eles nasceram mas não lutaram, eu batia e eles corriam*). A ordem que o susto tirou (o bandido deixou de estar mandado lutar ou correr atrás do alvo) é dada de novo na olhada seguinte, no mais a cada 4 s;
- um arqueiro para cada quatro bandidos, atirando de longe;
- **veteranos** (21/10/2026: *armaduras melhores em alguns e deixar eles mais hard ainda*): **um em cada três** de um acampamento (nunca o arqueiro) é um **Bandido veterano**, com **260 de vida**, golpes **25% mais fortes** ainda e o equipamento de um soldado que a guerra deixou: capacete de chaleira ou de aço, almofre ou capuz de malha, jaquetão longo, cotoveleiras com rondelas, botas de andarilho e, metade das vezes, a cota de malha saxônica, tudo **gasto** (30% a 50% da condição);
- **o arco quando o jogador se afasta** (*se o jogador se afastar eles começam a disparar com besta*): todo bandido de lâmina leva também um **arco** e flechas e passa a atirar quando o alvo está a **mais de 12 m**, voltando à lâmina quando ele chega a **menos de 6 m** (o intervalo evita que troque a cada passo). O jogo deixa um NPC do servidor atirar de **arco**, não de **besta**. Se o jogo recusar o arco, ele luta com a lâmina e só tenta de novo depois de 30 s;
- **poção** (*e tomam poção também, assim evitar jogador ficar abusando*): abaixo de **40% da vida**, o bandido bebe e recupera **45%** da vida, com um grito (*Ainda não acabou!*); **uma** poção por bandido, **duas** por veterano, no máximo uma a cada 15 s. A poção não é um item: não sai no saque.

**O que não é saque:** a armadura do veterano e o arco e as flechas do bandido de lâmina **saem do corpo quando ele morre** (o servidor tira essas peças do inventário do corpo): quem rouba bandido continua achando só roupa simples, a arma de sempre, moedas e comida, e armadura e arco seguem sendo coisa dos ofícios.

**O alvo fixado prefere o NPC (25/10/2026).** *"Se tiver player e bandido, o fixar na luta foca os jogadores como prioridade; o correto deve ser os NPCs primeiro e só depois player."* O alvo fixado e o seletor de oponente do jogo escolhem entre tudo o que está na frente, jogadores incluídos, e o framework só dá um controle sobre isso: tirar o corpo de um jogador da mira de **um** cliente (`Player.setTargetable`). Então, enquanto há um inimigo NPC por perto (um bandido de acampamento, esconderijo ou posto, um salteador das estradas ou um animal que caça: lobo, cão selvagem) a menos de **28 m** de quem luta, o servidor diz a esse cliente (a cada segundo, só quando muda) quais jogadores estão em volta (até 80 m), e o cliente os tira da mira; continua assim até não haver nenhum a **40 m**, mais **4 segundos** (para um bandido que dá a volta numa árvore não fazer a mira piscar), e então os jogadores voltam. O golpe de ninguém é impedido: só muda o que a mira oferece. O duelo marcado entre dois jogadores segue igual, e o fim de um duelo não devolve o jogador à mira enquanto houver inimigo NPC por perto. Código: `src/server/lockon-priority.ts` e `src/client/combat.ts`; o log diz `combat: o alvo fixado prefere os NPCs inimigos...` ao subir. Ainda não visto no jogo.

**Saque básico, de propósito.** No KCDC o que um NPC veste e empunha é o saque do corpo, então os bandidos vestem e levam só coisa simples: túnica gasta ou de mendigo, calça simples, capuz ou gorro, às vezes um casaco de mendigo; um porrete, um machado de trabalho ou uma lâmina caseira (o arqueiro, um arco de aveleira e flechas rústicas); de 5 a 20 moedas e um pão, uma maçã ou uma cenoura. Assim roubar bandido não paga mais que trabalhar numa guilda.

**Os bandidos de estrada que desviavam de tudo (25/10/2026: *os bandidos de estrada desviam de todos os golpes e não morrem*).** O golpe num NPC é julgado pelo jogo de **quem roda** aquele NPC, e o servidor mantinha quem o rodava até ele estar a 160 m. Pelo log, metade dos golpes nos postos das estradas caía em bandidos rodados pelo jogo de **outro jogador**, a até 60 m dali: o golpe não pegava. Agora, quando alguém bate num bandido cujo jogo que o roda está a **mais de 20 m** dele, e quem bate está a **até 15 m**, o bandido passa a ser rodado pelo jogo de quem bate (`preso ao jogo de quem bate` no log); e a cada olhada um bandido cujo jogo está a **mais de 60 m** passa para um jogador **25 m mais perto** (`era rodado por X, a N m: preso ao jogo de Y`). Dois jogadores perto do mesmo bandido não o puxam de um para o outro. Cada golpe agora escreve a vida do bandido no log (`atingido (vida X/Y)`). **Ainda não testado no jogo.**

**Morrem e voltam.** O corpo fica 10 minutos para ser revistado e some quando não há ninguém a 50 m. Nos acampamentos e nos esconderijos o bandido volta 30 minutos depois de morrer; nos **postos das estradas** (`Estrada N`) cada bandido volta num tempo só dele, **entre 2 e 4 horas** depois de morrer (25/10/2026: *os bandidos de estrada, o respawn está muito rápido, devia ser umas 2h a 4h*). Em todos só volta quando não há jogador a 90 m do acampamento, e um reinício do servidor repõe todos de uma vez.

**Baús dos acampamentos.** Os baús, caixas, sacos e barris a até 35 m de cada acampamento (menos colmeias, corpos, os de missão ou de cena e os que são de uma propriedade) recebem de 3 a 6 tipos de coisas que as guildas usam: sucata, ferro, aço, material de fixação, guarda e pomo de espada (ferreiro); ervas, carvão e teia (alquimista); flechas e couros (caçador); carne crua (taberneiro); e, em 4 de cada 10 vezes, uma peça de roupa. São enchidos de novo a cada hora, quando não há jogador a 60 m e ninguém está com o baú aberto, e o que houver neles é trocado pelo novo: não servem de esconderijo para guardar coisas.

`/bandidos` mostra cada acampamento; `/bandidos ir <n>` leva o admin até ele; `/bandidos repor` traz os mortos de volta (sem herdar o "preso ao jogo" do anterior) e enche os baús na hora; `/bandidos estado` diz, para cada bandido a até 250 m, o que ele faz e quem o roda (e, para os mortos, quanto falta para voltarem). O log do servidor escreve `bandits: ... ataque ordenado` quando um bandido é mandado lutar, e `atingido: ataque reordenado` quando o golpe o fez. Se o jogo recusar alguma peça de roupa ou algum item de baú, o servidor deixa só aquele de fora e diz qual no log (`bandits: o jogo não vestiu: ...`, `bandits: os baús não aceitaram: ...`).

> **Atenção ao programar:** `Inventory.set` e `stash.setInventory` só aceitam o **GUID** do item. O nome é recusado (`invalidItem`, ou `invalidEquipment` numa peça vestida), e foi por isso que a primeira versão dos bandidos saiu sem roupa nova e com os baús vazios. `Inventory.add`, `stash.addItem` e as lojas (`Vendor.setStock`) aceitam o nome. `Inventory.classes()` lista os 3948 itens que se vestem ou empunham, com o GUID; para os outros, `resolveItems` (`src/server/bandits.ts`) põe o item num baú virtual e lê o GUID da linha.

## Fome

A fome é a do próprio jogo (o *nourishment*, que o jogo mantém e mostra, e que um script pode ler e mudar). O servidor dá o **ritmo**: a cada 15 segundos, em tempo real, cada jogador vivo e já em jogo perde a parte do estômago que o nível pede para o tempo que passou. Comer sobe a fome como sempre; o que acontece com o estômago vazio é do jogo. Quem está desconectado ou morto não perde nada.

| Nível | Um estômago cheio dura | Comando |
| --- | --- | --- |
| `desligada` | não perde | `/fome nivel desligada` |
| `leve` | 5 h | `/fome nivel leve` |
| **`media`** (padrão) | **3 h** | `/fome nivel media` |
| `forte` | 1 h 40 | `/fome nivel forte` |

Se o jogo já gasta a fome sozinho, o que ele gastou conta como parte do que o nível pede, em vez de somar: o ritmo é o do nível de qualquer jeito (se o do jogo for mais rápido que o nível, vale o do jogo, que não dá para frear). A barra **Fome** aparece na seção Personagem do painel, e `/fome` diz como você está. O nível fica em `playerdata/hunger.json`. Código: `src/server/hunger.ts`.

**A fome está ligada** (17/10/2026). Ela chegou a ficar pausada por um dia, enquanto o sistema de comida era revisto, e o padrão voltou a ser o ritmo do nível. `/fome pausa ligar|desligar` (admin) mantém a saciedade de todos em 100% enquanto a pausa estiver ligada, e a escolha fica salva em `playerdata/hunger.json`.

## Sede

O jogo não tem sede; o servidor tem, e a barra **Sede** aparece na seção Personagem do painel e na lista de Jogadores do admin (`src/server/thirst.ts`). A medida é de 0 a 100, começa em 100, cai com o relógio (**2 h 30 de jogo de pé**, metade disso dormindo) e é guardada por Steam ID em `playerdata/thirst.json`.

| Medida | O que acontece |
| --- | --- |
| abaixo de 30 | efeito **Sede** (ícone e nome no painel): o fôlego volta mais devagar (80%). Só passa quando a medida volta a 40 |
| abaixo de 10 | efeito **Desidratação**: o fôlego volta a 55%, o fôlego máximo cai a 85% e o passo fica 4% mais lento |
| 0 | o corpo falha: 2% da vida a cada 15 s, **nunca abaixo de 20%**: a sede sozinha não mata |

**O que mata a sede.** Uma bebida das tabelas do jogo (`tools/make-drinks.py`: 54 itens), ouvida no `playerConsumed`: **água +45**, leite +30, cerveja +18, vinho +12, hidromel e aguardentes +5; as **sopas** do taberneiro (itens nossos, veja [Ofícios das guildas](#ofícios-das-guildas)) tiram de 10 a 20 ao serem comidas. Ou **a água onde ela corre**: um rio, uma lagoa ou um riacho; o cliente reconhece a água pelo tipo de superfície que o rastro do jogo encontra no leito (`mat_mudwater` e `mat_rockwater` no rio, `mat_water`, `mat_slowwater`: o chão sob a água é o que o raio acha, não a água), e mirando nela, com o personagem de pé na margem, aparece **[F] Beber água** (o controle `attack_special`, o mesmo F do trancar; o E já é de tanta coisa). O corpo se abaixa e bebe com a animação do próprio jogo (a de beber de uma tina ou de uma nascente, a primeira que o banco de animações do corpo tiver: `WaterTubDrinking`, `CampDrinkWatertube`, `CampDrinkSpruit`, `HousekeeperDrinkWaterTub`, `WashFace`), de 3 a 8 s, e a sede sobe 40. Um gole de cada vez (6 s), só para quem tem sede, a até 6 m da água que apontou.

`/sede` fala da sua; `/sede <ligar|desligar>` e `/sede definir <n>` são do admin. Quem morre volta com 60%.

> **Ainda não testado no jogo:** se o raio acha mesmo o leito do rio com esses tipos de superfície (a hipótese vem dos materiais do jogo: `river_bottom.mtl` é `mat_mudwater`, `water_volume_river.mtl` é `mat_water`); se a animação de beber toca no corpo do jogador; e se os efeitos têm os modificadores que o `Buffs.register` aceita (se não aceitar, os efeitos entram só com nome e ícone: o log diz `thirst: o efeito ... tento sem eles`).

### Cozinhar, secar e defumar

O **cozinhar, o secar e o defumar do jogo** (a carne no espeto, na panela, no secador e no defumador do açougueiro) acontecem na máquina do jogador, e o multiplayer só leva ao servidor a alquimia, a ferraria, o reparo e o afiar: a carne crua ficava na bolsa e a pronta nunca chegava (relato de 16/10/2026, e o mesmo para secar e defumar). Não há aviso do jogo para ouvir, então o servidor faz o que o jogo faria, **por um macete** (ideia do dono do servidor): quando o jogador *tenta* fazer, o servidor tira o item cru da bolsa e entrega o pronto, como um `/give`. Funciona em um lugar que o próprio nível marca:

| Lugar | Quantos no nível | O que faz |
| --- | --- | --- |
| **Fogo** (lareira de casa, fogão de acampamento) | 45, mais as panelas de ensopado (`CookPot`) e as 13 fogueiras de beira de estrada | **cozinha** |
| **Secador de açougueiro** (`butcher_dryer`) | 12 | **seca** |
| **Defumador** (`butcher_smokeHouse`) | 5 | **defuma** |

**Cada lugar é de uma guilda** (17/10/2026): o **fogo** é dos **taberneiros**, o **secador** e o **defumador** dos **caçadores**; quem é de outra guilda recebe o aviso e nada é trocado (o cozinhar do próprio jogo, que roda na máquina dele, não chega ao servidor, então não rende nada). O mod só leva ao servidor a ferraria e a alquimia como ofícios de verdade; para o resto, é este jeito.

**O menu do fogo** (17/10/2026): ao chegar a uns 2,5 m de um fogo, de um secador ou de um defumador, o cliente põe a dica **Cozinhar** (ou **Secar**, **Defumar**), ao lado do aviso do próprio jogo, que não dá para esconder. **No fogo a tecla é o F, não o E** (pedido de 20/10/2026: *na fogueira tem E cozinhar e E comer da panela; o E comer da panela precisa virar F, se não tiver como inverte os dois*): o **E** do fogo é do jogo (comer da panela), e a tela de escolher comida que ele abre para cozinhar é fechada na hora, com o aviso *No fogo, cozinhar é com a tecla F; o E é do jogo (comer da panela).* no chat e na tela; no secador, no defumador, na forja e na costura continua o E. Apertar abre a lista de diálogo do jogo, conduzida pelo servidor: **Cozinhar** ou **Sair**; em **Cozinhar** vem a lista do que você leva e o lugar sabe fazer, uma escolha para cada comida e **Tudo o que der**. Quem não é da guilda do lugar recebe o aviso no chat e nenhum menu. Ainda não visto funcionando no jogo (a tela de cozinhar do próprio jogo pode abrir junto).

Há mais dois jeitos de pedir, a até 4 m do lugar e no mesmo andar (3 m de altura): **`/cozinhar`** faz tudo o que ele leva e o lugar sabe fazer; e o **Usar do inventário numa carne ou peixe cru** (31 deles, `MEATS` em `cooking-data.ts`: o cliente toma a ação do item, como nos livros, e pede ao servidor) faz só o monte em que ele apertou. Fruta, legume, ovo, queijo e cogumelo não têm o Usar tomado (senão não se comeriam do inventário): para eles vale o `/cozinhar`. O que cada comida vira vem das tabelas do jogo (`cooking-data.ts`, gerado por `tools/make-cooking.py`: **43** para cozinhar (`CookedItemId`), **27** para secar (`DriedItemId`), **22** para defumar (a linha de mesmo nome com `Smoked`)); onde ficam os lugares vem das camadas do nível (`stations-data.ts`, `tools/make-stations.py`). A troca é de um para um: o servidor tira o cru, entrega o pronto, e o que não couber volta como estava. O log diz `cooking: Fulano cozinhou|secou|defumou 3x ...`.

**Os outros ofícios.** O que o mod leva ao servidor, e que por isso deve funcionar sem macete, é a **alquimia** e a **ferraria** (`craftingStarted/Completed`), o **reparo** com kit, o **afiar** na pedra de amolar e o **uso** de comida e poções (ainda não testado no jogo se chegam à bolsa sem problema; `/crafttest` é o comando de teste). Se algum ofício falhar do mesmo jeito, o macete é o mesmo: tomar a ação do item (`src/client/item-uses.ts`, que o servidor alimenta com `sendItemUses`) e trocar os itens no servidor.

## Encontros entre jogadores

**Ninguém tem o nome em cima da cabeça.** O servidor esconde o nome que flutua sobre cada jogador (`setNametagVisible(false)`); os vendedores, que são NPCs, continuam com o deles. Ao olhar para outro jogador a até 3 metros aparece, um pouco abaixo da mira e no mesmo texto branco na fonte do jogo que as portas usam, **Desconhecido** (ou **Desconhecida**, pelo corpo escolhido no criador), e o jogo mostra a dica **[E] Conversar**, com a tecla de interação que o jogador tiver configurado.

**O menu de conversa** é a lista de diálogo do próprio jogo:

| Opção | O que faz |
| --- | --- |
| **Apresentar-se** | A outra pessoa passa a ver o seu nome (o apelido e, se houver, o sobrenome da família) no lugar de Desconhecido, e recebe um aviso. A opção some quando ela já sabe quem você é. Vale só para um lado: você passa a ver o nome dela quando ela se apresentar a você |
| **Jogar dados** | Só fica ativa quando os dois estão junto da mesma mesa de dados (fora disso aparece apagada). Manda um convite, que a outra pessoa responde na lista de diálogo dela (**Aceitar** ou **Recusar**). Aceito, os dois sentam e combinam a pontuação, como no `/dice` |
| **Negociar** | Manda um convite do mesmo jeito; aceito, a negociação abre nos dois |
| **Desafiar para um duelo** | Manda um convite com as regras escritas embaixo da pergunta; aceito, começa o [duelo](#duelo). Fica apagada enquanto um dos dois está em duelo |
| **Sair** | Fecha o menu |

Um convite sem resposta caduca em 30 segundos, e o mesmo convite só pode ser repetido para a mesma pessoa 15 segundos depois. `Esc` no convite é o mesmo que recusar. Quem chamou precisa estar a até 8 metros quando o outro aceita.

Junto de uma mesa de dados, a mira numa pessoa mostra **[E] Conversar** e esconde o **[E] Jogar dados** da mesa, para que um aperto não faça duas coisas; para usar a mesa do jeito antigo, mire a mesa. Quem já esperava na mesa e aceita um convite pelo menu sai da espera e senta para o jogo combinado.

**Quem joga dados é de quem joga** (pedido de 20/10/2026: *o som dos dados caindo na mesa está indo para todos os jogadores enquanto jogadores jogam dados, igual à fogueira*; *quando um jogador estiver jogando dados não deve ter como interagir com ele quem estiver por fora do jogo*). Enquanto dura uma partida: o **som** da mesa (o chacoalhar, o cair dos dados, a tigela, o ganhar e o perder: 17 gatilhos `event:/special/dice/...` que as animações do jogo tocam com volume cheio em toda máquina que mostra o corpo, como o do fogo) é **parado em todas as máquinas que não estão naquela mesa**, uns 16 vezes por segundo (`src/client/dice-quiet.ts`; o servidor diz quem joga no evento `dice.busy`); e **quem está de fora não interage com os dois**: não aparece **[E] Conversar** nem a dica de seguir neles, o `Conversar` e o convite do menu recusam (*Fulano está jogando dados.*), e o nome sobre a cabeça some. Quando a partida acaba, ou um dos dois sai, tudo volta.

> **Ainda não testado no jogo:** se o som some de verdade (parar o gatilho 16 vezes por segundo pode deixar escapar o primeiro estalo; se escapar, o remédio é encurtar `QUIET_EVERY_MS`).

**Jogar dados: a aposta e os seus dados.** Na conversa em que os dois combinam a pontuação (2000 de início, de 500 em 500), vem também a **aposta**, em moedas **de cada um**: de nada a 1000, em degraus de 5, 10, 20, 50, 100, 200, 500 e 1000 (**Apostar mais** e **Apostar menos**; só se sobe até o que quem sobe tem na bolsa). Mudar a pontuação ou a aposta **desfaz** o aceite de quem já tinha aceitado, e o jogo só começa quando os dois aceitam o mesmo.

- **A aposta sai da bolsa de cada um quando o jogo começa**, e fica anotada em `playerdata/dice-pot.json`. Quem vence leva as duas (a mensagem diz quanto). **Ninguém lançou um dado** (a mesa foi deixada em 0 a 0), ou o jogo **acabou sem vencedor**: cada um recebe a sua de volta. Desistir **depois do primeiro lance** perde a aposta, como o próprio jogo avisa (*Cuidado, você vai perder a aposta!*). Se o servidor reiniciar no meio de um jogo, a aposta e os dados voltam a quem estava jogando na próxima entrada (log: `dice: N jogo(s) de dados estava(m) aberto(s) quando o servidor parou`).
- **Os dados e as insígnias de cada um ficam guardados enquanto dura o jogo** e voltam no fim. Com dados no inventário, o jogo abre antes da partida a sua própria tela **"Escolha os dados e insígnias para jogar"**, que uma partida entre jogadores (dada pelo servidor, com insígnias e perícias dos dados desligadas) não usa e cujo botão de confirmar (**X**) não fazia nada: as três primeiras partidas de teste (2026-10-15) acabaram em 0 a 0, ninguém tendo conseguido lançar. A mesa joga com os dados comuns do jogo.
- **As teclas da mesa** (as padrão do jogo; quem as mudou nos controles tem as dele): **E** marca o dado, **F** pontua e joga o resto, **Q** pontua e passa a vez, **setas** (ou `W A S D`) escolhem o dado, **segure `Esc`** para desistir; no controle, A marca, X pontua, Y passa e B (segurar) sai. O servidor as diz no chat de cada um quando o jogo começa, e o próprio jogo mostra as dicas na tela.
- O log do servidor conta o que aconteceu na mesa: `dice: partida N: aposta de ... de cada; dados guardados durante o jogo: ...`, `a primeira vez é do assento ...`, `primeiro lance, do assento ... (faces)`, e no fim `diceMatchEnd: ... N lance(s)` e `dice: partida N acertada: ...`.

> **Ainda não testado no jogo:** se a tela de escolher dados deixa de aparecer quando o inventário não tem dados (é a hipótese, pelo texto do próprio jogo: *se você tiver algum dado no seu inventário, pode escolher usá-lo antes de começar a partida*), e se a mesa responde às teclas acima. Se uma partida ainda acabar em 0 a 0, o log do cliente (`KCDC.log`) e o do servidor dizem até onde ela foi.

**"Junto da mesma mesa"** é estar a até **3 metros** da mesa (o nível tem 73 mesas de dados, 75 contando as camadas de missão). Até 14/10/2026 isso dependia só dos avisos de entrar e sair da área da mesa; um aviso perdido deixava a opção apagada ao lado da mesa, e foi o que aconteceu num teste. Agora a distância é medida na hora, e quando o menu mostra a opção apagada com alguém perto de uma mesa, o log diz a quantos metros cada um estava (`encounters: dados indisponíveis no menu: ...`).

**Negociar.** O jogo não tem uma tela de troca entre jogadores (a tela de comércio é de loja, de NPC). A negociação usa as telas que ele já tem: a lista de diálogo, para ver as ofertas e aceitar, e a tela de baú, para pôr itens na oferta. Cada um vê:

- **Você oferece** e **<nome> oferece**, com os itens de cada lado (o dinheiro é um deles), e `(aceitou)` quando o outro já aceitou;
- **Mudar os meus itens**: abre a tela de baú do jogo, com o seu inventário de um lado e a sua oferta do outro. Arraste o que quer oferecer, **dinheiro incluído** (as moedas são um item do inventário e passam por essa tela do próprio jogo: a página não tem campo de dinheiro, pedido de 21/10/2026: *não precisa estar na tela personalizada, a tela do vanilla já tem como passar dinheiro*); ao fechar, a lista volta (0,7 segundo depois, e desenhada de novo logo em seguida: aberta enquanto o jogo ainda fechava a tela, ela vinha vazia e prendia o jogador; um `Esc` logo depois de ela voltar a mostra de novo, uma vez, avisando como sair);
- **Ver o que <nome> oferece**: os itens do outro lado, com os nomes em português do jogo e a qualidade;
- **Aceitar a troca**: a troca fecha quando os dois aceitam. Qualquer mudança numa das ofertas desfaz os dois aceites, e os dois são avisados;
- **Cancelar a troca**: cada um recebe de volta o que pôs. `Esc`, se afastar mais de 8 metros, 10 minutos sem mexer, sair do servidor ou morrer também cancelam.

**Uma troca não perde item.** Os itens oferecidos saem do inventário para um baú virtual e ficam anotados em `playerdata/escrow.json` enquanto a negociação está aberta. Se o servidor cair no meio, cada um recebe de volta o que tinha posto na próxima entrada. O que não cabe no inventário de quem recebe volta para quem ofereceu, e o que não cabe nem lá fica anotado e é entregue na próxima entrada. O dinheiro posto na oferta é um item como os outros: sai do bolso de quem o pôs, e volta para ele se a troca for cancelada. **O jogo só aceita de 1 a 10.000 unidades de um item por chamada de `Inventory.add`, e o dinheiro conta em décimos de moeda (10.000 unidades são 1.000 moedas)**: em 25/10/2026 Kael de Borova pôs 2.438 moedas na mesa, cancelou, e só 28 voltaram; as outras 2.410 ficaram anotadas como devidas e **toda tentativa de devolver também falhava**, pelo mesmo motivo. Tudo o que devolve uma pilha ao inventário (a troca, a devolução do que ela deve, o prêmio do pote dos dados, o que o baú de uma morte devolve, a restituição de um ladrão, `giveMoney`) agora passa por `src/server/inventory-add.ts`, que entrega em lotes de até 10.000 e, se um lote for recusado, tira os anteriores: **uma pilha nunca é entregue pela metade**. O que já estava devido (as 2.410 moedas de Kael) é pago na próxima vez que ele entrar.

**Quem conhece quem** fica em `playerdata/acquaintances.json`, por Steam ID, e vale para sempre, mesmo depois de um reinício. **Menos na morte (04/11/2026: *"sempre que um jogador morre todo mundo que se apresentou pra ele desapresenta"*):** quem morre volta a ser **Desconhecido** para todos e **não conhece mais ninguém**, nas duas direções (as apresentações dos outros entre si ficam), e lê *"A morte apagou as apresentações: você já não conhece ninguém e ninguém mais o conhece. Será preciso se apresentar de novo."* Sem apresentações, o título e a marca de ladrão dele deixam de aparecer para todos até se apresentarem de novo. A morte por **Executar** apaga o personagem inteiro, como sempre. Código: `forgetOnDeath` e `installAcquaintances` em `src/server/acquaintances.ts`. O placar dos dados também mostra o nome como cada um conhece o outro. O admin também vê Desconhecido. O chat de texto continua mostrando o apelido de quem escreve, porque é o jogo que põe o nome na linha.

**Nomes dos itens em português.** O servidor só conhece o nome de tabela de um item (`daggerCommon`), não o texto que o jogo mostra. `data/item-names.json` traz os 4.891 itens que se carregam, por GUID, com o nome em português do Brasil tirado dos arquivos do próprio jogo. O arquivo fica só no servidor, fora do pacote do cliente. Ele é gerado por `python tools/make-item-names.py "<pasta do KCD2>"`; rode de novo depois de uma atualização do jogo que traga itens novos.

Código: `src/server/encounters.ts` (menu e convites), `src/server/trade.ts` (negociação), `src/server/acquaintances.ts` (quem conhece quem), `src/server/item-names.ts` e `src/client/property-labels.ts` (o nome embaixo da mira e a dica `[E] Conversar`).

### Duelo

Pedido de 01/11/2026: *"vamos criar o sistema de duelo: ao apertar E em um jogador ele pode desafiar para um duelo; o duelo acaba quando um deles chega a 20% de vida; durante o duelo qualquer efeito de buff é desativado, veneno, poção e coisa do tipo, para o duelo ser justo; o duelo pode ser cancelado caso o jogador guarde a arma ou passe 45 s sem bater"*. Até então só havia a luta do jogo, que começa no primeiro golpe e não tem fim a não ser a morte, a paz (**U**) ou os 45 segundos sem golpes.

**Como começa.** **[E]** em outro jogador, **Desafiar para um duelo**. A outra pessoa recebe um convite com as regras escritas (*vai até um dos dois chegar a 20% da vida; poções e efeitos saem do corpo e não voltam; arma guardada ou 45 s sem golpes cancela*) e **Aceitar** ou **Recusar**, como na negociação. Os dois precisam estar de pé, com **mais de 80% da vida**, sem ferimentos e sem sangrar (senão a marca dos 20% estaria a um golpe de distância), e nenhum pode estar em outro duelo; quem não está em condições ouve por quê.

**Preparar (até 20 s).** Ao aceitar, os efeitos saem dos dois corpos e cada um precisa **sacar a arma** (ou erguer os punhos). Antes da contagem os golpes entre eles não ferem. Quando os dois estão prontos há meio segundo vem a contagem *3... 2... 1...* e **Lutem!**. Quem não sacar em 20 s desfaz o duelo.

**Valendo.** O golpe que levaria alguém abaixo de **20% da vida máxima** é cortado, para deixá-lo exatamente nos 20%; quem fez isso **venceu**. Ninguém morre de duelo: o golpe que fecha o duelo só tira até os 20%, os golpes que já estavam no ar são recolhidos e, por 3 segundos, os dois ainda se acertam sem se ferir. No fim os **ferimentos, o sangramento e o veneno** que o duelo fez são tratados (para ninguém sangrar até morrer com 20%), mas **a vida fica onde o duelo deixou**. Quem estiver a 40 m lê quem venceu, com os nomes que conhece.

**Sem efeitos.** Ao aceitar saem do corpo as poções, os venenos, a bebida e os efeitos que o próprio servidor põe (a **sede**). Durante o duelo, o que chegar de novo (uma flecha envenenada, um gole) é tirado na hora (até 6 vezes por efeito), **comida e poção são recusadas** e a sede deixa o corpo em paz até o fim, quando volta no primeiro olhar dela. Os efeitos que o jogador tinha **não voltam**. O que é do próprio jogo e não se desliga (as habilidades e os bônus do equipamento) fica; o log diz, no começo de cada duelo, quais efeitos ficaram.

**Cancela, sem vencedor:** a arma guardada por 2 segundos (trocar de arma não conta); **45 segundos sem golpe** entre os dois (aviso aos 35); alguém de fora que fere um dos dois, ou um dos dois ferindo alguém de fora (o golpe de fora vale como o jogo manda); os dois a mais de 80 metros ou em mundos diferentes; a paz do jogo (**U**, `/paz`); sair do jogo, cair ou ser levado a outro lugar; o servidor parar. Os ferimentos do duelo são tratados também nos cancelamentos de dentro do duelo, não nos de fora.

**O que não muda:** briga fora do duelo continua a do jogo, com a regra de RDM. Um duelo não é salvo: reiniciar o servidor acaba com todos. Código: `src/server/duel.ts` (as regras e o `playerHit`), `src/server/encounters.ts` (o menu e o convite), `src/server/combat.ts` (`endFightBetween`), `src/server/thirst.ts` (`suspended`); testes em `tests/duel.test.cjs`. **Não verificado no jogo:** o nome dos efeitos que o jogo põe e quais voltam sozinhos, se `fistsUp`/`guard` leem o punho baixo, e a vida lida pelo servidor logo após o golpe.

## Apoiador

A seção **Apoiador** do painel (para todos; fica na categoria **Configurações**, com Opções) agradece quem joga e explica como apoiar: o botão **Apoiar** abre o QR code do Pix, com o valor e o que conferir no banco antes de pagar (identificação **KINGDOMRPBRASIL**, recebedor **Mauro Alves Aguiar**, **Banco Santander**). No alto dessa tela há um aviso em vermelho (26/10/2026: *uma instrução bem destacada de informar por qual streamer ele veio no jogo*): **o jogador escreve, junto com o comprovante no Discord, o nome do streamer (ou do canal) por quem chegou ao jogo**, ou que chegou por conta própria; o servidor não guarda essa informação, ela vai pelo Discord com o comprovante. Depois de pagar, o jogador manda o comprovante no Discord, e um admin entrega os benefícios na seção **Jogadores**: escolhe o jogador e clica em **Dar benefícios**, que pede confirmação. O servidor não vê pagamento nenhum: a palavra do admin é a prova. **Se a entrega foi para a pessoa errada** (25/10/2026: *deve ter como retirar benefícios de um jogador, para o caso de ceder errado*), o mesmo detalhe tem o botão **Retirar benefícios**, que pede confirmação e, no servidor (`supporters.revoke`, só admin): tira do inventário os **trajes de nobre, a bombarda e as balas** que ele ainda tiver (um conjunto por entrega; o que ele já gastou ou vendeu não é pedido de volta), tira os **cavalos** que as entregas deram, tira o **cão** e apaga o **registro de apoiador** (`playerdata/supporters.json`); o jogador é avisado. Desde 25/10/2026 cada entrega anota a chave do cavalo (`horseKeys`, depois que o módulo dos cavalos o registra, uns segundos depois); um cavalo entregue **antes** disso não é reconhecido e fica com ele (a mensagem do admin diz isso): retire-o pelos Animais, se for o caso. O botão só aparece para quem é apoiador.

O QR code foi conferido: é um Pix estático, com chave aleatória, identificação `KINGDOMRPBRASIL` e **valor fixo de R$ 69,99**, e o código de verificação (CRC) confere (o QR foi trocado em 2026-10-15: o novo foi lido de novo, e a imagem refeita do painel lê exatamente o mesmo conteúdo). O nome e a cidade gravados dentro do código são só `N` e `C` (o banco do pagador mostra o recebedor pela chave). A imagem do painel (`ui/img/pix-qr.png`, 57×57, meio KB) é refeita módulo a módulo do original `img/qrcode-pix.png` por `tools/make-ui-images.py`; o valor e os nomes ao lado ficam em `PIX`, no começo do script de `ui-src/status.html`, e mudam junto com um QR novo.

**Os benefícios** (`src/server/supporters.ts`):

- **trajes de nobre** no inventário, do corpo que o jogador escolheu: para homem, gibão e meias do cortesão, botas, luvas e chapéu de nobre e capuz de brocado; para mulher, dois cotehardies de mulher da nobreza, sapatos femininos, véu com babados e acessório de cabeça decorado. São peças dos trajes de nobre do próprio jogo (`noble_*` e `f_noble_*`). Uma segunda entrega dá outro conjunto, e a confirmação avisa quando a pessoa já recebeu;
- **um cão**, o companheiro do próprio jogo. O cão vai embora quando o dono sai, então o servidor o traz de volta uns 6 segundos depois de cada entrada. `/cachorro` chama, dá nome e manda seguir ou esperar; a seção **Animais** do painel também.

Quem apoia é guardado por Steam ID em `playerdata/supporters.json` (desde quando, a última vez, quantas vezes, quem entregou e o nome do cão). A seção Apoiador mostra *Apoiador desde ...* para quem já apoia, e a lista de Jogadores marca cada apoiador.

## Salteadores nas estradas

De vez em quando, quem viaja entre os povoados é parado por uma gangue de **2 ou 3 salteadores** que querem a bolsa (`src/server/ambush.ts`). Eles vêm correndo de trás do jogador, de uns 30 m, e o líder faz a cobrança na lista de diálogo do próprio jogo:

| Opção | O que acontece |
| --- | --- |
| **Pagar N moedas** | Pedem 30% do que o jogador leva, em moedas inteiras, de 10 a 200. Pagou, eles levam e somem no mato. O dinheiro fica no bolso do líder: quem os alcançar e vencer recupera |
| **Dar tudo o que tenho** | Aparece quando o jogador tem menos do que eles pedem. Levam tudo e vão embora resmungando |
| **Não tenho nada** | Bolsa vazia: metade das vezes riem e deixam passar, metade das vezes atacam |
| **Não vou pagar nada** | Atacam |

`Esc` ou 25 segundos sem resposta valem como recusa. Lutando, eles batem como os bandidos dos acampamentos (180 de vida e golpes 60% mais fortes) e usam as mesmas roupas pobres; o que vestem e levam é o saque. Quem mais bater num salteador vira o alvo dele. Um jogador que se afasta mais de 80 m por 30 segundos despista a gangue. Os corpos ficam 10 minutos para serem revistados e somem quando não há ninguém a 50 m; os vivos que vão embora somem quando não há ninguém a 90 m.

**Quem pode ser parado:** quem já está no mundo há 15 minutos, está se movendo (anda pelo menos 40 m a cada 30 segundos), no mundo principal, fora de qualquer lugar com nome do mapa (o povoado e 120 m em volta), longe de casas (40 m) e dos acampamentos de bandidos (220 m), e não está conversando, negociando ou jogando dados. A cada 30 segundos o servidor sorteia um viajante: 8% de chance se ele está numa **estrada** (o chão sob os pés é `mat_road` ou `mat_gravel`, perguntado ao jogo do próprio jogador) e 2% fora dela. A mesma pessoa não é parada de novo em 30 minutos, as gangues começam com pelo menos 4 minutos entre uma e outra, e há no máximo 2 nas estradas ao mesmo tempo. `/emboscada` mostra o estado e o chão lido sob os jogadores, para ajustar; `/emboscada desliga` desliga tudo e `/emboscada agora [jogador]` manda uma gangue para testar.

> **Ainda não testado no jogo:** se o chão das estradas do KCD2 é mesmo `mat_road` (o `/emboscada` mostra o que o jogo responde) e como a gangue se sai correndo atrás de um jogador a cavalo.

## Morte e renascimento

O framework não tem renascimento: o corpo fica no chão depois de `playerDied` até alguém o levantar. Quem morre ouve **"Você caiu gravemente ferido. Em 10 segundos você é levado para a igreja de <lugar>."**, os bolsos caem onde ele morreu (`death-drop.ts`), e 10 segundos depois o servidor o levanta e, meio segundo depois, o leva para **a igreja mais perto de onde caiu** (`src/server/respawn.ts`). As igrejas são onde ficam as caixas de doação do DLC 2 no nível, e o jogador acorda no chão ao lado da caixa:

| Igreja | Onde |
| --- | --- |
| Suchdol | 748, 3246 |
| Wysoka | 440, 2497 |
| Raborsch | 1596, 3846 |
| Santa Bárbara, em Kuttenberg | 2781, 942 |
| Kuttenberg, no arrabalde | 3073, 977 |
| São Tiago, em Kuttenberg | 3047, 684 |
| Stará Kutná | 3059, 1442 |
| Minas (Grunta) | 3197, 2183 |

**A tela de morte** (31/10/2026: *ao morrer, a câmera roda em volta do corpo devagar, um texto, uma reza da Bíblia e embaixo um contador de 10 s até voltar à vida, tipo uma tela customizada de morte*). Os 10 segundos são o contador da tela: quando o corpo cai, o servidor manda ao cliente `death.begin` com um **versículo sorteado** (nove: Salmos 23, 130, 121, 51, 4 e 27, o Pai-Nosso, João 11:25 e Isaías 41:10, no idioma do jogador), a referência e o tempo (`src/server/death-verses.ts`, `respawn.ts`); o cliente (`src/client/death-screen.ts`, página `ui/death.html`) põe a câmera numa volta de 3,3 m em torno do corpo, a 1,9 m de altura, girando **9 graus por segundo** (se há parede no caminho, chega mais perto dela), cobre a tela com uma sombra e as duas faixas de cinema, mostra o versículo, de onde é, e o contador **00:10 → 00:00** ("Você volta a si em"), e guarda o HUD e o chat até o fim. Quando o servidor leva o jogador à igreja ou à cidade dele, manda `death.end`: a câmera volta aos olhos dele, o HUD e o chat voltam. Se um administrador levantar a pessoa antes, a tela acaba sozinha; se o aviso do fim nunca chegar, ela se desfaz depois do tempo mais 6 s. Não tem tecla nem botão. **Ainda não visto no jogo:** a câmera depende de `Camera.setShot` com o jogador morto (o servidor pode precisar de ajuste se o jogo não aceitar a tomada nessa hora).

**As portas das igrejas** (pergunta de 16/10/2026: *as portas das igrejas são desativadas?*). Não achei porta nenhuma de igreja que o servidor controle: nas camadas do nível não há porta com nome de igreja, e perto das caixas de doação só há portas de casas vizinhas (a primeira versão destrancava tudo a 25 m da caixa e abriu casas de Grunta; foi corrigido). Um pouco depois de cada início (30 s), `src/server/respawn.ts` destranca só a porta **trancada pelo nível cujo próprio nome diga que é de igreja** (`church`, `chapel`, `kostel`, `parish`, `sacral`...) a até 40 m de uma caixa; uma porta trancada por script (a de uma propriedade, segurada por um olhar ou um arrombamento) é deixada em paz. E o log lista, **para cada igreja, as portas que há ao redor e o estado de cada uma** (`respawn: igreja de Suchdol: 3 porta(s) a 40 m, 0 de igreja destrancada(s) (trancada AnimDoor[...]; ...)`), que é como se descobre qual é a porta da igreja se ela existir. As entradas das igrejas podem ser aberturas sem porta, ou parte do prédio, que o servidor não vê.


**Quem tem cidadania acorda na sua cidade** (Suchdol e Raborsch, na igreja; Malešov e Pschitoky, na praça): *"Você caiu gravemente ferido. Em 10 segundos você é levado para Suchdol, a sua cidade."* Quem não tem acorda na igreja mais próxima, como a tabela acima. Veja [Cidadania](#cidadania).

Se um admin levantar a pessoa antes (`revive`), ela não é levada. Quem sai do servidor morto não é levantado; o número de jogador pode passar para quem entra, e o Steam ID é conferido em cada passo.

## Cansaço

A **Energia** é a do próprio jogo (`exhaust`, "quanto maior, mais descansado"), a barra das seções Personagem e Jogadores. De pé, ela **cai devagar**: do descansado até 5% em **4 horas** de jogo (o que o próprio jogo gastar no meio conta como parte disso, sem somar). Descansando, ela **volta**: **deitado** (numa cama, num catre, no chão) volta toda em **12 minutos**; **sentado** (banco, cadeira, chão), em **30 minutos**. Como não dá para dormir a noite toda num servidor, é assim que se descansa (`src/server/fatigue.ts`).

Quem diz a postura é o cliente: o número da postura que a animação do jogo escolheu para o corpo (`LocalPlayer.stanceTag`) e se o jogo tem o corpo dormindo, mandados quando mudam e a cada 5 segundos (`src/client/posture.ts`). Contam como deitado as posturas 5, 6, 8 a 11, 15, 16, 28 e 29 (deitado, deitado no chão, de lado, no abrigo, na barraca, na cama), e como sentado 1, 3, 7, 17 e 34 a 38 (à mesa, no chão, sem mesa, na mesa, as variações), pela ordem do grupo de posturas do jogo. A energia é guardada com o resto do corpo entre as sessões. `/cansaco` diz a energia e a postura que o jogo vê.

> **Ainda não testado no jogo:** se os números de postura são os mesmos que o cliente lê numa cama e num banco (o `/cansaco` mostra o número para conferir).

### Cama e sono: o padrão do mod

**Dormir é o do mod** (17/10/2026). O KCDC 1.6.10 deixou o sono funcionando, e o gamemode **parou de bloquear**: o código que fechava a tela de pular o tempo (`skip-time.ts` do cliente) e o que limpava o relógio de sono e o ícone de carregando (`sleep-guard.ts` e `/destravar`) foi tirado. A energia continua voltando pela **postura** (deitado em 12 minutos, sentado em 30), como acima.

> **Ainda não testado no jogo:** o sono com o relógio andando junto, e como a fome de quem dorme se comporta (o ritmo do servidor devolve o que o sono do jogo tira a mais).

## Sujeira

A **sujeira** é a do próprio jogo: a roupa e a pele sujam com o movimento (mais depressa quanto mais rápido o corpo anda, pelos parâmetros `FullClothDirtyingOnFullSpeed` e companhia das tabelas do jogo) e só saem com água: um rio ou uma fonte, uma bacia, um tonel, as casas de banho (com sabão fica mais limpo). O número que o jogo guarda se chama `dirtiness` e é um dos valores **derivados** do corpo: o servidor pode **ler** (`getDerivedStat`), mas não há como escrevê-lo (`DerivedPlayerStat` é só de leitura, e `setStat` recusa), e o personagem guardado entre as sessões (`character-state.ts`) não tem lugar para ele: quem volta de uma sessão volta limpo. O jogo também a usa sozinho: os NPCs reparam em quem está sujo demais (acima de 0,9) e o cheiro é notado.

O que o gamemode faz (`src/server/dirt.ts`):

- **Deixa o jogo sujar.** O único efeito que impede a sujeira é o `quest_noDirt` (`cds=0,drt=0`, uma constante que dura "até ser tirada"), que as missões do jogo põem numa cena (uma festa, um diálogo) e tiram depois. O servidor o tira de qualquer corpo em que o encontre, assim que o jogo o diz (`playerBuffAdded`) e a cada 20 segundos, e escreve no log quando precisou (`dirt: ... tinha quest_noDirt, que não deixa o corpo sujar: pedi para tirar`).
- **Avisa quem fica sujo**, uma vez por degrau, nos limites do próprio jogo (0,30 um pouco de sujeira, 0,60 sujo, 0,90 imundo; `rpg_drt_low`, `_medium` e `_high`): *sujo* e *imundo* dizem onde se lavar. Depois de lavado (abaixo de 0,30), avisa de novo da próxima vez.
- **Conta no log** quando a sujeira começa a subir de verdade (`dirt: <jogador> começou a ficar sujo (0.04)`), que é como saber que o jogo a está contando.
- **`/sujeira`** diz a sujeira, o cheiro e o sangue, com a escala e onde se lavar; o admin vê a de outro (`/sujeira @jogador`).

> **Ainda não testado no jogo:** se o corpo de um jogador suja de verdade e quanto leva até o primeiro degrau (o log `começou a ficar sujo` diz que sim), e se o `quest_noDirt` aparece em alguém. O jogo faz a sujeira sozinho; se não sujar, **não há um interruptor** para ligar aqui, porque o servidor não escreve a sujeira nem muda os parâmetros do jogo: só `/sujeira` e o log dizem o que ele lê.

## Cidadania

> **A seção Cidadania saiu do F2 (09/11/2026).** Pedido do dono: *"a seção cidadania vai sumir do F2"*. Saíram o botão da barra, a página (a galeria das cidades e o detalhe de cada uma, com *Tornar-me cidadão*, *Ver cidadãos*, *Depor*, *Guerra* e *Entregar terras*), a aba **Cidadania** ao lado da guilda na página do personagem (agora ela mostra só a guilda) e os eventos da página para tudo isso. **O que continua:** o servidor inteiro da cidadania (quem é cidadão de onde, acordar na cidade, os senhores das terras, as guerras, `playerdata/citizenship.json`, `/cidadania`), a linha **Civitas** da página do personagem, a hierarquia e as nomeações, que leem as cidades. **Consequência:** sem a página, o jogador **não consegue mais escolher a cidadania sozinho**, o senhor das terras **não fecha nem abre a cidadania, não depõe cidadãos, não declara nem encerra guerra e não entrega terras** (esses quatro só existiam na página: **não têm comando**, nem para o administrador; só `/cidadania` define ou limpa a cidadania de alguém à mão), e as cidades de Trosky ficam sem quem as veja. Tudo o que está abaixo descreve a seção como era.

**No mapa de Trosky (09/11/2026) as cidades são outras:** Semine, Fortaleza de Nebakov, Acampamento nômade, Zhelejov, Troskowitz, Tachov, Castelo de Trosky e Apolônia (`TROSKY_TOWNS`, `citizenship.ts`), cada uma uma cidade só (sem terras, sem igreja: o cidadão que morre acorda numa praça que é a porta, ou o baú, mais perto do meio do lugar). **Nenhuma tem brasão**: a página desenha o brasão **da família do senhor** da cidade, se ele pôs um, e um escudo apagado se não. O que vem abaixo é o texto de Kuttenberg: A seção **Cidadania** do painel (tecla F2) mostra as cinco cidades do reino, cada uma com o seu brasão: **Suchdol**, **Raborsch**, **Malešov**, **Kuttenberg** e **Pschitoky**. Ao clicar numa cidade abre à direita o **senhor das terras** (o jogador a quem a região foi cedida), a **Lady das terras** (a esposa dele; ver abaixo), o **nome da família** dele e a **quantidade de cidadãos**.

- **Escolher** (botão *Tornar-me cidadão*, com confirmação): uma cidade só, e a escolha é **definitiva**.
- **Morrer**: o cidadão acorda na sua cidade; quem não tem cidadania acorda nas igrejas.
- **Kuttenberg** (pedido de 20/10/2026: *dentro de img temos os brasões de Kuttenberg, e já adicione a cidadania de Kuttenberg*): a quarta cidade, com os mesmos direitos das outras. O cidadão acorda na igreja de **São Tiago**, a mais perto do meio da cidade (Santa Bárbara fica na ponta oeste e a do arrabalde ao norte). O brasão **vai do servidor para a página** junto com ela (`data/ui-images.json`, feito por `tools/make-ui-images.py`), porque o pacote do cliente não tem mais espaço; enquanto ele não chega, a cidade aparece com um quadro vazio no lugar.
- **Pschitoky** (pedido de 25/10/2026: *adicione a cidadania de Pschitoky, o brasão está na pasta img*): a quinta cidade, com os mesmos direitos das outras (a região `Pschitoky` do catálogo de propriedades é a das terras dela). A vila não tem igreja, então o cidadão acorda na **praça**, ao lado do quadro de avisos que você pôs lá (2307, 1821,5), no chão andável mais perto. O brasão (`Brasão Pschitoky.png`) também vai do servidor para a página (`data/ui-images.json`, `town-pschitoky`, pela mesma ferramenta, 20 KB).
- **A Lady das terras** (pedido de 25/10/2026: *um lorde manda em uma terra; se ele tiver uma esposa ela vira Lady, então na árvore eles deviam estar juntos; e na cidadania deve aparecer o nome da Lady também*): a esposa viva do senhor das terras, tirada da árvore de família dele (ou de quem o põe como cônjuge na dela), aparece na página da cidade como **Lady das terras** com o nome do personagem dela, e na Hierarquia fica **no mesmo quadro** do marido (*& Lady Elisabeth*). O tratamento vem do título de sangue dele: a esposa de um **lorde** é *Lady*; de um **marquês**, *Marquesa*; de um **príncipe**, *Princesa*; de um **rei**, *Rainha*; de um cavaleiro, escudeiro ou pequeno nobre, *Dama*; de quem só tem um cargo (um burgomestre), ou de quem não tem título, só *esposa*; o marido de uma Lady em direito próprio é *esposo*. Um cônjuge marcado como falecido não aparece, e o companheiro de uma união não é cônjuge. Só o nome do personagem é dito, nunca o jogador (`src/server/consort.ts`, `consortStyle` em `src/server/nobility.ts`).
- **O senhor das terras** vê o botão *Ver cidadãos*: a lista de quem mora nas terras dele, oito por página, com o botão *Depor* em cada um. **É a única forma de um cidadão mudar de cidade**: depois de deposto, ele escolhe de novo. Os administradores também veem e depõem, e `/cidadania` define ou limpa à mão.
- **Guerra** (31/10/2026; 01/11/2026: *as opções devem ser dropdown entre regiões e não vários botões*): o senhor das terras (e o admin) tem o botão *Guerra* na cidade. Abre uma janela com **dois dropdowns**: *Declarar guerra a* (as terras que ainda não estão em guerra com ela, cada uma com o nome do senhor) e *Encerrar a guerra com* (as guerras de agora); escolhe-se uma em cada, ou só uma, e *Confirmar*. A janela avisa o que começa (todos os jogadores online são avisados) e o que termina. Uma guerra por vez; para marcar outra, abre-se de novo.
- **Quantos NPCs moram na cidade** (01/11/2026: *quando um NPC está desativado ele não deve contar no total na seção de cidadania*): o número do detalhe da cidade soma os vendedores de guilda, a barbeira... e **não conta** o vendedor que um administrador desativou na seção **NPCs** do F3 (volta a contar quando ele é ativado).
- Guardado por Steam ID em `playerdata/citizenship.json`.

> **Ainda não testado no jogo.** O ponto de renascimento de Malešov é a praça (560, 258): se não for bom, é só trocar a posição em `citizenship.ts`. Nem o brasão de Kuttenberg, que vem do servidor, nem o acordar em São Tiago foram vistos no jogo.

## Ofícios das guildas

Cada ofício tem os seus lugares, e só a guilda dele os usa (um administrador com guilda obedece a ela; `/oficios livre` libera tudo; `/guilda entrar` troca a guilda do admin na hora):

| Guilda | Usa | Habilidade que sobe |
| --- | --- | --- |
| **Taberneiro** (Tabernarii) | o **fogo** de cozinha: pães, tortas, ensopados, **sopas**, cerveja, assados | Sobrevivência (bebidas: Bebida) |
| **Caçador** (Venatores) | o **defumador** | Sobrevivência |
| **Alquimista** (Alchemistae) | o **secador** e as **mesas de alquimia** | Alquimia |
| **Ferreiro** (Fabri Ferrarii) | a **forja** | Ofício |
| **Artesão** (Artifices) | **costura**, de qualquer lugar: F2, Guildas, **Costurar** (roupas, botas, gibões; desde 22/10/2026 também as **joias**, anéis, colares e broches ([As joias do artesão](#as-joias-do-artesão)); desde 26/10/2026 os **cintos e bolsas** e os **casacos e túnicas com o brasão** das casas e cidades ([Cintos, bolsas e casacos de brasão](#cintos-bolsas-e-casacos-de-brasão-do-artesão)); e, desde 21/10/2026, o **kit de alfaiate**, que conserta roupas, nível 2, e o **kit de sapateiro**, que conserta sapatos e botas, nível 3, na categoria Kits de reparo) | Ofício |
| **Coletor** (Collectores) | o **machado nas árvores** e a **picareta nas pedras**, sem mesa nem página: o E mirando a árvore ou a pedra (veja [A coleta](#a-coleta)) | Sobrevivência (árvores) e Força (pedras) |
| **Agricultor** (Agricolae) | os **canteiros das hortas** das aldeias, com a página da horta à direita (veja [A horta e os cavalos selvagens](#a-horta-e-os-cavalos-selvagens)) | Sobrevivência |
| **Domador** (Domitores) | a **doma** dos cavalos selvagens dos campos abertos, que era dos Agricultores até 25/10/2026 (veja [A horta e os cavalos selvagens](#a-horta-e-os-cavalos-selvagens)) | Sobrevivência |

**A tela do próprio jogo não serve** (21/10/2026: *jogador caçador reportou que estava conseguindo defumar carne pelo inventário; acredito que outras guildas estavam conseguindo fazer coisas do tipo; isso não pode, o correto é só nas mesas de ofícios de cada guilda*). O defumador e o secador do jogo abrem uma tela de mercadorias que parece a bolsa, e o que se punha nela saía defumado ou seco na hora, sem receita nem nível; no fogo, a do jogo também cozinhava. Desde o KCDC 1.7.0 o servidor converte esse trabalho do jogo (`playerPreparing`), e até aqui deixava passar a guilda dona do lugar. Agora **recusa para todos** (`prepare-guard.ts`): os itens voltam como estavam, e quem é do ofício ouve *Isso se faz pela página de ofícios: no defumador, com a tecla E (Defumar)* (no secador, E; no fogo, F). A forja e a mesa de alquimia do jogo continuam: os livros do ferreiro ensinam a forja do próprio jogo, e a poção se prepara no minijogo da mesa.

**A forja e a pedra de afiar** (22/10/2026: *apertei E na forja e ao sair fiquei preso igual na pedra de afiar, que todo mundo consegue usar e era para ser só o ferreiro*). Duas coisas. **Preso:** o E do jogo na forja começava uma interação do próprio jogo, cuja tela nós mantínhamos fechada (a página é nossa), e a que ficou pela metade prendia o jogador ao sair do nosso menu; agora, enquanto o nosso **Forjar** está na tela, a ação `use` (e `trigger_use`) do jogo fica desligada (`Controls.disableAction`) e o E é lido por nós (`Key.bind`), e ao se afastar da forja o jogo volta a ter o E (`src/client/cook-hint.ts`). **A pedra de afiar foi do ferreiro por uma tarde e voltou a ser de todos** (22/10/2026, à noite: *existe um ângulo ali que ainda consigo interagir com a pedra de amolar e abre o menu vanilla; para facilitar nossa vida vamos deixar liberado para todo mundo mesmo*): a trava (a ação do jogo desligada mirando a pedra, o aviso `cook.grindstone`, a afiação desfeita no servidor e o campo `forja` do `crafts.rights`) **saiu**; o E na pedra é o do próprio jogo, de qualquer ângulo, para qualquer guilda. Mirando a pedra o nosso *Forjar* continua saindo do caminho (`NATIVE_ONLY`, `src/client/cook-hint.ts`). *Ainda não testado no jogo:* se o E da forja é mesmo a ação `use` ou `trigger_use` do jogo; se não for, o log do cliente não mostra erro e o jogo abre a tela dele como antes.

**O defumador e o secador prendiam como a forja** (23/10/2026: *a cabine de defumar está prendendo os jogadores igual ocorria com a forja*). Era o mesmo defeito: o E do jogo no defumador e no secador começa a preparação do próprio jogo (a animação e a tela de mercadorias), a tela é fechada por baixo da nossa página (`ItemTransfer`) e o que ficou pela metade prendia o jogador. Agora, enquanto o nosso **Defumar** ou **Secar** está na tela, a ação `use` (e `trigger_use`) do jogo fica desligada e o E é lido por nós, exatamente como na forja (`OWN_E_KINDS` em `src/client/cook-hint.ts`); ao se afastar o jogo volta a ter o E. E, mirando uma **porta** ou um **baú** ao lado (a porta da própria cabine), a nossa dica sai da frente e o E é do jogo, como já era numa cama. O fogo continua como estava (o nosso é o F; o E é do jogo: comer da panela). *Ainda não testado no jogo.*

**A carne do abate vem pela metade** (22/10/2026: *vamos diminuir a quantidade de carne que os animais estão dropando, está vindo carne demais*). O jogo abate na máquina do caçador e o servidor ouve o fim (`npcHarvested`), quando o estoque da carcaça está aberto: ali cada carne e cada víscera (as 28 do jogo: carne de veado, de javali, de lebre, de lobo, coração, lombo, rim...) é cortada para **metade, no mínimo uma de cada**, e o resto é tirado da carcaça (`src/server/carcass.ts`); o couro e o que não é carne ficam como estão. `/animals carne <0.1 a 1>` muda a parte até o servidor reiniciar (o fixo está em `carcassSettings.meatShare`). O log diz `abate: X abateu um animal: carne 12 -> 6`.

**O abate da caça é só dos caçadores** (21/10/2026: *mesmo eu não sendo caçador o F de abater apareceu e permitiu eu abater, não era para isso poder ocorrer*). O jogo abate na máquina do jogador e o servidor só fica sabendo depois, então até aqui a carcaça abatida por outro era esvaziada (a carne e o couro perdidos, com o aviso) mas a faca saía. Agora o servidor diz a cada cliente o que a guilda dele permite (`crafts.rights`, a cada entrada, a cada troca de guilda e no `/oficios livre`), e para quem não é caçador o cliente **desliga a ação de abater do próprio jogo** (`butcher`, a do F diante da carcaça, `Controls.disableAction`): o F não abate. A carcaça esvaziada continua valendo para um cliente que ainda não recebeu o aviso. *Ainda não testado no jogo:* se o aviso do F some junto ou só deixa de funcionar.

**A página de ofícios** (à direita, como a criação de personagem): no defumador, no secador e na forja o E, e no fogo o F (o E do fogo é do jogo: comer da panela), abre o menu **Cozinhar / Defumar / Secar / Forjar** e **Sair**; o primeiro abre a página. A tela do próprio jogo que o mesmo E abriria é fechada na hora (a de escolher comida do fogo, a de itens do defumador) e, na forja, a tela de receitas do jogo fica desligada enquanto o "Forjar" está na tela. Na página: a lista de **categorias** (uma lista suspensa, com quantas receitas cada uma tem), a busca, as receitas em páginas (PRONTO, FALTA ou NÍVEL n) e o detalhe com o que a receita pede e quanto você tem. **Fazer** toca a animação do lugar (a panela no fogo, a do defumador), gasta os ingredientes e dá o item e a experiência. As receitas (697: 627 tiradas das tabelas do jogo (com as 5 ferraduras), as 12 sopas, as 6 peças de malha da forja, as 4 que o ferreiro faz com o que os Coletores trazem (carvão de lenha, a barra de prata, a taça e o cálice) e, do artesão, os 2 kits de reparo e as 16 joias; e as 30 peças de arreio de cavalo do ferreiro; mais farinha, malte, lúpulo, linha e madeira de arco, itens nossos vendidos pelos vendedores) se **liberam sozinhas** conforme o nível da habilidade sobe. A forja também faz as **peças de malha** (21/10/2026: *adicione para o ferreiro cotas de malha*; o som de uma cota no jogo é `armor_chainmail`, que a seleção da forja nunca reconhecia, e nenhuma peça de malha tinha sido forjada): as quatro **cotas de malha** (italiana, nível 8; saxônica, 11; curta, 13; longa, 16, em ferro as duas primeiras e em aço as outras, a longa com cobre), a **gola de armadura** (nível 6) e o **almofre de malha** (nível 9), na categoria **Cotas e almofres** (as cotas, em **Peitorais e cotas**, com as couraças de placa); as luvas e manoplas (`armor_gauntlets`) ainda ficam de fora. A forja também faz **arcos** (15, do arco de nogueira do vilarejo ao arco longo de freixo; madeira de arco e linha, e a madeira exótica nos de nível 15 em diante), **flechas** (10 tipos, **5 por vez**: uma haste, uma pena e uma ponta de metal do nível delas) e o kit de atirador; os arcos e flechas de missão ficam de fora. Os **ícones** são os do próprio jogo, desenhados pelo jogo por baixo da página, num fundo da cor do papel; os **títulos** (COQUENDI, DEFUMADOR, SECADOR, FABRICARE, ALCHEMY, SUERE) vão do servidor junto com a página, fora do pacote do cliente. **A alquimia** mantém o minijogo do jogo: na mesa, o menu **Criar / Sair** abre a página, a poção escolhida entra no livro de receitas, e a mesa abre na próxima vez.

**As animações do próprio jogo (25/10/2026: *ao interagir com a forja, abre o nosso menu e usamos uma animação genérica; ao selecionar um item, passar para a animação de forja do vanilla*; o mesmo para alquimia, cozinhar, defumar e secar).** O **minijogo** da forja e o da mesa de alquimia não podem ser abertos por script numa receita escolhida na nossa página: o do jogo só roda pelo E dele, na estação dele, com as receitas dele, e duas vezes deixou jogador preso numa tela debaixo da nossa (forja em 22/10, mesa em 24/10). O que mudou foi o trabalho: em vez de uma animação qualquer, o jogador faz **o trabalho do artesão do próprio jogo**, em etapas, com as ferramentas na mão e **virado para a estação**, pelo tempo da receita (`src/server/craft-animation.ts`, com o lugar em `src/server/craft-spot.ts`):

| Estação | O que o jogador faz |
| --- | --- |
| Forja | pega a lâmina, **aquece na forja puxando o fole**, leva à bigorna e **martela**, e no fim **tempera** (as do ferreiro do jogo, `BlacksmithBehavior*`), com o **martelo** na mão direita e a **lâmina semiacabada** na esquerda; numa receita curta a parte de aquecer fica de fora |
| Fogo | **mexe a panela** sobre a fogueira com a concha (`Cooking`, `campfire`) ou, num caldeirão, **mexe o caldeirão** com a concha |
| Mesa de alquimia | **põe a base** na panela com o frasco e depois **as ervas**, uma atrás da outra; uma personagem mulher **mói no pilão** (`ApothecaryMortar`, que o jogo só tem para elas) |
| Defumador e secador | as animações do próprio jogo nesses lugares (`SmokehouseSniff`, `Drying`, este com as ervas na mão) |
| Costura | o alfaiate do jogo trabalhando o molde em pé (`TailorPattern`; a costura sentada precisa de uma cadeira) |

Os sons são os do trabalho (bigorna, fole, panela). As do ferreiro o jogo só tem para corpo de homem: uma ferreira continua com a de antes. O `/cozinhar` usa a do fogo. O log escreve uma vez a rotina de cada estação (`craft: rotina de forja (homem): ...`). **Ainda não testado no jogo:** se as ferramentas ficam na mão certa e se a pessoa fica na frente da bigorna (o corpo é virado para a estação, sem ser movido).

**O filtro das receitas tem ícones** (25/10/2026: *nas opções de filtro das receitas, alquimia, ferreiro e etc., vamos usar o padrão dos ícones que usamos*). A lista de categorias da página de trabalho (`ui-src/craft.html`) mostra, antes de cada nome e no botão, um **desenho de traço** no padrão do painel (24x24, a cor da tinta, dourado na escolhida): a grade para *Todas*, a panela, a caneca, o queijo, o prato, o pão e a tigela da cozinha; o peixe, a linguiça, o ovo, o cogumelo, a folha e a maçã do defumador e do secador; a adaga, a espada, o montante, o machado, a lança, a maça, o arco, a flecha, o escudo, o capacete, a luva de malha, a ferradura, a sela e o resto da forja; o anel, a bota, as calças, o chapéu, o colar, o gibão, a luva, a túnica e o carretel da costura; a cruz, o frasco, a caveira e a gota da alquimia; a cenoura, a folha, a maçã e o saco de especiarias da horta. Uma categoria sem desenho usa a etiqueta. *Kits de reparo* é a chave inglesa na forja e o carretel na costura. Os desenhos estão em `CAT_ICONS` e o nome de cada categoria em `CAT_KEY`.

**As ferramentas só nas partes sem troca de mãos** (25/10/2026, à noite: *na animação do ferreiro fica um martelo flutuando na hora de forjar*). O ferreiro e o cozinheiro do jogo pegam o martelo, a lâmina e a concha de um **encaixe** da estação (`hammerSlot`, `swordSlot`, `scoopSlot`) e os põem de volta nele, por eventos dentro dos próprios clipes (`pickup pickupHammer,hammerSlot,Right`, `place placeHammer,hammerSlot,Right,true`, `place placeSword,swordSlot,Left,true`, `place,scoopSlot,Right,true`; as variáveis do comportamento, `hammerItem` e `hammerSlot`, ficam vazias para um jogador). O objeto que o servidor põe na mão de quem toca o clipe era largado por esse `place` e ficava parado no ar. Agora o **martelo e a lâmina** só aparecem no **martelar** (`BlacksmithBehaviorForgingLoop`, que não tem esse evento) e a **concha** no **mexer** (`Cooking`); o aquecer, o entrar e o temperar são com as mãos vazias. Se o martelo ainda flutuar *durante* o martelar, o passo seguinte é dar ao objeto o osso `RightHandSlot` (a opção `joint` do `playAnimation`). **Não testado no jogo.**

**A tocha abaixa** (25/10/2026, à noite: *nas animações gerais, quando o jogador vai fazer e estiver com tochas em mãos, a tocha deve abaixar; se não, ela fica aparecendo nas animações, meio bugada*). Antes de qualquer animação que o servidor toca num **jogador** (o trabalho dos ofícios, a horta, as emoções, sentar e deitar, beber, a doma, `/anim`), uma tocha **empunhada** (a classe dela na mão direita ou na esquerda) é guardada: a linha dela no inventário perde o `equipped`, como o criador de personagem tira roupa para provar outra (`Inventory.set`, com as linhas e os atalhos como estavam; `src/server/torch-down.ts`, chamada logo antes de cada animação de um jogador: o trabalho dos ofícios em `craft-animation.ts`, a horta, as emoções, sentar e deitar, beber, a doma e `/anim`; um gancho único em `Player.playAnimation` não serve, porque os métodos de um jogador não ficam no `Player.prototype`). Desde 02/11/2026 a tocha **é só abaixada, não fica desequipada** (*"ao usar algo, a tocha desequipa; o correto era só abaixar"*): o servidor não tem como mandar guardar a tocha e mantê-la equipada, então ela sai da mão como antes e, quando o jogo avisa que a animação acabou (`playerAnimationEnd`, 0,7 s depois, para dar tempo de levantar de um banco), a linha dela volta a ser equipada como estava. Se a animação foi trocada por outra, ela espera essa acabar também; se o jogador já empunhou a tocha de novo, ou ela saiu da bolsa, nada é mexido; uma animação que nunca avisou o fim solta o registro em 30 min (aí a tocha fica desequipada, como antes). O aviso agora é *"Você baixou a tocha para fazer isso: ela volta ao lugar dela quando você terminar."* (uma vez por minuto). Tocha só equipada, sem estar na mão, e mãos vazias não mexem em nada (nem o inventário é lido). Falhas vão ao log (`tocha: ...`). **Não testado no jogo:** se, ao ser equipada de novo, a tocha volta para a mão ou fica guardada no lugar dela.

**A pedra de amolar que não consertava** (25/10/2026: *jogador falou que mesmo após ficar afiando a lâmina muito tempo ela não reparava*). O log mostra a causa de antes: na tarde de **22/10** a pedra foi só do ferreiro, e quem não era ferreiro tinha a afiação **desfeita** pelo servidor (`guild-crafts: Kael de Borova (venatores) barrado em sharpen`, três vezes naquela noite); na mesma noite ela voltou a ser de todos e isso saiu do código. Desde então nada nosso mexe na afiação: quem decide é o servidor do KCDC, que só aceita a afiação numa **pedra do próprio nível** (uma copiada no World Builder não serve), perto dela, e numa arma que o jogo afia, e **desfaz em silêncio** o que não aprova. Para saber, o log agora escreve cada afiação aceita (`sharpen: Fulano afiou Espada ...: 54% -> 71%`, `src/server/sharpen-log.ts`): se um jogador afiar e não aparecer nada, foi o servidor do KCDC que recusou.

### A mesa de alquimia, as armas de madeira, a gazua e as joelheiras (24/10/2026)

- **A mesa de alquimia prendia o jogador** (*"o bug que ocorreu na forja e no defumar ocorreu na mesa de alquimia: jogador abre e fica preso sem conseguir sair nem iniciar o processo de criação"*). Foi o mesmo erro: o **E do jogo** na mesa abria a alquimia dele, que o servidor recusa até a poção ser escolhida, e a tela que sobrava ficava por baixo da nossa página. Agora, nas mesas do nível e nas postas com o World Builder, o **Preparar** é nosso: enquanto o aviso está na tela o `use` do jogo fica desligado e o **E** é lido pela tecla (`OWN_E_KINDS` em `src/client/cook-hint.ts`), o menu de criação do jogo fica desligado, a página faz a poção (`BREW_SECONDS` na mesa, a animação de pôr a base e o ingrediente) e a lista de pontos que o servidor manda ao cliente inclui as mesas do nível (`src/server/cook-menu.ts`).
- **Armas de madeira no ferreiro:** seis receitas de **lenha**, categoria *Armas de madeira* (bastão, clava de treino, escudo de treino, espada, machado e montante de treinamento), do nível 1 ao 3 do ferreiro.
- **Gazua:** receita nova no ferreiro, **2 gazuas** por sucata, ferragem e carvão (`forja:gazua`, nível 3).
- **Joelheiras em forma de folha:** o jogo chama `Leaf-shaped couters` (cotoveleiras) uma peça que na verdade é de **perna** (`LegsPlate07`), e jogadores fabricaram a peça errada. O nome vem agora do texto do jogo corrigido em `tools/make-item-names.py` (`NAME_FIXES`): *Joelheiras em forma de folha*, categoria *Pernas*, no ferreiro, em `ITENS.md` e em `ARMADURAS.md`.

### Receitas mais difíceis e XP pelo nível (01/11/2026)

Pedido: *"nas receitas temos que dificultar um pouco a mais a cada nível e diminuir o XP por receitas fracas e fazer escala: quanto maior o nível do item mais XP ele dá; assim criamos um sistema recompensador e desafiador"*.

- **Mais material a cada nível:** cada ingrediente pede **2% a mais por nível** da receita, arredondado (nunca menos do que pedia): no nível 10 são 20% a mais, no 20 são 40% (a sela de dragão, nível 22, pede 9 peles de cervo em vez de 6). As **poções** ficam com as ervas do jogo, porque a mesa de alquimia do jogo usa a receita dele e as quatro qualidades já são a escada delas.
- **XP pelo nível:** cada receita vale o que valia (pela conta, pelo preço, pela recompensa do jogo) vezes a parte do nível dela: **metade no nível 0**, igual no 15 e **1,5 vez no 30**. Uma peça barata continua valendo menos que uma cara do mesmo nível. Na média, as do nível 0 a 2 caem de 14 para 8 XP na forja e de 9 para 5 na costura; as do nível 20 a 24 sobem de 49 para 61 e de 43 para 54 (antes da multiplicação de `/xpoficios`, hoje 4 vezes).
- **Receita fraca rende menos:** uma receita **mais de 3 níveis abaixo** do nível do jogador naquele ofício dá **12% menos de XP para cada nível a mais**, até um mínimo de 10% (5 níveis abaixo: 76%; 8 abaixo: 40%; 11 ou mais: 10%). A página mostra o XP que aquela receita dá **para quem está olhando**.
- **Revisão dos itens** (01/11/2026: *o almofre do ferreiro está bugando, se faz e vem outros*): o **almofre de malha** da forja era o `CoifMailSuk_m01`, uma peça de teste do jogo com o ícone de **cone de trânsito**, escolhida por ser a mais cara com esse nome; agora é o almofre de verdade (`CoifMail01_m03_C2`, nível 9). Saíram as peças de teste e de missão que tinham entrado nas receitas (o ícone de cone): os chapéus do pintor, do Capon e do abade, os vestidos da Katherine e da Rosa, o chapéu de palha do *Luffy*, a coroa perdida, o machado do açougueiro de Raborsch e a clava e o escudo do senhor de Semine; e a lança de treino que estava duas vezes (927 receitas). Sem essas peças na escada de preços, **47 receitas mudaram de nível**, quase todas um nível para cima ou para baixo; o **casaco de caça** desceu de 22 para 11 (subia por causa do casaco do Žižka, de missão, com o mesmo nome).
- Gerado por `tools/make-craft-recipes.py` (`BILL_GROWTH`, `XP_FIRST`, `XP_PER_LEVEL`, `real_icon`); o corte da receita fraca em `src/server/craft.ts` (`weakShare`, `xpFor`). Testes em `tests/craft.test.cjs`. **Não verificado no jogo.**

### O padrão do reino: XP dos ofícios, preços e baús (03/11/2026)

Pedido: *"vamos fazer um levantamento em todas profissões, na fome, na energia, na fome do cavalo, no drop de itens, na fabricação, e vamos padronizar tudo: xp ganho em profissões e etc; vamos refazer o balanceamento de up; a ideia é deixar tudo em um nível médio padronizado que faça sentido, igual valor de venda de couro do NPC e o valor de compra de outro NPC, para evitar jogadores quebrarem a economia; vamos ver dados de up de jogadores e de item"*. O levantamento completo, com os números dos jogadores, está em `BALANCEAMENTO.md` (na pasta `kcd_2_server`).

**O XP dos ofícios** (`src/server/profession-xp.ts`). Um nível custa por volta de **28 vezes o próprio número** de XP (cerca de 200 para o 7, 420 para o 15, 670 para o 24: medido nos logs) e subir do 5 ao 30 custa uns **13 mil XP**. Nos logs de 28/10 a 02/11, uma hora de trabalho firme dava uns 700 XP na **horta** (o ritmo que já tinha sido acertado em 27/10, *"principalmente agricultor"*), mas 2.500 a 2.800 na **forja**, na **alquimia** e na **lenha**: um ferreiro foi do nível 7 ao 24 em sete horas e houve dia de **36 mil XP** de ofício. O padrão agora é **o mesmo XP por hora em todo ofício**, o da horta:
- **Quanto cada ofício paga**, em vezes o XP das tabelas: **forja, alquimia, lenha, mineração e beneficiar a colheita 1x**; **fogo (cozinha), defumador e secador 2x**; **horta, ordenha e tosquia 4x** (como antes); **costura 5x** (a costura rendia menos que a horta). Antes era tudo 4x.
- **O começo da cadeia rende 1/4:** carvão, fundição (material de fixação, ferro, aço, aço de Frankfurt e de Toledo), barra de prata, linha e água fervida dão **um quarto** do XP da receita (`CONVERSION_SHARE` em `src/server/craft.ts`): eram o caminho das fazendas de XP (5.007 carvões e 1.906 aços em cinco dias). O que se faz com eles paga cheio.
- **Limite do dia:** os primeiros **2.500 XP de cada habilidade por dia** (sobrevivência, ofício manual, alquimia, bebida, força) rendem inteiros; depois, cada obra rende **25%**, até a **meia-noite de Brasília**. Ao passar do limite o jogador é avisado no chat (*"Você já fez hoje o XP cheio de ofício manual (forja e costura) (2.500). Até a meia-noite, cada obra rende 25% do XP: o ritmo dos ofícios é o mesmo para todos."*) e o log diz `ofícios: Fulano passou hoje de 2500 XP de craftsmanship`. A página de ofícios mostra o XP que a peça dá **naquele momento** (já com o limite). O XP do próprio jogo (luta, montaria, livros) não conta. O que cada um fez no dia fica em `playerdata/profession-day.json`.
- **Na prática** (os mesmos logs, refeitos com o padrão): um dia forte de forja ia de 7.452 a **1.051** XP, de alquimia de 7.088 a **1.772**, de lenha de 6.752 a **1.688**; a horta fica em ~2.100 e a costura em ~1.100; o maior dia (36.565) seria **4.026**. Quem joga firme sobe de **2 a 5 níveis por dia** em vez de 20; do 5 ao 30 leva pelo menos uns 6 dias de trabalho cheio. Quem já subiu fica com o nível.
- **`/xpoficios`** (admin): sem nada mostra o padrão de cada ofício e o limite; **`/xpoficios <0,25 a 5>`** multiplica todos os ofícios (1 é o padrão; o arquivo antigo, que guardava 4, vale como 1); **`/xpoficios limite <0 a 50000>`** muda o limite do dia (0 tira); **`/xpoficios hoje <jogador>`** diz o XP de ofício que ele já fez hoje, por habilidade. Fica em `playerdata/profession-xp.json`.

**Os preços dos comerciantes**: um preço só para cada coisa em todo o reino, um comprador só, e o que os ofícios fazem vale o que entra nele (veja **Os preços** em `NPCS.md`). Nenhum comerciante paga por uma coisa o que outro pede por ela, e nenhuma receita dá lucro comprando o material do comerciante e vendendo a peça de volta (testes em `tests/pricebook.test.cjs`, com o valor real de cada item do jogo em `tests/fixtures/game-worth.json`).

**Os baús do mundo** (`src/server/treasure.ts`): as moedas eram 5 a 30 perto das vilas, 10 a 120 mais longe e **15 a 270** longe; agora **2 a 8**, **4 a 16** e **6 a 24** (o que um bandido carrega perto das vilas, metade do que um chefe carrega longe). O resto do que os baús dão não mudou.

**O que ficou como estava, depois de medir:** a fome (nível leve: **5 h** de barriga cheia), a sede (**2,5 h**), a energia (**4 h** acordado, 12 min deitado para encher) e a fome do cavalo (**6 h**; saiu em 09/11/2026, com o menu do cavalo) já seguem uma ordem que faz sentido, de sede mais rápida a cavalo mais lento; as colheitas, a lenha e os achados da pedra (a prata 1 a 3%) e o saque dos bandidos (2 a 8 moedas; chefe 40 a 90) também. A bolsa de **300 moedas por ofício e por jogador** (pedido de 31/10) ficou; com um comprador só para cada coisa, a mesma mercadoria não enche mais várias bolsas.

**Não verificado no jogo:** a mensagem do limite e o número da página na hora em que passa do limite; as listas de compra novas na tela do jogo (o log diz quantos tipos cada uma tem).

### As poções em quatro qualidades (01/11/2026)

Pedido: *"vamos add as poções melhores nas receitas por nível de alquimista"*. O jogo faz cada poção em quatro qualidades, cada uma um item (**Fraca**, a comum, **Forte** e **do Henry**; o preço sobe de 350 a 700) e a página só tinha a Fraca. Agora cada qualidade tem a sua receita, com os **mesmos ingredientes do jogo** (lá só as mãos mudam), e cada uma abre mais acima na escada do alquimista: a Fraca fica no nível e no id de sempre e as outras três se espalham dali até o **nível 30**, de modo que a melhor de toda poção abre no 30 e, quanto mais cara a poção, mais juntas ficam as qualidades (uma que abria no 0 passa a ter 10, 20 e 30; uma do 19, as de 23, 26 e 30). O valor sobe 30% por qualidade, e com a escala do nível (abaixo) o XP fica 11, 21, 35 e 51. Vinte e cinco poções, venenos e óleos ganharam as três (75 receitas, 114 no alquimista); seis têm uma qualidade só no jogo (a aguardente, a Água do Lete, o tônico para febre, a bola de chumbo, o tiro fragmentado e o sabão) e ficam com a receita única. Os ids: `alquimia:<n>` é a Fraca e `alquimia:<n>:2`, `:3` e `:4` as outras. Gerado por `tools/make-craft-recipes.py` (`tier_level`, `ALCHEMY_TOP`); testes em `tests/alchemytiers.test.cjs`. Não verificado no jogo.

### As joias do artesão

Pedido de 22/10/2026: *depois de fazer isso tudo vamos adicionar receitas de anéis e colares para o artesão*. Na **costura** (F2, Guildas, **Costurar**), duas categorias novas, **Anéis** e **Colares e broches**: **16 joias**, todas as que o jogo tem de anel, colar e broche que não são de missão nem pedem o que o jogo não vende. A matéria é a prata que os Coletores trazem (a **barra**, que o ferreiro funde do minério), o cobre, o jaspe e o pó de esmalte do vendedor ferreiro (10 de cada por dia), a linha e o linho do alfaiate e o material de fixação. O nível vai do preço da peça: do broche de latão (2) ao anel de pedra preciosa (19), cada uma com um pouco mais do que vale o que entra; o tempo é de 11 a 19 s e a habilidade é a de Ofício, como a do resto da costura.

| Peça | Nível | O que leva |
| --- | --- | --- |
| Broche de latão com letras | 2 | 1 cobre, 1 material de fixação |
| Cruz de estanho | 4 | 2 cobre, 1 linha |
| Broche de prata | 5 | 1 barra de prata, 1 material de fixação |
| Contas de jaspe | 7 | 2 jaspe, 1 linha |
| Escapulário de santo | 8 | 1 linho, 2 linha, 1 cobre |
| Escapulário com abertura | 11 | 1 linho, 2 linha, 1 cobre, 1 jaspe |
| Anel de prata gravado | 12 | 2 barras de prata, 1 material de fixação |
| Broche feminino | 13 | 2 cobre, 1 jaspe, 1 linha |
| Anel de prata com pedra preciosa | 14 | 2 barras de prata, 1 jaspe |
| Colar de pedras preciosas | 14 | 3 jaspe, 1 barra de prata, 1 linha |
| Escapulário com insígnia | 15 | 1 linho, 2 linha, 1 barra de prata, 1 pó de esmalte |
| Broche de prata esmaltado | 16 | 2 barras de prata, 1 pó de esmalte |
| Cruz de prata com insígnia | 17 | 2 barras de prata, 1 pó de esmalte, 1 linha |
| Cruz prateada com granate | 17 | 2 barras de prata, 1 jaspe, 1 linha |
| Anel de pedras preciosas | 18 | 3 barras de prata, 2 jaspe |
| Anel de pedra preciosa | 19 | 3 barras de prata, 2 jaspe, 1 material de fixação |

**Fora, por falta de matéria:** as joias de ouro, as de granate e as de pérolas do jogo (o jogo não vende ouro, granate nem pérola; as que levam granate aqui levam jaspe no lugar). O vendedor ferreiro continua comprando as peças de prata (a taça, o cálice, os anéis e o broche), e a forja continua com a **barra**, a **taça** e o **cálice**. As receitas saem de `tools/make-craft-recipes.py` (`JEWELS`). *Ainda não testado no jogo:* que o jogo aceita as 16 peças na bolsa e as veste (anéis e colares são equipamento; as contas e o colar de pedras são itens de saque, que se guardam e se vendem).

### Cintos, bolsas e casacos de brasão do artesão

Pedidos de 26/10/2026: *vamos add cintos e bolsas para o artesão poder fazer* e *nas criações dos artesões vamos adicionar para ele poder criar os casacos com brasões de casas*. Na **costura** (F2, Guildas, **Costurar**), 49 receitas em 14 categorias novas (nove das de brasão já existiam por engano: veja *O que mudou*), de `tools/make-craft-recipes.py` (`BELTS`, `HOUSE_COATS`).

**Cintos e bolsas** (categorias **Cintos** e **Bolsas**). Os 3 cintos e as 4 bolsilhas do jogo, que são o que dá ao jogador os seus **espaços de acesso rápido**: 2, 3 e 4 nos cintos de caçador, de cavaleiro e de nobre, e de 1 a 4 nas bolsilhas de andarilho, de caçador, de cavaleiro e de nobre. Couro nos mesmos degraus das roupas (vaca, porco, cervo), linha, o material de fixação do ferreiro para fivelas e fechos, e, nas duas peças de nobre, uma **barra de prata** dos Coletores. O nível vai do preço da peça, do cinto de caçador (6) à bolsilha de nobre (20). No jogo as bolsilhas se chamam `Pouch_test_*` (nome de teste: o texto, o ícone e os espaços são de peça acabada).

| Peça | Nível | O que leva |
| --- | --- | --- |
| Cinto de caçador (2 espaços) | 6 | 2 pele de vaca, 2 linha, 1 material de fixação |
| Bolsilha de andarilho (1) | 8 | 1 pele de vaca, 2 linha |
| Bolsilha de caçador (2) | 11 | 1 pele de porco, 2 linha, 1 material de fixação |
| Cinto de cavaleiro (3) | 14 | 2 pele de porco, 3 linha, 2 material de fixação |
| Bolsilha de cavaleiro (3) | 16 | 1 pele de cervo, 1 linho, 3 linha, 1 material de fixação |
| Cinto de nobre (4) | 19 | 2 pele de cervo, 3 linha, 2 material de fixação, 1 barra de prata |
| Bolsilha de nobre (4) | 20 | 2 pele de cervo, 1 linho, 3 linha, 1 barra de prata |

**Casacos e túnicas de brasão** (uma categoria **Brasão: <casa>** para cada casa e cidade). São as **42 peças** de roupa de tronco que levam o brasão de Kuttenberg, Praga, Bergow, Leipa, Nebakov, Písek, Polner, Ruthard, Semine, Vavák, Zavish ou Zimburg: os sobretudos de brasão (`Coat02`), os casacos (`Coat04`, `Coat11`) e as túnicas de brasão (`Waffenrock`), as mesmas que `ARMADURAS.md` lista em *Casas e cidades*. Cada uma leva o que a roupa leva (linho; lã de carneiro nas mais caras) e **duas linhas a mais** para bordar o brasão; o nível vai do preço, do 6 ao 18, e o trabalho é mais demorado que o de uma túnica lisa (15 a 21 segundos). A lista distingue as casas pelo nome (*Sobretudo de brasão (Leipa)*), porque o jogo dá o mesmo nome a todos. Fica de fora o que é único (de missão ou de recompensa), o que é armadura ou capuz, as peças de Skalitz (são as roupas do Henry) e as das ordens e do reino da Hungria.

| Casa | Peças | Níveis | O que faz |
| --- | --- | --- | --- |
| Bergow | 6 | 7 a 18 | sobretudo, túnica simples, com bainha, de montaria, para cavaleiro, ornamentada |
| Kuttenberg | 7 | 6 a 17 | sobretudo, túnica simples, casaco comum com brasão, casaco quente bordado, túnica de montaria, para cavaleiro, com fecho |
| Leipa | 3 | 7 a 18 | sobretudo, túnica para cavaleiro, túnica com fecho |
| Nebakov | 4 | 6 a 13 | sobretudo, túnica simples, com bainha, para cavaleiro |
| Polner | 2 | 7 a 12 | sobretudo, uniforme da família Polner |
| Praga | 4 | 10 a 17 | casaco comum, túnica com bainha, de montaria, com botões |
| Písek | 4 | 7 a 16 | sobretudo, túnica com bainha, de montaria, para cavaleiro |
| Ruthard | 3 | 8 a 12 | sobretudo, túnica simples, com bainha |
| Semine | 5 | 8 a 17 | sobretudo, túnica simples, com bainha, para cavaleiro, de montaria |
| Vavák | 2 | 8 a 17 | sobretudo, túnica para cavaleiro |
| Zavish | 1 | 14 | túnica dos Lordes de Garbow |
| Zimburg | 1 | 13 | túnica com bainha |

**O que mudou do que já existia.** Nove dessas peças já saíam da costura por engano, sob nomes comuns: o gerador pegava a peça mais cara de cada nome, e *Túnica simples* era a de Semine, *Túnica de montaria* a de Písek, *Túnica para cavaleiro* a de Kuttenberg. Elas foram para a categoria da sua casa (o nível das outras roupas não se mexeu). As túnicas lisas, sem brasão, ficaram sem receita até a rodada seguinte (veja **As túnicas lisas**, logo abaixo). As peças das ordens (teutônica, da Cruz) e a do reino da Hungria que já saíam continuam onde estavam, em *Túnicas e vestidos*. Se o jogo recusar uma peça na bolsa (a classe do cinto e da bolsilha ainda não foi vista no jogo), a mensagem diz *o jogo não aceitou este item, e nada foi gasto* e a linha `craft: o jogo não aceitou ...` do registro traz o código. *Ainda não testado no jogo:* que as sete peças entram na bolsa, se equipam e dão os espaços de acesso rápido, e que as túnicas de brasão aparecem com o brasão certo.

**As túnicas lisas** (26/10/2026, no mesmo dia: *vamos add túnicas lisas para o artesão*). Seis nomes do jogo, a *Túnica simples*, a *com bainha*, a *para cavaleiro*, a *de montaria*, a *ornamentada* e a *com fecho*, vêm em **tinturas numeradas** (`Waffenrock02_m01_D`, `_m02_D`...) e também com o brasão de uma casa. A receita de cada nome era a da peça mais cara, que em três deles era de uma casa e foi para a categoria dela: ficaram sem túnica lisa. Agora **cada tintura dos seis** sai da costura, numa categoria só delas, **Túnicas lisas** (**38 receitas**: simples 5, com bainha 3, de montaria 15, para cavaleiro 6, com fecho 4 e ornamentada 5), no **nível que o nome já tinha** (simples 10, com bainha 12, de montaria 15, para cavaleiro 16, com fecho 18, ornamentada 19) e com o que a túnica leva (linho, linha, lã de carneiro nas mais caras). A cor vem **depois do nome**, *Túnica de montaria (azul-marinho)*, lida do ícone da própria peça (`tools/make-tunic-colours.py` grava `tools/tunic-colours.json`; a palavra é uma ajuda, e a lista mostra o ícone): uma palavra que duas tinturas dividem leva número (*ocre 1*, *ocre 2*). Os seis nomes saíram da categoria *Túnicas e vestidos* (as três que já estavam lá, a com bainha, a com fecho e a ornamentada, agora estão só na nova), e o resto dessa categoria ficou como era. **Hoje a costura tem 339 receitas, e a lista toda do jogo, 779.**

**A organização do ferreiro e do artesão, a cor das roupas e mais receitas** (31/10/2026: *a organização dos itens dos ferreiros e artesão está desorganizada; ao selecionar um item para fabricar abre um quadradinho para escolher a cor da roupa e o tipo; mais armaduras, armas e roupas para o artesão; novas comidas para o taberneiro, se existirem no jogo*). Tudo gerado por `tools/make-craft-recipes.py`.
- **A lista tem grupos.** O seletor de categorias agora tem títulos: no ferreiro, *Armas* (adagas, espadas, espadas de caça, sabres, montantes, machados, maças, martelos de guerra, lanças e armas de haste, arcos, flechas, escudos, armas de madeira), *Armaduras* (capacetes de chaleira, bacinetes e elmos, capacetes de calota, cotas de malha, couraças e placas, braços e manoplas, perneiras e joelheiras), *Montaria* e *Metal e ferramentas*; no artesão, *Roupas*, *Armaduras de pano e couro*, *Armas de tiro*, *Acessórios e joias*, *Fios e kits* e *Casacos com brasão*. As armas são separadas pela **classe do próprio jogo** (a categoria *Espadas curtas* tinha as de caça, os sabres, os montantes e até um machado), e *Todas as categorias* mostra a lista na ordem dos grupos, não do alfabeto. As peças de uma cidade (*Kuttenberg · Capacetes*) voltaram ao seu tipo: a lista diz *Só cidadãos de ...* na própria peça. *Tocha* e *Pãozinho* ganharam o nome que o jogo não trazia.
- **A cor.** Uma roupa é **uma receita só**, com todos os seus tingimentos: 150 roupas e armaduras de pano têm uma linha **Cor** no detalhe; o botão abre o **quadradinho** no lugar da lista, com **o ícone do próprio jogo de cada tingimento** e uma palavra para a cor (lida do ícone por `tools/make-variant-colours.py`; *ocre 1*, *ocre 2* onde duas dividem a palavra). Escolhida a cor, **sai a peça naquela cor**. São **1.334 tingimentos** (a costura fazia um só por nome). Os tingimentos que o jogo dá a ricos (riqueza 10 ou mais **e** preço entre o quinto mais caro do seu tipo) são **só de nobres**: aparecem marcados e a costura recusa a quem não é. Os tingimentos de um conjunto de cidade (a túnica de Kuttenberg ou de Malešov) continuam receitas à parte, só dos cidadãos.
- **A regra de nobre mudou um pouco**: era *riqueza 10 ou mais* e isso pegava 423 das 1.300 roupas (a túnica de mendigo, de 16 de preço, era de nobre). Agora é **riqueza e preço alto juntos**, ou o topo da escada do ofício, ou joia: **69 das 375 receitas da costura** e 30 das 284 do ferreiro são de nobres.
- **Mais peças.** O artesão fazia **balestras** (8, da caça, do campo e pesada, de nível 6 a 22: madeira de arco, linha, fixação, ferro) e **virotes** (11, cinco por vez), que desde 01/11/2026 são do **ferreiro**, nas categorias *Bestas* e *Virotes* da forja, ao lado dos arcos e das flechas (*besta deve ser receita só do ferreiro e não do artesão*; *faltou no ferreiro o craft das setas, os dardos da besta*; mesmo nível, mesma conta), e faz a *gola acolchoada* e, pelas cores, as roupas que não saíam (cada tingimento do jogo); o ferreiro faz as **manoplas** (7, nível 8 a 24, na categoria *Braços e manoplas*). **O taberneiro** faz 15 do jogo que não tinham receita: as três cervejas do Henry (*Vermelhinha do ferreiro*, *Pão do Henry*, *Bigorna preta*), as quatro de casamento (*Jitchine*, *Újezd*, *Turnov*, *de casamento*), o *Vinho barato*, o *da adega*, o *fino* e o *de Loretz*, o *Kumis*, a *Marikľa*, o *Arenque* e o *Pato assado*. As bebidas ganharam duas categorias (*Cervejas e hidromel*, *Vinhos e destilados*).
- **Hoje:** 863 receitas (fogo 94, defumador 27, secador 44, ferreiro 284, costura 375, alquimia 39). *Ainda não testado no jogo:* que o quadradinho mostra os ícones do jogo no lugar certo (são os mesmos espaços da lista), que o jogo aceita a bolsa com todos os tingimentos e as balestras, e as cores (palavras lidas dos ícones).

**O artesão, o ferreiro e os tempos (04/11/2026).** *"Um jogador artesão disse que faz brigantinas e coisas de ferreiro mas não faz um kit de reparo para elas, e que as peças mais difíceis ele faz em 10 s, enquanto as do ferreiro levam até 10 min: seria legal padronizar. O ferreiro não consegue extrair capuz de malha."*
- **O artesão faz o kit de armeiro (armadura)**, o mesmo item do ferreiro, no mesmo nível (5): 1 pele de vaca, 2 linhas e 1 fixação, na categoria *Kits de reparo* ao lado dos de alfaiate e de sapateiro.
- **Um tempo só por nível, na forja e na costura:** `12 s + 1 s a cada 2 níveis` (12 s no primeiro, 24 s no último), para armas, armaduras, roupas, joias, cintos, casacos de brasão, arcos, bestas e arreios. O ferreiro já era assim, menos as espadas e machados do jogo (14 s fixos), as bestas e os arreios; o artesão levava 8 a 16 s e passa a levar o mesmo que o ferreiro. As coisas que não são peças (fundição, carvão, ferramentas, kits, flechas) ficam como eram. Por peça o máximo é **24 s**; a conta de 10 min só aparece num lote de 10 peças difíceis seguidas (4 min), ou se o jogador contou outra coisa.
- **A extração agora aceita as peças com brasão**: o *Capuz de malha com brasão* (13 casas), a *Gola de armadura com insígnia* (6), os **escudos** das casas, cidades, guildas e ordens (81) e os sobretudos e casacos de brasão. Antes só entravam as peças que uma receita faz. A extração dá metade do que uma peça do mesmo tipo e do mesmo preço custa (as mesmas contas das outras peças soltas). Ficam de fora as peças de missão, as armas de fogo e os arcos únicos.

**As cores do ferreiro** (03/11/2026, relato de um ferreiro: *tem item com mesmo nome e ícone, só cor diferente; seria legal fazer o esquema de cores igual do artesão*). O jogo tem a mesma peça de metal em várias cores de tecido e acabamento, com um só nome, e a forja fazia só a mais cara. Agora **53 peças de armadura são uma receita só com o quadradinho de cor** (221 cores), como no artesão.
- **Nível, custo, tempo e XP não mudaram**, e nenhum preço de vendedor mudou. Armas e escudos continuam como eram.
- **As cores de uma peça protegem igual**: mesma defesa, durabilidade, requisitos e peso (a geração confere; a classe que difere não entra). O que o próprio jogo muda com a cor é o quanto ela aparece e o carisma, como nas roupas.
- **As peças escurecidas continuam com receita própria** (*Couraça lisa: escurecida*, *Perneiras de placa de nobre: escuras*...): têm nome próprio no jogo e pesam menos.
- **A cor de um conjunto de cidade continua só da cidade.** Ela vira uma receita à parte, com a cor no nome, só para os cidadãos: *Cota de malha curta (aço)*, de Malešov. Sobem de 6 para 22 as receitas com cidade na forja. **Três peças que eram só de uma cidade por causa da cor mais cara agora têm cores livres:** *Bacinete em forma de sino* e *Manoplas de brigandina* (Kuttenberg), *Manoplas de nobre* (Malešov).
- **As palavras** vêm das tabelas do próprio jogo (o material de cada parte da peça), só quando o ícone mostra aquela cor; sem cor à vista, o tom do aço (*aço*, *aço escuro*, *aço claro*). São ajuda para os olhos: o quadradinho mostra o ícone do jogo. `tools/make-variant-colours.py`, `tools/make-craft-recipes.py`.
- **Na aba Extrair**, a linha de uma peça colorida diz a cor (*vermelho · condição 100% · devolve 4 materiais*).
- **Hoje:** 946 receitas (fogo 94, defumador 27, secador 44, ferreiro 318, costura 349, alquimia 114). *Ainda não testado no jogo:* o quadradinho na forja e a peça saindo na cor escolhida.

### Selas e arreios do ferreiro

O ferreiro (Fabri Ferrarii) forja **coisas de cavalo** (23/10/2026: *coloque para o ferreiro poder forjar selas e coisas de cavalo*): **35 receitas novas** na forja, em quatro categorias (`tools/make-craft-recipes.py`, `TACK`; as peças vêm da tabela `item__horse.xml` do jogo, que tem 505, entre cores e brasões: aqui uma de cada tipo sem brasão, numa cor que os conjuntos do próprio jogo usam, para o nome ser certamente de arreio de cavalo).

- **Selas** (11, nível 2 a 22, pelo preço): Praga (2), de soldado (4), normanda (6), de Moglen (8), lovariana (10), húngara (12), de cavaleiro da Transilvânia (14), de Bridon (16), de Bravante (18), da Cracóvia (20) e de dragão (22). Pedem **couro** (vaca, porco ou cervo, pelo peso e pelo nível), **madeira de arco** para a armação, **ferro** para os estribos, **material de fixação**, linha e linho.
- **Rédeas e chanfros** (9): rédeas de couro macio (2), bridão com focinheira (4), bridão de placa (7), de Sharukan (10), do Sacro Império (12), de torneio (17); **chanfros** de placa: milanês (14), tirolês (20) e de dragão (22), de aço.
- **Arreios e caparazões** (10): arreios de Mainz (2), de Wieluń (4) e de Haia (9); caparazões de linho, do acolchoado ao decorado, até o de carrasco com arreio (22).
- **Ferraduras** (5, as receitas do próprio jogo): de fazendeiro (2), do cavaleiro (8), de Lovarian (12), do nobre (17) e de corrida (22), de sucata, ferro e aço.

Fora: as peças com brasão de uma casa. As cores além da primeira ficam para quando pedirem. O cavalo se veste pela aba **Cavalo** do inventário (a última aba, perto do cavalo; `gearLocked` desligado nos cavalos de jogador; o registro do servidor mostra `Horse N now wears 3 piece(s) of gear` a cada troca); `/horse gear <código>` e `/horse gear preset` continuam para o admin. *Ainda não testado no jogo:* que a aba aceita as peças forjadas (as compradas e as achadas já foram aceitas).

### A coleta

A guilda dos **Coletores** (Collectores; pedido de 21/10/2026: *"uma guilda nova Coletor ... sempre que o jogador bater com o machado em uma árvore, depois de x batidas ele recebe lenha ... com picareta nas pedras, chance muito baixa de vir prata, chance moderada de vir ferro ou parafuso e na maior parte algo inútil"*; *"não precisa cair, só de chegar o aviso nativo lá na esquerda está ótimo"*).

**Com E, desde a mesma noite** (*"golpeei umas 11 vezes, o machado quebrou e só recebi uma lenha; acho melhor apertar E e começar a animação de cortar lenha com machado nas mãos, ou nas pedras de mineração começar a picareta; assim conseguimos controlar melhor"*). Olhando para uma árvore ou uma pedra, a até 2 m do corpo (o alcance padrão, [O alcance do E e do F](#o-alcance-do-e-e-do-f)), o Coletor vê **[E] Cortar lenha** ou **[E] Minerar** (quem não é Coletor não vê nada). O E começa o trabalho: o personagem fica parado fazendo a animação do próprio jogo, a do lenhador cortando a árvore (`LumberJackCuttingTree`) com o machado de lenhador na mão, ou a do pedreiro com a picareta (`StonemasonPick`; na mão, a picareta do cavaleiro, `axeBattle03`, a mesma da bolsa, com a de mineiro do jogo, `pick`, de reserva: com ela o objeto não apareceu na mão em 22/10/2026), e a cada tantos segundos vem uma lenha, ou uma tentativa na pedra, até a árvore ou a pedra se esgotar. Enquanto trabalha, a dica vira **[E] Parar de cortar** (ou **Parar de minerar**). Nada vai para o chão: o que vem entra na bolsa, e o aviso do próprio jogo à esquerda é tudo o que aparece.

- **Ferramenta na bolsa** (não precisa estar na mão): qualquer machado do jogo (menos o de treino, de madeira) para as árvores; a picareta para as pedras. Cada lenha ou tentativa gasta **1,5%** da ferramenta; até 04/11/2026, abaixo de 2% ela não servia mais (*conserte com um kit de reparo*); **desde 04/11 ela trabalha até 0 e quebra, saindo do inventário** (a regra de `/desgaste`: o que chega a 0 quebra e some). **Dois machados (ou duas picaretas) iguais, na mesma condição, são uma linha só do inventário**, e a condição é da linha: um desgaste gastava os dois (25/10/2026: *se ele coletar recursos, minério ou lenha, e ter 2 machados, os dois se quebram juntos*). Agora o servidor **separa um da pilha** e gasta só ele: o da mão primeiro, senão o de melhor condição, de modo que dois machados se revezam e cada um dura o dobro. Se o inventário não tem lugar para o separado, aquela lenha sai sem gastar nada (o log diz `coleta: ... não coube na bolsa`), e se a retirada falha o machado separado é desfeito.
- **Árvore** (só as vivas das matas: pinheiro, abeto, faia, carvalho, bétula, tília, salgueiro, sorveira; não as secas, queimadas, doentes, pequenas, os tocos, os galhos, as caídas nem as macieiras dos pomares): **1 lenha a cada 10 s**, com **4 XP de Sobrevivência** (1 s a menos a cada 6 níveis de Sobrevivência, nunca menos de 5 s). Uma árvore dá **2 a 4 lenhas** (carvalho e faia 4; pinheiro, abeto e tília 3; bétula, salgueiro e sorveira 2) e **descansa 1 hora**.
- **Pedra** (as rochas e pedras do mapa, das encostas às pedreiras): **uma tentativa a cada 8 s**, com **2 XP de Força** (1 s a menos a cada 6 níveis de Força, nunca menos de 4 s). Cada tentativa: **minério de prata 1%** (**3%** nas rochas da região de Kuttenberg, `kutnohorsko_rocks`, e das pedreiras); senão, por peso: **nada 10**, **lasca de pedra 45** (sem serventia, 0,2 kg), **sal 10** (o sal do jogo, que o taberneiro e o caçador usam; pedido de 22/10/2026), **sucata 14**, **material de fixação 11**, **ferro 10**. Uma pedra dá de **3** (as pequenas, à beira da estrada) a **12** tentativas (os penhascos e as pedras grandes) e **descansa 30 minutos**.
- **Para**: E de novo; **andar** (W, A, S, D, as setas ou o espaço, depois de 0,7 s de carência para a tecla ainda apertada da caminhada até a árvore: *se o jogador andar deve cortar a animação, senão ele fica preso na animação*, 22/10/2026; o corpo é segurado parado pela animação, por isso a tecla é lida no cliente, como numa cama); sair do lugar (mais de 1,5 m); levar um golpe ou um tombo; o jogo cortar a animação (sacar a arma, por exemplo); a árvore ou pedra se esgotar; a ferramenta acabar. Não começa montado, nem durante outro trabalho de ofício.
- O mesmo modelo a até 1,8 m (árvore) ou 2,5 m (pedra) é a mesma árvore ou pedra. Árvore e pedra não caem nem quebram de verdade (o jogo não deixa o servidor tirá-las do mapa): o servidor guarda o que cada uma ainda dá, e nada disso passa de um reinício.
- **Avisos** (na linha de avisos do jogo): sem ferramenta, ferramenta gasta, árvore ou pedra esgotada, saiu do lugar, foi interrompido; quem não é Coletor, se chegar a mandar o pedido, *Cortar lenha e quebrar pedra é ofício dos Coletores...* (uma vez por minuto).
- **No log**: cada lenha (`coleta: X cortou lenha (modelo, resta N)`), cada prata (`achou minério de prata`) e cada E que não começou e por quê (`coleta: X não começou a cortar lenha: sem ferramenta`).
- **O ferreiro** faz as ferramentas (*a picareta deve virar ferramenta do ferreiro*): na categoria **Ferramentas** da forja, o machado de lenhador (nível 2: 2 sucatas, 1 lenha, 1 carvão) e a picareta (nível 6, antes 12 na tabela do jogo: 2 ferros, 2 sucatas, 2 lenhas, 1 carvão). Em **Carvão**, 2 lenhas dão 3 carvões (nível 1). Em **Prata**, o minério vira **barra de prata** (nível 4: 1 minério e 1 carvão) e a barra vira a prata do jogo: taça de prata (6) e cálice (9); os anéis e o broche de prata, que a forja fazia desde 21/10/2026, são do artesão desde 22/10/2026 ([As joias do artesão](#as-joias-do-artesão)); o jaspe e o pó de esmalte o vendedor ferreiro vende (10 de cada). O vendedor ferreiro **compra** a lenha, o minério e a barra de prata e essas peças, à frente do resto da lista dele.
- **Itens nossos** (`tools/make-craft-recipes.py`): Lenha (3 moedas no preço do jogo), Minério de prata (15), Barra de prata (30) e Lasca de pedra (0,1).

**O som** (23/10/2026: *"o barulho de cortar madeira e minerar só pode dar para escutar em quem estiver perto"*): a animação do lenhador e a do pedreiro tocam no corpo de quem trabalha **em todas as máquinas**, e cada uma dispara sons de ofício do próprio jogo (o machado no tronco, `f_lu_axe_log2`, a picareta na pedra, `f_sto_pickaxe_stone`, o cinzel, as pedras que caem), que o jogo deixa chegar a **30 m** (15 e 20 m alguns), medida de praça de aldeia. O servidor avisa a todos quem está trabalhando e em quê (`work.sounds`, a cada 4 s enquanto alguém trabalha; `work-sound.ts`), e **cada máquina corta esses sons nos corpos a mais de 12 m** (`client/work-quiet.ts`, a cada 60 ms, como já se fazia com os dados): quem está a menos de 12 m ouve; o próprio trabalhador ouve o seu. O que escapa é um estalo. O mesmo vale para a pá e a enxada do Agricultor. *Não testado no jogo.*

**O primeiro jeito (21/10/2026, à noite) e por que mudou:** a primeira versão contava os golpes de verdade (clique esquerdo com o machado sacado): não reconhecia machado nenhum (o item da mão, `rightHandItem`, vem em 32 dígitos na ordem do motor do jogo, não no GUID sem os traços), e mesmo corrigido o jogo gastava o machado a cada golpe numa árvore até quebrar. Agora o golpe é a animação e o desgaste é o do servidor.

**O kit** (22/10/2026: *ao receber o kit inicial aparece no chat que para cortar lenha ou minerar precisa apertar click esquerdo, mas não é assim: é só interagir com árvore ou pedra*): o aviso do `/coleta kit` e o do kit da guilda diziam o botão esquerdo, de quando era o clique; agora dizem *olhe para uma árvore ou uma pedra e aperte E; aperte E de novo, ou ande, para parar*.

*Ainda não testado no jogo:* que o andar corta a animação e solta o corpo; que a picareta do cavaleiro aparece na mão na animação do pedreiro (o log diz `craft: mina: StonemasonPick com axeBattle03 (...) na mão direita` na primeira vez); que a dica aparece mirando a árvore e a pedra; que a animação do lenhador e a do pedreiro tocam com a ferramenta na mão (o log diz `craft: animação de lenha: ...` e `de mina: ...` na primeira vez; num corpo de mulher o jogo pode não ter essas animações, e o trabalho segue sem ela); que o desgaste da ferramenta é aceito. O código: `src/server/gather.ts`, `src/client/gather.ts`, `src/client/trade-rights.ts`, `/coleta`.

**As sopas** (pedido de 20/10/2026: *adicione sopa nas receitas do taverneiro na profissão da guilda*). O jogo não tem sopa comum: só três sopas de missão e as panelas de ensopado, que não saem da panela. Então são **12 itens nossos** (`src/server/soups.ts`; itens e receitas vêm de `tools/make-craft-recipes.py`), na categoria **Sopas** do fogo, de Sobrevivência nível 3 a 19, de 7 a 10 s cada, **2 ou 3 pratos por panela**: sopa de repolho (3), de cebola (4), de alho (5), de urtiga (6), de legumes (8, três pratos), de ervilha com bacon (9), de cogumelos (11), de cerveja (12), caldo de galinha (13, três pratos), sopa de peixe (15), gulache (17) e sopa de lagostim (19). Cada uma pede de 4 a 7 ingredientes, **todos à venda no taberneiro** (repolho, cebola, alho, urtiga, cenoura, pastinaca, nabo, alho-poró, ervilhas assadas, bacon, pão, creme, cerveja, ovo, sal, água potável, banha, pimenta, frango, truta, carne bovina, lagostim, boletos). Na bolsa a ação do prato é **Comer** (o caldo, **Tomar**): enche de **18 a 38% do estômago** (um pão dá 19, um assado 26, as sopas de missão do jogo 30) e **tira de 10 a 20 da sede**, e o aviso diz quanto. Com o estômago cheio (97% ou mais) o servidor recusa e o prato fica na bolsa. Não dão vida, fôlego nem efeito nenhum (para não virarem poção), e não têm a animação de comer do jogo (a dele mostra um pão). O servidor registra `soups: 12 sopas nas receitas do fogo, que se comem da bolsa`.

> **Ainda não testado no jogo:** que o jogo aceita os 12 itens novos (o log do servidor diz `soups: 12 ...`; se faltar, o item não existe na bolsa) e mostra o **Comer** no prato.

> **Passivas fortes demais bloqueadas** (01/11/2026: *desativa essas passivas roubadas, deixe apenas Marbon com elas; os jogadores que a tinham, retire e devolve os pontos*): as nove que o [PASSIVAS.md](PASSIVAS.md) chama de *forte demais* (Duro de Matar, Ressuscitado II, Velocidade de Hermes, Fatiador de Tendões, Golpe Destruidor II, Golpe Abalador, Mestre de Ringen, Mestre-ladrão e Teologia) ficam bloqueadas na tela de vantagens de todos. Quem as tinha (21 personagens, 61 passivas, na contagem do dia) as perde ao entrar e recebe um ponto de volta na árvore de cada uma, com um aviso no chat. Só o **Marbon** fica com as nove: o servidor as dá a ele 20 segundos depois de cada entrada (`addPerk`). Código: `STRONG_PERKS`, `STRONG_KEEPERS` e `giveStrongPerks` em `src/server/perk-guard.ts`, e a entrada em `src/server/character-state.ts`.

> **Mesas de alquimia que não abriam:** o log do servidor mostrava `alchemy character unavailable: nativeModifierTieOrderRequired:f9de0477-2f59-4eec-b522-fa943f542277` para quem tinha o talento **"Secrets of matter I"** (e o **II**, e os de equilíbrio, `ca293053-...`): o servidor não consegue montar o personagem alquimista com esses talentos. Eles estão **bloqueados na tela de talentos** e, em quem já os tinha, são **tirados ao entrar, com o ponto devolvido** (`perk-guard.ts`); só esses quatro, e qualquer outro "Secrets of ..." da árvore da alquimia: as outras passivas de alquimia ficam livres. Foram liberados em 19/10/2026 (*ative de volta as passivas de alquimia*) e **bloqueados de novo em 21/10/2026** (*vamos desativar a alquimia de novo, não todas as passivas, mas tem uma que quebra a alquimia*), quando o log mostrou 17 tentativas em 4 minutos, todas da mesma conta, que tinha o "Secrets of matter I" e o "II" (os dois foram tirados e os dois pontos devolvidos). `perkGuard.enabled`, em `perk-guard.ts`, liga e desliga.

### A horta e os cavalos selvagens

**Duas guildas desde 25/10/2026.** *"Adicionei dentro da pasta img o brasão domador; vamos separar a mecânica de domar cavalo totalmente da guilda dos agricultores e criar a guilda de domadores, colocando a mecânica completa de domar cavalo nessa nova guilda."* As hortas continuam dos **Agricultores** (Agricolae). Os **cavalos selvagens** passaram, inteiros, para uma guilda nova, os **Domadores** (*Domitores*; brasão `guild-domador`, a arte do usuário `brasão domador.png`): o ofício `domar` de `guild-crafts.ts` é deles, e só eles veem o **[E] Domar**, são aceitos pelos cavalos, montam um cavalo selvagem depois de ganhá-lo e levam o aviso de quem pode amansar. Um Agricultor não doma mais nem tem a dica do cavalo no kit (a dica agora é só a da horta). O **kit** dos Domadores, entregue na primeira vez que entram na guilda: **6 cenouras** e **4 maçãs** (as melhores comidas de confiança) e roupas de montaria (túnica curta, calças largas, botas altas e gorro de lã para o homem; vestido, capuz e sapatos de trabalho para a mulher; bandagem de mão); a dica diz como ganhar um cavalo (devagar, E, comida). Quem é Agricultor e quer domar muda de guilda pelo painel (a troca grátis, se ainda tiver); a confiança que um jogador já tinha de um cavalo continua, porque é do jogador e não da guilda. Eram dois os Agricultores na hora da mudança.

A guilda dos **Agricultores** (Agricolae; pedido de 22/10/2026: *"acha que tem como fazer uma mecânica de agricultor no jogo? Ele interage com a horta apertando e abre um menu na direita falando o que ele pode plantar, o que precisa para plantar e em quanto tempo ele pode vir colher? Seria legal ele poder plantar ingredientes que o cozinheiro precisa. Ao plantar o jogador precisa de uma pá e o jogo faz a animação de cavando. Além do agricultor ter uma mecânica de domar cavalo ... o agricultor recebe roupas do ofício, pá e mais uns recursos para plantar"*; o brasão e o título *AGRICOLA* são a arte dele em `img`).

**A horta.** Os canteiros são os do próprio nível: as 118 fileiras que os lavradores do jogo capinam atrás das casas das aldeias (o jogo as marca com um objeto do ofício de agricultor), reunidas em **67 hortas** (Suchdol, Raborsch, Wysoka, Malešov, Bylany, Minas, Horschan, Miskowitz, Pschitoky, Stará Kutná, Danemark, Opatowitz, Kuttenberg), em `data/farm.json` (`tools/make-farm-data.py`). Mirando o **chão** de um canteiro, a até 2,5 m do corpo, o Agricultor vê **[E] Plantar** (livre), **[E] Plantação** (dele, crescendo: o E diz quanto falta) ou **[E] Colher** (dele, pronta); quem não é agricultor não vê nada.

- **Plantar** abre a **página da horta, à direita**, a mesma dos ofícios (título *AGRICOLA*, lista de plantas por categoria, **Pede**, **Colheita**): cada planta diz o que pede (**1 semente** e **uma pá na bolsa**, a ferramenta não se gasta), o nível de Sobrevivência, quanto rende e em quanto tempo fica pronta. O botão **Plantar** cava e semeia por **9 s** (a animação de cavar do próprio jogo, `Digging`, com a pá na mão direita; para o corpo de mulher, que o jogo não tem essa, a de capinar, `Hoeing`, com a enxada) e tira a semente. *Parar* ou fechar a página dá o plantio por desistido, sem gastar nada.
- **21 plantas** (a semente é um item nosso, `kcdc-craft:semente-...`): **legumes**, cebola (nível 0, 30 min, rende 4 a 6), repolho (0, 40 min, 2 a 3), nabo (2, 30 min), cenoura (3, 35 min), beterraba (5), alho (6), pastinaca (8), alho-poró (10), raiz-forte (12); **ervas**, urtiga (4, 25 min), hortelã (14), sálvia (16), camomila (18), calêndula (20) e papoula (22); **frutas** (24/10/2026: *nas plantações do agricultor vamos colocar pimenta e frutas*), as do próprio jogo, de mudas e arbustos que crescem devagar e dão pouco: maçã (7, 55 min, rende 3 a 5), pera (9, 60 min), ameixa (11, 65 min), pêssego (13, 70 min) e melancia (15, 80 min, rende 1 a 2); e a **pimenta**, a especiaria mais cara do jogo (a do `driedPepperSpice`, que vai nas sopas e nos embutidos), a última, a mais lenta e a mais rara (24, 90 min, rende 2 a 3). As mudas e sementes das frutas e da pimenta são vendidas pelo taberneiro; ele compra as frutas (a pimenta não, de propósito: vale 480 no preço do jogo e os cozinheiros a querem). São os **ingredientes das sopas e do fogo** do taberneiro e as ervas do alquimista: o taberneiro **compra** os legumes e o alquimista as ervas; as sementes são vendidas por eles (os legumes no taberneiro, as ervas no boticário), e a **pá** pelo ferreiro (67 no preço do jogo).
- **A plantação cresce em tempo real**, mesmo sem ninguém no servidor: o canteiro mostra **três mudas** ao longo da fileira (os modelos de planta do próprio jogo, pequenas, depois maiores, depois, pronta, **com o que dá** aos pés dela); o dono ouve *está pronta para colher* e ganha uma marca no mapa (**Herbalist**, só dele). Pronta, o **E** colhe (6 s, o jogo de colher ervas, `PickingHerbs`) e dá o **rendimento** (+1 do nível 15 em diante), **1 ou 2 sementes de volta** (metade das vezes 2) e a **experiência** da planta; o canteiro volta a ficar livre. Só o dono colhe. Uma colheita **esquecida estraga em 48 horas** (*passou do ponto e se perdeu*): as hortas são das aldeias e poucas, e quem some uns dias devolve os canteiros.
- **Quantos canteiros:** **4 por agricultor**, mais 1 a cada 5 níveis de Sobrevivência (`farmSettings.baseBeds`, `bedsPerLevels`). A semeadura dá 2 XP de Sobrevivência e a colheita o XP da planta (6 a 14).
- **O kit** (ao entrar na guilda): a **pá**, **sementes** de cebola (6), repolho, nabo, cenoura e urtiga (4 de cada), e a **roupa do ofício**: o conjunto do jardineiro do jogo (`kkut_gardener_1`: chapéu de palha, avental de couro, calça costurada, botas e bandagem) ou, para uma mulher, o vestido de trabalho com o chapéu de palha e os sapatos. O aviso do kit diz como plantar e como domar.
- **Guardado** em `playerdata/farm.json` (por Steam ID); ao reiniciar, as mudas voltam a aparecer e o relógio continua.
- **Canteiros marcados à mão** (23/10/2026: *em Suchdol a dica não aparecia num canteiro que se via*; as 118 fileiras são as que os lavradores do jogo capinam, e nem todo canteiro visível é uma delas): o administrador fica **no meio do canteiro, olhando para onde as fileiras correm**, e usa `/horta aqui [metros]`; nasce uma horta própria, numerada depois da mais perto (`Horta de Suchdol 9`), com uma fileira de 3 m (de 1,5 a 8) e **todo agricultor já a vê**. `/horta tirar` tira a marcada mais perto (até 4 m; as do próprio jogo não se tiram) e desfaz o que nela estiver plantado. Ficam em `playerdata/farm-extra.json`, são lidas antes das plantações, e sobrevivem a reinícios.
- **Não testado no jogo:** o E no chão do canteiro (a mira lê o terreno sob a cruz, a até 1,8 m da fileira; relatado em 23/10/2026 que em Suchdol a dica não aparecia: um administrador que usa `/oficios livre` recebia o direito mas não os canteiros, que o servidor só manda ao entrar, ao trocar de guilda e quando o cliente pergunta; agora o cliente de quem pode plantar e não tem canteiro **pergunta de novo, a cada 4 s**), a animação de cavar **com a pá na mão** (o log diz `farm: Digging com shovel na mão direita` na primeira vez, ou, se o jogo não aceitar o objeto, `farm: shovel não foi aceito como objeto da mão ...; Digging toca sem ele`; a da picareta dos Coletores já não apareceu na mão em 22/10/2026), a enxada na mulher (`Hoeing`, que no jogo tem uma fala de lavrador que num corpo de jogador pode não fazer nada), se as mudas de planta ficam bem no canteiro, e a marca no mapa.

**Os cavalos selvagens.** Em **21 campos abertos** longe das aldeias (achados na malha de navegação: o ponto de nascer de caça de onde se anda 35 m livre em quase todas as direções; ficam a 300 m uns dos outros e a 250 m de qualquer horta) vivem **2 cavalos cada**, **sem sela nem arreios** (e sem poder trocá-los), de raças que o jogo vende (Pebbles, Kasztanka, Khartoum, Bill, Mark, Windwurf...). Pastam em volta do campo e **fogem**: de quem **não é domador** a partir de **14 m** (22 m se vem a cavalo), e do domador **que corre** a 9 m; de um domador que **anda devagar** (até 3,4 m/s) eles não fogem: ficam parados, olhando, e voltam a pastar 20 s depois que ele sai (`wild-horses.ts`; correm para longe da pessoa, no máximo 70 m do campo).

- **Domar:** chegando a 3 m de um cavalo selvagem o Domador vê **[E] Domar**; o E abre um menu: **Oferecer** (a melhor coisa que levar na bolsa: **cenoura** +5, **maçã** +4,5, **pera** +4, **beterraba** +3, **nabo** +3, **pão** +2 de **confiança**), **Montar** e **Sair**. Cada oferta pede **90 s** de intervalo e o personagem faz o carinho do próprio jogo (`HorsePetting_2`, só no corpo de homem, 5 s) antes de o menu voltar, mostrando a confiança (arisco, desconfiado, atento, quase manso, *confia em você*, de 0 a 100: **vinte cenouras, meia hora**; mais difícil desde 23/10/2026: *deixe mais difícil domar um cavalo*, eram oito cenouras e oito minutos). **O cavalo pode recusar** a comida enquanto não confia (35% sem confiança nenhuma, caindo a nada na metade do caminho): a comida não sai da bolsa, mas os 90 s correm, e o menu volta com a espera. **A confiança que não é mantida cai:** depois de 20 minutos sem comida, 1 ponto a cada 6 minutos (`forgetAfterMs`, `forgetEveryMs`). Cada jogador tem a sua confiança com cada cavalo (guardada em `playerdata/wild-horses.json`, e sobrevive a reinícios).
- **Aos 100 de confiança** o menu libera **Montar**: ele faz o cavalo **ser do jogador**: ele entra em **Animais** (F2), sem nome (o da raça, para ele trocar), **dar** a outro jogador, trancar ou liberar, como qualquer cavalo; **já vestido** (23/10/2026: *quando um cavalo ficar 100% domado ele recebe sela e coisas básicas para poder montar já setados nele via códigos*): antes de passar para o jogador o servidor põe nele um dos conjuntos simples do próprio jogo (`horse_common01`, `02`, `05` ou `18`, sorteado: sela de Praga, rédeas de couro macio e ferraduras), ou as mesmas peças pelo nome se o conjunto não existir (`wild-horses.ts`, `dress`; o log diz `amansou o cavalo de m8-2, vestido com horse_common02`). Selas melhores o ferreiro faz. *Montar* já põe o jogador na sela (o *Mandar seguir* e o *Examinar* saíram em 09/11/2026). Aquele lugar do campo tem outro cavalo, de **outra raça**, **6 horas depois** (também se o cavalo morrer; um cavalo que sumiu sem doma nem morte volta em 2 minutos).
- **Ninguém monta um cavalo selvagem:** a subida do jogo é recusada (e o jogador é mandado descer) com o aviso de quem pode amansar.
- **Não testado no jogo:** que os cavalos fogem e voltam a pastar na malha de navegação, a animação do carinho, o *Montar* logo depois da doma e o cavalo aparecer com a sela e as rédeas (e a tela do próprio jogo aceitar trocar as peças do cavalo). *A comida:* o pedido dizia *coldawn*; não há item com esse nome no jogo, então valem as comidas de cavalo do jogo (a cenoura, a que o agricultor planta, é a melhor): é o primeiro ajuste se era outra coisa.

### O assobio do cavalo

Pedido de 22/10/2026: *e tem como colocar para os jogadores escutarem o assobio quando um jogador aperta X*. (O menu do **E** diante do cavalo, com *Seguir* e *Ficar*, saiu em 09/11/2026: o E diante de um cavalo que o jogador tem é o *Montar* do próprio jogo, e o cavalo não segue mais por ordem.)

- **O assobio que todos ouvem** (`horses.ts`, `client/whistle.ts`): o X de um jogador (a pé, com ou sem cavalo seu) é avisado a quem está a até **30 m**, e o cliente de cada um toca o **assobio de cavalo do próprio jogo** (`v_horse_whistle`) no corpo de quem assobiou, com o alcance que o jogo lhe dá (20 m). Um assobio por 2 s; a cavalo ou na carroça não vale.
- *Ainda não testado no jogo:* o som tocado no corpo dos outros.

## Idioma

O jogador escolhe o idioma na seção **Opções** do painel (*Idioma / Language*) ou com `/idioma pt|en`. Fica salvo por Steam ID (`playerdata/language.json`). O painel (F2 e F3) se traduz sozinho; o chat e os avisos também passam pelo dicionário (`lang-en-panel.ts` e `lang-en-messages.ts`). O que o dicionário não conhece aparece em português; os comandos de administração ficam em português de propósito.

## NPCs

A lista de todos os NPCs que o servidor mantém (comerciantes, mascates, banhistas, barbeiros, mestres, bandidos, animais) está em **`NPCS.md`**, na mesma pasta deste arquivo.

**Ninguém dorme na rua, nem fica no rio ou preso em casa (25/10/2026: *alguns jogadores repararam que uns NPC dormem na rua e outros bugam e caem no rio e não voltam ou se trancam em casa e não saem mais*).** Um NPC do servidor não decide nada sozinho: o que caía no rio, saía do chão andável ou acordava do lado de dentro de uma casa trancada ficava lá, porque cada ordem depois disso era planejada de onde ele estava e voltava bloqueada.

- **O guarda dos NPCs** (`src/server/npc-keeper.ts`): a cada 10 s olha cada barbeiro, mestre, cocheiro, comerciante, mascate e banhista contra o seu lugar. Quem está **6 m abaixo** do chão do lugar (no leito do rio, num barranco, debaixo do chão), **longe demais** (o quanto ele anda, mais 15 m), **fora do chão andável** duas vezes seguidas (água funda) ou **sem caminho de volta** por portas destrancadas duas vezes seguidas, a cada 30 s (preso numa casa trancada) é **feito de novo no lugar**; de noite, a caminho de casa, só entra para dormir. Depois disso fica 2 minutos sem ser olhado. O log diz `npc-keeper: vendors: Boticário (Raborsch) caiu (no rio...), a N m do lugar (x, y, z): feito de novo no lugar`.
- **No chão de verdade** (01/11/2026: *alguns NPCs ativos e posicionados no mapa, os jogadores relataram que ficam no ar voando*): o corpo de um comerciante de guilda nasce na malha de navegação do nível, que foi feita com o mundo inteiro do jogo; onde o jogo dos jogadores tem menos (uma barraca, um andaime ou um piso de uma das camadas de história do jogo, algo tirado pelo World Builder) ou onde a malha passa por cima do chão, o corpo ficava no ar. Quando um jogador chega a **40 m**, o servidor pede ao jogo dele o que há debaixo dos pés do comerciante (o traço de chão do próprio jogo, `World.raycastAll`, ignorando o próprio corpo, copas de árvore e arbustos): a mais de **0,3 m** acima do chão, ou afundado, ele é **posto no chão**, e o lugar fica guardado até o próximo início (o corpo refeito vai direto para lá, e o guarda o olha de lá, sem a malha). Um vão de mais de 10 m não é confiado. O log diz `guild-vendors: Mestre Coletor (coletor-bohunowitz) estava 1.60 m acima do chão em (x, y): posto no chão, a z`. Código: `src/server/npc-ground.ts`; testes em `tests/guildvendors.test.cjs`. **Não verificado no jogo**: os barbeiros, mestres e cocheiros andam pela malha e não passam por isso.
- **A porta, por fora**: os comerciantes iam para casa até o ponto da própria casa e de manhã nasciam nele, que pode ficar do lado de dentro de uma porta trancada (um NPC do servidor abre portas destrancadas e nunca destranca). Agora vão até o **degrau de fora da porta** e saem por ele.
- **À noite todo mundo entra**, menos os mascates, que acampam junto da fogueira: as **banhistas** entram pela porta de prédio mais perto dos banhos (até 70 m) e, sem porta perto, somem onde estão quando ninguém vê; os barbeiros, mestres e cocheiros sem porta a 70 m também somem quando ninguém está a 80 m, em vez de passar a noite em pé na rua. De manhã voltam ao lugar.

**Ainda não testado no jogo.** O log do guarda vai mostrar quantos e quais caem no rio ou ficam presos, e onde.

**O barulho de equipar perto dos NPCs (25/10/2026: *ao ficar parado com menu aberto ou sentado fico escutando barulho de equipando item; parece até que o servidor fica conferindo item e equipando; isso não pesa o servidor?*).** Não era o servidor conferindo item, e não pesava nada (o nosso código usa uns 2% de um núcleo). Eram os **gestos de pausa** dos comerciantes e mestres: o servidor procurava gestos por palavras, e os únicos que achava eram os de **mexer num baú** (`CheckStash`, `ChestCheckIn`, `ChestCheckOut`), cuja animação pega e solta um item da mão, com o som disso; o log do cliente mostrava até 14 por minuto em volta de um jogador parado. Agora os NPCs usam as **variações de pausa do próprio jogo** (mudar o peso de perna, olhar em volta, se espreguiçar: `MotionIdleVAR1`, `MotionIdleVAR2`, `MotionIdleVARdefault`, feitas para homem e mulher), e os gestos de baú ficam proibidos (`src/server/idle-gestures.ts`).

## Livros de habilidade

Os livros de habilidade do jogo (93 neste servidor: a arte da espada, o treinamento de lanceiro, a Regra de São Dimas, a alquimia, a eloquência, a força...) ensinam lendo. O **Ler** do jogo pergunta por quantas horas ler, escurece a tela e pula o relógio até o fim da leitura, e aí dá a experiência: aqui o relógio é do servidor, nada o pula, e o jogador ficava numa tela preta (pedido de 16/10/2026: *se o jogador for ler o livro para aprender vai travar e bugar*). Então o gamemode **toma a ação do livro** (o *Ler*/*Aprender* do inventário) e o **servidor lê por você, no ritmo do relógio do mundo** (`src/server/skillbooks.ts`, `src/client/skill-books.ts`).

- **Quanto leva.** As horas que o livro pede na tabela do jogo (4, 6, 8, 10 ou 12) passam no **relógio do mundo**, no passo que ele tiver: com 22,5 segundos de jogo por segundo (de dia), um livro de 4 horas leva uns **11 minutos reais** e um de 12 horas uns 32; à noite (13,5), 18 e 53. `/leitura` diz o que falta. `/leitura fator <0.02-2>` (admin) escala as horas: 1 é o relógio por inteiro, 0,25 um quarto (um livro de 4 horas em 3 minutos).
- **O que se faz.** Usar o livro (*Ler*/*Aprender*) **fecha o inventário e abre o livro na tela**, com a tela de livro do próprio jogo (`Book.open`): o título, a habilidade, a descrição e o texto do livro (as frases que o jogo guarda para ele), e a leitura **conta enquanto o livro está aberto** (pedido de 16/10/2026: *enquanto ele fica com o livro aberto está lendo*). Fechar o livro, andar mais de 3 m, lutar, levar um golpe, cair, morrer ou sair do servidor **larga a leitura**, mas **o que foi lido fica guardado** (`playerdata/skillbooks.json`, por Steam ID) e a leitura seguinte continua dali. `/leitura parar` larga o livro. Ao terminar, o livro fecha e o jogador lê que aprendeu. Se o jogo não abrir o livro, o servidor diz o motivo e a leitura não começa (`skill-books: ...` no log do cliente).
- **O que se ganha.** No fim, a experiência da tabela do jogo (`player.addXp`, o caminho do próprio jogo: a barra sobe e o aviso de subir de nível aparece). A habilidade tem de estar no **nível que o livro pede** (a série vai de 100 a 500 de experiência, dos níveis 0, 5, 10 e 15), senão o servidor diz qual nível falta. **Cada livro ensina uma vez por jogador.**
- **Os livros de atributo** (força, agilidade, vitalidade, eloquência) não têm linha na tabela de experiência do jogo: o servidor usa a mesma escada das habilidades (100, 200, 350 e 500, dos níveis 0, 5, 10 e 15), um palpite. Os dois livros que não são de habilidade (o raro de missão e o de receitas de alquimia) ficam de fora.
- **Como o cliente sabe quais são.** Quando o jogador entra, o servidor manda a lista de GUIDs dos 93 livros (em pedaços de 20, `itemuses` com a ação `skillbook.read`, o mesmo caminho do cozinhar: `src/server/item-uses.ts` e `src/client/item-uses.ts`) e o cliente toma a ação de cada um com `Inventory.onUse` (o jogo aceita até 256 no total, livros e carnes juntos: 93 + 31). O log do cliente diz `item-uses: skillbook.read: 93 item(ns) tomado(s) pelo servidor, 0 recusado(s)` (e, para as carnes, `item-uses: cook.use: 124 ...`: a soma dos dois); o do servidor, `skillbooks: 93 livros de habilidade lidos em tempo real`. A tabela vem do jogo (`tools/make-skillbooks.py` gera `src/server/skillbook-data.ts`).

> **Ainda não testado no jogo:** que o *Ler*/*Aprender* de um livro chama o servidor em vez do jogo (o log do cliente diz quantos livros foram tomados), que o livro abre e fecha como descrito, que o GUID que o jogo manda é o da tabela, e o ritmo (se 11 minutos para o menor livro for demais, `/leitura fator 0.25`).

## Viagem rápida de carroça

Pedido de 19/10/2026: *vamos colocar os NPC de viagem rápida fixos nos locais, junto à carroça ou cavalo deles; ao interagir com o NPC ele abre as opções de viagem rápida ao local em troca de dinheiro, quanto mais longe mais caro, e de noite o NPC vai para uma casa dormir* (`src/server/travel.ts`).

- **As paradas (13):** Suchdol, Raborsch, Malešov, Wysoka, Kuttenberg, Zikmundovo, Minas, Bylany, Bohunowitz, Miskowitz, Pschitoky, Stará Kutná e Horschan. Em cada uma há um **cocheiro** ao lado da sua **carroça coberta**, com os dois cavalos atrelados (a do próprio jogo). **Onde:** na beira da estrada que sai da vila, do lado de fora, **num lugar escolhido à mão** (20/10/2026: *nem todos os fast travel ficaram em um local legal; deixei o Builder rodando e o MCP para você ir olhando cada região e achar um ponto bom para as carroças*). As versões anteriores procuraram o lugar pela malha de navegação, depois pelos pontos onde as caravanas do jogo param dentro das vilas, depois por uma leitura do chão feita pelo jogo de quem chegasse perto; nenhuma acertou todas (*a de Suchdol no meio da praça, a de Wysoka no meio do arado em cima de um bebedouro de cavalo, a de Zikmundovo no meio dos acampamentos, a de Grunta com o cavalo em cima do muro, a de Kuttenberg no meio da estrada virada errado, a de Malešov fechando uma rua*). Agora cada parada foi olhada **de cima, no World Builder** (a câmera sobre a estrada, a vila ao fundo, e a carroça, o cocheiro e a chegada desenhados nos pontos): uma grama limpa ao lado da pista, sem árvore, muro, cocho, campo arado ou água por perto, no chão plano, **ao longo da estrada e de frente para longe da vila**, com o cocheiro entre ela e a pista. A posição de cada uma está escrita no código (`STOPS`, campo `fixed`) e o servidor não lê chão nenhum para elas; só uma parada que um admin cria (`/viagem nova`) ainda usa a leitura do chão pelo jogo (`/viagem procurar`).
- **A carroça é do serviço:** ninguém sobe nela, ninguém a registra, e perto dela não aparece **[E] Subir na carroça**; quem tenta ouve *Essa carroça é do cocheiro: fale com ele para viajar.*
- **Falar com o cocheiro (E):** a lista de escolhas do jogo com as outras paradas, da mais perto para a mais longe, cada uma com o **preço** e a distância (*Raborsch: 18 moedas (840 m)*), cinco por página; escolhida uma, *Pagar 18 moedas e partir*.
- **O preço:** **5 moedas mais 15 por km** da linha reta entre as paradas (de Suchdol: Wysoka 18, Zikmundovo 20, Raborsch 22, Bohunowitz 24, Miskowitz 32, Horschan 37, Pschitoky 37, Bylany 45, Minas 49, Malešov 51, Stará Kutná 53, Kuttenberg 56; a mais barata é de Kuttenberg a Stará Kutná, 8, e a mais cara de Raborsch a Malešov, 60). `/viagem preco <base> <por km>` muda.
- **A viagem:** o dinheiro sai, a tela escurece (1,5 s), o jogador é posto ao lado da carroça da outra parada, olhando para ela (como num renascimento: o corpo espera o chão daquele lugar carregar) e a tela volta. Se o jogo não aceitar a mudança, o dinheiro volta.
- **Quem não viaja:** quem está montado, numa carroça, carregando alguém ou alguma coisa nos braços, numa troca, numa mesa de dados, foi atingido por alguém nos últimos 30 segundos, ou com um reinício anunciado; e ninguém viaja de **noite**.
- **De noite** (das 22h às 6h do jogo) o cocheiro anda até a porta da casa mais perto (até 70 m) e entra para dormir, e volta de manhã; a carroça fica. Quem tenta subir nela à noite ouve *O cocheiro de Suchdol foi dormir: as viagens voltam de manhã.* Um cocheiro sem casa perto fica no lugar, mas também não viaja de noite.
- **O admin** muda as paradas com [`/viagem`](#viagem).

> **Ainda não testado no jogo:** se cada carroça ficou num lugar bom (os lugares foram escolhidos olhando imagens de cima, sem andar lá; os de Minas, Horschan e Bohunowitz foram os mais difíceis de ver: se algum estiver errado, o admin vai até lá e usa `/viagem aqui <parada>`, e `/viagem original <parada>` traz de volta o lugar escolhido); se a tela escurece mesmo (o efeito `colorGrade` no mínimo de brilho); e se o cocheiro acha a casa de noite.

## Móveis do World Builder

As **cadeiras**, as **camas** e os **baús** que as exportações do World Builder puseram (o castelo de Raborsch) funcionam (`src/server/furniture.ts`): a mira numa cadeira mostra **[E] Sentar**, numa cama **[E] Deitar**; o corpo senta ou deita com a animação do jogo e o cansaço passa como numa cama ou cadeira do jogo. **W A S D** ou **Espaço** levantam, ou `/levantar`. Os baús abrem como os do nível. Onde o corpo fica em cada tipo de móvel se ajusta com [`/mobilia`](#mobilia).

> **Ainda não testado no jogo:** as poses (um palmo fora do assento se corrige com `/mobilia ajustar`).

## O humor dos cavalos

*"Tem jogador upando batendo no próprio cavalo: se bater várias vezes, mostrar 'seu cavalo não gosta mais de você e te abandonou', e ele sai dos animais dele e vai embora. Para isso adicione o sistema de humor: cavalos com mau humor não andam, não correm e vão embora"* (04/11/2026). `src/server/horse-mood.ts`; o estado e os portões, em `src/server/horses.ts`.

- **O humor** é um número de 100 no registro do cavalo guardado (100 é o melhor). **Cada pancada do DONO no próprio cavalo tira 20 pontos** (espada, soco, flecha; o evento `horseDamage` diz quem bateu). Pancadas de outro jogador, queda, colisão e veneno não contam.
- **Recupera 4 pontos por minuto**, só com o dono no jogo.
- **De 100 a 60: calmo.** Abaixo de 60 (a terceira pancada): **irritado**: o dono é avisado e o cavalo tem um pouco menos de fôlego.
- **Abaixo de 30 (a quarta pancada): mau humor.** O cavalo **não anda e não corre**: não deixa **ninguém montar** (nem o dono: o cavaleiro que estiver nele é derrubado), **não vem ao assobio** (X, `/cavalo chamar`), e um efeito do mod tira o seu fôlego e o galope (*Cavalo de mau humor*). Com o tempo ele volta ao normal e o dono é avisado.
- **A quinta pancada: ele vai embora.** O dono lê *"Seu cavalo (nome) não gosta mais de você e te abandonou."*, o cavalo **sai dos Animais dele**, corre para longe do dono e some do mundo 25 s depois. É perdido: a regra existe para que ninguém treine arma no próprio cavalo.
- **No painel (F2 → Animais):** cada cavalo tem a barra **Humor** ao lado de Vida e Fôlego, com a palavra (*calmo*, *irritado*, *de mau humor*) e a cor: verde, âmbar ou vermelha. Aparece também para o cavalo que não está no mundo agora (04/11/2026: *"a barra de humor não apareceu na seção Meus animais"*).
- **Não testado no jogo:** que o jogo informe as pancadas do dono ao cavalo (o evento é o `horseDamage` do KCDC, que diz o `attacker`), que os efeitos tirem mesmo o galope, e o cavalo correndo para longe.

## Quadros de avisos

**O que mudou em 09/11/2026 (noite).** (1) *"Deletar o anúncio de cada cidade no quadro de aviso: tem um sistema que permite criar anúncios fixos, isso vamos deletar."* A seção **Informações da região** (parágrafo de 04/11/2026 mais abaixo) **saiu**: não há mais a aba, nem o código (`decrees.ts`), nem o comando para retirá-la; os registros `decreto` que um `playerdata/mural.json` antigo ainda tenha são descartados ao ler o arquivo. (2) *"Vamos add uma outra aba, chamada Cidadania: lá o jogador vê o brasão, quem controla a cidade, população, se está em guerra, e o jogador pode pegar a cidadania."* A página tem agora duas abas, **Cartazes** e **Cidadania**. A segunda mostra a cidade do lugar onde o quadro está (o id do quadro é o da cidade): o brasão (o link da imagem que a família do senhor pôs, ou um escudo apagado), a categoria, as terras, o **senhor das terras**, a **Lady**, a família, a **população**, se a cidadania está **aberta ou fechada pelo senhor**, a **guerra** (com quem), quantos NPCs vivem lá e a cidadania do próprio jogador; e o botão **Tornar-me cidadão** (ou *Mudar para cá*: grátis na primeira troca, 100 moedas nas seguintes, de graça para o administrador), que pede confirmação. O servidor só aceita o pedido de quem está junto do quadro, e só para a cidade dele (`mural.citizen`, `becomeCitizen` em `src/server/mural.ts`). Um quadro num lugar que não é cidade (Slatego, Schdiar, Vidlak) não tem a aba. **Fechar ou abrir a cidadania, expulsar cidadãos, declarar guerra e entregar terras** (as ferramentas do senhor, que eram da seção Cidadania do F2) **ainda não têm tela**: a lógica continua no servidor (`citizenship.ts`, `wars.ts`), mas nenhum botão chama. (3) *"Deletar o sistema de ícone na cabeça e apagar da seção Opções"*: o brasão da guilda e o cartaz que giravam sobre os lugares de trabalho e os quadros (`trade-marks.ts`, a página `marks.html`) **foram apagados**, com a opção Ícones do ofício e dos avisos. (4) No lugar, *"uma imagem chamada quadro de aviso, acima de cada quadro, sem aparecer atrás de parede, sem lag e sem perder FPS"*: a figura (`img/quadro de aviso.png`) virou um **objeto do próprio jogo**, um quadrado plano com a figura de textura, enviado aos jogadores na pasta `stream/` do recurso e posto como *prop* sobre cada quadro (`src/server/board-signs.ts`, arquivos feitos por `tools/make-board-sign.py`). Como é desenhado pelo motor, fica parado onde foi posto, a parede o esconde como esconde qualquer objeto, e custa um quadrado por quadro. Fica 2,2 m de lado, com a borda de baixo 30 cm acima do topo do quadro, virado para o lado para onde o quadro olha, de dois lados; sobe 15 s depois do servidor. **Não verificado no jogo**: que o jogo carregue o modelo, o material e a textura em pedaços, como a figura aparece (o material tem um brilho de 0,5, `Emittance`, para ser vista à noite) e de que distância o jogo a mostra. (5) Os quadros de Trosky: **11 lugares** (Semine, Nebakov, Castelo de Trosky, Acampamento nômade, Zhelejov, Troskowitz, Tachov, Apolônia, Slatego, Schdiar e Vidlak), postos pelo dono no World Builder e lidos de `worlds/quadros-trosky.world.json`; a caixa de cada lugar (`PLACES` de `mural-places.ts`) é a da região do catálogo com os moinhos, a estalagem e as fazendas dela.

**Tamanho (04/11/2026, *"aumente a HUD do quadro de avisos"*).** A página ocupa cerca de **3/4 da largura e 85% da altura** da tela (em 1080p eram 58% x 68%) e a letra ficou um pouco maior (até 24 px numa tela grande, eram 17). Continua seguindo Opções → Resolução da interface.

*"Quadro de avisos em cada vila, cidade e reino ... cada vila, cidade e castelo tem o seu (depois: nos castelos não, ver abaixo) ... o jogador paga 10 moedas para publicar três tipos de cartaz: cartas de procurado, cartaz de solicitações de recursos e cartaz de avisos ... fica lá 7 dias ... pode publicar como anônimo ou deixando o nome ... edições no texto por espaçamento, formatação, bold, fonte normal ou uma fonte mais boêmica ... filtrar por tipo, data e recentes, além de reordenar ... o dono do cartaz pode remover os cartazes dele mesmo"* (24/10/2026). E à noite do mesmo dia: *"os quadros de aviso de castelo vamos tirar, só vai ter quadro de aviso nas vilas e cidades que têm como dar viagem rápida pelo NPC e que estejam mapeadas; se tiver em uma vila que possui castelo não faz sentido ter no castelo"*; e sobre os filtros do quadro: *"botões é feio, podia ser um dropdown ou algum ícone"*.

**Os quadros.** São molduras de postes de madeira com tábuas, uma cobertura e cartas pregadas, feitas no World Builder só com peças do jogo (dois postes, quatro tábuas, uma tábua de teto, oito papéis), **13 quadros em 13 lugares**: Suchdol, Raborsch, Malešov, Wysoka, Kuttenberg, Minas, Bylany, Bohunowitz, Miskowitz, Pschitoky, Stará Kutná, Horschan e Zikmundovo (o acampamento de Sigismundo, que o dono mapeou na noite de 25/10/2026: o quadro está no cruzamento do acampamento, na grama ao lado do caminho que vem da parada do cocheiro, de frente para quem chega, junto ao talude da paliçada, a 16 m do centro, como os outros ficam no coração de cada lugar). **A regra do dono (24/10/2026, à noite):** só há quadro em vila ou cidade **mapeada** (que está em `PLACES`) e **com parada de cocheiro** (`STOPS` de `travel.ts`, a viagem rápida), e **nenhum em castelo**: a vila que tem castelo usa o quadro da vila. Os seis que não cabiam na regra foram **tirados do World Builder do dono** (com o pedido dele; a cópia dos 19 ficou guardada): os dos castelos de Suchdol e de Raborsch e os de Stará Lhota, Danemark, Rabstein e Opatowitz (sem cocheiro); o do castelo de Malešov já estava na vila e ficou; depois o dono pediu um só em Malešov, no lugar que ele tinha escolhido para o do castelo (o quadro de Malešov que estava a 15 m do centro da vila saiu, e o que ficou tomou o nome `quadro-malesov`). Um teste (`tests/mural.test.cjs`) lê o arquivo e confere a regra (13 quadros, um por lugar, todos em lugares com cocheiro e mapeados). O arquivo é `worlds/quadros-de-aviso.world.json` (em `mod.world_resources`, ao lado do `raborsch.world.json`); a primeira posição de cada um fui eu que escolhi e **o dono do servidor mudou todos para lugares melhores** (o mundo dele é o que vale: o servidor lê o arquivo, não tem posição escrita em código). O que diz ao servidor que ali há um quadro é uma peça escondida, um pergaminho (`scroll_c`) **enterrado** meio metro à frente das tábuas, que é também o ponto de onde se mede o alcance (`src/server/mural-places.ts`).

**Cada lugar tem a sua lista.** O nome e a lista de cartazes de um quadro vêm do **lugar onde ele está** (`placeOf`): o chão da vila ou da cidade (as mesmas caixas de `properties.ts`, que **incluem o castelo** de Suchdol, de Raborsch e de Malešov: um quadro dentro das muralhas é da vila); senão, até 30 m além. Dois quadros no mesmo lugar mostram **os mesmos cartazes** (Malešov tem dois). Um quadro que o construtor muda de lugar mantém os cartazes enquanto continuar no mesmo lugar. *Antes de 24/10/2026 à noite os castelos eram lugares próprios (`castelo-suchdol`, `castelo-raborsch`, `castelo-malesov`); já não são. Nenhum cartaz tinha sido afixado nos quadros que saíram.*

**O aviso.** Diante do quadro, com a mira nele, a 3,2 m do ponto à frente das tábuas, aparece **[F] Quadro de avisos** (a tecla do fogo; não há fogo ao lado de um quadro). O servidor aceita um metro a mais (4,2 m). Quem não vê o aviso usa `/mural`.

**A página** (`ui/mural.html`, `src/client/mural.ts`): um cartão de papel **no meio da tela, sem ocupá-la**, na identidade do painel (o mesmo papel, os cantos e o vermelho), com o título **MURALIS** que o dono pintou (`titulo mural.png`) e o nome do quadro. À esquerda, a **lista**: o botão *Afixar um cartaz* (10 moedas), os filtros, que são **três menus** (*Tipo*: todos, procurados, recursos, avisos; *Quando*: qualquer, hoje, 3 dias; *Ordem*: novos, antigos, por tipo; o padrão é **o mais novo primeiro**), cada um com um ícone e o valor escolhido no botão, e um **botão de ícone** *Só os meus* (pedido do dono, 24/10/2026: *botões é feio*), e os cartazes: a **figura do tipo** (os três cartazes que o dono pintou: *Procuratus*, *Petitio opportunitatum* e *Avisus*) com **o nome de quem afixou** embaixo (*Anônimo* em itálico se não quis o nome), o título e a idade. À direita, o cartaz escolhido (**o texto e as informações**: tipo, título, quem afixou, há quanto tempo, quanto falta para sair) ou o **formulário** de um cartaz novo.

**Informações da região (04/11/2026; removida em 09/11/2026, veja acima).** *"Na seção do quadro de aviso vamos colocar uma seção nova chamada informações da região: só administrador, lorde e cargo específico podem publicar e deletar; podem ter mais texto e ficam sem data limite; coloquei decreto leão e decreto corvo, essas vão ser as imagens; um lorde e os demais cargos com sentido só podem postar nos quadros das terras deles; a carta sempre usa a imagem da facção do lorde, e se o lorde não tem facção a publicação fica bloqueada com o aviso 'lorde não possui facção'. A ideia é postar aqui as regras das terras, precificações, eventos e coisas do tipo."* `src/server/decrees.ts` (quem pode), `src/server/mural.ts`, `ui-src/mural.html`. **Desde 09/11/2026, com as facções fora, a informação não leva selo de facção e não pede lorde com facção** (veja abaixo).
- **Uma segunda seção na mesma página**, em duas abas sob o título: *Cartazes* e *Informações da região*. Na segunda, a lista mostra o título de cada informação, o autor e a idade; ao lado, o texto, com o cargo do autor sob o título.
- **Sem custo, sem prazo e mais texto:** até **2.400 letras e 60 linhas** (o cartaz comum tem 900 e 22), sem pagar moedas, e **fica no quadro até ser retirada**. Nunca é anônima: leva o nome e o cargo (*Lorde de Suchdol*, *Burgomestre de Suchdol*, *Administração*). Até 6 por jogador e 16 por quadro; essa conta é à parte da dos cartazes. `/mural limpar <quadro>` **não tira** as informações (só `/mural remover <número>`).
- **Quem publica:** (1) o **administrador**, em qualquer quadro que fique em terras do reino; (2) o **lorde das terras** (quem recebeu a região, ou a da sede), nos quadros dessas terras, as terras da casa incluídas; (3) quem tem um **cargo que governa**, dado **para as mesmas terras** (a sede ou uma das suas terras): lorde, burgrave, hetman, capitão da guarda, chanceler, juiz senhorial, mordomo, tesoureiro, bailio, administrador do domínio, arauto, burgomestre, conselheiro municipal, chefe da aldeia, chefe de mercado, coletor de pedágios, escrivão e capitão da milícia urbana. **Cavaleiros, a Igreja, os mestres de guilda, os soldados e os administradores de hospedaria não publicam**, nem quem tem um título sem terra. O quadro do outro lorde não é seu.
- **Quem retira:** quem publicou, o administrador e o lorde das terras do quadro.
- **Sem selo (09/11/2026):** a informação não leva brasão de facção; quem pode publicar (acima) publica em qualquer quadro das suas terras, haja lorde ou não. O quadro de Zikmundovo (que não é uma terra do reino) continua sem receber.

**O formulário.** Tipo (as três figuras), título (48 letras), o texto (900 letras, 22 linhas), uma **prévia** com a formatação, e a formatação do texto inteiro, numa barra de ícones e menus: **negrito** (botão **B**), **fonte** *Normal* ou *Boêmia* (menu; uma fonte gótica, a Grenze Gotisch, da licença livre SIL OFL, recortada para o alfabeto latino: 21 KB), **espaçamento** *Junto*, *Normal* ou *Largo* (menu) e **alinhamento** à esquerda ou ao centro (dois botões de ícone). E a opção *Afixar sem o meu nome (anônimo)*. Esc, o X ou andar para longe fecham a página; o que foi escrito e não afixado fica guardado até o jogador sair do jogo.

**As regras** (`muralSettings`, em `src/server/mural.ts`): **10 moedas** por cartaz (cobradas só quando o cartaz é guardado; se o disco falhar o dinheiro volta), **7 dias** no quadro, **4 cartazes por jogador** em cada quadro, **60 por quadro**, um cartaz a cada 4 s, e só quem tem personagem afixa. O texto é limpo no servidor (sem caracteres de controle nem invisíveis, uma linha em branco no máximo em seguida) e a página o desenha como texto, nunca como marcação. **Quem afixou retira o cartaz dele** (botão com confirmação); o administrador retira qualquer um (`/mural remover`, `/mural limpar`). O servidor guarda **a conta de quem afixou** para isso e **nunca a manda à página**: o jogador só sabe se o cartaz é dele (*mine*). O nome que aparece é o do personagem no dia em que afixou.

**O que é guardado.** `playerdata/mural.json` (pelo `store.ts`, que mantém uma cópia do último arquivo bom; um arquivo que não pôde ser lido **não é sobrescrito**: os cartazes novos são recusados até alguém olhar). A cada 10 minutos o servidor tira os cartazes de 7 dias (*"N cartaz(es) saíram do quadro depois de 7 dias"*) e quem está com o quadro aberto recebe a lista nova, assim como quando alguém afixa ou retira. As figuras da página (o título e os três cartazes, de 12 a 17 KB cada) ficam no servidor (`data/craft-titles.json`, feito por `tools/make-ui-images.py`) e vão uma vez por sessão; o que vai ao cliente de todos é só a página (26 KB) e a fonte (21 KB).

**Inglês.** A página tem os dois idiomas; as respostas do servidor passam pelo dicionário (`lang-en-messages.ts`).

> **Ainda não testado no jogo:** o aviso **[F]** (a mira no ponto enterrado, o alcance e a altura de cada quadro nas posições novas), a página dentro do jogo (o cartão no meio, o foco do teclado e o Esc), a fonte gótica no navegador do jogo, as figuras e a posição das peças de cada quadro. **Para ajustar:** `muralSettings` (preço, dias, limites), `EDGE_M.mural` (o alcance), `PLACES` e as margens em `mural-places.ts`, o `REACH` do tipo 7 em `cook-hint.ts` (a mira).

## O chat do T

*"Além disso, as mensagens no T devem só chegar para a região, essa vila ou cidade; quem estiver mais longe não pode ver as mensagens"* (25/10/2026).

**Quem lê** (`src/server/local-chat.ts`). O relé do framework, que mandava a linha escrita no T a todos os jogadores, foi **desligado** (`Chat.setDefaultRelay(false)`) e o servidor entrega cada linha só a quem, no mesmo mundo e já dentro do jogo, está:

1. na **mesma região**: uma das vilas e cidades de `REGIONS` (`properties.ts`, as 17 mapeadas), pelo **contorno que o mapa do jogo dá ao lugar** (`mappedRegions`, com a mesma folga de 25 m do censo) e, onde o mapa não tem contorno, pela caixa da lista. O castelo e o moinho de uma vila são da região dela; ou
2. a **até 30 m** de quem fala (`NEAR_M`), em região ou não: o portão da vila, a estrada logo fora; ou
3. **no campo aberto**, quem fala e quem lê os dois fora de toda região, a **até 50 m** (`OPEN_M`, um pouco além do grito, que alcança 25 m).

Quem fala lê sempre a própria linha. Quem está numa vila **não** lê quem fala do campo aberto a mais de 30 m, nem o contrário. **Os administradores seguem a mesma regra** (não ouvem de longe): assim o dono testa o alcance com a própria conta. `/me`, `/do` e `/try` continuam com o alcance deles (30 m, os nomes por apresentação); a voz também.

**O nome.** A linha continua saindo com o **nome da conta**, como o relé do framework a mandava (é a lacuna conhecida do esconde-nomes, veja [Encontros entre jogadores](#encontros-entre-jogadores)); mostrar *Desconhecido* a quem não foi apresentado é trocar uma linha em `speak`, se o dono quiser. A fala de um jogador (a linha que tem autor) **não passa pelo dicionário** de tradução (`language.ts`): quem escreve "Família" diz "Família" também a quem joga em inglês; os avisos do servidor passam.

**O tamanho.** A página do chat (`ui/chat.html`) não deixa escrever mais de 300 letras; o servidor entrega até **400** (`CHAT_MAX`), e uma linha maior, que só um cliente alterado consegue mandar, é **recusada só a quem a escreveu**, com a frase do `/me` (*"Muito longo: no máximo 400 letras ..."*). Os espaços e as quebras de linha são dobrados em um espaço antes de contar.

**O aviso.** Na primeira linha que o jogador escreve depois de entrar, só a ele aparece: *"O chat (T) chega só a quem está na mesma vila ou cidade que você, ou a até 30 metros de você; no campo aberto, a até 50 metros."* Assim um chat vazio não é tomado por quebrado. Sai de novo se o jogador sai e volta.

**O registro.** Cada linha deixa uma no log do servidor, **sem o texto**: `chat: <conta> em <lugar ou campo aberto>: lido por N de M` (M: os outros jogadores do mesmo mundo; N: os que leram). É por ela que se vê se o alcance está certo: `journalctl -u kcdc-server | grep "chat:"`.

**Se algo falha.** Se o relé do framework não se desliga, o servidor diz no log e o chat **continua para todos** (nunca duas cópias de uma linha). Se o mapa não puder ser lido, vale só a distância. Se o recurso do gamemode para sozinho, o relé volta ao framework.

> **Ainda não testado no jogo:** se o relé do framework entregava a linha também a quem a escreveu (aqui ela chega pelo mesmo caminho que a dos outros), se as regiões cobrem os lugares como o jogador os vê e se o cartão do chat mostra bem o autor. **Para ajustar:** `NEAR_M` e `OPEN_M` em `local-chat.ts`.

## A doma fica mais fácil com a força do Domador

*"À medida que o domador vai ficando mais forte deve ser mais fácil também domar cavalos mais difíceis"* (04/11/2026). `src/server/wild-horses.ts`.

- **Cada raça tem uma dureza** (`BREED_HARDNESS`): **0 comum** (Pebbles, Bitterklee, Mark, Bill, Kasztanka, Acorn, Meadow e o cavalo de montaria simples), **1 de boa linhagem** (Crow, Jarmilka, Gavora, Erdel, Shlamhak, Tarant), **2 nobre** (Soldier, Artax, Khartoum, Kluger Hans, Pisek Lad, Napoli) e **3 lendário** (Svadilfari, Veillantif, Windwurf, Kincsem). As tabelas do jogo não trazem atributos das raças que o servidor possa ler (a sonda na cópia de teste devolveu vida e fôlego zerados), então **a classificação é do servidor**, numa tabela só, fácil de mudar; uma raça fora dela vale 1.
- **A força do Domador é a Equitação** (`horse_riding`, de 5 a 30): ela já sobe com o montar. O Domador de nível 5 é o iniciante; no 30, o mestre.
- **O efeito.** Uma comida dá a confiança de sempre **vezes a facilidade** do cavalo para aquele Domador: `(1 + 0,35 × força) / (1 + custo da raça × (1 − força))`, com o custo 0, 0,4, 0,9 e 1,6 e a força de 0 a 1. Um iniciante com o cavalo comum: 1 (a cenoura dá 5 de 100, como sempre); com o lendário, 0,38 (a cenoura dá menos de 2, uns 52 oferecimentos); a meio caminho (Equitação 17), o lendário 0,65; **no topo, qualquer raça rende 1,35, mais depressa do que o cavalo comum rendia ao iniciante**. A **recusa** (35% sem confiança) sobe meia vez por grau da raça (o lendário: 87% para um iniciante) e cai até dois quintos com a força (nunca passa de 90%).
- **A conversa diz como o cavalo parece para você**: *"Cavalo selvagem (nobre, difícil para você): desconfiado. Confiança ..."*, com *fácil para você*, *no seu alcance*, *difícil* e *muito difícil*; nada é dito de um cavalo comum que está no seu alcance. O log de cada comida traz a raça, a dureza, a Equitação e a facilidade.
- Não verificado no jogo: que a Equitação do Domador sobe de fato com o tempo de montaria (é o que o jogo dá), e se as durezas de cada raça combinam com a ideia do usuário de "mais difícil".
