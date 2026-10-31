/* =========================================================
   GALACTIC FRONT — phone mode

   The pages were laid out for a desktop: two columns, a tab
   strip that wraps into three lines, a fleet panel pinned to a
   corner, controls sized for a mouse, and two battle screens
   that only answer to a mouse and a keyboard. None of that is
   wrong on a monitor and all of it is wrong on a phone.

   Rather than fork every page, this file carries one set of
   rules and one switch. The switch is remembered per browser,
   a touch device or a narrow window starts in it, and turning
   it off is the same button, so a player who dislikes it is
   never stuck.

   On the galaxy it does more than restyle: the map can be
   panned and pinched, the worlds are listed by name (forty
   dots on a phone are not a map), and a fleet is sent by
   tapping a world instead of right-clicking one, which a
   phone cannot do.

   Loaded by every page, after i18n.js, so the labels are in
   the player's language.
   ========================================================= */

(function () {

    const KEY = "gf_phone";
    const VERSION = 4;

    const root = document.documentElement;

    const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const narrow = window.innerWidth <= 900;

    function T(s) {
        return typeof window.t === "function" ? window.t(s) : s;
    }

    function escapeHTML(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    /* The choice belongs to a kind of screen. A player who pressed DESK
       once at a monitor was then handed the desk layout on their phone,
       where the dock, the world list and the right button do not exist:
       so a stored choice is only honoured on the kind of device that made
       it, and a phone starts in phone mode whatever the monitor said. */
    const DEVICE_KEY = "gf_phone_device";

    const device = coarse ? "touch" : "desk";

    function readChoice() {
        try {
            const value = localStorage.getItem(KEY);
            if (value === null) { return null; }
            const made = localStorage.getItem(DEVICE_KEY);
            if (made && made !== device) { return null; }
            return value;
        } catch (e) { return null; }
    }

    function saveChoice(on) {
        try {
            localStorage.setItem(KEY, on ? "1" : "0");
            localStorage.setItem(DEVICE_KEY, device);
        } catch (e) { /* private mode */ }
    }

    const CSS = `
    /* =========================================================
       THE PAGE ITSELF
    ========================================================= */

    html.gf-phone { -webkit-text-size-adjust: 100%; }

    html.gf-phone body {
        overflow-x: hidden;
        overscroll-behavior-y: contain;
    }

    html.gf-phone button,
    html.gf-phone .btn,
    html.gf-phone .tab,
    html.gf-phone a {
        -webkit-tap-highlight-color: transparent;
    }

    /* sixteen pixels is the size at which a phone stops zooming
       into a field on its own every time it is touched */
    html.gf-phone input,
    html.gf-phone select,
    html.gf-phone textarea {
        font-size: 16px !important;
        min-height: 44px;
        max-width: 100%;
    }

    html.gf-phone button,
    html.gf-phone .btn {
        min-height: 42px;
    }

    /* a wide table or a row of figures scrolls rather than pushing
       the whole page sideways */
    html.gf-phone table {
        display: block;
        max-width: 100%;
        overflow-x: auto;
        white-space: nowrap;
    }

    /* =========================================================
       THE SWITCH
    ========================================================= */

    #gf-phone-button {
        position: fixed;
        left: calc(env(safe-area-inset-left, 0px) + 8px);
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
        top: auto;
        right: auto;
        z-index: 9999;
        min-width: 52px;
        height: 32px;
        padding: 0 8px;
        border-radius: 6px;
        border: 1px solid #3a5a8f;
        background: rgba(11, 20, 36, .92);
        color: #cfe3ff;
        font: bold 9px Arial, sans-serif;
        letter-spacing: 1px;
        cursor: pointer;
        opacity: .92;
        min-height: 0;
    }

    #gf-phone-button:hover { opacity: 1; }

    /* The corner it left held the map's own menu stack on the galaxy and
       the language switch on the index, and the two overlapped. The foot
       of the page is empty on every screen: the galaxy's sensor line and a
       phone's dock are the only things there, so the switch stands above
       whichever one this screen has. */
    html.gf-docked:not(.gf-phone) #gf-phone-button {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 76px);
    }

    html.gf-phone.gf-docked #gf-phone-button {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 62px);
    }

    /* =========================================================
       THE CONGRESS AND THE SOVIET
    ========================================================= */

    html.gf-phone #top {
        flex-wrap: wrap;
        gap: 6px 14px;
        padding: 8px 46px 8px 10px;
        position: static;
    }

    html.gf-phone #top h1 {
        font-size: 12px;
        letter-spacing: 2px;
        width: 100%;
    }

    html.gf-phone #top .grow { display: none; }
    html.gf-phone #top .back { padding: 0 12px; height: 36px; font-size: 10px; }
    html.gf-phone .stat { font-size: 9px; letter-spacing: .5px; }
    html.gf-phone .stat b { font-size: 12px; }

    html.gf-phone #main {
        grid-template-columns: 1fr !important;
        padding: 10px !important;
        gap: 12px !important;
    }

    html.gf-phone .panel { padding: 10px !important; }
    html.gf-phone .panel h2 { font-size: 10px; letter-spacing: 2px; }
    html.gf-phone #chamber svg { max-height: 38vh; }
    html.gf-phone #member { min-height: 0; }
    html.gf-phone #legend { gap: 8px; font-size: 10px; }
    html.gf-phone .chip,
    html.gf-phone .rchip { font-size: 9px; padding: 5px 7px; }

    html.gf-phone .tabs {
        flex-wrap: nowrap !important;
        overflow-x: auto;
        gap: 4px;
        padding-bottom: 6px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
    }

    html.gf-phone .tab {
        flex: 0 0 auto;
        padding: 9px 11px;
        font-size: 9px;
        letter-spacing: 1px;
    }

    html.gf-phone .card { padding: 10px; }
    html.gf-phone .card h3 { font-size: 13px; }
    html.gf-phone .spons { grid-template-columns: 1fr; }
    html.gf-phone .tokens { gap: 6px; }
    html.gf-phone .token { flex: 1 1 40%; min-width: 0; padding: 8px 10px; }
    html.gf-phone .token b { font-size: 17px; }
    html.gf-phone .steps { flex-wrap: wrap; }
    html.gf-phone .steps div { flex: 1 1 30%; }
    html.gf-phone .fc { gap: 6px; }
    html.gf-phone .fc .nm { width: 82px; }

    html.gf-phone #toast {
        left: 10px;
        right: 10px;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
        transform: none;
        max-width: none;
        padding: 10px 12px;
        font-size: 12px;
    }

    /* =========================================================
       THE GALAXY: HEADER, DOCK, MAP
    ========================================================= */

    html.gf-phone .map-header {
        top: calc(env(safe-area-inset-top, 0px) + 48px);
        left: 10px;
        padding: 0;
        gap: 6px;
    }

    html.gf-phone .map-header h1 { font-size: 12px; letter-spacing: 2px; }
    html.gf-phone .map-header p { display: none; }

    html.gf-phone #player-faction-display {
        top: calc(env(safe-area-inset-top, 0px) + 68px);
        left: 10px;
        font-size: 9px;
        max-width: 60vw;
    }

    /* the main menu button is the one control every page shares */
    html.gf-phone .main-menu-button {
        top: calc(env(safe-area-inset-top, 0px) + 6px) !important;
        right: auto !important;
        left: 6px !important;
        width: auto !important;
        height: 34px !important;
        padding: 0 12px !important;
        font-size: 10px !important;
        letter-spacing: 1px;
    }

    /* forty planets, a mouse-sized dot each. The dots are enlarged to the
       room between two columns and no further: a hit box wider than that
       sits on top of the next world and a tap opens the wrong one. */
    html.gf-phone .planet {
        width: 26px;
        height: 26px;
        touch-action: manipulation;
    }

    html.gf-phone .planet:active {
        outline: 2px solid #ffd37a;
        outline-offset: 2px;
    }

    html.gf-phone .planet span {
        top: 30px;
        font-size: 9px;
        letter-spacing: 0;
        opacity: 0;
        pointer-events: none;
        transition: opacity .15s;
    }

    /* names appear once the map is close enough for them to fit */
    html.gf-phone.gf-map-zoomed .planet span { opacity: 1; }
    html.gf-phone .planet:hover { transform: none; }

    html.gf-phone .galaxy-map { touch-action: none; }

    html.gf-phone .fleet-marker {
        width: 30px;
        height: 30px;
        font-size: 12px;
        touch-action: manipulation;
    }

    html.gf-phone .fleet-marker:hover { transform: translate(-50%, -50%); }

    /* the dock takes the bottom strip, so the map is fitted above it:
       the southernmost worlds used to sit under the buttons */
    html.gf-phone .galaxy-map { height: calc(100% - 54px); }

    /* aiming: the fleet sheet would cover the very worlds being picked */
    html.gf-aim #fleet-command-panel {
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* pinch works, but a thumb on a train is not a precision instrument */
    #gf-zoom {
        position: fixed;
        right: 8px;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 62px);
        z-index: 2350;
        display: none;
        flex-direction: column;
        gap: 6px;
    }

    #gf-zoom.open { display: flex; }

    #gf-zoom button {
        width: 42px;
        height: 42px;
        min-height: 0;
        padding: 0;
        border-radius: 8px;
        border: 1px solid #3a5a8f;
        background: rgba(12, 26, 40, .94);
        color: #cfe3ff;
        font: bold 17px Arial, sans-serif;
        cursor: pointer;
    }

    #gf-zoom button:active { background: #1d3a6b; }

    /* the sensor line, out of the way of the dock and the thumb */
    html.gf-phone #fleet-status-display {
        top: calc(env(safe-area-inset-top, 0px) + 86px);
        left: 10px;
        bottom: auto;
        padding: 5px 8px;
        font-size: 9px;
        max-width: 58vw;
    }

    /* the fleet screen, as a sheet at the foot of the screen */
    html.gf-phone #fleet-command-panel {
        position: fixed !important;
        left: 8px !important;
        right: 8px !important;
        top: auto !important;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 62px) !important;
        width: auto !important;
        max-width: none !important;
        max-height: 56vh;
        overflow: auto;
        z-index: 2400 !important;
        border-radius: 10px;
        padding: 14px;
    }

    html.gf-phone #fleet-command-panel.collapsed {
        max-height: 52px !important;
        width: auto !important;
        overflow: hidden !important;
    }

    html.gf-phone #fleet-command-panel.collapsed > *:not(#close-fleet-panel):not(#min-fleet-panel):not(#fleet-panel-name) {
        display: none !important;
    }

    html.gf-phone #fleet-panel-name { font-size: 16px; }
    html.gf-phone .fleet-panel-row { font-size: 12px; margin: 6px 0; }
    html.gf-phone #fleet-send-hint { display: none !important; }
    html.gf-phone .dock-warning { font-size: 11px; }
    html.gf-phone .recruit-button { padding: 11px; font-size: 12px; }
    html.gf-phone #fleet-dock button,
    html.gf-phone #fleet-recruitment button {
        width: 100%;
        margin-top: 6px;
    }

    /* =========================================================
       THE DOCK (galaxy only)
    ========================================================= */

    #gf-phone-dock {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2300;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px calc(env(safe-area-inset-right, 0px) + 8px)
                  calc(env(safe-area-inset-bottom, 0px) + 7px)
                  calc(env(safe-area-inset-left, 0px) + 8px);
        background: linear-gradient(to top, rgba(4, 8, 14, .97), rgba(4, 8, 14, .82));
        border-top: 1px solid #1f3354;
    }

    #gf-phone-dock button {
        flex: 1 1 0;
        min-height: 46px;
        min-width: 0;
        padding: 0 8px;
        background: #0c1a28;
        color: #cfe3ff;
        border: 1px solid #3a5a8f;
        font: bold 10px Arial, sans-serif;
        letter-spacing: 1px;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    #gf-phone-dock button:disabled { opacity: .4; cursor: default; }
    #gf-phone-dock button.on { background: #1d3a6b; border-color: #7fb4ff; color: #fff; }

    /* =========================================================
       THE WORLD LIST
    ========================================================= */

    #gf-worlds {
        position: fixed;
        inset: 0;
        z-index: 4000;
        display: none;
        background: rgba(2, 5, 10, .72);
    }

    #gf-worlds.open { display: block; }

    #gf-worlds-card {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        max-height: 82vh;
        display: flex;
        flex-direction: column;
        padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
        background: #08101d;
        border-top: 1px solid #355690;
        border-radius: 12px 12px 0 0;
    }

    #gf-worlds-card h2 {
        margin: 0 0 8px;
        font: 900 12px Arial, sans-serif;
        letter-spacing: 3px;
        color: #8fb4e8;
    }

    #gf-worlds-close {
        position: absolute;
        top: 6px;
        right: 8px;
        width: 36px;
        height: 36px;
        min-height: 0;
        background: none;
        border: none;
        color: #9bb4d6;
        font-size: 20px;
        cursor: pointer;
    }

    #gf-worlds-search {
        width: 100%;
        margin-bottom: 8px;
        padding: 10px;
        background: #0a1424;
        color: #fff;
        border: 1px solid #355690;
        font-size: 16px;
    }

    #gf-worlds-list {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    .gf-world-group {
        position: sticky;
        top: 0;
        z-index: 1;
        margin: 10px 0 4px;
        padding: 4px 0;
        background: #08101d;
        font: bold 9px Arial, sans-serif;
        letter-spacing: 2px;
        color: #6f87aa;
    }

    .gf-world-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 54px;
        padding: 0 10px;
        margin-bottom: 4px;
        background: #0d192d;
        color: #e3ebf5;
        border: 1px solid #1f3354;
        text-align: left;
        font: 13px Arial, sans-serif;
        cursor: pointer;
    }

    .gf-world-row:active { background: #172a47; }
    .gf-world-row.mine { border-left: 3px solid #7dff9d; }

    .gf-world-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex: 0 0 auto;
        border: 1px solid rgba(255, 255, 255, .55);
    }

    .gf-world-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gf-world-owner { flex: 0 0 auto; font-size: 9px; letter-spacing: 1px; color: #8fa6c4; }
    .gf-world-none { padding: 16px 4px; color: #8fa6c4; font-size: 12px; }

    /* =========================================================
       SENDING A FLEET WITHOUT A RIGHT BUTTON
    ========================================================= */

    #gf-aim-banner {
        position: fixed;
        left: 8px;
        right: 8px;
        top: calc(env(safe-area-inset-top, 0px) + 44px);
        z-index: 4100;
        display: none;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        background: rgba(42, 32, 8, .96);
        border: 1px solid #d6a84b;
        color: #ffe3a8;
        font: bold 11px Arial, sans-serif;
        letter-spacing: .5px;
    }

    #gf-aim-banner.open { display: flex; }
    #gf-aim-banner span { flex: 1 1 auto; }

    #gf-aim-banner button {
        flex: 0 0 auto;
        min-height: 34px;
        padding: 0 12px;
        background: #2a1f08;
        color: #ffe3a8;
        border: 1px solid #d6a84b;
        font: bold 10px Arial, sans-serif;
    }

    html.gf-aim .planet { box-shadow: 0 0 0 2px #ffd37a, 0 0 14px rgba(255, 211, 122, .8); }

    #gf-note {
        position: fixed;
        left: 12px;
        right: 12px;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
        z-index: 4200;
        display: none;
        padding: 9px 12px;
        background: #14305a;
        border: 1px solid #5b8bd6;
        color: #fff;
        font: 12px Arial, sans-serif;
        text-align: center;
    }

    #gf-note.open { display: block; }

    /* =========================================================
       DIPLOMACY
    ========================================================= */

    html.gf-phone #dip-open {
        top: calc(env(safe-area-inset-top, 0px) + 92px);
        right: 8px;
        padding: 9px 12px;
        font-size: 10px;
        letter-spacing: 1px;
        z-index: 2100;
    }

    html.gf-phone #dip-tab { padding: 12px 10px 96px; }
    html.gf-phone #dip-tab h2 { font-size: 18px; letter-spacing: 3px; }
    html.gf-phone #dip-tab .dip-top { flex-wrap: wrap; gap: 8px; max-width: none; }
    html.gf-phone #dip-tab .dip-close { margin-left: 0; min-height: 38px; font-size: 10px; }
    html.gf-phone #dip-tab .dip-card { max-width: none; padding: 12px; }
    html.gf-phone #dip-tab .dip-clock { font-size: 28px; }
    html.gf-phone #dip-tab .dip-big { font-size: 13px; }
    html.gf-phone #dip-tab .dip-btn { min-height: 40px; font-size: 10px; }
    html.gf-phone #dip-tab .dip-sub,
    html.gf-phone #dip-tab .dip-line { line-height: 1.6; }

    /* the dock only exists on the galaxy; elsewhere the two round
       buttons belong in the corner, not above an empty strip */
    html.gf-docked #gf-note { bottom: calc(env(safe-area-inset-bottom, 0px) + 66px); }

    /* =========================================================
       THE PLANET
    ========================================================= */

    html.gf-phone .planet-page,
    html.gf-phone .planet-world {
        height: 100vh;
        height: 100dvh;
    }

    html.gf-phone .planet-back {
        top: calc(env(safe-area-inset-top, 0px) + 6px);
        left: 6px;
        bottom: auto;
        height: 34px;
        padding: 0 12px;
        font-size: 10px;
        z-index: 1400;
    }

    html.gf-phone .planet-top {
        top: calc(env(safe-area-inset-top, 0px) + 50px);
        left: 10px;
    }

    html.gf-phone .planet-top h1 { font-size: 20px; letter-spacing: 3px; }
    html.gf-phone .planet-top p { margin-top: 4px; font-size: 9px; letter-spacing: 2px; }

    html.gf-phone .planet-globe {
        width: min(88vw, 48vh);
        height: min(88vw, 48vh);
        min-width: 0;
        min-height: 0;
    }

    /* a city is a 12 px dot on a desk and a thumb target here */
    html.gf-phone .city {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 48px;
        min-height: 48px;
        padding: 2px;
    }

    html.gf-phone .city-marker { width: 20px; height: 20px; }
    html.gf-phone .city span { margin-top: 4px; font-size: 9px; letter-spacing: 0; }
    html.gf-phone .city:hover .city-marker { transform: none; }

    html.gf-phone #fleet-panel {
        position: fixed;
        left: 8px;
        right: 8px;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
        top: auto;
        width: auto;
        max-height: 50vh;
        padding: 14px;
        border-radius: 10px;
        z-index: 1600;
    }

    html.gf-phone #fleet-panel h2 { font-size: 14px; margin-bottom: 10px; }
    html.gf-phone #fleet-menu {
        width: auto;
        left: 8px;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        max-height: 82vh;
        overflow-y: auto;
        padding: 18px;
    }

    html.gf-phone #fleet-menu h2 { font-size: 17px; letter-spacing: 3px; }
    html.gf-phone .fleet-menu-buttons { flex-direction: column; }

    /* the city, the buildings and the war report are all sheets */
    html.gf-phone #city-panel,
    html.gf-phone #buildings-panel,
    html.gf-phone #war-city-info {
        position: fixed !important;
        left: 8px !important;
        right: 8px !important;
        top: auto !important;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 8px) !important;
        width: auto !important;
        max-width: none !important;
        max-height: 52vh !important;
        overflow-y: auto !important;
        transform: none !important;
        border-radius: 10px !important;
        z-index: 1700 !important;
    }

    html.gf-phone #city-panel-close,
    html.gf-phone #war-city-close {
        width: 40px;
        height: 40px;
        min-height: 0;
    }

    /* =========================================================
       THE CITY BATTLE
    ========================================================= */

    html.gf-phone .battle-page { height: 100vh; height: 100dvh; }
    html.gf-phone #battleCanvas { touch-action: none; }

    html.gf-phone .battle-header {
        top: calc(env(safe-area-inset-top, 0px) + 46px);
        left: 10px;
        right: 10px;
        transform: none;
    }

    html.gf-phone .battle-header h1 { font-size: 15px; letter-spacing: 2px; }
    html.gf-phone .battle-header p { margin: 3px 0; font-size: 9px; letter-spacing: 1px; }
    html.gf-phone .unit-key { display: none; }

    html.gf-phone .status {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 52px);
        width: calc(100vw - 16px);
        min-width: 0;
        padding: 8px 10px;
        font-size: 11px;
    }

    html.gf-phone #victory-screen {
        width: calc(100vw - 24px);
        min-width: 0;
        max-height: 82vh;
        overflow-y: auto;
        padding: 18px 14px;
    }

    html.gf-phone #victory-title { font-size: 24px; letter-spacing: 3px; }
    html.gf-phone #victory-description,
    html.gf-phone #battle-loss-summary { font-size: 12px; }

    html.gf-phone #victory-final-card {
        width: calc(100vw - 24px) !important;
        min-width: 0 !important;
        padding: 18px 16px !important;
        max-height: 82vh;
        overflow-y: auto;
    }

    html.gf-phone #victory-caption-title { font-size: 26px !important; letter-spacing: 4px !important; }
    html.gf-phone #battle-return-button,
    html.gf-phone #victory-continue { min-height: 44px; width: 100%; }

    /* =========================================================
       THE SPACE BATTLE
    ========================================================= */

    html.gf-phone #c { touch-action: none; }

    html.gf-phone #msg {
        top: calc(env(safe-area-inset-top, 0px) + 46px);
        max-width: 58vw;
        font-size: 11px;
    }

    html.gf-phone #end-title { font-size: 32px; letter-spacing: 6px; }
    html.gf-phone #end-text { font-size: 12px; padding: 0 16px; }
    html.gf-phone #end-screen,
    html.gf-phone #lost { padding: 16px; }
    html.gf-phone #lost .btn { width: 100%; max-width: 320px; }

    /* =========================================================
       THE MAIN MENU
    ========================================================= */

    html.gf-phone .main-menu h1 { font-size: 30px; letter-spacing: 5px; }
    html.gf-phone .main-menu h2 { font-size: 14px; letter-spacing: 3px; }
    html.gf-phone .main-menu p { font-size: 11px; padding: 0 16px; line-height: 1.6; }

    html.gf-phone .main-menu button,
    html.gf-phone .faction-button,
    html.gf-phone #player-info button {
        width: min(340px, 86vw) !important;
        font-size: 13px !important;
    }

    html.gf-phone .lang-switch { left: 10px; right: auto; top: 10px; }

    /* =========================================================
       MUSIC, NEWS AND A TOAST OR TWO
    ========================================================= */

    /* the two round buttons and the clips they open sit clear
       of the dock, the sheet and the switch */
    html.gf-phone #gf-music-button {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
        right: 8px !important;
        width: 38px !important;
        height: 38px !important;
        min-height: 0 !important;
    }

    html.gf-phone #gf-news-button {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
        right: 54px !important;
        width: 38px !important;
        height: 38px !important;
        min-height: 0 !important;
    }

    /* the galaxy has room in its top corner; the fleet sheet would
       otherwise open over these two */
    html.gf-phone.gf-docked #gf-music-button,
    html.gf-phone.gf-docked #gf-news-button {
        top: calc(env(safe-area-inset-top, 0px) + 44px) !important;
        bottom: auto !important;
    }

    /* the space battle's order bar owns the foot of the screen */
    html.gf-phone.gf-space #gf-music-button {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 64px) !important;
    }

    html.gf-phone.gf-space #gf-news-button {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 64px) !important;
    }

    html.gf-phone #gf-music-panel,
    html.gf-phone #gf-news-panel {
        left: 8px !important;
        right: 8px !important;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 56px) !important;
        width: auto !important;
        max-width: none !important;
        max-height: 58vh !important;
        padding: 12px !important;
    }

    html.gf-phone.gf-docked #gf-music-panel,
    html.gf-phone.gf-docked #gf-news-panel {
        top: calc(env(safe-area-inset-top, 0px) + 92px) !important;
        bottom: auto !important;
        max-height: 58vh !important;
    }

    html.gf-phone.gf-space #gf-music-panel,
    html.gf-phone.gf-space #gf-news-panel {
        bottom: calc(env(safe-area-inset-bottom, 0px) + 112px) !important;
    }

    html.gf-phone #gf-news-panel { max-height: 70vh !important; }

    /* the host's own tools, stacked clear of the dock */
    html.gf-phone #game-economy-badge { bottom: 200px !important; max-width: 60vw !important; }
    `;

    function inject() {

        if (document.getElementById("gf-phone-style")) { return; }

        const style = document.createElement("style");
        style.id = "gf-phone-style";
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);

    }

    /* ---------------------------------------------------------
       the switch
    --------------------------------------------------------- */

    function label() {

        const button = document.getElementById("gf-phone-button");
        const dock = document.getElementById("gf-phone-dock");
        const on = root.classList.contains("gf-phone");

        if (button) {
            button.textContent = on ? "DESK" : "PHONE";
            button.setAttribute("aria-label", T(on ? "DESKTOP MODE" : "PHONE MODE"));
            button.title = T(on ? "DESKTOP MODE" : "PHONE MODE");
        }

        const inDock = dock && dock.querySelector('[data-gf="mode"]');

        if (inDock) {
            inDock.textContent = T(on ? "DESKTOP MODE" : "PHONE MODE");
            inDock.title = inDock.textContent;
        }

    }

    function set(on, remember) {

        root.classList.toggle("gf-phone", !!on);

        if (!on) {
            root.classList.remove("gf-map-zoomed", "gf-aim");
            const map = document.getElementById("galaxy-map");
            if (map) { map.style.transform = ""; }
        }

        if (remember !== false) { saveChoice(!!on); }

        label();

        document.dispatchEvent(new CustomEvent("gf-phone-change", { detail: { on: !!on } }));

    }

    function makeSwitch() {

        if (document.getElementById("gf-phone-button")) { return; }

        const button = document.createElement("button");
        button.id = "gf-phone-button";
        button.type = "button";
        button.addEventListener("click", function () {
            set(!root.classList.contains("gf-phone"));
        });

        document.body.appendChild(button);

    }

    /* ---------------------------------------------------------
       the galaxy: dock, world list, sending a fleet
    --------------------------------------------------------- */

    function galaxy() {

        const map = document.getElementById("galaxy-map");
        if (!map) { return false; }

        let dock = document.getElementById("gf-phone-dock");

        root.classList.add("gf-docked");

        if (!dock) {

            dock = document.createElement("div");
            dock.id = "gf-phone-dock";

            dock.innerHTML =
                '<button type="button" data-gf="worlds">' + escapeHTML(T("WORLDS")) + "</button>" +
                '<button type="button" data-gf="send">' + escapeHTML(T("SEND FLEET")) + "</button>" +
                '<button type="button" data-gf="mode"></button>';

            document.body.appendChild(dock);
            dock.style.display = "none";

            const worlds = dock.querySelector('[data-gf="worlds"]');
            const send = dock.querySelector('[data-gf="send"]');
            const mode = dock.querySelector('[data-gf="mode"]');

            worlds.addEventListener("click", function () { openWorlds(map); });

            send.addEventListener("click", function () {
                if (!panelVisible()) {
                    note(T("SELECT A FLEET FIRST"));
                    return;
                }
                aim(!root.classList.contains("gf-aim"), map);
            });

            mode.addEventListener("click", function () {
                set(!root.classList.contains("gf-phone"));
            });

            /* the send button only makes sense while a fleet is selected */
            const panel = document.getElementById("fleet-command-panel");

            /* a fleet is selected when the panel is open and filled in.
               It used to also require the panel to be un-minimised, which
               disarmed sending exactly when the player minimised the sheet
               to see the map they meant to send it across. */
            const sync = function () {
                const shown = !!fleetSelected();
                send.disabled = !shown;
                if (!shown) { aim(false, map); }
            };

            if (panel && window.MutationObserver) {
                new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ["class"] });
            }

            sync();

        }

        dock.style.display = root.classList.contains("gf-phone") ? "flex" : "none";

        const cam = camera(map);

        if (window.GF_PHONE && cam) { window.GF_PHONE.zoom = cam; }

        zoomPad();

        document.addEventListener("gf-phone-change", function () {
            if (dock) { dock.style.display = root.classList.contains("gf-phone") ? "flex" : "none"; }
            if (!root.classList.contains("gf-phone")) { aim(false, map); }
        });

        return true;

    }

    function panelVisible() {
        const panel = document.getElementById("fleet-command-panel");
        return !!(panel && panel.classList.contains("visible") &&
                  !panel.classList.contains("collapsed"));
    }

    /* which fleet is in hand: the panel is opened by the page before it is
       filled in, so an open panel with no status line means no fleet yet */
    function fleetSelected() {

        const panel = document.getElementById("fleet-command-panel");

        if (!panel || !panel.classList.contains("visible")) { return null; }

        const status = document.getElementById("fleet-panel-status");

        if (!status || !String(status.textContent || "").trim()) { return null; }

        const name = document.getElementById("fleet-panel-name");

        return String((name && name.textContent) || "").trim() || null;

    }

    /* + / - / fit, for the players who will not pinch in public */
    function zoomPad() {

        if (document.getElementById("gf-zoom")) { return; }

        const pad = document.createElement("div");
        pad.id = "gf-zoom";
        pad.innerHTML =
            '<button type="button" data-zoom="in" aria-label="' + escapeHTML(T("ZOOM IN")) + '">+</button>' +
            '<button type="button" data-zoom="out" aria-label="' + escapeHTML(T("ZOOM OUT")) + '">\u2212</button>' +
            '<button type="button" data-zoom="fit" aria-label="' + escapeHTML(T("FIT THE MAP")) + '">\u25a1</button>';

        pad.addEventListener("click", function (ev) {

            const button = ev.target && ev.target.closest ? ev.target.closest("[data-zoom]") : null;

            if (!button) { return; }

            const api = window.GF_PHONE && window.GF_PHONE.zoom;

            if (!api) { return; }

            const what = button.dataset.zoom;

            api(what === "in" ? 1.4 : what === "out" ? 1 / 1.4 : 0);

        });

        document.body.appendChild(pad);

        const show = function () { pad.classList.toggle("open", root.classList.contains("gf-phone")); };

        show();

        document.addEventListener("gf-phone-change", show);

    }

    let noteTimer = null;

    function note(text) {

        let el = document.getElementById("gf-note");

        if (!el) {
            el = document.createElement("div");
            el.id = "gf-note";
            el.setAttribute("role", "status");
            document.body.appendChild(el);
        }

        el.textContent = text;
        el.classList.add("open");

        clearTimeout(noteTimer);
        noteTimer = setTimeout(function () { el.classList.remove("open"); }, 2600);

    }

    /* The page answers a send in #fleet-message, which lives inside the
       sheet the aim has just hidden: a refusal used to look like a tap
       that did nothing at all. Probe it until it stops saying "Sending". */
    function reportFleetMessage() {

        const box = document.getElementById("fleet-message");

        if (!box) { return; }

        let depth = 0;

        const probe = function () {

            depth++;

            const text = String(box.textContent || "").trim();

            if (text && !/^Sending/i.test(text) && !/^A enviar/i.test(text)) {
                note(text);
                return;
            }

            if (depth < 3) { setTimeout(probe, 900); }

        };

        setTimeout(probe, 400);

    }

    let aiming = false;

    /* a tap that sent a fleet is not a tap that wants the camera reset */
    let sentTap = 0;

    function aim(on, map) {

        /* aiming at nothing is not a mode: the sheet is full of
           buttons and one of them can reach here with no fleet */
        if (on && !fleetSelected()) {
            note(T("SELECT A FLEET FIRST"));
            on = false;
        }

        aiming = !!on;

        let banner = document.getElementById("gf-aim-banner");

        if (on) {

            if (!banner) {

                banner = document.createElement("div");
                banner.id = "gf-aim-banner";
                banner.innerHTML =
                    '<span></span>' +
                    '<button type="button">' + escapeHTML(T("CANCEL")) + "</button>";

                banner.querySelector("button").addEventListener("click", function () {
                    aim(false, map);
                });

                document.body.appendChild(banner);

            }

            banner.querySelector("span").textContent =
                T("TAP A WORLD ON THE MAP TO SEND THIS FLEET") +
                (fleetSelected() ? " \u00b7 " + fleetSelected() : "");
            banner.classList.add("open");
            root.classList.add("gf-aim");

        } else if (banner) {
            banner.classList.remove("open");
            root.classList.remove("gf-aim");
        }

        if (!on) { root.classList.remove("gf-aim"); }

    }

    /* a phone has no right button: tap the world, and the map's own
       right-click handler receives the click it knows how to read */
    function tapToSend(map) {

        map.addEventListener("click", function (ev) {

            if (!aiming) { return; }

            const planet = ev.target && ev.target.closest ? ev.target.closest(".planet") : null;

            if (!planet) { return; }

            ev.preventDefault();
            ev.stopPropagation();

            const rect = planet.getBoundingClientRect();

            map.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                button: 2,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            }));

            aim(false, map);

            sentTap = Date.now();

            reportFleetMessage();

        }, true);

        document.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape" && aiming) { aim(false, map); }
        });

    }

    /* ---------------------------------------------------------
       the world list: forty dots need names
    --------------------------------------------------------- */

    function openWorlds(map) {

        let sheet = document.getElementById("gf-worlds");

        if (!sheet) {

            sheet = document.createElement("div");
            sheet.id = "gf-worlds";
            sheet.innerHTML =
                '<div id="gf-worlds-card">' +
                    "<h2>" + escapeHTML(T("WORLDS")) + "</h2>" +
                    '<button type="button" id="gf-worlds-close" aria-label="' + escapeHTML(T("CLOSE")) + '">&#10005;</button>' +
                    '<input id="gf-worlds-search" type="search" autocomplete="off" placeholder="' + escapeHTML(T("SEARCH A WORLD")) + '">' +
                    '<div id="gf-worlds-list"></div>' +
                "</div>";

            sheet.addEventListener("click", function (ev) {
                if (ev.target === sheet) { closeWorlds(); }
            });

            sheet.querySelector("#gf-worlds-close").addEventListener("click", closeWorlds);

            sheet.querySelector("#gf-worlds-search").addEventListener("input", function () {
                paintWorlds(map, this.value);
            });

            document.body.appendChild(sheet);

        }

        sheet.classList.add("open");

        /* the same list means two things: go there, or send this fleet
           there. The heading says which one is in force. */
        const heading = sheet.querySelector("h2");

        if (heading) {
            heading.textContent = T(aiming ? "SEND THE FLEET TO A WORLD" : "WORLDS");
        }

        paintWorlds(map, "");

        const search = sheet.querySelector("#gf-worlds-search");
        if (search) { search.value = ""; }

    }

    function closeWorlds() {
        const sheet = document.getElementById("gf-worlds");
        if (sheet) { sheet.classList.remove("open"); }
    }

    function paintWorlds(map, filter) {

        const list = document.getElementById("gf-worlds-list");
        if (!list) { return; }

        const mine = (function () {
            try { return localStorage.getItem("playerFaction") || ""; } catch (e) { return ""; }
        })();

        const rows = [];

        map.querySelectorAll(".planet").forEach(function (el) {

            const name = el.dataset.name || "";
            let owner = el.dataset.owner || "";

            if (!owner) {
                if (el.classList.contains("combine")) { owner = "Combine"; }
                else if (el.classList.contains("freedom")) { owner = "Freedom Authority"; }
                else { owner = "Independents"; }
            }

            const color = window.getComputedStyle(el).backgroundColor || "#ffffff";

            rows.push({ name: name, owner: owner, color: color });

        });

        const needle = String(filter || "").trim().toLowerCase();

        const shown = rows.filter(function (r) {
            return !needle ||
                r.name.toLowerCase().indexOf(needle) !== -1 ||
                r.owner.toLowerCase().indexOf(needle) !== -1;
        });

        if (!shown.length) {
            list.innerHTML = '<div class="gf-world-none">' + escapeHTML(T("NO WORLD MATCHES")) + "</div>";
            return;
        }

        const rank = function (r) {
            if (mine && r.owner === mine) { return 0; }
            if (r.owner === "Combine") { return 1; }
            if (r.owner === "Freedom Authority") { return 2; }
            return 3;
        };

        shown.sort(function (a, b) {
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
        });

        let html = "";
        let group = null;

        for (const r of shown) {

            if (r.owner !== group) {
                group = r.owner;
                html += '<div class="gf-world-group">' + escapeHTML(group.toUpperCase()) + "</div>";
            }

            html += '<button type="button" class="gf-world-row' + (mine && r.owner === mine ? " mine" : "") +
                    '" data-world="' + escapeHTML(r.name) + '">' +
                    '<span class="gf-world-dot" style="background:' + escapeHTML(r.color) + '"></span>' +
                    '<span class="gf-world-name">' + escapeHTML(r.name) + "</span>" +
                    '<span class="gf-world-owner">' + escapeHTML(r.owner) + "</span>" +
                    "</button>";

        }

        list.innerHTML = html;

        list.querySelectorAll(".gf-world-row").forEach(function (row) {

            row.addEventListener("click", function () {

                const name = row.dataset.world;

                const planet = Array.from(map.querySelectorAll(".planet"))
                    .find(function (el) { return el.dataset.name === name; });

                closeWorlds();

                if (!planet) { return; }

                /* while aiming the list is the map's right button: the row
                   sends the fleet instead of walking into the world */
                if (aiming) {

                    const rect = planet.getBoundingClientRect();

                    map.dispatchEvent(new MouseEvent("contextmenu", {
                        bubbles: true,
                        cancelable: true,
                        button: 2,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2
                    }));

                    aim(false, map);

                    reportFleetMessage();

                    return;

                }

                planet.click();

            });

        });

    }

    /* ---------------------------------------------------------
       pan and pinch: the map is fitted to a desk, not a phone
    --------------------------------------------------------- */

    function camera(map) {

        if (map.dataset.gfCamera === "1") { return map.__gfZoom || null; }
        map.dataset.gfCamera = "1";

        let scale = 1;
        let tx = 0;
        let ty = 0;

        let pointers = new Map();
        let single = null;
        let pinch = null;
        let suppress = false;
        let longPress = null;

        const apply = function () {

            map.style.transformOrigin = "0 0";

            /* fitted: hand the transform back to the page, whose own
               entry animation reads it, instead of leaving a scale(1)
               behind that every later rect has to carry */
            if (scale <= 1.001 && Math.abs(tx) < 1 && Math.abs(ty) < 1) {
                map.style.transform = "";
                root.classList.remove("gf-map-zoomed");
                return;
            }

            map.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
            root.classList.toggle("gf-map-zoomed", scale > 1.2);

        };

        const clampAll = function () {

            const w = map.clientWidth;
            const h = map.clientHeight;

            tx = Math.max(Math.min(0, w - w * scale), Math.min(0, tx));
            ty = Math.max(Math.min(0, h - h * scale), Math.min(0, ty));

        };

        const zoomAt = function (cx, cy, factor) {

            const next = Math.max(1, Math.min(3, scale * factor));

            if (next === scale) { return; }

            tx = cx - (cx - tx) * (next / scale);
            ty = cy - (cy - ty) * (next / scale);
            scale = next;

            clampAll();
            apply();

        };

        /* the +/- buttons and the double tap share one entry point */
        const api = function (factor) {

            if (!factor) {
                scale = 1;
                tx = 0;
                ty = 0;
                apply();
                return;
            }

            zoomAt(map.clientWidth / 2, map.clientHeight / 2, factor);

        };

        map.__gfZoom = api;

        map.addEventListener("touchstart", function (ev) {

            if (!root.classList.contains("gf-phone")) { return; }

            /* the switch, the fleet sheet and the dock stay usable */
            if (ev.target.closest && ev.target.closest("#fleet-command-panel, #gf-phone-dock, #gf-worlds, #gf-aim-banner")) {
                return;
            }

            for (const t of ev.changedTouches) {
                pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
            }

            if (pointers.size === 2) {

                clearTimeout(longPress);

                const p = Array.from(pointers.values());

                pinch = {
                    dist: Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)),
                    mx: (p[0].x + p[1].x) / 2,
                    my: (p[0].y + p[1].y) / 2
                };

                single = null;
                ev.preventDefault();

            } else if (pointers.size === 1) {

                const p = Array.from(pointers.values())[0];

                single = { sx: p.x, sy: p.y, tx: tx, ty: ty, moved: false };

            }

        }, { passive: false });

        map.addEventListener("touchmove", function (ev) {

            if (!root.classList.contains("gf-phone")) { return; }

            for (const t of ev.changedTouches) {
                pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
            }

            if (pointers.size === 2 && pinch) {

                const p = Array.from(pointers.values());

                const dist = Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y));
                const mx = (p[0].x + p[1].x) / 2;
                const my = (p[0].y + p[1].y) / 2;

                const box = map.getBoundingClientRect();
                zoomAt(mx - box.left, my - box.top, dist / pinch.dist);

                tx += mx - pinch.mx;
                ty += my - pinch.my;

                pinch = { dist: dist, mx: mx, my: my };

                clampAll();
                apply();

                suppress = true;
                ev.preventDefault();

            } else if (pointers.size === 1 && single) {

                const p = Array.from(pointers.values())[0];

                const dx = p.x - single.sx;
                const dy = p.y - single.sy;

                if (!single.moved && Math.hypot(dx, dy) > 8) { single.moved = true; }

                if (single.moved) {

                    tx = single.tx + dx;
                    ty = single.ty + dy;

                    clampAll();
                    apply();

                    suppress = true;
                    ev.preventDefault();

                }

            }

        }, { passive: false });

        const end = function (ev) {

            if (!root.classList.contains("gf-phone")) { return; }

            for (const t of ev.changedTouches) {
                pointers.delete(t.identifier);
            }

            if (pointers.size === 0) {

                pinch = null;
                single = null;

                /* the click that follows a pan is not a tap on a world */
                if (suppress) {
                    setTimeout(function () { suppress = false; }, 60);
                }

            } else if (pointers.size === 1) {
                pinch = null;
                single = null;
            }

        };

        map.addEventListener("touchend", end, { passive: true });
        map.addEventListener("touchcancel", end, { passive: true });

        /* a pan must not open a planet; a clean tap on one should */
        map.addEventListener("click", function (ev) {

            if (suppress) {
                ev.preventDefault();
                ev.stopPropagation();
                suppress = false;
                return;
            }

            if (!root.classList.contains("gf-phone")) { return; }

            /* a tap that sent a fleet must not throw away the zoom the
               player set to see the worlds they were aiming at */
            if (Date.now() - sentTap < 600) { return; }

            const planet = ev.target && ev.target.closest ? ev.target.closest(".planet") : null;

            /* let the map's own entry animation start from the fitted view */
            if (planet) {
                map.style.transform = "";
                root.classList.remove("gf-map-zoomed");
                scale = 1;
                tx = 0;
                ty = 0;
            }

        }, true);

        /* two quick taps on empty space zoom, and two more come back */
        let lastTap = 0;

        map.addEventListener("touchend", function (ev) {

            if (!root.classList.contains("gf-phone") || aiming) { return; }
            if (ev.touches && ev.touches.length) { return; }
            if (ev.target && ev.target.closest && ev.target.closest(".planet")) { return; }

            const now = Date.now();

            if (now - lastTap < 320) {
                api(scale < 1.6 ? 2 : 0);
                lastTap = 0;
            } else {
                lastTap = now;
            }

        }, { passive: true });

        document.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape" && scale > 1) {
                scale = 1;
                tx = 0;
                ty = 0;
                apply();
            }
        });

        return api;

    }

    /* ---------------------------------------------------------
       start
    --------------------------------------------------------- */

    function start() {

        inject();

        if (!document.getElementById("gf-phone-style")) { return; }

        /* which page this is decides where the two round buttons can
           stand without covering a bar */
        if (document.getElementById("battleCanvas")) { root.classList.add("gf-battle"); }
        if (document.getElementById("touch-orders")) { root.classList.add("gf-space"); }
        if (document.querySelector(".main-menu-button")) { root.classList.add("gf-menu"); }

        /* there is always a switch: a desk can want the phone layout,
           and a phone must be able to leave it */
        makeSwitch();

        galaxy();

        label();

        /* the dictionary may load after this file on a slow connection */
        window.addEventListener("load", label);

        /* the planet page builds its sheets after the map is clicked */
        document.addEventListener("gf-i18n-change", label);

    }

    /* the class is set before the first paint, so a phone never sees
       the desk layout first; the controls are added once there is a body */
    inject();

    (function () {

        const params = new URLSearchParams(window.location.search);
        const forced = params.get("phone");

        if (forced === "1" || forced === "0") {
            saveChoice(forced === "1");
        }

        const saved = readChoice();

        const on = saved === null ? (coarse || narrow) : saved === "1";

        root.classList.toggle("gf-phone", on);
        root.classList.toggle("gf-touch", coarse);

        /* a window dragged narrow, with no choice made yet, follows it */
        if (saved === null && !coarse) {

            let timer = null;

            window.addEventListener("resize", function () {

                clearTimeout(timer);

                timer = setTimeout(function () {
                    if (readChoice() === null) {
                        set(window.innerWidth <= 900, false);
                    }
                }, 250);

            });

        }

    })();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    /* the pages read the switch too */
    window.GF_PHONE = {
        version: VERSION,
        get: function () { return root.classList.contains("gf-phone"); },
        set: function (on) { set(on); },
        selected: function () { return fleetSelected(); }
    };

    /* the map's right-click handler is bound during parse, long before
       this file runs on DOMContentLoaded; tapToSend is hooked there */
    document.addEventListener("DOMContentLoaded", function () {
        const map = document.getElementById("galaxy-map");
        if (map) { tapToSend(map); }
    });

})();
