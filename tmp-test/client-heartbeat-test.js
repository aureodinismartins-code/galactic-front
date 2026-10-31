/* Does the shared client (gamecontrol.js) send a real touch, show which rhythm
   the economy is on, and clear the newer systems when the host resets?

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/client-heartbeat-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const GC = fs.readFileSync(path.join(__dirname, "..", "gamecontrol.js"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + String(extra).slice(0, 300) + "]" : "")); }
}

/* jsdom complains about location.reload() and about timers on a fake clock:
   neither is what this test is about */
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", function() {});
virtualConsole.on("error", function() {});

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test/galaxy.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: virtualConsole
});

const w = dom.window;
const calls = [];

let status = { started: true, maintenance: false, is_host: true, online: 1, income: "full", active: true };
let resetWarned = null;

w.supabaseClient = {
    rpc: function(name, args) {
        calls.push({ name: name, args: args });
        if (name === "game_heartbeat") { return Promise.resolve({ data: status, error: null }); }
        if (name === "game_reset") { return Promise.resolve({ data: { warnings: [] }, error: null }); }
        if (name === "game_reset_extras") {
            return Promise.resolve(resetWarned ? { data: null, error: { message: resetWarned } } : { data: { ok: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
    }
};

w.GC_NO_OVERLAY = true;
w.GC_NO_BANNER = true;
w.GC_RESET = true;
w.alert = function() {};

/* the clock the module reads */
const realNow = Date.now;
let fakeNow = realNow();

function delayNow(ms) { fakeNow += ms; }

/* Date.now inside the page is the page's own, so it can be moved forward. It
   is set before the module loads, which makes opening the page the first
   touch - exactly as a player opening it would. */
w.Date.now = function() { return fakeNow; };

w.eval(GC);

const beat = async function() {
    w.dispatchEvent(new w.Event("load"));
    await new Promise(r => setTimeout(r, 40));
};

const heartbeats = () => calls.filter(c => c.name === "game_heartbeat");
const lastHeartbeat = () => heartbeats()[heartbeats().length - 1];

(async function main() {

    console.log("the touch, and what the client tells the server");

    await beat();
    check("the page beats on load", heartbeats().length >= 1, heartbeats().length);
    check("a window just opened counts as a touch",
        lastHeartbeat().args && lastHeartbeat().args.p_active === true, JSON.stringify(lastHeartbeat().args));

    /* eleven minutes go by with nobody touching anything */
    delayNow(11 * 60 * 1000);
    status = { started: true, maintenance: false, is_host: true, online: 0, income: "reduced", active: false };
    await beat();
    check("eleven minutes later the beat carries no touch",
        lastHeartbeat().args.p_active === false, JSON.stringify(lastHeartbeat().args));

    const badge = w.document.getElementById("game-economy-badge");
    check("the screen says the income is halved", badge && /INCOME IS HALVED/.test(badge.textContent), badge && badge.textContent);
    check("and it is on show", badge && badge.style.display === "block", badge && badge.style.display);

    status = { started: true, maintenance: false, is_host: true, online: 0, income: "closed", active: false };
    await beat();
    check("two hours without a touch is announced", /INCOME IS OFF FOR EVERY SIDE/.test(badge.textContent), badge.textContent);

    /* the player comes back: a move of the mouse is a touch again */
    w.dispatchEvent(new w.MouseEvent("mousemove", { bubbles: true }));
    w.dispatchEvent(new w.KeyboardEvent("keydown", { bubbles: true }));
    status = { started: true, maintenance: false, is_host: true, online: 1, income: "full", active: true };
    await beat();
    check("a move of the mouse puts the player back", lastHeartbeat().args.p_active === true, JSON.stringify(lastHeartbeat().args));
    check("and the note goes away", badge.style.display === "none", badge.style.display);

    console.log("the host's keys live on the admin tab, and nowhere else");

    w.prompt = function() { return "RESET"; };

    const tab = w.document.getElementById("gc-admin-tab");
    check("the admin tab is on the page", !!tab);

    if (tab) {
        tab.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 20));
    }

    const adminPanel = w.document.getElementById("gc-admin-panel");

    const floating = [...w.document.querySelectorAll("button")].filter(function (b) {
        return /RESET GAME|CLOSE THE GAME|MAINTENANCE IS ON/.test(b.textContent) &&
            !(adminPanel && adminPanel.contains(b));
    });

    check("no reset or maintenance button is left floating over the map", floating.length === 0,
        floating.map(b => b.textContent).join(" | "));

    const reset = adminPanel && adminPanel.querySelector('[data-gc="reset"]');
    check("the reset sits in the admin panel", !!reset);

    reset.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));

    const order = calls.map(c => c.name);
    check("the game's own reset is called", order.indexOf("game_reset") !== -1, order.join(","));
    check("and the newer systems are wiped right after it",
        order.indexOf("game_reset_extras") > order.indexOf("game_reset"), order.join(","));
    check("and the capitals are cored in the same breath",
        order.indexOf("charters_core_capitals") > order.indexOf("game_reset_extras"), order.join(","));
    check("and the Combine's opening fleet quotas come back with it",
        order.indexOf("game_opening_quotas") > order.indexOf("charters_core_capitals"), order.join(","));
    check("and the newspaper's trays are emptied with the war",
        order.indexOf("news_clear_trays") > order.indexOf("game_opening_quotas"), order.join(","));

    console.log("and a database without the newer patch still resets");

    calls.length = 0;
    resetWarned = "Could not find the function public.game_reset_extras in the schema cache";
    reset.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    check("the missing function does not stop the reset",
        calls.map(c => c.name).indexOf("game_reset") !== -1, calls.map(c => c.name).join(","));

    console.log("and starting a new war cores the capitals");

    const startDom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html",
        runScripts: "dangerously",
        pretendToBeVisual: true,
        virtualConsole: virtualConsole
    });

    const sw = startDom.window;
    const startCalls = [];
    const notStarted = { started: false, maintenance: false, is_host: true, online: 1, income: "full", active: true };

    sw.supabaseClient = {
        rpc: function(name) {
            startCalls.push(name);
            if (name === "game_heartbeat") { return Promise.resolve({ data: notStarted, error: null }); }
            return Promise.resolve({ data: null, error: null });
        }
    };
    sw.alert = function() {};

    sw.eval(GC);
    sw.dispatchEvent(new sw.Event("load"));
    await new Promise(r => setTimeout(r, 60));

    const startButton = sw.document.getElementById("gc-start");
    check("the host is offered the start button while the game is frozen",
        !!startButton && startButton.style.display === "block", startButton && startButton.style.display);

    if (startButton) {
        startButton.dispatchEvent(new sw.MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 80));
    }

    check("and starting the war cores the capitals after it",
        startCalls.indexOf("game_start") !== -1 &&
        startCalls.indexOf("charters_core_capitals") > startCalls.indexOf("game_start"),
        startCalls.join(","));
    check("and hands the Combine its three opening fleet quotas",
        startCalls.indexOf("game_opening_quotas") > startCalls.indexOf("charters_core_capitals"),
        startCalls.join(","));
    check("a new war keeps the papers that were printed",
        startCalls.indexOf("news_clear_trays") === -1, startCalls.join(","));

    console.log("");
    if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
    console.log("all checks passed");
    process.exit(0);

})();
