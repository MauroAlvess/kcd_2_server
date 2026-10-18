/**
 * The client half of `/creator`: opens the character creator when the
 * server asks, and sends back the look the player accepted.
 *
 * `CharacterCreator` is client-only; how a look reaches the server is this
 * resource's business, so it goes up as one of its own events.
 */

const RESOURCE = "kcdc-gamemode";

/** What a creator ending is called in the chat line this sample leaves. */
const ENDINGS: Record<string, string> = {
    cancelled: "you backed out",
    closed: "it was closed",
    replaced: "another one replaced it",
    unavailable: "the stage could not be put up",
    interrupted: "it was interrupted",
};

function parseOpen(payload: unknown): { genders?: unknown; mandatory?: unknown } {
    let parsed: unknown = payload;
    if (typeof payload === "string") {
        try {
            parsed = JSON.parse(payload) as unknown;
        } catch {
            parsed = undefined;
        }
    }
    return typeof parsed === "object" && parsed !== null ? (parsed as { genders?: unknown; mandatory?: unknown }) : {};
}

function readGenders(payload: unknown): "male" | "female" | "both" {
    const genders = parseOpen(payload).genders;
    return genders === "male" || genders === "female" ? genders : "both";
}

/**
 * The server asks for the creator the moment a player spawns, which is a few
 * seconds before the game itself starts gameplay on this machine; a stage put
 * up that early is ended as `interrupted` or `unavailable`. So a request waits
 * until the local body is ready and this resource has been running this long.
 */
const SETTLE_MS = 10_000;
/** The longest a request waits for the body before it gives up. */
const GIVE_UP_MS = 90_000;
const RETRY_MS = 4_000;
const MAX_RETRIES = 3;

export function installCreator(): void {
    const started = Date.now();
    let owned = false;
    let request = 0;
    let retries = 0;
    let genders: "male" | "female" | "both" = "both";
    /** A newcomer, who has no character yet and cannot back out: the stage is put up again when they do. */
    let mandatory = false;

    function openWhenSettled(): void {
        const mine = ++request;
        const waitingSince = Date.now();
        const timer = setInterval(() => {
            if (mine !== request) {
                clearInterval(timer);
                return;
            }
            const now = Date.now();
            if (now - waitingSince > GIVE_UP_MS) {
                clearInterval(timer);
                console.log("creator: gave up waiting for the local player to be ready");
                return;
            }
            const me = LocalPlayer;
            if (!me || !me.ready || now - started < SETTLE_MS) return;

            clearInterval(timer);
            owned = CharacterCreator.open({ appearance: undefined, genders, title: "Your Character" });
            console.log(`creator: open requested after ${now - started} ms, accepted=${owned}`);
            if (!owned) retryOrReport("unavailable");
        }, 500);
    }

    function retryOrReport(reason: string): void {
        if ((reason === "unavailable" || reason === "interrupted") && retries < MAX_RETRIES) {
            retries++;
            console.log(`creator: ${reason}, retry ${retries} of ${MAX_RETRIES} in ${RETRY_MS} ms`);
            const mine = ++request;
            const timer = setInterval(() => {
                clearInterval(timer);
                if (mine === request) openWhenSettled();
            }, RETRY_MS);
            return;
        }
        Hud.showInfoText(`Character creator closed: ${ENDINGS[reason] ?? reason}.`);
    }

    Events.on(`${RESOURCE}:creator.open`, (payload) => {
        genders = readGenders(payload);
        mandatory = parseOpen(payload).mandatory === true;
        retries = 0;
        openWhenSettled();
    });

    Events.on(`${RESOURCE}:creator.close`, () => {
        request++;
        mandatory = false;
        if (owned) CharacterCreator.close();
    });

    Events.on("characterCreatorClosed", (appearance, reason) => {
        console.log(`creator: closed, reason=${reason}, look=${appearance !== null}`);
        if (!owned) return;
        owned = false;
        if (appearance !== null) {
            mandatory = false;
            Events.emitServer(`${RESOURCE}:creator.accepted`, JSON.stringify(appearance));
            return;
        }
        // `replaced` means a newer creator is already up; nothing to say.
        if (reason === "cancelled" && mandatory) {
            Hud.showInfoText("Crie o seu personagem para entrar em Kuttenberg.");
            retries = 0;
            openWhenSettled();
            return;
        }
        if (reason !== "replaced") {
            retryOrReport(reason);
        }
    });
}
