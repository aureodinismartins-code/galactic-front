/* =========================================================
   TUSKARA — THE TUSKEN HOMEWORLD

   Tuskara is not a three-city world: nothing is conquered
   here, it is settled. What stands on the dust are small
   settlements, each on its own patch of the desert, and a
   settlement is a pen.

     SIZE   how big the settlement (and its pens) is
     CATCH  how many Tusken the bands take per hour
     HOLD   how many they can keep before a load must leave

   A settlement can only be raised while a fleet of the
   faction is in orbit of Tuskara, and the bands need a pause
   between two of them.

   A Tusken still standing on Tuskara is worth nothing: the
   desert has no industry. Every 1,000 shipped to a world the
   faction holds whole add 1 credit to that world's payment,
   and the world they left loses exactly that.

   A transport is not a ship of its own: it JOINS A TRANSPORT
   FLEET, one of the congress-free cargo fleets. 350 credits
   buys a hull once, the buyer names the cargo fleet it is for,
   and that fleet's lift is the sum of its hulls. A hull is
   never given to a warship, and no soldier is ever raised into
   a cargo fleet: it carries Tusken and nothing else. The fleet
   must be in orbit of the world the Tusken are leaving, and
   the trip itself costs nothing.

   A fleet in orbit of the destination may fall on the load: if
   the escort (the slaving fleet's own soldiers) is weaker, the
   fleet and its hulls are taken and the Tusken work for the
   captor; if it is stronger, the load lands and the raider is
   mauled.

   A marker on the dust and a card in the panel are the same
   settlement: pressing the marker picks the settlement, brings
   its card up in the panel and leaves it lit until another is
   picked, so an owner's card and a rival's card both answer.

   This file is loaded by planet.html and only does anything
   when the page is Tuskara. Everything it draws comes from
   public.tusken_world(); see sql/2026-11-26_the_tusken_world.sql
   and sql/2026-11-27_the_pens_and_the_transports.sql.
   ========================================================= */

