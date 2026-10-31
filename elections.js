/* =========================================================
   GALACTIC FRONT — the elections, told to both sides

   Once a faction's chairs are decided in a war, that faction's screens
   raise one event: who won what, and PROCEED plays that faction's film.

       Freedom Authority   the President of the Freedom Authority and the
                           Speaker of the Congress
       Combine             the High Commissar of the Supreme Soviet, and no
                           other chair: the Soviet's card speaks only of the
                           Soviet's own office

   Who won is decided by the database (sql/2026-11-55 and 2026-11-56), so
   every screen reads the same names; a browser only remembers that it has
   already watched its own faction's scene, per war.

   No dependencies: included by every screen.
========================================================= */

(function () {

    "use strict";

    const SIDES = {

        freedom: {
            key: "gf.fa-elections",
            heading: "THE FREEDOM AUTHORITY ELECTIONS",
            lead: "The elections have been held:",
            race: "won the presidential race, with",
            seat: "winning for Speaker of Congress.",
            video: "assets/cutscenes/president-arrives-at-congress.mp4",
            accent: "#3f7f9f",
            gold: "#ffd37a",
            glow: "rgba(63,127,159,.35)"
        },

        combine: {
            key: "gf.combine-elections",
            heading: "THE SUPREME SOVIET ELECTIONS",
            lead: "The Soviet has been convened:",
            seat: "takes the High Commissariat of the Soviet.",
            single: true,
            video: "assets/cutscenes/the-combine-takes-the-congress.mp4",
            accent: "#b32424",
            gold: "#e8c46a",
            glow: "rgba(179,36,36,.4)"
        }

    };

    const POLL_MS = 30000;

    let timer = null;
    let tries = 0;
    let busy = false;       /* the card or the film is on the screen */

    /* ---------- small helpers ---------- */

    function T(text) {
        try { return (typeof window.T === "function") ? window.T(text) : text; }
        catch (e) { return text; }
    }

    function client() {
        try {
            if (typeof supabaseClient !== "undefined" && supabaseClient &&
                typeof supabaseClient.rpc === "function") {
                return supabaseClient;
            }
        }
        catch (e) { /* the client arrives with supabase.js */ }

        const other = window.supabaseClient;
        return (other && typeof other.rpc === "function") ? other : null;
    }

    function call(name, args) {
        const c = client();
        if (!c) { return Promise.resolve({ data: null, error: { message: "Not signed in" } }); }
        try {
            return Promise.resolve(c.rpc(name, args)).then(
                function(res) { return res || { data: null, error: null }; },
                function(err) { return { data: null, error: err }; });
        }
        catch (e) { return Promise.resolve({ data: null, error: e }); }
    }

    function seen(key, stamp) {

        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) { return false; }
            const said = JSON.parse(raw);
            return !!said && String(said.stamp) === String(stamp);
        }
        catch (e) { return false; }

    }

    function remember(key, stamp) {
        try { window.localStorage.setItem(key, JSON.stringify({ stamp: String(stamp), at: Date.now() })); }
        catch (e) { /* a browser that refuses storage shows it again next time */ }
    }

    /* ---------- which of the two scenes this commander sees ----------
       The pair is read once: the faction the database says this player
       belongs to decides whose chairs are named, and whose film plays. */

    function sideFor(data) {

        if (!data) { return null; }

        if (data.freedom) {
            return { side: SIDES.freedom, ready: !!data.ready, seat: data.speaker };
        }

        if (data.combine) {
            return { side: SIDES.combine, ready: !!data.soviet_ready, seat: data.commissar };
        }

        return null;

    }

    /* ---------- the event ---------- */

    function winner(name, colour) {

        const bold = document.createElement("b");
        bold.style.cssText = "color:" + colour + ";font-size:15px;";
        bold.textContent = name || "—";
        return bold;

    }

    function card(pick, data) {

        const side = pick.side;

        const overlay = document.createElement("div");
        overlay.id = "gf-elections-event";
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:6200;display:flex;align-items:center;justify-content:center;padding:20px;" +
            "background:radial-gradient(circle at 50% 38%,rgba(12,44,86,.72),rgba(0,0,0,.9));";

        const box = document.createElement("div");
        box.style.cssText =
            "width:min(600px,94vw);background:rgba(8,14,24,.98);border:1px solid " + side.accent + ";padding:26px 30px;" +
            "box-shadow:0 0 40px " + side.glow + ";text-align:center;color:#e6f1fa;font:14px/1.6 Arial,sans-serif;";

        const kicker = document.createElement("div");
        kicker.style.cssText = "font:bold 11px Arial;letter-spacing:4px;color:" + side.gold + ";margin-bottom:10px;";
        kicker.textContent = T("GALACTIC EVENT");

        const heading = document.createElement("h2");
        heading.style.cssText = "margin:0 0 14px;font-size:22px;letter-spacing:3px;color:#fff;line-height:1.3;";
        heading.textContent = T(side.heading);

        const lead = document.createElement("p");
        lead.style.cssText = "margin:0 0 10px;color:#c9dced;";
        lead.textContent = T(side.lead);

        const result = document.createElement("p");
        result.style.cssText = "margin:0 0 22px;color:#dff1ff;line-height:1.8;";

        /* a side with one office of its own is told only of that office */
        if (!side.single) {
            result.appendChild(winner(data.president, side.gold));
            result.appendChild(document.createTextNode(" " + T(side.race) + " "));
        }

        result.appendChild(winner(pick.seat, side.gold));
        result.appendChild(document.createTextNode(" " + T(side.seat)));

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.gf = "proceed";
        button.textContent = T("PROCEED");
        button.style.cssText =
            "padding:10px 34px;background:#0d1c2b;color:#fff;border:1px solid " + side.accent + ";" +
            "font:bold 12px Arial;letter-spacing:3px;cursor:pointer;";
        button.addEventListener("mouseenter", function() { button.style.background = "#16334a"; });
        button.addEventListener("mouseleave", function() { button.style.background = "#0d1c2b"; });

        box.appendChild(kicker);
        box.appendChild(heading);
        box.appendChild(lead);
        box.appendChild(result);
        box.appendChild(button);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        return { overlay: overlay, button: button };

    }

    /* ---------- the film ----------
       A missing or blocked file must never leave the player behind an
       overlay: the film ends, is skipped, or fails, and the map goes on. */

    function playFilm(source) {

        return new Promise(function(resolve) {

            let finished = false;

            const overlay = document.createElement("div");
            overlay.id = "gf-elections-cutscene";
            overlay.style.cssText =
                "position:fixed;inset:0;z-index:6300;background:#000;display:flex;" +
                "align-items:center;justify-content:center;";

            const video = document.createElement("video");
            video.src = source;
            video.autoplay = true;
            video.playsInline = true;
            video.preload = "auto";
            video.style.cssText = "width:100%;height:100%;object-fit:contain;background:#000;";

            const skip = document.createElement("button");
            skip.type = "button";
            skip.textContent = T("SKIP");
            skip.style.cssText =
                "position:absolute;bottom:24px;right:24px;padding:9px 22px;background:rgba(6,12,20,.9);" +
                "color:#e6f1fa;border:1px solid #3f7f9f;font:bold 11px Arial;letter-spacing:2px;cursor:pointer;";

            const finish = function() {

                if (finished) { return; }
                finished = true;

                try { video.pause(); } catch (e) { /* the film is over anyway */ }

                overlay.remove();
                resolve();

            };

            video.addEventListener("ended", finish);
            video.addEventListener("error", finish);
            skip.addEventListener("click", finish);

            overlay.appendChild(video);
            overlay.appendChild(skip);
            document.body.appendChild(overlay);

            const started = video.play();

            if (started && typeof started.catch === "function") {

                started.catch(function() {

                    /* autoplay with sound refused: the film still plays */
                    video.muted = true;

                    const again = video.play();

                    if (again && typeof again.catch === "function") {
                        again.catch(function() { finish(); });
                    }

                });

            }

        });

    }

    function show(pick, data) {

        if (busy) { return; }

        busy = true;

        const event = card(pick, data);

        event.button.focus();

        event.button.addEventListener("click", function() {

            event.overlay.remove();

            /* watched, or closed: it does not come back in this war */
            remember(pick.side.key, data.stamp);

            playFilm(pick.side.video).then(function() { busy = false; });

        });

    }

    /* ---------- asking the database ---------- */

    function check() {

        if (busy || !client()) { return Promise.resolve(); }

        return call("cg_elections_pair").then(function(res) {

            if (res.error) { return; }        /* an older database: no event */

            const data = res.data || {};
            const pick = sideFor(data);

            if (!pick || !pick.ready) { return; }
            if (!pick.seat) { return; }
            if (seen(pick.side.key, data.stamp)) { return; }

            show(pick, data);

        });

    }

    /* ---------- boot ---------- */

    function begin() {

        check();

        if (!timer) {
            timer = setInterval(function() {
                if (!document.hidden) { check(); }
            }, POLL_MS);
        }

    }

    function boot() {

        const waiter = setInterval(function() {

            tries++;

            if (client() || tries > 120) {
                clearInterval(waiter);
                if (client()) { begin(); }
            }

        }, 500);

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    }
    else {
        boot();
    }

    /* the other screens may ask again; they get no new powers */
    window.GFElections = {
        check: check
    };

})();
