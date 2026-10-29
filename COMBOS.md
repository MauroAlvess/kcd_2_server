# As combinações de arma, vistas para o servidor

Pedido de 26/10/2026: *vamos ver todos combos para ver qual não quebra o combate por se tratar de um servidor RP online; algumas podem ser muito roubadas.*

São as **51 combinações** de arma do jogo (as da seção **Esgrima** do painel): uma sequência de golpes que termina num golpe especial. Gerado por `tools/make-combos-doc.py` a partir das tabelas do jogo (`CombatCombos__generated.xml`) e dos textos de cada uma; as opiniões estão nesse arquivo e podem ser mudadas lá.

> **O jogo não dá número nenhum para uma combinação** (nem dano, nem Vigor): o golpe final é uma animação de duas pessoas (as tabelas de ações sincronizadas do jogo), e o que ele faz é o que o texto diz. Por isso a opinião aqui é qualitativa, lida de quatro fatos de cada uma, **e nada foi testado numa luta de verdade entre dois jogadores**: (1) quanto vale o lugar que o golpe final acerta (cabeça, pescoço e peito ferem fundo; corpo e queixo, não); (2) se o golpe final **passa a guarda sozinho** (o jogo escolhe a zona que o outro não está protegendo: bloquear não adianta); (3) se é **carregado** (lento, e o outro o vê chegar); (4) quantos golpes pede (de dois a quatro: mais golpes, mais difícil de armar).

## O que sai da revisão

- **Alto risco (8):** o golpe final vai à cabeça, ao pescoço, à garganta ou ao peito, ou **derruba** o outro com o corpo animado junto. Numa luta que o RP não combinou, é a morte (ou um corpo jogado no chão) sem volta. Sugestão: **só o administrador ensina** (quem aprende usa, mas não passa adiante), e o admin ensina quando houver história para isso (um mestre de esgrima, uma escola).
- **Risco médio (34):** atordoam (pomo, escudo ou cabo no rosto), tiram a perna (joelho, tropeço) ou passam a guarda por baixo. Ficam livres: são a esgrima do jogo, com quem sabe vencendo quem não sabe. Vigiar.
- **Baixo risco (9):** acertam o corpo ou dão soco de taverna, sem passar a guarda. Livres.
- **Passam a guarda sozinhas (15):** a família dos *golpes inferiores* (a primeira que o jogo dá, ao nível 5 ou 6), *No Joelho* (montante), *Oben Abnehmen* e os *Mittelhaw* de espada e de espada e escudo. O jogo as dá a todo mundo cedo: é a resposta dele a quem só sabe bloquear. Num servidor em que a luta é rara e narrada, é ótimo que sejam raras: o ensino já faz isso (ninguém ganha combinação lutando, só ensinada).
- **A que dá mais medo no multijogador é a única do corpo a corpo que derruba** (*Ataque de Ombro*): o golpe final é, tudo indica, uma animação sincronizada de dois corpos (o de quem bate e o de quem cai), e o jogo não foi feito para isso entre dois jogadores. Se alguma combinação travar o outro jogador no chão ou deixá-lo preso, é ela. Não a ensinar sem testar com dois admins.
- **Quem já as tem:** 63 dos 80 personagens salvos tinham 12 combinações dadas pelo jogo (as de nível 5 ou 6 que o jogo dá a todo novo personagem); continuam com elas. Personagem novo não ganha nenhuma, e o admin recebe todas.

## As combinações

Nível = o nível da habilidade de arma em que o jogo a dava sozinho (0: a de uma missão). Golpes = quantos golpes tem a sequência, o final incluído. **Guarda** = o golpe final passa a guarda sozinho. **Carga** = o golpe final é carregado (lento).

### Montante

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Golpe Inferior Esquerdo** (C01) | 5 | 3 | corte | sim | não | o corpo, por baixo | Médio | O golpe final passa pela guarda sozinho: depois de dois golpes bloqueados, o terceiro acerta. É o combo básico do jogo, dado ao nível 5; faz de quem se defende só bloqueando um alvo fácil. | livre, vigiando |
| **Golpe Inferior Direito** (C02) | 5 | 3 | corte | sim | não | o corpo, por baixo | Médio | O espelho do anterior, do outro lado: mesma coisa. | livre, vigiando |
| **Golpe com o Pomo** (C12) | 8 | 3 | estocada | não | sim | o rosto, com o pomo | Médio | Estocada carregada (lenta e vista de longe), acerta o rosto com o pomo: atordoa, não corta. | livre, vigiando |
| **Zorn Ort** (C07) | 10 | 4 | estocada | não | sim | o rosto, apunhalado | **Alto** | Quatro golpes e uma estocada carregada no rosto: ferimento fatal em quem não esquiva. Difícil de encadear, mas decide uma luta. | **só o admin ensina** |
| **Mittelhaw** (C09) | 10 | 3 | corte | não | não | o abdômen | Baixo | Três golpes de corpo, sem passar a guarda: só vale contra quem já se descuidou. | livre |
| **No Joelho** (C06) | 12 | 3 | corte | sim | não | o joelho | Médio | O golpe final passa a guarda e vai ao joelho: tira a perna do outro. | livre, vigiando |
| **Oben Ahnemen** (C05) | 16 | 3 | corte | sim | não | o lado, rente à lâmina | Médio | Passa a guarda por dentro da lâmina do outro e acerta de lado. | livre, vigiando |
| **Kurzhaw** (C08) | 16 | 3 | estocada | não | sim | a cabeça, por cima | **Alto** | Estocada carregada na cabeça depois de dois golpes por cima: vista de longe, mas a cabeça é a cabeça. | **só o admin ensina** |
| **Fiore Halbschwerten** (C11) | 16 | 3 | estocada | não | não | o peito, a duas mãos | **Alto** | Estocada de duas mãos no peito: o ferimento mais fundo do montante, sem a lentidão da carga. | **só o admin ensina** |
| **Rossen** (C13) | 22 | 4 | corte | não | não | a cabeça, desviando a arma | **Alto** | Quatro golpes e o último desvia a espada do outro e acerta a cabeça: o combo mais caro do montante (nível 22) e o mais certeiro. | **só o admin ensina** |

