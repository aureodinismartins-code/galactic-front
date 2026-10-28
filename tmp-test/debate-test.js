/* jsdom checks for the debate that moves the chamber.
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/debate-test.js */

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
const slice = (a, b, from) => {
    const i = HTML.indexOf(a, from || 0);
    const j = HTML.indexOf(b, i);
    if (i < 0 || j < 0) { throw new Error("cannot slice " + a); }
    return HTML.slice(i, j);
};

const dom = new JSDOM('<!doctype html><html><body><div id="hemi"></div><div id="legend"></div><div id="tabbody"></div></body></html>', {
    url: "https://example.test/congress.html",
    runScripts: "dangerously"
});
const w = dom.window;

w.$ = id => w.document.getElementById(id);
w.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
w.fmt = n => Number(n || 0).toLocaleString();
w.mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
w.skew = 0;
w.secondsLeft = ts => Math.max(0, Math.round((new Date(ts).getTime() - Date.now()) / 1000));
w.toast = () => {};
w.T = s => s;
w.wireLegend = () => {};
w.TYPES = { fleet_construction: { name: "Authorize New Fleet Construction", votes: "supermajority", cost: 2000, desc: "" } };
w.selProposal = null;
w.selMember = null;
w.regionFilter = null;
w.factionFilter = null;
w.groupBy = "faction";
w.warTarget = null;
w.positions = [];
w.propState = { fleets: 3 };
w.ov = {
    seats: 6, majority: 4, supermajority: 4, president: null, targets: [], my_fleets: [],
    factions: [
        { id: 1, key: "old_guard", name: "The Old Guard", color: "#c8a24a", seats: 3, loyalty: 62, priorities: [] },
        { id: 3, key: "progressives", name: "Progressives", color: "#7a8cff", seats: 3, loyalty: 79, priorities: [] }
    ],
    members: [
        { id: 11, name: "A", faction: 1, region: "Core", planet: null, area: 1, seat: 1, loyalty: 60 },
        { id: 12, name: "B", faction: 1, region: "Core", planet: null, area: 1, seat: 2, loyalty: 60 },
        { id: 13, name: "C", faction: 1, region: "Core", planet: null, area: 1, seat: 3, loyalty: 60 },
        { id: 21, name: "D", faction: 3, region: "Rim", planet: null, area: 2, seat: 4, loyalty: 70 },
        { id: 22, name: "E", faction: 3, region: "Rim", planet: null, area: 2, seat: 5, loyalty: 70 },
        { id: 23, name: "F", faction: 3, region: "Rim", planet: null, area: 2, seat: 6, loyalty: 70 }
    ],
    proposals: [{
        id: 7, type: "fleet_construction", title: "Autorizar a construção de uma nova frota",
        status: "debate", sponsor: 3, cost: 2000, proposer: "111Augimang", mine: false, by_president: false,
        debate_at: new Date(Date.now() - 60000).toISOString(),
        vote_at: new Date(Date.now() + 300000).toISOString(),
        forecast: [{ faction: 1, p: 51 }, { faction: 3, p: 79 }],
        bribes: [], yes: 0, no: 0, abstain: 0
    }]
};

w.debate = {
    proposals: [{
        id: 7, status: "debate", yes: 4, no: 1, undecided: 1,
        sides: { "11": "yes", "12": "yes", "13": "no", "21": "yes", "22": "yes", "23": "undecided" },
        factions: {
            "1": { yes: 2, no: 1, undecided: 0 },
            "3": { yes: 2, no: 0, undecided: 1 }
        }
    }]
};

/* the pieces both the dome and the cards use */
w.eval(HTML.slice(HTML.indexOf("function factionById"), HTML.indexOf("\n", HTML.indexOf("function factionById"))));
w.eval(slice("/* which live bill the dome is showing", "function renderLegend()"));
w.eval(slice("function renderLegend()", "function renderRegions()"));
w.eval(slice("/* seats sit on concentric half-rings", "function renderMember()"));
w.eval(slice("function proposalsHtml() {", "\nfunction wireProposals()"));

console.log("congress.html — the chamber has sides");

w.renderHemicycle();
const hemi = w.document.getElementById("hemi");
const rings = hemi.querySelectorAll("circle[stroke-width='1.8']");
check("every decided delegate gets a ring", rings.length === 5, String(rings.length));
const yesRings = Array.from(rings).filter(c => c.getAttribute("stroke") === "#7dff9d");
const noRings = Array.from(rings).filter(c => c.getAttribute("stroke") === "#ff8a8a");
check("yes and no are painted differently", yesRings.length === 4 && noRings.length === 1,
    yesRings.length + " yes / " + noRings.length + " no");
check("an undecided delegate has no ring",
    !Array.from(rings).some(c => c.getAttribute("cx") && false) && rings.length === 5);

w.renderLegend();
const legend = w.document.getElementById("legend").textContent;
check("the legend explains the rings", legend.indexOf("voting yes") !== -1 && legend.indexOf("voting no") !== -1);
check("the legend shows the tally", legend.indexOf("YES 4") !== -1 && legend.indexOf("NO 1") !== -1 && legend.indexOf("UNDECIDED 1") !== -1);
check("the legend names the bill", legend.indexOf("Autorizar a construção de uma nova frota") !== -1);

const body = w.document.getElementById("tabbody");
body.innerHTML = w.proposalsHtml();
const card = body.textContent;

check("the card shows the live tally, not the forecast", card.indexOf("YES 4") !== -1 && card.indexOf("the floor is still moving") !== -1);
check("the forecast is gone while the debate is live", card.indexOf("Forecast: about") === -1);
check("per-faction bars count the sides", card.indexOf("2/3") !== -1, card.slice(0, 300));

/* without the debate (SQL not run) everything falls back to the old forecast */
w.debate = null;
body.innerHTML = w.proposalsHtml();
check("without the debate the forecast comes back", body.textContent.indexOf("Forecast: about") !== -1);
check("and no rings are painted", (function () {
    w.renderHemicycle();
    return w.document.getElementById("hemi").querySelectorAll("circle[stroke-width='1.8']").length === 0;
})());

/* the bill selected for bribes is the one the dome shows */
w.debate = { proposals: [
    { id: 7, yes: 4, no: 1, undecided: 1, sides: {}, factions: {} },
    { id: 8, yes: 1, no: 5, undecided: 0, sides: {}, factions: {} }
] };
w.selProposal = 8;
check("the dome follows the selected bill", w.paintedDebate().id === 8);
w.selProposal = null;
check("with nothing selected it shows the first live bill", w.paintedDebate().id === 7);

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);
