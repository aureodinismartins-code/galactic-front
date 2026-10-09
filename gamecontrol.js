/* =========================================================
   GAME CONTROL (shared by every page)
   - heartbeat: tells the server somebody is here, so the world
     is paused while nobody is online
   - freeze overlay until the host presses START
   - host-only RESET button (set window.GC_RESET = true on a page)
   Needs supabase.js and stage10.sql.
========================================================= */
(function() {

    let overlay = null;
    let resetButton = null;
    let lastStarted = null;

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

            location.reload();

        });

        return overlay;

    }

    function ensureResetButton() {

        if (resetButton) { return resetButton; }

        resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.textContent = "⟲ RESET GAME";
        resetButton.title = "Host only: puts the whole game back to the start";
        resetButton.style.cssText =
            "position:fixed;left:25px;bottom:78px;z-index:9000;padding:7px 12px;background:#2a0f0f;color:#ff9b9b;" +
            "border:1px solid #8a3030;cursor:pointer;font:bold 11px Arial;letter-spacing:2px;display:none;";
        document.body.appendChild(resetButton);

        resetButton.addEventListener("click", async function() {

            const answer = window.prompt(
                "This puts the ENTIRE game back to the start:\n" +
                "- all fleets, buildings and garrison levels are wiped\n" +
                "- every faction's credits go back to 500\n" +
                "- Combine and Freedom Authority keep only their capital\n" +
                "- the civil wars on Krieg and Vraks restart\n\n" +
                "Type RESET to confirm."
            );

            if (answer !== "RESET") { return; }

            const { data, error } = await supabaseClient.rpc("game_reset");

            if (error) { alert("Reset failed: " + error.message); return; }

            if (data && data.warnings && data.warnings.length) {
                alert("The reset finished, but some parts could not be done:\n\n- " + data.warnings.join("\n- "));
            }

            location.reload();

        });

        return resetButton;

    }

    async function beat() {

        let result;

        try {
            result = await supabaseClient.rpc("game_heartbeat");
        }
        catch (e) {
            return;
        }

        if (!result || result.error || !result.data) { return; }

        const status = result.data;

        window.gameStatus = status;

        if (lastStarted === null) { lastStarted = status.started; }

        /* the host reset the game while we were playing, or started it: reload once */
        if (lastStarted !== status.started) { location.reload(); return; }

        if (!window.GC_NO_OVERLAY) {

            const o = ensureOverlay();

            o.style.display = status.started ? "none" : "flex";

            const start = o.querySelector("#gc-start");
            const text = o.querySelector("#gc-text");

            start.style.display = status.is_host ? "block" : "none";
            text.textContent = status.is_host
                ? "You are the host. Everything stays frozen until you press START."
                : "Everything is frozen. Waiting for the host to begin the war.";

        }

        if (window.GC_RESET && status.is_host) {
            ensureResetButton().style.display = "block";
        }

    }


    /* ---------- space battles waiting for me ---------- */
    let battleBanner = null;

    async function pollBattles() {

        if (window.GC_NO_BANNER) { return; }

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

            row.textContent = "⚔ SPACE BATTLE " + where + ": " + (b.mine || "your fleet") + " vs " + (b.against || "unknown") + "   ";

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
    });

})();
