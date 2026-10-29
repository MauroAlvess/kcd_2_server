/**
 * The default KCDC gamemode: every `/` command a bare server answers.
 *
 * Nothing here is privileged -- every call it makes is one a resource beside it
 * can make -- so it is the worked example as much as the default.
 */

import { installBuildHandlers } from "./build.js";
import { animalPopulation, installAnimalPopulation } from "./animals.js";
import { animalsCommand } from "./commands/animals.js";
import { installCombat } from "./combat.js";
import { CommandRegistry } from "./command.js";
import { animCommand, installAnimHandlers } from "./commands/anim.js";
import { gestoCommand } from "./commands/gesto.js";
import { areaCommand } from "./commands/area.js";
import { appearanceCommand, lookalikeCommand } from "./commands/appearance.js";
import { outfitCommand } from "./commands/outfit.js";
import { blipCommand } from "./commands/blip.js";
import { blipDemoCommand } from "./commands/blipdemo.js";
import { bookCommand } from "./commands/book.js";
import { cameraCommand } from "./commands/camera.js";
import { screenFxCommand } from "./commands/screenfx.js";
import { carryCommand, installCarryHandlers } from "./commands/carry.js";
import { cartCommand } from "./commands/cart.js";
import { craftTestCommand } from "./commands/crafttest.js";
import { customItemsCommand, installCustomItemDemo } from "./commands/customitems.js";
import { creatorCommand, installCreatorSample, openNativeCreatorFor } from "./commands/creator.js";
import { installCreator } from "./creator.js";
import { buildCommand } from "./commands/build.js";
import { builderCommand } from "./commands/builder.js";
import { dialogueCommand, installDialogueSample } from "./commands/dialogue.js";
import { diceCommand, installDiceHandlers } from "./commands/dice.js";
import { doorCommand } from "./commands/door.js";
import { dropCommand } from "./commands/drop.js";
import { faceCommand } from "./commands/face.js";
import { gateCommand } from "./commands/gate.js";
import { installSiegeHandlers, siegeCommand } from "./commands/siege.js";
import { giveCommand } from "./commands/give.js";
import { takeCommand } from "./commands/take.js";
import { helpCommand } from "./commands/help.js";
import { herbsCommand } from "./commands/herbs.js";
import { dogCommand } from "./commands/dog.js";
import { horseCommand } from "./commands/horse.js";
import { hudCommand, installHudHandlers } from "./commands/hud.js";
import { patrolCommand, installPatrolSample } from "./commands/patrol.js";
import { npcCommand } from "./commands/npc.js";
import { installNpcDemoHandlers, npcDemoCommand } from "./commands/npcdemo.js";
import { propCommand } from "./commands/prop.js";
import { disguiseCommand, invisibleCommand, pickCommand } from "./commands/prophunt.js";
import { installStashHandlers, stashCommand } from "./commands/stash.js";
import { teleportCommand } from "./commands/teleport.js";
import { installSpawns } from "./spawns.js";
import { installAuth } from "./auth.js";
import { installPosition, setPlaceHold } from "./position.js";
import { installRestartNotice, onRestartSave, onRestartSettle } from "./restart-notice.js";
import { diceLobby } from "./dice.js";
import { nameOf } from "./acquaintances.js";
import { getCharacter } from "./characters.js";
import { installFirstJoin } from "./first-join.js";
import { uiCommand } from "./commands/ui.js";
import { installVendorSample, vendorCommand } from "./commands/vendor.js";
import { markerCommand } from "./commands/marker.js";
import { questCommand } from "./commands/quest.js";
import { vfxCommand } from "./commands/vfx.js";
import { muteCommand, mutesCommand, unmuteCommand } from "./commands/voice.js";
import { worldCommand } from "./commands/world.js";
import { installDebugPanel } from "./panel.js";
import { installDeathDrops } from "./death-drop.js";
import { installRespawn } from "./respawn.js";
import { installPickpocketPolicy } from "./pickpocket.js";
import { installSteamGate } from "./steam-gate.js";
import { installWhitelist } from "./whitelist.js";
import { installBans } from "./bans.js";
import { installLockpickWear } from "./lockpick-wear.js";
import { installAnimalStuck } from "./animal-stuck.js";
import { installRepair } from "./repair.js";
import { potCommand } from "./commands/pot.js";
import { adminCommand } from "./commands/admin.js";
import { chaveCommand } from "./commands/chave.js";
import { placeCommand } from "./commands/posicao.js";
import { propertyCommand } from "./commands/properties.js";
import { socialStatusCommand } from "./commands/socialstatus.js";
import { getFactionId, getGuildId, installStatus } from "./status.js";
import { installBooks, registerBooks } from "./books.js";
import { installCharacterState, saveAllCharacters } from "./character-state.js";
import { installProperties, propertyOfStash } from "./properties.js";
import { installPropertyMenu } from "./property-menu.js";
import { installOptions } from "./options.js";
import { installVoiceSettings } from "./voice-settings.js";
import { installWelcome } from "./welcome.js";
import { installMural } from "./mural.js";
import { installMuralPlaces } from "./mural-places.js";
import { muralCommand } from "./commands/mural.js";
import { aceitarCommand, boasVindasCommand } from "./commands/aceitar.js";
import { installPets } from "./pets.js";
import { installChestState } from "./chest-state.js";
import { installVendors } from "./vendors.js";
import { vendedorCommand } from "./commands/vendedor.js";
import { banditCamps, installBandits } from "./bandits.js";
import { installBarbers } from "./barbers.js";
import { installTravel } from "./travel.js";
import { installNests } from "./nests.js";
import { installTeachers } from "./teachers.js";
import { installHorses } from "./horses.js";
import { installGroundItemExpiry } from "./ground-items.js";
import { installWorldCycle } from "./world-cycle.js";
import { cavaloCommand } from "./commands/cavalo.js";
import { bandidosCommand } from "./commands/bandidos.js";
import { climaCommand } from "./commands/clima.js";
import { fomeCommand } from "./commands/fome.js";
import { sedeCommand } from "./commands/sede.js";
import { doCommand, meCommand, tryCommand } from "./commands/roleplay.js";
import { guildaCommand } from "./commands/guilda.js";
import { presoCommand } from "./commands/preso.js";
import { presosCommand } from "./commands/presos.js";
import { acordarCommand } from "./commands/acordar.js";
import { pazCommand } from "./commands/paz.js";
import { idiomaCommand } from "./commands/idioma.js";
import { installLanguage } from "./language.js";
import { installLocalChat } from "./local-chat.js";
import { installCitizenship } from "./citizenship.js";
import { cidadaniaCommand } from "./commands/cidadania.js";
import { faccaoCommand } from "./commands/faccao.js";
import { installGuildCrafts } from "./guild-crafts.js";
import { installPerkGuard } from "./perk-guard.js";
import { installEsgrima } from "./esgrima.js";
import { installLanguagePanel } from "./language-panel.js";
import { alforjeCommand } from "./commands/alforje.js";
import { installHorseBags } from "./horse-bags.js";
import { installHorseFollow } from "./horse-follow.js";
import { installHorseMenu } from "./horse-menu.js";
import { installDogMenu } from "./dog-menu.js";
import { installWildHorses } from "./wild-horses.js";
import { selvagensCommand } from "./commands/selvagens.js";
import { installTreasure } from "./treasure.js";
import { installCarts } from "./carts.js";
import { carrocaCommand } from "./commands/carroca.js";
import { oficiosCommand } from "./commands/oficios.js";
import { xpOficiosCommand } from "./commands/xpoficios.js";
import { installProfessionXp } from "./profession-xp-settings.js";
import { oficinasCommand } from "./commands/oficinas.js";
import { objetoCommand } from "./commands/objeto.js";
import { conjuntoCommand } from "./commands/conjunto.js";
import { ladraoCommand } from "./commands/ladrao.js";
import { installThieves } from "./thieves.js";
import { installRestitution } from "./restitution.js";
import { curarCommand } from "./commands/curar.js";
import { nivelCommand } from "./commands/nivel.js";
import { mortesCommand } from "./commands/mortes.js";
import { installHeal } from "./heal.js";
import { installLevelEdits } from "./level-edits.js";
import { installWallSites } from "./wall-sites.js";
import { installUiImages } from "./ui-images.js";
import { tesourosCommand } from "./commands/tesouros.js";
import { installCharacterReset } from "./character-reset.js";
import { installLookRemake } from "./look-remake.js";
import { installStuck } from "./stuck.js";
import { installFaint } from "./faint.js";
import { installSharpenLog } from "./sharpen-log.js";
import { installHunger } from "./hunger.js";
import { installThirst } from "./thirst.js";
import { installSoups } from "./soups.js";
import { installSpoilage } from "./spoilage.js";
import { installEmotes } from "./emotes.js";
import { installCookMenu } from "./cook-menu.js";
import { installCraftPlaces } from "./craft-places.js";
import { installFurniture } from "./furniture.js";
import { installGateGuard } from "./gate-guard.js";
import { levantarCommand, mobiliaCommand } from "./commands/mobilia.js";
import { viagemCommand } from "./commands/viagem.js";
import { registerCraftItems } from "./craft-items.js";
import { installCraftMenu } from "./craft-menu.js";
import { installCooking } from "./cooking.js";
import { installPrepareGuard } from "./prepare-guard.js";
import { installSkillBooks } from "./skillbooks.js";
import { leituraCommand } from "./commands/leitura.js";
import { cozinharCommand } from "./commands/cozinhar.js";
import { mestresCommand } from "./commands/mestres.js";
import { installFatigue } from "./fatigue.js";
import { cansacoCommand } from "./commands/cansaco.js";
import { installDirt } from "./dirt.js";
import { sujeiraCommand } from "./commands/sujeira.js";
import { installEncounters } from "./encounters.js";
import { installNominations } from "./nominations.js";
import { installGuildMembers } from "./guild-members.js";
import { installTrades } from "./trade.js";
import { ensureStarter, grantFactionColours, grantGuildKit, guildKitHint } from "./kits.js";
import { cachorroCommand } from "./commands/cachorro.js";
import { installSupporters } from "./supporters.js";
import { installFlora } from "./flora.js";
import { ambushes, installAmbushes } from "./ambush.js";
import { installLockOnPriority } from "./lockon-priority.js";
import { emboscadaCommand } from "./commands/emboscada.js";
import { installGather } from "./gather.js";
import { installWorkSound } from "./work-sound.js";
import { installMountSound } from "./mount-sound.js";
import { coletaCommand } from "./commands/coleta.js";
import { installFarm } from "./farm.js";
import { installCows } from "./cows.js";
import { installPerfWatch } from "./perf-watch.js";
import { installArrest, installRestraintGate } from "./arrest.js";
import { installScribe } from "./scribe.js";
import { installListings } from "./listings.js";
import { hortaCommand } from "./commands/horta.js";

