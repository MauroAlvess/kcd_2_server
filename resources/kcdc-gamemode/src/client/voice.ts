/**
 * Voice goes out on V, and only while it is held. A new profile starts in
 * "voice activated" at a very sensitive level, which sends whenever the
 * microphone hears anything -- a key press included -- and lights the talking
 * icon for no reason.
 */

const TALK_KEY = "v";

export function installVoice(): void {
    try {
        Voice.setTransmitMode("pushToTalk");
        Voice.setPushToTalkKey(TALK_KEY);
        console.log(`voice: ${Voice.getTransmitMode()} on ${Voice.getPushToTalkKey().toUpperCase()}`);
    } catch (thrown: unknown) {
        console.error(`voice: could not put push-to-talk on ${TALK_KEY.toUpperCase()}: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
}
