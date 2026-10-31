# The stations of the ship's wireless

Six stations, six folders. Put the audio files in the folder of the station
they belong to, then write their names into `stations.json`.

```
assets/music/
    stations.json
    jazz/            ← jazz
    classical/       ← classical
    aura/            ← aura
    commercials/     ← radio commercials
    fbc-news/        ← FBC news bulletins, in English
    fbc-news-pt/     ← FBC news bulletins, in Portuguese
```

## Adding a track

1. Copy the file into the folder of its station, e.g. `assets/music/jazz/blue-hour.mp3`.
2. Add its **file name** (not the folder, not the whole path) to that station's
   `tracks` list in `stations.json`:

```json
{
    "id": "jazz",
    "label": "JAZZ",
    "folder": "jazz",
    "tracks": ["blue-hour.mp3", "night-train.mp3"]
}
```

3. Commit both. Reload the game — the station plays its list in order and
   loops back to the first track when it reaches the end.

## Notes

- mp3, ogg, wav, m4a and opus are fine; mp3 is the safest.
- Keep each file a few megabytes at most: these are served from the same place
  the game is, and a slow connection stutters. Music at 128 kbps is plenty.
- A station with an empty `tracks` list still appears, and says so when picked.
- A station file that will not play is skipped and the next one starts.
- The stations are **each player's own choice** — they play on that player's
  screen and never change what the host has on the shared wireless above them.
- A station's label is translated in `i18n.js` (the English label is the key).
