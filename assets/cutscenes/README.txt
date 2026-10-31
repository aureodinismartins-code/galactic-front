The civil war cutscene, played by planet.html when a Freedom Authority
fleet marches on a Combine city (or the other way round), right after the
player presses PROCEED on the "RESUMING THE GALACTIC CIVIL WAR" event.

    civil-war.mp4    1280x720, H.264 High / AAC stereo, 71.8 s, 14.1 MB
                     index at the front (faststart), so it begins playing
                     before the whole file has arrived

If the file is missing the page skips the film and starts the battle, so
the game never depends on it being present.

To use a different file name or format, change CIVIL_WAR_VIDEO in
planet.html; to let every such attack play it, drop the civilWarSeen()
check in civilWarBegins().

--------------------------------------------------------------------

The Freedom Authority election film, played by every screen from
elections.js once both chairs are decided in a war: the event says who
won the presidency and who won the speakership, and PROCEED plays it.
Only Freedom Authority players see it.

    president-arrives-at-congress.mp4    the President arriving at
                                         the Congress

The file is looked for at that exact path. If it is missing the event
still appears and the film is simply skipped, so nothing blocks the map.
