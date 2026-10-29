/* The SLAVES tab on the planet page: press it and the ledger of the Tusken
   opens with the pens, the worlds and what they pay; press it again and it
   closes. The tab is an inline script in planet.html, so it is cut out of
   the page and run against a stubbed server.

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/ledger-page-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "planet.html"), "utf8");

const START = PAGE.indexOf("/* =========================================================\n   THE LEDGER OF THE TUSKEN");
const END = PAGE.indexOf("</script>", START);

if (START < 0 || END < 0) {
    console.log("FAIL the ledger script is not in planet.html");
    process.exit(1);
}

const SCRIPT = PAGE.slice(START, END);

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 25); }); }

const LEDGER = {
    me: "Combine",
    per_credit: 1000,
    pens: 12000,
    settlements: 5,
    at_work: 29000,
    total: 41000,
    income: 29,
    worlds: [
        { planet: "Krieg", amount: 25000, bonus: 25, income: 125, held: true },
        { planet: "Ultramars", amount: 4000, bonus: 4, income: 104, held: true }
    ]
};

function page(options) {

    options = options || {};

    const dom = new JSDOM(
        '<!doctype html><html><head></head><body>' +
        '<button id="slaves-tab" type="button">SLAVES</button>' +
        '<div id="slaves-panel"><div class="ledger-top">' +
        '<span>THE LEDGER OF THE TUSKEN</span><button id="slaves-close" type="button">x</button>' +
        '</div><div id="slaves-body"></div></div>' +
        '</body></html>',
        { url: "http://localhost/planet.html?name=Krieg", runScripts: "dangerously", pretendToBeVisual: true }
    );

    const calls = [];

    dom.window.supabaseClient = {
        rpc: async function (fn, args) {
            calls.push({ fn: fn, args: args });
            if (options.broken) { return { data: null, error: { message: "function public.tusken_ledger() does not exist" } }; }
            if (fn === "tusken_ledger") { return { data: LEDGER, error: null }; }
            return { data: null, error: { message: "unknown call" } };
        }
    };

    const script = dom.window.document.createElement("script");
    script.textContent = SCRIPT;
    dom.window.document.body.appendChild(script);

    return { dom: dom, doc: dom.window.document, calls: calls };
}

(async function main() {

    try {

        console.log("\n== the tab is closed until it is pressed");

        const p = page();
        const doc = p.doc;
        const tab = doc.getElementById("slaves-tab");
        const panel = doc.getElementById("slaves-panel");

        ok("the panel starts closed", panel.classList.contains("open") === false, panel.className);
        ok("and nothing is asked of the server", p.calls.length === 0, p.calls.length);

        console.log("\n== pressing it opens the ledger");

        tab.click();
        await wait(40);

        const ledgerCall = p.calls.filter(function (c) { return c.fn === "tusken_ledger"; })[0];

        ok("the ledger is read", !!ledgerCall);
        ok("the tab opens the panel", panel.classList.contains("open") === true, panel.className);
        ok("the tab reads as lit", tab.classList.contains("active"));

        const body = doc.getElementById("slaves-body");
        const text = body.textContent;

        ok("the pens on Tuskara are shown", /PENS ON TUSKARA/.test(text) && /12,000/.test(text), text);
        ok("the settlements are counted beside them", /5 SETTLED/.test(text), text);
        ok("the Tusken at work are shown", /AT WORK/.test(text) && /29,000/.test(text), text);
        ok("what they pay is shown", /\+29 \/ PAYMENT/.test(text), text);
        ok("the rate is stated", /EVERY 1,000/.test(text) && /1 CREDIT/.test(text), text);
        ok("every world holding Tusken is listed", /Krieg/.test(text) && /Ultramars/.test(text), text);
        ok("with its own bonus", /25,000 · \+25/.test(text) && /4,000 · \+4/.test(text), text);

        console.log("\n== pressing it again closes it");

        tab.click();
        await wait(20);

        ok("the panel closes", panel.classList.contains("open") === false, panel.className);
        ok("and the tab goes dark", !tab.classList.contains("active"));

        tab.click();
        await wait(40);

        console.log("\n== the close button");

        doc.getElementById("slaves-close").click();
        await wait(20);

        ok("the cross closes it too", panel.classList.contains("open") === false, panel.className);

        p.dom.window.close();

        console.log("\n== when the patch has not been run");

        const broken = page({ broken: true });

        broken.doc.getElementById("slaves-tab").click();
        await wait(40);

        const bText = broken.doc.getElementById("slaves-body").textContent;

        ok("the panel says what to run", /2026-11-29_the_eyes_and_the_ledger/.test(bText), bText);
        ok("and still opens", broken.doc.getElementById("slaves-panel").classList.contains("open"));

        broken.dom.window.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
