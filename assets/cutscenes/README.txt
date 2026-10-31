The civil war cutscene goes here, as:

    civil-war.mp4

The planet page plays it when a Freedom Authority fleet marches on a
Combine city (or the other way round), right after the player presses
PROCEED on the "RESUMING THE GALACTIC CIVIL WAR" event.

If the file is missing the page simply skips the film and starts the
battle, so nothing breaks while it is being dropped in.

To use a different file name or format, change CIVIL_WAR_VIDEO in
planet.html; to allow every such attack to play it (instead of only the
first), remove the civilWarSeen() check in civilWarBegins().
