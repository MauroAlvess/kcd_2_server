# Mods de KCD2 no servidor

Desde o KCDC 1.7.2 o servidor manda mods de KCD2 aos jogadores: eles baixam junto com o resto ao entrar, e os mods instalados no próprio jogo de cada um ficam desligados enquanto estão no servidor (o jogo de ninguém é alterado). Cada mod vira um **recurso** em `resources/<nome>/` (no VPS, `/opt/kcdc/server-linux/resources/`), com um `package.json` sem scripts e o conteúdo dos `.pak` do mod em `replace/`, nos caminhos dele. O servidor liga os recursos ao iniciar.

## Instalados (03/11/2026)

| Recurso | Mod (Nexus 1766, de DDVaMpZzz) | O que muda |
| --- | --- | --- |
| `ddv-bascincoif-fix-m` | Coif and bascinet fix (Male) | com coifa ou bacinete, o corpo do homem só fica escondido no pescoço |
| `ddv-underwfix-m` | Underwear fix (Male) | a roupa de baixo do homem não esconde o corpo por baixo dela |
| `ddv-underwfix-bath` | Underwear fix (Bathmaids) | o roupão das banhistas não esconde o corpo por baixo dele |

São patches da tabela `CharacterComponent` (os `HidingGroups` das peças), de 516 a 626 bytes cada. O log do início diz `Asset pak '<recurso>' replace: 1 files, N bytes (built)`. O limite de jogadores passou de **512 para 300** (`maxplayers` no `server.json`; o log diz `Max Players: 300`).

## Ficaram de fora

- **Underwear fix (Female)**: além do patch, troca o modelo da bata `f_smock01` (2,1 MB, uns 870 KB comprimidos). Neste servidor, downloads de entrada acima de ~510 KB já travaram a tela de carregamento para todos (643 KB e 4,5 MB nunca terminaram, em outubro). Antes de ligar, vale um teste: um servidor de teste com o mod, em que alguém entra; se entrar normal, sobe no oficial.
- **FPS Boost - Enable Async Compute**: é só um `mod.cfg` com `e_svoTI_AsyncCompute=1`, uma variável de console. O KCDC nunca roda Lua nem muda variáveis de console no jogo dos jogadores, então não há como mandar. Quem quiser pode pôr a linha `e_svoTI_AsyncCompute=1` no `user.cfg` da pasta do próprio jogo (não testado com o KCDC). Instalado só no seu PC, o deste projeto (03/11/2026): `Mods/enableasynccompute/` e `Mods/mod_order.txt` na pasta do jogo, para o jogo sozinho, e a mesma linha no `user.cfg` da pasta do jogo, para valer também no Kingdoms Connected (que desliga os mods locais). Para tirar: apagar a pasta `Mods/enableasynccompute` e o `user.cfg`.

## Para pôr outro mod

1. O mod é uma pasta com `mod.manifest`, `Data/*.pak` e às vezes `Localization/<Língua>_xml.pak` (os `.pak` são zip).
2. Cada `Data/*.pak` é extraído em `resources/<nome>/replace/`, com os caminhos de dentro. Os textos `<arquivo>__<id>.xml` de cada `<Língua>_xml.pak` vão em `resources/<nome>/localization/<língua em minúsculas>/`.
3. `package.json`: `{ "name": "<nome>", "version": "1.0.0", "mafiahub": {} }`; o nome só com minúsculas, números, `-` e `_`.
4. Reinício do servidor (o mod só entra ao iniciar).

**O que o KCDC aceita:** modelos, materiais, texturas, sons, `.adb`; tabelas **só como patch** (`libs/tables/.../<tabela>__<id>.xml`, nunca a tabela inteira): itens, almas, lojas, presets, IA e tabelas comuns; textos. **Recusa:** scripts Lua (`scripts/`), `mod.cfg`, quests e regras Storm (`libs/storm/`), árvores de IA, telas (UI), edições de nível (`modifies_level`) e animações substituídas (`.caf`). Um arquivo recusado impede o mod inteiro de ir (o log diz qual). Tudo o que está no recurso vai para o disco de todos os jogadores: só mods cujo autor permite redistribuir.
