# QuikkPlay Cast Receiver

This directory contains the custom Cast Web Receiver app used by QuikkPlay for:

- video, audio, and image playback
- subtitle track activation with `subtitleAssetId` mapping
- sender/receiver sync over `urn:x-cast:com.example.quikkplay.receiver`

## Files

- `receiver.html`: receiver shell and CAF loader
- `receiver.css`: lightweight styling for the receiver shell
- `receiver.js`: load interception, subtitle commands, and state sync

## Hosting

Host these files on HTTPS, register the receiver URL in the Google Cast SDK Developer Console, and then set `quikkplay.castReceiverApplicationId` in `gradle.properties` (or via CI/local Gradle property overrides) to the registered app ID.
