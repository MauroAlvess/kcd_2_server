# Comandos do servidor

Lista de todos os comandos de chat (`/`) que o gamemode `kcdc-gamemode` já tem, gerada a partir do código (`src/server/commands/*.ts`).
São **79 comandos**, em 17/10/2026 (gamemode 1.1.0, KCDC 1.6.10). Serve como mapa de pesquisa: para cada comando há o que ele faz, quem ele afeta, o arquivo que o implementa e as partes da API do motor que ele usa, para reaproveitar quando formos programar.

As formas de uso abaixo são copiadas do próprio `/help` do jogo, por isso estão em inglês.

> **Perfis.** Há dois: **jogador** (roda só 26 comandos: `/admin`, `/alforje`, `/anim`, `/cachorro`, `/camera`, `/cansaco`, `/carroca`, `/cavalo`, `/chave`, `/cozinhar`, `/creator`, `/dice`, `/do`, `/face`, `/fome`, `/help`, `/idioma`, `/language`, `/leitura`, `/me`, `/mute`, `/mutes`, `/preso`, `/sujeira`, `/try`, `/unmute`) e **admin** (roda todos). Quem é o quê é decidido pelo ticket com que a pessoa entra; veja [Acesso, tickets e perfis](#acesso-tickets-e-perfis). Um comando novo é só de admin até entrar na lista.

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

## Resumo de todos os comandos

| Comando | Para que serve | Quem é afetado | Quem pode usar | Seção |
| --- | --- | --- | --- | --- |
| `/admin` | Vira administrador, até sair do servidor, apresentando um ticket de admin depois de já estar dentro | só você | jogador e admin | Ajuda e painéis |
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
| `/cozinhar` | Junto de um fogo (cozinha), de um secador de açougueiro (seca) ou de um defumador (defuma), troca toda a comida que o lugar sabe fazer e que você leva pela comida pronta, uma por uma | o jogador | jogador e admin | Personagem |
| `/creator` | Abre o **criador de personagem**: uma tela do mod, à direita, com o corpo do jogador filmado de frente à esquerda | o jogador (`camera` é só do admin) | jogador e admin | Personagem |
| `/do` | Descreve a **cena** ou um detalhe dela (o que o ambiente mostra, o que se ouve, como está a porta): `/do A porta range ao abrir` | quem está a 30 m | jogador e admin | Personagem |
| `/faccao` | (admin) Mostra as facções e quantos jogadores juraram a cada uma, ou muda a facção de um jogador (`definir`, `limpar`) | o jogador citado | só admin | Personagem |
| `/fome` | Diz como está o seu estômago (bem alimentado, com fome, faminto) e o nível da fome do servidor | o jogador; o nível vale para todos | jogador e admin | Personagem |
| `/give` | Coloca itens no seu inventário, por GUID ou pelo nome exato entre aspas | só você | só admin | Personagem |
| `/guilda` | (admin) Mostra as guildas e quantos membros cada uma tem, ou muda a guilda de um jogador | o jogador citado | só admin | Personagem |
| `/leitura` | Diz o livro de habilidade que você está lendo, quanto falta e o que já começou, larga o livro (`parar`; o que você leu fica guardado) e, para o admin, ajusta o ritmo da leitura (`fator`) | o jogador; o admin ajusta o ritmo de todos | jogador e admin | Personagem |
| `/lookalike` | Veste o mesmo visual (rosto, cabelo, barba, corpo) que outro jogador está usando | só você | só admin | Personagem |
| `/me` | Escreve no chat o que o **seu personagem faz**, em terceira pessoa, com o nome que os outros conhecem dele (quem ainda não foi apresentado vê "Desconhecido") | quem está a 30 m | jogador e admin | Personagem |
| `/outfit` | Veste um dos conjuntos de roupa do próprio jogo para o seu gênero (`random`, por nome, `list [filtro]`) | só você | só admin | Personagem |
| `/posicao` | Mostra onde um jogador nasce na próxima vez que entrar, ou apaga esse lugar com `limpar` | o jogador indicado (`@jogador`) | só admin | Personagem |
| `/preso` | **Fiquei preso**: leva você à igreja mais próxima de onde está, **uma vez a cada 60 minutos**, se o personagem ficou preso numa parede, numa pedra ou numa casa trancada | o jogador | jogador e admin | Personagem |
| `/socialstatus` | Lê ou define o **Status Socialis** (`plebeius` ou `nobilis`) mostrado no painel | você ou outro jogador (`@jogador`) | só admin | Personagem |
| `/sujeira` | Diz quanto o seu corpo está sujo, como o jogo o lê (a **sujeira**, o **cheiro** e o **sangue**), com a escala do próprio jogo (0,30 é um pouco, 0,60 é sujo, 0,90 é imundo) e onde se lavar | o jogador; o admin vê a de outro | jogador e admin | Personagem |
| `/take` | Tira itens do seu inventário (mesmos formatos do `/give`) | só você | só admin | Personagem |
| `/tp` | Leva você para o lado de outro jogador (nome ou slot, o número da lista da tecla Tab) ou para uma coordenada do mapa | só você | só admin | Personagem |
| `/try` | **Tenta** uma ação: ela dá certo ou falha ao acaso (50%), e quem está por perto vê o resultado: `/try arrombar a porta` | quem está a 30 m | jogador e admin | Personagem |
| `/dice` | Convida um oponente próximo para jogar dados e combinar a pontuação alvo (padrão 2000, passos de 500, de 100 a 100000) | você e outro jogador, perto de uma mesa de dados | jogador e admin | Voz e jogos entre jogadores |
| `/mute` | Silencia, só para você, a voz de outro jogador | só você | jogador e admin | Voz e jogos entre jogadores |
| `/mutes` | Lista os jogadores que você silenciou | só você | jogador e admin | Voz e jogos entre jogadores |
| `/unmute` | Volta a ouvir um jogador que você silenciou | só você | jogador e admin | Voz e jogos entre jogadores |
| `/animals` | Controla as populações de animais dos pontos de spawn do nível | seu mundo virtual | só admin | Mundo e ambiente |
| `/area` | Lista as áreas do nível (e as criadas por script) ao seu redor e as portas que uma área liga | só leitura | só admin | Mundo e ambiente |
| `/clima` | Mostra o dia, a hora, se é dia ou noite e quanto falta para virar, e o clima | **todos os jogadores** | só admin | Mundo e ambiente |
| `/door` | Lê (`near`, `list`), tranca, destranca, abre e fecha as portas do próprio nível, por GUID ou a mais próxima | estado compartilhado (todos veem) | só admin | Mundo e ambiente |
| `/gate` | Abre e fecha os portões de castelo: pontes levadiças, grades e portões de fortaleza (`toggle`, `open`, `close`, `list`) | estado compartilhado (todos veem) | só admin | Mundo e ambiente |
| `/herbs` | Controla a rebrota das ervas: `time` (em segundos reais na velocidade atual do mundo; `0 0` desliga a rebrota por tempo), `defaults`, `respawn [raio]` e `respawn-all` refazem ervas já colhidas | `time`/`defaults`: servidor inteiro; `respawn`: seu mundo virtual | só admin | Mundo e ambiente |
| `/tesouros` | (admin) Os **baús de tesouro** espalhados pelo mapa: `abastecer` (enche agora), `ligar`/`desligar` e `chance <n>` | o mundo | só admin | Mundo e ambiente |
| `/world` | Lê e define o relógio e o clima compartilhados: `scale` (velocidade do tempo, 0 a 200), `hour`, `day`, `weather` (predefinição e duração em segundos, até 21600), `rain` e `wind` (m/s, até 50) | **todos os jogadores** | só admin | Mundo e ambiente |
| `/blip` | Cria um ponto na bússola e no mapa de todos (ou só no seu, com `me`) | todos no mundo virtual (ou só você com `me`) | só admin | Objetos, marcadores e efeitos |
| `/build` | Como o `/prop`, mas o objeto é colocado onde você mira, com pré-visualização ao vivo | todos veem | só admin | Objetos, marcadores e efeitos |
| `/builder` | Liga ou desliga o seu acesso ao World Builder, o editor de mapas (tecla F7) | só você | só admin | Objetos, marcadores e efeitos |
| `/carry` | Faz você carregar um item nos braços (cesta, lenha, saco) ou deixa um no chão para ser pego pelo prompt do jogo (`prop`) | você | só admin | Objetos, marcadores e efeitos |
| `/chave` | Tranca ou destranca a porta, ou o baú, à sua frente se você tiver a chave dele no inventário | a porta ou o baú à sua frente | jogador e admin | Objetos, marcadores e efeitos |
| `/drop` | Deixa uma pilha de um item no chão, para qualquer um pegar | todos veem | só admin | Objetos, marcadores e efeitos |
| `/marker` | Coloca marcadores no mundo: um decalque projetado no chão ou uma forma (cilindro, esfera, seta, cubo, plano) com cor, tamanho, giro, flutuação e gatilho | todos veem | só admin | Objetos, marcadores e efeitos |
| `/prop` | Coloca no mundo uma peça do catálogo de objetos do jogo, construída em todos os clientes | todos veem | só admin | Objetos, marcadores e efeitos |
| `/propriedade` | Mapeia e administra as **propriedades**: casas, oficinas, tavernas e baús, cada uma com um nome, uma região, uma descrição, um dono e uma chave própria (um item novo, `kcdc-property:<id>`) | as portas e baús da propriedade; quem tem a chave destranca | só admin | Objetos, marcadores e efeitos |
| `/stash` | Baús: abre um estoque virtual só seu (`virtual`), cria contêineres e lê, tranca e destranca os baús do próprio nível (`near`, `lock`, `unlock`, `pick`, `key`, `goto`) | você / baús do mundo | só admin | Objetos, marcadores e efeitos |
| `/vfx` | Coloca efeitos de partículas das bibliotecas do jogo, fixos (`/vfx <efeito>`) ou de um disparo só (`burst`) | todos veem | só admin | Objetos, marcadores e efeitos |
| `/alforje` | Abre as **alforjes** do seu cavalo, para guardar e pegar coisas, estando a até 8 m dele (parado e sem cavaleiro) | o seu cavalo | jogador e admin | Montarias, cães e carroças |
| `/cachorro` | O cão de quem apoia o servidor: chama o seu cão para perto (se ele sumiu, vem de novo), dá um nome (`nome <nome>`, até 24 letras; sem nome ele volta ao nome do jogo) e manda seguir ou esperar (`seguir`, `esperar`) | o seu cão | jogador e admin | Montarias, cães e carroças |
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
| `/mestres` | Lista os **barbeiros** e os **mestres que ensinam habilidades** (esgrima, caça, luta, alquimia e outras), onde cada um fica e o que ensina, e leva você até um deles (`ir <id>`) | os barbeiros e os mestres; só admin lista e visita | só admin | NPCs, animações e conversas |
| `/npc` | Cria NPCs do servidor por papel (`roles`) ou alma e dá ordens: seguir, patrulhar, vir, esperar (`hold`), falar (`say`), trocar a locomoção (`native` é a do jogo, `kinematic` é movida pelo servidor), `kill\|revive`, `pin\|unpin`, `remove\|clear` | servidor (todos veem) | só admin | NPCs, animações e conversas |
| `/npcdemo` | Arranjos prontos de NPCs: caçador experimental, posto de guarda, patrulha em quadrado, escolta, multidão, cena roteirizada e teste de locomoção nativa | servidor (todos veem) | só admin | NPCs, animações e conversas |
| `/patrol` | Lista as rotas do World Builder, valida uma (`validate`) e a atribui a NPCs próximos (`start`, `stop`, `status`) | servidor | só admin | NPCs, animações e conversas |
| `/quest` | Escreve uma missão no diário do jogo e a faz avançar: `give <chave> "<título>" [tipo]`, `desc`, `step` (objetivo), `done <chave> <índice>`, `state` (active, done, failed), `list`, `show`, `remove`, `clear` | só você | só admin | NPCs, animações e conversas |
| `/vendedor` | Mostra e posiciona os NPCs vendedores do servidor: cinco ofícios (ferreiro, boticário, taberneiro, caçador e alfaiate) em Suchdol, e 13 mascates, um em cada fogueira de beira de estrada do nível | os NPCs vendedores; todos veem | só admin | NPCs, animações e conversas |
| `/vendor` | Abre a tela de comércio do próprio jogo com preços definidos pelo servidor | só você | só admin | NPCs, animações e conversas |
| `/crafttest` | Teste das bancadas de ofício: confere a posição das estações de alquimia e ferraria (`alchemy`, `smithing`), dá ingredientes de teste e ensina as receitas | só você | só admin | Ofícios e itens |
| `/customitems` | Prepara itens personalizados para teste | só você | só admin | Ofícios e itens |
| `/pot` | Panelões de comida: inspeciona (`/pot`), lista receitas, reabastece gastando comida do inventário (`refill porridge\|vegetable\|meat`), lista os seus venenos e envenena (`poison <linha>`) | panelão próximo | só admin | Ofícios e itens |
| `/siege` | Constrói, carrega e dispara trabucos e canhões (`trebuchet`, `cannon`) | servidor (todos veem) | só admin | Cerco |
| `/blipdemo` | Coloca um de cada tipo de blip ao seu redor, mais um que gira, para conferir a bússola e o mapa | todos no mundo virtual | só admin | Diversão e testes |
| `/disguise` | Desenha você, ou outro jogador, como um objeto do catálogo (`barrel_a`, `crate_box_a`...) | você ou outro jogador (`@jogador`) | só admin | Diversão e testes |
| `/invisible` | Para de desenhar você, ou outro jogador, em qualquer lugar: corpo, roupas e o que está na mão | você ou outro jogador (`@jogador`) | só admin | Diversão e testes |
| `/pick` | Traça uma linha da sua mira e diz o que ela encontrou, inclusive qual jogador, disfarçado ou não | só você | só admin | Diversão e testes |

## Ajuda e painéis

### `/admin`

Vira administrador, até sair do servidor, apresentando um ticket de admin depois de já estar dentro. É o caminho para quem entra pelo menu do jogo, que não tem campo para o ticket. O ticket é conferido como na entrada, com o mesmo limite de 8 erros por endereço em 10 minutos.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** só você
- **Nota:** O que você digita aparece no seu chat, na sua tela: cuidado ao gravar ou transmitir. Um ticket de jogador não muda nada.
- **Código:** `src/server/commands/admin.ts`, com apoio em `src/server/auth.ts`, `src/server/status.ts`
- **Para ler mais** (pasta `docs/guides`): `Tutorials/command-system.md`

```text
/admin <ticket>  -- o ticket de admin, inteiro, no formato nome.segredo
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
- **Nota:** **Só admin**, como a tecla F4: o painel mostra a lista de jogadores e de comandos do servidor. O servidor decide (`src/server/panel.ts`), não o cliente.
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

(admin) Mostra as cidades e quantos cidadãos cada uma tem, ou define a cidadania de um jogador (`definir`, `limpar`, `ver`). O jogador escolhe a sua na seção **Cidadania** do painel.

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** Cidades: Suchdol, Raborsch e Malešov. Quem é cidadão acorda na sua cidade quando morre; sem cidadania, acorda nas igrejas. A escolha é definitiva: só o senhor das terras (o jogador a quem a região foi cedida) a depõe, na mesma seção.
- **Código:** `src/server/commands/cidadania.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/citizenship.ts`, `src/server/players.ts`
- **No jogador:** `player.steamId`

```text
/cidadania  -- as cidades e quantos cidadãos cada uma tem
/cidadania ver <jogador>  -- a cidade dele
/cidadania definir <jogador> <cidade>  -- faz dele cidadão da cidade (suchdol, raborsch, malesov)
/cidadania limpar <jogador>  -- tira a cidadania, para que ele escolha de novo
```

### `/cozinhar`

Junto de um fogo (cozinha), de um secador de açougueiro (seca) ou de um defumador (defuma), troca toda a comida que o lugar sabe fazer e que você leva pela comida pronta, uma por uma. O **Usar** do inventário numa carne ou peixe crus faz o mesmo para o monte em que você apertou. Junto do lugar também aparece a dica **Cozinhar / Secar / Defumar** na tecla de interação, que abre um menu **Cozinhar ou Sair** e, em **Cozinhar**, a lista do que você leva que o lugar sabe fazer (uma escolha para cada comida e uma para tudo).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador
- **Nota:** O cozinhar, secar e defumar do jogo acontecem na máquina do jogador e o multiplayer não os leva ao servidor, então a carne crua ficava e a pronta nunca chegava à bolsa. Veja [Cozinhar, secar e defumar](#cozinhar-secar-e-defumar).
- **Código:** `src/server/commands/cozinhar.ts`, com apoio em `src/server/cooking.ts`
- **Para ler mais** (pasta `docs/guides`): `Players/inventory.md`

```text
/cozinhar  -- no fogo, tudo o que é cru vira cozido; no secador, o que pode virar seco; no defumador, o defumado. O "Usar" de uma carne ou peixe no inventário faz o mesmo para o monte em que você apertou
```

### `/creator`

Abre o **criador de personagem**: uma tela do mod, à direita, com o corpo do jogador filmado de frente à esquerda. Escolhe-se o sexo (**Vir** ou **Femina**), o cabelo e a cor (círculos), o rosto, a barba, a pele, o **primeiro nome** e, se quiser, uma **alcunha**; **Salvar e criar** guarda tudo por Steam ID em `playerdata/characters.json`. `nativo` abre o criador do próprio jogo, que não tem nome nem alcunha; `stop` fecha o criador aberto; `camera` (admin) ajusta o enquadramento sem novo deploy.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o jogador (`camera` é só do admin)
- **Nota:** **Quem entra pela primeira vez é obrigado a criar o personagem e dar um nome**: a tela abre sozinha (`src/server/first-join.ts`), sem botão de fechar e sem Esc, e o `stop` é recusado. Quem já tem personagem abre pelo `/creator` e sai quando quiser: o visual volta ao que era. Veja a seção [Criação de personagem](#criação-de-personagem).
- **Código:** `src/server/commands/creator.ts`, com apoio em `src/server/characters.ts`, `src/server/creator.ts`, `src/server/auth.ts`, `src/server/kits.ts`
- **No jogador:** `player.emit`, `player.steamId`, `player.setAppearance`
- **Para ler mais** (pasta `docs/guides`): `User interface/character-creator.md`, `User interface/web-views.md`, `Client scripting/camera-shots.md`, `Players/appearance.md`

```text
/creator [male|female|both]
/creator nativo [male|female|both]
/creator stop
/creator camera [distancia] [figura] [fov] [altura] [luz]  (admin)
/creator camera padrao  (admin)
```

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

### `/faccao`

(admin) Mostra as facções e quantos jogadores juraram a cada uma, ou muda a facção de um jogador (`definir`, `limpar`). **O juramento de lealdade é definitivo** para o jogador: na seção Facções do painel, depois de escolhida, os outros botões ficam apagados e só um administrador desfaz o juramento (`limpar`).

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** É o mesmo remédio que `/guilda` para a guilda. A escolha pede uma confirmação no painel antes de valer.
- **Código:** `src/server/commands/faccao.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/players.ts`, `src/server/status.ts`
- **No jogador:** `player.steamId`

```text
/faccao  -- as facções
/faccao ver <jogador>  -- a facção dele
/faccao definir <jogador> <facção>  -- põe o jogador na facção (id ou parte do nome)
/faccao limpar <jogador>  -- tira a lealdade, para que ele jure de novo
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

(admin) Mostra as guildas e quantos membros cada uma tem, ou muda a guilda de um jogador. **A escolha da guilda é definitiva** para o jogador: só um administrador desfaz (`limpar`).

- **Quem pode usar:** só admin
- **Quem é afetado:** o jogador citado
- **Nota:** A seção Guildas do painel também tem **Ver membros**: a lista da guilda na ordem da hierarquia do reino, dez por página, com os nomes que o jogador pode ler.
- **Código:** `src/server/commands/guilda.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/players.ts`, `src/server/status.ts`
- **No jogador:** `player.steamId`

```text
/guilda  -- as guildas e quantos membros cada uma tem
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
- **Código:** `src/server/commands/animals.ts`, com apoio em `src/server/animals.ts`, `src/server/place.ts`, `src/server/village-pets.ts`
- **API do motor que usa:** `Npc.animalSpawnpoints`, `Navigation.ready`
- **No jogador:** `player.position`, `player.virtualWorld`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/animals.md`, `NPCs and animals/navigation.md`

```text
/animals list
/animals start <spawnpointGuid>
/animals stop
/animals status
/animals max <0-2000>
/animals vila [ligar|desligar]  -- os cães e gatos das vilas: quantos há e onde, ou ligar e desligar
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

(admin) Os **baús de tesouro** espalhados pelo mapa: `abastecer` (enche agora), `ligar`/`desligar` e `chance <n>`. Cerca de 40% dos baús do nível passam a ter saque de verdade (comida, minérios, receitas, armas e armaduras), melhor quanto mais longe das vilas e mais difícil a tranca.

- **Quem pode usar:** só admin
- **Quem é afetado:** o mundo
- **Nota:** Um baú esvaziado volta a encher depois de 1 hora. Os baús de casas e de acampamentos de bandidos não entram.
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

Tranca ou destranca a porta, ou o baú, à sua frente se você tiver a chave dele no inventário. Numa casa com mais de uma porta (a entrada e o depósito), todas mudam juntas. É o que dá serventia à chave que o admin entrega.

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

### `/propriedade`

Mapeia e administra as **propriedades**: casas, oficinas, tavernas e baús, cada uma com um nome, uma região, uma descrição, um dono e uma chave própria (um item novo, `kcdc-property:<id>`). **`mapear suchdol` (ou `wysoka`, `raborsch`, ou qualquer lugar que `locais` lista) cataloga tudo sozinho** (o servidor já conhece cada porta, cada baú e quais portas são de qual edifício); isso também roda sozinho na primeira vez que o servidor sobe. `perto` lista o que há ao seu redor com a distância, `organizar` põe os baús e as portas soltos (que o mapeamento deixou fora das casas) para dentro da propriedade mais perto (até 35 m; um baú com o nome de um lugar, como (Taverna), até 75 m; só os que não têm dono, chave nem tranca própria), `ir` leva você até uma propriedade, `renomear` troca o nome, `trancar` e `destrancar` mexem na tranca, `castelo [região]` junta as portas e os baús dentro das muralhas num só imóvel (Suchdol e Raborsch; também roda sozinho a cada início). `registrar` cria uma propriedade à mão, na porta à sua frente. `regiao <id> <nome>` põe a propriedade e os baús dela numa região (é assim que as regiões nascem), `descricao <id> "<texto>"` escreve a descrição e `dono <id> [@jogador]` entrega a propriedade (o dono e as chaves da casa e dos baús; `dono <id> nenhum` tira). As propriedades aparecem na seção **Chaves** do painel (todas, para o admin) e na seção **Propriedades** (as do próprio jogador). Salvo em `playerdata/properties.json`.

- **Quem pode usar:** só admin
- **Quem é afetado:** as portas e baús da propriedade; quem tem a chave destranca
- **Nota:** A tranca é do **servidor**, não do jogo: toda porta e todo baú de uma propriedade fica destrancado no mundo e o jogo só oferece ali o seu **Abrir**; o que esse aperto faz é decidido pelo servidor, que abre um **menu** (Abrir, Destrancar, Trancar, a propriedade inteira, Arrombar, Sair: veja [Fechaduras](#fechaduras-e-na-porta-e-o-painel)). Uma propriedade que o mapeamento catalogou segue a tranca do próprio nível (as casas de NPCs e as do cenário são trancadas pelo jogo) até alguém a trancar **de propósito** (o menu, o painel, `/chave`, `registrar`); daí em diante o servidor a mantém assim, e ela volta trancada depois de cada reinício. **Destrancar e Trancar, no mundo, pedem a chave da propriedade** (o item) ou serem do admin; o dono não é exceção: pega as chaves no painel, uma de cada vez, porque ninguém recebe chaves junto com uma propriedade. Pelo painel, o dono e o admin trancam e destrancam sem chave. `/chave` também funciona perto do baú.
- **Código:** `src/server/commands/properties.ts`, com apoio em `src/server/args.ts`, `src/server/players.ts`, `src/server/property-menu.ts`, `src/server/properties.ts`, `src/server/properties.ts`
- **No jogador:** `player.position`, `player.teleport`
- **Para ler mais** (pasta `docs/guides`): `World/doors-and-gates.md`, `Players/custom-items.md`

```text
/propriedade mapear <região> [portas]  -- cataloga sozinho os edifícios e baús da região (suchdol, wysoka, raborsch, ou um lugar do mapa); 'portas' inclui portas soltas
/propriedade locais  -- os lugares que o mapa do jogo nomeia, para mapear
/propriedade castelo [região]  -- junta as portas e os baús dentro das muralhas num só imóvel, o castelo (suchdol, raborsch); sem região, todos
/propriedade organizar  -- põe os baús e as portas soltos para dentro da propriedade mais perto (até 35 m; um baú com o nome de um lugar, como (Taverna), até 75 m)
/propriedade perto [metros]  -- o que há perto de você, com a distância
/propriedade ir <id>  -- leva você até a propriedade
/propriedade renomear <id> "<nome>"
/propriedade regiao <id> <nome da região>  -- põe a propriedade (e os baús dela) numa região; é assim que as regiões nascem
/propriedade descricao <id> "<texto>"
/propriedade dono <id> [@jogador]  -- o jogador (você, se omitido) vira o dono e recebe as chaves da propriedade
/propriedade dono <id> nenhum  -- tira o dono (as chaves entregues continuam com quem as tem)
/propriedade regioes  -- as regiões que já existem
/propriedade trancar <id>  |  /propriedade destrancar <id>
/propriedade olhar [ligar|desligar]  -- a trava ao olhar: a porta que o menu vai abrir fica trancada no mundo enquanto o jogador olha para ela, para o boneco não abrir e fechar a porta antes do menu (desligue se alguma porta ficar estranha)
/propriedade registrar "<nome>" [região]  -- a porta mais próxima vira essa propriedade, trancada
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

## Montarias, cães e carroças

### `/alforje`

Abre as **alforjes** do seu cavalo, para guardar e pegar coisas, estando a até 8 m dele (parado e sem cavaleiro). Também há o botão **Alforjes** na seção Animais do painel.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o seu cavalo
- **Nota:** O jogo não deixa o servidor mexer na bolsa do cavalo: as alforjes são um baú virtual que o servidor guarda junto com o cavalo (`horses.json`). Se o cavalo morre, o que ele levava vai para os seus bolsos ou para o chão.
- **Código:** `src/server/commands/alforje.ts`, com apoio em `src/server/horse-bags.ts`, `src/server/horses.ts`
- **No jogador:** `player.steamId`
- **Para ler mais** (pasta `docs/guides`): `Players/inventory.md`

```text
/alforje  -- abre as alforjes do seu cavalo mais próximo (a até 8 m)
/alforje <nome do cavalo>  -- as alforjes do cavalo com esse nome
```

### `/cachorro`

O cão de quem apoia o servidor: chama o seu cão para perto (se ele sumiu, vem de novo), dá um nome (`nome <nome>`, até 24 letras; sem nome ele volta ao nome do jogo) e manda seguir ou esperar (`seguir`, `esperar`).

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** o seu cão
- **Nota:** Só para apoiadores: o cão vem com os benefícios que o admin entrega na seção Jogadores do painel e volta sozinho a cada entrada. Veja [Apoiador](#apoiador).
- **Código:** `src/server/commands/cachorro.ts`, com apoio em `src/server/args.ts`, `src/server/supporters.ts`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/dogs.md`

```text
/cachorro  -- chama o seu cão (se ele sumiu, vem de novo)
/cachorro nome <nome>  -- dá um nome ao cão (até 24 letras); sem nome, ele volta ao nome de antes
/cachorro <seguir|esperar>  -- manda o cão seguir você ou esperar onde está
```

### `/carroca`

As suas **carroças**: onde estão, `trazer` (a vazia vem para a sua frente, a cada 2 minutos), `nome` (dar nome). O admin `dar`, `registrar`, `listar` e `liberar`. Também há a seção **Animais** do painel, com o brasão da carroça, o botão **Trazer até mim**, **Dar nome** e **Deixar livre / Trancar**. A tecla **E** diante da carroça abre a escolha do assento.

- **Quem pode usar:** jogador e admin
- **Quem é afetado:** as suas carroças
- **Nota:** Trancada (o padrão), só o dono e os administradores sobem; **livre**, qualquer jogador sobe e conduz. A carroça fica onde for deixada, com o dono e o nome, e volta ao mundo depois de uma reinicialização. O comando também responde por `/carroça`.
- **Código:** `src/server/commands/carroca.ts`, com apoio em `src/server/acquaintances.ts`, `src/server/auth.ts`, `src/server/carts.ts`, `src/server/horses.ts`, `src/server/players.ts`
- **No jogador:** `player.steamId`, `player.record`
- **Para ler mais** (pasta `docs/guides`): `World/carts.md`

```text
/carroca  -- as suas carroças e onde estão
/carroca trazer [n]  -- a carroça vazia vem para a sua frente (de dois em dois minutos)
/carroca nome [n] <nome>  -- dá nome à carroça (sem nome, volta ao comum)
/carroca dar <jogador> [modelo]  -- (admin) uma carroça nova para o jogador
/carroca registrar <jogador>  -- (admin) a carroça sem dono ao lado do jogador passa a ser dele
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
- **Nota:** Os cavalos com dono são guardados: veja [O que é salvo e o que não é](#o-que-é-salvo-e-o-que-não-é).
- **Código:** `src/server/commands/cavalo.ts`, com apoio em `src/server/auth.ts`, `src/server/horses.ts`, `src/server/horses.ts`
- **No jogador:** `player.position`, `player.steamId`
- **Para ler mais** (pasta `docs/guides`): `NPCs and animals/horses.md`, `NPCs and animals/horse-owners.md`

```text
/cavalo  -- onde estão os seus cavalos
/cavalo chamar  -- o seu cavalo vem correndo, se estiver a até 300 m
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
/bandidos agressividade [baixa|media|alta]  -- o quanto os bandidos veem de longe, batem forte e perseguem (sem argumento mostra a atual)
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

Lista os **barbeiros** e os **mestres que ensinam habilidades** (esgrima, caça, luta, alquimia e outras), onde cada um fica e o que ensina, e leva você até um deles (`ir <id>`). O texto filtra pelo nome, pelo id ou pela habilidade: `/mestres espadas`.

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

Mostra e posiciona os NPCs vendedores do servidor: cinco ofícios (ferreiro, boticário, taberneiro, caçador e alfaiate) em Suchdol, e 13 mascates, um em cada fogueira de beira de estrada do nível. `listar` diz onde fica o lugar de cada um, a casa onde mora, quanto tem na bolsa e o que está fazendo agora; `aqui <id>` leva o vendedor para onde você está, virado como você, e o lugar escolhido passa a ser o dele; `reabastecer` enche as prateleiras e `padrao` devolve todos aos lugares originais.

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

## Ofícios e itens

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
| `V` | Falar (push-to-talk). O cliente é colocado em push-to-talk nesta tecla a cada entrada | `src/client/voice.ts` |
| `F4` | Painel de debug do gamemode (mesmo que `/ui`). **Só admin**: a tecla pede ao servidor, que abre o painel para admin e responde com uma linha no chat para os outros | `src/client/index.ts` e `src/server/panel.ts` |
| `Tab` | **Desligada para todos** (`mod.scoreboard: false` no `server.json`): é uma opção do servidor inteiro, não dá para ligar só para o admin. A lista de jogadores do admin está no painel, seção **Jogadores** | `server.json` |
| `E` olhando para outro jogador | **Conversar**: abre a lista de diálogo do jogo com Apresentar-se, Jogar dados, Negociar e Sair (é a tecla de interação do jogo, a que o jogador tiver configurado). Veja [Encontros entre jogadores](#encontros-entre-jogadores) | `src/client/property-labels.ts` e `src/server/encounters.ts` |
| `E` numa porta ou baú de uma propriedade | **Abrir**, a única opção que o jogo oferece ali (numa porta aberta, **Fechar**); numa porta que o servidor travou enquanto você a olha (a **trava ao olhar**, veja [Fechaduras](#fechaduras-e-na-porta-e-o-painel)), o jogo não oferece nada e o **Abrir** é o do mod, o mesmo desenho e a mesma tecla. Numa porta ou baú aberto, para quem não tem a chave, abre como em qualquer lugar; numa trancada, ou para quem tem a chave, abre o **menu**: Abrir, Destrancar, Trancar, a propriedade inteira, Arrombar e Sair. De dentro de uma casa trancada o jogo abre a porta direto, sem menu | `src/client/property-labels.ts` e `src/server/property-menu.ts` |
| `Esc`, `F2` ou `F3` com a câmera livre ligada, ou o botão **Sair da câmera** | `Esc`, `F2` e o botão voltam à câmera normal; `F3` também, e abre o painel da administração (`F2`, o comum); de qualquer jeito, ela volta sozinha em 5 minutos. Quem ouve as teclas é uma página do mod (`ui/freecam.html`), porque o voo pronto do jogo engole todas | `src/client/camera.ts`, `ui-src/freecam.html` |
| `W` `A` `S` `D`, `Espaço`, `Ctrl`, `Shift`, `Alt`, as **setas**, o mouse arrastado e `H` na câmera livre | `W A S D` voam, `Espaço` sobe, `Ctrl` desce, `Shift` acelera, `Alt` vai devagar; as **setas** e o mouse arrastado viram a câmera; `H` mostra de novo a ajuda e o botão de sair, que somem sozinhos depois de 9 segundos (e voltam quando o ponteiro se mexe) | `ui-src/freecam.html` |
| `X` | **Assobio**: o cavalo do jogador mais perto vem correndo, o mesmo que **Chamar** no painel (o assobio do jogo chama um cavalo que no multiplayer ninguém tem; o mod ouve a tecla). Montado no próprio cavalo, ou sem cavalo, não acontece nada. **No inventário (o menu de pausa) vale**: é de lá que o jogador chama o cavalo para guardar itens nele (pedido de 16/10/2026). **Não vale** nas telas do jogo em que o X confirma (seleção de itens, troca, livro, tela de pular o tempo, arrombamento, roubo, a inspeção do cavalo), nem numa conversa, com um livro aberto ou com uma página do mod no teclado: um **X** apertado para confirmar numa dessas telas não chama o cavalo | `src/client/whistle.ts` e `src/server/horses.ts` |
| `T` | Abre o chat | cliente do jogo |
| `F7` | World Builder, depois de `/builder` | framework |
| `U` (segurar 1 s) | Oferece a paz para encerrar um combate | `src/server/combat.ts` e `src/client/combat.ts` |
| `F9` | Desconecta do servidor | cliente do jogo |
| `G`, `R`, `Backspace` | Só no criador **do próprio jogo** (`/creator nativo`): trocar gênero, visual aleatório e voltar ao visual de abertura | framework |
| Mouse e `Esc` no criador de personagem | Arrastar à esquerda gira a câmera em volta do personagem, a roda do mouse aproxima e afasta; `Esc` fecha uma lista aberta e, para quem já tem personagem, pergunta se quer sair (**quem entra pela primeira vez não pode sair**) | `ui-src/creator.html` |

> **Por que `F2` e `F3`.** O painel morava no `U`, que é do jogo: segurar `U` por 1 segundo perto de um oponente em luta oferece a paz (`Offer to end combat`). Depois ele foi pedido na vírgula e no ponto, mas o mod (KCDC 1.6.9) não aceita nenhuma tecla de pontuação: `Key.bind` só conhece letras, números, `F1` a `F12`, setas, modificadoras, teclas de edição, teclado numérico e botões do mouse, e recusa `comma` e `period`. As setas, que ficaram no lugar por um dia, também andam com o personagem no KCD2. Nos mapas de teclas do próprio jogo (`Libs/Config/defaultProfile.xml` e `keybindSuperactions.xml`, dentro de `Data/IPL_GameData.pak`), o `F2` não faz nada e o `F3` só existe no mapa de debug, desligado no jogo normal. Entre os controles do mod, o `F2` só seria do `kcdc-playground`, que não está instalado.

As demais ações do mod (roda de emotes, grupo, interação com NPC, alcance da voz: sussurro, normal e grito) ficam em **Controles → Multiplayer** no jogo.

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
| Classe social, guilda e facção | `status.ts` (catálogos e persistência em `playerdata/social.json`), `/socialstatus`, painel com as abas Personagem, Guildas e Facções |
| Casas e propriedades | `/propriedade mapear` (cataloga sozinho as casas e os baús), seção Chaves do painel, `/chave`; `/door` e `/stash` para ajustes pontuais; `/marker` e `/blip` para sinalizar |
| Comércio | Os cinco vendedores do servidor (`vendors.ts`, `/vendedor`); entre jogadores, a negociação do menu de conversa (`trade.ts`); `/vendor`, API `Vendor`, `/customitems vendor` e o tutorial `Tutorials/market-stall.md` para o resto |
| Quem é quem | Nomes escondidos e apresentações (`encounters.ts`, `acquaintances.ts`): cada um só vê o nome de quem se apresentou a ele |
| Ofícios | Kits e livros de receita (`kits.ts`, `books.ts`), `/crafttest` (alquimia e ferraria), `/pot`, ervas (`/herbs`, `World/gathering.md`) |
| Transporte | `/horse` e `/cavalo` (cavalos com dono são guardados: `horses.ts`), `/cart`, `/dog` |
| Voz e imersão | `V` para falar; alcance por jogador (`Voice.setPlayerRange`); sussurro, normal e grito (`Voice.setTier`); `/mute` |
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

**Só contas Steam entram na lista.** O personagem é guardado pelo Steam ID, e o servidor só recebe do jogo, de quem o comprou na GOG, nenhum identificador; de quem usa a Epic, um id que o resto do mod não usa. Essas contas são recusadas como as que não estão na lista, até o mod aprender a guardar os personagens por outra chave. **Comece pondo o seu próprio Steam ID na lista, antes de ligar o bloqueio**, ou você mesmo fica de fora. **Estado atual (16/10/2026, a pedido: *desativar por enquanto, até eu conseguir configurar 100%*): o bloqueio está DESLIGADO** (`"enforce": false` em `secrets/whitelist.json`; `kcdc-whitelist list` diz `bloqueio: desligado`): entra quem souber a senha, e o log só anota quem a lista teria recusado. As 4 contas que já jogaram estão na lista. O comando `whitelist` do console, que valia só até o servidor parar, deixou de existir.

### Quem pode o quê

| Perfil | Comandos |
| --- | --- |
| Jogador | `/admin`, `/alforje`, `/anim`, `/cachorro`, `/camera`, `/cansaco`, `/carroca`, `/cavalo`, `/chave`, `/cozinhar`, `/creator`, `/dice`, `/do`, `/face`, `/fome`, `/help`, `/idioma`, `/language`, `/leitura`, `/me`, `/mute`, `/mutes`, `/preso`, `/sujeira`, `/try`, `/unmute` |
| Admin | Todos os 79 |

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

As pastas `stream/` e `replace/` de um recurso (modelos, sons, texturas do jogo) seguem outro caminho, os *asset paks*, e não entram nesse pacote; mas eles servem para arte do próprio jogo, não para as imagens de uma página da interface.

## Seções do painel

O painel abre com o **F2** na categoria **Comum**, para todos, e com o **F3** na categoria **Administração**, só para admin; é a mesma página, mostrando uma categoria de cada vez (cliente em `src/client/status.ts`, página em `ui-src/status.html`, empacotada em `ui/status.html`, servidor em `src/server/status.ts`). Quem decide quem é admin é o servidor, pelo perfil do ticket; a página só esconde o que não é do jogador, e o servidor confere o perfil de novo em cada pedido.

**Fechar limpa tudo.** A página só existe enquanto o painel está aberto: cada abertura cria uma página nova (escondida até terminar de desenhar) e fechar a descarta inteira, com as imagens e a memória dela, então o painel fechado não pesa no jogo. O cliente guarda só as últimas respostas do servidor (alguns KB) e a seção em que o painel estava, para a página nova abrir já preenchida e no mesmo lugar. Por isso abrir leva uma fração de segundo a mais do que antes, quando a página ficava carregada escondida.

| Seção | Categoria | O que mostra e faz | Onde fica salvo |
| --- | --- | --- | --- |
| Personagem | Comum | Nome (o que o jogador deu ao personagem no criador, com a alcunha; o apelido da conta, para um personagem feito antes do criador pedir o nome); **Titulus** (os títulos que o jogador tem, do mais alto ao mais baixo, quando tem algum); **Status Socialis** (Plebeius ou Nobilis); **Status Coniugalis** (Caelebs, solteiro; Coniugatus, casado; Viduus, viúvo; no feminino se o personagem for mulher); **Cognomen** (o sobrenome, quando há um); vida, stamina, fome e **energia**; e, à direita, abas **Guilda** e **Facção** para escolher o que fica em destaque | `playerdata/social.json`, `titles.json` |
| Guildas | Comum | As cinco guildas (Ferreiro, Caçador, Taberneiro, Alquimista e **Artesão**, que é a antiga de alfaiate; o jogo não tem ofício de alfaiate, mas tem as roupas para vender); o jogador escolhe uma e, na primeira vez em cada guilda, recebe o kit dela | `playerdata/social.json` |
| Facções | Comum | Casa do Leão Dourado e Casa do Corvo, cortadas por uma diagonal; o jogador jura lealdade a uma e ela passa a ser a sua **facção de lealdade** (não a sua casa, que é uma propriedade); na primeira vez em cada facção, recebe **as cores dela**: o manto e a gola (veja [Cores das facções](#cores-das-facções)) | `playerdata/social.json` |
| Família | Comum | Árvore genealógica por gerações, com o sobrenome da família. Cada parente pode ser marcado como **falecido**, ser **um jogador do servidor** e, sendo filho, **legítimo, adotivo ou bastardo** | `playerdata/family.json` |
| Propriedades | Comum | As casas e baús que são do jogador, agrupados por **região** (um menu filtra). Clicar numa propriedade abre à direita o brasão, o nome, a região, a descrição, o dono e o estado, **parados no alto**, e a lista **dos baús e das portas**, que é a única parte que rola (os botões ficam parados embaixo). O dono **edita o nome e a descrição**, **tranca e destranca** a casa e cada baú pelos botões, e **faz chaves** da casa e de cada baú, para si ou para outro jogador do servidor (até 8 chaves por propriedade). Uma casa com **várias portas** lista as portas sob ela, como lista os baús, cada uma com o seu botão de trancar. O dono pode **entregar a casa** a outro jogador (com confirmação). Uma **região cedida** a ele pelo admin aparece inteira: o que é dele ele mexe, o que é de um NPC ou de outro dono aparece só para ler | `playerdata/properties.json`, `regions.json` |
| Animais | Comum | Os cavalos do jogador (vida, fôlego, arreios, onde está, se está montado) e o cão, para quem apoia (o que está fazendo, a ordem e o ânimo). **Chamar**, **Dar nome** e, para o cão, **Seguir/Esperar**. Atualiza a cada 2,5 segundos enquanto a seção está aberta. Veja [Animais do jogador](#animais-do-jogador) | `horses.json`, `supporters.json` |
| Opções | Comum | **Terceira pessoa** (ligar, desligar, e a distância: perto, normal ou longe; fica salva), **Câmera livre**, para gravar e tirar fotos, e **Título sobre a cabeça** (mostrar um dos seus títulos, ou nenhum). Veja [Opções](#opções) | `playerdata/options.json`, `titles.json` |
| Nomeação | **Nobre** (só para quem é nobre, e para o admin, que nomeia como a Coroa) | Três vistas: **Nomear** (os títulos que o jogador pode dar, a lista de quem recebe e o título escolhido à direita, com confirmação), **Títulos** (os dele, quem o nomeou, e as pessoas que ele nomeou, com **Deixar o título** e **Retirar o título**) e **Ver hierarquia** (o reino todo, título por título, com os jogadores que os têm, as terras de cada um e a árvore da hierarquia). Veja [Títulos e status social](#títulos-e-status-social) | `playerdata/titles.json` |
| Chaves | Administração | Todas as propriedades, agrupadas por **região** (menu), com busca. Só aparecem as casas e os edifícios; os baús ficam dentro da casa, no detalhe à direita (os que não estão em casa nenhuma aparecem com o botão **Baús avulsos**). O detalhe mostra, parados no alto, o brasão, o nome, a região, a descrição, o dono e o estado, e só a lista dos baús e das portas rola. O admin **entrega a propriedade** a um jogador (ele vira o dono; **nenhuma chave vai junto**, ele pega as que precisar, uma de cada vez, pelo painel), tira o dono, entrega ou pega chaves, **tranca e destranca** a casa e cada baú, e edita o nome, a descrição e a região. Uma **casa de vendedor** mostra o morador (NPC) e não pode ser entregue. O **cartão da região**, sempre à vista logo acima da lista (*Ceder a região inteira a ...* ou, com *Para mim* em *Quem recebe*, *Pegar a região inteira*), vale para a região do filtro ou, sem filtro, a da propriedade escolhida, diz quantas propriedades sem dono ela tem e passa a quem foi escolhido tudo o que não tem dono nela, depois de mostrar a conta: quantas propriedades e baús passam, quantas casas de NPC e quantas de outros donos ficam | `playerdata/properties.json`, `regions.json` |
| Apoiador | Comum | A arte do nobre com o cão, a frase *Concordia parvae res crescunt* e o agradecimento, com o que o apoio dá (trajes de nobre e um cão fiel) e o botão **Apoiar**, que abre à direita o QR code do Pix, o valor e o que conferir no banco antes de pagar. Quem já apoia vê *Apoiador desde ...* | `supporters.json` |
| Jogadores | Administração | Quem está no servidor agora. Clicar num jogador abre à direita os brasões da guilda e da facção dele, o nome, o status social e civil, o sobrenome, a guilda, a facção, se é apoiador, os títulos e as quatro barras (vida, stamina, fome e **energia**), e os botões **Títulos** (os que tem, para retirar, e todo o catálogo, para dar), **Status social**, **Terras** (cede a ele uma região inteira, com a conta antes: o que passa, o que é de NPC e o que já tem dono) e **Dar benefícios** (este com Confirmar e Cancelar). Substitui a lista do `Tab`, que está desligada para todos; atualiza a cada 3 segundos enquanto a página está aberta | `supporters.json` |
| Cidadania | Comum | As três cidades (Suchdol, Raborsch e Malešov), cada uma com o brasão; ao clicar abre à direita o senhor das terras, o nome da família dele e a quantidade de cidadãos. O botão *Tornar-me cidadão* é definitivo; para o senhor das terras há *Ver cidadãos* (oito por página, com *Depor*). | `playerdata/citizenship.json` |

**O que mudou nas seções em 17/10/2026:** *Guildas* — escolha definitiva (com pergunta antes) e o botão **Ver membros**, na ordem da hierarquia; *Animais* — as carroças (brasão próprio, **Trazer até mim**, **Dar nome**) e, em cavalos e carroças, **Deixar livre / Trancar** e, nos cavalos, **Alforjes**; *Opções* — **Fiquei preso** e **Idioma / Language**; *Chaves* e *Propriedades* — a chave de **uma porta** ao lado do botão de trancar; *Jogadores* — busca por nome ou número, filtros (administradores, apoiadores, nobres, sem guilda) e páginas de 12, e as listas de "quem recebe" e de parente jogador buscam e viram páginas de 8; *Nomeação* — a árvore é desenhada em pé, a Coroa no alto; *Apoiador* — o novo brasão e o mosquete, o canhão de mão e as 10 balas no que o apoio dá. As barras de rolagem ficaram douradas, e o menu da esquerda rola quando há mais seções do que cabem.

### Família

A árvore tem sete linhas, de cima para baixo, e o jogador está sempre na do meio. Cada linha abre e fecha clicando no título; as que não têm ninguém e não são básicas (bisavós, netos, bisnetos) começam fechadas. O `+` ao fim de cada linha abre o formulário de novo parente, que só oferece os parentescos daquela linha.

| Linha | Parentescos |
| --- | --- |
| Bisavós | bisavô, bisavó |
| Avós | avô, avó |
| Pais e tios | pai, mãe, tio, tia |
| Cônjuge, irmãos e primos | esposo, esposa, irmão, irmã, primo e prima (do 1º ao 4º grau; o 1º é o primo comum) |
| Filhos e sobrinhos | filho, filha, filho adotivo, filha adotiva, filho bastardo, filha bastarda, sobrinho, sobrinha |
| Netos | neto, neta |
| Bisnetos | bisneto, bisneta |

- Cada parente é só um **parentesco e um nome** (2 a 40 letras). O jogo não trata a árvore como mecânica: ela é o relato do personagem. Cabem até 80 parentes por jogador.
- Cada parente é ligado à linha pelo parentesco, não a outro parente: um primo não precisa de um tio cadastrado antes. É por isso que a lista inclui diretamente os graus de primo.
- **Estado civil** não é escolhido: é **casado** quando a árvore tem um cônjuge vivo, ou quando outro jogador põe você como cônjuge na árvore dele; **viúvo** quando todos os cônjuges da árvore estão marcados como falecidos; solteiro caso contrário.
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
| **Ver hierarquia** | O reino todo, ramo por ramo, título por título, com os jogadores que o têm (ou *vago*). Clicar num jogador abre à direita os brasões da guilda e da facção, o nome, os títulos e quem os deu, o status social e civil, o sobrenome e as **terras** (regiões, casas e baús). Enquanto nada é escolhido, a árvore da hierarquia (a arte) enche o lado direito. Atualiza a cada 6 segundos |
| ↳ a vista da hierarquia | Uma chave de duas faces, cada uma com o seu desenho: **Árvore**, a hierarquia como uma árvore de verdade, deitada, com **A Coroa** na raiz e cada nomeado ligado a quem o nomeou (um título dado pela Coroa sai dela; um dado por um lorde sai do lorde), do mais alto ao mais baixo; encolhe sozinha quando o reino é largo; e **Lista**, a lista ramo por ramo de antes |

**O que a hierarquia não mostra**, para não quebrar o *metagaming*: onde a pessoa está, vida, fome, se está online, Steam ID, se apoia o servidor, se é admin. Só o que um personagem é **conhecido** por ser: nome, título, condição, casa, guilda, terras. Na página, cada jogador é uma chave embaralhada que muda a cada início; ela nunca recebe um Steam ID.

**Título sobre a cabeça.** Em **Opções**, **Título sobre a cabeça**: o jogador escolhe **um** dos títulos que tem (ou nenhum) para aparecer sobre a cabeça dele, em dourado, para todos, no lugar do nome que ninguém vê (os nomes continuam escondidos: veja [Encontros](#encontros-entre-jogadores)). A escolha é salva e posta de novo a cada entrada. Em **Personagem**, o **Titulus** lista todos os títulos do jogador.

**O admin e os títulos.** Em **Jogadores**, o botão **Títulos** mostra os do jogador (cada um com **Retirar**) e uma lista com todo o catálogo e **Dar título**, dado em nome da Coroa. Quem volta de nobre a plebeu (pelo status social) perde os títulos de sangue e do alto clero e **fica com os cargos**, e é avisado. Os títulos de texto livre da versão anterior foram convertidos, os que combinam com o catálogo; os outros ficaram em `playerdata/titles.legacy.json`.

**Título de sangue e plebeu não combinam, e o servidor acerta isso a cada início:** quem tem um título de sangue ou do alto clero e ainda consta como plebeu (um título dado antes da regra, ou o status mudado depois) é feito **nobre**, sozinho, e o log diz quem (`nominations: ... feito nobre`). A família dele não sobe com isso: só sobe com uma nomeação.

**Status social** (admin, em **Jogadores**): Plebeius ou Nobilis. Se o jogador tem parentes que são jogadores, o formulário mostra quem **muda junto** e deixa escolher **com a família** ou **só ele**. Mudam junto o **cônjuge vivo** e a **linha legítima** viva (filhos, netos e bisnetos), da árvore dele, e quem o põe como cônjuge na própria árvore. **Filhos adotivos, bastardos, irmãos, primos e avós não mudam.** Cada um é avisado no chat, e o painel dele muda na hora.

### Animais do jogador

A seção **Animais** (`src/server/pets.ts`) mostra um cartão por cavalo do jogador, com o brasão do cavalo, o nome, a vida e o fôlego (o jogo não tem fome de cavalo), os arreios pelo nome em português e onde ele está: *com você, montado*, *aqui, ao seu lado*, *a 120 m, a norte* ou *montado por <nome>*. **Chamar** faz o cavalo vir correndo, se estiver a até 300 m (o mesmo do `/cavalo chamar`), e **Dar nome** troca o nome (2 a 24 letras; vazio volta ao nome de antes). **Um cavalo que morre se perde**, como no jogo: some da lista e é preciso comprar outro.

O **assobio** (`X`, a tecla do próprio jogo) chama do mesmo jeito. O cavalo chamado corre por uma rota que o servidor planeja na malha de navegação (`moveTo`); cada chamado vai para o log com a rota (`horses: Mauro chamou Carpiado a 65 m; rota de 6 cantos, 84 m`: uma rota de 2 cantos é uma linha reta) e com o fim dela. Se ele **empaca no caminho** (`blocked` ou `failed`), o servidor manda de novo, do lugar onde ele parou, até 2 vezes; depois disso o dono é avisado de que ele ficou preso e em que direção.

> **Ainda não visto no jogo:** por que o cavalo vinha em linha reta sem desviar (relato de 2026-10-14). As linhas `horses:` do log dizem se a rota da malha era reta (cercas, árvores e pedras fora da malha) ou se ele empacou.

Para quem apoia, um cartão do **cão**: o que ele está fazendo (seguindo, farejando, comendo...), a ordem (seguindo você ou esperando), o **ânimo** quando o jogo já disse, e os botões **Chamar**, **Seguir/Esperar aqui** e **Dar nome** (os mesmos do `/cachorro`). O cão do jogo não morre (derrubado, ele se levanta) e o framework não dá a vida dele, então não há regra de perda para o cão.

### Opções

A seção **Opções** (`src/client/camera.ts`, guardada em `src/server/options.ts`):

- **Terceira pessoa**: a câmera atrás do personagem (a câmera do próprio mod, `Camera.setThirdPerson`), em três distâncias: **perto** (2,2 m), **normal** (3,2 m) e **longe** (4,8 m), um pouco por cima do ombro direito. Escolher uma distância já liga. A escolha fica **salva no servidor** pelo Steam ID (`playerdata/options.json`), porque o cliente do jogo não tem onde guardar nada, e é posta de novo a cada entrada. O `/camera` faz a mesma escolha.
- **Câmera livre**, para gravar e tirar fotos: o painel fecha e a câmera passa a voar, comandada por uma **página do mod** (`ui/freecam.html`): **W A S D** voam, **Espaço** (ou `E`) sobe, **Ctrl** (ou `C`, `Q`) desce, **Shift** acelera, **Alt** vai devagar, as **setas** viram a câmera (70° por segundo) e o **mouse arrastado** (botão esquerdo ou direito) também; `H` mostra de novo a ajuda, que some sozinha depois de 9 segundos para a foto sair limpa, e o ponteiro que se mexe a traz de volta. **O corpo fica parado onde está.** Enquanto ela voa, o HUD (bússola, barras, dicas, legendas...) e o chat somem, e os nomes de portas e as dicas `[E]` também. **`Esc` volta** à câmera normal, **`F2` também** e o botão vermelho **Sair da câmera**, que fica no canto; **`F3`** também, e abre o painel da administração. Morrer também tira, e a terceira pessoa volta se estava ligada. Ela **volta sozinha em 5 minutos**, com aviso 30 segundos antes. A câmera não se afasta mais de **25 m** dos olhos do personagem: uma câmera que fosse a qualquer lugar, atravessando paredes, serviria para espiar casas trancadas e acampamentos.

  **Se a página não ouvir nada** (a primeira versão lia o código de posição da tecla, `event.code`, que o navegador do jogo deixa vazio, e nenhuma tecla funcionava: 2026-10-15 à noite), ela agora lê o número e o nome da tecla (`keyCode` e `key`). E se em **6 segundos** ela não ouvir nem uma tecla nem um clique, o teclado volta ao jogo e **a câmera passa a voar pelas teclas do próprio jogo** (`W A S D`, as setas, `Espaço`/`E` e `Ctrl`/`C`/`Q`, `Shift`, `Alt`; `Esc` e `F2` saem), com um aviso na tela. O log do cliente diz em que pé está: `free camera: the page drew`, `the page hears the player (key: ...)` na primeira tecla ouvida, `the page heard nothing in 6 s; the game's keys fly it now`, e `NoClip.move refused to move the camera` se o jogo recusar o movimento.

Por que uma página: o voo pronto do jogo (as teclas do **modo foto**) engole todas as teclas, e nem o `Key.bind` nem o `Key.isDown` do mod ouviam o `Esc` nem o `F2`: um jogador ficou preso na câmera em 2026-10-14 (só o `F9`, que desconecta, tirou), e uma segunda tentativa, que perguntava as teclas a cada 100 ms, também não funcionou (2026-10-15). Agora o voo é ligado **sem** o teclado dele (`NoClip.enable({ mode: "camera", input: false })`) e uma página do mod, em foco, ouve as teclas e o mouse e diz ao cliente o que está apertado (`freecam:keys`, `freecam:look`); o cliente voa a câmera a cada 16 ms (`NoClip.move`), e a página diz `freecam:exit` no `Esc`, no `F2` e no `F3`. **Sem a página não há voo**: se ela não abre, ou não diz que desenhou em 5 segundos, a câmera nem começa (ou é desfeita) e o jogador é avisado. O limite de 5 minutos continua, e o `Esc` e o `F2` que o mod ainda consegue ouvir também valem.

> **Ainda não testado no jogo:** se a página recebe o teclado e o mouse com o voo ligado (uma página em foco recebe as teclas, `Esc` e `F2` incluídos, e é o que se espera), e se o mouse arrastado vira a câmera na medida certa (0,12 grau por pixel). Se o voo não começar, o jogo diz *a página que a comanda não abriu*; o log do cliente tem `free camera: ...`.

### Como a página e o servidor conversam

A página (CEF) fala com o script do cliente por `callEvent`, e o script repassa ao servidor por `Events.emitServer`. O servidor responde sempre com o pacote inteiro `status.social`, e a página se redesenha. Cada evento da página só segue adiante se tiver os campos certos, com os tipos certos (`relay` em `src/client/status.ts`); o servidor confere tudo de novo.

| Evento da página | Campos | Quem pode |
| --- | --- | --- |
| `status:selectGuild` | `guildId` | todos |
| `status:selectFaction` | `factionId` | todos |
| `status:selectShowcase` | `showcase` (`guild` ou `faction`) | todos |
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
| `props.use` | `guid`, `prompt` (o prompt do próprio jogo estava na tela quando o **E** foi apertado) | todos: o cliente avisou que apertou **E** perto de uma propriedade; se o jogo não disse nada em 450 ms, o servidor abre o menu da porta ou do baú; com `prompt` numa porta travada pelo olhar, solta a trava para aquele jogador |
| `props.peek` | `guid` | todos: o cliente pergunta o nome da porta ou do baú que está mirando; o servidor responde com `props.label` (`label`, `use`, e `door` quando é uma porta) |
| `props.gaze` | `guid` (vazio: o olhar saiu da porta), `released` (com o `guid` vazio: a porta de que o cliente solta a trava, porque o *Abrir* do jogo continuava na tela) | todos: o cliente diz qual porta de propriedade está sob a mira, a cada 700 ms enquanto durar; o servidor a tranca no mundo (veja *a trava ao olhar*) e responde com `props.gazed` (`guid`; vazio quando solta) |

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
| Status social, guilda, facção, aba do Personagem | `social.json` | ao escolher | ao abrir o painel |
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

**O que não é salvo** (some quando o servidor reinicia, ou nunca existiu): **o que o cavalo leva nos alforjes** (o framework não dá a um script acesso ao inventário do cavalo), cães, o baú que se forma onde alguém morre (dura 30 minutos), props e marcadores, o conteúdo de baús que não estão no catálogo de propriedades (os dos acampamentos de bandidos são reabastecidos sozinhos), o clima (um novo é sorteado a cada início), os efeitos de poções (buffs), e a **descoberta do mapa**: os pontos de interesse que o jogador descobre ficam só no cliente dele, e a API do mod só avisa quando um é descoberto (`poiDiscovered`), sem dar um jeito de marcar um como descoberto na volta.

**Itens no chão duram 30 minutos.** O que alguém larga no chão (ou um script põe lá) some depois de 30 minutos se ninguém pegar, e some também num reinício (`src/server/ground-items.ts`).

**Cavalos.** Um cavalo passa a ser guardado quando é dado a um jogador (o `/horse` do admin cria um já do autor, e `/horse give` entrega a outro). O dono pode sair: o cavalo fica onde estava, ninguém mais monta (só o dono e os admins), e volta a ser dele quando ele entra. Morreu, foi esquecido, como no jogo. `/cavalo` diz onde ele está e chama ele; `/cavalo listar` e `liberar` são do admin.

**Como o salvamento se protege.** Cada arquivo é gravado em duas etapas, com cópia da versão anterior (`.bak`), então uma queda no meio não deixa um arquivo pela metade. Cada parte só é gravada depois de ter sido devolvida: um jogador que sai antes de o jogo carregar não apaga o que estava salvo. Um inventário vazio nunca substitui um cheio. Se o arquivo do jogador não puder ser lido, ou o jogo recusar o inventário salvo, a sessão dele **não grava nada** e ele é avisado no chat; o que estava salvo continua intacto para a administração. Itens personalizados que o servidor não conhece mais (uma propriedade apagada) ficam guardados à parte e voltam quando o tipo existir de novo. O log mostra `characters: <nome>: inventário devolvido (N itens)` na entrada e `gravado (saída)` na saída.

## Criação de personagem

Quem entra pela primeira vez **cria o personagem antes de jogar**: a tela de criação abre sozinha, **não tem saída** (sem botão de fechar, sem `Esc`, e o `/creator stop` é recusado) e só fecha quando o jogador escolhe o visual e **dá um nome**. Quem já tem personagem abre a tela com `/creator` e pode sair quando quiser; o visual volta ao que era.

### O que o jogador vê

A tela é uma **página do próprio mod** (`ui-src/creator.html`, empacotada em `ui/creator.html`) no lado **direito**, com margem nos quatro lados, o canto superior esquerdo e o inferior direito dos nossos ornamentos, o bege, o vermelho e o preto do painel (F2). À esquerda fica **o corpo do próprio jogador**, filmado de frente por uma câmera do mod, com uma luz quente e uma névoa dourada sobre o mundo; o HUD e o chat somem. Arrastar na esquerda gira a câmera em volta do personagem, e a roda do mouse aproxima e afasta.

Tudo numa só aba, com os nomes em latim e o português ao lado, como no painel:

| Campo | O que é |
| --- | --- |
| **Sexus** *homem ou mulher* | **Vir** ou **Femina**. Trocar de sexo recomeça do catálogo do outro (para o jogo, o sexo é o corpo-base, e trocar mexe nos quatro números de combate que o corpo carrega: armadura base, visibilidade, furtividade e ataque desarmado, os mesmos do criador do próprio jogo) |
| **Capillus** *cabelo* e **Color** *cor* | O estilo (setas) e, **no centro, círculos com a cor**: preto, castanho escuro, castanho claro, ruivo escuro, ruivo, loiro, grafite, grisalho e branco (nem todo estilo vem em todas; os do barbeiro têm uma cor só) |
| **Facies** *rosto* | Só os rostos genéricos: nenhum feito para um personagem do jogo |
| **Barba** *só para homens* | Uma barba que o rosto escolhido pode ter, ou nenhuma (o jogo recusa o visual inteiro se o rosto não tem aquela barba) |
| **Cutis** *pele* | Catorze tons por sexo (clara, morena e romani); sem as peles de idoso, de ferido ou de afogado |
| **Nomen** *o primeiro nome* | Veja abaixo |
| **Agnomen** *alcunha, se quiser* | Veja abaixo |
| **Sortear** | Um visual ao acaso do sexo escolhido |
| **Salvar e criar** | Só abre com um nome que o servidor disse estar livre |

O que o criador oferece, pela documentação do KCDC (o servidor loga a contagem de verdade a cada início, em `creator: catálogo dos homens ... das mulheres ...`): homem, 73 rostos, 37 estilos de cabelo (18 genéricos em nove cores, 16 do barbeiro, 3 de monge), 14 peles e 20 barbas por rosto; mulher, 50 rostos, 11 estilos e 14 peles. O catálogo inteiro do jogo tem 212 rostos e 262 penteados para o homem, mas quase todos são de alguém: um rosto de personagem da história, um penteado com o nome de um lorde, uma pele que é um cadáver. Quem abre o criador pela primeira vez já vem com um **visual sorteado**, para o servidor não ficar cheio de Henrys.

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
| `creator.accept` | cliente → servidor | `look`, `name`, `epithet` | tudo de novo; salva, veste, dá o kit inicial e dá as boas-vindas |
| `creator.cancel` | cliente → servidor | `forced` (a tela fechou por si, sem escolha do jogador) | quem entra pela primeira vez só sai por `forced` |
| `creator.failed` | cliente → servidor | `reason` | a nova tentativa e, depois de duas, o criador do jogo |
| `creator.refused`, `creator.done`, `creator.end`, `creator.tune` | servidor → cliente | a recusa e o campo, o nome final, nada, os números do enquadramento | |

### Ainda não testado no jogo

A **câmera de frente** (que o corpo mire para onde o jogador olha, e que o enquadramento fique bom: por isso o `/creator camera`), a **luz** (a escala da intensidade do jogo não é conhecida: 2,2 é um palpite), a **névoa dourada** em vez do fundo dourado do palco do jogo (o palco, com o painel dele, é todo do KCDC e não aceita a nossa tela), o **visual mudando em tempo real** no corpo, a **página transparente sobre o mundo**, e se o **HUD** e o **chat** somem e voltam. O criador que o servidor abre sozinho espera o corpo estar pronto: se o log disser `a página não abriu`, é isso.

## Kits, livros de receita e vendedores

### Kit inicial

Todo personagem recebe **uma vez**:

- roupas simples de trabalho, **já vestidas** (do gênero que escolheu no criador; o jogo oferece os presets `labourer_*` para homem e `f_villager_*` para mulher);
- **100 moedas**;
- **uma espada de caça** (`huntingSwordBasic`) **e uma adaga** (`daggerCommon`), as duas, para todos. A adaga do jogo não é feita para combate, e por isso o sorteio de antes (adaga, espada de treino ou espada de caça) foi trocado. Quem ganhou uma arma no sorteio e ainda a tem recebe só a outra;
- **comida que não estraga para umas cinco horas**: 3 salames secos, 2 carnes-secas, 2 queijos secos e 2 porções de nozes, 188 de nutrição ao todo. No nível de fome padrão (`media`) um estômago cheio (100) dura 3 horas, então isso dá cerca de 5 h 30. Os quatro têm tempo de estrago 0 nas tabelas do jogo;
- **uma tocha** (`rutinaAVypad_trackview_torch_weapon`, a única tocha das tabelas do jogo: o nome é de uma cena de missão, mas é a tocha de mão do jogador, com o seu próprio encaixe de equipamento e luz);
- **6 dados comuns** (`dieNormal`, para jogar nas mesas das tavernas: `E` no outro jogador e **Jogar dados**, ou `/dice <jogador>`; ficam guardados durante o jogo e voltam no fim).

As armas, a tocha e a comida vão para o inventário; o jogador as equipa. Quem já tinha personagem antes recebe o que falta na próxima entrada. Se o jogo recusar a roupa na hora, o servidor tenta de novo 3 vezes e depois na próxima entrada; nada é pago duas vezes. Os valores ficam em `STARTER_MONEY`, `STARTER_WEAPONS`, `STARTER_FOOD`, `STARTER_TORCH` e `STARTER_DICE` (`src/server/kits.ts`).

> **A moeda do jogo.** O item `money` aparece na tela dividido por 10: 1.000 do item são 100 moedas. Por isso o kit inicial dá **1.000** (`/give money 1000` dá o mesmo), os bandidos levam de 50 a 200 (5 a 20 moedas) e os preços das lojas, que vêm da tabela do jogo, já estão nessa escala. A primeira versão do kit pagou 100 do item (que aparecia como 10 moedas); quem recebeu isso é completado com os 900 que faltavam, uma vez, na próxima entrada.

### Kit de cada guilda

Entregue **na primeira vez** que o jogador entra na guilda (pelo painel). Trocar de guilda e voltar não repete; cada guilda tem o seu kit uma vez, então quem passa pelas quatro recebe os quatro kits. O kit da guilda a que o jogador já pertence é oferecido de novo a cada entrada, o que alcança quem entrou na guilda antes de os kits existirem ou estava com a mochila cheia na hora.

| Guilda | Kit |
| --- | --- |
| Ferreiro (Fabri Ferrarii) | Os livros **Manual do Ferreiro I: Ferramentas** (machado de trabalho, machado de carpinteiro, ferraduras de fazenda) e **II: Lâminas de Aprendiz** (espada de caça de treino e espada de caça), mais 10 sucatas de metal, 2 ferros, 4 de aço e 2 de material de fixação, o suficiente para forjar uma peça de cada |
| Caçador (Venatores) | Um arco de aveleira (`bow_b`), 20 flechas de caça e 20 flechas comuns |
| Taberneiro (Tabernarii) | 3 carnes de porco cruas, para cozinhar |
| Alquimista (Alchemistae) | O livro **Herbário do Aprendiz** (decocção de calêndula, poção digestiva e Aqua Vitalis) e as ervas para duas a três levas de cada: 5 urtigas, 8 calêndulas, 4 dentes-de-leão, 4 cardos e 2 carvões. A base líquida das poções vem da própria mesa de alquimia |
| Artesão (Artifices) | **Dez roupas simples para vender**, nenhuma vestida: 2 túnicas curtas, 1 túnica longa, 1 túnica gasta, 1 vestido simples, 2 toucas, 2 capuzes e 1 véu. O jogo avalia o conjunto em cerca de 1.150, no meio dos outros kits (ferreiro 580 mais dois livros, taberneiro 140, alquimista 60 mais o livro, e o caçador 3.600 por causa do arco) |

### Cores das facções

Quem jura lealdade a uma facção, que passa a ser a sua **facção de lealdade** (o painel diz *Facção de lealdade*, e o botão da atual diz *Lealdade atual*; a **casa** de alguém é uma propriedade, outra coisa), recebe, **na primeira vez** em cada uma, o manto e a gola nas cores dela, no inventário (vestir é com o jogador). O jogo não tem capa nem manto que um personagem possa vestir, então o manto é o **casaco bordado** do jogo (o mesmo corte nas duas cores, com faixas douradas) e a gola é a **gola acolchoada**. São roupas de homem; uma personagem mulher recebe o **sobretudo** e o **capuz bordado** (o capuz feminino do jogo é uma gola com capuz) nas mesmas cores. As cores foram conferidas nos ícones do próprio jogo.

| Casa | Homem | Mulher |
| --- | --- | --- |
| Leão Dourado (vermelho) | `Coat11_m03_C` (casaco bordado vermelho com faixas douradas) e `CollarPadded01_m06_C1` (gola acolchoada vermelha) | `F_Surcote01_m09_C` (sobretudo vermelho) e `F_Hood01_m01_C` (capuz vermelho com bordado dourado) |
| Corvo (azul) | `Coat11_m04_C` (casaco bordado azul com faixas douradas) e `CollarPadded01_m04_C1` (gola acolchoada azul) | `F_Surcote01_m15_C` (sobretudo azul) e `F_Hood01_m05_C` (capuz azul com bordado dourado) |

Jurar de novo, ou trocar de facção e voltar, não repete: cada facção dá o manto e a gola uma vez (o registro é por peça, então mudar o corpo do personagem depois também não dá o outro corte). Quem passa pelas duas facções fica com as duas cores. Como os kits de guilda, as cores da facção atual são oferecidas de novo a cada entrada, o que alcança quem jurou antes de elas existirem ou estava com a mochila cheia; uma peça recusada pelo inventário fica para a próxima. As listas ficam em `FACTION_COLOURS` (`src/server/kits.ts`).

### Livros de receita

São itens do servidor (`Items.register`, `src/server/books.ts`), com a aparência de um documento de receita do jogo, e a ação **Ler**. Ler o livro o consome e ensina as receitas: na alquimia, pelo livro de receitas do jogador (`Crafting.setKnowledge`); na forja, dando o perk que libera cada receita (`player.addPerk`). Um livro cujas receitas o jogador já sabe **não é gasto**. Se nada pôde ser ensinado depois de o livro ser tirado, ele é devolvido. O que o jogador aprendeu é salvo junto com o personagem.

Há 15 livros. Os dois primeiros de ferreiro e o primeiro de alquimia vêm nos kits; os outros são vendidos:

| Vendedor | Livros |
| --- | --- |
| Ferreiro | Machados de Guerra, Ferraduras (4 tipos), Espadas de Caça (4), Espadas Curtas (6), Sabres (2), Espadas Longas (5) |
| Boticário | Receituários de Tônicos, de Vigor, do Caçador, de Medicina, de Perfumaria e o Proibido (venenos) |

As receitas de missão e as especiais do jogo (artefatos, espadas lendárias) não estão em nenhum livro.

### Vendedores

São os NPCs da cidade que o servidor cria (além dos bandidos): **cinco ofícios em Suchdol**, cada um numa loja que o próprio nível tem (as entidades `Shop` do nível): o taberneiro na taverna, o ferreiro na ferraria da vila, o boticário e o caçador nas duas bancas de mercado e a costureira entre elas; **13 mascates**, um em cada fogueira de beira de estrada que o nível guarda para os mercadores errantes do jogo (os lugares `taboryUCesty`); e **8 banhistas** nos banhos que o nível tem (pedido de 16/10/2026: *ative os NPC de banho*). **Wysoka e Raborsch não têm loja nenhuma no jogo**, então não têm vendedores (a loja de Wysoka que o nível guarda, `Shop[...seller/shop_noDesk5...]` em 378, 2458, é só uma marca de lugar, sem balcão). Aparecem uns 12 segundos depois de o servidor subir, **sem nome nem barra de vida sobre a cabeça**, como a gente do próprio nível, e **não podem ser feridos** (se algo os derrubar, voltam 10 segundos depois). Vendem pelo preço que o jogo dá ao item mais 20%, ou pelo preço do livro, e as prateleiras se enchem de novo a cada 15 minutos. Falar com o NPC abre a tela de comércio do jogo.

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
| `ferreiro` | Mestre Ferreiro | Ferro, aço (3 tipos), cobre, material de fixação, guardas e pomos de espada, e os 6 livros de ferraria |
| `alquimista` | Boticário | 19 ervas, carvão, teia de aranha, presa de javali, e os 6 livros de alquimia |
| `taberneiro` | Taberneiro | **Só carne crua**: vaca, porco, carneiro e galinha |
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

**Ceder uma região inteira.** O admin pode ceder uma região a um jogador (o cartão da região, na seção Chaves, com o jogador escolhido em *Quem recebe*; com *Para mim* o admin pega a região para si): tudo o que ainda não tem dono nela passa a ser dele (as casas e, sob elas, os baús; nenhuma chave é feita, porque o dono não precisa de uma), e ele **decide por si** o que fazer: dar nome e descrição, trancar, fazer chaves, **entregar** a outros. O que não passa fica na lista dele **só para ler**: a casa de um vendedor (um NPC) e o que já era de outro dono. A região fica registrada com o seu senhor (`playerdata/regions.json`): uma propriedade nova que o censo achar nela vai para ele também, e a hierarquia mostra a região entre as terras dele. Antes de ceder o painel mostra a conta, e o servidor confere de novo; `status.regionCede` sem `confirm` só diz o que passaria. A casa de um vendedor nunca é dada a ninguém, nem por quem a vê na lista.

**O nome na porta e no baú.** Ao olhar para uma porta ou um baú de uma propriedade, a poucos metros, aparece um texto branco, na fonte do próprio KCD2 (a Kingdom Come), um pouco abaixo da mira: `Casa 03 - Hans`, ou só `Casa 03` se não tem dono; um baú de uma casa mostra `Casa 03 · Baú 1 - Hans`. É o cliente que traça um raio curto da câmera pela mira e pergunta ao servidor o nome do que o raio encontrou (`src/client/property-labels.ts`, resposta em `labelFor`, `src/server/properties.ts`); a resposta fica guardada por meia minuto. O que não é propriedade não mostra nada. A posição do texto (`TEXT_Y`) e o tamanho (`TEXT_SIZE`) são constantes no começo do arquivo.

**Como a chave funciona.** A tranca que o servidor põe numa propriedade não existe para o jogo (a porta está destrancada no mundo), então não há "destrancar com a chave do jogo": a chave é o **item** que o servidor confere quando alguém escolhe **Destrancar** ou **Trancar** no menu da porta ou do baú, ou usa `/chave`. Quem tem a chave de uma casa a leva no inventário; o admin faz o que um portador faz. **O dono não precisa de menos:** ele pega as chaves que quiser no painel (*Pegar chave*, *Dar chave*), uma de cada vez. Pelo próprio **painel**, o dono (seção Propriedades) e o admin (Chaves) trancam e destrancam a casa, as portas e os baús sem a chave.

### Fechaduras: [E] na porta e o painel

Olhando para qualquer porta ou baú de uma propriedade, o nome aparece e o jogo mostra **uma opção só: Abrir** (na porta aberta, Fechar). Antes, depois de entrar numa casa o jogador via duas (o *Abrir* do próprio jogo, de dentro de uma porta trancada, e a *Fechadura* do mod). Agora o mundo está sempre destrancado e quem trava é o servidor, que ouve o aperto antes de o jogo agir (`src/server/property-menu.ts`):

- numa porta ou baú **aberto**, para quem **não tem a chave**, o aperto abre, como em qualquer lugar;
- em qualquer outro caso, o aperto não abre e a lista de diálogo do jogo aparece com o que o jogador pode fazer:

| Opção | Quando aparece | O que faz |
| --- | --- | --- |
| **Abrir** | só se **não** está trancada | Abre a porta; num baú, mostra o baú (veja *O baú abre numa cópia*, abaixo) |
| **Destrancar** | trancada; ativa só para quem tem a **chave** (e para o admin), apagada (*precisa da chave*) para os outros | Destranca **aquela porta**, e a abre; as outras portas da casa ficam como estavam |
| **Trancar** | aberta, para quem tem a chave | Tranca aquela porta |
| **Destrancar a propriedade inteira** / **Trancar a propriedade inteira** | numa casa com **mais de uma porta**, para quem tem a chave | Muda todas as portas da propriedade de uma vez (os baús de dentro têm a tranca deles) |
| **Arrombar** | trancada, para quem **não** tem a chave e não está dentro | Só com uma **gazua** no inventário (apagada: *precisa de uma gazua*; ou *esta fechadura não se arromba*, ou *alguém já está tentando*): o servidor **tranca de verdade aquela porta por dois minutos**, o jogo oferece o **minijogo da gazua dele** (segure E) e quem acerta a abre; o dono é avisado se estiver online, e quem erra perde a gazua, como o jogo manda. Quem se afasta mais de 8 m, ou passam os dois minutos, desfaz |
| **Abrir por dentro** | trancada, quem está **dentro** da construção (o lado da porta sem a fechadura, como o jogo diz) **e o nível do jogo não confirma**; de dentro, onde o nível confirma, o jogo abre a porta direto, sem menu | Abre só aquela porta, sem chave, como quem puxa o ferrolho por dentro; o resto da propriedade continua trancado. Era o caso de quem dormiu num castelo e ficou preso |
| **Sair** | sempre | Fecha |

Uma tranca que o **nível do jogo** pôs (casas de NPCs e cenário) é respeitada: a porta é lida como trancada, até alguém a destrancar ou arrombar, e **volta trancada no reinício**, como o nível a fez. O servidor confere de novo a distância (4,5 m), a tranca, a chave e o lado de dentro em cada passo; o que o cliente diz não basta. O log diz o que aconteceu (`property-menu: Mauro em Casa 03 · Porta 2 (trancada, por fora)`).

**O baú abre numa cópia.** O servidor não consegue abrir a tela de um baú do nível (só a de um baú virtual), então **Abrir** copia o conteúdo para um baú virtual, abre a tela do jogo nele, e cada movimento volta para o baú de verdade na hora e de novo ao fechar (`src/server/chest-view.ts`); enquanto uma cópia está aberta, ninguém mais abre aquele baú. Se a cópia não abrir, o jogador tem 15 segundos para apertar E no baú e abri-lo pelo caminho do próprio jogo.

**Portas que o jogo não avisa.** O framework (KCDC 1.6.9) registra no log do cliente `Door dispatcher unavailable ... could not execute the entity-environment AnimDoor dispatcher chunk` para certas portas, em certas entradas (em 2026-10-15, 11 portas: 9 do Castelo de Suchdol, a Casa 02 e a **Casa 01 em toda sessão**). Naquele cliente a porta não é sincronizada e o servidor **nunca recebe o aperto**: era assim que a porta parecia "sem menu" ou mostrava só o aviso do jogo. O cliente também avisa, ele mesmo, quando o **E** é apertado perto de uma propriedade (`props.use`), e se em 450 ms o jogo não disse nada o servidor abre o menu mesmo assim (log: `apertou E em ... e o jogo não avisou`). É um defeito do framework, que vale ser reportado à KCDC.

**A porta que abre e fecha sozinha: a trava ao olhar.** O jogo começa a abrir uma porta destrancada no instante do aperto; quando o servidor recusa o aperto para abrir o menu, ele "põe a porta de volta" no cliente de quem apertou, e o jogador via o boneco abrir a porta e ela fechar sozinha antes de escolher qualquer coisa (2026-10-15). Para que isso não aconteça, **a porta de que o menu vai sair é trancada no mundo, só para o jogo, enquanto o jogador olha para ela** (`src/server/property-menu.ts`, `gaze`; `src/client/property-labels.ts`): o cliente diz ao servidor qual porta de propriedade está sob a mira (`props.gaze`, a cada 700 ms enquanto durar o olhar), o servidor tranca aquela porta (`Door.locked`), responde (`props.gazed`) e, **com a porta trancada, o jogo não oferece nada** do lado da fechadura: o aperto não faz nada e o **Abrir** que aparece é o do mod (a mesma dica do jogo, com a mesma tecla, só depois que a do jogo some, nunca ao lado dela); o **E** dela avisa o servidor (`props.use`), que abre o menu em 120 ms. Quando o olhar sai da porta, ou passa de 2 segundos sem ser repetido, a porta é destrancada no mundo de novo.

Só vale onde o aperto daria um menu e a trava não atrapalha ninguém:

- **de fora**: de dentro (o lado sem a fechadura), o jogo ainda oferece o seu *Abrir* numa porta trancada, e a trava só o tornaria uma recusa. Quem diz qual lado é qual são as áreas do próprio nível (`Door.areas`); **numa porta que nenhuma área reivindica** (a maior parte do castelo), é o que o próprio jogo disse naquela porta: cada aperto traz `keySide` (de que lado da fechadura o jogador estava), e o servidor guarda, por porta, a direção de onde ficaram os dois lados (`playerdata/door-sides.json`). Uma porta que **ninguém usou ainda** é travada dos dois lados, e o log diz uma vez (`não tem área do jogo que diga o que é dentro, e ninguém a usou ainda`);
- **onde o *Abrir* do jogo continua na tela com a trava posta** (o lado do ferrolho, ou uma porta que não tranca), o **cliente solta a trava** depois de 0,8 s e avisa o servidor (`props.gaze` com `released`): ele lembra aquele ponto (1,2 m) por 15 minutos e não trava ali de novo, e o aperto seguinte é o do próprio jogo. Um **E apertado com o prompt do jogo ainda na tela** (`props.use` com `prompt`) solta a porta para aquele jogador por 15 segundos e não abre menu nenhum: o próprio jogo abre a porta;
- numa porta que **o servidor tem por trancada**, vale para quem olha, tenha a chave ou não (todos vão ao menu de qualquer jeito), a menos que haja **alguém dentro** por perto; numa porta que está **aberta a todos** (só quem tem a chave ganha menu), só se **ninguém mais** estiver a 8 m, para que ninguém fique do lado de fora por causa do olhar de outro;
- a até 3 m da porta, com a porta **fechada**, e nunca numa que está **em arrombamento** (a tranca do arrombamento tem a vez).

**Por dentro a porta abre direto.** Quando o jogo diz que o jogador está do lado **sem** a fechadura (`keySide` falso) e as áreas, ou o que a porta já aprendeu, não dizem que é fora, o aperto é aceito e **não vira menu**: o jogo abre a porta sem ter nada a desfazer (uma recusa faz o boneco abrir e a porta voltar). Se estava trancada, o ferrolho é puxado à mão, só aquela porta, e o dono é avisado quando quem abriu não tem a chave. **Quem tem a chave e está dentro** e quer trancar usa o painel (**Propriedades**, os botões de tranca) ou tranca por fora; **Abrir por dentro** continua no menu quando o jogo não disse o lado.

Uma porta que o jogo ainda oferece apesar da trava é contada (`property-menu: o jogo ainda ofereceu Casa 03 a ... com a trava ao olhar posta`) e o cliente escreve no log quando solta uma porta porque o prompt do jogo não some (`o "Abrir" do jogo continua na tela ... a trava foi solta para este olhar`); o servidor conta as travas soltas e as portas de lado já aprendido, e `/propriedade olhar` mostra os dois números. O **minijogo da gazua** do jogo aparece numa porta travada pelo olhar para quem tem a habilidade: é tratado como o **Arrombar** do menu, tomado na hora, se a pessoa pode (trancada, sem a chave, com a gazua, num trinco que se arromba) e recusado em qualquer outro caso. **`/propriedade olhar desligar`** (admin) desliga tudo isso, e o menu volta a funcionar como antes, com o abre-e-fecha; `ligar` religa, e o estado fica em `playerdata/property-menu.json`.

> **Ainda não testado no jogo:** se a trava chega ao jogo antes do aperto e cala o *Abrir* dele (o servidor diz, com `props.gazed`, que a porta está travada, e o log do servidor conta quantas vezes o jogo ofereceu a porta mesmo assim), se a dica *Abrir* do mod aparece no lugar e com a tecla certa, e o que acontece com os NPCs que passam por uma porta travada pelo olhar de alguém (a trava dura só enquanto o olhar dura). Por dentro (quem tem a chave incluído) o menu deixou de existir justamente para não haver o abre-e-fecha; o que o jogo diz em cada aperto entra na conta (os mais antigos pesam metade depois de 50 apertos), então um lado aprendido de um aperto estranho se corrige com o uso.

**O que a varredura faz.** A cada 5 segundos o servidor põe o mundo de volta na linha do que ele guarda: destranca no mundo o que não está em arrombamento e fecha uma porta que ficou aberta e deveria estar trancada.

> **Ainda não testado no jogo:** que **Abrir** aparece sozinho em toda porta e baú; o minijogo da gazua começar na porta que o servidor trancou para o arrombamento e o servidor ver que acertou; o baú abrir na cópia e os itens voltarem ao fechar; e a cama, que **não** mudou (veja [Cama](#cama-descansar-sem-dormir)).

### Castelos

O castelo de cada região com muralhas é **uma propriedade só**: `Castelo de Suchdol` e `Castelo de Raborsch`, com **todas as portas dentro das muralhas** (uma chave, uma tranca para todas) e **os baús de dentro sob ele** (`Castelo de Suchdol · Baú 7`), como uma casa tem os seus. O censo deixava a fortaleza de fora; em Raborsch tinha cadastrado as portas uma a uma, como `Fortaleza` e `Porta`, e as que ninguém tinha trancado, ganhado chave ou recebido foram juntadas ao castelo. Um baú que alguém já renomeou mantém o nome; um que tem dono ou chaves entregues fica como está. Roda sozinho 30 segundos e 2 minutos depois de cada início (só acrescenta o que é novo) e por `/propriedade castelo [região]`. No primeiro início: **Suchdol com 33 portas e 62 baús; Raborsch com 12 portas e 5 baús**, juntando 7 portas soltas. Um castelo pode ser entregue a um jogador como qualquer casa.

## Animais e ervas

Os animais vêm do gerenciador de populações do gamemode (`src/server/animals.ts`), que usa os pontos de nascimento autorados no próprio nível: **711 pontos**. Para o mundo ter bem mais caça e mais vida (pedido de 16/10/2026: *mais animais para caçar no mapa*), cada ponto guarda **duas vezes e meia** o bando que o nível pôs lá (`animalDensity`, no mínimo 1 e no máximo **10** por ponto; eram 1,5 vez e 6), e **lobos e cães selvagens, o dobro** (eram 1,5 vez). Os animais **selvagens** (lebre, javali, corça, cervo, lobo, cão selvagem) ganham ainda, em volta de cada ponto, **um bando menor num chão próprio** (60% do bando, até 120 m do ponto, escolhido uma vez numa área andável): enche o mato entre os pontos que o nível pôs. As vacas, os touros, as ovelhas e os porcos ficam nos pastos e **mantêm os números do nível** (1×: até 16/10/2026 também eram 2,5×, e mais de 60 bichos de fazenda na vila pesaram no FPS de Suchdol). Ao subir, o servidor loga as vagas por espécie; hoje: lebres 3014, javalis 802, porcos 195, corças e cervos 1647 + 1051 + 799 + 759, ovelhas 254 + 77, vacas e touros 247 + 43, **lobos 466** e **cães selvagens 316** (antes: 1000, 288, 121, 568 + 374 + 279 + 283, 153 + 48, 149 + 27, 205 e 141). No máximo **700 corpos** ao mesmo tempo (eram 384), só perto de jogadores (350 m), nascendo até 4 por segundo (eram 2) fora da vista (60 m), e quem morre volta uns **3 minutos** depois. Lobos e cães selvagens atacam quem chega a 18 metros. A carne dos animais caçados é entregue ao esfolar (`animalDropChance` em `src/server/npc-spawn.ts`). **`/animals status`** diz quantos há agora e **`/animals max <n>`** muda o máximo na hora (até o servidor reiniciar), se a máquina de alguém sentir o peso.

**Ervas.** O nível decide onde cada planta nasce, e um script não cria plantas novas. O que dá para mudar é o tempo de rebrota de uma planta colhida (`Gathering`): o padrão do framework (um quinto do tempo do jogo) dava de 40 a 120 minutos reais neste relógio; agora são **4,5 a 12 horas de jogo**, cerca de **15 a 40 minutos reais** (`src/server/flora.ts`). A regra fica na memória do servidor e é posta de novo a cada início; o `/herbs` ainda muda até o próximo.

**Galinhas não dá para ligar.** O framework não cria galinhas: elas são bandos do jogo (*flock*) que a lista de animais do `Npc.create` deixa de fora. Coelhos há: são as lebres. Vacas, ovelhas e porcos há, nos pastos. Fica para uma versão futura do mod.

**A lebre corre.** Os animais andavam de um ponto ao outro e a lebre, que parece parada, andava como a vaca (pedido de 16/10/2026). Agora a lebre **corre** (`speed: run`) e troca de ponto mais depressa (a cada 3 a 9 segundos, contra 5 a 15 dos outros, que andam). A consulta ao terreno por segundo subiu de 25 para 40 para acompanhar.

**Ovos nos ninhos e peixes nas armadilhas** (pedidos de 16/10/2026). Como galinhas não dá para ligar, os ovos vêm de onde o nível os guarda: os **ninhos de galinha** (`henCare_coop`, os galinheiros das vilas: 87 no servidor) e os poucos **ninhos de ave** (`Nest`) que o servidor conhece como baús; e os peixes vêm das **armadilhas de pesca** do nível (`fish_trap_cage`). Meio minuto depois de cada início, e a cada 40 minutos reais, `src/server/nests.ts` põe **1 a 3 ovos** em cada ninho e **2 a 4 peixes** (perca, truta ou lagostim, um tipo por vez) em cada armadilha (o que havia é trocado), desde que **ninguém esteja a menos de 25 m** e o baú não esteja aberto; se alguém está perto, fica para a próxima olhada (a cada minuto, que também acolhe um baú que o nível só informa mais tarde). O log diz `nests: 87 ninho(s) do nível ganham ovos a cada 40 min; M já cheios; por exemplo ...` e `traps: N armadilha(s) de pesca do nível ganham peixes ...`. Os cestos de ovos das casas são tarefa dos moradores do jogo, não baús: ficam de fora.


## Dia, noite e clima

**40 minutos de dia e 40 de noite.** O dia do jogo não é dividido ao meio (é claro das 06:00 às 21:00, 15 horas, e escuro das 21:00 às 06:00, 9 horas), então o relógio anda mais rápido de dia (22,5 segundos de jogo por segundo real) e mais devagar de noite (13,5), e cada metade dura 40 minutos reais. O dia completo leva 80 minutos. O servidor ajusta a escala sozinho a cada 5 segundos e guarda o dia e a hora em `playerdata/world.json`, então um reinício continua de onde parou. `/clima relogio parar` congela a hora; `seguir` volta ao ciclo.

**Clima que muda sozinho.** Cada clima dura de 20 a 45 minutos e passa para o próximo em cerca de 4 minutos. A chuva e o vento sobem e descem junto com a troca. Os céus são os do próprio jogo, os mesmos que os scripts do jogo usam (`BlendTimeOfDay` no `Scripts.pak`):

| Id (`/clima`) | Clima | Chance | Céus do jogo | Chuva | Vento |
| --- | --- | --- | --- | --- | --- |
| `limpo` | Céu limpo | 26% | `cloudless_sunny`, `_B` | nenhuma | fraco |
| `poucas-nuvens` | Poucas nuvens | 22% | `semicloudy_clear`, `_B` | nenhuma | fraco |
| `nublado` | Nublado | 18% | `cloudy_no_rain` (3), `summer_overcast` (3) | nenhuma | moderado |
| `pancadas` | Pancadas de chuva | 12% | `cloudy_frequent_showers`, `_B` | média | moderado |
| `garoa` | Neblina com garoa | 8% | `foggy_drizzly`, `_B` | fraca | quase nenhum |
| `tempestade` | Tempestade | 10% | `foggy_storm`, `_B` | forte | forte (10 a 18 m/s) |
| `ventania` | Ventania | 4% | `foggy_storm_no_rain` | nenhuma | forte |

O mesmo clima não é sorteado duas vezes seguidas. O admin troca na hora com `/clima <id>`. O servidor aceita qualquer nome de céu sem conferir (um nome errado só gera erro no cliente), por isso só os nomes que o próprio jogo usa estão na lista. Código: `src/server/world-cycle.ts`.

## Bandidos

Os acampamentos são os do próprio nível: `Npc.placements()` lista cada pessoa que o nível posiciona, com a camada do mapa, e as que a camada ou o nome dizem ser bandidos (`bandit`, o tcheco `lapka`, `zbojník`) são agrupadas por distância. Neste nível são **8 acampamentos, com 45 bandidos** (pedido de 16/10/2026: *bem mais bandidos*; eram 35): três em volta de Vrchlicko (Vrchlicko 1, 2 e 3, numerados de oeste para leste), dois na aldeia abandonada de Kuklicko (Kuklicko 1 e 2), e um em Mezholezsko, em Na Bylance e em Bohounovice. Cada acampamento tem de **5 a 8** bandidos (eram de 3 a 5), **um arqueiro para cada quatro**. Eles aparecem uns 25 segundos depois de o servidor subir. Código: `src/server/bandits.ts`.

**Esconderijos na mata.** Além dos acampamentos do nível, o servidor espalha até **14 esconderijos** seus (hoje **11**, com **53 bandidos**), de 4 a 6 bandidos cada um e um arqueiro, chamados `Esconderijo N`. Cada um fica num ponto de caça **selvagem** do nível (nunca num pasto), num chão que a malha de navegação diz ser andável, **a pelo menos 300 m de qualquer lugar onde o nível põe gente comum** (vilas, fazendas, moinhos, postos de guarda), a 450 m dos acampamentos do nível e a 650 m um do outro. O sorteio é sempre o mesmo, em cada início: os esconderijos não mudam de lugar. Usam as mesmas almas de bandido do nível, a mesma dureza e o mesmo saque pobre, e não têm baú. Se a malha de navegação demora para ficar pronta, eles esperam até 2 minutos (log: `bandits: N esconderijo(s) na mata ...`, e uma linha por esconderijo com onde fica).

**Modo mais difícil:**

- 180 de vida (o padrão de um NPC é 100);
- golpes 60% mais fortes nos jogadores (o servidor aumenta o dano no `playerHit`);
- enxergam o jogador a 28 m e perseguem até 60 m do acampamento;
- quando um bandido é atingido ou entra em luta, **o acampamento inteiro vem junto** por um minuto;
- um arqueiro para cada quatro bandidos, atirando de longe.

**Saque básico, de propósito.** No KCDC o que um NPC veste e empunha é o saque do corpo, então os bandidos vestem e levam só coisa simples: túnica gasta ou de mendigo, calça simples, capuz ou gorro, às vezes um casaco de mendigo; um porrete, um machado de trabalho ou uma lâmina caseira (o arqueiro, um arco de aveleira e flechas rústicas); de 5 a 20 moedas e um pão, uma maçã ou uma cenoura. Assim roubar bandido não paga mais que trabalhar numa guilda.

**Morrem e voltam.** O corpo fica 10 minutos para ser revistado e some quando não há ninguém a 50 m. O bandido volta 30 minutos depois de morrer, quando não há jogador a 90 m do acampamento.

**Baús dos acampamentos.** Os baús, caixas, sacos e barris a até 35 m de cada acampamento (menos colmeias, corpos, os de missão ou de cena e os que são de uma propriedade) recebem de 3 a 6 tipos de coisas que as guildas usam: sucata, ferro, aço, material de fixação, guarda e pomo de espada (ferreiro); ervas, carvão e teia (alquimista); flechas e couros (caçador); carne crua (taberneiro); e, em 4 de cada 10 vezes, uma peça de roupa. São enchidos de novo a cada hora, quando não há jogador a 60 m e ninguém está com o baú aberto, e o que houver neles é trocado pelo novo: não servem de esconderijo para guardar coisas.

`/bandidos` mostra cada acampamento; `/bandidos ir <n>` leva o admin até ele; `/bandidos repor` traz os mortos de volta e enche os baús na hora. Se o jogo recusar alguma peça de roupa ou algum item de baú, o servidor deixa só aquele de fora e diz qual no log (`bandits: o jogo não vestiu: ...`, `bandits: os baús não aceitaram: ...`).

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

### Cozinhar, secar e defumar

O **cozinhar, o secar e o defumar do jogo** (a carne no espeto, na panela, no secador e no defumador do açougueiro) acontecem na máquina do jogador, e o multiplayer só leva ao servidor a alquimia, a ferraria, o reparo e o afiar: a carne crua ficava na bolsa e a pronta nunca chegava (relato de 16/10/2026, e o mesmo para secar e defumar). Não há aviso do jogo para ouvir, então o servidor faz o que o jogo faria, **por um macete** (ideia do dono do servidor): quando o jogador *tenta* fazer, o servidor tira o item cru da bolsa e entrega o pronto, como um `/give`. Funciona em um lugar que o próprio nível marca:

| Lugar | Quantos no nível | O que faz |
| --- | --- | --- |
| **Fogo** (lareira de casa, fogão de acampamento) | 45, mais as panelas de ensopado (`CookPot`) e as 13 fogueiras de beira de estrada | **cozinha** |
| **Secador de açougueiro** (`butcher_dryer`) | 12 | **seca** |
| **Defumador** (`butcher_smokeHouse`) | 5 | **defuma** |

**Cada lugar é de uma guilda** (17/10/2026): o **fogo** é dos **taberneiros**, o **secador** e o **defumador** dos **caçadores**; quem é de outra guilda recebe o aviso e nada é trocado (o cozinhar do próprio jogo, que roda na máquina dele, não chega ao servidor, então não rende nada). O mod só leva ao servidor a ferraria e a alquimia como ofícios de verdade; para o resto, é este jeito.

**O menu do fogo** (17/10/2026): ao chegar a uns 2,5 m de um fogo, de um secador ou de um defumador, o cliente põe na tecla de interação a dica **Cozinhar** (ou **Secar**, **Defumar**), ao lado do aviso do próprio jogo, que não dá para esconder. Apertar abre a lista de diálogo do jogo, conduzida pelo servidor: **Cozinhar** ou **Sair**; em **Cozinhar** vem a lista do que você leva e o lugar sabe fazer, uma escolha para cada comida e **Tudo o que der**. Quem não é da guilda do lugar recebe o aviso no chat e nenhum menu. Ainda não visto funcionando no jogo (a tela de cozinhar do próprio jogo pode abrir junto).

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
| **Sair** | Fecha o menu |

Um convite sem resposta caduca em 30 segundos, e o mesmo convite só pode ser repetido para a mesma pessoa 15 segundos depois. `Esc` no convite é o mesmo que recusar. Quem chamou precisa estar a até 8 metros quando o outro aceita.

Junto de uma mesa de dados, a mira numa pessoa mostra **[E] Conversar** e esconde o **[E] Jogar dados** da mesa, para que um aperto não faça duas coisas; para usar a mesa do jeito antigo, mire a mesa. Quem já esperava na mesa e aceita um convite pelo menu sai da espera e senta para o jogo combinado.

**Jogar dados: a aposta e os seus dados.** Na conversa em que os dois combinam a pontuação (2000 de início, de 500 em 500), vem também a **aposta**, em moedas **de cada um**: de nada a 1000, em degraus de 5, 10, 20, 50, 100, 200, 500 e 1000 (**Apostar mais** e **Apostar menos**; só se sobe até o que quem sobe tem na bolsa). Mudar a pontuação ou a aposta **desfaz** o aceite de quem já tinha aceitado, e o jogo só começa quando os dois aceitam o mesmo.

- **A aposta sai da bolsa de cada um quando o jogo começa**, e fica anotada em `playerdata/dice-pot.json`. Quem vence leva as duas (a mensagem diz quanto). **Ninguém lançou um dado** (a mesa foi deixada em 0 a 0), ou o jogo **acabou sem vencedor**: cada um recebe a sua de volta. Desistir **depois do primeiro lance** perde a aposta, como o próprio jogo avisa (*Cuidado, você vai perder a aposta!*). Se o servidor reiniciar no meio de um jogo, a aposta e os dados voltam a quem estava jogando na próxima entrada (log: `dice: N jogo(s) de dados estava(m) aberto(s) quando o servidor parou`).
- **Os dados e as insígnias de cada um ficam guardados enquanto dura o jogo** e voltam no fim. Com dados no inventário, o jogo abre antes da partida a sua própria tela **"Escolha os dados e insígnias para jogar"**, que uma partida entre jogadores (dada pelo servidor, com insígnias e perícias dos dados desligadas) não usa e cujo botão de confirmar (**X**) não fazia nada: as três primeiras partidas de teste (2026-10-15) acabaram em 0 a 0, ninguém tendo conseguido lançar. A mesa joga com os dados comuns do jogo.
- **As teclas da mesa** (as padrão do jogo; quem as mudou nos controles tem as dele): **E** marca o dado, **F** pontua e joga o resto, **Q** pontua e passa a vez, **setas** (ou `W A S D`) escolhem o dado, **segure `Esc`** para desistir; no controle, A marca, X pontua, Y passa e B (segurar) sai. O servidor as diz no chat de cada um quando o jogo começa, e o próprio jogo mostra as dicas na tela.
- O log do servidor conta o que aconteceu na mesa: `dice: partida N: aposta de ... de cada; dados guardados durante o jogo: ...`, `a primeira vez é do assento ...`, `primeiro lance, do assento ... (faces)`, e no fim `diceMatchEnd: ... N lance(s)` e `dice: partida N acertada: ...`.

> **Ainda não testado no jogo:** se a tela de escolher dados deixa de aparecer quando o inventário não tem dados (é a hipótese, pelo texto do próprio jogo: *se você tiver algum dado no seu inventário, pode escolher usá-lo antes de começar a partida*), e se a mesa responde às teclas acima. Se uma partida ainda acabar em 0 a 0, o log do cliente (`KCDC.log`) e o do servidor dizem até onde ela foi.

**"Junto da mesma mesa"** é estar a até **3 metros** da mesa (o nível tem 73 mesas de dados, 75 contando as camadas de missão). Até 14/10/2026 isso dependia só dos avisos de entrar e sair da área da mesa; um aviso perdido deixava a opção apagada ao lado da mesa, e foi o que aconteceu num teste. Agora a distância é medida na hora, e quando o menu mostra a opção apagada com alguém perto de uma mesa, o log diz a quantos metros cada um estava (`encounters: dados indisponíveis no menu: ...`).

**Negociar.** O jogo não tem uma tela de troca entre jogadores (a tela de comércio é de loja, de NPC). A negociação usa as telas que ele já tem: a lista de diálogo, para ver as ofertas e aceitar, e a tela de baú, para pôr itens na oferta. Cada um vê:

- **Você oferece** e **<nome> oferece**, com o dinheiro e os itens de cada lado, e `(aceitou)` quando o outro já aceitou;
- **Mudar os meus itens**: abre a tela de baú do jogo, com o seu inventário de um lado e a sua oferta do outro. Arraste o que quer oferecer; ao fechar, a lista volta (0,7 segundo depois, e desenhada de novo logo em seguida: aberta enquanto o jogo ainda fechava a tela, ela vinha vazia e prendia o jogador; um `Esc` logo depois de ela voltar a mostra de novo, uma vez, avisando como sair);
- **Mudar o dinheiro**: mais ou menos 1, 10 ou 50 moedas, ou nenhuma. O dinheiro fica no inventário até a troca fechar;
- **Ver o que <nome> oferece**: o dinheiro e os itens do outro lado, com os nomes em português do jogo e a qualidade;
- **Aceitar a troca**: a troca fecha quando os dois aceitam. Qualquer mudança numa das ofertas desfaz os dois aceites, e os dois são avisados;
- **Cancelar a troca**: cada um recebe de volta o que pôs. `Esc`, se afastar mais de 8 metros, 10 minutos sem mexer, sair do servidor ou morrer também cancelam.

**Uma troca não perde item.** Os itens oferecidos saem do inventário para um baú virtual e ficam anotados em `playerdata/escrow.json` enquanto a negociação está aberta. Se o servidor cair no meio, cada um recebe de volta o que tinha posto na próxima entrada. O que não cabe no inventário de quem recebe volta para quem ofereceu, e o que não cabe nem lá fica anotado e é entregue na próxima entrada. O dinheiro é conferido e tirado de uma vez: se um dos dois não tem mais o que ofereceu, nada é trocado e os dois aceitam de novo.

**Quem conhece quem** fica em `playerdata/acquaintances.json`, por Steam ID, e vale para sempre, mesmo depois de um reinício. O placar dos dados também mostra o nome como cada um conhece o outro. O admin também vê Desconhecido. O chat de texto continua mostrando o apelido de quem escreve, porque é o jogo que põe o nome na linha.

**Nomes dos itens em português.** O servidor só conhece o nome de tabela de um item (`daggerCommon`), não o texto que o jogo mostra. `data/item-names.json` traz os 4.891 itens que se carregam, por GUID, com o nome em português do Brasil tirado dos arquivos do próprio jogo. O arquivo fica só no servidor, fora do pacote do cliente. Ele é gerado por `python tools/make-item-names.py "<pasta do KCD2>"`; rode de novo depois de uma atualização do jogo que traga itens novos.

Código: `src/server/encounters.ts` (menu e convites), `src/server/trade.ts` (negociação), `src/server/acquaintances.ts` (quem conhece quem), `src/server/item-names.ts` e `src/client/property-labels.ts` (o nome embaixo da mira e a dica `[E] Conversar`).

## Apoiador

A seção **Apoiador** do painel (para todos) agradece quem joga e explica como apoiar: o botão **Apoiar** abre o QR code do Pix, com o valor e o que conferir no banco antes de pagar (identificação **KINGDOMRPBRASIL**, recebedor **Mauro Alves Aguiar**, **Banco Santander**). Depois de pagar, o jogador manda o comprovante no Discord, e um admin entrega os benefícios na seção **Jogadores**: escolhe o jogador e clica em **Dar benefícios**, que pede confirmação. O servidor não vê pagamento nenhum: a palavra do admin é a prova.

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

O framework não tem renascimento: o corpo fica no chão depois de `playerDied` até alguém o levantar. Quem morre ouve **"Você morreu. Em 8 segundos você acorda na igreja de <lugar>."**, os bolsos caem onde ele morreu (`death-drop.ts`), e 8 segundos depois o servidor o levanta e, meio segundo depois, o leva para **a igreja mais perto de onde caiu** (`src/server/respawn.ts`). As igrejas são onde ficam as caixas de doação do DLC 2 no nível, e o jogador acorda no chão ao lado da caixa:

| Igreja | Onde |
| --- | --- |
| Suchdol | 748, 3246 |
| Wysoka | 440, 2497 |
| Raborsch | 1596, 3846 |
| Santa Bárbara, em Kuttenberg | 2781, 942 |
| Kuttenberg, no arrabalde | 3073, 977 |
| São Tiago, em Kuttenberg | 3047, 684 |
| Stará Kutná | 3059, 1442 |
| Grunta | 3197, 2183 |

**As portas das igrejas** (pergunta de 16/10/2026: *as portas das igrejas são desativadas?*). Não achei porta nenhuma de igreja que o servidor controle: nas camadas do nível não há porta com nome de igreja, e perto das caixas de doação só há portas de casas vizinhas (a primeira versão destrancava tudo a 25 m da caixa e abriu casas de Grunta; foi corrigido). Um pouco depois de cada início (30 s), `src/server/respawn.ts` destranca só a porta **trancada pelo nível cujo próprio nome diga que é de igreja** (`church`, `chapel`, `kostel`, `parish`, `sacral`...) a até 40 m de uma caixa; uma porta trancada por script (a de uma propriedade, segurada por um olhar ou um arrombamento) é deixada em paz. E o log lista, **para cada igreja, as portas que há ao redor e o estado de cada uma** (`respawn: igreja de Suchdol: 3 porta(s) a 40 m, 0 de igreja destrancada(s) (trancada AnimDoor[...]; ...)`), que é como se descobre qual é a porta da igreja se ela existir. As entradas das igrejas podem ser aberturas sem porta, ou parte do prédio, que o servidor não vê.


**Quem tem cidadania acorda na sua cidade** (Suchdol e Raborsch, na igreja; Malešov, na praça): *"Você morreu. Em 8 segundos você acorda em Suchdol, a sua cidade."* Quem não tem acorda na igreja mais próxima, como a tabela acima. Veja [Cidadania](#cidadania).

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

A seção **Cidadania** do painel (tecla F2) mostra as três cidades do reino, cada uma com o seu brasão: **Suchdol**, **Raborsch** e **Malešov**. Ao clicar numa cidade abre à direita o **senhor das terras** (o jogador a quem a região foi cedida), o **nome da família** dele e a **quantidade de cidadãos**.

- **Escolher** (botão *Tornar-me cidadão*, com confirmação): uma cidade só, e a escolha é **definitiva**.
- **Morrer**: o cidadão acorda na sua cidade; quem não tem cidadania acorda nas igrejas.
- **O senhor das terras** vê o botão *Ver cidadãos*: a lista de quem mora nas terras dele, oito por página, com o botão *Depor* em cada um. **É a única forma de um cidadão mudar de cidade**: depois de deposto, ele escolhe de novo. Os administradores também veem e depõem, e `/cidadania` define ou limpa à mão.
- Guardado por Steam ID em `playerdata/citizenship.json`.

> **Ainda não testado no jogo.** O ponto de renascimento de Malešov é a praça (560, 258): se não for bom, é só trocar a posição em `citizenship.ts`.

## Ofícios das guildas

Cada ofício tem as suas ferramentas, e só a guilda dele as usa (administradores usam todas):

| Guilda | Usa |
| --- | --- |
| **Ferreiro** (Fabri Ferrarii) | a **forja** (ferraria do jogo) |
| **Alquimista** (Alchemistae) | as **mesas de alquimia** |
| **Caçador** (Venatores) | o **defumador** e o **secador** do açougueiro |
| **Taberneiro** (Tabernarii) | o **fogo** de cozinha: assar, ensopados e o que for do fogo |
| **Artesão** (Artifices) | nada ainda: o jogo não tem esse ofício; o sistema do alfaiate será feito à parte |

A forja e as mesas são recusadas pelo próprio mod (`craftingStarting` devolve `false`, com um aviso no chat); o fogo, o secador e o defumador são os do servidor (`/cozinhar`, o menu do fogo, o **Usar** do inventário). Duas coisas o mod não deixa recusar antes: a **tela da forja abre** para qualquer um (o aviso vem quando se escolhe uma receita) e a **pedra de amolar** é toda do jogo; o que o servidor faz é **desfazer a afiação** de quem não é ferreiro (o aviso diz isso), pelo evento de inventário `sharpen`. O kit de reparo é de todos.

> **Mesas de alquimia que não abriam:** o log do servidor mostrava `alchemy character unavailable: nativeModifierTieOrderRequired:f9de0477...` para quem tinha o talento **"Secrets of matter I"** (e o **II**, que depende dele): o servidor não consegue montar o personagem alquimista com esse talento. Ele está **bloqueado na tela de talentos** e, em quem já o tinha, é **tirado ao entrar, com o ponto devolvido** (`perk-guard.ts`). Ainda não visto funcionando no jogo.

## Idioma

O jogador escolhe o idioma na seção **Opções** do painel (*Idioma / Language*) ou com `/idioma pt|en`. Fica salvo por Steam ID (`playerdata/language.json`). O painel (F2 e F3) se traduz sozinho; o chat e os avisos também passam pelo dicionário (`lang-en-panel.ts` e `lang-en-messages.ts`). O que o dicionário não conhece aparece em português; os comandos de administração ficam em português de propósito.

## NPCs

A lista de todos os NPCs que o servidor mantém (comerciantes, mascates, banhistas, barbeiros, mestres, bandidos, animais, cães e gatos das vilas) está em **`NPCS.md`**, na mesma pasta deste arquivo.

## Livros de habilidade

Os livros de habilidade do jogo (93 neste servidor: a arte da espada, o treinamento de lanceiro, a Regra de São Dimas, a alquimia, a eloquência, a força...) ensinam lendo. O **Ler** do jogo pergunta por quantas horas ler, escurece a tela e pula o relógio até o fim da leitura, e aí dá a experiência: aqui o relógio é do servidor, nada o pula, e o jogador ficava numa tela preta (pedido de 16/10/2026: *se o jogador for ler o livro para aprender vai travar e bugar*). Então o gamemode **toma a ação do livro** (o *Ler*/*Aprender* do inventário) e o **servidor lê por você, no ritmo do relógio do mundo** (`src/server/skillbooks.ts`, `src/client/skill-books.ts`).

- **Quanto leva.** As horas que o livro pede na tabela do jogo (4, 6, 8, 10 ou 12) passam no **relógio do mundo**, no passo que ele tiver: com 22,5 segundos de jogo por segundo (de dia), um livro de 4 horas leva uns **11 minutos reais** e um de 12 horas uns 32; à noite (13,5), 18 e 53. `/leitura` diz o que falta. `/leitura fator <0.02-2>` (admin) escala as horas: 1 é o relógio por inteiro, 0,25 um quarto (um livro de 4 horas em 3 minutos).
- **O que se faz.** Usar o livro (*Ler*/*Aprender*) **fecha o inventário e abre o livro na tela**, com a tela de livro do próprio jogo (`Book.open`): o título, a habilidade, a descrição e o texto do livro (as frases que o jogo guarda para ele), e a leitura **conta enquanto o livro está aberto** (pedido de 16/10/2026: *enquanto ele fica com o livro aberto está lendo*). Fechar o livro, andar mais de 3 m, lutar, levar um golpe, cair, morrer ou sair do servidor **larga a leitura**, mas **o que foi lido fica guardado** (`playerdata/skillbooks.json`, por Steam ID) e a leitura seguinte continua dali. `/leitura parar` larga o livro. Ao terminar, o livro fecha e o jogador lê que aprendeu. Se o jogo não abrir o livro, o servidor diz o motivo e a leitura não começa (`skill-books: ...` no log do cliente).
- **O que se ganha.** No fim, a experiência da tabela do jogo (`player.addXp`, o caminho do próprio jogo: a barra sobe e o aviso de subir de nível aparece). A habilidade tem de estar no **nível que o livro pede** (a série vai de 100 a 500 de experiência, dos níveis 0, 5, 10 e 15), senão o servidor diz qual nível falta. **Cada livro ensina uma vez por jogador.**
- **Os livros de atributo** (força, agilidade, vitalidade, eloquência) não têm linha na tabela de experiência do jogo: o servidor usa a mesma escada das habilidades (100, 200, 350 e 500, dos níveis 0, 5, 10 e 15), um palpite. Os dois livros que não são de habilidade (o raro de missão e o de receitas de alquimia) ficam de fora.
- **Como o cliente sabe quais são.** Quando o jogador entra, o servidor manda a lista de GUIDs dos 93 livros (em pedaços de 20, `itemuses` com a ação `skillbook.read`, o mesmo caminho do cozinhar: `src/server/item-uses.ts` e `src/client/item-uses.ts`) e o cliente toma a ação de cada um com `Inventory.onUse` (o jogo aceita até 256 no total, livros e carnes juntos: 93 + 31). O log do cliente diz `item-uses: skillbook.read: 93 item(ns) tomado(s) pelo servidor, 0 recusado(s)` (e, para as carnes, `item-uses: cook.use: 124 ...`: a soma dos dois); o do servidor, `skillbooks: 93 livros de habilidade lidos em tempo real`. A tabela vem do jogo (`tools/make-skillbooks.py` gera `src/server/skillbook-data.ts`).

> **Ainda não testado no jogo:** que o *Ler*/*Aprender* de um livro chama o servidor em vez do jogo (o log do cliente diz quantos livros foram tomados), que o livro abre e fecha como descrito, que o GUID que o jogo manda é o da tabela, e o ritmo (se 11 minutos para o menor livro for demais, `/leitura fator 0.25`).
