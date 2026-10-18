/**
 * The English of what the server says to a player in the chat and on the panel's toast: the messages of the panel's actions
 * (guild, faction, keys, properties, family, nominations, supporters), of `/preso`, the carts, the horses' saddlebags, the
 * roleplay commands and the lines `/help` lists for the commands everybody has. Whole texts in `MESSAGES`; sentences with a
 * name or a number in them as regular expressions in `MESSAGE_PATTERNS`, with `$1`... for what they catch (see `language.ts`).
 * A message not here reaches an English player in Portuguese, as it is written: the administrators' commands are left so.
 */

export const MESSAGES: Readonly<Record<string, string>> = {
    // Citizenship, the free horse and cart, the trades' tools, the perk taken out.
    "Essa cidade não existe.": "That town does not exist.",
    "Sua conta não tem identificação Steam, então a cidadania não poderia ser salva.": "Your account has no Steam identification, so the citizenship could not be saved.",
    "Essa pessoa não é mais cidadã dessa cidade.": "That person is no longer a citizen of that town.",
    "Esse cavalo não é seu.": "That horse is not yours.",
    "Essa carroça está trancada: só o dono sobe nela.": "That cart is locked: only its owner gets on.",
    "O cavalo": "The horse",
    "cozinhou": "cooked",
    "secou": "dried",
    "defumou": "smoked",
    " Parte não coube e ficou como estava.": " Part did not fit and stayed as it was.",
    "Parte não coube e ficou como estava.": "Part did not fit and stayed as it was.",
    "Não há fogo, secador nem defumador aqui perto. Chegue junto de uma lareira ou fogueira (cozinha), de um secador de açougueiro (seca) ou de um defumador (defuma).": "There is no fire, drying rack or smoker nearby. Go to a hearth or campfire (cooks), a butcher's rack (dries) or a smoker (smokes).",
    "Você não leva nada que se possa fazer aqui: carne, peixe e comida crua no fogo; carne, peixe, queijo e frutas no secador; carne, peixe e queijo no defumador.": "You carry nothing that can be done here: meat, fish and raw food at the fire; meat, fish, cheese and fruit at the rack; meat, fish and cheese at the smoker.",
    "Isto não se faz aqui: o fogo cozinha, o secador seca e o defumador defuma, e cada um só o que é dele.": "This cannot be done here: the fire cooks, the rack dries and the smoker smokes, each only what is its own.",
    "Não consegui fazer isso agora. Tente de novo.": "I could not do that now. Try again.",
    "os ferreiros (guilda Fabri Ferrarii)": "the blacksmiths (the Fabri Ferrarii guild)",
    "os alquimistas (guilda Alchemistae)": "the alchemists (the Alchemistae guild)",
    "os taberneiros (guilda Tabernarii)": "the innkeepers (the Tabernarii guild)",
    "os caçadores (guilda Venatores)": "the hunters (the Venatores guild)",
    "a forja": "the forge",
    "as mesas de alquimia": "the alchemy tables",
    "o fogo de cozinha": "the cooking fire",
    "o secador do açougueiro": "the butcher's rack",
    "o defumador": "the smoker",

    // The language itself.
    "Idioma: português.": "Language: Portuguese.",
    "Idioma: inglês.": "Language: English.",

    // Panel actions: guild, faction, general.
    "Sua conta não tem identificação Steam, então a guilda não poderia ser salva.": "Your account has no Steam identification, so the guild could not be saved.",
    "Sua conta não tem identificação Steam, então a facção não poderia ser salva.": "Your account has no Steam identification, so the faction could not be saved.",
    "Sua conta não tem identificação Steam, então a família não poderia ser salva.": "Your account has no Steam identification, so the family could not be saved.",
    "Sua conta não tem identificação Steam, então o sobrenome não poderia ser salvo.": "Your account has no Steam identification, so the surname could not be saved.",
    "Essa guilda não pode ser selecionada.": "That guild cannot be chosen.",
    "Essa facção não pode ser escolhida.": "That faction cannot be chosen.",
    "Esse jogador não está mais no servidor.": "That player is no longer on the server.",
    "Propriedade não encontrada.": "Property not found.",
    "Só o dono pode mudar isso.": "Only the owner can change this.",
    "Só o dono pode entregar a propriedade.": "Only the owner can hand over the property.",
    "Só o dono pode trancar ou destrancar.": "Only the owner can lock or unlock.",
    "Escolha outro jogador para receber a propriedade.": "Pick another player to receive the property.",
    "Escolha uma região para ceder.": "Pick a region to cede.",
    "Propriedade atualizada.": "Property updated.",
    "Essa porta não existe.": "That door does not exist.",
    "Descrição apagada.": "Description cleared.",
    "Descrição salva.": "Description saved.",
    "Um baú segue a região da casa em que está.": "A chest follows the region of the house it is in.",
    "Essa porta já é uma propriedade registrada.": "That door is already a registered property.",
    "O dono de um baú é o da casa.": "A chest's owner is the house's owner.",
    "Essa porta não é uma propriedade com chave.": "That door is not a property with a key.",
    "Não consegui fazer a chave dessa porta.": "I could not make the key for that door.",
    "Só o dono pode fazer chaves dessa propriedade.": "Only the owner can make keys for this property.",

    // Family.
    "Você não pode ser o seu próprio parente.": "You cannot be your own relative.",
    "Isso não é um parente.": "That is not a relative.",
    "Esse parentesco não existe.": "That relationship does not exist.",
    "Não consegui guardar esse parente.": "I could not save that relative.",
    "Esse parente não está na sua árvore.": "That relative is not in your tree.",
    "Esse parentesco não cabe nessa geração.": "That relationship does not fit that generation.",
    "Isso não diz se o parente está vivo.": "That does not say whether the relative is alive.",
    "Esse pedido não existe mais: quem pediu mudou ou tirou o parente.": "That request no longer exists: the one who asked changed or removed the relative.",
    "Isso não é um sobrenome.": "That is not a surname.",

    // Nominations.
    "Só um nobre pode nomear.": "Only a noble can name.",
    "Escolha um título.": "Pick a title.",
    "Você só pode nomear quem já se apresentou a você.": "You can only name someone who has already introduced themselves to you.",
    "Esse jogador não tem esse título.": "That player does not have that title.",
    "Só um nobre pode retirar um título.": "Only a noble can withdraw a title.",
    "Nenhum título sobre a sua cabeça.": "No title over your head.",
    "Você não tem esse título.": "You do not have that title.",

    // Supporters and the dog.
    "Seu cão vai seguir você.": "Your dog will follow you.",
    "Seu cão vai esperar aqui.": "Your dog will wait here.",
    "Seu cão vem quando você estiver de pé no mundo.": "Your dog comes when you are standing in the world.",
    "Seu cão já está vindo. Espere um pouco antes de chamar de novo.": "Your dog is already coming. Wait a moment before calling again.",
    "Seu cão não pôde vir agora. Tente de novo em instantes.": "Your dog could not come now. Try again in a moment.",
    "Seu cão veio para perto de você.": "Your dog came to you.",
    "Só quem apoia o servidor tem um cão para dar nome.": "Only those who support the server have a dog to name.",
    "Seu cão voltou a usar o nome de antes.": "Your dog went back to its earlier name.",
    "Você não tem um cão por perto. /cachorro chama o seu.": "You have no dog nearby. /cachorro calls yours.",
    "O cão é um presente para quem apoia o servidor: veja a seção Apoiador no painel (tecla , ao lado do M).": "The dog is a gift for those who support the server: see the Supporter section of the panel.",

    // "Fiquei preso".
    "Seu personagem ainda não entrou no mundo; tente de novo em um instante.": "Your character has not entered the world yet; try again in a moment.",
    "Você está morto: em instantes você acorda numa igreja, sem precisar disto.": "You are dead: in a moment you wake in a church, without needing this.",
    "Não consegui falar com o seu jogo para levar você. Tente de novo.": "I could not reach your game to take you. Try again.",
    "Fiquei preso: leva você à igreja mais próxima, uma vez a cada 60 minutos.": "I'm stuck: takes you to the nearest church, once every 60 minutes.",
    "/preso  -- se você ficou preso no cenário ou numa casa trancada: vai para a igreja mais próxima (uma vez por hora)": "/preso  -- if you got stuck in the scenery or in a locked house: goes to the nearest church (once an hour)",

    // Carts.
    "Essa carroça não é sua.": "That cart is not yours.",
    "Isso não é um nome.": "That is not a name.",
    "A carroça voltou a ser só uma carroça, sem nome.": "The cart is just a cart again, without a name.",
    "Você não tem uma carroça no mundo agora.": "You have no cart in the world now.",
    "Essa carroça não está no mundo agora.": "That cart is not in the world now.",
    "Você não pode chamar a carroça agora.": "You cannot call the cart now.",
    "Descer da carroça": "Get off the cart",
    "Você não está nessa carroça.": "You are not on that cart.",
    "Você se afastou demais da carroça.": "You have moved too far from the cart.",
    "As rédeas dessa carroça são do dono.": "The reins of this cart belong to the owner.",
    "Não consegui pôr você aí agora. Tente de novo.": "I could not put you there now. Try again.",
    "Nenhuma carroça sem dono a até 15 m de quem vai recebê-la.": "No ownerless cart within 15 m of whoever is to receive it.",
    "As suas carroças: onde estão, trazer para perto, dar nome; o admin dá, registra e libera.": "Your carts: where they are, bring them close, give a name; the admin gives, registers and frees them.",
    "/carroca  -- as suas carroças e onde estão": "/carroca  -- your carts and where they are",
    "/carroca trazer [n]  -- a carroça vazia vem para a sua frente (de dois em dois minutos)": "/carroca trazer [n]  -- the empty cart comes in front of you (every two minutes)",
    "/carroca nome [n] <nome>  -- dá nome à carroça (sem nome, volta ao comum)": "/carroca nome [n] <name>  -- gives the cart a name (without a name, goes back to plain)",
    "Você não tem carroça. Peça a um administrador.": "You have no cart. Ask an administrator.",
    "Você não tem carroça.": "You have no cart.",
    "Você não tem uma carroça com esse número. /carroca lista as suas.": "You have no cart with that number. /carroca lists yours.",
    "Você tem mais de uma: diga o número, como /carroca nome 2 Dourada.": "You have more than one: say the number, like /carroca nome 2 Golden.",
    "Só administradores dão, registram e liberam carroças.": "Only administrators give, register and free carts.",

    // Saddlebags.
    "Você não pode abrir as alforjes agora.": "You cannot open the saddlebags now.",
    "Você já está com um inventário aberto.": "You already have an inventory open.",
    "Você não tem um cavalo por perto.": "You have no horse nearby.",
    "Esse cavalo não está no mundo agora.": "That horse is not in the world now.",
    "O jogo não abriu as alforjes agora. Tente de novo.": "The game did not open the saddlebags now. Try again.",
    "O cavalo morreu; o que ele levava nas alforjes foi para os seus bolsos ou ficou no chão onde ele caiu.": "The horse died; what it carried in its saddlebags went to your pockets or stayed on the ground where it fell.",
    "Abre as alforjes do seu cavalo, para guardar e pegar coisas, estando perto dele.": "Opens your horse's saddlebags, to store and take things, while near it.",
    "/alforje <nome do cavalo>  -- as alforjes do cavalo com esse nome": "/alforje <horse name>  -- the saddlebags of the horse with that name",

    // Roleplay.
    "Descreve uma ação do seu personagem, para quem está por perto.": "Describes an action of your character, for whoever is nearby.",
    "Descreve a cena ou um detalhe dela, para quem está por perto.": "Describes the scene or a detail of it, for whoever is nearby.",
    "Tenta uma ação: ela dá certo ou falha, ao acaso (50%), e quem está por perto vê.": "Attempts an action: it succeeds or fails by chance (50%), and whoever is nearby sees it.",

    // Hunger.
    "Mostra como está a sua fome; o admin escolhe o nível da fome do servidor.": "Shows how hungry you are; the admin chooses the server's hunger level.",
    "Só administradores mudam o nível da fome.": "Only administrators change the hunger level.",
    "Só administradores pausam a fome.": "Only administrators pause hunger.",
    "/fome  -- como está o seu estômago e o nível da fome do servidor": "/fome  -- how your stomach is and the server's hunger level",

    // The commands everybody has, as /help lists them.
    "Abre o criador de personagem: visual, nome e alcunha. `nativo` abre o criador do próprio jogo.": "Opens the character creator: looks, name and epithet. `nativo` opens the game's own creator.",
    "Tranca ou destranca a porta, ou o baú, à sua frente, se você tiver a chave dele.": "Locks or unlocks the door, or the chest, in front of you, if you have its key.",
    "Vira administrador com um ticket, depois de entrar pelo menu do jogo.": "Becomes an administrator with a ticket, after joining through the game menu.",
    "Mostra onde está o seu cavalo e o chama; o admin lista e libera os cavalos guardados.": "Shows where your horse is and calls it; the admin lists and frees the stored horses.",
    "Mostra a sua energia e se o jogo vê você descansando (deitado ou sentado); o admin vê a de outro jogador.": "Shows your energy and whether the game sees you resting (lying or sitting); the admin sees another player's.",
    "Mostra o quanto o seu corpo está sujo (o jogo suja a roupa e a pele com o movimento) e onde se lavar; o admin vê a de outro jogador.": "Shows how dirty your body is (the game dirties clothes and skin with movement) and where to wash; the admin sees another player's.",
    "Tira da tela o relógio de sono e o ícone de carregando que ficam depois de dormir numa cama, e levanta o personagem.": "Removes from the screen the sleep clock and the loading icon left after sleeping in a bed, and gets the character up.",
    "O cão de quem apoia o servidor: chama, dá nome e dá ordens.": "The dog of whoever supports the server: calls, names and gives orders.",
    "Mostra o livro de habilidade que você lê, larga o livro, ou o admin ajusta o ritmo da leitura.": "Shows the skill book you are reading, drops the book, or the admin adjusts the reading pace.",
    "Junto de um fogo, de um secador ou de um defumador, cozinha, seca ou defuma a comida que você leva (o jogo faz isso só na máquina do jogador, o servidor não ouve).": "Beside a fire, a drying rack or a smoker, cooks, dries or smokes the food you carry (the game does this only on the player's machine, the server does not hear it).",
    "Só administradores podem usar este comando.": "Only administrators can use this command.",
    "  Só administradores podem usar este comando.": "  Only administrators can use this command.",
    "Idioma do painel, das mensagens e dos comandos: pt ou en.": "Language of the panel, messages and commands: pt or en.",
    // The cooking menu, the grindstone, the tidied properties.
    "Você se afastou do lugar: nada foi feito.": "You walked away from the spot: nothing was done.",
    "A pedra de amolar é da ferraria: a afiação foi desfeita. Só os ferreiros (guilda Fabri Ferrarii) afiam lâminas. Escolha a guilda no painel (F2), em Guildas.": "The grindstone belongs to the smithy: the sharpening was undone. Only blacksmiths (guild Fabri Ferrarii) sharpen blades. Pick the guild in the panel (F2), under Guilds.",
    "/propriedade organizar  -- põe os baús e as portas soltos para dentro da propriedade mais perto (até 35 m; um baú com o nome de um lugar, como (Taverna), até 75 m)": "/propriedade organizar  -- puts loose chests and doors inside the nearest property (up to 35 m; a chest named for a place, like (Taverna), up to 75 m)",
    "Nenhum baú ou porta solto perto de uma propriedade: está tudo no lugar.": "No loose chest or door near a property: everything is in its place.",
};