// Our own item types (flour, malt, hops, thread, bow wood and the soups; the recipe books) before anything else: the chests' saved
// contents, the vendors' stock and the bandits' loot name them, and a class the game does not know yet is refused (2026-10-20: a tavern
// chest with malt in it came back empty, "recusou o conteúdo salvo (invalidItem)", the registration having come after the chests; and
// 2026-10-21 two chests with recipe books in them, the books having been registered one line after `installChestState()`).
registerCraftItems();
registerBooks();

// Before any module registers a handler for its client's messages: what an arrested player's client sends is dropped (arrest.ts, 2026-10-29).
installRestraintGate();
// Before any module registers a timer or a handler: how long each of ours takes is added up, and the heaviest are written to the log every minute.
installPerfWatch();
// And the engine's lists of players, horses and carts, which cost it a walk through all its entities on every call, are kept (listings.ts).
installListings();
// The pace the trades' XP is paid at, as the administrators left it.
installProfessionXp();

const commands = new CommandRegistry();
commands.add(potCommand);
commands.add(animalsCommand);
installAnimalPopulation();
commands.add(herbsCommand);
commands.add(builderCommand);
commands.add(patrolCommand);
installPatrolSample();
commands.add(craftTestCommand, animCommand, faceCommand, worldCommand, horseCommand, cartCommand, npcCommand, npcDemoCommand, dogCommand, appearanceCommand, lookalikeCommand, outfitCommand, giveCommand, takeCommand, stashCommand, propCommand, vfxCommand, markerCommand, blipCommand, blipDemoCommand, questCommand, dialogueCommand, creatorCommand, vendorCommand, dropCommand, carryCommand, teleportCommand, doorCommand, areaCommand, gateCommand, siegeCommand, uiCommand, cameraCommand, screenFxCommand, disguiseCommand, invisibleCommand, pickCommand, buildCommand, bookCommand, muteCommand, unmuteCommand, mutesCommand, diceCommand);