### Espada

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Golpe Inferior Direito** (C03) | 6 | 3 | corte | sim | não | o corpo, por baixo | Médio | Passa a guarda sozinho (golpe inferior): o combo básico da espada. | livre, vigiando |
| **Golpe Inferior Esquerdo** (C04) | 6 | 3 | corte | sim | não | o corpo, por baixo | Médio | Idem, do outro lado. | livre, vigiando |
| **Mittelhaw Alto** (C06) | 10 | 4 | corte | não | sim | o pescoço | **Alto** | Quatro golpes e um corte carregado no pescoço: carregado dá tempo de ver, mas pescoço é pescoço. | **só o admin ensina** |
| **Gume Forte** (C12) | 10 | 4 | corte | não | não | a garganta | **Alto** | Quatro golpes e um corte na garganta, sem carga: o mais traiçoeiro da espada. | **só o admin ensina** |
| **No Joelho** (C14) | 10 | 3 | estocada | não | não | o joelho | Médio | Estocada no joelho depois de dois golpes: tira a perna do outro, sem passar a guarda. | livre, vigiando |
| **Durchlauffen** (C13) | 12 | 3 | corte | não | não | o rosto, com o pomo | Médio | Pomo no rosto depois de dois golpes por cima: atordoa. | livre, vigiando |
| **Golpe Esmagador** (C01) | 15 | 3 | corte | não | sim | o rosto, com o pomo | Médio | Pomo carregado no rosto: atordoa e se vê chegar. | livre, vigiando |
| **Mittelhaw** (C05) | 15 | 3 | corte | sim | não | o abdômen | Médio | Passa a guarda sozinho e corta o abdômen. | livre, vigiando |
| **Gume Falso** (C11) | 15 | 3 | corte | não | não | a lâmina do outro | Médio | Escorrega pela lâmina do oponente e a trespassa: tira a arma da linha. | livre, vigiando |

### Espada e escudo

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Golpe Inferior Direito** (C03) | 5 | 3 | corte | sim | não | o corpo, por baixo | Médio | Passa a guarda sozinho: o escudo não ajuda contra ele. | livre, vigiando |
| **Golpe Inferior Esquerdo** (C04) | 6 | 3 | corte | sim | não | o corpo, por baixo | Médio | Idem, do outro lado. | livre, vigiando |
| **No Joelho** (C14) | 6 | 3 | estocada | não | não | o joelho | Médio | Estocada no joelho. | livre, vigiando |
| **Golpe Esmagador** (C02) | 10 | 3 | corte | não | sim | o rosto, com a borda do escudo | Médio | Escudada carregada no rosto: atordoa. | livre, vigiando |
| **Mittelhaw** (C05) | 10 | 3 | corte | sim | não | o abdômen | Médio | Passa a guarda sozinho e corta o abdômen. | livre, vigiando |
| **Mittelhaw Alto** (C06) | 10 | 4 | corte | não | sim | o pescoço | **Alto** | O mesmo da espada solta: quatro golpes e um corte carregado no pescoço. | **só o admin ensina** |
| **Gume Falso** (C11) | 18 | 3 | corte | não | não | a lâmina do outro | Médio | Escorrega pela lâmina do oponente (nível 18). | livre, vigiando |

### Maça ou machado

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Mittelhaw** (C05) | 5 | 3 | corte | não | não | o abdômen | Baixo | Três golpes de corpo, sem passar a guarda. | livre |
| **Esmagador de Joelhos** (C15) | 5 | 4 | corte | não | não | o joelho, esmagado | Médio | Quatro golpes e uma pancada no joelho: quem a leva manca de verdade. | livre, vigiando |
| **Golpe Inferior Direito** (C03) | 6 | 3 | corte | sim | não | o corpo, por baixo | Médio | Passa a guarda sozinho. | livre, vigiando |
| **Golpe Inferior Esquerdo** (C04) | 6 | 3 | corte | sim | não | o corpo, por baixo | Médio | Idem, do outro lado. | livre, vigiando |
| **Golpe Esmagador** (C01) | 8 | 3 | corte | não | sim | o rosto, com o cabo | Médio | Cabo carregado no rosto: atordoa. | livre, vigiando |
| **Golpe Brutal** (C09) | 8 | 4 | corte | não | não | o queixo | Médio | Quatro golpes e um no queixo: nocaute. | livre, vigiando |