export const MESSAGE_PATTERNS: ReadonlyArray<readonly [string, string]> = [
    // Trades, citizenship, free horses and carts, the perk.
    ["^(\\d+) baú\\(s\\) foram para dentro da propriedade mais perto e (\\d+) porta\\(s\\) passaram a ser portas dela\\.$", "$1 chest(es) went inside the nearest property and $2 door(s) became its doors."],
    ["^Só (.+) usam (.+)\\. Escolha a guilda no painel \\(F2\\), em Guildas\\.$", "Only $T1 use $T2. Pick the guild in the panel (F2), under Guilds."],
    ["^Você tinha (.+), que impede as mesas de alquimia de funcionarem no servidor por enquanto: o talento foi tirado e o ponto voltou para você, para gastar em outro\\.$", "You had $1, which keeps the alchemy tables from working on the server for now: the perk was taken out and the point came back to you, to spend on another."],
    ["^Você agora é cidadão de (.+): quando morrer, é lá que você acorda\\.$", "You are now a citizen of $1: when you die, that is where you wake."],
    ["^Você já é cidadão de (.+): só o senhor das terras pode depor a sua cidadania\\.$", "You are already a citizen of $1: only the lord of the lands can depose your citizenship."],
    ["^Você já é cidadão de (.+)\\.$", "You are already a citizen of $1."],
    ["^Só o senhor das terras de (.+) depõe uma cidadania\\.$", "Only the lord of the lands of $1 can depose a citizenship."],
    ["^A cidadania de (.+) em (.+) foi deposta\\.$", "$1's citizenship of $2 was deposed."],
    ["^A sua cidadania de (.+) foi deposta\\. Você pode escolher uma cidade de novo, na seção Cidadania\\.$", "Your citizenship of $1 was deposed. You may choose a town again, in the Citizenship section."],
    ["^Você morreu\\. Em (\\d+) segundos você acorda em (.+)\\.$", "You died. In $1 seconds you wake in $T2."],
    ["^Você morreu\\. Em (\\d+) segundos você acorda na igreja de (.+)\\.$", "You died. In $1 seconds you wake in the church of $2."],
    ["^Você acordou em (.+)\\.$", "You woke in $T1."],
    ["^Você acordou na igreja de (.+)\\.$", "You woke in the church of $1."],
    ["^(.+), a sua cidade$", "$1, your town"],
    ["^(.+) está livre: qualquer jogador pode montar nele\\.$", "$T1 is free: any player can mount it."],
    ["^(.+) está trancado: só você monta nele\\.$", "$T1 is locked: only you can mount it."],
    ["^(.+) está livre: qualquer jogador pode subir e conduzir\\.$", "$T1 is free: any player can get on and drive."],
    ["^(.+) está trancada: só você sobe nela\\.$", "$T1 is locked: only you can get on."],
    ["^Esse cavalo pertence a (.+)\\.$", "That horse belongs to $1."],
    ["^Você (cozinhou|secou|defumou) no local: (.+)\\.( Parte não coube e ficou como estava\\.)?$", "You $T1 on the spot: $2.$T3"],
    ["^Você (cozinhou|secou|defumou) e (cozinhou|secou|defumou) no local: (.+)\\.$", "You $T1 and $T2 on the spot: $3."],

    // Panel actions.
    ["^Você já faz parte de (.+)\\.$", "You are already part of $1."],
    ["^Você já escolheu a guilda (.+): a escolha é definitiva e não se troca\\. Só um administrador pode desfazê-la\\.$", "You have already chosen the guild $1: the choice is final and cannot be swapped. Only an administrator can undo it."],
    ["^Você agora faz parte de (.+)\\.$", "You are now part of $1."],
    ["^Kit da guilda entregue: (.+)\\.$", "Guild kit handed over: $1."],
    ["^Você jurou lealdade à (.+): ela é a sua facção de lealdade\\.$", "You swore loyalty to the $1: it is your faction of loyalty."],
    ["^As cores da facção estão no seu inventário: (.+)\\. Vista pelo inventário\\.$", "The faction's colours are in your inventory: $1. Wear them from the inventory."],
    ["^(.+) entregou a você uma chave de uma porta\\. Fique perto da porta ou do baú e digite /chave para usá-la\\.$", "$1 handed you a key to one door. Stay near the door or the chest and type /chave to use it."],
    ["^(.+) entregou a você uma chave\\. Fique perto da porta ou do baú e digite /chave para usá-la\\.$", "$1 handed you a key. Stay near the door or the chest and type /chave to use it."],
    ["^(.+) entregou a você uma propriedade\\. Veja na seção Propriedades do painel \\(F2\\)\\.$", "$1 handed you a property. See it in the Properties section of the panel (F2)."],
    ["^(.+) entregou a você (.+)\\. Veja na seção Propriedades do painel \\(F2\\)\\.$", "$1 handed you $2. See it in the Properties section of the panel (F2)."],
    ["^(.+) cedeu a você a região de (.+): tudo o que não tinha dono é seu, e você decide o que fazer\\. Veja na seção Propriedades do painel \\(F2\\)\\.$", "$1 ceded you the region of $2: everything that had no owner is yours, and you decide what to do. See it in the Properties section of the panel (F2)."],
    ["^Na árvore de (.+), você agora é (.+)\\.$", "In $1's tree, you are now $2."],
    ["^(.+) mudou o parentesco entre vocês: na sua árvore, (.+) agora aparece como (.+)\\.$", "$1 changed the relationship between you: in your tree, $2 now appears as $3."],
    ["^(.+) não tem mais você na árvore\\.$", "$1 no longer has you in their tree."],
    ["^(.+) tirou você da árvore de família, e saiu da sua também\\.$", "$1 removed you from their family tree, and left yours too."],
    ["^O pedido foi para (.+): o vínculo vale quando for aceito, na seção Família\\.$", "The request went to $1: the link counts once accepted, in the Family section."],
    ["^(.+) quer registrar você na família como (.+)\\. Aceite ou recuse na seção Família do painel \\(F2\\)\\.$", "$1 wants to register you in their family as $2. Accept or decline in the Family section of the panel (F2)."],
    ["^Você recusou o pedido de (.+)\\.$", "You declined $1's request."],
    ["^(.+) aceitou ser (.+) na sua árvore de família\\.$", "$1 accepted being $2 in your family tree."],
    ["^(.+) recusou ser (.+) na sua árvore; o parente fica só com o nome\\.$", "$1 declined being $2 in your tree; the relative keeps only the name."],
    ["^Seu status social agora é (.+) \\((.+)\\)\\.$", "Your social standing is now $1 ($2)."],
    ["^Seu status social agora é (.+) \\((.+)\\), com (.+)\\.$", "Your social standing is now $1 ($2), along with $3."],
    ["^Ninguém mudou: já eram (.+)\\.$", "Nobody changed: they already were $1."],
    ["^(.+) \\((.+)\\) agora: (.+)\\.$", "$1 ($2) now: $3."],
    ["^(.+) para (.+): (\\d+) propriedade\\(s\\) e (\\d+) baú\\(s\\) passariam a ele\\.$", "$1 to $2: $3 propert(y/ies) and $4 chest(s) would become theirs."],
    ["^Chave de (.+) (.+)\\.$", "Key of $1 $2."],
    ["^Chave de (.+) de (.+) (.+): abre só essa porta\\.$", "Key of $1 of $2 $3: opens only that door."],
    ["^Abre as portas de (.+)\\.$", "Opens the doors of $1."],
    ["^Abre só (.+) de (.+)\\.$", "Opens only $1 of $2."],
    ["^A descrição pode ter até (\\d+) caracteres\\.$", "The description may have up to $1 characters."],
    ["^O nome da região precisa ter entre (\\d+) e (\\d+) caracteres\\.$", "The region's name must be between $1 and $2 characters."],
    ["^Já foram feitas (\\d+) chaves de (.+), o limite\\. Fale com um administrador\\.$", "$1 keys of $2 have already been made, the limit. Speak to an administrator."],
    ["^(.+) é parte de (.+): dê a casa\\.$", "$1 is part of $2: give the house."],
    ["^(.+) é a casa de (.+) \\(NPC\\): dê outra ao jogador\\.$", "$1 is the house of $2 (NPC): give the player another."],
    ["^(.+) agora é de (.+)\\. As chaves ficam no painel \\(Propriedades\\), para pegar uma de cada vez, quando precisar\\.$", "$1 now belongs to $2. The keys are in the panel (Properties), to take one at a time when needed."],
    ["^(.+) deixou de ser de (.+)\\. As chaves entregues continuam com quem as tem\\.$", "$1 no longer belongs to $2. The keys handed out stay with whoever has them."],
    ["^Você não tem a chave de (.+)\\.$", "You do not have the key of $1."],

    // Family.
    ["^O grau do primo vai de 1 a (\\d+)\\.$", "The cousin's degree goes from 1 to $1."],
    ["^Sua árvore já tem o máximo de (\\d+) parentes\\.$", "Your tree already has the maximum of $1 relatives."],

    // Nominations.
    ["^(.+) foi nomeado (.+), e você subiu a nobre com ele\\.$", "$1 was named $2, and you rose to noble with them."],
    ["^(.+) nomeou você (.+)\\. (.*)$", "$1 named you $2. $3"],
    ["^O título de (.+) foi retirado de você\\.$", "The title of $1 was withdrawn from you."],
    ["^Você deixou o título de (.+)\\.$", "You left the title of $1."],
    ["^Você deixou de ser (.+): o título passou a (.+)\\.$", "You are no longer $1: the title passed to $2."],
    ["^(.+) deixou de ser (.+)\\.$", "$1 is no longer $2."],
    ["^(.+) aparece sobre a sua cabeça\\.$", "$1 appears over your head."],
    ["^(.+) não é mais (.+)\\.$", "$1 is no longer $2."],
    ["^(.+) subiu a nobre com ele\\.$", "$1 rose to noble with them."],

    // Supporters.
    ["^Benefícios entregues a (.+): (\\d+) de (\\d+) peças de roupa nobre, (.+) e o cão\\.(.*)$", "Benefits handed to $1: $2 of $3 pieces of noble clothing, $4 and the dog.$5"],
    ["^Obrigado por apoiar o reino! Você recebeu trajes de nobre \\((\\d+) peças, no inventário\\), (.+) e um cão fiel, que volta com você a cada entrada\\. /cachorro chama, dá nome e dá ordens ao seu cão\\.$", "Thank you for supporting the realm! You received noble clothes ($1 pieces, in the inventory), $2 and a faithful dog that returns with you at every login. /cachorro calls, names and gives orders to your dog."],
    ["^O nome do cão precisa ter entre (\\d+) e (\\d+) letras\\.$", "The dog's name must be between $1 and $2 letters."],
    ["^Seu cão agora se chama (.+)\\.$", "Your dog is now called $1."],
    ["^(.+) ainda está entrando no mundo\\. Tente de novo em instantes\\.$", "$1 is still entering the world. Try again in a moment."],
    ["^(.+) entrou sem identificação Steam, então os benefícios não poderiam ser guardados\\.$", "$1 joined without Steam identification, so the benefits could not be saved."],

    // "Fiquei preso".
    ["^Fiquei preso só pode ser usado uma vez a cada 60 minutos\\. Disponível de novo em 1 minuto\\.$", "I'm stuck can only be used once every 60 minutes. Available again in 1 minute."],
    ["^Fiquei preso só pode ser usado uma vez a cada 60 minutos\\. Disponível de novo em (\\d+) minutos\\.$", "I'm stuck can only be used once every 60 minutes. Available again in $1 minutes."],
    ["^Você foi levado para a igreja de (.+)\\. Só poderá usar isto de novo daqui a 60 minutos\\.$", "You were taken to the church of $1. You can use this again in 60 minutes."],
    ["^1 minuto$", "1 minute"],
    ["^(\\d+) minutos$", "$1 minutes"],

    // Carts.
    ["^(.+) agora é de (.+): ela fica onde for deixada, com o nome que ele der, e aparece na seção Animais do painel \\(F2\\)\\.$", "$1 now belongs to $2: it stays where it is left, with the name they give it, and appears in the Animals section of the panel (F2)."],
    ["^(.+) deu a você uma carroça\\. /carroca mostra onde ela está; a seção Animais do painel \\(F2\\) a mostra também, e E perto dela escolhe o assento\\.$", "$1 gave you a cart. /carroca shows where it is; the Animals section of the panel (F2) shows it too, and E near it picks the seat."],
    ["^O nome da carroça precisa ter entre (\\d+) e (\\d+) letras\\.$", "The cart's name must be between $1 and $2 letters."],
    ["^A sua carroça agora se chama (.+)\\.$", "Your cart is now called $1."],
    ["^(.+) está com gente: espere que desçam\\.$", "$1 has people on it: wait for them to get off."],
    ["^(.+) acabou de ser trazida: de novo em (\\d+) min\\.$", "$1 was just brought: again in $2 min."],
    ["^(.+) não pôde ser trazida agora\\.$", "$1 could not be brought now."],
    ["^(.+): onde você quer ficar\\?$", "$1: where do you want to be?"],
    ["^(.+): já tem alguém\\.$", "$1: somebody is already there."],
    ["^(.+) \\(você está aqui\\)$", "$1 (you are here)"],

    // Saddlebags.
    ["^(.+) está longe demais: chegue a menos de (\\d+) m dele para abrir as alforjes\\.$", "$1 is too far: get within $2 m of it to open the saddlebags."],
    ["^(.+) está montado: desça antes de abrir as alforjes\\.$", "$1 is being ridden: get off before opening the saddlebags."],
    ["^As alforjes de (.+) já estão abertas\\.$", "The saddlebags of $1 are already open."],
    ["^As alforjes de (.+) não puderam ser abertas\\.$", "The saddlebags of $1 could not be opened."],
    ["^Alforjes de (.+): o que você deixar aqui fica com o cavalo\\.$", "Saddlebags of $1: what you leave here stays with the horse."],
    ["^Você não tem um cavalo chamado '(.+)'\\.$", "You have no horse called '$1'."],
    ["^/alforje {2}-- abre as alforjes do seu cavalo mais próximo \\(a até (\\d+) m\\)$", "/alforje  -- opens the saddlebags of your nearest horse (within $1 m)"],

    // Roleplay.
    ["^Muito longo: no máximo (\\d+) letras \\(você escreveu (\\d+)\\)\\.$", "Too long: at most $1 letters (you wrote $2)."],

    // Hunger.
    ["^Você está (.+) \\((\\d+)%\\)\\.$", "You are $1 ($2%)."],

    // The commands' lines.
    ["^(\\d+) command\\(s\\):$", "$1 command(s):"],
];
