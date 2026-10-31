/* =========================================================
   GAME CONTROL (shared by every page)
   - heartbeat: tells the server somebody is here, so the world
     is paused while nobody is online
   - freeze overlay until the host presses START
   - the host's own ADMIN tab: the reset and the maintenance keys in one place
   Needs supabase.js and stage10.sql.
========================================================= */
(function() {

    let overlay = null;
    let lastStarted = null;

    /* ---------- what counts as playing ----------
       The economy reads a touch of the game, not an open window: ten minutes
       without a mouse, a key or a finger and this player counts as away, so a
       window left open and forgotten no longer keeps the full rhythm up. */
    const IDLE_MS = 10 * 60 * 1000;
    let lastTouch = Date.now();

    function noteTouch() { lastTouch = Date.now(); }

    ["mousemove", "mousedown", "mouseup", "click", "wheel", "keydown", "touchstart", "touchmove", "scroll"]
        .forEach(function(ev) { window.addEventListener(ev, noteTouch, { passive: true }); });

    function ensureOverlay() {

        if (overlay) { return overlay; }

        overlay = document.createElement("div");
        overlay.id = "game-freeze-overlay";
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;align-items:center;" +
            "justify-content:center;gap:18px;background:rgba(2,4,8,.94);color:#e8eef5;font-family:Arial,sans-serif;text-align:center;";
        overlay.innerHTML =
            '<div style="font-size:13px;letter-spacing:6px;color:#8fa3b8;">GALACTIC WARS</div>' +
            '<div id="gc-title" style="font-size:34px;font-weight:900;letter-spacing:8px;">THE GAME HAS NOT STARTED</div>' +
            '<div id="gc-text" style="max-width:520px;color:#9fb0c2;letter-spacing:1px;">Everything is frozen. Waiting for the host to begin the war.</div>' +
            '<button id="gc-start" type="button" style="display:none;padding:16px 46px;font-size:18px;font-weight:900;letter-spacing:6px;' +
            'background:#16301f;color:#7dff9d;border:2px solid #4cff72;cursor:pointer;">START THE GAME</button>' +
            '<div id="gc-msg" style="min-height:18px;color:#e8c46a;"></div>';
        document.body.appendChild(overlay);

        overlay.querySelector("#gc-start").addEventListener("click", async function() {

            const msg = overlay.querySelector("#gc-msg");
            msg.textContent = "Starting...";

            const { error } = await supabaseClient.rpc("game_start");

            if (error) { msg.textContent = error.message; return; }

            /* a new war starts with each capital cored by its faction; on a
               database without that patch the call simply does not exist */
            try { await supabaseClient.rpc("charters_core_capitals"); } catch (e) { /* older database */ }

            /* and with the Combine's opening fleet quotas in hand: the first
               three fleets of a war wait on no directive */
            try { await supabaseClient.rpc("game_opening_quotas"); } catch (e) { /* older database */ }

            location.reload();

        });

        return overlay;

    }

    /* the reset itself, shared by the host's own button and the admin tab */
    async function runReset() {

        {

            const answer = window.prompt(
                "This puts the ENTIRE game back to the start:\n" +
                "- all fleets, buildings and garrison levels are wiped\n" +
                "- every faction's credits go back to 500\n" +
                "- Combine and Freedom Authority keep only their capital\n" +
                "- the civil wars on Krieg and Vraks restart\n" +
                "- the Soviet's directives, its parties and its High Commissar are cleared\n" +
                "- the Tusken colonies on Tuskara are razed and every slave is freed\n" +
                "- every embassy, the truce and the list of who is playing are cleared\n\n" +
                "Type RESET to confirm."
            );

            if (answer !== "RESET") { return; }

            const { data, error } = await supabaseClient.rpc("game_reset");

            if (error) { alert("Reset failed: " + error.message); return; }

            /* The game's own reset knows nothing about the Supreme Soviet, the
               party rolls, the embassies or the list of who is playing, so the
               newer systems are wiped here. On a database without the newer
               patch the call simply does not exist, and the reset still stands. */
            const extras = await supabaseClient.rpc("game_reset_extras");

            if (extras.error && !/function|schema cache|does not exist/i.test(extras.error.message)) {
                alert("The reset finished, but the newer systems could not be cleared:\n\n" + extras.error.message);
                return;
            }

            /* the capitals are cored again, whatever the last game did to them:
               a new game starts with Ultramars the Combine's and Free Earth the
               Authority's */
            try { await supabaseClient.rpc("charters_core_capitals"); } catch (e) { /* older database */ }

            /* and the Combine opens the war with its three fleet quotas again */
            try { await supabaseClient.rpc("game_opening_quotas"); } catch (e) { /* older database */ }

            /* the editor's tray is emptied with the war: a dispatch filed against
               the last one is nothing but a yellowed clipping. What actually went
               to print stays on the front page. */
            try { await supabaseClient.rpc("news_clear_trays"); } catch (e) { /* older database */ }
            try { await supabaseClient.rpc("occupation_policy_reset"); } catch (e) { /* older database */ }
            try { await supabaseClient.rpc("committees_and_ministers_reset"); } catch (e) { /* older database */ }
            try { await supabaseClient.rpc("tusken_world_reset"); } catch (e) { /* older database */ }

            /* a new war starts with no fleets lost, so no place to replace */
            try { await supabaseClient.rpc("fleet_replacements_reset"); } catch (e) { /* older database */ }

            if (data && data.warnings && data.warnings.length) {
                alert("The reset finished, but some parts could not be done:\n\n- " + data.warnings.join("\n- "));
            }

            location.reload();

        }

    }


    /* ---------- maintenance mode (host closes the game for everybody else) ---------- */
    let maintOverlay = null;
    let lastMaintenance = null;

    function ensureMaintOverlay() {

        if (maintOverlay) { return maintOverlay; }

        maintOverlay = document.createElement("div");
        maintOverlay.id = "game-maintenance-overlay";
        /* on the main menu it sits below the account panel so the host can still log in */
        maintOverlay.style.cssText =
            "position:fixed;inset:0;z-index:" + (window.GC_NO_OVERLAY ? 40 : 99998) + ";display:none;flex-direction:column;align-items:center;" +
            "justify-content:center;gap:16px;background:rgba(3,5,10,.97);color:#e8eef5;font-family:Arial,sans-serif;text-align:center;";
        maintOverlay.innerHTML =
            '<div style="font-size:13px;letter-spacing:6px;color:#8fa3b8;">GALACTIC WARS</div>' +
            '<div style="font-size:34px;font-weight:900;letter-spacing:8px;color:#e8c46a;">UNDER MAINTENANCE</div>' +
            '<div style="max-width:560px;color:#9fb0c2;letter-spacing:1px;">The game is temporarily closed. Everything is saved and frozen exactly as you left it: ' +
            'nothing moves, nothing is lost. It reopens when the host says so.</div>' +
            '<div id="gc-maint-msg" style="max-width:560px;color:#e8c46a;font-weight:bold;"></div>';
        document.body.appendChild(maintOverlay);

        return maintOverlay;

    }

    /* the maintenance keys, shared by the host's button and the admin tab */
    async function toggleMaintenance() {

        {

            const on = !(window.gameStatus && window.gameStatus.maintenance);
            let message = null;

            if (on) {
                message = window.prompt(
                    "CLOSE THE GAME for every player?\n\n" +
                    "They will see a maintenance screen. Everything is saved and frozen, and nothing is lost.\n" +
                    "Finish or announce any live battles first.\n\n" +
                    "Optional message for the players (or leave empty):", "");
                if (message === null) { return; }
            }
            else if (!window.confirm("OPEN THE GAME again? Every timer continues from where it stopped.")) { return; }

            const { data, error } = await supabaseClient.rpc("game_set_maintenance", { p_on: on, p_message: message });

            if (error) { alert("Could not change maintenance mode: " + error.message); return; }

            location.reload();

        }

    }

    function applyMaintenance(status) {

        if (lastMaintenance === null) { lastMaintenance = !!status.maintenance; }

        /* the host reopened the game while a player was waiting: back in */
        if (lastMaintenance !== !!status.maintenance && !status.is_host) { location.reload(); return; }

        const o = ensureMaintOverlay();

        o.style.display = status.maintenance && !status.is_host ? "flex" : "none";
        o.querySelector("#gc-maint-msg").textContent = status.maintenance_message || "";

    }

    /* ---------- the admin tab (the host's account alone) ---------- */
    let adminTab = null;
    let adminPanel = null;

    function T_GC(text) {
        try { return (typeof window.T === "function") ? window.T(text) : text; }
        catch (e) { return text; }
    }

    function ensureAdmin() {

        if (adminTab) { return; }

        adminTab = document.createElement("button");
        adminTab.type = "button";
        adminTab.id = "gc-admin-tab";
        adminTab.textContent = "\u2699 ADMIN";
        adminTab.title = "Host only: the reset and the maintenance keys";
        adminTab.style.cssText =
            "position:fixed;left:25px;bottom:214px;z-index:100000;padding:7px 12px;background:#101c28;" +
            "color:#9fdcff;border:1px solid #3f7f9f;cursor:pointer;font:bold 11px Arial;letter-spacing:2px;display:none;";
        document.body.appendChild(adminTab);

        adminPanel = document.createElement("div");
        adminPanel.id = "gc-admin-panel";
        adminPanel.style.cssText =
            "position:fixed;left:25px;bottom:258px;z-index:100001;width:300px;display:none;padding:14px;" +
            "background:rgba(8,14,22,.98);border:1px solid #3f7f9f;color:#cfe6f5;font:12px Arial;" +
            "box-shadow:0 10px 30px rgba(0,0,0,.6);";
        document.body.appendChild(adminPanel);

        adminTab.addEventListener("click", function() {
            if (adminPanel.style.display === "block") { adminPanel.style.display = "none"; }
            else { paintAdmin(); adminPanel.style.display = "block"; }
        });

        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && adminPanel.style.display === "block") {
                adminPanel.style.display = "none";
            }
        });

        paintAdmin();

    }

    /* how long this war has been running, in the shortest useful form */
    function gcElapsed(ms) {

        const mins = Math.floor(Math.max(0, ms) / 60000);

        if (mins < 1) { return T_GC("under a minute"); }
        if (mins < 60) { return mins + "m"; }

        const hours = Math.floor(mins / 60);
        const rest = mins % 60;

        return hours + "h" + (rest ? " " + rest + "m" : "");

    }

    /* the war's clock, and who is at the table */
    function adminClock() {

        const st = window.gameStatus || {};
        const raw = st.started_at !== undefined ? st.started_at : st.started;

        let line;

        if (raw === null || raw === undefined || raw === false) {
            line = T_GC("The war has not begun");
        }
        else if (typeof raw === "string" && isFinite(new Date(raw).getTime())) {
            line = T_GC("The war") + ": " + gcElapsed(Date.now() - new Date(raw).getTime());
        }
        else {
            line = T_GC("The war is under way");
        }

        const online = Number(st.online);

        if (isFinite(online) && online >= 0) {
            line += " \u00b7 " + (online === 1
                ? T_GC("1 player online")
                : online + " " + T_GC("players online"));
        }

        return line;

    }

    function paintAdmin() {

        if (!adminPanel) { return; }

        const on = !!(window.gameStatus && window.gameStatus.maintenance);
        const btn = "width:100%;padding:9px;margin-top:8px;cursor:pointer;font:bold 11px Arial;letter-spacing:2px;";

        adminPanel.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
                '<b style="letter-spacing:3px;color:#9fdcff">' + T_GC("ADMIN") + '</b>' +
                '<button type="button" data-gc="close" style="background:none;border:none;color:#7b93a6;' +
                'cursor:pointer;font-size:16px">&times;</button></div>' +
            '<div style="color:#6f8ba0;margin-top:4px;line-height:1.5">' +
                T_GC("The host's keys: the whole war, and the door every player comes through.") + '</div>' +
            '<div style="margin-top:10px;color:#9fb8c9">' + T_GC("The game is") + ': <b style="color:' +
                (on ? "#ffb04a" : "#7dff9b") + '">' +
                (on ? T_GC("UNDER MAINTENANCE") : T_GC("OPEN")) + '</b></div>' +
            '<div data-gc="clock" style="margin-top:6px;color:#9fb8c9">' + adminClock() + '</div>' +
            '<button type="button" data-gc="maint" style="' + btn + 'background:' +
                (on ? "#1c3016" : "#3a2f10") + ';color:' + (on ? "#9dff9d" : "#ffd98a") +
                ';border:1px solid ' + (on ? "#4c8a3a" : "#b08a2c") + ';">' +
                (on ? T_GC("OPEN THE GAME") : T_GC("CLOSE THE GAME (MAINTENANCE)")) + '</button>' +
            '<button type="button" data-gc="reset" style="' + btn + 'background:#2a0f0f;color:#ff9b9b;' +
                'border:1px solid #8a3030;">' + T_GC("RESET GAME") + '</button>' +
            '<div style="color:#6f8ba0;margin-top:9px;line-height:1.5">' +
                T_GC("The reset wipes the whole war. Maintenance freezes it for everybody else and loses nothing.") +
                '</div>';

        adminPanel.querySelector('[data-gc="close"]').addEventListener("click", function() {
            adminPanel.style.display = "none";
        });

        adminPanel.querySelector('[data-gc="maint"]').addEventListener("click", toggleMaintenance);
        adminPanel.querySelector('[data-gc="reset"]').addEventListener("click", runReset);

    }

    function applyAdmin(status) {

        if (!status || !status.is_host) { return; }

        ensureAdmin();

        adminTab.style.display = "block";

        /* the label follows the door: open or closed */
        if (adminPanel.style.display === "block") { paintAdmin(); }

    }


    /* ---------- the economy, as the server reads it ---------- */
    let economyBadge = null;

    function applyEconomy(status) {

        if (!economyBadge) {

            economyBadge = document.createElement("div");
            economyBadge.id = "game-economy-badge";
            economyBadge.style.cssText =
                "position:fixed;left:25px;bottom:170px;z-index:9000;padding:7px 12px;background:#2b2410;" +
                "color:#ffd98a;border:1px solid #8a702c;font:bold 11px Arial;letter-spacing:1px;" +
                "max-width:270px;line-height:1.45;display:none;";
            document.body.appendChild(economyBadge);

        }

        /* while somebody is playing there is nothing to say */
        if (!status || status.income === "full") { economyBadge.style.display = "none"; return; }

        const shut = status.income === "closed";

        economyBadge.textContent = shut
            ? "NOBODY HAS PLAYED FOR TWO HOURS: THE INCOME IS OFF FOR EVERY SIDE UNTIL SOMEBODY PLAYS"
            : "IDLE: NOBODY HAS TOUCHED THE GAME, SO THE INCOME IS HALVED";

        economyBadge.style.background = shut ? "#2a0f0f" : "#2b2410";
        economyBadge.style.color = shut ? "#ff9b9b" : "#ffd98a";
        economyBadge.style.borderColor = shut ? "#8a3030" : "#8a702c";
        economyBadge.style.display = "block";

    }

    async function beat() {

        let result;

        try {
            result = await supabaseClient.rpc("game_heartbeat", { p_active: Date.now() - lastTouch < IDLE_MS });
        }
        catch (e) {
            return;
        }

        if (!result || result.error || !result.data) { return; }

        const status = result.data;

        window.gameStatus = status;

        applyMaintenance(status);
        applyAdmin(status);
        applyEconomy(status);

        if (lastStarted === null) { lastStarted = status.started; }

        /* the host reset the game while we were playing, or started it: reload once */
        if (lastStarted !== status.started) { location.reload(); return; }

        if (!window.GC_NO_OVERLAY) {

            const o = ensureOverlay();

            o.style.display = status.started || (status.maintenance && !status.is_host) ? "none" : "flex";

            const start = o.querySelector("#gc-start");
            const text = o.querySelector("#gc-text");

            start.style.display = status.is_host ? "block" : "none";
            text.textContent = status.is_host
                ? "You are the host. Everything stays frozen until you press START."
                : "Everything is frozen. Waiting for the host to begin the war.";

        }

        applyAdmin(status);

    }


    /* ---------- space battles waiting for me ---------- */
    let battleBanner = null;

    async function pollBattles() {

        if (window.GC_NO_BANNER) { return; }

        /* the menu is not a screen of the game: no battle banner over it */

        const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();

        if (here === "index.html" || here === "") { return; }

        let result;

        try { result = await supabaseClient.rpc("my_space_battles"); } catch (e) { return; }

        if (!result || result.error || !Array.isArray(result.data)) { return; }

        if (!battleBanner) {
            battleBanner = document.createElement("div");
            battleBanner.style.cssText =
                "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99000;display:flex;flex-direction:column;gap:6px;align-items:center;";
            document.body.appendChild(battleBanner);
        }

        battleBanner.innerHTML = "";

        for (const b of result.data) {

            const row = document.createElement("div");
            row.style.cssText =
                "padding:10px 18px;background:rgba(40,8,4,.95);border:2px solid #ff5a2a;color:#ffe2cc;font:bold 13px Arial;letter-spacing:1px;" +
                "box-shadow:0 0 18px #ff5a2a;";

            const where = b.kind === "orbit" ? "above " + b.planet : "in deep space";

            row.textContent = "\u2694 SPACE BATTLE " + where + ": " + (b.mine || "your fleet") + " vs " + (b.against || "unknown") + "   ";

            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = "ENTER BATTLE";
            btn.style.cssText = "margin-left:10px;padding:6px 14px;background:#3a1208;color:#fff;border:1px solid #ff5a2a;cursor:pointer;font-weight:bold;letter-spacing:2px;";
            btn.addEventListener("click", function() { location.href = "space.html?battle=" + encodeURIComponent(b.id); });
            row.appendChild(btn);

            battleBanner.appendChild(row);

        }

    }

    window.addEventListener("load", function() {
        beat();
        setInterval(beat, 20000);
        setTimeout(pollBattles, 3000);
        setInterval(pollBattles, 8000);
        /* Congress, taxes and occupations advance with game time wherever somebody is online */
        const congressTick = function() {
            try { supabaseClient.rpc("congress_tick").then(function() {}, function() {}); } catch (e) {}
        };
        setTimeout(congressTick, 6000);
        setInterval(congressTick, 60000);

        /* the unrest of the occupied worlds climbs with the same clock, on
           whichever screen the player happens to be looking at */
        const unrestTick = function() {
            try { supabaseClient.rpc("unrest_tick").then(function() {}, function() {}); } catch (e) {}
        };
        setTimeout(unrestTick, 7000);
        setInterval(unrestTick, 60000);

        /* the Tusken colonies take in their bands and land their convoys on
           the same clock, wherever the player happens to be */
        const tuskenTick = function() {
            try { supabaseClient.rpc("tusken_tick").then(function() {}, function() {}); } catch (e) {}
        };
        setTimeout(tuskenTick, 8000);
        setInterval(tuskenTick, 60000);

        /* two rival fleets in a neutral orbit fight even if nobody is looking
           at the map (the map's own scan is the fast one) */
        const orbitTick = function() {
            try { supabaseClient.rpc("orbit_battle_scan").then(function() {}, function() {}); } catch (e) {}
        };
        setTimeout(orbitTick, 9000);
        setInterval(orbitTick, 45000);
    });

})();