### Maça ou machado e escudo

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Golpe Inferior Direito** (C03) | 5 | 3 | corte | sim | não | o corpo, por baixo | Médio | Passa a guarda sozinho. | livre, vigiando |
| **Golpe Inferior Esquerdo** (C04) | 5 | 3 | corte | sim | não | o corpo, por baixo | Médio | Idem, do outro lado. | livre, vigiando |
| **Golpe Esmagador** (C02) | 8 | 3 | corte | não | sim | o rosto, com a borda do escudo | Médio | Escudada carregada no rosto: atordoa. | livre, vigiando |
| **Mittelhaw** (C05) | 12 | 3 | corte | não | não | o abdômen | Baixo | Três golpes de corpo, sem passar a guarda. | livre |
| **Desvio com Escudo** (C16) | 12 | 4 | corte | não | não | as costelas, com o escudo | Baixo | Quatro golpes e uma escudada nas costelas: dói, não mata. | livre |
| **Golpe Brutal** (C09) | 14 | 4 | corte | não | não | o queixo | Médio | Quatro golpes e um no queixo: nocaute. | livre, vigiando |
| **Esmagador de Joelhos** (C15) | 22 | 4 | corte | não | não | o joelho, esmagado | Médio | Quatro golpes e uma pancada no joelho (nível 22). | livre, vigiando |

### Alabarda

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Golpe Inferior Esquerdo** (C04) | 6 | 3 | corte | não | não | o corpo, por baixo | Baixo | Sem passar a guarda: só vale contra quem já se descuidou. | livre |
| **Golpe Inferior Direito** (C03) | 7 | 3 | corte | sim | não | o corpo, por baixo | Médio | Passa a guarda sozinho, com o alcance da haste. | livre, vigiando |
| **Corte Baixo** (C07) | 10 | 3 | corte | não | não | a perna, fazendo tropeçar | Médio | Faz o oponente tropeçar: perde o equilíbrio e o ritmo. | livre, vigiando |
| **Corte no estômago** (C05) | 18 | 3 | corte | não | não | o estômago | Médio | Estocada no abdômen desprotegido (nível 18): com o alcance da haste, é o combo mais longo da arma. | livre, vigiando |

### Corpo a corpo

| Combinação | Nível | Golpes | Golpe final | Guarda | Carga | Acerta | Risco | O que se vê | Ensino |
| --- | ---: | ---: | --- | :---: | :---: | --- | --- | --- | --- |
| **Ataque de Ombro** (C09) | 0 | 3 | arremesso | não | não | derruba | **Alto** | Arremesso que derruba o oponente: dois corpos animados juntos e o do outro cai de verdade; é a única que o jogo dá por missão, sem nível. Se algo vai dar errado com o outro jogador, é aqui. | **só o admin ensina** |
| **Gancho de Esquerda** (C06) | 5 | 3 | gancho | não | não | o rosto | Baixo | Gancho de esquerda no rosto: soco de taverna. | livre |
| **Revés Boêmio** (C02) | 8 | 3 | soco | não | não | o rosto, com as costas da mão | Baixo | O revés boêmio: humilha mais do que machuca. | livre |
| **Golpe com Cotovelo** (C03) | 8 | 3 | gancho | não | sim | o queixo, com o cotovelo | Médio | Cotovelada carregada no queixo: nocaute, e se vê chegar. | livre, vigiando |
| **Martelo** (C01) | 10 | 3 | gancho | não | sim | o rosto | Baixo | Martelo carregado no rosto: se vê chegar. | livre |
| **Cabeçada** (C08) | 10 | 4 | gancho | não | não | o rosto, contra o cotovelo | Médio | Quatro golpes e a cabeçada: nocaute. | livre, vigiando |
| **Ataque da Tesoura** (C05) | 12 | 4 | gancho | não | sim | o pescoço | Médio | Quatro golpes e um soco carregado no pescoço. | livre, vigiando |
| **Ataque Direto** (C07) | 15 | 3 | soco direto | não | sim | o rosto | Baixo | Soco direto carregado no rosto (nível 15). | livre |

## O que dá para fazer, se o RP pedir

1. **Só o admin ensina as de alto risco.** Uma lista no `esgrima.ts` (hoje todas são livres: quem sabe, ensina) e a tela mostra *Ensinar* só para o admin nelas. Pequeno e sem efeito em quem já as tem.
2. **Não dar o Ataque de Ombro** enquanto não houver teste de dois jogadores: o admin a tem, mas não a ensina.
3. **Dar as combinações por escola:** só as de risco baixo e médio no começo, as de alto risco quando houver um mestre de esgrima (um NPC que ensina, o que já existe para as habilidades: `/mestres`).