(function () {

    const PLANET = "Tuskara";

    const here =
        (new URLSearchParams(window.location.search).get("name") || "") === PLANET;

    if (!here) { return; }

    let state = null;
    let busy = false;
    let optionsKey = "";

    /* the settlement the player last pressed on the globe (or null) */
    let picked = null;

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

    function spyPrice() {
        return state && state.spy ? Number(state.spy.price) : 250;
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
            #tusken-panel .tusken-line.good b { color: #9fe08a; }
            #tusken-panel .tusken-line.bad b { color: #ff9a7a; }
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
            #tusken-panel .tusken-row.sea b { color: #ffd37a; }
            #tusken-panel .tusken-row.dock b { color: #9fe08a; }
            #tusken-panel .tusken-row.taken b { color: #ff8f7a; }
            .city.tusken .city-marker {
                width: 9px !important;
                height: 9px !important;
                background: #e6c17a !important;
                border-color: #ffe6b0 !important;
                box-shadow: 0 0 10px 2px rgba(214, 168, 75, .8) !important;
            }
            .city.tusken span { color: #f0cf8a; font-size: 10px; }
            .city.tusken { cursor: pointer; }
            .city.tusken.picked .city-marker {
                background: #fff3d6 !important;
                border-color: #fffaf0 !important;
                box-shadow: 0 0 18px 5px rgba(255, 211, 122, .95) !important;
            }
            .city.tusken.picked span { color: #fff3d6; font-weight: bold; }
            #tusken-panel .tusken-card.picked {
                border-color: #ffd37a;
                background: rgba(240,207,138,.13);
                box-shadow: inset 0 0 0 1px rgba(255, 211, 122, .5);
            }
            #tusken-panel .tusken-split { display: flex; gap: 6px; align-items: stretch; margin-top: 5px; }
            #tusken-panel .tusken-split .tusken-input { flex: 1; margin-top: 0; }
            #tusken-panel .tusken-split .tusken-btn { width: auto; flex: 0 0 auto; margin-top: 0; }
            #tusken-panel .tusken-card.unknown { border-style: dashed; border-color: rgba(200,180,140,.4); }
            #tusken-panel .tusken-card.scouted { border-color: rgba(160,210,255,.4); }
            .city.tusken.unknown .city-marker {
                background: #7d7159 !important;
                border-color: #a99a7c !important;
                box-shadow: none !important;
            }
            .city.tusken.unknown span { color: #9c8f74; }
            .city.tusken.unknown.picked .city-marker {
                background: #c9b994 !important;
                border-color: #efe3cb !important;
                box-shadow: 0 0 14px 3px rgba(201,185,148,.7) !important;
            }
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
            <div class="tusken-sub">THE TUSKEN HOMEWORLD · NOTHING IS CONQUERED HERE, ONLY SETTLED</div>

            <div class="tusken-line"><span>FACTION CREDITS</span><b id="tusken-credits">—</b></div>
            <div class="tusken-line"><span>IN THE PENS</span><b id="tusken-pool">—</b></div>
            <div class="tusken-line"><span>TUSKEN AT WORK</span><b id="tusken-work">—</b></div>
            <div class="tusken-line"><span>THEIR INCOME</span><b id="tusken-work-income">—</b></div>
            <div class="tusken-line" id="tusken-orbit-line"><span>ORBIT</span><b id="tusken-orbit">—</b></div>

            <div class="tusken-sub">
                Every 1,000 Tusken put to work on a world add 1 credit to that world's payment.
                On Tuskara itself they earn nothing — a slave is only worth the ship that carries it,
                and a settlement needs a fleet overhead before the bands walk out.
                A transport joins a fleet: the hulls give that fleet its lift, and the fleet carries
                the load — through an enemy orbit, if the escort is strong enough.
            </div>

            <div class="tusken-head"><h3>SETTLEMENT</h3><span id="tusken-colony-count"></span></div>
            <div id="tusken-colony"></div>
            <button type="button" id="tusken-found" class="tusken-btn go">FOUND A SETTLEMENT</button>

            <div class="tusken-head"><h3>TRANSPORT FLEETS</h3><span>THE ONLY FLEETS A HULL SAILS WITH</span></div>
            <div id="tusken-fleets"></div>

            <div class="tusken-head"><h3>TRANSPORTS</h3><span id="tusken-ship-price"></span></div>
            <div id="tusken-ships"></div>
            <label class="tusken-label" for="tusken-buy-fleet">THE FLEET THE NEXT HULL JOINS</label>
            <select id="tusken-buy-fleet" class="tusken-select"></select>
            <button type="button" id="tusken-buy-ship" class="tusken-btn">BUY A TRANSPORT</button>

            <label class="tusken-label" for="tusken-new-fleet-name">A FLEET OF TRANSPORTS ONLY — NO CONGRESS, NO QUOTA</label>
            <div class="tusken-split">
                <input id="tusken-new-fleet-name" class="tusken-input" type="text" maxlength="40"
                       placeholder="Transport fleet name">
                <button type="button" id="tusken-new-fleet" class="tusken-btn">FORM A FLEET — 300 CR</button>
            </div>

            <div class="tusken-head"><h3>SEND A LOAD</h3><span>THE TRIP IS FREE</span></div>
            <label class="tusken-label" for="tusken-fleet">CARRIED BY</label>
            <select id="tusken-fleet" class="tusken-select"></select>
            <label class="tusken-label" for="tusken-from">FROM</label>
            <select id="tusken-from" class="tusken-select"></select>
            <label class="tusken-label" for="tusken-to">TO</label>
            <select id="tusken-to" class="tusken-select"></select>
            <label class="tusken-label" for="tusken-amount">HOW MANY</label>
            <input id="tusken-amount" class="tusken-input" type="number" min="1" step="100" value="2500">
            <div class="tusken-sub" id="tusken-available"></div>
            <button type="button" id="tusken-ship" class="tusken-btn go">SEND THE LOAD</button>

            <div id="tusken-msg" class="tusken-msg"></div>

            <div class="tusken-head"><h3>AT WORK</h3><span>WHAT THEY PAY</span></div>
            <div id="tusken-workforce"></div>

            <div class="tusken-head"><h3>CONVOYS</h3><span>ON THE ROAD</span></div>
            <div id="tusken-convoys"></div>
        `;

        document.body.appendChild(panel);

        panel.querySelector("#tusken-found").addEventListener("click", function () { act("found"); });
        panel.querySelector("#tusken-buy-ship").addEventListener("click", function () { act("buy"); });
        panel.querySelector("#tusken-new-fleet").addEventListener("click", function () { act("newfleet"); });
        panel.querySelector("#tusken-ship").addEventListener("click", function () { act("ship"); });

        panel.addEventListener("click", function (ev) {

            if (!ev.target || !ev.target.closest) { return; }

            const up = ev.target.closest("[data-up]");
            if (up) { act("upgrade", up); return; }

            /* the spy button lives inside the settlement card */
            const spy = ev.target.closest("[data-act='spy']");
            if (spy) { act("spy", spy); }

        });

    }

    /* ---------- reading and writing ---------- */

    async function load() {

        const { data, error } = await supabaseClient.rpc("tusken_world");

        if (error) {
            state = null;
            say("The settlements answer nothing: " + error.message +
                " — run sql/2026-11-26_the_tusken_world.sql and sql/2026-11-27_the_pens_and_the_transports.sql in the Supabase editor.");
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
            else if (kind === "buy") {

                const picker = document.getElementById("tusken-buy-fleet");

                if (!picker.value) {
                    say("No fleet to join: a hull has to be given to one of your fleets.");
                }
                else {
                    result = await supabaseClient.rpc("tusken_buy_ship", { p_fleet: picker.value });
                }

            }
            else if (kind === "upgrade" && btn) {
                result = await supabaseClient.rpc("tusken_upgrade", {
                    p_colony: Number(btn.dataset.colony),
                    p_track: btn.dataset.up
                });
            }
            else if (kind === "spy" && btn) {

                result = await supabaseClient.rpc("tusken_spy", {
                    p_colony: Number(btn.dataset.colony)
                });

            }
            else if (kind === "newfleet") {

                const name = document.getElementById("tusken-new-fleet-name").value.trim();

                result = await supabaseClient.rpc("tusken_new_fleet", { p_name: name || null });

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
                else if (!document.getElementById("tusken-fleet").value) {
                    say("No slaving fleet in orbit of " + from + ": a load needs a fleet with hulls overhead.");
                }
                else {
                    result = await supabaseClient.rpc("tusken_ship", {
                        p_fleet: document.getElementById("tusken-fleet").value,
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
                    say("A settlement rises at " + d.name + ", for " + num(d.paid) +
                        " credits. " + (d.fleet || "Your fleet") + " holds the orbit.");
                }
                else if (kind === "buy") {
                    say(d.name + " joins the " + d.fleet + ", for " + num(d.paid) +
                        " credits. The fleet now carries " + num(d.lift) + ".");
                }
                else if (kind === "upgrade") {
                    say("The work is done: " + String(d.track).toUpperCase() + ", for " + num(d.paid) + " credits.");
                }
                else if (kind === "spy") {
                    say(d.name + " is ours to read for " + duration(d.seconds) + ": " + num(d.slaves) +
                        " in the pens, size " + d.size + ", catch " + d.catch + ", hold " + d.hold +
                        " — the spy cost " + num(d.paid) + " credits.");
                }
                else if (kind === "newfleet") {
                    say(d.name + " is formed at Tuskara for " + num(d.paid) +
                        " credits — no bill and no quota. Give it hulls and it can sail.");
                }
                else if (kind === "ship") {
                    say(num(d.amount) + " Tusken aboard the " + d.fleet + " for " + d.to +
                        " — " + num(d.ships) + (Number(d.ships) === 1 ? " hull, " : " hulls, ") +
                        "the trip costs nothing, " + duration(d.seconds) + " on the road.");
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

    /* one settlement, the one the player pressed: the panel is a tab on the
       marker, not a list of everything on the dust. What we do not own is
       closed until a spy has been inside it. */
    function settlementCard(c) {

        if (!c) {
            return '<div class="tusken-sub">Press a settlement on the globe. ' +
                'You know every one of your own; a rival\'s takes a spy.</div>';
        }

        if (!c.known) {
            return '<div class="tusken-card unknown" data-settlement="' + c.id + '">' +
                '<div class="tusken-line"><h3>UNKNOWN SETTLEMENT</h3><span>UNSCOUTED</span></div>' +
                '<div class="tusken-sub">Not ours, and nothing is known of it: no name, no owner, ' +
                'no count of the pens. Only a spy can open it.</div>' +
                '<button type="button" class="tusken-btn" data-act="spy" data-colony="' + c.id + '">' +
                'SEND A SPY — ' + num(spyPrice()) + ' CR</button>' +
                '</div>';
        }

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

        return '<div class="tusken-card' + (c.mine ? ' mine' : ' scouted') + '" data-settlement="' + c.id + '">' +
            '<div class="tusken-line"><h3>' + esc(c.name || "SETTLEMENT") + '</h3>' +
            '<span>' + factionName(c.faction) + '</span></div>' +
            '<div class="tusken-sub">SIZE ' + c.size + ' · CATCH ' + c.catch + ' · HOLD ' + c.hold + '</div>' +
            '<div class="tusken-line"><span>PENS</span><span>' + num(c.slaves) + ' / ' +
            num(c.capacity) + '</span></div>' +
            '<div class="tusken-bar"><div style="width:' + pct.toFixed(1) + '%"></div></div>' +
            '<div class="tusken-sub">takes up to ' + num(c.per_hour) + ' an hour</div>' +
            (c.mine ? "" : '<div class="tusken-sub">SCOUTED · THE SPY IS STILL INSIDE · ' +
                duration(c.spied_left) + '</div>') +
            track("size", c.size_cost, "GROW THE SETTLEMENT") +
            track("catch", c.catch_cost, "BETTER BANDS (CATCH)") +
            track("hold", c.hold_cost, "BIGGER PENS (HOLD)") +
            '</div>';

    }

    /* the one settlement on the board: the picked one, or the hint */
    function drawSettlement() {

        if (!state) { return; }

        const colonies = state.colonies || [];

        const shown = picked === null
            ? null
            : colonies.filter(function (c) { return Number(c.id) === picked; })[0] || null;

        if (picked !== null && !shown) { picked = null; }

        document.getElementById("tusken-colony").innerHTML = settlementCard(shown);

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

        /* the fleet in orbit is the gate on settling: say plainly which way it is */
        const orbit = state.orbit || { here: false, fleet: null };
        const orbitLine = document.getElementById("tusken-orbit-line");

        document.getElementById("tusken-orbit").textContent =
            orbit.here ? (orbit.fleet || "IN ORBIT") : "NO FLEET IN ORBIT";

        orbitLine.className = "tusken-line " + (orbit.here ? "good" : "bad");

        document.getElementById("tusken-colony-count").textContent =
            state.my_colonies + " OF " + state.max_colonies + " SETTLED";

        /* only the settlement the player pressed is shown, and a redraw every
           eight seconds keeps it: the pick is an id, not a DOM node */
        drawSettlement();

        drawSelection(false);

        /* ---- the found button answers to all three gates ---- */
        const found = document.getElementById("tusken-found");
        const wait = Number(state.cooldown || 0);

        let why = null;

        if (state.my_colonies >= state.max_colonies) {
            why = "NO MORE SETTLEMENTS";
        }
        else if (!orbit.here) {
            why = "NO FLEET IN ORBIT";
        }
        else if (wait > 0) {
            why = "THE BANDS REST — " + duration(wait);
        }

        found.textContent = why || "FOUND A SETTLEMENT — " + num(state.prices.colony) + " CR";
        found.disabled = !!why;

        /* ---- the cargo fleets, and the lift their hulls give them ---- */
        const fleets = state.fleets || [];

        /* a hull sails with a transport fleet only: the battle line is never
           offered here, and a ship of the line never appears in the picker */
        const carriers = fleets.filter(function (f) { return f.transport !== false; });

        document.getElementById("tusken-fleets").innerHTML = carriers.length
            ? carriers.map(function (f) {
                return '<div class="tusken-row' + (f.stationed ? "" : " sea") + '"><span>' +
                    esc(f.name) + ' · ' + esc(f.at || (f.stationed ? "NOWHERE" : "AT SEA")) +
                    '</span><b>' + (Number(f.transports) > 0
                        ? num(f.transports) + " HULLS · " + num(f.lift) + " LIFT"
                        : "NO HULLS") + '</b></div>';
            }).join("")
            : '<div class="tusken-sub">No transport fleet yet. A hull sails with one of those, ' +
                'and one costs nothing but credits — form it below.</div>';

        /* ---- the hulls, each under the fleet it sails with ---- */
        const ships = state.ships || [];
        const idle = Number(state.idle_ships || 0);

        document.getElementById("tusken-ship-price").textContent =
            num(idle) + " IN PORT · " + num(state.prices.capacity) + " A HULL";

        document.getElementById("tusken-ships").innerHTML = ships.length
            ? ships.map(function (s) {
                const atSea = s.at_sea === true;
                return '<div class="tusken-row ' + (atSea ? "sea" : "dock") + '"><span>' +
                    esc(s.name) + ' · ' + esc(s.fleet || "NO FLEET") + '</span><b>' +
                    (atSea ? "AT SEA → " + esc(s.to) : "DOCKED") + '</b></div>';
            }).join("")
            : '<div class="tusken-sub">No transports. Buy a hull, name the fleet it joins, and it is yours for good.</div>';

        /* the fleet the next hull joins */
        const buyPicker = document.getElementById("tusken-buy-fleet");
        const buyKey = carriers.map(function (f) { return f.id; }).join("|");

        if (buyPicker.dataset.key !== buyKey) {

            const keep = buyPicker.value;

            buyPicker.innerHTML = carriers.map(function (f) {
                return '<option value="' + esc(f.id) + '">' + esc(f.name) +
                    (f.at ? " · " + esc(f.at) : "") + "</option>";
            }).join("") || '<option value="">NO TRANSPORT FLEET — FORM ONE BELOW</option>';

            buyPicker.dataset.key = buyKey;

            if (carriers.some(function (f) { return f.id === keep; })) { buyPicker.value = keep; }
            else if (carriers.some(function (f) { return f.id === orbit.fleet_id; })) {
                buyPicker.value = orbit.fleet_id;
            }
        }

        const buy = document.getElementById("tusken-buy-ship");

        buy.textContent = "BUY A TRANSPORT — " + num(state.prices.ship) + " CR";
        buy.disabled = !carriers.length || Number(state.credits || 0) < Number(state.prices.ship || 0);

        /* a transport fleet is bought, not voted on: no chamber is asked */
        const fonder = document.getElementById("tusken-new-fleet");
        const tf = state.transport_fleets || { price: 300, max: 4, used: 0 };

        fonder.textContent = Number(tf.used) >= Number(tf.max)
            ? "FOUR TRANSPORT FLEETS — THE LIMIT"
            : "FORM A FLEET — " + num(tf.price) + " CR";
        fonder.disabled = Number(tf.used) >= Number(tf.max) ||
            Number(state.credits || 0) < Number(tf.price);

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

        /* only a fleet in orbit of the source, with hulls aboard, can carry it */
        const slavers = fleets.filter(function (f) {
            return f.stationed === true && Number(f.lift) > 0 && f.at === chosen &&
                f.transport !== false;
        });

        const loadPicker = document.getElementById("tusken-fleet");
        const slaverKey = slavers.map(function (f) { return f.id; }).join("|");

        if (loadPicker.dataset.key !== slaverKey) {

            const keep = loadPicker.value;

            loadPicker.innerHTML = slavers.map(function (f) {
                return '<option value="' + esc(f.id) + '">' + esc(f.name) + " · " +
                    num(f.lift) + " LIFT</option>";
            }).join("") || '<option value="">NO SLAVING FLEET HERE</option>';

            loadPicker.dataset.key = slaverKey;

            if (slavers.some(function (f) { return f.id === keep; })) { loadPicker.value = keep; }
        }

        const carrying = slavers.filter(function (f) { return f.id === loadPicker.value; })[0] || null;

        const capacity = carrying ? Number(carrying.lift) : 0;
        const most = Math.min(capacity, Number(source.amount));

        const send = document.getElementById("tusken-ship");
        const available = document.getElementById("tusken-available");

        if (!ships.length) {
            available.textContent = "No hull yet: " + num(state.prices.ship) +
                " credits buys one for a transport fleet, and the trips after it are free.";
            send.disabled = true;
        }
        else if (!slavers.length) {
            available.textContent = "No transport fleet in orbit of " + chosen +
                ": sail one here, or give hulls to the cargo fleet already overhead.";
            send.disabled = true;
        }
        else if (!(most > 0)) {
            available.textContent = "Nothing to load here.";
            send.disabled = true;
        }
        else {
            available.textContent = "Up to " + num(most) + " on the " + carrying.name + " · " +
                num(carrying.lift) + " lift · the trip is free";
            send.disabled = false;
        }

        const amount = document.getElementById("tusken-amount");

        if (!amount.value || Number(amount.value) > Math.max(1, most)) {
            amount.value = String(Math.max(0, most));
        }

        amount.max = String(Math.max(1, most));

        document.getElementById("tusken-workforce").innerHTML = workforce.length
            ? workforce.map(function (w) {
                return '<div class="tusken-row"><span>' + esc(w.planet) + '</span><b>' +
                    num(w.amount) + ' · +' + num(w.bonus) + '</b></div>';
            }).join("")
            : '<div class="tusken-sub">No Tusken are at work yet. Send a load.</div>';

        const convoys = state.convoys || [];

        document.getElementById("tusken-convoys").innerHTML = convoys.length
            ? convoys.map(function (k) {
                const done = !!k.status && k.status !== "sailing";
                return '<div class="tusken-row ' +
                    (k.status === "captured" ? "taken" : (done ? "" : "sea")) + '"><span>' +
                    esc(k.from) + ' → ' + esc(k.to) + (k.fleet ? " · " + esc(k.fleet) : "") +
                    '</span><b>' + (done
                        ? esc(String(k.outcome || k.status).toUpperCase())
                        : num(k.amount) + ' · ' + duration(k.seconds)) + '</b></div>';
            }).join("")
            : '<div class="tusken-sub">No ships on the road.</div>';

    }

    /* ---------- the marker and its card ---------- */

    /* Pressing a marker picks that settlement: its card is lit and
       scrolled up in the panel. It stays lit across redraws until
       another settlement is picked, so a player coming back to the
       globe still sees which one they were looking at. */
    function pick(id) {

        picked = id === null || id === undefined ? null : Number(id);

        if (!picked) { picked = null; }

        drawSettlement();
        drawSelection();

    }

    function drawSelection() {

        document.querySelectorAll("#cities .city.tusken").forEach(function (marker) {
            marker.classList.toggle("picked", Number(marker.dataset.colony) === picked);
        });

    }

    function drawMarkers() {

        const container = document.getElementById("cities");

        if (!container) { return; }

        container.innerHTML = "";

        if (!state || !(state.colonies || []).length) { return; }

        state.colonies.forEach(function (c) {

            /* a settlement nobody has scouted is a marker on the dust: the
               server sends no name, no owner and no count to draw */
            const known = c.mine === true || c.known === true;

            const el = document.createElement("div");

            el.className = "city tusken " + (known ? factionClass(c.faction) : "unknown") +
                (picked === Number(c.id) ? " picked" : "");
            el.style.left = Number(c.x || 50) + "%";
            el.style.top = Number(c.y || 50) + "%";
            el.dataset.colony = c.id;
            el.title = known
                ? (c.name || "Settlement") + " — " + factionName(c.faction) +
                    " · " + num(c.slaves) + " in the pens"
                : "An unidentified settlement — send a spy to read it";

            el.innerHTML = '<div class="city-marker"></div><span>' + (known
                ? esc(c.name || "Settlement") + " · " + num(c.slaves)
                : "UNKNOWN") + "</span>";

            el.addEventListener("click", function () { pick(c.id); });

            container.appendChild(el);

        });

    }

    /* ---------- boot ---------- */

    function boot() {

        buildPanel();

        refresh();

        /* the settlements are the world's only clock: this keeps the pens and
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
