/* =========================================================
   GALACTIC FRONT — phone mode

   The pages were laid out for a desktop: two columns, a tab
   strip that wraps into three lines, a fleet panel pinned to a
   corner, and controls sized for a mouse. None of that is
   wrong on a monitor and all of it is wrong on a phone.

   Rather than fork every page, this file carries one set of
   rules and one switch. The switch is remembered per browser,
   and a touch device or a narrow window starts in it. Turning
   it off is the same button, so a player who dislikes it is
   never stuck.

   Loaded by every page, after i18n.js, so the label is in the
   player's language.
   ========================================================= */

(function () {

    const KEY = "gf_phone";

    const root = document.documentElement;

    const CSS = `
    /* the page itself */
    html.gf-phone body { overflow-x: hidden; }
    html.gf-phone #top { flex-wrap: wrap; gap: 8px 14px; padding: 8px 12px; position: static; }
    html.gf-phone #top h1 { font-size: 15px; letter-spacing: 2px; width: 100%; }
    html.gf-phone #top .seal { width: 22px; height: 22px; }
    html.gf-phone .stat { font-size: 10px; letter-spacing: .5px; }
    html.gf-phone .stat b { font-size: 13px; }

    /* one column, whatever the grid said */
    html.gf-phone #main { grid-template-columns: 1fr !important; padding: 10px !important; gap: 12px !important; }
    html.gf-phone .panel { padding: 10px !important; }
    html.gf-phone .panel h2 { font-size: 11px; letter-spacing: 2px; }

    /* the tab strip scrolls sideways instead of stacking into the page */
    html.gf-phone .tabs { flex-wrap: nowrap !important; overflow-x: auto; gap: 4px; padding-bottom: 6px;
        -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
    html.gf-phone .tab { flex: 0 0 auto; padding: 9px 12px; font-size: 10px; letter-spacing: 1px; }

    /* everything meant to be pressed is a thumb wide */
    html.gf-phone button,
    html.gf-phone .btn,
    html.gf-phone .back { min-height: 42px; font-size: 13px; }
    html.gf-phone select,
    html.gf-phone input { min-height: 42px; font-size: 14px; width: 100%; }
    html.gf-phone .chip,
    html.gf-phone .rchip { font-size: 10px; padding: 5px 8px; }

    /* the chamber: still readable, never taller than the screen */
    html.gf-phone #chamber svg { max-height: 42vh; }
    html.gf-phone #member { min-height: 0; }

    /* the map and the fleet panel */
    html.gf-phone .map-header { position: static; padding: 8px 10px; }
    html.gf-phone .map-header h1 { font-size: 15px; }
    html.gf-phone .main-menu-button { position: static; width: 100%; height: 42px; margin: 6px 10px; }
    html.gf-phone #player-faction-display { position: static; margin: 0 10px 6px; }
    /* fixed, not absolute: on a phone the page scrolls, and a panel anchored
       to the document can end up below the fold where it is plainly gone */
    html.gf-phone #fleet-command-panel,
    html.gf-phone .fleet-panel { position: fixed !important; left: 10px !important; right: 10px !important;
        bottom: 10px !important; top: auto !important; width: auto !important;
        max-height: 58vh; overflow: auto; z-index: 2000 !important; }
    html.gf-phone .planet-panel { width: calc(100vw - 20px) !important; max-height: 84vh; overflow: auto; }
    html.gf-phone .planet-top { position: static; padding: 8px 10px; }
    html.gf-phone .planet-top h1 { font-size: 22px; }
    html.gf-phone canvas { max-width: 100%; }

    /* the news paper */
    html.gf-phone .news-grid,
    html.gf-phone .news-columns { grid-template-columns: 1fr !important; }

    /* the switch itself: out of the way of the fleet panel */
    #gf-phone-button { position: fixed; left: 10px; bottom: 10px; z-index: 9999;
        padding: 9px 13px; border-radius: 6px; border: 1px solid #3a5a8f;
        background: rgba(11, 20, 36, .92); color: #cfe3ff; font-size: 11px; font-weight: bold;
        letter-spacing: 1px; cursor: pointer; opacity: .9; font-family: inherit; }
    #gf-phone-button:hover { opacity: 1; }
    `;

    function inject() {

        if (document.getElementById("gf-phone-style")) { return; }

        const style = document.createElement("style");
        style.id = "gf-phone-style";
        style.textContent = CSS;
        document.head.appendChild(style);

    }

    function label() {

        const button = document.getElementById("gf-phone-button");
        if (!button) { return; }

        const on = root.classList.contains("gf-phone");
        const t = window.t;

        button.textContent = typeof t === "function"
            ? t(on ? "DESKTOP MODE" : "PHONE MODE")
            : (on ? "DESKTOP MODE" : "PHONE MODE");
        button.title = button.textContent;

    }

    function set(on) {

        if (on) { root.classList.add("gf-phone"); }
        else { root.classList.remove("gf-phone"); }

        try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* private mode */ }

        label();

    }

    function makeButton() {

        if (document.getElementById("gf-phone-button")) { return; }

        const button = document.createElement("button");
        button.id = "gf-phone-button";
        button.type = "button";

        button.addEventListener("click", function () {
            set(!root.classList.contains("gf-phone"));
        });

        document.body.appendChild(button);

    }

    function start() {

        inject();

        let saved = null;

        try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }

        if (saved === "1" || saved === "0") {
            set(saved === "1");
        } else {
            /* a touch screen, or a window too narrow for two columns */
            const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
            const narrow = window.innerWidth <= 900;
            set(coarse || narrow);
        }

        makeButton();
        label();

        /* the dictionary may load after this file on a slow connection */
        window.addEventListener("load", label);

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

})();