commands.add(hudCommand);
commands.add(gestoCommand);
commands.add(socialStatusCommand);
// The notice boards of the villages, towns and castles (mural.ts).
commands.add(muralCommand);
commands.add(propertyCommand, chaveCommand, placeCommand, adminCommand, vendedorCommand, cavaloCommand, bandidosCommand, climaCommand, fomeCommand, sedeCommand, cansacoCommand, sujeiraCommand, cachorroCommand, emboscadaCommand, leituraCommand, cozinharCommand, mestresCommand, meCommand, doCommand, tryCommand, guildaCommand, presoCommand, acordarCommand, pazCommand, alforjeCommand, tesourosCommand, carrocaCommand, { ...carrocaCommand, name: "carroça" }, oficiosCommand, { ...oficiosCommand, name: "ofícios" }, xpOficiosCommand, oficinasCommand, mobiliaCommand, levantarCommand, viagemCommand, objetoCommand, conjuntoCommand, aceitarCommand, boasVindasCommand, ladraoCommand, { ...ladraoCommand, name: "ladrão" }, curarCommand, nivelCommand, mortesCommand, presosCommand, idiomaCommand, { ...idiomaCommand, name: "language" }, cidadaniaCommand, faccaoCommand);

// Item types come first: the keys of every property must exist before a saved inventory can be restored with them in it (the
// craft items and the recipe books were registered above). The properties also get their locks put back, and Suchdol mapped once.
installProperties();
// [E] at a locked door or chest: unlock with the key, force it, or leave.
installPropertyMenu();
// Each player's own settings from the panel (third person), kept by Steam id and applied by their client.
installOptions();
// How each player's microphone opens, and how far a whisper, a word and a shout carry, for the voice indicator (voice-settings.ts).
installVoiceSettings();
// The welcome form: whoever has made a character is asked to agree to the rules and the lore, at once and at every entry until they do (welcome.ts).
installWelcome();
// The "Animais" section of the panel: the player's horses and dog, named and called from there.
installPets();
installChestState();
installVendors();

