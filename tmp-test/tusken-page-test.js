/* Load tusken.js in jsdom against a stubbed server and press the board:
   the panel, the colonies, the three upgrade tracks, the two pickers, the
   found and ship buttons, and the markers on the globe.

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
        max_colonies: 3,
        prices: { colony: 1000, ship: 350, capacity: 2500, per_credit: 10000 },
        colonies: [
            { id: 7, name: "Red Hollow", faction: "Combine", mine: true,
              size: 2, catch: 1, hold: 2, slaves: 1200,
              capacity: 6000, per_hour: 1000,
              size_cost: 800, catch_cost: 300, hold_cost: 600 },
            { id: 8, name: "Dry Verge", faction: "Freedom Authority", mine: false,
              size: 1, catch: 1, hold: 1, slaves: 400,
              capacity: 1500, per_hour: 500,
              size_cost: 400, catch_cost: 300, hold_cost: 300 }
        ],
        workforce: [
            { planet: "Krieg", amount: 25000, bonus: 2 },
            { planet: "Ultramars", amount: 4000, bonus: 0 }
        ],
        destinations: [
            { planet: "Krieg", x: 70, y: 85, income: 100, slaves: 25000, seconds: 300 },
            { planet: "Ultramars", x: 10, y: 19, income: 100, slaves: 4000, seconds: 240 }
        ],
        convoys: [
            { id: 3, from: "Tuskara", to: "Krieg", amount: 2500, arrival: "2026-11-26T00:00:00Z", seconds: 192 }
        ]
    }, over || {});
}

async function open(name, broken) {

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

    const state = payload();

    dom.window.supabaseClient = {
        rpc: async function(fn, args) {
            calls.push({ fn: fn, args: args });
            if (broken) { return { data: null, error: { message: "function public.tusken_world() does not exist" } }; }
            if (fn === "tusken_world") { return { data: state, error: null }; }
            if (fn === "tusken_found_colony") { return { data: { ok: true, name: "The Bone Yard", paid: 1000 }, error: null }; }
            if (fn === "tusken_upgrade") { return { data: { ok: true, paid: 800, track: args.p_track }, error: null }; }
            if (fn === "tusken_ship") { return { data: { ok: true, amount: args.p_amount, to: args.p_to, paid: 350, seconds: 180 }, error: null }; }
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
        ok("their income is summed", panel.querySelector("#tusken-work-income").textContent === "+2 / PAYMENT",
            panel.querySelector("#tusken-work-income").textContent);
        ok("the colonies are counted", /2 OF 3/.test(panel.querySelector("#tusken-colony-count").textContent));

        console.log("\n== the colonies");

        const cards = panel.querySelectorAll(".tusken-card");
        ok("one card per colony", cards.length === 2, cards.length);
        ok("mine is marked", cards[0].classList.contains("mine"));
        ok("the other side's is not", !cards[1].classList.contains("mine"));
        ok("the name is there", cards[0].textContent.indexOf("Red Hollow") >= 0);
        ok("the tracks are there", cards[0].textContent.indexOf("SIZE 2") >= 0 && cards[0].textContent.indexOf("HOLD 2") >= 0);
        ok("the pens read as a fraction", cards[0].textContent.indexOf("1,200 / 6,000") >= 0, cards[0].textContent);
        ok("the catch is stated", cards[0].textContent.indexOf("1,000 an hour") >= 0);

        const upButtons = cards[0].querySelectorAll("[data-up]");
        ok("three tracks to buy on a colony of ours", upButtons.length === 3, upButtons.length);
        ok("size costs its price", upButtons[0].dataset.up === "size" && /800 CR/.test(upButtons[0].textContent));
        ok("catch is its own work", upButtons[1].dataset.up === "catch" && /300 CR/.test(upButtons[1].textContent));
        ok("hold is its own work", upButtons[2].dataset.up === "hold" && /600 CR/.test(upButtons[2].textContent));
        ok("nothing is sold on a colony we do not own", cards[1].querySelectorAll("[data-up]").length === 0);

        console.log("\n== the markers on the globe");

        const markers = doc.querySelectorAll("#cities .city.tusken");
        ok("one marker per colony", markers.length === 2, markers.length);
        ok("the marker names the colony", /Red Hollow/.test(markers[0].textContent));
        ok("the marker carries its pens", /1,200/.test(markers[0].textContent));
        ok("the marker takes its faction's colour", markers[0].classList.contains("combine") &&
            markers[1].classList.contains("freedom"));

        console.log("\n== founding");

        const found = panel.querySelector("#tusken-found");
        ok("the next colony's price is on the button", /1,000 CR/.test(found.textContent), found.textContent);
        ok("it is offered", found.disabled === false);

        found.click();
        await wait(30);

        const foundCall = page.calls.filter(function(c) { return c.fn === "tusken_found_colony"; })[0];
        ok("founding asks the server", !!foundCall);
        ok("the answer is reported", /The Bone Yard/.test(panel.querySelector("#tusken-msg").textContent),
            panel.querySelector("#tusken-msg").textContent);

        console.log("\n== growing a colony");

        panel.querySelectorAll("[data-up]")[1].click();
        await wait(30);

        const upCall = page.calls.filter(function(c) { return c.fn === "tusken_upgrade"; })[0];
        ok("the upgrade names the colony and the track", upCall && upCall.args.p_colony === 7 && upCall.args.p_track === "catch",
            upCall && upCall.args);
        ok("the work is reported", /CATCH/.test(panel.querySelector("#tusken-msg").textContent));

        console.log("\n== loading a transport");

        const from = panel.querySelector("#tusken-from");
        const to = panel.querySelector("#tusken-to");
        const amount = panel.querySelector("#tusken-amount");

        ok("every place holding Tusken can be the source", from.options.length === 3, from.options.length);
        ok("Tuskara is one of them", from.options[0].value === "Tuskara");
        ok("only worlds we hold whole are offered", to.options.length === 2 &&
            Array.from(to.options).every(function(o) { return o.value !== "Tuskara"; }), to.options.length);
        ok("the load defaults to one ship", amount.value === "1850", amount.value);
        ok("the most that can leave is stated", /1,850/.test(panel.querySelector("#tusken-available").textContent),
            panel.querySelector("#tusken-available").textContent);

        to.value = "Krieg";
        amount.value = "1850";
        panel.querySelector("#tusken-ship").click();
        await wait(30);

        const shipCall = page.calls.filter(function(c) { return c.fn === "tusken_ship"; })[0];
        ok("the ship is bought from the pens", shipCall && shipCall.args.p_from === "Tuskara" &&
            shipCall.args.p_to === "Krieg" && shipCall.args.p_amount === 1850, shipCall && shipCall.args);
        ok("the load is reported", /1,850 Tusken aboard for Krieg/.test(panel.querySelector("#tusken-msg").textContent),
            panel.querySelector("#tusken-msg").textContent);

        console.log("\n== what the board already holds");

        ok("the work is listed with its money", /Krieg/.test(panel.querySelector("#tusken-workforce").textContent) &&
            /\+2/.test(panel.querySelector("#tusken-workforce").textContent));
        ok("a convoy is listed with its clock", /Tuskara → Krieg/.test(panel.querySelector("#tusken-convoys").textContent) &&
            /2,500 · 3m 12s/.test(panel.querySelector("#tusken-convoys").textContent),
            panel.querySelector("#tusken-convoys").textContent);

        ok("the panel is styled by its own stylesheet", !!doc.getElementById("tusken-css"));

        page.dom.window.close();

        console.log("\n== everywhere else");

        const other = await open("Krieg");
        ok("no board on another world", !other.doc.getElementById("tusken-panel"));
        ok("and nothing is asked of the server", other.calls.length === 0, other.calls.length);
        other.dom.window.close();

        console.log("\n== when the patch has not been run");

        const broken = await open("Tuskara", true);
        await wait(30);
        ok("the board says what to run",
            /2026-11-26_the_tusken_world/.test(broken.doc.getElementById("tusken-msg").textContent),
            broken.doc.getElementById("tusken-msg").textContent);

        broken.dom.window.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
