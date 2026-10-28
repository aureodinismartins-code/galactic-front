/* =========================================================
   TUSKARA — THE TUSKEN HOMEWORLD

   Tuskara cannot be conquered: it has no cities and no
   garrison. It is worked through COLONIES, and a colony is
   a pen.

     SIZE   how big the settlement (and its pens) is
     CATCH  how many Tusken the bands take per hour
     HOLD   how many they can keep before a load must leave

   A Tusken still standing on Tuskara is worth nothing: the
   desert has no industry. Every 10,000 shipped to a world the
   faction holds whole add 1 credit to that world's payment,
   and the world they left loses exactly that. Moving them is
   a purchase: 350 credits buys one transport of up to 2,500.

   This file is loaded by planet.html and only does anything
   when the page is Tuskara. Everything it draws comes from
   public.tusken_world(); see sql/2026-11-26_the_tusken_world.sql.
   ========================================================= */

(function () {

    const PLANET = "Tuskara";

    const here =
        (new URLSearchParams(window.location.search).get("name") || "") === PLANET;

    if (!here) { return; }

    const SPOTS = [[26, 34], [58, 52], [74, 30], [42, 72], [64, 22]];

    let state = null;
    let busy = false;
    let optionsKey = "";

    /* ---------- small talk ---------- */

    function num(n) {
        return Number(n || 0).toLocaleString("en-US");
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function factionName(f) {
        if (f === "Combine") { return "COMBINE"; }
        if (f === "Freedom Authority") { return "AUTHORITY"; }
        return String(f || "").toUpperCase();
    }

    function factionClass(f) {
        if (f === "Combine") { return "combine"; }
        if (f === "Freedom Authority") { return "freedom"; }
        return "independent";
    }

    function duration(seconds) {

        let s = Math.max(0, Math.round(Number(seconds) || 0));

        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);

        s = s % 60;

        if (h > 0) { return h + "h " + String(m).padStart(2, "0") + "m"; }
        if (m > 0) { return m + "m " + String(s).padStart(2, "0") + "s"; }

        return s + "s";

    }

    function say(text) {
        const el = document.getElementById("tusken-msg");
        if (el) { el.textContent = text || ""; }
    }

    /* ---------- the board ---------- */

    function addStyles() {

        if (document.getElementById("tusken-css")) { return; }

        const style = document.createElement("style");

        style.id = "tusken-css";
        style.textContent = `
            #tusken-panel {
                position: absolute;
                right: 28px;
                top: 110px;
                width: 380px;
                max-height: calc(100vh - 150px);
                overflow-y: auto;
                padding: 16px 18px 22px;
                background: rgba(12, 10, 6, .96);
                border: 1px solid #6b552c;
                color: #efe3cb;
                font: 13px Arial, sans-serif;
                z-index: 60;
                box-shadow: 0 12px 40px rgba(0,0,0,.6);
            }
            #tusken-panel .tusken-title {
                font-size: 18px; font-weight: 900; letter-spacing: 5px; color: #f0cf8a;
            }
            #tusken-panel .tusken-sub {
                color: #a99a7c; font-size: 10px; letter-spacing: 1px; line-height: 1.55; margin-top: 4px;
            }
            #tusken-panel .tusken-line {
                display: flex; justify-content: space-between; gap: 10px; align-items: baseline;
                margin-top: 5px; font-size: 11px; letter-spacing: 1px; color: #c9b994;
            }
            #tusken-panel .tusken-line b { color: #fff3d6; font-size: 13px; }
            #tusken-panel .tusken-head {
                display: flex; justify-content: space-between; align-items: baseline;
                gap: 8px; margin: 16px 0 6px; padding-bottom: 4px;
                border-bottom: 1px solid rgba(240,207,138,.25);
            }
            #tusken-panel .tusken-head h3 { margin: 0; font-size: 11px; letter-spacing: 3px; color: #f0cf8a; }
            #tusken-panel .tusken-head span { color: #8f8166; font-size: 10px; letter-spacing: 1px; }
            #tusken-panel .tusken-card {
                margin-top: 8px; padding: 9px 10px;
                border: 1px solid rgba(240,207,138,.2);
                background: rgba(240,207,138,.045);
            }
            #tusken-panel .tusken-card.mine { border-color: rgba(240,207,138,.55); }
            #tusken-panel .tusken-card h3 { margin: 0; font-size: 12px; letter-spacing: 2px; color: #fff3d6; }
            #tusken-panel .tusken-bar { height: 5px; margin-top: 5px; background: rgba(255,255,255,.1); overflow: hidden; }
            #tusken-panel .tusken-bar > div { height: 100%; background: #d6a84b; }
            #tusken-panel .tusken-track {
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px; margin-top: 7px; font-size: 10px; letter-spacing: 1px; color: #c9b994;
            }
            #tusken-panel .tusken-max { color: #7d7159; font-size: 9px; letter-spacing: 1px; }
            #tusken-panel .tusken-btn {
                width: 100%; margin-top: 8px; padding: 9px 10px;
                background: #241d10; color: #ffe6b0; border: 1px solid #8a702c;
                cursor: pointer; font: bold 10px Arial, sans-serif; letter-spacing: 2px;
            }
            #tusken-panel .tusken-track .tusken-btn { width: auto; margin: 0; padding: 5px 9px; }
            #tusken-panel .tusken-btn.go { background: #3a2f14; }
            #tusken-panel .tusken-btn:hover:not(:disabled) { background: #4a3b18; }
            #tusken-panel .tusken-btn:disabled { opacity: .38; cursor: not-allowed; }
            #tusken-panel .tusken-label {
                display: block; margin-top: 8px; font-size: 9px; letter-spacing: 2px; color: #9c8f74;
            }
            #tusken-panel .tusken-select,
            #tusken-panel .tusken-input {
                width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px;
                background: #15120c; color: #f3e7cd; border: 1px solid #5b4a26; font-size: 12px;
            }
            #tusken-panel .tusken-msg {
                min-height: 16px; margin-top: 8px; color: #ffd37a; font-size: 11px; line-height: 1.45;
            }
            #tusken-panel .tusken-row {
                display: flex; justify-content: space-between; gap: 8px;
                padding: 5px 0; border-bottom: 1px dashed rgba(240,207,138,.12);
                font-size: 11px; letter-spacing: 1px; color: #c9b994;
            }
            #tusken-panel .tusken-row b { color: #fff3d6; }
            .city.tusken .city-marker {
                background: #e6c17a !important;
                border-color: #ffe6b0 !important;
                box-shadow: 0 0 12px 3px rgba(214, 168, 75, .85) !important;
            }
            .city.tusken span { color: #f0cf8a; }
            @media (max-width: 780px) {
                #tusken-panel {
                    left: 10px; right: 10px; top: auto; bottom: 10px;
                    width: auto; max-height: 58vh; padding: 12px 14px 18px;
                }
            }
        `;

        document.head.appendChild(style);

    }

    function buildPanel() {

        if (document.getElementById("tusken-panel")) { return; }

        addStyles();

        const panel = document.createElement("div");

        panel.id = "tusken-panel";
        panel.innerHTML = `
            <div class="tusken-title">TUSKARA</div>
            <div class="tusken-sub">THE TUSKEN HOMEWORLD · NO CITIES, NO GARRISON — ONLY THE PENS</div>

            <div class="tusken-line"><span>FACTION CREDITS</span><b id="tusken-credits">—</b></div>
            <div class="tusken-line"><span>IN THE PENS</span><b id="tusken-pool">—</b></div>
            <div class="tusken-line"><span>TUSKEN AT WORK</span><b id="tusken-work">—</b></div>
            <div class="tusken-line"><span>THEIR INCOME</span><b id="tusken-work-income">—</b></div>

            <div class="tusken-sub">
                Every 10,000 Tusken put to work on a world add 1 credit to that world's payment.
                On Tuskara itself they earn nothing — a slave is only worth the ship that carries it.
            </div>

            <div class="tusken-head"><h3>COLONIES</h3><span id="tusken-colony-count"></span></div>
            <div id="tusken-colonies"></div>
            <button type="button" id="tusken-found" class="tusken-btn go">FOUND A COLONY</button>

            <div class="tusken-head"><h3>LOAD A TRANSPORT</h3><span id="tusken-ship-price"></span></div>
            <label class="tusken-label" for="tusken-from">FROM</label>
            <select id="tusken-from" class="tusken-select"></select>
            <label class="tusken-label" for="tusken-to">TO</label>
            <select id="tusken-to" class="tusken-select"></select>
            <label class="tusken-label" for="tusken-amount">HOW MANY</label>
            <input id="tusken-amount" class="tusken-input" type="number" min="1" step="100" value="2500">
            <div class="tusken-sub" id="tusken-available"></div>
            <button type="button" id="tusken-ship" class="tusken-btn go">BUY THE SHIP AND LOAD IT</button>

            <div id="tusken-msg" class="tusken-msg"></div>

            <div class="tusken-head"><h3>AT WORK</h3><span>WHAT THEY PAY</span></div>
            <div id="tusken-workforce"></div>

            <div class="tusken-head"><h3>CONVOYS</h3><span>ON THE ROAD</span></div>
            <div id="tusken-convoys"></div>
        `;

        document.body.appendChild(panel);

        panel.querySelector("#tusken-found").addEventListener("click", function () { act("found"); });
        panel.querySelector("#tusken-ship").addEventListener("click", function () { act("ship"); });

        panel.addEventListener("click", function (ev) {
            const btn = ev.target && ev.target.closest ? ev.target.closest("[data-up]") : null;
            if (btn) { act("upgrade", btn); }
        });

    }

    /* ---------- reading and writing ---------- */

    async function load() {

        const { data, error } = await supabaseClient.rpc("tusken_world");

        if (error) {
            state = null;
            say("The colonies answer nothing: " + error.message +
                " — run sql/2026-11-26_the_tusken_world.sql in the Supabase editor.");
            return false;
        }

        state = data;

        return true;

    }

    async function refresh() {

        const good = await load();

        if (good) { draw(); drawMarkers(); }

        return good;

    }

    async function act(kind, btn) {

        if (busy || !state) { return; }

        busy = true;
        say("");

        document.querySelectorAll("#tusken-panel button").forEach(function (b) { b.disabled = true; });

        let result = null;

        try {

            if (kind === "found") {
                result = await supabaseClient.rpc("tusken_found_colony");
            }
            else if (kind === "upgrade" && btn) {
                result = await supabaseClient.rpc("tusken_upgrade", {
                    p_colony: Number(btn.dataset.colony),
                    p_track: btn.dataset.up
                });
            }
            else if (kind === "ship") {

                const from = document.getElementById("tusken-from").value;
                const to = document.getElementById("tusken-to").value;
                const amount = Number(document.getElementById("tusken-amount").value || 0);

                if (!to) {
                    say("There is nowhere to land the load: hold a world whole first.");
                }
                else if (!(amount > 0)) {
                    say("The load needs a number of Tusken in it.");
                }
                else {
                    result = await supabaseClient.rpc("tusken_ship", {
                        p_from: from, p_to: to, p_amount: amount
                    });
                }

            }

            if (result && result.error) {
                say(result.error.message);
            }
            else if (result && result.data) {

                const d = result.data;

                if (kind === "found") {
                    say("A colony rises at " + d.name + ", for " + num(d.paid) + " credits.");
                }
                else if (kind === "upgrade") {
                    say("The work is done: " + String(d.track).toUpperCase() + ", for " + num(d.paid) + " credits.");
                }
                else if (kind === "ship") {
                    say(num(d.amount) + " Tusken aboard for " + d.to + " — " +
                        num(d.paid) + " credits, " + duration(d.seconds) + " on the road.");
                }

            }

        }
        catch (e) {
            say(String(e && e.message ? e.message : e));
        }

        busy = false;

        await refresh();

    }

    /* ---------- drawing ---------- */

    function colonyCard(c) {

        const pct = Number(c.capacity) > 0
            ? Math.min(100, 100 * Number(c.slaves) / Number(c.capacity))
            : 0;

        function track(key, cost, label) {

            if (!c.mine) { return ""; }

            if (cost === null || cost === undefined) {
                return '<div class="tusken-track"><span>' + label + '</span>' +
                    '<span class="tusken-max">FINISHED</span></div>';
            }

            return '<div class="tusken-track"><span>' + label + '</span>' +
                '<button type="button" class="tusken-btn" data-up="' + key +
                '" data-colony="' + c.id + '">' + num(cost) + ' CR</button></div>';

        }

        return '<div class="tusken-card' + (c.mine ? ' mine' : '') + '">' +
            '<div class="tusken-line"><h3>' + esc(c.name || "COLONY") + '</h3>' +
            '<span>' + factionName(c.faction) + '</span></div>' +
            '<div class="tusken-sub">SIZE ' + c.size + ' · CATCH ' + c.catch + ' · HOLD ' + c.hold + '</div>' +
            '<div class="tusken-line"><span>PENS</span><span>' + num(c.slaves) + ' / ' +
            num(c.capacity) + '</span></div>' +
            '<div class="tusken-bar"><div style="width:' + pct.toFixed(1) + '%"></div></div>' +
            '<div class="tusken-sub">takes up to ' + num(c.per_hour) + ' an hour</div>' +
            track("size", c.size_cost, "GROW THE COLONY") +
            track("catch", c.catch_cost, "BETTER BANDS (CATCH)") +
            track("hold", c.hold_cost, "BIGGER PENS (HOLD)") +
            '</div>';

    }

    function draw() {

        if (!state) { return; }

        document.getElementById("tusken-credits").textContent = num(state.credits) + " CR";
        document.getElementById("tusken-pool").textContent = num(state.pool);

        const workforce = state.workforce || [];
        const atWork = workforce.reduce(function (sum, w) { return sum + Number(w.amount); }, 0);
        const bonus = workforce.reduce(function (sum, w) { return sum + Number(w.bonus); }, 0);

        document.getElementById("tusken-work").textContent = num(atWork);
        document.getElementById("tusken-work-income").textContent = "+" + num(bonus) + " / PAYMENT";

        document.getElementById("tusken-colony-count").textContent =
            state.my_colonies + " OF " + state.max_colonies + " SETTLED";

        document.getElementById("tusken-colonies").innerHTML = (state.colonies || []).length
            ? state.colonies.map(colonyCard).join("")
            : '<div class="tusken-sub">The dust is empty. Nobody has settled Tuskara yet.</div>';

        const found = document.getElementById("tusken-found");

        found.textContent = state.my_colonies >= state.max_colonies
            ? "NO MORE COLONIES"
            : "FOUND A COLONY — " + num(state.prices.colony) + " CR";

        found.disabled = state.my_colonies >= state.max_colonies;

        document.getElementById("tusken-ship-price").textContent =
            num(state.prices.ship) + " CR · " + num(state.prices.capacity) + " PER SHIP";

        /* the two pickers are only rebuilt when their lists change, so a
           number typed into the load box is not erased every eight seconds */
        const sources = [{ planet: PLANET, amount: state.pool }].concat(
            workforce.map(function (w) { return { planet: w.planet, amount: w.amount }; })
        );

        const destinations = state.destinations || [];

        const key = sources.map(function (x) { return x.planet; }).join("|") + ">" +
            destinations.map(function (d) { return d.planet; }).join("|");

        if (key !== optionsKey) {

            optionsKey = key;

            const from = document.getElementById("tusken-from");
            const to = document.getElementById("tusken-to");
            const keepFrom = from.value;
            const keepTo = to.value;

            from.innerHTML = sources.map(function (x) {
                return '<option value="' + esc(x.planet) + '">' + esc(x.planet) +
                    " — " + num(x.amount) + "</option>";
            }).join("");

            to.innerHTML = destinations.map(function (d) {
                return '<option value="' + esc(d.planet) + '">' + esc(d.planet) +
                    " — " + num(d.slaves) + " at work</option>";
            }).join("") || '<option value="">NOWHERE YET</option>';

            if (sources.some(function (x) { return x.planet === keepFrom; })) { from.value = keepFrom; }
            if (destinations.some(function (d) { return d.planet === keepTo; })) { to.value = keepTo; }

        }

        const chosen = document.getElementById("tusken-from").value || PLANET;

        const source = sources.filter(function (x) { return x.planet === chosen; })[0] ||
            { amount: 0 };

        const most = Math.min(Number(state.prices.capacity), Number(source.amount));

        document.getElementById("tusken-available").textContent =
            "Up to " + num(Math.max(0, most)) + " from here · one ship holds " +
            num(state.prices.capacity);

        const amount = document.getElementById("tusken-amount");

        if (!amount.value || Number(amount.value) > Math.max(1, most)) {
            amount.value = String(Math.max(0, most));
        }

        amount.max = String(Math.max(1, most));

        document.getElementById("tusken-ship").disabled = !(most > 0);

        document.getElementById("tusken-workforce").innerHTML = workforce.length
            ? workforce.map(function (w) {
                return '<div class="tusken-row"><span>' + esc(w.planet) + '</span><b>' +
                    num(w.amount) + ' · +' + num(w.bonus) + '</b></div>';
            }).join("")
            : '<div class="tusken-sub">No Tusken are at work yet. Load a transport.</div>';

        const convoys = state.convoys || [];

        document.getElementById("tusken-convoys").innerHTML = convoys.length
            ? convoys.map(function (k) {
                return '<div class="tusken-row"><span>' + esc(k.from) + ' → ' + esc(k.to) +
                    '</span><b>' + num(k.amount) + ' · ' + duration(k.seconds) + '</b></div>';
            }).join("")
            : '<div class="tusken-sub">No ships on the road.</div>';

    }

    function drawMarkers() {

        const container = document.getElementById("cities");

        if (!container) { return; }

        container.innerHTML = "";

        if (!state || !(state.colonies || []).length) { return; }

        state.colonies.forEach(function (c, index) {

            const spot = SPOTS[index % SPOTS.length];

            const el = document.createElement("div");

            el.className = "city tusken " + factionClass(c.faction);
            el.style.left = spot[0] + "%";
            el.style.top = spot[1] + "%";
            el.dataset.colony = c.id;
            el.title = (c.name || "Colony") + " — " + factionName(c.faction) +
                " · " + num(c.slaves) + " in the pens";

            el.innerHTML = '<div class="city-marker"></div><span>' +
                esc(c.name || "Colony") + " · " + num(c.slaves) + "</span>";

            el.addEventListener("click", function () {
                const btn = document.querySelector(
                    '#tusken-colonies [data-colony="' + c.id + '"]');
                const card = btn ? btn.closest(".tusken-card") : null;
                if (card && card.scrollIntoView) {
                    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
            });

            container.appendChild(el);

        });

    }

    /* ---------- boot ---------- */

    function boot() {

        buildPanel();

        refresh();

        /* the colonies are the world's only clock: this keeps the pens and
           the convoys moving while somebody is standing on the dust */
        setInterval(refresh, 8000);

    }

    /* planet.html keeps its own copy of the markers hook for pages that do
       not load this file; here it is the real one */
    window.tuskenRenderMarkers = drawMarkers;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    }
    else {
        boot();
    }

})();