// The world around them: bandit camps, horses that wait for their owners, ground items that do not pile up for
// ever, and 40 minutes of day and 40 of night under a sky that changes by itself.
installBandits();
// Eggs in the level's nests, back every forty minutes.
installNests();

// The barbers and the skill teachers, standing where they are put and talking through the game's choice list.
installBarbers();
installTeachers();
// The coachmen at the stops of the villages, who take a traveller to another for a price, by day.
installTravel();
// And on the roads between villages, a gang now and then wants a traveller's purse.
installAmbushes();
installHorses();
installGroundItemExpiry();
installWorldCycle();
installFlora();
installHunger();
// Thirst: the game has none, this server does; a drink, or a river, quenches it, and the panel shows it.
installThirst();
// Food spoils as the world's clock turns, as the game would have it.
installSpoilage();
// The gestures a player picks on G, on our page.
installEmotes();
// Tiredness: the energy bar, won back lying down or sitting.
installFatigue();
// Dirt: the game's own, with whatever stops it taken off, and a word to whoever gets dirty.
installDirt();
// Skill books are read at the world's pace: the game's own reading skips the clock, and cannot finish here.
installSkillBooks();
installCooking();
// The game's own cooking, drying and smoking count since KCDC 1.7.0: only the trade that owns the place may have them converted.
installPrepareGuard();
installCookMenu();
// The forges and alchemy tables placed with the World Builder work like the game's (`craft-places.ts`).
installCraftPlaces();
// The notice boards placed with the World Builder (`mural-places.ts`), and the letters pinned to them (`mural.ts`).
installMuralPlaces();
installMural();
installFurniture();
installGateGuard();
// The guilds' trades: the page and its menus (our own ingredients were registered before anything else, above).
installCraftMenu();
// The level's own objects taken out of the world (Malešov's front gate, and what /objeto takes out), again on every boot.
installLevelEdits();
// The invisible walls that stay where the user's World Builder took a door out: found by the game of whoever walks near, taken out for everybody.
installWallSites();
// Pictures the panel needs only when a section is open (the Apoiador painting), sent by the server: not in the package.
installUiImages();
// The thief's mark (7 days over the head) and what an administrator has owed back to a player (items robbed from them).
installThieves();
installRestitution();
installHeal();
installTrades();
installEncounters();
// Arrest and the pillory: an officer's E on somebody below them, and the pillories of the villages (arrest.ts).
installArrest();
// Who supports the server: the benefits an administrator hands over, and the dog that comes back at every entry.
installSupporters();
// E at the supporter's dog opens its menu: Fazer carinho, Mandar ficar or Mandar seguir, Sair (dog-menu.ts).
installDogMenu();
installCharacterState();
installBooks();
// The tavern keepers' soups, eaten from the bag (soups.ts).
installSoups();

