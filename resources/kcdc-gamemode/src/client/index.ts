/**
 * The client half of the default gamemode: a CEF debug panel on F4, which the server opens for administrators only.
 *
 * Three directions: the page calls `callEvent`, `Web.on` receives it; `Web.emit`
 * sends a whole snapshot back per channel; `Events.emitServer` and `player.emit`
 * carry what only the server knows. Nothing here is privileged -- every button
 * that changes the world sends the `/` line a player could have typed.
 */

import { installBook } from "./book.js";
import { installBuild } from "./build.js";
import { installCamera } from "./camera.js";
import { installBigEvents } from "./big-events.js";
import { installChatCard } from "./chat-card.js";
import { installCraftPage } from "./craft-page.js";
import { installCarts } from "./carts.js";
import { installCreator } from "./creator.js";
import { installCreatorPage } from "./creator-page.js";
import { installCookHint } from "./cook-hint.js";
import { installFurniture } from "./furniture.js";
import { installHorseMenu } from "./horse-menu.js";
import { installDogMenu } from "./dog-menu.js";
import { installDice } from "./dice.js";
import { installDiceQuiet } from "./dice-quiet.js";
import { installFollow } from "./follow.js";
import { installCombat } from "./combat.js";
import { installHud } from "./hud.js";
import { installPropertyLabels } from "./property-labels.js";
import { installNotify } from "./notify.js";
import { installPerfWatch } from "./perf-watch.js";
import { installPick } from "./pick.js";
import { installPosture } from "./posture.js";
import { installThirst } from "./thirst.js";
import { installScreen } from "./screen.js";
import { installItemUses } from "./item-uses.js";
import { installSkillBooks } from "./skill-books.js";
import { installStatus } from "./status.js";
import { installVoice } from "./voice.js";
import { installWelcome } from "./welcome.js";
import { installMural } from "./mural.js";
import { installArrest } from "./arrest.js";
import { installWhistle } from "./whistle.js";
import { installWorkQuiet } from "./work-quiet.js";
import { installMountQuiet } from "./mount-quiet.js";
import { installEmotes } from "./emotes.js";
import { installGather } from "./gather.js";
import { installFarm } from "./farm.js";
import { installCowMilk } from "./cow-milk.js";
import { installTradeRights } from "./trade-rights.js";
import { installUiScale } from "./ui-scale.js";
import * as panel from "./panel.js";
import { readSelf } from "./snapshot.js";
import { describeAll, flip } from "./switches.js";

const RESOURCE = "kcdc-gamemode";

/** F5, F6 and F9 already belong to the client itself. */
const OPEN_KEY = "f4";

const SAMPLE_MS = 250;

/** Samples between server polls. */
const POLL_EVERY = 8;

const LOG_LINES = 40;

const lines: string[] = [];
let ticks = 0;
let timer = -1;

// Where the scripts spend their time, a line a minute in the client log (src/client/perf-watch.ts); in place before anything below registers a timer.
installPerfWatch();

function remember(text: string): void {
    lines.push(text);
    if (lines.length > LOG_LINES) {
        lines.splice(0, lines.length - LOG_LINES);
    }
    panel.push("panel:log", lines);
}

function note(text: string): void {
    console.log(text);
    remember(text);
}

function readField(payload: unknown, key: string): unknown {
    return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>)[key] : undefined;
}

function askServer(): void {
    Events.emitServer(`${RESOURCE}:panel.poll`);
}

function pushSelf(): void {
    panel.push("panel:self", readSelf());
}

function pushSwitches(): void {
    panel.push("panel:switches", describeAll());
}

const handlers: panel.PageHandlers = {
    "panel:ready": () => {
        panel.markReady();
        panel.push("panel:init", { ...panel.describe(), key: OPEN_KEY.toUpperCase(), screen: Web.getScreenSize() });
        panel.push("panel:log", lines);
        pushSwitches();
        pushSelf();
        askServer();
    },

    "panel:close": () => {
        panel.hide();
    },

    "panel:blur": () => {
        panel.blur();
        note(`input handed back to the game; ${OPEN_KEY.toUpperCase()} works again`);
    },

    "panel:refresh": () => {
        pushSelf();
        pushSwitches();
        askServer();
    },

    "panel:command": (payload) => {
        const line = readField(payload, "line");
        if (typeof line !== "string" || line.trim().length === 0) {
            return;
        }

        const text = line.trim().startsWith("/") ? line.trim() : `/${line.trim()}`;
        Chat.send(text);
        note(`sent ${text}`);
    },

    "panel:switch": (payload) => {
        const name = readField(payload, "name");
        if (typeof name !== "string") {
            return;
        }

        const landed = flip(name);
        if (landed === null) {
            note(`no switch called '${name}'`);
            return;
        }

        pushSwitches();
        note(`${name} is now ${landed ? "on" : "off"}`);
    },
};

