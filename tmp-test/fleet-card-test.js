/* jsdom checks for the Congress screen:
   - a live fleet bill says what the vote itself will do (guaranteed / favoured)
   - the veto asks through the game's own card instead of window.confirm
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/fleet-card-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "congress.html"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

function slice(startMark, endMark) {
    const a = HTML.indexOf(startMark);
    const b = HTML.indexOf(endMark, a);
    if (a < 0 || b < 0) { throw new Error("cannot slice " + startMark); }
    return HTML.slice(a, b);
}

const dom = new JSDOM("<!doctype html><html><body><div id=\"tabbody\"></div></body></html>", {
    url: "https://example.test/congress.html",
    runScripts: "dangerously",
    pretendToBeVisual: true
});
const w = dom.window;

w.$ = id => w.document.getElementById(id);
w.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
w.fmt = n => Number(n || 0).toLocaleString();
w.mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
w.skew = 0;
w.secondsLeft = ts => Math.max(0, Math.round((new Date(ts).getTime() - Date.now()) / 1000));
w.toast = () => {};
w.T = s => s;   /* the page's fragment translator (English here) */
w.TYPES = { fleet_construction: { name: "Authorize New Fleet Construction", votes: "supermajority", cost: 2000, desc: "" } };
w.selProposal = null;
w.ov = {
    seats: 176,
    majority: 88,
    supermajority: 118,
    president: null,
    targets: [],
    my_fleets: [],
    factions: [
        { id: 1, key: "old_guard", name: "The Old Guard", color: "#c8a24a", seats: 40, loyalty: 62, priorities: [] },
        { id: 3, key: "progressives", name: "Progressives", color: "#7a8cff", seats: 60, loyalty: 79, priorities: [] }
    ],
    proposals: [{
        id: 7,
        type: "fleet_construction",
        title: "Autorizar a construção de uma nova frota",
        status: "introduction",
        sponsor: 3,
        cost: 2000,
        proposer: "111Augimang",
        mine: false,
        by_president: false,
        debate_at: new Date(Date.now() + 162000).toISOString(),
        vote_at: new Date(Date.now() + 462000).toISOString(),
        forecast: [{ faction: 1, p: 51 }, { faction: 3, p: 79 }],
        bribes: [],
        yes: 0, no: 0, abstain: 0
    }]
};
w.debate = null;   /* no live debate in these fixtures */
w.propState = { credits: 5000, fleets: 0, cooldown: 600, factions: {} };

w.eval(HTML.slice(HTML.indexOf("function factionById"), HTML.indexOf("\n", HTML.indexOf("function factionById"))));
w.eval(slice("function gameConfirm(message, title) {", "\nfunction factionById("));
w.eval(HTML.slice(HTML.indexOf("/* which live bill the dome is showing"), HTML.indexOf("function renderLegend()")));   /* liveDebateFor helper */
w.eval(slice("function proposalsHtml() {", "\nfunction wireProposals()"));

function card() {
    const body = w.document.getElementById("tabbody");
    body.innerHTML = w.proposalsHtml();
    return body.textContent;
}

function cardHtml() {
    const body = w.document.getElementById("tabbody");
    body.innerHTML = w.proposalsHtml();
    return body.innerHTML;
}

console.log("congress.html — fleet bill cards");

w.propState = { credits: 5000, fleets: 0, cooldown: 600, factions: {} };
check("no fleet at all -> the card says the vote is guaranteed",
    card().indexOf("GUARANTEED: the Authority has no fleet, so every delegate votes yes.") !== -1);

w.propState = { credits: 5000, fleets: 3, cooldown: 600, factions: {} };
const threeCard = cardHtml();
check("three fleets -> the card says the bars carry the rule",
    threeCard.indexOf("These bars already include the opening fleet rule.") !== -1);
check("three fleets -> the bars show 51+35 and 79+35 (capped at 100)",
    threeCard.indexOf("width:86%;background:#c8a24a") !== -1 && threeCard.indexOf("width:100%;background:#7a8cff") !== -1);
check("three fleets -> the expected count follows the bars (40*0.86 + 60*1.00 = 94)",
    threeCard.indexOf(">94</b>") !== -1);

w.propState = { credits: 5000, fleets: 5, cooldown: 600, factions: {} };
check("five fleets -> no note, normal odds", card().indexOf("FAVOURED") === -1 && card().indexOf("GUARANTEED") === -1);

w.propState = null;
check("without the state (SQL not run) the card still renders", card().indexOf("Debate opens in") !== -1);

console.log("congress.html — the veto asks through the game's own card");

check("window.confirm is no longer used for the veto",
    HTML.indexOf('if (!confirm("Use your veto on this proposal?') === -1);

(async function () {
    const p = w.gameConfirm("Use your veto on this proposal? You can only veto once per term.", "Notice");
    const overlay = w.document.getElementById("game-confirm");
    check("card opens", !!overlay);
    const cardEl = overlay.children[0];
    check("it is the NOTICE card", cardEl.children[0].textContent === "NOTICE" &&
        w.getComputedStyle(cardEl).border === "1px solid rgb(127, 220, 255)");
    check("message is the veto question",
        cardEl.children[1].textContent === "Use your veto on this proposal? You can only veto once per term.");
    cardEl.querySelectorAll("button")[1].click();
    check("CANCEL resolves false", (await p) === false);

    const p2 = w.gameConfirm("Use your veto on this proposal? You can only veto once per term.", "Notice");
    w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
    check("Enter resolves true", (await p2) === true);

    console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
    process.exit(failures ? 1 : 0);
})();