// The starter pack waits for the inventory the player's game shows, and for a saved look (kits.ts). The kit of
// the guild they already belong to is offered again too, and so are the colours of the house they swore to: that
// reaches somebody who chose before these existed, or whose bag was full when they chose. The ledger makes every
// part come once.
Events.on("playerInventoryReady", (player) => {
    ensureStarter(player);
    const guildId = getGuildId(player.steamId);
    const handed = guildId === null ? [] : grantGuildKit(player, guildId);
    if (handed.length > 0) {
        Chat.sendToPlayer(player, `Kit da guilda entregue: ${handed.join(", ")}.`);
        const hint = guildId === null ? "" : guildKitHint(guildId);
        if (hint !== "") {
            Chat.sendToPlayer(player, hint);
        }
    }
    const factionId = getFactionId(player.steamId);
    const colours = factionId === null ? [] : grantFactionColours(player, factionId);
    if (colours.length > 0) {
        Chat.sendToPlayer(player, `As cores da sua casa estão no seu inventário: ${colours.join(" e ")}. Vista pelo inventário.`);
    }
});

// The status panel (F2, and F3 for administrators): guild catalog, social status and guild selection.
installStatus();
// The Nomeação section: who names whom, the hierarchy, the title worn over the head.
installNominations();
installGuildMembers();
installStuck();
installFaint();
installSharpenLog();
installCharacterReset();
installLookRemake();
installLanguage();
installLanguagePanel();
installPerkGuard();
// The weapon combos: blocked in the game, taught from one player to another in the panel's Esgrima section (esgrima.ts).
installEsgrima();
installGuildCrafts();
// The Coletores' blows: the axe at the trees, the pick at the rocks (gather.ts).
installGather();
commands.add(coletaCommand);
// Who is at a loud work (felling, mining, digging), for every client to keep its sound to those near (work-sound.ts).
installWorkSound();
// Who rides, or has just got on or off a horse, for every client to keep those sounds to the players near (mount-sound.ts, 2026-10-26).
installMountSound();
// The Agricultores' gardens: the beds of the villages sown with a shovel and a seed, harvested when they ripen (farm.ts).
installFarm();
commands.add(hortaCommand);
// The cows' milk: the Agricultores milk the living cow with E, and the hunters find milk in the carcass (cows.ts, 2026-10-27).
installCows();
installCitizenship();
// The Escrivão section: the guilds are handed out by the clerks, the masters and the lords, not chosen (scribe.ts).
installScribe();
installHorseBags();
installHorseMenu();
// "Seguir" and "Ficar" at a horse (horse-follow.ts), and the wild horses of the open fields an Agricultor tames (wild-horses.ts).
installHorseFollow();
installWildHorses();
commands.add(selvagensCommand);
installCarts();
installTreasure((guid) => propertyOfStash(guid) !== null || banditCamps.camps.some((camp) => camp.chests.includes(guid)));
commands.add(customItemsCommand);
installCustomItemDemo();

// Added last so it can list the ones above, including itself.
commands.add(helpCommand(commands));

// After the registry is complete: the panel lists it too.
installDebugPanel(commands);

// What a building client sends back, and the teardown when one stops.
installBuildHandlers();
installCombat();
// The lock-on prefers enemy NPCs (bandits, the roads' gangs, wolves) to players while any is about (user, 2026-10-25).
installLockOnPriority([() => banditCamps.liveIds(), () => ambushes.gangIds(), () => animalPopulation.predatorIds()]);

// The sample conversation, and the two handlers that log every choice it takes.
installDialogueSample();

// The sample character creator, which puts on whatever look the player accepts, and the creator page over the player's own
// body (`creator.ts`); when the page cannot open, the game's own stage does.
installCreatorSample();
installCreator((player, _reason, mandatory) => openNativeCreatorFor(player, "both", mandatory));

// New joiners (and anyone who never finished the creator) are asked for a
// look on spawn; a returning player's saved one is put back on instead.
installFirstJoin();

// The sample stall: its keeper opens the vendor on use, and every deal is logged.
installVendorSample();

