/* Load tusken.js in jsdom against a stubbed server and press the board: the
   panel, the settlements, the three upgrade tracks, the fleet in orbit, the
   cooldown, the hulls, the two pickers, the found / buy / send buttons, and
   the markers on the globe.

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/tusken-page-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "tusken.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms || 25); });
}

function payload(over) {
    return Object.assign({
        me: "Combine",
        planet: "Tuskara",
        credits: 4200,
        pool: 1850,
        my_colonies: 2,
        max_colonies: 8,
        orbit: { here: true, fleet: "Spear of Ultramar" },
        cooldown: 0,
        prices: { colony: 1000, ship: 350, capacity: 2500, per_credit: 1000, cooldown: 300 },
        colonies: [
            { id: 7, name: "Red Hollow", faction: "Combine", mine: true,
              spot: 1, x: 22, y: 24, size: 2, catch: 1, hold: 2, slaves: 1200,
              capacity: 6000, per_hour: 1000,
              size_cost: 800, catch_cost: 300, hold_cost: 600 },
            { id: 8, name: "Dry Verge", faction: "Freedom Authority", mine: false,
              spot: 2, x: 50, y: 18, size: 1, catch: 1, hold: 1, slaves: 400,
              capacity: 1500, per_hour: 500,
              size_cost: 400, catch_cost: 300, hold_cost: 300 }
        ],
        fleets: [
            { id: "f1", name: "Spear of Ultramar", status: "stationed", at: "Tuskara",
              stationed: true, lift: 2500, transports: 1, soldiers: 3000 },
            { id: "f2", name: "Hammer of Mars", status: "travelling", at: null,
              stationed: false, lift: 0, transports: 0, soldiers: 0 }
        ],
        ships: [
            { id: 1, name: "Transport 1", capacity: 2500, fleet_id: "f1",
              fleet: "Spear of Ultramar", at_sea: false, to: null, seconds: 0 }
        ],
        idle_ships: 1,
        workforce: [
            { planet: "Krieg", amount: 25000, bonus: 25 },
            { planet: "Ultramars", amount: 4000, bonus: 4 }
        ],
        destinations: [
            { planet: "Krieg", x: 70, y: 85, income: 100, slaves: 25000, seconds: 300 },
            { planet: "Ultramars", x: 10, y: 19, income: 100, slaves: 4000, seconds: 240 }
        ],
        convoys: [
            { id: 3, from: "Tuskara", to: "Krieg", amount: 2500, ships: 1,
              fleet: "Spear of Ultramar", status: "sailing", outcome: null, seconds: 192 }
        ]
    }, over || {});
}

async function open(name, options) {

    options = options || {};

    const dom = new JSDOM(
        '<!doctype html><html><head></head><body>' +
        '<div class="planet-world"><div id="planet-globe"><div id="cities"></div></div></div>' +
        '</body></html>',
        {
            url: "http://localhost/planet.html?name=" + encodeURIComponent(name),
            pretendToBeVisual: true,
            runScripts: "dangerously"
        }
    );

    const calls = [];

    const state = options.state || payload();

    dom.window.supabaseClient = {
        rpc: async function(fn, args) {
            calls.push({ fn: fn, args: args });
            if (options.broken) { return { data: null, error: { message: "function public.tusken_world() does not exist" } }; }
            if (fn === "tusken_world") { return { data: state, error: null }; }
            if (fn === "tusken_found_colony") {
                return { data: { ok: true, name: "The Bone Yard", paid: 500, spot: 2, x: 50, y: 18,
                                 fleet: "Spear of Ultramar" }, error: null };
            }
            if (fn === "tusken_buy_ship") {
                return { data: { ok: true, id: 2, name: "Transport 2", paid: 350, capacity: 2500,
                                 fleet: "Spear of Ultramar", fleet_id: args.p_fleet, lift: 5000 }, error: null };
            }
            if (fn === "tusken_upgrade") { return { data: { ok: true, paid: 800, track: args.p_track }, error: null }; }
            if (fn === "tusken_ship") {
                return { data: { ok: true, amount: args.p_amount, to: args.p_to, paid: 0,
                                 fleet: "Spear of Ultramar", fleet_id: args.p_fleet, ships: 1,
                                 lift: 2500, escort: 3000, seconds: 180 }, error: null };
            }
            return { data: null, error: { message: "unknown call" } };
        }
    };

    const script = dom.window.document.createElement("script");
    script.textContent = SOURCE;
    dom.window.document.body.appendChild(script);

    await wait(40);

    return { dom: dom, doc: dom.window.document, calls: calls, state: state };

}

(async function main() {

    try {

        console.log("\n== the board on Tuskara");

        const page = await open("Tuskara");
        const doc = page.doc;
        const panel = doc.getElementById("tusken-panel");

        ok("the board is built", !!panel);
        ok("it reads only on Tuskara", page.calls.length > 0 && page.calls[0].fn === "tusken_world");
        ok("the credits are shown", panel.querySelector("#tusken-credits").textContent.indexOf("4,200") === 0,
            panel.querySelector("#tusken-credits").textContent);
        ok("the pens are shown", panel.querySelector("#tusken-pool").textContent === "1,850");
        ok("the Tusken at work are counted", panel.querySelector("#tusken-work").textContent === "29,000",
            panel.querySelector("#tusken-work").textContent);
        ok("their income is summed", panel.querySelector("#tusken-work-income").textContent === "+29 / PAYMENT",
            panel.querySelector("#tusken-work-income").textContent);
        ok("the settlements are counted", /2 OF 8/.test(panel.querySelector("#tusken-colony-count").textContent),
            panel.querySelector("#tusken-colony-count").textContent);
        ok("the fleet overhead is named", panel.querySelector("#tusken-orbit").textContent === "Spear of Ultramar",
            panel.querySelector("#tusken-orbit").textContent);
        ok("and reads as good news", /good/.test(panel.querySelector("#tusken-orbit-line").className));

        console.log("\n== the settlements");

        const cards = panel.querySelectorAll(".tusken-card");
        ok("one card per settlement", cards.length === 2, cards.length);
        ok("mine is marked", cards[0].classList.contains("mine"));
        ok("the other side's is not", !cards[1].classList.contains("mine"));
        ok("the name is there", cards[0].textContent.indexOf("Red Hollow") >= 0);
        ok("the tracks are there", cards[0].textContent.indexOf("SIZE 2") >= 0 && cards[0].textContent.indexOf("HOLD 2") >= 0);
        ok("the pens read as a fraction", cards[0].textContent.indexOf("1,200 / 6,000") >= 0, cards[0].textContent);
        ok("the catch is stated", cards[0].textContent.indexOf("1,000 an hour") >= 0);

        const upButtons = cards[0].querySelectorAll("[data-up]");
        ok("three tracks to buy on a settlement of ours", upButtons.length === 3, upButtons.length);
        ok("size costs its price", upButtons[0].dataset.up === "size" && /800 CR/.test(upButtons[0].textContent));
        ok("catch is its own work", upButtons[1].dataset.up === "catch" && /300 CR/.test(upButtons[1].textContent));
        ok("hold is its own work", upButtons[2].dataset.up === "hold" && /600 CR/.test(upButtons[2].textContent));
        ok("nothing is sold on a settlement we do not own", cards[1].querySelectorAll("[data-up]").length === 0);

        console.log("\n== the markers on the globe");

        const markers = doc.querySelectorAll("#cities .city.tusken");
        ok("one marker per settlement", markers.length === 2, markers.length);
        ok("the marker names the settlement", /Red Hollow/.test(markers[0].textContent));
        ok("the marker carries its pens", /1,200/.test(markers[0].textContent));
        ok("the marker stands where the server puts it",
            markers[0].style.left === "22%" && markers[0].style.top === "24%",
            markers[0].style.left + "," + markers[0].style.top);
        ok("the second one has its own place",
            markers[1].style.left === "50%" && markers[1].style.top === "18%",
            markers[1].style.left + "," + markers[1].style.top);
        ok("the marker takes its faction's colour", markers[0].classList.contains("combine") &&
            markers[1].classList.contains("freedom"));

        console.log("\n== a marker opens its card");

        markers[1].click();
        await wait(20);

        let lit = doc.querySelectorAll("#tusken-colonies .tusken-card.picked");

        ok("a rival's marker finds its card too", lit.length === 1 &&
            lit[0].dataset.settlement === "8", lit.length);
        ok("the card is lit, the other is not",
            doc.querySelectorAll("#tusken-colonies .tusken-card")[0].classList.contains("picked") === false);
        ok("and the marker says it was picked", markers[1].classList.contains("picked"),
            markers[1].className);
        ok("no server call is needed to open a card",
            page.calls.filter(function(c) { return c.fn !== "tusken_world"; }).length === 0);

        markers[0].click();
        await wait(20);

        lit = doc.querySelectorAll("#tusken-colonies .tusken-card.picked");

        ok("another marker moves the pick", lit.length === 1 && lit[0].dataset.settlement === "7",
            lit.length);
        ok("the globe agrees", markers[0].classList.contains("picked") &&
            !markers[1].classList.contains("picked"),
            markers[0].className + " / " + markers[1].className);

        console.log("\n== founding");

        const found = panel.querySelector("#tusken-found");
        ok("the next settlement's price is on the button", /1,000 CR/.test(found.textContent), found.textContent);
        ok("it is offered", found.disabled === false);

        found.click();
        await wait(30);

        const foundCall = page.calls.filter(function(c) { return c.fn === "tusken_found_colony"; })[0];
        ok("founding asks the server", !!foundCall);
        ok("the answer is reported", /The Bone Yard/.test(panel.querySelector("#tusken-msg").textContent),
            panel.querySelector("#tusken-msg").textContent);
        ok("and it names the fleet that holds the orbit",
            /Spear of Ultramar/.test(panel.querySelector("#tusken-msg").textContent),
            panel.querySelector("#tusken-msg").textContent);

        const keptLit = doc.querySelectorAll("#tusken-colonies .tusken-card.picked");

        ok("the pick survives the redraw", keptLit.length === 1 &&
            keptLit[0].dataset.settlement === "7", keptLit.length);
        ok("and the fresh markers still carry it",
            doc.querySelector("#cities .city.tusken.picked") !== null);

        console.log("\n== growing a settlement");

        panel.querySelectorAll("[data-up]")[1].click();
        await wait(30);

        const upCall = page.calls.filter(function(c) { return c.fn === "tusken_upgrade"; })[0];
        ok("the upgrade names the settlement and the track", upCall && upCall.args.p_colony === 7 && upCall.args.p_track === "catch",
            upCall && upCall.args);
        ok("the work is reported", /CATCH/.test(panel.querySelector("#tusken-msg").textContent));

        console.log("\n== the hulls");

        ok("the price and the hull's size are stated",
            /2,500 A HULL/.test(panel.querySelector("#tusken-ship-price").textContent),
            panel.querySelector("#tusken-ship-price").textContent);
        ok("the hull in port is listed",
            /Transport 1/.test(panel.querySelector("#tusken-ships").textContent) &&
            /DOCKED/.test(panel.querySelector("#tusken-ships").textContent),
            panel.querySelector("#tusken-ships").textContent);
        ok("the hull names the fleet it sails with",
            /Spear of Ultramar/.test(panel.querySelector("#tusken-ships").textContent),
            panel.querySelector("#tusken-ships").textContent);
        ok("the fleet's lift is listed",
            /Spear of Ultramar/.test(panel.querySelector("#tusken-fleets").textContent) &&
            /1 HULLS · 2,500 LIFT/.test(panel.querySelector("#tusken-fleets").textContent),
            panel.querySelector("#tusken-fleets").textContent);
        ok("a fleet with no hulls says so",
            /NO TRANSPORTS/.test(panel.querySelector("#tusken-fleets").textContent),
            panel.querySelector("#tusken-fleets").textContent);

        const buyPicker = panel.querySelector("#tusken-buy-fleet");
        ok("the hull is bought for one of our fleets", buyPicker.options.length === 2 &&
            buyPicker.value === "f1", buyPicker.value);

        panel.querySelector("#tusken-buy-ship").click();
        await wait(30);

        const buyCall = page.calls.filter(function(c) { return c.fn === "tusken_buy_ship"; })[0];
        ok("buying a hull asks the server", !!buyCall);
        ok("and names the fleet that takes it", buyCall && buyCall.args.p_fleet === "f1",
            buyCall && buyCall.args);
        ok("the hull is reported with its fleet",
            /Transport 2 joins the Spear of Ultramar/.test(panel.querySelector("#tusken-msg").textContent),
            panel.querySelector("#tusken-msg").textContent);

        console.log("\n== sending a load");

        const from = panel.querySelector("#tusken-from");
        const to = panel.querySelector("#tusken-to");
        const amount = panel.querySelector("#tusken-amount");

        ok("every place holding Tusken can be the source", from.options.length === 3, from.options.length);
        ok("Tuskara is one of them", from.options[0].value === "Tuskara");
        ok("only worlds we hold whole are offered", to.options.length === 2 &&
            Array.from(to.options).every(function(o) { return o.value !== "Tuskara"; }), to.options.length);
        ok("the load defaults to the fleet's lift", amount.value === "1850", amount.value);
        ok("the trip is stated as free", /trip is free/.test(panel.querySelector("#tusken-available").textContent),
            panel.querySelector("#tusken-available").textContent);
        ok("the lift is stated on the fleet that carries it",
            /2,500 lift/.test(panel.querySelector("#tusken-available").textContent),
            panel.querySelector("#tusken-available").textContent);

        const loadPicker = panel.querySelector("#tusken-fleet");
        ok("only a fleet in orbit of the source carries it",
            loadPicker.options.length === 1 && loadPicker.value === "f1",
            loadPicker.options.length + " " + loadPicker.value);

        to.value = "Krieg";
        amount.value = "1850";
        panel.querySelector("#tusken-ship").click();
        await wait(30);

        const shipCall = page.calls.filter(function(c) { return c.fn === "tusken_ship"; })[0];
        ok("the load is sent from the pens", shipCall && shipCall.args.p_from === "Tuskara" &&
            shipCall.args.p_to === "Krieg" && shipCall.args.p_amount === 1850, shipCall && shipCall.args);
        ok("and the fleet that carries it is named", shipCall && shipCall.args.p_fleet === "f1",
            shipCall && shipCall.args);
        ok("the load is reported on the fleet that carried it",
            /1,850 Tusken aboard the Spear of Ultramar for Krieg/.test(panel.querySelector("#tusken-msg").textContent),
            panel.querySelector("#tusken-msg").textContent);
        ok("and the trip is called free", /costs nothing/.test(panel.querySelector("#tusken-msg").textContent));

        console.log("\n== what the board already holds");

        ok("the work is listed with its money", /Krieg/.test(panel.querySelector("#tusken-workforce").textContent) &&
            /\+25/.test(panel.querySelector("#tusken-workforce").textContent),
            panel.querySelector("#tusken-workforce").textContent);
        ok("a convoy is listed with its clock", /Tuskara → Krieg/.test(panel.querySelector("#tusken-convoys").textContent) &&
            /2,500 · 3m 12s/.test(panel.querySelector("#tusken-convoys").textContent),
            panel.querySelector("#tusken-convoys").textContent);

        ok("the panel is styled by its own stylesheet", !!doc.getElementById("tusken-css"));

        page.dom.window.close();

        console.log("\n== without a fleet in orbit");

        const noFleet = await open("Tuskara", {
            state: payload({ orbit: { here: false, fleet: null } })
        });

        const noFleetPanel = noFleet.doc.getElementById("tusken-panel");

        ok("the orbit says so", noFleetPanel.querySelector("#tusken-orbit").textContent === "NO FLEET IN ORBIT",
            noFleetPanel.querySelector("#tusken-orbit").textContent);
        ok("and reads as bad news", /bad/.test(noFleetPanel.querySelector("#tusken-orbit-line").className));
        ok("founding is refused locally",
            noFleetPanel.querySelector("#tusken-found").disabled === true,
            noFleetPanel.querySelector("#tusken-found").textContent);
        ok("the reason is on the button", /NO FLEET IN ORBIT/.test(noFleetPanel.querySelector("#tusken-found").textContent),
            noFleetPanel.querySelector("#tusken-found").textContent);
        ok("no founding is asked of the server",
            noFleet.calls.filter(function(c) { return c.fn === "tusken_found_colony"; }).length === 0);

        noFleet.dom.window.close();

        console.log("\n== while the bands rest");

        const resting = await open("Tuskara", { state: payload({ cooldown: 132 }) });
        const restPanel = resting.doc.getElementById("tusken-panel");

        ok("founding is refused locally",
            restPanel.querySelector("#tusken-found").disabled === true);
        ok("the clock is on the button", /2m 12s/.test(restPanel.querySelector("#tusken-found").textContent),
            restPanel.querySelector("#tusken-found").textContent);

        resting.dom.window.close();

        console.log("\n== without a transport");

        const noShip = await open("Tuskara", {
            state: payload({ ships: [], idle_ships: 0 })
        });

        const noShipPanel = noShip.doc.getElementById("tusken-panel");

        ok("the board says there is no hull",
            /No transports/.test(noShipPanel.querySelector("#tusken-ships").textContent),
            noShipPanel.querySelector("#tusken-ships").textContent);
        ok("sending is refused locally",
            noShipPanel.querySelector("#tusken-ship").disabled === true);
        ok("and the buying price is offered",
            /350 CR/.test(noShipPanel.querySelector("#tusken-buy-ship").textContent),
            noShipPanel.querySelector("#tusken-buy-ship").textContent);

        noShip.dom.window.close();

        console.log("\n== everywhere else");

        const other = await open("Krieg");
        ok("no board on another world", !other.doc.getElementById("tusken-panel"));
        ok("and nothing is asked of the server", other.calls.length === 0, other.calls.length);
        other.dom.window.close();

        console.log("\n== when the patches have not been run");

        const broken = await open("Tuskara", { broken: true });
        await wait(30);
        ok("the board says what to run",
            /2026-11-26_the_tusken_world/.test(broken.doc.getElementById("tusken-msg").textContent) &&
            /2026-11-27_the_pens_and_the_transports/.test(broken.doc.getElementById("tusken-msg").textContent),
            broken.doc.getElementById("tusken-msg").textContent);

        broken.dom.window.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
