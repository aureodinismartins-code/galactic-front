/* =========================================================
   GALACTIC FRONT — the Freedom Authority elections

   Once both chairs are decided in a war — the President and the
   Speaker of the Congress — the faction's screens raise one event.
   It says who won what, and pressing PROCEED plays the film of the
   President arriving at the Congress.

   Who won is decided by the database (sql/2026-11-55_...), so every
   screen reads the same pair; a browser only remembers that it has
   already watched it, per war.

   Only Freedom Authority members are shown this: the Combine's own
   turn comes later and is not this file's business.

   No dependencies: included by every screen.
========================================================= */

(function () {

    "use strict";

    const VIDEO = "assets/cutscenes/president-arrives-at-congress.mp4";
    const SEEN_KEY = "gf.fa-elections";     /* watched already, per war */
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

    function seen(stamp) {

        try {
            const raw = window.localStorage.getItem(SEEN_KEY);
            if (!raw) { return false; }
            const said = JSON.parse(raw);
            return !!said && String(said.stamp) === String(stamp);
        }
        catch (e) { return false; }

    }

    function remember(stamp) {
        try { window.localStorage.setItem(SEEN_KEY, JSON.stringify({ stamp: String(stamp), at: Date.now() })); }
        catch (e) { /* a browser that refuses storage shows it again next time */ }
    }

    /* ---------- the event ---------- */

    function winner(name) {

        const bold = document.createElement("b");
        bold.style.cssText = "color:#ffd37a;font-size:15px;";
        bold.textContent = name || "—";
        return bold;

    }

    function card(data) {

        const overlay = document.createElement("div");
        overlay.id = "fa-elections-event";
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:6200;display:flex;align-items:center;justify-content:center;padding:20px;" +
            "background:radial-gradient(circle at 50% 38%,rgba(12,44,86,.72),rgba(0,0,0,.9));";

        const box = document.createElement("div");
        box.style.cssText =
            "width:min(600px,94vw);background:rgba(8,14,24,.98);border:1px solid #3f7f9f;padding:26px 30px;" +
            "box-shadow:0 0 40px rgba(63,127,159,.35);text-align:center;color:#e6f1fa;font:14px/1.6 Arial,sans-serif;";

        const kicker = document.createElement("div");
        kicker.style.cssText = "font:bold 11px Arial;letter-spacing:4px;color:#ffd37a;margin-bottom:10px;";
        kicker.textContent = T("GALACTIC EVENT");

        const heading = document.createElement("h2");
        heading.style.cssText = "margin:0 0 14px;font-size:22px;letter-spacing:3px;color:#fff;line-height:1.3;";
        heading.textContent = T("THE FREEDOM AUTHORITY ELECTIONS");

        const lead = document.createElement("p");
        lead.style.cssText = "margin:0 0 10px;color:#c9dced;";
        lead.textContent = T("The elections have been held:");

        const result = document.createElement("p");
        result.style.cssText = "margin:0 0 22px;color:#dff1ff;line-height:1.8;";
        result.appendChild(winner(data.president));
        result.appendChild(document.createTextNode(" " + T("won the presidential race, with") + " "));
        result.appendChild(winner(data.speaker));
        result.appendChild(document.createTextNode(" " + T("winning for Speaker of Congress.")));

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.gf = "proceed";
        button.textContent = T("PROCEED");
        button.style.cssText =
            "padding:10px 34px;background:#0d1c2b;color:#fff;border:1px solid #3f7f9f;" +
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

    function playFilm() {

        return new Promise(function(resolve) {

            let finished = false;

            const overlay = document.createElement("div");
            overlay.id = "fa-elections-cutscene";
            overlay.style.cssText =
                "position:fixed;inset:0;z-index:6300;background:#000;display:flex;" +
                "align-items:center;justify-content:center;";

            const video = document.createElement("video");
            video.src = VIDEO;
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

    function show(data) {

        if (busy) { return; }

        busy = true;

        const event = card(data);

        event.button.focus();

        event.button.addEventListener("click", function() {

            event.overlay.remove();

            /* watched, or closed: it does not come back in this war */
            remember(data.stamp);

            playFilm().then(function() { busy = false; });

        });

    }

    /* ---------- asking the database ---------- */

    function check() {

        if (busy || !client()) { return Promise.resolve(); }

        return call("cg_elections_pair").then(function(res) {

            if (res.error) { return; }        /* an older database: no event */

            const data = res.data || {};

            if (!data.ready || !data.freedom) { return; }
            if (!data.president && !data.speaker) { return; }
            if (seen(data.stamp)) { return; }

            show(data);

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