// The panel is for administrators, and only the server knows who they are: a press that finds it shut
// asks the server, which answers an admin with `panel.open` below and anybody else with a line in chat.
Key.bind(OPEN_KEY, "down", () => {
    if (panel.isVisible()) {
        panel.hide();
        return;
    }
    Events.emitServer(`${RESOURCE}:panel.request`);
});

Events.on(`${RESOURCE}:panel.open`, () => {
    panel.open(handlers);
    askServer();
});

Events.on(`${RESOURCE}:panel.realm`, (realm) => {
    panel.push("panel:realm", realm);
});

// Commands answer in chat, which a panel covering the screen would swallow.
// `chatMessage` is a reserved event, so it has no entry in the generated EventMap.
Events.on("chatMessage", (message) => {
    const text = readField(message, "text");
    if (typeof text !== "string" || text.length === 0) {
        return;
    }

    const author = readField(message, "author");
    remember(typeof author === "string" && author.length > 0 ? `${author}: ${text}` : text);
});

// The one failure a panel cannot report about itself. The view goes, so the
// next F4 or /ui retries the load instead of showing a dead page.
Events.on("browserLoadingFailed", (event) => {
    if (event.isMainFrame) {
        note(`page failed to load: ${event.description} (${event.errorCode}) at ${event.url}`);
        if (panel.owns(event.viewId)) {
            panel.destroy();
        }
    }
});

timer = setInterval(() => {
    if (!panel.isVisible()) {
        return;
    }

    pushSelf();
    ticks += 1;
    if (ticks % POLL_EVERY === 0) {
        askServer();
    }
}, SAMPLE_MS);

// The `/build` preview; it carries no tick of its own.
installBuild();

// The `/camera` switch.
installCamera();

// The chat, drawn by a page of ours at the bottom left (T writes).
installChatCard();

// Events too big for one message come in pieces (the forge's page is 79 KB; one message holds about 29).
installBigEvents();

// The guilds' trades: the recipes page (the server puts it up).
installCraftPage();
installCarts();

// The `/book` demo books.
installBook();

// The `/creator` stage, which the server asks for.
installCreator();

// The character creator proper: a page over the player's own body, filmed from the front.
installCreatorPage();

// The `/pick` trace, for the prop-hunt test commands.
installPick();
installPosture();
installThirst();

// The `/screenfx` presets: intoxication and injury.
installScreen();

// The `/hud` commands and the server's optional playerSpawned Stats test.
installHud();
installDice();
// Other players' dice matches: their sounds stopped here, and their players nobody's to talk to (dice-quiet.ts).
installDiceQuiet();
// The felling, the mining and the digging of the other players heard only by those near (work-quiet.ts).
installWorkQuiet();
// The other players' get-on, get-off and horses heard only from near (mount-quiet.ts, 2026-10-26: "sempre que alguém sobe no cavalo escutam de longe").
installMountQuiet();
// "Cozinhar" beside the game's own prompt at a fire, a rack or a smoker: the server answers with its cooking menu.
installCookHint();
installFurniture();
// E at one of the player's horses asks the server for its menu before the game's own climb gets anywhere.
installHorseMenu();
// The same at the player's dog: Fazer carinho, Mandar ficar or Mandar seguir, Sair.
installDogMenu();
installCombat();
installFollow();

// The status panel (F2, and F3 for administrators): character info, social status and guild selection.
installStatus();

// The open microphone and the voice indicator at the bottom of the screen (voice.ts).
installVoice();

// The welcome form: whoever has made a character agrees to the rules and the lore before going on (welcome.ts).
installWelcome();

// The notice boards of the villages, towns and castles: the page of their letters (mural.ts; the prompt is cook-hint.ts's).
installMural();
// Handcuffs and the pillory: the actions and menus held back, and the officers' hint at the pillory (arrest.ts).
installArrest();

// The name of the house, chest or player under the crosshair, where the game's own prompt is, and the talk key on players.
installPropertyLabels();

// Lines the server sends to the game's own notification line.
installNotify();

installItemUses();
installSkillBooks();

// X, the game's horse whistle, calls the player's own horse.
installWhistle();
// G: our gestures, chosen with a click.
installEmotes();
// What the player's guild lets their own game do: butchering is the hunters' (the game's F is switched off for anybody else), and the
// Coletores' blows with the axe at a tree and the pick at a rock, told to the server on the left click.
installTradeRights();
installUiScale();
installGather();
// The Agricultores' gardens: E at the soil of a bed of a village's garden sows it, or harvests it (farm.ts).
installFarm();
// The Agricultores' milking: E at a cow within reach (cow-milk.ts, 2026-10-27).
installCowMilk();

Events.on("resourceStop", (resourceName) => {
    if (resourceName === RESOURCE) {
        clearInterval(timer);
        panel.destroy();
    }
});

console.log(`debug panel armed for administrators; press ${OPEN_KEY.toUpperCase()}`);
