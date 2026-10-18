/**
 * The default KCDC gamemode: every `/` command a bare server answers.
 *
 * Nothing here is privileged -- every call it makes is one a resource beside it
 * can make -- so it is the worked example as much as the default.
 */

import { installBuildHandlers } from "./build.js";
import { installAnimalPopulation } from "./animals.js";
import { animalsCommand } from "./commands/animals.js";
import { installCombat } from "./combat.js";
import { CommandRegistry } from "./command.js";
import { animCommand, installAnimHandlers } from "./commands/anim.js";
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
import { installPosition } from "./position.js";
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
import { installWhitelist } from "./whitelist.js";
import { potCommand } from "./commands/pot.js";
import { adminCommand } from "./commands/admin.js";
import { chaveCommand } from "./commands/chave.js";
import { placeCommand } from "./commands/posicao.js";
import { propertyCommand } from "./commands/properties.js";
import { socialStatusCommand } from "./commands/socialstatus.js";
import { getFactionId, getGuildId, installStatus } from "./status.js";
import { installBooks, registerBooks } from "./books.js";
import { installCharacterState } from "./character-state.js";
import { installProperties, propertyOfStash } from "./properties.js";
import { installPropertyMenu } from "./property-menu.js";
import { installOptions } from "./options.js";
import { installPets } from "./pets.js";
import { installChestState } from "./chest-state.js";
import { installVendors } from "./vendors.js";
import { vendedorCommand } from "./commands/vendedor.js";
import { banditCamps, installBandits } from "./bandits.js";
import { installBarbers } from "./barbers.js";
import { installNests } from "./nests.js";
import { installTeachers } from "./teachers.js";
import { installHorses } from "./horses.js";
import { installGroundItemExpiry } from "./ground-items.js";
import { installWorldCycle } from "./world-cycle.js";
import { cavaloCommand } from "./commands/cavalo.js";
import { bandidosCommand } from "./commands/bandidos.js";
import { climaCommand } from "./commands/clima.js";
import { fomeCommand } from "./commands/fome.js";
import { doCommand, meCommand, tryCommand } from "./commands/roleplay.js";
import { guildaCommand } from "./commands/guilda.js";
import { presoCommand } from "./commands/preso.js";
import { idiomaCommand } from "./commands/idioma.js";
import { installLanguage } from "./language.js";
import { installCitizenship } from "./citizenship.js";
import { cidadaniaCommand } from "./commands/cidadania.js";
import { faccaoCommand } from "./commands/faccao.js";
import { installGuildCrafts } from "./guild-crafts.js";
import { installPerkGuard } from "./perk-guard.js";
import { installLanguagePanel } from "./language-panel.js";
import { alforjeCommand } from "./commands/alforje.js";
import { installHorseBags } from "./horse-bags.js";
import { installTreasure } from "./treasure.js";
import { installVillagePets } from "./village-pets.js";
import { installCarts } from "./carts.js";
import { carrocaCommand } from "./commands/carroca.js";
import { tesourosCommand } from "./commands/tesouros.js";
import { installStuck } from "./stuck.js";
import { installHunger } from "./hunger.js";
import { installCookMenu } from "./cook-menu.js";
import { installCooking } from "./cooking.js";
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
import { ensureStarter, grantFactionColours, grantGuildKit } from "./kits.js";
import { cachorroCommand } from "./commands/cachorro.js";
import { installSupporters } from "./supporters.js";
import { installFlora } from "./flora.js";
import { installAmbushes } from "./ambush.js";
import { emboscadaCommand } from "./commands/emboscada.js";

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
commands.add(socialStatusCommand);
commands.add(propertyCommand, chaveCommand, placeCommand, adminCommand, vendedorCommand, cavaloCommand, bandidosCommand, climaCommand, fomeCommand, cansacoCommand, sujeiraCommand, cachorroCommand, emboscadaCommand, leituraCommand, cozinharCommand, mestresCommand, meCommand, doCommand, tryCommand, guildaCommand, presoCommand, alforjeCommand, tesourosCommand, carrocaCommand, { ...carrocaCommand, name: "carroça" }, idiomaCommand, { ...idiomaCommand, name: "language" }, cidadaniaCommand, faccaoCommand);

// Item types come first: the keys of every property and the recipe books must exist before a saved inventory
// can be restored with them in it. The properties also get their locks put back, and Suchdol mapped once.
installProperties();
// [E] at a locked door or chest: unlock with the key, force it, or leave.
installPropertyMenu();
// Each player's own settings from the panel (third person), kept by Steam id and applied by their client.
installOptions();
// The "Animais" section of the panel: the player's horses and dog, named and called from there.
installPets();
installChestState();
registerBooks();
installVendors();

// The world around them: bandit camps, horses that wait for their owners, ground items that do not pile up for
// ever, and 40 minutes of day and 40 of night under a sky that changes by itself.
installBandits();
// Eggs in the level's nests, back every forty minutes.
installNests();

// The barbers and the skill teachers, standing where they are put and talking through the game's choice list.
installBarbers();
installTeachers();
// And on the roads between villages, a gang now and then wants a traveller's purse.
installAmbushes();
installHorses();
installGroundItemExpiry();
installWorldCycle();
installFlora();
installHunger();
// Tiredness: the energy bar, won back lying down or sitting.
installFatigue();
// Dirt: the game's own, with whatever stops it taken off, and a word to whoever gets dirty.
installDirt();
// Skill books are read at the world's pace: the game's own reading skips the clock, and cannot finish here.
installSkillBooks();
installCooking();
installCookMenu();
installTrades();
installEncounters();
// Who supports the server: the benefits an administrator hands over, and the dog that comes back at every entry.
installSupporters();
installCharacterState();
installBooks();

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
installLanguage();
installLanguagePanel();
installPerkGuard();
installGuildCrafts();
installCitizenship();
installHorseBags();
installVillagePets();
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

// A second gate beside the password: only the accounts approved in secrets/whitelist.json (scripts/whitelist.mjs).
installWhitelist();

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
    Chat.sendToPlayer(player, `Bem-vindo, ${player.nickname}. Aperte F2 para abrir o seu painel (personagem, guildas, facções, família, animais e opções) ou digite /help para ver os comandos.`);
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

console.log(`ready with ${commands.all().length} commands`);