// Who may join, answered before they are sent anything, and which of them are
// administrators: the tickets in secrets/auth.json. With no such file nobody is
// checked and everyone is an admin.
installAuth();

// Where each player last stood, kept so a returning one is put back there.
installPosition();
// Seated at a dice table, a player's place is not kept: a restart puts them back where they stood, not on the bench.
setPlaceHold((player) => diceLobby.seated(player));

// A restart announced by the deploy script (`playerdata/restart-notice.json`): warnings, no new games, the dice settled, the
// trades undone, then everybody saved, before the server goes (2026-10-19, Erik and Elisabeth at the dice).
installRestartNotice();
onRestartSettle(() => diceLobby.stopAll());
onRestartSave(() => `${saveAllCharacters("antes do reinício", true)} personagem(ns) gravado(s) antes do reinício`);

// The banned Steam accounts (playerdata/bans.json) are turned away before the list is even looked at.
installBans();
// Whoever joins has to bring a Steam account, which is what a character is kept under (never the name typed in the menu). Asked BEFORE the list: a client that
// reports no Steam account at all (its Steam closed, or a copy of the game from another store) used to be told "your account is not approved" by the list,
// which was untrue of an account that was on it (2026-10-27, Janko Cerny: "continua recebendo o aviso de que a steam dele não está liberada"); the first refusal
// is the one the player reads, so the one that says what to do comes first.
installSteamGate();
// A second gate beside the password: only the accounts approved in secrets/whitelist.json (scripts/whitelist.mjs).
installWhitelist();

// The lockpick snaps now and then, once the lock has opened and never before the minigame is played (the game's own break never took the pick out of the server's inventory).
installLockpickWear();
// A bugged horse, dog or cart put in front of its owner, once an hour each (the Animais section).
installAnimalStuck();
// The grindstones are the smiths' repair bench: three repairs for each weapon (the game's own sharpening is undone, sharpen-log.ts).
installRepair();

// Robbing another player: a caught thief is named to both of them.
installPickpocketPolicy();
installDiceHandlers();
installStashHandlers();
installSiegeHandlers();
installCarryHandlers();

// The NPC demos are state machines driven by `npcIntentDone`, so their handlers
// have to be installed whether or not anybody has run a demo yet.
installNpcDemoHandlers();
installAnimHandlers();
installHudHandlers();

// What is typed in T reaches the village or town of the speaker and whoever stands near them, not the whole server (user, 2026-10-25).
installLocalChat();

Events.on("playerCommand", (player, command, args) => {
    if (!commands.dispatch(player, command, args)) {
        Chat.sendToPlayer(player, `Unknown command '/${command}'. /help lists the ones this server answers.`);
    }
});

Events.on("playerConnect", (player) => {
    console.log(`${player.nickname} joined as entity ${player.id}`);
});

// The server names nowhere by itself, so without this every join lands on the level's own start point. Nothing is seen:
// they are still loading. Somebody who has stood in the world before is put back where they were (position.ts); a
// newcomer arrives on the road to Suchdol (spawns.ts).
installSpawns();

// The first moment a welcome is worth sending: playerConnect fires while
// they are still loading.
Events.on("playerSpawned", (player) => {
    // Whoever came in is their character, never the name typed in the menu (user, 2026-10-25): a newcomer has no name yet.
    const greeting = getCharacter(player.steamId) === null ? "Bem-vindo ao Kingdom RP BRASIL." : `Bem-vindo, ${nameOf(player)}.`;
    Chat.sendToPlayer(player, `${greeting} Aperte F2 para abrir o seu painel (personagem, guildas, facções, família, animais e opções) ou digite /help para ver os comandos.`);
    console.log(`${player.nickname} is in the world`);
});

Events.on("playerDisconnect", (player) => {
    console.log(`${player.nickname} left`);
});

// Registered first, so the pockets fall before the body gets back up.
installDeathDrops();

// The framework has no respawn of its own: the dead wake up in the nearest church (respawn.ts), after their things
// have fallen where they died.
installRespawn();

// The last thing a stop does: characters saved once more, after every other module above handed back what it held.
Events.on("resourceStop", (name) => {
    if (name === "kcdc-gamemode") {
        console.log(`characters: última gravação da parada: ${saveAllCharacters("parada final", false)} personagem(ns) olhado(s)`);
    }
});

console.log(`ready with ${commands.all().length} commands`);
