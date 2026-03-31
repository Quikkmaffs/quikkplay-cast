# QuikkPlay Cast Receiver

This directory contains the custom Cast Web Receiver app used by QuikkPlay for:

- video, audio, and image playback
- subtitle track activation with `subtitleAssetId` mapping
- sender/receiver sync over `urn:x-cast:com.example.quikkplay.receiver`

## Files

- `receiver.html`: receiver shell and CAF loader
- `receiver.css`: lightweight styling for the receiver shell
- `receiver.js`: minimal CAF receiver used for baseline bring-up testing
- `receiver.rich.js`: archived richer implementation with subtitle commands and sender/receiver sync

## Current Test Mode

`receiver.js` is intentionally stripped down right now so QuikkPlay can answer one question first:

- can the custom receiver launch and handle a basic CAF `LOAD` at all?

The richer custom namespace and subtitle-sync implementation has been preserved in `receiver.rich.js` so it can be restored after baseline playback is confirmed.

## Hosting

Host these files on HTTPS, register the receiver URL in the Google Cast SDK Developer Console, and then set `quikkplay.castReceiverApplicationId` in `gradle.properties` (or via CI/local Gradle property overrides) to the registered app ID.
